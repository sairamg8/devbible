---
title: "The Plugin API on Vite 8: It Extends Rolldown's Interface Now, Not Rollup's"
sidebar_label: "Plugin API & Conventions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API](https://vite.dev/guide/api-plugin), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Plugin API on Vite 8

🔴 **The first sentence of Vite's own plugin documentation changed in v8, and almost no material has
caught up:**

> *"Vite plugins extends **Rolldown's** plugin interface with a few extra Vite-specific options. As a result, you can write a Vite plugin once and have it work for both dev and build."* — [Plugin API](https://vite.dev/guide/api-plugin)

Through Vite 7 that sentence named **Rollup**. Rollup plugins still work — there is a whole
[compatibility section](01t-rolldown-compatibility-and-paths.md) about it — but the base interface a
Vite plugin extends is Rolldown's, and the docs now send you to *Rolldown's* plugin documentation
first:

> *"It is recommended to go through [Rolldown's plugin documentation](https://rolldown.rs/apis/plugin-api) first before reading the sections below."*

---

## 1. Under-The-Hood Mechanics

### The shape

```
Vite Plugin
  = Rolldown plugin interface        resolveId · load · transform · buildStart · …
  + Vite-specific hooks              config · configResolved · configureServer ·
                                     configurePreviewServer · transformIndexHtml ·
                                     handleHotUpdate
  + Vite-specific properties         enforce · apply
```

The Vite-specific half is inert elsewhere:

> *"Vite plugins can also provide hooks that serve Vite-specific purposes. These hooks are ignored by Rollup."*

That is what makes the "write once, works in both dev and build" claim true — the same object is a
valid bundler plugin and a valid dev-server plugin, and each side ignores what it does not
understand.

### A plugin is an object; the factory is a convention

> *"It is common convention to author a Vite/Rolldown/Rollup plugin as a factory function that returns the actual plugin object. The function can accept options which allows users to customize the behavior of the plugin."*

```js
export default function myPlugin(options) {
  return { name: 'my-plugin', /* hooks */ }   // ← the plugin is the returned object
}
```

`name` is not decorative:

> *"`name: 'my-plugin', // required, will show up in warnings and errors"*

An unnamed plugin produces diagnostics nobody can trace.

### Configuration: falsy entries and presets

> *"Falsy plugins will be ignored, which can be used to easily activate or deactivate plugins."*

```js
plugins: [react(), isDev && devOnlyPlugin()]   // no .filter(Boolean) needed
```

> *"`plugins` also accepts presets including several plugins as a single element. This is useful for complex features (like framework integration) that are implemented using several plugins. The array will be flattened internally."*

That flattening is why `@vitejs/plugin-react` can be several plugins wearing one name, and why
plugin *ordering* is subtler than the array suggests — a single array entry may expand to three
plugins at three different positions.

---


## 3. Production-Grade Code Example

```typescript
// plugins/acme-assets.ts
// No Vite-specific hooks → name it for the WIDER audience.
// package.json: "name": "rolldown-plugin-acme-assets",
//               "keywords": ["rolldown-plugin", "vite-plugin"]
import type { Plugin } from 'vite';

export interface AcmeAssetsOptions {
  base?: string;
}

/** Factory function — the convention, and what lets users pass options. */
export function acmeAssets(options: AcmeAssetsOptions = {}): Plugin {
  const base = options.base ?? '/assets/';

  return {
    // Required. Shows up in every warning and error Vite emits about this plugin.
    name: 'acme-assets',

    // v8-documented shape: a filter object plus a handler, not a bare function.
    // See [chunk 1f](01f-hook-filters.md) for why, and for the backward-compatibility caveat.
    transform: {
      filter: { id: /\.acme$/ },
      handler(code, id) {
        return { code: rewrite(code, base), map: null };
      },
    },
  };
}
```

```typescript
// vite.config.ts — falsy entries, presets, and the augmentation pattern.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';   // a PRESET: several plugins, one entry
import { acmeAssets } from './plugins/acme-assets';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [
    react(),

    // Falsy entries are ignored — no .filter(Boolean) needed.
    isDev && devOnlyPlugin(),

    acmeAssets({ base: '/static/' }),
  ],
});
```

```typescript
// A plugin object is just an object — so you can augment a third-party one.
// This is the documented way to add Vite-only properties to a Rolldown plugin.
import example from 'rolldown-plugin-example';

export default defineConfig({
  plugins: [
    {
      ...example(),
      enforce: 'post',
      apply: 'build',
    },
  ],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Believing the plugin API is Rollup's

On Vite 8 it *"extends Rolldown's plugin interface"*, and the docs point at Rolldown's plugin
documentation first. Most tutorials, most AI answers and most of the older ecosystem still say
Rollup. Rollup plugins largely still work, but the reference you should be reading is Rolldown's.

### ⚠️ Pitfall 2 — Omitting `name`

It is documented as required and it is what appears in warnings and errors. A plugin without one
produces diagnostics that name nothing, which is worse than no diagnostic because it looks like a
Vite bug.

### ⚠️ Pitfall 3 — Exporting a plugin object instead of a factory

It works, and it forecloses options, and it means every consumer shares one instance and whatever
state it closes over. The factory convention exists for both reasons.

### ⚠️ Pitfall 4 — Reasoning about order from the plugins array alone

A preset is *"several plugins as a single element"* and *"the array will be flattened internally"*,
so one entry can become three at three different positions. Ordering is
[chunk 1d](01p-plugin-ordering-and-enforce.md), and the array is only part of it.

---

## Gotchas

**★ Symptom: documentation, a tutorial or an AI answer says Vite plugins are Rollup plugins.** Cause: it describes Vite 7 or earlier. Fix: on v8 they *"extend Rolldown's plugin interface"*. The practical consequence is which reference you read — the docs now send you to Rolldown's plugin documentation before their own.

**★ Symptom: a warning names no plugin — "[plugin] transform error".** Cause: a plugin object with no `name`. Fix: add it. It is documented as required precisely because it is what makes a diagnostic actionable.

```ts
return { name: 'acme-assets', /* … */ };   // ✅ required
```

**★ Symptom: a `.filter(Boolean)` on the plugins array looks necessary and is not.** Cause: an assumption. Fix: *"Falsy plugins will be ignored"* — `isDev && plugin()` is the documented idiom, and the filter is noise.

**★ Symptom: plugin ordering does not match the array and nobody can explain it.** Cause: a preset entry expanded to several plugins, or `enforce` moved one. Fix: read [chunk 1d](01p-plugin-ordering-and-enforce.md) and use `vite-plugin-inspect` — the array is not the resolved order.

**★ Symptom: a plugin's option cannot be changed per project because it is a singleton.** Cause: a plugin *object* was exported rather than a factory. Fix: wrap it — `export function myPlugin(opts) { return { … } }`. Shared closure state across consumers is the second, subtler cost.

**★ Symptom: a plugin behaves differently in a Rollup-based library build.** Cause: it uses a Vite-specific hook, which *"[is] ignored by Rollup"* — silently. Fix: this is the documented behaviour and the reason for the naming convention. If the plugin must work in both, it may only use hooks the base interface defines.

---

## Interview questions

**★ What is a Vite plugin, precisely, on Vite 8?**
An object that implements **Rolldown's** plugin interface plus a small set of Vite-specific hooks
and two Vite-specific properties. The docs' own first sentence changed in v8 — it named Rollup
through v7 and now says *"Vite plugins extends Rolldown's plugin interface"* — and it now sends you
to Rolldown's plugin documentation before its own. The design consequence is the one the same
sentence states: *"you can write a Vite plugin once and have it work for both dev and build"*,
because the Vite-specific hooks are *"ignored by Rollup"* rather than being an error. One object,
two consumers, each ignoring what it does not understand.

**★ Why is a plugin authored as a factory function rather than an object?**
Two reasons, and the second is the one people miss. The obvious one is options: a factory takes
configuration, an exported object cannot. The subtler one is **state**: an exported object is a
singleton shared by every consumer and every invocation in the same process, so any closure state —
a cache, a `Set` of seen ids, a counter — is shared across builds that should be independent. That
matters in a monorepo where one process builds several packages, and it produces the worst kind of
bug: correct in isolation, wrong under concurrency, and invisible in a single-project test.

---

← [Env System & `.env` Files](../07-env-variables-and-modes/01-environment-system.md) · [Vite overview](../../README.md) · Next → [Conventions & Discovery](01a-plugin-conventions.md)
