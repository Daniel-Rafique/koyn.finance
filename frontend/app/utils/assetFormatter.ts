// Utility to format asset symbols for TradingView based on our asset database files

interface Stock {
  symbol: string;
}

interface Crypto {
  symbol: string;
  name: string;
  exchange: string;
}

interface Forex {
  symbol: string;
  fromCurrency: string;
  toCurrency: string;
  fromName: string;
  toName: string;
}

interface Index {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
}

interface Commodity {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
}

interface AssetData {
  stocks: Stock[] | { tickers: string[] };
  crypto: Crypto[];
  forex: Forex[];
  indices: Index[];
  commodities: Commodity[];
}

// This will be populated with the loaded data
let assetData: AssetData = {
  stocks: { tickers: [] },
  crypto: [],
  forex: [],
  indices: [],
  commodities: []
};

let dataLoaded = false;

// Function to load all asset data 
export const loadAssetData = async (): Promise<void> => {
  if (dataLoaded) return;
  
  try {
    // Load all the asset data files
    const stocksResponse = await fetch('/assets/stocks.json');
    const cryptoResponse = await fetch('/assets/crypto.json');
    const forexResponse = await fetch('/assets/forex.json');
    const indicesResponse = await fetch('/assets/indices.json');
    const commoditiesResponse = await fetch('/assets/commodities.json');
    
    // Parse the JSON responses
    assetData.stocks = await stocksResponse.json();
    assetData.crypto = await cryptoResponse.json();
    assetData.forex = await forexResponse.json();
    assetData.indices = await indicesResponse.json();
    assetData.commodities = await commoditiesResponse.json();
    
    dataLoaded = true;
    console.log('Asset data loaded successfully');
  } catch (error) {
    console.error('Error loading asset data:', error);
    // Still mark as loaded to prevent further loading attempts
    dataLoaded = true;
  }
};

// Formatter for cryptocurrencies
export const formatCryptoSymbol = (symbol: string): string => {
  // If already formatted with exchange prefix, return as is
  if (symbol.includes(':')) return symbol;
  
  const cleanSymbol = symbol.replace(/USD$/, '');
  
  // First check if it exists in our crypto database
  const matchingCrypto = assetData.crypto.find(crypto => 
    crypto.symbol === symbol || 
    crypto.symbol === `${symbol}USD` || 
    crypto.symbol.replace(/USD$/, '') === cleanSymbol
  );
  
  if (matchingCrypto) {
    // Most cryptocurrencies are traded on Binance with USDT suffix
    return `BINANCE:${cleanSymbol}USDT`;
  }
  
  // Handle major cryptos with USDT suffix
  const majorCryptos = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'DOGE', 'AVAX', 'MATIC', 'LINK'];
  if (majorCryptos.includes(cleanSymbol)) {
    return `BINANCE:${cleanSymbol}USDT`;
  }
  
  // Special cases
  if (symbol === 'BTCUSD' || cleanSymbol === 'BTC') return 'BINANCE:BTCUSDT';
  if (symbol === 'ETHUSD' || cleanSymbol === 'ETH') return 'BINANCE:ETHUSDT';
  if (symbol === 'SOLUSD' || cleanSymbol === 'SOL') return 'BINANCE:SOLUSDT';
  
  // Default case - assume it's a crypto with USD pair
  return `BINANCE:${cleanSymbol}USD`;
};

