---
title: "Transform streams"
sidebar_label: "Overview"
sidebar_position: 0
---

# Transform streams

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A Transform is the reusable middle of a pipeline. Writing one is two methods —
`_transform` and `_flush` — and the whole difficulty is that chunk boundaries do
not respect your data's structure.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Writing a Transform, and the boundary problem](01-transform-and-boundaries.md)** | The minimal Transform, `_transform` and `_flush`, and the boundary bug — a secret that spans two chunks matches in neither. Framing as the fix, and the callback contract |
| 02 | **[Encodings, async work and the alternatives](02-encodings-and-async.md)** | `decodeStrings` and what arrives at `_transform`, awaiting inside a transform without scrambling order, and when an async generator beats a class |

## Phase gate

- What does `_flush` do that `_transform` cannot?
- Why does a regex inside a Transform miss a match that is plainly in the data?
- What happens if `callback` is never called — and what if it is called twice?
- Can a Transform process two chunks at once?
- When is an async generator the better stage?

## Where this connects

- **[Stream events, flowing and paused](../12-stream-events-and-modes.md)** covers
  the modes a Transform sits between.
- **[Object mode](../14-object-mode.md)** is how a Transform emits records rather
  than bytes, which is what framing produces.
- **[pipeline](../10-pipeline.md)** is how these stages get composed, and where a
  transform's errors surface.

---

← Prev: [Stream events, flowing and paused](../12-stream-events-and-modes.md) · Start → [Writing a Transform, and the boundary problem](01-transform-and-boundaries.md)
