// components/AssetChart.tsx
"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { init, dispose, LineType, PolygonType, type FormatDateType } from "klinecharts"

// Define KLineChart types
declare global {
  interface Window {
    klinecharts: any
  }
}

// Define constants for FormatDateType string literals for type-safe comparisons
const KLINECHARTS_FORMAT_DATE_TYPE_XAXIS = 'x-axis' as unknown as FormatDateType;
const KLINECHARTS_FORMAT_DATE_TYPE_CROSSHAIR = 'crosshair' as unknown as FormatDateType;
const KLINECHARTS_FORMAT_DATE_TYPE_TOOLTIP = 'tooltip' as unknown as FormatDateType;
// Note: 'yAxis' is also a valid FormatDateType, add if needed for future logic.

// Define types to match klinecharts API
type LayoutChildType = "candle" | "indicator" | "xAxis"
type AxisPosition = "left" | "right"

// Define supported interval types per asset class
type StockInterval = "1min" | "5min" | "15min" | "30min" | "1hour" | "4hour" | "1D"
type CryptoInterval = "1min" | "5min" | "1hour" | "1D"
type ForexInterval = "1min" | "5min" | "1hour" | "1D"
type CommodityInterval = "1min" | "5min" | "1hour" | "1D"
type IndexInterval = "1min" | "5min" | "1hour" | "1D"

// Unified interval type (note: 1D is converted to 1day when making API calls)
type Interval = "1min" | "5min" | "15min" | "30min" | "1hour" | "4hour" | "1H" | "4H" | "1D"

interface ChartProps {
  chartData: any
  symbol?: string
  contractAddress?: string
  isDex?: boolean
  showVolume?: boolean
  timeRange?: Interval
  assetType?: "stock" | "crypto" | "forex" | "commodity" | "index"
}

interface TimeframeData {
  data: any
  lastUpdated: number
  expiryTime: number
}

// Global cache to prevent duplicate requests across component instances
const globalRequestCache = new Map<string, Promise<any>>()
const globalScheduledFetches = new Map<string, NodeJS.Timeout>()

// Helper function to get subscription ID from localStorage
const getSubscriptionId = () => {
  try {
    const subscriptionData = localStorage.getItem('koyn_subscription')
    if (subscriptionData) {
      const parsed = JSON.parse(subscriptionData)
      return parsed.id || null
    }
  } catch (error) {
    // console.warn('Error reading subscription data from localStorage:', error)
  }
  return null
}

// Helper functions for localStorage management
const manageLocalStorageQuota = () => {
  const maxStorageItems = 10 // Maximum number of chart data items to keep
  const chartDataPrefix = "chart_"

  try {
    // Get all localStorage keys that contain chart data
    const chartDataKeys = Object.keys(localStorage)
      .filter((key) => key.includes(chartDataPrefix) && key.includes("_chart_data"))
      .map((key) => ({
        key,
        timestamp: localStorage.getItem(`${key}_timestamp`) || "0",
        size: localStorage.getItem(key)?.length || 0,
      }))
      .sort((a, b) => Number.parseInt(b.timestamp) - Number.parseInt(a.timestamp)) // Sort by timestamp, newest first

    console.log(`Found ${chartDataKeys.length} chart data items in localStorage`)

    // If we have more than the maximum, remove the oldest ones
    if (chartDataKeys.length >= maxStorageItems) {
      const itemsToRemove = chartDataKeys.slice(maxStorageItems - 1) // Keep maxStorageItems - 1, remove the rest

      itemsToRemove.forEach((item) => {
        console.log(`Removing old chart data: ${item.key}`)
        localStorage.removeItem(item.key)
        localStorage.removeItem(`${item.key}_timestamp`)
      })
    }
  } catch (error) {
    console.error("Error managing localStorage quota:", error)
  }
}

const saveToLocalStorageWithQuotaManagement = (key: string, data: any) => {
  try {
    const serializedData = JSON.stringify(data)

    // Try to save directly first
    try {
      localStorage.setItem(key, serializedData)
      localStorage.setItem(`${key}_timestamp`, Date.now().toString())
      return true
    } catch (quotaError) {
      if (quotaError instanceof DOMException && quotaError.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded, cleaning up old data...")

        // Clean up old data and try again
        manageLocalStorageQuota()

        try {
          localStorage.setItem(key, serializedData)
          localStorage.setItem(`${key}_timestamp`, Date.now().toString())
          console.log("Successfully saved data after cleanup")
          return true
        } catch (secondError) {
          console.error("Still failed to save after cleanup, data too large:", secondError)
          return false
        }
      }
      throw quotaError
    }
  } catch (error) {
    console.error("Error saving to localStorage:", error)
    return false
  }
}

const compressChartData = (data: any) => {
  // Reduce data size by keeping only essential fields and limiting data points
  if (!data) return data

  try {
    const compressed = { ...data }

    // For EOD format data
    if (data.format === "eod" && Array.isArray(data.data)) {
      // Keep only the last 500 data points to reduce size
      compressed.data = data.data.slice(-500).map((item: any) => ({
        timestamp: item.timestamp,
        open: Number(item.open).toFixed(6),
        high: Number(item.high).toFixed(6),
        low: Number(item.low).toFixed(6),
        close: Number(item.close).toFixed(6),
        volume: item.volume ? Number(item.volume).toFixed(0) : 0,
        date: item.date,
      }))

      // Reduce timestamps array size too
      if (data.timestamps) {
        compressed.timestamps = data.timestamps.slice(-500)
      }
    }

    // For regular format data
    else if (data.data && data.data.datasets) {
      compressed.data = {
        ...data.data,
        // Keep only the last 500 data points
        labels: data.data.labels ? data.data.labels.slice(-500) : [],
        datasets: data.data.datasets.map((dataset: any) => ({
          ...dataset,
          data: dataset.data ? dataset.data.slice(-500) : [],
        })),
      }

      if (data.timestamps) {
        compressed.timestamps = data.timestamps.slice(-500)
      }
    }

    console.log(
      `Compressed data from ${JSON.stringify(data).length} to ${JSON.stringify(compressed).length} characters`,
    )
    return compressed
  } catch (error) {
    console.error("Error compressing chart data:", error)
    return data
  }
}

