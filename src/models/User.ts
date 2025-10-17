import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User interface for TypeScript
 */
export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User Mongoose Schema
 */
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default in queries
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Index for faster email lookups
 */
UserSchema.index({ email: 1 });

/**
 * Pre-save hook to hash password before saving
 * Only hashes if password is modified
 */
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

/**
 * Instance method to compare password for login
 * @param candidatePassword - Password to compare
 * @returns Promise<boolean> - True if password matches
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

/**
 * Static method to find user by email with password field
 * @param email - User email
 * @returns Promise<IUser | null>
 */
UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email }).select('+password');
};

/**
 * Transform output to remove sensitive fields
 */
UserSchema.set('toJSON', {
  transform: function (_doc, ret) {
    delete (ret as any).password;
    return ret;
  },
});

/**
 * User Model
 * Use singleton pattern to prevent Next.js hot reload issues
 */
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
