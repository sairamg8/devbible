---
title: "Filling in a stack trace walks the whole call stack and is the expensive part of throwing, the JVM quietly stops doing it for exceptions it decides are hot — so the trace disappears exactly when the failure becomes frequent enough to matter — and the flag that restores it has been pasted into production JVMs by people who did not know it was a compiler behaviour"
sidebar_label: "09b · Stack traces that cost you"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp),
> which declares `StackTraceInThrowable` (`true`, *"Collect backtrace in throwable when exception
> happens"*), `OmitStackTraceInFastThrow` (`true`, *"Omit backtraces for some 'hot' exceptions in
> optimized code"*) and `MaxJavaStackTraceDepth` (`1024`, *"The maximum number of lines in the
> stack trace for Java exceptions (0 means all)"*); and the **JDK 25 API documentation** for
> `Throwable.fillInStackTrace()` and the protected constructor taking `writableStackTrace`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Throwable.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Constructing an exception is cheap. Capturing its stack trace is not — it walks every frame on
the calling thread — and it happens in the `Throwable` constructor, whether or not anyone ever
reads the trace. When exceptions are rare that cost is irrelevant. When they are used as control
flow it becomes one of the more surprising performance problems in Java, and the JVM's own
mitigation for it is why traces sometimes vanish from production logs at precisely the moment the
failure became common.**

## Where the cost is

`Throwable`'s constructor calls `fillInStackTrace()`, which walks the thread's stack and records
the frames. That is the expensive operation, and three properties make it worse than people
expect:

- **It is proportional to stack depth.** A deep framework stack — a Spring web request through
  filters, proxies and interceptors — is a long walk, and modern stacks are deep.
- **It happens on construction, not on printing.** An exception created and swallowed still paid
  in full. `new SomeException()` stored in a field pays the same as one that is thrown.
- **It is per throw.** There is no caching. An exception thrown a hundred thousand times a second
  fills in a hundred thousand traces.

`MaxJavaStackTraceDepth` bounds the recorded frames at **1024** by default, described in the
source as *"The maximum number of lines in the stack trace for Java exceptions (0 means all)"*.
That is a ceiling on pathological recursion rather than a tuning knob — at ordinary depths it never
binds, and the `0 means all` value is a debugging aid for the case where 1024 frames were
truncating something you needed.

## The fast-throw optimisation, and why traces disappear

This is the behaviour worth knowing cold, because it produces a genuinely confusing production
symptom.

`globals.hpp` declares:

```cpp
product(bool, OmitStackTraceInFastThrow, true,
        "Omit backtraces for some 'hot' exceptions in optimized code")
```

When the JIT sees certain implicit exceptions — `NullPointerException`,
`ArrayIndexOutOfBoundsException`, `ArithmeticException` from an integer divide by zero, and
similar — being thrown repeatedly from the same compiled location, it stops constructing a full
exception and throws a preallocated one instead. That preallocated instance has **no stack trace**.

The resulting symptom is the memorable part: **the log shows a bare
`java.lang.NullPointerException` with no frames at all, and it does so only after the failure has
become frequent.** Rare failures log a full trace; the same failure at volume logs nothing useful.
That is the exact inverse of what an operator wants, and it makes the problem look like a
different problem — people reasonably conclude the logging is broken, or that a formatter is
truncating.

Two things make it worse in practice:

- **It only happens once the method is JIT-compiled**, so it does not reproduce in a short test,
  in a debugger, or under low load. It appears in production and nowhere else.
- **The first few occurrences do have traces.** They are usually far enough back in the log that
  nobody scrolls to them, and the natural instinct is to look at the most recent example — which
  is the one with no information.

The flag `-XX:-OmitStackTraceInFastThrow` disables it and restores full traces. It is one of the
few genuinely useful diagnostic flags in this area, and it comes with a real caveat: **it is
frequently pasted permanently into JVM arguments by people who do not know what it does**, which
gives up the optimisation forever for a diagnosis that was needed once. The honest position is
that it is a *temporary* setting for reproducing a specific problem, and that the better permanent
fix is not throwing NPEs at volume — which is a code defect regardless of the trace.

**JDK 14's helpful `NullPointerException` messages** (JEP 358) interact with this in a way people
miss: the descriptive message is computed when the exception is created, so a fast-thrown
preallocated NPE has neither a trace *nor* a helpful message. Both losses come from the same
optimisation.

`StackTraceInThrowable` (default `true`) is the global switch that disables trace collection
entirely. It appears in tuning discussions and is close to never appropriate for a service: it
saves the cost by removing the ability to diagnose anything.

## Exceptions as control flow

If exceptions are on a hot path, the trace cost dominates, and the JDK gives you an explicit way
to opt out — the protected `Throwable` constructor taking `writableStackTrace`:

```java
public final class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        // enableSuppression = false, writableStackTrace = false
        super(message, null, false, false);
    }
}
```

With `writableStackTrace` false, `fillInStackTrace()` does nothing and the trace is empty. The
older idiom — overriding `fillInStackTrace()` to return `this` — achieves the same and predates the
constructor.

This is genuinely correct for a narrow category: exceptions used as a signalling mechanism where
the *type* carries all the information and the location never will. Framework code does this —
Spring's `NestedRuntimeException` hierarchy and several reactive libraries include stackless
variants for exactly this reason.

It is a trap everywhere else. An exception without a trace is nearly undiagnosable if it ever
escapes to a place you did not anticipate, and the decision is made once, at class-definition
time, by someone who knew the intended use — while the class outlives that knowledge. The
defensible rule: **stackless exceptions are for exceptions that are part of a control-flow
protocol, never for exceptions that represent a fault.**

The better answer, where the code permits it, is not to use exceptions for expected outcomes at
all. A `NotFoundException` thrown for every cache miss is a design decision that costs a stack
walk per miss; returning an `Optional` costs nothing and says the same thing. That argument is
[Phase 5 · Exceptions and failure design](../../phase-5-exceptions/README.md), and this page is
the production-cost evidence for it.

## Depth, volume and the log

Stack traces dominate error-log volume: a single trace through a Spring stack can be sixty lines,
and a `Caused by:` chain multiplies that. Combined with the double logging of
[09](09-exceptions-in-logs.md), one failure can produce several hundred lines. That is the
mechanism behind most surprising logging bills — [11](11-rolling-retention-and-cost.md).

Trimming traces is tempting and mostly wrong. The frames people want to remove — framework,
proxy, reflection — are the ones that reveal *how* the call arrived, which is frequently the
question. The defensible version is to keep full traces and reduce the number of times each
failure is recorded, which costs nothing diagnostically.

## Gotchas

**★ The stack trace is filled in by the constructor, so an exception you never throw still paid
for it.**
`new` is where the cost is, not `throw` and not printing. An exception constructed and discarded
walked the whole stack.

**★ The JVM stops recording traces for hot implicit exceptions, so the trace vanishes when the
failure becomes frequent.**
`OmitStackTraceInFastThrow` defaults to `true`. A bare `java.lang.NullPointerException` with no
frames in a production log is this, not a broken formatter — and it appears only once the method
is JIT-compiled, which is why it never reproduces locally.

**★ The first occurrences do have traces, and they are the ones nobody scrolls back to.**
The optimisation engages after repetition, so the informative examples are the oldest. The
instinct to look at the most recent occurrence lands on the useless one every time.

**★ A fast-thrown NPE loses its JEP 358 helpful message too.**
The descriptive message is computed at construction, so the preallocated instance has neither
trace nor explanation. Both losses have the same cause and are usually attributed to different
ones.

**★ `-XX:-OmitStackTraceInFastThrow` is a temporary diagnostic, not a permanent setting.**
It gets pasted into production arguments and left there, surrendering the optimisation forever for
a diagnosis needed once. The permanent fix is not throwing those exceptions at volume.

**★ `-XX:-StackTraceInThrowable` removes traces globally and is almost never right.**
It genuinely saves the cost, by removing the ability to diagnose anything at all. It appears in
tuning lists; it belongs in none of them for a service.

**★ `MaxJavaStackTraceDepth` is 1024 and is a runaway-recursion ceiling, not a tuning knob.**
At ordinary depths it never binds. Its useful value is `0` — *"0 means all"* — for the rare case
where truncation removed something you needed.

**★ A stackless exception is undiagnosable the moment it escapes its intended path.**
`super(message, null, false, false)` is correct for control-flow signalling and a trap for
anything representing a fault. The decision is made once by someone who knew the intent, and the
class outlives them.

**★ Exceptions used for expected outcomes pay a stack walk per occurrence.**
A `NotFoundException` per cache miss is a design decision with a measurable cost. `Optional` says
the same thing for free, and the exception's location was never going to be informative anyway.

**★ Stack depth in a framework application is deep, so the walk is not trivial.**
Filters, proxies, interceptors and reflective invocation produce long stacks. The cost is
proportional to that depth, which is why the same code is cheap in a unit test and expensive in
production.

**★ Trimming framework frames removes the part that explains how the call arrived.**
It is the standard suggestion for reducing error-log volume and it removes diagnostic value. Cut
the number of times each failure is logged instead — that costs nothing.

**★ Traces plus double logging is the usual explanation for a surprising log bill.**
Sixty lines per trace, a cause chain, and five layers logging it. The volume is a multiplication,
not an addition, which is why it surprises people.

## Interview questions

**★ Why is throwing an exception expensive, and which part is the expensive bit?**
Filling in the stack trace. The `Throwable` constructor calls `fillInStackTrace()`, which walks
every frame on the calling thread and records them, and the cost is proportional to stack depth —
which in a framework application, with filters, proxies, interceptors and reflective dispatch, is
substantial. Three details make it worse than people assume. It happens on *construction*, so an
exception that is created and never thrown, or thrown and swallowed, has paid in full. It is not
cached, so an exception on a hot path pays per occurrence. And the actual `throw` and the stack
unwinding are comparatively cheap, which means the intuition that "throwing is slow because of
unwinding" points at the wrong thing and leads people to the wrong fix. The practical consequence
is that exceptions used for expected outcomes — a not-found signalled by an exception on every
cache miss — carry a real cost that a returned `Optional` does not.

**★ A production log shows `java.lang.NullPointerException` with no stack trace at all. What is
happening?**
The JIT's fast-throw optimisation. `OmitStackTraceInFastThrow` defaults to `true`, and when the
compiler sees certain implicit exceptions — NPE, array index out of bounds, integer divide by zero
— thrown repeatedly from the same compiled location, it stops constructing a full exception and
throws a preallocated instance with no stack trace. So the trace disappears exactly when the
failure becomes frequent, which is the inverse of what you want and reliably reads as a logging
bug. Two follow-on details matter: it only engages once the method has been JIT-compiled, so it
never reproduces in a test or a debugger and appears only under production load; and the earliest
occurrences *do* carry full traces, but they are far enough back in the log that nobody scrolls to
them. On JDK 14 and later the helpful NPE message is lost with it, since that message is computed
at construction too. The diagnostic is `-XX:-OmitStackTraceInFastThrow`, temporarily — and the
real fix is that an NPE occurring often enough to trigger this is a defect regardless of the
trace.

**★ When is a stackless exception the right choice?**
When the exception is part of a control-flow protocol rather than a report of a fault — where the
*type* carries all the information and the location would never be informative. Signalling
constructs in reactive libraries, and framework exceptions used to unwind to a known handler, are
the legitimate cases, and the JDK supports it directly through the protected `Throwable`
constructor taking `writableStackTrace = false`. What makes it dangerous is that the decision is
permanent and made at class-definition time by someone who knows the intended use, while the class
outlives that knowledge: the moment the exception escapes to a path nobody anticipated, it is
nearly undiagnosable, because there is no trace and adding one requires a code change and a
deploy. So the rule I would defend is that stackless exceptions are acceptable for control flow
and never for faults — and that if a class is being made stackless because it is thrown often
enough for the cost to matter, that fact is itself worth examining, because it usually means
exceptions are being used where a return value belongs.

**★ Someone proposes adding `-XX:-OmitStackTraceInFastThrow` to the production JVM permanently.
What do you say?**
That it is the right flag for the wrong duration. It is genuinely the correct tool for diagnosing
a fast-thrown exception you cannot otherwise locate — nothing else restores the trace, and the
problem does not reproduce outside production. But leaving it on surrenders the optimisation
permanently in exchange for a diagnosis that was needed once, and the optimisation exists
precisely because these exceptions can be thrown at high rates; you are choosing to pay a stack
walk per occurrence forever. It also entrenches the underlying problem: an exception hot enough to
trigger fast-throw is a defect, and once the traces come back the symptom becomes tolerable and
the fix stops being urgent. So: enable it, find the cause, fix the code, remove the flag. If the
team wants a permanent setting to prevent recurrence, the useful one is an alert on the rate of
that exception type, which addresses the actual risk rather than the visibility of it.

**★ Your error logs are the largest part of your logging bill. What do you do about it?**
Not what most people do first, which is to trim stack traces. The frames that get trimmed —
framework, proxy, reflection — are the ones that explain how the call arrived, which is frequently
the whole question, so trimming reduces cost by reducing diagnostic value. The correct first move
is to reduce the number of times each failure is recorded, because most error-log volume is
multiplication rather than addition: one failure logged at five layers with a sixty-line trace and
a cause chain is several hundred lines, and four of those five copies carry no information the
first does not. That costs nothing to fix. After that, structured logging lets you keep the type
and message as queryable fields while making a considered decision about the trace's encoding, and
sampling repeated identical failures — keep the first N per minute per signature, count the rest —
preserves the diagnosis while removing the bulk. Only after all of that would I look at the trace
itself, and even then the question would be depth limits for pathological recursion rather than
removing framework frames.

**★ How can an exception cost you performance without ever being logged or even thrown?**
Because the cost is in the constructor, not the throw. `new SomeException(...)` walks the calling
thread's stack and records every frame at the moment of construction, so an exception created and
then discarded — stored in a field, returned as a value, built speculatively and not used, or
caught immediately and swallowed by an empty block — has paid the full price. This surprises
people because the mental model is that exceptions are expensive when they propagate, and
propagation is comparatively cheap. It shows up in real code in a few recognisable shapes: a
validation routine that builds an exception to decide whether to throw it, a caching layer that
constructs a not-found exception per miss and only sometimes throws it, and library code that uses
exceptions internally and catches them at the boundary — the last being invisible in a profile
attributed to your own code. The fix, where the exception genuinely is a control-flow signal, is
either the `writableStackTrace = false` constructor or, better, not modelling an expected outcome
as an exception at all.

{/* FOOTER */}
