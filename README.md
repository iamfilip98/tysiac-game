# Tysiąc (1000) - Polish Card Game

A modern, real-time multiplayer implementation of the classic Polish card game Tysiąc (Thousand).

## Features

- **Real-time multiplayer** - Play with friends using room codes
- **AI opponents** - Add AI players to fill empty seats
- **Custom Polish rules** - Accurate implementation of traditional game rules
- **Beautiful UI** - Modern design with smooth animations

## Custom Rules

| Rule | Setting |
|------|---------|
| Barrel threshold | 800 (must reach 1000 or stay) |
| Bidding | Left of dealer auto-100, next starts 110, max = 120 + marriages |
| Hidden talon | If winning at 100, don't reveal picked-up cards |
| Following suit | 1st must follow & beat; 2nd free play; 3rd free unless 2nd couldn't follow |
| Marriages | Declare with Q when leading (♣40/♦60/♥80/♠100) |
| Trump | Activates only when marriage declared |
| Scoring | Bidder must hit exact bid; defenders round to 10 |
| Win condition | First to 1000 wins instantly |

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Node.js, Fastify, Socket.io, XState v5, Drizzle ORM
- **Database**: PostgreSQL

## Project Structure

```
tysiac-game/
├── apps/
│   ├── web/          # Next.js frontend
│   └── server/       # Node.js backend
└── packages/
    └── shared/       # Shared types & utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Build shared package
pnpm build --filter=@tysiac/shared

# Set up environment variables
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# Edit .env files with your configuration
```

### Development

```bash
# Run everything
pnpm dev

# Or run individually
pnpm dev:server  # Backend on :3001
pnpm dev:web     # Frontend on :3000
```

### Database Setup

```bash
# Push schema to database
pnpm db:push

# Or generate and run migrations
pnpm db:generate
pnpm db:migrate
```

## Deployment

### Backend (Railway)

1. Create a new Railway project
2. Add PostgreSQL database
3. Deploy from GitHub
4. Set environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `PORT` - 3001
   - `CORS_ORIGIN` - Frontend URL

### Frontend (Vercel)

1. Import from GitHub
2. Set environment variable:
   - `NEXT_PUBLIC_SOCKET_URL` - Backend URL

## How to Play

1. **Create or join a room** - Share the 6-character code with friends
2. **Add AI players** - Fill empty seats with AI opponents
3. **Ready up** - All players must be ready to start
4. **Bidding** - Bid for the right to pick up the talon cards
5. **Distribution** - Winner gives 2 cards to opponents
6. **Playing tricks** - Play cards, declare marriages for bonus points
7. **Scoring** - Bidder must make their bid exactly
8. **Win** - First to 1000 points wins!

## License

MIT
