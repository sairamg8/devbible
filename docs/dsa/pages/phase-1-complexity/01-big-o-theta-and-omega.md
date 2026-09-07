---
title: "Big-O is an upper bound, Omega a lower bound, Theta a tight one — and when an interviewer says \"what's the complexity?\" they mean the tight worst-case bound of your code, read off the code, with the constants dropped except at the moments they decide the answer"
sidebar_label: "01 · Big-O, Theta and Omega"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The definitions are textbook (CLRS, *growth of functions*) and are stated
> as such; nothing here is quoted. The one runtime fact — that JavaScript's `Map` and `Set` are
> guaranteed *sublinear*, not constant — is MDN
> ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map),
> verbatim below). Interview-format observations are tendencies. Solutions are TypeScript first,
> Java second. **No sandbox run; no timings.**

**Three symbols, one habit. O(f) says the cost grows *no faster than* f; Ω(f) says *no slower
than*; Θ(f) says *exactly like* f, up to a constant, for large inputs.** Interviewers say "Big-O"
and mean Θ of the worst case: the bound that is both true and tight for the code you wrote, on
the input that makes it slowest. Saying "O(n²)" of a linear scan is technically correct and
graded as wrong, because the question was "how fast is this", not "name any ceiling". The habit
is to *read the bound off the code* — the loops, the recursion, the built-ins called — and state
it with its variable named, both time and space, before being asked. Constants and lower-order
terms are dropped because the notation is about growth, and they are dropped *except* at three
moments where they decide the answer: when n is small enough that a quadratic beats a
linearithmic, when two solutions share a class and the interviewer asks which is faster, and
when the input limit in the statement says which class was intended. This page is the
definitions in the form the round needs, what "complexity" means when asked, the dropping
rules and their exceptions, the multi-variable and input-size traps, and the sentence to say.

## The three bounds, in the round's terms

| Symbol | Says | Read as | When to say it |
|---|---|---|---|
| **O(f(n))** | for large n, cost ≤ c · f(n) for some constant c | "at most f" — a ceiling | the default in conversation; means Θ unless you say otherwise |
| **Ω(f(n))** | for large n, cost ≥ c · f(n) | "at least f" — a floor | proving nothing can do better: "any comparison sort is Ω(n log n)" |
| **Θ(f(n))** | both — c₁ · f(n) ≤ cost ≤ c₂ · f(n) | "exactly f, up to constants" — tight | when you want to be precise that the bound is not loose |

Formally, O(f) is a *set* of functions and "T(n) = O(n²)" means T belongs to it; the round
never needs the set-membership form, but it explains why O(n) ⊂ O(n²): every linear function is
also bounded by a quadratic. That is the sense in which "O(n²)" is *true* of a linear scan — and
why it is the wrong answer. The interviewer wants the smallest class the code belongs to, which
is Θ.

Two more that come up once and are worth knowing: **o(f)** (little-o) means strictly slower
growth than f — n = o(n²) — and **ω(f)** its mirror. They appear in "can we do better?"
arguments and almost nowhere else.

## What "complexity" means when asked

Unless the interviewer specifies, the question means: **the worst-case running time, as a tight
bound, in terms of the input size, with space stated alongside.** Four words in that sentence
carry a decision each:

- **Worst case.** Over all inputs of size n, the slowest. Average case is stated when it differs
  and matters — hashing, quicksort — and is the subject of **09 · Best, average and worst** *(not written yet)*. Say which one you are giving.
- **Tight.** Θ, said as O. "O(n log n)" of a sort means it is n log n, not that it is bounded by
  it.
- **Input size.** Named. "n" is the array's length, "n and m" two arrays, "V and E" a graph,
  "L" the length of the longest string. A bound with an unnamed n is ungradeable.
- **Space alongside.** Auxiliary space — what the algorithm allocates beyond the input — including
  the recursion stack (**04 · Space and the recursion stack** *(not written yet)*).

