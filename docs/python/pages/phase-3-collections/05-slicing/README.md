---
title: "05 · Slicing deeply"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against Python 3.14.7 — docs.python.org/3.14 (common sequence operations, slicings, slice objects, `itertools.islice`, the time-complexity table) and CPython v3.14.7 source, marked as implementation detail where the docs are silent — see each chunk's own `> Verified:` line.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**`[start:stop:step]`, negatives, slice assignment, and slices as copies.**

:::caution In progress — 24 chunks written
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
| 9 | **[07 · itertools.islice and iterators](07-islice-and-iterators.md)** | An iterator has no positions, so islice walks from the front and discards what it skips — it advances the iterator it… |
| 10 | **[07b · islice bounds and negatives](07b-islice-bounds.md)** | islice takes only non-negative integers — the last n and all-but-the-last n are a bounded deque, and a bad bound is… |
| 11 | **[07c · islice in practice](07c-islice-in-practice.md)** | take, nth, consume, sliding windows and batched are each a line of islice — and on a list islice walks where a slice… |
| 12 | **[07d · islice lifetimes](07d-islice-lifetimes.md)** | An islice is a one-pass, length-less, always-truthy iterator, and a generator it stops early stays suspended with its… |
| 13 | **[08 · Slice assignment](08-slice-assignment.md)** | Assigning to a slice replaces a run of elements with the contents of any iterable, lengths independent — replace,… |
| 14 | **[08b · Slice bounds and target types](08b-slice-bounds-and-types.md)** | On the left of =, clamped bounds change the operation — past the end appends, a reversed pair inserts, -0 empties —… |
| 15 | **[08c · Slice assignment versus rebinding](08c-slice-assignment-versus-rebinding.md)** | a = new moves one name and leaves every other holder on the old list; a[:] = new rewrites the object every holder… |
| 16 | **[09 · Extended-slice assignment](09-extended-slice-assignment.md)** | An extended slice names scattered positions, so assignment is one-for-one — and a step of 1 is decided at run time,… |
| 17 | **[09b · Deleting slices](09b-deleting-slices.md)** | del on a slice removes a run or a pattern in one pass — no length rule, no IndexError — and a comma-separated del runs… |
| 18 | **[09c · Deletion cost and types](09c-deletion-cost-and-types.md)** | A list deletion moves the tail, a bytearray front deletion only advances its start, del a forgets a name, and the… |
| 19 | **[10 · Slicing your own class](10-slicing-your-own-class.md)** | A slice reaches your class as a slice object in __getitem__ that validates nothing — raise TypeError for the kind,… |
| 20 | **[10b · Integer keys and return types](10b-integer-keys-and-return-types.md)** | Convert integer keys with operator.index, never int(), and choose the slice return type on purpose — subclasses of… |
| 21 | **[10c · `__setitem__`, `__delitem__` and the ABCs](10c-setitem-delitem-and-the-abcs.md)** | Writes and deletes reach your class with a slice key; no ABC mixin handles it, and a validating list subclass is… |
| 22 | **[10d · Typing and multi-dimensional keys](10d-typing-and-multidimensional-keys.md)** | Type __getitem__ with two overloads, not a union; a comma passes a tuple, which a 2-D class interprets per axis and a… |
| 23 | **[11 · Slicing in real code: pagination](11-slicing-in-real-code.md)** | A page is two multiplications — page 0 is empty, page −1 is a real page from the end, a page past the last is silently `[]`, and `OFFSET` walks… |
| 24 | **[11b · Slicing in real code: batching](11b-batching.md)** | `items[i:i + n]` tiles a list with nothing lost and the offset is the checkpoint — a relative resume, a front-deleting drain and a cut inside a character… |

## Still to come

- **11c · Fixed-width records** *(not written yet)*

---

← [Phase index](../README.md)
