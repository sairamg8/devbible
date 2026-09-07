---
title: "The documented full-reload recipe invalidates every affected module before it sends `full-reload` and then returns `[]` — three steps that only work together, and the environment-scoped form adds a guard the older one never had"
sidebar_label: "HMR: Full Reload & Invalidation"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `handleHotUpdate`](https://vite.dev/guide/api-plugin) (the full-reload recipe, quoted verbatim) and [Environment API § The `hotUpdate` Hook](https://vite.dev/guide/api-environment-plugins) (the environment-scoped form and `HotUpdateOptions`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HMR: Full Reload & Invalidation

The second of the three documented choices in [`handleHotUpdate`](01o-handle-hot-update.md), and the
one people copy without reading: *"Return an empty array and perform a full reload."* The recipe is
three statements, and dropping any one of them produces a different wrong behaviour. The environment-scoped
form of the same recipe is [The `hotUpdate` Hook](01oc-hotupdate-environment-hook.md), and the third
choice, custom events, is [HMR: Custom Events](01od-hmr-custom-events.md).

---

## 1. Under-The-Hood Mechanics

### The recipe, verbatim

> *"Return an empty array and perform a full reload:"*

```js
handleHotUpdate({ server, modules, timestamp }) {
  // Invalidate modules manually
  const invalidatedModules = new Set()
  for (const mod of modules) {
    server.moduleGraph.invalidateModule(
      mod,
      invalidatedModules,
      timestamp,
      true
    )
  }
  server.ws.send({ type: 'full-reload' })
  return []
}
```

Three steps, in this order:

1. **Invalidate** every module in `ctx.modules`, threading one shared `Set` through the loop.
2. **Send** `{ type: 'full-reload' }` over the WebSocket.
3. **Return `[]`** — the ownership signal from
   [the return contract](01oa-hmr-return-contract.md), which stops Vite from also performing its
   own update.

⚠️ The documentation shows this call **without describing its parameters**. The shared `Set` is
plainly an accumulator threaded through the loop, `timestamp` is the field of the same name on
`HmrContext`, and the trailing `true` is passed with no explanation on this page. Copy the call as
written; do not invent meanings for the arguments, and do not omit one because it "looks optional".

⚠️ The docs also do not state *why* invalidation is paired with the reload — the code comment says
only *"Invalidate modules manually"*. The pairing is the documented recipe; treat the two as one
step rather than reasoning about what a reload alone would serve.

---

## 2. Real-World Engineering Scenario

**A reload that reloaded the same stale page.**

A plugin watched a `.env`-style runtime config and forced a reload when it changed:

```ts
handleHotUpdate({ file, server }) {
  if (!file.endsWith('runtime.config.json')) return;
  server.ws.send({ type: 'full-reload' });
  // no invalidation, no return
}
```

Two defects, and each produced a distinct complaint.

Because the hook fell through without returning `[]`, Vite also performed its own update for the
change — so a single save produced both a reload and an HMR update, and the ordering between them
varied. Developers reported the page "sometimes reloading twice".

Because no module was invalidated, the reload was not accompanied by the documented invalidation
step, and the team spent an afternoon arguing about caching rather than reading the recipe, which
pairs the two.

The rewrite copied the documented three statements exactly, added the `ctx.file` guard first, and
the complaints stopped.

**The transferable point:** these recipes look like three interchangeable lines and are actually one
indivisible instruction with a guard around it. The guard is not style.

---

## 3. Production-Grade Code Example

```typescript
// ✅ handleHotUpdate: the documented recipe, with the guard the docs assume you add.
import type { Plugin } from 'vite';

export function runtimeConfigReload(): Plugin {
  return {
    name: 'runtime-config-reload',

    handleHotUpdate({ file, server, modules, timestamp }) {
      // Cheap ownership check first — this hook is sequential and runs for every change.
      if (!file.endsWith('runtime.config.json')) return;

      // 1. Invalidate manually, threading one Set through the loop.
      const invalidatedModules = new Set();
      for (const mod of modules) {
        server.moduleGraph.invalidateModule(mod, invalidatedModules, timestamp, true);
      }

      // 2. Tell the client to reload.
      server.ws.send({ type: 'full-reload' });

      // 3. Claim the update, so Vite does not also perform its own.
      return [];
    },
  };
}
```

```typescript
// ⛔ The same plugin with each step of the recipe broken in turn.
handleHotUpdate({ file, server, modules, timestamp }) {
  if (!file.endsWith('runtime.config.json')) return;

  server.ws.send({ type: 'full-reload' });
  // 1. no invalidation — the documented recipe pairs it with the send
  // 2. no `return []` — Vite ALSO performs its own update: reload plus HMR, order varying
  }
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Sending `full-reload` without returning `[]`

Vite still performs its own update for the same change. The user-visible result is a reload racing
an HMR update, reported as "it reloads twice".

### ⚠️ Pitfall 2 — Skipping the invalidation loop

The documented recipe invalidates every module in `ctx.modules` before sending. It is one
instruction in three statements; taking the third without the first is not a simplification.

### ⚠️ Pitfall 3 — Creating the `Set` inside the loop

`const invalidatedModules = new Set()` is outside the `for` in the documented code, and it is passed
to every call so the traversal shares one accumulator. Moving it inside changes what each call sees.

### ⚠️ Pitfall 4 — Reaching for a full reload as the first tool

It discards all client state — form input, scroll position, open modals, an in-progress upload. Try
narrowing first, and prefer a custom event when only one subsystem needs to react.

### ⚠️ Pitfall 5 — A reload that retriggers the watcher

If the plugin writes a generated file on change, and that file is watched, a full reload can restart
the cycle. Write generated output outside the watched tree, or guard with a content comparison.

---

## Gotchas

**★ Symptom: one save reloads the page twice, or reloads and hot-updates in a varying order.** Cause: the hook sent `full-reload` but did not `return []`, so Vite also performed its own update. Fix: return `[]` — the send and the return are one instruction.

**★ Symptom: a full reload appears not to pick up the change reliably.** Cause: the invalidation loop was skipped. Fix: copy the documented recipe in full — invalidate every module in `ctx.modules`, then send, then return `[]`.

**★ Symptom: an endless reload loop that only stops when the dev server is killed.** Cause: the plugin writes a generated file that is itself watched. Fix: write outside the watched tree, or compare content and return early when nothing changed.

**★ Symptom: developers lose form state on every save of an unrelated file.** Cause: a full reload with no `ctx.file` guard, in a hook that fires for every change. Fix: guard on `ctx.file` as the first statement.

**★ Symptom: invalidation appears to do nothing for some modules.** Cause: a fresh `Set` per iteration, instead of the one accumulator the documented loop threads through every call. Fix: declare it once, above the `for`.

---

## Interview questions

**★ Walk through the documented full-reload recipe and say what each line is for.**
It is three statements. First, a loop that calls `server.moduleGraph.invalidateModule(mod,
invalidatedModules, timestamp, true)` for every module in `ctx.modules`, threading one shared `Set`
through the calls — the docs label it *"Invalidate modules manually"* and do not describe the
parameters, so it is copied as written. Second, `server.ws.send({ type: 'full-reload' })`, the
instruction to the client. Third, `return []`, which claims the update so Vite does not also perform
its own — without it you get a reload racing an HMR update. The honest thing to say in an interview
is that the documentation gives the recipe rather than the rationale for the first step, so the
three are treated as one indivisible instruction.

**★ When is a full reload the wrong answer even though it works?**
Whenever client state is part of the thing being developed. A reload discards form input, scroll
position, open dialogs, an in-flight upload and any in-memory store — which is precisely the state a
developer is usually trying to reach when they hit save on the twentieth iteration of a component.
It is also indiscriminate: a change to one locale file reloads an entire application. The documented
alternatives exist for this reason — narrow the module list if a subset provably suffices, and send
a custom event when exactly one subsystem needs to react. A full reload is the correct answer for
genuinely global changes, such as a runtime config that every module read at startup.

**★ A plugin writes a generated file inside `src/` on every HMR update and forces a reload. What goes wrong?**
The generated file is inside the watched tree, so writing it triggers the watcher, which invokes the
hook, which writes the file and forces another reload. Whether it loops forever depends on details
nobody should be relying on — whether the write is byte-identical, how the watcher coalesces events,
how fast the reload is. The fixes are ordered by robustness: write outside the watched tree, or
compare the new content against the existing file and return early when identical, or exclude the
path from the watcher. The general lesson is that a hook which both reacts to file changes and
causes them needs an explicit termination argument, not an empirical one.

---

← [The `handleHotUpdate` Return Contract](01oa-hmr-return-contract.md) · [Vite overview](../../README.md) · Next → [The `hotUpdate` Hook](01oc-hotupdate-environment-hook.md)
