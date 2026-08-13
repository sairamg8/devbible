---
title: "11 · The JIT in one page"
sidebar_label: "11 · The JIT"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 **13.6.233.17**). Scripts:
> `sandbox/js-p0/ex5-jit.mjs` (run with `--allow-natives-syntax`),
> `ex11-benchmark-lies.mjs`. Both timing results reproduced across two runs.

**You do not tune for the JIT. You avoid confusing it, and you distrust your own
benchmarks.** That is the entire practical content of this topic — the rest is
background that stops you from writing code based on folklore.

## The tiers

V8 does not compile your code once. It escalates:

| Tier | What it does | When |
|---|---|---|
| **Ignition** | Interpreter — makes bytecode, starts immediately | Every function, first |
| **Sparkplug** | Fast baseline compiler, no optimisation | Warm functions |
| **Maglev** | Mid-tier optimising compiler | Hotter |
| **TurboFan** | Fully optimising compiler | Hot functions with stable types |

The optimising tiers make **assumptions** from what they have observed — "this
function always receives two numbers" — and compile specialised machine code. If
an assumption is later violated, the code is thrown away and execution falls back
to the interpreter. That is a **deoptimisation**.

## Measured: optimise, then deopt

```js
// sandbox/js-p0/ex5-jit.mjs — run: node --allow-natives-syntax ex5-jit.mjs
function add(a, b) { return a + b; }

for (let i = 0; i < 100000; i++) add(i, i);
%PrepareFunctionForOptimization(add);
add(1, 2); add(3, 4);
%OptimizeFunctionOnNextCall(add);
add(5, 6);

const bits = %GetOptimizationStatus(add);
console.log('optimized (numbers only):', (bits & 16) !== 0, '| status bits:', bits);

add('a', 'b');   // strings — a shape never seen before
add({}, []);     // objects
for (let i = 0; i < 1000; i++) add(i, i);
console.log('after mixed types, still optimized:', (%GetOptimizationStatus(add) & 16) !== 0);
```

```
optimized (numbers only): true | status bits: 81
after mixed types, still optimized: false
```

`add` was optimised while it only ever saw numbers, and was **thrown out of
optimised code** the moment it was called with strings and objects. Nothing about
the function changed — only the shapes flowing through it.

That is the one actionable idea in this page:

> **Keep the shape of your data stable.** A function called with numbers should
> keep being called with numbers. An array of objects should have the same keys
> in the same order in every element. Not because you are optimising — because
> the engine is, and inconsistency is what stops it.

In practice, normalise API payloads once at the boundary so every downstream
object has the same shape, rather than letting optional fields appear and
disappear. That is good design independently; the JIT benefit is free.

## Measured: why a single timing is worthless

```js
// sandbox/js-p0/ex11-benchmark-lies.mjs
const data = Array.from({length: 1000}, (_, i) => ({qty: (i % 5) + 1, priceMinor: 1000 + i}));
function total(lines) { let t = 0; for (const l of lines) t += l.qty * l.priceMinor; return t; }

let t0 = performance.now(); total(data); const cold = performance.now() - t0;
for (let i = 0; i < 20000; i++) total(data);      // warm-up
t0 = performance.now(); total(data); const warm = performance.now() - t0;
console.log(`cold: ${cold.toFixed(4)}ms  warm: ${warm.toFixed(4)}ms  ratio: ${(cold/warm).toFixed(1)}x`);
```

```
run 1 → cold: 0.2079ms  warm: 0.0074ms  ratio: 28.2x
run 2 → cold: 0.2135ms  warm: 0.0074ms  ratio: 28.9x
```

**Identical function, identical input, 28× apart** — and reproducible. The first
call ran in the interpreter; by the measured call it was fully optimised.

So any benchmark that times one run of each candidate is measuring compilation
state, not the code. If you compare implementation A cold against implementation
B warm, you can produce whatever answer you want.

**Minimum honest procedure:** warm each candidate for thousands of iterations
*before* timing, run each many times, report a median rather than a mean, and run
the whole thing more than once. Better: use a library (`mitata`, `tinybench`)
that handles this, or measure the real application instead.

### One piece of folklore that did **not** reproduce

The usual warning is that V8 deletes a loop whose result you discard, making the
benchmark measure nothing:

