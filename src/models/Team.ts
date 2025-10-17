import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Team interface for TypeScript
 */
export interface ITeam extends Document {
  _id: string;
  name: string;
  description: string;
  members: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team Mongoose Schema
 */
const TeamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
TeamSchema.index({ name: 1 });
TeamSchema.index({ createdBy: 1 });

/**
 * Team Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
const Team: Model<ITeam> =
  mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);

export default Team;
