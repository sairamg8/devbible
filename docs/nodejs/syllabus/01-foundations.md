---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Phases 0–2 · Runtime model, modules, async and the event loop

This is the part that makes you *actually* good at Node, and the part most
courses skip in a rush to reach Express. Everything downstream assumes it.

---

## Phase 0 — The runtime model

The mental model everything else hangs off. Every "Node is weird" complaint traces
back to skipping this phase.

📖 **Explanation written:** [Phase 0 — The runtime model](../pages/phase-0-runtime-model/)

| Topic | Tier |
|---|---|
| What Node.js is: **V8** (executes JS) + **libuv** (event loop, async I/O) + C++ bindings + stdlib | <span className="db-tier t-master">Master</span> |
| Single-threaded execution vs. multi-threaded I/O — what "non-blocking" actually means | <span className="db-tier t-master">Master</span> |
| Blocking the event loop: recognizing it, and why one slow loop stalls every request | <span className="db-tier t-master">Master</span> |
| The **libuv thread pool** (default size 4) — what genuinely uses it: `fs`, `dns.lookup`, some `crypto`, `zlib`; tuning via `UV_THREADPOOL_SIZE` | <span className="db-tier t-understand">Understand</span> |
| Node vs. browser: no DOM, different module system, different globals | <span className="db-tier t-understand">Understand</span> |
| Globals: `process`, `globalThis`, `Buffer`, `__dirname`/`__filename` vs `import.meta.url`/`import.meta.dirname` | <span className="db-tier t-master">Master</span> |
| Version management: `nvm` / `fnm` / `volta`, `.nvmrc`, `engines` in `package.json` | <span className="db-tier t-understand">Understand</span> |
| Release model: one major each April, LTS each October from v27. Choosing an LTS for production | <span className="db-tier t-understand">Understand</span> |
| **Dev-loop flags**: `--watch` / `--watch-path` (stable) and `--env-file` (no longer experimental as of v24.10 / v22.21) — the built-in replacement for `nodemon` and `dotenv` | <span className="db-tier t-know">Know</span> |
| CLI flags and `NODE_OPTIONS` | <span className="db-tier t-know">Know</span> |
| The REPL, `node --eval`, `node --print` | <span className="db-tier t-know">Know</span> |
| Node vs. Deno vs. Bun — honest comparison, and why Node still wins on ecosystem | <span className="db-tier t-know">Know</span> |
| How V8 compiles and optimizes JS (Ignition, TurboFan, deopt) | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain out loud why a `for` loop blocking for
3 seconds stalls every incoming request, but a 3-second database query does not.

---

## Phase 1 — Modules and packages

📖 **Explanation written:** [Phase 1 — Modules and packages](../pages/phase-1-modules/)

| Topic | Tier |
|---|---|
| **ESM**: `import`/`export`, default vs named, top-level `await`, dynamic `import()` | <span className="db-tier t-master">Master</span> |
| **CommonJS**: `require`, `module.exports` vs `exports`, the module cache | <span className="db-tier t-master">Master</span> |
| The `node:` prefix for core modules — unambiguous, faster to resolve, unshadowable | <span className="db-tier t-master">Master</span> |
| `package.json` essentials: `type`, `main`, `scripts`, `engines`, `files` | <span className="db-tier t-master">Master</span> |
| **Semver** and dependency ranges — why `^` bites you, and lockfiles | <span className="db-tier t-master">Master</span> |
| npm basics: `install` vs `ci`, dependencies vs devDependencies, `npx` | <span className="db-tier t-master">Master</span> |
| **CJS ↔ ESM interop**: importing CJS from ESM, default-export gotchas, `createRequire` | <span className="db-tier t-understand">Understand</span> |
| **`exports` map**: conditional exports, subpath exports, encapsulation (blocking deep imports) | <span className="db-tier t-understand">Understand</span> |
| Module resolution algorithm: how Node walks `node_modules`, extension resolution differences between CJS and ESM | <span className="db-tier t-understand">Understand</span> |
| **TypeScript natively**: type stripping is **stable as of v24.12.0** (on by default since v23.6.0, warning-free since v24.3.0) — so it is stable on the Node 24 LTS target, not a Node 26 feature. Run `.ts` with no build step. `--experimental-transform-types` still required for `enum`, parameter properties, `namespace`. Type stripping skips `node_modules`. Node never type-checks — that stays `tsc --noEmit` | <span className="db-tier t-understand">Understand</span> |
| Circular dependencies: how they resolve in CJS vs ESM, and why they signal a design problem | <span className="db-tier t-understand">Understand</span> |
| pnpm vs npm vs yarn — the node_modules layout difference and why pnpm is stricter | <span className="db-tier t-know">Know</span> |
| Subpath **imports** (`#internal`) for private aliases | <span className="db-tier t-know">Know</span> |
| Workspaces / monorepos | <span className="db-tier t-know">Know</span> |
| Publishing: scoped packages, `npm pack`, provenance, dual CJS/ESM packages | <span className="db-tier t-know">Know</span> |
| `node:module` API: `module.register()`, customization hooks, `enableCompileCache()` | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** a package with a clean `exports` map that imports
correctly from both an ESM and a CJS consumer.

