const axios = require('axios');
const cheerio = require('cheerio');

async function testSHCDirectly() {
  try {
    console.log('🔍 Testing SHC website directly...');
    
    // Test URL with known case parameters
    const testUrl = 'https://cases.shc.gov.pk/khi/web/index.php?r=cases%2Fsearch-result&CasesSearch[CASENO]=&CasesSearch[CASEYEAR]=1974&CasesSearch[CASECATEGORY]=Civil+Revision&CasesSearch[BENCH]=S&CasesSearch[CIRCUITCODE]=Karachi&CasesSearch[Pending]=3';
    
    console.log('📍 URL:', testUrl);

    const response = await axios.get(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    });

    console.log('✅ Response received');
    console.log('📊 Status:', response.status);
    console.log('📏 Content Length:', response.data.length);

    const $ = cheerio.load(response.data);
    
    // Check page title
    const title = $('title').text();
    console.log('📄 Page Title:', title);
    
    // Look for results table
    const tables = $('table');
    console.log('📋 Tables found:', tables.length);
    
    tables.each((index, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      console.log(`\n🔢 Table ${index + 1}:`);
      console.log(`   - Rows: ${rows.length}`);
      console.log(`   - Classes: ${$table.attr('class') || 'none'}`);
      console.log(`   - ID: ${$table.attr('id') || 'none'}`);
      
      // Check headers
      const headers = $table.find('th').map((i, el) => $(el).text().trim()).get();
      if (headers.length > 0) {
        console.log(`   - Headers: [${headers.join(', ')}]`);
      }
      
      // Check first few data rows
      const dataRows = $table.find('tr').slice(1, 4); // Skip header, take first 3 data rows
      dataRows.each((rowIndex, row) => {
        const $row = $(row);
        const cells = $row.find('td').map((i, el) => $(el).text().trim()).get();
        if (cells.length > 0) {
          console.log(`   - Row ${rowIndex + 1}: [${cells.join(' | ')}]`);
        }
      });
    });
    
    // Look for specific content patterns
    const bodyText = $('body').text();
    
    if (bodyText.includes('No case')) {
      console.log('❌ "No case" message found in response');
    }
    
    if (bodyText.includes('Search Result')) {
      console.log('✅ "Search Result" found in response');
    }
    
    if (bodyText.includes('Case No')) {
      console.log('✅ "Case No" found in response');
    }

    // Save sample HTML to file for inspection
    const fs = require('fs');
    const sampleHtml = response.data.substring(0, 5000);
    fs.writeFileSync('shc_response_sample.html', sampleHtml);
    console.log('💾 Sample HTML saved to shc_response_sample.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📄 Status Text:', error.response.statusText);
    }
  }
}

testSHCDirectly();