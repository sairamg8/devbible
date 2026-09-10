---
title: "Everything after the index you touched has to move, so the cost of `insert`, `pop` and `del` is a function of how far from the end you reached"
sidebar_label: "03 · The O(n) shift"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list)
> (footnote [2]),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`ins1`, `list_pop_impl`, `list_ass_slice_lock_held`).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**A list has no holes. Every element from index 0 to `len - 1` occupies a
consecutive slot, and that invariant is maintained by physically moving pointers
whenever the length changes anywhere but the end. So `insert(k, x)` and `pop(k)` are
not "O(n)" — they are O(n - k), and the difference between `k = len(xs)` and `k = 0`
is the difference between free and a full block move. This chunk shows the moves in
CPython's own source, then reads the documentation footnote that states the rule
precisely enough to quote in a code review.**

## The rule, from the docs

> *"Popping or deleting the element at index k of a list of size n shifts all
> elements after k one slot to the left, moving n - k - 1 elements; inserting at
> index k shifts the elements from k onwards one slot to the right, moving n - k
> elements. The worst case is index 0, where the whole rest of the list has to be
> moved; the average case, an index in the middle of the list, takes O(n/2) = O(n)
> operations; and operating at the end of the list moves nothing and is O(1)."*

Three regimes, and the middle one is the one people forget exists:

| Where you touch | Elements moved | Cost |
|---|---|---|
| The end — `append`, `pop()`, `del xs[-1]` | 0 | O(1) |
| The middle — `insert(n//2, x)`, `pop(n//2)` | ~n/2 | O(n) |
| The front — `insert(0, x)`, `pop(0)`, `del xs[0]` | n - 1 | O(n), worst case |

## The moves, in source

### `insert` — a backwards loop

`list.insert` and the C-API `PyList_Insert` both call `ins1`:

```c
    if (list_resize(self, n+1) < 0)
        return -1;
    ...
    items = self->ob_item;
    for (i = n; --i >= where; )
        FT_ATOMIC_STORE_PTR_RELAXED(items[i+1], items[i]);
    FT_ATOMIC_STORE_PTR_RELEASE(items[where], Py_NewRef(v));
```

Grow by one, then walk *backwards* from the end down to the insertion point copying
each pointer one slot right, then write the new pointer into the hole. The loop runs
`n - where` times. When `where == n` — an append — the loop body never executes.

That is the whole reason `append` is a separate fast path and `insert(len(xs), x)`
is documented as its equivalent: *"`a.insert(len(a), x)` is equivalent to
`a.append(x)`."*

### `pop` — a `memmove` and a resize

```c
        if ((size_after_pop - index) > 0) {
            memmove(&items[index], &items[index+1], (size_after_pop - index) * sizeof(PyObject *));
        }
        status = list_resize(self, size_after_pop);
```

`pop()` with no argument uses the default index `-1`, which normalises to the last
slot, which makes `size_after_pop - index` zero — no `memmove` at all. `pop(0)` moves
every remaining pointer.

### Slice assignment and `del` — the same `memmove`, in both directions

`xs[i:j] = t` and `del xs[i:j]` are one function, `list_ass_slice_lock_held`. It
computes `d = len(t) - (j - i)`, the change in length, and then:

- `d < 0` — `memmove` the tail *left*, then shrink.
- `d > 0` — grow, then `memmove` the tail *right*.
- `d == 0` — no shift at all; it just overwrites the slots in place.

That last case is exactly why the complexity table gives slice assignment two costs:
**O(j - i) if the replacement is the same length, otherwise O(n - i + len(t))**. A
same-length slice assignment is local; a length-changing one shifts everything after
`i`.

There is one more detail in that function worth knowing about, because it explains a
class of re-entrancy bug:

```c
    /* Because [X]DECREF can recursively invoke list operations on
       this list, we must postpone all [X]DECREF activity until
       after the list is back in its canonical shape.  Therefore
       we must allocate an additional array, 'recycle', into which
       we temporarily copy the items that are deleted from the
       list. :-( */
    PyObject *recycle_on_stack[8];
```

