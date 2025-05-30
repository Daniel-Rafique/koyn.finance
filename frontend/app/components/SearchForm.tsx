"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { Routes } from "../utils/routes"
import "../styles/glowing-input.css"

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
}

export default function SearchForm({
  onSubscribeClick,
  isSubscribed = false,
  waitForResults = false,
  onSearch,
  isLoading: parentIsLoading,
}: SearchFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    "What's the forecast for Gold prices?",
    "How will interest rates affect the market?",
    "Is it a good time to buy tech stocks?",
    "What's the analysis for NVIDIA stock?",
    "Explain the recent trends in oil prices",
    "What's driving the Dow Jones today?",
    "Is real estate a good investment now?",
    "Compare Tesla and Ford stock performance",
    "How are bank stocks performing?",
    "Forecast Ethereum price movement",
  ]

  // Rotate placeholder text every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % placeholders.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Check subscription status immediately when input is clicked/focused
  const handleInputFocus = () => {
    // Start with the prop value, but then double-check localStorage too
    let hasActiveSubscription = isSubscribed

    try {
      const storedSubscription = localStorage.getItem("koyn_subscription")
      if (storedSubscription) {
        const parsedSubscription = JSON.parse(storedSubscription)
        // First check explicit status field - if it's 'active', respect that
        if (parsedSubscription.status === "active") {
          hasActiveSubscription = true
        }
        // If status is explicitly set to inactive
        else if (parsedSubscription.status === "inactive") {
          console.log("Inactive subscription detected from localStorage on input focus")
          hasActiveSubscription = false
        }
        // If no explicit status, check renewal/expiration date
        else if (parsedSubscription.renewalDate || parsedSubscription.expiresAt) {
          const expiryDate = new Date(parsedSubscription.renewalDate || parsedSubscription.expiresAt)
          const now = new Date()
          hasActiveSubscription = expiryDate > now
        }
      }
    } catch (storageErr) {
      console.error("Error accessing localStorage:", storageErr)
    }

    // Log current subscription status for debugging
    console.log("Current subscription status check result:", {
      isSubscribedProp: isSubscribed,
      hasActiveSubscription,
    })

    // If the user is not subscribed (either from prop or localStorage check),
    // show subscription modal immediately
    if (!hasActiveSubscription && onSubscribeClick) {
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
    // Check subscription status
    let shouldCheckSubscription = true

    // Get subscription data including ID from localStorage
    let subscriptionId = null
    let userEmail = null
    let subscriptionStatus = null

    try {
      const storedSubscription = localStorage.getItem("koyn_subscription")
      if (storedSubscription) {
        const parsedSubscription = JSON.parse(storedSubscription)
        subscriptionId = parsedSubscription.id || parsedSubscription.subscriptionId || null
        userEmail = parsedSubscription.email || null
        subscriptionStatus = parsedSubscription.status || null
        console.log("Retrieved subscription data from localStorage:", {
          id: subscriptionId,
          email: userEmail,
          status: subscriptionStatus,
        })
      }
    } catch (err) {
      console.error("Error retrieving subscription data from localStorage:", err)
    }

    // If isSubscribed is explicitly true, we can trust that
    if (isSubscribed === true) {
      shouldCheckSubscription = false
    }

    // Only show modal if we're sure that the subscription is inactive
    if (isSubscribed === false && onSubscribeClick) {
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
      // Only double-check subscription if necessary
      let hasActiveSubscription = isSubscribed // Start with the prop value

      if (shouldCheckSubscription) {
        try {
          const storedSubscription = localStorage.getItem("koyn_subscription")
          if (storedSubscription) {
            const parsedSubscription = JSON.parse(storedSubscription)

            // First check explicit status field
            if (parsedSubscription.status === "active") {
              hasActiveSubscription = true
            }
            // If status is explicitly set to inactive
            else if (parsedSubscription.status === "inactive") {
              console.log("Inactive subscription detected from localStorage")
              hasActiveSubscription = false
            }
            // If status not set, check expiration date
            else if (parsedSubscription.renewalDate || parsedSubscription.expiresAt) {
              const expiryDate = new Date(parsedSubscription.renewalDate || parsedSubscription.expiresAt)
              const now = new Date()
              hasActiveSubscription = expiryDate > now
              console.log("Subscription expiry check:", {
                expiryDate,
                now,
                isActive: expiryDate > now,
              })
            }
          }
        } catch (storageErr) {
          console.error("Error accessing localStorage:", storageErr)
        }
      }

      // If we've determined the subscription is not active, show modal
      if (!hasActiveSubscription && onSubscribeClick) {
        console.log("No active subscription detected, showing modal")
        setIsLoading(false)
        onSubscribeClick()
        return
      }

      const encodedQuery = encodeURIComponent(question)

      // Check if we're already on the analysis page
      const currentPath = window.location.pathname
      const isAnalysisPage = currentPath === Routes.ANALYSIS || currentPath.startsWith(`${Routes.ANALYSIS}/`)

      if (isAnalysisPage && onSearch) {
        console.log("User initiated search from form:", question)
        console.log("Passing subscription ID to onSearch:", subscriptionId)
        console.log("Passing user email to onSearch:", userEmail)

        // If we're on the analysis page and have an onSearch prop, use it
        // This will trigger the parent component to handle the search and update the cache
        // The parent component will mark this as a user-initiated search
        // Pass the subscription ID and email to the onSearch function
        onSearch(question, setIsLoading, subscriptionId, userEmail)
        console.log("Passing subscription data to parent:", {
          id: subscriptionId,
          email: userEmail,
          status: subscriptionStatus,
        })

        // Update URL without causing a page reload - let the parent component handle this
      } else {
        // If we're not on the analysis page or don't have onSearch, we need to 
        // save information before navigating
        
        try {
          // First, make sure we preserve existing results
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
        } catch (err) {
          console.error("Error preparing search data:", err);
        }
        
        // Navigate to the analysis page with all parameters
        const queryParams = [`q=${encodedQuery}`];

        // Add subscription parameters to URL for the API to use
        if (subscriptionId) {
          queryParams.push(`sid=${encodeURIComponent(subscriptionId)}`);
        }
        if (userEmail) {
          queryParams.push(`email=${encodeURIComponent(userEmail)}`);
        }
        // Add subscription status if we can determine it
        try {
          const storedSub = localStorage.getItem("koyn_subscription");
          if (storedSub) {
            const parsedSub = JSON.parse(storedSub);
            if (parsedSub.status) {
              queryParams.push(`status=${encodeURIComponent(parsedSub.status)}`);
            }
          }
        } catch (err) {
          console.error("Error adding subscription status to URL:", err);
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
              <input
                ref={inputRef}
                type="text"
                name="question"
                autoFocus
                placeholder={placeholders[placeholderIndex]}
                dir="auto"
                className="glowing-input input"
                style={{
                  paddingRight: "50px",
                  background: "rgb(0, 0, 0)",
                  color: "white",
                }}
                onKeyDown={handleKeyPress}
                onFocus={handleInputFocus}
                onClick={handleInputFocus}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-form-type="other"
              />
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