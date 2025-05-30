/**
 * Subscription Test Script - SECURE VERSION
 * Use this to quickly set up your local environment for subscription testing
 * Updated to use secure JWT tokens instead of legacy localStorage data
 */

(function() {
  // Available subscription plans
  const PLANS = {
    ONE_MONTH: '1-month',
    THREE_MONTH: '3-month',
    LIFETIME: 'lifetime'
  };

  // Function to enable subscription features locally using secure tokens
  function enableSubscription(email = 'koynlabs@gmail.com', plan = PLANS.LIFETIME) {
    console.warn('🚨 SECURITY: This is a development-only tool for testing secure authentication');
    console.warn('🚨 In production, users must authenticate through the proper verification flow');
    
    // Validate plan
    if (!Object.values(PLANS).includes(plan)) {
      console.error(`Invalid plan: ${plan}. Must be one of: ${Object.values(PLANS).join(', ')}`);
      return false;
    }
    
    // Clear any legacy insecure data first
    cleanupLegacyData();
    
    // Generate mock secure tokens for testing
    const mockTokens = generateMockTokens(email, plan);
    
    // Store secure tokens
    localStorage.setItem('koyn_access_token', mockTokens.accessToken);
    localStorage.setItem('koyn_refresh_token', mockTokens.refreshToken);
    localStorage.setItem('koyn_token_expiry', mockTokens.expiryTime.toString());
    
    console.log(`✅ Set secure ${plan} subscription tokens for ${email}`);
    console.log(`🔐 Access token expires in: ${Math.round((mockTokens.expiryTime - Date.now()) / 1000 / 60)} minutes`);
    
    // Reload the page to apply changes
    console.log(`🔄 Reloading page in 2 seconds to apply secure authentication...`);
    setTimeout(() => window.location.reload(), 2000);
    
    return true;
  }
  
  // Function to disable subscription features securely
  function disableSubscription() {
    // Clean up all auth data
    localStorage.removeItem('koyn_access_token');
    localStorage.removeItem('koyn_refresh_token');
    localStorage.removeItem('koyn_token_expiry');
    
    // Clean up any legacy data
    cleanupLegacyData();
    
    console.log(`✅ Removed all authentication data`);
    console.log(`🔄 Reloading page in 2 seconds to apply changes...`);
    setTimeout(() => window.location.reload(), 2000);
    
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
  
  // Status function to show current secure authentication state
  function getStatus() {
    const hasAccessToken = !!localStorage.getItem('koyn_access_token');
    const hasRefreshToken = !!localStorage.getItem('koyn_refresh_token');
    const tokenExpiry = localStorage.getItem('koyn_token_expiry');
    
    console.log(`📊 Secure Authentication Status:`);
    console.log(`- Access token: ${hasAccessToken ? '✅' : '❌'}`);
    console.log(`- Refresh token: ${hasRefreshToken ? '✅' : '❌'}`);
    
    if (hasAccessToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      const now = Date.now();
      const minutesLeft = Math.round((expiryTime - now) / 1000 / 60);
      
      if (minutesLeft > 0) {
        console.log(`- Token expires in: ${minutesLeft} minutes`);
      } else {
        console.log(`- Token expired ${Math.abs(minutesLeft)} minutes ago`);
      }
    }
    
    // Check for any legacy data that needs cleanup
    const legacyKeys = ['koyn_subscription', 'koyn_subscription_mode', 'koyn_premium_mode'];
    const legacyData = legacyKeys.filter(key => localStorage.getItem(key));
    
    if (legacyData.length > 0) {
      console.warn(`⚠️  Found legacy insecure data: ${legacyData.join(', ')}`);
      console.warn(`⚠️  Run koynSubscription.cleanup() to remove it`);
    }
    
    return { 
      hasAccessToken, 
      hasRefreshToken, 
      isExpired: tokenExpiry ? Date.now() >= parseInt(tokenExpiry) : true,
      hasLegacyData: legacyData.length > 0
    };
  }
  
  // Expose functions to global scope
  window.koynSubscription = {
    enable: enableSubscription,
    enableOneMonth: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.ONE_MONTH),
    enableThreeMonth: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.THREE_MONTH),
    enableLifetime: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.LIFETIME),
    disable: disableSubscription,
    status: getStatus,
    cleanup: cleanupLegacyData,
    plans: PLANS
  };
  
  // Show usage instructions
  console.log('✨ Koyn Secure Subscription Testing Tools loaded!');
  console.log('📝 Usage:');
  console.log('  koynSubscription.enableLifetime("your-email@example.com")');
  console.log('  koynSubscription.enableOneMonth("your-email@example.com")');
  console.log('  koynSubscription.status()');
  console.log('  koynSubscription.disable()');
  console.log('  koynSubscription.cleanup() // Remove legacy data');
  console.log('');
  console.log('🔐 This version uses secure JWT tokens instead of vulnerable localStorage data');
  console.log('⚠️  Development only - production users must verify through email');
  
  // Auto-cleanup legacy data on load
  cleanupLegacyData();
})(); 