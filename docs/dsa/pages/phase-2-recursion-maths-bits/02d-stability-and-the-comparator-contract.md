---
title: "Your merge sort is stable because of one character in the merge; the platform's sort is stable because a specification says so — and both guarantees collapse the moment the comparator you hand it breaks one of the five properties MDN says the program's behaviour depends on"
sidebar_label: "02d · Stability and the comparator contract"
sidebar_position: 2.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against MDN,
> [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
> — the default string ordering, the stability guarantee since ECMAScript 2019, and the five
> comparator properties, all quoted verbatim. ⚠️ **MDN documents no algorithm and no complexity for
> `Array.prototype.sort`**, so none is claimed here. The Java statement that `Arrays.sort` is stable
> for object arrays and unspecified for primitives is standard JDK behaviour named as mechanism; the
> JDK javadoc text was not fetched this session, so it is not quoted. Fourth file of topic 02 —
> [02c](02c-merge-sort.md) is merge sort itself. **No sandbox run.**

**Stability is the property that survives a second sort, and it is the reason a two-key ordering can
be done as two single-key sorts instead of one compound comparator.** It is also the property most
often assumed and least often checked: in your own merge sort it is one character, in JavaScript it
is a specification guarantee with a version attached, and in Java it holds for object arrays and not
for primitives. On top of that sits the comparator contract, which MDN states as five named
properties and then says, unusually bluntly, that violating any of them puts the program's behaviour
outside what is defined — which makes it the citation to reach for every time someone improvises a
comparator.

## Stability, and what the platform gives you

Stability means equal elements keep their relative input order. It matters whenever you sort by one
key after having sorted by another — the storefront case is ordering by `total` after ordering by
`placedAt`, so that orders with the same total stay in time order. MDN states the guarantee:

> *"Since version 10 (or ECMAScript 2019), the specification dictates that `Array.prototype.sort` is
> stable."* — MDN, `Array.prototype.sort()`

That is a guarantee about `Array.prototype.sort`, not about your merge sort — yours is stable
because of the `<` in the comparison, and the two facts are independent. On the Java side, the
`Arrays.sort` overloads for objects are documented as stable and the primitive overloads are not,
which is the practical reason a Java answer that needs stability sorts boxed objects or uses a
comparator on an index array.

The other half of MDN's contract is the comparator, and it is the source of two classic bugs. The
default:

> *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them
> to strings and comparing strings in UTF-16 code units order."* — MDN, `Array.prototype.sort()`

So sorting numbers without a comparator sorts them as strings. And the five properties a comparator
must have:

> *"More formally, the comparator is expected to have the following properties, in order to ensure
> proper sort behavior:"* — *Pure*: *"The comparator does not mutate the objects being compared or
> any external state."* · *Stable*: *"The comparator returns the same result with the same pair of
> input."* · *Reflexive*: `compareFn(a, a) === 0`. · *Anti-symmetric*: *"`compareFn(a, b)` and
> `compareFn(b, a)` must both be `0` or have opposite signs."* · *Transitive*: *"If `compareFn(a, b)`
> and `compareFn(b, c)` are both positive, zero, or negative, then `compareFn(a, c)` has the same
> positivity as the previous two."* — MDN, `Array.prototype.sort()`

> *"If a comparing function does not satisfy all of purity, stability, reflexivity, anti-symmetry,
> and transitivity rules, as explained in the description, the program's behavior is not
> well-defined."* — MDN, `Array.prototype.sort()`

That last sentence is the citation to reach for whenever a comparator is improvised. It is also why
`arr.sort(() => Math.random() - 0.5)` is not a shuffle: the comparator is neither stable in MDN's
sense (the same pair gives different results) nor transitive, so the specification puts the result
outside what is defined. That argument belongs to **10 · Randomisation** *(not written yet)*; the
citation is here because it is the same sentence.

## Two-key ordering, two ways

Stability gives you a choice, and it is worth knowing both because one of them is much easier to get
right under pressure.

```ts
type Order = { id: number; placedAt: number; total: number };

// (a) one compound comparator: explicit, no reliance on stability
orders.sort((x, y) => (y.total - x.total) || (x.placedAt - y.placedAt));

// (b) two stable sorts, least significant key FIRST
orders.sort((x, y) => x.placedAt - y.placedAt);   // secondary key
orders.sort((x, y) => y.total - x.total);         // primary key; ties keep the placedAt order
```

Form (b) only works because the second sort is stable, and it only works if the *least* significant
key is sorted first — the same argument as radix sort, which is stability applied digit by digit.
Form (a) is what to write when you are unsure of the platform's guarantee, and the `||` chain is
safe only because a comparator returning `0` is falsy; a comparator returning `-0` for the first key
would fall through to the second, which is harmless here and worth knowing about.

```java
// Java: the same two forms. Comparator.comparing(...).thenComparing(...) is the compound one.
orders.sort(Comparator.comparingLong(Order::total).reversed()
                      .thenComparingLong(Order::placedAt));
```

`Comparator.comparing(...).thenComparing(...)` is preferable to a hand-written `compare` in Java for
the same reason the subtraction form is risky: the library builds an anti-symmetric, transitive
comparator from key extractors, and a hand-written `a.total - b.total` on `long` or on large `int`
values can overflow and return a value with the wrong sign — which breaks anti-symmetry and, per
MDN's equivalent rule for JavaScript, puts the result outside what is defined. `Integer.compare(a,
b)` and `Long.compare(a, b)` exist precisely to avoid that subtraction.

## Gotchas

**★ Symptom: `[10, 9, 1].sort()` does not sort numerically.** Cause: no comparator, and MDN is
explicit — elements are *"sorted by converting them to strings and comparing strings in UTF-16 code
units order."* Fix: `sort((x, y) => x - y)` for numbers. The subtraction form is itself only safe
for values whose difference cannot overflow or be `NaN`; `Number.isNaN` inputs break the
comparator's contract.

**★ Symptom: a comparator returning a boolean, and the array comes back in a nearly-arbitrary
order.** Cause: `sort((x, y) => x > y)` returns `true`/`false`, which coerce to 1 and 0, so the
comparator never returns a negative number and is not anti-symmetric — MDN says the behaviour is
then *"not well-defined."* Fix: return a negative number, zero, or a positive number.

**Symptom: a comparator that reads a mutable field the sort itself changes.** Cause: purity
violated — MDN's first comparator property is that it *"does not mutate the objects being compared
or any external state."* Fix: compute the sort key before sorting (decorate–sort–undecorate) so the
comparator reads only immutable data.

**★ Symptom: a numeric comparator written as `(a, b) => a.score - b.score` that misorders a few
pairs on real data.** Cause: the subtraction overflows, or produces `NaN` because one side is
`undefined`. A `NaN` return is neither negative, zero nor positive, so the comparator is not
anti-symmetric and MDN's *"not well-defined"* clause applies. Fix: compare rather than subtract —
`(a, b) => (a.score > b.score ? 1 : a.score < b.score ? -1 : 0)` in TypeScript,
`Integer.compare` / `Long.compare` / `Comparator.comparingInt` in Java — and handle the missing
value explicitly.

**★ Symptom: a two-pass sort where the second key's order is lost.** Cause: the passes done in the
wrong order — the most significant key sorted first, then re-sorted by the secondary key, which
destroys the primary ordering. Fix: least significant key first, most significant last; the final
sort's stability is what preserves everything beneath it.

**★ Symptom: Java code that relies on stability and sorts an `int[]`.** Cause: `Arrays.sort` on
primitives is a dual-pivot quicksort and carries no stability guarantee; only the object overloads
are documented as stable. Fix: sort boxed objects, or sort an index array with a comparator, or
build a compound comparator so ties cannot occur.

**★ Symptom: `arr.sort(() => Math.random() - 0.5)` used as a shuffle.** Cause: the comparator
violates MDN's *stable* property (the same pair does not compare the same way twice) and
transitivity, so the result is explicitly outside defined behaviour — it is not a uniform
permutation and reasoning about it as one is unfounded. Fix: Fisher–Yates. The full argument is
**10 · Randomisation** *(not written yet)*; the citation is the paragraph above.

**Symptom: a comparator that consults a `Map` or an object that the sorting loop also updates.**
Cause: purity violated. Fix: precompute the sort key for every element, sort on the precomputed
values, then discard them — decorate, sort, undecorate.

**Symptom: `undefined` entries appear at the end of a sorted array regardless of the comparator.**
Cause: MDN's default description is explicit that the ordering applies to *"all non-`undefined`
array elements"*; `undefined` values are moved to the end and the comparator is not called for
them. Fix: filter them out first if their position matters, and do not write a comparator that
tries to place them.

**Symptom: a sort that behaves differently on a short array than on a long one with the same
comparator bug.** Cause: engines switch strategies by size, and a comparator that violates the
contract yields implementation-dependent results — MDN says *"Due to this implementation
inconsistency, you are always advised to make your comparator well-formed by following the five
constraints."* Fix: fix the comparator; the size-dependent behaviour is a symptom, not the bug.

## Interview questions

**★ What does MDN require of a comparator, and why should you care?**
Five properties: pure, meaning it mutates neither the compared objects nor external state; stable,
meaning the same pair always compares the same way; reflexive, so an element compares equal to
itself; anti-symmetric, so `f(a, b)` and `f(b, a)` are both zero or have opposite signs; and
transitive. MDN says outright that if a comparator does not satisfy all five, *"the program's
behavior is not well-defined"* — so the consequences are not merely a wrong order but anything the
engine likes, including a different result on a different engine or input size. The two everyday
violations are a boolean comparator, `(x, y) => x > y`, which is never negative and so is not
anti-symmetric, and a random comparator, which is neither stable nor transitive.

**★ What is a stable sort, and when does it actually change your answer?**
A sort is stable if elements that compare equal keep their relative input order. It changes the
answer whenever there is a secondary ordering you care about and did not put in the comparator —
which is most real sorting. The concrete pattern is multi-key ordering done as repeated single-key
sorts: sort by date, then by total, and within equal totals the date order survives, because the
second sort was stable. Radix sort is that idea taken to its conclusion, one digit at a time from
least to most significant. If the sort is not stable, the same two passes give an arbitrary order
within ties, and the only safe approach is a single compound comparator.

**★ Which sorts are stable, in each language?**
In JavaScript, `Array.prototype.sort` and `toSorted` have been required to be stable since
ECMAScript 2019 — MDN states it directly — so on any current runtime you can rely on it. In Java,
`Arrays.sort` and `Collections.sort` on *objects* are stable (a merge sort variant), and
`Arrays.sort` on *primitives* is a dual-pivot quicksort with no stability guarantee, which is a
distinction that catches people because the method name is identical. Of the algorithms you might
write yourself: merge sort is stable if you break ties toward the left run, insertion sort and
counting sort are stable, and heapsort and quicksort are not, because both move elements across
long distances by swapping.

**★ Why is the subtraction comparator risky, and what do you write instead?**
`(a, b) => a - b` is fine for small, defined numbers and wrong in two situations. It overflows: in
Java, `a - b` on two `int`s of opposite large magnitudes wraps and returns a value with the wrong
sign, which breaks anti-symmetry and makes the sort's behaviour undefined. And it returns `NaN` when
either operand is `undefined` or `NaN`, which is neither negative, zero nor positive — the same
violation. The fixes are `Integer.compare` / `Long.compare` / `Double.compare` in Java, or
`Comparator.comparingInt(Foo::bar)` which does it for you; in TypeScript, an explicit three-way
comparison, plus a decision about where missing values go.

**★ Why does a random comparator not produce a uniform shuffle?**
Because it is not a comparator. MDN requires a comparator to be *stable* in the sense that it
returns the same result for the same pair, and to be transitive; `() => Math.random() - 0.5`
satisfies neither, and MDN says explicitly that a comparator failing any of the five properties
leaves the program's behaviour not well-defined. So the resulting permutation is not merely biased
in some quantifiable way — it is whatever the engine's algorithm happens to produce given
inconsistent answers, which differs between engines and between input sizes. The correct tool is
Fisher–Yates, which is **10 · Randomisation** *(not written yet)*.

**How would you sort objects by a key you compute expensively?**
Decorate, sort, undecorate: compute the key once per element into a parallel array or a wrapper
object, sort on the precomputed keys, then read the elements back out. That respects MDN's purity
requirement — the comparator touches only immutable precomputed data — and it changes the number of
key computations from Θ(n log n) (once per comparison) to Θ(n). It is also the pattern that makes a
comparator over a `Map` lookup safe, since the lookup happens before the sort rather than inside
the comparator.

{/* FOOTER */}
