---
title: "02.2 · Choosing the key and converting"
sidebar_label: "02 · Keys and conversion"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError)). Documentation-validated; **no timings**.

**The cache key is the state, serialised.** Get it wrong in one direction and the cache never hits;
wrong in the other and two different situations share an entry. Both failures are quiet.

## Choosing the key

| State | Key | Notes |
|---|---|---|
| one small integer | the integer, in an **array** | `new Array(n + 1)` beats a `Map` |
| one integer, sparse or large | the integer, in a `Map` | no wasted slots |
| two small integers | `i * (m + 1) + j`, or a 2-D array | 🔴 multiply by the **second** dimension's size + 1 |
| two integers, sparse | `` `${i},${j}` `` or nested maps | string allocates; nested maps do not |
| an index plus a small set | a **bitmask** integer | the classic "visited set" encoding |
| a string position | the index, never the substring | 🔴 see below |

🔴 **Never key on a substring.** `go(s.slice(i))` creates a new string per call and turns an O(n)
state space into O(n) *strings* — extra allocation, worse hashing, and a subtle bug when two
different positions produce equal suffixes. **Pass the index and keep the original string.** This
is the most common accidental slowdown in string DP.

**Bitmask keys** are how a "set of used items" becomes a single integer:

```js
const used = 0b0101;                       // items 0 and 2 are used
const withItem = used | (1 << i);          // add item i
const has = (used & (1 << i)) !== 0;       // test item i
```

⚠️ **JavaScript's bitwise operators coerce to 32-bit signed**, so bitmasks are safe up to **31**
items and `1 << 31` is negative. Above that, `BigInt` or a different formulation. It is a real
limit, not a footnote — travelling-salesman-style DP hits it at n = 32.

## Converting top-down to bottom-up

The conversion is mechanical once the state is named:

```js
// top-down
function coinChange(coins, amount) {
  const cache = new Map();
  function go(rem) {
    if (rem === 0) return 0;
    if (rem < 0) return Infinity;
    if (cache.has(rem)) return cache.get(rem);
    let best = Infinity;
    for (const c of coins) best = Math.min(best, 1 + go(rem - c));
    cache.set(rem, best);
    return best;
  }
  const r = go(amount);
  return r === Infinity ? -1 : r;
}

// bottom-up
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;                                          // base case → initial value

  for (let rem = 1; rem <= amount; rem++) {           // 🔴 order: dependencies first
    for (const c of coins) {
      if (c <= rem) dp[rem] = Math.min(dp[rem], 1 + dp[rem - c]);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
```

**The four mechanical steps:**

1. **The cache becomes a table** sized by the state space.
2. **The base case becomes the initial value** — `dp[0] = 0`.
3. **The recursion becomes a loop whose order guarantees dependencies are already computed.**
   `dp[rem]` reads `dp[rem - c]`, so ascending `rem` is correct.
4. **The answer moves from the return value to a table entry** — `dp[amount]`.

🔴 **Step 3 is the only one that requires thought, and it is where bottom-up goes wrong.** The
recursion worked out the order for you; the loop does not. Read the recurrence, see which entries
it depends on, and iterate so those are filled first. **When the recurrence reads `dp[i + 1]`, the
loop must go *downwards*** — and reversing it by mistake produces a plausible wrong answer rather
than an error.

## Why convert at all

| | Top-down | Bottom-up |
|---|---|---|
| Correctness effort | lower — the recursion orders itself | higher — you choose the order |
| Wasted work | none — only reachable states | computes every table entry |
| Stack | 🔴 can overflow | no recursion |
| Space optimisation | hard | easy — rolling rows |

**Two real reasons to convert:**

1. 🔴 **The stack.** A memoized recursion over a large input throws
   `RangeError: Maximum call stack size exceeded`, and memoization does not help because it reduces
   *distinct calls*, not depth.
2. **Space.** When `dp[i]` depends only on `dp[i-1]` and `dp[i-2]`, the table collapses to two
   variables — O(1) space instead of O(n). That is only visible once the recurrence is written as
   a loop.

