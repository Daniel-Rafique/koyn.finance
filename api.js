require('dotenv').config();
const express = require('express');
const axios = require('axios');
// Replaced OpenAI with Gemini for cost optimization and better financial analysis
// const { OpenAI } = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const http = require('http');
const crypto = require('crypto');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// JWT configuration for secure authentication
const JWT_SECRET = process.env.JWT_SECRET || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2';

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set in environment. Using fixed development secret.');
  console.warn('⚠️  For production, set JWT_SECRET environment variable.');
}

// Initialize Redis client
let redisClient;
try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    retryStrategy: (times) => {
      return Math.min(times * 50, 2000);
    }
  });
  
  redisClient.on('connect', () => {
    console.log('Connected to Redis successfully');
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
    console.log('Falling back to non-cached operations');
    redisClient = null;
  });
} catch (error) {
  console.error('Failed to initialize Redis client:', error);
  redisClient = null;
}

// JWT Authentication Functions
function verifyAccessToken(token) {
  try {
    console.log('🔐 Verifying JWT token...');
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'koyn.finance',
      audience: 'koyn.finance-users'
    });
    console.log('✅ JWT token verified successfully:', { email: decoded.email, subscriptionId: decoded.subscriptionId, plan: decoded.plan });
    return decoded;
  } catch (error) {
    console.error('❌ JWT verification failed:', error.message);
    return null;
  }
}

// Middleware to extract subscription ID from JWT token or fallback to query param
function getSubscriptionId(req) {
  console.log('🔍 Getting subscription ID from request...');
  
  // First try to get from Authorization header (JWT token)
  const authHeader = req.headers['authorization'];
  console.log('📋 Authorization header:', authHeader ? 'Present' : 'Missing');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    console.log('🎫 Extracted JWT token (first 20 chars):', token.substring(0, 20) + '...');
    
    const decoded = verifyAccessToken(token);
    
    if (decoded) {
      // Check if token already has subscriptionId (new format)
      if (decoded.subscriptionId) {
        console.log(`✅ Using JWT subscriptionId: ${decoded.subscriptionId}`);
      return decoded.subscriptionId;
      }
      
      // Handle legacy token format - look up subscription ID by email
      const email = decoded.email; // Use only the correct email field
      if (email) {
        console.log(`🔄 JWT token missing subscriptionId, looking up by email: ${email}`);
        
        try {
          const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
          if (fs.existsSync(subscriptionsFilePath)) {
            const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
            const subscriptions = JSON.parse(data);
            
            const subscription = subscriptions.find(sub => 
              sub.email.toLowerCase() === email.toLowerCase() && sub.status === 'active'
            );
            
            if (subscription) {
              console.log(`✅ Found subscription ID ${subscription.id} for email ${email}`);
              return subscription.id;
            } else {
              console.log(`❌ No active subscription found for email ${email}`);
            }
          }
        } catch (error) {
          console.error('❌ Error looking up subscription by email:', error);
        }
      } else {
        console.log('❌ JWT token missing email field');
      }
    }
  }
  
  // Fallback to query parameter for backward compatibility (legacy)
  const legacyId = req.query.id;
  if (legacyId) {
    console.warn(`⚠️  Using legacy subscription ID authentication: ${legacyId}`);
    return legacyId;
  }
  
  console.log('❌ No subscription ID found in request');
  return null;
}

// Rate limiting configuration and functions
const RATE_LIMITS = {
    free: process.env.FREE,        // 1 requests per day for free/trial users
    monthly: process.env.MONTHLY,    // 10 requests per day for monthly subscribers
    quarterly: process.env.QUARTERLY,  // 30 requests per day for quarterly subscribers  
    yearly: process.env.YEARLY,    // 100 requests per day for yearly subscribers
    unlimited: -1    // -1 means unlimited (for special accounts)
  };
  
  // Usage tracking file
  const USAGE_FILE = path.join(__dirname, 'data', 'api-usage.json');
  
  // Initialize usage file if it doesn't exist
  if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify({}, null, 2));
  }
  
  // Helper function to get current date string (YYYY-MM-DD)
  function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
  }
  
  // Helper function to read usage data
  function readUsageData() {
    try {
      const data = fs.readFileSync(USAGE_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading usage file:', err);
      return {};
    }
  }
  
  // Helper function to write usage data
  function writeUsageData(usageData) {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(usageData, null, 2));
    } catch (err) {
      console.error('Error writing usage file:', err);
    }
  }
  
  // Helper function to get subscription plan from subscriptions.json
  function getSubscriptionPlan(subscriptionId) {
    try {
      const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
      if (!fs.existsSync(subscriptionsFilePath)) {
        return 'free'; // Default to free if no subscriptions file
      }
      
      const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
      const subscriptions = JSON.parse(data);
      
      const subscription = subscriptions.find(sub => sub.id === subscriptionId);
      
      if (!subscription) {
        console.log(`No subscription found for ID: ${subscriptionId}, defaulting to free plan`);
        return 'free';
      }
      
      // Check if subscription is active
      if (subscription.status !== 'active') {
        console.log(`Subscription ${subscriptionId} is not active (status: ${subscription.status}), defaulting to free plan`);
        return 'free';
      }
      
      // Check if subscription has expired
      if (subscription.renewalDate) {
        const renewalDate = new Date(subscription.renewalDate);
        const now = new Date();
        if (renewalDate <= now) {
          console.log(`Subscription ${subscriptionId} has expired (renewal: ${renewalDate}), defaulting to free plan`);
          return 'free';
        }
      }
      
      return subscription.plan || 'free';
    } catch (err) {
      console.error('Error getting subscription plan:', err);
      return 'free'; // Default to free on error
    }
  }
  
  // Helper function to get rate limit for a subscription
  function getRateLimit(subscriptionId) {
    const plan = getSubscriptionPlan(subscriptionId);
    const limit = RATE_LIMITS[plan];
    
    if (limit === undefined) {
      console.warn(`Unknown plan type: ${plan}, defaulting to free plan limits`);
      return RATE_LIMITS.free;
    }
    
    return limit;
  }
  
  // Helper function to check if user has exceeded rate limit
  function checkRateLimit(subscriptionId) {
    const currentDate = getCurrentDateString();
    const usageData = readUsageData();
    
    // Get user's current usage for today
    const userUsage = usageData[subscriptionId];
    const todayUsage = (userUsage && userUsage.date === currentDate) ? userUsage.count : 0;
    
    // Get user's rate limit
    const rateLimit = getRateLimit(subscriptionId);
    
    // -1 means unlimited
    if (rateLimit === -1) {
      return { allowed: true, usage: todayUsage, limit: 'unlimited', plan: getSubscriptionPlan(subscriptionId) };
    }
    
    // Check if under limit
    const allowed = todayUsage < rateLimit;
    
    return {
      allowed,
      usage: todayUsage,
      limit: rateLimit,
      plan: getSubscriptionPlan(subscriptionId),
      remaining: Math.max(0, rateLimit - todayUsage)
    };
  }
  
  // Helper function to increment usage counter
  function incrementUsage(subscriptionId) {
    const currentDate = getCurrentDateString();
    const usageData = readUsageData();
    
    // Initialize or update user usage
    if (!usageData[subscriptionId] || usageData[subscriptionId].date !== currentDate) {
      // New day or new user
      usageData[subscriptionId] = {
        date: currentDate,
        count: 1
      };
    } else {
      // Same day, increment count
      usageData[subscriptionId].count += 1;
    }
    
    writeUsageData(usageData);
    
    return usageData[subscriptionId].count;
  }
  
  // Helper function to clean up old usage data (optional - run daily)
  function cleanupOldUsageData() {
    const usageData = readUsageData();
    const currentDate = getCurrentDateString();
    let cleaned = false;
    
    // Remove usage data older than 7 days
    Object.keys(usageData).forEach(subscriptionId => {
      const userData = usageData[subscriptionId];
      if (userData.date !== currentDate) {
        const dataDate = new Date(userData.date);
        const daysDiff = (new Date(currentDate) - dataDate) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 7) {
          delete usageData[subscriptionId];
          cleaned = true;
        }
      }
    });
    
    if (cleaned) {
      writeUsageData(usageData);
      console.log('Cleaned up old usage data');
    }
  }
  
  // Rate limiting middleware function
  function rateLimitMiddleware(req, res, next) {
    const subscriptionId = getSubscriptionId(req);
    
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required. Please provide a valid JWT token in the Authorization header or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access this feature"
      });
    }
    
    // Check rate limit
    const rateLimitCheck = checkRateLimit(subscriptionId);
    
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for subscription ${subscriptionId}: ${rateLimitCheck.usage}/${rateLimitCheck.limit} (plan: ${rateLimitCheck.plan})`);
      
      return res.status(429).json({
        success: false,
        error: "Rate Limit Exceeded",
        message: `Daily API limit exceeded. You have used ${rateLimitCheck.usage}/${rateLimitCheck.limit} requests today.`,
        rate_limit_exceeded: true,
        usage: rateLimitCheck.usage,
        limit: rateLimitCheck.limit,
        plan: rateLimitCheck.plan,
        reset_time: "Daily limits reset at midnight UTC",
        action: "Please upgrade your plan for higher limits or wait for the daily reset"
      });
    }
    
    // Check if subscription is actually active
    const isActive = isSubscriptionActive(subscriptionId);
    if (!isActive) {
      console.log(`Inactive subscription attempted API access: ${subscriptionId}`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access this feature"
      });
    }
    
    // Increment usage counter
    const newUsageCount = incrementUsage(subscriptionId);
    
    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': rateLimitCheck.limit,
      'X-RateLimit-Remaining': Math.max(0, rateLimitCheck.limit - newUsageCount),
      'X-RateLimit-Used': newUsageCount,
      'X-RateLimit-Plan': rateLimitCheck.plan,
      'X-RateLimit-Reset': 'Daily at midnight UTC'
    });
    
    console.log(`API access granted for subscription ${subscriptionId}: ${newUsageCount}/${rateLimitCheck.limit} (plan: ${rateLimitCheck.plan})`);
    
    // Proceed to the actual endpoint
    next();
  }
  
  // Clean up old usage data every hour
  setInterval(cleanupOldUsageData, 60 * 60 * 1000);
  
  // Helper function to check if a subscription ID is active

// Cache TTL in seconds for news only
// No longer caching asset data

// Function to get enhanced financial data from multiple FMP endpoints
const getEnhancedFinancialData = async (asset) => {
  try {
    // No longer using cache for asset data
    console.log(`Fetching fresh enhanced financial data for ${asset.symbol}`);
    
    // Prepare the base object to store all financial data
    const enhancedData = {
      financialRatios: null,
      keyMetrics: null,
      analystEstimates: null,
      stockPeers: null,
      priceTarget: null,
      ratings: null,
      price: null
    };
    
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    // Check if asset is a cryptocurrency and format symbol accordingly
    const isCrypto = isCryptoAsset(asset);
    const symbol = isCrypto ? getCryptoSymbol(asset.symbol) : asset.symbol;
    
    // Fetch data in parallel for efficiency
    const promises = [
      // 1. Financial Ratios
      axios.get(`https://financialmodelingprep.com/stable/ratios`, {
        params: {
          symbol: symbol,
          apikey: apiKey,
          limit: 1
        }
      }).then(response => {
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          enhancedData.financialRatios = response.data[0];
          console.log(`Got financial ratios for ${asset.symbol}`);
        }
      }).catch(error => console.error(`Error fetching financial ratios for ${asset.symbol}:`, error.message)),
      
      // 2. Key Metrics
      axios.get(`https://financialmodelingprep.com/stable/key-metrics`, {
        params: {
          symbol: symbol,
          apikey: apiKey,
          limit: 1
        }
      }).then(response => {
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          enhancedData.keyMetrics = response.data[0];
          console.log(`Got key metrics for ${asset.symbol}`);
        }
      }).catch(error => console.error(`Error fetching key metrics for ${asset.symbol}:`, error.message)),
    ];
    
    // 3. Analyst Estimates - Only for stocks, not for cryptocurrencies or commodities
    if (!isCrypto && asset.type && asset.type.toLowerCase() === 'stock') {
      promises.push(
        axios.get(`https://financialmodelingprep.com/stable/analyst-estimates`, {
          params: {
            symbol: symbol,
            period: 'annual',
            page: 0,
            limit: 10,
            apikey: apiKey
          }
        }).then(response => {
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            enhancedData.analystEstimates = response.data[0];
            console.log(`Got analyst estimates for ${asset.symbol}`);
          }
        }).catch(error => console.error(`Error fetching analyst estimates for ${asset.symbol}:`, error.message))
      );
    } else {
      console.log(`Skipping analyst estimates for non-stock asset ${asset.symbol} (${asset.type || 'unknown type'})`);
    }
    
    // 4. Stock Peers - Only for stocks, not for cryptocurrencies
    if (!isCrypto) {
      promises.push(
        axios.get(`https://financialmodelingprep.com/stable/stock-peers`, {
          params: {
            symbol: symbol,
            apikey: apiKey
          }
        }).then(response => {
          if (response.data && response.data.peersList) {
            enhancedData.stockPeers = response.data;
            console.log(`Got peer companies for ${asset.symbol}`);
          }
        }).catch(error => console.error(`Error fetching peer companies for ${asset.symbol}:`, error.message))
      );
    } else {
      console.log(`Skipping peer companies for cryptocurrency ${asset.symbol}`);
    }
    
    // 5. Price Target - Only for stocks, not for cryptocurrencies
    if (!isCrypto) {
      promises.push(
        axios.get(`https://financialmodelingprep.com/stable/price-target`, {
          params: {
            symbol: symbol,
            apikey: apiKey
          }
        }).then(response => {
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            enhancedData.priceTarget = response.data[0];
            console.log(`Got price target for ${asset.symbol}`);
          }
        }).catch(error => console.error(`Error fetching price target for ${asset.symbol}:`, error.message))
      );
    } else {
      console.log(`Skipping price target for cryptocurrency ${asset.symbol}`);
    }
    
    // 6. Rating (Stock Score) - Only for stocks, not for cryptocurrencies
    if (!isCrypto) {
      promises.push(
        axios.get(`https://financialmodelingprep.com/stable/ratings-snapshot`, {
          params: {
            symbol: symbol,
            apikey: apiKey
          }
        }).then(response => {
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            enhancedData.ratings = response.data[0];
            console.log(`Got ratings for ${asset.symbol}`);
          }
        }).catch(error => console.error(`Error fetching ratings for ${asset.symbol}:`, error.message))
      );
    } else {
      console.log(`Skipping ratings for cryptocurrency ${asset.symbol}`);
    }
    
    // Removed direct price lookup as it's unreliable for cryptocurrencies
    // We use specialized crypto quotes endpoint elsewhere
    
    // Wait for all API requests to complete (whether successful or not)
    await Promise.allSettled(promises);
    
    // No longer caching asset data
    return enhancedData;
  } catch (error) {
    console.error(`Error fetching enhanced financial data for ${asset.symbol}:`, error.message);
    return {
      financialRatios: null,
      keyMetrics: null,
      analystEstimates: null,
      stockPeers: null,
      priceTarget: null,
      ratings: null,
      price: null
    };
  }
};

// Enhanced rule-based sentiment analysis as a reliable approach
const simpleRuleBasedSentiment = (text) => {
    // Financial-specific word lists for positive and negative sentiment
    const positiveWords = [
        'good', 'great', 'excellent', 'positive', 'bull', 'bullish', 'up', 'rise', 'rising', 
        'growth', 'profit', 'gain', 'increase', 'increasing', 'outperform', 'buy', 'strong', 
        'opportunity', 'potential', 'upside', 'recovery', 'rebound', 'rally', 'boom', 'success',
        'successful', 'promising', 'improve', 'improving', 'improved', 'advantage', 'advantageous',
        'optimistic', 'optimism', 'confident', 'confidence', 'support', 'supported', 'supporting'
    ];
    
    const negativeWords = [
        'bad', 'poor', 'negative', 'bear', 'bearish', 'down', 'fall', 'falling', 'decline', 
        'declining', 'decrease', 'decreasing', 'loss', 'lose', 'losing', 'underperform', 'sell', 
        'weak', 'weakness', 'risk', 'risky', 'danger', 'dangerous', 'threat', 'threatened', 
        'threatening', 'struggle', 'struggling', 'struggled', 'concern', 'concerned', 'concerning',
        'worry', 'worried', 'worrying', 'pessimistic', 'pessimism', 'doubt', 'doubtful', 'skeptical',
        'skepticism', 'fear', 'fearful', 'recession', 'crash', 'crisis', 'problem', 'problematic'
    ];
    
    text = text.toLowerCase();
    
    // Count occurrences
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'g');
        const matches = text.match(regex);
        if (matches) positiveCount += matches.length;
    });
    
    negativeWords.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'g');
        const matches = text.match(regex);
        if (matches) negativeCount += matches.length;
    });
    
    // Check for negation words that flip sentiment
    const negationWords = ['not', 'no', "don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't", "shouldn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "never"];
    let negationCount = 0;
    
    negationWords.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'g');
        const matches = text.match(regex);
        if (matches) negationCount += matches.length;
    });
    
    // Adjust sentiment based on negation (simple approach)
    if (negationCount > 0) {
        // Swap positive and negative counts if there are an odd number of negations
        if (negationCount % 2 === 1) {
            const temp = positiveCount;
            positiveCount = negativeCount;
            negativeCount = temp;
        }
    }
    
    // Determine sentiment
    let sentiment;
    if (positiveCount > negativeCount) {
        sentiment = "Bullish";
    } else if (negativeCount > positiveCount) {
        sentiment = "Bearish";
    } else {
        sentiment = "Neutral";
    }
    
    // Calculate confidence (0.5-1.0 range)
    const total = positiveCount + negativeCount;
    const confidence = total > 0 
        ? 0.5 + (0.5 * Math.abs(positiveCount - negativeCount) / total)
        : 0.5;
    
    return {
        sentiment: sentiment,
        confidence: confidence,
        analysis: {
            bullish: positiveCount / (total || 1),
            neutral: 1 - (positiveCount + negativeCount) / (text.split(' ').length || 1),
            bearish: negativeCount / (total || 1)
        }
    };
};

// Simplified sentiment analysis function that uses rule-based approach
const analyzeSentiment = async (tweets, isPaidUser = false) => {
    // If no tweets are provided, return neutral sentiment
    if (!tweets || tweets.length === 0) {
        return {
            sentiment: "Neutral",
            confidence: 0.5,
            analysis: {
                bullish: 0.33,
                neutral: 0.34,
                bearish: 0.33
            },
            rawTweets: [] // Add empty rawTweets array for consistency
        };
    }
    
    // Store raw tweets for GPT-4o analysis
    const rawTweets = [...tweets];
    
    // Use rule-based analysis for preliminary sentiment
    console.log("Using rule-based sentiment analysis");
    const result = simpleRuleBasedSentiment(tweets.join(" "));
    console.log("Rule-based analysis result:", result.sentiment, "confidence:", result.confidence);
    
    return {
        ...result,
        rawTweets // Store raw tweets for GPT-4o analysis
    };
};

// No longer caching asset lists

