---
title: "Human-readable log lines are a format optimised for a reader who no longer exists, because nobody tails a file on a server any more — every line you write goes into a system that must parse it, and a sentence is the worst possible input to a parser"
sidebar_label: "05 · Structured JSON"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 reference, "Structured Logging"**, for the
> supported formats and property names
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)), the
> **SLF4J 2.0.18 manual** on key-value pairs — *"Key-value pairs are particularly useful in
> conjunction with log data analysers which can interpret them automatically"*
> ([slf4j.org](https://www.slf4j.org/manual.html)), and the **Spring Boot 4.1.1 source** for
> `ElasticCommonSchemaStructuredLogFormatter`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/java/org/springframework/boot/logging/logback/ElasticCommonSchemaStructuredLogFormatter.java)).
> 🔴 **No sandbox.** The JSON shapes on this page are **derived from the formatter's source code**
> or presented as labelled schematics — none is a captured log line.
> JDK 25 · Spring Boot 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34.

**The default log format encodes structured data — a timestamp, a level, a thread, a logger, a set
of values — into a sentence, and then the log aggregator spends CPU and regexes turning it back
into structured data, imperfectly. Emitting JSON deletes that entire round trip. The objection is
always readability, and the answer is that the format for the machine and the format for a human
at a terminal are different problems that should be solved separately rather than compromised
into one.**

## What a pattern layout is actually doing

Boot's default console pattern, read straight out of `defaults.xml`, encodes eight distinct fields
into one string with positional and delimiter conventions: timestamp, level, PID, application name,
application group, thread, correlation id, logger, message, exception.

To get any one of those back out, something downstream must know that the level is the second
whitespace-delimited token unless the application name is absent, that the thread is inside square
brackets unless the correlation id is also in square brackets, and that the message runs to the
end of the line unless a stack trace follows on subsequent lines.

🔴 **That is a parser for a format with no specification, written by someone who did not write the
producer.** Every reword of a message, every added field, every multi-line stack trace is a chance
for it to be wrong — and when it is wrong, it fails silently by putting text in the wrong field.

## The argument, in four parts

**1 · Fields have types, and text does not.** `duration=1500` in a sentence is a string. As a JSON
number it can be compared, aggregated, and used in a range query. The moment you want "requests
over one second for tenant X", the difference is decisive.

**2 · The message becomes a stable key.** With values in fields, the message text is a *template*
that does not change when the values do. Grouping by message becomes meaningful — the top-templates
cleanup in [03b](03b-the-warn-that-nobody-acts-on.md) depends on exactly this.

**3 · Multi-line events stop being multiple events.** A stack trace in a pattern layout is N lines
that a collector must stitch back together with heuristics. In JSON it is one string inside one
object on one line, and the stitching problem disappears
([09b](09b-stack-traces-that-cost-you.md)).

**4 · Context comes along automatically.** MDC entries and SLF4J key-value pairs are already
separate objects on the event; a JSON formatter emits them as fields with no work at the call site
([06](06-mdc.md), [04b](04b-the-fluent-api.md)). A pattern layout only emits the MDC keys you
listed by name in the pattern, so a new key added in code is invisible until someone edits XML.

## One event, one object

The design rule that makes structured logging worth the trouble is not "emit JSON" — it is **emit
one object per meaningful thing that happened**, rather than narrating a thing across several
lines.

```java
// Narration: four events, none of which contains the outcome.
log.info("Starting checkout for order {}", orderId);
log.info("Reserved stock");
log.info("Charged card");
log.info("Checkout complete");

// One event: one object, queryable on any dimension.
log.atInfo()
   .setMessage("Checkout completed")
   .addKeyValue("orderId", orderId)
   .addKeyValue("itemCount", items.size())
   .addKeyValue("amountMinor", amountMinor)
   .addKeyValue("currency", currency)
   .addKeyValue("paymentMethod", method)
   .addKeyValue("durationMs", elapsed.toMillis())
   .log();
```

