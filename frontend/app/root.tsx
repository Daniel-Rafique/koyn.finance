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
import { SubscriptionProvider } from "./context/SubscriptionContext";
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
          <SubscriptionProvider>
            <RouteChangeHandler />
            {/* <Tracking /> */}
            {children}
          </SubscriptionProvider>
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

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}