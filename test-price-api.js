// Test script for price data API endpoints
require('dotenv').config();
const axios = require('axios');

// Configuration
const API_KEY = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
const STOCK_SYMBOL = 'AAPL'; // Test with Apple
const CRYPTO_SYMBOL = 'BTC'; // Test with Bitcoin

// Test getting historical price data from FMP v3 API
async function testHistoricalPriceData(symbol) {
  try {
    console.log(`Testing historical price data endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`, {
      params: {
        apikey: API_KEY,
        serietype: 'line',
        timeseries: 30 // Last 30 days
      }
    });

    if (response.data && response.data.historical && Array.isArray(response.data.historical)) {
      console.log(`✅ Historical price data endpoint works for ${symbol}`);
      console.log(`Retrieved ${response.data.historical.length} data points for ${symbol}`);
      
      // Display sample of the data
      const sample = response.data.historical.slice(0, 3);
      console.log('Sample price data:', JSON.stringify(sample, null, 2));
      
      // Calculate average price from last 7 days
      const recentPrices = response.data.historical.slice(0, 7);
      const avgPrice = recentPrices.reduce((sum, item) => sum + item.close, 0) / recentPrices.length;
      console.log(`Average price from last 7 days: $${avgPrice.toFixed(2)}`);
      
      return true;
    } else {
      console.log(`❌ No historical price data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing historical price data endpoint for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test getting crypto historical price data from FMP API
async function testCryptoHistoricalData(symbol) {
  try {
    console.log(`Testing crypto historical data endpoint for ${symbol}...`);
    const cryptoSymbol = `${symbol}USD`;
    
    // Try the standard historical chart endpoint
    const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-chart/1day/${cryptoSymbol}`, {
      params: {
        apikey: API_KEY,
        limit: 30
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Crypto historical data endpoint works for ${cryptoSymbol}`);
      console.log(`Retrieved ${response.data.length} data points for ${cryptoSymbol}`);
      
      // Display sample of the data
      const sample = response.data.slice(0, 3);
      console.log('Sample price data:', JSON.stringify(sample, null, 2));
      
      // Calculate average price from last 7 days
      const recentPrices = response.data.slice(0, 7);
      const avgPrice = recentPrices.reduce((sum, item) => sum + item.close, 0) / recentPrices.length;
      console.log(`Average price from last 7 days: $${avgPrice.toFixed(2)}`);
      
      // Check if the price seems reasonable (for BTC)
      if (symbol === 'BTC') {
        if (avgPrice > 20000 && avgPrice < 150000) {
          console.log(`✅ Price range looks reasonable for Bitcoin (${avgPrice.toFixed(2)})`);
        } else {
          console.log(`❌ Price range for Bitcoin looks suspicious: $${avgPrice.toFixed(2)} - expected between $20,000-$150,000`);
        }
      }
      
      return true;
    } else {
      console.log(`❌ No crypto historical data returned for ${cryptoSymbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing crypto historical data for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test getting daily time-series price data from FMP 1hour API
async function testHourlyPriceData(symbol) {
  try {
    console.log(`Testing hourly price data endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/stable/historical-chart/1hour/${symbol}`, {
      params: {
        apikey: API_KEY
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Hourly price data endpoint works for ${symbol}`);
      console.log(`Retrieved ${response.data.length} hourly data points for ${symbol}`);
      
      // Display sample of the data
      const sample = response.data.slice(0, 3);
      console.log('Sample hourly data:', JSON.stringify(sample, null, 2));
      
      return true;
    } else {
      console.log(`❌ No hourly price data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing hourly price data endpoint for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test getting real-time quote data
async function testQuoteData(symbol) {
  try {
    console.log(`Testing real-time quote endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/stable/quote`, {
      params: {
        symbol: symbol,
        apikey: API_KEY
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Real-time quote endpoint works for ${symbol}`);
      console.log('Quote data:', JSON.stringify(response.data[0], null, 2));
      
      // If it's Bitcoin, check if the price is reasonable
      if (symbol === 'BTC' || symbol === 'BTCUSD') {
        const price = response.data[0].price;
        if (price > 20000 && price < 150000) {
          console.log(`✅ Price looks reasonable for Bitcoin (${price.toFixed(2)})`);
        } else {
          console.log(`❌ Price for Bitcoin looks suspicious: $${price.toFixed(2)} - expected between $20,000-$150,000`);
        }
      }
      
      return true;
    } else {
      console.log(`❌ No quote data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing quote endpoint for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test getting crypto quotes data from v3 API
async function testCryptoQuotes() {
  try {
    console.log('Testing crypto quotes endpoint...');
    const response = await axios.get(`https://financialmodelingprep.com/api/v3/quotes/crypto`, {
      params: {
        apikey: API_KEY
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Crypto quotes endpoint works');
      console.log(`Retrieved quotes for ${response.data.length} cryptocurrencies`);
      
      // Find Bitcoin in the response
      const btcData = response.data.find(crypto => crypto.symbol === 'BTCUSD');
      if (btcData) {
        console.log('Bitcoin quote data:', JSON.stringify(btcData, null, 2));
        
        // Check if the price is reasonable
        if (btcData.price > 20000 && btcData.price < 150000) {
          console.log(`✅ Price looks reasonable for Bitcoin (${btcData.price.toFixed(2)})`);
        } else {
          console.log(`❌ Price for Bitcoin looks suspicious: $${btcData.price.toFixed(2)} - expected between $20,000-$150,000`);
        }
      } else {
        console.log('❌ Bitcoin data not found in crypto quotes');
      }
      
      return true;
    } else {
      console.log('❌ No crypto quotes returned');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing crypto quotes endpoint:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('==========================================================');
  console.log('TESTING PRICE DATA ENDPOINTS');
  console.log(`API Key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log('==========================================================');

  // Test stock data endpoints
  console.log('\n=== STOCK DATA TESTS ===');
  console.log(`Test Symbol: ${STOCK_SYMBOL}`);
  
  // Test historical price data for stock
  console.log('\n=== TEST 1: STOCK HISTORICAL PRICE DATA ===');
  await testHistoricalPriceData(STOCK_SYMBOL);

  // Test hourly price data for stock
  console.log('\n=== TEST 2: STOCK HOURLY PRICE DATA ===');
  await testHourlyPriceData(STOCK_SYMBOL);

  // Test real-time quote data for stock
  console.log('\n=== TEST 3: STOCK REAL-TIME QUOTE ===');
  await testQuoteData(STOCK_SYMBOL);

  // Test crypto data endpoints
  console.log('\n\n=== CRYPTO DATA TESTS ===');
  console.log(`Test Symbol: ${CRYPTO_SYMBOL}`);
  
  // Test historical price data for crypto
  console.log('\n=== TEST 4: CRYPTO HISTORICAL DATA ===');
  await testCryptoHistoricalData(CRYPTO_SYMBOL);
  
  // Test quote data for crypto
  console.log('\n=== TEST 5: CRYPTO QUOTE ===');
  await testQuoteData(CRYPTO_SYMBOL);
  
  // Test the v3 crypto quotes endpoint which returns all crypto prices
  console.log('\n=== TEST 6: CRYPTO QUOTES ENDPOINT ===');
  await testCryptoQuotes();
  
  // Test quote data for BTCUSD format
  console.log('\n=== TEST 7: CRYPTO QUOTE (BTCUSD FORMAT) ===');
  await testQuoteData('BTCUSD');

  console.log('\n==========================================================');
  console.log('TESTING COMPLETE');
  console.log('==========================================================');
}

// Run the tests
runTests(); 