---
title: "`[[]] * 3` builds one list referenced three times, and every constructor that takes a default value has the same shape of bug"
sidebar_label: "3b · Repetition and shared references"
sidebar_position: 74
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [Built-in Types — common sequence operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [`dict.fromkeys`](https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict),
> and [`itertools.repeat`](https://docs.python.org/3.14/library/itertools.html#itertools.repeat).
> Target: **CPython 3.14**.

**Sequence repetition copies references, not objects. `[x] * n` produces a list
holding the same `x` n times, which is exactly what you want when `x` is `0` or
`None` and exactly what ruins your day when `x` is a list. The same rule
governs `dict.fromkeys(keys, [])`, `itertools.repeat`, and any API that takes a
single "default value" and hands it to many slots — and the fix is always the
same shape: replace the value with a factory that runs once per slot.**

## The documented example

Built-in Types states the rule in the description of `s * n`:

> *"Note that items in the sequence s are not copied; they are referenced
> multiple times."*

and then gives the demonstration, with its output, so this is documented
behaviour rather than a transcript I produced:

> ```python
> >>> lists = [[]] * 3
> >>> lists
> [[], [], []]
> >>> lists[0].append(3)
> >>> lists
> [[3], [3], [3]]
> ```
>
> *"What has happened is that `[[]]` is a one-element list containing an empty
> list, so all three elements of `[[]] * 3` are references to this single empty
> list. Modifying any element of `lists` modifies this single list."*

and the fix, also from the docs:

> ```python
> >>> lists = [[] for i in range(3)]
> >>> lists[0].append(3)
> >>> lists[1].append(5)
> >>> lists[2].append(7)
> >>> lists
> [[3], [5], [7]]
> ```

The comprehension works because the expression `[]` is **evaluated once per
iteration**, producing a new list each time. Repetition evaluates its operand
once, full stop.

## The rule that decides whether `* n` is safe

`[x] * n` is safe **if and only if** mutating an element is impossible or
meaningless. So:

```python
buffer = [None] * 1024        # fine — None is a singleton and immutable
counts = [0] * 26             # fine — ints are immutable; counts[i] += 1 REBINDS the slot
row    = ["-"] * 8            # fine — str is immutable
board  = [[]] * 8             # BUG   — one list, eight ways in
rows   = [{}] * 8             # BUG   — one dict
objs   = [Point(0, 0)] * 8    # BUG unless Point is frozen
```

`counts[i] += 1` deserves the note. It *looks* like a mutation but `int` has no
`__iadd__`, so the statement computes a new int and performs
`counts.__setitem__(i, new)` — it rebinds one slot of the list and leaves the
other slots pointing wherever they pointed. That is why the counter idiom is
sound while `board[i].append(x)` is not.

## The two-dimensional version, which is worse

```python
grid = [[0] * 3] * 3          # THREE references to ONE row
grid[0][0] = 1                # every row now starts with 1
```

The inner `[0] * 3` is fine — three references to the immutable `0`. The outer
`* 3` is the bug: one row object, three slots. The correct form builds a fresh
row per iteration:

```python
grid = [[0] * 3 for _ in range(3)]                 # 3 independent rows
grid = [[0 for _ in range(3)] for _ in range(3)]   # equivalent, slower, clearer to some
```

`grid[0][0] = 1` in the broken version changes what prints as three rows,
because there is one row. The tell is not the repr — both versions print
identically before any write. The tell is `id(grid[0]) == id(grid[1])`, or
`grid[0] is grid[1]`.

For real numeric grids, NumPy sidesteps the question entirely: `np.zeros((3,3))`
allocates one contiguous block with real two-dimensional indexing, and there
are no row objects to share.

## `dict.fromkeys` has the identical trap

```python
buckets = dict.fromkeys(["a", "b", "c"], [])   # ONE list under three keys
buckets["a"].append(1)                          # b and c see it too
```

`fromkeys` takes a *value* — one expression, evaluated once by the caller
before the call — and stores that single object under every key. Its signature
is `dict.fromkeys(iterable, value=None)`: a value, not a factory. The
alternatives:

```python
buckets = {k: [] for k in keys}                 # a fresh list per key
buckets = collections.defaultdict(list)         # a fresh list per first access
```

`defaultdict` is safe for the same reason the comprehension is: it stores a
*factory* and calls it, rather than storing a value and reusing it. This is the
`default_factory` pattern that reappears verbatim in dataclasses — see
[Dataclasses and linting defaults](06c-dataclass-defaults-and-linting.md).

`dict.fromkeys(keys)` with no value is completely safe — every key gets `None`.
`dict.fromkeys(keys, 0)` is safe. Only mutable values are a problem.

## `itertools.repeat` and friends

`itertools.repeat(obj, n)` yields *the same object* n times, by design and by
documentation. So does `[obj] * n`, and so does the `*` operator on tuples.
Anything that "produces n of something" without calling a factory is producing
one thing n times.

There is one famous idiom that depends on this on purpose — the grouper:

```python
def chunks(iterable, n):
    return zip(*[iter(iterable)] * n)     # ONE iterator, listed n times
```

`[iter(iterable)] * n` deliberately builds a list of n references to a single
iterator, so `zip` pulls n consecutive items per round. It works *because* of
repetition sharing, which makes it a good sanity check on whether you have
understood the mechanism. (In 3.12+, `itertools.batched` does this properly and
is what you should actually write.)

## Diagnosing it

```python
grid = build_grid()
assert len({id(row) for row in grid}) == len(grid), "rows are shared"
```

One line, and it catches the whole family. The same assertion over
`buckets.values()` catches the `fromkeys` version.

## Gotchas

### A 2-D grid where every row is the same row
**Symptom.** Setting one cell sets a whole column; a game board fills entirely
after one move; a matrix prints with repeated rows.
**Cause.** `[[0] * w] * h` — the outer repetition made `h` references to one
row list.
**Fix.** `[[0] * w for _ in range(h)]`. The comprehension re-evaluates its
expression per iteration; repetition does not.

### `dict.fromkeys(keys, [])` used to initialise buckets
**Symptom.** Every bucket contains every item.
**Cause.** `fromkeys` stores the single value object under all keys.
**Fix.** `{k: [] for k in keys}` or `collections.defaultdict(list)`.

### `[SomeClass()] * n` for a pool of workers/records
**Symptom.** All "instances" report the same state; a pool of n connections
behaves like one.
**Cause.** The constructor ran once, before the repetition.
**Fix.** `[SomeClass() for _ in range(n)]`.

### The repr looks right, so the bug ships
**Symptom.** A code review passes because `print(grid)` shows three distinct
rows.
**Cause.** Repetition and per-iteration construction produce *equal* structures;
they differ only in identity, and `repr` shows value.
**Fix.** Assert on identity, not on repr: `len({id(r) for r in grid}) == len(grid)`.

### `defaultdict(list)` vs `defaultdict([])`
**Symptom.** `TypeError: first argument must be callable or None`.
**Cause.** `defaultdict` wants a factory, not a value — precisely to avoid this
whole class of bug. Passing `[]` passes a value.
**Fix.** Pass the callable: `defaultdict(list)`, `defaultdict(dict)`,
`defaultdict(lambda: {"count": 0})` for a non-trivial default.

### `copy.copy(grid)` "fixes" a shared-row grid
**Symptom.** A copy is taken to isolate the rows, and writes still leak.
**Cause.** A shallow copy of a list duplicates the outer list only; if the
original's rows were already shared with each other, the copy's rows are the
same shared row.
**Fix.** Fix the construction, not the copy. If you must copy an already-built
nested structure, `copy.deepcopy` — with all the caveats in
[deepcopy](08b-deepcopy.md).

## Interview questions

**★ Q: What does `[[]] * 3` produce, and what happens when you append to the
first element?**
A list of three references to one empty list. `lists[0].append(3)` makes the
whole thing print as `[[3], [3], [3]]` — the docs give exactly this example.
The correct construction is `[[] for _ in range(3)]`, which evaluates `[]`
three times.

**★ Q: Why is `[0] * 1000` fine but `[[]] * 1000` a bug?**
Both create a list of 1000 references to one object. With `0` that is harmless
because ints are immutable — you can only ever rebind a slot
(`counts[i] += 1` calls `__setitem__`), never change the shared object. With
`[]` the shared object can be mutated, and every slot sees it.

**Q: How do you build a `h × w` grid of zeros correctly?**
`[[0] * w for _ in range(h)]`. The inner repetition is safe (immutable `0`); the
outer must be a comprehension so a new row list is constructed each iteration.

**Q: Why is `collections.defaultdict(list)` safe when
`dict.fromkeys(keys, [])` is not?**
`defaultdict` stores a *callable* and invokes it each time a missing key is
accessed, producing a new list every time. `fromkeys` stores a *value*,
evaluated once by the caller, and points every key at that one object.

**Q: `zip(*[iter(xs)] * n)` — explain why it groups.**
Because repetition shares references, the list contains n references to a
single iterator. `zip` draws one item from each of its arguments per output
tuple, and since they are all the same iterator, that is n consecutive items
from `xs`. It is the one case where the sharing is the feature. Prefer
`itertools.batched(xs, n)` in 3.12+, which also handles the ragged final chunk
instead of silently dropping it.

**Q: You are handed a nested list and told "make sure my writes do not affect
the caller". Is `list(x)` enough?**
Only if the elements are immutable. `list(x)` creates a new outer list holding
the same element objects; writing `copy[0] = ...` is isolated, writing
`copy[0].append(...)` is not. For nested mutable elements you need a per-element
copy or `copy.deepcopy`.

**Q: How would you write a test that catches shared-reference construction?**
Assert on identity rather than equality: `assert len({id(r) for r in grid}) ==
len(grid)`. Equality assertions pass for both the correct and the broken
construction, which is exactly why this bug survives code review.

---

← Prev: [Aliasing: two names, one object](03-aliasing.md) · Index: [Assignment and aliasing](README.md) · Next → [Augmented assignment](04-augmented-assignment.md)
