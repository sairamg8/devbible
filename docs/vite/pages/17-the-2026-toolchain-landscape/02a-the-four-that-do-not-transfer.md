---
title: "`splitChunks`, `ProvidePlugin` and Node Built-ins: Three Capabilities With No Vite Equivalent"
sidebar_label: "Three With No Equivalent"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Migration from v7](https://vite.dev/guide/migration), [Build Options](https://vite.dev/config/build-options), [Plugin API](https://vite.dev/guide/api-plugin). **No sandbox run, no timings.** Target: **Vite 8.2.2 · webpack 5.110.3**.
> ⚠️ Scope: Rolldown's `codeSplitting` option shape was **not** read in this pass and no example of it is given — the migration guide names it and links its reference, and that link is followed here rather than reconstructed.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Three Capabilities With No Vite Equivalent

[Chunk 2](02-webpack-to-vite-parity.md) is the good news: most of a webpack config deletes itself.
This chunk is the bill. Three capabilities have no Vite equivalent at all — the fourth, custom loaders, is
[chunk 2b](02b-loaders-become-plugins.md). Together they are **2% of the config lines and roughly
80% of the effort**.

---

## 1. Under-The-Hood Mechanics

### 1. `splitChunks` → nothing equivalent, and Vite 8 narrowed the landing zone

> *"The object form `output.manualChunks` option is not supported anymore. The function form `output.manualChunks` is deprecated."* — [Migration from v7](https://vite.dev/guide/migration)

> *"Rolldown has the more flexible [`codeSplitting`](https://rolldown.rs/reference/OutputOptions.codeSplitting) option."*

⚠️ **I did not read `codeSplitting`'s option shape**, so no example of it appears here — follow the
link rather than trusting a shape reconstructed from a name.

The conceptual point survives regardless of the option's syntax. A `splitChunks` config encodes a
caching **intent**:

```
{ vendor: ['react', 'react-dom'] }
        │
        └── "these change together, rarely, and should share a cache entry
             separate from application code that changes every deploy"
```

That intent is expressed in a vocabulary — package names, chunk groups, `minChunks`, `cacheGroups` —
with no counterpart. **Porting means restating the intent, not translating the literal.** Which is
why it is the one line item you cannot estimate by counting, and why rebuilding it routinely surfaces
rules that were obsolete years ago and that nobody dared touch.

### 2. `ProvidePlugin` → no direct equivalent

webpack's `ProvidePlugin` injects a module as a global **on demand**: it sees a free identifier
`$` in a module and rewrites it into an import of jQuery, per module, only where used.

Vite has no such option. `define` performs a textual substitution and is not demand-driven, so it
covers the trivial cases and not the mechanism. The real fix is usually to stop relying on implicit
globals and import explicitly — better code, and not free.

### 3. Node built-ins in browser code → parity, not a regression

```
webpack 4   →  polyfilled Node built-ins automatically
webpack 5   →  STOPPED. requires explicit `resolve.fallback`
Vite        →  never did
```

🔴 **This is parity with webpack 5, not a Vite deficiency** — and it matters which major you are
migrating *from*. From webpack 5 the breakage was already latent and this changes nothing. From
webpack 4 it is a genuine behaviour change that a webpack 5 upgrade would also have caused, and
blaming Vite sends the investigation somewhere with no answer in it.

---

## 2. Real-World Engineering Scenario

**Three lines, three weeks.**

A React app's migration audit came out clean: 211 of 340 config lines deleted outright, 98 ported
mechanically in a day. The remaining six lines were not in the estimate.

**`splitChunks`, 3 lines, three weeks.** A hand-tuned vendor/common/route split, six years old, no
equivalent option, and Vite 8 having removed the object `manualChunks` form. It could not be ported,
so it had to be re-derived: which bundles share a cache lifetime, and why. That meant reconstructing
decisions made by people who had left — and two of the original rules turned out to be **obsolete**,
pinned to a dependency that had been removed in 2024. Nobody could have known without rebuilding it,
and nobody would have found it by translating the literal.

**A custom `.graphql` loader, 1 line, four days.** An existing community plugin covered it. Four of
the four days went to establishing *that it did* — reading its source, checking its transform
matched the loader's, confirming it handled the fragment-interpolation the old loader supported.

**`ProvidePlugin` for `Buffer`, 2 lines, two days.** A transitive dependency assumed a Node global.
Fixed with an explicit polyfill import at the entry, which is better code than an invisible
injection and still cost two days to find, choose and verify.

Final ratio: **62% deleted, 29% mechanical, 2% of the lines carrying 80% of the effort.** That
distribution is the most useful thing to carry into a plan — because it means the estimate is not the
line count, it is `grep -c 'loader'` plus one binary question about `splitChunks`.

---

## 3. Production-Grade Code Example

```typescript
// splitChunks: the stopgap, clearly labelled as one.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        // ⚠️ MIGRATION STOPGAP, not the destination. The object form was REMOVED
        // in v8 and this function form is DEPRECATED. The named replacement is
        // Rolldown's `codeSplitting`:
        // https://rolldown.rs/reference/OutputOptions.codeSplitting
        //
        // Before porting anything, write down the INTENT the old config encoded:
        //   react/react-dom  → changes rarely, shared by every route
        //   date/i18n libs   → changes rarely, only two routes need them
        //   app code         → changes every deploy
        manualChunks: (id) => {
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules/date-fns')) return 'intl';
          return undefined;
        },
      },
    },
  },
});
```

```typescript
// ProvidePlugin has no equivalent. Import explicitly — which is the better code.

// ── BEFORE ────────────────────────────────────────────────────────────────────
// new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] })
// ...and then `Buffer` was magically available in every module that used it.

// ── AFTER: src/polyfills.ts, imported FIRST in the entry ──────────────────────
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;      // only if a dependency genuinely needs the global

// ── BETTER: fix the dependency's assumption instead, where you can ────────────
// import { Buffer } from 'buffer';   // an explicit import in the module that uses it
```

```bash
# The audit for exactly these four. Run it before writing an estimate.
echo "loaders:         $(grep -c 'loader' webpack.config.js)      # each = rewrite or match"
echo "splitChunks:     $(grep -c 'splitChunks' webpack.config.js) # any hit = a DESIGN task"
echo "ProvidePlugin:   $(grep -c 'ProvidePlugin' webpack.config.js)"
echo "node builtins:   $(grep -rlE \"from '(node:)?(fs|path|crypto|buffer|stream)'\" src/ | wc -l)"
echo "webpack major:   $(npm ls webpack --depth=0 2>/dev/null | grep -o 'webpack@[0-9]*')"
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Porting `splitChunks` literally

It encodes an intent in a vocabulary that no longer exists. Translating the literal produces a chunk
graph nobody can explain and preserves rules that may already be dead.

### ⚠️ Pitfall 2 — Reaching for a global polyfill to fix one dependency

`globalThis.Buffer = Buffer` at the entry works and hides the problem from everyone after you. Where
you can, fix the assumption in the module that made it, and leave a comment naming the dependency
when you cannot.

### ⚠️ Pitfall 3 — Assuming Node built-ins are a Vite problem

webpack 5 stopped polyfilling them too. Ask which major the config came from before diagnosing.

### ⚠️ Pitfall 4 — Treating a deprecated option as a destination

`manualChunks`'s function form still ships and is deprecated. Using it to unblock a migration is
correct; leaving it undocumented as though it were the answer means the next person inherits a
second migration with no note explaining the first.

---

## Gotchas

**★ Symptom: `splitChunks` was ported and the chunk graph is worse.** Cause: a literal translation of a config that encoded intent. Fix: rebuild from the intent — which bundles share a cache lifetime, and why. Expect to find obsolete rules; six-year-old chunk configs usually contain some.

**★ Symptom: `output.manualChunks: { vendor: ['react'] }` stops doing anything after upgrading to Vite 8.** Cause: *"The object form `output.manualChunks` option is not supported anymore."* Fix: the function form as an immediate stopgap — deprecated but shipped — and plan the real move to Rolldown's `codeSplitting`.

**★ Symptom: `$` or `Buffer` is undefined after the migration.** Cause: `ProvidePlugin` has no Vite equivalent and it was injecting them on demand. Fix: import explicitly, or polyfill once at the entry. The resulting code is better; the change is not free.

**★ Symptom: `import { readFile } from 'node:fs'` breaks the browser build.** Cause: neither webpack 5 nor Vite polyfills Node built-ins. Fix: this is parity — but if the config being migrated is webpack **4**, it *was* working, and blaming Vite sends the investigation the wrong way.

**★ Symptom: a global polyfill fixes the build and something subtle breaks months later.** Cause: `globalThis.Buffer = Buffer` changes the environment for every module, including ones that feature-detect it to choose a code path. Fix: prefer a scoped import; if the global is genuinely required, comment which dependency requires it, so the next person can remove it when that dependency goes.

**★ Symptom: the migration is "done" but a deprecated option is still in the config a year later.** Cause: a stopgap that was never labelled as one. Fix: comment the stopgap with the destination and the link, as in the example above. This is the cheapest possible defence against the second migration nobody scheduled.

---

## Interview questions

**★ Why is `splitChunks` the hardest item, when it is three lines?**
Because those three lines encode an *intent* — "these packages share a cache lifetime, this route
loads separately" — in a vocabulary of package names and chunk groups that has no counterpart. You
cannot translate it; you restate it, which means re-deriving the caching strategy from first
principles, often from decisions made by people who have left. Vite 8 narrowed the landing zone
further: the object `manualChunks` form was removed and the function form deprecated in favour of
Rolldown's `codeSplitting`. It is the one item that cannot be estimated by counting, and in practice
it is where a config's undocumented decisions surface — including, routinely, some that were obsolete.

**★ Someone reports that a Node built-in import broke after migrating. What do you ask first?**
Which webpack major they came from. webpack 4 polyfilled Node built-ins automatically; webpack 5
stopped and requires explicit `resolve.fallback`; Vite never did. From webpack 5 this is parity and
the breakage was already latent; from webpack 4 it is a genuine behaviour change that a webpack 5
upgrade would also have caused. The distinction decides the fix — "add a polyfill" versus "this
dependency should not be in browser code at all" — and it stops the investigation from going
somewhere with no answer in it.

**★ `ProvidePlugin` has no equivalent. Is that a gap in Vite?**
It is a deliberate absence rather than a gap. `ProvidePlugin` rewrites free identifiers into imports,
which means a module can use `$` or `Buffer` without any textual evidence that it depends on them —
convenient, and directly at odds with static analysis, tree-shaking and anyone reading the file. The
Vite-shaped answer is an explicit import, which is better code. Where a dependency you do not control
assumes a global, a single polyfill module imported first at the entry is the pragmatic escape, and
it deserves a comment naming the dependency so it can be removed when that dependency goes.

---

← [webpack → Vite: What Transfers](02-webpack-to-vite-parity.md) · [Vite overview](../../README.md) · Next → [Loaders Become Plugins](02b-loaders-become-plugins.md)
