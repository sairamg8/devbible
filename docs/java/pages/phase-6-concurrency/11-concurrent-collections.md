---
title: "Concurrent collections"
sidebar_label: "11 · Concurrent collections"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `ConcurrentHashMap` (class docs and `computeIfAbsent`), `ConcurrentMap`,
> `CopyOnWriteArrayList`, `BlockingQueue` and its implementations
> (`ArrayBlockingQueue`, `LinkedBlockingQueue`, `SynchronousQueue`),
> `ConcurrentLinkedQueue`, `ConcurrentSkipListMap`, and the
> `java.util.concurrent` package summary (weakly consistent iterators).

**Wrapping a `HashMap` in `Collections.synchronizedMap` makes each *call*
safe and leaves every *conversation* broken: check-then-put still races,
and iteration still throws `ConcurrentModificationException` unless you
lock the whole map around the loop. The concurrent collections are not
"synchronized but faster" — they have different contracts, built around
atomic compound operations (`computeIfAbsent`, `putIfAbsent`, `put`/`take`)
and iterators that tolerate concurrent change instead of failing on it.
Choosing one is choosing a contract, not a speed.**

## Why the wrappers aren't enough

```java
Map<String, User> map = Collections.synchronizedMap(new HashMap<>());

// each call atomic; the compound is a race (check-then-act):
if (!map.containsKey(id)) {          // T1 and T2 both pass
    map.put(id, loadUser(id));       // second put clobbers the first load
}

// iteration: the Javadoc REQUIRES manual locking, or it fails:
synchronized (map) {
    for (User u : map.values()) { ... }
}
```

The wrapper serializes method calls on one monitor. Everything between
two calls is unprotected, and everything is contended on a single lock.
Both problems are structural — the fixes below change the contract.

## `ConcurrentHashMap` — the workhorse

Fully concurrent reads, highly concurrent writes, no map-wide lock, and
the compound operations done *inside* the map, atomically per key:

```java
ConcurrentHashMap<String, Config> cache = new ConcurrentHashMap<>();

// the one-line thread-safe cache:
Config c = cache.computeIfAbsent(tenantId, id -> loadConfig(id));

cache.putIfAbsent(id, fresh);                    // insert only if absent
cache.replace(id, expected, updated);            // CAS by value
cache.merge(id, 1L, Long::sum);                  // upsert-accumulate
```

The `computeIfAbsent` contract, straight from the Javadoc, is where the
value lives and where the bugs live:

- The whole invocation is **atomic per key** — the mapping function runs
  at most once, and other threads' operations on that key block while it
  runs. Two racing callers get the *same* loaded value; the duplicate-load
  race of the wrapper example cannot happen.
- Therefore the function must be **short and simple**, and **must not
  update any other mappings of this map** — the documentation says the
  computation *"must not attempt to update any other mappings"*; a
  recursive `computeIfAbsent` into the same map can throw
  `IllegalStateException` or deadlock.
- A function returning `null` records **no** mapping.

The reads-side contract:

- **No `null` keys or values** — `null` is reserved as the "absent"
  signal; in a concurrent map, `get(k) == null` must mean exactly one
  thing, since you cannot atomically distinguish "absent" from "mapped to
  null" the way single-threaded `containsKey` can.
- `size()`, `isEmpty()`, `containsValue()` are **estimates while
  concurrent** — the docs say they are typically useful only for
  monitoring, not control flow.
- Iterators and streams are **weakly consistent**: they never throw
  `ConcurrentModificationException`, they traverse the map as it was at
  or after creation, and they may or may not reflect concurrent updates.
- Bulk parallel operations (`forEach`, `search`, `reduce` with a
  `parallelismThreshold`) exist for whole-map computation without
  freezing the map.

## `CopyOnWriteArrayList` — read-mostly snapshots

Every mutation copies the whole backing array; every reader (and every
iterator) works on an immutable snapshot taken at creation:

```java
CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();
listeners.add(l);                       // copies the array
for (Listener l : listeners) l.onEvent(e);   // snapshot — never CME,
                                             // never sees adds made during the loop
```

The Javadoc's own positioning: efficient when traversals *vastly*
outnumber mutations — the listener list, the handler chain, the plugin
registry. The corollaries: iterator `remove` is unsupported
(the snapshot is immutable), a listener added mid-broadcast is not called
for that event, and write-heavy use degrades to copying an array per
operation.

## `BlockingQueue` — producer/consumer as a data structure

The queue is the coordination: producers `put`, consumers `take`, and
the blocking *is* the backpressure — no `wait`/`notify`, no conditions,
no hand-rolled buffer ([the `Condition` version of this](09-explicit-locks.md)
is what you no longer write).

