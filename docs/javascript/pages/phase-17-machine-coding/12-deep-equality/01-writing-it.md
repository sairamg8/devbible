---
title: "12.1 · Writing it"
sidebar_label: "01 · Writing it"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **nothing was run**.

Deep equality is the same traversal as [06 · Deep clone](../06-deep-clone/README.md) asking a
different question — and the same principle applies: **the recursion is easy, the cases are
the interview.**

```js
function deepEqual(a, b, seen = new Map()) {
  // 1. identity and primitives
  if (Object.is(a, b)) return true;                       // NaN === NaN here; +0 !== -0
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  // 2. same kind of thing
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // 3. cycles
  if (seen.get(a) === b) return true;
  seen.set(a, b);

  // 4. the built-ins whose state is internal
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  // 5. containers
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i], seen));
  }
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k), seen)) return false;   // ⚠️ identity keys — see below
    }
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;                    // ⚠️ identity again
    return true;
  }

  // 6. plain objects
  const keysA = Reflect.ownKeys(a), keysB = Reflect.ownKeys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], seen));
}
```

## The decisions inside it

**1 · `Object.is` for the primitive comparison, not `===`.** MDN's sameness guide separates
four algorithms; the two that matter here differ on exactly two values:

| | `NaN` vs `NaN` | `+0` vs `-0` |
|---|---|---|
| `===` (strict) | `false` | `true` |
| `Object.is` (SameValue) | **`true`** | **`false`** |
| SameValueZero (`Map` keys, `includes`) | `true` | `true` |

For a *comparison* function, treating `NaN` as equal to itself is almost always what callers
want — two objects containing `NaN` in the same slot are "the same object". `+0` vs `-0` is
the debatable one: `Object.is` says different, and most test libraries agree, but if your data
comes from arithmetic that can produce `-0` you may want SameValueZero instead. **Whichever you
choose, say it out loud** — this is the single most likely follow-up question.

**2 · Prototype comparison, not `typeof`.** It rejects `{} vs []`, `{} vs new Foo()` and
`new Foo() vs new Bar()` in one line. The alternative view — "same own properties means equal
regardless of class" — is what most test libraries' *loose* comparison does. Again: a decision,
not an oversight.

**3 · Cycles need a `Map` of pairs, not a `Set` of visited nodes.** `seen.get(a) === b` asks
"have I already assumed *these two* are equal?", which is the assumption the recursion is
currently trying to prove. A plain `Set` of seen objects would wrongly report equality for two
differently-shaped cyclic graphs.

**4 · `Date` and `RegExp` again.** Their state is in internal slots, so the own-keys walk sees
nothing and every `Date` would compare equal to every other. Same list as the clone.

**5 · Key count before key comparison.** Comparing only `a`'s keys makes `{a:1}` equal to
`{a:1, b:2}`; the length check is what makes the relation symmetric. `Reflect.ownKeys` includes
symbol keys, and `Object.hasOwn(b, k)` distinguishes **missing** from **present-but-undefined**
— `{a: undefined}` and `{}` have different key counts, and should not be equal.

## `Map` and `Set` are the genuinely hard case

The implementation above compares them **by key identity**, because `b.has(k)` uses
SameValueZero. That is fine for primitive keys and wrong the moment keys are objects:

```js
deepEqual(new Set([{ id: 1 }]), new Set([{ id: 1 }]));   // false — different object references
```

Comparing them *structurally* means: for each entry in `a`, find **some** entry in `b` that is
deeply equal and not already matched. That is a bipartite matching problem — quadratic at best
— and it is why most libraries do exactly what the code above does and document the limitation.

**Say this in the interview.** "Structural comparison of `Set`s with object members is
quadratic, so I compare by identity and document it" is a much better answer than silently
getting it wrong.

## Order

Arrays are order-sensitive; objects are not; `Map` and `Set` iterate in insertion order but
comparing them by order would make two logically identical maps unequal. The implementation
above reflects that — arrays compare index by index, `Map`/`Set` compare by lookup — which is
the conventional set of choices.

## Gotchas

**Symptom:** `deepEqual(NaN, NaN)` was `false`
**Cause:** `===` compares `NaN` as unequal to itself.
**Fix:** `Object.is`, which treats it as equal (SameValue).

**Symptom:** `deepEqual({}, [])` was `true`
**Cause:** No prototype check — an empty array has no own enumerable keys either.
**Fix:** Compare `Object.getPrototypeOf` first.

**Symptom:** `deepEqual({a:1}, {a:1, b:2})` was `true`
**Cause:** Only `a`'s keys were walked.
**Fix:** Compare key counts, then keys.

**Symptom:** `{a: undefined}` equalled `{}`
**Cause:** `b[k]` is `undefined` for a missing key too.
**Fix:** `Object.hasOwn(b, k)` before comparing values.

**Symptom:** Two `Date`s with the same time were unequal
**Cause:** The own-keys walk sees no properties on a `Date`.
**Fix:** Compare `getTime()` explicitly.

**Symptom:** Infinite recursion on a cyclic object
**Cause:** No pair tracking.
**Fix:** A `Map` from `a` → `b` recording pairs already assumed equal.

**Symptom:** Two `Set`s of structurally identical objects were unequal
**Cause:** `has` compares by identity.
**Fix:** Accept and document it, or implement matching — and know it is quadratic.

## Interview questions

**★ Write a deep equality function.**
`Object.is` for identity and primitives; reject differing prototypes; track pairs in a `Map`
for cycles; special-case `Date`, `RegExp`, `Array`, `Map` and `Set`; then compare own key
counts and recurse per key, checking `Object.hasOwn` so missing and `undefined` differ.

**★ Why `Object.is` instead of `===`?**
They differ on two values: `Object.is(NaN, NaN)` is `true` (which a comparison function wants)
and `Object.is(0, -0)` is `false` (which is debatable and should be stated). `===` gets both
the other way round.

**★ How do you handle cycles?**
Keep a `Map` from each visited `a` to the `b` it was compared against, and treat a repeat pair
as equal — that is the assumption the in-progress recursion is proving. A simple visited-set
is not enough.

**★ Why check the key count?**
Without it the relation is asymmetric: `{a:1}` would equal `{a:1,b:2}` when walking only the
first object's keys.

**What makes `Set` and `Map` hard?**
Their lookups use identity, so structurally equal object members do not match. Doing it
properly means matching each entry against an unmatched, deeply equal entry in the other —
quadratic. Most implementations compare by identity and document it.

**Should `{}` equal `new Foo()` when both have no own properties?**
That is the prototype question. Comparing prototypes says no, which is usually right for
application data. Some test libraries' loose modes say yes. Pick one and be explicit.

---

[Topic index](./README.md) · Next → [What "equal" means, and when not to ask](./02-what-equal-means.md)