// Formatter for forex pairs
export const formatForexSymbol = (symbol: string): string => {
  // If already formatted with exchange prefix, return as is
  if (symbol.includes(':')) return symbol;
  
  // Clean up symbol - remove slashes
  const cleanSymbol = symbol.replace('/', '');
  
  // Check if it exists in our forex database
  const matchingForex = assetData.forex.find(forex => 
    forex.symbol === symbol || 
    forex.symbol === cleanSymbol ||
    `${forex.fromCurrency}${forex.toCurrency}` === cleanSymbol
  );
  
  if (matchingForex) {
    // Use FOREX: prefix for forex pairs
    return `FOREX:${cleanSymbol}`;
  }
  
  // Common forex pairs mapping
  const forexPairs = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
    'EURGBP', 'EURJPY', 'GBPJPY', 'CHFJPY', 'EURAUD', 'EURCHF', 'AUDNZD',
    'AUDCAD', 'AUDCHF', 'AUDJPY', 'CADJPY', 'NZDJPY', 'EURCAD', 'EURNZD',
    'USDSEK', 'USDNOK', 'USDHKD', 'USDSGD', 'USDZAR', 'USDMXN', 'USDBRL', 
    'USDCNH', 'EURTRY', 'USDTRY', 'USDRUB', 'EURRUB'
  ];
  
  if (forexPairs.includes(cleanSymbol)) {
    return `FOREX:${cleanSymbol}`;
  }
  
  // If symbol is 6 characters and looks like currency pair
  if (cleanSymbol.length === 6) {
    const firstThree = cleanSymbol.substring(0, 3).toUpperCase();
    const lastThree = cleanSymbol.substring(3, 6).toUpperCase();
    
    // Check if both parts look like currency codes
    const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'HKD', 
                          'CNH', 'SGD', 'TRY', 'MXN', 'ZAR', 'NOK', 'SEK', 'DKK', 'PLN'];
    
    if (currencyCodes.includes(firstThree) && currencyCodes.includes(lastThree)) {
      return `FOREX:${cleanSymbol}`;
    }
  }
  
  // If we're unsure, try OANDA as more exotic pairs are supported there
  return `OANDA:${cleanSymbol}`;
};

// Formatter for indices
export const formatIndexSymbol = (symbol: string): string => {
  // If already formatted with exchange prefix, return as is
  if (symbol.includes(':')) return symbol;
  
  // Clean up symbol (remove ^ if present)
  const cleanSymbol = symbol.replace('^', '');
  
  // Check if it exists in our indices database
  const matchingIndex = assetData.indices.find(index => 
    index.symbol === symbol || 
    index.symbol === `^${cleanSymbol}` ||
    index.symbol.replace('^', '') === cleanSymbol
  );
  
  if (matchingIndex) {
    // Map common exchanges to their TradingView format
    const exchangeMap: {[key: string]: string} = {
      'NYSE': 'NYSE',
      'NASDAQ': 'NASDAQ',
      'TSX': 'TSX',
      'SIX': 'SIX',
      'STO': 'OMXSTO',
      'XETRA': 'XETR',
      'SES': 'SGX',
      'WSE': 'GPW',
      'TAI': 'TWSE',
      'ICEF': '',  // Special case for ICE Futures
      'ASX': 'ASX',
      'LSE': 'LSE',
      'HKEX': 'HKEX',
      'NSE': 'NSE',
      'BSE': 'BSE'
    };
    
    // Special index mapping for common indices
    const indexMap: {[key: string]: string} = {
      'SPX': 'SP:SPX',
      'DJI': 'DJ:DJI',
      'IXIC': 'NASDAQ:IXIC',
      'NDX': 'NASDAQ:NDX',
      'RUT': 'RUSSELL:RUT',
      'VIX': 'CBOE:VIX',
      'GSPC': 'SP:SPX',
      'NYA': 'NYSE:NYA',
      'FTSE': 'FOREXCOM:UK100',
      'GDAXI': 'XETR:DAX',
      'N225': 'TSE:N225',
      'HSI': 'HKEX:HSI',
      'SSEC': 'SSE:000001',
      'TWII': 'TWSE:TAIEX',
      'BSESN': 'BSE:SENSEX',
      'NSEI': 'NSE:NIFTY',
      // Common trading names to TradingView symbols
      'US30': 'CME_MINI:YM1!',  // US30 Dow Jones futures
      'US500': 'CME_MINI:ES1!', // US500 S&P 500 futures
      'NAS100': 'CME_MINI:NQ1!', // NAS100 NASDAQ 100 futures
      'UK100': 'FOREXCOM:UK100', // UK100 is commonly used for FTSE 100
      'GER30': 'XETR:DAX', // GER30 is commonly used for DAX
      'JPN225': 'TSE:N225', // JPN225 is commonly used for Nikkei 225
      'YMUSD': 'CME_MINI:YM1!',  // YM futures for Dow Jones
      'YM': 'CME_MINI:YM1!',     // YM futures for Dow Jones
      'NQUSD': 'CME_MINI:NQ1!',  // NQ futures for NASDAQ
      'RUTUSD': 'CME_MINI:RTY1!', // RTY futures for Russell 2000
      'VIXUSD': 'CBOE:VIX',
      'GSPCUSD': 'CME_MINI:ES1!', // ES futures for S&P 500
      'NYAUSD': 'NYSE:NYA',
      'FTSEUSD': 'FOREXCOM:UK100',
    };
    
    // Check if it's a common index with a specific mapping
    if (indexMap[cleanSymbol]) {
      return indexMap[cleanSymbol];
    }
    
    // If we have a valid exchange mapping, use it
    if (matchingIndex.exchange && exchangeMap[matchingIndex.exchange]) {
      return `${exchangeMap[matchingIndex.exchange]}:${cleanSymbol}`;
    }
  }
  
  // Common indices mapping if not found in database
  const commonIndices: {[key: string]: string} = {
    'SPX': 'SP:SPX',
    'DJI': 'DJ:DJI',
    'IXIC': 'NASDAQ:IXIC', 
    'NDX': 'NASDAQ:NDX',
    'RUT': 'RUSSELL:RUT',
    'VIX': 'CBOE:VIX',
    'GSPC': 'SP:SPX'
  };
  
  if (commonIndices[cleanSymbol]) {
    return commonIndices[cleanSymbol];
  }
  
  // Default to INDEX prefix
  return `INDEX:${cleanSymbol}`;
};

