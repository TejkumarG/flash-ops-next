import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Message interface for TypeScript
 * Represents a conversation pair (user question + assistant response)
 */
export interface IMessage extends Document {
  _id: string;
  chatId: mongoose.Types.ObjectId;
  userMessage: string;
  assistantMessage: string;
  sqlQuery?: string;
  queryResults?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message Mongoose Schema
 */
const MessageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'Chat ID is required'],
    },
    userMessage: {
      type: String,
      required: [true, 'User message is required'],
    },
    assistantMessage: {
      type: String,
      default: '',
    },
    sqlQuery: {
      type: String,
    },
    queryResults: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for faster queries
 */
MessageSchema.index({ chatId: 1, createdAt: 1 });

/**
 * Message Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
// Delete the model if it exists to force reload with new schema
if (mongoose.models.Message) {
  delete mongoose.models.Message;
}

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
