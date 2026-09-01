---
title: "Defining a custom event is subclass, set fields, commit — and the field-type rules discard arrays, enums and anything else they do not recognise with no warning at compile time or run time, so the field you needed most may simply not be in the recording"
sidebar_label: "04b · Custom events"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **`jdk.jfr.Event` API documentation**, from which the example,
> the supported-type rules and every method description below are quoted verbatim
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.jfr/jdk/jfr/Event.html)),
> and the **JDK 25 `jfr` tool reference** for `metadata`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)).
> 🔴 **No sandbox** — the Java below is illustrative source, not a captured run. No output, timing
> or event count here is a measurement.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The JVM's own events tell you what the runtime did; your events tell you what the application
did. This page is how to define one and — the part that costs people an afternoon — which field
types survive into the recording. Making them cheap and findable is
[04b2 · Custom events in production](04b2-custom-events-in-production.md).**

## The whole API, from the javadoc

The class documentation's own example:

```java
public class Example {

    @Label("Hello World")
    @Description("Helps programmer getting started")
    static class HelloWorld extends Event {
        @Label("Message")
        String message;
    }

    public static void main(String... args) {
        HelloWorld event = new HelloWorld();
        event.message = "hello, world!";
        event.commit();
    }
}
```

> *"Base class for events, to be subclassed in order to define events and their fields."* …
> *"After an event is allocated and its field members are populated, it can be written to the
> Flight Recorder system by using the `commit()` method."*

**Subclass, set fields, commit.** There is no registration step, no configuration file, no
listener, no interface to implement. The event type exists because the class exists.

**And it is on by default:** *"By default, an event is enabled. To disable an event annotate the
`Event` class with `@Enabled(false)`."*

⚠️ That default is worth noticing. An event class added to a codebase starts appearing in
recordings immediately, without anyone configuring anything — convenient, and occasionally a
surprise for whoever is reading the recording.

## Timing a span

```java
@Label("Order processed")
@Category({"Application", "Orders"})
static class OrderProcessedEvent extends Event {
    @Label("Order ID")   String orderId;
    @Label("Item count") int itemCount;
    @Label("Cache hit")  boolean cacheHit;
}

OrderProcessedEvent event = new OrderProcessedEvent();
event.begin();
try {
    process(order);
} finally {
    event.orderId = order.id();
    event.itemCount = order.items().size();
    event.cacheHit = cache.wasHit();
    event.commit();
}
```

From the javadoc: `begin()` *"Starts the timing of this event"*; `end()` *"Ends the timing of this
event. The `end` method must be invoked after the `begin` method"*; and `commit()` *"Writes the
field values, time stamp, and event duration to the Flight Recorder system. If the event starts
with an invocation of the `begin` method, but does not end with an explicit invocation of the
`end` method, then the event ends when the `commit` method is invoked."*

⚠️ **So `end()` is optional** — committing ends the event. Call `end()` only when you want the
duration to *exclude* work done between finishing and committing, which is exactly the case when
populating fields is expensive ([04b2](04b2-custom-events-in-production.md)).

⚠️ **Put the `commit()` in a `finally`**, or an exception on the happy path means the event never
records — and the slow, failing cases are the ones you most wanted.

## 🔴 The field-type rules, which discard data silently

Quoted verbatim, because this paragraph is the one that costs the afternoon:

> *"Supported field types are the Java primitives: `boolean`, `char`, `byte`, `short`, `int`,
> `long`, `float`, and `double`. Supported reference types are: `String`, `Thread` and `Class`.
> **Arrays, enums, and other reference types are silently ignored and not included.** Fields that
> are of the supported types can be excluded by using the transient modifier. **Static fields,
> even of the supported types, are not included.**"*

**Three traps in one paragraph:**

🔴 **An `enum` field is silently dropped.** This is the one that catches everybody, because an enum
is the obvious type for `OrderStatus`, `CustomerTier` or `Outcome`. It compiles, it runs, the event
appears in the recording — **and the field is not in it.** Store `status.name()` as a `String`.

🔴 **Arrays and collections are dropped.** No `List<String>`, no `String[]`. If you need several
values, use several fields, or join them into one `String`.

