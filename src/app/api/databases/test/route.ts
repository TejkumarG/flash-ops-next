import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Database from '@/models/Database';
import Connection from '@/models/Connection';
import { decrypt } from '@/lib/encryption';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import sql from 'mssql';

/**
 * Test PostgreSQL database connection
 */
async function testPostgreSQLDatabase(connection: any, password: string, databaseName: string) {
  const client = new PgClient({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password,
    database: databaseName,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { success: true, message: `Successfully connected to ${databaseName}` };
  } finally {
    await client.end();
  }
}

/**
 * Test MySQL database connection
 */
async function testMySQLDatabase(connection: any, password: string, databaseName: string) {
  const conn = await mysql.createConnection({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password,
    database: databaseName,
    connectTimeout: 5000,
  });

  try {
    await conn.query('SELECT 1');
    return { success: true, message: `Successfully connected to ${databaseName}` };
  } finally {
    await conn.end();
  }
}

/**
 * Test MongoDB database connection
 */
async function testMongoDBDatabase(connection: any, password: string, databaseName: string) {
  const uri = `mongodb://${connection.username}:${encodeURIComponent(password)}@${connection.host}:${connection.port}/${databaseName}`;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    await client.db(databaseName).command({ ping: 1 });
    return { success: true, message: `Successfully connected to ${databaseName}` };
  } finally {
    await client.close();
  }
}

/**
 * Test MSSQL database connection
 */
async function testMSSQLDatabase(connection: any, password: string, databaseName: string) {
  const config = {
    server: connection.host,
    port: connection.port,
    user: connection.username,
    password,
    database: databaseName,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: 5000,
  };

  try {
    await sql.connect(config);
    await sql.query('SELECT 1');
    return { success: true, message: `Successfully connected to ${databaseName}` };
  } finally {
    await sql.close();
  }
}

/**
 * POST /api/databases/test
 * Test connection to a specific database
 * Admin only
 *
 * Actually tests the connection to the database with provided credentials.
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

    const connection = database.connectionId as any;

    // Decrypt password for connection test
    const decryptedPassword = decrypt(connection.password);

    let result;

    try {
      // Test connection based on database type
      switch (connection.connectionType) {
        case 'postgresql':
          result = await testPostgreSQLDatabase(connection, decryptedPassword, database.databaseName);
          break;
        case 'mysql':
          result = await testMySQLDatabase(connection, decryptedPassword, database.databaseName);
          break;
        case 'mongodb':
          result = await testMongoDBDatabase(connection, decryptedPassword, database.databaseName);
          break;
        case 'mssql':
          result = await testMSSQLDatabase(connection, decryptedPassword, database.databaseName);
          break;
        default:
          return errorResponse('Unsupported database type', 400);
      }

      // Update database connection status to connected
      database.connectionStatus = 'connected';
      database.lastConnectionTest = new Date();
      await database.save();

    } catch (error: any) {
      console.error('Database connection test failed:', error);

      // Update status to error
      database.connectionStatus = 'error';
      database.lastConnectionTest = new Date();
      await database.save();

      // Provide specific error messages
      let errorMessage = 'Database connection test failed';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to ${connection.host}:${connection.port}. Server is not reachable.`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = `Host "${connection.host}" not found.`;
      } else if (error.code === '28P01' || error.code === 'ER_ACCESS_DENIED_ERROR') {
        errorMessage = 'Authentication failed. Please check credentials.';
      } else if (error.code === '3D000' || error.code === 'ER_BAD_DB_ERROR') {
        errorMessage = `Database "${database.databaseName}" does not exist.`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timeout.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return errorResponse(errorMessage, 400);
    }

    return successResponse(
      {
        success: true,
        databaseId: database._id,
        databaseName: database.databaseName,
        connectionStatus: 'connected',
        message: result.message,
      },
      result.message
    );
  } catch (error: any) {
    console.error('Error testing database connection:', error);
    return errorResponse(
      error.message || 'Database connection test failed',
      500
    );
  }
}
