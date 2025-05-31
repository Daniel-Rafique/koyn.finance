import React, { createContext, useContext, useState, useCallback, useSyncExternalStore, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  email: string;
  plan: string;
  isActive: boolean;
  subscriptionId?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isSubscribed: boolean;
  userEmail: string | null;
  isLoading: boolean;
  login: (authData: { auth: AuthTokens; user: User }) => void;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
  verifySubscription: (email?: string) => Promise<void>;
  getSecureAccessToken: () => Promise<string | null>;
}

// Secure token storage keys - only refresh token in localStorage as fallback
const REFRESH_TOKEN_KEY = 'koyn_refresh_token';
const USER_DATA_KEY = 'koyn_user_data';

// Remove access token from localStorage - it should only be in memory
// const ACCESS_TOKEN_KEY = 'koyn_access_token'; // REMOVED for security
const TOKEN_EXPIRY_KEY = 'koyn_token_expiry';

// Simple external store for auth state
class AuthStore {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
  };
  
  // Keep access token in memory only for security
  private accessTokenInMemory: string | null = null;
  
  // Track initialization state
  private isInitialized: boolean = false;
  
  private listeners = new Set<() => void>();

  constructor() {
    // Only initialize from storage on client
    if (typeof window !== 'undefined') {
      this.initializeFromStorage();
    } else {
      // On server, mark as initialized immediately
      this.isInitialized = true;
    }
  }

  private initializeFromStorage() {
    try {
      // SECURITY: Don't read access token from localStorage
      // const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY); // REMOVED
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      const userData = localStorage.getItem(USER_DATA_KEY);

      // Only restore state if we have refresh token and user data
      // Access token will be refreshed on first API call
      if (refreshToken && userData) {
        const user = JSON.parse(userData);
        
        this.state = {
          isAuthenticated: true,
          user,
          tokens: {
            accessToken: '', // Will be refreshed
            refreshToken,
            expiresIn: 0, // Will be set after refresh
            tokenType: 'Bearer'
          }
        };
        
        console.log('🔄 Auth state restored from storage - access token will be refreshed');
      }
      
      // Mark as initialized after attempting to restore state
      this.isInitialized = true;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize auth from storage:', error);
      this.clearStorage();
      this.isInitialized = true;
      this.notifyListeners();
    }
  }

  private clearStorage() {
    if (typeof window !== 'undefined') {
      // Clear access token from memory
      this.accessTokenInMemory = null;
      
      // Clear localStorage
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      
      // Clear legacy items
      localStorage.removeItem('koyn_subscription');
      localStorage.removeItem('koyn_sbscripton');
      localStorage.removeItem('koyn_access_token'); // Clear legacy access token
    }
  }

  private updateStorage() {
    if (typeof window !== 'undefined' && this.state.tokens && this.state.user) {
      // SECURITY: Only store refresh token and user data in localStorage
      // Access token stays in memory only
      localStorage.setItem(REFRESH_TOKEN_KEY, this.state.tokens.refreshToken);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(this.state.user));
      
      const expiryTime = Date.now() + (this.state.tokens.expiresIn * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AuthState => {
    return this.state;
  };

  login = (authData: { auth: AuthTokens; user: User }) => {
    this.state = {
      isAuthenticated: true,
      user: authData.user,
      tokens: authData.auth,
    };
    
    // Store access token in memory only
    this.accessTokenInMemory = authData.auth.accessToken;
    
    this.updateStorage();
    this.notifyListeners();
    console.log('✅ User logged in securely:', authData.user.email);
  };

  logout = () => {
    this.state = {
      isAuthenticated: false,
      user: null,
      tokens: null,
    };
    
    // Clear access token from memory
    this.accessTokenInMemory = null;
    
    this.clearStorage();
    this.notifyListeners();
    console.log('✅ User logged out securely');
  };

  updateTokens = (tokens: AuthTokens) => {
    if (this.state.isAuthenticated) {
      this.state = {
        ...this.state,
        tokens,
      };
      
      // Update access token in memory
      this.accessTokenInMemory = tokens.accessToken;
      
      this.updateStorage();
      this.notifyListeners();
    }
  };

  updateUser = (user: User) => {
    if (this.state.isAuthenticated) {
      this.state = {
        ...this.state,
        user,
      };
      this.updateStorage();
      this.notifyListeners();
    }
  };

  getAccessToken = (): string | null => {
    // SECURITY: Return access token from memory, not localStorage
    return this.accessTokenInMemory;
  };

  getRefreshToken = (): string | null => {
    return this.state.tokens?.refreshToken || null;
  };

  isTokenExpired = (): boolean => {
    // If no access token in memory, consider it expired
    if (!this.accessTokenInMemory) return true;
    
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

  getInitialized = (): boolean => {
    return this.isInitialized;
  };
}

// Create a singleton store
const authStore = new AuthStore();

// SECURITY: Expose auth store globally for secure token access
if (typeof window !== 'undefined') {
  (window as any).__authStore = authStore;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use React 19's useSyncExternalStore for clean state management
  const authState = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    // Server-side snapshot (always unauthenticated)
    () => ({ isAuthenticated: false, user: null, tokens: null })
  );

  // Track loading state separately from the auth store
  const [isLoading, setIsLoading] = useState(false);
  
  // Track initialization state - this prevents subscription modal from showing too early
  const [isInitializing, setIsInitializing] = useState(true);

  // Check if auth store is initialized
  const isStoreInitialized = authStore.getInitialized();

  // Update initialization state when auth store finishes initializing
  useEffect(() => {
    if (isStoreInitialized && isInitializing) {
      setIsInitializing(false);
      console.log('🔄 Auth initialization complete');
    }
  }, [isStoreInitialized, isInitializing]);

  // SECURITY: Function to get access token with automatic refresh
  const getSecureAccessToken = useCallback(async (): Promise<string | null> => {
    // First, try to get token from memory
    let accessToken = authStore.getAccessToken();
    
    if (accessToken && !authStore.isTokenExpired()) {
      console.log('🔐 Using valid in-memory access token');
      return accessToken;
    }
    
    // Token expired or missing, try to refresh
    console.log('🔄 Access token expired or missing, attempting refresh...');
    const refreshed = await refreshAuth();
    
    if (refreshed) {
      accessToken = authStore.getAccessToken();
      console.log('✅ Access token refreshed successfully');
      return accessToken;
    }
    
    console.log('❌ Failed to refresh access token');
    return null;
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    // Note: Refresh token is now in httpOnly cookie, no need to get it from storage
    console.log('🔄 Refreshing access token using httpOnly cookie...');

    try {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      const refreshUrl = `${protocol}//${hostname}${port}/api/auth/refresh`;

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // SECURITY: Include httpOnly cookies
        // No body needed - refresh token is in httpOnly cookie
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Token refresh failed:', response.status, errorData);
        
        // Handle specific error cases
        if (response.status === 401 && errorData.code === 'REFRESH_TOKEN_REQUIRED') {
          console.log('🔄 No refresh token found - user needs to log in again');
        } else if (response.status === 403 && errorData.code === 'REFRESH_TOKEN_NOT_FOUND') {
          console.log('🔄 Refresh token not found in server store - server may have restarted');
        } else if (response.status === 403 && errorData.code === 'REFRESH_TOKEN_INVALID') {
          console.log('🔄 Refresh token is invalid or expired');
        } else if (response.status === 403 && errorData.code === 'SUBSCRIPTION_INACTIVE') {
          console.log('🔄 Subscription is no longer active');
        }
        
        // Clear auth state for any refresh failure
        authStore.logout();
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.auth) {
        // Update tokens (only access token since refresh token is in cookie)
        authStore.updateTokens({
          accessToken: data.auth.accessToken,
          refreshToken: '', // Not stored anymore
          expiresIn: data.auth.expiresIn,
          tokenType: data.auth.tokenType
        });
        
        // Update user data if provided
        if (data.user) {
          authStore.updateUser(data.user);
        }
        
        console.log('✅ Access token refreshed successfully');
        return true;
      } else {
        console.log('❌ Refresh response invalid:', data);
        authStore.logout();
        return false;
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      
      // Only logout on network errors if we're sure the user isn't authenticated
      // This prevents logging out users due to temporary network issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log('🌐 Network error during token refresh - keeping user logged in for now');
        return false;
      }
      
      authStore.logout();
      return false;
    }
  }, []);

  const verifySubscription = useCallback(async (email?: string): Promise<void> => {
    const emailToVerify = email || authState.user?.email;
    if (!emailToVerify) {
      console.log('No email provided for verification');
      return;
    }

    setIsLoading(true);
    try {
      // This is primarily for backwards compatibility
      // The actual verification happens during login/refresh
      console.log('Verifying subscription for:', emailToVerify);
      
      // If we already have tokens and user data, we're verified
      if (authState.isAuthenticated && authState.user?.isActive) {
        console.log('Subscription already verified');
        return;
      }

      // Try to refresh auth to get latest subscription status
      await refreshAuth();
    } catch (error) {
      console.error('Error verifying subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated, authState.user, refreshAuth]);

  const login = useCallback((authData: { auth: AuthTokens; user: User }) => {
    authStore.login(authData);
  }, []);

  const logout = useCallback(async () => {
    // Call server logout to clear httpOnly cookies
    try {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3005' : ':3005';
      const logoutUrl = `${protocol}//${hostname}${port}/api/auth/logout`;
      
      await fetch(logoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // SECURITY: Include httpOnly cookies for clearing
      });
      
      console.log('✅ Server logout completed');
    } catch (error) {
      console.error('Error during server logout:', error);
    }

    // Clear local state
    authStore.logout();
  }, []);

  const contextValue: AuthContextType = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isSubscribed: authState.user?.isActive || false,
    userEmail: authState.user?.email || null,
    isLoading: isLoading || isInitializing, // Include initialization in loading state
    login,
    logout,
    refreshAuth,
    verifySubscription,
    getSecureAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Backwards compatibility - export the same hook name
export const useSubscription = useAuth; 