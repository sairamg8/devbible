---
title: "static: class-level state and methods"
sidebar_label: "11 · static"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.3.1.1 (static fields), §8.4.8.2
> (hiding of class methods), §12.4 (initialization of classes), and the JDK 25
> API documentation.

**A `static` member belongs to the class, not to any instance: one copy per
class, alive from class initialization until the class itself is unloaded —
which for application classes means the life of the process. That lifetime is
the whole story. It is why constants and pure utility functions are perfect as
statics, and why *mutable* static state is the single most reliable way to
make tests order-dependent, threads race, and memory "leak" in a
garbage-collected language.**

## What static actually means

```java
public class Counter {
    static int created;          // one field, shared by every instance
    int id;                      // one field per instance

    Counter() {
        created++;               // read-modify-write on shared state (see below)
        this.id = created;
    }
}
```

- A static field exists once, regardless of how many instances exist — even
  zero. It is initialized when the class is initialized (first active use —
  the lazy-loading story from
  [the JVM at run time](../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)).
- A static method is invoked on the class, needs no instance, and therefore
  **cannot touch instance state** (`this` does not exist inside it). The
  compile error "non-static variable cannot be referenced from a static
  context" — the first error every Java learner meets in `main` — is this
  rule, not a mystery.
- Statics are held via the class, so they are GC roots in practice: **whatever
  a static field references stays reachable for the life of the process**
  ([the GC model](../phase-0-platform-jvm/08-garbage-collection.md) — statics
  are the canonical unintentional-retention scope).

## Statics do not override — they hide

Instance methods dispatch dynamically on the runtime type. Static methods
resolve **at compile time, by the static type of the reference** (JLS
§8.4.8.2). A subclass declaring an identically-signed static method *hides*
the parent's; nothing ever dispatches dynamically:

```java
class Base   { static String who() { return "base"; } }
class Child extends Base { static String who() { return "child"; } }

Base ref = new Child();
// ref.who() compiles — and resolves to Base.who(), because ref's TYPE is Base.
```

Two consequences:

- Calling a static method *through an instance variable* is legal and
  misleading — the instance is ignored entirely. The infamous shape:
  `myThread.sleep(1000)` compiles, and puts the **current** thread to sleep,
  because it means `Thread.sleep(1000)`. Always call statics on the class
  name; IDEs and linters flag the instance form for exactly this reason.
- `@Override` on a static method is a compile error — the compiler is telling
  you the mechanism you are imagining does not exist.

## Why mutable static state is the enemy

**Of tests.** A static field survives from one test to the next inside the
same JVM. Tests that mutate it pass alone and fail in suite (or the reverse),
fail under a parallel runner, and depend on execution order — the definition
of flaky. JUnit creates a fresh *instance* per test precisely so instance
state resets; statics opt out of that protection.

**Of threads.** `created++` above is a read-modify-write on shared state with
no synchronization — two threads constructing at once can lose an update.
Every mutable static is a global variable shared by all threads, and unless it
is confined, synchronized or atomic, it is a data race waiting for load
(Phase 6 owns the full story).

**Of design.** A static mutable field is invisible coupling: any code anywhere
can read or write it, so the dependency appears in no constructor signature
and no test can see what a class actually needs. The dependency-injection
style Phase 9 teaches exists largely to make this coupling explicit again.

## The good statics

- **Constants**: `static final` fields referencing *immutable* values —
  `static final Duration TIMEOUT = Duration.ofSeconds(5);`. Both words do
  work: `static` = one copy, `final` = never reassigned. (A `static final
  List` that is mutable is not a constant — gotcha below.)
- **Pure functions**: `Math.max`, `Objects.requireNonNull`, your own
  stateless helpers. No instance state read or written, same inputs → same
  output. These are the *safest* code in any codebase.
- **Static factory methods**: `List.of(...)`, `Duration.ofSeconds(5)`,
  `User.fromRow(rs)`. Versus constructors they can have names, return cached
  instances, and return a subtype — which is why modern APIs lean on them.
- **The utility class**, done deliberately:

```java
public final class SlugUtil {              // final: not designed for extension
    private SlugUtil() {}                  // no instances — it's a namespace
    public static String slugify(String s) { /* ... */ }
}
```

- **The lazy holder idiom** — thread-safe lazy initialization with no locks in
  the fast path, riding on the JVM's guarantee that class initialization is
  atomic and happens once (JLS §12.4):

```java
public class Config {
    private static class Holder {
        static final Config INSTANCE = Config.load();   // runs at first access
    }
    public static Config get() { return Holder.INSTANCE; }
}
```

## Static imports

`import static org.assertj.core.api.Assertions.assertThat;` makes test code
read as prose, and `import static java.lang.Math.*` makes a formula legible.
Outside those two shapes, a static import hides *where a method comes from* —
`process(order)` that is secretly `OrderUtils.process` costs every future
reader a jump-to-definition. Use them for DSL-like APIs (assertions,
`Mockito.when`) and mathematics; write the class name elsewhere.

## Gotchas

