import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { testConnectionSchema } from '@/lib/validation';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import sql from 'mssql';

/**
 * Test PostgreSQL connection
 */
async function testPostgreSQLConnection(host: string, port: number, username: string, password: string) {
  const client = new PgClient({
    host,
    port,
    user: username,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { success: true, message: 'Successfully connected to PostgreSQL' };
  } finally {
    await client.end();
  }
}

/**
 * Test MySQL connection
 */
async function testMySQLConnection(host: string, port: number, username: string, password: string) {
  const conn = await mysql.createConnection({
    host,
    port,
    user: username,
    password,
    connectTimeout: 5000,
  });

  try {
    await conn.query('SELECT 1');
    return { success: true, message: 'Successfully connected to MySQL' };
  } finally {
    await conn.end();
  }
}

/**
 * Test MongoDB connection
 */
async function testMongoDBConnection(host: string, port: number, username: string, password: string) {
  const uri = `mongodb://${username}:${encodeURIComponent(password)}@${host}:${port}`;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    return { success: true, message: 'Successfully connected to MongoDB' };
  } finally {
    await client.close();
  }
}

/**
 * Test MSSQL connection
 */
async function testMSSQLConnection(host: string, port: number, username: string, password: string) {
  const config = {
    server: host,
    port,
    user: username,
    password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: 5000,
  };

  try {
    await sql.connect(config);
    await sql.query('SELECT 1');
    return { success: true, message: 'Successfully connected to SQL Server' };
  } finally {
    await sql.close();
  }
}

/**
 * POST /api/connections/test
 * Test a database connection before saving
 * Admin only
 *
 * Actually tests the connection to the database server with provided credentials.
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

    // Validate request body
    const validation = testConnectionSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0].message,
        400
      );
    }

    const { connectionType, host, port, username, password, databaseName } =
      validation.data;

    let result;

    try {
      // Test connection based on database type
      switch (connectionType) {
        case 'postgresql':
          result = await testPostgreSQLConnection(host, port, username, password);
          break;
        case 'mysql':
          result = await testMySQLConnection(host, port, username, password);
          break;
        case 'mongodb':
          result = await testMongoDBConnection(host, port, username, password);
          break;
        case 'mssql':
          result = await testMSSQLConnection(host, port, username, password);
          break;
        default:
          return errorResponse('Unsupported database type', 400);
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);

      // Provide more specific error messages
      let errorMessage = 'Connection test failed';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Cannot connect to ${host}:${port}. Server is not reachable.`;
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = `Host "${host}" not found. Please check the hostname.`;
      } else if (error.code === '28P01' || error.code === 'ER_ACCESS_DENIED_ERROR') {
        errorMessage = 'Authentication failed. Please check username and password.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timeout. Server took too long to respond.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return errorResponse(errorMessage, 400);
    }

    return successResponse(
      {
        success: true,
        message: result.message,
        connectionType,
        host,
        port,
        databaseName,
      },
      result.message
    );
  } catch (error: any) {
    console.error('Error testing connection:', error);
    return errorResponse(
      error.message || 'Connection test failed',
      500
    );
  }
}