// Gemini API configuration (replacing OpenAI)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("WARNING: GEMINI_API_KEY not found in environment variables");
  console.log("Please add GEMINI_API_KEY or GOOGLE_API_KEY to your .env file");
  console.log("Get your API key from: https://makersuite.google.com/app/apikey");
} else {
  console.log("GEMINI_API_KEY loaded successfully (length: " + GEMINI_API_KEY.length + ")");
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

// SSL configuration for HTTPS server
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

// No longer using sentiment cache

// Helper functions for text processing
function stripHtmlAndDecodeEntities(html) {
    if (!html) return '';
    
    // First decode HTML entities
    let decoded = html.replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&amp;/g, '&')
                     .replace(/&quot;/g, '"')
                     .replace(/&#39;/g, "'")
                     .replace(/\[\[CDATA\[(.*?)\]\]>/g, '$1');
    
    // Then strip HTML tags
    return decoded.replace(/<[^>]*>/g, '')
                 .replace(/\s+/g, ' ')
                 .trim();
}

function formatTweetContent(html) {
  if (!html) return '';
  
  // First decode HTML entities and CDATA sections
  let decoded = html
    .replace(/\[\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Remove any existing HTML tags first to prevent nested tags
  decoded = decoded.replace(/<[^>]+>/g, '');
  
  // Format URLs, ensuring they don't get double-wrapped
  decoded = decoded.replace(
    /(?<!["'])(https?:\/\/[^\s<]+)(?!["'])/g,
    (match) => {
      // Handle Twitter/X URLs specially
      if (match.match(/(https?:\/\/)(x\.com|twitter\.com)\//)) {
        const path = match.split('.com/')[1];
        return `<a href="https://koyn.finance/${path}" class="tweet-link" target="_blank" rel="noopener noreferrer">koyn.finance/${path}</a>`;
      }
      // Handle other URLs
      return `<a href="${match}" class="tweet-link" target="_blank" rel="noopener noreferrer">${match}</a>`;
    }
  );
  
  // Format hashtags - only match valid hashtag characters
  decoded = decoded.replace(
    /#([\w\u0590-\u05ff]+)/g,
    '<span class="hashtag">#$1</span>'
  );
  
  // Format mentions - only match valid username characters
  decoded = decoded.replace(
    /@([\w]+)/g,
    '<a href="https://koyn.finance/$1" class="mention" target="_blank" rel="noopener noreferrer">@$1</a>'
  );
  
  // Handle line breaks - normalize different types of line breaks first
  decoded = decoded
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br />');
  
  // Clean up any double spaces
  decoded = decoded.replace(/\s+/g, ' ').trim();
  
  return decoded;
}

// Helper function to extract hashtags
function extractHashtags(text) {
  if (!text) return [];
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? [...new Set(matches)] : []; // Remove duplicates
}

// Modify the getTwitterSentiment function to use Grok API Live Search with local fallback
const getTwitterSentiment = async (asset) => {
  try {
      // Check if Grok API key is available
      const grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      
      if (grokApiKey) {
          try {
              console.log(`Fetching fresh sentiment data for ${asset.name || asset.symbol} using Grok API Live Search`);
              
              // Create a optimized search query for Grok API
              const queryText = asset.type === 'stock' ? 
                  `${asset.symbol} ${asset.name} stock price sentiment` : 
                  `${asset.name} ${asset.symbol} price sentiment`;
                  
              console.log(`🔍 Using Grok API Live Search for: ${queryText}`);
              
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
                          content: `Search for recent social media posts and tweets about ${queryText}. Find posts from the last 24 hours that contain sentiment about price movements, market outlook, or trading opinions. Return the actual text content of these posts, focusing on posts with clear bullish, bearish, or neutral sentiment indicators. Limit to 50 most relevant posts.`
                      }
                  ],
                  temperature: 0.3,
                  max_tokens: 2000
              }, {
                  headers: {
                      'Authorization': `Bearer ${grokApiKey}`,
                      'Content-Type': 'application/json'
                  },
                  timeout: 10000 // 10 second timeout
              });
              
              const searchResults = response.data.choices[0]?.message?.content || '';
              
              if (searchResults) {
                  // Parse the live search results into individual posts
                  const posts = parseLiveSearchResults(searchResults, asset);
                  
                  console.log(`📊 Found ${posts.length} social media posts for sentiment analysis via Grok API`);
                  
                  // If we got good results from Grok, return them
                  if (posts.length > 0) {
                      return posts;
                  }
              }
              
              // If Grok didn't return good results, fall through to local fallback
              console.log(`⚠️  Grok API returned insufficient results, falling back to local search`);
              
          } catch (grokError) {
              console.error("Grok API failed, falling back to local search:", grokError.message);
          }
      } else {
          console.log(`ℹ️  No Grok API key found, using local search backend`);
      }
      
      // FALLBACK: Use local search backend
      console.log(`🔄 Falling back to local search backend for ${asset.name || asset.symbol}`);
      
      // Create a simpler query string for local backend
      const localQueryText = asset.type === 'stock' ? 
          `${asset.symbol} ${asset.name} stock` : 
          `${asset.name} ${asset.symbol}`;
          
      console.log(`🔍 Using local search for: ${localQueryText}`);
      
      // Use the local endpoint as fallback
      const localResponse = await axios.post("https://koyn.finance:3001/api/search", {
          query: localQueryText,
          limit: 50
      }, {
          timeout: 8000 // 8 second timeout for local search
      });
      
      if (localResponse.data && localResponse.data.data && localResponse.data.data.items && 
          Array.isArray(localResponse.data.data.items)) {
          const tweets = localResponse.data.data.items
              .map(item => `${item.title} ${item.description || ''}`.trim())
              .filter(text => text.length > 0);
              
          console.log(`📊 Found ${tweets.length} social media posts for sentiment analysis via local search`);
          
          return tweets;
      }
      
      // If both methods failed, return empty array
      console.log(`⚠️  Both Grok API and local search failed for ${asset.name || asset.symbol}`);
      return [];
      
  } catch (error) {
      console.error("Error in sentiment analysis (both Grok and local search failed):", error.message);
      
      // Final fallback to empty array
      return [];
  }
};
// Helper function to parse Grok API live search results into individual posts
const parseLiveSearchResults = (searchResults, asset) => {
    try {
        const posts = [];
        
        // Split the search results into individual posts/tweets
        // Look for common patterns that indicate separate posts
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
        return posts.slice(0, 30);
        
    } catch (error) {
        console.error("Error parsing Grok API search results:", error);
        return [];
    }
};

// Function to get financial news for the specified asset
const getFinancialNews = async (asset) => {
    try {
        // First, try to get cached news data
        const cacheKey = `news_data_${asset.symbol}_${asset.type || 'default'}`;
        const cachedNews = await getCachedData(cacheKey);
        
        // If we have cached news and it's not too old, use it
        // Different volatility-based TTLs for different asset types
        const newsMaxAge = getNewsMaxAgeByAssetType(asset.type);
        
        if (cachedNews) {
            // Check if the timestamp is recent enough based on the asset type
            const cachedTimestamp = cachedNews.timestamp || 0;
            const currentTime = Date.now();
            const ageInSeconds = (currentTime - cachedTimestamp) / 1000;
            
            // If the cache is fresh enough, use it
            if (ageInSeconds < newsMaxAge) {
                console.log(`Using cached news for ${asset.name || asset.symbol} (${ageInSeconds.toFixed(0)}s old, max age: ${newsMaxAge}s)`);
                // Return the cached news data with the age info
                return cachedNews.news.map(item => ({
                    ...item,
                    cached: true,
                    cacheAge: Math.floor(ageInSeconds)
                }));
            } else {
                console.log(`Cached news for ${asset.name || asset.symbol} is stale (${ageInSeconds.toFixed(0)}s old, max age: ${newsMaxAge}s), fetching fresh data`);
            }
        } else {
            console.log(`No cached news found for ${asset.name || asset.symbol}, fetching fresh data`);
        }
        
        // Get FMP API key
        const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
        
        // Define fallback mechanism with exponential backoff
        const maxRetries = 2;
        let retryCount = 0;
        let retryDelay = 500; // Start with 500ms delay
        
        // Try fetching with retries and exponential backoff
        while (retryCount <= maxRetries) {
            try {
                let endpoint = '';
                let params = { apikey: apiKey };
                
                // Select appropriate FMP endpoint based on asset type
                if (asset.type && asset.type.toLowerCase().includes('crypto')) {
                    // Use crypto news endpoint
                    endpoint = 'https://financialmodelingprep.com/stable/news/crypto-latest';
                    params.page = 0;
                    params.limit = 10;
                    console.log(`Using crypto news endpoint for ${asset.symbol}`);
                } else if (asset.type && asset.type.toLowerCase().includes('forex') || asset.type === 'fx') {
                    // Use forex news endpoint
                    endpoint = 'https://financialmodelingprep.com/stable/news/forex-latest';
                    params.page = 0;
                    params.limit = 10;
                    console.log(`Using forex news endpoint for ${asset.symbol}`);
                } else if (asset.type && asset.type.toLowerCase().includes('stock')) {
                    // Use stock news endpoint with symbol
                    endpoint = 'https://financialmodelingprep.com/stable/news/stock';
                    params.symbols = asset.symbol;
                    params.limit = 10;
                    console.log(`Using stock news endpoint for ${asset.symbol}`);
                } else {
                    // Use general news for indices, commodities, and other asset types
                    endpoint = 'https://financialmodelingprep.com/stable/news/general-latest';
                    params.page = 0;
                    params.limit = 10;
                    console.log(`Using general news endpoint for ${asset.symbol}`);
                }
                
                // Fetch news from FMP API
                const response = await axios.get(endpoint, {
                    params: params,
                    timeout: 5000 // 5 second timeout
                });
                
                if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
                    throw new Error("No articles found, falling back...");
                }

                // Transform the data to match the expected format
                const newsData = response.data.slice(0, 5).map(article => ({
                    title: article.title || article.headline || "No Title",
                    url: article.url || article.link || "",
                    source: article.site || article.source || article.symbol || "FMP",
                    description: article.text || article.summary || article.content || "No description available.",
                    publishedAt: article.publishedDate || article.date || new Date().toISOString()
                }));
                
                // Cache the results with appropriate TTL
                await setCachedData(cacheKey, {
                    news: newsData,
                    timestamp: Date.now()
                }, newsMaxAge);
                
                console.log(`Cached ${newsData.length} fresh news items for ${asset.name || asset.symbol} with TTL ${newsMaxAge}s`);
                
                return newsData;
            } catch (error) {
                // If we get an error and have retries left
                if (retryCount < maxRetries) {
                    // Exponential backoff
                    retryCount++;
                    console.log(`FMP news API error, retry ${retryCount}/${maxRetries} after ${retryDelay}ms delay:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    retryDelay *= 2; // Double the delay for next retry
                    continue;
                }
                
                // If we have cached data and hit errors, use the cache regardless of age
                if (cachedNews) {
                    console.log(`FMP news API failed and retries exhausted, using cached news even though it's ${((Date.now() - cachedNews.timestamp) / 1000).toFixed(0)}s old`);
                    return cachedNews.news.map(item => ({
                        ...item,
                        cached: true,
                        cacheAge: Math.floor((Date.now() - cachedNews.timestamp) / 1000)
                    }));
                }
                
                // If no cached data, try fallback logic
                throw error;
            }
        }
        
        // If we get here, throw the last error to trigger fallback
        throw new Error("FMP news API failed and retries exhausted");
    } catch (error) {
        console.error("Error fetching financial news:", error.message);
        
        // Try to retrieve cached data regardless of age as a fallback
        try {
            const cacheKey = `news_data_${asset.symbol}_${asset.type || 'default'}`;
            const cachedNews = await getCachedData(cacheKey);
            
            if (cachedNews) {
                console.log(`Using stale cached news for ${asset.name || asset.symbol} as emergency fallback`);
                return cachedNews.news.map(item => ({
                    ...item,
                    cached: true,
                    cacheAge: Math.floor((Date.now() - cachedNews.timestamp) / 1000),
                    emergency_fallback: true
                }));
            }
        } catch (cacheError) {
            console.error("Failed to retrieve emergency cached news:", cacheError.message);
        }
        
        // Implement fallback logic - try a more general FMP news endpoint
        try {
            const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
            const response = await axios.get('https://financialmodelingprep.com/stable/news/general-latest', {
                params: {
                    page: 0,
                    limit: 10,
                    apikey: apiKey
                },
                timeout: 5000
            });
            
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const newsData = response.data.map(article => ({
                    title: article.title || article.headline || "No Title",
                    url: article.url || article.link || "",
                    source: article.site || article.source || "FMP",
                    description: article.text || article.summary || article.content || "No description available.",
                    publishedAt: article.publishedDate || article.date || new Date().toISOString(),
                    fallback: true
                }));
                
                // Cache the fallback results with a shorter TTL
                const fallbackTTL = getNewsMaxAgeByAssetType(asset.type) / 2;
                const cacheKey = `news_data_${asset.symbol}_${asset.type || 'default'}`;
                await setCachedData(cacheKey, {
                    news: newsData,
                    timestamp: Date.now()
                }, fallbackTTL);
                
                return newsData;
            }
        } catch (fallbackError) {
            console.error("Fallback FMP news search also failed:", fallbackError.message);
        }
        
        // Return empty array if all attempts fail
        return [];
    }
};

// Helper function to determine appropriate news cache TTL based on asset type
const getNewsMaxAgeByAssetType = (assetType) => {
    switch(assetType) {
        case 'crypto':
            return 900; // 15 minutes - crypto markets are volatile
        case 'stock':
            return 1800; // 30 minutes - stock news changes frequently but not as quickly as crypto
        case 'fx':
            return 1200; // 20 minutes - forex is volatile but less so than crypto
        case 'commodity':
            return 3600; // 1 hour - commodities tend to move slower
        case 'index':
            return 1800; // 30 minutes - indices follow general market news
        default:
            return 1800; // Default to 30 minutes
    }
  };
  // Modify detectAsset to include historical prices
  const detectAsset = async (query) => {
    try {
      console.log(`Detecting asset from query: "${query}"`)
  
      // ENHANCED SMART EXTRACTION: Load all asset data and create comprehensive patterns
      const extractedSymbols = []
      const allAssetSymbols = new Set()
      const symbolToAssetMap = new Map()
  
      // Load all asset data to create comprehensive symbol patterns
      try {
        // Load stocks
        const stocksData = fs.readFileSync("data/stocks.json", "utf8")
        const stocksJson = JSON.parse(stocksData)
        if (stocksJson && stocksJson.tickers && Array.isArray(stocksJson.tickers)) {
          stocksJson.tickers.forEach((ticker) => {
            allAssetSymbols.add(ticker.toUpperCase())
            symbolToAssetMap.set(ticker.toUpperCase(), { symbol: ticker, type: "stock" })
          })
        }
  
        // Load crypto
        const cryptoData = fs.readFileSync("data/crypto.json", "utf8")
        const cryptoList = JSON.parse(cryptoData)
        cryptoList.forEach((crypto) => {
          const cleanSymbol = crypto.symbol.replace("USD", "").toUpperCase()
          allAssetSymbols.add(cleanSymbol)
          allAssetSymbols.add(crypto.symbol.toUpperCase())
          symbolToAssetMap.set(cleanSymbol, { symbol: crypto.symbol, type: "crypto", name: crypto.name })
          symbolToAssetMap.set(crypto.symbol.toUpperCase(), { symbol: crypto.symbol, type: "crypto", name: crypto.name })
        })
  
        // Load commodities
        const commoditiesData = fs.readFileSync("data/commodities.json", "utf8")
        const commoditiesList = JSON.parse(commoditiesData)
        commoditiesList.forEach((commodity) => {
          allAssetSymbols.add(commodity.symbol.toUpperCase())
          symbolToAssetMap.set(commodity.symbol.toUpperCase(), {
            symbol: commodity.symbol,
            type: "commodity",
            name: commodity.name,
          })
        })
  
        // Load indices
        const indicesData = fs.readFileSync("data/indices.json", "utf8")
        const indicesList = JSON.parse(indicesData)
        indicesList.forEach((index) => {
          allAssetSymbols.add(index.symbol.toUpperCase())
          symbolToAssetMap.set(index.symbol.toUpperCase(), { symbol: index.symbol, type: "index", name: index.name })
          
          // Also add the version without caret prefix for better matching
          if (index.symbol.startsWith('^')) {
            const cleanSymbol = index.symbol.substring(1).toUpperCase()
            allAssetSymbols.add(cleanSymbol)
            symbolToAssetMap.set(cleanSymbol, { symbol: index.symbol, type: "index", name: index.name })
          }
        })
  
        // Load forex
        const forexData = fs.readFileSync("data/forex.json", "utf8")
        const forexList = JSON.parse(forexData)
        forexList.forEach((forex) => {
          allAssetSymbols.add(forex.symbol.toUpperCase())
          // Also add currency pair variations
          const pair1 = `${forex.fromCurrency}${forex.toCurrency}`.toUpperCase()
          const pair2 = `${forex.fromCurrency}/${forex.toCurrency}`.toUpperCase()
          allAssetSymbols.add(pair1)
          allAssetSymbols.add(pair2)
          symbolToAssetMap.set(forex.symbol.toUpperCase(), {
            symbol: forex.symbol,
            type: "forex",
            name: `${forex.fromName} to ${forex.toName}`,
          })
          symbolToAssetMap.set(pair1, {
            symbol: forex.symbol,
            type: "forex",
            name: `${forex.fromName} to ${forex.toName}`,
          })
          symbolToAssetMap.set(pair2, {
            symbol: forex.symbol,
            type: "forex",
            name: `${forex.fromName} to ${forex.toName}`,
          })
        })
  
        console.log(`Loaded ${allAssetSymbols.size} total asset symbols for extraction`)
      } catch (error) {
        console.error("Error loading asset data for extraction:", error.message)
      }
  
      // Enhanced patterns for comprehensive asset extraction
      const patterns = [
        // PRIORITY 1: Common asset name variations and abbreviations
        /\b(apple|aapl|appl|aple)\b/gi,
        /\b(google|googl|goog|alphabet)\b/gi,
        /\b(microsoft|msft|micro)\b/gi,
        /\b(tesla|tsla)\b/gi,
        /\b(amazon|amzn)\b/gi,
        /\b(nvidia|nvda)\b/gi,
        /\b(meta|fb|facebook)\b/gi,
        /\b(netflix|nflx)\b/gi,
        /\b(bitcoin|btc)\b/gi,
        /\b(ethereum|eth)\b/gi,
        /\b(binance|bnb|binancecoin)\b/gi,
        /\b(solana|sol)\b/gi,
        /\b(cardano|ada)\b/gi,
        /\b(polkadot|dot)\b/gi,
        /\b(chainlink|link)\b/gi,
        /\b(polygon|matic)\b/gi,
        /\b(avalanche|avax)\b/gi,
        /\b(uniswap|uni)\b/gi,
        /\b(litecoin|ltc)\b/gi,
        /\b(ripple|xrp)\b/gi,
        /\b(dogecoin|doge)\b/gi,
        /\b(gold|gld|xau)\b/gi,
        /\b(silver|slv|xag)\b/gi,
        /\b(oil|crude|wti|brent)\b/gi,
        /\b(sp500|s&p500|spy|spx)\b/gi,
        /\b(nasdaq|qqq|ndx)\b/gi,
        /\b(dow|dji|dia)\b/gi,
        /\b(nasdaq100|ndx100)\b/gi,
        /\b(us30|dji)\b/gi,
        /\b(sp400|spx400)\b/gi,
        /\b(sp600|spx600)\b/gi,
        /\b(sp100|spx100)\b/gi,
        /\b(sp200|spx200)\b/gi,
        /\b(sp500|spx500)\b/gi,
        /\b(sp1000|spx1000)\b/gi,
        /\b(eurusd|eur\/usd|gbpusd|gbp\/usd|usdjpy|usd\/jpy)\b/gi,
  
        // PRIORITY 2: Direct symbol matches from our asset databases
        ...Array.from(allAssetSymbols).map(
          (symbol) => new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
        ),
  
        // PRIORITY 3: General ticker pattern (2-5 letters, only when capitalized)
        /\b([A-Z]{2,5})\b/g,
      ]
  
      patterns.forEach((pattern) => {
        const matches = query.match(pattern)
        if (matches) {
          matches.forEach((match) => {
            let normalized = match.toUpperCase()
  
            // Normalize common variations
            const normalizations = {
              APPLE: "AAPL",
              APPL: "AAPL",
              APLE: "AAPL",
              GOOGLE: "GOOGL",
              GOOG: "GOOGL",
              ALPHABET: "GOOGL",
              MICROSOFT: "MSFT",
              MICRO: "MSFT",
              TESLA: "TSLA",
              AMAZON: "AMZN",
              NVIDIA: "NVDA",
              META: "META",
              FB: "META",
              FACEBOOK: "META",
              NETFLIX: "NFLX",
              BITCOIN: "BTC",
              ETHEREUM: "ETH",
              BINANCE: "BNB",
              BINANCECOIN: "BNB",
              SOLANA: "SOL",
              CARDANO: "ADA",
              POLKADOT: "DOT",
              CHAINLINK: "LINK",
              POLYGON: "MATIC",
              AVALANCHE: "AVAX",
              UNISWAP: "UNI",
              LITECOIN: "LTC",
              RIPPLE: "XRP",
              DOGECOIN: "DOGE",
              GOLD: "GLD",
              SILVER: "SLV",
              OIL: "CL=F",
              CRUDE: "CL=F",
              WTI: "CL=F",
              SP500: "SPY",
              "S&P500": "SPY",
              NASDAQ: "QQQ",
              DOW: "DIA",
              EURUSD: "EURUSD",
              "EUR/USD": "EURUSD",
              GBPUSD: "GBPUSD",
              "GBP/USD": "GBPUSD",
              USDJPY: "USDJPY",
              "USD/JPY": "USDJPY",
              US30: "DJI",
              "US30USD": "DJI",
              "US30/USD": "DJI",
              "US30/US": "DJI",
            }
  
            if (normalizations[normalized]) {
              normalized = normalizations[normalized]
            }
  
            if (!extractedSymbols.includes(normalized)) {
              extractedSymbols.push(normalized)
            }
          })
        }
      })
  
      console.log(`Extracted potential symbols: ${extractedSymbols.join(", ")}`)
  
      // Try each extracted symbol with priority-based detection
      for (const symbol of extractedSymbols) {
        console.log(`Trying extracted symbol: ${symbol}`)
  
        // Check if symbol exists in our comprehensive symbol map
        const assetInfo = symbolToAssetMap.get(symbol)
        if (assetInfo) {
          console.log(`Found ${assetInfo.type} asset via comprehensive extraction: ${assetInfo.symbol}`)
  
          try {
            const priceData = await getAssetPrice({
              symbol: assetInfo.symbol,
              name: assetInfo.name || assetInfo.symbol,
              type: assetInfo.type,
            })
            if (priceData) {
              return {
                id: assetInfo.type === "crypto" ? assetInfo.symbol.replace("USD", "") : assetInfo.symbol,
                name: assetInfo.name || assetInfo.symbol,
                symbol: assetInfo.symbol,
                displaySymbol: assetInfo.type === "crypto" ? assetInfo.symbol.replace("USD", "") : assetInfo.symbol,
                type: assetInfo.type,
                source: `fmp_${assetInfo.type}_extracted`,
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting price data:", priceError)
          }
  
          // Return asset even if price fetch fails
          return {
            id: assetInfo.type === "crypto" ? assetInfo.symbol.replace("USD", "") : assetInfo.symbol,
            name: assetInfo.name || assetInfo.symbol,
            symbol: assetInfo.symbol,
            displaySymbol: assetInfo.type === "crypto" ? assetInfo.symbol.replace("USD", "") : assetInfo.symbol,
            type: assetInfo.type,
            source: `${assetInfo.type}_json_extracted`,
          }
        }
      }
  
      // If no extraction worked, continue with original exact matching logic
      console.log(`No assets found via extraction, trying exact matching for: ${query}`)
  
      // 1. PRIORITY: Crypto assets from our crypto.json file
      try {
        const cryptoData = fs.readFileSync("data/crypto.json", "utf8")
        const cryptoList = JSON.parse(cryptoData)
  
        // Enhanced crypto matching with common abbreviation support
        let cryptoMatch = null
        const queryLower = query.toLowerCase()
  
        // First try exact matches
        cryptoMatch = cryptoList.find((crypto) => {
          const cleanSymbol = crypto.symbol.replace("USD", "").toLowerCase()
          return cleanSymbol === queryLower || crypto.symbol.toLowerCase() === queryLower
        })
  
        // If no exact match, try common cryptocurrency abbreviations
        if (!cryptoMatch) {
          const cryptoAbbreviations = {
            btc: "BTCUSD",
            bitcoin: "BTCUSD",
            eth: "ETHUSD",
            ethereum: "ETHUSD",
            ada: "ADAUSD",
            cardano: "ADAUSD",
            dot: "DOTUSD",
            polkadot: "DOTUSD",
            bnb: "BNBUSD",
            "binance coin": "BNBUSD",
            sol: "SOLUSD",
            solana: "SOLUSD",
            matic: "MATICUSD",
            polygon: "MATICUSD",
            avax: "AVAXUSD",
            avalanche: "AVAXUSD",
            link: "LINKUSD",
            chainlink: "LINKUSD",
            uni: "UNIUSD",
            uniswap: "UNIUSD",
            ltc: "LTCUSD",
            litecoin: "LTCUSD",
            bch: "BCHUSD",
            "bitcoin cash": "BCHUSD",
            xrp: "XRPUSD",
            ripple: "XRPUSD",
            doge: "DOGEUSD",
            dogecoin: "DOGEUSD",
          }
  
          const targetSymbol = cryptoAbbreviations[queryLower]
          if (targetSymbol) {
            console.log(`Converting crypto abbreviation "${query}" to "${targetSymbol}"`)
            cryptoMatch = cryptoList.find((crypto) => crypto.symbol.toLowerCase() === targetSymbol.toLowerCase())
          }
        }
  
        if (cryptoMatch) {
          console.log(`Found crypto asset in crypto.json: ${cryptoMatch.symbol} (${cryptoMatch.name})`)
  
          // Try to get price data from FMP API
          try {
            const priceData = await getAssetPrice({
              symbol: cryptoMatch.symbol,
              name: cryptoMatch.name,
              type: "crypto",
            })
            if (priceData) {
              return {
                id: cryptoMatch.symbol.replace("USD", ""),
                name: cryptoMatch.name,
                symbol: cryptoMatch.symbol, // Keep full symbol for API calls
                displaySymbol: cryptoMatch.symbol.replace("USD", ""), // For display purposes
                type: "crypto",
                source: "fmp_crypto",
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting crypto price data:", priceError)
          }
  
          // Return the crypto asset even if price fetch fails
          return {
            id: cryptoMatch.symbol.replace("USD", ""),
            name: cryptoMatch.name,
            symbol: cryptoMatch.symbol, // Keep full symbol for API calls
            displaySymbol: cryptoMatch.symbol.replace("USD", ""), // For display purposes
            type: "crypto",
            source: "crypto_json",
          }
        }
  
        console.log(`No crypto asset found in crypto.json for query: ${query}`)
      } catch (cryptoError) {
        console.error("Error loading crypto data:", cryptoError.message)
      }
  
      // 2. Stocks from stocks.json
      try {
        const stocksData = fs.readFileSync("data/stocks.json", "utf8")
        const stocksJson = JSON.parse(stocksData)
  
        if (stocksJson && stocksJson.tickers && Array.isArray(stocksJson.tickers)) {
          // Look for exact symbol match (case-insensitive)
          const stockMatch = stocksJson.tickers.find((ticker) => ticker.toLowerCase() === query.toLowerCase())
  
          if (stockMatch) {
            console.log(`Found stock asset in stocks.json: ${stockMatch}`)
  
            // Try to get price data from FMP API
            try {
              const priceData = await getAssetPrice({
                symbol: stockMatch,
                name: stockMatch,
                type: "stock",
              })
              if (priceData) {
                return {
                  id: stockMatch,
                  name: stockMatch,
                  symbol: stockMatch,
                  type: "stock",
                  source: "fmp_stock",
                  price: priceData,
                }
              }
            } catch (priceError) {
              console.error("Error getting stock price data:", priceError)
            }
  
            // Return the stock asset even if price fetch fails
            return {
              id: stockMatch,
              name: stockMatch,
              symbol: stockMatch,
              type: "stock",
              source: "stocks_json",
            }
          }
        }
  
        console.log(`No stock asset found in stocks.json for query: ${query}`)
      } catch (stocksError) {
        console.error("Error loading stocks data:", stocksError.message)
      }
  
      // 3. Commodities from commodities.json
      try {
        const commoditiesData = fs.readFileSync("data/commodities.json", "utf8")
        const commoditiesList = JSON.parse(commoditiesData)
  
        // Look for exact symbol matches in commodities.json (case-insensitive)
        const commodityMatch = commoditiesList.find(
          (commodity) =>
            commodity.symbol.toLowerCase() === query.toLowerCase() ||
            commodity.name.toLowerCase().includes(query.toLowerCase()),
        )
  
        if (commodityMatch) {
          console.log(`Found commodity asset in commodities.json: ${commodityMatch.symbol} (${commodityMatch.name})`)
  
          // Try to get price data from FMP API
          try {
            const priceData = await getAssetPrice({
              symbol: commodityMatch.symbol,
              name: commodityMatch.name,
              type: "commodity",
            })
            if (priceData) {
              return {
                id: commodityMatch.symbol,
                name: commodityMatch.name,
                symbol: commodityMatch.symbol,
                type: "commodity",
                source: "fmp_commodity",
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting commodity price data:", priceError)
          }
  
          // Return the commodity asset even if price fetch fails
          return {
            id: commodityMatch.symbol,
            name: commodityMatch.name,
            symbol: commodityMatch.symbol,
            type: "commodity",
            source: "commodities_json",
          }
        }
  
        console.log(`No commodity asset found in commodities.json for query: ${query}`)
      } catch (commoditiesError) {
        console.error("Error loading commodities data:", commoditiesError.message)
      }
  
      // 4. Indices from indices.json
      try {
        const indicesData = fs.readFileSync("data/indices.json", "utf8")
        const indicesList = JSON.parse(indicesData)
  
        // Look for exact symbol matches in indices.json (case-insensitive)
        const indexMatch = indicesList.find(
          (index) =>
            index.symbol.toLowerCase() === query.toLowerCase() || index.name.toLowerCase().includes(query.toLowerCase()),
        )
  
        if (indexMatch) {
          console.log(`Found index asset in indices.json: ${indexMatch.symbol} (${indexMatch.name})`)
  
          // Try to get price data from FMP API
          try {
            const priceData = await getAssetPrice({
              symbol: indexMatch.symbol,
              name: indexMatch.name,
              type: "index",
            })
            if (priceData) {
              return {
                id: indexMatch.symbol,
                name: indexMatch.name,
                symbol: indexMatch.symbol,
                type: "index",
                source: "fmp_index",
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting index price data:", priceError)
          }
  
          // Return the index asset even if price fetch fails
          return {
            id: indexMatch.symbol,
            name: indexMatch.name,
            symbol: indexMatch.symbol,
            type: "index",
            source: "indices_json",
          }
        }
  
        console.log(`No index asset found in indices.json for query: ${query}`)
      } catch (indicesError) {
        console.error("Error loading indices data:", indicesError.message)
      }
  
      // 5. Forex from forex.json
      try {
        const forexData = fs.readFileSync("data/forex.json", "utf8")
        const forexList = JSON.parse(forexData)
  
        // Look for exact symbol matches in forex.json (case-insensitive)
        const forexMatch = forexList.find(
          (forex) =>
            forex.symbol.toLowerCase() === query.toLowerCase() ||
            `${forex.fromCurrency}${forex.toCurrency}`.toLowerCase() === query.toLowerCase() ||
            `${forex.fromCurrency}/${forex.toCurrency}`.toLowerCase() === query.toLowerCase(),
        )
  
        if (forexMatch) {
          console.log(
            `Found forex asset in forex.json: ${forexMatch.symbol} (${forexMatch.fromName} to ${forexMatch.toName})`,
          )
  
          // Try to get price data from FMP API
          try {
            const priceData = await getAssetPrice({
              symbol: forexMatch.symbol,
              name: `${forexMatch.fromName} to ${forexMatch.toName}`,
              type: "forex",
            })
            if (priceData) {
              return {
                id: forexMatch.symbol,
                name: `${forexMatch.fromName} to ${forexMatch.toName}`,
                symbol: forexMatch.symbol,
                type: "forex",
                source: "fmp_forex",
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting forex price data:", priceError)
          }
  
          // Return the forex asset even if price fetch fails
          return {
            id: forexMatch.symbol,
            name: `${forexMatch.fromName} to ${forexMatch.toName}`,
            symbol: forexMatch.symbol,
            type: "forex",
            source: "forex_json",
          }
        }
  
        console.log(`No forex asset found in forex.json for query: ${query}`)
      } catch (forexError) {
        console.error("Error loading forex data:", forexError.message)
      }
  
      // Check if the query might be a contract address for a memecoin token
      // These patterns detect contract addresses on different chains
      const contractAddressPattern = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/
      const chainPrefixPattern = /^(0x1|0x38|0x89|0xa|0x2105)/
      const pumpSuffixPattern = /pump$/i
      const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
      
      // Enhanced Solana address detection with specific patterns
      const isSolanaAddress = (address) => {
        // Solana addresses are 32-44 characters, Base58 encoded
        // They cannot contain 0, O, I, l to avoid confusion
        const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
        return solanaPattern.test(address) && address.length >= 32 && address.length <= 44
      }
      
      // Enhanced Ethereum/BSC/Polygon address detection
      const isEvmAddress = (address) => {
        return /^0x[a-fA-F0-9]{40}$/.test(address)
      }

      // Check if this looks like a contract address (prioritize DexScreener for memecoins)
      const isContractAddress = contractAddressPattern.test(query) || 
        chainPrefixPattern.test(query) || 
        pumpSuffixPattern.test(query) || 
        isSolanaAddress(query) || 
        isEvmAddress(query)

      // If the query matches a potential contract address pattern, try DexScreener API FIRST
      if (isContractAddress) {
        console.log(`Query "${query}" detected as contract address (${isSolanaAddress(query) ? 'Solana' : isEvmAddress(query) ? 'EVM' : 'Unknown chain'}), searching DexScreener...`)
        try {
          // Search DexScreener API with enhanced parameters for better memecoin detection
          const dexScreenerResponse = await axios.get("https://api.dexscreener.com/latest/dex/search", {
            params: {
              q: query,
            },
            timeout: 15000, // Increased timeout for better reliability
          })

          if (
            dexScreenerResponse.data &&
            dexScreenerResponse.data.pairs &&
            Array.isArray(dexScreenerResponse.data.pairs) &&
            dexScreenerResponse.data.pairs.length > 0
          ) {
            console.log(`Found ${dexScreenerResponse.data.pairs.length} liquidity pairs on DexScreener for contract address`)

            // Enhanced pair selection logic for memecoins
            let bestPair = dexScreenerResponse.data.pairs[0]

            if (dexScreenerResponse.data.pairs.length > 1) {
              // For memecoins, prioritize pairs with:
              // 1. Higher liquidity (safety)
              // 2. Recent activity (volume)
              // 3. Avoid honeypots (check for reasonable price changes)
              bestPair = dexScreenerResponse.data.pairs.reduce((best, current) => {
                const bestLiquidity = best.liquidity?.usd || 0
                const currentLiquidity = current.liquidity?.usd || 0
                const bestVolume = best.volume?.h24 || 0
                const currentVolume = current.volume?.h24 || 0
                
                // Composite score: liquidity weight 70%, volume weight 30%
                const bestScore = (bestLiquidity * 0.7) + (bestVolume * 0.3)
                const currentScore = (currentLiquidity * 0.7) + (currentVolume * 0.3)
                
                return currentScore > bestScore ? current : best
              }, dexScreenerResponse.data.pairs[0])
            }

            console.log(
              `Selected best pair: ${bestPair.baseToken?.symbol || 'Unknown'} with ${bestPair.liquidity?.usd || 0} USD liquidity on ${bestPair.chainId || "unknown chain"}`
            )

            // Create enhanced asset object from DexScreener data for memecoin
            const tokenSymbol = bestPair.baseToken?.symbol || query.substring(0, 8).toUpperCase()
            const tokenName = bestPair.baseToken?.name || `Token ${tokenSymbol}`
            const priceUsd = parseFloat(bestPair.priceUsd) || 0
            
            const asset = {
              id: tokenSymbol,
              name: tokenName,
              symbol: tokenSymbol,
              displaySymbol: tokenSymbol,
              type: "crypto",
              subType: "memecoin", // Add subtype for memecoins
              source: "dexscreener",
              contractAddress: query, // Store the original contract address
              priceUsd: priceUsd,
              priceNative: bestPair.priceNative,
              volume24h: bestPair.volume?.h24 || 0,
              priceChange24h: bestPair.priceChange?.h24 || 0,
              liquidity: bestPair.liquidity?.usd || 0,
              marketCap: bestPair.fdv || bestPair.marketCap || 0,
              // Enhanced chain information
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
                // Add trading safety indicators
                safetyScore: bestPair.liquidity?.usd > 10000 ? 'high' : 
                           bestPair.liquidity?.usd > 1000 ? 'medium' : 'low',
                lastUpdated: new Date().toISOString(),
              },
            }

            console.log(`Created memecoin asset from DexScreener: ${tokenSymbol} (${tokenName}) at $${priceUsd}`)
            console.log(`Contract: ${query} on ${asset.chainInfo.chainName}`)
            return asset
          } else {
            console.log(`No results found on DexScreener for contract address: ${query}`)
          }
        } catch (dexScreenerError) {
          console.error("DexScreener API error for contract address:", dexScreenerError.message)
          // Don't return null here, continue with other detection methods
        }
      }
  
      // If crypto not found in local data, try crypto symbols in DexScreener as a fallback
      // This helps catch memecoins and new tokens that might not be in crypto.json
      try {
        console.log(`Trying DexScreener search for potential crypto token: ${query}`)
        const dexScreenerResponse = await axios.get("https://api.dexscreener.com/latest/dex/search", {
          params: {
            q: query,
          },
        })
  
        if (
          dexScreenerResponse.data &&
          dexScreenerResponse.data.pairs &&
          Array.isArray(dexScreenerResponse.data.pairs) &&
          dexScreenerResponse.data.pairs.length > 0
        ) {
          // Look for exact symbol matches first
          const exactMatch = dexScreenerResponse.data.pairs.find(
            (pair) => pair.baseToken?.symbol?.toLowerCase() === query.toLowerCase(),
          )
  
          if (exactMatch) {
            console.log(`Found exact symbol match on DexScreener: ${exactMatch.baseToken.symbol}`)
  
            const tokenSymbol = exactMatch.baseToken?.symbol || query
            const tokenName = exactMatch.baseToken?.name || query
  
            const asset = {
              id: tokenSymbol,
              name: tokenName,
              symbol: tokenSymbol,
              type: "crypto",
              source: "dexscreener",
              priceUsd: exactMatch.priceUsd,
              priceNative: exactMatch.priceNative,
              volume24h: exactMatch.volume?.h24 || 0,
              priceChange24h: exactMatch.priceChange?.h24 || 0,
              liquidity: exactMatch.liquidity?.usd || 0,
              marketCap: exactMatch.fdv || exactMatch.marketCap || 0,
              dexInfo: {
                dexId: exactMatch.dexId,
                pairAddress: exactMatch.pairAddress,
                chainId: exactMatch.chainId,
                url: exactMatch.url,
                quoteToken: exactMatch.quoteToken,
                info: exactMatch.info || {},
              },
            }
  
            console.log(`Created crypto asset from DexScreener fallback: ${tokenSymbol} (${tokenName})`)
            return asset
          }
        }
      } catch (dexScreenerError) {
        console.error("DexScreener fallback search error:", dexScreenerError.message)
      }
  
      // 6. FINAL FALLBACK: Gemini for any remaining unidentified assets
      try {
        console.log(`Falling back to Gemini for asset detection: ${query}`)
  
        const payload = {
          contents: [
            {
              parts: [
                {
                  text: `You are a financial asset detection assistant. Your task is to identify the primary financial asset being discussed in the query. 
                          Return ONLY a JSON object with the following structure:
                          {
                              "symbol": "The ticker symbol (e.g., AAPL, GLD, EUR/USD, SPY)",
                              "name": "Full name of the asset",
                              "type": "Type of asset (stock, crypto, commodity, forex, index)"
                          }
                          
                          Query: ${query}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 2048,
          },
        }
  
        const geminiResponse = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        })
  
        const content = geminiResponse.data.candidates[0]?.content?.parts[0]?.text || ""
        
        // Clean the content if it's wrapped in markdown code blocks
        let cleanContent = content.trim()
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        const detectedAsset = JSON.parse(cleanContent)
        console.log("Gemini detected asset:", detectedAsset)
  
        if (detectedAsset && detectedAsset.symbol) {
          // Try to get price data from FMP API
          try {
            const priceData = await getAssetPrice({
              symbol: detectedAsset.symbol,
              name: detectedAsset.name,
              type: detectedAsset.type,
            })
            if (priceData) {
              return {
                id: detectedAsset.symbol,
                name: detectedAsset.name,
                symbol: detectedAsset.symbol,
                type: detectedAsset.type,
                source: "gemini_fmp",
                price: priceData,
              }
            }
          } catch (priceError) {
            console.error("Error getting price data:", priceError)
          }
  
          // Return the asset even if price fetch fails
          return {
            id: detectedAsset.symbol,
            name: detectedAsset.name,
            symbol: detectedAsset.symbol,
            type: detectedAsset.type,
            source: "gemini",
          }
        }
      } catch (geminiError) {
        console.log("Gemini asset detection failed:", geminiError.message)
      }
  
      console.log("No asset detected through any method")
      return null
    } catch (error) {
      console.error("Error in detectAsset:", error)
      return null
    }
  }
  

// Updated getGeminiAnalysis function to incorporate enhanced financial data and news status
const getGeminiAnalysis = async (asset, assetPrice, sentiment, userQuery) => {
    try {
        // Check if we have news info and if it's cached
        const newsInfo = asset.newsInfo || { count: 0, isCached: false, cacheAge: 0, sources: [] };
        const newsCacheStatus = newsInfo.isCached 
            ? `(Note: Using cached news data from ${Math.floor(newsInfo.cacheAge / 60)} minutes ago)` 
            : '';
            // Initialize empty financial insights
    let financialInsights = { keyPoints: [], riskFactors: [], marketTrends: [], qaData: [] };
    
    // Note: Financial dataset has been removed and replaced with FMP API
    console.log(`Using FMP API data for ${asset.name || asset.symbol}`);

        // Fetch enhanced financial data from FMP
        let enhancedFinancialData = {};
        try {
            enhancedFinancialData = await getEnhancedFinancialData(asset);
            console.log(`Retrieved enhanced financial data for ${asset.name || asset.symbol}`);
        } catch (enhancedDataError) {
            console.error('Error retrieving enhanced financial data:', enhancedDataError);
        }
        
        // Fetch insider trading data for stocks
        let insiderTradingData = [];
        if (asset.type && asset.type.toLowerCase() === 'stock') {
            try {
                const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
                const response = await axios.get(`https://financialmodelingprep.com/stable/insider-trading/${asset.symbol}`, {
                    params: {
                        page: 0,
                        limit: 5, // Just get a few recent transactions
                        apikey: apiKey
                    }
                });
                
                if (response.data && Array.isArray(response.data)) {
                    insiderTradingData = response.data;
                    console.log(`Retrieved ${insiderTradingData.length} insider trading records for ${asset.symbol}`);
                }
            } catch (insiderError) {
                console.error(`Error retrieving insider trading data for ${asset.symbol}:`, insiderError);
            }
        }
        
        // Format financial insights for the prompt
        const keyPointsText = financialInsights.keyPoints && financialInsights.keyPoints.length > 0 
            ? `\nKey financial points:\n${financialInsights.keyPoints.map(point => `- ${point}`).join('\n')}`
            : '';
            
        const riskFactorsText = financialInsights.riskFactors && financialInsights.riskFactors.length > 0
            ? `\nRisk factors:\n${financialInsights.riskFactors.map(risk => `- ${risk}`).join('\n')}`
            : '';
            
        const marketTrendsText = financialInsights.marketTrends && financialInsights.marketTrends.length > 0
            ? `\nMarket trends:\n${financialInsights.marketTrends.map(trend => `- ${trend}`).join('\n')}`
            : '';
            
        const qaDataText = financialInsights.qaData && financialInsights.qaData.length > 0
            ? `\nRelevant financial Q&A:\n${financialInsights.qaData.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}`
            : '';

        // Format enhanced financial data for the prompt
        let enhancedDataText = '';
        
        // Technical Indicators
        if (enhancedFinancialData.technicalIndicators) {
            enhancedDataText += '\nTechnical Indicators:';
            if (enhancedFinancialData.technicalIndicators.rsi) {
                enhancedDataText += `\n- RSI (14): ${enhancedFinancialData.technicalIndicators.rsi.rsi?.toFixed(2) || 'N/A'}`;
            }
            if (enhancedFinancialData.technicalIndicators.sma) {
                enhancedDataText += `\n- SMA (20): ${enhancedFinancialData.technicalIndicators.sma.sma?.toFixed(2) || 'N/A'}`;
            }
            if (enhancedFinancialData.technicalIndicators.ema) {
                enhancedDataText += `\n- EMA (20): ${enhancedFinancialData.technicalIndicators.ema.ema?.toFixed(2) || 'N/A'}`;
            }
        }
        
        // Analyst Estimates
        if (enhancedFinancialData.analystEstimates) {
            enhancedDataText += '\nAnalyst Estimates:';
            const estimates = enhancedFinancialData.analystEstimates;
            if (estimates.estimatedEPS) {
                enhancedDataText += `\n- Estimated EPS: $${estimates.estimatedEPS?.toFixed(2) || 'N/A'}`;
            }
            if (estimates.estimatedRevenueAvg) {
                enhancedDataText += `\n- Estimated Revenue: $${(estimates.estimatedRevenueAvg / 1000000).toFixed(2) || 'N/A'} million`;
            }
        }
        
        // Price Target
        if (enhancedFinancialData.priceTarget) {
            const target = enhancedFinancialData.priceTarget;
            enhancedDataText += '\nPrice Target:';
            enhancedDataText += `\n- Target: $${target.priceTarget?.toFixed(2) || 'N/A'}`;
            enhancedDataText += `\n- High: $${target.targetHigh?.toFixed(2) || 'N/A'}, Low: $${target.targetLow?.toFixed(2) || 'N/A'}`;
            enhancedDataText += `\n- Consensus: ${target.targetConsensus || 'N/A'}, Analysts: ${target.numberOfAnalysts || 'N/A'}`;
        }
        
        // Ratings / Stock Score
        if (enhancedFinancialData.ratings) {
            const ratings = enhancedFinancialData.ratings;
            enhancedDataText += '\nStock Rating:';
            enhancedDataText += `\n- Overall Rating: ${ratings.rating || 'N/A'} (Score: ${ratings.ratingScore?.toFixed(2) || 'N/A'})`;
            enhancedDataText += `\n- Recommendation: ${ratings.ratingRecommendation || 'N/A'}`;
        }
        
        // Key Metrics (only add if data exists)
        if (enhancedFinancialData.keyMetrics) {
            const metrics = enhancedFinancialData.keyMetrics;
            enhancedDataText += '\nKey Metrics:';
            
            if (metrics.peRatio) {
                enhancedDataText += `\n- P/E Ratio: ${metrics.peRatio?.toFixed(2) || 'N/A'}`;
            }
            if (metrics.pbRatio) {
                enhancedDataText += `\n- P/B Ratio: ${metrics.pbRatio?.toFixed(2) || 'N/A'}`;
            }
            if (metrics.returnOnEquity) {
                enhancedDataText += `\n- ROE: ${(metrics.returnOnEquity * 100)?.toFixed(2) || 'N/A'}%`;
            }
            if (metrics.debtToEquity) {
                enhancedDataText += `\n- Debt to Equity: ${metrics.debtToEquity?.toFixed(2) || 'N/A'}`;
            }
        }
        
        // Peer Companies
        if (enhancedFinancialData.stockPeers && enhancedFinancialData.stockPeers.peersList) {
            enhancedDataText += '\nPeer Companies:';
            enhancedDataText += `\n- ${enhancedFinancialData.stockPeers.peersList.join(', ')}`;
        }
        
        // Add insider trading data if available
        if (insiderTradingData && insiderTradingData.length > 0) {
            enhancedDataText += '\n\nRecent Insider Trading:';
            insiderTradingData.forEach(trade => {
                const action = trade.transactionType || 'Unknown';
                const shares = trade.securitiesTransacted || 0;
                const price = trade.price || 0;
                const value = trade.transactionValue || (shares * price);
                const person = trade.reportingName || 'Insider';
                const position = trade.typeOfOwner || 'Unknown';
                const date = new Date(trade.transactionDate).toLocaleDateString();
                
                enhancedDataText += `\n- ${date}: ${person} (${position}) ${action} ${shares} shares at $${price}/share, total value: $${value.toLocaleString()}`;
            });
        }

        // Get the raw tweets for sentiment analysis
        const rawTweets = sentiment.rawTweets || [];
        const tweetSamplesForAnalysis = rawTweets.slice(0, 10).join("\n\n").substring(0, 2000); // Limit to first 10 tweets and 2000 chars
        
        // Include tweet text directly in the prompt for Gemini to analyze sentiment
        const tweetSentimentPrompt = rawTweets.length > 0 
            ? `\n\nHere are some social media posts about ${asset.name || asset.symbol} for sentiment analysis (determine if Bullish, Bearish, or Neutral):\n${tweetSamplesForAnalysis}`
            : '';

        const systemPrompt = `You are a seasoned professional trader and technical analyst with 20+ years of market experience. Provide sophisticated but CONCISE technical analysis that would be valuable to advanced traders.

IMPORTANT: When analyzing prices, understand that financial markets have evolved significantly:
- Bitcoin and major cryptocurrencies have reached new all-time highs, with Bitcoin trading over $100,000 being realistic
- Market valuations across all asset classes have expanded due to monetary policy and institutional adoption
- Always treat the current price data provided as accurate and realistic market conditions
- Do not label legitimate market prices as "hypothetical" or "unrealistic" unless there's clear evidence of data error

CRITICAL PRICE DISTINCTION:
- ETF Prices vs. Actual Asset Prices: Be aware that cryptocurrency ETFs (like Bitcoin ETFs) trade at much lower prices (~$46) compared to actual cryptocurrencies (~$104,000)
- When analyzing Bitcoin or other crypto assets, always clarify whether you're analyzing the ETF or the actual cryptocurrency
- If the price seems low for a cryptocurrency (~$46), it's likely an ETF; if high (~$104K), it's the actual cryptocurrency
- Provide context about both when relevant to help users understand which asset they're analyzing and recommend using USD after the asset name if they want market prices.

FORMATTING REQUIREMENTS:
- Use clear section headers (e.g., "## Key Support Levels:", "## Technical Indicators:")
- Create proper paragraph breaks between different topics
- Use bullet points and numbered lists for better readability
- Ensure each major concept has its own paragraph
- Add blank lines between sections for visual separation
- Structure content logically with subsections where appropriate
- KEEP ANALYSIS COMPACT AND CONCISE - focus on the most critical points only

For this analysis:
1. First analyze any social media posts included in the prompt to determine market sentiment (Bullish, Bearish, or Neutral)
2. Examine current price action, trend status, support/resistance levels, and key technical indicators
3. For stocks, analyze any insider trading activity and what it suggests about insider sentiment
4. Identify potential entry/exit points with specific price targets
5. Note relevant chart patterns and what they suggest for future price movement
6. Reference relevant news from reputable financial sources when applicable
7. Include both bullish and bearish scenarios to present a balanced perspective
8. Conclude with actionable insights for traders

Use sophisticated language that demonstrates expertise in technical analysis. Structure your response with clear sections, proper paragraph breaks, and bullet points where helpful. Keep responses CONCISE and focused on the most important insights. Tag news sources appropriately when referenced - e.g. [Bloomberg], [Wall Street Journal].`;

        const userPrompt = `${userQuery}\n\n${asset.name || asset.symbol} is currently priced at $${assetPrice}.` +
                         `${tweetSentimentPrompt}` +
                         `${newsCacheStatus}` +
                         `${keyPointsText}${riskFactorsText}${marketTrendsText}${qaDataText}` +
                         `${enhancedDataText}` +
                         "\n\nReference these news sources in your analysis where relevant: Barron's, Investor's Business Daily, MarketWatch, Bloomberg, CNBC, Wall Street Journal, Financial Times, Reuters, CoinDesk, and CoinTelegraph. Tag each source appropriately in your response.";

        // Prepare Gemini API request
        const payload = {
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\n${userPrompt}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 2048
            }
        };

        console.log(`Making Gemini API request for ${asset.name || asset.symbol} analysis...`);
        
        // Retry configuration
        const maxRetries = 3;
        const baseTimeout = 30000; // Increased from 15s to 30s
        let lastError;
        
        try {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const timeout = baseTimeout + (attempt - 1) * 10000; // Increase timeout with each retry
                    console.log(`Attempt ${attempt}/${maxRetries} for Gemini API (timeout: ${timeout}ms)`);
                    
                    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: timeout
                    });

                    // Debug: Log the actual response structure to understand Gemini 2.5 format
                    // console.log('Gemini API response structure:', JSON.stringify(response.data, null, 2));

                    // Extract content from Gemini response with enhanced error handling
                    let responseText = 'Analysis not available';
                    
                    try {
                        // Check if response has the expected structure
                        if (response.data && response.data.candidates && Array.isArray(response.data.candidates) && response.data.candidates.length > 0) {
                            const candidate = response.data.candidates[0];
                            
                            // Check for proper content structure with parts
                            if (candidate && candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
                                responseText = candidate.content.parts[0].text || 'Analysis not available';
                                console.log('Successfully extracted text from parts array');
                            } 
                            // Handle case where content exists but no parts (often when MAX_TOKENS reached)
                            else if (candidate && candidate.content && candidate.finishReason === 'MAX_TOKENS') {
                                console.warn('Response truncated due to MAX_TOKENS limit. Content structure:', candidate.content);
                                responseText = 'Analysis was truncated due to length limits. The market analysis is partially available but may be incomplete.';
                            }
                            // Handle other unexpected candidate structures
                            else {
                                console.warn('Unexpected candidate structure:', candidate);
                                if (candidate.finishReason) {
                                    responseText = `Analysis not available due to ${candidate.finishReason}. Please try again.`;
                                }
                            }
                        } 
                        // Check for alternative response structures (other possible Gemini formats)
                        else if (response.data && response.data.text) {
                            // Direct text response
                            responseText = response.data.text;
                        }
                        else if (response.data && response.data.content) {
                            // Content-based response
                            responseText = response.data.content;
                        }
                        else if (response.data && response.data.response) {
                            // Response wrapper
                            responseText = response.data.response;
                        }
                        else {
                            console.error('Unrecognized Gemini API response structure:', {
                                hasData: !!response.data,
                                dataKeys: response.data ? Object.keys(response.data) : [],
                                dataType: typeof response.data
                            });
                            throw new Error('Unrecognized response structure from Gemini API');
                        }
                    } catch (parseError) {
                        console.error('Error parsing Gemini response:', parseError);
                        console.error('Raw response data:', response.data);
                        throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
                    }

                    // Extract sentiment from the Gemini response using a pattern-matching approach
                    const sentimentRegex = /(bullish|bearish|neutral)/i;
                    const sentimentMatch = responseText.match(sentimentRegex);
                    const geminiSentiment = sentimentMatch ? sentimentMatch[0].charAt(0).toUpperCase() + sentimentMatch[0].slice(1).toLowerCase() : 'Neutral';

                    console.log(`Gemini analysis completed for ${asset.name || asset.symbol}, detected sentiment: ${geminiSentiment}`);

                    return {
                        analysis: responseText,
                        sentiment: geminiSentiment,
                        source: 'gemini'
                    };
                    
                } catch (error) {
                    lastError = error;
                    console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.code || error.message);
                    
                    // If this is the last attempt, don't wait
                    if (attempt === maxRetries) {
                        break;
                    }
                    
                    // Exponential backoff: wait 2^attempt seconds before retrying
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            
            // If we reach here, all retries failed
            console.error("All Gemini API attempts failed. Last error:", lastError);
            throw lastError;
        } catch (error) {
            console.error("Error fetching Gemini response:", error);
            
            // Enhanced error logging
            if (error.code === 'ECONNABORTED') {
                console.error(`Gemini API timeout after ${maxRetries} attempts. Consider checking network connectivity or API status.`);
            } else if (error.response) {
                console.error(`Gemini API HTTP error: ${error.response.status} - ${error.response.statusText}`);
            } else if (error.request) {
                console.error('No response received from Gemini API');
            } else {
                console.error('Request setup error:', error.message);
            }
            
            // Fallback response
            return {
                analysis: `Technical analysis for ${asset.name || asset.symbol} is temporarily unavailable due to API timeout. Current price: $${assetPrice}. Please try again later.`,
                sentiment: sentiment.sentiment || 'Neutral',
                source: 'fallback'
            };
        }
    } catch (error) {
        console.error("Error fetching Gemini response:", error);
        
        // Enhanced error logging
        if (error.code === 'ECONNABORTED') {
            console.error(`Gemini API timeout after ${maxRetries} attempts. Consider checking network connectivity or API status.`);
        } else if (error.response) {
            console.error(`Gemini API HTTP error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
            console.error('No response received from Gemini API');
        } else {
            console.error('Request setup error:', error.message);
        }
        
        // Fallback response
        return {
            analysis: `Technical analysis for ${asset.name || asset.symbol} is temporarily unavailable due to API timeout. Current price: $${assetPrice}. Please try again later.`,
            sentiment: sentiment.sentiment || 'Neutral',
            source: 'fallback'
        };
    }
};

app.use(express.json());

// Add CORS headers to allow requests from your frontend
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://koyn.finance',
      'https://www.koyn.finance',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://167.71.16.134'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'X-Request-Time'
  ]
}));

// Set up proxy middleware to forward verification and subscription requests
const verificationPort = process.env.VERIFICATION_PORT || 3005;

app.use(['/api/verification', '/api/subscription'], createProxyMiddleware({
  target: `http://localhost:${verificationPort}`,
  changeOrigin: true,
  logLevel: 'debug'
}));

// Helper function to check if a subscription ID is active
function isSubscriptionActive(subscriptionId) {
  console.log(`Checking subscription status for ID: ${subscriptionId}`);
  
  if (!subscriptionId) {
    console.log(`Subscription check failed: Missing subscription ID`);
    return false;
  }
  
  try {
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    if (!fs.existsSync(subscriptionsFilePath)) {
      console.log(`Subscription check failed: Subscriptions file not found at ${subscriptionsFilePath}`);
      return false;
    }
    
    const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
    const subscriptions = JSON.parse(data);
    console.log(`Found ${subscriptions.length} subscriptions in database`);
    
    // Find subscription by ID
    const subscription = subscriptions.find(sub => sub.id === subscriptionId);
    
    if (!subscription) {
      console.log(`No subscription found with ID: ${subscriptionId}`);
      return false;
    }
    
    // Check if explicitly marked as active (preferred method)
    if (subscription.status === 'active') {
      console.log(`Found active subscription with ID ${subscriptionId}`);
      return true;
    }
    
    // If not explicitly inactive, check renewal date
    if (subscription.status !== 'inactive' && subscription.renewalDate) {
      const renewalDate = new Date(subscription.renewalDate);
      const now = new Date();
      const isActive = renewalDate > now;
      console.log(`Subscription ${subscriptionId} status: ${subscription.status}, renewal date: ${renewalDate}, is active: ${isActive}`);
      return isActive;
    }
    
    console.log(`Subscription ${subscriptionId} is not active (status: ${subscription.status})`);
    return false;
  } catch (err) {
    console.error('Error checking subscription status:', err);
    return false;
  }
}

// Helper function to check if an email has an active subscription
function isSubscribed(email, subscriptionId) {
  console.log(`Checking subscription for email: ${email}, ID: ${subscriptionId}`);
  
  if (!email || !subscriptionId) {
    console.log(`Subscription check failed: Missing email or ID`);
    return false;
  }
  
  try {
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    if (!fs.existsSync(subscriptionsFilePath)) {
      console.log(`Subscription check failed: Subscriptions file not found at ${subscriptionsFilePath}`);
      return false;
    }
    
    const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
    const subscriptions = JSON.parse(data);
    console.log(`Found ${subscriptions.length} subscriptions in database`);
    
    // Find active subscriptions for this email AND matching the provided ID
    const matchingSubscription = subscriptions.find(sub => {
      // Case-insensitive email comparison
      const emailMatch = sub.email && sub.email.toLowerCase() === email.toLowerCase();
      if (!emailMatch) return false;
      
      // Verify subscription ID matches exactly
      const idMatch = sub.id && sub.id === subscriptionId;
      if (!idMatch) {
        console.log(`ID mismatch for ${email}: provided ${subscriptionId}, found ${sub.id}`);
        return false;
      }
      
      // Check if explicitly marked as active (preferred method)
      if (sub.status === 'active') {
        console.log(`Found active subscription for ${email} with ID ${subscriptionId}`);
        return true;
      }
      
      // If not explicitly inactive, check renewal date
      if (sub.status !== 'inactive' && sub.renewalDate) {
        const renewalDate = new Date(sub.renewalDate);
        const now = new Date();
        const isActive = renewalDate > now;
        console.log(`Subscription status for ${email}: ${sub.status}, renewal date: ${renewalDate}, is active: ${isActive}`);
        return isActive;
      }
      
      console.log(`Subscription for ${email} is not active (status: ${sub.status})`);
      return false;
    });
    
    return !!matchingSubscription;
  } catch (err) {
    console.error('Error checking subscription status:', err);
    return false;
  }
}

// Update the API endpoint to handle null asset with JWT authentication
app.post("/api/sentiment", rateLimitMiddleware, async (req, res) => {
  console.log("Received sentiment request:", req.body);
  const userQuery = req.body.question || "Is now a good time to buy crypto?";
  const demoToken = req.body.demo_token;
  const explicitAsset = req.body.asset || null; // Allow client to specify asset explicitly
  
  // Special exception for demo access
  const DEMO_TOKEN = process.env.DEMO_TOKEN || "koyn_demo_2024";
  const isDemoAccess = demoToken && demoToken === DEMO_TOKEN;
  
  // For demo access, skip all authentication (rateLimitMiddleware already handled JWT auth)
  let isPaidUser = isDemoAccess;
  
  if (isDemoAccess) {
    console.log("Demo access granted with valid demo token");
  } else {
    // JWT authentication was already handled by rateLimitMiddleware
    // If we reach here, the user is authenticated and has a valid subscription
      isPaidUser = true;
    console.log("JWT authentication successful via rate limit middleware");
  }

  try {
    // Clean the query by removing punctuation and special characters
    const cleanedQuery = userQuery.replace(/[^\w\s]/g, '').toLowerCase();
    console.log(`Cleaned query for asset detection: "${cleanedQuery}"`);
    
    // Detect asset from query
    let asset = await detectAsset(cleanedQuery);
    
    // If client specified an asset, use it instead
    if (explicitAsset) {
      console.log(`Client specified asset: ${explicitAsset}`);
      
      // Create a basic asset object
      asset = {
        id: explicitAsset,
        name: explicitAsset,
        symbol: explicitAsset.toUpperCase(),
        type: 'stock'
      };
    }
    
    // If no asset detected, use a default
    if (!asset) {
      console.log("No asset detected, using default");
      asset = {
        id: "BTC",
        name: "Bitcoin",
        symbol: "BTC",
        type: "crypto"
      };
    }
    
    // Load our indices and commodities lists for asset identification
    let indicesList = [];
    let commoditiesList = [];
    
    try {
      const indicesData = fs.readFileSync('data/indices.json', 'utf8');
      indicesList = JSON.parse(indicesData);
      console.log(`Loaded ${indicesList.length} indices for reference`);
    } catch (err) {
      console.error('Error loading indices data:', err.message);
    }
    
    try {
      const commoditiesData = fs.readFileSync('data/commodities.json', 'utf8');
      commoditiesList = JSON.parse(commoditiesData);
      console.log(`Loaded ${commoditiesList.length} commodities for reference`);
    } catch (err) {
      console.error('Error loading commodities data:', err.message);
    }
    
    // Identify if the asset is an index or commodity
    if (asset && asset.symbol) {
      // Load all asset lists for comprehensive identification
      let stocksList = [];
      let forexList = [];
      let cryptoList = [];
      
      try {
        const stocksData = fs.readFileSync('data/stocks.json', 'utf8');
        stocksList = JSON.parse(stocksData);
        console.log(`Loaded ${stocksList.tickers ? stocksList.tickers.length : 0} stocks for reference`);
      } catch (err) {
        console.error('Error loading stocks data:', err.message);
      }
      
      // Check if it's a stock
      let matchingStock = false;
      
      if (stocksList && stocksList.tickers && Array.isArray(stocksList.tickers)) {
        // Simple match - exact symbol
        matchingStock = stocksList.tickers.includes(asset.symbol);
        
        if (!matchingStock && asset.symbol.length > 1) {
          // Case-insensitive match
          matchingStock = stocksList.tickers.some(ticker => 
            ticker.toLowerCase() === asset.symbol.toLowerCase()
          );
        }
      }
      
      if (matchingStock && !asset.type) {
        asset.type = 'stock';
        console.log(`Identified asset as stock: ${asset.symbol}`);
        
        // Symbol is already correct as it matched directly with the ticker list
        // No need to update it
      }
      
      try {
        const forexData = fs.readFileSync('data/forex.json', 'utf8');
        forexList = JSON.parse(forexData);
        console.log(`Loaded ${forexList.length} forex pairs for reference`);
      } catch (err) {
        console.error('Error loading forex data:', err.message);
      }
      
      try {
        const cryptoData = fs.readFileSync('data/crypto.json', 'utf8');
        cryptoList = JSON.parse(cryptoData);
        console.log(`Loaded ${cryptoList.length} cryptocurrencies for reference`);
      } catch (err) {
        console.error('Error loading crypto data:', err.message);
      }
      
      // Check if it's an index
      const matchingIndex = indicesList.find(
        idx => idx.symbol === asset.symbol || 
               idx.symbol === `^${asset.symbol}` || 
               asset.symbol === `^${idx.symbol}` ||
               (idx.name && asset.name && idx.name.toLowerCase().includes(asset.name.toLowerCase()))
      );
      
      if (matchingIndex) {
        asset.type = 'index';
        console.log(`Identified asset as index: ${asset.symbol}`);
        
        // Ensure the symbol matches what's in our database if needed
        if (asset.symbol !== matchingIndex.symbol && !asset.symbol.startsWith('^')) {
          console.log(`Updating index symbol from ${asset.symbol} to ${matchingIndex.symbol}`);
          asset.symbol = matchingIndex.symbol;
        }
      }
      
      // Check if it's a commodity
      const matchingCommodity = commoditiesList.find(
        comm => comm.symbol === asset.symbol || 
                (comm.name && asset.name && comm.name.toLowerCase().includes(asset.name.toLowerCase()))
      );
      
      if (matchingCommodity) {
        asset.type = 'commodity';
        console.log(`Identified asset as commodity: ${asset.symbol}`);
        
        // Ensure the symbol matches what's in our database if needed
        if (asset.symbol !== matchingCommodity.symbol) {
          console.log(`Updating commodity symbol from ${asset.symbol} to ${matchingCommodity.symbol}`);
          asset.symbol = matchingCommodity.symbol;
        }
      }
      
      // Check if it's a forex pair
      const matchingForex = forexList.find(
        forex => {
          // Check direct symbol match
          if (forex.symbol === asset.symbol) {
            return true;
          }
          
          // Check if currency pair matches in any format
          // e.g., "EURUSD" or "EUR/USD" or "EUR-USD"
          const cleanAssetSymbol = asset.symbol.replace(/[\/\-]/, '').toUpperCase();
          const cleanForexSymbol = forex.symbol.replace(/[\/\-]/, '').toUpperCase();
          
          if (cleanAssetSymbol === cleanForexSymbol) {
            return true;
          }
          
          // Check if currency pair matches in reverse order
          // e.g., "USDEUR" for a "EURUSD" entry
          const reversedForexSymbol = `${forex.toCurrency}${forex.fromCurrency}`;
          if (cleanAssetSymbol === reversedForexSymbol) {
            return true;
          }
          
          return false;
        }
      );
      
      if (matchingForex && !asset.type) {
        asset.type = 'forex';
        console.log(`Identified asset as forex pair: ${asset.symbol}`);
        
        // Ensure the symbol matches what's in our database if needed
        if (asset.symbol !== matchingForex.symbol) {
          console.log(`Updating forex symbol from ${asset.symbol} to ${matchingForex.symbol}`);
          asset.symbol = matchingForex.symbol;
        }
      }
      
      // Check if it's a cryptocurrency
      const matchingCrypto = cryptoList.find(
        crypto => {
          if (!crypto.symbol) return false;
          
          // Extract the actual crypto symbol from formats like "BTCUSD" (BTC)
          const cryptoSymbol = crypto.symbol.replace(/USD$/, '');
          
          return cryptoSymbol === asset.symbol || 
                asset.symbol === crypto.symbol ||
                (crypto.name && asset.name && 
                 crypto.name.toLowerCase().includes(asset.name.toLowerCase()));
        }
      );
      
      if (matchingCrypto && !asset.type) {
        asset.type = 'crypto';
        console.log(`Identified asset as cryptocurrency: ${asset.symbol}`);
        
        // Ensure the symbol matches what's in our database if needed
        const cryptoSymbol = matchingCrypto.symbol.replace(/USD$/, '');
        if (asset.symbol !== cryptoSymbol && asset.symbol !== matchingCrypto.symbol) {
          console.log(`Updating crypto symbol from ${asset.symbol} to ${cryptoSymbol}`);
          asset.symbol = cryptoSymbol;
        }
      }
    }
    
    // Get asset data
    let assetPrice = "0.00";
    let financialInsights = { keyPoints: [], riskFactors: [], marketTrends: [], qaData: [] };
    let priceData = [];
    
              try {
      // For crypto assets, always use the crypto quotes endpoint for most reliable data
      if (isCryptoAsset(asset)) {
        // Use our dedicated crypto price function for reliable data
        const cryptoPrice = await getCryptoPrice(asset);
        if (cryptoPrice) {
          assetPrice = cryptoPrice.price;
          asset.priceSource = cryptoPrice.source;
        }
      }
      
      // For non-crypto assets or if crypto price lookup failed, get it from the standard price function
      if (assetPrice === "0.00" || !assetPrice) {
        // Use the standard price function which works for all asset types
        const priceResult = await getAssetPrice(asset);
        assetPrice = priceResult.price;
        // Store price source at a higher scope so it can be used later
        asset.priceSource = priceResult.source || 'unknown';
        console.log(`Got verified price for ${asset.symbol}: ${assetPrice} (Source: ${asset.priceSource})`);
      }

      // Get historical price data with caching
      priceData = await getHistoricalPrices(asset, isCryptoAsset(asset));
      
      // If we have both current price and historical data, check if they make sense together
      if (priceData.length > 0 && assetPrice) {
        const currentPriceValue = parseFloat(assetPrice);
        const lastHistoricalPrice = priceData[priceData.length - 1][1];
        
        // Log the price comparison but DON'T scale - scaling leads to incorrect data
        if (Math.abs(currentPriceValue - lastHistoricalPrice) / lastHistoricalPrice > 0.05) {
          console.log(`WARNING: Current price (${currentPriceValue}) differs significantly from historical data (${lastHistoricalPrice})`);
          
          // For crypto assets, historical data is more reliable than potentially wrong symbol matching
          if (isCryptoAsset(asset)) {
            console.log(`For cryptocurrency assets, using historical price (${lastHistoricalPrice}) instead of potentially incorrect current price`);
            assetPrice = lastHistoricalPrice.toString();
          }
        }
      }
    } catch (priceError) {
      console.error(`Error getting price data:`, priceError.message);
      // Generate fallback data
      priceData = [];
      
      // Set base price based on asset type and symbol
      let basePrice = 100; // Default for stocks
      
      if (asset.type && asset.type.toLowerCase().includes('crypto')) {
        // Use more realistic values for popular cryptocurrencies
        switch(asset.symbol) {
            case 'BTC': basePrice = 103840; break;
            case 'ETH': basePrice = 3300; break;
            case 'SOL': basePrice = 165; break;
            case 'DOGE': basePrice = 0.17; break;
            case 'ADA': basePrice = 0.45; break;
            default: basePrice = 1000; // Generic crypto value
        }
      }
      
      // Use the actual fetched asset price if available
      if (assetPrice && parseFloat(assetPrice) > 0) {
        basePrice = parseFloat(assetPrice);
      }
      
      const now = new Date();
      const volatility = asset.type && asset.type.toLowerCase().includes('crypto') ? 0.10 : 0.05;
      
      // Generate more realistic historical data
      let currentPrice = basePrice * 0.7; // Start 30% lower than current price
      
      for (let i = 100; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Add some randomness but maintain an overall upward trend
        const randomChange = (Math.random() * volatility * 2) - volatility;
        const trendFactor = 0.003; // Gradual upward trend
        
        currentPrice = currentPrice * (1 + randomChange + trendFactor);
        
        priceData.push([
          date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          currentPrice
        ]);
      }
      
      // Make sure the last price matches our current price
      priceData[priceData.length - 1][1] = basePrice;
      assetPrice = basePrice.toString();
    }
    
    // We no longer need to fetch enhanced financial data separately since we use our specialized functions
    
    const tweets = await getTwitterSentiment(asset);
    
    // Preliminary sentiment analysis
    const preliminarySentiment = await analyzeSentiment(tweets, isPaidUser);
    
    // Enhance asset object with financial insights
    const enhancedAsset = {
      ...asset,
      financialInsights: financialInsights
    };
    
    // Get latest news headlines with smart caching
    const financialNews = await getFinancialNews(asset);

    // Determine if we're using significantly stale news data
    const hasStaleCachedNews = financialNews.some(item => item.cached && item.cacheAge > 3600); // 1 hour threshold
    
    // Add news info to the asset for analysis if available
    if (enhancedAsset && financialNews && financialNews.length > 0) {
        enhancedAsset.newsInfo = {
            count: financialNews.length,
            isCached: financialNews.some(item => item.cached),
            cacheAge: Math.max(...financialNews.filter(item => item.cached).map(item => item.cacheAge || 0)),
            sources: financialNews.map(item => item.source)
        };
    }
    
    // Get Gemini analysis with news context
    const geminiResponse = await getGeminiAnalysis(enhancedAsset, assetPrice, preliminarySentiment, userQuery);

    // Format the response with proper HTML
    let formattedResponse = geminiResponse.analysis;
    
    // Process news source tags
    const newsSources = ['Barron\'s', 'Investor\'s Business Daily', 'MarketWatch', 'Bloomberg', 'CNBC', 
                          'Wall Street Journal', 'Financial Times', 'Reuters', 'CoinDesk', 'CoinTelegraph', 'The Block',
                          'Forbes', 'Yahoo Finance', 'Bloomberg', 'CNBC', 'MarketWatch', 'Investor\'s Business Daily',
                          'Barron\'s', 'The Wall Street Journal', 'The New York Times', 'The Washington Post',
                          'The Guardian', 'The Economist', 'The Financial Times', 'The Wall Street Journal',
                          'The New York Times', 'The Washington Post', 'The Guardian', 'The Economist', 'The Financial Times',
                          'The Wall Street Journal', 'The New York Times', 'The Washington Post', 'The Guardian', 'The Economist', 'The Financial Times',
                          'The Wall Street Journal', 'The New York Times', 'The Washington Post', 'The Guardian', 'The Economist', 'The Financial Times','coinpedia',
                          'coindesk', 'cointelegraph', 'theblock', 'forbes', 'yahoo finance', 'bloomberg', 'cnbc', 'marketwatch', 'investor\'s business daily','newsbtc'
                        ];
    
    // Replace all instances of news source tags with properly formatted span elements
    newsSources.forEach(source => {
      const sourceRegex = new RegExp(`\\[${source}\\]`, 'g');
      formattedResponse = formattedResponse.replace(sourceRegex, 
        `<span class="news-source" data-source="${source.toLowerCase().replace(/['\s]/g, '-')}">[${source}]</span>`);
    });
    
    // Also look for Sources: section and format it properly
    const sourcesSection = formattedResponse.match(/Sources:[\s\n]+([\s\S]*?)(?=$|(?:^#))/m);
    if (sourcesSection) {
      // Extract the sources list
      const sourcesList = sourcesSection[1];
      
      // Create a simplified sources section with proper spans
      let formattedSources = '<div class="sources-section">Sources: ';
      
      // Extract all source tags
      const sourceMatches = sourcesList.match(/\[([^\]]+)\]/g);
      
      if (sourceMatches) {
        // Process each source
        sourceMatches.forEach((sourceTag, index) => {
          const sourceName = sourceTag.match(/\[([^\]]+)\]/)[1];
          const sourceKey = sourceName.toLowerCase().replace(/['\s]/g, '-');
          formattedSources += `<span class="news-source" data-source="${sourceKey}">[${sourceName}]</span>`;
          
          // Add space between sources
          if (index < sourceMatches.length - 1) {
            formattedSources += ' ';
          }
        });
        
        formattedSources += '</div>';
        
        // Replace the original sources section with the formatted one
        formattedResponse = formattedResponse.replace(sourcesSection[0], formattedSources);
      }
    }
    
    // Fix markdown formatting for titles and sections to ensure proper rendering
    formattedResponse = formattedResponse
      .replace(/^#\s+([^\n]+)/gm, '<h1>$1</h1>') // Level 1 headings
      .replace(/^##\s+([^\n]+)/gm, '<h2>$1</h2>') // Level 2 headings
      .replace(/^###\s+([^\n]+)/gm, '<h3>$1</h3>') // Level 3 headings
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic text
      .replace(/\n\n/g, '</p><p>') // Convert double newlines to paragraph breaks
      .replace(/^\s*-\s+([^\n]+)/gm, '<li>$1</li>') // Convert markdown list items to HTML list items
      .replace(/(<li>.*?<\/li>)(\s*<li>)/gs, '$1$2') // Group consecutive list items
      .replace(/(?:^|\n)(<li>.*?<\/li>)(?:\n|$)/gs, '\n<ul>$1</ul>\n') // Wrap list items in ul tags
      .replace(/<\/p>\s*<ul>/g, '</p><ul>') // Fix spacing between paragraphs and lists
      .replace(/<\/ul>\s*<p>/g, '</ul><p>'); // Fix spacing between lists and paragraphs
      
    // Ensure the response starts and ends with paragraph tags if it contains p tags
    if (formattedResponse.includes('</p>')) {
      if (!formattedResponse.startsWith('<p>')) {
        formattedResponse = '<p>' + formattedResponse;
      }
      if (!formattedResponse.endsWith('</p>')) {
        formattedResponse = formattedResponse + '</p>';
      }
    }
    
    // Remove any empty paragraphs
    formattedResponse = formattedResponse.replace(/<p>\s*<\/p>/g, '');
    
    // Ensure there's proper spacing between consecutive headings
    formattedResponse = formattedResponse.replace(/(<\/h[1-3]>)\s*(<h[1-3]>)/g, '$1<br>$2');

    // Prepare chart data for Chart.js
    const chartData = {
      type: 'line',
      data: {
        labels: Array.isArray(priceData) ? priceData.map(point => point[0]) : [], // Use month names as X-axis labels
        datasets: [{
          label: `${asset.name} Price`,
          data: Array.isArray(priceData) ? priceData.map(point => point[1]) : [], // Y-axis values
          backgroundColor: 'rgba(70, 167, 88, 0.2)',
          borderColor: '#46A758',
          borderWidth: 3,
          radius: 0, // Hide the points, show only the line
          pointHoverRadius: 5, // Show points on hover
          pointHoverBackgroundColor: '#46A758',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.3, // Add slight curve to the line for better aesthetics
          fill: true // Fill the area under the line
        }]
      },
      timestamps: Array.isArray(priceData) ? priceData.map((_, index) => {
        // Generate realistic timestamps for each data point
        const today = new Date();
        const date = new Date(today);
        date.setDate(today.getDate() - (priceData.length - 1 - index));
        return date.getTime();
      }) : [],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // Hide legend to match screenshot
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#46A758',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                // Format the price with appropriate decimal places based on the value
                const value = context.parsed.y;
                if (value >= 1000) {
                  return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
                } else if (value >= 100) {
                  return `$${value.toFixed(2)}`;
                } else if (value >= 1) {
                  return `$${value.toFixed(4)}`;
                } else {
                  return `$${value.toFixed(6)}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false, // Hide grid lines to match screenshot
              drawBorder: false
            },
            ticks: {
              color: '#ffffff',
              font: {
                size: 10
              },
              maxRotation: 0
            }
          },
          y: {
            position: 'right',
            grid: {
              color: 'rgba(255, 255, 255, 0.1)',
              drawBorder: false
            },
            ticks: {
              color: '#ffffff',
              font: {
                size: 10
              },
              callback: function(value) {
                // Format the y-axis ticks with appropriate decimal places based on the value
                if (value >= 1000) {
                  return `$${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
                } else if (value >= 100) {
                  return `$${value.toFixed(0)}`;
                } else if (value >= 1) {
                  return `$${value.toFixed(2)}`;
                } else {
                  return `$${value.toFixed(4)}`;
                }
              }
            }
          }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        elements: {
          point: {
            radius: 0, // Hide points by default
            hoverRadius: 5 // Show on hover
          }
        }
      }
    };

    // Ensure chart data is valid
    if (!priceData || !Array.isArray(priceData) || priceData.length < 2 || !chartData.data.labels || chartData.data.labels.length < 2) {
      console.log('Invalid or insufficient price data, generating fallback chart data');
      // Generate fallback chart data with at least 2 points
      const fallbackData = generateSyntheticPriceData(asset);
      chartData.data.labels = fallbackData.map(point => point[0]);
      chartData.data.datasets[0].data = fallbackData.map(point => point[1]);
      
      // Also update timestamps for fallback data
      chartData.timestamps = fallbackData.map((_, index) => {
        const today = new Date();
        const date = new Date(today);
        date.setDate(today.getDate() - (fallbackData.length - 1 - index));
        return date.getTime();
      });
      
      // Mark as synthetic data
      chartData.source = 'synthetic';
    } else {
      // Mark the source appropriately in the response
      chartData.source = asset.priceSource || 'api';
    }

    // Calculate a realistic price change percentage
    const priceChangePercentage = asset.priceChange24h || 
      (priceData.length >= 2 ? 
        ((priceData[priceData.length - 1][1] - priceData[priceData.length - 2][1]) / 
        priceData[priceData.length - 2][1] * 100) : 
        (Math.random() * 10 - 5)); // Fallback to random between -5% and +5%

    // Build the response object
    const responseData = {
      question: userQuery,
      results: [
        {
          asset: {
            name: asset.name,
            symbol: asset.symbol,
            type: asset.type,
            price: assetPrice
          },
          asset_price: assetPrice,
          chart: chartData,
          social_sentiment: preliminarySentiment.sentiment ? preliminarySentiment.sentiment : "Neutral",
          analysis: formattedResponse,
          price_change_percentage: priceChangePercentage,
          // Add user action options
          actions: {
            can_save: true,
            can_share: true,
            result_id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
            saved: false
          },
          // Add UI display options for action buttons
          ui_options: {
            show_save_button: true,
            show_share_button: true,
            save_button_text: "Save Analysis",
            share_button_text: "Share Analysis",
            save_button_icon: "bookmark",
            share_button_icon: "share"
          }
        }
      ],
      // Process news to remove any HTML tags in description
      news: financialNews.map(article => ({
        ...article,
        description: article.description ? stripHtmlAndDecodeEntities(article.description) : "No description available."
      })),
      timestamp: new Date().toISOString()
    };

    // Get enhanced financial data and add price information to the response if available
    try {
      const enhancedFinancialData = await getEnhancedFinancialData(asset);
      if (enhancedFinancialData && enhancedFinancialData.price) {
        // Add current price data to the result for more accurate display
        responseData.results[0].current_price = enhancedFinancialData.price;
        
        console.log(`Added enhanced price data for ${asset.symbol} from FMP`);
      }
    } catch (e) {
      console.error(`Error adding enhanced price data to response: ${e.message}`);
    }

    // If it's a token with DexScreener data, add additional information
    if (asset.dexInfo) {
      responseData.results[0].asset = {
        ...responseData.results[0].asset,
        priceUsd: asset.priceUsd,
        priceNative: asset.priceNative,
        volume24h: asset.volume24h,
        priceChange24h: asset.priceChange24h,
        liquidity: asset.liquidity,
        marketCap: asset.marketCap,
        dexInfo: {
          dexId: asset.dexInfo.dexId,
          pairAddress: asset.dexInfo.pairAddress,
          chainId: asset.dexInfo.chainId,
          url: asset.dexInfo.url,
          quoteToken: asset.dexInfo.quoteToken,
          info: asset.dexInfo.info
        }
      };
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error processing sentiment request:", error);
    res.status(500).json({
      error: "Failed to process request",
      message: error.message
    });
  }
});

app.post('/api/profiles', async (req, res) => {
  const origin = req.get('origin') || req.get('referer') || '';
  const { profileId, timestamp, hash } = req.body;
  const subscriptionId = getSubscriptionId(req);
  console.log('Request origin:', origin);
  
  // List of allowed domains
  const allowedDomains = [
      'https://dipped.me',
      'https://www.dipped.me',
      'https://koyn.finance',
      'https://www.koyn.finance',
      'http://167.71.16.134'
  ];
  
  // In development, also allow localhost
  if (process.env.NODE_ENV === 'development') {
      allowedDomains.push('http://localhost:3000', 'http://localhost:5173');
  }
  
  // Check if the request is coming from an allowed domain
  const isAllowedOrigin = allowedDomains.some(domain => origin.startsWith(domain));
  
  if (!isAllowedOrigin) {
      console.warn('Unauthorized request from origin:', origin);
      return res.status(403).json({
          success: false,
          error: 'Unauthorized request origin'
      });
  }
    
  
    // Validate parameters
    if (!profileId) {
      return res.status(400).json({ 
        status: {
          code: 400,
          message: 'Missing profileId parameter'
        },
        data: null
      });
    }

    // For NewsCarousel and general website display from allowed domains, allow access without subscription
    // Only require subscription for advanced profile analytics or extensive usage
    const isGeneralProfileRequest = isAllowedOrigin && profileId;
    
    if (!isGeneralProfileRequest && !subscriptionId) {
      return res.status(401).json({
        status: {
          code: 401,
          message: "Valid subscription is required for advanced profile access"
        },
        data: null,
        subscription_required: true,
        action: "Please subscribe or sign in to access detailed profile data"
      });
    }

    // Check subscription status in database only if subscription is provided
    if (subscriptionId) {
      const hasValidSubscription = isSubscriptionActive(subscriptionId);
      if (!hasValidSubscription) {
        console.log(`Profiles access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
        return res.status(401).json({
          status: {
            code: 401,
            message: "Invalid or inactive subscription"
          },
          data: null,
          subscription_required: true,
          action: "Please renew your subscription to access profile data"
        });
      }
      console.log(`Profiles access granted for subscription ID: ${subscriptionId}`);
    } else {
      console.log(`General profile access granted for domain: ${origin}`);
    }
  
    try {
      let result;
      let responseStatus = 200;
      let nitterAvailable = true;
      
      try {
        // Fetch RSS feed with profileId
        const response = await axios.get(`http://localhost:8080/${profileId}/rss`, { timeout: 5000 });
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true
        });
      
        // Parse XML to JSON
        result = await parser.parseStringPromise(response.data);
        responseStatus = response.status;
        console.log('Successfully fetched profile data from X');
      } catch (nitterError) {
        console.error('Error fetching data from Nitter, using fallback data:', nitterError.message);
        nitterAvailable = false;
        
        // Create fallback data
        result = {
          rss: {
            channel: {
              title: profileId,
              link: `https://x.com/${profileId}`,
              description: `Profile of ${profileId}`,
              language: 'en-us',
              image: {
                title: profileId,
                link: `https://x.com/${profileId}`,
                url: '',
                width: '128',
                height: '128'
              },
              'twitter:profile': {
                'twitter:banner': '',
                'twitter:followers': '0',
                'twitter:following': '0',
                'twitter:tweets': '0',
                'twitter:likes': '0',
                'twitter:joined': 'Unknown',
                'twitter:location': '',
                'twitter:website': '',
                'twitter:bio': `This is a fallback profile for ${profileId}`,
                'twitter:verified': 'false',
                'twitter:protected': 'false'
              },
              item: []
            }
          }
        };
      }

      console.log('profile items:', result.rss?.channel?.item ? 'available' : 'not available');
      
      // Extract Twitter profile specific data if available
      const twitterProfile = result.rss?.channel?.['twitter:profile'] || {};
      
      // Transform the data structure and strip HTML
      const responseData = {
        status: {
          code: responseStatus,
          message: nitterAvailable ? 'Success' : 'Using fallback data - Nitter unavailable',
          timestamp: new Date().toISOString()
        },
        data: {
          metadata: {
            title: stripHtmlAndDecodeEntities(result.rss?.channel?.title || profileId),
            link: result.rss?.channel?.link || `https://x.com/${profileId}`,
            description: stripHtmlAndDecodeEntities(result.rss?.channel?.description || `Profile of ${profileId}`),
            language: result.rss?.channel?.language || 'en-us',
            image: result.rss?.channel?.image || {
              title: profileId,
              link: `https://x.com/${profileId}`,
              url: '',
              width: '128',
              height: '128'
            },
            // Add banner URL if available
            banner: twitterProfile?.['twitter:banner'] || '',
            // Add stats with default values if not available
            stats: {
              followers: parseInt(twitterProfile?.['twitter:followers'] || '0'),
              following: parseInt(twitterProfile?.['twitter:following'] || '0'),
              tweets: parseInt(twitterProfile?.['twitter:tweets'] || '0'),
              likes: parseInt(twitterProfile?.['twitter:likes'] || '0')
            },
            // Add profile details with default values if not available
            profile: {
              joined: twitterProfile?.['twitter:joined'] || '',
              location: twitterProfile?.['twitter:location'] || '',
              website: twitterProfile?.['twitter:website'] || '',
              bio: formatTweetContent(twitterProfile?.['twitter:bio'] || `Profile of ${profileId}`),
              verified: twitterProfile?.['twitter:verified'] === 'true',
              isProtected: twitterProfile?.['twitter:protected'] === 'true'
            }
          },
          items: Array.isArray(result.rss?.channel?.item) 
            ? result.rss.channel.item.map(item => ({
                title: stripHtmlAndDecodeEntities(item.title),
                creator: stripHtmlAndDecodeEntities(item['dc:creator']),
                description: formatTweetContent(item.description),
                pubDate: item.pubDate,
                guid: item.guid,
                link: item.link
              }))
            : [] // Handle case where there are no items
        }
      };
      
      // Get sentiment for each item if items exist
      if (responseData.data.items.length > 0) {
        try {
          const sentiment = await analyzeSentiment(responseData.data.items);
          responseData.data.items = responseData.data.items.map(item => ({
            ...item,
            sentiment: sentiment[item.title]
          }));
        } catch (sentimentError) {
          console.error('Error analyzing sentiment:', sentimentError);
          // Continue without sentiment analysis
        }
      }
  
      res.json(responseData);
    } catch (error) {
      console.error('Error in profiles endpoint:', error);
      res.status(500).json({ 
        status: {
          code: error.response?.status || 500,
          message: 'Failed to process profile data',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        data: null
      });
    }
  });
  
  app.post('/api/search', async (req, res) => {
    const { query, timestamp, hash, limit = 20, page = 1 } = req.body;
  
    // Validate parameters
    if (!query) {
      return res.status(400).json({ 
        status: {
          code: 400,
          message: 'Missing search query parameter'
        },
        data: null
      });
    }
  
    try {
      // Calculate how many pages we need to fetch to reach the desired limit
      const pagesToFetch = Math.ceil(limit / 20);
      let allItems = [];
      let currentPage = 1;
  
      // Fetch RSS feed with search query for each page
      while (currentPage <= pagesToFetch) {
        const response = await axios.get(`http://localhost:8080/search/rss`, {
          params: {
            f: 'tweets',
            q: query,
            p: currentPage // Add page parameter
          }
        });
        
        const parser = new xml2js.Parser({
          explicitArray: false,
          mergeAttrs: true
        });
  
        // Parse XML to JSON
        const result = await parser.parseStringPromise(response.data);
        
        // Add items from this page to our collection
        if (result.rss.channel.item) {
          const items = Array.isArray(result.rss.channel.item) ? 
            result.rss.channel.item : [result.rss.channel.item];
          allItems = allItems.concat(items);
        }
  
        currentPage++;
  
        // If we've collected enough items, stop fetching more pages
        if (allItems.length >= limit) {
          break;
        }
      }
  
      // Trim to exact limit if we got more items than requested
      allItems = allItems.slice(0, limit);
      
      // Transform the data structure and strip HTML
      const responseData = {
        status: {
          code: 200,
          message: 'Success',
          timestamp: new Date().toISOString(),
          query,
          limit,
          totalResults: allItems.length,
          page
        },
        data: {
          metadata: {
            title: `Search results for "${query}"`,
            link: `/search?q=${encodeURIComponent(query)}`,
            description: `Search results for "${query}"`,
            language: "en-us"
          },
          items: allItems.map(item => ({
            title: stripHtmlAndDecodeEntities(item.title),
            creator: stripHtmlAndDecodeEntities(item['dc:creator']),
            description: stripHtmlAndDecodeEntities(item.description),
            pubDate: item.pubDate,
            guid: item.guid,
            link: item.link,
            hashtags: extractHashtags(item.description + ' ' + item.title)
          }))
        }
      };
  
      res.json(responseData);
    } catch (error) {
      console.error('Error fetching or parsing RSS feed:', error);
      res.status(500).json({ 
        status: {
          code: error.response?.status || 500,
          message: 'Failed to fetch or parse RSS feed',
          error: error.message,
          timestamp: new Date().toISOString(),
          query
        },
        data: null
      });
    }
  });

// Financial dataset endpoints
app.get('/api/financial-qa', async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: {
          code: 400,
          message: 'Missing required parameter: query',
          timestamp: new Date().toISOString()
        },
        data: null
      });
    }
    
    // Use FMP API to get relevant financial data
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    const symbol = query.match(/[A-Z]{1,5}/)?.[0] || '';
    
    let results = [];
    
    if (symbol) {
      try {
        // Get company profile info as QA data
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol}`, {
          params: { apikey: apiKey }
        });
        
        if (response.data && response.data.length > 0) {
          const profile = response.data[0];
          
          results = [
            { question: `What does ${symbol} do?`, answer: profile.description || 'No information available' },
            { question: `What sector is ${symbol} in?`, answer: profile.sector || 'Unknown' },
            { question: `What is ${symbol}'s market cap?`, answer: profile.mktCap ? `$${(profile.mktCap/1000000000).toFixed(2)} billion` : 'Unknown' },
            { question: `Where is ${symbol} headquartered?`, answer: profile.city && profile.country ? `${profile.city}, ${profile.country}` : 'Unknown' },
            { question: `When was ${symbol} founded?`, answer: profile.ipoDate || 'Unknown' }
          ];
        }
      } catch (error) {
        console.error(`Error fetching company profile for ${symbol}:`, error.message);
      }
    }
    
    res.json({
      status: {
        code: 200,
        message: 'Financial QA data retrieved successfully',
        timestamp: new Date().toISOString(),
        query
      },
      data: results
    });
  } catch (error) {
    console.error('Error retrieving financial QA data:', error);
    res.status(500).json({
      status: {
        code: 500,
        message: 'Failed to retrieve financial QA data',
        error: error.message,
        timestamp: new Date().toISOString(),
        query: req.query.query
      },
      data: null
    });
  }
});

app.get('/api/financial-insights', async (req, res) => {
  try {
    const { asset } = req.query;
    
    if (!asset) {
      return res.status(400).json({
        status: {
          code: 400,
          message: 'Missing required parameter: asset',
          timestamp: new Date().toISOString()
        },
        data: null
      });
    }
    
    const symbol = asset.toUpperCase();
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    // Create default insights structure
    const insights = {
      keyPoints: [],
      riskFactors: [],
      marketTrends: [],
      qaData: []
    };
    
    // Get key metrics and company profile
    try {
      const [metricsResponse, profileResponse, ratiosResponse] = await Promise.allSettled([
        axios.get(`https://financialmodelingprep.com/stable/key-metrics/${symbol}`, {
          params: { apikey: apiKey, limit: 1 }
        }),
        axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol}`, {
          params: { apikey: apiKey }
        }),
        axios.get(`https://financialmodelingprep.com/stable/ratios/${symbol}`, {
          params: { apikey: apiKey, limit: 1 }
        })
      ]);
      
      // Process key metrics
      if (metricsResponse.status === 'fulfilled' && 
          metricsResponse.value.data && 
          Array.isArray(metricsResponse.value.data) &&
          metricsResponse.value.data.length > 0) {
        
        const metrics = metricsResponse.value.data[0];
        
        // Add key points
        if (metrics.peRatio) {
          insights.keyPoints.push(`P/E Ratio: ${metrics.peRatio.toFixed(2)}`);
        }
        if (metrics.pbRatio) {
          insights.keyPoints.push(`P/B Ratio: ${metrics.pbRatio.toFixed(2)}`);
        }
        if (metrics.debtToEquity) {
          insights.keyPoints.push(`Debt to Equity: ${metrics.debtToEquity.toFixed(2)}`);
        }
      }
      
      // Process company profile
      if (profileResponse.status === 'fulfilled' && 
          profileResponse.value.data && 
          Array.isArray(profileResponse.value.data) &&
          profileResponse.value.data.length > 0) {
        
        const profile = profileResponse.value.data[0];
        
        // Add description as a key point
        if (profile.description) {
          insights.keyPoints.push(`Company Description: ${profile.description}`);
        }
        
        // Add sector and industry as market trends
        if (profile.sector) {
          insights.marketTrends.push(`Sector: ${profile.sector}`);
        }
        if (profile.industry) {
          insights.marketTrends.push(`Industry: ${profile.industry}`);
        }
        
        // Add beta as risk factor if high
        if (profile.beta && profile.beta > 1.5) {
          insights.riskFactors.push(`High Market Volatility: Beta of ${profile.beta.toFixed(2)}`);
        }
      }
      
      // Process financial ratios
      if (ratiosResponse.status === 'fulfilled' && 
          ratiosResponse.value.data && 
          Array.isArray(ratiosResponse.value.data) &&
          ratiosResponse.value.data.length > 0) {
        
        const ratios = ratiosResponse.value.data[0];
        
        // Add profitability metrics as key points
        if (ratios.returnOnEquity) {
          insights.keyPoints.push(`Return on Equity: ${(ratios.returnOnEquity * 100).toFixed(2)}%`);
        }
        if (ratios.returnOnAssets) {
          insights.keyPoints.push(`Return on Assets: ${(ratios.returnOnAssets * 100).toFixed(2)}%`);
        }
        
        // Add debt metrics as risk factors
        if (ratios.debtRatio && ratios.debtRatio > 0.6) {
          insights.riskFactors.push(`High Debt Ratio: ${(ratios.debtRatio * 100).toFixed(2)}%`);
        }
      }
    } catch (error) {
      console.error(`Error fetching financial metrics for ${symbol}:`, error.message);
    }
    
    res.json({
      status: {
        code: 200,
        message: 'Financial insights retrieved successfully',
        timestamp: new Date().toISOString(),
        asset
      },
      data: insights
    });
  } catch (error) {
    console.error('Error retrieving financial insights:', error);
    res.status(500).json({
      status: {
        code: 500,
        message: 'Failed to retrieve financial insights',
        error: error.message,
        timestamp: new Date().toISOString(),
        asset: req.query.asset
      },
      data: null
    });
  }
});

// Replace the last section with a more robust server setup
// that handles both HTTP and HTTPS
let server;

// Check if SSL certificates are available
if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  try {
    // Create HTTPS server with SSL certificates
    const httpsOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };
    
    server = https.createServer(httpsOptions, app);
    console.log('Starting server with HTTPS...');
  } catch (error) {
    console.error('Error starting HTTPS server:', error.message);
    console.log('Falling back to HTTP server');
    server = http.createServer(app);
  }
} else {
  // Create HTTP server if SSL is not available
  server = http.createServer(app);
  console.log('WARNING: Starting server with HTTP (no SSL)...');
}

// Start the server
server.listen(PORT, () => { 
  console.log(`Server running on port ${PORT} - ${server instanceof https.Server ? 'HTTPS' : 'HTTP'} mode`);
  console.log(`API ready for sentiment analysis with Gemini 1.5 Pro`);
});

// Add endpoints for saving and retrieving analysis results
app.post('/api/save-result', async (req, res) => {
  try {
    const { email, resultId, result } = req.body;
    
    if (!email || !resultId || !result) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Create the data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data', 'saved-analyses');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create a file with the result ID as the filename
    const filePath = path.join(dataDir, `${resultId}.json`);
    
    // Add timestamp and user info to the result
    const saveData = {
      ...result,
      savedAt: new Date().toISOString(),
      savedBy: email
    };
    
    // Write the data to the file
    fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
    
    // Return success response
    res.json({ success: true, message: 'Analysis saved successfully' });
  } catch (error) {
    console.error('Error saving analysis:', error);
    res.status(500).json({ success: false, message: 'Error saving analysis' });
  }
});


app.get('/api/saved-results', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter (email)'
      });
    }
    
    // Get saved results for this user
    const userResultsFile = path.join(__dirname, 'data', 'saved-results', `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    
    if (!fs.existsSync(userResultsFile)) {
      return res.json({
        success: true,
        results: []
      });
    }
    
    const userResults = JSON.parse(fs.readFileSync(userResultsFile, 'utf8'));
    
    // Return the list of saved results (sorted by most recent first)
    res.json({
      success: true,
      results: userResults.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    });
  } catch (error) {
    console.error('Error retrieving saved results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve saved results',
      error: error.message
    });
  }
});

app.delete('/api/saved-result/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    const { email } = req.query;
    
    if (!email || !resultId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters (email and/or resultId)'
      });
    }
    
    // Get saved results for this user
    const userResultsFile = path.join(__dirname, 'data', 'saved-results', `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    
    if (!fs.existsSync(userResultsFile)) {
      return res.status(404).json({
        success: false,
        message: 'No saved results found for this user'
      });
    }
    
    let userResults = JSON.parse(fs.readFileSync(userResultsFile, 'utf8'));
    
    // Remove the specified result
    const initialLength = userResults.length;
    userResults = userResults.filter(item => item.resultId !== resultId);
    
    // If nothing was removed, the result wasn't found
    if (userResults.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }
    
    // Save the updated list back to file
    fs.writeFileSync(userResultsFile, JSON.stringify(userResults, null, 2));
    
    res.json({
      success: true,
      message: 'Result deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting saved result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete saved result',
      error: error.message
    });
  }
});