**Symptom:** `myThread.sleep(5000)` — and the *current* thread sleeps, not `myThread`
**Cause:** `sleep` is static; the call resolves to `Thread.sleep` by the reference's type, and the instance is ignored
**Fix:** call statics on the class (`Thread.sleep(...)`). There is no API to sleep *another* thread — that would be interruption territory

**Symptom:** a subclass's static method "override" never runs when called through a parent-typed reference
**Cause:** statics hide, they don't override — resolution is compile-time by static type
**Fix:** if you need dispatch, you need instance methods (or a sealed hierarchy + `switch`). `@Override` refusing to compile on a static was the early warning

**Symptom:** tests pass individually, fail in the suite — or fail only under the parallel runner
**Cause:** mutable static state carried across tests in the same JVM: a static cache, counter, or registry mutated by one test and read by the next
**Fix:** don't mutate statics from production-code paths under test; reset in `@BeforeEach` as a stopgap; redesign toward instance state wired by constructor — the real fix

**Symptom:** a counter/id sequence in a static field skips or repeats values under load
**Cause:** `count++` is a read-modify-write race — statics are shared by all threads with no implicit synchronization
**Fix:** `AtomicLong` (Phase 6), or per-instance state. A static mutable primitive touched by request threads is a bug shape, not a style choice

**Symptom:** memory grows for the life of the process; the heap dump shows a giant map hanging off a static field
**Cause:** statics live until class unload — effectively forever — so an unbounded static cache is the textbook Java "leak"
**Fix:** bound it (size/TTL — Caffeine exists for this) or scope the cache to an object with a lifecycle. [The GC page](../phase-0-platform-jvm/08-garbage-collection.md) has the retention taxonomy

**Symptom:** `static final List<String> CODES = new ArrayList<>()` — and its contents changed in production
**Cause:** `final` fixes the *reference*, not the object; a mutable collection in a `static final` is still global mutable state wearing a constant's name
**Fix:** `List.copyOf(...)` / `List.of(...)` for genuinely immutable constants; UPPER_SNAKE naming is reserved for those

**Symptom:** a static field read config "too early" — changing the system property later has no effect
**Cause:** static initializers run once, at first active use of the class; the value was captured at class-initialization time
**Fix:** read dynamic config at call time, or inject it; keep static initializers for genuinely fixed values. (Initialization timing: [the JVM at run time](../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md))

**Symptom:** two classes' static initializers each touch the other; startup deadlocks or a field is observed half-initialized
**Cause:** circular class initialization — the JVM runs initializers under a per-class lock, and cycles can see defaults or block
**Fix:** break the cycle; keep static initializers trivial and dependency-free. If two classes need each other at init time, the design is telling you something

**Symptom:** unit-testing code that calls a static method requires heavyweight mocking
**Cause:** static calls are hard dependencies — no seam to substitute
**Fix:** statics for *pure* logic (test the real thing — it's pure), instances behind interfaces for anything with I/O or state. Mockito's static mocking exists, and reaching for it routinely is the design smell itself

## Interview questions

**★ What does `static` mean, and when is a static field initialized?**
The member belongs to the class — one copy total, not one per instance —
initialized when the class is initialized, which the JVM does lazily at first
active use. It then lives until the class is unloaded: for application code,
the life of the process.

**★ Can a static method be overridden?**
No — it can only be *hidden*. Static calls are resolved at compile time by
the static type of the reference; there is no dynamic dispatch. That is why
`@Override` on a static is a compile error and why calling a static through
an instance reference is misleading.

**★ Why is mutable static state bad for tests specifically?**
It persists across tests in the same JVM, so tests become order-dependent
and break under parallel execution. JUnit's fresh-instance-per-test model
resets instance state; statics deliberately sit outside it.

**★ When would you choose a static factory method over a constructor?**
When a name adds meaning (`Duration.ofSeconds`), when instances can be cached
or reused (`Integer.valueOf`, `List.of`), or when the return type should be
an interface or subtype the caller doesn't name. Constructors can do none of
the three.

**★ Explain the static holder idiom.**
Lazy, thread-safe initialization without locks: the value lives in a `static
final` field of a private nested class, so it is created exactly once, when
that nested class is first accessed — riding the JVM's guarantee that class
initialization is atomic and once-only.

**Why can't a static method use `this` or instance fields?**
There may be zero, one, or a thousand instances when it runs — the method has
no instance in hand, so `this` is undefined by construction. Static context
can only reach static state.

**A `static final` field — is it necessarily a constant?**
Only if the referenced value is immutable. `static final` guarantees the
*reference* never changes; a mutable object behind it (a growable list, a
`Date`) is shared mutable global state and should be neither named nor
treated as a constant.

**What is the memory consequence of a static reference?**
Everything reachable from it is retained for the class's lifetime —
effectively the process's. Unbounded static caches are the canonical Java
memory leak, and the heap-dump dominator tree (Phase 12) almost always ends
at one.

---

← Prev: [Methods: overloading, varargs, pass-by-value](10-methods.md) · Index: [Phase 1 — Language core](README.md) · Next → [`final`](12-final.md)