```java
BlockingQueue<Order> queue = new ArrayBlockingQueue<>(1024);

// producer                            // consumer
queue.put(order);                      Order o = queue.take();
// blocks while full                   // blocks while empty
```

The four verb families matter — same operation, four failure modes:

| | Throws | Returns special value | Blocks | Times out |
|---|---|---|---|---|
| Insert | `add` | `offer` → `false` | `put` | `offer(e, t, u)` |
| Remove | `remove` | `poll` → `null` | `take` | `poll(t, u)` |
| Examine | `element` | `peek` → `null` | — | — |

Choosing an implementation:

- **`ArrayBlockingQueue`** — bounded, array-backed, one lock; the honest
  fixed-capacity buffer. Bounded is the production default: an unbounded
  queue converts overload into an eventual `OutOfMemoryError` instead of
  visible backpressure ([pool sizing](06-executorservice-pools/03-scheduling-and-sizing.md)
  makes the same point for executor queues).
- **`LinkedBlockingQueue`** — optionally bounded, separate put/take
  locks so producers and consumers contend less; capacity-less form is
  `Integer.MAX_VALUE`, i.e. effectively unbounded — say so on purpose.
- **`SynchronousQueue`** — capacity zero: every `put` waits for a `take`,
  a handoff rather than a buffer. It is what `newCachedThreadPool` uses —
  work is handed to a thread, never parked in a queue.
- **`ConcurrentLinkedQueue`** — *not* blocking: lock-free, unbounded,
  `offer`/`poll` never wait. For when you need a thread-safe queue but
  waiting is someone else's job. Its `size()` is O(n) and racy — don't
  poll it in a loop condition.

## Sorted and navigable: `ConcurrentSkipListMap`

The concurrent `TreeMap`: sorted keys, `headMap`/`tailMap`/`firstEntry`
range operations, lock-free skip-list underneath. The niche is real but
narrow — ordered indexes under concurrency (leaderboards, time-keyed
lookups). If you don't need ordering, `ConcurrentHashMap` is faster; if
you don't need concurrency, `TreeMap` ([choosing a collection](../phase-3-generics-collections/14-choosing-a-collection/README.md)).

## Choosing

| Situation | Reach for |
|---|---|
| Shared cache / registry, any read-write mix | `ConcurrentHashMap` + `computeIfAbsent` |
| Listener/observer list — reads dwarf writes | `CopyOnWriteArrayList` |
| Producer/consumer pipeline with backpressure | bounded `ArrayBlockingQueue` / `LinkedBlockingQueue` |
| Direct handoff, no buffering | `SynchronousQueue` |
| Thread-safe queue, no blocking wanted | `ConcurrentLinkedQueue` |
| Concurrent *and* sorted | `ConcurrentSkipListMap` |
| Compound invariant across two structures | none of these — one lock around both |

The last row repeats the boundary from [atomics](10-atomics.md): each
collection makes *its own* operations atomic. A check on one structure
followed by an update of another is a compound the collections cannot see;
that coordination is a lock's job.

## Gotchas

**Symptom:** `ConcurrentModificationException` from a `synchronizedMap` despite "everything being synchronized"
**Cause:** iteration is many calls; the wrapper's Javadoc requires manually synchronizing on the wrapper for the whole traversal
**Fix:** hold the wrapper's monitor around the loop — or migrate to `ConcurrentHashMap`, whose iterators are weakly consistent and never throw CME

**Symptom:** cache loads the same key two or three times under startup load
**Cause:** `if (!map.containsKey(k)) map.put(k, load(k))` — atomic calls, racing compound
**Fix:** `map.computeIfAbsent(k, this::load)` — the check and the load are one atomic per-key operation; racing callers share one load

**Symptom:** service freezes on a `computeIfAbsent`; thread dump shows the mapping function doing a remote call, other threads parked on the same key's bin
**Cause:** the function runs under the key's lock — the documentation demands short and simple; a slow load blocks every operation touching that region
**Fix:** for expensive loads, cache a `CompletableFuture<V>` instead: `computeIfAbsent(k, __ -> supplyAsync(...))` returns instantly and racers share the future

**Symptom:** `IllegalStateException: Recursive update` (or a wedged map) inside `computeIfAbsent`
**Cause:** the mapping function itself reads or writes other keys of the same map — explicitly forbidden by the contract
**Fix:** compute purely from the key and captured immutable context; restructure multi-key derivation to happen outside the map call

