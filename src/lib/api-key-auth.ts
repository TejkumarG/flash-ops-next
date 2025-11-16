import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ApiKey from '@/models/ApiKey';
import { decrypt, secureCompare } from '@/lib/encryption';

export interface ApiKeyContext {
  apiKeyId: string;
  teamId: string;
  keyName: string;
  permissions: string[];
}

/**
 * Validate API key from request headers
 * Supports both X-API-Key and Authorization: Bearer formats
 */
export async function validateApiKey(request: NextRequest): Promise<{
  isValid: boolean;
  context?: ApiKeyContext;
  error?: string;
}> {
  try {
    // Extract API key from headers
    const apiKeyHeader = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');

    let providedKey: string | null = null;

    if (apiKeyHeader) {
      providedKey = apiKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7);
    }

    if (!providedKey) {
      return {
        isValid: false,
        error: 'API key not provided. Use X-API-Key header or Authorization: Bearer header',
      };
    }

    // Extract prefix from provided key for quick lookup
    const prefix = providedKey.substring(0, 13); // flash_xxxxx

    await connectDB();

    // Find API key by prefix (much faster than checking all keys)
    const apiKey = await ApiKey.findOne({ keyPrefix: prefix, isActive: true });

    if (!apiKey) {
      return {
        isValid: false,
        error: 'Invalid API key',
      };
    }

    // Decrypt the stored key and verify it matches the provided key
    let decryptedKey: string;
    try {
      decryptedKey = decrypt(apiKey.key);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return {
        isValid: false,
        error: 'Invalid API key',
      };
    }

    const isMatch = secureCompare(providedKey, decryptedKey);

    if (!isMatch) {
      return {
        isValid: false,
        error: 'Invalid API key',
      };
    }

    // Check if key has expired
    if (new Date() > new Date(apiKey.expiresAt)) {
      return {
        isValid: false,
        error: 'API key has expired',
      };
    }

    // Return valid context
    return {
      isValid: true,
      context: {
        apiKeyId: apiKey._id.toString(),
        teamId: apiKey.teamId.toString(),
        keyName: apiKey.name,
        permissions: apiKey.permissions || [],
      },
    };
  } catch (error: any) {
    console.error('API key validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate API key',
    };
  }
}

/**
 * Track API key usage
 * Updates usage count, last used timestamp, and metadata
 */
export async function trackApiKeyUsage(
  apiKeyId: string,
  metadata?: {
    userId?: string;
    userName?: string;
    query?: string;
    ipAddress?: string;
  }
): Promise<void> {
  try {
    await connectDB();

    const updateData: any = {
      $inc: { usageCount: 1 },
      $set: { lastUsedAt: new Date() },
    };

    // Update metadata if provided
    if (metadata) {
      if (metadata.userId) {
        updateData.$set['metadata.lastUsedBy'] = metadata.userId;
      }
      if (metadata.userName) {
        updateData.$set['metadata.lastUserName'] = metadata.userName;
      }
      if (metadata.query) {
        updateData.$set['metadata.lastQuery'] = metadata.query.substring(0, 200); // Limit length
      }
      if (metadata.ipAddress) {
        updateData.$set['metadata.ipAddress'] = metadata.ipAddress;
      }
    }

    await ApiKey.findByIdAndUpdate(apiKeyId, updateData);
  } catch (error) {
    console.error('Error tracking API key usage:', error);
    // Don't throw - tracking failure shouldn't break the request
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Check if API key has specific permission
 */
export function hasPermission(context: ApiKeyContext, permission: string): boolean {
  return context.permissions.includes(permission) || context.permissions.includes('*');
}
