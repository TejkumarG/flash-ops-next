/**
 * Database Seeding Script
 * Creates initial admin user for the application
 *
 * Usage: npm run seed
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import models (must be after dotenv config)
import User from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flash-ops';

/**
 * Default admin user credentials
 * IMPORTANT: Change these in production!
 */
const DEFAULT_ADMIN = {
  email: 'admin@flashops.com',
  password: 'admin123',
  name: 'Admin User',
  role: 'admin' as const,
};

/**
 * Connect to MongoDB
 */
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Create admin user if it doesn't exist
 */
async function seedAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN.email });

    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      console.log('   Email:', DEFAULT_ADMIN.email);
      return;
    }

    // Create new admin user
    const adminUser = await User.create(DEFAULT_ADMIN);

    console.log('✅ Admin user created successfully!');
    console.log('   Email:', adminUser.email);
    console.log('   Password:', DEFAULT_ADMIN.password);
    console.log('   Role:', adminUser.role);
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

/**
 * Create a regular user for testing
 */
async function seedTestUser() {
  try {
    const testUser = {
      email: 'user@flashops.com',
      password: 'user123',
      name: 'Test User',
      role: 'user' as const,
    };

    const existingUser = await User.findOne({ email: testUser.email });

    if (existingUser) {
      console.log('ℹ️  Test user already exists');
      return;
    }

    const user = await User.create(testUser);

    console.log('✅ Test user created successfully!');
    console.log('   Email:', user.email);
    console.log('   Password:', testUser.password);
    console.log('   Role:', user.role);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

/**
 * Main seed function
 */
async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    await connectDatabase();
    await seedAdminUser();
    console.log(''); // Empty line
    await seedTestUser();

    console.log('\n✅ Database seeding completed!');
    console.log('\nYou can now login with:');
    console.log('  Admin: admin@flashops.com / admin123');
    console.log('  User:  user@flashops.com / user123');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run seed
seed();