// Endpoint for sharing analysis results - No rate limiting for sharing
app.post('/api/share-result', async (req, res) => {
  try {
    const { resultId, result } = req.body;
    
    if (!resultId || !result) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters (resultId, result)'
      });
    }

    // Optional: Basic verification that user has access to this result
    // But don't rate limit sharing - let users share freely
    console.log(`Share result request for result ID: ${resultId}`);
    
    // Create shared results directory if it doesn't exist (in frontend public folder)
    const sharedResultsDir = path.join(__dirname, 'frontend', 'public', 'shared');
    if (!fs.existsSync(sharedResultsDir)) {
      fs.mkdirSync(sharedResultsDir, { recursive: true });
    }
    
    // Generate a unique short ID for sharing
    const shareId = crypto.randomBytes(4).toString('hex');
    
    // Save the result with the share ID
    const sharedResultFile = path.join(sharedResultsDir, `${shareId}.json`);
    fs.writeFileSync(sharedResultFile, JSON.stringify({
      resultId,
      shareId,
      result,
      sharedAt: new Date().toISOString()
    }, null, 2));
    
    // Return the share ID to be used in a sharable link
    res.json({
      success: true,
      message: 'Analysis shared successfully',
      shareId,
      shareUrl: `https://koyn.finance/app/shared/${shareId}`
    });
  } catch (error) {
    console.error('Error sharing analysis result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share analysis',
      error: error.message
    });
  }
});

