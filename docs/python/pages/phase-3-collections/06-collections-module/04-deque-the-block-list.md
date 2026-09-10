---
title: "A deque is a doubly-linked list of 64-slot blocks, so both ends are O(1) because nothing ever moves — and the same layout makes the middle O(n), slicing impossible, and insert, remove and del three rotations in disguise"
sidebar_label: "04 · deque — the block list underneath"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.deque`](https://docs.python.org/3.14/library/collections.html#deque-objects) (constructor, methods, the indexed-access sentence, recipes), the tutorial's [Using lists as queues](https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-queues), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html) (which has **no** deque table). Layout, costs and error strings read from CPython **v3.14.7** [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) — **implementation detail** wherever the docs give only "O(1) at both ends, O(n) in the middle". Target: **Python 3.14.7**. **No sandbox run, no timings.**

**A `list` is one contiguous array, which is why `xs[i]` is instant and `xs.pop(0)` has to shift every remaining pointer one slot left. A `deque` makes the opposite trade. CPython stores it as a doubly-linked list of fixed blocks of 64 pointers; appending or popping at either end writes one slot in the end block, occasionally links or frees a block, and never moves another element — the source says this *"assures that appends or pops never move any other data elements besides the one being appended or popped."* That is the whole reason to use one: both ends are O(1). The same layout is why the middle is slow — reaching index *i* means walking from the nearer end one block at a time — why there is no slicing, and why `insert`, `del d[i]` and `remove` are implemented by rotating the deque until the target is at an end. Use a deque for anything consumed from the front; keep a list for anything you index, slice or sort.**

## What the documentation promises

> *"Deques are a generalization of stacks and queues (the name is pronounced "deck" and is short for
> "double-ended queue"). Deques support thread-safe, memory efficient appends and pops from either
> side of the deque with approximately the same *O*(1) performance in either direction."*

> *"Though `list` objects support similar operations, they are optimized for fast fixed-length
> operations and incur *O*(*n*) memory movement costs for `pop(0)` and `insert(0, v)` operations which
> change both the size and position of the underlying data representation."*

> *"Indexed access is *O*(1) at both ends but slows to *O*(*n*) in the middle. For fast random access,
> use lists instead."*

That is all the documentation says about cost — the 3.14 time-complexity page has tables for `list`, `tuple`, `dict`, `set`, the string types, `memoryview` and `range`, and none for `deque`. Everything finer below is read from the C source.

## The layout

```c
/* Modules/_collectionsmodule.c, v3.14.7 */
#define BLOCKLEN 64

