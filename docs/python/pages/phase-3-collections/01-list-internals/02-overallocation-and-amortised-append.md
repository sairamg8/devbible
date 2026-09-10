---
title: "`append` is cheap because CPython buys spare slots in advance, and the word that makes that honest is amortised — one append in a long run pays for a full copy"
sidebar_label: "02 · Over-allocation and amortised append"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list),
> the Programming FAQ
> [How are lists implemented in CPython?](https://docs.python.org/3.14/faq/design.html#how-are-lists-implemented-in-cpython),
> and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_resize`). Documentation-validated; **no sandbox run, no timings, no
> measured byte counts**. Target: **CPython 3.14** (3.14.7).

**A list never grows by exactly one slot. When the pointer block runs out, CPython
allocates a block roughly one-eighth larger plus a small constant, so the next
several appends are pure stores with no allocation at all. That is why the docs can
write O(1) next to `append` — but they write it with a footnote, and the footnote is
the part that matters at 2am: any individual append can still be O(n), because that
is the one that pays for everyone else's cheap ones.**

## The FAQ says what happens; the source says how much

> *"When items are appended or inserted, the array of references is resized. Some
> cleverness is applied to improve the performance of appending items repeatedly;
> when the array must be grown, some extra space is allocated so the next few times
> don't require an actual resize."*

That is the documented guarantee, and it stops there deliberately: *how much* extra
space is an implementation detail with no promise attached. Here is the detail, from
`list_resize` in CPython 3.14:

```c
    /* This over-allocates proportional to the list size, making room
     * for additional growth.  The over-allocation is mild, but is
     * enough to give linear-time amortized behavior over a long
     * sequence of appends() in the presence of a poorly-performing
     * system realloc().
     * Add padding to make the allocated size multiple of 4.
     * The growth pattern is:  0, 4, 8, 16, 24, 32, 40, 52, 64, 76, ...
     */
    new_allocated = ((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3;
```

Read the expression: **new capacity ≈ requested + requested/8 + 6, rounded down to a
multiple of 4.** That is a growth factor of about **1.125**, not 2 and not 1.5.

🔴 **Do not teach the pattern as a rule.** It is a source comment in one version of
one implementation, and it has changed: earlier CPython grew as
`0, 4, 8, 16, 25, 35, 46, 58, 72, 88, …` with a different constant. Nothing in the
language reference guarantees any of it. What *is* stable and quotable is the
consequence the comment states itself — *"enough to give linear-time amortized
behavior over a long sequence of appends"*.

There is a second clause immediately after, and it is the reason a single large
`extend` does not leave a huge hole:

```c
    /* Do not overallocate if the new size is closer to overallocated size
     * than to the old size.
     */
    if (newsize - Py_SIZE(self) > (Py_ssize_t)(new_allocated - newsize))
        new_allocated = ((size_t)newsize + 3) & ~(size_t)3;
```

If you jump the size by a lot in one call, CPython declines to add proportional
slack on top — it assumes the caller knew the size, and allocates roughly what was
asked for.

## Why a mild factor still gives amortised O(1)

Growing by a *constant* number of slots would be O(n²) over n appends: each resize
copies the whole block, and you would do n/c of them. Growing by a *proportion*
makes the resizes exponentially rarer as the list gets longer. Whether the factor is
2 or 1.125 changes the constant, not the class — with factor `f`, the total work
across n appends is bounded by `n · f/(f-1)`, a constant multiple of n.

A smaller factor trades a little more copying for a lot less wasted memory. CPython
chose the memory side, and said so: *"The over-allocation is mild."* Since a typical
Python process holds an enormous number of small lists, that is the right trade for
the language even though `std::vector` made the opposite one.

## What one resize actually costs

`list_resize` calls `PyMem_Realloc` on the pointer block. Three outcomes, none of
which you can observe from Python:

1. **The allocator extends in place.** Nothing moves. Cheapest case.
2. **The allocator moves the block.** Every pointer is copied to the new address —
   O(n) memory traffic, though no Python-level work: no refcount changes, no
   `__init__`, no comparisons. It is a `memcpy` of `n` machine words.
3. **Allocation fails.** `MemoryError`, and the list is left intact.

🔴 It is a copy of **pointers**, never of the objects. Doubling the capacity of a
list holding a million dictionaries copies a million addresses, not a million
dictionaries. This is why "list resize" is far cheaper than people fear, and still
worth avoiding inside a latency-critical section.

## The one place the resize is observable: `MemoryError` timing

A list that fits comfortably in memory can still fail to append, because the resize
briefly needs the old block *and* the new one at the same time. On a
memory-constrained box that is a real failure mode, and its symptom is a
`MemoryError` from an innocuous-looking `append` rather than from the code that
allocated the data. There is no fix inside the list; the fix is to not build the
whole list — stream it, or bound it.

```python
# unbounded: every row of the result set has to be resident at once
rows = [transform(r) for r in cursor]

# bounded: one row resident, the aggregate is small
totals = Counter()
for r in cursor:
    totals[r.account_id] += r.amount
```

## Gotchas

### Treating amortised O(1) as a per-call guarantee
**Symptom.** A p99.9 latency spike in an append-heavy handler, invisible in the mean.
**Cause.** The complexity page says *"An individual operation may occasionally be
O(n) when the underlying storage is resized"*. One append in a run pays the copy.
**Fix.** Take the allocation out of the critical section:

```python
buf = [None] * expected      # allocate before the timer starts
for i, item in enumerate(stream):
    buf[i] = item
```

### Believing lists grow by doubling
**Symptom.** A capacity model in a design doc that over-predicts memory by a factor
of four, or a "reserve" helper that appends `n` dummy elements to force a doubling.
**Cause.** Carrying `std::vector` or `ArrayList` intuition across. CPython's factor
is roughly **1.125**, per its own `list_resize` comment.
**Fix.** Do not model it at all — the factor is undocumented and version-dependent.
If you need a known capacity, allocate it:

```python
buf = [None] * n     # exact, portable, and obvious to the next reader
```

### Benchmarking growth by watching `sys.getsizeof` in a loop
**Symptom.** A table of capacities that does not match another machine, another
build, or the next Python release.
**Cause.** The growth pattern is a source comment, not an interface. Free-threaded
builds even allocate the element array through a different code path.
**Fix.** There is no fix that makes those numbers portable — so do not publish them.
Cite the mechanism and CPython's own comment, and let the reader measure their own
build if the constant genuinely matters:

```python
# Correct claim: appends are amortised O(1) because capacity grows proportionally.
# Incorrect claim: "a list of 9 elements has capacity 16 on every Python."
```

### Building a giant list to then iterate it once
**Symptom.** `MemoryError` on an `append`, or RSS tracking the input size when the
output is a single number.
**Cause.** Every element is retained until the list dies, *and* a resize
transiently needs both blocks.
**Fix.** Do not materialise what you only traverse:

```python
total = sum(price(r) for r in cursor)     # generator: one row live at a time
```

### `xs += [item]` in a loop instead of `xs.append(item)`
**Symptom.** Extra garbage and an allocation per iteration in a hot loop.
**Cause.** `+=` on a list calls `list.__iadd__`, which extends in place — but the
right-hand `[item]` is itself a freshly built one-element list that is created and
discarded every iteration.
**Fix.** Append the item, not a list containing it:

```python
xs.append(item)          # no temporary list
xs.extend(batch)         # when you really do have many items
```

## Interview questions

**★ Why is `list.append` amortised O(1) rather than O(1)?**
Because the pointer block has a fixed capacity, and when it fills, CPython allocates
a larger one and copies. That copy is O(n) and happens on *one* append. Because the
new capacity is proportional to the current size, the resizes get exponentially
rarer, so n appends cost O(n) in total and the average is constant. The
documentation is careful about this: *"An individual operation may occasionally be
O(n) when the underlying storage is resized, but this cost is spread over many
operations."*

**★ By how much does a CPython list grow when it resizes?**
Roughly one-eighth of the requested size plus a small constant, rounded to a
multiple of four — the source expression is
`((size_t)newsize + (newsize >> 3) + 6) & ~(size_t)3`, and the comment gives the
pattern `0, 4, 8, 16, 24, 32, 40, 52, 64, 76, ...`. The right answer in an interview
adds the caveat: that is CPython 3.14's implementation detail, it has changed before,
and no documentation guarantees it. The guaranteed part is the *amortised* behaviour.

**Why not just double, like `std::vector`?**
Doubling wastes up to half the allocation. CPython explicitly chose a mild factor —
its comment says *"The over-allocation is mild, but is enough to give linear-time
amortized behavior"*. Any growth factor greater than 1 gives amortised O(1); the
factor only changes the constant and the memory overhead. Since Python programs hold
enormous numbers of small lists, the memory side wins.

**What does a list resize copy — the elements or the pointers?**
The pointers. The element block is an array of `PyObject *`, and a resize is a
`realloc` of that array, which at worst copies n machine words. No Python code runs,
no refcounts change, no objects are duplicated. This is why resizing a list of a
million large objects is much cheaper than intuition suggests.

**Could an `append` raise `MemoryError` on a list that already fits in memory?**
Yes. A resize that has to move the block needs the old and the new allocation live
at the same time. On a constrained machine the peak, not the steady state, is what
fails — and the traceback points at the innocent `append` rather than at the code
that decided to materialise everything.

**If growing by a constant number of slots is O(n²), why is that not obvious in
small tests?**
Because the quadratic term only dominates past a size threshold. Ten thousand
constant-step resizes on a short list are invisible; ten million are not. The same
shape of surprise governs string concatenation in a loop, which the docs call out as
*"quadratic runtime cost in the total sequence length"* — the fix there is
`str.join`, and the fix here is proportional growth, which CPython already does for
you.

---

← [The complexity table](01b-the-complexity-table.md) · [Topic index](README.md) · Next → [Shrinking, and allocating the right size once](02b-shrinking-and-preallocation.md)
