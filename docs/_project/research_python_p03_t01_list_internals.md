---
name: research-python-p03-t01-list-internals
description: Banked primary sources for Python phase 3 topic 01 (list internals) — verbatim quotes and URLs. Do not re-derive.
metadata:
  type: project
---

# Python Phase 3 · Topic 01 — `list` internals — banked sources

**Researched 2026-09-10. Do not re-derive.** Target **CPython 3.14** (docs footer
reads *"3.14.7 Documentation"*). Every quote below was taken from the page named,
by fetching the page and stripping tags — not from memory.

🔴 **TWO DOCS PAGES ARE BRAND NEW IN 3.14** and change how this whole phase should
be sourced. Both return **404 on `docs.python.org/3.13/`** and **200 on `/3.14/`**
(checked 2026-09-10):

| Page | URL |
|---|---|
| **Time complexity of operations on built-in types** | https://docs.python.org/3.14/library/time-complexity.html |
| **Thread Safety Guarantees** | https://docs.python.org/3.14/library/threadsafety.html |

Until 3.14 the only complexity reference was the *community wiki*
(`wiki.python.org/moin/TimeComplexity`), which is **not** a primary source. It is
now unnecessary: cite `library/time-complexity.html`. Phase 3 topics 02 (`tuple`),
03 (`dict`), 04 (`set`) and 06 (`collections`) all have their own tables on that
same page — **tell the sibling agents.**

---

## 1 · What a list is — FAQ (primary, and the doc the complexity page links back to)

`https://docs.python.org/3.14/faq/design.html#how-are-lists-implemented-in-cpython`

> *"CPython's lists are really variable-length arrays, not Lisp-style linked lists.
> The implementation uses a contiguous array of references to other objects, and
> keeps a pointer to this array and the array's length in a list head structure."*

> *"This makes indexing a list `a[i]` an operation whose cost is independent of
> the size of the list or the value of the index."*

> *"When items are appended or inserted, the array of references is resized. Some
> cleverness is applied to improve the performance of appending items repeatedly;
> when the array must be grown, some extra space is allocated so the next few
> times don't require an actual resize."*

### The C struct — `Include/cpython/listobject.h` (branch `3.14`)

`https://github.com/python/cpython/blob/3.14/Include/cpython/listobject.h`

```c
typedef struct {
    PyObject_VAR_HEAD
    /* Vector of pointers to list elements.  list[0] is ob_item[0], etc. */
    PyObject **ob_item;

    /* ob_item contains space for 'allocated' elements.  The number
     * currently in use is ob_size.
     * Invariants:
     *     0 <= ob_size <= allocated
     *     len(list) == ob_size
     *     ob_item == NULL implies ob_size == allocated == 0
     * list.sort() temporarily sets allocated to -1 to detect mutations.
     */
    Py_ssize_t allocated;
} PyListObject;
```

🔴 Load-bearing: `len(list) == ob_size` (so `len` is O(1)) and
*"list.sort() temporarily sets allocated to -1 to detect mutations."*

---

## 2 · The official complexity table for `list` (3.14, verbatim)

`https://docs.python.org/3.14/library/time-complexity.html#list`

Page preamble:

> *"This page documents the time complexity of various operations on built-in types
> in CPython. Other Python implementations may have different performance
> characteristics. Additionally, the listed costs assume exact built-in types, as
> instances of subclasses may have different costs."*

> *"Lists are mutable sequences; for more detail on the implementation see How are
> lists implemented in CPython?. The largest costs come from growing beyond the
> current allocation size (because everything must move), or from inserting or
> deleting somewhere near the beginning (because everything after that must move).
> If you need to add or remove at both ends, consider using a `collections.deque`
> instead."*

| Operation | Complexity |
|---|---|
| Copy (`l.copy()`) | O(n) |
| Append (`l.append(x)`) [1] | O(1) |
| Pop (`l.pop(k)`) [1][2] | O(n - k) |
| Insert (`l.insert(k, x)`) [1][2] | O(n - k) |
| Get item (`l[k]`) | O(1) |
| Set item (`l[k] = x`) | O(1) |
| Delete item (`del l[k]`) [2] | O(n - k) |
| Iteration | O(n) |
| Get slice (`l[i:j]`) | O(j - i) |
| Set slice (`l[i:j] = t`) [1] | O(j - i) if `len(t) == j - i`, otherwise O(n - i + len(t)) |
| Delete slice (`del l[i:j]`) | O(n - i) |
| Extend (`l.extend(t)`) [1][3] | O(len(t)) |
| Sort (`l.sort()`) [4] | O(n log n) |
| Concatenate (`l1 + l2`) | O(len(l1) + len(l2)) |
| Multiply (`l * k`) | O(nk) |
| `x in l` | O(n) |
| `min(l)`, `max(l)` | O(n) |
| Get length (`len(l)`) [5] | O(1) |

**Notes, verbatim:**

- **[1]** > *"Amortized. An individual operation may occasionally be O(n) when the
  underlying storage is resized, but this cost is spread over many operations,
  depending on the history of the container."*
- **[2]** > *"Popping or deleting the element at index k of a list of size n shifts
  all elements after k one slot to the left, moving n - k - 1 elements; inserting at
  index k shifts the elements from k onwards one slot to the right, moving n - k
  elements. The worst case is index 0, where the whole rest of the list has to be
  moved; the average case, an index in the middle of the list, takes O(n/2) = O(n)
  operations; and operating at the end of the list moves nothing and is O(1)."*
- **[3]** > *"Plus the cost of iterating over t, which may be expensive for an
  arbitrary iterable."*
- **[4]** > *"This is the worst case scenario. Sorting is adaptive and input that is
  already sorted or reverse-sorted takes only O(n) comparisons. See
  Objects/listsort.txt for more information."*
- **[5]** > *"The number of elements is stored in the object, so len() does not need
  to count them."*
- **[10]** (str, but the lesson generalises) > *"Each concatenation builds a new
  object, so building a string by concatenating many pieces in a loop is quadratic
  in the total length."*

