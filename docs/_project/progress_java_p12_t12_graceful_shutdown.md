---
name: progress-java-p12-t12-graceful-shutdown
description: Java phase 12 topic 12 · Graceful shutdown — CLOSED 2026-09-03 at 16 chunks + index, 3,282 lines, 232 stars. Carries the banked source quotes for Spring Kafka/AMQP container stop, HikariCP's abort loop, Connection.abort, the Kubernetes preStop countdown and the Boot readiness concurrency statement, so none of them need re-fetching.
metadata:
  type: project
---

# Java · phase 12 · topic 12 — Graceful shutdown — ✅ CLOSED 2026-09-03

Session `c246d8d8`, claimed and released on `devbible/JAVA-BOARD.md`. **Phase 12 is now 12/15.**

The topic was left at 10 chunks with no index by session `67176b1d` fork C on 2026-09-02. It owed
six chunks and the README; all seven are now written.

| File | pos | lines | ★ |
|---|---|---|---|
| `06b-message-consumers.md` | 11 | 278 | 28 |
| `07-connection-pools.md` | 12 | 276 | 29 |
| `08-readiness-and-the-load-balancer.md` | 13 | 267 | 23 |
| `08b-prestop-and-termination-grace-period.md` | 14 | 254 | 24 |
| `09-idempotency-as-the-backstop.md` | 15 | 217 | 22 |
| `10-the-checklist.md` | 16 | 226 | 20 |
| `README.md` | 0 | 105 | — |

Final: **16 chunks + index, 3,282 lines, 232 ★**, positions 0–16 contiguous, 0 over cap, 156 links
0 broken, 0 MDX hazards. `_category_.json` added to match topics 01–04 and 06–10.

🔴 **All 21 inbound `*(not written yet)*` markers were RE-LINKED as each chunk landed.** The topic
now has zero. Those markers came from the 2026-09-03 de-link pass
([[progress-build-warnings-20260903]]); re-linking is the half of that rule that gets forgotten.

## 🔴 THE THROUGH-LINE — the thing worth remembering about this topic

**Only `terminationGracePeriodSeconds` is a TOTAL.** Every other number is a per-thing bound that
knows nothing about its neighbours:

```
preStop sleep + web drain + Kafka 10s + AMQP 5s + executor awaitTermination
  + HikariCP's hard-coded 10s + JVM exit   <   terminationGracePeriodSeconds (30s)
```

`spring.lifecycle.timeout-per-shutdown-phase` **also defaults to 30s and is PER PHASE**. Two
identical-looking defaults measuring completely different things is the collision at the centre of
the topic — and raising the Spring one without raising the pod's grace period makes the outcome
strictly worse.

## 🔴 BANKED SOURCE — do not re-fetch

**Kubernetes · Container Lifecycle Hooks** (the single sharpest fact in the topic):

> *"The Pod's termination grace period countdown begins before the `PreStop` hook is executed, so
> regardless of the outcome of the handler, the container will eventually terminate within the
> Pod's termination grace period."*

> *"If, for example, `terminationGracePeriodSeconds` is 60, and the hook takes 55 seconds to
> complete, and the Container takes 10 seconds to stop normally after receiving the signal, then
> the Container will be killed before it can stop normally, since `terminationGracePeriodSeconds`
> is less than the total time (55+10) it takes for these two things to happen."*

Also: three handler types (Exec, HTTP, **Sleep** — native, 1.32+); a hanging hook leaves the pod
*"`Terminating` and remain there until the Pod is killed"*; delivery is *"at least once"* and
*"it is up to the hook implementation to handle this correctly"* — which is the real reason the
recommended hook is a sleep.

**Spring Boot · Kubernetes Container Lifecycle how-to** (`/how-to/deployment/cloud.html`):

> *"Because this shutdown processing happens in parallel (and due to the nature of distributed
> systems), there is a window during which traffic can be routed to a pod that has also begun its
> shutdown processing."*

> *"The delay should be at least as long as the longest time it takes to process an in-flight
> request. You should not rely on the Spring Boot graceful shutdown period alone…"*

Both `preStop` YAML forms are in chunk 08b (native `sleep:` for 1.32+, `exec: ["sh","-c","sleep 10"]`
below that). ⚠️ The `exec` form needs a shell **and** a `sleep` binary — a distroless/JRE image may
have neither and the failure is silent.

**Spring Boot · Graceful Shutdown:** enabled by default on **Jetty, Reactor Netty and Tomcat**
(Undertow not listed); all three *"stop accepting new requests at the network layer"* — so the
client gets a **socket reset, not a 503**; it is *"performed in the earliest phase of stopping
`SmartLifecycle` beans"*.

