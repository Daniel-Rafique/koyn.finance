/**
 * This script can be loaded directly in the browser to set subscription status
 * Use it by including it in a script tag or running it in the browser console
 */

(function() {
  function setSubscription(email = 'koynlabs@gmail.com') {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year from now
    
    const subscriptionData = {
      subscriptionId: 'test-subscription-id',
      transactionId: 'test-transaction-id',
      expiresAt: expiryDate.toISOString(),
      email: email
    };
    
    localStorage.setItem('koyn_subscription', JSON.stringify(subscriptionData));
    console.log(`✅ Successfully set subscription for ${email}`);
    console.log(`🔄 Please refresh the page to apply changes`);
    
    return true;
  }
  
  function clearSubscription() {
    localStorage.removeItem('koyn_subscription');
    console.log('✅ Cleared subscription from localStorage');
    console.log('🔄 Please refresh the page to apply changes');
    
    return true;
  }
  
  // Expose functions to global scope
  window.koynDebug = {
    setSubscription: setSubscription,
    clearSubscription: clearSubscription
  };
  
  console.log('✨ Koyn debug tools loaded!');
  console.log('📝 Usage examples:');
  console.log('   koynDebug.setSubscription("koynlabs@gmail.com")');
  console.log('   koynDebug.clearSubscription()');
})(); 