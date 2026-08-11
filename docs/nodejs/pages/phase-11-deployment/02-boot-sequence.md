---
title: "Boot sequence — validate, connect, listen, ready"
sidebar_label: "02 · Boot sequence"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Order is the contract; a wrong order accepts
> traffic before dependencies exist.

**Validate env → connect dependencies → start listening → report ready. Any other order
accepts requests the process cannot serve, or fails half-way with sockets already open.**

## The order

```js
// pseudo-code — main entry
import {config} from './config.mjs';          // 1. throws if env invalid
import {createPool} from './db.mjs';
import {createServer} from './server.mjs';

const pool = await createPool(config.databaseUrl);  // 2. fail before listen
const server = createServer({pool});

await new Promise((resolve, reject) => {
  server.listen(config.port, (err) => (err ? reject(err) : resolve()));
});                                                     // 3. bind port

// 4. only now flip readiness (Phase 10 health checks)
markReady();
console.log(JSON.stringify({msg: 'listening', port: config.port}));
```

| Step | If you skip it |
|---|---|
| Validate env | Cryptic driver errors; wrong host |
| Connect deps | 500s on every request until reconnect luck |
| Listen | Nothing to route to — fine. Listening early is the bug |
| Ready true | Load balancer sends traffic during connect |

## Parallelism that is safe

Independent connects can run together:

```js
const [pool, redis] = await Promise.all([
  createPool(config.databaseUrl),
  createRedis(config.redisUrl),
]);
```

Do **not** mark ready until **all** required deps succeed. Optional deps (analytics)
can degrade without blocking ready — say so in metrics.

## Shutdown is the reverse

`SIGTERM` → fail readiness → drain → close server → close pools → exit. That is
[Phase 5](../phase-5-http-processes/17-graceful-shutdown.md) and
[Phase 7](../phase-7-background-work/11-graceful-shutdown.md) for workers. Boot and
shutdown are one lifecycle.

## Gotchas

**Symptom:** First 30 seconds after deploy are all 500s
**Cause:** Ready/liveness true while pool still connecting
**Fix:** Ready only after successful connect + listen

**Symptom:** Port in use on restart
**Cause:** Previous process not drained; two listeners
**Fix:** Graceful shutdown; one process per container

**Symptom:** Config import has side effects that open DB
**Cause:** Module top-level `await connect()`
**Fix:** Explicit `main()` so tests can import without booting

**Symptom:** Health endpoint up, app routes not registered
**Cause:** Listen before routes mounted
**Fix:** Build the full app graph, then listen

## Interview questions

**★ Correct boot order for a Node API?**
Validate config, connect dependencies, listen, then report ready.

**Why not listen first?**
The port accepts connections before the process can answer correctly.

**Can you connect to Redis and Postgres in parallel?**
Yes, if both are required before ready; use `Promise.all` and fail if either rejects.

**How does this interact with Kubernetes readiness?**
Readiness probe should stay false until step 4 completes
([Phase 10](../phase-10-observability/10-health-checks.md)).

**What closes first on SIGTERM?**
New traffic (readiness), then in-flight HTTP, then dependency clients.

---

← Prev: [12-factor config](./01-twelve-factor-config.md) · Next → [Dockerizing Node](./03-dockerizing-node.md)
