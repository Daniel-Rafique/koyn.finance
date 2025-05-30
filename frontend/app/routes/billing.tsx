import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useSubscription, SubscriptionProvider } from "../context/SubscriptionContext";
import { Routes } from "../utils/routes";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import "../styles/news-carousel-solid.css";
import "../styles/glowing-input.css";
import { HelioCheckout } from '@heliofi/checkout-react';
// Import the specific types from the Helio library
import type { HelioEmbedConfig } from '@heliofi/checkout-react';

interface Subscription {
  id: string;
  email: string;
  status: string;
  startedAt: string;
  renewalDate: string;
  transactionId?: string;
  plan: string;
  paymentMethod: string;
  amount?: number;
  currency?: string;
  renewedAt?: string;
  transactionDetails?: {
    id: string;
    paylinkId?: string;
    quantity?: number;
    createdAt?: string;
    paymentType?: string;
    meta?: {
      amount?: string;
      customerDetails?: {
        email?: string;
        country?: string;
        fullName?: string;
      };
      transactionStatus?: string;
      transactionSignature?: string;
      totalAmount?: string;
      currency?: {
        id?: string;
      };
    };
  };
}

// Create a wrapper component that includes the provider
function BillingWithProvider() {
  return (
    <SubscriptionProvider>
      <Billing />
    </SubscriptionProvider>
  );
}

