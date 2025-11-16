#!/bin/bash

# Flash Ops - Admin User Seed Script
# This script creates the first admin user for the application

echo "======================================"
echo "Flash Ops - Admin User Setup"
echo "======================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create a .env file with your MongoDB connection string"
    echo "Example: MONGODB_URI=mongodb://localhost:27017/flash-ops"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the seed script
echo "🌱 Creating admin user..."
npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-admin.ts

echo ""
echo "✅ Setup complete!"
echo ""
