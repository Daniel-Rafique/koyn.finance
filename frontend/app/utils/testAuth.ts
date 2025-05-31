// Test authentication helper for development
// This helps simulate login with valid subscription data

export interface TestUser {
  email: string;
  plan: string;
  isActive: boolean;
}

export interface TestAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// Test user data based on subscriptions.json - REAL data from server
export const TEST_USER: TestUser = {
  email: "koynlabs@gmail.com", // This matches the subscription data
  plan: "monthly", 
  isActive: true
};

// Generate test JWT tokens (for development only)
export const generateTestTokens = (): TestAuthTokens => {
  const now = Date.now();
  const expiresIn = 3600; // 1 hour
  
  // Simple base64 encoded data for testing (NOT for production)
  const testAccessToken = btoa(JSON.stringify({
    email: TEST_USER.email,
    plan: TEST_USER.plan,
    isActive: TEST_USER.isActive,
    exp: now + (expiresIn * 1000),
    iat: now
  }));
  
  const testRefreshToken = btoa(JSON.stringify({
    email: TEST_USER.email,
    exp: now + (7 * 24 * 60 * 60 * 1000), // 7 days
    iat: now
  }));
  
  return {
    accessToken: `test.${testAccessToken}.signature`,
    refreshToken: `refresh.${testRefreshToken}.signature`,
    expiresIn,
    tokenType: 'Bearer'
  };
};

// Test login function for development
export const performTestLogin = () => {
  if (typeof window === 'undefined') return null;
  
  const tokens = generateTestTokens();
  const authData = {
    auth: tokens,
    user: TEST_USER
  };
  
  // Store in localStorage for AuthProvider to pick up
  localStorage.setItem('koyn_auth_tokens', JSON.stringify(tokens));
  localStorage.setItem('koyn_user', JSON.stringify(TEST_USER));
  localStorage.setItem('koyn_token_expiry', String(Date.now() + (tokens.expiresIn * 1000)));
  
  console.log('🧪 Test login performed for:', TEST_USER.email);
  console.log('🧪 Plan:', TEST_USER.plan);
  console.log('🧪 Active:', TEST_USER.isActive);
  console.log('🧪 This should match the subscription data on your server');
  
  return authData;
};

// Alternative: Directly simulate proper authentication for billing page testing
export const simulateRealAuth = () => {
  if (typeof window === 'undefined') return null;
  
  // This simulates what would happen with real authentication
  const realSubscriptionData = {
    email: "koynlabs@gmail.com",
    plan: "monthly",
    isActive: true,
    renewalDate: "2026-04-01T13:59:41.303Z", // Real date from server
    startedAt: "2025-03-01T13:59:41.303Z"
  };
  
  const tokens = generateTestTokens();
  
  // Store real-like authentication data
  localStorage.setItem('koyn_auth_tokens', JSON.stringify(tokens));
  localStorage.setItem('koyn_user', JSON.stringify(realSubscriptionData));
  localStorage.setItem('koyn_token_expiry', String(Date.now() + (tokens.expiresIn * 1000)));
  
  console.log('🎯 Real auth simulation for:', realSubscriptionData.email);
  console.log('🎯 Real renewal date:', realSubscriptionData.renewalDate);
  
  return {
    auth: tokens,
    user: realSubscriptionData
  };
};

// Clear test authentication
export const clearTestAuth = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('koyn_auth_tokens');
  localStorage.removeItem('koyn_user');
  localStorage.removeItem('koyn_token_expiry');
  
  console.log('🧪 Test authentication cleared');
};

// Check if we're in development mode
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development' || 
         (typeof window !== 'undefined' && window.location.hostname === 'localhost');
}; 