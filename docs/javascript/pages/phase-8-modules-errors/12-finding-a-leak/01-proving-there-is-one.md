---
title: "01 · Proving there is one"
sidebar_label: "01 · Proving there is one"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`Performance.measureUserAgentSpecificMemory()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory), [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) — and Node.js [`process.memoryUsage()`](https://nodejs.org/api/process.html#processmemoryusage), [`v8.getHeapStatistics()`](https://nodejs.org/api/v8.html#v8getheapstatistics), [`v8.writeHeapSnapshot()`](https://nodejs.org/api/v8.html#v8writeheapsnapshotfilename-options). Documentation-validated; **no timings, no console blocks, and no reproduced tool output**.

⚠️ **No measurements appear on this page.** Every number a heap profiler shows is specific to a
build, a browser version and a machine, and none was produced here — so this topic teaches the
**procedure** and what each panel *means*, and prints nothing.
[11 · Cost is retention](../11-the-memory-model/02-cost-is-retention.md) is the model it applies.

## First: is it actually a leak?

🔴 **Most "leaks" reported are not leaks.** Three things look identical on a memory graph and have
completely different fixes:

| What you are seeing | The tell |
|---|---|
| **A leak** | memory rises with the **number of interactions** and never returns after them |
| **A large working set** | memory rises with the **size of the data** and stays flat while you interact |
| **Lazy collection** | memory rises, then drops sharply — the collector simply had not run |

**The third is why a single reading proves nothing.** A garbage collector runs when it decides to,
so a rising line is expected; what matters is the level *after* collection, compared across
equivalent moments.

## The repeatable experiment

Everything downstream depends on having a **cycle you can repeat** — a sequence that ends where it
started:

> open the view → interact → leave the view → return to the starting state

**Do it once to warm up**, then measure at the same point in each cycle. A one-off measurement
cannot distinguish growth from a first-run cost such as lazily loaded code or a populated cache.

🔴 **The comparison is between equivalent points, not between "before" and "after some usage".**
If the application is back in the state it started in and the heap is not, something from the
previous cycle is still reachable.

## Reading the trend before the snapshot

A heap snapshot is expensive and detailed; a trend is cheap and answers the only question that
matters first — *is it growing?*

- **A timeline recording with a memory track** shows the sawtooth of allocation and collection.
  A leak is a sawtooth whose **troughs rise**: each collection reclaims less than the cycle added.
- **Flat troughs mean no leak**, however dramatic the peaks look.
- In Node, `process.memoryUsage().heapUsed` sampled at the same point in each cycle gives the same
  picture without any UI, and `v8.getHeapStatistics()` adds the limit you are heading towards.

⚠️ **Do not compare peaks.** Peak height depends on when the collector last ran, which is not
under your control; the trough is the level that could not be reclaimed.

## Forcing collection, honestly

Comparing troughs is much easier if you can ask for a collection at the sampling point. Both
runtimes offer a way, and both come with a caveat:

- Browser devtools expose a **collect garbage** control in the memory panel.
- Node exposes `global.gc()` **only when started with `--expose-gc`**, which is a debugging flag
  and not something to ship.

🔴 **Never build product behaviour on forcing collection.** It exists for measurement. Collection
timing is deliberately unspecified — the same reason a `FinalizationRegistry` callback may never
run ([11 · Cost is retention](../11-the-memory-model/02-cost-is-retention.md)).

## What each tool measures — they are not the same number

| Tool | Measures |
|---|---|
| Devtools **memory panel** / heap snapshot | the **JavaScript heap** reachable from this page's roots |
| Devtools **performance** memory track | JS heap plus DOM node and listener counts over time |
| `performance.measureUserAgentSpecificMemory()` | the **whole agent's** memory for the page — including DOM and workers — where available, and gated on cross-origin isolation |
| Node `process.memoryUsage()` | `heapUsed`, `heapTotal`, plus **`external`** and **`arrayBuffers`**, which are *not* in the JS heap |
| `v8.getHeapStatistics()` | heap size against the configured limit |

🔴 **A "leak" invisible in the JS heap is usually not in the JS heap.** Buffers, WebAssembly
memory, and native handles show up in `external`/`arrayBuffers` in Node, and in the agent-wide
measurement in a browser — a heap snapshot will not explain them.

**Detached DOM nodes are the other classic miss**: they are retained by JavaScript but are cheap
in the JS heap and huge in the browser's own memory. Watching the **node count** rise across
identical cycles is often the fastest possible diagnosis, and needs no snapshot at all.

## A minimal, honest instrument you can add

When the leak only appears in production, or only on one user's machine, a cheap counter beats a
profiler you cannot attach:

```js
// dev-only: does this component ever get collected?
const alive = new FinalizationRegistry((label) => console.debug('collected', label));
export function trackLifetime(obj, label) { alive.register(obj, label); }
```

⚠️ **This is a diagnostic and nothing more.** The callback **may never run** even when the object
is collected, so *silence proves nothing* — only the message is information: it tells you the
object *can* be collected, which is exactly the question when you are trying to confirm a fix.

**Counting is the sturdier version**: increment on construction and decrement in teardown, and
expose the count. A count that rises across identical cycles is a leak, with no tooling at all.

## Gotchas

**Symptom: memory rises steadily, so we have a leak.**
Cause — the collector had not run; peaks say nothing.
Fix — compare the troughs after collection, at equivalent points in a repeatable cycle.

**Symptom: the first cycle allocates far more than later ones.**
Cause — lazily loaded code, warm caches, first-render work.
Fix — discard the first cycle; measure from the second onwards.

**Symptom: `heapUsed` is flat but the process keeps growing.**
Cause — the growth is in `external`/`arrayBuffers` — buffers, native handles — not the JS heap.
Fix — read the full `process.memoryUsage()`; a heap snapshot will not show it.

**Symptom: nothing suspicious in the heap snapshot, but the tab gets slower and heavier.**
Cause — detached DOM nodes; cheap in the JS heap, expensive in the browser.
Fix — watch the node count across cycles; look for retained detached trees.

**Symptom: the `FinalizationRegistry` never fires, so the object must be leaking.**
Cause — finalisers may never run; silence is not evidence.
Fix — treat only a fired callback as information; count instances instead.

**Symptom: the fix works locally with `--expose-gc` and not in production.**
Cause — behaviour was built on forced collection.
Fix — forcing collection is for measurement only; fix the retainer.

**Symptom: two snapshots disagree wildly between runs.**
Cause — different points in the cycle, or collection at different moments.
Fix — snapshot at the same point, after a forced collection, every time.

## Interview questions

**★ How do you tell a leak from a large working set?**
A leak grows with the number of *interactions* and does not come back after them; a working set
grows with the size of the data and is flat while you interact. Compare equivalent points across a
repeatable cycle.

**★ Why is a rising memory graph not proof of a leak?**
Because collection is lazy — a rising line is normal allocation. The evidence is that the
**troughs** rise after collection, not that the peaks do.

**★ What is the first thing you do?**
Build a repeatable cycle that returns to the starting state, discard the first run, and compare
the same point across cycles. Without that, no snapshot can be interpreted.

**★ Is `global.gc()` a fix?**
No. It exists behind `--expose-gc` for measurement. Collection timing is unspecified by design;
product behaviour must never depend on it.

**★ A Node process grows but `heapUsed` is flat. Where is the memory?**
In `external` or `arrayBuffers` — buffers and native allocations outside the JS heap. A heap
snapshot will not show them.

**★ Can `FinalizationRegistry` prove an object leaked?**
No. Its callback may never run, so silence proves nothing; only a fired callback is evidence, and
it is evidence the object *was* collected.

**What is the cheapest possible leak diagnosis?**
Counting: increment on create, decrement on destroy, and watch the count across identical cycles.

---

← *(topic index and next chunk land with the README)*
