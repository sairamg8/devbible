---
title: "`x in xs`, `xs.index(x)` and `xs.remove(x)` each walk the whole list, and each is routinely written inside a loop over that same list"
sidebar_label: "03c · Linear scans inside loops"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (`sequence.index`), [`dict.fromkeys`](https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys),
> and the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html#strategies-for-unorderable-types-and-values).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**The front-of-list problem in [03b](03b-quadratic-patterns-and-deque.md) at least
looks suspicious. This is worse, because every pattern here reads like a single
idiomatic line. `if x not in seen`, `xs.index(name)`, `xs.remove(bad)` — each is a
full walk of the list, and each is routinely written inside a loop over that same
list. The fix is always the same move: build the index once, outside the loop, in a
structure that answers the question in O(1).**

## Pattern 1 · Membership tests against a growing list

```python
# quadratic — `in` scans the list, and the list keeps growing
seen = []
unique = []
for item in source:
    if item not in seen:
        seen.append(item)
        unique.append(item)

# linear — a set answers membership in O(1)
seen = set()
unique = []
for item in source:
    if item not in seen:
        seen.add(item)
        unique.append(item)
```

If the items are hashable and you want the deduplicated list in original order, the
whole loop collapses to one call, because `dict` preserves insertion order:

```python
unique = list(dict.fromkeys(source))   # insertion-ordered dedupe, one pass
```

🔴 `dict.fromkeys(keys, value)` with a *second* argument is a different trap — it
stores one shared value object under every key. Use it for deduplication with the
default `None`, never to initialise buckets. Phase 1 covers that in
[Repetition and shared references](../../phase-1-language-core/07-assignment-and-aliasing/03b-repetition-and-shared-refs.md).

## Pattern 2 · `index()` inside a loop

```python
# quadratic — each index() rescans from the start
for wanted in targets:
    position = names.index(wanted)
    process(position)

# linear — build the lookup once
positions = {name: i for i, name in enumerate(names)}
for wanted in targets:
    process(positions[wanted])
```

⚠️ Not identical, and the difference bites. `index` raises `ValueError` on a miss and
reports the **first** occurrence; the dict comprehension above keeps the **last**
occurrence of a duplicated name. If first-wins matters:

```python
positions = {}
for i, name in enumerate(names):
    positions.setdefault(name, i)      # first occurrence wins, like index()
```

`list.index` does have a documented narrowing form that avoids a copy:

> *"The start or stop arguments allow for efficient searching of subsections of the
> sequence, beginning at start and ending at stop. This is roughly equivalent to
> `start + sequence[start:stop].index(value)`, only without copying any data."*

That helps when you are scanning forward through a list once — the classic "find
every occurrence" loop — because you are advancing through the data rather than
repeating work. It does not turn n lookups of n different values into anything
sublinear.

## Pattern 3 · `remove()` inside a loop

```python
# quadratic twice over — a scan to find, then a shift to close the gap
for bad in to_drop:
    xs.remove(bad)

# linear — one rebuild, written back in place
drop = set(to_drop)
xs[:] = [x for x in xs if x not in drop]
```

The `xs[:] = …` form matters when other names refer to the same list: it mutates the
object rather than rebinding a local name. [10](10-copies-and-aliasing.md) has the
full story, and [05](05-removing-and-searching.md) covers what `remove` does when
the value is missing or when `__eq__` runs Python.

## The counter-move, in one table

Every fix on this page and the next is the same shape: **hoist the scan out of the
loop into a structure built once.**

| Question asked in the loop | Wrong tool | Built-once tool |
|---|---|---|
| "have I seen this?" | `x in list` | `set` |
| "where is this?" | `list.index(x)` | `dict` of value → index |
| "how many of these?" | `list.count(x)` | `collections.Counter` |
| "what are the top K?" | `sort` per item | `heapq.nlargest` |
| "keep it ordered" | `sort` per item | `bisect.insort`, or a heap |
| "remove these" | `remove` per item | one comprehension, `xs[:] = …` |

## Gotchas

### Using `dict.fromkeys` to dedupe unhashable items
**Symptom.** `TypeError: unhashable type: 'list'` from a dedupe helper that worked
on strings.
**Cause.** The dict/set trick requires hashable elements. Lists and dicts are not.
**Fix.** Dedupe on a hashable projection, and keep the original object:

```python
seen = set()
unique = []
for row in rows:
    key = (row["id"], row["version"])   # a hashable summary
    if key not in seen:
        seen.add(key)
        unique.append(row)
```

