---
title: "Node-API (N-API) and node-addon-api"
sidebar_label: "04 · Node-API"
sidebar_position: 4
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `process.versions.napi` reports **10**.
> Addon compile matrices depend on your OS toolchain
> {/* VERIFY: smoke-build a trivial node-addon-api hello with pinned versions if required */}.

**Node-API is the stable C ABI for native addons. You write against N-API (or the C++
wrappers in `node-addon-api`) so a binary built for a given Node ABI range keeps working
across Node major upgrades more often than historical NAN/V8-bound addons.**

## Why it exists

Early addons called V8 APIs directly. **Every Node major** could break them. Node-API
sits between your C/C++ and the runtime:

```text
Your C++  →  Node-API  →  Node / V8
```

`process.versions.napi` on this machine: **10**.

## node-addon-api

C++ headers that make Node-API less error-prone (types, maybe-unwrap, etc.):

```cpp
// pseudo-code — not compiled in this handbook
// #include <napi.h>
// Napi::String Method(const Napi::CallbackInfo& info) {
//   return Napi::String::New(info.Env(), "hello");
// }
```

Build with `node-gyp` / `cmake-js` and ship prebuilds per platform when you can
(`prebuildify`, `prebuild`).

## When you need an addon

| Need | Addon? |
|---|---|
| Wrap an existing C library | Often yes |
| Extreme CPU in a hot loop | Maybe — try Wasm/workers first |
| Use a syscalls Node does not expose | Yes, carefully |
| Ordinary I/O and HTTP | **No** |

## Operational cost

- CI matrix: OS × arch × Node  
- Memory safety bugs are process-wide  
- Async work must not block the event loop — use async worker patterns  

## Gotchas

**Symptom:** Works on laptop, fails in Alpine CI
**Cause:** glibc vs musl prebuilds ([Phase 11](../phase-11-deployment/09-image-size-hardening.md))
**Fix:** Build on matching libc; publish musl prebuilds

**Symptom:** Breaks on every Node major anyway
**Cause:** Used unstable V8 APIs beside Node-API
**Fix:** Stay on Node-API surface only

**Symptom:** Event loop freezes in native code
**Cause:** Long sync work on the main thread
**Fix:** `AsyncWorker` / thread pool patterns; or offload

## Interview questions

**★ What problem does Node-API solve?**
A stable ABI for native addons so they are less tied to V8 churn across Node versions.

**What is node-addon-api?**
C++ wrappers over Node-API for safer, more ergonomic addon code.

**When should a fullstack app author write an addon?**
Rarely — when wrapping native libraries or proven hotspots; not for routine business logic.

**What does process.versions.napi tell you?**
The Node-API version supported by that runtime (here, 10 on Node 24.19.0).

**Why are prebuilds important?**
Users and CI may lack compilers; shipping binaries per platform avoids local builds.

---

← Prev: [V8 flags](./03-v8-flags.md) · Next → [C++ addons](./05-cpp-addons.md)
