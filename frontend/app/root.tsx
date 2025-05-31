import React, { useEffect } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation
} from "react-router";

import type { Route } from "./+types/root";
import { AuthProvider } from "./context/AuthProvider";
// import Tracking from "./components/Tracking";
import "~/app.css";
import "./styles/glowing-input.css";
import "~/styles/analysis-results.css";
import "./styles/news-grid.css";
import "./styles/page-transition.css";

// Function to check if current path is a billing page
const isBillingPage = (pathname: string): boolean => {
  pathname = pathname.toLowerCase();
  return (
    pathname.includes('/app/billing')
  );
};

// Component to handle route changes and cleanup session storage flags
function RouteChangeHandler() {
  const location = useLocation();
  
  useEffect(() => {
    // Check if we're on a client-side environment
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        // If we're not on a billing page but the flag exists, remove it
        if (!isBillingPage(location.pathname)) {
          const onBillingPage = sessionStorage.getItem('on_billing_page');
          if (onBillingPage === 'true') {
            console.log('Not on billing page but flag exists, clearing billing page flag');
            sessionStorage.removeItem('on_billing_page');
          }
        }
      } catch (err) {
        console.error('Error cleaning up session storage:', err);
      }
    }
  }, [location.pathname]);
  
  return null;
}

// Custom error boundary for wrapping contexts that might throw
class SafeContextProvider extends React.Component<{ 
  children: React.ReactNode, 
  fallback?: React.ReactNode
}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Context provider error:', error);
    console.log('Error info:', info);
    
    // Log additional info that might help debug crossOrigin issues
    if (error.message.includes('crossOrigin')) {
      console.log('CrossOrigin error detected. This might be related to script loading.');
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.props.children;
    }
    return this.props.children;
  }
}

// Simple error boundary component to catch React errors
interface InternalErrorBoundaryProps {
  children: React.ReactNode;
}

interface InternalErrorBoundaryState {
  hasError: boolean;
}

class InternalErrorBoundary extends React.Component<InternalErrorBoundaryProps, InternalErrorBoundaryState> {
  constructor(props: InternalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): InternalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-white p-4">Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  // Favicon links with cache busting
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=2" },
  { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png?v=2" },
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png?v=2" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=2" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-LSMDJNYGH9"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          `
        }}>
        </script>
      </head>
      <body>
        <SafeContextProvider>
          <AuthProvider>
            <RouteChangeHandler />
            {/* <Tracking /> */}
            {children}
          </AuthProvider>
        </SafeContextProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  let errorCode = "500";

  if (isRouteErrorResponse(error)) {
    errorCode = error.status.toString();
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  // In development, show the detailed error
  if (import.meta.env.DEV && stack) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">{message}</h1>
        <p className="text-[#a099d8] mb-4">{details}</p>
        <pre className="w-full p-4 overflow-x-auto bg-gray-900 text-green-400 rounded">
          <code>{stack}</code>
        </pre>
      </main>
    );
  }

  // In production, show the custom error page
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0a21] to-[#1a1535] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-[#E5484D] mb-4">{errorCode}</div>
          <h1 className="text-2xl font-semibold text-white mb-2">{message}</h1>
          <p className="text-[#a099d8] text-sm leading-relaxed">
            {details}
          </p>
        </div>
        
        <div className="space-y-4">
          <a 
            href="/"
            className="inline-block w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-medium py-3 px-6 rounded-lg hover:from-[#7C3AED] hover:to-[#DB2777] transition-all duration-200 transform hover:scale-105"
          >
            Go Home
          </a>
          
          <button 
            onClick={() => window.location.reload()}
            className="inline-block w-full bg-[rgba(139,92,246,0.1)] text-[#8B5CF6] font-medium py-3 px-6 rounded-lg border border-[#8B5CF6] hover:bg-[rgba(139,92,246,0.2)] transition-all duration-200"
          >
            Try Again
          </button>
        </div>
        
        <div className="mt-8 text-xs text-[#6b7280]">
          If this problem persists, please{' '}
          <a 
            href="mailto:support@koyn.finance" 
            className="text-[#8B5CF6] hover:text-[#7C3AED] underline"
          >
            contact support
          </a>
        </div>
      </div>
    </div>
  );
}