---
title: "Exceptions as control flow — why not"
sidebar_label: "07 · Exceptions as control flow"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation
> (docs.oracle.com/en/java/javase/25/) for `Throwable` (constructor
> semantics, `fillInStackTrace`, the four-argument protected constructor),
> `Optional`, `Iterator` and `Integer.parseInt`, plus JLS §11 (exception
> semantics) and the HotSpot troubleshooting guide's description of
> `OmitStackTraceInFastThrow`.

**An exception is a non-local `goto` with a price tag: construction captures
the entire stack, the jump is invisible to the reader, and every JVM
optimizes assuming it is rare. The design rule that falls out: throw for a
*broken invariant* — a state the code promised could not happen — and return
a value (`Optional`, a result type, an empty collection) for *expected
absence* — a miss the caller must plan for anyway. "The item wasn't found"
is a Tuesday; it is not exceptional.**

## The decision line

| The situation | Expected or broken? | Shape |
|---|---|---|
| lookup by ID that can miss | expected — callers must handle it | [`Optional<T>`](../phase-4-lambdas-streams/07-optional/README.md) |
| user input fails validation | expected — that's what validation is for | result type / error list, not a throw per field |
| collection has no matching element | expected | `Optional` (`findFirst`) or empty collection |
| file that may legitimately not exist yet | expected | check or `Optional`-shaped API |
| the "impossible" enum branch is reached | broken invariant | `throw new IllegalStateException(...)` |
| argument violates the documented contract | broken invariant (caller bug) | `IllegalArgumentException` |
| I/O fails mid-read | broken environment | `IOException` — genuinely exceptional |
| connection pool exhausted | broken environment | throw — the caller can't "handle" it locally |

The test that settles borderline cases: **would a correct caller need a
`catch` on the happy path?** If yes — if catching is how the feature works,
not how it fails — the design is using exceptions as control flow, and a
return type says it better.

## What throwing-for-flow actually costs

**1. Construction, not throwing, is the expensive part.** `Throwable`'s
constructors call `fillInStackTrace()`, which walks and records every frame
on the current stack at the moment of construction. The cost is proportional
to stack depth — and lookups that miss tend to happen deep inside call
chains. The JDK's own API acknowledges this: the protected
`Throwable(String message, Throwable cause, boolean enableSuppression,
boolean writableStackTrace)` constructor exists precisely so a subclass can
opt out of stack capture. An exception thrown once per request is noise; an
exception constructed per element in a loop is a measurable tax paid for
information (the trace) nobody reads.

**2. The reader loses the happy path.** `try`/`catch` used as branching
means the function's *normal* result arrives via the `catch` block —
control jumps backwards, past intervening frames, to a handler that may be
several calls away. A returned `Optional` keeps the miss in the method
signature, where the compiler makes the caller look at it.

**3. The JVM optimizes against you.** HotSpot assumes throws are rare: the
non-throwing path is the one that gets streamlined. And when an *implicit*
exception (NPE, `ArrayIndexOutOfBoundsException`, arithmetic) is thrown
repeatedly from the same hot site, HotSpot's "fast throw" optimization
(`-XX:-OmitStackTraceInFastThrow` disables it) starts recycling a
preallocated exception **with an empty stack trace** — the JVM literally
stops paying for the trace you weren't using. Production symptom: an NPE
with no stack trace in the logs. That flag's existence is the JVM's own
verdict on hot-path throwing.

**4. Exceptions don't compose.** Streams, `Optional` chains and
`CompletableFuture` pipelines all speak return values; a throw punches
through them ([the lambda patterns](../phase-4-lambdas-streams/01-lambdas-functional-interfaces/03-composition-checked-exceptions.md)
exist to patch exactly this mismatch).

## The honest borderline cases

- **`Integer.parseInt` has no non-throwing form.** The JDK offers no
  `tryParse`, so validating user-supplied numbers means catching
  `NumberFormatException` — and that is fine. The *API* forced the shape;
  wrap it once in a small `Optional<Integer> parse(String)` helper and the
  rest of the codebase gets the right shape back.