### `xs[:] = [...]` "cleaned up" into `xs = [...]`
**Symptom.** A filter that used to work now leaves the caller's list untouched.
**Cause.** `xs = [...]` rebinds a local name; `xs[:] = [...]` is slice assignment on
the original object.
**Fix.** Keep the slice-assignment form when the list is shared, and say why:

```python
# in-place: every other holder of this list sees the filtered result
xs[:] = [x for x in xs if keep(x)]
```

### Swapping `in` on a list for `in` on a set without checking hashability
**Symptom.** `TypeError: unhashable type` at the moment the "optimisation" ships.
**Cause.** `list.__contains__` uses `==` and works on anything; `set` requires
`__hash__`.
**Fix.** Convert to a hashable key, or accept the linear scan if the list is small
and the elements are not hashable:

```python
drop = {tuple(sorted(d.items())) for d in to_drop}   # hashable projection
```

### Using a `set` for membership, then relying on order later
**Symptom.** Deduplicated output comes out in an unpredictable order.
**Cause.** A set has no order. The Sorting HOWTO puts the general version plainly:
*"the elements contained in set types do not have a deterministic order."*
**Fix.** Use the set only for the membership test and keep a list for the order — or
use `dict.fromkeys`, which is documented to preserve insertion order:

```python
unique = list(dict.fromkeys(source))
```

### Hoisting the scan but rebuilding the index inside the loop
**Symptom.** The "optimised" version is no faster.
**Cause.** `if x not in set(others)` builds a brand-new set on every iteration — the
scan moved, it did not go away.
**Fix.** Build once, above the loop:

```python
others_set = set(others)          # once
matches = [x for x in xs if x in others_set]
```

### A `dict` index that goes stale under mutation
**Symptom.** A value → index map returns positions that are off by one, or point at
the wrong element, after the list is edited.
**Cause.** The map is a snapshot. Any `insert`, `remove` or `del` before position `i`
renumbers everything after it.
**Fix.** Either freeze the list while the index is in use, or index by identity
rather than position:

```python
by_id = {row["id"]: row for row in rows}    # survives reordering
```

## Interview questions

**★ You need to deduplicate a list while preserving order. What do you write?**
For hashable elements, `list(dict.fromkeys(xs))` — one pass, and `dict` guarantees
insertion order. For unhashable elements, build a hashable key per item, keep those
in a `set`, and append the original when the key is new. What you must not write is
`if x not in unique: unique.append(x)`, which is an O(n) `==` scan per item and
therefore quadratic — and for dicts or lists, each of those comparisons is itself
linear.

**★ Someone replaced `x in big_list` with `x in set(big_list)` inside a loop and saw
no improvement. Why?**
Because `set(big_list)` is itself O(n) and it is being rebuilt every iteration. The
whole point of the fix is that the index is built *once*, outside the loop. Hoist
the construction and the loop body becomes O(1); leave it inside and you have
swapped one linear scan for another plus an allocation.

**When is `list.index(x, start, stop)` the right tool rather than a dict?**
When you are scanning forward through the list *once* — finding successive
occurrences of a value — because the docs note the narrowed form is *"roughly
equivalent to `start + sequence[start:stop].index(value)`, only without copying any
data."* You are advancing through the data, not repeating work. It is the wrong tool
the moment you look up n different values in the same list; that is a dict.

**What is different about `xs.remove(bad)` compared with `xs.pop(k)` for cost
purposes?**
`pop(k)` already knows the position, so it pays only the shift: O(n - k).
`remove(bad)` has to *find* the first element equal to `bad` first, so it pays a
scan plus the shift. Worse, the scan uses `==`, which can run arbitrary Python
through `__eq__` — so the constant factor is not even bounded by C code. In a loop
over m values to drop, that is O(n·m) before you count the shifts.

**How would you invert a list into a lookup, and what do you lose?**
`{value: i for i, value in enumerate(xs)}`. You lose duplicate handling — the
comprehension keeps the last occurrence, whereas `index` returns the first, so use
`setdefault` if first-wins is the contract. You also lose validity under mutation:
the map is a snapshot of positions, and any insertion or deletion before a position
invalidates every entry after it.

**What is the one-sentence rule for spotting all of these?**
For every call inside a loop over a collection, ask whether its cost depends on the
size of that same collection — and if it does, build the answer once, outside the
loop, in a structure designed for the question being asked.

---

← [The queue problem, and deque](03b-quadratic-patterns-and-deque.md) · [Topic index](README.md) · Next → [Partial sorts and counting](03d-partial-sorts-and-counting.md)
