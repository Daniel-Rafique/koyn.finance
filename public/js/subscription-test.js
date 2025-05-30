/**
 * Subscription Test Script
 * Use this to quickly set up your local environment for subscription testing
 */

(function() {
  // Available subscription plans
  const PLANS = {
    ONE_MONTH: '1-month',
    THREE_MONTH: '3-month',
    LIFETIME: 'lifetime'
  };

  // Function to enable subscription features locally
  function enableSubscription(email = 'koynlabs@gmail.com', plan = PLANS.LIFETIME) {
    // Validate plan
    if (!Object.values(PLANS).includes(plan)) {
      console.error(`Invalid plan: ${plan}. Must be one of: ${Object.values(PLANS).join(', ')}`);
      return false;
    }
    
    // Step 1: Set subscription in localStorage
    const expiryDate = new Date();
    
    // Set expiry based on plan
    if (plan === PLANS.ONE_MONTH) {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (plan === PLANS.THREE_MONTH) {
      expiryDate.setMonth(expiryDate.getMonth() + 3);
    } else {
      // Lifetime plan - set to 100 years in the future
      expiryDate.setFullYear(expiryDate.getFullYear() + 100);
    }
    
    const subscriptionData = {
      subscriptionId: 'test-subscription-id',
      transactionId: 'test-transaction-id',
      expiresAt: expiryDate.toISOString(),
      email: email,
      plan: plan
    };
    
    localStorage.setItem('koyn_subscription', JSON.stringify(subscriptionData));
    console.log(`✅ Set ${plan} subscription in localStorage for ${email}`);
    
    // Step 2: Set localStorage item to force subscription mode
    localStorage.setItem('koyn_subscription_mode', 'enabled');
    console.log(`✅ Enabled subscription mode`);
    
    // Step 3: Reload the page to apply changes
    console.log(`🔄 Reloading page in 2 seconds to apply changes...`);
    setTimeout(() => window.location.reload(), 2000);
    
    return true;
  }
  
  // Function to disable subscription features
  function disableSubscription() {
    localStorage.removeItem('koyn_subscription');
    localStorage.removeItem('koyn_subscription_mode');
    console.log(`✅ Removed subscription from localStorage`);
    console.log(`🔄 Reloading page in 2 seconds to apply changes...`);
    setTimeout(() => window.location.reload(), 2000);
    
    return true;
  }
  
  // Expose functions to global scope
  window.koynSubscription = {
    enable: enableSubscription,
    enableOneMonth: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.ONE_MONTH),
    enableThreeMonth: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.THREE_MONTH),
    enableLifetime: (email = 'koynlabs@gmail.com') => enableSubscription(email, PLANS.LIFETIME),
    disable: disableSubscription,
    status: function() {
      const hasSubscription = !!localStorage.getItem('koyn_subscription');
      const isSubscriptionMode = localStorage.getItem('koyn_subscription_mode') === 'enabled';
      
      console.log(`📊 Subscription Status:`);
      console.log(`- Subscription in localStorage: ${hasSubscription ? '✅' : '❌'}`);
      console.log(`- Subscription mode enabled: ${isSubscriptionMode ? '✅' : '❌'}`);
      
      if (hasSubscription) {
        try {
          const data = JSON.parse(localStorage.getItem('koyn_subscription') || '{}');
          console.log(`- Email: ${data.email || 'unknown'}`);
          console.log(`- Plan: ${data.plan || 'unknown'}`);
          console.log(`- Expires: ${new Date(data.expiresAt).toLocaleDateString() || 'unknown'}`);
        } catch (e) {
          console.error('Error parsing subscription data');
        }
      }
      
      return { hasSubscription, isSubscriptionMode };
    },
    plans: PLANS
  };
  
  // Show usage instructions
  console.log('✨ Koyn Subscription Testing Tools loaded!');
  console.log('📝 Usage:');
  console.log('   koynSubscription.enableOneMonth()   - Enable 1-month subscription');
  console.log('   koynSubscription.enableThreeMonth() - Enable 3-month subscription');
  console.log('   koynSubscription.enableLifetime()   - Enable lifetime subscription');
  console.log('   koynSubscription.enable("email@example.com", "1-month") - Custom subscription');
  console.log('   koynSubscription.disable()          - Disable subscription');
  console.log('   koynSubscription.status()           - Check current subscription status');
})(); 