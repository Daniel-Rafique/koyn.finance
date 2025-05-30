#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Verification API base URL
const verificationPort = process.env.VERIFICATION_PORT || 3005;
const API_BASE_URL = `http://localhost:${verificationPort}`;

// Test data
const TEST_EMAIL = 'test@example.com';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper to log with color
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.magenta}=== ${msg} ===${colors.reset}`)
};

// Create or update a test subscription
const createTestSubscription = async (email) => {
  log.title('Creating Test Subscription');
  
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Path to subscriptions file
    const subscriptionsFilePath = path.join(dataDir, 'subscriptions.json');
    
    // Create or read existing subscriptions
    let subscriptions = [];
    if (fs.existsSync(subscriptionsFilePath)) {
      const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
      try {
        subscriptions = JSON.parse(data);
      } catch (err) {
        log.warn('Failed to parse existing subscriptions, starting fresh.');
      }
    }
    
    // Check if subscription already exists
    const existingIndex = subscriptions.findIndex(sub => sub.email === email);
    
    // Create subscription data
    const subscription = {
      email,
      status: 'active',
      plan: 'premium',
      startedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      orderId: `test-${Date.now()}`
    };
    
    // Add or update subscription
    if (existingIndex >= 0) {
      subscriptions[existingIndex] = subscription;
    } else {
      subscriptions.push(subscription);
    }
    
    // Save updated subscriptions
    fs.writeFileSync(subscriptionsFilePath, JSON.stringify(subscriptions, null, 2));
    
    log.success(`Test subscription created for ${email}`);
    return true;
  } catch (error) {
    log.error(`Failed to create test subscription: ${error.message}`);
    return false;
  }
};

// Test subscription status endpoint
const testSubscriptionEndpoint = async (email) => {
  log.title('Testing Subscription Endpoint');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/subscription/${encodeURIComponent(email)}`);
    
    if (response.data && response.data.active) {
      log.success(`Subscription is active for ${email}`);
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log.error('Subscription is not active');
      console.log(JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    log.error(`Failed to check subscription status: ${error.message}`);
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
};

// Test verification request endpoint
const testVerificationRequest = async (email) => {
  log.title('Testing Verification Request');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/verification/request`, { email });
    
    if (response.data && response.data.success) {
      log.success('Verification request successful');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Return the verification code in dev mode
      return response.data.code || true;
    } else {
      log.error('Verification request failed');
      console.log(JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    log.error(`Failed to request verification: ${error.message}`);
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
};

// Test verification endpoint
const testVerification = async (email, code) => {
  log.title('Testing Verification');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/verification/verify`, { email, code });
    
    if (response.data && response.data.success) {
      log.success('Verification successful');
      console.log(JSON.stringify(response.data, null, 2));
      return true;
    } else {
      log.error('Verification failed');
      console.log(JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    log.error(`Failed to verify code: ${error.message}`);
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
};

// Main test function
const runTests = async () => {
  log.title('Starting Verification System Tests');
  
  // Get test email from user or use default
  const email = await question(`Enter test email [${TEST_EMAIL}]: `) || TEST_EMAIL;
  
  // Create test subscription
  await createTestSubscription(email);
  
  // Test subscription status
  const subscriptionActive = await testSubscriptionEndpoint(email);
  
  if (!subscriptionActive) {
    log.error('Cannot proceed with verification tests - subscription is not active');
    rl.close();
    return;
  }
  
  // Test verification request
  const verificationResult = await testVerificationRequest(email);
  
  if (!verificationResult) {
    log.error('Cannot proceed with verification test - request failed');
    rl.close();
    return;
  }
  
  let code;
  
  // If we're in development mode and received a code
  if (typeof verificationResult === 'string') {
    code = verificationResult;
    log.info(`Using auto-generated code: ${code}`);
  } else {
    // Otherwise, prompt for code from email
    code = await question('Enter the verification code from your email: ');
  }
  
  if (!code) {
    log.error('No verification code provided, cannot continue');
    rl.close();
    return;
  }
  
  // Test verification
  await testVerification(email, code);
  
  rl.close();
};

// Run the tests
runTests().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  rl.close();
}); 