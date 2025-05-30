const fs = require('fs');
const path = require('path');

// Test the shared result functionality
async function testSharedResult() {
  console.log('Testing shared result functionality...\n');
  
  // 1. Check if shared files exist
  const sharedDir = path.join(__dirname, 'public', 'shared');
  console.log('1. Checking shared directory:', sharedDir);
  
  if (!fs.existsSync(sharedDir)) {
    console.log('❌ Shared directory does not exist');
    return;
  }
  
  const files = fs.readdirSync(sharedDir);
  console.log('✅ Shared directory exists');
  console.log('📁 Files found:', files);
  
  if (files.length === 0) {
    console.log('❌ No shared files found');
    return;
  }
  
  // 2. Test reading a shared file
  const testFile = files[0];
  const testShareId = testFile.replace('.json', '');
  console.log('\n2. Testing file:', testFile);
  console.log('📄 Share ID:', testShareId);
  
  try {
    const filePath = path.join(sharedDir, testFile);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    console.log('✅ File readable');
    console.log('📊 Data structure:', {
      hasResultId: !!data.resultId,
      hasShareId: !!data.shareId,
      hasResult: !!data.result,
      hasSharedAt: !!data.sharedAt
    });
  } catch (error) {
    console.log('❌ Error reading file:', error.message);
    return;
  }
  
  // 3. Test API endpoint
  console.log('\n3. Testing API endpoint...');
  try {
    const response = await fetch(`http://localhost:3001/api/shared-result/${testShareId}`);
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const apiData = await response.json();
      console.log('✅ API endpoint working');
      console.log('📊 API response:', {
        success: apiData.success,
        hasResult: !!apiData.result
      });
    } else {
      const errorText = await response.text();
      console.log('❌ API endpoint failed');
      console.log('📄 Error response:', errorText);
    }
  } catch (error) {
    console.log('❌ Error calling API:', error.message);
  }
  
  // 4. Test external URL
  console.log('\n4. Testing external URL...');
  try {
    const response = await fetch(`https://koyn.ai:3001/api/shared-result/${testShareId}`);
    console.log('🌐 External response status:', response.status);
    
    if (response.ok) {
      const apiData = await response.json();
      console.log('✅ External API working');
    } else {
      const errorText = await response.text();
      console.log('❌ External API failed');
      console.log('📄 Error response:', errorText);
    }
  } catch (error) {
    console.log('❌ Error calling external API:', error.message);
  }
}

// Run the test
testSharedResult().catch(console.error); 