---
title: "WASI — WebAssembly system interface"
sidebar_label: "07 · WASI"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `process.versions.uvwasi` reports **0.0.23**.
> WASI APIs evolve; check current `node:wasi` docs before shipping.

**WASI is a system interface for Wasm modules — portable "syscalls" for files, clocks,
and similar, so Wasm can do more than pure compute. Node exposes WASI support for
running compatible modules with host-configured preopens and env.**

## Where it sits

```text
Wasm module  →  WASI imports  →  Node host (uvwasi)  →  real OS
```

`uvwasi` version on this runtime: **0.0.23** (via `process.versions.uvwasi`).

## When you care

| Use | Note |
|---|---|
| Run Wasm tools that expect WASI | Compilers, filters, CLIs compiled to Wasm |
| Capability-oriented FS access | Preopen only certain directories |
| Portable plugins | Same module across hosts implementing WASI |

Ordinary REST APIs rarely need WASI day to day. Plugin ecosystems and edge-adjacent
tooling do.

## Mental model for security

WASI is **not** "safe because Wasm". The host chooses which directories and env vars
the guest sees. Misconfigured preopens are data exposure. Same discipline as exposing
imports to Wasm ([page 02](./02-webassembly.md)).

```js
// pseudo-code — API surface moves across Node versions
// import {WASI} from 'node:wasi';
// const wasi = new WASI({version: 'preview1', args, env, preopens: {'/sandbox': '/tmp/sb'}});
// instantiate module with wasi.getImportObject(); wasi.start(instance);
```

Label real code with current docs when you implement — this page teaches the concept.

## Gotchas

**Symptom:** Module expects WASI preview N, host speaks another
**Cause:** Preview versions differ
**Fix:** Align toolchain and Node WASI version options

**Symptom:** Guest writes outside the sandbox you imagined
**Cause:** Preopen mapped too broadly (`/` → host root)
**Fix:** Minimal preopens; read-only where possible

**Symptom:** Performance worse than native CLI
**Cause:** Wasm + WASI trap overhead
**Fix:** Accept portability trade-off or run native for hot paths

## Interview questions

**★ What is WASI?**
A portable system interface for WebAssembly modules (files, clocks, etc.) mediated by
the host.

**How does Node participate?**
Provides WASI implementation (uvwasi under the hood) so Wasm guests can run with
configured capabilities.

**Is WASI a full OS?**
No — a limited, host-gated interface.

**Why configure preopens carefully?**
They map guest paths to host directories — overly broad maps leak or overwrite data.

**When does a fullstack Node API need WASI?**
Uncommon — plugin/tooling scenarios more than CRUD services.

---

← Prev: [FFI](./06-ffi.md) · Next → [Custom loaders](./08-custom-loaders.md)
