---
title: "A recursive generator can overflow the stack in two entirely different places — while jqwik is building the arbitrary, which lazyOf fixes, and while it is generating a value, which only a base case with sufficient probability or a bounded depth fixes — so deterministic recursion with an explicit maxDepth is the default and probabilistic recursion is the exception"
sidebar_label: "05c6 · Recursive arbitraries"
sidebar_position: 28
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Recursive Arbitraries*,
> *Probabilistic Recursion*, *Using lazy() instead of lazyOf()*, *Deterministic Recursion* and
> *Deterministic Recursion with recursive()*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1 javadoc**
> for `Arbitraries.lazy`, `Arbitraries.lazyOf` and both `Arbitraries.recursive` overloads
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Arbitraries.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every caveat and probability statement
> below is quoted or paraphrased from the guide and the javadoc; none of it is the output of a
> run here.

**[05c5](05c5-choosing-among-arbitraries.md) covered choosing between alternatives. This page
is the case where one of those alternatives *contains the whole type again* — a JSON value, an
expression tree, a nested comment thread, a directory. Recursion is where generator code stops
being obvious, because the natural construction does not merely generate badly: it throws a
`StackOverflowError` before a single value exists. jqwik gives you three tools, one of them
cached, one of them slower to shrink and one of them bounded, and the bounded one should be your
default.**

## Why the obvious version overflows

Now the alternative contains the structure itself. The guide's example builds sentences by
prepending words:

```java
@Provide
Arbitrary<String> sentences() {
    return Arbitraries.lazyOf(
        () -> word().map(w -> w + "."),
        this::sentence,
        this::sentence,
        this::sentence
    );
}

private Arbitrary<String> sentence() {
    return Combinators.combine(sentences(), word())
                      .as((s, w) -> w + " " + s);
}

private StringArbitrary word() {
    return Arbitraries.strings().alpha().ofLength(5);
}
```

The guide flags three things about it, and all three are load-bearing:

> *"It is important to use `lazyOf(suppliers)` instead of the seemingly simpler
> `oneOf(arbitraries)`. Otherwise jqwik's attempt to build the arbitrary would result in a stack
> overflow."*

> *"Every recursion needs one or more base cases in order to stop recursion at some point. Here,
> the base case is `() -> word().map(w -> w + ".")`. Base cases must have a high enough
> probability, otherwise a stack overflow will get you during value generation."*

> *"The supplier `() -> sentence` is used three times to raise its probability and thus create
> longer sentences."*

Read those as **two different stack overflows**. The first happens at *arbitrary construction
time*: `oneOf(word(), sentence())` evaluates `sentence()` eagerly, which calls `sentences()`,
which calls `sentence()`, and the recursion never reaches a generator at all. The second happens
at *value generation time*: even with `lazyOf`, if the recursive branches dominate, generation
keeps recursing and blows the stack. The first is fixed by laziness; the second by the base
case's probability. Repeating a supplier is how you tune that probability — three
`this::sentence` entries against one base case means the base case is picked roughly one time in
four at each level.

And the caveat the guide attaches, repeated verbatim in the javadoc for `lazyOf`:

> *"Never use this construct if suppliers make use of variable state like method parameters or
> changing instance members. In those cases use `lazy()` as explained below."*

The javadoc also explains why `lazyOf` is worth the caveat — it returns *"a (potentially cached)
arbitrary instance"* and *"has considerably better shrinking behaviour with recursion"* than
`lazy` combined with `oneOf` or `frequencyOf`. Caching is exactly what the caveat is about: if
your supplier closes over a parameter, the cached arbitrary may not be the one you meant.

## `lazy`: the same thing, for suppliers that close over state

```java
@Provide
Arbitrary<String> sentences() {
    Arbitrary<String> sentence = Combinators.combine(
        Arbitraries.lazy(this::sentences),
        word()
    ).as((s, w) -> w + " " + s);

    return Arbitraries.oneOf(
        word().map(w -> w + "."),
        sentence,
        sentence,
        sentence
    );
}
```