// Endpoint to retrieve a shared result
app.get('/api/shared-result/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    console.log(`[SHARED-RESULT] Request received for shareId: ${shareId}`);
    
    if (!shareId) {
      console.log(`[SHARED-RESULT] Missing shareId parameter`);
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter (shareId)'
      });
    }
    
    const sharedResultFile = path.join(__dirname, 'frontend', 'public', 'shared', `${shareId}.json`);
    console.log(`[SHARED-RESULT] Looking for file: ${sharedResultFile}`);
    
    if (!fs.existsSync(sharedResultFile)) {
      console.log(`[SHARED-RESULT] File not found: ${sharedResultFile}`);
      return res.status(404).json({
        success: false,
        message: 'Shared result not found'
      });
    }
    
    console.log(`[SHARED-RESULT] File found, reading content...`);
    const sharedResult = JSON.parse(fs.readFileSync(sharedResultFile, 'utf8'));
    console.log(`[SHARED-RESULT] Successfully loaded shared result for shareId: ${shareId}`);
    
    res.json({
      success: true,
      result: sharedResult.result,
      sharedAt: sharedResult.sharedAt
    });
  } catch (error) {
    console.error('[SHARED-RESULT] Error retrieving shared result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shared result',
      error: error.message
    });
  }
});

// Subscription API endpoint to get subscription info for a user
app.get('/api/subscription/:email', async (req, res) => {
  try {
    const email = req.params.email;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    console.log(`Fetching subscription info for ${email}`);
    
    // Read from the subscriptions JSON file
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    if (!fs.existsSync(subscriptionsFilePath)) {
      return res.json({ active: false });
    }
    
    const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
    const subscriptions = JSON.parse(data);
    
    // Find the most recent active subscription for this email
    const activeSubscription = subscriptions
      .filter(sub => sub.email.toLowerCase() === email.toLowerCase() && sub.status !== 'inactive')
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
    
    if (activeSubscription) {
      return res.json({
        active: true,
        subscription: activeSubscription
      });
    } else {
      return res.json({ active: false });
    }
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook endpoint to handle subscription updates from Helio
app.post('/api/webhook/subscription', async (req, res) => {
  try {
    console.log('Received subscription webhook:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Process the webhook based on event type
    const { event, email, subscriptionId, subscriptionState, transactionObject } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get the subscription data file path
    const subscriptionsFilePath = path.join(__dirname, 'data', 'subscriptions.json');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(subscriptionsFilePath))) {
      fs.mkdirSync(path.dirname(subscriptionsFilePath), { recursive: true });
    }
    
    // Read existing subscriptions or create empty array
    let subscriptions = [];
    if (fs.existsSync(subscriptionsFilePath)) {
      const data = fs.readFileSync(subscriptionsFilePath, 'utf8');
      subscriptions = JSON.parse(data);
    }
    
    // Handle different event types
    if (event === 'STARTED') {
      // A new subscription has started
      const existingIndex = subscriptions.findIndex(
        sub => sub.email === email && sub.status === 'active'
      );
      
      // Determine plan type
      let planType = 'monthly';
      if (transactionObject?.meta?.productDetails?.name) {
        const planName = transactionObject.meta.productDetails.name.toLowerCase();
        if (planName.includes('yearly')) {
          planType = 'yearly';
        } else if (planName.includes('3') || planName.includes('three') || planName.includes('quarter')) {
          planType = 'quarterly';
        }
      }
      
      // Calculate renewal date
      const renewalDate = new Date();
      if (planType === 'yearly') {
        renewalDate.setFullYear(renewalDate.getFullYear() + 100);
      } else if (planType === 'quarterly' || planType === '3month') {
        renewalDate.setMonth(renewalDate.getMonth() + 3);
      } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      }
      
      const newSubscription = {
        id: subscriptionId,
        email,
        status: subscriptionState || 'active',
        startedAt: new Date().toISOString(),
        renewalDate: renewalDate.toISOString(),
        transactionId: transactionObject?.id || 'unknown',
        plan: planType,
        paymentMethod: 'helio',
        amount: transactionObject?.meta?.totalAmount 
          ? parseFloat(transactionObject.meta.totalAmount) / 1000000 
          : undefined,
        currency: transactionObject?.meta?.currency?.id || 'USDC'
      };
      
      if (existingIndex !== -1) {
        subscriptions[existingIndex] = {
          ...subscriptions[existingIndex],
          ...newSubscription,
          updatedAt: new Date().toISOString()
        };
      } else {
        subscriptions.push(newSubscription);
      }
      
      console.log(`Added/updated subscription for ${email}`);
    } 
    else if (event === 'RENEWED') {
      // Subscription renewed
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || (sub.email === email && sub.status === 'active')
      );
      
      if (index !== -1) {
        // Calculate new renewal date based on plan
        const renewalDate = new Date();
        const planType = subscriptions[index].plan || 'monthly';
        
        if (planType === 'yearly') {
          renewalDate.setFullYear(renewalDate.getFullYear() + 100);
        } else if (planType === 'quarterly' || planType === '3month') {
          renewalDate.setMonth(renewalDate.getMonth() + 3);
        } else {
          renewalDate.setMonth(renewalDate.getMonth() + 1);
        }
        
        subscriptions[index] = {
          ...subscriptions[index],
          status: 'active',
          renewalDate: renewalDate.toISOString(),
          renewedAt: new Date().toISOString(),
          transactionId: transactionObject?.id || subscriptions[index].transactionId,
          updatedAt: new Date().toISOString()
        };
        
        if (transactionObject?.meta?.totalAmount) {
          subscriptions[index].amount = parseFloat(transactionObject.meta.totalAmount) / 1000000;
        }
        
        console.log(`Renewed subscription for ${email}`);
      } else {
        console.log(`No subscription found to renew for ${email}`);
      }
    } 
    else if (event === 'ENDED') {
      // Subscription ended
      const index = subscriptions.findIndex(sub => 
        (sub.id === subscriptionId) || (sub.email === email && sub.status === 'active')
      );
      
      if (index !== -1) {
        subscriptions[index].status = 'inactive';
        subscriptions[index].endedAt = new Date().toISOString();
        subscriptions[index].updatedAt = new Date().toISOString();
        console.log(`Ended subscription for ${email}`);
      } else {
        console.log(`No subscription found to end for ${email}`);
      }
    }
    
    // Save updated subscriptions
    fs.writeFileSync(subscriptionsFilePath, JSON.stringify(subscriptions, null, 2));
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing subscription webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const getAssetPrice = async (asset) => {
    try {
        let priceSource = 'default'; // Track where the price came from
        const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
        
        // Format the symbol based on asset type
        let symbol = asset.symbol;
        
        // Format the symbol appropriately based on asset type
        if (isCryptoAsset(asset)) {
            // For cryptocurrencies, use our consistent helper function for formatting
            symbol = getCryptoSymbol(symbol);
            console.log(`Using crypto symbol: ${symbol}`);
        } else if (asset.type && asset.type.toLowerCase().includes('index') && !symbol.startsWith('^')) {
            // For indices, prepend ^ if needed
            symbol = `^${symbol}`;
            console.log(`Using index symbol: ${symbol}`);
        } else if (asset.type && asset.type.toLowerCase().includes('forex')) {
            // Format forex symbol (ensure it's like EURUSD)
            if (symbol.includes('/')) {
                symbol = symbol.replace('/', '');
            }
            console.log(`Using forex symbol: ${symbol}`);
        } else if (asset.type && asset.type.toLowerCase().includes('commodity')) {
            // For gold, ensure it's GCUSD
            if (symbol === 'GC' && !symbol.endsWith('USD')) {
                symbol = 'GCUSD';
            }
            console.log(`Using commodity symbol: ${symbol}`);
        }
        
        // Try the stable quote endpoint first for all asset types (most reliable)
        try {
            console.log(`Fetching price for ${symbol} using stable quote endpoint`);
            const response = await axios.get('https://financialmodelingprep.com/stable/quote', {
                params: {
                    symbol: symbol,
                    apikey: apiKey
                }
            });
            
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const price = response.data[0].price;
                
                // Verify the asset name matches what we're looking for (to avoid getting stock with same symbol)
                // For crypto, check if it has the right exchange or name
                if (asset.type && asset.type.toLowerCase().includes('crypto')) {
                    // Check if we got a crypto exchange or if the name includes the asset name
                    const isCryptoResult = response.data[0].exchange === 'CRYPTO' || 
                                          response.data[0].name.toLowerCase().includes('usd') ||
                                          response.data[0].name.toLowerCase().includes(asset.name.toLowerCase());
                    
                    // Log detailed info for troubleshooting
                    if (!isCryptoResult) {
                        console.log(`WARNING: Got non-crypto result for ${symbol}:`);
                        console.log(`  - Exchange: ${response.data[0].exchange}`);
                        console.log(`  - Name: ${response.data[0].name}`);
                        console.log(`  - Asset we were looking for: ${asset.name} (${asset.symbol})`);
                        
                        // Try falling back to the crypto quotes endpoint which is more reliable for crypto
                        console.log(`Falling back to crypto quotes endpoint for ${asset.symbol}`);
                        try {
                            const cryptoResponse = await axios.get('https://financialmodelingprep.com/api/v3/quotes/crypto', {
                                params: {
                                    apikey: apiKey
                                }
                            });
                            
                            if (cryptoResponse.data && Array.isArray(cryptoResponse.data)) {
                                // Find our symbol in the crypto quotes response
                                const cryptoData = cryptoResponse.data.find(crypto => 
                                    crypto.symbol === symbol || 
                                    crypto.symbol === `${asset.symbol}USD`);
                                
                                if (cryptoData) {
                                    console.log(`Found ${asset.symbol} in crypto quotes: ${cryptoData.price}`);
                                    return {
                                        price: cryptoData.price.toString(),
                                        source: 'FMP Crypto Quotes API',
                                        change: cryptoData.change,
                                        changePercentage: cryptoData.changesPercentage,
                                        dayHigh: cryptoData.dayHigh,
                                        dayLow: cryptoData.dayLow,
                                        exchange: cryptoData.exchange
                                    };
                                }
                            }
                        } catch (err) {
                            console.error(`Error fetching from crypto quotes endpoint: ${err.message}`);
                        }
                    }
                }
                
                console.log(`Got price for ${symbol} from FMP stable API: ${price}`);
                priceSource = 'FMP Stable API';
                return {
                    price: price.toString(),
                    source: priceSource,
                    change: response.data[0].change,
                    changePercentage: response.data[0].changePercentage,
                    dayHigh: response.data[0].dayHigh,
                    dayLow: response.data[0].dayLow,
                    exchange: response.data[0].exchange
                };
            } else {
                console.log(`No data returned from stable quote endpoint for ${symbol}`);
            }
        } catch (error) {
            console.error(`Error fetching price from FMP stable API for ${symbol}:`, error.message);
            // Continue to fallback
        }
        
        // Fallback to regular API endpoint
        try {
            console.log(`Fallback: Fetching price for ${symbol} using regular API endpoint`);
            const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}`, {
                params: {
                    apikey: apiKey
                }
            });
            
            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                const price = response.data[0].price;
                console.log(`Got price for ${symbol} from FMP API fallback: ${price}`);
                priceSource = 'FMP API';
                return {
                    price: price.toString(),
                    source: priceSource,
                    change: response.data[0].change,
                    changePercentage: response.data[0].changesPercentage,
                    dayHigh: response.data[0].dayHigh,
                    dayLow: response.data[0].dayLow
                };
            }
        } catch (fallbackError) {
            console.error(`Fallback API also failed for ${symbol}:`, fallbackError.message);
        }
        
        // If all API calls fail, use a default price
        const defaultPrice = getDefaultPrice(asset);
        console.log(`Using default fallback price for ${asset.symbol}: ${defaultPrice}`);
        
        return {
            price: defaultPrice,
            source: 'synthetic'
        };
    } catch (error) {
        console.error('FMP API price fetch failed:', error.message);
        const defaultPrice = getDefaultPrice(asset);
        return {
            price: defaultPrice,
            source: 'synthetic'
        };
    }
};

// Helper function to get default prices for different asset types
const getDefaultPrice = (asset) => {
    const assetType = asset.type ? asset.type.toLowerCase() : 'unknown';
    const symbol = asset.symbol ? asset.symbol.toUpperCase() : '';
    
    // Fallback values for cryptocurrencies
    if (assetType.includes('crypto')) {
        const defaultCryptoPrices = {
            'BTC': '103840',
            'ETH': '3300',
            'SOL': '165',
            'DOGE': '0.17',
            'ADA': '0.45',
            'XRP': '0.61',
            'AVAX': '22.50',
            'LINK': '14.80',
            'MATIC': '0.57',
            'DOT': '6.30'
        };
        
        if (defaultCryptoPrices[symbol]) {
            console.log(`Using default price for ${symbol}: $${defaultCryptoPrices[symbol]}`);
            return defaultCryptoPrices[symbol];
        }
        
        return '1000.00'; // Generic crypto fallback
    }
    
    // Fallback values for indices
    if (assetType.includes('index')) {
        const defaultIndices = {
            'SPX': '5500.50',  // S&P 500
            'DJI': '41000.75', // Dow Jones
            'IXIC': '17800.25', // NASDAQ
            'RUT': '2180.40',  // Russell 2000
            'VIX': '14.50',    // Volatility Index
            'FTSE': '8250.30', // FTSE 100
            'DAX': '18500.80', // DAX
            'NIKKEI': '38750.60' // Nikkei 225
        };
        
        // Clean up symbol to match our defaults (remove ^ if present)
        const cleanSymbol = symbol.replace('^', '');
        
        if (defaultIndices[cleanSymbol]) {
            console.log(`Using default price for index ${symbol}: $${defaultIndices[cleanSymbol]}`);
            return defaultIndices[cleanSymbol];
        }
        
        return '10000.00'; // Generic index fallback
    }
    
    // Fallback values for commodities
    if (assetType.includes('commodity')) {
        const defaultCommodities = {
            'GC': '2400.50',   // Gold
            'SI': '31.25',     // Silver
            'HG': '4.50',      // Copper
            'CL': '75.80',     // Crude Oil
            'NG': '2.15',      // Natural Gas
            'ZC': '450.75',    // Corn
            'ZW': '600.25',    // Wheat
            'ZS': '1200.50'    // Soybeans
        };
        
        if (defaultCommodities[symbol]) {
            console.log(`Using default price for commodity ${symbol}: $${defaultCommodities[symbol]}`);
            return defaultCommodities[symbol];
        }
        
        return '500.00'; // Generic commodity fallback
    }
    
    // Fallback values for forex pairs
    if (assetType.includes('forex')) {
        // Clean up symbol to ensure consistent format
        // Convert formats like "EUR/USD" or "EURUSD" to just "EURUSD"
        const cleanSymbol = symbol.replace('/', '');
        
        const defaultForexPrices = {
            'EURUSD': '1.0875',  // Euro to US Dollar
            'GBPUSD': '1.2650',  // British Pound to US Dollar
            'USDJPY': '153.80',  // US Dollar to Japanese Yen
            'USDCAD': '1.3620',  // US Dollar to Canadian Dollar
            'AUDUSD': '0.6580',  // Australian Dollar to US Dollar
            'NZDUSD': '0.6030',  // New Zealand Dollar to US Dollar
            'USDCHF': '0.9040',  // US Dollar to Swiss Franc
            'EURGBP': '0.8600',  // Euro to British Pound
            'EURJPY': '167.25',  // Euro to Japanese Yen
            'GBPJPY': '194.60'   // British Pound to Japanese Yen
        };
        
        if (defaultForexPrices[cleanSymbol]) {
            console.log(`Using default price for forex pair ${symbol}: ${defaultForexPrices[cleanSymbol]}`);
            return defaultForexPrices[cleanSymbol];
        }
        
        // If the pair contains USD, default to something reasonable
        if (cleanSymbol.includes('USD')) {
            return cleanSymbol.startsWith('USD') ? '0.9500' : '1.0500';
        }
        
        return '1.0000'; // Generic forex fallback
    }
    
    // Default for stocks and other assets
    return '100.00';
};

// Redis cache helper functions
const getCachedData = async (key) => {
  if (!redisClient) return null;
  
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
};

const setCachedData = async (key, data, ttl = 3600) => { // Default 1 hour TTL for news
  if (!redisClient) return;
  
  try {
    await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (error) {
    console.error('Error setting cached data:', error);
  }
};

// Function to fetch historical price data (no longer using caching)
const getHistoricalPrices = async (asset, isCrypto = false) => {
  // No longer using cache for asset data
  console.log(`Fetching fresh historical prices for ${asset.symbol}`);
  
  try {
    let priceData = [];
    let dataSource = ''; // Track the source of the data
    
    // Handle different asset types
    if (isCrypto || isCryptoAsset(asset)) {
      // For cryptocurrencies, use FMP historical-chart/1day endpoint
      try {
        // Use our helper to get correctly formatted crypto symbol
        const cryptoSymbol = getCryptoSymbol(asset.symbol);
        console.log(`Fetching historical crypto data for ${cryptoSymbol} using historical-chart endpoint`);
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-chart/1day/${cryptoSymbol}`, {
          params: {
            apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
            limit: 100
          }
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          priceData = response.data.map(price => ({
            date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: parseFloat(price.close),
            timestamp: new Date(price.date).getTime()
          }));
          dataSource = 'FMP API (1day)';
          console.log(`Got ${priceData.length} data points from FMP historical-chart endpoint for crypto ${cryptoSymbol}`);
        } else {
          throw new Error(`No historical data received from FMP API for ${cryptoSymbol}`);
        }
      } catch (fmpError) {
        console.error(`FMP historical-chart failed for crypto ${asset.symbol}:`, fmpError.message);
        
        // Try another endpoint as fallback
        try {
          console.log(`Trying alternative endpoint for crypto ${asset.symbol}...`);
          const cryptoSymbol = asset.symbol.endsWith('USD') ? asset.symbol : `${asset.symbol}USD`;
          
          // Try the historical-price-full endpoint
          const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/crypto/${cryptoSymbol}`, {
            params: {
              apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
              serietype: 'line',
              timeseries: 100
            }
          });
          
          if (response.data && response.data.historical && Array.isArray(response.data.historical) && response.data.historical.length > 0) {
            priceData = response.data.historical.map(price => ({
              date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: parseFloat(price.close),
              timestamp: new Date(price.date).getTime()
            }));
            dataSource = 'FMP API (historical-full)';
            console.log(`Got ${priceData.length} data points from alternative endpoint for crypto ${cryptoSymbol}`);
          } else {
            throw new Error(`Alternative endpoint also failed for ${cryptoSymbol}`);
          }
        } catch (fallbackError) {
          console.error(`All FMP endpoints failed for crypto ${asset.symbol}:`, fallbackError.message);
          throw new Error('Failed to fetch crypto historical prices from all available endpoints');
        }
      }
    } 
    else if (asset.type && asset.type.toLowerCase().includes('index')) {
      // For indices, use FMP stable API
      try {
        const indexSymbol = asset.symbol.startsWith('^') ? asset.symbol : `^${asset.symbol}`;
        const response = await axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full`, {
          params: {
            symbol: indexSymbol,
            apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
            limit: 100
          }
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          priceData = response.data.map(price => ({
            date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: parseFloat(price.close),
            timestamp: new Date(price.date).getTime()
          }));
          dataSource = 'FMP API';
          console.log(`Got ${priceData.length} data points from FMP API for index ${indexSymbol}`);
        } else {
          throw new Error(`No historical data received from FMP API for index ${indexSymbol}`);
        }
      } catch (error) {
        console.error(`Error fetching index historical prices for ${asset.symbol}:`, error.message);
        throw new Error(`Failed to fetch index historical prices: ${error.message}`);
      }
    }
    else if (asset.type && asset.type.toLowerCase().includes('commodity')) {
      // For commodities, use FMP API
      try {
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${asset.symbol}`, {
          params: {
            apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
            serietype: 'line',
            timeseries: 100
          }
        });
        
        if (response.data && response.data.historical && Array.isArray(response.data.historical) && response.data.historical.length > 0) {
          priceData = response.data.historical.map(price => ({
            date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: parseFloat(price.close),
            timestamp: new Date(price.date).getTime()
          }));
          dataSource = 'FMP API';
          console.log(`Got ${priceData.length} data points from FMP API for commodity ${asset.symbol}`);
        } else {
          throw new Error(`No historical data received from FMP API for commodity ${asset.symbol}`);
        }
      } catch (error) {
        console.error(`Error fetching commodity historical prices for ${asset.symbol}:`, error.message);
        throw new Error(`Failed to fetch commodity historical prices: ${error.message}`);
      }
    }
    else if (asset.type && asset.type.toLowerCase().includes('forex')) {
      // For forex pairs, use FMP API
      try {
        // Format the forex symbol properly for FMP API (should be like EUR/USD)
        let forexSymbol = asset.symbol;
        if (forexSymbol.length === 6) {
          // Remove any non-alphanumeric characters
          forexSymbol = forexSymbol.replace(/[^A-Z]/g, '');
        }
        
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${forexSymbol}`, {
          params: {
            apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
            serietype: 'line',
            timeseries: 100
          }
        });
        
        if (response.data && response.data.historical && Array.isArray(response.data.historical) && response.data.historical.length > 0) {
          priceData = response.data.historical.map(price => ({
            date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: parseFloat(price.close),
            timestamp: new Date(price.date).getTime()
          }));
          dataSource = 'FMP API';
          console.log(`Got ${priceData.length} data points from FMP API for forex ${forexSymbol}`);
        } else {
          throw new Error(`No historical data received from FMP API for forex ${forexSymbol}`);
        }
      } catch (error) {
        console.error(`Error fetching forex historical prices for ${asset.symbol}:`, error.message);
        
        // Try alternative endpoint for forex if first one failed
        try {
          // Try FMP's FX endpoint
          const symbolParts = asset.symbol.replace('/', '').toUpperCase();
          const fromCurrency = symbolParts.substring(0, 3);
          const toCurrency = symbolParts.substring(3, 6) || 'USD';
          
          const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/forex/${fromCurrency}${toCurrency}`, {
            params: {
              apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
              timeseries: 100
            }
          });
          
          if (response.data && response.data.historical && Array.isArray(response.data.historical) && response.data.historical.length > 0) {
            priceData = response.data.historical.map(price => ({
              date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              value: parseFloat(price.close),
              timestamp: new Date(price.date).getTime()
            }));
            dataSource = 'FMP API (Alt)';
            console.log(`Got ${priceData.length} data points from alternative FMP API for forex ${fromCurrency}${toCurrency}`);
          } else {
            throw new Error(`No historical data received from alternative FMP API for forex ${fromCurrency}${toCurrency}`);
          }
        } catch (altError) {
          console.error(`Alternative forex historical prices fetch also failed for ${asset.symbol}:`, altError.message);
          throw new Error(`Failed to fetch forex historical prices from all sources: ${altError.message}`);
        }
      }
    }
    else {
      // For stocks and other assets, use FMP API
      // First try the 4-hour historical chart endpoint
      try {
        console.log(`Trying FMP 4-hour historical chart for ${asset.symbol}`);
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-chart/4hour/${asset.symbol}`, {
          params: {
            apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9'
          }
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Successfully got 4-hour data
          console.log(`Successfully fetched ${response.data.length} 4-hour data points for ${asset.symbol}`);
          
          priceData = response.data.map(price => ({
            date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            value: parseFloat(price.close),
            timestamp: new Date(price.date).getTime()
          }));
          dataSource = 'FMP API (4H)';
        } else {
          throw new Error(`No 4-hour data found for ${asset.symbol}`);
        }
      } catch (fmpHourlyError) {
        console.log(`FMP 4-hour chart failed for ${asset.symbol}: ${fmpHourlyError.message}, trying 1-hour data`);
        
        // Try 1-hour historical chart as fallback
        try {
          console.log(`Trying FMP 1-hour historical chart for ${asset.symbol}`);
          const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-chart/1hour/${asset.symbol}`, {
            params: {
              apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9'
            }
          });
          
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            // Successfully got 1-hour data
            console.log(`Successfully fetched ${response.data.length} 1-hour data points for ${asset.symbol}`);
            
            priceData = response.data.map(price => ({
              date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              value: parseFloat(price.close),
              timestamp: new Date(price.date).getTime()
            }));
            dataSource = 'FMP API (1H)';
          } else {
            throw new Error(`No 1-hour data found for ${asset.symbol}`);
          }
        } catch (fmpHourlyFallbackError) {
          console.log(`FMP 1-hour chart failed for ${asset.symbol}: ${fmpHourlyFallbackError.message}, falling back to daily data`);
          
          // Fallback to regular historical daily data
          try {
            console.log(`Trying FMP daily historical data for ${asset.symbol}`);
            const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${asset.symbol}`, {
              params: {
                apikey: process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9',
                serietype: 'line',
                timeseries: 100
              }
            });
            
            if (response.data && response.data.historical && Array.isArray(response.data.historical) && response.data.historical.length > 0) {
              priceData = response.data.historical.map(price => ({
                date: new Date(price.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: parseFloat(price.close),
                timestamp: new Date(price.date).getTime()
              }));
              dataSource = 'FMP API (Daily)';
              console.log(`Got ${priceData.length} data points from daily FMP API for ${asset.symbol}`);
            } else {
              throw new Error(`No daily data found for ${asset.symbol}`);
            }
          } catch (fmpError) {
            console.error(`All FMP chart endpoints failed for ${asset.symbol}:`, fmpError.message);
            throw new Error(`Failed to fetch stock historical prices from all sources: ${fmpError.message}`);
          }
        }
      }
    }
    
    // If we got price data, process it for the chart
    if (priceData.length > 0) {
      // Sort by timestamp (oldest to newest)
      priceData.sort((a, b) => a.timestamp - b.timestamp);
      
      // Convert to the simplified array format for the chart
      const formattedData = priceData.map(point => [
        point.date,
        point.value
      ]);
      
      // Create the result object with data source information
      const result = {
        data: formattedData,
        source: dataSource,
        count: formattedData.length,
        symbol: asset.symbol,
        type: asset.type || 'unknown'
      };
      
      // No longer caching historical data
      
      // The chart expects an array of [date, price] pairs
      return result.data;
    }
    
    throw new Error('No historical price data available after trying all sources');
  } catch (error) {
    console.error(`Error fetching historical prices for ${asset.symbol}:`, error.message);
    
    // Generate synthetic historical data when API call fails
    const syntheticData = generateSyntheticPriceData(asset);
    
    // No longer caching synthetic data
    const syntheticResult = {
      data: syntheticData,
      source: 'synthetic',
      count: syntheticData.length,
      symbol: asset.symbol,
      type: asset.type || 'unknown'
    };
    
    console.log(`Returning ${syntheticData.length} synthetic data points for ${asset.symbol}`);
    
    // The chart still expects just the array of [date, price] pairs
    return syntheticData;
  }
};

