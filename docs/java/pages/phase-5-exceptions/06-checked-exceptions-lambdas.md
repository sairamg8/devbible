---
title: "Checked exceptions inside lambdas"
sidebar_label: "06 · Checked exceptions in lambdas"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for the
> `java.util.function` package, `java.io.UncheckedIOException`,
> `Files.lines` (stream-must-be-closed note) and the `java.util.stream`
> package documentation's side-effects section.

**The stream API and checked exceptions were designed a decade apart and it
shows: none of the `java.util.function` interfaces declare `throws`, so the
moment a pipeline calls I/O — `Files.lines(dir).map(path -> Files.size(path))`
— the code stops compiling, and no syntax makes it pretty. What exists
instead is a small set of honest patterns: catch-and-wrap inside the lambda,
a rethrow helper, a throwing functional interface, or extracting a named
method. Knowing which to use where matters less than knowing what each one
*does to the failure* — because the easy fixes quietly change error
semantics.**

## Why it fights you

`Function<T, R>`'s single method declares no checked exceptions, so a
lambda implementing it may not throw one — the compiler rejects the lambda
body, not the stream:

```java
// DOES NOT COMPILE: Files.size throws IOException, Function.apply declares nothing
List<Long> sizes = paths.stream()
        .map(p -> Files.size(p))
        .toList();
```

