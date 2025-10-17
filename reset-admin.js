const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/flash-ops';

async function resetAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get User model
    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      password: String,
      name: String,
      role: String,
      isActive: Boolean,
    }));

    // Find admin by the exact ID from the database
    const ObjectId = mongoose.Types.ObjectId;
    const admin = await User.findById(new ObjectId('68f20dbbf570c9a560f88596'));

    if (!admin) {
      console.log('❌ Admin user not found with that ID');
      process.exit(1);
    }

    console.log('✅ Found admin user:');
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.name);
    console.log('   Role:', admin.role);
    console.log('');
    console.log('Resetting password to: admin123');

    // Hash new password with same salt rounds as model (12)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Update password directly in database - bypass ALL hooks
    const result = await User.collection.updateOne(
      { _id: new ObjectId('68f20dbbf570c9a560f88596') },
      { $set: { password: hashedPassword, isActive: true } }
    );

    console.log('✅ Password reset result:', result.modifiedCount, 'document(s) updated');
    console.log('');
    console.log('===========================================');
    console.log('🎉 Login credentials:');
    console.log('Email: admin@flashops.com');
    console.log('Password: admin123');
    console.log('===========================================');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();
