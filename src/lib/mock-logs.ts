import type { LogLine } from "@/types/log";

/**
 * Static mock log fixture.
 *
 * Hand-curated to a story arc that exercises the prototype's demo paths:
 * a quiet baseline, a deploy, healthy traffic with request lifecycles,
 * gradual degradation, an error cluster, a rollback deploy, then a
 * stable tail. Identifiers, timestamps, and ordering are deterministic —
 * the file itself is the source of truth.
 *
 * Cross-instance interleaving is intentional: every minute of the arc
 * has lines from at least two of the three instances, so View Context
 * on a filtered view always pulls in cross-instance correlation.
 */

/** Anchor for "minute 0" of the story arc; all timestamps cascade from here. */
export const MOCK_START_MS = new Date("2026-04-27T13:00:00Z").getTime();

export const INSTANCES = ["7tbsm", "a3kx2", "m9p4r"] as const;
export type InstanceId = (typeof INSTANCES)[number];

/** All request IDs that appear in mockLogs, mapped to their owning instance. */
export const REQUEST_IDS = {
  req_a3f9c2: "7tbsm",
  req_b81k4m: "7tbsm",
  req_c4n7p9: "a3kx2",
  req_d2j5q8: "a3kx2",
  req_e6h1v3: "m9p4r",
} as const satisfies Record<string, InstanceId>;

export type RequestId = keyof typeof REQUEST_IDS;

/**
 * Build the fixture inside a closure so id generation and timestamp math
 * don't leak to module scope. Result is frozen via `as const`-style usage
 * at the export site below.
 */
