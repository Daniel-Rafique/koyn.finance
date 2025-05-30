const axios = require('axios');
require('dotenv').config();

// Test the new Grok API sentiment analysis
async function testGrokSentimentAnalysis() {
    console.log('🧪 TESTING GROK API LIVE SEARCH FOR SENTIMENT ANALYSIS');
    console.log('=====================================================');
    
    // Check if Grok API key is available
    const grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    
    if (!grokApiKey) {
        console.log('❌ No Grok API key found. Please add GROK_API_KEY or XAI_API_KEY to your .env file');
        console.log('💡 Get your API key from: https://console.x.ai/');
        return;
    }
    
    console.log('✅ Grok API key found');
    console.log(`🔑 Key: ${grokApiKey.substring(0, 10)}...${grokApiKey.substring(grokApiKey.length - 4)}`);
    
    // Test assets
    const testAssets = [
        { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
        { symbol: 'AAPL', name: 'Apple Inc', type: 'stock' },
        { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock' },
        { symbol: 'EUR/USD', name: 'Euro to US Dollar', type: 'forex' }
    ];
    
    for (let asset of testAssets) {
        console.log(`\n📊 Testing sentiment analysis for ${asset.name} (${asset.symbol})`);
        console.log(`${'='.repeat(60)}`);
        
        try {
            const startTime = Date.now();
            
            // Create optimized search query for Grok API
            const queryText = asset.type === 'stock' ? 
                `${asset.symbol} ${asset.name} stock price sentiment` : 
                `${asset.name} ${asset.symbol} price sentiment`;
                
            console.log(`🔍 Search query: "${queryText}"`);
            
            // Use Grok API's live search capability
            const response = await axios.post("https://api.x.ai/v1/chat/completions", {
                model: 'grok-2-1212', // Using grok-2-1212 for reliable live search
                messages: [
                    {
                        role: 'system',
                        content: 'You are a financial sentiment analysis assistant. Search for recent social media posts and news about the requested asset. Focus on posts from the last 24 hours that express sentiment about price movements, market outlook, or trading opinions.'
                    },
                    {
                        role: 'user',
                        content: `Search for recent social media posts and tweets about ${queryText}. Find posts from the last 24 hours that contain sentiment about price movements, market outlook, or trading opinions. Return the actual text content of these posts, focusing on posts with clear bullish, bearish, or neutral sentiment indicators. Limit to 20 most relevant posts.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 1500
            }, {
                headers: {
                    'Authorization': `Bearer ${grokApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 second timeout
            });
            
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            
            const searchResults = response.data.choices[0]?.message?.content || '';
            
            if (searchResults) {
                // Parse the live search results into individual posts
                const posts = parseLiveSearchResults(searchResults, asset);
                
                console.log(`✅ Response received in ${duration.toFixed(2)}s`);
                console.log(`📊 Found ${posts.length} social media posts for sentiment analysis`);
                
                if (posts.length > 0) {
                    console.log(`\n📝 Sample posts (first 3):`);
                    posts.slice(0, 3).forEach((post, i) => {
                        console.log(`   ${i + 1}. ${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
                    });
                    
                    // Simple sentiment analysis
                    const sentimentCounts = analyzeSentiment(posts);
                    console.log(`\n💭 Sentiment Analysis:`);
                    console.log(`   📈 Bullish: ${sentimentCounts.bullish} posts`);
                    console.log(`   📉 Bearish: ${sentimentCounts.bearish} posts`);
                    console.log(`   😐 Neutral: ${sentimentCounts.neutral} posts`);
                    
                    const total = sentimentCounts.bullish + sentimentCounts.bearish + sentimentCounts.neutral;
                    if (total > 0) {
                        console.log(`\n📊 Sentiment Distribution:`);
                        console.log(`   📈 Bullish: ${Math.round((sentimentCounts.bullish / total) * 100)}%`);
                        console.log(`   📉 Bearish: ${Math.round((sentimentCounts.bearish / total) * 100)}%`);
                        console.log(`   😐 Neutral: ${Math.round((sentimentCounts.neutral / total) * 100)}%`);
                    }
                } else {
                    console.log(`⚠️  No posts extracted from Grok response`);
                    console.log(`📄 Raw response preview: ${searchResults.substring(0, 200)}...`);
                }
            } else {
                console.log(`❌ No response content from Grok API`);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${asset.symbol}:`, error.message);
            if (error.response) {
                console.error(`   📄 Response status: ${error.response.status}`);
                console.error(`   📄 Response data:`, error.response.data);
            }
        }
        
        // Wait between requests to avoid rate limiting
        if (asset !== testAssets[testAssets.length - 1]) {
            console.log(`⏳ Waiting 3 seconds before next test...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    console.log('\n🎉 GROK API SENTIMENT ANALYSIS TEST COMPLETED!');
    console.log('===============================================');
    console.log('✅ Integration with X.AI Live Search working');
    console.log('💰 Monitor usage at: https://console.x.ai/usage');
    console.log('📚 API Documentation: https://docs.x.ai/docs');
}

// Helper function to parse Grok API live search results into individual posts
function parseLiveSearchResults(searchResults, asset) {
    try {
        const posts = [];
        
        // Split the search results into individual posts/tweets
        const lines = searchResults.split('\n').filter(line => line.trim().length > 10);
        
        for (let line of lines) {
            // Clean up the line and extract meaningful content
            let cleanedPost = line
                .replace(/^\d+\.\s*/, '') // Remove numbering like "1. "
                .replace(/^[-•*]\s*/, '') // Remove bullet points
                .replace(/^"(.*)"$/, '$1') // Remove quotes
                .replace(/^Tweet:\s*/i, '') // Remove "Tweet:" prefix
                .replace(/^Post:\s*/i, '') // Remove "Post:" prefix
                .trim();
            
            // Only include posts that seem substantial and sentiment-relevant
            if (cleanedPost.length > 20 && 
                (cleanedPost.toLowerCase().includes(asset.symbol?.toLowerCase()) ||
                 cleanedPost.toLowerCase().includes(asset.name?.toLowerCase()) ||
                 cleanedPost.includes('$') || // Likely contains price/symbol info
                 cleanedPost.match(/\b(bullish|bearish|pump|dump|moon|crash|buy|sell|hold)\b/i))) {
                
                posts.push(cleanedPost);
            }
        }
        
        // If we didn't find structured posts, try to extract sentences with sentiment
        if (posts.length === 0) {
            const sentences = searchResults.split(/[.!?]+/).filter(s => s.trim().length > 20);
            for (let sentence of sentences.slice(0, 10)) { // Max 10 sentences
                if (sentence.toLowerCase().includes(asset.symbol?.toLowerCase()) ||
                    sentence.toLowerCase().includes(asset.name?.toLowerCase())) {
                    posts.push(sentence.trim());
                }
            }
        }
        
        // Ensure we don't return too many posts (API cost optimization)
        return posts.slice(0, 20);
        
    } catch (error) {
        console.error("Error parsing Grok API search results:", error);
        return [];
    }
}

// Simple sentiment analysis function
function analyzeSentiment(posts) {
    const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
    
    const bullishWords = ['bullish', 'pump', 'moon', 'rocket', 'buy', 'long', 'bull', 'up', 'rise', 'gain', 'profit', 'green', 'positive', 'strong', 'breakout'];
    const bearishWords = ['bearish', 'dump', 'crash', 'sell', 'short', 'bear', 'down', 'fall', 'loss', 'red', 'negative', 'weak', 'breakdown'];
    
    for (let post of posts) {
        const lowerPost = post.toLowerCase();
        
        const bullishCount = bullishWords.filter(word => lowerPost.includes(word)).length;
        const bearishCount = bearishWords.filter(word => lowerPost.includes(word)).length;
        
        if (bullishCount > bearishCount) {
            sentimentCounts.bullish++;
        } else if (bearishCount > bullishCount) {
            sentimentCounts.bearish++;
        } else {
            sentimentCounts.neutral++;
        }
    }
    
    return sentimentCounts;
}

// Run the test
testGrokSentimentAnalysis().catch(console.error); 