// Helper function to generate synthetic price data when API calls fail
const generateSyntheticPriceData = (asset) => {
  console.log(`Generating synthetic price data for ${asset.symbol}`);
  
  // Get a base price to start from (either the current price or a default)
  let basePrice;
  const assetType = asset.type ? asset.type.toLowerCase() : 'unknown';
  
  if (assetType.includes('crypto')) {
    // Use more realistic values for popular cryptocurrencies
    switch(asset.symbol.toUpperCase()) {
      case 'BTC': basePrice = 103840; break;
      case 'ETH': basePrice = 3300; break;
      case 'SOL': basePrice = 165; break;
      case 'DOGE': basePrice = 0.17; break;
      case 'ADA': basePrice = 0.45; break;
      case 'XRP': basePrice = 0.61; break;
      default: basePrice = parseFloat(asset.price || '1000');
    }
  } else if (assetType.includes('index')) {
    // Use more realistic values for popular indices
    switch(asset.symbol.toUpperCase().replace('^', '')) {
      case 'SPX': basePrice = 5500; break;
      case 'DJI': basePrice = 39000; break;
      case 'IXIC': basePrice = 17800; break;
      case 'FTSE': basePrice = 8200; break;
      default: basePrice = parseFloat(asset.price || '5000');
    }
  } else if (assetType.includes('commodity')) {
    // Use more realistic values for popular commodities
    switch(asset.symbol.toUpperCase()) {
      case 'GC': basePrice = 2400; break; // Gold
      case 'SI': basePrice = 31; break;   // Silver
      case 'CL': basePrice = 75; break;   // Crude Oil
      default: basePrice = parseFloat(asset.price || '100');
    }
  } else if (assetType.includes('forex')) {
    // Use more realistic values for popular forex pairs
    const symbol = asset.symbol.replace('/', '').toUpperCase();
    switch(symbol) {
      case 'EURUSD': basePrice = 1.085; break;
      case 'GBPUSD': basePrice = 1.26; break;
      case 'USDJPY': basePrice = 154; break;
      default: basePrice = parseFloat(asset.price || '1.0');
    }
  } else {
    // For stocks, use price if available or a reasonable default
    basePrice = parseFloat(asset.price || '100');
  }
  
  // Make sure base price is a valid number
  if (isNaN(basePrice) || basePrice <= 0) {
    console.log(`Invalid base price (${basePrice}) for ${asset.symbol}, defaulting to 100`);
    basePrice = 100;
  }
  
  // Generate data for the last 90 days
  const priceData = [];
  const today = new Date();
  
  // Parameters to control the randomness and trend
  const volatility = getVolatilityByAssetType(assetType);
  
  // Generate a gradual trend to reach the current price
  // Start price is ~10-30% different from current
  const trendDirection = Math.random() > 0.5 ? 1 : -1;
  const startDiff = trendDirection * (0.1 + Math.random() * 0.2);
  let currentPrice = basePrice * (1 - startDiff);
  const targetPrice = basePrice;
  
  const dataPoints = 90; // 90 days of data
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    // Calculate date
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    // Add some randomness to the price
    const randomFactor = (Math.random() - 0.5) * volatility;
    
    // Calculate trend factor to gradually move toward target price
    // Stronger trend as we approach current day
    const progressToToday = (dataPoints - i) / dataPoints;
    const trendFactor = (targetPrice - currentPrice) * 0.05 * progressToToday;
    
    // Occasional price jumps for more realistic data
    const jumpProbability = 0.05; // 5% chance of a price jump
    const jumpFactor = Math.random() < jumpProbability ? 
      (Math.random() - 0.5) * volatility * 3 : 0;
    
    // Apply changes to current price
    const dayVariation = randomFactor * currentPrice + trendFactor + jumpFactor;
    const dayPrice = currentPrice + dayVariation;
    
    // Ensure price never goes negative
    const finalPrice = Math.max(dayPrice, 0.01);
    
    // Add the data point
    priceData.push([
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      finalPrice
    ]);
    
    // Update the price for the next iteration
    // Use slight mean reversion
    currentPrice = 0.9 * finalPrice + 0.1 * currentPrice;
  }
  
  // Ensure the last data point exactly matches the target price
  if (priceData.length > 0) {
    priceData[priceData.length - 1][1] = targetPrice;
  }
  
  return priceData;
};

