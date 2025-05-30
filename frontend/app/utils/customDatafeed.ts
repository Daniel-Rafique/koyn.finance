// Custom datafeed implementation for TradingView using Binance API

interface Bar {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
  
  interface LibrarySymbolInfo {
    name: string
    full_name: string
    description: string
    type: string
    session: string
    timezone: string
    ticker: string
    exchange: string
    minmov: number
    pricescale: number
    has_intraday: boolean
    supported_resolutions: string[]
    volume_precision: number
    data_status: string
  }
  
  const createCustomDatafeed = () => {
    const baseUrl = "https://api.binance.com/api/v3"
  
    return {
      // Required methods for TradingView datafeed
      onReady: (callback: (config: any) => void) => {
        setTimeout(() => {
          callback({
            exchanges: [
              { value: "Binance", name: "Binance", desc: "Binance Exchange" },
              { value: "Coinbase", name: "Coinbase", desc: "Coinbase Exchange" },
            ],
            symbols_types: [{ name: "crypto", value: "crypto" }],
            supported_resolutions: [
              "1",
              "3",
              "5",
              "15",
              "30",
              "60",
              "120",
              "240",
              "360",
              "480",
              "720",
              "1D",
              "3D",
              "1W",
              "1M",
            ],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
          })
        }, 0)
      },
  
      searchSymbols: (
        userInput: string,
        exchange: string,
        symbolType: string,
        onResultReadyCallback: (symbols: any[]) => void,
      ) => {
        // Implement symbol search
        const symbols = [
          {
            symbol: "BTCUSDT",
            full_name: "Binance:BTCUSDT",
            description: "Bitcoin / Tether USD",
            exchange: "Binance",
            ticker: "BTCUSDT",
            type: "crypto",
          },
          {
            symbol: "ETHUSDT",
            full_name: "Binance:ETHUSDT",
            description: "Ethereum / Tether USD",
            exchange: "Binance",
            ticker: "ETHUSDT",
            type: "crypto",
          },
        ]
  
        const filteredSymbols = symbols.filter((symbol) => symbol.symbol.toLowerCase().includes(userInput.toLowerCase()))
  
        onResultReadyCallback(filteredSymbols)
      },
  
      resolveSymbol: (
        symbolName: string,
        onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void,
        onResolveErrorCallback: (reason: string) => void,
      ) => {
        // Parse symbol (e.g., "Binance:BTCUSDT" -> "BTCUSDT")
        const symbol = symbolName.includes(":") ? symbolName.split(":")[1] : symbolName
  
        const symbolInfo: LibrarySymbolInfo = {
          name: symbol,
          full_name: symbolName,
          description: `${symbol} Cryptocurrency`,
          type: "crypto",
          session: "24x7",
          timezone: "Etc/UTC",
          ticker: symbol,
          exchange: "Binance",
          minmov: 1,
          pricescale: 100000000, // 8 decimal places for crypto
          has_intraday: true,
          supported_resolutions: [
            "1",
            "3",
            "5",
            "15",
            "30",
            "60",
            "120",
            "240",
            "360",
            "480",
            "720",
            "1D",
            "3D",
            "1W",
            "1M",
          ],
          volume_precision: 8,
          data_status: "streaming",
        }
  
        setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0)
      },
  
      getBars: (
        symbolInfo: LibrarySymbolInfo,
        resolution: string,
        periodParams: any,
        onHistoryCallback: (bars: Bar[], meta: any) => void,
        onErrorCallback: (error: string) => void,
      ) => {
        const { from, to } = periodParams
  
        // Convert TradingView resolution to Binance interval
        const intervalMap: { [key: string]: string } = {
          "1": "1m",
          "3": "3m",
          "5": "5m",
          "15": "15m",
          "30": "30m",
          "60": "1h",
          "120": "2h",
          "240": "4h",
          "360": "6h",
          "480": "8h",
          "720": "12h",
          "1D": "1d",
          "3D": "3d",
          "1W": "1w",
          "1M": "1M",
        }
  
        const interval = intervalMap[resolution] || "1d"
        const symbol = symbolInfo.ticker
  
        // Fetch data from Binance
        const url = `${baseUrl}/klines?symbol=${symbol}&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1000`
  
        fetch(url)
          .then((response) => response.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const bars: Bar[] = data.map((kline: any[]) => ({
                time: kline[0], // Open time
                open: Number.parseFloat(kline[1]),
                high: Number.parseFloat(kline[2]),
                low: Number.parseFloat(kline[3]),
                close: Number.parseFloat(kline[4]),
                volume: Number.parseFloat(kline[5]),
              }))
  
              onHistoryCallback(bars, { noData: bars.length === 0 })
            } else {
              onErrorCallback("Invalid data format")
            }
          })
          .catch((error) => {
            console.error("Error fetching data:", error)
            onErrorCallback(error.message)
          })
      },
  
      subscribeBars: (
        symbolInfo: LibrarySymbolInfo,
        resolution: string,
        onRealtimeCallback: (bar: Bar) => void,
        subscriberUID: string,
        onResetCacheNeededCallback: () => void,
      ) => {
        // Implement real-time data subscription
        console.log("Subscribing to real-time data for", symbolInfo.ticker)
      },
  
      unsubscribeBars: (subscriberUID: string) => {
        // Unsubscribe from real-time data
        console.log("Unsubscribing from real-time data")
      },
    }
  }
  
  export default createCustomDatafeed
  