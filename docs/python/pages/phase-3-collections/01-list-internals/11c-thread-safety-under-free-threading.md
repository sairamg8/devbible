---
title: "Python 3.14 documents, for the first time, exactly which list operations are atomic without the GIL — single reads, `append`, `pop()`, `clear()` and the copy-producing operators — and everything that shifts, compares or iterates can be seen half-done"
sidebar_label: "11c · Thread safety under free threading"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [Thread Safety Guarantees](https://docs.python.org/3.14/library/threadsafety.html)
> (*Thread safety levels*, *Thread safety for list objects* — new in the 3.14 docs),
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html)
> (*Thread safety*, *Iterators*), and the Library FAQ
> [*What kinds of global value mutation are thread-safe?*](https://docs.python.org/3.14/faq/library.html#what-kinds-of-global-value-mutation-are-thread-safe).
> Documentation-validated; **no sandbox run, no free-threaded build exercised**.
> Target: **CPython 3.14** (3.14.7), default and free-threaded builds.

**Until 3.14, "is this list operation thread-safe?" was answered by folklore about the
GIL. The 3.14 documentation added a page that answers it for the free-threaded build,
operation by operation, and the answer has three tiers. A handful of operations are
*atomic*: reading `lst[i]`, `append`, `pop()` from the end, `clear()`, and the
operations that build a new list (`+`, `*`, `copy()`). Most others take the list's
per-object lock, so they will not corrupt it — but `insert`, `pop(i)`, `*=` and `sort`
modify many slots in place, and the lock-free readers (`lst[i]`, `in`, `index`,
`count`) can observe them part-way; `sort` makes the list look empty. And anything
made of two steps — check then act, read then write, iterate while someone else
writes — is never atomic in either build. The page's closing advice is the whole
chunk: *"Consider external synchronization when sharing list instances across
threads."* This chunk is the guarantee table; [11d](11d-sharing-a-list-between-threads.md)
is the patterns that make shared lists correct.**

## Scope: what the page promises, and for which build

> *"This page documents thread-safety guarantees for built-in types in Python's
> free-threaded build. The guarantees described here apply when using Python with the
> GIL disabled (free-threaded mode). When the GIL is enabled, most operations are
> implicitly serialized."*

And the free-threading HOWTO qualifies how far to lean on the internals:

> *"Built-in types like dict, list, and set use internal locks to protect against
> concurrent modifications in ways that behave similarly to the GIL. However, Python
> has not historically guaranteed specific behavior for concurrent modifications to
> these built-in types, so this should be treated as a description of the current
> implementation, not a guarantee of current or future behavior."*

> *"It's recommended to use the threading.Lock or other synchronization primitives
> instead of relying on the internal locks of built-in types, when possible."*

Two sources, slightly different registers: the thread-safety page states guarantees
for 3.14's free-threaded build; the HOWTO warns that per-operation behaviour of
built-ins has not historically been a promise. Read the table below as *what 3.14
documents* and design with explicit locks anyway.

### The vocabulary

The page defines levels, weakest to strongest — *Incompatible*, *Compatible*, *Safe on
distinct objects*, *Safe on shared objects*, *Atomic* — and the one that matters here
is the top:

> *"A function or operation that appears atomic with respect to other threads - it
> executes instantaneously from the perspective of other threads. This is the
> strongest form of thread safety."*

"Safe" in the list section means *will not corrupt the list*. "Atomic" means *no other
thread can see it half-done*. The difference is the whole of this chunk.

## The list guarantees, grouped

### Lock-free readers

> *"Reading a single element from a list is atomic"* — `lst[i]`.

> *"The following methods traverse the list and use atomic reads of each item to
> perform their function. That means that they may return results affected by
> concurrent modifications"* — `item in lst`, `lst.index(item)`, `lst.count(item)`.

> *"All of the above operations avoid acquiring per-object locks. They do not block
> concurrent modifications. Other operations that hold a lock will not block these
> from observing intermediate states."*

### Everything else takes the list's lock

> *"All other operations from here on block using the per-object lock."*

| Operation | What the page says |
|---|---|
| `lst[i] = x` | *"safe to call from multiple threads and will not corrupt the list"* |
| `lst1 + lst2`, `x * lst`, `lst.copy()` | *"return new objects and appear atomic to other threads"* |
| `lst.append(x)`, `lst.pop()` | *"only operate on a single element with no shifting required are atomic"* |
| `lst.clear()` | *"also atomic. Other threads cannot observe elements being removed."* |
| `lst.sort()` | *"not atomic. Other threads cannot observe intermediate states during sorting, but the list appears empty for the duration of the sort."* |
| `lst.insert(idx, item)`, `lst.pop(idx)`, `lst *= x` | *"may allow lock-free operations to observe intermediate states since they modify multiple elements in place"* |
| `lst.remove(x)` | *"may allow concurrent modifications since element comparison may execute arbitrary Python code (via `__eq__()`)"* |
| `lst.extend(it)`, `lst += it` | safe; the *iterable* is protected only if it is a `list`, `tuple`, `set`, `frozenset`, `dict` or dict view — *"(but not their subclasses)"* — *"Otherwise, an iterator is created which can be concurrently modified by another thread."* |
| `lst[i:j] = it` | safe; *"iterable is only locked when it is also a list (but not its subclasses)."* |

### Never atomic

> *"Operations that involve multiple accesses, as well as iteration, are never atomic."*

The page's own three examples, verbatim:

```python
# NOT atomic: read-modify-write
lst[i] = lst[i] + 1

# NOT atomic: check-then-act
if lst:
    item = lst.pop()

# NOT thread-safe: iteration while modifying
for item in lst:
    process(item)  # another thread may modify lst
```

> *"Consider external synchronization when sharing list instances across threads."*

## With the GIL: "looks atomic" is folklore with a source

For the default build, the Library FAQ is the long-standing statement:

> *"In general, Python offers to switch among threads only between bytecode
> instructions"* … *"In practice, it means that operations on shared variables of
> built-in data types (ints, lists, dicts, etc) that \"look atomic\" really are."*

It lists `L.append(x)`, `L1.extend(L2)`, `x = L[i]`, `x = L.pop()`, `L1[i:j] = L2` and
`L.sort()` as atomic, and `i = i+1`, `L.append(L[-1])` and `L[i] = L[j]` as not — plus a
caveat worth remembering: *"Operations that replace other objects may invoke those
other objects' `__del__()` method when their reference count reaches zero, and that can
affect things. This is especially true for the mass updates to dictionaries and lists.
When in doubt, use a mutex!"*

🔴 Note the one row that moves: the FAQ lists `L.sort()` as atomic under the GIL; the
free-threaded page says `sort()` is *not* atomic and the list *appears empty* to other
threads while it runs. Code that was fine for years can start seeing empty lists the
day it runs on a free-threaded interpreter. Even under the GIL the FAQ's promise is
narrower than it reads: threads switch *"between bytecode instructions"*, and a sort
whose `key=` or `__lt__` is Python code is executing bytecode mid-sort — so another
thread can be scheduled while the list is detached and see it empty there too. That
follows from the two documented mechanisms together; the FAQ does not spell it out.

## Iterators are not shareable

> *"It is generally not thread-safe to access the same iterator object from multiple
> threads concurrently, and threads may see duplicate or missing elements."*

That is a statement about one iterator used by several threads — for example, a shared
`it = iter(jobs)` that workers call `next(it)` on. The fix is a structure designed for
consumers:

> *"The queue module implements multi-producer, multi-consumer queues. It is
> especially useful in threaded programming when information must be exchanged safely
> between multiple threads. The Queue class in this module implements all the required
> locking semantics."*

## Gotchas

The compound-operation hazards — check-then-act, read-modify-write, iterating a
list others modify — are in [11d](11d-sharing-a-list-between-threads.md) with their
fixes. These two come from misreading the table itself.

**★ Symptom: after moving to the free-threaded build, a reader thread occasionally sees
an empty list that "cannot" be empty.** Cause: another thread is sorting it. Under the
GIL, `L.sort()` was listed as atomic; the 3.14 page says the list *"appears empty for
the duration of the sort"*. Fix: sort a copy and publish it under a lock:

```python
import threading

lock = threading.Lock()

def resort():
    ordered = sorted(shared_rows, key=score)   # readers still see the old order
    with lock:
        shared_rows[:] = ordered
```

**Symptom: a list extended from a custom iterable or a `list` subclass ends up with
elements that were being changed by another thread mid-extend.** Cause: `extend` only
protects the source when it is exactly `list`, `tuple`, `set`, `frozenset`, `dict` or a
dict view — *"(but not their subclasses)"*; anything else is read through an iterator
*"which can be concurrently modified by another thread."* Fix: snapshot the source
under its own synchronisation, as a plain list, then extend:

```python
with source_lock:
    batch = list(source)
target.extend(batch)
```

**Symptom: a `list` subclass shared between threads loses updates that the plain list
never lost.** Cause: the table describes the built-in methods. A subclass that
overrides `append` in Python — to count, log or validate — runs several bytecodes per
call, and the page's own extend note excludes subclasses explicitly (*"but not their
subclasses"*). Nothing makes the override atomic. Fix: guard the override with a lock,
or compose instead of subclassing:

```python
import threading

class AuditedList:
    def __init__(self):
        self._items = []
        self._lock = threading.Lock()
        self.appends = 0

    def append(self, item):
        with self._lock:
            self._items.append(item)
            self.appends += 1
```

## Interview questions

**★ Is a `list` thread-safe in free-threaded Python 3.14?**
It will not be corrupted: every mutating operation takes the list's per-object lock.
But only some operations are atomic — `lst[i]`, `append`, `pop()` with no index,
`clear()`, and the new-object operations `+`, `*` and `copy()`. Shifting operations
(`insert`, `pop(i)`, `*=`) can be observed mid-way by lock-free readers, `sort` makes
the list appear empty, and compound operations and iteration are never atomic. The
docs' own advice is external synchronisation.

**★ What is the difference between "safe" and "atomic" on the thread-safety page?**
Safe means concurrent calls will not corrupt the object — `lst[i] = x` from many
threads leaves a valid list. Atomic means the operation *"executes instantaneously
from the perspective of other threads"* — no one can observe an intermediate state.
`insert` is safe but not atomic: a concurrent `in` or `lst[i]` can see the elements
mid-shift.

**Why can `x in lst` return an answer that was never true of the list?**
Because `in`, `index` and `count` take no lock: they walk the list with an atomic read
of each item, while other threads may be inserting or removing. The page says they
*"may return results affected by concurrent modifications"*. The walk can see part of
the list before a change and part after.

**Does the GIL make list operations atomic?**
The FAQ says operations that "look atomic" are, because the interpreter switches
threads only between bytecodes — `L.append(x)`, `x = L.pop()`, `L.sort()`. It also
lists what is not: `L[i] = L[j]`, `L.append(L[-1])`, any read-then-write. And it warns
that `__del__` methods triggered by replaced objects can run arbitrary code. Under the
free-threaded build the list page is the reference instead, and it is stricter about
`sort`.

**Why is `sort()` not atomic when `clear()` is?**
`clear()` detaches the element block in one step, so other threads see either the old
contents or an empty list. `sort()` detaches the block for its whole duration — it
must, to protect itself from comparisons that mutate the list — and puts it back only
at the end. Other threads cannot see a half-sorted order, but they do see an empty
list for as long as the sort takes. [06b](06b-during-the-sort.md) has the mechanism.

**Can several threads share one iterator over a list?**
Not safely. The free-threading HOWTO says threads doing so *"may see duplicate or
missing elements"*. Give each consumer items from a `queue.Queue`, which *"implements
all the required locking semantics"*, or partition the list up front.

---

← [Safe ways to mutate while walking](11b-safe-ways-to-mutate.md) · [Topic index](README.md) · Next → [Sharing a list between threads](11d-sharing-a-list-between-threads.md)
