---
title: "02 · Sliding window"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)). Documentation-validated; **no timings**.

**One template, four blanks.** Expand from the right, shrink from the left while the window is
invalid, record, answer — and the interesting part is knowing which problems it does *not* cover.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The expand/shrink template](./01-the-template.md)** | The template and its four blanks; 🔴 **why a `while` inside a `for` is still O(n)** and how to say it; longest-substring-without-repeats with the ⚠️ **`lastSeen >= left` guard** that stops `left` moving backwards; **minimum-window-substring**, where the record step moves *inside* the shrink loop and 🔴 **letting counts go negative** is what keeps it linear; fixed-size windows as add-one/drop-one; and the two-part recognition rule |
| 2 | **[Variants and traps](./02-variants-and-traps.md)** | Counting windows — 🔴 **`total += right - left + 1`** — and the ⚠️ **zero-count entries that break `counts.size`**; "exactly k" as `atMost(k) - atMost(k-1)` and why no direct window exists; window maxima needing a monotonic deque (and that deque needing a head index); **windows on streams**, with a rate limiter and the honest note that a sliding log costs one timestamp per request; the table of where the pattern **stops** — led by 🔴 **negative numbers, which fail silently**; and the two JavaScript traps, UTF-16 indexing and `MAX_SAFE_INTEGER` |

## The three sentences to keep

1. **Expand right, shrink left while invalid, record.** Maximum problems record after; minimum
   problems record inside the shrink loop.
2. **It is O(n) because `left` only advances** — each index enters and leaves once.
3. **Negative numbers break sum-based windows silently.** Shrinking no longer reduces the value;
   use prefix sums with a hash map.

## Phase gate

You are done with this topic when you can write the template from memory, explain its linear bound
to someone who sees nested loops, move the record step correctly for a minimum-length problem,
and name three situations where the pattern does not apply.

## Where this connects

- [01 · Two pointers](../01-two-pointers/README.md) — the same-direction pointers this is built on
- [04 · Hash-map patterns](../04-hash-map-patterns/README.md) — what to use when the subarray need not be contiguous
- [Phase 14 · 05 · Queue and deque](../../phase-14-data-structures/05-queue-and-deque/README.md) — the monotonic deque for window maxima
- [Phase 13 · 01 · 02 · Reading a bound](../../phase-13-complexity/01-big-o/02-reading-a-bound.md) — counting total work rather than nesting depth

---

Start → [01 · The expand/shrink template](./01-the-template.md)
