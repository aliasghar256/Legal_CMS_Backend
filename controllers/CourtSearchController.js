const axios = require('axios');
const cheerio = require('cheerio');
const { query } = require('../lib/db');
const Case = require('../models/Case');
const CaseLawyer = require('../models/CaseLawyer');

class CourtSearchController {
  // Store current tokens in memory (in production, consider using Redis)
  static currentTokens = {
    searchToken: null,
    xsrfToken: null,
    sessionToken: null,
    lastRefresh: null
  };

  // Fast internal token refresh
  static async refreshTokensInternal() {
    const response = await axios.get('https://cases.districtcourtssindh.gos.pk/case-search', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 8000
    });

    const tokens = CourtSearchController.extractTokensFromResponse(response);
    
    if (!tokens.searchToken || !tokens.xsrfToken || !tokens.sessionToken) {
      throw new Error('Failed to extract required tokens');
    }

    // Update in-memory tokens (faster than .env file I/O)
    CourtSearchController.currentTokens = tokens;
    console.log('✅ Tokens refreshed in memory');
  }

  // Centralized court search API request handler with automatic CSRF token refresh
  static async makeCourtSearchRequest(url, options = {}) {
    try {
      // Prepare request configuration with current tokens
      const currentTokens = CourtSearchController.currentTokens;
      const requestConfig = {
        method: options.method || 'GET',
        url: url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'Origin': 'https://cases.districtcourtssindh.gos.pk',
          'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers
        },
        timeout: options.timeout || 30000
      };

      // Add authentication cookies if tokens are available
      if (currentTokens.xsrfToken && currentTokens.sessionToken) {
        requestConfig.headers['Cookie'] = `XSRF-TOKEN=${currentTokens.xsrfToken}; cfms_dc_session=${currentTokens.sessionToken}; _ga_BZC4TCD7C0=GS2.1.s1754219510$o2$g1$t1754219532$j38$l0$h0`;
      }

      // Handle form data and token injection for POST requests
      if (options.formData) {
        const formData = options.formData;
        
        // Inject current search token
        if (currentTokens.searchToken) {
          formData.set('_token', currentTokens.searchToken);
        }
        
        requestConfig.data = formData.toString();
        requestConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (options.data) {
        requestConfig.data = options.data;
      }

      // Make the initial request
      const response = await axios(requestConfig);
      return response;
      
    } catch (error) {
      // Handle timeout errors with retry logic
      if (error.code === 'ECONNABORTED' && !options.isRetry) {
        console.log('⏰ Request timed out, retrying with increased timeout...');
        
        // Retry once with increased timeout
        const retryOptions = {
          ...options,
          timeout: 45000, // 45 seconds for retry
          isRetry: true
        };
        
        try {
          return await CourtSearchController.makeCourtSearchRequest(url, retryOptions);
        } catch (retryError) {
          console.log('❌ Retry also failed, giving up');
          throw retryError;
        }
      }
      
      // Only retry on CSRF token mismatch (419)
      if (error.response?.status === 419) {
        console.log('🔄 CSRF token mismatch (419), refreshing tokens and retrying...');
        
        // Refresh tokens and retry once
        await CourtSearchController.refreshTokensInternal();
        
        // Update request with new tokens
        const newTokens = CourtSearchController.currentTokens;
        const retryConfig = {
          method: options.method || 'GET',
          url: url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Origin': 'https://cases.districtcourtssindh.gos.pk',
            'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': `XSRF-TOKEN=${newTokens.xsrfToken}; cfms_dc_session=${newTokens.sessionToken}; _ga_BZC4TCD7C0=GS2.1.s1754219510$o2$g1$t1754219532$j38$l0$h0`,
            ...options.headers
          },
          timeout: options.timeout || 30000
        };

        // Re-inject fresh token for form data
        if (options.formData) {
          const formData = options.formData;
          formData.set('_token', newTokens.searchToken);
          retryConfig.data = formData.toString();
          retryConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (options.data) {
          retryConfig.data = options.data;
        }
        
        // Single retry with fresh tokens
        return await axios(retryConfig);
      }
      
      // For all other errors, throw immediately
      throw error;
    }
  }

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
      formData.append('_token', ''); // Will be set by makeCourtSearchRequest
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

      // Make request using centralized function with automatic token refresh
      const response = await CourtSearchController.makeCourtSearchRequest(
        'https://cases.districtcourtssindh.gos.pk/case-search',
        {
          method: 'POST',
          formData: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Court search request successful');

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
      
      // Handle specific error messages from our auto-retry system
      if (error.message.includes('Court system is temporarily unavailable')) {
        return res.status(522).json({
          success: false,
          message: 'Court system is temporarily unavailable',
          error: 'The external court system is experiencing timeout issues. Please try again in a few minutes.',
          retryAfter: 300 // Suggest retry after 5 minutes
        });
      }
      
      if (error.message.includes('Court system is currently under maintenance')) {
        return res.status(503).json({
          success: false,
          message: 'Court system is under maintenance',
          error: 'The external court system is currently under maintenance. Please try again later.'
        });
      }
      
      if (error.message.includes('Court system is experiencing server issues')) {
        return res.status(500).json({
          success: false,
          message: 'Court system server error',
          error: 'The external court system is experiencing technical difficulties. Please try again later.'
        });
      }
      
      // Handle network-level errors
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
          message: 'Court system response timeout',
          error: 'The court system is taking longer than usual to respond. This is likely due to high traffic or slow servers on their end. Please try again in a few minutes.',
          suggestion: 'Consider trying your search again in 2-3 minutes when the court system may be less busy.',
          retryAfter: 180 // Suggest retry after 3 minutes
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Parse HTML response to extract structured case data (optimized for performance)
  static parseSearchResults(htmlData) {
    const $ = cheerio.load(htmlData, {
      xmlMode: false,
      decodeEntities: false // Faster parsing
    });
    
    const cases = [];
    const seenCaseCodes = new Set(); // Track duplicate case codes
    
    // Find the table with search results - use more specific selector for speed
    const rows = $('table.table-striped tbody tr');
    
    rows.each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 6) {
        const caseCode = $row.find('button.pview').attr('id') || null;
        
        // Skip if we've already seen this case code (duplicate handling)
        if (caseCode && seenCaseCodes.has(caseCode)) {
          console.log(`Skipping duplicate case with code: ${caseCode}`);
          return; // Skip this iteration
        }
        
        // Extract text more efficiently
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
      formData.append('_token', ''); // Will be set by makeCourtSearchRequest
      formData.append('casecode', caseCode);

      // Make request using centralized function with automatic token refresh
      const response = await CourtSearchController.makeCourtSearchRequest(
        'https://cases.districtcourtssindh.gos.pk/case-profile',
        {
          method: 'POST',
          formData: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }
        }
      );

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

  // Parse case profile HTML (optimized for performance)
  static parseCaseProfile(htmlData) {
    const $ = cheerio.load(htmlData, {
      xmlMode: false,
      decodeEntities: false // Faster parsing
    });
    
    // DEBUG: Log all tables found
    console.log(`DEBUG: Found ${$('table').length} tables in HTML`);
    $('table').each((index, table) => {
      const $table = $(table);
      const tableText = $table.text().substring(0, 200).replace(/\s+/g, ' ').trim();
      console.log(`DEBUG: Table ${index + 1}: "${tableText}..."`);
    });
    
    const profile = {
      caseDetails: {},
      hearingHistory: []
    };

    // Parse Case Details from the first table - use more specific selectors
    const caseDetailTable = $('table').first();
    const detailRows = caseDetailTable.find('tbody tr');
    
    detailRows.each((index, row) => {
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

    // Parse Hearing History - specifically look for S.No, Diary, Date structure
    console.log(`DEBUG: Looking for hearing tables with S.No/Diary/Date structure...`);
    
    // Look for tables that contain hearing data
    let hearingEntries = [];
    
    $('table').each((tableIndex, table) => {
      const $table = $(table);
      
      // Check if this table has the hearing structure (S.No, Diary, Date)
      const firstRow = $table.find('tr').first();
      const headers = firstRow.find('th, td').map((i, el) => $(el).text().trim().toLowerCase()).get();
      console.log(`DEBUG: Table ${tableIndex + 1} first row:`, headers);
      
      // Look for S.No/Serial, Diary, Date pattern or check if table contains date patterns
      const hasSerialCol = headers.some(h => h.includes('s.no') || h.includes('serial') || h.includes('sr'));
      const hasDiaryCol = headers.some(h => h.includes('diary'));
      const hasDateCol = headers.some(h => h.includes('date'));
      
      console.log(`DEBUG: Table ${tableIndex + 1} analysis - Serial: ${hasSerialCol}, Diary: ${hasDiaryCol}, Date: ${hasDateCol}`);
      
      // Check if table contains date patterns even if headers don't match
      const tableText = $table.text();
      const hasDatePattern = /\d{1,2}\/\w{3}\/\d{4}/.test(tableText);
      console.log(`DEBUG: Table ${tableIndex + 1} has date pattern: ${hasDatePattern}`);
      
      if ((hasSerialCol && hasDiaryCol && hasDateCol) || hasDatePattern) {
        console.log(`DEBUG: Processing table ${tableIndex + 1} as hearing table`);
        
        // Process all rows in this table
        $table.find('tr').each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          
          // Skip header rows or rows with insufficient cells
          if (cells.length < 3) {
            return;
          }
          
          // Extract data from cells
          const serialNumber = $(cells[0]).text().trim();
          const diary = $(cells[1]).text().trim();
          const dateCell = $(cells[2]).text().trim();
          
          // Look for date pattern in any cell if not found in expected position
          let rawDate = dateCell;
          if (!rawDate.match(/\d{1,2}[\/\-]\w{3}[\/\-]\d{4}/)) {
            for (let i = 0; i < cells.length; i++) {
              const cellText = $(cells[i]).text().trim();
              if (cellText.match(/\d{1,2}[\/\-]\w{3}[\/\-]\d{4}/)) {
                rawDate = cellText;
                break;
              }
            }
          }
          
          console.log(`DEBUG: Row ${rowIndex + 1} - Serial: "${serialNumber}", Diary: "${diary.substring(0, 30)}...", Date: "${rawDate}"`);
          
          // Only process rows that look like data (not headers)
          if (serialNumber && (diary.length > 5 || rawDate.match(/\d{1,2}[\/\-]\w{3}[\/\-]\d{4}/))) {
            // Parse the date
            let normalizedDate = null;
            if (rawDate) {
              const dateFormats = [
                /(\d{1,2})\/(\w{3})\/(\d{4})/,  // 27/Sep/2025
                /(\d{1,2})-(\w{3})-(\d{4})/,   // 27-Sep-2025
              ];
              
              for (const format of dateFormats) {
                const match = rawDate.match(format);
                if (match) {
                  const day = match[1].padStart(2, '0');
                  const monthAbbr = match[2];
                  const year = match[3];
                  
                  const monthMap = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                  };
                  
                  if (monthMap[monthAbbr]) {
                    normalizedDate = `${year}-${monthMap[monthAbbr]}-${day}`;
                  }
                  break;
                }
              }
            }
            
            const hearingEntry = {
              serialNumber: serialNumber,
              diary: diary.replace(/\s+/g, ' ').trim(),
              date: normalizedDate || rawDate,
              originalDate: rawDate
            };
            
            if (normalizedDate || diary.length > 10) {
              hearingEntries.push(hearingEntry);
              console.log(`✅ Added hearing: ${rawDate} -> ${normalizedDate} | Diary: "${hearingEntry.diary.substring(0, 50)}..."`);
            }
          }
        });
      }
    });
    
    profile.hearingHistory = hearingEntries;

    // Extract specific case information
    if (profile.caseDetails['Case No']) {
      const caseNoText = profile.caseDetails['Case No'];
      
      // Extract case number and parties (case code may be followed by trailing
      // text like "Not Scanned", so don't anchor the digits to end-of-string)
      const caseMatch = caseNoText.match(/^(.*?),\s+(.+?)\s+(\d+)/);
      if (caseMatch) {
        profile.caseNumber = caseMatch[1].trim();
        profile.parties = caseMatch[2].trim();
        profile.caseCode = caseMatch[3].trim();
      }
    }

    // Sort hearing history by date (most recent first) - more efficient sorting
    if (profile.hearingHistory.length > 1) {
      profile.hearingHistory.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
    }

    return profile;
  }

  // Get districts list (cached for performance)
  static async getDistricts(req, res) {
    try {
      // Set cache headers for 1 hour since districts rarely change
      res.set('Cache-Control', 'public, max-age=3600');
      
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

  // Update case hearings from court profiles
  static async updateCaseHearings(req, res) {
    try {
      const { caseIds } = req.body;
      const userId = req.user ? req.user.user_id : null;
      
      if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Case IDs array is required and must not be empty'
        });
      }

      // Call the core logic function
      const results = await CourtSearchController.updateCaseHearingsCore(caseIds, userId);

      res.json({
        success: true,
        message: `Processed ${results.summary.total} cases. Updated: ${results.summary.updated}, Failed: ${results.summary.failed}`,
        results: results
      });

    } catch (error) {
      console.error('Error in updateCaseHearings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  // Core logic for updating case hearings (without HTTP request/response handling)
  static async updateCaseHearingsCore(caseIds, userId) {
    const Case = require('../models/Case');
    const Hearing = require('../models/Hearing');
    const { query } = require('../lib/db');
    
    const results = {
      successful: [],
      failed: [],
      summary: {
        total: caseIds.length,
        updated: 0,
        failed: 0
      }
    };

    // Process each case ID
    for (let i = 0; i < caseIds.length; i++) {
      const caseId = caseIds[i];
      try {
        // Get case details from database
        const caseResult = await query(
          'SELECT * FROM cases WHERE case_id = $1',
          [caseId]
        );
        
        if (caseResult.rows.length === 0) {
          results.failed.push({
            index: i,
            caseId: caseId,
            error: 'Case not found in database'
          });
          results.summary.failed++;
          continue;
        }
        
        const caseData = caseResult.rows[0];
        
        // Check if user has access to this case
        const userAccess = await query(
          'SELECT * FROM case_lawyers WHERE case_id = $1 AND user_id = $2',
          [caseId, userId]
        );
        
        if (userAccess.rows.length === 0) {
          results.failed.push({
            index: i,
            caseId: caseId,
            error: 'Access denied: Case not associated with your account'
          });
          results.summary.failed++;
          continue;
        }

        // Get case profile from court system using CFMS case code
        if (!caseData.cfms_case_code) {
          results.failed.push({
            index: i,
            caseId: caseId,
            error: 'Case does not have CFMS case code'
          });
          results.summary.failed++;
          continue;
        }

        const profileData = await CourtSearchController.getCaseProfileData(caseData.cfms_case_code);
        if (!profileData || !profileData.hearingHistory) {
          results.failed.push({
            index: i,
            caseId: caseId,
            error: 'Failed to retrieve case profile from court system'
          });
          results.summary.failed++;
          continue;
        }

        // Get existing hearings from database, ordered by date
        const existingHearingsResult = await query(
          'SELECT * FROM hearings WHERE case_id = $1 ORDER BY date ASC',
          [caseId]
        );
        const existingHearings = existingHearingsResult.rows;

        // Remove duplicates from profile hearings before processing
        const profileHearings = CourtSearchController.removeDuplicateHearings(profileData.hearingHistory);
        
        // For cases where we have incorrect data in DB, clear existing hearings and re-add from profile
        // This ensures we have the correct dates and content
        if (profileHearings.length > 0) {
          console.log(`Clearing existing hearings for case ${caseId} to avoid date conflicts...`);
          try {
            await query('DELETE FROM hearings WHERE case_id = $1', [caseId]);
            console.log(`Cleared existing hearings for case ${caseId}`);
          } catch (error) {
            console.error(`Error clearing hearings for case ${caseId}:`, error);
          }
        }
        
        let updatedHearings = 0;
        let addedHearings = 0;
        let caseStatusUpdated = false;
        let nextHearingUpdated = false;

        // Add all hearings from profile (since we cleared existing ones)
        for (const profileHearing of profileHearings) {
          if (!profileHearing.date) continue;

          const hearingDate = profileHearing.date; // Already normalized
          const profileDiary = (profileHearing.diary || '').trim();

          try {
            const newHearing = await Hearing.create({
              case_id: caseId,
              judge_id: null,
              date: hearingDate,
              description: profileDiary,
              type: 'Regular'
            });
            addedHearings++;
            console.log(`Added hearing for case ${caseId} on ${hearingDate} with: ${profileDiary || 'BLANK'}`);
          } catch (error) {
            console.error(`Error creating hearing for case ${caseId} on ${hearingDate}:`, error);
          }
        }

        // Determine case status and next hearing date based on latest hearing in profile
        if (profileHearings.length > 0) {
          // Sort profile hearings by date to find the latest one
          const sortedProfileHearings = profileHearings
            .filter(h => h.date && !isNaN(new Date(h.date).getTime()))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

          if (sortedProfileHearings.length > 0) {
            const latestProfileHearing = sortedProfileHearings[0];
            const latestProfileDiary = (latestProfileHearing.diary || '').trim();

            if (latestProfileDiary) {
              // Latest hearing is not blank - case is disposed
              try {
                await query(
                  'UPDATE cases SET status = $1, next_hearing = NULL WHERE case_id = $2',
                  ['Disposed', caseId]
                );
                caseStatusUpdated = true;
                console.log(`Updated case ${caseId} status to Disposed`);
              } catch (error) {
                console.error(`Error updating case status for case ${caseId}:`, error);
              }
            } else {
              // Latest hearing is blank - set next hearing date
              const latestDate = new Date(latestProfileHearing.date).toISOString().split('T')[0];
              try {
                await query(
                  'UPDATE cases SET next_hearing = $1 WHERE case_id = $2',
                  [latestDate, caseId]
                );
                nextHearingUpdated = true;
                console.log(`Updated next hearing date for case ${caseId} to ${latestDate}`);
              } catch (error) {
                console.error(`Error updating next hearing date for case ${caseId}:`, error);
              }
            }
          }
        }

        results.successful.push({
          index: i,
          caseId: caseId,
          caseNumber: caseData.case_number,
          cfmsCaseCode: caseData.cfms_case_code,
          updatedHearings: updatedHearings,
          addedHearings: addedHearings,
          caseStatusUpdated: caseStatusUpdated,
          nextHearingUpdated: nextHearingUpdated,
          totalProfileHearings: profileData.hearingHistory ? profileData.hearingHistory.length : 0,
          uniqueProfileHearings: profileHearings.length,
          duplicatesRemoved: (profileData.hearingHistory ? profileData.hearingHistory.length : 0) - profileHearings.length,
          message: `Updated ${updatedHearings} hearings, added ${addedHearings} new hearings`
        });
        results.summary.updated++;

      } catch (error) {
        console.error(`Error processing case ${caseId}:`, error);
        results.failed.push({
          index: i,
          caseId: caseId,
          error: error.message
        });
        results.summary.failed++;
      }
    }

    return results;
  }

  // Create cases from court profiles with enhanced date parsing
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
            // Use the enhanced date parsing function for consistency
            nextHearingDate = CourtSearchController.parseCourtDate(caseObj.hearingDate);
            console.log(`DEBUG: Parsed hearing date "${caseObj.hearingDate}" -> "${nextHearingDate}"`);
          }

          // If no hearing date from request, try to get latest blank hearing from profile
          if (!nextHearingDate && hearingHistory && hearingHistory.length > 0) {
            const latestBlankHearing = hearingHistory
              .filter(h => h.date && (!h.diary || h.diary.trim() === ''))
              .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
            if (latestBlankHearing) {
              nextHearingDate = latestBlankHearing.date;
              console.log(`DEBUG: Using latest blank hearing as next hearing: "${nextHearingDate}"`);
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
            
            // Check if the current user is already connected to this case
            const userCaseConnection = await query(
              'SELECT * FROM case_lawyers WHERE case_id = $1 AND user_id = $2',
              [existingCase.case_id, userId]
            );
            
            if (userCaseConnection.rows.length > 0) {
              // User is already connected to this case
              results.failed.push({
                index: i,
                caseCode: caseObj.caseCode,
                error: 'Case already exists and is connected to your account',
                existingCaseId: existingCase.case_id
              });
              results.summary.failed++;
              continue;
            } else {
              // Case exists but user is not connected - create the connection
              console.log(`DEBUG: Case exists but user not connected. Creating connection for user ${userId}`);
              
              // Create/find lawyers from the case profile
              const createdLawyers = [];
              if (advocate1 && advocate1.trim()) {
                try {
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
                      if (!error.message.includes('already exists')) {
                        console.error(`Error creating user-lawyer relationship for ${advocate1}:`, error);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Error creating Advocate 1 for existing case ${caseObj.caseCode}:`, error);
                }
              }

              if (advocate2 && advocate2.trim() && advocate2.trim() !== advocate1.trim()) {
                try {
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
                    
                    try {
                      await UserLawyer.create({
                        user_id: userId,
                        lawyer_id: lawyer2.lawyer_id
                      });
                    } catch (error) {
                      if (!error.message.includes('already exists')) {
                        console.error(`Error creating user-lawyer relationship for ${advocate2}:`, error);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`Error creating Advocate 2 for existing case ${caseObj.caseCode}:`, error);
                }
              }

              // Create/find parties from the case profile
              const createdParties = [];
              if (parties && parties.trim()) {
                const partiesArray = parties.split(/\s+V\/S\s+/i).map(p => p.trim()).filter(p => p);
                for (const partyName of partiesArray) {
                  if (partyName) {
                    try {
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
                        
                        try {
                          await UserParty.create({
                            user_id: userId,
                            party_id: party.party_id
                          });
                        } catch (error) {
                          if (!error.message.includes('already exists')) {
                            console.error(`Error creating user-party relationship for ${partyName}:`, error);
                          }
                        }
                      }
                    } catch (error) {
                      console.error(`Error creating party "${partyName}" for existing case ${caseObj.caseCode}:`, error);
                    }
                  }
                }
              }

              // Connect the existing case to the user through case_lawyers table
              const createdCaseLawyers = [];
              if (createdLawyers.length > 0 && createdParties.length > 0) {
                // Create connections for each lawyer-party combination
                for (const lawyer of createdLawyers) {
                  if (!lawyer || !lawyer.lawyer_id) continue;
                  for (const party of createdParties) {
                    if (!party || !party.party_id) continue;
                    try {
                      // Check if this specific case-lawyer-party-user combination already exists
                      const existingRelation = await query(
                        'SELECT * FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2 AND party_id = $3 AND user_id = $4',
                        [existingCase.case_id, lawyer.lawyer_id, party.party_id, userId]
                      );
                      
                      if (existingRelation.rows.length === 0) {
                        // Check if case-lawyer-party exists for ANY user
                        const anyUserRelation = await query(
                          'SELECT * FROM case_lawyers WHERE case_id = $1 AND lawyer_id = $2 AND party_id = $3',
                          [existingCase.case_id, lawyer.lawyer_id, party.party_id]
                        );
                        
                        if (anyUserRelation.rows.length > 0) {
                          // Update existing relation to include this user
                          await query(
                            'UPDATE case_lawyers SET user_id = $1 WHERE case_id = $2 AND lawyer_id = $3 AND party_id = $4',
                            [userId, existingCase.case_id, lawyer.lawyer_id, party.party_id]
                          );
                          console.log(`Updated existing case-lawyer-party relationship to include user ${userId}`);
                        } else {
                          // Create new relation
                          const caseLawyerRelation = await CaseLawyer.create({
                            case_id: existingCase.case_id,
                            lawyer_id: lawyer.lawyer_id,
                            party_id: party.party_id,
                            user_id: userId
                          });
                          createdCaseLawyers.push(caseLawyerRelation);
                        }
                      } else {
                        console.log(`Case-lawyer-party relationship already exists for user ${userId}`);
                      }
                    } catch (error) {
                      console.error(`Error creating case-lawyer relationship for existing case ${caseObj.caseCode}:`, error);
                    }
                  }
                }
              } else if (createdParties.length > 0) {
                // If we have parties but no lawyers, create relationships with null lawyer_id
                for (const party of createdParties) {
                  if (!party || !party.party_id) continue;
                  try {
                    // Check if this specific case-party-user combination already exists (with null lawyer)
                    const existingRelation = await query(
                      'SELECT * FROM case_lawyers WHERE case_id = $1 AND lawyer_id IS NULL AND party_id = $2 AND user_id = $3',
                      [existingCase.case_id, party.party_id, userId]
                    );
                    
                    if (existingRelation.rows.length === 0) {
                      // Check if case-party exists for ANY user (with null lawyer)
                      const anyUserRelation = await query(
                        'SELECT * FROM case_lawyers WHERE case_id = $1 AND lawyer_id IS NULL AND party_id = $2',
                        [existingCase.case_id, party.party_id]
                      );
                      
                      if (anyUserRelation.rows.length > 0) {
                        // Update existing relation to include this user
                        await query(
                          'UPDATE case_lawyers SET user_id = $1 WHERE case_id = $2 AND lawyer_id IS NULL AND party_id = $3',
                          [userId, existingCase.case_id, party.party_id]
                        );
                        console.log(`Updated existing case-party relationship (no lawyer) to include user ${userId}`);
                      } else {
                        // Create new relation
                        const caseLawyerRelation = await CaseLawyer.create({
                          case_id: existingCase.case_id,
                          lawyer_id: null,
                          party_id: party.party_id,
                          user_id: userId
                        });
                        createdCaseLawyers.push(caseLawyerRelation);
                      }
                    } else {
                      console.log(`Case-party relationship (no lawyer) already exists for user ${userId}`);
                    }
                  } catch (error) {
                    console.error(`Error creating case-party relationship for existing case ${caseObj.caseCode}:`, error);
                  }
                }
              }

              // Add any new hearings using the existing updateCaseHearings logic
              const createdHearings = [];
              if (hearingHistory && hearingHistory.length > 0) {
                try {
                  console.log(`DEBUG: Calling updateCaseHearings for existing case ${existingCase.case_id}`);
                  
                  // Simulate the updateCaseHearings logic for this single case
                  const Case = require('../models/Case');
                  const Hearing = require('../models/Hearing');
                  
                  // Get case profile data (we already have it)
                  const profileData = { hearingHistory: hearingHistory };
                  
                  // Get existing hearings from database
                  const existingHearings = await query(
                    'SELECT date, description FROM hearings WHERE case_id = $1',
                    [existingCase.case_id]
                  );
                  
                  // Remove duplicates from profile hearings before processing
                  const profileHearings = CourtSearchController.removeDuplicateHearings(profileData.hearingHistory);
                  
                  // Clear existing hearings and re-add from profile to ensure accuracy
                  if (profileHearings.length > 0) {
                    console.log(`Clearing existing hearings for case ${existingCase.case_id} to avoid date conflicts...`);
                    await query('DELETE FROM hearings WHERE case_id = $1', [existingCase.case_id]);
                    console.log(`Cleared existing hearings for case ${existingCase.case_id}`);
                  }
                  
                  let addedHearings = 0;
                  
                  // Add all hearings from profile
                  for (const profileHearing of profileHearings) {
                    if (!profileHearing.date) continue;

                    const hearingDate = profileHearing.date; // Already normalized
                    const profileDiary = (profileHearing.diary || '').trim();

                    try {
                      const newHearing = await Hearing.create({
                        case_id: existingCase.case_id,
                        judge_id: null,
                        date: hearingDate,
                        description: profileDiary,
                        type: 'Regular'
                      });
                      createdHearings.push(newHearing);
                      addedHearings++;
                      console.log(`Added hearing for case ${existingCase.case_id} on ${hearingDate} with: ${profileDiary || 'BLANK'}`);
                    } catch (error) {
                      console.error(`Error creating hearing for case ${existingCase.case_id} on ${hearingDate}:`, error);
                    }
                  }

                  // Update case status and next hearing date based on latest hearing
                  if (profileHearings.length > 0) {
                    const sortedProfileHearings = profileHearings
                      .filter(h => h.date && !isNaN(new Date(h.date).getTime()))
                      .sort((a, b) => new Date(b.date) - new Date(a.date));

                    if (sortedProfileHearings.length > 0) {
                      const latestProfileHearing = sortedProfileHearings[0];
                      const latestProfileDiary = (latestProfileHearing.diary || '').trim();

                      if (latestProfileDiary) {
                        // Latest hearing is not blank - case is disposed
                        await query(
                          'UPDATE cases SET status = $1, next_hearing = NULL WHERE case_id = $2',
                          ['Disposed', existingCase.case_id]
                        );
                        console.log(`Updated case ${existingCase.case_id} status to Disposed`);
                      } else {
                        // Latest hearing is blank - set next hearing date
                        const latestDate = new Date(latestProfileHearing.date).toISOString().split('T')[0];
                        await query(
                          'UPDATE cases SET next_hearing = $1 WHERE case_id = $2',
                          [latestDate, existingCase.case_id]
                        );
                        console.log(`Updated next hearing date for case ${existingCase.case_id} to ${latestDate}`);
                      }
                    }
                  }
                  
                  console.log(`Successfully updated hearings for existing case ${existingCase.case_id}: ${addedHearings} hearings added`);
                  
                } catch (error) {
                  console.error(`Error updating hearings for existing case ${caseObj.caseCode}:`, error);
                }
              }

              results.successful.push({
                index: i,
                caseCode: caseObj.caseCode,
                createdCase: null, // Case already existed
                existingCase: existingCase,
                createdLawyers: createdLawyers,
                createdParties: createdParties,
                createdCaseLawyers: createdCaseLawyers,
                createdHearings: createdHearings,
                message: `Connected existing case to your account. Added ${createdHearings.length} new hearings.`
              });
              results.summary.created++;
              
              console.log(`Successfully connected existing case ${caseObj.caseCode} to user ${userId}`);
              continue; // Skip creating a new case
            }
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
          } else if (createdParties.length > 0) {
            // If we have parties but no lawyers, create relationships with null lawyer_id
            // This ensures the case appears in user queries
            for (const party of createdParties) {
              if (!party || !party.party_id) continue;
              try {
                const caseLawyerRelation = await CaseLawyer.create({
                  case_id: caseId,
                  lawyer_id: null, // No lawyer for this case
                  party_id: party.party_id,
                  user_id: userId
                });
                createdCaseLawyers.push(caseLawyerRelation);
              } catch (error) {
                console.error(`Error creating case-party relationship for case ${caseObj.caseCode} (party: ${party.party_id}):`, error);
              }
            }
            console.log(`Created case-party relationships for case ${caseObj.caseCode} with no lawyers. Parties: ${createdParties.length}`);
          } else {
            console.log(`No lawyers or parties to create relationships for case ${caseObj.caseCode}. Lawyers: ${createdLawyers.length}, Parties: ${createdParties.length}`);
          }

          // Create hearings
          const createdHearings = [];
          console.log(`DEBUG: Creating hearings for case ${caseObj.caseCode}. Hearing history count: ${hearingHistory.length}`);
          
          for (const hearingEntry of hearingHistory) {
            // Create hearing if we have a date, even if diary is empty
            if (hearingEntry.date) {
              try {
                // Use the enhanced date parsing function
                let hearingDate = CourtSearchController.parseCourtDate(hearingEntry.date);
                console.log(`DEBUG: Processing hearing date "${hearingEntry.date}" -> "${hearingDate}"`);

                if (hearingDate) {
                  const hearing = await Hearing.create({
                    case_id: caseId,
                    judge_id: null,
                    date: hearingDate,
                    description: hearingEntry.diary || '', // Allow empty diary entries
                    type: 'Regular'
                  });
                  createdHearings.push(hearing);
                  console.log(`DEBUG: Created hearing for ${hearingDate} with diary: "${hearingEntry.diary || 'BLANK'}"`);
                } else {
                  console.warn(`DEBUG: Could not parse hearing date: "${hearingEntry.date}"`);
                }
              } catch (error) {
                console.error(`Error creating hearing for case ${caseObj.caseCode}:`, error);
              }
            } else {
              console.warn(`DEBUG: Hearing entry has no date:`, hearingEntry);
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


  // Helper function to parse court system dates with multiple format support
  static parseCourtDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const cleanDate = dateString.trim();
    if (!cleanDate || cleanDate === 'No Date Fixed' || cleanDate === 'BLANK') {
      return null;
    }

    console.log(`DEBUG: Parsing date: "${cleanDate}"`);

    // Handle various date formats that might come from the court system
    const dateFormats = [
      /(\d{1,2})\/(\w{3})\/(\d{4})/,  // 27/Sep/2025
      /(\d{1,2})-(\w{3})-(\d{4})/,   // 27-Sep-2025
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // 27/09/2025
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // 2025-09-27
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // 27-09-2025
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/  // 27.09.2025
    ];
    
    for (const format of dateFormats) {
      const match = cleanDate.match(format);
      if (match) {
        if (format === dateFormats[0] || format === dateFormats[1]) {
          // Handle month abbreviations like "Sep", "Oct", "Aug"
          const day = match[1].padStart(2, '0');
          const monthAbbr = match[2];
          const year = match[3];
          
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          
          if (monthMap[monthAbbr]) {
            const result = `${year}-${monthMap[monthAbbr]}-${day}`;
            console.log(`DEBUG: Parsed "${cleanDate}" -> "${result}"`);
            return result;
          }
        } else if (format === dateFormats[2] || format === dateFormats[4] || format === dateFormats[5]) {
          // Handle DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY formats
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          const result = `${year}-${month}-${day}`;
          console.log(`DEBUG: Parsed "${cleanDate}" -> "${result}"`);
          return result;
        } else if (format === dateFormats[3]) {
          // Already in YYYY-MM-DD format
          console.log(`DEBUG: Date already in correct format: "${cleanDate}"`);
          return cleanDate;
        }
        break;
      }
    }

    // Try parsing as a standard date but be careful with timezone issues
    try {
      const parsedDate = new Date(cleanDate + 'T12:00:00'); // Add noon time to avoid timezone issues
      if (!isNaN(parsedDate.getTime())) {
        const result = parsedDate.toISOString().split('T')[0];
        console.log(`DEBUG: Fallback parsed "${cleanDate}" -> "${result}"`);
        return result;
      }
    } catch (error) {
      console.warn(`Could not parse date with fallback: "${cleanDate}"`);
    }

    console.warn(`Could not parse date: "${cleanDate}"`);
    return null;
  }

  // Helper function to extract party names from parties string
  static extractPartyNames(partiesString) {
    if (!partiesString || typeof partiesString !== 'string') {
      return [];
    }

    // Split by common separators used in court cases
    const separators = [' V/S ', ' VS ', ' v/s ', ' vs ', ' V/s ', ' v/S '];
    let parties = [partiesString];
    
    for (const separator of separators) {
      const newParties = [];
      for (const party of parties) {
        newParties.push(...party.split(separator));
      }
      parties = newParties;
    }

    // Clean up party names and remove empty entries
    return parties
      .map(party => party.trim())
      .filter(party => party && party !== '&' && party !== 'OTHERS' && party !== 'others')
      .map(party => {
        // Remove common prefixes and suffixes
        return party
          .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Mst\.|Miss)\s*/i, '')
          .replace(/\s*&\s*[Oo]thers?$/i, '')
          .replace(/\s*[Ee]tc\.?$/i, '')
          .trim();
      })
      .filter(party => party.length > 0);
  }

  // Helper function to remove duplicate hearings based on date and diary content
  static removeDuplicateHearings(hearings) {
    if (!hearings || !Array.isArray(hearings) || hearings.length === 0) {
      return [];
    }

    const dateMap = new Map(); // Map of date -> hearing object
    
    for (const hearing of hearings) {
      // Skip hearings without valid dates
      if (!hearing.date) continue;

      // The date should already be normalized from parseCaseProfile
      let hearingDate = hearing.date;
      
      // Validate the date format (should be YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(hearingDate)) {
        console.warn(`Invalid date format: ${hearingDate}, skipping hearing`);
        continue;
      }

      // Clean and normalize diary content
      const diary = (hearing.diary || '').replace(/\s+/g, ' ').trim();
      
      // Check if we already have a hearing for this date
      if (dateMap.has(hearingDate)) {
        const existingHearing = dateMap.get(hearingDate);
        const existingDiary = (existingHearing.diary || '').trim();
        
        // If existing hearing is blank and new one has content, replace it
        if (!existingDiary && diary) {
          dateMap.set(hearingDate, {
            ...hearing,
            date: hearingDate,
            diary: diary
          });
          console.log(`Replaced blank hearing with content for ${hearingDate}: "${diary}"`);
        } else if (!diary && existingDiary) {
          // Keep the existing one with content
          console.log(`Kept existing hearing with content for ${hearingDate}: "${existingDiary}"`);
        } else if (diary && existingDiary) {
          // Both have content, keep the first one (or you could implement other logic)
          console.log(`Duplicate hearing with content removed for ${hearingDate}: "${diary}"`);
        } else {
          // Both are blank, keep the first one
          console.log(`Duplicate blank hearing removed for ${hearingDate}`);
        }
      } else {
        // First hearing for this date
        dateMap.set(hearingDate, {
          ...hearing,
          date: hearingDate,
          diary: diary
        });
      }
    }

    // Convert map back to array and sort by date
    const uniqueHearings = Array.from(dateMap.values());
    uniqueHearings.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log(`Processed ${hearings.length} hearings. Unique: ${uniqueHearings.length}, Duplicates removed: ${hearings.length - uniqueHearings.length}`);
    
    // Log the final hearing list for debugging
    console.log('Final unique hearings after duplicate removal:');
    uniqueHearings.forEach((h, index) => {
      console.log(`  ${index + 1}. ${h.date} - "${h.diary || 'BLANK'}"${h.originalDate ? ` (original: ${h.originalDate})` : ''}`);
    });
    
    return uniqueHearings;
  }

  // Helper function to get case profile data (extracted logic from getCaseProfile)
  static async getCaseProfileData(caseCode) {
    try {
      // Prepare form data for case profile request
      const formData = new URLSearchParams();
      formData.append('_token', ''); // Will be set by makeCourtSearchRequest
      formData.append('casecode', caseCode);

      // Make request using centralized function with automatic token refresh
      const response = await CourtSearchController.makeCourtSearchRequest(
        'https://cases.districtcourtssindh.gos.pk/case-profile',
        {
          method: 'POST',
          formData: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }
        }
      );

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
      console.log('🔄 Starting token refresh process via API endpoint...');

      // Use the internal refresh method
      const tokens = await CourtSearchController.refreshTokensInternal();

      // Update environment variables (runtime) for backward compatibility
      process.env.COURT_SEARCH_TOKEN = tokens.searchToken;
      process.env.COURT_SEARCH_XSRF_TOKEN = tokens.xsrfToken;
      process.env.COURT_SEARCH_SESSION = tokens.sessionToken;

      // Update .env file
      const envUpdateResult = await CourtSearchController.updateEnvFile(tokens);

      console.log('✅ Tokens successfully refreshed and updated in environment and .env file');

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
        timestamp: tokens.lastRefresh,
        autoRetryEnabled: true
      });

    } catch (error) {
      console.error('❌ Error in refreshTokens:', error);
      
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

  // Get court types (cached for performance)
  static async getCourtTypes(req, res) {
    try {
      // Set cache headers for 1 hour since court types rarely change
      res.set('Cache-Control', 'public, max-age=3600');
      
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

  // Get current token status
  static async getTokenStatus(req, res) {
    try {
      const hasTokens = !!(CourtSearchController.currentTokens.searchToken && CourtSearchController.currentTokens.xsrfToken && CourtSearchController.currentTokens.sessionToken);
      const tokenAge = CourtSearchController.currentTokens.lastRefresh ? 
        Math.floor((new Date() - new Date(CourtSearchController.currentTokens.lastRefresh)) / 1000 / 60) : null;

      res.json({
        success: true,
        status: {
          hasValidTokens: hasTokens,
          lastRefresh: CourtSearchController.currentTokens.lastRefresh,
          tokenAgeMinutes: tokenAge,
          autoRetryEnabled: true,
          tokens: {
            searchToken: CourtSearchController.currentTokens.searchToken ? 
              CourtSearchController.currentTokens.searchToken.substring(0, 20) + '...' : null,
            xsrfToken: CourtSearchController.currentTokens.xsrfToken ? 
              CourtSearchController.currentTokens.xsrfToken.substring(0, 20) + '...' : null,
            sessionToken: CourtSearchController.currentTokens.sessionToken ? 
              CourtSearchController.currentTokens.sessionToken.substring(0, 20) + '...' : null
          }
        }
      });
    } catch (error) {
      console.error('❌ Error getting token status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get token status',
        error: error.message
      });
    }
  }

  }
 
module.exports = CourtSearchController;
