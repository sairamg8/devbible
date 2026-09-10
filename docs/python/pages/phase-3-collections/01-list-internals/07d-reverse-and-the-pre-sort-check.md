---
title: "`reverse=True` is reverse, sort forward, reverse back — and before the first comparison CPython checks every key's exact type to choose a comparison routine, so both change what your sort costs without changing the algorithm"
sidebar_label: "07d · reverse=True and the pre-sort check"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_sort_impl` — the reverse steps, the pre-sort check, `unsafe_*_compare`),
> [`Objects/listsort.txt`](https://github.com/python/cpython/blob/3.14/Objects/listsort.txt)
> (*OPTIMIZATION OF INDIVIDUAL COMPARISONS*), the
> [Sorting HOWTO — Odds and Ends](https://docs.python.org/3.14/howto/sorting.html#odds-and-ends)
> and [Strategies for unorderable types](https://docs.python.org/3.14/howto/sorting.html#strategies-for-unorderable-types-and-values).
> Documentation-validated; **no sandbox run, no timings** — every "faster path" below is
> a statement about which C function runs, not a measurement. Target: **CPython 3.14**
> (3.14.7).

**Two things happen in `list.sort` that are not timsort but decide how it behaves.
`reverse=True` is not a descending comparison; it is three steps — reverse the input,
run the ordinary stable ascending sort, reverse the result — which is exactly why it
keeps equal elements in their original order where `sorted(xs)[::-1]` flips them. And
before any merging starts, CPython walks every key once to prove they share one exact
type, then installs a specialised comparison for latin-1 strings, compact ints, floats
or a single rich-comparing type. Neither is visible in the result of a successful
sort. Both are visible the day someone's key returns a `bool` among `int`s, or a
colleague "optimises" `reverse=True` into a slice.**

## `reverse=True` does not run a different algorithm

```c
    /* Reverse sort stability achieved by initially reversing the list,
    applying a stable forward sort, then reversing the final result. */
    if (reverse) {
        if (keys != NULL)
            reverse_slice(&keys[0], &keys[saved_ob_size]);
        reverse_slice(&saved_ob_item[0], &saved_ob_item[saved_ob_size]);
    }
