// Test script for Bitcoin price fetching
require('dotenv').config();
const axios = require('axios');

// Simple test to check if the Bitcoin price is fetched correctly
async function testBitcoinPrice() {
  try {
    console.log('Testing Bitcoin price fetching from API...');
    
    // Make a request to our sentiment endpoint which triggers asset detection and price fetching
    const response = await axios.post('http://localhost:3000/api/sentiment', {
      question: 'bitcoin price prediction',
      email: 'test@example.com',
      status: 'active',
      id: 'test-id'
    });
    
    if (response.data && response.data.asset) {
      console.log('Asset detected:', response.data.asset);
      
      if (response.data.asset.price) {
        const price = parseFloat(response.data.asset.price);
        console.log(`Bitcoin price: $${price.toLocaleString()}`);
        
        // Check if the price seems reasonable (for BTC)
        if (price > 20000 && price < 150000) {
          console.log(`✅ Price looks reasonable for Bitcoin: $${price.toLocaleString()}`);
        } else {
          console.log(`❌ Price for Bitcoin looks suspicious: $${price.toLocaleString()} - expected between $20,000-$150,000`);
        }
      } else {
        console.log('❌ No price returned for Bitcoin');
      }
    } else {
      console.log('❌ No asset data returned from API');
    }
  } catch (error) {
    console.error('❌ Error testing Bitcoin price:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testBitcoinPrice(); 