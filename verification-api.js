require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Create Express app
const app = express();
const port = process.env.VERIFICATION_PORT || 3005;

// JWT Secret - use environment variable or generate one
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set in environment. Using generated secret (tokens will be invalid after restart).');
  console.log('Generated JWT_SECRET:', JWT_SECRET);
}

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

// In-memory store for refresh tokens (in production, use Redis or database)
const refreshTokenStore = new Map();

// Initialize SendGrid if API key is provided
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
let sgMail;

if (SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('SendGrid client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SendGrid client:', error);
  }
} else {
  console.warn('SENDGRID_API_KEY not provided, email sending will be disabled');
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://koyn.finance',
      'https://www.koyn.finance',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://167.71.16.134'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'X-Request-Time'
  ]
}));
app.use(bodyParser.json({ limit: '10mb' }));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory...');
  fs.mkdirSync(dataDir, { recursive: true });
}

// Map to store verification codes with expiration times and attempt count
const verificationCodes = new Map();

// JWT Token generation functions
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'koyn.finance',
    audience: 'koyn.finance-users'
  });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'koyn.finance',
    audience: 'koyn.finance-users'
  });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'koyn.finance',
      audience: 'koyn.finance-users'
    });
  } catch (error) {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'koyn.finance',
      audience: 'koyn.finance-users'
    });
  } catch (error) {
    return null;
  }
}

// Middleware to verify JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required',
      code: 'TOKEN_REQUIRED'
    });
  }
  
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired access token',
      code: 'TOKEN_INVALID'
    });
  }
  
  // Verify the subscription is still active
  const subscriptions = readSubscriptions();
  const subscription = subscriptions.find(sub => 
    sub.email.toLowerCase() === decoded.email.toLowerCase() && 
    sub.status === 'active'
  );
  
  if (!subscription) {
    return res.status(403).json({ 
      success: false, 
      error: 'Subscription no longer active',
      code: 'SUBSCRIPTION_INACTIVE'
    });
  }
  
  req.user = decoded;
  req.subscription = subscription;
  next();
}

// Helper function to create secure user session
function createUserSession(email, subscription) {
  const sessionId = crypto.randomUUID();
  const tokenPayload = {
    email: email.toLowerCase(),
    sessionId,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);
  
  // Store refresh token securely
  refreshTokenStore.set(refreshToken, {
    email: email.toLowerCase(),
    sessionId,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  });
  
  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
    tokenType: 'Bearer'
  };
}

