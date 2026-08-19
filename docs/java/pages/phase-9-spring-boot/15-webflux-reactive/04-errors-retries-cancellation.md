---
title: "Errors, retries and cancellation"
sidebar_label: "4 · Errors, retries, cancellation"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Handling
> Errors* (the error operators, `retryWhen` and `Retry.backoff`) and *Reactor
> Core Features* (signal contract, `doFinally`, cancellation)
> (projectreactor.io/docs/core/release/reference/) — and the Spring Framework
> reference *Web on Reactive Stack → WebFlux → Annotated Controllers →
> Exceptions*. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**In a reactive pipeline an error is not thrown, it is *emitted* — a terminal
signal that travels downstream to the subscriber and ends the sequence for
good. And there is a third terminal outcome that blocking code has no
equivalent for: cancellation, which happens on every client disconnect and
every `timeout`, and which is the reason reactive resource cleanup goes in
`doFinally` rather than in `finally`.**

## Three ways a sequence ends

| Outcome | Signal | Blocking analogue |
|---|---|---|
| Success | `onComplete` (after 0..N `onNext`) | normal return |
| Failure | `onError(Throwable)` | thrown exception |
| Cancellation | `cancel()` travelling **upstream** | — nothing, really |

The third row is the one with no counterpart. A subscriber that no longer wants
the result — because the HTTP client hung up, because a `timeout` fired,
because a `take(1)` got its element — sends `cancel` back up the chain, and
every operator propagates it to its source. Well-behaved sources stop work and
release resources; the query is abandoned, the socket closed.

That is a genuine advantage of the model and it is worth naming: **in WebFlux,
a client that disconnects mid-request causes the work to be cancelled**, all
the way down to the database call, without anyone writing cancellation logic.
The blocking equivalent — a thread finishing an expensive query for a browser
tab that closed ten seconds ago — is simply what happens.

## The error operators

- **`onErrorResume(e -> Publisher)`** — the reactive `catch` block: replace the
  failed sequence with a fallback pipeline. It takes an optional exception-type
  argument, which is how you write `catch (PricingUnavailable e)` instead of
  `catch (Throwable t)`.
- **`onErrorReturn(value)`** — substitute a constant.
- **`onErrorMap(e -> other)`** — translate the exception type, exactly like
  catch-and-rethrow. This is how a driver-specific exception becomes a domain
  exception before it reaches an exception handler.
- **`onErrorComplete()`** — swallow the error and complete empty. Rarely what
  you want; worth a hard look wherever you find it.
- **`doOnError(consumer)`** — observe without handling. Logging goes here; the
  error continues downstream unchanged.
- **`doFinally(signalType -> ...)`** — runs on *any* termination, including
  cancellation, and tells you which one it was. This is `finally`.

Position matters as much as it does with `catch`. An operator only sees errors
raised **above** it in the chain, so a handler at the very bottom catches
everything and a handler placed immediately after one call catches only that
call's failures — which is almost always what you meant.

## Retries

`retry(n)` and `retryWhen(Retry.backoff(n, duration))` work by **re-subscribing
to the upstream**. That is the whole mechanism, and both its power and its
danger follow from it:

- It re-runs everything above the operator, not just the failing step.
- It only works at all because publishers are lazy — you can re-run a
  description of work; you cannot re-run a result.
- `Retry.backoff` adds exponential delay and jitter, and can be bounded by
  `maxBackoff`, filtered by exception type with `.filter(...)`, and made to
  fail with a chosen exception via `.onRetryExhaustedThrow(...)`.

Spring Framework 7's `@Retryable` and `@ConcurrencyLimit` (enabled with
`@EnableResilientMethods`) provide the same ideas declaratively for the
blocking side, which is worth knowing when comparing the two stacks.

## Timeouts

`timeout(Duration)` emits `TimeoutException` and **cancels the source** when
nothing arrives in time; `timeout(Duration, fallbackPublisher)` switches to a
fallback instead. Two notes that catch people:

- A `timeout` on a `Flux` applies **between elements**, not to the whole
  sequence. A slow stream that keeps trickling never times out.
- A timeout is not a substitute for a client-level one. The socket read
  timeout in your HTTP client and the `timeout` operator are different limits
  and you generally want both.

## How an error becomes an HTTP response

In an annotated WebFlux controller you do not handle most errors at all. An
`onError` signal that reaches the framework is mapped exactly as in MVC:
`@ExceptionHandler` methods on the controller or on a `@ControllerAdvice`,
`ResponseStatusException`, and `@ResponseStatus`-annotated exception types all
work the same way, and the handler methods may themselves return `Mono`. The
practical rule is the same one as for blocking code: handle in the pipeline
only what you are genuinely recovering from, and let everything else become a
response through a single, central mapping.

## Gotchas

### `retry` re-running work that was not idempotent

**Symptom.** A transient failure produces duplicate charges, duplicate emails
or duplicate rows.

**Cause.** `retry` re-subscribes to the *whole* upstream chain, not just the
step that failed. Everything above it runs again.

**Fix.** Put the retry as close to the failing call as possible, so that what
re-runs is exactly one idempotent operation:

```java
// ❌ retries the debit as well as the notification
return accounts.debit(id, amount)
               .then(notifier.send(id))
               .retryWhen(Retry.backoff(3, Duration.ofMillis(200)));

// ✅ only the notification is retried
return accounts.debit(id, amount)
               .then(notifier.send(id)
                             .retryWhen(Retry.backoff(3, Duration.ofMillis(200))));
```

