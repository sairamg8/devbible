---
title: "A pooled thread outlives the request that borrowed it, so an MDC entry that is never removed becomes the next request's context — and the resulting log tells you, with complete confidence and total precision, about the wrong user"
sidebar_label: "06b · MDC and thread pools"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback manual, "Mapped Diagnostic Context"**, including the
> "MDC And Managed Threads" section quoted below
> ([logback.qos.ch](https://logback.qos.ch/manual/mdc.html)), the **SLF4J `org.slf4j.MDC` javadoc**
> for `getCopyOfContextMap`, `setContextMap` and `clear`
> ([slf4j.org](https://www.slf4j.org/api/org/slf4j/MDC.html)), and the **Spring Framework 7.0
> javadoc** for `ContextPropagatingTaskDecorator`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/support/ContextPropagatingTaskDecorator.html)).
> 🔴 **No sandbox.** No log output on this page is captured; the interleavings shown are labelled
> schematics.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · SLF4J 2.0.18 · Logback 1.5.34.

**This is the most consequential bug in the whole topic, and it is a bug of omission: nobody writes
it, it appears when someone forgets to write the cleanup. A servlet container's thread pool hands
`http-nio-8080-exec-7` to request A, which puts `userId=alice` into the MDC and never removes it.
The thread returns to the pool. Request B arrives, gets the same thread, and every line it logs
says `userId=alice`. Nothing errors. Nothing warns. The log is confidently, precisely wrong.**

## Why it happens and why it is invisible

MDC is a `ThreadLocal`. A `ThreadLocal` lives as long as its thread. A pooled thread lives as long
as the pool — hours, days, the life of the process.

```java
// The bug, in four lines.
@GetMapping("/orders")
public List<Order> list(@AuthenticationPrincipal User user) {
    MDC.put("userId", user.id());        // put. never removed.
    return service.findFor(user.id());
}
```

Nothing in Java, SLF4J or Logback notices. There is no scope, no lifetime, no destructor. The next
request on that thread inherits the entry.

**Schematic** of the resulting log — *illustrative, not a captured run*:

```text
[http-nio-8080-exec-7] userId=alice  GET /orders  200
[http-nio-8080-exec-7] userId=alice  GET /orders  200      <-- request from bob
[http-nio-8080-exec-7] userId=alice  POST /refund 500      <-- request from carol
```

🔴 **The severity depends entirely on what else reads the MDC.** As diagnostics it is a
misattribution — bad. If anything routes on `tenantId` from the MDC ([06](06-mdc.md)), it is a
cross-tenant data leak. If a support process treats logs as evidence, it is an incorrect record
about a named person.

## The variant that is worse: partial leakage

A single forgotten key is at least uniform. The real production shape is that *some* keys are
cleared and some are not, because different filters and interceptors manage different keys.

**Schematic**:

```text
[exec-7] requestId=req-0042 tenantId=acme   userId=alice   POST /checkout
[exec-7] requestId=req-0043 tenantId=acme   userId=alice   POST /checkout   <-- new request, stale user
```

`requestId` was set by a filter that cleans up. `userId` was set by a controller that does not. The
line looks entirely plausible, is internally consistent, and cannot be identified as wrong by
reading it — which is why this survives for years.

## The fixes, in order of preference

**1 · Never call bare `MDC.put` in application code.** Use `putCloseable`:

```java
try (var ignored = MDC.putCloseable("userId", user.id())) {
    return service.findFor(user.id());
}
```

The removal is unconditional, including on exception and early return. This is the single change
that eliminates the whole class.

**2 · Set request-wide keys in one filter that owns their lifecycle.**

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MdcFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            MDC.put("requestId", resolveRequestId(req));
            MDC.put("tenantId", resolveTenant(req));
            chain.doFilter(req, res);
        } finally {
            MDC.clear();               // unconditional, whole map
        }
    }
}
```

🔴 **`MDC.clear()` in the `finally`, not `remove` per key.** `remove` requires the list of keys to
stay in sync with everything downstream that might have added one; `clear` is correct by
construction. This filter must run first — Logback's own manual makes the same point about
`MDCInsertingServletFilter`: *"If your web-app has multiple filters, make sure that
MDCInsertingServletFilter is declared before other filters"*, because values set by a later filter
*"will not be seen by the code invoked by"* an earlier one.

**3 · Clear on hand-off into a pool you control**, so a task cannot inherit whatever the submitting
context left behind — [06c](06c-mdc-across-async-and-virtual-threads.md) has the propagation side.

**4 · Assert it in a test.** [13](13-testing-your-logging.md) covers this; the specific assertion
is that `MDC.getCopyOfContextMap()` is empty or null after a request completes.

## Inheritance: two statements in one manual that appear to disagree

Logback's MDC chapter says both of these:

> *"Also note that a child thread does not automatically inherit a copy of the mapped diagnostic
> context of its parent."*

and

> *"MDC operations such as `put()` and `get()` affect only the MDC of the current thread, and the
> children of the current thread."*

⚠️ **I am not going to reconcile those two sentences for you, because the manual does not.** The
reliable operational position — and the one the manual's own remedy assumes — is: **do not depend on
inheritance.** The behaviour has varied across Logback versions and depends on the `MDCAdapter`
implementation in use; anything that matters should be propagated explicitly.

What the manual is unambiguous about is executors:

> *"A copy of the mapped diagnostic context can not always be inherited by worker threads from the
> initiating thread. This is the case when `java.util.concurrent.Executors` is used for thread
> management. For instance, `newCachedThreadPool` method creates a `ThreadPoolExecutor` and like
> other thread pooling code, it has intricate thread creation logic."*

and its documented remedy:

> *"it is recommended that `MDC.getCopyOfContextMap()` is invoked on the original (master) thread
> before submitting a task to the executor. When the task runs, as its first action, it should
> invoke `MDC.setContextMap()` to associate the stored copy of the original MDC values with the new
> Executor managed thread."*

🔴 **Even where inheritance does happen it is the wrong mechanism for a pool**, because inheritance
occurs at *thread creation*. A pooled thread is created once, so it would inherit the MDC of
whichever request happened to trigger pool growth — and keep it forever.

## The correct hand-off, written once

The manual's recipe as code, with the cleanup the manual leaves implicit:

```java
Map<String, String> parent = MDC.getCopyOfContextMap();   // may be null

