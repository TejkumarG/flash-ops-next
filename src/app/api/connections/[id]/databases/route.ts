import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Connection from '@/models/Connection';
import { decrypt } from '@/lib/encryption';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import sql from 'mssql';

/**
 * Fetch databases from PostgreSQL server
 */
async function fetchPostgreSQLDatabases(connection: any, password: string) {
  const client = new PgClient({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: password,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();
    const result = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1') ORDER BY datname"
    );
    return result.rows.map((row) => row.datname);
  } finally {
    await client.end();
  }
}

/**
 * Fetch databases from MySQL server
 */
async function fetchMySQLDatabases(connection: any, password: string) {
  const conn = await mysql.createConnection({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: password,
  });

  try {
    // First get all databases
    const [allRows] = await conn.query("SELECT SCHEMA_NAME FROM information_schema.schemata ORDER BY SCHEMA_NAME");
    console.log('All MySQL databases:', (allRows as any[]).map((row) => row.SCHEMA_NAME));

    // Then filter out system databases
    const [rows] = await conn.query(
      "SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys') ORDER BY SCHEMA_NAME"
    );
    const userDatabases = (rows as any[]).map((row) => row.SCHEMA_NAME);
    console.log('Filtered MySQL databases:', userDatabases);
    return userDatabases;
  } finally {
    await conn.end();
  }
}

/**
 * Fetch databases from MongoDB server
 */
async function fetchMongoDBDatabases(connection: any, password: string) {
  const uri = `mongodb://${connection.username}:${encodeURIComponent(password)}@${connection.host}:${connection.port}`;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const adminDb = client.db('admin');
    const result = await adminDb.admin().listDatabases();
    return result.databases.map((db) => db.name);
  } finally {
    await client.close();
  }
}

/**
 * Fetch databases from MSSQL server
 */
async function fetchMSSQLDatabases(connection: any, password: string) {
  const config = {
    server: connection.host,
    port: connection.port,
    user: connection.username,
    password: password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  try {
    await sql.connect(config);
    const result = await sql.query(
      "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'model', 'msdb', 'tempdb') ORDER BY name"
    );
    return result.recordset.map((row) => row.name);
  } finally {
    await sql.close();
  }
}

/**
 * GET /api/connections/[id]/databases
 * Fetch available databases from a database connection
 * Admin only
 *
 * Connects to the actual database server and fetches the list of databases.
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

    if (session.user.role !== 'admin') {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    await connectDB();

    const connection = await Connection.findById(params.id);
    if (!connection) {
      return errorResponse('Connection not found', 404);
    }

    // Decrypt password for connection
    const decryptedPassword = decrypt(connection.password);

    let databases: string[] = [];

    try {
      // Fetch databases based on connection type
      switch (connection.connectionType) {
        case 'postgresql':
          databases = await fetchPostgreSQLDatabases(connection, decryptedPassword);
          break;
        case 'mysql':
          databases = await fetchMySQLDatabases(connection, decryptedPassword);
          break;
        case 'mongodb':
          databases = await fetchMongoDBDatabases(connection, decryptedPassword);
          break;
        case 'mssql':
          databases = await fetchMSSQLDatabases(connection, decryptedPassword);
          break;
        default:
          return errorResponse('Unsupported database type', 400);
      }

      console.log(`✅ Fetched ${databases.length} databases from ${connection.connectionType} server:`, databases);
    } catch (error: any) {
      console.error('❌ Error connecting to database server:', error);
      console.error('Connection details:', {
        type: connection.connectionType,
        host: connection.host,
        port: connection.port,
        username: connection.username,
      });
      return errorResponse(
        `Failed to connect to database server: ${error.message}`,
        500
      );
    }

    return successResponse({
      connectionId: connection._id,
      connectionName: connection.name,
      connectionType: connection.connectionType,
      databases: databases.map((db) => ({
        name: db,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching databases from connection:', error);
    return errorResponse(
      error.message || 'Failed to fetch databases',
      500
    );
  }
}
