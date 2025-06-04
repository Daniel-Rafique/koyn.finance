"use client"

import { useEffect, useRef, useState } from "react"
import {
  ColorType,
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type Time,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts"
import { useAuth } from "../context/AuthProvider"

// Skeleton Component for Chart Loading
const ChartSkeleton = ({
  height,
  width,
  symbol,
  timeframe,
}: {
  height: number | string
  width: number | string
  symbol: string
  timeframe: string
}) => {
  const [animatedBars, setAnimatedBars] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedBars((prev) => (prev + 1) % 20)
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const generateSkeletonBars = () => {
    const bars = []
    const barCount = 50
    const containerWidth = typeof width === "string" ? 600 : Number(width)
    const containerHeight = typeof height === "string" ? 400 : Number(height)
    const barWidth = Math.max(4, containerWidth / barCount - 2)
    const maxBarHeight = containerHeight * 0.6

    for (let i = 0; i < barCount; i++) {
      const isAnimated = i === animatedBars || i === (animatedBars + 1) % barCount
      const baseHeight = 20 + Math.random() * maxBarHeight
      const barHeight = isAnimated ? baseHeight * 1.2 : baseHeight
      const x = i * (barWidth + 2) + 20
      const y = containerHeight - barHeight - 60

      bars.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${x}px`,
            bottom: "60px",
            width: `${barWidth}px`,
            height: `${barHeight}px`,
            background: isAnimated
              ? "linear-gradient(180deg, rgba(70, 167, 88, 0.6) 0%, rgba(70, 167, 88, 0.2) 100%)"
              : "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
            borderRadius: "2px",
            transition: "all 0.3s ease",
            opacity: isAnimated ? 1 : 0.6,
          }}
        />,
      )
    }
    return bars
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#000000",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          right: "20px",
          height: "40px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {/* Price skeleton */}
        <div
          style={{
            width: "120px",
            height: "24px",
            background:
              "linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 100%)",
            borderRadius: "4px",
            animation: "shimmer 2s infinite",
          }}
        />
        {/* Change skeleton */}
        <div
          style={{
            width: "80px",
            height: "20px",
            background:
              "linear-gradient(90deg, rgba(70, 167, 88, 0.1) 0%, rgba(70, 167, 88, 0.2) 50%, rgba(70, 167, 88, 0.1) 100%)",
            borderRadius: "4px",
            animation: "shimmer 2s infinite 0.5s",
          }}
        />
      </div>

      {/* Chart area with skeleton bars */}
      <div
        style={{
          position: "relative",
          flex: 1,
          marginTop: "80px",
          marginBottom: "40px",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        {generateSkeletonBars()}

        {/* Grid lines skeleton */}
        {[...Array(5)].map((_, i) => (
          <div
            key={`grid-h-${i}`}
            style={{
              position: "absolute",
              left: "20px",
              right: "20px",
              top: `${(i + 1) * 20}%`,
              height: "1px",
              background: "rgba(255, 255, 255, 0.05)",
            }}
          />
        ))}

        {[...Array(8)].map((_, i) => (
          <div
            key={`grid-v-${i}`}
            style={{
              position: "absolute",
              left: `${20 + (i + 1) * 12}%`,
              top: "0",
              bottom: "0",
              width: "1px",
              background: "rgba(255, 255, 255, 0.05)",
            }}
          />
        ))}

        {/* Y-axis labels skeleton */}
        {[...Array(6)].map((_, i) => (
          <div
            key={`y-label-${i}`}
            style={{
              position: "absolute",
              right: "5px",
              top: `${i * 16 + 10}%`,
              width: "50px",
              height: "12px",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "2px",
              animation: `shimmer 2s infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Bottom controls skeleton */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "20px",
          right: "20px",
          height: "30px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {/* X-axis labels skeleton */}
        {[...Array(6)].map((_, i) => (
          <div
            key={`x-label-${i}`}
            style={{
              width: "60px",
              height: "12px",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "2px",
              animation: `shimmer 2s infinite ${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Loading text */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#46A758",
          fontSize: "14px",
          fontWeight: "500",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: "8px" }}>Loading chart data...</div>
        <div style={{ fontSize: "12px", color: "#888", opacity: 0.8 }}>
          {symbol} • {timeframe}
        </div>
      </div>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes shimmer {
            0% {
              background-position: -200px 0;
            }
            100% {
              background-position: calc(200px + 100%) 0;
            }
          }
        `}
      </style>
    </div>
  )
}

interface LightweightChartProps {
  symbol?: string
  assetType?: string
  chartData?: any // The chart data from the sentiment payload (initial daily data)
  height?: number | string
  width?: number | string
}

interface CandlestickData {
  time: Time
  open: number
  high: number
  low: number
  close: number
}

interface VolumeData {
  time: Time
  value: number
  color?: string
}

interface LineData {
  time: Time
  value: number
}

// WebSocket message types
interface WebSocketPriceData {
  s: string // symbol
  t: number // timestamp (nanoseconds for stocks, milliseconds for crypto/forex)
  type: string // "Q" for quote, "T" for trade
  ap?: number // ask price
  as?: number // ask size
  bp?: number // bid price
  bs?: number // bid size
  lp?: number // last price
  ls?: number // last size
  e?: string // exchange (crypto only)
}

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D"

const getSubscriptionId = () => {
  try {
    // Legacy fallback for non-JWT authentication
    const subscription = localStorage.getItem("koyn_subscription")
    if (subscription) {
      const parsed = JSON.parse(subscription)
      return parsed.id || parsed.subscriptionId
    }

    // Check for legacy typo-ed key as well
    const subscriptionTypo = localStorage.getItem("koyn_sbscripton")
    if (subscriptionTypo) {
      const parsed = JSON.parse(subscriptionTypo)
      return parsed.id || parsed.subscriptionId
    }
  } catch (error) {
    console.warn("Error reading legacy subscription data:", error)
  }
  return null
}

// Asset type detection for WebSocket endpoints
const detectAssetType = (symbol: string): 'stock' | 'crypto' | 'forex' | 'unknown' => {
  if (!symbol) return 'unknown'
  
  const upperSymbol = symbol.toUpperCase()
  
  // Crypto detection
  if (
    upperSymbol.endsWith('USD') ||
    upperSymbol.endsWith('USDT') ||
    upperSymbol.endsWith('BTC') ||
    upperSymbol.endsWith('ETH') ||
    upperSymbol.includes('BTC') ||
    upperSymbol.includes('ETH') ||
    upperSymbol === 'BTCUSD' ||
    upperSymbol === 'ETHUSD'
  ) {
    return 'crypto'
  }
  
  // Forex detection (6-character pairs like EURUSD, GBPJPY)
  if (/^[A-Z]{6}$/.test(upperSymbol) && upperSymbol.length === 6) {
    const firstCurrency = upperSymbol.slice(0, 3)
    const secondCurrency = upperSymbol.slice(3, 6)
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SEK', 'NOK', 'DKK']
    
    if (currencies.includes(firstCurrency) && currencies.includes(secondCurrency)) {
      return 'forex'
    }
  }
  
  // Default to stock for everything else
  return 'stock'
}

// Get appropriate WebSocket URL based on asset type
const getWebSocketUrl = (assetType: 'stock' | 'crypto' | 'forex' | 'unknown'): string => {
  switch (assetType) {
    case 'crypto':
      return 'wss://crypto.financialmodelingprep.com'
    case 'forex':
      return 'wss://forex.financialmodelingprep.com'
    case 'stock':
    default:
      return 'wss://websockets.financialmodelingprep.com'
  }
}

// Convert symbol for WebSocket subscription
const getWebSocketSymbol = (symbol: string, assetType: 'stock' | 'crypto' | 'forex' | 'unknown'): string => {
  if (!symbol) return symbol
  
  const lowerSymbol = symbol.toLowerCase()
  
  switch (assetType) {
    case 'crypto':
      // For crypto, keep as is but ensure lowercase
      return lowerSymbol
    case 'forex':
      // For forex, keep as is but ensure lowercase
      return lowerSymbol
    case 'stock':
    default:
      // For stocks, ensure lowercase
      return lowerSymbol
  }
}

// Get FMP API key from backend
const getFMPApiKey = async (): Promise<string | null> => {
  try {
    const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://koyn.finance:3001"
    const response = await fetch(`${baseUrl}/api/fmp-key`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.apiKey || null
    }
    
    console.warn('Failed to get FMP API key from backend')
    return null
  } catch (error) {
    console.error('Error fetching FMP API key:', error)
    return null
  }
}

// Enhanced validation function for volume data points
const isValidVolumePoint = (item: any, timeframe: Timeframe): boolean => {
  if (!item || typeof item !== "object") return false

  // Validate time field
  const hasValidTime =
    item.time &&
    // For daily data: string timestamps (YYYY-MM-DD)
    ((timeframe === "1D" && typeof item.time === "string" && item.time.length > 0 && item.time !== "Invalid Date") ||
      // For intraday data: numeric timestamps (Unix timestamps)
      (timeframe !== "1D" && typeof item.time === "number" && isFinite(item.time) && item.time > 0))

  // Validate volume value
  const hasValidValue =
    typeof item.value === "number" &&
    !isNaN(item.value) &&
    isFinite(item.value) &&
    item.value > 0 &&
    item.value !== null &&
    item.value !== undefined

  // Validate color
  const hasValidColor =
    typeof item.color === "string" && item.color.length > 0 && item.color !== null && item.color !== undefined

  return hasValidTime && hasValidValue && hasValidColor
}

function LightweightChart({
  symbol = "BTCUSD",
  assetType,
  chartData,
  height = "100%",
  width = "100%",
}: LightweightChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const indicatorSeriesRef = useRef<{ [key: string]: ISeriesApi<"Line"> }>({})

  // Individual series refs for indicators
  const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdHistogramSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const wma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const dema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const tema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const stdDevSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const williamsSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const adxSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)

  // WebSocket related refs and state
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false)
  const [lastPrice, setLastPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [wsReconnectAttempts, setWsReconnectAttempts] = useState(0)
  const maxReconnectAttempts = 5

  // Get auth context for secure token access
  const { getSecureAccessToken } = useAuth()

  // Chart state
  const [timeframe, setTimeframe] = useState<Timeframe>("1D")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [currentData, setCurrentData] = useState<any>(null)

  // Indicator state variables
  const [showVolume, setShowVolume] = useState(true)
  const [showSMA20, setShowSMA20] = useState(true)
  const [showSMA50, setShowSMA50] = useState(true)
  const [showRSI, setShowRSI] = useState(false)
  const [showMACD, setShowMACD] = useState(false)
  const [showEMA20, setShowEMA20] = useState(false)
  const [showEMA50, setShowEMA50] = useState(false)
  const [showWMA20, setShowWMA20] = useState(false)
  const [showDEMA20, setShowDEMA20] = useState(false)
  const [showTEMA20, setShowTEMA20] = useState(false)
  const [showStdDev, setShowStdDev] = useState(false)
  const [showWilliams, setShowWilliams] = useState(false)
  const [showADX, setShowADX] = useState(false)
  const [showIndicatorsDropdown, setShowIndicatorsDropdown] = useState(false)

  // Data cache state
  const [dataCache, setDataCache] = useState<Map<Timeframe, any>>(new Map())

  // Indicator cache state (separate from main data cache)
  const [indicatorCache, setIndicatorCache] = useState<
    Map<string, { data: any; timestamp: number; expiresAt: number }>
  >(new Map())

  // Technical indicators state
  const [activeIndicators, setActiveIndicators] = useState<string[]>([])
  const [showIndicators, setShowIndicators] = useState(false)
  const [indicatorPanelPosition, setIndicatorPanelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Real-time streaming state - automatically enable for supported configurations
  const [enableStreaming, setEnableStreaming] = useState(false)

  // Detect asset type for current symbol
  const detectedAssetType = assetType || detectAssetType(symbol)

  // Check if streaming should be enabled (only for real-time timeframes)
  const canStream = ['1m', '5m'].includes(timeframe) && ['stock', 'crypto', 'forex'].includes(detectedAssetType)

  // Automatically enable streaming when conditions are met
  useEffect(() => {
    if (canStream) {
      setEnableStreaming(true)
      console.log(`Auto-enabling streaming for ${detectedAssetType} ${symbol} on ${timeframe} timeframe`)
    } else {
      setEnableStreaming(false)
      console.log(`Streaming not available for ${detectedAssetType} ${symbol} on ${timeframe} timeframe`)
    }
  }, [canStream, detectedAssetType, symbol, timeframe])

  // WebSocket connection management
  const connectWebSocket = async () => {
    if (!canStream) {
      console.log('WebSocket streaming not available for current configuration', {
        canStream,
        timeframe,
        detectedAssetType
      })
      return
    }

    try {
      // Get API key from backend
      const apiKey = await getFMPApiKey()
      if (!apiKey) {
        console.warn('No FMP API key available for WebSocket streaming')
        return
      }

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      const wsUrl = getWebSocketUrl(detectedAssetType as any)
      const wsSymbol = getWebSocketSymbol(symbol, detectedAssetType as any)

      console.log(`Auto-connecting to WebSocket: ${wsUrl} for symbol: ${wsSymbol}`)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log(`WebSocket auto-connected for ${detectedAssetType}: ${wsSymbol}`)
        setIsWebSocketConnected(true)
        setWsReconnectAttempts(0)

        // Send login message
        const loginMessage = {
          event: 'login',
          data: {
            apiKey: apiKey
          }
        }
        ws.send(JSON.stringify(loginMessage))

        // Send subscribe message
        const subscribeMessage = {
          event: 'subscribe',
          data: {
            ticker: wsSymbol
          }
        }
        ws.send(JSON.stringify(subscribeMessage))

        // Set up ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'ping' }))
          }
        }, 30000) // Ping every 30 seconds
      }

      ws.onmessage = (event) => {
        try {
          const data: WebSocketPriceData = JSON.parse(event.data)
          handleWebSocketData(data)
        } catch (error) {
          console.warn('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log(`WebSocket closed for ${detectedAssetType}: ${wsSymbol}`, event.code, event.reason)
        setIsWebSocketConnected(false)

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Attempt to reconnect if not intentionally closed and we haven't exceeded max attempts
        if (event.code !== 1000 && wsReconnectAttempts < maxReconnectAttempts && canStream) {
          const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 10000) // Exponential backoff, max 10s
          console.log(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${wsReconnectAttempts + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setWsReconnectAttempts(prev => prev + 1)
            connectWebSocket()
          }, delay)
        }
      }

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${detectedAssetType}:`, error)
      }

    } catch (error) {
      console.error('Error connecting to WebSocket:', error)
    }
  }

  // Handle incoming WebSocket price data
  const handleWebSocketData = (data: WebSocketPriceData) => {
    if (!data || data.s?.toLowerCase() !== symbol.toLowerCase()) {
      return // Ignore data for other symbols
    }

    console.log('Received WebSocket data:', data)

    // Extract price from the message
    let currentPrice: number | undefined

    if (data.type === 'Q') {
      // Quote message - use last price or mid price
      if (data.lp !== undefined) {
        currentPrice = data.lp
      } else if (data.ap !== undefined && data.bp !== undefined) {
        currentPrice = (data.ap + data.bp) / 2 // Mid price
      } else if (data.ap !== undefined) {
        currentPrice = data.ap
      } else if (data.bp !== undefined) {
        currentPrice = data.bp
      }
    } else if (data.type === 'T') {
      // Trade message - use last price
      currentPrice = data.lp
    }

    if (currentPrice !== undefined && currentPrice > 0) {
      // Update price state
      if (lastPrice !== null) {
        setPriceChange(currentPrice - lastPrice)
      }
      setLastPrice(currentPrice)

      // Update chart with real-time price
      updateChartWithRealTimePrice(currentPrice, data.t)
    }
  }

  // State for tracking current candle formation
  const [currentCandle, setCurrentCandle] = useState<CandlestickData | null>(null)
  const [currentCandleStartTime, setCurrentCandleStartTime] = useState<number | null>(null)

  // Get the timeframe interval in milliseconds
  const getTimeframeMs = (tf: Timeframe): number => {
    switch (tf) {
      case "1m": return 60 * 1000
      case "5m": return 5 * 60 * 1000
      case "15m": return 15 * 60 * 1000
      case "30m": return 30 * 60 * 1000
      case "1H": return 60 * 60 * 1000
      case "4H": return 4 * 60 * 60 * 1000
      case "1D": return 24 * 60 * 60 * 1000
      default: return 60 * 1000
    }
  }

  // Get the start time for the current timeframe period
  const getTimeframePeriodStart = (timestamp: number, tf: Timeframe): number => {
    const date = new Date(timestamp)
    
    switch (tf) {
      case "1m":
        date.setSeconds(0, 0)
        return date.getTime()
      case "5m":
        const minutes5 = Math.floor(date.getMinutes() / 5) * 5
        date.setMinutes(minutes5, 0, 0)
        return date.getTime()
      case "15m":
        const minutes15 = Math.floor(date.getMinutes() / 15) * 15
        date.setMinutes(minutes15, 0, 0)
        return date.getTime()
      case "30m":
        const minutes30 = Math.floor(date.getMinutes() / 30) * 30
        date.setMinutes(minutes30, 0, 0)
        return date.getTime()
      case "1H":
        date.setMinutes(0, 0, 0)
        return date.getTime()
      case "4H":
        const hours4 = Math.floor(date.getHours() / 4) * 4
        date.setHours(hours4, 0, 0, 0)
        return date.getTime()
      case "1D":
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      default:
        date.setSeconds(0, 0)
        return date.getTime()
    }
  }

  // Update chart with real-time price data
  const updateChartWithRealTimePrice = (price: number, timestamp: number) => {
    if (!candlestickSeriesRef.current) return

    try {
      // Convert timestamp based on asset type
      let chartTimestamp: number
      if (detectedAssetType === 'stock') {
        // Stock timestamps are in nanoseconds, convert to milliseconds
        chartTimestamp = Math.floor(timestamp / 1000000)
      } else {
        // Crypto/forex timestamps are in milliseconds
        chartTimestamp = timestamp
      }

      console.log('📊 Updating chart with real-time price:', {
        price,
        originalTimestamp: timestamp,
        chartTimestamp,
        timeframe,
        assetType: detectedAssetType
      })

      // Get the current timeframe period start
      const periodStart = getTimeframePeriodStart(chartTimestamp, timeframe)
      const chartTime = Math.floor(periodStart / 1000) as Time // Convert to seconds for chart

      console.log('🕐 Timeframe period calculation:', {
        periodStart: new Date(periodStart).toISOString(),
        chartTime,
        currentCandleStartTime,
        isNewPeriod: currentCandleStartTime !== periodStart
      })

      // Check if we're in a new timeframe period
      if (currentCandleStartTime !== periodStart) {
        console.log('🆕 Starting new candle period')
        
        // Starting a new candle period
        const newCandle: CandlestickData = {
          time: chartTime,
          open: price,
          high: price,
          low: price,
          close: price
        }

        setCurrentCandle(newCandle)
        setCurrentCandleStartTime(periodStart)
        
        // Update the chart with the new candle
        candlestickSeriesRef.current.update(newCandle)
        
        console.log('📈 Created new candle:', newCandle)
      } else if (currentCandle) {
        console.log('🔄 Updating existing candle')
        
        // Update the existing candle for the current period
        const updatedCandle: CandlestickData = {
          time: chartTime,
          open: currentCandle.open, // Keep original open
          high: Math.max(currentCandle.high, price), // Update high
          low: Math.min(currentCandle.low, price), // Update low
          close: price // Update close to current price
        }

        setCurrentCandle(updatedCandle)
        
        // Update the chart with the modified candle
        candlestickSeriesRef.current.update(updatedCandle)
        
        console.log('📊 Updated candle:', {
          original: currentCandle,
          updated: updatedCandle,
          priceChange: price - currentCandle.open
        })
      } else {
        console.log('🚀 Initializing first candle')
        
        // Initialize the first candle if currentCandle is null
        const newCandle: CandlestickData = {
          time: chartTime,
          open: price,
          high: price,
          low: price,
          close: price
        }

        setCurrentCandle(newCandle)
        setCurrentCandleStartTime(periodStart)
        candlestickSeriesRef.current.update(newCandle)
        
        console.log('🎯 Initialized first candle:', newCandle)
      }

    } catch (error) {
      console.warn('❌ Error updating chart with real-time price:', error)
    }
  }

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    console.log('Disconnecting WebSocket')

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect')
      wsRef.current = null
    }

    setIsWebSocketConnected(false)
    setWsReconnectAttempts(0)
  }

  // Reset current candle state when timeframe changes
  useEffect(() => {
    console.log('⏰ Timeframe changed to:', timeframe, '- Resetting candle state')
    setCurrentCandle(null)
    setCurrentCandleStartTime(null)
  }, [timeframe])

  // Effect to manage WebSocket connection based on streaming settings
  useEffect(() => {
    if (enableStreaming && canStream) {
      console.log('🔌 Connecting WebSocket for real-time candle painting')
      connectWebSocket()
    } else {
      console.log('🔌 Disconnecting WebSocket')
      disconnectWebSocket()
    }

    return () => {
      disconnectWebSocket()
    }
  }, [enableStreaming, symbol, timeframe, detectedAssetType])

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket()
    }
  }, [])

  // Memoized values for cache management
  const getCacheExpirationMs = (tf: Timeframe): number => {
    switch (tf) {
      case "1m":
      case "5m":
        return 60 * 1000 // 1 minute for very short timeframes
      case "15m":
      case "30m":
        return 5 * 60 * 1000 // 5 minutes for short timeframes
      case "1H":
      case "4H":
        return 15 * 60 * 1000 // 15 minutes for hourly timeframes
      case "1D":
        return 60 * 60 * 1000 // 1 hour for daily timeframe
      default:
        return 5 * 60 * 1000
    }
  }

  const getCachedData = (tf: Timeframe): any | null => {
    const cached = dataCache.get(tf)
    if (cached && cached.timestamp) {
      const expirationMs = getCacheExpirationMs(tf)
      const isExpired = Date.now() - cached.timestamp > expirationMs
      if (!isExpired) {
        console.log(
          `Using cached data for ${symbol} ${tf} (${Math.round((expirationMs - (Date.now() - cached.timestamp)) / 1000)}s remaining)`,
        )
        return cached.data
      } else {
        console.log(`Cache expired for ${symbol} ${tf}, will fetch fresh data`)
        // Remove expired cache entry
        const newCache = new Map(dataCache)
        newCache.delete(tf)
        setDataCache(newCache)
      }
    }
    return null
  }

  const setCachedData = (tf: Timeframe, data: any): void => {
    const newCache = new Map(dataCache)
    newCache.set(tf, {
      data,
      timestamp: Date.now(),
    })
    setDataCache(newCache)
    console.log(`Cached data for ${symbol} ${tf}`)
  }

  // Map timeframe to API-safe intervals
  const getApiSafeInterval = (interval: string): string => {
    const mapping: { [key: string]: string } = {
      "1m": "1min",
      "5m": "5min",
      "15m": "15min",
      "30m": "30min",
      "1H": "1hour",
      "4H": "4hour",
      "1D": "1day",
    }
    return mapping[interval] || interval
  }

  // Main function to fetch chart data from API
  const fetchChartData = async (tf: Timeframe): Promise<any> => {
    try {
      // Check cache first
      const cachedData = getCachedData(tf)
      if (cachedData) {
        return cachedData
      }

      console.log(`Fetching fresh data for ${symbol} ${tf}...`)

      const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://koyn.finance:3001"

      // Get JWT token for authentication using secure method
      console.log("🔄 Attempting to get secure access token...")
      const accessToken = await getSecureAccessToken()
      console.log("🎫 getSecureAccessToken result:", accessToken ? `${accessToken.substring(0, 20)}...` : "null")

      const headers: any = {}

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
        console.log("✅ Set Authorization header with JWT token")
      } else {
        // Fallback to legacy subscription ID for backward compatibility
        const subscriptionId = getSubscriptionId()
        console.log("⚠️ No JWT token, checking legacy subscription ID:", subscriptionId)
        if (subscriptionId) {
          console.warn("⚠️  Using legacy subscription ID authentication")
        } else {
          console.warn("⚠️  No authentication available")
        }
      }

      let response: Response
      const apiInterval = getApiSafeInterval(tf)

      console.log(`Fetching chart data for ${symbol} with timeframe ${tf} (API interval: ${apiInterval})`)
      console.log("🌐 Request headers:", headers)

      if (tf === "1D") {
        // Use EOD endpoint for daily data
        const url = new URL(`${baseUrl}/api/chart/eod`)
        url.searchParams.append("symbol", symbol)

        // Only add legacy subscription ID if no JWT token
        if (!accessToken) {
          const subscriptionId = getSubscriptionId()
          if (subscriptionId) {
            url.searchParams.append("id", subscriptionId)
          }
        }

        console.log("📡 Making request to:", url.toString())
        response = await fetch(url.toString(), { headers })
      } else {
        // Use regular chart endpoint for intraday data
        const url = new URL(`${baseUrl}/api/chart`)
        url.searchParams.append("symbol", symbol)
        url.searchParams.append("interval", apiInterval)

        // Only add legacy subscription ID if no JWT token
        if (!accessToken) {
          const subscriptionId = getSubscriptionId()
          if (subscriptionId) {
            url.searchParams.append("id", subscriptionId)
          }
        }

        console.log("📡 Making request to:", url.toString())
        response = await fetch(url.toString(), { headers })
      }

      console.log(`API Response status: ${response.status} for ${symbol} ${tf}`)

      if (!response.ok) {
        // Try to get error details from response
        const errorText = await response.text()
        console.error(`API error details:`, errorText)

        // Handle specific error codes
        if (response.status === 402) {
          throw new Error(
            `API quota exceeded. The FMP API has reached its payment limit for ${symbol}. Please try again later or contact support.`,
          )
        } else if (response.status === 401) {
          throw new Error(`Authentication failed. Please check your subscription status.`)
        } else if (response.status === 404) {
          throw new Error(`No data found for ${symbol} at ${tf} timeframe. This asset may not support intraday data.`)
        } else {
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }
      }

      const responseData = await response.json()
      if (!responseData || (!responseData.data && !Array.isArray(responseData))) {
        throw new Error("Invalid data format received")
      }

      // Validate that we have usable data before caching
      let hasValidData = false
      if (responseData.format === "eod" && Array.isArray(responseData.data) && responseData.data.length > 0) {
        hasValidData = responseData.data.some(
          (item: any) =>
            item &&
            typeof item.open === "number" &&
            typeof item.high === "number" &&
            typeof item.low === "number" &&
            typeof item.close === "number",
        )
      } else if (
        responseData.data &&
        responseData.data.datasets &&
        responseData.data.datasets[0]?.ohlc &&
        responseData.data.datasets[0].ohlc.length > 0
      ) {
        hasValidData = responseData.data.datasets[0].ohlc.some(
          (item: any) =>
            item &&
            typeof item.open === "number" &&
            typeof item.high === "number" &&
            typeof item.low === "number" &&
            typeof item.close === "number",
        )
      } else if (responseData.data && responseData.data.datasets && responseData.data.datasets[0]?.data && responseData.data.labels) {
        // Validate line chart data format (single price values that can be converted to candlestick)
        hasValidData =
          responseData.data.datasets[0].data.length > 0 &&
          responseData.data.datasets[0].data.some((price: any) => typeof price === "number" && price > 0) &&
          responseData.data.labels.length === responseData.data.datasets[0].data.length
      }

      if (!hasValidData) {
        throw new Error(`No valid OHLC or price data available in API response for ${symbol} ${tf}`)
      }

      console.log(`Successfully fetched chart data for ${symbol} ${tf}:`, {
        dataType: typeof responseData,
        hasData: !!responseData.data,
        format: responseData.format,
        dataLength: responseData.data ? (Array.isArray(responseData.data) ? responseData.data.length : "not array") : "no data",
        hasValidOHLC: hasValidData,
      })

      // Cache the validated data
      setCachedData(tf, responseData)

      return responseData
    } catch (error) {
      console.error(`Error fetching ${tf} data for ${symbol}:`, error)
      throw error
    }
  }

  // Enhanced validation function for individual data points
  const isValidDataPoint = (item: any, timeframe: Timeframe): boolean => {
    if (!item || typeof item !== "object") return false

    // Validate time field
    const hasValidTime =
      item.time &&
      // For daily data: string timestamps (YYYY-MM-DD)
      ((timeframe === "1D" && typeof item.time === "string" && item.time.length > 0 && item.time !== "Invalid Date") ||
        // For intraday data: numeric timestamps (Unix timestamps)
        (timeframe !== "1D" && typeof item.time === "number" && isFinite(item.time) && item.time > 0))

    // Validate OHLC values
    const hasValidOHLC =
      typeof item.open === "number" &&
      typeof item.high === "number" &&
      typeof item.low === "number" &&
      typeof item.close === "number" &&
      !isNaN(item.open) &&
      !isNaN(item.high) &&
      !isNaN(item.low) &&
      !isNaN(item.close) &&
      isFinite(item.open) &&
      isFinite(item.high) &&
      isFinite(item.low) &&
      isFinite(item.close) &&
      item.open > 0 &&
      item.high > 0 &&
      item.low > 0 &&
      item.close > 0 &&
      item.open !== null &&
      item.high !== null &&
      item.low !== null &&
      item.close !== null

    // Validate OHLC relationships
    const hasValidRelationships =
      item.high >= Math.max(item.open, item.close) && item.low <= Math.min(item.open, item.close)

    return hasValidTime && hasValidOHLC && hasValidRelationships
  }

  // Convert chart data to Lightweight Charts format (handles both embedded data and API responses)
  const convertDataToLightweightFormat = (
    dataSource: any,
  ): { candlestickData: CandlestickData[]; volumeData: VolumeData[] } => {
    const candlestickData: CandlestickData[] = []
    const volumeData: VolumeData[] = []

    console.log("Starting data conversion with source:", {
      format: dataSource.format,
      hasData: !!dataSource.data,
      dataType: typeof dataSource.data,
      isArray: Array.isArray(dataSource.data),
      dataLength: dataSource.data ? (Array.isArray(dataSource.data) ? dataSource.data.length : "not array") : "no data",
      hasDatasets: !!(dataSource.data && dataSource.data.datasets),
      hasOHLC: !!(
        dataSource.data &&
        dataSource.data.datasets &&
        dataSource.data.datasets[0] &&
        dataSource.data.datasets[0].ohlc
      ),
      hasPriceData: !!(
        dataSource.data &&
        dataSource.data.datasets &&
        dataSource.data.datasets[0] &&
        dataSource.data.datasets[0].data
      ),
      hasTimestamps: !!dataSource.timestamps,
      timestampsLength: dataSource.timestamps ? dataSource.timestamps.length : 0,
    })

    try {
      // Handle EOD format (from API for daily data)
      if (dataSource.format === "eod" && Array.isArray(dataSource.data)) {
        console.log(`Processing EOD format with ${dataSource.data.length} data points`)
        const timestamps = dataSource.timestamps || []

        const dataWithTimestamps = dataSource.data.map((item: any, index: number) => ({
          ...item,
          timestamp: timestamps[index] || new Date(item.date).getTime(),
        }))

        const sortedData = dataWithTimestamps.sort((a: any, b: any) => a.timestamp - b.timestamp)

        let processedCount = 0
        let skippedCount = 0

        sortedData.forEach((item: any) => {
          // Validate all required fields are present and not null/undefined
          const open = Number(item.open)
          const high = Number(item.high)
          const low = Number(item.low)
          const close = Number(item.close)
          const volume = Number(item.volume) || 0

          // Skip invalid data points
          if (
            isNaN(open) ||
            isNaN(high) ||
            isNaN(low) ||
            isNaN(close) ||
            !isFinite(open) ||
            !isFinite(high) ||
            !isFinite(low) ||
            !isFinite(close) ||
            open <= 0 ||
            high <= 0 ||
            low <= 0 ||
            close <= 0
          ) {
            console.warn("Skipping invalid EOD OHLC data point:", item)
            skippedCount++
            return
          }

          const timeString = new Date(item.timestamp).toISOString().split("T")[0]

          candlestickData.push({
            time: timeString,
            open: open,
            high: high,
            low: low,
            close: close,
          })

          // Enhanced volume validation for EOD format
          if (timeString && timeString !== "" && timeString !== "Invalid Date") {
            // Ensure volume is a valid number with comprehensive validation
            let validVolume = Number(volume) || 0
            if (
              isNaN(validVolume) ||
              !isFinite(validVolume) ||
              validVolume < 0 ||
              validVolume === null ||
              validVolume === undefined
            ) {
              validVolume = Math.round(1000000 * (1 + (Math.random() - 0.5) * 0.3))
            }

            // Additional safety check before adding to volume data
            if (validVolume > 0 && isFinite(validVolume)) {
              volumeData.push({
                time: timeString,
                value: validVolume,
                color: close >= open ? "#46A758" : "#E5484D",
              })
            }
          }

          processedCount++
        })

        console.log(`EOD processing complete: ${processedCount} processed, ${skippedCount} skipped`)
      }
      // Handle regular API format with OHLC data (intraday data)
      else if (
        dataSource.data &&
        dataSource.data.datasets &&
        dataSource.data.datasets[0]?.ohlc &&
        dataSource.data.labels
      ) {
        const labels = dataSource.data.labels || []
        const prices = dataSource.data.datasets[0]?.data || []
        const volumes = dataSource.data.datasets[1]?.data || []
        const ohlcData = dataSource.data.datasets[0]?.ohlc || []
        const timestamps = dataSource.timestamps || []

        console.log(
          `Processing intraday OHLC data: ${labels.length} labels, ${ohlcData.length} OHLC points, ${timestamps.length} timestamps`,
        )

        // Use API timestamps if available, otherwise generate from labels
        const finalTimestamps =
          timestamps && timestamps.length === labels.length ? timestamps : generateTimestampsFromLabels(labels)

        let processedCount = 0
        let skippedCount = 0

        // Process OHLC data points
        ohlcData.forEach((ohlc: any, index: number) => {
          // Skip if no corresponding timestamp
          if (index >= finalTimestamps.length) {
            skippedCount++
            return
          }

          // Validate OHLC data
          const open = Number(ohlc.open)
          const high = Number(ohlc.high)
          const low = Number(ohlc.low)
          const close = Number(ohlc.close)
          const volume = Number(volumes[index]) || 0

          // Skip invalid data points - comprehensive validation
          if (
            !ohlc ||
            ohlc.open == null ||
            ohlc.high == null ||
            ohlc.low == null ||
            ohlc.close == null ||
            isNaN(open) ||
            isNaN(high) ||
            isNaN(low) ||
            isNaN(close) ||
            !isFinite(open) ||
            !isFinite(high) ||
            !isFinite(low) ||
            !isFinite(close) ||
            open <= 0 ||
            high <= 0 ||
            low <= 0 ||
            close <= 0 ||
            high < Math.max(open, close) ||
            low > Math.min(open, close)
          ) {
            console.warn("Skipping invalid intraday OHLC data point at index", index, ":", ohlc)
            skippedCount++
            return
          }

          const timestamp = finalTimestamps[index]
          const timeValue = (
            timeframe === "1D"
              ? new Date(timestamp).toISOString().split("T")[0] // YYYY-MM-DD string for daily
              : Math.floor(timestamp / 1000)
          ) as Time // Unix timestamp as number for intraday

          candlestickData.push({
            time: timeValue,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
          })

          // Enhanced volume validation for intraday OHLC format
          if (timeValue !== null && timeValue !== undefined && timeValue !== "" && timeValue !== "Invalid Date") {
            // Ensure volume is a valid number with comprehensive validation
            let validVolume = Number(volume) || 0
            if (
              isNaN(validVolume) ||
              !isFinite(validVolume) ||
              validVolume < 0 ||
              validVolume === null ||
              validVolume === undefined
            ) {
              validVolume = Math.round(1000000 * (1 + (Math.random() - 0.5) * 0.3))
            }

            // Additional safety check before adding to volume data
            if (validVolume > 0 && isFinite(validVolume)) {
              volumeData.push({
                time: timeValue,
                value: validVolume,
                color: close >= open ? "#46A758" : "#E5484D",
              })
            }
          }

          processedCount++
        })

        console.log(`Intraday OHLC processing complete: ${processedCount} processed, ${skippedCount} skipped`)
        console.log("OHLC conversion results:", {
          candlestickDataLength: candlestickData.length,
          volumeDataLength: volumeData.length,
          firstCandlestick: candlestickData[0],
          lastCandlestick: candlestickData[candlestickData.length - 1],
        })
      }
      // Handle line chart data format (convert single prices to candlestick format)
      else if (
        dataSource.data &&
        dataSource.data.datasets &&
        dataSource.data.datasets[0]?.data &&
        dataSource.data.labels
      ) {
        const labels = dataSource.data.labels || []
        const prices = dataSource.data.datasets[0]?.data || []
        // Look for timestamps in multiple locations
        const timestamps = dataSource.timestamps || dataSource.data.timestamps || []

        console.log(
          `Processing line chart data (converting to candlestick): ${labels.length} labels, ${prices.length} price points, ${timestamps.length} timestamps`,
        )
        console.log("Timestamp sources:", {
          hasDataSourceTimestamps: !!dataSource.timestamps,
          hasDataTimestamps: !!dataSource.data.timestamps,
          timestampSample: timestamps.slice(0, 3),
        })

        if (prices.length === 0) {
          console.error("No price data found in line chart format!")
          return { candlestickData: [], volumeData: [] }
        }

        // Use API timestamps if available, otherwise generate from labels
        const finalTimestamps =
          timestamps && timestamps.length === labels.length ? timestamps : generateTimestampsFromLabels(labels)

        console.log("Final timestamps for conversion:", {
          timestampCount: finalTimestamps.length,
          timestampSample: finalTimestamps.slice(0, 3),
          generatedFromLabels: !timestamps || timestamps.length !== labels.length,
        })

        let processedCount = 0
        let skippedCount = 0

        // Convert line chart data to candlestick format
        prices.forEach((price: any, index: number) => {
          // Skip if no corresponding timestamp
          if (index >= finalTimestamps.length) {
            console.warn(
              `Skipping price at index ${index}: no corresponding timestamp (${finalTimestamps.length} timestamps available)`,
            )
            skippedCount++
            return
          }

          const currentPrice = Number(price)

          // Skip invalid price points
          if (isNaN(currentPrice) || !isFinite(currentPrice) || currentPrice <= 0) {
            console.warn("Skipping invalid price data point at index", index, ":", price)
            skippedCount++
            return
          }

          // For line chart data, we need to simulate OHLC from single price points
          // We'll create a small range around each price point to simulate volatility
          const priceVariation = currentPrice * 0.001 // 0.1% variation
          const open = index > 0 ? Number(prices[index - 1]) : currentPrice
          const close = currentPrice
          const high = Math.max(open, close) + priceVariation
          const low = Math.min(open, close) - priceVariation

          const timestamp = finalTimestamps[index]
          const timeValue = (
            timeframe === "1D"
              ? new Date(timestamp).toISOString().split("T")[0] // YYYY-MM-DD string for daily
              : Math.floor(timestamp / 1000)
          ) as Time // Unix timestamp as number for intraday

          // Debug the conversion for first few points
          if (index < 3) {
            console.log(`Converting price point ${index}:`, {
              originalPrice: price,
              currentPrice: currentPrice,
              open: open,
              high: high,
              low: low,
              close: close,
              timestamp: timestamp,
              timeValue: timeValue,
              timeframe: timeframe,
            })
          }

          candlestickData.push({
            time: timeValue,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(low.toFixed(2)),
            close: Number(close.toFixed(2)),
          })

          // Enhanced synthetic volume generation for line chart format
          if (timeValue !== null && timeValue !== undefined && timeValue !== "" && timeValue !== "Invalid Date") {
            const baseVolume = 1000000
            const volumeVariation = baseVolume * (0.5 + Math.random() * 0.5) // Random volume between 50% and 100% of base
            const syntheticVolume = Math.round(volumeVariation)

            // Additional safety check for synthetic volume
            if (syntheticVolume > 0 && isFinite(syntheticVolume)) {
              volumeData.push({
                time: timeValue,
                value: syntheticVolume,
                color: close >= open ? "#46A758" : "#E5484D",
              })
            }
          }

          processedCount++
        })

        console.log(`Line chart conversion complete: ${processedCount} processed, ${skippedCount} skipped`)
      } else {
        console.error("Unrecognized data format:", {
          hasData: !!dataSource.data,
          format: dataSource.format,
          hasDatasets: !!(dataSource.data && dataSource.data.datasets),
          hasLabels: !!(dataSource.data && dataSource.data.labels),
          isArray: Array.isArray(dataSource.data),
          datasetStructure: dataSource.data && dataSource.data.datasets ? dataSource.data.datasets[0] : null,
        })
      }
    } catch (error) {
      console.error("Error converting chart data:", error)
    }

    // Enhanced validation - ensure we have valid data and filter using the enhanced validation function
    const validCandlestickData = candlestickData.filter((item, index) => {
      const isValid = isValidDataPoint(item, timeframe)

      // Debug invalid data points (only first few for troubleshooting)
      if (!isValid && index < 2) {
        console.log(`Filtering out invalid candlestick data at index ${index}:`, item)
      }

      return isValid
    })

    const validVolumeData = volumeData.filter((item) => {
      const hasValidTime =
        item &&
        item.time &&
        // For daily data: string timestamps (YYYY-MM-DD)
        ((timeframe === "1D" && typeof item.time === "string" && item.time.length > 0) ||
          // For intraday data: numeric timestamps (Unix timestamps)
          (timeframe !== "1D" && typeof item.time === "number" && isFinite(item.time) && item.time > 0))

      const hasValidValue = item && item.value != null && !isNaN(item.value) && isFinite(item.value) && item.value >= 0

      return hasValidTime && hasValidValue
    })

    console.log(
      `Data validation: ${candlestickData.length} → ${validCandlestickData.length} candlestick points, ${volumeData.length} → ${validVolumeData.length} volume points`,
    )

    // Check if all data was filtered out and provide detailed error
    if (candlestickData.length > 0 && validCandlestickData.length === 0) {
      console.error("All candlestick data points were invalid after filtering. Sample data:", {
        totalCount: candlestickData.length,
        firstFew: candlestickData.slice(0, 3),
        lastFew: candlestickData.slice(-3),
        timeFrameUsed: timeframe,
      })
      throw new Error("All candlestick data points were invalid after filtering")
    }

    return {
      candlestickData: validCandlestickData,
      volumeData: validVolumeData,
    }
  }

  // Generate timestamps from labels for intraday data
  const generateTimestampsFromLabels = (labels: any[]): number[] => {
    const now = new Date()
    const currentUTC = new Date(now.getTime())

    // Get time multiplier based on timeframe
    let timeMultiplier: number
    switch (timeframe) {
      case "1m":
        timeMultiplier = 60 * 1000
        break
      case "5m":
        timeMultiplier = 5 * 60 * 1000
        break
      case "15m":
        timeMultiplier = 15 * 60 * 1000
        break
      case "30m":
        timeMultiplier = 30 * 60 * 1000
        break
      case "1H":
        timeMultiplier = 60 * 60 * 1000
        break
      case "4H":
        timeMultiplier = 4 * 60 * 60 * 1000
        break
      case "1D":
        timeMultiplier = 24 * 60 * 60 * 1000
        break
      default:
        timeMultiplier = 60 * 60 * 1000
    }

    if (timeframe !== "1D") {
      currentUTC.setUTCMinutes(0, 0, 0)
      return labels.map((_, index) => {
        const intervalsBack = labels.length - 1 - index
        return currentUTC.getTime() - intervalsBack * timeMultiplier
      })
    }

    // For daily data, parse labels as dates
    return labels.map((label: any) => {
      try {
        const parsedDate = new Date(String(label).trim())
        return isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime()
      } catch {
        return Date.now()
      }
    })
  }
  // Calculate RSI (Relative Strength Index)
  const calculateRSI = (data: CandlestickData[], period = 14): LineData[] => {
    const rsiData: LineData[] = []

    if (!data || !Array.isArray(data) || data.length < period + 1) {
      console.warn(`Insufficient data for RSI calculation: ${data?.length || 0} points, need ${period + 1}`)
      return rsiData
    }

    const gains: number[] = []
    const losses: number[] = []

    // Calculate price changes with enhanced validation
    for (let i = 1; i < data.length; i++) {
      const currentClose = data[i]?.close
      const previousClose = data[i - 1]?.close

      if (
        currentClose !== null &&
        currentClose !== undefined &&
        !isNaN(currentClose) &&
        isFinite(currentClose) &&
        previousClose !== null &&
        previousClose !== undefined &&
        !isNaN(previousClose) &&
        isFinite(previousClose)
      ) {
        const change = currentClose - previousClose
        gains.push(change > 0 ? change : 0)
        losses.push(change < 0 ? Math.abs(change) : 0)
      } else {
        gains.push(0)
        losses.push(0)
      }
    }

    if (gains.length < period || losses.length < period) {
      console.warn("Insufficient valid price changes for RSI calculation")
      return []
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period

    // Calculate RSI for the first point
    if (avgLoss !== 0 && isFinite(avgGain) && isFinite(avgLoss)) {
      const rs = avgGain / avgLoss
      const rsi = 100 - 100 / (1 + rs)

      if (data[period] && !isNaN(rsi) && isFinite(rsi) && rsi >= 0 && rsi <= 100) {
        rsiData.push({
          time: data[period].time, // Use exact same time reference
          value: Number(rsi.toFixed(2)),
        })
      }
    }

    // Calculate RSI for remaining points using smoothed averages
    for (let i = period + 1; i < data.length; i++) {
      if (i - 1 < gains.length && i - 1 < losses.length) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period
        avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period

        if (avgLoss !== 0 && isFinite(avgGain) && isFinite(avgLoss)) {
          const rs = avgGain / avgLoss
          const rsi = 100 - 100 / (1 + rs)

          if (data[i] && !isNaN(rsi) && isFinite(rsi) && rsi >= 0 && rsi <= 100) {
            rsiData.push({
              time: data[i].time, // Use exact same time reference
              value: Number(rsi.toFixed(2)),
            })
          }
        }
      }
    }

    console.log(`RSI calculation: ${data.length} input points → ${rsiData.length} RSI points`)
    return rsiData
  }

  // Calculate EMA (Exponential Moving Average)
  const calculateEMA = (data: CandlestickData[], period: number): LineData[] => {
    const emaData: LineData[] = []

    if (!data || !Array.isArray(data) || data.length < period) {
      return []
    }

    const multiplier = 2 / (period + 1)

    // Start with SMA for the first EMA value - enhanced validation
    let sum = 0
    let validCount = 0
    for (let i = 0; i < period; i++) {
      const close = data[i]?.close
      if (close !== null && close !== undefined && !isNaN(close) && isFinite(close)) {
        sum += close
        validCount++
      }
    }

    if (validCount < Math.floor(period * 0.8)) {
      console.warn("Insufficient valid data for EMA calculation")
      return []
    }

    let ema = sum / validCount

    if (data[period - 1] && !isNaN(ema) && isFinite(ema)) {
      emaData.push({
        time: data[period - 1].time, // Use exact same time reference
        value: Number(ema.toFixed(4)),
      })
    }

    // Calculate EMA for remaining points
    for (let i = period; i < data.length; i++) {
      const close = data[i]?.close
      if (close !== null && close !== undefined && !isNaN(close) && isFinite(close)) {
        ema = close * multiplier + ema * (1 - multiplier)

        if (data[i] && !isNaN(ema) && isFinite(ema)) {
          emaData.push({
            time: data[i].time, // Use exact same time reference
            value: Number(ema.toFixed(4)),
          })
        }
      }
    }

    return emaData
  }

  // Calculate MACD (Moving Average Convergence Divergence)
  const calculateMACD = (
    data: CandlestickData[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
  ): {
    macdLine: LineData[]
    signalLine: LineData[]
    histogram: VolumeData[]
  } => {
    const result = {
      macdLine: [] as LineData[],
      signalLine: [] as LineData[],
      histogram: [] as VolumeData[],
    }

    if (!data || !Array.isArray(data) || data.length < slowPeriod) {
      console.warn(`Insufficient data for MACD calculation: ${data?.length || 0} points, need ${slowPeriod}`)
      return result
    }

    // Calculate EMAs
    const fastEMA = calculateEMA(data, fastPeriod)
    const slowEMA = calculateEMA(data, slowPeriod)

    if (fastEMA.length === 0 || slowEMA.length === 0) {
      console.warn("Failed to calculate EMAs for MACD")
      return result
    }

    // Calculate MACD line (fast EMA - slow EMA)
    const macdValues: number[] = []
    const macdTimes: Time[] = []

    // Find the overlapping period where both EMAs are available
    const slowStartIndex = slowPeriod - 1
    const fastStartIndex = fastPeriod - 1

    for (let i = 0; i < data.length; i++) {
      if (i >= slowStartIndex) {
        const fastEMAIndex = i - fastStartIndex
        const slowEMAIndex = i - slowStartIndex

        if (fastEMAIndex >= 0 && fastEMAIndex < fastEMA.length && slowEMAIndex >= 0 && slowEMAIndex < slowEMA.length) {
          const fastValue = fastEMA[fastEMAIndex]?.value
          const slowValue = slowEMA[slowEMAIndex]?.value

          if (
            fastValue !== null &&
            fastValue !== undefined &&
            !isNaN(fastValue) &&
            isFinite(fastValue) &&
            slowValue !== null &&
            slowValue !== undefined &&
            !isNaN(slowValue) &&
            isFinite(slowValue)
          ) {
            const macdValue = fastValue - slowValue
            if (!isNaN(macdValue) && isFinite(macdValue)) {
              macdValues.push(macdValue)
              macdTimes.push(data[i].time)

              result.macdLine.push({
                time: data[i].time, // Use exact same time reference
                value: Number(macdValue.toFixed(4)),
              })
            }
          }
        }
      }
    }

    // Calculate Signal line (EMA of MACD line)
    if (macdValues.length >= signalPeriod) {
      const multiplier = 2 / (signalPeriod + 1)

      // Start with SMA for the first signal value
      let sum = 0
      for (let i = 0; i < signalPeriod; i++) {
        sum += macdValues[i]
      }
      let signalEMA = sum / signalPeriod

      if (!isNaN(signalEMA) && isFinite(signalEMA)) {
        result.signalLine.push({
          time: macdTimes[signalPeriod - 1], // Use exact same time reference
          value: Number(signalEMA.toFixed(4)),
        })

        // Calculate histogram for first signal point
        const histogramValue = macdValues[signalPeriod - 1] - signalEMA
        if (!isNaN(histogramValue) && isFinite(histogramValue)) {
          result.histogram.push({
            time: macdTimes[signalPeriod - 1], // Use exact same time reference
            value: Number(histogramValue.toFixed(4)),
            color: histogramValue >= 0 ? "#46A758" : "#E5484D",
          })
        }
      }

      // Calculate remaining signal line and histogram
      for (let i = signalPeriod; i < macdValues.length; i++) {
        signalEMA = macdValues[i] * multiplier + signalEMA * (1 - multiplier)

        if (!isNaN(signalEMA) && isFinite(signalEMA)) {
          result.signalLine.push({
            time: macdTimes[i], // Use exact same time reference
            value: Number(signalEMA.toFixed(4)),
          })

          const histogramValue = macdValues[i] - signalEMA
          if (!isNaN(histogramValue) && isFinite(histogramValue)) {
            result.histogram.push({
              time: macdTimes[i], // Use exact same time reference
              value: Number(histogramValue.toFixed(4)),
              color: histogramValue >= 0 ? "#46A758" : "#E5484D",
            })
          }
        }
      }
    }

    console.log(
      `MACD calculation: ${data.length} input points → ${result.macdLine.length} MACD points, ${result.signalLine.length} signal points, ${result.histogram.length} histogram points`,
    )
    return result
  }

  // Enhanced Calculate Simple Moving Average with comprehensive null checking
  const calculateSMA = (data: CandlestickData[], period: number): LineData[] => {
    const smaData: LineData[] = []

    // Validate input data
    if (!data || !Array.isArray(data) || data.length < period) {
      console.warn(`Insufficient data for SMA${period} calculation: ${data?.length || 0} points, need ${period}`)
      return []
    }

    for (let i = period - 1; i < data.length; i++) {
      let sum = 0
      let validCount = 0

      // Calculate sum with null checking
      for (let j = 0; j < period; j++) {
        const dataPoint = data[i - j]
        if (
          dataPoint &&
          dataPoint.close !== null &&
          dataPoint.close !== undefined &&
          !isNaN(dataPoint.close) &&
          isFinite(dataPoint.close)
        ) {
          sum += dataPoint.close
          validCount++
        }
      }

      // Only add SMA point if we have enough valid data points
      if (validCount >= Math.floor(period * 0.8)) {
        // Allow up to 20% missing data
        const smaValue = sum / validCount
        const currentDataPoint = data[i]

        // Enhanced validation: ensure time format matches exactly and value is valid
        if (
          currentDataPoint &&
          currentDataPoint.time !== null &&
          currentDataPoint.time !== undefined &&
          !isNaN(smaValue) &&
          isFinite(smaValue) &&
          smaValue > 0
        ) {
          smaData.push({
            time: currentDataPoint.time, // Use exact same time reference
            value: Number(smaValue.toFixed(2)),
          })
        }
      }
    }

    console.log(`SMA${period} calculation: ${data.length} input points → ${smaData.length} SMA points`)
    return smaData
  }

  // Fetch technical indicators from API
  const fetchTechnicalIndicators = async (indicatorTypes: string[]): Promise<any> => {
    try {
      // Get authentication using secure method
      const accessToken = await getSecureAccessToken()
      const headers: any = {}

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
        console.log("Using secure JWT token authentication for indicators")
      } else {
        const subscriptionId = getSubscriptionId()
        if (!subscriptionId) {
          console.warn("No authentication available for technical indicators")
          return null
        }
      }

      const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://koyn.finance:3001"
      const indicatorParam = indicatorTypes.join(",")

      // Check cache first
      const cacheKey = `${symbol}-${indicatorParam}-${timeframe}`
      const cached = indicatorCache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        console.log(`Using cached indicator data for ${symbol} ${indicatorParam}`)
        return cached.data
      }

      console.log(`Fetching technical indicators: ${indicatorParam} for ${symbol}`)

      const url = new URL(`${baseUrl}/api/technical-indicators`)
      url.searchParams.append("symbol", symbol)
      url.searchParams.append("type", indicatorParam)

      // Only add legacy subscription ID if no JWT token
      if (!accessToken) {
        const subscriptionId = getSubscriptionId()
        if (subscriptionId) {
          url.searchParams.append("id", subscriptionId)
        }
      }

      const response = await fetch(url.toString(), { headers })

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Unauthorized access to technical indicators - authentication required")
          return null
        }
        throw new Error(`Failed to fetch indicators: ${response.status}`)
      }

      const data = await response.json()

      // Cache the data (5 minutes for most timeframes, 1 hour for daily)
      const expirationMs = timeframe === "1D" ? 60 * 60 * 1000 : 5 * 60 * 1000
      const expiresAt = Date.now() + expirationMs

      setIndicatorCache(
        (prev) =>
          new Map(
            prev.set(cacheKey, {
              data,
              timestamp: Date.now(),
              expiresAt,
            }),
          ),
      )

      console.log(
        `Cached indicator data for ${symbol} ${indicatorParam}, expires in ${Math.round(expirationMs / 1000)}s`,
      )
      return data
    } catch (error) {
      console.error("Error fetching technical indicators:", error)
      return null
    }
  }

  // Fetch specific technical indicator with detailed data
  const fetchSpecificIndicator = async (indicatorType: string, periodLength = 14): Promise<any> => {
    try {
      // Get authentication using secure method
      const accessToken = await getSecureAccessToken()
      const headers: any = {}

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
        console.log("Using secure JWT token authentication for specific indicator")
      } else {
        const subscriptionId = getSubscriptionId()
        if (!subscriptionId) {
          console.warn("No authentication available for specific indicator")
          return null
        }
      }

      const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://koyn.finance:3001"

      // Check cache first
      const cacheKey = `${symbol}-${indicatorType}-${periodLength}-${timeframe}`
      const cached = indicatorCache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        console.log(`Using cached specific indicator data for ${symbol} ${indicatorType}`)
        return cached.data
      }

      // Map timeframe to API format
      const apiTimeframe = getApiSafeInterval(timeframe)

      console.log(`Fetching specific indicator: ${indicatorType} for ${symbol} with period ${periodLength}`)

      const url = new URL(`${baseUrl}/api/technical-indicator`)
      url.searchParams.append("indicator", indicatorType)
      url.searchParams.append("symbol", symbol)
      url.searchParams.append("periodLength", periodLength.toString())
      url.searchParams.append("timeframe", apiTimeframe)

      // Only add legacy subscription ID if no JWT token
      if (!accessToken) {
        const subscriptionId = getSubscriptionId()
        if (subscriptionId) {
          url.searchParams.append("id", subscriptionId)
        }
      }

      const response = await fetch(url.toString(), { headers })

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("Unauthorized access to specific indicator - authentication required")
          return null
        }
        throw new Error(`Failed to fetch specific indicator: ${response.status}`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        // Cache the data
        const expirationMs = timeframe === "1D" ? 60 * 60 * 1000 : 5 * 60 * 1000
        const expiresAt = Date.now() + expirationMs

        setIndicatorCache(
          (prev) =>
            new Map(
              prev.set(cacheKey, {
                data: result.data,
                timestamp: Date.now(),
                expiresAt,
              }),
            ),
        )

        console.log(`Cached specific indicator data for ${symbol} ${indicatorType}`)
        return result.data
      }

      return null
    } catch (error) {
      console.error("Error fetching specific indicator:", error)
      return null
    }
  }

  // Convert API indicator data to LightweightChart format
  const convertIndicatorToChartFormat = (indicatorData: any, indicatorType: string): LineData[] => {
    console.log(`Converting ${indicatorType} indicator data:`, {
      dataType: typeof indicatorData,
      isArray: Array.isArray(indicatorData),
      length: indicatorData?.length,
      sampleData: indicatorData?.slice?.(0, 3),
    })

    if (!indicatorData || !Array.isArray(indicatorData)) {
      console.warn(`Invalid ${indicatorType} data format:`, indicatorData)
      return []
    }

    const chartData: LineData[] = []

    indicatorData.forEach((item: any, index: number) => {
      // Log first few items to understand the data structure
      if (index < 3) {
        console.log(`${indicatorType} item ${index}:`, item)
      }

      if (item && (item.date || item.time)) {
        const dateField = item.date || item.time
        const valueField =
          item.value !== undefined
            ? item.value
            : item[indicatorType?.toLowerCase()] ||
              item.sma ||
              item.ema ||
              item.wma ||
              item.dema ||
              item.tema ||
              item.rsi ||
              item.standardDeviation ||
              item.williams ||
              item.adx

        if (valueField !== null && valueField !== undefined) {
          // Handle different date formats
          let timeValue: Time

          if (timeframe === "1D") {
            // For daily data, use date string format
            if (typeof dateField === "string") {
              // Already a date string
              timeValue = dateField as Time
            } else {
              // Convert timestamp to date string
              timeValue = new Date(dateField).toISOString().split("T")[0] as Time
            }
          } else {
            // For intraday data, use Unix timestamp
            if (typeof dateField === "string") {
              // Convert date string to Unix timestamp
              timeValue = Math.floor(new Date(dateField).getTime() / 1000) as Time
            } else {
              // Already a timestamp, ensure it's in seconds
              timeValue = (dateField > 9999999999 ? Math.floor(dateField / 1000) : dateField) as Time
            }
          }

          const value = Number(valueField)
          if (!isNaN(value) && isFinite(value)) {
            chartData.push({
              time: timeValue,
              value: Number(value.toFixed(indicatorType === "rsi" ? 2 : 4)),
            })
          } else {
            console.warn(`Invalid ${indicatorType} value at index ${index}:`, valueField)
          }
        } else {
          console.warn(`Missing ${indicatorType} value at index ${index}:`, item)
        }
      } else {
        console.warn(`Missing date/time field in ${indicatorType} data at index ${index}:`, item)
      }
    })

    // Sort by time to ensure proper order
    chartData.sort((a, b) => {
      let timeA: number, timeB: number

      if (typeof a.time === "string" && typeof b.time === "string") {
        timeA = new Date(a.time).getTime()
        timeB = new Date(b.time).getTime()
      } else if (typeof a.time === "number" && typeof b.time === "number") {
        timeA = a.time > 9999999999 ? a.time : a.time * 1000
        timeB = b.time > 9999999999 ? b.time : b.time * 1000
      } else {
        // Mixed types
        timeA = typeof a.time === "string" ? new Date(a.time).getTime() : (a.time as number) * 1000
        timeB = typeof b.time === "string" ? new Date(b.time).getTime() : (b.time as number) * 1000
      }

      return timeA - timeB
    })

    console.log(`Converted ${indicatorType} data: ${indicatorData.length} → ${chartData.length} chart points`, {
      firstPoint: chartData[0],
      lastPoint: chartData[chartData.length - 1],
    })

    return chartData
  }

  useEffect(() => {
    let mounted = true
    let initializationPromise: Promise<void> | null = null

    const initializeChart = async () => {
      try {
        setIsLoading(true)
        setError(null)

        console.log("Lightweight Chart Debug:", {
          symbol: symbol,
          assetType: assetType,
          timeframe: timeframe,
          hasChartData: !!chartData,
          hasCurrentData: !!currentData,
          chartDataStructure: chartData
            ? {
                hasData: !!chartData.data,
                hasDatasets: !!(chartData.data && chartData.data.datasets),
                datasetLength: chartData.data && chartData.data.datasets ? chartData.data.datasets.length : 0,
                hasLabels: !!(chartData.data && chartData.data.labels),
                labelsLength: chartData.data && chartData.labels ? chartData.data.labels.length : 0,
              }
            : "no chart data",
        })

        // Determine data source and ensure we have valid data
        let dataToUse = null

        if (timeframe === "1D" && chartData) {
          // Use embedded chart data for daily view (initial load)
          dataToUse = chartData
          console.log("Using embedded chart data for 1D timeframe")
        } else {
          // Check cache first, then currentData, then fetch fresh
          const cachedData = getCachedData(timeframe)
          if (cachedData) {
            dataToUse = cachedData
            console.log("Using cached data for", timeframe)
          } else if (currentData && timeframe !== "1D") {
            dataToUse = currentData
            console.log("Using current API data")
          } else {
            // Fetch new data from API
            console.log("Fetching new data for timeframe:", timeframe)
            const fetchedData = await fetchChartData(timeframe)
            dataToUse = fetchedData
            setCurrentData(fetchedData)
          }
        }

        if (!dataToUse) {
          throw new Error("No data available to display")
        }

        // Add additional wait for data structure to be properly available
        let retryCount = 0
        const maxRetries = 3
        while (retryCount < maxRetries) {
          // Check if data structure is properly formed
          const hasValidStructure =
            dataToUse &&
            // EOD format
            ((dataToUse.format === "eod" && Array.isArray(dataToUse.data)) ||
              // OHLC format
              (dataToUse.data && dataToUse.data.datasets && dataToUse.data.datasets[0]?.ohlc) ||
              // Line chart format
              (dataToUse.data && dataToUse.data.datasets && dataToUse.data.datasets[0]?.data && dataToUse.data.labels))

          if (hasValidStructure) {
            console.log("Data structure validation passed")
            break
          }

          console.warn(`Data structure validation failed, retry ${retryCount + 1}/${maxRetries}`, {
            hasData: !!dataToUse,
            dataType: typeof dataToUse,
            format: dataToUse?.format,
            hasDatasets: !!dataToUse?.data?.datasets,
            hasLabels: !!dataToUse?.data?.labels,
          })

          if (retryCount < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500)) // Wait 200ms before retry
          }
          retryCount++
        }

        // Validate data before proceeding
        console.log("Validating chart data before conversion...")
        const { candlestickData, volumeData } = convertDataToLightweightFormat(dataToUse)

        if (candlestickData.length === 0) {
          console.error("Data conversion resulted in empty candlestick data:", {
            dataSource: dataToUse,
            hasData: !!dataToUse.data,
            format: dataToUse.format,
            dataType: typeof dataToUse.data,
            retryCount: retryCount,
          })
          throw new Error(
            `No valid candlestick data could be extracted from ${symbol} ${timeframe} data. The data may be corrupted or in an unexpected format.`,
          )
        }

        console.log(
          `Successfully converted data: ${candlestickData.length} candlestick points, ${volumeData.length} volume points`,
        )

        // Ensure container is available
        if (!chartContainerRef.current) {
          throw new Error("Chart container ref is not available")
        }

        // Clean up any previous chart instance PROPERLY
        if (chartRef.current) {
          try {
            // First, remove all series references to prevent disposal errors
            if (candlestickSeriesRef.current) {
              try {
                chartRef.current.removeSeries(candlestickSeriesRef.current)
              } catch (e) {
                console.warn("Error removing candlestick series:", e)
              }
              candlestickSeriesRef.current = null
            }

            if (volumeSeriesRef.current) {
              try {
                chartRef.current.removeSeries(volumeSeriesRef.current)
              } catch (e) {
                console.warn("Error removing volume series:", e)
              }
              volumeSeriesRef.current = null
            }

            if (sma20SeriesRef.current) {
              try {
                chartRef.current.removeSeries(sma20SeriesRef.current)
              } catch (e) {
                console.warn("Error removing SMA20 series:", e)
              }
              sma20SeriesRef.current = null
            }

            if (sma50SeriesRef.current) {
              try {
                chartRef.current.removeSeries(sma50SeriesRef.current)
              } catch (e) {
                console.warn("Error removing SMA50 series:", e)
              }
              sma50SeriesRef.current = null
            }

            if (rsiSeriesRef.current) {
              try {
                chartRef.current.removeSeries(rsiSeriesRef.current)
              } catch (e) {
                console.warn("Error removing RSI series:", e)
              }
              rsiSeriesRef.current = null
            }

            if (macdLineSeriesRef.current) {
              try {
                chartRef.current.removeSeries(macdLineSeriesRef.current)
              } catch (e) {
                console.warn("Error removing MACD line series:", e)
              }
              macdLineSeriesRef.current = null
            }

            if (macdSignalSeriesRef.current) {
              try {
                chartRef.current.removeSeries(macdSignalSeriesRef.current)
              } catch (e) {
                console.warn("Error removing MACD signal series:", e)
              }
              macdSignalSeriesRef.current = null
            }

            if (macdHistogramSeriesRef.current) {
              try {
                chartRef.current.removeSeries(macdHistogramSeriesRef.current)
              } catch (e) {
                console.warn("Error removing MACD histogram series:", e)
              }
              macdHistogramSeriesRef.current = null
            }

            // Clean up additional indicator series
            if (ema20SeriesRef.current) {
              try {
                chartRef.current.removeSeries(ema20SeriesRef.current)
              } catch (e) {
                console.warn("Error removing EMA20 series:", e)
              }
              ema20SeriesRef.current = null
            }

            if (ema50SeriesRef.current) {
              try {
                chartRef.current.removeSeries(ema50SeriesRef.current)
              } catch (e) {
                console.warn("Error removing EMA50 series:", e)
              }
              ema50SeriesRef.current = null
            }

            if (wma20SeriesRef.current) {
              try {
                chartRef.current.removeSeries(wma20SeriesRef.current)
              } catch (e) {
                console.warn("Error removing WMA20 series:", e)
              }
              wma20SeriesRef.current = null
            }

            if (dema20SeriesRef.current) {
              try {
                chartRef.current.removeSeries(dema20SeriesRef.current)
              } catch (e) {
                console.warn("Error removing DEMA20 series:", e)
              }
              dema20SeriesRef.current = null
            }

            if (tema20SeriesRef.current) {
              try {
                chartRef.current.removeSeries(tema20SeriesRef.current)
              } catch (e) {
                console.warn("Error removing TEMA20 series:", e)
              }
              tema20SeriesRef.current = null
            }

            if (stdDevSeriesRef.current) {
              try {
                chartRef.current.removeSeries(stdDevSeriesRef.current)
              } catch (e) {
                console.warn("Error removing Standard Deviation series:", e)
              }
              stdDevSeriesRef.current = null
            }

            if (williamsSeriesRef.current) {
              try {
                chartRef.current.removeSeries(williamsSeriesRef.current)
              } catch (e) {
                console.warn("Error removing Williams series:", e)
              }
              williamsSeriesRef.current = null
            }

            if (adxSeriesRef.current) {
              try {
                chartRef.current.removeSeries(adxSeriesRef.current)
              } catch (e) {
                console.warn("Error removing ADX series:", e)
              }
              adxSeriesRef.current = null
            }

            // Finally remove the chart
            chartRef.current.remove()
          } catch (e) {
            console.warn("Error during chart cleanup:", e)
          }
          chartRef.current = null
        }

        // Exit early if component was unmounted during async operations
        if (!mounted) return

        // Create the chart only after we have valid data
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: "#000000" },
            textColor: "#FFFFFF",
          },
          grid: {
            vertLines: { color: "#1a1a1a" },
            horzLines: { color: "#1a1a1a" },
          },
          crosshair: {
            mode: 1, // Normal crosshair mode
            vertLine: {
              labelVisible: true,
              labelBackgroundColor: "#333333",
            },
            horzLine: {
              labelVisible: true,
              labelBackgroundColor: "#333333",
            },
          },
          rightPriceScale: {
            borderColor: "#333333",
            mode: 0, // Normal price scale mode
            autoScale: true,
          },
          timeScale: {
            borderColor: "#333333",
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 10,
            fixLeftEdge: false,
            fixRightEdge: false,
            lockVisibleTimeRangeOnResize: false,
          },
        })

        // Exit early if component was unmounted
        if (!mounted) {
          chart.remove()
          return
        }

        chartRef.current = chart

        // Add enhanced error handling for crosshair events to prevent null value errors
        chart.subscribeCrosshairMove((param) => {
          try {
            // Enhanced null checking for crosshair parameters
            if (param && param.time !== null && param.time !== undefined) {
              // The crosshair is working properly with valid time
            }
          } catch (error) {
            console.warn("Crosshair move error caught and ignored:", error)
          }
        })

        // Add candlestick series
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#46A758",
          downColor: "#E5484D",
          borderVisible: true,
          borderUpColor: "#46A758",
          borderDownColor: "#E5484D",
          wickUpColor: "#46A758",
          wickDownColor: "#E5484D",
          priceFormat: {
            type: "price",
            precision: 2,
            minMove: 0.01,
          },
        })

        candlestickSeriesRef.current = candlestickSeries

        // Enhanced safety check before setting data
        if (candlestickData && candlestickData.length > 0) {
          // Ultra-safe data filtering using the enhanced validation function
          const ultraSafeData = candlestickData.filter((item, index) => {
            const isValid = isValidDataPoint(item, timeframe)

            if (!isValid && index < 2) {
              console.warn(`Ultra-safe filter removing invalid data at index ${index}:`, item)
            }
            return isValid
          })

          // Log the final data being passed to chart
          console.log("Final candlestick data being passed to chart:", {
            originalLength: candlestickData.length,
            filteredLength: ultraSafeData.length,
            firstFewItems: ultraSafeData.slice(0, 3),
            lastFewItems: ultraSafeData.slice(-3),
          })

          if (ultraSafeData.length > 0) {
            // Sort data by time to ensure proper order with enhanced validation
            const sortedData = ultraSafeData.sort((a, b) => {
              try {
                let timeA: number, timeB: number

                if (typeof a.time === "string" && typeof b.time === "string") {
                  // Both are date strings (daily data)
                  timeA = new Date(a.time).getTime()
                  timeB = new Date(b.time).getTime()
                } else if (typeof a.time === "number" && typeof b.time === "number") {
                  // Both are Unix timestamps (intraday data) - ensure they're in milliseconds
                  timeA = a.time > 9999999999 ? a.time : a.time * 1000
                  timeB = b.time > 9999999999 ? b.time : b.time * 1000
                } else {
                  // Mixed types - convert to milliseconds for comparison
                  timeA = typeof a.time === "string" ? new Date(a.time).getTime() : (a.time as number) * 1000
                  timeB = typeof b.time === "string" ? new Date(b.time).getTime() : (b.time as number) * 1000
                }

                // Validate the converted times
                if (isNaN(timeA) || isNaN(timeB) || !isFinite(timeA) || !isFinite(timeB)) {
                  console.warn("Invalid time values during sorting:", {
                    originalA: a.time,
                    originalB: b.time,
                    convertedA: timeA,
                    convertedB: timeB,
                  })
                  return 0
                }

                return timeA - timeB
              } catch (sortError) {
                console.warn("Error during time sorting:", sortError)
                return 0
              }
            })

            // Final validation of sorted data before setting
            const finalValidData = sortedData.filter((item, index) => {
              const isValid =
                item &&
                item.time !== null &&
                item.time !== undefined &&
                typeof item.open === "number" &&
                typeof item.high === "number" &&
                typeof item.low === "number" &&
                typeof item.close === "number" &&
                isFinite(item.open) &&
                isFinite(item.high) &&
                isFinite(item.low) &&
                isFinite(item.close)

              if (!isValid && index < 3) {
                console.warn(`Final validation removing invalid item at index ${index}:`, item)
              }

              return isValid
            })

            console.log("Setting chart data with", finalValidData.length, "valid points")
            candlestickSeries.setData(finalValidData)
          } else {
            throw new Error("All candlestick data points were invalid after ultra-safe filtering")
          }
        } else {
          throw new Error("No candlestick data available to display")
        }

        // Add volume series if enabled with enhanced validation
        if (showVolume && volumeData.length > 0) {
          const volumeSeries = chart.addSeries(HistogramSeries, {
            color: "#46A758",
            priceFormat: {
              type: "volume",
            },
            priceScaleId: "volume",
          })

          // Configure the volume price scale to limit height to bottom 20%
          chart.priceScale("volume").applyOptions({
            scaleMargins: {
              top: 0.8,
              bottom: 0,
            },
          })

          volumeSeriesRef.current = volumeSeries

          // Ultra-enhanced volume data validation before setting
          const ultraSafeVolumeData = volumeData.filter((item, index) => {
            const hasValidTime =
              item &&
              item.time !== null &&
              item.time !== undefined &&
              // For daily data: string timestamps (YYYY-MM-DD)
              ((timeframe === "1D" &&
                typeof item.time === "string" &&
                item.time.length > 0 &&
                item.time !== "Invalid Date") ||
                // For intraday data: numeric timestamps (Unix timestamps)
                (timeframe !== "1D" && typeof item.time === "number" && isFinite(item.time) && item.time > 0))

            const hasValidValue =
              item &&
              item.value !== null &&
              item.value !== undefined &&
              typeof item.value === "number" &&
              !isNaN(item.value) &&
              isFinite(item.value) &&
              item.value > 0

            const hasValidColor =
              item &&
              item.color !== null &&
              item.color !== undefined &&
              typeof item.color === "string" &&
              item.color.length > 0

            const isValid = hasValidTime && hasValidValue && hasValidColor

            // Debug invalid volume data points (only first few for troubleshooting)
            if (!isValid && index < 2) {
              console.warn(`Ultra-safe volume filter removing invalid data at index ${index}:`, {
                item: item,
                hasValidTime,
                hasValidValue,
                hasValidColor,
                timeValue: item?.time,
                volumeValue: item?.value,
                colorValue: item?.color,
              })
            }

            return isValid
          })

          console.log(`Volume data validation: ${volumeData.length} → ${ultraSafeVolumeData.length} volume points`)

          if (ultraSafeVolumeData.length > 0) {
            // Sort volume data by time to ensure proper order with enhanced validation
            const sortedVolumeData = ultraSafeVolumeData.sort((a, b) => {
              try {
                let timeA: number, timeB: number

                if (typeof a.time === "string" && typeof b.time === "string") {
                  // Both are date strings (daily data)
                  timeA = new Date(a.time).getTime()
                  timeB = new Date(b.time).getTime()
                } else if (typeof a.time === "number" && typeof b.time === "number") {
                  // Both are Unix timestamps (intraday data) - ensure they're in milliseconds
                  timeA = a.time > 9999999999 ? a.time : a.time * 1000
                  timeB = b.time > 9999999999 ? b.time : b.time * 1000
                } else {
                  // Mixed types - convert to milliseconds for comparison
                  timeA = typeof a.time === "string" ? new Date(a.time).getTime() : (a.time as number) * 1000
                  timeB = typeof b.time === "string" ? new Date(b.time).getTime() : (b.time as number) * 1000
                }

                // Validate the converted times
                if (isNaN(timeA) || isNaN(timeB) || !isFinite(timeA) || !isFinite(timeB)) {
                  console.warn("Invalid volume time values during sorting:", {
                    originalA: a.time,
                    originalB: b.time,
                    convertedA: timeA,
                    convertedB: timeB,
                  })
                  return 0
                }

                return timeA - timeB
              } catch (sortError) {
                console.warn("Error during volume time sorting:", sortError)
                return 0
              }
            })

            console.log("Setting volume data with", sortedVolumeData.length, "valid points")
            volumeSeries.setData(sortedVolumeData)
          } else {
            console.warn("No valid volume data available after ultra-safe filtering")
          }
        }

        // Enhanced SMA calculation with null checking
        if (showSMA20) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const sma20Data = calculateSMA(candlestickData, 20)
            if (sma20Data.length > 0) {
              // Additional validation for SMA data
              const validSMA20Data = sma20Data.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validSMA20Data.length > 0) {
                const sma20Series = chart.addSeries(LineSeries, {
                  color: "#3B82F6",
                  lineWidth: 2,
                })
                sma20SeriesRef.current = sma20Series
                sma20Series.setData(validSMA20Data)
              }
            }
          } else {
            // Use API for intraday data
            try {
              console.log(`Fetching SMA20 data for ${symbol} timeframe ${timeframe}`)
              const smaData = await fetchSpecificIndicator("sma", 20)

              // Check if component is still mounted and chart is still valid
              if (!mounted || !chartRef.current) {
                console.log("Component unmounted or chart disposed during SMA20 fetch")
                return
              }

              console.log("SMA20 API response:", {
                dataType: typeof smaData,
                isArray: Array.isArray(smaData),
                length: smaData?.length,
                sampleData: smaData?.slice?.(0, 3),
                fullData: smaData,
              })

              if (smaData && Array.isArray(smaData) && smaData.length > 0) {
                const sma20ChartData = convertIndicatorToChartFormat(smaData, "sma")
                console.log("SMA20 converted chart data:", {
                  length: sma20ChartData.length,
                  sampleData: sma20ChartData.slice(0, 3),
                })

                // Double-check chart is still valid before adding series
                if (sma20ChartData.length > 0 && mounted && chartRef.current) {
                  const sma20Series = chart.addSeries(LineSeries, {
                    color: "#3B82F6",
                    lineWidth: 2,
                  })
                  sma20SeriesRef.current = sma20Series
                  sma20Series.setData(sma20ChartData)
                  console.log(`Successfully set SMA20 data from API: ${sma20ChartData.length} points`)
                } else {
                  console.warn("SMA20 chart data is empty after conversion or component unmounted")
                }
              } else {
                console.warn("SMA20 API data is invalid or empty:", {
                  data: smaData,
                  isArray: Array.isArray(smaData),
                  length: smaData?.length,
                })
              }
            } catch (error) {
              console.error("Failed to fetch SMA20 from API:", {
                error: error,
                symbol: symbol,
                timeframe: timeframe,
                message: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }
        }

        if (showSMA50) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const sma50Data = calculateSMA(candlestickData, 50)
            if (sma50Data.length > 0) {
              // Additional validation for SMA data
              const validSMA50Data = sma50Data.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validSMA50Data.length > 0) {
                const sma50Series = chart.addSeries(LineSeries, {
                  color: "#DC2626",
                  lineWidth: 2,
                })
                sma50SeriesRef.current = sma50Series
                sma50Series.setData(validSMA50Data)
              }
            }
          } else {
            // Use API for intraday data
            try {
              const smaData = await fetchSpecificIndicator("sma", 50)

              // Check if component is still mounted and chart is still valid
              if (!mounted || !chartRef.current) {
                console.log("Component unmounted or chart disposed during SMA50 fetch")
                return
              }

              if (smaData && Array.isArray(smaData)) {
                const sma50ChartData = convertIndicatorToChartFormat(smaData, "sma")

                // Double-check chart is still valid before adding series
                if (sma50ChartData.length > 0 && mounted && chartRef.current) {
                  const sma50Series = chart.addSeries(LineSeries, {
                    color: "#DC2626",
                    lineWidth: 2,
                  })
                  sma50SeriesRef.current = sma50Series
                  sma50Series.setData(sma50ChartData)
                  console.log(`Set SMA50 data from API: ${sma50ChartData.length} points`)
                }
              }
            } catch (error) {
              console.warn("Failed to fetch SMA50 from API:", error)
            }
          }
        }

        // Add RSI indicator
        if (showRSI) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const rsiData = calculateRSI(candlestickData, 14)
            if (rsiData.length > 0) {
              // Additional validation for RSI data
              const validRSIData = rsiData.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value) &&
                  item.value >= 0 &&
                  item.value <= 100,
              )

              if (validRSIData.length > 0) {
                const rsiSeries = chart.addSeries(LineSeries, {
                  color: "#3B82F6",
                  lineWidth: 2,
                  priceScaleId: "rsi",
                })

                // Configure RSI price scale (0-100 range) - position it below main chart
                chart.priceScale("rsi").applyOptions({
                  scaleMargins: {
                    top: 0.8,
                    bottom: 0.15,
                  },
                  borderColor: "#333333",
                })

                rsiSeriesRef.current = rsiSeries
                rsiSeries.setData(validRSIData)
              }
            }
          } else {
            // Use API for intraday data
            try {
              const rsiData = await fetchSpecificIndicator("rsi", 14)

              // Check if component is still mounted and chart is still valid
              if (!mounted || !chartRef.current) {
                console.log("Component unmounted or chart disposed during RSI fetch")
                return
              }

              if (rsiData && Array.isArray(rsiData)) {
                const rsiChartData = convertIndicatorToChartFormat(rsiData, "rsi")

                // Double-check chart is still valid before adding series
                if (rsiChartData.length > 0 && mounted && chartRef.current) {
                  const rsiSeries = chart.addSeries(LineSeries, {
                    color: "#3B82F6",
                    lineWidth: 2,
                    priceScaleId: "rsi",
                  })

                  // Configure RSI price scale (0-100 range) - position it below main chart
                  chart.priceScale("rsi").applyOptions({
                    scaleMargins: {
                      top: 0.8,
                      bottom: 0.15,
                    },
                    borderColor: "#333333",
                  })

                  rsiSeriesRef.current = rsiSeries
                  rsiSeries.setData(rsiChartData)
                  console.log(`Set RSI data from API: ${rsiChartData.length} points`)
                }
              }
            } catch (error) {
              console.warn("Failed to fetch RSI from API:", error)
            }
          }
        }

        // Add MACD indicator
        if (showMACD) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const macdData = calculateMACD(candlestickData, 12, 26, 9)

            if (macdData.macdLine.length > 0) {
              // Validate MACD line data
              const validMACDLine = macdData.macdLine.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validMACDLine.length > 0) {
                const macdLineSeries = chart.addSeries(LineSeries, {
                  color: "#2563EB",
                  lineWidth: 2,
                  priceScaleId: "macd",
                })

                macdLineSeriesRef.current = macdLineSeries
                macdLineSeries.setData(validMACDLine)
              }
            }

            if (macdData.signalLine.length > 0) {
              // Validate signal line data
              const validSignalLine = macdData.signalLine.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validSignalLine.length > 0) {
                const macdSignalSeries = chart.addSeries(LineSeries, {
                  color: "#DC2626",
                  lineWidth: 2,
                  priceScaleId: "macd",
                })

                macdSignalSeriesRef.current = macdSignalSeries
                macdSignalSeries.setData(validSignalLine)
              }
            }

            if (macdData.histogram.length > 0) {
              // Validate histogram data
              const validHistogram = macdData.histogram.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validHistogram.length > 0) {
                const macdHistogramSeries = chart.addSeries(HistogramSeries, {
                  color: "#46A758",
                  priceFormat: {
                    type: "price",
                    precision: 4,
                    minMove: 0.0001,
                  },
                  priceScaleId: "macd",
                })

                // Configure MACD price scale - position it at the bottom
                chart.priceScale("macd").applyOptions({
                  scaleMargins: {
                    top: 0.85,
                    bottom: 0.05,
                  },
                  borderColor: "#333333",
                })

                macdHistogramSeriesRef.current = macdHistogramSeries
                macdHistogramSeries.setData(validHistogram)
              }
            }
          } else {
            // MACD is not available for intraday timeframes
            console.log("MACD is only available for daily (1D) timeframe")
          }
        }

        // Add EMA20 indicator
        if (showEMA20) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const ema20Data = calculateEMA(candlestickData, 20)
            if (ema20Data.length > 0) {
              const validEMA20Data = ema20Data.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validEMA20Data.length > 0) {
                const ema20Series = chart.addSeries(LineSeries, {
                  color: "#10B981",
                  lineWidth: 2,
                })
                ema20SeriesRef.current = ema20Series
                ema20Series.setData(validEMA20Data)
              }
            }
          } else {
            // Use API for intraday data
            try {
              console.log(`Fetching EMA20 data for ${symbol} timeframe ${timeframe}`)
              const emaData = await fetchSpecificIndicator("ema", 20)

              if (!mounted || !chartRef.current) {
                console.log("Component unmounted or chart disposed during EMA20 fetch")
                return
              }

              if (emaData && Array.isArray(emaData) && emaData.length > 0) {
                const ema20ChartData = convertIndicatorToChartFormat(emaData, "ema")

                if (ema20ChartData.length > 0 && mounted && chartRef.current) {
                  const ema20Series = chart.addSeries(LineSeries, {
                    color: "#10B981",
                    lineWidth: 2,
                  })
                  ema20SeriesRef.current = ema20Series
                  ema20Series.setData(ema20ChartData)
                  console.log(`Successfully set EMA20 data from API: ${ema20ChartData.length} points`)
                }
              }
            } catch (error) {
              console.error("Failed to fetch EMA20 from API:", error)
            }
          }
        }

        // Add EMA50 indicator
        if (showEMA50) {
          if (timeframe === "1D") {
            // Use local calculation for daily data
            const ema50Data = calculateEMA(candlestickData, 50)
            if (ema50Data.length > 0) {
              const validEMA50Data = ema50Data.filter(
                (item) =>
                  item &&
                  item.time !== null &&
                  item.time !== undefined &&
                  item.value !== null &&
                  item.value !== undefined &&
                  !isNaN(item.value) &&
                  isFinite(item.value),
              )

              if (validEMA50Data.length > 0) {
                const ema50Series = chart.addSeries(LineSeries, {
                  color: "#F59E0B",
                  lineWidth: 2,
                })
                ema50SeriesRef.current = ema50Series
                ema50Series.setData(validEMA50Data)
              }
            }
          } else {
            // Use API for intraday data
            try {
              const emaData = await fetchSpecificIndicator("ema", 50)

              if (!mounted || !chartRef.current) {
                console.log("Component unmounted or chart disposed during EMA50 fetch")
                return
              }

              if (emaData && Array.isArray(emaData) && emaData.length > 0) {
                const ema50ChartData = convertIndicatorToChartFormat(emaData, "ema")

                if (ema50ChartData.length > 0 && mounted && chartRef.current) {
                  const ema50Series = chart.addSeries(LineSeries, {
                    color: "#F59E0B",
                    lineWidth: 2,
                  })
                  ema50SeriesRef.current = ema50Series
                  ema50Series.setData(ema50ChartData)
                  console.log(`Successfully set EMA50 data from API: ${ema50ChartData.length} points`)
                }
              }
            } catch (error) {
              console.error("Failed to fetch EMA50 from API:", error)
            }
          }
        }

        // Add WMA20 indicator
        if (showWMA20) {
          try {
            const wmaData = await fetchSpecificIndicator("wma", 20)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during WMA20 fetch")
              return
            }

            if (wmaData && Array.isArray(wmaData) && wmaData.length > 0) {
              const wma20ChartData = convertIndicatorToChartFormat(wmaData, "wma")

              if (wma20ChartData.length > 0 && mounted && chartRef.current) {
                const wma20Series = chart.addSeries(LineSeries, {
                  color: "#8B5CF6",
                  lineWidth: 2,
                })
                wma20SeriesRef.current = wma20Series
                wma20Series.setData(wma20ChartData)
                console.log(`Successfully set WMA20 data from API: ${wma20ChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch WMA20 from API:", error)
          }
        }

        // Add DEMA20 indicator
        if (showDEMA20) {
          try {
            const demaData = await fetchSpecificIndicator("dema", 20)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during DEMA20 fetch")
              return
            }

            if (demaData && Array.isArray(demaData) && demaData.length > 0) {
              const dema20ChartData = convertIndicatorToChartFormat(demaData, "dema")

              if (dema20ChartData.length > 0 && mounted && chartRef.current) {
                const dema20Series = chart.addSeries(LineSeries, {
                  color: "#EF4444",
                  lineWidth: 2,
                })
                dema20SeriesRef.current = dema20Series
                dema20Series.setData(dema20ChartData)
                console.log(`Successfully set DEMA20 data from API: ${dema20ChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch DEMA20 from API:", error)
          }
        }

        // Add TEMA20 indicator
        if (showTEMA20) {
          try {
            const temaData = await fetchSpecificIndicator("tema", 20)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during TEMA20 fetch")
              return
            }

            if (temaData && Array.isArray(temaData) && temaData.length > 0) {
              const tema20ChartData = convertIndicatorToChartFormat(temaData, "tema")

              if (tema20ChartData.length > 0 && mounted && chartRef.current) {
                const tema20Series = chart.addSeries(LineSeries, {
                  color: "#06B6D4",
                  lineWidth: 2,
                })
                tema20SeriesRef.current = tema20Series
                tema20Series.setData(tema20ChartData)
                console.log(`Successfully set TEMA20 data from API: ${tema20ChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch TEMA20 from API:", error)
          }
        }

        // Add Standard Deviation indicator
        if (showStdDev) {
          try {
            const stdDevData = await fetchSpecificIndicator("standarddeviation", 20)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during StdDev fetch")
              return
            }

            if (stdDevData && Array.isArray(stdDevData) && stdDevData.length > 0) {
              const stdDevChartData = convertIndicatorToChartFormat(stdDevData, "standardDeviation")

              if (stdDevChartData.length > 0 && mounted && chartRef.current) {
                const stdDevSeries = chart.addSeries(LineSeries, {
                  color: "#F97316",
                  lineWidth: 2,
                  priceScaleId: "stddev",
                })

                // Configure Standard Deviation price scale
                chart.priceScale("stddev").applyOptions({
                  scaleMargins: {
                    top: 0.85,
                    bottom: 0.1,
                  },
                  borderColor: "#333333",
                })

                stdDevSeriesRef.current = stdDevSeries
                stdDevSeries.setData(stdDevChartData)
                console.log(`Successfully set Standard Deviation data from API: ${stdDevChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch Standard Deviation from API:", error)
          }
        }

        // Add Williams %R indicator
        if (showWilliams) {
          try {
            const williamsData = await fetchSpecificIndicator("williams", 14)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during Williams fetch")
              return
            }

            if (williamsData && Array.isArray(williamsData) && williamsData.length > 0) {
              const williamsChartData = convertIndicatorToChartFormat(williamsData, "williams")

              if (williamsChartData.length > 0 && mounted && chartRef.current) {
                const williamsSeries = chart.addSeries(LineSeries, {
                  color: "#EC4899",
                  lineWidth: 2,
                  priceScaleId: "williams",
                })

                // Configure Williams %R price scale (-100 to 0 range)
                chart.priceScale("williams").applyOptions({
                  scaleMargins: {
                    top: 0.9,
                    bottom: 0.05,
                  },
                  borderColor: "#333333",
                })

                williamsSeriesRef.current = williamsSeries
                williamsSeries.setData(williamsChartData)
                console.log(`Successfully set Williams %R data from API: ${williamsChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch Williams %R from API:", error)
          }
        }

        // Add ADX indicator
        if (showADX) {
          try {
            const adxData = await fetchSpecificIndicator("adx", 14)

            if (!mounted || !chartRef.current) {
              console.log("Component unmounted or chart disposed during ADX fetch")
              return
            }

            if (adxData && Array.isArray(adxData) && adxData.length > 0) {
              const adxChartData = convertIndicatorToChartFormat(adxData, "adx")

              if (adxChartData.length > 0 && mounted && chartRef.current) {
                const adxSeries = chart.addSeries(LineSeries, {
                  color: "#84CC16",
                  lineWidth: 2,
                  priceScaleId: "adx",
                })

                // Configure ADX price scale (0-100+ range)
                chart.priceScale("adx").applyOptions({
                  scaleMargins: {
                    top: 0.95,
                    bottom: 0.0,
                  },
                  borderColor: "#333333",
                })

                adxSeriesRef.current = adxSeries
                adxSeries.setData(adxChartData)
                console.log(`Successfully set ADX data from API: ${adxChartData.length} points`)
              }
            }
          } catch (error) {
            console.error("Failed to fetch ADX from API:", error)
          }
        }

        // Fit content to show all data first
        chart.timeScale().fitContent()

        // Then apply default zoom to show recent data clearly
        setTimeout(() => {
          if (candlestickData.length > 0) {
            try {
              const dataLength = candlestickData.length
              // Show last 50-100 data points depending on timeframe
              let visibleDataPoints = 50

              // Adjust visible points based on timeframe
              switch (timeframe) {
                case "1m":
                  visibleDataPoints = 60 // Show last hour for 1-minute data
                  break
                case "5m":
                  visibleDataPoints = 72 // Show last 6 hours for 5-minute data
                  break
                case "15m":
                  visibleDataPoints = 64 // Show last 16 hours for 15-minute data
                  break
                case "30m":
                  visibleDataPoints = 48 // Show last 24 hours for 30-minute data
                  break
                case "1H":
                  visibleDataPoints = 48 // Show last 2 days for 1-hour data
                  break
                case "4H":
                  visibleDataPoints = 42 // Show last week for 4-hour data
                  break
                case "1D":
                  visibleDataPoints = 30 // Show last month for daily data
                  break
              }

              // Ensure we don't try to show more data than we have
              const startIndex = Math.max(0, dataLength - visibleDataPoints)
              const endIndex = dataLength - 1

              if (startIndex < endIndex && candlestickData[startIndex] && candlestickData[endIndex]) {
                let startTime = candlestickData[startIndex].time
                let endTime = candlestickData[endIndex].time

                // Enhanced time validation and correction
                const validateAndCorrectTimeRange = () => {
                  if (typeof startTime === "string" && typeof endTime === "string") {
                    // Both are date strings (daily data)
                    const startDate = new Date(startTime)
                    const endDate = new Date(endTime)

                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                      console.warn("Invalid date strings in time range")
                      return false
                    }

                    // If start is after end, swap them
                    if (startDate > endDate) {
                      console.log("Swapping date range: start was after end")
                      const temp = startTime
                      startTime = endTime
                      endTime = temp
                    }

                    return true
                  } else if (typeof startTime === "number" && typeof endTime === "number") {
                    // Both are Unix timestamps (intraday data)
                    if (!isFinite(startTime) || !isFinite(endTime)) {
                      console.warn("Invalid timestamp values in time range")
                      return false
                    }

                    // If start is after end, swap them
                    if (startTime > endTime) {
                      console.log("Swapping timestamp range: start was after end", {
                        originalStart: startTime,
                        originalEnd: endTime,
                      })
                      const temp = startTime
                      startTime = endTime
                      endTime = temp
                    }

                    return true
                  }

                  console.warn("Mixed time types in range validation")
                  return false
                }

                if (validateAndCorrectTimeRange()) {
                  console.log(`Setting visible range from ${startTime} to ${endTime}`)
                  chart.timeScale().setVisibleRange({
                    from: startTime,
                    to: endTime,
                  })
                } else {
                  console.warn("Could not validate/correct time range, using fitContent")
                  chart.timeScale().fitContent()
                }
              } else {
                console.log("Invalid start/end indices, using fitContent")
                chart.timeScale().fitContent()
              }
            } catch (rangeError) {
              console.warn("Error setting visible range, falling back to fitContent:", rangeError)
              chart.timeScale().fitContent()
            }
          }
        }, 500) // Small delay to ensure chart is fully rendered

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: chartContainerRef.current.clientHeight,
            })
          }
        }

        window.addEventListener("resize", handleResize)

        if (mounted) {
          console.log("Lightweight chart initialized successfully with", candlestickData.length, "data points")
          setIsLoading(false)
        }

        // Return cleanup function for resize listener
        return () => {
          window.removeEventListener("resize", handleResize)
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to initialize Lightweight chart:", err)
          setError(err instanceof Error ? err.message : "Failed to load chart")
          setIsLoading(false)
        }
      }
    }

    // Initialize chart with a small delay to ensure DOM is ready, but prevent multiple initializations
    let resizeCleanup: (() => void) | null = null
    if (!initializationPromise) {
      initializationPromise = new Promise((resolve) => {
        setTimeout(async () => {
          const cleanup = await initializeChart()
          resizeCleanup = cleanup || null
          resolve()
        }, 500)
      })
    }

    return () => {
      mounted = false

      // Clean up resize listener
      if (resizeCleanup) {
        resizeCleanup()
      }

      // Clean up chart on unmount with proper series disposal
      if (chartRef.current) {
        try {
          // Remove all series first to prevent disposal errors
          if (candlestickSeriesRef.current) {
            try {
              chartRef.current.removeSeries(candlestickSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (volumeSeriesRef.current) {
            try {
              chartRef.current.removeSeries(volumeSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (sma20SeriesRef.current) {
            try {
              chartRef.current.removeSeries(sma20SeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (sma50SeriesRef.current) {
            try {
              chartRef.current.removeSeries(sma50SeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (rsiSeriesRef.current) {
            try {
              chartRef.current.removeSeries(rsiSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (macdLineSeriesRef.current) {
            try {
              chartRef.current.removeSeries(macdLineSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (macdSignalSeriesRef.current) {
            try {
              chartRef.current.removeSeries(macdSignalSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          if (macdHistogramSeriesRef.current) {
            try {
              chartRef.current.removeSeries(macdHistogramSeriesRef.current)
            } catch (e) {
              // Series may already be disposed
            }
          }

          // Clean up additional indicator series
          if (ema20SeriesRef.current) {
            try {
              chartRef.current.removeSeries(ema20SeriesRef.current)
            } catch (e) {
              console.warn("Error removing EMA20 series:", e)
            }
            ema20SeriesRef.current = null
          }

          if (ema50SeriesRef.current) {
            try {
              chartRef.current.removeSeries(ema50SeriesRef.current)
            } catch (e) {
              console.warn("Error removing EMA50 series:", e)
            }
            ema50SeriesRef.current = null
          }

          if (wma20SeriesRef.current) {
            try {
              chartRef.current.removeSeries(wma20SeriesRef.current)
            } catch (e) {
              console.warn("Error removing WMA20 series:", e)
            }
            wma20SeriesRef.current = null
          }

          if (dema20SeriesRef.current) {
            try {
              chartRef.current.removeSeries(dema20SeriesRef.current)
            } catch (e) {
              console.warn("Error removing DEMA20 series:", e)
            }
            dema20SeriesRef.current = null
          }

          if (tema20SeriesRef.current) {
            try {
              chartRef.current.removeSeries(tema20SeriesRef.current)
            } catch (e) {
              console.warn("Error removing TEMA20 series:", e)
            }
            tema20SeriesRef.current = null
          }

          if (stdDevSeriesRef.current) {
            try {
              chartRef.current.removeSeries(stdDevSeriesRef.current)
            } catch (e) {
              console.warn("Error removing Standard Deviation series:", e)
            }
            stdDevSeriesRef.current = null
          }

          if (williamsSeriesRef.current) {
            try {
              chartRef.current.removeSeries(williamsSeriesRef.current)
            } catch (e) {
              console.warn("Error removing Williams series:", e)
            }
            williamsSeriesRef.current = null
          }

          if (adxSeriesRef.current) {
            try {
              chartRef.current.removeSeries(adxSeriesRef.current)
            } catch (e) {
              console.warn("Error removing ADX series:", e)
            }
            adxSeriesRef.current = null
          }

          // Finally remove the chart
          chartRef.current.remove()
        } catch (e) {
          console.warn("Error cleaning up chart on unmount:", e)
        }

        // Clear all references
        chartRef.current = null
        candlestickSeriesRef.current = null
        volumeSeriesRef.current = null
        sma20SeriesRef.current = null
        sma50SeriesRef.current = null
        rsiSeriesRef.current = null
        macdLineSeriesRef.current = null
        macdSignalSeriesRef.current = null
        macdHistogramSeriesRef.current = null
        ema20SeriesRef.current = null
        ema50SeriesRef.current = null
        wma20SeriesRef.current = null
        dema20SeriesRef.current = null
        tema20SeriesRef.current = null
        stdDevSeriesRef.current = null
        williamsSeriesRef.current = null
        adxSeriesRef.current = null
      }
    }
  }, [
    timeframe,
    showVolume,
    showSMA20,
    showSMA50,
    showRSI,
    showMACD,
    showEMA20,
    showEMA50,
    showWMA20,
    showDEMA20,
    showTEMA20,
    showStdDev,
    showWilliams,
    showADX,
    chartData,
  ])

  // Handle clicking outside indicators dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showIndicatorsDropdown) {
        const target = event.target as HTMLElement
        const dropdownButton = target.closest('[data-indicators-dropdown="true"]')
        const dropdownMenu = target.closest('[data-indicators-menu="true"]')

        // Close dropdown if clicking outside both button and menu
        if (!dropdownButton && !dropdownMenu) {
          setShowIndicatorsDropdown(false)
        }
      }
    }

    if (showIndicatorsDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showIndicatorsDropdown])

  if (error) {
    return (
      <div
        style={{
          position: "relative",
          height: height,
          width: width,
          background: "#000000",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#E5484D",
          fontSize: "14px",
        }}
      >
        Error loading chart: {error}
      </div>
    )
  }

  return (
    <div
      style={{
        position: "relative",
        height: height,
        width: width,
        background: "#000000",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Chart Controls */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1000,
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Live Price Display - shown when streaming is active */}
        {enableStreaming && lastPrice !== null && (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            padding: "4px 8px",
            fontSize: "12px",
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "4px",
            color: "#fff"
          }}>
            <span style={{ 
              width: "6px", 
              height: "6px", 
              borderRadius: "50%", 
              background: isWebSocketConnected ? "#46A758" : "#E5484D",
              animation: isWebSocketConnected ? "pulse 2s infinite" : "none"
            }} />
            <span style={{ color: "#888", fontSize: "10px" }}>LIVE</span>
            <span style={{ color: "#888" }}>$</span>
            <span style={{ fontWeight: "bold" }}>{lastPrice.toFixed(2)}</span>
            {priceChange !== 0 && (
              <span style={{ 
                color: priceChange > 0 ? "#46A758" : "#E5484D",
                fontSize: "10px"
              }}>
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}
              </span>
            )}
            {currentCandle && (
              <span style={{ 
                fontSize: "8px", 
                color: "#666",
                marginLeft: "4px"
              }}>
                O:{currentCandle.open.toFixed(2)} H:{currentCandle.high.toFixed(2)} L:{currentCandle.low.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Connection Status Display - moved to left and enhanced with debugging */}
        {enableStreaming && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              zIndex: 999,
              fontSize: "11px",
              color: "#888",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "4px",
              marginTop: lastPrice !== null ? "40px" : "0px", // Offset if live price is showing
            }}
          >
            <span style={{ 
              width: "6px", 
              height: "6px", 
              borderRadius: "50%", 
              background: isWebSocketConnected ? "#46A758" : "#E5484D",
              animation: isWebSocketConnected ? "pulse 2s infinite" : "none"
            }} />
            <span>
              {isWebSocketConnected 
                ? `Streaming ${detectedAssetType.toUpperCase()}` 
                : wsReconnectAttempts > 0 
                  ? `Reconnecting... (${wsReconnectAttempts}/${maxReconnectAttempts})`
                  : 'Connecting...'
              }
            </span>
            {lastPrice !== null && (
              <span style={{ fontSize: "9px", color: "#666" }}>
                {symbol.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Timeframe Buttons */}
        <div style={{ display: "flex", gap: "5px" }}>
          {(["1m", "5m", "15m", "30m", "1H", "4H", "1D"] as Timeframe[]).map((tf) => {
            // Implement asset type-based timeframe restrictions
            let isDisabled = false

            // Auto-detect asset type if not provided
            let currentDetectedAssetType = detectedAssetType

            // Apply timeframe restrictions based on asset type
            if (
              currentDetectedAssetType === "crypto" ||
              currentDetectedAssetType === "forex" ||
              currentDetectedAssetType === "commodity" ||
              currentDetectedAssetType === "index"
            ) {
              // These asset types only support: 1min, 5min, 1hour, 1D
              isDisabled = !["1m", "5m", "1H", "1D"].includes(tf)
            } else {
              // Stock asset type supports all timeframes: 1min, 5min, 15min, 30min, 1hour, 4hour, 1D
              isDisabled = false
            }

            const isStreamingTimeframe = ['1m', '5m'].includes(tf)

            return (
              <button
                key={tf}
                onClick={() => !isDisabled && setTimeframe(tf)}
                disabled={isDisabled}
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  background: timeframe === tf ? "#46A758" : isDisabled ? "#333" : "#1a1a1a",
                  color: timeframe === tf ? "#000" : isDisabled ? "#666" : "#fff",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: isDisabled ? 0.5 : 1,
                  position: "relative",
                }}
                title={
                  isDisabled
                    ? `${tf} timeframe is not supported for ${currentDetectedAssetType || "this"} assets`
                    : isStreamingTimeframe
                    ? `${tf} timeframe with live streaming`
                    : `Switch to ${tf} timeframe`
                }
              >
                {tf}
                {isStreamingTimeframe && (
                  <span style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "#46A758",
                    fontSize: "6px"
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Indicators Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowIndicatorsDropdown(!showIndicatorsDropdown)}
            data-indicators-dropdown="true"
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              border: "1px solid #333",
              borderRadius: "4px",
              background: "#1a1a1a",
              color: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Indicators
            <span style={{ fontSize: "10px" }}>{showIndicatorsDropdown ? "▲" : "▼"}</span>
          </button>

          {showIndicatorsDropdown && (
            <div
              data-indicators-menu="true"
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                marginTop: "2px",
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "4px",
                padding: "8px",
                minWidth: "200px",
                maxHeight: "300px",
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                zIndex: 1001,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showVolume}
                    onChange={(e) => setShowVolume(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Volume
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSMA20}
                    onChange={(e) => setShowSMA20(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  SMA 20
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSMA50}
                    onChange={(e) => setShowSMA50(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  SMA 50
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showEMA20}
                    onChange={(e) => setShowEMA20(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  EMA 20
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showEMA50}
                    onChange={(e) => setShowEMA50(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  EMA 50
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showWMA20}
                    onChange={(e) => setShowWMA20(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  WMA 20
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showDEMA20}
                    onChange={(e) => setShowDEMA20(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  DEMA 20
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showTEMA20}
                    onChange={(e) => setShowTEMA20(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  TEMA 20
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showRSI}
                    onChange={(e) => setShowRSI(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  RSI
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: timeframe !== "1D" ? "#666" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: timeframe !== "1D" ? "not-allowed" : "pointer",
                    opacity: timeframe !== "1D" ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showMACD}
                    onChange={(e) => setShowMACD(e.target.checked)}
                    disabled={timeframe !== "1D"}
                    style={{ margin: 0, opacity: timeframe !== "1D" ? 0.5 : 1 }}
                  />
                  MACD {timeframe !== "1D" ? "(1D only)" : ""}
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showStdDev}
                    onChange={(e) => setShowStdDev(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Std Dev
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showWilliams}
                    onChange={(e) => setShowWilliams(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Williams %R
                </label>

                <label
                  style={{
                    fontSize: "12px",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showADX}
                    onChange={(e) => setShowADX(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  ADX
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading && <ChartSkeleton height={height} width={width} symbol={symbol} timeframe={timeframe} />}
      <div
        ref={chartContainerRef}
        style={{
          height: "100%",
          width: "100%",
          background: "#000000",
        }}
      />

      {/* CSS Animation for streaming indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  )
}

export default LightweightChart