---
title: "A span is an interval with a name, a parent and a bag of attributes; a trace is the tree those parents describe; and span context — trace id, span id, flags, tracestate — is the only part of any of it that actually travels between processes"
sidebar_label: "02 · Traces, spans and context"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **OpenTelemetry "Traces" concept page** for span fields,
> span context, attributes, events, links and status
> ([opentelemetry.io](https://opentelemetry.io/docs/concepts/signals/traces/)), the
> **W3C Trace Context Recommendation (23 November 2021)** for the identifier sizes
> ([w3.org](https://www.w3.org/TR/trace-context/)), and the **Micrometer Tracing 1.7 glossary**
> ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/glossary.html)).
> 🔴 **No sandbox** — the JSON below is quoted from the OpenTelemetry documentation, which
> itself labels it as *"not represent a specific format"*.
> JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0 / Micrometer Tracing 1.7.0 · OpenTelemetry
> Java 1.62.0.

**Four words get used interchangeably in every tracing conversation and they are not
interchangeable: trace, span, span context, and baggage. Getting them apart is not pedantry —
each one has a different lifetime, a different size, and a different answer to the question
"does this cross the network". This page fixes the vocabulary against the specifications, and
every later page depends on it.**

## Span

Micrometer Tracing's glossary, which explicitly borrows Google's Dapper terminology:

> *"**Span**: The basic unit of work. For example, sending an RPC is a new span, as is sending a
> response to an RPC. Spans also have other data, such as descriptions, timestamped events,
> key-value annotations (tags), the ID of the span that caused them, and process IDs (normally
> IP addresses). Spans can be started and stopped, and they keep track of their timing
> information. Once you create a span, you must stop it at some point in the future."*

🔴 **"Once you create a span, you must stop it at some point in the future."** That sentence is
the single most common bug in hand-written instrumentation. An unstopped span is never
reported, and in most implementations it also leaks whatever thread-local state was attached to
it. [05b · Custom spans](05b-custom-spans-and-annotations.md) is largely about not writing
that bug.

OpenTelemetry's list of what a span contains:

> *"A span represents a unit of work or operation. Spans are the building blocks of Traces. In
> OpenTelemetry, they include the following information: Name · Parent span ID (empty for root
> spans) · Start and End Timestamps · Span Context · Attributes · Span Events · Span Links ·
> Span Status"*

## Trace

> *"**Trace**: A set of spans forming a tree-like structure. For example, if you run a
> distributed big-data store, a trace might be formed by a `PUT` request."*

A trace is not a thing that exists at runtime. **No process ever holds a trace.** Each process
emits spans, each span carries a trace id, and the backend does the grouping. That has a
practical consequence people trip over constantly: the trace is only as complete as the set of
spans that arrived, and the backend cannot distinguish "this span was never created" from
"this span was created and dropped in transit".

## What a span looks like

OpenTelemetry's own example of a root span, quoted from the traces concept page (the docs note
that this JSON *"do[es] not represent a specific format"* — it is illustrative structure, not a
wire encoding):

```json
{
  "name": "hello",
  "context": {
    "trace_id": "5b8aa5a2d2c872e8321cf37308d69df2",
    "span_id": "051581bf3cb55c13"
  },
  "parent_id": null,
  "start_time": "2022-04-29T18:52:58.114201Z",
  "end_time": "2022-04-29T18:52:58.114687Z",
  "attributes": { "http.route": "some_route1" },
  "events": [
    { "name": "Guten Tag!",
      "timestamp": "2022-04-29T18:52:58.114561Z",
      "attributes": { "event_attributes": 1 } }
  ]
}
```

> *"This is the root span, denoting the beginning and end of the entire operation. Note that it
> has a `trace_id` field indicating the trace, but has no `parent_id`. That's how you know it's
> the root span."*

**`parent_id == null` is the definition of a root span.** There is no separate flag.

## Span context — the only part that travels

> *"Span context is an immutable object on every span that contains the following: The Trace ID
> representing the trace that the span is a part of · The span's Span ID · Trace Flags, a binary
> encoding containing information about the trace · Trace State, a list of key-value pairs that
> can carry vendor-specific trace information"*
>
> *"Span context is the part of a span that is serialized and propagated alongside Distributed
> Context and Baggage."*

🔴 **This is the load-bearing distinction of the whole topic.** A span has a name, timestamps,
attributes, events, links and a status — and **none of those cross the process boundary**. What
crosses is span context: four small fields. The downstream service does not know your span's
name or attributes and never will; it knows only which trace it is in and which span is its
parent. Everything else is reunited at the backend.

Sizes, from the W3C Trace Context Recommendation:

- **trace id** — *"32 HEXDIGLC ; 16 bytes array identifier. All zeroes forbidden"*
- **span id** (the spec calls the field `parent-id` on the wire) — *"16 HEXDIGLC ; 8 bytes array
  identifier. All zeroes forbidden"*
- **trace flags** — *"2 HEXDIGLC ; 8 bit flags"*

[03b · The `traceparent` header](03b-the-traceparent-header.md) is that serialisation, field by
field.

## Attributes

> *"Attributes are key-value pairs that contain metadata that you can use to annotate a Span to
> carry information about the operation it is tracking."*
>
> *"You can add attributes to spans during or after span creation. Prefer adding attributes at
> span creation to make the attributes available to SDK sampling. If you have to add a value
> after span creation, update the span with the value."*

🔴 **"Prefer adding attributes at span creation to make the attributes available to SDK
sampling."** A sampler that inspects attributes can only see the attributes that existed when
the sampling decision was taken. An attribute added at span *end* — which is where most people
naturally add the result of an operation — is invisible to any sampler.

The value rules:

> *"Keys must be non-null string values · Values must be a non-null string, boolean, floating
> point value, integer, or an array of these values"*

**Prefer semantic conventions to inventing keys.** OpenTelemetry defines *"Semantic
Attributes … known naming conventions for metadata that is typically present in common
operations"*, and the documentation's own recommendation is: *"It's helpful to use semantic
attribute naming wherever possible so that common kinds of metadata are standardized across
systems."* A backend that knows `http.request.method` can build a UI around it; it can do
nothing with `myapp.theMethod`.

## Events

> *"A Span Event can be thought of as a structured log message (or annotation) on a Span,
> typically used to denote a meaningful, singular point in time during the Span's duration."*

The decision rule the docs give for events-versus-attributes is precise and worth memorising:

> *"To inform your decision, consider whether a specific timestamp is meaningful. … If the
> timestamp in which the operation completes is meaningful or relevant, attach the data to a
> span event. If the timestamp isn't meaningful, attach the data as span attributes."*

So: "the cache was missed" is an attribute (`cache.hit=false`); "the retry fired" is an event,
because *when* it fired inside the span is the interesting part.

## Links

> *"Links exist so that you can associate one span with one or more spans, implying a causal
> relationship."*

The motivating case in the docs is exactly the asynchronous one:

> *"In response to some of these operations, an additional operation is queued to be executed,
> but its execution is asynchronous. … We would like to associate the trace for the subsequent
> operations with the first trace, but we cannot predict when the subsequent operations will
> start. … You can link the last span from the first trace to the first span in the second
> trace."*

**A link is what you use when a parent-child edge would be a lie** — most often across a queue,
where the consumer may run minutes later or fan one message out to many consumers.
[03e · Propagation that breaks](03e-propagation-that-breaks.md) returns to this.

## Status

> *"Each span has a status. The three possible values are: Unset · Error · Ok"*
>
> *"The default value is `Unset`. A span status that is `Unset` means that the operation it
> tracked successfully completed without an error."*
>
> *"To reiterate: `Unset` represents a span that completed without an error. `Ok` represents
> when a developer explicitly marks a span as successful. In most cases, it is not necessary to
> explicitly mark a span as `Ok`."*

⚠️ **`Unset` is success, not "unknown".** This reads backwards to almost everyone the first
time. If you are writing a query or an alert over span status, `status != Error` is the correct
success predicate; `status == Ok` will match approximately nothing, because nearly no
instrumentation sets it.

## Gotchas

**★ Only span context crosses the wire — not the span.** The name, attributes, events, links
and status of your span exist solely in your process until they are exported to the backend.
The downstream service receives four fields. Any design that assumes "I put an attribute on the
span so the next service can read it" is wrong; that is what baggage is for
([03c](03c-tracestate-and-baggage.md)), and baggage has real costs.

**★ An unstopped span is a lost span and often a leak.** The glossary is explicit that a
created span *"must"* be stopped. A span that is never ended is never exported, so the work
silently vanishes from the trace, and any scope opened with it keeps thread-local state alive on
a pooled thread.

**★ Attributes added after span creation are invisible to samplers.** OpenTelemetry recommends
adding attributes at creation *"to make the attributes available to SDK sampling"*. Anything
you set at the end of the operation — the result, the row count, the error code — cannot
influence a head-based sampling decision that has already been taken.

**★ `Unset` means success.** The default status is `Unset`, and it denotes an operation that
completed without error. `Ok` is an explicit developer assertion that is rarely set. Alerting on
"spans that are not `Ok`" will fire on essentially all traffic.

**★ High-cardinality values belong in attributes, not in span *names*.** A span name containing
a user id or a raw URL produces one distinct operation name per request, which breaks every
backend's grouping and aggregation. The templated route goes in the name; the concrete value
goes in an attribute.

**★ A parent-child edge across a queue is usually a misrepresentation.** The consumer may start
long after the producer's span ended, and one message may be processed by several consumers.
That is what span links are for; using parent-child instead produces traces with impossible
durations, where the root span apparently lasted for the whole queue latency.

**★ Inventing attribute keys costs you the backend's UI.** Semantic conventions are what let a
tracing backend recognise an HTTP call, a database query or a messaging operation and render it
specially. Custom keys still work for filtering, but the backend can only display them as
opaque strings.

**★ There is no such thing as "the current trace object".** Nothing in any process holds the
trace; it is assembled by the backend from spans that share a trace id. So "the trace failed"
and "we did not receive some spans" are indistinguishable from inside a service, and a
successfully exported partial trace looks exactly like a genuinely short one.

## Interview questions

**★ What is the difference between a span and a trace?**
A span is one unit of work with a name, a start and end timestamp, a parent span id, attributes,
events, links and a status. A trace is the tree formed by all spans that share a trace id,
assembled from the parent pointers. Crucially the trace is not a runtime object — no process
ever holds one. Each process emits spans independently and the backend does the grouping, which
is why a trace is only ever as complete as the spans that arrived.

**★ What exactly is propagated between two services in a trace?**
Span context, and only span context: the trace id, the span id of the caller's current span,
trace flags (which carry the sampled bit), and tracestate. That is roughly fifty-five characters
of `traceparent` plus an optional `tracestate`. The span's name, attributes, events and status
do not travel; the downstream service never sees them. Everything is reunited at the backend by
trace id.

**★ When would you use a span event rather than a span attribute?**
When the timestamp of the fact is itself meaningful. OpenTelemetry's rule is that if the moment
at which something happened is relevant, record it as an event; if only the value matters,
record it as an attribute. "Retry attempt 2 started" is an event because when it happened inside
the span is the interesting part; "retry count was 2" is an attribute.

**★ When would you use a span link instead of a parent-child relationship?**
When there is a genuine causal relationship but not a containment one — overwhelmingly, an
asynchronous handoff. A producer puts a message on a queue and its span ends; the consumer may
start seconds or minutes later, and several consumers may process work derived from one message.
Modelling that as parent-child would claim the producer's operation contained the consumer's,
producing traces whose root span apparently spans the entire queue latency. A link records the
causality without the containment.

**★ Why is `Unset` the default span status rather than `Ok`?**
Because setting `Ok` is defined as an explicit, deliberate assertion by a developer that the
span is unambiguously successful, and the specification says it is not required. `Unset` already
means "completed without an error", so making it the default avoids requiring every
instrumentation to set a status on the happy path. The practical consequence is that success
should be tested as "not `Error`" and never as "equals `Ok`".

**★ Why does OpenTelemetry recommend adding attributes at span creation rather than at the end?**
Because head-based samplers run at span creation and can only see attributes present at that
moment. If your sampling policy is "always keep spans for tenant X", the tenant attribute has to
exist before the sampler runs; adding it when the operation finishes is too late, and the span
you wanted has already been dropped. It is also cheaper — some SDKs can avoid allocating for a
span that the sampler rejects.

**★ A colleague wants to put the user id in the span name so it is easy to find. What do you say?**
No — put it in an attribute. Span names are the grouping key for every tracing backend: they are
what "operation `GET /orders/{id}` p99" is computed over. A name containing a concrete id
produces one distinct operation per request, which makes aggregation meaningless and, in many
backends, blows up the operation-name index. Attributes are indexed for search precisely so that
you can find a trace by user id without destroying grouping.

{/* FOOTER */}
