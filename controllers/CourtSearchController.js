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
      formData.append('_token', 'GMqEvs46v2PUrZOKICuoXNU1h76Wquf5WKADJ4l6'); // This might need to be dynamic
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
          'Cookie': 'XSRF-TOKEN=eyJpdiI6IlVVWGZJMDhhZ2NCdnZhYmVOamYrMXc9PSIsInZhbHVlIjoiNFlJSXltVU14MWI0cHF5L1B1RTdTV1JOQUV5am1hQmpCcU1uZWQ0cTJlRGdlYWIyN1RlWU5GcVFjcnoxM0NQcXZPdzIwUWdHSHZrZFdHa05BVHZJQ2VZekZtaWFkbEtiQ1J4VmVuejcxMTIvUWdqMkEraVF3bStzU0hWVnJBTXgiLCJtYWMiOiIwNTEwZDdlMmVlZDExZDAxYmMxNGY2YWVhM2RkOWU1YTczNjNjZTNhNGM0YWYyYjc2YzZkZDc3YmZhOWFjMmFmIiwidGFnIjoiIn0%3D; cfms_dc_session=eyJpdiI6IlNPUVlnL3djV2pwNzAycHBpRWNIakE9PSIsInZhbHVlIjoicTJ3R05yeG52S2dHU2Rrb29wK2xxRVArSHNzUVBHYkV2TzJXL25JZEdEVjZPUElERHNzMG5DZUg5QUJmN2xiUkwrbE5SMEFXYUJsaHRjL0F1WUFXdlQ2L0Y4REZaOWswNkNQczY2NExJMGRiMnhzWS91NkdTVVNuY1U2QTc2SEciLCJtYWMiOiJkMTcwNjdlYTg0NzA4MzAwYWQ2MzZiZGZkMTdiN2I5NTBhZWY3NzlhZWU4NmVkN2JkMDUwMTBmYTYzZWM1OWZhIiwidGFnIjoiIn0%3D'
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
    
    // Find the table with search results
    $('table.table-striped tbody tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 6) {
        const caseData = {
          serialNumber: $(cells[0]).text().trim(),
          caseDetails: $(cells[1]).text().trim(),
          courtName: $(cells[2]).text().trim(),
          status: $(cells[3]).text().trim(),
          hearingDate: $(cells[4]).text().trim(),
          caseCode: $row.find('button.pview').attr('id') || null
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
        
        cases.push(caseData);
      }
    });
    
    return {
      totalResults: cases.length,
      cases: cases
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
      formData.append('_token', 'GMqEvs46v2PUrZOKICuoXNU1h76Wquf5WKADJ4l6');
      formData.append('casecode', caseCode);

      // Make request to get case profile
      const response = await axios.post('https://cases.districtcourtssindh.gos.pk/case-profile', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://cases.districtcourtssindh.gos.pk',
          'Referer': 'https://cases.districtcourtssindh.gos.pk/case-search',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': 'XSRF-TOKEN=eyJpdiI6IkJNY3phTDZFR0wrK01yWWlmMnhuMnc9PSIsInZhbHVlIjoiTzM4VllvK2ZUUVc0a2ZncTRkV2pJNG9XT1JmRTlscmZFUFRnYmpYTktWZGRuTy9QZFhnQkMzMXB1YzI5anlBY0I2Tm9oNXZMVjI1QWxhK0pKQjFzNkQ2MGlIellvUTZyeEpIanVRVDNSOTU0RGJYcUsxb0tMbGw4RytPakZ6bnEiLCJtYWMiOiIwOTM0ZGUxOTdmN2I4ZDRkOWU4N2I3ZTQwMzgxNTg3MTRmYzI4YzIxZWYxZWRiM2QyNGI1MGM4NTUzYzEyMjA5IiwidGFnIjoiIn0%3D; cfms_dc_session=eyJpdiI6InBmM2RCSVRvdktDRWhseGcrai8zcFE9PSIsInZhbHVlIjoiY3VMMGtzUEdoYzlwNE1TU1RyNGlQSkMxek9PcmNDdGdhMVd3Q09DRnB3dTlBZWVqcHRTQkl0Z2JQa3NZS3Z2c08rTG5lb3UveU9lMVRlakQ1MUl3TWlpNjZBNWN0RWlRaHRkanBzQVo3bU12QmZjaTRuVm5XMjYxUWgrNTQ5MHIiLCJtYWMiOiJjNTgyMzlhYzIzNWZlYWExZDhjNDM4NzhiY2RjMzg5MDliNjVkMGM0OGU5YTc1ZThkMjUwNTk2YjMyYTRiOTcwIiwidGFnIjoiIn0%3D'
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
