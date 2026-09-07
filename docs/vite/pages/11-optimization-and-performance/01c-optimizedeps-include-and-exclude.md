---
title: "optimizeDeps.include and optimizeDeps.exclude are not opposites — one forces something into the pre-bundle that the scanner cannot see, the other declines a bundle the browser does not need"
sidebar_label: "01c · optimizeDeps include/exclude"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `optimizeDeps.include` and `optimizeDeps.exclude`

**The two options look like a matched pair and are not.** `include` exists because Vite's scanner cannot see every import — a package reached only through a plugin transform, or a linked workspace package that Vite deliberately treats as source, will never enter the pre-bundle on its own. `exclude` exists because pre-bundling a small, already-valid ESM package buys nothing and costs a bundle step. The documentation gives a single sentence that decides between them, and getting it backwards produces two very different failures: an unnecessary reload on one side, and a module the browser cannot parse on the other.

## 1. Under-The-Hood Mechanics

### The decision rule, verbatim

> *"Both `include` and `exclude` can be used to deal with this. If the dependency is large (with many internal modules) or is CommonJS, then you should include it; If the dependency is small and is already valid ESM, you can exclude it and let the browser load it directly."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

Two axes, and they are not symmetric:

| Property of the package | Pre-bundle it? | Why |
|---|---|---|
| CommonJS or UMD | ✅ **must** | the browser cannot `import` it at all otherwise |
| ESM, many internal modules | ✅ should | otherwise one `import` becomes many requests |
| ESM, small | ⚪ optional — `exclude` is fine | one request either way; the bundle step is pure cost |
| ESM, small, but a *linked* package you are editing | ⚪ leave it as source | see linked packages below |

🔴 **Only one row is a hard rule.** "CommonJS" is not a preference, it is a capability question, and the reference carries it as a standing warning under `optimizeDeps.exclude`:

> *"CommonJS dependencies should not be excluded from optimization. If an ESM dependency is excluded from optimization, but has a nested CommonJS dependency, the CommonJS dependency should be added to `optimizeDeps.include`."* — [Dep Optimization Options](https://vite.dev/config/dep-optimization-options)

### The nested form — `'esm-dep > cjs-dep'`

The warning above comes with the exact syntax for the transitive case, quoted from the reference:

```js
export default defineConfig({
  optimizeDeps: {
    include: ['esm-dep > cjs-dep'],
  },
})
```

The `>` reads "as reached from". It exists because a package specifier alone is ambiguous when the same CJS package is reachable through several parents and only one of them was excluded.

### What `include` is actually for

> *"By default, linked packages not inside `node_modules` are not pre-bundled. Use this option to force a linked package to be pre-bundled."* — `optimizeDeps.include`

and the guide's version of the same fact:

> *"In a monorepo setup, a dependency may be a linked package from the same repo. Vite automatically detects dependencies that are not resolved from `node_modules` and treats the linked dep as source code. It will not attempt to bundle the linked dep, and will analyze the linked dep's dependency list instead."*

> *"However, this requires the linked dep to be exported as ESM. If not, you can add the dependency to [`optimizeDeps.include`](https://vite.dev/config/dep-optimization-options#optimizedeps-include) in your config."*

> *"When making changes to the linked dep, restart the dev server with the `--force` command line option for the changes to take effect."*

⚠️ Note that the detection is described in terms of *where the dependency resolves to*, not where the specifier points. Whether a symlinked workspace package in a pnpm or npm workspace counts as "not resolved from `node_modules`" therefore depends on symlink resolution, and the documentation does not spell that interaction out. Treat "my workspace package is being pre-bundled and I did not ask for it" as a symptom to check rather than an impossibility.

The second documented use of `include` is the scanner blind spot, covered in [01a](01a-dependency-pre-bundling.md) — an import that only exists after a plugin transform.

The third is experimental and worth knowing about:

> *"**Experimental:** If you're using a library with many deep imports, you can also specify a trailing glob pattern to pre-bundle all deep imports at once. This will avoid constantly pre-bundling whenever a new deep import is used."*

```js
export default defineConfig({
  optimizeDeps: {
    include: ['my-lib/components/**/*.vue'],
  },
})
```

That is the fix for a library where every new component you touch triggers a fresh discovery and re-bundle.

### The v8 rename beneath both options

The dependency optimizer's own escape hatch changed engine, and the migration guide gives an exact mapping rather than a passthrough:

> *"Rolldown is now used for dependency optimization instead of esbuild. Vite still supports `optimizeDeps.esbuildOptions` for backward compatibility by converting it to `optimizeDeps.rolldownOptions` automatically. `optimizeDeps.esbuildOptions` is now deprecated and will be removed in the future."* — [Migration from v7](https://vite.dev/guide/migration)

| `optimizeDeps.esbuildOptions.*` | → `optimizeDeps.rolldownOptions.*` |
|---|---|
| `minify` | `output.minify` |
| `treeShaking` | `treeshake` |
| `define` | `transform.define` |
| `loader` | `moduleTypes` |
| `preserveSymlinks` | 🔴 `!resolve.symlinks` — **inverted** |
| `resolveExtensions` | `resolve.extensions` |
| `mainFields` | `resolve.mainFields` |
| `conditions` | `resolve.conditionNames` |
| `keepNames` | `output.keepNames` |
| `platform` | `platform` |
| `plugins` | `plugins` *(partial support)* |

You can read back what the compatibility layer produced, using the snippet the migration guide provides:

```js
const plugin = {
  name: 'log-config',
  configResolved(config) {
    console.log('options', config.optimizeDeps.rolldownOptions)
  },
}
```

---

## 2. Real-World Engineering Scenario

**Scenario**: a design-system package is excluded to speed up cold start, and an app route breaks a week later.

`@acme/design-tokens` is a handful of ESM files exporting constants. Excluding it was correct by the documented rule — small, valid ESM, one request either way. Two sprints later the package added a colour-conversion helper that pulls in a CommonJS colour library as a transitive dependency. Nothing about `@acme/design-tokens` changed shape, so nobody revisited the exclusion, and the browser was handed a nested CommonJS module with no conversion step in front of it.

This is the exact case the reference calls out — *"If an ESM dependency is excluded from optimization, but has a nested CommonJS dependency, the CommonJS dependency should be added to `optimizeDeps.include`"* — and the fix is the `>` form:

```typescript
optimizeDeps: {
  exclude: ['@acme/design-tokens'],
  include: ['@acme/design-tokens > color-convert'],
},
```

The generalisable lesson is that an exclusion is a claim about a package's *entire transitive graph*, and that graph changes without the package's own API changing.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — a monorepo app, annotated with the documented rule
// that justifies each entry.
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: [
      // 1. Linked workspace package that still ships CJS. The docs: linked deps are
      //    treated as source unless "exported as ESM" — if not, force the bundle.
      '@acme/legacy-charts',

      // 2. Injected by a plugin during transform, so the initial scan cannot see it.
      '@acme/analytics',

      // 3. Nested CJS reached through an excluded ESM parent. The '>' form is the
      //    documented spelling for "this package, as reached from that one".
      '@acme/design-tokens > color-convert',

      // 4. EXPERIMENTAL trailing glob: pre-bundle every deep import at once instead
      //    of re-bundling each time a new one is touched.
      '@acme/icons/dist/icons/**/*.js',
    ],

    exclude: [
      // Small, already-valid ESM. One request either way; skip the bundle step.
      '@acme/design-tokens',
    ],

    // v8 escape hatch. `esbuildOptions` is the deprecated alias and is converted
    // to this shape internally, with the per-option mapping above.
    rolldownOptions: {
      resolve: {
        // 🔴 The v7 spelling was `esbuildOptions.preserveSymlinks: true`.
        // The v8 equivalent is the NEGATION of this field.
        symlinks: false,
      },
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: excluding for speed without checking the module format

```typescript
// ❌ WRONG: "it's a small package, excluding it will be faster." If it is CJS, the
// browser receives `module.exports = …` and cannot import it. Speed is irrelevant.
optimizeDeps: { exclude: ['tiny-cjs-helper'] },

// ✅ CORRECT: check the package's `exports`/`main`/`module` fields first. If any
// entry point resolves to CJS, it belongs in `include`.
optimizeDeps: { include: ['tiny-cjs-helper'] },
```

### ⚠️ Pitfall 2: porting `preserveSymlinks` by copying the name

```typescript
// ❌ WRONG — this silently INVERTS the v7 behaviour.
optimizeDeps: { rolldownOptions: { resolve: { symlinks: true } } },  // was preserveSymlinks: true

// ✅ CORRECT — the migration table writes the mapping as `!resolve.symlinks`.
optimizeDeps: { rolldownOptions: { resolve: { symlinks: false } } },
```

It is the only inverted entry in the whole table, which is exactly why it gets ported wrong.

### ⚠️ Pitfall 3: using `include` to try to affect the production bundle

`optimizeDeps` is dev-only. To keep a package *out* of the production bundle the option is `build.rolldownOptions.external`; to put it in a particular chunk the option is `codeSplitting`, covered in [01d](01d-chunk-splitting-after-manualchunks.md).

### ⚠️ Pitfall 4: relying on the experimental deep-import glob in a shared config

The trailing-glob form is explicitly marked **Experimental** with a feedback discussion link. It is a good answer to a real problem, and it is not a stable API — pin the Vite version, or accept that a minor upgrade could change it.

---

## Gotchas

**★ Symptom: a package works in production and fails in dev with a syntax error at `module.exports`.** Cause: it is CommonJS and something removed it from the optimizer — an explicit `exclude`, or `noDiscovery: true` without a matching `include`. Production is unaffected because the build bundles everything anyway. Fix:
```typescript
optimizeDeps: { include: ['that-package'] },
```

**★ Symptom: an ESM package you excluded works fine, until one of *its* dependencies breaks.** Cause: exclusion propagates down the graph — the reference warns that a nested CommonJS dependency of an excluded ESM package needs its own `include`. Fix: the `>` form, `include: ['esm-dep > cjs-dep']`. Do not un-exclude the parent unless you want the whole subtree bundled.

**★ Symptom: every time you open a new page of an icon or component library, the server re-bundles.** Cause: each deep import is a separate discovery, so the optimizer keeps finding new entry points. Fix: the experimental trailing glob — `include: ['my-lib/components/**/*.vue']` — which the docs describe as avoiding *"constantly pre-bundling whenever a new deep import is used"*.

**★ Symptom: edits to a linked workspace package do not show up.** Cause: if the package is being pre-bundled, its contents are inside the cached bundle, and the cache does not invalidate on a source edit. Fix: the documented instruction is *"restart the dev server with the `--force` command line option for the changes to take effect."* If you are editing that package constantly, the better answer is to stop forcing it through the optimizer, which requires it to be valid ESM.

**★ Symptom: a workspace package is being pre-bundled even though the docs say linked packages are not.** Cause: the documented detection is about what the dependency *resolves to*, and symlink resolution decides that. ⚠️ The documentation does not spell out the workspace-symlink case, so treat this as a thing to verify in your setup rather than a rule. Fix: check whether the package appears in `include` (directly or via a preset), and check `resolve.preserveSymlinks`.

**★ Symptom: after upgrading to v8, `optimizeDeps.esbuildOptions.preserveSymlinks` produced the opposite behaviour.** Cause: the compatibility layer maps it to `!rolldownOptions.resolve.symlinks` — a negation, not a rename. Fix: write `resolve: { symlinks: false }` where you had `preserveSymlinks: true`. Verify with the `configResolved` snippet from the migration guide rather than by reasoning about it.

**★ Symptom: an `esbuildOptions` entry has no `rolldownOptions` equivalent and quietly does nothing.** Cause: the conversion table is a list of eleven options, and `plugins` is annotated *"(partial support)"* — anything outside that list, or outside the supported plugin surface, is not carried across. Fix: log `config.optimizeDeps.rolldownOptions` from a `configResolved` hook and confirm what the compatibility layer actually produced. Silence is not confirmation.

**★ Symptom: `include` grows to thirty entries and nobody remembers why.** Cause: entries added to fix a symptom, never removed when the cause went away. Fix: annotate each entry with the reason class — scanner blind spot, CJS, linked package, deep-import glob. There are only four legitimate reasons, and an entry that fits none of them is a candidate for deletion.

## Interview questions

**★ `include` and `exclude` look like opposites. Why are they not?**
Because they answer different questions. `include` answers "Vite will not pre-bundle this and it needs to be" — the causes are a scanner blind spot, a linked package Vite is treating as source, or a nested CommonJS dependency under an excluded parent. `exclude` answers "Vite will pre-bundle this and it does not need to be" — a small package that is already valid ESM, where bundling costs a step and saves no request. They are not inverse operations on one setting; they are two escapes from two different default behaviours, and the proof is that a config can legitimately name the same package in both, via the `'esm-dep > cjs-dep'` form.

**★ Which of the two can produce a runtime failure, and why only that one?**
`exclude`. Removing a CommonJS package from the optimizer removes the CJS→ESM conversion, and the browser cannot import CommonJS — the docs carry this as a standing warning. `include` is at worst wasted work: forcing a small ESM package through the pre-bundler produces a valid module you did not need to build. That asymmetry is why the documented rule is phrased the way it is: "should include" for large or CommonJS, "can exclude" for small and already-ESM. One is an obligation, one is an option.

**★ What is the `'esm-dep > cjs-dep'` syntax for, and why is a plain package name not enough?**
It names a dependency *by the path it is reached through*. The case is an ESM package you excluded that has a CommonJS dependency of its own: the parent is out of the optimizer, so its child never gets converted either. Naming just `cjs-dep` would be ambiguous when the same package is reachable from several parents — you would be asking Vite to optimize every copy, in every position in the graph, which is not what you mean and may not even be one artifact. The `>` disambiguates the edge rather than the node.

**★ Why does the documentation tell you to restart with `--force` after editing a linked dependency?**
Because "linked dependency you had to `include`" and "cached pre-bundle" are the same object. Once a package is inside the optimizer's output, editing its source changes nothing the cache tracks — the cache is keyed on lockfile content, patches mtime, config fields and `NODE_ENV`, none of which move when you edit a workspace file. So the pre-bundle stays valid and stale. `--force` is the documented one-shot invalidation. The deeper point is that pre-bundling and editing are in tension: anything you are actively editing wants to be treated as source, and the only reason to force a linked package through the bundler is that it is not valid ESM.

**★ You inherit a Vite 7 config with `optimizeDeps.esbuildOptions`. What do you do on v8?**
Port it, using the migration guide's eleven-row mapping, and verify rather than assume. It still works — the compatibility layer converts it — but it is deprecated and slated for removal, and the conversion is not a straight rename: `treeShaking` becomes `treeshake`, `loader` becomes `moduleTypes`, `define` moves under `transform`, and `preserveSymlinks` becomes the *negation* of `resolve.symlinks`. `plugins` is annotated as partial support, so an esbuild plugin may simply not carry over. The verification step is the `configResolved` snippet in the guide — log `config.optimizeDeps.rolldownOptions` and read what the layer actually produced.

---

← [01b · The pre-bundle cache](01b-the-pre-bundle-cache.md) · [Vite overview](../../README.md) · Next → [01d · Chunk splitting after manualChunks](01d-chunk-splitting-after-manualchunks.md)