typedef struct BLOCK {
    struct BLOCK *leftlink;
    PyObject *data[BLOCKLEN];
    struct BLOCK *rightlink;
} block;
```

The deque object records the leftmost and rightmost block and an index into each. `append` writes at `rightblock->data[rightindex + 1]` and only allocates when the right block is full; `popleft` reads `leftblock->data[leftindex]`, advances the index, and frees the block when it empties. The source comment gives the design reasoning:

> *"Textbook implementations of doubly-linked lists store one datum per link, but that gives them a
> 200% memory overhead (a prev and next link for each datum) and it costs one malloc() call per data
> element. By using fixed-length blocks, the link to data ratio is significantly improved and there
> are proportionally fewer calls to malloc() and free(). The data blocks of consecutive pointers
> also improve cache locality."*

> *"Another advantage is that it completely avoids use of realloc(), resulting in more predictable
> performance."*

A list grows by reallocating and copying its whole array (amortised O(1), occasionally O(*n*) — [2 · Over-allocation and amortised append](../01-list-internals/02-overallocation-and-amortised-append.md)); a deque never copies. Each deque also keeps up to 16 empty blocks on a private free list (`MAXFREEBLOCKS 16`) so a queue that fills and drains at a steady rate stops calling the allocator.

## The cost table, read from the source

| Operation | Cost | Why (v3.14.7) |
|---|---|---|
| `append`, `appendleft`, `pop`, `popleft` | O(1) | one slot written or read; a block linked or freed at most |
| `d[0]`, `d[-1]` | O(1) | special-cased in `deque_item_lock_held` |
| `d[i]`, `d[i] = x` | O(min(*i*, *n*−*i*) / 64) block hops | walks from whichever end is nearer (`if (index < (Py_SIZE(deque) >> 1))`) |
| `insert(i, x)`, `del d[i]`, `remove(x)` | O(min(*i*, *n*−*i*)) pointer moves, done twice | rotate the target to an end, act there, rotate back |
| `rotate(k)` | O(min(\|*k*\|, *n*−\|*k*\|)) | `k` is first reduced modulo `n` into `[-n/2, n/2]` |
| `x in d`, `count(x)`, `index(x)` | O(*n*) | linear scan calling `==` |
| `extend(it)`, `extendleft(it)` | O(len(*it*)) | one append per item |
| `len(d)` | O(1) | stored size |
| `copy()`, `clear()`, `reverse()`, iteration | O(*n*) | |

The rotation trick is stated in the source: *"insert(), remove(), and delitem() are implemented in terms of rotate() for simplicity and reasonable performance near the end points. If for some reason these methods become popular, it is not hard to re-implement this using direct data movement … and achieve a performance boost (by moving each pointer only once instead of twice)."* The documentation's own recipe for deleting by index is the same algorithm in Python:

```python
def delete_nth(d, n):
    d.rotate(-n)
    d.popleft()
    d.rotate(n)
```

## Where a deque replaces a list

**A work queue drained from the front** — the tutorial says it outright: *"To implement a queue, use `collections.deque` which was designed to have fast appends and pops from both ends."*

```python
from collections import deque
from dataclasses import dataclass


@dataclass
class Job:
    job_id: str
    payload: bytes


def drain(pending: deque[Job]) -> None:
    while pending:
        job = pending.popleft()          # FIFO: oldest first, O(1)
        process(job)
```

`pop()` takes from the *right*. A queue drained with `pop()` is a stack — newest first — and under load the oldest jobs starve. FIFO is `append` + `popleft`; LIFO is `append` + `pop`, which a plain list already does in O(1).

**Breadth-first traversal** — the frontier grows at the back and is consumed at the front ([11b · Safe ways to mutate while walking](../01-list-internals/11b-safe-ways-to-mutate.md) has the worklist argument):

```python
def reachable(graph: dict[str, list[str]], start: str) -> set[str]:
    seen = {start}
    frontier = deque([start])
    while frontier:
        node = frontier.popleft()
        for neighbour in graph.get(node, []):
            if neighbour not in seen:
                seen.add(neighbour)
                frontier.append(neighbour)
    return seen
```

**Round-robin between sources** — the documentation's recipe keeps iterators in a deque, takes from position zero, and `rotate(-1)`s the one it just used to the back:

```python
def roundrobin(*iterables):
    "roundrobin('ABC', 'D', 'EF') --> A D E B F C"
    iterators = deque(map(iter, iterables))
    while iterators:
        try:
            while True:
                yield next(iterators[0])
                iterators.rotate(-1)
        except StopIteration:
            # Remove an exhausted iterator.
            iterators.popleft()
```

That is the shape of a fair scheduler over tenant queues: each tenant's work is an iterator, and no tenant gets two turns in a row.

**Where a list stays right** — anything indexed in the middle, sliced, sorted, or binary-searched. A deque has no `sort()`, no slicing ([6 · Slices that do not copy](../05-slicing/06-slices-that-do-not-copy.md) — `d[1:3]` is a `TypeError`), and `d[i]` in the middle walks blocks.

## The API differences that bite in a port from `list`

```python
from collections import deque

recent = deque(["a", "b"])

recent + ["c"]              # TypeError: can only concatenate deque (not "list") to deque
recent += ["c"]             # fine — += is extend, and accepts any iterable
recent + deque(["d"])       # fine — a new deque