- **`Iterator`'s `NoSuchElementException` is not control flow.** The
  protocol is `hasNext()` then `next()`; the exception fires only when a
  caller breaks that protocol — a bug signal, exactly what exceptions are
  for. Code that calls `next()` in a `catch`-terminated loop instead of
  checking `hasNext()` is the anti-pattern, not the API.
- **`InterruptedException` is a designed signal, not abuse.** Cooperative
  cancellation *works* by throwing from blocking calls; catching it and
  stopping (or restoring the interrupt flag) is the intended handshake.
- **Framework sentinels.** Some frameworks throw internally to unwind
  (Scala's `NonLocalReturnControl`, JVM-language generators). They pay for
  it with stackless exceptions — see below — and they own both ends of the
  throw. Application code borrowing the trick owns neither.

## Stackless exceptions — the escape hatch and its price

```java
final class PoolExhaustedSignal extends RuntimeException {
    static final PoolExhaustedSignal INSTANCE = new PoolExhaustedSignal();
    private PoolExhaustedSignal() {
        super(null, null, false, false);   // no suppression, NO stack trace
    }
}
```

With `writableStackTrace = false`, `fillInStackTrace` never runs — the
constructor cost collapses and the singleton can be reused. This is the
legitimate tool for a genuinely hot, protocol-shaped signal (the JDK and
frameworks use the pattern internally). The price is severe: **no trace
means no forensics** — if the signal ever escapes its intended handler, the
log shows an exception born nowhere. Shared singletons also mean no
per-occurrence state and no meaningful `addSuppressed`. Reach for this only
when a profiler — not a hunch — says exception construction is hot, and the
throw site and catch site are owned by the same module.

## Result types in plain Java

For operations with *structured* failure — the caller needs to know *why*,
not just *whether* — a sealed result beats both `Optional` (which erases the
reason) and a thrown exception (which derails the flow).
[Sealed types as ADTs](../phase-2-classes-objects/09-sealed-adts.md) is the
machinery; the shape:

```java
sealed interface ParseResult<T> {
    record Ok<T>(T value) implements ParseResult<T> {}
    record Malformed<T>(String detail, int offset) implements ParseResult<T> {}
    record Unsupported<T>(String feature) implements ParseResult<T> {}
}

return switch (parser.parse(input)) {
    case Ok<Config>(var cfg)          -> start(cfg);
    case Malformed<Config>(var d, var off) -> reject(400, d + " at " + off);
    case Unsupported<Config>(var f)   -> reject(422, "unsupported: " + f);
};
```

The compiler enforces exhaustiveness — a new failure case breaks every
caller at *compile* time, which a new thrown exception type never does.
The line to hold: result types for failures the caller is expected to
branch on; exceptions for failures the caller can only propagate.

## Gotchas

**Symptom:** profiler shows `Throwable.fillInStackTrace` hot inside a parsing/lookup loop
**Cause:** an exception constructed per miss — per element — as the "not found" signal; cost scales with stack depth × miss rate
**Fix:** return `Optional`/a result type from the lookup; if the API is fixed (e.g. `parseInt`), wrap it once at the boundary

**Symptom:** production log full of `NullPointerException` (or AIOOBE) entries with no stack trace at all
**Cause:** HotSpot's `OmitStackTraceInFastThrow` — the same implicit exception thrown repeatedly from a hot site gets a recycled, stackless instance; the missing trace is itself evidence the throw is hot
**Fix:** fix the hot throw (it's a bug happening constantly, not occasionally); to capture one full trace while diagnosing, restart with `-XX:-OmitStackTraceInFastThrow`

**Symptom:** business logic reads upside-down — the "success" handling lives in `catch` blocks
**Cause:** exceptions used as the branch for outcomes the feature *expects* (item missing, validation failed)
**Fix:** move expected outcomes into the return type; keep `catch` for propagation and translation only

**Symptom:** validation reports only the first error; users fix fields one at a time
**Cause:** throw-on-first-failure — an exception can carry only one unwinding, so error *accumulation* is structurally impossible
**Fix:** validate into a list of failures (or a result type holding them) and report all at once; throwing is per-incident, collecting is per-form

**Symptom:** a reused singleton exception shows the *wrong* stack trace in logs, pointing at an unrelated call site
**Cause:** a cached exception instance built *with* a writable stack trace — the trace was filled once, at cache time, and lies forever after
**Fix:** cached/preallocated exceptions must pass `writableStackTrace = false`; a trace that can't be true should not exist

**Symptom:** `catch (NoSuchElementException e)` wrapped around an iterator loop "for safety"
**Cause:** protocol exception treated as a possible outcome — but it only fires when `hasNext` was skipped or the collection changed mid-loop
**Fix:** drive the loop with `hasNext()`/for-each; let the exception surface, because it marks a bug worth seeing

**Symptom:** after a refactor to `Optional`, callers write `opt.orElseThrow()` everywhere and nothing improved
**Cause:** the miss really *was* an invariant violation for those callers — `Optional` forced ceremony onto a case that should throw
**Fix:** the decision line runs per call site: offer both a `find...` (Optional) and a `get...` (throwing) accessor, as `findFirst()` vs `getFirst()` do

## Interview questions

**★ Where exactly is the cost of a Java exception — construction, throw, or catch?**
Overwhelmingly construction: `Throwable`'s constructor calls
`fillInStackTrace()`, walking every frame on the stack, so cost scales with
depth. The throw/unwind is comparatively cheap, and a `try` region that
never throws is essentially free at runtime. That is why the four-argument
constructor lets subclasses disable stack capture.

**★ Give the rule for "return `Optional`" vs "throw", with one example each.**
`Optional` for expected absence — outcomes a correct caller must branch on:
`findCustomerById` returns `Optional` because unknown IDs are normal input.
Throw for broken invariants — states the contract says cannot happen:
`ArrayDeque.getFirst()` throws on empty because the caller asserted
non-emptiness by choosing the non-`Optional` accessor.

**★ Why do production NPEs sometimes arrive with no stack trace, and what does it tell you?**
HotSpot's fast-throw optimization (`OmitStackTraceInFastThrow`, on by
default): an implicit exception thrown repeatedly from the same compiled
site is replaced with a preallocated, stackless instance. It tells you two
things — the throw site is *hot* (this bug fires constantly), and you can
recover one full trace by disabling the flag or reading the earliest
occurrences in the log, before the optimization kicked in.

**★ When is a stackless exception the right tool, and what do you give up?**
When a throw is genuinely a protocol signal on a measured hot path, and the
same module owns both throw and catch — construct with the
`(msg, cause, false, false)` super-call so `fillInStackTrace` never runs.
You give up forensics (an escaped signal is untraceable), per-occurrence
state, and suppression — so it is a profiler-justified exception, never a
default.

**★ `Integer.parseInt` throws for bad input. Does that make catching `NumberFormatException` "exceptions as control flow"?**
Mechanically yes, and it's still correct — the JDK provides no non-throwing
parse, so the catch is the only available shape. The design lesson points
at API authors: parse-style operations should return `Optional`/result
types. As a consumer, wrap the throwing call once behind a small
`Optional`-returning helper so the wrong shape doesn't spread.

**★ Why can't throw-based validation report more than one error, and what replaces it?**
A throw unwinds immediately — the first failure abandons the rest of the
checks, so accumulation is structurally impossible. Replace with
collect-then-decide: run all checks into a `List<Violation>` (or a sealed
result carrying it) and fail once with the full set — which is also what
users need to fix a form in one pass.

**★ A sealed `Result` type and a checked exception both force callers to acknowledge failure. How do you choose?**
Sealed result when the caller is expected to *branch* on failure cases as
part of the feature — exhaustive `switch` gives compile-time coverage of
each reason. Checked exception when the failure can only be *propagated or
translated* — but note modern application code leans unchecked even there
(**topic 01** *(not written yet)* has that debate). The wrong choice shows
up as `catch` blocks with business logic, or as `Result` plumbed through
five layers that only the top one inspects.

---

← Prev: [Checked exceptions inside lambdas](06-checked-exceptions-lambdas.md) · Next → [Where the global handler lives](08-global-handler.md)