`tuple` on the same page: > *"A tuple is an immutable sequence. Because a tuple can
never change, there are no insertion or deletion costs, and making a copy simply
returns the same object, so is constant time (O(1))."* — `Copy (tuple(t))` is **O(1)**.

---

## 3 · Over-allocation — `Objects/listobject.c`, `list_resize` (branch `3.14`)

`https://github.com/python/cpython/blob/3.14/Objects/listobject.c`

```c
    /* Bypass realloc() when a previous overallocation is large enough
       to accommodate the newsize.  If the newsize falls lower than half
       the allocated size, then proceed with the realloc() to shrink the list.
    */
    if (allocated >= newsize && newsize >= (allocated >> 1)) {
        assert(self->ob_item != NULL || newsize == 0);
        Py_SET_SIZE(self, newsize);
        return 0;
    }

    /* This over-allocates proportional to the list size, making room
     * for additional growth.  The over-allocation is mild, but is
     * enough to give linear-time amortized behavior over a long
     * sequence of appends() in the presence of a poorly-performing
     * system realloc().
     * Add padding to make the allocated size multiple of 4.
     * The growth pattern is:  0, 4, 8, 16, 24, 32, 40, 52, 64, 76, ...
     * Note: new_allocated won't overflow because the largest possible value
     *       is PY_SSIZE_T_MAX * (9 / 8) + 6 which always fits in a size_t.
     */
    new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;
    /* Do not overallocate if the new size is closer to overallocated size
     * than to the old size.
     */
    if (newsize - Py_SIZE(self) > (Py_ssize_t)(new_allocated - newsize))
        new_allocated = ((size_t)newsize + 3) & ~(size_t)3;

    if (newsize == 0)
        new_allocated = 0;
```

🔴 **The growth factor is ~1.125 (`newsize >> 3` = newsize/8) plus 6, rounded down
to a multiple of 4** — NOT 2×, and NOT 1.5×. The growth-pattern comment
(`0, 4, 8, 16, 24, 32, 40, 52, 64, 76, ...`) is the source's own, so it is quotable;
the *numbers themselves are an implementation detail with no documented guarantee.*
Older CPython had a different pattern (`0, 4, 8, 16, 25, 35, 46, 58, 72, 88, …`).
**State this as "current CPython 3.14 source", never as a language rule.**

`list_preallocate_exact` (used when a fresh list is built from something whose
length is known):

```c
    /* Since the Python memory allocator has granularity of 16 bytes on 64-bit
     * platforms (8 on 32-bit), there is no benefit of allocating space for
     * the odd number of items, and there is no drawback of rounding the
     * allocated size up to the nearest even number.
     */
    size = (size + 1) & ~(size_t)1;
```

`list_extend_iter_lock_held` — where `__length_hint__` is consulted:

```c
    /* Guess a result list size. */
    Py_ssize_t n = PyObject_LengthHint(iterable, 8);
    ...
    /* Cut back result list if initial guess was too large. */
    if (Py_SIZE(self) < self->allocated) {
        if (list_resize(self, Py_SIZE(self)) < 0)
```

---

## 4 · The O(n) shift, in source

`ins1` (what `list.insert` and `PyList_Insert` call):

```c
    if (list_resize(self, n+1) < 0)
        return -1;
    ...
    items = self->ob_item;
    for (i = n; --i >= where; )
        FT_ATOMIC_STORE_PTR_RELAXED(items[i+1], items[i]);
    FT_ATOMIC_STORE_PTR_RELEASE(items[where], Py_NewRef(v));
```

`list_pop_impl`:

```c
        if ((size_after_pop - index) > 0) {
            memmove(&items[index], &items[index+1], (size_after_pop - index) * sizeof(PyObject *));
        }
        status = list_resize(self, size_after_pop);
```

`list_ass_slice_lock_held` (both `s[i:j] = t` and `del s[i:j]`) uses `memmove` in
both the shrink and the grow branch, and keeps a `recycle` array:

```c
    /* Because [X]DECREF can recursively invoke list operations on
       this list, we must postpone all [X]DECREF activity until
       after the list is back in its canonical shape.  Therefore
       we must allocate an additional array, 'recycle', into which
       we temporarily copy the items that are deleted from the
       list. :-( */
    PyObject *recycle_on_stack[8];
```

---

## 5 · Real error strings (quotable inline, sourced from `Objects/listobject.c`)

| String | Where raised |
|---|---|
| `pop from empty list` | `list_pop_impl`, `IndexError` |
| `pop index out of range` | `list_pop_impl`, `IndexError` |
| `list.remove(x): x not in list` | `list_remove_impl`, `ValueError` |
| `list.index(x): x not in list` | `list_index_impl`, `ValueError` |
| `list modified during sort` | `list_sort_impl`, `ValueError` |
| `can only assign an iterable` | `list_ass_slice_lock_held`, via `PySequence_Fast`, `TypeError` |

🔴 No sandbox was used. These are the literal C string literals in the 3.14 source;
the traceback wrapper text around them was **not** reproduced anywhere.

---

## 6 · Mutable sequence surface — `library/stdtypes.html`

`https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types`

> *"`sequence.append(value, /)` — Append value to the end of the sequence. This is
> equivalent to writing `seq[len(seq):len(seq)] = [value]`."*

> *"`sequence.clear()` — Remove all items from sequence. This is equivalent to
> writing `del sequence[:]`."*

> *"`sequence.copy()` — Create a shallow copy of sequence. This is equivalent to
> writing `sequence[:]`."*

> *"Hint: The `copy()` method is not part of the `MutableSequence` ABC, but most
> concrete mutable sequence types provide it."*

> *"`sequence.extend(iterable, /)` — Extend sequence with the contents of iterable.
> For the most part, this is the same as writing
> `seq[len(seq):len(seq)] = iterable`."*

> *"`sequence.insert(index, value, /)` — Insert value into sequence at the given
> index. This is equivalent to writing `sequence[index:index] = [value]`."*

> *"`sequence.reverse()` — Reverse the items of sequence in place. This method
> maintains economy of space when reversing a large sequence. To remind users that
> it operates by side-effect, it returns None."*

