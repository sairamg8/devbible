---
title: "A message consumer is the one component whose shutdown failure mode is a duplicate rather than a dropped request, because the broker redelivers whatever was not acknowledged — and both Spring's containers stop early, on their own timeouts, which are shorter than every other deadline in the shutdown"
sidebar_label: "06b · Message consumers"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **Spring for Apache Kafka** reference — *Listener Container
> Properties* for `stopImmediate`, `shutdownTimeout`, `ackMode` and `asyncAcks`
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/container-props.html)),
> *Message Listener Containers* for the `AckMode` descriptions and the container auto-startup phase
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/receiving-messages/message-listener-container.html)),
> and *`@KafkaListener` Lifecycle Management* for `KafkaListenerEndpointRegistry`
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/receiving-messages/kafkalistener-lifecycle.html));
> the **Spring AMQP** reference — *Message Listener Container Configuration* for `shutdownTimeout`
> and `forceCloseChannel`
> ([docs.spring.io](https://docs.spring.io/spring-amqp/reference/amqp/containerAttributes.html));
> and the **Spring Boot 4.1** reference · *Graceful Shutdown*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)).
> 🔴 **No sandbox.** No broker was run and no container was stopped. Every default and every
> quoted description is from the reference. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Everything before this page has been about not dropping work. A message consumer cannot drop
work — the broker still has it. What a message consumer does instead, when it stops badly, is
*repeat* work: the record was processed, the offset was not committed, and the next instance to
own that partition starts from the last committed offset. The failure mode inverts, and so does
the fix.**

