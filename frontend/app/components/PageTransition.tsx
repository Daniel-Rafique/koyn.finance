import React, { useState, useEffect, useRef } from 'react';
import { Loader } from './Loader';
import '../styles/page-transition.css';

interface PageTransitionProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ 
  isLoading, 
  children,
  message = "Analyzing market data..." 
}) => {
  // Track states separately from props to avoid race conditions
  const [showContent, setShowContent] = useState(!isLoading);
  const [showLoader, setShowLoader] = useState(isLoading);
  const [loadingMessages] = useState<string[]>([
    "Analyzing market data...",
    "Collecting sentiment signals...",
    "Processing financial indicators...",
    "Generating insights...",
    "Almost there..."
  ]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  
  // Use refs to track state and prevent race conditions
  const isMounted = useRef(true);
  const prevLoadingState = useRef(isLoading);
  
  // Simple cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle when isLoading changes
  useEffect(() => {
    // Log the state for debugging
    console.log('PageTransition: isLoading changed to', isLoading, 
      'prev:', prevLoadingState.current, 
      'showLoader:', showLoader, 
      'showContent:', showContent);
    
    // Clear any existing timers to avoid race conditions
    let messageInterval: NodeJS.Timeout | null = null;
    let showContentTimeout: NodeJS.Timeout | null = null;
    let hideLoaderTimeout: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      // When loading starts, immediately show the loader (most critical part)
      setShowLoader(true);
      
      // Start rotating loading messages
      messageInterval = setInterval(() => {
        if (isMounted.current) {
          setCurrentMessageIndex(prev => (prev + 1) % loadingMessages.length);
        }
      }, 2500);
      
      // If this is a new loading state, decide whether to hide content
      if (!prevLoadingState.current) {
        // Only hide content if this is our first time showing loader
        setShowContent(false);
      }
    } else {
      // When loading finishes
      if (prevLoadingState.current) {
        // Only run this transition when changing from loading->not loading
        
        // First hide loader (with slight delay)
        hideLoaderTimeout = setTimeout(() => {
          if (isMounted.current) {
            setShowLoader(false);
            
            // Then show content after loader is hidden
            showContentTimeout = setTimeout(() => {
              if (isMounted.current) {
                setShowContent(true);
              }
            }, 200);
          }
        }, 200);
      }
    }
    
    // Update previous loading state
    prevLoadingState.current = isLoading;
    
    // Clean up all timers
    return () => {
      if (messageInterval) clearInterval(messageInterval);
      if (showContentTimeout) clearTimeout(showContentTimeout);
      if (hideLoaderTimeout) clearTimeout(hideLoaderTimeout);
    };
  }, [isLoading, loadingMessages.length]); // Removed showContent from deps

  // Error boundary pattern
  try {
    return (
      <div className="page-transition-container">
        {/* Content section - always render but control visibility with CSS */}
        <div 
          className={`page-content ${showContent ? 'fade-in' : ''}`} 
          style={{ opacity: showContent ? 1 : 0 }}
        >
          {children}
        </div>
        
        {/* Loader overlay */}
        <div 
          className={`transition-overlay ${showLoader ? 'fade-in' : 'fade-out'}`}
          aria-hidden={!showLoader}
        >
          <div className="transition-content">
            <Loader />
            <div className="loading-message">
              <p>{loadingMessages[currentMessageIndex]}</p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error in PageTransition:", error);
    // Fallback render in case of error
    return <div className="page-content">{children}</div>;
  }
};

export default PageTransition; 