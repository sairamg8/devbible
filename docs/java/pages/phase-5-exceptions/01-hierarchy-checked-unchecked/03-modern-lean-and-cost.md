---
title: "The modern lean, and what exceptions cost"
sidebar_label: "3 · The modern lean, and cost"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Throwable` (including
> `fillInStackTrace` and the `Throwable(String, Throwable, boolean, boolean)`
> protected constructor), `UncheckedIOException`, and JLS SE 25 §11.2; the
> sneaky-throws mechanics against JLS §18 (inference) as commonly analyzed —
> behaviour statements kept qualitative, no measurements invented; the
> exception-table compilation model against JVMS SE 25 §3.12.

**The working default in modern Java application code: throw unchecked
domain exceptions, translate third-party failures at the boundary where
they enter, and reserve checked exceptions for the narrow edges where the
immediate caller genuinely recovers. Alongside the design lean sits a cost
model worth knowing precisely — because "exceptions are slow" is true in a
specific place (construction, not `throw`), and the fix people reach for
(stackless exceptions) has sharp edges.**

## The lean, concretely

What "unchecked in application code, translation at boundaries" looks like
in a service:

```java
// the domain exception: unchecked, carries the cause
public class OrderRepositoryException extends RuntimeException {
    public OrderRepositoryException(String message, Throwable cause) {
        super(message, cause);
    }
}

