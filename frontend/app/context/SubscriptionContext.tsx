import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  email: string;
  plan: string;
  isActive: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface SubscriptionContextType {
  isSubscribed: boolean;
  user: User | null;
  userEmail: string | null;
  isLoading: boolean;
  verifySubscription: (email?: string) => Promise<boolean>;
  login: (authData: { auth: AuthTokens; user: User }) => void;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Secure token storage keys
const ACCESS_TOKEN_KEY = 'koyn_access_token';
const REFRESH_TOKEN_KEY = 'koyn_refresh_token';
const TOKEN_EXPIRY_KEY = 'koyn_token_expiry';

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenRefreshTimer, setTokenRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Get stored access token
  const getAccessToken = (): string | null => {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  };

  // Get stored refresh token
  const getRefreshToken = (): string | null => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  };

  // Check if access token is expired
  const isTokenExpired = (): boolean => {
    try {
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryTime) return true;
      
      const expiry = parseInt(expiryTime);
      const now = Date.now();
      const bufferTime = 60 * 1000; // 1 minute buffer
      
      return now >= (expiry - bufferTime);
    } catch {
      return true;
    }
  };

  // Store auth tokens securely
  const storeAuthTokens = (authData: AuthTokens) => {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
      
      // Calculate expiry timestamp
      const expiryTime = Date.now() + (authData.expiresIn * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      console.log('🔐 Auth tokens stored securely');
    } catch (error) {
      console.error('Failed to store auth tokens:', error);
    }
  };

  // Clear all auth data
  const clearAuthData = () => {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      
      // Clear any legacy insecure data
      localStorage.removeItem('koyn_subscription');
      localStorage.removeItem('koyn_sbscripton'); // Also clear the typo version
      
      console.log('🧹 Auth data cleared');
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  // Make authenticated API request
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const accessToken = getAccessToken();
    
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Construct the full URL based on endpoint type
    let fullUrl: string;
    if (url.startsWith('/api/auth/')) {
      // Auth endpoints go to verification API server (port 3005)
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      fullUrl = `${protocol}//${hostname}${port}${url}`;
    } else {
      // Other API endpoints use relative URLs (handled by nginx or direct API)
      fullUrl = url;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    };

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    // If token is invalid, try to refresh
    if (response.status === 403 || response.status === 401) {
      const refreshed = await refreshAuth();
      if (refreshed) {
        // Retry with new token
        const newAccessToken = getAccessToken();
        return fetch(fullUrl, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${newAccessToken}`,
          },
        });
      } else {
        // Refresh failed, user needs to re-authenticate
        throw new Error('Authentication failed');
      }
    }

    return response;
  };

  // Refresh access token using refresh token
  const refreshAuth = async (): Promise<boolean> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        console.log('❌ No refresh token available');
        return false;
      }

      console.log('🔄 Refreshing access token...');

      // Auth refresh endpoint goes to verification API server (port 3005)
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      const refreshUrl = `${protocol}//${hostname}${port}/api/auth/refresh`;

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.log('❌ Token refresh failed:', response.status);
        await logout();
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.auth) {
        // Update stored access token
        localStorage.setItem(ACCESS_TOKEN_KEY, data.auth.accessToken);
        const expiryTime = Date.now() + (data.auth.expiresIn * 1000);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        
        // Update user data
        setUser(data.user);
        
        console.log('✅ Access token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      await logout();
      return false;
    }
  };

  // Verify subscription status using secure endpoint
  const verifySubscription = async (email?: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // If no access token, try to refresh
      if (!getAccessToken() || isTokenExpired()) {
        const refreshed = await refreshAuth();
        if (!refreshed) {
          setIsSubscribed(false);
          setUser(null);
          setIsLoading(false);
          return false;
        }
      }

      // Use secure authenticated endpoint
      const response = await makeAuthenticatedRequest('/api/auth/subscription');

      if (!response.ok) {
        console.log('❌ Subscription verification failed');
        setIsSubscribed(false);
        setUser(null);
        return false;
      }

      const data = await response.json();

      if (data.success && data.user?.isActive) {
        setUser(data.user);
        setIsSubscribed(true);
        console.log('✅ Subscription verified:', data.user.email);
        return true;
      } else {
        setIsSubscribed(false);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error verifying subscription:', error);
      setIsSubscribed(false);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login with auth tokens
  const login = (authData: { auth: AuthTokens; user: User }) => {
    storeAuthTokens(authData.auth);
    setUser(authData.user);
    setIsSubscribed(true);
    
    // Set up automatic token refresh
    scheduleTokenRefresh(authData.auth.expiresIn);
    
    console.log('✅ User logged in securely:', authData.user.email);
  };

  // Logout and clear all data
  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();
      
      // Invalidate refresh token on server
      if (refreshToken) {
        // Auth logout endpoint goes to verification API server (port 3005)
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
        const logoutUrl = `${protocol}//${hostname}${port}/api/auth/logout`;
        
        await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Clear local auth data
    clearAuthData();
    setUser(null);
    setIsSubscribed(false);
    
    // Clear refresh timer
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      setTokenRefreshTimer(null);
    }
    
    console.log('✅ User logged out');
  };

  // Schedule automatic token refresh
  const scheduleTokenRefresh = (expiresIn: number) => {
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
    }

    // Refresh token 2 minutes before expiry
    const refreshTime = Math.max(0, (expiresIn - 120) * 1000);
    
    const timer = setTimeout(async () => {
      console.log('⏰ Auto-refreshing token...');
      await refreshAuth();
    }, refreshTime);

    setTokenRefreshTimer(timer);
  };

  // Check authentication status on mount and handle legacy data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Clear any legacy insecure subscription data
        const legacyData = localStorage.getItem('koyn_subscription') || localStorage.getItem('koyn_sbscripton');
        if (legacyData) {
          console.warn('🚨 SECURITY: Removing legacy insecure subscription data');
          localStorage.removeItem('koyn_subscription');
          localStorage.removeItem('koyn_sbscripton');
        }

        // Check if we have valid tokens
        const accessToken = getAccessToken();
        const refreshToken = getRefreshToken();

        if (!accessToken || !refreshToken) {
          console.log('📝 No valid tokens found');
          setIsLoading(false);
          return;
        }

        // Try to verify current session
        const isValid = await verifySubscription();
        
        if (isValid) {
          // Schedule token refresh for current session
          const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
          if (expiryTime) {
            const remainingTime = Math.max(0, parseInt(expiryTime) - Date.now()) / 1000;
            scheduleTokenRefresh(remainingTime);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Cleanup on unmount
    return () => {
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer);
      }
    };
  }, []);

  const value: SubscriptionContextType = {
    isSubscribed,
    user,
    userEmail: user?.email || null,
    isLoading,
    verifySubscription,
    login,
    logout,
    refreshAuth,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}