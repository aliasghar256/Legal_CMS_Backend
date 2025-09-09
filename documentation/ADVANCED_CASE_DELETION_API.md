# Advanced Case Deletion API Documentation

## Overview
The Advanced Case Deletion API provides a comprehensive way to delete cases along with their associated data, with optional deletion of parties and lawyers.

## Endpoint
```
DELETE /api/cases/:id/advanced
```

## Query Parameters
- `deleteParties` (boolean, optional): Set to `true` to delete associated parties along with the case. Default: `false`
- `deleteLawyers` (boolean, optional): Set to `true` to delete associated lawyers along with the case. Default: `false`

## Request Examples

### Basic Case Deletion (case + hearings + documents only)
```bash
DELETE /api/cases/123/advanced
```

### Delete Case with Associated Parties
```bash
DELETE /api/cases/123/advanced?deleteParties=true
```

### Delete Case with Associated Lawyers
```bash
DELETE /api/cases/123/advanced?deleteLawyers=true
```

### Delete Case with Both Parties and Lawyers
```bash
DELETE /api/cases/123/advanced?deleteParties=true&deleteLawyers=true
```

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Case and related data deleted successfully",
  "data": {
    "deletionSummary": {
      "caseId": 123,
      "deletedRecords": {
        "case": 1,
        "hearings": 5,
        "documents": 3,
        "caseReferences": 2,
        "caseLinks": 1,
        "caseLawyers": 4,
        "parties": 2,
        "lawyers": 1,
        "userParties": 2,
        "userLawyers": 1
      }
    },
    "options": {
      "deleteParties": true,
      "deleteLawyers": true
    }
  }
}
```

### Case Not Found (404 Not Found)
```json
{
  "success": false,
  "message": "Case not found"
}
```

### Invalid Case ID (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid case ID"
}
```

### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details..."
}
```

## Deletion Process

The API follows a specific order to maintain referential integrity:

1. **Validation**: Check if case exists
2. **Relationship Discovery**: Find associated parties and lawyers if deletion is requested
3. **Relationship Cleanup**: Delete case_lawyers relationships
4. **Associated Data**: Delete hearings, documents, case references, case links
5. **Reminders**: Delete user reminders associated with the case
6. **Optional Parties**: If `deleteParties=true`, delete user_parties relationships and then parties
7. **Optional Lawyers**: If `deleteLawyers=true`, delete user_lawyers relationships and then lawyers
8. **Case**: Finally delete the case itself

## Important Notes

- **Cascading Deletion**: The following data is always deleted with the case:
  - All hearings (including diary entries)
  - All documents
  - All case references
  - All case links
  - All case-lawyer relationships
  - All user reminders for the case

- **Optional Deletion**: Parties and lawyers are only deleted if explicitly requested via query parameters

- **Referential Integrity**: The API maintains database referential integrity by deleting relationships before entities

- **Transaction Safety**: All operations are performed within a database transaction to ensure data consistency

- **Audit Trail**: The response includes detailed counts of all deleted records for audit purposes

## Security Considerations

- Authentication is required for this endpoint
- Users can only delete cases they have access to
- All deletions are logged in the application logs
- Transactions ensure atomicity - either all deletions succeed or none do

## Related Endpoints

- `DELETE /api/cases/:id` - Basic case deletion (without optional party/lawyer deletion)
- `GET /api/cases/:id/details` - Get case details before deletion
- `GET /api/cases/:id` - Get basic case information