Table rows: > *"`s += t` extends s with the contents of t (for the most part the
same as `s[len(s):len(s)] = t`)"* · > *"`s *= n` updates s with its contents
repeated n times"*.

Note (2) on `s *= n`: > *"Zero and negative values of n clear the sequence. Items in
the sequence are not copied; they are referenced multiple times."*

`https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations`

> *"`sequence.index(value[, start[, stop]])` — Return the index of the first
> occurrence of value in sequence. Raises ValueError if value is not found in
> sequence. The start or stop arguments allow for efficient searching of subsections
> of the sequence, beginning at start and ending at stop. This is roughly equivalent
> to `start + sequence[start:stop].index(value)`, only without copying any data."*

> *"Caution — Not all sequence types support passing the start and stop arguments."*

🔴 **The mutate-during-iteration mechanism, documented:**

> *"Forward and reversed iterators over mutable sequences access values using an
> index. That index will continue to march forward (or backward) even if the
> underlying sequence is mutated. The iterator terminates only when an `IndexError`
> or a `StopIteration` is encountered (or when the index drops below zero)."*

The `[[]] * 3` passage (note 2 under Common Sequence Operations), verbatim:

> *"Values of n less than 0 are treated as 0 (which yields an empty sequence of the
> same type as s). Note that items in the sequence s are not copied; they are
> referenced multiple times. This often haunts new Python programmers"*

> *"What has happened is that `[[]]` is a one-element list containing an empty list,
> so all three elements of `[[]] * 3` are references to this single empty list.
> Modifying any of the elements of lists modifies this single list."*

Quadratic concatenation:

> *"Concatenating immutable sequences always results in a new object. This means
> that building up a sequence by repeated concatenation will have a quadratic
> runtime cost in the total sequence length."*
> … *"if concatenating tuple objects, extend a list instead"*

---

## 7 · `list.sort` — `library/stdtypes.html#list.sort`

> *"This method sorts the list in place, using only `<` comparisons between items.
> Exceptions are not suppressed - if any comparison operations fail, the entire sort
> operation will fail (and the list will likely be left in a partially modified
> state)."*

> *"key specifies a function of one argument that is used to extract a comparison key
> from each list element (for example, `key=str.lower`). The key corresponding to
> each item in the list is calculated once and then used for the entire sorting
> process. The default value of None means that list items are sorted directly
> without calculating a separate key value."*

> *"The `functools.cmp_to_key()` utility is available to convert a 2.x style cmp
> function to a key function."*

> *"reverse is a boolean value. If set to True, then the list elements are sorted as
> if each comparison were reversed."*

> *"This method modifies the sequence in place for economy of space when sorting a
> large sequence. To remind users that it operates by side effect, it does not
> return the sorted sequence (use `sorted()` to explicitly request a new sorted list
> instance)."*

> *"The `sort()` method is guaranteed to be stable. A sort is stable if it guarantees
> not to change the relative order of elements that compare equal — this is helpful
> for sorting in multiple passes (for example, sort by department, then by salary
> grade)."*

> *"**CPython implementation detail:** While a list is being sorted, the effect of
> attempting to mutate, or even inspect, the list is undefined. The C implementation
> of Python makes the list appear empty for the duration, and raises `ValueError` if
> it can detect that the list has been mutated during a sort."*

### `sorted()` — `library/functions.html#sorted`

> *"Return a new sorted list from the items in iterable."*

> *"The built-in `sorted()` function is guaranteed to be stable."*

> *"The sort algorithm uses only `<` comparisons between items. While defining an
> `__lt__()` method will suffice for sorting, PEP 8 recommends that all six rich
> comparisons be implemented. This will help avoid bugs when using the same data with
> other ordering tools such as `max()` that rely on a different underlying method.
> Implementing all six comparisons also helps avoid confusion for mixed type
> comparisons which can call the reflected `__gt__()` method."*

**`sorted()` IS `list(...)` + `.sort()`** — `Python/bltinmodule.c`, `builtin_sorted`:

```c
    newlist = PySequence_List(seq);
    ...
    callable = PyObject_GetAttr(newlist, &_Py_ID(sort));
    ...
    v = PyObject_Vectorcall(callable, args + 1, nargs - 1, kwnames);
    ...
    return newlist;
```

### Mutation protection — `Objects/listobject.c`, `list_sort_impl`

```c
    /* The list is temporarily made empty, so that mutations performed
     * by comparison functions can't affect the slice of memory we're
     * sorting (allowing mutations during sorting is a core-dump
     * factory, since ob_item may change).
     */
    ...
    self->allocated = -1; /* any operation will reset it to >= 0 */
    ...
    if (self->allocated != -1 && result != NULL) {
        /* The user mucked with the list during the sort,
         * and we don't already have another error to report.
         */
        PyErr_SetString(PyExc_ValueError, "list modified during sort");
```

### `reverse=True` is still stable — same function

```c
    /* Reverse sort stability achieved by initially reversing the list,
    applying a stable forward sort, then reversing the final result. */
```

### The pre-sort homogeneity check — same function

> *"The pre-sort check: here's where we decide which compare function to use. How
> much optimization is safe? We test for homogeneity with respect to several
> properties that are expensive to check at compare-time, and set ms appropriately."*

It picks `unsafe_latin_compare` (all-`str`, all latin-1), `unsafe_long_compare`
(all compact `int`), `unsafe_float_compare`, `unsafe_object_compare` (one type with
a `tp_richcompare`), else `safe_object_compare`. Tuples get `tuple_elem_compare`
specialised on the *first* element's type. 🔴 So a **type-homogeneous** list sorts
through a faster comparison path than a mixed one — implementation detail, no
documented guarantee.

---

## 8 · Timsort — `Objects/listsort.txt` (branch `3.14`)

`https://github.com/python/cpython/blob/3.14/Objects/listsort.txt`

> *"This describes an adaptive, stable, natural mergesort, modestly called timsort
> (hey, I earned it `<wink>`). It has supernatural performance on many kinds of
> partially ordered arrays (less than lg(N!) comparisons needed, and as few as N-1),
> yet as fast as Python's previous highly tuned samplesort hybrid on random arrays."*

