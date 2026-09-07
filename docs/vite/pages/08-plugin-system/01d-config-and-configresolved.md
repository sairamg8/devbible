---
title: "`config`: the Hook That Runs Too Early to Add Plugins, and Fails Silently When You Try"
sidebar_label: "The `config` Hook"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `config`](https://vite.dev/guide/api-plugin), [§ `configResolved`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The `config` Hook

`config` runs **before** the config is resolved: it can change what Vite is about to decide, and it
cannot see what Vite decided. Its sibling [`configResolved`](01e-configresolved.md) is the exact
mirror — it sees the final config and cannot change it. Most plugins that need one eventually need
both.

---

## 1. Under-The-Hood Mechanics

### `config` — change it, before it is settled

* **Type:** `(config: UserConfig, env: { mode: 'build' | 'serve', command: string, isSsrBuild?: boolean, isPreview?: boolean }) => UserConfig | null | void`
* **Kind:** `async`, **`sequential`**
* **Scope:** **Global**

> *"Modify Vite config before it's resolved. The hook receives the raw user config (CLI options merged with config file) and the current config env which exposes the `mode` and `command` being used. It can return a partial config object that will be deeply merged into existing config, or directly mutate the config (if the default merging cannot achieve the desired result)."*

Two forms, and the docs label the preferred one:

```js
// return partial config (recommended)
const partialConfigPlugin = () => ({
  name: 'return-partial',
  config: () => ({ resolve: { alias: { foo: 'bar' } } }),
})

// mutate the config directly (use only when merging doesn't work)
const mutateConfigPlugin = () => ({
  name: 'mutate-config',
  config(config, { command }) {
    if (command === 'build') { config.root = 'foo' }
  },
})
```

**Return a partial; mutate only when a deep merge cannot express what you want** — which is
essentially only *removal* and *replacement*, since merging can add anything.

🔴 **The warning that catches everyone:**

> *"User plugins are resolved before running this hook so injecting other plugins inside the `config` hook will have no effect."*

You cannot add plugins from `config`. The plugin list is already fixed by the time your hook runs.
That is exactly what someone building a "meta-plugin" reaches for first, and it silently does
nothing — no error, no warning, an empty array position. The supported way to ship several plugins
as one is a **preset**: return an array from your factory, which
[chunk 1a](01a-plugin-conventions.md) covers.

### `sequential` vs `parallel` is not a footnote

```
config          → sequential   each plugin's hook awaits the previous one.
                               Order matters. Your merge sees earlier plugins' merges.

configResolved  → parallel     all plugins' hooks may run concurrently.
                               Order is NOT guaranteed. Do not sequence side effects here.
```

A `configResolved` that writes a file, mutates shared state, or assumes another plugin's
`configResolved` already ran is relying on something the docs explicitly do not promise.

### Why you need `configResolved` at all

Because `config` receives *"the raw user config (CLI options merged with config file)"* — not the
resolved one. Defaults are not filled in, `root` is not absolutised, `base` is not normalised,
plugins are not flattened. Any plugin that needs to know **what Vite actually decided** must wait
for `configResolved`, and any plugin that wants to **influence** that decision must act in `config`.
Needing both is normal.

---

## 2. Real-World Engineering Scenario

**A meta-plugin that installed nothing, for two weeks.**

A platform team wanted one package that configured everything: aliases, a set of internal plugins, a
sensible `build.target`. They wrote it as a single plugin with a `config` hook:

```js
config(config) {
  config.resolve = { ...config.resolve, alias: internalAliases };
  config.plugins = [...(config.plugins ?? []), instrumentation(), telemetry()];
}
```

The aliases worked. The two plugins did not. No error, no warning — `instrumentation()` and
`telemetry()` simply never ran, and because they were both silent-by-design (one added a transform
that was a no-op for most files, one only reported), nobody noticed for two weeks. It surfaced when
a dashboard that should have had data had none.

The cause is one sentence in the docs: *"User plugins are resolved before running this hook so
injecting other plugins inside the `config` hook will have no effect."* By the time `config` runs,
the plugin list is settled. Pushing onto `config.plugins` mutates an array nobody reads again.

The supported answer was already available and shorter — a **preset**, since *"`plugins` also
accepts presets including several plugins as a single element"* and *"the array will be flattened
internally"*:

```js
export function platform(opts) {
  return [aliasPlugin(opts), instrumentation(), telemetry()];
}
```

**The transferable point:** a hook that silently does nothing is worse than one that throws, and the
defence is to read the hook's *Note* blocks — this one is a `::: warning` in the docs and it is the
single most consequential sentence in the `config` section.

---

## 3. Production-Grade Code Example

```typescript
// A plugin that both INFLUENCES the config and READS the result.
// Needing both hooks is normal, not a smell.
import type { Plugin, ResolvedConfig } from 'vite';

export function acmePlatform(): Plugin {
  // The documented idiom: capture in the closure, read from other hooks.
  let config: ResolvedConfig;

  return {
    name: 'acme-platform',

    // sequential. Return a PARTIAL — deep-merged for you.
    // ⛔ Do NOT push onto config.plugins here: "injecting other plugins inside
    //    the config hook will have no effect."
    config(_userConfig, { command, mode }) {
      return {
        resolve: { alias: { '@acme': '/src/acme' } },
        build: { target: command === 'build' ? 'es2022' : undefined },
        define: { __MODE__: JSON.stringify(mode) },
      };
    },

    // parallel. Read-only in practice — store what you need.
    configResolved(resolved) {
      config = resolved;
    },

    transform(code, id) {
      // `command` is 'serve' | 'build'. There is NO 'dev'.
      if (config.command === 'serve') return instrumentForDev(code, id);
      return null;
    },
  };
}
```

```typescript
// ✅ The supported way to ship several plugins as one: a PRESET.
// The factory returns an ARRAY; "the array will be flattened internally".
export function platform(opts: PlatformOptions) {
  return [acmePlatform(), instrumentation(opts), telemetry(opts)];
}

// vite.config.ts
export default defineConfig({ plugins: [platform({ /* … */ })] });
```

```typescript
// When mutation is legitimate: removal and replacement, which a deep merge
// cannot express. The docs allow it — "use only when merging doesn't work".
config(config, { command }) {
  if (command === 'build') {
    // A merge can ADD an external; it cannot REPLACE the whole array.
    config.build ??= {};
    config.build.rolldownOptions ??= {};
    config.build.rolldownOptions.external = ['react', 'react-dom'];
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Adding plugins from `config`

*"User plugins are resolved before running this hook so injecting other plugins inside the `config`
hook will have no effect."* It fails silently. Use a preset.

### ⚠️ Pitfall 2 — Mutating when a partial return would do

The docs mark returning a partial as *recommended* and mutation as *"use only when merging doesn't
work"*. Mutation skips the deep merge, so you overwrite what other plugins contributed rather than
combining with it.

### ⚠️ Pitfall 3 — Comparing `command` against `'dev'`

The value is `'serve'`; `vite`, `vite dev` and `vite serve` are CLI aliases that all produce it. A
comparison against `'dev'` never matches and never errors.

### ⚠️ Pitfall 4 — Reading `config` expecting resolved values

`config` receives *"the raw user config (CLI options merged with config file)"*. Defaults are unfilled,
`root` is not absolutised. Anything needing what Vite actually decided belongs in `configResolved`.

### ⚠️ Pitfall 5 — Assuming `config` is per-environment

It is documented **Global**, along with `configResolved`. It runs once, not once per environment —
unlike every Rolldown hook ([chunk 1c](01c-per-environment-hooks.md)).

---

## Gotchas

**★ Symptom: plugins pushed onto `config.plugins` never run, with no error.** Cause: *"User plugins are resolved before running this hook so injecting other plugins inside the `config` hook will have no effect."* Fix: return an array from your factory — a preset — which Vite flattens.

```js
export function platform(o) { return [core(o), instrumentation(), telemetry()]; }
```

**★ Symptom: a `config` hook overwrites an alias another plugin added.** Cause: direct mutation replaces rather than merging. Fix: return a partial and let Vite deep-merge; reserve mutation for removal and replacement, which merging cannot express.

**★ Symptom: `config.command === 'dev'` never matches.** Cause: the value is `'serve'`; `vite`, `vite dev` and `vite serve` are aliases. Fix: compare against `'serve'`. A branch that never runs produces no diagnostic anywhere.

**★ Symptom: `config.root` is `undefined` or relative inside the `config` hook.** Cause: the hook receives the raw user config, before resolution. Fix: read it in `configResolved`, where the resolved value exists — and if you need it to *decide* something in `config`, derive it yourself rather than expecting Vite to have done it.

**★ Symptom: a `config` hook's returned partial is ignored for one option.** Cause: deep merging has semantics per option — arrays and scalars do not merge the same way. Fix: this is where mutation is legitimate; the docs sanction it for exactly the cases *"the default merging cannot achieve"*.

**★ Symptom: an SSR-specific `config` tweak applies to the client build too.** Cause: `config` is Global and runs once, so `isSsrBuild` on the `env` argument is the only signal available — not a separate invocation per environment. Fix: branch on `env.isSsrBuild === true`, explicitly, since it is optional and can be `undefined`.

**★ Symptom: a meta-plugin package works when its plugins are listed manually and not when it is used as one entry.** Cause: it tried to inject via `config` instead of returning an array. Fix: the preset form. It is also shorter, which is the tell that it was the intended design all along.

---

## Interview questions

**★ Why can't you add plugins from the `config` hook?**
Because plugin resolution has already happened by the time it runs — the docs say so directly:
*"User plugins are resolved before running this hook so injecting other plugins inside the `config`
hook will have no effect."* The ordering is forced: Vite must know the plugin list in order to call
`config` on each of them, so the list cannot be a product of those calls. What makes it a trap rather
than a limitation is that it fails **silently** — pushing onto `config.plugins` mutates an array
nobody reads again, so a "meta-plugin" appears to install and does not. The supported mechanism is a
preset: return an array from your factory, and Vite flattens it.

**★ When is mutating the config legitimate rather than returning a partial?**
When the change is a **removal or a replacement**, because a deep merge can only add. Replacing an
`external` array, dropping an option another plugin set, or forcing a value that would otherwise be
merged with a user's are the real cases — and the docs bound it exactly that way: *"directly mutate
the config (if the default merging cannot achieve the desired result)"*, with returning a partial
marked *recommended*. The cost of reaching for mutation by default is that you stop composing: your
plugin overwrites what earlier plugins contributed instead of combining with it, and the resulting
bug is order-dependent and invisible in isolation.

**★ What is wrong with `if (config.command === 'dev')`?**
It never matches. The docs note that *"the `command` value is `serve` in dev (in the cli `vite`,
`vite dev`, and `vite serve` are aliases)"* — the API describes what Vite is doing, running a server
or producing a build, rather than which word you typed. The reason it is worth calling out is that a
branch which never runs generates no error, no warning and no failing test; the plugin simply does
half of what it claims. It is the same class of defect as the silent plugin injection above, and the
same defence applies: read the hook's notes, because Vite documents its footguns adjacent to the
things that trigger them.

---

← [Per-Environment & `importer`](01c-per-environment-hooks.md) · [Vite overview](../../README.md) · Next → [`configResolved`](01e-configresolved.md)
