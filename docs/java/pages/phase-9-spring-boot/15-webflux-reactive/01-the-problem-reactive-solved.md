---
title: "The problem reactive solved"
sidebar_label: "1 · The problem it solved"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack → Spring WebFlux → Overview* — the "Define Reactive", "Reactive API",
> "Programming Models", "Applicability", "Performance" and "Concurrency Model"
> sections
> (docs.spring.io/spring-framework/reference/web/webflux/new-framework.html) —
> the Spring Boot reference *Reactive Web Applications*
> (docs.spring.io/spring-boot/reference/web/reactive.html), and JEP 444
> (Virtual Threads). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Reactive web frameworks were the answer to a specific, real and now largely
solved problem: a platform thread parked on a blocking call was an expensive
thing to waste, so a server that gave one thread to each in-flight request ran
out of threads long before it ran out of CPU. Everything WebFlux asks of you —
the operator chains, the missing stack traces, the broken `ThreadLocal`s, the
requirement that every library on the path be non-blocking — is the price of
that one property: never block a thread. You cannot judge whether the price is
worth paying until you are honest about whether the problem is still yours.**

## The shape of the original problem

Spring MVC's model is one thread per in-flight request, and the framework
assumes that thread may block. The reference says so directly:

> "In Spring MVC (and servlet applications in general), it is assumed that
> applications can block the current thread, (for example, for remote calls).
> For this reason, servlet containers use a large thread pool to absorb
> potential blocking during request handling."

Before JDK 21 that thread was a *platform* thread — a 1:1 wrapper over an OS
thread, with a contiguous stack the OS reserves up front (the `-Xss` default is
platform-dependent, on the order of a megabyte on mainstream 64-bit systems)
and a kernel scheduler entry. See
[Phase 6 · What a thread costs](../../phase-6-concurrency/02-platform-vs-virtual-threads/01-what-a-thread-costs.md)
for the full ledger. The consequences that shaped a decade of server design:

- **Threads were scarce, so they were pooled.** Tomcat's default worker pool is
  a couple of hundred threads. That number is not arbitrary caution; it is
  roughly where a JVM stops scaling platform threads well.
- **A blocked thread is a consumed thread.** A handler waiting 400 ms on a slow
  downstream service holds a pool slot for 400 ms while using no CPU at all.
- **So the ceiling is latency × pool size, not CPU.** With 200 workers and a
  400 ms downstream call, the theoretical ceiling is 500 requests per second
  no matter how many cores the box has. The hardware sits idle and the thread
  ledger is full.

That is the whole motivation. A service fronting slow or unpredictable I/O
could not scale, and buying more threads did not work because threads were the
expensive thing.

## The event-loop answer

The non-blocking stacks — Node.js, Netty, Vert.x, and WebFlux on top of Reactor
— invert the assumption:

> "In Spring WebFlux (and non-blocking servers in general), it is assumed that
> applications do not block. Therefore, non-blocking servers use a small,
> fixed-size thread pool (event loop workers) to handle requests."

A small pool — typically one worker per core — never blocks. When a handler
needs data from the network, it registers interest in the socket becoming
readable and *returns*. The worker goes off and runs other requests' work. When
the bytes arrive, the runtime calls back into the rest of that request's logic.

The reference anticipates the objection that this sounds contradictory:

> "'To scale' and 'small number of threads' may sound contradictory, but to
> never block the current thread (and rely on callbacks instead) means that you
> do not need extra threads, as there are no blocking calls to absorb."

Ten thousand concurrent requests on eight threads is possible because nine
thousand nine hundred of them are, at any instant, nothing but a small object
on the heap holding the state of a half-finished computation. There is no stack
to hold and no scheduler entry to consume.

## What "reactive" actually names

The word is overloaded. Three distinct things travel under it, and reading
someone else's reactive code requires keeping them apart:

**1. Non-blocking I/O.** The mechanical property above. This is what buys the
scalability, and it is available without any of the rest — plain Netty handlers
are non-blocking and have no `Flux` in sight.

**2. Reactive Streams.** A four-interface specification — `Publisher`,
`Subscriber`, `Subscription`, `Processor` — defining how asynchronous
components hand data to each other *with backpressure*. Backpressure is the
part people forget: the subscriber calls `Subscription.request(n)` to say how
many elements it is ready for, so a fast producer cannot flood a slow consumer.
The interfaces are in the JDK as `java.util.concurrent.Flow`.

**3. A functional composition style.** Reactor's `Mono` and `Flux` and their
operator vocabulary. This is a *library* choice layered on the first two, and
it is the part that dominates how the code looks.

WebFlux is all three at once, which is why "we need non-blocking I/O" is so
often taken as "we must write operator chains". It is not the same claim.

## Where backpressure is genuinely different

Backpressure is the one item on this list that a thread-based model does not
give you for free, and it is worth being precise about why.

In a blocking pipeline, backpressure is implicit and structural: if the
consumer is slow, the producer's `write` blocks, and the producer thread stops.
That works because there *is* a producer thread to stop. In a non-blocking
pipeline nobody is waiting on anything, so unless the protocol carries an
explicit "send me *n* more" signal, a fast source will happily buffer megabytes
into your heap. Reactive Streams makes that signal a first-class part of the
contract, propagated all the way from the TCP window at the far end of the
chain back to the source.