The second form answers "what is the median checkout duration for card payments over £100" without
anyone writing a parser. The first form cannot answer it at all, and costs four times the storage
to not answer it.

⚠️ **This is not an argument for a single giant event per request.** A retry, an external call that
failed, a business decision that changed the outcome — each is its own meaningful thing. The rule
is one object per *event*, not one per *request*.

## What the ECS formatter emits, read from its source

Boot 4.1.0's `ElasticCommonSchemaStructuredLogFormatter` builds its members explicitly. The
following is **not a captured log line** — it is the member set read directly from the source
listed on the `> Verified:` line, rendered as an object for readability:

```jsonc
{
  "@timestamp": "...",              // ILoggingEvent::getInstant
  "log":     { "level": "...", "logger": "..." },
  "process": { "pid": 0, "thread": { "name": "..." } },
  //          service.* members from ElasticCommonSchemaProperties
  "message": "...",                 // getFormattedMessage()
  //          MDC entries and SLF4J key-value pairs, flattened here
  "error":   { "type": "...", "message": "...", "stack_trace": "..." },
  "tags":    [ "..." ],             // marker names, when present
  "ecs":     { "version": "8.11" }
}
```

Three things are worth reading off that directly:

- **`error` is only present when there is a throwable** (`whenNotNull(getThrowableProxy)`), so a
  query for "events with an exception" is a field-existence check rather than a text search.
- **MDC entries and key-value pairs land in the same flattened region**, which is convenient and is
  why they share a namespace ([05c](05c-schema-and-field-naming.md)).
- **Markers become `tags`**, so the Marker-based escalation from
  [03b](03b-the-warn-that-nobody-acts-on.md) is queryable rather than decorative.

## The readability objection, and the actual answer

The objection is real: JSON on a developer's terminal is unpleasant to read, and a team that has to
read raw JSON during an incident will quietly revert the change.

🔴 **The answer is not "compromise on one format". It is "choose per environment".** Boot's
properties are separate for console and file, so this is a profile concern:

```properties
# application-prod.properties  — machines read this
logging.structured.format.console=ecs

# application-dev.properties    — humans read this; the default pattern stays
```

And for the case where you *do* need to read production JSON at a terminal, the tooling exists and
should be in the runbook rather than discovered under pressure:

```bash
kubectl logs deploy/checkout | jq -r '"\(.["@timestamp"]) \(.log.level) \(.message)"'
kubectl logs deploy/checkout | jq -c 'select(.log.level=="ERROR")'
```

⚠️ **Do not run one format in development and never test the other.** A field that serialises
correctly in the pattern layout and blows up the JSON encoder — an object whose `toString()` throws,
a value containing a control character — is only discovered where the JSON runs. At least one
non-production environment should run the production format.

## Where the boundary with metrics is

Structured logging makes it *possible* to compute aggregates from logs, which makes it tempting to
stop emitting metrics. That is a trap with a cost curve.

**A metric is O(time series).** A counter of checkouts by payment method costs the same whether you
do ten or ten million.

**A log aggregate is O(events).** Computing the same number from structured logs means scanning
every event in the window, forever, every time the dashboard refreshes.

🔴 **Structured logs make ad-hoc questions answerable; metrics make known questions cheap.** Use the
first to discover what you should be measuring and the second to measure it. **08 · Metrics with
Micrometer** *(not written yet)* owns the other half.

## Gotchas

**★ A pattern layout is a serialisation format with no specification.**
Everything downstream must reverse-engineer field boundaries from delimiters and position. It
breaks silently when a message is reworded or a field is added, and the failure mode is text in the
wrong field rather than an error.

**★ Values interpolated into a message are strings forever.**
`duration=1500` inside a sentence cannot be compared numerically without a parse step that may or
may not exist. As a JSON number it is queryable immediately.

**★ Narrating one operation across several lines multiplies cost and answers nothing.**
Four INFO lines cost four times the ingestion of one and still cannot report the outcome, because
no single line contains it. One object per event is both cheaper and strictly more useful.