function AssetChart({
  chartData,
  symbol = "",
  contractAddress = "",
  isDex = false,
  showVolume = false,
  timeRange = "1D",
  assetType = "stock", // Default to stock for backward compatibility
}: ChartProps): React.ReactElement {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<any | null>(null)
  const [selectedRange, setSelectedRange] = useState(timeRange)
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]) // NEW: Global active indicators
  const [dataError, setDataError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isTimeFrameDropdownOpen, setIsTimeFrameDropdownOpen] = useState(false)
  const [isIndicatorDropdownOpen, setIsIndicatorDropdownOpen] = useState(false)

  // Add state for cached chart data by timeframe
  const [cachedChartData, setCachedChartData] = useState<Record<string, TimeframeData>>({})

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Add this state for toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info"; visible: boolean }>({
    message: "",
    type: "info",
    visible: false,
  })

  // Add this function to show toast messages
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000)
  }

  // Get available timeframe options based on asset type
  const getTimeFrameOptionsForAssetType = useCallback(() => {
    // Use crypto intervals if we have a contract address or isDex flag
    if (contractAddress || isDex) {
      return [
        { id: "1min", name: "1min" },
        { id: "5min", name: "5min" },
        { id: "1hour", name: "1h" },
        { id: "1D", name: "1d" },
      ]
    }

    // Determine asset type from symbol if needed
    let detectedAssetType = assetType

    if (symbol) {
      // Auto-detect crypto assets from symbol
      if (symbol.endsWith("USD") || symbol.endsWith("USDT") || symbol.includes("BTC") || symbol.includes("ETH")) {
        detectedAssetType = "crypto"
      }
      // Auto-detect forex pairs
      else if (/^[A-Z]{3}[A-Z]{3}$/.test(symbol)) {
        detectedAssetType = "forex"
      }
    }

    // Return appropriate options based on asset type
    switch (detectedAssetType) {
      case "crypto":
        return [
          { id: "1min", name: "1min" },
          { id: "5min", name: "5min" },
          { id: "1hour", name: "1h" },
          { id: "1D", name: "1d" },
        ]
      case "forex":
      case "commodity":
      case "index":
        return [
          { id: "1min", name: "1min" },
          { id: "5min", name: "5min" },
          { id: "1hour", name: "1h" },
          { id: "1D", name: "1d" },
        ]
      case "stock":
      default:
        return [
          { id: "1min", name: "1min" },
          { id: "5min", name: "5min" },
          { id: "15min", name: "15min" },
          { id: "30min", name: "30min" },
          { id: "1hour", name: "1h" },
          { id: "4hour", name: "4h" },
          { id: "1D", name: "1d" },
        ]
    }
  }, [assetType, symbol, contractAddress, isDex])

  // Get timeframe options
  const timeFrameOptions = useMemo(() => getTimeFrameOptionsForAssetType(), [getTimeFrameOptionsForAssetType])

  // Validate selected range against available options
  useEffect(() => {
    const availableRanges = timeFrameOptions.map((opt) => opt.id)
    if (!availableRanges.includes(selectedRange)) {
      // If current selection is not available, switch to a safe default
      console.log(`Selected range ${selectedRange} not available for this asset type, switching to default`)
      setSelectedRange(availableRanges[0] as Interval)
    }
  }, [timeFrameOptions, selectedRange])

  // Get cache key based on asset info
  const getCacheKey = useCallback(() => {
    if (contractAddress) return `chart_${contractAddress}`
    if (isDex) return `chart_dex_${symbol}`
    return `chart_${symbol}`
  }, [symbol, contractAddress, isDex])

  // Helper to ensure we never pass "1D" as an interval to API
  const getApiSafeInterval = (interval: string): string => {
    if (interval === "1D") return "1day"
    if (interval === "1H") return "1hour"
    if (interval === "4H") return "4hour"
    return interval
  }

  // Get next fetch time based on interval
  const getNextFetchTime = useCallback((timeframe: string): number => {
    const now = new Date()

    switch (timeframe) {
      case "1min": {
        // Fetch at the start of the next minute
        const nextMinute = new Date(now)
        nextMinute.setSeconds(0, 0)
        nextMinute.setMinutes(nextMinute.getMinutes() + 1)
        return nextMinute.getTime()
      }
      case "5min": {
        // Fetch at the start of the next 5-minute interval
        const nextFiveMin = new Date(now)
        nextFiveMin.setSeconds(0, 0)
        const currentMinute = nextFiveMin.getMinutes()
        const nextInterval = Math.ceil((currentMinute + 1) / 5) * 5
        nextFiveMin.setMinutes(nextInterval)
        return nextFiveMin.getTime()
      }
      case "15min": {
        // Fetch at the start of the next 15-minute interval
        const next15Min = new Date(now)
        next15Min.setSeconds(0, 0)
        const currentMinute = next15Min.getMinutes()
        const nextInterval = Math.ceil((currentMinute + 1) / 15) * 15
        next15Min.setMinutes(nextInterval)
        return next15Min.getTime()
      }
      case "30min": {
        // Fetch at the start of the next 30-minute interval
        const next30Min = new Date(now)
        next30Min.setSeconds(0, 0)
        const currentMinute = next30Min.getMinutes()
        const nextInterval = Math.ceil((currentMinute + 1) / 30) * 30
        next30Min.setMinutes(nextInterval)
        return next30Min.getTime()
      }
      case "1hour":
      case "1H": {
        // Fetch at the start of the next hour
        const nextHour = new Date(now)
        nextHour.setMinutes(0, 0, 0)
        nextHour.setHours(nextHour.getHours() + 1)
        return nextHour.getTime()
      }
      case "4hour":
      case "4H": {
        // Fetch at the start of the next 4-hour interval (0, 4, 8, 12, 16, 20)
        const next4Hour = new Date(now)
        next4Hour.setMinutes(0, 0, 0)
        const currentHour = next4Hour.getHours()
        const nextInterval = Math.ceil((currentHour + 1) / 4) * 4
        next4Hour.setHours(nextInterval)
        return next4Hour.getTime()
      }
      case "1D": {
        // Fetch at the start of the next day
        const nextDay = new Date(now)
        nextDay.setHours(0, 0, 0, 0)
        nextDay.setDate(nextDay.getDate() + 1)
        return nextDay.getTime()
      }
      default:
        // Default to 15 minutes from now
        return now.getTime() + 15 * 60 * 1000
    }
  }, [])

  // Schedule automatic fetch for a timeframe
  const scheduleTimeframeFetch = useCallback(
    (timeframe: string) => {
      const cacheKey = getCacheKey()
      const scheduleKey = `${cacheKey}_${timeframe}`

      const existingTimeout = globalScheduledFetches.get(scheduleKey)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      const nextFetchTime = getNextFetchTime(timeframe)
      const now = Date.now()
      const delay = Math.max(1000, nextFetchTime - now)

      const timeout = setTimeout(async () => {
        if (!isMountedRef.current) return
        try {
          // Pass necessary props to fetchTimeframeData
          await fetchTimeframeData(symbol, contractAddress, isDex, timeframe, true, getCacheKey)
          if (isMountedRef.current) {
            scheduleTimeframeFetch(timeframe)
          }
        } catch (error) {
          console.error(`Scheduled fetch failed for ${timeframe}:`, error)
          if (isMountedRef.current) {
            setTimeout(() => scheduleTimeframeFetch(timeframe), 60000)
          }
        }
      }, delay)

      globalScheduledFetches.set(scheduleKey, timeout)
    },
    [getCacheKey, getNextFetchTime, symbol, contractAddress, isDex], // Added symbol, contractAddress, isDex
  )

  // Load cached indicators from localStorage on mount
  useEffect(() => {
    try {
      const cacheKey = getCacheKey()
      // OLD: const savedIndicators = localStorage.getItem(`${cacheKey}_indicators_by_timeframe`)
      const savedGlobalIndicators = localStorage.getItem(`${cacheKey}_indicators`) // NEW: Load global indicators
      if (savedGlobalIndicators) {
        const parsedIndicators = JSON.parse(savedGlobalIndicators)
        setActiveIndicators(parsedIndicators)
        // console.log("Loaded global indicators:", parsedIndicators)
      } else {
        // console.log("No saved global indicators found, chart will start with no indicators")
        setActiveIndicators([])
      }
    } catch (err) {
      console.error("Error loading saved indicators:", err)
    }
  }, [getCacheKey])

  // Save indicators to localStorage when they change
  useEffect(() => {
    try {
      const cacheKey = getCacheKey()
      // OLD: if (Object.keys(activeIndicatorsByTimeframe).length > 0) {
      // OLD: localStorage.setItem(`${cacheKey}_indicators_by_timeframe`, JSON.stringify(activeIndicatorsByTimeframe))
      // OLD: console.log("Saved timeframe-specific indicators to localStorage:", activeIndicatorsByTimeframe)
      // OLD: }
      localStorage.setItem(`${cacheKey}_indicators`, JSON.stringify(activeIndicators)) // NEW: Save global indicators
      // console.log("Saved global indicators to localStorage:", activeIndicators)
    } catch (err) {
      console.error("Error saving indicators:", err)
    }
  }, [activeIndicators, getCacheKey])

  // Load cached chart data from localStorage on mount
  useEffect(() => {
    try {
      const cacheKey = getCacheKey()
      const savedChartData = localStorage.getItem(`${cacheKey}_chart_data`)
      if (savedChartData) {
        const parsedData = JSON.parse(savedChartData)
        setCachedChartData(parsedData)
        console.log("Loaded cached chart data for timeframes:", Object.keys(parsedData))

        // If we have cached data for the selected range, use it immediately
        if (parsedData[selectedRange]) {
          console.log(`Using cached data for initial ${selectedRange} timeframe from localStorage`)
          // We'll use this data when the chart is initialized
        } else {
          console.log(`No cached data for ${selectedRange} timeframe, will need to fetch it`)
        }
      }
    } catch (err) {
      console.error("Error loading cached chart data:", err)
    }
  }, [getCacheKey, selectedRange])

  // Save chart data to localStorage when it changes
  useEffect(() => {
    if (Object.keys(cachedChartData).length > 0) {
      const cacheKey = getCacheKey()

      // Compress the data before saving to reduce storage size
      const compressedData: Record<string, TimeframeData> = {}

      Object.entries(cachedChartData).forEach(([timeframe, timeframeData]) => {
        compressedData[timeframe] = {
          ...timeframeData,
          data: compressChartData(timeframeData.data),
        }
      })

      // Use the new quota management function
      const success = saveToLocalStorageWithQuotaManagement(`${cacheKey}_chart_data`, compressedData)

      if (success) {
        console.log("Saved compressed chart data to localStorage for timeframes:", Object.keys(compressedData))
      } else {
        console.warn("Failed to save chart data to localStorage due to quota limits")
      }
    }
  }, [cachedChartData, getCacheKey])

  // Available indicators from KLineChart's built-in offerings
  const availableIndicators = [
    { id: "MA", name: "MA" },
    { id: "EMA", name: "EMA" },
    { id: "SMA", name: "SMA" },
    { id: "BBI", name: "BBI" },
    { id: "VOL", name: "VOL" },
    { id: "MACD", name: "MACD" },
    { id: "BOLL", name: "BOLL" },
    { id: "KDJ", name: "KDJ" },
    { id: "RSI", name: "RSI" },
    { id: "BIAS", name: "BIAS" },
    { id: "WILLIAMS", name: "WILLIAMS" },
    { id: "CCI", name: "CCI" },
    { id: "DMI", name: "DMI" },
    { id: "CR", name: "CR" },
    { id: "PSY", name: "PSY" },
    { id: "DMA", name: "DMA" },
    { id: "TRIX", name: "TRIX" },
    { id: "OBV", name: "OBV" },
    { id: "VR", name: "VR" },
    { id: "MTM", name: "MTM" },
    { id: "EMV", name: "EMV" },
    { id: "SAR", name: "SAR" },
  ]

  // Initialize chart when component mounts
  useEffect(() => {
    initializeChart()

    // If we have a contract address or symbol, fetch data intelligently
    if (contractAddress || symbol) {
      console.log(
        `Component mounted with ${contractAddress ? "contract address: " + contractAddress : "symbol: " + symbol}`,
      )

      // Check if we already have cached data for the selected timeframe
      const cachedData = cachedChartData[selectedRange]
      if (cachedData && cachedData.data) {
        console.log(`Using cached data for ${selectedRange} from state`)
        // We'll use the data in the updateChartData useEffect
      } else {
        // If no cached data, fetch only essential timeframes initially
        console.log("No cached data available, fetching essential timeframes")
        fetchEssentialTimeframes()
      }
    }

    return () => {
      // Mark component as unmounted
      isMountedRef.current = false

      // Cleanup scheduled fetches for this component
      const cacheKey = getCacheKey()
      timeFrameOptions.forEach((tf) => {
        const scheduleKey = `${cacheKey}_${tf.id}`
        const timeout = globalScheduledFetches.get(scheduleKey)
        if (timeout) {
          clearTimeout(timeout)
          globalScheduledFetches.delete(scheduleKey)
        }
      })

      // Cleanup chart
      if (chartInstance.current && chartContainerRef.current) {
        try {
          dispose(chartContainerRef.current.id)
        } catch (e) {
          console.error("Error disposing chart instance:", e)
        }
        chartInstance.current = null
      }
    }
  }, [contractAddress, symbol, isDex])

  // Initialize chart function - defined early to be available for handleTimeFrameChange
  const initializeChart = () => {
    if (!chartContainerRef.current) return

    // Generate a unique ID to prevent conflicts with multiple chart instances
    const uniqueId = `asset-chart-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`
    
    // Ensure the container has a unique ID
    if (!chartContainerRef.current.id) {
      chartContainerRef.current.id = uniqueId
    }

    console.log(`Initializing chart with ID: ${chartContainerRef.current.id}`)

    // Dispose existing chart
    if (chartInstance.current) {
      try {
        dispose(chartContainerRef.current.id)
      } catch (e) {
        console.error("Error disposing chart instance:", e)
      }
    }

    try {
      // Create chart instance using the init function with custom layout
      chartInstance.current = init(chartContainerRef.current.id, {
        // Custom layout configuration with dedicated areas for different components
        layout: [
          {
            // @ts-ignore - Type checking issue with string literal vs enum
            type: "candle",
            content: [], // No default indicators
            options: {
              id: "candle_pane",
              height: 300,
              minHeight: 120,
              dragEnabled: true,
              order: Number.MIN_SAFE_INTEGER,
              axis: {
                // @ts-ignore - Type checking issue with string literal vs enum
                position: "right",
                scrollZoomEnabled: true,
                gap: {
                  top: 2,
                  bottom: 2,
                },
              },
            },
          },
          {
            // @ts-ignore - Type checking issue with string literal vs enum
            type: "xAxis",
            options: {
              order: 9,
              height: 40, // Increased from 25 to 40 for better label visibility
            },
          },
        ],
        styles: {
          grid: {
            show: true,
            horizontal: {
              show: true,
              size: 1,
              color: "rgba(255, 255, 255, 0.1)",
              style: LineType.Dashed,
              dashedValue: [2, 2],
            },
            vertical: {
              show: true,
              size: 1,
              color: "rgba(255, 255, 255, 0.1)",
              style: LineType.Dashed,
              dashedValue: [2, 2],
            },
          },
          candle: {
            // Using the correct string value for candle type (v10 compatibility)
            // @ts-ignore - Type checking issue with string literal vs enum
            type: "candle_solid",
            bar: {
              upColor: "#46A758",
              downColor: "#F92855",
              noChangeColor: "#888888",
              upBorderColor: "#46A758",
              downBorderColor: "#F92855",
              noChangeBorderColor: "#888888",
              upWickColor: "#46A758",
              downWickColor: "#F92855",
              noChangeWickColor: "#888888",
            },
            tooltip: {
              features: [], // Changed from icons to features as per v10 documentation
            },
          },
          indicator: {
            ohlc: {
              upColor: "#46A758",
              downColor: "#F92855",
              noChangeColor: "#888888",
            },
            bars: [
              {
                style: PolygonType.Fill,
                borderStyle: LineType.Solid,
                borderSize: 1,
                borderDashedValue: [2, 2],
                upColor: "rgba(70, 167, 88, 0.7)",
                downColor: "rgba(249, 40, 85, 0.7)",
                noChangeColor: "#888888",
              },
            ],
            lines: [
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                dashedValue: [2, 2],
                color: "#ffffff", // White
              },
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                dashedValue: [2, 2],
                color: "rgba(255, 255, 255, 0.7)", // Lighter white
              },
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                dashedValue: [2, 2],
                color: "rgba(255, 255, 255, 0.5)", // Even lighter white
              },
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                dashedValue: [2, 2],
                color: "rgba(255, 255, 255, 0.3)", // Very light white
              },
            ],
            tooltip: {
              features: [], // Changed from icons to features as per v10 documentation
            },
          },
          xAxis: { // Re-added xAxis styles here to ensure they override defaults.
            show: true,
            axisLine: {
              show: true,
              color: "rgba(255, 255, 255, 0.5)",
              size: 1,
            },
            tickLine: {
              show: true,
              color: "rgba(255, 255, 255, 0.5)",
              size: 1,
              length: 5,
            },
            tickText: {
              show: true,
              color: "#ffffff",
              size: 14,
              family: "Inter, system-ui, sans-serif",
              weight: "500",
              marginStart: 6,
              marginEnd: 6,
            },
          },
          yAxis: {
            axisLine: {
              color: "rgba(255, 255, 255, 0.2)",
            },
            tickLine: {
              color: "rgba(255, 255, 255, 0.2)",
            },
            tickText: {
              color: "#ffffff",
              size: 12,
              family: "Inter, system-ui, sans-serif",
              weight: "normal",
            },
          },
          separator: {
            size: 1,
            color: "rgba(255, 255, 255, 0.2)",
            fill: true,
          },
          crosshair: {
            horizontal: {
              line: {
                size: 1,
                color: "rgba(255, 255, 255, 0.4)",
                style: LineType.Dashed,
              },
              text: {
                show: true,
                color: "#FFFFFF",
                size: 12,
                family: "Inter, system-ui, sans-serif",
                weight: "normal",
                // @ts-ignore - Type checking issue with background property
                background: {
                  color: "rgba(0, 0, 0, 0.8)",
                  size: 3,
                },
              },
            },
            vertical: {
              line: {
                size: 1,
                color: "rgba(255, 255, 255, 0.4)",
                style: LineType.Dashed,
              },
              text: {
                show: true,
                color: "#FFFFFF",
                size: 12,
                family: "Inter, system-ui, sans-serif",
                weight: "normal",
                // @ts-ignore - Type checking issue with background property
                background: {
                  color: "rgba(0, 0, 0, 0.8)",
                  size: 3,
                },
              },
            },
          },
        },
        // Set timezone to UTC instead of local timezone
        timezone: "UTC",
        // Theme config for v10
        theme: "dark",
        // Add custom API configuration for proper time formatting
        customApi: {
          formatDate: (timestamp: number, formatString: string, type: FormatDateType) => {
            const date = new Date(timestamp)
            // console.log(`formatDate called: timestamp=${timestamp}, formatString='${formatString}', type='${type}', selectedRange=${selectedRange}`)
            
            // Compare with defined FormatDateType constants
            if (type === KLINECHARTS_FORMAT_DATE_TYPE_XAXIS) {
              if (selectedRange === "1D") {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
              } else if (["1min", "5min", "15min", "30min", "1hour", "4hour", "1H", "4H"].includes(selectedRange)) {
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
              } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
              }
            } else if (type === KLINECHARTS_FORMAT_DATE_TYPE_CROSSHAIR) {
              return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
            } else if (type === KLINECHARTS_FORMAT_DATE_TYPE_TOOLTIP) {
              if (selectedRange === "1D") {
                 return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
              } else { 
                 const now = new Date();
                 const isSameDay = date.getUTCDate() === now.getUTCDate() && date.getUTCMonth() === now.getUTCMonth() && date.getUTCFullYear() === now.getUTCFullYear();
                 if (isSameDay) {
                   return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second:'2-digit', hour12: true, timeZone: 'UTC' });
                 } else {
                   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC'});
                 }
              }
            }
            return date.toLocaleString('en-US', { timeZone: 'UTC' }); // Default fallback with UTC
          }
        }
      })

      // Configure price precision based on price value
      const price = chartData?.data?.datasets?.[0]?.data?.[0] || 0

      // Ensure price is a valid number and precision is within valid range
      let precision = 2 // Default precision

      try {
        if (typeof price === "number" && !isNaN(price) && isFinite(price)) {
          // Handle very large and very small numbers more carefully
          const absPrice = Math.abs(price)
          if (absPrice >= 1000) precision = 0
          else if (absPrice >= 100) precision = 1
          else if (absPrice >= 1) precision = 2
          else if (absPrice >= 0.1) precision = 3
          else if (absPrice >= 0.01) precision = 4
          else if (absPrice >= 0.001) precision = 5
          else if (absPrice >= 0.0001) precision = 6
          else if (absPrice > 0)
            precision = 8 // Cap at 8 decimal places for very small values
          else precision = 0 // For zero
        }

        // Ensure precision is a valid integer between 0 and 20
        precision = Math.max(0, Math.min(8, Math.floor(precision)))

        console.log("Setting chart precision to:", precision, "for price:", price)

        chartInstance.current.setPrecision({
          price: precision,
          volume: 0,
        })
      } catch (err) {
        console.error("Error setting precision:", err)
        // Fall back to default precision if there was an error
        try {
          console.log("Falling back to default precision (2)")
          chartInstance.current.setPrecision({
            price: 2,
            volume: 0,
          })
        } catch (fallbackErr) {
          console.error("Even default precision failed:", fallbackErr)
        }
      }

      // Additional styles specifically for indicators
      try {
        // Set indicator styles for better visualization
        chartInstance.current.setStyles({
          indicator: {
            bars: [
              {
                style: PolygonType.Fill,
                borderStyle: LineType.Solid,
                borderSize: 1,
                upColor: "rgba(70, 167, 88, 0.7)",
                downColor: "rgba(249, 40, 85, 0.7)",
                noChangeColor: "#888888",
              },
            ],
            lines: [
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                color: "#ffffff", // White
              },
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                color: "rgba(255, 255, 255, 0.7)", // Lighter white
              },
              {
                style: LineType.Solid,
                smooth: false,
                size: 1.5,
                color: "rgba(255, 255, 255, 0.5)", // Even lighter white
              },
            ],
          },
        })

        // Set up default pane heights for volume and other indicators
        chartInstance.current.setPaneOptions({
          paneId: "candle_pane", // Main candle pane
          options: {
            height: 300,
            minHeight: 150, // Ensure enough height for candle display
          },
        })
      } catch (e) {
        console.error("Error setting additional indicator styles:", e)
      }

      // Only update chart data if we have valid data
      if (chartData && chartData.data && chartData.data.datasets && chartData.data.datasets.length > 0) {
        updateChartData()
      } else {
        console.log("No valid chart data available during initialization, waiting for data...")
      }

      // Set up chart resize observer to handle responsive behavior
      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
          if (chartInstance.current) {
            chartInstance.current.resize()
          }
        })
        resizeObserver.observe(chartContainerRef.current)
      }
    } catch (e) {
      console.error("Error initializing chart:", e)
    }
  }

  // Fetch only essential timeframes to reduce API calls
  const fetchEssentialTimeframes = async () => {
    setIsLoading(true)
    try {
      const essentialTimeframes = [selectedRange]
      if (selectedRange !== "1D") {
        essentialTimeframes.push("1D")
      }
      for (const timeframe of essentialTimeframes) {
        try {
          // Corrected arguments for fetchTimeframeData: Added forceRefresh (false) and getCacheKey
          const data = await fetchTimeframeData(symbol, contractAddress, isDex, timeframe, false, getCacheKey)
          if (data && (data.data || Array.isArray(data))) { // Check for array for EOD data
            const now = Date.now()
            setCachedChartData((prev) => ({
              ...prev,
              [timeframe]: {
                data: data,
                lastUpdated: now,
                expiryTime: getExpiryTimeForTimeframe(timeframe),
              },
            }))
            if (timeframe === selectedRange) {
              updateChartWithData(data)
            }
            scheduleTimeframeFetch(timeframe)
          }
        } catch (error) {
          console.error(`Failed to fetch ${timeframe} data:`, error)
        }
      }
    } catch (error) {
      console.error("Error fetching essential timeframes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to get data expiry time based on timeframe
  const getExpiryTimeForTimeframe = (timeframe: string): number => {
    switch (timeframe) {
      case "1min":
        return 60 * 1000 // 1 minute
      case "5min":
        return 5 * 60 * 1000 // 5 minutes
      case "15min":
        return 15 * 60 * 1000 // 15 minutes
      case "30min":
        return 30 * 60 * 1000 // 30 minutes
      case "1hour":
      case "1H":
        return 60 * 60 * 1000 // 1 hour
      case "4hour":
      case "4H":
        return 4 * 60 * 60 * 1000 // 4 hours
      case "1D":
        return 24 * 60 * 60 * 1000 // 1 day
      default:
        return 15 * 60 * 1000 // Default to 15 minutes
    }
  }

  // Fetch data for a specific timeframe with proper deduplication
  const fetchTimeframeData = async (symbol: string, contractAddress: string, isDex: boolean, timeframe: string, forceRefresh = false, getCacheKeyInternal: () => string) => {
    const cacheKey = getCacheKeyInternal() // Use the passed-in function
    const requestKey = `${cacheKey}_${timeframe}`

    if (!forceRefresh && globalRequestCache.has(requestKey)) {
      // console.log(`Request for ${timeframe} already in progress, waiting for result`)
      return await globalRequestCache.get(requestKey)
    }

    // console.log(`Fetching data for ${timeframe} timeframe for ${symbol || contractAddress}`)

    try {
      const fmpInterval = getApiSafeInterval(timeframe)
      const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : "https://koyn.ai:3001"
      // console.log(`Converting timeframe for API: "${timeframe}" → "${fmpInterval}"`)

      let response
      const requestPromise = (async () => {
        const subscriptionId = getSubscriptionId() // Re-added getSubscriptionId for use here
        const subscriptionParam = subscriptionId ? `&id=${subscriptionId}` : ''

        if (timeframe === "1D") {
          if (contractAddress) {
            response = await fetch(`${baseUrl}/api/chart/eod?contractAddress=${contractAddress}${subscriptionParam}`)
          } else if (isDex) {
            response = await fetch(`${baseUrl}/api/chart/eod?symbol=${symbol}&dex=true${subscriptionParam}`)
          } else {
            response = await fetch(`${baseUrl}/api/chart/eod?symbol=${symbol}${subscriptionParam}`)
          }
        } else {
          if (contractAddress) {
            response = await fetch(`${baseUrl}/api/chart?contractAddress=${contractAddress}&interval=${fmpInterval}${subscriptionParam}`)
          } else if (isDex) {
            response = await fetch(`${baseUrl}/api/chart?symbol=${symbol}&interval=${fmpInterval}&dex=true${subscriptionParam}`)
          } else {
            response = await fetch(`${baseUrl}/api/chart?symbol=${symbol}&interval=${fmpInterval}${subscriptionParam}`)
          }
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        if (!data || (!data.data && !Array.isArray(data))) { // Allow direct array for EOD
          throw new Error("Invalid data format received")
        }
        return data
      })()

      globalRequestCache.set(requestKey, requestPromise)
      const result = await requestPromise
      globalRequestCache.delete(requestKey)
        return result
    } catch (error) {
      globalRequestCache.delete(requestKey)
      console.error(`Error fetching ${timeframe} data for ${symbol || contractAddress}:`, error)
      throw error
    }
  }

  // Update chart with specific data
  const updateChartWithData = (data: any) => {
    if (!chartInstance.current) {
      console.warn("Cannot update chart: chart instance not initialized")
      return
    }

    if (!data) {
      console.warn("Cannot update chart: no data provided")
      return
    }

    // Enhanced validation to handle both EOD and regular formats
    if (!data.data) {
      console.warn("Cannot update chart: missing data property", data)
      return
    }

    // Validate based on data format and available data structures
    const hasChartJsData = data.chartJsData && data.chartJsData.labels && data.chartJsData.datasets
    const hasEodData = data.format === "eod" && Array.isArray(data.data) && data.data.length > 0
    const hasRegularData = data.data.datasets && Array.isArray(data.data.datasets) && data.data.datasets.length > 0

    if (!hasChartJsData && !hasEodData && !hasRegularData) {
      console.warn("Cannot update chart: no valid data structure found", {
        hasChartJsData,
        hasEodData,
        hasRegularData,
        format: data.format,
        dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
        dataLength: Array.isArray(data.data) ? data.data.length : 'n/a'
      })
      return
    }

    try {
      console.log(`Updating chart with ${
        hasChartJsData ? data.chartJsData.labels.length :
        hasEodData ? data.data.length :
        data.data.labels?.length || 0
      } data points (format: ${data.format || 'regular'})`)

      // Update the chart display
      updateChartData(data)
    } catch (error) {
      console.error("Error updating chart with data:", error)
    }
  }

  // Update chart data and display
  const updateChartData = (data = null) => {
    if (!chartInstance.current) return

    // Use provided data or fall back to existing chartData prop
    const currentData = data || chartData

    // Enhanced validation to prevent errors
    if (!currentData) {
      console.warn("Cannot update chart: no data provided")
      return
    }

    console.log("Updating chart with data structure:", {
      format: currentData.format,
      type: currentData.type,
      hasData: !!currentData.data,
      hasDatasets: !!currentData.data?.datasets,
      dataLength: Array.isArray(currentData.data) ? currentData.data.length : "not array",
      datasetsLength: currentData.data?.datasets?.length || 0,
    })

    // For EOD format, we expect data.data to be an array
    if (currentData.format === "eod") {
      if (!currentData.data || !Array.isArray(currentData.data) || currentData.data.length === 0) {
        console.warn("Cannot update chart: EOD format requires valid data array")
        return
      }
    }
    // For regular format, we expect data.data.datasets
    else {
      if (!currentData.data || !currentData.data.datasets || currentData.data.datasets.length === 0) {
        console.warn("Cannot update chart: regular format requires valid datasets")
        return
      }
    }

    try {
      // Clear existing data
      chartInstance.current.clearData()

      // Convert chart.js format to KLineChart format
      const convertedData = convertChartData(currentData)

      if (!convertedData || convertedData.length === 0) {
        console.warn("Failed to convert chart data or empty dataset")
        return
      }

      console.log(`Applying ${convertedData.length} converted data points to chart`)

      // Set the converted data to the chart
      chartInstance.current.applyNewData(convertedData)

      // Debug: verify data was applied correctly
      const appliedData = chartInstance.current.getDataList()
      console.log("Data applied to chart:", {
        dataPointsApplied: appliedData.length,
        firstPoint: appliedData[0] ? {
          timestamp: appliedData[0].timestamp,
          time: new Date(appliedData[0].timestamp).toLocaleTimeString(),
          close: appliedData[0].close
        } : null,
        lastPoint: appliedData[appliedData.length - 1] ? {
          timestamp: appliedData[appliedData.length - 1].timestamp,
          time: new Date(appliedData[appliedData.length - 1].timestamp).toLocaleTimeString(),
          close: appliedData[appliedData.length - 1].close
        } : null
      })

      // Apply any active indicators
      if (activeIndicators.length > 0) {
        // Remove all existing indicators first to avoid duplicates
        const existingIndicators = chartInstance.current.getIndicators()
        existingIndicators.forEach((indicator: any) => {
          chartInstance.current.removeIndicator(indicator.id)
        })

        // Add the active indicators back
        activeIndicators.forEach((indicator) => {
          // If indicator name is 'Volume' convert to 'VOL' for KLineChart
          const indicatorType = indicator === "Volume" ? "VOL" : indicator

          try {
            addIndicator(indicatorType)
          } catch (e) {
            console.error(`Failed to add indicator ${indicatorType}:`, e)
          }
        })
      }

      // Hide loading indicator
      setIsLoading(false)

      // Clear any error messages
      setDataError(null)

      console.log("Chart updated successfully")
    } catch (error) {
      console.error("Error updating chart data:", error)
      setDataError("Failed to update chart")
    }
  }

  const handleTimeFrameChange = async (timeFrame: typeof selectedRange, forceRefresh = false) => {
    const cacheKey = getCacheKey()
    setSelectedRange(timeFrame)
    setIsTimeFrameDropdownOpen(false)

    if (!symbol && !contractAddress) {
      // console.warn("No symbol or contract address provided for fetching interval data")
      return
    }

    // Check if we're switching between EOD (1D) and intraday formats
    const isCurrentEOD = selectedRange === "1D"
    const isNewEOD = timeFrame === "1D"
    const formatChange = isCurrentEOD !== isNewEOD

    // Force chart reinitialization if switching between data formats
    if (formatChange) {
      console.log(`Format change detected (${isCurrentEOD ? 'EOD' : 'intraday'} -> ${isNewEOD ? 'EOD' : 'intraday'}), reinitializing chart`)
      
      // Show loading state during reinitialization
      setIsLoading(true)
      
      // Clear current chart
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Reinitialize chart
      initializeChart()
      
      // Wait for chart to be ready
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Check if we have cached data for this timeframe
    const cachedData = cachedChartData[timeFrame]
    if (cachedData && cachedData.data && !forceRefresh) {
      console.log(`Using cached data for ${timeFrame}`)
      updateChartWithData(cachedData)
      if (formatChange) {
        setIsLoading(false)
      }
      return
    }

    // Fetch new data
    console.log(`Fetching new data for timeframe: ${timeFrame}`)
    
    try {
      const newData = await fetchTimeframeData(symbol, contractAddress, isDex, timeFrame, forceRefresh, getCacheKey)
      
      if (newData && (newData.data || Array.isArray(newData)) && isMountedRef.current) {
        // Cache the new data
        const now = Date.now()
        const updatedCache = {
          ...cachedChartData,
          [timeFrame]: {
            data: newData,
            lastUpdated: now,
            expiryTime: getExpiryTimeForTimeframe(timeFrame),
          },
        }
        
        setCachedChartData(updatedCache)
        updateChartWithData(newData)
      }
    } catch (error: any) {
      console.error("Error fetching interval data:", error)
      if (isMountedRef.current) {
        setDataError(`Failed to load ${timeFrame} data: ${error.message || "Unknown error"}`)
      }
    }
    
    if (formatChange) {
      setIsLoading(false)
    }
  }

  const addIndicator = (type: string) => {
    if (!chartInstance.current) return

    // Check if this indicator is already active (globally)
    if (activeIndicators.includes(type)) { // NEW: Check global activeIndicators
      // console.log(`Indicator ${type} is already globally active, skipping addition`)
      return
    }

    try {
      console.log(`Adding indicator: ${type} globally`)

      // Map indicator names to KLineChart's expected format
      let indicatorName = type
      if (type === "WILLIAMS") indicatorName = "WR"
      else if (type === "Simple Moving Average") indicatorName = "SMA"
      else if (type === "Moving Average") indicatorName = "MA"
      else if (type === "Exponential Moving Average") indicatorName = "EMA"
      else if (type === "Bull and Bear Index") indicatorName = "BBI"
      else if (type === "Volume") indicatorName = "VOL"
      else if (type === "Bollinger Bands") indicatorName = "BOLL"
      else if (type === "KDJ Indicator") indicatorName = "KDJ"
      else if (type === "Relative Strength Index") indicatorName = "RSI"

      // Check if this indicator already exists in the chart
      const existingIndicators = chartInstance.current.getIndicators()
      const alreadyExists = existingIndicators.some((ind: any) => ind.name === indicatorName)

      if (alreadyExists) {
        console.log(`Indicator ${indicatorName} already exists in chart, skipping creation`)

        // Still update our state to track it
        setActiveIndicators(prev => { // NEW: Update global activeIndicators
          if (!prev.includes(type)) {
            // console.log(`Adding ${type} to global active indicators`);
            return [...prev, type];
          }
          return prev;
        });

        return
      }

      // Get default parameters for this indicator based on KLineCharts documentation
      const calcParams = getDefaultPeriodForIndicator(indicatorName)

      // Determine if this indicator should overlay on the main chart
      let isOverlay = shouldOverlayIndicator(indicatorName)

      // Special case for volume indicator
      if (indicatorName === "VOL") {
        console.log(`Setting up volume indicator with params: ${calcParams}`)

        // Get current data to check if we have volume
        const allData = chartInstance.current.getDataList()

        // Make sure we have some data with volume
        if (allData.length === 0) {
          console.warn("No data available for volume indicator")
          // Make sure to add the indicator anyway with reasonable defaults
        } else {
          // Ensure data has volume - if not, we'll generate synthetic volume
          const hasVolume = allData.some((item: { volume?: number }) => (item.volume || 0) > 0)

          if (!hasVolume) {
            console.log("No volume data found, generating synthetic volume")
            // Generate synthetic volume for all data points
            const updatedData = allData.map((item: any, index: number) => {
              if (!item.volume || item.volume === 0) {
                const prev = index > 0 ? allData[index - 1] : null
                const priceChange = prev ? Math.abs((item.close - prev.close) / prev.close) : 0
                const baseVolume = 100000 // Base volume
                const volumeMultiplier = 1 + priceChange * 20 // Higher on price changes
                const randomFactor = 0.5 + Math.random()
                item.volume = Math.round(baseVolume * volumeMultiplier * randomFactor)
              }
              return item
            })

            // Update the chart with the new data that includes synthetic volume
            chartInstance.current.clearData()
            chartInstance.current.applyNewData(updatedData)
          }
        }

        // Force VOL to be in a separate pane, not overlaid
        isOverlay = false
      }

      console.log(`Creating indicator ${indicatorName} with params:`, calcParams, `isOverlay:`, isOverlay)

      // Add the built-in KLineChart indicator
      const indicatorId = chartInstance.current.createIndicator(
        {
          name: indicatorName,
          calcParams: calcParams,
        },
        // isOverlay parameter - false means create in a new pane
        isOverlay,
      )

      console.log(`Successfully created indicator with id: ${indicatorId}`)

      // Add to active indicators for the current timeframe
      setActiveIndicators(prev => { // NEW: Update global activeIndicators
        if (!prev.includes(type)) {
          // console.log(`Adding ${type} to global active indicators`);
          return [...prev, type];
        }
        return prev;
      });

      // Set specific height for indicator panes
      if (!isOverlay) {
        setTimeout(() => {
          // Find the indicator pane ID
          const indicators = chartInstance.current.getIndicators()
          const newIndicator = indicators.find((ind: any) => ind.name === indicatorName)

          if (newIndicator && newIndicator.paneId) {
            console.log(`Setting ${indicatorName} pane options`)
            chartInstance.current.setPaneOptions({
              paneId: newIndicator.paneId,
              options: {
                height: indicatorName === "VOL" ? 120 : 150,
                minHeight: indicatorName === "VOL" ? 80 : 100,
                dragEnabled: true, // Allow height adjustment by user
              },
            })
          }
        }, 100)
      }

      showToast(`Added ${type} indicator`, "success")
    } catch (err) {
      console.error(`Error adding ${type} indicator:`, err)
    }
  }

  // Helper function to determine if indicator should be overlaid on price chart
  const shouldOverlayIndicator = (type: string): boolean => {
    // These indicators typically overlay on the price chart
    const overlayIndicators = ["MA", "SMA", "EMA", "WMA", "DEMA", "TEMA", "BOLL", "BBI", "SAR"]
    return overlayIndicators.includes(type)
  }

  // Helper function to get default parameters for indicators
  const getDefaultPeriodForIndicator = (type: string): number[] => {
    switch (type) {
      case "MA":
        return [5, 10, 30, 60]
      case "EMA":
        return [6, 12, 20]
      case "SMA":
        return [12, 2]
      case "BBI":
        return [3, 6, 12, 24]
      case "VOL":
        return [5, 10, 20]
      case "MACD":
        return [12, 26, 9]
      case "BOLL":
        return [20, 2]
      case "KDJ":
        return [9, 3, 3]
      case "RSI":
        return [6, 12, 24]
      case "BIAS":
        return [6, 12, 24]
      case "BRAR":
        return [26]
      case "CCI":
        return [13]
      case "DMI":
        return [14, 6]
      case "CR":
        return [26, 10, 20, 40, 60]
      case "PSY":
        return [12, 6]
      case "DMA":
        return [10, 50, 10]
      case "TRIX":
        return [12, 20]
      case "OBV":
        return [30]
      case "VR":
        return [24, 30]
      case "WR":
        return [6, 10, 14]
      case "MTM":
        return [6, 10]
      case "EMV":
        return [14, 9]
      case "SAR":
        return [2, 2, 20]
      case "AO":
        return [5, 34]
      case "ROC":
        return [12, 6]
      default:
        return []
    }
  }

  const removeIndicator = (type: string) => {
    if (!chartInstance.current) return

    try {
      console.log(`Attempting to remove indicator: ${type} globally`)

      // Map indicator names properly for KLineChart
      const indicatorName = type === "WILLIAMS" ? "WR" : type === "Volume" ? "VOL" : type

      // Find all indicators with this name
      const indicators = chartInstance.current.getIndicators()
      const matchingIndicators = indicators.filter((indicator: any) => indicator.name === indicatorName)

      console.log(`Found ${matchingIndicators?.length || 0} instances of ${indicatorName} indicator to remove`)

      // Remove each matching indicator from the chart
      if (matchingIndicators && matchingIndicators.length > 0) {
        matchingIndicators.forEach((indicator: any) => {
          console.log(`Removing indicator with id: ${indicator.id}, name: ${indicator.name}`)
          try {
            chartInstance.current.removeIndicator(indicator.id)
            console.log(`Successfully removed indicator ${indicator.name} with id ${indicator.id}`)
          } catch (removeError) {
            console.error(`Failed to remove indicator ${indicator.name}:`, removeError)
          }
        })
      } else {
        console.warn(`No indicators found with name ${indicatorName} to remove`)
      }

      // Remove from active indicators for the current timeframe
      setActiveIndicators(prev => prev.filter(i => i !== type)); // NEW: Update global activeIndicators
      // console.log(`Removed ${type} from global active indicators`);

      showToast(`Removed ${type} indicator`, "info")
    } catch (err) {
      console.error(`Error removing ${type} indicator:`, err)
    }
  }

  // Apply technical indicators from API data
  const applyTechnicalIndicatorsFromAPI = (technicalIndicators: any) => {
    if (!chartInstance.current || !technicalIndicators) return

    try {
      console.log("Applying technical indicators from API data:", technicalIndicators)

      // Apply RSI if available
      if (technicalIndicators.rsi && !activeIndicators.includes("RSI")) {
        try {
          addIndicator("RSI")
          console.log("Added RSI indicator from API data")
        } catch (err) {
          console.error("Error adding RSI indicator:", err)
        }
      }

      // Apply MACD if available
      if (technicalIndicators.macd && !activeIndicators.includes("MACD")) {
        try {
          addIndicator("MACD")
          console.log("Added MACD indicator from API data")
        } catch (err) {
          console.error("Error adding MACD indicator:", err)
        }
      }
    } catch (e) {
      console.error("Error applying technical indicators from API:", e)
    }
  }

  // Helper function to get time multiplier based on selected range
  const getTimeMultiplierForRange = (range: string): number => {
    switch (range) {
      case "1min":
        return 60 * 1000 // 1 minute in milliseconds
      case "5min":
        return 5 * 60 * 1000
      case "15min":
        return 15 * 60 * 1000
      case "30min":
        return 30 * 60 * 1000
      case "1hour":
      case "1H":
        return 60 * 60 * 1000
      case "4hour":
      case "4H":
        return 4 * 60 * 60 * 1000
      case "6H":
        return 6 * 60 * 60 * 1000
      case "12H":
        return 12 * 60 * 60 * 1000
      case "1D":
        return 24 * 60 * 60 * 1000
      default:
        return 24 * 60 * 60 * 1000 // Default to daily
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isTimeFrameDropdownOpen || isIndicatorDropdownOpen) {
        const target = event.target as HTMLElement
        if (!target.closest(".timeframe-dropdown") && !target.closest(".indicator-dropdown")) {
          setIsTimeFrameDropdownOpen(false)
          setIsIndicatorDropdownOpen(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isTimeFrameDropdownOpen, isIndicatorDropdownOpen])

  // Update chart whenever chartData, selectedRange or cachedChartData changes
  useEffect(() => {
    if (!chartInstance.current) return

    console.log("Chart data, selected range, or cached data changed, updating chart display")

    // First priority: Use cached data for this timeframe if available
    const cachedData = cachedChartData[selectedRange]
    if (cachedData && cachedData.data) {
      console.log(
        `Using cached data for ${selectedRange} timeframe, last updated: ${new Date(cachedData.lastUpdated).toLocaleString()}`,
      )
      updateChartWithData(cachedData.data)
    }
    // Second priority: Use provided chartData from props if available
    else if (chartData) {
      console.log("No cached data available, using prop-provided chart data")
      updateChartWithData(chartData)

      // Store the prop-provided data in our cache for future use
      if (chartData && chartData.data) {
        const now = Date.now()
        setCachedChartData((prev) => ({
          ...prev,
          [selectedRange]: {
            data: chartData,
            lastUpdated: now,
            expiryTime: getExpiryTimeForTimeframe(selectedRange),
          },
        }))
      }
    }
    // Last resort: Fetch data for this timeframe if we don't have it
    else if ((contractAddress || symbol) && !isLoading) {
      console.log(`No data available for ${selectedRange}, fetching it now`)
      handleTimeFrameChange(selectedRange, true)
    }
  }, [selectedRange, chartData, cachedChartData, isLoading])

  // Replace the separate indicator effect with a more robust implementation
  useEffect(() => {
    if (!chartInstance.current) return

    // Only update indicators when chart data has been fully loaded
    if (!isLoading) {
      // OLD: const currentActiveIndicators = activeIndicatorsByTimeframe[selectedRange] || []
      const currentGlobalActiveIndicators = activeIndicators; // NEW: Use global active indicators
      const existingIndicators = chartInstance.current.getIndicators()

      // console.log(`Syncing indicators (global):`, {
      //   shouldHave: currentGlobalActiveIndicators,
      //   currentlyHas: existingIndicators.map((ind: any) => ind.name)
      // })

      const existingIndicatorNames = existingIndicators.map((ind: { name: string }) => {
        // Normalize names like "WR" back to "WILLIAMS" for comparison
        if (ind.name === "WR") return "WILLIAMS";
        // Add other normalizations if necessary (e.g. VOL to Volume if 'Volume' is stored in activeIndicators)
        return ind.name;
      });

      // First remove indicators that should no longer be active
      existingIndicators.forEach((indicator: { id: string; name: string }) => {
        let normalizedName = indicator.name;
        if (indicator.name === "WR") normalizedName = "WILLIAMS";
        // Ensure comparison is against the names stored in `activeIndicators` (e.g., "VOL", "MACD", etc.)
        // Assuming `activeIndicators` stores "VOL", "MACD", etc. as per `availableIndicators`
        if (!currentGlobalActiveIndicators.includes(normalizedName)) {
          // console.log(`Removing indicator ${normalizedName} (id: ${indicator.id}) as it's not in global active list`)
          chartInstance.current.removeIndicator(indicator.id)
        }
      })

      // Then add any missing indicators
      currentGlobalActiveIndicators.forEach((indicatorType) => { // indicatorType is "MA", "VOL" etc.
        const klineIndicatorName = indicatorType === "WILLIAMS" ? "WR" : indicatorType // Convert to KLineChart name if needed (e.g. "WILLIAMS" to "WR")
        
        if (!existingIndicatorNames.includes(klineIndicatorName)) {
          // console.log(`Adding missing global indicator ${indicatorType} (as ${klineIndicatorName}) to chart`)
          setTimeout(() => { // Use setTimeout to allow chart to settle
            try {
              // The addIndicator function takes the type like "MA", "VOL"
              addIndicator(indicatorType) 
            } catch (error) {
              console.error(`Failed to re-add global indicator ${indicatorType}:`, error)
            }
          }, 100) // A small delay might help
        }
      })
      // console.log(`Synchronized ${currentGlobalActiveIndicators.length} global indicators.`)
    }
  }, [selectedRange, isLoading, activeIndicators, chartInstance, addIndicator]) // Added chartInstance and addIndicator

  // Check if cached data needs refresh based on timeframe - but don't auto-refresh, let scheduled fetches handle it
  useEffect(() => {
    if (!chartInstance.current) return

    if (selectedRange && cachedChartData[selectedRange]) {
      const { lastUpdated, expiryTime } = cachedChartData[selectedRange]
      const now = Date.now()
      const dataAge = now - lastUpdated

      if (dataAge > expiryTime) {
        console.log(
          `Cached data for ${selectedRange} is expired (${Math.round(dataAge / 1000)}s old, expiry: ${Math.round(expiryTime / 1000)}s)`,
        )

        // Only start scheduled fetching if we don't already have it scheduled
        const cacheKey = getCacheKey()
        const scheduleKey = `${cacheKey}_${selectedRange}`
        if (!globalScheduledFetches.has(scheduleKey)) {
          console.log(`Starting scheduled fetching for ${selectedRange}`)
          scheduleTimeframeFetch(selectedRange)
        }
      } else {
        console.log(
          `Cached data for ${selectedRange} is still fresh (${Math.round(dataAge / 1000)}s old, expiry: ${Math.round(expiryTime / 1000)}s)`,
        )
      }
    }
  }, [selectedRange, cachedChartData, scheduleTimeframeFetch, getCacheKey])

  const convertChartData = (data: any) => {
    if (!data) {
      console.warn("No chart data available to convert")
      return []
    }

    console.log("Converting chart data with format:", data.format, "type:", data.type)

    try {
      // Check if we have chartJsData available (already processed format)
      // This takes priority over raw EOD data since it's already formatted
      if (data.chartJsData && data.chartJsData.labels && data.chartJsData.datasets) {
        console.log("Using chartJsData format with", data.chartJsData.labels.length, "data points")
        
        // Use the chartJsData structure instead of raw data
        const processData = {
          ...data,
          data: data.chartJsData,
          format: "chartjs" // Override format to use chart.js processing
        }
        
        // Process as regular chart.js format
        return convertChartJsFormat(processData)
      }

      // Check if this is EOD format data (typical of 1D timeframe from FMP)
      if (data.format === "eod" && Array.isArray(data.data)) {
        console.log("Converting EOD format data with", data.data.length, "data points")

        // EOD data from FMP comes as an array of OHLCV objects
        // Use the provided timestamps if available
        const timestamps = data.timestamps || []

        // Sort chronologically (oldest to newest) using timestamps if available
        const dataWithTimestamps = data.data.map((item: any, index: number) => ({
          ...item,
          timestamp: timestamps[index] || new Date(item.date).getTime(),
        }))

        const sortedData = dataWithTimestamps.sort((a: any, b: any) => a.timestamp - b.timestamp)

        // Map to KLineChart format
        const result = sortedData
          .filter((item: any) => item && (item.date || item.timestamp) && !isNaN(item.timestamp))
          .map((item: any) => {
            // Convert volume to a proper numeric value
            let volumeValue = 0
            if (item.volume !== undefined) {
              volumeValue = Number.parseFloat(item.volume)
              if (isNaN(volumeValue) || volumeValue < 0) volumeValue = 0
            }

            // Use sensible defaults if any data is missing
            return {
              timestamp: item.timestamp,
              open: Number(item.open) || Number(item.close) || 0,
              high: Number(item.high) || Number(item.close) || 0,
              low: Number(item.low) || Number(item.close) || 0,
              close: Number(item.close) || 0,
              volume: volumeValue,
            }
          })

        console.log(`Converted ${result.length} EOD data points`)
        return result
      }

      // For regular intraday data, use the chart.js format processing
      return convertChartJsFormat(data)
    } catch (err) {
      console.error("Error in convertChartData:", err)
      return []
    }
  }

  // Separate function to handle chart.js format processing
  const convertChartJsFormat = (data: any) => {
    // For regular intraday data, check for proper structure
    if (!data.data) {
      console.warn("Chart data missing 'data' property")
      return []
    }

    // If datasets is empty or undefined, return empty array
    if (!data.data.datasets || data.data.datasets.length === 0) {
      console.warn("Chart data has no datasets")
      return []
    }

    // Regular chart.js format processing (for intraday data)
    const labels = data.data.labels || []
    const prices = data.data.datasets[0].data || []

    // Look specifically for volume data in the second dataset
    const volumes = data.data.datasets[1]?.data || Array(labels.length).fill(0)
    const timestamps = data.timestamps || []

    // Sanity check for data validity
    if (labels.length === 0 || prices.length === 0) {
      console.warn("Empty data arrays in chart data")
      return []
    }

    console.log("API provided timestamps:", timestamps?.length || 0)
    console.log("Labels length:", labels.length)
    console.log("First few timestamps:", timestamps?.slice(0, 3))
    console.log("First few labels:", labels.slice(0, 3))

    // Use API provided timestamps if available and correct length, otherwise generate them
    let finalTimestamps: number[]

    if (timestamps && timestamps.length === labels.length) {
      console.log("Using API provided timestamps")
      finalTimestamps = timestamps.map((ts: any) => Number(ts)) // Ensure they're numbers
    } else {
      console.log("Generating timestamps from labels due to mismatch or missing timestamps")
      finalTimestamps = generateTimestampsFromLabels(labels)
    }

    // Verify timestamp validity
    const validTimestamps = finalTimestamps.filter((ts) => !isNaN(ts) && ts > 0)
    if (validTimestamps.length !== finalTimestamps.length) {
      console.warn(`Found ${finalTimestamps.length - validTimestamps.length} invalid timestamps`)
      
      // If we have invalid timestamps, regenerate them all
      if (validTimestamps.length < finalTimestamps.length * 0.8) { // If more than 20% are invalid
        console.log("Too many invalid timestamps, regenerating all from labels")
        finalTimestamps = generateTimestampsFromLabels(labels)
      }
    }

    // Create pairs of index and timestamp for sorting
    const indexTimestampPairs = finalTimestamps.map((timestamp, index) => ({
      originalIndex: index,
      timestamp: timestamp,
      label: labels[index],
      price: prices[index],
      volume: volumes[index] || 0
    }))

    // Sort by timestamp (chronological order, oldest first)
    indexTimestampPairs.sort((a, b) => a.timestamp - b.timestamp)

    console.log("Time range for data:", {
      earliest: new Date(Math.min(...finalTimestamps)).toLocaleString(),
      latest: new Date(Math.max(...finalTimestamps)).toLocaleString(),
      totalPoints: finalTimestamps.length,
      sampleLabels: labels.slice(0, 3),
      sampleTimestamps: finalTimestamps.slice(0, 3).map(ts => new Date(ts).toLocaleTimeString())
    })

    // Log volume data for debugging
    console.log(
      `Volume data available: ${volumes.length > 0}, first few values:`,
      volumes.slice(0, 5).map((v: number | undefined) => v || 0),
    )

    // Map data to KLine format with proper OHLC values for candlesticks
    const result = indexTimestampPairs
      .map((pair, sortedIndex: number) => {
        try {
          const { originalIndex, timestamp, price: currentPrice } = pair
          
          // Set default OHLC values using current and previous prices
          let openValue = currentPrice
          let closeValue = currentPrice
          let highValue = currentPrice * 1.001 // Add slight variation
          let lowValue = currentPrice * 0.999 // Add slight variation

          // Use previous price as open if available (for candlestick effect)
          if (sortedIndex > 0) {
            openValue = indexTimestampPairs[sortedIndex - 1].price
          }

          // If we have explicit OHLC data, use it
          if (data.data.datasets[0].ohlc && data.data.datasets[0].ohlc[originalIndex]) {
            const ohlcData = data.data.datasets[0].ohlc[originalIndex]
            openValue = typeof ohlcData.open === 'number' ? ohlcData.open : openValue
            highValue = typeof ohlcData.high === 'number' ? ohlcData.high : currentPrice 
            lowValue = typeof ohlcData.low === 'number' ? ohlcData.low : currentPrice   
            closeValue = typeof ohlcData.close === 'number' ? ohlcData.close : currentPrice 
          } else {
            // No explicit OHLC data, create synthetic candle
            // Ensure closeValue is the currentPrice for this period
            closeValue = currentPrice;
            // Base high/low on open and close for the body
            highValue = Math.max(openValue, closeValue);
            lowValue = Math.min(openValue, closeValue);
            // Add small wicks if desired, can be adjusted or based on volatility if available
            // For simplicity, let's make wicks extend slightly beyond body if open != close
            if (openValue !== closeValue) {
                highValue = highValue * 1.0005;
                lowValue = lowValue * 0.9995;
            } else { // If open === close, make high/low equal to close (dot or flat line)
                highValue = closeValue;
                lowValue = closeValue;
            }
          }

          // Final OHLC integrity check: H >= O, H >= C, L <= O, L <= C
          const tempHigh = Math.max(openValue, closeValue, highValue);
          const tempLow = Math.min(openValue, closeValue, lowValue);
          
          highValue = tempHigh;
          lowValue = tempLow;

          // Ensure high is not less than open or close
          if (highValue < openValue) highValue = openValue;
          if (highValue < closeValue) highValue = closeValue;
          
          // Ensure low is not greater than open or close
          if (lowValue > openValue) lowValue = openValue;
          if (lowValue > closeValue) lowValue = closeValue;

          // Ensure volume is a valid number
          let volumeValue = Number.parseFloat(pair.volume)
          if (isNaN(volumeValue) || volumeValue < 0) volumeValue = 0

          return {
            timestamp,
            open: openValue,
            high: highValue,
            low: lowValue,
            close: closeValue,
            volume: volumeValue,
          }
        } catch (err) {
          console.error("Error converting data point at sorted index", sortedIndex, err)
          return null
        }
      })
      .filter(Boolean) // Remove any null entries

    console.log(`Converted ${result.length} data points with volume data, chronologically sorted`)
    
    return result
  }

  // Generate timestamps from labels if they weren't provided
  const generateTimestampsFromLabels = (labels: any[]) => {
    const timeMultiplier = getTimeMultiplierForRange(selectedRange)

    console.log(`Generating timestamps for ${labels.length} labels with interval ${selectedRange}`)

    // Get current time in UTC and round down to the nearest hour for intraday charts
    const now = new Date()
    const currentUTC = new Date(now.getTime())
    
    // For intraday charts, start from the current hour and work backwards
    if (selectedRange !== "1D") {
      // Round down to the nearest hour
      currentUTC.setUTCMinutes(0, 0, 0)
      
      // Generate timestamps working backwards from current time
      return labels.map((label: any, index: number) => {
        // Calculate how many intervals back this point should be
        const intervalsBack = labels.length - 1 - index
        const timestamp = currentUTC.getTime() - (intervalsBack * timeMultiplier)
        
        console.log(`Label ${index}: "${label}" -> ${new Date(timestamp).toISOString()}`)
        return timestamp
      })
    }

    // For daily charts, use the labels as dates
    return labels.map((label: any, index: number) => {
      try {
        const timeString = String(label).trim()

        // Try to parse as a date first
        let parsedDate = new Date(timeString)
        
        // If that fails, try common date formats
        if (isNaN(parsedDate.getTime())) {
          // Try MM/DD/YYYY format
          const dateMatch = timeString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
          if (dateMatch) {
            const [, month, day, year] = dateMatch
            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          }
        }

        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.getTime()
        }

        // Fallback: use index-based calculation from today
        const fallbackDate = new Date(currentUTC)
        fallbackDate.setUTCDate(fallbackDate.getUTCDate() - (labels.length - 1 - index))
        console.log(`Fallback for label ${index}: "${label}" -> ${fallbackDate.toISOString()}`)
        return fallbackDate.getTime()
      } catch (error) {
        console.error(`Error parsing label "${label}":`, error)
        // Fallback timestamp
        const fallbackDate = new Date(currentUTC)
        fallbackDate.setUTCDate(fallbackDate.getUTCDate() - (labels.length - 1 - index))
        return fallbackDate.getTime()
      }
    })
  }

  return (
    <div className="h-full w-full relative flex flex-col">
      {dataError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.7)] text-white rounded z-10">
          <div className="text-center p-4">
            <p className="mb-2">{dataError}</p>
            <button
              onClick={() => {
                setDataError(null)
                updateChartData()
              }}
              className="px-3 py-1 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div
          className={`absolute top-2 right-2 flex items-center bg-[rgba(0,0,0,0.7)] text-white rounded-full px-3 py-1 z-10 ${
            Object.keys(cachedChartData).includes(selectedRange) ? "opacity-70" : "opacity-100"
          }`}
        >
          <div className="animate-spin rounded-full h-4 w-4 mr-2 border-t-2 border-b-2 border-white"></div>
          <p className="text-xs">
            {Object.keys(cachedChartData).includes(selectedRange) ? "Refreshing..." : "Loading data..."}
          </p>
        </div>
      ) : null}

      {/* Chart Controls */}
      <div className="flex justify-between items-center px-2 py-2 flex-shrink-0">
        {/* Timeframe Dropdown */}
        <div className="relative timeframe-dropdown">
          <button
            className="bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white px-3 py-1 rounded flex items-center"
            onClick={() => setIsTimeFrameDropdownOpen(!isTimeFrameDropdownOpen)}
          >
            <span>{timeFrameOptions.find((tf) => tf.id === selectedRange)?.name || selectedRange}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isTimeFrameDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-[#1a1a1a] rounded shadow-lg z-20 min-w-[150px]">
              {timeFrameOptions.map((option) => (
                <button
                  key={option.id}
                  className={`block w-full text-left px-4 py-2 hover:bg-[rgba(255,255,255,0.2)] transition-colors first:rounded-t last:rounded-b ${
                    selectedRange === option.id ? "bg-[rgba(255,255,255,0.3)] text-white" : "text-gray-300"
                  }`}
                  onClick={() => handleTimeFrameChange(option.id as typeof selectedRange)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {cachedChartData[selectedRange] && (
          <div className="text-xs text-gray-400 ml-2 hidden md:block">
            Updated: {new Date(cachedChartData[selectedRange].lastUpdated).toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: true })} UTC
          </div>
        )}

        {/* Active Indicator Tags */}
        <div className="flex flex-wrap gap-2 mx-2">
          {[...new Set(activeIndicators)].map((indicator) => (
            <div
              key={indicator}
              className="bg-[rgba(255,255,255,0.2)] text-white px-2 py-1 rounded text-xs flex items-center"
            >
              {indicator}
              <button
                className="ml-1 text-white hover:text-red-300"
                onClick={() => removeIndicator(indicator)}
                aria-label={`Remove ${indicator} indicator`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Indicators Dropdown */}
        <div className="relative indicator-dropdown">
          <button
            className="bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.2)] text-white px-3 py-1 rounded flex items-center"
            onClick={() => setIsIndicatorDropdownOpen(!isIndicatorDropdownOpen)}
          >
            <span className="hidden sm:inline">Indicators</span>
            <span className="sm:hidden">Ind</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isIndicatorDropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1 bg-[#1a1a1a] rounded shadow-lg z-30 min-w-[180px] max-h-[250px] overflow-y-auto"
              style={{
                right: window.innerWidth < 640 ? "0" : "auto",
                maxWidth: window.innerWidth < 640 ? "calc(100vw - 20px)" : "280px",
              }}
            >
              {availableIndicators.map((option) => (
                <button
                  key={option.id}
                  className={`block w-full text-left px-3 py-2 text-xs hover:bg-[rgba(255,255,255,0.2)] transition-colors first:rounded-t last:rounded-b ${
                    activeIndicators.includes(option.id) ? "bg-[rgba(255,255,255,0.3)] text-white" : "text-gray-300"
                  }`}
                  onClick={() => {
                    if (activeIndicators.includes(option.id)) {
                      removeIndicator(option.id)
                    } else {
                      addIndicator(option.id)
                    }
                    // Close dropdown on mobile after selection
                    if (window.innerWidth < 640) {
                      setIsIndicatorDropdownOpen(false)
                    }
                  }}
                >
                  {activeIndicators.includes(option.id) && <span className="mr-2 text-green-400">✓</span>}
                  <span className="truncate">{option.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={chartContainerRef} className="flex-1 w-full min-h-0"></div>
      {toast.visible && (
        <div
          className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg z-30 transition-opacity duration-300 ${
            toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-blue-600"
          } text-white text-sm`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default AssetChart