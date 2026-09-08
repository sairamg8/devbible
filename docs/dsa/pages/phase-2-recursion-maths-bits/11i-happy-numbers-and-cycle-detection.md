---
title: "Happy numbers look like a digit problem and are actually the linked-list cycle problem in disguise — every value has exactly one successor, so the trajectory is a rho and Floyd's two pointers decide it in constant space"
sidebar_label: "11i · Happy numbers and cycles"
sidebar_position: 11.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Floyd's cycle detection, the pigeonhole bound and the specific cycle traced
> below are **elementary mathematics and common practice, derived on this page rather than cited** —
> the research bank for this phase records that these problems have no primary source. Every value in
> the traced cycle is **arithmetic performed in the text, not program output**. The digit loop it is
> built on is [11](11-number-problems-that-recur.md). **No sandbox run.**

**The instructive thing about happy numbers is not the answer but the reclassification.** Replace a
number by the sum of the squares of its digits, repeat, and ask whether you ever reach 1. Written
that way it is a digit problem. But the replacement is a *function* — each value has exactly one
successor — so the trajectory from any starting point is a path that eventually revisits a value and
then repeats forever: the rho shape, a tail leading into a cycle. Deciding "does this reach 1"
becomes "does the cycle contain 1", which is cycle detection, which is Floyd's tortoise and hare —
the linked-list algorithm, applied to a sequence with no list in sight. **Recognising a functional
graph where the problem statement showed you arithmetic is the transferable skill**, and it is the
same recognition that solves "find the duplicate number" in an array.

## Why the sequence must cycle, with a bound

The successor function is `f(n) = ` sum of the squares of `n`'s decimal digits, which is
[11](11-number-problems-that-recur.md)'s loop with a squaring accumulator.

For a `d`-digit number the largest possible value of `f` is `d · 81`, since no digit's square
exceeds `81`. Compare that with the smallest `d`-digit number, `10^(d−1)`:

- `d = 4`: `f ≤ 324`, while the smallest four-digit number is `1000`. So **every** number with four
  or more digits strictly decreases under `f`, and by more than a little.
- `d = 3`: `f ≤ 243`, so from three digits the sequence stays below `1000` forever.

Therefore, from any starting point, the trajectory enters the finite set `{1, …, 999}` within a
couple of steps and never leaves it. A sequence of infinitely many terms drawn from a finite set must
repeat a value, and once a value repeats, everything after it repeats identically because `f` is
deterministic. **The trajectory is eventually periodic — that is the pigeonhole argument, and it is
the answer to "how do you know it terminates?"**

There is exactly one non-trivial cycle, and you can derive it rather than recall it. Start at 4:

`4 → 16 → 1 + 36 = 37 → 9 + 49 = 58 → 25 + 64 = 89 → 64 + 81 = 145 → 1 + 16 + 25 = 42 →
16 + 4 = 20 → 4 + 0 = 4`

Eight values, closing back on 4. And `1 → 1` is the fixed point. So "unhappy" means "falls into that
eight-cycle". Some solutions test `n === 4` as the sole termination condition, which is correct and
is a *memorised* fact — deriving it in front of the interviewer, as above, is better than producing
it from nowhere.

## Three solutions, in increasing order of what they demonstrate

```ts
function next(n: number): number {
  let sum = 0;
  while (n > 0) {
    const d = n % 10;
    sum += d * d;
    n = Math.trunc(n / 10);       // Math.trunc, per 11
  }
  return sum;
}
```

**1 — A set of seen values.** `Θ(1)` amortised per step, `Θ(k)` space in the length of the tail plus
the cycle. Obviously correct and perfectly shippable:

```ts
function isHappySet(n: number): boolean {
  const seen = new Set<number>();
  while (n !== 1 && !seen.has(n)) { seen.add(n); n = next(n); }
  return n === 1;
}
```

**2 — Floyd's tortoise and hare.** `Θ(1)` space, and the answer the question is fishing for:

```ts
function isHappy(n: number): boolean {
  let slow = n, fast = n;
  do {
    slow = next(slow);
    fast = next(next(fast));
  } while (slow !== fast);
  return slow === 1;
}
```

```java
static boolean isHappy(int n) {
    int slow = n, fast = n;
    do {
        slow = next(slow);
        fast = next(next(fast));
    } while (slow != fast);
    return slow == 1;
}
```

**Why it terminates and why it is correct.** Both pointers walk the same rho. Once both are inside
the cycle, the hare gains exactly one position on the tortoise per iteration — it moves two, the
tortoise moves one — so the gap, measured around the cycle, decreases by one each step and must
reach zero. They therefore meet, in a number of steps bounded by the tail length plus the cycle
length. When they meet, the meeting value is a member of the cycle; if that value is `1`, the cycle
is the fixed point `1 → 1` and the number is happy. **No null check is needed**, unlike the
linked-list version, because `f` is total — every number has a successor, so the hare can never run
off the end.

Note the `do/while`: with a `while` the loop body would never execute, since `slow` and `fast` start
equal. That is the same shape as the zero-guard in [11](11-number-problems-that-recur.md) and it is
the most common transcription bug in this algorithm.

**3 — Test for the known cycle.** `while (n !== 1 && n !== 4) n = next(n); return n === 1;` Correct,
constant space, and it depends on the derived fact that every unhappy trajectory passes through 4.
Give it as a follow-up, not as the first answer, and show the derivation.

## The part that makes this worth learning: finding the cycle's *entry*

Floyd has a second phase that most people skip, and it is what turns this from a puzzle into a tool.
After the meeting, reset one pointer to the start and advance **both one step at a time**; they meet
at the first node of the cycle.

The reason is a distance argument. Let `μ` be the tail length (steps before the cycle starts) and
`λ` the cycle length. At the meeting the tortoise has taken some number of steps `k` and the hare
`2k`, so `k` is a multiple of `λ`. A pointer starting at the beginning and one starting at the
meeting point are therefore `μ` steps and `k − μ` steps from the cycle entry respectively, and since
`k` is a multiple of `λ`, advancing both by `μ` lands them both on the entry. ∎

**Why you care:** "find the duplicate number in an array of `n + 1` integers each in `[1, n]`,
without modifying the array and in constant space" is exactly this. Treat the array as a function
`i ↦ a[i]`. Because every value is a valid index, the function is total on the index space and the
trajectory from index `0` is a rho — and the entry of its cycle is the duplicated value, because the
duplicate is the only index reachable from two different predecessors. Same two phases, same code
shape, a completely different-looking problem.

Brent's algorithm is the alternative cycle detector: it uses powers-of-two teleportation instead of
a fixed two-to-one ratio and evaluates the successor function fewer times. **Named here as a
pointer, not derived** — Floyd is what is asked for and what fits on a whiteboard.

## Gotchas

**★ Symptom: the Floyd version returns immediately, or always returns true.** Cause: a `while` loop
where a `do/while` is needed. `slow` and `fast` are initialised to the same value, so the condition
`slow !== fast` is false before the first step. Fix: `do { … } while (slow !== fast)`.

**★ Symptom: an infinite loop.** Cause: the successor function is not total for some input — most
often `next(0)` written with `while (n > 0)` returning 0 forever, which is actually fine, or a
version that can produce a negative and then loop. Fix: confirm `f` is total and check that every
value maps forward. Floyd assumes a functional graph; if your `f` can fail to produce a successor,
the algorithm's guarantee does not apply.

**★ Symptom: negative input loops forever or returns nonsense.** Cause: `while (n > 0)` never runs
for a negative `n`, so `next(n)` is `0`, and `0 → 0` is a cycle that is neither 1 nor the known
four-cycle. Fix: define the domain. Happy numbers are defined on positive integers; reject
non-positive input rather than letting it fall into a degenerate fixed point.

**★ Symptom: the digit loop uses `n / 10` in TypeScript.** Cause: floating-point division. Fix:
`Math.trunc`. It is the same first bug as everywhere in this topic, and here it produces a
non-integer that never equals any other value, so the cycle is never detected and the loop hangs.

