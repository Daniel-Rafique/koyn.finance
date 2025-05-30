/**
 * Rate Limiting Test Script for koyn.ai API
 * Tests the subscription-based rate limiting system
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';
const TEST_SUBSCRIPTION_ID = '65e1df4d0ce08148bc333b62'; // From subscriptions.json

// Test endpoints that should have rate limiting
const PROTECTED_ENDPOINTS = [
  '/api/insider-trading',
  '/api/historical-prices', 
  '/api/intraday-prices',
  '/api/technical-indicators',
  '/api/chart',
  '/api/chart/eod'
];

async function testRateLimiting() {
  console.log('🧪 Testing Rate Limiting Implementation\n');
  
  // Test 1: Valid subscription should work
  console.log('Test 1: Valid subscription access');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/insider-trading`, {
      params: {
        id: TEST_SUBSCRIPTION_ID,
        limit: 10
      }
    });
    
    console.log('✅ Valid subscription worked');
    console.log('Rate limit headers:', {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      used: response.headers['x-ratelimit-used'],
      plan: response.headers['x-ratelimit-plan']
    });
  } catch (error) {
    console.log('❌ Valid subscription failed:', error.response?.data || error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Missing subscription ID should fail  
  console.log('Test 2: Missing subscription ID');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/insider-trading`, {
      params: {
        limit: 10
      }
    });
    console.log('❌ Missing subscription should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Missing subscription correctly rejected (401)');
      console.log('Error message:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
  
  console.log('\n---\n');
  
  // Test 3: Invalid subscription ID should fail
  console.log('Test 3: Invalid subscription ID');
  try {
    const response = await axios.get(`${API_BASE_URL}/api/insider-trading`, {
      params: {
        id: 'invalid-subscription-id',
        limit: 10
      }
    });
    console.log('❌ Invalid subscription should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Invalid subscription correctly rejected (401)');
      console.log('Error message:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
  
  console.log('\n---\n');
  
  // Test 4: Test all protected endpoints
  console.log('Test 4: Testing all protected endpoints');
  for (const endpoint of PROTECTED_ENDPOINTS) {
    try {
      const params = { id: TEST_SUBSCRIPTION_ID };
      
      // Add required parameters for specific endpoints
      if (endpoint.includes('historical-prices') || endpoint.includes('intraday-prices') || endpoint.includes('technical-indicators')) {
        params.symbol = 'AAPL';
      }
      if (endpoint.includes('chart')) {
        params.symbol = 'AAPL';
      }
      
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, { params });
      console.log(`✅ ${endpoint}: Success (${response.status})`);
      
      // Log rate limiting info
      if (response.headers['x-ratelimit-limit']) {
        console.log(`   Rate limit: ${response.headers['x-ratelimit-used']}/${response.headers['x-ratelimit-limit']} (${response.headers['x-ratelimit-plan']} plan)`);
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 429) {
        console.log(`❌ ${endpoint}: ${error.response.status} - ${error.response.data.message}`);
      } else {
        console.log(`⚠️  ${endpoint}: ${error.response?.status || 'Network Error'} - ${error.response?.data?.message || error.message}`);
      }
    }
  }
  
  console.log('\n---\n');
  
  // Test 5: Rate limit exhaustion (if limits are low enough)
  console.log('Test 5: Rate limit exhaustion test');
  console.log('Making multiple requests to test rate limiting...');
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  for (let i = 0; i < 5; i++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/insider-trading`, {
        params: {
          id: TEST_SUBSCRIPTION_ID,
          limit: 5
        }
      });
      successCount++;
      console.log(`Request ${i + 1}: Success (${response.headers['x-ratelimit-used']}/${response.headers['x-ratelimit-limit']})`);
    } catch (error) {
      if (error.response?.status === 429) {
        rateLimitedCount++;
        console.log(`Request ${i + 1}: Rate limited (429)`);
        console.log('Rate limit error:', error.response.data);
        break; // Stop after first rate limit
      } else {
        console.log(`Request ${i + 1}: Other error (${error.response?.status}): ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\nRate limiting test summary:`);
  console.log(`Successful requests: ${successCount}`);
  console.log(`Rate limited requests: ${rateLimitedCount}`);
  
  console.log('\n🏁 Rate limiting tests completed');
}

// Test the subscription plan detection
async function testSubscriptionPlanDetection() {
  console.log('\n🔍 Testing Subscription Plan Detection\n');
  
  try {
    // This would need to be run within the API context
    // For now, just document what should be tested
    console.log('This test should verify:');
    console.log('1. Correct plan detection from subscriptions.json');
    console.log('2. Proper rate limit assignment based on plan');
    console.log('3. Expired subscription handling');
    console.log('4. Non-existent subscription handling');
    console.log('5. Rate limit enforcement per plan type');
    
    console.log('\nExpected rate limits:');
    console.log('- Free: ', process.env.FREE || 'Set FREE env var');
    console.log('- Monthly: ', process.env.MONTHLY || 'Set MONTHLY env var');  
    console.log('- Quarterly: ', process.env.QUARTERLY || 'Set QUARTERLY env var');
    console.log('- Yearly: ', process.env.YEARLY || 'Set YEARLY env var');
    
  } catch (error) {
    console.log('❌ Subscription plan detection test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Rate Limiting Tests for koyn.ai API\n');
  
  await testRateLimiting();
  await testSubscriptionPlanDetection();
  
  console.log('\n✅ All tests completed!');
  console.log('\nTo run these tests:');
  console.log('1. Ensure the API server is running on localhost:3001');
  console.log('2. Ensure subscriptions.json has the test subscription');
  console.log('3. Set environment variables for rate limits (FREE, MONTHLY, QUARTERLY, YEARLY)');
  console.log('4. Run: node test-rate-limiting.js');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testRateLimiting,
  testSubscriptionPlanDetection,
  runAllTests
}; 