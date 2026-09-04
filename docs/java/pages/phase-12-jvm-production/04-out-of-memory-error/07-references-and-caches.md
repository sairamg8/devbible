---
title: "The four reachability levels are a contract with the collector about when an object may be discarded, and choosing SoftReference for a cache hands the sizing decision to a heuristic driven by -Xmx that will fill whatever heap you give it"
sidebar_label: "07 · References and caches"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Garbage Collection Tuning Guide, Release 25**, "Other
> Considerations → Finalization and Weak, Soft, and Phantom References → Reference-Object Types"
> and "→ Soft References"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), the **JDK 25 `java`
> tool reference** for `-XX:SoftRefLRUPolicyMSPerMB`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), and the
> **JDK 25 source at tag `jdk-25+36`** — `java/util/WeakHashMap.java`'s class javadoc
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/util/WeakHashMap.java)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Reference objects exist so that you can tell the collector "keep this if you can, drop it if you
must". They are the only mechanism in Java for expressing a lifetime that is neither "as long as
someone points at it" nor "right now", and they are routinely reached for as a substitute for
thinking about cache size — which is where they go wrong, because the JVM's heuristic for when to
drop a soft reference is a function of free heap, so a soft cache does not have a size, it has
whatever size you gave the heap.**

## The four levels, in the tuning guide's own words

> *"An object is **strongly reachable** if it can be reached by some thread without traversing any
> reference objects. A newly-created object is strongly reachable by the thread that created it."*
>
> *"An object is **softly reachable** if it is not strongly reachable but can be reached by
> traversing a soft reference."*
>
> *"An object is **weakly reachable** if it is neither strongly nor softly reachable but can be
> reached by traversing a weak reference. When the weak references to a weakly-reachable object are
> cleared, the object becomes eligible for finalization."*
>
> *"An object is **phantom reachable** if it is neither strongly, softly, nor weakly reachable, it
> has been finalized, and some phantom reference refers to it."*
>
> *"An object is **unreachable**, and therefore eligible for reclamation, when it is not reachable in
> any of the previous ways."*

🔴 **Reachability is determined by the *strongest* path.** An object referenced both strongly and
weakly is strongly reachable, and the weak reference is irrelevant. This is why "we made it weak"
so often changes nothing: the strong path that was actually causing the leak is still there.

The guide also names the two legitimate uses:

> *"To maintain access to an object while still allowing it to be garbage collected if the system
> needs to free up memory (such as a cached value that can be regenerated if required)"*
>
> *"To determine and perhaps take some action when an object has reached a particular reachability
> level (in combination with the `ReferenceQueue` class)"*

## `SoftReference`: the cache that sizes itself to your heap

> *"The rate of clearing can be controlled with the command-line option
> `-XX:SoftRefLRUPolicyMSPerMB=<N>`, which specifies the number of milliseconds (ms) a soft
> reference will be kept alive (once it is no longer strongly reachable) for each megabyte of free
> space in the heap. The default value is 1000 ms per megabyte, which means that a soft reference
> will survive (after the last strong reference to the object has been collected) for 1 second for
> each megabyte of free space in the heap. This is an approximate figure because soft references
> are cleared only during garbage collection, which may occur sporadically."*

The `java` man page adds the part that decides whether this is usable at all:

> *"The `-XX:SoftRefLRUPolicyMSPerMB` option accepts integer values representing milliseconds per
> one megabyte of the current heap size (for Java HotSpot Client VM) or **the maximum possible heap
> size** (for Java HotSpot Server VM). This difference means that the Client VM tends to flush soft
> references rather than grow the heap, whereas **the Server VM tends to grow the heap rather than
> flush soft references. In the latter case, the value of the `-Xmx` option has a significant
> effect on how quickly soft references are garbage collected.**"*

Three consequences that together make `SoftReference` a poor choice for most caches:

**The cache has no size you chose.** It expands to fill available heap and clears only under
pressure. Doubling `-Xmx` doubles the cache.

**Clearing happens during collection, and only then.** A burst that allocates faster than the
collector clears references still throws `OutOfMemoryError`. Soft references are not a guarantee
against exhaustion; they are a preference expressed to the collector.

**The eviction policy is the JVM's, not yours.** There is no LRU by access frequency, no weight
function, no expiry, no per-entry cost model — just an approximate age-versus-free-heap heuristic.

⚠️ **And clearing soft references is itself expensive.** The collector has to discover, clear and
enqueue them, which happens on the collection path. A large population of soft references makes
collections slower at exactly the moment the heap is under pressure.

**When `SoftReference` is genuinely right:** a memory-sensitive cache of values that are cheap to
regenerate and expensive to keep, where you would rather have a slow request than an OOM, and where
you have no better way to pick a bound. That is a narrower set of cases than its popularity
suggests. A size- or weight-bounded cache with an explicit maximum is the default answer, because
the number is in your source rather than in the collector's heuristic.

