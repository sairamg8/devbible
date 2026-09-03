---
title: "In a monolith the stack trace is the investigation; across services the stack trace stops at the socket, and everything you used to get for free — causality, ordering, one place to look — becomes infrastructure you must build before you need it"
sidebar_label: "05 · Debugging across hops"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html));
> Chris Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); the Spring
> Modulith reference, *Production-ready Features*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/production-ready.html)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox** — no
> log excerpts, traces or timings on this page are reproduced from a run, because none was
> made.

**A Java stack trace is a complete causal chain: every frame, in order, with the exact line
that produced the next one. It is the single most valuable debugging artefact in the
language and it is free. The moment a call crosses a process boundary the chain is severed,
and reconstructing it is not a matter of reading logs harder — it requires correlation
identifiers, propagation, structured logging and a trace backend, all of which must exist
*before* the incident, not after.**

## What a stack trace is actually giving you

Consider a checkout failing deep inside pricing. In one process, the exception carries:

- **The full call chain**, in order, with class and line for every frame.
- **Causality**, explicitly: `Caused by:` links each wrapper to what it wrapped.
- **The failing input, implicitly** — a debugger attached at the throw site has every
  local variable of every frame still on the stack.
- **Timing that needs no clock synchronisation**, because there is one clock.
- **Certainty about ordering.** Frame N called frame N+1. There is no "probably".

Across services you keep none of those five. You get: a 500 from service A, a log line in
service B if it logged one, and a question about whether the request that failed in B is the
same request that failed in A.

## The five things that break, precisely

**1. Causality becomes correlation.** You no longer *know* that B's error caused A's; you
*infer* it from a shared identifier, if you propagated one. If you did not, you infer it
from timestamps, which requires clock synchronisation across hosts and fails under load
when many similar requests overlap.

**2. Ordering becomes probabilistic.** Two log lines a few milliseconds apart on two
machines do not reliably tell you which happened first. This matters most in exactly the
cases you care about — races, double-processing, lost updates.

**3. The error message loses its context.** A monolith throws `PriceNotFoundException:
sku=ABC-19, priceListId=7, effectiveDate=2026-09-01`. A service returns HTTP 404 with
whatever body somebody remembered to write, through a client that may map it to a generic
`RestClientResponseException`, into a caller that logs `pricing call failed`. The
information was destroyed at the boundary, deliberately, by a serialisation step.

**4. You cannot attach a debugger to the interesting moment.** Not to a production incident
in any architecture, but in a monolith you can reproduce locally with the whole flow in one
JVM. Across services, local reproduction requires the whole system running locally —
[17 · Local development](08-local-development.md).

**5. "Which service is slow" replaces "which method is slow".** A profiler answers the
second. Only distributed tracing answers the first, and only if every hop propagates
context — including through your message broker, your scheduler and your thread pools.

## The infrastructure this obliges you to build

Fowler lists monitoring as a **prerequisite**, not an enhancement:

> *"Basic Monitoring: with many loosely-coupled services collaborating in production, things
> are bound to go wrong in ways that are difficult to detect in test environments. As a
> result it's essential that a monitoring regime is in place to detect serious problems
> quickly."*

And going past a handful of services raises the bar again:

> *"Going beyond a handful of services requires more. You'll need to trace business
> transactions through multiple services and automate your provisioning and deployment by
> fully embracing ContinuousDelivery."*

Richardson lists the observability patterns as first-class members of the microservice
pattern language — *"Log aggregation"*, *"Application metrics"*, *"Audit logging"*,
*"Distributed tracing"*. Four separate systems. In a monolith you can be productive with
one log file and a profiler.

The concrete build list, and the topic that owns each:

| Capability | Why it is not optional | Owner |
|---|---|---|
| A correlation identifier on every request, propagated over every hop | Without it, logs from different services cannot be joined at all | **10 · Correlation across services** *(not written yet)* |
| That identifier in every log line, via MDC | Grep across services is otherwise guesswork | **10** *(not written yet)*; phase 12 topic 07 owns logging |
| Centralised log aggregation | You cannot `ssh` to twelve pods during an incident | Phase 12 |
| Distributed tracing with spans per hop | The only way to answer "which hop is slow" | phase 12 topic 09 |
| Per-service metrics with consistent names | So one dashboard covers all services | Phase 12 |

Every row is work that must be finished **before** the first production incident, because
an incident is precisely when you cannot build it.

## The monolith's version of the same problem, and why it is cheaper

A monolith is not free of this. A request that goes through eight modules and two async
listeners is already hard to follow, and thread-hopping already breaks naive log
correlation. But three things make it dramatically cheaper:

1. **One process, one clock, one log stream.** Ordering is not in question.
2. **The stack trace still spans the modules.** A failure in pricing, triggered from
   ordering, produces one trace containing both.
3. **The correlation problem is solvable with `MDC` and nothing else** — no propagation
   protocol, no header contract, no sampling decision, no backend.

And Spring Modulith gives you the module-level view without any of the distributed
infrastructure. Adding the observability artefact instruments module boundaries:

```xml
<dependency>
  <groupId>org.springframework.modulith</groupId>
  <artifactId>spring-modulith-observability-core</artifactId>
  <version>2.1.1</version>
  <scope>runtime</scope>
</dependency>
```

