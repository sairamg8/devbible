---
title: "Shutdown hooks start in an unspecified order, run concurrently with everything else, and the JVM will wait forever if one of them hangs — three properties the javadoc states plainly and almost every shutdown bug ignores"
sidebar_label: "03 · Shutdown hooks"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java.lang.Runtime` javadoc**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Runtime.html)) —
> the "Shutdown Sequence" and "Java Virtual Machine Termination" sections, quoted verbatim
> below. 🔴 **No sandbox** — no JVM was run for this page.

**This is the only shutdown mechanism the platform gives you. Everything a framework does on
shutdown is built on it, and its documented guarantees are much weaker than the mental model
most people carry.**

## When the shutdown sequence starts

The javadoc lists exactly three triggers:

> *"when the number of live non-daemon threads drops to zero for the first time"* ·
> *"when the `Runtime.exit` or `System.exit` method is called for the first time"* ·
> *"when some external event occurs, such as an interrupt or a signal is received from the
> operating system."*

🔴 **The third is `SIGTERM`** ([02](02-signals.md)) — the operating-system path into this
sequence. The first is why a process with only daemon threads exits on its own, and why
[topic 15's](../15-checkpoint-restore-crac/03-the-resource-lifecycle.md) Jetty example needed an
extra non-daemon thread.

## The four properties that matter

**1 · Order is unspecified.**

> *"At the beginning of the shutdown sequence, the registered shutdown hooks are started in some
> unspecified order."*

🔴 **You cannot order teardown with multiple hooks.** If A must close before B, put both in one
hook — or use a framework that models phases ([05b](05b-smartlifecycle-and-phases.md)).

**2 · They run concurrently — with each other and with your application.**

> *"They run concurrently with any daemon or non-daemon threads that were alive at the beginning
> of the shutdown sequence."*

⚠️ **Your request-handling threads are still running while your hook closes their connection
pool.** Every hook is concurrent code executing against a live application; thread-safety is not
optional here.

**3 · A hook that hangs hangs the JVM.**

> *"It is possible that one or more shutdown hooks do not terminate, for example, because of an
> infinite loop. In this case, the shutdown sequence will never finish."*

🔴 **There is no timeout.** The JVM waits indefinitely, and in a container that means waiting
until `SIGKILL` at the end of the grace period. A hook that blocks on a network call to a
service that is also being redeployed is the classic instance.

The javadoc's own escape hatch: *"Other threads and shutdown hooks continue to run and can
terminate the JVM via the `halt` method."*

**4 · The window closes.**

> *"After the shutdown sequence has begun, registration and de-registration of shutdown hooks
> with `addShutdownHook` and `removeShutdownHook` is prohibited. However, creating and starting
> new threads is permitted."*

⚠️ **Lazy initialisation that registers a hook will throw if it first happens during shutdown** —
a real failure mode for a component initialised on first use, when that first use is a
shutdown-time flush.

## The API

```java
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    // must be fast, thread-safe, and must terminate
}, "my-shutdown-hook"));
```

The hook is an **unstarted `Thread`**, and the JVM starts it. ⚠️ Starting it yourself makes
things undefined: *"Prior to the beginning of the shutdown sequence, it is possible for a program
to start a shutdown hook by calling its `start` method explicitly. If this occurs, the behavior
of the shutdown sequence is unspecified."*

🔴 **Name the thread.** An unnamed `Thread-12` in a thread dump taken during a hung shutdown is
the difference between a two-minute diagnosis and an hour ([topic 05](../05-thread-dumps/README.md)).

## `Runtime.halt` — the one to be afraid of

> *"The JVM terminates when the shutdown sequence finishes or when `halt` is called."*

`halt` stops the JVM immediately: no hooks, no `finally`, no flush. It is the in-process
equivalent of `SIGKILL`.

- **Legitimate use:** a watchdog that gives shutdown a bounded time and then forces exit rather
  than waiting for the container runtime's `SIGKILL`. That is a deliberate trade of clean
  teardown for a predictable exit.
- ⚠️ **Illegitimate and common:** a library calling `halt` inside its own shutdown path, taking
  every other hook down with it. If shutdown work is silently skipped, look for `halt` before
  suspecting the JVM.

## Where Spring fits

Spring Boot registers a shutdown hook that closes the application context, which is what turns
`SIGTERM` into `Lifecycle.stop`, `@PreDestroy` and the web server's graceful drain
([04](04-spring-graceful-shutdown.md)). 🔴 **Prefer `@PreDestroy` and `SmartLifecycle` to a raw
hook**: you get ordering, you get phases, you get a timeout, and you get to stop reasoning about
unspecified ordering. A raw hook is for code with no container — a plain `main`, an agent, a
library.

⚠️ **Logging is itself a shutdown-hook participant.** If the logging system's hook runs before
yours, your shutdown messages go nowhere; this is why Boot's logging system takes care over its
own hook, and why "no logs during shutdown" is not proof that nothing ran.

## Gotchas

🔴 **Hook order is unspecified — never encode a dependency across two hooks.**

🔴 **A hanging hook has no timeout and blocks the JVM until `SIGKILL`.** Bound every network
call inside a hook.

⚠️ **Hooks run concurrently with live application threads.** Closing a resource in a hook while
requests still use it is a race you have to design for.

⚠️ **`addShutdownHook` during shutdown throws.** Do not register lazily.

⚠️ **`System.exit` inside a hook can deadlock**: the sequence has already begun, and the call
will not restart it. Let the hook return instead.

⚠️ **`Runtime.halt` skips everything, including other libraries' hooks.** Use it only as a
deliberate, last-resort watchdog.

⚠️ **Daemon threads are not stopped for you.** They keep running through the shutdown sequence
and die only when the JVM terminates — so a daemon thread mid-write can be cut off.

⚠️ **Hooks also run on `System.exit`, not just on signals**, so a test or a CLI path that exits
deliberately exercises the same code.

## Interview questions

**★ What are the three documented triggers of the JVM shutdown sequence?**
The number of live non-daemon threads dropping to zero for the first time; the first call to
`Runtime.exit` or `System.exit`; and an external event such as an interrupt or an operating
system signal.

**★ In what order do shutdown hooks run?**
An unspecified order, started at the beginning of the sequence and running concurrently with
each other and with any threads that were already alive. Cross-hook ordering cannot be relied on.

**★ What happens if a shutdown hook never returns?**
The shutdown sequence never finishes and the JVM does not terminate. There is no built-in
timeout; another thread or hook can force the issue with `Runtime.halt`. In a container the
practical outcome is `SIGKILL` at the end of the grace period.

**★ What does `Runtime.halt` do and when is it defensible?**
It terminates the JVM immediately, skipping all hooks. It is defensible as a watchdog that
bounds shutdown time deliberately; it is a bug when a library calls it and silently cancels
everyone else's teardown.

**★ Can you register a shutdown hook during shutdown?**
No — registration and de-registration are prohibited once the sequence has begun, though
creating and starting new threads is permitted. Lazily registering a hook can therefore throw
at the worst moment.

**★ Why prefer `@PreDestroy` or `SmartLifecycle` over a raw hook in a Spring application?**
Because the container gives you defined ordering, phases and a configurable timeout, whereas raw
hooks give you unspecified order, no timeout and manual concurrency management. Spring's own
hook is what invokes them.

**★ Why should shutdown hook threads be named?**
Because a hung shutdown is diagnosed from a thread dump, and an unnamed thread makes that much
harder. Naming turns "something is stuck" into "the cache-flush hook is stuck".

Next: [Spring's graceful shutdown](04-spring-graceful-shutdown.md).

{/* FOOTER */}
