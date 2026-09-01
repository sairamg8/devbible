---
title: "Most code in most systems has no law worth stating, and the failure mode of enthusiasm for property testing is not a wasted afternoon but a test that restates the implementation in the assertion — which passes forever, survives every bug, and looks in review exactly like the good properties next to it"
sidebar_label: "11 · Where it does not pay"
sidebar_position: 39
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Assumptions*,
> *Data Driven Properties* and *Optional @Property Attributes* (`maxDiscardRatio`)
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The judgements on this page are argument,
> not documentation, and are marked as such; the jqwik behaviours they rest on are quoted.

**[10](10-where-it-pays.md) and [10b](10b-where-it-pays-ordering-and-state.md) argued for the
domains where a property is a law you can transcribe. This page is the other verdict, and it is
the more useful one, because the cost of property testing the wrong code is not zero — it is a
test that can never fail. A tautological property is worse than no test: it consumes a thousand
tries of build time, it occupies the slot where a real test would have gone, and it appears in
the coverage report as though something were checked.**

## The failure mode: a property that restates the implementation

The single most common bad property, and it is written in good faith every time:

```java
// ⛔ This can never fail.
@Property
void discountIsCorrect(@ForAll("orders") Order order) {
    BigDecimal expected = order.total().multiply(new BigDecimal("0.9"));

    assertThat(pricing.applyLoyaltyDiscount(order)).isEqualByComparingTo(expected);
}
```

The assertion is the implementation, retyped. If the rule changes to 15%, the test fails for
every input and gets "fixed" by editing the constant in the test — which is not a test failing,
it is a second copy of the code being maintained. If the implementation is *wrong* — applies the
discount before tax when it should be after — the property is wrong in exactly the same way and
stays green.

**The tell is that the assertion contains the business rule.** A real property asserts something
*about* the result that is true without knowing how it was computed: *the discounted total is
never greater than the original*, *never negative*, *is zero only if the original was zero*,
*applying it twice differs from applying it once* (or does not, if the rule says so). Those can
fail. They also do not need updating when the rate changes, which is the practical test: **if a
rate change breaks your property, your property is a copy of the code.**

## Six places to stop

### 1 · Business policy with no invariant

"Gold customers in their first ninety days get free shipping unless the order contains a
restricted item." There is no law here. It is a decision someone made in a meeting, it will
change next quarter, and the only honest test is a table of the cases the business cares about —
which is [03 · Parameterized tests](../03-parameterized-tests/README.md), not this topic. Trying
to force a property produces either a tautology or an assertion so weak it proves nothing
(*"shipping cost is not negative"*).

⚠️ **Look for a hidden law before giving up.** Often there is one next to the policy rather than
in it: *the shipping cost is a function of the inputs alone* (no hidden state, no clock, no
randomness), *the total never decreases when an item is added*, *the eligibility check is
independent of the order in which items were added*. Those are properties, and they catch real
bugs, without encoding the rate table.

### 2 · Anything where the oracle is a document

If correctness means "matches the tax table finance sent" or "matches the reference vectors in
the RFC appendix", the values are given and generation adds nothing — you cannot generate the
expected answer without reimplementing the thing. Use the fixed vectors. jqwik will even host
them via `@FromData`, with a documented caveat that makes the trade explicit:

> *"There is also no shrinking being done for data-driven properties since jqwik has no
> information about the constraints under which the external data was conceived or generated."*

So `@FromData` gives you jqwik's ergonomics and none of its value. That is fine when the data is
the point; it is a reason not to pretend it is property testing.

### 3 · I/O-bound code

A property over a repository method runs the database a thousand times, and a property over an
HTTP client runs a thousand requests or a thousand mock interactions. The cost is real
([12 · The cost](12-the-cost.md)) and the return is low, because the law you would assert is
almost always about the collaborator rather than about your code — *"what I saved is what I read
back"* is a test of the database.

**The exception is worth knowing:** the mapping layer either side of the I/O is pure and often
has a genuine round trip — row → entity → row, request DTO → domain → request DTO. Property-test
the mapping, example-test the I/O.