The reference describes what that does:

> *"This will cause all Spring components that are part of the application module's API being
> decorated with an aspect that will intercept invocations and create Micrometer spans for
> them."*

With tag keys `module.identifier`, `module.invocation-type` (*"Type of invocation ('event
listener' or 'bean')"*), `module.method` and `module.name`. So you get per-module spans, in
one process, with no correlation protocol to design —
**51 · Actuator and observability** *(not written yet)* covers it. That is the
observability *practice* without the observability *bill*, which makes it a good place to
find out whether your team will actually maintain dashboards before you depend on them.

## Gotchas

**★ Correlation infrastructure has to exist before the first incident, and every team
builds it after.** The universal sequence is: split, run for two months, have an incident,
spend the incident unable to join logs, then build correlation. The two months of blind
operation are the cost. Make correlation part of the service template, before service
number two exists.

**★ A correlation id that stops at the message broker is a correlation id that stops.**
HTTP propagation is the easy half and the one every tutorial covers. The hop that actually
breaks is the asynchronous one — a message consumed by a listener on a different thread in
a different service, with no incoming HTTP headers. If your trace context is not attached
to message metadata and restored on consumption, every async boundary is a hole in the
chain, and async boundaries are exactly where the hard bugs live.

**★ Error detail is destroyed at the wire on purpose, and you have to decide what survives.**
You cannot serialise a stack trace to a client — it leaks internals and it is enormous. So
you design an error contract: a machine-readable code, a correlation id, and enough context
to act. Teams that skip this design step end up with `500 Internal Server Error` and a
correlation id they cannot use because the id is not in the response body. Put the
correlation id in the error response, always.

**★ Clock skew makes timestamp-based reasoning wrong exactly when it matters.** Ordering
inferred from timestamps across hosts is unreliable at millisecond resolution, which is the
resolution at which races happen. If your incident analysis rests on "B logged this before
A logged that", it rests on NTP. Use the trace's span parentage for ordering, not the
clock.

**★ Sampling means the trace for the request you care about is often not there.** Head-based
sampling at 1% is the common default and it is a reasonable cost decision — but it means
the failing request that got escalated to you is 99% likely to have no trace. Either sample
errors at 100% via a tail-based or error-biased policy, or accept that tracing is a
statistical tool and not an incident tool.

**★ Reproducing a distributed bug locally is a different skill and a different budget
line.** In a monolith, "check out that commit and run the test" is the reproduction. Across
services it requires the right version of every participant, the right data in each
database, and the right sequence of interactions. Teams underestimate this so consistently
that "cannot reproduce" becomes the standard resolution for intermittent distributed bugs.

**★ You will debug the interaction more often than the code, and nobody owns the
interaction.** Each service has an owning team; the sequence of calls between them has none.
When a checkout fails because inventory returned a stale reservation that payment
interpreted as valid, three teams each correctly conclude their service behaved as
specified. Name an owner for each cross-service *flow*, not just each service.

## Interview questions

**★ Why is a stack trace so valuable, and what specifically replaces it after a split?**
It is a complete, ordered, causal chain produced automatically at the moment of failure,
with class and line for every frame and explicit `Caused by:` links, on a single clock. It
costs nothing and requires no forethought. After a split, no single artefact replaces it —
you need four things working together: a correlation identifier generated at the edge and
propagated over every hop including asynchronous ones, that identifier in every log line via
MDC, centralised log aggregation so the lines can be joined, and distributed tracing with
spans so you get ordering and latency attribution. Each is infrastructure that must be built
before the incident that needs it.

**★ Your service returns HTTP 500 and the log says "pricing call failed". What went wrong
in the design, not the code?**
Three things. The error contract was never designed, so the useful detail — which SKU, which
price list, which date — was discarded at the serialisation boundary rather than mapped into
a machine-readable error body. The correlation identifier is not in the response, so the
person holding the 500 cannot find the corresponding pricing log line. And the calling
service is logging the fact of failure rather than the propagated cause, which means the
upstream log is pure noise. All three are decisions made once, in a service template, and
all three are usually made after the first incident instead.

**★ How do you get most of this benefit while still in a monolith?**
Use MDC for a request identifier from the first day, so log correlation is a habit rather
than a project. Add Spring Modulith's observability artefact, which decorates the Spring
components exposed by each module's API with an aspect that emits Micrometer spans tagged
with the module identifier, module name, invoked method and invocation type — bean or event
listener. That gives you per-module latency attribution and a real module interaction graph
inside one process, with no propagation protocol, no sampling decision and no trace backend
required. If your team will not maintain those dashboards in a monolith, they will not
maintain twelve sets of them afterwards.

**★ Which hop breaks correlation most often, and why?**
The asynchronous one. HTTP propagation is well covered by frameworks and by every tutorial,
so it usually works. A message published to a broker and consumed by a listener on a
different thread in a different process has no incoming HTTP headers, so unless the trace
context was explicitly written into the message metadata and restored on consumption, the
chain ends there. That is also precisely where the difficult bugs live — duplicate
delivery, out-of-order processing, poison messages — so the gap in the correlation is
aligned with the concentration of the problems.

{/* FOOTER */}
