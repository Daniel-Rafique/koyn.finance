"use client"

import React, { useState, useRef, useEffect } from "react"
import { Routes } from "../utils/routes"
import SubscriptionModal from "./SubscriptionModal"
import { useSubscription } from "../context/AuthProvider"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"

interface SubscribeButtonProps {
  onClick?: () => void
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
  const { logout } = useSubscription()

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
      // Call the onNavigate callback to close the dropdown
      onNavigate();
      
      // Navigate to billing page
      window.location.href = "/app/billing";
      console.log("Navigation initiated to billing page");
    } catch (error) {
      console.error("Error navigating to billing:", error);
      // Final fallback to ensure navigation happens
      window.location.href = "/app/billing";
    }
  }

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Logout clicked");

    try {
      // Call the onNavigate callback to close the dropdown
      onNavigate();

      // Use the logout function from subscription context
      logout();
      console.log("Logout successful");
    } catch (error) {
      console.error("Error during logout:", error);
      // Fallback to page refresh if logout fails
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
              // Call the onNavigate callback to close the dropdown
              onNavigate();

              // Use the logout function from subscription context
              logout();
              console.log("Logout successful");
            } catch (error) {
              console.error("Error during logout:", error);
              // Fallback to page refresh if logout fails
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
          onClick={() => {
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

export default function SubscribeButton({ onClick, text }: SubscribeButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, right: 0 })
  
  // Get subscription context
  const { isSubscribed, userEmail, user } = useSubscription()

  // Handle button click to show subscription options
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (onClick) {
      // If custom onClick is provided, use that
      onClick()
    } else if (isSubscribed && user) {
      // For logged-in users, show dropdown
      if (!dropdownOpen) {
        updateDropdownPosition()
      }
      setDropdownOpen(!dropdownOpen)
    } else {
      // For non-logged-in users, show subscription modal
      setModalOpen(true)
    }
  }

  // Handle modal close
  const handleModalClose = () => {
    setModalOpen(false)
  }

  // Handle successful subscription
  const handleSubscriptionSuccess = (event: any) => {
    console.log("Subscription successful:", event)
    setModalOpen(false)
    // The subscription context will automatically update when user logs in
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
                // User icon for subscribed state (green for active users)
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
      {isSubscribed && dropdownOpen && (
        <DropdownMenu
          isOpen={dropdownOpen}
          position={dropdownPosition}
          userEmail={userEmail}
          onNavigate={closeDropdown}
        />
      )}

      {/* Subscription Modal */}
      {modalOpen && (
        <SubscriptionModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          onSuccess={handleSubscriptionSuccess}
        />
      )}
    </>
  )
}
