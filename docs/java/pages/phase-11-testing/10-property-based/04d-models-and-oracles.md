---
title: "Two of the strongest properties you can write need no law at all: compare the fast implementation against a slow obviously-correct one, or verify an answer you could never have computed — and the second is worthless unless it also asserts that the answer is at least as good as a trivial one"
sidebar_label: "04d · Models and oracles"
sidebar_position: 17
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Assumptions*,
> *Optional @Property Attributes* (`tries`) and *Arbitrary Provider Methods*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **JDK 25 javadoc**
> for `java.math.BigDecimal.equals` and `compareTo`.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **"Test oracle" is a term from the testing literature, not from jqwik's documentation.**
> The API used to express it is jqwik's and is cited; the vocabulary is not, and this page does
> not pretend otherwise.
> ⚠️ **No sandbox and no test run on this machine** — Java source only, never its output.

**There is a class of property that sidesteps the whole "what law does this obey" problem, and
it is the strongest kind you can write. Instead of stating a rule, you state a *comparison*:
against an implementation so simple it is obviously right, or against a checker for an answer
you could not have computed yourself. Neither requires you to know what the output should be,
both catch defects no invariant would, and the first has a use in a working codebase that
justifies the whole technique on its own — a refactor where the model is the code you are about
to delete. The third comparison, relating two runs of the same function to each other, is
[04e](04e-metamorphic-and-contract-tests.md).**

## The model: a slow, obviously-correct second implementation

If you can write a version of the function that is unarguably correct and unusably slow, you
have an oracle, and the property is a one-liner.

```java
@Property
void theIndexedLookupAgreesWithALinearScan(
        @ForAll("catalogues") List<Product> catalogue,
        @ForAll("skus") String sku) {

    ProductIndex index = ProductIndex.build(catalogue);   // the thing under test

    Optional<Product> expected = catalogue.stream()       // the model: obviously right
            .filter(p -> p.sku().equals(sku))
            .findFirst();

    assertThat(index.find(sku)).isEqualTo(expected);
}
```

This is the property to reach for whenever the production code is fast *because* it is clever:
an index, a cache, a bitset, an incremental total, a memoised computation, a hand-rolled binary
search, a sliding window. In every one of those the clever version exists only as an
optimisation of something simple, and the something simple is your model.

Three rules make the difference between a model property that finds bugs and one that does not.

**The model must be independently written, not extracted from the implementation.** If you
refactor the shared logic into a helper and call it from both sides, you have proved that the
helper equals itself. The model should look *different* — a stream where production has a loop,
a `HashMap` where production has an open-addressed array.

**The model must be obviously correct at a glance, not merely simpler.** A model with its own
edge cases is a second thing to debug, and when the property goes red you will not know which
side is wrong. If you find yourself writing a test for the model, the model is too clever.

**Slow is allowed; that is the point.** An `O(n²)` model against an `O(n log n)` implementation
is fine at 1000 tries over lists of tens of elements, and it is not fine over lists of tens of
thousands — which is a reason to constrain the generator's size, not a reason to make the model
faster. See [12 · The cost](12-the-cost.md).

## The special case that pays for itself: the old implementation

The highest-value use of a model property in a working codebase is a refactor. The model is the
code you are about to delete.

```java
@Property(tries = 5_000)
void theNewRatingEngineAgreesWithTheOldOne(@ForAll("policies") Policy policy) {
    assertThat(newEngine.rate(policy))
            .isEqualByComparingTo(legacyEngine.rate(policy));
}
```

Keep both implementations in the tree behind the property until the property has survived a
few thousand tries per commit for as long as you can stand, then delete the old one and the
property together. This is a different tool from an example-based characterisation test: the
characterisation test pins the twelve behaviours you noticed, and the property pins the whole
input domain, including the branches nobody documented. When it goes red, the shrunk sample is
the exact policy shape whose behaviour you were about to change, which is precisely the artefact
a refactor needs and never has.

⚠️ Be honest about what this property asserts: *the new code does what the old code did*,
bugs included. If the old behaviour is wrong, the property will hold you to the bug. That is
usually what you want during a refactor and never what you want during a rewrite, and knowing
which of the two you are doing is the whole decision.

## Verification without computation: hard to produce, easy to check

A large family of functions produces answers that are expensive to compute and cheap to
*verify*. You do not need a model for those — you need a checker.