// Formatter for commodities
export const formatCommoditySymbol = (symbol: string): string => {
  // If already formatted with exchange prefix, return as is
  if (symbol.includes(':')) return symbol;
  
  // Clean up symbol
  const cleanSymbol = symbol.replace(/USD$/, '');
  
  // Check if it exists in our commodities database
  const matchingCommodity = assetData.commodities.find(commodity => 
    commodity.symbol === symbol || 
    commodity.symbol === `${cleanSymbol}USD` ||
    commodity.symbol.replace(/USD$/, '') === cleanSymbol
  );
  
  if (matchingCommodity) {
    // Map exchanges to their TradingView format
    const exchangeMap: {[key: string]: string} = {
      'CME': 'CME',
      'COMEX': 'COMEX',
      'NYMEX': 'NYMEX',
      'CBOT': 'CBOT',
      'ICE': 'ICE',
      'NYBOT': 'NYBOT'
    };
    
    if (matchingCommodity.stockExchange && exchangeMap[matchingCommodity.stockExchange]) {
      return `${exchangeMap[matchingCommodity.stockExchange]}:${cleanSymbol}`;
    }
  }
  
  // Common commodities mapping
  const commodityMap: {[key: string]: string} = {
    // Metals
    'GC': 'COMEX:GC',
    'SI': 'COMEX:SI',
    'HG': 'COMEX:HG',
    'PL': 'NYMEX:PL',
    'PA': 'NYMEX:PA',
    'MGC': 'COMEX:MGC',
    'SIL': 'COMEX:SIL',
    'XAU': 'OANDA:XAUUSD',
    'XAG': 'OANDA:XAGUSD',
    // Energy
    'CL': 'NYMEX:CL',
    'NG': 'NYMEX:NG',
    'RB': 'NYMEX:RB',
    'HO': 'NYMEX:HO',
    'BZ': 'NYMEX:BZ',
    // Agricultural
    'ZC': 'CBOT:ZC',
    'ZW': 'CBOT:ZW',
    'ZS': 'CBOT:ZS',
    'ZM': 'CBOT:ZM',
    'ZL': 'CBOT:ZL',
    'KC': 'NYBOT:KC',
    'CT': 'NYBOT:CT',
    'SB': 'NYBOT:SB',
    'CC': 'NYBOT:CC',
    'OJ': 'NYBOT:OJ',
    'LE': 'CME:LE',
    'HE': 'CME:HE',
    'GF': 'CME:GF',
    'ZO': 'CBOT:ZO',
    'ZR': 'CBOT:ZR',
    // Index Futures (often categorized as commodities)
    'YMUSD': 'CME_MINI:YM1!',  // Dow Jones futures
    'YM': 'CME_MINI:YM1!',     // Dow Jones futures
    'NQUSD': 'CME_MINI:NQ1!',  // NASDAQ futures
    'NQ': 'CME_MINI:NQ1!',     // NASDAQ futures
    'RUTUSD': 'CME_MINI:RTY1!', // Russell 2000 futures
    'RTY': 'CME_MINI:RTY1!',   // Russell 2000 futures
    'GSPCUSD': 'CME_MINI:ES1!', // S&P 500 futures
    'ES': 'CME_MINI:ES1!',     // S&P 500 futures
    // Other
    'LB': 'CME:LB',
    'DX': 'ICE:DX'
  };
  
  if (commodityMap[cleanSymbol]) {
    return commodityMap[cleanSymbol];
  }
  
  // Check if it's a commodity with USD suffix
  if (symbol.endsWith('USD')) {
    const baseSymbol = symbol.replace('USD', '');
    if (commodityMap[baseSymbol]) {
      return commodityMap[baseSymbol];
    }
  }
  
  // Default to CURRENCYCOM
  return `CURRENCYCOM:${cleanSymbol}`;
};

