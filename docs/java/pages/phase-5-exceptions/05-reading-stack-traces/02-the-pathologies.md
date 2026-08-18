---
title: "The pathologies — traces that lie"
sidebar_label: "2 · The pathologies"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Throwable`
> (cause-chain constructors, `fillInStackTrace`), `StackWalker`,
> `CompletableFuture` (exception handling notes) and
> `java.lang.reflect.Proxy`; lambda frame naming corroborated against the
> JDK's `LambdaMetafactory` documentation.

**Chunk 1 assumed the trace tells the truth. Production traces often
don't — not because the JVM lies, but because code between the failure and
the log threw information away. The five pathologies here account for most
"the trace doesn't show anything" incidents: dropped causes, double
logging, swallowed exceptions, async boundaries that reset the stack, and
synthetic frames that bury your code in machinery. Each has a signature you
can recognize in seconds and a prevention that costs one line.**

## 1 · The dropped cause

```java
} catch (SQLException e) {
    throw new OrderRepositoryException("load failed");   // e is GONE
}
```

**Signature:** the chain's deepest exception is a *domain* type whose trace
starts at your own `throw` line — no driver frames, no low-level type below
it. The information about the actual failure existed for microseconds and
was discarded at this line.

**Prevention:** the `(message, cause)` constructor, always
([topic 04](../04-custom-exceptions-translation.md) makes this a standing
rule). In review, any `throw new` inside a `catch` block that doesn't
mention the caught variable is a bug until proven otherwise.

A cousin: `e.printStackTrace(); throw new Wrapped(msg);` — the cause *was*
printed, but to stderr at some earlier timestamp, disconnected from the
incident's log context. The chain is still broken where it matters.

## 2 · Catch–log–rethrow: the double-logging storm

```java
} catch (RepositoryException e) {
    log.error("placing order failed", e);   // logged here...
    throw e;                                // ...and again by every layer above
}
```

**Signature:** one failure, four stack traces in the log, each wrapped in a
different layer's message — the incident channel calls it "we're getting
hundreds of errors" when it's dozens of requests × layers each logging.
Alert counts inflate; the *first* log line (closest to the failure) drowns
under repeats.

**Rule: an exception is logged exactly once, by the layer that *handles*
it** — usually the global boundary ([topic 08 · where the global handler
lives](../08-global-handler.md)). Layers that only translate rethrow *without*
logging; the cause chain carries their context up to the single log site.

## 3 · The swallow

```java
} catch (Exception e) {
    // TODO handle
}
```

**Signature in the log: nothing.** The request "succeeds" with wrong data,
a scheduled task silently stops doing its work, a consumer commits offsets
for messages it never processed. The trace pathology is the *absent*
trace — often discovered days later, dated to a deploy, with no forensics
at all.

Special mention: `catch (InterruptedException e) {}` also erases the
interrupt flag — phase 6's territory, but the swallow shape is the same.
Minimum viable handling of anything: log with the exception object (not
just `e.getMessage()` — the message alone drops type and trace), or
rethrow wrapped.

## 4 · Async boundaries: the trace starts at the pool

A task submitted to an executor fails. Its trace's outermost frames are the
*worker thread's* run loop — pool internals — not the code that submitted
the task. The submission site's stack existed on a different thread at a
different time; the JVM never connected them.

**Signatures:**

- Bottom frames are `ThreadPoolExecutor$Worker.run` / `Thread.run` instead
  of your entry points; nothing says *which caller* queued the work.
- With bare `executor.submit(...)`, the returned `Future` swallows the
  exception until `get()` is called — combine with pathology 3 (nobody
  calls `get`) and the failure vanishes entirely.
- `CompletableFuture` chains rethrow a cause wrapped in
  `CompletionException`/`ExecutionException` when joined, and the *same*
  cause object can surface from several dependent stages — one failure,
  multiple observation points, each with pool-flavored outer frames.

**Mitigations:** name threads per pool (a trace that says
`payment-worker-3` beats `pool-2-thread-7`); carry a correlation ID in the
task (chunk 3); wrap task bodies so failures are logged *with the task's
own context* rather than hoping a distant `get()` reports them; in
`CompletableFuture` pipelines, put one `exceptionally`/`whenComplete` at
the end of the chain as the single log site.

## 5 · Synthetic and machinery frames

Between your frames, the runtime inserts its own:

- **`lambda$placeOrder$0`** — a lambda's body compiles to a synthetic
  method named after its enclosing method; `OrderService.lambda$place$2`
  *is* your code, third lambda in `place`. Method references keep their own
  name and read cleaner in traces — a minor argument for them
  ([phase 4, topic 02](../../phase-4-lambdas-streams/02-method-references.md)).
- **`$Proxy42.invoke`** / `InvocationHandler` frames — a dynamic proxy
  (transactions, security, mocking) sits between caller and target; the
  real target appears further down.
- **Reflection plumbing** — `Method.invoke` and `jdk.internal.reflect`
  frames mean something called your code reflectively (frameworks, tests).
- Framework interceptor stacks can put *dozens* of machinery frames between
  two of yours. The scan discipline from chunk 1 — "first frame in *my*
  namespace" — is precisely what cuts through.

## `StackWalker`: traces without exceptions

For code that needs the current stack programmatically —
who-called-me checks, diagnostic captures — `StackWalker` (JDK 9+) replaces
the old `new Throwable().getStackTrace()` idiom: it walks lazily (pay for
the frames you read, not the whole stack), can carry `RETAIN_CLASS_REFERENCE`
to hand back `Class` objects, and `getCallerClass()` answers the common case
directly. Building a `Throwable` just to read its trace still works but
eagerly snapshots every frame — the expensive way
([topic 07 · exceptions as control flow](../07-exceptions-as-control-flow.md)
prices trace capture).

## Gotchas

**Symptom:** deepest `Caused by` is your own domain exception; no JDBC/IO type anywhere in the chain
**Cause:** a translating `catch` constructed its wrapper without the cause (pathology 1)
**Fix:** find the translation site named in that deepest trace's first frame; add the cause parameter; audit siblings

**Symptom:** error dashboard shows 4× the failure count of the request logs
**Cause:** catch–log–rethrow at multiple layers — each failure logged once per layer
**Fix:** log at the handling boundary only; translating layers rethrow silently with the cause attached

**Symptom:** scheduled job "runs fine" (no errors logged) but its output stopped changing weeks ago
**Cause:** a swallow inside the task, or a bare `submit` whose `Future` is never inspected
**Fix:** task bodies own their logging: catch, log with full exception, rethrow or mark the run failed; monitor *output freshness*, not just error counts

**Symptom:** trace for a failed async task shows only pool frames — no clue which endpoint queued it
**Cause:** stack context does not cross thread boundaries; the submitter's frames were never recorded
**Fix:** named threads, correlation IDs inside the task, and a wrapper that logs task context on failure at the task boundary

**Symptom:** `ExecutionException` logged, investigation stops at "execution failed"
**Cause:** the wrapper treated as the failure — the information is in `getCause()`
**Fix:** unwrap before logging/translating: the cause is the event, the wrapper is transport

**Symptom:** trace is 80 frames, three of them yours, and the reader gave up
**Cause:** interceptors, proxies and reflection machinery between every meaningful frame
**Fix:** chunk 1's scan — search for your package prefix; configure the log viewer/IDE to highlight or fold by package

**Symptom:** `getCallerClass` replacement built by constructing a `Throwable` shows up hot in profiles
**Cause:** eager full-stack capture via `fillInStackTrace` on every call
**Fix:** `StackWalker` with a limited walk — lazy frames, and only as many as needed

## Interview questions

**★ A production NPE trace's deepest cause starts at your own `OrderException` constructor. Diagnose the diagnosis.**
The chain was severed: someone translated a lower-level exception without
passing it as the cause, so the driver-level truth never reached the log.
Fix the translation site, then re-await the failure — the current log
cannot answer the original question.

**★ Why does "log it where you catch it" produce log storms, and what's the discipline instead?**
Because in a layered app one failure crosses several catches; each logging
produces a full trace, multiplying counts and burying the first, closest
log line. Discipline: translate-and-rethrow layers never log; exactly one
boundary handler logs the whole chain once.

**★ What happens to an exception thrown inside `executor.submit(() -> ...)` if nobody keeps the Future?**
It is captured into the `Future` and waits for a `get()` that never comes —
no log, no crash, silent loss. Fixes: log inside the task, use
`CompletableFuture` with a terminal `exceptionally`, or an
`afterExecute`/uncaught-exception hook on the pool.

**★ Why do async traces "start at the pool", and what restores the missing context?**
The stack is a per-thread structure; the submitter's frames lived on
another thread and were gone by execution time. Restore context manually:
named pools, correlation IDs travelling in the task, logging at the task
boundary — or structured-concurrency scopes (phase 6) that re-associate
child failures with the submitting scope.

**★ `OrderService.lambda$place$1` in a trace — what is it and how do you find the code?**
The compiled synthetic method for the second lambda literal inside
`OrderService.place`. Open `place`, count lambdas from zero. A method
reference would have shown the referenced method's own name instead.

**★ When would you reach for `StackWalker` over `new Throwable().getStackTrace()`?**
Whenever the stack is read without throwing: it's lazy (no full eager
snapshot), filters as it walks, and offers `getCallerClass()` directly —
cheaper and clearer for who-called-me logic, audit capture, and
diagnostics.

---

← Prev: [Anatomy and the fast scan](01-anatomy-and-the-scan.md) · Index: [Reading a stack trace fast](README.md) · Next → [Traces in production](03-traces-in-production.md)
