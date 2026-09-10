---
title: "`sorted` returns a new list and `.sort()` returns `None`, so `x = x.sort()` silently replaces your data with nothing — and the `None` is deliberate, documented, and the whole convention for mutable types"
sidebar_label: "06 · sorted versus .sort()"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted),
> the [Sorting HOWTO — Sorting Basics](https://docs.python.org/3.14/howto/sorting.html#sorting-basics),
> the tutorial [More on Lists](https://docs.python.org/3.14/tutorial/datastructures.html#more-on-lists),
> and CPython's
> [`Python/bltinmodule.c`](https://github.com/python/cpython/blob/3.14/Python/bltinmodule.c)
> (`builtin_sorted`). Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**One of these mutates and returns nothing; the other copies and returns the copy.
`x = x.sort()` is the single most-reproduced beginner bug in Python and it does not
raise — it binds `None` to `x`, and the failure surfaces somewhere else entirely, as
`TypeError: 'NoneType' object is not iterable` in a function three layers away. The
`None` return is not an oversight. It is a deliberate, documented convention for
every mutating method on every mutable type in the language, and once you know why it
is there you stop writing the bug.**

## The two operations

```python
xs = [3, 1, 2]

ys = sorted(xs)      # ys is [1, 2, 3]; xs is still [3, 1, 2]
result = xs.sort()   # xs is now [1, 2, 3]; result is None
```

The Sorting HOWTO opens with exactly this distinction:

> *"Python lists have a built-in `list.sort()` method that modifies the list
> in-place. There is also a `sorted()` built-in function that builds a new sorted
> list from an iterable."*

> *"You can also use the `list.sort()` method. It modifies the list in-place (and
> returns None to avoid confusion). Usually it's less convenient than `sorted()` -
> but if you don't need the original list, it's slightly more efficient."*

> *"Another difference is that the `list.sort()` method is only defined for lists. In
> contrast, the `sorted()` function accepts any iterable."*

That third difference is the one people forget. `sorted()` takes a generator, a set, a
dict (yielding its keys), a file object, a database cursor — anything iterable — and
always hands back a **list**:

```python
sorted({3, 1, 2})                    # [1, 2, 3] — from a set
sorted({"b": 1, "a": 2})             # ['a', 'b'] — dict yields keys
sorted(line.strip() for line in f)   # from a generator
```

## `sorted()` *is* `list()` plus `.sort()`

This is not an analogy either. `builtin_sorted` in CPython:

```c
    newlist = PySequence_List(seq);
    ...
    callable = PyObject_GetAttr(newlist, &_Py_ID(sort));
    ...
    v = PyObject_Vectorcall(callable, args + 1, nargs - 1, kwnames);
    ...
    return newlist;
```

Make a list from the iterable, call `.sort(**kwargs)` on it, return the list. So
everything true of `list.sort` — Timsort, stability, `key=` evaluated once per item,
`<`-only comparisons, the failure modes — is true of `sorted`. There is exactly one
extra step: the copy.

That also settles a common question: `sorted()` never sorts in place, and it never
returns the original object even if the input was already a sorted list.

## The `None` return is a convention, not an accident

> *"This method modifies the sequence in place for economy of space when sorting a
> large sequence. To remind users that it operates by side effect, it does not return
> the sorted sequence (use `sorted()` to explicitly request a new sorted list
> instance)."*

The tutorial generalises it:

> *"You might have noticed that methods like insert, remove or sort that only modify
> the list have no return value printed – they return the default None. This is a
> design principle for all mutable data structures in Python."*

So the `None` is a *feature*: it makes `x = x.sort()` wrong in a way you can learn
once. Compare a language where `sort()` returns the list — there, `a = b.sort()`
gives two names for one mutated object, and the aliasing bug is silent forever.

The same rule covers `reverse()`, `append()`, `extend()`, `insert()`, `remove()`,
`clear()` and `update()` on a dict. If a method's job is to change the receiver, it
returns `None`.

## The bug, and its symptom

```python
names = ["carol", "alice", "bob"]
names = names.sort()          # BUG — names is now None

for n in names:               # TypeError: 'NoneType' object is not iterable
    print(n)
```

🔴 **The traceback names the loop, not the assignment.** In real code the two are in
different functions, often different modules, and the `None` may be stored, returned,
serialised or passed on before anything complains. If a `None` appears where a list
should be, grep for `= <something>.sort(` and `= <something>.reverse(` first.

## Which one to use

| Situation | Use | Why |
|---|---|---|
| You need the original order too | `sorted(xs)` | The original is untouched |
| The input is not a list | `sorted(it)` | `.sort()` is a list method only |
| The list is large and you are done with the unsorted order | `xs.sort()` | No copy; the docs call it *"slightly more efficient"* |
| Inside a comprehension or an expression | `sorted(...)` | `.sort()` returns `None` |
| The list is shared and callers expect the new order | `xs.sort()` | Everyone sees it |
| The list is shared and callers do **not** expect a reorder | `sorted(xs)` | Sorting someone else's list is a side effect |

That last row is a real hazard. `xs.sort()` on a list you were handed reorders the
caller's data permanently — the same class of unannounced side effect as
`options += [...]` in [04](04-adding-and-combining.md).

```python
def top_three(rows):
    rows.sort(key=score, reverse=True)   # reorders the CALLER's list
    return rows[:3]

def top_three_safely(rows):
    return sorted(rows, key=score, reverse=True)[:3]
```

⚠️ Even `top_three_safely` returns *aliases* to the caller's row objects — the list is
new, the rows are shared. That is [10](10-copies-and-aliasing.md).

## Gotchas

### `x = x.sort()`
**Symptom.** `TypeError: 'NoneType' object is not iterable`, usually far from the
assignment.
**Cause.** `list.sort()` mutates and returns `None`, by documented design.
**Fix.** Choose the operation that matches the intent:

```python
xs.sort()             # mutate in place; do not assign the result
ys = sorted(xs)       # a new sorted list; xs unchanged
```

### `return xs.sort()` from a helper
**Symptom.** A function documented as "returns the sorted rows" returns `None`, and
every caller breaks.
**Cause.** Same convention, hidden inside a `return`.
**Fix.** Sort, then return — or use `sorted`:

```python
def ordered(xs):
    return sorted(xs, key=score)
```

### `sorted(xs)` where an in-place sort was needed
**Symptom.** The list "does not sort", even though `sorted` was clearly called.
**Cause.** `sorted` builds a new list and the return value was discarded.
**Fix.** Assign it, or mutate in place:

```python
xs = sorted(xs)      # rebinds this name only
xs.sort()            # mutates the object every name refers to
xs[:] = sorted(xs)   # mutates the object, via a new list
```

### `xs.sort()` on a caller's list
**Symptom.** A report function reorders the data every other part of the system uses;
a cached list comes back in a different order.
**Cause.** In-place sort is a side effect the signature does not declare.
**Fix.** Sort a copy unless mutation is the documented contract:

```python
def render(rows):
    for row in sorted(rows, key=score):   # the caller's order is preserved
        ...
```

### `.sort()` called on something that is not a list
**Symptom.** `AttributeError: 'tuple' object has no attribute 'sort'`, or the same
for a set, a dict view or a generator.
**Cause.** `sort` is a `list` method. The HOWTO: *"the `list.sort()` method is only
defined for lists."*
**Fix.** Use the built-in, which takes any iterable and gives you a list:

```python
ordered = sorted(some_tuple)
```

### Chaining off `.sort()`
**Symptom.** `AttributeError: 'NoneType' object has no attribute 'index'` from
something like `xs.sort().index(v)`.
**Cause.** The convention again — there is nothing to chain from.
**Fix.** Two statements, or one expression with `sorted`:

```python
xs.sort()
i = xs.index(v)
```

### Sorting a generator twice
**Symptom.** The second `sorted(gen)` returns an empty list.
**Cause.** `sorted` consumes the iterable completely; a generator is one-shot.
**Fix.** Materialise once:

```python
rows = list(gen)
by_name = sorted(rows, key=lambda r: r.name)
by_date = sorted(rows, key=lambda r: r.created)
```

### Assuming `sorted()` on an already-sorted list returns the same object
**Symptom.** An identity check (`a is sorted(a)`) fails, or a cache keyed on identity
misses.
**Cause.** `sorted` always builds a new list — its implementation begins with
`PySequence_List(seq)`. Contrast `tuple(t)`, which the complexity page documents as
O(1) precisely because it *"simply returns the same object"*.
**Fix.** If you need "sorted, but do not copy if already sorted", check first — and
know the check itself is a linear pass:

```python
if any(a > b for a, b in zip(xs, xs[1:])):
    xs.sort()
```

## Interview questions

**★ What does `x = x.sort()` do, and why?**
It sorts `x` in place and then binds `None` to the name `x`, because `list.sort()`
returns `None`. The docs give the reason directly: *"To remind users that it operates
by side effect, it does not return the sorted sequence."* It is a deliberate
convention for every mutating method on every mutable type in Python, and it exists
so that this exact confusion produces a loud failure rather than a silent alias.

**★ When would you choose `list.sort()` over `sorted()`?**
When the list is large, you own it, and you do not need the original order — the docs
call the in-place form *"slightly more efficient"* and note it *"modifies the sequence
in place for economy of space"*. You must use `sorted()` when the input is not a list,
when you need the original order preserved, when the sort appears inside an
expression, or when the list belongs to a caller who does not expect it reordered.

**Is `sorted()` implemented differently from `list.sort()`?**
No. `builtin_sorted` calls `PySequence_List` on the argument to make a list, then
calls that list's `sort` method with the same keyword arguments, then returns the
list. Everything about the algorithm — Timsort, stability, `key=` called once per
item, `<`-only comparisons — is identical. The only difference is the copy.

**Why does Python not just have `sort()` return the list, so it can be chained?**
Because then `a = b.sort()` would produce two names for one mutated object, and the
mutation would be invisible. The `None` makes the side effect impossible to ignore,
and the language pairs it with a non-mutating alternative (`sorted`) for when you
want a value. The tutorial states it as a general design principle rather than a
list-specific choice.

**`xs = sorted(xs)` versus `xs.sort()` versus `xs[:] = sorted(xs)` — do they differ?**
Only in who sees the result. `xs = sorted(xs)` rebinds one name to a new list; other
holders of the old list still see the old order. `xs.sort()` mutates the shared
object, so everyone sees the new order, with no allocation. `xs[:] = sorted(xs)` also
mutates the shared object but allocates a temporary — useful when you want in-place
semantics from a non-list source, e.g. `xs[:] = sorted(some_generator)`.

**Can `sorted()` work on a generator? What does it cost?**
Yes, and it consumes it entirely — a sort cannot start producing output before it has
seen the last input. The cost is the full list in memory plus the sort. If you only
need the smallest or largest few, `heapq.nsmallest`/`nlargest` make a single pass
holding only K elements, which the Sorting HOWTO recommends for that case.

**A function is documented as "returns rows sorted by score" and returns `None` in
production. Where do you look?**
For `return xs.sort(...)` or `xs = xs.sort(...)`. The `None` propagates silently until
something iterates, indexes or measures it, so the traceback almost never points at
the sort. The same one-character-class mistake exists for `reverse()`, `append()` and
`extend()`, all of which return `None` by the same convention.

---

← [Searching, identity and reversing](05b-searching-identity-and-reversing.md) · [Topic index](README.md) · Next → [What happens to a list while it is being sorted](06b-during-the-sort.md)