⚠️ **Bottom-up computes states the recursion would have skipped.** For a sparse reachable set —
say a coin change where most amounts are unreachable — top-down can be genuinely faster despite
the same asymptotic bound. Neither direction dominates.

## Space optimisation, briefly

```js
// house robber: dp[i] depends only on dp[i-1] and dp[i-2]
let prev2 = 0, prev1 = 0;
for (const value of nums) {
  const current = Math.max(prev1, prev2 + value);
  prev2 = prev1;
  prev1 = current;
}
return prev1;
```

O(1) space, and 🔴 **noticeably harder to read than the table version** — `prev1`/`prev2` carry no
meaning, and an off-by-one in the assignment order is silent. The full treatment is
**08 · Space optimisation** *(not written yet)*; the position worth holding is: **do it when the
space matters, keep the table version when it does not**, and say that trade rather than
optimising reflexively.

For 2-D DP the equivalent is keeping one or two **rows** rather than the whole grid, which reduces
O(n·m) to O(m).

## Gotchas

**Symptom:** String DP is far slower than the bound suggests
**Cause:** Keying on `s.slice(i)` — a new string per call.
**Fix:** Key on the index; keep the original string.

**Symptom:** A bitmask goes negative
**Cause:** `1 << 31` — bitwise operators use 32-bit signed integers.
**Fix:** Cap at 31 items, or use `BigInt`.

**Symptom:** Bottom-up gives a wrong answer, top-down is fine
**Cause:** Iteration order — a dependency was not filled yet.
**Fix:** Read the recurrence and iterate so dependencies come first; `dp[i+1]` means downwards.

**Symptom:** The table is full of `Infinity` at the end
**Cause:** The base case was not seeded.
**Fix:** The base case becomes the initial value — `dp[0] = 0`.

**Symptom:** Bottom-up is slower than top-down
**Cause:** It computes every state; the reachable set was sparse.
**Fix:** Expected — neither direction dominates.

**Symptom:** A 2-D encoded key collides
**Cause:** Multiplied by the first dimension's size instead of the second's.
**Fix:** `i * (m + 1) + j`, where `m` is the second dimension's maximum.

**Symptom:** The rolling-array version is subtly wrong
**Cause:** The assignment order of `prev1`/`prev2`.
**Fix:** Keep the table version unless the space genuinely matters.

## Interview questions

**★ Why never key a string DP on the substring?**
`s.slice(i)` allocates a new string per call, so an O(n) state space becomes O(n) string
allocations with worse hashing — and equal suffixes at different positions can collide. Key on the
**index** and keep the original string.

**★ Give the four steps of converting top-down to bottom-up.**
The cache becomes a table; the base case becomes the initial value; the recursion becomes a loop
whose **order guarantees dependencies are already computed**; and the answer moves to a table
entry. Only the third requires thought.

**★ What is the risk unique to bottom-up?**
Iteration order. The recursion worked the order out for you; the loop does not. If the recurrence
reads `dp[i + 1]`, the loop must run downwards — and getting it backwards produces a plausible
wrong answer, not an error.

**★ Why convert at all, if top-down is easier?**
The **stack** — a memoized recursion over a large input still throws `RangeError`, because
memoization reduces distinct calls and not depth. And **space** — a recurrence that reads only the
last one or two entries collapses to O(1), which is only visible as a loop.

**★ Is bottom-up always faster?**
No. It computes every table entry, including states the recursion would never reach. With a sparse
reachable set, top-down can be genuinely faster at the same asymptotic bound.

**★ How do you encode a "set of used items" as a cache key?**
A bitmask integer — `used | (1 << i)` to add, `(used & (1 << i)) !== 0` to test. ⚠️ JavaScript's
bitwise operators are 32-bit **signed**, so this is safe to 31 items and `1 << 31` is negative.

**When do you skip the space optimisation?**
When the space does not matter. The rolling-variable version loses the table's readability and its
off-by-ones are silent — say the trade rather than optimising by reflex.

---

← [01 · The transformation](./01-the-transformation.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