```

Reverse the input, sort ascending, reverse the output. The keys array is reversed in
step with the items when a `key=` was given, so the pairing between each item and its
precomputed key survives. The final reversal sits after the `fail:` label in the same
function, so it runs on the error path too — a sort that raises part-way still undoes
its initial reversal before returning.

This is why the Sorting HOWTO can promise that *"The reverse parameter still maintains
sort stability (so that records with equal keys retain the original order)"* — and why
it can add that the same effect is reproducible with `reversed()` applied twice. The
HOWTO's own example, verbatim:

```python
>>> data = [('red', 1), ('blue', 1), ('red', 2), ('blue', 2)]
>>> standard_way = sorted(data, key=itemgetter(0), reverse=True)
>>> double_reversed = list(reversed(sorted(reversed(data), key=itemgetter(0))))
>>> assert standard_way == double_reversed
>>> standard_way
[('red', 1), ('red', 2), ('blue', 1), ('blue', 2)]
```

Follow why the first reversal is needed. Equal-keyed records come out of a stable
ascending sort in input order, and the final reversal flips them. Reversing the input
first means they enter the ascending sort already flipped, so the final reversal puts
them back. Two flips, net zero, for ties only.

🔴 `reverse=True` is **not** the same as `sorted(...)[::-1]`. Both produce descending
order; they differ on ties. `reverse=True` keeps equal elements in their original
relative order; reversing the sorted result flips them. For the data above the slice
would put `('red', 2)` before `('red', 1)` — derived from the mechanism, not from a
run. [08](08-stability-and-multi-key-sorts.md) is what that difference breaks.

## The pre-sort homogeneity check

`listsort.txt` names the problem the check solves:

> *"As noted above, even the simplest Python comparison triggers a large pile of
> C-level pointer dereferences, conditionals, and function calls. This can be
> partially mitigated by pre-scanning the data to determine whether the data is
> homogeneous with respect to type. If so, it is sometimes possible to substitute
> faster type-specific comparisons for the slower, generic
> PyObject_RichCompareBool."*

And the comment at the top of the check in `list_sort_impl`:

> *"The pre-sort check: here's where we decide which compare function to use. How much
> optimization is safe? We test for homogeneity with respect to several properties
> that are expensive to check at compare-time, and set ms appropriately."*

The procedure is two lines of comment and one loop:

```c
        /* Assume the first element is representative of the whole list. */
        ...
        /* Prove that assumption by checking every key. */
        for (i=0; i < saved_ob_size; i++) {
            ...
            if (!Py_IS_TYPE(key, key_type)) {
                keys_are_all_same_type = 0;
```

It reads the type of the first key, then walks every key asking two questions — is it
*exactly* that type, and does it still qualify for the narrower fast path (an `int`
that is *compact*, a `str` whose storage is one byte per character). Then it picks:

| All keys are exactly… | Comparison installed |
|---|---|
| `str`, every one latin-1 | `unsafe_latin_compare` |
| `int`, every one compact | `unsafe_long_compare` |
| `float` | `unsafe_float_compare` |
| any one type with a `tp_richcompare` slot | `unsafe_object_compare` |
| mixed, or anything else | `safe_object_compare` |

"Unsafe" here means *skips the checks the generic path performs on every call*. It is
safe only because the scan already proved the precondition for the whole list — which
is why the scan exists.

**Tuple keys get a second layer.** If every key is a non-empty tuple, the check is run
against the types of the tuples' *first elements* instead, that routine becomes
`tuple_elem_compare`, and the outer comparison is `unsafe_tuple_compare`. If the first
elements are themselves tuples, the inner routine falls back to `safe_object_compare`.

🔴 This is an implementation detail with **no documented guarantee**. What it means
practically: a type-homogeneous list — or a `key=` that produces one — takes a more
direct comparison path than a mixed one. It is a reason to prefer
`key=lambda r: r.name or ""` over a key that sometimes yields `None`, beyond the fact
that the latter raises.

### `Py_IS_TYPE` is an exact check

`Py_IS_TYPE(key, key_type)` compares type objects for identity — it is `type(k) is T`,
not `isinstance`. Three consequences that nothing in the documentation warns you
about, all read straight off that line:

- **`bool` is not `int` here.** `True` is an instance of `int`, but `type(True)` is
  `bool`. One boolean among a list of integer keys makes the keys heterogeneous, and
  the whole sort takes `safe_object_compare`.
- **Subclasses and enums fall off.** `IntEnum` members, `str` subclasses and
  `numpy` scalars are not exactly `int`, `str` or `float`. A list of only one such
  type still gets `unsafe_object_compare`; a mix of them with the base type does not.
- **One odd key decides for all n.** The check is all-or-nothing: the comparison
  routine is chosen once, for the whole sort.

## Gotchas

### Believing `reverse=True` is `[::-1]` after sorting
**Symptom.** Ties come out in the opposite order from the rest of the pipeline, and a
"stable" multi-key sort produces the wrong grouping.
**Cause.** `reverse=True` reverses, sorts stably, and reverses again, preserving the
original order of equal elements. Slicing reverses everything including ties.
**Fix.** Use the parameter, not the slice:

```python
rows.sort(key=score, reverse=True)     # stable
worse = sorted(rows, key=score)[::-1]  # ties flipped
```

### "Optimising" `sorted(xs, reverse=True)` into `sorted(xs)[::-1]` in review
**Symptom.** A refactor that looks behaviour-neutral changes the order of rows with
equal scores, and a snapshot test fails — or worse, a pagination cursor built on that
order starts skipping and repeating rows.
**Cause.** The two spellings agree only when no two keys are equal. The slice also
allocates a second list.
**Fix.** Keep the parameter; if you need the reverse of an *existing* sorted order
(not a descending sort), say so explicitly:

```python
descending = sorted(rows, key=score, reverse=True)   # ties in input order
mirror = list(reversed(ascending))                   # deliberate: ties flipped too
```

### A `key=` that returns mixed types
**Symptom.** `TypeError: '<' not supported between instances of 'str' and 'int'`, or
an unexplained slowdown on a list that used to sort quickly.
**Cause.** Mixed key types force the general `safe_object_compare` path, and
cross-type comparisons raise — the HOWTO: *"most cross-type comparisons raise a
TypeError."*
**Fix.** Make the key total and homogeneous:

```python
rows.sort(key=lambda r: str(r.label))             # one type, always
rows.sort(key=lambda r: (r.n is None, r.n or 0))  # None handled, still homogeneous
```

### A `bool` hiding among `int` keys
**Symptom.** No error, correct output, and a sort that is slower than an apparently
identical one elsewhere — with nothing in the data that looks unusual.
**Cause.** A key such as `lambda r: r.retries or False` returns `False` for some rows
and an `int` for others. `bool` is a subclass of `int`, so every comparison succeeds,
but the exact-type check sees two types and installs the generic comparison.
**Fix.** Normalise to one exact type at the key:

```python
rows.sort(key=lambda r: int(r.retries or 0))   # always exactly int
```

### Tuple keys whose first element is sometimes `None`
**Symptom.** `TypeError` from inside a sort whose key "always returns a tuple".
**Cause.** The tuple specialisation only changes *which* comparison runs; the
comparison of first elements still happens, and `None < 3` still raises.
**Fix.** Put the null test in front so the first element is always a `bool`:

```python
rows.sort(key=lambda r: (r.region is None, r.region or "", r.score))
```

### Relying on the fast path as a performance contract
**Symptom.** A capacity estimate or a benchmark suite that assumes homogeneous sorts
stay fast across upgrades or interpreters.
**Cause.** The specialisations are private C functions with no documentation beyond
source comments; PyPy and other implementations have their own sort.
**Fix.** Keep homogeneous keys because they are *correct and total*, and measure
anything you intend to promise:

```python
# CPython 3.14 detail: homogeneous exact-type keys take a specialised comparison.
# Not a documented guarantee; do not cite as one.
rows.sort(key=lambda r: r.created_at.timestamp())   # always float
```

## Interview questions

**★ How is `reverse=True` implemented, and why does that matter?**
The list is reversed, sorted with the ordinary stable forward sort, and reversed
again — the source comment says exactly that, and the keys array is reversed
alongside the items. It matters because it preserves stability: records with equal
keys come out in their original relative order, which would not be true if you sorted
ascending and then reversed the result. The Sorting HOWTO makes the same point and
shows the `reversed()`-twice equivalence as a doctest.

**Does the type of the elements affect sort performance?**
In CPython, yes, though nothing guarantees it. Before sorting, CPython scans the keys
and, if they are all one type, installs a specialised comparison function — separate
fast paths exist for latin-1 strings, compact ints, floats, and any single type with a
rich-comparison slot; a mixed list falls back to the fully general path. Lists of
tuples get a further specialisation on the first element's type. This is why a `key=`
that always returns the same type is worth preferring, over and above the fact that a
mixed one can raise.

**Why must CPython scan every key before it can use a faster comparison?**
Because the faster routines skip the checks that make a comparison safe for arbitrary
objects — `unsafe_long_compare` assumes both operands are compact ints and compares
their values directly. Using it on a single non-int would be wrong, not just slow. The
source's comments put it as *"Assume the first element is representative"* then
*"Prove that assumption by checking every key."* The scan is O(n), which is noise
against an O(n log n) sort and still cheap against the O(n) best case.

**A list of integer keys contains one `True`. What changes?**
The result does not — `True` compares as `1`. The comparison routine does: the check
uses `Py_IS_TYPE`, an exact-type test, and `type(True) is bool`, so the keys are no
longer homogeneous and the sort uses `safe_object_compare` throughout. It is a clean
example of a behaviour that is invisible in output and visible only in cost, which is
the category of detail you should know exists and never promise.

**Is `sorted(xs, reverse=True)` the same as `sorted(xs)[::-1]`?**
Only when all keys are distinct. With ties, `reverse=True` keeps equal elements in
input order and the slice reverses them. The slice also allocates a second list of n
pointers. The HOWTO's doctest on `('red', 1), ('blue', 1), ('red', 2), ('blue', 2)`
shows the parameter keeping `('red', 1)` ahead of `('red', 2)`.

**If a sort with `reverse=True` raises part-way, is the list left reversed?**
The initial reversal is undone either way: the final `reverse_slice` runs after the
`fail:` label, so it executes on the error path as well as on success. What is *not*
restored is the order the merge had reached, so the list is still some permutation of
its input, exactly as [06b](06b-during-the-sort.md) describes for a failed comparison.

---

← [Galloping](07c-galloping.md) · [Topic index](README.md) · Next → [Stability and multi-key sorts](08-stability-and-multi-key-sorts.md)
