---
title: "Almost every heap leak is one of four shapes — a collection nobody bounded, a queue that absorbs backpressure instead of applying it, a static field that outlives everything, and a key whose equals and hashCode were never written — and each has a fix that is one line and a diagnosis that is one query"
sidebar_label: "05 · The usual suspects"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 source at tag `jdk-25+36`** —
> `java/util/LinkedHashMap.java` (`removeEldestEntry` javadoc),
> `java/util/concurrent/Executors.java` (`newFixedThreadPool`) and
> `java/util/HashMap.java`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/util/LinkedHashMap.java)),
> the **JDK 25 API documentation** for `ThreadPoolExecutor` and `Map`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)),
> and the **JDK 25 Troubleshooting Guide**'s characterisation of a Java-language memory leak
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)).
> **No sandbox** — the Java below is illustrative source, never a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The guide's definition of a Java memory leak is precise and worth holding on to: *"the
application is unintentionally holding references to objects, which prevents the objects from
being garbage collected."* Every leak is that sentence. What varies is *where* the unintended
reference lives, and in practice it lives in one of a small number of places. This chunk is the
four that account for most heap leaks; the three that need their own treatment —
`ThreadLocal`s, classloaders and listener registrations — follow in
[05b](05b-threadlocal-on-a-pooled-thread.md), [05c](05c-finding-a-classloader-leak-in-a-dump.md)
and [05d](05d-listeners-callbacks-and-forgotten-registrations.md).**

## 1 · The cache nobody bounded

```java
// this is a leak with a helpful name
private final Map<String, Report> cache = new ConcurrentHashMap<>();

Report get(String key) {
    return cache.computeIfAbsent(key, this::buildReport);
}
```

Nothing here is wrong except that the key space is unbounded. If `key` is a user id, a tenant id,
a request id, a URL, a date, or anything derived from input, the map grows for as long as the
process runs. It looks like a cache and behaves like a list of everything you have ever seen.

**In a dump:** small shallow size, enormous retained size, an accumulation point at the
`ConcurrentHashMap$Node[]` table, and the "interesting object" MAT names above it is your service
class. [04b](04b-shallow-versus-retained.md) is the reading; this is the shape it describes.

**The JDK's own bounded cache**, whose javadoc says exactly what it is for:

> *"Returns `true` if this map should remove its eldest entry… It provides the implementor with the
> opportunity to remove the eldest entry each time a new one is added. This is useful if the map
> represents a cache: it allows the map to reduce memory consumption by deleting stale
> entries."*

```java
private static final int MAX_ENTRIES = 10_000;

private final Map<String, Report> cache =
        Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
            @Override protected boolean removeEldestEntry(Map.Entry<String, Report> eldest) {
                return size() > MAX_ENTRIES;
            }
        });
```

The `true` third constructor argument is access order rather than insertion order, which turns it
from FIFO into LRU. Note the javadoc's warning that this method *"typically does not modify the map
in any way"* and that *"the effects of returning `true` after modifying the map from within this
method are unspecified"* — do not remove entries yourself inside it.

For anything beyond that, use a real cache library with a size or weight bound and an expiry
policy. The question to ask of any cache in a code review is not "is it fast" but **"what is its
maximum size, expressed in entries or bytes, and where in the source is that number?"** If there
is no such number, it is not a cache.

## 2 · The queue that absorbs backpressure

```java
ExecutorService pool = Executors.newFixedThreadPool(8);
```

The javadoc, verbatim: *"Creates a thread pool that reuses a fixed number of threads operating off
a shared **unbounded queue**."* And the source confirms there is no capacity argument:

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>());
}
```

🔴 **An unbounded work queue converts a throughput problem into a memory problem.** When arrival
rate exceeds service rate, the queue grows — silently, with no error, no metric moving except heap
— until the heap is gone. Every queued task retains whatever it captured: the request, the payload,
the entity graph.

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
        8, 8, 0L, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(1_000),                   // a bound, chosen deliberately
        new ThreadPoolExecutor.CallerRunsPolicy());        // backpressure, not failure
```

`CallerRunsPolicy` makes the submitting thread execute the task, which slows the producer — that
is what backpressure *is*. `AbortPolicy` (the default) throws `RejectedExecutionException`, which
is honest but has to be handled. Either is better than an unbounded queue, because either one makes
overload visible as overload rather than as an `OutOfMemoryError` three hours later.

The same argument applies to any unbounded buffer: a `BlockingQueue` between producer and consumer,
a batching accumulator that flushes "when convenient", a retry queue, an in-memory outbox, an
async logging appender's ring buffer.

