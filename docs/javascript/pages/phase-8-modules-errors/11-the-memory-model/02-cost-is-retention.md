---
title: "02 · Cost is retention"
sidebar_label: "02 · Cost is retention"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`Node.removeChild()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild). Documentation-validated; **no timings, no console blocks**.

[01](./01-stack-and-heap.md) ended on the reframing: an object's cost is not its size but what it
keeps alive. This page is that idea used as a working tool — **the retainer chain** — and the four
places a chain gets anchored in real code.

⚠️ **The leak *catalogue* is Master material** ([04 · The four leaks](../04-leaks/02-the-four-leaks.md)),
and **finding one in a profiler** is **12 · Finding a leak** *(not written yet)*. This page is how
to reason about retention **without** a profiler open — which is how you avoid writing the leak in
the first place.

## The retainer chain

Every object that is still in memory has a **path from a root** — a global, a module binding, the
DOM, an executing stack frame, a pending callback. That path is the retainer chain, and it is the
only thing that matters:

```
window → app (module binding) → cache (Map) → entry → response → 4 MB of JSON
```

🔴 **To free the 4 MB you break the chain anywhere along it — and only there.** Nulling out the
variable *you* are looking at does nothing if the `Map` still holds it. That is why "I set it to
`null` and memory did not go down" is such a common report: the chain had another link.

**Reading a chain backwards is the skill.** Given "this object is still alive", the question is
never "why was it not collected" — it is **"who is still pointing at it, and why do they exist?"**

## The four anchors

Almost every retained-forever object in a browser application is anchored by one of these. They
are worth memorising as a checklist.

| Anchor | Lives as long as | Released by |
|---|---|---|
| **Module-level state** | the page / the process | eviction you write |
| **A closure** | the function value that holds it | dropping the function |
| **A registered callback** | the emitter, element or timer | removing the registration |
| **The DOM** | the node's attachment, plus any JS reference to it | removing *both* |

### 1 · Module-level state is permanent by default

```js
const cache = new Map();               // 🔴 lives for the life of the page
export function get(id) { … cache.set(id, big); … }
```

A module is evaluated once and its bindings are roots for the rest of the program
([02 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md)). **A cache with
no eviction is not a cache — it is a leak with a hit rate.**

Give every long-lived collection an answer to "what removes entries?": a size cap, a TTL, or keys
that are objects in a `WeakMap` so entries go when the key does.

### 2 · A closure retains its scope, not just what it uses

```js
function makeHandler(hugeArray) {
  const id = hugeArray[0].id;
  return () => track(id);              // ⚠️ uses only `id` — but see below
}
```

MDN's model is that a closure keeps its enclosing scope alive. **Engines are free to keep only
what is referenced, and typically do — but that is an optimisation, not a guarantee**, and it is
easily defeated by anything that forces the whole scope to be materialised.

🔴 **Do not reason about which variables an engine will drop. Reason about what you can prove.**
Extract the small value *before* creating the closure and let the large one go out of scope:

```js
function makeHandler(hugeArray) {
  const id = hugeArray[0].id;          // ✅ the closure can only see `id`
  return makeTracker(id);
}
const makeTracker = (id) => () => track(id);
```

**A closure stored somewhere long-lived is the highest-risk shape in the language** — an event
handler, a timer callback, a subscription — precisely because it is both a callback (anchor 3)
and a scope holder at once.

### 3 · A registration is a reference held by something you do not own

```js
emitter.on('change', onChange);        // the EMITTER now holds onChange
el.addEventListener('click', onClick); // the ELEMENT now holds onClick
const id = setInterval(tick, 1000);    // the TIMER holds tick — and never stops
```

Every one of these hands a reference to something whose lifetime is not yours. **The registration
*is* the retainer**, so removal is the only release:

```js
const ac = new AbortController();
el.addEventListener('click', onClick, { signal: ac.signal });
emitter.on('change', onChange);
// teardown:
ac.abort();                            // ✅ every listener registered with the signal
emitter.off('change', onChange);       // an emitter needs its own removal
clearInterval(id);
```

One `AbortController` per scope is the highest-value habit here, and it is the same controller
that cancels the requests ([Phase 7 · 14 · The model](../../phase-7-async/14-cancellation/01-the-model.md)).

### 4 · A detached DOM subtree is retained by *your* reference

```js
const row = document.querySelector('#row-7');
row.remove();                          // out of the document…
// …but `row` still points at it, so the whole subtree stays in memory
```

🔴 **Removal from the document is not release.** As long as a variable, a closure, a `Map` entry
or an array holds the node, the node — **and its entire subtree, with its listeners and data** —
stays. This is the leak that grows fastest, because rows and cards are big.

**Drop the reference when you drop the node**, and prefer a `WeakMap` keyed by element for any
per-node data, so the entry disappears with the element.

## Weak references, and their honest limits

```js
const meta = new WeakMap();            // ✅ the entry goes when the key object goes
meta.set(el, { renderedAt });
```

`WeakMap` and `WeakSet` hold their **keys** weakly, which makes them exactly right for per-object
side data — and they are neither iterable nor sized, precisely because the contents can vanish.

⚠️ **`WeakRef` and `FinalizationRegistry` are not the same tool and are rarely the answer.** MDN
warns explicitly that a `FinalizationRegistry` callback **may never run** — collection timing is
not observable or guaranteed — so cleanup that must happen belongs in an explicit teardown path,
never in a finaliser. The full argument is
[04 · Reachability](../04-leaks/01-reachability.md).

## Reasoning about a design before you write it

Three questions, asked while designing rather than while profiling:

1. **What is the longest-lived thing that will hold this?** If the answer is a module binding or
   the document, it is permanent unless you write the release.
2. **Who removes it, and on what event?** If there is no answer, there is no release.
3. **Does the reference need to be strong?** Per-object side data usually does not — that is a
   `WeakMap`.

🔴 **Growth in proportion to *interactions* is the tell.** Memory that rises with the size of the
data you loaded is expected; memory that rises every time a view is opened and closed is a
retained scope, and one of the four anchors above is holding it.

## Gotchas

**Symptom: setting a variable to `null` did not free anything.**
Cause — another link in the retainer chain still points at the object.
Fix — find every holder; the chain must be broken at some point, not any point.

**Symptom: memory grows every time a view opens and closes.**
Cause — a registration or closure from the previous instance was never released.
Fix — one `AbortController` per scope, aborted in teardown; `off` for emitters; `clearInterval`.

**Symptom: a "cache" grows without bound.**
Cause — module-level state with no eviction.
Fix — a size cap or TTL, or a `WeakMap` when the key is an object.

**Symptom: removing rows from a table does not reduce memory.**
Cause — detached nodes still referenced from JavaScript.
Fix — drop the references too; keep per-node data in a `WeakMap`.

**Symptom: a small callback appears to retain megabytes.**
Cause — it closes over a scope containing something large.
Fix — extract the small value before creating the closure, so the large one can go out of scope.

**Symptom: cleanup in a `FinalizationRegistry` never happens.**
Cause — finalisers may never run; MDN says so explicitly.
Fix — an explicit teardown path; a finaliser is at most a diagnostic.

**Symptom: memory is high but stable.**
Cause — this may simply be the working set, not a leak.
Fix — compare growth against interactions, not against absolute size.

## Interview questions

**★ What is a retainer chain?**
The path from a root — a global, a module binding, the DOM, a pending callback — to the object.
An object is alive because that path exists, and it is freed by breaking the chain anywhere along
it.

**★ You set a reference to `null` and memory did not drop. Why?**
Something else in the chain still points at the object — a `Map` entry, a closure, a registered
listener. One holder is enough.

**★ What does a closure retain?**
Its enclosing scope. Engines usually keep only what is referenced, but that is an optimisation
rather than a guarantee, so extract the small value before creating the closure rather than
relying on it.

**★ Why is removing a DOM node not enough?**
Removal detaches it from the document; it is still retained by any JavaScript reference, along
with its whole subtree and listeners. Drop the reference as well.

**★ When do you reach for a `WeakMap`?**
Per-object side data — metadata keyed by element or by instance — so the entry disappears when the
key does. It is neither iterable nor sized, because its contents can vanish.

**★ Is `FinalizationRegistry` a cleanup mechanism?**
No. MDN states the callback may never run. Cleanup that must happen goes in an explicit teardown
path.

**How do you tell a leak from a large working set?**
A leak grows with the number of *interactions*; a working set grows with the size of the data.

---

← [01 · Stack, heap and what a variable holds](./01-stack-and-heap.md)
