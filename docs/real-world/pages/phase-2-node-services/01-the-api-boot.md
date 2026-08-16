---
title: "The API boot, assembled"
sidebar_label: "01 · The API boot"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Node.js v24 docs (`process`, `http.Server`
> events) and the node-postgres pool docs. Concept home:
> [Node — boot sequence](../../../nodejs/pages/phase-11-deployment/02-boot-sequence.md),
> [12-factor config](../../../nodejs/pages/phase-11-deployment/01-twelve-factor-config.md),
> [graceful shutdown](../../../nodejs/pages/phase-5-http-processes/17-graceful-shutdown.md).

## The problem

The gap between `app.listen(3000)` in a tutorial and a process that a
container orchestrator can run: config that fails fast, dependencies that
connect before traffic arrives, readiness that tells the truth, and shutdown
that drops nothing. The concept pages establish each rule; this chapter is
the storefront's actual `main()` — the file where they all meet.

## The order, and why it is load-bearing

**validate env → run migrations → connect the pool → build the app → listen →
mark ready**, and shutdown is the mirror image. Every inversion is a named
incident: listen-before-pool accepts requests that 500 on the first query;
ready-before-migrate serves old code against a half-migrated schema;
pool-close-before-server-close kills in-flight requests mid-query.

## The implementation

```js
// src/config.js — fail fast, with every missing var named at once
import {z} from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OBJECT_STORE_DIR: z.string().min(1),          // dev: a local path (ch. 03)
  COOKIE_SECRET: z.string().min(32),
});

export function loadConfig(env = process.env) {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`invalid environment:\n  ${missing}`);
  }
  return parsed.data;
}
```

```js
// src/server.js — the API's main(), run by `node src/server.js`
import http from 'node:http';
import {loadConfig} from './config.js';
import {migrate} from '../db/migrate.js';
import {createPool} from '../db/pool.js';
import {buildApp} from './app.js';           // Phase 3's Express app factory
import {createHealth} from './health.js';    // chapter 09

const config = loadConfig();                          // 1 — throws = exit 1
await migrate(config.DATABASE_URL);                   // 2 — advisory-locked (Phase 1)
const pool = createPool(config);                      // 3
await pool.query('select 1');                         //     prove it, don't assume it

const health = createHealth();
const app = buildApp({config, pool, health});
const server = http.createServer(app);

server.listen(config.PORT, () => {                    // 4
  health.markReady();                                 // 5 — readiness follows listen
  console.log(JSON.stringify({msg: 'listening', port: config.PORT}));
});
server.on('error', (err) => {                         // EADDRINUSE lands here,
  console.error(err);                                 // not in the listen callback
  process.exit(1);
});

// ---- shutdown: the mirror image ----
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;                           // double-SIGTERM guard
  shuttingDown = true;
  health.markDraining();                              // readiness fails first
  const hardExit = setTimeout(() => process.exit(1), 10_000);
  hardExit.unref();                                   // watchdog, not a hostage

  server.close(async () => {                          // stop accepting; drain
    await pool.end();                                 // then close dependencies
    process.exitCode = 0;                             // let the loop drain, no exit()
  });
  server.closeIdleConnections();                      // kick keep-alive sockets
  setTimeout(() => server.closeAllConnections(), 8_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => { throw err; });
process.on('uncaughtException', (err) => {            // log and exit — never linger
  console.error(err);
  process.exit(1);
});
```

## What to notice

- **`server.on('error')` is where listen failures arrive.** The listen
  callback is a `'listening'` listener and receives no error — `EADDRINUSE`
  without the error handler is an unhandled event and a crash with a worse
  message.
- **Readiness ≠ listening.** `markReady()` runs after `listen` succeeds, and
  `markDraining()` runs *first* in shutdown so the load balancer stops
  routing before the server stops accepting — the ordering that makes
  rolling deploys dropless
  ([zero-downtime concept](../../../nodejs/pages/phase-11-deployment/07-zero-downtime-deploys.md)).
- **The watchdog is `unref`'d.** It guarantees exit within 10 s without
  keeping the process alive to run itself; `process.exitCode` instead of
  `process.exit()` in the happy path lets in-flight work finish writing.
- **`closeIdleConnections` plus a delayed `closeAllConnections`** — idle
  keep-alive sockets would otherwise hold `server.close()` open for minutes;
  the 8-second `closeAll` is the escalation for connections that stay busy
  past the drain budget.
- **The worker's `main()` is the same file minus `server`** — config, migrate
  (it waits on the same advisory lock, so racing the API is safe), pool,
  then the relay loop (chapter 04) instead of `listen`. One boot discipline,
  two processes — the phase gate's "same code base" requirement.

## Gotchas

- **Symptom:** deploys drop a handful of requests despite graceful shutdown.
  **Cause:** readiness kept passing during the drain — the balancer routed
  new traffic into a closing server. **Fix:** `markDraining()` before
  `server.close()`, and the balancer's probe interval budgeted inside the
  watchdog window (10 s here covers a 5 s probe twice).
- **Symptom:** the process exits 0 while requests were mid-flight. **Cause:**
  `process.exit(0)` inside the close callback — exit() preempts pending I/O.
  **Fix:** `process.exitCode = 0` and let the loop drain naturally; exit()
  is reserved for the watchdog and fatal paths.
- **Symptom:** locally `ctrl-C` works; in the container the process takes the
  full grace period then dies hard. **Cause:** the signal never reached
  Node — `npm start` as PID 1 swallows it. **Fix:** exec-form `CMD ["node",
  "src/server.js"]`; the
  [PID 1 concept page](../../../nodejs/pages/phase-11-deployment/04-pid1-and-signals.md)
  owns the details.
- **Symptom:** boot hangs forever with no error. **Cause:** step 2 waiting on
  the migration advisory lock — another instance is migrating, or a dead
  session's lock is held by a live-but-stuck connection. **Fix:** that wait
  is *correct* for the racing-deploy case; the log line before `migrate()`
  (add one) makes the wait visible, and Phase 1's migration gotcha covers
  diagnosing a stuck holder.

## Interview questions

1. **★ Why must readiness fail before the server closes, not when it
   closes?** Load balancers poll readiness on an interval — they route on
   *stale* information. Failing readiness first spends one probe interval
   telling everyone "stop sending", so by the time `close()` runs, nothing
   new is arriving. Close-then-drain without that window races the
   balancer's view and loses.
2. **★ Why validate env with a schema instead of reading `process.env`
   ad hoc?** Ad-hoc reads fail one at a time, at first use, possibly hours
   in, with `undefined` semantics. A schema fails at boot, lists *every*
   problem at once, coerces types in one place (`PORT` as a number), and
   doubles as the documentation of what the process needs. Config errors
   should be the cheapest errors you have.
3. **Why `select 1` after creating the pool?** `new Pool()` connects
   lazily — it succeeds unconditionally. The probe query forces one real
   connection, so "database unreachable" fails the boot (step order!) rather
   than the first user request.
4. **Why is the hard-exit watchdog `unref`'d?** A ref'd timer would itself
   keep the event loop alive — the process could end up alive *only* to run
   its own kill switch. `unref` means: if everything drains cleanly first,
   the loop empties and the process exits without the watchdog ever firing.
5. **What runs differently in the worker's boot?** Nothing before the last
   step — same config, same migrate-wait, same pool, same signal handling.
   It swaps `listen`+readiness for the relay loop and its shutdown closes
   the loop before the pool. The symmetry is the point: one set of boot
   invariants, learned once, applied to every process the app grows.

---

Next → **The data layer over raw `pg`** *(not written yet)* ·
Phase index: [Phase 2 — Node services](README.md)
