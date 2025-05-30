// Direct test of FMP API for Bitcoin prices
require('dotenv').config();
const axios = require('axios');

async function testBitcoinPriceDirect() {
  try {
    // Test with a bitcoin asset object
    const btcAsset = {
      symbol: 'BTC',
      name: 'Bitcoin',
      type: 'Cryptocurrency'
    };
    
    console.log('Testing Bitcoin price directly from FMP API...');
    console.log('Asset:', btcAsset);
    
    // Make a request directly to the FMP API
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    // First try without USD suffix (which should return the incorrect stock)
    console.log('\n=== TEST 1: BTC SYMBOL ===');
    const response1 = await axios.get('https://financialmodelingprep.com/stable/quote', {
      params: {
        symbol: 'BTC',
        apikey: apiKey
      }
    });
    
    if (response1.data && Array.isArray(response1.data) && response1.data.length > 0) {
      console.log('BTC quote data:', response1.data[0]);
      console.log(`BTC symbol returns: $${response1.data[0].price} (${response1.data[0].name}, exchange: ${response1.data[0].exchange})`);
    } else {
      console.log('No data returned for BTC symbol');
    }
    
    // Then try with USD suffix (which should return the correct crypto)
    console.log('\n=== TEST 2: BTCUSD SYMBOL ===');
    const response2 = await axios.get('https://financialmodelingprep.com/stable/quote', {
      params: {
        symbol: 'BTCUSD',
        apikey: apiKey
      }
    });
    
    if (response2.data && Array.isArray(response2.data) && response2.data.length > 0) {
      console.log('BTCUSD quote data:', response2.data[0]);
      console.log(`BTCUSD symbol returns: $${response2.data[0].price} (${response2.data[0].name}, exchange: ${response2.data[0].exchange})`);
    } else {
      console.log('No data returned for BTCUSD symbol');
    }
    
    // Add test for v3/quotes/crypto endpoint
    console.log('\n=== TEST 3: CRYPTO QUOTES ENDPOINT ===');
    const response3 = await axios.get('https://financialmodelingprep.com/api/v3/quotes/crypto', {
      params: {
        apikey: apiKey
      }
    });
    
    if (response3.data && Array.isArray(response3.data)) {
      const btcData = response3.data.find(item => item.symbol === 'BTCUSD');
      if (btcData) {
        console.log('Bitcoin from crypto quotes endpoint:', btcData);
        console.log(`Crypto quotes endpoint price: $${btcData.price}`);
      } else {
        console.log('Bitcoin not found in crypto quotes endpoint');
      }
    } else {
      console.log('No data returned from crypto quotes endpoint');
    }
    
    // Test for historical data endpoint
    console.log('\n=== TEST 4: HISTORICAL CHART ENDPOINT ===');
    const response4 = await axios.get('https://financialmodelingprep.com/api/v3/historical-chart/1day/BTCUSD', {
      params: {
        apikey: apiKey,
        limit: 5
      }
    });
    
    if (response4.data && Array.isArray(response4.data) && response4.data.length > 0) {
      console.log(`Got ${response4.data.length} historical data points for BTCUSD`);
      console.log('Latest price:', response4.data[0]);
    } else {
      console.log('No historical data returned for BTCUSD');
    }
    
  } catch (error) {
    console.error('Error testing Bitcoin price directly:', error.message);
  }
}

// Run the test
testBitcoinPriceDirect(); 