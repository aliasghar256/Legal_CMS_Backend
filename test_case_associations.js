/**
 * Test file for Case Associations API
 * This file demonstrates the usage of the new case associations endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3001/api';  // Adjust as needed
const AUTH_TOKEN = 'your_jwt_token_here';      // Replace with actual token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test data
const testData = {
  case_id: 1,     // Replace with actual case ID
  party_ids: [1, 2], // Replace with actual party IDs
  lawyer_ids: [1, 2], // Replace with actual lawyer IDs
  lawyer_id: 1,   // Replace with actual lawyer ID
  party_id: 1     // Replace with actual party ID
};

/**
 * Test 1: Get Case Associations
 */
async function testGetCaseAssociations() {
  console.log('\n=== Test 1: Get Case Associations ===');
  try {
    const response = await api.get(`/cases/${testData.case_id}/associations`);
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 2: Add Parties to Case
 */
async function testAddPartiesToCase() {
  console.log('\n=== Test 2: Add Parties to Case ===');
  try {
    const requestData = {
      action: 'add',
      party_ids: testData.party_ids,
      lawyer_id: testData.lawyer_id
    };
    
    const response = await api.put(`/cases/${testData.case_id}/parties`, requestData);
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 3: Add Lawyers to Case
 */
async function testAddLawyersToCase() {
  console.log('\n=== Test 3: Add Lawyers to Case ===');
  try {
    const requestData = {
      action: 'add',
      lawyer_ids: testData.lawyer_ids,
      party_id: testData.party_id
    };
    
    const response = await api.put(`/cases/${testData.case_id}/lawyers`, requestData);
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 4: Remove Parties from Case
 */
async function testRemovePartiesFromCase() {
  console.log('\n=== Test 4: Remove Parties from Case ===');
  try {
    const requestData = {
      action: 'remove',
      party_ids: [testData.party_ids[0]] // Remove first party only
    };
    
    const response = await api.put(`/cases/${testData.case_id}/parties`, requestData);
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 5: Remove Lawyers from Case
 */
async function testRemoveLawyersFromCase() {
  console.log('\n=== Test 5: Remove Lawyers from Case ===');
  try {
    const requestData = {
      action: 'remove',
      lawyer_ids: [testData.lawyer_ids[0]] // Remove first lawyer only
    };
    
    const response = await api.put(`/cases/${testData.case_id}/lawyers`, requestData);
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test 6: Invalid Action Test
 */
async function testInvalidAction() {
  console.log('\n=== Test 6: Invalid Action Test ===');
  try {
    const requestData = {
      action: 'invalid_action',
      party_ids: testData.party_ids,
      lawyer_id: testData.lawyer_id
    };
    
    const response = await api.put(`/cases/${testData.case_id}/parties`, requestData);
    console.log('❌ Should have failed:', response.data);
  } catch (error) {
    console.log('✅ Expected error:', error.response?.data || error.message);
  }
}

/**
 * Test 7: Missing Required Fields Test
 */
async function testMissingRequiredFields() {
  console.log('\n=== Test 7: Missing Required Fields Test ===');
  try {
    const requestData = {
      action: 'add',
      party_ids: testData.party_ids
      // Missing lawyer_id for add action
    };
    
    const response = await api.put(`/cases/${testData.case_id}/parties`, requestData);
    console.log('❌ Should have failed:', response.data);
  } catch (error) {
    console.log('✅ Expected error:', error.response?.data || error.message);
  }
}

/**
 * Test 8: Invalid Case ID Test
 */
async function testInvalidCaseId() {
  console.log('\n=== Test 8: Invalid Case ID Test ===');
  try {
    const response = await api.get('/cases/999999/associations');
    console.log('❌ Should have failed:', response.data);
  } catch (error) {
    console.log('✅ Expected error:', error.response?.data || error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Case Associations API Tests');
  console.log('📝 Make sure to update testData with valid IDs before running');
  
  // Basic functionality tests
  await testGetCaseAssociations();
  await testAddPartiesToCase();
  await testAddLawyersToCase();
  
  // Get associations again to see changes
  await testGetCaseAssociations();
  
  // Cleanup tests
  await testRemovePartiesFromCase();
  await testRemoveLawyersFromCase();
  
  // Error handling tests
  await testInvalidAction();
  await testMissingRequiredFields();
  await testInvalidCaseId();
  
  console.log('\n🏁 All tests completed');
}

/**
 * Individual test functions for manual testing
 */

// Uncomment the test you want to run individually
// testGetCaseAssociations();
// testAddPartiesToCase();
// testAddLawyersToCase();
// testRemovePartiesFromCase();
// testRemoveLawyersFromCase();

// Run all tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testGetCaseAssociations,
  testAddPartiesToCase,
  testAddLawyersToCase,
  testRemovePartiesFromCase,
  testRemoveLawyersFromCase,
  testInvalidAction,
  testMissingRequiredFields,
  testInvalidCaseId,
  runAllTests
};