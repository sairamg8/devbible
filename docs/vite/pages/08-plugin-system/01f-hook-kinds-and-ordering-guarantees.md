---
title: "`sequential` vs `parallel`: the Hook Kind Is a Contract, and Accidental Serialisation Hides Every Violation"
sidebar_label: "Hook Kinds & Guarantees"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API](https://vite.dev/guide/api-plugin) (the **Kind** line on each Vite-specific hook), [Plugin Ordering](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `sequential` vs `parallel`

Every Vite-specific hook carries a **Kind** line in the docs, and it is the most consequential line
in each section. It is not a performance note — it says whether ordering between plugins is
*guaranteed* or merely *observed*, and the difference only becomes visible on the day someone adds
an `await`.

---

## 1. Under-The-Hood Mechanics

### What each kind promises

```
sequential   each plugin's hook AWAITS the previous plugin's.
             Order between plugins is GUARANTEED.
             Your hook sees what earlier plugins did.

parallel     all plugins' hooks may run CONCURRENTLY.
             Order between plugins is NOT guaranteed.
             Your hook may see nothing another plugin did.
```

The documented kinds for the Vite-specific hooks:

| Hook | Kind | Scope |
|---|---|---|
| `config` | `async`, **`sequential`** | Global |
| `configResolved` | `async`, **`parallel`** | Global |
| `configureServer` | `async`, **`sequential`** | Global |
| `configurePreviewServer` | `async`, **`sequential`** | Global |
| `transformIndexHtml` | `async`, **`sequential`** | Per-environment |
| `handleHotUpdate` | `async`, **`sequential`** | Per-environment |

🔴 **`configResolved` is the only `parallel` one**, which is exactly why it is the one people write
races into. Everything else in the Vite-specific set is ordered by contract.

### Why `configResolved` alone is `parallel`

Because it is the only one that **cannot change anything** — its type returns `void`. There is
nothing for one plugin's call to hand the next, so there is nothing to sequence, and Vite takes the
concurrency. The kind is derived from the API's shape rather than chosen arbitrarily:

```
returns a value another plugin will see   →  must be sequential
returns void, observes only               →  may be parallel
```

That inference generalises. When you meet a hook whose kind you have not memorised, ask what it
returns.

### Hook kind is not plugin ordering

Two different mechanisms, frequently conflated:

> *"Note that this is separate from hooks ordering, those are still separately subject to their [`order` attribute](https://rolldown.rs/reference/TypeAlias.ObjectHook#order) as usual for Rolldown hooks."* — [Plugin Ordering](https://vite.dev/guide/api-plugin)

```
enforce: 'pre' | 'post'   → which BAND the plugin lands in   (see [chunk 1k](01p-plugin-ordering-and-enforce.md))
order:   'pre' | 'post'   → a Rolldown HOOK's own ordering
Kind:    sequential/parallel → whether ordering is guaranteed AT ALL
```

Setting `enforce` on a plugin whose hook is `parallel` does not buy you an ordering guarantee for
that hook — it decides where the plugin sits, not whether Vite waits.

---


## 3. Production-Grade Code Example

```typescript
// The audit: for every cross-plugin dependency, name the hook that guarantees it.
//
//   config                  sequential  ✅ ordering guaranteed
//   configureServer         sequential  ✅
//   transformIndexHtml      sequential  ✅
//   handleHotUpdate         sequential  ✅
//   configResolved          parallel    ⛔ NO guarantee — do not coordinate here
//
// If the answer is "configResolved", it is a race regardless of whether it works.
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 2 — Expecting `enforce` to fix a `parallel` race

`enforce` decides which band a plugin lands in; the Kind decides whether Vite waits. A `pre` plugin's
`parallel` hook still has no ordering guarantee against another plugin's.

---

## Gotchas

**★ Symptom: two plugins' `configResolved` hooks produce different results run to run.** Cause: the hook is `parallel` — order between plugins is not guaranteed. Fix: store the config and nothing else; anything order-dependent belongs in `config`, which is `sequential`.

**★ Symptom: adding `enforce: 'pre'` does not fix an ordering problem.** Cause: `enforce` places the plugin in a band; it does not make a `parallel` hook wait. Fix: identify which hook the dependency actually flows through, and move it to a `sequential` one.

```js
// ❌ { ...writer(), enforce: 'pre' }   // does nothing for a configResolved race
// ✅ move the coordination into `config`
```

**★ Symptom: `configureServer` ordering is relied upon and it works.** Cause: it is `sequential` — this one is legitimate. Fix: none needed, but write down *why* it is safe, because the next reader cannot distinguish a guaranteed dependency from an accidental one by looking.

**★ Symptom: two plugins write the same config key in `config` and the last one wins unpredictably.** Cause: `config` is sequential, so *some* order is guaranteed — but which one is not: the docs name the `enforce` bands and never state how plugins are ordered within a band, and a preset can move a plugin between bands invisibly. Fix: do not have two plugins own one key; if both must contribute, return partials and let the deep merge combine them.

---

## Interview questions

**★ `config` is `sequential` and `configResolved` is `parallel`. Why does that distinction matter?**
Because `config` builds a value that later plugins' `config` hooks then see, so ordering is
load-bearing and Vite guarantees it. `configResolved` only *reads* a value that is already final, so
there is nothing to sequence and Vite reserves the right to run them concurrently. The practical
consequence is a rule: `configResolved` must be side-effect-free apart from storing what you need.
Writing a file, registering yourself somewhere other plugins read, or assuming another plugin's
`configResolved` already ran is a race — one that passes in development, because two synchronous
hooks resolve in array order, and fails the day one of them gains an `await`.

**★ How would you predict a hook's Kind without looking it up?**
By asking what it returns. A hook that produces a value another plugin will consume *must* be
sequential, because there is something to hand along — that is `config`, `transformIndexHtml`,
`handleHotUpdate`. A hook that returns `void` and only observes has nothing to sequence, so the
implementation is free to take the concurrency — that is `configResolved`, the only `parallel` one
in the Vite-specific set. The inference is not a guarantee and you should still read the Kind line,
but it explains *why* the kinds are what they are, which is what makes them memorable rather than
arbitrary.

---

← [`configResolved`](01e-configresolved.md) · [Vite overview](../../README.md) · Next → [Accidental Serialisation](01g-accidental-serialisation.md)