// Helper function to determine appropriate volatility for different asset types
const getVolatilityByAssetType = (assetType) => {
  if (assetType.includes('crypto')) {
    return 0.05; // Higher volatility for crypto
  } else if (assetType.includes('index')) {
    return 0.01; // Lower volatility for indices
  } else if (assetType.includes('commodity')) {
    return 0.03; // Medium volatility for commodities
  } else if (assetType.includes('forex')) {
    return 0.008; // Lower volatility for forex (0.8%)
  } else {
    return 0.02; // Default volatility for stocks
  }
};

// Free Asset data API routes
app.get('/api/assets/crypto', async (req, res) => {
  try {
    const cryptoData = require('./data/crypto.json');
    res.json(cryptoData);
  } catch (error) {
    console.error('Error serving crypto asset data:', error);
    res.status(500).json({ error: 'Failed to load crypto asset data' });
  }
});

app.get('/api/assets/forex', async (req, res) => {
  try {
    const forexData = require('./data/forex.json');
    res.json(forexData);
  } catch (error) {
    console.error('Error serving forex asset data:', error);
    res.status(500).json({ error: 'Failed to load forex asset data' });
  }
});

app.get('/api/assets/stocks', async (req, res) => {
  try {
    const stocksData = require('./data/stocks.json');
    res.json(stocksData);
  } catch (error) {
    console.error('Error serving stocks asset data:', error);
    res.status(500).json({ error: 'Failed to load stocks asset data' });
  }
});

