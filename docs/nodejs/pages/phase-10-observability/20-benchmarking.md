---
title: "Benchmarking — autocannon, mitata, and why microbenchmarks lie"
sidebar_label: "20 · Benchmarking"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Tool APIs are package-dependent.

{/* VERIFY: pin autocannon and mitata versions; record a sample RPS run against a local hello server */}

**A benchmark answers a specific question under a specific load shape. A
microbenchmark answers a different question — often one production never asks — with
confidence it has not earned.**

## Two different tools

| Tool | Level | Good for |
|---|---|---|
| **autocannon** (or `wrk`, `k6`) | HTTP, multi-connection | "How many RPS can this server sustain at p99 X?" |
| **mitata** / `Benchmark.js` style | In-process functions | "Is algorithm A faster than B in isolation?" |

```js
// pseudo-code — HTTP load
// npx autocannon -c 100 -d 20 http://127.0.0.1:3000/orders
```

```js
// pseudo-code — microbench
// await bench.group(() => {
//   bench('map', () => arr.map(x => x * 2));
//   bench('loop', () => { const o = []; for (const x of arr) o.push(x * 2); });
// });
```

Use HTTP load when the claim is about the **service**. Use microbenches when you
already know the hot function from a profile (page 19).

## Why microbenchmarks lie

1. **V8 optimizes the toy, not the app** — monomorphic tiny functions get TurboFan
   love that polymorphic production paths never see.  
2. **Dead code elimination** — if you never use the result, the work may vanish.  
3. **Wrong scale** — winning 3 ns on a function called once per request does not move
   p99 when the DB takes 40 ms.  
4. **No GC / no I/O / no contention** — the real cost is often elsewhere.  
5. **Warm-up** — first iterations include compile time; publish steady-state numbers
   only.

```js
// force the result to be observed (shape of a real microbench discipline)
let sink = 0;
function benchBody(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  sink = s;
}
```

## HTTP benchmark discipline

| Rule | Why |
|---|---|
| Fix Node version, CPU governor, noisy neighbours | Reproducibility |
| Warm up before measuring | JIT and caches |
| Report **p99 / p95**, not only RPS mean | User experience lives in the tail |
| Separate client machine when possible | Do not starve the server under test |
| Watch lag and CPU on the server during the run | Know which resource you hit |
| Change one variable | Or you cannot attribute the win |

## Connecting to the rest of the phase

- Bottleneck first ([page 15](./15-finding-the-bottleneck.md)) — benchmark the path you
  proved matters.  
- Golden signals ([page 11](./11-golden-signals.md)) — load tests should record them.  
- Caching ([page 16](./16-caching-strategy.md)) — a benchmark that only hits cold cache
  is a different product than warm cache.

## Gotchas

**Symptom:** Microbench says 10× faster; production p99 unchanged
**Cause:** Optimized off the critical path, or V8 special-case
**Fix:** Profile production-like load; optimize the sample hotspots

**Symptom:** Autocannon RPS collapses on the client machine
**Cause:** Client is the bottleneck (connections, CPU, localhost quirks)
**Fix:** More client resources; verify server CPU not idle

**Symptom:** Numbers swing ±30% between runs
**Cause:** Thermal throttling, shared CI, turbo boost
**Fix:** Longer runs, pin CPUs, treat small deltas as noise

**Symptom:** "We are fine at 5k RPS" but real traffic is 200 RPS with fat payloads
**Cause:** Benchmark used tiny JSON and no auth/DB
**Fix:** Realistic bodies, auth, and dependency latency (or recorded stubs)

## Interview questions

**★ Why do microbenchmarks mislead Node performance work?**
They measure isolated, often over-optimized snippets without I/O, GC pressure, or
polymorphism — and may not sit on the real critical path.

**When is autocannon the right tool?**
When you need request-level latency and throughput under concurrency against a running
server.

**What numbers do you publish from a load test?**
RPS plus latency percentiles (p50/p95/p99), error rate, and server saturation (CPU,
lag).

**How do you stop V8 from optimizing away a microbench body?**
Consume the result (accumulate to a sink the runtime cannot prove unused).

**What should you do before writing any benchmark?**
Know the bottleneck and the production-like scenario you are claiming to model.

---

← Prev: [CPU and heap profiling](./19-cpu-heap-profiling.md) · Next → [GC basics](./21-gc-basics.md)
