// Test script for enhanced financial data API endpoints
require('dotenv').config();
const axios = require('axios');

// Configuration
const API_KEY = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
const SYMBOL = 'AAPL'; // Test with Apple

// Test the analyst estimates endpoint
async function testAnalystEstimates() {
  try {
    console.log('Testing analyst estimates endpoint...');
    const response = await axios.get(`https://financialmodelingprep.com/stable/analyst-estimates`, {
      params: {
        symbol: SYMBOL,
        apikey: API_KEY,
        period: 'annual' // Required parameter
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Analyst estimates endpoint works with period parameter');
      console.log(`Retrieved ${response.data.length} estimates for ${SYMBOL}`);
      console.log('First estimate data:', response.data[0]);
      return true;
    } else {
      console.log('❌ No analyst estimates returned');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing analyst estimates endpoint:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test the technical indicators (RSI) endpoint with the v3 API
async function testTechnicalIndicatorsRSI() {
  try {
    console.log('Testing technical indicators (RSI) with v3 endpoint...');
    const response = await axios.get(`https://financialmodelingprep.com/api/v3/technical_indicator/daily/${SYMBOL}`, {
      params: {
        apikey: API_KEY,
        period: 14,
        type: 'rsi',
        limit: 1
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Technical indicators RSI v3 endpoint works');
      console.log(`RSI value: ${response.data[0].rsi}`);
      return true;
    } else {
      console.log('❌ No RSI data returned');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing RSI endpoint:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test all available technical indicators to find which ones work
async function testAllTechnicalIndicators() {
  const indicators = [
    { name: 'RSI', type: 'rsi', params: { period: 14 } },
    { name: 'MACD', type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
    { name: 'SMA', type: 'sma', params: { period: 20 } },
    { name: 'EMA', type: 'ema', params: { period: 20 } },
    { name: 'WMA', type: 'wma', params: { period: 20 } },
    { name: 'BBANDS', type: 'bbands', params: { period: 20, stdDev: 2 } },
    { name: 'STOCH', type: 'stoch', params: { fastKPeriod: 14, slowKPeriod: 3, slowDPeriod: 3 } }
  ];

  console.log('Testing all technical indicators...');
  
  const results = {};
  
  for (const indicator of indicators) {
    try {
      console.log(`Testing ${indicator.name}...`);
      const params = {
        apikey: API_KEY,
        type: indicator.type,
        limit: 1,
        ...indicator.params
      };
      
      const response = await axios.get(
        `https://financialmodelingprep.com/api/v3/technical_indicator/daily/${SYMBOL}`,
        { params }
      );

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ ${indicator.name} works`);
        results[indicator.name] = { success: true, data: response.data[0] };
      } else {
        console.log(`❌ No ${indicator.name} data returned`);
        results[indicator.name] = { success: false };
      }
    } catch (error) {
      console.error(`❌ Error testing ${indicator.name}:`, error.message);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
      }
      results[indicator.name] = { success: false, error: error.message };
    }
  }
  
  console.log('\nSummary of Technical Indicators:');
  Object.entries(results).forEach(([name, result]) => {
    console.log(`${name}: ${result.success ? '✅ Works' : '❌ Failed'}`);
    if (result.success) {
      console.log('  Sample data:', JSON.stringify(result.data).substring(0, 80) + '...');
    }
  });
  
  return results;
}

// Run all tests
async function runTests() {
  console.log('==========================================================');
  console.log('TESTING ENHANCED FINANCIAL DATA ENDPOINTS');
  console.log(`API Key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`Test Symbol: ${SYMBOL}`);
  console.log('==========================================================');

  // Test analyst estimates
  console.log('\n=== TEST 1: ANALYST ESTIMATES ===');
  await testAnalystEstimates();

  // Test RSI indicator
  console.log('\n=== TEST 2: RSI TECHNICAL INDICATOR ===');
  await testTechnicalIndicatorsRSI();

  // Test all technical indicators
  console.log('\n=== TEST 3: ALL TECHNICAL INDICATORS ===');
  await testAllTechnicalIndicators();

  console.log('\n==========================================================');
  console.log('TESTING COMPLETE');
  console.log('==========================================================');
}

// Run the tests
runTests(); 