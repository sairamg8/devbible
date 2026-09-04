---
title: "Graceful shutdown: the platform removes you from the load balancer and signals you at the same moment rather than in that order, every mechanism you can configure against that is a separate timeout that knows nothing about its neighbours, and only one number in the whole system is a total"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 → 2026-09-03 against the **Spring Boot 4.1** reference — *Graceful Shutdown*,
> *Application Availability*, *Actuator · Kubernetes Probes*, the *Kubernetes Container Lifecycle*
> how-to and the application-properties appendix
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)); the
> **Spring Framework 7.0** javadoc for `ExecutorConfigurationSupport` and `SmartLifecycle`; the
> **Spring for Apache Kafka** reference — *Listener Container Properties*, *Message Listener
> Containers* and *`@KafkaListener` Lifecycle Management*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/container-props.html)); the
> **Spring AMQP** reference — *Message Listener Container Configuration*
> ([docs.spring.io](https://docs.spring.io/spring-amqp/reference/amqp/containerAttributes.html));
> the **HikariCP** sources on `dev` for `HikariPool.shutdown()`
> ([github.com](https://github.com/brettwooldridge/HikariCP/blob/dev/src/main/java/com/zaxxer/hikari/pool/HikariPool.java));
> the **JDK 25** API documentation for `Runtime.addShutdownHook` and `java.sql.Connection.abort`;
> the **Kubernetes** *Pod Lifecycle* and *Container Lifecycle Hooks* documentation
> ([kubernetes.io](https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/)); and
> **RFC 9110** *Idempotent Methods*.
> 🔴 **No sandbox.** No cluster was run, no pod was deleted, no container was signalled and no pool
> was closed. Every number on these pages is a documented default, a value read from named source,
> or a worked example printed by the documentation itself — attributed in each case.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This topic owns stopping without dropping work. It exists because the intuitive model of a
shutdown — deregister, drain, exit — describes a sequence that no platform performs, and because
the six or seven timeouts that stand in for that sequence were each designed in isolation.**

Four findings here contradict what most teams believe about their own deploys, and each is read out
of documentation or source rather than asserted. **Kubernetes removes the pod from the endpoint
list and sends SIGTERM concurrently**, so the graceful shutdown you configured begins during the
window in which traffic is still arriving — Boot's own guide says the processing *"happens in
parallel"*. **The termination grace period starts counting before the `preStop` hook runs**, so the
sleep that buys back that window is spent out of the same budget as the drain, and Kubernetes
prints the worked example where that arithmetic gets a container killed. **A Kafka container's stop
finishes the entire poll batch by default** — `stopImmediate` is `false` — which at a default
`max.poll.records` of 500 can dominate the whole shutdown. And **closing the connection pool does
not wait for the query that is running; it aborts it**, in a hard-coded ten-second loop on an
executor HikariCP's own source names `connection-assassinator`.

The through-line is that **only `terminationGracePeriodSeconds` is a total.** Everything else —
`spring.lifecycle.timeout-per-shutdown-phase` (which is *per phase*, and also defaults to 30
seconds), each listener container's `shutdownTimeout`, the executors' `awaitTermination`, the
pool's own ten seconds — is a per-thing bound that knows nothing about its neighbours. Two
identical-looking 30s defaults measuring completely different things is the collision at the centre
of the topic.

And the honest conclusion, which [09](09-idempotency-as-the-backstop.md) states rather than
avoids: every mechanism here is a timeout, a timeout that expires produces exactly the outcome it
was there to prevent, and **the retry always lands on a different instance than the one that was
shut down** — so none of the in-process tricks that usually paper over duplicates can work.
Graceful shutdown changes the rate; idempotency is what makes the system correct.

**16 chunks, ~3,282 lines, 232 gotchas and interview questions.** Read in order.
[10 · The checklist](10-the-checklist.md) is the page to keep.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The deploy that dropped requests](01-the-deploy-that-dropped-requests.md)** | <span className="db-tier t-understand">Understand</span> | 503s during a rolling update that nobody attributed to shutdown |
| 2 | **[Signals](02-signals.md)** | <span className="db-tier t-understand">Understand</span> | SIGTERM vs SIGKILL, and PID 1 in a container |
| 3 | **[The shell that swallowed SIGTERM](02b-the-shell-that-swallowed-sigterm.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The `sh -c` entrypoint that never forwards the signal |
| 4 | **[Shutdown hooks](03-shutdown-hooks.md)** | <span className="db-tier t-understand">Understand</span> | `addShutdownHook`, ordering, no guarantees, `Runtime.halt` |
| 5 | **[Spring's graceful shutdown](04-spring-graceful-shutdown.md)** | <span className="db-tier t-understand">Understand</span> | Already the default on 4.1; the property now exists to turn it off |
| 6 | **[What graceful actually drains](04b-what-graceful-actually-drains.md)** | <span className="db-tier t-understand">Understand</span> | In-flight requests yes; long polls, SSE and WebSockets are a decision |
| 7 | **[The order of teardown](05-the-order-of-teardown.md)** | <span className="db-tier t-understand">Understand</span> | Stop accepting → finish in-flight → stop schedulers → close pools |
| 8 | **[`SmartLifecycle` and phases](05b-smartlifecycle-and-phases.md)** | <span className="db-tier t-understand">Understand</span> | Controlling that order for your own beans |
| 9 | **[Executors and schedulers](06-executors-and-schedulers.md)** | <span className="db-tier t-understand">Understand</span> | `shutdown` vs `shutdownNow`, and the task that was mid-flight |
| 10 | **[Spring's executors on context close](06a-spring-executors-on-context-close.md)** | <span className="db-tier t-understand">Understand</span> | Phase `Integer.MAX_VALUE / 2`, and a default that interrupts |
| 11 | **[Message consumers](06b-message-consumers.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The one component whose failure mode is a duplicate, not a drop |
| 12 | **[Connection pools](07-connection-pools.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 Closing the pool aborts the query; destruction has no timeout |
| 13 | **[Readiness and the load balancer](08-readiness-and-the-load-balancer.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 Removal and SIGTERM are concurrent; there is no polite 503 |
| 14 | **[preStop and the grace period](08b-prestop-and-termination-grace-period.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The countdown starts before the hook; the 55 + 10 > 60 example |
| 15 | **[Idempotency as the backstop](09-idempotency-as-the-backstop.md)** | <span className="db-tier t-understand">Understand</span> | The repeat lands on a different instance, so in-process dedup cannot work |
| 16 | **[The checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | A zero-drop rolling deploy, step by step |

## The boundary with the rest of the corpus

This topic owns **stopping**. It links rather than re-teaches:

- **[10 · Packaging for deploy](../10-packaging-for-deploy/README.md)** owns starting, the
  entrypoint and the base image — including whether that image has a shell for a `preStop` `exec`.
- **[08 · Metrics with Micrometer](../08-metrics-with-micrometer/README.md)** is where you get a
  defensible request-duration number to size the `preStop` sleep, rather than a guessed one.
- **[Phase 14 · Idempotency on the wire](../../phase-14-microservice-architecture/04-sync-vs-async/07d-idempotency-on-the-wire.md)**
  owns the HTTP contract — RFC 9110's retry rule, idempotency keys, the three routes.
- **[Phase 16 · Resilience and operating the fleet](../../phase-16-resilience-operations/README.md)**
  owns retries, backoff and circuit breakers. This topic only establishes that retries *will* happen
  during your deploys whether you configured any or not.

## If you read four pages

**[08 · Readiness and the load balancer](08-readiness-and-the-load-balancer.md)**, because it is the
cause of the most common symptom and the one people misattribute. **[08b · preStop and the grace
period](08b-prestop-and-termination-grace-period.md)**, because the arithmetic is where the fix
goes wrong. **[06b · Message consumers](06b-message-consumers.md)**, because it is usually the term
that dominates the budget and its defaults are the least known. And **[10 · The
checklist](10-the-checklist.md)**, because its ordering is the difference between a fix that takes
an afternoon and a month of tuning timeouts that were never the problem.

{/* FOOTER */}
