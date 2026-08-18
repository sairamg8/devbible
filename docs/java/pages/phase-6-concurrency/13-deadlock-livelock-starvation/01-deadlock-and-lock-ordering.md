---
title: "Deadlock and lock ordering"
sidebar_label: "1 · Deadlock and lock ordering"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JLS SE 25 §17.1–17.2 (locks and monitor
> semantics), the JDK 25 Javadoc for `System.identityHashCode`, and the
> Oracle concurrency tutorial's deadlock page. The lock-ordering and
> open-call disciplines follow *Java Concurrency in Practice* ch. 10,
> cited as engineering guidance, not specification.

**Deadlock needs four conditions at once — and Java hands you three of
them for free. Locks are exclusive (mutual exclusion), a thread holding
one lock can block for another (hold-and-wait), and nothing ever takes an
intrinsic lock away from a live thread (no preemption). The only condition
you control is the fourth: a *circular* wait. Every deadlock prevention
technique is one idea wearing different clothes — make the wait graph
acyclic, usually by acquiring locks in one global order.**

## The four Coffman conditions, in Java terms

| Condition | In the JVM |
|---|---|
| Mutual exclusion | a monitor has at most one owner ([topic 04](../04-synchronized-intrinsic-locks/01-the-monitor.md)) |
| Hold-and-wait | nested `synchronized` blocks: hold A, block for B |
| No preemption | no timeout and no interruption while blocked on a monitor — `BLOCKED` ignores `interrupt()` ([topic 01](../01-threads-lifecycle-interrupt/02-interruption.md)) |
| Circular wait | T1 holds A wants B; T2 holds B wants A — a cycle in the waits-for graph |

Break any one and deadlock is impossible. Intrinsic locks give you no
lever on the first three (explicit locks do — `tryLock` restores
preemption; [topic 09](../09-explicit-locks.md)), so the discipline targets
the cycle.

## The classic: two locks, two orders

```java
class Account {
    private final Object lock = new Object();
    private long balanceCents;

    static void transfer(Account from, Account to, long cents) {
        synchronized (from.lock) {                 // T1: locks A … T2: locks B
            synchronized (to.lock) {               // T1: wants B … T2: wants A
                from.balanceCents -= cents;
                to.balanceCents   += cents;
            }
        }
    }
}
```

`transfer(a, b, …)` racing `transfer(b, a, …)` is the textbook cycle: each
thread takes its first lock, then blocks forever on the other's. Nothing
is thrown; both threads sit `BLOCKED` until restart. The call sites look
perfectly symmetrical and innocent — the order inversion is *data-driven*
(argument order), which is why code review misses it.

## The cure: one global acquisition order

Impose a total order on the locks and always acquire along it:

```java
static void transfer(Account from, Account to, long cents) {
    Account first  = from.id() <= to.id() ? from : to;    // order by stable key
    Account second = first == from ? to : from;
    synchronized (first.lock) {
        synchronized (second.lock) {
            from.balanceCents -= cents;
            to.balanceCents   += cents;
        }
    }
}
```

- **Order by a stable, unique key** the domain already has (account id,
  primary key). Every code path that takes both locks must go through the
  ordered path — one bypass reintroduces the cycle.
- **No natural key?** `System.identityHashCode(a)` vs
  `identityHashCode(b)` gives an order; on the (rare, but possible) tie,
  take a third, global tie-breaker lock first, then both in either order —
  the JCiP pattern.
- **Document the order** where the locks are declared. An ordering
  discipline that lives in one engineer's head is one refactor from gone.
- Same rule across *kinds* of locks and even non-lock resources — if some
  path takes the cache lock then a DB connection, no path may take a
  connection then the cache lock.

## Open calls: don't hold locks across foreign code

The second structural rule: never call code you don't control — listeners,
callbacks, "virtual" methods a subclass may override, another object's
`synchronized` API — while holding a lock. The foreign code may take its
own locks (invisible to your ordering) or call back into you:

```java
synchronized void updateAndNotify(Event e) {
    state.apply(e);
    for (var l : listeners) l.onChange(e);   // ✗ alien call under your lock
}

void updateAndNotifyOpen(Event e) {          // ✓ open call
    List<Listener> snapshot;
    synchronized (this) {
        state.apply(e);
        snapshot = List.copyOf(listeners);
    }
    for (var l : snapshot) l.onChange(e);    // lock released first
}
```

Open calls keep the waits-for graph analyzable: your locks are only ever
held around code you can read.

## Resource deadlocks — no monitors required

The same cycle forms over any blocking resource:

- **Two connection pools.** Task path P acquires a connection from pool X
  then one from pool Y; path Q goes Y-then-X. Under load, each side holds
  its last connection of one pool while blocking on the other — deadlock
  by `await` on pool internals, invisible to the JVM's monitor-cycle
  detector. Same fix: order the pools.
- **One bounded pool, nested acquisition.** Each task holds a connection
  and requests a *second* from the same exhausted pool.
- **Thread-starvation deadlock** — tasks in a bounded executor block
  waiting on the `Future` of subtasks queued behind them in the *same*
  executor; the "pool" being exhausted is threads themselves. Covered
  with its executor context in
  [submit and futures](../06-executorservice-pools/02-submit-and-futures.md).

