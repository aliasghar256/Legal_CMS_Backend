const { query } = require('./lib/db');

async function checkAllCaseCodes() {
    try {
        // Get all cases with CFMS codes
        const result = await query(
            `SELECT case_id, case_number, cfms_case_code 
             FROM cases 
             WHERE cfms_case_code IS NOT NULL 
             ORDER BY cfms_case_code`
        );
        
        console.log('All cases with CFMS codes:');
        console.log('=====================================');
        
        const targetParsed = parseInt("503820265470N0620"); // 503820265470
        console.log(`Target parsed code: ${targetParsed}`);
        console.log('=====================================');
        
        result.rows.forEach(case_ => {
            const conflicts = case_.cfms_case_code === targetParsed;
            console.log(`ID: ${case_.case_id}, CFMS Code: ${case_.cfms_case_code}${conflicts ? ' *** CONFLICT ***' : ''}`);
        });
        
        // Also check the exact query that the controller runs
        console.log('\n\nRunning the exact query from the controller:');
        const controllerQuery = await query(
            `SELECT case_id, case_number, court_id, court_name, case_type, legal_section, 
                    filing_date, status, stage, description, next_hearing, cfms_case_code 
             FROM cases WHERE cfms_case_code = $1`,
            [targetParsed]
        );
        
        console.log(`Query result rows: ${controllerQuery.rows.length}`);
        if (controllerQuery.rows.length > 0) {
            console.log('Found conflicting case:');
            console.log(JSON.stringify(controllerQuery.rows[0], null, 2));
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

checkAllCaseCodes();