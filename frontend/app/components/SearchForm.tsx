"use client"

import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { Routes } from "../utils/routes"
import { useSubscription } from "../context/AuthProvider"

interface SearchFormProps {
  onResultsChange?: (hasResults: boolean) => void
  onSubscribeClick?: () => void
  isSubscribed?: boolean
  waitForResults?: boolean
  onSearch?: (
    query: string,
    setLoadingCallback: (loading: boolean) => void,
    subscriptionId?: string | null,
    userEmail?: string | null,
  ) => void
  isLoading?: boolean
  isRateLimited?: boolean
}

export default function SearchForm({
  onSubscribeClick,
  isSubscribed: propIsSubscribed,
  waitForResults = false,
  onSearch,
  isLoading: parentIsLoading,
  isRateLimited,
}: SearchFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use secure subscription context
  const { isSubscribed: contextIsSubscribed, user, userEmail, isLoading: contextLoading } = useSubscription()

  // Use context subscription status if available, otherwise fall back to prop
  const isSubscribed = contextIsSubscribed ?? propIsSubscribed ?? false

  console.log("SearchForm - Current subscription status:", {
    isSubscribed: contextIsSubscribed,
    userEmail,
    user: user?.email,
    contextLoading
  })

  // Sync loading state with parent component
  useEffect(() => {
    if (parentIsLoading !== undefined) {
      setIsLoading(parentIsLoading)
    }
  }, [parentIsLoading])

  // Reset loading state when component unmounts (prevents stuck state)
  useEffect(() => {
    return () => {
      setIsLoading(false)
    }
  }, [])

  const placeholders = [
    "What's the outlook for AAPL stock?",
    "How is Bitcoin performing today?",
    "Should I invest in Tesla right now?",
    "What's the sentiment on Amazon stock?",
    "Analyze S&P 500 market conditions",
    "What's the forecast for XAUUSD prices?",
    "What's the analysis for NVIDIA stock?",
    "Explain the recent trends in oil prices",
    "What's driving the Dow Jones today?",
    "Compare Tesla and Ford stock performance",
    "Forecast Ethereum price movement",
  ]

  // Rotate placeholder text every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Check subscription status when input is focused
  const handleInputFocus = () => {
    console.log("Input focused - subscription check:", {
      contextLoading,
      isSubscribed,
      userEmail,
      user: user?.email
    })

    // Don't make subscription decisions while context is still loading
    if (contextLoading) {
      console.log("Context still loading, not checking subscription yet")
      return
    }

    // If the user is not subscribed, show subscription modal
    if (!isSubscribed && onSubscribeClick) {
      console.log("No active subscription, showing modal on input focus")
      // Use setTimeout to ensure reliable modal opening
      setTimeout(() => {
        onSubscribeClick()
      }, 100)
      // Blur the input to prevent keyboard from staying open on mobile
      if (inputRef.current) {
        inputRef.current.blur()
      }
    }
  }

  // Handle key press to submit on Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch()
    }
  }

  // Handle the search action directly
  const handleSearch = async () => {
    console.log("Search initiated - subscription check:", {
      contextLoading,
      isSubscribed,
      userEmail,
      user: user?.email
    })

    // Don't make subscription decisions while context is still loading
    if (contextLoading) {
      console.log("Context still loading, cannot proceed with search yet")
      return
    }

    // Check subscription status using secure context
    if (!isSubscribed && onSubscribeClick) {
      console.log("User not subscribed, showing modal on search button click")
      setTimeout(() => {
        onSubscribeClick()
      }, 100)
      return
    }

    if (!inputRef.current) return

    const question = inputRef.current.value

    if (!question || question.trim() === "") {
      return
    }

    // Set loading state
    setIsLoading(true)
    setSearchError(null)

    try {
      console.log("Starting search with secure authentication:", {
        isSubscribed,
        userEmail,
        plan: user?.plan
      })

      // Use the secure subscription data
      const subscriptionId = user?.email ? `secure-user-${Date.now()}` : null // Generate a session-based ID
      const searchUserEmail = user?.email || userEmail

      const encodedQuery = encodeURIComponent(question)

      // Check if we're already on the analysis page
      const currentPath = window.location.pathname
      const isAnalysisPage = currentPath === Routes.ANALYSIS || currentPath.startsWith(`${Routes.ANALYSIS}/`)

      if (isAnalysisPage && onSearch) {
        console.log("User initiated search from form:", question)
        console.log("Passing subscription ID to onSearch:", subscriptionId)
        console.log("Passing user email to onSearch:", searchUserEmail)

        // If we're on the analysis page and have an onSearch prop, use it
        // This will trigger the parent component to handle the search and update the cache
        // The parent component will mark this as a user-initiated search
        // Pass the subscription ID and email to the onSearch function
        onSearch(question, setIsLoading, subscriptionId, searchUserEmail)
        console.log("Passing subscription data to parent:", {
          id: subscriptionId,
          email: searchUserEmail,
        })

        // Update URL without causing a page reload - let the parent component handle this
      } else {
        // If we're not on the analysis page or don't have onSearch, we need to 
        // save information before navigating
        
        try {
          // First, make sure we preserve existing results - only access localStorage on client-side
          if (typeof window !== "undefined") {
            const existingResults = localStorage.getItem("koyn_analysis_results");
            
            if (existingResults) {
              // We have existing results, don't erase them
              // Just set a marker to indicate this is a new search from home page
              localStorage.setItem("koyn_new_search_query", question);
            } else {
              // No existing results, create a new results array
              localStorage.setItem("koyn_analysis_results", JSON.stringify([]));
            }
            
            // Add the query to recent queries if not already there
            const recentQueries = JSON.parse(localStorage.getItem("koyn_recent_queries") || "[]");
            if (!recentQueries.includes(question)) {
              const updatedQueries = [
                question,
                ...recentQueries.filter((q: string) => q !== question).slice(0, 9),
              ];
              localStorage.setItem("koyn_recent_queries", JSON.stringify(updatedQueries));
            }
          }
        } catch (err) {
          console.error("Error preparing search data:", err);
        }
        
        // Navigate to the analysis page with all parameters
        const queryParams = [`q=${encodedQuery}`];

        // Add subscription parameters to URL for the API to use
        if (subscriptionId) {
          queryParams.push(`sid=${encodeURIComponent(subscriptionId)}`);
        }
        if (searchUserEmail) {
          queryParams.push(`email=${encodeURIComponent(searchUserEmail)}`);
        }

        // Navigate to the analysis page with all parameters
        window.location.href = `${Routes.ANALYSIS}?${queryParams.join("&")}`;
      }
    } catch (err) {
      console.error("Error in search form:", err)
      setSearchError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 max-w-4xl flex flex-col justify-center">
      {/* Search Container */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media (max-width: 640px) {
            .search-button svg {
              filter: brightness(1.5) contrast(1.2);
            }
            .search-button svg path {
              stroke-width: 2;
            }
          }
        `
      }} />
      <div
        className="enhanced-search-container flex flex-col justify-center"
        id="searchContainer"
        style={{ isolation: "isolate" }}
      >
        <div className="enhanced-search-form">
          <div
            className="glowing-input-container"
            id="poda"
            style={{ isolation: "isolate" }}
            onMouseEnter={(e) => {
              const glow = e.currentTarget.querySelector(".glow")
              if (glow) glow.classList.add("active")
            }}
            onMouseLeave={(e) => {
              const glow = e.currentTarget.querySelector(".glow")
              if (glow) glow.classList.remove("active")
            }}
          >
            <div className="glow"></div>
            <div className="darkBorderBg"></div>
            <div className="darkBorderBg"></div>
            <div className="darkBorderBg"></div>
            <div className="white"></div>
            <div className="border"></div>

            <div className="input-main" id="main">
              <div className="relative group">
                <input
                  ref={inputRef}
                  type="text"
                  name="question"
                  autoFocus
                  placeholder={isRateLimited ? "Daily search limit reached. Try again tomorrow!" : placeholders[placeholderIndex]}
                  dir="auto"
                  className="glowing-input input"
                  style={{
                    paddingRight: "50px",
                    background: "rgb(0, 0, 0)",
                    color: "white",
                    opacity: isRateLimited ? 0.5 : 1,
                    cursor: isRateLimited ? "not-allowed" : "text"
                  }}
                  onKeyDown={handleKeyPress}
                  onFocus={handleInputFocus}
                  onClick={handleInputFocus}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  data-form-type="other"
                  disabled={isRateLimited}
                  maxLength={140}
                />

                {/* Tooltip for rate limited state - shows on input hover */}
                {isRateLimited && (
                  <div 
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[rgba(0,0,0,0.9)] text-white text-xs rounded border border-[rgba(255,255,255,0.3)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ 
                      zIndex: 999999,
                      position: "absolute",
                      backgroundColor: "rgba(0,0,0,0.95)",
                      backdropFilter: "blur(4px)"
                    }}
                  >
                    Daily search limit reached. Try again tomorrow!
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-[rgba(0,0,0,0.9)]"></div>
                  </div>
                )}
              </div>
              <div className="input-mask" id="input-mask"></div>
              <div className="pink-mask" id="pink-mask"></div>
              <div className="button-border filterBorder"></div>
              <button
                type="button"
                className="search-button text-white"
                id="filter-icon"
                disabled={isLoading}
                onClick={handleSearch}
                style={{
                  background: "linear-gradient(180deg, #000000, black, #111111)",
                  color: "white"
                }}
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12.8281 1C12.8281 2.10747 11.7632 3.17235 10.6558 3.17235C11.7632 3.17235 12.8281 4.23724 12.8281 5.34471C12.8281 4.23724 13.893 3.17235 15.0005 3.17235C13.893 3.17235 12.8281 2.10747 12.8281 1Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                    <path
                      d="M13 12C13 12.5098 12.5098 13 12 13C12.5098 13 13 13.4902 13 14C13 13.4902 13.4902 13 14 13C13.4902 13 13 12.5098 13 12Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                    <path
                      d="M5.10285 3.89648C5.10285 5.98837 3.0914 7.99982 0.999512 7.99982C3.0914 7.99982 5.10285 10.0113 5.10285 12.1032C5.10285 10.0113 7.1143 7.99982 9.20619 7.99982C7.1143 7.99982 5.10285 5.98837 5.10285 3.89648Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {searchError && <div className="mt-2 text-red-300 text-sm text-center">{searchError}</div>}
      </div>
    </div>
  )
}