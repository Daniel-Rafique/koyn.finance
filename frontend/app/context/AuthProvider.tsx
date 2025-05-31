import React, { createContext, useContext, useState, useCallback, useSyncExternalStore } from 'react';
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
}

// Secure token storage keys
const ACCESS_TOKEN_KEY = 'koyn_access_token';
const REFRESH_TOKEN_KEY = 'koyn_refresh_token';
const TOKEN_EXPIRY_KEY = 'koyn_token_expiry';
const USER_DATA_KEY = 'koyn_user_data';

// Simple external store for auth state
class AuthStore {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
  };
  
  private listeners = new Set<() => void>();

  constructor() {
    // Only initialize from storage on client
    if (typeof window !== 'undefined') {
      this.initializeFromStorage();
    }
  }

  private initializeFromStorage() {
    try {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
      const userData = localStorage.getItem(USER_DATA_KEY);

      if (accessToken && refreshToken && userData && expiryTime) {
        const user = JSON.parse(userData);
        const expiry = parseInt(expiryTime);
        
        // Check if token is still valid (with 1 minute buffer)
        if (Date.now() < expiry - 60000) {
          this.state = {
            isAuthenticated: true,
            user,
            tokens: {
              accessToken,
              refreshToken,
              expiresIn: Math.floor((expiry - Date.now()) / 1000),
              tokenType: 'Bearer'
            }
          };
        } else {
          // Token expired, clear storage
          this.clearStorage();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth from storage:', error);
      this.clearStorage();
    }
  }

  private clearStorage() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      // Clear legacy items
      localStorage.removeItem('koyn_subscription');
      localStorage.removeItem('koyn_sbscripton');
    }
  }

  private updateStorage() {
    if (typeof window !== 'undefined' && this.state.tokens && this.state.user) {
      localStorage.setItem(ACCESS_TOKEN_KEY, this.state.tokens.accessToken);
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
    this.updateStorage();
    this.notifyListeners();
    console.log('✅ User logged in:', authData.user.email);
  };

  logout = () => {
    this.state = {
      isAuthenticated: false,
      user: null,
      tokens: null,
    };
    this.clearStorage();
    this.notifyListeners();
    console.log('✅ User logged out');
  };

  updateTokens = (tokens: AuthTokens) => {
    if (this.state.isAuthenticated) {
      this.state = {
        ...this.state,
        tokens,
      };
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
    return this.state.tokens?.accessToken || null;
  };

  getRefreshToken = (): string | null => {
    return this.state.tokens?.refreshToken || null;
  };

  isTokenExpired = (): boolean => {
    if (!this.state.tokens) return true;
    
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
}

// Create a singleton store
const authStore = new AuthStore();

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use React 19's useSyncExternalStore for clean state management
  const authState = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    // Server-side snapshot (always unauthenticated)
    () => ({ isAuthenticated: false, user: null, tokens: null })
  );

  const [isLoading, setIsLoading] = useState(false);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const refreshToken = authStore.getRefreshToken();
    if (!refreshToken) {
      console.log('❌ No refresh token available');
      authStore.logout();
      return false;
    }

    try {
      console.log('🔄 Refreshing access token...');

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
        authStore.logout();
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.auth) {
        // Update tokens
        authStore.updateTokens(data.auth);
        
        // Update user data if provided
        if (data.user) {
          authStore.updateUser(data.user);
        }
        
        console.log('✅ Access token refreshed successfully');
        return true;
      } else {
        console.log('❌ Refresh response invalid');
        authStore.logout();
        return false;
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
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
    const refreshToken = authStore.getRefreshToken();
    
    // Try to invalidate refresh token on server
    if (refreshToken) {
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
          body: JSON.stringify({ refreshToken }),
        });
      } catch (error) {
        console.error('Error during server logout:', error);
      }
    }

    authStore.logout();
  }, []);

  const contextValue: AuthContextType = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    isSubscribed: authState.user?.isActive || false,
    userEmail: authState.user?.email || null,
    isLoading,
    login,
    logout,
    refreshAuth,
    verifySubscription,
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