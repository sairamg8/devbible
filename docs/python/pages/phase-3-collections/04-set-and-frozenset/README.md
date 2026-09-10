---
title: "04 · `set` and `frozenset`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against Python 3.14.7 — docs.python.org/3.14 (Set Types, the time-complexity table, the thread-safety page) and CPython v3.14.7 `Objects/setobject.c`, marked as implementation detail where the docs are silent — see each chunk's own `> Verified:` line.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**O(1) membership, dedupe, and set algebra instead of a nested loop.**

:::caution In progress — 7 chunks written
This topic is being written. The chunks below are complete and verified; the rest of the plan,
listed under *Still to come*, is not written yet and will be linked here as each chunk lands.
:::

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · The hash table underneath](01-the-hash-table-underneath.md)** | A set is a hash table of references with nothing attached — `x in s` hashes `x` once and inspects a few slots instead… |
| 2 | **[1b · What the table costs you](01b-what-the-table-costs-you.md)** | Every restriction on a set — elements that must be hashable, no index, no order, and a stored hash the set never… |
| 3 | **[1c · What O(1) does not promise](01c-what-constant-time-does-not-promise.md)** | The O(1) on the 3.14 cost table is an average that assumes cheap, well-spread hashes — a bad `__hash__` makes every… |
| 4 | **[1d · A table that never shrinks](01d-a-table-that-never-shrinks.md)** | A set does not get cheaper when you empty it — removal marks slots deleted and never resizes, so iteration and… |
| 5 | **[2 · The membership test in a loop](02-the-membership-test-in-a-loop.md)** | An `in` test against a 50,000-element list inside a loop is the most common accidental O(n·m) in a Python service —… |
| 6 | **[3 · Set algebra instead of nested loops](03-set-algebra-instead-of-nested-loops.md)** | Every nested loop that asks "which of these are also in that" is a set operation in disguise — intersection,… |
| 7 | **[3c · Set comparison is a partial order](03c-set-comparison-is-a-partial-order.md)** | Set comparison is containment, and containment is only a partial order — `not (a < b)` is not `a >= b`, two sets can… |

## Still to come

- **Operators versus methods — in-place forms, and why methods take any iterable while operators need sets** *(not written yet)*
- **Dedupe and what it destroys** *(not written yet)*
- **`frozenset` — hashable sets, sets of sets, mixed-type results** *(not written yet)*
- **Iteration order — arbitrary, and different between runs** *(not written yet)*
- **Equal but distinct elements — `1`, `1.0` and `True`, and NaN** *(not written yet)*
- **Custom classes as elements** *(not written yet)*
- **Diffing ID sets from a database or an API** *(not written yet)*

---

← [Phase index](../README.md)
