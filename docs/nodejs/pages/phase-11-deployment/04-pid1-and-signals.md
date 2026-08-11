---
title: "PID 1 and signal handling — why npm start swallows SIGTERM"
sidebar_label: "04 · PID 1 and signals"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** signal behaviour; container PID 1 rules are
> platform-level and match Kubernetes / Docker practice.

**In a container, PID 1 is special: it must reap zombies and forward signals. If your
PID 1 is a shell or `npm` that never passes `SIGTERM` to Node, every deploy becomes a
hard kill after the grace period — dropped requests, stuck queue jobs, no cleanup.**

## What orchestrators send

On pod stop / `docker stop`:

1. **`SIGTERM`** to PID 1  
2. Wait `terminationGracePeriodSeconds` (often 30s)  
3. **`SIGKILL`** if still alive  

Your process must treat `SIGTERM` as "drain and exit"
([Phase 5](../phase-5-http-processes/16-signals.md),
[Phase 7](../phase-7-background-work/11-graceful-shutdown.md)).

## Why `npm start` is a trap

```dockerfile
# shell / npm as PID 1 — signals often stop here
CMD npm start
```

`npm` spawns `node` as a **child**. Depending on version and platform, `SIGTERM` may
not reach Node cleanly. The orchestrator then `SIGKILL`s the tree after the grace
period. Graceful shutdown handlers never run.

```dockerfile
# Node is PID 1
CMD ["node", "dist/server.js"]
```

```json
// package.json — scripts are fine for local dev
{
  "scripts": {
    "start": "node dist/server.js"
  }
}
```

Use the script on your laptop. In the image, **exec Node directly**.

## Minimal signal wiring

```js
import process from 'node:process';

async function shutdown(signal) {
  console.log(JSON.stringify({msg: 'shutdown', signal}));
  markNotReady();
  await closeServer();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error(err);
    process.exit(1);
  });
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error(err);
    process.exit(1);
  });
});
```

## tini / dumb-init

If you must use a shell wrapper, run under a tiny init (`tini -g -- node ...`) so PID 1
reaps and forwards signals. Prefer avoiding the wrapper by using exec-form Node.

## Gotchas

**Symptom:** Deploy always waits full 30s then kills
**Cause:** No `SIGTERM` handler or handler never runs (wrong PID 1)
**Fix:** Exec-form `node`; register `SIGTERM`; close server within grace period

**Symptom:** Works with Ctrl+C locally, not in Kubernetes
**Cause:** Local `SIGINT` vs cluster `SIGTERM`; or npm PID 1 in the image only
**Fix:** Handle both; fix container CMD

**Symptom:** Zombie processes in the container
**Cause:** Node spawned children and is not a proper init
**Fix:** Do not spawn careless children; use an init process if you must

**Symptom:** Jobs duplicated every deploy
**Cause:** Worker killed mid-job without `worker.close()`
**Fix:** Phase 7 graceful worker shutdown — same signal story

## Interview questions

**★ Why is `CMD npm start` dangerous in Docker?**
`npm` is often PID 1 and may not forward `SIGTERM` to Node, so graceful shutdown never
runs and the orchestrator eventually `SIGKILL`s the process.

**★ What signal does Kubernetes send on pod shutdown?**
`SIGTERM`, then `SIGKILL` after the termination grace period.

**What should a Node server do on SIGTERM?**
Fail readiness, stop accepting connections, finish in-flight work, close pools, exit 0.

**When do you need tini?**
When PID 1 is not your app and you need reaping/forwarding — better to make Node PID 1.

**How does this relate to readiness probes?**
Drain starts by failing readiness so new traffic stops before the process exits.

---

← Prev: [Dockerizing Node](./03-dockerizing-node.md) · Next → [Environment parity](./05-environment-parity.md)
