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

import Tracking from "./components/Tracking";
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
             <Tracking /> 
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
  // In development, show detailed error for debugging
  if (import.meta.env.DEV && error && error instanceof Error) {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Development Error</h1>
        <p className="text-[#a099d8] mb-4">{error.message}</p>
        <pre className="w-full p-4 overflow-x-auto bg-gray-900 text-green-400 rounded">
          <code>{error.stack}</code>
        </pre>
      </main>
    );
  }

  // In production, redirect to appropriate error page
  let redirectPath = "/app/error";
  
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      redirectPath = "/app/404";
    } else {
      redirectPath = `/app/error?code=${error.status}`;
    }
  }

  // Use a client-side redirect to our error pages
  if (typeof window !== 'undefined') {
    window.location.href = redirectPath;
  }

  // Fallback for SSR
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0a21] to-[#1a1535] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-[#E5484D] mb-4">Error</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-[#a099d8] text-sm leading-relaxed">
            Redirecting to error page...
          </p>
        </div>
        
        <div className="space-y-4">
          <a 
            href="/"
            className="inline-block w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-medium py-3 px-6 rounded-lg hover:from-[#7C3AED] hover:to-[#DB2777] transition-all duration-200 transform hover:scale-105"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}