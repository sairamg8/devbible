---
title: "MDC is the mechanism that puts the request id on every log line without threading it through every method signature, and it works by being a `ThreadLocal` — which is simultaneously why it is so convenient and the source of every serious bug in this topic"
sidebar_label: "06 · MDC"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback manual, "Mapped Diagnostic Context"**, source of every
> quoted sentence below ([logback.qos.ch](https://logback.qos.ch/manual/mdc.html)), the **SLF4J
> `org.slf4j.MDC` javadoc** for the method contracts and `MDCCloseable`
> ([slf4j.org](https://www.slf4j.org/api/org/slf4j/MDC.html)), the **Logback manual, "Layouts"**,
> for the `%mdc` / `%X` conversion word
> ([logback.qos.ch](https://logback.qos.ch/manual/layouts.html)), and the **Spring Boot 4.1.0
> source** for `ElasticCommonSchemaStructuredLogFormatter`, which emits
> `ILoggingEvent::getMDCPropertyMap`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/java/org/springframework/boot/logging/logback/ElasticCommonSchemaStructuredLogFormatter.java)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.0 · SLF4J 2.0.18 · Logback 1.5.34.

**Every log line in a request needs to say which request it belongs to, and the alternative to MDC
is passing a context object into every method that might log — through service layers, repositories
and utility classes that have no other reason to know about it. MDC solves that by storing the
context on the thread, so any statement anywhere on the call stack picks it up. The price is that
"the thread" is a much less stable notion than it looks, and the whole of
[06b](06b-mdc-and-thread-pools.md) and [06c](06c-mdc-across-async-and-virtual-threads.md) is about
paying it.**

## The API, which is four methods

The Logback manual reproduces the salient parts:

```java
package org.slf4j;

public class MDC {
  //Put a context value as identified by key
  //into the current thread's context map.
  public static void put(String key, String val);

  //Get the context identified by the key parameter.
  public static String get(String key);

  //Remove the context identified by the key parameter.
  public static void remove(String key);

  //Clear all entries in the MDC.
  public static void clear();
}
```

plus `getCopyOfContextMap()`, `setContextMap(Map)` and `putCloseable(String, String)`, which are
the ones that matter for correctness. Values are `String`; keys are `String` and must not be null
(`put` throws `IllegalArgumentException` for a null key).

The manual's own framing of what it is for:

> *"To uniquely stamp each request, the user puts contextual information into the MDC … Typically,
> while starting to service a new client request, the developer will insert pertinent contextual
> information, such as the client id, client's IP address, request parameters etc. into the MDC.
> Logback components, if appropriately configured, will automatically include this information in
> each log entry."*

## Reading it back out

**In a pattern layout**, `%mdc` (or `%X`):

> *"Outputs the MDC (mapped diagnostic context) associated with the thread that generated the
> logging event. If the mdc conversion word is followed by a key between braces, as in
> `%mdc{userid}`, then the MDC value corresponding to the key 'userid' will be output. If the value
> is null, then the default value specified after the `:-` operator is output. If no default value
> is specified than the empty string is output. If no key is given, then the entire content of the
> MDC will be output in the format 'key1=val1, key2=val2'."*

```xml
<pattern>%d %-5level [%X{requestId:-none}] %logger{36} - %msg%n</pattern>
```

🔴 **`%X{key}` with no default renders an empty string when the key is absent**, which silently
shifts the visual layout of the line and makes a missing id look like a formatting glitch rather
than a missing id. Always supply `:-` with something explicit.

**In structured output**, nothing needs naming. Boot's ECS formatter calls
`ILoggingEvent::getMDCPropertyMap` and emits the whole map. That is the decisive advantage: a new
MDC key added in code appears in the JSON immediately, whereas a pattern layout needs an XML edit
to reveal it ([05](05-structured-json.md)).

## `putCloseable` is the only form you should be writing by hand

The javadoc:

> *"This method return a `Closeable` object who can remove key when close is called."*

```java
try (var ignored = MDC.putCloseable("orderId", orderId)) {
    processOrder(orderId);           // every log statement in here carries orderId
}                                     // key removed on exit, including on exception
```

**Why this and not `put`/`remove` in a `finally`:** they are equivalent when written correctly, and
`putCloseable` cannot be written incorrectly. The failure mode of the manual form is an early
`return` or a thrown exception between the `put` and the `remove` — which is precisely the code path
you most want the MDC to be right on.

⚠️ **`MDCCloseable` removes the key; it does not restore a previous value.** Nesting two
`putCloseable` calls on the same key leaves the key *absent* after the inner block, not restored to
the outer value. If you need save-and-restore semantics, capture with `getCopyOfContextMap()` and
put it back with `setContextMap()`.

## What belongs in MDC, and what does not

**Belongs:** things that identify the *unit of work* and are true for its whole duration.

- `requestId` / `traceId` / `spanId` ([07](07-correlation-ids.md))
- `tenantId`, `userId` (an opaque id — see below)
- `jobId`, `messageId`, `partition`/`offset` for a consumer
- the operation name, when a service handles several

**Does not belong:**

- **Anything that changes mid-request.** MDC is ambient, so a value that is true for only part of
  the work will be attached to lines it does not describe. Per-event facts belong in key-value
  pairs ([04b](04b-the-fluent-api.md)).
- **Anything large.** The map is copied onto every event; Logback's own manual warns that its
  implementation *"assumes that values are placed into the MDC with moderate frequency."* A
  serialised request body in MDC is attached to every line for the rest of the request.
- **Personal data or secrets.** MDC is the *easiest* place to leak, because it propagates to lines
  written by code that has no idea it is there — including third-party libraries.
  [08](08-what-never-to-log.md) argues this properly.

🔴 **The `userId` question deserves a direct answer: put an opaque internal identifier, never an
email address or a name.** An id is a join key you control; an email address in a log store is
personal data in a system with different retention and access rules from your database.

## The MDC is not only for logging

Because it is a `ThreadLocal` map that reaches every layer, it gets used as an ambient parameter
bus — request-scoped feature flags, the caller's locale, a tenant used by a data-source router.

⚠️ **That works, and it is a trap.** Every additional consumer makes the leak in
[06b](06b-mdc-and-thread-pools.md) more damaging: a stale `requestId` on a pooled thread produces a
confusing log line, while a stale `tenantId` used by a routing data source produces *the wrong
tenant's data*. Keep the MDC for diagnostics; if you need ambient request state for behaviour, use
a request-scoped bean or a `ScopedValue` ([06c](06c-mdc-across-async-and-virtual-threads.md)),
which has a defined lifetime rather than an implicit one.

## Two Logback-specific consequences

**`SiftingAppender` turns MDC values into destinations.** The documented pattern discriminates on
an MDC key to route events to per-user or per-session files. That makes an MDC value part of a
filesystem path, which is why CVE-2026-19880 exists and why Logback 1.6.3 now strips slashes from
discriminator values ([02c](02c-the-version-you-are-actually-running.md)). **Validate the value
where it enters the MDC** — in your filter — not only where Logback consumes it.

**`AsyncAppender` copies the MDC but not caller data.** Its documentation: *"by default, only
'cheap' data like the thread name and the MDC are copied"*, with `includeCallerData` off. So MDC
survives the hand-off to the async worker thread; `%L`, `%M` and `%caller` do not
([10b](10b-async-appender.md)).

## Gotchas

**★ `%X{key}` with no `:-` default renders an empty string when the key is missing.**
The line's visual shape changes and a missing correlation id looks like a formatting glitch. Give
every `%X` an explicit default such as `%X{requestId:-none}`.

**★ A pattern layout only shows the MDC keys you named.**
Add a key in code and it stays invisible until someone edits the XML. Structured formatters emit
the whole map, which is one of the more practical arguments for JSON.

**★ `put`/`remove` without try-finally leaks on every exception path.**
And the exception path is exactly where correct context matters most. `putCloseable` in a
try-with-resources makes the mistake unwriteable.

**★ `MDCCloseable` removes, it does not restore.**
Nesting the same key twice leaves it absent after the inner scope rather than restored to the outer
value. Save-and-restore needs `getCopyOfContextMap()` plus `setContextMap()`.

**★ Values are `String` only.**
Numbers and objects are stringified at `put` time, which means the cost is paid whether or not
anything logs, and the structured output gets a string where a number would be queryable.

**★ Anything you put in MDC reaches log statements you did not write.**
Third-party libraries logging on the same thread emit your MDC too. That is the point, and it is
also why a secret or an email address in MDC leaks into places you never audited.

**★ Large values in MDC are attached to every subsequent line.**
The map is carried on each event. A serialised payload in MDC multiplies your log volume by the
number of lines in the request, and Logback's manual explicitly assumes values are placed there
*"with moderate frequency"*.

**★ Using MDC as an ambient parameter bus escalates the pooled-thread leak from confusing to
dangerous.**
A stale `requestId` is a bad log line; a stale `tenantId` consumed by a routing data source is a
data-isolation failure. Keep behavioural context out of MDC.

**★ `SiftingAppender` makes MDC values part of a file path.**
Validate at the boundary where the value enters the MDC. Logback's sanitisation in 1.6.3 is a
backstop, not a substitute, and it only exists in versions newer than the one Boot 4.1.0 pins.

**★ MDC in a `static` utility called from tests can bleed between tests.**
The test framework's thread is reused across test methods. A test that puts a key and does not
clear it changes the observed context of later tests, producing failures that only appear in a
particular execution order.

## Interview questions

**★ What problem does MDC solve, and what is the alternative?**
It puts contextual identifiers — request id, tenant, user — on every log line without passing a
context object through every method that might log. The alternative is exactly that: threading a
context parameter through service, repository and utility layers that otherwise have no reason to
know about it, and remembering to include it in every message. MDC replaces that with ambient
per-thread state that Logback attaches to every event automatically, including events logged by
libraries you did not write.

**★ How does MDC actually work, and what does that imply?**
It is a `ThreadLocal` map, so a value put on one thread is visible only to log statements executed
on that same thread. Two implications follow and they are the whole of the difficulty. First, work
that moves to another thread — an executor, a reactive scheduler, a `@Async` method — loses the
context unless it is explicitly propagated. Second, a thread that is *pooled* keeps whatever was
left on it, so failing to clear leaks one request's context onto the next request that reuses the
thread.

**★ Why `MDC.putCloseable` rather than `put` and `remove`?**
They are equivalent when written correctly, but `putCloseable` in try-with-resources cannot be
written incorrectly: the removal happens on every exit path including exceptions and early returns.
The manual form's failure mode is a `remove` skipped by a thrown exception — which is precisely the
path where you most want the context to be accurate. The one thing to know is that closing
*removes* the key rather than restoring a previous value, so nesting the same key needs
`getCopyOfContextMap`/`setContextMap` instead.

**★ What should and should not go into MDC?**
In: identifiers of the unit of work that are true for its whole duration — request or trace id,
tenant, an opaque user id, job or message id. Out: anything that changes mid-request, because MDC
is ambient and would attach it to lines it does not describe; anything large, because the map is
carried on every event; and anything sensitive, because MDC propagates into log statements written
by code you do not control. A user's email address is the classic mistake — use an opaque internal
id, which is a join key you own.

**★ How does MDC appear in output, and what changes with structured logging?**
In a pattern layout, through `%mdc` or `%X`, either as a named key with an optional `:-` default or
as the entire map. That means each key must be named in the XML, so a key added in code is
invisible until the configuration is edited. Structured formatters read the whole map off the event
— Boot's ECS formatter calls `getMDCPropertyMap()` — so new keys appear immediately as JSON fields.
That difference is one of the more concrete practical arguments for structured output.

**★ Is it reasonable to use MDC as a general request-scoped context, not just for logging?**
It works and it is common, and it makes the pooled-thread leak much more expensive. A stale
`requestId` produces a misleading log line — bad, recoverable. A stale `tenantId` read by a routing
data source produces the wrong tenant's data — a correctness and isolation failure. If you need
ambient state that affects behaviour, use something with a defined lifetime: a request-scoped bean,
or a `ScopedValue`, whose binding is structurally scoped rather than left on a thread.

{/* FOOTER */}
