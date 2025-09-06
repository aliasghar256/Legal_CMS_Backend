const axios = require('axios');

async function testCaseAddition() {
  try {
    console.log('🧪 Testing case addition for existing cases...');
    
    // Test case data that we know already exists or should be added
    const testCaseData = {
      title: "Test Case for User Relationship",
      caseNumber: "123/2024",
      cfmsCaseCode: "TEST-123-2024", // String case code
      status: "Pending",
      caseType: "Civil",
      court: "District Court Karachi",
      filingDate: "2024-01-15",
      nextHearingDate: "2024-02-15",
      userId: 1 // Test user ID
    };
    
    console.log('📝 Test case data:', testCaseData);
    
    // First, try to add the case
    console.log('\n1️⃣ Adding case to database...');
    const addResponse = await axios.post('http://localhost:3001/api/court-search/add-case', testCaseData);
    
    console.log('✅ Add Case Response:');
    console.log('Status:', addResponse.status);
    console.log('Success:', addResponse.data.success);
    console.log('Message:', addResponse.data.message);
    console.log('Case ID:', addResponse.data.caseId);
    
    // Try to add the same case again (should create user relationship if missing)
    console.log('\n2️⃣ Adding same case again (should handle existing case)...');
    const addAgainResponse = await axios.post('http://localhost:3001/api/court-search/add-case', testCaseData);
    
    console.log('✅ Add Again Response:');
    console.log('Status:', addAgainResponse.status);
    console.log('Success:', addAgainResponse.data.success);
    console.log('Message:', addAgainResponse.data.message);
    console.log('Case ID:', addAgainResponse.data.caseId);
    
    // Try with a different user ID to test relationship creation
    console.log('\n3️⃣ Adding same case with different user ID...');
    const testCaseDataDifferentUser = { ...testCaseData, userId: 2 };
    const differentUserResponse = await axios.post('http://localhost:3001/api/court-search/add-case', testCaseDataDifferentUser);
    
    console.log('✅ Different User Response:');
    console.log('Status:', differentUserResponse.status);
    console.log('Success:', differentUserResponse.data.success);
    console.log('Message:', differentUserResponse.data.message);
    console.log('Case ID:', differentUserResponse.data.caseId);
    
    // Test case without lawyer (null lawyer scenario)
    console.log('\n4️⃣ Testing case without lawyer...');
    const caseWithoutLawyer = {
      ...testCaseData,
      caseNumber: "124/2024",
      cfmsCaseCode: "TEST-124-2024",
      title: "Test Case Without Lawyer",
      // No lawyer information provided
    };
    
    const noLawyerResponse = await axios.post('http://localhost:3001/api/court-search/add-case', caseWithoutLawyer);
    
    console.log('✅ No Lawyer Response:');
    console.log('Status:', noLawyerResponse.status);
    console.log('Success:', noLawyerResponse.data.success);
    console.log('Message:', noLawyerResponse.data.message);
    console.log('Case ID:', noLawyerResponse.data.caseId);
    
  } catch (error) {
    console.error('❌ Error testing case addition:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testCaseAddition();