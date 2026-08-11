---
title: "Startup time — compile cache, snapshots, lazy requires"
sidebar_label: "23 · Startup time"
sidebar_position: 23
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `module.enableCompileCache()` status and
> directory layout under `/tmp`.

**Startup time is cold-start and deploy latency — how long until the process can pass
readiness. Optimize it when you scale to zero, restart often, or ship huge dependency
graphs; ignore it when a long-lived API pod starts once a week.**

## Measure first

```js
// earliest line in main
const bootStarted = performance.now();

// after listen + ready
console.log('ready_ms', +(performance.now() - bootStarted).toFixed(1));
```

Break into phases: load config → import routes → connect DB → listen. Otherwise you
will "optimize imports" when DNS to Postgres was 80% of the wait.

## enableCompileCache

Node can cache compilation results on disk so subsequent boots skip recompiling the
same source.

```js
import {enableCompileCache, getCompileCacheDir} from 'node:module';

console.log(enableCompileCache());
// { status: 1, directory: '/tmp/node-compile-cache' }
console.log(getCompileCacheDir());
// /tmp/node-compile-cache/v24.19.0-x64-<hash>-...
```

Measured on Node 24.19.0: **status 1** (enabled), directory under
**`/tmp/node-compile-cache`**, with a **version + arch + hash** subfolder.

**Containers that wipe `/tmp` every start get no cross-restart benefit** unless you
mount a persistent cache volume or set the cache directory to a durable path (see
Node docs for env/dir configuration on your version).

## Lazy imports

```js
// eager — pays cost at boot even if the route is rare
import {renderPdf} from './pdf.js';

// lazy — pays on first use
async function handlePdf(req, res) {
  const {renderPdf} = await import('./pdf.js');
  // …
}
```

Lazy helps **cold start** and rarely-used admin tools. It hurts the **first request**
that needs the module — measure both if you care about p99 after deploy.

## V8 snapshots / SEA (pointers)

Embedding a V8 startup snapshot or shipping a single executable can cut boot for
CLI-shaped tools. That machinery is deeper than this page — Phase 12 and SEA notes
in the filesystem phase cover native/shipping angles. For a normal HTTP API,
**compile cache + fewer eager imports + faster dependency connects** are the usual wins.

## What actually dominates API boot

| Cost | Typical fix |
|---|---|
| Importing half of `node_modules` | Lazy routes; split entrypoints |
| DB/Redis connect | Parallelize independent connects; timeouts |
| Secret managers / remote config | Cache at platform layer; fail fast |
| TypeScript on the fly | Ship compiled JS in production images |

## Gotchas

**Symptom:** Compile cache "on" but every pod still cold
**Cause:** Cache dir on ephemeral `/tmp` with no volume
**Fix:** Persist the cache directory across restarts or accept one-time cost

**Symptom:** First request after deploy is a huge spike
**Cause:** Lazy `import()` on the hot path
**Fix:** Eager-import the hot path; lazy only the cold corners

**Symptom:** Boot optimization theater while readiness waits on DB
**Cause:** Measured import time only
**Fix:** Time the full ready path including dependencies ([page 10](./10-health-checks.md))

**Symptom:** Different Node versions share a cache folder and misbehave
**Cause:** Cache keys include version — usually safe — but hand-copied dirs can confuse
**Fix:** Let Node manage the versioned subdirectory; do not mix hand-built trees

## Interview questions

**★ When does Node startup time matter for fullstack APIs?**
Frequent restarts, autoscaling from zero, serverless-style platforms, or large
monoliths with heavy import graphs — not every long-lived pod.

**What does `enableCompileCache()` do?**
Persists compilation artifacts so later process starts can reuse them instead of
recompiling from source.

**Why might compile cache not help in Kubernetes?**
If the cache lives on emptyDir/`/tmp` that disappears every container start.

**Eager vs lazy import trade-off?**
Eager slows boot, speeds first request. Lazy speeds boot, moves cost to first use.

**What should you measure before optimizing boot?**
Time to **readiness** broken into phases — not only `node -e 'import("./app.js")'`.

---

← Prev: [Flame graphs](./22-flame-graphs.md) · Phase index: [Observability and performance](./README.md)
