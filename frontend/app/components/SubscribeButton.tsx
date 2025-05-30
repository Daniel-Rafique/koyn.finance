"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"

interface SubscribeButtonProps {
  onClick: () => void
  isSubscribed?: boolean
  userEmail?: string | null
  text?: string
}

// Dropdown component that renders directly into body via portal
function DropdownMenu({
  isOpen,
  position,
  userEmail,
  onNavigate,
}: {
  isOpen: boolean
  position: { top: number; left: number; right: number }
  userEmail?: string | null
  onNavigate: () => void
}) {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Create and append the portal element to the body
    const el = document.createElement("div")
    el.className = "dropdown-portal"
    el.setAttribute("data-koyn-dropdown", "account-dropdown")
    document.body.appendChild(el)
    setPortalElement(el)

    return () => {
      // Remove the portal element on unmount
      if (document.body.contains(el)) {
        document.body.removeChild(el)
      }
    }
  }, [])

  if (!isOpen || !portalElement) return null

  // Determine position based on screen width
  const isMobile = window.innerWidth < 768
  const dropdownStyle = {
    position: "fixed" as const,
    top: `${position.top}px`,
    right: isMobile ? "auto" : `${position.right}px`,
    left: isMobile ? `${position.left}px` : "auto",
    zIndex: 9999,
    background: "rgb(0, 0, 0)",
    borderRadius: "0.375rem",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    width: "12rem",
  }

  const handleAccountClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Account Settings clicked");

    try {
      // Ensure the email is saved to localStorage before navigating
      if (userEmail) {
        try {
          // Either use existing localStorage data or create minimal data with email
          const savedData = localStorage.getItem("koyn_subscription")
          let subscriptionData

          if (savedData) {
            // Update existing data
            subscriptionData = JSON.parse(savedData)
            // Ensure email is set correctly
            subscriptionData.email = userEmail
          } else {
            // Create minimal data with just email for billing access
            subscriptionData = {
              email: userEmail,
              verifiedVia: "account_menu",
              allowBillingAccess: true, // Special flag to indicate this user should have billing access
            }
          }

          localStorage.setItem("koyn_subscription", JSON.stringify(subscriptionData))
          console.log("Email saved to localStorage:", userEmail)
        } catch (err) {
          console.error("Error saving email to localStorage:", err)
        }
      } else {
        console.warn("No userEmail available to save")
      }

      // Check if we need to clear the billing page session flag
      try {
        if (typeof window !== "undefined" && window.sessionStorage) {
          const onBillingPage = sessionStorage.getItem("on_billing_page")
          if (onBillingPage === "true") {
            console.log("Clearing billing page flag before navigation")
            sessionStorage.removeItem("on_billing_page")
          }
        }
      } catch (err) {
        console.error("Error checking session storage:", err)
      }

      console.log("About to navigate to billing page");
      
      // Call the onNavigate callback to close the dropdown
      onNavigate();
      
      // Use direct window.location navigation which is more reliable
      window.location.href = "/app/billing";
      console.log("Navigation initiated via window.location");
    } catch (error) {
      console.error("Unhandled error in handleAccountClick:", error);
      // Final fallback to ensure navigation happens
      window.location.href = "/app/billing";
    }
  }

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Logout clicked");

    try {
      // Remove the subscription data from localStorage
      localStorage.removeItem("koyn_subscription");
      console.log("Removed koyn_subscription from localStorage");

      // Clear any session storage flags
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.removeItem("on_billing_page");
        console.log("Cleared session storage flags");
      }

      // Call the onNavigate callback to close the dropdown
      onNavigate();

      // Refresh the page to reset the application state
      window.location.reload();
      console.log("Page refresh initiated for logout");
    } catch (error) {
      console.error("Error during logout:", error);
      // Even if there's an error, try to refresh the page
      window.location.reload();
    }
  }

  const portalContent = (
    <div style={dropdownStyle}>
      <div className="py-1">
        <button
          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors duration-150"
          onClick={(e) => {
            console.log("Account button clicked");
            handleAccountClick(e);
          }}
          type="button"
        >
          Account Settings
        </button>
        
        <button
          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors duration-150"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Logout clicked");

            try {
              // Remove the subscription data from localStorage
              localStorage.removeItem("koyn_subscription");
              console.log("Removed koyn_subscription from localStorage");

              // Clear any session storage flags
              if (typeof window !== "undefined" && window.sessionStorage) {
                sessionStorage.removeItem("on_billing_page");
                console.log("Cleared session storage flags");
              }

              // Call the onNavigate callback to close the dropdown
              onNavigate();

              // Refresh the page to reset the application state
              window.location.reload();
              console.log("Page refresh initiated for logout");
            } catch (error) {
              console.error("Error during logout:", error);
              // Even if there's an error, try to refresh the page
              window.location.reload();
            }
          }}
          type="button"
        >
          Logout
        </button>
        
        {/* Add a direct link as a fallback that becomes visible only if JS fails */}
        <a 
          href="/app/billing"
          className="hidden fallback-account-link" 
          style={{ display: 'none' }}
          onClick={(e) => {
            // Still try to handle localStorage operations
            if (userEmail) {
              try {
                const subscriptionData = {
                  email: userEmail,
                  verifiedVia: "fallback_link",
                  allowBillingAccess: true,
                };
                localStorage.setItem("koyn_subscription", JSON.stringify(subscriptionData));
              } catch (err) {
                console.error("Error in fallback link:", err);
              }
            }
            
            // Let the link proceed normally
            console.log("Using fallback navigation link");
          }}
        >
          Account (Fallback)
        </a>
      </div>
    </div>
  )

  return createPortal(portalContent, portalElement)
}

