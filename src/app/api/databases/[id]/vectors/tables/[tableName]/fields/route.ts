import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getFieldDescriptions, updateFieldDescriptions } from '@/lib/milvus';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';

/**
 * GET /api/databases/[id]/vectors/tables/[tableName]/fields
 * Get field descriptions for a table
 * Returns: { field_descriptions: [{field_name, description}, ...], schema, fields_count }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tableName: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const { id: databaseId, tableName } = await params;
    const decodedTableName = decodeURIComponent(tableName);

    const result = await getFieldDescriptions(databaseId, decodedTableName);

    return successResponse({
      databaseId,
      tableName: decodedTableName,
      field_descriptions: result.field_descriptions,
      schema: result.schema,
      fields_count: result.fields_count,
      table_description: result.table_description,
    });
  } catch (error: any) {
    console.error('Error getting field descriptions:', error);
    return errorResponse(error.message || 'Failed to get field descriptions', 500);
  }
}

/**
 * PUT /api/databases/[id]/vectors/tables/[tableName]/fields
 * Update field descriptions for a table
 * Expects: { field_descriptions: [{field_name, description}, ...] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableName: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const { id: databaseId, tableName } = await params;
    const decodedTableName = decodeURIComponent(tableName);
    const body = await request.json();
    const { field_descriptions } = body;

    if (!field_descriptions || !Array.isArray(field_descriptions)) {
      return errorResponse('field_descriptions array is required', 400);
    }

    const result = await updateFieldDescriptions(
      databaseId,
      decodedTableName,
      field_descriptions
    );

    // Update MongoDB: mark database as needing sync (only if already synced)
    await connectDB();
    const database = await Database.findById(databaseId);

    if (database && database.syncStatus === 'synced') {
      await Database.findByIdAndUpdate(
        databaseId,
        { syncStatus: 'yet_to_sync' }
      );
      console.log(`Database ${databaseId} marked as needing sync after field descriptions update`);
    }

    return successResponse({
      databaseId,
      tableName: decodedTableName,
      fields_count: result.fields_count,
      needs_sync: true,
    }, result.message);
  } catch (error: any) {
    console.error('Error updating field descriptions:', error);
    return errorResponse(error.message || 'Failed to update field descriptions', 500);
  }
}
