---
title: "Lock discipline and testing for races: choosing the primitive, holding it correctly, and writing a test that actually fails"
sidebar_label: "4 · Lock discipline"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14
> [`threading` module docs](https://docs.python.org/3.14/library/threading.html)
> (`Lock`, `RLock`, `Event`, `Condition`, `Semaphore`, `Barrier`),
> [`sys.setswitchinterval`](https://docs.python.org/3.14/library/sys.html#sys.setswitchinterval),
> and [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html).
> Version spine: **Python 3.14.7**.

**Adding a lock is easy; adding the right lock, holding it for the right span,
and proving it works are three separate skills. This chunk covers all three:
which of the six `threading` primitives fits which shape of problem, the small
set of rules that prevent essentially every lock-related incident, and how to
write a concurrency test that fails on the broken implementation instead of
passing on both. That last part matters more than it sounds — a racy
implementation passes a naive threaded test almost every time, which is how
these bugs get shipped with a green build behind them.**

## Choosing the lock

| Primitive | Use it when |
|---|---|
| `threading.Lock` | The default. Cannot be reacquired by the holder — which is a feature, because it turns accidental re-entry into an immediate deadlock instead of a subtle bug |
| `threading.RLock` | The same thread must reacquire it — a public method that calls another public method. Convenient and a design smell; prefer a private unlocked helper |
| `threading.Event` | One-shot "has this happened yet" signalling between threads |
| `threading.Condition` | Wait for a state change under a lock, without polling |
| `threading.Semaphore` | Limit concurrency to N — e.g. at most 10 in-flight requests to an API |
| `threading.Barrier` | All N threads must reach a point before any continues |

Three rules that prevent most lock-related incidents:

1. **Always use `with lock:`**, never `acquire()`/`release()` by hand. An
   exception between them leaks the lock and the next acquirer deadlocks.
2. **Never call out to unknown code while holding a lock** — a callback, a user
   function, an HTTP request. You do not know what it will try to acquire.
3. **If you hold two locks, always acquire them in the same order everywhere.**
   Two code paths taking A-then-B and B-then-A is the textbook deadlock, and
   the textbook is right.

## Testing for these bugs

Racy code passes tests by default, because a test has one thread. Three
techniques actually surface it:

- **Run the operation from many threads with a barrier**, so they all start at
  the same instant rather than spreading out over the setup time.
- **Lower `sys.setswitchinterval()` inside the test** (and restore it after) to
  widen the preemption windows.
- **Run the suite on the free-threaded build**, where the windows are genuinely
  concurrent rather than merely narrow.

```python
import threading

def test_counter_is_exact():
    barrier = threading.Barrier(8)

    def worker():
        barrier.wait()          # all 8 start together
        for _ in range(10_000):
            increment()

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads: t.start()
    for t in threads: t.join()

    assert value() == 80_000
```

That test fails reliably on the racy implementation and passes on the locked
one, which is the property you want from a concurrency test.
## Gotchas

**Symptom:** a deadlock that appears only under load, with two threads each waiting on the other
**Cause:** two locks acquired in different orders on different code paths — A-then-B here, B-then-A there
**Fix:** define a global ordering for lock acquisition and follow it everywhere. Better: restructure so only one lock is ever held at a time, which is usually possible and always simpler to reason about

**Symptom:** a thread holding a lock makes a network call and the whole pool stalls behind it
**Cause:** the lock is held for the duration of an unbounded operation
**Fix:** never do I/O inside a critical section. Fetch or compute first, then take the lock only to publish the result. If the I/O itself must be limited, use a `Semaphore` to bound concurrency rather than a `Lock` to eliminate it

**Symptom:** a `Lock` deadlocks a single thread against itself, with no second thread involved
**Cause:** a public method that acquires the lock calls another public method that acquires the same lock. `threading.Lock` is not reentrant
**Fix:** extract a private helper that assumes the lock is held and have both public methods call it. `RLock` makes the deadlock go away and hides the design problem, which is why it is the second choice and not the first

**Symptom:** a lock is left held after an exception and every subsequent acquirer hangs forever
**Cause:** `lock.acquire()` and `lock.release()` written as separate statements, with an exception raised between them
**Fix:** `with lock:` always. It releases on every exit path including exceptions, and it is shorter to write

**Symptom:** a concurrency test passes every time and the bug is still in production
**Cause:** the threads in the test never actually overlapped — they were created serially and the first finished before the last started, so the code effectively ran single-threaded
**Fix:** synchronise the start with a `threading.Barrier`, raise the iteration count, and lower `sys.setswitchinterval()` inside the test. Run the suite under the free-threaded build if one is available

**Symptom:** a test that uses `time.sleep()` to "make threads interleave" is flaky in CI
**Cause:** sleeps encode an assumption about machine speed that a loaded CI runner violates in both directions
**Fix:** synchronise with a `Barrier` or an `Event`, which express the actual requirement ("all threads have reached here") instead of approximating it with wall-clock time

**Symptom:** a `Semaphore` intended to limit concurrency lets more work through than its count
**Cause:** it was acquired around the wrong span — typically around the request submission rather than the full request lifetime, so slots are released while work is still in flight
**Fix:** `with semaphore:` around the entire operation, including waiting for the result. If the release happens before the work finishes, the limit means nothing

**Symptom:** a `Condition`-based wait occasionally proceeds when the condition is false
**Cause:** the wait was written as `if not ready: cond.wait()` rather than `while not ready: cond.wait()`. A waiter can be woken without the predicate holding
**Fix:** always re-test the predicate in a `while` loop after waking. This is universal across languages and is the single most common `Condition` bug

**Symptom:** `daemon=True` threads are killed mid-write at interpreter shutdown, leaving a half-written file
**Cause:** daemon threads are not joined at exit; the process simply ends
**Fix:** use non-daemon threads with an explicit shutdown signal, or a `ThreadPoolExecutor` context manager which joins on exit. `daemon=True` is right only for work that is genuinely disposable

**Symptom:** a lock added "to be safe" around read-only access to an immutable object measurably slows the program
**Cause:** immutable data needs no lock — nothing can observe an inconsistent state of something that never changes
**Fix:** identify what is actually mutable. Frozen dataclasses, tuples and strings passed between threads need no protection, which is a strong argument for immutability as a concurrency design choice

## Interview questions

**★ `Lock` or `RLock`?**
`Lock` by default. It is not reentrant, so a method that accidentally
reacquires it deadlocks immediately and loudly — a much better failure than a
subtle one. Reach for `RLock` only when a genuinely recursive structure
requires it, and treat the need as a signal that the public API is calling into
itself. The usual fix is a private helper that assumes the lock is already
held, with the public methods acquiring once at the boundary.

**★ What are the rules for holding a lock?**
Use `with`, never manual acquire/release, so an exception cannot leak it. Hold
it for the shortest span that is still correct — the whole read-decide-act, and
nothing more. Never perform I/O or call unknown code (a callback, a user
function, a plugin) while holding it, because you cannot bound the duration or
know what else it will try to acquire. And if more than one lock is ever held
at once, fix a global acquisition order and follow it everywhere.

**★ How do you write a test that catches a race?**
Make the threads genuinely overlap: start them behind a `threading.Barrier` so
they all begin at the same instant, run enough iterations that the window is
actually hit, and assert an exact expected value rather than a range. Lowering
`sys.setswitchinterval()` inside the test widens preemption windows. Never use
`time.sleep()` to arrange interleaving — it encodes an assumption about machine
speed that CI will violate. The strongest option is running the suite on the
free-threaded build, where threads are actually concurrent rather than merely
interleaved.

**★ Two threads deadlock in production. How do you diagnose it?**
Get a stack dump of every thread — `faulthandler.dump_traceback_later()` armed
at startup, or `py-spy dump` against the live process — and look for two threads
each blocked in an acquire. The pair of stacks tells you the two locks and the
two acquisition orders directly. The fix is a global lock ordering; the better
fix is usually a restructure so only one lock is held at a time, because a
codebase with a documented lock hierarchy is a codebase that will eventually
violate it.

**When would you use `Event` versus `Condition`?**
`Event` for a one-shot, level-triggered fact: "initialisation is done",
"shutdown has been requested". Once set it stays set, and every waiter proceeds.
`Condition` for waiting on a state change that must be re-evaluated under a
lock — "the queue is non-empty", "the buffer has space" — where the predicate
can become false again and each waiter must re-check it. The `Condition` wait
always goes in a `while` loop testing the predicate, never an `if`.

**What is a `Semaphore` for, and how is it different from a lock?**
A lock permits one holder; a semaphore permits N. Use it to bound concurrency
rather than eliminate it — at most 10 in-flight calls to a rate-limited API, at
most 4 concurrent large file reads. The critical detail is span: acquire it for
the whole operation including waiting for the result, not just for submitting
the work, or the limit silently does nothing.

**Do immutable objects need locks?**
No. Nothing can observe an inconsistent state of something that never changes,
so a frozen dataclass, a tuple or a string can be shared between any number of
threads with no protection at all. This is a strong argument for immutability
as a concurrency design choice: instead of guarding a mutable object, build a
new one and rebind the shared name in a single assignment, so readers see
either the whole old value or the whole new one.

**Why are `daemon=True` threads dangerous?**
Because the interpreter does not join them at shutdown — the process ends and
they are killed wherever they happen to be, which can be halfway through a
write, a database transaction, or a lock's critical section. Use them only for
genuinely disposable work. For anything with side effects, use non-daemon
threads with an explicit shutdown signal, or a `ThreadPoolExecutor` used as a
context manager, which joins its workers on exit.

---

← Prev: [Making threaded code correct](03-making-threaded-code-correct.md) · Index: [The GIL](README.md) · Next → [Why I/O is the exception](05-io-releases-the-gil.md)
