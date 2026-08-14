---
title: "01.2 · Spotting the state"
sidebar_label: "02 · Spotting the state"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity)). Documentation-validated; **no timings**.

**The state is the hard part.** Once the state is named correctly the transition usually writes
itself, and once the transition is written the code is mechanical. People who "cannot do DP"
almost always cannot *name the state* — the rest is bookkeeping.

## What a state is

🔴 **A state is the smallest set of values that determines the rest of the problem.** Two
formulations of the same question:

- *"What do I need to know to finish, given that some decisions are already made?"*
- *"If I paused here and handed the problem to someone else, what would I have to tell them?"*

Whatever appears in that answer **is** the state. Everything else is either derivable or
irrelevant, and including it only multiplies the table.

## Worked: coin change

*Fewest coins to make amount n from a set of coins.*

Handing it over mid-solution, you would say: **"the remaining amount."** Not which coins you used,
not how many so far — those do not affect what is optimal from here.

```js
// state:      remaining amount
// transition: best(amount) = 1 + min over coins of best(amount - coin)
// base:       best(0) = 0
// answer:     best(target)
```

**States: n + 1. Work per state: `coins.length`. → O(n · coins.length).**

⚠️ **Unreachable amounts must be representable.** `Infinity` is the natural "impossible" value
because `1 + Infinity` is `Infinity` and `Math.min` handles it — using `-1` as a sentinel breaks
the arithmetic and produces silently wrong answers.

## Worked: house robber

*Maximum sum from an array where you cannot take two adjacent elements.*

Handing it over: **"which index you are at."** The naive extra — "and whether you took the previous
one" — is not needed if the recurrence is written as *take-this-one-and-skip-one* versus
*skip-this-one*:

```js
// state:      index i
// transition: best(i) = max(nums[i] + best(i + 2), best(i + 1))
// base:       best(i) = 0 for i >= n
```

🔴 **The alternative framing — state `(i, tookPrevious)` — is also correct and has twice the
states.** Both work; the smaller one is better. **Noticing that a proposed state has a redundant
dimension is exactly the skill this topic is about**, and it comes from asking whether the extra
value is *derivable* or *irrelevant* rather than genuinely needed.

## When one dimension is not enough

*Knapsack: maximise value with a weight limit.*

"Which item you are at" is not sufficient — the answer also depends on the **remaining capacity**.
So the state is a pair:

```js
// state:      (index, remainingCapacity)
// transition: best(i, cap) = max(
//               best(i + 1, cap),                                  // skip
//               value[i] + best(i + 1, cap - weight[i])            // take, if it fits
//             )
```

**States: n × capacity.** 🔴 **This is "pseudo-polynomial"** — polynomial in the *value* of the
capacity, not in the number of bits needed to write it. A capacity of 10⁹ makes the table
impossible even with only 20 items. Saying that out loud is a strong answer, because it is exactly
the case where DP quietly stops being a solution.

**The rule for adding a dimension:** add one only when the answer genuinely differs for two
positions with the same index. If it does not, the dimension is redundant and doubles your work
for nothing.

## Three state-design mistakes

**1. Too much state.** Including the path taken so far, or the set of used items, when only a
count or a capacity matters. The symptom is a state space that is exponential — at which point the
"DP" is just memoized brute force with a bigger memory bill.

**2. Too little state.** The recurrence gives different answers for the same state depending on
how you arrived, which means something contextual was left out. **The symptom is a solution that
is correct on small inputs and wrong on larger ones** — because collisions in the cache only
happen once two paths reach the same key by different routes.

**3. A state that is not hashable.** In JavaScript this is concrete: a `Map` or `Set` keyed by an
array compares by **reference**
([Phase 14 · 02](../../phase-14-data-structures/02-hash-maps-and-sets/01-using-the-built-ins.md)),
so `cache.get([i, j])` never hits. The key must be a primitive:

```js
cache.set(`${i},${j}`, result);       // string key
cache.set(i * (m + 1) + j, result);   // encoded integer — no allocation
```

