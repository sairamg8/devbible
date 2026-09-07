---
title: "Rolldown Plugin Compatibility: Three Greppable Criteria, and the Slot a Build-Only Plugin Belongs In"
sidebar_label: "Rolldown Compatibility"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Rolldown Plugin Compatibility](https://vite.dev/guide/api-plugin), [§ Path Normalization](https://vite.dev/guide/api-plugin), [§ Filtering, include/exclude pattern](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings, and no Windows machine was used**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Rolldown Plugin Compatibility

The question every migration asks — *"will this Rollup plugin work?"* — has a documented answer with
three criteria you can grep for in thirty seconds. Its neighbour in the docs, path normalization, is
[chunk 1u](01u-path-normalization-and-filters.md).

---

## 1. Under-The-Hood Mechanics

### Will a Rollup/Rolldown plugin work in Vite?

> *"A fair number of Rolldown / Rollup plugins will work directly as a Vite plugin (e.g. `@rollup/plugin-alias` or `@rollup/plugin-json`), but not all of them, since some plugin hooks do not make sense in an unbundled dev server context."*

The docs give **three criteria**, and they are checkable by reading the plugin's source:

> *"It doesn't use the [`moduleParsed`](https://rolldown.rs/reference/Interface.Plugin#moduleparsed) hook."*
> *"It doesn't rely on the Rolldown specific options like [`transform.inject`](https://rolldown.rs/reference/InputOptions.transform#inject)"*
> *"It doesn't have strong coupling between bundle-phase hooks and output-phase hooks."*

Every one of the three traces back to the same fact: **the dev server does not bundle**. `moduleParsed`
is *"not called during dev, because Vite avoids full AST parses for better performance"*; output-phase
hooks other than `closeBundle` are not called in dev either; and a plugin whose `transform` stores
state that `generateBundle` later consumes has half its machinery missing.

```bash
# The compatibility check, as a grep. Thirty seconds, before you install anything.
grep -n 'moduleParsed\|generateBundle\|renderChunk\|writeBundle' node_modules/<pkg>/dist/*.js
```

### The escape hatch: `build.rolldownOptions.plugins`

> *"If a Rolldown / Rollup plugin only makes sense for the build phase, then it can be specified under `build.rolldownOptions.plugins` instead. It will work the same as a Vite plugin with `enforce: 'post'` and `apply: 'build'`."*

🔴 **This is the answer to "the plugin works in my library build and does nothing in Vite dev".** It is
not a bug to fix — it is a plugin in the wrong slot. Registering it under
`build.rolldownOptions.plugins` says "build only" structurally, and the docs even tell you the exact
equivalent configuration, which is useful when you want the same effect from the normal `plugins`
array. See [chunk 1q](01q-conditional-application.md).

---


## 3. Production-Grade Code Example

```typescript
// A build-only Rollup/Rolldown plugin, in the slot the docs prescribe.
// "It will work the same as a Vite plugin with enforce: 'post' and apply: 'build'."
import legacyAnalysis from 'rollup-plugin-legacy-analysis';

export default defineConfig({
  build: {
    rolldownOptions: {
      plugins: [legacyAnalysis()],   // never invoked by the dev server
    },
  },
});
```

```bash
# The compatibility check, before installing a Rollup plugin.
# Any hit on the first three means it will not work fully in dev.
grep -n 'moduleParsed' node_modules/<pkg>/dist/*.js        # criterion 1
grep -n 'transform\.inject' node_modules/<pkg>/dist/*.js   # criterion 2
grep -n 'generateBundle\|renderChunk' node_modules/<pkg>/dist/*.js  # criterion 3
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Assuming a Rollup plugin will "just work"

*"A fair number … will work directly … but not all of them."* Three documented criteria, all
greppable. Thirty seconds of checking beats a day of wondering why it does nothing in dev.

### ⚠️ Pitfall 2 — Treating a build-only plugin's dev silence as a bug

It is a plugin in the wrong slot. `build.rolldownOptions.plugins` is the documented place, and it is
equivalent to `enforce: 'post'` plus `apply: 'build'`.

---

## Gotchas

**★ Symptom: a Rollup plugin works in a library build and does nothing in Vite dev.** Cause: it uses `moduleParsed` or output-phase hooks, neither of which run in dev. Fix: register it under `build.rolldownOptions.plugins`, which the docs define as equivalent to `enforce: 'post'` plus `apply: 'build'`.

**★ Symptom: a plugin's `transform` stores state that `generateBundle` reads, and dev output is wrong.** Cause: the third compatibility criterion — *"strong coupling between bundle-phase hooks and output-phase hooks"*. In dev the output phase never runs, so the state accumulates and is never consumed. Fix: make it build-only, or decouple the phases.

**★ Symptom: a plugin under `build.rolldownOptions.plugins` runs later than expected.** Cause: it is equivalent to `enforce: 'post'`, which places it in the last user band. Fix: expected. If you need it earlier, put it in the normal `plugins` array with `apply: 'build'` instead — the docs give you the exact equivalence so you can choose.

**★ Symptom: a compatibility check passes and the plugin still misbehaves in dev.** Cause: the three criteria are necessary, not sufficient — the docs say *"in general, as long as a plugin fits the following criteria then it should just work"*. Fix: "in general" is doing real work in that sentence; treat the criteria as a fast filter and still verify against both `vite` and `vite build`.

---

## Interview questions

**★ How do you decide whether a Rollup plugin will work in Vite?**
By checking three documented criteria, all of which you can grep for: it must not use `moduleParsed`,
must not rely on Rolldown-specific options like `transform.inject`, and must not have *"strong
coupling between bundle-phase hooks and output-phase hooks"*. All three trace to the same fact — the
dev server does not bundle, so `moduleParsed` is skipped for performance and output-phase hooks other
than `closeBundle` never fire. Worth noting the hedge in the docs' own wording: *"in general … it
should just work"*, so the criteria are a fast filter rather than a proof, and you still verify
against both `vite` and `vite build`.

**★ A Rollup plugin works in your library build and does nothing in Vite dev. What do you do?**
Not debug it — relocate it. The docs prescribe `build.rolldownOptions.plugins` for a plugin that
*"only makes sense for the build phase"*, and helpfully state the equivalence: *"It will work the
same as a Vite plugin with `enforce: 'post'` and `apply: 'build'`."* That sentence is worth
remembering for a second reason: if you want the same effect from the normal `plugins` array — say
because you need a different `enforce` band — you now know exactly what configuration to write
instead.

---

← [Shipping a Virtual Module](01sa-shipping-a-virtual-module.md) · [Vite overview](../../README.md) · Next → [Path Normalization & Filters](01u-path-normalization-and-filters.md)
