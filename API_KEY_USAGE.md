# API Key Management System

## Overview

The Flash Ops API Key Management System allows teams to generate API keys for programmatic access to the query API. Keys are encrypted using AES-256-CBC encryption with the ENCRYPTION_KEY, allowing them to be decrypted in both the Next.js backend and the Python FastAPI backend.

## Features

- **AES-256-CBC Encryption**: API keys are encrypted (not hashed) so they can be decrypted in Python
- **Team-based Access Control**: Each API key belongs to a team
- **Usage Tracking**: Track who made calls, what queries were run, IP addresses
- **Expiration Management**: Keys can be set to expire after 30, 90, 180, or 365 days
- **Admin Oversight**: Admins can view all API keys across all teams with statistics
- **Soft Delete**: Keys are deactivated (not deleted) for audit trail

## API Key Format

```
flash_<48_hex_chars>_<timestamp_base36>
```

Example:
```
flash_a1b2c3d4e5f6_lx8k9m
```

## Using API Keys

### 1. Generate an API Key (UI)

1. Navigate to your team's API Keys page: `/teams/{teamId}/api-keys`
2. Click "Generate API Key"
3. Enter a name and select expiration period
4. Copy the full key - it will only be shown once!
5. Store the key securely (environment variables or secrets manager)

### 2. Making API Requests with API Key

#### Using `X-API-Key` header (recommended):

```bash
curl -X POST http://localhost:3000/api/query \
  -H "X-API-Key: flash_a1b2c3d4e5f6_lx8k9m" \
  -H "Content-Type: application/json" \
  -d '{
    "databaseId": "507f1f77bcf86cd799439011",
    "query": "How many users do we have?"
  }'
```

#### Using `Authorization: Bearer` header:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer flash_a1b2c3d4e5f6_lx8k9m" \
  -H "Content-Type: application/json" \
  -d '{
    "databaseId": "507f1f77bcf86cd799439011",
    "query": "How many users do we have?"
  }'
```

### 3. JavaScript/TypeScript Example

```typescript
const apiKey = process.env.FLASH_OPS_API_KEY;

const response = await fetch('http://localhost:3000/api/query', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    databaseId: '507f1f77bcf86cd799439011',
    query: 'How many users do we have?',
  }),
});

const data = await response.json();
console.log(data);
```

### 4. Python Example (Decrypting API Keys)

```python
from app.utils.encryption import decrypt_api_key

# When receiving an encrypted API key from Next.js
encrypted_key = "a1b2c3d4e5f6:7890abcdef..."  # iv:ciphertext format

# Decrypt the key
try:
    decrypted_key = decrypt_api_key(encrypted_key)
    print(f"Decrypted API key: {decrypted_key}")

    # Validate the key format
    if decrypted_key.startswith('flash_'):
        print("Valid Flash Ops API key")
    else:
        print("Invalid API key format")

except ValueError as e:
    print(f"Decryption failed: {e}")
