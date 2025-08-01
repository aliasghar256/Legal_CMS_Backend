# Model Updates Summary

## Case.js Model Updates

### New Fields Added:
1. **`next_hearing`** - Date field for tracking the next scheduled hearing
2. **`cfms_case_code`** - Integer field for integration with the Court Flow Management System (CFMS)

### Updated Methods:
- **`create()`** - Now includes `next_hearing` and `cfms_case_code` fields
- **`findById()`** - Returns all fields including new ones
- **`findByCaseNumber()`** - Includes `next_hearing` in results
- **`findByStatus()`** - Includes `next_hearing` in results
- **`findByCourtId()`** - Includes `next_hearing` in results
- **`findAll()`** - Includes `next_hearing` in results
- **`update()`** - Allows updating new fields

### New Methods Added:
1. **`findByCfmsCaseCode(cfms_case_code)`** - Find case by CFMS case code
2. **`createFromCourtSearch(courtData)`** - Create case from court search API data
3. **`updateFromCourtSearch(case_id, courtData)`** - Update case with court search data
4. **`getCasesWithUpcomingHearings(days)`** - Get cases with hearings in next N days
5. **`getCasesWithOverdueHearings()`** - Get cases with overdue hearings

### Integration Features:
- Support for CFMS case code integration
- Methods to sync with external court search system
- Better hearing date tracking

## Hearing.js Model Updates

### Fields Removed:
- **`next_hearing_date`** - Removed as it doesn't exist in database schema

### Updated Methods:
- **`create()`** - Removed `next_hearing_date` parameter
- **`findById()`** - Removed `next_hearing_date` from query
- **`findByIdWithDetails()`** - Removed `next_hearing_date` from query
- **`findByCaseId()`** - Removed `next_hearing_date` from query
- **`findByJudgeId()`** - Removed `next_hearing_date` from query
- **`findByDateRange()`** - Removed `next_hearing_date` from query
- **`findAll()`** - Removed `next_hearing_date` from query
- **`update()`** - Removed `next_hearing_date` from allowed fields

### Methods Removed:
- **`getOverdueHearings()`** - Removed since it relied on non-existent field

### New Methods Added:
1. **`createFromCourtSearch(hearingData)`** - Create hearing from court search data
2. **`getHearingSummaryByCase(case_id)`** - Get hearing summary for a specific case

### Fixed Issues:
- Aligned model with actual database schema
- Removed references to non-existent fields
- Simplified statistics calculation

## Database Schema Alignment

Both models now accurately reflect the database schema defined in `db_schema.json`:

### Cases Table Fields:
- `case_id` (Primary Key)
- `case_number`
- `court_id`
- `court_name`
- `case_type`
- `legal_section`
- `filing_date`
- `status`
- `stage`
- `description`
- `next_hearing` ✅ (Added)
- `cfms_case_code` ✅ (Added)

### Hearings Table Fields:
- `hearing_id` (Primary Key)
- `case_id`
- `judge_id`
- `date`
- `description`
- `type`

## Integration Benefits

### Court Search Integration:
- Cases can be linked to external court system via `cfms_case_code`
- Methods to create/update cases from court search API
- Seamless data synchronization

### Better Date Management:
- `next_hearing` field in cases table for quick access
- Removed duplicate/confusing date fields
- Cleaner hearing management

### Enhanced Querying:
- Find cases with upcoming hearings
- Find cases with overdue hearings
- Better filtering and pagination

## Usage Examples

### Create Case from Court Search:
```javascript
const courtData = {
  caseCode: "78702024006100580",
  caseNumber: "787/2024",
  caseType: "Rent Cases",
  courtName: "Senior Civil Judge VI, Karachi (South)",
  parties: "ALI ASGHAR HUSSAIN V/S HUMAN RIGHTS DEPARTMENT",
  statusText: "Disposed",
  hearingDate: "11/Feb/2025"
};

const newCase = await Case.createFromCourtSearch(courtData);
```

### Find Case by CFMS Code:
```javascript
const case = await Case.findByCfmsCaseCode(78702024006100580);
```

### Get Upcoming Hearings:
```javascript
const upcomingCases = await Case.getCasesWithUpcomingHearings(7); // Next 7 days
```

### Create Hearing from Court Data:
```javascript
const hearingData = {
  case_id: 1,
  date: "2025-08-15",
  diary: "Case called. Judgment reserved.",
  type: "Final Hearing"
};

const hearing = await Hearing.createFromCourtSearch(hearingData);
```

The models are now properly aligned with the database schema and provide better integration capabilities with the court search system.
