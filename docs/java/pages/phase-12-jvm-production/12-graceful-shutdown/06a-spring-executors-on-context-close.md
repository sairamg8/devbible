---
title: "Spring's executors stop in their own lifecycle phase, below the web server and above your beans, and their default on context close is to interrupt running tasks and clear the queue without waiting — two properties change that, and both are needed"
sidebar_label: "06a · Spring's executors on context close"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **Spring Framework 7.0 javadoc** for `ExecutorConfigurationSupport`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ExecutorConfigurationSupport.html)),
> `ThreadPoolTaskExecutor` and `ScheduledAnnotationBeanPostProcessor` (same javadoc tree), and the
> **Spring Boot 4.1 application-properties appendix** for `spring.task.execution.*` and
> `spring.task.scheduling.*` ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8. 🔴 **No sandbox** — no context was closed.

**[06](06-executors-and-schedulers.md) was the JDK contract. This is what Spring does with it on
your behalf when the context closes — which is more than it used to, and less than most people
assume: the pool stops in a sensible phase, but it stops by interrupting.**

## Executors are `SmartLifecycle` beans now

Since Framework 6.1 a `ThreadPoolTaskExecutor` / `ThreadPoolTaskScheduler` is not just a bean with a
destroy method. `ExecutorConfigurationSupport` *"participates in the application context lifecycle
through `SmartLifecycle` integration, stopping on context close"*, and since 6.2 its phase is:

> *"The default phase for an executor `SmartLifecycle`: `Integer.MAX_VALUE / 2`. This is different
> from the default phase `Integer.MAX_VALUE` associated with other `SmartLifecycle` implementations,
> putting the typically auto-started executor/scheduler beans into an earlier startup phase and a
> later shutdown phase while still leaving room for regular `Lifecycle` components with the common
> phase 0."*

🔴 **So the web server (highest phase, [05b](05b-smartlifecycle-and-phases.md)) stops before the
executors, which stop before plain beans.** That is the correct order for the async-handler trap in
[04b](04b-what-graceful-actually-drains.md) — and it holds only for beans that inherit this default.
A pool you wrap in your own `SmartLifecycle` gets `DEFAULT_PHASE` and stops *first*.

## The flags and their defaults

| Setter | Boot property | Default | What it does |
|---|---|---|---|
| `setWaitForTasksToCompleteOnShutdown` | `spring.task.execution.shutdown.await-termination` | `false` | `true` → `shutdown()` and run the queue; `false` → *"an immediate shutdown through interrupting ongoing tasks and clearing the queue"* |
| `setAwaitTerminationSeconds` | `spring.task.execution.shutdown.await-termination-period` | unset (no wait) | *"By default, this executor won't wait for the termination of tasks at all."* Sets the bounded `awaitTermination` |
| `setAcceptTasksAfterContextClose` | `spring.task.execution.pool.shutdown.accept-tasks-after-context-close` | `false` | `true` → keep accepting submissions from other beans' stop/destroy callbacks |
| `setStrictEarlyShutdown` (`ThreadPoolTaskExecutor`) | — | `false` since 6.1.4 | `true` → explicit `shutdown()` on `ContextClosedEvent`, rejecting late tasks |

The same two `shutdown.*` properties exist under `spring.task.scheduling.` for the scheduler, and
the appendix gives the thread-name prefixes as `task-` and `scheduling-`.

🔴 **Read the first default again: `false` means interrupt and clear the queue.** The javadoc is
blunt about what `awaitTerminationSeconds` adds: *"Note that Spring's container shutdown continues
while ongoing tasks are being completed. If you want this executor to block and wait for the
termination of tasks before the rest of the container continues to shut down — for example, in order
to keep up other resources that your tasks may need —, set the `awaitTerminationSeconds` property
instead of or in addition to this property."* Without it, the pool is torn down while the connection
pool it needs (**07** *(not written yet)*) is next in line.

## The coordinated stop phase, and how you opt out of it

