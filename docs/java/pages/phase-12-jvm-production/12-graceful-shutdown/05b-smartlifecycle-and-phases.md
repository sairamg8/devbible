---
title: "Phases are the only mechanism Spring gives you for ordering teardown, they run in reverse on shutdown, and the two defaults — SmartLifecycle's DEFAULT_PHASE and plain Lifecycle's implicit zero — already encode an opinion you may not have noticed"
sidebar_label: "05b · SmartLifecycle and phases"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Framework `SmartLifecycle` javadoc**
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/SmartLifecycle.html)) —
> every quotation below — and the **Spring Boot 4.1** reference for
> `spring.lifecycle.timeout-per-shutdown-phase` (default `30s`) and the web server's position in
> the earliest stop phase. Spring Framework 7.0.8 / Spring Boot 4.1.0, JDK 25.
> 🔴 **No sandbox** — no context was started or closed for this page.

**`@PreDestroy` answers "run this when the bean is destroyed". `SmartLifecycle` answers "run
this at a defined point relative to everything else", which is the question shutdown actually
poses.**

## The contract

> *"An extension of the `Lifecycle` interface for those objects that require to be started upon
> `ApplicationContext` refresh and/or shutdown in a particular order."*

Three methods carry the meaning:

- **`getPhase()`** — where in the order this component sits.
- **`isAutoStartup()`** — whether the context starts it on refresh; *"The default implementation
  returns `true`."*
- **`stop(Runnable callback)`** — the asynchronous stop.

## The ordering rule, and its reversal

> *"The startup process begins with the lowest phase value and ends with the highest phase value
> (`Integer.MIN_VALUE` is the lowest possible, and `Integer.MAX_VALUE` is the highest possible).
> The shutdown process will apply the reverse order. Any components with the same value will be
> arbitrarily ordered within the same phase."*

with the worked example from the javadoc:

> *"if component B depends on component A having already started, then component A should have a
> lower phase value than component B. During the shutdown process, component B would be stopped
> before component A."*

🔴 **So the rule to memorise is: things that depend on other things get *higher* phases, and
higher phases stop first.** Your web layer and message consumers are dependents; your pools and
clients are dependencies.

⚠️ **"Arbitrarily ordered within the same phase" is the trap.** Two beans in one phase have no
relationship at all — putting them in the same phase is a statement that you do not care.

Two further rules from the javadoc:

> *"Any explicit "depends-on" relationship will take precedence over the phase order such that
> the dependent bean always starts after its dependency and always stops before its dependency."*

> *"Any `Lifecycle` components within the context that do not also implement `SmartLifecycle`
> will be treated as if they have a phase value of `0`."*

## The default phase, and what it implies

`getPhase()`'s default:

> *"The default implementation returns `DEFAULT_PHASE` in order to let `stop()` callbacks
> execute before regular `Lifecycle` implementations."*

🔴 **Implementing `SmartLifecycle` without overriding `getPhase()` puts you at the top**, so you
stop *first* — before plain `Lifecycle` beans at phase 0. That is a sensible default for
something that accepts work, and exactly wrong for something that holds a resource work needs.
**If you implement the interface, state the phase.**

## `stop(Runnable)` — the callback you must invoke

> *"The callback-accepting `stop(Runnable)` method is useful for objects that have an
> asynchronous shutdown process. Any implementation of this interface must invoke the callback's
> `run()` method upon shutdown completion to avoid unnecessary delays in the overall
> `ApplicationContext` shutdown."*

> *"The `LifecycleProcessor` will call only this variant of the stop method; i.e.
> `Lifecycle.stop()` will not be called for `SmartLifecycle` implementations unless explicitly
> delegated to within the implementation of this method."*

🔴 **Forgetting to call `callback.run()` costs you the entire phase timeout** — 30 seconds by
default, per phase, waiting for a component that already finished. This is one of the most
common causes of "shutdown takes exactly 30 seconds".

⚠️ **The no-arg `stop()` is not called for `SmartLifecycle` beans** unless your `stop(Runnable)`
delegates to it. Implementing both and putting the logic in the wrong one is a silent no-op. The
javadoc notes the default `stop(Runnable)` *"delegates to `Lifecycle.stop()` and immediately
triggers the given callback in the calling thread"*, with no synchronisation between the two.

