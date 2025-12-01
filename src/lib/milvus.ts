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

    // Build filter expression
    const expr = `database_id == "${databaseId}"`;
    console.log(`[Milvus] Query expression: ${expr}`);

    // If NO search query, use efficient Milvus pagination
    if (!search) {
      console.log(`[Milvus] No search - using direct Milvus pagination`);

      // Get count using Milvus count query (no data fetch)
      const countResult = await client.query({
        collection_name: MILVUS_COLLECTION,
        expr: expr,
        output_fields: ['count(*)'],
        limit: 1,
      });

      // Fallback: if count(*) doesn't work, fetch IDs to count
      let total = 0;
      if (countResult.data && countResult.data[0] && countResult.data[0]['count(*)']) {
        total = countResult.data[0]['count(*)'];
      } else {
        // Fallback: fetch only IDs
        const idCountResult = await client.query({
          collection_name: MILVUS_COLLECTION,
          expr: expr,
          output_fields: ['id'],
          limit: 16384,
        });
        total = idCountResult.data?.length || 0;
      }

      // Get paginated data
      const queryResult = await client.query({
        collection_name: MILVUS_COLLECTION,
        expr: expr,
        output_fields: ['*'],
        limit: limit,
        offset: offset,
      });

      const paginatedVectors = queryResult.data || [];
      console.log(`[Milvus] Total: ${total}, returning ${paginatedVectors.length} vectors (offset: ${offset}, limit: ${limit})`);

      // Get unique tables from paginated results
      const tables = [...new Set(paginatedVectors.map((v: any) => v.table_name))];

      return {
        vectors: paginatedVectors.map((v: any) => formatVector(v)),
        total,
        hasData: total > 0,
        tables,
        metadata: {
          collection: MILVUS_COLLECTION,
          database_id: databaseId,
        },
      };
    }

    // If search query exists, we need to fetch all and filter (Milvus doesn't support LIKE)
    console.log(`[Milvus] Search term: "${search}" - fetching all for client-side filter`);

    const queryResult = await client.query({
      collection_name: MILVUS_COLLECTION,
      expr: expr,
      output_fields: ['*'],
      limit: 16384,
    });

    let allVectors = queryResult.data || [];
    console.log(`[Milvus] Total vectors from Milvus: ${allVectors.length}`);

    // Filter by search query in Node.js (case-insensitive)
    const searchLower = search.toLowerCase();
    allVectors = allVectors.filter((v: any) => {
      const tableName = (v.table_name || '').toLowerCase();
      const description = (v.text || '').toLowerCase();
      return tableName.includes(searchLower) || description.includes(searchLower);
    });

    console.log(`[Milvus] Vectors after search filter: ${allVectors.length}`);

    // Apply pagination to filtered results
    const total = allVectors.length;
    const paginatedVectors = allVectors.slice(offset, offset + limit);

    console.log(`[Milvus] Total after filter: ${total}, returning ${paginatedVectors.length} vectors (offset: ${offset}, limit: ${limit})`);

    // Get unique tables from paginated results
    const tables = [...new Set(paginatedVectors.map((v: any) => v.table_name))];
    console.log(`[Milvus] Found ${tables.length} unique tables in current page`);

    return {
      vectors: paginatedVectors.map((v: any) => formatVector(v)),
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
 * Field description structure (matches Python backend)
 */
interface FieldDescription {
  field_name: string;
  description: string;
}

/**
 * Format a Milvus vector record
 */
function formatVector(v: any) {
  const textContent = v.text || '';
  const lines = textContent.split('\n');
  const tableNameLine = lines[0] || '';
  const columnsLine = lines[2] || '';

  // Parse field_descriptions - stored as JSON string of list [{field_name, description}, ...]
  let fieldDescriptions: FieldDescription[] = [];
  if (v.field_descriptions) {
    if (typeof v.field_descriptions === 'string') {
      try {
        fieldDescriptions = JSON.parse(v.field_descriptions);
      } catch {
        fieldDescriptions = [];
      }
    } else if (Array.isArray(v.field_descriptions)) {
      fieldDescriptions = v.field_descriptions;
    }
  }

  // Use the separate description field if available, otherwise fallback to text line
  const description = v.description || lines[1] || '';

  return {
    id: v.id || `${v.database_id}_${v.table_name}`,
    table_name: v.table_name,
    description: description,
    needs_sync: v.needs_sync || false,
    skipped: v.skipped || false,
    field_descriptions: fieldDescriptions,
    fields_count: fieldDescriptions.length,
    metadata: {
      fullText: textContent,
      tableLine: tableNameLine,
      descriptionLine: description,
      columnsLine: v.schema || columnsLine,
    },
  };
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
  _vectorId: string,
  description: string,
  collectionName: string = MILVUS_COLLECTION,
  databaseId?: string,
  tableName?: string
) {
  const client = getMilvusClient();

  try {
    console.log(`[Milvus] Updating vector for table ${tableName} in database ${databaseId}`);

    if (!databaseId || !tableName) {
      throw new Error('database_id and table_name are required for update');
    }

    // Query by database_id and table_name
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
 * Update field descriptions for a table
 * field_descriptions is stored as JSON string of list: [{field_name, description}, ...]
 */
export async function updateFieldDescriptions(
  databaseId: string,
  tableName: string,
  fieldDescriptions: FieldDescription[],
  collectionName: string = MILVUS_COLLECTION
) {
  const client = getMilvusClient();

  try {
    console.log(`[Milvus] Updating field_descriptions for table: ${tableName}`);

    // Get all vectors for this table
    const expr = `database_id == "${databaseId}" && table_name == "${tableName}"`;
    console.log(`[Milvus] Query expression: ${expr}`);

    const queryResult = await client.query({
      collection_name: collectionName,
      expr: expr,
      output_fields: ['*'],
      limit: 100,
    });

    if (!queryResult.data || queryResult.data.length === 0) {
      throw new Error(`No vector found for table ${tableName} in database ${databaseId}`);
    }

    // Prepare updated vectors with new field_descriptions
    const updatedVectors = queryResult.data.map((vector: any) => ({
      ...vector,
      field_descriptions: JSON.stringify(fieldDescriptions),
      needs_sync: true,
    }));

    console.log(`[Milvus] Upserting ${updatedVectors.length} vectors with field_descriptions`);

    const upsertResult = await client.upsert({
      collection_name: collectionName,
      data: updatedVectors,
    });

    console.log(`[Milvus] Upsert result:`, upsertResult);

    // Flush to ensure data is persisted
    await client.flush({
      collection_names: [collectionName],
    });

    console.log(`[Milvus] Successfully updated field_descriptions for table ${tableName}`);

    return {
      success: true,
      message: 'Field descriptions updated successfully',
      fields_count: fieldDescriptions.length,
    };
  } catch (error: any) {
    console.error('Error updating field descriptions:', error);
    throw new Error(`Failed to update field descriptions: ${error.message}`);
  }
}

/**
 * Get field descriptions for a table
 * Returns list format: [{field_name, description}, ...]
 */
export async function getFieldDescriptions(
  databaseId: string,
  tableName: string,
  collectionName: string = MILVUS_COLLECTION
) {
  const client = getMilvusClient();

  try {
    const expr = `database_id == "${databaseId}" && table_name == "${tableName}"`;

    const queryResult = await client.query({
      collection_name: collectionName,
      expr: expr,
      output_fields: ['field_descriptions', 'schema', 'text', 'description'],
      limit: 1,
    });

    if (!queryResult.data || queryResult.data.length === 0) {
      throw new Error(`No vector found for table ${tableName}`);
    }

    const vector = queryResult.data[0];

    // Parse field_descriptions - stored as JSON string of list [{field_name, description}, ...]
    let fieldDescriptions: FieldDescription[] = [];
    if (vector.field_descriptions) {
      if (typeof vector.field_descriptions === 'string') {
        try {
          fieldDescriptions = JSON.parse(vector.field_descriptions);
        } catch {
          fieldDescriptions = [];
        }
      } else if (Array.isArray(vector.field_descriptions)) {
        fieldDescriptions = vector.field_descriptions;
      }
    }

    // Get schema/columns info
    let schema = '';
    if (vector.schema) {
      schema = typeof vector.schema === 'string' ? vector.schema : JSON.stringify(vector.schema);
    }

    return {
      field_descriptions: fieldDescriptions,
      schema: schema,
      fields_count: fieldDescriptions.length,
      table_description: vector.description || '',
    };
  } catch (error: any) {
    console.error('Error getting field descriptions:', error);
    throw new Error(`Failed to get field descriptions: ${error.message}`);
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
    console.log(`[Milvus] Toggling skip status for table: ${tableName} to ${skipped}`);

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