## 3 · The static field that outlives everything

A `static` field is reachable from the `Class`, which is reachable from its `ClassLoader`, which
for application classes on the system loader lives for the life of the JVM. MAT names this root
type **System Class**: *"Class loaded by bootstrap/system class loader."*

```java
public final class Registry {
    // lives until the JVM exits, no matter what
    private static final List<Session> ACTIVE = new CopyOnWriteArrayList<>();

    static void register(Session s) { ACTIVE.add(s); }
    // ... and nothing ever calls remove
}
```

The tell in a dump is that the path to GC roots is one hop long and ends in the class itself. There
is no lifecycle to fix; the object was never going to be collected. The fixes are the obvious ones
— bound it, or give it a removal call and make sure something invokes it — and the review question
is **"what removes from this?"**

Two variants that hide better:

- **A static field holding a whole graph.** A single static `ApplicationContext`, `DataSource` or
  `ObjectMapper` is fine; a static field holding the last response, the last exception or the last
  request is a leak with a size equal to whatever that graph reaches.
- **A `static` collection in a library, populated on your behalf.** `DriverManager`'s driver list,
  a metrics registry's meter map, an MBean server's registrations. You did not write the `static`
  and you still have to deregister — [05d](05d-listeners-callbacks-and-forgotten-registrations.md).

## 4 · The key whose `equals` and `hashCode` were never written

```java
// no equals, no hashCode -> identity semantics
final class CacheKey {
    private final String tenant;
    private final long id;
}

map.put(new CacheKey(tenant, id), value);   // a NEW entry, every single time
```

Every call creates an object that is unequal to every existing key, so `put` inserts rather than
replaces and `get` never hits. The map grows without bound and the cache has a zero hit rate. It is
simultaneously a memory leak and a performance bug, and it is invisible in a code review unless you
open the key class.

The dump signature is distinctive: a very large number of instances of one key type, each holding
one value, with no duplicates in the logical sense. A histogram entry of "1.4 million `CacheKey`"
alongside "1.4 million `Report`" for a tenant population of forty is the answer on its own.

The modern form of this bug is subtler and worth naming:

```java
record CacheKey(String tenant, long id) { }        // fine: record gives equals/hashCode
final class CacheKey { ... }                       // not fine unless you write them
```

Records generate both. Lombok's `@Data` generates both. A hand-written class generates neither, and
a hand-written class with `equals` but no `hashCode` is worse — it behaves correctly in a `List`
and catastrophically in a `HashMap`.

⚠️ **A mutable key is the same bug with an intermittent schedule.** If a field used by `hashCode`
changes after insertion, the entry becomes unreachable through `get` but is still in the table, so
the map grows and nothing can ever be removed. `Map`'s own javadoc warns about it: *"the behavior
of a map is not specified if the value of an object is changed in a manner that affects `equals`
comparisons while the object is a key in the map."*

## The review questions these four reduce to

1. **What bounds this collection, and where is the number?**
2. **What happens when this queue is full?** ("It cannot be full" is the wrong answer.)
3. **What removes from this static?**
4. **Does this key type define `equals` and `hashCode`, and are the fields it uses immutable?**

Four questions that fit on a pull-request checklist and catch the majority of heap leaks before
they exist.

## Gotchas

**★ `Executors.newFixedThreadPool` has an unbounded queue and the javadoc says so.**
*"a shared unbounded queue"*. So does `newSingleThreadExecutor`. The pool bounds the *threads*, not
the *work*, and under sustained overload the queue is the thing that consumes the heap. Construct a
`ThreadPoolExecutor` with an explicit bounded queue and a chosen rejection policy instead.

**★ An unbounded queue does not fail — it postpones.**
Nothing throws, nothing is rejected, no metric moves except heap. The failure surfaces hours later
as an `OutOfMemoryError` whose stack trace points at whatever allocated next. This is the single
most misleading leak shape, because the cause and the symptom share no code.

**★ A `Map` used as a cache with no eviction is not a cache.**
The distinguishing feature of a cache is that it can discard. Without a size bound, a weight bound
or an expiry policy, it is a permanent record of every key ever seen. `LinkedHashMap` with
`removeEldestEntry` is the JDK's own answer and needs three lines.

**★ `removeEldestEntry` defaults to `false`, so plain `LinkedHashMap` bounds nothing.**
*"This implementation merely returns `false` (so that this map acts like a normal map - the eldest
element is never removed)."* Using `LinkedHashMap` because it "is the LRU one" without overriding
the method gets you a `HashMap` with predictable iteration order.