---

## Phase 2 — Async and the event loop

The heart of Node. Budget real time here — this phase is worth more than any
framework you will learn.

📖 **Explanation written:** [Phase 2 — Async and the event loop](../pages/phase-2-async/)

### The loop itself

| Topic | Tier |
|---|---|
| **Event loop phases** in order: timers → pending callbacks → idle/prepare → **poll** → check → close callbacks | <span className="db-tier t-master">Master</span> |
| The **poll phase** — where Node spends its time, and how it decides to block | <span className="db-tier t-master">Master</span> |
| **Microtasks vs macrotasks**: `process.nextTick` (drains fully, first) vs `queueMicrotask`/promises vs `setTimeout`/`setImmediate` | <span className="db-tier t-master">Master</span> |
| Call stack → task queue → microtask queue: the full execution picture | <span className="db-tier t-master">Master</span> |
| `setImmediate` vs `setTimeout(fn, 0)` — nondeterministic in the main module, deterministic inside an I/O callback | <span className="db-tier t-understand">Understand</span> |
| **`nextTick` starvation** — recursive `nextTick` blocks I/O forever | <span className="db-tier t-understand">Understand</span> |
| Timers: `setTimeout`, `setInterval`, `unref()`, `node:timers/promises` | <span className="db-tier t-understand">Understand</span> |

### Promises and async/await

| Topic | Tier |
|---|---|
| **`async`/`await`** — including that `await` yields to the microtask queue, not the event loop phase | <span className="db-tier t-master">Master</span> |
| Promise states, chaining, and why returning vs. not returning inside `.then` changes everything | <span className="db-tier t-master">Master</span> |
| **Combinators**: `Promise.all` / `allSettled` / `race` / `any` — and picking the right one | <span className="db-tier t-master">Master</span> |
| **Sequential vs parallel `await`** — the `for` loop that should have been `Promise.all` | <span className="db-tier t-master">Master</span> |
| Error handling: `try`/`catch` with `await`, and why `.catch()` placement matters | <span className="db-tier t-master">Master</span> |
| **Floating promises** — the un-awaited async call that silently swallows failures | <span className="db-tier t-master">Master</span> |
| The error-first callback convention; `util.promisify` and `util.callbackify` | <span className="db-tier t-understand">Understand</span> |
| **Concurrency control** — why unbounded `Promise.all` over 10,000 items is a self-inflicted outage; batching and pool patterns | <span className="db-tier t-understand">Understand</span> |
| `unhandledRejection` (fatal by default since v15) and `uncaughtException` | <span className="db-tier t-understand">Understand</span> |
| Error design: error codes, custom error classes, `error.cause`, `AggregateError` | <span className="db-tier t-understand">Understand</span> |
| Promise anti-patterns: the explicit-construction antipattern, nested `.then`, `async` executor | <span className="db-tier t-know">Know</span> |
| Async iterators and generators (`for await...of`) | <span className="db-tier t-know">Know</span> |

### Cancellation and context

| Topic | Tier |
|---|---|
| **`AbortController` / `AbortSignal`** — the standard cancellation primitive | <span className="db-tier t-master">Master</span> |
| `AbortSignal.timeout()` and `AbortSignal.any()`; threading a signal through your own APIs | <span className="db-tier t-understand">Understand</span> |
| **`AsyncLocalStorage`** — request-scoped context without prop-drilling. The practical answer to "how do I get a trace ID into every log line?" | <span className="db-tier t-understand">Understand</span> |
| `async_hooks` — low-level, mostly superseded by `AsyncLocalStorage` for app code | <span className="db-tier t-when">When Needed</span> |
| `AsyncResource` for correct context propagation in custom async primitives | <span className="db-tier t-when">When Needed</span> |

### CPU-bound work

| Topic | Tier |
|---|---|
| Recognizing CPU-bound work and why it doesn't belong on the main thread | <span className="db-tier t-master">Master</span> |
| Escape hatches: chunking with `setImmediate`, worker threads, offloading entirely (→ Phase 5) | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can hand-predict the output order of a script mixing
`process.nextTick`, `queueMicrotask`, a resolved promise, `setTimeout(…, 0)` and
`setImmediate` — and explain *why* each lands where it does.

---

← Index: [Node.js](../README.md) · Next → [Part 2 — Core I/O](02-core-io.md)
