// Test script for Financial Modeling Prep's stable EOD endpoint
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';

async function testStableEodEndpoint() {
  console.log('Testing FMP stable EOD endpoint...');
  
  // Test both a regular stock and a memecoin 
  const symbols = ['AAPL', 'SPX'];
  
  for (const symbol of symbols) {
    try {
      console.log(`\nTesting symbol: ${symbol}`);
      
      const url = `https://financialmodelingprep.com/stable/historical-price-eod/full`;
      console.log(`Requesting: ${url}?symbol=${symbol}`);
      
      const response = await axios.get(url, {
        params: {
          symbol: symbol,
          apikey: API_KEY
        }
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ Success! Found ${response.data.length} data points`);
        console.log('First data point:');
        console.log(JSON.stringify(response.data[0], null, 2));
      } else {
        console.log(`❌ Empty or invalid response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${symbol}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
    
    console.log('-----------------------------------');
  }
}

// Run the test
testStableEodEndpoint().catch(error => {
  console.error('Test execution failed:', error);
}); 