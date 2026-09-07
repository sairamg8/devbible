---
title: "Which Hooks Run in Dev and Which Do Not: the Asymmetry Every 'Works in Dev' Plugin Bug Comes From"
sidebar_label: "Dev vs Build Hooks"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Rolldown Hooks](https://vite.dev/guide/api-plugin), [SSR § SSR-specific plugin logic](https://vite.dev/guide/ssr), [Environment API plugins](https://vite.dev/guide/api-environment-plugins). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Which Hooks Run in Dev and Which Do Not

A Vite plugin runs in two very different machines. In the build it is a bundler plugin. In dev it is
inside something Vite constructs to *imitate* a bundler:

> *"During dev, the Vite dev server creates a plugin container that invokes [Rolldown Build Hooks](https://rolldown.rs/apis/plugin-api#build-hooks) the same way Rolldown does it."* — [Plugin API](https://vite.dev/guide/api-plugin)

**A plugin container is not a bundler.** Two documented gaps follow, and between them they account
for most "the plugin works in dev and does nothing in the build" reports — and their inverse.

---

## 1. Under-The-Hood Mechanics

### What runs, and when

```
SERVER START            ── called ONCE ──────────────────────────
  options
  buildStart

EACH INCOMING MODULE REQUEST  ── the hot path, per request ──────
  resolveId
  load
  transform

SERVER CLOSE            ── called ONCE ──────────────────────────
  buildEnd
  closeBundle
```

Verbatim:

> *"The following hooks are called once on server start: `options`, `buildStart`"*
> *"The following hooks are called on each incoming module request: `resolveId`, `load`, `transform`"*
> *"The following hooks are called when the server is closed: `buildEnd`, `closeBundle`"*

🔴 **Read the middle group as a performance contract.** In a build, `transform` runs once per module
during one pass. In dev it runs **per request**, on demand, for as long as the server lives.
Expensive work in `transform` is amortised in a build and paid repeatedly in dev — which is exactly
backwards from where you want it.

### 🔴 The two hooks that are NOT called in dev

> *"Note that the [`moduleParsed`](https://rolldown.rs/reference/Interface.Plugin#moduleparsed) hook is **not** called during dev, because Vite avoids full AST parses for better performance."*

> *"[Output Generation Hooks](https://rolldown.rs/apis/plugin-api#output-generation-hooks) (except `closeBundle`) are **not** called during dev."*

Both absences are *by design* and both are silent — a hook that is never invoked produces no
warning, no error and no log line. A plugin depending on either simply does nothing in dev.

```
moduleParsed            → build only.  Vite avoids full AST parses in dev.
renderChunk             → build only.  There are no chunks in dev.
generateBundle          → build only.  There is no bundle in dev.
writeBundle             → build only.  Nothing is written in dev.
closeBundle             → BOTH.        The documented exception.
```

The reason is structural rather than an oversight: the dev server **does not bundle your source**,
so there is no chunk to render, no bundle to generate and nothing to write. Asking why
`generateBundle` does not fire in dev is asking why a bundle exists that was never made.

---

## 2. Real-World Engineering Scenario

**A licence-header plugin that passed every local check and shipped nothing.**

A team needed a legal header on every emitted JavaScript file. They wrote a plugin using
`generateBundle`, iterating the bundle and prefixing each chunk. They tested it the way everyone
tests a Vite plugin: `vite`, open the browser, look at the served file.

Nothing appeared. So they added logging, and the log never printed. So they assumed the plugin was
mis-registered, spent an afternoon on the plugins array, tried `enforce: 'pre'`, tried `enforce:
'post'`, and eventually rewrote it using `transform` — which **did** work in dev, because
`transform` runs per request.

The rewrite then prefixed the header onto **every module** rather than every chunk, so the
production bundle contained the licence header 1,400 times, once per module, surviving minification
because it was a legal comment.

Both halves were the same misunderstanding: *"Output Generation Hooks (except `closeBundle`) are not
called during dev."* The original plugin was correct and untestable in dev. The rewrite was testable
in dev and wrong in the build.

The fix was to restore `generateBundle` and verify it against `vite build`, not against the dev
server.

**The transferable rule:** a plugin's hook choice determines *where it can be tested*, and a hook
that does not run in dev is not broken — it is build-only, and dev cannot tell you anything about it.

---

## 3. Production-Grade Code Example

```typescript
// A plugin that is HONEST about which pipeline it participates in.
import type { Plugin } from 'vite';

export function licenceHeader(text: string): Plugin {
  return {
    name: 'licence-header',

    // 🔴 BUILD ONLY. "Output Generation Hooks (except closeBundle) are not called
    //    during dev." This will never run under `vite`, and that is correct —
    //    there are no chunks in dev because dev does not bundle.
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') file.code = `/*! ${text} */\n${file.code}`;
      }
    },
  };
}
```

```bash
# Testing a plugin honestly. Dev tells you nothing about build-only hooks.
vite                 # exercises: options, buildStart, resolveId, load, transform
vite build           # exercises: ALL of the above PLUS the output generation hooks
                     # → a build-only plugin can ONLY be verified here
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Testing a build-only plugin against the dev server

`generateBundle`, `renderChunk` and `writeBundle` do not run in dev. The hook is not broken and the
plugin is not mis-registered — there is nothing for it to do, because dev does not bundle.

### ⚠️ Pitfall 2 — Moving logic to `transform` because "that one works in dev"

`transform` runs per **module**; the output hooks run per **chunk** or per **bundle**. Relocating
logic to make it observable in dev changes its granularity, and the symptom appears only in the
build — usually as the thing happening N times.

### ⚠️ Pitfall 3 — Depending on `moduleParsed`

Not called in dev, *"because Vite avoids full AST parses for better performance"*. It is also the
first criterion in the Rolldown-plugin-compatibility list for exactly this reason — see
[chunk 1i](01t-rolldown-compatibility-and-paths.md).

---

## Gotchas

**★ Symptom: a `generateBundle` plugin never runs and logging inside it never prints.** Cause: *"Output Generation Hooks (except `closeBundle`) are not called during dev."* Fix: verify it against `vite build`. It is not mis-registered; dev has no bundle for it to generate.

**★ Symptom: moving logic from `generateBundle` to `transform` makes it work in dev and wrong in the build.** Cause: different granularity — per chunk versus per module. Fix: keep the hook that matches the granularity and change where you test, not what you use.

**★ Symptom: a `moduleParsed`-based plugin does nothing under `vite` and works under `vite build`.** Cause: it is documented as not called in dev, *"because Vite avoids full AST parses"*. Fix: expected. If the plugin must work in dev, it needs a different hook and its own parse.

**★ Symptom: `closeBundle` runs in dev and surprises someone expecting build-only.** Cause: it is the documented exception — listed among the hooks *"called when the server is closed"*. Fix: this is correct behaviour; use it for cleanup that must happen in both, and do not use it as a proxy for "the build finished".

**★ Symptom: a plugin's `buildStart` side effect happens once and then never again across many dev edits.** Cause: it is *"called once on server start"*, not per rebuild — dev has no rebuilds, only per-request transforms. Fix: move per-change work into `handleHotUpdate` or `transform`.

**★ Symptom: a Rollup plugin that works in a library build does nothing in Vite dev.** Cause: it relies on output-phase hooks, or on `moduleParsed`. Fix: this is exactly the compatibility criterion the docs list — register it under `build.rolldownOptions.plugins` instead, where it runs as build-only.

---

## Interview questions

**★ Why does a plugin using `generateBundle` do nothing under `vite`?**
Because the dev server does not bundle. The docs state it directly — *"Output Generation Hooks
(except `closeBundle`) are not called during dev"* — and the reason is structural rather than a
limitation: there is no bundle in dev, so there is nothing for `generateBundle` to receive. The
important consequence is about *testing*: a hook's availability determines where the plugin can be
verified, and a build-only plugin verified against the dev server produces the most misleading
possible evidence, which is silence. The correct response is `vite build`, not a different hook.

**★ A Rollup plugin works in a library build and does nothing in Vite dev. Diagnose it.**
Almost certainly it depends on the output phase or on `moduleParsed`, both of which the docs list as
unavailable in dev — `moduleParsed` explicitly *"because Vite avoids full AST parses for better
performance"*, and the output hooks because there is nothing to output. This is not a bug to fix; it
is the documented compatibility boundary, and the documented answer is to register the plugin under
`build.rolldownOptions.plugins`, where the docs say it *"will work the same as a Vite plugin with
`enforce: 'post'` and `apply: 'build'`"*. Diagnosing it correctly saves the fruitless step of
reordering the plugins array.

---

← [Conventions & Discovery](01a-plugin-conventions.md) · [Vite overview](../../README.md) · Next → [Per-Environment & `importer`](01c-per-environment-hooks.md)
