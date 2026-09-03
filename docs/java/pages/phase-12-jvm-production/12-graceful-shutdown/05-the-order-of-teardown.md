---
title: "Teardown has one correct order — stop accepting, finish in flight, stop producing work, then close what the work was using — and every production shutdown bug is that order violated somewhere"
sidebar_label: "05 · The order of teardown"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 reference**, "Web → Graceful Shutdown"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)) —
> which states that the web server's drain runs *"in the earliest phase of stopping
> SmartLifecycle beans"* — the application-properties appendix for
> `spring.lifecycle.timeout-per-shutdown-phase` (default `30s`), and the **JDK 25 `Runtime`
> javadoc** for shutdown-hook ordering. 🔴 **No sandbox.**

**Shutdown is the reverse of startup, and like startup it has a dependency graph. The
difference is that nothing enforces it: a shutdown in the wrong order still exits cleanly and
still reports success.**

## The order

1. **Fail readiness.** Tell the routing layer to stop sending — and keep serving while that
   propagates (**08** *(not written yet)*).
2. **Stop accepting new work.** The web server refuses new connections; message consumers stop
   fetching; schedulers stop firing new tasks.
3. **Finish work in flight.** In-flight requests complete, in-flight messages are processed and
   acknowledged, running tasks finish.
4. **Stop the things that produce work.** Schedulers and executors shut down once their queues
   have drained or been abandoned deliberately.
5. **Close what the work was using.** Connection pools, HTTP clients, caches, files.
6. **Flush and close diagnostics last.** Metrics exporters, log appenders, trace exporters.
7. **Exit** — before the container's grace period expires.

🔴 **The invariant behind all seven steps: nothing a request might still need may be closed
before requests have finished.** Every bug in this topic is a violation of that sentence.

## The three classic violations

**Closing the pool before the requests finish.** The connection pool is a bean like any other,
and if it stops in the same phase as — or earlier than — the web layer, in-flight requests fail
on `getConnection()`. ⚠️ The symptom is a burst of pool-related exceptions *during* shutdown,
which looks like a pool problem and is an ordering problem
([07](07-connection-pools.md)).

**Stopping the executor the web layer is waiting on.** Async handlers finish on an executor
([04b](04b-what-graceful-actually-drains.md)). Stop it early and the drain waits for work that
has just been cancelled.

**Closing the message consumer after closing its database connection.** The consumer is still
processing an in-flight message and cannot commit it, so the message is redelivered — a
duplicate created by shutdown order alone ([06b](06b-message-consumers.md)).

## How Spring expresses the order

`SmartLifecycle` beans have a **phase**, and Spring stops them in **descending** phase order —
highest phase stops first. The web server occupies the earliest stop position by design, which
is why the framework's own components come apart in a sensible sequence without configuration.

⚠️ **Your beans default to a phase that does not encode your dependencies.** A plain
`@PreDestroy` runs during context close, but not with any relationship to the web server's
drain. Anything holding a resource that requests use must declare its phase explicitly
([05b](05b-smartlifecycle-and-phases.md)).

🔴 **And remember the timeout is per phase** ([04](04-spring-graceful-shutdown.md)): more phases
means more potential waiting, so express ordering with the smallest number of phases that
captures the real dependencies.

## Reasoning about it without guessing

Write down, for each stateful component, two facts: **what needs it while shutting down**, and
**what it needs while shutting down**. Then:

- Anything needed *by* request handling stops **after** the web layer.
- Anything that *produces* work stops **before** the things it hands work to.
- Diagnostics stop **last**, because everything above may want to log or record on the way out.

⚠️ **Watch for cycles.** A metrics exporter that writes over HTTP uses a client that uses a
connection pool that reports metrics. Cycles cannot be ordered; break them by accepting that one
side degrades (usually: let the exporter fail quietly at shutdown).

## Shutdown hooks cannot do this

The JDK's hooks start *"in some unspecified order"* and run concurrently
([03](03-shutdown-hooks.md)). 🔴 **Two hooks cannot express a dependency.** If you are outside a
container and need ordered teardown, use one hook that calls things in order — and inside
Spring, use phases and let the framework's hook drive them.

## Gotchas

🔴 **Ordering violations exit cleanly.** There is no error to look for; the evidence is the
exceptions thrown by *other* components during the shutdown window.

🔴 **`@PreDestroy` order across unrelated beans is not a dependency mechanism.** Spring destroys
beans respecting dependency injection relationships, which is not the same as your runtime
dependency graph.

⚠️ **More phases means more timeout budget consumed**, because the timeout is per phase. Use the
fewest phases that express real constraints.

⚠️ **Cyclic teardown dependencies exist** — exporter, client, pool, metrics — and must be broken
deliberately rather than discovered at 03:00.

⚠️ **Logging closing early makes every later step invisible.** Keep it last, and expect that
"nothing logged" during shutdown may mean "logging was already gone".

⚠️ **A component that reconnects on failure can fight shutdown**, re-establishing the connection
you just closed. Set a stopping flag before closing.

⚠️ **Startup order does not imply shutdown order.** Spring reverses destruction relative to
creation for dependencies, but runtime usage relationships are frequently not injection
relationships.

## Interview questions

**★ What is the correct order of teardown?**
Fail readiness; stop accepting new work; finish work in flight; stop the producers of work
(schedulers, executors); close the resources that work was using (pools, clients); flush and
close diagnostics; exit inside the grace period.

**★ State the invariant in one sentence.**
Nothing that in-flight work still needs may be closed before that work has finished.

**★ Give a concrete symptom of a teardown-order bug.**
A burst of connection-pool exceptions during shutdown: in-flight requests failing to get a
connection because the pool stopped in the same or an earlier phase than the web layer. It looks
like a pool fault and is an ordering fault.

**★ How does Spring let you control the order?**
Through `SmartLifecycle` phases — beans are stopped in descending phase order, with the web
server's drain in the earliest stop position. Plain `@PreDestroy` has no defined relationship to
that drain.

**★ Why can't shutdown hooks express ordering?**
Because the JDK starts them in an unspecified order and runs them concurrently. A dependency
between two hooks cannot be expressed; a single hook calling things in sequence can.

**★ Why should diagnostics be torn down last?**
Because every other component may want to log, export a metric or finish a trace on the way out.
Closing the logging system early makes the rest of shutdown invisible — including its failures.

**★ What do you do about a cyclic teardown dependency?**
Break it deliberately: decide which side is allowed to degrade — usually the exporter or
reporter — and accept that it may fail quietly during shutdown rather than trying to order a
cycle.

Next: [SmartLifecycle and phases](05b-smartlifecycle-and-phases.md).

{/* FOOTER */}
