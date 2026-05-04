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
/*
 * Bare hex-style ids, no `req_` prefix. The displayed `req=…` label is
 * a typesetting concern owned by log-line.module.css's `.requestId`
 * pseudo-element, so the data layer stores only the value itself —
 * what's stored is what's shown after the prefix.
 */
export const REQUEST_IDS = {
  a3f9c2: "7tbsm",
  b81k4m: "7tbsm",
  c4n7p9: "a3kx2",
  d2j5q8: "a3kx2",
  e6h1v3: "m9p4r",
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
    deploy(8, 0, "7tbsm", "Deploy live · srv-7tbsm@a3f2c1"),
    info(8, 4, "7tbsm", "Server listening on port 3000"),
    info(8, 5, "7tbsm", "Cache warmed (1284 keys)"),
    info(8, 9, "a3kx2", "Healthcheck OK"),
    info(8, 18, "7tbsm", "GET /api/health 200 in 3ms"),
    info(8, 24, "a3kx2", "POST /api/orders 201 in 87ms", "c4n7p9"),
    info(8, 31, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(8, 42, "7tbsm", "GET /api/products 200 in 28ms", "a3f9c2"),
    info(8, 53, "a3kx2", "Heartbeat sent"),

    // ── Phase 3 · Healthy traffic (minutes 9–25) ──────────────────────
    info(9, 8, "7tbsm", "GET /api/users 200 in 38ms", "a3f9c2"),
    info(9, 14, "m9p4r", "POST /api/sessions 201 in 64ms", "e6h1v3"),
    info(9, 22, "a3kx2", "GET /api/orders 200 in 51ms", "c4n7p9"),
    info(9, 33, "7tbsm", "GET /api/products 200 in 31ms", "b81k4m"),
    info(9, 41, "m9p4r", "Heartbeat sent"),
    info(9, 48, "a3kx2", "PATCH /api/orders/42 200 in 72ms", "c4n7p9"),
    info(9, 57, "7tbsm", "Background job 'session-cleanup' completed in 52ms"),

    info(10, 5, "7tbsm", "GET /api/users/me 200 in 19ms", "a3f9c2"),
    info(10, 13, "a3kx2", "DELETE /api/orders/41 204 in 33ms", "c4n7p9"),
    info(10, 21, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),
    info(10, 34, "7tbsm", "POST /api/events 202 in 14ms", "b81k4m"),
    info(10, 42, "a3kx2", "GET /api/orders 200 in 58ms", "d2j5q8"),
    info(10, 51, "m9p4r", "Healthcheck OK"),
    warn(10, 57, "7tbsm", "Slow upstream: api.stripe.com responded in 678ms"),

    info(11, 4, "7tbsm", "GET /api/products/42 200 in 22ms", "a3f9c2"),
    info(11, 12, "a3kx2", "POST /api/orders 201 in 91ms", "d2j5q8"),
    warn(11, 19, "m9p4r", "Rate limit approaching for tenant 'acme' (84/100)"),
    info(11, 28, "7tbsm", "GET /api/health 200 in 4ms"),
    info(11, 36, "a3kx2", "GET /api/orders/42 200 in 41ms", "d2j5q8"),
    info(11, 47, "m9p4r", "POST /api/uploads 201 in 134ms", "e6h1v3"),
    info(11, 58, "7tbsm", "Heartbeat sent"),

    info(12, 8, "a3kx2", "Healthcheck OK"),
    info(12, 17, "7tbsm", "GET /api/users 200 in 36ms", "b81k4m"),
    info(12, 26, "m9p4r", "GET /api/notifications 200 in 51ms", "e6h1v3"),
    info(12, 35, "a3kx2", "PATCH /api/orders/43 200 in 68ms", "d2j5q8"),
    info(12, 44, "7tbsm", "POST /api/events 202 in 12ms", "a3f9c2"),
    info(12, 53, "m9p4r", "Background job 'token-refresh' completed in 73ms"),
    warn(12, 58, "7tbsm", "Slow upstream: api.stripe.com responded in 924ms"),

    info(13, 6, "7tbsm", "GET /api/products 200 in 33ms", "a3f9c2"),
    info(13, 15, "a3kx2", "GET /api/orders 200 in 49ms", "c4n7p9"),
    info(13, 24, "m9p4r", "Heartbeat sent"),
    info(13, 32, "7tbsm", "GET /api/users/me 200 in 17ms", "b81k4m"),
    dbg(13, 41, "a3kx2", "Connection pool: 8/20 active"),
    info(13, 49, "m9p4r", "POST /api/sessions 201 in 58ms", "e6h1v3"),
    info(13, 58, "7tbsm", "Healthcheck OK"),

    info(14, 7, "a3kx2", "GET /api/orders/44 200 in 44ms", "c4n7p9"),
    info(14, 16, "m9p4r", "Healthcheck OK"),
    info(14, 24, "7tbsm", "GET /api/products 200 in 29ms", "a3f9c2"),
    info(14, 33, "a3kx2", "POST /api/orders 201 in 88ms", "d2j5q8"),
    warn(14, 42, "7tbsm", "Cache miss rate elevated: 0.42 (expected <0.30)"),
    info(14, 51, "m9p4r", "GET /api/users 200 in 39ms", "e6h1v3"),
    warn(14, 58, "a3kx2", "Healthcheck slow: returned in 312ms (typical <50ms)"),

    info(15, 3, "7tbsm", "Heartbeat sent"),
    info(15, 12, "a3kx2", "GET /api/orders 200 in 47ms", "c4n7p9"),
    info(15, 22, "m9p4r", "POST /api/uploads 201 in 156ms", "e6h1v3"),
    info(15, 31, "7tbsm", "GET /api/users 200 in 41ms", "b81k4m"),
    info(15, 40, "a3kx2", "Background job 'session-cleanup' completed in 39ms"),
    info(15, 49, "m9p4r", "Heartbeat sent"),
    info(15, 57, "7tbsm", "POST /api/events 202 in 13ms", "a3f9c2"),
    warn(16, 2, "a3kx2", "POST /api/orders 422 in 18ms — validation failed", "c4n7p9"),

    info(16, 8, "a3kx2", "Healthcheck OK"),
    info(16, 17, "7tbsm", "GET /api/products/43 200 in 24ms", "a3f9c2"),
    info(16, 26, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(16, 36, "a3kx2", "PATCH /api/orders/45 200 in 71ms", "d2j5q8"),
    info(16, 45, "7tbsm", "GET /api/users/me 200 in 18ms", "b81k4m"),
    info(16, 54, "m9p4r", "Metrics flushed (count=31)"),
    warn(16, 59, "7tbsm", "Cache miss rate elevated: 0.36 (expected <0.30)"),

    info(17, 5, "7tbsm", "GET /api/health 200 in 3ms"),
    info(17, 13, "a3kx2", "GET /api/orders 200 in 53ms", "c4n7p9"),
    info(17, 22, "m9p4r", "POST /api/sessions 201 in 62ms", "e6h1v3"),
    warn(17, 31, "a3kx2", "Slow query: SELECT events WHERE org_id = $1 took 412ms"),
    info(17, 40, "7tbsm", "GET /api/products 200 in 35ms", "a3f9c2"),
    info(17, 49, "m9p4r", "Heartbeat sent"),
    info(17, 58, "a3kx2", "GET /api/orders/46 200 in 46ms", "d2j5q8"),

    info(18, 9, "7tbsm", "GET /api/users 200 in 37ms", "b81k4m"),
    info(18, 18, "a3kx2", "POST /api/orders 201 in 84ms", "c4n7p9"),
    info(18, 27, "m9p4r", "GET /api/notifications 200 in 49ms", "e6h1v3"),
    info(18, 36, "7tbsm", "Background job 'token-refresh' completed in 81ms"),
    info(18, 45, "a3kx2", "Healthcheck OK"),
    info(18, 54, "m9p4r", "GET /api/users 200 in 43ms", "e6h1v3"),
    warn(18, 59, "a3kx2", "POST /api/orders 429 in 8ms — rate limit hit", "d2j5q8"),

    info(19, 5, "7tbsm", "GET /api/products 200 in 30ms", "a3f9c2"),
    info(19, 14, "a3kx2", "DELETE /api/orders/42 204 in 35ms", "d2j5q8"),
    info(19, 23, "m9p4r", "POST /api/uploads 201 in 142ms", "e6h1v3"),
    info(19, 32, "7tbsm", "GET /api/users/me 200 in 19ms", "b81k4m"),
    info(19, 41, "a3kx2", "GET /api/orders 200 in 50ms", "c4n7p9"),
    warn(19, 50, "m9p4r", "Upload payload over soft limit: 4.2MB (limit 4.0MB)"),
    info(19, 59, "7tbsm", "Heartbeat sent"),

    info(20, 8, "a3kx2", "GET /api/orders/47 200 in 42ms", "d2j5q8"),
    info(20, 17, "m9p4r", "Healthcheck OK"),
    info(20, 26, "7tbsm", "POST /api/events 202 in 11ms", "a3f9c2"),
    info(20, 35, "a3kx2", "PATCH /api/orders/47 200 in 67ms", "c4n7p9"),
    info(20, 44, "m9p4r", "GET /api/notifications 200 in 46ms", "e6h1v3"),
    info(20, 53, "7tbsm", "GET /api/products/44 200 in 26ms", "b81k4m"),
    warn(20, 58, "m9p4r", "Background job 'cleanup' took 2.3s (typical <500ms)"),

    info(21, 4, "a3kx2", "Healthcheck OK"),
    info(21, 13, "m9p4r", "POST /api/sessions 201 in 60ms", "e6h1v3"),
    info(21, 22, "7tbsm", "GET /api/users 200 in 39ms", "a3f9c2"),
    info(21, 31, "a3kx2", "GET /api/orders 200 in 52ms", "d2j5q8"),
    info(21, 40, "m9p4r", "Heartbeat sent"),
    info(21, 49, "7tbsm", "GET /api/health 200 in 4ms"),
    info(21, 58, "a3kx2", "POST /api/orders 201 in 89ms", "c4n7p9"),
    warn(22, 1, "m9p4r", "Cache miss rate elevated: 0.33 (expected <0.30)"),

    info(22, 9, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    info(22, 18, "7tbsm", "GET /api/products 200 in 32ms", "b81k4m"),
    info(22, 27, "a3kx2", "Background job 'session-cleanup' completed in 44ms"),
    info(22, 36, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),
    warn(22, 45, "7tbsm", "DB pool wait time: 18ms (typical <5ms)"),
    info(22, 54, "a3kx2", "GET /api/orders/48 200 in 48ms", "c4n7p9"),

    info(23, 5, "m9p4r", "Healthcheck OK"),
    info(23, 14, "7tbsm", "GET /api/users/me 200 in 21ms", "a3f9c2"),
    info(23, 23, "a3kx2", "PATCH /api/orders/48 200 in 69ms", "d2j5q8"),
    info(23, 32, "m9p4r", "POST /api/uploads 201 in 138ms", "e6h1v3"),
    info(23, 41, "7tbsm", "POST /api/events 202 in 12ms", "b81k4m"),
    dbg(23, 50, "a3kx2", "GC paused 17ms"),
    info(23, 58, "m9p4r", "Metrics flushed (count=29)"),
    warn(24, 1, "7tbsm", "Connection retry succeeded after 2 attempts"),

    info(24, 9, "7tbsm", "GET /api/products 200 in 34ms", "a3f9c2"),
    info(24, 18, "a3kx2", "GET /api/orders 200 in 51ms", "c4n7p9"),
    info(24, 27, "m9p4r", "POST /api/sessions 201 in 63ms", "e6h1v3"),
    info(24, 36, "7tbsm", "GET /api/users 200 in 40ms", "b81k4m"),
    info(24, 45, "a3kx2", "Healthcheck OK"),
    info(24, 54, "m9p4r", "Heartbeat sent"),

    // ── Phase 4 · Late-healthy / pre-degradation (minutes 25–29) ──────
    info(25, 6, "7tbsm", "GET /api/products/45 200 in 28ms", "a3f9c2"),
    info(25, 16, "a3kx2", "POST /api/orders 201 in 86ms", "d2j5q8"),
    info(25, 26, "m9p4r", "GET /api/notifications 200 in 50ms", "e6h1v3"),
    info(25, 36, "7tbsm", "GET /api/users/me 200 in 22ms", "b81k4m"),
    warn(25, 46, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 487ms"),
    info(25, 56, "a3kx2", "GET /api/orders/49 200 in 49ms", "c4n7p9"),

    info(26, 7, "m9p4r", "Healthcheck OK"),
    info(26, 17, "7tbsm", "POST /api/events 202 in 13ms", "a3f9c2"),
    info(26, 27, "a3kx2", "PATCH /api/orders/49 200 in 73ms", "d2j5q8"),
    info(26, 37, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(26, 47, "7tbsm", "Heartbeat sent"),
    info(26, 57, "a3kx2", "GET /api/orders 200 in 54ms", "c4n7p9"),
    warn(27, 2, "m9p4r", "Slow upstream: api.stripe.com responded in 1.1s"),

    info(27, 8, "m9p4r", "POST /api/uploads 201 in 144ms", "e6h1v3"),
    info(27, 18, "7tbsm", "GET /api/products 200 in 36ms", "b81k4m"),
    info(27, 28, "a3kx2", "Background job 'token-refresh' completed in 79ms"),
    warn(27, 38, "7tbsm", "DB pool wait time: 24ms (typical <5ms)"),
    info(27, 48, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(27, 58, "a3kx2", "Healthcheck OK"),

    info(28, 9, "7tbsm", "GET /api/users 200 in 44ms", "a3f9c2"),
    info(28, 19, "a3kx2", "GET /api/orders 200 in 53ms", "d2j5q8"),
    info(28, 29, "m9p4r", "Heartbeat sent"),
    warn(28, 39, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 612ms"),
    info(28, 49, "a3kx2", "POST /api/orders 201 in 91ms", "c4n7p9"),
    info(28, 59, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),

    info(29, 10, "7tbsm", "GET /api/products/46 200 in 38ms", "b81k4m"),
    info(29, 20, "a3kx2", "GET /api/orders/50 200 in 47ms", "c4n7p9"),
    info(29, 30, "m9p4r", "POST /api/sessions 201 in 61ms", "e6h1v3"),
    warn(29, 40, "7tbsm", "DB connection acquire took 142ms (typical <20ms)"),
    info(29, 50, "a3kx2", "Healthcheck OK"),

    // ── Phase 5 · Degradation begins (minutes 30–31) ──────────────────
    warn(30, 4, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 891ms"),
    info(30, 12, "a3kx2", "GET /api/orders 200 in 50ms", "d2j5q8"),
    warn(30, 19, "7tbsm", "DB pool wait time: 67ms (typical <5ms)"),
    info(30, 27, "m9p4r", "GET /api/users 200 in 43ms", "e6h1v3"),
    warn(30, 35, "7tbsm", "Retry attempt 1/3 for db query (op=fetch_user_events)"),
    info(30, 43, "a3kx2", "POST /api/orders 201 in 88ms", "c4n7p9"),
    warn(30, 51, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 1247ms"),
    info(30, 59, "m9p4r", "Heartbeat sent"),

    warn(31, 6, "7tbsm", "DB connection pool nearing capacity (18/20 active)"),
    info(31, 14, "a3kx2", "GET /api/orders/51 200 in 49ms", "d2j5q8"),
    warn(31, 22, "7tbsm", "Retry attempt 2/3 for db query (op=fetch_user_events)"),
    info(31, 30, "m9p4r", "GET /api/notifications 200 in 51ms", "e6h1v3"),
    warn(31, 38, "7tbsm", "DB pool wait time: 184ms (typical <5ms)"),
    info(31, 46, "a3kx2", "PATCH /api/orders/51 200 in 75ms", "c4n7p9"),
    warn(31, 54, "7tbsm", "Slow query: SELECT events WHERE org_id = $1 took 1683ms"),

    // ── Phase 6 · Error cluster (minutes 32–36) — DEMO TARGET ─────────
    err(32, 2, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "b81k4m"),
    info(32, 8, "a3kx2", "GET /api/orders 200 in 52ms", "c4n7p9"),
    warn(32, 12, "7tbsm", "Retry attempt 3/3 for db query (op=fetch_user_events)"),
    info(32, 17, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    err(32, 22, "7tbsm", "db query failed: pq: too many connections for role 'app'", "a3f9c2"),
    info(32, 27, "a3kx2", "POST /api/orders 201 in 87ms", "d2j5q8"),
    err(32, 32, "7tbsm", "request timeout after 30000ms", "b81k4m"),
    info(32, 38, "m9p4r", "Healthcheck OK"),
    err(32, 43, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "a3f9c2"),
    warn(32, 49, "7tbsm", "Circuit breaker tripped for db.events (failure rate 100%)"),
    info(32, 55, "a3kx2", "GET /api/orders/52 200 in 48ms", "c4n7p9"),

    err(33, 1, "7tbsm", "upstream pool exhausted, dropping request", "b81k4m"),
    info(33, 7, "m9p4r", "POST /api/sessions 201 in 64ms", "e6h1v3"),
    err(33, 12, "7tbsm", "db query failed: context deadline exceeded", "a3f9c2"),
    info(33, 18, "a3kx2", "Healthcheck OK"),
    err(33, 23, "7tbsm", "request timeout after 30000ms", "b81k4m"),
    warn(33, 29, "7tbsm", "Health endpoint returned 503 (degraded)"),
    info(33, 35, "m9p4r", "GET /api/notifications 200 in 49ms", "e6h1v3"),
    err(33, 41, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "a3f9c2"),
    info(33, 47, "a3kx2", "GET /api/orders 200 in 51ms", "d2j5q8"),
    err(33, 53, "7tbsm", "upstream pool exhausted, dropping request", "a3f9c2"),
    warn(33, 59, "7tbsm", "Active requests in flight: 47 (limit 50)"),

    err(34, 5, "7tbsm", "db query failed: pq: too many connections for role 'app'", "b81k4m"),
    info(34, 11, "m9p4r", "GET /api/users 200 in 44ms", "e6h1v3"),
    err(34, 17, "7tbsm", "request timeout after 30000ms", "a3f9c2"),
    info(34, 23, "a3kx2", "PATCH /api/orders/52 200 in 71ms", "c4n7p9"),
    err(34, 29, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "b81k4m"),
    warn(34, 35, "7tbsm", "Background job 'session-cleanup' failed: db unreachable"),
    info(34, 41, "m9p4r", "Heartbeat sent"),
    err(34, 47, "7tbsm", "upstream pool exhausted, dropping request", "b81k4m"),
    info(34, 53, "a3kx2", "POST /api/orders 201 in 84ms", "d2j5q8"),
    err(34, 59, "7tbsm", "db query failed: context deadline exceeded", "a3f9c2"),

    warn(35, 5, "7tbsm", "Active requests in flight: 50 (limit 50) — backpressure engaged"),
    info(35, 11, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    err(35, 17, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "b81k4m"),
    info(35, 23, "a3kx2", "GET /api/orders 200 in 53ms", "c4n7p9"),
    err(35, 29, "7tbsm", "request timeout after 30000ms", "a3f9c2"),
    warn(35, 35, "7tbsm", "Health endpoint returned 503 (degraded)"),
    info(35, 41, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    err(35, 47, "7tbsm", "upstream pool exhausted, dropping request", "b81k4m"),
    info(35, 53, "a3kx2", "GET /api/orders/53 200 in 50ms", "d2j5q8"),
    err(35, 59, "7tbsm", "db query failed: pq: too many connections for role 'app'", "a3f9c2"),

    warn(36, 5, "7tbsm", "Initiating rollback to srv-7tbsm@8f4d29"),
    err(36, 11, "7tbsm", "request timeout after 30000ms", "b81k4m"),
    info(36, 17, "m9p4r", "POST /api/uploads 201 in 148ms", "e6h1v3"),
    err(36, 23, "7tbsm", "db connection refused: dial tcp 10.0.0.4:5432: i/o timeout", "a3f9c2"),
    info(36, 29, "a3kx2", "Healthcheck OK"),
    warn(36, 35, "7tbsm", "Draining in-flight requests before restart"),
    info(36, 41, "m9p4r", "GET /api/users 200 in 43ms", "e6h1v3"),
    err(36, 47, "7tbsm", "upstream pool exhausted, dropping request", "b81k4m"),
    warn(36, 53, "7tbsm", "Process received SIGTERM"),
    info(36, 59, "a3kx2", "GET /api/orders 200 in 54ms", "c4n7p9"),

    warn(37, 12, "7tbsm", "Process exiting (rollback in progress)"),
    info(37, 24, "a3kx2", "POST /api/orders 201 in 90ms", "d2j5q8"),
    info(37, 36, "m9p4r", "Heartbeat sent"),
    info(37, 48, "a3kx2", "GET /api/orders/54 200 in 48ms", "c4n7p9"),

    // ── Phase 7 · Recovery deploy (minute 38) ─────────────────────────
    deploy(38, 0, "7tbsm", "Deploy live · srv-7tbsm@8f4d29 (rollback)"),
    info(38, 5, "7tbsm", "Server listening on port 3000"),
    info(38, 7, "7tbsm", "Cache warmed (1284 keys)"),
    info(38, 12, "a3kx2", "Healthcheck OK"),
    info(38, 18, "7tbsm", "GET /api/health 200 in 3ms"),
    info(38, 26, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(38, 34, "a3kx2", "GET /api/orders 200 in 50ms", "c4n7p9"),
    info(38, 42, "7tbsm", "GET /api/users 200 in 37ms", "a3f9c2"),
    info(38, 50, "m9p4r", "Heartbeat sent"),
    info(38, 58, "a3kx2", "POST /api/orders 201 in 85ms", "d2j5q8"),

    // ── Phase 8 · Stable tail (minutes 39–60) ─────────────────────────
    info(39, 8, "7tbsm", "GET /api/products 200 in 28ms", "b81k4m"),
    info(39, 17, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),
    info(39, 26, "a3kx2", "PATCH /api/orders/55 200 in 66ms", "c4n7p9"),
    info(39, 35, "7tbsm", "GET /api/users/me 200 in 18ms", "a3f9c2"),
    info(39, 44, "m9p4r", "POST /api/sessions 201 in 60ms", "e6h1v3"),
    info(39, 53, "a3kx2", "GET /api/orders 200 in 49ms", "d2j5q8"),
    warn(39, 58, "7tbsm", "Slow upstream: hooks.slack.com responded in 982ms"),

    info(40, 4, "7tbsm", "POST /api/events 202 in 11ms", "b81k4m"),
    info(40, 13, "a3kx2", "Healthcheck OK"),
    info(40, 22, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    info(40, 31, "7tbsm", "GET /api/products/47 200 in 27ms", "a3f9c2"),
    info(40, 40, "a3kx2", "GET /api/orders/56 200 in 46ms", "c4n7p9"),
    info(40, 49, "m9p4r", "Heartbeat sent"),
    info(40, 58, "7tbsm", "Background job 'session-cleanup' completed in 43ms"),
    warn(41, 4, "a3kx2", "Slow upstream: api.stripe.com responded in 743ms"),

    info(41, 9, "a3kx2", "POST /api/orders 201 in 86ms", "d2j5q8"),
    info(41, 18, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(41, 27, "7tbsm", "GET /api/users 200 in 38ms", "b81k4m"),
    info(41, 36, "a3kx2", "PATCH /api/orders/56 200 in 68ms", "c4n7p9"),
    info(41, 45, "m9p4r", "POST /api/uploads 201 in 139ms", "e6h1v3"),
    info(41, 54, "7tbsm", "GET /api/health 200 in 3ms"),
    warn(41, 59, "a3kx2", "Cache miss rate elevated: 0.34 (expected <0.30)"),

    info(42, 5, "a3kx2", "GET /api/orders 200 in 51ms", "d2j5q8"),
    info(42, 14, "m9p4r", "Healthcheck OK"),
    info(42, 23, "7tbsm", "GET /api/products 200 in 31ms", "a3f9c2"),
    info(42, 32, "a3kx2", "GET /api/orders/57 200 in 47ms", "c4n7p9"),
    warn(42, 41, "m9p4r", "Rate limit approaching for tenant 'globex' (88/100)"),
    info(42, 50, "7tbsm", "POST /api/events 202 in 12ms", "b81k4m"),
    info(42, 59, "a3kx2", "Background job 'token-refresh' completed in 76ms"),

    info(43, 10, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(43, 19, "7tbsm", "GET /api/users/me 200 in 19ms", "a3f9c2"),
    info(43, 28, "a3kx2", "POST /api/orders 201 in 89ms", "d2j5q8"),
    info(43, 37, "m9p4r", "Heartbeat sent"),
    info(43, 46, "7tbsm", "GET /api/products/48 200 in 25ms", "b81k4m"),
    info(43, 55, "a3kx2", "Healthcheck OK"),
    warn(43, 59, "m9p4r", "Background job 'token-refresh' took 1.4s (typical <100ms)"),

    info(44, 6, "m9p4r", "GET /api/notifications 200 in 50ms", "e6h1v3"),
    info(44, 15, "7tbsm", "GET /api/users 200 in 36ms", "a3f9c2"),
    info(44, 24, "a3kx2", "PATCH /api/orders/57 200 in 70ms", "c4n7p9"),
    dbg(44, 33, "7tbsm", "Connection pool: 6/20 active"),
    info(44, 42, "m9p4r", "POST /api/sessions 201 in 62ms", "e6h1v3"),
    info(44, 51, "a3kx2", "GET /api/orders 200 in 48ms", "d2j5q8"),

    info(45, 2, "7tbsm", "POST /api/events 202 in 13ms", "b81k4m"),
    info(45, 11, "m9p4r", "Healthcheck OK"),
    info(45, 20, "a3kx2", "GET /api/orders/58 200 in 49ms", "c4n7p9"),
    info(45, 29, "7tbsm", "GET /api/products 200 in 30ms", "a3f9c2"),
    warn(45, 38, "a3kx2", "Slow query: SELECT events WHERE org_id = $1 took 367ms"),
    info(45, 47, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    info(45, 56, "7tbsm", "Heartbeat sent"),

    info(46, 7, "a3kx2", "POST /api/orders 201 in 87ms", "d2j5q8"),
    info(46, 16, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),
    info(46, 25, "7tbsm", "GET /api/users/me 200 in 17ms", "b81k4m"),
    info(46, 34, "a3kx2", "GET /api/orders 200 in 50ms", "c4n7p9"),
    info(46, 43, "m9p4r", "POST /api/uploads 201 in 145ms", "e6h1v3"),
    info(46, 52, "7tbsm", "GET /api/products/49 200 in 26ms", "a3f9c2"),
    warn(46, 58, "7tbsm", "POST /api/uploads 429 in 9ms — rate limit hit", "b81k4m"),

    info(47, 3, "a3kx2", "Healthcheck OK"),
    info(47, 12, "m9p4r", "Heartbeat sent"),
    info(47, 21, "7tbsm", "GET /api/users 200 in 39ms", "b81k4m"),
    info(47, 30, "a3kx2", "PATCH /api/orders/58 200 in 67ms", "d2j5q8"),
    info(47, 39, "m9p4r", "GET /api/users 200 in 43ms", "e6h1v3"),
    info(47, 48, "7tbsm", "POST /api/events 202 in 11ms", "a3f9c2"),
    info(47, 57, "a3kx2", "GET /api/orders/59 200 in 48ms", "c4n7p9"),
    warn(48, 2, "m9p4r", "Connection retry succeeded after 2 attempts"),

    info(48, 8, "m9p4r", "GET /api/notifications 200 in 49ms", "e6h1v3"),
    info(48, 17, "7tbsm", "GET /api/products 200 in 32ms", "a3f9c2"),
    info(48, 26, "a3kx2", "POST /api/orders 201 in 91ms", "d2j5q8"),
    info(48, 35, "m9p4r", "Healthcheck OK"),
    info(48, 44, "7tbsm", "GET /api/health 200 in 4ms"),
    info(48, 53, "a3kx2", "GET /api/orders 200 in 52ms", "c4n7p9"),
    warn(48, 58, "m9p4r", "Healthcheck slow: returned in 234ms"),

    info(49, 4, "m9p4r", "POST /api/sessions 201 in 61ms", "e6h1v3"),
    info(49, 13, "7tbsm", "GET /api/users 200 in 37ms", "b81k4m"),
    info(49, 22, "a3kx2", "GET /api/orders/60 200 in 47ms", "d2j5q8"),
    warn(49, 31, "7tbsm", "DB pool wait time: 12ms (typical <5ms)"),
    info(49, 40, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(49, 49, "a3kx2", "PATCH /api/orders/60 200 in 69ms", "c4n7p9"),
    info(49, 58, "7tbsm", "Heartbeat sent"),

    info(50, 9, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(50, 18, "a3kx2", "Healthcheck OK"),
    info(50, 27, "7tbsm", "GET /api/products/50 200 in 28ms", "a3f9c2"),
    info(50, 36, "m9p4r", "POST /api/uploads 201 in 141ms", "e6h1v3"),
    info(50, 45, "a3kx2", "GET /api/orders 200 in 50ms", "c4n7p9"),
    info(50, 54, "7tbsm", "Background job 'session-cleanup' completed in 45ms"),
    warn(50, 59, "a3kx2", "POST /api/orders 422 in 14ms — validation failed", "c4n7p9"),

    info(51, 5, "m9p4r", "Heartbeat sent"),
    info(51, 14, "7tbsm", "GET /api/users/me 200 in 18ms", "b81k4m"),
    info(51, 23, "a3kx2", "POST /api/orders 201 in 88ms", "d2j5q8"),
    info(51, 32, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    info(51, 41, "7tbsm", "POST /api/events 202 in 12ms", "a3f9c2"),
    info(51, 50, "a3kx2", "GET /api/orders/61 200 in 49ms", "c4n7p9"),
    warn(51, 56, "7tbsm", "Connection retry succeeded after 2 attempts"),
    info(51, 59, "m9p4r", "Healthcheck OK"),

    info(52, 10, "7tbsm", "GET /api/products 200 in 29ms", "a3f9c2"),
    info(52, 19, "a3kx2", "PATCH /api/orders/61 200 in 68ms", "d2j5q8"),
    warn(52, 28, "m9p4r", "Upload payload over soft limit: 4.4MB (limit 4.0MB)"),
    info(52, 37, "7tbsm", "GET /api/users 200 in 38ms", "b81k4m"),
    info(52, 46, "a3kx2", "GET /api/orders 200 in 51ms", "c4n7p9"),
    info(52, 55, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),

    info(53, 6, "7tbsm", "GET /api/health 200 in 3ms"),
    info(53, 15, "a3kx2", "POST /api/orders 201 in 87ms", "d2j5q8"),
    info(53, 24, "m9p4r", "POST /api/sessions 201 in 63ms", "e6h1v3"),
    info(53, 33, "7tbsm", "GET /api/products/51 200 in 27ms", "a3f9c2"),
    info(53, 42, "a3kx2", "Healthcheck OK"),
    info(53, 51, "m9p4r", "Heartbeat sent"),
    warn(53, 57, "a3kx2", "Slow upstream: api.stripe.com responded in 867ms"),

    info(54, 2, "7tbsm", "GET /api/users 200 in 36ms", "b81k4m"),
    info(54, 11, "a3kx2", "GET /api/orders/62 200 in 48ms", "c4n7p9"),
    info(54, 20, "m9p4r", "GET /api/users 200 in 42ms", "e6h1v3"),
    info(54, 29, "7tbsm", "POST /api/events 202 in 11ms", "a3f9c2"),
    info(54, 38, "a3kx2", "Background job 'token-refresh' completed in 78ms"),
    info(54, 47, "m9p4r", "GET /api/notifications 200 in 50ms", "e6h1v3"),
    warn(54, 53, "a3kx2", "Cache miss rate elevated: 0.31 (expected <0.30)"),
    info(54, 56, "7tbsm", "Heartbeat sent"),

    info(55, 7, "a3kx2", "GET /api/orders 200 in 49ms", "d2j5q8"),
    info(55, 16, "m9p4r", "POST /api/uploads 201 in 143ms", "e6h1v3"),
    info(55, 25, "7tbsm", "GET /api/users/me 200 in 19ms", "b81k4m"),
    info(55, 34, "a3kx2", "PATCH /api/orders/62 200 in 71ms", "c4n7p9"),
    info(55, 43, "m9p4r", "Healthcheck OK"),
    info(55, 52, "7tbsm", "GET /api/products 200 in 30ms", "a3f9c2"),
    warn(55, 57, "m9p4r", "Healthcheck slow: returned in 187ms"),

    info(56, 3, "a3kx2", "POST /api/orders 201 in 85ms", "d2j5q8"),
    info(56, 12, "m9p4r", "GET /api/users 200 in 41ms", "e6h1v3"),
    info(56, 21, "7tbsm", "GET /api/users 200 in 37ms", "b81k4m"),
    info(56, 30, "a3kx2", "GET /api/orders/63 200 in 47ms", "c4n7p9"),
    warn(56, 39, "7tbsm", "Cache miss rate elevated: 0.38 (expected <0.30)"),
    info(56, 48, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(56, 57, "a3kx2", "Healthcheck OK"),

    info(57, 8, "m9p4r", "POST /api/sessions 201 in 62ms", "e6h1v3"),
    info(57, 17, "7tbsm", "GET /api/products/52 200 in 26ms", "a3f9c2"),
    info(57, 26, "a3kx2", "PATCH /api/orders/63 200 in 69ms", "d2j5q8"),
    info(57, 35, "m9p4r", "Heartbeat sent"),
    info(57, 44, "7tbsm", "POST /api/events 202 in 13ms", "b81k4m"),
    info(57, 53, "a3kx2", "GET /api/orders 200 in 50ms", "c4n7p9"),
    warn(57, 58, "7tbsm", "Slow upstream: hooks.slack.com responded in 1.0s"),

    info(58, 4, "m9p4r", "GET /api/users 200 in 43ms", "e6h1v3"),
    info(58, 13, "7tbsm", "GET /api/users/me 200 in 18ms", "a3f9c2"),
    info(58, 22, "a3kx2", "GET /api/orders/64 200 in 48ms", "d2j5q8"),
    info(58, 31, "m9p4r", "GET /api/notifications 200 in 49ms", "e6h1v3"),
    info(58, 40, "7tbsm", "GET /api/health 200 in 4ms"),
    info(58, 49, "a3kx2", "POST /api/orders 201 in 89ms", "c4n7p9"),
    warn(58, 53, "7tbsm", "Cache miss rate elevated: 0.32 (expected <0.30)"),
    info(58, 58, "m9p4r", "Healthcheck OK"),

    info(59, 9, "7tbsm", "GET /api/products 200 in 31ms", "b81k4m"),
    info(59, 18, "a3kx2", "Background job 'session-cleanup' completed in 42ms"),
    info(59, 27, "m9p4r", "POST /api/uploads 201 in 140ms", "e6h1v3"),
    info(59, 36, "7tbsm", "GET /api/users 200 in 39ms", "a3f9c2"),
    info(59, 45, "a3kx2", "PATCH /api/orders/64 200 in 67ms", "d2j5q8"),
    info(59, 54, "m9p4r", "Heartbeat sent"),
    warn(59, 58, "7tbsm", "DB pool wait time: 9ms (typical <5ms)"),
  ];
}

export const mockLogs: readonly LogLine[] = buildMockLogs();

/**
 * One entry in the live-tail seed. Each carries the line content
 * plus a `delayMs` — how long to wait *after the previous seed entry*
 * before this one streams in. Hand-curated cadence: bursts of
 * activity, quiet stretches in between.
 */
export type LiveTailSeedEntry = LogLine & {
  /** Wall-clock delay in ms after the previous seed entry. */
  readonly delayMs: number;
};

/**
 * Live-tail simulation seed (spec §10.2 + §9.8). Continues the story
 * arc from where `mockLogs` ends — minutes 60+ pick up the "stable
 * tail" theme: mostly INFO, occasional WARN, healthy traffic with
 * request lifecycles. Timestamps continue from MOCK_START_MS so the
 * story feels coherent if a user inspects line times mid-stream.
 *
 * The wall-clock cadence (`delayMs`) is intentionally variable to
 * match the spec's "bursts of activity, quiet periods" guidance:
 * tight clusters (~200-400ms) inside imagined request lifecycles,
 * long pauses (~1500-2500ms) between them. Hand-curated, not random,
 * so the streaming feels narratively shaped rather than chaotic.
 *
 * The seed is finite — when streaming exhausts it, the engine simply
 * stops adding lines. No looping or procedural generation; for a
 * portfolio prototype, demo-friendly + deterministic + memory-bounded
 * beats infinite simulation.
 */
function buildLiveTailSeed(): readonly LiveTailSeedEntry[] {
  // Continue the id sequence past where buildMockLogs stopped. The
  // mockLogs export is already 415 entries; seed ids start at 416.
  const startNum = mockLogs.length;
  let nextIdNum = startNum;
  const id = (): string => `log_${String(++nextIdNum).padStart(4, "0")}`;
  const t = (min: number, sec: number): number =>
    MOCK_START_MS + min * 60_000 + sec * 1_000;

  type Builder = (
    min: number,
    sec: number,
    delayMs: number,
    instance: InstanceId,
    message: string,
    requestId?: RequestId,
  ) => LiveTailSeedEntry;

  const lvl = (level: LogLine["level"]): Builder =>
    (min, sec, delayMs, instance, message, requestId) => ({
      id: id(),
      timestamp: t(min, sec),
      instance,
      level,
      message,
      delayMs,
      ...(requestId ? { requestId } : {}),
    });

  const info = lvl("INFO");
  const warn = lvl("WARN");

  // Pattern: a few short clusters of request-lifecycle activity
  // separated by quieter pauses. delayMs values approximate how long
  // a viewer would wait between visible appearances of new lines.
  return [
    // Initial pause so the page settles before streaming begins —
    // gives the user a moment to orient before motion starts.
    info(60, 8, 1800, "7tbsm", "GET /api/users 200 in 36ms", "a3f9c2"),
    info(60, 12, 320, "a3kx2", "GET /api/orders 200 in 49ms", "d2j5q8"),
    info(60, 18, 280, "m9p4r", "Heartbeat sent"),
    info(60, 24, 420, "7tbsm", "GET /api/products 200 in 29ms", "b81k4m"),

    // Quiet stretch.
    info(60, 38, 2200, "a3kx2", "Healthcheck OK"),
    info(60, 49, 1700, "m9p4r", "GET /api/notifications 200 in 47ms", "e6h1v3"),

    // Burst — request lifecycle.
    info(61, 4, 2000, "7tbsm", "POST /api/orders 201 in 88ms", "a3f9c2"),
    info(61, 7, 250, "7tbsm", "DB query: SELECT users WHERE id=? (12ms)", "a3f9c2"),
    info(61, 10, 220, "7tbsm", "DB query: INSERT orders (28ms)", "a3f9c2"),
    info(61, 13, 240, "7tbsm", "Cache invalidated: orders:7tbsm", "a3f9c2"),
    info(61, 17, 380, "a3kx2", "PATCH /api/orders/68 200 in 71ms", "c4n7p9"),

    // Quiet.
    info(61, 32, 2400, "m9p4r", "Heartbeat sent"),
    warn(61, 41, 1800, "a3kx2", "Cache miss rate elevated: 0.32 (expected <0.30)"),
    info(61, 49, 1500, "7tbsm", "Healthcheck OK"),

    // Burst — multi-instance activity.
    info(62, 3, 2100, "m9p4r", "POST /api/sessions 201 in 63ms", "e6h1v3"),
    info(62, 6, 220, "7tbsm", "GET /api/users/me 200 in 18ms", "b81k4m"),
    info(62, 9, 260, "a3kx2", "GET /api/orders/68 200 in 46ms", "d2j5q8"),
    info(62, 12, 280, "m9p4r", "GET /api/notifications 200 in 48ms", "e6h1v3"),
    info(62, 16, 350, "7tbsm", "POST /api/events 202 in 12ms", "a3f9c2"),

    // Quiet stretch.
    info(62, 32, 2300, "a3kx2", "Background job 'token-refresh' completed in 84ms"),
    info(62, 47, 2200, "m9p4r", "Heartbeat sent"),

    // Final cluster — story winds down.
    info(63, 1, 1900, "7tbsm", "GET /api/products 200 in 33ms", "b81k4m"),
    info(63, 4, 240, "a3kx2", "GET /api/orders 200 in 51ms", "c4n7p9"),
    info(63, 8, 320, "m9p4r", "Healthcheck OK"),
    info(63, 19, 1600, "7tbsm", "Heartbeat sent"),
    info(63, 31, 1900, "a3kx2", "Cache hit ratio: 0.91"),
    info(63, 44, 1800, "m9p4r", "Background job 'session-cleanup' completed in 39ms"),
    info(63, 58, 2100, "7tbsm", "Healthcheck OK"),
  ];
}

export const liveTailSeed: readonly LiveTailSeedEntry[] = buildLiveTailSeed();
