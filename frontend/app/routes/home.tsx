import React from "react";
import type { Route } from "./+types/home";
import SearchForm from "../components/SearchForm";
import SubscriptionModal from "../components/SubscriptionModal";
import NewsCarousel from "../components/NewsCarousel";
import { useAuth } from "../context/AuthProvider";
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router";
import { Routes } from "../utils/routes";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import "../styles/home.css";
import "../styles/glowing-input.css";
import "../styles/news-carousel-solid.css";
import { performTestLogin, clearTestAuth, isDevelopment } from "../utils/testAuth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Koyn - Financial Analysis for Crypto, Stocks, and more" },
    { name: "description", content: "Get real-time insights on cryptocurrencies and financial markets" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const [hasStoredResults, setHasStoredResults] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  // Get subscription context - updated to use new secure interface
  const { 
    isSubscribed,
    user,
    userEmail,
    isLoading: contextLoading,
    login
  } = useAuth();

  // Test login function for development
  const handleTestLogin = () => {
    const authData = performTestLogin();
    if (authData) {
      login(authData);
      console.log('✅ Test login successful! You are now authenticated with subscription data.');
    }
  };

  const handleTestLogout = () => {
    clearTestAuth();
    window.location.reload(); // Force reload to clear AuthProvider state
  };

  // Effect to handle client-side mounting
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Check if there are any stored results
  useEffect(() => {
    if (!isClientMounted) return;
    try {
      const storedResults = localStorage.getItem('koyn_analysis_results');
      const hasResults = storedResults ? JSON.parse(storedResults).length > 0 : false;
      setHasStoredResults(hasResults);
      console.log('Has stored analysis results:', hasResults);
    } catch (error) {
      console.error('Error checking stored results:', error);
      setHasStoredResults(false);
    }
  }, [isClientMounted]);

  // Handle back button click - use direct browser navigation instead of React Router
  const handleBackToAnalysis = () => {
    try {
      console.log('Navigating back to analysis page using direct browser navigation');
      // Use direct browser navigation instead of React Router
      window.location.href = '/app/analysis';
    } catch (error) {
      console.error('Error navigating to analysis:', error);
      
      // Try to click the fallback link
      try {
        console.log('Trying fallback link navigation');
        const fallbackLink = document.getElementById('analysis-fallback-link') as HTMLAnchorElement;
        if (fallbackLink) {
          fallbackLink.click();
        } else {
          // Last resort
          window.location.replace('/app/analysis');
        }
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError);
        window.location.replace('/app/analysis');
      }
    }
  };

  // Subscription modal handlers
  const openSubscriptionModal = () => {
    setIsSubscriptionModalOpen(true);
  };

  const closeSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
  };

  const handleSubscriptionSuccess = (event: any) => {
    console.log('Subscription success:', event);
    closeSubscriptionModal();
    // The new secure system handles authentication automatically
  };

  // Check authentication status on mount and clean up legacy data
  useEffect(() => {
    if (!isClientMounted) return;
    // Remove any legacy insecure subscription data
    try {
      const legacyData = localStorage.getItem('koyn_subscription');
      if (legacyData) {
        console.warn('🚨 SECURITY: Removing legacy insecure subscription data from home page');
        localStorage.removeItem('koyn_subscription');
      }
    } catch (error) {
      console.error('Error cleaning up legacy data:', error);
    }

    // The new secure context automatically handles authentication verification
    // No need for manual verification calls here
  }, [isClientMounted]);
  
  // Load premium test script in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      const script = document.createElement('script');
      script.src = '/js/subscription-test.js';
      script.async = true;
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);
  
  // Initialize particles effect
  useEffect(() => {
    const canvas = document.getElementById('particles-canvas') as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Add overflow-y-hidden to body on mobile to prevent unwanted scrollbars
        // But only on the home page (not analysis page)
        if (window.innerWidth <= 768 && window.location.pathname === Routes.HOME) {
          document.body.style.overflowY = 'hidden';
        }
        
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
        const handleResize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          
          // Update overflow settings on resize
          if (window.innerWidth <= 768 && window.location.pathname === Routes.HOME) {
            document.body.style.overflowY = 'hidden';
          } else {
            document.body.style.overflowY = '';
          }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Return cleanup function to reset styles and remove listeners when component unmounts
        return () => {
          window.removeEventListener('resize', handleResize);
          document.body.style.overflowY = '';
        };
      }
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-[rgb(0,0,0)] overflow-x-hidden">
      <Nav />
      {/* Particles canvas for background effect */}
      <canvas id="particles-canvas" className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none"></canvas>
      
      {/* Development test buttons */}
      {isDevelopment() && isClientMounted && (
        <div className="fixed top-4 right-4 z-30 space-y-2">
          {!isSubscribed ? (
            <button
              onClick={handleTestLogin}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              title="Test login with subscription data"
            >
              🧪 Test Login
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-green-800 text-white px-3 py-1 rounded text-sm">
                ✅ {user?.email}
              </div>
              <button
                onClick={handleTestLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm w-full"
                title="Clear test authentication"
              >
                🧪 Logout
              </button>
            </div>
          )}
        </div>
      )}

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] max-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back to Analysis button - repositioned to top-right corner as a floating button */}
        {hasStoredResults && (
          <div className="absolute top-4 left-4 z-20">
            <a
              href="/app/analysis"
              className="flex items-center text-[#ffffff] hover:text-white transition-colors text-sm px-3"
              aria-label="Return to previous analysis"
              onClick={(e) => {
                // Still handle the click event to get logging
                e.preventDefault();
                console.log('Analysis link clicked');
                handleBackToAnalysis();
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
              Back to Analysis
            </a>
            
            {/* Hidden anchor tag as fallback */}
            <a 
              href="/app/analysis"
              className="hidden"
              id="analysis-fallback-link"
              aria-hidden="true"
            >
              Back to Analysis
            </a>
          </div>
        )}
        <div className="w-full max-w-3xl">
          {/* Main headline with keywords for SEO */}
          <div className="mb-4 text-center">
          </div>
          <SearchForm 
            onSubscribeClick={() => openSubscriptionModal()}
            isSubscribed={isSubscribed} 
          />
        </div>
      </main>
      
      {/* Subscription Modal */}
      {(isSubscribed === false) && (
        <SubscriptionModal 
          isOpen={isSubscriptionModalOpen} 
          onClose={closeSubscriptionModal} 
          onSuccess={handleSubscriptionSuccess}
        />
      )}
      
      {/* News Ticker at the bottom */}
      <div className="fixed bottom-0 left-0 w-full z-10">
        <NewsCarousel 
          accounts={["business", "bitcoin", "crypto", "economics", "markets", "solana", "koynlabs", "koyn_ai"]} 
        />
      </div>
    </div>
  );
}