```java
@Property
void theSchedulerProducesAValidAssignment(
        @ForAll("jobSets") List<Job> jobs, @ForAll("workerSets") List<Worker> workers) {

    Assume.that(Scheduler.isFeasible(jobs, workers));
    Assignment result = scheduler.assign(jobs, workers);

    // no attempt to say what the assignment should be — only that it is legal
    assertThat(result.assignedJobs()).containsExactlyInAnyOrderElementsOf(jobs);
    result.perWorker().forEach((worker, assigned) ->
            assertThat(totalHours(assigned)).isLessThanOrEqualTo(worker.capacity()));
}

@Property
void theShortestPathIsAPathAndIsNotLongerThanAnyPathWeCanConstruct(
        @ForAll("graphs") Graph graph, @ForAll("nodePairs") Tuple2<Node, Node> pair) {

    Optional<Path> shortest = graph.shortestPath(pair.get1(), pair.get2());
    Assume.that(shortest.isPresent());

    assertThat(graph.isValidPath(shortest.get())).isTrue();          // it is a path
    assertThat(shortest.get().length())
            .isLessThanOrEqualTo(graph.anyPath(pair.get1(), pair.get2()).length());  // and no worse
}
```

Sorting, routing, packing, scheduling, allocation, regex matching, compression and constraint
solving all sit in this family. The pattern has two halves and both are needed: **the answer is
well-formed**, and **the answer is at least as good as one you can produce trivially**. The
second half is what stops `return Collections.emptyList()` from passing.
## Where this connects

- The four mechanical relations are [04 · Finding properties](04-finding-properties.md) and
  [04b · Invariants and order-independence](04b-invariants-and-order-independence.md); the
  weaker moves are [04c · When no law is obvious](04c-when-no-law-is-obvious.md).
- Relating two runs to each other when there is no oracle at all, and jqwik's documented
  contract-test mechanism, are
  [04e · Metamorphic relations and contract tests](04e-metamorphic-and-contract-tests.md).
- `@Provide` and the arbitraries `catalogues`, `policies` and `graphs` assume are
  [05 · Generators](05-generators.md); composing them is
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- The `Assume.that` guarding the feasibility precondition above, and its discard ratio, is
  [05b · Constraining generation](05b-constraining-generation.md).
- The `tries = 5_000` on the refactor property, and what it costs, is
  [03c · Attributes and defaults](03c-attributes-and-defaults.md) and
  [12 · The cost](12-the-cost.md).
- Reading the shrunk sample the model property hands you is
  [03b · Reading the failure report](03b-reading-the-failure-report.md); why it is minimal is
  [06 · Shrinking](06-shrinking.md).
- Where all this pays best — parsers, money, sorting, caches — is
  [10 · Where it pays](10-where-it-pays.md).

## Gotchas

**★ A model extracted from the implementation proves that the code equals itself.**
The refactoring instinct — "both sides need the same rounding logic, pull it into a helper" — is
exactly wrong here. The value of a model property is the *independence* of the two computations,
and sharing any code destroys it silently: the property stays green, the suite still reports it,
and it can no longer fail. If review pressure pushes toward deduplication, write the reason in a
comment on the model: duplication is the mechanism.

**★ A model property tells you the two disagree, not which one is wrong — and on a refactor that is a coin flip.**
The report gives you a shrunk input and two different outputs. If the model is genuinely
obvious, the implementation is wrong; if the model is merely simpler, you now have two
suspects. This is why "obviously correct at a glance" is a hard requirement rather than a
preference, and why a model you had to debug is worse than no model.

**★ An old-versus-new property pins the old bugs, and somebody will delete the property instead of understanding the failure.**
When the property goes red on a genuine bug fix — the new engine deliberately rounds
differently — the correct response is to narrow the property (assume away the case that changed)
or to retire it, with a commit message that says which behaviour changed and why. The response
you will actually see is `@Disabled` or deletion. Decide up front what the property's exit
criterion is: it dies when the old implementation dies, and not before.

**★ A verification property with no "at least as good as" clause is satisfied by returning nothing.**
`assertThat(result.isValid()).isTrue()` on a scheduler passes for an assignment that schedules
zero jobs, on a compressor that returns the empty stream, on a router that returns no route. The
well-formedness half is necessary and never sufficient; you need a second assertion that the
answer is at least as good as a trivially-constructible one, or that every input element is
accounted for. This is the single most common way this pattern is written wrong.

**★ `Assume.that(Scheduler.isFeasible(...))` calls production code to decide which inputs to test, so a bug in feasibility hides bugs in assignment.**
Guarding a property with a predicate from the same codebase is convenient and circular: if
`isFeasible` wrongly rejects a class of input, the property never sees it, and the report shows
a healthy `checks` count. Prefer generating feasible inputs by construction — generate the
workers first, then jobs that fit — which is a `flatMap` in
[05c](05c-composing-arbitraries.md), and it removes both the circularity and the discards.

