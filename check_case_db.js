const { Pool } = require('pg');

async function checkExistingCase() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'law_cfms',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('🔍 Checking for existing case with CFMS code: 77602024005000580');
    
    // Check if case exists
    const caseResult = await pool.query(
      'SELECT case_id, case_number, cfms_case_code, status FROM cases WHERE cfms_case_code = $1',
      ['77602024005000580']
    );
    
    if (caseResult.rows.length > 0) {
      console.log('✅ Found existing case:', caseResult.rows[0]);
      
      // Check if user 2 is connected to this case
      const userConnectionResult = await pool.query(
        'SELECT * FROM case_lawyers WHERE case_id = $1 AND user_id = $2',
        [caseResult.rows[0].case_id, 2]
      );
      
      console.log(`🔗 User connections for case ID ${caseResult.rows[0].case_id}:`, userConnectionResult.rows.length);
      
      if (userConnectionResult.rows.length > 0) {
        console.log('✅ User 2 is already connected to this case');
        console.log('Connection details:', userConnectionResult.rows);
      } else {
        console.log('❌ User 2 is NOT connected to this case');
        
        // Check all connections for this case
        const allConnectionsResult = await pool.query(
          'SELECT cl.*, l.name as lawyer_name, p.name as party_name FROM case_lawyers cl LEFT JOIN lawyers l ON cl.lawyer_id = l.lawyer_id LEFT JOIN parties p ON cl.party_id = p.party_id WHERE cl.case_id = $1',
          [caseResult.rows[0].case_id]
        );
        
        console.log('All connections for this case:', allConnectionsResult.rows);
      }
    } else {
      console.log('❌ No case found with this CFMS code');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkExistingCase();