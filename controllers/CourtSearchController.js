const axios = require('axios');
const cheerio = require('cheerio');

class CourtSearchController {
  // Search cases in Sindh District Courts
  static async searchCases(req, res) {
    try {
      const {
        district = '2', // Default to Karachi (South)
        caseno = '',
        caseyear = '',
        courttype = '0',
        casecategory = '0',
        policeStation = '0',
        firno = '',
        firyear = '',
        pname = '',
        status = [] // Array for status filtering
      } = req.body;

      // Prepare form data for the external API
      const formData = new URLSearchParams();
      formData.append('_token', process.env.COURT_SEARCH_TOKEN); // This might need to be dynamic
      formData.append('district', district);
      formData.append('caseno', caseno);
      formData.append('caseyear', caseyear);
      formData.append('courttype', courttype);
      formData.append('casecategory', casecategory);
      formData.append('policeStation', policeStation);
      formData.append('firno', firno);
      formData.append('firyear', firyear);
      formData.append('pname', pname);
      
      // Add status filters if provided
      if (status && status.length > 0) {
        status.forEach(s => formData.append('status[]', s));
      }

      // Make request to Sindh District Courts API
      const response = await axios.post('https://cases.districtcourtssindh.gos.pk/case-search', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://cases.districtcourtssindh.gos.pk',
          'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `XSRF-TOKEN=${process.env.COURT_SEARCH_XSRF_TOKEN}; cfms_dc_session=${process.env.COURT_SEARCH_SESSION}; _ga_BZC4TCD7C0=GS2.1.s1754219510$o2$g1$t1754219532$j38$l0$h0`
        },
        timeout: 30000 // 30 second timeout
      });

      // Parse the HTML response to extract case data
      const parsedData = CourtSearchController.parseSearchResults(response.data);

