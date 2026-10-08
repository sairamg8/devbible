---
title: "FFI — calling native libraries without a full addon"
sidebar_label: "06 · FFI"
sidebar_position: 6
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-10-08 against [`node:ffi`](https://nodejs.org/api/ffi.html) and the [Node 26 changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md). On Node 24.19.0 FFI is package-mediated; pin a library before production
> use {/* VERIFY: pin koffi or node-ffi-napi version if the team standardises */}.
>
> **Scope:** that holds for Node 24. Node 26.1.0 added a built-in `node:ffi` module, documented as *"[Stability: 1](https://nodejs.org/api/documentation.html#stability-index) - Experimental"*. It was gated behind `--experimental-ffi` at 26.1.0 (*"The API is gated behind the `--experimental-ffi` flag and, when the Permission Model is enabled, requires `--allow-ffi`."*) and the 26.9.0 changelog lists *"**ffi**: enable module by default"*; the docs now say *"It can be disabled with the `--no-experimental-ffi` flag."* This page does not teach the `node:ffi` API; read its docs before using it.

**Foreign Function Interface (FFI) bindings let JavaScript call C functions in an
existing shared library without writing a dedicated Node addon. You trade build
complexity for runtime binding risk — wrong types corrupt memory.**

## When FFI fits

| Fit | Example |
|---|---|
| Existing `.so` / `.dll` / `.dylib` you do not want to wrap in N-API yet | Proprietary vendor SDK |
| Prototyping a native call | Spike before committing to an addon |
| Few functions, stable C ABI | Simple compress/hash from system lib |

| Poor fit | Why |
|---|---|
| Complex C++ APIs with overloads | FFI loves C ABIs |
| Hot path millions of calls/sec | Boundary costs; prefer a real addon/Wasm |
| Untrusted library paths | Loading arbitrary `.so` is code execution |

## Shape (conceptual)

```js
// pseudo-code — API differs by FFI package
// const lib = ffi.load('libm.so.6');
// const cos = lib.func('double cos(double)');
// console.log(cos(0));
```

You declare **argument and return types**. A wrong declaration is undefined behaviour
at the process level.

## FFI vs Node-API addon

| | FFI | Node-API addon |
|---|---|---|
| Ship | JS + system/vendor lib | Compiled `.node` + deps |
| Type safety | Runtime declarations | Compile-time C/C++ |
| Performance | Good enough for many wraps | Better for chatty APIs |
| Maintenance | Fewer build toolchains | Explicit ABI versioning |

## Gotchas

**Symptom:** Random crashes after "successful" calls
**Cause:** Wrong struct layout / pointer lifetime
**Fix:** Match headers exactly; keep buffers alive across the call

**Symptom:** Works on Ubuntu, fails on Alpine
**Cause:** Different library SONAMEs / musl
**Fix:** Platform-specific library paths; integration tests per base image

**Symptom:** Blocked event loop
**Cause:** Long FFI call on main thread
**Fix:** `worker_threads` or async offload

## Interview questions

**★ What is FFI in the Node context?**
Calling C ABI functions from JS via a binding library without a custom addon.

**Main risk of FFI?**
Incorrect type declarations cause native memory corruption.

**When prefer a real addon over FFI?**
Complex APIs, performance-critical chatty calls, or long-term ownership of the wrap.

**Is loading a shared library a security decision?**
Yes — it is executing native code in-process; trust the binary source.

**How do you keep the event loop free during heavy FFI?**
Do not run long calls on the main thread; use workers.

---

← Prev: [C++ addons](./05-cpp-addons.md) · Next → [WASI](./07-wasi.md)
