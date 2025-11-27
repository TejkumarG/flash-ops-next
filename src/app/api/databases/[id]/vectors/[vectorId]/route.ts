import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { updateVectorDescription } from '@/lib/milvus';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';

/**
 * PUT /api/databases/[id]/vectors/[vectorId]
 * Update a vector's description
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; vectorId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    const { vectorId } = params;
    const { id: databaseId } = params;
    const body = await request.json();
    const { description, table_name, database_id } = body;

    if (!description) {
      return errorResponse('Description is required', 400);
    }

    if (!table_name || !database_id) {
      return errorResponse('table_name and database_id are required', 400);
    }

    try {
      const result = await updateVectorDescription(
        vectorId,
        description,
        undefined, // collectionName (use default)
        database_id,
        table_name
      );

      // Update MongoDB: mark database as needing sync (only if already synced)
      await connectDB();
      const database = await Database.findById(database_id);

      if (database && database.syncStatus === 'synced') {
        await Database.findByIdAndUpdate(
          database_id,
          { syncStatus: 'yet_to_sync' }
        );
        console.log(`Database ${database_id} marked as needing sync`);
      }

      return successResponse(
        {
          vectorId,
          description,
          needs_sync: true,
        },
        result.message || 'Vector description updated successfully'
      );
    } catch (milvusError: any) {
      console.error('Milvus update failed:', milvusError);
      return errorResponse(
        `Failed to update vector: ${milvusError.message}`,
        500
      );
    }
  } catch (error: any) {
    console.error('Error updating vector:', error);
    return errorResponse(error.message || 'Failed to update vector', 500);
  }
}
