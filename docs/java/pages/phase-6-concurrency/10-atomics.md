---
title: "Atomics"
sidebar_label: "10 · Atomics"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.concurrent.atomic` — the package summary (weakly-consistent
> vs atomic access, `VarHandle` equivalences), `AtomicInteger`,
> `AtomicLong`, `AtomicReference`, `AtomicStampedReference`, `LongAdder`,
> `LongAccumulator` and the atomic field updaters.

**A `volatile` field solves visibility and nothing else: `count++` on a
volatile is still read-modify-write, still lost under contention
([race shapes](03-race-conditions/02-the-shapes.md)). The atomic classes
close that gap for *single variables* without a lock — the hardware
compare-and-set instruction either installs your new value or tells you
someone got there first, and everything in the package is built from that
one primitive. Understanding the CAS loop is understanding all of it.**

## The primitive: compare-and-set

```java
AtomicLong balance = new AtomicLong(100);

boolean won = balance.compareAndSet(100, 90);
// atomically: if current == 100, set to 90 and return true;
// otherwise change nothing and return false
```

`compareAndSet(expected, newValue)` is atomic *and* carries volatile
memory semantics (the package documentation specifies `compareAndSet` and
friends have the memory effects of both a volatile read and a volatile
write). Losing the race is not an error — it is information: the state
changed under you, so re-read and re-decide. That retry is the CAS loop:

```java
long withdraw(AtomicLong balance, long amount) {
    for (;;) {
        long current = balance.get();
        if (current < amount) throw new InsufficientFundsException();
        long next = current - amount;
        if (balance.compareAndSet(current, next)) return next;
        // lost the race: someone else moved the balance — loop and re-check
    }
}
```

The invariant check (`current < amount`) rides *inside* the loop — this is
check-then-act made atomic without a lock, and it works only because both
the check's input and the act's expected value are the same read.

## The packaged loops: `updateAndGet` and friends

The JDK ships the loop so you don't hand-roll it:

```java
balance.updateAndGet(current -> Math.max(0, current - fee));
balance.accumulateAndGet(deposit, Long::sum);
counter.incrementAndGet();      // the classic
```

The function you pass **must be pure** — the Javadoc warns it may be
re-applied when attempted updates fail due to contention. A side effect in
the lambda (a log line, a list add) executes once per *attempt*, not once
per *update*.

`AtomicReference<T>` lifts the same machinery to object references, which
combines with immutability into the standard lock-free state pattern:
build a *new* immutable state object, CAS it in, retry on failure
([immutable design](../phase-2-classes-objects/12-immutable-design/README.md)).

```java
AtomicReference<RoutingTable> table = new AtomicReference<>(RoutingTable.EMPTY);
table.updateAndGet(t -> t.withRoute(newRoute));   // RoutingTable is immutable
```

## The ABA problem

CAS compares *values*, not histories. If the value went A → B → A while
you were away, your `compareAndSet(A, next)` succeeds even though the
world changed twice — harmless for a counter (a count is its own meaning),
dangerous when the value is a reference into a structure whose *identity*
matters (the classic lock-free-stack node-reuse bug).
`AtomicStampedReference` pairs the reference with an `int` stamp you bump
on every update, so the comparison is "same reference *and* same
version"; `AtomicMarkableReference` is the one-bit variant. In
application code the cleaner escape is the immutable-state pattern above —
a freshly built object is never `==` to a stale one, so ABA cannot arise.

## Hot counters: `LongAdder`

Every CAS on one `AtomicLong` serializes on one memory word; under heavy
write contention threads burn their time retrying. `LongAdder` spreads
the value across internally striped cells — contending threads land on
different cells, and `sum()` adds them up when someone asks. The Javadoc
positions it precisely: **prefer `AtomicLong` when you need fine-grained
control or compare-and-set; prefer `LongAdder` when many threads update a
statistic that is read rarely** (metrics, hit counters).

The trade:

- `sum()` is **not** an atomic snapshot — concurrent updates during the
  sum may or may not be included. Fine for metrics, wrong for invariants.
- There is no `compareAndSet` on an adder — striping removed the single
  word a CAS would target. If you need conditional updates, you need
  `AtomicLong`.
- `LongAccumulator` generalizes to any accumulation (`max`, `min`, custom
  associative functions) supplied as a lambda — which must be
  side-effect-free and order-insensitive, since cells apply it in no
  particular order.

## Field updaters and `VarHandle` — the footprint tier

`AtomicLongFieldUpdater` and siblings give CAS on a plain `volatile long`
*field* without wrapping it in an object — historically how classes with
millions of instances (every `Thread`, every stream node) avoided one
extra allocation per instance. Modern JDK code does the same through
`VarHandle`, the general mechanism underneath the whole package: a typed,
checked handle to a field with a menu of access modes (plain, opaque,
release/acquire, volatile). Application code rarely needs either — know
that they exist, that the atomic classes are the ergonomic face of
`VarHandle` access modes, and stop there.

## `volatile` vs atomic, side by side

| | `volatile long` | `AtomicLong` |
|---|---|---|
| Visibility of writes | ✅ | ✅ |
| Single write atomicity | ✅ (no word tearing, even `long`/`double`) | ✅ |
| `x++` / read-modify-write | ❌ lost updates | ✅ `incrementAndGet` |
| Conditional update | ❌ check-then-act races | ✅ `compareAndSet` |
| Multi-variable invariant | ❌ | ❌ — this is the lock's job |

The last row is the boundary of the whole package: atomics coordinate
**one** variable. An invariant spanning two atomics (balance and audit
count) can interleave between the two updates — that compound needs a
lock ([the monitor](04-synchronized-intrinsic-locks/01-the-monitor.md)) or
a single `AtomicReference` to one immutable object holding both fields.

## Gotchas

**Symptom:** metrics counter drifts low under load despite being `volatile`
**Cause:** `volatile` makes the read and the write visible, not the read-modify-write atomic — concurrent `count++` interleaves and loses increments
**Fix:** `AtomicLong.incrementAndGet()` for exact counts with occasional reads under moderate contention; `LongAdder.increment()` for write-hot statistics

**Symptom:** duplicate log lines / duplicate list entries traced to an `updateAndGet` lambda
**Cause:** the update function is re-executed on CAS contention — documented behavior; the side effect ran once per attempt
**Fix:** pure functions only inside atomic update lambdas; do the side effect after the call returns, using its result

**Symptom:** two atomics updated back-to-back; a reader sees the first updated and the second stale, breaking an invariant
**Cause:** atomicity is per-variable — the gap between two atomic updates is an ordinary race window
**Fix:** collapse the invariant into one `AtomicReference<ImmutableState>`, or guard both fields with one lock; two atomics never form one atomic

**Symptom:** `LongAdder.sum()` used as a balance check occasionally passes when it shouldn't
**Cause:** `sum()` is documented as *not* an atomic snapshot — updates concurrent with the sum may be missed
**Fix:** adders are for statistics; anything decision-bearing (quota, balance, limit) belongs in an `AtomicLong` CAS loop or under a lock

**Symptom:** lock-free structure corrupts rarely, only under peak concurrency, unreproducible in tests
**Cause:** ABA — a reference CAS succeeded against a recycled node that had been removed and re-inserted between read and CAS
**Fix:** version the reference (`AtomicStampedReference`) or never reuse: CAS in freshly-constructed immutable nodes so a stale expected value can never compare equal

**Symptom:** hand-rolled CAS retry loop pegs a core when one writer stalls at exactly the wrong moment
**Cause:** unbounded hot spin with no backoff — every failed CAS immediately retries against the same contended word
**Fix:** prefer the JDK's packaged operations (they use `Thread.onSpinWait` internally where it matters); for long odds, bound the spin and fall back to a lock

## Interview questions

**★ `volatile int count; count++` — safe or not, and what exactly goes wrong?**
Not safe. `count++` is three steps — read, add, write. Two threads can
both read 5, both write 6: one increment vanishes. `volatile` guarantees
each read sees the latest write; it does nothing to make the three steps
one step. `AtomicInteger.incrementAndGet()` (a CAS loop) or a lock makes
the step atomic.

**★ Explain the CAS loop pattern and why losing a CAS is not a failure.**
Read the current value, compute the desired next value, `compareAndSet(current, next)`.
False means exactly one thing: another thread updated the variable between
your read and your CAS — your input is stale, so loop, re-read, recompute.
Progress is guaranteed system-wide (someone's CAS won), which is why it's
called lock-free rather than wait-free.

**★ When would you pick `LongAdder` over `AtomicLong`, and what do you give up?**
Many writer threads, statistical reads — request counters, metrics.
Striped cells absorb contention that would serialize on one AtomicLong
word. You give up `compareAndSet` (no single word to compare) and atomic
snapshots (`sum()` may miss concurrent updates), so nothing decision-bearing.

**★ What is ABA, and name two defenses.**
A CAS succeeds because the value equals the expectation, though it changed
A→B→A in between — identity was lost. Defenses: stamp the reference
(`AtomicStampedReference` — compare reference *and* version), or make ABA
unconstructible by CASing only freshly-built immutable objects, which can
never be reference-equal to a stale expected value.

**★ Your invariant spans `balance` and `reservedCount`. Both are atomic. Is the class thread-safe?**
No. Each variable updates atomically, but between the two updates any
reader observes the invariant broken, and two writers can interleave their
pairs. Per-variable atomicity does not compose. Either one lock guards
both, or both fields move into one immutable object behind a single
`AtomicReference`.

**★ Why do the update-function methods (`updateAndGet`, `accumulateAndGet`) require pure functions?**
Contention makes the implementation retry: the function may run several
times before one attempt's CAS lands. Side effects multiply per attempt,
and a function reading other mutable state may compute from a view that's
stale by the time the CAS succeeds. The contract is: deterministic,
side-effect-free, dependent only on the passed argument.

---

← Prev: [Explicit locks](09-explicit-locks.md) · Index: [Phase 6 — Concurrency](README.md) · Next → [Concurrent collections](11-concurrent-collections.md)
