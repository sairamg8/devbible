---
title: "When nobody can judge whether a single output is correct — a search ranking, a price with rules, a recommendation — you can still state how the output must change when the input changes in a known way, and jqwik's contract tests let you write such a law once and run it against every implementation of an interface"
sidebar_label: "04e · Metamorphic relations and contract tests"
sidebar_position: 18
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, section *Contract Tests*
> (quoted verbatim below), plus *Providing variable types*, *Arbitrary Provider Methods* and
> *Assumptions* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the
> **JDK 25 javadoc** for `java.lang.Object.equals`/`hashCode` and
> `java.util.Comparator.compare` for the contracts asserted below.
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **"Metamorphic relation" is a term from the testing literature, not from jqwik's
> documentation.** The API used to express one is jqwik's and is cited; the vocabulary is not.
> ⚠️ **No sandbox and no test run on this machine** — Java source only, never its output.

**[04d](04d-models-and-oracles.md) needed something that could judge an output: a model, or a
checker. This page is for the code where nothing can. Nobody can say whether these ten search
results are the right ten, whether this recommendation is correct, or whether this risk score
should have been 0.71 — those are judgements, not computations. What you *can* say is how the
output must change when the input changes in a known way, and that relation is testable even
though neither run alone is. Then, when the law belongs to an interface rather than to one
class, jqwik has a documented mechanism for writing it once and inheriting it everywhere.**

## Metamorphic relations: relate two runs when you cannot judge either one

Sometimes there is no model and no checker — nobody can say whether *this* search result set is
correct. You can still say how the output must change when the input changes in a known way,
and that relation is testable even though neither run alone is.

```java
@Property
void addingAFilterNeverIncreasesTheNumberOfResults(
        @ForAll("queries") Query query, @ForAll("filters") Filter extra) {

    int before = search.execute(query).size();
    int after  = search.execute(query.and(extra)).size();

    assertThat(after).isLessThanOrEqualTo(before);
}

@Property
void addingALineItemNeverDecreasesTheTotal(
        @ForAll("baskets") Basket basket, @ForAll("lines") LineItem extra) {

    assertThat(pricing.quote(basket.plus(extra)).total())
            .isGreaterThanOrEqualTo(pricing.quote(basket).total());
}

@Property
void renamingAVariableDoesNotChangeTheResult(
        @ForAll("expressions") Expression expression, @ForAll("names") String fresh) {

    Assume.that(!expression.freeNames().contains(fresh));
    assertThat(evaluate(expression.rename("x", fresh)))
            .isEqualTo(evaluate(expression));
}
```

The four metamorphic shapes that turn up most often in business code:

- **Monotonicity.** Adding input never decreases (or never increases) the output. Totals,
  result counts, elapsed cost, risk scores.
- **Permutation invariance.** Shuffling the input changes nothing. Aggregations, set
  operations, anything whose result should not depend on arrival order.
- **Scaling.** Doubling every input doubles the output — true of linear pricing and false of
  anything with tiers, which makes it a good property *and* a good question to ask the domain
  expert.
- **Substitution.** Replacing a value with an equivalent one leaves the output unchanged.
  Renaming, changing a synonym in a search term, using a different but equal `BigDecimal` scale.

This is the family to reach for on recommendation engines, ranking, pricing with rules,
search, report generation and anything where "correct" is a business judgement rather than a
computation.

## jqwik's contract tests: one property, every implementation

When the relation is a *contract* rather than a fact about one class — `equals`, `Comparator`,
a repository interface, a `Codec` — jqwik has a documented mechanism for writing it once. The
guide's own example:

> *"When you combine type variables with properties defined in superclasses or interfaces you
> can do some kind of contract testing. That means that you specify the properties in a
> generically typed interface and specify the concrete class to instantiate in a test container
> implementing the interface."*

```java
interface ComparatorContract<T> {
    Comparator<T> subject();

    @Property
    default void symmetry(@ForAll("anyT") T x, @ForAll("anyT") T y) {
        Comparator<T> subject = subject();
        assertThat(signum(subject.compare(x, y)))
                .isEqualTo(-signum(subject.compare(y, x)));
    }

    @Provide
    Arbitrary<T> anyT();
}

class StringCaseInsensitiveProperties implements ComparatorContract<String> {

    @Override public Comparator<String> subject() {
        return String::compareToIgnoreCase;
    }

    @Override @Provide public Arbitrary<String> anyT() {
        return Arbitraries.strings().alpha().ofMaxLength(20);
    }
}
```

