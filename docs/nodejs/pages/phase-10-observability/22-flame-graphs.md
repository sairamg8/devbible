---
title: "Flame graphs — clinic.js and 0x"
sidebar_label: "22 · Flame graphs"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Visualization tools are npm packages.

{/* VERIFY: pin clinic and 0x versions; capture one flamegraph generation smoke run */}

**A flame graph is a stacked picture of where CPU samples landed — width is time in
that stack, y-axis is stack depth. You use it when a CPU profile's call table is hard
to see and you need the hot path to jump out.**

Built-in `--cpu-prof` (page 19) already gives you the data. `0x` and Clinic wrap
collection + visualization so you spend less time in DevTools chrome.

## Reading a flame graph

| Visual | Meaning |
|---|---|
| **Wide plateau** at the top of a tower | That frame (and its callees below / parents above, depending on orientation) ate many samples |
| **Many thin towers** | Time spread out — maybe I/O wait or diverse code |
| **Plateau in `JSON.parse` / crypto** | Familiar Node hotspots |
| **Almost empty of your code** | You may be I/O bound; CPU flame graphs will not show awaits well |

Always profile under the **load that hurts**, after warm-up, for long enough that the
wide frames are not noise.

## 0x

```bash
# pseudo-code — typical workflow
# npx 0x app.js
# generate load against the server
# Ctrl+C → opens/saves an interactive flame graph HTML
```

`0x` is aimed at "run my script, show me a flame graph" with low ceremony. Good for
local and staging canaries.

## Clinic.js

Clinic is a **suite** (Doctor, Flame, Bubbleprof, Heapprofiler) around Node
diagnostics:

| Tool | Rough job |
|---|---|
| **Clinic Flame** | CPU flame graphs under load |
| **Clinic Doctor** | High-level "what kind of problem" triage |
| **Bubbleprof** | Async delay patterns (I/O-ish) |
| **Heapprofiler** | Allocation / heap oriented views |

```bash
# pseudo-code
# npx clinic flame -- node app.js
# npx clinic doctor -- node app.js
```

Use Doctor when you do not know whether the issue is CPU, I/O, or something else;
use Flame when you already know the CPU is hot.

## When not to reach for these

| Situation | Prefer |
|---|---|
| First look at a slow API | Golden signals + lag + dependency timing (pages 9–15) |
| Memory retained set | Heap snapshots (page 17) |
| Continuous prod profiling | Vendor continuous profilers with sampling policies |
| One function already known hot | Targeted microbench only after profile proof (page 20) |

## Gotchas

**Symptom:** Flame graph is all `node:internal` / empty app frames
**Cause:** Work is async wait; samples land off your JS or in idle
**Fix:** Confirm lag/CPU first; use traces for await chains

**Symptom:** Pretty graph, wrong conclusion
**Cause:** Profiled idle process or wrong endpoint
**Fix:** Drive the bad path during capture; match production shape

**Symptom:** Tool HTML will not open in CI artifact browser
**Cause:** Offline JS / file:// restrictions
**Fix:** Download and open locally; or export data into DevTools

**Symptom:** Heavy overhead changed the bug
**Cause:** Profiling distorted timings
**Fix:** Shorter windows; sampling tools; compare with/without profiler

## Interview questions

**★ What does width mean in a flame graph?**
Portion of samples (roughly time) spent in that stack frame subtree.

**0x vs `--cpu-prof`?**
Same family of data; `0x` automates capture and interactive visualization. `--cpu-prof`
is built-in and DevTools-oriented.

**When is Clinic Doctor useful?**
Early triage when you do not yet know if the problem is CPU, I/O, or memory-shaped.

**Why might a flame graph fail to show a "slow" handler?**
The handler is waiting on I/O; CPU samples do not accumulate on the await.

**Should every production pod run Clinic continuously?**
No — on-demand / canary. Continuous profiling is a product decision with overhead and
PII policies.

---

← Prev: [GC basics](./21-gc-basics.md) · Next → [Startup time](./23-startup-time.md)