### 4 · Output intended for humans

Formatted messages, rendered emails, log lines, currency strings for display. The correctness
criterion is taste, and the only mechanical laws available are weak (*"contains the customer
name"*, *"is not empty"*). Approval tests are the right tool — pin the rendered output, review
the diff when it changes — which is the technique covered for real systems in
**topic 12 · Real-world testing scenarios**.

### 5 · Code with no seams

A method that news up its own collaborators, reads a static clock and writes to a file has no
input space to generate over — the interesting variation is in the environment, not in the
parameters. Characterization tests first, then extract a seam, and only then is there a function
whose inputs mean anything. Reaching for property testing here produces a generator for the two
arguments the method happens to take, which are not the thing that varies.

### 6 · Where the property needs so many assumptions that it tests one case

```java
// ⛔ The premise is the test.
@Property
void refundsAreProcessed(@ForAll("orders") Order order) {
    Assume.that(order.isPaid());
    Assume.that(order.isShipped());
    Assume.that(!order.isRefunded());
    Assume.that(order.total().compareTo(BigDecimal.ZERO) > 0);
    ...
}
```

Each `Assume` discards draws that do not qualify, and four stacked premises discard nearly
everything. jqwik fails the property when the ratio is exceeded — `maxDiscardRatio` defaults to
5 — so this usually announces itself, which is a mercy. When it does not, it is worse: the
property runs on the handful of draws that survived and reports `checks` far below `tries`
([03b · Reading the failure report](03b-reading-the-failure-report.md)). **A pile of assumptions
is a generator that has not been written.** Either construct the qualifying order directly
([05c3 · Dependent generation](05c3-dependent-generation.md)) or accept that you wanted one
example.

## The honest summary

Property testing pays on a **small, identifiable minority** of a codebase. In a typical service,
that is the mappers, the money, the dates, the comparators, the parsers and the caches — a few
dozen classes out of hundreds. Everything else is better served by example-based tests, and a
team that adopts property testing everywhere ends up with a slow suite full of tautologies and
concludes the technique does not work.

⚠️ **This is a judgement, not a documented fact.** It is the argument this topic makes; the
figures are illustrative rather than measured, and there is no benchmark behind them.

## Where this connects

- The domains where it does pay are [10 · Where it pays](10-where-it-pays.md) and
  [10b · Where it pays: ordering and state](10b-where-it-pays-ordering-and-state.md).
- What a property costs to run, which is the other half of this decision, is
  [12 · The cost](12-the-cost.md).
- The decision procedure for finding a law when one is not obvious is
  [04c · When no law is obvious](04c-when-no-law-is-obvious.md).
- Discards, `Assume` and `maxDiscardRatio` are
  [05b2 · Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md).
- The table-of-cases alternative is
  [03 · Parameterized tests](../03-parameterized-tests/README.md).
- The honest answer to "is this test checking anything?" is
  [11 · Mutation testing](../11-mutation-testing/README.md).

## Gotchas

**★ A tautological property passes mutation testing's coverage check and fails its point entirely — which is the only reliable way to find one.**
Because the assertion recomputes the implementation, the property executes every line and reports
as covered, so nothing in a coverage report distinguishes it from a good test. Mutation testing
does: mutate the implementation and the property's expected value mutates with it only if the
test genuinely shares the code, so in practice a tautological property either kills nothing or
kills everything for the wrong reason. If you suspect a property is a copy of the code, the
cheapest check is manual — change a constant in the implementation and see whether the test
fails for the right reason or is simply edited to match.

**★ "If a rate change breaks the property, the property is a copy of the code" is a rule with one real exception.**
A property that asserts a *boundary* rather than a value — the discount never exceeds the total,
the tax is never negative, the fee is monotonic in the amount — should survive a rate change, and
if it does not, the rate change broke an invariant and you have learned something. So a failing
property after a policy change is worth reading before assuming it needs updating: the good ones
fail loudly and correctly when policy crosses a line it should not have crossed.

**★ Weak properties are the compromise people reach for, and a weak property is not a cheap strong one.**
*"The result is not null"*, *"the list is not empty"*, *"no exception is thrown"* — these are
sometimes worth having as smoke tests, but they cost a thousand tries and they pass on almost any
implementation, including an empty one that returns a constant. If the only law available is that
weak, the honest options are an example-based test that asserts something specific, or nothing.
Writing the weak property because a property was expected is how a suite fills up with things
that cannot fail.

**★ `Assume` inside a property is a load-bearing signal, and one is fine while four is a redesign.**
A single assumption expressing a genuine precondition is normal. Four stacked assumptions mean
the generator is producing values from the wrong space, and the fix is to generate the qualifying
value directly rather than to filter for it. The measurable symptom is `checks` far below `tries`
in the report; the failure symptom is the `maxDiscardRatio` breach, default 5, which fails the
property for a reason that has nothing to do with the code under test.

**★ Property-testing a repository is testing the database, and it will be blamed on jqwik when it is slow.**
A thousand generated saves against a real container, plus the shrink path re-running on failure,
turns a two-second integration test into a minute. The value is low because the property that
suggests itself — save then read returns what was saved — is a claim about the persistence layer,
which someone else already tested. Property-test the row mapping, which is pure; example-test the
repository, which is not.

**★ The class everybody is afraid of is usually the worst first target, and it is what teams pick.**
The big service with the complicated conditionals attracts attention because it is where bugs
live, but its complexity is policy complexity — branches encoding decisions, not laws. A property
over it will either restate a branch or assert something too weak to fail. The good first targets
are boring: a slug generator, a money splitter, a comparator, a CSV escaper. Starting on the
frightening class is how a team's first experience of property testing is a tautology, after
which nobody proposes it again.

## Interview questions

**★ When would you argue against writing a property test?**
When I cannot finish "for every input, this satisfies…" without adding exceptions — which is most
business logic. Policy is not law: a discount rule, an eligibility check, a fee schedule are
decisions that will change next quarter, and any property strong enough to be worth writing ends
up restating the rule in the assertion. That is the specific failure I am arguing against, and
it is worse than having no test, because it can never fail, it costs a thousand executions per
build, and it looks in review exactly like the good properties beside it. I would also argue
against it for I/O-bound code, where the property is really about the database or the HTTP client
and the cost is a thousand round trips; for output aimed at humans, where the criterion is taste
and approval tests are the right tool; and for anything whose oracle is a document, like a tax
table or RFC test vectors, where the values are given and generating adds nothing. In all of
those the answer is a table of examples, which is a perfectly good answer.

**★ How do you recognise a property that cannot fail?**
The assertion contains the business rule. If the expected value is computed by the same formula
the implementation uses, the test is a second copy of the code, and the practical check is to ask
what happens when the rule changes: if a rate change breaks the property, it was a copy. A real
property asserts something about the result that is true regardless of how it was computed —
bounds, monotonicity, a relationship between inputs and output, invariance under reordering. The
second recognisable form is the too-weak property: not null, no exception, non-empty. Those pass
on an implementation that returns a constant, so they occupy a test slot without defending
anything. Neither shows up in coverage, because both execute every line, which is exactly the
argument for mutation testing as the check on whether tests assert anything at all.

**★ A colleague has property-tested the whole service layer and the build has gone from four minutes to eleven. What do you do?**
First separate the two problems, because they have different fixes. Some of those properties are
tautologies — the ones whose assertion recomputes the pricing or eligibility rule — and those get
deleted, not tuned, because tuning a test that cannot fail just makes it cheaper to be useless.
Some are real properties over I/O-bound code, where the fix is to move the property down to the
pure part, typically the mapping layer, and leave an example-based test on the collaboration. And
a few are genuinely valuable and genuinely expensive, usually the model-and-oracle ones that run
the work twice, and for those I would lower `tries` deliberately with a comment saying why rather
than accept the runtime or delete the test. What I would resist is the reflex fix of dropping
`jqwik.tries.default` for the whole project, because that silently weakens the properties that
were earning their keep in order to pay for the ones that were not.

{/* FOOTER */}
