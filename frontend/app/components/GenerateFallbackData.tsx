/**
 * Generates safe fallback data for charts when real data fails to load
 * @returns Array of safe OHLC data points
 */
export function generateFallbackData() {
    const now = new Date()
    const fallbackPrice = 100
  
    return Array(10)
      .fill(0)
      .map((_, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (10 - i))
  
        return {
          timestamp: date.getTime(),
          open: fallbackPrice * (1 - 0.005 + Math.random() * 0.01),
          high: fallbackPrice * (1 + 0.01 + Math.random() * 0.01),
          low: fallbackPrice * (1 - 0.01 - Math.random() * 0.01),
          close: fallbackPrice * (1 - 0.005 + Math.random() * 0.01),
          volume: Math.floor(fallbackPrice * 100),
        }
      })
  }
  