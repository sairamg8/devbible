---
title: "CPU and heap profiling — --cpu-prof, --heap-prof, Inspector"
sidebar_label: "19 · CPU and heap profiling"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Profile files are written **on process exit**
> for the CLI flags below; Inspector is interactive while the process runs.

**When the event loop is hot or CPU is pegged, a profile shows which functions ate the
samples. When heap grows, a heap profile or snapshot shows what is retained. These
flags are how you get that evidence without guessing.**

## CLI CPU profile

```bash
node --cpu-prof app.js
# exercise the slow path, then exit cleanly
# writes CPU.<timestamp>.<pid>.cpuprofile
```

Open the `.cpuprofile` in Chrome DevTools → Performance / JavaScript Profiler (Load).

**Profiles flush on exit.** Killing `-9` can leave you with nothing. Prefer graceful
shutdown after reproducing, or use Inspector for a timed session.

```bash
node --cpu-prof --cpu-prof-interval=1000 app.js   # sample interval in µs
node --cpu-prof-dir=./profiles app.js
```

## CLI heap profile

```bash
node --heap-prof app.js
# Heap.<timestamp>.<pid>.heapprofile
```

This is an allocation timeline-style profile (heavy). For "what is retained right
now", prefer **heap snapshots** ([page 17](./17-memory-leaks.md)).

## Inspector protocol / Chrome DevTools

```bash
node --inspect=9229 app.js
# or break on start:
node --inspect-brk=9229 app.js
```

Chrome → `chrome://inspect` → the Node target → Profiler or Memory.

Useful when you cannot wait for process exit: start/stop CPU profiling from the UI
while you hit the slow endpoint.

```bash
# remote / container: listen on all interfaces carefully
node --inspect=0.0.0.0:9229 app.js
```

**Never leave `--inspect` exposed on a public IP** without authentication and network
policy — it is a full remote code surface.

## Reading a CPU profile for Node

| Signal in the profile | Interpretation |
|---|---|
| One of *your* functions dominates | Optimize or move that work off the loop |
| `JSON.parse` / `stringify` | Payload size or chatty serialization |
| Crypto / bcrypt / zlib sync | Sync CPU — async or worker / queue |
| Flat idle / little JS | You are probably I/O bound; wrong tool (page 15) |

## When to use which

| Goal | Tool |
|---|---|
| Hot CPU under load | `--cpu-prof` or Inspector CPU profile |
| Retained memory growth | Heap snapshot (page 17) |
| Allocation churn | `--heap-prof` or allocation instrumentation |
| Fleet-wide continuous profiling | Vendor / eBPF products — not these flags 24/7 on every pod |

Flame graph UIs (`0x`, Clinic) wrap the same idea with nicer pictures (page 22).

## Gotchas

**Symptom:** No `.cpuprofile` after a crash
**Cause:** Flag writes on exit; hard kill skipped flush
**Fix:** Graceful exit after repro; or Inspector live session

**Symptom:** Profile is all `node:internal` noise
**Cause:** Short sample or wrong moment
**Fix:** Longer window while the bad endpoint is hot; increase load

**Symptom:** Production latency worse while profiling
**Cause:** Profiling overhead
**Fix:** Canary pod only; short windows

**Symptom:** Security scan flags open inspect port
**Cause:** `--inspect=0.0.0.0` in prod compose files
**Fix:** Remove; use ephemeral debug sessions with port-forward

## Interview questions

**★ How do you take a CPU profile of a Node process?**
`node --cpu-prof` and exit cleanly, or `--inspect` + Chrome Profiler for a live
session.

**When is a CPU profile the wrong tool?**
When lag is low and you are waiting on I/O — profiles show idle, not await time.

**CPU profile vs heap snapshot?**
CPU: where time samples landed. Snapshot: what objects are alive and who retains them.

**Why is exposing `--inspect` on the public internet dangerous?**
The Inspector protocol allows debugging and code evaluation — treat it like root shell.

**Do profiles write continuously during the run with `--cpu-prof`?**
They sample during the run and **write the file on exit** for the CLI flag workflow.

---

← Prev: [Common leak sources](./18-common-leak-sources.md) · Next → [Benchmarking](./20-benchmarking.md)
