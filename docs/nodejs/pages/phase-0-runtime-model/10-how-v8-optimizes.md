---
title: "How V8 optimizes JavaScript"
sidebar_label: "10 · How V8 optimizes"
sidebar_position: 10
---

<span className="db-tier t-when">When Needed</span>

**Learn this the day a profiler points at JavaScript execution — which, for a
normal web application, is almost never.**

Included because "how does V8 optimize?" is a common interview question and
because it explains why hand-tuning JavaScript rarely pays.

## The tiers

V8 does not compile your code once. It compiles it repeatedly, getting more
aggressive as it learns how the code is actually used.

| Tier | What it does | When |
|---|---|---|
| **Ignition** | Interpreter — turns source into bytecode and runs it | Immediately, for everything |
| **Sparkplug** | Baseline compiler — bytecode to machine code, no optimisation | Once a function runs a few times |
| **Maglev** | Mid-tier optimising compiler | For warm functions |
| **TurboFan** | Heavily optimising compiler | For genuinely hot functions |

The trade-off runs one way: **fast to start, slow to optimise.** Ignition gets
your code running in microseconds; TurboFan produces excellent machine code but
costs time and memory to do it. Spending that on a function called twice would be
a loss, so V8 waits until the function proves it is worth it.

This is why a short script never reaches peak speed, and why benchmarks need
warm-up runs before they measure anything real.

## Speculation and deoptimization

The optimising tiers work by **guessing**. If `total(items)` has only ever been
called with arrays of objects that have a numeric `price`, TurboFan compiles a
version that assumes exactly that — no type checks, direct memory offsets.

The guess is guarded. Call it once with a string `price` and the guard fails, the
optimised code is thrown away, and execution falls back to the interpreter. That
is **deoptimization**, and a function that keeps flipping between the two — a
*deopt loop* — can be slower than one that was never optimised.

```console
$ node --trace-deopt app.js     # shows every bailout and its reason
```

## Hidden classes

Objects with the same properties, added in the same order, share an internal
**shape** (hidden class). Shared shapes let V8 cache where a property lives and
skip the lookup.

```js
// pseudo-code — an illustration of shape divergence, not a benchmark

// Same shape — V8 caches one lookup for all of them
function makeSame(i) { return { id: i, price: i * 2 }; }

// Many shapes — the property lives at a different offset in each
function makeMany(i) {
  const o = { id: i, price: i * 2 };
  if (i % 6 === 0) o.a = 1;
  if (i % 6 === 1) o.b = 1;
  // …four more variants
  return o;
}
```

**Deliberately not quantified here.** Shape stability is a real effect on
megamorphic property access, and it is small enough that an honest microbenchmark
struggles to separate it from allocation noise: complete the six branches above
and the naive comparison reports anywhere from +41% to +111%, but almost all of
that is the *extra property assignment* rather than the shape change. Control for
property count and three consecutive runs give −6%, +14% and +2% — straddling
zero.

Which is exactly why this sits at rank 6 below. A page that stakes a number on a
microbenchmark it cannot reproduce is teaching the cargo cult this section exists
to warn against. Restructure objects for shape stability only when a profiler has
already told you this loop is the problem.

The practical version of this advice is just good style anyway: give objects all
their properties at construction, keep property types stable, and do not `delete`
properties from hot objects.

## Where the time actually goes

For a typical Node web service, ranked by how much it usually matters:

1. **Database queries** — missing indexes, N+1 queries, no connection pooling.
2. **Network calls** — serial requests that could be parallel, no keep-alive.
3. **Blocking the event loop** — see
   [Blocking the event loop](03-blocking-the-event-loop.md).
4. **Serialisation** — `JSON.stringify` on responses far larger than they need
   to be.
5. **Algorithms** — an accidental O(n²) over a list that grew.
6. **V8 micro-optimisation.**

Item 6 is last for a reason. Every hour spent there is an hour not spent on the
first five.

## Measuring, if you must

```console
$ node --prof app.js                     # writes isolate-*.log
$ node --prof-process isolate-*.log      # human-readable summary
```

```console
Statistical profiling result from isolate-0x22c56000-v8.log, (184 ticks, 0 unaccounted).

 [JavaScript]:
   ticks  total  nonlib   name
     57   31.0%   57.0%  JS: *<anonymous> [eval]:1:1
```

The `*` prefix means the function was optimised; `~` means it was not. Other
useful flags: `--trace-deopt` for bailouts, `--cpu-prof` for a `.cpuprofile` you
can open in Chrome DevTools. Proper profiling, flame graphs and heap snapshots
are Phase 10.

## Garbage collection, briefly

V8 splits the heap into a small **young generation** (collected often and
cheaply, because most objects die immediately) and an **old generation**
(collected rarely and expensively). Most GC work is concurrent, but the pauses
are still on your one thread.

`--max-old-space-size=4096` raises the old-space limit in megabytes. Reach for it
when you have proven a legitimately large working set — not to postpone a memory
leak, which will only make the eventual crash slower and larger.

## Gotchas

**Symptom:** A micro-benchmark shows an enormous difference that vanishes in the
real application
**Cause:** No warm-up, so you measured the interpreter; or V8 eliminated the loop
entirely because the result was unused.
**Fix:** Warm up before timing, consume the result, and prefer measuring the real
workload over a synthetic loop.

**Symptom:** A function got dramatically slower after one small change
**Cause:** It deoptimised — often a new argument type, a `try`/`catch` added in a
hot path in older V8, or a property deleted from an object.
**Fix:** `--trace-deopt` and read the reason. Keep argument types consistent.

**Symptom:** Memory climbs steadily until the process is OOM-killed
**Cause:** A leak — an unbounded cache, an array that only ever grows, listeners
added per request and never removed.
**Fix:** Take heap snapshots and compare. Raising `--max-old-space-size` buys
time, not a fix.

**Symptom:** Latency spikes every few seconds with no matching traffic pattern
**Cause:** Major GC pauses, usually from allocating large short-lived objects at
high rate.
**Fix:** Allocate less in the hot path — stream large payloads rather than
buffering them whole, and reuse buffers where it is safe.

## Interview questions

**★ How does V8 execute JavaScript?**
It interprets first with Ignition, then progressively compiles hot code through
Sparkplug, Maglev and TurboFan. The optimising tiers speculate on the types they
have observed; if a speculation is violated, the code deoptimises back to the
interpreter.

**★ What is deoptimization, and what triggers it?**
Discarding optimised machine code because an assumption it was compiled under no
longer holds — typically a function receiving a type it had not seen before. The
cost is not the single bailout but a function that repeatedly re-optimises and
bails.

**★ What is a hidden class?**
V8's internal description of an object's shape. Objects built with the same
properties in the same order share one, which lets V8 cache property offsets
instead of looking them up. Adding properties conditionally or deleting them
creates new shapes and defeats the cache.

**Should you write code to please the optimiser?**
No, not by default. The measured effect of shape stability in a realistic loop is
single-digit percent, while a missing index or a serial `await` costs orders of
magnitude. Optimise for readability, profile, and only then look at V8 behaviour.

**Why do benchmarks need warm-up runs?**
Because the first executions run in the interpreter. Without warm-up you measure
Ignition, not the optimised code your production process will actually run.

**What does `--max-old-space-size` do, and when is raising it right?**
It sets V8's old-generation heap limit in MB. Raise it when the application
genuinely needs a large working set — a big in-memory index, large document
processing. Raising it to make an OOM go away just delays a leak.

---

← Prev: [Node vs Deno vs Bun](09-node-deno-bun.md) · Index: [Phase 0](README.md)