**Spring Kafka** — container properties, all quoted in chunk 06b:
`stopImmediate` default **`false`** — *"stop processing after the current record instead of after
processing all the records from the previous poll"*, so the DEFAULT finishes the whole batch ·
`shutdownTimeout` default **10000** · `ackMode` default **`BATCH`** = *"commit the offset when all
the records returned by the `poll()` have been processed"* (all seven AckMode descriptions are in
the chunk) · `asyncAcks` default false · containers are **not beans**, they live in
`KafkaListenerEndpointRegistry` · phase **`Integer.MAX_VALUE - 100`**, and the reference's own
explanation of the `- 100` is quoted.

**Spring AMQP:** `shutdownTimeout` default **five seconds** — *"it waits for in-flight messages to
be processed up to this limit"* · `forceCloseChannel` default **`true`** — *"the channel will be
closed, causing any unacked messages to be requeued."* AMQP states the duplicate outright where
Kafka only implies it.

**HikariCP** (`HikariPool.shutdown()`, `dev` branch): javadoc *"Shutdown the pool, closing all idle
connections and **aborting** or closing active connections."* The loop:

```java
do { abortActiveConnections(assassinExecutor); softEvictConnections(); }
while (getTotalConnections() > 0 && elapsedMillis(start) < SECONDS.toMillis(10));
```

Hard-coded ten seconds, **no property behind it**; the executor is named `connection-assassinator`.
"Shutdown always takes exactly ten seconds" is a good signature for a **leaked connection**.

**JDK 25 · `Connection.abort(Executor)`:** *"Insures that any thread that is currently accessing the
connection will either progress to completion **or throw an `SQLException`**"* — a disjunction, not
a promise — and *"when the `abort` method returns … the `Executor` … may still be executing tasks
to release resources"*, which is **why** Hikari loops rather than aborting once.

**Spring Boot · Application Availability:** `LivenessState` CORRECT/BROKEN, `ReadinessState`
ACCEPTING_TRAFFIC/REFUSING_TRAFFIC; `AvailabilityChangeEvent`;
`management.endpoint.health.probes.add-additional-paths=true` → `/livez` and `/readyz` on the main
server port.

**RFC 9110:** *"A request method is considered 'idempotent' if the intended effect on the server of
multiple identical requests with that method is the same as the effect for a single such request."*

## The argument chunk 09 makes that is NOT in phase 14

Phase 14's `07d-idempotency-on-the-wire.md` owns the RFC, the key pattern and the three routes —
linked, not re-taught. What is new here:

🔴 **The repeat never lands on the instance that was shut down.** That instance is gone. Which
invalidates, by construction, every in-process technique teams actually use: an in-memory
"already processed" set, a `synchronized` block, a local lock, a short-TTL cache. **At shutdown the
dedup state must live in the same durable store as the effect, in the same transaction.**

Also: three of the topic's four ambiguities are **unknown outcomes, not failures** — the write may
have landed and the only party who could say has exited.

## Where the teardown order comes from (published numbers, not folklore)

| Component | Phase | Stops |
|---|---|---|
| Web server graceful shutdown | *"earliest phase"* | first |
| Kafka listener containers | `Integer.MAX_VALUE - 100` | early |
| `ThreadPoolTaskExecutor`/scheduler | `Integer.MAX_VALUE / 2` | later |
| Ordinary `Lifecycle` | `0` | last of the lifecycle beans |
| **Pools, HTTP clients, caches** | **not lifecycle at all** — singleton destruction, reverse *dependency* order, **untimed** | after everything |

⚠️ `spring.lifecycle.timeout-per-shutdown-phase` does **not** apply to bean destruction. `@DependsOn`
is the ordering lever there; a `SmartLifecycle` phase is not.

## Boards wired

- `docs/java/pages/phase-12-jvm-production/README.md` — topic 12 row linked, count **11 → 12 of 15**
- `src/data/progress.js` — java phase 12 `pages: 11 → 12`, `updated: '2026-09-03 03:20'`
- `devbible/JAVA-BOARD.md` — row 12 ✅, phase header **12/15 80%**, roll-up **180 done / 53 pending**

## What is left in phase 12

1. **Topic 09 · Distributed tracing** — ⚠️ 6 chunks, no index. Next is
   `03c-tracestate-and-baggage.md` at pos 7; **honour the on-disk names the earlier author linked**
   (`03d`, `03e`, `05`, `05b`, `06`, `06b`, `08`). Cheapest row left.
2. **Topic 11 · GraalVM native image** and **13 · JVM flags that matter** — `_plan.md` only, both
   carrying **abandoned claims** from `67176b1d` (2026-09-02 14:30, released 14:52 with 0 chunks).

Related: [[java-board]], [[progress-java-p12-t08-metrics]], [[progress-build-warnings-20260903]],
[[cursor-java]].
