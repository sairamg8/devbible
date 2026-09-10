---
title: "`pop`, `remove`, `del` and `clear` take things out by different means, raise different exceptions, and only one of them hands the element back"
sidebar_label: "05 · Removing from a list"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> the tutorial [More on Lists](https://docs.python.org/3.14/tutorial/datastructures.html#more-on-lists),
> [Thread Safety Guarantees — list objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-list-objects),
> and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_pop_impl`, `list_remove_impl`, `list_index_impl`, `list_ass_slice_lock_held`).
> Documentation-validated; **no sandbox run; error strings quoted from the CPython
> source, not from a run**. Target: **CPython 3.14** (3.14.7).

**Four ways to take something out of a list, and they differ in what you have to
know. `pop` needs an index and gives you the element back. `remove` needs a value and
gives you nothing. `del` needs an index or a slice and is a statement rather than a
method. `clear` takes everything. Two of them raise, and they raise *different*
exceptions for reasons that are worth internalising — one failed to resolve a
position, the other failed to find a value.**

## The removal family

| Call | Takes | Returns | Raises when |
|---|---|---|---|
| `xs.pop()` | nothing (index `-1`) | the element | list is empty |
| `xs.pop(k)` | an index | the element | index out of range |
| `xs.remove(v)` | a value | `None` | value not present |
| `del xs[k]` | an index | — (statement) | index out of range |
| `del xs[i:j]` | a slice | — (statement) | never; empty slices are legal |
| `xs.clear()` | nothing | `None` | never |

The docs define two of these in terms of the others, which is worth keeping:

> *"`sequence.clear()` — Remove all items from sequence. This is equivalent to
> writing `del sequence[:]`."*

> *"`sequence.pop(index=-1, /)` — Retrieve the item at index and also remove it from
> sequence. By default, the last item in sequence is removed and returned."*

> *"`sequence.remove(value, /)` — Remove the first item from sequence where
> `sequence[i] == value`. Raises `ValueError` if value is not found in sequence."*

Read `remove`'s definition carefully: **the first item where `sequence[i] == value`**
— not "all of them", and not "the object you passed". It removes one, by equality.

## The error strings

These are the literal string constants in `Objects/listobject.c` — quoted from the
source, not reproduced from a run:

| String | Raised by | Type |
|---|---|---|
| `pop from empty list` | `list_pop_impl` | `IndexError` |
| `pop index out of range` | `list_pop_impl` | `IndexError` |
| `list.remove(x): x not in list` | `list_remove_impl` | `ValueError` |
| `list.index(x): x not in list` | `list_index_impl` | `ValueError` |
| `can only assign an iterable` | slice assignment | `TypeError` |

Knowing which exception each raises is the difference between a correct `try` and a
bare `except` that swallows real bugs:

```python
try:
    task = queue.pop()
except IndexError:          # empty, not "missing" — IndexError, not ValueError
    task = None

try:
    xs.remove(target)
except ValueError:          # not present — ValueError, not KeyError
    pass
```

⚠️ `pop` raising `IndexError` and `remove` raising `ValueError` is not arbitrary: one
failed to resolve a *position*, the other failed to find a *value*. `pop from empty
list` even exists as a separate message from `pop index out of range` because the
source special-cases it — its comment reads *"Special-case most common failure
cause"*.

## `remove` runs arbitrary Python

`list_remove_impl` is a plain loop calling `PyObject_RichCompareBool(obj, value, Py_EQ)`
on each element. If your elements define `__eq__`, that is *your* code running once
per element until a match:

```python
class Row:
    def __eq__(self, other):
        return self.fetch_from_db() == other.fetch_from_db()   # per comparison!
```

Three consequences:

- **The scan is not bounded by C speed.** An expensive `__eq__` makes `remove`,
  `index`, `count` and `in` expensive per element.
- **`__eq__` can mutate the list.** It runs while `remove` is iterating by index, and
  nothing prevents it appending or deleting. See [11](11-mutating-while-iterating.md).
- **`__eq__` can raise.** `remove` propagates it, and the list is left exactly as it
  was — nothing has been removed, because the removal happens only after a match.

The 3.14 thread-safety page names the same hazard for the free-threaded build:

> *"The `remove()` method may allow concurrent modifications since element comparison
> may execute arbitrary Python code (via `__eq__()`)."*

## Deleting a slice is one operation, not many

`del xs[i:j]` goes through the same function as slice assignment and performs a
single block move of the tail. That makes it dramatically better than a loop of
`del xs[i]`:

```python
del xs[10:5000]        # ONE tail shift
for i in range(4990):  # 4990 tail shifts — do not do this
    del xs[10]
```

And a *suffix* delete moves nothing at all, because there is no tail to close up:

```python
del xs[n:]             # truncate — no element movement
```

There is one implementation detail in that function worth knowing, because it rules
out a class of re-entrancy bug:

```c
    /* Because [X]DECREF can recursively invoke list operations on
       this list, we must postpone all [X]DECREF activity until
       after the list is back in its canonical shape.  Therefore
       we must allocate an additional array, 'recycle', into which
       we temporarily copy the items that are deleted from the
       list. :-( */
    PyObject *recycle_on_stack[8];
```

Releasing the removed elements can run a `__del__` or a weakref callback, which could
re-enter and touch this very list. CPython parks the removed pointers in a side
buffer and only drops them once the list is consistent again.

## Gotchas

### `xs.remove(v)` removing only the first match
**Symptom.** After "removing the bad rows", some bad rows remain.
**Cause.** The documented behaviour is *"Remove the first item from sequence where
`sequence[i] == value`"* — one item, not all matches.
**Fix.** Rebuild in one pass instead of looping `remove`:

```python
xs[:] = [x for x in xs if x != v]     # all matches, one scan, in place
```

### Catching the wrong exception around `pop`
**Symptom.** A `ValueError` handler that never fires, or a bare `except` that hides a
genuine bug.
**Cause.** `pop` on an empty list raises `IndexError` (`pop from empty list`), not
`ValueError`. `remove` raises `ValueError`.
**Fix.** Catch what is actually raised, and keep the handler narrow:

```python
try:
    item = stack.pop()
except IndexError:
    return None
```

### `while xs: xs.remove(x)` as a "remove all" loop
**Symptom.** An infinite loop, or a `ValueError` after the last match.
**Cause.** `remove` raises when the value is gone, and the loop condition tests
emptiness rather than presence.
**Fix.** Filter once; do not loop a linear operation:

```python
xs[:] = [item for item in xs if item != x]
```

### `del xs[i]` inside a forward loop over `xs`
**Symptom.** Every other matching element survives the delete.
**Cause.** The iterator holds an index that keeps advancing while the list shrinks
underneath it. This is documented behaviour, not a bug —
[11](11-mutating-while-iterating.md) covers it in full.
**Fix.** Build a new list, or iterate a copy:

```python
xs[:] = [x for x in xs if keep(x)]
```

### `if lst: item = lst.pop()` across threads
**Symptom.** An intermittent `IndexError: pop from empty list` in code that clearly
checks for emptiness first.
**Cause.** Check-then-act is two operations. The 3.14 thread-safety page lists this
exact snippet under *"Operations that involve multiple accesses, as well as
iteration, are never atomic."*
**Fix.** Do not check — attempt and handle, which is one atomic operation plus an
exception:

```python
try:
    item = lst.pop()
except IndexError:
    item = None
```

### Emptying a list with `xs = []` in a function
**Symptom.** The caller's list is untouched.
**Cause.** Rebinding a local name does nothing to the object.
**Fix.** Mutate the object the caller holds:

```python
def drain(xs):
    xs.clear()        # or: del xs[:] — both empty the caller's list
```

### A loop of `del xs[i]` to remove a contiguous range
**Symptom.** A trim that is fine on hundreds of elements and slow on thousands.
**Cause.** Each `del` shifts the whole tail. The complexity table gives `del l[k]` as
O(n - k), so m deletes cost O(m·n).
**Fix.** Delete the range in one statement:

```python
del xs[start:stop]      # one shift, O(n - start)
```

## Interview questions

**★ `xs.remove(v)` versus `del xs[k]` versus `xs.pop(k)` — when do you use each?**
`remove` when you know the *value* and not the position; it scans with `==`, removes
the first match, returns `None`, and raises `ValueError` if there is no match. `pop`
when you know the position *and* want the element back — it returns it and raises
`IndexError` if the index is invalid. `del` when you know the position and do not
want the element; it is a statement, and it is the only one of the three that also
takes a slice.

**★ Can `list.remove` execute your code?**
Yes. It compares each element with `PyObject_RichCompareBool(obj, value, Py_EQ)`,
which dispatches to `__eq__`. If your elements define `__eq__` — a dataclass, an ORM
model, a mock — that runs once per element until a match. It can be slow, it can
raise, and in principle it can mutate the very list being scanned. The 3.14
thread-safety page calls this out: *"element comparison may execute arbitrary Python
code (via `__eq__()`)."*

**How do you remove every occurrence of a value?**
One pass, written back in place: `xs[:] = [x for x in xs if x != v]`. Looping
`remove` is O(n) per call plus a shift per call, raises when the value runs out, and
gets the "every other element" bug if you try to do it while iterating. The
slice-assignment form also matters when the list is shared — it mutates the object
rather than rebinding the name.

**Why does `pop` on an empty list raise `IndexError` rather than `ValueError`?**
Because the failure is about a *position*, not a value: there is no index `-1` in an
empty list. `remove` fails to find a *value*, which is what `ValueError` means. The
two messages in CPython — `pop from empty list` and `pop index out of range` — are
even separated so the common case gets a clearer message; the source comment says
*"Special-case most common failure cause"*.

**Is `if xs: item = xs.pop()` safe?**
Single-threaded, yes. Across threads, no — the 3.14 thread-safety page lists exactly
that snippet as a non-atomic check-then-act, because another thread can empty the
list between the truth test and the `pop`. The atomic version is to attempt the
`pop` and catch `IndexError`. Note that `pop()` with no argument *is* itself listed
as atomic; it is the pairing with the check that is not.

**`del xs[i:j]` versus a loop of `del xs[i]` — is there a real difference?**
Yes, a large one. Slice deletion computes the length change once and performs a
single block move of the tail, so it is O(n - i) in total. A loop of single deletions
shifts the tail once per element, so it is O(m·n). The same asymmetry is why
`xs[:] = [...]` beats repeated `remove`.

**What guarantees do you have about a list while elements are being released?**
That user code cannot observe a half-shifted list through the slice-deletion path.
CPython copies the removed pointers into a `recycle` buffer and defers releasing them
*"until after the list is back in its canonical shape"*, precisely because a `__del__`
or weakref callback could re-enter and call list operations.

---

← [Repetition and lazy combination](04b-repetition-and-lazy-combination.md) · [Topic index](README.md) · Next → [Searching, identity and reversing](05b-searching-identity-and-reversing.md)