## `WeakReference` and `WeakHashMap`: canonical maps, not caches

Weak references are cleared as soon as the referent is no longer strongly or softly reachable. That
makes them wrong for a cache — the entry disappears as soon as nobody else holds the value, which
is precisely when a cache would be useful — and right for **associating data with an object whose
lifetime someone else owns**: metadata about a `Class`, a canonicalising map, a registry keyed by a
live object.

`WeakHashMap`'s javadoc is unusually candid about what using it feels like:

> *"Because the garbage collector may discard keys at any time, a `WeakHashMap` may behave as though
> an unknown thread is silently removing entries. In particular, even if you synchronize on a
> `WeakHashMap` instance and invoke none of its mutator methods, it is possible for the `size`
> method to return smaller values over time, for the `isEmpty` method to return `false` and then
> `true`, for the `containsKey` method to return `true` and later `false` for a given key, for the
> `get` method to return a value for a given key but later return `null`…"*

🔴 **And the implementation note that turns `WeakHashMap` into a leak:**

> *"**Implementation note:** The value objects in a `WeakHashMap` are held by ordinary strong
> references. Thus care should be taken to ensure that value objects do not strongly refer to their
> own keys, either directly or indirectly, since that will prevent the keys from being discarded.
> Note that a value object may refer indirectly to its key **via the `WeakHashMap` itself**; that
> is, a value object may strongly refer to some other key object whose associated value object, in
> turn, strongly refers to the key of the first value object."*

```java
// a WeakHashMap that can never discard anything
Map<Session, SessionMetadata> meta = new WeakHashMap<>();
meta.put(session, new SessionMetadata(session));   // value holds the key
```

The javadoc's own remedy:

> *"If the values in the map do not rely on the map holding strong references to them, one way to
> deal with this is to wrap values themselves within `WeakReferences` before inserting, as in:
> `m.put(key, new WeakReference(value))`, and then unwrapping upon each `get`."*

⚠️ **The identity trap.** `WeakHashMap` uses `equals`, not identity. The javadoc: *"This class will
work perfectly well with key objects whose `equals` methods are not based upon object identity, such
as `String` instances. With such recreatable key objects, however, the automatic removal of
`WeakHashMap` entries whose keys have been discarded may prove to be confusing."* A `String` key
that is interned or a `record` key that is recreated makes the weakness meaningless or baffling.
The intended key is an object with identity semantics whose lifetime someone else controls.

## `PhantomReference`: for cleanup, not for access

Phantom references cannot be dereferenced — `get()` always returns `null`. Their only use is with a
`ReferenceQueue`, to be told that an object has become unreachable so that a native or external
resource can be released. This is the mechanism behind `Cleaner`, and it is what
`DirectByteBuffer` uses to free its native memory
([`../01-memory-layout/07b`](../01-memory-layout/07b-cleaners-and-deterministic-release.md)).

You should very rarely write one directly. `java.lang.ref.Cleaner` is the supported API, and
[07b · Finalizers and cleaners](07b-finalizers-and-cleaners.md) is where it belongs.

## Choosing

| You want | Use |
|---|---|
| A cache with a size you control | a bounded cache library, or `LinkedHashMap` + `removeEldestEntry` |
| A cache the JVM may empty under pressure | `SoftReference`, knowing it sizes to `-Xmx` |
| Metadata attached to an object someone else owns | `WeakHashMap`, values not referring to keys |
| A canonicalising / interning map | `WeakHashMap` or a weak-value cache |
| To release a native resource when an object dies | `Cleaner` (a `PhantomReference` underneath) |
| A listener registry | **strong plus explicit deregistration** — see [05d](05d-listeners-callbacks-and-forgotten-registrations.md) |

The last row is the one people get wrong most often, and it is the reverse of the intuition: weak
listeners silently stop firing.

## Gotchas

**★ Reachability is decided by the strongest path, so adding a weak reference removes nothing.**
An object referenced both strongly and weakly is strongly reachable. "We changed it to a
`WeakReference` and it still leaks" almost always means the original strong path is still there and
was never the reference you changed.

**★ A `SoftReference` cache is sized by `-Xmx`, not by you.**
`SoftRefLRUPolicyMSPerMB` is milliseconds of survival per free megabyte, and on the server VM it is
computed against the *maximum* heap. The man page's own words: the server VM *"tends to grow the
heap rather than flush soft references"*. Doubling the heap doubles the cache and delays clearing.

**★ Soft references do not prevent `OutOfMemoryError`.**
They are cleared during collection. An allocation burst that outruns the collector still fails. If
the requirement is "must not OOM", a bound is the mechanism and soft references are not.

**★ Clearing a large population of soft references makes collections slower.**
The discovery, clearing and enqueueing happens on the collection path, at exactly the moment the
heap is under pressure. A soft cache trades a memory problem for a latency problem under load.

