// Test script for the Financial Modeling Prep stable EOD endpoint
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';

async function testFmpEodEndpoint() {
  console.log('Testing FMP stable EOD endpoint directly...');
  
  const symbols = ['AAPL', 'MSFT', 'BTCUSD', '^GSPC'];
  
  for (const symbol of symbols) {
    try {
      console.log(`\nFetching EOD data for ${symbol}...`);
      
      const url = `https://financialmodelingprep.com/stable/historical-price-eod/full`;
      const response = await axios.get(url, {
        params: {
          symbol: symbol,
          apikey: API_KEY
        }
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ Successfully retrieved ${response.data.length} days of EOD data for ${symbol}`);
        console.log('First data point:');
        console.log(JSON.stringify(response.data[0], null, 2));
      } else {
        console.error(`❌ Invalid or empty response for ${symbol}`);
        console.error('Response:', response.data);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${symbol}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
    
    console.log('-----------------------------------');
  }
}

// Run the test
testFmpEodEndpoint().catch(error => {
  console.error('Test execution failed:', error);
}); 