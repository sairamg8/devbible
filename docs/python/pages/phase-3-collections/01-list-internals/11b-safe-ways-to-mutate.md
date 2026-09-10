---
title: "Every safe way to change a list you are walking separates the thing you iterate from the thing you mutate — rebuild and slice-assign is linear and alias-safe, the index-based loops are in-place but quadratic, and a worklist belongs in a deque"
sidebar_label: "11b · Safe ways to mutate while walking"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the tutorial's
> [`for` statements](https://docs.python.org/3.14/tutorial/controlflow.html#for-statements),
> [Common sequence operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [Time complexity — `list`](https://docs.python.org/3.14/library/time-complexity.html#list),
> [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque),
> and CPython's [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_ass_slice_lock_held`). Documentation-validated; **no sandbox run, no
> timings** — costs below are the documented complexities. Target: **CPython 3.14**
> (3.14.7).

**[11](11-mutating-while-iterating.md) showed what breaks: an iterator that is only an
index, walking a list whose elements move. The tutorial's cure is one sentence —
*"loop over a copy of the collection or to create a new collection"* — and every
correct pattern is a version of it. They are not interchangeable. Building a new list
and slice-assigning it back is O(n), keeps every alias pointed at the result, and is
safe even when the new contents come from a generator over the old list, because slice
assignment materialises its right-hand side first. Iterating a copy while calling
`remove` is correct and quadratic. Walking indices backwards and deleting is in-place
and still O(n) per deletion. And when appending during the walk is the *point* — a
worklist — the structure you want is a `deque` you drain, not a list you chase.**

## The patterns, and what each costs

| Pattern | Time | Aliases see result? | Extra memory |
|---|---|---|---|
| `xs[:] = [x for x in xs if keep(x)]` | O(n) | yes | one new list, briefly |
| `xs = [x for x in xs if keep(x)]` | O(n) | **no** — rebinds the name | one new list |
| iterate `xs.copy()`, call `xs.remove(x)` | O(n) per removal → O(n²) | yes | one copy |
| backwards index loop with `del xs[i]` | O(n) per deletion → O(n²) worst | yes | none |
| `while` loop with a manual index | O(n) per deletion → O(n²) worst | yes | none |
| `deque` drained with `popleft()` | O(1) per step | n/a — a different structure | the deque |

The quadratic rows follow from the complexity table: `remove` is a linear scan plus a
shift, and `del xs[i]` is *"O(n - k)"* — every element after `i` moves.

## Rebuild, then write back

**Build a new list, then write it back if others hold the old one.** Linear, and the
only option that is also fast:

```python
xs[:] = [x for x in xs if keep(x)]      # every alias sees the filtered list
```

The comprehension runs to completion before the assignment touches `xs`, so the
iteration never sees a mutation. The same is true for a lazy right-hand side, and the
source says why — `list_ass_slice_lock_held` converts the value first:

```c
        v_as_SF = PySequence_Fast(v, "can only assign an iterable");
```

`PySequence_Fast` turns any iterable into a list or tuple *before* a single slot of
`xs` changes, so this is also safe:

```python
xs[:] = (x for x in xs if keep(x))      # generator fully consumed first
```

(`can only assign an iterable` is that call's `TypeError` message, for a right-hand
side that is not iterable at all.)

## Iterate a copy

**Iterate over a copy, mutate the original.** Correct, but each `remove` is still an
O(n) scan — [03c](03c-linear-scans-in-loops.md):

```python
for x in xs.copy():
    if not keep(x):
        xs.remove(x)
```

Reach for it when the mutation is not a plain filter — when the loop body calls
something that may itself append or remove, and you need the walk to be over a fixed
set. Note too that `remove` deletes the *first* equal element, not necessarily the one
you are looking at ([05](05-removing-and-searching.md)).

## Walk indices backwards

**Walk indices backwards and delete by index.** Deleting at `i` only shifts elements
*after* `i`, which the loop has already visited:

```python
for i in range(len(xs) - 1, -1, -1):
    if not keep(xs[i]):
        del xs[i]
```

In place, no second list — the right choice when the list is huge, deletions are rare,
and memory for a copy is the constraint. Each deletion near the front still shifts
the tail.

## Drive the index yourself

**Use an explicit index when you must mutate as you go.** You control when it
advances:

```python
i = 0
while i < len(xs):
    if not keep(xs[i]):
        del xs[i]          # do not advance: the next element moved into slot i
    else:
        i += 1
```

This is also the pattern for *inserting* during a forward walk: after an
`xs.insert(i, new)`, advance by two to step over both the insertion and the element
you were on.

## A worklist is a deque

**For a genuine worklist, use a `deque` and consume it.** Appending while draining is
then the design, not an accident, and processed items are released:

```python
from collections import deque

pending = deque([root])
while pending:
    node = pending.popleft()
    pending.extend(children(node))
```

> *"Deques support thread-safe, memory efficient appends and pops from either side of
> the deque with approximately the same O(1) performance in either direction."*

Topic 06 of this phase, **`collections`** *(not written yet)*, owns `deque`;
[03b](03b-quadratic-patterns-and-deque.md) is why a list cannot play this role.

## Gotchas

**★ Symptom: `IndexError: list index out of range` from `for i in range(len(xs)):`
with a `del xs[i]` inside.** Cause: `range(len(xs))` was computed once from the
original length; after deletions, high indices no longer exist. (The message
`list index out of range` is the literal string in `Objects/listobject.c`.) Fix:
iterate indices backwards:

```python
for i in reversed(range(len(xs))):
    if expired(xs[i]):
        del xs[i]
```

**Symptom: a BFS written as `for node in queue: queue.append(child)` runs out of
memory on a large graph.** Cause: it works — the iterator sees appended nodes — but
nothing is ever removed, so every node visited stays referenced until the loop ends.
Fix: consume from the front with a `deque`:

```python
pending = deque([start])
while pending:
    visit(pending.popleft())
```

**Symptom: the filter works in the function, but the caller still sees the removed
items.** Cause: `xs = [x for x in xs if keep(x)]` rebinds the local name; the caller's
list is untouched. Fix: slice-assign:

```python
def drop_expired(sessions):
    sessions[:] = [s for s in sessions if not s.expired]
```

**Symptom: a "fixed" loop that iterates a copy is still slow on large lists.**
Cause: the copy removed the correctness bug but not the cost — each `remove` is a
linear scan and a shift, so n removals are O(n²). Fix: one rebuild:

```python
keep_ids = set(wanted_ids)
records[:] = [r for r in records if r.id in keep_ids]
```

**Symptom: a manual-index `while` loop still skips elements.** Cause: it increments
`i` after deleting, which is exactly the bug the `for` loop had. Fix: advance only when
you keep:

```python
if drop(xs[i]):
    del xs[i]
else:
    i += 1
```

**Symptom: the backwards loop deletes the wrong elements after someone "tidied" it to
`for i, x in enumerate(reversed(xs))`.** Cause: that `i` counts from the end, not the
position in `xs`, so `del xs[i]` removes an element near the front. Fix: keep real
indices:

```python
for i in range(len(xs) - 1, -1, -1):
    if drop(xs[i]):
        del xs[i]
```

## Interview questions

**★ How do you remove items from a list while iterating over it?**
You don't iterate and mutate the same list. Build a filtered list with a comprehension
and slice-assign it back (`xs[:] = [...]`) — linear, and aliases see it. Or iterate a
copy and mutate the original, iterate indices backwards and `del`, or drive a `while`
loop with an index you advance only when you keep an element.

**Why does iterating indices in reverse make deletion safe?**
Deleting at index `i` moves only the elements after `i`, and a reverse loop has
already visited all of them. The elements it has yet to visit — indices below `i` —
do not move, so every index it will read still points at the element it expects.

**★ Which of those approaches is fastest, and why?**
Rebuilding. A comprehension is one O(n) pass, and slice-assigning the result is one
more O(n) operation. Every in-place approach deletes one element at a time, and each
deletion shifts the tail — the complexity table's O(n - k) — so many deletions add up
to O(n²). The in-place loops earn their place only when you cannot afford a second
list or deletions are rare.

**Is `xs[:] = (x for x in xs if keep(x))` safe, given the generator reads `xs`?**
Yes. Slice assignment calls `PySequence_Fast` on the right-hand side before modifying
the list, which consumes the generator into a temporary sequence while `xs` is still
unchanged. Only then are the slots replaced.

**When is appending to a list during iteration the right design?**
Almost never with a list. A worklist — BFS, a crawler frontier, retry queues — is
correct when you drain it, and a `deque` gives O(1) `popleft` and releases each item
once processed. Appending to a list you are `for`-looping over terminates only when
appending stops, and keeps every processed element alive.

**Why is `xs = [...]` inside a function not the same as `xs[:] = [...]`?**
The first creates a new list and rebinds the local name, so the caller's list — and
any other alias — is unchanged. The second mutates the list object itself, replacing
its contents, so everyone holding it sees the result.

---

← [Mutating while iterating](11-mutating-while-iterating.md) · [Topic index](README.md) · Next → [Thread safety under free threading](11c-thread-safety-under-free-threading.md)
