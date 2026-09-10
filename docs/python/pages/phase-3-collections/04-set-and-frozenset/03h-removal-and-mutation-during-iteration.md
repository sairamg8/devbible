---
title: "Removing from a set has three spellings and three failure modes — `remove()` raises where `discard()` does not, `pop()` has no order, a check-then-act across threads is not atomic, and a loop that removes from the set it iterates raises only when the size changes"
sidebar_label: "3h · Removal and mutation mid-loop"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) (the
> `remove`/`discard`/`pop` rows), [thread safety for set objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects),
> the [free-threading HOWTO](https://docs.python.org/3.14/howto/free-threading-python.html) — and
> CPython v3.14.7 `Objects/setobject.c`, marked *implementation detail* wherever the docs are silent.
> Split out of [3g · Subclassing `set` does not intercept mutation](03g-subclassing-set-does-not-intercept-mutation.md)
> on a concept boundary. Documentation-verified — **no sandbox run, no program output**.

**Removing one element has three spellings with three different failure modes, and only one of them
is safe to call when you do not know whether the element is there. Across threads, each
single-element operation is safe and any test-then-act pair is not. And removing elements from a
set while a `for` loop walks it is detected only when the size changes — a loop that removes one
element and adds another is not detected at all.**

## Removing one element: `remove`, `discard`, `pop`

> | Method | Documented as |
> |---|---|
> | `remove(elem, /)` | *"Remove element elem from the set. Raises `KeyError` if elem is not contained in the set."* |
> | `discard(elem, /)` | *"Remove element elem from the set if it is present."* |
> | `pop()` | *"Remove and return an arbitrary element from the set. Raises `KeyError` if the set is empty."* |
>
> — [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

Use `remove` when absence is a bug you want to hear about, `discard` when absence is fine. `pop`
returns *"an arbitrary element"* — not the oldest, not the newest, not the smallest; in 3.14.7 it
scans the table from a saved position (`so->finger`, implementation detail), which says nothing
useful about which element you get. An empty set raises `KeyError` with the message
`pop from an empty set` (`set_pop_impl`).

A set is not a queue. When order of processing matters, keep the order in a `deque` and use the set
only for the membership test it is good at:

```python
from collections import deque
from collections.abc import Callable, Iterable


def crawl(start: str, links_of: Callable[[str], Iterable[str]]) -> list[str]:
    queue = deque([start])
    seen = {start}
    visited: list[str] = []
    while queue:
        url = queue.popleft()               # first in, first out
        visited.append(url)
        for nxt in links_of(url):
            if nxt not in seen:             # the set answers only "have we queued this before?"
                seen.add(nxt)
                queue.append(nxt)
    return visited
```

### Across threads

The thread-safety page makes single-element mutation safe and composite operations unsafe:

> *"Adding or removing a single element is safe to call from multiple threads and will not corrupt
> the set:"* — `s.add(elem)`, `s.remove(elem)`, `s.discard(elem)`, `s.pop()`

> *"Operations that involve multiple accesses, as well as iteration, are never atomic:"* — with the
> examples `if elem in s: s.remove(elem)` (*"NOT atomic: check-then-act"*) and
> `for elem in s: process(elem)` (*"NOT thread-safe: iteration while modifying"*) —
> [thread safety for set objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects)

That section, unlike the dict one, prints no corrected version. The fixes below are derived from the
documented guarantees and from the HOWTO's advice — *"It's recommended to use the `threading.Lock`
or other synchronization primitives instead of relying on the internal locks of built-in types, when
possible"* ([free-threading HOWTO](https://docs.python.org/3.14/howto/free-threading-python.html)):

```python
import threading

_claimed: set[str] = set()
_claimed_lock = threading.Lock()


def claim(job_id: str) -> bool:
    """True for exactly one caller per job id, however many threads race for it."""
    with _claimed_lock:
        if job_id in _claimed:
            return False
        _claimed.add(job_id)
        return True


def drain(pending: set[str]) -> list[str]:
    """Take everything; another thread may empty the set between checks, so ask forgiveness."""
    taken: list[str] = []
    while True:
        try:
            taken.append(pending.pop())     # one documented single-element operation
        except KeyError:                    # empty now, whoever emptied it
            return taken
```

## Mutation during iteration

A set iterator remembers the set's size when it starts and compares it on every step. In 3.14.7 a
mismatch raises `RuntimeError: Set changed size during iteration` and the iterator stays broken
afterwards (`setiter_iternext`, *"Make this state sticky"*). **Only the size is compared.** A loop
body that removes one element and adds another leaves the size unchanged, the check passes, and the
loop carries on over a table that has changed underneath it. The set documentation says nothing
about what such a loop visits — it may skip elements or see the new one — so treat it as undefined.

```python
from collections.abc import Callable


def drop_expired(session_ids: set[str], is_expired: Callable[[str], bool]) -> None:
    for sid in session_ids:
        if is_expired(sid):
            session_ids.discard(sid)        # size changed: the next step raises RuntimeError


def normalise_in_place(emails: set[str]) -> None:
    for email in emails:
        clean = email.strip().casefold()
        if clean != email:
            emails.discard(email)
            emails.add(clean)               # size unchanged: no error, and no defined result
```

The fix is always to finish reading before you start writing — decide what changes, then apply it
in one operation:

```python
from collections.abc import Callable


def drop_expired(session_ids: set[str], is_expired: Callable[[str], bool]) -> None:
    session_ids -= {sid for sid in session_ids if is_expired(sid)}   # the comprehension finishes first


def normalise_in_place(emails: set[str]) -> None:
    cleaned = {email.strip().casefold() for email in emails}
    emails.clear()                          # keep the same object: callers hold references to it
    emails.update(cleaned)
```

When another thread may be mutating the set, iterate a snapshot: *"The `copy()` method returns a
new object and holds the per-object lock for the duration so that it is always atomic"*
([thread safety for set objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-set-objects)),
so `for sid in session_ids.copy():` walks a consistent set and never trips the size check.

## Gotchas

**★ Symptom: `RuntimeError: Set changed size during iteration` from a cleanup loop.** Cause: the
loop body removes from the set it is iterating. Fix: collect first, then remove in one operation —
`session_ids -= {...}` above — or iterate `session_ids.copy()`.

**★ Symptom: `KeyError` from a cleanup step that runs twice, or from a handler whose element another
code path already removed.** Cause: `remove()` raises when the element is absent. Fix: `discard()`
when absence is acceptable.

```python
active_connections.discard(conn_id)
```

**★ Symptom: under the free-threaded build, two workers both process the same job.** Cause:
`if job_id not in claimed: claimed.add(job_id)` is check-then-act, which the thread-safety page
lists as *"NOT atomic"*. Fix: hold a `threading.Lock` across the check and the add — `claim()`
above.

**Symptom: an in-place normalisation loop runs without error and leaves some elements
un-normalised.** Cause: discard-then-add keeps the size constant, so the iterator's size check
cannot see the mutation, and what it visits afterwards is undefined. Fix: compute the new contents
first — `normalise_in_place` above.

**Symptom: a job runner that pulls work with `pending.pop()` starves some jobs or processes them in
an order nobody can explain.** Cause: `pop()` returns *"an arbitrary element"*. Fix: a `deque` for
order and a set for "seen" — `crawl()` above.

**Symptom: `KeyError: 'pop from an empty set'` from `while pending: pending.pop()` on a shared set.**
Cause: the truth test and the `pop` are two accesses; another thread emptied the set between them.
Fix: pop until `KeyError` — `drain()` above.

## Interview questions

**★ Why does removing elements from a set inside `for x in s` raise, and when does it not?**
The iterator records the set's size and checks it on every step; if the size differs it raises
`RuntimeError` and stays broken. That check only sees size. Removing one element and adding another
keeps the size the same and goes undetected, and the documentation does not say what the loop will
then visit. So the absence of an error does not mean the loop was correct. Build the change set
first and apply it afterwards.

**★ What is the difference between `remove()`, `discard()` and `pop()`?**
`remove(x)` deletes `x` and raises `KeyError` if it is absent; `discard(x)` deletes it if present
and does nothing otherwise; `pop()` deletes and returns an arbitrary element and raises `KeyError`
on an empty set. Choose `remove` when absence means a bug, `discard` when it does not, and never
`pop` when you care which element you get.

**Is `if x in s: s.remove(x)` safe across threads? What is?**
No. The thread-safety page lists it verbatim as *"NOT atomic: check-then-act"* — another thread can
remove `x` between the test and the call, and `remove` then raises. `s.discard(x)` is a single
documented operation and is safe on its own. When you need to act on the outcome — "only one worker
may claim this job" — hold a `threading.Lock` across the test and the mutation; the free-threading
HOWTO recommends locks over relying on the built-ins' internal locking.

---

← Prev: [Subclassing set does not intercept mutation](03g-subclassing-set-does-not-intercept-mutation.md) · [Topic index](README.md) · Next → [Dedupe and what it destroys](04-dedupe-and-what-it-destroys.md)
