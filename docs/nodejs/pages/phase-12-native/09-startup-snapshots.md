---
title: "Startup snapshots"
sidebar_label: "09 · Startup snapshots"
sidebar_position: 9
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24**. Snapshot tooling is advanced and version-sensitive;
> pair with compile cache notes in Phase 10.

**A startup snapshot freezes a running V8 heap after your bootstrap so the next launch
skips re-parsing and re-running that init. It is a specialist lever for CLI tools and
huge dependency graphs — not the first fix for a normal API's boot time.**

## How it relates to other boot tools

| Tool | What it caches |
|---|---|
| **`enableCompileCache()`** | Compilation of source ([Phase 10](../phase-10-observability/23-startup-time.md)) |
| **Startup snapshot** | Initialised heap state after a script runs |
| **SEA** | Single binary packaging ([Phase 5](../phase-5-http-processes/26-single-executable-applications.md)) |

Compile cache is the practical win for many apps. Snapshots are for when you control
the exact bootstrap and can rebuild snapshots in CI per Node version.

## Conceptual workflow

```bash
# pseudo-code — exact flags evolve; consult Node 24 docs when implementing
# 1) run a bootstrap that imports heavy modules and warms state
# 2) write a snapshot blob
# 3) later launches load the blob then run main
```

Constraints you will hit:

- Snapshot is **tied to the Node/V8 build**  
- Not everything can be snapshotted (native addons, some handles)  
- You must design bootstrap to be snapshot-safe (no listen() before snapshot unless
  intentional)  

## When to bother

| Yes | No |
|---|---|
| CLI invoked thousands of times/day | Long-lived API pod started weekly |
| Proven boot cost in module eval | Slow DB connect dominates ready time |
| Team owns the toolchain | Hoping for free magic without CI rebuilds |

Measure time-to-ready first ([Phase 11 boot](../phase-11-deployment/02-boot-sequence.md)).

## Gotchas

**Symptom:** Snapshot invalid after Node patch
**Cause:** Engine mismatch
**Fix:** Rebuild snapshots in CI for each runtime artifact

**Symptom:** Server in snapshot already listening
**Cause:** Bootstrap bound ports
**Fix:** Split "load code" from "listen"; snapshot only the former

**Symptom:** Native addon crashes on snapshot resume
**Cause:** Addon not snapshot-friendly
**Fix:** Lazy-load addon after resume; or skip snapshots

## Interview questions

**★ What is a V8/Node startup snapshot for?**
Restore a pre-initialised heap to skip repeated bootstrap work.

**How is it different from compile cache?**
Compile cache stores compilation artifacts; snapshots store initialised heap state.

**Who benefits most?**
Short-lived processes with heavy JS init — CLIs, some functions — more than steady APIs.

**Why rebuild snapshots in CI?**
They are coupled to the exact Node binary/version.

**What should you measure before adopting snapshots?**
Boot phases — do not snapshot your way around a slow network dependency.

---

← Prev: [Custom loaders](./08-custom-loaders.md) · Next → [Contributing to Node](./10-contributing-to-node.md)