On `ContextClosedEvent`, `initiateEarlyShutdown()` runs *"if the `acceptTasksAfterContextClose` and
`waitForTasksToCompleteOnShutdown` flags have not been set"* — *"do not trigger further tasks, let
existing tasks complete before hitting the actual destruction step"*. That is the *coordinated*
lifecycle stop: the executor pauses in its phase, existing tasks finish within the phase timeout, and
destruction comes later.

Setting either flag changes the shape. The `setAcceptTasksAfterContextClose` javadoc: *"The executor
will not go through a coordinated lifecycle stop phase then but rather only stop tasks on its own
shutdown"* — and `waitForTasksToCompleteOnShutdown` *"effectively is a specific variant of this flag,
replacing the early soft shutdown in the concurrent managed stop phase with a serial soft shutdown in
the executor's destruction step, with individual awaiting according to the `awaitTerminationSeconds`
property."* `ThreadPoolTaskExecutor.setStrictEarlyShutdown` adds the nuance for the executor: since
6.1.4 the default is *"leniently allowing for late tasks to arrive after context close, still
participating in the lifecycle stop phase"*, while `true` is *"a strict early shutdown signal
analogous to the 6.1-established default behavior of `ThreadPoolTaskScheduler`."*

⚠️ **So the wait you configure with the two properties happens at bean destruction, not in the
phase.** Ordering relative to other `SmartLifecycle` beans becomes destruction order — injection
dependencies ([05](05-the-order-of-teardown.md)) — not phase order. For most applications that is
fine, because the pool's real dependency, the `DataSource`, is injected into the beans the tasks
use; it is a surprise only if you were counting on phases.

## `@Scheduled` has its own participant

`ScheduledAnnotationBeanPostProcessor` *"Reacts to `ContextRefreshedEvent` as well as
`ContextClosedEvent`: performing `finishRegistration()` and early cancelling of scheduled tasks,
respectively."* Cancellation stops future firings. A `@Scheduled` body that is *running* is not
interrupted by that cancellation; it is abandoned only when its scheduler is — with the scheduler's
own `await-termination` defaults deciding whether anyone waits.

## A configuration that actually waits

```properties
# Finish queued work rather than interrupting it, but bound the wait
spring.task.execution.shutdown.await-termination=true
spring.task.execution.shutdown.await-termination-period=15s
spring.task.scheduling.shutdown.await-termination=true
spring.task.scheduling.shutdown.await-termination-period=15s
# Name the threads — a thread dump of a hung shutdown is otherwise unreadable
spring.task.execution.thread-name-prefix=app-task-
spring.task.scheduling.thread-name-prefix=app-sched-
```

The javadoc's own sizing rule: *"specify a significantly higher timeout here if you set
`waitForTasksToCompleteOnShutdown` to `true` at the same time, since all remaining tasks in the queue
will still get executed — in contrast to the default shutdown behavior where it's just about waiting
for currently executing tasks that aren't reacting to thread interruption."*

⚠️ **The 15s above is not a free choice.** It must fit inside `spring.lifecycle.timeout-per-shutdown-phase`
([04](04-spring-graceful-shutdown.md)) and, with the web drain and the preStop sleep, inside
`terminationGracePeriodSeconds` (**08b** *(not written yet)*). Add them up.

For a pool you build yourself, the same knobs in code:

```java
@Bean
ThreadPoolTaskExecutor reportExecutor() {
    var executor = new ThreadPoolTaskExecutor();
    executor.setThreadNamePrefix("report-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(15);   // bounded — never omit this with the flag above
    return executor;
}
```

⚠️ **Boot's auto-configured executor backs off when you define your own `Executor` bean**, and with
it the `spring.task.execution.*` properties stop applying to anything — they configure the
auto-configured instance, not yours. If you replace it, carry the shutdown settings across, or build
from the auto-configured `ThreadPoolTaskExecutorBuilder`, which does.

## Virtual threads