> *"In a nutshell, the main routine marches over the array once, left to right,
> alternately identifying the next run, then merging it into the previous runs
> \"intelligently\". Everything else is complication for speed, and some hard-won
> measure of memory efficiency."*

> *"timsort can require a temp array containing as many as N//2 pointers, which means
> as many as 2*N extra bytes on 32-bit boxes."*

**Runs:**

> *"count_run() returns the # of elements in the next run, and, if it's a descending
> run, reverses it in-place. A run is either \"ascending\", which means
> non-decreasing … or \"descending\", which means non-increasing"*

> *"Note that a run is always at least 2 long, unless we start at the array's last
> element."*

> *"If an array is random, it's very unlikely we'll see long runs. If a natural run
> contains less than minrun elements (see next section), the main loop artificially
> boosts it to minrun elements, via a stable binary insertion sort applied to the
> right number of array elements following the short natural run."*

> *"There's one more trick added since the original: after reversing a descending
> run, it's possible that it can be extended by an adjacent ascending run. For
> example, given [3, 2, 1, 3, 4, 5, 0], the 3-element descending prefix is reversed
> in-place, and then extended by [3, 4, 5]."*

**minrun:**

> *"If N < MAX_MINRUN, minrun is N. IOW, binary insertion sort is used for the whole
> array then"*

> *"Instead we pick a minrun in range(MAX_MINRUN / 2, MAX_MINRUN + 1) such that
> N/minrun is exactly a power of 2, or if that isn't possible, is close to, but
> strictly less than, a power of 2."*

`Objects/listobject.c` has `#define MAX_MINRUN 64` and `#define MIN_GALLOP 7` in
3.14. ⚠️ `listsort.txt` still contains an older paragraph reading *"We pick 32 as a
good value in the sweet range"* — that paragraph is about the historical constant;
the live constant is **64**, so minrun lands in **32…64**. Cite the C `#define`,
not that sentence.

`merge_compute_minrun` comment:

> *"Compute a good value for the minimum run length; natural runs shorter than this
> are boosted artificially via binary insertion."*

`binarysort` comment:

> *"binarysort is the best method for sorting small arrays: it does few compares, but
> can do data movement quadratic in the number of elements."*
> *"Note that the number of bytes moved doesn't seem to matter. MAX_MINRUN of 64 is
> so small that the key and value pointers all fit in a corner of L1 cache, and
> moving things around in that is very fast."*

**Stability constrains the merge pattern:**

> *"Stability constrains permissible merging patterns. For example, if we have 3
> consecutive runs of lengths A:10000 B:20000 C:10000 we dare not merge A with C
> first, because if A, B and C happen to contain a common element, it would get out
> of order wrt its occurrence(s) in B. The merging must be done as (A+B)+C or
> A+(B+C) instead."*

**Powersort (this replaced the original Fibonacci-ish invariants):**

> *"The original version of this code used the first thing I made up that didn't
> obviously suck ;-) It was loosely based on invariants involving the Fibonacci
> sequence."*
> *"It worked OK, but it was hard to reason about, and was subtle enough that the
> intended invariants weren't actually preserved. Researchers discovered that when
> trying to complete a computer-generated correctness proof."*
> *"The code now uses the \"powersort\" merge strategy from: \"Nearly-Optimal
> Mergesorts: Fast, Practical Sorting Methods That Optimally Adapt to Existing
> Runs\" J. Ian Munro and Sebastian Wild"*

**Merge memory:**

> *"Merging adjacent runs of lengths A and B in-place, and in linear time, is
> difficult. Theoretical constructions are known that can do it, but they're too
> difficult and slow for practical use. But if we have temp memory equal to
> min(A, B), it's easy."*

> *"A refinement: When we're about to merge adjacent runs A and B, we first do a form
> of binary search (more on that later) to see where B[0] should end up in A.
> Elements in A preceding that point are already in their final positions,
> effectively shrinking the size of A."*

**Galloping:**

> *"If that count reaches MIN_GALLOP, we switch to \"galloping mode\". Here we
> *search* B for where A[0] belongs, and move over all the B's before that point in
> one chunk to the merge area, then move A[0] to the merge area."*

> *"In galloping mode, we first look for A[0] in B. We do this via \"galloping\",
> comparing A[0] in turn to B[0], B[1], B[3], B[7], ..., B[2**j - 1], ..., until
> finding the k such that B[2**(k-1) - 1] < A[0] <= B[2**k - 1]."*

> *"OTOH, if data is lopsided or lumpy or contains many duplicates, long stretches of
> winning sub-runs are very likely, and cutting the number of comparisons needed to
> find one from O(B) to O(log B) is a huge win."*

> *"Galloping compromises by getting out fast if there isn't a long winning sub-run,
> yet finding such very efficiently when they exist."*

`list_sort_impl` header comment:

> *"An adaptive, stable, natural mergesort. See listsort.txt. Returns Py_None on
> success, NULL on error. Even in case of error, the list will be some permutation
> of its input state (nothing is lost or duplicated)."*

---

## 9 · Sorting HOWTO — `howto/sorting.html`

`https://docs.python.org/3.14/howto/sorting.html`

> *"Python lists have a built-in `list.sort()` method that modifies the list
> in-place. There is also a `sorted()` built-in function that builds a new sorted
> list from an iterable."*

> *"You can also use the `list.sort()` method. It modifies the list in-place (and
> returns None to avoid confusion). Usually it's less convenient than `sorted()` -
> but if you don't need the original list, it's slightly more efficient."*

> *"Another difference is that the `list.sort()` method is only defined for lists. In
> contrast, the `sorted()` function accepts any iterable."*

> *"The value of the key parameter should be a function (or other callable) that
> takes a single argument and returns a key to use for sorting purposes. This
> technique is fast because the key function is called exactly once for each input
> record."*

> *"Sorts are guaranteed to be stable. That means that when multiple records have the
> same key, their original order is preserved."*