The guide is explicit about the machinery that makes this work: *"jqwik is able to figure out
the concrete type of type variables when they are used in subtypes that fill in the
variables."* Note the shape — the properties are `default` methods on the interface, the
implementation supplies both the subject and the arbitrary, and every implementing class runs
the whole contract with no duplicated code.

This is the right home for the four laws everyone knows and nobody tests: `equals` is
reflexive, symmetric and transitive; equal objects have equal hash codes; `compare` is
antisymmetric and transitive; and `compareTo` is consistent with `equals` if the class claims to
be. Write the contract once, implement it for each value type, and every new domain object gets
the whole set for the cost of two override methods.
## Where this connects

- The comparison-based properties that need an oracle are
  [04d · Models and oracles](04d-models-and-oracles.md); the four mechanical relations are
  [04 · Finding properties](04-finding-properties.md) and
  [04b · Invariants and order-independence](04b-invariants-and-order-independence.md).
- The `@Provide` method a contract implementation must supply is
  [05 · Generators](05-generators.md); building `Query`, `Basket` and `Expression` values out
  of parts is [05c · Composing arbitraries](05c-composing-arbitraries.md).
- The `Assume.that` in the renaming property, and what it costs, is
  [05b · Constraining generation](05b-constraining-generation.md).
- Checking that a contract's arbitrary really produces the awkward cases is
  [09 · Statistics](09-statistics.md).
- Whether a metamorphic property is testing anything or restating the code is
  [12 · The cost](12-the-cost.md).

## Gotchas

**★ Metamorphic relations are directional, and reversing one by accident produces a property that is false for correct code.**
"Adding a filter never increases the result count" is true; "never decreases" is false.
"Adding a line item never decreases the total" is true until someone introduces a bulk discount
that makes it false, at which point the property is a genuine question about the domain rather
than a bug. Write the direction into the method name so that the next reader is checking a
sentence rather than an inequality.

**★ A contract interface's `@Property` methods must be `default` methods, and the implementing class must supply the `@Provide` — forgetting either produces a discovery failure rather than a compile error.**
The properties live on the interface as `default` methods so that jqwik finds them on the
implementing container class; an abstract method annotated `@Property` is not runnable, and a
missing `@Provide` implementation surfaces as `CannotFindArbitraryException` at run time. Both
read like tool problems and are structural mistakes, and both are invisible until execution.

**★ Contract properties inherit the implementation's arbitrary, so a lazy `anyT()` weakens every law at once.**
`Arbitraries.strings().alpha().ofMaxLength(20)` never produces the empty string's awkward
neighbours, never produces case-mixed pairs that differ only in case, and never produces `null`.
Every law in the contract is then verified over that narrow domain, and one weak `anyT()`
silently weakens ten properties instead of one. When you implement a contract, spend the effort
on the arbitrary — it is the only part you wrote.
**★ A monotonicity property is one bulk discount away from being false, and the failure will be read as a bug.**
"Adding a line item never decreases the total" is exactly the kind of law a product decision
invalidates: introduce "buy three, get one free" and the property is correctly red against
correct code. This is a feature of the technique — the property is a written-down assumption
about the domain, and it failed the moment the domain changed — but only if the team reads it
that way. Name the property after the rule (`totalIsMonotonicWithoutBulkDiscounts`) so that the
failure points at the assumption rather than at the arithmetic.

**★ A permutation-invariance property over a `Set` parameter tests nothing, because the input had no order to permute.**
`@ForAll Set<String> tags` arrives in whatever order the set iterates, and shuffling it is a
no-op with respect to what you meant to test. To test order-independence you need a `List` and
an explicit shuffle of a copy — `List<String> shuffled = new ArrayList<>(input);
Collections.shuffle(shuffled, new Random(seed));` — with the seed generated so the shuffle
itself is reproducible and shrinkable. A `Set` parameter makes the property look right and
removes its content.