```js
function deadWork() { let x = 0; for (let i = 0; i < 1e7; i++) x += i; }        // result discarded
function keptWork() { let x = 0; for (let i = 0; i < 1e7; i++) x += i; return x; } // result returned
```

```
result discarded: 30.10ms   result returned: 29.13ms  (sum 49999995000000)
result discarded: 30.23ms   result returned: 28.63ms  (sum 49999995000000)
```

**30 ms versus 29 ms — no elimination.** On V8 13.6 the discarded loop ran at
full cost. The advice to "return the result so it isn't optimised away" is
repeated widely; it did not reproduce here.

Keep returning the value anyway — it costs nothing, it is true on other engines
and other V8 versions, and dead-code elimination is exactly the kind of thing
that changes between releases. But do not cite it as a measured fact, because on
this runtime it is not one.

## What actually makes JavaScript slow

Almost never the JIT. In a real application, in rough order:

1. **Network** — request count, payload size, waterfalls.
2. **The DOM** — layout thrashing, rendering thousands of nodes
   ([Phase 9](../../syllabus/03-web-apis.md)).
3. **Algorithmic complexity** — an O(n²) loop over a product list
   ([Phase 13](../../syllabus/04-dsa-and-machine-coding.md)).
4. **Blocking the main thread** — a long task that delays input response.
5. **Then, distantly, engine-level effects.**

Fixing 3 turns 400 ms into 4 ms. Micro-tuning for the JIT does not.

## Gotchas

**Symptom:** a micro-benchmark says A is 10× faster than B; in the app they are
identical.
**Cause:** the benchmark measured compilation state, cold versus warm — measured
here as a 28× swing on the *same* function.
**Fix:** warm both, run many iterations, report a median. Then measure the real
application, because a micro-benchmark rarely reproduces real conditions.

**Symptom:** a hot function got slower after adding a feature.
**Cause:** a new call site passes a different type or object shape, deoptimising
it — reproduced above by adding string and object arguments.
**Fix:** keep argument types stable; split polymorphic helpers into separate
functions per type rather than branching inside one.

**Symptom:** an optimisation tuned on Chrome makes no difference in Safari.
**Cause:** JavaScriptCore has a different compiler pipeline and different
heuristics.
**Fix:** optimise algorithms and I/O, which help everywhere. Engine-level
tweaking does not transfer.

**Symptom:** timings vary wildly between runs on a laptop.
**Cause:** CPU frequency scaling, thermal throttling and background load.
**Fix:** many iterations, median not mean, and never compare numbers taken at
different times or on different machines.

## Interview questions

**★ What is a deoptimisation?**
The optimising compiler specialises a function based on the types it has
observed. If a later call violates that assumption, the optimised code is
discarded and execution falls back to the interpreter, then re-optimises with the
broader assumption. Measured: `add(a, b)` was optimised while only numbers
flowed through it, and reported unoptimised after being called with strings and
objects.

**★ Why are JavaScript micro-benchmarks unreliable?**
Because the engine compiles progressively. The same function measured cold and
warm differed by **28×** in a reproduced run, so a benchmark that times a single
call of each candidate measures compilation state rather than the code. Add dead
code elimination, engine differences and CPU throttling and the result is
whatever you accidentally arranged.

**Should you write code to help the JIT?**
Only as a byproduct of good design: consistent object shapes and consistent
argument types. Those come free from normalising data at the boundary. Beyond
that, engine-specific tuning is unstable across engines and versions and is
almost never the bottleneck — network, DOM and algorithmic complexity are.

**What are V8's compilation tiers?**
Ignition interprets bytecode immediately; Sparkplug is a fast baseline compiler;
Maglev is a mid-tier optimiser; TurboFan produces fully optimised code for hot,
type-stable functions. Code escalates as it gets hotter and falls back when an
assumption breaks.

**How would you benchmark two implementations honestly?**
Warm both for thousands of iterations before timing, run many measured
iterations, report the median, repeat the whole run, and use the same machine and
conditions. Prefer an established harness. Then confirm against the real
application, because that is the number that matters.

---

← [10 · Feature detection](./10-feature-detection.md) · [Phase index](./) · Next: [12 · Reading the specification](./12-reading-the-spec.md) →
