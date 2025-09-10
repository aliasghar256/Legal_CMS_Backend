# Case Associations API Documentation

This document outlines the new API endpoints for managing parties and lawyers associated with cases.

## New Endpoints

### 1. Update Case Parties
**Endpoint:** `PUT /api/cases/:id/parties`  
**Authentication:** Required  

Add or remove parties from a case.

#### Request Body
```json
{
  "action": "add|remove",
  "party_ids": [1, 2, 3],
  "lawyer_id": 5  // Required for 'add' action, optional for 'remove'
}
```

#### Response
```json
{
  "success": true,
  "message": "Added 2 parties. 1 error(s) occurred",
  "data": {
    "case_id": 123,
    "case_number": "Case No. 123/2025",
    "action": "add",
    "results": [
      {
        "party_id": 1,
        "party_name": "John Doe",
        "action": "added"
      }
    ],
    "errors": [
      "Party with ID 999 not found"
    ],
    "summary": {
      "success_count": 1,
      "error_count": 1
    }
  }
}
```

### 2. Update Case Lawyers
**Endpoint:** `PUT /api/cases/:id/lawyers`  
**Authentication:** Required  

Add or remove lawyers from a case.

#### Request Body
```json
{
  "action": "add|remove",
  "lawyer_ids": [1, 2, 3],
  "party_id": 5  // Required for 'add' action, optional for 'remove'
}
```

#### Response
```json
{
  "success": true,
  "message": "Added 2 lawyers",
  "data": {
    "case_id": 123,
    "case_number": "Case No. 123/2025",
    "action": "add",
    "results": [
      {
        "lawyer_id": 1,
        "lawyer_name": "Jane Smith",
        "action": "added"
      }
    ],
    "errors": [],
    "summary": {
      "success_count": 2,
      "error_count": 0
    }
  }
}
```

### 3. Get Case Associations
**Endpoint:** `GET /api/cases/:id/associations`  
**Authentication:** Required  

Retrieve all parties and lawyers associated with a case for the authenticated user.

#### Response
```json
{
  "success": true,
  "message": "Case associations retrieved successfully",
  "data": {
    "case_id": 123,
    "case_number": "Case No. 123/2025",
    "parties": [
      {
        "party_id": 1,
        "party_name": "John Doe",
        "cnic": "12345-6789012-3",
        "role": "Plaintiff",
        "party_email": "john@example.com",
        "lawyers": [
          {
            "lawyer_id": 1,
            "lawyer_name": "Jane Smith",
            "license_no": "L123456",
            "lawyer_email": "jane@law.com"
          }
        ]
      }
    ],
    "total_parties": 1,
    "total_associations": 1
  }
}
```

## Usage Examples

### Adding Parties to a Case
```bash
curl -X PUT /api/cases/123/parties \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "party_ids": [1, 2, 3],
    "lawyer_id": 5
  }'
```

### Removing Parties from a Case
```bash
curl -X PUT /api/cases/123/parties \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "party_ids": [1, 2]
  }'
```

### Adding Lawyers to a Case
```bash
curl -X PUT /api/cases/123/lawyers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "lawyer_ids": [1, 2],
    "party_id": 3
  }'
```

### Removing Lawyers from a Case
```bash
curl -X PUT /api/cases/123/lawyers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "lawyer_ids": [1, 2]
  }'
```

### Getting Case Associations
```bash
curl -X GET /api/cases/123/associations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Validation Rules

### For Adding Parties (`PUT /cases/:id/parties`)
- `action` must be either "add" or "remove"
- `party_ids` must be a non-empty array of integers
- `lawyer_id` is required when `action` is "add"
- All party IDs must exist in the database
- If `lawyer_id` is provided, it must exist in the database
- Duplicate associations for the same user are prevented

### For Adding Lawyers (`PUT /cases/:id/lawyers`)
- `action` must be either "add" or "remove"
- `lawyer_ids` must be a non-empty array of integers
- `party_id` is required when `action` is "add"
- All lawyer IDs must exist in the database
- If `party_id` is provided, it must exist in the database
- Duplicate associations for the same user are prevented

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Action must be either 'add' or 'remove'"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Case not found"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Partial Success Handling
The API handles partial success scenarios gracefully. If some operations succeed and others fail, the response will include:
- A summary of successful operations
- A list of errors for failed operations
- Detailed results for each processed item

## Database Changes

The endpoints modify the `case_lawyers` bridge table which contains:
- `case_id` - References the case
- `lawyer_id` - References the lawyer (can be NULL)
- `party_id` - References the party
- `user_id` - References the user who created the association

All operations are user-scoped, meaning users can only manage their own associations and cannot see or modify associations created by other users.

## Security Notes

1. All endpoints require authentication via Bearer token
2. Users can only manage associations for cases they have access to
3. Users cannot view or modify associations created by other users
4. All database operations use parameterized queries to prevent SQL injection
5. Transactions are used to ensure data consistency