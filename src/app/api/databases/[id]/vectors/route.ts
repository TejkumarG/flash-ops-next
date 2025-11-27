import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { queryVectorsByDatabaseId } from '@/lib/milvus';

/**
 * GET /api/databases/[id]/vectors
 * Fetch vector embeddings from Milvus for a specific database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id: databaseId } = params;
    const { searchParams } = new URL(request.url);

    // Get filter parameters
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`Fetching vectors for database: ${databaseId}`);
    console.log(`Search: ${search}, Limit: ${limit}, Offset: ${offset}`);

    try {
      // Query Milvus directly
      const data = await queryVectorsByDatabaseId(databaseId, {
        search,
        limit,
        offset,
      });

      console.log(`Milvus query result - hasData: ${data.hasData}, total: ${data.total}, vectors: ${data.vectors?.length}`);

      if (!data.hasData) {
        return successResponse(
          {
            vectors: [],
            total: 0,
            hasData: false,
            message: 'No embeddings found. Please sync the database first.',
          },
          'No vector data available'
        );
      }

      return successResponse(
        {
          vectors: data.vectors || [],
          total: data.total || 0,
          hasData: true,
          tables: data.tables || [],
          metadata: data.metadata || {},
        },
        'Vectors fetched successfully'
      );

    } catch (milvusError: any) {
      console.error('Milvus query failed:', milvusError);

      // Return empty data if Milvus is not available
      return successResponse(
        {
          vectors: [],
          total: 0,
          hasData: false,
          message: `Vector store error: ${milvusError.message}. Please ensure Milvus is running and the database is synced.`,
        },
        'Vector store unavailable'
      );
    }
  } catch (error: any) {
    console.error('Error fetching vectors:', error);
    return errorResponse(error.message || 'Failed to fetch vector data', 500);
  }
}