export default function SubscribeButton({ onClick, isSubscribed = false, userEmail, text }: SubscribeButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, right: 0 })

  // Handle button click to show subscription options
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isSubscribed) {
      // Toggle dropdown menu for subscribed users
      if (!dropdownOpen) {
        updateDropdownPosition()
      }
      setDropdownOpen(!dropdownOpen)
    } else {
      onClick()
    }
  }

  // Function to close the dropdown
  const closeDropdown = () => {
    setDropdownOpen(false)
  }

  // Update dropdown position based on button position
  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const windowWidth = window.innerWidth

      // Position dropdown to the right on larger screens, centered on mobile
      if (windowWidth >= 768) {
        // md breakpoint
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: 0,
          right: windowWidth - rect.right - window.scrollX,
        })
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: Math.max(10, rect.left + window.scrollX - 20),
          right: 0,
        })
      }
    }
  }

  // Update position on window resize
  useEffect(() => {
    if (dropdownOpen) {
      window.addEventListener("resize", updateDropdownPosition)
      return () => {
        window.removeEventListener("resize", updateDropdownPosition)
      }
    }
  }, [dropdownOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Ignore if the dropdown is not open
      if (!dropdownOpen) return

      // Find the dropdown portal in the DOM
      const portalEl = document.querySelector('.dropdown-portal');
      
      // Check if click is outside both the button and the dropdown portal
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node) && 
          (!portalEl || !portalEl.contains(event.target as Node))) {
        // Close the dropdown
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <>
      <div className="flex items-center" ref={buttonRef}>
        {isSubscribed && userEmail && (
          <div className="text-xs text-white/80 mr-2 truncate max-w-[140px] hidden md:block">{userEmail}</div>
        )}
        <div className="glowing-input-container button-container subscribe-button-container ml-2">
          <div className="glow"></div>
          <div className="darkBorderBg"></div>
          <div className="darkBorderBg"></div>
          <div className="darkBorderBg"></div>
          <div className="white"></div>
          <div className="border"></div>

          <div className="input-main" style={{ width: text ? "auto" : "40px", height: "40px" }}>
            <button
              onClick={handleClick}
              className="subscribe-button flex items-center justify-center"
              title={isSubscribed ? "Account options" : "Subscribe or verify subscription"}
              style={{
                top: "0",
                right: "0",
                width: text ? "auto" : "40px",
                height: "40px",
                padding: text ? "0 16px" : "0",
              }}
            >
              {isSubscribed ? (
                // User icon for subscribed state
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              ) : (
                <>
                  {text ? (
                    <span className="text-white font-medium px-1">{text}</span>
                  ) : (
                    // Person icon for subscribe button
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  )}
                </>
              )}
            </button>
            <div
              className="button-border"
              style={{ right: "0", top: "0", height: "40px", width: text ? "100%" : "40px" }}
            ></div>
          </div>
        </div>
      </div>

      {/* Dropdown Menu rendered via portal to document.body */}
      {isSubscribed && (
        <DropdownMenu
          isOpen={dropdownOpen}
          position={dropdownPosition}
          userEmail={userEmail}
          onNavigate={closeDropdown}
        />
      )}
    </>
  )
}