**★ A pattern layout only emits the MDC keys you named in the pattern.**
`%X{userId}` renders one key. Add a new MDC key in code and it is invisible until someone edits the
XML — whereas a structured formatter emits the whole MDC map automatically.

**★ Turning on JSON in production without testing it anywhere else finds the encoder bugs in
production.**
A `toString()` that throws, a value with a control character, an enormous field — these only
misbehave where the JSON encoder runs. Run the production format in at least one pre-production
environment.

**★ JSON on a terminal is genuinely worse to read, and pretending otherwise loses the argument.**
The fix is environment-specific configuration plus `jq` recipes in the runbook, not a compromise
format that is bad for both audiences.

**★ Computing counters from structured logs looks free and is not.**
It is a scan over every event in the window, repeated on every dashboard refresh, growing with
traffic. A metric answers the same question in constant space. Structured logs are for the
questions you did not anticipate.

**★ One giant object per request is the opposite overcorrection.**
A retry, a failed dependency call and a business decision are each their own event. Collapsing them
into one object at the end loses the ordering and the intermediate failures — which are usually the
interesting part.

**★ Structured output does not make a bad message good.**
`{"message":"error"}` is exactly as useless as `error` was. The fields are additive; the message
still has to say what was attempted and what happened.

## Interview questions

**★ Why prefer JSON logs over a human-readable pattern?**
Because nobody reads logs on a server any more — every line ends up in a system that has to parse
it, and a pattern layout is an unspecified serialisation format that the consumer must
reverse-engineer from delimiters and position. JSON removes the round trip: fields keep their
names and types, numbers stay numbers, a stack trace is one string in one object rather than N
lines needing heuristic stitching, and MDC entries and key-value pairs arrive as fields
automatically instead of only when someone named them in the pattern.

**★ What does "one event, one object" mean and why does it matter?**
It means each meaningful thing that happened produces a single structured record containing what
was attempted, its identifiers and its outcome — rather than narrating one operation across
several lines. It matters because a narration costs several times the ingestion and still cannot
answer a question, since no single line holds the outcome. With one object you can ask "median
duration for card checkouts over £100" directly; with four narration lines you cannot ask it at
all.

**★ Your team objects that JSON is unreadable during incidents. How do you respond?**
By accepting the objection and separating the audiences. The console format and the file format
are configured independently in Boot, and the format is a per-profile decision, so development can
keep the pattern layout while production emits ECS. For the cases where someone genuinely has to
read production output at a terminal, `jq` recipes belong in the runbook before the incident, not
discovered during it. The one thing not to do is compromise on a single format that serves neither
audience.

**★ If structured logs can compute aggregates, why still emit metrics?**
Cost model. A metric is a time series: a counter costs the same at ten events per day and ten
million. A log aggregate is a scan over every event in the window, recomputed on every dashboard
refresh, growing linearly with traffic and retention. So structured logs are the right tool for
questions you did not anticipate — which is most of what happens in an incident — and metrics are
the right tool for the questions you already know you will ask every day.

**★ What does Spring Boot's ECS formatter actually put in the object?**
Reading its source: `@timestamp`, a nested `log` object with `level` and `logger`, a `process`
object with `pid` and a nested `thread.name`, the configured `service.*` members, the formatted
`message`, then MDC entries and SLF4J key-value pairs flattened into the object, an `error` object
with `type`, `message` and `stack_trace` present only when the event carries a throwable, marker
names as `tags`, and `ecs.version`. The conditional `error` object is the practically useful part:
finding all events with an exception becomes a field-existence check rather than a text search.

**★ What breaks when you switch a running service from pattern layout to JSON?**
Anything downstream that parsed the old format — Grok patterns in the collector, alert rules
matching message substrings, saved queries. Also anything that assumed one line per event, since
multi-line stack traces now collapse into a field. And you discover encoder-level bugs that the
pattern layout tolerated: an object whose `toString()` throws, a value with embedded control
characters, a field large enough to be rejected downstream. That is why the switch is staged
through a pre-production environment running the production format, not flipped directly.

{/* FOOTER */}
