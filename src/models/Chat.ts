import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Chat interface for TypeScript
 * Represents a conversation session with multiple databases
 */
export interface IChat extends Document {
  _id: string;
  userId: mongoose.Types.ObjectId;
  databaseIds: mongoose.Types.ObjectId[]; // Multiple databases
  title: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat Mongoose Schema
 */
const ChatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    databaseIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Database',
      required: [true, 'At least one database is required'],
      validate: {
        validator: function(v: any[]) {
          return v && v.length > 0;
        },
        message: 'At least one database ID is required'
      }
    },
    title: {
      type: String,
      required: [true, 'Chat title is required'],
      default: 'New Chat',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for faster queries
 */
ChatSchema.index({ userId: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, lastMessageAt: -1 });
ChatSchema.index({ databaseIds: 1 });

/**
 * Chat Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
// Delete the model if it exists to force reload with new schema
if (mongoose.models.Chat) {
  delete mongoose.models.Chat;
}

const Chat: Model<IChat> = mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
