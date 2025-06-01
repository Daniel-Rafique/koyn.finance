"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router"
import AnalysisResults from "../components/AnalysisResults"
import SearchForm from "../components/SearchForm"
import ProtectedPage from "../components/ProtectedPage"
import { useAuth } from "../context/AuthProvider"
import { Routes } from "../utils/routes"
import "../styles/news-grid.css"
import "../styles/news-carousel-solid.css"
import Nav from "../components/Nav"
import Loader from "../components/Loader"
import NewsCarousel from "../components/NewsCarousel"

// Meta function for React Router to set page title and description
export const meta = ({ location }: { location: { search: string } }) => {
  const searchParams = new URLSearchParams(location.search)
  const query = searchParams.get("q")

  if (query) {
    return [
      { title: `Analysis: ${query} - koyn.finance` },
      {
        name: "description",
        content: `AI-powered financial analysis and market sentiment for ${query}. Get real-time insights, price trends, and social sentiment analysis.`,
      },
      { name: "robots", content: "noindex, nofollow" }, // Don't index specific searches
    ]
  }

  return [
    { title: "Market Analysis - koyn.finance" },
    {
      name: "description",
      content:
        "AI-powered financial market analysis with real-time sentiment tracking, price predictions, and comprehensive market insights for cryptocurrencies and stocks.",
    },
  ]
}

interface SearchResult {
  asset: {
    name: string
    symbol: string
    type: string
    price: string
  }
  asset_price: string
  chart: any
  social_sentiment: string
  analysis: string
  price_change_percentage: number
  actions: {
    can_save: boolean
    can_share: boolean
    result_id: string
    saved: boolean
  }
  ui_options: {
    show_save_button: boolean
    show_share_button: boolean
    save_button_text: string
    share_button_icon: string
    save_button_icon: string
    share_button_text: string
  }
}

interface NewsItem {
  source: string
  url: string
  title: string
  description?: string
  publishedAt?: string
}

interface ResultEntry {
  query: string
  results: SearchResult[]
  news: NewsItem[]
  timestamp: number
}

// Add a helper function to truncate long queries for mobile display
function truncateQuery(query: string, maxLength = 40): string {
  if (query.length <= maxLength) return query
  return query.substring(0, maxLength) + "..."
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}

// Helper functions for array-based storage
function getResultsArray(): ResultEntry[] {
  try {
    // Only access localStorage on client-side
    if (typeof window === "undefined") return []
    const storedArray = localStorage.getItem("koyn_analysis_results")
    if (!storedArray) return []
    return JSON.parse(storedArray)
  } catch (error) {
    console.error("Error retrieving results array:", error)
    return []
  }
}

function saveResultsArray(arr: ResultEntry[]): void {
  try {
    // Only access localStorage on client-side
    if (typeof window === "undefined") return
    localStorage.setItem("koyn_analysis_results", JSON.stringify(arr))
  } catch (error) {
    console.error("Error saving results array:", error)
  }
}

// Helper function to find entry index by query
function findEntryIndexByQuery(arr: ResultEntry[], query: string): number {
  const normalizedQuery = normalizeQuery(query)
  return arr.findIndex((entry) => normalizeQuery(entry.query) === normalizedQuery)
}

