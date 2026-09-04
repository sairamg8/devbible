---
title: "Framework 7.0 added a mechanism nobody has written a blog post about yet — a cached context that is not currently in use has its lifecycle beans stopped, so the JMS listener and the scheduled job in a context from three test classes ago are no longer quietly running alongside your test"
sidebar_label: "05c · Context pausing"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Management → Context Pausing*
> ([context-pausing](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/context-pausing.html))
> — every `PauseMode` value, the default, the system-property name and the `isPauseable()`
> opt-out are quoted from that page.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Spring Framework 7.0.9**, JUnit Jupiter 6.0.3.
> **No sandbox** — no suite was run.

**This is new, and it is new in a way that matters: it is a behaviour change in how cached
contexts behave *while they are not being used*. If you are reading anything written for Boot 3
or Framework 6, it does not exist there. Worth knowing about before you meet it as a symptom.**

## The problem it solves

[05](05-the-context-cache.md) established that contexts are cached for the life of the JVM. That
has a consequence nobody designed for: **a cached context is a fully started application.** Its
`Lifecycle` beans started when it started, and until Framework 7.0 they simply kept running for
the rest of the test run.

So a suite that loads six different contexts ends up with six JMS listener containers polling,
six sets of `@Scheduled` methods firing, six connection pools with their eviction threads, and
six of anything else that implements `Lifecycle` — all live at once, all competing with the test
that is actually running, and five-sixths of them belonging to test classes that finished long
ago.

The symptoms are the diffuse kind: a suite that gets slower as it goes, a scheduled job that
processes rows a later test just inserted, a message consumed by a listener from a context nobody
is looking at.

## What 7.0 does

> *"As of Spring Framework 7.0, an `ApplicationContext` stored in the context cache may be
> **paused** when it is no longer actively in use and automatically **restarted** the next time
> the context is retrieved from the cache. Specifically, the latter will restart all auto-startup
> beans in the application context, effectively restoring the lifecycle state."*

and the reason, stated plainly:

> *"This ensures that background processes within the context are not actively running while the
> context is not used by tests. For example, JMS listener containers, scheduled tasks, and any
> other components in the context that implement `Lifecycle` or `SmartLifecycle` will be in a
> 'stopped' state until the context is used again by a test."*

Note the scope carefully. **Pausing is not eviction.** The context stays in the cache, keeps its
beans, keeps its singletons and its state. Only the *lifecycle* is stopped and later restarted.
It is `stop()` and `start()`, not close and rebuild — which is exactly what distinguishes it from
[`@DirtiesContext`](05b-what-evicts-it.md), and why it costs almost nothing.

## The three modes

| `PauseMode` | Behaviour |
|---|---|
| `ALWAYS` | *"Always pause inactive application contexts."* |
| `ON_CONTEXT_SWITCH` | *"Only pause inactive application contexts if the next context retrieved from the context cache is a different context."* — **the default** |
| `NEVER` | *"Never pause inactive application contexts, effectively disabling the pausing feature of the context cache."* |

The default is the sensible middle: **nothing is paused while a run of test classes keeps using
the same context**, which is the common case, and pausing only happens at the moment the suite
actually moves to a different one. So a well-consolidated suite pays essentially nothing for this
feature, and a fragmented one — the kind [05](05-the-context-cache.md) warns about — pauses often.

Configured with a JVM system property, *"case insensitive"*:

```text
-Dspring.test.context.cache.pause=always
-Dspring.test.context.cache.pause=never
```

It is also settable through the `SpringProperties` mechanism.

## Opting a bean out

> *"`SmartLifecycle` components can opt out of pausing by returning `false` from
> `SmartLifecycle#isPauseable()`."*

```java
@Component
class MetricsPublisher implements SmartLifecycle {

    @Override
    public boolean isPauseable() {
        return false;              // keep running even while the context is inactive
    }

    // start(), stop(), isRunning() ...
}
```

