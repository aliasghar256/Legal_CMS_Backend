const axios = require('axios');

async function debugCaseProfile() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJlbWFpbCI6ImFsaWgxMTczN0BnbWFpbC5jb20iLCJpYXQiOjE3NTgyOTcyODEsImV4cCI6MTc1ODM4MzY4MX0.Rm4aGAaJFGziJroyX-tyqI62loOndmDQ4vpRpViMW1g';
    
    console.log('🧪 Testing case profile retrieval with HTML dump...');
    
    const response = await axios.post('http://localhost:3001/court-search/profile', {
      caseCode: '19202016083126940'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response Status:', response.status);
    console.log('Success:', response.data.success);
    
    // Check if we can access the raw HTML for debugging
    if (response.data.success && response.data.data) {
      const profileData = response.data.data;
      console.log('\n📋 Profile Data Summary:');
      console.log('- Case Details:', Object.keys(profileData.caseDetails || {}));
      console.log('- Hearing History Length:', profileData.hearingHistory ? profileData.hearingHistory.length : 0);
      
      if (profileData.hearingHistory && profileData.hearingHistory.length > 0) {
        console.log('\n📅 Found Hearings:');
        profileData.hearingHistory.forEach((hearing, index) => {
          console.log(`  ${index + 1}. Date: ${hearing.date}, Diary: "${hearing.diary ? hearing.diary.substring(0, 50) + '...' : 'BLANK'}"`);
        });
      } else {
        console.log('\n❌ No hearing history found in parsed data!');
        console.log('This suggests the HTML parsing is not finding the hearing table correctly.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

debugCaseProfile();