⚠️ **The encoded-integer form needs the correct multiplier** — the size of the *second* dimension
plus one — and it must stay within `Number.MAX_SAFE_INTEGER`. Nested maps
(`cache.get(i)?.get(j)`) avoid both concerns at the cost of more code.

## A checklist for naming the state

1. Write the brute-force recursion first, without any cache.
2. **The parameters of that recursion are your candidate state.** This is the shortcut — the
   recursion has already told you what varies.
3. Remove any parameter that is derivable from the others, or that does not change the answer.
4. Check that two different paths reaching the same state genuinely have the same future.
5. Count the states. If the count is exponential, the state is wrong — or DP is.

🔴 **Step 2 is the whole trick.** The state is not something to invent; it is whatever the brute
force already passes down. Writing the brute force honestly is therefore the fastest route to the
DP, which is why the method in [03 · A problem-solving
method](../03-problem-solving-method/README.md) puts it before optimisation.

## Gotchas

**Symptom:** The cache never hits
**Cause:** The key is an array or object — compared by reference.
**Fix:** A string or encoded-integer key, or nested maps.

**Symptom:** Correct on small inputs, wrong on large ones
**Cause:** Too little state — two different contexts collide on one key.
**Fix:** Add the dimension that distinguishes them.

**Symptom:** The state space is exponential
**Cause:** Too much state — the path or the used-set was included.
**Fix:** Reduce to what actually determines the future.

**Symptom:** Coin change returns nonsense for impossible amounts
**Cause:** `-1` used as the "impossible" sentinel, so arithmetic on it is meaningless.
**Fix:** `Infinity`, which survives `1 + x` and `Math.min`.

**Symptom:** Knapsack is impossibly slow with a large capacity
**Cause:** Pseudo-polynomial — the table is sized by the capacity's *value*.
**Fix:** Recognise and say so; look for a different formulation or an approximation.

**Symptom:** An encoded integer key collides
**Cause:** The wrong multiplier, or exceeding `MAX_SAFE_INTEGER`.
**Fix:** Multiply by the second dimension's size + 1; check the range.

**Symptom:** The state has a dimension that never changes the answer
**Cause:** It was carried "just in case".
**Fix:** Remove it — it multiplies the table for nothing.

## Interview questions

**★ What is a "state" in DP?**
The smallest set of values that determines everything about the rest of the problem — what you
would have to tell someone to whom you handed the half-solved problem. Anything derivable or
irrelevant should not be in it.

**★ How do you find the state quickly?**
Write the brute-force recursion first: **its parameters are your candidate state**. Then remove
anything derivable and check that two paths reaching the same state genuinely have the same
future. The state is not invented; it is whatever the recursion already passes down.

**★ House robber — is the state `i` or `(i, tookPrevious)`?**
Both are correct. `i` alone works if the recurrence is *take-this-and-skip-one* versus *skip-this*,
and it has half the states. Spotting that the second dimension is redundant is the skill being
tested.

**★ Why does knapsack need two dimensions?**
Because the best answer at an item index differs depending on the remaining capacity — two
positions with the same index are genuinely different situations. That is the rule for adding a
dimension.

**★ What is "pseudo-polynomial", and why does it matter?**
Knapsack is O(n × capacity) — polynomial in the *value* of the capacity, not in its number of
bits. A capacity of 10⁹ makes the table infeasible with only 20 items, so DP quietly stops being a
solution.

**★ What goes wrong with a state that is "too little"?**
Two different contexts collide on the same cache key, so the memoized answer is wrong for one of
them. It presents as **correct on small inputs and wrong on large ones**, because collisions only
occur once two paths reach the same key by different routes.

**What is the JavaScript-specific state bug?**
Using an array or object as a `Map` key. They compare by reference, so the cache never hits and
the solution silently stays exponential. Use a string or an encoded integer.

---

← [01 · The two conditions](./01-the-two-conditions.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
