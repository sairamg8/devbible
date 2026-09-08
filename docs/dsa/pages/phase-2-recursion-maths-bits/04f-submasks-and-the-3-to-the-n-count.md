---
title: "sub = (sub - 1) & mask walks every submask of a mask in decreasing order because it is an ordinary decrement in the mask's own compressed numbering, and running it inside an all-masks loop costs 3^n rather than 4^n"
sidebar_label: "04f · Submasks, and the 3^n count"
sidebar_position: 4.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The submask derivation, the decreasing-order argument and the 3^n count are
> **mathematics derived on this page**, not cited — the borrow behaviour they rest on is derived in
> [04c](04c-clearing-and-isolating-the-lowest-bit.md). The 32-bit limit on the outer loop's bound is
> MDN, [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND)
> (*"For numbers, the operator returns a 32-bit integer."*). ⚠️ The modulo-width shift count is
> stated as **mechanism**, not quoted. **No sandbox run**; 3^20 is stated as arithmetic, not as a
> measurement. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**One loop enumerates every subset of a mask, and it is not a trick to memorise: it is an ordinary
decrement performed in the numbering system whose digits are the mask's set bits.** Derive it that
way and both of its properties become obvious — that it never produces a non-submask, and that it
never skips one. The second half of the subject is the cost, which is `3^n` over all masks and is
usually the number that decides whether the technique is admissible at all. Using submasks as the
*state* of a dynamic program is a different subject and belongs to
[Bitmask enumeration](09-bitmask-enumeration.md); what is here is the idiom, its boundary case, and its
arithmetic.
[04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md) is the language decision that follows once
`n` passes 31.

## Enumerating all masks, and then all submasks of one

The outer enumeration is a counter — every integer from `0` to `2^n - 1` is a distinct subset of an
`n`-element set:

```ts
// every subset of n items, n <= 30 in a JavaScript number
for (let mask = 0; mask < (1 << n); mask++) {
  // bit i set means item i is in this subset
}
```

The inner one is the interesting part. Given a `mask`, walk every `sub` with `(sub & mask) === sub`
— every subset of the *selected* items — in strictly decreasing order:

```ts
export function forEachSubmask(mask: number, fn: (sub: number) => void): void {
  let sub = mask;
  for (;;) {
    fn(sub);
    if (sub === 0) break;          // the empty submask is visited, then we stop
    sub = (sub - 1) & mask;
  }
}
```

```java
static void forEachSubmask(int mask, java.util.function.IntConsumer fn) {
    int sub = mask;
    while (true) {
        fn(sub);
        if (sub == 0) break;
        sub = (sub - 1) & mask;
    }
}
```

## Why `(sub - 1) & mask` is the next submask down

Think of the mask's set bits as the digits of a smaller binary number. If `mask` has `k` set bits,
its submasks are in bijection with the integers `0 … 2^k - 1`: read off only the positions the mask
owns, in order, and you get a `k`-bit value. Under that reading, **the loop is a decrement.**

Concretely: `sub - 1` borrows through `sub`'s trailing zeros, turning them into ones and clearing
`sub`'s lowest set bit — the same borrow derived in
[04c](04c-clearing-and-isolating-the-lowest-bit.md). Some of the ones it creates sit in positions the
mask does not own, and some sit in positions it does. ANDing with `mask` deletes the ones outside
the mask and keeps the ones inside, which is exactly "borrow, then fill the lower *mask* digits with
ones" — a decrement in base two restricted to the mask's digits.

Two consequences follow, and they are the reason the loop is correct rather than merely plausible:

- **Every value it produces is a submask**, because it ends with `& mask`. So no filtering is needed
  and the `(sub & mask) === sub` test never has to be written.
- **It produces the largest submask strictly less than `sub`.** Nothing is skipped and nothing
  repeats, so starting at `mask` and iterating until `0` visits each of the `2^k` submasks exactly
  once, in decreasing numeric order.

🔴 **The empty submask is the off-by-one.** Writing the loop as
`for (let sub = mask; sub > 0; sub = (sub - 1) & mask)` visits every submask *except* `0`, because
the guard rejects it before the body runs. Sometimes that is what you want — "every non-empty
subset" — but it is a choice, not a default, and a set-cover or partition DP that quietly never
considers the empty part gets a wrong answer rather than a crash. The `for (;;)` form above visits
`0` and then stops; the `do … while` form does the same:

```ts
let sub = mask;
do { fn(sub); sub = (sub - 1) & mask; } while (sub !== mask);   // wraps back to mask after 0
```

⚠️ That wrap works because `(0 - 1) & mask` is `-1 & mask`, and `-1` is all ones, so the result is
`mask` itself. It is neat, and it is easy to get wrong when the mask can be `0`, in which case the
loop body runs once and exits — which is correct, but only by accident. The explicit `break` reads
better and does not need the argument.

**The complement of a submask is `mask ^ sub`**, which is how you iterate *pairs* — a subset and the
rest of the mask — in the same loop with no extra work. That pairing is what partition problems
want, and it is why the decreasing order is harmless: each unordered pair is visited twice, once
from each side.

## Why the whole enumeration is 3^n, not 4^n

Run the submask loop inside the all-masks loop and count the pairs `(mask, sub)` with `sub ⊆ mask`.
Look at one element `i` and ask what can be true of it: it is outside `mask`, or it is in `mask` but
outside `sub`, or it is in both. Three mutually exclusive options, independently for each of the `n`
elements, and every valid pair corresponds to exactly one choice per element. So the total is
**3^n**.

The naive bound is `4^n` — `2^n` masks times `2^n` candidate submasks each — and the gap between the
two is the entire value of the idiom. It is not a constant-factor saving; it is a different
exponential base, and it is why "iterate the submasks" is a technique rather than a formatting
preference.

