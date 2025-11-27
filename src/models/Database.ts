import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Database interface for TypeScript
 */
export interface IDatabase extends Document {
  _id: string;
  connectionId: mongoose.Types.ObjectId;
  databaseName: string;
  displayName?: string;
  enabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastConnectionTest?: Date;
  syncStatus: 'synced' | 'yet_to_sync' | 'syncing' | 'error';
  syncLastAt?: Date;
  syncErrorMessage?: string;
  metadata?: Record<string, any>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database Mongoose Schema
 */
const DatabaseSchema = new Schema<IDatabase>(
  {
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Connection',
      required: [true, 'Connection ID is required'],
    },
    databaseName: {
      type: String,
      required: [true, 'Database name is required'],
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error'],
      default: 'disconnected',
    },
    lastConnectionTest: {
      type: Date,
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'yet_to_sync', 'syncing', 'error'],
      default: 'yet_to_sync',
    },
    syncLastAt: {
      type: Date,
    },
    syncErrorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for faster queries
 */
DatabaseSchema.index({ connectionId: 1 });
DatabaseSchema.index({ createdBy: 1 });
DatabaseSchema.index({ connectionStatus: 1 });
DatabaseSchema.index({ syncStatus: 1 });
DatabaseSchema.index({ enabled: 1 });

/**
 * Database Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
const Database: Model<IDatabase> =
  mongoose.models.Database ||
  mongoose.model<IDatabase>('Database', DatabaseSchema);

export default Database;
