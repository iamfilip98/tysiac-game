import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';
import { setupSocketHandlers, syncAllEnginesForShutdown } from './socket/handlers.js';
import * as debugService from './services/debugService.js';
import * as gameService from './services/gameService.js';
import * as roomService from './services/roomService.js';
import { initializeSessions, startSessionCleanup, stopSessionCleanup } from './security/session.js';
import { initializeAuth, startAuthCleanup, stopAuthCleanup, registerPlayer, loginPlayer, invalidateAuthToken, validateAuthToken, getPlayerProfile, RegisterSchema, LoginSchema } from './security/auth.js';
import { checkAuthRateLimit } from './security/rateLimit.js';
import { initializeStats } from './services/statsService.js';
import { initPersistence, loadActiveGames, flushAllGames } from './services/persistenceService.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const DEBUG_API_KEY = process.env.DEBUG_API_KEY || '';
const DEBUG_ENABLED = DEBUG_API_KEY.length > 0;

// Parse comma-separated CORS origins into array (or single string)
function parseCorsOrigin(origin: string): string | string[] {
  const origins = origin.split(',').map(o => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

// Redact sensitive data from log arrays before returning via debug API
function redactLogs<T>(logs: T[]): T[] {
  return logs.map(log => debugService.redactLogEntry(log as never) as T);
}

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // CSP handled by Next.js frontend
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: parseCorsOrigin(CORS_ORIGIN),
    credentials: true,
  });

  // Health check endpoint with memory stats
  fastify.get('/health', async () => {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: Date.now(),
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
      },
    };
  });

  // Debug API authentication middleware
  const verifyDebugAuth = (request: { headers: Record<string, string | string[] | undefined> }) => {
    if (!DEBUG_ENABLED) {
      throw new Error('Unauthorized');
    }
    const apiKey = request.headers['x-debug-key'];
    if (apiKey !== DEBUG_API_KEY) {
      throw new Error('Unauthorized');
    }
  };

  // Debug API endpoints (for internal use only - not visible to players)
  fastify.get('/debug/games', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const games = await debugService.getRecentGamesSummary();
      return { games };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch games' };
    }
  });

  fastify.get('/debug/logs/game/:gameId', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const { gameId } = request.params as { gameId: string };
      const logs = await debugService.getLogsByGameId(gameId);
      return { logs: redactLogs(logs) };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch logs' };
    }
  });

  fastify.get('/debug/logs/room/:roomId', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const { roomId } = request.params as { roomId: string };
      const logs = await debugService.getLogsByRoomId(roomId);
      return { logs: redactLogs(logs) };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch logs' };
    }
  });

  fastify.get('/debug/logs/recent', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const { limit } = request.query as { limit?: string };
      const logs = await debugService.getRecentLogs(limit ? parseInt(limit, 10) : 100);
      return { logs: redactLogs(logs) };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch logs' };
    }
  });

  fastify.get('/debug/logs/errors', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const { limit } = request.query as { limit?: string };
      const logs = await debugService.getErrorLogs(limit ? parseInt(limit, 10) : 100);
      return { logs: redactLogs(logs) };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch logs' };
    }
  });

  fastify.get('/debug/logs/event/:eventType', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const { eventType } = request.params as { eventType: string };
      const { limit } = request.query as { limit?: string };
      const logs = await debugService.getLogsByEventType(eventType, limit ? parseInt(limit, 10) : 100);
      return { logs: redactLogs(logs) };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to fetch logs' };
    }
  });

  fastify.post('/debug/cleanup', async (request, reply) => {
    try {
      verifyDebugAuth(request);
      const deleted = await debugService.cleanupOldLogs();
      return { deleted, message: `Cleaned up ${deleted} old log entries` };
    } catch (error) {
      if ((error as Error).message === 'Unauthorized') {
        reply.code(401);
        return { error: 'Unauthorized' };
      }
      reply.code(500);
      return { error: 'Failed to cleanup logs' };
    }
  });

  // --- Auth API endpoints ---

  // Helper to extract client IP from request
  const getClientIP = (request: { headers: Record<string, string | string[] | undefined>; ip: string }) => {
    const forwarded = request.headers['x-forwarded-for'];
    return forwarded ? String(forwarded).split(',')[0].trim() : request.ip;
  };

  fastify.post('/auth/register', async (request, reply) => {
    const ip = getClientIP(request);
    const { allowed, retryAfter } = checkAuthRateLimit(ip);
    if (!allowed) {
      reply.code(429);
      return { error: `Too many requests. Try again in ${Math.ceil((retryAfter || 1000) / 1000)} seconds` };
    }

    try {
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.issues[0]?.message || 'Invalid input' };
      }

      const { email, password, displayName } = parsed.data;
      const result = await registerPlayer(email, password, displayName);
      return result;
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Email already registered') {
        reply.code(409);
        return { error: message };
      }
      reply.code(500);
      return { error: 'Registration failed' };
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const ip = getClientIP(request);
    const { allowed, retryAfter } = checkAuthRateLimit(ip);
    if (!allowed) {
      reply.code(429);
      return { error: `Too many requests. Try again in ${Math.ceil((retryAfter || 1000) / 1000)} seconds` };
    }

    try {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Invalid input' };
      }

      const { email, password } = parsed.data;
      const result = await loginPlayer(email, password);
      return result;
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Invalid email or password') {
        reply.code(401);
        return { error: message };
      }
      reply.code(500);
      return { error: 'Login failed' };
    }
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401);
      return { error: 'No token provided' };
    }

    const token = authHeader.slice(7);
    await invalidateAuthToken(token);
    return { success: true };
  });

  fastify.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401);
      return { error: 'No token provided' };
    }

    const token = authHeader.slice(7);
    const validated = validateAuthToken(token);
    if (!validated) {
      reply.code(401);
      return { error: 'Invalid or expired token' };
    }

    const profile = await getPlayerProfile(validated.playerId);
    if (!profile) {
      reply.code(404);
      return { error: 'Player not found' };
    }

    return profile;
  });

  // Create HTTP server
  await fastify.ready();
  const httpServer = fastify.server;

  // Create Socket.io server
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: parseCorsOrigin(CORS_ORIGIN),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
    transports: ['websocket', 'polling'],
  });

  // Set up socket handlers
  setupSocketHandlers(io);

  // Graceful shutdown handler — game state flush is highest priority
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return; // Prevent double-shutdown
    isShuttingDown = true;
    console.log('Shutting down gracefully...');

    // Hard deadline: force exit after 8s (Render gives ~10s before SIGKILL)
    const forceExit = setTimeout(() => {
      console.error('[Shutdown] Timeout — forcing exit');
      process.exit(1);
    }, 8000);
    forceExit.unref();

    stopSessionCleanup();
    stopAuthCleanup();
    debugService.stopPeriodicCleanup();

    // 1. HIGHEST PRIORITY: Sync engine state + flush games to DB
    try {
      syncAllEnginesForShutdown();
      await flushAllGames(
        () => gameService.getAllGames(),
        (roomId) => roomService.getRoom(roomId)
      );
    } catch (err) {
      console.error('[Shutdown] Game flush failed:', err);
    }

    // 2. Lower priority: flush debug logs (best-effort)
    try {
      await Promise.race([
        debugService.forceFlush(),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
    } catch { /* ignore debug flush errors */ }

    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Crash protection — log and exit cleanly so Render auto-restarts
  process.on('uncaughtException', async (error) => {
    console.error('[FATAL] Uncaught exception:', error);
    try {
      await debugService.forceFlush();
    } catch { /* ignore flush errors during crash */ }
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[WARNING] Unhandled promise rejection:', reason);
    // Don't crash — isolated promise failures shouldn't take down the server
  });

  // Memory monitoring (every 60s) — warn when approaching Render free tier limit (512MB)
  const MEMORY_LIMIT_MB = 512;
  const MEMORY_WARN_THRESHOLD = 0.8; // 80%
  setInterval(() => {
    const mem = process.memoryUsage();
    const rssMB = mem.rss / 1024 / 1024;
    if (rssMB > MEMORY_LIMIT_MB * MEMORY_WARN_THRESHOLD) {
      console.warn(`[Memory] RSS ${rssMB.toFixed(1)}MB exceeds ${MEMORY_WARN_THRESHOLD * 100}% of ${MEMORY_LIMIT_MB}MB limit`);
    }
  }, 60000);

  // Start server FIRST so health checks pass immediately
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Debug API available at /debug/* (requires x-debug-key header)`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Initialize sessions from database AFTER server is listening
  // This prevents health check failures if DB connection is slow
  initializeSessions().then(() => {
    console.log('Sessions initialized from database');
    startSessionCleanup();
  }).catch((err) => {
    console.error('Failed to initialize sessions (continuing with in-memory):', err);
    startSessionCleanup(); // Still start cleanup for in-memory sessions
  });

  // Initialize auth system (tokens, tables)
  initializeAuth().then(() => {
    console.log('Auth system initialized');
    startAuthCleanup();
    // Load stats after auth tables are ready
    return initializeStats();
  }).then(() => {
    console.log('Stats service initialized');
  }).catch((err) => {
    console.error('Failed to initialize auth/stats (continuing without):', err);
  });

  // Restore active games from database
  initPersistence().then(async () => {
    try {
      const activeGames = await loadActiveGames();
      for (const { gameState, roomState } of activeGames) {
        gameService.restoreGame(gameState);
        roomService.restoreRoom(roomState);
        console.log(`[Restore] Game ${gameState.id} restored (phase: ${gameState.phase})`);
      }
      if (activeGames.length > 0) {
        console.log(`[Restore] ${activeGames.length} active game(s) restored from database`);
      }
    } catch (err) {
      console.error('[Restore] Failed to restore games (continuing without):', err);
    }
  }).catch((err) => {
    console.error('[Persistence] Failed to initialize (continuing without):', err);
  });

  // Start periodic cleanup for debug logs (every hour)
  debugService.startPeriodicCleanup(3600000);
}

main();