**★ Access-order `LinkedHashMap` is not thread-safe even for `get`.**
`get` reorders the linked list, so it is a structural modification. An unsynchronised
access-ordered `LinkedHashMap` read concurrently corrupts. Wrap it, or use a cache library.

**★ A key class without `hashCode` turns a bounded cache into an unbounded one.**
Every lookup misses, every put inserts. The map's *logical* size stays small while its actual size
grows without limit, so a size-bounded cache still evicts correctly and still never hits — the leak
moves to whatever the values reference.

**★ Mutating a field used by `hashCode` after insertion strands the entry permanently.**
The entry is in the table but unreachable by `get` or `remove`, and `Map`'s javadoc says the
behaviour *"is not specified"*. Bounded caches do not save you: the eviction policy can still find
it, but nothing else can.

**★ A static field is reachable from a GC root by definition.**
MAT's **System Class** root type covers it. There is no lifecycle event that will clean it up, no
scope it falls out of, and no collector that will decide it is unused. The only fix is code that
removes.

**★ The bound you choose has to be in bytes-equivalent terms, not entries.**
Ten thousand entries of a small record and ten thousand entries holding a full entity graph differ
by orders of magnitude. If the values vary in size, an entry count is not a memory bound; a weight
function or an explicit size cap is.

**★ Every one of these looks completely normal in code review.**
A `ConcurrentHashMap` field, an `Executors.newFixedThreadPool(8)`, a `static final List`, a small
key class — none of them is unusual, none triggers a linter, and all four are leaks. That is why
the four questions above are worth asking mechanically rather than when something looks suspicious.

## Interview questions

**★ What is a memory leak in Java, given that there is a garbage collector?**
The Troubleshooting Guide's phrasing is the precise one: *"the application is unintentionally
holding references to objects, which prevents the objects from being garbage collected."* The
collector is doing exactly its job — it will not reclaim anything reachable — so a Java leak is
always a reachability bug rather than a deallocation bug. That reframing is useful in practice
because it tells you the diagnostic: find the reference chain from a GC root, which is precisely
what a dominator tree and a path-to-GC-roots query give you.

**★ Why is `Executors.newFixedThreadPool` a memory risk?**
Because it bounds the wrong thing. The javadoc says it creates a pool *"operating off a shared
unbounded queue"*, and the source shows a `LinkedBlockingQueue` with no capacity. Bounding threads
without bounding the queue means that whenever arrival rate exceeds service rate, the excess
accumulates on the heap — each queued task holding whatever it captured — with no error, no
rejection and no metric moving except heap usage. The fix is an explicit `ThreadPoolExecutor` with a
bounded queue and a deliberate `RejectedExecutionHandler`: `CallerRunsPolicy` if you want
backpressure onto the producer, `AbortPolicy` if you want to fail fast and shed load.

**★ You find a `HashMap` with two million entries in a dump and the application logically has
forty tenants. What do you look at?** The key class. Two million entries for forty logical keys
means every `put` inserted rather than replaced, which means the keys are unequal to each other —
almost always because the key type inherits identity `equals` and `hashCode` from `Object`. A
hand-written class with no `equals`, a class with `equals` but no `hashCode`, or a class whose
`hashCode` uses a field that was mutated after insertion all produce it. The secondary tell is that
the cache has a zero hit rate, so it is a performance bug and a leak at once, and converting the key
to a `record` fixes both.

**★ How would you bound a cache using only the JDK?**
`LinkedHashMap` with `removeEldestEntry` overridden, which is what the javadoc offers it for:
*"it allows the map to reduce memory consumption by deleting stale entries."* Construct it with
`accessOrder = true` for LRU rather than FIFO, override `removeEldestEntry` to return
`size() > MAX`, and wrap it for thread safety — access-ordered `get` mutates the list, so even
reads need synchronisation. The limitations are real: no time-based expiry, no weight-based sizing,
coarse locking. For anything with varying entry sizes or a need for expiry, a proper cache library
is the right answer, but the JDK version is three lines and is far better than nothing.

**★ What questions do you ask about memory in a code review?**
Four, mechanically. What bounds this collection, and where is that number in the source? What
happens when this queue is full — and "it cannot be full" is not an answer, it is the bug. What
removes entries from this static field? And does this map key define `equals` and `hashCode` over
immutable fields? Those four catch the great majority of heap leaks before they exist, and each of
them is answerable in seconds by someone who did not write the code.

{/* FOOTER */}
