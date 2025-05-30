/**
 * Premium Test Script
 * Use this to quickly set up your local environment for premium testing
 */

(function() {
  // Function to enable premium features locally
  function enablePremium(email = 'koynlabs@gmail.com') {
    // Step 1: Set subscription in localStorage
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    const subscriptionData = {
      subscriptionId: 'premium-test-subscription',
      transactionId: 'test-transaction-id',
      expiresAt: expiryDate.toISOString(),
      email: email
    };
    
    localStorage.setItem('koyn_subscription', JSON.stringify(subscriptionData));
    console.log(`✅ Set premium subscription in localStorage for ${email}`);
    
    // Step 2: Set localStorage item to force premium mode
    localStorage.setItem('koyn_premium_mode', 'enabled');
    console.log(`✅ Enabled premium mode`);
    
    // Step 3: Reload the page to apply changes
    console.log(`🔄 Reloading page in 2 seconds to apply changes...`);
    setTimeout(() => window.location.reload(), 2000);
    
    return true;
  }
  
  // Function to disable premium features
  function disablePremium() {
    localStorage.removeItem('koyn_subscription');
    localStorage.removeItem('koyn_premium_mode');
    console.log(`✅ Removed premium subscription from localStorage`);
    console.log(`🔄 Reloading page in 2 seconds to apply changes...`);
    setTimeout(() => window.location.reload(), 2000);
    
    return true;
  }
  
  // Expose functions to global scope
  window.koynPremium = {
    enable: enablePremium,
    disable: disablePremium,
    status: function() {
      const hasSubscription = !!localStorage.getItem('koyn_subscription');
      const isPremiumMode = localStorage.getItem('koyn_premium_mode') === 'enabled';
      
      console.log(`📊 Premium Status:`);
      console.log(`- Subscription in localStorage: ${hasSubscription ? '✅' : '❌'}`);
      console.log(`- Premium mode enabled: ${isPremiumMode ? '✅' : '❌'}`);
      
      if (hasSubscription) {
        try {
          const data = JSON.parse(localStorage.getItem('koyn_subscription') || '{}');
          console.log(`- Email: ${data.email || 'unknown'}`);
          console.log(`- Expires: ${data.expiresAt || 'unknown'}`);
        } catch (e) {
          console.error('Error parsing subscription data');
        }
      }
      
      return { hasSubscription, isPremiumMode };
    }
  };
  
  // Show usage instructions
  console.log('✨ Koyn Premium Testing Tools loaded!');
  console.log('📝 Usage:');
  console.log('   koynPremium.enable()         - Enable premium features with default email');
  console.log('   koynPremium.enable("your@email.com") - Enable premium with custom email');
  console.log('   koynPremium.disable()        - Disable premium features');
  console.log('   koynPremium.status()         - Check current premium status');
})(); 