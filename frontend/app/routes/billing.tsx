"use client"

import type React from "react"
import type { Route } from "./+types/billing"

import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "../context/AuthProvider"
import ProtectedPage from "../components/ProtectedPage"
import Nav from "../components/Nav"
import Footer from "../components/Footer"
import "../styles/news-carousel-solid.css"
import { HelioCheckout } from "@heliofi/checkout-react"
// Import the specific types from the Helio library
import type { HelioEmbedConfig } from "@heliofi/checkout-react"

// Meta function for React Router to set page title and description
export const meta: Route.MetaFunction = () => {
  return [
    { title: "Billing & Subscription - koyn.finance" },
    { name: "description", content: "Manage your koyn.finance subscription, view billing history, and update your payment information for AI-powered financial market insights." },
    { name: "robots", content: "noindex, nofollow" }, // Don't index billing pages
  ];
};

interface Subscription {
  id: string
  email: string
  status: string
  startedAt: string
  renewalDate: string
  transactionId?: string
  plan: string
  paymentMethod: string
  amount?: number
  currency?: string
  renewedAt?: string
  transactionDetails?: {
    id: string
    paylinkId?: string
    quantity?: number
    createdAt?: string
    paymentType?: string
    meta?: {
      amount?: string
      customerDetails?: {
        email?: string
        country?: string
        fullName?: string
      }
      transactionStatus?: string
      transactionSignature?: string
      totalAmount?: string
      currency?: {
        id?: string
      }
    }
  }
}

