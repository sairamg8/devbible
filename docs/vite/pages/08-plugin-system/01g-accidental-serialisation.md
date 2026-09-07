---
title: "Accidental Serialisation: Why a `parallel` Violation Stays Dormant Until Someone Adds an `await`"
sidebar_label: "Accidental Serialisation"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API](https://vite.dev/guide/api-plugin) (the **Kind** line on `config` and `configResolved`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Accidental Serialisation

[Chunk 1f](01f-hook-kinds-and-ordering-guarantees.md) established that `configResolved` is `parallel`
and therefore unordered. This chunk is about why almost nobody discovers that from experience — the
violation is **dormant by default**, and the code that eventually wakes it is unrelated and
obviously harmless.

---

## 1. Under-The-Hood Mechanics

### The dormancy mechanism

Two *synchronous* `parallel` hooks cannot interleave, because there is no suspension point between
them — whatever order Vite invokes them in, each runs to completion before the next starts.
JavaScript does not interleave synchronous code:

```
plugin A configResolved()  → sync, runs to completion
plugin B configResolved()  → sync, sees A's effect          ✅ appears correct
```

So an arrangement that depends on ordering `configResolved` does not promise **works** — for months,
across projects, under review.

Add one `await` anywhere in A:

```
plugin A configResolved()  → suspends at the await
plugin B configResolved()  → runs to completion, sees NOTHING     ⛔
plugin A                   → resumes, writes too late
```

🔴 **The `await` did not introduce the bug.** It removed the accident that was concealing one written
long before. This is the single most important thing to internalise about documented concurrency
kinds: **the guarantee is what the docs state, never what you observed.**

### Why the reveal is always someone else's change

The `await` is rarely added by the person who wrote the coupling, and is rarely *about* the coupling:

```
"read a small manifest from disk"        → await fs.readFile
"call the shared config service"         → await fetch
"a dependency became async internally"   → no local diff at all
```

The last one is the worst: a library upgrade turns a synchronous call into a suspending one, your
diff is a version bump, and a plugin that has been reliable for a year becomes flaky. Nothing in the
change set points at the coupling.

### The signature

```
intermittent            ← a race, not a logic error
order-dependent         ← something is populated once, read twice
fails on CI, not local  ← the suspension is I/O; CI has colder caches and slower disks
appeared after an
  unrelated change      ← the await
```

⚠️ **"Only fails on CI" is evidence about the bug's mechanism, not about CI.** Treating it as an
infrastructure problem is what makes these expensive.

---

## 2. Real-World Engineering Scenario

**A registry that worked for a year and broke on one `await`.**

Two internal plugins coordinated through a shared module: one registered capability descriptors in
`configResolved`, the other read them in `configResolved` and adjusted itself. Both synchronous,
both listed in a fixed order. It worked across dozens of projects for about a year.

Then the registering plugin needed to read a small manifest from disk, and someone made its
`configResolved` `async` and added one `await`. Nothing else changed — no logic, no ordering, no
configuration. The pull request was three lines and was approved in minutes, correctly, because
nothing in it was wrong.

The reader now ran to completion before the writer's `await` resolved, found an empty registry, and
silently configured itself with defaults. **On some machines. Some of the time** — whether the race
was lost depended on filesystem latency, so it reproduced on cold CI runners and not on warm
laptops. Two engineers spent three days on the CI configuration.

The docs had said this was not allowed the whole time: `configResolved` is **`parallel`**. The
arrangement had never been correct; it had been accidentally serialised.

The fix that shipped moved the coordination into `config`. The fix they adopted afterwards was
better: a preset that computes the capabilities once in the factory and passes them to both plugins,
so the two never communicate through a hook at all.

**The transferable point is about review.** No reviewer of that three-line diff could have caught
this, because the defect was not in the diff — it was in code the diff made reachable. The only
defence that scales is the audit: for every piece of shared state, name the hook whose documented
Kind guarantees its ordering.

---

## 3. Production-Grade Code Example

```typescript
// ⛔ THE RACE. Everything here passes until one hook gains an `await`.
import type { Plugin } from 'vite';
const registry = new Map<string, unknown>();

export function writer(): Plugin {
  return {
    name: 'writer',
    // parallel — no ordering guarantee against any other plugin's configResolved.
    async configResolved() {
      const manifest = await readManifest();   // ← the await that reveals the bug
      registry.set('caps', manifest.capabilities);
    },
  };
}

export function reader(): Plugin {
  return {
    name: 'reader',
    configResolved() {
      // Reads an empty Map whenever `writer` suspends. Intermittent by construction.
      const caps = registry.get('caps') ?? DEFAULTS;
      configure(caps);
    },
  };
}
```

```typescript
// ✅ GOOD. Coordination in `config`, which is `sequential` — each plugin's hook
//    awaits the previous one, by contract rather than by luck.
export function writer(): Plugin {
  return {
    name: 'writer',
    async config(userConfig) {
      const manifest = await readManifest();
      (userConfig as any).__caps = manifest.capabilities;   // later plugins WILL see this
      return null;
    },
  };
}
```

```typescript
// The audit. Five minutes, and it finds the bug without reproducing it.
//
//   for each piece of state shared between plugins:
//     which hook's documented Kind guarantees this ordering?
//
//   config                  sequential  ✅ guaranteed
//   configureServer         sequential  ✅
//   configurePreviewServer  sequential  ✅
//   transformIndexHtml      sequential  ✅
//   handleHotUpdate         sequential  ✅
//   configResolved          parallel    ⛔ NO guarantee — this is the one
//
// If the answer is "configResolved", it is a race whether or not it works today.
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Assuming synchronous means ordered

Two synchronous `parallel` hooks cannot interleave, so each completes before the next starts — which
is why the bug is dormant. The guarantee is what the docs state, not what you observed.

### ⚠️ Pitfall 2 — Coordinating through the filesystem

A `configResolved` writing a file that another plugin's `configResolved` reads is the same race with
extra latency — and the latency makes it *more* likely to fail on CI than locally.

### ⚠️ Pitfall 3 — Adding `await` without checking who depends on the hook

Making a hook `async` is a behaviour change for anything relying on its accidental serialisation.
Before adding one, grep for shared state the hook writes.

### ⚠️ Pitfall 4 — Treating "only fails on CI" as a CI problem

It is evidence about the mechanism: the suspension is I/O-shaped and CI widens the window. Reading
it as infrastructure is what turns a five-minute audit into a three-day investigation.

---

## Gotchas

**★ Symptom: cross-plugin coordination breaks the day someone adds one `await`.** Cause: the arrangement was accidentally serialised by both hooks being synchronous, not guaranteed by anything. Fix: move it to `config`, or better, compute the shared value in a preset factory. The `await` did not introduce the bug; it revealed it.

**★ Symptom: a plugin race reproduces on CI and never locally.** Cause: the suspension point is I/O, and CI runners have colder caches and slower disks. Fix: treat "only fails on CI" as evidence of a race rather than of a CI problem — and check the hook Kinds before the CI configuration.

**★ Symptom: a shared `Map` between two plugins is empty in one of them.** Cause: the writer suspended. Fix: compute the shared value **once in a preset factory** and pass it to both plugins — then no hook ordering is involved at all, which is strictly better than picking the right hook.

```ts
export function platform(o) { const v = compute(o); return [writer(v), reader(v)]; }
```

**★ Symptom: a plugin that was reliable becomes flaky after an unrelated dependency upgrade.** Cause: a library it calls became async internally, turning a synchronous hook into a suspending one — with no local diff at all. Fix: the same diagnosis. This is precisely why the audit question is "which hook guarantees this", not "does it work".

**★ Symptom: a hook was made `async` "for consistency" and something broke.** Cause: adding a suspension point to a `parallel` hook exposes every accidental serialisation depending on it. Fix: it is a real behaviour change. Grep for shared state the hook writes before adding `await`, even when the await is trivially resolved.

**★ Symptom: adding logging to diagnose the race makes it disappear.** Cause: a synchronous `console.log` between operations does not suspend, but an async logger or a `JSON.stringify` on a large object changes timing enough to close the window. Fix: classic heisenbug behaviour and itself strong evidence of a race — stop instrumenting and run the audit.

---

## Interview questions

**★ A plugin race reproduces on CI and never locally. What does that tell you?**
That the suspension point is I/O-shaped, and CI has colder caches and slower disks, so the window is
wider. It is evidence about the *bug's mechanism*, not about CI — and the instinct to treat "only
fails on CI" as a CI problem is exactly what makes these expensive. The first move is to list every
piece of state shared between plugins and, for each, name the hook whose documented Kind guarantees
the ordering it depends on. If the answer for any of them is `configResolved`, you have found it
without reproducing anything, in about five minutes.

**★ Someone wants to make a hook `async` "for consistency". Any concerns?**
Yes, and they are not stylistic. Adding a suspension point to a `parallel` hook converts every
accidental serialisation that depended on it into a live race, and none of those dependencies are
visible from the hook itself — they live in whatever shared state it writes. So it is a behaviour
change dressed as a refactor, and the review needs a grep for that shared state, not a look at the
diff. The same reasoning applies from the other side: a dependency upgrade that makes a library
internally async can do this to you with no local change at all, which is why the durable fix is to
stop depending on `parallel` ordering rather than to keep hooks synchronous.

**★ Adding logging makes the race disappear. What now?**
Stop instrumenting and run the audit, because the disappearance is itself the strongest evidence
you have. A synchronous `console.log` does not suspend, so if logging changes the outcome the
mechanism is timing — an async logger, or a `stringify` expensive enough to shift when the
suspension resolves. Chasing it with more instrumentation is the classic heisenbug trap: every probe
changes the thing being measured. The documented Kinds let you find it statically instead, which is
the whole reason it is worth knowing that `configResolved` is the one `parallel` hook.

---

← [Hook Kinds & Guarantees](01f-hook-kinds-and-ordering-guarantees.md) · [Vite overview](../../README.md) · Next → [Eliminating Coupling](01h-eliminating-cross-plugin-coupling.md)
