---
title: "Initialization and <clinit>"
sidebar_label: "2 · Initialization and <clinit>"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §12.4 (initialization of classes
> and interfaces), §12.4.1 (when initialization occurs), §12.4.2 (the
> detailed procedure and the per-class init lock), §8.7 (static
> initializers), §4.12.4/§13.4.9 (constant variables and their binary
> compatibility), and JVMS §2.9.2 (`<clinit>`).

**Static state does not appear when the program starts — it appears when the
class is first *actively used*, all at once, under a per-class lock, exactly
once. The compiler collects every static field initializer and every
`static { }` block, in textual order, into one synthetic method the JVMS
calls `<clinit>`, and the JVM guarantees it completes before any thread sees
the class's statics. Most of what this chunk covers is what falls out of
those guarantees: free thread-safe lazy singletons on the good side; captured
config, init cycles, and cross-thread deadlocks on the bad side.**

## What triggers initialization (JLS §12.4.1)

A class `T` is initialized on the first occurrence of any of:

- an instance of `T` is created;
- a static method of `T` is invoked;
- a static field of `T` is assigned or read — **unless it is a constant
  variable** (below);
- a subclass of `T` is initialized (superclasses initialize first);
- `T` is the class named at JVM startup (the `main` class);
- reflective use (`Class.forName`, method handles resolving against `T`).

Notably *not* on the list: loading, `T.class` literals, declaring a field of
type `T`, or creating an array `new T[10]`. A class can be loaded and sit
uninitialized indefinitely — loading and initialization are separate phases
([the JVM at run time](../../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)).

## Textual order, one method

```java
class Config {
    static final Map<String, String> DEFAULTS = loadDefaults();  // runs first
    static { validate(DEFAULTS); }                               // runs second
    static final String REGION = DEFAULTS.get("region");         // runs third
}
```

Field initializers and `static` blocks execute **in the order they appear in
the source** (JLS §12.4.2), stitched into `<clinit>`. A static field read
*before* its initializer has run — reachable via an init cycle or a call made
from an earlier initializer — is seen at its default value (`null`, `0`,
`false`), not as an error.

## Constant variables are different — they are inlined

A *constant variable* (JLS §4.12.4) is a `static final` field of primitive or
`String` type initialized with a compile-time constant expression:

```java
public static final int MAX_RETRIES = 3;           // constant variable
public static final Duration TIMEOUT = Duration.ofSeconds(5);  // NOT one (not a constant expression)
```

Two consequences, both surprising:

- **Reading it does not trigger class initialization** — the value was copied
  into the *using* class at compile time.
- **Changing it in a library does not change it for compiled clients** (JLS
  §13.4.9): every client baked in the old value and must be recompiled. A
  `static final int` in a published API is a wire-format commitment, not a
  variable.

## The lazy holder idiom

Thread-safe lazy initialization with no locks in the fast path, riding on the
guarantee that class initialization is atomic and happens once:

```java
public class Config {
    private static class Holder {
        static final Config INSTANCE = Config.load();   // runs at first access
    }
    public static Config get() { return Holder.INSTANCE; }
}
```

`Holder` initializes only when `get()` first touches it — the JVM's init lock
*is* the synchronization. Compare **the enum singleton**
(Phase 2 · [Enums](../../phase-2-classes-objects/10-enums/README.md)): same
once-only guarantee, plus serialization- and reflection-proofing, minus the
laziness being separable from the enclosing class. Holder when the value is
expensive and optional; enum when the singleton is part of the domain.

## Cycles, half-initialized reads, and deadlocks

Initialization runs under a **per-class lock** (JLS §12.4.2). Two failure
shapes:

- **Same-thread cycle:** `A`'s `<clinit>` uses `B`, whose `<clinit>` uses
  `A`. The JVM detects the re-entry and lets `B` proceed against a
  *partially initialized* `A` — `B` sees `A`'s later fields as defaults.
  No error, just wrong values.
