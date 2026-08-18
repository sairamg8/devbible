---
title: "The shapes: check-then-act, read-modify-write, compound invariants"
sidebar_label: "2 · The shapes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the Oracle Java Tutorials concurrency
> lesson (Thread Interference), the JDK 25 Javadoc for `Map.putIfAbsent`,
> `Map.computeIfAbsent` and `ConcurrentHashMap`, and JLS SE 25 §17.4.

**Almost every race in application code is one of three shapes:
*check-then-act* (decide on a fact that can change before you act on it),
*read-modify-write* (compute a new value from an old one that can move
under you), or a *compound invariant* (two fields that must change
together, observed between the changes). Learn to see the shapes and code
review becomes the cheapest race detector you own — cheaper than any tool,
because it works before the code runs.**

## Shape 1 — check-then-act

The condition is checked, then acted on — and the world may change in the
gap:

```java
// lazy init — the classic
if (instance == null) {          // check
    instance = new Expensive();  // act: two threads both get here
}

// map variant
if (!cache.containsKey(key)) {   // check
    cache.put(key, load(key));   // act: duplicate load, last write wins
}

// "ensure unique" variant
if (!emailTaken(email)) {        // check
    createAccount(email);        // act: two accounts, same email
}
```

The gap is the bug. No amount of narrowing it helps — a preemption can
land inside any gap. The fixes are to make check-and-act *one* atomic
operation (`putIfAbsent`, `computeIfAbsent`, a `synchronized` block
spanning both, a database unique constraint) or to remove the sharing.

The filesystem version has its own name — **TOCTOU** (time-of-check to
time-of-use): `Files.exists(p)` followed by `Files.createFile(p)` races
against every other process on the machine, which is why
`Files.createFile` is specified to throw `FileAlreadyExistsException`
atomically instead of asking you to check first.

## Shape 2 — read-modify-write

A new value is computed from a stale old one:

```java
balance = balance + amount;          // two deposits, one lost
counter++;                           // chunk 1's lost update
list.add(item);                      // internal RMW on size + array
```

The third line is the sneaky one: `ArrayList.add` *is* a read-modify-write
of the list's internal state. Calling it from two threads without
synchronization corrupts the structure itself — possibly a lost element,
possibly an `ArrayIndexOutOfBoundsException`, possibly quiet damage
surfacing later. The same applies to `HashMap.put`
([`HashMap` internals](../../phase-3-generics-collections/07-hashmap-internals.md)
shows what the broken structure looks like). **"I only call one method"
does not mean "atomic" — atomicity is a property the type must promise,**
as `AtomicLong.addAndGet` or `ConcurrentHashMap.merge` do.

## Shape 3 — compound invariants across fields

Two or more fields related by an invariant, updated non-atomically:

```java
class Range {
    private int lo, hi;              // invariant: lo <= hi
    void setLo(int v) { if (v <= hi) lo = v; }   // each method "checks"...
    void setHi(int v) { if (v >= lo) hi = v; }   // ...but not together
}
```

Each setter is a check-then-act, and the two racing together can leave
`lo > hi` — both threads' checks passed against the *old* other field.
Money transfers are this shape (debit one account, credit another;
a reader between the writes sees money missing), as are
`start`/`end` timestamps, `size` alongside a collection, and any
cached-derived-value beside its source. The cure is one guard for the
whole invariant — one lock both setters take
([topic 04](../04-synchronized-intrinsic-locks/README.md)) — or an
immutable value object (`record Range(int lo, int hi)` validated in the
constructor) swapped atomically, the
[phase-2 stance](../../phase-2-classes-objects/12-immutable-design/README.md).

## The double-charge, end to end

The interview and post-mortem classic, assembled from the shapes:

1. **The endpoint:** `POST /orders/{id}/pay` — reads the order, checks
   `status != PAID` (check), calls the card processor, sets
   `status = PAID` (act).
2. **The trigger:** the user double-clicks, or the gateway times out and a
   retry policy re-sends. Two identical requests arrive ~concurrently —
   *retries are a normal, designed-for event*, not an anomaly.
3. **The race:** both request threads read `status = PENDING`. Both checks
   pass. Both call the processor. The customer is charged twice; the
   second `status = PAID` write is a harmless-looking no-op that hides
   the evidence.
4. **The discovery:** not an exception, not a 500 — a reconciliation job
   or a chargeback, days later. That delay is characteristic of race
   damage: *the system stayed green while doing the wrong thing.*

Layered fix — each layer catches what the previous can't:

- **In-JVM exclusion** — one lock/atomic state machine per order, so
  concurrent same-order requests serialize
  ([topic 04](../04-synchronized-intrinsic-locks/README.md)). Necessary,
  but insufficient the moment the service scales to two instances.
- **Database guard** — optimistic concurrency
  (`UPDATE orders SET status='PAID' WHERE id=? AND status='PENDING'`,
  then check the affected-row count) or a version column. Works across
  instances; the check and act become one atomic statement *in the store
  that owns the truth*.
