---
title: "Every LBYL check is a claim about the past — the gap between the look and the leap is where threads, other processes, the filesystem and attackers get to make it false"
sidebar_label: "02 · The race between look and leap"
sidebar_position: 122
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL),
> [Python support for free threading — Thread safety](https://docs.python.org/3.14/howto/free-threading-python.html#thread-safety),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict)
> (`get`, `pop`), [`threading`](https://docs.python.org/3.14/library/threading.html).
> Target: **Python 3.14**. Documentation-validated; **no timings, no sandbox run**.

**An LBYL check does not establish a fact about the operation you are about to perform.
It establishes a fact about the state as it was, at some point, before that operation —
and then your code acts as though that fact still holds. When you own the state and
nobody else can touch it, the difference is theoretical. The moment the state is shared
with another thread, another process, another machine or a hostile user, the difference
is the bug: the key was there and is gone, the directory did not exist and now does, the
path pointed at a temp file and now points at `/etc/passwd`. This is the one part of the
EAFP argument that is not a matter of taste, and it is the part the Python glossary and
the `os` documentation both spell out in writing.**

## The anatomy: three lines, and only two of them are yours

```python
if key in mapping:          # 1. the look   — reads shared state
                            # 2. the gap    — you do not control what happens here
    return mapping[key]     # 3. the leap   — assumes the look is still true
```

Line 2 is not in the source. It is the interval between two bytecode sequences, and
everything that can write to `mapping` gets a turn in it. The glossary names exactly
this snippet:

> *"In a multi-threaded environment, the LBYL approach can risk introducing a race
> condition between "the looking" and "the leaping". For example, the code, `if key in
> mapping: return mapping[key]` can fail if another thread removes key from mapping after
> the test, but before the lookup. This issue can be solved with locks or by using the
> EAFP approach."*

Two fixes, and they are not equivalent in cost. A lock closes the gap by making the pair
of operations exclusive; EAFP closes it by **deleting the gap** — there is only one
operation left, so there is nothing to interleave with.

```python
# Fix A — a lock, which you must remember to take on every path that touches mapping.
with mapping_lock:
    if key in mapping:
        return mapping[key]

# Fix B — one operation. No lock, no gap, nothing to forget.
try:
    return mapping[key]
except KeyError:
    return default

# Fix C — one operation with the fallback built in. Shortest correct form.
return mapping.get(key, default)
```

## Threads: what the interpreter protects, and what it never did

The free-threaded build makes the race easier to hit, and 3.14's free-threading HOWTO is
precise about what is and is not covered:

> *"The free-threaded build of CPython aims to provide similar thread-safety behavior at
> the Python level to the default GIL-enabled build. Built-in types like `dict`, `list`,
> and `set` use internal locks to protect against concurrent modifications in ways that
> behave similarly to the GIL. However, Python has not historically guaranteed specific
> behavior for concurrent modifications to these built-in types, so this should be
> treated as a description of the current implementation, not a guarantee of current or
> future behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives
> instead of relying on the internal locks of built-in types, when possible."*

Read that carefully, because it is the whole thread story for this topic. The internal
locks protect **an operation**. `if k in d` is one operation and `d[k]` is another; no
internal lock has ever spanned a pair, in either build, and the documentation explicitly
declines to promise anything about concurrent modification even for the single ones. So:

- **Read-then-read** (`in` then `[]`) — the gap is real, and EAFP removes it entirely.
- **Read-modify-write** (`d[k] = d[k] + 1`) — 🔴 **EAFP does not fix this.** Turning the
  guard into a `try` still leaves two operations, a read and a write, with a gap between
  them; two threads can both read `4` and both write `5`. What fixes it is a lock, or an
  operation the container performs in one step.

```python
import threading
from collections import Counter

counts_lock = threading.Lock()
counts: dict[str, int] = {}

# 🔴 Broken in both builds, and EAFP would not help: read and write are two operations.
def bump_broken(key: str) -> None:
    counts[key] = counts.get(key, 0) + 1

# Correct: the lock spans the pair.
def bump(key: str) -> None:
    with counts_lock:
        counts[key] = counts.get(key, 0) + 1

# 🔴 NOT a fix. A Counter reads and writes too — the short line hides the same pair.
tally = Counter()
def bump_counter(key: str) -> None:
    tally[key] += 1

# Correct without a lock: give each thread its own tally, and merge on the owning thread.
def worker(keys: list[str]) -> Counter:
    local = Counter()
    for key in keys:
        local[key] += 1      # single-threaded; nothing else can reach `local`
    return local             # the caller merges: total.update(local)
```

The middle example is the one to internalise: `Counter[key] += 1` looks atomic because it
is one short line, and it is a read followed by a write like any other. No container
documents item-level atomicity, and the free-threading HOWTO's advice is explicitly to
use a lock rather than rely on a container's internals. So when a count must be shared,
either take the lock across the pair or remove the sharing — a per-thread `Counter` merged
at the end has no gap at all, because nothing else can reach it while it is being
updated.

## Gotchas

**★ Symptom: `KeyError` from `del d[key]` inside `if key in d:`, or from `d[key]` inside
`if key in d:` — rarely, and only in the threaded worker.** Cause: the read-then-write
gap the glossary names. Fix: one operation, with the fallback in the call.

```python
d.pop(key, None)            # instead of: if key in d: del d[key]
value = d.get(key, default) # instead of: if key in d: value = d[key]
```

**★ Symptom: a counter is short by a few counts under load, and rewriting the guard as
`try`/`except` did not help.** Cause: this is read-modify-write, not read-then-read —
`counts[k] = counts.get(k, 0) + 1` is two operations in *either* style, and both threads
can read the same value before either writes. Fix: hold a lock across the pair, or move
the aggregation somewhere built for it (a per-thread dict merged at the end, or a
`queue.Queue` consumed by one thread).

```python
with counts_lock:
    counts[key] = counts.get(key, 0) + 1
```

**Symptom: "we added a lock and it still races."** Cause: the lock covers one of the code
paths that touches the state; a second path — a background refresher, a signal handler, a
different module — takes it not at all, or takes it for the look and releases before the
leap. Fix: the lock must span the *pair*, and every path must take it; if that is hard to
prove, prefer the single-operation form that needs no lock at all.

**Symptom: an `if` guard was added to "avoid the exception", and the exception still
appears in logs — now rarer, and with a traceback nobody recognises.** Cause: the guard
narrowed the window rather than closing it, so the failure became infrequent and moved
into whatever code the check let through. Fix: accept that the operation is the check;
keep the handler, delete the guard.

**Symptom: code relies on `dict` being "thread-safe" because it read that somewhere.**
Cause: the free-threading HOWTO's description of internal locks was read as a guarantee,
which it explicitly refuses to be — *"not a guarantee of current or future behavior"* —
and in any case covers single operations only. Fix: treat container internals as an
implementation detail, and use `threading.Lock` when two operations must be one.

**Symptom: a `Counter` or `defaultdict` shared across threads drifts.** Cause: `+= 1` on
an item is a read and a write however short the line is, and neither container documents
item-level atomicity. Fix: lock the update, or give each thread its own counter and merge
at the end — `Counter.update` on a per-thread result is one operation on the owner's
object.

## Interview questions

**★ What is a TOCTOU bug, and how does it relate to EAFP?**
Time-of-check to time-of-use: a program tests a condition and then performs an operation
that assumes the test still holds, and something changes the state in between. LBYL
*is* the TOCTOU shape — a check, a gap, a use. EAFP is one of the two documented fixes
(the other being a lock) because it removes the gap rather than guarding it: there is a
single operation, and the failure is handled where it happens.

**★ Does the GIL protect `if key in d: return d[key]`?**
No, and it never did. The GIL — and, in the free-threaded build, `dict`'s internal
locks — protect *individual* operations. A membership test and a subscript are two
operations, and a thread switch between them is exactly what the glossary's warning
describes. The free-threading HOWTO adds that even single-operation behaviour *"should be
treated as a description of the current implementation, not a guarantee"*, and recommends
`threading.Lock` over relying on container internals.

**★ Rewriting a check as `try`/`except` fixes a read-then-read race. Which race does it
not fix?**
Read-modify-write. `d[k] = d[k] + 1`, `balance -= amount`, "load the JSON, append, save
it" — all remain two or more operations, and no exception handler makes them one. Those
need mutual exclusion (a lock, a transaction, a compare-and-set) or an API that performs
the whole update in one step. Recognising which of the two shapes you have is the
difference between a fix and a placebo.

**Two threads, one dict, and you must both look and act. What are your options, ranked?**
First, find the single operation that does the job: `get` with a default, `pop` with a
default, `setdefault`, or a `defaultdict`/`Counter` structure that makes the miss a
non-event. Second, if the update genuinely reads and writes, take a `threading.Lock`
across the pair — the free-threading HOWTO recommends exactly this over relying on
internal locks. Third, restructure so the shared state has one owner: worker threads
send messages through a `queue.Queue` and a single consumer mutates the dict, which
removes the race by removing the sharing.

**Did the free-threaded build make this worse?**
It made it easier to observe, not newly incorrect. The gap between two operations existed
under the GIL too — a thread switch could always land there — but with true parallelism
the interleaving happens far more often, so latent LBYL races surface as bugs instead of
as folklore. The HOWTO's aim is *"similar thread-safety behavior at the Python level to
the default GIL-enabled build"*, which is precisely a promise about single operations and
not about your pairs. Free-threaded Python as a runtime property is
[phase 0's](../../phase-0-runtime/README.md) subject.

**Why does the glossary offer a lock and EAFP as alternative fixes, when they do very
different things?**
Because both make the pair indivisible, by opposite routes. A lock keeps two operations
and forbids anyone else from interleaving with them; EAFP deletes one of the operations so
there is nothing to interleave with. The second is cheaper and impossible to forget,
which is why it is preferred where it applies — but it only applies when the work truly
is one operation. When it is not, the lock is not optional.

---

← Prev: [Why Python leans EAFP](01b-why-python-leans-eafp.md) · Index: [EAFP vs LBYL](README.md) · Next → [The filesystem and the atomic flag](02b-the-filesystem-and-the-atomic-flag.md)
