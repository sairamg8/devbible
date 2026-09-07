---
title: "Global hooks run once and per-environment hooks run once each — except `buildStart`, `buildEnd` and `watchChange`, which are client-only in dev until you set a flag most plugins never mention"
sidebar_label: "Which Hooks Fire Per Environment"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API § Per-environment Hooks and Global Hooks](https://vite.dev/guide/api-environment-plugins), § Accessing the Current Environment in Hooks and § Per-environment State in Plugins (the two `perEnvironment*DuringDev` flags). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Which Hooks Fire Per Environment

[Per-environment Plugin State](01oca-per-environment-plugin-state.md) says to key your state with
`this.environment`. This page is the prerequisite: knowing which hooks are handed an environment at
all, and which two look like they are and are not — because the state pattern fails silently when
you initialise it in one of those two. See also
[Per-Environment Hooks](01c-per-environment-hooks.md) for the `options` parameter and the module
pipeline.

---

## 1. Under-The-Hood Mechanics

### The two categories

> *"Global hooks are called a single time, independent of the configured environments. They handle
> app-wide concerns such as resolving the config or setting up the dev and preview servers, so
> `this.environment` is not relevant to them. Config resolution related hooks and server related
> hooks are global hooks."*

> *"Per-environment hooks are called once for each environment, and expose the current environment
> through `this.environment` in their context. All [Rolldown hooks](https://vite.dev/guide/api-plugin#rolldown-hooks)
> are per-environment, as are other Vite-specific hooks that handle modules."*

| Category | Examples | `this.environment` | Called |
|---|---|---|---|
| Global | config resolution, dev and preview server setup | *"not relevant"* | once |
| Per-environment | all Rolldown hooks, plus the Vite hooks that handle modules | available | once per environment |

The classification is by **concern**, not by name. The test when you are unsure: could this hook
sensibly give a different answer for the client than for SSR? If yes, it is per-environment.

### 🔴 The exception, in one sentence

> *"Note that for backward compatibility, `buildStart` and `buildEnd` are only called for the client
> environment without the `perEnvironmentStartEndDuringDev: true` flag. Same for `watchChange` and
> the `perEnvironmentWatchChangeDuringDev: true` flag."*

| Hook | Default in dev | With the flag |
|---|---|---|
| `buildStart` / `buildEnd` | client environment only | once per environment — `perEnvironmentStartEndDuringDev: true` |
| `watchChange` | client environment only | once per environment — `perEnvironmentWatchChangeDuringDev: true` |

⚠️ The sentence says *"during dev"* in the flag names and *"for backward compatibility"* as the
reason. The documentation does not state the behaviour during build for these hooks, so do not
generalise the rule beyond dev; check rather than assume.

This is the trap that breaks the state pattern in the exact shape people write it: initialise the
map entry in `buildStart`, read it in `transform`. Without the flag `buildStart` never runs for the
SSR environment, so the entry is missing there, and the exception surfaces in `transform` — a
different hook, a different file, and no mention of environments in the stack.

### Where `this.environment` comes from, and what it carries

> *"With the advent of configurable environments, we now have a uniform way to access their options
> and instance in plugins. Plugin hooks now expose `this.environment` in their context, and APIs
> that previously expected a `ssr` boolean are now scoped to the proper environment (for example
> `environment.moduleGraph.getModuleByUrl(url)`)."*

> *"A plugin could use the `environment` instance to change how a module is processed depending on
> the configuration for the environment (which can be accessed using `environment.config`)."*

```ts
  transform(code, id) {
    console.log(this.environment.config.resolve.conditions)
  }
```

So the environment is not just an identity to key a map with — it carries that environment's
resolved configuration, which is the documented way to make a transform behave differently for SSR
without threading a boolean through your own code.

---

## 2. Real-World Engineering Scenario

**A `TypeError` in `transform`, only for SSR, from a bug in `buildStart`.**

A plugin adopted the documented per-environment state pattern:

```ts
const state = new Map<Environment, { count: number }>();
return {
  name: 'count-modules',
  buildStart() { state.set(this.environment, { count: 0 }); },   // ⛔ no flag
  transform() { state.get(this.environment)!.count++; },
};
```

The client build was fine. The SSR environment threw `Cannot read properties of undefined (reading
'count')` on the first module it transformed. Nothing in the message mentions environments,
`buildStart`, or a flag; the obvious reading is "the map lookup failed", which sends you to look at
the key.

The key was correct. The entry was never created, because *"`buildStart` and `buildEnd` are only
called for the client environment without the `perEnvironmentStartEndDuringDev: true` flag"*. The
documented example sets that flag on the very next line after `name`, and it is easy to read past as
boilerplate — which is exactly what had happened when the pattern was copied.

**The same rule bit a second plugin differently.** That one used `watchChange` to regenerate a
route manifest. In dev it regenerated only when the client environment was the one being watched,
which developers experienced as "the manifest updates most of the time". Nothing errored, nothing
logged, and the fix was one property: `perEnvironmentWatchChangeDuringDev: true`.

**The transferable point:** these two flags are the only place in the plugin API where a hook's
*call frequency* is opt-in. A plugin that keys state correctly can still be wrong about when that
state is created.

---

## 3. Production-Grade Code Example

```typescript
// ✅ The flag set, and the initialisation it protects.
import type { Plugin, Environment } from 'vite';

export function countModules(): Plugin {
  const state = new Map<Environment, { count: number }>();

  return {
    name: 'count-modules',

    // Without this, buildStart/buildEnd fire for the client environment only in dev.
    perEnvironmentStartEndDuringDev: true,

    buildStart() {
      state.set(this.environment, { count: 0 });
    },

    transform() {
      const mine = state.get(this.environment);
      if (mine) mine.count++;
      return null;
    },

    buildEnd() {
      const mine = state.get(this.environment);
      if (mine) this.info(`${this.environment.name}: ${mine.count} modules`);
    },
  };
}
```

```typescript
// ✅ Lazy initialisation: correct whether or not the flag is set.
function stateFor<T>(map: Map<Environment, T>, env: Environment, make: () => T): T {
  let s = map.get(env);
  if (!s) { s = make(); map.set(env, s); }
  return s;
}
// transform() { stateFor(state, this.environment, () => ({ count: 0 })).count++; }
```

```typescript
// ✅ Using the environment's own resolved config, the documented way to branch.
transform(code, id) {
  const conditions = this.environment.config.resolve.conditions;
  // Branch on configuration, not on a boolean threaded through your own code.
  return conditions.includes('node') ? transformForNode(code) : transformForBrowser(code);
}
```

```typescript
// ⛔ Two hooks assumed to be per-environment, and one that is not a hook context at all.
export const bad: Plugin = {
  name: 'broken',
  // 1. no flag: this runs for the client environment only in dev
  buildStart() { init(this.environment); },
  // 2. same rule, own flag: the manifest updates "most of the time"
  watchChange(id) { regenerate(id); },
  // 3. configureServer is a GLOBAL hook — this.environment is not relevant there
  configureServer(server) { console.log(this.environment.name); },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Initialising per-environment state in `buildStart` without the flag

`buildStart` and `buildEnd` are *"only called for the client environment"* in dev unless
`perEnvironmentStartEndDuringDev: true` is set. The entry for every other environment is missing, and
the failure surfaces in whichever hook reads it.

### ⚠️ Pitfall 2 — Forgetting that `watchChange` has its own flag

`perEnvironmentWatchChangeDuringDev: true`. A plugin reacting to file changes there is client-only by
default in dev, which reads as an unreliable watcher rather than a missing property.

### ⚠️ Pitfall 3 — Reaching for `this.environment` in a global hook

*"Config resolution related hooks and server related hooks are global hooks"*, and for those
*"`this.environment` is not relevant"*. Read it in `transform`, `load`, `hotUpdate`; not in `config`
or `configureServer`.

### ⚠️ Pitfall 4 — Assuming the dev rule also describes the build

The flag names say `DuringDev` and the stated reason is backward compatibility. ⚠️ The documentation
does not describe the build-time behaviour of these hooks in the same sentence, so treat the build as
unspecified here rather than inferring symmetry.

### ⚠️ Pitfall 5 — Treating the flags as performance tuning

They change how many times a hook is called, which changes whether your state exists. Setting or
clearing one is a correctness decision, not an optimisation, and it belongs next to the state it
governs with a comment saying so.

### ⚠️ Pitfall 6 — Relying on `buildEnd` to flush per-environment work

Without the flag it fires once, for the client, so anything flushed there for other environments is
silently dropped. Set the flag, or flush from a hook that is per-environment by default.

---

## Gotchas

**★ Symptom: `TypeError` reading a property of `undefined` in `transform`, but only for SSR.** Cause: the state was initialised in `buildStart`, which is *"only called for the client environment"* in dev without the flag. Fix: `perEnvironmentStartEndDuringDev: true`, or initialise lazily on first use.

**★ Symptom: `watchChange` never fires for a non-client environment.** Cause: the same backward-compatibility rule, with its own flag. Fix: `perEnvironmentWatchChangeDuringDev: true`.

**★ Symptom: a generated artefact updates "most of the time" in dev.** Cause: `watchChange` running for the client environment only. Fix: the flag, and a lazy initialisation that does not depend on which hooks fired.

**★ Symptom: `this.environment` is undefined in `configureServer`.** Cause: server-related hooks are **global** hooks, where *"`this.environment` is not relevant"*. Fix: take the environment from the per-environment hook that actually needs it.

**★ Symptom: a summary logged in `buildEnd` counts only the client's modules.** Cause: `buildEnd` fired once, for the client. Fix: set `perEnvironmentStartEndDuringDev: true` so it fires per environment.

**★ Symptom: adding the flag changes behaviour elsewhere in the plugin.** Cause: other code in `buildStart` was written assuming it ran once. Fix: make `buildStart` idempotent per environment before setting the flag; the flag multiplies every side effect in the hook.

---

## Interview questions

**★ How do you decide whether a hook is global or per-environment?**
By what it is about. The documentation splits them by concern: *"Config resolution related hooks and
server related hooks are global hooks"* and are called once, while *"per-environment hooks are called
once for each environment, and expose the current environment through `this.environment`"* — all
Rolldown hooks plus the Vite hooks that handle modules. So `config` and `configureServer` are global
and `this.environment` is not meaningful in them; `transform`, `load` and `hotUpdate` are
per-environment and it is. The practical test when you are unsure is whether the hook could sensibly
give a different answer for the client than for SSR — if yes, it is per-environment.

**★ You key state by environment and it still crashes for SSR. What did you miss?**
The initialisation hook. The natural shape is to create the entry in `buildStart` and read it in
`transform`, but *"for backward compatibility, `buildStart` and `buildEnd` are only called for the
client environment without the `perEnvironmentStartEndDuringDev: true` flag"* — so in dev the SSR
environment never gets an entry, and the failure appears in a different hook as a `TypeError` on
`undefined` with nothing in the message about environments. The two fixes are setting the flag, which
is what the documented example does on the line after `name`, or initialising lazily on first access
so the code has no dependency on which hooks fired. `watchChange` has the same rule and its own flag.

**★ Why would an API have an opt-in flag for how often a hook is called?**
Backward compatibility, which the documentation states outright. Before configurable environments
these hooks fired once, and plugins in the ecosystem were written against that — a `buildStart` that
initialises a global, opens a file, or prints a banner would do it several times over if the call
count silently changed under them. Making the new behaviour opt-in means existing plugins keep
working and new ones state their intent. The cost is a correctness trap for anyone copying the state
pattern without the flag, which is why the documented example carries it and why it is worth a
comment in your own code rather than sitting in the middle of the object.

**★ A plugin sets `perEnvironmentStartEndDuringDev: true` and something unrelated starts happening twice. Why?**
Because the flag multiplies every side effect in `buildStart` and `buildEnd`, not only the one you
added it for. If those hooks also log a banner, write a file, register a watcher or increment a
global counter, all of that now happens once per environment. The fix is not to remove the flag but
to make the hooks idempotent per environment — key anything they create with `this.environment`, and
move genuinely one-time work into a global hook where it belongs. This is a good example of why the
flag is a correctness decision rather than a tuning knob: it changes the contract of two hooks at
once.

---

← [Per-environment Plugin State](01oca-per-environment-plugin-state.md) · [Vite overview](../../README.md) · Next → [HMR: Custom Events](01od-hmr-custom-events.md)
