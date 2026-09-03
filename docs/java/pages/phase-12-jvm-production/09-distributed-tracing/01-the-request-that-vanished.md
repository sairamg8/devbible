---
title: "Metrics tell you that something is slow and logs tell you what one process was doing, but neither can answer 'where did this particular request spend its 4 seconds' once the request crosses a process boundary — that gap is the entire reason distributed tracing exists"
sidebar_label: "01 · The request that vanished"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **OpenTelemetry "Traces" concept page**
> ([opentelemetry.io](https://opentelemetry.io/docs/concepts/signals/traces/)), the
> **Micrometer Tracing 1.7 glossary**
> ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/glossary.html)), and the
> **Spring Boot 4.1 reference — Actuator · Observability**
> ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/observability.html)).
> 🔴 **No sandbox.** No trace waterfall, span table, latency figure or log line on any page in
> this topic is a captured run; every concrete value is either quoted from a specification with
> attribution or explicitly labelled a schematic.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25 · Spring Boot 4.1.0 / Spring
> Framework 7.0.8 · Micrometer 1.17.0 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0 ·
> Brave 6.3.1.

**A single user request touches six services. It is slow. Every one of the six dashboards says
p99 is fine, every one of the six log files has thousands of lines in the relevant second, and
nothing in any of them says which lines belong to the request that was slow. That is not a
tooling shortfall you can close with more metrics or more logs — it is a structural limit of
both signals, and closing it requires a third one.**

## What the other two signals structurally cannot do

[08 · Metrics with Micrometer](../08-metrics-with-micrometer/README.md) owns aggregates. A metric is a number
per time window per tag set: request count, error count, a latency distribution. Aggregation
is exactly what makes metrics cheap enough to keep for a year at one-second resolution, and it
is also what destroys the individual request. A p99 of 4 seconds tells you that one request in
a hundred took 4 seconds. It cannot tell you *which* request, and there is no drill-down,
because the individual observation was discarded at the moment it was folded into the
histogram.

[07 · Logging done right](../07-logging-done-right/README.md) owns the per-event record. A log line does
keep the individual event — but it keeps it *per process*. Service A logs, service B logs, and
nothing in either line says the two lines describe the same user request. You can try to close
that with timestamps, and it fails as soon as there is any concurrency: at 200 requests per
second, the millisecond window around service A's log line contains dozens of unrelated
requests in service B.

**A trace is the missing third thing: a per-request record that spans processes.** It keeps the
individuality that metrics discard and crosses the process boundary that logs cannot.

## The mechanism, in one paragraph

Every service in the request path attaches a **trace ID** to the work it does, and passes that
same ID to whatever it calls next. Each unit of work — an incoming HTTP request, an outgoing
call, a database query — is recorded as a **span**: a name, a start time, an end time, a parent
span ID and some attributes. Spans are shipped asynchronously to a backend. The backend groups
every span carrying the same trace ID and reassembles them into a tree using the parent
pointers. That tree is the trace, and it answers "where did the 4 seconds go" directly, because
each node has a duration and a parent.

The OpenTelemetry documentation makes the log analogy explicitly:

> *"Another thing you'll note is that each Span looks like a structured log. That's because it
> kind of is! One way to think of Traces is that they're a collection of structured logs with
> context, correlation, hierarchy, and more baked in. However, these 'structured logs' can come
> from different processes, services, VMs, data centers, and so on. This is what allows tracing
> to represent an end-to-end view of any system."*

That is the whole idea. Everything else in this topic is the engineering required to make the
ID actually survive every hop, and the economics of not storing all of it.

## What the reassembled trace answers that nothing else does

Given one trace for one slow request, these become one glance rather than one afternoon:

- **Which service was slow.** The child span with the largest self-time.
- **Whether it was slow or merely waiting.** A span whose duration is almost entirely covered
  by one child span was waiting, not working.
- **How many calls there were.** Twelve sibling database spans under one handler is the
  N+1 problem, visible in the shape of the tree before anyone reads the code.
- **Whether calls were serial or parallel.** Overlapping sibling spans are concurrent;
  staircased ones are not, and a staircase of six 400 ms calls is a design finding.
- **Which retry attempt this was.** Retried calls appear as repeated sibling spans with the
  same name.
- **Where the error originated.** The deepest span with error status is the origin; the ones
  above it are propagation.

## Why the ID cannot just be a header you add yourself

The obvious cheap version — generate a UUID at the edge, put it in a header, log it everywhere —
is genuinely worth doing and gets you a long way. Phase 14's
**10 · Correlation across services** *(not written yet)* owns that argument. But it stops at
correlation, and the two things it cannot give you are the two things you actually wanted:

1. **No durations per hop.** You can now find every log line for the request. You still cannot
   say where the time went, because a log line is a point and a span is an interval.
2. **No hierarchy.** Correlated lines are a flat list ordered by clock. Clocks on different
   hosts disagree, so the flat list is not reliably ordered, and it never encodes *who called
   whom*.

The parent span ID is what buys the tree, and the tree is what makes the answer readable.

## The honest cost, stated up front

This is a **Know**-tier topic rather than a Master-tier one for a reason: tracing is the
observability signal with the worst effort-to-payoff ratio *until* you have more than about
three services, and the best one after. Before you commit:

- **Something has to receive and store the spans** — an OpenTelemetry Collector plus a backend
  (Jaeger, Tempo, Zipkin, or a vendor). That is infrastructure you now operate.
- **Volume is per-span, not per-request.** One request through six services with a database
  call each is a dozen-plus spans. At 1,000 requests/second that is five figures of spans per
  second before sampling.
- **You will not keep all of it**, which means **06 · Sampling** *(not written yet)* is not an
  optimisation you add later — it is a decision you make on day one, and the wrong decision is
  invisible until the day you need a trace that was never recorded
  (**06b** *(not written yet)*).
- **Propagation is where it actually breaks.** Every thread pool, every queue, every proxy is
  a place the context can be dropped, and a dropped context produces a *smaller, plausible
  looking trace* rather than an error (**03e** *(not written yet)*).

## Gotchas

**★ Tracing does not replace metrics or logs, and a tracing backend is a bad metrics store.**
The three signals answer different questions: metrics answer "is it broken and how badly" over
long windows, traces answer "where did this one request spend its time", logs answer "what
exactly happened inside one process". Sampling alone disqualifies traces as the source of
truth for rates — if you keep 10% of traces, counting spans gives you 10% of the requests.

**★ A trace ID in the logs is not a trace.** Correlation gives you the ability to find the
lines; tracing gives you durations and a parent-child tree. Teams routinely ship the first,
call it tracing, and are then surprised there is no waterfall view.

**★ Clock skew makes "just sort the logs by timestamp" unreliable across hosts.** Different
machines' clocks disagree by milliseconds even with NTP, which is the same order as the
durations you are investigating. The parent-child relationship in a trace is recorded
explicitly and does not depend on clocks agreeing.

**★ Traces are exported asynchronously and can be dropped.** Spans go into a bounded in-memory
queue and are flushed in batches. The queue can overflow, the exporter can fail, and the
process can exit before the flush. A missing span is not proof the work did not happen — see
**08 · Cost and overhead** *(not written yet)*.

**★ The first trace you look at will have gaps, and the gaps are yours.** Auto-instrumentation
covers frameworks; it does not cover your thread pools, your custom transports or your batch
jobs. A truncated trace almost always means the context was lost at a boundary, not that the
downstream service did nothing.

**★ "We have OpenTelemetry" is not a statement about whether traces are useful.** Usefulness
comes from span names, attributes and the sampling policy. A fleet where every span is named
after an HTTP method and carries no domain attributes produces correct, complete and unhelpful
traces.

## Interview questions

**★ Why can metrics not answer "why was this request slow"?**
Because a metric is an aggregate. The individual observation is folded into a counter or a
histogram bucket and then discarded, so there is nothing left to drill into. A p99 tells you
one request in a hundred was slow; it has no representation of any particular request, and no
link to the request's identity, path or downstream calls. Traces keep the individual request,
which is precisely why they are expensive and why you sample them.

**★ Why can logs not answer it either, given they keep individual events?**
Because a log line is scoped to one process and carries no shared identity. When a request
crosses into another service, nothing in the second service's log connects its lines to the
first service's. Correlating by timestamp fails under concurrency — at any realistic request
rate, the millisecond window around one service's line contains many unrelated requests in the
next. Logs also record points in time, not intervals, so even correlated logs do not give you
per-hop durations.

**★ What exactly does a trace add over a correlation ID propagated through headers and logged?**
Two things: durations and hierarchy. A span is an interval with a start and an end, so the
trace carries per-hop timing; correlated log lines are points. And each span records its parent
span's ID, so the backend can reconstruct who called whom as a tree, independent of clock
agreement between hosts. A correlation ID gives you a filtered flat list; a trace gives you a
waterfall.

**★ You have three services and a database. Is tracing worth it?**
Probably not first. At that size, correlation IDs in structured logs plus per-endpoint RED
metrics on each service will localise most problems, and both are far cheaper to run than a
span pipeline and a trace store. Tracing starts paying when the call graph is deep or fans out
enough that you cannot hold it in your head — where "which of these eleven calls was slow" is
itself the hard question. The mistake in both directions is common: adopting tracing at three
services and drowning in cost, or refusing it at thirty and debugging by grep.

**★ A trace shows a parent span of 4 seconds with one child span of 3.9 seconds. What have you
learned?**
That the parent is not the problem — it spent essentially all of its time waiting for the
child, and its own self-time is about 100 ms. The investigation moves down one level, and
repeats. The value of the tree is exactly this: at each level you compare a span's duration
against the sum of its children's, and the first place where that gap is large is where the
time is actually being spent.

**★ Why is a truncated trace a more dangerous failure than a missing trace?**
Because it is plausible. If the trace is missing you know you have no data. If the context was
dropped at one hop, you get a complete-looking trace that simply ends, and the natural reading
is "the downstream work took no time" or "the downstream service was never called". The
downstream service is in fact doing the work, under a brand new trace ID nobody is looking at.
That is why **03e** *(not written yet)* exists.

---

**Topic index** *(not written yet)* · Next → [02 · Traces, spans and context](02-traces-spans-and-context.md)
