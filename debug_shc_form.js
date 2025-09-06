const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeSHCForm() {
  try {
    console.log('Fetching SHC search form...');
    const response = await axios.get('https://cases.shc.gov.pk/khi/web/index.php?r=cases/search');
    const $ = cheerio.load(response.data);
    
    console.log('Form action:', $('form').attr('action'));
    console.log('Form method:', $('form').attr('method'));
    
    console.log('\n--- Form Fields ---');
    $('input, select, textarea').each((i, element) => {
      const $el = $(element);
      const name = $el.attr('name');
      const type = $el.attr('type') || $el.prop('tagName').toLowerCase();
      const id = $el.attr('id');
      
      if (name) {
        console.log(`Field: ${name}, Type: ${type}, ID: ${id || 'none'}`);
      }
    });
    
    // Look specifically for CasesSearch fields
    console.log('\n--- CasesSearch Fields ---');
    $('[name*="CasesSearch"]').each((i, element) => {
      const $el = $(element);
      console.log(`Name: ${$el.attr('name')}, Type: ${$el.attr('type') || $el.prop('tagName').toLowerCase()}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeSHCForm();