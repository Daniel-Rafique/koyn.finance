// Very simple test script for the EOD chart endpoint
require('dotenv').config();
const axios = require('axios');

// Use the actual server endpoint
const API_URL = 'https://koyn.ai:3001';

// Test the endpoint directly with minimal code
async function testEodEndpoint() {
  console.log('Simple EOD endpoint test on production server');
  
  try {
    console.log(`Requesting: ${API_URL}/api/chart/eod?symbol=AAPL`);
    const response = await axios.get(`${API_URL}/api/chart/eod?symbol=AAPL`);
    
    console.log('Response received');
    console.log('Status:', response.status);
    console.log('Has data object:', !!response.data);
    
    // Check if we have the expected format
    if (response.data && response.data.format === 'eod') {
      console.log('✅ EOD format confirmed');
      console.log('Data array length:', response.data.data ? response.data.data.length : 'undefined');
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('Sample data point:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
      }
    } else {
      console.log('❌ Wrong format:', response.data.format);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testEodEndpoint(); 