> *"This wonderful property lets you build complex sorts in a series of sorting
> steps. For example, to sort the student data by descending grade and then
> ascending age, do the age sort first and then sort again using grade"*

The documented `multisort` recipe, verbatim from the HOWTO:

```python
>>> def multisort(xs, specs):
...     for key, reverse in reversed(specs):
...         xs.sort(key=attrgetter(key), reverse=reverse)
...     return xs
```

> *"The Timsort algorithm used in Python does multiple sorts efficiently because it
> can take advantage of any ordering already present in a dataset."*

**DSU:**

> *"This idiom works because tuples are compared lexicographically; the first items
> are compared; if they are the same then the second items are compared, and so on."*

> *"It is not strictly necessary in all cases to include the index i in the decorated
> list, but including it gives two benefits: The sort is stable … The original items
> do not have to be comparable because the ordering of the decorated tuples will be
> determined by at most the first two items."*

> *"Now that Python sorting provides key-functions, this technique is not often
> needed."*

**Comparison functions:**

> *"Unlike key functions that return an absolute value for sorting, a comparison
> function computes the relative ordering for two inputs."*
> *"It is common to encounter comparison functions when translating algorithms from
> other languages. Also, some libraries provide comparison functions as part of their
> API. For example, `locale.strcoll()` is a comparison function."*
> *"To accommodate those situations, Python provides `functools.cmp_to_key` to wrap
> the comparison function to make it usable as a key function"*

**Unorderable values:**

> *"This is needed because most cross-type comparisons raise a TypeError."*
> *"This is needed because the IEEE-754 standard specifies that, \"Every NaN shall
> compare unordered with everything, including itself.\""*
> *"This is needed because None is not comparable to other types."*
> *"This is needed because dict-to-dict comparisons raise a TypeError."*
> *"This is needed because the elements contained in set types do not have a
> deterministic order."*

**Odds and ends:**

> *"The reverse parameter still maintains sort stability (so that records with equal
> keys retain the original order). Interestingly, that effect can be simulated
> without the parameter by using the builtin `reversed()` function twice"*

> *"The sort routines use `<` when making comparisons between two objects. So, it is
> easy to add a standard sort order to a class by defining an `__lt__()` method"*

> *"However, note that `<` can fall back to using `__gt__()` if `__lt__()` is not
> implemented … To avoid surprises, PEP 8 recommends that all six comparison methods
> be implemented."*

> *"Key functions need not depend directly on the objects being sorted. A key
> function can also access external resources."* — with `key=newgrades.__getitem__`.

**Partial sorts:**

> *"`min()` and `max()` return the smallest and largest values, respectively. These
> functions make a single pass over the input data and require almost no auxiliary
> memory."*
> *"`heapq.nsmallest()` and `heapq.nlargest()` … For values of n that are small
> relative to the number of inputs, these functions make far fewer comparisons than a
> full sort."*

### `cmp` was removed in Python 3.0 — `whatsnew/3.0.html`

> *"`sorted()` and `list.sort()` no longer accept the cmp argument providing a
> comparison function. Use the key argument instead. N.B. the key and reverse
> arguments are now \"keyword-only\"."*

> *"The `cmp()` function should be treated as gone, and the `__cmp__()` special
> method is no longer supported. Use `__lt__()` for sorting, `__eq__()` with
> `__hash__()`, and other rich comparisons as needed. (If you really need the `cmp()`
> functionality, you could use the expression `(a > b) - (a < b)` as the equivalent
> for `cmp(a, b)`.)"*

### `functools.cmp_to_key` — `library/functools.html#functools.cmp_to_key`

> *"Transform an old-style comparison function to a key function. … This function is
> primarily used as a transition tool for programs being converted from Python 2
> which supported the use of comparison functions."*
> *"A comparison function is any callable that accepts two arguments, compares them,
> and returns a negative number for less-than, zero for equality, or a positive
> number for greater-than."*
> Added in version 3.2.

---

## 10 · `list` as a queue, and `deque` — tutorial + `collections`

`https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-queues`

