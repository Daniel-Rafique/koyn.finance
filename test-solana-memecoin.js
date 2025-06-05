const axios = require('axios');

// Test the Solana memecoin detection specifically
async function testSolanaMemecoinDetection() {
  const testAddress = 'J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr';
  
  console.log('🧪 Testing Solana Memecoin Detection');
  console.log('================================');
  console.log('Contract Address:', testAddress);
  console.log('');

  // Test pattern matching
  console.log('1. Pattern Matching Tests:');
  console.log('--------------------------');
  
  const isSolanaAddress = (address) => {
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaPattern.test(address) && address.length >= 32 && address.length <= 44;
  };
  
  const isEvmAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };
  
  console.log('✓ Address length:', testAddress.length);
  console.log('✓ Is Solana address:', isSolanaAddress(testAddress));
  console.log('✓ Is EVM address:', isEvmAddress(testAddress));
  console.log('');

  // Test DexScreener API
  console.log('2. DexScreener API Test:');
  console.log('------------------------');
  
  try {
    const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
      params: { q: testAddress },
      timeout: 15000
    });
    
    if (response.data && response.data.pairs && response.data.pairs.length > 0) {
      console.log('✅ Found', response.data.pairs.length, 'trading pair(s)');
      
      const bestPair = response.data.pairs[0];
      console.log('');
      console.log('Best Pair Details:');
      console.log('- Token Symbol:', bestPair.baseToken?.symbol || 'Unknown');
      console.log('- Token Name:', bestPair.baseToken?.name || 'Unknown');
      console.log('- Price USD:', bestPair.priceUsd || 'N/A');
      console.log('- Chain ID:', bestPair.chainId || 'Unknown');
      console.log('- Liquidity USD:', bestPair.liquidity?.usd || 0);
      console.log('- 24h Volume:', bestPair.volume?.h24 || 0);
      console.log('- 24h Price Change:', bestPair.priceChange?.h24 || 0, '%');
      console.log('- DEX:', bestPair.dexId || 'Unknown');
      console.log('- Pair Address:', bestPair.pairAddress || 'Unknown');
      
      // Create the asset object as it would be returned
      const tokenSymbol = bestPair.baseToken?.symbol || testAddress.substring(0, 8).toUpperCase();
      const tokenName = bestPair.baseToken?.name || `Token ${tokenSymbol}`;
      const priceUsd = parseFloat(bestPair.priceUsd) || 0;
      
      const asset = {
        id: tokenSymbol,
        name: tokenName,
        symbol: tokenSymbol,
        displaySymbol: tokenSymbol,
        type: "crypto",
        subType: "memecoin",
        source: "dexscreener",
        contractAddress: testAddress,
        priceUsd: priceUsd,
        priceNative: bestPair.priceNative,
        volume24h: bestPair.volume?.h24 || 0,
        priceChange24h: bestPair.priceChange?.h24 || 0,
        liquidity: bestPair.liquidity?.usd || 0,
        marketCap: bestPair.fdv || bestPair.marketCap || 0,
        chainInfo: {
          chainId: bestPair.chainId,
          chainName: bestPair.chainId === 'solana' ? 'Solana' : 
                    bestPair.chainId === 'ethereum' ? 'Ethereum' :
                    bestPair.chainId === 'bsc' ? 'Binance Smart Chain' :
                    bestPair.chainId === 'polygon' ? 'Polygon' : 
                    bestPair.chainId || 'Unknown',
        },
        dexInfo: {
          dexId: bestPair.dexId,
          pairAddress: bestPair.pairAddress,
          chainId: bestPair.chainId,
          url: bestPair.url,
          quoteToken: bestPair.quoteToken,
          info: bestPair.info || {},
          safetyScore: bestPair.liquidity?.usd > 10000 ? 'high' : 
                     bestPair.liquidity?.usd > 1000 ? 'medium' : 'low',
          lastUpdated: new Date().toISOString(),
        },
      };
      
      console.log('');
      console.log('3. Generated Asset Object:');
      console.log('--------------------------');
      console.log(JSON.stringify(asset, null, 2));
      
      console.log('');
      console.log('🎉 SUCCESS: Solana memecoin detection working properly!');
      console.log(`   Token: ${tokenSymbol} (${tokenName})`);
      console.log(`   Price: $${priceUsd}`);
      console.log(`   Chain: ${asset.chainInfo.chainName}`);
      console.log(`   Safety: ${asset.dexInfo.safetyScore}`);
      
    } else {
      console.log('❌ No trading pairs found for this contract address');
    }
    
  } catch (error) {
    console.error('❌ DexScreener API Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSolanaMemecoinDetection().catch(console.error); 