The sentence, in full: *"Time is O(n log n) in the length of the array — the sort dominates, the
scan after it is linear; space is O(n) for the sorted copy, or O(1) auxiliary if I sort in
place, plus the sort's own stack."*

## Reading a bound off code, not off a name

The bound comes from the code, and the code is read in three moves that **02 · Reading
complexity off code** *(not written yet)* expands:

```ts
// n = nums.length. Read the loops, then the work inside them, then the built-ins.
export function hasPairWithSum(nums: number[], target: number): boolean {
  const seen = new Set<number>();          // O(1) to create
  for (const x of nums) {                  // n iterations
    if (seen.has(target - x)) return true; // Set.has — sublinear by spec, hash lookup in practice
    seen.add(x);                           // same
  }
  return false;
}
// time Θ(n) — one pass, constant expected work per element; space Θ(n) for the set.
```

```java
// Java: identical shape; HashSet is constant-time get/put "assuming the hash function disperses
// the elements properly" (JDK 25 HashMap javadoc, quoted in phase 0).
static boolean hasPairWithSum(int[] nums, int target) {
    Set<Integer> seen = new HashSet<>();
    for (int x : nums) {
        if (seen.contains(target - x)) return true;
        seen.add(x);
    }
    return false;
}
```

The point of reading rather than naming: the same function with `nums.includes(target - x)`
instead of the set is Θ(n²), because `includes` is a scan. The pattern's name — "two-sum with a
hash" — is what candidates say; the interviewer grades whether the *code on the board* is linear.

On the "sublinear" hedge in the comment — MDN's statement about `Map` (and `Set`) is exact:

> *"The specification requires maps to be implemented "that, on average, provide access times
> that are sublinear on the number of elements in the collection". Therefore, it could be
> represented internally as a hash table (with O(1) lookup), a search tree (with O(log(N))
> lookup), or any other data structure, as long as the complexity is better than O(N)."* — MDN,
> `Map`

Every major engine uses a hash table, so "O(1) expected" is what to say; "guaranteed by the spec
to be sublinear" is the precise version if pressed.

## Dropping constants and lower terms — and when not to

**The rules.** 3n² + 40n + 7 is Θ(n²): the lower-order terms vanish against the leading one as
n grows, and the constant 3 is absorbed by the definition's c. Two loops in sequence add — n + n
is Θ(n); a loop inside a loop multiplies — n · n is Θ(n²). log₂ n and log₁₀ n differ by a
constant factor, so the base is dropped: "O(log n)". A sort followed by a scan is Θ(n log n +
n) = Θ(n log n).

**The three moments constants matter anyway.**

1. **Small n.** For n under a few hundred, a Θ(n²) with a tiny constant — insertion sort, a
   nested loop over a short list — often beats a Θ(n log n) with allocation and recursion. This
   is why library sorts switch to insertion sort on small runs, and it is a legitimate answer to
   "why not the fancier one here?"
2. **Same class, different constant.** Two Θ(n) solutions, one making three passes and one
   making one; two Θ(n log n) sorts, one stable with n/2 extra references and one in place. The
   interviewer who asks "which is faster?" after both are Θ(n) is asking about constants and
   memory traffic, and "same complexity" is a non-answer. Say "one pass versus three; the
   single pass touches each element once and is cache-friendlier."
3. **The limit in the statement.** n ≤ 10⁵ means roughly a hundred million simple operations
   in a second, so Θ(n²) at 10¹⁰ will time out and Θ(n log n) at ~1.7 × 10⁶ will not — the
   constant matters exactly in the sense that the class boundary is where the constant stops
   saving you. **05 · The common classes and what the limits imply** *(not written yet)* is the
   table.

## Several variables, and what n is

**More than one input.** Two arrays of lengths n and m: a nested loop is Θ(n · m), not Θ(n²);
a merge is Θ(n + m). Collapsing to one letter is graded as sloppy when the inputs are
independent. Graphs are Θ(V + E) for a traversal that visits every vertex and edge; writing
Θ(V²) for adjacency-list BFS is wrong unless the graph is dense. Strings: a list of k strings of
length up to L costs Θ(k · L) to read, and a sort of them is Θ(k · L · log k) because each of the
k log k comparisons can cost L.

