/**
 * Debug utility for subscription testing - SECURE VERSION
 * Run this in your browser console to set secure authentication tokens manually
 * Updated to use JWT tokens instead of legacy localStorage data
 */

export function setTestSubscription(email = 'koynlabs@gmail.com') {
  console.warn('🚨 SECURITY: This is a development-only tool for testing secure authentication');
  console.warn('🚨 In production, users must authenticate through the proper verification flow');
  
  // Clear any legacy insecure data first
  cleanupLegacyData();
  
  // Generate mock secure tokens for testing
  const mockTokens = generateMockTokens(email, 'lifetime');
  
  // Store secure tokens
  localStorage.setItem('koyn_access_token', mockTokens.accessToken);
  localStorage.setItem('koyn_refresh_token', mockTokens.refreshToken);
  localStorage.setItem('koyn_token_expiry', mockTokens.expiryTime.toString());
  
  console.log(`✅ Set secure subscription tokens for ${email}`);
  console.log(`🔐 Access token expires in: ${Math.round((mockTokens.expiryTime - Date.now()) / 1000 / 60)} minutes`);
  console.log(`Please refresh the page to apply the changes`);
  
  return true;
}

export function clearSubscription() {
  // Clean up all auth data
  localStorage.removeItem('koyn_access_token');
  localStorage.removeItem('koyn_refresh_token');
  localStorage.removeItem('koyn_token_expiry');
  
  // Clean up any legacy data
  cleanupLegacyData();
  
  console.log('✅ Cleared all authentication data');
  console.log('Please refresh the page to apply the changes');
  
  return true;
}

// Clean up legacy insecure data
function cleanupLegacyData() {
  const legacyKeys = [
    'koyn_subscription',
    'koyn_sbscripton', // typo version
    'koyn_subscription_mode',
    'koyn_premium_mode'
  ];
  
  legacyKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🧹 Removed legacy insecure data: ${key}`);
    }
  });
}

// Generate mock JWT tokens for testing
function generateMockTokens(email, plan) {
  const now = Date.now();
  const expiryTime = now + (15 * 60 * 1000); // 15 minutes
  
  // Create mock JWT payload (in production, this would be signed by the server)
  const mockPayload = {
    email: email.toLowerCase(),
    plan: plan,
    sessionId: `test-session-${now}`,
    iat: Math.floor(now / 1000),
    exp: Math.floor(expiryTime / 1000)
  };
  
  // Create mock tokens (these are just base64 encoded for testing)
  const accessToken = 'mock.jwt.token.' + btoa(JSON.stringify(mockPayload));
  const refreshToken = 'mock.refresh.token.' + btoa(JSON.stringify({...mockPayload, type: 'refresh'}));
  
  return {
    accessToken,
    refreshToken,
    expiryTime
  };
} 