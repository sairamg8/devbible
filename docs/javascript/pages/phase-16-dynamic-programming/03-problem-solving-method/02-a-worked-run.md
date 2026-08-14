---
title: "03.2 · A worked run"
sidebar_label: "02 · A worked run"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — method material; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)). Documentation-validated; **no timings**.

**The method is only useful if you have seen it run.** This is the same seven steps applied to one
problem, written as it would actually be said out loud.

## The problem

> *Given an array of coin denominations and an amount, return the fewest coins that make up that
> amount, or −1 if it cannot be made.*

## 1. Clarify

> "A few things first. **Can the coin values repeat, and can I use each coin unlimited times?**
> Unlimited — good, so this is unbounded, not 0/1 knapsack.
>
> **Can the amount be zero?** Yes — then the answer is 0.
>
> **Can coin values be negative or zero?** No — positive integers. That matters, because a
> zero-value coin would make the problem non-terminating.
>
> **How large can the amount be, and how many coins?** Amount up to about 10⁴, and at most a dozen
> coins. So an O(amount × coins) table is around 10⁵ operations — comfortable. And 10⁴ is deep
> enough that I will keep recursion depth in mind.
>
> **What do I return if it is impossible?** −1."

🔴 **Three of those answers changed the solution**: unlimited use (unbounded, not 0/1), positive
values (terminating), and the size (DP is affordable, recursion depth is a consideration).

## 2. Examples

```
coins = [1, 3, 4], amount = 6   → 2      (3 + 3)
coins = [2],       amount = 3   → -1     (impossible)
coins = [1, 3, 4], amount = 0   → 0      (edge)
coins = [5],       amount = 5   → 1      (single)
```

> "The first one is deliberate — **greedy would pick 4, then 1, then 1, and answer 3**. The correct
> answer is 2. So greedy is out, and I have a test that proves it."

🔴 **Choosing an example that discriminates between approaches is the most valuable thing step 2
does.** It rules greedy out with evidence rather than assertion.

## 3. Brute force

> "The brute force is: for each coin, try using it and recurse on the remainder; take the minimum.
> That is O(coins^amount) — exponential, because it re-solves the same remainders over and over."

## 4. Optimise

> "Two signals for DP: it asks for a **minimum**, and there are **choices at each step** that
> affect what remains. And the brute force visibly recomputes — `go(3)` is reached from several
> paths. That is overlapping subproblems.
>
> **Optimal substructure** holds too: the best way to make 6 really is one coin plus the best way
> to make 6 − coin, and I can solve that subproblem without knowing how it will be used.
>
> **Not greedy** — my second example disproves it. **Not a sliding window** — nothing contiguous.
> **Not BFS**… actually BFS *would* work here, treating amounts as nodes and coins as edges, and
> it would give the same complexity. I will use DP because the recurrence is more direct, but they
> are the same graph.
>
> **The state is the remaining amount** — that is all I would need to tell someone taking over."

⚠️ **Naming the near-miss that would also have worked is a strong move**, not a wobble. It shows
the choice was made rather than stumbled into.

## 5. Code

```js
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;                                    // base case

  for (let rem = 1; rem <= amount; rem++) {
    for (const coin of coins) {
      if (coin <= rem) dp[rem] = Math.min(dp[rem], 1 + dp[rem - coin]);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
```

> "I am going bottom-up directly because the amount can be 10⁴ and I would rather not rely on
> recursion depth. `Infinity` as the impossible value so `1 + dp[...]` needs no special case, and I
> convert to −1 once at the end. Ascending `rem` because `dp[rem]` reads `dp[rem - coin]`, which is
> smaller — so dependencies are always already filled."

## 6. Test

> "`coins = [1,3,4], amount = 6`:
> `dp[0]=0`; `dp[1]=1`; `dp[2]=2`; `dp[3] = min(1+dp[2], 1+dp[0]) = 1`; `dp[4] = min(1+dp[3],
> 1+dp[1], 1+dp[0]) = 1`; `dp[5] = min(1+dp[4], 1+dp[2], 1+dp[1]) = 2`; `dp[6] = min(1+dp[5],
> 1+dp[3], 1+dp[2]) = 2`. ✅
>
> `coins = [2], amount = 3`: `dp[1]` stays `Infinity`, `dp[3] = 1 + dp[1] = Infinity` → −1. ✅
>
> `amount = 0`: the loop never runs, `dp[0] = 0` is returned directly. ✅
>
> And the JavaScript pass: no `sort`, no `Map` keys, no `shift`, and the values are small so
> `MAX_SAFE_INTEGER` is not in play. `Infinity` compares correctly under `Math.min`."

