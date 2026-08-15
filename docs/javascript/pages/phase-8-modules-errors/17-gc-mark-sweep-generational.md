---
title: "17 · Mark-and-sweep and generational GC"
sidebar_label: "17 · Mark-and-sweep and generational GC"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) — and the V8 blog, [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/trash-talk). Documentation-validated; **no measurements, no timings, no console blocks, and no flag recommendations**.

⚠️ **The syllabus row sets the ceiling deliberately: *enough to reason about allocation patterns,
not to tune a flag*.** Collector internals are engine-specific and they change; what follows is the
model that stays true and the handful of consequences you can actually act on.

## What "garbage" means, precisely

MDN reduces the whole question to one substitution: *"an object is no longer needed"* becomes
**"an object is unreachable."** The collector starts from a set of **roots** — MDN names the global
object — follows every reference, and collects everything it never arrived at
([04 · Reachability](./04-leaks/01-reachability.md)).

🔴 **Nothing about that is about whether you are "done" with an object.** Reachability is a
structural property of the graph, so a variable you will never read again keeps its object alive
just as firmly as one you use on every frame. **Every leak in JavaScript is a reference you forgot
you were holding** ([11 · Cost is retention](./11-the-memory-model/02-cost-is-retention.md)).

**Why not reference counting?** MDN is blunt: *"No modern JavaScript engine uses reference-counting
for garbage collection anymore."* Counting references cannot free a cycle — two objects pointing at
each other each have a non-zero count while being unreachable from any root — and MDN calls
circular references *"a common cause of memory leaks"* under that scheme. Mark-and-sweep collects
them without a special case, because the question it asks is not "who points at this" but "can I
get here from a root".

## Generational collection: most objects die young

Mark-and-sweep says what to collect, not how to do it cheaply. Every modern engine's answer starts
from the **generational hypothesis**, which V8 states as *"most objects die young"* — most
allocations become unreachable almost immediately.

That turns into two collectors doing different work:

| | Young generation | Old generation |
|---|---|---|
| **Contains** | freshly allocated objects | objects that survived collection |
| **Runs** | often, and briefly | rarely, and for longer |
| **V8's approach** | scavenge: copy the survivors into a fresh region | mark, sweep, compact |
| **Cost is proportional to** | what **survives** | what the heap **holds** |

**The last row is the one worth memorising.** Because a scavenger copies the survivors rather than
touching the dead, **allocation that dies immediately is close to free** — the garbage is never
visited at all. V8 describes surviving objects being evacuated to a new page and moved into a
contiguous chunk of memory, which is also why this design does not fragment.

**Promotion is by survival.** V8's scavenger moves an object from the nursery to an intermediate
state when it survives one collection, and into the old generation when it survives a second. From
then on it is the expensive collector's problem.

🔴 **The practical consequence, and the only "tuning" this page will offer: keep short-lived objects
short-lived.** An object that would have died in the nursery but was stashed in a module-level
cache, an array you never trim, or a closure that outlives the request, is promoted — and now it is
collected by the slow collector, if at all.

## Where pauses come from

Marking has to agree with the object graph, so a naive collector stops the program while it walks
the heap. Modern engines spend their engineering on *not* doing that: V8 describes **concurrent
marking** running *"entirely in the background while JavaScript is executing"*, **parallel**
scavenging split across helper threads and the main thread, and sweeping that adds the gaps left by
dead objects to a free-list for reuse.

**What remains is finalisation.** V8 names it directly — the main-thread pause begins at marking
finalisation, and that is the major collection's pause time.

**The two things you control, given that:**

- **How much survives**, which sets how much marking there is to do.
- **How much you allocate in a hot path**, which sets how often the young collector runs.

⚠️ **You do not control *when* collection happens, and you never will.** MDN: it is *"not possible
to programmatically trigger garbage collection in JavaScript — and will likely never be within the
core language."* Debug flags exist in some runtimes, but no shipped code may depend on collection
timing ([04 · Reachability](./04-leaks/01-reachability.md) makes the same point about finalisers).

## Weak references: telling the collector you do not insist

`WeakMap` and `WeakSet` hold their keys weakly. MDN's phrasing is exact: *"although you can access
the value of `x` via `y`, the mark-and-sweep algorithm won't consider `x` as reachable if nothing
else strongly holds to it."*

