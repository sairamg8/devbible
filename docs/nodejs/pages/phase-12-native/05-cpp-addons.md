---
title: "C++ addons and the embedder API"
sidebar_label: "05 · C++ addons"
sidebar_position: 5
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08. Conceptual map for **Node 24**; prefer Node-API over raw V8 for
> new addons unless you are embedding Node itself.

**A C++ addon is a shared library Node loads into the process. The embedder API is the
opposite direction: your C++ program hosts Node/V8. Most application teams only ever
touch addons — and should use Node-API when they do.**

## Addon lifecycle (application view)

1. Write C/C++ with Node-API  
2. `binding.gyp` / CMake describes the build  
3. `node-gyp rebuild` produces `.node`  
4. `require('./build/Release/addon.node')` loads it  

```js
// pseudo-code
// import addon from './build/Release/addon.node';
// console.log(addon.hello());
```

Crashes inside the addon **take down the whole Node process** — no try/catch will save
you from a segfault.

## Embedder API (host Node in C++)

Products that ship a custom runtime (editors, game engines, edge devices) link Node as
a library and drive it from C++. That is a different career path from fullstack APIs:

- You own startup, event loop pumping, and shutdown  
- Version upgrades are yours end-to-end  
- Security surface includes everything you expose to scripts  

If you are building a normal HTTP service, you are **not** embedding — you are
consuming Node as the host.

## Historical layers (recognition only)

| Layer | Note |
|---|---|
| NAN | Older helpers around V8 — maintenance burden |
| Raw V8 | Breaks across majors easily |
| **Node-API** | Preferred stable path ([page 04](./04-node-api.md)) |

## Gotchas

**Symptom:** Segfault only in production
**Cause:** Native race or ABI mismatch
**Fix:** Match build target; ASAN builds in CI; reduce native surface

**Symptom:** `invalid ELF header` / wrong arch
**Cause:** Checked in `.node` for another platform
**Fix:** Build on target or use prebuild multi-arch

**Symptom:** Blocking HTTP under native calls
**Cause:** Sync C++ on the main thread
**Fix:** Async workers; release the lock patterns Node-API documents

## Interview questions

**★ Addon vs embedder — which way does the dependency point?**
Addon: Node loads your library. Embedder: your binary hosts Node.

**Why can try/catch not handle addon crashes?**
Native memory corruption and signals abort the process outside JS exception handling.

**What should new addons target?**
Node-API (optionally via node-addon-api), not raw V8.

**Who needs the embedder API?**
Authors of custom runtimes, not typical MERN/PERN API developers.

**What file extension do compiled addons use?**
`.node` (a platform shared library).

---

← Prev: [Node-API](./04-node-api.md) · Next → [FFI](./06-ffi.md)