// the boundary: vendor checked exception enters, domain unchecked leaves
public Order load(OrderId id) {
    try {
        return jdbc.queryForOrder(id);            // throws SQLException
    } catch (SQLException e) {
        throw new OrderRepositoryException(
            "loading order " + id + " failed", e); // ALWAYS pass the cause
    }
}
```

Above this method, no signature mentions `SQLException`; below it, the
vendor type never escapes. Topic 04 develops the full pattern (translation
layers, what a good message carries); this chunk owns the *why*:

- **Boundaries are where context lives.** The repository knows it was
  "loading order 42"; five frames up, a `SQLException` is just noise with a
  vendor code. Translation attaches meaning at the last point that has it.
- **Signatures stay honest.** Service methods declare domain failures (or
  nothing), so swapping Postgres for a web service changes one boundary,
  not every signature in between.
- **Lambdas stop fighting.** Unchecked exceptions pass through
  `Function`/`Stream` machinery without wrappers —
  [the composition patterns](../../phase-4-lambdas-streams/01-lambdas-functional-interfaces/03-composition-checked-exceptions.md)
  become rare instead of routine.

The JDK endorses the bridge itself: **`UncheckedIOException`** exists
precisely to carry an `IOException` across non-declaring interfaces —
`Files.lines`' stream throws it from lazy reads after the checked
`IOException` was only possible at open time. When the JDK needed streams
over I/O, it chose wrap-to-unchecked; that is the strongest precedent the
lean has.

## Sneaky throws — know it, don't use it

Java's generics inference permits a hole: a generic `throws T` method can
be made to throw a checked exception the compiler never sees at the call
site:

```java
@SuppressWarnings("unchecked")
static <T extends Throwable> RuntimeException sneak(Throwable t) throws T {
    throw (T) t;    // erasure: no cast check; caller declared nothing
}
// somewhere: throw sneak(new IOException("smuggled"));
```

The result is an `IOException` in flight with no `throws`, no wrapper, and
no compile-time trace — `catch (IOException e)` around the call site is
even a *compile error* ("never thrown in body"), while at runtime exactly
that type flies. Lombok's `@SneakyThrows` industrializes the trick.
The verdict for reviewed code: it breaks the one thing everyone relies on —
that checked exceptions are either declared or wrapped — so confine it to
test helpers, if anywhere. Wrapping costs one allocation and keeps the
contract legible.

## What throwing actually costs

The cost model, stated qualitatively (measure before optimizing —
**Phase 12 · The JVM in production** *(not written yet)* covers the tools):

- **Construction is the expensive part.** `Throwable`'s constructor calls
  `fillInStackTrace()`, which walks and records the entire call stack at
  the throw site. Deep stacks (servlet containers, Spring proxies,
  recursive code) make this proportionally worse. The `throw`/unwind
  itself, and the `catch`, are cheap by comparison.
- **The stack trace is captured even if nobody reads it.** An exception
  created, caught two frames up and discarded still paid the full walk —
  the classic hidden cost of exception-as-control-flow (topic 07 makes the
  design argument; this is its price tag).
- **Creation without throwing costs the same** — `new
  IllegalStateException()` stored in a field for later has already walked
  the stack. (Some logging "enrichment" patterns do this per call and
  wonder where the time went.)
- **JIT caveat:** hot, repeatedly-thrown exceptions can be optimized in
  ways that *remove* the trace (the infamous pre-allocated / OmitStackTrace
  behaviours for implicit exceptions) — an optimization that manifests as
  "my production NPE has no stack trace", which is a diagnosability trap,
  not a feature to rely on.

**The escape hatch the JDK provides:** the protected constructor
`Throwable(String message, Throwable cause, boolean enableSuppression,
boolean writableStackTrace)`. Passing `writableStackTrace = false` creates
a **stackless exception** — no stack walk at construction, immutable empty
trace. It exists for two honest cases:

```java
class PoisonPill extends RuntimeException {
    PoisonPill() { super(null, null, false, false); }  // control signal, hot path
}
```

1. **Flow-control signals in constrained hot paths** (parser backtracking,
   queue poison pills) where the exception is caught immediately and the
   trace is never wanted.
2. **High-frequency validation failures** where the *message* is the
   payload and volume makes traces a memory/CPU tax.

The edges: a stackless exception that *escapes* its intended scope is a
production incident with no forensics — the trace you saved is the trace
you needed. Default to full traces; go stackless only with a measurement
in hand and containment proven.

## Gotchas

**Symptom:** service latency spikes; profiler shows time in `Throwable.fillInStackTrace`
**Cause:** an exception thrown per element/per request as routine flow (lookup misses modeled as throws), each paying a full stack walk under deep frameworks
**Fix:** model the expected case as a value (`Optional`, result type — topic 07); keep exceptions for the exceptional

**Symptom:** production log shows `NullPointerException` with an empty stack trace
**Cause:** JIT optimization of a *very* hot implicit exception replaced it with a preallocated stackless instance
**Fix:** `-XX:-OmitStackTraceInFastThrow` while diagnosing; then fix the NPE that fired thousands of times — the missing trace is a symptom of frequency

**Symptom:** `catch (IOException e)` around a library call is a compile error, yet an `IOException` crashes that exact line in production
**Cause:** the library sneaky-throws (e.g. `@SneakyThrows`) — the checked type flies without declaration, and the compiler "knows" it can't
**Fix:** catch it as `Exception` and `instanceof`-check, pressure the library to wrap honestly, and ban sneaky throws in your own code

**Symptom:** `UncheckedIOException` from a stream pipeline that "did all its I/O at open time"
**Cause:** `Files.lines` reads lazily; disk errors surface mid-terminal-operation wrapped unchecked
**Fix:** consume inside try-with-resources around the stream, and catch `UncheckedIOException` where the terminal op runs; `.getCause()` recovers the original

**Symptom:** domain exception wraps a cause, but logs show only the top message — the DB error is invisible
**Cause:** translation created `new DomainException(msg)` without passing the cause
**Fix:** the two-arg constructor, always; a translation that drops the cause destroys the forensic chain (topic 05 reads them; topic 04's rule: *always pass the cause*)

**Symptom:** custom "signal" exception with `writableStackTrace=false` escapes to the global handler; incident has zero context
**Cause:** a stackless control-flow exception leaked past its containment
**Fix:** stackless types stay package-private next to their single catch site; anything that can cross a module boundary carries a trace

## Interview questions

**★ Defend "unchecked in application code" to a checked-exception advocate.**
Application-layer callers can't act on transport-level failures — forcing
declarations through five layers produces contaminated signatures and
ritual catches, and interface evolution freezes (`throws` is part of the
contract). Translating to unchecked domain types at the boundary keeps the
failure information (via the cause chain) while signatures describe the
domain. Concede the edge: at the immediate I/O boundary, checked types are
defensible — that's where recovery is real.

**★ What's the most expensive part of an exception's life, and when is it paid?**
Construction — `fillInStackTrace` walks the whole stack at `new`-time
(unless suppressed via the four-arg constructor). Throwing and catching are
cheap by comparison; the cost is paid even if the exception is never thrown
or its trace never read.

**★ What is `UncheckedIOException` evidence of?**
That the JDK itself needed a bridge from checked to unchecked when streams
met I/O: `Files.lines` can't declare `IOException` through
`Stream`'s interfaces, so lazy read failures arrive wrapped. It legitimizes
wrap-to-unchecked as the standard seam pattern — with the cause preserved
for unwrapping.

**★ How does sneaky-throws work, in one sentence, and why is it banned in most styles?**
A generic `throws T` method casts a checked `Throwable` to `T`, which
erasure never checks, so the checked type propagates undeclared — breaking
the compile-time contract that makes checked exceptions mean anything, and
producing call sites where catching the real type is a compile error.

**★ When would you build a stackless exception, and what must you prove first?**
Tight-scope control signals or high-volume validation where a profile shows
construction cost matters and the catch site is adjacent and guaranteed.
Prove containment (it cannot escape to generic handlers) and keep it
package-private; an escaped stackless exception is an incident without
forensics.

**★ Does a `try` block cost anything when nothing is thrown?**
Essentially nothing: handlers compile to *exception table* entries (ranges
of bytecode mapped to handler addresses — JVMS §3.12), consulted only when
a throw actually unwinds. The happy path executes no extra instructions
for being guarded. The corollary: wrapping code in `try` "just in case" is
free at runtime; the costs live in exception *construction* and in what
broad catching does to correctness, not in the block itself.

**★ Where should a retry live relative to translation?**
Below or at the boundary, around the vendor exception — retry logic needs
the *original* type's semantics (which `SQLException`s are transient, which
`IOException`s are timeouts). Once translated to a domain exception, that
information is a cause-chain dig away; retrying on domain types couples
policy to the wrong layer.

---

← Prev: [Checked exceptions — the mechanics and the debate](02-checked-mechanics-debate.md) · Index: [The hierarchy, checked vs unchecked](README.md) · Next → [`try`/`catch`/`finally` mechanics](../02-try-catch-finally/README.md)
