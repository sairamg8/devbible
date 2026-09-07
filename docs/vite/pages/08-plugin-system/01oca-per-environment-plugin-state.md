---
title: "One plugin instance serves every environment, so any state you keep is shared by all of them — the documented fix is a `Map` keyed by `this.environment`, and two hooks need an opt-in flag before they fire per environment at all"
sidebar_label: "Per-environment Plugin State"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API § Per-environment State in Plugins](https://vite.dev/guide/api-environment-plugins) (the shared-instance rule, the `Map` pattern, the documented example and the two `perEnvironment*DuringDev` flags) and § Per-environment Hooks and Global Hooks. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Per-environment Plugin State

[`hotUpdate`](01oc-hotupdate-environment-hook.md) is called once per environment, and so is every
other per-environment hook. That is a statement about **your variables**, not just about the call
count: the plugin object is constructed once and handed to all of them. Which hooks fire per
environment — and the two that do not, by default — is
[Which Hooks Fire Per Environment](01ocb-which-hooks-fire-per-environment.md).

---

## 1. Under-The-Hood Mechanics

### 🔴 The shared-instance rule

> *"Given that the same plugin instance is used for different environments, the plugin state needs
> to be keyed with `this.environment`. This is the same pattern the ecosystem has already been using
> to keep state about modules using the `ssr` boolean as key to avoid mixing client and ssr modules
> state. A `Map<Environment, State>` can be used to keep the state for each environment separately."*

The historical note explains why the shape looks familiar:

> *"Given that there were only two Environments until Vite 6 (`client` and `ssr`), a `ssr` boolean
> was enough to identify the current environment in Vite APIs."*

The boolean became a key because there could be more than two. `let previous = …` in a plugin module
is the pre-Vite-6 assumption with the key removed entirely.

### The documented pattern, verbatim

```js
function PerEnvironmentCountTransformedModulesPlugin() {
  const state = new Map<Environment, { count: number }>()
  return {
    name: 'count-transformed-modules',
    perEnvironmentStartEndDuringDev: true,
    buildStart() {
      state.set(this.environment, { count: 0 })
    },
    transform(id) {
      state.get(this.environment).count++
    },
    buildEnd() {
      console.log(this.environment.name, state.get(this.environment).count)
    }
  }
}
```

Three things are worth reading off that example rather than skimming past. The `Map` lives in the
factory closure, not at module scope, so two instances of the plugin do not share it. Every access
is `state.get(this.environment)`, which makes the assumption visible at each use site. And the plugin
sets a flag — which is the next section.

### Ordering

> *"the HMR algorithm is run for each environment in series according to the order in
> `server.environments`"*

Environments are processed in series, so one invocation can observe the side effects of another.
That is a reason to have no side effects rather than a reason to learn the order.

---

## 2. Real-World Engineering Scenario

**A cache that was wrong on every second save.**

A plugin diffed a manifest on change and cached the previous version:

```ts
let previousManifest: Record<string, string> = {};   // ⛔ one variable, every environment
```

With a client and an SSR environment, the hook ran twice per save. The client invocation compared
against the correct baseline and wrote the new manifest into the cache; the SSR invocation then read
that *already-updated* value, found no differences, and wrote it back. On the next save the client's
baseline was whatever the SSR pass had left, so the diff reported changes that had not happened and
missed ones that had.

The behaviour looked random because it depended on how many keys changed and in what order the
environments ran. It was reported as "HMR is flaky", investigated as a watcher problem, and fixed in
four lines once someone read *"the same plugin instance is used for different environments"*.

**The transferable point:** keying state by environment is only half the pattern. The other half is
knowing which hooks actually fire per environment, because two of the obvious initialisation points
do not — by default.

---

## 3. Production-Grade Code Example

```typescript
// ✅ The documented pattern, with the flag that makes the initialisation hook fire.
import type { Plugin, Environment } from 'vite';

interface ManifestState { previous: Record<string, string> }

export function manifestDiff(): Plugin {
  // In the factory closure, so two instances of this plugin do not share it.
  const state = new Map<Environment, ManifestState>();

  return {
    name: 'manifest-diff',

    // Without this, buildStart runs for the client environment only in dev.
    perEnvironmentStartEndDuringDev: true,

    buildStart() {
      state.set(this.environment, { previous: {} });
    },

    async hotUpdate({ file, read, modules }) {
      if (!file.endsWith('.manifest.json')) return;

      // Defensive read: works even if the initialisation hook did not run.
      const mine = state.get(this.environment) ?? { previous: {} };
      state.set(this.environment, mine);

      let next: Record<string, string>;
      try {
        next = JSON.parse(await read());
      } catch {
        return;
      }

      const changed = Object.keys(next).filter((k) => next[k] !== mine.previous[k]);
      mine.previous = next;

      return modules.filter((mod) => changed.some((key) => mod.id?.includes(key)));
    },
  };
}
```

```typescript
// ✅ Lazy initialisation removes the dependency on buildStart entirely.
function stateFor(map: Map<Environment, ManifestState>, env: Environment): ManifestState {
  let s = map.get(env);
  if (!s) {
    s = { previous: {} };
    map.set(env, s);
  }
  return s;
}
// Then every hook body starts with: const mine = stateFor(state, this.environment);
```

```typescript
// ⛔ Two module-scope variables and one missing flag.
let previousManifest = {};                 // 1. shared by every environment
let initialised = false;                   // 2. "run once" — kills the 2nd environment

export const bad: Plugin = {
  name: 'manifest-diff-broken',
  // 3. no perEnvironmentStartEndDuringDev, so buildStart is client-only in dev
  buildStart() { initialised = true; },
  hotUpdate({ modules }) {
    if (!initialised) return;
    return modules;
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Module-scope state in a per-environment hook

*"the same plugin instance is used for different environments"*, so one variable is one variable for
all of them. Key it with `this.environment`.

### ⚠️ Pitfall 2 — Threading your own `ssr` boolean

That was the pre-Vite-6 shape: *"a `ssr` boolean was enough to identify the current environment"*.
With more than two environments possible it is not, and the documented replacement is
`this.environment` plus `environment.config`.

### ⚠️ Pitfall 3 — Putting the `Map` at module scope

The documented example declares it inside the factory. At module scope it is shared by every
instance of the plugin in the process, which matters as soon as a monorepo builds two apps in one
Node process.

### ⚠️ Pitfall 4 — A "run once" boolean

Any `if (done) return;` in a per-environment hook is a decision to serve exactly one environment.
The environment that runs second gets nothing, and the symptom is a correct client and a stale SSR
render.

### ⚠️ Pitfall 5 — Holding environments alive in a long-lived `Map`

A `Map` keyed by environment keeps a strong reference to it. The `applyToEnvironment` example in the
same documentation comments its state as `WeakMap<Environment,Data>` — worth preferring when the
plugin outlives individual environments and the entry is a cache rather than required state.

---

## Gotchas

**★ Symptom: a cached diff baseline is wrong on every second save.** Cause: module-scope state shared across environments, because *"the same plugin instance is used for different environments"*. Fix: `new Map<Environment, State>()` in the factory closure, keyed by `this.environment`.

**★ Symptom: two apps built in one process interfere with each other's plugin state.** Cause: the `Map` was declared at module scope instead of inside the plugin factory. Fix: move it into the factory, as the documented example does.

**★ Symptom: an SSR-specific transform never applies.** Cause: a hand-threaded `ssr` boolean that no longer describes the environment set. Fix: branch on `this.environment.config`, the documented replacement for the boolean.

**★ Symptom: a plugin behaves differently depending on which environment is configured first.** Cause: side effects in a hook that runs *"in series according to the order in `server.environments`"*. Fix: remove the side effect; do not encode the order.

**★ Symptom: memory grows across a long dev session with many environment restarts.** Cause: a `Map` keyed by environment holds each one strongly. Fix: a `WeakMap<Environment, Data>` for cache-shaped state, as the documentation's own `applyToEnvironment` example comments.

**★ Symptom: the client output is correct and the SSR output is stale.** Cause: an `if (done) return;` guard added because the hook "ran twice". Fix: delete the guard; per-environment invocation is the documented behaviour.

---

## Interview questions

**★ Why does per-environment scope force a different shape of plugin state?**
Because the plugin object is constructed once and used for every environment: *"the same plugin
instance is used for different environments, the plugin state needs to be keyed with
`this.environment`"*. A module-scope variable is therefore one variable shared by all of them, so a
cache written during the client invocation is overwritten by the SSR invocation and the next
comparison runs against the wrong baseline. The documented shape is a `Map<Environment, State>`
declared inside the plugin factory, which also makes the assumption explicit at each use site —
`state.get(this.environment)` says what the code depends on in a way that a bare `let previous`
never does.

**★ Where should the `Map` live, and why not at module scope?**
Inside the plugin factory function, which is where the documented example puts it. At module scope it
is shared by every instance of the plugin in the Node process, so two builds in one process — a
monorepo running two apps, a test suite constructing the plugin repeatedly — read each other's state.
Inside the factory, each call to the factory gets its own map and the sharing is exactly one plugin
instance across its own environments, which is the sharing the pattern is designed for. It is a small
placement detail with a failure mode that only appears under concurrency, which is why it is worth
naming rather than leaving to habit.

**★ What does `this.environment` give you beyond an identity to key a map with?**
Its resolved configuration. The docs say *"a plugin could use the `environment` instance to change
how a module is processed depending on the configuration for the environment (which can be accessed
using `environment.config`)"*, and the example reads `this.environment.config.resolve.conditions`
inside `transform`. That is the documented replacement for the pre-Vite-6 `ssr` boolean: instead of
branching on which of two environments you are in, you branch on what this environment is actually
configured to do, which stays correct when a project adds a third. It also scopes the APIs that used
to take a boolean — `environment.moduleGraph.getModuleByUrl(url)` rather than passing `{ ssr }`.

**★ When would you use a `WeakMap` instead?**
When the state is a cache rather than something the plugin requires, and environments can be created
and discarded over the life of the process. A `Map` keyed by environment holds a strong reference to
every environment it has ever seen, so entries — and the environments themselves — outlive their
usefulness. Vite's own documentation reaches for `WeakMap<Environment,Data>` in the
`applyToEnvironment` example's comment, which is a reasonable signal. The trade is that a `WeakMap`
cannot be enumerated, so if you ever need to iterate every environment's state — to log a summary in
`buildEnd`, for instance — the `Map` is the right structure and the lifetime concern has to be
handled another way.

---

← [The `hotUpdate` Hook](01oc-hotupdate-environment-hook.md) · [Vite overview](../../README.md) · Next → [Which Hooks Fire Per Environment](01ocb-which-hooks-fire-per-environment.md)
