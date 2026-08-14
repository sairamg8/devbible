---
title: "01.1 · What the notation says"
sidebar_label: "01 · What it says"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — definitional material from the standard analysis-of-algorithms treatment; JavaScript-specific claims checked against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)) and the [ECMAScript specification](https://tc39.es/ecma262/). Documentation-validated; **no timings**, because no benchmark was run.

**Big-O describes how a cost grows as the input grows.** It is not a speed, not a duration, and
not a claim about your machine. Once that is genuinely internalised, most of the confusion around
it disappears.

## The definition, in the form you will use

> An algorithm is **O(f(n))** if, beyond some input size, its cost is at most a constant multiple
> of `f(n)`.

Two consequences, and they are the ones that get skipped:

- **"Beyond some input size."** Big-O says nothing about small inputs. An O(n²) algorithm can
  beat an O(n log n) one comfortably at n = 20 — which is exactly why real sort
  implementations switch to insertion sort under a threshold.
- **"At most."** Big-O is an **upper bound**. Every O(n) algorithm is also, truthfully, O(n²).
  Saying "this is O(n²)" about a linear scan is not wrong, it is useless — and in an interview it
  reads as not knowing the difference. Give the **tightest** bound you can justify.

## Dropping constants and lower-order terms

```js
function summarize(rows) {
  let total = 0;
  for (const r of rows) total += r.amount;      // n
  for (const r of rows) total += r.tax;         // n
  return { total, count: rows.length };         // 1
}
```

`n + n + 1` → **O(n)**. Two passes are not "O(2n)"; the notation deliberately discards the
constant because it is about *shape*, not about the number of passes.

🔴 **This is exactly where the notation stops being useful and engineering starts.** Two passes
really are twice the work. If the loop body is expensive, or the array is large enough to matter
for cache behaviour, merging the passes is a real improvement that Big-O cannot express. **"Same
complexity" does not mean "same cost."**

The corresponding lie in the other direction is treating a constant as free: `O(1)` on a hash
lookup and `O(1)` on a network round trip are the same symbol and eight orders of magnitude apart.

## Best, average and worst case

```js
function find(rows, id) {
  for (const r of rows) if (r.id === id) return r;   // best O(1), average O(n), worst O(n)
  return null;
}
```

**Default to the worst case** unless you say otherwise — it is what "the complexity of this
function" means by convention, and it is the only one that bounds anything.

Two places where the distinction is load-bearing rather than pedantic:

- **Quicksort** is O(n log n) average and **O(n²) worst**, which is why library sorts use hybrids
  with guaranteed bounds rather than textbook quicksort.
- **Hash lookup** is O(1) average and **O(n) worst** when every key collides. Normally
  theoretical — and the basis of real hash-collision denial-of-service attacks, which is why
  languages randomise hash seeds.

**Amortised** is a fourth thing, and it is not "average": it is the guaranteed cost per operation
across a *sequence*. `push` is amortised O(1) even though an individual `push` occasionally
reallocates — the expensive steps are rare enough that any run of *n* pushes costs O(n) total.
The full argument is **07 · Amortised analysis** *(not written yet)*.

## Space complexity is a separate answer

```js
const doubled = rows.map((r) => r.amount * 2);      // O(n) time, O(n) space
let total = 0;
for (const r of rows) total += r.amount;            // O(n) time, O(1) space
```

State both when asked for "the complexity". The usual mistakes:

- **Forgetting the output.** By convention the *returned* structure is often excluded ("auxiliary
  space"), but say which convention you are using rather than leaving it ambiguous.
- **Forgetting the call stack.** Recursion depth is space. A recursive traversal of a balanced
  tree is O(log n) space; of a linked list, O(n) — and in JavaScript that is a
  `RangeError: Maximum call stack size exceeded` rather than an abstraction
  (**04 · Space complexity and the call stack**, *not written yet*).

## The notations that are not O

| Notation | Means | Use |
|---|---|---|
| **O(f)** | grows **at most** like f | upper bound — the default |
| **Ω(f)** | grows **at least** like f | lower bound — "no comparison sort beats Ω(n log n)" |
| **Θ(f)** | grows **exactly** like f | tight bound — when upper and lower agree |

In practice everyone says "O" and means Θ. That is fine in conversation, and knowing that Θ is
what you actually mean is what lets you answer *"is that a tight bound?"* without flailing.

## What Big-O cannot tell you

- **Constants and hidden work.** `arr.includes(x)` is O(n) with a tiny constant; a comparator
  that parses a date string is O(1) with a huge one.
- **Memory hierarchy.** A linear scan of a packed array can beat a "better" algorithm that
  chases pointers, because cache locality is not in the model.
- **What the engine does.** V8 can inline, hoist and specialise; it can also deoptimise a
  function because the shape of your objects changed. None of that appears in a bound.
- **The dominant cost of most web code**, which is usually a network round trip, a layout, or a
  JSON parse — not the loop you are analysing.

🔴 **So the honest rule is: use Big-O to reject the algorithm that will not scale, then measure to
make the survivor fast.** Complexity analysis is for choosing between shapes; a profiler is for
everything after that. Using either for the other's job is the mistake this phase exists to
prevent.

## Gotchas

**Symptom:** "It is O(n²) but it is fine" turns out to be true
**Cause:** Big-O describes growth beyond some input size; at n = 20 constants dominate.
**Fix:** Know your actual n. Optimise the shape when n can grow, not on principle.

**Symptom:** An answer of "O(n²)" for a single loop is called wrong
**Cause:** It is a true upper bound but not a tight one.
**Fix:** Give the tightest bound you can justify; say Θ if asked.

**Symptom:** Two implementations with the same complexity differ several-fold
**Cause:** Constants and hidden per-item work are dropped by the notation.
**Fix:** Measure. "Same complexity" is not "same cost".

**Symptom:** A hash-based lookup degrades badly under adversarial input
**Cause:** Hash lookup is O(1) average, O(n) worst under collisions.
**Fix:** Do not key untrusted input into a structure whose worst case you cannot afford.

**Symptom:** `RangeError: Maximum call stack size exceeded` on a large input
**Cause:** Recursion depth is space, and JavaScript's stack is small.
**Fix:** Convert to iteration with an explicit stack.

**Symptom:** An "optimisation" of an O(n) function changes nothing
**Cause:** The dominant cost was elsewhere — a round trip, a parse, a layout.
**Fix:** Profile before optimising; complexity analysis does not identify hotspots.

**Symptom:** A sort is fine in tests and pathological in production
**Cause:** Average versus worst case — the production data hit the bad shape.
**Fix:** State worst case by default, and prefer implementations with guaranteed bounds.

## Interview questions

**★ What does O(n) actually assert?**
That beyond some input size, the cost is at most a constant multiple of n. It is a statement about
**growth**, not about duration, and it says nothing about small inputs or about constants.

**★ Is a linear scan O(n²)?**
Technically yes — Big-O is an upper bound and every O(n) algorithm is also O(n²). It is a true
statement and a useless one. Interviewers are asking for the **tightest** bound; Θ(n) is what you
mean.

**★ Why drop constants if two passes really are twice the work?**
Because the notation compares *shapes* across growing inputs, where a constant factor is
irrelevant to whether something scales. It is simultaneously true that merging the passes is a
real improvement — which is why complexity analysis does not replace measurement.

**★ Best, average, worst — which do you quote?**
Worst case by default; say so if you mean otherwise. It matters for quicksort (O(n log n) average,
O(n²) worst) and for hash lookups (O(1) average, O(n) worst under collisions — the basis of real
hash-collision attacks).

**★ How is amortised different from average?**
Average is over a distribution of inputs; amortised is a guarantee over a *sequence* of
operations. `push` is amortised O(1): individual pushes occasionally reallocate, but any n pushes
cost O(n) in total.

**★ Does recursion depth count as space?**
Yes — each frame is space. A balanced-tree traversal is O(log n) space; a linked-list traversal is
O(n), and in JavaScript that becomes `RangeError: Maximum call stack size exceeded` rather than a
theoretical concern.

**When is Big-O the wrong tool?**
When choosing between two implementations of the same shape, or when the cost is dominated by a
network round trip, a parse or a layout. Use it to reject what cannot scale; measure to make the
survivor fast.

---

[Topic index](./README.md) · Next → [02 · Reading a bound off the code](./02-reading-a-bound.md)