This matters for genuinely streaming workloads — a database cursor feeding an
HTTP response, a Kafka topic feeding a websocket — and it matters much less
for the request/response CRUD that constitutes most services.

## The trade-off

You get scalability that is bounded by memory and CPU rather than by thread
count, plus a backpressure protocol you can reason about. You pay for it with
a programming model in which the call stack no longer describes the call, and
with a hard requirement that *every* library touching the request path speaks
the same non-blocking protocol. The next chunks unpack both halves of that
bill, and chunk 6 explains why JDK 21 changed which half of the trade you
should care about.

## Gotchas

### Reading "reactive" as "faster"

**Symptom.** A team migrates a service to WebFlux expecting endpoint latency to
drop, and it does not.

**Cause.** Non-blocking changes how many requests can be in flight, not how
long any one of them takes. The reference is blunt about it: *"Reactive and
non-blocking generally do not make applications run faster… it requires more
work to do things the non-blocking way, and that can slightly increase the
required processing time."*

**Fix.** Measure the thing reactive actually improves — throughput and
tail latency under *concurrency*, with realistic downstream latency in the mix.
If your service is CPU-bound or your concurrency is in the hundreds, there is
nothing for it to improve.

### Assuming the event loop makes concurrency safe

**Symptom.** Shared mutable state in a WebFlux handler corrupts under load,
even though "there are only 8 threads".

**Cause.** Eight threads are still eight threads. Worse, a single request's
work can hop between them at every `publishOn` boundary, so a field written on
one worker and read on another needs the same happens-before reasoning as ever
— see [Phase 6 · The Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md).

**Fix.** Keep handlers stateless, exactly as in MVC. Per-request state travels
in the pipeline (or the Reactor `Context`), never in a field on a singleton.

### Believing you get backpressure by importing Reactor

**Symptom.** A `Flux` pipeline still exhausts the heap under a fast source.

**Cause.** Backpressure only propagates if every link honours it. An operator
like `buffer`, an unbounded `onBackpressureBuffer`, or a source built from a
callback API with `Flux.create(..., OverflowStrategy.IGNORE)` breaks the chain
of demand, and from there the data is simply pushed.

**Fix.** Know which of your operators are backpressure-transparent and which
buffer. If a source cannot be slowed down, choose the loss policy deliberately
— `onBackpressureDrop`, `onBackpressureLatest`, or a bounded buffer with an
error — rather than discovering it as an `OutOfMemoryError`.

## Interview questions

**★ What problem does reactive programming actually solve on the server?**
Thread scarcity under I/O latency. In thread-per-request with platform threads,
each in-flight request holds a thread with a reserved stack and a kernel
scheduler slot, so a pool of a few hundred is the practical maximum, and any
request blocked on slow I/O consumes a slot while using no CPU. Throughput
therefore ceilings out at roughly pool size divided by request latency, well
below what the hardware could do. Non-blocking stacks handle each request as
heap state plus callbacks on a small event-loop pool, so the concurrency limit
becomes memory rather than threads.

**★ Does WebFlux make individual requests faster?**
No, and the Spring reference says so explicitly — reactive and non-blocking
generally do not make applications run faster, and the extra machinery can add
slightly to processing time. The expected benefit is the ability to scale with
a small fixed number of threads and less memory, which shows up only when there
is real latency in the mix. The one case where it can genuinely reduce latency
is parallel fan-out: firing several downstream calls concurrently and combining
them costs the maximum of their latencies rather than the sum, though that is a
property of concurrency, not of being non-blocking.

**★ What is backpressure, and why does it need a protocol?**
Backpressure is the consumer telling the producer how much it is ready to
receive. In blocking code it is implicit — a slow consumer makes the producer's
write block — but a non-blocking producer never blocks, so without an explicit
signal it will buffer unboundedly into the heap. Reactive Streams makes it
explicit: the subscriber calls `request(n)` on its `Subscription`, and
operators propagate that demand upstream, so the source only emits what has
been asked for. This is the one capability that virtual threads do not
replicate, because it is a property of the data protocol rather than of the
threading model.

**★ Is Reactive Streams the same thing as Reactor?**
No. Reactive Streams is a four-interface specification — `Publisher`,
`Subscriber`, `Subscription`, `Processor` — adopted into the JDK as
`java.util.concurrent.Flow`. It defines interop and backpressure, and nothing
else; it has no operators. Reactor is one implementation of it, supplying the
`Mono`/`Flux` types and the several hundred operators that make it usable,
and it is the one WebFlux is built on. RxJava and Mutiny are alternative
implementations, which is why a `Flux` can be consumed by a Mutiny-based
library at all.

**★ Why is the WebFlux event-loop pool so small?**
Because its threads never block, so more of them would buy nothing. One worker
per core keeps every core busy; adding threads beyond that only adds context
switching. The corollary is the defining hazard of the model: blocking one of
those threads removes a whole core's worth of capacity from the entire
application, not just from the request that blocked.

**★ If a request never has a thread of its own, where does its state live?**
On the heap, in the objects making up the operator chain and its subscription.
When a handler awaits I/O, what persists is a small graph of subscriber objects
holding the partially-applied computation, plus whatever your own lambdas
captured. That is precisely why ten thousand in-flight requests are affordable
— and also why a stack trace taken during the wait is useless, since there is
no stack recording how the request got there.

---

Index: [WebFlux and reactive](README.md) · Next → [Mono, Flux and laziness](02-mono-flux-and-laziness.md)
