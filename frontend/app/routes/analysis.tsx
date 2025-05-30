"use client"

import type { Route } from "./+types/analysis"
import { useEffect, useState, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router"
import AnalysisResults from "../components/AnalysisResults"
import SearchForm from "../components/SearchForm"
import SubscriptionModal from "../components/SubscriptionModal"
import { useSubscription } from "../context/SubscriptionContext"
import { Routes } from "../utils/routes"
import "../styles/news-grid.css"
import "../styles/news-carousel-solid.css"
import Nav from "../components/Nav"
import Loader from "../components/Loader"
import NewsCarousel from "../components/NewsCarousel"
import AssetChart from "../components/AssetChart"

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

export default function Analysis() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    isSubscribed,
    userEmail,
    user,
    isLoading: contextLoading,
  } = useSubscription()

  const [isLoading, setIsLoading] = useState(true)
  const [searchFormLoading, setSearchFormLoading] = useState(false)
  const [resultsArray, setResultsArray] = useState<ResultEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [isProtected, setIsProtected] = useState(!isSubscribed)
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
    user: user?.email,
    contextLoading
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

  // Debug effect to log when currentIndex changes
  useEffect(() => {
    console.log("Current index updated to:", currentIndex)
    if (resultsArray[currentIndex]) {
      console.log("Now showing results for query:", resultsArray[currentIndex].query)
    }
  }, [currentIndex, resultsArray])

  // Navigation handlers
  const handleBackClick = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)

      // Update URL to reflect the new query
      const entry = resultsArray[newIndex]
      if (entry) {
        const newUrl = createNavigationUrl(entry.query)
        window.history.pushState({}, "", newUrl)
        previousQueryRef.current = entry.query
      }
    }
  }, [currentIndex, resultsArray])

  const handleForwardClick = useCallback(() => {
    if (currentIndex < resultsArray.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)

      // Update URL to reflect the new query
      const entry = resultsArray[newIndex]
      if (entry) {
        const newUrl = createNavigationUrl(entry.query)
        window.history.pushState({}, "", newUrl)
        previousQueryRef.current = entry.query
      }
    }
  }, [currentIndex, resultsArray])

  // Helper function to create navigation URLs with subscription info
  const createNavigationUrl = useCallback(
    (navQuery: string) => {
      // Start with the basic query
      const queryParams = [`q=${encodeURIComponent(navQuery)}`]

      // Add subscription ID if available
      if (user?.email) {
        queryParams.push(`sid=${encodeURIComponent(user.email)}`)
      }

      // Add email if available
      if (userEmail) {
        queryParams.push(`email=${encodeURIComponent(userEmail)}`)
      }

      // Add status if not loading
      if (isSubscribed) {
        queryParams.push(`status=${encodeURIComponent("active")}`)
      }

      return `${Routes.ANALYSIS}?${queryParams.join("&")}`
    },
    [user?.email, userEmail, isSubscribed],
  )

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
      // Check localStorage directly to get the most current data, not the potentially stale state
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
        } else {
          console.log(`No cached results found in localStorage for "${questionQuery}" - proceeding with API call`)
        }
      }

      try {
        // First try to get subscription data from localStorage
        let email = providedUserEmail
        let status = isSubscribed ? "active" : "inactive"
        let subId = providedSubscriptionId

        // If any of these values are missing, try to get them from localStorage
        if (!email || !status || !subId) {
          try {
            // Only access localStorage on client-side
            if (typeof window !== "undefined") {
              const storedSubscription = localStorage.getItem("koyn_subscription")
              if (storedSubscription) {
                const parsedSubscription = JSON.parse(storedSubscription)

                // Use localStorage values if they exist and our current values are null/undefined
                if (!email && parsedSubscription.email) {
                  email = parsedSubscription.email
                  console.log("Using email from localStorage:", email)
                }

                if (!subId && (parsedSubscription.id || parsedSubscription.subscriptionId)) {
                  subId = parsedSubscription.id || parsedSubscription.subscriptionId
                  console.log("Using subscription ID from localStorage:", subId)
                }

                if ((!status || status === "loading") && parsedSubscription.status) {
                  status = parsedSubscription.status
                  console.log("Using subscription status from localStorage:", status)
                }
              }
            }
          } catch (e) {
            console.error("Error retrieving subscription data from localStorage:", e)
          }
        }

        // Make sure we never send "loading" as the status
        if (status === "loading") status = "inactive"

        // Log the request details for debugging
        console.log("Sending API request with payload:", {
          question: questionQuery,
          email,
          status,
          id: subId,
        })

        const response = await fetch("https://koyn.finance:3001/api/sentiment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: questionQuery,
            email,
            status,
            id: subId, // Ensure we use 'id' as the key for subscription ID
          }),
        })

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`)
        }

        const data = await response.json()

        if (data.subscription_expired) {
          setError(data.message || "Your subscription has expired. Please renew to continue.")

          if (email) {
            try {
              // Only access localStorage on client-side
              if (typeof window !== "undefined") {
                const subscription = JSON.parse(localStorage.getItem("koyn_subscription") || "{}")
                subscription.status = "inactive"
                localStorage.setItem("koyn_subscription", JSON.stringify(subscription))
              }
            } catch (e) {
              console.error("Error updating stored subscription:", e)
            }
          }

          setIsProtected(true)
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
          // This is just for development/testing purposes - remove in production
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
    [resultsArray, userEmail, isSubscribed],
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
      const newUrl = createNavigationUrl(searchQuery)
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
      // Make sure to pass the subscription data to fetchAnalysis
      console.log("Initiating search with subscription data:", {
        id: providedSubscriptionId,
        email: providedUserEmail,
      })
      fetchAnalysis(searchQuery, setSearchLoadingCallback, true, providedSubscriptionId, providedUserEmail)
    },
    [fetchAnalysis, createNavigationUrl],
  )

  // Clear a single item from history - Fix to ensure both item removal and UI update
  const clearHistoryItem = useCallback(
    (itemQuery: string) => {
      try {
        console.log("Clearing history item:", itemQuery);

        // Only access localStorage on client-side
        if (typeof window !== "undefined") {
          // Update search history in localStorage
          const historySaved = localStorage.getItem("koyn_recent_queries");
          if (historySaved) {
            let history = JSON.parse(historySaved);
            history = history.filter((q: string) => q !== itemQuery);
            localStorage.setItem("koyn_recent_queries", JSON.stringify(history));
            searchHistoryRef.current = history;
          }

          // Remove from results array in localStorage and state
          const resultsSaved = localStorage.getItem("koyn_analysis_results");
          if (resultsSaved) {
            let results = JSON.parse(resultsSaved);
            results = results.filter((entry: ResultEntry) => entry.query !== itemQuery);
            localStorage.setItem("koyn_analysis_results", JSON.stringify(results));
            setResultsArray(results);
          } else {
            // Just update the state if localStorage is empty
            const newArray = resultsArray.filter(entry => entry.query !== itemQuery);
            setResultsArray(newArray);
          }
        } else {
          // Just update the state if not on client-side
          const newArray = resultsArray.filter(entry => entry.query !== itemQuery);
          setResultsArray(newArray);
        }

        // Update current index if needed
        if (currentIndex >= resultsArray.length || (resultsArray[currentIndex]?.query === itemQuery)) {
          setCurrentIndex(resultsArray.length > 0 ? resultsArray.length - 1 : -1);
        }

        // Update UI
        setShowHistoryDropdown(false);
        setTimeout(() => setShowHistoryDropdown(true), 10);
        setHistoryVersion((v) => v + 1);
        setResultsVersion((v) => v + 1);

        // Navigate if needed
        if (query === itemQuery) {
          if (searchHistoryRef.current.length > 0) {
            const newUrl = createNavigationUrl(searchHistoryRef.current[0]);
            navigate(newUrl);
          } else {
            navigate(Routes.HOME);
          }
        }
        
        console.log("Successfully cleared history item:", itemQuery);
      } catch (error) {
        console.error("Error clearing history item:", error);
        alert("Failed to clear history item. Please try again.");
      }
    },
    [navigate, query, createNavigationUrl, resultsArray, currentIndex],
  );

  // Clear all history - Fix to ensure proper state reset
  const clearAllHistory = useCallback(() => {
    try {
      console.log("clearAllHistory function called");
      
      // Check current state before clearing
      console.log("Current history state:", {
        searchHistory: searchHistoryRef.current.length,
        resultsArray: resultsArray.length,
        currentIndex
      });

      // Only access localStorage on client-side
      if (typeof window !== "undefined") {
        // Clear history arrays in localStorage
        localStorage.removeItem("koyn_recent_queries");
        localStorage.removeItem("koyn_analysis_results");
        console.log("localStorage items removed");
      }
      
      // Update state references
      searchHistoryRef.current = [];
      setResultsArray([]);
      setCurrentIndex(-1);
      console.log("State references updated");
      
      // Update UI
      setShowHistoryDropdown(false);
      setHistoryVersion(v => {
        console.log("Updating history version from", v, "to", v + 1);
        return v + 1;
      });
      setResultsVersion(v => {
        console.log("Updating results version from", v, "to", v + 1);
        return v + 1;
      });
      
      // Navigate home immediately
      console.log("Navigating to home page");
      navigate(Routes.HOME);

      console.log("Successfully cleared all history");
    } catch (error) {
      console.error("Error clearing all history:", error);
      alert("Failed to clear history. Please try again.");
    }
  }, [navigate, resultsArray, currentIndex]);

  useEffect(() => {
    // Don't make protection decisions while context is still loading
    if (contextLoading) {
      console.log("Context loading, not setting protection state yet")
      return
    }

    console.log("Context loaded, setting protection state based on subscription:", {
      isSubscribed,
      user: user?.email
    })

    if (isSubscribed) {
      setIsProtected(false)
      return
    }

    if (!isSubscribed) {
      const pathname = window.location.pathname.toLowerCase()
      const isBillingPage = pathname.includes("/app/billing")
      const urlParams = new URLSearchParams(window.location.search)
      const hasBillingParams = urlParams.has("billing") || urlParams.has("account")

      if (!isBillingPage && !hasBillingParams) {
        console.log("User not subscribed and not on billing page, setting protected")
        setIsProtected(true)
      } else {
        console.log("User not subscribed but on billing page, allowing access")
        setIsProtected(false)
      }
    }
  }, [user, isSubscribed, contextLoading])

  // Effect to handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log("Browser navigation detected (back/forward button)")

      // Only handle popstate events if we're currently on the analysis page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/app/analysis')) {
        console.log("Not on analysis page, ignoring popstate event for:", currentPath);
        return;
      }

      // Get the current query from URL
      const urlParams = new URLSearchParams(window.location.search)
      const currentQuery = urlParams.get("q")

      if (currentQuery) {
        console.log("Loading query from URL after browser navigation:", currentQuery)

        // Update our reference
        previousQueryRef.current = currentQuery

        // Find the index of this query in our results array
        const index = findEntryIndexByQuery(resultsArray, currentQuery)
        if (index !== -1) {
          // We already have this query, just update the current index
          setCurrentIndex(index)
          setResultsVersion((prev) => prev + 1)
        } else {
          // We don't have this query yet, fetch it
          fetchAnalysis(currentQuery, undefined, false)
        }
      } else {
        // No query parameter found, and we're on analysis page, so navigate to home
        console.log("No query parameter on analysis page, navigating to home")
        navigate(Routes.HOME)
      }
    }

    // Add event listener for popstate (browser back/forward buttons)
    window.addEventListener("popstate", handlePopState)

    // Cleanup
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [fetchAnalysis, navigate, resultsArray])

  // This effect handles initial loading of query from URL
  useEffect(() => {
    if (!query || !hasInitializedFromStorage.current || !isClientMounted || contextLoading) {
      if (!query) console.log("No query parameter")
      if (!hasInitializedFromStorage.current) console.log("Storage not initialized yet")
      if (!isClientMounted) console.log("Client not mounted yet") 
      if (contextLoading) console.log("Context still loading")
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
  }, [query, isClientMounted, contextLoading, hasInitializedFromStorage.current]) // Removed resultsArray from dependencies to prevent race condition

  // Add effect for dropdown animation
  useEffect(() => {
    if (showHistoryDropdown) {
      // Small delay to allow for animation
      setTimeout(() => {
        setDropdownAnimation({
          opacity: 1,
          transform: "translateY(0)",
        })
      }, 10)
    } else {
      setDropdownAnimation({
        opacity: 0,
        transform: "translateY(-10px)",
      })
    }
  }, [showHistoryDropdown])

  // Get the current entry to display
  const currentEntry = resultsArray[currentIndex] || null

  // Determine if back/forward navigation is possible
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < resultsArray.length - 1 && currentIndex !== -1

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHistoryDropdown) {
        const target = event.target as HTMLElement;
        const historyButton = target.closest('[data-history-button="true"]');
        const isHistoryButtonClick = historyButton !== null;
        const isHistoryDropdownClick = target.closest('.history-dropdown') !== null;
        const isClearAllButton = target.closest('.clear-all-button') !== null;

        // Don't close if clicking on history button, inside dropdown, or on clear button
        if (!isHistoryButtonClick && !isHistoryDropdownClick && !isClearAllButton) {
          setShowHistoryDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistoryDropdown]);

  useEffect(() => {
    if (currentEntry && currentEntry.news && currentEntry.news.length > 0) {
      const setupTooltips = () => {
        const newsSourceElements = document.querySelectorAll(".news-source")

        newsSourceElements.forEach((element) => {
          element.addEventListener("mouseenter", () => {
            const tooltip = element.querySelector(".tooltip-content")
            if (tooltip) {
              const rect = tooltip.getBoundingClientRect()

              if (rect.right > window.innerWidth) {
                tooltip.classList.add("right-0")
                tooltip.classList.remove("left-0")
              }

              if (rect.left < 0) {
                tooltip.classList.add("left-0")
                tooltip.classList.remove("right-0")
              }
            }
          })
        })
      }

      setTimeout(setupTooltips, 100)
    }
  }, [currentEntry])

  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | null = null
    const floatingSearchBar = document.querySelector(".floating-search-bar")

    if (!floatingSearchBar) return

    const handleScroll = () => {
      floatingSearchBar.classList.add("scrolling")

      if (scrollTimer) clearTimeout(scrollTimer)

      scrollTimer = setTimeout(() => {
        floatingSearchBar.classList.remove("scrolling")
      }, 500)
    }

    window.addEventListener("scroll", handleScroll)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (scrollTimer) clearTimeout(scrollTimer)
    }
  }, [])

  useEffect(() => {
    const canvas = document.getElementById("particles-canvas") as HTMLCanvasElement
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const particles: any[] = []

        class Particle {
          x: number;
          y: number;
          size: number;
          speedX: number;
          speedY: number;
          color: string;
          
          constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            
            // Star-like color palette
            const colors = [
              'rgba(64, 47, 181, 0.5)',  // Purple
              'rgba(207, 48, 170, 0.5)',  // Pink
              'rgba(160, 153, 216, 0.5)', // Light purple
              'rgba(223, 162, 218, 0.5)'  // Light pink
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
          }

          update() {
            this.x += this.speedX
            this.y += this.speedY

            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1
          }

          draw() {
            if (ctx) {
              ctx.beginPath()
              ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
              ctx.fillStyle = this.color
              ctx.globalAlpha = 0.2
              ctx.fill()
            }
          }
        }

        function createParticles() {
          for (let i = 0; i < 50; i++) {
            particles.push(new Particle())
          }
        }

        function animateParticles() {
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            for (let i = 0; i < particles.length; i++) {
              particles[i].update()
              particles[i].draw()
            }
          }

          requestAnimationFrame(animateParticles)
        }

        createParticles()
        animateParticles()

        window.addEventListener("resize", () => {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        })
      }
    }
  }, [])

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
        ) : isProtected ? (
          <div className="flex-grow flex flex-col items-center justify-center">
            <div className="text-center max-w-md">
              <h3 className="text-xl font-semibold text-white mb-2">Subscription Required</h3>
              <p className="text-[#a099d8] mb-4">{error || "You need an active subscription to view this content."}</p>
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {/* Navigation Controls */}
                    <div className="flex items-center mr-4">
                      {/* Back Button */}
                      {canGoBack ? (
                        <button
                          onClick={handleBackClick}
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
                      {canGoForward ? (
                        <button
                          onClick={handleForwardClick}
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
                      Results for: <span className="font-bold break-words" title={currentEntry.query}>{truncateQuery(currentEntry.query, 60)}</span>
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
                        className="fixed right-auto mt-2 w-64 bg-[rgb(13,10,33)] rounded-md shadow-lg z-[9999] transition-all duration-200 ease-out history-dropdown"
                        style={{
                          top: "auto",
                          position: "absolute",
                          right: 0,
                          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
                          ...dropdownAnimation,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-[rgba(64,47,181,0.3)] flex justify-between items-center">
                          <span className="text-white text-sm font-medium">Search History</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("Clear All button clicked");
                              clearAllHistory();
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
                                        const newUrl = createNavigationUrl(historyItem)
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
                                          clearHistoryItem(historyItem)
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
                  {canGoBack && resultsArray[currentIndex - 1] && (
                    <span className="mr-4 flex-shrink-0">
                      ← <span className="text-[#a099d8] truncate inline-block max-w-[120px] sm:max-w-[200px] lg:max-w-none" title={resultsArray[currentIndex - 1].query}>{truncateQuery(resultsArray[currentIndex - 1].query, 30)}</span>
                    </span>
                  )}
                  {canGoForward && resultsArray[currentIndex + 1] && (
                    <span className="flex-shrink-0">
                      <span className="text-[#a099d8] truncate inline-block max-w-[120px] sm:max-w-[200px] lg:max-w-none" title={resultsArray[currentIndex + 1].query}>{truncateQuery(resultsArray[currentIndex + 1].query, 30)}</span> →
                    </span>
                  )}
                </div>
              </div>

              {/* Display analysis results with news data */}
              {/* Display analysis results with news data */}
              {currentEntry.results.map((result, index) => (
                <AnalysisResults
                  key={`${index}-${resultsVersion}`}
                  result={result}
                  onSubscribeClick={() => {
                    console.log("Analysis results triggering subscription modal")
                    setTimeout(() => {
                      setIsProtected(true)
                    }, 100)
                  }}
                  news={currentEntry.news}
                />
              ))}
              
              {/* Debug info about news data */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="mt-4 p-2 bg-black/20 text-xs text-gray-400 rounded">
                  <p>Debug: News items in current entry: {currentEntry.news ? currentEntry.news.length : 0}</p>
                </div>
              )}
              
              {/* Debug info about news data */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="mt-4 p-2 bg-black/20 text-xs text-gray-400 rounded">
                  <p>Debug: News items in current entry: {currentEntry.news ? currentEntry.news.length : 0}</p>
                </div>
              )}
            </div>

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
                console.log("Floating search bar triggering subscription modal")
                setTimeout(() => {
                  setIsProtected(true)
                }, 100)
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

      <SubscriptionModal
        isOpen={!isSubscribed}
        onClose={() => {
          setIsProtected(true)
        }}
        onSuccess={() => {
          setIsProtected(true)
        }}
      />
    </div>
  )
}
