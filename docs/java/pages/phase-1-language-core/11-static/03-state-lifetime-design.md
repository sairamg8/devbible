---
title: "State, lifetime and design"
sidebar_label: "3 · State, lifetime, design"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.3.1.1, the JDK 25 API
> documentation (`java.lang.Math`, `java.util.List`, `java.util.Objects`),
> and JVMS §5.3–§5.4 (classloaders and per-loader class identity).

**A static field's lifetime is the class's lifetime, and every thread in the
process shares the one copy. Read that sentence as a threat model and the
design rules write themselves: immutable statics are free infrastructure;
mutable statics are global variables with a JVM accent — invisible coupling,
test-order dependence, data races, and the canonical Java memory leak, all in
one keyword.**

## Why mutable static state is the enemy

**Of tests.** A static field survives from one test to the next inside the
same JVM. Tests that mutate it pass alone and fail in suite (or the reverse),
fail under a parallel runner, and depend on execution order — the definition
of flaky. JUnit creates a fresh *instance* per test precisely so instance
state resets; statics opt out of that protection.

**Of threads.** `created++` on a static is a read-modify-write on shared
state with no synchronization — two threads constructing at once can lose an
update. Every mutable static is a global variable shared by all threads, and
unless it is confined, synchronized or atomic, it is a data race waiting for
load (Phase 6 owns the full story).

**Of design.** A static mutable field is invisible coupling: any code
anywhere can read or write it, so the dependency appears in no constructor
signature and no test can see what a class actually needs. The
dependency-injection style Phase 9 teaches exists largely to make this
coupling explicit again.

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

The `private` constructor is not ceremony: it converts "nobody *should*
instantiate this" into "nobody *can*", stops subclassing as a side effect,
and documents the class as a namespace. Keep utility classes for genuinely
stateless functions — the moment one grows a field, it has changed category
and needs the scrutiny above.

## Lifetime: the class, the classloader, the leak

Statics are rooted in the class; the class is rooted in its **classloader**.
Three consequences:

- **For ordinary applications** the classloader lives as long as the process,
  so a static reference retains its object graph *forever*. An unbounded
  `static Map` cache is the textbook Java "leak" — nothing is lost, but
  nothing is ever freed ([the GC model](../../phase-0-platform-jvm/08-garbage-collection.md)).
- **Statics are per-class-per-classloader, not per-JVM.** Two classloaders
  loading the same class produce two classes with two independent sets of
  statics. In containers that isolate deployments by loader, your "singleton"
  can exist twice — and code that assumes one copy per process breaks.
- **The redeploy leak:** anything that pins a reference to a class from a
  discarded deployment — a registered driver, a static in a shared library
  holding "the" instance, a lingering thread — pins that deployment's whole
  classloader, and with it every class and every static it loaded.

## Testing seams

A static call is a hard-wired dependency — there is no constructor parameter
to substitute. The rule of thumb:

- **Pure static logic** needs no seam: test the real thing, it has no state.
- **Statics with I/O or state** (`Clock.systemUTC()` read directly,
  `System.currentTimeMillis()`, a static HTTP helper) are the classic
  untestable shape. Inject the capability instead — `Clock` exists precisely
  to be the injectable version of "now".
- Mockito's static mocking exists, and reaching for it routinely is the
  design smell itself: the test is fighting a coupling the code should not
  have.

## Gotchas

**Symptom:** tests pass individually, fail in the suite — or fail only under the parallel runner
**Cause:** mutable static state carried across tests in the same JVM: a static cache, counter, or registry mutated by one test and read by the next
**Fix:** don't mutate statics from production-code paths under test; reset in `@BeforeEach` as a stopgap; redesign toward instance state wired by constructor — the real fix

**Symptom:** a counter/id sequence in a static field skips or repeats values under load
**Cause:** `count++` is a read-modify-write race — statics are shared by all threads with no implicit synchronization
**Fix:** `AtomicLong` (Phase 6), or per-instance state. A static mutable primitive touched by request threads is a bug shape, not a style choice

**Symptom:** memory grows for the life of the process; the heap dump shows a giant map hanging off a static field
**Cause:** statics live until class unload — effectively forever — so an unbounded static cache is the textbook Java "leak"
**Fix:** bound it (size/TTL — Caffeine exists for this) or scope the cache to an object with a lifecycle. [The GC page](../../phase-0-platform-jvm/08-garbage-collection.md) has the retention taxonomy

**Symptom:** `static final List<String> CODES = new ArrayList<>()` — and its contents changed in production
**Cause:** `final` fixes the *reference*, not the object; a mutable collection in a `static final` is still global mutable state wearing a constant's name
**Fix:** `List.copyOf(...)` / `List.of(...)` for genuinely immutable constants; UPPER_SNAKE naming is reserved for those

**Symptom:** unit-testing code that calls a static method requires heavyweight mocking
**Cause:** static calls are hard dependencies — no seam to substitute
**Fix:** statics for *pure* logic (test the real thing — it's pure), instances behind interfaces for anything with I/O or state. Mockito's static mocking exists, and reaching for it routinely is the design smell itself

**Symptom:** a "singleton" exists twice — two caches, two connection registries — inside one application server
**Cause:** statics are per-classloader; two deployments (or a shared-lib/webapp split) loaded the class in two loaders
**Fix:** locate the class in exactly one loader (or accept per-deployment copies and design for it); never assume `static` means per-process in a container

**Symptom:** redeploying a webapp leaks the whole old application — heap shows two copies of every class
**Cause:** something pinned the old deployment's classloader: a static in a longer-lived library holding an instance, an underegistered driver, a still-running thread
**Fix:** unregister/close in a shutdown hook; keep references to app classes out of statics owned by longer-lived loaders

## Interview questions

**★ Why is mutable static state bad for tests specifically?**
It persists across tests in the same JVM, so tests become order-dependent
and break under parallel execution. JUnit's fresh-instance-per-test model
resets instance state; statics deliberately sit outside it.

**★ When would you choose a static factory method over a constructor?**
When a name adds meaning (`Duration.ofSeconds`), when instances can be cached
or reused (`Integer.valueOf`, `List.of`), or when the return type should be
an interface or subtype the caller doesn't name. Constructors can do none of
the three.

**★ A `static final` field — is it necessarily a constant?**
Only if the referenced value is immutable. `static final` guarantees the
*reference* never changes; a mutable object behind it (a growable list, a
`Date`) is shared mutable global state and should be neither named nor
treated as a constant.

**★ What is the memory consequence of a static reference?**
Everything reachable from it is retained for the class's lifetime —
effectively the process's. Unbounded static caches are the canonical Java
memory leak, and the heap-dump dominator tree (Phase 12) almost always ends
at one.

**Is a static field unique per JVM?**
Per class per *classloader*. Ordinary applications have one relevant loader,
so it behaves as per-process — but application servers and plugin systems
load classes in multiple loaders, and each gets independent statics. The
"double singleton" in a container is this.

**How do you make code that depends on "now" testable?**
Stop calling the static directly. Inject a `java.time.Clock` and derive
`Instant.now(clock)` — the production wiring passes `Clock.systemUTC()`, the
test passes `Clock.fixed(...)`. The same move generalizes to any static with
I/O behind it.

**What's the correct shape for a utility class?**
`final` class, `private` constructor, only static pure functions, no state.
The private constructor turns a convention into a compiler guarantee and
marks the class as a namespace rather than a type.

---

← Prev: [Initialization and `<clinit>`](02-initialization-clinit.md) · Index: [`static`](README.md) · Next → [`final`](../12-final.md)