app.get('/api/assets/indices', async (req, res) => {
  try {
    const indicesData = require('./data/indices.json');
    res.json(indicesData);
  } catch (error) {
    console.error('Error serving indices asset data:', error);
    res.status(500).json({ error: 'Failed to load indices asset data' });
  }
});

app.get('/api/assets/commodities', async (req, res) => {
  try {
    const commoditiesData = require('./data/commodities.json');
    res.json(commoditiesData);
  } catch (error) {
    console.error('Error serving commodities asset data:', error);
    res.status(500).json({ error: 'Failed to load commodities asset data' });
  }
});

// Insider trading API endpoint
app.get('/api/insider-trading', async (req, res) => {
  try {
    const { symbol, limit = 100 } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    // Validate subscription for FMP API access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for insider trading data access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access insider trading data"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Insider trading access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access insider trading data"
      });
    }

    console.log(`Insider trading access granted for subscription ID: ${subscriptionId}`);
    
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    let url = 'https://financialmodelingprep.com/stable/insider-trading/latest';
    const params = { 
      page: 0,
      limit: limit,
      apikey: apiKey
    };
    
    // If a specific symbol is provided, use the symbol-specific endpoint
    if (symbol) {
      url = `https://financialmodelingprep.com/stable/insider-trading/${symbol}`;
      console.log(`Fetching insider trading data for ${symbol}`);
    } else {
      console.log('Fetching latest insider trading data');
    }
    
    const response = await axios.get(url, { params });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`Retrieved ${response.data.length} insider trading records`);
      res.json({
        success: true,
        data: response.data,
        count: response.data.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'No insider trading data found',
        message: symbol ? `No insider trading data found for ${symbol}` : 'No insider trading data available'
      });
    }
  } catch (error) {
    console.error('Error fetching insider trading data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch insider trading data',
      message: error.message
    });
  }
});

// Historical prices API endpoint
app.get('/api/historical-prices', async (req, res) => {
  try {
    const { symbol, timeframe = '1D' } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    
    // Validate subscription for FMP API access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for historical price data access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access historical price data"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Historical prices access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access historical price data"
      });
    }

    console.log(`Historical prices access granted for subscription ID: ${subscriptionId}`);
    
    // Determine the appropriate FMP endpoint based on asset type
    const isCrypto = symbol.includes('USD');
    let url;
    let params = {
      apikey: process.env.FMP_API_KEY || 'demo'
    };
    
    // Add timeseries parameter based on timeframe
    let timeseries = 30; // Default to 30 days
    switch(timeframe) {
      case '1D': timeseries = 1; break;
      case '1W': timeseries = 7; break;
      case '1M': timeseries = 30; break;
      case '3M': timeseries = 90; break;
      case '1Y': timeseries = 365; break;
      case 'ALL': timeseries = 3650; break;
      default: timeseries = 30;
    }
    
    params.timeseries = timeseries.toString();
    params.serietype = 'line';
    
    if (isCrypto) {
      url = `https://financialmodelingprep.com/api/v3/historical-price-full/crypto/${symbol}`;
    } else {
      url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`;
    }
    
    const response = await axios.get(url, { params });
    
    if (response.data && response.data.historical && Array.isArray(response.data.historical)) {
      // Format data for the chart
      const data = response.data.historical.map(entry => [
        entry.date,
        entry.close,
        entry.volume
      ]);
      
      res.json({ data });
    } else {
      res.status(404).json({ error: 'No historical data found for this symbol' });
    }
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    res.status(500).json({ error: 'Failed to fetch historical price data' });
  }
});

// Intraday prices API endpoint
app.get('/api/intraday-prices', async (req, res) => {
  try {
    const { symbol, interval = '1min' } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    // Validate subscription for FMP API access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for intraday price data access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access intraday price data"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Intraday access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access intraday price data"
      });
    }

    console.log(`Intraday access granted for subscription ID: ${subscriptionId}`);
    
    const url = `https://financialmodelingprep.com/api/v3/historical-chart/${interval}/${symbol}`;
    const params = {
      apikey: process.env.FMP_API_KEY || 'demo'
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Format data for the chart
      const data = response.data.map(entry => [
        entry.date,
        entry.close,
        entry.volume || 0
      ]);
      
      res.json({ data });
    } else {
      res.status(404).json({ error: 'No intraday data found for this symbol' });
    }
  } catch (error) {
    console.error('Error fetching intraday prices:', error);
    res.status(500).json({ error: 'Failed to fetch intraday price data' });
  }
});

// Technical indicators API endpoint
app.get('/api/technical-indicators', async (req, res) => {
  try {
    const { symbol, period = 14, type = 'rsi' } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    // Validate subscription for FMP API access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for technical indicators access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access technical indicators"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Technical indicators access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access technical indicators"
      });
    }

    console.log(`Technical indicators access granted for subscription ID: ${subscriptionId}`);
    
    const indicatorTypes = type.split(',').map(t => t.trim().toLowerCase());
    const result = [];
    
    // Create an object to store indicators
    const indicators = {};
    
    // Process each requested indicator type
    for (const indicatorType of indicatorTypes) {
      try {
        const url = `https://financialmodelingprep.com/api/v3/technical_indicator/${period}/${symbol}`;
        const params = {
          apikey: process.env.FMP_API_KEY || 'demo',
          type: indicatorType
        };
        
        const response = await axios.get(url, { params });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Store the indicator data
          indicators[indicatorType] = response.data;
        }
      } catch (error) {
        console.error(`Error fetching ${indicatorType} for ${symbol}:`, error);
      }
    }
    
    // Format all indicators into a single response
    if (Object.keys(indicators).length > 0) {
      // Create a combined result with most recent data
      const latestData = {};
      
      for (const [type, data] of Object.entries(indicators)) {
        if (data && data.length > 0) {
          // Use most recent value
          latestData[type] = data[0].value;
        }
      }
      
      result.push(latestData);
      res.json(result);
    } else {
      res.status(404).json({ error: 'No technical indicator data found' });
    }
  } catch (error) {
    console.error('Error fetching technical indicators:', error);
    res.status(500).json({ error: 'Failed to fetch technical indicator data' });
  }
});

// Technical indicators API endpoint
app.get('/api/technical-indicator', async (req, res) => {
  try {
    const { indicator, symbol, periodLength = 10, timeframe = '1day' } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    if (!indicator || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both indicator and symbol parameters are required'
      });
    }

    // Validate subscription for FMP API access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for technical indicator access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access technical indicators"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Technical indicator access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access technical indicators"
      });
    }

    console.log(`Technical indicator access granted for subscription ID: ${subscriptionId}`);
    
    // Validate indicator type
    const validIndicators = [
      'sma', 'ema', 'wma', 'dema', 'tema', 'rsi', 
      'standarddeviation', 'williams', 'adx', 'macd'
      // Note: Bollinger Bands not available directly from FMP API
    ];
    
    const indicatorType = indicator.toLowerCase();
    
    if (!validIndicators.includes(indicatorType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid indicator type',
        message: `Indicator must be one of: ${validIndicators.join(', ')}`
      });
    }
    
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    // Construct the appropriate URL for the FMP API
    const url = `https://financialmodelingprep.com/stable/technical-indicators/${indicatorType}`;
    
    // Make the request to FMP API
    const response = await axios.get(url, {
      params: {
        symbol,
        periodLength,
        timeframe,
        apikey: apiKey
      }
    });
    
    // Return the data from FMP
    if (response.data) {
      res.json({
        success: true,
        data: response.data,
        indicator: indicatorType,
        symbol,
        periodLength,
        timeframe
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No data found',
        message: `No ${indicatorType} data available for ${symbol}`
      });
    }
  } catch (error) {
    console.error('Error fetching technical indicator data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch technical indicator data',
      message: error.message
    });
  }
});

