---
title: "Span kind is a five-value hint that tells the backend how to assemble your spans into a waterfall, and getting it wrong produces a trace that is technically correct and reads like a lie"
sidebar_label: "02b · Span kind and trace shape"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **OpenTelemetry "Traces" concept page**, section *Span Kind*
> ([opentelemetry.io](https://opentelemetry.io/docs/concepts/signals/traces/)), and the
> **Spring Framework 7.0 Observability Support** reference for the observation names Spring
> itself produces
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/7.0/integration/observability.html)).
> 🔴 **No sandbox** — the waterfall sketch below is an explicitly labelled schematic, not a
> captured trace.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · OpenTelemetry Java 1.62.0.

**Every span carries a kind, and most people never set one, which is why most hand-written
spans are `Internal`. Kind is what tells a backend that your client span and their server span
are the two halves of one network call, and it is what stops a queue consumer from being
rendered as a child of a producer that finished ten minutes earlier. It is a hint, but it is
the hint the entire waterfall rendering is built on.**

## The five values

> *"When a span is created, it is one of `Client`, `Server`, `Internal`, `Producer`, or
> `Consumer`. This span kind provides a hint to the tracing backend as to how the trace should
> be assembled. According to the OpenTelemetry specification, the parent of a server span is
> often a remote client span, and the child of a client span is usually a server span.
> Similarly, the parent of a consumer span is always a producer and the child of a producer
> span is always a consumer. If not provided, the span kind is assumed to be internal."*

Verbatim, each one:

**Client** — *"A client span represents a synchronous outgoing remote call such as an outgoing
HTTP request or database call. Note that in this context, 'synchronous' does not refer to
async/await, but to the fact that it is not queued for later processing."*

**Server** — *"A server span represents a synchronous incoming remote call such as an incoming
HTTP request or remote procedure call."*

**Internal** — *"Internal spans represent operations which do not cross a process boundary.
Things like instrumenting a function call or an Express middleware may use internal spans."*

**Producer** — *"Producer spans represent the creation of a job which may be asynchronously
processed later. It may be a remote job such as one inserted into a job queue or a local job
handled by an event listener."*

**Consumer** — *"Consumer spans represent the processing of a job created by a producer and may
start long after the producer span has already ended."*

🔴 **"If not provided, the span kind is assumed to be internal."** A hand-written span with no
kind is an `Internal` span — which is right for domain logic and wrong for anything that talks
to another process.

## Why a network call is two spans, not one

The most confusing thing about a first trace is that a single HTTP call appears twice: once as
the caller's `Client` span and once as the callee's `Server` span. That is deliberate and the
gap between them is the point.

```text
service-a                                     service-b
├─ SERVER  GET /checkout            1200 ms
│   └─ CLIENT  GET /inventory        900 ms
│                                              └─ SERVER  GET /inventory   700 ms
│                                                   └─ CLIENT  SELECT       650 ms
```

*(Schematic. The structure is what matters; the numbers are illustrative and not measured.)*

The caller says 900 ms, the callee says 700 ms. **The 200 ms difference is not an
inconsistency — it is the answer.** It is DNS, connection establishment, TLS, serialisation,
network transit both ways, and time the request spent queued in the callee's accept backlog or
its request-handling thread pool before instrumentation started measuring. If the two numbers
were merged into one span you would lose exactly the measurement that distinguishes "their
service is slow" from "the network or their queue is slow", and those have completely different
owners.

This is the same argument that
[Phase 9 · Observing outbound calls](../../phase-9-spring-boot/12-outbound-http/16-observing-outbound-calls.md)
makes for the client-side timer, one level up.

## What Spring produces without you doing anything

Spring Framework 7 instruments its own code and publishes observations if an
`ObservationRegistry` is configured. Its table of produced observations, verbatim:

| Observation name | Description |
|---|---|
| `"http.client.requests"` | *"Time spent for HTTP client exchanges"* |
| `"http.server.requests"` | *"Processing time for HTTP server exchanges at the Framework level"* |
| `"jms.message.publish"` | *"Time spent sending a JMS message to a destination by a message producer."* |
| `"jms.message.process"` | *"Processing time for a JMS message that was previously received by a message consumer."* |
| `"tasks.scheduled.execution"` | *"Processing time for an execution of a `@Scheduled` task"* |

Note the shape: a client/server pair for HTTP and a publish/process pair for JMS. The framework
is already modelling the two-span structure for you. [05 · Wiring it in Spring
Boot](05-wiring-it-in-spring-boot.md) covers what has to be true for these to fire, and
[03e](03e-propagation-that-breaks.md) covers the ones that require explicit registry wiring —
`@Scheduled` and JMS both do.

## Reading the shape of a trace

Once kinds are right, the tree shape alone diagnoses several classes of problem before you read
a single attribute.

**A staircase of client spans.** Six sibling `Client` spans, each starting after the previous
ended. Sequential remote calls. Each one costs a full round trip, and if they are independent
the fix is concurrency, not a faster dependency.

**A wide fan of identical client spans.** Twenty sibling `Client` spans with the same name under
one parent. That is an N+1: a loop issuing one call per item. Phase 10's
**08 · The N+1 problem** *(not written yet)* owns the database form of this; the shape is
identical whether the loop calls a database or an HTTP service.