// Helper function to read subscriptions from the data file
function readSubscriptions() {
  try {
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    if (fs.existsSync(subscriptionsFilePath)) {
      const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error('Error reading subscriptions file:', err);
    return [];
  }
}

// Helper function to write contacts to the data file
function writeContacts(contacts) {
  try {
    const contactsFilePath = path.join(__dirname, 'data', 'contacts.json');
    fs.writeFileSync(contactsFilePath, JSON.stringify(contacts, null, 2));
  } catch (err) {
    console.error('Error writing contacts file:', err);
  }
}

// Helper function to read contacts from the data file
function readContacts() {
  try {
    const contactsFilePath = path.join(__dirname, 'data', 'contacts.json');
    if (fs.existsSync(contactsFilePath)) {
      const data = fs.readFileSync(contactsFilePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (err) {
    console.error('Error reading contacts file:', err);
    return [];
  }
}

// Helper function to find or create a contact
function findOrCreateContact(email, data = {}) {
  const contacts = readContacts();
  
  // Find existing contact
  const existingIndex = contacts.findIndex(contact => 
    contact.email.toLowerCase() === email.toLowerCase()
  );
  
  if (existingIndex !== -1) {
    // Update existing contact
    contacts[existingIndex] = {
      ...contacts[existingIndex],
      ...data,
      updatedAt: new Date().toISOString()
    };
  } else {
    // Create new contact
    contacts.push({
      id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    });
  }
  
  // Save contacts
  writeContacts(contacts);
  
  // Return the contact (either updated or new)
  return contacts.find(contact => contact.email.toLowerCase() === email.toLowerCase());
}

// Helper function to send a verification email
async function sendVerificationEmail(email, code) {
  try {
    // Store verification data in contact record
    findOrCreateContact(email, {
      verificationCode: code,
      verificationSentAt: new Date().toISOString(),
      verificationStatus: 'pending'
    });
    
    // Try to send email using SendGrid
    if (sgMail) {
      try {
        console.log('Attempting to send verification email via SendGrid');
        
        const msg = {
          to: email,
          from: 'hi@koyn.finance', // Use your verified sender
          subject: 'Your koyn.ai Verification Code',
          text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nThank you,\nThe Koyn.ai Team`,
          html: `
            <div style="font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #ffffff; background-color: #000000;">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://koyn.finance/logo.png" alt="Koyn.finance Logo" style="max-width: 120px;">
              </div>
              
              <div style="background-color: #000000; border-radius: 0.75rem; padding: 30px; box-shadow: 0 4px 20px rgba(255, 255, 255, 0.1); border: 1px solid #ffffff;">
                <h2 style="color: #ffffff; text-align: center; font-weight: 600; margin-top: 0; margin-bottom: 25px; font-size: 22px;">Your Verification Code</h2>
                
                <div style="background: linear-gradient(to right, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1)); border-radius: 0.5rem; padding: 20px; text-align: center; margin: 20px 0; border: 1px solid rgba(255, 255, 255, 0.3);">
                  <div style="font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #ffffff; text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);">
                    ${code}
                  </div>
                </div>
                
                <p style="margin-bottom: 20px; color: #ffffff; text-align: center; font-size: 15px;">
                  This verification code will expire in <strong style="color: #ffffff;">10 minutes</strong>.
                </p>
                
                <p style="margin-bottom: 30px; color: #ffffff; text-align: center; font-size: 15px;">
                  If you didn't request this code, you can safely ignore this email.
                </p>
              </div>
              
              <div style="border-top: 1px solid #ffffff; margin-top: 30px; padding-top: 20px; font-size: 13px; color: #ffffff; text-align: center;">
                <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} Koyn.ai. All rights reserved.</p>
                <div style="display: flex; justify-content: center; margin-top: 15px;">
                  <a href="https://koyn.finance/terms" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Terms</a>
                  <a href="https://koyn.finance/privacy" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Privacy</a>
                  <a href="https://koyn.finance/contact" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Contact</a>
                </div>
              </div>
            </div>
          `
        };
        
        await sgMail.send(msg);
        console.log(`Verification email sent to ${email} with code ${code} using SendGrid`);
        return true;
      } catch (sendGridError) {
        console.error('Error sending email via SendGrid:', sendGridError);
        if (sendGridError.response) {
          console.error('SendGrid API error:', sendGridError.response.body);
        }
        
        // Development fallback
        if (process.env.NODE_ENV === 'development' || !SENDGRID_API_KEY) {
          console.log('⚠️ DEVELOPMENT MODE: SendGrid email sending failed, but pretending it worked');
          console.log('📧 Verification Email Details:');
          console.log(`📧 To: ${email}`);
          console.log(`📧 Code: ${code}`);
          console.log('⚠️ No actual email was sent. Use this code for testing.');
          return true;
        }
        
        return false;
      }
    }
    
    // If no SendGrid client, fall back to development mode behavior
    if (process.env.NODE_ENV === 'development' || !SENDGRID_API_KEY) {
      console.log('⚠️ DEVELOPMENT MODE: No SendGrid client available');
      console.log('📧 Verification Email Details:');
      console.log(`📧 To: ${email}`);
      console.log(`📧 Code: ${code}`);
      console.log('⚠️ No actual email was sent. Use this code for testing.');
      return true;
    }
    
    console.error('Email sending failed: No email provider configured');
    return false;
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.error('Error stack:', error.stack);
    
    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ DEVELOPMENT MODE: Email sending failed, but pretending it worked');
      console.log('📧 Verification Email Details:');
      console.log(`📧 To: ${email}`);
      console.log(`📧 Code: ${code}`);
      console.log('⚠️ No actual email was sent. Use this code for testing.');
      return true;
    }
    
    return false;
  }
}

// Helper function to update contact verification status
function updateContactVerificationStatus(email, status) {
  try {
    const contact = findOrCreateContact(email, {
      verificationStatus: status,
      ...(status === 'verified' ? { verifiedAt: new Date().toISOString() } : {})
    });
    
    // If verified, create/update customer record
    if (status === 'verified') {
      // Check if we have subscription data for this email
      const subscriptions = readSubscriptions();
      const subscription = subscriptions.find(sub => 
        sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active'
      );
      
      if (subscription) {
        // Get date values from subscription
        const startDate = subscription.startedAt || new Date().toISOString();
        const endDate = subscription.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        
        // Update contact with subscription details
        findOrCreateContact(email, {
          subscriptionId: subscription.id,
          subscriptionPlan: subscription.plan || 'Premium',
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          customerType: 'active',
          customerId: `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
    }
    
    console.log(`Contact verification status updated for ${email}: ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating contact verification status:', error);
    return false;
  }
}

// Endpoint to check subscription status
app.get('/api/subscription/:email', (req, res) => {
  const { email } = req.params;
  const subscriptions = readSubscriptions();

  // Find the most recent active subscription for this email
  const subscription = subscriptions
    .filter(sub => {
      // Check if email matches (case-insensitive)
      const emailMatch = sub.email.toLowerCase() === email.toLowerCase();
      
      // Consider status field first (explicit status check)
      if (sub.status === 'active' && emailMatch) {
        return true;
      }
      
      // Only check renewal date for subscriptions not explicitly marked as inactive
      if (sub.status !== 'inactive' && emailMatch) {
        // Check if the subscription has a valid renewal date that's in the future
        if (sub.renewalDate) {
          const renewalDate = new Date(sub.renewalDate);
          const now = new Date();
          return renewalDate > now;
        }
      }
      
      return false;
    })
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];

  if (subscription) {
    // Ensure status is explicitly set to active
    const subscriptionResponse = {
      ...subscription,
      status: subscription.status || 'active'
    };
    
    // Log subscription details for debugging
    console.log(`Subscription found for ${email}:`, {
      id: subscriptionResponse.id,
      status: subscriptionResponse.status,
      renewalDate: subscriptionResponse.renewalDate,
      startedAt: subscriptionResponse.startedAt
    });
    
    res.json({
      active: true,
      subscription: subscriptionResponse
    });
  } else {
    // Check if we have any subscription for this email (even inactive)
    const inactiveSubscription = subscriptions
      .filter(sub => sub.email.toLowerCase() === email.toLowerCase())
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
      
    if (inactiveSubscription) {
      console.log(`Inactive subscription found for ${email}`);
      // Return inactive subscription data to show details on billing page
      res.json({
        active: false,
        subscription: {
          ...inactiveSubscription,
          status: 'inactive'
        },
        email: email
      });
    } else {
      console.log(`No subscription found for ${email}`);
      res.json({
        active: false,
        email: email
      });
    }
  }
});

// Verification request endpoint
app.post('/api/verification/request', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  try {
    // Check if email exists in our subscription system
    const subscriptions = readSubscriptions();

    // Check if the email has an active subscription
    const subscription = subscriptions.find(sub =>
      sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active'
    );

    const isSubscribed = !!subscription;

    if (!isSubscribed) {
      return res.status(400).json({
        success: false,
        error: 'Email not found in our subscription system',
        subscriptionRequired: true
      });
    }

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration time (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Store the code with expiration time and reset attempt count
    verificationCodes.set(email, {
      code,
      expiresAt,
      attempts: 0
    });

    // Send verification email
    let emailSent = await sendVerificationEmail(email, code);

    // Return success with code in development mode or when email sending fails
    if (process.env.NODE_ENV === 'development' || !emailSent || !SENDGRID_API_KEY) {
      console.log('⚠️ Returning verification code in response for testing');
      console.log(`📧 Code: ${code}`);

      return res.json({
        success: true,
        code,
        expiresAt,
        emailSent,
        message: emailSent ? 'Email sent successfully' : 'Email failed, but code returned for testing'
      });
    }

    return res.json({
      success: true,
      expiresAt,
      emailSent
    });
  } catch (error) {
    console.error('Error sending verification code:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// Verification code verification endpoint
app.post('/api/verification/verify', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      error: 'Email and code are required'
    });
  }

  try {
    // Get verification data
    const verification = verificationCodes.get(email);

    // Check if code exists
    if (!verification) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found for this email',
        attemptsLeft: 0
      });
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      // Remove expired verification data
      verificationCodes.delete(email);

      return res.status(400).json({
        success: false,
        error: 'Verification code has expired',
        attemptsLeft: 0
      });
    }

    // Increment attempt count
    verification.attempts += 1;
    verificationCodes.set(email, verification);

    // Check if max attempts reached (5 attempts)
    if (verification.attempts >= 5) {
      // Remove verification data
      verificationCodes.delete(email);

      return res.status(400).json({
        success: false,
        error: 'Maximum verification attempts reached',
        attemptsLeft: 0
      });
    }

    // Check if code matches
    if (verification.code !== code) {
      const attemptsLeft = 5 - verification.attempts;

      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
        attemptsLeft
      });
    }

    // Code is valid - get subscription data and create secure session
    const subscriptions = readSubscriptions();
    const subscription = subscriptions.find(sub => 
      sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active'
    );

    if (!subscription) {
      // Remove verification data if no active subscription
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'No active subscription found for this email',
        subscriptionRequired: true
      });
    }

    // Update contact status
    updateContactVerificationStatus(email, 'verified');

    // Remove verification data after successful verification
    verificationCodes.delete(email);

    // Create secure session with JWT tokens
    const sessionData = createUserSession(email, subscription);

    // Log successful authentication
    console.log(`🔐 Secure session created for ${email}`);

    // Return secure tokens instead of subscription data
    return res.json({
      success: true,
      message: 'Verification successful',
      verifiedAt: new Date().toISOString(),
      auth: {
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        tokenType: sessionData.tokenType
      },
      user: {
        email: email.toLowerCase(),
        plan: subscription.plan,
        isActive: true
      }
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
});

// Token refresh endpoint
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token required',
      code: 'REFRESH_TOKEN_REQUIRED'
    });
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired refresh token',
      code: 'REFRESH_TOKEN_INVALID'
    });
  }

  // Check if refresh token exists in our store
  const storedTokenData = refreshTokenStore.get(refreshToken);
  if (!storedTokenData) {
    return res.status(403).json({
      success: false,
      error: 'Refresh token not found',
      code: 'REFRESH_TOKEN_NOT_FOUND'
    });
  }

  // Verify the subscription is still active
  const subscriptions = readSubscriptions();
  const subscription = subscriptions.find(sub => 
    sub.email.toLowerCase() === decoded.email.toLowerCase() && 
    sub.status === 'active'
  );

  if (!subscription) {
    // Remove invalid refresh token
    refreshTokenStore.delete(refreshToken);
    return res.status(403).json({
      success: false,
      error: 'Subscription no longer active',
      code: 'SUBSCRIPTION_INACTIVE'
    });
  }

  // Update last used timestamp
  storedTokenData.lastUsed = new Date().toISOString();
  refreshTokenStore.set(refreshToken, storedTokenData);

  // Generate new access token
  const newTokenPayload = {
    email: decoded.email,
    sessionId: decoded.sessionId,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    iat: Math.floor(Date.now() / 1000)
  };

  const newAccessToken = generateAccessToken(newTokenPayload);

  console.log(`🔄 Access token refreshed for ${decoded.email}`);

  res.json({
    success: true,
    auth: {
      accessToken: newAccessToken,
      expiresIn: 15 * 60, // 15 minutes
      tokenType: 'Bearer'
    },
    user: {
      email: decoded.email,
      plan: subscription.plan,
      isActive: true
    }
  });
});

// Secure subscription status endpoint (requires authentication)
app.get('/api/auth/subscription', authenticateToken, (req, res) => {
  // User data is already verified by the authenticateToken middleware
  const subscription = req.subscription;
  
  console.log(`📊 Subscription status checked for ${req.user.email}`);

  res.json({
    success: true,
    user: {
      email: req.user.email,
      plan: subscription.plan,
      isActive: true
    },
    subscription: {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      startedAt: subscription.startedAt,
      renewalDate: subscription.renewalDate,
      // Don't expose sensitive payment details
      paymentMethod: subscription.paymentMethod
    }
  });
});

// Logout endpoint (invalidates refresh token)
app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken && refreshTokenStore.has(refreshToken)) {
    refreshTokenStore.delete(refreshToken);
    console.log(`🚪 User logged out and refresh token invalidated`);
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Legacy subscription endpoint - now secured or deprecated
app.get('/api/subscription/:email', (req, res) => {
  // Log security warning for legacy endpoint usage
  console.warn(`⚠️  SECURITY: Legacy subscription endpoint accessed for ${req.params.email}. This should be migrated to secure /api/auth/subscription`);
  
  // Return minimal data and suggest using secure endpoint
  res.status(200).json({
    active: false,
    message: 'Please use the secure authentication flow',
    migrateToSecure: true
  });
});

// Helper function to send subscription notification emails
async function sendSubscriptionEmail(email, type, subscriptionData = {}) {
  try {
    // Update contact with subscription information
    const contact = findOrCreateContact(email, {
      lastSubscriptionEvent: type,
      lastSubscriptionEventAt: new Date().toISOString(),
      ...(subscriptionData || {})
    });
    
    if (!sgMail) {
      console.log(`⚠️ No SendGrid client available. Can't send ${type} subscription email to ${email}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 Subscription Email (${type}) would have been sent to: ${email}`);
        return true;
      }
      return false;
    }
    
    // Format dates for display
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };
    
    // Plan information
    const planName = subscriptionData.plan || 'Premium';
    const planDisplayName = planName.charAt(0).toUpperCase() + planName.slice(1);
    const startDate = formatDate(subscriptionData.startedAt || new Date().toISOString());
    const renewalDate = formatDate(subscriptionData.renewalDate);
    const endDate = subscriptionData.endedAt ? formatDate(subscriptionData.endedAt) : 'N/A';
    
    // Determine email content based on type
    let subject, heading, message, ctaText, ctaLink, additionalInfo;
    
    switch (type) {
      case 'started':
        subject = `Welcome to koyn.ai ${planDisplayName}!`;
        heading = 'Your Subscription is Active';
        message = `
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            Thank you for subscribing to koyn.ai ${planDisplayName}! Your subscription is now active.
          </p>
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            You now have full access to all premium features and content.
          </p>
        `;
        ctaText = 'Get Started';
        ctaLink = 'https://koyn.ai';
        additionalInfo = `
          <div style="background: rgba(99, 102, 241, 0.1); border-radius: 0.5rem; padding: 20px; margin: 20px 0; border: 1px solid rgba(99, 102, 241, 0.3);">
            <h3 style="color: #818cf8; font-size: 16px; margin-top: 0; margin-bottom: 15px;">Subscription Details</h3>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Plan:</strong> ${planDisplayName}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Start Date:</strong> ${startDate}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Next Renewal:</strong> ${renewalDate}</p>
          </div>
        `;
        break;
        
      case 'renewed':
        subject = 'Your koyn.ai Subscription Has Been Renewed';
        heading = 'Subscription Renewed';
        message = `
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            Your koyn.ai ${planDisplayName} subscription has been successfully renewed.
          </p>
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            You'll continue to enjoy uninterrupted access to all premium features.
          </p>
        `;
        ctaText = 'View Dashboard';
        ctaLink = 'https://koyn.ai';
        additionalInfo = `
          <div style="background: rgba(99, 102, 241, 0.1); border-radius: 0.5rem; padding: 20px; margin: 20px 0; border: 1px solid rgba(99, 102, 241, 0.3);">
            <h3 style="color: #818cf8; font-size: 16px; margin-top: 0; margin-bottom: 15px;">Renewal Details</h3>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Plan:</strong> ${planDisplayName}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Renewal Date:</strong> ${startDate}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Next Renewal:</strong> ${renewalDate}</p>
          </div>
        `;
        break;
        
      case 'ended':
        subject = 'Your koyn.ai Subscription Has Ended';
        heading = 'Subscription Ended';
        message = `
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            Your koyn.ai ${planDisplayName} subscription has ended.
          </p>
          <p style="margin-bottom: 20px; color: #cbd5e1; text-align: center; font-size: 15px;">
            We're sorry to see you go. You can resubscribe at any time to regain access to premium features.
          </p>
        `;
        ctaText = 'Resubscribe Now';
        ctaLink = 'https://koyn.ai';
        additionalInfo = `
          <div style="background: rgba(99, 102, 241, 0.1); border-radius: 0.5rem; padding: 20px; margin: 20px 0; border: 1px solid rgba(99, 102, 241, 0.3);">
            <h3 style="color: #818cf8; font-size: 16px; margin-top: 0; margin-bottom: 15px;">Subscription Details</h3>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Plan:</strong> ${planDisplayName}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">Start Date:</strong> ${startDate}</p>
            <p style="margin: 5px 0; color: #cbd5e1; font-size: 14px;"><strong style="color: #f8fafc;">End Date:</strong> ${endDate}</p>
          </div>
        `;
        break;
        
      default:
        console.error(`Unknown subscription email type: ${type}`);
        return false;
    }
    
    try {
      console.log(`Attempting to send ${type} subscription email to ${email}`);
      
      const msg = {
        to: email,
        from: 'hi@koyn.ai',
        subject: subject,
        text: `${heading}\n\n${subject}\n\nVisit our website at https://koyn.ai\n\nThank you,\nThe Koyn.ai Team`,
        html: `
          <div style="font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #ffffff; background-color: #000000;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://koyn.ai/logo.png" alt="Koyn.ai Logo" style="max-width: 120px;">
            </div>
            
            <div style="background-color: #000000; border-radius: 0.75rem; padding: 30px; box-shadow: 0 4px 20px rgba(255, 255, 255, 0.1); border: 1px solid #ffffff;">
              <h2 style="color: #ffffff; text-align: center; font-weight: 600; margin-top: 0; margin-bottom: 25px; font-size: 22px;">${heading}</h2>
              
              ${message}
              
              ${additionalInfo}
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${ctaLink}" style="display: inline-block; background: linear-gradient(to right, #6366f1, #10b981); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); transition: all 0.2s ease-in-out;">${ctaText}</a>
              </div>
            </div>
            
            <div style="border-top: 1px solid #ffffff; margin-top: 30px; padding-top: 20px; font-size: 13px; color: #ffffff; text-align: center;">
              <p style="margin-bottom: 10px;">© ${new Date().getFullYear()} Koyn.ai. All rights reserved.</p>
              <div style="display: flex; justify-content: center; margin-top: 15px;">
                <a href="https://koyn.ai/terms" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Terms</a>
                <a href="https://koyn.ai/privacy" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Privacy</a>
                <a href="https://koyn.ai/contact" style="color: #ffffff; text-decoration: none; margin: 0 10px;">Contact</a>
              </div>
            </div>
          </div>
        `
      };
      
      await sgMail.send(msg);
      console.log(`Subscription ${type} email sent to ${email} successfully`);
      return true;
    } catch (sendGridError) {
      console.error(`Error sending subscription ${type} email via SendGrid:`, sendGridError);
      if (sendGridError.response) {
        console.error('SendGrid API error:', sendGridError.response.body);
      }
      
      // Development mode fallback
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ DEVELOPMENT MODE: Subscription ${type} email sending failed, but pretending it worked`);
        console.log(`📧 Subscription Email (${type}) would have been sent to: ${email}`);
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error(`Error sending subscription ${type} email:`, error);
    
    // Development mode fallback
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️ DEVELOPMENT MODE: Subscription ${type} email sending failed, but pretending it worked`);
      console.log(`📧 Subscription Email (${type}) would have been sent to: ${email}`);
      return true;
    }
    
    return false;
  }
}

// Endpoint to handle webhook notifications from Helio
app.post('/api/webhook/subscription', async (req, res) => {
  try {
    console.log('Received subscription webhook:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook shared token from Helio
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get the token from the request
    const receivedToken = authHeader.replace('Bearer ', '');
    
    // In production, verify the token against your saved sharedToken
    let expectedToken = process.env.HELIO_WEBHOOK_TOKEN;
    
    // If not in environment, try to read from token file
    if (!expectedToken) {
      try {
        const tokenFilePath = path.join(__dirname, 'data', 'webhook-token.json');
        if (fs.existsSync(tokenFilePath)) {
          const tokenData = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
          expectedToken = tokenData.token;
        }
      } catch (tokenError) {
        console.error('Error reading webhook token file:', tokenError);
      }
    }
    
    // In production, uncomment this to validate tokens
    /*
    if (!expectedToken || receivedToken !== expectedToken) {
      console.error('Invalid webhook authentication token');
      return res.status(401).json({ success: false, error: 'Invalid authentication' });
    }
    */
    
    // Extract relevant data from the webhook
    const { event, email, subscriptionId, subscriptionState, transactionObject } = req.body;
    
    if (!email) {
      console.error('Webhook missing email field, cannot process');
      return res.status(400).json({ success: false, error: 'Missing email field' });
    }
    
    // Process the event based on its type
    if (event === 'STARTED') {
      // A new subscription has started
      const subscriptions = readSubscriptions();
      
      // Determine the plan type 
      let planType = 'month';
      if (transactionObject?.meta?.productDetails?.name) {
        const planName = transactionObject.meta.productDetails.name.toLowerCase();
        if (planName.includes('year')) {
          planType = 'yearly';
        } else if (planName.includes('3') || planName.includes('three') || planName.includes('quarter')) {
          planType = 'quarterly';
        }
      }
      
      // Calculate renewal date
      const renewalDate = new Date();
      if (planType === 'year') {
        renewalDate.setFullYear(renewalDate.getFullYear());
      } else if (planType === 'quarterly') {
        renewalDate.setMonth(renewalDate.getMonth() + 3);
      } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      }
      
      // Create the new subscription object
      const newSubscription = {
        id: subscriptionId,
        email,
        status: subscriptionState || 'active',
        startedAt: new Date().toISOString(),
        renewalDate: renewalDate.toISOString(),
        transactionId: transactionObject?.id,
        plan: planType,
        paymentMethod: 'helio',
        amount: transactionObject?.meta?.totalAmount 
          ? parseFloat(transactionObject.meta.totalAmount) / 1000000
          : undefined,
        currency: transactionObject?.meta?.currency?.id || 'USDC'
      };
      
      // Find existing subscription
      const existingIndex = subscriptions.findIndex(
        sub => sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active'
      );
      
      // Update or add subscription
      if (existingIndex !== -1) {
        subscriptions[existingIndex] = {
          ...subscriptions[existingIndex],
          ...newSubscription,
          updatedAt: new Date().toISOString()
        };
      } else {
        subscriptions.push(newSubscription);
      }
      
      // Save to subscription data store
      writeSubscriptions(subscriptions);
      console.log(`New subscription added for ${email}`);
      
      // Send welcome email
      await sendSubscriptionEmail(email, 'started', newSubscription);
    } 
    else if (event === 'RENEWED') {
      // A subscription was renewed
      const subscriptions = readSubscriptions();
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || (sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active')
      );
      
      if (index !== -1) {
        // Calculate the new renewal date
        const renewalDate = new Date();
        const planType = subscriptions[index].plan || 'monthly';
        
        if (planType === 'yearly') {
          renewalDate.setFullYear(renewalDate.getFullYear() + 100);
        } else if (planType === 'quarterly') {
          renewalDate.setMonth(renewalDate.getMonth() + 3);
        } else {
          renewalDate.setMonth(renewalDate.getMonth() + 1);
        }
        
        // Update the subscription object
        subscriptions[index].status = subscriptionState || 'active';
        subscriptions[index].renewalDate = renewalDate.toISOString();
        subscriptions[index].renewedAt = new Date().toISOString();
        subscriptions[index].transactionId = transactionObject?.id || subscriptions[index].transactionId;
        
        if (transactionObject) {
          if (transactionObject.meta?.totalAmount) {
            subscriptions[index].amount = parseFloat(transactionObject.meta.totalAmount) / 1000000;
          }
          if (transactionObject.meta?.currency?.id) {
            subscriptions[index].currency = transactionObject.meta.currency.id;
          }
        }
        
        writeSubscriptions(subscriptions);
        console.log(`Subscription renewed for ${email}`);
        
        // Send renewal email
        await sendSubscriptionEmail(email, 'renewed', subscriptions[index]);
      } else {
        console.error(`Cannot find subscription for ${email} with ID ${subscriptionId} for renewal`);
      }
    } 
    else if (event === 'ENDED') {
      // A subscription has ended
      const subscriptions = readSubscriptions();
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || (sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active')
      );
      
      if (index !== -1) {
        subscriptions[index].status = 'inactive';
        subscriptions[index].endedAt = new Date().toISOString();
        subscriptions[index].endReason = req.body.endReason || 'unknown';
        
        writeSubscriptions(subscriptions);
        console.log(`Subscription ended for ${email}`);
        
        // Send subscription ended email
        await sendSubscriptionEmail(email, 'ended', subscriptions[index]);
      } else {
        console.error(`Cannot find subscription for ${email} with ID ${subscriptionId} to end`);
      }
    }
    
    // Return a 200 OK response to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to write subscriptions to the data file
function writeSubscriptions(subscriptions) {
  try {
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    
    // Create the data directory if it doesn't exist
    if (!fs.existsSync(path.dirname(subscriptionsFilePath))) {
      fs.mkdirSync(path.dirname(subscriptionsFilePath), { recursive: true });
    }
    
    fs.writeFileSync(subscriptionsFilePath, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.error('Error writing subscriptions file:', err);
  }
}

// Start the server if this is the main module
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Verification API server listening on port ${port}`);
  });
}

// Export for use in other files
module.exports = app; 