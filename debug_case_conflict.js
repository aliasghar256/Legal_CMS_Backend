const Case = require('./models/Case');

// Debug script to check for conflicting cases
async function debugCaseConflict() {
    try {
        // Replace this with the actual case code that's causing the conflict
        // You can see this in the browser network tab or logs
        const conflictingCaseCode = "503820265470N0620"; // From the network response in the screenshot

        console.log(`Checking for existing case with CFMS case code: ${conflictingCaseCode}`);
        
        const existingCase = await Case.findByCfmsCaseCode(parseInt(conflictingCaseCode));
        
        if (existingCase) {
            console.log('Found existing case:');
            console.log(JSON.stringify(existingCase, null, 2));
            
            // Also check if there are any parties/lawyers associated
            const caseDetails = await Case.findByIdWithDetails(existingCase.case_id);
            console.log('\nFull case details:');
            console.log(JSON.stringify(caseDetails, null, 2));
        } else {
            console.log('No existing case found with this CFMS case code');
        }
        
        // Also check for similar case numbers or codes
        console.log('\nChecking for cases with similar patterns...');
        const { query } = require('./lib/db');
        const result = await query(
            `SELECT case_id, case_number, cfms_case_code, court_name, status, filing_date 
             FROM cases 
             WHERE cfms_case_code IS NOT NULL 
             ORDER BY case_id DESC 
             LIMIT 10`
        );
        
        console.log('Recent cases with CFMS codes:');
        result.rows.forEach(case_ => {
            console.log(`ID: ${case_.case_id}, Number: ${case_.case_number}, CFMS Code: ${case_.cfms_case_code}, Court: ${case_.court_name}`);
        });
        
    } catch (error) {
        console.error('Error in debug script:', error);
    }
    
    process.exit(0);
}

debugCaseConflict();