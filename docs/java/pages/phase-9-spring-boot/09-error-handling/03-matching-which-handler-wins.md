---
title: "Matching: which @ExceptionHandler wins"
sidebar_label: "3 · Which handler wins"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Exceptions
> (`@ExceptionHandler`)*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html
> — annotation-value vs argument matching, cause-level matching since 5.3,
> `ExceptionDepthComparator`, the "root exception match is generally preferred
> to a cause exception match" rule, the cross-advice priority rule, and the
> advice to be as specific as possible in the argument signature). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Spring does not simply look at the thrown exception's class. It walks the
cause chain, ranks every candidate handler by how close its declared type is to
what was thrown, and — across several advice classes — lets priority override
closeness. Almost every "my handler isn't firing" bug is one of those three
rules doing exactly what it says.**

## Declaring which exceptions a method handles — two forms

```java
// 1. By argument type. The reference calls this the preferred form.
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(OrderNotFoundException ex) { ... }

// 2. By annotation value, with a wider argument type.
@ExceptionHandler({ FileSystemException.class, RemoteException.class })
ResponseEntity<ProblemDetail> handle(IOException ex) { ... }
```

Form 1 cannot drift, because the declaration *is* the signature — you cannot
change the exception it handles without changing the parameter. Form 2 exists
for the case where several unrelated types share a handler and their nearest
common supertype is too broad to declare: you want exactly `FileSystemException`
and `RemoteException`, not every `IOException`, and you want one method.

The parameter can be widened all the way to `Exception`:

```java
@ExceptionHandler({ FileSystemException.class, RemoteException.class })
ResponseEntity<ProblemDetail> handle(Exception ex) { ... }
```

The annotation constrains the *matching*; the parameter only has to be
assignable from every listed type. This is legal, the reference shows it, and it
is where the next section's trap lives.

## Cause-level matching

Since Spring 5.3 an exception can match **at arbitrary cause levels**. Service
code throws `IllegalStateException`; a proxy wraps it in
`UndeclaredThrowableException`; a handler declared for `IllegalStateException`
**still matches**, because Spring unwraps.

Two rules decide the winner within one class:

- **`ExceptionDepthComparator` sorts candidates by depth from the thrown
  type.** A handler for the exact class beats one for its superclass, which
  beats one for `Exception`. Most specific wins.
- **A root exception match is generally preferred to a cause exception match.**
  If any handler matches the exception as it was thrown, it beats a handler
  that only matches something further down the chain.

## The argument you receive depends on how it matched

The reference is explicit, and this is the part that costs people an afternoon:

> *"When an exception is propagated within a wrapper exception, the passed-in
> argument is the wrapper exception"* — whereas *"when the matching exception is
> thrown as a top-level exception, the argument is the actual exception
> instance."*

🔴 So a handler declared `handle(Exception ex)` with a narrow annotation value
can be handed the **wrapper**, not the type you listed. Code like this:

```java
@ExceptionHandler({ FileSystemException.class })
ResponseEntity<ProblemDetail> handle(Exception ex) {
    String file = ((FileSystemException) ex).getFile();   // 💥 when matched by cause
    ...
}
```

throws a `ClassCastException` **inside the exception handler** — which is close
to the worst place in a web application for a new exception to appear, because
the handler that would have caught it is the one that just failed.

The reference's own advice is to *"be as specific as possible in the argument
signature to avoid mismatches between root and cause exception types"* and to
*"consider breaking multi-matching methods into individual `@ExceptionHandler`
methods for each specific exception type."*

**The practical rule: one exception type per handler, declared as the argument,
unless the body genuinely only calls `getMessage()`.** The corrected version of
the snippet above is two methods:

```java
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(FileSystemException ex) {
    String file = ex.getFile();          // typed, cannot be a wrapper
    ...
}

@ExceptionHandler
ResponseEntity<ProblemDetail> handle(RemoteException ex) { ... }
```

## Across advice classes, priority beats specificity

Within one class, specificity decides. Across several `@ControllerAdvice`
beans it does not:

> *"In multi-`@ControllerAdvice` arrangements, a cause match on a
> higher-priority `@ControllerAdvice` bean is preferred to any match (including
> root) on a lower-priority bean."*

Read that carefully, because it inverts the intuition. A vague
`handle(Exception ex)` sitting in an advice with `@Order(0)` will swallow an
exception that a perfectly specific `handle(OrderNotFoundException ex)` in an
unordered advice was written for. This is the single most common reason a
correct-looking handler never runs in an application that has grown two advice
classes. Ordering is covered in [chunk 5](05-controlleradvice.md); the rule to
carry from here is: **the catch-all belongs in the lowest-priority advice, and
nowhere else.**

## Backing out: rethrow to continue the chain

A handler that decides the exception is not really its business can rethrow it
*in its original form*, and resolution continues through the remaining
resolvers. That is the documented escape hatch, and it beats trying to enumerate
in the annotation every exception you do **not** want:

```java
@ExceptionHandler
ResponseEntity<ProblemDetail> handle(DataAccessException ex) throws DataAccessException {
    if (ex instanceof OptimisticLockingFailureException) {
        return conflict(ex);            // we do handle this one
    }
    throw ex;                           // everything else: not ours
}
```

⚠️ Rethrowing a **different** exception is not backing out — it is throwing from
inside error handling, and where that lands is covered in
[chunk 16](16-the-error-floor.md).

## The trade-off

The matching engine is doing you a favour: it means a handler keeps working
when a layer beneath it starts wrapping exceptions, which happens constantly
(transaction proxies, `CompletableFuture`, data-access translation). The price
is that **you cannot tell from a handler's signature alone which instance it
will receive** unless the signature is specific. Narrow signatures cost extra
methods and buy handlers that behave the way they read.

## Gotchas

**Symptom** — `ClassCastException` thrown inside an exception handler.
**Cause** — wide argument (`Exception ex`) with a narrow annotation value,
matched through the cause chain, so the argument was the wrapper.
**Fix** — declare the specific type as the parameter and drop the annotation
value; split multi-type handlers into one method per type whenever the body
needs anything type-specific.

**Symptom** — a specific handler in one advice never fires; a generic one in
another advice always does.
**Cause** — the generic one is in a higher-priority advice, and priority is
consulted before specificity across advices.
**Fix** — give the specific advice a lower `@Order` value (higher priority) and
push the catch-all to `Ordered.LOWEST_PRECEDENCE`. See
[chunk 5](05-controlleradvice.md).

**Symptom** — a handler works in a unit test and not in production for the same
exception type.
**Cause** — in production the exception arrives wrapped — by an AOP proxy, an
executor, or Spring's data-access exception translation — so it matched (or
failed to match) differently.
**Fix** — declare the handler for the type your framework layer actually
surfaces. For persistence that is the translated `DataAccessException`
hierarchy, not the underlying `SQLException`; for AOP-wrapped checked
exceptions it may be `UndeclaredThrowableException`. Test the wrapped form.

**Symptom** — adding a `handle(Exception ex)` catch-all silently changes the
status of several existing errors.
**Cause** — it now matches things that previously fell through to
`DefaultHandlerExceptionResolver`, which had been mapping Spring's own
exceptions to correct statuses (405, 415, 400). Your catch-all turns all of them
into whatever it returns, usually 500.
**Fix** — either extend `ResponseEntityExceptionHandler` so Spring's mappings
survive ([chunk 10](10-responseentityexceptionhandler.md)), or exclude them:
handle `ErrorResponse` separately and rethrow, rather than catching `Exception`
blind.

**Symptom** — an `@ExceptionHandler(Throwable.class)` catches things you did
not expect, including `Error`s.
**Cause** — it does exactly what it says. `OutOfMemoryError` and
`StackOverflowError` are `Throwable`s.
**Fix** — catch `Exception`, not `Throwable`. An `Error` means the JVM is in
trouble and converting it into a tidy 500 body hides a condition that should
take the instance out of the load balancer instead.

## Interview questions

**★ Can an `@ExceptionHandler` match an exception that was not the one thrown?**
Yes. Since 5.3 matching walks the cause chain, so a handler for
`IllegalStateException` matches even when it arrives wrapped. Candidates are
ranked by `ExceptionDepthComparator` — closest declared type wins — and a root
match is preferred to a cause match.

**★ Two handlers could both apply. How does Spring pick?**
Within a single class, by specificity via `ExceptionDepthComparator`, with root
matches preferred over cause matches. Across several `@ControllerAdvice` beans,
priority is consulted first: a cause match in a higher-priority advice beats
even a root match in a lower-priority one. So in a multi-advice application,
ordering matters more than how precisely you declared the type.

**★ Why is a handler with a wide parameter and a narrow annotation value
dangerous?**
Because the parameter is what you get, and when the match happened through the
cause chain, what you get is the wrapper rather than the listed type. Any cast
or type-specific call in the body then fails — inside the exception handler,
where there is no handler left to catch it.

**★ How do you handle a subset of a family of exceptions and let the rest take
Spring's default treatment?**
Rethrow the ones you do not want, in their original form. The reference
supports this explicitly: rethrowing backs out and lets resolution continue
through the remaining chain. It is much cleaner than trying to list every
exception you are not interested in.

**★ Why should a catch-all handler live in the lowest-priority advice?**
Because cross-advice priority overrides specificity. A `handle(Exception ex)`
in a high-priority advice intercepts exceptions that specific handlers
elsewhere were written for, and it does so silently — no error, no warning, just
a generic 500 where a 404 was intended.

---

← Prev: [The resolver chain](02-the-resolver-chain.md) · Index: [Error handling](README.md) · Next → [Handler signatures](04-handler-signatures.md)
