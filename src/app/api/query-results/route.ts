import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getMinioClient, getMinioBucket } from '@/lib/minio';
import { parquetRead, parquetMetadata } from 'hyparquet';

/**
 * Convert BigInt values to strings for JSON serialization
 */
function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings);
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntsToStrings(obj[key]);
    }
    return converted;
  }

  return obj;
}

/**
 * POST /api/query-results
 * Fetch and parse parquet file from MinIO
 * Authenticated users only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { s3Path } = body;

    console.log('=== POST /api/query-results called ===');
    console.log('S3 Path:', s3Path);

    if (!s3Path) {
      return errorResponse('S3 path is required', 400);
    }

    // Extract object key - remove s3:// prefix if present, otherwise use as-is
    let objectKey = s3Path;
    if (s3Path.startsWith('s3://')) {
      // Remove s3:// and bucket name
      const withoutProtocol = s3Path.replace(/^s3:\/\//, '');
      const firstSlashIndex = withoutProtocol.indexOf('/');
      objectKey = withoutProtocol.substring(firstSlashIndex + 1);
    }

    console.log('Object key:', objectKey);

    // Fetch file from MinIO
    console.log('Fetching file from MinIO...');
    const client = getMinioClient();
    const bucket = getMinioBucket();

    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      client.getObject(bucket, objectKey, (err, dataStream) => {
        if (err) return reject(err);
        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', (streamErr) => reject(streamErr));
      });
    });
    console.log('File fetched, buffer size:', fileBuffer.length, 'bytes');

    // Parse parquet file using hyparquet
    console.log('Parsing parquet file with hyparquet...');
    let rows: any[] = [];

    // Convert Node.js Buffer to ArrayBuffer for hyparquet
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    // Get metadata to extract column names
    const metadata = parquetMetadata(arrayBuffer);
    const columnNames = metadata.schema.map((col: any) => col.name);
    console.log('Column names from metadata:', columnNames);

    // Read parquet data
    await parquetRead({
      file: arrayBuffer,
      onComplete: (data: any[]) => {
        console.log('Parquet parsing complete, rows:', data.length);
        rows = data;
      },
    });

    console.log('Parquet parsed successfully, total rows:', rows.length);

    // Convert array of arrays to array of objects with column names
    let objectRows = rows;
    if (columnNames.length > 0 && rows.length > 0 && Array.isArray(rows[0])) {
      objectRows = rows.map((row: any[]) => {
        const obj: any = {};
        columnNames.forEach((colName: string, index: number) => {
          obj[colName] = row[index];
        });
        return obj;
      });
      console.log('Converted arrays to objects with column names');
    }

    // Convert BigInt values to strings for JSON serialization
    const convertedRows = convertBigIntsToStrings(objectRows);

    return successResponse({
      rowCount: convertedRows.length,
      data: convertedRows,
      s3Path,
    });
  } catch (error: any) {
    console.error('Error fetching query results:', error);
    console.error('Error stack:', error.stack);

    return errorResponse(
      error.message || 'Failed to fetch query results',
      500
    );
  }
}
