import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Access interface for TypeScript
 */
export interface IAccess extends Document {
  _id: string;
  databaseId: mongoose.Types.ObjectId;
  accessType: 'team' | 'individual';
  teamId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

/**
 * Access Mongoose Schema
 */
const AccessSchema = new Schema<IAccess>(
  {
    databaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Database',
      required: [true, 'Database is required'],
    },
    accessType: {
      type: String,
      enum: ['team', 'individual'],
      required: [true, 'Access type is required'],
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: function (this: IAccess) {
        return this.accessType === 'team';
      },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function (this: IAccess) {
        return this.accessType === 'individual';
      },
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
 * Indexes for faster lookups
 */
AccessSchema.index({ databaseId: 1 });
AccessSchema.index({ teamId: 1 });
AccessSchema.index({ userId: 1 });
AccessSchema.index({ databaseId: 1, teamId: 1 }, { unique: true, sparse: true });
AccessSchema.index({ databaseId: 1, userId: 1 }, { unique: true, sparse: true });

/**
 * Access Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
const Access: Model<IAccess> =
  mongoose.models.Access || mongoose.model<IAccess>('Access', AccessSchema);

export default Access;