**Symptom:** `if (map.size() == 0)` control flow misbehaves under concurrency
**Cause:** `size`/`isEmpty` on `ConcurrentHashMap` are documented estimates in the presence of concurrent updates
**Fix:** never gate logic on aggregate views of a live concurrent map; track decision-bearing counts explicitly (`LongAdder`/`AtomicLong`) or design them out

**Symptom:** `NullPointerException` on `concurrentMap.put(k, null)` after migrating from `HashMap`
**Cause:** concurrent maps ban null keys and values — `null` from `get` must unambiguously mean absent
**Fix:** model "present but empty" explicitly (`Optional`, a sentinel object), or drop the entry; the ban is the migration checklist item people miss

**Symptom:** listener registered during event dispatch never receives that event; team suspects lost registration
**Cause:** `CopyOnWriteArrayList` iterators are snapshots — the add happened, the in-flight iteration predates it
**Fix:** working as documented; if same-event delivery is required, COW is the wrong structure (queue the registration through the dispatch mechanism itself)

**Symptom:** `UnsupportedOperationException` from `iterator.remove()` during a COW list sweep
**Cause:** snapshot iterators cannot write back — element-changing iterator methods are unsupported by contract
**Fix:** collect removals during the sweep, then `removeAll` after — each mutation is one array copy anyway

**Symptom:** heap exhaustion; dump dominated by queued tasks; producers never slowed down
**Cause:** "unbounded" `LinkedBlockingQueue` (default capacity `Integer.MAX_VALUE`) — overload buffered invisibly instead of pushing back
**Fix:** bound the queue and choose the full-queue policy consciously: block (`put`), shed (`offer` + fallback), or time out (`offer(e, t, u)`)

## Interview questions

**★ `Collections.synchronizedMap(new HashMap<>())` vs `ConcurrentHashMap` — what actually differs?**
The wrapper serializes individual calls on one monitor: compounds
(check-then-put) still race, iteration needs manual whole-map locking,
and all threads contend on one lock. `ConcurrentHashMap` provides atomic
compound operations (`computeIfAbsent`, `putIfAbsent`, `merge`),
weakly-consistent never-throwing iterators, and fine-grained internal
synchronization. Different contract, not just different speed.

**★ Why is `computeIfAbsent` "the one-line cache", and what are its two contract traps?**
Check-and-load is atomic per key: racing callers block on that key and
share the single computed value — the duplicate-load race is gone by
contract. Traps: the function runs under the key's lock, so it must be
fast (cache a future for slow loads); and it must not touch other keys of
the same map — recursive updates are forbidden and can throw or deadlock.

**★ Why do concurrent maps reject `null` values when `HashMap` allows them?**
`HashMap` lets you disambiguate `get(k) == null` with `containsKey(k)`.
Concurrently, that two-call idiom races — the answer can change between
calls — so `null` must carry one unambiguous meaning: absent.

**★ What is a weakly consistent iterator?**
The concurrent packages' alternative to fail-fast: traversal never throws
`ConcurrentModificationException`, visits each element at most once, and
reflects the collection at or after iterator creation — concurrent updates
may or may not appear. Snapshot iterators (COW) are the strict version:
exactly the state at creation, never anything later.

**★ Design the buffer between request threads and a slow downstream writer.**
Bounded `BlockingQueue` (`ArrayBlockingQueue(N)`): producers `offer` with
a timeout — full queue becomes an explicit shed/degrade decision instead
of hidden memory growth; the consumer `take`s, blocking while idle.
Capacity is the latency budget: how much acceptable lag the buffer may
absorb before push-back, same reasoning as
[executor queue sizing](06-executorservice-pools/03-scheduling-and-sizing.md).

**★ When is `CopyOnWriteArrayList` the right structure, and what makes it wrong elsewhere?**
Traversal-dominated, rarely-mutated collections — listener lists iterated
per event, mutated per subscription. Every mutation copies the array, so
write-heavy use is quadratic-ish churn; and iterators are snapshots, so
readers never see concurrent additions — right for consistency, wrong if
"latest" is required.

**★ `SynchronousQueue` has zero capacity. What is it *for*?**
Handoff: a `put` completes only when a consumer `take`s, so the queue
transfers items thread-to-thread without buffering. `newCachedThreadPool`
uses it to give each arriving task to a free thread immediately or spawn
one — the "queue" enforces that work never waits behind other work.

---

← Prev: [Atomics](10-atomics.md) · Index: [Phase 6 — Concurrency](README.md) · Next → **12 · `ThreadLocal` and `ScopedValue`** *(not written yet)*