**That is the whole feature, and it maps onto one job**: attaching data to an object whose lifetime
someone else owns — per-element state, per-request metadata — without becoming the reason it stays
alive ([04 · The four leaks](./04-leaks/02-the-four-leaks.md)).

**`WeakRef` is the more dangerous sibling**: a reference you can read *while the object lives*, with
`deref()` returning `undefined` once it does not. MDN's own example is a cache of `WeakRef` values
where a miss simply recomputes.

⛔ **Neither is a performance trick, and reaching for them to "help the GC" is the classic
misreading.** They express a lifetime relationship. If the collector still keeps something alive,
that is because something else in your program is holding it strongly — which is a retainer path to
find, not a weakness to work around.

## What this changes about how you write code

- **Allocate freely in a short-lived scope.** The generational design is built for exactly that;
  pooling objects to "avoid GC" usually promotes them instead.
- **Watch anything long-lived that grows** — module-level caches, arrays used as queues, maps keyed
  by user input. Growth without eviction is the shape of a leak
  ([12 · Proving there is one](./12-finding-a-leak/01-proving-there-is-one.md)).
- **Break the reference, do not "free" the object.** There is no free. Removing the last reference
  is the entire mechanism.
- **Do not test for collection.** Assertions about memory being reclaimed are non-deterministic by
  construction, which makes them flaky by construction
  ([14 · What is worth testing](./14-testing-javascript/03-what-is-worth-testing.md)).

## Gotchas

**Symptom: memory rises steadily under load and never comes back down.**
Cause — retention, not collection pressure: something reachable keeps growing.
Fix — compare troughs after collection and follow the retainer path.

**Symptom: an object is not collected even though "nothing uses it".**
Cause — reachability is structural; a listener, a timer, a closure or a cache still refers to it.
Fix — find the reference and remove it; "unused" is not a state the collector can observe.

**Symptom: a cycle is assumed to leak.**
Cause — reference-counting intuition applied to a mark-and-sweep engine.
Fix — cycles are collected when the whole cycle is unreachable; look for the root that reaches it.

**Symptom: object pooling made things worse.**
Cause — pooled objects survive, get promoted to the old generation, and are now collected by the
expensive collector.
Fix — let short-lived objects die young unless a measurement says otherwise.

**Symptom: a test asserting that memory was reclaimed is flaky.**
Cause — collection timing is unspecified and not triggerable from the language.
Fix — assert on the structure — that the reference was removed — not on the heap.

**Symptom: a `WeakMap` did not free anything.**
Cause — the key is still strongly held somewhere else; weakness is about the *key*, and the value is
held for as long as the key lives.
Fix — find the strong reference; `WeakMap` never overrides one.

## Interview questions

**★ How does JavaScript decide an object is garbage?**
Reachability from roots. If the collector cannot reach it while walking references from the global
object and the current stack, it is collectable — regardless of whether your code would ever use it
again.

**★ Why is reference counting not used?**
It cannot collect cycles — mutually referencing objects keep non-zero counts while being unreachable
— and MDN notes no modern engine uses it.

**★ What is generational collection, and why does it help?**
Most objects die young, so the heap is split: a small young generation collected often by copying
survivors, and an old generation collected rarely. The young collector's cost tracks what survives,
so short-lived allocation is cheap.

**★ How does an object reach the old generation?**
By surviving collections — in V8, one survival moves it to an intermediate state and a second
promotes it.

**★ Where do GC pauses come from?**
From work that must agree with a stable object graph. Engines mark concurrently and sweep in
parallel; what remains is marking finalisation, which V8 identifies as the main-thread pause of a
major collection.

**★ Can you trigger collection?**
Not from the language, and MDN says that is unlikely ever to change. Debug flags exist in some
runtimes; nothing you ship may depend on collection timing.

**★ Does `WeakMap` make the collector faster?**
No. It expresses that you are not the reason an object should stay alive. If the object survives
anyway, something else holds it strongly.

**What is the one habit that follows from all of this?**
Keep long-lived structures small and bounded, and let short-lived objects die in the young
generation.

---

← [Phase 8 index](./README.md) · Prev → [16 · `AggregateError`](./16-aggregate-error.md)