executor.submit(() -> {
    Map<String, String> previous = MDC.getCopyOfContextMap();
    if (parent != null) { MDC.setContextMap(parent); } else { MDC.clear(); }
    try {
        doWork();
    } finally {
        if (previous != null) { MDC.setContextMap(previous); } else { MDC.clear(); }
    }
});
```

⚠️ **Both null checks are load-bearing.** `getCopyOfContextMap()` returns `null` when the MDC is
empty, and `setContextMap(null)` is not a defined way to clear it. Restoring `previous` rather than
clearing keeps the pool's own threads honest if some other framework put something there.

**Do not write this at every call site.** Wrap it once — Spring's `TaskDecorator`, or
`ContextPropagatingTaskDecorator`, which the javadoc describes as *"particularly useful for
restoring a logging context or an observation context for the task execution"*. That is
[06c](06c-mdc-across-async-and-virtual-threads.md).

## Detecting an existing leak

**In code review**, grep for `MDC.put(` outside a try-with-resources or a filter. Every hit is a
candidate.

**In tests**, assert the MDC is empty after each test and after each simulated request. A leak shows
up as an order-dependent failure, which is otherwise one of the most frustrating things to debug.

**In production**, the tell is a *count*: group by MDC value over a window. A leak produces one
value that appears far more often than its true traffic share, and a distribution of requestIds
where some ids appear on lines separated by more than a request's duration. Structured logging
makes this a one-line query ([05](05-structured-json.md)).

## Gotchas

**★ A pooled thread keeps whatever the last request left on it.**
There is no scope, no destructor and no warning. The next request inherits the entry and logs it as
its own.

**★ The failure is silent and the output is plausible.**
Nothing throws, no line looks malformed, and the wrong value is internally consistent. This is why
the bug survives for years — it cannot be found by reading a single line.

**★ Partial cleanup is worse than none.**
When one filter clears its keys and a controller does not clear its own, you get a line where some
fields are correct and one is stale. Nothing distinguishes it from a correct line.

**★ `MDC.remove(key)` in a `finally` is a maintenance trap.**
The key list has to stay in sync with everything that might add a key downstream. `MDC.clear()` is
correct by construction and should be the filter's cleanup.

**★ An MDC filter that runs after another filter does not cover that filter's code.**
Logback's manual says the same of `MDCInsertingServletFilter`: declare it before other filters, or
their code runs without the context. Order the filter at highest precedence.

**★ Do not rely on child-thread inheritance.**
Logback's manual contains two sentences that read as contradictory on this point, and the behaviour
depends on the `MDCAdapter` in use. Propagate explicitly; anything else is version-dependent.

**★ Even real inheritance is wrong for pools, because it happens at thread creation.**
A pooled thread is created once. It would capture the MDC of whichever request caused the pool to
grow and keep it for the process's lifetime — a permanently wrong value rather than an
intermittently wrong one.

**★ `getCopyOfContextMap()` returns null on an empty MDC.**
Propagation code that passes that straight into `setContextMap` without a null check breaks
precisely in the case where the parent had no context — which is the common case for background
work.

**★ Restoring rather than clearing after a pooled task matters.**
The worker thread may legitimately have context of its own from an outer scheduler. Blindly clearing
strips it; capturing and restoring does not.

**★ A leaked MDC entry used by anything other than logging is a correctness bug, not a cosmetic
one.**
A stale `tenantId` consumed by a routing data source or a feature-flag lookup produces the wrong
data for the wrong customer. That is the argument for keeping behavioural state out of MDC
entirely.

## Interview questions

**★ Describe the MDC leak on a pooled thread and why it is dangerous.**
MDC is a `ThreadLocal`, and a pooled thread lives far longer than the request that borrows it. If a
request puts a value in the MDC and never removes it, the entry stays on the thread and the next
request that gets that thread logs the previous request's context as its own. It is dangerous
because it fails silently and produces plausible output — the wrong user id on a line that is
otherwise perfectly formed. If anything besides logging reads the MDC, such as a tenant-routing
data source, it stops being a diagnostic problem and becomes a data-isolation one.

**★ How do you prevent it?**
Never call bare `MDC.put` in application code — use `MDC.putCloseable` in try-with-resources, which
removes the key on every exit path including exceptions. Set request-wide keys in a single filter
ordered at highest precedence, with `MDC.clear()` in a `finally` rather than per-key `remove`, so
the cleanup cannot drift out of sync with what was added. Then assert in tests that the MDC is empty
after a request, because that turns a silent production bug into a build failure.

**★ Does a child thread inherit the MDC?**
Do not rely on it. Logback's manual says both that a child thread *"does not automatically inherit
a copy"* and that MDC operations affect *"the current thread, and the children of the current
thread"*, and the actual behaviour depends on the `MDCAdapter` in use. Regardless, inheritance is
the wrong mechanism for a thread *pool*, because it would happen at thread creation — a pooled
thread is created once, so it would capture the context of whichever request caused the pool to
grow and keep it permanently. The documented approach is explicit propagation with
`getCopyOfContextMap` and `setContextMap`.

**★ Write the correct MDC hand-off to an executor.**
Capture `MDC.getCopyOfContextMap()` on the submitting thread before `submit`. Inside the task,
first capture the worker's existing map, then either `setContextMap` the parent's copy or `clear`
if it was null, do the work in a `try`, and in the `finally` restore the worker's previous map or
clear. Both null checks matter: `getCopyOfContextMap` returns null on an empty MDC, and restoring
rather than clearing preserves any context the worker thread legitimately had. And it should be
written once in a `TaskDecorator`, not at every call site.

**★ How would you detect this leak in a running system?**
Count MDC values over a window. A leaked value appears far more often than its real traffic share —
one user id attached to a suspiciously large fraction of requests — and correlation ids start
appearing on lines separated by more than any single request's duration. With structured logging
both are one query. In tests, the signature is order-dependent failures, which is why asserting an
empty MDC after each test is worth the two lines it costs.

**★ Why is `MDC.clear()` better than removing the specific keys you added?**
Because `remove` requires the cleanup list to stay synchronised with every key anything downstream
might have added — your controller, a library, an interceptor you did not know about. That
synchronisation degrades with every change to the codebase and nothing checks it. `clear()` at the
outermost boundary is correct regardless of what was added inside, and the outermost boundary is
exactly where a filter sits.

{/* FOOTER */}