That is why this page is separate from
[06 · Executors and schedulers](06-executors-and-schedulers.md) and
[06a · Spring's executors on context close](06a-spring-executors-on-context-close.md). An executor
that is interrupted loses the task. A consumer that is interrupted does the task twice.

## Where consumers sit in the teardown order

[05b · `SmartLifecycle` and phases](05b-smartlifecycle-and-phases.md) established that stopping
runs in **descending** phase order. Three of the components in a typical service publish their
phase, and reading them together gives you the order for free:

| Component | Phase | Stops |
|---|---|---|
| The embedded web server's graceful shutdown | *"the earliest phase of stopping `SmartLifecycle` beans"* | **first** |
| Kafka listener containers | `Integer.MAX_VALUE - 100` | early |
| `ThreadPoolTaskExecutor` / `TaskScheduler` | `Integer.MAX_VALUE / 2` | later |
| Ordinary `Lifecycle` beans | `0` | last of the lifecycle beans |

The Kafka reference is explicit about why its number has that shape:

> *"The containers are started in a late phase (`Integer.MAX-VALUE - 100`). Other components that
> implement `SmartLifecycle`, to handle data from listeners, should be started in an earlier phase.
> The `- 100` leaves room for later phases to enable components to be auto-started after the
> containers."*

**★ Read that as a shutdown statement, because start order reversed is stop order.** Containers
start late and therefore stop early — before the executors your listener might be handing work to.
If a listener submits to a `ThreadPoolTaskExecutor` and returns, the container has stopped and
committed while that work is still queued in a pool that has not been stopped yet. Nothing in the
framework connects the two; the `- 100` is a hook for you to place such a component, not a promise
that one exists.

## Kafka: the stop that finishes the batch

Two container properties decide what a stop actually does, and both defaults surprise people.

**`stopImmediate`, default `false`:**

> *"When the container is stopped, stop processing after the current record instead of after
> processing all the records from the previous poll."*

**★ At the default, `stop()` does not stop after the current record — it works through every
record already returned by the last `poll()`.** With a default `max.poll.records` of 500 and a
listener that takes 50ms, that is a stop that takes twenty-five seconds to begin returning. This
is the single most common reason a Spring Kafka service blows through its grace period, and the
property that fixes it is one line.

**`shutdownTimeout`, default `10000`:**

> *"The maximum time in ms to block the `stop()` method until all consumers stop and before
> publishing the container stopped event."*

**★ Ten seconds is a cap on waiting, not a promise of finishing.** When it expires, `stop()`
returns and the context carries on closing — while the consumer thread may still be inside your
listener, now racing a `DataSource` that is about to be closed
([07 · Connection pools](07-connection-pools.md)).

## Why the offset is the thing that matters

`ackMode` defaults to **`BATCH`**, and the reference defines the values precisely:

| `AckMode` | *"Commit the offset…"* |
|---|---|
| `RECORD` | *"…when the listener returns after processing the record."* |
| **`BATCH`** *(default)* | *"…when all the records returned by the `poll()` have been processed."* |
| `TIME` | *"…when all the records returned by the `poll()` have been processed, as long as the `ackTime` since the last commit has been exceeded."* |
| `COUNT` | *"…when all the records returned by the `poll()` have been processed, as long as `ackCount` records have been received since the last commit."* |
| `COUNT_TIME` | *"Similar to `TIME` and `COUNT`, but the commit is performed if either condition is `true`."* |
| `MANUAL` | *"The message listener is responsible to `acknowledge()` the `Acknowledgment`. After that, the same semantics as `BATCH` are applied."* |
| `MANUAL_IMMEDIATE` | *"Commit the offset immediately when the `Acknowledgment.acknowledge()` method is called by the listener."* |

**★ At `BATCH`, a stop part-way through a poll batch re-delivers everything in that batch,
including the records you already processed successfully.** Not one record — up to
`max.poll.records` of them. That is the duplicate window, it is a default, and it is why
`stopImmediate=true` on its own is not enough: it stops sooner *and* leaves the batch uncommitted.

**★ `RECORD` narrows the window to one record and costs a commit per record.** That is the real
trade, and it is a throughput decision rather than a correctness one, because the correctness
answer is the same either way — see **09 · Idempotency as the backstop** *(not written yet)*. A
consumer that is idempotent does not need a narrow window; a consumer that is not is broken at
`RECORD` too, just less often.

`asyncAcks`, default `false`, is the other one to know about:

> *"Enable out-of-order commits …; the consumer is paused and commits are deferred until gaps are
> filled."*

**★ Deferred commits are unfinished commits at shutdown.** If a gap is still open when the
container stops, everything after that gap is re-delivered.

## RabbitMQ: the same problem with different numbers

Spring AMQP's container is blunter about it, and its defaults are tighter.

**`shutdownTimeout`, default five seconds:**

> *"When a container shuts down (for example, if its enclosing `ApplicationContext` is closed), it
> waits for in-flight messages to be processed up to this limit. Defaults to five seconds."*

**`forceCloseChannel`, default `true` since 2.0:**

> *"If the consumers do not respond to a shutdown within `shutdownTimeout`, if this is `true`, the
> channel will be closed, causing any unacked messages to be requeued."*

**★ AMQP states the duplicate outright: the messages are requeued.** Kafka gets to the same place
by a different route — an uncommitted offset re-read by the next owner of the partition — but the
consequence is identical, and AMQP is doing you the favour of saying so in the property
description.

**★ Five seconds is half of Kafka's ten and a sixth of the lifecycle phase timeout.** A service
consuming from both, with a listener that takes eight seconds, has one container that waits and
one that force-closes the channel mid-message. Neither default is wrong; they are simply not
coordinated, and nothing coordinates them for you.

## The deadlines, stacked

This is the arithmetic to do before you change any of these numbers:

```
Kubernetes terminationGracePeriodSeconds   30s   total, covers everything below
  preStop sleep                            ~10s  (08b)  before SIGTERM is even sent
  spring.lifecycle.timeout-per-shutdown-phase  30s  PER PHASE, not a total
    web server drain                             (its own phase)
    Kafka container stop        shutdownTimeout  10s
    AMQP container stop         shutdownTimeout   5s
    executors                   awaitTermination  (06a)
  bean destruction: pools, clients                (07)
```

**★ The one number that is a total is Kubernetes'; every other number on that list is per-thing.**
Add the ones on your own path and compare against 30 seconds before you touch anything. That
comparison is the content of **08b** *(not written yet)*; the reason it belongs here too is that
consumers are usually the longest single item on the list.

## Containers are not beans

> *"The listener containers created for `@KafkaListener` annotations are not beans in the
> application context. Instead, they are registered with an infrastructure bean of type
> `KafkaListenerEndpointRegistry`."*

**★ That is why you cannot order a consumer against your own beans with `@DependsOn` or a
`@PreDestroy`.** The registry owns their lifecycle. If you need something to happen strictly after
consumers have stopped, the lever is a `SmartLifecycle` bean in a phase below
`Integer.MAX_VALUE - 100`, not a destroy method — destroy methods all run after every lifecycle
bean has stopped, which is far too late to be "just after the consumers".

## Gotchas

**★ `stopImmediate=false` is the default and it means "finish the whole poll batch".** The property
name reads like an optimisation. It is a shutdown-duration decision worth up to
`max.poll.records × per-record time`.

**★ Setting `stopImmediate=true` without addressing idempotency makes duplicates *more* likely.**
You stop sooner, so you are more likely to stop mid-batch, and at `BATCH` ack mode the whole batch
is uncommitted. The two changes belong together.

**★ `shutdownTimeout` expiring is silent from the application's point of view.** `stop()` returns.
There is no exception, and the container-stopped event is published anyway. The evidence that it
expired is a consumer thread still running while the context closes around it.

**★ A listener that hands work to an executor has escaped the container's accounting entirely.**
The container sees the listener return, commits the offset, and stops. The work is in a queue in
a pool at phase `Integer.MAX_VALUE / 2`, which has not been stopped yet and whose default is to
interrupt. The message is acknowledged and the work is lost — the one way a consumer *can* drop
work rather than repeat it.

**★ `asyncAcks=true` plus a shutdown is an open gap re-delivered.** Out-of-order commits are
deferred until gaps fill; a stop does not fill them.

**★ AMQP's `forceCloseChannel=true` is a good default that reads like a bad one.** Leaving the
channel open would strand the messages until the connection eventually dropped. Requeuing is the
right behaviour; it is only surprising if you did not know the timeout was five seconds.

**★ Rebalancing does to a running fleet what shutdown does to one instance.** When an instance
leaves the group, its partitions are reassigned and the new owner starts at the last committed
offset. Every duplicate argument on this page applies during any rolling deploy, on every
instance, not only the one being stopped.

**★ Nothing here is fixed by increasing the grace period.** A longer grace period makes the
*timeouts* less likely to expire. It does not commit an offset that was never committed, and it
does not make a re-delivered record safe.

**★ Consumers stop before executors and before pools, and that ordering is not configurable
without writing a `SmartLifecycle`.** Reasoning about it as "Spring will do the right thing" is
the mistake; the phases are published numbers and they are the whole contract.

## Interview questions

**★ Why is a message consumer's shutdown a different problem from a web server's?**
Because the failure mode inverts. A web server that stops badly drops a request the client was
waiting for, and the client sees an error. A consumer that stops badly loses nothing — the broker
still has the message — but the work is done twice, once by the instance that was stopped and once
by whoever picks the partition up. So the mitigation is not "drain longer", it is "make the work
repeatable".

**★ What does `stop()` actually do to a Spring Kafka listener container by default?**
It stops after processing *all* the records already returned by the last `poll()`, not after the
current record — `stopImmediate` defaults to `false`. It then blocks up to `shutdownTimeout`,
default 10,000ms, waiting for consumers to stop, and publishes the container-stopped event whether
or not they did. With a default `max.poll.records` of 500 that first clause alone can dominate the
whole shutdown budget.

**★ Where does the duplicate come from, precisely?**
From `ackMode`. The default is `BATCH` — *"commit the offset when all the records returned by the
`poll()` have been processed"* — so a stop part-way through a batch leaves the entire batch
uncommitted, including records that were processed successfully. The next owner of the partition
resumes from the last committed offset and replays all of them.

**★ How would you narrow the duplicate window, and what does it cost?**
`ackMode=RECORD` commits after each record, narrowing the window to one. The cost is a commit per
record instead of per poll, which is a throughput and broker-load decision. It is worth being
honest that this narrows rather than closes: any at-least-once consumer can still see a duplicate,
so the window size is an optimisation and idempotency is the correctness fix.

**★ Two containers, Kafka and RabbitMQ, in one service. What do you check before a deploy?**
That the numbers add up against the pod's `terminationGracePeriodSeconds`. Kafka's
`shutdownTimeout` defaults to 10s and AMQP's to 5s; the lifecycle phase timeout is 30s **per
phase**; Kubernetes' 30s is the only total, and the preStop sleep comes out of it before SIGTERM
is even delivered. If your longest listener runs eight seconds, the AMQP container will force-close
its channel and requeue mid-message while the Kafka container is still politely waiting.

**★ What happens to a message whose listener was still running when AMQP's `shutdownTimeout`
expired?**
With `forceCloseChannel` at its default of `true`, the channel is closed and the reference says
plainly that this causes *"any unacked messages to be requeued"*. The work may have completed —
the broker has no way to know — so it is delivered again. This is the clearest documented statement
of the duplicate risk anywhere in either project.

**★ Your listener submits to a `@Async` executor and returns immediately. What breaks at shutdown?**
Everything about the accounting. The container thinks the record is processed and commits the
offset; the container is at phase `Integer.MAX_VALUE - 100` and stops early; the executor is at
`Integer.MAX_VALUE / 2` and stops later, by default interrupting and clearing its queue. The
message is acknowledged and the work is gone — the one shape in which a consumer loses work
instead of repeating it. Either do the work on the listener thread, or make the handoff durable.

**★ Why can't you use `@PreDestroy` to run cleanup right after the consumers stop?**
Because the containers are not beans — the reference says they *"are registered with an
infrastructure bean of type `KafkaListenerEndpointRegistry`"* — so there is no bean to depend on,
and destroy methods run after the entire `SmartLifecycle` stop sequence anyway, long after the
consumers. The correct hook is a `SmartLifecycle` bean whose phase is below
`Integer.MAX_VALUE - 100`, which is exactly what the `- 100` was left there for.

**★ Does raising `terminationGracePeriodSeconds` fix consumer duplicates?**
No. It reduces the chance that a timeout expires mid-message, which is worth doing, but the
duplicate does not come from being killed — it comes from an offset that was not committed for
work that was done. That gap exists at every ack mode and closes only when the work itself
tolerates being repeated.

{/* FOOTER */}
