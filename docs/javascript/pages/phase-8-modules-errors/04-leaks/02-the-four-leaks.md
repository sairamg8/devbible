---
title: "04.2 · The four leaks"
sidebar_label: "02 · The four leaks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`EventTarget.removeEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap). Documentation-validated.

**Four patterns account for nearly every leak you will write.** Each is one reachable
reference you stopped needing — the rule from [chunk 01](./01-reachability.md) — and each has
a different place to look.

## 1. Detached DOM nodes

A node removed from the document but still referenced from JavaScript:

```js
const cached = document.querySelector("#panel");
document.body.removeChild(cached);        // gone from the page…
// …but `cached` still points at it, so it and its whole subtree stay in memory
```

🔴 **The subtree is the expensive part.** A retained node keeps its children, their
listeners, and anything those close over. One variable can hold a component's entire DOM.

It rarely looks this obvious. The usual shapes are a module-level array of nodes, a `Map`
keyed by node, or a framework ref that is never cleared:

```js
const seen = new Map();
seen.set(node, meta);        // ⚠️ Map holds keys strongly — every node ever seen
const seen = new WeakMap();  // ✅ entry disappears with the node
```

**Where to look:** devtools heap snapshot, filter for `Detached`. Detached nodes are named
as such precisely because they are the common case.

## 2. Forgotten listeners

```js
window.addEventListener("resize", this.onResize);   // never removed
```

The listener keeps `this.onResize` reachable, which keeps `this` reachable, which keeps the
whole component reachable — after it has been destroyed. Every remount adds another.

Removing requires **the same function reference**, which is the part that catches people:

```js
el.addEventListener("click", () => doThing());
el.removeEventListener("click", () => doThing());   // ⚠️ different function — removes nothing
```

Two reliable approaches:

```js
// keep the reference
const onClick = () => doThing();
el.addEventListener("click", onClick);
el.removeEventListener("click", onClick);           // ✅

// or use a signal — one abort removes every listener registered with it
const ac = new AbortController();
el.addEventListener("click", onClick, { signal: ac.signal });
window.addEventListener("resize", onResize, { signal: ac.signal });
ac.abort();                                          // ✅ both gone
```

**The `signal` option is the better default** for anything with a lifecycle: one controller
per component, one `abort()` in the teardown, and no possibility of removing with the wrong
reference. `{ once: true }` covers the single-shot case.

A listener on a node that is itself removed and unreferenced is collected with the node — so
this leak is really about listeners on **long-lived** targets: `window`, `document`, a store,
an event bus.

## 3. Timers and intervals

```js
setInterval(() => update(state), 1000);    // ⚠️ runs forever, retains `state`
```

An interval is reachable from the host until it is cleared, so its callback — and everything
that callback closes over — is reachable too. It also keeps *running*, which is often the
first symptom: work continuing for a screen the user left.

```js
const id = setInterval(tick, 1000);
clearInterval(id);                          // ✅ in teardown
```

`setTimeout` is self-limiting — it becomes unreachable after firing — with one exception
worth knowing: a **re-arming** timeout never does.

```js
function poll() {
  doWork();
  setTimeout(poll, 1000);                   // ⚠️ same lifetime as an interval
}
```

In Node the equivalent symptom is different and useful: **a pending timer keeps the process
alive**, so a script that will not exit usually has one. `unref()` releases that hold.

## 4. Module-level caches that never evict

```js
// cache.js
const cache = new Map();
export function remember(key, value) { cache.set(key, value); }
```

From [02 · 01](../02-module-semantics/01-singletons-and-strict.md): the module is a
**singleton**, so this `Map` lives for the lifetime of the program and grows monotonically.
Nothing is wrong with any single line; the leak is the absence of a policy.

**Every cache needs an eviction policy, chosen deliberately:**

| Policy | Use when |
|---|---|
| **`WeakMap` keyed by an object** | the entry's lifetime *is* the key's lifetime |
| **Bounded size (LRU)** | there is no natural owner and you can afford a cap |
| **TTL** | staleness matters more than size |
| **Explicit invalidation** | the data has a known change event |