🔴 **Note that the `amount = 0` case is only correct because `dp[0]` is seeded before the loop.**
Tracing it is what confirms that, rather than assuming.

## 7. Complexity

> "**Time O(amount × coins.length)** — there are `amount + 1` states and each does `coins.length`
> work. **Space O(amount)** for the table.
>
> Two things I would add if this were production: the space cannot be reduced to O(1) here because
> `dp[rem]` reads `dp[rem - coin]` for arbitrary coins, not just the last one or two — so the
> rolling-array trick does not apply. And if the amount could be 10⁹ this whole approach fails,
> because the table is sized by the amount's **value** — that is the pseudo-polynomial limit, and
> I would need a different formulation."

🔴 **The last paragraph is what a strong answer looks like:** it names the trade that was *not*
available and the input size at which the approach dies.

## What this run demonstrates

- **Three clarifying answers changed the solution** before any code existed.
- **An example was chosen to disprove greedy**, so the rejection was evidence-based.
- **The brute force produced the state** — the recursion's only parameter was the remaining amount.
- **A near-miss (BFS) was named and dismissed with a reason**, which is the phase-15 gate.
- **The trace found nothing, and was still worth doing** — it confirmed the `amount = 0` path,
  which depends on a line outside the loop.
- **The complexity came with its limits**, including where the approach stops working entirely.

⚠️ **The one thing this run does not show is being stuck**, which is the more common case. The
recovery is step 2: stop, take a concrete example, and walk it by hand. It reliably produces either
the recurrence or the reason the current approach cannot work — and both are progress.

## Gotchas

**Symptom:** The wrong variant is solved — 0/1 instead of unbounded
**Cause:** "Can I use each coin more than once?" was never asked.
**Fix:** Clarify the reuse rule; it changes the state and the loop order.

**Symptom:** Greedy is proposed and defended
**Cause:** No discriminating example.
**Fix:** `[1,3,4]` with amount 6 — greedy gives 3, the answer is 2.

**Symptom:** `RangeError` on a large amount
**Cause:** Top-down recursion at depth 10⁴+.
**Fix:** Go bottom-up when the size warrants it — decided in step 1, not after the crash.

**Symptom:** The impossible case returns a huge number
**Cause:** `Infinity` was not converted at the boundary.
**Fix:** One conversion at the return.

**Symptom:** `amount = 0` returns `Infinity`
**Cause:** `dp[0]` not seeded before the loop.
**Fix:** The base case is the initial value — and tracing the zero case is what catches it.

**Symptom:** The rolling-array optimisation produces wrong answers here
**Cause:** `dp[rem]` reads `dp[rem - coin]` for arbitrary coins, not a fixed recent window.
**Fix:** It does not apply — say so rather than attempting it.

**Symptom:** The solution is fine and fails at amount 10⁹
**Cause:** Pseudo-polynomial — the table is sized by the amount's value.
**Fix:** Name the limit; a different formulation is needed.

## Interview questions

**★ Walk me through coin change end to end.**
Clarify (unlimited reuse? amount range? impossible-case return?), examples including one that
**disproves greedy**, brute force O(coins^amount) with its overlapping subproblems, then DP with
the remaining amount as state; bottom-up because the amount can be 10⁴; trace the examples; and
state O(amount × coins) time, O(amount) space.

**★ Why is greedy wrong for coin change?**
`[1,3,4]` with amount 6: greedy takes 4, then 1, then 1 — three coins. The answer is 3 + 3 = 2.
Greedy is correct only for canonical coin systems, and the interviewer's coin set is rarely one.

**★ Why bottom-up rather than memoized recursion here?**
The amount can be 10⁴, and top-down recursion at that depth risks `RangeError`. Memoization
reduces distinct calls, not depth. Deciding that in step 1 from the size is better than
discovering it from a crash.

**★ Why `Infinity` for the impossible case?**
`1 + Infinity` is `Infinity` and `Math.min` handles it, so no branch is needed inside the loop.
Convert to −1 once at the return.

**★ Can you reduce the space to O(1)?**
No — `dp[rem]` depends on `dp[rem - coin]` for arbitrary coin values, not on a fixed window of
recent entries, so there is nothing to roll. Saying *why* the optimisation does not apply is
better than attempting it.

**★ At what input does this approach stop working?**
When the amount is large — around 10⁹ — because the table is sized by the amount's **value**, not
by its number of digits. That is the pseudo-polynomial limit, and it needs a different
formulation.

**What do you do when you are stuck mid-problem?**
Go back to a concrete example and walk it by hand. It produces either the recurrence or the reason
the current approach cannot work, and both are progress. Staring at the code does not.

---

← [01 · The loop](./01-the-loop.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