> *"It is also possible to use a list as a queue, where the first element added is
> the first element retrieved (\"first-in, first-out\"); however, lists are not
> efficient for this purpose. While appends and pops from the end of list are fast,
> doing inserts or pops from the beginning of a list is slow (because all of the
> other elements have to be shifted by one)."*

> *"To implement a queue, use `collections.deque` which was designed to have fast
> appends and pops from both ends."*

`https://docs.python.org/3.14/library/collections.html#collections.deque`

> *"Deques support thread-safe, memory efficient appends and pops from either side of
> the deque with approximately the same O(1) performance in either direction."*

> *"Though list objects support similar operations, they are optimized for fast
> fixed-length operations and incur O(n) memory movement costs for `pop(0)` and
> `insert(0, v)` operations which change both the size and position of the underlying
> data representation."*

🔴 Topic 06 owns `deque`. Name it and stop.

Tutorial, on the `None` return:

> *"You might have noticed that methods like insert, remove or sort that only modify
> the list have no return value printed – they return the default None. This is a
> design principle for all mutable data structures in Python."*

Tutorial, `a.insert(0, x)`:

> *"Insert an item at a given position. The first argument is the index of the
> element before which to insert, so `a.insert(0, x)` inserts at the front of the
> list, and `a.insert(len(a), x)` is equivalent to `a.append(x)`."*

---

## 11 · Mutating while iterating

`https://docs.python.org/3.14/tutorial/controlflow.html#for-statements`

> *"Code that modifies a collection while iterating over that same collection can be
> tricky to get right. Instead, it is usually more straight-forward to loop over a
> copy of the collection or to create a new collection"*

The mechanism (already quoted in §6) is in `stdtypes` Common Sequence Operations:
*"Forward and reversed iterators over mutable sequences access values using an index.
That index will continue to march forward (or backward) even if the underlying
sequence is mutated."*

Source confirmation — `Objects/listobject.c`, `listiter_next`:

```c
    Py_ssize_t index = FT_ATOMIC_LOAD_SSIZE_RELAXED(it->it_index);
    if (index < 0) { return NULL; }
    PyObject *item = list_get_item_ref(it->it_seq, index);
    if (item == NULL) { /* out-of-bounds */ ... return NULL; }
    FT_ATOMIC_STORE_SSIZE_RELAXED(it->it_index, index + 1);
```

⚠️ The old *"There is a subtlety when the sequence is being modified by the loop"*
note that used to live in the language reference's `for` section is **no longer
there in 3.14** — I checked `reference/compound_stmts.html`. Cite `stdtypes` and the
tutorial instead.

---

## 12 · Thread safety for `list` — `library/threadsafety.html` (NEW in 3.14)

Scope, verbatim:

> *"This page documents thread-safety guarantees for built-in types in Python's
> free-threaded build. The guarantees described here apply when using Python with the
> GIL disabled (free-threaded mode). When the GIL is enabled, most operations are
> implicitly serialized."*

> *"Reading a single element from a list is atomic"* — `lst[i]`

> *"The following methods traverse the list and use atomic reads of each item to
> perform their function. That means that they may return results affected by
> concurrent modifications: `item in lst` / `lst.index(item)` / `lst.count(item)`"*

> *"The following methods that only operate on a single element with no shifting
> required are atomic: `lst.append(x)` … `lst.pop()`"*

> *"The `clear()` method is also atomic. Other threads cannot observe elements being
> removed."*

> *"The `sort()` method is not atomic. Other threads cannot observe intermediate
> states during sorting, but the list appears empty for the duration of the sort."*

> *"The following operations may allow lock-free operations to observe intermediate
> states since they modify multiple elements in place: `lst.insert(idx, item)` …
> `lst.pop(idx)` … `lst *= x`"*

> *"The `remove()` method may allow concurrent modifications since element comparison
> may execute arbitrary Python code (via `__eq__()`)."*

> *"`extend()` is safe to call from multiple threads. However, its guarantees depend
> on the iterable passed to it. If it is a list, a tuple, a set, a frozenset, a dict
> or a dictionary view object (but not their subclasses), the extend operation is
> safe from concurrent modifications to the iterable."*

> *"Operations that involve multiple accesses, as well as iteration, are never
> atomic."* — with the documented examples `lst[i] = lst[i] + 1` (read-modify-write),
> `if lst: item = lst.pop()` (check-then-act) and `for item in lst: process(item)`.

> *"Consider external synchronization when sharing list instances across threads."*

---

## 13 · Copies

`https://docs.python.org/3.14/library/copy.html`

> *"Assignment statements in Python do not copy objects, they create bindings between
> a target and an object."*

> *"A shallow copy constructs a new compound object and then (to the extent possible)
> inserts references into it to the objects found in the original."*

> *"A deep copy constructs a new compound object and then, recursively, inserts copies
> into it of the objects found in the original."*

`stdtypes`, `list` constructor:

> *"The constructor builds a list whose items are the same and in the same order as
> iterable's items. … If iterable is already a list, a copy is made and returned,
> similar to `iterable[:]`."*

---

## 14 · Memory — what CAN and CANNOT be claimed

`https://docs.python.org/3.14/library/sys.html#sys.getsizeof`

> *"Return the size of an object in bytes. The object can be any type of object. All
> built-in objects will return correct results, but this does not have to hold true
> for third-party extensions as it is implementation specific."*

> *"Only the memory consumption directly attributed to the object is accounted for,
> not the memory consumption of objects it refers to."*

> *"`getsizeof()` calls the object's `__sizeof__` method and adds an additional
> garbage collector overhead if the object is managed by the garbage collector."*

> *"See recursive sizeof recipe for an example of using `getsizeof()` recursively to
> find the size of containers and all their contents."*

`https://docs.python.org/3.14/library/array.html`

> *"This module defines an object type which can compactly represent an array of
> basic values: characters, integers, floating-point numbers. Arrays are mutable
> sequence types and behave very much like lists, except that the type of objects
> stored in them is constrained. The type is specified at object creation time by
> using a type code, which is a single character."*

🔴 **Do NOT write byte counts.** No sandbox ran. What is safe to claim: a list stores
`PyObject *` pointers plus the header plus over-allocation slack; an `array` stores
raw C values with no per-element object; a tuple has no `allocated` slack.
`sys.getsizeof` on a list counts **the pointer array, not the objects pointed at** —
that is a direct consequence of the quoted sentence, not a measurement.

---

## 15 · What I could NOT confirm (write as uncertain, or leave out)

1. **Any specific byte size** of a list, tuple or array — no sandbox, and the docs
   give no numbers. Explain the *shape* of the cost instead.
2. **The over-allocation growth factor as a guarantee.** The C comment is
   quotable as *"the growth pattern in CPython 3.14's source"*; it is not a language
   guarantee and has changed between versions. Say exactly that.
3. **Whether `list.pop()` (no argument) ever shrinks the allocation.** `list_resize`
   only reallocs when `newsize < allocated >> 1`, so it *does* shrink eventually, but
   the exact schedule is implementation detail. State the `>> 1` rule as
   "the 3.14 source's rule", not a guarantee.
4. **Relative speeds** of anything — `list.sort()` vs `sorted()`, `+=` vs `extend`,
   `itemgetter` vs `lambda`. The HOWTO says `itemgetter` is *"simpler and faster"*
   and `list.sort()` is *"slightly more efficient"*; quote those words and add no
   numbers of my own.
5. The old `for`-statement note about mutation is **gone** from the 3.14 language
   reference. Do not cite `reference/compound_stmts.html` for it.

---

## 16 · Gap fetches — resume session, 2026-09-10 (chunks 07b–12)

Fetched with `curl` + tag-stripping, same method as above. **Do not re-derive.**

### `listsort.txt` — merge pattern, merge memory, galloping (branch `3.14`)

> *"So merging is always done on two consecutive runs at a time, and in-place,
> although this may require some temp memory (more on that later)."*

> *"We would like to delay merging as long as possible in order to exploit patterns
> that may come up later, but we like even more to do merging as soon as possible to
> exploit that the run just found is still high in the memory hierarchy."*

> *"The `powerloop()` function computes a run's \"power\". … The \"power\" of the first
> run is a small integer, the depth of the node connecting the two runs in an ideal
> binary merge tree"* · *"A key invariant is that powers on the run stack are strictly
> decreasing"* · *"Note that even powersort's strategy isn't always truly optimal. It
> can't be."* · *"powersort's is the only one that's always truly optimal for a
> collection of 3 run lengths (for three lengths A B C, it's always optimal to first
> merge the shorter of A and C with B)."*

> *"If A is smaller (function merge_lo), copy A to a temp array, leave B alone, and
> then we can do the obvious merge algorithm left to right"* · *"The only tricky bit is
> that if a comparison raises an exception, we have to remember to copy the remaining
> elements back in from the temp area, lest the array end up with duplicate entries
> from B."* · *"If B is smaller (function merge_hi, which is merge_lo's \"mirror
> image\")"* · *"Likewise we also search to see where A[-1] should end up in B, and
> elements of B after that point can also be ignored. This cuts the amount of temp
> memory needed by the same amount."* · *"we're willing to gamble a little to win a
> lot, even though the net expectation is negative for random data."*

> *"a lovely thing about merging is that many kinds of clustering \"reveal
> themselves\" by how many times in a row the winning merge element comes from the
> same run."* · *"We stay in galloping mode until both searches find slices to copy
> less than MIN_GALLOP elements long, at which point we go back to one-pair-at-a-time
> mode."* · *"the combination of galloping + binary search finds it in no more than
> about 2*lg(B) comparisons."* · *"a consecutive winning sub-run in B of length k
> occurs with probability 1/2**(k+1)."*

"Galloping with a Broken Leg": *"So why don't we always gallop? Because it can lose,
on two counts"* · *"Galloping can-- alas --require more comparisons than linear
one-at-time search, depending on the data."* · *"it doesn't win at all until i=6.
Before then, it loses twice (at i=2 and i=4), and ties at the other values."* ·
*"MIN_GALLOP is 7, and that's pretty strong evidence."* · *"whenever the gallop loop
doesn't pay, min_gallop is increased by one"* · *"For random data, this all but
eliminates the gallop penalty"* · *"in all it's a minor improvement over using a
fixed MIN_GALLOP value."*

LEFT OR RIGHT: *"gallop_left() and gallop_right() are akin to the Python bisect
module's bisect_left() and bisect_right()"* · *"The distinction is needed to preserve
stability."*

### `Objects/listobject.c` (3.14) — constants and the key path

```c
#define MAX_MERGE_PENDING (SIZEOF_SIZE_T * 8)   /* "at most floor(log2(n)) + 1 entries" */
#define MIN_GALLOP 7
#define MERGESTATE_TEMP_SIZE 256                /* "Avoid malloc for small temp arrays." */
#define MAX_MINRUN 64
```

`MergeState.min_gallop` comment: *"merge_lo and merge_hi tend to nudge it higher for
random data, and lower for highly structured data."*

Key path in `list_sort_impl`: keys computed in ONE loop before any comparison —
`keys[i] = PyObject_CallOneArg(keyfunc, saved_ob_item[i]);` for every i; stored in
`ms.temparray` when `saved_ob_size < MERGESTATE_TEMP_SIZE/2`, else
`PyMem_Malloc(sizeof(PyObject *) * saved_ob_size)`. If a key call fails → `goto
keyfunc_fail`, which restores `saved_ob_item`/`saved_allocated` — **list left in
original order** (reverse has not run yet). Contrast comparison failure → scrambled.
Anything put into the list during the sort sits in a temporary block that
`keyfunc_fail` DECREFs and frees — mutations are discarded, then `ValueError`.

Pre-sort check: *"Assume the first element is representative of the whole list."* /
*"Prove that assumption by checking every key."* Uses `Py_IS_TYPE` (EXACT type —
`bool` keys among `int` keys break homogeneity). Tuple keys: requires every key to be
a non-empty tuple; `tuple_elem_compare` specialised on type of `key[0]`, and
`safe_object_compare` if `key[0]` is itself a tuple.

### `Lib/functools.py` — `cmp_to_key` (pure-Python fallback; C version from `_functools` used when present)

```python
def cmp_to_key(mycmp):
    """Convert a cmp= function into a key= function"""
    class K(object):
        __slots__ = ['obj']
        def __init__(self, obj):
            self.obj = obj
        def __lt__(self, other):
            return mycmp(self.obj, other.obj) < 0
        ...                                  # __gt__, __eq__, __le__, __ge__
        __hash__ = None
    return K
```

`library/functools.html`: *"Used with tools that accept key functions (such as
sorted(), min(), max(), heapq.nlargest(), heapq.nsmallest(), itertools.groupby())."*
· *"A key function is a callable that accepts one argument and returns another value
to be used as the sort key."*

### Sorting HOWTO — additional verbatim

> *"The key function patterns shown above are very common, so Python provides
> convenience functions to make accessor functions easier and faster. The operator
> module has itemgetter(), attrgetter(), and a methodcaller() function."*
> *"Using those functions, the above examples become simpler and faster"*
> *"The operator module functions allow multiple levels of sorting."*
> *"The partial() function can reduce the arity of a multi-argument function making it
> suitable for use as a key-function."*
> *"For locale aware sorting, use locale.strxfrm() for a key function or
> locale.strcoll() for a comparison function. This is necessary because
> \"alphabetical\" sort orderings can vary across cultures even if the underlying
> alphabet is the same."*
> *"This is needed because the elements contained in set types do not have a
> deterministic order. For example, list({'a', 'b'}) may produce either ['a', 'b'] or
> ['b', 'a']."*
> DSU: *"So for example the original list could contain complex numbers which cannot
> be sorted directly."* · *"Another name for this idiom is Schwartzian transform"*
> Stability doctest (docs' own output): `sorted(data, key=itemgetter(0))` on
> `[('red', 1), ('blue', 1), ('red', 2), ('blue', 2)]` →
> `[('blue', 1), ('blue', 2), ('red', 1), ('red', 2)]`; reverse doctest →
> `[('red', 1), ('red', 2), ('blue', 1), ('blue', 2)]`.

### `min()` / `max()` / `heapq` — `library/functions.html`, `library/heapq.html`

> *"If multiple items are minimal, the function returns the first one encountered.
> This is consistent with other sort-stability preserving tools such as
> sorted(iterable, key=keyfunc)[0] and heapq.nsmallest(1, iterable, key=keyfunc)."*
> (max: *"If multiple items are maximal, the function returns the first one
> encountered."* … `sorted(iterable, key=keyfunc, reverse=True)[0]`)
> `heapq.nlargest`: *"Equivalent to: sorted(iterable, key=key, reverse=True)[:n]."*

### Thread safety — full `list` section, `library/threadsafety.html` (3.14)

Adds to §12: *"All of the above operations avoid acquiring per-object locks. They do
not block concurrent modifications. Other operations that hold a lock will not block
these from observing intermediate states."* · *"All other operations from here on block
using the per-object lock."* · *"Writing a single item via lst[i] = x is safe to call
from multiple threads and will not corrupt the list."* · *"The following operations
return new objects and appear atomic to other threads: lst1 + lst2 … x * lst …
lst.copy()"* · *"Otherwise, an iterator is created which can be concurrently modified
by another thread. The same applies to inplace concatenation of a list with other
iterables when using lst += iterable."* · *"Similarly, assigning to a list slice with
lst[i:j] = iterable is safe to call from multiple threads, but iterable is only locked
when it is also a list (but not its subclasses)."* · levels: Incompatible /
Compatible / Safe on distinct objects / Safe on shared objects / Atomic —
*"Atomic … appears atomic with respect to other threads - it executes instantaneously
from the perspective of other threads. This is the strongest form of thread safety."*

`howto/free-threading-python.html`: *"Built-in types like dict, list, and set use
internal locks to protect against concurrent modifications in ways that behave
similarly to the GIL. However, Python has not historically guaranteed specific
behavior for concurrent modifications to these built-in types, so this should be
treated as a description of the current implementation, not a guarantee of current or
future behavior."* · *"It's recommended to use the threading.Lock or other
synchronization primitives instead of relying on the internal locks of built-in types,
when possible."* · *"It is generally not thread-safe to access the same iterator object
from multiple threads concurrently, and threads may see duplicate or missing
elements."*

`faq/library.html` (GIL build): *"In general, Python offers to switch among threads
only between bytecode instructions"* · *"In practice, it means that operations on
shared variables of built-in data types (ints, lists, dicts, etc) that \"look atomic\"
really are."* · atomic: `L.append(x)`, `L1.extend(L2)`, `x = L[i]`, `x = L.pop()`,
`L1[i:j] = L2`, `L.sort()` · not: `i = i+1`, `L.append(L[-1])`, `L[i] = L[j]` ·
*"Operations that replace other objects may invoke those other objects' __del__()
method when their reference count reaches zero, and that can affect things. This is
especially true for the mass updates to dictionaries and lists. When in doubt, use a
mutex!"*

### Iteration — source + tutorial

`listiter_next`: out-of-bounds sets `it_index = -1` and (GIL build) drops `it_seq` —
**an exhausted list iterator stays exhausted** even if the list grows later.
`listreviter_next`: same, walking `index - 1`. Tutorial `for` section quote +
its `users.copy().items()` / new-collection example (dict). Dict/set DO detect:
`"dictionary changed size during iteration"` (`Objects/dictobject.c`),
`"Set changed size during iteration"` (`Objects/setobject.c`) — lists have no check.

### Copies — `library/copy.html`

> *"For collections that are mutable or contain mutable items, a copy is sometimes
> needed so one can change one copy without changing the other."*
> *"Shallow copies of many collections can be made using the corresponding copy()
> method (such as list.copy(), dict.copy() or set.copy()), and of sequences (such as
> lists or bytearrays) by making a slice of the entire sequence (sequence[:]).
> However, these methods and slicing can create an instance of the base type when
> copying an instance of a subclass, whereas copy.copy() normally returns an instance
> of the same type."*
> Deep-copy problems: *"Recursive objects … may cause a recursive loop."* ·
> *"Because deep copy copies everything it may copy too much, such as data which is
> intended to be shared between copies."* · *"keeping a memo dictionary of objects
> already copied during the current copying pass"*
`stdtypes` tuple: *"If iterable is already a tuple, it is returned unchanged."*

### Memory — source + docs

`list___sizeof___impl`: `res = _PyObject_SIZE(Py_TYPE(self)) + allocated *
sizeof(PyObject *)` (GIL build) — **counts capacity, not length**.
`Include/cpython/tupleobject.h` (3.14): `PyObject_VAR_HEAD`, `Py_hash_t ob_hash;`
(*"Cached hash. Initially set to -1."*), `PyObject *ob_item[1];` — items inline, no
`allocated`. `Modules/arraymodule.c`: `array_array___sizeof___impl` = header +
`allocated * itemsize`; `array_resize` comment: *"The growth pattern is: 0, 4, 8, 16,
25, 34, 46, 56, 67, 79, ... Note, the pattern starts out the same as for lists but then
grows at a smaller rate so that larger arrays only overallocate by about 1/16th -- this
is done because arrays are presumed to be more memory critical."* ·
`"cannot resize an array that is exporting buffers"` (`BufferError`) ·
`q_getitem` returns `PyLong_FromLongLong(...)` — **a new int object per read**.
`library/array.html`: type-code table with *"Minimum size in bytes"* column (b/B 1,
u 2, w 4, h/H 2, i/I 2, l/L 4, q/Q 8, f 4, d 8) · *"The actual representation of values
is determined by the machine architecture (strictly speaking, by the C
implementation). The actual size can be accessed through the array.itemsize
attribute."* · *"When using slice assignment, the assigned value must be an array
object with the same type code; in all other cases, TypeError is raised."* · `'u'`:
*"Deprecated since version 3.3, will be removed in version 3.16: Please migrate to 'w'
typecode."* `library/tracemalloc.html`: *"The tracemalloc module is a debug tool to
trace memory blocks allocated by Python."*