      res.json({
        success: true,
        message: 'Search completed successfully',
        searchParams: {
          district,
          caseno,
          caseyear,
          courttype,
          casecategory,
          policeStation,
          firno,
          firyear,
          pname,
          status
        },
        data: parsedData
      });

    } catch (error) {
      console.error('Error in searchCases:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'External court system is currently unavailable',
          error: 'Connection failed'
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'Search request timed out',
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
    const seenCaseCodes = new Set(); // Track duplicate case codes
    
    // Find the table with search results
    $('table.table-striped tbody tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 6) {
        const caseCode = $row.find('button.pview').attr('id') || null;
        
        // Skip if we've already seen this case code (duplicate handling)
        if (caseCode && seenCaseCodes.has(caseCode)) {
          console.log(`Skipping duplicate case with code: ${caseCode}`);
          return; // Skip this iteration
        }
        
        const caseData = {
          serialNumber: $(cells[0]).text().trim(),
          caseDetails: $(cells[1]).text().trim(),
          courtName: $(cells[2]).text().trim(),
          status: $(cells[3]).text().trim(),
          hearingDate: $(cells[4]).text().trim(),
          caseCode: caseCode
        };
        
        // Parse case details to extract case number, year, type, and parties
        const caseDetailsMatch = caseData.caseDetails.match(/^(.*?)\s+(\d+\/\d+),\s+(.+?)$/);
        if (caseDetailsMatch) {
          caseData.caseType = caseDetailsMatch[1].trim();
          caseData.caseNumber = caseDetailsMatch[2].trim();
          caseData.parties = caseDetailsMatch[3].trim();
        }
        
        // Parse status to extract status text and date
        const statusLines = caseData.status.split('\n').map(line => line.trim()).filter(line => line);
        if (statusLines.length >= 1) {
          caseData.statusText = statusLines[0];
          if (statusLines.length >= 2) {
            caseData.statusDate = statusLines[1];
          }
        }
        
        // Add case code to seen set to prevent duplicates
        if (caseCode) {
          seenCaseCodes.add(caseCode);
        }
        
        cases.push(caseData);
      }
    });
    
    return {
      totalResults: cases.length,
      cases: cases,
      duplicatesRemoved: seenCaseCodes.size < cases.length + seenCaseCodes.size
    };
  }

  // Get case profile details
  static async getCaseProfile(req, res) {
    try {
      const { caseCode } = req.body;
      
      if (!caseCode) {
        return res.status(400).json({
          success: false,
          message: 'Case code is required'
        });
      }

      // Prepare form data for case profile request
      const formData = new URLSearchParams();
      formData.append('_token', process.env.COURT_SEARCH_TOKEN);
      formData.append('casecode', caseCode);

      // Make request to get case profile
      const response = await axios.post('https://cases.districtcourtssindh.gos.pk/case-profile', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://cases.districtcourtssindh.gos.pk',
          'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `XSRF-TOKEN=${process.env.COURT_SEARCH_XSRF_TOKEN}; cfms_dc_session=${process.env.COURT_SEARCH_SESSION}; _ga_BZC4TCD7C0=GS2.1.s1754219510$o2$g1$t1754219532$j38$l0$h0`
        },
        timeout: 15000
      });

      // Parse the case profile HTML
      const profileData = CourtSearchController.parseCaseProfile(response.data);

      res.json({
        success: true,
        message: 'Case profile retrieved successfully',
        caseCode: caseCode,
        data: profileData
      });

    } catch (error) {
      console.error('Error in getCaseProfile:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'External court system is currently unavailable',
          error: 'Connection failed'
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'Case profile request timed out',
          error: 'Request timeout'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve case profile',
        error: error.message
      });
    }
  }

  // Parse case profile HTML
  static parseCaseProfile(htmlData) {
    const $ = cheerio.load(htmlData);
    
    const profile = {
      caseDetails: {},
      hearingHistory: []
    };

    // Parse Case Details from the first table
    const caseDetailTable = $('table').first();
    caseDetailTable.find('tbody tr').each((index, row) => {
      const $row = $(row);
      const cells = $row.find('th, td');
      
      if (cells.length >= 2) {
        // Handle rows with 2 columns (th-td pairs)
        if (cells.length === 2) {
          const key = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          if (key && value) {
            profile.caseDetails[key] = value;
          }
        }
        // Handle rows with 4 columns (th-td-th-td pairs)
        else if (cells.length === 4) {
          const key1 = $(cells[0]).text().trim();
          const value1 = $(cells[1]).text().trim();
          const key2 = $(cells[2]).text().trim();
          const value2 = $(cells[3]).text().trim();
          
          if (key1 && value1) {
            profile.caseDetails[key1] = value1;
          }
          if (key2 && value2) {
            profile.caseDetails[key2] = value2;
          }
        }
      }
    });

    // Parse Hearing History from the second table
    const hearingTable = $('table').eq(1);
    hearingTable.find('tbody tr').each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        const hearingEntry = {
          serialNumber: $(cells[0]).text().trim(),
          diary: $(cells[1]).text().trim(),
          date: $(cells[2]).find('kbd').text().trim() || $(cells[2]).text().trim()
        };
        
        // Clean up the diary text
        hearingEntry.diary = hearingEntry.diary.replace(/\s+/g, ' ').trim();
        
        profile.hearingHistory.push(hearingEntry);
      }
    });

    // Extract specific case information
    if (profile.caseDetails['Case No']) {
      const caseNoText = profile.caseDetails['Case No'];
      
      // Extract case number and parties
      const caseMatch = caseNoText.match(/^(.*?),\s+(.+?)\s+(\d+)$/);
      if (caseMatch) {
        profile.caseNumber = caseMatch[1].trim();
        profile.parties = caseMatch[2].trim();
        profile.caseCode = caseMatch[3].trim();
      }
    }

    // Sort hearing history by date (most recent first)
    profile.hearingHistory.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    return profile;
  }

  // Get districts list
  static async getDistricts(req, res) {
    try {
      const districts = [
        { value: "2", name: "Karachi (South)" },
        { value: "3", name: "Karachi(West)" },
        { value: "4", name: "Karachi (East)" },
        { value: "5", name: "Karachi (Central)" },
        { value: "6", name: "Karachi (Malir)" },
        { value: "7", name: "Hyderabad" },
        { value: "8", name: "Thatta" },
        { value: "9", name: "Badin" },
        { value: "10", name: "Dadu" },
        { value: "90", name: "Jamshoro @ Kotri" },
        { value: "11", name: "Tharparkar @ Mithi" },
        { value: "12", name: "Mirpurkhas" },
        { value: "93", name: "Umerkot" },
        { value: "13", name: "Sanghar" },
        { value: "14", name: "Naushahro Feroze" },
        { value: "15", name: "Shaheed Benazirabad" },
        { value: "16", name: "Sukkur" },
        { value: "17", name: "Khairpur" },
        { value: "18", name: "Ghotki" },
        { value: "19", name: "Larkana" },
        { value: "92", name: "KAMBER-SHAHDADKOT @ KAMBER" },
        { value: "20", name: "Shikarpur" },
        { value: "21", name: "Jacobabad" },
        { value: "91", name: "Kashmore @ Kandhkot" },
        { value: "221", name: "Tando Allahyar" },
        { value: "220", name: "Tando Muhammad Khan" },
        { value: "222", name: "Matiyari" },
        { value: "231", name: "Sujawal" }
      ];

      res.json({
        success: true,
        data: districts
      });
    } catch (error) {
      console.error('Error in getDistricts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create cases from profiles
  static async createCasesFromProfiles(req, res) {
    try {
      const { cases } = req.body;
      const userId = req.user ? req.user.user_id : null; // Extract user_id from auth middleware
      
      if (!cases || !Array.isArray(cases) || cases.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cases array is required and must not be empty'
        });
      }

      // Validate each case object
      for (let i = 0; i < cases.length; i++) {
        const caseObj = cases[i];
        if (!caseObj.caseCode) {
          return res.status(400).json({
            success: false,
            message: `Case at index ${i} is missing required field: caseCode`
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
          // Get case profile using the same logic as getCaseProfile
          const profileData = await CourtSearchController.getCaseProfileData(caseObj.caseCode);
          if (!profileData) {
            results.failed.push({
              index: i,
              caseCode: caseObj.caseCode,
              error: 'Failed to retrieve case profile from court system'
            });
            results.summary.failed++;
            continue;
          }

          // Extract required data from profile
          const caseDetails = profileData.caseDetails;
          const caseNo = caseDetails['Case No'] || '';
          const court = caseDetails['Court'] || '';
          const underSection = caseDetails['Under Section'] || '';
          const parties = profileData.parties || '';
          const advocate1 = caseDetails['Advocate 1'] || '';
          const advocate2 = caseDetails['Advocate 2'] || '';
          const hearingHistory = profileData.hearingHistory || [];

          // Prepare case data for database creation
          let nextHearingDate = null;
          if (caseObj.hearingDate && 
              caseObj.hearingDate.trim() !== '' && 
              caseObj.hearingDate.toUpperCase() !== 'NOT FOUND' &&
              caseObj.hearingDate.toUpperCase() !== 'N/A') {
            const parsedDate = new Date(caseObj.hearingDate);
            if (!isNaN(parsedDate.getTime())) {
              nextHearingDate = parsedDate.toISOString().split('T')[0];
            }
          }

          const caseData = {
            cfms_case_code: caseObj.caseCode, // Store as string to preserve full case code
            case_number: caseNo,
            court_name: court,
            legal_section: underSection,
            case_type: caseObj.caseType || null,
            status: caseObj.status || null,
            next_hearing: nextHearingDate,
            filing_date: null,
            stage: null,
            description: null
          };

          // Check if case already exists
          console.log(`DEBUG: Checking for existing case with CFMS code: ${caseData.cfms_case_code}`);
          const existingCase = await Case.findByCfmsCaseCode(caseData.cfms_case_code);
          console.log(`DEBUG: Existing case found:`, existingCase);
          
          if (existingCase) {
            console.log(`DEBUG: Case already exists - Case ID: ${existingCase.case_id}, Case Number: ${existingCase.case_number}`);
            results.failed.push({
              index: i,
              caseCode: caseObj.caseCode,
              error: 'Case already exists in database',
              existingCaseId: existingCase.case_id
            });
            results.summary.failed++;
            continue;
          }

          // Create the case
          const createdCase = await Case.create(caseData);
          const caseId = createdCase.case_id;

          // Create lawyers
          const createdLawyers = [];
          if (advocate1 && advocate1.trim()) {
            try {
              // First try to find existing lawyer by exact name match
              const existingLawyers = await Lawyer.findByName(advocate1.trim());
              let lawyer1 = existingLawyers.find(l => l.name.toLowerCase() === advocate1.trim().toLowerCase());
              
              if (!lawyer1) {
                lawyer1 = await Lawyer.create({
                  name: advocate1.trim(),
                  license_no: null,
                  email: null,
                  phone_number: null
                });
              }
              
              if (lawyer1 && lawyer1.lawyer_id) {
                createdLawyers.push(lawyer1);
                
                // Create UserLawyer relationship
                try {
                  await UserLawyer.create({
                    user_id: userId,
                    lawyer_id: lawyer1.lawyer_id
                  });
                } catch (error) {
                  // Ignore if relationship already exists
                  if (!error.message.includes('already exists')) {
                    console.error(`Error creating user-lawyer relationship for ${advocate1}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error creating Advocate 1 for case ${caseObj.caseCode}:`, error);
            }
          }

          if (advocate2 && advocate2.trim() && advocate2.trim() !== advocate1.trim()) {
            try {
              // First try to find existing lawyer by exact name match
              const existingLawyers = await Lawyer.findByName(advocate2.trim());
              let lawyer2 = existingLawyers.find(l => l.name.toLowerCase() === advocate2.trim().toLowerCase());
              
              if (!lawyer2) {
                lawyer2 = await Lawyer.create({
                  name: advocate2.trim(),
                  license_no: null,
                  email: null,
                  phone_number: null
                });
              }
              
              if (lawyer2 && lawyer2.lawyer_id) {
                createdLawyers.push(lawyer2);
                
                // Create UserLawyer relationship
                try {
                  await UserLawyer.create({
                    user_id: userId,
                    lawyer_id: lawyer2.lawyer_id
                  });
                } catch (error) {
                  // Ignore if relationship already exists
                  if (!error.message.includes('already exists')) {
                    console.error(`Error creating user-lawyer relationship for ${advocate2}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error creating Advocate 2 for case ${caseObj.caseCode}:`, error);
            }
          }

          // Create parties
          const createdParties = [];
          if (parties && parties.trim()) {
            const partiesArray = parties.split(/\s+V\/S\s+/i).map(p => p.trim()).filter(p => p);
            for (const partyName of partiesArray) {
              if (partyName) {
                try {
                  // First try to find existing party by exact name match
                  const existingParties = await Party.findByName(partyName);
                  let party = existingParties.find(p => p.name.toLowerCase() === partyName.toLowerCase());
                  
                  if (!party) {
                    party = await Party.create({
                      name: partyName,
                      cnic: null,
                      role: null,
                      email: null,
                      phone_number: null
                    });
                  }
                  
                  if (party && party.party_id) {
                    createdParties.push(party);
                    
                    // Create UserParty relationship
                    try {
                      await UserParty.create({
                        user_id: userId,
                        party_id: party.party_id
                      });
                    } catch (error) {
                      // Ignore if relationship already exists
                      if (!error.message.includes('already exists')) {
                        console.error(`Error creating user-party relationship for ${partyName}:`, error);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Error creating party "${partyName}" for case ${caseObj.caseCode}:`, error);
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
                  console.error(`Error creating case-lawyer relationship for case ${caseObj.caseCode} (lawyer: ${lawyer.lawyer_id}, party: ${party.party_id}):`, error);
                }
              }
            }
          } else {
            console.log(`No lawyers or parties to create relationships for case ${caseObj.caseCode}. Lawyers: ${createdLawyers.length}, Parties: ${createdParties.length}`);
          }

          // Create hearings
          const createdHearings = [];
          for (const hearingEntry of hearingHistory) {
            if (hearingEntry.date && hearingEntry.diary) {
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
                    description: hearingEntry.diary,
                    type: 'Regular'
                  });
                  createdHearings.push(hearing);
                }
              } catch (error) {
                console.error(`Error creating hearing for case ${caseObj.caseCode}:`, error);
              }
            }
          }

          results.successful.push({
            index: i,
            caseCode: caseObj.caseCode,
            createdCase: createdCase,
            createdLawyers: createdLawyers,
            createdParties: createdParties,
            createdCaseLawyers: createdCaseLawyers,
            createdHearings: createdHearings,
            profileData: {
              caseNo,
              court,
              underSection,
              parties,
              advocate1,
              advocate2,
              hearingHistoryCount: hearingHistory.length
            },
            summary: {
              lawyersCreated: createdLawyers.length,
              partiesCreated: createdParties.length,
              caseLawyersCreated: createdCaseLawyers.length,
              hearingsCreated: createdHearings.length
            }
          });
          results.summary.created++;
          
          console.log(`Successfully processed case ${caseObj.caseCode}: ${createdLawyers.length} lawyers, ${createdParties.length} parties, ${createdCaseLawyers.length} relationships, ${createdHearings.length} hearings`);

        } catch (error) {
          console.error(`Error processing case at index ${i}:`, error);
          results.failed.push({
            index: i,
            caseCode: caseObj.caseCode,
            error: error.message
          });
          results.summary.failed++;
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.summary.total} cases. Created: ${results.summary.created}, Failed: ${results.summary.failed}`,
        results: results
      });

    } catch (error) {
      console.error('Error in createCasesFromProfiles:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Helper function to get case profile data (extracted logic from getCaseProfile)
  static async getCaseProfileData(caseCode) {
    try {
      // Prepare form data for case profile request
      const formData = new URLSearchParams();
      formData.append('_token', process.env.COURT_SEARCH_TOKEN);
      formData.append('casecode', caseCode);

      // Make request to get case profile
      const response = await axios.post('https://cases.districtcourtssindh.gos.pk/case-profile', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://cases.districtcourtssindh.gos.pk',
          'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': `XSRF-TOKEN=${process.env.COURT_SEARCH_XSRF_TOKEN}; cfms_dc_session=${process.env.COURT_SEARCH_SESSION}; _ga_BZC4TCD7C0=GS2.1.s1754219510$o2$g1$t1754219532$j38$l0$h0`
        },
        timeout: 15000
      });

      // Parse the case profile HTML and return the data
      return CourtSearchController.parseCaseProfile(response.data);

    } catch (error) {
      console.error('Error getting case profile data:', error);
      return null;
    }
  }

  // Refresh all tokens (XSRF, Search Token, and Session)
  static async refreshTokens(req, res) {
    try {
      console.log('Starting token refresh process...');

      // Make a GET request to the court search homepage to get fresh tokens
      const response = await axios.get('https://cases.districtcourtssindh.gos.pk/case-search', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000
      });

      console.log('Received response from court search homepage');

      // Extract tokens from response
      const tokens = CourtSearchController.extractTokensFromResponse(response);

      if (!tokens.searchToken || !tokens.xsrfToken || !tokens.sessionToken) {
        console.log('Token extraction result:', tokens);
        return res.status(500).json({
          success: false,
          message: 'Failed to extract all required tokens',
          extractedTokens: {
            searchToken: !!tokens.searchToken,
            xsrfToken: !!tokens.xsrfToken,
            sessionToken: !!tokens.sessionToken
          },
          details: tokens
        });
      }

      // Update environment variables (runtime)
      process.env.COURT_SEARCH_TOKEN = tokens.searchToken;
      process.env.COURT_SEARCH_XSRF_TOKEN = tokens.xsrfToken;
      process.env.COURT_SEARCH_SESSION = tokens.sessionToken;

      // Update .env file
      const envUpdateResult = await CourtSearchController.updateEnvFile(tokens);

      console.log('Tokens successfully refreshed and updated in environment and .env file');

      res.json({
        success: true,
        message: 'All tokens refreshed successfully',
        tokens: {
          searchToken: tokens.searchToken,
          xsrfToken: tokens.xsrfToken,
          sessionToken: tokens.sessionToken
        },
        envFileUpdated: envUpdateResult.success,
        envUpdateMessage: envUpdateResult.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in refreshTokens:', error);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'Court system is currently unavailable',
          error: 'Connection failed'
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(504).json({
          success: false,
          message: 'Token refresh request timed out',
          error: 'Request timeout'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to refresh tokens',
        error: error.message
      });
    }
  }

  // Update .env file with new tokens
  static async updateEnvFile(tokens) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const envPath = path.join(__dirname, '..', '.env');
      
      // Read current .env file
      let envContent = await fs.readFile(envPath, 'utf8');
      
      // Update tokens in the content
      envContent = envContent.replace(
        /COURT_SEARCH_TOKEN=.*/,
        `COURT_SEARCH_TOKEN=${tokens.searchToken}`
      );
      
      envContent = envContent.replace(
        /COURT_SEARCH_XSRF_TOKEN=.*/,
        `COURT_SEARCH_XSRF_TOKEN=${tokens.xsrfToken}`
      );
      
      envContent = envContent.replace(
        /COURT_SEARCH_SESSION=.*/,
        `COURT_SEARCH_SESSION=${tokens.sessionToken}`
      );
      
      // Write updated content back to .env file
      await fs.writeFile(envPath, envContent, 'utf8');
      
      console.log('Successfully updated .env file with new tokens');
      
      return {
        success: true,
        message: '.env file updated successfully with fresh tokens'
      };
      
    } catch (error) {
      console.error('Error updating .env file:', error);
      return {
        success: false,
        message: `Failed to update .env file: ${error.message}`
      };
    }
  }

  // Extract tokens from the court search homepage response
  static extractTokensFromResponse(response) {
    const tokens = {
      searchToken: null,
      xsrfToken: null,
      sessionToken: null
    };

    try {
      // Extract CSRF token from HTML
      const $ = cheerio.load(response.data);
      const csrfMetaTag = $('meta[name="csrf-token"]');
      if (csrfMetaTag.length > 0) {
        tokens.searchToken = csrfMetaTag.attr('content');
        console.log('Extracted search token from meta tag');
      } else {
        // Try to find token in form inputs
        const tokenInput = $('input[name="_token"]');
        if (tokenInput.length > 0) {
          tokens.searchToken = tokenInput.attr('value');
          console.log('Extracted search token from form input');
        }
      }

      // Extract cookies from response headers
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
        setCookieHeaders.forEach(cookie => {
          // Extract XSRF-TOKEN
          const xsrfMatch = cookie.match(/XSRF-TOKEN=([^;]+)/);
          if (xsrfMatch) {
            tokens.xsrfToken = decodeURIComponent(xsrfMatch[1]);
            console.log('Extracted XSRF token from cookies');
          }

          // Extract session token
          const sessionMatch = cookie.match(/cfms_dc_session=([^;]+)/);
          if (sessionMatch) {
            tokens.sessionToken = decodeURIComponent(sessionMatch[1]);
            console.log('Extracted session token from cookies');
          }
        });
      }

      // Log what we found
      console.log('Token extraction summary:', {
        searchToken: tokens.searchToken ? 'Found' : 'Not found',
        xsrfToken: tokens.xsrfToken ? 'Found' : 'Not found',
        sessionToken: tokens.sessionToken ? 'Found' : 'Not found'
      });

    } catch (error) {
      console.error('Error extracting tokens:', error);
    }

    return tokens;
  }

  // Get court types
  static async getCourtTypes(req, res) {
    try {
      const courtTypes = [
        { value: "0", name: "NIL-Default Court Type" },
        { value: "1", name: "District Courts" },
        { value: "4", name: "Anti-Terrorism Courts" },
        { value: "5", name: "Anti Corruption Courts" },
        { value: "6", name: "Banking Courts" },
        { value: "7", name: "Labour Courts" },
        { value: "9", name: "Special Court (CNS)" },
        { value: "10", name: "Appellate Tribunal Sindh Revenue Board" },
        { value: "11", name: "Environmental Protection Tribunal" },
        { value: "13", name: "Accountability Courts" },
        { value: "14", name: "Custom, Taxation & Anti Smuggling Court" },
        { value: "15", name: "Drug Court" },
        { value: "16", name: "Customs, Excise & Sales Tax Appellate Tribunal" },
        { value: "18", name: "Special Court (Offence in Banks)" },
        { value: "19", name: "Special Court Commercial" },
        { value: "20", name: "Insurance Tribunal" },
        { value: "21", name: "Foreign Exchange Appellate Tribunal" },
        { value: "22", name: "Removal of Anti Encroachment" },
        { value: "23", name: "Federal Service Tribunal" },
        { value: "25", name: "Intellectual Property Tribunal" },
        { value: "26", name: "Appellate Tribunal Local Councils Sindh" },
        { value: "27", name: "Consumer Protection Court" },
        { value: "28", name: "Commercial Courts(Magistrate)" },
        { value: "29", name: "Gas Theft" }
      ];

      res.json({
        success: true,
        data: courtTypes
      });
    } catch (error) {
      console.error('Error in getCourtTypes:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = CourtSearchController;