function buildMockLogs(): readonly LogLine[] {
  let nextIdNum = 0;
  const id = (): string => `log_${String(++nextIdNum).padStart(4, "0")}`;
  const t = (min: number, sec: number): number =>
    MOCK_START_MS + min * 60_000 + sec * 1_000;

  type Builder = (
    min: number,
    sec: number,
    instance: InstanceId,
    message: string,
    requestId?: RequestId,
  ) => LogLine;

  const lvl = (level: LogLine["level"]): Builder =>
    (min, sec, instance, message, requestId) => ({
      id: id(),
      timestamp: t(min, sec),
      instance,
      level,
      message,
      ...(requestId ? { requestId } : {}),
    });

  const info = lvl("INFO");
  const warn = lvl("WARN");
  const err = lvl("ERROR");
  const dbg = lvl("DEBUG");
  const deploy = (
    min: number,
    sec: number,
    instance: InstanceId,
    message: string,
  ): LogLine => ({
    id: id(),
    timestamp: t(min, sec),
    instance,
    level: "INFO",
    message,
    isDeployBoundary: true,
  });

  return [
    // ── Phase 1 · Quiet baseline (minutes 0–8) ────────────────────────
    info(0, 2, "7tbsm", "Server listening on port 3000"),
    info(0, 3, "a3kx2", "Server listening on port 3000"),
    info(0, 5, "m9p4r", "Server listening on port 3000"),
    info(0, 14, "7tbsm", "Healthcheck OK"),
    info(0, 18, "a3kx2", "Heartbeat sent"),
    info(0, 22, "m9p4r", "Cache warmed (12 keys)"),
    dbg(0, 48, "7tbsm", "Connection pool: 3/20 active"),
    info(1, 2, "a3kx2", "Background job 'session-cleanup' completed in 47ms"),
    info(1, 14, "m9p4r", "Healthcheck OK"),
    info(1, 33, "7tbsm", "Metrics flushed (count=23)"),
    info(1, 48, "a3kx2", "Heartbeat sent"),
    info(2, 9, "m9p4r", "Healthcheck OK"),
    info(2, 18, "7tbsm", "Worker pool ready (size=8)"),
    info(2, 34, "a3kx2", "Cache hit ratio: 0.91"),
    info(2, 55, "m9p4r", "Heartbeat sent"),
    info(3, 12, "7tbsm", "Healthcheck OK"),
    info(3, 24, "a3kx2", "Background job 'token-refresh' completed in 89ms"),
    info(3, 46, "m9p4r", "Metrics flushed (count=18)"),
    info(4, 2, "7tbsm", "Heartbeat sent"),
    info(4, 18, "a3kx2", "Healthcheck OK"),
    dbg(4, 31, "m9p4r", "GC paused 14ms"),
    info(4, 48, "7tbsm", "Cache hit ratio: 0.88"),
    info(5, 11, "a3kx2", "Heartbeat sent"),
    info(5, 24, "m9p4r", "Background job 'session-cleanup' completed in 38ms"),
    info(5, 40, "7tbsm", "Healthcheck OK"),
    info(6, 2, "a3kx2", "Metrics flushed (count=22)"),
    info(6, 14, "m9p4r", "Heartbeat sent"),
    info(6, 28, "7tbsm", "Healthcheck OK"),
    info(6, 51, "a3kx2", "Cache hit ratio: 0.93"),
    info(7, 10, "m9p4r", "Heartbeat sent"),
    info(7, 33, "7tbsm", "Background job 'session-cleanup' completed in 41ms"),
    info(7, 54, "a3kx2", "Healthcheck OK"),

    // ── Phase 2 · Deploy boundary (minute 8) ──────────────────────────
    deploy(8, 0, "7tbsm", "🎉 Deploy live · srv-7tbsm@a3f2c1"),
    info(8, 4, "7tbsm", "Server listening on port 3000"),
    info(8, 5, "7tbsm", "Cache warmed (1284 keys)"),
    info(8, 9, "a3kx2", "Healthcheck OK"),
    info(8, 18, "7tbsm", "GET /api/health 200 in 3ms"),
    info(8, 24, "a3kx2", "POST /api/orders 201 in 87ms", "req_c4n7p9"),
    info(8, 31, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(8, 42, "7tbsm", "GET /api/products 200 in 28ms", "req_a3f9c2"),
    info(8, 53, "a3kx2", "Heartbeat sent"),

    // ── Phase 3 · Healthy traffic (minutes 9–25) ──────────────────────
    info(9, 8, "7tbsm", "GET /api/users 200 in 38ms", "req_a3f9c2"),
    info(9, 14, "m9p4r", "POST /api/sessions 201 in 64ms", "req_e6h1v3"),
    info(9, 22, "a3kx2", "GET /api/orders 200 in 51ms", "req_c4n7p9"),
    info(9, 33, "7tbsm", "GET /api/products 200 in 31ms", "req_b81k4m"),
    info(9, 41, "m9p4r", "Heartbeat sent"),
    info(9, 48, "a3kx2", "PATCH /api/orders/42 200 in 72ms", "req_c4n7p9"),
    info(9, 57, "7tbsm", "Background job 'session-cleanup' completed in 52ms"),

    info(10, 5, "7tbsm", "GET /api/users/me 200 in 19ms", "req_a3f9c2"),
    info(10, 13, "a3kx2", "DELETE /api/orders/41 204 in 33ms", "req_c4n7p9"),
    info(10, 21, "m9p4r", "GET /api/notifications 200 in 47ms", "req_e6h1v3"),
    info(10, 34, "7tbsm", "POST /api/events 202 in 14ms", "req_b81k4m"),
    info(10, 42, "a3kx2", "GET /api/orders 200 in 58ms", "req_d2j5q8"),
    info(10, 51, "m9p4r", "Healthcheck OK"),
    warn(10, 57, "7tbsm", "Slow upstream: api.stripe.com responded in 678ms"),

    info(11, 4, "7tbsm", "GET /api/products/42 200 in 22ms", "req_a3f9c2"),
    info(11, 12, "a3kx2", "POST /api/orders 201 in 91ms", "req_d2j5q8"),
    warn(11, 19, "m9p4r", "Rate limit approaching for tenant 'acme' (84/100)"),
    info(11, 28, "7tbsm", "GET /api/health 200 in 4ms"),
    info(11, 36, "a3kx2", "GET /api/orders/42 200 in 41ms", "req_d2j5q8"),
    info(11, 47, "m9p4r", "POST /api/uploads 201 in 134ms", "req_e6h1v3"),
    info(11, 58, "7tbsm", "Heartbeat sent"),

    info(12, 8, "a3kx2", "Healthcheck OK"),
    info(12, 17, "7tbsm", "GET /api/users 200 in 36ms", "req_b81k4m"),
    info(12, 26, "m9p4r", "GET /api/notifications 200 in 51ms", "req_e6h1v3"),
    info(12, 35, "a3kx2", "PATCH /api/orders/43 200 in 68ms", "req_d2j5q8"),
    info(12, 44, "7tbsm", "POST /api/events 202 in 12ms", "req_a3f9c2"),
    info(12, 53, "m9p4r", "Background job 'token-refresh' completed in 73ms"),
    warn(12, 58, "7tbsm", "Slow upstream: api.stripe.com responded in 924ms"),

    info(13, 6, "7tbsm", "GET /api/products 200 in 33ms", "req_a3f9c2"),
    info(13, 15, "a3kx2", "GET /api/orders 200 in 49ms", "req_c4n7p9"),
    info(13, 24, "m9p4r", "Heartbeat sent"),
    info(13, 32, "7tbsm", "GET /api/users/me 200 in 17ms", "req_b81k4m"),
    dbg(13, 41, "a3kx2", "Connection pool: 8/20 active"),
    info(13, 49, "m9p4r", "POST /api/sessions 201 in 58ms", "req_e6h1v3"),
    info(13, 58, "7tbsm", "Healthcheck OK"),

    info(14, 7, "a3kx2", "GET /api/orders/44 200 in 44ms", "req_c4n7p9"),
    info(14, 16, "m9p4r", "Healthcheck OK"),
    info(14, 24, "7tbsm", "GET /api/products 200 in 29ms", "req_a3f9c2"),
    info(14, 33, "a3kx2", "POST /api/orders 201 in 88ms", "req_d2j5q8"),
    warn(14, 42, "7tbsm", "Cache miss rate elevated: 0.42 (expected <0.30)"),
    info(14, 51, "m9p4r", "GET /api/users 200 in 39ms", "req_e6h1v3"),
    warn(14, 58, "a3kx2", "Healthcheck slow: returned in 312ms (typical <50ms)"),

    info(15, 3, "7tbsm", "Heartbeat sent"),
    info(15, 12, "a3kx2", "GET /api/orders 200 in 47ms", "req_c4n7p9"),
    info(15, 22, "m9p4r", "POST /api/uploads 201 in 156ms", "req_e6h1v3"),
    info(15, 31, "7tbsm", "GET /api/users 200 in 41ms", "req_b81k4m"),
    info(15, 40, "a3kx2", "Background job 'session-cleanup' completed in 39ms"),
    info(15, 49, "m9p4r", "Heartbeat sent"),
    info(15, 57, "7tbsm", "POST /api/events 202 in 13ms", "req_a3f9c2"),
    warn(16, 2, "a3kx2", "POST /api/orders 422 in 18ms — validation failed", "req_c4n7p9"),

    info(16, 8, "a3kx2", "Healthcheck OK"),
    info(16, 17, "7tbsm", "GET /api/products/43 200 in 24ms", "req_a3f9c2"),
    info(16, 26, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    info(16, 36, "a3kx2", "PATCH /api/orders/45 200 in 71ms", "req_d2j5q8"),
    info(16, 45, "7tbsm", "GET /api/users/me 200 in 18ms", "req_b81k4m"),
    info(16, 54, "m9p4r", "Metrics flushed (count=31)"),
    warn(16, 59, "7tbsm", "Cache miss rate elevated: 0.36 (expected <0.30)"),

    info(17, 5, "7tbsm", "GET /api/health 200 in 3ms"),
    info(17, 13, "a3kx2", "GET /api/orders 200 in 53ms", "req_c4n7p9"),
    info(17, 22, "m9p4r", "POST /api/sessions 201 in 62ms", "req_e6h1v3"),
    warn(17, 31, "a3kx2", "Slow query: SELECT events WHERE org_id = $1 took 412ms"),
    info(17, 40, "7tbsm", "GET /api/products 200 in 35ms", "req_a3f9c2"),
    info(17, 49, "m9p4r", "Heartbeat sent"),
    info(17, 58, "a3kx2", "GET /api/orders/46 200 in 46ms", "req_d2j5q8"),

    info(18, 9, "7tbsm", "GET /api/users 200 in 37ms", "req_b81k4m"),
    info(18, 18, "a3kx2", "POST /api/orders 201 in 84ms", "req_c4n7p9"),
    info(18, 27, "m9p4r", "GET /api/notifications 200 in 49ms", "req_e6h1v3"),
    info(18, 36, "7tbsm", "Background job 'token-refresh' completed in 81ms"),
    info(18, 45, "a3kx2", "Healthcheck OK"),
    info(18, 54, "m9p4r", "GET /api/users 200 in 43ms", "req_e6h1v3"),
    warn(18, 59, "a3kx2", "POST /api/orders 429 in 8ms — rate limit hit", "req_d2j5q8"),

    info(19, 5, "7tbsm", "GET /api/products 200 in 30ms", "req_a3f9c2"),
    info(19, 14, "a3kx2", "DELETE /api/orders/42 204 in 35ms", "req_d2j5q8"),
    info(19, 23, "m9p4r", "POST /api/uploads 201 in 142ms", "req_e6h1v3"),
    info(19, 32, "7tbsm", "GET /api/users/me 200 in 19ms", "req_b81k4m"),
    info(19, 41, "a3kx2", "GET /api/orders 200 in 50ms", "req_c4n7p9"),
    warn(19, 50, "m9p4r", "Upload payload over soft limit: 4.2MB (limit 4.0MB)"),
    info(19, 59, "7tbsm", "Heartbeat sent"),

    info(20, 8, "a3kx2", "GET /api/orders/47 200 in 42ms", "req_d2j5q8"),
    info(20, 17, "m9p4r", "Healthcheck OK"),
    info(20, 26, "7tbsm", "POST /api/events 202 in 11ms", "req_a3f9c2"),
    info(20, 35, "a3kx2", "PATCH /api/orders/47 200 in 67ms", "req_c4n7p9"),
    info(20, 44, "m9p4r", "GET /api/notifications 200 in 46ms", "req_e6h1v3"),
    info(20, 53, "7tbsm", "GET /api/products/44 200 in 26ms", "req_b81k4m"),
    warn(20, 58, "m9p4r", "Background job 'cleanup' took 2.3s (typical <500ms)"),

    info(21, 4, "a3kx2", "Healthcheck OK"),
    info(21, 13, "m9p4r", "POST /api/sessions 201 in 60ms", "req_e6h1v3"),
    info(21, 22, "7tbsm", "GET /api/users 200 in 39ms", "req_a3f9c2"),
    info(21, 31, "a3kx2", "GET /api/orders 200 in 52ms", "req_d2j5q8"),
    info(21, 40, "m9p4r", "Heartbeat sent"),
    info(21, 49, "7tbsm", "GET /api/health 200 in 4ms"),
    info(21, 58, "a3kx2", "POST /api/orders 201 in 89ms", "req_c4n7p9"),
    warn(22, 1, "m9p4r", "Cache miss rate elevated: 0.33 (expected <0.30)"),

    info(22, 9, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    info(22, 18, "7tbsm", "GET /api/products 200 in 32ms", "req_b81k4m"),
    info(22, 27, "a3kx2", "Background job 'session-cleanup' completed in 44ms"),
    info(22, 36, "m9p4r", "GET /api/notifications 200 in 47ms", "req_e6h1v3"),
    warn(22, 45, "7tbsm", "DB pool wait time: 18ms (typical <5ms)"),
    info(22, 54, "a3kx2", "GET /api/orders/48 200 in 48ms", "req_c4n7p9"),

    info(23, 5, "m9p4r", "Healthcheck OK"),
    info(23, 14, "7tbsm", "GET /api/users/me 200 in 21ms", "req_a3f9c2"),
    info(23, 23, "a3kx2", "PATCH /api/orders/48 200 in 69ms", "req_d2j5q8"),
    info(23, 32, "m9p4r", "POST /api/uploads 201 in 138ms", "req_e6h1v3"),
    info(23, 41, "7tbsm", "POST /api/events 202 in 12ms", "req_b81k4m"),
    dbg(23, 50, "a3kx2", "GC paused 17ms"),
    info(23, 58, "m9p4r", "Metrics flushed (count=29)"),
    warn(24, 1, "7tbsm", "Connection retry succeeded after 2 attempts"),

    info(24, 9, "7tbsm", "GET /api/products 200 in 34ms", "req_a3f9c2"),
    info(24, 18, "a3kx2", "GET /api/orders 200 in 51ms", "req_c4n7p9"),
    info(24, 27, "m9p4r", "POST /api/sessions 201 in 63ms", "req_e6h1v3"),
    info(24, 36, "7tbsm", "GET /api/users 200 in 40ms", "req_b81k4m"),
    info(24, 45, "a3kx2", "Healthcheck OK"),
    info(24, 54, "m9p4r", "Heartbeat sent"),

    // ── Phase 4 · Late-healthy / pre-degradation (minutes 25–29) ──────
    info(25, 6, "7tbsm", "GET /api/products/45 200 in 28ms", "req_a3f9c2"),
    info(25, 16, "a3kx2", "POST /api/orders 201 in 86ms", "req_d2j5q8"),
    info(25, 26, "m9p4r", "GET /api/notifications 200 in 50ms", "req_e6h1v3"),
    info(25, 36, "7tbsm", "GET /api/users/me 200 in 22ms", "req_b81k4m"),
    warn(25, 46, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 487ms"),
    info(25, 56, "a3kx2", "GET /api/orders/49 200 in 49ms", "req_c4n7p9"),

    info(26, 7, "m9p4r", "Healthcheck OK"),
    info(26, 17, "7tbsm", "POST /api/events 202 in 13ms", "req_a3f9c2"),
    info(26, 27, "a3kx2", "PATCH /api/orders/49 200 in 73ms", "req_d2j5q8"),
    info(26, 37, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(26, 47, "7tbsm", "Heartbeat sent"),
    info(26, 57, "a3kx2", "GET /api/orders 200 in 54ms", "req_c4n7p9"),
    warn(27, 2, "m9p4r", "Slow upstream: api.stripe.com responded in 1.1s"),

    info(27, 8, "m9p4r", "POST /api/uploads 201 in 144ms", "req_e6h1v3"),
    info(27, 18, "7tbsm", "GET /api/products 200 in 36ms", "req_b81k4m"),
    info(27, 28, "a3kx2", "Background job 'token-refresh' completed in 79ms"),
    warn(27, 38, "7tbsm", "DB pool wait time: 24ms (typical <5ms)"),
    info(27, 48, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    info(27, 58, "a3kx2", "Healthcheck OK"),

    info(28, 9, "7tbsm", "GET /api/users 200 in 44ms", "req_a3f9c2"),
    info(28, 19, "a3kx2", "GET /api/orders 200 in 53ms", "req_d2j5q8"),
    info(28, 29, "m9p4r", "Heartbeat sent"),
    warn(28, 39, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 612ms"),
    info(28, 49, "a3kx2", "POST /api/orders 201 in 91ms", "req_c4n7p9"),
    info(28, 59, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),

    info(29, 10, "7tbsm", "GET /api/products/46 200 in 38ms", "req_b81k4m"),
    info(29, 20, "a3kx2", "GET /api/orders/50 200 in 47ms", "req_c4n7p9"),
    info(29, 30, "m9p4r", "POST /api/sessions 201 in 61ms", "req_e6h1v3"),
    warn(29, 40, "7tbsm", "DB connection acquire took 142ms (typical <20ms)"),
    info(29, 50, "a3kx2", "Healthcheck OK"),

    // ── Phase 5 · Degradation begins (minutes 30–31) ──────────────────
    warn(30, 4, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 891ms"),
    info(30, 12, "a3kx2", "GET /api/orders 200 in 50ms", "req_d2j5q8"),
    warn(30, 19, "7tbsm", "DB pool wait time: 67ms (typical <5ms)"),
    info(30, 27, "m9p4r", "GET /api/users 200 in 43ms", "req_e6h1v3"),
    warn(30, 35, "7tbsm", "Retry attempt 1/3 for db query (op=fetch_user_events)"),
    info(30, 43, "a3kx2", "POST /api/orders 201 in 88ms", "req_c4n7p9"),
    warn(30, 51, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 1247ms"),
    info(30, 59, "m9p4r", "Heartbeat sent"),

    warn(31, 6, "7tbsm", "DB connection pool nearing capacity (18/20 active)"),
    info(31, 14, "a3kx2", "GET /api/orders/51 200 in 49ms", "req_d2j5q8"),
    warn(31, 22, "7tbsm", "Retry attempt 2/3 for db query (op=fetch_user_events)"),
    info(31, 30, "m9p4r", "GET /api/notifications 200 in 51ms", "req_e6h1v3"),
    warn(31, 38, "7tbsm", "DB pool wait time: 184ms (typical <5ms)"),
    info(31, 46, "a3kx2", "PATCH /api/orders/51 200 in 75ms", "req_c4n7p9"),
    warn(31, 54, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 1683ms"),

    // ── Phase 6 · Error cluster (minutes 32–36) — DEMO TARGET ─────────
    err(32, 2, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_b81k4m"),
    info(32, 8, "a3kx2", "GET /api/orders 200 in 52ms", "req_c4n7p9"),
    warn(32, 12, "7tbsm", "Retry attempt 3/3 for db query (op=fetch_user_events)"),
    info(32, 17, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    err(32, 22, "7tbsm", "ERROR db query failed: pq: too many connections for role 'app'", "req_a3f9c2"),
    info(32, 27, "a3kx2", "POST /api/orders 201 in 87ms", "req_d2j5q8"),
    err(32, 32, "7tbsm", "ERROR request timeout after 30000ms", "req_b81k4m"),
    info(32, 38, "m9p4r", "Healthcheck OK"),
    err(32, 43, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_a3f9c2"),
    warn(32, 49, "7tbsm", "Circuit breaker tripped for db.events (failure rate 100%)"),
    info(32, 55, "a3kx2", "GET /api/orders/52 200 in 48ms", "req_c4n7p9"),

    err(33, 1, "7tbsm", "ERROR upstream pool exhausted, dropping request", "req_b81k4m"),
    info(33, 7, "m9p4r", "POST /api/sessions 201 in 64ms", "req_e6h1v3"),
    err(33, 12, "7tbsm", "ERROR db query failed: context deadline exceeded", "req_a3f9c2"),
    info(33, 18, "a3kx2", "Healthcheck OK"),
    err(33, 23, "7tbsm", "ERROR request timeout after 30000ms", "req_b81k4m"),
    warn(33, 29, "7tbsm", "Health endpoint returned 503 (degraded)"),
    info(33, 35, "m9p4r", "GET /api/notifications 200 in 49ms", "req_e6h1v3"),
    err(33, 41, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_a3f9c2"),
    info(33, 47, "a3kx2", "GET /api/orders 200 in 51ms", "req_d2j5q8"),
    err(33, 53, "7tbsm", "ERROR upstream pool exhausted, dropping request", "req_a3f9c2"),
    warn(33, 59, "7tbsm", "Active requests in flight: 47 (limit 50)"),

    err(34, 5, "7tbsm", "ERROR db query failed: pq: too many connections for role 'app'", "req_b81k4m"),
    info(34, 11, "m9p4r", "GET /api/users 200 in 44ms", "req_e6h1v3"),
    err(34, 17, "7tbsm", "ERROR request timeout after 30000ms", "req_a3f9c2"),
    info(34, 23, "a3kx2", "PATCH /api/orders/52 200 in 71ms", "req_c4n7p9"),
    err(34, 29, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_b81k4m"),
    warn(34, 35, "7tbsm", "Background job 'session-cleanup' failed: db unreachable"),
    info(34, 41, "m9p4r", "Heartbeat sent"),
    err(34, 47, "7tbsm", "ERROR upstream pool exhausted, dropping request", "req_b81k4m"),
    info(34, 53, "a3kx2", "POST /api/orders 201 in 84ms", "req_d2j5q8"),
    err(34, 59, "7tbsm", "ERROR db query failed: context deadline exceeded", "req_a3f9c2"),

    warn(35, 5, "7tbsm", "Active requests in flight: 50 (limit 50) — backpressure engaged"),
    info(35, 11, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    err(35, 17, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_b81k4m"),
    info(35, 23, "a3kx2", "GET /api/orders 200 in 53ms", "req_c4n7p9"),
    err(35, 29, "7tbsm", "ERROR request timeout after 30000ms", "req_a3f9c2"),
    warn(35, 35, "7tbsm", "Health endpoint returned 503 (degraded)"),
    info(35, 41, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    err(35, 47, "7tbsm", "ERROR upstream pool exhausted, dropping request", "req_b81k4m"),
    info(35, 53, "a3kx2", "GET /api/orders/53 200 in 50ms", "req_d2j5q8"),
    err(35, 59, "7tbsm", "ERROR db query failed: pq: too many connections for role 'app'", "req_a3f9c2"),

    warn(36, 5, "7tbsm", "Initiating rollback to srv-7tbsm@8f4d29"),
    err(36, 11, "7tbsm", "ERROR request timeout after 30000ms", "req_b81k4m"),
    info(36, 17, "m9p4r", "POST /api/uploads 201 in 148ms", "req_e6h1v3"),
    err(36, 23, "7tbsm", "ERROR db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "req_a3f9c2"),
    info(36, 29, "a3kx2", "Healthcheck OK"),
    warn(36, 35, "7tbsm", "Draining in-flight requests before restart"),
    info(36, 41, "m9p4r", "GET /api/users 200 in 43ms", "req_e6h1v3"),
    err(36, 47, "7tbsm", "ERROR upstream pool exhausted, dropping request", "req_b81k4m"),
    warn(36, 53, "7tbsm", "Process received SIGTERM"),
    info(36, 59, "a3kx2", "GET /api/orders 200 in 54ms", "req_c4n7p9"),

    warn(37, 12, "7tbsm", "Process exiting (rollback in progress)"),
    info(37, 24, "a3kx2", "POST /api/orders 201 in 90ms", "req_d2j5q8"),
    info(37, 36, "m9p4r", "Heartbeat sent"),
    info(37, 48, "a3kx2", "GET /api/orders/54 200 in 48ms", "req_c4n7p9"),

    // ── Phase 7 · Recovery deploy (minute 38) ─────────────────────────
    deploy(38, 0, "7tbsm", "🎉 Deploy live · srv-7tbsm@8f4d29 (rollback)"),
    info(38, 5, "7tbsm", "Server listening on port 3000"),
    info(38, 7, "7tbsm", "Cache warmed (1284 keys)"),
    info(38, 12, "a3kx2", "Healthcheck OK"),
    info(38, 18, "7tbsm", "GET /api/health 200 in 3ms"),
    info(38, 26, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(38, 34, "a3kx2", "GET /api/orders 200 in 50ms", "req_c4n7p9"),
    info(38, 42, "7tbsm", "GET /api/users 200 in 37ms", "req_a3f9c2"),
    info(38, 50, "m9p4r", "Heartbeat sent"),
    info(38, 58, "a3kx2", "POST /api/orders 201 in 85ms", "req_d2j5q8"),

    // ── Phase 8 · Stable tail (minutes 39–60) ─────────────────────────
    info(39, 8, "7tbsm", "GET /api/products 200 in 28ms", "req_b81k4m"),
    info(39, 17, "m9p4r", "GET /api/notifications 200 in 47ms", "req_e6h1v3"),
    info(39, 26, "a3kx2", "PATCH /api/orders/55 200 in 66ms", "req_c4n7p9"),
    info(39, 35, "7tbsm", "GET /api/users/me 200 in 18ms", "req_a3f9c2"),
    info(39, 44, "m9p4r", "POST /api/sessions 201 in 60ms", "req_e6h1v3"),
    info(39, 53, "a3kx2", "GET /api/orders 200 in 49ms", "req_d2j5q8"),
    warn(39, 58, "7tbsm", "Slow upstream: hooks.slack.com responded in 982ms"),

    info(40, 4, "7tbsm", "POST /api/events 202 in 11ms", "req_b81k4m"),
    info(40, 13, "a3kx2", "Healthcheck OK"),
    info(40, 22, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    info(40, 31, "7tbsm", "GET /api/products/47 200 in 27ms", "req_a3f9c2"),
    info(40, 40, "a3kx2", "GET /api/orders/56 200 in 46ms", "req_c4n7p9"),
    info(40, 49, "m9p4r", "Heartbeat sent"),
    info(40, 58, "7tbsm", "Background job 'session-cleanup' completed in 43ms"),
    warn(41, 4, "a3kx2", "Slow upstream: api.stripe.com responded in 743ms"),

    info(41, 9, "a3kx2", "POST /api/orders 201 in 86ms", "req_d2j5q8"),
    info(41, 18, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    info(41, 27, "7tbsm", "GET /api/users 200 in 38ms", "req_b81k4m"),
    info(41, 36, "a3kx2", "PATCH /api/orders/56 200 in 68ms", "req_c4n7p9"),
    info(41, 45, "m9p4r", "POST /api/uploads 201 in 139ms", "req_e6h1v3"),
    info(41, 54, "7tbsm", "GET /api/health 200 in 3ms"),
    warn(41, 59, "a3kx2", "Cache miss rate elevated: 0.34 (expected <0.30)"),

    info(42, 5, "a3kx2", "GET /api/orders 200 in 51ms", "req_d2j5q8"),
    info(42, 14, "m9p4r", "Healthcheck OK"),
    info(42, 23, "7tbsm", "GET /api/products 200 in 31ms", "req_a3f9c2"),
    info(42, 32, "a3kx2", "GET /api/orders/57 200 in 47ms", "req_c4n7p9"),
    warn(42, 41, "m9p4r", "Rate limit approaching for tenant 'globex' (88/100)"),
    info(42, 50, "7tbsm", "POST /api/events 202 in 12ms", "req_b81k4m"),
    info(42, 59, "a3kx2", "Background job 'token-refresh' completed in 76ms"),

    info(43, 10, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(43, 19, "7tbsm", "GET /api/users/me 200 in 19ms", "req_a3f9c2"),
    info(43, 28, "a3kx2", "POST /api/orders 201 in 89ms", "req_d2j5q8"),
    info(43, 37, "m9p4r", "Heartbeat sent"),
    info(43, 46, "7tbsm", "GET /api/products/48 200 in 25ms", "req_b81k4m"),
    info(43, 55, "a3kx2", "Healthcheck OK"),
    warn(43, 59, "m9p4r", "Background job 'token-refresh' took 1.4s (typical <100ms)"),

    info(44, 6, "m9p4r", "GET /api/notifications 200 in 50ms", "req_e6h1v3"),
    info(44, 15, "7tbsm", "GET /api/users 200 in 36ms", "req_a3f9c2"),
    info(44, 24, "a3kx2", "PATCH /api/orders/57 200 in 70ms", "req_c4n7p9"),
    dbg(44, 33, "7tbsm", "Connection pool: 6/20 active"),
    info(44, 42, "m9p4r", "POST /api/sessions 201 in 62ms", "req_e6h1v3"),
    info(44, 51, "a3kx2", "GET /api/orders 200 in 48ms", "req_d2j5q8"),

    info(45, 2, "7tbsm", "POST /api/events 202 in 13ms", "req_b81k4m"),
    info(45, 11, "m9p4r", "Healthcheck OK"),
    info(45, 20, "a3kx2", "GET /api/orders/58 200 in 49ms", "req_c4n7p9"),
    info(45, 29, "7tbsm", "GET /api/products 200 in 30ms", "req_a3f9c2"),
    warn(45, 38, "a3kx2", "Slow query: SELECT events WHERE org_id = $1 took 367ms"),
    info(45, 47, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    info(45, 56, "7tbsm", "Heartbeat sent"),

    info(46, 7, "a3kx2", "POST /api/orders 201 in 87ms", "req_d2j5q8"),
    info(46, 16, "m9p4r", "GET /api/notifications 200 in 47ms", "req_e6h1v3"),
    info(46, 25, "7tbsm", "GET /api/users/me 200 in 17ms", "req_b81k4m"),
    info(46, 34, "a3kx2", "GET /api/orders 200 in 50ms", "req_c4n7p9"),
    info(46, 43, "m9p4r", "POST /api/uploads 201 in 145ms", "req_e6h1v3"),
    info(46, 52, "7tbsm", "GET /api/products/49 200 in 26ms", "req_a3f9c2"),
    warn(46, 58, "7tbsm", "POST /api/uploads 429 in 9ms — rate limit hit", "req_b81k4m"),

    info(47, 3, "a3kx2", "Healthcheck OK"),
    info(47, 12, "m9p4r", "Heartbeat sent"),
    info(47, 21, "7tbsm", "GET /api/users 200 in 39ms", "req_b81k4m"),
    info(47, 30, "a3kx2", "PATCH /api/orders/58 200 in 67ms", "req_d2j5q8"),
    info(47, 39, "m9p4r", "GET /api/users 200 in 43ms", "req_e6h1v3"),
    info(47, 48, "7tbsm", "POST /api/events 202 in 11ms", "req_a3f9c2"),
    info(47, 57, "a3kx2", "GET /api/orders/59 200 in 48ms", "req_c4n7p9"),
    warn(48, 2, "m9p4r", "Connection retry succeeded after 2 attempts"),

    info(48, 8, "m9p4r", "GET /api/notifications 200 in 49ms", "req_e6h1v3"),
    info(48, 17, "7tbsm", "GET /api/products 200 in 32ms", "req_a3f9c2"),
    info(48, 26, "a3kx2", "POST /api/orders 201 in 91ms", "req_d2j5q8"),
    info(48, 35, "m9p4r", "Healthcheck OK"),
    info(48, 44, "7tbsm", "GET /api/health 200 in 4ms"),
    info(48, 53, "a3kx2", "GET /api/orders 200 in 52ms", "req_c4n7p9"),
    warn(48, 58, "m9p4r", "Healthcheck slow: returned in 234ms"),

    info(49, 4, "m9p4r", "POST /api/sessions 201 in 61ms", "req_e6h1v3"),
    info(49, 13, "7tbsm", "GET /api/users 200 in 37ms", "req_b81k4m"),
    info(49, 22, "a3kx2", "GET /api/orders/60 200 in 47ms", "req_d2j5q8"),
    warn(49, 31, "7tbsm", "DB pool wait time: 12ms (typical <5ms)"),
    info(49, 40, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(49, 49, "a3kx2", "PATCH /api/orders/60 200 in 69ms", "req_c4n7p9"),
    info(49, 58, "7tbsm", "Heartbeat sent"),

    info(50, 9, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    info(50, 18, "a3kx2", "Healthcheck OK"),
    info(50, 27, "7tbsm", "GET /api/products/50 200 in 28ms", "req_a3f9c2"),
    info(50, 36, "m9p4r", "POST /api/uploads 201 in 141ms", "req_e6h1v3"),
    info(50, 45, "a3kx2", "GET /api/orders 200 in 50ms", "req_c4n7p9"),
    info(50, 54, "7tbsm", "Background job 'session-cleanup' completed in 45ms"),
    warn(50, 59, "a3kx2", "POST /api/orders 422 in 14ms — validation failed", "req_c4n7p9"),

    info(51, 5, "m9p4r", "Heartbeat sent"),
    info(51, 14, "7tbsm", "GET /api/users/me 200 in 18ms", "req_b81k4m"),
    info(51, 23, "a3kx2", "POST /api/orders 201 in 88ms", "req_d2j5q8"),
    info(51, 32, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    info(51, 41, "7tbsm", "POST /api/events 202 in 12ms", "req_a3f9c2"),
    info(51, 50, "a3kx2", "GET /api/orders/61 200 in 49ms", "req_c4n7p9"),
    warn(51, 56, "7tbsm", "Connection retry succeeded after 2 attempts"),
    info(51, 59, "m9p4r", "Healthcheck OK"),

    info(52, 10, "7tbsm", "GET /api/products 200 in 29ms", "req_a3f9c2"),
    info(52, 19, "a3kx2", "PATCH /api/orders/61 200 in 68ms", "req_d2j5q8"),
    warn(52, 28, "m9p4r", "Upload payload over soft limit: 4.4MB (limit 4.0MB)"),
    info(52, 37, "7tbsm", "GET /api/users 200 in 38ms", "req_b81k4m"),
    info(52, 46, "a3kx2", "GET /api/orders 200 in 51ms", "req_c4n7p9"),
    info(52, 55, "m9p4r", "GET /api/notifications 200 in 47ms", "req_e6h1v3"),

    info(53, 6, "7tbsm", "GET /api/health 200 in 3ms"),
    info(53, 15, "a3kx2", "POST /api/orders 201 in 87ms", "req_d2j5q8"),
    info(53, 24, "m9p4r", "POST /api/sessions 201 in 63ms", "req_e6h1v3"),
    info(53, 33, "7tbsm", "GET /api/products/51 200 in 27ms", "req_a3f9c2"),
    info(53, 42, "a3kx2", "Healthcheck OK"),
    info(53, 51, "m9p4r", "Heartbeat sent"),
    warn(53, 57, "a3kx2", "Slow upstream: api.stripe.com responded in 867ms"),

    info(54, 2, "7tbsm", "GET /api/users 200 in 36ms", "req_b81k4m"),
    info(54, 11, "a3kx2", "GET /api/orders/62 200 in 48ms", "req_c4n7p9"),
    info(54, 20, "m9p4r", "GET /api/users 200 in 42ms", "req_e6h1v3"),
    info(54, 29, "7tbsm", "POST /api/events 202 in 11ms", "req_a3f9c2"),
    info(54, 38, "a3kx2", "Background job 'token-refresh' completed in 78ms"),
    info(54, 47, "m9p4r", "GET /api/notifications 200 in 50ms", "req_e6h1v3"),
    warn(54, 53, "a3kx2", "Cache miss rate elevated: 0.31 (expected <0.30)"),
    info(54, 56, "7tbsm", "Heartbeat sent"),

    info(55, 7, "a3kx2", "GET /api/orders 200 in 49ms", "req_d2j5q8"),
    info(55, 16, "m9p4r", "POST /api/uploads 201 in 143ms", "req_e6h1v3"),
    info(55, 25, "7tbsm", "GET /api/users/me 200 in 19ms", "req_b81k4m"),
    info(55, 34, "a3kx2", "PATCH /api/orders/62 200 in 71ms", "req_c4n7p9"),
    info(55, 43, "m9p4r", "Healthcheck OK"),
    info(55, 52, "7tbsm", "GET /api/products 200 in 30ms", "req_a3f9c2"),
    warn(55, 57, "m9p4r", "Healthcheck slow: returned in 187ms"),

    info(56, 3, "a3kx2", "POST /api/orders 201 in 85ms", "req_d2j5q8"),
    info(56, 12, "m9p4r", "GET /api/users 200 in 41ms", "req_e6h1v3"),
    info(56, 21, "7tbsm", "GET /api/users 200 in 37ms", "req_b81k4m"),
    info(56, 30, "a3kx2", "GET /api/orders/63 200 in 47ms", "req_c4n7p9"),
    warn(56, 39, "7tbsm", "Cache miss rate elevated: 0.38 (expected <0.30)"),
    info(56, 48, "m9p4r", "GET /api/notifications 200 in 48ms", "req_e6h1v3"),
    info(56, 57, "a3kx2", "Healthcheck OK"),

    info(57, 8, "m9p4r", "POST /api/sessions 201 in 62ms", "req_e6h1v3"),
    info(57, 17, "7tbsm", "GET /api/products/52 200 in 26ms", "req_a3f9c2"),
    info(57, 26, "a3kx2", "PATCH /api/orders/63 200 in 69ms", "req_d2j5q8"),
    info(57, 35, "m9p4r", "Heartbeat sent"),
    info(57, 44, "7tbsm", "POST /api/events 202 in 13ms", "req_b81k4m"),
    info(57, 53, "a3kx2", "GET /api/orders 200 in 50ms", "req_c4n7p9"),
    warn(57, 58, "7tbsm", "Slow upstream: hooks.slack.com responded in 1.0s"),

    info(58, 4, "m9p4r", "GET /api/users 200 in 43ms", "req_e6h1v3"),
    info(58, 13, "7tbsm", "GET /api/users/me 200 in 18ms", "req_a3f9c2"),
    info(58, 22, "a3kx2", "GET /api/orders/64 200 in 48ms", "req_d2j5q8"),
    info(58, 31, "m9p4r", "GET /api/notifications 200 in 49ms", "req_e6h1v3"),
    info(58, 40, "7tbsm", "GET /api/health 200 in 4ms"),
    info(58, 49, "a3kx2", "POST /api/orders 201 in 89ms", "req_c4n7p9"),
    warn(58, 53, "7tbsm", "Cache miss rate elevated: 0.32 (expected <0.30)"),
    info(58, 58, "m9p4r", "Healthcheck OK"),

    info(59, 9, "7tbsm", "GET /api/products 200 in 31ms", "req_b81k4m"),
    info(59, 18, "a3kx2", "Background job 'session-cleanup' completed in 42ms"),
    info(59, 27, "m9p4r", "POST /api/uploads 201 in 140ms", "req_e6h1v3"),
    info(59, 36, "7tbsm", "GET /api/users 200 in 39ms", "req_a3f9c2"),
    info(59, 45, "a3kx2", "PATCH /api/orders/64 200 in 67ms", "req_d2j5q8"),
    info(59, 54, "m9p4r", "Heartbeat sent"),
    warn(59, 58, "7tbsm", "DB pool wait time: 9ms (typical <5ms)"),
  ];
}

export const mockLogs: readonly LogLine[] = buildMockLogs();