// Chart data API endpoint for different time intervals
app.get('/api/chart', async (req, res) => {
  try {
    const { symbol, interval = '1day', contractAddress, isDex } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    // Allow chart to work with either a symbol or contract address
    if (!symbol && !contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Either symbol or contractAddress parameter is required'
      });
    }

    // Validate subscription for ALL chart data access
    if (!subscriptionId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication is required for chart data access. Please provide a valid JWT token or subscription ID.",
        subscription_required: true,
        action: "Please subscribe or sign in to access chart data"
      });
    }

    // Check subscription status in database
    const hasValidSubscription = isSubscriptionActive(subscriptionId);
    if (!hasValidSubscription) {
      console.log(`Chart access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Invalid or inactive subscription",
        subscription_required: true,
        action: "Please renew your subscription to access chart data"
      });
    }

    console.log(`Chart access granted for subscription ID: ${subscriptionId}`);

    // First, detect the correct asset if we have a symbol
    let resolvedAsset = null;
    let finalSymbol = symbol;
    
    if (symbol && !contractAddress) {
      console.log(`Detecting asset for symbol: ${symbol}`);
      try {
        resolvedAsset = await detectAsset(symbol);
        if (resolvedAsset && resolvedAsset.symbol) {
          finalSymbol = resolvedAsset.symbol;
          console.log(`Resolved ${symbol} to ${finalSymbol} (${resolvedAsset.type})`);
        } else {
          console.log(`Could not resolve ${symbol}, using original symbol`);
        }
      } catch (detectError) {
        console.log(`Asset detection failed for ${symbol}, using original symbol:`, detectError.message);
        // Continue with original symbol if detection fails
      }
    }
    
    // Handle EOD (End of Day) data specifically
    if (interval === 'eod' && isDex === false) {
      const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
      
      // Use the resolved symbol for EOD data
      console.log(`Fetching EOD data for ${finalSymbol} (original: ${symbol})`);
    
      try {
        // Use the stable EOD endpoint that returns a flat array of results
        const response = await axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full`, {
          params: {
            symbol: finalSymbol,
            apikey: apiKey
          }
        });
        
        if (response.data && response.data.historical && Array.isArray(response.data.historical)) {
          const eodData = response.data.historical;
          
          // Make sure eodData is not empty
          if (!eodData || eodData.length === 0) {
            throw new Error(`No data points found for ${finalSymbol}`);
          }
     
          // Format data for Chart.js
          const chartData = {
            type: 'line',
            format: 'eod',
            data: {
              labels: eodData.map(point => {
                const date = new Date(point.date);
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }),
              datasets: [
                {
                  label: `${finalSymbol} Price`,
                  data: eodData.map(point => point.close),
                  backgroundColor: 'rgba(70, 167, 88, 0.2)',
                  borderColor: '#46A758',
                  borderWidth: 3,
                  radius: 0,
                  pointHoverRadius: 5,
                  pointHoverBackgroundColor: '#46A758',
                  pointHoverBorderColor: '#fff',
                  pointHoverBorderWidth: 2,
                  tension: 0.3,
                  fill: true
                },
                {
                  label: `${finalSymbol} Volume`,
                  data: eodData.map(point => point.volume || 0),
                  backgroundColor: 'rgba(109, 40, 217, 0.5)',
                  borderColor: 'rgba(109, 40, 217, 0.8)',
                  borderWidth: 1,
                  type: 'bar',
                  yAxisID: 'volume'
                }
              ]
            },
            timestamps: eodData.map(point => new Date(point.date).getTime()),
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  position: 'right',
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                  }
                },
                volume: {
                  position: 'left',
                  grid: {
                    display: false
                  }
                }
              }
            },
            symbol: finalSymbol,
            originalSymbol: symbol,
            resolvedAsset: resolvedAsset,
            data: eodData
          };
          
          // Add OHLC data for candlestick chart
          chartData.data.datasets[0].ohlc = eodData.map(point => ({
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume
          }));
          
          return res.json(chartData);
        } else {
          throw new Error(`No EOD data found for ${finalSymbol}`);
        }
      } catch (eodError) {
        console.error(`Error fetching EOD data for ${finalSymbol}:`, eodError.message);
        return res.status(404).json({
          success: false,
          error: 'No EOD data found',
          message: `No EOD data available for ${finalSymbol} (searched as: ${symbol})`
        });
      }
    }
    
    // Check if this is a DexScreener request (contract address provided or dex flag is true)
    // Also check if the resolved asset is a crypto type that should use DexScreener
    // NOTE: DexScreener access now REQUIRES SUBSCRIPTION (subscription already validated above)
    if (contractAddress || isDex === 'true' || (resolvedAsset && resolvedAsset.type === 'crypto' && resolvedAsset.source === 'dexscreener')) {
      // If we have a symbol but no contract address, use the symbol for DexScreener search
      // Use original symbol for DexScreener as it handles memecoin names better
      const searchQuery = contractAddress || symbol;
      
      console.log(`Fetching DexScreener data for ${contractAddress ? 'contract' : 'memecoin symbol'}: ${searchQuery} (subscription verified)`);
      try {
        // Use DexScreener API to get data for this token
        const dexScreenerResponse = await axios.get('https://api.dexscreener.com/latest/dex/search', {
          params: {
            q: searchQuery
          }
        });
        
        if (!dexScreenerResponse.data || 
            !dexScreenerResponse.data.pairs || 
            !Array.isArray(dexScreenerResponse.data.pairs) || 
            dexScreenerResponse.data.pairs.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No data found',
            message: `No data available for ${contractAddress ? 'contract address' : 'memecoin'}: ${searchQuery}`
          });
        }
        
        // Find the best pair (highest liquidity)
        let bestPair = dexScreenerResponse.data.pairs[0];
        if (dexScreenerResponse.data.pairs.length > 1) {
          bestPair = dexScreenerResponse.data.pairs.reduce((best, current) => {
            const bestLiquidity = best.liquidity?.usd || 0;
            const currentLiquidity = current.liquidity?.usd || 0;
            return currentLiquidity > bestLiquidity ? current : best;
          }, dexScreenerResponse.data.pairs[0]);
        }
        
        console.log(`Found best pair for ${searchQuery} with ${bestPair.liquidity?.usd || 0} USD liquidity`);
        
        // Get price data for charting
        const priceData = bestPair.priceUsd || 0;
        const tokenSymbol = bestPair.baseToken?.symbol || 'TOKEN';
        const tokenName = bestPair.baseToken?.name || 'Unknown Token';
        
        // Get price history if available
        let priceHistory = [];
        if (bestPair.pairAddress) {
          try {
            // Try to get price history from DexScreener
            const historyResponse = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/${bestPair.chainId}/${bestPair.pairAddress}/candles`, {
              params: {
                from: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days back
                to: Math.floor(Date.now() / 1000),
                resolution: interval.includes('min') ? 5 : 60 // 5min or 1hour
              }
            });
            
            if (historyResponse.data && historyResponse.data.candles && Array.isArray(historyResponse.data.candles)) {
              priceHistory = historyResponse.data.candles;
              console.log(`Got ${priceHistory.length} historical price points for ${tokenSymbol}`);
            }
          } catch (historyError) {
            console.error(`Failed to get price history for ${tokenSymbol}:`, historyError.message);
            // Continue with basic data even if history fetch fails
          }
        }
        
        // Create synthetic data if we don't have enough price history
        if (priceHistory.length < 2) {
          console.log(`Generating synthetic data for ${tokenSymbol}`);
          priceHistory = generateSyntheticTokenData(priceData, 100);
        }
        
        // Format data for chart
        const chartData = {
          type: 'line',
          source: 'dexscreener',
          data: {
            labels: priceHistory.map((point, index) => {
              // If we have real timestamps, use them
              if (point.time) {
                const date = new Date(point.time * 1000);
                if (interval.includes('min')) {
                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else {
                  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
              } else {
                // Otherwise use relative time (now - index)
                const date = new Date();
                date.setHours(date.getHours() - index);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }),
            datasets: [
              {
                label: `${tokenSymbol} Price`,
                data: priceHistory.map(point => point.close || point.price || priceData),
                backgroundColor: 'rgba(70, 167, 88, 0.2)',
                borderColor: '#46A758',
                borderWidth: 3,
                radius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#46A758',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                tension: 0.3,
                fill: true
              },
              {
                label: `${tokenSymbol} Volume`,
                data: priceHistory.map(point => point.volume || bestPair.volume?.h24 / 24 || 0),
                backgroundColor: 'rgba(109, 40, 217, 0.5)',
                borderColor: 'rgba(109, 40, 217, 0.8)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'volume'
              }
            ]
          },
          timestamps: priceHistory.map((point, index) => {
            if (point.time) {
              return point.time * 1000;
            } else {
              // Synthetic timestamp
              const date = new Date();
              date.setHours(date.getHours() - index);
              return date.getTime();
            }
          }),
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                position: 'right',
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              volume: {
                position: 'left',
                grid: {
                  display: false
                }
              }
            }
          },
          symbol: tokenSymbol,
          originalSymbol: symbol,
          resolvedAsset: resolvedAsset,
          // Add token info
          tokenInfo: {
            name: tokenName,
            symbol: tokenSymbol,
            contract: bestPair.baseToken?.address || contractAddress,
            chain: bestPair.chainId,
            priceUsd: bestPair.priceUsd,
            priceChange24h: bestPair.priceChange?.h24 || 0,
            volume24h: bestPair.volume?.h24 || 0,
            liquidity: bestPair.liquidity?.usd || 0,
            marketCap: bestPair.fdv || 0,
            dexId: bestPair.dexId,
            pairAddress: bestPair.pairAddress,
            baseToken: bestPair.baseToken,
            quoteToken: bestPair.quoteToken
          }
        };
        
        // Add OHLC data for candlestick chart
        chartData.data.datasets[0].ohlc = priceHistory.map(point => {
          // Generate volume using the same logic as the volume dataset
          let volumeValue = point.volume;
          if (!volumeValue || volumeValue === 0) {
            const priceRange = point.high - point.low;
            const volatilityFactor = priceRange / point.close;
            
            // Base volume varies by interval
            let baseVolume;
            switch (interval) {
              case '1min': baseVolume = 500000; break;
              case '5min': baseVolume = 1000000; break;
              case '15min': baseVolume = 2000000; break;
              case '30min': baseVolume = 3000000; break;
              case '1hour': baseVolume = 5000000; break;
              case '4hour': baseVolume = 10000000; break;
              default: baseVolume = 1000000; break;
            }
            
            // Adjust based on volatility and add randomness
            const volatilityMultiplier = 1 + (volatilityFactor * 2);
            const randomVariation = 0.7 + (Math.random() * 0.6);
            
            volumeValue = Math.round(baseVolume * volatilityMultiplier * randomVariation);
          }
          
          return {
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: volumeValue
          };
        });
        
        // Return the formatted data
        return res.json(chartData);
        
      } catch (dexScreenerError) {
        console.error('Error fetching DexScreener data:', dexScreenerError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch DexScreener data',
          message: dexScreenerError.message
        });
      }
    }
    
    // Regular FMP API flow for standard assets - subscription already validated above
    // Validate interval format
    const validIntervals = ['1min', '5min', '15min', '30min', '1hour', '4hour', 'eod', '1day'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval',
        message: `Interval must be one of: ${validIntervals.join(', ')}`
      });
    }
    
    console.log(`Fetching chart data for ${finalSymbol} (original: ${symbol}) with interval ${interval}`);
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    // Fetch data from FMP API using the resolved symbol
    const url = `https://financialmodelingprep.com/api/v3/historical-chart/${interval}/${finalSymbol}`;
    const response = await axios.get(url, {
      params: {
        apikey: apiKey
      }
    });
    
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data found',
        message: `No chart data available for ${finalSymbol} (searched as: ${symbol}) at ${interval} interval`
      });
    }
    
    // Process the data for Chart.js format
    const chartData = {
      type: 'line',
      data: {
        labels: response.data.map(point => {
          const date = new Date(point.date);
          // Format based on interval
          if (interval.includes('min')) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (interval.includes('hour')) {
            return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit' })}`;
          } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }
        }),
        datasets: [
          {
            label: `${finalSymbol} Price`,
            data: response.data.map(point => point.close),
            backgroundColor: 'rgba(70, 167, 88, 0.2)',
            borderColor: '#46A758',
            borderWidth: 3,
            radius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#46A758',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: `${finalSymbol} Volume`,
            data: response.data.map(point => point.volume || 0),
            backgroundColor: 'rgba(109, 40, 217, 0.5)',
            borderColor: 'rgba(109, 40, 217, 0.8)',
            borderWidth: 1,
            type: 'bar',
            yAxisID: 'volume'
          }
        ]
      },
      timestamps: response.data.map(point => new Date(point.date).getTime()),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            position: 'right',
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          volume: {
            position: 'left',
            grid: {
              display: false
            }
          }
        }
      },
      symbol: finalSymbol,
      originalSymbol: symbol,
      resolvedAsset: resolvedAsset
    };
    
    // Add OHLC data for candlestick chart
    chartData.data.datasets[0].ohlc = response.data.map(point => ({
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume
    }));
    
    // Return the formatted data
    res.json(chartData);
    
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

// Add a dedicated /api/chart/eod endpoint that respects the dex flag from frontend
app.get('/api/chart/eod', async (req, res) => {
  try {
    const { symbol, contractAddress, isDex } = req.query;
    const subscriptionId = getSubscriptionId(req);
    
    // Require either symbol or contract address
    if (!symbol && !contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Either symbol or contractAddress parameter is required'
      });
    }

    // For FMP EOD data (non-DexScreener), require valid subscription
    const needsSubscription = !contractAddress && isDex !== 'true';
    
    if (needsSubscription) {
      // Validate subscription for FMP API access
      if (!subscriptionId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Valid authentication is required for EOD data access. Please provide a valid JWT token or subscription ID.",
          subscription_required: true,
          action: "Please subscribe or sign in to access EOD historical data"
        });
      }

      // Check subscription status in database
      const hasValidSubscription = isSubscriptionActive(subscriptionId);
      if (!hasValidSubscription) {
        console.log(`EOD access denied for subscription ID: ${subscriptionId} - invalid or inactive subscription`);
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Invalid or inactive subscription",
          subscription_required: true,
          action: "Please renew your subscription to access EOD historical data"
        });
      }

      console.log(`EOD access granted for subscription ID: ${subscriptionId}`);
    }

    // First, detect the correct asset if we have a symbol
    let resolvedAsset = null;
    let finalSymbol = symbol;
    
    if (symbol && !contractAddress) {
      console.log(`Detecting asset for EOD symbol: ${symbol}`);
      try {
        resolvedAsset = await detectAsset(symbol);
        if (resolvedAsset && resolvedAsset.symbol) {
          finalSymbol = resolvedAsset.symbol;
          console.log(`Resolved ${symbol} to ${finalSymbol} for EOD (${resolvedAsset.type})`);
        } else {
          console.log(`Could not resolve ${symbol} for EOD, using original symbol`);
        }
      } catch (detectError) {
        console.log(`Asset detection failed for EOD ${symbol}, using original symbol:`, detectError.message);
        // Continue with original symbol if detection fails
      }
    }
    
    // Check if this is a DexScreener request (contract address, dex flag, or resolved crypto asset)
    if (contractAddress || isDex === 'true' || (resolvedAsset && resolvedAsset.type === 'crypto' && resolvedAsset.source === 'dexscreener')) {
      // Forward to the main endpoint with 'eod' interval
      const forwardUrl = `${req.protocol}://${req.get('host')}/api/chart`;
      const params = {
        interval: 'eod'
      };
      
      if (contractAddress) params.contractAddress = contractAddress;
      if (symbol) params.symbol = symbol; // Use original symbol for DexScreener
      if (isDex) params.isDex = isDex;
      
      console.log(`Forwarding EOD request to DexScreener: ${contractAddress || symbol}`);
      const response = await axios.get(forwardUrl, { params });
      return res.json(response.data);
    }
    
    // For standard assets, directly use FMP stable EOD endpoint with resolved symbol
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    
    console.log(`Fetching EOD data for ${finalSymbol} (original: ${symbol}) from FMP stable endpoint`);
    
    const response = await axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full`, {
      params: {
        symbol: finalSymbol,
        apikey: apiKey
      }
    });
    
    // Check if we got data back
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No EOD data found',
        message: `No EOD data available for ${finalSymbol} (searched as: ${symbol})`
      });
    }
    
    // Process the FMP data
    // When FMP returns data in the new format, it's an array of objects
    // When no data is found, it returns an empty object with a message
    let eodData = [];
    
    if (Array.isArray(response.data)) {
      eodData = response.data;
      console.log(`Found ${eodData.length} EOD data points for ${finalSymbol}`);
    } else {
      console.log(`No EOD data array returned from FMP for ${finalSymbol}. Response:`, response.data);
      return res.status(404).json({
        success: false,
        error: 'No EOD data found',
        message: `No EOD data available for ${finalSymbol} (searched as: ${symbol})`
      });
    }
    
    // Safety check - make sure we have at least one data point
    if (eodData.length === 0) {
      console.log(`Empty EOD data array returned from FMP for ${finalSymbol}`);
      return res.status(404).json({
        success: false,
        error: 'No EOD data found',
        message: `No EOD data available for ${finalSymbol} (searched as: ${symbol})`
      });
    }
    
    // Format data for Chart.js
    const chartData = {
      type: 'line',
      format: 'eod',
      data: eodData, // Store the raw data for the client-side component
      timestamps: eodData.map(point => new Date(point.date).getTime()),
      symbol: finalSymbol,
      originalSymbol: symbol,
      resolvedAsset: resolvedAsset,
      
      // Include the Chart.js formatted data for backward compatibility
      chartJsData: {
        labels: eodData.map(point => {
          const date = new Date(point.date);
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: `${finalSymbol} Price`,
            data: eodData.map(point => point.close),
            backgroundColor: 'rgba(70, 167, 88, 0.2)',
            borderColor: '#46A758',
            borderWidth: 3,
            radius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#46A758',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.3,
            fill: true,
            // Add OHLC data for candlestick chart
            ohlc: eodData.map(point => ({
              open: point.open,
              high: point.high,
              low: point.low,
              close: point.close,
              volume: point.volume
            }))
          },
          {
            label: `${finalSymbol} Volume`,
            data: eodData.map(point => point.volume || 0),
            backgroundColor: 'rgba(109, 40, 217, 0.5)',
            borderColor: 'rgba(109, 40, 217, 0.8)',
            borderWidth: 1,
            type: 'bar',
            yAxisID: 'volume'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            position: 'right',
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          volume: {
            position: 'left',
            grid: {
              display: false
            }
          }
        }
      }
    };
    
    // Log what we're returning to help debug
    console.log(`Returning EOD data for ${finalSymbol} (original: ${symbol}) with ${eodData.length} data points`);
    
    // Return the formatted data
    return res.json(chartData);
  } catch (error) {
    console.error('Error in EOD chart endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EOD data',
      message: error.message
    });
  }
});

// Helper function to generate synthetic price data for tokens
function generateSyntheticTokenData(currentPrice, dataPoints = 100) {
  const priceData = [];
  const now = Math.floor(Date.now() / 1000);
  const volatility = 0.05; // 5% volatility for memecoins
  
  let price = currentPrice * 0.8; // Start 20% lower than current price
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = now - i * 3600; // Hourly data
    
    // Add random volatility with slight upward trend
    const randomChange = (Math.random() * volatility * 2) - volatility;
    const trendFactor = 0.002; // Small upward trend
    
    price = price * (1 + randomChange + trendFactor);
    
    // Generate synthetic volume based on price movement
    const volume = Math.abs(randomChange) * price * 1000 * (1 + Math.random());
    
    // Add data point
    priceData.push({
      time: timestamp,
      open: price * 0.995,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      price: price,
      volume: volume
    });
  }
  
  // Ensure the last price matches current price
  if (priceData.length > 0) {
    priceData[priceData.length - 1].close = currentPrice;
    priceData[priceData.length - 1].price = currentPrice;
  }
  
  return priceData;
}

// Create a test script at the end of the file to test our DexScreener implementation
// This will run when the file is executed directly with `node api.js test-dexscreener`
if (process.argv.includes('test-dexscreener')) {
  const testDexScreenerFunctionality = async () => {
    try {
      console.log('Testing DexScreener implementation with a sample contract address...');
      
      // Test with a real pump token address from Solana
      // This is the USDC (Unstable Dogcoin) contract on Solana
      const testAddress = '6QompnU78SF8SLLzGMPxSMGZMZcHK6oGp7hYBWEgpump';
      console.log(`Using test address: ${testAddress}`);
      
      // Direct DexScreener API test to avoid OpenAI issues
      try {
        console.log('Directly testing DexScreener API...');
        const axios = require('axios').default;
        
        const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
          params: {
            q: testAddress
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
          const tokenSymbol = bestPair.baseToken?.symbol || testAddress;
          const tokenName = bestPair.baseToken?.name || testAddress;
          
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
              quoteToken: bestPair.quoteToken
            }
          };
          
          console.log('Created asset from DexScreener:', JSON.stringify(asset, null, 2));
          console.log('DexScreener detection successful!');
        } else {
          console.log('No results found on DexScreener API for query:', testAddress);
        }
      } catch (dexError) {
        console.error('Error testing DexScreener API directly:', dexError.message);
      }
      
      // Also test the full detectAsset function
      console.log('\nTesting full detectAsset function...');
      const result = await detectAsset(testAddress);
      
      if (result) {
        console.log('detectAsset function successful!');
        console.log('Detected Asset:', JSON.stringify(result, null, 2));
      } else {
        console.log('detectAsset function failed - no asset found.');
      }
    } catch (error) {
      console.error('Error testing DexScreener functionality:', error);
    }
  };

  // Run the test
  testDexScreenerFunctionality();
}

// Helper function to consistently check if an asset is a cryptocurrency
const isCryptoAsset = (asset) => {
  return asset && asset.type && 
         (asset.type.toLowerCase().includes('crypto') || 
          asset.type.includes('Cryptocurrency'));
};

// Helper function to get the proper crypto symbol format for API requests
const getCryptoSymbol = (symbol) => {
  return symbol.endsWith('USD') ? symbol : `${symbol}USD`;
};

// Function to fetch cryptocurrency price using the most reliable endpoint
const getCryptoPrice = async (asset) => {
  try {
    const apiKey = process.env.FMP_API_KEY || 'gNx4STB9zWF4LisL3q8wT4kc38hUyhs9';
    const cryptoSymbol = getCryptoSymbol(asset.symbol);
    
    console.log(`Fetching cryptocurrency price from crypto quotes endpoint for ${cryptoSymbol}`);
    const response = await axios.get('https://financialmodelingprep.com/api/v3/quotes/crypto', {
      params: { apikey: apiKey }
    });
    
    if (response.data && Array.isArray(response.data)) {
      // Find exact matching crypto by symbol - must match EXACTLY the right symbol
      const cryptoData = response.data.find(crypto => 
        crypto.symbol === cryptoSymbol);
        
      if (cryptoData) {
        console.log(`Got reliable cryptocurrency price for ${asset.symbol}: ${cryptoData.price} from crypto quotes endpoint`);
        return {
          price: cryptoData.price.toString(),
          source: 'FMP Crypto Quotes API',
          change: cryptoData.change,
          changePercentage: cryptoData.changesPercentage,
          dayHigh: cryptoData.dayHigh,
          dayLow: cryptoData.dayLow,
          exchange: cryptoData.exchange
        };
      } else {
        console.log(`Cryptocurrency ${cryptoSymbol} not found in crypto quotes endpoint`);
      }
    }
    return null;
  } catch (err) {
    console.error(`Error fetching from crypto quotes endpoint: ${err.message}`);
    return null;
  }
};

// Enhanced subscription validation endpoint
app.get('/api/user/access', rateLimitMiddleware, (req, res) => {
  try {
    const subscriptionId = getSubscriptionId(req);
    
    if (!subscriptionId) {
      return res.status(401).json({ 
        error: 'No subscription ID provided',
        hasAccess: false,
        isSubscribed: false
      });
    }

    const isActive = isSubscriptionActive(subscriptionId);
    const userEmail = req.query.email || req.headers['x-user-email'];
    const isUserSubscribed = isSubscribed(userEmail, subscriptionId);

    res.json({
      hasAccess: isActive && isUserSubscribed,
      isSubscribed: isUserSubscribed,
      isActive: isActive,
      subscriptionId: subscriptionId,
      email: userEmail
    });
  } catch (error) {
    console.error('Error in user access endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      hasAccess: false,
      isSubscribed: false
    });
  }
});

// FMP API Key endpoint for WebSocket connections
app.get('/api/fmp-key', (req, res) => {
  try {
    // Return FMP API key for WebSocket connections (no authentication required for streaming)
    const fmpApiKey = process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY;
    
    if (!fmpApiKey) {
      console.error('FMP API key not found in environment variables');
      return res.status(500).json({ 
        error: 'WebSocket streaming temporarily unavailable',
        apiKey: null
      });
    }

    res.json({
      apiKey: fmpApiKey,
      streaming: true
    });

  } catch (error) {
    console.error('Error in FMP API key endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      apiKey: null
    });
  }
});