**★ Two runs inside one property double the runtime of every try, and metamorphic properties always have two runs.**
A property that calls the system under test twice costs twice as much per try, and at the
default 1000 tries that is the difference between a property you run per-commit and one you do
not. If the call is expensive — a real search index, a rules engine loading a policy file —
lower `tries` deliberately and say why in the annotation, rather than discovering the cost as a
slow build. [12 · The cost](12-the-cost.md) is the fuller argument.

**★ A metamorphic property that mutates a shared fixture between the two runs measures the fixture, not the relation.**
`search.execute(query)` followed by `search.execute(query.and(extra))` is only a valid
comparison if nothing changed in between — no index refresh, no cache warm-up that makes the
second call behave differently, no counter the system under test increments. Because jqwik
shares one instance of the test class across all tries of a property
([03d](03d-the-jqwik-lifecycle.md)), state left behind by try 1 is present in try 2 as well,
which turns a violated relation into an apparently-flaky property. `@BeforeTry` on a method that
rebuilds the subject is the fix.

## Interview questions

**★ Explain a metamorphic relation to someone who has never heard the term, using a search feature as the example.**
Nobody can tell you whether the ten results your search engine returned for "blue running shoes"
are the *right* ten — that is a judgement, not a computation, so there is no oracle and no law.
But you can say things about how the results must *change* when the query changes in a known
way. Adding a filter can never give you more results than you had before. Searching for the same
words in a different order should give a similar set. Searching for a term with a typo should
give you a subset or superset relationship, not something disjoint. Each of those relates two
runs of the system rather than judging either one, and each is checkable over thousands of
generated queries. That is a metamorphic relation, and it is how you test systems whose
correctness nobody can define — which includes most ranking, recommendation and pricing code in
a business.

**★ When would you write a jqwik contract test rather than a plain property?**
When the law belongs to an interface rather than to one class, and there is more than one
implementation — or there will be. `Comparator`, `equals`/`hashCode`, a `Codec` with several
formats, a `Repository` with an in-memory fake and a JDBC implementation, a `RetryPolicy` with
three strategies. Writing the properties as `default` methods on a generic interface means each
implementation supplies two things — the subject and an arbitrary for its type — and inherits
the entire suite of laws. The payoff is bigger than the code saved: it makes "does the fake obey
the same contract as the real one?" a mechanical check rather than an assumption, and that
assumption is behind a large fraction of the tests that pass against a fake and fail in
production.
**★ Give me a metamorphic relation for a machine-learning-backed risk scorer, and say honestly what it can and cannot tell you.**
The relation I would start with is substitution invariance: changing a field the model is not
supposed to consider — the customer's name, the request id, the order of the transaction list —
must not change the score. That is checkable over thousands of generated inputs and it catches
real defects: feature leakage, a hash of the wrong field ending up in the vector, a
non-deterministic ordering in the feature builder. A second one is directional: increasing the
transaction amount must never *decrease* the risk score, if the model is supposed to be
monotonic in that feature — and many are, by regulatory requirement. What this cannot tell you
is whether the model is any good. A scorer that returns 0.5 for everything satisfies both
relations perfectly. Properties here test the plumbing around the model — determinism, feature
handling, invariance to things that should not matter — and the quality of the model itself is
an evaluation-metric question, not a test-suite question. Being clear about that boundary is the
difference between useful tests and false confidence.

**★ How would you use contract tests to check that an in-memory fake behaves like the real repository?**
Write the repository's laws once as `default @Property` methods on a generic contract interface
— save-then-find returns the saved entity, find-on-a-missing-id returns empty, count agrees with
the size of find-all, delete-then-find returns empty, saving the same id twice updates rather
than duplicates — and have both the fake's test class and the Testcontainers-backed real one
implement it, each supplying its own `subject()` and its own `@Provide Arbitrary<Entity>`. The
laws are then verified against both implementations from one source. That directly attacks the
commonest failure in a suite built on fakes: the fake drifts, tests stay green, and production
breaks on a behaviour the fake never had. The caveat worth stating in the same breath is that
the real implementation's contract run will be slow — it is a database per try — so it belongs
in the integration suite with a reduced `tries`, while the fake's run stays in the fast suite at
full strength. The real dependency itself is
[07 · Testcontainers](../07-testcontainers/README.md).

{/* FOOTER */}
