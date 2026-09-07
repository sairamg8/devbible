---
title: "Per-Environment Hooks and the `importer` That Lies: Two Dev-Server Facts With No Bundler Analogue"
sidebar_label: "Per-Environment & `importer`"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Rolldown Hooks](https://vite.dev/guide/api-plugin), [Environment API plugins](https://vite.dev/guide/api-environment-plugins). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope: the SSR-specific properties on the extended `options` parameter were **not** fetched in this pass and are not named here — the docs link is followed, not reconstructed.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Per-Environment Hooks and the `importer` That Lies

[Chunk 1b](01b-the-hook-set.md) covered *when* hooks run. This chunk covers two properties of *how*
they run that a bundler has no equivalent for — and both produce bugs that look like application
bugs rather than plugin bugs.

---

## 1. Under-The-Hood Mechanics

### Every Rolldown hook is per-environment

> *"All rolldown hooks are [per-environment hooks](https://vite.dev/guide/api-environment-plugins#per-environment-hooks-and-global-hooks)."* — [Plugin API](https://vite.dev/guide/api-plugin)

So `resolveId`, `load` and `transform` are invoked **once per environment**. Client and SSR are
separate environments, and a module reachable from both is transformed **twice, in two contexts,
against the same plugin instance**:

```
your plugin object  ← ONE instance, created once by your factory
      │
      ├── client environment  → resolveId · load · transform
      └── ssr environment     → resolveId · load · transform
                                   ↑ same closure, same Maps, same counters
```

🔴 **Any state in your factory's closure is shared across environments unless you key it.** A cache
keyed only by module id will serve an SSR-transformed module to the client, or the reverse — and the
symptom is a hydration mismatch, which nobody attributes to a build plugin.

The Vite-*specific* hooks split rather than following this rule uniformly. Documented scopes:

| Hook | Scope |
|---|---|
| `config` | **Global** |
| `configResolved` | **Global** |
| `configureServer` | **Global** |
| `configurePreviewServer` | **Global** |
| `transformIndexHtml` | **Per-environment** |
| `handleHotUpdate` | **Per-environment** |

Detail on each in [chunk 1d](01d-config-and-configresolved.md).

### The extended `options` parameter

> *"These hooks also have an extended `options` parameter with additional Vite-specific properties. You can read more in the [SSR documentation](https://vite.dev/guide/ssr#ssr-specific-plugin-logic)."*

That is how a plugin distinguishes a client transform from an SSR transform. ⚠️ **I did not fetch
the SSR page in this pass**, so the exact property names are not asserted here — follow the link
rather than trusting a reconstruction.

### 🔴 `importer` is not always the importer

> *"Some `resolveId` calls' `importer` value may be an absolute path for a generic `index.html` at root as it's not always possible to derive the actual importer due to Vite's unbundled dev server pattern. For imports handled within Vite's resolve pipeline, the importer can be tracked during the import analysis phase, providing the correct `importer` value."*

A bundler walks a module graph and always knows who imported what. A dev server receives an HTTP
request for a module and sometimes cannot derive it.

```
BUILD                         DEV
─────                         ───
importer = the real           importer = the real importer
importing module              …OR the project root's index.html
                                 ↑ not undefined. PLAUSIBLE. And wrong.
```

**That is what makes it dangerous rather than merely limiting.** A missing value would throw or
short-circuit; a plausible wrong value silently sends a branch down the other path in dev and the
right path in the build — the exact shape of a "works in dev, breaks in prod" report, in reverse.

---

## 2. Real-World Engineering Scenario

**A hydration mismatch that was a `Map` in a build plugin.**

A team wrote a plugin that compiled a bespoke template format and cached results by module id,
because `transform` runs per request in dev and the compile was not cheap:

```ts
const cache = new Map<string, string>();
```

It was correct for a year — the app was client-only, so there was one environment and one cache.

Then they added SSR. The template compiler emitted slightly different output for the server (no
event-handler binding, no `window` access) and the client, which is exactly what an SSR-aware
compiler should do. But whichever environment reached a template **first** populated the cache, and
the other environment got that entry.

The symptom was a hydration mismatch on two of forty routes, intermittently, depending on request
order at server start. It was investigated as a React problem for a week: the component was
inspected, the data-fetching was inspected, `suppressHydrationWarning` was discussed. Nobody looked
at a build plugin, because build plugins are not where hydration bugs live.

The finding, when it came, was one sentence in the plugin docs: *"All rolldown hooks are
per-environment hooks."* One instance, two environments, one unkeyed `Map`.

The fix was three characters of key. **The transferable point is diagnostic**: a bug that is
intermittent, order-dependent and environment-correlated is a **shared-state** bug, and in a Vite
project the shared state you did not think about is your own plugin's closure.

---

## 3. Production-Grade Code Example

```typescript
// The hot-path contract, correctly. `transform` runs ONCE PER MODULE in a build
// and PER REQUEST in dev — so cache. And key the cache by environment, because
// "All rolldown hooks are per-environment hooks".
import type { Plugin } from 'vite';

export function expensiveTransform(): Plugin {
  // 🔴 Map<environmentName, Map<moduleId, output>> — NOT Map<moduleId, output>.
  const caches = new Map<string, Map<string, string>>();

  return {
    name: 'expensive-transform',
    transform: {
      filter: { id: /\.expensive$/ },
      handler(code, id) {
        const env = this.environment?.name ?? 'default';
        let cache = caches.get(env);
        if (!cache) caches.set(env, (cache = new Map()));

        const hit = cache.get(id);
        if (hit !== undefined) return { code: hit, map: null };

        const out = expensivelyCompile(code, { ssr: env === 'ssr' });
        cache.set(id, out);
        return { code: out, map: null };
      },
    },
  };
}
```

```typescript
// ⚠️ `importer` is not always the real importer in dev.
export function aliasByImporter(): Plugin {
  return {
    name: 'alias-by-importer',
    resolveId(source, importer) {
      // ❌ FRAGILE. In dev, `importer` "may be an absolute path for a generic
      //    index.html at root" — plausible, and wrong. The branch silently
      //    takes the else in dev and the if in the build.
      // if (importer?.includes('/admin/')) return resolveAdmin(source);

      // ✅ Branch on something true in BOTH pipelines: the id itself, an explicit
      //    query suffix, or configuration.
      if (source.startsWith('#admin/')) return resolveAdmin(source);
      return null;
    },
  };
}
```

```typescript
// A quick audit you can run on your own plugins: does any module-scope
// mutable state exist that is not keyed by environment?
//
//   const cache  = new Map()      ⛔ shared across client + ssr
//   const seen   = new Set()      ⛔ same
//   let counter  = 0              ⛔ same
//   const RE     = /\.x$/         ✅ immutable, genuinely global
//
// Rule of thumb: anything DERIVED FROM MODULE CONTENT must be keyed by
// this.environment. Anything that is a constant need not be.
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Sharing plugin state across environments

Every Rolldown hook is per-environment, so client and SSR run your hooks against the same plugin
instance. An unkeyed cache serves an SSR-transformed module to the client, or the reverse.

### ⚠️ Pitfall 2 — Expensive work in `transform` with no cache at all

Once per module in a build; per **request** in dev, for the life of the server. The dev server
appears to degrade over a long session with no memory growth to explain it.

### ⚠️ Pitfall 3 — Branching on `importer` in `resolveId`

In dev it *"may be an absolute path for a generic `index.html` at root"*. It is not absent, it is
plausibly wrong, so the branch silently takes the wrong side rather than throwing.

### ⚠️ Pitfall 4 — Assuming the Vite-specific hooks are per-environment too

They split. `config`, `configResolved`, `configureServer` and `configurePreviewServer` are **Global**;
only `transformIndexHtml` and `handleHotUpdate` are per-environment. A `configureServer` that
assumes it runs once per environment runs once, full stop.

### ⚠️ Pitfall 5 — Reconstructing the SSR `options` properties from memory

The docs point at the SSR page for them and this page deliberately does not name them. A plugin
branching on a property name you half-remember will branch wrongly and silently.

### ⚠️ Pitfall 6 — Treating a hydration mismatch as a framework problem

It frequently is. But intermittent, order-dependent and environment-correlated is the signature of
**shared state**, and in a Vite project the shared state nobody considers is a plugin's closure.

---

## Gotchas

**★ Symptom: the dev server gets slower the longer it runs, with no memory growth.** Cause: expensive work in `transform`, which is called *"on each incoming module request"* rather than once. Fix: cache by id — and remember the cache is shared across environments unless keyed.

**★ Symptom: an SSR page renders with client-transformed module output.** Cause: a plugin cache shared across environments — every Rolldown hook is per-environment, but your `Map` is not. Fix: key the cache by `this.environment?.name`.

```ts
const env = this.environment?.name ?? 'default';
```

**★ Symptom: a hydration mismatch appears on some routes, intermittently, depending on request order.** Cause: whichever environment reached a module first populated a shared cache. Fix: the environment key. The diagnostic tell is *order-dependence* — a deterministic bug is not shared state, an order-dependent one usually is.

**★ Symptom: a `resolveId` branch behaves differently in dev and build.** Cause: `importer` in dev *"may be an absolute path for a generic `index.html` at root"*. Fix: branch on the id, a query suffix, or config — never on `importer` identity.

**★ Symptom: `importer` is the project root's `index.html` for a module imported from deep in the app.** Cause: the documented dev-server limitation — *"it's not always possible to derive the actual importer due to Vite's unbundled dev server pattern."* Fix: not a bug. Note that the docs say imports *"handled within Vite's resolve pipeline"* do get the correct value, so this is inconsistent rather than uniformly wrong — which is worse to debug and a reason not to depend on it at all.

**★ Symptom: `configureServer` runs once and a plugin expected once per environment.** Cause: it is documented as **Global** scope, unlike the Rolldown hooks. Fix: read the scope line on each Vite-specific hook; they are not uniform, and the difference is documented per hook rather than as a rule.

**★ Symptom: a plugin's counter or `Set` produces different results between `vite build` and `vite build --ssr`.** Cause: module-scope mutable state accumulating across two environments in one process. Fix: key it, or move it inside the hook so each invocation starts clean — the second is usually simpler and almost always fast enough.

**★ Symptom: a plugin behaves correctly in a client-only app and breaks the moment SSR is added.** Cause: the app had one environment, so a shared cache was correct by accident. Fix: audit every `Map`, `Set` and `let` in the plugin's closure the day SSR is introduced. This is the single highest-yield review in an SSR migration and it is never on the checklist.

---

## Interview questions

**★ What does "all rolldown hooks are per-environment hooks" mean for how you write one?**
That your hooks are invoked once per environment — client and SSR are separate — against the **same
plugin instance**. So any state held in the factory's closure is shared across environments unless
you key it. That is fine for genuinely global things like a compiled regex, and a correctness bug for
anything derived from module content, because the client and SSR transforms of the same file are
legitimately different. The practical rule is to treat `this.environment` as part of every cache key,
and to be suspicious of any `Map` in a plugin that is not keyed by it — especially in a codebase that
was client-only when the plugin was written, where the bug is dormant rather than absent.

**★ `transform` runs "on each incoming module request" in dev. What follows from that?**
That the cost model is inverted relative to a build. In a build `transform` runs once per module in
a single pass, so expensive work is amortised. In dev it runs per HTTP request for the life of the
server, so the same work is paid repeatedly and the dev server appears to degrade — with no memory
growth, which is what makes it hard to see. The mitigation is a cache, and the second half of the
answer is the trap: an unkeyed cache is shared between the client and SSR graphs, so the performance
fix becomes a correctness bug that presents as a hydration mismatch.

**★ Why is `importer` unreliable in `resolveId` during dev?**
Because a bundler walks a module graph and always knows who imported what, while a dev server
receives an HTTP request for a module and sometimes cannot derive it — *"it's not always possible to
derive the actual importer due to Vite's unbundled dev server pattern."* What makes this dangerous
rather than merely limiting is that the value is not `undefined`; it is a **plausible wrong path**,
the project root's `index.html`, so a branch on it takes the wrong side silently in dev and the right
side in the build. And it is *inconsistent* — the docs note imports handled within Vite's resolve
pipeline do get the correct value — so it works often enough to be trusted before it fails.

**★ A hydration mismatch appears on two of forty routes, intermittently. Where do you look?**
At shared state, before looking at the component. Intermittent plus order-dependent plus
environment-correlated is the signature of something populated once and read from twice, and in a
Vite project the candidate nobody considers is a **plugin's closure** — because build plugins are
not where people expect hydration bugs to live. The specific mechanism is that every Rolldown hook
is per-environment against one plugin instance, so an unkeyed cache lets whichever environment
arrives first decide what the other one sees. The general lesson is that "intermittent and
order-dependent" is a much stronger signal than the symptom's domain.

**★ Are the Vite-specific hooks per-environment too?**
No, and the split is worth knowing rather than guessing. `config`, `configResolved`,
`configureServer` and `configurePreviewServer` are documented as **Global**; `transformIndexHtml`
and `handleHotUpdate` are **Per-environment**. The pattern behind it is coherent — configuration and
the server itself are singletons, while HTML transformation and hot updates are things each
environment does for itself — but the docs state it per hook rather than as a rule, which means the
only reliable move is to read the scope line on the hook you are about to use.

---

← [Dev vs Build Hooks](01b-the-hook-set.md) · [Vite overview](../../README.md) · Next → [The `config` Hook](01d-config-and-configresolved.md)