**A parent much longer than its children combined.** Self-time is in the parent. Either the
service really is computing something, or — far more often — it is waiting on something that is
not instrumented: a lock, a connection pool checkout, a thread pool queue. That last one is
where this topic hands off to [05 · Thread dumps](../05-thread-dumps/README.md).

**A `Server` span with no parent when there should be one.** The caller's context did not
arrive. The trace looks like it starts at the second service. That is a propagation failure,
covered in [03e](03e-propagation-that-breaks.md).

**A `Client` span with no matching `Server` span.** Either the callee is not instrumented, or
the callee dropped the incoming context and started a new trace. Both look the same from here;
the distinguishing test is whether the callee produces traces at all.

## Gotchas

**★ A hand-written span defaults to `Internal`, and that is wrong for anything remote.**
The specification says kind *"is assumed to be internal"* when unset. If you write a span around
a custom transport — a raw socket, a gRPC stub you wrapped yourself, an SDK call to a cloud
service — and do not set `Client`, backends will not pair it with the remote `Server` span and
will not treat it as a dependency edge in service maps.

**★ The caller's duration is always longer than the callee's, and that gap is a measurement.**
It contains DNS, connect, TLS, transit and, importantly, time queued at the callee before its
instrumentation started. Reading the difference as an error, or "fixing" it by trusting only one
side, throws away the only signal that separates a slow dependency from a slow network or a
saturated callee.

**★ `Producer`/`Consumer` are not `Client`/`Server` for queues.** The distinction is
synchronicity, not protocol. The docs are explicit that a consumer span *"may start long after
the producer span has already ended"*. Marking a Kafka consumer as `Server` tells the backend
to expect a synchronous request/response pairing that will never arrive.

**★ Kind is a hint, not an enforcement.** Nothing validates that a `Client` span has a matching
`Server` span, or that a `Consumer` has a `Producer` parent. A wrong kind produces no error
anywhere — just a service map with missing edges and a waterfall that renders oddly.

**★ A `Server` span with no parent is not automatically a bug.** It is correct at the true entry
point of the system. It is a bug at the second, third and sixth service. Which one you are
looking at is only knowable from the service name, so "the trace starts here" needs a moment's
thought before it becomes a propagation investigation.

**★ Span kind is what most service-dependency maps are built from.** Backends derive "service A
calls service B" from `Client` spans in A whose children are `Server` spans in B. If your
in-house RPC client emits `Internal` spans, your service map will show A and B as unconnected
islands even though the traces are complete.

## Interview questions

**★ Why does one HTTP call between two services produce two spans?**
Because there are two independent measurements, taken by two processes, and their difference is
diagnostic. The caller's `Client` span measures everything it experienced: DNS, connection setup,
TLS, transit, the remote work, and the response coming back. The callee's `Server` span measures
only the work it did after its own instrumentation started. The gap between them is network plus
queueing at the callee, so it is what tells you whether a slow call is the dependency's fault or
the path's. Collapsing them into one span would delete that.

**★ What is the difference between `Client`/`Server` and `Producer`/`Consumer`?**
Synchronicity, not transport. A `Client` span is a synchronous outgoing call whose result the
caller waits for; the specification is explicit that "synchronous" here means "not queued for
later processing", not anything about async/await. `Producer` and `Consumer` model a handoff: the
producer creates a job and finishes, and the consumer may start long afterwards, possibly on
another machine, possibly more than once. The backend renders the two pairings differently
because the second one has no request/response symmetry to align.

**★ You wrote a span around a call to a third-party SDK and it does not show up as a dependency
in the service map. Why?**
Almost certainly because you did not set the kind, so it defaulted to `Internal`. Service maps
are derived from `Client` spans — an `Internal` span is by definition an operation that does not
cross a process boundary, so the backend has no reason to draw an edge from it. Setting
`Client` and adding the peer service attributes from the semantic conventions is what makes the
edge appear.

**★ A trace shows a `Server` span in service B with no parent, and separately a `Client` span in
service A that appears to call B. What happened?**
The context did not survive the hop, so B started a fresh trace. You are looking at two traces
that happen to be rendered near each other, not one. Common causes: A built its HTTP client
without the auto-configured builder so no headers were injected; a proxy or gateway stripped the
`traceparent` header; B is behind something that restarts the trace deliberately at a trust
boundary. The diagnostic is whether A's outgoing request actually carried a `traceparent`.

**★ A parent span is 800 ms and its children total 120 ms. Where do you look?**
At whatever the service was doing that is not instrumented. Most often that is waiting rather
than computing: a connection-pool checkout, a lock, a thread-pool queue, or a blocking call
through a client nobody wrapped. A profiler answers "computing", and a thread dump answers
"waiting" — which is why this is the point where a tracing investigation hands off to
[05 · Thread dumps](../05-thread-dumps/README.md) or [06 · JFR and profiling](../06-jfr-and-profiling/README.md).

**★ Is span kind ever validated?**
No. It is explicitly a hint to the backend about how to assemble the trace. Nothing checks that a
`Client` span has a corresponding `Server` span, and nothing rejects a `Consumer` span whose
parent is a `Server`. The failure mode of a wrong kind is therefore entirely silent: no error, no
warning, just a service map with a missing edge or a waterfall that renders in a way nobody can
explain.

---

← [02 · Traces, spans and context](02-traces-spans-and-context.md) · [Topic index](README.md) · Next → [03 · Context propagation](03-context-propagation.md)
