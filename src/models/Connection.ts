import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Connection interface for TypeScript
 */
export interface IConnection extends Document {
  _id: string;
  name: string;
  connectionType: 'mysql' | 'postgresql' | 'mongodb' | 'mssql';
  host: string;
  port: number;
  username: string;
  password: string; // Encrypted
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connection Mongoose Schema
 */
const ConnectionSchema = new Schema<IConnection>(
  {
    name: {
      type: String,
      required: [true, 'Connection name is required'],
      trim: true,
    },
    connectionType: {
      type: String,
      enum: ['mysql', 'postgresql', 'mongodb', 'mssql'],
      required: [true, 'Connection type is required'],
    },
    host: {
      type: String,
      required: [true, 'Host is required'],
      trim: true,
    },
    port: {
      type: Number,
      required: [true, 'Port is required'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      // Password will be encrypted before saving
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
ConnectionSchema.index({ createdBy: 1 });
ConnectionSchema.index({ connectionType: 1 });

/**
 * Connection Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
const Connection: Model<IConnection> =
  mongoose.models.Connection ||
  mongoose.model<IConnection>('Connection', ConnectionSchema);

export default Connection;