This is the same rule as any interface implementation: an override cannot
add checked exceptions. Generic `throws` clauses on the functional
interfaces were considered and rejected — the inference and overload
consequences infect every call site
([topic 01](01-hierarchy-checked-unchecked/README.md) has the design
argument). The composition side of this fight — why `andThen` chains can't
carry `throws` either — is
[phase 4's composition chunk](../phase-4-lambdas-streams/01-lambdas-functional-interfaces/03-composition-checked-exceptions.md);
this page owns the *stream pipeline* patterns.

## Pattern 1 — catch and wrap, inline

```java
List<Long> sizes = paths.stream()
        .map(p -> {
            try {
                return Files.size(p);
            } catch (IOException e) {
                throw new UncheckedIOException(e);   // cause attached, trace intact
            }
        })
        .toList();
```

`UncheckedIOException` is the JDK's own blessing of this pattern — an
unchecked carrier whose constructor *requires* the `IOException` cause. For
non-I/O checked exceptions, wrap into your domain exception
([topic 04](04-custom-exceptions-translation.md)) — not bare
`RuntimeException`.

Semantics: the first failing element **aborts the whole pipeline**; already-
processed elements are lost. That's often right (fail fast) — just decide
it, don't inherit it.

## Pattern 2 — the rethrow helper

The inline try/catch repeated three times per pipeline earns a helper:

```java
@FunctionalInterface
public interface ThrowingFunction<T, R, E extends Exception> {
    R apply(T t) throws E;
}

public static <T, R> Function<T, R> unchecked(ThrowingFunction<T, R, ?> f) {
    return t -> {
        try {
            return f.apply(t);
        } catch (RuntimeException e) {
            throw e;                          // don't double-wrap
        } catch (Exception e) {
            throw new UncheckedIOException(   // or a domain wrapper
                e instanceof IOException io ? io : new IOException(e));
        }
    };
}

List<Long> sizes = paths.stream().map(unchecked(Files::size)).toList();
```

One helper, method references again — but the wrapping policy is now
hidden inside `unchecked`; keep it *one* policy, visible in one place, not
a util class with six variants nobody can tell apart. (The
sneaky-throws variant of this helper — abusing generic `throws` inference
to rethrow a checked exception unwrapped — appears in every utility
library; the phase-4 composition chunk names it and argues against it: it
throws exceptions that `catch` clauses can no longer legally match.)

## Pattern 3 — extract a named method

```java
private long sizeOf(Path p) {
    try {
        return Files.size(p);
    } catch (IOException e) {
        throw new StorageException("sizing %s failed".formatted(p), e);
    }
}

List<Long> sizes = paths.stream().map(this::sizeOf).toList();
```

Often the best answer: the pipeline reads clean, the failure policy has a
name and a home, the wrapper is a *domain* exception, and the method is
testable alone. When the lambda body outgrows one expression, this is
where it goes regardless ([phase 4, topic 02](../phase-4-lambdas-streams/02-method-references.md)).

## Pattern 4 — failure as data, when one bad element shouldn't kill the batch

Wrapping preserves fail-fast. When the requirement is "process what you
can, report what failed", move the failure into the element:

```java
record Sized(Path path, long size, IOException error) {
    static Sized of(Path p) {
        try { return new Sized(p, Files.size(p), null); }
        catch (IOException e) { return new Sized(p, -1, e); }
    }
}

var results = paths.stream().map(Sized::of).toList();
var failed  = results.stream().filter(r -> r.error() != null).toList();
```

The pipeline itself never throws; the caller decides what failures mean.
This is the stream-friendly shape of "expected absence vs broken
invariant" that [topic 07](07-exceptions-as-control-flow.md) develops.

## The `Files.lines` special case: close and exceptions, together

`Files.lines` returns a `Stream<String>` holding an open file. Two
checked-exception moments collide with resource management:

```java
try (Stream<String> lines = Files.lines(path)) {     // close the stream!
    return lines.filter(l -> l.contains(term)).count();
}   // IOException from opening: caught/declared here, outside any lambda
```

- The *open* (`Files.lines(path)`) throws plain `IOException` — normal
  handling, no lambda involved. The try-with-resources mechanics are
  [topic 03](03-try-with-resources/README.md)'s.
- *Read errors during iteration* have no checked path out of the pipeline —
  the stream's internals throw `UncheckedIOException` wrapping the
  underlying `IOException`. Catch *that* around the terminal op if mid-read
  failure needs distinct handling: `catch (UncheckedIOException e)` then
  `e.getCause()`.

## Choosing

| Situation | Pattern |
|---|---|
| One throwing call, fail-fast is fine | inline try/catch → `UncheckedIOException`/domain wrapper |
| Several throwing calls across pipelines | `unchecked(...)` helper with one wrapping policy |
| Lambda body is real logic anyway | named method with domain wrapping |
| Partial success is the requirement | failure-as-data records |
| It's an *effectful* loop wearing a stream | write the loop — [phase 4, topic 08](../phase-4-lambdas-streams/08-streams-vs-loops.md) |

## Gotchas

**Symptom:** `catch (IOException e)` around a pipeline is flagged unreachable, yet reads clearly fail at runtime
**Cause:** runtime read errors surface as `UncheckedIOException` — the checked type never escapes the stream machinery
**Fix:** catch `UncheckedIOException` and unwrap `getCause()`; only the *opening* call throws checked `IOException`

**Symptom:** batch job dies on element 4,017 of 10,000; 4,016 results discarded
**Cause:** wrap-and-rethrow inherited fail-fast semantics nobody chose
**Fix:** failure-as-data (pattern 4) when partial success is wanted; keep the throw when the batch must be atomic

**Symptom:** exception from a util `unchecked` helper arrives as bare `RuntimeException("java.io.IOException: …")`
**Cause:** helper wrapped by string-message, or double-wrapped an already-unchecked exception
**Fix:** wrap with the cause constructor; rethrow `RuntimeException`s untouched (the helper's first catch above)

**Symptom:** `catch (IOException e)` no longer matches — an `IOException` flies past it uncaught
**Cause:** a sneaky-throws helper rethrew the checked exception without wrapper; the compiler had removed the "impossible" catch path
**Fix:** don't launder checked exceptions; wrap into an unchecked carrier so both compiler and catch sites see the truth

**Symptom:** file-descriptor exhaustion in a service that streams files
**Cause:** `Files.lines`/`list`/`walk` streams never closed — they hold OS resources unlike collection streams
**Fix:** try-with-resources around every resource-backed stream ([topic 03](03-try-with-resources/README.md))

**Symptom:** six overloads of `wrap`/`sneaky`/`unchecked` in the team's util class, each wrapping differently
**Cause:** per-incident helper accretion — wrapping policy diverged silently
**Fix:** one helper, one documented policy (which wrapper type, cause always); delete the rest

## Interview questions

**★ Why doesn't `map(Files::size)` compile, at the type-system level?**
`Function.apply` declares no checked exceptions, and an implementation —
lambda or method ref — cannot throw checked types its interface method
doesn't declare. `Files.size` declares `IOException`, so the reference
doesn't fit the SAM signature.

**★ Why did the JDK add `UncheckedIOException` instead of giving functional interfaces a `throws` clause?**
A generic `throws E` on `Function` infects inference at every call site
and fractures overloads (`map` for throwing vs non-throwing functions);
the stream API's internals would need it everywhere. A dedicated unchecked
carrier with a mandatory cause keeps signatures clean and preserves the
forensics.

**★ Compare wrap-and-rethrow vs failure-as-data for a 10k-element batch calling a flaky API.**
Wrap-and-rethrow: first failure aborts, prior work lost, simple semantics —
right when the batch is atomic. Failure-as-data: every element processed,
failures collected as values, caller decides — right when partial success
has value. The bug is inheriting the first when the business wanted the
second.

**★ What's wrong with sneaky-throws, given it "works"?**
It rethrows a checked exception the compiler believes impossible: callers
can't write a legal `catch` for it without catching broader types, and
existing `catch` blocks the compiler pruned no longer protect. It trades a
visible compile error for an invisible runtime hole.

**★ Where can `IOException` escape a `Files.lines` pipeline, and in what form?**
At the open: as checked `IOException` from `Files.lines(path)` itself.
During iteration: as `UncheckedIOException` wrapping the real error,
thrown out of whatever operation pulled the failing line. Close failures
surface per `AutoCloseable` rules — which is topic 03's story.

**★ Same job, `for` loop vs `forEach` — how do checked exceptions tip the choice?**
The enhanced `for` loop's body runs in the enclosing method, so a checked
exception propagates naturally — declare it and you're done, no wrapper,
no policy. `forEach(Consumer)` puts the body behind a no-`throws` SAM, so
the same line needs catch-and-wrap machinery. When the body is effectful
I/O per element, the loop is simpler *and* more honest about failure —
the same conclusion [phase 4, topic 08](../phase-4-lambdas-streams/08-streams-vs-loops.md)
reaches from the readability side.

**★ A teammate's pipeline has three inline try/catch blocks, each wrapping into a different exception type. Review it.**
The policy fragmented: same failure class, three wrappers, three
fingerprints in the error tracker. Extract named methods or one `unchecked`
helper so wrapping is single-policy with causes attached — then the
pipeline reads as logic again.

---

← Prev: [Reading a stack trace fast](05-reading-stack-traces/README.md) · Next → [Exceptions as control flow](07-exceptions-as-control-flow.md)
