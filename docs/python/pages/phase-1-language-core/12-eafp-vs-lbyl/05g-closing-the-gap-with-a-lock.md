---
title: "Keeping the check and closing the gap with a lock is not a deviation from the documentation — the glossary lists locks first among the two remedies, and what goes inside the lock is exactly the pair that must not be interleaved"
sidebar_label: "05g · Closing the gap with a lock"
sidebar_position: 137
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [Glossary: `LBYL`](https://docs.python.org/3.14/glossary.html#term-LBYL)
> (*"This issue can be solved with locks or by using the EAFP approach"*),
> [Python support for free threading — Thread safety](https://docs.python.org/3.14/howto/free-threading-python.html#thread-safety),
> [`threading.Lock`](https://docs.python.org/3.14/library/threading.html#threading.Lock).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A check does not remove a race — it narrows the population of callers that reach the gap
and leaves the gap exactly where it was. That is not an argument for deleting the check,
because the glossary itself names two remedies and lists locks first. This chunk is the
second one done properly: what a lock actually protects (an invariant, not an object), what
goes inside it (the read the decision depends on and the write that depends on the
decision, and nothing else), and the three ways it stops working — a path that forgets to
take it, a second process that has its own, and an I/O call dragged inside it.**

## The check does not close the gap — a lock does

This is the sentence in the glossary that people skip, and it is a licence rather than a
prohibition:

> *"In a multi-threaded environment, the LBYL approach can risk introducing a race
> condition between "the looking" and "the leaping". … This issue can be solved with locks
> or by using the EAFP approach."*

**Locks are a documented solution, listed first.** So "keep the check and close the gap" is
not a deviation from the documentation; it is one of the two remedies the documentation
names. The free-threading HOWTO says the same thing from the other side, and is explicit
that the interpreter's own protection is not something to lean on:

> *"Built-in types like `dict`, `list`, and `set` use internal locks to protect against
> concurrent modifications in ways that behave similarly to the GIL. However, Python has
> not historically guaranteed specific behavior for concurrent modifications to these
> built-in types, so this should be treated as a description of the current implementation,
> not a guarantee of current or future behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives
> instead of relying on the internal locks of built-in types, when possible."*

Those internal locks protect *one* operation. A check and a mutation are two, and nothing
in the interpreter joins them.

```python
import threading


class InsufficientFunds(Exception):
    def __init__(self, account: str, requested: int, available: int) -> None:
        super().__init__(f"{account}: requested {requested}, available {available}")
        self.account = account
        self.requested = requested
        self.available = available


class Ledger:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._balances: dict[str, int] = {}

    def withdraw(self, account: str, amount: int) -> int:
        # A local. Nothing can change it, and holding a lock to validate an int
        # would be pointless contention.
        if amount <= 0:
            raise ValueError(f"amount must be positive, got {amount}")

        with self._lock:                       # the gap is now inside the lock
            balance = self._balances.get(account, 0)
            if amount > balance:
                raise InsufficientFunds(account, amount, balance)
            new_balance = balance - amount
            self._balances[account] = new_balance
            return new_balance
```

**What goes inside the lock is exactly the pair (check, mutate), and nothing else.** The
argument validation stays outside because `amount` is a local — the ownership test clears
it — and every millisecond of unnecessary work inside a lock is contention for every other
thread. Note also that raising *inside* the `with` is fine: the context manager releases the
lock as the exception propagates, which is why `with self._lock:` is the only acceptable
spelling here.

⚠️ **A `threading.Lock` is a per-process object.** Two web workers, two containers or two
pods each get their own, so a lock is *not* the fix once the state is shared across
processes — there the atomic operation belongs to the store, which is
[databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md) and
[claim, then leap](05e-claim-then-leap.md).

## Gotchas

**★ Symptom: an account goes negative under concurrent withdrawals, and the balance check
is right there in the code.** Cause: check and debit are two operations, so two threads both
read a sufficient balance before either wrote. Fix: put the pair inside one lock — or, if
the state lives in a database, inside one conditional statement.

```python
with self._lock:
    balance = self._balances.get(account, 0)
    if amount > balance:
        raise InsufficientFunds(account, amount, balance)
    self._balances[account] = balance - amount
```

**★ Symptom: a lock is taken in `withdraw` and the balance still drifts, because `deposit`
does not take it.** Cause: the lock protects an *invariant*, not an object, and an invariant
is only protected if **every** path that touches it takes the same lock. Fix: make the state
private and route every mutation through methods that acquire the lock; a public attribute
that anyone can mutate cannot be protected by a lock at all.

```python
class Ledger:
    def deposit(self, account: str, amount: int) -> int:
        if amount <= 0:
            raise ValueError(f"amount must be positive, got {amount}")
        with self._lock:                       # the same lock, on every path
            new_balance = self._balances.get(account, 0) + amount
            self._balances[account] = new_balance
            return new_balance

    def balance(self, account: str) -> int:
        with self._lock:                       # reads too: a read of a pair is a pair
            return self._balances.get(account, 0)
```

**★ Symptom: the fix worked on one worker and the bug returned when the service was scaled
to three.** Cause: a `threading.Lock` is local to one interpreter — three processes hold
three unrelated locks. Fix: move the atomicity to the shared component: one conditional
`UPDATE ... WHERE`, a `SELECT ... FOR UPDATE` inside a transaction, or the engine's advisory
lock. The Python-level lock stays only for state that is genuinely per-process.

**Symptom: a lock is guarded by `if not lock.locked(): lock.acquire()`.** Cause: LBYL applied
to the lock itself — the classic self-parody, since the state being checked is precisely the
thing another thread is competing for. Fix: `with lock:`, which blocks and acquires as one
operation; where waiting forever is unacceptable, use the timeout form and branch on its
return value.

```python
with self._lock:
    ...                                        # blocking, correct, exception-safe

if self._lock.acquire(timeout=0.5):            # or: bounded wait, explicit failure
    try:
        ...
    finally:
        self._lock.release()
else:
    raise ResourceBusy("ledger is contended")
```

**Symptom: throughput collapses after adding a lock, or the service deadlocks under load.**
Cause: the lock was made to cover more than the invariant — typically an I/O call pulled
inside it, or two locks acquired in different orders on different code paths. Fix: hold the
lock for the check-and-mutate only, do I/O outside it, and if more than one lock is
unavoidable, acquire them in one fixed order everywhere.

```python
with self._lock:                       # decide under the lock
    if order_id in self._claimed:
        return False
    self._claimed.add(order_id)
mailer.send_receipt(order_id)          # do the slow thing outside it
return True
```

**Symptom: `if key in d: d[key] += 1` is correct in the GIL build and wrong under the
free-threaded build.** Cause: nothing changed — it was always wrong. The internal locks the
HOWTO describes protect individual operations, and this is three; the documentation adds
that the behaviour *"should be treated as a description of the current implementation, not a
guarantee"*. Fix: one atomic operation, or one lock.

```python
counts[key] = counts.get(key, 0) + 1     # still a read-modify-write: use a lock
with lock:
    counts[key] = counts.get(key, 0) + 1
```

## Interview questions

**★ Does adding a check ever remove a race?**
No. A check makes the *window* narrower for the cases it rejects, and leaves the window
exactly where it was for everything else — the state can still change between the look and
the leap, which is the glossary's entire warning. The glossary also names the remedies:
*"This issue can be solved with locks or by using the EAFP approach."* So there are three
correct positions — one atomic operation, one lock around the pair, or a conditional write
the store evaluates — and "I added an `if`" is not one of them. What the `if` buys is a
better error for the common case, and that is a real and separate benefit.

**★ What exactly goes inside the lock?**
The pair that must not be interleaved: the read the decision depends on, and the write that
depends on the decision. Nothing else. Argument validation stays outside because it looks at
locals; I/O stays outside because a lock held across a network call converts one slow
dependency into a queue of blocked threads; logging and metrics stay outside. The test to
apply is to name the invariant the lock protects — "the balance never goes below zero" — and
then include exactly the statements that could break it. If you cannot name the invariant,
the lock is decoration.

**★ Is `if key in d: return d[key]` safe now that dictionaries have internal locks?**
No, and the HOWTO's wording is worth quoting exactly on this: built-in types *"use internal
locks to protect against concurrent modifications in ways that behave similarly to the
GIL"*, but *"Python has not historically guaranteed specific behavior for concurrent
modifications to these built-in types, so this should be treated as a description of the
current implementation, not a guarantee of current or future behavior."* Both parts matter.
The protection is per-operation, and your pattern is two operations, so nothing covers the
gap — and even the per-operation behaviour is described rather than promised. The
documentation's own advice is to use `threading.Lock` rather than to lean on the internal
ones.

**A reviewer insists the balance check is "unpythonic — let the debit fail".** How do you
answer?
By asking what the debit raises. In the in-memory ledger nothing does: subtracting from a
dict value succeeds happily and leaves a negative balance, so there is no exception to
catch and EAFP is not merely unfashionable but impossible — the check is the only mechanism
that exists. With a database there *is* a candidate, a `CHECK (balance >= 0)` constraint,
and catching its `IntegrityError` and translating it is a legitimate design. What is not
legitimate is deleting the check without adding either the constraint or the lock, which is
what "let it fail" means when nothing fails.

**Is `with lock:` around a check-and-mutate the same thing as EAFP?**
No, and the difference is worth being precise about, because both end up "correct". EAFP
removes the gap by having only one operation; a lock keeps two operations and makes the pair
indivisible from any other thread's point of view. They fail differently: EAFP costs a raise
on the miss and needs the operation to *have* a failure channel, while the lock costs
contention and needs every code path touching the invariant to cooperate. Choose EAFP when
one atomic operation exists — `dict.setdefault`, `open(path, "x")`, a conditional `UPDATE` —
and the lock when the invariant spans several operations that no single call can express.

---

← Prev: [The asymmetry](05f-the-asymmetry.md) · Index: **EAFP vs LBYL** *(not written yet)* · Next → [Reports, not first casualties](05h-aggregating-failures.md)
