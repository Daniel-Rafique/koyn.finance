// Test what the updated getSecureAccessToken method returns
console.log('=== Testing Updated getSecureAccessToken ===');

// First check current token state
console.log('Current window.__authStore token:', window.__authStore.getAccessToken() ? 'EXISTS' : 'NULL');

// Since you refreshed the page, let's test the React component
// Try to trigger getSecureAccessToken through a component action

// First, let's just make a test API call to see headers being sent
console.log('Testing manual API call to chart endpoint...');

const testChartCall = async () => {
  const token = window.__authStore.getAccessToken();
  console.log('Token for manual test:', token ? token.substring(0, 20) + '...' : 'null');
  
  if (token) {
    try {
      const response = await fetch('https://koyn.finance:3001/api/chart?symbol=AAPL&interval=1hour', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Manual API call status:', response.status);
      const text = await response.text();
      console.log('Manual API response (first 200 chars):', text.substring(0, 200));
    } catch (error) {
      console.error('Manual API call error:', error);
    }
  } else {
    console.log('No token available for manual test');
  }
};

testChartCall();