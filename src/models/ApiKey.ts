import mongoose, { Document, Model, Schema } from 'mongoose';
import { encrypt, decrypt as decryptKey, secureCompare } from '@/lib/encryption';

/**
 * API Key interface for TypeScript
 */
export interface IApiKey extends Document {
  _id: string;
  key: string; // Hashed
  keyPrefix: string; // First 8 chars for display
  name: string;
  teamId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  permissions: string[];
  metadata?: {
    lastUsedBy?: string;
    lastUserName?: string;
    lastQuery?: string;
    ipAddress?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  compareKey(candidateKey: string): Promise<boolean>;
}

/**
 * API Key Mongoose Schema
 */
const ApiKeySchema = new Schema<IApiKey>(
  {
    key: {
      type: String,
      required: true,
      select: false, // Don't return by default
    },
    keyPrefix: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: ['query:read'],
    },
    metadata: {
      lastUsedBy: String,
      lastUserName: String,
      lastQuery: String,
      ipAddress: String,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for performance
 */
ApiKeySchema.index({ teamId: 1, isActive: 1 });
ApiKeySchema.index({ expiresAt: 1, isActive: 1 });
ApiKeySchema.index({ keyPrefix: 1 });

/**
 * Pre-save hook to encrypt API key
 */
ApiKeySchema.pre('save', async function (next) {
  if (!this.isModified('key')) {
    return next();
  }

  try {
    this.key = encrypt(this.key);
    next();
  } catch (error: any) {
    next(error);
  }
});

/**
 * Method to compare API key
 */
ApiKeySchema.methods.compareKey = async function (
  candidateKey: string
): Promise<boolean> {
  try {
    const decrypted = decryptKey(this.key);
    return secureCompare(candidateKey, decrypted);
  } catch (error) {
    return false;
  }
};

/**
 * Static method to find by key prefix
 */
ApiKeySchema.statics.findByPrefix = function (prefix: string) {
  return this.findOne({ keyPrefix: prefix, isActive: true });
};

/**
 * Transform output to hide sensitive fields
 */
ApiKeySchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete (ret as any).key;
    return ret;
  },
});

/**
 * API Key Model
 */
const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

export default ApiKey;
