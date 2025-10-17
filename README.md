# Flash Ops - Database Chat Application

A premium Next.js application for managing database connections and enabling natural language chat with databases through AI.

## Features

- Role-based access control (Admin/User)
- Team management with granular permissions
- Database-level access control
- Natural language database querying (via FastAPI)
- Premium UI with smooth animations
- Dark mode support

## Tech Stack

- **Frontend/Backend:** Next.js 14 (App Router)
- **Database:** MongoDB (Docker)
- **Authentication:** NextAuth.js
- **UI:** Tailwind CSS + shadcn/ui + Framer Motion
- **AI Backend:** FastAPI (separate repository)

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Generate secrets:
   ```bash
   # NEXTAUTH_SECRET
   openssl rand -base64 32

   # ENCRYPTION_KEY
   openssl rand -hex 32
   ```

   Add these to `.env.local`

5. Start MongoDB:
   ```bash
   docker-compose up -d
   ```

6. Seed the database with an admin user:
   ```bash
   npm run seed
   ```

7. Run the development server:
   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000)

### Default Admin Credentials

After running the seed script:
- Email: `admin@flashops.com`
- Password: `admin123`

**Important:** Change this password immediately in production!

## Project Structure

```
src/
├── app/                 # Next.js App Router pages and API routes
├── components/          # React components
├── lib/                 # Utilities and configurations
├── models/              # Mongoose models
├── types/               # TypeScript type definitions
├── hooks/               # Custom React hooks
└── constants/           # Application constants
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Architecture and development guide
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Detailed project plan with features

## License

Private - All rights reserved
