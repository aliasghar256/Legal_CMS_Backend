# Court Search Token Refresh Endpoint

## Overview
This endpoint automatically refreshes all three required tokens for the Sindh District Courts API:
1. **Search Token** (`_token` parameter)
2. **XSRF Token** (XSRF-TOKEN cookie)
3. **Session Token** (cfms_dc_session cookie)

## Endpoint Details
- **URL**: `POST /court-search/refresh-tokens`
- **Authentication**: None required
- **Content-Type**: `application/json`

## Usage

### cURL Example
```bash
curl -X POST "http://localhost:3001/court-search/refresh-tokens" \
  -H "Content-Type: application/json"
```

### Response Format
```json
{
  "success": true,
  "message": "All tokens refreshed successfully",
  "tokens": {
    "searchToken": "u4jPUPFZSn8FBlYlwxEIEBkQ4o2G3Rd710jUTLCo",
    "xsrfToken": "eyJpdiI6Ii9obzJ1ZWFhZjcvWUZyMkhzTjdxUHc9PSIsInZhbHVlIjoi...",
    "sessionToken": "eyJpdiI6Ik1QNlJXc1JZUjVkM3F3MXRVanhEOVE9PSIsInZhbHVlIjoi..."
  },
  "envFileUpdated": true,
  "envUpdateMessage": ".env file updated successfully with fresh tokens",
  "timestamp": "2025-09-02T15:33:35.123Z"
}
```

## How It Works
1. Makes a GET request to the court search homepage
2. Extracts the CSRF token from HTML meta tags or form inputs
3. Extracts XSRF-TOKEN and cfms_dc_session from Set-Cookie headers
4. Updates runtime environment variables automatically
5. **Automatically updates the .env file with fresh tokens**
6. Returns the fresh tokens and update status

## Environment Variables Updated
After successful refresh, these variables are updated both in runtime and in the .env file:
- `COURT_SEARCH_TOKEN` → searchToken
- `COURT_SEARCH_XSRF_TOKEN` → xsrfToken  
- `COURT_SEARCH_SESSION` → sessionToken

## Important Notes
- **Automatic Updates**: Tokens are updated both in runtime and persistently in the .env file
- **No Manual Work Required**: The endpoint handles everything automatically
- **Token Expiration**: Court tokens typically expire after some time or inactivity
- **Error Handling**: The endpoint includes proper error handling for network issues and token extraction failures
- **User Agent**: Uses Edge browser user agent for compatibility
- **File Safety**: The .env file update process preserves all other environment variables

## Error Responses

### Connection Failed (503)
```json
{
  "success": false,
  "message": "Court system is currently unavailable",
  "error": "Connection failed"
}
```

### Timeout (504)
```json
{
  "success": false,
  "message": "Token refresh request timed out",
  "error": "Request timeout"
}
```

### Token Extraction Failed (500)
```json
{
  "success": false,
  "message": "Failed to extract all required tokens",
  "extractedTokens": {
    "searchToken": true,
    "xsrfToken": false,
    "sessionToken": true
  }
}
```

## Integration with Existing Endpoints
After refreshing tokens, all existing court search endpoints will automatically use the new tokens:
- `/court-search/search` - Case search
- `/court-search/profile` - Case profile details
- `/court-search/create-cases` - Create cases from profiles

## Automation Recommendations
You can set up automatic token refresh by:
1. Calling this endpoint before making court search requests
2. Setting up a scheduled job to refresh tokens periodically
3. Implementing retry logic that refreshes tokens on authentication failures