This is the hook to reach for if a component genuinely must keep running — but be suspicious of
the impulse. In a test run, a component that must keep running while no test is using its context
is doing something the tests are not observing, which is the situation pausing was added to
correct.

## What to actually do about it

Nothing, most of the time. The default is good and you should leave it alone.

Two situations where knowing this exists saves you:

- **A test starts failing on 7.0 that passed on 6.x, and it involves a listener, a scheduler or
  anything long-running.** The context it depends on may now be stopped between uses and restarted
  when reacquired. The fix is nearly always in the test — it was depending on background work
  continuing across classes, which was never a guarantee.
- **You are debugging lifecycle behaviour and see unexpected `start()`/`stop()` calls.** They are
  the pause mechanism, not a bug. `-Dspring.test.context.cache.pause=never` temporarily restores
  the old behaviour so you can tell the two apart.

## Gotchas and pitfalls

**★ Confusing pausing with eviction.**
Pausing stops lifecycle beans; the context and all its state remain cached. Eviction closes and
discards the context. `@DirtiesContext` and LRU eviction do the latter; this does the former.

**★ Expecting a `@Scheduled` job to keep firing across test classes.**
Under the default `ON_CONTEXT_SWITCH` it stops as soon as the suite moves to a different context.
A test that relied on that was relying on undocumented behaviour, and on 6.x it was relying on
timing.

**★ Reading unexpected `stop()` and `start()` logging as a defect.**
On 7.0 that is the pause mechanism doing its job. Set the mode to `never` to check before
investigating further.

**★ Returning `false` from `isPauseable()` to fix a failing test.**
It restores the pre-7.0 behaviour for that bean, including the cross-context interference the
feature exists to prevent. The test's dependency on background work is the thing to look at.

**★ Assuming this reduces your suite's context count.**
It does not touch the cache key or the number of contexts. It reduces *interference* between
cached contexts, not startup cost. [05](05-the-context-cache.md) is still where suite runtime is
won.

**★ Looking for this in Boot 3 material.**
It does not exist before Framework 7.0. Anything written earlier describes a world where every
cached context's listeners ran continuously.

## Interview questions

**★ What is context pausing and when was it introduced?**
Spring Framework 7.0. A context sitting in the test context cache but not currently in use has
its lifecycle beans stopped, and is restarted — all auto-startup beans — the next time a test
retrieves it from the cache. The context itself is never closed or discarded.

**★ What problem does it solve?**
That a cached context is a *started* application. Before 7.0, every context the suite had ever
loaded kept its `Lifecycle` beans running for the rest of the JVM's life — JMS listener
containers polling, `@Scheduled` methods firing, pool threads evicting — all concurrently with
whichever test was actually running. Pausing confines background work to the context currently
under test.

**★ What are the modes and what is the default?**
`ALWAYS`, `ON_CONTEXT_SWITCH` and `NEVER`, defaulting to `ON_CONTEXT_SWITCH` — pause only when the
next context taken from the cache is a *different* one. Set with the JVM system property
`spring.test.context.cache.pause`, which is case insensitive, or via `SpringProperties`.

**★ How is pausing different from `@DirtiesContext`?**
Pausing calls `stop()` on lifecycle beans and later `start()`; the context, its singletons and
their state stay in the cache. `@DirtiesContext` removes the context from the cache and closes it,
so the next test with that configuration pays a full rebuild. One is nearly free, the other is the
most expensive thing you can write in a test.

**★ How does a bean opt out?**
By implementing `SmartLifecycle` and returning `false` from `isPauseable()`. Worth treating as a
smell: a component that must keep running while no test is using its context is doing work no test
observes.

**★ A test that passed on Boot 3 fails on Boot 4 and involves a message listener. Where would you
look?**
At context pausing, among the first things. On 7.0 the listener's context may be stopped between
uses and restarted on reacquisition, where on 6.x it ran continuously. Confirm by setting
`spring.test.context.cache.pause=never`; if the test passes, it was depending on background work
continuing across test classes, which was never guaranteed.

{/* FOOTER */}
