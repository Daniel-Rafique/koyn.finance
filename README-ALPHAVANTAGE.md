# Alpha Vantage Integration for Koyn.ai

## Overview

Koyn.ai now supports Alpha Vantage API integration for retrieving real-time market data and historical prices. This integration provides more accurate and reliable financial data compared to mocked data.

## Features

- Real-time asset price data from Alpha Vantage
- Historical price data for charts (up to 12 months)
- Support for multiple asset types:
  - Cryptocurrencies
  - Stocks
  - Forex pairs
  - Commodities (including Gold and Silver)
  - Market indices (Dow Jones, S&P 500, NASDAQ)

## Configuration

To enable Alpha Vantage integration, you need to:

1. Sign up for a free Alpha Vantage API key at https://www.alphavantage.co/support/#api-key
2. Add the API key to your `.env` file:

```
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
```

3. Restart the server

## Fallback Mechanism

If the Alpha Vantage API key is not configured or if the API call fails, the system will automatically fall back to using simulated data. This ensures that the application remains functional even without an API key.

## Supported Alpha Vantage Endpoints

The integration uses the following Alpha Vantage API endpoints:

- `GLOBAL_QUOTE` - For real-time stock, ETF, and index prices
- `CURRENCY_EXCHANGE_RATE` - For real-time cryptocurrency and forex prices
- `TIME_SERIES_MONTHLY` - For historical stock, ETF, and index data
- `DIGITAL_CURRENCY_MONTHLY` - For historical cryptocurrency data
- `FX_MONTHLY` - For historical forex data

## Rate Limits

Please be aware that Alpha Vantage's free tier has the following limits:
- 25 API calls per day
- 5 API calls per minute

For production use, consider upgrading to a premium plan.

## References

- [Alpha Vantage API Documentation](https://www.alphavantage.co/documentation/)
- [Alpha Vantage Pricing Plans](https://www.alphavantage.co/premium/) 