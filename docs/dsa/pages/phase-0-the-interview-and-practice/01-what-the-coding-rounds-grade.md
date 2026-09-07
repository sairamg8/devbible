---
title: "Coding rounds grade five things — correctness, complexity, code quality, communication and how you take a hint — and the senior twist is the follow-up that changes the constraints after you have solved it"
sidebar_label: "01 · What the rounds grade"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. What rounds grade is a **synthesis of how product-company coding rounds
> tend to run** — no company's rubric is quoted, no statistic is used. Code is TypeScript targeting
> Node 24 (LTS) and Java 25, written to be runnable; **nothing was run**. Runtime facts cited on
> later pages come from MDN and the JDK 25 API documentation.

**A coding round is not "did you solve it". It is a form with about five lines — correctness,
complexity, code quality, communication, and how you respond to a hint — and the interviewer
writes evidence against each.** Correctness is graded on the edge cases you tested, not the happy
path you ran. Complexity is graded on whether you *stated* the bound and could defend it, and on
whether you noticed the brute force was too slow before writing it. Code quality is names,
structure and the absence of the accidental quadratic, read by someone who reviews code for a
living. Communication is whether the interviewer knew what you were doing at every minute. And the
hint line — the one candidates forget exists — is whether a nudge was taken and used. At senior
level a sixth thing is graded: the follow-up that changes the constraints after you have a
working solution, because that is where "knows the pattern" and "can reason" separate.

## The five lines

| Line | What the interviewer writes if it went well | What they write if it did not |
|---|---|---|
| **Correctness** | "Listed edge cases before coding — empty, one element, duplicates, negatives — and traced two of them by hand after" | "Ran the example, declared it done; missed the empty input when I asked" |
| **Complexity** | "Said O(n) time, O(n) space before typing; named the built-in that would have made it quadratic" | "Asked for complexity at the end; said 'linear-ish'" |
| **Code quality** | "Clear names, one helper, no dead branches; the invariant was in a comment" | "Single-letter names, a nested loop hidden in an `includes` call, three unused variables" |
| **Communication** | "Narrated the plan before typing; said what each block does as it went in; asked before optimising" | "Silent for six minutes, then a wall of code I had to read cold" |
| **The hint** | "I hinted 'what if you sorted first' — took it immediately and explained why it helps" | "Hint given twice; kept going down the original path" |

The rows are not equal. Correctness is the gate — a wrong solution with beautiful code is a no —
but among candidates who reach a correct solution, the other four lines decide the level, and
communication decides how much of the first three the interviewer actually saw.

## Correctness is graded on the edges

The happy-path example in the prompt is the one everyone gets. Correctness evidence is the cases
you generated yourself, before coding, and then traced after:

- **Empty input**, and the single-element input.
- **Duplicates**, where the problem's wording quietly assumes distinctness.
- **Negatives and zero**, where a sum or a product changes sign or collapses.
- **The boundary** — the first and last index, `k` equal to the length, the window exactly the
  size of the array.
- **Overflow** — sums that exceed a 32-bit `int` in Java, or the safe-integer range in
  JavaScript.
- **The degenerate shape** — an already-sorted input, all elements equal, a tree that is a linked
  list.

The interviewer's list is the same one, and the grade is whether yours was on the board first.
[08 · Testing your own code live](08-testing-your-own-code-live.md) is the mechanics.

## Complexity is graded on the statement, then the defence

Two habits produce the evidence. First, **say the bound before you type**: "this is O(n) with a
hash map, O(n) extra space; the brute force would be O(n²)". Second, **defend it line by line
when asked**, including the built-ins — `sort` is O(n log n), `includes` inside a loop is the
hidden quadratic, `shift` on an array is O(n) per call. The candidate who says "I'll use a
set here so the lookup is O(1) rather than the O(n) of `includes`" has produced the evidence
and shown they know where the costs hide. [Phase 1](../../syllabus/01-foundations.md) of the
syllabus is where the reading-off-code skill is built; the grade here is whether it is *said*.

## Code quality is read by a reviewer

The interviewer reads your code the way they read a pull request, and the same things register:

```ts
// two-sum, written the way a reviewer wants to read it in an interview:
// the invariant is stated, the names carry meaning, the edge cases are visible
export function twoSum(nums: readonly number[], target: number): [number, number] | null {
  // invariant: seen maps every value at index < i to its index
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    const j = seen.get(complement);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i); // set after the lookup so an element is never paired with itself
  }
  return null; // caller decides whether "no pair" is an error
}
```

What a reviewer notices: the invariant is written down; the order of `get` then `set` is
explained because it is the one line a bug would hide in; the return type says what "not found"
looks like rather than throwing or returning `[-1, -1]` silently. The same problem in Java, for
the loop where Java is the interview language:

```java
import java.util.HashMap;
import java.util.Map;

public final class TwoSum {
    /** Returns indices [j, i] with j < i and nums[j] + nums[i] == target, or null. */
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();   // value -> index, for indices < i
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];          // int arithmetic: state the overflow assumption
            Integer j = seen.get(complement);
            if (j != null) return new int[] {j, i};
            seen.put(nums[i], i);
        }
        return null;
    }
}
```

The Java version carries one extra line of evidence — the overflow comment — because `target -
nums[i]` on `int` is a real question in Java and a reviewer will ask it.

## Communication is what makes the rest visible

The pattern that reads well: **plan aloud before typing** ("brute force is the double loop, O(n²);
a map of seen values makes it linear; I'll write the map version"), **narrate each block as it
goes in**, **say the invariant**, and **announce the test** ("let me trace `[3, 3]` with target
6 — that's the self-pairing case"). Silence while typing is acceptable in short stretches if the
plan was stated; six silent minutes followed by a wall of code is graded as unreadable even when
the code is right. **11 · Communication mechanics** *(not written yet)* has the phrases.

## The hint is a graded line

Interviewers hint on purpose, and the response is graded. A hint taken immediately and used —
"sorting first — yes, then two pointers from the ends, because a sorted array lets me move the
pointer that must move" — is strong evidence: it shows you can be redirected and reason from the
new information. A hint ignored, or acknowledged and then abandoned for the original path, is
graded as the opposite. The failure is common because a hint feels like a judgement; it is not.
An interviewer who hints is investing in the round, and the [when-stuck protocol](07-the-when-stuck-protocol.md) is built around asking for one before the silence grows.

## The senior twist: the constraints change

At senior level, solving the problem is the warm-up. The graded moment is the follow-up that
changes a constraint after the solution works, because a memorised pattern cannot answer it and a
reasoned one can:

| After you solved… | The follow-up | What a reasoned answer does |
|---|---|---|
| two-sum with a map | "the array is sorted — can you do it in O(1) space?" | two pointers from the ends; explains which pointer moves and why |
| two-sum with a map | "the numbers arrive as a stream and you need `find(target)` many times" | keeps the map, adds `add(n)`; discusses duplicates and the cost per query |
| top-k with a full sort | "k is tiny and n does not fit in memory" | a min-heap of size k over the stream, O(n log k) |
| a recursive tree walk | "the tree is a million nodes deep" | converts to an explicit stack; names Node's recursion limit as the reason |
| an in-place solution | "the input must not be modified" | copies, or reformulates with an index array; states the space cost |
| a hash-based solution | "no extra memory" | sorts in place and pays O(n log n); says that is the trade |

Each row is answered by re-deriving from the changed constraint, and the grade is the visible
re-derivation, not whether the second answer was optimal. This is the same test the design rounds
run ([the System Design track's phase 0](../../../system-design/pages/phase-0-the-interview/08-reasoned-wrong-beats-memorised-right.md)
covers the reasoning), and it is why the practice system on later pages is built around
follow-ups rather than first solutions.

## Gotchas

**★ Symptom: solved it, tests passed, and the feedback says "did not handle edge cases."**
Cause: correctness graded on the cases you generated, and you generated none. Fix: before typing,
list empty, one element, duplicates, negatives and the boundary aloud; after typing, trace two of
them by hand. The list on the board is the evidence.

**★ Symptom: the solution was linear and the feedback says "complexity unclear."** Cause: the
bound was never stated, or was stated as "linear-ish". Fix: say the time and space bound before
typing and again at the end, and name the built-in that would have broken it — "a set, not
`includes`, so the lookup is constant."

**Symptom: correct, and "hard to follow."** Cause: silent typing. Fix: plan aloud, narrate each
block, state the invariant, announce the test; the interviewer should never have to read code
cold.

**Symptom: the interviewer hinted twice and you finished your own approach.** Cause: the hint
heard as criticism. Fix: take it immediately and say why it helps; if you genuinely think your
path is better, say so in one sentence and ask — never silently ignore it.

**Symptom: strong first solution, and the follow-up produced a pause and the same code again.**
Cause: the pattern was recalled, not derived; there was nothing to re-derive from. Fix: practise
the follow-ups — sorted input, stream, no extra memory, deep recursion — for every pattern until
re-deriving is reflexive; the first solution takes care of itself.

**Symptom: an `includes` inside a loop, and a grade of "accidental quadratic."** Cause: code
quality read as a reviewer reads it, and the hidden cost noticed. Fix: know the cost of every
built-in you call, and reach for a set or map whenever a loop contains a lookup.

**Symptom: Java solution, and "what if the sum overflows?"** Cause: `int` arithmetic assumed
safe. Fix: state the assumption or use `long`; in JavaScript, state the safe-integer range and
when `BigInt` would be needed.

**Symptom: a helper named `f`, a variable named `x`, and a comment-free block.** Cause: writing
for the compiler rather than the reader. Fix: names that carry meaning, the invariant in a
one-line comment, and no dead code left behind after a change of plan.

## Interview questions

**★ What do coding rounds grade, and which line is the gate?**
Correctness, complexity, code quality, communication and the response to a hint. Correctness is
the gate — a wrong solution is a no regardless of the rest — but among correct solutions the other
four decide the level, and communication decides how much of the first three the interviewer
actually saw. At senior level a sixth thing is graded: the follow-up that changes a constraint
after the solution works, which separates a recalled pattern from a derived one.

**★ How is correctness actually graded, given that the example in the prompt is easy?**
On the cases you generate yourself: empty and single-element inputs, duplicates, negatives and
zero, the boundaries of the index range, overflow, and degenerate shapes such as an already-sorted
array or a tree that is a list. The interviewer holds the same list and grades whether yours was
on the board first, and whether you traced two of them by hand after writing the code rather than
declaring done when the example passed.

**★ Why is the follow-up that changes a constraint the senior test?**
Because the first solution to a known problem is public and carries little information, while
re-deriving under a changed constraint — sorted input, a stream, no extra memory, a million-deep
tree — shows whether the pattern was understood or memorised. A reasoned candidate walks back to
the assumption that changed and re-derives; a memorised one has nothing to walk back along. The
grade is the visible re-derivation, not the optimality of the second answer.

**What does "code quality" mean to an interviewer reading your solution?**
What a reviewer notices in a pull request: names that carry meaning, the invariant stated, the
one subtle line explained (the `get` before `set` in two-sum), a return type that says what
"not found" is, no dead code, and no hidden cost such as a lookup inside a loop. It is graded
because the round is a proxy for the code you will submit for review, and a reviewer's eye is the
one reading it.

**How should you respond to a hint, and why does it matter?**
Take it immediately, say why it helps, and use it — "sorting first, then two pointers, because
sorted order tells me which pointer must move." A hint is a graded line: taking one shows you can
be redirected and reason from new information; ignoring one, or acknowledging it and returning to
the original path, is graded as the opposite. If you believe your path is better, say so in one
sentence and ask; never go silent on it.

**Why say the complexity before you type rather than when asked?**
Because the statement is the evidence, and a bound stated before coding shows you chose the
approach for its cost rather than discovering the cost afterwards. It also catches the brute
force that is too slow for the constraints before the time is spent writing it — "O(n²) with n up
to a hundred thousand is too slow; I need the map" — which is the reading-the-constraints skill
the next pages build.

---

← Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → [02 · The 45-minute shape](02-the-45-minute-shape.md)