**What n measures.** The input *size*, which for a number means its number of digits, not its
value. A loop that runs `x` times for an input `x` is linear in the value and *exponential* in
the size — Θ(2^b) for a b-bit input — which is the whole story of "pseudo-polynomial" time and
why trial division to √x is not a polynomial-time primality test. In the round: "linear in n,
the value" is acceptable if said; "O(n)" with n silently the value is how a candidate claims a
polynomial algorithm for something that is not one.

**Output-sensitive bounds.** Generating all subsets is Θ(2ⁿ · n) and cannot be less, because
the output is that large; the bound is in the size of the output, and saying so preempts "can
we do better?"

## Time and space, both, every time

Space is graded as often as time and stated half as often. The bound is *auxiliary* space —
what the algorithm allocates beyond its input — and includes the recursion stack: a recursive
DFS over a path graph of n vertices is Θ(n) space for the stack even with no explicit
structure. "In place" means Θ(1) auxiliary, and modifying the input is what buys it; say
whether you are allowed to. A sorted copy is Θ(n); a hash set of seen values is Θ(n); a sliding
window is Θ(1); a memo table over (i, j) is Θ(n · m).

```ts
// Θ(1) auxiliary space — the window is two indices and a running sum
export function maxWindowSum(nums: number[], k: number): number {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let right = k; right < nums.length; right++) {
    sum += nums[right] - nums[right - k];
    if (sum > best) best = sum;
  }
  return best;
}
// time Θ(n); space Θ(1) — no structure grows with n
```

## Saying it in the round

The form, said unprompted after the code is written, and again if the code changes:

1. **Name n.** "n is the array length."
2. **Time, with the line that sets it.** "Θ(n log n) — the sort on line 3; everything after is
   a single pass."
3. **Space, with the structure that sets it.** "Θ(n) for the set; O(log n) stack from the sort if
   it's in place."
4. **Which case.** "Worst case; the hash lookups are constant on average, and I'm assuming that."
5. **The follow-up preempted.** "The sort is the bottleneck; without an order requirement a hash
   makes it linear."

Five clauses, fifteen seconds. Said in the form of an O with the meaning of a Θ, with the
variable named, before "what's the complexity?" arrives — because the question arriving means
the sentence was late.

## Gotchas

**★ Symptom: "O(n²)" said of a linear function, and the interviewer frowns.** Cause: a true
upper bound that is not tight; the question meant Θ. Fix: the smallest class the code belongs
to, read off the loops — and the word "exactly" if you want to signal it: "linear, exactly one
pass."

**★ Symptom: the pattern named, the bound wrong.** Cause: "two-sum with a hash, so O(n)" while
the code on the board calls `includes` inside the loop. Fix: read the bound off the code, not
the name; every built-in inside a loop is a multiplication (**07 · Complexity of the built-ins** *(not written yet)*
is the table).

**★ Symptom: "O(n)" with n never defined, for a problem with two arrays.** Cause: variables
collapsed. Fix: name each input's size and keep them separate — Θ(n · m), Θ(n + m), Θ(V + E) —
unless the statement says they are equal.

**Symptom: "same complexity" when asked which of two Θ(n) solutions is faster.** Cause:
constants dropped where they were the question. Fix: passes, allocations, cache behaviour —
"one pass, no allocation" is an answer; "both linear" is not.

**Symptom: the space bound omitted, then asked for, then wrong.** Cause: the recursion stack
forgotten. Fix: state auxiliary space with time, every time, and count the stack: depth of the
recursion times frame size, Θ(n) for a DFS on a path.

**Symptom: "O(log n)" corrected to "log base 2".** Cause: precision where the notation has none.
Fix: the base is a constant factor and is dropped; say "log n" and, if asked, "any base — they
differ by a constant".