- **Idempotency key** — the client sends a unique key per logical
  payment attempt; the server records it under a unique constraint and
  replays the stored response for duplicates. This also covers the crash
  *between* charge and status write, which no lock can. Payment APIs
  (e.g. Stripe's `Idempotency-Key` header) standardize exactly this.

The general lesson: **a race that matters across processes needs its
atomic step in the shared store, not in the JVM.** In-process tools solve
in-process races only.

## Gotchas

**Symptom:** duplicate rows with identical natural keys, despite an explicit existence check in code
**Cause:** check-then-act across the database — two requests both saw "absent", both inserted
**Fix:** unique constraint in the database and handle the violation; the check may remain as a fast path but the constraint is the guard

**Symptom:** `ArrayIndexOutOfBoundsException` deep inside `ArrayList.add` that "can't happen"
**Cause:** unsynchronized concurrent `add` — the internal size/array read-modify-write interleaved
**Fix:** confine the list to one thread, use a concurrent collection ([topic 11](../11-concurrent-collections.md)), or guard every access path with one lock

**Symptom:** cache occasionally serves two different values for one key early after startup
**Cause:** `containsKey`-then-`put` — both loaders ran; callers that grabbed the first value diverge from later ones
**Fix:** `computeIfAbsent(key, loader)` on a `ConcurrentHashMap` — the check and act are one atomic operation and the loader runs once per key

**Symptom:** transfers occasionally violate the books: sum across accounts briefly wrong in reports
**Cause:** compound invariant — debit and credit are two writes; the report read landed between them
**Fix:** transactional boundary around both writes (the database's job), or a single lock spanning the whole transfer in-process; never per-field guards

**Symptom:** "we added `synchronized` to the payment method and still got a double charge"
**Cause:** two service instances behind the load balancer — a JVM lock has JVM scope
**Fix:** move the atomic step into the shared store: conditional `UPDATE` with row-count check, or an idempotency-key table with a unique constraint

**Symptom:** double-submit protection works in every test, fails for real users on flaky connections
**Cause:** tests submit twice *sequentially*; real retries arrive concurrently and hit the check-then-act window
**Fix:** idempotency keys generated client-side per logical attempt; concurrent duplicates then collide on the constraint instead of both proceeding

**Symptom:** `lo <= hi`-style invariant violated though every setter validates
**Cause:** each setter validated against the other field's *old* value — the checks raced
**Fix:** one lock for the invariant, or replace the mutable pair with an immutable value object validated at construction and swapped atomically

## Interview questions

**★ Name the three race shapes and give a one-line example of each.**
Check-then-act: `if (map.get(k) == null) map.put(k, v)` — the fact checked
can change before the act. Read-modify-write: `count++`, `balance += x`,
`list.add(e)` — new state computed from stale old state. Compound
invariant: debit here, credit there — a reader or second writer lands
between two writes that were supposed to be one.

**★ Walk me through how a double-charge happens and how you'd prevent it.**
Retry or double-click puts two concurrent requests on one order; both
pass the `status != PAID` check-then-act, both charge. Prevention in
layers: serialize per-order in-process; make the state transition atomic
in the database (conditional update with row-count check / version
column) so it holds across instances; and accept an idempotency key per
payment attempt under a unique constraint so even a crash between charge
and record can't cause a re-charge. The database/key layers are the load-
bearing ones — JVM locks don't survive horizontal scaling.

**★ Is `cache.put(key, value)` on a `HashMap` from two threads a race even without a check?**
Yes — twice over. It's a data race on the map's internals, and `put` is
internally read-modify-write on buckets and size, so the structure itself
can corrupt (lost entries, broken chains). Rule: an ordinary collection
touched by two threads needs external synchronization on *every* access
path, or replace it with a concurrent collection.

**★ Why is `computeIfAbsent` better than `containsKey` + `put`?**
Because `ConcurrentHashMap` specifies it as atomic per key: check,
compute and insert happen as one operation, the mapping function runs at
most once per absent key, and concurrent callers get the same value. The
two-call version has a gap; the one-call version *is* the fix for
check-then-act on a map.

**★ Your service has one instance today. Is `synchronized` enough for the payment race?**
It closes the in-process window today — and becomes a silent lie the day
a second instance starts. Fixes that must survive scaling belong in the
shared store (conditional update, unique idempotency key). Reasonable
answer: do both — in-process serialization for efficiency, store-level
guard for correctness.

**★ Why do races so often surface as *data* problems instead of exceptions?**
Because interleaved writes are individually legal — nothing throws. The
program stays green while producing a wrong balance, a duplicate account,
a lost update. Detection therefore trails the bug by days (reconciliation,
audits), which is exactly why prevention-by-shape-recognition beats
detection for this defect class.

---

← Prev: [Data race vs race condition](01-data-race-vs-race-condition.md) · Index: [Race conditions](README.md) · Next → [The cures](03-the-cures.md)
