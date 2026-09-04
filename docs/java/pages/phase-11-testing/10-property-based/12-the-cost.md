---
title: "A property is a thousand test executions wearing one annotation, and the multipliers stack in ways that are invisible in the source — generation, edge-case permutations, discarded draws, a model that does the work twice, and a shrink search that only runs on the day everything is red, which is the day you are waiting"
sidebar_label: "12 · The cost"
sidebar_position: 40
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Optional @Property
> Attributes* (`tries`, `maxDiscardRatio`, `shrinking`, `edgeCases`), *Property Defaults*,
> *jqwik Configuration* and *Result Shrinking*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox, no build and no test run on this machine.** Every number below is either a
> documented default or arithmetic over documented defaults. **There is no measurement here** —
> no timing, no suite duration, no before-and-after.

**The decision to write a property is a decision to run a test a thousand times, and that number
is the smallest of the multipliers involved. This page is the bill, itemised, and the order in
which to attack it — because the reflex fix, dropping `tries` globally, is the one that costs the
most for what it saves.**

## The base number

> *"If not specified differently, jqwik will run 1000 tries, i.e. a 1000 different sets of
> parameter values and execute the property method with each of those parameter sets."*

```properties
jqwik.tries.default = 1000
```

So a property is, by default, **a thousand executions of its body plus a thousand rounds of value
generation**. A property whose body takes a millisecond is a one-second test. A property whose
body builds a Spring context, hits a container, or serialises a large object graph is not a test
you can afford a thousand of, and that fact is entirely invisible when reading the annotation.

## What each try actually costs

Four components, and people account for the first one only.

1. **Generation.** Building the values. Cheap for an `int`, not cheap for a recursive structure
   bounded at four children and four levels — that is up to 256 leaves *constructed per try*
   ([05c7](05c7-a-recursive-generator-you-would-actually-write.md)).
2. **Your property body.** Whatever the test does. If it is a model property, this is *two*
   implementations, and the model is deliberately the slow one
   ([04d](04d-models-and-oracles.md)).
3. **Discarded draws.** An `Assume` that rejects a value still paid for generating it. The
   `maxDiscardRatio` default of 5 means a property may legally generate up to five values for
   every one it checks before jqwik fails it — so a heavily filtered property can cost five times
   its `tries` in generation while checking the stated number
   ([05b2](05b2-filtering-assumptions-and-discards.md)).
4. **Edge-case permutations.** jqwik mixes in edge cases for the full parameter set by default
   (`EdgeCasesMode.MIXIN`), and the report's `edge-cases#total` counts *permutations across
   parameters* — so it grows multiplicatively with the number of `@ForAll` arguments
   ([03b](03b-reading-the-failure-report.md)).

## And then the failure path

None of the above is what makes a red build slow. Shrinking is:

- Every shrink candidate **re-runs the property body**.
- The default `ShrinkingMode.BOUNDED` is documented as *"tried for 10 seconds maximum and then
  times out"* — **per property**.
- So a run with a dozen failing properties can spend on the order of two minutes purely
  searching, on top of the failures themselves.

That asymmetry is the single most surprising thing about property suites in practice: **they are
cheap when green and expensive when red**, which is the opposite of the intuition built by
example-based suites, and it hits on the day someone is watching CI. The full treatment is
[06b · What shrinking costs you](06b-what-shrinking-costs-you.md).

## The levers, in the order to reach for them

**1 · Delete the properties that cannot fail.** A tautological property
([11 · Where it does not pay](11-where-it-does-not-pay.md)) costs a thousand executions and
defends nothing. This is the only lever that is pure profit, and it is the last one most teams
try.

**2 · Move the property to the pure part.** A property over a repository is a thousand database
round trips to test somebody else's code. The row mapping either side of it is pure, has a real
round-trip law, and costs nothing to run a thousand times.

