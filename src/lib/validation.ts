import { z } from 'zod';

/**
 * Database type enum
 */
export const DATABASE_TYPES = ['mysql', 'postgresql', 'mongodb', 'mssql'] as const;

/**
 * User role enum
 */
export const USER_ROLES = ['admin', 'user'] as const;

/**
 * Connection status enum
 */
export const CONNECTION_STATUS = ['connected', 'disconnected', 'error'] as const;

/**
 * Sync status enum
 */
export const SYNC_STATUS = ['synced', 'yet_to_sync', 'syncing', 'error'] as const;

/**
 * Access type enum
 */
export const ACCESS_TYPES = ['team', 'individual'] as const;

// ==================== User Schemas ====================

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * User creation schema
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: 'Role must be either admin or user' }),
  }),
});

/**
 * User update schema
 */
export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(USER_ROLES).optional(),
});

// ==================== Connection Schemas ====================

/**
 * Connection creation schema
 */
export const createConnectionSchema = z.object({
  name: z.string().min(1, 'Connection name is required'),
  connectionType: z.enum(DATABASE_TYPES, {
    errorMap: () => ({ message: 'Invalid database type' }),
  }),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().positive('Port must be a positive integer'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Connection update schema
 */
export const updateConnectionSchema = z.object({
  name: z.string().min(1, 'Connection name is required').optional(),
  connectionType: z.enum(DATABASE_TYPES).optional(),
  host: z.string().min(1, 'Host is required').optional(),
  port: z.number().int().positive('Port must be a positive integer').optional(),
  username: z.string().min(1, 'Username is required').optional(),
  password: z.string().min(1, 'Password is required').optional(),
});

/**
 * Test connection schema
 */
export const testConnectionSchema = z.object({
  connectionType: z.enum(DATABASE_TYPES),
  host: z.string().min(1),
  port: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  databaseName: z.string().optional(), // For testing specific database
});

// ==================== Database Schemas ====================

/**
 * Database creation schema
 */
export const createDatabaseSchema = z.object({
  connectionId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid connection ID'),
  databaseName: z.string().min(1, 'Database name is required'),
  displayName: z.string().optional(),
});

/**
 * Database update schema
 */
export const updateDatabaseSchema = z.object({
  databaseName: z.string().min(1, 'Database name is required').optional(),
  displayName: z.string().optional(),
  connectionStatus: z.enum(CONNECTION_STATUS).optional(),
  syncStatus: z.enum(SYNC_STATUS).optional(),
  syncErrorMessage: z.string().optional(),
});

/**
 * Database sync schema
 */
export const syncDatabaseSchema = z.object({
  databaseId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid database ID'),
});

// ==================== Team Schemas ====================

/**
 * Team creation schema
 */
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
  members: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID')).optional(),
});

/**
 * Team update schema
 */
export const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').optional(),
  description: z.string().optional(),
  members: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID')).optional(),
});

/**
 * Team member management schema
 */
export const manageMembersSchema = z.object({
  userIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID')),
  action: z.enum(['add', 'remove']),
});

// ==================== Access Schemas ====================

/**
 * Access grant schema
 */
export const grantAccessSchema = z.object({
  databaseId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid database ID'),
  accessType: z.enum(ACCESS_TYPES),
  teamId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid team ID').optional(),
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID').optional(),
}).refine(
  (data) => {
    // If accessType is 'team', teamId must be provided
    if (data.accessType === 'team') {
      return !!data.teamId;
    }
    // If accessType is 'individual', userId must be provided
    if (data.accessType === 'individual') {
      return !!data.userId;
    }
    return false;
  },
  {
    message: 'teamId required for team access, userId required for individual access',
  }
);

/**
 * Check access schema
 */
export const checkAccessSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID'),
  databaseId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid database ID'),
});

// ==================== Chat Schemas ====================

/**
 * Chat message schema
 */
export const chatMessageSchema = z.object({
  databaseId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid database ID'),
  message: z.string().min(1, 'Message is required'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

// ==================== Pagination Schema ====================

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

// ==================== MongoDB ObjectId Schema ====================

/**
 * Validate MongoDB ObjectId format
 */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId format');

// ==================== Type Exports ====================

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export type UpdateDatabaseInput = z.infer<typeof updateDatabaseSchema>;
export type SyncDatabaseInput = z.infer<typeof syncDatabaseSchema>;

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type ManageMembersInput = z.infer<typeof manageMembersSchema>;

export type GrantAccessInput = z.infer<typeof grantAccessSchema>;
export type CheckAccessInput = z.infer<typeof checkAccessSchema>;

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
