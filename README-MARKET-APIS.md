# Koyn Market API Integration

This document explains how the Koyn application integrates with various financial market APIs.

## Overview

Koyn uses several financial market data APIs to retrieve asset information:

1. **Financial Modeling Prep (FMP)** - Primary source for price data and financial metrics
2. **Financial Datasets API** - Secondary/fallback source for asset price data
3. **TradingView** - Interactive charts with advanced technical analysis features

## Price Data Flow

Price data is retrieved in the following priority order:

1. **FMP API Direct Quote** - Fast and reliable quotes for all asset types
2. **Financial Datasets API** - Secondary source if FMP data is unavailable
3. **Synthetic Data Generation** - Fallback when no API data is available

## Chart Integration

Koyn now uses TradingView's Advanced Chart widget for all charting needs, which provides:

- Professional-grade technical analysis tools
- Support for all major asset types (stocks, crypto, forex, indices, commodities)
- Advanced technical indicators (RSI, MACD, SMA, EMA, etc.)
- Drawing tools and pattern recognition

The TradingViewWidget component automatically formats symbol names based on asset type:
- Stocks: `NASDAQ:AAPL`
- Crypto: `BINANCE:BTCUSDT`
- Forex: `FOREX:EURUSD`
- Indices: `SP:SPX`, `DJ:DJI`, etc.
- Commodities: `COMEX:GC`, `NYMEX:CL`, etc.

## Financial Data

Various financial data points are retrieved and displayed:

- Current price and price change
- Daily high/low
- Financial ratios
- Key metrics
- Analyst estimates
- Peer companies
- Price targets
- Stock ratings

## Fallback Mechanisms

The system includes several fallback mechanisms:

1. If FMP API fails, it falls back to Financial Datasets API
2. If both price APIs fail, synthetic data is generated
3. Caching is implemented to reduce API calls and ensure responsiveness

## API Key Management

API keys for the various services are stored in environment variables:
- `FMP_API_KEY` - Financial Modeling Prep API key
- `FINANCIAL_DATASETS_API_KEY` - Financial Datasets API key

## Caching

Data is cached to improve performance and reduce API calls:
- Enhanced financial data: 1 hour
- Historical prices: 24 hours
- News: Variable TTL based on asset type (15 min to 1 hour)

## Setting Up API Keys

### CoinGecko API

1. Visit [CoinGecko Pro](https://www.coingecko.com/en/api/pricing)
2. Sign up for a CoinGecko Pro account
3. Obtain your API key
4. Add to your .env file as `COINGECKO_API_KEY=your_api_key`

Note: CoinGecko offers a free tier with limited rate limits. If no API key is provided, the application will use the free tier.

### CoinMarketCap API

1. Visit [CoinMarketCap Developer Portal](https://coinmarketcap.com/api/)
2. Sign up for an account
3. Navigate to your API dashboard and obtain your API key
4. Add to your .env file as `COINMARKETCAP_API_KEY=your_api_key`

### Financial Modeling Prep (FMP) API

1. Visit [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs)
2. Sign up for an account and choose a plan
3. Obtain your API key
4. Add to your .env file as `FMP_API_KEY=your_api_key`

## API Usage in the Application

The application uses a fallback mechanism for getting market data:

### For Cryptocurrencies:
1. First tries CoinGecko
2. If CoinGecko fails, tries CoinMarketCap
3. If both fail, generates mock data

### For Traditional Finance (Stocks, Indices, Forex, Commodities):
1. Uses Financial Modeling Prep (FMP)
2. If FMP fails, generates mock data

## Implementation Details

All API integrations are implemented in the `crypto-market-api.js` file, which provides a clean interface for the rest of the application to use. The main functions exposed are:

- `getAssetPrice(asset)` - Returns the current price for any asset
- `getAssetHistoricalData(asset)` - Returns historical price data for any asset

## Caching Strategy

To minimize API calls and prevent rate limiting, the application implements caching:

- Price data is cached for 30 minutes
- Historical data is cached for 30 minutes

## Rate Limits

Be aware of the rate limits for each API:

- **CoinGecko Free**: ~50 calls/minute
- **CoinGecko Pro**: Varies by plan, typically 500+ calls/minute
- **CoinMarketCap**: Varies by plan (Basic is 333 credits/day)
- **FMP**: Varies by plan

## Data Format Mappings

### Index Mappings
- US30 (Dow Jones) → DJI in FMP
- SPX (S&P 500) → SPY in FMP
- NDX (Nasdaq 100) → QQQ in FMP

### Commodity Mappings 
- XAU (Gold) → GOLD in FMP
- XAG (Silver) → SILVER in FMP
- CL (Crude Oil) → OIL in FMP

### Forex
For forex pairs like EUR/USD, the format in FMP is EURUSD (no slash) 