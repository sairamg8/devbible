---
title: "Forty-five minutes has a shape — clarify, examples, brute force, optimise, code, test, state the complexity — with a time box for each and one moment where typing is allowed to start"
sidebar_label: "02 · The 45-minute shape"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. The shape and the time boxes are **method**, stated as tendencies across
> product-company rounds — no company's format is quoted. Code is TypeScript targeting Node 24
> (LTS) and Java 25, written to be runnable; **nothing was run**. The one runtime fact used —
> that `Map` lookups are the constant-time structure in JavaScript — is standard library
> behaviour, not measured here.

**The forty-five minutes are lost in the first five and the last ten, not in the middle. A
candidate who starts typing at minute three has skipped the two steps that decide the approach,
and one who is still optimising at minute thirty-five has no time to test — and untested code is
graded as wrong.** The shape is seven steps with a time box each: clarify (three minutes),
examples (two), brute force stated (three), optimise (five to eight), code (ten to fifteen), test
(five), complexity stated (one). The single most important rule in it is the moment typing is
allowed to start: after the plan has been said aloud, the bound stated, and the interviewer has
had a chance to object. Everything before that moment is thinking made audible; everything after
it is execution of a plan the interviewer has already accepted.

## The seven steps and their boxes

| Step | Minutes | What it produces | The sentence that ends it |
|---|---|---|---|
| **1 · Clarify** | 0–3 | the input shape, the output, the constraints, what "invalid" means | "So: an array of up to 10⁵ integers, possibly negative, return indices — one pair guaranteed?" |
| **2 · Examples** | 3–5 | one normal case worked by hand, one edge case chosen by you | "For `[2, 7, 11, 15]` and 9 the answer is `[0, 1]`; the edge I'd worry about is `[3, 3]` with 6." |
| **3 · Brute force** | 5–8 | the obvious solution, *stated not written*, with its bound | "Brute force is every pair, O(n²) — too slow for 10⁵. The bottleneck is the inner search." |
| **4 · Optimise** | 8–15 | the pattern that removes the bottleneck, and the plan | "A map of value to index turns the inner search into O(1); one pass, O(n) time and space. I'll write that." |
| **5 · Code** | 15–30 | working code, narrated | "Building the map as I go, so an element is never paired with itself." |
| **6 · Test** | 30–38 | a hand trace of the normal case and the edge case; bugs fixed | "Tracing `[3, 3]`: i=0 sets 3→0; i=1 finds 3 in the map at 0 — returns `[0, 1]`. Good." |
| **7 · Complexity** | 38–40 | the bound, stated and defended | "O(n) time, O(n) extra space; the map lookup is the constant-time step." |

The remaining five minutes absorb the follow-up (the senior twist from
[01](01-what-the-coding-rounds-grade.md)) or a second, smaller question. If the round is thirty
minutes, every box shrinks proportionally and the shape does not change.

## Step 3 is the one candidates skip

The brute force is stated for three reasons, none of which is "in case you cannot do better".
First, it is the *correctness baseline* — the thing the optimised solution must agree with, and
the thing you can fall back to if the optimisation goes wrong at minute twenty-five. Second,
naming its bound against the constraints is what tells you the target: O(n²) against 10⁵ means
you need O(n log n) or better, which narrows the pattern search to a handful. Third, the
bottleneck of the brute force *is the pattern*: "the inner loop is a search for a complement" is
one sentence away from "so a hash map". Candidates who skip the brute force are trying to
pattern-match from the problem statement, which is much harder than pattern-matching from the
bottleneck.

It is stated, not written. Writing it costs ten minutes; saying it costs thirty seconds.

## The moment typing is allowed to start

Three things have to have happened, in this order, and they take about a minute together:

1. **The plan is said aloud** — the data structure, the pass, the invariant. "One pass; a map
   from value to index; invariant: the map holds every element before the current one."
2. **The bound is stated** — time and space, against the constraints.
3. **The interviewer has had a chance to object** — a pause of a couple of seconds, or "does
   that sound right?" An interviewer who says "sure" has accepted the plan; one who says "what
   about duplicates?" has just saved you a rewrite.

Typing before the three is graded as impulsive even when the code turns out right, because the
interviewer could not see the reasoning. Typing after them is graded as executing an agreed plan,
and a bug found in step 6 is then a bug in execution, not in judgement — a much smaller thing.

