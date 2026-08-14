---
title: "03.1 · The loop to run under pressure"
sidebar_label: "01 · The loop"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — method material; JavaScript specifics against MDN ([`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)). Documentation-validated; **no timings**.

**This topic is a Master row because the method is the thing being assessed**, not the algorithm.
An interviewer watching someone jump straight to code learns nothing about how they would behave
on an unfamiliar problem — which is the actual question.

## The seven steps

**1. Clarify** — before writing anything.
**2. Examples** — including the edge cases.
**3. Brute force** — stated, and its complexity named.
**4. Optimise** — name the pattern, then the approach.
**5. Code** — only now.
**6. Test** — walk your own code against your examples.
**7. State the complexity** — time and space, unprompted.

🔴 **Steps 1–4 take a third of the time and decide the outcome.** Code written from an unclear
problem is wasted regardless of how good it is, and every experienced interviewer knows that the
candidate who clarifies first is the one who will not build the wrong feature.

## 1. Clarify

Ask about **input shape, size, and the cases that change the answer**:

- Can the input be empty? Can it be `null`?
- Are values integers? Can they be **negative**? (This one changes the pattern — sliding window
  breaks on negatives, [Phase 15 · 02](../../phase-15-algorithm-patterns/02-sliding-window/README.md).)
- Are there duplicates? Does the output need to be deduplicated?
- **How large is n?** — this decides whether O(n²) is acceptable and whether recursion will
  overflow.
- Is the input sorted? Can I sort it, or does the answer need original indices?
- What should happen when there is no answer — `-1`, `null`, throw?
- Unicode: are "characters" code points, or is ASCII assumed?

⚠️ **"How large is n?" is the highest-value question**, because it converts the whole optimisation
discussion from taste into arithmetic. n ≤ 20 permits exponential; n ≤ 1000 permits O(n²);
n ≥ 10⁵ demands O(n log n) or better — and n ≥ 10⁵ also means recursion depth is a real risk
([Phase 14 · 04](../../phase-14-data-structures/04-stack/README.md)).

## 2. Examples

Write two or three by hand, and **include the edge cases you just asked about**: empty, one
element, all-equal, all-negative, no valid answer.

🔴 **These become your tests in step 6.** Writing them now, before any code exists, is what stops
them being reverse-engineered to match a buggy implementation — which is what happens when you
invent examples after the fact.

## 3. Brute force — always state it

**Say the obvious solution and its complexity out loud, then move on.** It costs twenty seconds
and it buys three things:

- It proves you understood the problem.
- It is a **correct** fallback if the optimisation does not come.
- 🔴 **It is the input to the optimisation.** For DP the brute force's parameters *are* the state
  ([01 · 02 · Spotting the state](../01-what-dp-is/02-spotting-the-state.md)); for hash-map
  patterns, the thing being scanned repeatedly is what becomes the lookup.

**Never write it in full unless asked.** "The brute force is to check every pair, O(n²)" is
enough.

## 4. Optimise — name the pattern first

Go through the shortlist explicitly rather than casting about:

| Signal | Pattern |
|---|---|
| sorted, and the answer is a pair | two pointers |
| contiguous subarray with an incrementally updatable property | sliding window |
| "find the position/value where a condition flips", sorted or monotonic | binary search |
| "have I seen", "what would the partner be" | hash map |
| shortest path, uniform edge cost | BFS |
| count the ways / min or max cost / is it possible | DP |
| find **all** the arrangements | backtracking |
| the k largest/smallest | heap |

🔴 **Then say why the near-misses do not fit.** *"Not a sliding window because the values can be
negative, so shrinking does not reduce the sum"* is a stronger signal than the correct answer given
without explanation — and it is exactly what the phase gate asks for.

**The three transformations that solve most problems:**

1. **A scan inside a loop becomes a lookup built before the loop** (hash map).
2. **Sorting first makes a pairwise property adjacent** (two pointers, intervals).
3. **A recursion that revisits states becomes memoized** (DP).

## 5. Code

Now, and **narrate as you go**. Silence is unreadable; an interviewer cannot distinguish thinking
from being stuck.

- **Meaningful names.** `left`/`right`, `seen`, `counts` — not `i`, `j`, `m`.
- **Handle the edge cases you named in step 1**, at the top.
- **Do not optimise while writing.** Get it correct, then improve if there is time.

⚠️ **If you get stuck, go back to step 2** and walk a concrete example by hand. Staring at code
does not recover a lost approach; tracing an example does.

## 6. Test — walk your own code

🔴 **Trace it line by line against your examples, out loud, in front of the interviewer.** This is
the step that gets skipped and the one that finds the bug.

The specific things to check, because these are where the bugs actually are:

- **Off-by-one** at both boundaries.
- **Empty input** — does the loop body ever run? Does the return make sense?
- **One element.**
- **The "no answer" case** — is the sentinel returned correctly?
- **Duplicates**, if the problem allows them.
- 🔴 **A JavaScript-specific pass:** `sort()` without a comparator (lexicographic —
  `[1, 10, 9]`), `Map` keys that are arrays (never hit), `shift()` in a loop (quadratic), and sums
  above `Number.MAX_SAFE_INTEGER`.

**Finding your own bug is a positive signal, not a negative one.** It is what testing is for, and
an interviewer who watches you find it learns more than one who watches clean code appear.

## 7. State the complexity, unprompted

Time and space, in the form *states × work per state* or *passes × cost per pass*, and **say what
dominates**:

> "O(n log n) — the sort dominates; the scan afterwards is O(n). Space is O(n) for the map, or
> O(1) if we can sort in place."

Then offer the trade you did not take: *"there is an O(n) version using extra memory, if space is
not a constraint."* 🔴 **Volunteering the alternative is what distinguishes a solved problem from a
considered one.**

## Gotchas

**Symptom:** A perfectly good solution to the wrong problem
**Cause:** No clarification step.
**Fix:** Ask about size, signs, duplicates, empties and the no-answer case first.

**Symptom:** The optimisation does not come and there is nothing to show
**Cause:** The brute force was never stated.
**Fix:** State it and its complexity early — it is a correct fallback and the input to the
optimisation.

**Symptom:** The chosen pattern is wrong for the input
**Cause:** Pattern-matched on surface features — "subarray" read as "sliding window" without
checking for negatives.
**Fix:** Name why the near-misses do not fit.

**Symptom:** The code is correct and the interview goes badly
**Cause:** Silence. Working without narration is unreadable from outside.
**Fix:** Narrate the plan, then the code.

**Symptom:** A bug is found by the interviewer
**Cause:** The testing step was skipped.
**Fix:** Walk your own code against the examples you wrote in step 2.

**Symptom:** Examples were invented after the code and all pass
**Cause:** They were reverse-engineered from the implementation.
**Fix:** Write them in step 2, before any code exists.

**Symptom:** Sorting produces `[1, 10, 9]`
**Cause:** No comparator.
**Fix:** Part of the JavaScript-specific test pass — check it every time.

**Symptom:** A recursive solution is chosen for n = 10⁵
**Cause:** "How large is n?" was never asked.
**Fix:** Ask early; it decides recursion, complexity target and data structure together.

## Interview questions

**★ Walk me through how you approach an unseen problem.**
Clarify, examples, brute force with its complexity, name the pattern, code, test against my own
examples, state the complexity unprompted. The first four take about a third of the time and
decide the outcome — code written from an unclear problem is wasted no matter how good it is.

**★ What is the single highest-value clarifying question?**
"How large is n?" It converts optimisation from taste into arithmetic — n ≤ 20 permits
exponential, n ≤ 1000 permits O(n²), n ≥ 10⁵ demands O(n log n) *and* means recursion depth is a
real risk.

**★ Why state a brute force you are not going to write?**
It proves you understood the problem, it is a correct fallback if the optimisation does not come,
and it is the **input** to the optimisation — for DP its parameters are the state; for hash-map
patterns, whatever it scans repeatedly is what becomes the lookup.

**★ How do you choose a pattern?**
Match against the shortlist by signal, then **say why the near-misses do not fit** — "not a sliding
window because values can be negative, so shrinking does not reduce the sum". That explanation is
worth more than the right answer alone.

**★ What do you check when testing your own code?**
Both boundaries, empty, one element, the no-answer sentinel, duplicates — and a JavaScript pass:
`sort` without a comparator, array keys in a `Map`, `shift()` in a loop, and sums above
`MAX_SAFE_INTEGER`.

**★ You find a bug while tracing. Is that bad?**
No — it is what the step is for, and the interviewer learns more from watching you find it than
from watching correct code appear. Skipping the trace so the bug is found *for* you is the bad
outcome.

**What do you do after stating the complexity?**
Offer the trade you did not take — "there is an O(n) version if we can spend the memory". It turns
a solved problem into a considered one.

---

[Topic index](./README.md) · Next → [02 · A worked run](./02-a-worked-run.md)
