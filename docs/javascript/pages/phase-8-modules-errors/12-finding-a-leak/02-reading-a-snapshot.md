---
title: "02 · Reading a snapshot"
sidebar_label: "02 · Reading a snapshot"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`Node.remove()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/remove), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) — and Node.js [`v8.writeHeapSnapshot()`](https://nodejs.org/api/v8.html#v8writeheapsnapshotfilename-options), [Diagnostics — memory](https://nodejs.org/en/learn/diagnostics/memory). Documentation-validated; **no timings, no console blocks, and no reproduced tool output**.

[01](./01-proving-there-is-one.md) established that something is retained. A snapshot answers the
only remaining question — **which reference is holding it** — and it answers it through one panel:
the **retainer path**.

⚠️ **Nothing here reproduces a profiler's output.** The panel names and column meanings are stable
across the documented tooling; the numbers are yours to produce.

## The three-snapshot technique

A single snapshot tells you what exists, which is far too much. **Comparison is what makes it
readable:**

1. Run the cycle once, then snapshot — **snapshot A**, the warmed baseline.
2. Run the cycle *n* more times.
3. Snapshot again — **snapshot B**.
4. Diff B against A.

🔴 **Taking a snapshot forces a collection first**, so anything that survives into B genuinely
could not be reclaimed. That is what makes the diff trustworthy — and why an object appearing
"still there" is evidence rather than timing noise.

**Look for counts that are a multiple of your cycle count.** Ten cycles and 10 (or 10 × rows)
surviving objects of one class is the leak; that ratio identifies the *unit* being retained, which
is usually enough to name the code.

⚠️ **Diff, do not browse.** A snapshot of a real application contains hundreds of thousands of
objects and every one of them is legitimately alive. Without a comparison there is nothing to
distinguish the leak from the application.

## The columns, and which one to trust

| Column | Meaning | Use it for |
|---|---|---|
| **Objects count** | how many instances exist | 🔴 the ratio against cycle count — the primary signal |
| **Shallow size** | the object's own memory | almost nothing on its own |
| **Retained size** | what would be freed with it | 🔴 finding *which* object is worth chasing |
| **Distance** | shortest path length from a root | spotting the unexpected short path |

**Sort by retained size to choose a target; sort by count to confirm the pattern.** A single
object with an enormous retained size and a class with hundreds of small instances are two
different leaks, and both are visible only in the right column.

## The retainer path is the answer

Select the surviving object and read its **retainers** — the chain of references from a root down
to it. That chain *is* the diagnosis:

```
Window → app → viewCache (Map) → entry → ChartView → #onResize (closure) → detached <div>
```

**Read it from the root down and stop at the first link that should not exist.** In the chain
above, `viewCache` holding an entry for a view the user closed is the bug; everything to its right
is a consequence.

🔴 **The link you must break is the leftmost wrong one.** Removing the closure's reference to the
`<div>` would shrink the leak and leave `ChartView` retained forever — the fix has to remove the
cache entry.

**Names in the path are your best clue and your responsibility.** An anonymous closure appears as
an anonymous closure; a named function, a named class and a labelled `Map` all show up as
themselves. **Naming things is a debuggability decision** that pays off exactly here.

## The shapes you will recognise

| In the retainer path | The anchor from [11 · Cost is retention](../11-the-memory-model/02-cost-is-retention.md) |
|---|---|
| a `Map`/`Set`/array held by a module binding | **module state** with no eviction |
| a `system / Context` or closure entry | a **closure** retaining its scope |
| an `EventListener` or a timer entry | a **registration** never removed |
| **`Detached <div>` / `Detached HTMLDivElement`** | a **DOM** node removed but still referenced |

**"Detached" is the word to search for first** in any browser leak. A detached subtree that is
still reachable is unambiguous — the document has released it and your code has not — and it is
both the most common browser leak and the most expensive.

⚠️ **A detached node retained by *another detached node* is not the leak.** Find the one whose
retainer is still an attached, live object; the rest of the subtree follows it.

## Node: the same method, a different button

```js
import v8 from 'node:v8';
v8.writeHeapSnapshot();          // writes a .heapsnapshot file to disk
```

The file loads into the same devtools memory panel, so the reading technique is identical. Two
practical differences:

- **Take snapshots on a signal or an endpoint**, not on a timer — you want them at equivalent
  points in the cycle, as in [01](./01-proving-there-is-one.md).
- **Writing a snapshot pauses the process and costs disk proportional to the heap**, so it is a
  deliberate diagnostic action on a production instance, not something to leave enabled.

🔴 **In a server, the "cycle" is a request.** Run a fixed number of identical requests between
snapshots and look for per-request objects surviving — the same ratio test, with requests as the
unit.

## Confirming the fix

**A fix is not confirmed by the leak looking smaller.** It is confirmed by the count no longer
rising with cycles:

1. Repeat the exact experiment from [01](./01-proving-there-is-one.md).
2. Check the surviving-instance count is now **constant** across cycles, not merely lower.
3. Keep the check — an instance counter, or a test that runs the cycle *n* times and asserts the
   count — so the leak cannot come back unnoticed.

⚠️ **A lower-but-still-rising count means you broke one link of a chain that had two.** That is the
most common false victory in this work, and the ratio test catches it where a memory graph does
not.

## Prevention beats any of this

The tooling above is what you do when the leak already shipped. The habits that stop it are all
from [11 · Cost is retention](../11-the-memory-model/02-cost-is-retention.md), and each removes one
whole class:

- **One `AbortController` per scope**, aborted in teardown — kills the registration anchor.
- **A `WeakMap` for per-object side data** — kills the metadata anchor.
- **An eviction policy on every long-lived collection** — kills the cache anchor.
- **Drop the node reference when you drop the node** — kills the detached-DOM anchor.

## Gotchas

**Symptom: the snapshot has a million objects and no obvious culprit.**
Cause — browsing instead of diffing.
Fix — compare two snapshots taken at equivalent points, and look at what is new.

**Symptom: the biggest retained-size object turns out to be the application itself.**
Cause — sorting by retained size without a diff; the root of the app legitimately retains it all.
Fix — restrict to objects allocated between the snapshots.

**Symptom: you removed a reference and the leak barely shrank.**
Cause — you broke a link to the right of the real problem.
Fix — break the **leftmost** wrong link in the retainer path.

**Symptom: the leak looks smaller, so the fix worked.**
Cause — the count is still rising, just more slowly.
Fix — assert the count is *constant* across cycles, not lower.

**Symptom: the retainer path is full of anonymous entries.**
Cause — anonymous closures, unnamed classes, unlabelled collections.
Fix — name them; it costs nothing and it is the difference between a readable path and a puzzle.

**Symptom: detached nodes everywhere and no obvious owner.**
Cause — most of them are retained by each other.
Fix — find the detached node whose retainer is a live, attached object.

**Symptom: writing a heap snapshot in production caused a stall.**
Cause — it pauses the process and writes the whole heap.
Fix — trigger it deliberately, on one instance, out of the request path.

## Interview questions

**★ Walk me through finding a leak.**
Build a repeatable cycle; snapshot after a warm-up run; run *n* more cycles; snapshot again; diff.
Look for object counts that are a multiple of *n*, select one, and read its retainer path back to a
root.

**★ Why take two snapshots rather than one?**
A real application's heap is almost entirely legitimate. Only the difference between equivalent
points distinguishes the leak from the program.

**★ Which column matters?**
Object count against the cycle count identifies the leak; retained size chooses which object is
worth chasing. Shallow size on its own says almost nothing.

**★ What is a retainer path and how do you use it?**
The chain of references from a root to the object. Read it from the root down and break the
**leftmost** link that should not exist — breaking a later one shrinks the leak without fixing it.

**★ What does "detached" mean in a snapshot?**
A DOM node removed from the document but still referenced by JavaScript, so it and its whole
subtree stay in memory. It is the most common browser leak.

**★ How do you confirm a fix?**
Repeat the experiment and show the surviving count is constant across cycles — not merely lower —
and keep an automated check so it cannot regress.

**How does this work in Node?**
Identically, with `v8.writeHeapSnapshot()` loaded into the same panel, where the repeatable cycle
is a fixed number of identical requests.

---

← [01 · Proving there is one](./01-proving-there-is-one.md)
