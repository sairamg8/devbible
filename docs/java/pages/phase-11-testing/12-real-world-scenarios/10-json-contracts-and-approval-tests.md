---
title: "Pinning a whole JSON payload is the closest Java gets to a Jest snapshot, and the difference between a test that guards a contract and one that merely detects change is not the tool — it is whether a human can look at the diff and decide, which is a property you design in and Jest's update button designs out"
sidebar_label: "10 · JSON contracts and approval tests"
sidebar_position: 68
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** `JsonCompareMode`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/JsonCompareMode.html)),
> `AbstractJsonContentAssert`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/AbstractJsonContentAssert.html)),
> `JsonAssert`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/JsonAssert.html))
> and `ContentResultMatchers`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/servlet/result/ContentResultMatchers.html))
> javadocs; **JSONassert 1.5.3**'s `JSONCompareMode` source
> ([github.com](https://github.com/skyscreamer/JSONassert/blob/master/src/main/java/org/skyscreamer/jsonassert/JSONCompareMode.java));
> and the **Spring Boot 4.1** reference *Auto-configured tests* for `@JsonTest` and
> `JacksonTester`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, JSONassert 1.5.3.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[01b](01b-the-js-to-java-map.md) mapped `toMatchSnapshot()` onto "pin the JSON" and flagged
that Java has no `jest -u`. This chunk is the argument that the missing update button is the
feature. A snapshot suite decays into noise when accepting a diff is cheaper than reading it;
Java's version stays useful for exactly as long as you keep it readable, small, and free of
values that change on their own. Everything here is about engineering that property — and
about the comparison mode, which has no JS analogue and is where the real decisions live.**

## What a pinned payload is for

Asserting field by field — `.extractingPath("$.total").isEqualTo(2500)` — proves the fields
you thought of. Pinning the whole payload proves something different and strictly stronger:
**nothing else changed**. That catches the class of regression nobody writes a test for:

- a field silently disappearing because someone renamed a record component;
- a field silently *appearing* — an internal id, a password hash, a `_links` block — that you
  have now published to every consumer forever;
- a number becoming a string, a date format drifting, `null` becoming `""`;
- a field order change that a badly written consumer depends on.

The second bullet is the one that justifies the technique on its own. Additive leaks are
invisible to every field-by-field test ever written, because those tests assert presence, not
absence.

## The line between a contract test and a change detector

Both look identical in the test file. The difference is entirely in what happens when one
fails, and it is decided by five properties you either designed in or did not:

| Property | Contract test | Change detector |
|---|---|---|
| **What is pinned** | a payload someone outside your codebase consumes | an internal structure that happens to serialize |
| **Size** | one endpoint, one representative case, tens of lines | whole object graphs, hundreds of lines |
| **Volatile values** | neutralised — ids, timestamps and generated URLs matched by shape | left in, so the test fails on the clock |
| **Failure message** | names the field that changed | "content mismatch" and two blobs |
| **How a diff is accepted** | a human reads it and decides it is an intended API change | regenerate and commit |

The last row is the whole thing. Jest's `-u` makes acceptance a keystroke, which is why
mature JS codebases end up with snapshot files nobody has read since they were created. Java
gives you no such button, and the correct response is **not** to build one. If you find
yourself writing a Gradle task that rewrites expected JSON files from actual output, you have
re-implemented `-u` and you will inherit its failure mode within two sprints.

The practical test for whether a pinned payload is earning its place: *if this fails on
someone else's pull request, will they be able to tell in thirty seconds whether the change
is intended?* If the answer is no, the payload is too big, too volatile, or not a contract.

## 🔴 Two assertions that look identical and mean opposite things

This is the highest-value fact on the page and it is verifiable in two javadocs.

Classic MockMvc's `content().json(String)` is documented as:

> *"Parse the expected and actual strings as JSON and assert the two are 'similar' - i.e.
> they contain the same attribute-value pairs regardless of formatting with a lenient
> checking (extensible, and non-strict array ordering). Use of this matcher requires the
> JSONassert library."*

**Lenient. Extensible.** Extra fields in the actual response do not fail it.

AssertJ-flavoured `AbstractJsonContentAssert.isEqualTo(CharSequence)` — the one you reach for
with `MockMvcTester` — is documented as:

> *"Verify that the actual value is strictly equal to the given JSON."*

**Strict. Not extensible.** Extra fields fail it.

So the same conceptual assertion, written in the two current Spring APIs, has opposite
defaults on the exact property that matters most for a contract test. Moving a suite from
`MockMvc` to `MockMvcTester` silently upgrades every pinned payload from "must contain" to
"must equal", and moving the other way silently downgrades it — and the downgrade is the
dangerous direction, because the tests still pass.

Write the mode explicitly, always, in both APIs:

```java
// classic — the boolean overload is deprecated "in favor of json(String, JsonCompareMode)"
mockMvc.perform(get("/orders/42"))
       .andExpect(content().json(EXPECTED, JsonCompareMode.STRICT));

// AssertJ — say it even though STRICT is the default
assertThat(mvc.get().uri("/orders/42"))
        .bodyJson().isStrictlyEqualTo(EXPECTED);
```

`isLenientlyEqualTo` and `isStrictlyEqualTo` exist precisely so the mode is visible at the
call site. Use them in preference to bare `isEqualTo`, not because the default is wrong but
because the next reader should not have to know what it is.

## The four modes, and Spring only exposes two of them

`JsonCompareMode` is *"Modes that can be used to compare JSON"*, `@since 6.2`, in
`org.springframework.test.json`, and it has exactly two constants: `STRICT` — *"Strict
checking."* — and `LENIENT` — *"Lenient checking."* Underneath, the comparison is JSONassert's,
and JSONassert's own enum documents the two independent axes Spring's two constants collapse:

> *"These different modes define different behavior for the comparison of JSON for testing.
> Each mode encapsulates two underlying behaviors: extensibility and strict ordering."*

| JSONassert mode | Extensible | Strict array ordering | What it means for you |
|---|---|---|---|
| `STRICT` | no | **yes** | Nothing extra, and arrays must be in this order |
| `LENIENT` | **yes** | no | Extra fields fine, array order irrelevant |
| `NON_EXTENSIBLE` | no | no | **Nothing extra, but array order free** |
| `STRICT_ORDER` | yes | **yes** | Extra fields fine, array order pinned |

Spring's `STRICT` is JSONassert's `STRICT` and Spring's `LENIENT` is JSONassert's `LENIENT`;
the two mixed modes have no Spring constant. And `NON_EXTENSIBLE` is the one a producer
usually actually wants: *no unexpected fields* (the additive-leak guard, which is the whole
point) without *pinning array order* (which is usually an implementation detail of a query,
and which will make the test fail the day someone adds an `ORDER BY`).

The bridge is documented on `JsonAssert`, *"Useful methods that can be used with
`org.skyscreamer.jsonassert`"*, also `@since 6.2`:

```java
assertThat(mvc.get().uri("/orders/42"))
        .bodyJson()
        .isEqualTo(EXPECTED, JsonAssert.comparator(JSONCompareMode.NON_EXTENSIBLE));
```

`JsonAssert.comparator` has three overloads — one taking Spring's `JsonCompareMode`, one
taking JSONassert's `JSONCompareMode`, and one taking a full `JSONComparator` — and the
second is the escape hatch that gets you the mode Spring did not name. The third is what
[10b](10b-volatile-fields-and-the-review-workflow.md) needs for volatile values.

## Choosing the mode is choosing a side

The mode encodes which side of the contract you are on, and getting it backwards is the
single most common misuse:

- **You are the producer, pinning what you emit** → not extensible. An unnoticed extra field
  is a permanent public commitment. `STRICT` or `NON_EXTENSIBLE`.
- **You are the consumer, pinning what you require** → extensible. The producer is allowed to
  add fields and you must not break when they do; a `STRICT` consumer test is a
  self-inflicted outage waiting for the producer's next release. `LENIENT`.
- **The array is a set** (permissions, tags, roles) → non-strict ordering. `LENIENT` or
  `NON_EXTENSIBLE`.
- **The array is a sequence** (a paginated page, a timeline, a sorted result) → strict
  ordering, because the order *is* the contract. `STRICT` or `STRICT_ORDER`.

Those two axes are independent, which is exactly why JSONassert has four modes and why
collapsing them to two occasionally forces you through `JsonAssert.comparator`.

## Where to put the expected JSON

Two homes, and the choice is about how the diff reads.

**A Java text block**, inline in the test, is right for small payloads. The expectation sits
next to the assertion, and JDK 15+ text blocks removed the escaping that used to make this
unbearable. This is `toMatchInlineSnapshot`'s equivalent and it is the better default under
about twenty lines.

**A file under `src/test/resources`**, loaded as a `Resource`, is right for anything larger —
`AbstractJsonContentAssert` supports Spring's `Resource` abstraction directly, so
`isStrictlyEqualTo(new ClassPathResource("contracts/order-42.json"))` works without reading
the file yourself. Files win when the payload is genuinely a shared artefact: the same file
can be the fixture a consumer's test reads ([08a](08a-the-payload-and-the-boundary.md)), the
example in the API documentation, and the thing you hand a partner.

What files also do is make the diff show up in code review as a JSON diff rather than as a
change to a Java string literal, which is a real and underrated benefit — reviewers read JSON
diffs and skip string-literal diffs.

## Where this connects

- Volatile fields, `Customization`, the review workflow and when not to pin at all:
  [10b · Volatile fields and the review workflow](10b-volatile-fields-and-the-review-workflow.md).
- The three assertions a controller test owes, of which this is the third:
  [05b · The three assertions and the hedge](05b-the-three-assertions-and-the-hedge.md).
- The snapshot row of the JS map, and why there is no `jest -u`:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- The same pinned-payload artefact used from the consumer's side:
  [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md).
- Asserting the request you *sent*, which has the same "the whole thing, not three fields"
  argument: [03 · Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md).
- **Topic 06 · MockMvc** owns `MockMvcTester` and the assertion APIs themselves:
  [../06-mockmvc/README.md](../06-mockmvc/README.md).

## Gotchas

**★ `content().json(x)` is lenient and `bodyJson().isEqualTo(x)` is strict — the same test, opposite meanings.**
The classic matcher is documented as *"lenient checking (extensible, and non-strict array ordering)"*; the AssertJ one as *"strictly equal to the given JSON"*. A migration between the two APIs silently changes what every pinned payload guarantees, in one direction tightening tests that then fail for good reasons, and in the other loosening them so that an added field stops being caught. Always name the mode.

**★ A lenient producer test cannot see the field you accidentally published.**
Leniency means extensible, which means a new `internalCustomerRef` in your response passes every assertion. You will find out when a consumer starts depending on it and you cannot remove it. For anything you emit, extensibility must be off — `STRICT` if array order matters, `NON_EXTENSIBLE` if it does not.

**★ A strict consumer test breaks the day the producer ships a harmless additive change.**
The mirror image, and just as common. As a consumer you are asserting what you *need*, not what they send; pinning their entire payload makes you fail on changes that do not affect you and trains your team to ignore the test. Use `LENIENT` and assert on the fields you consume.

**★ `NON_EXTENSIBLE` is usually the mode you want and Spring has no constant for it.**
`JsonCompareMode` has only `STRICT` and `LENIENT`, so "no extra fields, but I do not care about array order" requires `JsonAssert.comparator(org.skyscreamer.jsonassert.JSONCompareMode.NON_EXTENSIBLE)`. People who do not know this reach for `STRICT`, and then their test starts failing whenever a repository returns rows in a different order — at which point they downgrade to `LENIENT` and lose the extra-field guard entirely, which is the worst of the three outcomes.

**★ `STRICT` pins array order, and a database without an `ORDER BY` does not have one.**
This is the most common cause of a "flaky" JSON contract test. The payload is correct every time; the rows come back in whatever order the storage engine felt like. The fix is either an explicit sort in the production code — which is usually the real bug — or `NON_EXTENSIBLE`, not a retry.

**★ Every JSON comparison here needs JSONassert on the test classpath, and Boot manages it but does not always bring it.**
`ContentResultMatchers.json` states plainly that *"use of this matcher requires the JSONassert library"*. `spring-boot-starter-test` pulls it in, but a hand-assembled test classpath, or a module that excludes transitive test dependencies, will fail at runtime with a class-not-found rather than at compile time. The managed version on this spine is 1.5.3.

**★ `json(String, boolean)` still compiles and is deprecated.**
The javadoc says *"Deprecated. in favor of `json(String, JsonCompareMode)`"*, and the boolean is uninformative at the call site — `content().json(expected, true)` tells the reader nothing about which of the two axes is being tightened. Migrate; the replacement is the same length.

**★ Pinning an object graph rather than an API response is how a suite acquires hundreds of unreadable expectations.**
The technique works on any serializable thing, which is the trap. If the JSON is not something an external consumer sees, its shape is your implementation detail, and pinning it means every refactor produces a diff nobody can evaluate. The rule is that a pinned payload must have a reader outside your codebase.

**★ Writing a task that regenerates the expected files is re-inventing `jest -u`, including its failure mode.**
The value of the Java version is that accepting a diff costs a human reading it. Automate that away and within a couple of sprints you have files that are updated reflexively, a suite that never fails for a reason anyone acts on, and a false sense of contract coverage. If regeneration is genuinely needed for a large migration, make it a one-off script that is deleted afterwards, not a build task.

**★ Formatting differences are not differences, and hand-editing expected JSON invites you to forget that.**
All these comparisons are structural — *"the same attribute-value pairs regardless of formatting"* — so indentation, key order in objects and whitespace are irrelevant. That is a good thing, but it means a "fix" that reformats the expected file changes nothing and a reviewer who diffs by eye can be misled in both directions.

**★ A pinned payload from a single fixture proves the shape for one instance, not the schema.**
An `Optional` field that happens to be present in your fixture, a list that happens to have two elements, an enum that happens to be the common case — none of the alternatives are pinned. One representative payload is the right size, and the gap it leaves is covered by field-level tests for the variants, not by adding five more pinned payloads.

## Interview questions

**★ What is the Java equivalent of a Jest snapshot test, and is it a good idea?**
Pinning a serialized payload — usually JSON — with Spring's JSON comparison support, either `content().json(expected, mode)` in classic MockMvc or `bodyJson().isStrictlyEqualTo(expected)` with `MockMvcTester`. It is a good idea for a narrow and important case: something outside your codebase consumes that payload, and you want a test that fails when *anything* about it changes, including things nobody thought to assert. The regression it catches that no field-level test can is an accidental addition — a field you did not mean to publish, which becomes a permanent commitment the moment a consumer notices it. It is a bad idea for internal object graphs, because then the diff is a refactoring artefact and nobody can evaluate it. The structural difference from Jest is that Java has no `-u`, so accepting a diff costs a human reading it, and I would resist any attempt to build that button, because the cheap-acceptance loop is precisely what turns snapshot suites into noise.

**★ You are writing a test for a controller's JSON response. Strict or lenient, and why?**
Strict, or more precisely non-extensible, because I am the producer and the thing I most want to catch is a field appearing that I did not intend to publish. Lenient comparison is documented as *"extensible, and non-strict array ordering"*, which means an accidental extra field passes silently and I have shipped it. The complication is the array-ordering axis, which strictness couples to extensibility in Spring's two-constant `JsonCompareMode`: if the payload contains a list whose order is not part of the contract, full `STRICT` will make the test fail on ordering I do not care about. So my actual default is `JsonAssert.comparator(JSONCompareMode.NON_EXTENSIBLE)` — no extra fields, array order free — and I go to `STRICT` when the order genuinely is the contract, which for a paginated or sorted endpoint it is. If I were writing the *consumer's* test against someone else's API, I would flip to lenient, because there I am asserting what I need, and failing on a producer's additive change would be a self-inflicted outage.

**★ Your pinned payload test fails on a colleague's pull request. Walk me through what you do.**
I read the diff before anything else, because the whole design of these tests assumes a human does that. Three outcomes. If the change is an intended API change, the expected file gets updated in the same commit, and I want the pull request description to say so, because a contract change is a thing consumers need to hear about — that is the moment the test earned its keep. If the change is unintended — a field appeared, a date format shifted, a number became a string — it is a bug and the test just prevented a public commitment. And if the diff is ordering only, I stop and ask whether the order is part of the contract; if it is not, the test is over-specified and should be non-extensible rather than strict, and if it is, the production code is missing an `ORDER BY` and the test found a real bug. The one thing I would not do is regenerate the file to make the build green, which is the only failure mode this technique really has.

**★ Where do you draw the line on what to pin?**
At the boundary of my codebase. If someone outside — another team, a mobile client, a partner, a file consumer — reads that payload, its shape is a contract and pinning it is exactly right. If the JSON exists only because something happened to be serializable, its shape is my implementation detail, and pinning it converts every refactor into a diff nobody can evaluate, which is how the suite stops being read. Size follows from that: one endpoint, one representative case, small enough that a reviewer can judge a diff in thirty seconds. If the payload is too big for that, I would pin the stable envelope and assert the variable parts by path, because the test's value is entirely in whether its failure is actionable.

**★ Why does Spring have two comparison modes when JSONassert has four?**
Because Spring's `JsonCompareMode` collapses two independent axes into the two combinations people ask for most. JSONassert documents the underlying model explicitly — *"each mode encapsulates two underlying behaviors: extensibility and strict ordering"* — and its four constants are the four combinations: `STRICT` is not-extensible and ordered, `LENIENT` is extensible and unordered, `NON_EXTENSIBLE` is not-extensible and unordered, `STRICT_ORDER` is extensible and ordered. Spring exposes the first two. That is fine most of the time and occasionally wrong, because the combination a producer usually wants — no extra fields, but I do not care what order the list came back in — is `NON_EXTENSIBLE`, which has no Spring constant. The bridge is `JsonAssert.comparator`, which has an overload taking JSONassert's own `JSONCompareMode` and another taking a full `JSONComparator`, and knowing that overload exists is the difference between choosing the right semantics and choosing between two wrong ones.

{/* FOOTER */}
