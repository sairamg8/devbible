---
title: "Visibility and happens-before"
sidebar_label: "2 · Visibility"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4.4 (Synchronization Order),
> §17.4.5 (Happens-before Order — "An unlock on a monitor happens-before
> every subsequent lock on that monitor"), and the Oracle Java Tutorials
> concurrency lesson (Memory Consistency Errors, Intrinsic Locks and
> Synchronization).

**Exclusion is only half of what `synchronized` does. The other half is a
promise about *memory*: everything a thread wrote before releasing a
monitor is visible to any thread that subsequently acquires the same
monitor. Without that promise, a lock would stop threads from colliding
and still let them read stale data. With it, `synchronized` is a
publication mechanism — which is why the read side must lock too, and why
"but the getter doesn't modify anything" is the most common wrong
sentence in concurrency review.**

## The rule

JLS §17.4.5 lists the happens-before edges; the one this chunk is about:

> *An unlock on a monitor happens-before every subsequent lock on that
> same monitor.*

Combined with program order (within one thread, earlier actions
happen-before later ones) and transitivity, this yields the working
guarantee:

```java
// Thread A                          // Thread B
synchronized (lock) {
    config = loadConfig();   // (1)
    ready = true;            // (2)
}                            // unlock ─────► synchronized (lock) {   // lock
                                            //   if (ready)           // sees (2)
                                            //       use(config);     // sees (1) — fully
                                            // }
```

Everything *before the unlock* — not just writes inside the block — is
visible after the acquiring thread's lock. The edge is between unlock and
lock **of the same monitor**: synchronizing on different objects creates
no edge at all, which is the memory-model restatement of chunk 1's "same
lock or no protection".

## Why the read path must lock

Drop the reader's `synchronized` and the edge disappears:

```java
class Broken {
    private boolean ready;                    // not volatile
    private Config config;

    synchronized void publish(Config c) { config = c; ready = true; }

    Config tryGet() {                         // no lock — no edge
        return ready ? config : null;         // may see ready==true, config==null?
    }                                         // or ready==false forever
}
```

Two distinct failures are allowed by the JMM here:

- **Staleness.** The unlocked read of `ready` has no ordering with the
  write; the reader may see `false` indefinitely. The JIT may even hoist
  the read out of a polling loop, making "eventually" into "never".
- **Reordering.** Without an edge, the reader can observe `ready == true`
  yet a stale `config` — the two writes need not arrive in program
  order for an unsynchronized observer.

The fix is symmetry: `tryGet` synchronizes on the same lock (or `ready`
becomes `volatile`, below). A useful slogan for review: **locks come in
pairs — a write-side lock without a read-side lock is a bug wearing a
seatbelt on one side of the car.**

## `synchronized` vs `volatile`

`volatile` establishes its own happens-before edge (a write to a
volatile field happens-before every subsequent read of it — JLS §17.4.5),
so the two tools overlap on *visibility* and differ on *atomicity*:

| | `synchronized` | `volatile` |
|---|---|---|
| Visibility of prior writes | ✅ on unlock→lock | ✅ on write→read |
| Mutual exclusion | ✅ | ❌ — none |
| Compound operations (`x++`, check-then-act) | ✅ if inside one block | ❌ still racy |
| Blocking | can block/queue | never blocks |
| Granularity | region of code | single field |

Rule of thumb from the two columns: `volatile` for a *flag or reference
written independently of its previous value* (shutdown flags, the
config-swap of [the cures](../03-race-conditions/03-the-cures.md));
`synchronized` when any *invariant spans more than one action*. The
full memory-model treatment — including why `volatile` was the missing
piece in double-checked locking — is [topic 05 · The Java Memory Model](../05-java-memory-model/README.md).

## Safe publication through a lock

The visibility rule is also the honest explanation of a pattern used
everywhere: build an object, then hand it to another thread via a
guarded container.

```java
// producer                             // consumer
Order o = new Order(...);               Order o;
synchronized (queueLock) {              synchronized (queueLock) {
    queue.add(o);                           o = queue.poll();
}                                       }
                                        // o's fields fully visible here
```

The producer's construction writes happen-before the unlock; the
consumer's lock happens-before its reads; transitivity delivers a fully
built `Order`. Every thread-safe handoff structure — `BlockingQueue`,
executor task submission ([topic 06](../06-executorservice-pools/README.md)) — documents
this same promise as "memory consistency effects: actions prior to
submission happen-before actions taken by the task", a phrase from the
`java.util.concurrent` package documentation you can now unpack.

## Gotchas

**Symptom:** background thread never notices `running = false`; loop spins forever, but only in production builds
**Cause:** unsynchronized non-volatile flag — no happens-before edge, and the JIT legally hoisted the read out of the loop
**Fix:** `volatile boolean running`, or check under the same lock the writer uses; "it worked in the debugger" is the race hiding, not absence of the bug

**Symptom:** reader sees the new flag but the old data it announces
**Cause:** flag and payload written under a lock, read without one — the JMM permits the unsynchronized observer to see the writes out of order
**Fix:** acquire the same monitor on the read path, or publish payload-then-volatile-flag so the volatile edge carries the payload with it

**Symptom:** value cached in a local variable stays stale across iterations "even though the field is guarded"
**Cause:** the field was read once outside the lock into a local; the guard on later accesses can't refresh a copy
**Fix:** re-read shared state inside the critical section each time; locals are snapshots, not views

**Symptom:** replacing `synchronized` blocks with `volatile` on every field "for performance" reintroduced the race
**Cause:** volatility is per-field visibility; the code's invariants spanned several fields and compound updates
**Fix:** map each invariant to a guard: single independent field → `volatile` may suffice; multi-action or multi-field invariant → one lock around the whole step

**Symptom:** handoff through a plain `ArrayList` + polling works on x86, fails on ARM
**Cause:** no synchronized/volatile edge on the handoff — x86's stronger hardware ordering masked the missing happens-before
**Fix:** use a guarded queue or `BlockingQueue`; the JLS edge, not the CPU du jour, is the contract

**Symptom:** team argues a getter needs no lock because "reference reads are atomic in Java"
**Cause:** conflating atomicity with visibility — the read won't tear, but nothing obliges it to be *fresh* or ordered with related writes
**Fix:** atomic ≠ visible ≠ consistent; an unguarded atomic read can be stale forever and can see invariants mid-update

## Interview questions

**★ State the happens-before rule for intrinsic locks.**
An unlock of a monitor happens-before every subsequent lock of that same
monitor (JLS §17.4.5). With program order and transitivity: everything
thread A did before releasing lock L is visible to thread B after B
acquires L. Different monitors — no edge, no guarantee.

**★ Why is a synchronized setter with a plain getter broken?**
The getter has no happens-before relationship with the setter's writes:
it can return stale values indefinitely and can observe multi-field
state inconsistently. Both sides must synchronize on the same monitor —
or the field must be `volatile` when a single independently-written
field is all that's shared.

**★ When is `volatile` enough, and when do you need `synchronized`?**
`volatile` suffices when threads communicate through one field whose new
value doesn't depend on its old one and no other state must stay
consistent with it — flags, config-snapshot references. The moment the
update is compound (`x++`, check-then-act) or an invariant spans fields,
you need mutual exclusion, which only locks (or a redesign) provide.

**★ What does "safe publication" mean and how does a lock achieve it?**
Making an object built by one thread readable by another with all its
initialization visible. Handing the reference over under a common
monitor achieves it by transitivity: construction happens-before unlock,
unlock happens-before the consumer's lock, lock happens-before the
consumer's reads. `BlockingQueue` and executor submission document the
same effect, so handing objects through them is publication-safe by
contract.

**★ A race disappears when you add print statements. What happened?**
The added I/O introduced synchronization (streams lock internally) and
changed timing, manufacturing edges and schedules that mask the bug.
Nothing was fixed — the program's guarantees didn't change, its luck did.
Diagnose by finding the missing happens-before edge, not by observing.

**★ Does `synchronized` flush "everything to main memory"?**
That's folk-model, and it both over- and under-promises. The specified
contract is relational: writes before an unlock are visible to threads
that later *lock the same monitor* — it says nothing about threads that
don't synchronize, and it licenses the JVM to implement the effect
however it likes (caches, barriers, no "flush" required). Reason with
edges, not with hardware metaphors.

---

← Prev: [The monitor](01-the-monitor.md) · Index: [`synchronized` and intrinsic locks](README.md) · Next → [Choosing the lock object — and the limits](03-choosing-the-lock-object.md)
