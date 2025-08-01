# Court Search API Documentation

## Overview
The Court Search API provides integration with the Sindh District Courts case management system, allowing users to search for cases and retrieve case details.

## Base URL
```
/api/court-search
```

## Endpoints

### 1. Search Cases
**POST** `/search`

Search for cases in the Sindh District Courts system.

#### Request Body
```json
{
  "district": "2",           // District ID (default: "2" for Karachi South)
  "caseno": "",              // Case number (optional)
  "caseyear": "",            // Case year (optional)
  "courttype": "0",          // Court type ID (default: "0" for all)
  "casecategory": "0",       // Case category ID (default: "0" for all)
  "policeStation": "0",      // Police station ID (default: "0" for all)
  "firno": "",               // FIR number (optional)
  "firyear": "",             // FIR year (optional)
  "pname": "",               // Party/Accused name (optional)
  "status": []               // Status filter array (optional)
}
```

#### Response
```json
{
  "success": true,
  "message": "Search completed successfully",
  "searchParams": {
    // Echo of search parameters
  },
  "data": {
    "totalResults": 9,
    "cases": [
      {
        "serialNumber": "1",
        "caseDetails": "Rent Cases 787/2024, ALI ASGHAR HUSSAIN V/S HUMAN RIGHTS DEPARTMENT & ANOTHER",
        "courtName": "Senior Civil Judge / Assistant Sessions Judge VI, Karachi (South)",
        "status": "Disposed 11/Feb/2025",
        "hearingDate": "NOT FOUND",
        "caseCode": "78702024006100580",
        "caseType": "Rent Cases",
        "caseNumber": "787/2024",
        "parties": "ALI ASGHAR HUSSAIN V/S HUMAN RIGHTS DEPARTMENT & ANOTHER",
        "statusText": "Disposed",
        "statusDate": "11/Feb/2025"
      }
      // ... more cases
    ]
  }
}
```

### 2. Get Case Profile
**POST** `/case-profile`

Retrieve detailed information about a specific case.

#### Request Body
```json
{
  "caseCode": "78702024006100580"  // Case ID from search results
}
```

#### Response
```json
{
  "success": true,
  "message": "Case profile retrieved successfully",
  "caseCode": "78702024006100580",
  "data": {
    "caseDetails": {
      "Case No": "Rent Cases 787/2024, ALI ASGHAR HUSSAIN V/S HUMAN RIGHTS DEPARTMENT & ANOTHER 78702024006100580",
      "Court": "Senior Civil Judge / Assistant Sessions Judge VI, Karachi (South)",
      "Advocate 1": "Naserullah Khatri(ADVO-7581-SBC-KHS)",
      "Advocate 2": "",
      "Under Section": "Rent Case-U/S 15- Sindh Sindh Rental Premises Ordinance 1979"
    },
    "hearingHistory": [
      {
        "serialNumber": "1",
        "diary": "Case called. Advocate for the applicant is present. The defendant has already declared Ex-parte vide order dated:25-11-2024. Judgment Passed...",
        "date": "11/Feb/2025"
      },
      {
        "serialNumber": "2", 
        "diary": "Case called. Advocate for the applicant is present. The defendant has already declared Ex-parte vide order dated:25-11-2024...",
        "date": "31/Jan/2025"
      }
    ],
    "caseNumber": "Rent Cases 787/2024",
    "parties": "ALI ASGHAR HUSSAIN V/S HUMAN RIGHTS DEPARTMENT & ANOTHER",
    "caseCode": "78702024006100580"
  }
}
```

### 3. Get Districts
**GET** `/districts`

Retrieve list of available districts.

#### Response
```json
{
  "success": true,
  "data": [
    {
      "value": "2",
      "name": "Karachi (South)"
    },
    {
      "value": "3",
      "name": "Karachi(West)"
    }
    // ... more districts
  ]
}
```

### 4. Get Court Types
**GET** `/court-types`

Retrieve list of available court types.

#### Response
```json
{
  "success": true,
  "data": [
    {
      "value": "0",
      "name": "NIL-Default Court Type"
    },
    {
      "value": "1",
      "name": "District Courts"
    }
    // ... more court types
  ]
}
```

## Usage Examples

### Search by Party Name
```bash
curl -X POST http://localhost:3000/api/court-search/search \
  -H "Content-Type: application/json" \
  -d '{
    "district": "2",
    "pname": "Ali Asghar Hussain"
  }'
```

### Search by Case Number and Year
```bash
curl -X POST http://localhost:3000/api/court-search/search \
  -H "Content-Type: application/json" \
  -d '{
    "district": "2",
    "caseno": "787",
    "caseyear": "2024"
  }'
```

### Search by FIR Details
```bash
curl -X POST http://localhost:3000/api/court-search/search \
  -H "Content-Type: application/json" \
  -d '{
    "district": "2",
    "firno": "123",
    "firyear": "2024",
    "policeStation": "16"
  }'
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `503`: Service Unavailable (external court system down)
- `504`: Gateway Timeout (request timeout)
- `500`: Internal Server Error

## Rate Limiting

Be mindful of rate limiting when making requests to avoid overwhelming the external court system. Consider implementing caching for frequently accessed data.

## Notes

1. The external court system may require session tokens that expire. The implementation includes basic token handling, but you may need to implement token refresh logic for production use.

2. The HTML parsing is based on the current structure of the Sindh District Courts website. If they change their HTML structure, the parsing logic may need updates.

3. Some search parameters may not be available for all districts or court types.

4. The system supports both Urdu and English text in search results.