## A worked shape

```java
@Component
class OutboxPublisher implements SmartLifecycle {

    private volatile boolean running;

    @Override public int getPhase() {
        // stops before the connection pool (lower phase), after the web layer
        return 1_000;
    }

    @Override public void start() { running = true; /* start polling */ }

    @Override public boolean isRunning() { return running; }

    @Override public void stop(Runnable callback) {
        running = false;
        drainInFlight();          // bounded — must fit in the phase timeout
        callback.run();           // 🔴 never forget this
    }
}
```

⚠️ **`drainInFlight()` must be bounded.** The phase timeout will not save the *shutdown* from
being slow; it caps the wait, and then shutdown proceeds anyway, possibly abandoning the work you
were draining.

## Phases versus `@PreDestroy` versus `DisposableBean`

| Mechanism | Ordering you get |
|---|---|
| `SmartLifecycle` phase | Explicit, numeric, reversed on shutdown — the real tool |
| `@PreDestroy` / `DisposableBean` | Bean-destruction order, which follows injection dependencies only |
| Plain `Lifecycle` | Treated as phase `0` |
| A JDK shutdown hook | None — unspecified order ([03](03-shutdown-hooks.md)) |

🔴 **Injection dependency is not runtime dependency.** A component can use a bean it never had
injected — through an intermediary, a registry, a static holder — and bean-destruction order
knows nothing about that.

## Gotchas

🔴 **Not calling `callback.run()` burns the whole phase timeout.** A shutdown that always takes
exactly 30 seconds, with a healthy signal path, points here.

🔴 **`SmartLifecycle`'s default phase stops you first.** Override `getPhase()` deliberately.

⚠️ **Same phase means arbitrary order** — never use it to express a dependency.

⚠️ **`Lifecycle.stop()` is not called for `SmartLifecycle` beans**; only `stop(Runnable)` is,
unless you delegate.

⚠️ **Every additional phase can cost another timeout.** The budget is per phase
([04](04-spring-graceful-shutdown.md)), so keep phases few and meaningful.

⚠️ **`isAutoStartup()` defaults to `true`,** and the javadoc notes that auto-startup means
`lazy-init` has *"very limited actual effect on `SmartLifecycle` beans"* — implementing the
interface makes a bean eager.

⚠️ **`depends-on` overrides phase order**, which is convenient and easy to forget when you are
reasoning purely in numbers.

## Interview questions

**★ How do `SmartLifecycle` phases order startup and shutdown?**
Startup runs from the lowest phase to the highest; shutdown applies the reverse, so the highest
phase stops first. Components sharing a phase are ordered arbitrarily.

**★ Where should a component that holds a connection pool sit relative to the web layer?**
In a lower phase. The web layer depends on it, so the web layer must have the higher phase and
stop first, leaving the pool alive while in-flight requests finish.

**★ What does `getPhase()` return by default, and why is that a problem?**
`DEFAULT_PHASE`, documented as letting `stop()` callbacks execute before regular `Lifecycle`
implementations — effectively the top of the order, so the bean stops first. Correct for
something that accepts work, wrong for anything holding a resource that work still needs.

**★ What must `stop(Runnable)` always do?**
Invoke the callback's `run()` on completion. The javadoc requires it *"to avoid unnecessary
delays in the overall `ApplicationContext` shutdown"* — omitting it costs the full phase timeout.

**★ Is `Lifecycle.stop()` called on a `SmartLifecycle` bean?**
No — the `LifecycleProcessor` calls only `stop(Runnable)`, unless your implementation delegates
to the no-arg version.

**★ How are plain `Lifecycle` beans ordered relative to `SmartLifecycle` ones?**
They are treated as phase `0`, so a `SmartLifecycle` bean with a negative phase starts before
them and one with a positive phase starts after them — and the reverse on shutdown.

**★ Why isn't `@PreDestroy` sufficient for teardown ordering?**
Because bean destruction follows injection dependencies, which are not the same as runtime usage
relationships. A component can depend at run time on a bean it never had injected, and
`@PreDestroy` ordering knows nothing about that.

Next: [Executors and schedulers](06-executors-and-schedulers.md).

{/* FOOTER */}