// Extract the core billing content into a separate component
function BillingContent() {
  const navigate = useNavigate()
  const { isSubscribed, userEmail, user, isLoading } = useAuth()
  const [subscriptionDetails, setSubscriptionDetails] = useState<Subscription | null>(null)
  const [isBillingLoading, setIsBillingLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Flag to prevent subscription modal from opening on this page
  const hasInitialized = useRef(false)
  // State to track if user is cancelling their subscription
  const [isCancelling, setIsCancelling] = useState(false)
  // Track cancel error state
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Client-side rendering state - starts as false to match server
  const [isClientSide, setIsClientSide] = useState(false)

  console.log("Billing page render - state:", {
    isSubscribed,
    userEmail,
    user: user?.email,
    isClientSide,
    isLoading,
    isBillingLoading
  })

  // Safe way to detect client-side rendering
  useEffect(() => {
    setIsClientSide(true)
  }, [])

  // Cancel any subscription modal that might appear - only on client
  useEffect(() => {
    // Only run on client-side
    if (!isClientSide || typeof window === "undefined") return

    try {
      // Set multiple flags to ensure modal doesn't appear
      sessionStorage.setItem("on_billing_page", "true")
      sessionStorage.setItem("suppress_subscription_modal", "true")
      
      // Also set a flag in localStorage for more persistence
      localStorage.setItem("on_billing_page", "true")

      // Clean up when navigating away
      return () => {
        try {
          sessionStorage.removeItem("on_billing_page")
          sessionStorage.removeItem("suppress_subscription_modal")
          localStorage.removeItem("on_billing_page")
        } catch (err) {
          console.error("Error removing session storage:", err)
        }
      }
    } catch (err) {
      console.error("Error setting session storage:", err)
    }
  }, [isClientSide])

  useEffect(() => {
    const initializeBilling = async () => {
      // IMPORTANT: Wait for authentication initialization to complete
      // This prevents the SubscriptionModal from briefly appearing
      if (isLoading) {
        console.log("Waiting for authentication initialization to complete...")
        return
      }

      console.log("AuthProvider loaded - subscription status:", isSubscribed, "userEmail:", userEmail)

      // Only proceed if user is authenticated with a valid email
      if (isSubscribed && userEmail) {
        try {
          await fetchSubscriptionDetails(userEmail)
        } catch (error) {
          console.error("Error fetching billing details for authenticated user:", error)
          setError("Failed to load your billing information")
          setIsBillingLoading(false)
        }
      } 
      // Handle authenticated user without subscription
      else if (userEmail && !isSubscribed) {
        console.log("User authenticated but not subscribed:", userEmail)
        const fallbackDate = "2024-01-01T00:00:00.000Z"
        setSubscriptionDetails({
          id: "inactive-user",
          email: userEmail,
          status: "inactive",
          startedAt: fallbackDate,
          renewalDate: fallbackDate,
          transactionId: "none",
          plan: "none",
          paymentMethod: "none",
        })
        setError("No active subscription found")
        setIsBillingLoading(false)
      } 
      // User not authenticated - should not happen on billing page
      else {
        console.log("User not authenticated - billing page access error")
        setIsBillingLoading(false)
        setError("Please log in to access your billing information")
      }
    }

    try {
      initializeBilling()
    } catch (error) {
      console.error("Error in billing initialization:", error)
      setError("Failed to initialize billing page")
      setIsBillingLoading(false)
    }
  }, [isLoading, isSubscribed, userEmail, user])

  const fetchSubscriptionDetails = async (email: string) => {
    setIsBillingLoading(true)
    setError(null)

    try {
      // Always fetch detailed subscription data from the server first
      console.log("Fetching detailed billing information for:", email)
      const accessToken = isClientSide && typeof window !== "undefined" ? localStorage.getItem("koyn_access_token") : null

      const headers: Record<string, string> = {
        Accept: "application/json",
      }

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
      }

      const response = await fetch(`/api/subscription/${encodeURIComponent(email)}`, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Detailed billing data from server:", data)

        if (data.active && data.subscription) {
          // Use detailed data from server - this has the real dates!
          console.log("Using detailed billing data from server")
          setSubscriptionDetails(data.subscription)
          setIsBillingLoading(false)
          return
        }
      } else {
        console.warn(`API call failed with ${response.status}`)
      }

      // Fallback: Only use context data if API completely fails
      if (user && typeof user === "object" && user.isActive) {
        console.log("API failed, using verified subscription from context")
        const fallbackDate = "2024-01-01T00:00:00.000Z" // Use consistent fallback date only as last resort
        const contextSubscription: Subscription = {
          id: `user-${user.email}`,
          email: user.email,
          status: "active",
          startedAt: fallbackDate,
          renewalDate: fallbackDate,
          plan: user.plan || "unknown",
          paymentMethod: "crypto",
        }
        setSubscriptionDetails(contextSubscription)
        setIsBillingLoading(false)
        return
      }

      // If we get here, no subscription found
      console.log("No subscription data available from server or context")
      setError("No active subscription found")
      setIsBillingLoading(false)

    } catch (err) {
      console.error("Error fetching detailed billing data:", err)
      
      // Last resort fallback to context data
      if (user && typeof user === "object" && user.isActive) {
        console.log("Network error, using verified context data as fallback")
        const fallbackDate = "2024-01-01T00:00:00.000Z"
        setSubscriptionDetails({
          id: "context-verified",
          email: email,
          status: "active",
          startedAt: fallbackDate,
          renewalDate: fallbackDate,
          transactionId: "verified",
          plan: "verified",
          paymentMethod: "verified",
        })
      } else {
        setError("Failed to load subscription information")
      }
      setIsBillingLoading(false)
    }
  }

  const handleRenewSubscription = (paylinkIdOrEvent: string | React.MouseEvent) => {
    console.log("Redirecting to direct checkout page")

    // Default paylink ID from the subscription data
    const defaultPaylinkId = "68229ffa2c8760f1eb3d19d7"
    let paylinkId = defaultPaylinkId

    // If the parameter is a string (paylink ID), use it directly
    if (typeof paylinkIdOrEvent === "string") {
      paylinkId = paylinkIdOrEvent
    }
    // Otherwise, try to extract paylinkId from subscription details if available
    else if (subscriptionDetails?.transactionDetails?.paylinkId) {
      paylinkId = subscriptionDetails.transactionDetails.paylinkId
    }

    // Navigate to the Helio payment link with the appropriate paylinkId
    window.open(`https://app.hel.io/pay/${paylinkId}`, "_blank")
  }

  const handleUpgradeDowngrade = () => {
    // Upgrade/downgrade functionality would go here
    console.log("Upgrade/downgrade feature not yet implemented")
    // For now, just show a message
    alert("Upgrade/downgrade functionality is not yet available. Please contact support for assistance.")
  }

  // Handle back button click - navigate to home page
  const handleBackToHome = () => {
    try {
      console.log('Navigating back to home page using direct browser navigation');
      // Use direct browser navigation instead of React Router
      window.location.href = '/';
    } catch (error) {
      console.error('Error navigating to home:', error);
      
      // Try to click the fallback link
      try {
        console.log('Trying fallback link navigation');
        const fallbackLink = document.getElementById('home-fallback-link') as HTMLAnchorElement;
        if (fallbackLink) {
          fallbackLink.click();
        } else {
          // Last resort
          window.location.replace('/');
        }
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
        window.location.replace('/');
      }
    }
  };

  // Format currency amount
  const formatAmount = (amount?: number, currency = "USDC") => {
    if (amount === undefined) return "N/A"
    return `${amount.toFixed(2)} ${currency}`
  }

  // Replace the formatDate function with this
  const formatDate = (dateString: string) => {
    // Don't format dates during server-side rendering to avoid hydration mismatches
    if (!isClientSide) {
      return dateString
    }
    
    try {
      // Use a fixed format that will be consistent between server and client
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      return `${year}-${month}-${day}`
    } catch (e) {
      return "Invalid date"
    }
  }

  // Get human-readable plan name
  const getPlanName = (planCode: string) => {
    const planNames = {
      monthly: "Monthly Plan",
      quarterly: "3-Month Plan",
      lifetime: "Lifetime Plan",
      "3month": "3-Month Plan",
    }
    return planNames[planCode as keyof typeof planNames] || planCode
  }

  // Determine subscription status class for styling
  const getStatusClass = (status: string) => {
    return status === "active" ? "text-white" : "text-red-500"
  }

  // Add a function to get transaction status
  const getTransactionStatus = (details?: Subscription["transactionDetails"]) => {
    if (!details || !details.meta) {
      return "Completed" // Default
    }

    return details.meta.transactionStatus || "Completed"
  }

  // Function to check if renewal date has passed
  const hasRenewalDatePassed = (renewalDate: string): boolean => {
    try {
      const renewal = new Date(renewalDate)
      const today = new Date()
      return renewal < today
    } catch (error) {
      console.error("Error parsing renewal date:", error)
      return false
    }
  }

  // Function to calculate time remaining in subscription
  const getTimeRemaining = (renewalDate: string): string => {
    try {
      const renewal = new Date(renewalDate)
      const today = new Date()

      if (renewal < today) {
        return "Subscription has expired"
      }

      const diffTime = Math.abs(renewal.getTime() - today.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays > 30) {
        const diffMonths = Math.floor(diffDays / 30)
        return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} remaining`
      } else if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} remaining`
      } else {
        return "Less than a day remaining"
      }
    } catch (error) {
      console.error("Error calculating time remaining:", error)
      return "Unknown"
    }
  }

  // Render expired subscription UI
  const renderExpiredSubscription = () => {
    // Determine which email to display
    const displayEmail = subscriptionDetails?.email || userEmail

    // Default paylink ID
    const defaultPaylinkId = "68229ffa2c8760f1eb3d19d7"
    // Get paylink ID from subscription details if available
    const paylinkId = subscriptionDetails?.transactionDetails?.paylinkId || defaultPaylinkId

    // Helio config objects for different plans - using dynamic paylink IDs
    const monthlyPlanConfig: HelioEmbedConfig = {
      paylinkId: subscriptionDetails?.transactionDetails?.paylinkId || "68229fd19009f0c6c3ff67f2", // Fallback for monthly
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    }

    const quarterlyPlanConfig: HelioEmbedConfig = {
      paylinkId: subscriptionDetails?.transactionDetails?.paylinkId || "68229fbd9483a433d5884b7c", // Fallback for quarterly
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    }

    const lifetimePlanConfig: HelioEmbedConfig = {
      paylinkId: subscriptionDetails?.transactionDetails?.paylinkId || "68229ffa2c8760f1eb3d19d7", // Fallback for lifetime
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    }

    // Function to handle subscription success
    const handleSubscriptionSuccess = (event: any) => {
      console.log("Subscription payment successful:", event)
      if (typeof window !== "undefined") {
        // Force reload the page to reflect the new subscription status
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    }

    return (
      <div className="space-y-8">
        <h2 className="text-xl font-semibold text-white mb-4">Subscription Status</h2>
        <div className="text-center py-4 mb-8">
          <div className="mb-4">
            <span className="text-red-400 text-xl">No active subscription</span>
            <p className="text-[#ffffff] mt-2">You need an active subscription to use premium features.</p>
          </div>
        </div>

        {displayEmail && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
            <div className="mb-8">
              <span className="text-[#ffffff] block">Email</span>
              <span className="text-white font-medium">{displayEmail}</span>
            </div>
          </>
        )}

        <h2 className="text-xl font-semibold text-white mb-4">Choose Your Plan</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginBottom: "2rem",
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto 2rem auto",
            justifyContent: "space-between",
          }}
          className="subscription-plans-container"
        >
          {/* Monthly Plan */}
          <div 
            style={{ 
              flex: "1 1 350px",
              minWidth: "350px",
              maxWidth: "380px",
              position: "relative", 
              padding: "1.5rem", 
              borderRadius: "0.5rem",
              border: "1px solid rgb(31, 41, 55)",
              background: "rgba(7, 4, 23, 0.8)"
            }}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Monthly Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$10</span>
              <span className="text-[#ffffff] ml-1">/ month</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited search queries</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Real-time market sentiment analysis</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Full access to all features</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: "initial", display: "block" }}>
                <HelioCheckout config={monthlyPlanConfig} />
              </div>
            </div>
          </div>

          {/* Quarterly Plan */}
          <div 
            style={{ 
              flex: "1 1 350px",
              minWidth: "350px", 
              maxWidth: "380px",
              position: "relative", 
              padding: "1.5rem", 
              borderRadius: "0.5rem",
              border: "2px solid rgb(55, 65, 81)",
              background: "rgba(7, 4, 23, 0.9)"
            }}
          >
            <div className="absolute -top-3 -right-3 bg-[#402fb5] text-white text-xs font-bold px-3 py-1 rounded-full">
              POPULAR
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Quarterly Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$25.00</span>
              <span className="text-[#ffffff] ml-1">/ 3 months</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Everything in monthly plan</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Priority support</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Save over 15% vs monthly</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: "initial", display: "block" }}>
                <HelioCheckout config={quarterlyPlanConfig} />
              </div>
            </div>
          </div>

          {/* Lifetime Plan */}
          <div 
            style={{ 
              flex: "1 1 350px",
              minWidth: "350px",
              maxWidth: "380px", 
              position: "relative", 
              padding: "1.5rem", 
              borderRadius: "0.5rem",
              border: "1px solid rgb(31, 41, 55)",
              background: "rgba(7, 4, 23, 0.8)"
            }}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Lifetime Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$100</span>
              <span className="text-[#ffffff] ml-1">one-time</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Lifetime access to all features</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>VIP support</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="h-5 w-5 text-white mr-2 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>All future updates included</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: "initial", display: "block" }}>
                <HelioCheckout config={lifetimePlanConfig} />
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">Subscription Benefits</h2>
        <ul className="list-disc list-inside text-[#ffffff] space-y-2">
          <li>Unlimited search queries</li>
          <li>Real-time market sentiment analysis</li>
          <li>Asset social media tracking</li>
          <li>Personalized trading insights</li>
        </ul>
      </div>
    )
  }

  // Replace the particles effect with this
  useEffect(() => {
    // Skip during server-side rendering and ensure client is ready
    if (!isClientSide || typeof window === "undefined") return

    const canvas = document.getElementById("particles-canvas") as HTMLCanvasElement
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: any[] = []

    class Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      color: string

      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 3 + 1
        this.speedX = Math.random() * 0.5 - 0.25
        this.speedY = Math.random() * 0.5 - 0.25

        // Star-like color palette
        const colors = [
          "rgba(64, 47, 181, 0.5)", // Purple
          "rgba(207, 48, 170, 0.5)", // Pink
          "rgba(160, 153, 216, 0.5)", // Light purple
          "rgba(223, 162, 218, 0.5)", // Light pink
        ]
        this.color = colors[Math.floor(Math.random() * colors.length)]
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

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [isClientSide])

  // Replace the return statement with this
  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] overflow-x-hidden overflow-y-auto flex flex-col">
      <Nav />

      {/* Only render canvas on client-side */}
      {isClientSide && (
        <canvas id="particles-canvas" className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"></canvas>
      )}

      <main className="max-w-[1400px] px-6 lg:px-12 relative z-10 min-h-[calc(100vh-240px)] flex flex-col overflow-x-hidden pb-20 mx-auto">
        {/* Back to Home button - positioned in top-left corner as a floating button */}
        <div className="absolute top-4 left-4 z-20 mb-4">
          <a
            href="/"
            className="flex items-center text-[#ffffff] hover:text-white transition-colors text-sm px-3"
            aria-label="Return to home page"
            onClick={(e) => {
              // Still handle the click event to get logging
              e.preventDefault();
              console.log('Home link clicked');
              handleBackToHome();
            }}
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
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </a>
          
          {/* Hidden anchor tag as fallback */}
          <a 
            href="/"
            className="hidden"
            id="home-fallback-link"
            aria-hidden="true"
          >
            Back to Home
          </a>
        </div>

        <div className="mb-6 mt-16">
          <h1 className="text-2xl font-semibold text-white">Billing & Subscription</h1>
          <p className="text-[#ffffff] mt-2">Manage your subscription and payment details</p>
        </div>

        {isBillingLoading ? (
          <div className="w-full max-w-4xl mx-auto">
            <div className="space-y-8 mb-6">
              {/* Subscription Overview Skeleton */}
              <div className="animate-pulse">
                <div className="h-7 bg-gray-700 rounded w-48 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-32"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-20"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-12 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-48"></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-20 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-28"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-24 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-28"></div>
                      <div className="h-3 bg-gray-700 rounded w-36 mt-1"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-32 mb-1"></div>
                      <div className="h-5 bg-gray-700 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment History Skeleton */}
              <div className="animate-pulse">
                <div className="h-7 bg-gray-700 rounded w-40 mb-4"></div>
                <div className="overflow-x-auto">
                  <div className="min-w-full divide-y divide-gray-800">
                    {/* Table Header */}
                    <div className="grid grid-cols-4 gap-4 px-4 py-3">
                      <div className="h-4 bg-gray-700 rounded w-12"></div>
                      <div className="h-4 bg-gray-700 rounded w-24"></div>
                      <div className="h-4 bg-gray-700 rounded w-16"></div>
                      <div className="h-4 bg-gray-700 rounded w-16"></div>
                    </div>
                    {/* Table Rows */}
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="grid grid-cols-4 gap-4 px-4 py-4">
                        <div className="h-4 bg-gray-700 rounded w-20"></div>
                        <div className="h-4 bg-gray-700 rounded w-16"></div>
                        <div className="h-4 bg-gray-700 rounded w-20"></div>
                        <div className="h-6 bg-gray-700 rounded-full w-20"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subscription Actions Skeleton */}
              <div className="animate-pulse">
                <div className="h-7 bg-gray-700 rounded w-52 mb-4"></div>
                <div className="flex flex-col md:flex-row gap-6 mb-4">
                  <div className="md:w-1/2">
                    <div className="h-12 bg-gray-700 rounded-lg w-full"></div>
                  </div>
                  <div className="md:w-1/2">
                    <div className="h-12 bg-gray-700 rounded-lg w-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>

              {/* Contact Info Skeleton */}
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-64"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Only render subscription content after client-side hydration AND context loading */}
            {isClientSide && !isBillingLoading && (
              <>
                {subscriptionDetails?.status !== "active" || error ? (
                  renderExpiredSubscription()
                ) : subscriptionDetails ? (
                  /* Your existing subscription details UI */
                  <div className="space-y-8 mb-6">
                    {/* Subscription Overview */}
                    <h2 className="text-xl font-semibold text-white mb-4">Subscription Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Plan</span>
                          <span className="text-white font-medium">
                            {getPlanName(subscriptionDetails.plan || "unknown")}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Status</span>
                          <span className={`font-medium ${getStatusClass(subscriptionDetails.status || "inactive")}`}>
                            {subscriptionDetails.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Email</span>
                          <span className="text-white font-medium">
                            {subscriptionDetails.email || "No email provided"}
                          </span>
                        </div>
                        {subscriptionDetails.transactionDetails?.meta?.customerDetails?.fullName && (
                          <div className="mb-4">
                            <span className="text-[#ffffff] block">Name</span>
                            <span className="text-white font-medium">
                              {subscriptionDetails.transactionDetails.meta.customerDetails.fullName}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Started On</span>
                          <span className="text-white font-medium">
                            {formatDate(subscriptionDetails.startedAt || "2024-01-01T00:00:00.000Z")}
                          </span>
                        </div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Renewal Date</span>
                          <span className="text-white font-medium">
                            {formatDate(subscriptionDetails.renewalDate || "2024-01-01T00:00:00.000Z")}
                          </span>
                          {subscriptionDetails.renewalDate && (
                            <span
                              className={`text-xs block mt-1 ${hasRenewalDatePassed(subscriptionDetails.renewalDate) ? "text-red-400" : "text-green-400"}`}
                            >
                              {getTimeRemaining(subscriptionDetails.renewalDate)}
                            </span>
                          )}
                        </div>
                        <div className="mb-4">
                          <span className="text-[#ffffff] block">Payment Method</span>
                          <span className="text-white font-medium capitalize">
                            {subscriptionDetails.paymentMethod || "Unknown"}
                          </span>
                        </div>
                        {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                          <div className="mb-4">
                            <span className="text-[#ffffff] block">Country</span>
                            <span className="text-white font-medium">
                              {subscriptionDetails.transactionDetails.meta.customerDetails.country}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {subscriptionDetails.amount && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <span className="text-[#ffffff] block">Current Billing</span>
                        <span className="text-white font-medium">
                          {formatAmount(
                            subscriptionDetails.amount ||
                              (subscriptionDetails.transactionDetails?.meta?.totalAmount
                                ? Number.parseFloat(subscriptionDetails.transactionDetails.meta.totalAmount) / 1000000
                                : undefined),
                            subscriptionDetails.currency ||
                              subscriptionDetails.transactionDetails?.meta?.currency?.id ||
                              "USDC",
                          )}
                        </span>
                      </div>
                    )}

                    {/* Additional Transaction Details */}
                    {subscriptionDetails.transactionDetails && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">Payment Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {subscriptionDetails.transactionDetails.paylinkId && (
                            <div>
                              <span className="text-[#ffffff] block">Paylink ID</span>
                              <span className="text-white font-medium font-mono text-sm">
                                {subscriptionDetails.transactionDetails.paylinkId}
                              </span>
                            </div>
                          )}
                          {subscriptionDetails.transactionDetails.paymentType && (
                            <div>
                              <span className="text-[#ffffff] block">Payment Type</span>
                              <span className="text-white font-medium">
                                {subscriptionDetails.transactionDetails.paymentType}
                              </span>
                            </div>
                          )}
                          {subscriptionDetails.transactionDetails.meta?.transactionSignature && (
                            <div>
                              <span className="text-[#ffffff] block">Transaction Signature</span>
                              <span className="text-white font-medium font-mono text-xs overflow-hidden text-ellipsis">
                                {`${subscriptionDetails.transactionDetails.meta.transactionSignature.substring(0, 12)}...${subscriptionDetails.transactionDetails.meta.transactionSignature.substring(subscriptionDetails.transactionDetails.meta.transactionSignature.length - 8)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Payment History */}
                    <h2 className="text-xl font-semibold text-white mb-4">Payment History</h2>
                    {subscriptionDetails && subscriptionDetails.transactionId ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-800">
                          <thead>
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">
                                Transaction ID
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">
                                Status
                              </th>
                              {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">
                                  Country
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            <tr>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                {formatDate(
                                  subscriptionDetails.transactionDetails?.createdAt ||
                                    subscriptionDetails.startedAt ||
                                    "2024-01-01T00:00:00.000Z",
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                                {subscriptionDetails.transactionId
                                  ? subscriptionDetails.transactionId.length > 8
                                    ? `${subscriptionDetails.transactionId.substring(0, 8)}...`
                                    : subscriptionDetails.transactionId
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                {formatAmount(
                                  subscriptionDetails.amount ||
                                    (subscriptionDetails.transactionDetails?.meta?.totalAmount
                                      ? Number.parseFloat(subscriptionDetails.transactionDetails.meta.totalAmount) /
                                        1000000
                                      : undefined),
                                  subscriptionDetails.currency ||
                                    subscriptionDetails.transactionDetails?.meta?.currency?.id ||
                                    "USDC",
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    getTransactionStatus(subscriptionDetails.transactionDetails) === "SUCCESS"
                                      ? "bg-white text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {getTransactionStatus(subscriptionDetails.transactionDetails) === "SUCCESS"
                                    ? "Completed"
                                    : getTransactionStatus(subscriptionDetails.transactionDetails)}
                                </span>
                              </td>
                              {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                  {subscriptionDetails.transactionDetails.meta.customerDetails.country}
                                </td>
                              )}
                            </tr>
                            {subscriptionDetails.renewedAt && (
                              <tr>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                  {new Date(subscriptionDetails.renewedAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                                  {subscriptionDetails.transactionId
                                    ? subscriptionDetails.transactionId.length > 8
                                      ? `${subscriptionDetails.transactionId.substring(0, 8)}...`
                                      : subscriptionDetails.transactionId
                                    : "N/A"}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                  {formatAmount(subscriptionDetails.amount, subscriptionDetails.currency)}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-white text-green-800">
                                    Renewed
                                  </span>
                                </td>
                                {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                    {subscriptionDetails.transactionDetails.meta.customerDetails.country}
                                  </td>
                                )}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-[#ffffff]">No transaction history available</p>
                      </div>
                    )}

                    {/* Subscription Actions */}
                    <h2 className="text-xl font-semibold text-white mb-4">Subscription Management</h2>
                    <div className="flex flex-col md:flex-row gap-6 mb-4">
                      <div className="md:w-1/2">
                        {hasRenewalDatePassed(subscriptionDetails?.renewalDate || "") ? (
                          <button
                            onClick={() => {
                              const paylinkId =
                                subscriptionDetails?.transactionDetails?.paylinkId || "68229ffa2c8760f1eb3d19d7"
                              handleRenewSubscription(paylinkId)
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                          >
                            Renew Subscription
                          </button>
                        ) : (
                          <div 
                            className="w-full bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg cursor-not-allowed"
                            title="You can renew once your current subscription period ends"
                          >
                            Renew Subscription
                          </div>
                        )}
                      </div>

                      <div className="md:w-1/2">
                        {!isSubscribed ? (
                          <button
                            onClick={handleUpgradeDowngrade}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                          >
                            Upgrade/Downgrade
                          </button>
                        ) : (
                          <div 
                            className="w-full bg-gray-600 text-gray-300 font-semibold py-3 px-6 rounded-lg cursor-not-allowed"
                            title="You can upgrade/downgrade when your current subscription ends"
                          >
                            Upgrade/Downgrade
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-[#ffffff] mt-2 space-y-2">
                      {!hasRenewalDatePassed(subscriptionDetails?.renewalDate || "") && (
                        <p>
                          Your subscription is active until {formatDate(subscriptionDetails?.renewalDate || "")}. You
                          can renew after this date.
                        </p>
                      )}

                      {isSubscribed && (
                        <p>
                          Plan changes are not available while you have an active subscription. Please contact support
                          for assistance.
                        </p>
                      )}
                    </div>

                    <p className="mt-6 text-sm text-[#ffffff]">
                      Need help? Contact{" "}
                      <a href="mailto:hi@koyn.finance" className="text-[#ffffff] hover:underline">
                        hi@koyn.finance
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-yellow-200 mb-4">No subscription information available</p>
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleRenewSubscription("68229ffa2c8760f1eb3d19d7")}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
                      >
                        Subscribe Now
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Debug information in development mode */}
        {process.env.NODE_ENV === "development" && isClientSide && (
          <div className="mt-10 text-xs text-gray-500 border-t border-gray-800 pt-4">
            <h4 className="font-semibold mb-2">Debug Info</h4>
            <div>
              <div>
                <span className="font-mono">userEmail:</span> {userEmail || "null"}
              </div>
              <div>
                <span className="font-mono">isSubscribed:</span> {String(isSubscribed)}
              </div>
              <div>
                <span className="font-mono">isClient:</span> {String(isClientSide)}
              </div>
              <div>
                <span className="font-mono">localStorage:</span>{" "}
                {isClientSide && typeof window !== "undefined"
                  ? localStorage.getItem("koyn_subscription")
                    ? "has data"
                    : "empty"
                  : "not available (server)"}
              </div>
              <div>
                <span className="font-mono">error:</span> {error || "none"}
              </div>
              <div>
                <span className="font-mono">cancelError:</span> {cancelError || "none"}
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Footer to ensure proper spacing */}
      <Footer />
    </div>
  )
}

export default function Billing() {
  return (
    <ProtectedPage requiresSubscription={true}>
      <BillingContent />
    </ProtectedPage>
  );
}