**★ `WeakHashMap` holds values strongly, and a value that refers to its key leaks for ever.**
The javadoc states it and even names the indirect case *"via the `WeakHashMap` itself"*. The
`Map<Session, MetadataAboutThatSession>` shape is the classic instance and it looks obviously
correct.

**★ `WeakHashMap` uses `equals`, not identity.**
With recreatable keys such as `String` or a `record`, the weakness is either meaningless (interned
strings never die) or confusing (an equal key recreated later finds an entry it did not create).
The intended key is an identity-semantics object owned by someone else.

**★ A `WeakHashMap` mutates itself with no thread doing anything.**
*"a `WeakHashMap` may behave as though an unknown thread is silently removing entries"* — `size`
shrinks, `containsKey` flips from `true` to `false`, `get` returns a value and later `null`. Code
that assumes stability between two calls is wrong even single-threaded.

**★ Weak listener registries silently stop firing for inline lambdas.**
An inline `e -> ...` has no other strong reference. The registry is correct, the listener is
collected, and the feature stops working intermittently. Explicit deregistration is the right answer
for listeners.

**★ `PhantomReference.get()` always returns `null` and that is the point.**
It exists to tell you an object is gone, not to give you access to it. If you find yourself wanting
to dereference one, the design is wrong and the answer is `Cleaner` with the state you need captured
in the cleaning action.

**★ A `ReferenceQueue` you never drain is itself a leak.**
Enqueued reference objects accumulate until something polls the queue. The reference objects are
small, but there is one per referent and nothing removes them.

## Interview questions

**★ Explain the four reachability levels and what each is for.**
Strong is ordinary reachability — reachable *"without traversing any reference objects"* — and
guarantees the object survives. Soft is "reachable only through a `SoftReference`", and the
collector may clear it when it wants memory, which makes it the memory-sensitive-cache level. Weak
is "reachable only through a `WeakReference`", cleared as soon as the object stops being strongly or
softly reachable, which makes it right for metadata attached to an object whose lifetime someone
else owns. Phantom is post-mortem: the object has been finalized and only a `PhantomReference`
refers to it, `get()` returns `null`, and its only use is being notified through a `ReferenceQueue`
so a native resource can be released. The crucial rule underneath all four is that reachability is
determined by the strongest path, so a weak reference alongside a strong one changes nothing.

**★ Why is `SoftReference` a poor default for a cache?**
Because it delegates the sizing decision to a heuristic you do not control and that scales with
`-Xmx`. `SoftRefLRUPolicyMSPerMB` grants a soft reference one second of survival per free megabyte
by default, computed on the server VM against the maximum heap, and the man page says outright that
the server VM *"tends to grow the heap rather than flush soft references"*. So the cache expands to
fill whatever heap you give it, its eviction policy is age-versus-free-memory rather than anything
domain-aware, it still throws `OutOfMemoryError` under a burst because clearing only happens during
collection, and a large population of soft references makes those collections slower at exactly the
wrong moment. A bounded cache with an explicit maximum puts the number in your source, where you can
reason about it.

**★ What is wrong with `Map<Session, SessionMetadata>` as a `WeakHashMap` when
`SessionMetadata` holds the `Session`?** It can never discard anything, and the javadoc says so:
*"The value objects in a `WeakHashMap` are held by ordinary strong references. Thus care should be
taken to ensure that value objects do not strongly refer to their own keys."* The value is strongly
held by the map, the value strongly holds the key, so the key is strongly reachable and the weak
reference never clears. It is a `HashMap` with extra indirection and a false sense of safety. The
javadoc's own remedy is to wrap the values — `m.put(key, new WeakReference(value))` — and unwrap on
each `get`; the alternative is to design the value so it does not need its key.

**★ Should a listener registry use weak references?**
Usually not, and this is the case where the reference-object intuition inverts. Listeners are
overwhelmingly registered as inline lambdas or method references, which have no other strong
reference anywhere — so a weak registry collects them at the next collection and the listener
silently stops firing, producing an intermittent, environment-dependent bug that is much harder to
diagnose than the leak it was meant to prevent. The right answer is a strong registry plus explicit
deregistration, ideally with `add` returning a closeable handle so the pairing is enforced by the
API rather than by memory. Weak registries only work when the observer is independently and
strongly held for its natural lifetime.

**★ When would you use a `ReferenceQueue` directly?**
Almost never — `java.lang.ref.Cleaner` wraps the pattern and gets the details right. The pattern
itself is: create a reference object with a queue, and have something poll the queue to learn that
the referent has become unreachable so an external resource can be released. Direct use is
justified when you need control over which thread performs the cleanup, or when you are building
the cleanup mechanism itself. The trap in doing it yourself is that a queue nobody drains
accumulates reference objects indefinitely, and that the cleaning action must not capture the
referent — capturing it makes it strongly reachable and the reference is never enqueued at all.

{/* FOOTER */}
