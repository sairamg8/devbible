---
title: "Worst case is the default answer, average case is stated when it differs and the input is not adversarial, expected case is a randomised algorithm's own coin flips, and best case is almost never worth saying — hashing and quicksort are the two places the distinction decides the grade"
sidebar_label: "09 · Best, average and worst"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the JDK 25 javadocs for
> [`HashMap`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html)
> (constant time *"assuming the hash function disperses the elements properly"*),
> [`Arrays`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html)
> (dual-pivot quicksort, *"O(n log(n)) performance on all data sets"*) and
> [`List.sort`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html#sort(java.util.Comparator))
> (TimSort, *"approximately n comparisons"* on nearly sorted input), and MDN
> [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
> (*"on average … sublinear"*) — verbatim below. The quicksort analysis is textbook (CLRS,
> *quicksort*). **No sandbox run; no timings.**

**"What's the complexity?" has four possible answers, and the grade depends on giving the right
one and saying which it is.** Worst case — the slowest input of size n — is the default, because
it is a guarantee. Average case — over a distribution of inputs — is stated when it differs from
the worst and the input is not chosen by an adversary; a hash lookup is the standing example,
constant on average and linear in the worst case, and both languages' documentation says so in
those terms. Expected case is different again: it averages over the algorithm's *own* random
choices, not over the inputs, so randomised quicksort is expected n log n on *every* input, which
is a stronger claim than average n log n over random inputs. Best case is the one to leave out,
with two exceptions where it is the point — insertion sort and TimSort on nearly sorted data.
This page is the four cases with the two structures that make them matter, when to state each,
and the words that make the distinction audible to an interviewer.

## The four, defined

| Case | Averages over | Says | State it when |
|---|---|---|---|
| **worst** | nothing — the maximum over inputs of size n | a guarantee | always; it is the default meaning of "complexity" |
| **average** | a distribution of *inputs* | typical cost, if inputs are typical | it differs from the worst and the input is not adversarial — hashing |
| **expected** | the algorithm's own *random choices*, for a fixed input | typical cost on any input | the algorithm is randomised — quicksort with a random pivot, skip lists |
| **best** | nothing — the minimum over inputs | rarely anything useful | the algorithm is *adaptive* and the data is known to be nearly sorted |

The words matter because the interviewer is listening for them: "O(1) average, O(n) worst" for a
hash lookup; "O(n log n) expected" for randomised quicksort; "O(n²) worst, and here is the input
that causes it" for a deterministic pivot. Saying "O(1)" of a hash lookup with no qualifier is
accepted at junior level and probed at senior.

## Hashing: average against worst

The documentation of both languages states the average and the condition it depends on:

> *"This implementation provides constant-time performance for the basic operations (`get` and
> `put`), assuming the hash function disperses the elements properly among the buckets."* —
> JDK 25, `HashMap`

> *"The specification requires maps to be implemented "that, on average, provide access times
> that are sublinear on the number of elements in the collection"."* — MDN, `Map`

The worst case is every key in one bucket — a `hashCode` that returns a constant, or keys chosen
to collide — and then a lookup scans the bucket: Θ(n). Two things to know about that worst case.
It is *reachable on purpose*: an attacker who controls the keys of a map on a server can choose
colliding ones, which is why runtimes seed their string hashes and why a request handler that
builds a map from user-supplied keys is stating "average" about an adversarial input. And the
OpenJDK implementation mitigates it by converting a long bucket chain to a tree — a detail of
the source, not of the API documentation, so say "the implementation degrades more gracefully
than a scan; the API promises only the average".

```ts
// average Θ(1) per lookup — and the only reason is the hash function
export function firstRepeated(words: string[]): string | undefined {
  const seen = new Set<string>();
  for (const w of words) { if (seen.has(w)) return w; seen.add(w); }
  return undefined;
}
// state it: "Θ(n) on average; Θ(n²) in the worst case if every key collided, which real engines
// make hard to trigger by seeding their string hashes"
```

```java
// the same, with the worst case made concrete: a key class whose hashCode is constant
record BadKey(int x) { @Override public int hashCode() { return 1; } }   // every key → one bucket → lookups scan
// the API promises constant time only "assuming the hash function disperses the elements"
```

## Quicksort: the pivot decides which case you are in

Quicksort's cost is the recurrence of [08](08-recurrences-and-the-master-theorem.md), and the
pivot decides its shape:

| Pivot | Recurrence | Case | Bound |
|---|---|---|---|
| splits evenly | T(n) = 2T(n/2) + n | master theorem, case 2 | Θ(n log n) |
| splits at any constant ratio | uneven, logarithmic depth | tree | Θ(n log n) |
| removes one element per level — first element on sorted input | T(n) = T(n − 1) + n | unroll | Θ(n²) |
| random | expected over the algorithm's choices | probabilistic | expected Θ(n log n) on **every** input |

The last row is the one to say precisely: a random pivot makes the bad split *unlikely on every
input*, including a sorted one; the average-case claim for a deterministic first-element pivot
is "n log n on random inputs" — and sorted input is not random, and is common. The library
sorts avoid the question: Java's primitive sort is documented to be n log n regardless —

> *"O(n log(n)) performance on all data sets"* — JDK 25, `Arrays.sort(int[])`, dual-pivot
> quicksort

— which it achieves by falling back to other strategies on adversarial patterns (an
implementation detail; the documented sentence is the promise). Java's object sort and
`List.sort` are TimSort, a mergesort whose worst case is n log n by construction.

```ts
// deterministic first-element pivot: Θ(n²) on sorted input — the worst case is the common case
// random pivot: expected Θ(n log n) on every input
export function quicksort(a: number[], lo = 0, hi = a.length - 1): void {
  if (lo >= hi) return;
  const p = lo + Math.floor(Math.random() * (hi - lo + 1));   // the one line that changes the case
  [a[lo], a[p]] = [a[p], a[lo]];
  const pivot = a[lo];
  let i = lo + 1, j = hi;
  while (i <= j) {
    while (i <= j && a[i] < pivot) i++;
    while (i <= j && a[j] > pivot) j--;
    if (i <= j) { [a[i], a[j]] = [a[j], a[i]]; i++; j--; }
  }
  [a[lo], a[j]] = [a[j], a[lo]];
  quicksort(a, lo, j - 1);
  quicksort(a, j + 1, hi);
}
```

The same distinction, in the same words, covers quickselect (expected Θ(n), worst Θ(n²)), hash
tables, skip lists (expected log n), treaps, and any algorithm with a random choice in it:
*expected* over the coins, and the worst case is what happens if the coins are unlucky, not
what happens on a bad input.

## Best case: when it is worth saying

Best case is almost never the answer, because no input is promised to be easy. Two exceptions,
both about **adaptive** sorts on data that is known to be nearly ordered:

- **Insertion sort** — Θ(n) on sorted input, Θ(n²) worst; each element moves only past the
  elements it is out of order with. It is why library sorts use it on small or nearly sorted
  runs, and it is the answer to "the input is almost sorted — what would you use?"
- **TimSort** — the JDK's object sort — is documented to exploit the same structure:

> *"If the input array is nearly sorted, the implementation requires approximately n
> comparisons."* — JDK 25, `List.sort`

So "n log n worst, about n if it's nearly sorted" is a legitimate sentence about `List.sort`,
and a candidate who knows to say it when the problem says "the array is sorted except for k
elements" has read the constraint.

Everything else's best case is a trap: "binary search is O(1) if the middle element matches",
"linear search is O(1) if it's first" — true, useless, and a signal that the candidate is
reaching for the smallest number rather than the honest one.

## Which to state, and how

1. **Worst case, always** — it is what "complexity" means, and it is the guarantee.
2. **Then the average or expected case if it differs**, with the word: "average" for a
   distribution of inputs, "expected" for the algorithm's own randomness — and, for average,
   whether the input could be adversarial.
3. **Best case only if the algorithm is adaptive and the problem says the input is nearly
   ordered.**
4. **The input that causes the worst case**, in one clause — sorted input with a first-element
   pivot; all keys colliding. Naming it shows the case was reasoned, not recited.

*"Hash-based, so Θ(n) on average and Θ(n²) if every key collided — which an adversary could
arrange, so on a public endpoint I'd note that runtimes seed their hashes. Sort-based instead
would be Θ(n log n) worst case, guaranteed, and I'd take it if the input were untrusted."* That
is the shape, and it also happens to be a trade-off sentence.

## Gotchas

**★ Symptom: "hash lookup is O(1)" and the interviewer asks "always?"** Cause: the average
stated as a guarantee. Fix: "average constant, worst linear when keys collide; the javadoc says
so with its 'assuming the hash function disperses' clause."

**★ Symptom: quicksort called O(n log n) with a first-element pivot on sorted input.** Cause:
average over random inputs assumed for an input that is not random. Fix: name the worst case
and its input — sorted, first pivot, T(n − 1) + n, quadratic — and the random pivot that makes
n log n *expected on every input*.

**Symptom: "expected" and "average" used interchangeably.** Cause: the two averages conflated.
Fix: average is over inputs, expected is over the algorithm's coins; randomised quicksort is
expected n log n on any input, which is the stronger claim.

**Symptom: best case offered — "O(1) if it's the first element".** Cause: reaching for the
smallest number. Fix: leave best case out unless the algorithm is adaptive and the input is
known to be nearly ordered.

**Symptom: a map keyed by user-supplied strings on a public endpoint, and "O(1)" stated.**
Cause: adversarial input not considered. Fix: say the worst case is reachable by chosen
collisions, that runtimes seed string hashes, and that a sort-based alternative is n log n
guaranteed.

**Symptom: "the input is nearly sorted" in the statement, and merge sort chosen.** Cause: the
adaptive sorts unknown. Fix: insertion sort for small n, TimSort — `List.sort` — for large,
with the javadoc's "approximately n comparisons" as the reason.

**Symptom: Java's `Arrays.sort(int[])` described as "quicksort, so O(n²) worst".** Cause: the
algorithm's name taken over the documentation. Fix: the javadoc promises n log n on all data
sets; the implementation falls back on adversarial patterns.

**Symptom: quickselect's worst case forgotten.** Cause: the expected bound stated alone. Fix:
"expected linear, quadratic worst with a bad pivot; median-of-medians makes it linear worst
case at a large constant."

## Interview questions

**★ What is the complexity of a hash map lookup — and is that a guarantee?**
Constant on average and linear in the worst case, and the average is a guarantee only under
the condition both documentations state: the JDK's "assuming the hash function disperses the
elements properly among the buckets", MDN's "on average … sublinear". The worst case is every
key in one bucket — a constant `hashCode`, or keys chosen to collide, which an adversary
controlling the keys can arrange; runtimes seed string hashes against it, and OpenJDK's
implementation converts long chains to trees, which is a detail of the source rather than a
promise of the API.

**★ Quicksort's worst case, the input that causes it, and the fix.**
Θ(n²), on an input where the pivot removes one element per level — a sorted or reverse-sorted
array with a first- or last-element pivot — giving T(n) = T(n − 1) + n. A random pivot changes
the claim from "n log n on average over random inputs" to "n log n expected on every input",
because the bad split becomes unlikely regardless of the input; median-of-three helps on sorted
input but can still be defeated. Library sorts sidestep it: Java's primitive sort is documented
as n log n on all data sets, and its object sort is a mergesort.

**★ What is the difference between average case and expected case?**
Average case averages over a distribution of *inputs* and is only meaningful if real inputs
follow that distribution — sorted inputs are common and not random. Expected case averages over
the algorithm's own random choices for a *fixed* input, so it holds on every input, including
adversarial ones; randomised quicksort, quickselect and skip lists are expected bounds. "n log n
expected" is therefore a stronger statement than "n log n on average".

**When is best case worth stating?**
When the algorithm is adaptive and the problem says the input is nearly ordered: insertion sort
is linear on sorted input and is what library sorts use on small runs, and the JDK's `List.sort`
is documented to need about n comparisons on nearly sorted input. Otherwise best case is a
number no input promises — "binary search is O(1) if the middle matches" — and offering it reads
as reaching for the smallest figure rather than the honest one.

**The map's keys come from an HTTP request. Does that change your complexity statement?**
Yes: the input is adversarial, so the average-case constant is not a guarantee — an attacker
can choose colliding keys and make every lookup a scan. Say so, note that runtimes seed string
hashes to make the collision set unpredictable, and offer the alternative with a worst-case
bound — a sort-based or tree-based structure at n log n or log n per operation — as the choice
for untrusted input. The complexity statement becomes a trade-off sentence.

**Why does Java's `Arrays.sort` on `int[]` promise n log n if it is a quicksort?**
Because the documented promise is the contract, not the algorithm's textbook worst case: the
javadoc says dual-pivot quicksort with O(n log n) performance on all data sets, and the
implementation reaches that by detecting adversarial patterns and switching strategy. Quote the
sentence rather than the name. The object sort avoids the question altogether by being a
mergesort — TimSort — with n log n worst case by construction and a stability guarantee.

---

← Prev: [08 · Recurrences and the master theorem](08-recurrences-and-the-master-theorem.md) · Index: [Phase 1 — Complexity analysis](README.md) · Next → **Benchmarking vs analysis** *(not written yet)*