// Core Analysis Content - No subscription logic needed!
function AnalysisContent() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isSubscribed, userEmail, user, getSecureAccessToken } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [searchFormLoading, setSearchFormLoading] = useState(false)
  const [resultsArray, setResultsArray] = useState<ResultEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [isClientMounted, setIsClientMounted] = useState(false)
  const previousQueryRef = useRef<string | null>(null)
  const hasInitializedFromStorage = useRef<boolean>(false)
  const searchHistoryRef = useRef<string[]>([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [dropdownAnimation, setDropdownAnimation] = useState({
    opacity: 0,
    transform: "translateY(-10px)",
  })
  const [resultsVersion, setResultsVersion] = useState(0)
  const [historyVersion, setHistoryVersion] = useState(0)

  // Add scroll-based opacity state for floating search bar
  const [searchOpacity, setSearchOpacity] = useState(1)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isHoveringSearch, setIsHoveringSearch] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const query = searchParams.get("q")

  console.log("Analysis page - Current subscription status:", {
    isSubscribed,
    userEmail,
    user: user?.email,
  })

  // Effect to handle client-side mounting
  useEffect(() => {
    setIsClientMounted(true)
  }, [])

  // Load search history from localStorage on initial mount
  useEffect(() => {
    if (!isClientMounted) return
    try {
      const recentQueries = JSON.parse(localStorage.getItem("koyn_recent_queries") || "[]")
      searchHistoryRef.current = recentQueries
    } catch (error) {
      console.error("Error loading search history:", error)
      searchHistoryRef.current = []
    }
  }, [isClientMounted])

  // Load results array from localStorage on mount and set current index based on query
  useEffect(() => {
    if (!isClientMounted) return

    const arr = getResultsArray()
    setResultsArray(arr)

    if (query && arr.length > 0) {
      const index = findEntryIndexByQuery(arr, query)
      if (index !== -1) {
        setCurrentIndex(index)
        // If we found the query in localStorage, we don't need to fetch it
        console.log(`Found existing results for "${query}" at index ${index} - no API call needed`)
        setIsLoading(false)
        setIsFirstLoad(false)
      } else {
        // If query not found in array, set to most recent entry
        setCurrentIndex(arr.length - 1)
      }
    } else {
      // Default to most recent entry if available
      setCurrentIndex(arr.length > 0 ? arr.length - 1 : -1)
    }

    hasInitializedFromStorage.current = true
    // Only set loading to false if we found existing results or there's no query
    if (!query || (query && arr.length > 0 && findEntryIndexByQuery(arr, query) !== -1)) {
      setIsLoading(false)
    }
  }, [query, isClientMounted])

  // Function to show toast notifications
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setToast({ message, type })
    // Auto-hide toast after 5 seconds
    setTimeout(() => setToast(null), 5000)
  }

  // Update error handling in fetchAnalysis to use toast
  const handleApiError = (err: any, response?: Response) => {
    console.error("Error fetching results:", err)

    // Handle different error types with toast notifications
    if (response?.status === 429) {
      showToast("Daily search limit reached. Upgrade your plan for more searches!", 'error')
    } else if (response?.status === 401) {
      showToast("Session expired. Please refresh the page to sign in again.", 'error')
    } else if (response?.status === 403) {
      showToast("Access denied. Please check your subscription status.", 'error')
    } else if (response?.status && response.status >= 500) {
      showToast("Server maintenance in progress. Please try again in a few minutes.", 'error')
    } else if (err instanceof TypeError && err.message.includes("fetch")) {
      showToast("Connection error. Please check your internet and try again.", 'error')
    } else if (
      err instanceof Error &&
      (err.message.includes("429") ||
        err.message.includes("Too Many Requests") ||
        err.message.includes("Daily API limit exceeded") ||
        err.message.includes("Rate Limit Exceeded"))
    ) {
      showToast("Daily search limit reached. Upgrade your plan for more searches!", 'error')
    } else {
      showToast("Something went wrong. Please try again or contact support.", 'error')
    }
  }

  // Extract the fetch logic to a separate function that can be called from multiple places
  const fetchAnalysis = useCallback(
    async (
      questionQuery: string,
      setSearchLoadingCallback?: (loading: boolean) => void,
      isUserInitiated = false,
      providedSubscriptionId?: string | null,
      providedUserEmail?: string | null,
    ) => {
      if (!questionQuery) return

      setIsLoading(true)

      // Also set the search form loading state if a callback was provided
      if (setSearchLoadingCallback) {
        setSearchLoadingCallback(true)
        setSearchFormLoading(true)
      }

      console.log("Fetching analysis for:", questionQuery, "user initiated:", isUserInitiated)

      // For page refreshes (non-user initiated queries), check if we already have this query
      if (!isUserInitiated) {
        const currentStoredResults = getResultsArray()
        const existingIndex = findEntryIndexByQuery(currentStoredResults, questionQuery)
        if (existingIndex !== -1) {
          console.log(`Using existing results for "${questionQuery}" from localStorage at index ${existingIndex}`)

          // Update state with current localStorage data
          setResultsArray(currentStoredResults)
          setCurrentIndex(existingIndex)
          setIsLoading(false)
          setIsFirstLoad(false)

          // Reset search form loading state
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false)
            setSearchFormLoading(false)
          }

          // Force a re-render to ensure UI updates
          setResultsVersion((prevVersion) => prevVersion + 1)
          return // Exit early - no API call needed
        }
      }

      try {
        // SECURITY: Get access token securely with automatic refresh
        const accessToken = await getSecureAccessToken()

        if (!accessToken) {
          console.log("❌ No valid access token available")
          showToast("Authentication failed. Please sign in again.", 'error')
          setIsLoading(false)
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false)
            setSearchFormLoading(false)
          }
          return
        }

        // Prepare headers with JWT authentication
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        }

        // Prepare request body - only need the question now since auth is via JWT
        const requestBody = {
          question: questionQuery,
        }

        // Log the request details for debugging
        console.log("Sending API request with secure JWT authentication:", {
          question: questionQuery,
          hasToken: true,
          tokenSource: "memory-secure",
          userEmail: user?.email || userEmail,
        })

        let response
        try {
          response = await fetch("https://koyn.finance:3001/api/sentiment", {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
          })
        } catch (fetchError) {
          // Handle network-level errors including 429s that don't return a response
          console.error("Network error during fetch:", fetchError)

          if (
            fetchError instanceof Error &&
            (fetchError.message.includes("429") ||
              fetchError.message.includes("Too Many Requests") ||
              fetchError.message.includes("Daily API limit exceeded") ||
              fetchError.message.includes("Rate Limit Exceeded") ||
              fetchError.message.includes("rate limit"))
          ) {
            showToast("Daily search limit reached. Upgrade your plan for more searches!", 'error')
          } else if (fetchError instanceof TypeError && fetchError.message.includes("fetch")) {
            showToast("Connection error. Please check your internet and try again.", 'error')
          } else {
            showToast("Network error. Please try again or contact support.", 'error')
          }

          setIsLoading(false)
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false)
            setSearchFormLoading(false)
          }
          return
        }

        if (!response.ok) {
          // Handle rate limiting (429) with user-friendly message
          if (response.status === 429) {
            try {
              const errorData = await response.json()
              showToast(errorData.message || "Daily search limit reached. Upgrade your plan for more searches!", 'error')
            } catch (parseError) {
              showToast("Daily search limit reached. Upgrade your plan for more searches!", 'error')
            }
          }
          // Handle authentication errors
          else if (response.status === 401) {
            showToast("Session expired. Please refresh the page to sign in again.", 'error')
          }
          // Handle subscription issues
          else if (response.status === 403) {
            try {
              const errorData = await response.json()
              showToast(errorData.message || "Access denied. Please check your subscription status.", 'error')
            } catch (parseError) {
              showToast("Access denied. Please check your subscription status.", 'error')
            }
          }
          // Handle other server errors
          else if (response.status >= 500) {
            showToast("Server maintenance in progress. Please try again in a few minutes.", 'error')
          }
          // Generic error for other status codes
          else {
            showToast("Something went wrong. Please try again or contact support.", 'error')
          }

          setIsLoading(false)
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false)
            setSearchFormLoading(false)
          }
          return
        }

        const data = await response.json()

        if (data.subscription_expired) {
          showToast(data.message || "Subscription expired. Please renew to continue.", 'error')
          setIsLoading(false)

          // Reset search form loading state
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false)
            setSearchFormLoading(false)
          }

          return
        }

        if (data.results && data.results.length > 0) {
          // Add random price change percentage if not provided
          data.results.forEach((result: SearchResult) => {
            if (!result.price_change_percentage) {
              result.price_change_percentage = Number.parseFloat((Math.random() * 10 - 5).toFixed(2))
            }
          })

          // Log if we have news data
          console.log("API response includes news:", data.news ? `Yes (${data.news.length} items)` : "No")

          // If no news data is present in the API response, create sample news items for testing
          if (!data.news || data.news.length === 0) {
            console.log("Adding sample news items for testing")
            const fallbackDate = "2024-01-01T00:00:00.000Z" // Use consistent fallback date
            data.news = [
              {
                source: "CoinDesk",
                url: "https://www.coindesk.com/",
                title: "Bitcoin Price Analysis Shows Bullish Trend",
                description: "Recent market indicators suggest Bitcoin may continue its upward trajectory.",
                publishedAt: fallbackDate,
              },
              {
                source: "Reuters",
                url: "https://www.reuters.com/",
                title: "Market Analysts Predict Bitcoin Rally",
                description: "Financial experts weigh in on cryptocurrency market movements.",
                publishedAt: fallbackDate,
              },
            ]
          }

          // Create a new entry for this query
          const newEntry: ResultEntry = {
            query: questionQuery,
            results: data.results,
            news: data.news || [],
            timestamp: Date.now(),
          }

          // Check if we already have this query in our array
          const existingIndex = findEntryIndexByQuery(resultsArray, questionQuery)

          let newArray
          let newIndex
          if (existingIndex !== -1) {
            // Update existing entry
            newArray = [...resultsArray]
            newArray[existingIndex] = newEntry
            newIndex = existingIndex
            console.log(`Updated existing entry at index ${existingIndex} for query "${questionQuery}"`)
          } else {
            // Add new entry
            newArray = [...resultsArray, newEntry]
            newIndex = newArray.length - 1
            console.log(`Added new entry at index ${newIndex} for query "${questionQuery}"`)
          }

          // Update state - ALWAYS set the current index to the new/updated entry
          setResultsArray(newArray)
          setCurrentIndex(newIndex)
          setIsFirstLoad(false)

          // Save to localStorage
          saveResultsArray(newArray)

          // Update search history
          try {
            // Only access localStorage on client-side
            if (typeof window !== "undefined") {
              const recentQueries = JSON.parse(localStorage.getItem("koyn_recent_queries") || "[]")
              if (!recentQueries.includes(questionQuery)) {
                const updatedQueries = [
                  questionQuery,
                  ...recentQueries.filter((q: string) => q !== questionQuery).slice(0, 9),
                ]
                localStorage.setItem("koyn_recent_queries", JSON.stringify(updatedQueries))
                searchHistoryRef.current = updatedQueries
                setHistoryVersion((prev) => prev + 1)
              }
            }
          } catch (historyError) {
            console.error("Error updating search history:", historyError)
          }

          // Force UI update
          setResultsVersion((prevVersion) => prevVersion + 1)

          // Log that we've updated the current index
          console.log(`Current index set to ${newIndex} for query "${questionQuery}"`)
        }
      } catch (err) {
        handleApiError(err)
      } finally {
        setIsLoading(false)

        // Reset search form loading state
        if (setSearchLoadingCallback) {
          setSearchLoadingCallback(false)
          setSearchFormLoading(false)
        }
      }
    },
    [resultsArray, userEmail, isSubscribed, user, getSecureAccessToken],
  )

  // Handle search from the SearchForm component
  const handleSearch = useCallback(
    (
      searchQuery: string,
      setSearchLoadingCallback: (loading: boolean) => void,
      providedSubscriptionId?: string | null,
      providedUserEmail?: string | null,
    ) => {
      console.log("User initiated search with query:", searchQuery)

      // Update previous query reference
      previousQueryRef.current = searchQuery

      // Update URL with pushState to create a new history entry for browser navigation
      const newUrl = `${Routes.ANALYSIS}?q=${encodeURIComponent(searchQuery)}`
      window.history.pushState({}, "", newUrl)

      // Update search history in localStorage
      try {
        // Only access localStorage on client-side
        if (typeof window !== "undefined") {
          const recentQueries = JSON.parse(localStorage.getItem("koyn_recent_queries") || "[]")

          // Only add to history if this is a new query (not already in history)
          if (!recentQueries.includes(searchQuery)) {
            // Keep only the most recent 10 queries, excluding the current one
            const updatedQueries = [searchQuery, ...recentQueries.filter((q: string) => q !== searchQuery).slice(0, 9)]

            // Update localStorage and reference
            localStorage.setItem("koyn_recent_queries", JSON.stringify(updatedQueries))
            searchHistoryRef.current = updatedQueries
            console.log("Updated search history with new query:", searchQuery)
          }
        }
      } catch (err) {
        console.error("Error updating search history:", err)
      }

      // Always pass isUserInitiated=true for searches from the search form
      console.log("Initiating search with subscription data:", {
        id: providedSubscriptionId,
        email: providedUserEmail,
      })
      fetchAnalysis(searchQuery, setSearchLoadingCallback, true, providedSubscriptionId, providedUserEmail)
    },
    [fetchAnalysis],
  )

  // This effect handles initial loading of query from URL
  useEffect(() => {
    if (!query || !hasInitializedFromStorage.current || !isClientMounted) {
      return
    }

    console.log("All conditions met, processing initial URL query:", query)

    // Update previous query reference
    previousQueryRef.current = query

    // Find the index of this query in our results array
    const index = findEntryIndexByQuery(resultsArray, query)
    if (index !== -1) {
      // We already have this query, just update the current index
      console.log(`Found cached results for "${query}" at index ${index}`)
      setCurrentIndex(index)
      setIsLoading(false)
      setIsFirstLoad(false)
    } else {
      // We don't have this query yet, fetch it
      console.log(`No cached results found for "${query}" - fetching from API`)
      fetchAnalysis(query, undefined, false)
    }
  }, [query, isClientMounted, hasInitializedFromStorage.current, fetchAnalysis])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys when not typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (resultsArray.length > 1) {
        if (event.key === "ArrowLeft" && currentIndex > 0) {
          event.preventDefault()
          goToPrevious()
        } else if (event.key === "ArrowRight" && currentIndex < resultsArray.length - 1) {
          event.preventDefault()
          goToNext()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [currentIndex, resultsArray.length])
  // Get the current entry to display
  const currentEntry = resultsArray[currentIndex] || null

  // Navigation functions
  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)

      // Update URL to reflect the new query
      const newQuery = resultsArray[newIndex].query
      const newUrl = `${Routes.ANALYSIS}?q=${encodeURIComponent(newQuery)}`
      window.history.pushState({}, "", newUrl)

      console.log(`Navigated to previous result: "${newQuery}" (${newIndex + 1}/${resultsArray.length})`)
    }
  }

  const goToNext = () => {
    if (currentIndex < resultsArray.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)

      // Update URL to reflect the new query
      const newQuery = resultsArray[newIndex].query
      const newUrl = `${Routes.ANALYSIS}?q=${encodeURIComponent(newQuery)}`
      window.history.pushState({}, "", newUrl)

      console.log(`Navigated to next result: "${newQuery}" (${newIndex + 1}/${resultsArray.length})`)
    }
  }

  // Add effect for dropdown animation
  useEffect(() => {
    if (showHistoryDropdown) {
      // Start with invisible state, then animate to visible
      setDropdownAnimation({
        opacity: 0,
        transform: "translateY(-10px)",
      })

      // Small delay to allow for animation
      const timer = setTimeout(() => {
        setDropdownAnimation({
          opacity: 1,
          transform: "translateY(0)",
        })
      }, 10)

      return () => clearTimeout(timer)
    } else {
      setDropdownAnimation({
        opacity: 0,
        transform: "translateY(-10px)",
      })
    }
  }, [showHistoryDropdown])

  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] overflow-y-auto">
      <Nav />

      <canvas id="particles-canvas" className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"></canvas>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 min-h-[calc(100vh-160px)] flex flex-col pb-32">
        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-4 right-4 max-w-sm" style={{ zIndex: 100000 }}>
            <div 
              className={`p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 ${
                toast.type === 'error' 
                  ? 'bg-[rgba(0,0,0,0.9)] border-red-500/50 text-white' 
                  : toast.type === 'success'
                  ? 'bg-[rgba(0,0,0,0.9)] border-green-500/50 text-white'
                  : 'bg-[rgba(0,0,0,0.9)] border-[#a099d8]/50 text-white'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium">{toast.message}</p>
                </div>
                <button
                  onClick={() => setToast(null)}
                  className="ml-2 text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {isFirstLoad && isLoading && (!currentEntry || !currentEntry.results) ? (
          <div className="w-full">
            <div className="w-full text-center mb-8">
              <p className="text-[#a099d8] text-xl">{query}</p>
            </div>
            <div className="w-full flex justify-center">
              <Loader />
            </div>
          </div>
        ) : currentEntry && currentEntry.results ? (
          <div className={isLoading ? "opacity-50 relative" : ""} key={`results-container-${resultsVersion}`}>
            <div className="results-container">
              <div className="query-container mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {/* Navigation Controls */}
                    <div className="flex items-center mr-4">
                      {/* Back Button */}
                      {currentIndex > 0 ? (
                        <button
                          onClick={goToPrevious}
                          className="mr-2 text-[#a099d8] hover:text-white transition-colors flex items-center"
                          aria-label="Go back to previous search"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                          </svg>
                        </button>
                      ) : (
                        <button disabled className="mr-2 text-gray-600 opacity-50 cursor-not-allowed">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}

                      {/* Forward Button */}
                      {currentIndex < resultsArray.length - 1 ? (
                        <button
                          onClick={goToNext}
                          className="mr-2 text-[#a099d8] hover:text-white transition-colors flex items-center"
                          aria-label="Go forward to more recent search"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <button disabled className="mr-2 text-gray-600 opacity-50 cursor-not-allowed">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <h1 className="text-xl font-medium text-white">
                      Results for:{" "}
                      <span className="font-bold break-words" title={currentEntry.query}>
                        {truncateQuery(currentEntry.query, 60)}
                      </span>
                    </h1>
                  </div>

                  {/* History Controls */}
                  <div className="relative" style={{ zIndex: 500 }}>
                    <button
                      data-history-button="true"
                      onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                      className="text-[#a099d8] hover:text-white transition-colors flex items-center text-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="mr-1"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      History
                    </button>

                    {/* History Dropdown */}
                    {showHistoryDropdown && (
                      <div
                        className="fixed right-auto mt-2 w-64 bg-[rgb(13,10,33)] rounded-md shadow-lg z-[99999] transition-all duration-200 ease-out history-dropdown"
                        style={{
                          top: "auto",
                          position: "absolute",
                          right: 0,
                          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
                          zIndex: 99999,
                          opacity: dropdownAnimation.opacity,
                          transform: dropdownAnimation.transform,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-[rgba(64,47,181,0.3)] flex justify-between items-center">
                          <span className="text-white text-sm font-medium">Search History</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log("Clear All button clicked")
                              if (confirm("Clear all search history? This cannot be undone.")) {
                                localStorage.removeItem("koyn_analysis_results")
                                localStorage.removeItem("koyn_recent_queries")
                                setResultsArray([])
                                setCurrentIndex(-1)
                                searchHistoryRef.current = []
                                setShowHistoryDropdown(false)
                                // Navigate to analysis page without query
                                window.history.pushState({}, "", Routes.ANALYSIS)
                                setResultsVersion((prev) => prev + 1)
                                setHistoryVersion((prev) => prev + 1)
                              }
                            }}
                            type="button"
                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-[rgba(255,0,0,0.1)] clear-all-button"
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {searchHistoryRef.current.length > 0 ? (
                            <ul key={historyVersion}>
                              {searchHistoryRef.current.map((historyItem, index) => (
                                <li
                                  key={`${index}-${historyVersion}`}
                                  className="border-b border-[rgba(64,47,181,0.2)] last:border-b-0"
                                >
                                  <div className="flex items-center justify-between p-2 hover:bg-[rgba(64,47,181,0.1)]">
                                    <button
                                      onClick={() => {
                                        const newUrl = `${Routes.ANALYSIS}?q=${encodeURIComponent(historyItem)}`
                                        navigate(newUrl)
                                        setShowHistoryDropdown(false)
                                      }}
                                      className={`text-sm truncate flex-grow text-left ${
                                        currentEntry && historyItem === currentEntry.query
                                          ? "text-[#cf30aa] font-medium"
                                          : "text-[#a099d8]"
                                      }`}
                                      title={historyItem}
                                    >
                                      {truncateQuery(historyItem, 50)}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        try {
                                          // Remove from history
                                          const newHistory = searchHistoryRef.current.filter((q) => q !== historyItem)
                                          searchHistoryRef.current = newHistory
                                          localStorage.setItem("koyn_recent_queries", JSON.stringify(newHistory))

                                          // Remove from results
                                          const newResults = resultsArray.filter((entry) => entry.query !== historyItem)
                                          setResultsArray(newResults)
                                          localStorage.setItem("koyn_analysis_results", JSON.stringify(newResults))

                                          // Update current index if needed
                                          if (currentIndex >= newResults.length) {
                                            setCurrentIndex(newResults.length > 0 ? newResults.length - 1 : -1)
                                          }

                                          setHistoryVersion((prev) => prev + 1)
                                          setResultsVersion((prev) => prev + 1)
                                        } catch (err) {
                                          console.error("Failed to clear item:", err)
                                        }
                                      }}
                                      className="text-gray-400 hover:text-red-400 ml-2"
                                      aria-label={`Remove ${historyItem} from history`}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="p-3 text-center text-gray-400 text-sm">No search history</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation Hints */}
                <div className="flex text-xs text-gray-500 mt-1 overflow-hidden">
                  {currentIndex > 0 && (
                    <span className="mr-4 flex-shrink-0">
                      ←{" "}
                      <span
                        className="text-[#a099d8] truncate inline-block max-w-[120px] sm:max-w-[200px] lg:max-w-none"
                        title={resultsArray[currentIndex - 1].query}
                      >
                        {truncateQuery(resultsArray[currentIndex - 1].query, 30)}
                      </span>
                    </span>
                  )}
                  {currentIndex < resultsArray.length - 1 && (
                    <span className="flex-shrink-0">
                      <span
                        className="text-[#a099d8] truncate inline-block max-w-[120px] sm:max-w-[200px] lg:max-w-none"
                        title={resultsArray[currentIndex + 1].query}
                      >
                        {truncateQuery(resultsArray[currentIndex + 1].query, 30)}
                      </span>{" "}
                      →
                    </span>
                  )}
                </div>
              </div>

              {/* Display analysis results with news data */}
              {currentEntry.results.map((result, index) => (
                <AnalysisResults
                  key={`${index}-${resultsVersion}`}
                  result={result}
                  onSubscribeClick={() => {
                    console.log("User is already subscribed")
                  }}
                  news={currentEntry.news}
                />
              ))}

              {currentEntry.news && currentEntry.news.length > 0 && (
                <div className="news-section mt-8 mb-20 w-full">
                  <h3 className="text-xl font-semibold mb-4 text-white">Related News</h3>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                      width: "100%",
                    }}
                  >
                    {currentEntry.news.map((item, index) => (
                      <a
                        key={`${index}-${resultsVersion}`}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: "1 1 calc(50% - 8px)",
                          minWidth: "280px",
                          background: "#000000",
                          border: "1px solid rgba(255,255,255,.3)",
                          borderRadius: "0.5rem",
                          padding: "1rem",
                          color: "white",
                          transition: "all 0.3s ease",
                        }}
                        className="news-item"
                      >
                        <h4 className="font-medium text-[#a099d8] mb-2">{item.title}</h4>
                        {item.description && (
                          <p className="text-sm text-gray-300 mb-2 line-clamp-4">{item.description}</p>
                        )}
                        <div className="flex justify-between items-center text-xs text-gray-400">
                          <span className="bg-[#1B4332] text-[#95D5B2] py-1 px-2 rounded-md">{item.source}</span>
                          <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ""}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8 flex-grow flex flex-col items-center justify-center">
            <div className="no-results-container text-center py-12 max-w-3xl w-full">
              <p className="text-[#a099d8]">No results found. Try searching for something.</p>
            </div>
          </div>
        )}
      </main>

        <div className="fixed bottom-20 left-0 w-full flex justify-center px-4 z-20">
          <div className="w-full max-w-3xl floating-search-bar py-6">
            <SearchForm
              onSubscribeClick={() => {
                console.log("User is already subscribed")
              }}
              isSubscribed={isSubscribed}
              waitForResults={true}
              onSearch={handleSearch}
              isLoading={searchFormLoading}
            />
          </div>
        </div>

        <div className="news-carousel-solid">
          <NewsCarousel accounts={["business", "BitcoinMagazine", "solana", "koynlabs"]} />
        </div>
      </div>
  )
}

// Simple wrapper - this protects the entire page
export default function Analysis() {
  return (
    <ProtectedPage requiresSubscription={true}>
      <AnalysisContent />
    </ProtectedPage>
  )
}
