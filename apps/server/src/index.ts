import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';
import { setupSocketHandlers } from './socket/handlers.js';
import * as debugService from './services/debugService.js';
import { initializeSessions, startSessionCleanup, stopSessionCleanup } from './security/session.js';

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
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Set up socket handlers
  setupSocketHandlers(io);

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    stopSessionCleanup();
    debugService.stopPeriodicCleanup();
    await debugService.forceFlush();
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

  // Start periodic cleanup for debug logs (every hour)
  debugService.startPeriodicCleanup(3600000);
}

main();
