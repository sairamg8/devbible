---
title: "Phase 0 — The runtime model"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0**, and every API
> used is available there. Node 26 is Current and becomes LTS in October 2026;
> until then it is what you read about, not what you build on.

The mental model everything else hangs off. Every "Node is weird" complaint —
why one slow route breaks the whole server, why `__dirname` is missing, why a
file read is slower when the API is busy — traces back to skipping this phase.

Ten pages, in order. The first three are the load-bearing ones.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Node.js is](01-what-node-is.md)** | <span className="db-tier t-master">Master</span> | V8 runs the JavaScript, libuv does the waiting, bindings connect them to the OS |
| 02 | **[One thread, many I/O](02-single-thread-and-io.md)** | <span className="db-tier t-master">Master</span> | Your code runs on one thread; the waiting happens elsewhere, in parallel |
| 03 | **[Blocking the event loop](03-blocking-the-event-loop.md)** | <span className="db-tier t-master">Master</span> | One slow function does not slow one request — it slows every request |
| 04 | **[The libuv thread pool](04-libuv-thread-pool.md)** | <span className="db-tier t-understand">Understand</span> | Four threads for files, DNS lookups, crypto and zlib — and why sockets never touch them |
| 05 | **[Node vs the browser](05-node-vs-browser.md)** | <span className="db-tier t-understand">Understand</span> | Same language, different host: no DOM, no sandbox, and a large shared standard surface |
| 06 | **[Globals worth knowing](06-globals.md)** | <span className="db-tier t-master">Master</span> | `process`, `globalThis`, `Buffer`, and the two ways to ask where a file lives |
| 07 | **[Choosing a version](07-choosing-a-version.md)** | <span className="db-tier t-understand">Understand</span> | Active LTS in production, the end of the odd/even rule, pinning the version in the repo |
| 08 | **[Running node](08-running-node.md)** | <span className="db-tier t-know">Know</span> | Flag order, `NODE_OPTIONS`, and the built-ins that replaced `nodemon` and `dotenv` |
| 09 | **[Node vs Deno vs Bun](09-node-deno-bun.md)** | <span className="db-tier t-know">Know</span> | Honest comparison, and why ecosystem still beats benchmarks |
| 10 | **[How V8 optimizes JavaScript](10-how-v8-optimizes.md)** | <span className="db-tier t-when">When Needed</span> | Ignition to TurboFan, hidden classes, deopt — and why it is last on the list |

## Coverage

The syllabus lists thirteen topics for this phase. Three pairs are merged
because you would never read one without the other; nothing is dropped.

| Syllabus topic | Page |
|---|---|
| What Node.js is: V8 + libuv + C++ bindings + stdlib | 01 |
| Single-threaded execution vs multi-threaded I/O | 02 |
| Blocking the event loop | 03 |
| The libuv thread pool and `UV_THREADPOOL_SIZE` | 04 |
| Node vs browser | 05 |
| Globals: `process`, `globalThis`, `Buffer`, `__dirname` vs `import.meta` | 06 |
| Version management: nvm / fnm / volta, `.nvmrc`, `engines` | 07 |
| Release model and choosing an LTS | 07 |
| Dev-loop flags: `--watch`, `--env-file` | 08 |
| CLI flags and `NODE_OPTIONS` | 08 |
| The REPL, `node --eval`, `node --print` | 08 |
| Node vs Deno vs Bun | 09 |
| How V8 compiles and optimizes JS | 10 |

## Phase gate

Move on to Phase 1 when you can explain out loud **why a `for` loop blocking for
3 seconds stalls every incoming request, but a 3-second database query does
not** — and name three ways to fix the first one.

If that sentence is not comfortable yet, reread pages 02 and 03. Everything in
Phase 2 assumes it.

## Where this connects

- **Phase 1 — Modules** picks up `import.meta`, the `node:` prefix, and
  `package.json` in depth.
- **Phase 2 — Async** takes the event loop apart phase by phase. Page 03 here is
  the symptom; Phase 2 is the mechanism.
- **Phase 5 — Processes** covers `worker_threads` and `cluster`, the real fixes
  for CPU-bound work.
- **Phase 10 — Observability** turns the event-loop delay metric from page 03
  into an alert.

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [What Node.js is](01-what-node-is.md)
