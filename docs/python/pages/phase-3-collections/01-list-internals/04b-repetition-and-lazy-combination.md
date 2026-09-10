---
title: "Repetition copies references and concatenation copies everything, so the two cheapest ways to combine lists are unpacking once and never building the intermediate list at all"
sidebar_label: "04b · Repetition and lazy combination"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes 2, 6 and 7),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [`itertools.chain`](https://docs.python.org/3.14/library/itertools.html#itertools.chain),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list),
> and [PEP 448](https://peps.python.org/pep-0448/).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**`*` and `*=` fill a list with repeated *references*, which is exactly what you want
for `[None] * 1024` and exactly what ruins a grid built as `[[0] * 8] * 8`. `+` in a
loop copies everything accumulated so far, which is the documented route to a
quadratic runtime. This chunk covers both, then the two operations that avoid the
problem entirely: unpacking, which allocates once from any mix of iterables, and
`itertools.chain`, which allocates nothing at all.**

## Repetition, and what it copies

> *"`s * n` or `n * s` — equivalent to adding s to itself n times"*

> *"`s *= n` — updates s with its contents repeated n times"*

> *"Values of n less than 0 are treated as 0 (which yields an empty sequence of the
> same type as s). Note that items in the sequence s are not copied; they are
> referenced multiple times."*

`*` builds a new list; `*=` extends the existing one in place (its slot in the type
is `sq_inplace_repeat`, alongside `sq_inplace_concat` for `+=`). Both fill the
result with repeated **references**, which is safe for immutable elements and a bug
for mutable ones:

```python
row  = [0] * 8              # fine — ints are immutable
grid = [[0] * 8] * 8        # BUG — eight references to ONE row
grid = [[0] * 8 for _ in range(8)]   # correct — a new row per iteration
```

The documentation gives this its own worked example under note 2, and calls it out
as the thing that *"often haunts new Python programmers"*:

> *"What has happened is that `[[]]` is a one-element list containing an empty list,
> so all three elements of `[[]] * 3` are references to this single empty list.
> Modifying any of the elements of lists modifies this single list."*

The rule for when `* n` is safe is precise: **only when mutating an element is
impossible or meaningless.** `None`, `0`, `""`, `()` and frozen dataclasses qualify.
Lists, dicts, sets and ordinary objects do not. [10](10-copies-and-aliasing.md)
covers the aliasing family; Phase 1 has the long version in
[Repetition and shared references](../../phase-1-language-core/07-assignment-and-aliasing/03b-repetition-and-shared-refs.md).

⚠️ `counts[i] += 1` on a `[0] * 26` list looks like a mutation and is not: `int` has
no `__iadd__`, so the statement computes a new int and rebinds *that one slot*. That
is why the counter idiom is sound while `board[i].append(x)` is not.

## Concatenation always allocates

> *"Concatenating immutable sequences always results in a new object. This means that
> building up a sequence by repeated concatenation will have a quadratic runtime cost
> in the total sequence length."*
> … *"if concatenating tuple objects, extend a list instead"*

Lists are mutable, so `+` is not forced to allocate by immutability — but it does
anyway, because `a + b` is defined to produce a new list. The complexity table gives
it as O(len(l1) + len(l2)), which is fine once and quadratic in a loop.

```python
# quadratic — every + copies everything accumulated so far
flat = []
for group in groups:
    flat = flat + group

# linear — in-place growth
flat = []
for group in groups:
    flat.extend(group)
```

The same trap wearing a nicer hat is `sum(list_of_lists, [])`, which is repeated
`+` with a friendlier syntax and the same cost.

## Unpacking: one allocation, any iterables

[PEP 448](https://peps.python.org/pep-0448/) generalised `*` unpacking into display
literals, which gives you concatenation that is neither type-fussy nor iterative:

```python
combined = [*headers, *body, *footers]      # one new list, one allocation
mixed    = [*a_list, *a_tuple, *a_set, *a_generator]   # all fine
with_one = [*items, "--verbose"]            # append-without-mutating
```

This is the cleanest way to say "a new list made of these" — no `TypeError` for
mixing sequence types, no mutation of any input, and no chain of intermediates. It is
also the readable answer to the "helper must not mutate its argument" problem from
[04](04-adding-and-combining.md).

⚠️ It is still eager. `[*a, *b]` builds the whole list; if you only intend to iterate
once, do not build it at all.

## `itertools.chain`: no intermediate list

```python
from itertools import chain

for row in chain(headers, body, footers):   # nothing is materialised
    write(row)

flat = list(chain.from_iterable(groups))    # one allocation, at the end
```

`chain` yields from each iterable in turn. `chain.from_iterable` takes a single
iterable *of* iterables, which is what you want when the groups themselves arrive
lazily. Either way the memory cost is one element at a time until you wrap it in
`list()`.

## Which to reach for

| You want | Write | Why |
|---|---|---|
| Add one object | `xs.append(obj)` | Never iterates `obj` |
| Add many items from an iterable | `xs.extend(it)` | One call, one length guess |
| A new list, leaving the inputs alone | `[*a, *b]` | Any iterables, one allocation |
| A new list from two lists specifically | `a + b` | Same as above; raises on a type mix |
| In-place growth from any iterable | `xs += it` | Same as `extend` — use `extend` when the mutation matters to a reader |
| Iterate several iterables in sequence | `chain(a, b, c)` | No intermediate list at all |
| n copies of an immutable placeholder | `[None] * n` | References, but immutable so it cannot matter |
| n independent mutable slots | `[make() for _ in range(n)]` | The expression runs once per slot |

## Gotchas

### `sum(list_of_lists, [])` to flatten
**Symptom.** Flattening is fine for ten sublists and hopeless for ten thousand.
**Cause.** `sum` performs repeated `+`, and each `+` copies everything accumulated so
far — the documented *"quadratic runtime cost in the total sequence length"*.
**Fix.** One pass, lazily:

```python
from itertools import chain
flat = list(chain.from_iterable(groups))
```

### `xs *= 2` used to "duplicate the data"
**Symptom.** A doubled buffer whose second half mutates in lockstep with the first.
**Cause.** Repetition copies references: *"items in the sequence s are not copied;
they are referenced multiple times."*
**Fix.** Build fresh objects per slot:

```python
xs = xs + [make() for _ in range(len(xs))]
```

### `xs *= 2` on a list a caller also holds
**Symptom.** Someone else's list is suddenly twice as long.
**Cause.** `*=` is in-place repetition — the same `__i*__` story as `+=`. `xs = xs * 2`
would have built a new list and rebound only the local name.
**Fix.** Choose deliberately, and prefer the non-mutating form in a function:

```python
doubled = xs * 2        # new list; the caller's list is untouched
```

### `[obj] * n` for a pool of workers, connections or records
**Symptom.** Every "instance" in the pool reports the same state; a pool of n
connections behaves like one.
**Cause.** The constructor ran **once**, before the repetition; the list holds n
references to that single object.
**Fix.** Run the constructor per slot:

```python
pool = [Connection(dsn) for _ in range(n)]
```

### A negative or zero repeat count silently emptying a list
**Symptom.** `xs *= factor` produces an empty list and no error, where a caller
expected a no-op.
**Cause.** The docs: *"Values of n less than 0 are treated as 0 (which yields an
empty sequence of the same type as s)."*
**Fix.** Guard the count where it comes from outside:

```python
if factor < 1:
    raise ValueError(f"repeat factor must be >= 1, got {factor}")
xs *= factor
```

### `list(chain(...))` when the chain was the point
**Symptom.** Memory use identical to the naive version, despite "using itertools".
**Cause.** `chain` is lazy; wrapping it in `list()` materialises everything and
discards the benefit.
**Fix.** Only materialise when you genuinely need random access or multiple passes:

```python
for row in chain(a, b, c):    # streamed
    handle(row)
```

### Nesting `[*a, *b]` inside a loop
**Symptom.** A "clean" refactor away from `+` that is still quadratic.
**Cause.** Unpacking into a display is still building a whole new list each time.
The problem was never the operator; it was rebuilding per iteration.
**Fix.** Extend one accumulator, or chain:

```python
acc = []
for group in groups:
    acc.extend(group)         # one list, grown in place
```

## Interview questions

**★ Why is `[[0] * 8] * 8` wrong when `[0] * 8` is right?**
Because repetition copies *references*, and the docs say so: *"items in the sequence
s are not copied; they are referenced multiple times."* With `0` that is harmless —
an int cannot be mutated, so a slot can only ever be rebound, and `row[i] += 1` calls
`__setitem__`. With a list, all eight rows are one object, and writing to
`grid[0][0]` writes to every row. The fix is a comprehension, which evaluates its
expression once per iteration.

**★ What is wrong with `sum(lists, [])` as a flatten?**
It performs repeated list concatenation, and each `+` copies everything accumulated
so far, so the total cost is quadratic in the flattened length — the same failure the
docs describe for repeated string concatenation. `itertools.chain.from_iterable`
walks each sublist exactly once, and `list(...)` around it allocates once.

**`xs *= 3` versus `xs = xs * 3` — what is the difference for a caller who also holds
`xs`?**
`*=` repeats in place, so the caller's list becomes three times as long. `xs = xs * 3`
builds a new list and rebinds only the local name, leaving the caller's list
untouched. Both fill the result with repeated references, so if the elements are
mutable the sharing problem is identical either way — the difference is only *whose*
list changed length.

**When would you use `itertools.chain` instead of `a + b`?**
When you are going to iterate the combination once and do not need it as a list.
`chain` yields from each iterable in turn and never allocates a combined container,
so it is the right tool for "walk these three result sets in order". `a + b` is
right when you need indexing, a length, or multiple passes — at which point you are
paying for the allocation on purpose.

**Why does `[*a, *b]` work where `a + b` raises?**
`+` on a list is defined only between sequences of the same type; the error message
is `can only concatenate list (not "tuple") to list`. Unpacking in a display is
defined over any iterables — that is what PEP 448 generalised — so `[*a_list,
*a_tuple, *a_set]` is a single new list built from all three. It is also
non-mutating, which makes it the right idiom for a function that must not touch its
arguments.

**Is `[None] * n` a safe way to preallocate?**
Yes, because `None` is immutable and a singleton, so n references to it cannot
diverge and cannot be mutated. The idiom is unsafe the instant the element is
mutable — `[[]] * n`, `[{}] * n`, `[Point(0, 0)] * n`. The test is not "is it a
literal" but "can an element be mutated in place"; if it can, use a comprehension so
the expression runs once per slot.

**How would you write a test that catches shared-reference construction?**
Assert on identity rather than equality, because the correct and the broken
construction are *equal*:

```python
assert len({id(row) for row in grid}) == len(grid)
```

Equality assertions pass for both, which is exactly why this bug survives review.

---

← [Adding and combining](04-adding-and-combining.md) · [Topic index](README.md) · Next → [Removing and searching](05-removing-and-searching.md)
