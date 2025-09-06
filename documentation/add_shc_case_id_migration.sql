-- Migration: Add SHC case ID support to cases table
-- Date: 2025-09-06
-- Description: Adds shc_case_id column to support Sindh High Court case integration

-- Add shc_case_id column to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS shc_case_id INTEGER UNIQUE;

-- Add index for better performance on SHC case ID lookups
CREATE INDEX IF NOT EXISTS idx_cases_shc_case_id ON cases(shc_case_id);

-- Add comment to document the column
COMMENT ON COLUMN cases.shc_case_id IS 'Sindh High Court case ID for SHC integration';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND column_name = 'shc_case_id';