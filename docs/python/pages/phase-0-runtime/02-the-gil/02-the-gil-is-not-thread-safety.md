---
title: "The GIL is not thread safety: your threaded counter is still wrong, and every check-then-act is still a race"
sidebar_label: "2 · Not thread safety"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14
> [glossary entry for *global interpreter lock*](https://docs.python.org/3.14/glossary.html#term-global-interpreter-lock),
> [`threading`](https://docs.python.org/3.14/library/threading.html),
> [Python support for free threading § Thread safety](https://docs.python.org/3.14/howto/free-threading-python.html),
> and [`sys.setswitchinterval`](https://docs.python.org/3.14/library/sys.html#sys.setswitchinterval).
> Version spine: **Python 3.14.7**.

**"We don't need a lock, Python has the GIL" is the most expensive sentence in
Python concurrency. The GIL guarantees that each individual bytecode
instruction and each interpreter-internal structure stays coherent. It
guarantees nothing whatsoever about a *sequence* of instructions, and every
interesting operation in your program is a sequence. A threaded counter loses
increments. A cache computes the same value twice. A balance check passes for
two withdrawals. None of these corrupt anything — they produce perfectly valid
wrong answers, which is worse than a crash because nothing tells you it
happened. This chunk is the diagnosis;
[the next one](03-making-threaded-code-correct.md) is the remedy, in code.**

## The counter, which is the whole argument

```python
import threading

counter = 0

def bump():
    global counter
    for _ in range(1_000_000):
        counter += 1          # NOT atomic

threads = [threading.Thread(target=bump) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()

# counter is very unlikely to be 4_000_000
```

`counter += 1` is not one operation. It compiles to: **load** the global,
**add** one, **store** the global. A thread can lose the GIL between the load
and the store — the switch interval fires, or a C call yields — and another
thread then loads the same stale value. When the first thread stores, one
increment is gone.

Note precisely what "not atomic" does and does not mean here. `counter` never
becomes a corrupted integer; it is always a valid Python `int`. It is just the
*wrong* valid integer. There is no exception, no warning, and no log line.

## Every check-then-act has the same hole

```python
if key not in cache:            # two threads can both pass this
    cache[key] = expensive()    # ...both compute, one result is discarded

if account.balance >= amount:   # both threads see enough money
    account.balance -= amount   # ...and the account goes negative

if not os.path.exists(path):    # classic TOCTOU
    os.makedirs(path)           # raises FileExistsError under a race

if self._client is None:        # lazy singleton
    self._client = Client()     # two clients, two connection pools

items = list(shared)            # snapshot
if items:                       # decision made on a stale snapshot
    process(items[0])           # ...another thread already took it
```

The shape is always the same: **read state, decide, act** — with a preemption
point between the decision and the action. The GIL narrows the window to
microseconds, which is exactly why these bugs survive testing and then appear
under production load, on the busiest day, once.

Three properties make them nasty to debug:

- **They are load-dependent.** The window only matters when two threads are
  genuinely in flight at once, which correlates with traffic.
- **They leave no trace.** A lost increment and a legitimately smaller count
  look identical in a metric.
- **They are unreproducible locally.** One developer, one request, no
  concurrency, no bug.

## What *is* atomic, and why you must not rely on it

Some operations complete within a single bytecode and therefore cannot be
interrupted: `d[k] = v`, `lst.append(x)`, `x = y`, `d.setdefault(k, v)`. It is
tempting to build on this, and there is a long tradition of "atomic operations
in Python" lists circulating on the internet.

Do not. Three reasons:

1. **It is not documented as a guarantee.** The free-threading guide is
   explicit about built-in containers: *"Python has not historically guaranteed
   specific behavior for concurrent modifications to these built-in types, so
   this should be treated as a description of the current implementation, not a
   guarantee of current or future behavior."* And the recommendation attached
   to it: *"It's recommended to use the `threading.Lock` or other
   synchronization primitives instead of relying on the internal locks of
   built-in types, when possible."*
2. **It changes.** Which operations are a single bytecode is a compiler detail,
   and the compiler changes between minor versions — 3.11 and 3.12 both
   reshaped instruction families.
3. **The set is uselessly small.** Almost nothing you actually want to do —
   increment, check-then-set, move an item between containers, keep two related
   fields consistent — is one operation. Designing on accidental atomicity puts
   you one requirement change away from a race.

The correct posture: assume nothing is atomic, take the lock, and note that an
uncontended `threading.Lock` acquisition is cheap enough that it is almost never
the thing making your program slow.

## Free threading turns these from rare into reproducible

The GIL does not make these bugs impossible; it makes their windows small. On
the free-threaded build ([chunk 6](06-free-threading.md)) two threads can be
inside your check-then-act *simultaneously*, so a race that fired once a month
fires immediately.

State this as a positive: **code that breaks on the free-threaded build was
already broken.** Free threading is, among other things, an excellent race
detector for existing code. Running a test suite under it is informative for a
team that has no intention of shipping on it — the failures it produces are
real bugs with narrower windows on the default build.

## The mental model to keep

> The GIL is a lock around the *interpreter*. Your invariants need a lock
> around *your data*. Those are different locks, and only one of them is
> provided for you.

Anything that reads state and then acts on it needs to hold something for the
whole span. Anything that does not share mutable state needs nothing at all —
which is why the best fix is usually to stop sharing, not to guard the sharing.

## Gotchas

**Symptom:** a threaded counter, hit counter or accumulator produces a total lower than it should, non-deterministically
**Cause:** `x += 1` compiles to load-add-store; the GIL can be released between those bytecodes and a concurrent update is lost
**Fix:** wrap the read-modify-write in a `threading.Lock`, or remove the sharing entirely by accumulating per-thread and summing at the end — both shown in [the next chunk](03-making-threaded-code-correct.md). The GIL guarantees no corruption, not atomicity

**Symptom:** a shared `list` or `dict` mutated from several threads produces missing or duplicated items but never crashes
**Cause:** individual container operations are protected, so the structure stays valid — but your multi-step logic around them is not
**Fix:** lock the logical operation, not the container access. "It didn't crash" is precisely the wrong signal to take reassurance from

**Symptom:** an internet list of "atomic operations in Python" was used to justify removing locks, and a race appears after a Python upgrade
**Cause:** which operations are a single bytecode is an undocumented compiler detail that changes between versions, and the docs say built-in type behaviour under concurrency is a description of the implementation and not a guarantee
**Fix:** take the lock. An uncontended `Lock` acquire is nanoseconds; the debugging session it prevents is days

**Symptom:** a bug reproduces only in production, only at peak, and never under test
**Cause:** the classic signature of a GIL-narrowed race — the window is microseconds wide, so you need real concurrency to hit it
**Fix:** stress the code path with many threads and a low `sys.setswitchinterval()` *in a test only*, or run the suite on the free-threaded build, which widens the windows dramatically

**Symptom:** two threads update two related fields (`total` and `count`) and a reader observes them inconsistent
**Cause:** each assignment may be atomic individually; the *pair* is not, so a reader can observe the state between them
**Fix:** guard the pair with one lock, or store them as a single immutable object and rebind the name in one assignment — readers then see either the whole old pair or the whole new one

**Symptom:** a metric or audit total is slightly off and nobody can explain the discrepancy
**Cause:** lost updates. Because the value is always valid, there is nothing in the data to indicate a race happened
**Fix:** treat "slightly and inconsistently wrong aggregate" as a concurrency signature. Audit every shared read-modify-write in the path

**Symptom:** code that "works because of the GIL" breaks on the free-threaded 3.14 build
**Cause:** it was relying on the accidental serialisation of a check-then-act sequence. Without the GIL, the window widens from microseconds to genuinely concurrent
**Fix:** it was a bug all along; free threading just made it reproducible. Fix it, and consider running the suite under that build deliberately as a race detector

**Symptom:** a `defaultdict` grows entries nobody meant to create, and it is blamed on threading
**Cause:** unrelated to the GIL — `d[k]` on a `defaultdict` *inserts*. Threads only make it surface faster because more code paths touch more keys
**Fix:** use `d.get(k)` for reads. Listed here because it is routinely misdiagnosed as a concurrency bug and wastes a day

## Interview questions

**★ Does the GIL make my code thread-safe?**
No, and this is the most consequential misunderstanding about it. The GIL
guarantees that individual bytecode instructions and the interpreter's internal
structures stay coherent. It says nothing about sequences of instructions.
`counter += 1` is load, add, store — a thread can lose the GIL between them and
an increment is lost, silently, producing a valid but wrong number. Every
check-then-act pattern has the same hole. You still need a `threading.Lock` for
any invariant that spans more than one operation.

**★ Show me a bug the GIL does not prevent.**
Four threads each incrementing a shared global a million times. The result is
reliably less than four million, because `counter += 1` is three bytecodes with
preemption points between them. Nothing is corrupted — the value is always a
valid integer — it is just wrong, with no error raised. That silence is the
important part: a crash would at least tell you something happened.

**★ What is the difference between "the GIL makes `list.append` thread-safe" and "the GIL makes my list usage thread-safe"?**
The first is roughly true and the second is false. `list.append` completes as
one interpreter operation, so the list will not end up corrupted and no item
will be half-written. But "check whether the list has fewer than N items, then
append" is two operations with a preemption point between them, and two threads
can both pass the check. Thread safety is a property of your logical operation,
not of the primitive you built it from.

**★ Someone says "we don't need locks, Python has the GIL." What do you say?**
That the GIL protects the interpreter, not their invariants, and hand them the
counter example. Then add the forward-looking argument: the code relies on an
implementation detail CPython is actively removing, so it will break on the
free-threaded build — and the documentation explicitly says built-in type
behaviour under concurrent modification is a description of the current
implementation rather than a guarantee. An uncontended lock acquire costs
nanoseconds and removes an entire class of bug that otherwise appears as
unreproducible data corruption at 3am.

**Which Python operations are atomic, and should you rely on that?**
Some — a simple assignment, `list.append`, `dict.__setitem__`,
`dict.setdefault` — complete within a single bytecode and cannot be
interrupted. You should not rely on it. The set is undocumented, it changes as
the compiler changes, and the free-threading guide says explicitly that
built-in container behaviour under concurrent modification is a description of
the current implementation and not a guarantee. It is also uselessly small: an
increment, a move between containers, or any two-field update is not in it.

**What changes about these bugs on the free-threaded build?**
Nothing about whether they are bugs; everything about how often they fire.
Under the GIL two threads cannot be inside your check-then-act at literally the
same instant, so the window is narrow and the race is rare. Without it, they
can, so a race that used to fire once a month fires immediately. That makes the
free-threaded build a genuinely useful race detector for existing code, even
for a team with no intention of shipping on it.

**How would you go looking for this class of bug in an existing codebase?**
Grep for the shape rather than for a keyword: augmented assignment to anything
module-level or on a shared object; `if ... in`/`is None`/`>=` immediately
followed by a write to the thing that was checked; lazy initialisation of
clients and pools; and any `os.path.exists` followed by a filesystem
modification. Then check whether each of those runs on more than one thread —
including threads you did not create, such as a web framework's worker pool or
a library's background thread.

---

← Prev: [What the GIL is](01-what-the-gil-is.md) · Index: [The GIL](README.md) · Next → [Making threaded code correct](03-making-threaded-code-correct.md)
