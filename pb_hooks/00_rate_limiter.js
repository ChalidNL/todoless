// pb_hooks/00_rate_limiter.js
// Shared in-memory rate limiter for all custom API endpoints.
// Uses sliding window algorithm: tracks request timestamps per key (user_id or IP).
// Loaded first (00_ prefix) so functions are globally available to route files.

// ─── Configuration ──────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;       // 1 minute window
const RATE_LIMIT_AUTH = 120;                  // 120 req/min for authenticated users
const RATE_LIMIT_UNAUTH = 30;                 // 30 req/min for unauthenticated
const RATE_LIMIT_STRICT = 20;                 // 20 req/min for expensive endpoints (AI)

// ─── In-memory store: Map<key, [timestamp, ...]> ────────────────────────────
const _rateLimitBuckets = {};

// ─── Core function ──────────────────────────────────────────────────────────
// Returns { allowed: bool, limit: int, remaining: int, reset: int (ms) }
function checkRateLimit(c, limit, windowMs) {
    if (!limit) limit = RATE_LIMIT_AUTH;
    if (!windowMs) windowMs = RATE_LIMIT_WINDOW_MS;

    const authRecord = c.get('authRecord');
    const key = authRecord
        ? 'user:' + authRecord.id
        : 'ip:' + (c.request().RemoteAddr || 'unknown');

    const now = Date.now();
    const windowStart = now - windowMs;

    // Initialize bucket if needed
    if (!_rateLimitBuckets[key]) {
        _rateLimitBuckets[key] = [];
    }

    // Prune old timestamps outside the window
    const timestamps = _rateLimitBuckets[key];
    let validCount = 0;
    for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] > windowStart) {
            timestamps[validCount++] = timestamps[i];
        }
    }
    timestamps.length = validCount;

    if (validCount >= limit) {
        // Rate limited
        const oldestInWindow = timestamps[0] || now;
        const resetAt = oldestInWindow + windowMs;
        return {
            allowed: false,
            limit: limit,
            remaining: 0,
            reset: resetAt,
            key: key,
        };
    }

    // Record this request
    timestamps.push(now);

    return {
        allowed: true,
        limit: limit,
        remaining: limit - timestamps.length,
        reset: now + windowMs,
        key: key,
    };
}

// ─── Middleware helper ──────────────────────────────────────────────────────
// Returns 429 response if rate limited, null if OK.
// Usage: const rl = rateLimitMiddleware(c, LIMIT); if (rl) return rl;
function rateLimitMiddleware(c, limit, windowMs) {
    const result = checkRateLimit(c, limit, windowMs);
    if (!result.allowed) {
        return c.json(429, {
            'error': 'Too many requests',
            'limit': result.limit,
            'remaining': result.remaining,
            'retry_after': Math.ceil((result.reset - Date.now()) / 1000),
        });
    }
    return null;
}

// ─── Convenience wrappers ───────────────────────────────────────────────────
function rateLimitNormal(c) {
    return rateLimitMiddleware(c, RATE_LIMIT_AUTH);
}

function rateLimitStrict(c) {
    return rateLimitMiddleware(c, RATE_LIMIT_STRICT);
}

// ─── Cleanup old entries (called periodically by cron or on each request) ───
function cleanupRateLimitBuckets() {
    const now = Date.now();
    const maxAge = RATE_LIMIT_WINDOW_MS * 2;
    const keys = Object.keys(_rateLimitBuckets);
    for (let i = 0; i < keys.length; i++) {
        const timestamps = _rateLimitBuckets[keys[i]];
        if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > maxAge) {
            delete _rateLimitBuckets[keys[i]];
        }
    }
}

// ─── Health / debug endpoint ────────────────────────────────────────────────
routerAdd(
    'GET',
    '/api/todoless/rate-limit/status',
    (c) => {
        const authRecord = c.get('authRecord');
        if (!authRecord) {
            return c.json(401, { 'error': 'Unauthorized' });
        }
        // Only admins can see rate limit status
        const isAdmin = authRecord.get('role') === 'admin';
        if (!isAdmin) {
            return c.json(403, { 'error': 'Forbidden' });
        }
        const bucketCount = Object.keys(_rateLimitBuckets).length;
        let totalRequests = 0;
        const keys = Object.keys(_rateLimitBuckets);
        for (let i = 0; i < keys.length; i++) {
            totalRequests += _rateLimitBuckets[keys[i]].length;
        }
        return c.json(200, {
            'active_buckets': bucketCount,
            'total_tracked_requests': totalRequests,
            'window_ms': RATE_LIMIT_WINDOW_MS,
            'limit_auth': RATE_LIMIT_AUTH,
            'limit_unauth': RATE_LIMIT_UNAUTH,
            'limit_strict': RATE_LIMIT_STRICT,
        });
    },
    $apis.requireRecordAuth()
);

// Cleanup on every 10th request (simple amortized cleanup)
let _rlCleanupCounter = 0;
function maybeCleanup() {
    _rlCleanupCounter++;
    if (_rlCleanupCounter >= 10) {
        _rlCleanupCounter = 0;
        cleanupRateLimitBuckets();
    }
}