recent.extendleft("xy")     # deque(['y', 'x', 'a', 'b', 'c']) — each item is appended LEFT, so reversed
recent == ["y", "x", "a", "b", "c"]   # False — a deque only compares equal to a deque
list(recent) == ["y", "x", "a", "b", "c"]   # True
```

The error text is `deque_concat_lock_held`'s: `"can only concatenate deque (not \"%.200s\") to deque"`. The equality rule is `deque_richcompare`, which returns `NotImplemented` unless both operands are deques — and the documentation's own example of `extendleft` is the note *"the series of left appends results in reversing the order of elements in the iterable argument"*.

Other differences, each a one-liner: empty `pop`/`popleft` raise `IndexError("pop from an empty deque")`; `remove` of an absent value raises `ValueError("deque.remove(x): x not in deque")`; there is no `sort()`, so it is `deque(sorted(d))`; `reverse()` is in place and returns `None`, like `list.reverse`.

## Gotchas

**★ Symptom: a job queue processes the newest jobs first and old jobs time out under load.** Cause: the consumer calls `pop()`, which removes from the right — the same end `append` adds to. Fix: consume from the other end.

```python
job = pending.popleft()
```

**★ Symptom: a loop over a large deque by index is dramatically slower than the same loop over a list.** Cause: `d[i]` for a middle `i` walks block links from the nearer end, so `for i in range(len(d)): d[i]` is quadratic. Fix: iterate the deque directly, or convert once if you truly need positions.

```python
for position, job in enumerate(pending):
    inspect(position, job)
```

**★ Symptom: `TypeError: sequence index must be integer, not 'slice'` from `recent[-10:]`.** Cause: a deque does not implement slicing. Fix: `islice` from the front, or copy to a list for arbitrary windows.

```python
from itertools import islice

first_ten = list(islice(recent, 10))
last_ten = list(recent)[-10:]
```

**★ Symptom: a test comparing a deque to an expected list always fails, even when the contents match.** Cause: `deque == list` is `False` — `deque_richcompare` only compares deques with deques. Fix: compare like with like.

```python
assert list(queue) == ["a", "b", "c"]
```

**Symptom: `TypeError: can only concatenate deque (not "list") to deque`.** Cause: binary `+` requires a deque on both sides. Fix: extend in place, or make the right side a deque.

```python
queue.extend(new_jobs)
```

**Symptom: items added with `extendleft(batch)` come out in reverse order.** Cause: `extendleft` performs one `appendleft` per item. Fix: reverse the input to keep its order at the front.

```python
queue.extendleft(reversed(urgent_batch))
```

**Symptom: an `AttributeError` for `.sort()` after a list was swapped for a deque.** Cause: a deque has no in-place sort. Fix: sort into a new deque, or use a list if the data is sorted repeatedly.

```python
queue = deque(sorted(queue, key=lambda job: job.job_id))
```

**Symptom: removing cancelled jobs with `queue.remove(job)` in a loop makes cancellation of a large batch slow.** Cause: each `remove` scans for the value and then rotates it out — O(*n*) per call, O(*n*·*m*) for *m* removals. Fix: rebuild once.

```python
cancelled_ids = {job.job_id for job in cancelled}
pending = deque(job for job in pending if job.job_id not in cancelled_ids)
```

**Symptom: a deque kept in sorted order with `index` and `insert` gets slower as it grows.** Cause: there is no binary search on a deque, and `index` is a linear scan while `insert` in the middle is two rotations. Fix: keep sorted data in a `list` and use `bisect` — topic [07 · `heapq` and `bisect`](../07-heapq-and-bisect/README.md).

```python
import bisect

