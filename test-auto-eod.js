// Test script for the EOD endpoint with dex flag
require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}`;

async function testEodEndpoint() {
  console.log('Testing EOD endpoint with dex flag handling...');
  
  // Test cases
  const testCases = [
    { symbol: 'AAPL', description: 'Regular stock' },
    { symbol: 'SPX', dex: 'true', description: 'Memecoin with dex flag' }
  ];
  
  for (const test of testCases) {
    try {
      console.log(`\nTesting: ${test.description} (${test.symbol})`);
      
      // Build the URL with params
      let url = `${API_URL}/api/chart/eod?symbol=${test.symbol}`;
      if (test.dex) url += `&dex=${test.dex}`;
      
      console.log(`Requesting: ${url}`);
      const response = await axios.get(url);
      
      console.log('Response received');
      console.log('Status:', response.status);
      console.log('Format:', response.data.format);
      console.log('Symbol:', response.data.symbol);
      console.log('Data points:', response.data.data ? response.data.data.length : 'undefined');
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('First data point:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
      }
      
      console.log('-----------------------------------');
    } catch (error) {
      console.error(`❌ Error testing ${test.symbol}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

// Run the test
testEodEndpoint().catch(error => {
  console.error('Test execution failed:', error);
}); 