"use client"

import type { Route } from "./+types/analysis"
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
function truncateQuery(query: string, maxLength: number = 40): string {
  if (query.length <= maxLength) return query;
  return query.substring(0, maxLength) + '...';
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
  const [error, setError] = useState<string | null>(null)
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

  const query = searchParams.get("q")

  console.log("Analysis page - Current subscription status:", {
    isSubscribed,
    userEmail,
    user: user?.email
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

      setError(null)
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
        const accessToken = await getSecureAccessToken();
        
        if (!accessToken) {
          console.log('❌ No valid access token available');
          setError("Authentication failed. Please sign in again.");
          setIsLoading(false);
          if (setSearchLoadingCallback) {
            setSearchLoadingCallback(false);
            setSearchFormLoading(false);
          }
          return;
        }
        
        // Prepare headers with JWT authentication
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        }

        // Prepare request body - only need the question now since auth is via JWT
        const requestBody = {
          question: questionQuery,
        }

        // Log the request details for debugging
        console.log("Sending API request with secure JWT authentication:", {
          question: questionQuery,
          hasToken: true,
          tokenSource: 'memory-secure',
          userEmail: user?.email || userEmail
        })

        const response = await fetch("https://koyn.finance:3001/api/sentiment", {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`)
        }

        const data = await response.json()

        if (data.subscription_expired) {
          setError(data.message || "Your subscription has expired. Please renew to continue.")
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
          console.log("API response includes news:", data.news ? `Yes (${data.news.length} items)` : "No");
          
          // If no news data is present in the API response, create sample news items for testing
          if (!data.news || data.news.length === 0) {
            console.log("Adding sample news items for testing");
            const fallbackDate = "2024-01-01T00:00:00.000Z"; // Use consistent fallback date
            data.news = [
              {
                source: "CoinDesk",
                url: "https://www.coindesk.com/",
                title: "Bitcoin Price Analysis Shows Bullish Trend",
                description: "Recent market indicators suggest Bitcoin may continue its upward trajectory.",
                publishedAt: fallbackDate
              },
              {
                source: "Reuters",
                url: "https://www.reuters.com/",
                title: "Market Analysts Predict Bitcoin Rally",
                description: "Financial experts weigh in on cryptocurrency market movements.",
                publishedAt: fallbackDate
              }
            ];
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
        console.error("Error fetching results:", err)
        setError("An error occurred while fetching results. Please try again.")
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

  // Get the current entry to display
  const currentEntry = resultsArray[currentIndex] || null

  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] overflow-y-auto">
      <Nav />

      <canvas id="particles-canvas" className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"></canvas>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10 min-h-[calc(100vh-160px)] flex flex-col pb-32">
        {isFirstLoad && isLoading && (!currentEntry || !currentEntry.results) ? (
          <div className="loading-container flex flex-col items-center justify-center flex-grow">
            <div className="relative w-full max-w-3xl mx-auto mt-24 flex flex-col items-center z-10">
              {isLoading && (
                <div className="absolute" style={{ top: "-150px" }}>
                  <Loader />
                </div>
              )}

              <div className="w-full text-center mb-8">
                <p className="text-[#a099d8]">{query}</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex-grow flex flex-col items-center justify-center">
            <div className="text-center max-w-md">
              <p className="text-[#a099d8] mb-4">{error}</p>
            </div>
          </div>
        ) : currentEntry && currentEntry.results ? (
          <div className={isLoading ? "opacity-50 relative" : ""} key={`results-container-${resultsVersion}`}>
            <div className="results-container">
              <div className="query-container mb-6">
                <h1 className="text-xl font-medium text-white">
                  Results for: <span className="font-bold break-words" title={currentEntry.query}>{truncateQuery(currentEntry.query, 60)}</span>
                </h1>
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

      <div
        className="fixed bottom-0 left-0 w-full z-10"
        style={{
          backgroundColor: "rgb(13, 10, 33)",
          boxShadow: "0 -10px 20px rgb(13, 10, 33)",
        }}
      >
        <div className="fixed bottom-20 left-0 w-full flex justify-center px-4 z-20">
          <div className="w-full max-w-md floating-search-bar py-6">
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
    </div>
  )
}

// Simple wrapper - this protects the entire page
export default function Analysis() {
  return (
    <ProtectedPage requiresSubscription={true}>
      <AnalysisContent />
    </ProtectedPage>
  );
}
