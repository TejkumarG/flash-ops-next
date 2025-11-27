import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const MILVUS_HOST = process.env.MILVUS_HOST || 'localhost';
const MILVUS_PORT = process.env.MILVUS_PORT || '19530';
const MILVUS_COLLECTION = process.env.MILVUS_COLLECTION_NAME || 'table_embeddings';

/**
 * Get Milvus client instance
 */
export function getMilvusClient() {
  return new MilvusClient({
    address: `${MILVUS_HOST}:${MILVUS_PORT}`,
  });
}

/**
 * Check if collection exists in Milvus
 */
export async function collectionExists(collectionName: string = MILVUS_COLLECTION) {
  const client = getMilvusClient();
  try {
    const result = await client.hasCollection({
      collection_name: collectionName,
    });
    return result.value;
  } catch (error) {
    console.error('Error checking collection existence:', error);
    return false;
  }
}

/**
 * Query vectors from Milvus by database ID
 */
export async function queryVectorsByDatabaseId(
  databaseId: string,
  options: {
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const client = getMilvusClient();
  const { search = '', limit = 100, offset = 0 } = options;

  try {
    console.log(`[Milvus] Querying collection: ${MILVUS_COLLECTION} for database_id: ${databaseId}`);

    // List all collections
    const allCollections = await listAllCollections();
    console.log(`[Milvus] Available collections:`, allCollections);

    // Check if collection exists
    const exists = await collectionExists(MILVUS_COLLECTION);
    if (!exists) {
      console.log('[Milvus] Collection does not exist');
      return {
        vectors: [],
        total: 0,
        hasData: false,
        tables: [],
        message: 'Collection not found in Milvus',
      };
    }

    console.log('[Milvus] Collection exists, loading...');

    // Load collection
    await client.loadCollectionSync({
      collection_name: MILVUS_COLLECTION,
    });

    // Build filter expression
    let expr = `database_id == "${databaseId}"`;

    if (search) {
      // Add search filter for table_name or description
      expr += ` && (table_name like "%${search}%" || description like "%${search}%")`;
    }

    console.log(`[Milvus] Query expression: ${expr}`);

    // First, let's check what database_id values exist in the collection
    try {
      const allDbIdsResult = await client.query({
        collection_name: MILVUS_COLLECTION,
        expr: '', // Empty expression to get all records
        output_fields: ['database_id', 'table_name'],
        limit: 100,
      });

      console.log(`[Milvus] Total records in first query:`, allDbIdsResult.data?.length || 0);
      const uniqueDbIds = [...new Set(allDbIdsResult.data?.map((v: any) => v.database_id) || [])];
      console.log(`[Milvus] Unique database_id values in collection:`, uniqueDbIds);
      console.log(`[Milvus] Sample records:`, allDbIdsResult.data?.slice(0, 3));
      console.log(`[Milvus] Looking for database_id: ${databaseId}`);
      console.log(`[Milvus] Match found:`, uniqueDbIds.includes(databaseId));
    } catch (err) {
      console.log(`[Milvus] Error getting all database_ids:`, err);
    }

    // Query vectors - use '*' to get all fields
    console.log(`[Milvus] Querying with limit: ${limit}, offset: ${offset}`);

    const queryResult = await client.query({
      collection_name: MILVUS_COLLECTION,
      expr: expr,
      output_fields: ['*'],
      limit: limit,
      offset: offset,
    });

    console.log(`[Milvus] Query result status:`, queryResult.status);
    console.log(`[Milvus] Query result data length:`, queryResult.data?.length);
    console.log(`[Milvus] Sample vector data:`, JSON.stringify(queryResult.data?.[0]));

    const vectors = queryResult.data || [];
    console.log(`[Milvus] Query returned ${vectors.length} vectors`);

    // Get unique tables
    const tables = [...new Set(vectors.map((v: any) => v.table_name))];
    console.log(`[Milvus] Found ${tables.length} unique tables:`, tables);

    // Get total count
    const countResult = await client.query({
      collection_name: MILVUS_COLLECTION,
      expr: expr,
      output_fields: ['id'],
      limit: 16384, // Max limit for count
    });

    const total = countResult.data?.length || 0;
    console.log(`[Milvus] Total count: ${total}`);

    return {
      vectors: vectors.map((v: any) => {
        // Parse the text field to extract table description
        const textContent = v.text || '';
        const lines = textContent.split('\n');
        const tableNameLine = lines[0] || '';
        const descriptionLine = lines[1] || '';
        const columnsLine = lines[2] || '';

        return {
          id: v.id || `${v.database_id}_${v.table_name}`,
          table_name: v.table_name,
          description: textContent,
          needs_sync: v.needs_sync || false,
          skipped: v.skipped || false,
          metadata: {
            fullText: textContent,
            tableLine: tableNameLine,
            descriptionLine: descriptionLine,
            columnsLine: columnsLine,
          },
        };
      }),
      total,
      hasData: total > 0,
      tables,
      metadata: {
        collection: MILVUS_COLLECTION,
        database_id: databaseId,
      },
    };
  } catch (error: any) {
    console.error('Error querying Milvus:', error);
    throw new Error(`Failed to query vectors: ${error.message}`);
  }
}

/**
 * Get collection stats
 */
export async function getCollectionStats(collectionName: string = MILVUS_COLLECTION) {
  const client = getMilvusClient();

  try {
    const stats = await client.getCollectionStatistics({
      collection_name: collectionName,
    });

    return {
      row_count: stats.data.row_count,
      ...stats.data,
    };
  } catch (error) {
    console.error('Error getting collection stats:', error);
    return null;
  }
}

/**
 * List all collections in Milvus
 */
export async function listAllCollections() {
  const client = getMilvusClient();

  try {
    const result = await client.listCollections();
    return result.data;
  } catch (error) {
    console.error('Error listing collections:', error);
    return [];
  }
}

/**
 * Update vector description by database_id and table_name
 */
export async function updateVectorDescription(
  vectorId: string,
  description: string,
  collectionName: string = MILVUS_COLLECTION,
  databaseId?: string,
  tableName?: string
) {
  const client = getMilvusClient();

  try {
    console.log(`[Milvus] Updating vector for table ${tableName} in database ${databaseId}`);
    console.log(`[Milvus] Collection: ${collectionName}`);
    console.log(`[Milvus] New description length: ${description.length} characters`);

    if (!databaseId || !tableName) {
      throw new Error('database_id and table_name are required for update');
    }

    // Check if collection exists
    const exists = await collectionExists(collectionName);
    if (!exists) {
      throw new Error('Collection not found in Milvus');
    }

    // Load collection
    await client.loadCollectionSync({
      collection_name: collectionName,
    });
    console.log(`[Milvus] Collection loaded successfully`);

    // Query by database_id and table_name (reliable approach)
    const expr = `database_id == "${databaseId}" && table_name == "${tableName}"`;
    console.log(`[Milvus] Query expression: ${expr}`);

    const queryResult = await client.query({
      collection_name: collectionName,
      expr: expr,
      output_fields: ['*'],
      limit: 100,
    });

    console.log(`[Milvus] Query result status:`, queryResult.status);
    console.log(`[Milvus] Found ${queryResult.data?.length || 0} vectors`);

    if (!queryResult.data || queryResult.data.length === 0) {
      throw new Error(`No vector found for table ${tableName} in database ${databaseId}`);
    }

    // Get the existing vectors
    const existingVectors = queryResult.data;
    console.log(`[Milvus] Found ${existingVectors.length} vector(s) to update`);

    // Prepare updated vectors with new description
    const updatedVectors = existingVectors.map((vector: any) => ({
      ...vector,
      text: description,
      needs_sync: true,
    }));

    console.log(`[Milvus] Upserting ${updatedVectors.length} vectors`);
    console.log(`[Milvus] Sample update data:`, {
      id: updatedVectors[0]?.id,
      table_name: updatedVectors[0]?.table_name,
      database_id: updatedVectors[0]?.database_id,
      text_preview: updatedVectors[0]?.text?.substring(0, 100),
      needs_sync: updatedVectors[0]?.needs_sync
    });

    const upsertResult = await client.upsert({
      collection_name: collectionName,
      data: updatedVectors,
    });

    console.log(`[Milvus] Upsert result:`, upsertResult);

    // Flush to ensure data is persisted
    await client.flush({
      collection_names: [collectionName],
    });

    console.log(`[Milvus] Successfully updated ${updatedVectors.length} vector(s) for table ${tableName}`);

    return {
      success: true,
      message: 'Description updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating vector description:', error);
    throw new Error(`Failed to update vector description: ${error.message}`);
  }
}

/**
 * Toggle skip status for a table
 */
export async function toggleTableSkipStatus(
  databaseId: string,
  tableName: string,
  skipped: boolean,
  collectionName: string = MILVUS_COLLECTION
) {
  const client = getMilvusClient();

  try {
    console.log(`[Milvus] Toggling skip status for table: ${tableName} in database: ${databaseId}`);
    console.log(`[Milvus] New skip status: ${skipped}`);

    // Check if collection exists
    const exists = await collectionExists(collectionName);
    if (!exists) {
      throw new Error('Collection not found in Milvus');
    }

    // Load collection
    await client.loadCollectionSync({
      collection_name: collectionName,
    });

    // Get all vectors for this table
    const expr = `database_id == "${databaseId}" && table_name == "${tableName}"`;
    console.log(`[Milvus] Query expression: ${expr}`);

    const queryResult = await client.query({
      collection_name: collectionName,
      expr: expr,
      output_fields: ['*'],
      limit: 16384,
    });

    console.log(`[Milvus] Query result:`, queryResult.status);
    console.log(`[Milvus] Found ${queryResult.data?.length || 0} vectors for table`);

    if (!queryResult.data || queryResult.data.length === 0) {
      throw new Error('No vectors found for this table');
    }

    // Upsert updated vectors with new skip status (replaces existing records)
    const updatedVectors = queryResult.data.map((vector: any) => ({
      ...vector,
      skipped: skipped,
    }));

    console.log(`[Milvus] Upserting ${updatedVectors.length} vectors with IDs:`, updatedVectors.map(v => v.id));
    console.log(`[Milvus] Sample update data:`, {
      id: updatedVectors[0]?.id,
      table_name: updatedVectors[0]?.table_name,
      skipped: updatedVectors[0]?.skipped
    });

    const upsertResult = await client.upsert({
      collection_name: collectionName,
      data: updatedVectors,
    });

    console.log(`[Milvus] Upsert result:`, upsertResult);

    // Flush to ensure data is persisted
    await client.flush({
      collection_names: [collectionName],
    });

    console.log(`[Milvus] Successfully toggled skip status for table ${tableName} to ${skipped}`);

    return {
      success: true,
      message: `Table ${skipped ? 'skipped' : 'unskipped'} successfully`,
    };
  } catch (error: any) {
    console.error('Error toggling table skip status:', error);
    throw new Error(`Failed to toggle skip status: ${error.message}`);
  }
}