With `spring.threads.virtual.enabled=true` Boot's task executor is a `SimpleAsyncTaskExecutor` on
virtual threads, not a `ThreadPoolTaskExecutor`; the appendix marks every `pool.*` property *"Doesn't
have an effect if virtual threads are enabled"*. The scheduling side becomes a
`SimpleAsyncTaskScheduler`. Virtual threads are daemon ([06](06-executors-and-schedulers.md)), so the
executor's own lifecycle is the only thing that waits for them —
`spring.task.execution.simple.cancel-remaining-tasks-on-close` (default `false`, *"Only recommended if
threads are commonly expected to be stuck"*) is the virtual-thread counterpart of `shutdownNow`.

## Gotchas

**★ Spring's default is interrupt-and-clear, not drain.** `waitForTasksToCompleteOnShutdown` is
`false`; the queue is discarded and running tasks are interrupted.

**★ `waitForTasksToCompleteOnShutdown=true` alone does not make the container wait.** Shutdown
*"continues while ongoing tasks are being completed"* — set `awaitTerminationSeconds` too.

**★ Setting either flag opts out of the coordinated stop phase.** The javadoc calls the result a
*"late shutdown"*; the wait moves to bean destruction and ordering follows injection dependencies.

**★ Executor phase is `Integer.MAX_VALUE / 2` only for Spring's executor classes.** A pool you wrap
in your own `SmartLifecycle` gets `DEFAULT_PHASE` and stops *first* ([05b](05b-smartlifecycle-and-phases.md)).

**★ `@Scheduled` cancellation does not interrupt a running body.** Only the scheduler's
`shutdownNow()` does, and only if the body checks the interrupt.

**★ Defining your own `Executor` bean silently detaches the `spring.task.execution.*` properties.**
They configure the auto-configured executor, which has backed off.

**★ `pool.*` properties do nothing under virtual threads.** Different executor class, different
knobs; the `shutdown.*` ones still apply.

**★ Unnamed pool threads make a hung shutdown undiagnosable.** Set the prefix; a thread dump
([topic 05](../05-thread-dumps/README.md)) is how you find out which task refused to stop.

**★ The await period is spent inside a lifecycle phase or a destroy step that has its own outer
timeout.** A 30-second await under a 30-second phase timeout under a 30-second grace period is three
budgets that cannot all be honoured.

## Interview questions

**★ What does Spring's `ThreadPoolTaskExecutor` do on context close by default?**
Since 6.1 it participates as a `SmartLifecycle` at phase `Integer.MAX_VALUE / 2`, receives an early
shutdown signal on `ContextClosedEvent`, and then — because `waitForTasksToCompleteOnShutdown` is
`false` and no `awaitTerminationSeconds` is set — shuts down immediately, interrupting running tasks
and clearing the queue, without the container waiting.

**★ Which two settings make Spring drain a pool and wait, and why both?**
`waitForTasksToCompleteOnShutdown=true` switches from `shutdownNow` to `shutdown`, so queued tasks
run; `awaitTerminationSeconds` makes the container block for them. The javadoc says container
shutdown otherwise *"continues while ongoing tasks are being completed"* — the pool would keep
working while the resources it needs are closed.

**★ Where do executors sit in Spring's stop order relative to the web server?**
Below it: the web server drains in the highest phase, executors stop at `Integer.MAX_VALUE / 2`, and
plain `Lifecycle` beans at 0. That keeps executors alive while async request handlers finish.

**★ What changes when you set `acceptTasksAfterContextClose` or `waitForTasksToCompleteOnShutdown`?**
The executor no longer takes part in the coordinated lifecycle stop phase; it stops at its own
destruction step instead — a *"late shutdown"* in the javadoc's words — with any waiting governed by
`awaitTerminationSeconds` there.

**★ Does cancelling `@Scheduled` tasks on context close stop a job that is running?**
No. `ScheduledAnnotationBeanPostProcessor` cancels future executions; the running body finishes or
is interrupted only when its scheduler is shut down with `shutdownNow`, and only if it checks.

**★ You defined a custom `Executor` bean and the shutdown properties stopped working. Why?**
Boot's auto-configured executor backed off, and `spring.task.execution.*` configures only that
instance. Either set the flags on your bean or build it from the auto-configured builder.

Next: **Message consumers** *(not written yet)*.

{/* FOOTER */}