**★ Comparing two implementations with `assertThat(a).isEqualTo(b)` on `BigDecimal` compares scale, and two correct engines may legitimately differ in scale.**
The old engine returns `10.0`, the new one `10.00`, and `BigDecimal.equals` calls that a
difference. Use `isEqualByComparingTo` for value comparison — and if the scale genuinely matters
to the consumer, assert it separately and deliberately rather than getting it by accident
through `equals`.
**★ A model property over a cache is only meaningful if the property exercises eviction, and the default generator will not.**
The obvious model for a cache is a `HashMap`, and the obvious property is "the cache agrees
with the map". It is green forever if the generated key set never exceeds the cache's capacity —
which is the normal outcome, because capacity is usually hundreds and a generated list is
usually short. The interesting behaviour is entirely on the other side of the eviction
threshold. Either constrain the key space so collisions and evictions are common, or build the
cache with a capacity of two or three in the test. A model property that never crosses the
threshold is a `HashMap` test.

**★ A model written in a stream and an implementation written as a loop can still share a bug through a helper neither of them owns.**
Independence has to hold all the way down. If both sides call `Money.round(...)`, a wrong
rounding mode is invisible to the property no matter how different the two traversals look. When
you write a model, list the collaborators both sides touch; anything on both lists is outside
the property's reach and needs its own test.

## Interview questions

**★ What is a test oracle, and when do you have one?**
An oracle is anything that can tell you whether an output is correct without you having to
compute the output yourself. You have one more often than you think: a slow but obviously
correct implementation, a checker that validates an answer, the previous version of the code you
are refactoring, an independent library, or the inverse function. The point of naming it is that
property-based testing is usually taught as "find the law", and the law is the hard part; if you
have an oracle you can skip that step entirely and write `assertThat(fast(x)).isEqualTo(slow(x))`,
which is a stronger property than most laws you would have invented. The discipline is that the
oracle must be independent of the implementation — the moment they share code, the property
compares a thing with itself and cannot fail.

**★ You are rewriting a rating engine that has no tests. How do you use properties to make that safe?**
I keep the old implementation and make it the oracle. One property, one generated `Policy`, an
assertion that the two engines produce the same rate, and a deliberately high `tries` — this
runs on every commit while the rewrite is in progress. What that buys me over characterisation
tests is coverage of the branches nobody documented: the old engine has behaviour for policy
shapes no example test ever named, and the generator will find them. When it goes red I get a
shrunk `Policy` that is the minimal shape where the two disagree, which is exactly the artefact
I need to decide whether the difference is a fix or a regression. Two disciplines make it work:
the generator has to cover the real domain — I would check that with `Statistics` rather than
assume it — and the property has to have a stated end, because it pins the old bugs as well as
the old behaviour. It dies when the old engine is deleted.

**★ Your model and your implementation disagree only on inputs with more than fifty elements. What is your first hypothesis?**
That the disagreement is not about size but about something size makes likely — and I would use
shrinking to find out rather than reasoning about it. jqwik will minimise the failing input, so
if the shrunk sample is still fifty elements, size genuinely matters and I am probably looking
at an overflow, an accumulation-order difference in floating-point or `BigDecimal` rounding, or
a threshold in the implementation where it switches strategies (insertion sort below a size,
merge sort above it, a batch flush at a fixed count). If the shrunk sample comes back with three
elements, the original failure was not about size at all and I was reading a coincidence of the
generator's distribution. That is the distinction the `Shrunk Sample` and `Original Sample`
blocks in [03b](03b-reading-the-failure-report.md) exist to let you make.

{/* FOOTER */}
**★ How do you decide how long to keep an old-versus-new property alive, and what is the cost of getting that wrong?**
Its lifetime is exactly the lifetime of the old implementation, and I would write that into the
commit that adds it. Keeping it too long is the expensive mistake: the old engine stays in the
build, every genuine behaviour change now requires a decision about the property, and after a
few of those somebody adds an assumption that quietly excludes the interesting inputs. Deleting
it too early is cheaper but not free — you lose the safety net during the tail of the migration,
which is when the odd policy shapes turn up. What I actually watch is whether the property has
falsified anything recently: a property that has been green through a thousand commits and five
thousand tries each has told me what it can tell me, and the remaining value is mostly
insurance. That is the point to delete both the property and the old engine in one commit, so
that the deletion is reviewable as a single decision rather than as an orphaned test somebody
removes six months later without knowing why it existed.

{/* FOOTER */}
