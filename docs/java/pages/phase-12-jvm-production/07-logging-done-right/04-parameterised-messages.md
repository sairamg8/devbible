---
title: "The `{}` placeholder is not a formatting convenience — it is the mechanism that defers the entire cost of a log statement until after the level check, which is why SLF4J's own documentation puts the difference at a factor of at least thirty on a disabled statement"
sidebar_label: "04 · Parameterised messages"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J FAQ**, "What is the fastest way of (not) logging?",
> which is the source of every quoted claim and figure below
> ([slf4j.org](https://www.slf4j.org/faq.html)), the **SLF4J 2.0.18 manual**
> ([slf4j.org](https://www.slf4j.org/manual.html)), and the **Logback manual, "Layouts"**, for the
> conversion words whose cost is discussed
> ([logback.qos.ch](https://logback.qos.ch/manual/layouts.html)).
> 🔴 **No sandbox.** The "factor of at least 30" and "less than 1%" figures below are **SLF4J's own
> published claims, quoted as such** — not measurements taken here. Nothing on this page was run.
> JDK 25 · Spring Boot 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34.

**A disabled log statement should cost one field read and one comparison. String concatenation
makes it cost a `StringBuilder`, several `toString()` calls and a garbage-collectable object —
every time, whether or not anything is written. The `{}` placeholder exists to move all of that
behind the level check, and knowing exactly what it does and does not defer is what tells you when
the old `isDebugEnabled()` guard is still worth writing.**

## What concatenation actually costs

The SLF4J FAQ states it precisely:

> *"For some Logger logger, writing, `logger.debug("Entry number: " + i + " is " +
> String.valueOf(entry[i]));` incurs the cost of constructing the message parameter, that is
> converting both integer `i` and `entry[i]` to a String, and concatenating intermediate strings.
> This, regardless of whether the message will be logged or not."*

🔴 **"Regardless of whether the message will be logged or not"** is the whole point. Java evaluates
arguments before the call. By the time `debug` is entered and can consult the level, the string
already exists. On a statement that is disabled in production — which is every DEBUG statement,
which is most statements — the work is 100% waste.

The parameterised form defers it:

> *"After evaluating whether to log or not, and only if the decision is affirmative, will the
> logger implementation format the message and replace the '\{\}' pair with the string value of
> entry. In other words, this form does not incur the cost of parameter construction in case the
> log statement is disabled."*

And the size of the difference, in SLF4J's own words:

> *"The following two lines will yield the exact same output. However, the second form will
> outperform the first form by a factor of at least 30, in case of a disabled logging statement."*

⚠️ **That figure is a documented vendor claim about disabled statements, and it is the only number
on this page.** It is not a measurement taken here and it does not describe enabled statements,
where formatting happens either way and I/O dominates.

## What still gets evaluated

The placeholder defers *formatting*. It does not defer *argument evaluation*. This is the trap.

```java
// The string is not built. But findOrders() runs, every time.
log.debug("Orders for customer {}: {}", customerId, findOrders(customerId));

// The array is not stringified. But the stream is consumed, every time.
log.debug("Active sessions: {}", sessions.stream().filter(Session::isActive).toList());

// toString() is NOT called if DEBUG is disabled — this one is genuinely cheap.
log.debug("Order state: {}", complexOrderAggregate);
```

The third case is worth calling out, because it is the one people over-guard. The FAQ:

> *"The logging system will invoke `complexObject.toString()` method only after it has ascertained
> that the log statement was enabled. Otherwise, the cost of `complexObject.toString()` conversion
> will be advantageously avoided."*

🔴 **So the rule is: passing an expensive *object* is free; calling an expensive *method* is not.**
The distinction is whether the work happens in the argument expression or inside `toString()`.

## When `isDebugEnabled()` is still the right answer

SLF4J is clear that the guard is *not* needed to avoid formatting — the placeholder handles that,
and the guard has a small cost of its own:

> *"if the logger is enabled for the DEBUG level, you will incur the cost of evaluating whether the
> logger is enabled or not, twice: once in `debugEnabled` and once in `debug`. This is an
> insignificant overhead because evaluating a logger takes less than 1% of the time it takes to
> actually log a statement."*

**Three cases where the guard still earns its place:**

**1 · An argument expression that does real work.**

```java
if (log.isDebugEnabled()) {
    log.debug("Orders for customer {}: {}", customerId, findOrders(customerId));
}
```

**2 · Multiple statements that only make sense together**, where you want one branch rather than
five level checks:

```java
if (log.isTraceEnabled()) {
    log.trace("Request headers: {}", headerMap());
    log.trace("Request body: {}", bodyAsString());
    log.trace("Resolved route: {}", route);
}
```

**3 · A hot loop where even the level check is worth hoisting** — a genuine but rare case,
and one you should have a profile for before you write it
(**06 · JFR, JMC and async-profiler** *(not written yet)*).

**Where the guard is pure noise:**

```java
// Guarding a plain parameterised statement adds a second level check and nothing else.
if (log.isDebugEnabled()) {
    log.debug("Processing order {}", orderId);   // already free when disabled
}
```

⚠️ **The modern alternative to case 1 is `Supplier` arguments via the fluent API**, which expresses
the deferral inline without a branch — [04b](04b-the-fluent-api.md).

## The varargs cliff, and why it exists

SLF4J's `Logger` has one-argument and two-argument overloads *and* an `Object...` variant. The FAQ
explains why the redundancy is deliberate:

> *"This form incurs the hidden cost of construction of an Object[] (object array) which is usually
> very small. The one and two argument variants do not incur this hidden cost and exist solely for
> this reason (efficiency). The slf4j-api would be smaller/cleaner with only the Object...
> variant."*

**Practical reading: one and two arguments are allocation-free at the call site; three or more
allocate an array even when the statement is disabled.** That array is tiny and short-lived, so
this is not a reason to restructure code — but it is the reason a five-argument DEBUG statement in
a per-row loop is measurably worse than the same statement outside the loop.

## The message is a template, and that has downstream value

A parameterised message keeps the *shape* separate from the *values*. That is not only a
performance property:

- **It is groupable.** `"Retry {} failed for order {}"` is one template regardless of how many
  times it fires — which is what makes the top-templates cleanup in
  [03b](03b-the-warn-that-nobody-acts-on.md) possible.
- **It survives structured logging.** The values can become named fields instead of being welded
  into a sentence ([05](05-structured-json.md)).
- **It is stable across a reword.** A downstream query keyed on the template is at least keyed on
  something the author declared, rather than on incidental prose.

## The escaping rules, which you will hit exactly once

SLF4J's formatter is not `String.format` and not `MessageFormat`:

> *"SLF4J uses its own message formatting implementation which differs from that of the Java
> platform. This is justified by the fact that SLF4J's implementation performs about 10 times
> faster but at the cost of being non-standard and less flexible."*

The anchor is the two characters `{` immediately followed by `}`. Everything else is literal:

> *"SLF4J only cares about the formatting anchor, that is the '\{' character immediately followed by
> '\}'. Thus, in case your message contains the '\{' or the '\}' character, you do not have to do
> anything special unless the '\}' character immediately follows '\{'."*

So `logger.debug("Set {1,2} differs from {}", "3")` prints `Set {1,2} differs from 3`. To emit a
literal `{}`, escape the brace with a backslash, which in Java source is a doubled backslash:
`logger.debug("Set \\{} differs from {}", "3")` prints `Set {} differs from 3`.

🔴 **This bites when you log JSON.** A message containing `{}` from a serialised empty object gets
eaten as an anchor. Pass the JSON as an *argument*, never inline it into the template — which you
should be doing anyway.

## The throwable is not a placeholder argument

An exception passed as the **last** argument is treated as the throwable rather than as a `{}`
substitution, even when the message has no matching anchor for it. This is a documented SLF4J 1.6+
behaviour and it is the single most useful ergonomics decision in the API:

```java
log.error("Failed to publish OrderPlaced for order {} after {} attempts", orderId, attempts, ex);
//         two anchors ------------------------------^-----------^        two args, then ex
```

[09](09-exceptions-in-logs.md) owns the consequences, including what happens when you get the
position wrong.

## Gotchas

**★ String concatenation in a log call runs whether or not the statement is enabled.**
Java evaluates arguments before the call, so the string exists before the level can be consulted.
SLF4J puts the parameterised form ahead *"by a factor of at least 30, in case of a disabled logging
statement"*.

**★ `{}` defers formatting, not argument evaluation.**
`log.debug("{}", expensiveCall())` still calls `expensiveCall()` every time. The placeholder only
saves the string building. This is the most common misreading of the whole feature.

**★ But passing an expensive *object* really is free.**
`toString()` is invoked only after the level check passes. So `log.debug("{}", bigAggregate)` needs
no guard, while `log.debug("{}", bigAggregate.summarise())` does. The dividing line is where the
work lives.

**★ Guarding a plain parameterised statement with `isDebugEnabled()` adds cost and removes
nothing.**
It performs a second level check for no benefit. SLF4J notes the check is *"less than 1% of the
time it takes to actually log a statement"* — negligible, but so is what it saves here.

**★ Three or more arguments allocate an `Object[]` even when disabled.**
The one- and two-argument overloads exist *"solely for this reason (efficiency)"*. Irrelevant
almost everywhere; not irrelevant in a per-row loop.

**★ A message containing `{}` from embedded JSON gets eaten as an anchor.**
The anchor is `{` immediately followed by `}`. Serialised empty objects, empty maps and some
templating output all contain that sequence. Pass the payload as an argument instead of splicing
it into the template.

**★ SLF4J formatting is not `String.format` — `%s` does nothing.**
A message written with `%s` prints the `%s` literally and the arguments are silently dropped or
appended. It is a different, deliberately simpler formatter, documented as about ten times faster
and less flexible.

**★ Mismatched anchor and argument counts fail quietly.**
Too few arguments leaves `{}` in the output; too many leaves the extras unused — except for a
trailing `Throwable`, which is always consumed as the exception. No exception is thrown, so a
malformed statement can sit in production indefinitely.

**★ Concatenating inside a `String.format` inside a log call is the worst of both.**
`log.debug(String.format("order %s", id))` evaluates the format eagerly *and* gives up the
template. It combines the cost of concatenation with the loss of groupability.

## Interview questions

**★ Why is `log.debug("x=" + x)` worse than `log.debug("x={}", x)` even when DEBUG is disabled?**
Because Java evaluates arguments before the method is entered, so the concatenation, the
`toString()` calls and the resulting `StringBuilder` all happen before the logger has a chance to
check whether DEBUG is enabled. The parameterised form passes the template and the values
separately and only formats after the check passes. SLF4J's own documentation puts the difference
at a factor of at least thirty on a disabled statement.

**★ Does `{}` mean you never need `isDebugEnabled()` again?**
No. The placeholder defers *formatting*, not *argument evaluation*. If an argument is itself an
expensive expression — a repository call, a stream collection, a serialisation — that work happens
regardless. The guard is still correct there, as it is when several statements should share one
branch. What the guard is not needed for is the plain case, where it adds a second level check and
saves nothing.

**★ Is `log.debug("{}", hugeObject)` expensive when DEBUG is off?**
No, and this surprises people. `toString()` is only invoked after the logger has decided the
statement is enabled — the FAQ says the conversion cost is *"advantageously avoided"* otherwise.
So passing a large object is free; calling a method on it in the argument list is not. That
distinction is the practical rule: expensive object, fine; expensive expression, guard it or use a
`Supplier`.

**★ Why does SLF4J have one-argument and two-argument overloads as well as varargs?**
Purely for allocation. The varargs form constructs an `Object[]` at every call site, including
disabled ones; the fixed-arity overloads do not. The FAQ says outright that the API *"would be
smaller/cleaner with only the Object... variant"* and that the others exist solely for efficiency.
It matters only in genuinely hot code, but it explains an otherwise odd API shape.

**★ Your log line prints `Processing {} orders` with the brace visible. What went wrong?**
Either the argument count does not match the anchor count — an anchor with no corresponding
argument is left as-is rather than causing an error — or the message was written for a different
formatter, such as `String.format`'s `%s`, and the `{}` came from somewhere else. Neither throws.
That silence is why a malformed log statement can survive in production for months: nothing fails,
the line is just useless.

**★ You need to log a JSON payload. What is the trap?**
The payload can contain `{}` — a serialised empty object or empty map — and SLF4J's anchor is
exactly the character pair `{` followed immediately by `}`. Splicing the JSON into the message
template makes that sequence an anchor and consumes an argument that was meant for elsewhere. The
fix is the thing you want to be doing anyway: pass the payload as an argument, or better, as a
named field via key-value pairs ([04b](04b-the-fluent-api.md)) so it lands as structured data
rather than as text inside a sentence.

{/* FOOTER */}
