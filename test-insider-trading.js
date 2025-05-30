// Test script for the insider trading endpoint
require('dotenv').config();
const axios = require('axios');

const testInsiderTrading = async () => {
  try {
    console.log('Testing insider trading endpoint...');
    
    // Test with a well-known stock symbol that should have insider trading data
    const symbol = 'AAPL';
    console.log(`Testing with symbol: ${symbol}`);
    
    // Direct FMP API test
    try {
      console.log('1. Testing direct FMP API connection:');
      const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
      const response = await axios.get(`https://financialmodelingprep.com/stable/insider-trading/${symbol}`, {
        params: {
          page: 0,
          limit: 5,
          apikey: apiKey
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`Success! Retrieved ${response.data.length} insider trading records from FMP API.`);
        console.log('Sample record:', JSON.stringify(response.data[0], null, 2));
      } else {
        console.log('No insider trading data found in FMP API response.');
      }
    } catch (fmpError) {
      console.error('Error testing direct FMP API:', fmpError.message);
    }
    
    // Test our API endpoint
    try {
      console.log('\n2. Testing our API endpoint:');
      // Assuming our API is running on port 3001
      const response = await axios.get(`http://localhost:3001/api/insider-trading?symbol=${symbol}`);
      
      if (response.data && response.data.success) {
        console.log(`Success! Retrieved ${response.data.count} insider trading records from our API.`);
        if (response.data.data && response.data.data.length > 0) {
          console.log('Sample record:', JSON.stringify(response.data.data[0], null, 2));
        }
      } else {
        console.log('No insider trading data or error in our API response:', response.data);
      }
    } catch (apiError) {
      console.error('Error testing our API endpoint:', apiError.message);
      if (apiError.response) {
        console.error('Response data:', apiError.response.data);
      }
    }
    
    console.log('\nTest completed.');
  } catch (error) {
    console.error('Error in test script:', error);
  }
};

// Run the test
testInsiderTrading(); 