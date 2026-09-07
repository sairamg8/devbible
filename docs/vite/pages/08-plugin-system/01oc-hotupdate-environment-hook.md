---
title: "`hotUpdate` is the environment-scoped form of the same hook — it runs once per environment in series, exposes `this.environment`, and adds the one field `HmrContext` never had: whether the file was created, updated or deleted"
sidebar_label: "The `hotUpdate` Hook"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API § The `hotUpdate` Hook](https://vite.dev/guide/api-environment-plugins) (Type/Kind/Scope, `HotUpdateOptions`, the two documented recipes and the per-environment state guidance) and [Plugin API § `handleHotUpdate`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The `hotUpdate` Hook

[`handleHotUpdate`](01o-handle-hot-update.md) and its
[full-reload recipe](01ob-hmr-full-reload-and-invalidation.md) are documented on the Plugin API page.
The Environment API page documents a second hook that does the same job with an environment attached
to it — and the differences are small enough to copy over by accident and large enough to cause a
reload loop when you do. The state such a plugin may keep is
[Per-environment Plugin State](01oca-per-environment-plugin-state.md).

---

## 1. Under-The-Hood Mechanics

### The signature block, verbatim

> *"**Type:** `(this: { environment: DevEnvironment }, options: HotUpdateOptions) => Array<EnvironmentModuleNode> | void | Promise<Array<EnvironmentModuleNode> | void>`"*
> *"**Kind:** `async`, `sequential`"*
> *"**Scope:** [Per-environment](https://vite.dev/guide/api-environment-plugins#per-environment-hooks-and-global-hooks)"*
> *"**See also:** [HMR API](https://vite.dev/guide/api-hmr)"*

The `this` type is the whole point: the hook is handed the environment it is currently running for.

> *"The `hotUpdate` hook allows plugins to perform custom HMR update handling for a given
> environment. When a file changes, the HMR algorithm is run for each environment in series
> according to the order in `server.environments`, so the `hotUpdate` hook will be called multiple
> times."*

**Called multiple times, in series, once per environment.** Every design decision below follows from
that sentence.

### The options object

```ts
interface HotUpdateOptions {
  type: 'create' | 'update' | 'delete'
  file: string
  timestamp: number
  modules: Array<EnvironmentModuleNode>
  read: () => string | Promise<string>
  server: ViteDevServer
}
```

Two differences from `HmrContext` matter:

- **`type: 'create' | 'update' | 'delete'`** — `HmrContext` has no equivalent, so a plugin on
  `handleHotUpdate` cannot tell a deletion from an edit from the context alone.
- **`modules` is `Array<EnvironmentModuleNode>`**, described as *"an array of modules **in this
  environment** that are affected by the changed file"* — the same file yields a different array per
  environment.

The two shared caveats are documented in identical words on both pages: the array is an array
*"because a single file may map to multiple served modules (e.g. Vue SFCs)"*, and `read` exists
because *"the file change callback may fire too fast before the editor finishes updating the file,
and direct `fs.readFile` will return empty content"*.

> *"`this.environment` is the module execution environment where a file update is currently being
> processed."*

### The same two recipes, environment-scoped

```js
hotUpdate({ modules, timestamp }) {
  if (this.environment.name !== 'client')
    return

  // Invalidate modules manually
  const invalidatedModules = new Set()
  for (const mod of modules) {
    this.environment.moduleGraph.invalidateModule(
      mod,
      invalidatedModules,
      timestamp,
      true
    )
  }
  this.environment.hot.send({ type: 'full-reload' })
  return []
}
```

| `handleHotUpdate` | `hotUpdate` |
|---|---|
| `server.moduleGraph` | `this.environment.moduleGraph` |
| `server.ws.send(…)` | `this.environment.hot.send(…)` |
| no environment guard | `if (this.environment.name !== 'client') return` |
| no `type` field | `type: 'create' \| 'update' \| 'delete'` |

🔴 **The guard is the load-bearing line.** A full reload is a browser instruction, so it belongs to
the client environment only; without the guard, the SSR environment's invocation sends one too. The
custom-event recipe on the same page carries the identical guard.

### Is `handleHotUpdate` deprecated?

⚠️ **The documentation does not say so.** The Plugin API page documents `handleHotUpdate` with no
deprecation notice; the Environment API page documents `hotUpdate` with no statement about
superseding it; neither names a removal version. Both are documented for **Vite 8.2.2**. What the
sources do show is that `hotUpdate` is the one with the environment context, the newer module type
and the `type` field — which is a reason to prefer it for new plugins without asserting anything the
docs do not.

---

## 2. Real-World Engineering Scenario

**The SSR reload storm.**

A team ported a working `handleHotUpdate` plugin to `hotUpdate` and dropped the
`if (this.environment.name !== 'client') return` line, on the grounds that it looked like defensive
noise copied from an example. The hook then ran *"for each environment in series"*, so a project with
client and SSR environments sent a browser reload instruction twice per save — once legitimately,
once from an environment that has no browser.

That alone would have been merely redundant. What made it a storm was the plugin's other job: it
regenerated a manifest file inside `src/` on each run. The extra invocation regenerated it again,
the watcher saw a second write, and the cycle restarted. Saving one component produced a page that
reloaded until the dev server was killed.

**The transferable point:** porting between these two hooks is not a rename. `handleHotUpdate` runs
in a world with one implicit environment; `hotUpdate` makes the environment explicit and then calls
you once for each one. Every line that assumed "once" has to be re-read.

---

## 3. Production-Grade Code Example

```typescript
// ✅ hotUpdate: guarded, environment-keyed state, all three return shapes used correctly.
import type { Plugin, Environment } from 'vite';

interface ManifestState { previous: Record<string, string> }

export function manifestHmr(): Plugin {
  // Documented pattern: one entry per environment, not one shared scalar.
  const state = new Map<Environment, ManifestState>();

  return {
    name: 'manifest-hmr',

    async hotUpdate({ type, file, modules }) {
      // 1. A browser instruction belongs to the client environment only.
      if (this.environment.name !== 'client') return;

      // 2. Cheap ownership guard — the hook is sequential and sees every change.
      if (!file.endsWith('.manifest.json')) return;

      // 3. `type` exists here and has no equivalent in HmrContext.
      if (type === 'delete') {
        this.environment.hot.send({ type: 'full-reload' });
        return [];
      }

      const mine = state.get(this.environment) ?? { previous: {} };
      state.set(this.environment, mine);

      let next: Record<string, string>;
      try {
        next = JSON.parse(await this.read());
      } catch {
        return;                                  // abstain, never `[]`
      }

      const changed = Object.keys(next).filter((k) => next[k] !== mine.previous[k]);
      mine.previous = next;

      return modules.filter((mod) => changed.some((key) => mod.id?.includes(key)));
    },
  };
}
```

```typescript
// ⛔ The port that caused the storm.
let previousManifest = {};                       // 1. shared across environments

export const bad: Plugin = {
  name: 'manifest-hmr-broken',
  hotUpdate({ modules, timestamp }) {
    // 2. no environment guard: SSR sends a browser reload too
    const invalidatedModules = new Set();
    for (const mod of modules) {
      this.environment.moduleGraph.invalidateModule(mod, invalidatedModules, timestamp, true);
    }
    // 3. regenerates a watched file on every invocation, so the extra call re-triggers the watcher
    writeManifest(previousManifest);
    this.environment.hot.send({ type: 'full-reload' });
    return [];
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Dropping the environment guard when porting

`if (this.environment.name !== 'client') return` is in both documented `hotUpdate` recipes. The hook
runs *"for each environment in series"*, and a browser reload issued from the SSR environment is at
best redundant and at worst a loop.

### ⚠️ Pitfall 2 — Assuming `handleHotUpdate` can tell a delete from an edit

It cannot: `HmrContext` has no `type` field. `HotUpdateOptions` has
`type: 'create' | 'update' | 'delete'`, so a plugin that must distinguish them needs this hook.

### ⚠️ Pitfall 3 — Reusing a `ModuleNode` type

`hotUpdate` returns `Array<EnvironmentModuleNode>` and `handleHotUpdate` returns
`Array<ModuleNode>`. A port that keeps the old annotation compiles only until the two types diverge,
and the annotation is then a false statement about what the hook receives.

### ⚠️ Pitfall 4 — Calling `handleHotUpdate` "deprecated" in a review

The documentation does not say it. Prefer `hotUpdate` for new plugins on the merits — environment
context, `type`, per-environment module nodes — and say that, rather than asserting a deprecation
the sources do not support.

---

## Gotchas

**★ Symptom: after porting to `hotUpdate`, saves cause repeated reloads.** Cause: the environment guard was dropped and the hook runs *"for each environment in series"*. Fix: `if (this.environment.name !== 'client') return;` as the first line.

**★ Symptom: `this.environment` is undefined.** Cause: it is a property of the `hotUpdate` hook's context, not of `handleHotUpdate`. Fix: use `ctx.server` in `handleHotUpdate`, or move the plugin to `hotUpdate`.

**★ Symptom: the plugin cannot tell a deleted file from an edited one.** Cause: `HmrContext` has no `type` field. Fix: use `hotUpdate`, whose `HotUpdateOptions` carries `type: 'create' | 'update' | 'delete'`.

**★ Symptom: `this.read()` is not a function.** Cause: `read` is a field of the options object, not a method on `this`. Fix: destructure it — `async hotUpdate({ read }) { const src = await read(); }`.

**★ Symptom: a TypeScript error about `ModuleNode` vs `EnvironmentModuleNode` after a port.** Cause: the two hooks use different module node types. Fix: annotate with `EnvironmentModuleNode` for `hotUpdate`; do not cast between them.

---

## Interview questions

**★ What changes when you write a full-reload handler as `hotUpdate` instead of `handleHotUpdate`?**
Three things, and one of them matters. `server.moduleGraph` becomes `this.environment.moduleGraph`
and `server.ws.send` becomes `this.environment.hot.send`, which are mechanical. The one that matters
is the added first line, `if (this.environment.name !== 'client') return`, because the hook is called
once per environment — *"the HMR algorithm is run for each environment in series according to the
order in `server.environments`"* — and a full page reload is a browser instruction only the client
environment should issue. The context is also richer: `HotUpdateOptions` carries
`type: 'create' | 'update' | 'delete'`, which `HmrContext` has no equivalent of, and `modules` is
scoped to the current environment.

**★ Is `handleHotUpdate` deprecated in Vite 8?**
The documentation does not say so. The Plugin API page documents `handleHotUpdate` with no
deprecation notice, and the Environment API page documents `hotUpdate` alongside it, also without
one; neither names a removal version. What can be said from the sources is narrower and more useful:
`hotUpdate` is the environment-scoped hook, it carries the newer context types
(`EnvironmentModuleNode`, plus a `type` field the older context lacks), and its documented examples
use the per-environment idioms. For new plugins on Vite 8 that is a reason to prefer it; calling the
older hook deprecated would be asserting something the documentation does not.

**★ What does the `type` field let you do that `handleHotUpdate` cannot?**
Distinguish a create from an update from a delete, which is the difference between "re-read this
file" and "this file no longer exists". Without it, a plugin that caches per-file data cannot know
when to evict an entry, and a plugin that generates code from a directory cannot tell a removal from
an edit — both usually end up doing a full rescan on every change, which is slower and still wrong
for the delete case. `handleHotUpdate` has no equivalent in `HmrContext`, so the only way to get
this information from a documented API is the environment-scoped hook.

**★ A colleague says the environment guard in the docs example is just boilerplate. What is your response?**
That it is the one line the example could not do without, because the hook is documented to be
called once per environment in series, and the two statements it guards are both instructions to a
browser. Without it an SSR environment issues a page reload, which is at best a duplicate and at
worst the closing edge of a loop when the plugin also writes into the watched tree. Then make the
general point: in a per-environment hook, every line should be read as "is this true for *this*
environment?", and anything that talks to a client belongs behind a check on
`this.environment.name`.

---

← [HMR: Full Reload & Invalidation](01ob-hmr-full-reload-and-invalidation.md) · [Vite overview](../../README.md) · Next → [Per-environment Plugin State](01oca-per-environment-plugin-state.md)