```

## How It Works

### Next.js Backend (Node.js)

1. **Key Generation** (`src/app/api/teams/[id]/api-keys/route.ts`):
   - Generate random key: `flash_<random>_<timestamp>`
   - Encrypt with AES-256-CBC using `ENCRYPTION_KEY`
   - Store encrypted key in MongoDB
   - Return full plaintext key to user (only once)

2. **Key Validation** (`src/lib/api-key-auth.ts`):
   - Extract API key from request headers
   - Look up key by prefix (first 13 chars)
   - Decrypt stored key
   - Compare with provided key using constant-time comparison
   - Check if key is active and not expired
   - Return team context for authorization

3. **Usage Tracking**:
   - Increment `usageCount`
   - Update `lastUsedAt` timestamp
   - Store metadata:
     - `lastUsedBy`: User ID
     - `lastUserName`: User name
     - `lastQuery`: Query text (truncated to 200 chars)
     - `ipAddress`: Client IP address

### Python Backend (FastAPI)

1. **Decryption** (`app/utils/encryption.py`):
   ```python
   def decrypt_api_key(encrypted_key: str) -> str:
       # Split iv:ciphertext format
       # Decrypt using AES-256-CBC with ENCRYPTION_KEY
       # Remove PKCS7 padding
       # Return plaintext key
   ```

2. **Integration Example**:
   ```python
   from fastapi import Header, HTTPException
   from app.utils.encryption import decrypt_api_key

   async def validate_api_key(x_api_key: str = Header(None)):
       if not x_api_key:
           raise HTTPException(status_code=401, detail="API key required")

       # If key is already encrypted, decrypt it
       if ':' in x_api_key:
           try:
               x_api_key = decrypt_api_key(x_api_key)
           except ValueError:
               raise HTTPException(status_code=401, detail="Invalid API key")

       # Validate key format
       if not x_api_key.startswith('flash_'):
           raise HTTPException(status_code=401, detail="Invalid API key format")

       return x_api_key
   ```

## Database Schema

### ApiKey Model

```typescript
{
  _id: ObjectId,
  key: string,              // Encrypted with AES-256-CBC
  keyPrefix: string,        // First 13 chars for display (e.g., "flash_a1b2c3d")
  name: string,             // User-friendly name
  teamId: ObjectId,         // Reference to Team
  createdBy: ObjectId,      // Reference to User who created it
  expiresAt: Date,          // Expiration date
  lastUsedAt: Date,         // Last usage timestamp
  usageCount: number,       // Total number of API calls
  isActive: boolean,        // false = revoked
  permissions: string[],    // e.g., ['query:read'] or ['*']
  metadata: {
    lastUsedBy: string,     // User ID of last caller
    lastUserName: string,   // User name of last caller
    lastQuery: string,      // Last query executed (truncated)
    ipAddress: string,      // Last client IP
  },
  createdAt: Date,
  updatedAt: Date,
}
```

## Admin Features

### View All API Keys

Navigate to `/admin/api-keys` to see:

- **Statistics**:
  - Total Keys
  - Active Keys
  - Total Usage (all API calls)
  - Expired Keys

- **Filterable Table**:
  - Filter by: All, Active, Inactive
  - Shows: Key prefix, Team, Created by, Status, Usage count, Last used, Expiration
  - Displays last query and IP address in metadata

## Security Best Practices

1. **Never commit API keys to version control**
2. **Store keys in environment variables or secrets managers**
3. **Rotate keys regularly** (use expiration dates)
4. **Revoke compromised keys immediately**
5. **Use different keys for different environments** (dev, staging, prod)
6. **Monitor usage** via the admin dashboard
7. **Set appropriate permissions** (currently supports 'query:read' or '*')

## Environment Variables

Both Next.js and FastAPI need the same `ENCRYPTION_KEY`:

**.env** (Next.js):
```env
ENCRYPTION_KEY=e7aec6ccea37c099742016e55bc8c9b7a3e7eb8e929daacaf371be28c06d874e
```

**.env** (FastAPI):
```env
ENCRYPTION_KEY=e7aec6ccea37c099742016e55bc8c9b7a3e7eb8e929daacaf371be28c06d874e
```

Generate a new key:
```bash
openssl rand -hex 32
```

## API Endpoints

### Team API Keys Management

- **GET** `/api/teams/{teamId}/api-keys` - List team's API keys
- **POST** `/api/teams/{teamId}/api-keys` - Generate new API key
- **GET** `/api/teams/{teamId}/api-keys/{keyId}` - Get specific key details
- **DELETE** `/api/teams/{teamId}/api-keys/{keyId}` - Revoke API key

### Admin API Keys Management

- **GET** `/api/admin/api-keys` - List all API keys with statistics
  - Query params: `teamId`, `isActive`, `page`, `limit`

### Query API (Supports API Key Auth)

- **POST** `/api/query` - Execute natural language query
  - Supports both session auth and API key auth
  - Headers: `X-API-Key` or `Authorization: Bearer`
  - Body: `{ databaseId, query }`

## Troubleshooting

### "Invalid API key" Error

- Check that the key starts with `flash_`
- Verify the key hasn't been revoked
- Check expiration date
- Ensure ENCRYPTION_KEY matches between Next.js and FastAPI

### "API key does not have query permission" Error

- Check the `permissions` array in the database
- Default permission is `['query:read']`
- Admin can update permissions if needed

### "API key team does not match database team" Error

- API keys can only query databases belonging to the same team
- Verify `teamId` of both the API key and the database

### Decryption Fails in Python

- Verify `ENCRYPTION_KEY` is identical in both `.env` files
- Check that the encrypted format is `iv:ciphertext` (both hex)
- Ensure Crypto library is installed: `pip install pycryptodome`

## Example Workflow

1. **Admin creates a team** for the data science department
2. **Team lead generates an API key** named "Production Analytics" with 90-day expiration
3. **Data scientist uses the key** in their Python notebooks to query databases
4. **Usage is tracked**: Admin can see which user made which queries, when, and from which IP
5. **Key expires after 90 days**: Team lead generates a new key
6. **Old key is automatically invalidated**: Prevents unauthorized access

## Future Enhancements

- [ ] API key scopes (read-only, read-write, admin)
- [ ] Rate limiting per API key
- [ ] Webhook notifications for key expiration
- [ ] API key rotation without downtime
- [ ] Audit logs for key creation/revocation
- [ ] IP allowlisting per key
