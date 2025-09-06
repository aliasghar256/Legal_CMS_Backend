-- Migration to allow NULL lawyer_id in case_lawyers table
-- This enables cases to have parties without lawyers

-- Step 1: Check current constraints and indexes
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'case_lawyers'::regclass;

-- Step 2: Drop the existing primary key constraint
ALTER TABLE case_lawyers DROP CONSTRAINT IF EXISTS case_lawyers_pkey;

-- Step 3: Remove any existing unique constraints that include lawyer_id
ALTER TABLE case_lawyers DROP CONSTRAINT IF EXISTS case_lawyers_unique_relationship;

-- Step 4: Now we can allow NULL values for lawyer_id
ALTER TABLE case_lawyers ALTER COLUMN lawyer_id DROP NOT NULL;

-- Step 5: Create a new composite primary key that handles NULLs
-- We'll use a surrogate key approach by adding an auto-increment ID
ALTER TABLE case_lawyers ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

-- Step 6: Create unique constraints to prevent duplicates
-- For cases with lawyers (non-null lawyer_id)
CREATE UNIQUE INDEX IF NOT EXISTS case_lawyers_unique_with_lawyer 
ON case_lawyers (case_id, lawyer_id, party_id) 
WHERE lawyer_id IS NOT NULL;

-- For cases without lawyers (null lawyer_id)
CREATE UNIQUE INDEX IF NOT EXISTS case_lawyers_unique_without_lawyer 
ON case_lawyers (case_id, party_id) 
WHERE lawyer_id IS NULL;

-- Step 7: Verify the changes
SELECT 
    case_id, 
    lawyer_id, 
    party_id, 
    user_id,
    CASE 
        WHEN lawyer_id IS NULL THEN 'No Lawyer'
        ELSE 'Has Lawyer'
    END as lawyer_status
FROM case_lawyers 
ORDER BY case_id DESC 
LIMIT 10;