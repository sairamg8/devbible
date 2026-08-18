---
title: "Legacy types"
sidebar_label: "16 · Legacy types"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.Vector`, `Hashtable`, `Stack` (whose class doc itself
> recommends `Deque`), `Enumeration`, `Properties` and
> `Collections.synchronizedList`; JEP 374 (biased locking disabled/deprecated,
> JDK 15) for the synchronization-cost note.

**`Vector`, `Hashtable` and `Stack` are Java 1.0 collections that predate
the collections framework and survive only for backward compatibility. You
read them in twenty-year-old code and in a few old APIs; you never write
them. Their headline feature — every method `synchronized` — is the reason
to avoid them twice over: it taxes every single-threaded call, and it
still fails to make multi-step operations safe.**

## What they are, and what replaced them

| Legacy (1.0) | What it is | Write instead |
|---|---|---|
| `Vector<E>` | synchronized growable array | `ArrayList` (topic 05); if truly shared: `CopyOnWriteArrayList` or `Collections.synchronizedList` (phase 6) |
| `Hashtable<K,V>` | synchronized hash table, no null keys *or* values | `HashMap` (topic 07); if truly shared: `ConcurrentHashMap` (phase 6) |
| `Stack<E>` | LIFO… by extending `Vector` | `ArrayDeque` via the `Deque` interface (topic 09) |
| `Enumeration<E>` | pre-`Iterator` cursor: `hasMoreElements`/`nextElement` | `Iterator`; bridge with `Collections.list(e)` or `e.asIterator()` (JDK 9+) |

When Java 1.2 shipped the collections framework, `Vector` and `Hashtable`
were retrofitted to implement `List` and `Map` — which is why they still
compile everywhere a modern type is expected, and why they linger.

## Synchronized-per-method: slow *and* insufficient

Each method takes the object's monitor. Cost side: since biased locking
was disabled (JEP 374, JDK 15), even uncontended lock/unlock is real work
on every `get` — pure waste in the single-threaded code most `Vector`
usage actually is.

Correctness side — the sharper point: per-method locks don't compose.
Each call is atomic; the *sequence* is not:

```java
if (!tasks.isEmpty()) {          // thread A: true
    Task t = tasks.remove(0);    // thread B removed the last task in between
}                                // → ArrayIndexOutOfBoundsException
```

This check-then-act race is exactly as broken on a `Vector` as on an
`ArrayList` — the lock is released between the two calls. Compound
operations need one lock around the whole sequence (or a concurrent
collection designed for the pattern, like `ConcurrentHashMap.computeIfAbsent`
— phase 6). Iteration is the same story: even the modern
`Collections.synchronizedList` wrapper's doc requires you to hold the lock
manually around a whole iteration. "It's synchronized" was never the same
claim as "it's thread-safe for what you're doing".

## `Stack extends Vector` — the inheritance mistake

`Stack` is the JDK's own textbook case of inheritance abuse (Phase 2's
composition-over-inheritance argument, shipped in the standard library):
a stack *is not* a vector, but by extending one it inherits the full
`List` API — so nothing stops `stack.add(2, x)` inserting into the middle,
or `get(0)` peeking at the bottom. The abstraction doesn't hold, and its
own Javadoc says to use `Deque` instead:

```java
Deque<Frame> stack = new ArrayDeque<>();
stack.push(frame);
Frame top = stack.pop();
```

One migration trap: **iteration order flips.** `Stack` iterates
bottom→top (it's a `Vector` underneath); `ArrayDeque` used as a stack
iterates head-first, i.e. top→bottom (LIFO order, matching `pop` order).
Code that iterated a `Stack` and relied on bottom-first order changes
behaviour when ported naively.

## `Enumeration`, and the corner survivors

`Enumeration` is the 1.0 cursor: `hasMoreElements`/`nextElement`, no
`remove`, and **no fail-fast** — concurrent modification during an
enumeration isn't detected, it just yields undefined results silently
(Iterator's `ConcurrentModificationException` — **topic 11 territory** — was
the fix). It still leaks out of old APIs: `ZipFile.entries()`,
`NetworkInterface.getNetworkInterfaces()`, `Hashtable.keys()`. Bridge and
move on:

```java
Enumeration<? extends ZipEntry> e = zip.entries();
e.asIterator().forEachRemaining(this::process);      // JDK 9+
List<ZipEntry> all = Collections.list(zip.entries()); // materialise
```

Two `Hashtable` descendants you *will* still touch:

- **`Properties`** — `System.getProperties()`, `.properties` file loading.
  It extends `Hashtable<Object,Object>` (another inheritance mistake — raw
  `put` can poison it with non-strings); use only `getProperty`/
  `setProperty`, which keep it string-typed.
- **Nothing else.** `Vector`/`Stack` have no modern niche at all — every
  remaining use in a codebase is either inertia or a signature some 1990s
  API forces (Swing's `DefaultListModel` internals, old JDBC drivers).

## Migration notes — where the drop-in swap bites

Swapping `Hashtable → HashMap` and `Vector → ArrayList` is usually
mechanical, with three honest checks:

1. **Nulls.** `Hashtable` throws `NullPointerException` on null keys *and*
   values; `HashMap` permits them. Migrating legacy→modern is safe;
   modern→`ConcurrentHashMap` re-tightens (it also rejects nulls) and is
   the direction that breaks code which had started storing nulls.
2. **Threads.** If the `Vector` really was shared across threads, an
   `ArrayList` removes even per-method safety. Decide what the code needs:
   `Collections.synchronizedList` reproduces the old (weak) guarantee;
   a `ConcurrentHashMap`/`CopyOnWriteArrayList` or explicit locking fixes
   the compound-operation races the `Vector` never handled anyway.
3. **Growth trivia.** `Vector` doubles capacity where `ArrayList` grows
   ×1.5 — irrelevant to correctness, occasionally visible in memory
   profiles; topic 05 covers sizing.

## Gotchas

**Symptom:** intermittent `ArrayIndexOutOfBoundsException` from multi-threaded code using a `Vector`
**Cause:** check-then-act across two synchronized calls — the lock releases between them
**Fix:** one explicit lock around the compound operation, or a concurrent collection with an atomic compound API (`computeIfAbsent`, `poll`)

**Symptom:** replaced `Hashtable` with `ConcurrentHashMap`; code now throws `NullPointerException` on `put`
**Cause:** an intermediate `HashMap` era let null values creep in — both `Hashtable` and `ConcurrentHashMap` reject them
**Fix:** model absence as absence (no entry / `Optional` at the edges), not as a null value

**Symptom:** ported a `Stack` to `ArrayDeque` and a report now prints reversed
**Cause:** `Stack` iterates bottom→top; `ArrayDeque` iterates top→bottom (pop order)
**Fix:** iterate `deque.descendingIterator()` where the old bottom-first order was load-bearing — after confirming which order was actually intended

**Symptom:** "stack" contents corrupted from the middle
**Cause:** `Stack` inherits `Vector`'s full `List` API — some caller used `add(index, e)`/`remove(index)`
**Fix:** the type made it possible; move to `Deque`, which exposes only ends-based operations

**Symptom:** items skipped (no exception) while walking a `Hashtable` another thread mutates
**Cause:** `Enumeration` is not fail-fast — undefined behaviour instead of `ConcurrentModificationException`
**Fix:** don't share unsynchronised iteration at all; on the modern path the exception at least makes the bug loud — **topic 11's subject**

**Symptom:** `Properties` "loses" a value that was definitely put in
**Cause:** raw `Hashtable.put` stored a non-String key/value; `getProperty` returns null for non-string entries
**Fix:** only `getProperty`/`setProperty`; treat `Properties` as `Map<String,String>` that the type system fails to enforce

## Interview questions

**★ Why is `Vector` discouraged when it's "already thread-safe"?**
Per-method synchronization is the wrong unit: it costs every call
(uncontended locking is real work since biased locking was removed) and
doesn't protect compound operations — check-then-act and iterate-while-
modify still race. Modern code picks either an unsynchronized collection
(usual case) or one designed for concurrency with atomic compound
operations.

**★ What's wrong with `Stack` as a class design?**
It extends `Vector`, so a LIFO abstraction publicly inherits random-access
insertion and removal — the representation leaks into the contract. Its
own Javadoc points to `Deque`/`ArrayDeque`. It's the standard library's
example for composition-over-inheritance.

**★ `Hashtable` vs `HashMap` vs `ConcurrentHashMap` on nulls and locking?**
`Hashtable`: no null keys or values, one lock for everything.
`HashMap`: nulls allowed, no locking. `ConcurrentHashMap`: no nulls
(null would be ambiguous with "absent" under concurrency), fine-grained
internal concurrency plus atomic compound ops. The null rules are the
classic migration surprise in both directions.

**★ `Enumeration` vs `Iterator`?**
`Iterator` added `remove` and fail-fast `ConcurrentModificationException`;
`Enumeration` silently misbehaves under concurrent modification. Bridge
legacy APIs with `asIterator()` (JDK 9) or `Collections.list`, then stay
in `Iterator`/for-each land.

**You inherit a codebase full of `Vector`s. What's your actual plan?**
Grep for shared-across-threads uses first. The single-threaded majority
become `ArrayList` mechanically. For the shared few, identify the compound
operations — those were broken all along — and fix them with the right
phase-6 tool (`ConcurrentHashMap`, `CopyOnWriteArrayList`, or a lock at
the operation level), not with another synchronized wrapper.

---

← Prev: [Writing an Iterable](15-writing-an-iterable.md)
