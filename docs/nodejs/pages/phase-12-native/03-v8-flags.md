---
title: "V8 flags — what they actually control"
sidebar_label: "03 · V8 flags"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `node --v8-options` lists flags; heap sizing
> via Node wrappers measured in Phase 10.

**V8 flags tune the engine: heap limits, GC tracing, compilation. Most production apps
need none of them beyond `--max-old-space-size`. The rest are diagnostics — not casual
performance knobs.**

## How you pass them

```bash
node --max-old-space-size=4096 app.js
node --v8-options | less          # full list for this binary
node --trace-gc app.js            # GC logging (noisy)
```

Some flags are exposed as **Node options**; others need `--` passthrough forms. Prefer
documented Node options when both exist.

## Flags you might actually use

| Flag / option | Role |
|---|---|
| `--max-old-space-size=MB` | Cap old-space growth; OOM when exceeded |
| `--max-semi-space-size` | Young generation sizing (advanced) |
| `--trace-gc` / `--trace-gc-verbose` | See pauses while debugging |
| `--inspect` / `--inspect-brk` | Debugger — not a V8 perf flag, but related tooling |
| `--prof` (legacy) / CPU prof | Prefer Node `--cpu-prof` ([Phase 10](../phase-10-observability/19-cpu-heap-profiling.md)) |

Measured earlier: `--max-old-space-size=256` produced `heap_size_limit` **~448 MB** on
this host — the limit is not always equal to the number you pass
([Phase 10 GC](../phase-10-observability/21-gc-basics.md)).

## What not to do

- Copy a random blog's `# random V8 flags for 2x speed` into production  
- Leave `--trace-gc` on in prod (log volume and overhead)  
- Use experimental harmony flags as a product dependency without a pin  

Harmony / staged features (`--harmony-*`) can vanish or change; treat them as
experiments.

## Listing and discipline

```bash
node --v8-options 2>&1 | head
```

Teams should **document any non-default flag** in the deployment repo with a reason and
an owner. Undocumented flags are unowned risk.

## Gotchas

**Symptom:** OOM with "plenty" of container memory
**Cause:** Heap flag lower than cgroup; or RSS includes off-heap
**Fix:** Align cgroup, heap flag, and RSS monitoring

**Symptom:** "Faster GC flags" made latency worse
**Cause:** GC tuning without measurement
**Fix:** Revert; fix allocation rates; measure lag

**Symptom:** Works with a flag, fails without in CI
**Cause:** Hidden dependency on experimental behaviour
**Fix:** Remove flag or formalize and test both paths

## Interview questions

**★ Which V8-related flag is most common in production Node?**
`--max-old-space-size` to bound heap growth for the process.

**How do you see available V8 flags?**
`node --v8-options` on the same binary you deploy.

**Why avoid random performance flags?**
They are engine knobs with trade-offs; without measurement they add risk and variance.

**How does max-old-space-size interact with Kubernetes memory limits?**
Heap limit is V8's; cgroup kills on RSS. Both must be sized together.

**Is --trace-gc a production default?**
No — diagnostic only.

---

← Prev: [WebAssembly](./02-webassembly.md) · Next → [Node-API](./04-node-api.md)
