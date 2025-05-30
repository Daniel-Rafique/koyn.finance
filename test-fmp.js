// A simple script to test FMP API endpoints after upgrade
require('dotenv').config();
const axios = require('axios');

// Get the API key from environment variables
const FMP_API_KEY = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';

// Test symbols
const symbols = ['AAPL', 'AMZN', 'MSFT', 'TSLA', 'GOOGL'];

// Function to test the price endpoint
async function testPriceEndpoint(symbol) {
  try {
    console.log(`Testing price endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/stable/quote`, {
      params: {
        symbol: symbol,
        apikey: FMP_API_KEY
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Price for ${symbol}: $${response.data[0].price}`);
      return true;
    } else {
      console.log(`❌ No price data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fetching price for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

// Function to test the analyst estimates endpoint
async function testAnalystEstimatesEndpoint(symbol) {
  try {
    console.log(`Testing analyst estimates endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/stable/analyst-estimates`, {
      params: {
        symbol: symbol,
        apikey: FMP_API_KEY,
        period: 'annual'
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Successfully fetched analyst estimates for ${symbol}`);
      // Display a sample of the data
      const estimate = response.data[0];
      console.log(`   - Estimated EPS: ${estimate.estimatedEps || 'N/A'}`);
      console.log(`   - Estimated Revenue: ${estimate.estimatedRevenueAvg || 'N/A'}`);
      return true;
    } else {
      console.log(`❌ No analyst estimates returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fetching analyst estimates for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

// Function to test the historical price data endpoint
async function testHistoricalPriceEndpoint(symbol) {
  try {
    console.log(`Testing historical price endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full`, {
      params: {
        symbol: symbol,
        apikey: FMP_API_KEY,
        limit: 10
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Successfully fetched historical prices for ${symbol}`);
      console.log(`   - Found ${response.data.length} data points`);
      console.log(`   - Latest date: ${response.data[0].date}, price: $${response.data[0].close}`);
      return true;
    } else {
      console.log(`❌ No historical price data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fetching historical prices for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    return false;
  }
}

// Function to test the technical indicators endpoint
async function testTechnicalIndicatorsEndpoint(symbol) {
  try {
    console.log(`Testing technical indicators (RSI) endpoint for ${symbol}...`);
    const response = await axios.get(`https://financialmodelingprep.com/technical-indicators/rsi`, {
      params: {
        symbol: symbol,
        apikey: FMP_API_KEY,
        period: 14,
        timeseries: 1
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Successfully fetched RSI for ${symbol}`);
      console.log(`   - RSI: ${response.data[0].rsi}`);
      return true;
    } else {
      console.log(`❌ No RSI data returned for ${symbol}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fetching RSI for ${symbol}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    
    // Try alternative endpoint format if the first one fails
    try {
      console.log(`Trying alternative technical indicator endpoint for ${symbol}...`);
      const altResponse = await axios.get(`https://financialmodelingprep.com/api/v3/technical_indicator/daily/${symbol}`, {
        params: {
          apikey: FMP_API_KEY,
          period: 14,
          type: 'rsi',
          limit: 1
        }
      });
      
      if (altResponse.data && Array.isArray(altResponse.data) && altResponse.data.length > 0) {
        console.log(`✅ Successfully fetched RSI for ${symbol} using alternative endpoint`);
        console.log(`   - RSI: ${altResponse.data[0].rsi}`);
        return true;
      } else {
        console.log(`❌ No RSI data returned for ${symbol} from alternative endpoint`);
        return false;
      }
    } catch (altError) {
      console.error(`❌ Alternative endpoint also failed for ${symbol}:`, altError.message);
      return false;
    }
  }
}

// Run all tests
async function runTests() {
  console.log('===== FMP API ENDPOINT TESTS =====');
  console.log(`Using API key: ${FMP_API_KEY}`);
  
  console.log('\n----- TESTING PRICE ENDPOINT -----');
  for (const symbol of symbols) {
    await testPriceEndpoint(symbol);
  }
  
  console.log('\n----- TESTING ANALYST ESTIMATES ENDPOINT -----');
  for (const symbol of symbols) {
    await testAnalystEstimatesEndpoint(symbol);
  }
  
  console.log('\n----- TESTING HISTORICAL PRICE ENDPOINT -----');
  for (const symbol of symbols) {
    await testHistoricalPriceEndpoint(symbol);
  }
  
  console.log('\n----- TESTING TECHNICAL INDICATORS ENDPOINT -----');
  for (const symbol of symbols) {
    await testTechnicalIndicatorsEndpoint(symbol);
  }
  
  console.log('\n===== TESTS COMPLETED =====');
}

// Run the tests
runTests(); 