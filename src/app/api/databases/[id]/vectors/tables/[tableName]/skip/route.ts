import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { toggleTableSkipStatus } from '@/lib/milvus';

/**
 * PUT /api/databases/[id]/vectors/tables/[tableName]/skip
 * Toggle skip status for a table
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; tableName: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id: databaseId, tableName: encodedTableName } = params;
    const tableName = decodeURIComponent(encodedTableName);
    const body = await request.json();
    const { skipped } = body;

    if (typeof skipped !== 'boolean') {
      return errorResponse('Skipped status (boolean) is required', 400);
    }

    console.log(`Toggling skip status for table ${tableName} to ${skipped}`);

    try {
      const result = await toggleTableSkipStatus(databaseId, tableName, skipped);

      return successResponse(
        {
          databaseId,
          tableName,
          skipped,
        },
        result.message || `Table ${skipped ? 'skipped' : 'unskipped'} successfully`
      );
    } catch (milvusError: any) {
      console.error('Milvus skip toggle failed:', milvusError);
      return errorResponse(
        `Failed to toggle skip status: ${milvusError.message}`,
        500
      );
    }
  } catch (error: any) {
    console.error('Error toggling skip status:', error);
    return errorResponse(error.message || 'Failed to toggle skip status', 500);
  }
}
