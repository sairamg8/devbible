---
title: "sort with a random comparator is the most common wrong answer to \"shuffle this array\", and the reason is not a measured bias but a contract violation — MDN puts the program's behaviour outside what is defined, and the JDK is permitted to throw"
sidebar_label: "10c · The random comparator shuffle"
sidebar_position: 10.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN,
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
> — the five comparator properties and the not-well-defined consequence, quoted verbatim — and the
> JDK 25 javadocs for
> [`Comparator`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Comparator.html)
> (the symmetry, transitivity and consistency requirements) and
> [`List.sort`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html#sort(java.util.Comparator))
> (the optional `IllegalArgumentException`), also verbatim. ⚠️ **No distribution below is measured
> and no engine's behaviour is named** — the argument is entirely from the documented contracts,
> which is both stronger and honest. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**`arr.sort(() => Math.random() - 0.5)` is the answer that gets given, gets nodded at, and is
wrong — and the way to say so is not "it is biased, I read a study" but "it violates the comparator
contract, so the specification declines to define what it does."** That distinction matters in an
interview because the contract argument is checkable on the spot and the bias figure is not. The
comparator returns a different answer for the same pair on successive calls, which breaks MDN's
*stable* property; it is not transitive; and it is not reflexive. MDN's consequence sentence is
blunt. This page is the full argument, the mechanism behind why the intuition feels right and is
not, the Java version where the platform is allowed to throw rather than misbehave quietly, and the
sort-based shuffle that *is* correct — sorting by a random key, which is a different program with
different caveats. The comparator contract as a subject belongs to
[02d](02d-stability-and-the-comparator-contract.md); the shuffle argument is here.

## The one-liner, and why it is believable

```ts
// ⛔ NOT A SHUFFLE.
const shuffled = [...arr].sort(() => Math.random() - 0.5);
```

The intuition is seductive and almost coherent: sorting rearranges an array; the comparator decides
the rearrangement; if the comparator is random, the rearrangement is random. It is one line, it has
no indices, and it cannot go out of bounds. Every reason to like it is a reason about the *shape* of
the code and none is a reason about the distribution.

## Which of the five properties it breaks

MDN states the comparator's requirements as five named properties:

> *"More formally, the comparator is expected to have the following properties, in order to ensure
> proper sort behavior:"* — *Pure*: *"The comparator does not mutate the objects being compared or
> any external state."* · *Stable*: *"The comparator returns the same result with the same pair of
> input."* · *Reflexive*: `compareFn(a, a) === 0`. · *Anti-symmetric*: *"`compareFn(a, b)` and
> `compareFn(b, a)` must both be `0` or have opposite signs."* · *Transitive*: *"If `compareFn(a, b)`
> and `compareFn(b, c)` are both positive, zero, or negative, then `compareFn(a, c)` has the same
> positivity as the previous two."*

Take them one at a time against `() => Math.random() - 0.5`:

- **Stable — broken outright.** The comparator ignores its arguments entirely, so the same pair is
  overwhelmingly unlikely to compare the same way twice. This is the cleanest violation and the one
  to lead with.
- **Reflexive — broken.** `compareFn(a, a)` must be `0`. `Math.random() - 0.5` is a continuous draw;
  the value `0.5` has no special status and nothing forces the result to zero. An element does not
  compare equal to itself.
- **Anti-symmetric — broken.** `compareFn(a, b)` and `compareFn(b, a)` are two independent draws, so
  nothing prevents both from being positive.
- **Transitive — broken.** With three independent draws, `a > b` and `b > c` and `c > a` is a
  perfectly reachable combination. There is no consistent ordering for the sort to converge on.
- **Pure — arguably broken too, and this one is worth a second's thought.** The comparator mutates
  no *element*, so it looks pure. But `Math.random()` advances the engine's internal generator
  state, which is external state by any reasonable reading. ⚠️ MDN does not adjudicate this case,
  so treat it as an observation rather than a citation — the other four are unambiguous and are all
  the argument needs.

And then the consequence, which is the sentence to quote:

> *"If a comparing function does not satisfy all of purity, stability, reflexivity, anti-symmetry,
> and transitivity rules, as explained in the description, the program's behavior is not
> well-defined."*

> *"Due to this implementation inconsistency, you are always advised to make your comparator
> well-formed by following the five constraints."*

**"Not well-defined" is a stronger and more useful claim than "biased".** Biased means there is a
distribution and it is the wrong one. Not-well-defined means the specification has stopped making
promises: the result may differ between engines, between engine versions, and between input sizes on
the same engine, and none of those differences is a bug in the engine.

## Why the intuition fails, mechanically

It is not enough to cite the contract; the interviewer will ask *why* a random comparator does not
produce a random order, and the honest answer is about the sorting algorithm's control flow.

A sorting algorithm is a decision tree. It performs some sequence of comparisons and, at each one,
branches — and the branching structure was designed so that consistent answers drive the array
towards sorted order. Feed it inconsistent answers and it still executes that same control flow; it
just does so on garbage. The permutation you get out is a function of **which pairs the algorithm
happened to compare, in what order, and how it moves elements in response** — none of which is a
property of your comparator.

Three concrete consequences follow, and all three are mechanism rather than measurement:

- **Elements are not compared equally often.** A merge sort compares a given element `Θ(log n)`
  times; an insertion pass over a short run compares its elements a number of times that depends on
  where they already are. An element that participates in fewer comparisons has fewer opportunities
  to move, so its final position stays correlated with its starting position. That correlation *is*
  the bias, and it is structural.
- **The number of comparisons is not a free parameter.** A comparison sort makes `Θ(n log n)`
  comparisons. Each yields at most one bit, so the algorithm consumes about `log2(n!)` bits — the
  same order as a uniform shuffle needs. The budget is not the problem; the **mapping** from those
  bits to permutations is, because the decision tree's leaves were laid out to be sorted outputs,
  not to be an even partition of the `n!` orderings.
- **The implementation is free to vary.** Engines switch strategies by array length, may cache or
  short-circuit, and may stop early on a run that looks ordered. That is precisely MDN's
  *"implementation inconsistency"*, and it is why the same one-liner can behave differently on a
  10-element array and a 10,000-element one.

🔴 What you must **not** do is assert a specific distribution — "the first element stays first about
`x`% of the time", "on engine E the identity permutation appears `y` times more often". Those
numbers are engine- and version-specific, none is documented, and none was measured here. The
contract argument needs no number, which is exactly its advantage.

## The Java version, where the platform may refuse

```java
// ⛔ Same mistake, and here the platform is allowed to complain.
list.sort((a, b) -> ThreadLocalRandom.current().nextBoolean() ? 1 : -1);
```

Java states the comparator contract as three requirements on `compare`:

> *"The implementor must ensure that `signum(compare(x, y)) == -signum(compare(y, x))` for all `x`
> and `y`."*

> *"The implementor must also ensure that the relation is transitive:
> `((compare(x, y)>0) && (compare(y, z)>0))` implies `compare(x, z)>0`."*

> *"Finally, the implementor must ensure that `compare(x, y)==0` implies that
> `signum(compare(x, z))==signum(compare(y, z))` for all `z`."*

A random comparator violates all three. And unlike JavaScript, the JDK documents an outcome for it:

> *"`IllegalArgumentException` - (optional) if the comparator is found to violate the `Comparator`
> contract"* — `List.sort(Comparator)`

**Read "(optional)" precisely.** It does not mean the exception is unlikely; it means the
implementation is *permitted* to detect the violation and throw, and is not *required* to. So a
random comparator in Java may throw, or may quietly produce an arbitrary ordering, and both are
conforming. The reason detection is even possible is stated in the same javadoc:

> *"This implementation is a stable, adaptive, iterative mergesort that requires far fewer than
> n lg(n) comparisons when the input array is partially sorted, while offering the performance of a
> traditional mergesort when the input array is randomly ordered."*

That merge sort identifies ascending and descending runs and merges them, and merging maintains
invariants that an inconsistent comparator can be caught contradicting. A quicksort would have no
such moment of contradiction — which is why the same misuse on a primitive array, sorted by a
different algorithm, has no comparator to violate in the first place.

## What *is* correct: sort by a random key

There is a sort-based shuffle that works, and it is a different program:

```ts
function shuffleByKey<T>(a: readonly T[]): T[] {
  return a
    .map((value) => ({ value, key: Math.random() }))
    .sort((x, y) => x.key - y.key)
    .map((entry) => entry.value);
}
```

This is decorate–sort–undecorate. The comparator now compares two **fixed numbers**, so it is pure,
stable in MDN's sense, reflexive, anti-symmetric and transitive — every property restored. Assigning
each element an independent uniform key and ordering by key gives a uniformly random permutation,
because every ordering of the keys is equally likely.

Three caveats, and they are why Fisher–Yates remains the answer:

- **Ties.** Two elements drawing the same key would be ordered by the sort's stability, that is, by
  input order — which conditions the result on the input. With floating-point keys a collision is
  extraordinarily unlikely but not impossible, and with small integer keys (`nextInt(1000)`) it is
  routine and the shuffle is then measurably conditioned on input order. Draw keys from a large
  space, and if exactness matters, break ties by drawing again.
- **Cost.** `Θ(n log n)` time and `Θ(n)` extra space, against Fisher–Yates' `Θ(n)` and `Θ(1)`.
- **It is three passes and a temporary object per element.** Fisher–Yates is four lines.

Where it genuinely wins is when you cannot mutate and cannot index — shuffling rows in a database
(`ORDER BY random()`), or shuffling a distributed dataset where a random key is also the shuffle
partition key. There the sort is happening anyway.

## Gotchas

**★ Symptom: a code review approves `sort(() => Math.random() - 0.5)` because "the output looks
shuffled".** Cause: eyeballing a permutation cannot detect a non-uniform distribution, and for short
arrays a biased shuffle looks exactly like a fair one. Fix: reject it on the contract, not on
appearance. MDN's *"the program's behavior is not well-defined"* ends the discussion without needing
a number.

**★ Symptom: the one-liner is defended as "random enough for a carousel".** Cause: conflating "not
uniform" with "not important". Fix: often it genuinely does not matter — but the cost of the correct
version is four lines, so there is nothing to trade. The place it *does* matter is anything a user
can observe repeatedly: a "random" product recommendation strip that shows the same first item to
everyone every time is a visible defect, and structural correlation with input order is exactly the
failure mode that produces it.

**★ Symptom: `sort((a, b) => Math.random() - 0.5)` used on the original array and the original is
now reordered.** Cause: `Array.prototype.sort` sorts in place and returns the same array. Fix:
`[...arr].sort(…)`, or `toSorted` where available. Two bugs in one line, and the mutation one is the
one that reaches production.

**★ Symptom: a Java service throws `IllegalArgumentException` from deep inside a sort, intermittently
and only under load.** Cause: a comparator that is inconsistent — commonly one reading mutable state
that another thread is updating mid-sort, which is the *purity* violation rather than the random
one, but the detection path is identical. Fix: snapshot the sort key onto each element before
sorting, and compare the snapshot. That is the same decorate–sort–undecorate above, applied for the
same reason.

**★ Symptom: a random comparator that returns `0` sometimes, to "make it fairer".** Cause: trying to
patch anti-symmetry by hand. Fix: there is nothing to patch. Returning `0` for a pair asserts they
are equal, which the sort may then rely on to skip work — a stable sort is *required* not to reorder
elements that compare equal, so more zeroes means *less* movement, not more fairness.

**★ Symptom: `ORDER BY random()` in a query that also has a `LIMIT`, and the results repeat.**
Cause: not a comparator problem — the database is free to evaluate the random expression once per
row or to reuse a cached plan, and correlated subqueries make this worse. Fix: this is a database
question rather than a comparator question, and the honest answer in an interview is to name it as
one; the sort-by-random-key argument above is the reason the general approach is sound, but the
per-engine evaluation rules decide whether a particular query realises it.

**★ Symptom: someone shuffles by `sort` and then complains that it is slower than expected on a
large array.** Cause: `Θ(n log n)` comparisons, each one a function call into the comparator, versus
`Θ(n)` swaps. Fix: Fisher–Yates. Do not quantify the gap — state the complexity and the fact that
each comparison is a call, and leave it there.

## Interview questions

**★ Why is `arr.sort(() => Math.random() - 0.5)` not a shuffle?**
Because it is not a valid comparator, and a sort's behaviour is only defined for valid ones. It
breaks MDN's *stable* property — the same pair does not compare the same way twice — as well as
reflexivity, anti-symmetry and transitivity. MDN's consequence is explicit: *"If a comparing
function does not satisfy all of purity, stability, reflexivity, anti-symmetry, and transitivity
rules … the program's behavior is not well-defined."* So it is not that the distribution is a
slightly wrong one; it is that there is no specified distribution at all, and the result may differ
between engines and between input sizes. The correct answer is Fisher–Yates, which has exactly `n!`
equally likely execution paths.

**★ Suppose the comparator *were* well-defined. Would a random sort be uniform then?**
No, and this is the question that separates the memorised answer from the understood one. Even given
a consistent random relation, the permutation produced is determined by which pairs the algorithm
compares and how it moves elements in response — its decision tree — and that tree was constructed
to produce sorted outputs, not to partition the `n!` orderings evenly. Elements that participate in
fewer comparisons move less, so the output stays correlated with the input order. Randomness in the
comparator does not become uniformity in the permutation, because the algorithm sits in between.

**★ Is there a correct way to shuffle using a sort?**
Yes: give each element an independent uniform random key, sort by the key, discard the keys. The
comparator then compares two fixed numbers and satisfies every property. It is uniform because every
ordering of `n` independent uniform keys is equally likely. The caveats are ties — resolved by the
sort's stability, which conditions the output on input order, so draw from a large key space — and
cost, `Θ(n log n)` time with `Θ(n)` extra space against Fisher–Yates' `Θ(n)` and `Θ(1)`. It is the
right choice when the data is in a database or spread across machines and the sort is happening
anyway.

**★ What does "(optional)" mean in the JDK's `IllegalArgumentException` clause?**
That the implementation is permitted to detect the contract violation and throw, not that it is
required to. So an inconsistent comparator in Java can produce an exception on one input and a
silently arbitrary order on another, and both are conforming behaviour. It is the same posture as
MDN's "not well-defined", expressed as an API contract instead of a specification note — and it is
why "it didn't throw" is not evidence that a comparator is valid.

**★ Why is the contract argument better than quoting a bias percentage?**
Because a percentage is a property of one engine, one version and one array length, and it is not
documented anywhere — so quoting one is asserting something you cannot support, and an interviewer
who knows the area will ask where it came from. The contract argument is checkable from the
specification in front of you, applies to every engine, and generalises to every other comparator
misuse: the boolean comparator `(a, b) => a > b`, the subtraction comparator that overflows, the
comparator that reads mutable state. One argument, many bugs.

**★ A colleague says the random comparator is fine because they only shuffle four items. Response?**
That "not well-defined" does not acquire a definition at small sizes — it is *more* likely to bite
there, because engines commonly switch to a different strategy for short arrays, so the short case
is precisely where behaviour is least like the mental model. And the correct version for four items
is the same four lines as for four million. The only defensible version of their argument is that
the consequences of a biased order are negligible for their feature, which is a product decision and
should be stated as one rather than dressed up as a technical claim.

{/* FOOTER */}
