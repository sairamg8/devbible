---
title: "`shouldCommit()` does not make committing cheaper — it exists so you can skip computing the field values, which is your code and can cost whatever you wrote — and the recording ends up containing exactly whatever your events decided to put in it"
sidebar_label: "04b2 · Custom events in production"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **`jdk.jfr.Event` API documentation** for `shouldCommit()` and
> `isEnabled()`, quoted verbatim
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.jfr/jdk/jfr/Event.html)),
> the **JDK 25 `jfr` tool reference** for `scrub` and its filters
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)),
> and **JEP 520** for the overhead aim and its exception
> ([openjdk.org](https://openjdk.org/jeps/520)).
> 🔴 **No sandbox** — the Java below is illustrative source. No cost, timing or event count here is
> a measurement.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[04b](04b-custom-events.md) covered defining an event. This page is everything that decides
whether it is a good idea in production: the guard that controls its cost, the annotation that
makes it findable, what it is genuinely for, and the fact that a recording ends up containing
whatever your events chose to record.**

## 🔴 `shouldCommit()` — the method that decides the cost

The javadoc states the case plainly:

> *"Gathering data to store in an event can be expensive. The `shouldCommit()` method can be used
> to verify whether an event instance would actually be written to the system when the `commit()`
> method is invoked. If `shouldCommit()` returns false, then those operations can be avoided."*

and defines it precisely:

> *"Returns `true` if the enabled setting for this event is set to `true` and if the duration is
> within the threshold for the event, `false` otherwise. The threshold is the minimum threshold
> for all running recordings."*

```java
event.end();
if (event.shouldCommit()) {
    event.orderId    = order.id();            // cheap
    event.customerId = lookupCustomer(order); // 🔴 expensive — this is what the guard is for
    event.commit();
}
```

🔴 **The guard is not about the cost of `commit()`.** Committing a rejected event is cheap. The
guard exists because **computing the field values is your code**, and it can be arbitrarily
expensive — a lookup, a serialisation, a `toString()` over a large object.

⚠️ **It checks the duration against the threshold, so it needs one.** Call it after `end()`, or
after the work, for a timed event. Calling it beforehand asks a question that cannot yet be
answered correctly, and will happily return the wrong answer.

⚠️ **"The minimum threshold for all running recordings"** means the answer depends on what else is
recording. A continuous low-detail recording and a short high-detail one running together
([03c](03c-continuous-recording-in-production.md)) produce a different answer from either alone.

**`isEnabled()` is the cheaper, weaker sibling:**

> *"Returns `true` if at least one recording is running, and the enabled setting for this event is
> set to `true`, otherwise `false` is returned."*

No threshold check. Use it to skip work **before** an event even begins — including the allocation
of the event object itself, which `shouldCommit()` cannot avoid because the object already exists.

## Naming, so the event is findable

```java
@Name("com.example.OrderProcessed")
@Label("Order processed")
@Description("One order through the pricing and inventory path")
@Category({"Application", "Orders"})
static class OrderProcessedEvent extends Event { ... }
```

- **`@Name`** sets the event type name used in queries —
  `jfr print --events com.example.OrderProcessed`. Without it you get the fully-qualified class
  name.
- **`@Label`** and **`@Description`** are what a human sees in an analysis tool.
- **`@Category`** groups the event in tool navigation and is what `--categories` filters on.

🔴 **Set `@Name` deliberately.** It is a stable public identifier for your telemetry. Letting it
default to a class name couples it to your package layout, so a refactor silently renames your
event type and breaks every saved query, dashboard and runbook that referenced it.

## What custom events are actually for

The value is not "logging into a different file". It is **correlation on the JVM's own timeline**:

- Were the slow orders the ones that missed the cache? — your event's `cacheHit` field against its
  own duration.
- Did the slow requests coincide with a GC pause? — your event against the JVM's GC events.
- Did the latency spike align with a burst of class loading, or a JIT deoptimisation?

🔴 **No log file can answer the second and third**, because logs and JVM internals share no clock.
That is precisely what custom events buy, and it is why **one well-placed event at a business
boundary is worth more than a dozen at arbitrary points.**

⚠️ **Put them at boundaries that mean something** — a request, a job, a batch, an external call —
not inside a hot loop. An event on a boundary is a unit of work you can reason about; an event in
a loop is a cost with no interpretation.

## The costs, which are yours rather than JFR's

**Allocation.** Each event is an object. In a genuinely hot path that allocation is on you, and
`shouldCommit()` does not avoid it — the event was constructed before the guard ran. `isEnabled()`
checked early is the guard that does.

**Field computation.** Unguarded, this is the expensive part, and the javadoc says so directly.

**Cardinality.** A `String` field holding a request id makes every event unique, which is often
exactly what you want and which makes recordings larger. Bound it deliberately rather than
discovering it from a `maxsize` that fills in minutes.

🔴 **None of this is covered by JFR's overhead aim.** JEP 520's *"less than one percent"* describes
JFR's own machinery, not your event's field computation. An expensive custom event in a hot loop
makes JFR look costly when the cost is entirely in application code.

## What ends up in the file

🔴 **A recording contains whatever your events recorded.** Order ids, customer identifiers, file
paths, query text — whatever a field held.

`jfr scrub` exists for this: *"Remove events from a flight recording file (remove sensitive
contents or reduce size)"*, with `--include-events`, `--exclude-events`, `--include-categories`,
`--exclude-categories`, `--include-threads` and `--exclude-threads`.

```bash
jfr scrub --exclude-events com.example.OrderProcessed recording.jfr scrubbed.jfr
```

⚠️ **Scrubbing is a remedy, not a policy.** It removes whole events, so scrubbing a sensitive
field means losing the event that carried it — including the parts you needed. **Decide what goes
in a custom event with the same care as what goes in a log line**, and a recording attached to a
ticket or sent to a vendor is a disclosure decision either way.

**A `@Category` per sensitivity level makes scrubbing tractable**, because `--exclude-categories`
can then remove a class of events in one command rather than enumerating them.

## Gotchas

**★ `shouldCommit()` guards *your* cost, not JFR's.**
Committing a rejected event is cheap; computing expensive field values is not. The javadoc:
*"Gathering data to store in an event can be expensive."* The guard exists so you can skip that
gathering.

**★ `shouldCommit()` checks the threshold, so it needs a duration.**
It returns true only if the event is enabled *and* the duration is within threshold. Calling it
before the timed work has finished asks a question that cannot be answered correctly yet — and it
answers anyway.

**★ Its answer depends on every running recording.**
The threshold used is *"the minimum threshold for all running recordings"*, so starting a
high-detail recording alongside a continuous one changes which events commit.

**★ `isEnabled()` is the guard that avoids the allocation.**
`shouldCommit()` runs after the event object exists. Only an early `isEnabled()` check skips
constructing it, which is what matters in a genuinely hot path.

**★ The event object is allocated whether or not it commits.**
No guard placed after construction removes that cost. Custom events belong at meaningful
boundaries, not inside inner loops.

**★ Set `@Name` explicitly.**
It is the identifier queries use. Defaulting to the fully-qualified class name couples telemetry to
package layout, so a refactor silently renames the event type and breaks saved queries.

**★ Your event's cost is not covered by JFR's overhead aim.**
JEP 520's one-percent figure describes JFR's machinery. An expensive event in a hot loop makes JFR
look costly when the cost is entirely in application code.

**★ High-cardinality fields make recordings large.**
A per-request identifier means every event is unique. Often correct, always a size decision, and
better made deliberately than discovered when `maxsize` fills in minutes.

**★ Recordings inherit your fields' sensitivity.**
Whatever an event recorded is in the file. A recording attached to a ticket is a disclosure
decision regardless of how it was produced.

**★ `jfr scrub` removes whole events, not fields.**
So scrubbing a sensitive field costs you the event that carried it, including the parts you wanted.
It is a remedy for a recording already made, not a substitute for deciding what to record.

**★ Categorise by sensitivity to make scrubbing possible.**
`--exclude-categories` can then drop a class of events in one command instead of enumerating event
names, which is the difference between a scrub that happens and one that does not.

## Interview questions

**★ What does `shouldCommit()` do and when would you use it?**
It returns true only if the event is enabled and its duration is within the threshold — the minimum
threshold across all running recordings. Its purpose, in the javadoc's words, is that *"gathering
data to store in an event can be expensive"*, so you guard the population of expensive fields
behind it. It guards your cost, not JFR's; committing a rejected event is cheap. Because it checks
duration, it belongs after the timed work.

**★ What is the difference between `isEnabled()` and `shouldCommit()`?**
`isEnabled()` checks only that at least one recording is running and the event type is enabled;
`shouldCommit()` also checks the duration against the threshold. `isEnabled()` is the cheaper,
coarser guard for skipping work before an event begins — including allocating the event object,
which `shouldCommit()` cannot avoid because it runs after construction.

**★ Why use custom events rather than log lines?**
Because they land on the JVM's own timeline. That makes it possible to ask whether the slow orders
coincided with a GC pause, a burst of class loading or a JIT deoptimisation — questions no log file
can answer, because logs and JVM internals share no clock. They are also typed and self-describing,
so analysis tools display them without prior knowledge of them.

**★ What does a custom event cost?**
Three things, all yours rather than JFR's: allocating the event object, which happens regardless of
whether it commits; computing the field values, which is what `shouldCommit()` lets you skip; and
recording size, driven by cardinality. None of that is covered by JEP 520's one-percent aim, which
describes JFR's own machinery — so an expensive event in a hot loop makes JFR look costly when the
cost is in application code.

**★ Where should custom events be placed?**
At boundaries that correspond to a unit of work — a request, a job, a batch, an external call. An
event on a boundary has an interpretation: its duration means something and its fields describe a
case. An event inside a hot loop is a cost with no interpretation, and it is where the allocation
and cardinality problems come from.

**★ Any privacy considerations?**
Yes, and they are decided at authoring time rather than afterwards. A recording contains whatever
the events recorded, so a custom event carrying identifiers or personal data puts them in a file
that may be attached to a ticket. `jfr scrub` can remove events after the fact — with event,
category and thread filters — but it removes *whole events*, so scrubbing a sensitive field costs
you the event. Categorising events by sensitivity makes `--exclude-categories` a one-command remedy;
deciding what belongs in a field is the actual control.

**★ Why does setting `@Name` matter?**
Because it is the stable identifier that queries, dashboards and runbooks reference. Without it the
event type name is the fully-qualified class name, which means moving or renaming the class silently
renames the event type — and every saved query that referenced it stops matching, with no error, just
empty results.

{/* FOOTER */}
