# MinIO Integration for Query Results

This document describes the MinIO integration for handling query results from FastAPI.

## Overview

The system now supports two types of query result responses from FastAPI:

1. **Inline Results**: Small datasets with `result` field containing the data directly
2. **File-based Results**: Large datasets with `file_path` field pointing to a parquet file in MinIO

## Configuration

### Environment Variables

Added to `.env`:

```bash
# MinIO (Object Storage)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=query-results
MINIO_SECURE=false
```

## Components

### 1. MinIO Client Utility (`src/lib/minio.ts`)

Provides functions to:
- Connect to MinIO
- Extract object keys from S3 paths
- Fetch files from MinIO storage

**Key Functions:**
- `getMinioClient()`: Get singleton MinIO client
- `getMinioBucket()`: Get bucket name from env
- `extractObjectKeyFromS3Path()`: Convert S3 path to object key
- `fetchFileFromMinio()`: Fetch file by object key
- `fetchFileFromS3Path()`: Fetch file by full S3 path

### 2. Query Results API Route (`src/app/api/query-results/route.ts`)

**Endpoint:** `POST /api/query-results`

**Request Body:**
```json
{
  "s3Path": "s3://query-results/query-results/results_123.parquet"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rowCount": 274,
    "data": [...],
    "s3Path": "s3://query-results/query-results/results_123.parquet"
  }
}
```

### 3. Chat UI Components (`src/app/(dashboard)/chat/[id]/page.tsx`)

#### Updated Interfaces

**QueryResult Interface:**
```typescript
interface QueryResult {
  status: string;
  query: string;
  tables_used?: string[];
  tier?: number;
  row_count?: number;
  result?: any[] | null;          // Inline data
  csv_path?: string | null;
  sql_generated?: string;
  joins?: any[];
  execution_time_ms?: number;
  confidence?: number;
  error_message?: string | null;
  suggestions?: string | null;
  formatted_result?: string;
  file_path?: string | null;      // S3 path to parquet file
}
```

**Message Interface:**
```typescript
interface Message {
  _id?: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  sqlQuery?: string;
  queryResults?: QueryResult[];   // Array of query results
  createdAt?: Date;
}
```

#### QueryResultDisplay Component

A new component that:
1. **Displays query metadata**: Status, row count, execution time, storage location
2. **Shows formatted results**: AI-generated insights
3. **Renders SQL queries**: Syntax-highlighted SQL
4. **Handles inline data**: Directly displays data from `result` field
5. **Fetches MinIO data**: Automatically fetches and parses parquet files from `file_path`
6. **Renders data tables**: Scrollable, styled tables with column headers

**Features:**
- Loading states while fetching MinIO data
- Error handling for failed MinIO fetches
- Responsive table layout with max height
- Dark mode support

## Response Examples

### Type 1: Inline Results (Small Dataset)

```json
{
  "status": "success",
  "query": "List the first 5 employees",
  "row_count": 5,
  "result": [
    {
      "EmployeeID": 3,
      "FirstName": "David",
      "LastName": "Howard",
      "Email": "david.howard@company.com"
    }
  ],
  "sql_generated": "SELECT TOP 5 ...",
  "execution_time_ms": 8871,
  "formatted_result": "The query results return...",
  "file_path": null
}
```

### Type 2: File-based Results (Large Dataset)

```json
{
  "status": "success",
  "query": "List all employees",
  "row_count": 274,
  "result": null,
  "sql_generated": "SELECT * FROM Employees...",
  "execution_time_ms": 10498,
  "formatted_result": "The query results provide...",
  "file_path": "s3://query-results/query-results/results_123.parquet"
}
```

## API Endpoint

The system calls: `POST http://localhost:8000/api/v1/query`

**Request Payload:**
```json
{
  "database_ids": ["6919f70d1e144e4ea1b53ff4"],
  "query": "show all active employees"
}
```

## How It Works

### For Inline Results:
1. FastAPI returns `result` array with data
2. `QueryResultDisplay` component renders data directly
3. No MinIO fetch required

### For File-based Results:
1. FastAPI returns `file_path` with S3 URL
2. `QueryResultDisplay` component detects `file_path` is present
3. Component calls `/api/query-results` with S3 path
4. API route fetches parquet file from MinIO
5. API route parses parquet and returns JSON
6. Component renders data in table

## UI Features

### Query Metadata Badges
- 🟢 **Success**: Green badge for successful queries
- 🔵 **Row Count**: Blue badge showing number of rows
- 🟣 **Execution Time**: Purple badge showing query duration
- 🟠 **Storage**: Orange badge when data is stored in MinIO

### Data Display
- **Formatted Results**: AI-generated insights in a styled box
- **SQL Query**: Syntax-highlighted SQL in code block
- **Data Table**:
  - Scrollable (max 96 units height)
  - Sticky headers
  - Hover effects on rows
  - Auto-sized columns
  - Handles null/undefined values

## Dependencies

- `minio`: ^8.0.3 - MinIO JavaScript client
- `parquetjs`: ^0.11.2 - Parquet file parser

## Security

- Authentication required for `/api/query-results` endpoint
- Uses existing NextAuth session validation
- MinIO credentials stored in environment variables

## Error Handling

- Displays loading spinner while fetching from MinIO
- Shows error message if MinIO fetch fails
- Handles missing/invalid S3 paths
- Gracefully handles empty datasets

## Notes

- No streaming is used - data is fetched and displayed in full
- Large datasets are automatically stored in MinIO by FastAPI
- Small datasets are returned inline for faster display
- Parquet format ensures efficient storage and transfer