Dropping the removed elements can run arbitrary `__del__` code, which could touch
this very list — so CPython parks the removed pointers in a side buffer and only
releases them once the list is consistent again. If you have ever wondered whether a
`__del__` can observe a half-updated list: not through this path.

## Two spellings that mean the same thing

The `stdtypes` docs define most mutable-sequence methods in terms of slice
assignment, which is a good way to remember the costs:

> *"`sequence.append(value, /)` — … This is equivalent to writing
> `seq[len(seq):len(seq)] = [value]`."*

> *"`sequence.insert(index, value, /)` — … This is equivalent to writing
> `sequence[index:index] = [value]`."*

> *"`sequence.clear()` — … This is equivalent to writing `del sequence[:]`."*

> *"`sequence.extend(iterable, /)` — … For the most part, this is the same as
> writing `seq[len(seq):len(seq)] = iterable`."*

Read `insert(0, x)` as `xs[0:0] = [x]` and the shift becomes visible in the syntax:
you are replacing a zero-length slice at the very front with a one-element one, so
`d = 1` and the entire tail moves right.

## Negative indices do not change the cost

`xs.pop(-1)` is cheap and `xs.pop(-len(xs))` is expensive, because the index is
normalised first and then the shift is computed from the resolved position:

```c
    if (index < 0)
        index += Py_SIZE(self);
```

So `-1` becomes `n - 1` (nothing after it to move) and `-n` becomes `0` (everything
after it to move). The sign tells you nothing about the price; the resolved distance
from the end does.

## Gotchas

### `insert(0, x)` used to build a list in reverse
**Symptom.** A function that "reverses while building" is fine for hundreds of items
and unusable for tens of thousands.
**Cause.** Each `insert(0, …)` moves every existing element. n inserts move
`0 + 1 + 2 + … + (n-1)` pointers — quadratic.
**Fix.** Append and reverse once, or append and iterate backwards:

```python
out = []
for item in source:
    out.append(transform(item))
out.reverse()                 # one linear pass, in place
```

`list.reverse()` swaps from both ends toward the middle, so it is a single O(n) pass
with no allocation — the docs note it *"maintains economy of space when reversing a
large sequence."*

### `del xs[0]` inside a `while` loop as a queue
**Symptom.** A worker that drains a backlog gets slower the bigger the backlog is,
in a way that looks like the *items* got more expensive.
**Cause.** Every removal from the front is O(n). Draining n items costs O(n²).
**Fix.** Use the structure designed for it — named here, taught in topic 06:

```python
from collections import deque

queue = deque(initial_items)
while queue:
    handle(queue.popleft())      # O(1) at the left end
```

### Removing elements while scanning with `remove()`
**Symptom.** A dedupe or filter routine that is quadratic *twice over*.
**Cause.** `remove(x)` scans to find the element (O(n)) and then deletes at that
index (O(n - k)). Calling it in a loop multiplies both.
**Fix.** Rebuild in one pass:

```python
xs[:] = [x for x in xs if keep(x)]     # one scan, one write-back, in place
```

The `xs[:] = …` form matters when other names refer to the same list — it mutates
rather than rebinding. See [10](10-copies-and-aliasing.md).

### Slice assignment that silently changes length in a loop
**Symptom.** A "patch a few rows" routine degrades as the list grows, even though
each patch touches only one element.
**Cause.** `xs[i:i+1] = [a, b]` changes the length by one, so the whole tail after
`i` shifts. Same-length assignment does not.
**Fix.** Keep replacements the same length, or collect the edits and apply one
rebuild:

```python
xs[i] = new                                  # same length, no shift
xs[:] = [patch(x) if needs(x) else x for x in xs]   # one pass for many edits
```

