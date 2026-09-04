---
title: "SLF4J 2.0's fluent API exists to attach typed key-value pairs to a log event without folding them into the sentence, which is the missing half of structured logging — and it has one failure mode that produces no output and no error at all"
sidebar_label: "04b · The fluent API"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J 2.0.18 manual, "Fluent Logging API"**, which is the
> source of every quoted sentence and code example below
> ([slf4j.org](https://www.slf4j.org/manual.html)), the **Logback manual, "Layouts"**, for the
> `%kvp` and `%maskedKvp` conversion words
> ([logback.qos.ch](https://logback.qos.ch/manual/layouts.html)), and the **Spring Boot 4.1.1
> source** for `ElasticCommonSchemaStructuredLogFormatter`, which reads
> `ILoggingEvent::getKeyValuePairs`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/java/org/springframework/boot/logging/logback/ElasticCommonSchemaStructuredLogFormatter.java)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34.

**The classical API can only express a log event as a sentence with values interpolated into it.
The fluent API, added in SLF4J 2.0.0, lets you build the event piece by piece and attach values as
*named pairs* that stay separate from the message — which is exactly what a JSON formatter needs
and exactly what a `{}` template cannot provide. It also has a mistake that compiles, runs, and
logs nothing.**

## The shape

`atTrace()`, `atDebug()`, `atInfo()`, `atWarn()` and `atError()` are new methods on
`org.slf4j.Logger` that return a `LoggingEventBuilder`. The manual:

> *"The idea is to build a logging event piece by piece with a LoggingEventBuilder and to log once
> the event is fully built. The `atTrace()`, `atDebug()`, `atInfo()`, `atWarn()` and `atError()`
> methods, all new in the `org.slf4j.Logger` interface, return an instance of
> LoggingEventBuilder."*

The equivalences, from the manual's own examples:

```java
logger.atInfo().log("Hello world.");
// is equivalent to
logger.info("Hello world.");
```

```java
// using traditional API
logger.debug("Temperature set to {}. Old value was {}.", newT, oldT);

// using fluent API, log message with arguments
logger.atDebug().log("Temperature set to {}. Old value was {}.", newT, oldT);

// using fluent API, add arguments one by one and then log message
logger.atDebug().setMessage("Temperature set to {}. Old value was {}.")
      .addArgument(newT).addArgument(oldT).log();
```

## 🔴 The failure mode: forgetting `.log()`

The manual states it plainly:

> *"When using the fluent API, you must terminate the invocation chain by calling one of the
> `log()` method variants. Forgetting to call any of the `log()` method variants will result in no
> logging regardless of the logging level. Fortunately, if this happens, some IDEs will alert you
> with a compiler warning."*

```java
// Compiles. Runs. Logs absolutely nothing. No warning at runtime.
log.atError().setMessage("Payment failed for order {}").addArgument(orderId);
```

⚠️ **"Some IDEs will alert you"** is the entire safety net, and it is not a compiler error. This is
the strongest argument for keeping the classical API as the default form and reaching for the
fluent one only where it buys something — because the classical form cannot be silently
incomplete.

**If you adopt it widely, enforce it statically.** An error-prone or SpotBugs rule for an unused
`LoggingEventBuilder` return value turns a silent runtime loss into a build failure, and it is the
only mechanism that scales past a code review.

## The reason to use it: `addKeyValue`

This is the feature that justifies the API, because it does something the classical form cannot.

```java
int newT = 15;
int oldT = 16;

// using classical API
logger.debug("oldT={} newT={} Temperature changed.", oldT, newT);

// using fluent API
logger.atDebug().setMessage("Temperature changed.")
      .addKeyValue("oldT", oldT)
      .addKeyValue("newT", newT)
      .log();
```

**These are not the same event.** The classical version produces a *string* in which `oldT=16`
happens to appear. The fluent version produces an event carrying two structured pairs alongside a
message that is a clean, groupable template. The manual:

> *"The key-value pair variant of the API stores the key-value pairs as separates objects. The
> default implementation currently in the `org.slf4j.Logger` class prefixes key-value pairs to the
> message. Logging backends are free and are even encouraged to offer a more customizable
> behaviour."*

🔴 **"Stores the key-value pairs as separate objects"** is the load-bearing clause. The values
never enter the message string, so a JSON encoder can emit them as real fields with their own
names.

## What the backends do with them

**Logback pattern layouts** expose them through `%kvp`:

> *"`kvp{NONE|SINGLE|DOUBLE}` — Outputs the key value pairs contained in the logging event. You can
> override the default by specifying NONE for no quote character or SINGLE for a single quote
> character, DOUBLE for double quotes. By default, the value part will be surrounded by double
> quotes."*

Boot's own default patterns do **not** include `%kvp`, so key-value pairs are invisible in the
default console format unless you add it — which is a genuinely confusing first experience:

```xml
<pattern>%d{HH:mm:ss.SSS} %-5level %logger{36} -%kvp -%msg%n</pattern>
```

**Boot's structured formatters read them directly.** The ECS formatter's source adds MDC entries
and key-value pairs to the same flattened region of the JSON object:

```java
members.add().usingPairs(contextPairs.nested((pairs) -> {
    pairs.addMapEntries(ILoggingEvent::getMDCPropertyMap);
    pairs.add(ILoggingEvent::getKeyValuePairs, keyValuePairExtractor);
}));
```

⚠️ **That means MDC keys and key-value pair keys share one namespace in the output.** A pair named
`traceId` collides with the MDC entry of the same name. Namespacing your own fields is not
paranoia; [05c](05c-schema-and-field-naming.md) argues it properly.

## `Supplier` arguments: deferral without a branch

The other genuinely useful capability, and the modern replacement for `isDebugEnabled()` guarding
an expensive argument ([04](04-parameterised-messages.md)):

```java
// using fluent API, add one argument with a Supplier and then log message with one more argument.
// Assume the method t16() returns 16.
logger.atDebug().setMessage("Temperature set to {}. Old value was {}.")
      .addArgument(() -> t16()).addArgument(oldT).log();
```

The lambda is only invoked if the event is actually logged. This expresses the deferral inline,
without an `if` block wrapping the statement — which reads better and cannot drift out of sync with
the level being guarded.

⚠️ **It is not free.** A capturing lambda allocates unless the JIT can scalar-replace it. For a
statement disabled in production this is still far cheaper than the work it defers; for a statement
that is *enabled*, you have added an allocation to save nothing.

## Markers, and why the API exists in this shape at all

The manual's own justification:

> *"The fluent logging API allows the specification of many different types of data to a
> `org.slf4j.Logger` without a combinatorial explosion in the number of methods in the Logger
> interface. It is now possible to pass multiple Markers, pass arguments with a Supplier or pass
> multiple key-value pairs."*

That is a real API-design constraint. The classical interface would need a method for every
combination of (marker?, throwable?, arity) — the builder collapses that to one entry point.

```java
log.atError()
   .addMarker(PAGE)
   .setCause(ex)
   .setMessage("Ledger write failed for transfer {}")
   .addArgument(transferId)
   .addKeyValue("ledgerAccount", accountId)
   .addKeyValue("amountMinor", amountMinor)
   .log();
```

## When to use which

**Classical API — the default.** Short, cannot be silently incomplete, and covers the majority of
statements. Every "log an operation and its identifiers" line.

**Fluent API — when you want named fields.** Specifically: when the event is going to JSON and the
values deserve to be queryable fields rather than substrings; when an argument is expensive enough
to want a `Supplier`; when you need a marker plus a cause plus arguments together.

🔴 **Do not convert an existing codebase wholesale.** The conversion is mechanical, the benefit is
per-statement, and the risk — a dropped `.log()` — is silent. Introduce it where the structure buys
something and leave the rest.

## `%maskedKvp`: masking that costs nothing

Logback offers a masked variant, and it is the cheapest redaction mechanism available because the
pairs are already separate objects:

> *"Since 1.5.7 … sometimes you wish to mask values of certain keys, typically passwords, credit
> card numbers and such. While `replace` converter can acheive that, pattern replacement comes at a
> computational cost. On the other hand, the `%maskedKvp` converter will mask values for all
> specified keys at practiacally no computational cost."*

> *"assuming key value pairs (k1, v1), (k2, v2) and (k3, v3) in the logging event,
> `%maskedKvp{k2, k3}` will output: `k1="v1" k2="XXX" k3="XXX"`"*

[08b](08b-masking-and-the-audit-trail.md) argues where this fits in a real redaction strategy and
where it does not.

## Gotchas

**★ Forgetting `.log()` produces no output, no error and no exception.**
The event is built and discarded. The manual's own safety net is *"some IDEs will alert you with a
compiler warning"* — which means CI does not catch it unless you add a static-analysis rule for an
ignored `LoggingEventBuilder` result.

**★ `addKeyValue` pairs are invisible in Boot's default console pattern.**
Boot's `CONSOLE_LOG_PATTERN` has no `%kvp`. The first time you use the API locally it looks like it
did nothing. Add `%kvp` to a custom pattern, or switch that environment to a structured format.

**★ Key-value keys and MDC keys share one namespace in Boot's structured output.**
The ECS formatter flattens `getMDCPropertyMap()` and `getKeyValuePairs()` into the same region of
the JSON object. A pair named the same as an MDC key collides. Namespace deliberately.

**★ A `Supplier` argument allocates a capturing lambda.**
Worth it for a genuinely expensive computation on a statement that is usually disabled; a net loss
on a statement that is usually enabled, where you pay the allocation and defer nothing.

**★ The fluent API does not make a statement structured by itself.**
`logger.atInfo().log("some sentence")` is exactly `logger.info("some sentence")`. The structure
comes from `addKeyValue`; the builder alone buys nothing.

**★ Converting a codebase wholesale trades a safe API for a silent one.**
Every converted statement gains a way to fail quietly that the classical form did not have. Convert
where key-value pairs, suppliers or markers are actually wanted.

**★ The default SLF4J behaviour prefixes pairs to the message, which is not what you want in
production.**
The manual says the default implementation *"prefixes key-value pairs to the message"* and that
backends are *"encouraged to offer a more customizable behaviour"*. With Logback plus a structured
formatter you get real fields; with a bare pattern layout and no `%kvp` you may get them glued onto
the message text instead.

**★ It requires SLF4J 2.x.**
An application still resolving `slf4j-api` 1.7 through a transitive dependency
([02b](02b-the-classpath-problem.md)) will not compile against `atInfo()` at all, or worse, will
compile against 2.x and fail at runtime on 1.7.

## Interview questions

**★ What does the SLF4J fluent API give you that the classical API cannot?**
Named key-value pairs that stay outside the message string. In the classical API the only way to
attach a value is to interpolate it into the sentence, so downstream it is a substring. With
`addKeyValue` the pairs are, in the manual's words, stored *"as separate objects"*, which means a
JSON formatter can emit them as real fields with their own names and types. It also allows a
`Supplier` argument, multiple markers and a cause on one statement without a combinatorial
explosion of overloads on the `Logger` interface.

**★ What is the one dangerous mistake in the fluent API?**
Forgetting the terminal `.log()`. The chain compiles and runs, the event is built, and then
discarded — no output, no exception, regardless of level. The documentation's only stated
mitigation is that some IDEs warn. In a codebase that adopts the API broadly, the real mitigation
is a static-analysis rule that treats an ignored `LoggingEventBuilder` as an error, because code
review will not reliably catch it.

**★ You add `addKeyValue` calls and nothing appears in your console. Why?**
Because Spring Boot's default console pattern does not include the `%kvp` conversion word, so the
pairs are carried on the event but never rendered. Either add `%kvp` to a custom pattern, or turn
on a structured format — Boot's ECS formatter reads `getKeyValuePairs()` from the event and emits
the pairs as JSON members, which is where they are actually useful.

**★ When would you use a `Supplier` argument instead of an `isDebugEnabled()` guard?**
When exactly one argument is expensive and the statement is otherwise ordinary. The supplier
expresses the deferral at the point of use, so it cannot drift out of sync with the level being
checked the way a separate `if` block can. The guard is still better when several statements share
one branch, or when the expensive work feeds more than one line — and the supplier is a net loss on
a statement that is enabled in production, since you pay an allocation to defer nothing.

**★ Should a team migrate its whole codebase to the fluent API?**
No. The benefit is per-statement and only materialises where you actually attach key-value pairs,
suppliers or markers; a mechanical conversion of `log.info(...)` to `log.atInfo().log(...)` buys
nothing and introduces a silent failure mode at every converted site. The reasonable policy is
classical by default, fluent where the event is going to JSON and its values deserve to be
queryable fields.

**★ How do key-value pairs relate to MDC?**
They solve adjacent problems and, in Boot's structured output, they land in the same place. MDC is
*ambient* context that applies to every line on the thread — request id, tenant, user. Key-value
pairs are *per-event* facts that belong to one statement. Boot's ECS formatter flattens both into
the same JSON region, which is convenient and also means they share a key namespace: a pair named
the same as an MDC key will collide, so both need naming discipline.

{/* FOOTER */}
