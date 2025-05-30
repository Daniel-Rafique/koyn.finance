// crypto-market-api.js
// This file contains functions to fetch crypto and traditional finance data
// from various APIs: CoinGecko, CoinMarketCap, and Financial Modeling Prep (FMP)

const axios = require('axios');

// Cache implementation to reduce API calls
const priceCache = new Map();
const historicalCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

// ================= CRYPTOCURRENCY PRICE FUNCTIONS =================

// Get crypto price from CoinGecko
async function getCoinGeckoPrice(asset) {
    try {
        // Check cache first
        const cacheKey = `coingecko-price-${asset.symbol.toLowerCase()}`;
        const cachedData = priceCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached price for ${asset.name} from CoinGecko, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.price;
        }
        
        // Proceed with API call if no cache
        if (!process.env.COINGECKO_API_KEY) {
            console.warn("CoinGecko API key not found, using public API which has lower rate limits");
        }
        
        // CoinGecko requires using IDs instead of symbols
        const symbol = asset.symbol.toLowerCase();
        
        // Map common cryptocurrencies to their CoinGecko IDs
        const coinGeckoIdMap = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'sol': 'solana',
            'ada': 'cardano',
            'xrp': 'ripple',
            'doge': 'dogecoin',
            'dot': 'polkadot',
            'link': 'chainlink',
            'ltc': 'litecoin',
            'uni': 'uniswap',
            'bch': 'bitcoin-cash',
            'xlm': 'stellar',
            'usdt': 'tether',
            'usdc': 'usd-coin'
        };
        
        // Get the CoinGecko ID from the map or use the symbol/id
        let coinId = asset.id;
        if (coinGeckoIdMap[symbol]) {
            coinId = coinGeckoIdMap[symbol];
        }
        
        // Prepare the API URL, using the key if available
        let apiUrl = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
        
        if (process.env.COINGECKO_API_KEY) {
            apiUrl = `https://pro-api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false&x_cg_pro_api_key=${process.env.COINGECKO_API_KEY}`;
        }
        
        const response = await axios.get(apiUrl);
        
        if (response.data && response.data.market_data && response.data.market_data.current_price && response.data.market_data.current_price.usd) {
            const price = response.data.market_data.current_price.usd;
            
            // Format price based on value
            let formattedPrice;
            if (price >= 1000) {
                formattedPrice = price.toFixed(0);
            } else if (price >= 100) {
                formattedPrice = price.toFixed(1);
            } else if (price >= 1) {
                formattedPrice = price.toFixed(2);
            } else {
                formattedPrice = price.toFixed(6);
            }
            
            // Cache the result
            priceCache.set(cacheKey, {
                price: formattedPrice,
                timestamp: Date.now()
            });
            
            return formattedPrice;
        } else {
            throw new Error(`Could not get price data for ${asset.name} from CoinGecko`);
        }
    } catch (error) {
        console.error(`CoinGecko API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get crypto price from CoinMarketCap
async function getCoinMarketCapPrice(asset) {
    try {
        // Check cache first
        const cacheKey = `coinmarketcap-price-${asset.symbol.toLowerCase()}`;
        const cachedData = priceCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached price for ${asset.name} from CoinMarketCap, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.price;
        }
        
        // Proceed with API call if no cache
        if (!process.env.COINMARKETCAP_API_KEY) {
            throw new Error("CoinMarketCap API key not found");
        }
        
        const symbol = asset.symbol.toUpperCase();
        
        const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
            headers: {
                'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
            },
            params: {
                symbol: symbol
            }
        });
        
        if (response.data && response.data.data && response.data.data[symbol] && response.data.data[symbol].quote && response.data.data[symbol].quote.USD && response.data.data[symbol].quote.USD.price) {
            const price = response.data.data[symbol].quote.USD.price;
            
            // Format price based on value
            let formattedPrice;
            if (price >= 1000) {
                formattedPrice = price.toFixed(0);
            } else if (price >= 100) {
                formattedPrice = price.toFixed(1);
            } else if (price >= 1) {
                formattedPrice = price.toFixed(2);
            } else {
                formattedPrice = price.toFixed(6);
            }
            
            // Cache the result
            priceCache.set(cacheKey, {
                price: formattedPrice,
                timestamp: Date.now()
            });
            
            return formattedPrice;
        } else {
            throw new Error(`Could not get price data for ${asset.name} from CoinMarketCap`);
        }
    } catch (error) {
        console.error(`CoinMarketCap API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get traditional finance price from Financial Modeling Prep (FMP)
async function getFMPPrice(asset) {
    try {
        // Check cache first
        const cacheKey = `fmp-price-${asset.symbol.toLowerCase()}`;
        const cachedData = priceCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached price for ${asset.name} from FMP, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.price;
        }
        
        // Proceed with API call if no cache
        if (!process.env.FMP_API_KEY) {
            throw new Error("FMP API key not found");
        }
        
        let symbol;
        
        switch (asset.type) {
            case 'stock':
                symbol = asset.symbol;
                break;
                
            case 'fx':
                // FMP requires a different format for forex: EUR/USD becomes EURUSD
                symbol = `${asset.base}${asset.quote}`;
                break;
                
            case 'commodity':
                // Map commodity symbols to FMP format
                if (asset.symbol === 'XAU') symbol = 'GOLD';
                else if (asset.symbol === 'XAG') symbol = 'SILVER';
                else if (asset.symbol === 'CL') symbol = 'OIL';
                else symbol = asset.symbol;
                break;
                
            case 'index':
                // Map index symbols to FMP format
                if (asset.symbol === 'US30') symbol = 'DJI';
                else if (asset.symbol === 'SPX') symbol = 'SPY';
                else if (asset.symbol === 'NDX') symbol = 'QQQ';
                else symbol = asset.symbol;
                break;
                
            default:
                symbol = asset.symbol;
        }
        
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}`, {
            params: {
                apikey: process.env.FMP_API_KEY
            }
        });
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0 && response.data[0].price) {
            const price = response.data[0].price;
            
            // Format based on value
            let formattedPrice;
            if (price >= 1000) {
                formattedPrice = price.toFixed(0);
            } else if (price >= 100) {
                formattedPrice = price.toFixed(1);
            } else if (price >= 1) {
                formattedPrice = price.toFixed(2);
            } else {
                formattedPrice = price.toFixed(6);
            }
            
            // Cache the result
            priceCache.set(cacheKey, {
                price: formattedPrice,
                timestamp: Date.now()
            });
            
            return formattedPrice;
        } else {
            throw new Error(`Could not get price for ${asset.name} from FMP`);
        }
    } catch (error) {
        console.error(`FMP API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// ================= HISTORICAL DATA FUNCTIONS =================

// Get historical data from CoinGecko
async function getCoinGeckoHistoricalData(asset) {
    try {
        // Check cache first
        const cacheKey = `coingecko-historical-${asset.symbol.toLowerCase()}`;
        const cachedData = historicalCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached historical data for ${asset.name} from CoinGecko, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.data;
        }
        
        // Check if API key is present
        const useProAPI = !!process.env.COINGECKO_API_KEY;
        
        // CoinGecko requires using IDs instead of symbols
        const symbol = asset.symbol.toLowerCase();
        
        // Map common cryptocurrencies to their CoinGecko IDs
        const coinGeckoIdMap = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'sol': 'solana',
            'ada': 'cardano',
            'xrp': 'ripple',
            'doge': 'dogecoin',
            'dot': 'polkadot',
            'link': 'chainlink',
            'ltc': 'litecoin',
            'uni': 'uniswap',
            'bch': 'bitcoin-cash',
            'xlm': 'stellar',
            'usdt': 'tether',
            'usdc': 'usd-coin'
        };
        
        // Get the CoinGecko ID from the map or use the symbol
        let coinId = asset.id;
        if (coinGeckoIdMap[symbol]) {
            coinId = coinGeckoIdMap[symbol];
        }
        
        // Get data for the last 365 days
        const days = 365;
        let apiUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=monthly`;
        
        if (useProAPI) {
            apiUrl = `https://pro-api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=monthly&x_cg_pro_api_key=${process.env.COINGECKO_API_KEY}`;
        }
        
        const response = await axios.get(apiUrl);
        
        if (response.data && response.data.prices && Array.isArray(response.data.prices)) {
            const priceData = response.data.prices;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            // Process into monthly data points - take the last price of each month
            const monthlyData = [];
            let currentMonth = -1;
            let lastPricePoint = null;
            
            // Sort from oldest to newest
            const sortedPrices = priceData.sort((a, b) => a[0] - b[0]);
            
            for (const pricePoint of sortedPrices) {
                const timestamp = pricePoint[0];
                const price = pricePoint[1];
                const date = new Date(timestamp);
                const month = date.getMonth();
                
                if (month !== currentMonth) {
                    // New month found
                    if (lastPricePoint !== null) {
                        // Add the last price point of the previous month
                        monthlyData.push([monthNames[currentMonth], lastPricePoint[1]]);
                    }
                    currentMonth = month;
                }
                
                lastPricePoint = pricePoint;
            }
            
            // Add the last month
            if (lastPricePoint !== null && currentMonth !== -1) {
                monthlyData.push([monthNames[currentMonth], lastPricePoint[1]]);
            }
            
            // Take the last 12 months of data
            const result = monthlyData.slice(-12);
            
            // Cache the result
            historicalCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } else {
            throw new Error(`Could not get historical data for ${asset.name} from CoinGecko`);
        }
    } catch (error) {
        console.error(`CoinGecko historical data API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get historical data from CoinMarketCap
async function getCoinMarketCapHistoricalData(asset) {
    try {
        // Check cache first
        const cacheKey = `coinmarketcap-historical-${asset.symbol.toLowerCase()}`;
        const cachedData = historicalCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached historical data for ${asset.name} from CoinMarketCap, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.data;
        }
        
        // Proceed with API call if no cache
        if (!process.env.COINMARKETCAP_API_KEY) {
            throw new Error("CoinMarketCap API key not found");
        }
        
        const symbol = asset.symbol.toUpperCase();
        
        // First, get the CMC ID for the crypto
        const idResponse = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map', {
            headers: {
                'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
            },
            params: {
                symbol: symbol
            }
        });
        
        if (!idResponse.data || !idResponse.data.data || !Array.isArray(idResponse.data.data) || idResponse.data.data.length === 0) {
            throw new Error(`Could not find CoinMarketCap ID for ${asset.name}`);
        }
        
        const cmcId = idResponse.data.data[0].id;
        
        // Now get historical data using the ID
        // Set time range to 1 year
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        
        const timeEnd = Math.floor(today.getTime() / 1000);
        const timeStart = Math.floor(oneYearAgo.getTime() / 1000);
        
        const historyResponse = await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical`, {
            headers: {
                'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY,
            },
            params: {
                id: cmcId,
                time_start: timeStart,
                time_end: timeEnd,
                interval: 'monthly'
            }
        });
        
        if (historyResponse.data && historyResponse.data.data && historyResponse.data.data.quotes && Array.isArray(historyResponse.data.data.quotes)) {
            const quotes = historyResponse.data.data.quotes;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            // Process the data into our format
            const formattedData = quotes.map(quote => {
                const date = new Date(quote.timestamp);
                const month = monthNames[date.getMonth()];
                const price = quote.quote.USD.price;
                return [month, price];
            });
            
            // Take the last 12 months of data
            const result = formattedData.slice(-12);
            
            // Cache the result
            historicalCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } else {
            throw new Error(`Could not get historical data for ${asset.name} from CoinMarketCap`);
        }
    } catch (error) {
        console.error(`CoinMarketCap historical data API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get historical data from Financial Modeling Prep (FMP)
async function getFMPHistoricalData(asset) {
    try {
        // Check cache first
        const cacheKey = `fmp-historical-${asset.symbol.toLowerCase()}`;
        const cachedData = historicalCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
            console.log(`Using cached historical data for ${asset.name} from FMP, age: ${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`);
            return cachedData.data;
        }
        
        // Proceed with API call if no cache
        if (!process.env.FMP_API_KEY) {
            throw new Error("FMP API key not found");
        }
        
        let symbol;
        
        switch (asset.type) {
            case 'stock':
                symbol = asset.symbol;
                break;
                
            case 'fx':
                // FMP requires a different format for forex: EUR/USD becomes EURUSD
                symbol = `${asset.base}${asset.quote}`;
                break;
                
            case 'commodity':
                // Map commodity symbols to FMP format
                if (asset.symbol === 'XAU') symbol = 'GOLD';
                else if (asset.symbol === 'XAG') symbol = 'SILVER';
                else if (asset.symbol === 'CL') symbol = 'OIL';
                else symbol = asset.symbol;
                break;
                
            case 'index':
                // Map index symbols to FMP format
                if (asset.symbol === 'US30') symbol = 'DJI';
                else if (asset.symbol === 'SPX') symbol = 'SPY';
                else if (asset.symbol === 'NDX') symbol = 'QQQ';
                else symbol = asset.symbol;
                break;
                
            default:
                symbol = asset.symbol;
        }
        
        // Get historical monthly data
        const response = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`, {
            params: {
                apikey: process.env.FMP_API_KEY,
                serietype: 'line',
                timeseries: 12 // Last 12 months
            }
        });
        
        if (response.data && response.data.historical && Array.isArray(response.data.historical)) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const historicalData = response.data.historical.reverse(); // Reverse to get oldest first
            
            // Format the data into our required structure
            const formattedData = historicalData.map(item => {
                const date = new Date(item.date);
                const month = monthNames[date.getMonth()];
                const price = item.close;
                return [month, price];
            });
            
            const result = formattedData.slice(-12); // Ensure we only return 12 months
            
            // Cache the result
            historicalCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } else {
            throw new Error(`Could not get historical data for ${asset.name} from FMP`);
        }
    } catch (error) {
        console.error(`FMP historical data API error for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get asset price based on type
async function getAssetPrice(asset) {
    if (asset.priceUsd) {
        return asset.priceUsd;
    }
    
    try {
        if (asset.type === 'crypto') {
            // Try CoinGecko first
            try {
                const price = await getCoinGeckoPrice(asset);
                console.log(`Successfully fetched price for ${asset.name} from CoinGecko: $${price}`);
                return price;
            } catch (coinGeckoError) {
                console.error(`CoinGecko API failed for ${asset.name}: ${coinGeckoError.message}`);
                
                // Try CoinMarketCap as fallback for crypto
                try {
                    const price = await getCoinMarketCapPrice(asset);
                    console.log(`Successfully fetched price for ${asset.name} from CoinMarketCap: $${price}`);
                    return price;
                } catch (coinMarketCapError) {
                    console.error(`CoinMarketCap API failed for ${asset.name}: ${coinMarketCapError.message}`);
                    // Let caller handle fallback
                    throw new Error(`Could not get price for ${asset.name} from crypto APIs`);
                }
            }
        } else {
            // For stock, index, commodity, etc., use FMP
            const price = await getFMPPrice(asset);
            console.log(`Successfully fetched price for ${asset.name} from FMP: $${price}`);
            return price;
        }
    } catch (error) {
        console.error(`Error getting price for ${asset.name}: ${error.message}`);
        throw error;
    }
}

// Get historical data based on asset type
async function getAssetHistoricalData(asset) {
    try {
        if (asset.type === 'crypto') {
            // Try CoinGecko first
            try {
                const data = await getCoinGeckoHistoricalData(asset);
                console.log(`Successfully fetched historical data for ${asset.name} from CoinGecko`);
                return data;
            } catch (coinGeckoError) {
                console.error(`CoinGecko historical data API failed for ${asset.name}: ${coinGeckoError.message}`);
                
                // Try CoinMarketCap as fallback for crypto
                try {
                    const data = await getCoinMarketCapHistoricalData(asset);
                    console.log(`Successfully fetched historical data for ${asset.name} from CoinMarketCap`);
                    return data;
                } catch (coinMarketCapError) {
                    console.error(`CoinMarketCap historical data API failed for ${asset.name}: ${coinMarketCapError.message}`);
                    // Let caller handle fallback
                    throw new Error(`Could not get historical data for ${asset.name} from crypto APIs`);
                }
            }
        } else {
            // For stock, index, commodity, etc., use FMP
            const data = await getFMPHistoricalData(asset);
            console.log(`Successfully fetched historical data for ${asset.name} from FMP`);
            return data;
        }
    } catch (error) {
        console.error(`Error getting historical data for ${asset.name}: ${error.message}`);
        throw error;
    }
}

module.exports = {
    getCoinGeckoPrice,
    getCoinMarketCapPrice,
    getFMPPrice,
    getCoinGeckoHistoricalData,
    getCoinMarketCapHistoricalData,
    getFMPHistoricalData,
    getAssetPrice,
    getAssetHistoricalData
}; 