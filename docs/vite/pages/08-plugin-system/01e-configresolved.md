---
title: "`configResolved`: the Only Place the Final Config Exists, and It Is `parallel` So Nothing May Depend on Order"
sidebar_label: "`configResolved`"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `configResolved`](https://vite.dev/guide/api-plugin), [§ `config`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `configResolved`

* **Type:** `(config: ResolvedConfig) => void | Promise<void>`
* **Kind:** `async`, **`parallel`**
* **Scope:** **Global**

> *"Called after the Vite config is resolved. Use this hook to read and store the final resolved config. It is also useful when the plugin needs to do something different based on the command being run."* — [Plugin API](https://vite.dev/guide/api-plugin)

The type says everything the prose does not: it returns `void`. **This hook cannot change anything.**
Its entire job is to hand you the value [`config`](01d-config-and-configresolved.md) was not allowed
to see.

---

## 1. Under-The-Hood Mechanics

### The documented idiom: capture in the closure

```js
const examplePlugin = () => {
  let config

  return {
    name: 'read-config',
    configResolved(resolvedConfig) { config = resolvedConfig },
    transform(code, id) {
      if (config.command === 'serve') { /* dev */ } else { /* build */ }
    },
  }
}
```

🔴 **`let config` is declared in the factory, above the returned object.** Declaring it inside the
returned object — or re-declaring it per hook — is the most common way this idiom breaks, and the
symptom is `undefined` in a hook that runs before you expected.

> *"Note that the `command` value is `serve` in dev (in the cli `vite`, `vite dev`, and `vite serve` are aliases)."*

There is no `'dev'`. A comparison against it never matches and never errors.

### Why it exists at all

Because `config` receives *"the raw user config (CLI options merged with config file)"*. At that
point:

```
root      not absolutised
base      not normalised
plugins   not flattened (presets still nested)
defaults  not filled in
mode      known, but the resolved config is not built yet
```

Anything that needs **what Vite actually decided** must wait. That is the whole division of labour:
`config` influences the decision, `configResolved` observes it, and a plugin doing both is normal
rather than a smell.

### It is Global, not per-environment

Unlike every Rolldown hook ([chunk 1c](01c-per-environment-hooks.md)), `configResolved` is
documented as **Global** scope. It runs **once**, not once per environment — so a plugin that needs
per-environment behaviour gets it from `this.environment` inside the Rolldown hooks, never from a
second `configResolved` call that does not happen.

---


## 3. Production-Grade Code Example

```typescript
// The documented idiom, with the declaration in the right place.
import type { Plugin, ResolvedConfig } from 'vite';

export function acmeInstrument(): Plugin {
  // 🔴 In the FACTORY closure, above the returned object.
  //    Declaring it inside the object is how this idiom silently breaks.
  let config: ResolvedConfig;

  return {
    name: 'acme-instrument',

    // parallel · Global · returns void. Store, and do nothing else.
    configResolved(resolved) {
      config = resolved;
    },

    transform(code, id) {
      // `command` is 'serve' | 'build'. There is NO 'dev'.
      if (config.command === 'serve') return instrumentForDev(code, id);

      // The resolved config is the ONLY place these are trustworthy:
      // absolutised root, normalised base, filled-in defaults.
      if (id.startsWith(config.root)) return instrumentForBuild(code, id, config.base);
      return null;
    },
  };
}
```

```typescript
// Per-environment behaviour does NOT come from configResolved — it is Global
// and runs once. It comes from `this.environment` inside a Rolldown hook.
transform(code, id) {
  const isSsr = this.environment?.name === 'ssr';
  return isSsr ? compileForServer(code) : compileForClient(code);
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Declaring the captured variable in the wrong scope

`let config` belongs in the factory closure. Inside the returned object, or per hook, it is
`undefined` wherever you actually needed it.

### ⚠️ Pitfall 2 — Trying to change the config here

The type returns `void`. Mutating the `ResolvedConfig` you were handed is not a supported way to
change behaviour — resolution is over, and consumers may already hold derived values.

### ⚠️ Pitfall 3 — Expecting a call per environment

It is **Global** and runs once. Per-environment behaviour comes from `this.environment` inside the
Rolldown hooks, which *are* per-environment.

### ⚠️ Pitfall 4 — Reading resolved values in `config` instead

`config` receives the raw user config: unabsolutised `root`, unnormalised `base`, unflattened
plugins, unfilled defaults. Reading them there gives plausible wrong answers rather than errors.

---

## Gotchas

**★ Symptom: a plugin stores the config in `configResolved` and other hooks see `undefined`.** Cause: the variable is declared inside the returned object rather than the factory closure, or a hook ran before `configResolved` completed. Fix: declare `let config` in the **factory**, above the returned object, as the docs' own example does.

```ts
export function p(): Plugin { let config: ResolvedConfig; return { /* … */ }; }
```

**★ Symptom: `config.command === 'dev'` never matches.** Cause: the value is `'serve'`; `vite`, `vite dev` and `vite serve` are aliases. Fix: compare against `'serve'`. A branch that never runs produces no diagnostic anywhere.

**★ Symptom: `config.root` is relative or `undefined` where you read it.** Cause: it was read in `config`, which receives the raw user config before resolution. Fix: read it in `configResolved`, the only place the absolutised value exists.

**★ Symptom: mutating the object passed to `configResolved` has no effect, or an inconsistent one.** Cause: resolution is complete and the hook returns `void`; other consumers may already hold values derived from it. Fix: make the change in `config`, before resolution.

**★ Symptom: a plugin needs different behaviour for SSR and `configResolved` only fires once.** Cause: it is documented **Global**. Fix: branch on `this.environment` inside `transform`/`load`/`resolveId`, which are per-environment. There is no second `configResolved`.

**★ Symptom: a plugin logs the resolved config and the output is enormous.** Cause: `ResolvedConfig` contains every plugin instance, the full resolved alias table and internal state. Fix: log the two or three fields you need. Serialising the whole thing can also throw on circular references, which turns a debug line into a build failure.

**★ Symptom: a `configResolved` that reads a file makes cold starts slower for everyone.** Cause: it is `async` and Vite awaits all of them before proceeding — `parallel` means unordered, not skipped. Fix: defer the read to the first hook that needs it, and memoise. `configResolved` is a good place to *decide* to do work later and a poor place to do it.

---

## Interview questions

**★ Why do many plugins implement both `config` and `configResolved`?**
Because they do different halves of one job. `config` receives *"the raw user config (CLI options
merged with config file)"* and can change it; `configResolved` receives the final resolved config
and returns `void`. So a plugin that wants to *influence* a decision acts in `config`, and one that
needs to know *what was decided* — the absolutised `root`, the normalised `base`, whether this is a
build — must wait for `configResolved` and stash it in the factory closure, which is exactly the
idiom the docs' own example demonstrates. Needing both is the normal case, not a design smell.

**★ Why does `configResolved` return `void`?**
Because the config is *resolved* — the decision is over. Allowing a return value would mean either
re-resolving (which would re-run everything that already ran) or applying a partial change on top of
a value other consumers may already have derived from, which is how you get two components of the
same build disagreeing about `base`. The `void` return is the API stating that this is an
observation point, not a decision point, and the corresponding design rule is clean: if you want to
change something, you must do it before resolution, in `config`.

**★ A plugin needs to behave differently for the SSR build. Where does that branch go?**
Not in `configResolved`, which is **Global** and runs once regardless of how many environments
exist. It goes in a Rolldown hook — `transform`, `load`, `resolveId` — via `this.environment`,
because *"all rolldown hooks are per-environment hooks"* and those are the invocations that actually
happen twice. The `config` hook's `env` argument also carries `isSsrBuild`, which is the right signal
for a *configuration* difference rather than a per-module one; it is optional, so compare it against
`true` explicitly rather than relying on truthiness.

---

← [The `config` Hook](01d-config-and-configresolved.md) · [Vite overview](../../README.md) · Next → [Hook Kinds & Guarantees](01f-hook-kinds-and-ordering-guarantees.md)
