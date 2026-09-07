---
title: "A Vite plugin is a plain object, so spreading one is the documented way to add `enforce` and `apply` to a plugin you do not own — and it fails silently on a preset"
sidebar_label: "Augmenting Plugins You Do Not Own"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Rolldown Plugin Compatibility](https://vite.dev/guide/api-plugin), [§ Plugins Config](https://vite.dev/guide/api-plugin), [§ Plugin Ordering](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Augmenting Plugins You Do Not Own

**`enforce` and `apply` are Vite-only keys, so a Rolldown or Rollup plugin never exposes options
for them — and you do not need it to.** A plugin is a plain object; spreading it into a new object
literal and adding the keys yourself is the pattern the documentation gives verbatim. It works on
plugin objects and fails silently on presets, which return arrays, and that asymmetry is the whole
gotcha.

---

## 1. Under-The-Hood Mechanics

### The pattern, verbatim

> ```js
> import example from 'rolldown-plugin-example'
> import { defineConfig } from 'vite'
>
> export default defineConfig({
>   plugins: [
>     {
>       ...example(),
>       enforce: 'post',
>       apply: 'build',
>     },
>   ],
> })
> ```

The spread copies every hook the plugin defined onto a fresh object; `enforce` and `apply` are keys
the original never had, because a pure Rolldown plugin has no concept of either. Vite reads them
off the resulting object exactly as it would off one of your own plugins. Nothing is subclassed,
patched or monkey-patched — this is object literal semantics and nothing else.

```
example()                    → { name, resolveId, load, transform }        a plain object
{ ...example(), enforce }    → { name, resolveId, load, transform, enforce }
```

### Why it fails on a preset

> *"`plugins` also accepts presets including several plugins as a single element … The array will
> be flattened internally."*

A preset returns an **array**. Spreading an array into an object literal produces an object with
numeric keys and your stray `enforce` — not a plugin, and not something Vite will treat as one:

```js
// ⛔ does nothing useful: framework() returns an ARRAY
{ ...framework(), enforce: 'pre' }

// ✅ reach the member that actually needs the band
[{ ...frameworkRefresh(cfg), enforce: 'pre' }, frameworkDevtools(cfg)]
```

⚠️ The documentation does not state what Vite does with an object of that shape — whether it is
ignored, or errors. Do not rely on either; the point is that the `enforce` never reaches a plugin.

### The documented alternative for build-only plugins

If the reason you are reaching for the spread is "this Rolldown plugin only makes sense in a
build", there is a second spelling of the same arrangement:

> *"If a Rolldown / Rollup plugin only makes sense for the build phase, then it can be specified
> under `build.rolldownOptions.plugins` instead. It will work the same as a Vite plugin with
> `enforce: 'post'` and `apply: 'build'`."*

Two spellings, one outcome. Pick the one that makes the intent obvious to the next reader: the
spread keeps every plugin in one list, while `build.rolldownOptions.plugins` states "this is not
part of dev" structurally. `apply` itself is [chunk 1q](01q-conditional-application.md).

⚠️ The Rolldown compatibility criteria — which upstream plugins work as Vite plugins at all — are
a separate subject — [chunk 1t](01t-rolldown-compatibility-and-paths.md).

### Do not make consumers spread *your* plugin

The mirror image of this page: if your plugin hard-codes `enforce`, every consumer who disagrees
has to spread you, and their spread breaks the day you start returning an array. Take it as an
option instead.

---

## 2. Real-World Engineering Scenario

A platform team needs `rolldown-plugin-example` to run only in builds, and after every other user
plugin. They do not own it, it takes no `enforce` option, and forking a dependency for two keys is
absurd.

Three approaches get proposed:

1. **Fork or patch the package** — a permanent maintenance cost for two keys that are not even
   part of that plugin's interface. Rejected.
2. **Wrap it in a factory that re-implements the hooks** — a copy that drifts on the next upstream
   release. Rejected.
3. **Spread it** — `{ ...example(), enforce: 'post', apply: 'build' }`. The documented pattern, no
   fork, no drift, and the diff is one line.

The failure that follows a month later is instructive: someone applies the same pattern to
`@vitejs/plugin-react`, which is a **preset**. The line looks identical, review passes, and the
`enforce` silently reaches nothing — the plugin was an array all along. **The pattern is not "spread
any plugin"; it is "spread a plugin object", and the two are indistinguishable at the call site.**

---

## 3. Production-Grade Code Example

```ts
// vite.config.ts — augmenting plugins you do not own, and exposing the knob on one you do.
import { defineConfig } from 'vite'
import example from 'rolldown-plugin-example'
import { auditPlugin } from './plugins/audit'

// Hold ONE instance. Spreading a second call would create a second plugin.
const example1 = example()

export default defineConfig({
  plugins: [
    // Third-party plugin + Vite-only keys. Spread the OBJECT, never a preset's array.
    { ...example1, enforce: 'post', apply: 'build' },

    // Our own plugin, with the band left to the caller.
    auditPlugin({ enforce: 'post' }),
  ],
})
```

```ts
// plugins/audit.ts — make the band an option so consumers never have to spread you.
import type { Plugin } from 'vite'

export function auditPlugin(opts: { enforce?: 'pre' | 'post' } = {}): Plugin {
  return {
    name: 'audit',
    enforce: opts.enforce,          // undefined ⇒ the default band, which is correct
    transform: {
      order: 'post',                // and this positions THIS hook, not the plugin
      handler(code, id) {
        return null
      },
    },
  }
}
```

Because `enforce` lives on the object your factory returns, a consumer cannot change the band from
the call site — a plugin that hard-codes `enforce: 'pre'` is band 2 for everyone, forever. Taking
it as an option costs one line and removes the only reason anyone would spread your plugin.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Spreading a preset

`{ ...framework(), enforce: 'pre' }` spreads an **array**. The key lands nowhere and nothing warns
you. Only plugin *objects* can be augmented.

### ⚠️ Pitfall 2 — Calling the factory twice

`{ ...example(), enforce: 'post' }` invokes `example()` at that spot. If the same import is also
listed unspread elsewhere in the array, you have **two** independent instances with independent
state — often two transforms, or two emitted assets.

### ⚠️ Pitfall 3 — Spreading a plugin that closes over `this`

A spread copies own enumerable properties. Hooks written as methods still work, because Vite calls
them with the plugin context. ⚠️ But a plugin whose factory returns an object holding private state
via a closure is fine, while one relying on a prototype chain or non-enumerable properties is not
— and the documentation does not discuss this case. Prefer the plugin's own options where they
exist.

### ⚠️ Pitfall 4 — Augmenting to work around a compatibility problem

`enforce` and `apply` change *when* a plugin runs, not *whether its hooks make sense*. A Rollup
plugin that misbehaves in dev because dev is unbundled is not fixed by `enforce: 'pre'`; it is
fixed by `apply: 'build'` or by not using it.

### ⚠️ Pitfall 5 — Losing the upstream name

The spread copies `name`, so debugging output still identifies the original plugin — which is
usually what you want, but means two differently-configured spreads of the same plugin are
indistinguishable in a plugin list. Add a comment; there is no documented way to rename safely.

---

## Gotchas

**★ Symptom: `enforce` set on a framework preset has no effect at all.** Cause: the preset returns
an array, and spreading an array does not produce a plugin object — the key lands nowhere. Fix:
set it on the specific member inside the preset's own array:
`[{ ...frameworkRefresh(cfg), enforce: 'pre' }, frameworkDevtools(cfg)]`.

**★ Symptom: after augmenting a third-party plugin, its work happens twice.** Cause: the factory
was invoked once for the spread and once for a leftover plain entry, producing two independent
instances. Fix: hold one instance — `const ex = example()` — then list exactly one of `ex` or
`{ ...ex, enforce: 'post' }`.

**★ Symptom: a consumer asks for your plugin to run "later" and there is no way to do it.** Cause:
`enforce` is baked into the object your factory returns. Fix: make it an option —
`export function myPlugin(opts: { enforce?: 'pre' | 'post' } = {}): Plugin`, then set
`enforce: opts.enforce` on the returned object.

**★ Symptom: a spread that worked breaks after upgrading the plugin.** Cause: the upstream factory
started returning an array — it became a preset — and the spread silently stopped delivering the
key. Fix: pin the assumption in code rather than in your head:
`const p = example(); if (Array.isArray(p)) throw new Error('example() is now a preset')`.

**★ Symptom: a build-only Rollup plugin still runs in dev despite `enforce: 'post'`.** Cause:
`enforce` is a band, not a phase — it never excluded anything from serve. Fix: `apply: 'build'`
alongside it, or move the plugin to `build.rolldownOptions.plugins`, which the docs describe as
working *"the same as a Vite plugin with `enforce: 'post'` and `apply: 'build'`"*.

---

## Interview questions

**★ How do you add `enforce` or `apply` to a third-party plugin you do not control?**
Spread it into a new object literal and add the Vite-only keys, exactly as the docs show:
`{ ...example(), enforce: 'post', apply: 'build' }`. A plugin is a plain object, so the spread
copies every hook and adds properties the original never had — a pure Rolldown plugin has no notion
of `enforce` or `apply` and would ignore them anyway. Two things break it: spreading a **preset**,
because that is an array, and accidentally invoking the factory twice, which yields two independent
instances. For a build-only Rolldown plugin the docs also offer `build.rolldownOptions.plugins`,
which *"will work the same as a Vite plugin with `enforce: 'post'` and `apply: 'build'`"*.

**★ Why is spreading preferred over forking or patching the dependency?**
Because `enforce` and `apply` are not part of the upstream plugin's interface at all — they are
Vite's, read off whatever object appears in the `plugins` array. A fork or a patch takes on
permanent maintenance for keys the upstream author will never add, and it drifts on every release.
The spread carries no maintenance: it is object literal semantics, it survives upgrades, and it is
the pattern the documentation itself demonstrates. The one thing to watch is that the upstream
factory keeps returning an object rather than becoming a preset.

**★ Someone spreads `@vitejs/plugin-react` to add `enforce`. What happens, and how would you catch
it in review?**
Nothing useful happens: the plugin is a preset, so the call returns an array, and spreading an
array into an object literal produces numeric keys plus a stray `enforce` that no plugin ever sees.
There is no error and no warning, so the reviewer's only signal is knowing that framework
integrations are usually presets — *"several plugins as a single element"* which Vite flattens
internally. The reliable review question is "does this factory return an object or an array?", and
the reliable fix is to reach inside the preset and augment the specific member that needs the band.

**★ When would you use `build.rolldownOptions.plugins` instead of the spread?**
When the plugin is meaningful only during a build, and you want that to be structural rather than a
property someone can delete. The docs say it *"will work the same as a Vite plugin with
`enforce: 'post'` and `apply: 'build'`"*, so the behaviour is identical — the difference is
communicative: a plugin sitting in the build options cannot be mistaken for part of the dev
pipeline, whereas `apply: 'build'` on a line in the main `plugins` array is one word that is easy
to drop in a merge. Use the main array when a reader benefits from seeing every plugin in one list.

**★ Your plugin hard-codes `enforce: 'pre'`. Why is that a design smell?**
Because you have made a decision on behalf of every consumer, in the one place they cannot reach.
If their app needs your transform to run after a framework's `'pre'` plugin, their only recourse is
to spread your plugin — which works until the day you start returning an array, at which point
their config silently stops applying the key. Taking `enforce` as an option, and defaulting it to
`undefined` so the plugin lands in the default band, costs one line and keeps the band a
configuration decision rather than a library decision.

---

← [`enforce` vs Hook `order`](01pa-enforce-vs-hook-order.md) · [Vite overview](../../README.md) · Next → [Conditional Application (`apply`)](01q-conditional-application.md)
