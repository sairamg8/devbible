---
title: "Every mechanism that moves work off the calling thread — an executor, `@Async`, a reactive operator, a virtual thread — drops the MDC unless something puts it back, and the four fixes are genuinely different because the four mechanisms lose it for different reasons"
sidebar_label: "06c · MDC across async"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0 javadoc** for
> `ContextPropagatingTaskDecorator` — *"particularly useful for restoring a logging context or an
> observation context for the task execution"*
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/support/ContextPropagatingTaskDecorator.html)),
> the **Micrometer Context Propagation reference**, which *"assists with context propagation across
> different types of context mechanisms, such as `ThreadLocal`, Reactor Context, and others"*
> ([docs.micrometer.io](https://docs.micrometer.io/context-propagation/reference/)), the **Spring
> Boot 4.1 configuration-properties appendix** and `ReactorProperties` source for
> `spring.reactor.context-propagation`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-reactor/src/main/java/org/springframework/boot/reactor/autoconfigure/ReactorProperties.java)),
> the **Logback news page** for `logback-scoped-mdc` 1.0.0-rc0
> ([logback.qos.ch](https://logback.qos.ch/news.html)), and **JEP 506 · Scoped Values**, *"Closed /
> Delivered"* for **Release 25** ([openjdk.org](https://openjdk.org/jeps/506)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Logback 1.5.34.

**MDC is bound to a thread. The moment work leaves the thread that set it, the context is gone —
and every asynchronous mechanism in a modern Java service does exactly that. The naive fix is to
copy the map at every hand-off, which is correct and unmaintainable. This chunk is the four
mechanisms, the one fix each needs, and the thing that genuinely changes under virtual threads.**

## 1 · Executors and `@Async`: `TaskDecorator`

Spring's `TaskDecorator` wraps every submitted `Runnable`, which is the single place to solve this
for an entire executor.

```java
public class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> captured = MDC.getCopyOfContextMap();   // on the submitting thread
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            if (captured != null) { MDC.setContextMap(captured); } else { MDC.clear(); }
            try {
                runnable.run();
            } finally {
                if (previous != null) { MDC.setContextMap(previous); } else { MDC.clear(); }
            }
        };
    }
}
```

🔴 **`decorate` runs on the *submitting* thread; the returned lambda runs on the *worker*.** That
split is the entire mechanism, and getting it backwards — capturing inside the lambda — produces
code that compiles, runs, and propagates nothing.

Spring Framework already ships an implementation. Its javadoc:

> *"`TaskDecorator` that wraps the execution of tasks, assisting with context propagation. This
> operation is only useful when the task execution is scheduled on a different thread than the
> original call stack; this depends on the choice of `TaskExecutor`. This is particularly useful
> for restoring a logging context or an observation context for the task execution. Note that this
> decorator will cause some overhead for task execution and is not recommended for applications
> that run lots of very small tasks."*

`ContextPropagatingTaskDecorator` (Spring Framework 6.1+) delegates to Micrometer's
context-propagation library, so it carries the MDC *and* the observation context *and* anything else
with a registered `ThreadLocalAccessor` — which is what you want if you are also using tracing.

```java
@Bean
ThreadPoolTaskExecutor applicationTaskExecutor() {
    var executor = new ThreadPoolTaskExecutor();
    executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
    executor.initialize();
    return executor;
}
```

⚠️ **The javadoc's own caveat is a real constraint**: *"not recommended for applications that run
lots of very small tasks"*. Capturing and restoring a snapshot per task is not free, so a decorator
on an executor running millions of microsecond tasks is a measurable cost. Diagnostics still matter
there — the answer is usually to make the tasks bigger, not to give up the context.

**A decorator set on one executor covers only that executor.** `@Async` uses the application task
executor; a hand-rolled `Executors.newFixedThreadPool` in a `@Service` uses nothing. Every executor
in the application needs its own decorator, and the ones people forget are the ones they created
themselves.

## 2 · `CompletableFuture`: it depends which thread runs the stage

`CompletableFuture` is the case where the same code sometimes works and sometimes does not, which
is worse than always failing.

```java
CompletableFuture.supplyAsync(this::fetch)         // ForkJoinPool.commonPool — no MDC
    .thenApply(this::transform)                    // MAY run on the caller, MAY run on the pool
    .thenAccept(r -> log.info("done: {}", r));     // context depends on the above
```

🔴 **A `thenApply` stage runs on the completing thread if the future is already complete, and on the
caller's thread otherwise.** So the same statement logs with the correct MDC in a fast local test
and without it in production, where the future is still pending when the stage is attached. That is
a genuinely nasty class of intermittent bug.

**The fix is to pass an executor explicitly** — `supplyAsync(supplier, decoratedExecutor)`,
`thenApplyAsync(fn, decoratedExecutor)` — so the thread is one whose decorator you control. The
`commonPool` is shared with the whole JVM and cannot be decorated on your behalf.

## 3 · Reactive: `ThreadLocal` is the wrong container, and Boot has a property

In Reactor, an operator chain is assembled on one thread and executed on others, so a `ThreadLocal`
was never going to hold. Reactor's own container is the `Context`, and Micrometer's
context-propagation library bridges the two — it *"assists with context propagation across different
types of context mechanisms, such as `ThreadLocal`, Reactor Context, and others."*

Spring Boot exposes the mode as a property, and its enum documents both values:

| `spring.reactor.context-propagation` | Behaviour |
|---|---|
| `limited` (**default**) | *"Context Propagation is only applied to 'tap' and 'handle' Reactor operators."* |
| `auto` | *"Context Propagation is applied to all Reactor operators."* |

```properties
spring.reactor.context-propagation=auto
```

⚠️ **`auto` is not free and is not the default for that reason.** It installs propagation across
every operator, which is why Reactor treats it as opt-in. Turn it on deliberately, and expect the
MDC to be restored around operator execution rather than to be continuously present — you are not
getting a thread-bound context back, you are getting it re-established at the points that matter.

## 4 · Virtual threads: the leak mostly goes away, the cost changes

A virtual thread is a `Thread`, so `MDC.put` works exactly as before. Two things change.

**The pooled-thread leak largely evaporates.** The bug in
[06b](06b-mdc-and-thread-pools.md) exists because a *platform* thread is reused across requests.
A virtual thread is created per task and discarded, so a forgotten `remove` dies with the thread.

🔴 **"Largely" is doing work in that sentence.** Any executor you build over virtual threads that
*reuses* them, or any code that pins context to a carrier thread, brings the leak straight back —
and cleaning up is still correct discipline, because you cannot audit every future refactor that
changes how a task is scheduled.

**The `ThreadLocal` cost changes character.** With a small pool of platform threads, one MDC map
per thread is negligible. With a virtual thread per request and a very large number in flight, it
is one map per in-flight request — and the whole point of virtual threads is that the number in
flight can be enormous. That is a heap-footprint question, and Phase 6's `ThreadLocal` treatment
([`12 · ThreadLocal`](../../phase-6-concurrency/12-threadlocal-scopedvalue/01-threadlocal.md)) is
the place it is argued properly.

**And there is a purpose-built answer arriving.** Logback's news page records, for 2026-05-19:

> *"Initial release candidate of `logback-scoped-mdc` module. This module offers ScopedValue-based
> MDC for logback-classic. It is designed for virtual threads and structured concurrency on Java
> 25+."*

⚠️ **That is a release candidate — `1.0.0-rc0` — and I am not going to recommend it for production
on the strength of a release note.** But it is the direction: `ScopedValue` was finalised in JDK 25
by **JEP 506** (*"Closed / Delivered"*, Release 25), and its whole design is a value bound for a
bounded dynamic scope that *"enable[s] a method to share immutable data both with its callees within
a thread, and with child threads"* — which is what MDC has been approximating with a `ThreadLocal`
for twenty years. Phase 6 owns `ScopedValue` itself
([`12 · ScopedValue`](../../phase-6-concurrency/12-threadlocal-scopedvalue/02-scopedvalue.md)).

## The rule that makes all four tractable

**Set the MDC once, at the outermost boundary, and propagate at every thread hand-off with a
mechanism rather than by hand.** One filter sets it ([06b](06b-mdc-and-thread-pools.md)); one
decorator per executor carries it; one property covers Reactor. Application code never touches
propagation.

🔴 **The failure mode of doing it by hand is not that it breaks — it is that it works for the paths
someone remembered.** The log then has context on most lines and not on some, which is far harder
to diagnose than having none at all, because the absence looks like an unrelated code path rather
than a missing mechanism.

## Gotchas

**★ Capturing the MDC inside the decorated `Runnable` instead of in `decorate` propagates nothing.**
`decorate` runs on the submitting thread; the lambda runs on the worker. Capturing inside the lambda
captures the worker's context, which is exactly what you were trying to replace.

**★ A `TaskDecorator` covers one executor.**
`@Async` uses the application task executor; a `ThreadPoolExecutor` created inside a service uses
nothing. Every executor needs its own, and the hand-rolled ones are the ones that get missed.

**★ `CompletableFuture` stages run on an unpredictable thread.**
A non-`Async` stage runs on the completing thread or the caller depending on timing, so MDC
propagation works in a fast test and fails under production latency. Pass an explicit decorated
executor to every stage that logs.

**★ `ForkJoinPool.commonPool()` cannot be decorated.**
It is JVM-wide and shared. Anything using the default `supplyAsync` overload is running on it and
will not have your context.

**★ `spring.reactor.context-propagation` defaults to `limited`.**
Only `tap` and `handle` operators propagate. Code that assumes MDC is present throughout a reactive
chain is relying on `auto`, which has to be set explicitly and is not free.

**★ Virtual threads remove the leak but not the discipline.**
A virtual thread is discarded after its task, so a forgotten `remove` dies with it — until someone
introduces reuse. Cleanup should stay in place because the scheduling strategy is not a property
application code controls.

**★ One MDC map per in-flight virtual thread is a different footprint question.**
With a small platform pool the cost was fixed; with a virtual thread per request it scales with
concurrency, which is precisely what virtual threads are for.

**★ `logback-scoped-mdc` is a release candidate.**
`1.0.0-rc0`, dated 2026-05-19. It is the right direction on JDK 25 and it is not something to put
in front of production traffic on the strength of a release note.

**★ Partial propagation is worse than none.**
Context on most lines and missing on some reads as an unrelated code path rather than a missing
mechanism, so it is diagnosed much later and much more expensively.

**★ `ContextPropagatingTaskDecorator` has a documented overhead.**
Its javadoc says it is *"not recommended for applications that run lots of very small tasks"*. That
is a real constraint on a fine-grained executor, and the usual answer is coarser tasks rather than
no context.

## Interview questions

**★ Why does the MDC disappear when work moves to another thread, and what is the general fix?**
Because MDC is a `ThreadLocal` — the map belongs to the thread that set it, and a different thread
has a different map. The general fix is to capture the map on the submitting thread and install it
on the worker thread at the start of the task, restoring the worker's previous map afterwards. The
important part is that this is done once by a mechanism — a `TaskDecorator` on the executor — rather
than at each call site, because hand-written propagation only covers the paths someone remembered.

**★ What is subtle about `TaskDecorator`?**
That `decorate` and the returned `Runnable` execute on different threads. `decorate` is called on
the submitting thread, which is where the context you want still exists; the lambda it returns runs
on the worker. So the capture has to happen in `decorate`'s body and the install inside the lambda.
Writing the capture inside the lambda compiles and runs and propagates nothing, because by then you
are already on the worker.

**★ Why is `CompletableFuture` the worst case for MDC?**
Because the thread a stage runs on depends on timing rather than on the code. A non-`Async` stage
such as `thenApply` runs on the thread that completed the future if it is already complete, and on
the caller's thread otherwise. In a fast unit test the future is complete and the MDC is right; in
production the future is pending and the stage runs on a pool thread with no context. Same code,
different behaviour, intermittently. The fix is to pass an explicit decorated executor to every
stage — the default `commonPool` is JVM-wide and cannot be decorated by you.

**★ How does Reactor handle this, and what is the Spring Boot knob?**
Reactor cannot use a `ThreadLocal` because a chain is assembled on one thread and executed on
others, so it has its own `Context` and Micrometer's context-propagation library bridges between
the two. Boot exposes `spring.reactor.context-propagation`, whose values are `limited` — the
default, applying propagation only to the `tap` and `handle` operators — and `auto`, applying it to
all operators. `auto` is opt-in because it is not free, and even with it the MDC is re-established
around operator execution rather than being continuously present.

**★ Do virtual threads solve the MDC problem?**
They solve one half of it. The pooled-thread leak largely disappears, because a virtual thread is
created per task and discarded, so a forgotten `remove` dies with the thread instead of infecting
the next request. They do not solve propagation — work handed to another thread still loses the
context — and they change the cost profile, since one MDC map per in-flight virtual thread scales
with concurrency rather than with a fixed pool size. Logback has a `ScopedValue`-based MDC module
for exactly this, but it is at release-candidate stage.

**★ Why is `ScopedValue` a better fit than `ThreadLocal` for this problem?**
Because the lifetime is structural rather than implicit. A `ThreadLocal` value persists until
someone removes it, which is why forgetting the removal is a bug that outlives the request. A
`ScopedValue` is bound for a bounded dynamic scope and is immutable within it, and JEP 506 — final
in JDK 25 — describes it as letting a method share immutable data with its callees within a thread
and with child threads. That is exactly the MDC use case with the leak designed out, which is why
Logback has a module exploring it.

{/* FOOTER */}
