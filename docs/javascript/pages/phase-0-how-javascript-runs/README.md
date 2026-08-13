---
title: "Phase 0 — How JavaScript runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6.233.17, ICU 78.3, Unicode 17.0).
> Scripts in `sandbox/js-p0/`.

**The mental model everything else hangs off.** Twelve topics, deliberately
short — but skipping them is why hoisting looks like a list of arbitrary rules
and why "JavaScript is weird" is a sentence people say.

The single idea that makes the rest of this phase click: **the engine reads your
whole file before it runs any of it.** Every behaviour below follows from that.

## Pages

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | **[The engine, the runtime and the spec](./01-engine-runtime-spec.md)** | <span className="db-tier t-master">Master</span> | Why `document` is not JavaScript, and what actually is |
| 02 | **[Parse, compile, execute](./02-parse-compile-execute.md)** | <span className="db-tier t-understand">Understand</span> | Hoisting as a consequence, not a rule |
| 03 | **[Execution contexts and the call stack](./03-call-stack.md)** | <span className="db-tier t-master">Master</span> | Reading a stack trace; the 12 524-frame ceiling |
| 04 | **[Strict mode](./04-strict-mode.md)** | <span className="db-tier t-master">Master</span> | Six silent failures turned into errors |
| 05 | **[What "JavaScript" means today](./05-ecmascript-and-tc39.md)** | <span className="db-tier t-understand">Understand</span> | Target features, never years |
| 06 | **[The hosts you write for](./06-hosts-and-globals.md)** | <span className="db-tier t-understand">Understand</span> | Which globals exist where, measured |
| 07 | **[Loading scripts](./07-loading-scripts.md)** | <span className="db-tier t-understand">Understand</span> | `defer` vs `async` vs `type="module"` |
| 08 | **[Running and inspecting code](./08-running-and-inspecting.md)** | <span className="db-tier t-understand">Understand</span> | The tools that replace `console.log` |
| 09 | **[Transpilation and polyfills](./09-transpilation-polyfills.md)** | <span className="db-tier t-know">Know</span> | What "supported" actually means |
| 10 | **[Feature detection](./10-feature-detection.md)** | <span className="db-tier t-know">Know</span> | Never sniff the user agent |
| 11 | **[The JIT in one page](./11-the-jit.md)** | <span className="db-tier t-know">Know</span> | A measured deopt, and why benchmarks lie |
| 12 | **[Reading the specification](./12-reading-the-spec.md)** | <span className="db-tier t-when">When Needed</span> | The rare day it settles an argument |

## Phase gate

**Move on when** you can look at
`document.querySelector('a').addEventListener('click', fn)` and say which parts
are the language and which are the host — without hesitating — and explain why a
`SyntaxError` on line 90 stops line 1 from running.

## Where this connects

- **→ [Phase 1 (values and coercion)](../../syllabus/01-language-core.md)** —
  the type system sits directly on top of this.
- **→ Phase 3 (functions)** — hoisting and the TDZ are introduced here and
  finished there, with closures.
- **→ Phase 7 (async)** — the call stack here is one half of the event loop;
  the queues are the other half.
- **→ Node.js Phase 0** — the same runtime question answered from the server
  side. That page owns libuv, the thread pool and the process model; this one
  owns the language/host boundary.

---

Start → [01 · The engine, the runtime and the spec](./01-engine-runtime-spec.md)