## A worked round: longest substring without repeating characters

The shape, applied to a standard medium problem, with the sentences at each step.

**Clarify (0–3).** "A string of up to 10⁵ characters; return the *length* of the longest
substring with all distinct characters — not the substring itself? ASCII, or any Unicode?
Empty string returns zero?" *Three questions, each of which changes the code: length versus
substring changes what is tracked; Unicode changes how the string is iterated; empty changes the
base case.*

**Examples (3–5).** "`abcabcbb` → 3 (`abc`). Edge cases I'd watch: `bbbbb` → 1; `pwwkew` → 3
(`wke`, not `pwke`, because the window has to be contiguous); empty → 0."

**Brute force (5–8).** "Every substring, check distinctness with a set: O(n³), or O(n²) if I
extend a set as I grow each substring. Too slow for 10⁵. The bottleneck is that when a repeat
appears I restart from scratch instead of sliding."

**Optimise (8–15).** "Sliding window: two indices, a map from character to its last index. Move
the right end one character at a time; if the character was seen inside the current window, jump
the left end past its last occurrence. Each index moves forward only, so O(n) time; the map is
bounded by the alphabet, so O(min(n, alphabet)) space. Invariant: the window `[left, right]`
contains no repeats. I'll write that."

**Code (15–30).**

```ts
export function lengthOfLongestSubstring(s: string): number {
  // invariant: s[left..right] has no repeated character
  const lastIndex = new Map<string, number>(); // char -> most recent index seen
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    const prev = lastIndex.get(ch);
    if (prev !== undefined && prev >= left) {
      left = prev + 1; // jump past the earlier occurrence; never move left backwards
    }
    lastIndex.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

*Narrated as it goes in:* "`prev >= left` is the subtle check — a repeat *outside* the window
must not move `left` backwards, which is the bug the `pwwkew` case catches." The Java version,
for a Java loop, has the same shape and one extra decision to say aloud:

```java
import java.util.HashMap;
import java.util.Map;

