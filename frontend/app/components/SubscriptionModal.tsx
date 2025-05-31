import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelioCheckout } from '@heliofi/checkout-react';
import type { EmbedThemeMode } from '@heliofi/checkout-react';
import { useSubscription } from '../context/AuthProvider';
import { trackTwitterConversion } from './Tracking';
import { useAuth } from '../context/AuthProvider';
// CSS styles moved to root.tsx to prevent duplication

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: any) => void;
}

// Verification API utility functions
const requestVerification = async (email: string) => {
  try {
    const response = await fetch('/api/verification/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error requesting verification:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

const verifyEmailCode = async (email: string, code: string) => {
  try {
    const response = await fetch('/api/verification/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

// Hardcoded paylink IDs as fallbacks
const MONTHLY_PAYLINK_ID = "68229fd19009f0c6c3ff67f2";
const QUARTERLY_PAYLINK_ID = "68229fbd9483a433d5884b7c";
const YEARLY_PAYLINK_ID = "68229ffa2c8760f1eb3d19d7";

// Define available subscription plans with hardcoded fallbacks
const SUBSCRIPTION_PLANS = {
  MONTHLY: {
    id: "1-month",
    paylinkId: import.meta.env.VITE_MONTHLY_PAYLINK_ID || MONTHLY_PAYLINK_ID,
    name: "Monthly",
    description: "Billed monthly"
  },
  QUARTERLY: {
    id: "3-month",
    paylinkId: import.meta.env.VITE_QUARTERLY_PAYLINK_ID || QUARTERLY_PAYLINK_ID,
    name: "Quarterly",
    description: "Billed every 3 months"
  },
  YEARLY: {
    id: "1-year",
    paylinkId: import.meta.env.VITE_YEARLY_PAYLINK_ID || YEARLY_PAYLINK_ID,
    name: "Yearly",
    description: "Billed annually (best value)"
  }
}

// Memoized checkout component to prevent unnecessary re-renders
const MemoizedHelioCheckout = React.memo(
  ({ config }: { config: any }) => <HelioCheckout config={config} />,
  (prevProps, nextProps) => prevProps.config.paylinkId === nextProps.config.paylinkId
);

export default function SubscriptionModal({ isOpen, onClose, onSuccess }: SubscriptionModalProps) {
  // Early return if modal is not open at all
  if (!isOpen) return null;
  
  // Log environment variables for debugging
  useEffect(() => {
    console.log("Environment Variables:", {
      monthly: import.meta.env.VITE_MONTHLY_PAYLINK_ID,
      quarterly: import.meta.env.VITE_QUARTERLY_PAYLINK_ID,
      yearly: import.meta.env.VITE_YEARLY_PAYLINK_ID
    });
  }, []);

  // Cache for checkout widget configurations
  const [cachedConfigs, setCachedConfigs] = useState<{[key: string]: any}>({});
  
  // State for verification mode
  const [verificationMode, setVerificationMode] = useState(true); // Default to login view
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<null | { success: boolean; message: string }>(null);
  
  // Selected subscription plan
  const [selectedPlan, setSelectedPlan] = useState<string>(SUBSCRIPTION_PLANS.MONTHLY.id);
  
  // Add loading state for checkout widget
  const [checkoutLoading, setCheckoutLoading] = useState(true);
  
  // 2FA state
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  
  // UI state
  const [highlightSubscribeTab, setHighlightSubscribeTab] = useState(false);
  
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Get the login function from context
  const { userEmail, login } = useSubscription();
  
  // Reset the checkout loading state when plan changes
  useEffect(() => {
    if (!verificationMode) {
      // Reset loading state when changing plans
      setCheckoutLoading(true);
    }
  }, [selectedPlan, verificationMode]);
  
  // Fallback timeout to ensure loading state doesn't get stuck
  useEffect(() => {
    if (!verificationMode && checkoutLoading) {
      // If loading takes more than 5 seconds, force it to complete
      const timeoutId = setTimeout(() => {
        if (checkoutLoading) {
          console.log('Checkout widget loading timeout - forcing completion');
          setCheckoutLoading(false);
        }
      }, 5000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [verificationMode, checkoutLoading]);
  
  // Timer for code expiry countdown
  useEffect(() => {
    if (!codeExpiry) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((codeExpiry.getTime() - now.getTime()) / 1000));
      setRemainingTime(timeLeft);
      
      if (timeLeft === 0) {
        clearInterval(interval);
        setCodeSent(false);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [codeExpiry]);
  
  // Handle modal animation states
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsClosing(false);
    }
  }, [isOpen]);
  
  // Reset verification states when closing modal
  useEffect(() => {
    if (!isOpen) {
      setShowCodeInput(false);
      setCodeSent(false);
      setVerificationCode('');
      setCodeError(null);
    }
  }, [isOpen]);
  
  // Handle close with animation
  const handleCloseWithAnimation = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setIsVisible(false);
    }, 300);
  };
  
  // Check current subscription status when modal is opened
  useEffect(() => {
    if (isOpen && userEmail) {
      // The new AuthProvider automatically handles subscription verification
      console.log('Modal opened for user:', userEmail);
    }
  }, [isOpen, userEmail]);

  // Get the active plan configuration
  const getActivePlanConfig = () => {
    const planMap = {
      [SUBSCRIPTION_PLANS.MONTHLY.id]: SUBSCRIPTION_PLANS.MONTHLY,
      [SUBSCRIPTION_PLANS.QUARTERLY.id]: SUBSCRIPTION_PLANS.QUARTERLY,
      [SUBSCRIPTION_PLANS.YEARLY.id]: SUBSCRIPTION_PLANS.YEARLY
    };
    
    return planMap[selectedPlan] || SUBSCRIPTION_PLANS.MONTHLY;
  };
  
  // Reset form when changing between login and subscription modes
  useEffect(() => {
    if (!verificationMode) {
      setShowCodeInput(false);
      setVerificationEmail('');
      setVerificationCode('');
      setCodeError(null);
      setVerificationResult(null);
    }
  }, [verificationMode]);

  // Don't render if modal is in closing animation but still technically visible
  if (!isOpen && !isVisible) {
    return null;
  }

  // Get the Helio configuration for the currently selected plan
  const getHelioConfig = () => {
    const activePlan = getActivePlanConfig();
    const cacheKey = activePlan.id;
    
    // Check if we have a cached config for this plan
    if (cachedConfigs[cacheKey]) {
      console.log(`Using cached config for ${activePlan.id}`);
      return cachedConfigs[cacheKey];
    }
    
    // Get paylinkId with explicit fallback to ensure it's never undefined
    const paylinkId = activePlan.paylinkId || (() => {
      // Log error for debugging
      console.error(`Missing paylinkId for plan ${activePlan.id}. Using default ID.`);
      return activePlan.id === SUBSCRIPTION_PLANS.YEARLY.id 
        ? YEARLY_PAYLINK_ID 
        : activePlan.id === SUBSCRIPTION_PLANS.QUARTERLY.id
          ? QUARTERLY_PAYLINK_ID
          : MONTHLY_PAYLINK_ID;
    })();
    
    console.log(`Creating new config for ${activePlan.id}:`, { paylinkId });
    
    // Create new configuration
    const config = {
      paylinkId,
      theme: { themeMode: "light" as EmbedThemeMode },
      primaryColor: "#111827", // Indigo color that will be more visible
      neutralColor: "#FFFFFF", // White text for better contrast
      display: "inline" as const,
      onSuccess: (event: any) => {
        console.log("Payment success:", event);
        
        // Track Twitter conversion with event details
        try {
          const subscriptionEmail = event.customerDetails?.email || verificationEmail || userEmail;
          const transactionId = event.id || event.meta?.transactionSignature || 'unknown-transaction';
          const amount = event.meta?.totalAmount ? 
            parseFloat(event.meta.totalAmount) / 1000000 : // Convert from Solana lamports
            null;
          
          // Track conversion with available details
          trackTwitterConversion({
            value: amount,
            currency: 'USD',
            conversion_id: transactionId,
            email_address: subscriptionEmail
          });
          
          console.log("Successfully tracked Twitter conversion");
        } catch (err) {
          console.error("Error tracking Twitter conversion:", err);
        }
        
        // After successful payment, the webhook will create the subscription server-side
        // We should prompt the user to verify their email to get secure access tokens
        // For now, show success and direct them to verify their email
        console.log("Payment successful. User should verify email to access account.");
        
        // Show success message and close modal
        setTimeout(() => {
          handleCloseWithAnimation();
          
          // Switch to verification tab to get secure tokens
          setTimeout(() => {
            if (event.customerDetails?.email) {
              setVerificationEmail(event.customerDetails.email);
              setVerificationMode(true);
              // Optionally reopen modal for verification
              // This ensures the user gets secure tokens after payment
            }
          }, 1000);
        }, 2000);
      },
      onError: (event: any) => {
        console.error("Payment error:", event);
        // Ensure loading state is cleared on error
        setCheckoutLoading(false);
      },
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => {
        console.log("Cancelled payment");
        onClose();
      },
      onStartPayment: () => console.log("Starting payment"),
      onLoaded: () => {
        console.log("Checkout widget loaded");
        // Use a small timeout to ensure DOM is updated
        setTimeout(() => {
          setCheckoutLoading(false);
        }, 100);
      }
    };
    
    // Cache the configuration
    setCachedConfigs(prev => ({
      ...prev,
      [cacheKey]: config
    }));
    
    return config;
  };

  // Function to send verification code to email
  const sendVerificationCode = async () => {
    if (!verificationEmail) return;
    
    setVerifying(true);
    setVerificationResult(null);
    setCodeError(null);
    
    try {
      // Check if subscription exists using a relative URL
      const timestamp = Date.now();
      const subscriptionCheckUrl = `/api/subscription/${encodeURIComponent(verificationEmail)}?t=${timestamp}`;
      
      const subscriptionCheckResponse = await fetch(subscriptionCheckUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Request-Time': timestamp.toString()
        }
      });
      
      if (!subscriptionCheckResponse.ok) {
        throw new Error(`Failed to check subscription: ${subscriptionCheckResponse.status}`);
      }
      
      const subscriptionData = await subscriptionCheckResponse.json();
      
      // Log subscription check result for debugging
      console.log('Subscription check result:', subscriptionData);
      
      // Check if subscription is active based on explicit status field
      let isActive = subscriptionData.active;
      
      // Additionally check the subscription details if available
      if (subscriptionData.subscription) {
        // Extract status from the subscription object
        const status = subscriptionData.subscription.status;
        
        // If status is explicitly set to active, respect it
        if (status === 'active') {
          isActive = true;
        }
        // Else if status is explicitly inactive, respect that too
        else if (status === 'inactive') {
          isActive = false;
        }
        // Otherwise check renewal date
        else if (subscriptionData.subscription.renewalDate) {
          const renewalDate = new Date(subscriptionData.subscription.renewalDate);
          const now = new Date();
          // If renewal date is in the future, subscription is active
          isActive = renewalDate > now;
          console.log('Renewal date check:', { 
            renewalDate, 
            now, 
            isActive: renewalDate > now 
          });
        }
      }
      
      if (!isActive) {
        // If no active subscription, switch to subscription tab
        setVerificationResult({
          success: false,
          message: 'No active subscription found for this email. Please subscribe to continue.'
        });
        
        // Highlight subscribe tab to draw attention
        setHighlightSubscribeTab(true);
        
        // Wait a moment before switching to subscription tab
        setTimeout(() => {
          setVerificationMode(false);
          // Remove highlight after switching
          setTimeout(() => {
            setHighlightSubscribeTab(false);
          }, 1500);
        }, 2000);
        
        setVerifying(false);
        return;
      }
      
      // Use the HubSpot utility function to request verification
      const response = await requestVerification(verificationEmail);
      
      if (!response.success) {
        // Handle error responses
        if (response.subscriptionRequired) {
          // If the backend also confirms no subscription, switch to subscription tab
          setVerificationResult({
            success: false,
            message: response.error || 'No active subscription found. Please subscribe to continue.'
          });
          
          setHighlightSubscribeTab(true);
          setTimeout(() => {
            setVerificationMode(false);
            setTimeout(() => {
              setHighlightSubscribeTab(false);
            }, 1500);
          }, 2000);
        } else {
          // Other errors
          setVerificationResult({
            success: false,
            message: response.error || 'Failed to send verification code. Please try again.'
          });
        }
        setVerifying(false);
        return;
      }
      
      // Set expiry time (10 minutes from now)
      const expiryTime = response.expiresAt ? new Date(response.expiresAt) : new Date(Date.now() + 10 * 60 * 1000);
      setCodeExpiry(expiryTime);
      
      // In development mode, the API may return the code in response
      if (response.code && process.env.NODE_ENV === 'development') {
        console.log(`DEV MODE: Verification code: ${response.code}`);
      }
      
      setCodeSent(true);
      setShowCodeInput(true);
      setVerificationResult({
        success: true,
        message: 'Verification code sent to your email. Valid for 10 minutes.'
      });
    } catch (error) {
      console.error('Error sending verification code:', error);
      setVerificationResult({
        success: false,
        message: 'Failed to send verification code. Please try again later.'
      });
    }
    
    setVerifying(false);
  };

  // Function to verify code and then check subscription
  const verifyCode = async () => {
    if (!verificationEmail || !verificationCode) return;
    
    setVerifying(true);
    setCodeError(null);
    
    try {
      // Use the secure verification endpoint
      const response = await verifyEmailCode(verificationEmail, verificationCode);
      
      if (!response.success) {
        // Handle different error responses
        if (response.attemptsLeft) {
          setCodeError(`Invalid verification code. You have ${response.attemptsLeft} attempts left.`);
        } else if (response.subscriptionRequired) {
          setVerificationResult({
            success: false,
            message: 'No active subscription found. Please subscribe to continue.'
          });
          
          setHighlightSubscribeTab(true);
          setTimeout(() => {
            setVerificationMode(false);
            setTimeout(() => {
              setHighlightSubscribeTab(false);
            }, 1500);
          }, 2000);
        } else {
          setCodeError(response.error || 'Failed to verify code. Please try again.');
        }
        
        setVerifying(false);
        return;
      }
      
      // Code verification successful - response now contains secure tokens
      if (response.auth && response.user) {
        // Use the new secure login function from context
        login({
          auth: response.auth,
          user: response.user
        });
        
        // Track Twitter conversion for email verification
        try {
          trackTwitterConversion({
            value: 0, // No direct monetary value for verification
            currency: 'USD',
            conversion_id: `verification-${Date.now()}`,
            email_address: verificationEmail
          });
          console.log("Successfully tracked verification conversion");
        } catch (err) {
          console.error("Error tracking verification conversion:", err);
        }
        
        setVerificationResult({
          success: true,
          message: 'Verification successful! Your account is now activated.'
        });
        
        // Close modal after 2 seconds
        setTimeout(() => {
          handleCloseWithAnimation();
        }, 2000);
      } else {
        setCodeError('Invalid response from server. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setCodeError('Failed to verify code. Please try again later.');
    }
    
    setVerifying(false);
  };

  // Function to handle verification process
  const handleVerify = async () => {
    if (!verificationEmail) return;
    
    if (!showCodeInput) {
      // First step: send verification code to email
      await sendVerificationCode();
    } else {
      // Second step: verify code
      await verifyCode();
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`}>
        <div className={`modal-container ${isClosing ? 'closing' : ''}`}>
          {/* Close button */}
          <button 
            onClick={handleCloseWithAnimation}
            className="modal-close"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Tabs navigation */}
          <div className="tab-container">
            <div className={`tab-button-container ${verificationMode ? 'active' : ''}`}>
              <div className="tab-button-outer">
                <div className="tab-button-glow"></div>
                <div className="tab-button-border"></div>
                <button
                  onClick={() => setVerificationMode(true)}
                  className="tab-button"
                >
                  <span className="tab-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  Login
                </button>
              </div>
            </div>
            <div className={`tab-button-container ${!verificationMode ? 'active' : ''} ${highlightSubscribeTab ? 'highlight' : ''}`}>
              <div className="tab-button-outer">
                <div className="tab-button-glow"></div>
                <div className="tab-button-border"></div>
                <button
                  onClick={() => setVerificationMode(false)}
                  className="tab-button"
                >
                  <span className="tab-icon">
                    {!verificationMode && checkoutLoading ? (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 2v8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  Subscribe
                </button>
              </div>
            </div>
          </div>
          
          {/* Content area */}
          {verificationMode ? (
            /* Login/Verification mode */
            <div className="content-container">
              {/* Step 1: Email input */}
              {!showCodeInput ? (
                <>
                  <div className="glowing-input-container">
                    <div className="glow"></div>
                    <div className="darkBorderBg"></div>
                    <div className="darkBorderBg"></div>
                    <div className="darkBorderBg"></div>
                    <div className="white"></div>
                    <div className="border"></div>
                    
                    <div className="input-main">
                      <input 
                        type="email" 
                        value={verificationEmail}
                        onChange={e => setVerificationEmail(e.target.value)}
                        placeholder="youremail@example.com"
                        disabled={verifying}
                        className="glowing-input"
                        style={{
                          paddingRight: "50px"
                        }}
                      />
                      <div className="input-mask"></div>
                      <div className="pink-mask"></div>
                      <div className="button-border"></div>
                      <button 
                        type="button" 
                        className="search-button"
                        onClick={handleVerify}
                        disabled={!verificationEmail || verifying}
                      >
                        {verifying ? (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            strokeWidth="2"
                            stroke="#d6d6e6"
                            fill="none"
                            height="24"
                            width="24"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 12h14"></path>
                            <path d="M12 5l7 7-7 7"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Step 2: Verification code input */
                <>
                  <div className="glowing-input-container">
                    <div className="glow"></div>
                    <div className="darkBorderBg"></div>
                    <div className="darkBorderBg"></div>
                    <div className="darkBorderBg"></div>
                    <div className="white"></div>
                    <div className="border"></div>
                    
                    <div className="input-main">
                      <input 
                        type="text" 
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                        placeholder="000000"
                        disabled={verifying}
                        className="glowing-input"
                        style={{
                          paddingRight: "50px",
                          letterSpacing: "0.25rem"
                        }}
                        maxLength={6}
                      />
                      <div className="input-mask"></div>
                      <div className="pink-mask"></div>
                      <div className="button-border"></div>
                      <button 
                        type="button" 
                        className="search-button"
                        onClick={handleVerify}
                        disabled={!verificationCode || verificationCode.length < 6 || verifying}
                      >
                        {verifying ? (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            strokeWidth="2"
                            stroke="#d6d6e6"
                            fill="none"
                            height="24"
                            width="24"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 12h14"></path>
                            <path d="M12 5l7 7-7 7"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {codeError && (
                    <div className="result-message error">
                      {codeError}
                    </div>
                  )}
                  
                  <div className="verification-info">
                    <p className="login-note">
                      Enter the 6-digit code sent to {verificationEmail}
                      {remainingTime > 0 && (
                        <span className="code-timer"> (expires in {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')})</span>
                      )}
                    </p>
                    
                    <button 
                      type="button" 
                      className="resend-code-button"
                      onClick={sendVerificationCode}
                      disabled={codeSent && remainingTime > 0}
                    >
                      {codeSent && remainingTime > 0 ? 'Resend code' : 'Resend code'}
                    </button>
                    
                    <button
                      type="button"
                      className="change-email-button"
                      onClick={() => {
                        setShowCodeInput(false);
                        setCodeSent(false);
                        setVerificationCode('');
                        setCodeError(null);
                      }}
                    >
                      Change email
                    </button>
                  </div>
                </>
              )}
              
              {verificationResult && (
                <div className={`result-message ${verificationResult.success ? 'success' : 'error'}`}>
                  {verificationResult.message}
                </div>
              )}
            </div>
          ) : (
            /* Payment widget container */
            <div className="checkout-container">
              {/* Plan selection tabs */}
              <div className="plan-selector">
                <div 
                  className={`plan-option ${selectedPlan === SUBSCRIPTION_PLANS.MONTHLY.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlan(SUBSCRIPTION_PLANS.MONTHLY.id)}
                >
                  <span className="plan-name">Monthly</span>
                  <span className="plan-description">$10/mo</span>
                </div>
                <div 
                  className={`plan-option ${selectedPlan === SUBSCRIPTION_PLANS.QUARTERLY.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlan(SUBSCRIPTION_PLANS.QUARTERLY.id)}
                >
                  <span className="plan-name">Quarterly</span>
                  <span className="plan-description">$25/3mo</span>
                </div>
                <div 
                  className={`plan-option ${selectedPlan === SUBSCRIPTION_PLANS.YEARLY.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlan(SUBSCRIPTION_PLANS.YEARLY.id)}
                >
                  <span className="plan-name">Yearly</span>
                  <span className="plan-description">$100/yr</span>
                </div>
              </div>
              
              {/* Checkout widget */}
              <MemoizedHelioCheckout config={getHelioConfig()} />
            </div>
          )}
        </div>
      </div>
    </>
  );
} 