**3 · Shrink the values, not the tries.** Container size defaults and recursion depth multiply;
`tries` only adds. A recursive generator at depth 6 and branching 8 builds a quarter of a million
leaves per value, so bounding it to depth 4 and branching 4 is a far larger saving than halving
`tries`, and it costs no coverage of the input *space* — only of its extremes.

**4 · Lower `tries` on the specific property, with a comment.**

```java
// Model property: runs the naive O(n²) implementation as an oracle, so each try is expensive.
// 200 tries is a deliberate trade — see 12 · The cost.
@Property(tries = 200)
void keysetPagingMatchesTheNaiveQuery(@ForAll("catalogues") List<Product> all) { ... }
```

The comment is not decoration. A bare `tries = 200` reads as arbitrary and gets copied to
properties that did not need it.

**5 · Only then consider the project default.** `jqwik.tries.default` applies to every property,
including the cheap ones that were earning their keep, so lowering it globally to pay for a few
expensive ones weakens the whole suite to subsidise its worst members. If you do lower it,
consider a deeper scheduled run — a nightly job with `jqwik.tries.default` raised — so the
exploration is not lost, only moved.

⚠️ `@PropertyDefaults` sets `tries` for a container class and is the right granularity when a
whole test class is expensive for the same reason.

## What the cost buys, and when it does not

The thousand tries are what find the case you did not think of. That is the entire product, and
it is worth real money in the domains of [10](10-where-it-pays.md). What the thousand tries
cannot buy is confidence in a property that restates the implementation — that one is a thousand
times zero. **Cost is only ever assessable against what the property could catch**, which is why
this page comes after the two that argue about targets rather than before them.

## Where this connects

- The failure-path cost in full — why side effects and lazy footnotes are charged per shrink
  candidate — is [06b · What shrinking costs you](06b-what-shrinking-costs-you.md).
- Capping the shrink search when it is the dominant cost is
  [06c · Controlling the shrinker](06c-controlling-the-shrinker.md).
- The properties worth paying for are [10 · Where it pays](10-where-it-pays.md) and
  [10b · Where it pays: ordering and state](10b-where-it-pays-ordering-and-state.md); the ones
  that are pure cost are [11 · Where it does not pay](11-where-it-does-not-pay.md).