**★ Symptom: a solution that hardcodes `n === 4` and cannot justify it.** Cause: memorisation. Fix:
derive the eight-cycle by applying `f` from 4 — `4, 16, 37, 58, 89, 145, 42, 20, 4` — and state that
it is the only non-trivial cycle in the reachable set. The check is correct; being unable to explain
it is what costs you.

**★ Symptom: the `Set` version is rejected as "too much space".** Cause: an interviewer looking for
Floyd. Fix: offer both and name the trade — the set is `Θ(k)` space and obviously correct, Floyd is
`Θ(1)` space with a correctness argument you should then give. In real code the set version is
frequently the better choice, since `k` here is bounded by the size of the reachable set, and saying
so is a stronger answer than pretending constant space is always the goal.

**★ Symptom: the same code applied to a linked list crashes.** Cause: the null check omitted. In a
list the hare must test `fast !== null && fast.next !== null` before dereferencing twice, because a
list can end. The happy-number version needs no such check precisely because `f` is total — and
transplanting the version without the check is the error. Fix: know *why* the check is absent here
before you remove it there.

**★ Symptom: "find the duplicate" solved by sorting or by a frequency map when the problem forbade
extra space and mutation.** Cause: not spotting the functional graph. Fix: the array is a function
from index to value because every value is a valid index; run Floyd and then the entry-finding
phase. The duplicated value is the cycle entry because it is the only index with two predecessors.

## Interview questions

**★ Determine whether a number is happy.**
Repeatedly replace it with the sum of the squares of its digits. The map is a function, so the
trajectory is eventually periodic — for any number with four or more digits the successor is at most
`4 × 81 = 324`, far below `1000`, so the sequence drops into `{1, …, 999}` and by pigeonhole must
repeat. Detect the repeat with Floyd's tortoise and hare in `Θ(1)` space: advance one pointer one
step and the other two, until they meet, then answer whether the meeting value is 1. A `HashSet` of
seen values is the `Θ(k)`-space alternative and is perfectly reasonable code.

**★ Why does the tortoise and hare always meet?**
Once both pointers are inside the cycle, the hare closes the gap by exactly one position per
iteration, because it advances two while the tortoise advances one. A gap that decreases by one each
step and is measured modulo the cycle length must reach zero, so they meet — within a number of
steps bounded by the tail length plus the cycle length. The argument needs the successor function to
be total and deterministic, which is exactly what "functional graph" means and what distinguishes
this from a linked list that can end in null.

**★ Why must the sequence terminate at all?**
Because it is bounded and deterministic. For a `d`-digit number the successor is at most `81d`, and
at `d = 4` that is `324` against a minimum four-digit value of `1000` — so every large number
strictly decreases and the sequence is trapped below `1000` within a step or two. An infinite
sequence over a finite set repeats a value, and a deterministic function repeats everything after
it. That is the whole termination proof and it takes twenty seconds to give.

**★ What is the second phase of Floyd's algorithm and when do you need it?**
After the pointers meet, reset one to the start and advance both one step at a time; they meet at
the entry to the cycle. It works because at the meeting the tortoise has walked a multiple of the
cycle length, so a pointer `μ` steps from the entry and one `k − μ` steps from it converge after `μ`
more steps. You need it whenever the *identity of the repeated element* is the answer rather than
its existence — canonically "find the duplicate number" in an array of `n + 1` values in `[1, n]`,
where the array is a function from index to value and the duplicate is the cycle's entry.

**★ Floyd or a hash set — which would you ship?**
Usually the hash set, and I would say why. Its space is bounded by the reachable set, which here is
small, and its correctness is obvious to a reader at three in the morning. Floyd's constant space
matters when the state is large or the sequence is long — a pointer chase over a huge on-disk
structure, say — and it costs a correctness argument that a future maintainer has to reconstruct.
Naming the condition under which each wins is a better answer than picking one.

{/* FOOTER */}