`Arbitraries.lazy(Supplier)` defers a single arbitrary — the javadoc: *"Create an arbitrary that
will evaluate `arbitrarySupplier` as soon as it is used for generating values. This is useful
(and necessary) when arbitrary providing functions use other arbitrary providing functions in a
recursive way. Without the use of `lazy()` this would result in a stack overflow."* — and the
guide's verdict on the pairing:

> *"The disadvantage of `lazy()` combined with `oneOf()` or `frequencyOf()` is its worse
> shrinking behaviour compared to `lazyOf()`. Therefore, choose `lazyOf()` whenever you can."*

Note where the `oneOf` sits in this version: at the *top*, over already-constructed arbitraries,
with the recursion hidden inside `lazy`. That is why it does not overflow at construction time,
and it is the difference between this working and the naive version not.

## `recursive`: deterministic depth instead of probability

Probabilistic recursion has an uncomfortable property — the depth is a consequence of the
weights and nobody can state it. `Arbitraries.recursive` replaces the dice with a counter:

```java
@Provide
Arbitrary<String> deterministic() {
    Arbitrary<String> lastWord = word().map(w -> w + ".");

    return Arbitraries.recursive(
        () -> lastWord,
        this::prependWord,
        0, 10
    );
}

private Arbitrary<String> prependWord(Arbitrary<String> sentence) {
    return Combinators.combine(word(), sentence).as((w, s) -> w + " " + s);
}
```

Two overloads: `recursive(base, recur, depth)` for a fixed depth and
`recursive(base, recur, minDepth, maxDepth)` — the latter `MAINTAINED` since 1.6.4 — for a
range. The javadoc states the mechanical difference from `lazy`/`lazyOf` precisely:

> *"Create an arbitrary by deterministic recursion. Mind that the arbitrary will be created by
> invoking recursion at arbitrary creation time. Using `lazyOf(Supplier, Supplier[])` or
> `lazy(Supplier)` instead will recur at value generation time."*

That sentence is the whole trade-off. `recursive` builds the entire nested arbitrary up front,
so `maxDepth` is a hard bound you can reason about and there is no chance of an overflow during
generation — but the construction cost is paid once per depth level, and a `maxDepth` of 10000
is a construction-time problem rather than a generation-time one. `lazyOf` builds nothing up
front and bounds nothing.

**Choose deterministic recursion by default.** The guide's own framing supports it: with a
generated counter *"the generated sentences will be very similar, and you can often forgo using
`Arbitraries.lazyOf()` or `Arbitraries.lazy()`"*. A bounded depth is a property of your test you
can state in review; "the base case has high enough probability" is a property you can only hope
about.

## Where this connects

- The worked example these three combinators exist for — a bounded JSON tree, and the three
  decisions inside it — is [05c7 · A recursive generator you would actually write](05c7-a-recursive-generator-you-would-actually-write.md).
- Choosing between the alternatives at each level — `oneOf`, `frequencyOf` and their shrinking
  order — is [05c5 · Choosing among arbitraries](05c5-choosing-among-arbitraries.md).
- `Combinators.combine`, used inside every `recur` function above, is
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- Why a deeply nested counter-example is so much worse than a flat one, and what shrinking can
  do about it, is [06 · Shrinking](06-shrinking.md).

## Gotchas

**★ `Arbitraries.oneOf` in a recursive generator overflows the stack before a single value is generated, and the stack trace is entirely inside jqwik.**
The guide's warning is unambiguous: *"jqwik's attempt to build the arbitrary would result in a
stack overflow"*. Because it happens at arbitrary *construction* time, the exception surfaces
while jqwik is resolving the `@Provide` method, so the trace is a thousand frames of jqwik and
your one provider method — which reads like a jqwik bug. It is not; it is `oneOf` evaluating its
arguments eagerly. Use `lazyOf` with suppliers, or `lazy` around the recursive call.

**★ A base case with too low a probability moves the stack overflow from construction time to generation time, where it looks like flakiness.**
The second documented overflow: *"Base cases must have a high enough probability, otherwise a
stack overflow will get you during value generation."* This one is probabilistic, so it fails on
some seeds and not others, which is precisely the failure mode that gets a test quarantined
instead of fixed. If you are using probabilistic recursion at all, count the branches: three
recursive suppliers against one base case is a 3:1 ratio at every level, and the depth
distribution has a long tail. `Arbitraries.recursive` with a `maxDepth` removes the failure mode
entirely.