- **Cross-thread cycle:** thread 1 initializes `A` (holding `A`'s lock,
  wanting `B`'s) while thread 2 initializes `B` (holding `B`'s, wanting
  `A`'s). That is a classic deadlock, and it happens at *startup*, the worst
  time to debug.

An exception thrown inside `<clinit>` surfaces as
`ExceptionInInitializerError`, and the class is marked *erroneous* — every
later use throws `NoClassDefFoundError` with no underlying cause attached
(the NPE-reading page [walks this trap](../13-null-and-npe/01-reading-an-npe.md)).

## Gotchas

**Symptom:** a static field read config "too early" — changing the system property later has no effect
**Cause:** static initializers run once, at first active use of the class; the value was captured at class-initialization time
**Fix:** read dynamic config at call time, or inject it; keep static initializers for genuinely fixed values

**Symptom:** two classes' static initializers each touch the other; startup deadlocks or a field is observed half-initialized
**Cause:** circular class initialization — the JVM runs initializers under a per-class lock; same-thread cycles see defaults, cross-thread cycles can block forever
**Fix:** break the cycle; keep static initializers trivial and dependency-free. If two classes need each other at init time, the design is telling you something

**Symptom:** a library bumped `public static final int VERSION` and running clients still report the old number
**Cause:** constant variables are inlined into using classes at compile time (JLS §13.4.9) — the client `.class` files hold a copy
**Fix:** recompile clients, or don't publish constants that can change: use a method, or a non-constant-expression initializer, which forces a real field read

**Symptom:** the first request after startup is slow and the profiler blames a cascade of `<clinit>` frames
**Cause:** lazy initialization deferred an expensive static graph to first active use — the cost didn't vanish, it moved to the first caller
**Fix:** deliberate warm-up (touch the classes at startup), or make the expensive work explicit instead of hiding it in initializers

**Symptom:** `ExceptionInInitializerError` once, then only `NoClassDefFoundError` on every later use — the real cause is gone from the logs
**Cause:** a throwing `<clinit>` marks the class erroneous; retries don't re-run it and don't carry the original exception
**Fix:** find the *first* occurrence in the logs; keep initializers simple enough that they cannot plausibly throw

**Symptom:** a `static final` field is `null` inside a constructor called during class initialization
**Cause:** an earlier initializer (or a superclass `<clinit>`) constructed an instance before the later field initializers ran — textual order means "not yet", not "never"
**Fix:** don't create instances of a class from within its own static initialization; reorder so dependencies precede uses

## Interview questions

**★ When exactly does a static field get its value?**
During class initialization — first active use: first instance creation,
static method call, or non-constant static field access. All static
initializers run then, in textual order, atomically under the class's init
lock, before any thread can observe the statics.

**★ Explain the static holder idiom.**
Lazy, thread-safe initialization without locks: the value lives in a `static
final` field of a private nested class, so it is created exactly once, when
that nested class is first accessed — riding the JVM's guarantee that class
initialization is atomic and once-only.

**★ Why doesn't reading `SomeClass.MAX_RETRIES` initialize `SomeClass`?**
Because a `static final` primitive/String with a compile-time-constant
initializer is a *constant variable*: the compiler inlines its value into
the reader. Corollary: changing it in the library doesn't reach
already-compiled clients until they recompile.

**★ What is `<clinit>` and who calls it?**
The synthetic method the compiler builds from all static field initializers
and static blocks, in source order. Nobody calls it from code — the JVM
invokes it during the initialization phase, under the per-class init lock,
at most once.

**What does a same-thread initialization cycle do — error or silent?**
Silent and wrong: the JVM allows the re-entrant use and the second class
observes the first's not-yet-initialized fields as defaults (`null`/`0`).
Only cross-thread cycles deadlock; neither is an exception.

**Why is the second failure always `NoClassDefFoundError` with no cause?**
A `<clinit>` that throws marks the class erroneous. The original
`ExceptionInInitializerError` (with the real cause) fires exactly once;
every subsequent use gets the bare `NoClassDefFoundError`. Root-causing means
scrolling logs back to the first hit.

---

← Prev: [Class, not instance](01-class-not-instance.md) · Index: [`static`](README.md) · Next → [State, lifetime and design](03-state-lifetime-design.md)
