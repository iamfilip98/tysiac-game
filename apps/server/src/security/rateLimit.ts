interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Rate limit storage: socketId -> eventType -> entry
const rateLimits = new Map<string, Map<string, RateLimitEntry>>();

// Default limits per event type
const eventLimits: Record<string, RateLimitConfig> = {
  'room:create': { maxRequests: 5, windowMs: 60000 },
  'room:join': { maxRequests: 10, windowMs: 60000 },
  'room:leave': { maxRequests: 10, windowMs: 60000 },
  'room:ready': { maxRequests: 20, windowMs: 60000 },
  'room:addAI': { maxRequests: 10, windowMs: 60000 },
  'room:removeAI': { maxRequests: 10, windowMs: 60000 },
  'room:startGame': { maxRequests: 5, windowMs: 60000 },
  'game:bid': { maxRequests: 30, windowMs: 60000 },
  'game:pass': { maxRequests: 30, windowMs: 60000 },
  'game:distributeTalon': { maxRequests: 10, windowMs: 60000 },
  'game:playCard': { maxRequests: 60, windowMs: 60000 },
  'game:declareMarriage': { maxRequests: 20, windowMs: 60000 },
  'player:reconnect': { maxRequests: 10, windowMs: 60000 },
};

const defaultLimit: RateLimitConfig = { maxRequests: 30, windowMs: 60000 };

export function checkRateLimit(socketId: string, eventType: string): { allowed: boolean; retryAfter?: number } {
  const config = eventLimits[eventType] || defaultLimit;
  const now = Date.now();

  // Get or create socket's rate limit map
  let socketLimits = rateLimits.get(socketId);
  if (!socketLimits) {
    socketLimits = new Map();
    rateLimits.set(socketId, socketLimits);
  }

  // Get or create entry for this event type
  let entry = socketLimits.get(eventType);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + config.windowMs };
    socketLimits.set(eventType, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfter: entry.resetTime - now };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

export function clearRateLimits(socketId: string): void {
  rateLimits.delete(socketId);
}

// Cleanup old entries periodically
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [socketId, socketLimits] of rateLimits) {
    for (const [eventType, entry] of socketLimits) {
      if (now > entry.resetTime) {
        socketLimits.delete(eventType);
      }
    }
    if (socketLimits.size === 0) {
      rateLimits.delete(socketId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupRateLimits, 60000);

// --- IP connection limiting ---
const ipConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 5;

export function trackIPConnection(ip: string): boolean {
  const current = ipConnectionCount.get(ip) || 0;
  if (current >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }
  ipConnectionCount.set(ip, current + 1);
  return true;
}

export function releaseIPConnection(ip: string): void {
  const current = ipConnectionCount.get(ip) || 0;
  if (current <= 1) {
    ipConnectionCount.delete(ip);
  } else {
    ipConnectionCount.set(ip, current - 1);
  }
}
