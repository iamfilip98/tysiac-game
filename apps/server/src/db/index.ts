import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

// Database is optional - the game uses in-memory storage by default
// PostgreSQL is only needed for persistence across restarts
let db: ReturnType<typeof drizzle> | null = null;

if (connectionString) {
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
  console.log('Database connected');
} else {
  console.log('Running without database (in-memory mode)');
}

export { db };
export * from './schema.js';