The same count by summation, which is the version to write on a board if the counting argument does
not land: a mask with `k` set bits has `2^k` submasks, and there are `C(n, k)` masks with `k` bits,
so the total is the sum over `k` of `C(n, k) · 2^k` — which is `(1 + 2)^n = 3^n` by the binomial
theorem.

That growth is the practical constraint. 3^n at `n = 20` is 3,486,784,401 — arithmetic, not a
measurement, and enough to say that a fully enumerated subset-of-subset loop is out of reach well
before the 32-bit ceiling becomes the binding problem. Say the `3^n` bound out loud when you propose
the technique and check it against the stated limits, because that is usually the real answer to
"can we do this for n = 40" and it arrives before any language question does.

## Gotchas

**★ Symptom: a set-cover or partition DP is wrong by exactly the empty-subset case.** Cause: the
submask loop was written `for (sub = mask; sub > 0; sub = (sub - 1) & mask)`, which never visits
`0`. Fix: the `for (;;)` form with `if (sub === 0) break;` after the body, so the empty submask is
visited once and only once — or keep the `sub > 0` form deliberately and write a comment saying the
empty subset is excluded on purpose.

**★ Symptom: an algorithm that enumerates submasks of every mask is fine at n = 15 and hopeless at
n = 20.** Cause: the total is 3^n, and 3^20 is 3,486,784,401. Fix: this is not a bug to patch — it
is the constraint. State the 3^n bound before writing code and check it against the problem's
limits.

**★ Symptom: the outer `for (mask = 0; mask < (1 << n); mask++)` loop runs zero times, or exactly
once.** Cause: `n` reached 31 or 32. `1 << 31` is negative, so the condition is false immediately;
and a shift count of 32 is reduced modulo the width to zero
([04b](04b-the-single-bit-idioms-and-masks.md)), so the bound becomes `1`. Fix: cap `n` at 30 for
this form, or compute the bound as `2 ** n` — a Number, exact well past 32 bits — and compare
against that, or move the whole enumeration into `BigInt`
([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md)).

**Symptom: the submask loop produces values that are not submasks.** Cause: the `& mask` was dropped
or applied to the wrong operand — `sub - (1 & mask)` rather than `(sub - 1) & mask`. Fix: the `&
mask` is what makes filtering unnecessary; with it, every produced value is a submask by
construction.

**Symptom: the `do … while (sub !== mask)` form loops forever.** Cause: the mask was mutated inside
the body, so the wrap-around value no longer matches the loop's comparand. Fix: never assign to the
mask inside its own enumeration; copy it into a local if the body needs to modify a mask.

**Symptom: each unordered partition is processed twice.** Cause: the loop visits both `sub` and its
complement `mask ^ sub` as separate iterations. Fix: if the problem is symmetric, process only the
iterations where `sub` is the numerically larger of the two — `sub >= (mask ^ sub)` — and halve the
work; if it is not symmetric, the double visit is the point.

## Interview questions

**★ Derive the submask iteration loop.**
Read the mask's set bits as the digits of a smaller binary number, so its submasks correspond
exactly to the integers `0 … 2^k - 1` where `k` is the popcount. In that numbering,
`sub = (sub - 1) & mask` is a decrement: subtracting one borrows through the trailing zeros, clearing
the lowest set bit and setting everything below it, and the `& mask` throws away the bits that
borrow created outside the mask while keeping the ones inside. So each step produces the largest
submask strictly smaller than the previous, nothing is skipped, nothing repeats, and starting from
`mask` and stopping after `0` visits all `2^k` submasks in decreasing order. The one thing to say
unprompted is where `0` goes: guard with `sub > 0` and you have silently excluded the empty subset.

**★ What does it cost to enumerate the submasks of every mask, and why?**
3^n. Count the pairs `(mask, sub)` with `sub ⊆ mask` element by element: each element is outside the
mask, inside the mask but outside the submask, or inside both — three independent choices over `n`
elements. The summation form is the same number: a mask with `k` bits has `2^k` submasks and there
are `C(n, k)` such masks, so the total is the sum of `C(n, k)·2^k`, which the binomial theorem makes
`3^n`. The comparison that makes it worth saying is against the naive `4^n` — `2^n` masks times
`2^n` candidates each — because the idiom does not save a constant, it lowers the base. And quote
the size at the boundary: 3^20 is about 3.5 billion, which is usually what decides admissibility.

**★ How do you iterate a subset and its complement together?**
The complement of `sub` within `mask` is `mask ^ sub`, so the same loop hands you both halves of a
partition on every iteration at no extra cost. That is exactly what partition and set-cover
formulations want. It also means each unordered pair is visited twice, once from each side, so a
symmetric objective can be computed on half the iterations by keeping only those where `sub` is the
larger half.

**Why does the loop not need a `(sub & mask) === sub` check?**
Because the recurrence ends in `& mask`, so every value it can produce is a submask by construction
— the check would never fail. The naive alternative, iterating every integer from `mask` down to `0`
and filtering with that test, is what costs `4^n` overall instead of `3^n`: it examines `2^n`
candidates per mask and rejects almost all of them. The whole point of the idiom is that it visits
only the values that survive.

**What happens if the mask is zero?**
The loop body runs exactly once, with `sub === 0`, and then breaks — which is correct, because the
empty set has exactly one subset, itself. It is worth checking that case explicitly against your
DP's base case, because "one iteration" is easy to mistake for "no iterations" when reading the
code, and a base case that expects zero iterations for an empty mask will double-count.

---

← Prev: [04e · XOR, and the problems it solves](04e-xor-and-the-problems-it-solves.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [04g · The 32-bit ceiling, and what to use instead](04g-the-32-bit-ceiling-and-what-to-use-instead.md)
