---
title: "05 · Slicing deeply"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against Python 3.14.7 — docs.python.org/3.14 (common sequence operations, slicings, slice objects, `itertools.islice`, the time-complexity table) and CPython v3.14.7 source, marked as implementation detail where the docs are silent — see each chunk's own `> Verified:` line.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**`[start:stop:step]`, negatives, slice assignment, and slices as copies.**

:::caution In progress — 8 chunks written
This topic is being written. The chunks below are complete and verified; the rest of the plan,
listed under *Still to come*, is not written yet and will be linked here as each chunk lands.
:::

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · The three numbers](01-the-three-numbers.md)** | A slice is two fence posts and a stride — start is in, stop is out, negative numbers count back from the end, and -0… |
| 2 | **[02 · Negative steps](02-negative-steps.md)** | A negative step flips which ends the defaults point at, and the omitted stop becomes a position no number can spell —… |
| 3 | **[02b · Strides and reversal](02b-strides-and-reversal.md)** | A step of k takes every k-th element from wherever the walk starts — so a backwards stride picks positions by the… |
| 4 | **[03 · Out of range never raises](03-out-of-range-never-raises.md)** | An index outside the sequence raises and a slice outside it never does — slicing clamps silently, so it cannot tell… |
| 5 | **[04 · slice objects](04-slice-objects.md)** | a[1:5:2] is a[slice(1, 5, 2)] — a slice is an ordinary, hashable, reusable object, so a fixed-width layout can be a… |
| 6 | **[04b · slice.indices()](04b-slice-indices.md)** | slice.indices(n) turns a slice into concrete positions with exactly the clamping the built-in sequences use — the way… |
| 7 | **[05 · Slices are copies](05-slices-are-copies.md)** | Slicing a list, tuple, str, bytes or bytearray builds a new object of the base type holding the same references —… |
| 8 | **[06 · Slices that do not copy](06-slices-that-do-not-copy.md)** | memoryview slices and range slices are views and recomputations, not copies — O(1) instead of O(k), at the price of… |

## Still to come

- **`itertools.islice` and iterators** *(not written yet)*
- **Slice assignment — growing, shrinking, and `a[:] = …` versus rebinding** *(not written yet)*
- **Extended-slice assignment and `del`** *(not written yet)*
- **Slicing your own class — `__getitem__` with a `slice`** *(not written yet)*
- **Slicing in real code — pagination, batching, fixed-width records** *(not written yet)*

---

← [Phase index](../README.md)
