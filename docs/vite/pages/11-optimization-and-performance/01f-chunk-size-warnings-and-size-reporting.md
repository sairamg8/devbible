---
title: "The two numbers Vite prints per chunk answer two different questions, and the one the warning threshold is compared against is deliberately the uncompressed one"
sidebar_label: "01f · Chunk-size warnings and size reporting"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Build Options](https://vite.dev/config/build-options) (`build.chunkSizeWarningLimit`, `build.reportCompressedSize`), [Building for Production](https://vite.dev/guide/build). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Chunk-Size Warnings and Size Reporting

**`vite build` prints a raw size and a gzip size for every emitted file, and the warning threshold is compared against the first one — on purpose.** Raw size is a proxy for how long the main thread spends parsing and executing the script; gzip size is a proxy for how long the bytes take to arrive. They are different costs with different fixes, and the build reference cites the reason for the choice directly. Meanwhile the gzip column itself is not free: computing it means compressing every output file on every build, and `build.reportCompressedSize` exists precisely so you can decline to pay for a number nobody reads.

## 1. Under-The-Hood Mechanics

### `chunkSizeWarningLimit` — compared against the uncompressed size

> *"Limit for chunk size warnings (in kB). It is compared against the uncompressed chunk size as the [JavaScript size itself is related to the execution time](https://v8.dev/blog/cost-of-javascript-2019)."* — default `500` — [Build Options](https://vite.dev/config/build-options)

That single sentence carries the whole design. Gzip changes how many bytes cross the network; it does not change how much JavaScript the engine has to parse, compile and run once it arrives. So a threshold aimed at *main-thread cost* has to be compared against the size the engine sees, which is the uncompressed one.

| Number | What it is a proxy for | The fix when it is too big |
|---|---|---|
| raw / uncompressed | parse + compile + execute time on the main thread | ship less code — code-split, drop a dependency, lazy-load a route |
| gzip / brotli | transfer time over the wire | usually nothing; already-compressed assets (images, fonts, WASM) do not compress further |

🔴 **Never compare the gzip column against `chunkSizeWarningLimit`.** They are not the same quantity, and the confusion runs in the expensive direction: a chunk sitting comfortably under 500 kB gzipped can be well over 500 kB of JavaScript for the engine to evaluate.

### It is a tripwire, not a gate

The option is named for warnings and the reference describes it only as a *"Limit for chunk size warnings"*. ⚠️ **The documentation does not describe any mechanism by which crossing it fails a build**, and I found none — so treat it as visibility, not enforcement. A CI pipeline that does not explicitly parse the build output will pass and deploy regardless of how large chunks have grown. Enforcement needs a separate budget tool layered on top, the same pattern the corpus covers in the [Web Vitals performance budgets doc](../../../web-vitals-performance/pages/10-budgets-and-advanced-diagnostics/01-performance-budgets-and-deep-profiling.md).

Raising the limit changes exactly one thing: whether you are told. It does not change chunking, output, or load behaviour.

### `reportCompressedSize` — the number costs a compression pass

> *"Enable/disable gzip-compressed size reporting. Compressing large output files can be slow, so disabling this may increase build performance for large projects."* — default `true` — [Build Options](https://vite.dev/config/build-options)

Note that the *default is on*, and that the documentation itself names it as a build-time cost. The mechanism is straightforward and is the reason it scales badly: every emitted file must be gzip-compressed once, in addition to being written, and compression cost grows with total output size. On a small app it is invisible. On a large multi-entry app with dozens of chunks it is a compression pass over the entire `dist/`, performed to print numbers into a terminal that CI usually discards.

### Both numbers are printed by default

The build guide shows the output shape in its library-mode section — the lines it prints are `dist/my-lib.js      0.08 kB / gzip: 0.07 kB` and `dist/my-lib.umd.cjs 0.30 kB / gzip: 0.16 kB`, quoted from [Building for Production](https://vite.dev/guide/build). Raw first, gzip second, per emitted file, with no extra tooling.

⚠️ That is the docs' own sample for a two-file library build, reproduced to show the *format*. Nothing on this page was produced by running a build here.

### What tree-shaking can and cannot do about the number

Tree-shaking removes exports that are provably unreachable, and "provably" is doing all the work: it requires static `import`/`export` syntax, because a dynamic access pattern cannot be resolved at build time. The Vite docs make the same point in miniature for JSON, where a named import is recommended because it *"helps with tree-shaking!"* — the whole-object import gives the bundler nothing to eliminate.

The practical consequence is that an import style can defeat elimination without any error:

```javascript
// Whole-namespace access — the bundler cannot prove which members are unused.
import * as utils from 'some-lib';
utils[featureName]();   // computed access: nothing is provably dead

// Static named import — every unused export is a candidate for elimination.
import { debounce } from 'some-lib';
```

⚠️ Whether a *particular* package tree-shakes well also depends on how it is published — its `sideEffects` declaration, whether it ships ESM, and whether its modules have top-level side effects. That is a property of the dependency, not of Vite, and the Vite documentation does not enumerate it.

---

## 2. Real-World Engineering Scenario

**Scenario**: a bundle-size regression that appeared in CI logs for several deploys before anyone read it.

A charting library was added for one dashboard widget, imported from the package root. The chunk-size warning started firing on the chunk that widget landed in. Because it is a warning and the pipeline was green, it was scrolled past — three times, by three different people, each of whom reasonably assumed that a build which passes has nothing wrong with it.

Two things were true at once. The chunk really was large, and the library really did publish a narrower entry point. Switching to it cut the chunk back under the threshold:

```javascript
// ❌ pulls in the library's whole surface — nothing here tells the bundler which
//    members of a root barrel are unused
import { LineChart } from 'charting-lib';

// ✅ a narrower published entry point; the module graph reached is smaller before
//    tree-shaking even runs
import { LineChart } from 'charting-lib/line';
```

⚠️ Whether a given library offers such an entry point, and whether it helps, is a property of that package's `exports` map. The generalisable lesson is not the import path — it is that **a new warning is a signal and a repeated warning is furniture**, and the only way to keep the signal is to treat the *first* appearance of one as work.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — the two size options, set deliberately.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Default 500 (kB), compared against the UNCOMPRESSED chunk size. Raise it only
    // when you have consciously accepted a large chunk — this silences a warning,
    // it does not change any output.
    chunkSizeWarningLimit: 700,

    // Default is TRUE. Every emitted file is gzip-compressed to print a number.
    // Keep it locally where a human reads it; turn it off in CI where nobody does.
    reportCompressedSize: !process.env.CI,
  },
});
```

```json
// package.json — enforcement lives OUTSIDE Vite, because the warning does not gate.
// `size-limit` fails the job; chunkSizeWarningLimit only prints.
{
  "scripts": {
    "build": "vite build",
    "size": "size-limit"
  },
  "size-limit": [
    { "path": "dist/assets/index-*.js", "limit": "180 kB" },
    { "path": "dist/assets/vendor-*.js", "limit": "320 kB" }
  ]
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: treating a chunk-size warning as routine CI noise

A warning that fires on every build teaches everyone to ignore it, and genuine regressions then accumulate one dismissible increment at a time until the app's real size has drifted a long way from where the team believes it is. The discipline that survives is narrow: treat a **new** warning — one absent from the previous build — as worth an investigation, even when the conclusion is "yes, this chunk legitimately needs to be this size." That conclusion should be a decision, not a default.

### ⚠️ Pitfall 2: comparing raw sizes across PRs to judge user impact

A change that adds highly repetitive generated code inflates the raw number and barely moves the wire cost. A change that adds an inlined font or image adds bytes that gzip cannot reduce at all. Neither is legible from one column alone — which is precisely why both are printed.

### ⚠️ Pitfall 3: turning `reportCompressedSize` off and then wondering where the numbers went

```typescript
// ❌ Off everywhere: the local build no longer prints the gzip column either, and
// the person debugging a size regression has lost their primary read-out.
reportCompressedSize: false,

// ✅ Off where nobody reads it, on where somebody does.
reportCompressedSize: !process.env.CI,
```

### ⚠️ Pitfall 4: raising `chunkSizeWarningLimit` as the response to a warning

It is a legitimate action *after* the investigation and a way of hiding evidence *before* it. The value should encode a team decision about how much JavaScript a page may evaluate — which means it should change rarely, and each change should be explicable.

---

## Gotchas

**★ Symptom: you tune `chunkSizeWarningLimit` and nothing about load time changes.** Cause: it is a warning threshold, not a splitting policy — no output changes when you raise or lower it. Fix: to actually change the chunk graph, use `codeSplitting` groups ([01d](01d-chunk-splitting-after-manualchunks.md)); to reduce total shipped code, lazy-load with dynamic `import()`.

**★ Symptom: a chunk shows 180 kB gzipped, well under the 500 kB limit, and the warning still fires.** Cause: the comparison is against the **uncompressed** size — *"It is compared against the uncompressed chunk size as the JavaScript size itself is related to the execution time."* Fix: read the first column, not the second. The two numbers routinely differ by a factor of three or more for text-heavy JavaScript, which is exactly why this misreading is common.

**★ Symptom: CI is green and chunks have doubled in size over six months.** Cause: `chunkSizeWarningLimit` prints, it does not gate; the documentation describes no failure mode. Fix: add a tool that actually fails the job.
```json
{ "scripts": { "size": "size-limit" } }
```
Then make `size` a required step. A warning nobody reads is not a budget.

**★ Symptom: `vite build` is noticeably slower on a large app than the bundle step alone should account for.** Cause: `build.reportCompressedSize` defaults to `true`, and the reference notes that *"Compressing large output files can be slow."* Fix: `reportCompressedSize: false` in CI. Keep it on locally, where the number has a reader.

**★ Symptom: the gzip column disappeared and a size investigation stalled.** Cause: `reportCompressedSize: false` was set unconditionally, usually to speed up CI. Fix: gate it — `reportCompressedSize: !process.env.CI` — so the environment with a human keeps the number.

**★ Symptom: a warning fires on a chunk that is mostly an inlined asset, and splitting does not help.** Cause: `build.assetsInlineLimit` defaults to `4096` bytes, and inlined assets arrive as base64 inside the JavaScript — which is both larger than the original and poorly compressible. Fix: lower `assetsInlineLimit`, or set it to `0` for that build, so the asset is emitted as a separate file the browser can cache independently.

**★ Symptom: a warning appears the first time you add `codeSplitting` groups, on a chunk that did not exist before.** Cause: manual grouping merges modules that automatic chunking had kept apart, so a group can be larger than any chunk that preceded it. Fix: this is a real finding, not an artefact — either accept it as the cache-lifetime trade you intended, or bound the group with `maxSize`. See [01ea](01ea-group-sizing-and-entry-awareness.md).

**★ Symptom: `import * as X` from a library defeats tree-shaking.** Cause: a namespace import accessed dynamically gives the bundler nothing to prove unreachable. Fix: static named imports.
```javascript
import { debounce } from 'some-lib';
```
⚠️ How well a specific package responds to this depends on how it is published — its `exports` map, its `sideEffects` field, and whether its modules have top-level side effects — and the Vite documentation does not enumerate that. Check the package, not Vite.

## Interview questions

**★ What exactly does `chunkSizeWarningLimit` compare, and why was that choice made?**
It compares the **uncompressed** size of an emitted chunk, in kB, against the limit, and warns above it. The reference gives the reasoning inline: *"the JavaScript size itself is related to the execution time"*, linking V8's cost-of-JavaScript write-up. Gzip changes how many bytes travel; it does not change how much source the engine must parse, compile and execute after decompression. So a threshold about main-thread cost has to be measured on the pre-compression size. The default of 500 is therefore a heuristic about how much JavaScript a page can afford to *evaluate*, not how much it can afford to download.

**★ Why does Vite print both a raw and a gzip number, and when does each one mislead?**
Because they answer different questions and neither alone is sufficient. Raw misleads when you use it to reason about transfer cost — highly repetitive generated code compresses enormously, so a large raw delta can be a negligible wire delta. Gzip misleads when you use it to reason about runtime cost, because a script must still be fully parsed and executed after being decompressed, and it also misleads on already-compressed content: an inlined font or image adds bytes that gzip cannot reduce, so a small-looking gzip delta can be an unavoidable one. The correct read is raw for main-thread cost, gzip for network cost, and never one substituted for the other.

**★ `reportCompressedSize` defaults to `true`. Should you turn it off?**
In CI, usually yes; locally, usually no. The number is produced by gzip-compressing every emitted file, which the reference itself flags — *"Compressing large output files can be slow, so disabling this may increase build performance for large projects."* In a CI job the output is written to a log nobody opens, so you are paying a compression pass over the whole `dist/` for nothing. On a developer's machine the number has a reader and is the primary read-out for a size investigation. Gating it on `process.env.CI` gets both, and the mistake to avoid is turning it off unconditionally and then discovering it is missing at the moment you need it.

**★ How would you turn a chunk-size warning into something CI actually enforces?**
By not using the warning for it. The option is described as a limit for warnings and the documentation names no failure mode, so a pipeline that does not parse the build output will pass regardless. Enforcement is a separate tool with its own thresholds — `size-limit`, Lighthouse CI, or a script that reads `build.manifest` and asserts per-entry budgets — wired in as a required step. The design argument for keeping them separate is that Vite's threshold is a single global number, while a real budget is per-entry and reflects what each route is allowed to cost.

**★ A team raises `chunkSizeWarningLimit` from 500 to 2000 and the warnings stop. What has changed?**
Only what they are told. No chunk boundary moved, no byte was removed, no user-visible behaviour changed — the threshold is a reporting comparison and nothing downstream reads it. What has changed for the worse is the signal: the value no longer encodes a decision about how much JavaScript a page may evaluate, so the next genuine regression will arrive silently. Raising it is legitimate as the *conclusion* of an investigation into a specific chunk; as a response to being warned, it is deleting the evidence.

---

← [01ea · Group sizing and entry awareness](01ea-group-sizing-and-entry-awareness.md) · [Vite overview](../../README.md) · Next → [01g · Preloading and cache granularity](01g-preloading-and-cache-granularity.md)