### Assuming `pop()` and `pop(0)` are the same operation with a different argument
**Symptom.** A LIFO/FIFO switch made by "just changing the index", followed by a
performance regression nobody attributes to it.
**Cause.** They are the same *method* with wildly different costs — O(1) versus
O(n). The complexity table writes the cost as O(n - k) precisely so this is visible.
**Fix.** If the access pattern is FIFO, change the type, not the index:

```python
stack = []                    # LIFO: append / pop() — both O(1)
queue = deque()               # FIFO: append / popleft() — both O(1)
```

### Reading `del xs[i:j]` as cheap because it "just deletes"
**Symptom.** Trimming from the middle of a large list in a loop is slower than
expected.
**Cause.** The table gives `del l[i:j]` as **O(n - i)** — the tail after the deleted
range has to close the gap, no matter how small the range is.
**Fix.** Delete a *suffix* when you can (nothing follows it, so nothing moves), or
batch middle deletions into a single rebuild:

```python
del xs[n:]                                    # suffix: no shift
xs[:] = [x for i, x in enumerate(xs) if i not in drop]   # one pass
```

## Interview questions

**★ Why is `list.insert(0, x)` O(n) when `list.append(x)` is O(1)?**
Because a list is a contiguous array with no gaps. Inserting at index `k` has to
move every element from `k` onward one slot to the right — `n - k` pointers. At the
end, `n - k` is zero and nothing moves; at the front it is the whole list. CPython's
`ins1` shows it as a literal backwards loop from `n` down to the insertion point.

**★ Is `list.pop(0)` really O(n)? It only removes one element.**
Yes. Removing the element is trivial; *closing the hole* is not. The docs spell it
out: popping at index `k` *"shifts all elements after k one slot to the left, moving
n - k - 1 elements"*. In CPython that is a single `memmove` of the whole tail, which
is fast per byte and still linear in the length.

**A colleague changed `stack.pop()` to `stack.pop(0)` to make it a queue. What
happens?**
The semantics become FIFO and the cost per operation goes from O(1) to O(n), so
draining the structure goes from linear to quadratic. It will pass every test and
fall over in production at scale. The correct change is the type, not the index:
`collections.deque` with `append`/`popleft`, which the docs describe as having
*"approximately the same O(1) performance in either direction"*.

**When is slice assignment cheap and when is it not?**
Cheap when the replacement has the same length as the slice — the elements are
overwritten in place and nothing shifts, so it is O(j - i). Expensive when the
length changes, because the tail after `i` has to move: the table gives
**O(n - i + len(t))**. The same function handles `del xs[i:j]`, which is a
length-changing assignment with an empty replacement, hence O(n - i).

**Does using a negative index make `pop` cheaper?**
No — the index is normalised to a non-negative position first (`index += Py_SIZE(self)`
in `list_pop_impl`), and the cost follows from the resolved position. `pop(-1)`
happens to be the cheapest case because it resolves to the last slot; `pop(-n)`
resolves to 0 and is the most expensive.

**Why does `list.reverse()` not cost the same as reversing by repeated
`insert(0, …)`?**
Because it swaps pairs from both ends inward — one pass, `n/2` swaps, no allocation
and no length change, which is why the docs say it *"maintains economy of space"*.
Building a reversed list with `insert(0, …)` performs a full tail shift per element
and is quadratic. If you want a reversed *view* rather than a reversed list, use
`reversed(xs)`, which is lazy and copies nothing.

**Why does CPython copy removed elements into a `recycle` buffer during slice
deletion?**
Because releasing a removed element can run arbitrary Python — a `__del__`, or a
weakref callback — which could re-enter and mutate the same list. Its comment says
*"we must postpone all [X]DECREF activity until after the list is back in its
canonical shape"*. The practical guarantee for you is that user code never observes
the list mid-shift through that path.

---

← [Shrinking and preallocation](02b-shrinking-and-preallocation.md) · [Topic index](README.md) · Next → [Quadratic patterns, and the queue you should not build from a list](03b-quadratic-patterns-and-deque.md)