### `onErrorResume(t -> fallback)` swallowing programming errors

**Symptom.** A `NullPointerException` in a mapping function turns into a
cheerful fallback response, and nobody notices for a week.

**Cause.** The untyped form catches every `Throwable`, exactly like
`catch (Exception e)` wrapped around a whole method body.

**Fix.** Use the typed overload so only the anticipated failure is handled, and
log in the handler:

```java
.onErrorResume(PricingUnavailable.class, e -> {         // ✅ narrow
    log.warn("pricing degraded for {}", id, e);
    return Mono.just(OrderView.withoutPricing(id));
})
```

### Cleanup in the wrong place

**Symptom.** A resource — a temporary file, a lease, a metrics timer — leaks
whenever a client disconnects, even though the code has a `doOnNext` cleanup
and a `doOnError` cleanup.

**Cause.** Cancellation is a third terminal outcome and neither of those hooks
sees it.

**Fix.** Use `doFinally`, which runs on completion, error *and* cancellation
and tells you which:

```java
return storage.stream(id)
              .doFinally(signal -> lease.release());     // ✅ covers ON_CANCEL too
```

For resources that must be acquired and released around a sequence,
`Flux.using(...)` / `Mono.usingWhen(...)` express the try-with-resources shape
directly.

### A timeout that fires but leaves the work running

**Symptom.** A `timeout` produces the expected error response, but the
downstream service shows the request continuing to completion.

**Cause.** Cancellation only stops work if the *source* honours it. An operator
bridging a blocking call — a `Mono.fromCallable` wrapping JDBC, say — has no
way to interrupt the call that is already in flight; the cancel signal simply
stops anyone caring about the result.

**Fix.** Cancellation is cooperative. Non-blocking clients (`WebClient`, R2DBC
drivers) genuinely abort; anything wrapped from a blocking API needs its own
timeout at the client level, and you should assume that side effects already
started will complete.

### Assuming an `onError` in a `doOnError` was handled

**Symptom.** An error is logged twice, or a fallback is expected but the request
fails anyway.

**Cause.** `doOn*` hooks observe; they do not consume. The signal continues
downstream untouched.

**Fix.** Log with `doOnError` and *handle* with `onErrorResume`. If both appear
in a chain, the log runs first and the recovery second, which is usually
exactly right.

## Interview questions

**★ How do you handle errors in a reactive chain?**
With operators, because there is no stack for `catch` to unwind.
`onErrorResume` replaces the failed sequence with a fallback publisher,
`onErrorReturn` substitutes a value, `onErrorMap` translates the exception
type, and `retryWhen` re-subscribes under a backoff policy. Anything unhandled
travels to the subscriber as an `onError` signal, which in WebFlux reaches the
framework's exception handling — `@ExceptionHandler`, `@ControllerAdvice`,
`ResponseStatusException` — and becomes a response. Prefer the typed overloads;
the untyped ones catch programming errors as well.

**★ What is wrong with putting `retryWhen` at the end of a long chain?**
It re-subscribes to the entire upstream, so every step above it runs again. If
any of those steps has a side effect — a debit, an email, an insert — the retry
duplicates it. Retries belong as close to the failing, idempotent operation as
possible, which usually means inside the `flatMap` that performs the call
rather than appended to the outermost pipeline.

**★ What is cancellation, and what does it give you that blocking code does not?**
Cancellation is a signal that travels *upstream* when the subscriber no longer
wants the result — a client disconnecting, a `timeout` firing, a `take(1)`
being satisfied. Operators propagate it and well-behaved sources abandon their
work, so in WebFlux a browser tab closing can abort the database query behind
it. Blocking code has no equivalent: the thread finishes the query regardless
and discovers on write that nobody is listening. It is one of the genuine,
non-marketing advantages of the model, and it is also why cleanup belongs in
`doFinally` rather than `doOnError`.

**★ Why does resource cleanup go in `doFinally` and not `doOnError`?**
Because there are three terminal outcomes, not two. `doOnError` runs only on
failure and `doOnNext` only on data, so both miss cancellation entirely — and
cancellation is common in a reactive server, since every disconnect produces
one. `doFinally` runs on completion, error and cancellation, and receives the
`SignalType` so it can distinguish them.

**★ Does a `timeout` operator stop the work it timed out on?**
It cancels the source, and whether that stops anything depends on the source.
A non-blocking client such as `WebClient` or an R2DBC driver will genuinely
abort the request. A `Mono.fromCallable` wrapping a blocking JDBC call cannot
interrupt a call already in flight, so the work continues and only the result
is discarded. Cancellation is cooperative, which is why client-level timeouts
still matter even in a fully reactive stack.

**★ Where in the chain should an error handler go?**
Wherever the equivalent `catch` would go — an operator sees only errors raised
above it. A handler at the bottom of a long pipeline behaves like a `try`
around the whole method and will catch failures from steps you never intended
to recover from. Placing `onErrorResume` immediately after the single call that
can fail is both narrower and clearer, and it lets you use the typed overload
meaningfully.

---

← Prev: [The operator vocabulary](03-the-operator-vocabulary.md) · Index: [WebFlux and reactive](README.md) · Next → [Schedulers and threading](05-schedulers-and-threading.md)