function Billing() {
  const navigate = useNavigate();
  const { isSubscribed, userEmail, user, isLoading: contextLoading } = useSubscription();
  const [subscriptionDetails, setSubscriptionDetails] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track if we have a verified email even if no subscription
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  // Flag to prevent subscription modal from opening on this page
  const hasInitialized = useRef(false);
  // Flag to indicate if we're on the client (to safely use localStorage/sessionStorage)
  const [isClient, setIsClient] = useState(false);
  // State to track if user is cancelling their subscription
  const [isCancelling, setIsCancelling] = useState(false);
  // Track cancel error state
  const [cancelError, setCancelError] = useState<string | null>(null);
  
  // Set isClient flag after component mounts (which only happens in the browser)
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Cancel any subscription modal that might appear
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Close any subscription modal that might be open
    // closeSubscriptionModal(); // Removed - not available in context
    console.log('Billing page loaded - subscription status:', isSubscribed);
    
    // Only run once on mount
    const initializePage = async () => {
      if (isClient && userEmail) {
        setVerifiedEmail(userEmail);
        await fetchSubscriptionDetails(userEmail);
      } else {
        // Check for legacy localStorage data as fallback
        if (isClient) {
          const legacySubscription = localStorage.getItem('koyn_subscription');
          if (legacySubscription) {
            try {
              const parsedSubscription = JSON.parse(legacySubscription);
              if (parsedSubscription.email) {
                setVerifiedEmail(parsedSubscription.email);
                await fetchSubscriptionDetails(parsedSubscription.email);
              }
            } catch (error) {
              console.error('Failed to parse legacy subscription:', error);
            }
          }
        }
        setIsLoading(false);
      }
    };
    
    initializePage();
  }, [isSubscribed, isClient]);
  
  // Additional cleanup on component unmount
  useEffect(() => {
    // This additional effect ensures cleanup happens
    return () => {
      if (isClient && typeof sessionStorage !== 'undefined') {
        try {
          // Double-check removal of the flag
          sessionStorage.removeItem('on_billing_page');
          console.log('Removed billing page flag from session storage on unmount');
        } catch (err) {
          console.error('Error removing session storage in cleanup:', err);
        }
      }
    };
  }, [isClient]);

  useEffect(() => {
    // Check for any user identity - either from context or localStorage
    let emailToUse = userEmail;
    console.log('Checking for user email, current value:', emailToUse);
    
    // Skip this effect during server-side rendering
    if (!isClient) {
      console.log('Skipping localStorage check on server side');
      return;
    }
    
    if (!emailToUse) {
      try {
        // Try to find a verified email in localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          const storedData = localStorage.getItem('koyn_subscription');
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            if (parsedData.email) {
              emailToUse = parsedData.email;
              setVerifiedEmail(parsedData.email);
              console.log('Found verified email in localStorage:', emailToUse);
              
              // Check for special billing access flag
              if (parsedData.allowBillingAccess) {
                console.log('Found allowBillingAccess flag, ensuring billing page access');
              }
            }
          }
        } else {
          console.log('localStorage not available (likely server-side rendering)');
        }
      } catch (err) {
        console.error('Error reading from localStorage:', err);
      }
    }
    
    // If we have an email (from context or localStorage), fetch subscription details
    if (emailToUse) {
      console.log('Found email, fetching subscription details:', emailToUse);
      fetchSubscriptionDetails(emailToUse);
    } else {
      // No email found anywhere, redirect to home - user must verify email first
      console.log('No verified email found, redirecting to home');
      navigate(Routes.HOME);
    }
  }, [userEmail, navigate, isClient]);

  const fetchSubscriptionDetails = async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // First check if we have details from context
      if (user) {
        console.log('Using subscription details from context');
        // Convert user context to subscription format
        const contextSubscription: Subscription = {
          id: `user-${user.email}`,
          email: user.email,
          status: user.isActive ? 'active' : 'inactive',
          startedAt: new Date().toISOString(),
          renewalDate: new Date().toISOString(),
          plan: user.plan,
          paymentMethod: 'crypto'
        };
        setSubscriptionDetails(contextSubscription);
        setIsLoading(false);
        return;
      }
      
      // Otherwise fetch subscription details from the API
      console.log('Fetching subscription details for:', email);
      const response = await fetch(`/api/subscription/${encodeURIComponent(email)}?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription details: ${response.status}`);
      }

      const data = await response.json();
      console.log('API subscription response:', data);
      
      if (data.active && data.subscription) {
        // Found an active subscription
        setSubscriptionDetails(data.subscription);
      } else {
        // No active subscription, but we'll still show the billing page
        // with a basic inactive subscription representation
        console.log('No active subscription found, creating inactive record');
        setSubscriptionDetails({
          id: 'inactive-user',
          email: email,
          status: 'inactive',
          startedAt: new Date().toISOString(),
          renewalDate: new Date().toISOString(),
          transactionId: 'none',
          plan: 'none',
          paymentMethod: 'none'
        });
        setError("No active subscription found");
      }
    } catch (err) {
      console.error("Error fetching subscription details:", err);
      // Create a minimal record just so we can show something
      setSubscriptionDetails({
        id: 'error-fetching',
        email: email,
        status: 'inactive',
        startedAt: new Date().toISOString(),
        renewalDate: new Date().toISOString(),
        transactionId: 'unknown',
        plan: 'unknown',
        paymentMethod: 'unknown'
      });
      setError("Error loading subscription details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenewSubscription = (paylinkIdOrEvent: string | React.MouseEvent) => {
    console.log('Redirecting to direct checkout page');
    
    // Default paylink ID from the subscription data
    const defaultPaylinkId = '68229ffa2c8760f1eb3d19d7';
    let paylinkId = defaultPaylinkId;
    
    // If the parameter is a string (paylink ID), use it directly
    if (typeof paylinkIdOrEvent === 'string') {
      paylinkId = paylinkIdOrEvent;
    }
    // Otherwise, try to extract paylinkId from subscription details if available
    else if (subscriptionDetails?.transactionDetails?.paylinkId) {
      paylinkId = subscriptionDetails.transactionDetails.paylinkId;
    }
    
    // Navigate to the Helio payment link with the appropriate paylinkId
    window.open(`https://app.hel.io/pay/${paylinkId}`, '_blank');
  };

  const handleUpgradeDowngrade = () => {
    // Upgrade/downgrade functionality would go here
    console.log('Upgrade/downgrade feature not yet implemented');
    // For now, just show a message
    alert('Upgrade/downgrade functionality is not yet available. Please contact support for assistance.');
  };
  
  // Format currency amount
  const formatAmount = (amount?: number, currency = 'USDC') => {
    if (amount === undefined) return 'N/A';
    return `${amount.toFixed(2)} ${currency}`;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Get human-readable plan name
  const getPlanName = (planCode: string) => {
    const planNames = {
      'monthly': 'Monthly Plan',
      'quarterly': '3-Month Plan',
      'lifetime': 'Lifetime Plan',
      '3month': '3-Month Plan'
    };
    return planNames[planCode as keyof typeof planNames] || planCode;
  };

  // Determine subscription status class for styling
  const getStatusClass = (status: string) => {
    return status === 'active' ? 'text-white' : 'text-red-500';
  };

  // Add a function to get transaction status
  const getTransactionStatus = (details?: Subscription['transactionDetails']) => {
    if (!details || !details.meta) {
      return 'Completed'; // Default
    }
    
    return details.meta.transactionStatus || 'Completed';
  };

  // Function to check if renewal date has passed
  const hasRenewalDatePassed = (renewalDate: string): boolean => {
    try {
      const renewal = new Date(renewalDate);
      const today = new Date();
      return renewal < today;
    } catch (error) {
      console.error("Error parsing renewal date:", error);
      return false;
    }
  };

  // Function to calculate time remaining in subscription
  const getTimeRemaining = (renewalDate: string): string => {
    try {
      const renewal = new Date(renewalDate);
      const today = new Date();
      
      if (renewal < today) {
        return "Subscription has expired";
      }
      
      const diffTime = Math.abs(renewal.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) {
        const diffMonths = Math.floor(diffDays / 30);
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} remaining`;
      } else if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} remaining`;
      } else {
        return "Less than a day remaining";
      }
    } catch (error) {
      console.error("Error calculating time remaining:", error);
      return "Unknown";
    }
  };

  // Render expired subscription UI
  const renderExpiredSubscription = () => {
    // Determine which email to display
    const displayEmail = subscriptionDetails?.email || verifiedEmail || userEmail;
    
    // Default paylink ID
    const defaultPaylinkId = '68229ffa2c8760f1eb3d19d7';
    // Get paylink ID from subscription details if available
    const paylinkId = subscriptionDetails?.transactionDetails?.paylinkId || defaultPaylinkId;
    
    // Helio config objects for different plans
    const monthlyPlanConfig: HelioEmbedConfig = {
      paylinkId: "68229fd19009f0c6c3ff67f2", // Monthly plan ID
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    };
    
    const quarterlyPlanConfig: HelioEmbedConfig = {
      paylinkId: "68229fbd9483a433d5884b7c", // Quarterly plan ID
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    };
    
    const lifetimePlanConfig: HelioEmbedConfig = {
      paylinkId: "68229ffa2c8760f1eb3d19d7", // Lifetime plan ID
      theme: { themeMode: "dark" as const },
      primaryColor: "#111827",
      neutralColor: "#ffffff",
      display: "inline",
      onSuccess: (event: any) => handleSubscriptionSuccess(event),
      onError: (event: any) => console.log("Payment error:", event),
      onPending: (event: any) => console.log("Payment pending:", event),
      onCancel: () => console.log("Cancelled payment"),
      onStartPayment: () => console.log("Starting payment"),
    };
    
    // Function to handle subscription success
    const handleSubscriptionSuccess = (event: any) => {
      console.log("Subscription payment successful:", event);
      if (typeof window !== 'undefined') {
        // Force reload the page to reflect the new subscription status
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    };
    
    return (
      <div className="space-y-8">
        <h2 className="text-xl font-semibold text-white mb-4">Subscription Status</h2>
        <div className="text-center py-4 mb-8">
          <div className="mb-4">
            <span className="text-red-400 text-xl">No active subscription</span>
            <p className="text-[#ffffff] mt-2">
              You need an active subscription to use premium features.
            </p>
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
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
          gap: '2rem', 
          marginBottom: '2rem', 
          width: '100%',
          margin: '0 auto'
        }}>
          {/* Monthly Plan */}
          <div style={{ position: 'relative', padding: '1.5rem', borderRadius: '0.5rem' }}>
            <h3 className="text-lg font-semibold text-white mb-2">Monthly Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$10</span>
              <span className="text-[#ffffff] ml-1">/ month</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Unlimited search queries</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Real-time market sentiment analysis</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Full access to all features</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: 'initial', display: 'block' }}>
                <HelioCheckout config={monthlyPlanConfig} />
              </div>
            </div>
          </div>
          
          {/* Quarterly Plan */}
          <div style={{ position: 'relative', padding: '1.5rem', borderRadius: '0.5rem' }}>
            <div className="absolute -top-3 -right-3 bg-[#ffffff] text-white text-xs font-bold px-3 py-1 rounded-full">
              POPULAR
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Quarterly Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$25.00</span>
              <span className="text-[#ffffff] ml-1">/ 3 months</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Everything in monthly plan</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Priority support</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Save over 15% vs monthly</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: 'initial', display: 'block' }}>
                <HelioCheckout config={quarterlyPlanConfig} />
              </div>
            </div>
          </div>
          
          {/* Lifetime Plan */}
          <div style={{ position: 'relative', padding: '1.5rem', borderRadius: '0.5rem' }}>
            <h3 className="text-lg font-semibold text-white mb-2">Lifetime Plan</h3>
            <div className="mb-4">
              <span className="text-2xl font-bold text-white">$100</span>
              <span className="text-[#ffffff] ml-1">one-time</span>
            </div>
            <ul className="text-[#ffffff] space-y-2 mb-6 text-sm min-h-[100px]">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Lifetime access to all features</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>VIP support</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-white mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>All future updates included</span>
              </li>
            </ul>
            <div className="mt-auto">
              <div style={{ all: 'initial', display: 'block' }}>
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
    );
  };

  // Initialize particles effect
  useEffect(() => {
    // Skip during server-side rendering
    if (!isClient) return;
    
    const canvas = document.getElementById('particles-canvas') as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles: any[] = [];
        
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
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
          }
          
          draw() {
            if (ctx) {
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
              ctx.fillStyle = this.color;
              ctx.globalAlpha = 0.2;
              ctx.fill();
            }
          }
        }
        
        function createParticles() {
          for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
          }
        }
        
        function animateParticles() {
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < particles.length; i++) {
              particles[i].update();
              particles[i].draw();
            }
          }
          
          requestAnimationFrame(animateParticles);
        }
        
        createParticles();
        animateParticles();
        
        // Handle window resize
        window.addEventListener('resize', () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        });
      }
    }
  }, [isClient]); // Add isClient dependency to avoid running during server-side rendering

  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] overflow-x-hidden overflow-y-auto flex flex-col">
      <Nav />
      
      {/* Particles canvas for background effect */}
      <canvas id="particles-canvas" className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"></canvas>

      <main 
        className="max-w-[1200px] px-12 relative z-10 min-h-[calc(100vh-240px)] flex flex-col overflow-x-hidden pb-20 mx-0 lg:mx-auto"
      >
        <div className="mb-6 mt-6">
          <h1 className="text-2xl font-semibold text-white">Billing & Subscription</h1>
          <p className="text-[#ffffff] mt-2">Manage your subscription and payment details</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffffff]"></div>
          </div>
        ) : subscriptionDetails?.status !== 'active' || error ? (
          // Show expired/inactive subscription UI 
          renderExpiredSubscription()
        ) : subscriptionDetails ? (
          // Check that all required properties are present to avoid runtime errors
          <div className="space-y-8 mb-6">
            {/* Subscription Overview */}
            <h2 className="text-xl font-semibold text-white mb-4">Subscription Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Plan</span>
                  <span className="text-white font-medium">{getPlanName(subscriptionDetails.plan || 'unknown')}</span>
                </div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Status</span>
                  <span className={`font-medium ${getStatusClass(subscriptionDetails.status || 'inactive')}`}>
                    {subscriptionDetails.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Email</span>
                  <span className="text-white font-medium">{subscriptionDetails.email || 'No email provided'}</span>
                </div>
                {subscriptionDetails.transactionDetails?.meta?.customerDetails?.fullName && (
                  <div className="mb-4">
                    <span className="text-[#ffffff] block">Name</span>
                    <span className="text-white font-medium">{subscriptionDetails.transactionDetails.meta.customerDetails.fullName}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Started On</span>
                  <span className="text-white font-medium">{formatDate(subscriptionDetails.startedAt || new Date().toISOString())}</span>
                </div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Renewal Date</span>
                  <span className="text-white font-medium">{formatDate(subscriptionDetails.renewalDate || new Date().toISOString())}</span>
                  {subscriptionDetails.renewalDate && (
                    <span className={`text-xs block mt-1 ${hasRenewalDatePassed(subscriptionDetails.renewalDate) ? 'text-red-400' : 'text-green-400'}`}>
                      {getTimeRemaining(subscriptionDetails.renewalDate)}
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-[#ffffff] block">Payment Method</span>
                  <span className="text-white font-medium capitalize">{subscriptionDetails.paymentMethod || 'Unknown'}</span>
                </div>
                {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                  <div className="mb-4">
                    <span className="text-[#ffffff] block">Country</span>
                    <span className="text-white font-medium">{subscriptionDetails.transactionDetails.meta.customerDetails.country}</span>
                  </div>
                )}
              </div>
            </div>
            {subscriptionDetails.amount && (
              <div className="mt-4 pt-4 border-t border-[rgba(64,47,181,0.3)]">
                <span className="text-[#ffffff] block">Current Billing</span>
                <span className="text-white font-medium">{formatAmount(
                  subscriptionDetails.amount || 
                  (subscriptionDetails.transactionDetails?.meta?.totalAmount 
                    ? parseFloat(subscriptionDetails.transactionDetails.meta.totalAmount) / 1000000 
                    : undefined),
                  subscriptionDetails.currency || 
                  (subscriptionDetails.transactionDetails?.meta?.currency?.id || 'USDC')
                )}</span>
              </div>
            )}
            
            {/* Additional Transaction Details */}
            {subscriptionDetails.transactionDetails && (
              <div className="mt-4 pt-4 border-t border-[rgba(64,47,181,0.3)]">
                <h3 className="text-lg font-semibold text-white mb-3">Payment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subscriptionDetails.transactionDetails.paylinkId && (
                    <div>
                      <span className="text-[#ffffff] block">Paylink ID</span>
                      <span className="text-white font-medium font-mono text-sm">{subscriptionDetails.transactionDetails.paylinkId}</span>
                    </div>
                  )}
                  {subscriptionDetails.transactionDetails.paymentType && (
                    <div>
                      <span className="text-[#ffffff] block">Payment Type</span>
                      <span className="text-white font-medium">{subscriptionDetails.transactionDetails.paymentType}</span>
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
                <table className="min-w-full divide-y divide-white">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">Transaction ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">Status</th>
                      {subscriptionDetails.transactionDetails?.meta?.customerDetails?.country && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#ffffff] uppercase tracking-wider">Country</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white">
                    <tr>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {formatDate(subscriptionDetails.transactionDetails?.createdAt || subscriptionDetails.startedAt || new Date().toISOString())}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                        {subscriptionDetails.transactionId ? 
                          (subscriptionDetails.transactionId.length > 8 ? 
                            `${subscriptionDetails.transactionId.substring(0, 8)}...` : 
                            subscriptionDetails.transactionId) : 
                          'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                        {formatAmount(
                          subscriptionDetails.amount || 
                          (subscriptionDetails.transactionDetails?.meta?.totalAmount 
                            ? parseFloat(subscriptionDetails.transactionDetails.meta.totalAmount) / 1000000 
                            : undefined),
                          subscriptionDetails.currency || 
                          (subscriptionDetails.transactionDetails?.meta?.currency?.id || 'USDC')
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          getTransactionStatus(subscriptionDetails.transactionDetails) === 'SUCCESS' 
                            ? 'bg-white text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {getTransactionStatus(subscriptionDetails.transactionDetails) === 'SUCCESS' ? 'Completed' : getTransactionStatus(subscriptionDetails.transactionDetails)}
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
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white">{new Date(subscriptionDetails.renewedAt).toLocaleDateString()}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-mono">
                          {subscriptionDetails.transactionId ? 
                            (subscriptionDetails.transactionId.length > 8 ? 
                              `${subscriptionDetails.transactionId.substring(0, 8)}...` : 
                              subscriptionDetails.transactionId) : 
                            'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-white">{formatAmount(subscriptionDetails.amount, subscriptionDetails.currency)}</td>
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
              <div className="glowing-input-container button-container md:w-1/2" style={{ maxWidth: 'none', margin: '0' }}>
                <button 
                  onClick={() => {
                    const paylinkId = subscriptionDetails?.transactionDetails?.paylinkId || '68229ffa2c8760f1eb3d19d7';
                    handleRenewSubscription(paylinkId);
                  }}
                  disabled={!hasRenewalDatePassed(subscriptionDetails?.renewalDate || '')}
                  className={`subscribe-button text-white font-bold py-2 px-6 ${!hasRenewalDatePassed(subscriptionDetails?.renewalDate || '') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '40px', 
                    background: !hasRenewalDatePassed(subscriptionDetails?.renewalDate || '') 
                      ? 'linear-gradient(180deg, #465370, #363f52, #505e7e)' 
                      : 'linear-gradient(180deg, #135c36, #0e4429, #1d6f42)' 
                  }}
                  title={!hasRenewalDatePassed(subscriptionDetails?.renewalDate || '') ? "You can renew once your current subscription period ends" : "Renew your subscription"}
                >
                  Renew Subscription
                </button>
                <div className="button-border" style={{ width: '100%', height: '100%', top: 0, right: 0 }}></div>
              </div>
              
              <div className="glowing-input-container button-container md:w-1/2" style={{ maxWidth: 'none', margin: '0' }}>
                <button 
                  onClick={handleUpgradeDowngrade}
                  disabled={isSubscribed}
                  className={`subscribe-button text-white font-bold py-2 px-6 ${isSubscribed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '40px', 
                    background: isSubscribed 
                      ? 'linear-gradient(180deg, #465370, #363f52, #505e7e)' 
                      : 'linear-gradient(180deg, #263c87, #1c2d65, #2d4aa6)'
                  }}
                  title={isSubscribed ? "You can upgrade/downgrade when your current subscription ends" : "Change your subscription plan"}
                >
                  Upgrade/Downgrade
                </button>
                <div className="button-border" style={{ width: '100%', height: '100%', top: 0, right: 0 }}></div>
              </div>
            </div>
            
            <div className="text-sm text-[#ffffff] mt-2 space-y-2">
              {!hasRenewalDatePassed(subscriptionDetails?.renewalDate || '') && (
                <p>
                  Your subscription is active until {formatDate(subscriptionDetails?.renewalDate || '')}. 
                  You can renew after this date.
                </p>
              )}
              
              {isSubscribed && (
                <p>
                  Plan changes are not available while you have an active subscription. Please contact support for assistance.
                </p>
              )}
            </div>
            
            <p className="mt-6 text-sm text-[#ffffff]">
              Need help? Contact <a href="mailto:support@koyn.finance" className="text-[#ffffff] hover:underline">hi@koyn.finance</a>
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-yellow-200 mb-4">No subscription information available</p>
            <div className="flex justify-center">
              <div className="glowing-input-container button-container" style={{ maxWidth: '200px' }}>
                <button 
                  onClick={() => handleRenewSubscription('68229ffa2c8760f1eb3d19d7')}
                  className="subscribe-button text-white font-bold py-2 px-6"
                  style={{ position: 'relative', width: '100%', height: '40px', background: 'linear-gradient(180deg, #135c36, #0e4429, #1d6f42)' }}
                >
                  Subscribe Now
                </button>
                <div className="button-border" style={{ width: '100%', height: '100%', top: 0, right: 0 }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Debug information in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-10 text-xs text-gray-500 border-t border-gray-800 pt-4">
            <h4 className="font-semibold mb-2">Debug Info</h4>
            <div>
              <div><span className="font-mono">userEmail:</span> {userEmail || 'null'}</div>
              <div><span className="font-mono">verifiedEmail:</span> {verifiedEmail || 'null'}</div>
              <div><span className="font-mono">isSubscribed:</span> {isSubscribed}</div>
              <div><span className="font-mono">isClient:</span> {isClient ? 'true' : 'false'}</div>
              <div><span className="font-mono">localStorage:</span> {isClient ? (localStorage.getItem('koyn_subscription') ? 'has data' : 'empty') : 'not available (server)'}</div>
              <div><span className="font-mono">error:</span> {error || 'none'}</div>
              <div><span className="font-mono">cancelError:</span> {cancelError || 'none'}</div>
            </div>
          </div>
        )}
      </main>
      {/* Footer to ensure proper spacing */}
      <Footer />
    </div>
  );
}

// Export the wrapper component as the default export
export default BillingWithProvider;
