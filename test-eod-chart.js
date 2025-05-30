// Very simple test script for the EOD chart endpoint
require('dotenv').config();
const axios = require('axios');

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}`;

// Test the endpoint directly with minimal code
async function testEodEndpoint() {
  console.log('Simple EOD endpoint test');
  
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

// This is a test script to verify the EOD data endpoint works correctly
const https = require('https');

// Replace with your actual API key
const API_KEY = process.env.FMP_API_KEY || 'demo';

// Example symbols to test
const symbols = ['AAPL', 'BTCUSD', '^GSPC'];

symbols.forEach(symbol => {
  console.log(`Fetching EOD data for ${symbol}...`);
  
  // Format the path for FMP's EOD endpoint
  const path = `/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${API_KEY}`;
  
  const options = {
    hostname: 'financialmodelingprep.com',
    port: 443,
    path,
    method: 'GET'
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        
        if (jsonData.historical && Array.isArray(jsonData.historical)) {
          console.log(`✅ Successfully retrieved ${jsonData.historical.length} days of EOD data for ${symbol}`);
          
          // Print the most recent data point for verification
          if (jsonData.historical.length > 0) {
            console.log('Most recent data point:');
            console.log(JSON.stringify(jsonData.historical[0], null, 2));
          }
        } else {
          console.error(`❌ Invalid response format for ${symbol}:`, jsonData);
        }
      } catch (error) {
        console.error(`❌ Error parsing response for ${symbol}:`, error);
        console.log('Raw response:', data);
      }
      
      console.log('-----------------------------------');
    });
  });
  
  req.on('error', (error) => {
    console.error(`❌ Request error for ${symbol}:`, error);
  });
  
  req.end();
});

// Example of how the EOD endpoint should be implemented on the server
/*
// Example Express route implementation for the server
app.get('/api/chart/eod', async (req, res) => {
  try {
    const { symbol, contractAddress, dex } = req.query;
    
    // Determine which symbol to use
    let targetSymbol;
    if (contractAddress) {
      // Handle contract address lookup
      // ...
    } else if (dex) {
      // Handle DEX token lookup
      // ...
    } else {
      targetSymbol = symbol;
    }
    
    // Format symbol properly (add USD for crypto if needed)
    if (isCryptoSymbol(targetSymbol) && !targetSymbol.endsWith('USD')) {
      targetSymbol = `${targetSymbol}USD`;
    }
    
    // Make request to Financial Modeling Prep
    const fmpResponse = await fetch(
      `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(targetSymbol)}?apikey=${process.env.FMP_API_KEY}`
    );
    
    if (!fmpResponse.ok) {
      throw new Error(`FMP API error: ${fmpResponse.status}`);
    }
    
    const fmpData = await fmpResponse.json();
    
    // Transform data for our frontend
    if (fmpData.historical && Array.isArray(fmpData.historical)) {
      // Return in our expected format
      res.json({
        symbol: targetSymbol,
        format: 'eod',  // Mark this as EOD format
        data: fmpData.historical,
      });
    } else {
      throw new Error('Invalid data format from FMP');
    }
  } catch (error) {
    console.error('Error fetching EOD data:', error);
    res.status(500).json({ error: error.message });
  }
});
*/ 