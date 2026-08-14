---
title: "02.1 · The mechanical transformation"
sidebar_label: "01 · The transformation"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Map.prototype.has()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has), [`Infinity`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError)). Documentation-validated; **no timings**.

**Three lines convert a brute-force recursion into dynamic programming**, and they are the same
three lines every time. That is the whole reason to write the brute force first.

## The three lines

```js
function solve(input) {
  const cache = new Map();                    // 1. a cache

  function go(state) {
    if (cache.has(state)) return cache.get(state);   // 2. check before computing
    if (isBase(state)) return baseValue;

    const result = /* the same recursion as before */;

    cache.set(state, result);                        // 3. store before returning
    return result;
  }

  return go(initialState);
}
```

Nothing about the recursion changes. **The transformation is purely additive**, which is why the
honest advice is: get the brute force correct first, then apply this. Trying to write the DP
directly means debugging the recurrence and the caching at the same time.

## Worked: coin change

The brute force, which is correct and exponential:

```js
function coinChange(coins, amount) {
  function go(remaining) {
    if (remaining === 0) return 0;
    if (remaining < 0) return Infinity;

    let best = Infinity;
    for (const coin of coins) best = Math.min(best, 1 + go(remaining - coin));
    return best;
  }

  const result = go(amount);
  return result === Infinity ? -1 : result;
}
```

Now the three lines:

```js
function coinChange(coins, amount) {
  const cache = new Map();

  function go(remaining) {
    if (remaining === 0) return 0;
    if (remaining < 0) return Infinity;
    if (cache.has(remaining)) return cache.get(remaining);      // ← 2

    let best = Infinity;
    for (const coin of coins) best = Math.min(best, 1 + go(remaining - coin));

    cache.set(remaining, best);                                  // ← 3
    return best;
  }

  const result = go(amount);
  return result === Infinity ? -1 : result;
}
```

**O(amount × coins.length)** — `amount + 1` distinct states, each doing `coins.length` work. The
brute force was O(coins.length^amount).

🔴 **`Infinity` rather than `-1` for "impossible".** `1 + Infinity` is `Infinity` and `Math.min`
handles it, so the arithmetic works without a special case at every step. With `-1` you need a
guard inside the loop, and forgetting it produces answers that are quietly one coin short. Convert
to `-1` once, at the boundary.

## `cache.has` versus a truthiness check

```js
if (cache.get(state)) return cache.get(state);      // ❌
if (cache.has(state)) return cache.get(state);      // ✅
```

🔴 **`0`, `false`, `""` and `NaN` are all legitimate DP results and all falsy.** A truthiness check
recomputes them every time — silently turning the DP back into the exponential brute force, with
no wrong answer to alert you. On a counting problem where many states are `0`, this is the
difference between instant and never.

**`??` has the same problem in a subtler form:** `cache.get(state) ?? compute()` is correct for `0`
and `false` but wrong if `undefined` or `null` is a valid stored result. `has` is the only check
that is right in every case.

## Keys must be primitives

`Map` compares keys with SameValueZero, so objects and arrays compare **by reference**
([Phase 14 · 02](../../phase-14-data-structures/02-hash-maps-and-sets/01-using-the-built-ins.md)):

```js
cache.set([i, j], v);  cache.get([i, j]);      // ❌ always undefined — different arrays
cache.set(`${i},${j}`, v);                     // ✅ string key
cache.set(i * (m + 1) + j, v);                 // ✅ encoded integer, no allocation
```

For a multi-dimensional state, **nested maps** avoid both the string allocation and the encoding
arithmetic:

```js
function get(i, j) { return cache.get(i)?.get(j); }
function set(i, j, v) {
  if (!cache.has(i)) cache.set(i, new Map());
  cache.get(i).set(j, v);
}
```

⚠️ **When the state is a small dense integer range, a plain array beats a `Map`** — `new
Array(n + 1).fill(undefined)` with an `undefined` check is faster and simpler. Use a `Map` when the
state space is sparse or the keys are not small integers.

## A generic memoize wrapper, and why it is a trap

```js
function memoize(fn, keyFn = (...args) => args.join(",")) {
  const cache = new Map();
  return function memoized(...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.call(this, ...args);
    cache.set(key, result);
    return result;
  };
}
```

Convenient, and 🔴 **it does not memoize a recursive function unless the recursion calls the
*wrapped* version**:

```js
const fib = memoize(function (n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);   // ✅ refers to the wrapped binding
});

function fibInner(n) { return n < 2 ? n : fibInner(n - 1) + fibInner(n - 2); }
const fibMemo = memoize(fibInner);               // ❌ inner calls bypass the cache entirely
```

The second version caches only the outermost call, so it is still O(2ⁿ) and looks memoized. **A
local `cache` and an inner helper is clearer and has no way to go wrong**, which is why the worked
examples above use it.

⚠️ **A module-level memoize cache never releases anything.** For a request-scoped computation that
is a leak ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)); create the
cache inside the function unless the results are genuinely global and bounded.

## What memoization does not fix

🔴 **Recursion depth.** Memoization reduces the number of *distinct* calls, not how deep the stack
goes. A memoized recursion over 100,000 elements still throws
`RangeError: Maximum call stack size exceeded` — that is the usual reason to convert to bottom-up,
rather than elegance.

**And it does not fix an exponential state space.** If there are 2ⁿ distinct states, caching them
means storing 2ⁿ entries. Memoization removes *recomputation*, not the state count
([01 · The two conditions](../01-what-dp-is/01-the-two-conditions.md)).

## Gotchas

**Symptom:** Memoizing makes no difference and the solution is still exponential
**Cause:** A truthiness check instead of `has`, so falsy results are recomputed.
**Fix:** `if (cache.has(key))`.

**Symptom:** The cache never hits
**Cause:** An array or object key, compared by reference.
**Fix:** A string, an encoded integer, or nested maps.

**Symptom:** `memoize(fn)` does nothing for a recursive function
**Cause:** The recursion calls the unwrapped inner function.
**Fix:** Recurse through the wrapped binding, or use a local cache and an inner helper.

**Symptom:** Coin change is one coin short in places
**Cause:** `-1` used as the impossible sentinel and arithmetic performed on it.
**Fix:** `Infinity` internally; convert at the boundary.

**Symptom:** `RangeError` from a memoized solution
**Cause:** Recursion depth, which memoization does not reduce.
**Fix:** Convert to bottom-up.

**Symptom:** Memory grows across requests
**Cause:** A module-level memoize cache that never evicts.
**Fix:** Scope the cache to the call, or bound it.

**Symptom:** An encoded integer key collides
**Cause:** The wrong multiplier for the second dimension.
**Fix:** Multiply by that dimension's size + 1, and stay within `MAX_SAFE_INTEGER`.

## Interview questions

**★ Convert a brute-force recursion to DP.**
Three additive lines: create a cache; check it **before** computing; store **before** returning.
The recursion itself does not change — which is exactly why you write the brute force first
rather than trying to get the recurrence and the caching right simultaneously.

**★ Why `cache.has(key)` rather than checking the value?**
Because `0`, `false`, `""` and `NaN` are legitimate DP results and all falsy. A truthiness check
recomputes them every time, silently reverting to the exponential brute force with **no wrong
answer** to signal the problem.

**★ Why does `cache.get([i, j])` never hit?**
`Map` uses SameValueZero, so arrays compare by reference and each literal is a fresh object. Use a
string key, an encoded integer, or nested maps.

**★ What is wrong with `const f = memoize(fInner)` for a recursive `fInner`?**
The inner recursive calls bypass the wrapper, so only the outermost call is cached and the thing
is still exponential — while looking memoized. The recursion must call the wrapped binding.

**★ Coin change: why `Infinity` and not `-1` for unreachable amounts?**
Because `1 + Infinity` is `Infinity` and `Math.min` handles it, so no special case is needed at
each step. With `-1` you need a guard inside the loop, and omitting it gives answers that are
quietly wrong rather than obviously so. Convert to `-1` once, at the return.

**★ What does memoization *not* fix?**
Recursion depth — a memoized solution over a deep input still throws `RangeError`, which is the
usual reason to convert to bottom-up. And it does not fix an exponential **state count**; caching
2ⁿ states means storing 2ⁿ entries.

**When is a plain array better than a `Map` for the cache?**
When the state is a small dense integer range — an array indexed directly is simpler and faster.
`Map` is for sparse state spaces or non-integer keys.

---

[Topic index](./README.md) · Next → [02 · Choosing the key and converting](./02-keys-and-conversion.md)
