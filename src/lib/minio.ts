import * as Minio from 'minio';

/**
 * MinIO Client for Object Storage
 * Used to fetch query results stored in MinIO (S3-compatible storage)
 */

const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_SECURE === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

let minioClient: Minio.Client | null = null;

/**
 * Get MinIO client instance (singleton)
 */
export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client(minioConfig);
  }
  return minioClient;
}

/**
 * Get bucket name from environment
 */
export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET || 'query-results';
}

/**
 * Extract object key from S3 path
 * Example: s3://query-results/query-results/results_123.parquet -> query-results/results_123.parquet
 */
export function extractObjectKeyFromS3Path(s3Path: string): string {
  // Remove s3:// prefix
  const withoutProtocol = s3Path.replace(/^s3:\/\//, '');

  // Split by first slash to get bucket and key
  const firstSlashIndex = withoutProtocol.indexOf('/');
  if (firstSlashIndex === -1) {
    throw new Error('Invalid S3 path format');
  }

  // Return everything after the bucket name
  const objectKey = withoutProtocol.substring(firstSlashIndex + 1);
  return objectKey;
}

/**
 * Fetch file from MinIO
 * @param objectKey - The object key in MinIO (e.g., "query-results/results_123.parquet")
 * @returns Buffer containing the file data
 */
export async function fetchFileFromMinio(objectKey: string): Promise<Buffer> {
  const client = getMinioClient();
  const bucket = getMinioBucket();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    client.getObject(bucket, objectKey, (err, dataStream) => {
      if (err) {
        return reject(err);
      }

      dataStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      dataStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      dataStream.on('error', (streamErr) => {
        reject(streamErr);
      });
    });
  });
}

/**
 * Fetch file from MinIO using S3 path
 * @param s3Path - Full S3 path (e.g., "s3://query-results/query-results/results_123.parquet")
 * @returns Buffer containing the file data
 */
export async function fetchFileFromS3Path(s3Path: string): Promise<Buffer> {
  const objectKey = extractObjectKeyFromS3Path(s3Path);
  return fetchFileFromMinio(objectKey);
}
