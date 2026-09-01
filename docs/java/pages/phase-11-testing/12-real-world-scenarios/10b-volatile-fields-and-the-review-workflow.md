---
title: "Every pinned payload contains at least one value that changes on its own — an id, a timestamp, a generated link — and the four ways of dealing with it are not equally good: removing the volatility beats normalising it, normalising beats matching it by shape, and matching by shape beats the thing most teams do, which is give up and go lenient"
sidebar_label: "10b · Volatile fields and review"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** `JsonAssert`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/JsonAssert.html))
> and `AbstractJsonContentAssert`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/AbstractJsonContentAssert.html))
> javadocs; **JSONassert 1.5.3** sources for `Customization`
> ([github.com](https://github.com/skyscreamer/JSONassert/blob/master/src/main/java/org/skyscreamer/jsonassert/Customization.java)),
> `CustomComparator`
> ([github.com](https://github.com/skyscreamer/JSONassert/blob/master/src/main/java/org/skyscreamer/jsonassert/comparator/CustomComparator.java))
> and `JSONCompareMode`
> ([github.com](https://github.com/skyscreamer/JSONassert/blob/master/src/main/java/org/skyscreamer/jsonassert/JSONCompareMode.java)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, JSONassert 1.5.3.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[10](10-json-contracts-and-approval-tests.md) argued that a pinned payload is worth having
only while a human can read its diff and decide. This chunk is the two things that destroy
that property: values that change by themselves, and a review culture that regenerates
instead of reading. Both are fixable, and the first one has a preference order most teams
never get past step three of.**

## The volatility inventory

Before choosing a technique, list what actually moves. In a typical REST response it is:

- **Generated identifiers** — UUIDs, database sequences, correlation ids.
- **Timestamps** — `createdAt`, `updatedAt`, and anything computed from "now".
- **Derived links** — `self`, `next`, HATEOAS `_links`, anything embedding an id or a host.
- **Ordering** — collections whose order comes from a query with no `ORDER BY`.
- **Environment leakage** — a hostname, a port, a build version, a region.
- **Formatting that depends on locale or zone** — currency, decimal separators, offsets.

Everything on that list can be dealt with. The order in which you should try is the point of
this page.

## 1 · Remove the volatility — by far the best answer

Most of the list is not really volatile; it is *unsupplied*. A `Clock` you inject makes
`createdAt` deterministic ([01b](01b-the-js-to-java-map.md)'s `MutableClock`). An id supplier
you inject makes the UUID deterministic:

```java
public interface IdGenerator { String next(); }

// production
@Bean IdGenerator idGenerator() { return () -> UUID.randomUUID().toString(); }

// test
IdGenerator fixed = new SequentialIds("00000000-0000-0000-0000-0000000000%02d");
```

```java
@TestConfiguration(proxyBeanMethods = false)
class DeterministicWorld {
    @Bean Clock clock()             { return Clock.fixed(Instant.parse("2026-03-15T10:00:00Z"), UTC); }
    @Bean IdGenerator idGenerator() { return new SequentialIds(); }
}
```

Now the whole payload is pinnable with no special casing at all, the diff is honest, and — the
part that matters beyond this chunk — you have made the *production* code testable for every
other date- and id-dependent behaviour too. The cost is two beans and two constructor
parameters. This is the answer, and the rest of this page exists for the cases where you do
not control the generator.

The ordering item is a special case of the same principle: if the order is not deterministic,
either add the `ORDER BY` the API arguably always needed, or accept that order is not part of
the contract and choose a non-strict-ordering mode ([10](10-json-contracts-and-approval-tests.md)).

## 2 · Normalise before comparing

When the value genuinely cannot be made deterministic — it comes from the database, from a
library, from a header — replace it in the *actual* payload before comparing, with a single
documented function:

```java
private static String normalised(String json) {
    return json
        .replaceAll("\"id\"\\s*:\\s*\"[0-9a-f-]{36}\"", "\"id\":\"<uuid>\"")
        .replaceAll("\"createdAt\"\\s*:\\s*\"[^\"]+\"", "\"createdAt\":\"<timestamp>\"");
}
```

and pin `"id":"<uuid>"` in the expected file. Two honest caveats. Regex over JSON is fragile
and should be kept to a handful of narrowly anchored patterns — if the list grows past about
five, the payload is too volatile to pin at all. And normalisation *weakens* the assertion: a
`<uuid>` placeholder proves the field is a UUID-shaped string, not that it is the right one,
so anything you normalise must also be asserted properly somewhere else if it matters.

The advantage over the next technique is that the diff a reviewer sees is still plain JSON.

## 3 · Match by shape with a `Customization`

JSONassert supports per-path custom matching, and Spring's `JsonAssert.comparator` accepts the
result. `Customization` is documented in its source as *"Associates a custom matcher to a
specific jsonpath"*, and `CustomComparator` takes a mode plus any number of them:

```java
JSONComparator comparator = new CustomComparator(
        JSONCompareMode.NON_EXTENSIBLE,
        new Customization("id", (actual, expected) -> actual.toString().matches(UUID_REGEX)),
        new Customization("createdAt", (actual, expected) -> isRecentIso8601(actual)),
        new Customization("items[*].sku", (actual, expected) -> actual.toString().startsWith("SKU-")));

assertThat(mvc.get().uri("/orders/42"))
        .bodyJson()
        .isEqualTo(EXPECTED, JsonAssert.comparator(comparator));
```

The path accepts `*` and `**` wildcards, so `items[*].sku` and `**.createdAt` both work —
useful when the volatile field appears at several depths. JSONassert also ships
`RegularExpressionValueMatcher` and `ArrayValueMatcher` for the two most common cases, so the
lambda above is often unnecessary.

This keeps extensibility switched off — the additive-leak guard from
[10](10-json-contracts-and-approval-tests.md) survives — while allowing the values that move
to move. That combination is exactly what neither `STRICT` nor `LENIENT` alone gives you, and
it is the reason `JsonAssert.comparator(JSONComparator)` exists.

The cost is that the expectation now lives in two places: the JSON file and the comparator.
A reviewer reading the diff sees only half the rule.

## 4 · Split the assertion

The last resort, and sometimes simply the clearest thing: pin the stable envelope and assert
the volatile parts by path.

```java
assertThat(mvc.get().uri("/orders/42")).bodyJson()
        .hasPathSatisfying("$.id", v -> v.assertThat().asString().matches(UUID_REGEX))
        .hasPathSatisfying("$.createdAt", v -> v.assertThat().isNotNull())
        .extractingPath("$.order")
        .isEqualTo(EXPECTED_ORDER, JsonAssert.comparator(JsonCompareMode.STRICT));
```

`hasPathSatisfying(String, Consumer)` is documented as verifying *"that the given JSON `path`
is present with a JSON value satisfying the given `valueRequirements`"*, and `extractingPath`
as verifying the path is present and extracting the value *"for further assertions"*. Pinning
a sub-tree rather than the whole document is often the right answer for a response whose
envelope is machine-generated and whose payload is the actual contract.

What you give up is the guard against a field appearing *outside* the sub-tree you pinned.
Decide that deliberately rather than by accident.

## The review workflow, which is the other half of the technique

A pinned payload is a process artefact as much as a test. Four rules make it stay useful:

1. **A contract diff gets its own commit.** Never bundle an expected-JSON change into a
   twelve-file refactor; it will be scrolled past.
2. **The pull request says what changed and who consumes it.** "Added `deliveryWindow` to
   `GET /orders/{id}`; mobile v4.2 ignores unknown fields" is the difference between a review
   and a rubber stamp.
3. **Nobody regenerates.** If the expected file is edited by hand to match observed output
   without anyone articulating why, the test has stopped working and only the ritual remains.
4. **Removals get a second reviewer.** Adding a field is usually safe; removing or renaming
   one breaks consumers, and the pinned test is the only place in the codebase where that
   becomes visible before deployment.

Third-party approval-testing libraries exist for Java — the ApprovalTests family being the
best known — and they add received/approved file handling and diff-tool integration. ⚠️ Boot
does not manage any of them, so you would pin the version yourself, and I have not verified
current coordinates or behaviour against a primary source here; everything above uses only
what `spring-boot-starter-test` already brings.

## When not to pin at all

- **The payload has no external consumer.** Then its shape is your implementation detail and
  the diff is a refactoring artefact.
- **More than a handful of values are volatile.** Past about five normalisations or
  customisations, the rules are the test and the JSON is decoration.
- **The document is enormous.** A reviewer who cannot evaluate the diff in thirty seconds
  will approve it, and an approved-without-reading diff is worse than no test, because it
  carries authority.
- **The variation matters more than the shape.** If what you care about is "what does this
  do with a null middle name, an empty basket, a refunded order", those are three field-level
  tests and pinning three payloads is the expensive way to write them.
- **Binary or non-canonical formats.** PDFs, images, anything with an embedded creation date.
  The technique needs a comparison that ignores irrelevant differences, and JSON has one.

The one place the calculus flips is legacy code with no specification, where a pinned output
is a *characterization* test — you are not asserting the behaviour is right, only recording
what it currently is, so that a refactor can prove it did not change.
[11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md) is that argument
in full.

## Where this connects

- Comparison modes, the strict/lenient trap and where to store the expected JSON:
  [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md).
- Characterization testing, which is this technique used for a different purpose:
  [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md).
- The injected `Clock` that removes half the volatility:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- The same fixture read from the consumer's side:
  [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md).
- Builders and object mothers for the data behind the payload: **topic 08**,
  [../08-test-data-patterns/README.md](../08-test-data-patterns/README.md).

## Gotchas

**★ Going lenient to cope with a volatile field throws away the only thing pinning was for.**
It is the reflex fix — the test fails on a timestamp, someone switches to lenient comparison, the test goes green. But leniency means extensible, so the additive-leak guard is gone, and the test now proves only that certain fields are present with certain values, which is what a handful of `extractingPath` assertions would have proved more clearly and more cheaply. If you are going lenient, delete the pinned payload and write the path assertions honestly.

**★ Normalising a field weakens the assertion on it to "shaped like a UUID".**
`"id":"<uuid>"` proves the field exists and matched the pattern. It does not prove the id is the one the operation created, which is often the interesting fact. Anything you normalise away has to be asserted properly somewhere else, or you have quietly stopped testing it.

**★ A regex-based normaliser is a JSON parser you did not write.**
Anchor the patterns to the field name, keep them few, and never write one that could match inside a free-text value. A description field containing an ISO timestamp will be silently rewritten by a naive `createdAt` pattern's cousin, and the resulting failure looks like a serialization bug.

**★ `Customization` moves half the expectation out of the file the reviewer reads.**
The JSON says `"createdAt": "2026-03-15T10:00:00Z"` and the comparator says "any recent ISO-8601 string" — so the file is a lie about what is enforced. That is an acceptable trade for a few fields and a bad one for many. Where you use it, put the customisations next to the assertion, not in a shared helper three packages away.

**★ `CustomComparator` takes its own `JSONCompareMode`, and defaulting it to `LENIENT` silently disables extensibility checking.**
The constructor signature is `CustomComparator(JSONCompareMode mode, Customization... customizations)`, so the mode is a decision you make again at this call site. Passing `LENIENT` because it was the first constant to hand undoes the guard you built the comparator to preserve. `NON_EXTENSIBLE` is usually right here.

**★ Splitting the assertion leaves the un-pinned part unguarded, and nothing reminds you.**
`extractingPath("$.order").isEqualTo(...)` pins the order sub-tree beautifully and says nothing about a new top-level field appearing next to it. That may be exactly what you want; it is rarely what people realise they chose.

**★ Fixing an ordering failure with a `Comparator` in the test instead of an `ORDER BY` in the query hides a real bug.**
If a client renders that list, the order is user-visible, and "the database usually returns them in insertion order" is not a guarantee. The test failing is the system telling you the endpoint is under-specified. Sorting the actual JSON in the test to make it match silences the messenger.

**★ Regenerating an expected file is indistinguishable from fixing a bug in the diff view.**
Both appear as a changed JSON file. The only defence is process: a contract change in its own commit, with a message that names the consumers. Without that, six months later nobody can tell which changes were deliberate.

**★ A pinned payload produced from a fixed `Clock` is only deterministic if *every* time source is the clock.**
One `Instant.now()` in a mapper, one `new Date()` in a legacy DTO, one database `DEFAULT now()` on a column that gets serialized — any of them reintroduces the volatility, and the test becomes intermittently failing rather than reliably failing, which is much harder to diagnose. When determinism is the goal, grep for the alternatives.

**★ Environment leakage into a payload is a production bug that the pinned test correctly refuses to accept.**
A `self` link containing `localhost:8080`, a build version, a region code — the temptation is to normalise it away. Sometimes right; often the finding is that an internal detail is being published, and the fix is in the production code. Ask which one it is before adding the pattern.

## Interview questions

**★ Your pinned JSON test has a `createdAt` field. How do you deal with it?**
By trying four things in order, and the first one is almost always available. First, remove the volatility: have the production code read time through an injected `java.time.Clock`, pass a fixed clock in the test, and the field stops moving — that also makes every other time-dependent behaviour testable, so it pays for itself well beyond this test. Second, if the value genuinely comes from somewhere I do not control, normalise it in the actual payload before comparing, replacing it with a placeholder that the expected file also contains — cheap, keeps the diff readable, but weakens the assertion to "there is a timestamp-shaped string here". Third, match it by shape with a JSONassert `Customization`, which lets me keep non-extensible comparison for everything else while allowing that one path to vary; the cost is that half the expectation now lives in the comparator rather than in the file a reviewer reads. Fourth, split — pin the stable sub-tree and assert the timestamp separately with `hasPathSatisfying`. What I would not do is switch the whole comparison to lenient, because that throws away the extra-field guard that was the entire reason for pinning.

**★ A colleague fixes a failing contract test by copying the actual output into the expected file. What is wrong with that, if anything?**
Nothing, if they read the diff first and concluded the change was intended — that is exactly the workflow the technique is designed around, and I would want the expected-JSON change in its own commit with a message saying what changed and who consumes it. Everything, if they did not, because then the test has degraded into a ritual: it fails, someone regenerates, the build goes green, and no information was produced. That is the failure mode Jest snapshot suites are famous for, and the reason it happens there is that `-u` makes not-reading cheaper than reading. Java has no such button, which is a genuine advantage, and my main concern would be someone helpfully building one as a Gradle task. The signal I would look for in review is whether the pull request description mentions the contract change at all; if the diff includes an expected payload and the description does not, the reviewer should be asking.

**★ How do you keep an approval-style test from becoming unreadable as the payload grows?**
By treating readability as a hard requirement rather than a nice-to-have, which means the payload gets split before it gets big. In practice: pin one representative case per endpoint, not one per variation — variations are field-level tests. Pin a sub-tree with `extractingPath` when the envelope is machine-generated noise. Put anything over about twenty lines in a file under `src/test/resources` so it shows up in review as a JSON diff instead of a Java string-literal diff, which reviewers actually read. And keep the number of normalisations or customisations small, because past a handful the rules have become the test and the JSON is decoration. The test I apply is whether a reviewer who did not write it can decide, in thirty seconds, whether the diff is intended. If not, the test will eventually be approved without reading, and an unread test that carries authority is worse than no test.

**★ When is pinning output the *right* tool rather than an over-reach?**
Two situations. First, a genuine external contract — an API response, a webhook body, a file format, an event payload — where the thing I most want to catch is a change nobody thought to assert, especially a field appearing that I did not intend to publish, because that becomes a permanent commitment the moment a consumer notices it. No field-level test can catch an addition. Second, and this is the one people forget, legacy code with no specification: I pin the current output not because it is correct but because it is *current*, so that a refactor can prove it changed nothing. That is a characterization test, its expected values may well encode bugs, and saying so out loud in a comment is part of writing it honestly. Outside those two, if the JSON has no reader beyond my own codebase, its shape is an implementation detail and pinning it just converts refactoring into diff review.

{/* FOOTER */}
