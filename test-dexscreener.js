const axios = require('axios').default;

async function testDexScreenerWithAddress() {
  try {
    const address = '7DLNQRAsYWDfqgCxG55kRLKnTWjvZpP7z783sJ3Ypump';
    console.log(`Testing DexScreener with address: ${address}`);
    
    const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
      params: {
        q: address
      }
    });
    
    if (response.data && 
        response.data.pairs && 
        Array.isArray(response.data.pairs) && 
        response.data.pairs.length > 0) {
      
      console.log(`Found ${response.data.pairs.length} liquidity pairs on DexScreener`);
      console.log('First pair data:', JSON.stringify(response.data.pairs[0], null, 2));
      
      // Find the pair with the highest liquidity
      let bestPair = response.data.pairs[0];
      
      if (response.data.pairs.length > 1) {
        bestPair = response.data.pairs.reduce((best, current) => {
          const bestLiquidity = best.liquidity?.usd || 0;
          const currentLiquidity = current.liquidity?.usd || 0;
          return currentLiquidity > bestLiquidity ? current : best;
        }, response.data.pairs[0]);
      }
      
      console.log('Best liquidity pair:', JSON.stringify(bestPair, null, 2));
      
      // Create asset object from DexScreener data
      const tokenSymbol = bestPair.baseToken?.symbol || address;
      const tokenName = bestPair.baseToken?.name || address;
      
      const asset = {
        id: tokenSymbol,
        name: tokenName,
        symbol: tokenSymbol,
        type: 'crypto',
        source: 'dexscreener',
        priceUsd: bestPair.priceUsd,
        priceNative: bestPair.priceNative,
        volume24h: bestPair.volume?.h24 || 0,
        priceChange24h: bestPair.priceChange?.h24 || 0,
        liquidity: bestPair.liquidity?.usd || 0,
        marketCap: bestPair.fdv || bestPair.marketCap || 0,
        dexInfo: {
          dexId: bestPair.dexId,
          pairAddress: bestPair.pairAddress,
          chainId: bestPair.chainId,
          url: bestPair.url,
          quoteToken: bestPair.quoteToken,
          info: bestPair.info || {}
        }
      };
      
      console.log('Created asset from DexScreener:', JSON.stringify(asset, null, 2));
      console.log('DexScreener detection successful!');
    } else {
      console.log('No results found on DexScreener API for query:', address);
    }
  } catch (error) {
    console.error('Error testing DexScreener API:', error.message);
  }
}

// Run the test
testDexScreenerWithAddress(); 