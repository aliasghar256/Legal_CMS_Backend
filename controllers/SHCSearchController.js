const axios = require('axios');
const cheerio = require('cheerio');

class SHCSearchController {
  // Search cases in Sindh High Court
  static async searchCases(req, res) {
    try {
      console.log('=== SHC SEARCH DEBUG ===');
      console.log('Request body received:', JSON.stringify(req.body, null, 2));
      
      const {
        caseNo = '',
        caseYear = '',
        caseCategory = '',
        bench = '',
        circuitCode = '',
        pending = '3', // Default to 'All' (3 = All, 1 = Pending, 2 = Disposal)
        // Advanced search fields
        natureOfCase = '',
        partyName = '',
        organization = '',
        advocate = '',
        firNumber = '',
        firYear = '',
        policeStation = ''
      } = req.body;

      console.log('Extracted parameters:', {
        caseNo, caseYear, caseCategory, bench, circuitCode, pending,
        natureOfCase, partyName, organization, advocate, firNumber, firYear, policeStation
      });

      // Build query parameters for SHC API using correct field names
      const queryParams = new URLSearchParams();
      queryParams.append('r', 'cases/search-result');
      queryParams.append('CasesSearch[CASENO]', caseNo);
      queryParams.append('CasesSearch[CASEYEAR]', caseYear);
      queryParams.append('CasesSearch[CASENAMECODE]', caseCategory); // Correct field name
      queryParams.append('CasesSearch[BENCH]', bench);
      queryParams.append('CasesSearch[CIRCUITCODE]', circuitCode);
      queryParams.append('CasesSearch[isPending]', pending); // Correct field name
      
      // Advanced search parameters with correct field names
      if (natureOfCase) queryParams.append('CasesSearch[MATTERCODE]', natureOfCase);
      if (partyName) queryParams.append('CasesSearch[PARTY]', partyName);
      if (organization) queryParams.append('CasesSearch[GOVT_AGENCY_CODE]', organization);
      if (advocate) queryParams.append('CasesSearch[ADVOCATECODE]', advocate);
      if (firNumber) queryParams.append('CasesSearch[FIRNO]', firNumber);
      if (firYear) queryParams.append('CasesSearch[FIRYEAR]', firYear);
      if (policeStation) queryParams.append('CasesSearch[POLICESTATIONCODE]', policeStation);

      const searchUrl = `https://cases.shc.gov.pk/khi/web/index.php?${queryParams.toString()}`;
      
      console.log('SHC Search URL:', searchUrl);

      // Make request to SHC API
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('SHC API Response received, parsing...');

      // Parse the HTML response to extract case data
      const parsedData = SHCSearchController.parseSearchResults(response.data);

      res.json({
        success: true,
        message: 'SHC search completed successfully',
        searchParams: {
          caseNo,
          caseYear,
          caseCategory,
          bench,
          circuitCode,
          pending,
          natureOfCase,
          partyName,
          organization,
          advocate,
          firNumber,
          firYear,
          policeStation
        },
        searchUrl,
        data: parsedData
      });

    } catch (error) {
      console.error('Error in SHC searchCases:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'SHC court system is currently unavailable',
          error: 'Connection failed'
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'SHC search request timed out',
          error: 'Request timeout'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Parse HTML response to extract structured case data
  static parseSearchResults(htmlData) {
    const $ = cheerio.load(htmlData);
    
    const cases = [];
    const seenCaseIds = new Set(); // Track duplicate case IDs
    
    console.log('Starting to parse SHC search results...');
    
    // Try multiple selectors to find the results table
    const tableSelectors = [
      'table tbody tr',
      '.table tbody tr', 
      '#case-results tbody tr',
      '.search-results tbody tr',
      'tbody tr',
      'table tr'
    ];
    
    let foundRows = false;
    
    for (const selector of tableSelectors) {
      const rows = $(selector);
      console.log(`Trying selector "${selector}": found ${rows.length} rows`);
      
      if (rows.length > 0) {
        rows.each((index, element) => {
          const $row = $(element);
          const cells = $row.find('td');
          
          console.log(`Row ${index}: found ${cells.length} cells`);
          
          // Skip header rows and rows with insufficient data
          if (cells.length < 8) {
            console.log(`Skipping row ${index}: insufficient cells (${cells.length})`);
            return;
          }
          
          // Extract case ID from view link or data attributes
          let caseId = null;
          const viewLink = $row.find('a[href*="view"], button[onclick*="view"], [data-id]').first();
          
          if (viewLink.length > 0) {
            const href = viewLink.attr('href') || '';
            const onclick = viewLink.attr('onclick') || '';
            const dataId = viewLink.attr('data-id') || '';
            
            // Try to extract ID from href like "index.php?r=cases/view&id=480400"
            const hrefMatch = href.match(/[?&]id=(\d+)/);
            if (hrefMatch) {
              caseId = hrefMatch[1];
            } else if (dataId) {
              caseId = dataId;
            } else {
              // Try to extract from onclick
              const onclickMatch = onclick.match(/(\d+)/);
              if (onclickMatch) {
                caseId = onclickMatch[1];
              }
            }
          }
          
          // If no ID found, try to find it in the row content
          if (!caseId) {
            const rowText = $row.text();
            const idMatch = rowText.match(/\b(\d{6,})\b/); // Look for 6+ digit numbers
            if (idMatch) {
              caseId = idMatch[1];
            } else {
              caseId = `row_${index}_${Date.now()}`; // Fallback unique ID
            }
          }
          
          // Skip if we've already seen this case ID
          if (caseId && seenCaseIds.has(caseId)) {
            console.log(`Skipping duplicate case with ID: ${caseId}`);
            return;
          }
          
          // Extract data from table cells
          const caseData = {
            id: caseId,
            serialNumber: $(cells[0]).text().trim() || (index + 1).toString(),
            caseName: $(cells[1]).text().trim() || 'Unknown',
            caseNo: $(cells[2]).text().trim() || '',
            caseYear: $(cells[3]).text().trim() || '',
            bench: $(cells[4]).text().trim() || '',
            circuitCode: $(cells[5]).text().trim() || '',
            caseTitle: $(cells[6]).text().trim() || '',
            matter: $(cells[7]).text().trim() || '',
            lastHearing: cells.length > 8 ? $(cells[8]).text().trim() : 'Not Available',
            nextDate: cells.length > 9 ? $(cells[9]).text().trim() : 'Not Available',
            disposalDate: cells.length > 10 ? $(cells[10]).text().trim() : 'Not Available',
            status: cells.length > 11 ? $(cells[11]).text().trim() : 'Not Available'
          };
          
          // Clean up the data
          Object.keys(caseData).forEach(key => {
            if (typeof caseData[key] === 'string') {
              caseData[key] = caseData[key].replace(/\s+/g, ' ').trim();
              if (caseData[key] === '' || caseData[key] === '-') {
                caseData[key] = 'Not Available';
              }
            }
          });
          
          console.log(`Extracted case data:`, {
            id: caseData.id,
            caseName: caseData.caseName,
            caseNo: caseData.caseNo,
            caseYear: caseData.caseYear
          });
          
          // Add case ID to seen set
          if (caseId) {
            seenCaseIds.add(caseId);
          }
          
          cases.push(caseData);
          foundRows = true;
        });
        
        if (foundRows && cases.length > 0) {
          console.log(`Successfully found cases using selector: ${selector}`);
          break; // Stop trying other selectors if we found data
        }
      }
    }
    
    // If no cases found in standard tables, try alternative parsing
    if (cases.length === 0) {
      console.log('No cases found in standard tables, trying alternative parsing...');
      
      // Look for any table or div that contains case-like data
      $('*').each((index, element) => {
        const $element = $(element);
        const text = $element.text();
        
        // Look for patterns that indicate case data
        if (text.includes('Civil Revision') || text.includes('Criminal') || 
            text.match(/\d{1,4}\/\d{4}/) || text.includes('Karachi') || text.includes('Sukkur')) {
          
          const tagName = element.tagName.toLowerCase();
          console.log(`Found potential case data in ${tagName} element:`, text.substring(0, 100));
          
          // Try to extract basic case information from the text
          const caseNumberMatch = text.match(/(\d{1,4})\/(\d{4})/);
          const caseTypeMatch = text.match(/(Civil|Criminal|Constitutional|Writ|Appeal|Revision)/i);
          
          if (caseNumberMatch) {
            const basicData = {
              id: `manual_${index}`,
              serialNumber: cases.length + 1,
              caseName: caseTypeMatch ? caseTypeMatch[1] : 'Unknown',
              caseNo: caseNumberMatch[1],
              caseYear: caseNumberMatch[2],
              bench: 'Unknown',
              circuitCode: text.includes('Karachi') ? 'Karachi' : 
                          text.includes('Sukkur') ? 'Sukkur' : 'Unknown',
              caseTitle: text.substring(0, 200).replace(/\s+/g, ' ').trim(),
              matter: 'EXTRACTED FROM TEXT',
              lastHearing: 'Not Available',
              nextDate: 'Not Available',
              disposalDate: 'Not Available',
              status: 'Not Available',
              rawText: text.substring(0, 500) // Keep raw text for debugging
            };
            
            cases.push(basicData);
          }
        }
      });
    }
    
    console.log(`SHC Search: Found ${cases.length} cases total`);
    
    // Log some sample data for debugging
    if (cases.length > 0) {
      console.log('Sample case data:', JSON.stringify(cases[0], null, 2));
    }
    
    return {
      totalResults: cases.length,
      cases: cases,
      duplicatesRemoved: seenCaseIds.size < cases.length + seenCaseIds.size,
      debug: {
        rowsProcessed: cases.length,
        uniqueIds: seenCaseIds.size,
        sampleHtml: cases.length > 0 ? 'Data found' : $('body').html().substring(0, 500)
      }
    };
  }

  // Get case details by ID
  static async getCaseDetails(req, res) {
    try {
      const { caseId } = req.body;
      
      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required'
        });
      }

      // Build URL for case details
      const detailUrl = `https://cases.shc.gov.pk/khi/web/index.php?r=cases%2Fview&id=${caseId}`;
      
      console.log('SHC Case Detail URL:', detailUrl);

      // Make request to get case details
      const response = await axios.get(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000
      });

      console.log('SHC Case Details response received, parsing...');

      // Parse the case details HTML
      const caseDetails = SHCSearchController.parseCaseDetails(response.data);

      res.json({
        success: true,
        message: 'SHC case details retrieved successfully',
        caseId: caseId,
        detailUrl,
        data: caseDetails
      });

    } catch (error) {
      console.error('Error in SHC getCaseDetails:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'SHC court system is currently unavailable',
          error: 'Connection failed'
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'SHC case details request timed out',
          error: 'Request timeout'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve SHC case details',
        error: error.message
      });
    }
  }

  // Parse case details HTML
  static parseCaseDetails(htmlData) {
    const $ = cheerio.load(htmlData);
    
    const details = {
      caseDetails: {},
      hearingHistory: [],
      parties: {},
      advocates: {}
    };

    console.log('=== SHC CASE PROFILE PARSING ===');
    console.log('HTML length:', htmlData.length);
    
    // Extract page title for debugging
    const pageTitle = $('title').text();
    console.log('Page title:', pageTitle);
    
    // Extract main content text for debugging
    const bodyText = $('body').text().substring(0, 500);
    console.log('Body text preview:', bodyText);

    // Extract case details from various sections
    // Look for detail tables, definition lists, or labeled sections
    
    // Try to find case information table
    $('table, .detail-table, .case-info').each((index, table) => {
      $(table).find('tr').each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td, th');
        
        if (cells.length === 2) {
          const label = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          
          if (label && value) {
            details.caseDetails[label] = value;
            console.log(`Found detail: ${label} = ${value}`);
          }
        }
      });
    });

    // Look for hearing history
    $('table').each((index, table) => {
      const $table = $(table);
      const headers = $table.find('thead th, tr:first-child th, tr:first-child td');
      
      // Check if this looks like a hearing table
      const headerText = headers.map((i, el) => $(el).text().toLowerCase()).get().join(' ');
      if (headerText.includes('date') || headerText.includes('hearing') || headerText.includes('proceeding')) {
        console.log(`Found potential hearing table with headers: ${headerText}`);
        
        $table.find('tbody tr, tr').slice(1).each((i, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          
          if (cells.length >= 2) {
            const hearingEntry = {
              serialNumber: i + 1,
              date: $(cells[0]).text().trim(),
              proceedings: $(cells[1]).text().trim()
            };
            
            // Add additional columns if available
            if (cells.length >= 3) {
              hearingEntry.judge = $(cells[2]).text().trim();
            }
            if (cells.length >= 4) {
              hearingEntry.nextDate = $(cells[3]).text().trim();
            }
            
            details.hearingHistory.push(hearingEntry);
            console.log(`Found hearing: ${hearingEntry.date} - ${hearingEntry.proceedings.substring(0, 50)}...`);
          }
        });
      }
    });

    // Extract parties information and advocates
    $('div, section, .parties, .advocates').each((index, section) => {
      const $section = $(section);
      const sectionText = $section.text().toLowerCase();
      
      if (sectionText.includes('petitioner') || sectionText.includes('respondent') || 
          sectionText.includes('appellant') || sectionText.includes('plaintiff')) {
        
        // Extract party names and advocates
        const parties = $section.find('p, div, span').map((i, el) => $(el).text().trim()).get();
        parties.forEach(party => {
          if (party && party.length > 3) {
            if (sectionText.includes('petitioner') || sectionText.includes('appellant')) {
              details.parties.petitioner = party;
              console.log('Found petitioner:', party);
            } else if (sectionText.includes('respondent') || sectionText.includes('defendant')) {
              details.parties.respondent = party;
              console.log('Found respondent:', party);
            }
          }
        });
      }
      
      // Extract advocate information
      if (sectionText.includes('advocate') || sectionText.includes('counsel') || sectionText.includes('lawyer')) {
        const advocateText = $section.text().trim();
        // Look for patterns like "Advocate: Name" or "Counsel for Petitioner: Name"
        const advocateMatches = advocateText.match(/(?:advocate|counsel|lawyer)(?:\s+for\s+\w+)?:\s*([^,\n]+)/gi);
        if (advocateMatches) {
          advocateMatches.forEach((match, idx) => {
            const nameMatch = match.match(/:\s*([^,\n]+)/);
            if (nameMatch) {
              const advocateName = nameMatch[1].trim();
              if (advocateName && advocateName.length > 2) {
                details.advocates[`advocate${idx + 1}`] = advocateName;
                console.log(`Found advocate ${idx + 1}:`, advocateName);
              }
            }
          });
        }
      }
    });

    // Extract case number, title, and other key info from page title or headings
    if (pageTitle) {
      details.caseDetails.pageTitle = pageTitle.trim();
    }
    
    const mainHeading = $('h1, h2, .case-title, .page-title').first().text();
    if (mainHeading) {
      details.caseDetails.caseTitle = mainHeading.trim();
      console.log('Main heading:', mainHeading.trim());
    }

    // Extract case number pattern
    const allText = $.html();
    const caseNumberMatch = allText.match(/(\w+\.?\s*\w*\.?\s*)?(\d+)\s*\/\s*(\d{4})/);
    if (caseNumberMatch) {
      details.caseDetails.caseNumber = caseNumberMatch[0];
      details.caseDetails.caseYear = caseNumberMatch[3];
      console.log('Extracted case number:', caseNumberMatch[0]);
    }

    // Sort hearing history by date if possible
    details.hearingHistory.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateB - dateA; // Most recent first
      }
      return 0;
    });

    console.log(`=== PARSING COMPLETE ===`);
    console.log(`Found ${Object.keys(details.caseDetails).length} case details`);
    console.log(`Found ${details.hearingHistory.length} hearings`);
    console.log(`Found ${Object.keys(details.parties).length} parties`);
    console.log(`Found ${Object.keys(details.advocates).length} advocates`);

    return details;
  }

  // Create cases from SHC case details
  static async createCasesFromSHC(req, res) {
    try {
      const { cases } = req.body;
      const userId = req.user ? req.user.user_id : null;
      
      if (!cases || !Array.isArray(cases) || cases.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cases array is required and must not be empty'
        });
      }

      // Validate each case object
      for (let i = 0; i < cases.length; i++) {
        const caseObj = cases[i];
        if (!caseObj.id) {
          return res.status(400).json({
            success: false,
            message: `Case at index ${i} is missing required field: id`
          });
        }
      }

      const Case = require('../models/Case');
      const Lawyer = require('../models/Lawyer');
      const Party = require('../models/Party');
      const Hearing = require('../models/Hearing');
      const CaseLawyer = require('../models/CaseLawyer');
      const UserLawyer = require('../models/UserLawyer');
      const UserParty = require('../models/UserParty');
      
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: cases.length,
          created: 0,
          failed: 0
        }
      };

      // Process each case
      for (let i = 0; i < cases.length; i++) {
        const caseObj = cases[i];
        try {
          // Get case details using the same logic as getCaseDetails
          const caseDetails = await SHCSearchController.getCaseDetailsData(caseObj.id);
          if (!caseDetails) {
            results.failed.push({
              index: i,
              caseId: caseObj.id,
              error: 'Failed to retrieve case details from SHC system'
            });
            results.summary.failed++;
            continue;
          }

          // Extract required data from details
          const details = caseDetails.caseDetails;
          const caseNumber = details.caseNumber || caseObj.caseNo || '';
          const court = caseObj.circuitCode || 'Sindh High Court';
          const caseTitle = details.caseTitle || caseObj.caseTitle || '';
          const parties = `${caseDetails.parties.petitioner || ''} V/S ${caseDetails.parties.respondent || ''}`.trim();
          
          // Prepare case data for database creation
          let nextHearingDate = null;
          if (caseObj.nextDate && 
              caseObj.nextDate.trim() !== '' && 
              caseObj.nextDate.toUpperCase() !== 'NOT AVAILABLE' &&
              caseObj.nextDate.toUpperCase() !== 'N/A') {
            const parsedDate = new Date(caseObj.nextDate);
            if (!isNaN(parsedDate.getTime())) {
              nextHearingDate = parsedDate.toISOString().split('T')[0];
            }
          }

          const caseData = {
            shc_case_id: parseInt(caseObj.id),
            case_number: caseNumber,
            court_name: court,
            legal_section: caseObj.matter || null,
            case_type: caseObj.caseName || null,
            status: caseObj.status || null,
            next_hearing: nextHearingDate,
            filing_date: null,
            stage: null,
            description: caseTitle
          };

          // Check if case already exists (by SHC case ID)
          const existingCase = await Case.findBySHCCaseId(caseData.shc_case_id);
          if (existingCase) {
            results.failed.push({
              index: i,
              caseId: caseObj.id,
              error: 'Case already exists in database',
              existingCaseId: existingCase.case_id
            });
            results.summary.failed++;
            continue;
          }

          // Create the case
          const createdCase = await Case.create(caseData);
          const caseId = createdCase.case_id;

          // Create parties
          const createdParties = [];
          if (caseDetails.parties.petitioner && caseDetails.parties.petitioner.trim()) {
            try {
              const existingParties = await Party.findByName(caseDetails.parties.petitioner.trim());
              let petitioner = existingParties.find(p => 
                p.name.toLowerCase() === caseDetails.parties.petitioner.trim().toLowerCase()
              );
              
              if (!petitioner) {
                petitioner = await Party.create({
                  name: caseDetails.parties.petitioner.trim(),
                  cnic: null,
                  role: 'Petitioner',
                  email: null,
                  phone_number: null
                });
              }
              
              if (petitioner && petitioner.party_id) {
                createdParties.push(petitioner);
                
                // Create UserParty relationship
                try {
                  await UserParty.create({
                    user_id: userId,
                    party_id: petitioner.party_id
                  });
                } catch (error) {
                  if (!error.message.includes('already exists')) {
                    console.error(`Error creating user-party relationship for petitioner:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error creating petitioner for SHC case ${caseObj.id}:`, error);
            }
          }

          if (caseDetails.parties.respondent && caseDetails.parties.respondent.trim()) {
            try {
              const existingParties = await Party.findByName(caseDetails.parties.respondent.trim());
              let respondent = existingParties.find(p => 
                p.name.toLowerCase() === caseDetails.parties.respondent.trim().toLowerCase()
              );
              
              if (!respondent) {
                respondent = await Party.create({
                  name: caseDetails.parties.respondent.trim(),
                  cnic: null,
                  role: 'Respondent',
                  email: null,
                  phone_number: null
                });
              }
              
              if (respondent && respondent.party_id) {
                createdParties.push(respondent);
                
                // Create UserParty relationship
                try {
                  await UserParty.create({
                    user_id: userId,
                    party_id: respondent.party_id
                  });
                } catch (error) {
                  if (!error.message.includes('already exists')) {
                    console.error(`Error creating user-party relationship for respondent:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error creating respondent for SHC case ${caseObj.id}:`, error);
            }
          }

          // Create lawyers/advocates
          const createdLawyers = [];
          if (caseDetails.advocates) {
            for (const [advocateKey, advocateName] of Object.entries(caseDetails.advocates)) {
              if (advocateName && advocateName.trim()) {
                try {
                  // First try to find existing lawyer by exact name match
                  const existingLawyers = await Lawyer.findByName(advocateName.trim());
                  let lawyer = existingLawyers.find(l => 
                    l.name.toLowerCase() === advocateName.trim().toLowerCase()
                  );
                  
                  if (!lawyer) {
                    lawyer = await Lawyer.create({
                      name: advocateName.trim(),
                      license_no: null,
                      email: null,
                      phone_number: null
                    });
                  }
                  
                  if (lawyer && lawyer.lawyer_id) {
                    createdLawyers.push(lawyer);
                    
                    // Create UserLawyer relationship
                    try {
                      await UserLawyer.create({
                        user_id: userId,
                        lawyer_id: lawyer.lawyer_id
                      });
                    } catch (error) {
                      if (!error.message.includes('already exists')) {
                        console.error(`Error creating user-lawyer relationship for ${advocateName}:`, error);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Error creating lawyer "${advocateName}" for SHC case ${caseObj.id}:`, error);
                }
              }
            }
          }

          // Create case_lawyers relationships
          const createdCaseLawyers = [];
          if (createdLawyers.length > 0 && createdParties.length > 0) {
            for (const lawyer of createdLawyers) {
              if (!lawyer || !lawyer.lawyer_id) continue;
              for (const party of createdParties) {
                if (!party || !party.party_id) continue;
                try {
                  const caseLawyerRelation = await CaseLawyer.create({
                    case_id: caseId,
                    lawyer_id: lawyer.lawyer_id,
                    party_id: party.party_id,
                    user_id: userId
                  });
                  createdCaseLawyers.push(caseLawyerRelation);
                } catch (error) {
                  console.error(`Error creating case-lawyer relationship for SHC case ${caseObj.id} (lawyer: ${lawyer.lawyer_id}, party: ${party.party_id}):`, error);
                }
              }
            }
          }

          // Create hearings from hearing history
          const createdHearings = [];
          for (const hearingEntry of caseDetails.hearingHistory) {
            if (hearingEntry.date && hearingEntry.proceedings) {
              try {
                let hearingDate = null;
                if (hearingEntry.date) {
                  const parsedDate = new Date(hearingEntry.date);
                  if (!isNaN(parsedDate.getTime())) {
                    hearingDate = parsedDate.toISOString().split('T')[0];
                  }
                }

                if (hearingDate) {
                  const hearing = await Hearing.create({
                    case_id: caseId,
                    judge_id: null,
                    date: hearingDate,
                    description: hearingEntry.proceedings,
                    type: 'Regular'
                  });
                  createdHearings.push(hearing);
                }
              } catch (error) {
                console.error(`Error creating hearing for SHC case ${caseObj.id}:`, error);
              }
            }
          }

          results.successful.push({
            index: i,
            caseId: caseObj.id,
            createdCase: createdCase,
            createdLawyers: createdLawyers,
            createdParties: createdParties,
            createdCaseLawyers: createdCaseLawyers,
            createdHearings: createdHearings,
            caseDetails: caseDetails,
            summary: {
              lawyersCreated: createdLawyers.length,
              partiesCreated: createdParties.length,
              caseLawyersCreated: createdCaseLawyers.length,
              hearingsCreated: createdHearings.length
            }
          });
          results.summary.created++;
          
          console.log(`Successfully processed SHC case ${caseObj.id}: ${createdLawyers.length} lawyers, ${createdParties.length} parties, ${createdCaseLawyers.length} relationships, ${createdHearings.length} hearings`);

        } catch (error) {
          console.error(`Error processing SHC case at index ${i}:`, error);
          results.failed.push({
            index: i,
            caseId: caseObj.id,
            error: error.message
          });
          results.summary.failed++;
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.summary.total} SHC cases. Created: ${results.summary.created}, Failed: ${results.summary.failed}`,
        results: results
      });

    } catch (error) {
      console.error('Error in createCasesFromSHC:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Helper function to get case details data
  static async getCaseDetailsData(caseId) {
    try {
      const detailUrl = `https://cases.shc.gov.pk/khi/web/index.php?r=cases%2Fview&id=${caseId}`;

      const response = await axios.get(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        timeout: 15000
      });

      return SHCSearchController.parseCaseDetails(response.data);

    } catch (error) {
      console.error('Error getting SHC case details data:', error);
      return null;
    }
  }

  // Get SHC case categories
  static async getCaseCategories(req, res) {
    try {
      const categories = [
        "Civil Revision",
        "Criminal Revision",
        "Civil Appeal",
        "Criminal Appeal",
        "Constitutional Petition",
        "Writ Petition",
        "Civil Miscellaneous Application",
        "Criminal Miscellaneous Application",
        "Family Appeal",
        "Family Revision",
        "Service Appeal",
        "Service Revision",
        "Banking Appeal",
        "Banking Revision",
        "Labour Appeal",
        "Labour Revision",
        "Revenue Appeal",
        "Revenue Revision",
        "Suo Moto",
        "Reference"
      ];

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error in getCaseCategories:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get SHC benches
  static async getBenches(req, res) {
    try {
      const benches = [
        { value: "S", name: "Single Bench" },
        { value: "D", name: "Division Bench" },
        { value: "F", name: "Full Bench" },
        { value: "C", name: "Constitutional Bench" }
      ];

      res.json({
        success: true,
        data: benches
      });
    } catch (error) {
      console.error('Error in getBenches:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get SHC circuit codes (courts)
  static async getCircuitCodes(req, res) {
    try {
      const circuitCodes = [
        "Karachi",
        "Sukkur",
        "Hyderabad",
        "Larkana"
      ];

      res.json({
        success: true,
        data: circuitCodes
      });
    } catch (error) {
      console.error('Error in getCircuitCodes:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Debug endpoint to test SHC HTML parsing
  static async debugSHCResponse(req, res) {
    try {
      const testUrl = 'https://cases.shc.gov.pk/khi/web/index.php?r=cases%2Fsearch-result&CasesSearch[CASENO]=&CasesSearch[CASEYEAR]=1974&CasesSearch[CASECATEGORY]=Civil+Revision&CasesSearch[BENCH]=S&CasesSearch[CIRCUITCODE]=Karachi&CasesSearch[Pending]=3';
      
      console.log('Debug SHC URL:', testUrl);

      const response = await axios.get(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      
      // Analyze the HTML structure
      const analysis = {
        pageTitle: $('title').text(),
        bodyLength: response.data.length,
        tables: [],
        forms: [],
        scripts: $('script').length,
        divs: $('div').length
      };

      // Analyze tables
      $('table').each((index, table) => {
        const $table = $(table);
        const rows = $table.find('tr').length;
        const headers = $table.find('th').map((i, el) => $(el).text().trim()).get();
        const firstRowCells = $table.find('tr:first-child td').map((i, el) => $(el).text().trim()).get();
        
        analysis.tables.push({
          index,
          rows,
          headers,
          firstRowCells,
          classes: $table.attr('class') || '',
          id: $table.attr('id') || ''
        });
      });

      // Analyze forms
      $('form').each((index, form) => {
        const $form = $(form);
        const inputs = $form.find('input').map((i, el) => ({
          name: $(el).attr('name'),
          type: $(el).attr('type'),
          value: $(el).attr('value')
        })).get();
        
        analysis.forms.push({
          index,
          action: $form.attr('action'),
          method: $form.attr('method'),
          inputs
        });
      });

      res.json({
        success: true,
        message: 'SHC debug analysis completed',
        analysis,
        sampleHtml: response.data.substring(0, 2000), // First 2000 chars
        url: testUrl
      });

    } catch (error) {
      console.error('Error in debugSHCResponse:', error);
      res.status(500).json({
        success: false,
        message: 'Debug request failed',
        error: error.message
      });
    }
  }

  // Get nature of case options
  static async getNatureOfCaseOptions(req, res) {
    try {
      const natureOptions = [
        "Civil",
        "Criminal", 
        "Family",
        "Banking",
        "Labour",
        "Revenue",
        "Service",
        "Constitutional",
        "Administrative",
        "Commercial",
        "Tax",
        "Insurance"
      ];

      res.json({
        success: true,
        data: natureOptions
      });
    } catch (error) {
      console.error('Error in getNatureOfCaseOptions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get police station options
  static async getPoliceStations(req, res) {
    try {
      const policeStations = [
        "City Police Station",
        "Saddar Police Station", 
        "Garden Police Station",
        "Clifton Police Station",
        "Defence Police Station",
        "Gulshan Police Station",
        "North Nazimabad Police Station",
        "Korangi Police Station",
        "Landhi Police Station",
        "Shah Faisal Police Station",
        "Airport Police Station",
        "Boat Basin Police Station",
        "Frere Police Station",
        "Civil Lines Police Station",
        "Preedy Police Station"
      ];

      res.json({
        success: true,
        data: policeStations
      });
    } catch (error) {
      console.error('Error in getPoliceStations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = SHCSearchController;