import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelioCheckout } from '@heliofi/checkout-react';
import type { EmbedThemeMode } from '@heliofi/checkout-react';
import { useSubscription } from '../context/SubscriptionContext';
import { trackTwitterConversion } from './Tracking';

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
  
  // Get the verifySubscription function from context
  const { verifySubscription, userEmail, login } = useSubscription();
  
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
      // Check if current stored email subscription is still valid
      verifySubscription(userEmail).catch(err => {
        console.error('Error verifying current subscription:', err);
      });
    }
  }, [isOpen, userEmail, verifySubscription]);

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

  // Custom styles for the modal and Helio widget
  const customStyle = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      animation: fadeIn 0.4s ease-out forwards;
    }
    
    .modal-container {
      position: relative;
      background: rgb(7, 4, 23);
      border-radius: 12px;
      width: 100%;
      max-width: 420px;
      overflow: hidden;
      margin: 1rem;
      z-index: 100000;
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      max-height: 90vh; /* Limit height on mobile devices */
      overflow-y: auto; /* Add scrolling for overflow content */
    }
    
    /* Entrance animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { 
        transform: translateY(30px);
        opacity: 0;
      }
      to { 
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    /* Exit animations */
    .modal-overlay.closing {
      animation: fadeOut 0.3s ease-out forwards;
    }
    
    .modal-container.closing {
      animation: slideDown 0.3s ease-out forwards;
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes slideDown {
      from { 
        transform: translateY(0);
        opacity: 1;
      }
      to { 
        transform: translateY(20px);
        opacity: 0;
      }
    }
    
    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      z-index: 100001;
      background: none;
      border: none;
      padding: 0.5rem;
      animation: fadeIn 0.3s ease-out 0.2s forwards;
      opacity: 0;
    }
    
    .modal-close:hover {
      color: white;
    }
    
    /* Tab styles */
    .tab-container {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      padding: 1.25rem 1rem 0.75rem; /* Reduced padding */
    }
    
    .tab-button-outer {
      position: relative;
      height: 40px; /* Reduced height */
      width: 110px; /* Slightly narrower */
    }
    
    .tab-button-glow {
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      border-radius: 10px;
      filter: blur(8px);
      opacity: 0.4;
      z-index: 0;
      overflow: hidden;
    }
    
    .tab-button-glow::before {
      content: "";
      z-index: -2;
      text-align: center;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(60deg);
      position: absolute;
      width: 999px;
      height: 999px;
      background-repeat: no-repeat;
      background-position: 0 0;
      background-image: conic-gradient(
        #000,
        #402fb5 5%,
        #000 38%,
        #000 50%,
        #cf30aa 60%,
        #000 87%
      );
      transition: all 2s;
    }
    
    .tab-button-container.active .tab-button-glow {
      opacity: 0.7;
    }
    
    .tab-button-container:hover .tab-button-glow {
      opacity: 0.6;
    }
    
    .tab-button-border {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 10px;
      z-index: 1;
      overflow: hidden;
    }
    
    .tab-button-border::before {
      content: "";
      text-align: center;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
      position: absolute;
      width: 600px;
      height: 600px;
      background-repeat: no-repeat;
      background-position: 0 0;
      filter: brightness(1.35);
      background-image: conic-gradient(
        rgba(0, 0, 0, 0),
        #fff,
        rgba(0, 0, 0, 0) 50%,
        rgba(0, 0, 0, 0) 50%,
        #fff,
        rgba(0, 0, 0, 0) 100%
      );
    }
    
    .tab-button-container.active .tab-button-border::before {
      animation: rotate 4s linear infinite;
    }
    
    .tab-button {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      isolation: isolate;
      overflow: hidden;
      border-radius: 10px;
      background: linear-gradient(180deg, #161329, black, #1d1b4b);
      border: 1px solid transparent;
      cursor: pointer;
      font-weight: 500;
      color: white;
      padding: 0.5rem 1rem;
      gap: 0.5rem;
    }
    
    .tab-button:hover {
      background: linear-gradient(180deg, #1c1833, #0d0d0d, #242057);
    }
    
    .tab-button:active {
      transform: scale(0.97);
    }
    
    .tab-button-container.active .tab-button {
      background: linear-gradient(180deg, #1a1636, #0a0a1a, #28256b);
    }
    
    .tab-icon {
      opacity: 0.9;
      transition: opacity 0.2s;
    }
    
    .tab-button:hover .tab-icon {
      opacity: 1;
    }
    
    /* Result message styles */
    .result-message {
      margin: 1rem 0;
      padding: 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    
    .result-message.success {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.5);
      color: #10b981;
    }
    
    .result-message.error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: #ef4444;
    }
    
    .helio-modal {
      z-index: 100000 !important;
    }
    
    /* Content container styles */
    .content-container {
      padding: 0 1.5rem 1.25rem; /* Reduced bottom padding */
      animation: contentFade 0.3s ease-out 0.25s forwards;
      opacity: 0;
    }
    
    .login-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: white;
      margin-bottom: 1rem;
    }
    
    .login-description {
      color: rgba(64, 47, 181, 0.3)
      margin-bottom: 1.5rem;
    }
    
    .login-note {
      font-size: 0.75rem;
      color: #FFFFFF;
      margin-top: 1rem;
    }
    
    /* Verification code styling */
    .verification-info {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .code-timer {
      font-weight: 500;
      color: #6366f1;
    }
    
    .resend-code-button,
    .change-email-button {
      background: none;
      border: none;
      color: #6366f1;
      font-size: 0.8rem;
      text-align: left;
      padding: 0;
      cursor: pointer;
      transition: color 0.2s ease;
    }
    
    .resend-code-button:hover,
    .change-email-button:hover {
      color: #818cf8;
      text-decoration: underline;
    }
    
    .resend-code-button:disabled {
      color: rgba(255, 255, 255, 0.4);
      cursor: not-allowed;
      text-decoration: none;
    }
    
    /* Animation for code input */
    @keyframes highlightField {
      0% {
        border-color: rgba(99, 102, 241, 0.3);
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.1);
      }
      50% {
        border-color: rgba(99, 102, 241, 0.8);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
      }
      100% {
        border-color: rgba(99, 102, 241, 0.3);
        box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.1);
      }
    }
    
    /* Checkout widget container styles */
    .checkout-container {
      padding: 0 1rem 0.75rem; /* Reduced padding */
      margin: 0 auto;
      animation: contentFade 0.3s ease-out 0.25s forwards;
      opacity: 0;
      position: relative;
      min-height: 200px; /* Reduced min-height */
    }
    
    /* Override Helio checkout widget styles for better visibility */
    :global(.helio-widget) {
      color: white !important;
    }
    
    :global(.helio-widget-container) {
      background: transparent !important;
    }
    
    :global(.helio-dropdown-root),
    :global(.helio-dropdown-control) {
      background: rgba(15, 10, 40, 0.8) !important;
      border-color: rgba(64, 47, 181, 0.6) !important;
    }
    
    :global(.helio-dropdown-menu) {
      background: rgba(15, 10, 40, 0.95) !important;
      border-color: rgba(64, 47, 181, 0.6) !important;
    }
    
    :global(.helio-dropdown-option) {
      background: transparent !important;
      color: white !important;
    }
    
    :global(.helio-dropdown-option:hover) {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    :global(.helio-widget button.helio-primary-button) {
      background-color: #111827 !important;
      color: white !important;
      border: 1px solid rgba(64, 47, 181, 0.3) !important;
    }
    
    :global(.helio-widget button.helio-primary-button:hover) {
      background-color: #1a2132 !important;
      box-shadow: 0 0 10px rgba(64, 47, 181, 0.3) !important;
    }
    
    :global(.helio-widget button.helio-secondary-button) {
      color: white !important;
      border-color: rgba(64, 47, 181, 0.3) !important;
    }
    
    :global(.helio-widget svg) {
      color: white !important;
    }
    
    :global(.helio-widget p),
    :global(.helio-widget span),
    :global(.helio-widget h1),
    :global(.helio-widget h2),
    :global(.helio-widget h3),
    :global(.helio-widget h4) {
      color: white !important;
    }
    
    /* Fix Discord and Telegram icons */
    :global(.helio-feature-item) {
      background-color: #111827 !important;
    }
    
    :global(.helio-feature-item svg path) {
      fill: white !important;
    }
    
    :global(.helio-feature-item svg) {
      color: white !important;
      fill: white !important;
    }
    
    /* Fix Pay with card button */
    :global(.helio-section-button) {
      color: white !important;
      background-color: #111827 !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
    }
    
    :global(.helio-section-button:hover) {
      background-color: #1a2132 !important;
    }
    
    :global(.helio-section-button svg) {
      color: white !important;
    }
    
    /* Fix QR button */
    :global(.helio-button-qr) {
      color: white !important;
      background-color: #111827 !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
    }
    
    :global(.helio-button-qr:hover) {
      background-color: #1a2132 !important;
    }
    
    :global(.helio-button-qr svg) {
      color: white !important;
    }
    
    /* Fix currency dropdown and other elements */
    :global(.helio-widget select),
    :global(.helio-dropdown-root),
    :global(.helio-dropdown-control) {
      background-color: #1e293b !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      color: white !important;
    }
    
    :global(.helio-dropdown-placeholder),
    :global(.helio-dropdown-single-value) {
      color: white !important;
    }
    
    :global(.helio-dropdown-indicator) {
      color: white !important;
    }
    
    :global(.helio-dropdown-menu) {
      background-color: #1e293b !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      color: white !important;
      z-index: 100002 !important;
    }
    
    :global(.helio-dropdown-option) {
      background-color: transparent !important;
      color: white !important;
    }
    
    :global(.helio-dropdown-option:hover) {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    :global(.helio-widget .helio-connect-btn),
    :global(.helio-widget button.helio-primary-button) {
      background-color: #111827 !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
    }
    
    :global(.helio-widget .helio-connect-btn:hover),
    :global(.helio-widget button.helio-primary-button:hover) {
      background-color: #1e293b !important;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2) !important;
    }
    
    /* Make labels and values more visible */
    :global(.helio-widget p),
    :global(.helio-widget span),
    :global(.helio-widget label),
    :global(.helio-widget h1),
    :global(.helio-widget h2),
    :global(.helio-widget h3),
    :global(.helio-widget h4) {
      color: white !important;
    }
    
    /* Fix the semi-transparent backgrounds and cards */
    :global(.helio-feature-card),
    :global(.helio-widget .helio-card),
    :global(.helio-widget .helio-bg-gray),
    :global(.helio-widget .helio-bg-grey) {
      background-color: #1e293b !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
    }
    
    /* Improve dropdown indicators */
    :global(.helio-dropdown-arrow-zone),
    :global(.helio-dropdown-clear-zone) {
      color: white !important;
    }
    
    :global(.helio-dropdown-menu-list) {
      padding: 8px !important;
    }
    
    :global(.helio-dropdown-input) {
      color: white !important;
    }
    
    /* Fix active selected option */
    :global(.helio-dropdown-option.helio-dropdown-option--is-selected) {
      background-color: rgba(99, 102, 241, 0.3) !important;
    }
    
    /* Fix the currency amount display */
    :global(.helio-widget .helio-amount) {
      color: white !important;
      font-weight: bold !important;
    }
    
    /* Ensure all interactive elements have good contrast */
    :global(.helio-widget input),
    :global(.helio-widget textarea) {
      background-color: #1e293b !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      color: white !important;
    }
    
    :global(.helio-widget input:focus),
    :global(.helio-widget textarea:focus) {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3) !important;
    }
    
    /* Fix toggle buttons and switches */
    :global(.helio-widget .helio-toggle-active) {
      background-color: #6366f1 !important;
    }
    
    /* Fix dividers and separators */
    :global(.helio-widget .helio-divider),
    :global(.helio-widget hr) {
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    
    /* Content fade animation for tab switching */
    @keyframes contentFade {
      0% {
        opacity: 0;
        transform: translateY(10px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .content-container, .checkout-container {
      animation: contentFade 0.3s ease-out forwards;
    }
    
    /* Tab animations */
    .tab-container {
      animation: contentFade 0.3s ease-out 0.15s forwards;
      opacity: 0;
    }
    
    .modal-close {
      animation: fadeIn 0.3s ease-out 0.2s forwards;
      opacity: 0;
    }
    
    /* Animated tab transitions */
    .tab-button-container {
      transition: all 0.3s ease;
    }
    
    .tab-button {
      transition: background 0.3s ease, transform 0.15s ease;
    }
    
    .tab-button:active {
      transform: scale(0.97);
    }
    
    /* Glowing effect animation */
    @keyframes pulse {
      0% {
        opacity: 0.4;
      }
      50% {
        opacity: 0.7;
      }
      100% {
        opacity: 0.4;
      }
    }
    
    .tab-button-container.active .tab-button-glow {
      animation: pulse 3s infinite ease-in-out;
    }
    
    /* Animated border for active tab */
    @keyframes rotate {
      100% {
        transform: translate(-50%, -50%) rotate(450deg);
      }
    }
    
    /* Highlight for subscribe tab */
    .tab-button-container.highlight .tab-button-glow {
      animation: pulseHighlight 1.5s infinite ease-in-out;
      opacity: 0.9;
    }
    
    @keyframes pulseHighlight {
      0% {
        opacity: 0.6;
        filter: blur(8px);
      }
      50% {
        opacity: 1;
        filter: blur(12px);
      }
      100% {
        opacity: 0.6;
        filter: blur(8px);
      }
    }
    
    /* Plan selection styles */
    .plan-selector {
      margin: 0.5rem 1rem 1rem; /* Reduced bottom margin */
      display: flex;
      background: rgba(15, 10, 40, 0.6);
      border-radius: 10px;
      padding: 0.25rem;
      position: relative;
      z-index: 1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .plan-option {
      flex: 1;
      padding: 0.5rem 0.25rem;
      text-align: center;
      cursor: pointer;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
      transition: all 0.2s ease;
      position: relative;
      z-index: 2;
    }
    
    .plan-option:hover {
      color: white;
    }
    
    .plan-option.active {
      background: #111827;
      color: white;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    .plan-option .plan-name {
      font-weight: 600;
      display: block;
      margin-bottom: 0.15rem;
    }
    
    .plan-option .plan-description {
      font-size: 0.7rem;
      opacity: 0.8;
    }
    
    /* Animation for plan switching */
    .checkout-container.switch-plan {
      animation: fadeScale 0.3s ease-out forwards;
    }
    
    @keyframes fadeScale {
      0% {
        opacity: 0.5;
        transform: scale(0.98);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
    
    /* Responsive styles for mobile */
    @media (max-width: 480px) {
      .glowing-input {
        height: 50px;
        font-size: 16px;
      }
      
      .search-button {
        top: 5px !important;
      }
      
      .button-border {
        top: 4px;
      }
      
      .tab-button-outer {
        height: 38px;
      }
      
      .tab-button {
        font-size: 0.9rem;
      }
      
      .plan-option {
        padding: 0.4rem 0.2rem;
      }
      
      .result-message {
        font-size: 0.8rem;
        padding: 0.6rem;
      }
      
      .verification-info {
        margin-top: 0.75rem;
        gap: 0.5rem;
      }
    }
  `;

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
      <style>{customStyle}</style>
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