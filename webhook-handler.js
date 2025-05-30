require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Create Express app
const app = express();
const port = process.env.PORT || 3003 ;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database-like storage for subscriptions
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'data', 'subscriptions.json');

// Ensure the data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize subscriptions file if it doesn't exist
if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2));
}

// Helper function to read subscriptions
function readSubscriptions() {
  try {
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading subscriptions file:', err);
    return [];
  }
}

// Helper function to write subscriptions
function writeSubscriptions(subscriptions) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.error('Error writing subscriptions file:', err);
  }
}

// Helper function to notify the main API about subscription changes
async function notifyMainApi(action, subscription) {
  try {
    // API endpoint URL - use API_URL from env variables or default to localhost
    const apiUrl = process.env.API_URL || 'https://koyn.finance:3001';
    
    console.log(`Notifying main API about subscription ${action} for ${subscription.email}`);
    
    const response = await axios.post(`${apiUrl}/api/webhook/subscription`, {
      event: action.toUpperCase(),
      email: subscription.email,
      subscriptionId: subscription.id,
      subscriptionState: subscription.status,
      transactionObject: {
        id: subscription.transactionId,
        meta: {
          customerDetails: {
            email: subscription.email
          },
          productDetails: {
            name: subscription.plan
          },
          totalAmount: subscription.amount ? (subscription.amount * 1000000).toString() : "0", // Convert to lamports
          currency: {
            id: subscription.currency || "USDC"
          }
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HELIO_WEBHOOK_TOKEN || "development-token"}`,
        'x-api-key': process.env.INTERNAL_API_KEY // Use internal API key for authentication
      }
    });
    
    if (response.status === 200 && response.data.success) {
      console.log(`Successfully notified main API about ${action} for ${subscription.email}`);
    } else {
      console.error(`Error notifying main API: ${response.status} - ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error(`Failed to notify verification API about subscription change:`, error);
    if (error.response) {
      console.error(`Response status: ${error.response.status}, data:`, error.response.data);
    }
    // Continue processing even if notification fails
  }
}

// Configuration
const HELIO_API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.hel.io/v1' 
  : 'https://api.dev.hel.io/v1';

const HELIO_API_KEY = process.env.HELIO_API_KEY;
const HELIO_API_SECRET = process.env.HELIO_API_SECRET;
const PAYLINK_ID = process.env.HELIO_PAYLINK_ID || '68229fd19009f0c6c3ff67f2';

// The URL where Helio should send webhook notifications
// In production, this should be your server's public URL
const WEBHOOK_TARGET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://koyn.finance:3001/api/webhook/subscription' 
  : 'https://koyn.finance:3001/api/webhook/subscription';

/**
 * Registers the subscription webhooks with Helio
 */
async function registerSubscriptionWebhooks() {
  try {
    console.log('Registering Helio subscription webhooks...');
    
    if (!HELIO_API_KEY || !HELIO_API_SECRET) {
      console.error('Missing Helio API credentials. Set HELIO_API_KEY and HELIO_API_SECRET in your .env file.');
      return;
    }
    
    // Request configuration
    const webhookConfig = {
      paylinkId: PAYLINK_ID,
      targetUrl: WEBHOOK_TARGET_URL,
      events: ["STARTED", "RENEWED", "ENDED"]
    };
    
    // Register the webhook
    const response = await axios.post(
      `${HELIO_API_BASE_URL}/webhook/paylink/subscription?apiKey=${HELIO_API_KEY}`,
      webhookConfig,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HELIO_API_SECRET}`,
          'Cache-Control': 'no-cache'
        }
      }
    );
    
    if (response.data && response.data.id) {
      console.log('Webhook registration successful!');
      console.log('Webhook ID:', response.data.id);
      console.log('Shared Token:', response.data.sharedToken);
      
      // Store the shared token securely (e.g. in environment variables or secure database)
      // In a production environment, you would save this token to validate incoming webhooks
      // process.env.HELIO_WEBHOOK_SHARED_TOKEN = response.data.sharedToken;
      
      // Save this token to a secure location
      saveSharedToken(response.data.sharedToken);
      
      return {
        success: true,
        webhookId: response.data.id,
        sharedToken: response.data.sharedToken
      };
    } else {
      console.error('Webhook registration failed. Unexpected response format:', response.data);
      return { success: false };
    }
  } catch (error) {
    console.error('Error registering webhook:', error.response?.data || error.message);
    return { 
      success: false, 
      error: error.response?.data || error.message 
    };
  }
}

/**
 * Save the shared token securely for future webhook validation
 * This is a placeholder function - in production you should store this securely
 */
function saveSharedToken(token) {
  // In a real application, you would:
  // 1. Store this in a secure database
  // 2. Encrypt it before storage
  // 3. Make it accessible to the webhook verification logic
  
  console.log('IMPORTANT: In production, store this shared token securely!');
  console.log('This token is used to verify that incoming webhooks are legitimately from Helio.');
  
  // Store token in a file for development mode
  try {
    // Create the data directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }
    
    // Store the token in a JSON file
    const tokenData = {
      token,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'data', 'webhook-token.json'), 
      JSON.stringify(tokenData, null, 2)
    );
    
    console.log('Webhook token stored in data/webhook-token.json');
  } catch (error) {
    console.error('Error storing webhook token:', error);
  }
}

/**
 * Deletes an existing webhook
 */
async function deleteWebhook(webhookId) {
  try {
    console.log(`Deleting webhook ${webhookId}...`);
    
    const response = await axios.delete(
      `${HELIO_API_BASE_URL}/webhook/paylink/subscription/${webhookId}?apiKey=${HELIO_API_KEY}`,
      {
        headers: {
          'Authorization': `Bearer ${HELIO_API_SECRET}`
        }
      }
    );
    
    console.log('Webhook deletion response:', response.data);
    return { success: true };
  } catch (error) {
    console.error('Error deleting webhook:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Lists all existing webhooks
 */
async function listWebhooks() {
  try {
    console.log('Listing existing webhooks...');
    
    const response = await axios.get(
      `${HELIO_API_BASE_URL}/webhook/paylink/subscription?apiKey=${HELIO_API_KEY}`,
      {
        headers: {
          'Authorization': `Bearer ${HELIO_API_SECRET}`
        }
      }
    );
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} webhooks:`);
      response.data.forEach(webhook => {
        console.log(`- ID: ${webhook.id}, URL: ${webhook.targetUrl}, Events: ${webhook.events.join(', ')}`);
      });
      
      return {
        success: true,
        webhooks: response.data
      };
    } else {
      console.error('Unexpected response format when listing webhooks:', response.data);
      return { success: false };
    }
  } catch (error) {
    console.error('Error listing webhooks:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// Execute the registration function if this script is run directly
if (require.main === module) {
  // Get the command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'register';
  
  if (command === 'register') {
    registerSubscriptionWebhooks()
      .then(() => console.log('Webhook registration process completed.'))
      .catch(err => console.error('Error in webhook registration process:', err));
  } else if (command === 'list') {
    listWebhooks()
      .then(() => console.log('Webhook listing process completed.'))
      .catch(err => console.error('Error in webhook listing process:', err));
  } else if (command === 'delete' && args[1]) {
    deleteWebhook(args[1])
      .then(() => console.log('Webhook deletion process completed.'))
      .catch(err => console.error('Error in webhook deletion process:', err));
  } else {
    console.log('Usage:');
    console.log('  node webhook-handler.js register    - Register subscription webhooks');
    console.log('  node webhook-handler.js list        - List existing webhooks');
    console.log('  node webhook-handler.js delete <id> - Delete a webhook by ID');
  }
}

// Export functions for use in other files
module.exports = {
  registerSubscriptionWebhooks,
  listWebhooks,
  deleteWebhook
};

// Helper function to extract relevant subscription details from Helio webhook payload
function parseHelioWebhookPayload(payload) {
  try {
    // Initialize with default values
    const result = {
      email: null,
      subscriptionId: null,
      subscriptionState: 'active',
      event: null,
      transactionId: null,
      planType: 'monthly',
      amount: null,
      currency: 'USDC',
      transactionObject: null
    };
    
    // Extract event type
    if (payload.event) {
      result.event = payload.event;
      
      // Normalize event names
      if (result.event === 'CREATED') {
        result.event = 'STARTED';
      } else if (result.event === 'CANCELLED') {
        result.event = 'ENDED';
        result.subscriptionState = 'inactive';
      }
    }
    
    // Extract transaction object
    if (payload.transactionObject) {
      result.transactionObject = payload.transactionObject;
      result.transactionId = payload.transactionObject.id;
      result.subscriptionId = payload.transactionObject.id;
      
      // Extract customer email
      if (payload.transactionObject.meta && payload.transactionObject.meta.customerDetails) {
        result.email = payload.transactionObject.meta.customerDetails.email;
      }
      
      // Extract amount
      if (payload.transactionObject.meta && payload.transactionObject.meta.totalAmount) {
        result.amount = parseFloat(payload.transactionObject.meta.totalAmount) / 1000000;
      }
      
      // Extract currency
      if (payload.transactionObject.meta && payload.transactionObject.meta.currency && payload.transactionObject.meta.currency.id) {
        result.currency = payload.transactionObject.meta.currency.id;
      }
      
      // Determine plan type from product details
      if (payload.transactionObject.meta && payload.transactionObject.meta.productDetails && payload.transactionObject.meta.productDetails.name) {
        const planName = payload.transactionObject.meta.productDetails.name.toLowerCase();
        
        if (planName.includes('yearly')) {
          result.planType = 'yearly';
        } else if (planName.includes('3') || planName.includes('three') || planName.includes('quarter')) {
          result.planType = 'quarterly';
        } else if (planName.includes('year') || planName.includes('annual')) {
          result.planType = 'yearly';
        } else {
          result.planType = 'monthly';
        }
      }
    } else if (payload.transaction) {
      // Handle stringified transaction object
      try {
        const parsedTransaction = JSON.parse(payload.transaction);
        result.transactionObject = parsedTransaction;
        result.transactionId = parsedTransaction.id;
        result.subscriptionId = parsedTransaction.id;
        
        // Extract other details from parsed transaction
        if (parsedTransaction.meta) {
          if (parsedTransaction.meta.customerDetails) {
            result.email = parsedTransaction.meta.customerDetails.email;
          }
          
          if (parsedTransaction.meta.totalAmount) {
            result.amount = parseFloat(parsedTransaction.meta.totalAmount) / 1000000;
          }
          
          if (parsedTransaction.meta.currency && parsedTransaction.meta.currency.id) {
            result.currency = parsedTransaction.meta.currency.id;
          }
          
          if (parsedTransaction.meta.productDetails && parsedTransaction.meta.productDetails.name) {
            const planName = parsedTransaction.meta.productDetails.name.toLowerCase();
            
            if (planName.includes('yearly')) {
              result.planType = 'yearly';
            } else if (planName.includes('3') || planName.includes('three') || planName.includes('quarter')) {
              result.planType = 'quarterly';
            } else if (planName.includes('year') || planName.includes('annual')) {
              result.planType = 'yearly';
            } else {
              result.planType = 'monthly';
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing transaction string:', parseError);
      }
    }
    
    // Handle direct fields for backward compatibility
    if (payload.email) {
      result.email = payload.email;
    }
    
    if (payload.subscriptionId) {
      result.subscriptionId = payload.subscriptionId;
    }
    
    if (payload.subscriptionState) {
      result.subscriptionState = payload.subscriptionState;
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing Helio webhook payload:', error);
    return {
      email: null,
      subscriptionId: null,
      subscriptionState: 'unknown',
      event: null,
      transactionId: null,
      planType: 'unknown',
      amount: null,
      currency: 'USDC',
      transactionObject: null
    };
  }
}

// Helio webhook endpoint for subscription events
app.post('/webhook/subscription', (req, res) => {
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
    
    // Parse the webhook payload
    const { 
      email, 
      subscriptionId, 
      subscriptionState, 
      event, 
      transactionId,
      planType,
      amount,
      currency,
      transactionObject 
    } = parseHelioWebhookPayload(req.body);
    
    if (!email) {
      console.error('Webhook missing email field, cannot process');
      return res.status(400).json({ success: false, error: 'Missing email field' });
    }
    
    // Process the event based on its type
    if (event === 'STARTED' || event === 'CREATED') {
      // A new subscription has started
      const subscriptions = readSubscriptions();
      
      // Check if subscription already exists
      const existingIndex = subscriptions.findIndex(
        sub => sub.email === email && sub.status === 'active'
      );
      
      // Create the new subscription object with additional details
      const newSubscription = {
        id: subscriptionId,
        email,
        status: subscriptionState || 'active',
        startedAt: new Date().toISOString(),
        renewalDate: calculateRenewalDate(planType),
        transactionId: transactionId || transactionObject?.id,
        plan: planType,
        paymentMethod: 'helio',
        amount,
        currency,
        // Save the complete transaction object for reference
        transactionDetails: transactionObject
      };
      
      // If subscription already exists, update it, otherwise add new
      if (existingIndex !== -1) {
        subscriptions[existingIndex] = {
          ...subscriptions[existingIndex],
          ...newSubscription,
          updatedAt: new Date().toISOString()
        };
      } else {
        subscriptions.push(newSubscription);
      }
      
      writeSubscriptions(subscriptions);
      console.log(`New subscription added for ${email}`);
      
      // Notify main API
      notifyMainApi('started', newSubscription);
    } 
    else if (event === 'RENEWED') {
      // A subscription was renewed
      const subscriptions = readSubscriptions();
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || 
        (sub.transactionId === transactionId) || 
        (sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active')
      );
      
      if (index !== -1) {
        // Update the subscription object
        subscriptions[index].status = subscriptionState || 'active';
        subscriptions[index].renewalDate = calculateRenewalDate(planType || subscriptions[index].plan);
        subscriptions[index].renewedAt = new Date().toISOString();
        subscriptions[index].transactionId = transactionId || transactionObject?.id || subscriptions[index].transactionId;
        
        // Update other fields if available
        if (amount) {
          subscriptions[index].amount = amount;
        }
        if (currency) {
          subscriptions[index].currency = currency;
        }
        subscriptions[index].paymentMethod = 'helio';
        
        // Save the complete transaction object
        if (transactionObject) {
          subscriptions[index].transactionDetails = transactionObject;
        }
        
        writeSubscriptions(subscriptions);
        console.log(`Subscription renewed for ${email}`);
        
        // Notify main API
        notifyMainApi('renewed', subscriptions[index]);
      } else {
        console.error(`Cannot find subscription with ID ${subscriptionId} for renewal`);
      }
    } 
    else if (event === 'ENDED' || event === 'CANCELLED') {
      // A subscription has ended
      const subscriptions = readSubscriptions();
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || 
        (sub.transactionId === transactionId) || 
        (sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active')
      );
      
      if (index !== -1) {
        subscriptions[index].status = 'inactive';
        subscriptions[index].endedAt = new Date().toISOString();
        subscriptions[index].endReason = req.body.endReason || 'unknown';
        
        // Update with final transaction details if available
        if (transactionObject) {
          subscriptions[index].transactionDetails = transactionObject;
        }
        
        writeSubscriptions(subscriptions);
        console.log(`Subscription ended for ${email}`);
        
        // Notify main API
        notifyMainApi('ended', subscriptions[index]);
      } else {
        console.error(`Cannot find subscription with ID ${subscriptionId} to end`);
      }
    }

    // Return a 200 OK response to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to check subscription status
app.get('/api/subscription/:email', (req, res) => {
  const { email } = req.params;
  const subscriptions = readSubscriptions();
  
  // Find the most recent active subscription for this email
  const subscription = subscriptions
    .filter(sub => sub.email === email && sub.status !== 'inactive')
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  
  if (subscription) {
    res.json({
      active: true,
      subscription
    });
  } else {
    res.json({
      active: false
    });
  }
});

// Helper function to calculate renewal date based on plan type
function calculateRenewalDate(planType) {
  const date = new Date();
  
  if (planType === 'yearly') {
    // For yearly plans, set a date far in the future
    date.setFullYear(date.getFullYear());
  } else if (planType === 'quarterly' || planType === '3 month') {
    // For 3-month plans
    date.setMonth(date.getMonth() + 3);
  } else {
    // Default to monthly
    date.setMonth(date.getMonth() + 1);
  }
  
  return date.toISOString();
}

// Command to manually set up webhook for a specific paylink
if (process.argv[2] === 'setup-webhook' && process.argv[3]) {
  const paylinkId = process.argv[3];
  setupSubscriptionWebhook(paylinkId)
    .then(data => {
      console.log('Webhook setup complete:', data);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error setting up webhook:', err);
      process.exit(1);
    });
} else {
  // Start the server normally
  app.listen(port, () => {
    console.log(`Webhook handler listening on port ${port}`);
  });
}

module.exports = app; 