---
title: "A key function runs exactly once per element, all of them before the first comparison, and every result lives until the sort ends — which makes `key=` cheap in comparisons, costly in memory, and the one way a sort can fail without touching your list"
sidebar_label: "09 · Key functions"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html) — *Key Functions*,
> *Operator Module Functions and Partial Function Evaluation*, *Odds and Ends*,
> [`operator.attrgetter` / `itemgetter`](https://docs.python.org/3.14/library/operator.html#operator.attrgetter),
> [What's New in Python 3.0](https://docs.python.org/3.14/whatsnew/3.0.html), and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_sort_impl`, `keyfunc_fail`). Documentation-validated; **no sandbox run, no
> timings**. Target: **CPython 3.14** (3.14.7).

**`key=` is not a comparison. It is a transformation applied once to each element,
up front, in a plain C loop, before timsort compares anything — and then the sort
compares the *results*. That single design choice explains every property worth
knowing: a key function is called n times, never n log n; an expensive key costs
exactly one call per row, which is why DSU is obsolete; all n results are alive at
once, so a tuple key on ten million rows allocates ten million tuples; and because the
list has not been reordered yet when the keys are computed, a key function that raises
leaves your list exactly as it was — unlike a comparison that raises, which leaves it
scrambled. Comparisons proper — `__lt__`, `cmp` functions and `cmp_to_key` — are
[09c](09c-comparisons-and-cmp-to-key.md), and text keys are
[09b](09b-sorting-text.md).**

## The contract

> *"key specifies a function of one argument that is used to extract a comparison key
> from each list element (for example, `key=str.lower`). The key corresponding to
> each item in the list is calculated once and then used for the entire sorting
> process. The default value of None means that list items are sorted directly
> without calculating a separate key value."*

The HOWTO says why that matters:

> *"The value of the key parameter should be a function (or other callable) that takes
> a single argument and returns a key to use for sorting purposes. This technique is
> fast because the key function is called exactly once for each input record."*

And `key` is keyword-only — a Python 3.0 change that is still the cause of a common
porting error:

> *"`sorted()` and `list.sort()` no longer accept the cmp argument providing a
> comparison function. Use the key argument instead. N.B. the key and reverse arguments
> are now \"keyword-only\"."*

## What CPython does with it

The whole key phase is one loop in `list_sort_impl`, run after the list has been made
to look empty ([06b](06b-during-the-sort.md)) and before anything else:

```c
        for (i = 0; i < saved_ob_size ; i++) {
            keys[i] = PyObject_CallOneArg(keyfunc, saved_ob_item[i]);
            if (keys[i] == NULL) {
                for (i=i-1 ; i>=0 ; i--)
                    Py_DECREF(keys[i]);
                if (saved_ob_size >= MERGESTATE_TEMP_SIZE/2)
                    PyMem_Free(keys);
                goto keyfunc_fail;
            }
        }
```

Three facts follow directly from that code.

**Exactly n calls, in list order.** The key function sees each element once, first to
last. Nothing about the data's order changes that count.

**An n-pointer keys array, and n live key objects.** Below 128 elements the array
borrows a buffer already on the C stack (`ms.temparray`); above that it is a
`PyMem_Malloc` of n pointers. Either way every key object stays referenced until the
sort finishes. Keys and items then move in lock-step through every merge, which is why
[07b](07b-merging-and-galloping.md) counts the temp area twice for `key=` sorts.

**A failed key leaves the list untouched.** `keyfunc_fail` restores the saved element
block and length:

```c
keyfunc_fail:
    final_ob_item = self->ob_item;
    i = Py_SIZE(self);
    Py_SET_SIZE(self, saved_ob_size);
    FT_ATOMIC_STORE_PTR_RELEASE(self->ob_item, saved_ob_item);
    FT_ATOMIC_STORE_SSIZE_RELAXED(self->allocated, saved_allocated);
```

No reordering has happened yet — not even the initial reversal for `reverse=True`,
which comes after the key loop — so the list is in its original order. Compare a
comparison that raises mid-merge: *"the list will likely be left in a partially
modified state"*. If you are choosing where validation lives, put it in the key.

## Why `key=` beats `__lt__` on cost

A sort of n elements makes on the order of n log n comparisons on random data. With a
`__lt__` defined in Python, each one is a Python-level call. With `key=`, the Python
calls happen n times, and the comparisons are between the *results* — often `int`,
`float`, `str` or tuples of them, which is exactly what the pre-sort check in
[07d](07d-reverse-and-the-pre-sort-check.md) can specialise. I have no timing to
quote; the difference is in how many times Python code runs, and that much is
arithmetic.

```python
# n calls to score(), then C-level float comparisons
rows.sort(key=score)

# ~n log n calls to Row.__lt__, each one Python
rows.sort()
```

## The operator module helpers

> *"The key function patterns shown above are very common, so Python provides
> convenience functions to make accessor functions easier and faster. The operator
> module has itemgetter(), attrgetter(), and a methodcaller() function."*

> *"The operator module functions allow multiple levels of sorting."*

```python
from operator import attrgetter, itemgetter, methodcaller

rows.sort(key=itemgetter("region", "day"))          # dicts or tuples, several fields
users.sort(key=attrgetter("name.last", "name.first"))   # dotted paths are allowed
paths.sort(key=methodcaller("lower"))               # calls p.lower()
```

The docs on `attrgetter`: *"If more than one attribute is requested, returns a tuple of
attributes. The attribute names can also contain dots."* The HOWTO calls these
*"simpler and faster"* than the equivalent lambdas; it gives no figure and neither do I.

`functools.partial` turns a multi-argument function into a key; the HOWTO's own
example is Unicode normalisation, which is in [09b](09b-sorting-text.md) with the
rest of text sorting.

## Keys that look something up

> *"Key functions need not depend directly on the objects being sorted. A key function
> can also access external resources."*

```python
>>> students = ['dave', 'john', 'jane']
>>> newgrades = {'john': 'F', 'jane':'A', 'dave': 'C'}
>>> sorted(students, key=newgrades.__getitem__)
['jane', 'dave', 'john']
```

That doctest is the HOWTO's. The pattern generalises to "sort these ids by a score I
fetched in bulk" — which is the correct shape for any key whose data lives in a
database.

## Gotchas

**★ Symptom: sorting 5,000 rows makes 5,000 database queries.** Cause: the key function
fetches per element — it is called exactly once per row, which is still once per row.
Fix: fetch in bulk, then key on a dict lookup:

```python
scores = fetch_scores([r.id for r in rows])     # one query → {id: score}
rows.sort(key=lambda r: scores[r.id])
```

**★ Symptom: `TypeError` the moment old code calls `xs.sort(compare)` or
`sorted(xs, lambda a, b: …)`.** Cause: `key` is keyword-only since 3.0, and the old
`cmp` argument no longer exists; a two-argument function passed as a key would also
fail on its first call. Fix: wrap the comparison — [09c](09c-comparisons-and-cmp-to-key.md)
covers what this costs:

```python
from functools import cmp_to_key
xs.sort(key=cmp_to_key(compare))
```

**Symptom: `KeyError` from a sort keyed on a dict lookup.** Cause: an element has no
entry in the mapping. The good news is structural — the key loop runs before any
reordering, so the list is unchanged. Fix: decide where unknowns go:

```python
students.sort(key=lambda s: (s not in grades, grades.get(s, "")))
```

**Symptom: `AttributeError` from `attrgetter` on a mixed list.** Cause: some objects
lack the attribute, or have it under a dotted path that breaks part-way. Fix: a lambda
with an explicit default, since `attrgetter` has none:

```python
items.sort(key=lambda o: getattr(o, "priority", 0))
```

**Symptom: memory climbs sharply during a large `sort(key=…)` and falls back after.**
Cause: every key is computed up front and kept alive — a three-field tuple key on n
rows is n tuples plus their contents, on top of the list. Fix: key on one number when
the fields are bounded integers, or sort a lighter projection:

```python
rows.sort(key=lambda r: r.day * 86_400 + r.second)   # one int, not a tuple
```

**Symptom: `key=len` produces a different order of equal-length strings from run to
run.** Cause: equal keys keep input order, and the input order varied. Fix: give ties
a rule:

```python
words.sort(key=lambda w: (len(w), w))
```

**Symptom: a key that logs or increments a counter shows every call before any
sorting output, and exactly n of them.** Cause: not a bug — that is the documented
contract, and the source loop that implements it. Fix: nothing in the sort; if you
were using the key as a progress hook, measure progress somewhere else:

```python
keys = [score(r) for r in rows]                 # progress-report this loop instead
order = sorted(range(len(rows)), key=keys.__getitem__)
rows[:] = [rows[i] for i in order]
```

## Interview questions

**★ How many times is a key function called during a sort?**
Exactly once per element — the docs say *"calculated once and then used for the entire
sorting process"*, and CPython implements it as a single loop over the list before any
comparison. So n calls regardless of data order, and the comparisons that follow are
between the computed keys.

**★ Why is `key=` usually cheaper than giving the class a `__lt__`?**
Because it moves Python code out of the comparison loop. A sort makes on the order of
n log n comparisons on random data; with a Python `__lt__` each is a Python call. With
`key=` there are n Python calls, and the comparisons run on the resulting keys —
typically built-in types that CPython can compare through a specialised C path.

**What happens to the list if the key function raises?**
It is left exactly as it was. The key loop runs before any reordering; on failure
CPython releases the keys computed so far and jumps to `keyfunc_fail`, which restores
the saved element block, length and allocation. That is a stronger outcome than a
failing comparison, which leaves some permutation of the input.

**What does `key=` cost in memory?**
An array of n pointers for the keys — on the C stack below 128 elements, heap-
allocated above — plus the n key objects themselves, all alive until the sort
returns, plus a larger merge temp area because keys and items move together. For
tuple keys on large lists that last part dominates.

**When would you use `itemgetter` or `attrgetter` instead of a lambda?**
When the key is a plain field access or several of them: they read more clearly, take
multiple fields and return a tuple, and `attrgetter` accepts dotted paths. The HOWTO
calls them *"simpler and faster"*. A lambda is still the right choice when you need a
default, a transformation, or a null-handling tuple.

**Why are `key` and `reverse` keyword-only?**
Python 3.0 removed the positional `cmp` argument at the same time and made the other
two keyword-only, so old calls like `xs.sort(my_cmp)` fail loudly rather than silently
treating a comparison function as a key. Any surviving two-argument comparison has to
be wrapped explicitly with `functools.cmp_to_key`.

---

← [Ties, DSU and determinism](08b-ties-and-determinism.md) · [Topic index](README.md) · Next → [Sorting text](09b-sorting-text.md)
