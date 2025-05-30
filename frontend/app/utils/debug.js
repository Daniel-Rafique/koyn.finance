/**
 * Debug utility for subscription testing
 * Run this in your browser console to set an active subscription manually
 */

export function setTestSubscription(email = 'koynlabs@gmail.com') {
  const subscriptionData = {
    subscriptionId: 'test-subscription-id',
    transactionId: 'test-transaction-id',
    expiresAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
    email: email,
  };

  localStorage.setItem('koyn_subscription', JSON.stringify(subscriptionData));
  console.log(`Set test subscription for ${email} in localStorage`);
  console.log(`Please refresh the page to apply the changes`);
  
  return true;
}

export function clearSubscription() {
  localStorage.removeItem('koyn_subscription');
  console.log('Cleared subscription from localStorage');
  console.log('Please refresh the page to apply the changes');
  
  return true;
} 