- `tries`, `maxDiscardRatio` and the rest of the attribute surface are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md); the configuration file is
  [02c4 · jqwik's configuration surface](02c4-jqwiks-configuration-surface.md).
- Generator size, the largest multiplier, is
  [05a · The defaults you inherit](05a-the-defaults-you-inherit.md) and
  [05c7 · A recursive generator you would actually write](05c7-a-recursive-generator-you-would-actually-write.md).

## Gotchas

**★ Lowering `jqwik.tries.default` project-wide is the cheapest-looking fix and the most expensive one.**
It buys back time from every property equally, including the cheap ones whose thousand tries were
free and were the reason the suite catches anything. The properties that made the build slow are
usually a handful of expensive ones, and they are the ones that should carry the annotation. A
global default of 100 turns a suite of strong properties into a suite of weak ones, silently, and
nothing in any individual test file records that it happened.

**★ The cost of a property is not visible at its call site, and code review has no signal for it.**
`@Property void x(@ForAll Foo foo)` reads like one test. Whether it is a one-second test or a
four-minute one depends on the body, the generator's size defaults, the discard ratio and the
parameter count — none of which is on that line. This is the argument for a comment whenever
`tries` is set, and for treating "how expensive is a single execution of this body?" as a review
question for any property that touches more than pure data.

**★ Adding a `@ForAll` parameter multiplies the edge-case permutations rather than adding to them.**
The report's `edge-cases#total` counts combined permutations across parameters, so a property with
four parameters that each have a handful of edge cases can generate a surprising number of
mixed-in edge-case sets before a single random value is drawn. It is rarely the dominant cost, and
it is a real one that grows in the direction people do not expect — and it is another reason to
prefer one well-designed aggregate parameter over five loose ones.

**★ A filtered property pays for the values it throws away, and the default ratio permits five wasted draws per checked one.**
`maxDiscardRatio` defaults to 5, so a property using assumptions can legitimately generate five
thousand values to check a thousand. That is invisible in the timing intuition — the property
"ran a thousand times" — and it is why a heavily-assumed property is often several times more
expensive than its neighbour with the same `tries`. Generating the qualifying value directly
removes the cost and the risk of the ratio breach at the same time.

**★ A model property is at least twice the work and the expensive half is the one you added.**
The oracle is deliberately the naive implementation, so a model property runs the fast path plus
the slow path, a thousand times. That is exactly the right trade — it is the highest-confidence
property available — but it means model properties are the natural home of a deliberate `tries`
reduction, and treating them like ordinary properties is how one good test comes to dominate a
suite's runtime.

**★ Timing a property suite on a green build tells you nothing about the build you actually care about.**
Shrinking only runs on failure, and the `BOUNDED` mode is allowed ten seconds per failing
property. So the suite you benchmarked and the suite that runs when someone breaks something are
different workloads, and the gap grows with the number of properties. Capacity decisions —
CI agent size, timeouts, whether the suite runs on every push — should be made against the red
case, because the red case is when waiting hurts.

**★ "Just run fewer tries in CI and more locally" is backwards.**
The instinct is to keep the local loop fast, but the local loop is where a developer is watching
and a failure is cheapest to act on, and CI is where a machine has time. If the two are going to
differ, the deeper run belongs on the machine that nobody is waiting for — a scheduled job with
`jqwik.tries.default` raised — and the fast run belongs where the human is. Either way it should
be a deliberate, documented split, not two config files that drifted apart.

## Interview questions

**★ What does a property test actually cost, and how do you decide it is too much?**
By default a thousand executions of the property body plus a thousand rounds of generation, and
generation is not free — a recursive or collection-heavy generator can construct hundreds of
objects per try. On top of that, assumptions mean paying for discarded draws, up to five per
checked value before jqwik fails the property on `maxDiscardRatio`, and edge-case permutations
grow with the number of parameters. But the number that decides "too much" is usually the failure
path: every shrink candidate re-runs the body, and the default bounded mode gives that search up
to ten seconds per failing property. So the suite is cheap green and expensive red, and the red
case is the one to plan against. I would call it too much when a single execution of the body is
expensive for reasons unrelated to the property — a container, a context, real I/O — because then
I am paying a thousand times for something that a handful of examples would establish, and the
right move is to push the property down onto the pure part.

**★ Your build went from four minutes to eleven after a property-testing push. What do you change first?**
Not `tries` — that is the reflex and it is the last lever, not the first. First I would find the
properties that cannot fail, because a tautological property is a thousand executions defending
nothing and deleting it is pure profit with no loss of coverage. Second, the ones over I/O: a
property against a repository is a thousand round trips testing the database, and moving it to the
row mapping keeps the law and drops the cost to nothing. Third, generator size, because size
multiplies where tries only adds — a recursive generator two levels too deep can cost more than
every `tries` setting in the project combined. Only then would I set `tries` on specific
expensive properties, with a comment saying why, and I would resist lowering
`jqwik.tries.default` globally, because that pays for a few bad properties by weakening every
good one and leaves no record in any test file that it happened.

**★ Is it reasonable to run properties with different settings in CI than locally?**
Yes, but usually in the opposite direction to the instinct. People propose fewer tries in CI to
keep the pipeline fast, and that puts the shallow run on the machine with time and patience and
the deep run on the developer who is waiting. I would keep the normal run identical in both
places so a local green means the same thing as a CI green, and add depth where nobody is
waiting — a scheduled job with the default raised, which is exactly where a thousand-try property
becomes a ten-thousand-try one for free. The thing I would insist on either way is that the
difference is deliberate and documented, because the failure mode here is two configuration files
that drifted apart until a property that only ever ran deeply somewhere started catching things
nobody could reproduce.

{/* FOOTER */}
