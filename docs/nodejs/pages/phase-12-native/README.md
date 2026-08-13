---
title: "Phase 12 — Native and advanced"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Measured on **Node 24.19.0** where noted (`napi` **10**, `uvwasi` **0.0.23**, `vm`
> breakout demo). Optional phase — reach for it when the problem demands it.

**Knowing these exist changes which problems you consider solvable. Most fullstack
days never open this folder — until they do.**

## Pages

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[node:vm](./01-node-vm.md)** | <span className="db-tier t-know">Know</span> | Contexts are not a security sandbox — breakout measured |
| 02 | **[WebAssembly](./02-webassembly.md)** | <span className="db-tier t-know">Know</span> | Portable CPU kernels after a profile says so |
| 03 | **[V8 flags](./03-v8-flags.md)** | <span className="db-tier t-know">Know</span> | Mostly diagnostics; `max-old-space-size` is the common dial |
| 04 | **[Node-API](./04-node-api.md)** | <span className="db-tier t-when">When Needed</span> | Stable ABI for native addons (`napi` 10 here) |
| 05 | **[C++ addons](./05-cpp-addons.md)** | <span className="db-tier t-when">When Needed</span> | Addon vs embedder; segfaults kill the process |
| 06 | **[FFI](./06-ffi.md)** | <span className="db-tier t-when">When Needed</span> | Call C without a full addon — types are load-bearing |
| 07 | **[WASI](./07-wasi.md)** | <span className="db-tier t-when">When Needed</span> | System interface for Wasm guests (`uvwasi`) |
| 08 | **[Custom loaders](./08-custom-loaders.md)** | <span className="db-tier t-when">When Needed</span> | Resolve/load hooks for tooling, not prod defaults |
| 09 | **[Startup snapshots](./09-startup-snapshots.md)** | <span className="db-tier t-when">When Needed</span> | Freeze bootstrap heap for short-lived processes |
| 10 | **[Contributing to Node](./10-contributing-to-node.md)** | <span className="db-tier t-when">When Needed</span> | How core PRs work when you truly need one |

## Where this connects

- **[Phase 1](../phase-1-modules/README.md)** — resolution and `node:module`  
- **[Phase 5](../phase-5-http-processes/README.md)** — worker threads, SEA  
- **[Phase 10](../phase-10-observability/README.md)** — profiles before native rewrites  
- **[Phase 11](../phase-11-deployment/README.md)** — shipping native addons in images  