// Formatter for stocks
export const formatStockSymbol = (symbol: string): string => {
  // If already formatted with exchange prefix, return as is
  if (symbol.includes(':')) return symbol;
  
  // Check if it exists in our stocks database
  const stocksData = assetData.stocks;
  if ('tickers' in stocksData) {
    const matchingStock = stocksData.tickers.includes(symbol);
    if (matchingStock) {
      return `NASDAQ:${symbol}`;
    }
  }
  
  // Default to NASDAQ for stocks
  return `NASDAQ:${symbol}`;
};

// Main formatter function that handles all asset types
export const formatSymbolForTradingView = (symbol: string, assetType?: string): string => {
  // If the symbol already includes an exchange prefix, return as is
  if (symbol && symbol.includes(':')) return symbol;
  
  // If asset type is provided, use the appropriate formatter
  if (assetType) {
    const type = assetType.toLowerCase();
    
    if (type.includes('crypto')) {
      return formatCryptoSymbol(symbol);
    } 
    else if (type.includes('forex') || type === 'fx') {
      return formatForexSymbol(symbol);
    }
    else if (type.includes('index')) {
      return formatIndexSymbol(symbol);
    }
    else if (type.includes('commodity')) {
      return formatCommoditySymbol(symbol);
    }
    else {
      // Default to stock
      return formatStockSymbol(symbol);
    }
  }
  
  // If no asset type is provided, try to detect the type
  // Check if it might be crypto (has USD suffix but not a forex pair)
  if (symbol.includes('USD') && symbol.length > 3) {
    return formatCryptoSymbol(symbol);
  }
  
  // Check if it might be a forex pair (6 characters like EURUSD)
  if (symbol.length === 6 || symbol.includes('/')) {
    const firstThree = symbol.substring(0, 3).toUpperCase();
    const lastThree = symbol.substring(3, 6).toUpperCase();
    const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'HKD'];
    
    if (currencyCodes.includes(firstThree) && currencyCodes.includes(lastThree)) {
      return formatForexSymbol(symbol);
    }
  }
  
  // Check if it might be an index (starts with ^)
  if (symbol.startsWith('^')) {
    return formatIndexSymbol(symbol);
  }
  
  // Check if it might be a commodity (common commodity symbols)
  const commonCommodities = ['GC', 'SI', 'CL', 'NG', 'HG', 'PL', 'PA', 'ZC', 'ZW', 'ZS'];
  if (commonCommodities.includes(symbol)) {
    return formatCommoditySymbol(symbol);
  }
  
  // Default to stock
  return formatStockSymbol(symbol);
};

// Initialize the data loading
loadAssetData();

export default formatSymbolForTradingView; 