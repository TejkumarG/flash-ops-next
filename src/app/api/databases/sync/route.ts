import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { FASTAPI_ENDPOINTS, getApiUrl } from '@/lib/constants/api';

/**
 * POST /api/databases/sync
 * Trigger sync for a database (calls FastAPI to sync embeddings)
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return errorResponse('Unauthorized', 401);
    }

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const body = await request.json();
    const { databaseId } = body;

    if (!databaseId) {
      return errorResponse('Database ID is required', 400);
    }

    await connectDB();

    const database = await Database.findById(databaseId).populate(
      'connectionId'
    );

    if (!database) {
      return errorResponse('Database not found', 404);
    }

    // Check if database is connected
    if (database.connectionStatus !== 'connected') {
      return errorResponse(
        'Database must be connected before syncing. Please test the connection first.',
        400
      );
    }

    // Update status to syncing
    database.syncStatus = 'syncing';
    await database.save();

    console.log('Starting embeddings sync for database:', databaseId);

    // Call FastAPI to sync embeddings
    const fastApiUrl = getApiUrl(FASTAPI_ENDPOINTS.SYNC_EMBEDDINGS);
    console.log('FastAPI Sync URL:', fastApiUrl);

    // Determine if this is a re-sync (force regenerate)
    // If database has already been synced before, default to false (incremental)
    // Otherwise, it's a first sync (force_regenerate = false is appropriate)
    const forceRegenerate = body.forceRegenerate ?? false;

    try {
      const fastApiResponse = await fetch(fastApiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          db_id: databaseId,
          force_regenerate: forceRegenerate,
        }),
      });

      if (!fastApiResponse.ok) {
        const errorText = await fastApiResponse.text();
        console.error('FastAPI Sync Error:', errorText);
        throw new Error(`FastAPI returned ${fastApiResponse.status}: ${errorText}`);
      }

      const fastApiData = await fastApiResponse.json();
      console.log('FastAPI Sync Response:', fastApiData);

      // Update database with sync results
      database.syncStatus = 'synced';
      database.syncLastAt = new Date();
      database.syncErrorMessage = undefined;
      database.metadata = {
        ...database.metadata,
        lastSyncedBy: session.user.id,
        lastSyncResponse: fastApiData,
        tablesProcessed: fastApiData.tables_processed || 0,
        embeddingsCreated: fastApiData.embeddings_created || 0,
        indexPath: fastApiData.index_path || '',
        processingTimeMs: fastApiData.processing_time_ms || 0,
      };
      await database.save();

      return successResponse(
        {
          databaseId: database._id,
          databaseName: database.databaseName,
          syncStatus: 'synced',
          syncLastAt: database.syncLastAt,
          message: fastApiData.message || 'Sync completed successfully',
          metadata: database.metadata,
        },
        'Database sync completed successfully'
      );
    } catch (fastApiError: any) {
      console.error('FastAPI sync call failed:', fastApiError);

      // Update database status to error
      database.syncStatus = 'error';
      database.syncErrorMessage = `Sync failed: ${fastApiError.message}. Please make sure the FastAPI server is running.`;
      await database.save();

      return errorResponse(
        `Failed to sync database: ${fastApiError.message}`,
        500
      );
    }
  } catch (error: any) {
    console.error('Error syncing database:', error);

    // Try to update status to error
    const { databaseId } = await request.json();
    if (databaseId) {
      try {
        await connectDB();
        await Database.findByIdAndUpdate(databaseId, {
          syncStatus: 'error',
          syncErrorMessage: error.message || 'Sync failed',
        });
      } catch (updateError) {
        console.error('Error updating database status:', updateError);
      }
    }

    return errorResponse(error.message || 'Failed to sync database', 500);
  }
}
