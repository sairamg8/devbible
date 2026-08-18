---
title: "The contract, and what breaks it"
sidebar_label: "3 · The contract, and what breaks it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.Comparator` (contract), `java.lang.Comparable` ("consistent with
> equals" note), `java.util.SortedSet` and `java.util.SortedMap` (the
> comparator-inconsistent-with-equals warnings in both class docs),
> `java.util.Arrays#sort(Object[])` (TimSort and its
> `IllegalArgumentException`), `java.math.BigDecimal#compareTo` and `#equals`,
> and `java.lang.Double#compare`.

**A comparator is a promise of a *total order*: every pair of values has one
consistent answer, forever. Break the promise and the failure is not "slightly
wrong order" — it is TimSort throwing
`"Comparison method violates its general contract!"` from inside
`Arrays.sort` on data-dependent inputs, or a `TreeSet` that quietly disagrees
with a `HashSet` about whether an element is even *in* the collection. This
chunk is the three laws, the two famous ways production code breaks them, and
the one worked example where breaking consistency-with-`equals` is the point.**

## The three laws

The `Comparator`/`compareTo` contract, phrased as what each law forbids:

1. **Sign-antisymmetry** — `sgn(compare(a, b)) == -sgn(compare(b, a))`.
   *Violation:* a comparator that null-checks only its first argument —
   `compare(a, b)` returns early for `null` `a` but `compare(b, a)` throws.
   Both directions must agree, including about exceptions.
2. **Transitivity** — `compare(a, b) > 0` and `compare(b, c) > 0` imply
   `compare(a, c) > 0`.
   *Violation:* the [int-subtraction comparator](02-building-comparators.md):
   with values near the `int` extremes, `a > b` and `b > c` can both hold
   while the wrapped subtraction reports `a < c`. No single call looks wrong;
   the *set* of answers is contradictory.
3. **Substitutability of ties** — `compare(a, b) == 0` implies
   `sgn(compare(a, c)) == sgn(compare(b, c))` for every `c`: tied elements
   must be interchangeable everywhere.
   *Violation:* the hand-written `<`/`>` double comparator — `NaN` "ties"
   with `1.0` and with `2.0`, but `1.0` and `2.0` do not tie with each other.

A comparator that honors all three defines a total order. TimSort, `TreeMap`,
`binarySearch` — everything downstream *assumes* the laws; none of them can
work correctly, or even detect all violations, without them.

## The crash: TimSort's `IllegalArgumentException`

`Arrays.sort(Object[])` and `List.sort` use TimSort, which exploits the
contract to skip comparisons: it finds already-ordered runs, merges them, and
uses binary insertion inside small runs. During a merge it *rediscovers*
facts it already proved ("this element was ≤ that one") — and when an
intransitive comparator makes the rediscovered fact contradict the recorded
one, it throws:

```text
java.lang.IllegalArgumentException: Comparison method violates its general contract!
```

(That string is quoted from the `Arrays.sort` documentation's description of
the failure, not from a run.) Three properties make this the classic
ships-then-crashes bug:

- **It is data-dependent.** The merge only compares *some* pairs. Small or
  mostly-sorted inputs may never place the contradictory pair on either side
  of a merge; the JDK docs note the well-formedness check is a best-effort
  side effect of merging, not a validation pass.
- **It is a feature, not the bug.** The alternative — the pre-Java-7 merge
  sort — silently produced *some* order. The exception is the sort refusing
  to return garbage. Suppressing it (the historical
  `java.util.Arrays.useLegacyMergeSort` escape hatch) hides the defect, never
  fixes it.
- **The stack trace blames the sort, not you.** It surfaces inside
  `java.util.TimSort.mergeHi` or similar — nowhere near the lambda that
  caused it. The comparator named in the pipeline above the frame is the
  suspect, and the laws above are the checklist.

`TreeMap` and `TreeSet` typically do **not** throw for the same comparator —
a red-black tree compares each new element against a path of existing ones
and never cross-checks. An intransitive comparator there yields a quietly
malformed tree: elements unfindable by `contains`, duplicates side by side.
The crash is the *lucky* outcome.

## Inconsistent with `equals`: two collections, two answers

The laws above make an order *total*. A separate, softer clause — "strongly
recommended" for `Comparable`, spelled out in the `SortedSet` and `SortedMap`
docs — is **consistency with `equals`**: `compare(a, b) == 0` iff
`a.equals(b)`. It matters because the platform has two membership machines:

- `HashSet`/`HashMap` ask **`equals`** (after `hashCode` routing —
  [phase 2 topic 06](../../phase-2-classes-objects/06-equals-hashcode/README.md)).
- `TreeSet`/`TreeMap` ask **`compare` only** — the class docs say plainly
  that a sorted set's view of membership is the comparator's, and that a
  comparator inconsistent with `equals` makes the set "violate the general
  contract of `Set`", though its behavior stays *well-defined*.

`BigDecimal` is the canonical case, because its inconsistency is deliberate:

```java
var a = new BigDecimal("1.0");
var b = new BigDecimal("1.00");

a.equals(b);        // false — equals compares value AND scale
a.compareTo(b);     // 0     — compareTo compares numeric value only

Set<BigDecimal> hash = new HashSet<>(List.of(a, b));   // size 2
Set<BigDecimal> tree = new TreeSet<>(List.of(a, b));   // size 1 — b "vanished"
```

Same elements, same code shape, different cardinality — and every downstream
count, sum-of-distinct, or dedupe now depends on which `Set` implementation a
refactor happened to pick. `BigDecimal`'s Javadoc carries exactly the warning
the `Comparable` contract asks for ("its natural ordering is *inconsistent
with equals*"); types like this must be handled knowingly: normalize scale
first (`stripTrailingZeros()`), or choose the collection whose membership
question is the one you mean.

## The worked example: case-insensitive dedupe, on purpose

The phase gate's "dedupe emails case-insensitively" answer *weaponizes* the
same divergence:

```java
SortedSet<String> unique = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
unique.addAll(rawEmails);
// "Ada@example.com" and "ada@EXAMPLE.com" — compare() == 0, so ONE survives
```

`String.CASE_INSENSITIVE_ORDER` ties strings that `String.equals` separates —
inconsistent with `equals`, and exactly the membership rule the requirement
asks for. Two consequences to say out loud in review:

- **First writer wins.** `add` on a tie keeps the existing element, so the
  *casing* that survives is whichever arrived first. If the canonical form
  matters, normalize (`toLowerCase(Locale.ROOT)`) instead of relying on
  arrival order.
- **This `TreeSet` is not a `Set` in the `equals` sense.** Handing it to code
  that assumes `equals`-membership (copying into a `HashSet`, comparing with
  `Set.equals`) resurrects the "duplicates".

The same trick builds case-insensitive header maps —
`new TreeMap<>(String.CASE_INSENSITIVE_ORDER)` is how several HTTP libraries
store header names.

## `Double.compare` vs `<`: totality at the edges

The floating-point comparator from
[chunk 2](02-building-comparators.md) breaks law 3 through `NaN`. The fix,
`Double.compare` (and `comparingDouble`), *restores the laws by deliberately
diverging from IEEE `==` semantics*: `NaN` compares equal to itself and
greater than everything else; `-0.0` compares less than `0.0`. Both answers
are "wrong" by `==` (`NaN != NaN`, `-0.0 == 0.0`) and both are required for a
total order. The lesson generalizes: **inside a sort, totality outranks
domain fidelity** — a comparator may impose arbitrary-but-consistent answers
on edge values, and must, because "unordered" is not an option the contract
offers.

## Repairing a broken comparator

- **Subtraction → `Integer.compare` / `comparingInt`.** Restores transitivity
  by construction ([chunk 2](02-building-comparators.md) has the full
  dissection).
- **Hand-written multi-key logic → a `comparing().thenComparing()` chain.**
  Each key comparator is lawful, and lexicographic composition of lawful
  comparators is lawful — the chain is correct *by construction*, where
  hand-fused if/else ladders breed asymmetry.
- **Underspecified ties → add a unique tiebreaker.** `thenComparing(id)`
  doesn't fix a *broken* comparator, but it turns "tied, order unstable
  across runs" into a deterministic order — which pagination and diffing
  quietly depend on.
- **Mutable sort keys → don't.** A lawful comparator over keys that change
  while the element sits inside a `TreeSet` produces the same unfindable
  elements as an intransitive one — the tree's shape froze the old answers
  ([`HashMap` has the same rule](../07-hashmap-internals.md) for `hashCode`).

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `IllegalArgumentException: Comparison method violates its general contract!` — only in production, never in tests | Intransitive/asymmetric comparator; TimSort's merge met the contradiction on large or adversarial data. Small inputs never cross-checked | Audit the comparator against the three laws; replace subtraction with `Integer.compare`, `<`/`>` with `Double.compare`, hand-fused logic with `comparing` chains |
| Same comparator, no exception, but `TreeSet.contains` misses elements that are visibly present when iterating | Trees never cross-check — an unlawful comparator builds a malformed tree instead of throwing | Same fix; the absence of the exception is luck, not health |
| `TreeSet` size 1 where `HashSet` says 2 (or `TreeMap` merges "different" keys) | Comparator (or natural order) inconsistent with `equals` — `BigDecimal` scale, case-insensitive order | Decide which membership you mean; normalize elements first if `equals`-identity must survive |
| Case-insensitive `TreeSet` keeps the "wrong" casing | Ties keep the first-added element | Normalize to a canonical case before adding, instead of trusting arrival order |
| `Set.equals` between a `TreeSet(CASE_INSENSITIVE_ORDER)` and a `HashSet` of the "same" strings returns `false` | The two sets answer membership with different machines | Don't mix membership regimes; convert through an explicit normalization step |
| Sort order of doubles differs from `==`-based logic at `NaN`/`-0.0` | `Double.compare`'s total order is deliberately non-IEEE at those edges | Expected; branch on `Double.isNaN` explicitly where the distinction matters |
| Re-enabling old behavior with `useLegacyMergeSort` "fixes" the crash | Legacy merge sort tolerates unlawful comparators and returns *some* order | It hides intransitivity, it doesn't repair it — fix the comparator |
| Elements in a `TreeSet` become unfindable after a field update | Sort key mutated while the element was in the tree — the structure still reflects the old key | Remove → mutate → re-add, or keep sort keys immutable |

## Interview questions

1. **What are the three laws every comparator must satisfy?**
   Sign-antisymmetry (`sgn(compare(a,b)) == -sgn(compare(b,a))`, exceptions
   included), transitivity, and substitutability of ties (equal elements
   compare the same way against everything). Together they define a total
   order — what every sorted API assumes.
2. **When does "Comparison method violates its general contract!" fire, and
   why not always?** TimSort throws it when a merge rediscovers a comparison
   that contradicts one it recorded — which requires the contradictory pair
   to actually meet across a merge boundary. Small, sorted, or lucky data
   never trips it; the check is a side effect of merging, not validation.
3. **Why does the same broken comparator crash `Arrays.sort` but not
   `TreeSet`?** The sort cross-checks comparisons during merges; a red-black
   tree only ever compares along one path and trusts every answer. The tree
   silently malforms — unfindable elements — instead of throwing.
4. **`new BigDecimal("1.0")` vs `new BigDecimal("1.00")` — `HashSet` and
   `TreeSet` disagree. Why, and is `TreeSet` broken?** `equals` compares
   value + scale (false), `compareTo` compares value (0). Sorted collections
   define membership by `compare`, hash collections by `equals`. Not broken —
   documented: the sorted set just fails the *`Set` interface's*
   `equals`-based contract, knowingly.
5. **Is inconsistency with `equals` ever the right choice?** Yes — when the
   comparator's tie *is* the identity you want: `TreeSet` with
   `String.CASE_INSENSITIVE_ORDER` for dedupe, `TreeMap` with the same for
   HTTP headers. The requirement "these count as the same" is expressed as a
   comparator tie.
6. **Why does `Double.compare` order `NaN` and `-0.0` differently from
   `==`?** `==` semantics make `NaN` unordered and `-0.0` equal to `0.0` —
   both incompatible with a total order. `Double.compare` trades IEEE
   fidelity for totality: `NaN` last and self-equal, `-0.0` before `0.0`.
   Sorting requires an answer for every pair.
7. **A `TreeSet` "loses" elements after a batch job updates entity fields
   in place. The comparator passes every law. What happened?** The sort key
   mutated while elements sat in the tree — lookups now walk the wrong path.
   Contract-lawful but key-mutable is just as broken in practice: remove,
   mutate, re-add, or make keys immutable.
8. **How do `comparing`/`thenComparing` chains make contract bugs rarer?**
   Each stage delegates to lawful comparators (`Integer.compare`, natural
   orders) and composes them lexicographically, which preserves the laws.
   Hand-written ladders re-derive the laws by hand every time — and the two
   famous bugs (subtraction, `<` on doubles) are exactly hand-written
   shortcuts.

---

← Prev: [Building comparators](02-building-comparators.md) · Index: [Comparable vs Comparator](README.md) · Next → [Iteration and `ConcurrentModificationException`](../11-concurrent-modification/README.md)