"Unbounded and forever" is a policy too — it is just always the wrong one.

The same shape appears without the word *cache*: an array of log lines, a registry of
subscribers, a `Map` of in-flight requests keyed by id that never deletes on completion. **Any
collection at module scope that only ever grows is this leak.**

## Finding one

The mechanism is the same in every devtools:

1. **Two snapshots.** Take a heap snapshot, exercise the suspect flow, take another, and
   compare. Objects present in both that should have gone are the candidates.
2. **Retainer path.** Select a candidate and read the chain of references back to a root —
   that chain contains your mistake, and its last hop names the variable.
3. **Detached nodes.** Filter for `Detached` to find leak 1 directly.

🔴 **Do the "do it three times" test rather than reading absolute numbers.** Open and close
the suspect screen three times: a leak shows as three retained copies, which is unambiguous
in a way that a growing total never is — the allocator's own growth, caches warming, and JIT
artefacts all move the total.

The full devtools walkthrough is *Finding a leak*, in this phase's Understand tier.

## Gotchas

**Symptom:** Memory grows each time a view is opened and closed
**Cause:** Almost always leak 1 or 2 — a retained node, or a listener on `window`/`document`.
**Fix:** Snapshot, filter `Detached`, read the retainer path.

**Symptom:** `removeEventListener` does not remove anything
**Cause:** A different function reference was passed — an inline arrow creates a new function
each time.
**Fix:** Keep the reference, or register with `{ signal }` and call `abort()`.

**Symptom:** Work continues for a screen the user has left
**Cause:** An interval, or a re-arming `setTimeout`, still running.
**Fix:** `clearInterval` / `clearTimeout` in teardown; or an `AbortController` if the API
supports it.

**Symptom:** A Node process will not exit
**Cause:** A pending timer keeps the loop alive.
**Fix:** `clearInterval`, or `unref()` the timer.

**Symptom:** A `Map` keyed by objects grows forever
**Cause:** `Map` holds keys strongly.
**Fix:** `WeakMap`, if the entry should live exactly as long as the key.

**Symptom:** A cache is "fine" in development and grows without bound in production
**Cause:** No eviction policy; development never runs long enough to show it.
**Fix:** Choose a policy — weak keys, bounded size, TTL, or explicit invalidation.

**Symptom:** Heap totals rise but you cannot tell whether it is a leak
**Cause:** Absolute numbers move for many reasons.
**Fix:** Exercise the flow **three times** and look for three retained copies.

## Interview questions

**★ Name the leaks you actually cause.**
Detached DOM nodes still referenced from JavaScript; listeners never removed from long-lived
targets like `window`; intervals and re-arming timeouts; and module-level caches with no
eviction. All four are the same rule — a reachable reference you stopped needing.

**★ Why is a detached node expensive?**
It retains its whole **subtree**, plus those nodes' listeners and whatever they close over.
One variable can hold an entire component's DOM.

**★ Why did `removeEventListener` not work?**
It needs the **same function reference**. An inline arrow passed to both calls creates two
different functions. Keep the reference, or register with `{ signal: controller.signal }` and
`abort()` once for all of them.

**★ Which timer leaks, and which does not?**
`setInterval` leaks until cleared; a plain `setTimeout` becomes unreachable after firing. A
**re-arming** `setTimeout` behaves like an interval. In Node a pending timer also keeps the
process alive, which is why a script will not exit.

**★ When is a module-level cache a leak?**
When it has no eviction policy. The module is a singleton, so the collection lives for the
program's lifetime. Pick one deliberately: weak keys, bounded size, TTL, or explicit
invalidation.

**How do you confirm a leak rather than guess?**
Two heap snapshots around the suspect flow, then read the **retainer path** of a surviving
object back to a root — the last hop names the variable. Exercise the flow three times and
look for three retained copies, rather than watching absolute totals.

---

← Prev [01 · Reachability](./01-reachability.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
