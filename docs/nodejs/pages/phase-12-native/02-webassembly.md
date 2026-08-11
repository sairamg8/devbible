---
title: "WebAssembly in Node — CPU-bound work when it fits"
sidebar_label: "02 · WebAssembly"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `WebAssembly` global is present
> (`typeof WebAssembly === 'object'`).

**WebAssembly gives you near-native compute with a portable binary, without rewriting
the whole app in C++. Reach for it when a tight CPU loop dominates and JS (or a worker)
is still too slow — not as a default architecture.**

## When Wasm is the right answer

| Good fit | Poor fit |
|---|---|
| Codecs, crypto-ish math, parsers, image pipelines you control | Thin wrappers around syscalls |
| Shipping one artifact for many OS targets | Code that needs full Node APIs inside the module |
| Hot loop proven by a profile | Untested rewrite for fashion |

Always prove the hotspot with a CPU profile first
([Phase 10](../phase-10-observability/19-cpu-heap-profiling.md)).

## Loading in Node

```js
import fs from 'node:fs/promises';

const bytes = await fs.readFile(new URL('./add.wasm', import.meta.url));
const {instance} = await WebAssembly.instantiate(bytes, {
  // imports the module requires from the host
});
// const result = instance.exports.add(2, 40);
```

Build `.wasm` with Rust/C/AssemblyScript toolchains offline. Commit the artifact or
build it in CI — do not invent binary bytes in the handbook.

## Wasm vs worker_threads vs native addon

| Option | Strength | Cost |
|---|---|---|
| **worker_threads** | Keep JS; parallelise | Marshaling; still JS speed |
| **Wasm** | Portable speed for compute | Toolchain; limited host APIs |
| **N-API addon** | Full native power | Build matrix, ABI discipline |

Workers solve **parallelism on the event loop**. Wasm solves **faster compute inside a
sandbox-like module** (still not a security sandbox if you expose dangerous imports).

## Gotchas

**Symptom:** Wasm slower than JS
**Cause:** Boundary crossing every tiny call; poor algorithms
**Fix:** Batch work in linear memory; profile both sides

**Symptom:** Cannot use `fs` inside Wasm
**Cause:** No ambient Node — only imports you provide
**Fix:** Pass buffers in/out from JS

**Symptom:** Huge cold start
**Cause:** Large module compile
**Fix:** Cache module compile; smaller modules; streaming compile APIs where applicable

## Interview questions

**★ When would you use WebAssembly in a Node service?**
After profiling shows a CPU-bound kernel where portable native speed beats JS and a
full addon is heavier than you want.

**Does Wasm replace worker_threads?**
No — different problems. Workers give threads; Wasm gives faster sandboxed compute.

**How does Node load Wasm?**
`WebAssembly.instantiate` / `compile` on bytes (or streaming variants), plus imports.

**Is Wasm a security boundary for untrusted code?**
Only as strong as the imports you give it — design host functions carefully.

**What should you measure before adopting Wasm?**
That the hotspot is real and that the Wasm path wins end-to-end, not only in a microbench.

---

← Prev: [node:vm](./01-node-vm.md) · Next → [V8 flags](./03-v8-flags.md)