**★ `lazyOf` caches, so a supplier that closes over a method parameter or a mutable field may hand you a generator built from a stale value.**
Both the guide and the javadoc carry the same caveat: *"Never use this construct if suppliers
make use of variable state like method parameters or changing instance members. In those cases
use `lazy(Supplier)` instead."* The javadoc's return description says why — *"a (potentially
cached) arbitrary instance"*. Nothing throws; you simply generate from a generator you did not
intend, and the property tests something adjacent to what it claims.

**★ `Arbitraries.recursive` recurs at construction time, so `maxDepth` is a construction cost as well as a value-size bound.**
The javadoc: *"the arbitrary will be created by invoking recursion at arbitrary creation time."*
A large `maxDepth` therefore builds a large nested arbitrary once, whether or not any generated
value reaches that depth. That is usually cheap and it is not free, and it is the reason
`recursive` is not simply better than `lazyOf` in every respect — it trades a generation-time
risk for a construction-time cost.

## Interview questions

**★ How do you generate a recursive data structure — say, a JSON-like tree — and what goes wrong?**
`Arbitraries.recursive(base, recur, minDepth, maxDepth)` unless there is a reason not to, because
the depth is then a number I can state in a review rather than a probability I have to reason
about. The base is the leaf arbitrary — a string, a number, a boolean; the `recur` function takes
an `Arbitrary` of the tree and returns an `Arbitrary` of a node containing it, typically via
`combine` with a list. Two things go wrong with the alternative, probabilistic approach, and
they are different failures. Using `oneOf` directly overflows the stack while jqwik is building
the arbitrary, before any value exists, and the trace is entirely inside jqwik so it reads as a
library bug; the fix is `lazyOf` with suppliers, or `lazy` wrapping the recursive call. Then,
even with `lazyOf`, a base case whose probability is too low overflows during *generation* — the
guide says so explicitly — and because that one depends on the seed it presents as an
intermittent failure. The third problem is not a crash at all: deep trees are big, big values are
slow, and every shrink attempt re-runs the property on one. A bounded depth solves all three.

**★ Why does the jqwik guide tell you to prefer `lazyOf` over `lazy`, and when must you ignore that advice?**
Shrinking. The javadoc says `lazyOf` *"has considerably better shrinking behaviour with
recursion"* than `lazy` combined with `oneOf` or `frequencyOf`, and the guide repeats it as
"choose `lazyOf` whenever you can" — which matters a lot for recursive structures, because an
unshrunk recursive counter-example is a wall of nested nodes nobody will read. You must ignore
it when your suppliers close over variable state: method parameters or mutable instance members.
Both the guide and the javadoc carry that caveat, and the reason is in the javadoc's return
type description — `lazyOf` returns a *potentially cached* arbitrary, so a supplier whose result
depends on state outside itself can be memoised against the wrong state. Nothing throws in that
case; you just get values from a generator you did not mean to build.

**★ Someone's recursive generator throws `StackOverflowError` intermittently in CI and never on their laptop. What is your diagnosis?**
Probabilistic recursion with a base case whose probability is too low. The guide names this
exact failure — *"Base cases must have a high enough probability, otherwise a stack overflow will
get you during value generation"* — and the reason it is intermittent is that whether any
particular try recurses too deep is a function of the random seed, and CI runs with a different
seed every time because it has no `.jqwik-database` to replay from. So it is not a CI-specific
problem; it is the same property failing on some seeds, and their laptop has simply not drawn a
bad one yet. The tell in the code is the ratio of recursive suppliers to base-case suppliers in
the `lazyOf` call. The fix I would push for is not tuning that ratio but replacing it:
`Arbitraries.recursive` with an explicit `maxDepth` makes the failure impossible rather than
unlikely, and turns "how deep can this get" from a probability into a number in the source.

{/* FOOTER */}
