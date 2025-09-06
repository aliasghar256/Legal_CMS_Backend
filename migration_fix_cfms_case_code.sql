-- Migration to change cfms_case_code from integer to varchar
-- This will preserve the full case code including letters and numbers

-- Step 1: Add a new column with varchar type
ALTER TABLE cases ADD COLUMN cfms_case_code_new VARCHAR(50);

-- Step 2: Copy data from old column to new column (convert to string)
UPDATE cases 
SET cfms_case_code_new = cfms_case_code::varchar 
WHERE cfms_case_code IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE cases DROP COLUMN cfms_case_code;

-- Step 4: Rename the new column
ALTER TABLE cases RENAME COLUMN cfms_case_code_new TO cfms_case_code;

-- Step 5: Add index for performance
CREATE INDEX idx_cases_cfms_case_code ON cases(cfms_case_code);

-- Verify the changes
SELECT case_id, case_number, cfms_case_code, court_name 
FROM cases 
WHERE cfms_case_code IS NOT NULL 
ORDER BY case_id DESC 
LIMIT 10;