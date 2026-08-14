---
title: "Node.js — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24** — the Active LTS as of August 2026. Every example
> is executed on **24.19.0** before it is written down.

The explanations behind the [Node.js syllabus](../README.md). Phases are
sequential; the syllabus explains why the order is load-bearing.

import Progress from '@site/src/components/Progress';

<Progress lang="nodejs" />

## What each phase covers

| Phase | Covers |
|---|---|
| **[0 — The runtime model](./phase-0-runtime-model/README.md)** | V8 and libuv, one thread, blocking, the thread pool, globals, versions, the CLI |
| **[1 — Modules and packages](./phase-1-modules/README.md)** | ESM and CommonJS, interop, resolution, `package.json`, `exports`, semver, npm, publishing |
| **[2 — Async and the event loop](./phase-2-async/README.md)** | Loop phases, promises, cancellation, CPU-bound work |
| **[3 — Buffers and streams](./phase-3-buffers-streams/README.md)** | Bytes, encodings, backpressure, pipelines, transforms, zlib |
| **[4 — Filesystem, paths, URLs](./phase-4-filesystem/README.md)** | `fs/promises`, `path`, traversal, `URL`, handles, atomic writes |
| **[5 — Networking, HTTP, processes](./phase-5-http-processes/README.md)** | `node:http`, `fetch`, TLS, SSE, signals, graceful shutdown, `cluster`, workers |
| **[6 — Data access](./phase-6-data-access/README.md)** | Pooling, parameterized queries, `pg`, MongoDB, transactions, N+1, ORMs, Mongoose, migrations, replicas, cursors |
| **[7 — Background work and resilience](./phase-7-background-work/README.md)** | Queues, workers, idempotency, the outbox, scheduling, graceful shutdown, timeouts, backoff, concurrency limits |
| **[8 — Security](./phase-8-security/README.md)** | Passwords, sessions and JWT, OAuth, injection, XSS, SSRF, ReDoS, validation, secrets, TLS, crypto, rate limiting, headers, supply chain, permissions |
| **[9 — Testing](./phase-9-testing/README.md)** | `node:test`, `node:assert`, test boundaries, dependency injection, API tests, mocking, coverage, Testcontainers, contract testing |
| **[10 — Observability and performance](./phase-10-observability/README.md)** | Structured logs, correlation, OTel, lag, health, golden signals, caching, leaks, profiling |
| **[11 — Deployment and operations](./phase-11-deployment/README.md)** | Containers, config, process management, zero-downtime deploys, resource limits |
| **[12 — Native and advanced](./phase-12-native/README.md)** | N-API and addons, WASM, `vm`, V8 internals, the edges of the runtime |

All 13 phases are now written. The syllabus they follow starts at
[Part 1 — Foundations](../syllabus/01-foundations.md).

## Completeness

Audited 2026-08-14 (session `8679dc8c`):

| Check | Result |
|---|---|
| Syllabus topics covered | **248 of 248** — every row in all four syllabus parts |
| Phases written | **13 of 13** |
| Pages | **231** (232 files; topic 13 of Phase 3 is split into a chunk directory) |
| `> Verified:` line | **232 of 232 files** |
| Files over the 300-line cap | **0** |
| Broken links | **0** in a clean `yarn build` |

Six phases map two syllabus rows onto one page where you would never read one
without the other — Phase 0 does this three times, Phases 1, 3 and 4 twice each,
Phases 2 and 5 four times each. **Nothing is dropped**: each of those phase
READMEs carries a Coverage table naming every syllabus row and the page it
landed on.