**Symptom: "linear" claimed for a loop that runs to the value of the input.** Cause: n taken as
the value, not the size. Fix: say "linear in the value, exponential in the number of bits" —
and know that this is what pseudo-polynomial means, because the follow-up is "is that
polynomial?"

**Symptom: "can we do better?" answered with "no" and no reason.** Cause: no lower bound.
Fix: an Ω argument — the output size, the need to read every element, the comparison-sort
bound — or the honest "I don't know of one; the best I can see is this." **11 · Proving
optimality** *(not written yet)* is the page.

**Symptom: the sort's bound stated, the comparison cost ignored.** Cause: strings sorted as if
comparisons were constant. Fix: Θ(k · L · log k) for k strings of length L; the comparison cost
multiplies.

**Symptom: "O(1) space" claimed while modifying the input array.** Cause: in-place assumed
allowed. Fix: say it — "in place, if I may modify the input; otherwise Θ(n) for a copy" — and
ask if the statement is silent.

## Interview questions

**★ What is the difference between O, Ω and Θ, and which do interviewers mean?**
O is an upper bound — the cost grows no faster than f, up to a constant, for large n; Ω a lower
bound — no slower; Θ both, a tight bound. Interviewers say "Big-O" and mean Θ of the worst case
for the code as written: the smallest class it belongs to. "O(n²)" of a linear scan is true as a
ceiling and wrong as an answer, because the question was how fast the code is, not any bound
that holds.

**★ Why drop constants and lower-order terms, and when do they matter anyway?**
Because the notation describes growth, and as n grows the leading term dominates and the
constant is absorbed by the definition. They matter at three moments: small n, where a tight
constant quadratic beats a linearithmic with allocation — which is why library sorts use
insertion sort on short runs; two solutions in the same class, where "which is faster" is a
question about passes, allocation and cache behaviour; and the limit in the problem statement,
which says which class was intended — n ≤ 10⁵ rules out quadratic whatever the constant.

**★ What do you state when asked for the complexity of your solution?**
Five clauses, unprompted: the variable — "n is the array length"; time with the line that sets
it — "Θ(n log n), the sort"; auxiliary space with the structure that sets it, including the
recursion stack; which case — worst, and the average-case assumption behind any hash lookup;
and the follow-up preempted — what the bottleneck is and what would remove it.

**Two arrays of sizes n and m — what is wrong with saying O(n²) for a nested loop over them?**
The inputs are independent, so the bound is Θ(n · m); collapsing to n² is wrong when m is much
smaller or larger than n, and it hides that the cost is driven by the product. The same
discipline gives Θ(n + m) for a merge and Θ(V + E) for an adjacency-list traversal, where V²
would be wrong for a sparse graph.

**Is a loop that runs x times, for an integer input x, linear?**
Linear in the value of x and exponential in its size: an input of b bits has value up to 2^b,
so the loop is Θ(2^b) in the input size, which is what makes it pseudo-polynomial. Trial
division to the square root of x is the standard example — polynomial in the value, exponential
in the number of digits, and therefore not a polynomial-time primality test. Say which measure
you mean; "O(n)" with n silently the value claims more than the code delivers.

**Is JavaScript's `Map` lookup O(1)?**
Expected constant in every major engine, which use hash tables; guaranteed by the specification
only to be sublinear on average, and MDN says so explicitly — a conforming engine could use a
search tree with logarithmic lookup. Say "O(1) expected" for the round, and "sublinear by spec,
hash table in practice" if pressed; the Java equivalent is the `HashMap` javadoc's constant time
assuming the hash function disperses the keys.

**What does it mean for a bound to be output-sensitive, and why say so?**
That the cost is stated in terms of the size of the output because nothing can be smaller than
writing the output: all subsets are Θ(2ⁿ · n), all permutations Θ(n! · n), all pairs Θ(n²).
Saying so answers "can we do better?" before it is asked — no algorithm can produce an output
faster than it can write it — and it separates the enumeration's cost from any per-item work
that could still be improved.

---

← Index: [Phase 1 — Complexity analysis](README.md) · Next → **Reading complexity off code** *(not written yet)*