A database adds a twist: the *database* also detects lock cycles among
transactions and kills one with a deadlock error (SQLState 40001 /
`ORA-00060`-style, surfaced as a `SQLException`). That one is retryable by
design — retry the transaction ([phase 5's translation
rules](../../phase-5-exceptions/04-custom-exceptions-translation.md) apply);
a JVM-level deadlock never resolves itself.

## Gotchas

**Symptom:** transfers between accounts hang under load; each hung pair involves the same two accounts in opposite directions
**Cause:** lock order driven by argument order — `transfer(a,b)` racing `transfer(b,a)` completes the cycle
**Fix:** sort the two locks by account id before acquiring; route every both-locks path through the sorted helper

**Symptom:** deadlock appears only after adding an innocent-looking event listener
**Cause:** the listener is invoked under your lock (no open call) and takes a lock some other path acquires before yours
**Fix:** snapshot under the lock, invoke listeners after release; audit every alien call made while holding a monitor

**Symptom:** service freezes but the JVM's dump reports "no Java-level deadlocks found"
**Cause:** the cycle runs through non-monitor waits — pool `await`s, `Future.get`, `park` — which the monitor-cycle detector doesn't model
**Fix:** read the dump manually — pair each `WAITING` thread's frames with the resource it awaits; check pool-acquisition order and thread-starvation shape ([chunk 2](02-dumps-livelock-starvation.md))

**Symptom:** ordering by `identityHashCode` "works for months" then a pair of requests hangs
**Cause:** the tie case — two distinct objects with equal identity hash — was never handled
**Fix:** on tie, take a dedicated global tie-break lock first (JCiP pattern), or order by a domain key that is actually unique

**Symptom:** deadlock between your code and a library's internal synchronization
**Cause:** you call the library while holding your lock; on another path the library calls your callback while holding *its* lock — a cross-codebase cycle no one can see whole
**Fix:** treat library calls as alien: never invoke them lock-held; make callbacks trampoline out (enqueue work, return) instead of taking your locks

**Symptom:** "fixed" a deadlock by making one method take its two locks in the documented order, yet production hangs again a month later
**Cause:** ordering enforced at one call site, not structurally — a new code path took the locks directly, in the other order
**Fix:** make the ordered acquisition the *only* way to get both locks (private locks + one gateway method); the discipline must be unbypassable, not remembered

## Interview questions

**★ Name the four deadlock conditions and the one Java lets you break with intrinsic locks alone.**
Mutual exclusion, hold-and-wait, no preemption, circular wait. Monitors
are exclusive, nestable and non-preemptible by design, so with
`synchronized` alone you break *circular wait* — impose a global
acquisition order. (Explicit locks reopen "no preemption" via
`tryLock`-with-timeout.)

**★ Why does the two-account transfer deadlock, and give two production-grade fixes.**
Lock order follows argument order, so opposite transfers acquire the same
two locks in opposite orders — a cycle. Fix 1: total order — sort by
account id (tie-broken deterministically) and acquire ascending
everywhere. Fix 2: remove hold-and-wait — a single coarser lock (correct,
less concurrent), or `tryLock` both with timeout, releasing and retrying
on failure. In a real ledger, often fix 3: don't lock in the JVM at all —
one atomic conditional DB update, and let the database serialize.

**★ What is an "open call" and what does the discipline buy?**
Calling other code only while holding *no* locks — snapshot state under
the lock, release, then invoke listeners/callbacks/library code. It buys
an analyzable waits-for graph: no unknown locks can nest inside yours, so
your ordering argument stays local to code you can actually read.

**★ Can virtual threads deadlock? Does anything about diagnosis change?**
Yes — deadlock is about lock cycles, not thread weight; a million cheap
threads deadlock exactly like two heavy ones. Diagnosis changes
mechanically: virtual threads don't appear in a classic `jstack` listing,
so you use `jcmd Thread.dump_to_file` (chunk 2), and monitor-blocking
behaviour on modern JDKs follows JEP 491
([pinning](../14-virtual-thread-pinning.md) no longer distorts it).

**★ A deadlock involves a JDBC connection pool and a monitor. Why won't the JVM report it, and how do you find it?**
The JVM's detector walks monitor/j.u.c-ownership cycles; a pool `await`
is just a thread parked in a condition queue — ownership of "a
connection" is application state the JVM can't see. Find it by reading
the dump: who is `BLOCKED` on the monitor and what do the frames say they
hold; which threads are parked in the pool's acquire; reconstruct the
cycle by hand, then order the resources like locks.

**★ When is a deadlock legitimately resolved by retrying, and when is retrying a lie?**
Database-transaction deadlocks: the DB detects the cycle, kills one
victim with a retryable error, and a clean retry usually succeeds —
that's the design. JVM-level deadlocks: nothing will ever kill a victim;
the threads are gone until restart, so "retry" just queues more work
behind a frozen path. The dividing line is whether some arbiter breaks
the cycle for you.

---

← Prev: [Overview](README.md) · Index: [Deadlock, livelock, starvation](README.md) · Next → [Reading the dump; livelock and starvation](02-dumps-livelock-starvation.md)