🔴 **"Silently ignored" means no warning anywhere.** Not at compile time, not at run time, not in
the recording. The failure surfaces as an empty column in analysis, weeks later, on the recording
you actually needed.

⚠️ **`Duration` and `Instant` are not on the supported list either** — store a `long` of
milliseconds or nanoseconds and label the unit.

⚠️ **`transient` is the documented opt-out** for a supported-type field you do not want recorded,
which is useful when an event class doubles as a carrier for working state.

## Verify before you ship

**The reliable check is `jfr metadata`**, which prints the event's actual fields from the
recording:

```bash
jfr metadata --events com.example.OrderProcessed recording.jfr
```

🔴 **Write the event, take a thirty-second recording, and confirm the fields are there — before
the code ships.** This is a two-minute step that converts a silent data-loss bug into a visible
one, and it is the only mechanism the platform gives you for catching a dropped field.

## Gotchas

**★ Enum fields are silently dropped.**
The javadoc: *"Arrays, enums, and other reference types are silently ignored and not included."*
An enum is the natural type for a status or a tier; it compiles, it runs, and the field is simply
absent from the recording. Store `.name()` as a `String`.

**★ Arrays and collections are dropped too, with no warning.**
Supported types are the eight primitives plus `String`, `Thread` and `Class`. Everything else
vanishes at recording time rather than at compile time.

**★ Static fields are never included**, even of supported types.
Stated verbatim in the javadoc. A constant you expected in every event will not be there.

**★ `Duration` and `Instant` are not supported types.**
They look like obvious candidates for a timing field and are not on the list. Store a `long` and
put the unit in the `@Label`.

**★ Verify fields with `jfr metadata` before shipping.**
Write the event, take a short recording, confirm. Discovering a silently dropped field weeks later,
on the one recording that mattered, is the standard way this goes wrong — and the check takes two
minutes.

**★ `end()` is optional; `commit()` ends the event.**
Only call `end()` when the duration should exclude work done between finishing and committing.

**★ Commit in a `finally`.**
Otherwise an exception means no event — and the failing, slow cases are precisely the ones worth
recording.

**★ Events are enabled by default.**
*"By default, an event is enabled."* A new event class starts appearing in recordings with no
configuration, which is convenient and occasionally unexpected.

**★ `transient` excludes a supported-type field.**
The documented way to keep working state on an event class without recording it.

## Interview questions

**★ How do you define a custom JFR event?**
Subclass `jdk.jfr.Event`, declare fields, populate them and call `commit()`. There is no
registration step — the event type exists because the class does — and the javadoc notes that
*"by default, an event is enabled"*. For a timed event, call `begin()` before the work; `commit()`
ends the timing if `end()` was not called explicitly, and the commit belongs in a `finally` so
failures are recorded too.

**★ You add an enum field to a custom event and it never appears. Why?**
Because JFR silently ignores it. The javadoc lists supported types as the eight primitives plus
`String`, `Thread` and `Class`, and states that *"arrays, enums, and other reference types are
silently ignored and not included"*. There is no compile-time or runtime warning. Store
`enumValue.name()` as a `String`, and verify with `jfr metadata` on a short recording before
shipping.

**★ Which field types can a custom event actually record?**
The eight Java primitives, plus `String`, `Thread` and `Class`. Not arrays, not collections, not
enums, not `Duration` or `Instant`, not your own types. Supported-type fields can be excluded with
`transient`, and static fields are never recorded regardless of type.

**★ What is the relationship between `begin()`, `end()` and `commit()`?**
`begin()` starts the timing, `end()` stops it, and `commit()` writes the event. The javadoc says
that if `begin()` was called and `end()` was not, *"the event ends when the `commit` method is
invoked"* — so `end()` is optional. You call it explicitly when the recorded duration should
exclude work performed between the operation finishing and the event being committed, such as
gathering expensive field values.

**★ How would you catch a silently dropped field before it reaches production?**
Take a short recording in development and run `jfr metadata --events <name>` against it, which
prints the event's actual fields from the file. Because the recording carries its own schema, this
is authoritative — it shows what JFR recorded rather than what the class declared. It is the only
mechanism the platform offers for this, since the drop happens with no warning at any other point.

{/* FOOTER */}