public final class LongestUniqueSubstring {
    public static int lengthOfLongestSubstring(String s) {
        // for ASCII an int[128] beats the map; the map keeps the code alphabet-agnostic
        Map<Character, Integer> lastIndex = new HashMap<>();
        int left = 0, best = 0;
        for (int right = 0; right < s.length(); right++) {
            char ch = s.charAt(right);           // charAt: UTF-16 units, so a surrogate pair is two "chars"
            Integer prev = lastIndex.get(ch);
            if (prev != null && prev >= left) left = prev + 1;
            lastIndex.put(ch, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}
```

**Test (30–38).** "Tracing `pwwkew`: right=0 `p` → best 1; right=1 `w` → 2; right=2 `w`, prev=1
≥ left=0 → left=2, best stays 2; right=3 `k` → 2; right=4 `e` → 3; right=5 `w`, prev=2 ≥ left=2 →
left=3, window `kew` length 3. Returns 3. Now `abba`: right=3 `a`, prev=0, left is already 2 — the
`prev >= left` check keeps `left` at 2. Good." *Two traces, the second chosen because it is the
one that would catch the classic bug.*

**Complexity (38–40).** "O(n) time — each index moves forward at most n times; O(min(n, σ))
space for the map, where σ is the alphabet."

**Follow-up (40–45).** "Return the substring itself, not the length" — track the start index of
the best window when `best` updates. "Now allow at most k repeats" — the window condition
changes to a count map, the same shape.

## What to drop when behind

At minute twenty-five with no working code, the order of sacrifice:

1. **Drop the optimisation, keep correctness.** Write the brute force you stated in step 3 — it
   is correct and it is what you promised — and say "I'll get this working, then improve it if
   there's time." A working O(n²) solution with a stated path to O(n) is graded far above an
   unfinished O(n).
2. **Never drop the tests.** Five minutes of tracing is what turns "probably right" into
   "right". If code and tests will not both fit, shorten the code by simplifying, not the tests.
3. **Drop the second example, not the edge case.** One normal case and the edge case you fear is
   enough.
4. **Say the complexity in one sentence** even if there is no time to defend it.

What is never dropped is the plan-aloud moment before typing. Skipping it to save a minute costs
the round its only evidence of judgement.

## Gotchas

**★ Symptom: typing at minute three, and a rewrite at minute twenty.** Cause: the plan was never
said aloud, so the interviewer's "what about duplicates?" arrived after the code existed. Fix: the
three things before typing — plan, bound, a pause for objections — every time, even when the
problem looks familiar.

**★ Symptom: an optimal solution with a bug, and no time to find it.** Cause: optimising through
minute thirty-five; the test box was consumed. Fix: a visible clock and a hard rule — code stops
at minute thirty regardless; if it is not working, fall back to the stated brute force and test
that.

**Symptom: the brute force skipped, and ten minutes of staring at the problem for a pattern.**
Cause: pattern-matching from the statement instead of from the bottleneck. Fix: say the brute
force and its bound; name the inner operation that is expensive; the pattern is usually one
sentence from there.

**Symptom: eight minutes of clarifying questions.** Cause: thoroughness in the easy step. Fix:
three questions — input shape, output form, constraints — and one edge case; state assumptions
for anything else and move.

**Symptom: the trace was of the example in the prompt, and the edge case failed in the
interviewer's follow-up.** Cause: the test box spent on the case that was never going to fail.
Fix: trace the edge case *you* named in step 2, chosen because it exercises the subtle line —
`pwwkew` for the window jump, `[3, 3]` for self-pairing.

**Symptom: the follow-up arrived and the code needed a rewrite.** Cause: variables and structure
chosen for the first question only. Fix: nothing to do in the round; in practice, solve the
follow-ups ([01](01-what-the-coding-rounds-grade.md)) so the first solution is written in the
shape that extends.

**Symptom: the interviewer said "you can start coding" and you kept planning.** Cause: the shape
followed as a script rather than as a means. Fix: the interviewer's go-ahead *is* step three's
pause; take it.

## Interview questions

**★ Walk through how you would spend forty-five minutes on a medium problem.**
Three minutes clarifying input shape, output, constraints and invalid cases; two on a normal
example and an edge case of my choosing; three stating the brute force and its bound against the
constraints; five to eight finding the pattern that removes its bottleneck and saying the plan and
the bound aloud; a pause for objections; ten to fifteen coding while narrating; five to eight
tracing the normal case and the edge case by hand and fixing what I find; one stating time and
space. The remaining minutes go to the follow-up.

**★ When is it acceptable to start typing?**
After the plan has been said aloud — the structure, the pass, the invariant — the time and space
bound has been stated against the constraints, and the interviewer has had a moment to object.
Typing before that is graded as impulsive even when the code is right, because the reasoning was
invisible; typing after it turns any later bug into an execution error rather than a judgement
error.

**Why state a brute force you do not intend to write?**
It is the correctness baseline the optimised solution must agree with and the fallback if the
optimisation fails late; its bound against the constraints tells you what class the target must
be in; and its bottleneck is one sentence from the pattern — "the inner loop searches for a
complement" leads directly to a hash map. Stating it costs thirty seconds; skipping it usually
costs ten minutes of pattern-hunting from the problem statement.

**You are at minute twenty-five with no working code. What do you drop?**
The optimisation, never the tests. Write the brute force stated earlier, say that it is the
fallback and where the improvement would go, and spend the remaining time tracing it. A working
quadratic solution with a stated path to linear is graded well above an unfinished linear one,
because correctness is the gate. Keep one edge-case trace and a one-sentence complexity
statement; drop the second example.

**Which test case do you trace, and why that one?**
The edge case named before coding, chosen because it exercises the line most likely to be wrong —
`pwwkew` for a sliding window's jump, `abba` for the "do not move left backwards" check, `[3, 3]`
for self-pairing in two-sum. The prompt's example almost never fails; tracing it is spending the
test box on evidence the interviewer already has.

**How does the shape change for a thirty-minute round?**
Every box shrinks proportionally and none is removed: two minutes clarifying, one on examples,
two on the brute force, four or five optimising, eight to ten coding, four testing, one on
complexity. The plan-aloud moment before typing survives unchanged, because it is the only
evidence of judgement the round produces and it costs a minute at any length.

---

← Prev: [01 · What the rounds grade](01-what-the-coding-rounds-grade.md) · Index: [Phase 0 — The DSA interview and the practice system](README.md) · Next → **The method: understand, match, plan, implement, review, evaluate** *(not written yet)*
