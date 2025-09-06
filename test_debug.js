const axios = require('axios');

async function testDebugEndpoint() {
  try {
    console.log('Testing debug endpoint...');
    const response = await axios.get('http://localhost:3001/api/shc-search/debug');
    
    console.log('✅ Debug endpoint response:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    
    if (response.data.analysis) {
      console.log('\n📊 HTML Analysis:');
      console.log('- Page Title:', response.data.analysis.pageTitle);
      console.log('- Body Length:', response.data.analysis.bodyLength);
      console.log('- Tables Found:', response.data.analysis.tables.length);
      console.log('- Forms Found:', response.data.analysis.forms.length);
      console.log('- Scripts:', response.data.analysis.scripts);
      console.log('- Divs:', response.data.analysis.divs);
      
      console.log('\n📋 Table Details:');
      response.data.analysis.tables.forEach((table, index) => {
        console.log(`Table ${index}:`);
        console.log(`  - Rows: ${table.rows}`);
        console.log(`  - Headers: [${table.headers.join(', ')}]`);
        console.log(`  - First Row Cells: [${table.firstRowCells.join(', ')}]`);
        console.log(`  - Classes: ${table.classes}`);
        console.log(`  - ID: ${table.id}`);
      });
    }
    
    if (response.data.sampleHtml) {
      console.log('\n📄 Sample HTML (first 500 chars):');
      console.log(response.data.sampleHtml.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ Error testing debug endpoint:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testDebugEndpoint();