deadlines: list[float] = []
bisect.insort(deadlines, new_deadline)      # O(log n) search, then an O(n) pointer shift
```

**Symptom: `IndexError: pop from an empty deque` in a consumer.** Cause: popping without checking — or, across threads, checking and then popping ([04c · `deque` during iteration and across threads](04c-deque-iteration-and-threads.md)). Fix, single-threaded: loop on truthiness.

```python
while pending:
    process(pending.popleft())
```

## Interview questions

**★ How is `collections.deque` implemented, and why are both ends O(1)?**
As a doubly-linked list of fixed-size blocks — 64 object pointers each in CPython 3.14 — with an index into the leftmost and rightmost block. An append or pop at either end touches one slot in an end block and, at most, links a new block or frees an empty one; no other element moves, and there is no `realloc` of a large array. A list, by contrast, is one contiguous array, so removing or inserting at the front shifts every remaining pointer: the documentation's *"O(n) memory movement costs for `pop(0)` and `insert(0, v)`"*.

**★ When would you use a `list` instead of a `deque`?**
Whenever you access the middle: indexing, slicing, sorting, binary search. A list gives O(1) `xs[i]` and supports all of them; a deque's middle indexing walks blocks (*"slows to O(n) in the middle"*), it cannot be sliced, and it has no `sort`. As a pure stack (push and pop at one end) both are O(1) and a list is the conventional choice. The deque wins only when you add or remove at the front.

**★ Why is `d[len(d) // 2]` slow on a deque?**
Because there is no single array to offset into. CPython computes which block holds the index and follows `rightlink` pointers from the left end, or `leftlink` from the right end, whichever is nearer — so reaching the middle of an *n*-element deque takes on the order of *n*/128 block hops. The ends are special-cased and O(1). A loop that indexes every position is therefore quadratic.

**How are `insert`, `remove` and `del d[i]` implemented on a deque?**
With `rotate`. The source comment says so: rotate by `-i` so the target is at the left end, `appendleft` or `popleft` there, and rotate back by `i`. Rotation normalises the step count to at most half the length, so the cost is proportional to the distance from the nearer end — and each pointer is moved twice, which the comment acknowledges. The documentation's `delete_nth` recipe is exactly this in Python.

**Why doesn't `deque` support slicing, and what do you do instead?**
Slicing a block list would mean walking to the start index and copying out a range; CPython simply does not implement `__getitem__` for slice objects on deques, so `d[1:3]` raises `TypeError`. Use `itertools.islice(d, start, stop)` to read a window from the front without copying the whole deque, `list(d)[a:b]` for arbitrary windows, or `d.rotate` plus `popleft` for the recipe-style "slice by rotation" the documentation describes.

**Does a deque give memory back as it shrinks?**
Yes, block by block. When `pop` or `popleft` empties an end block, CPython unlinks it and either keeps it on the deque's private free list (up to 16 blocks, `MAXFREEBLOCKS`) for reuse or frees it. There is no single large array to shrink and no `realloc`, so a queue that surges and then drains returns to a footprint proportional to what it currently holds, plus at most those 16 spare blocks. The documentation says only *"memory efficient"*; the block details are CPython's and give no guaranteed figure.

**What is `rotate` for in real code?**
Moving the front item to the back without allocating: `d.rotate(-1)` is `d.append(d.popleft())`. The documentation's round-robin recipe uses it to give each iterator a turn, and its `delete_nth` recipe uses it to bring an arbitrary index to the end where removal is cheap. Rotation by *k* costs the smaller of *k* and *n*−*k* pointer moves, since CPython normalises the step modulo the length.

**What is the difference between `d + other` and `d += other` for a deque?**
`+` builds a new deque and requires `other` to be a deque — otherwise `TypeError: can only concatenate deque (not "list") to deque`. `+=` is `extend`: it mutates `d` in place and accepts any iterable. The same split exists for lists, but a list's `+` at least accepts another list; a deque's accepts only another deque.

---

← Prev: [03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md) · [Topic index](README.md) · Next → [04b · Bounded deques](04b-bounded-deques.md)
