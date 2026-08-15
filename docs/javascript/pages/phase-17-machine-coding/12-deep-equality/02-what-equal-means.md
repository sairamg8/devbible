---
title: "12.2 · What \"equal\" means, and when not to ask"
sidebar_label: "02 · What \"equal\" means"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes). Documentation-validated; **nothing was run**.

A deep-equality function is a **policy**, not an algorithm. [12.1](./01-writing-it.md) made
seven decisions; a different set of decisions is equally correct for a different caller. The
useful skill is naming the decisions — and then noticing how often the right move is not to
ask the question at all.

## The policy checklist

Every implementation answers these, explicitly or by accident:

| Question | Common answers |
|---|---|
| `NaN` equal to itself? | **yes** (`Object.is`/SameValueZero) · no (`===`) |
| `+0` vs `-0`? | different (`Object.is`) · **equal** (SameValueZero) |
| `{}` vs `new Foo()` with the same fields? | different (prototype check) · equal (own-properties only) |
| `{a: undefined}` vs `{}`? | different (key counts) · equal ("undefined is absent") |
| Non-enumerable and symbol keys? | included (`Reflect.ownKeys`) · **ignored** (`Object.keys`) |
| Getters? | invoked, values compared · descriptors compared |
| Array holes vs `undefined` elements? | equal · different |
| `Set`/`Map` with object members? | identity lookup · structural matching (quadratic) |
| Circular structures? | supported · stack overflow |

**Write down the row that matters for your data** and test it. A comparison used for cache
invalidation and one used for test assertions want different rows: an assertion wants
`{a: undefined}` and `{}` distinguished, while a props comparison probably does not care.

## The two the language already gives you

- **`===` / `Object.is`** — reference identity for objects. `Object.is` differs only on `NaN`
  and `-0`.
- **SameValueZero** — what `Map`/`Set` keys, `Array.prototype.includes` and `WeakMap` use.
  It is `Object.is` with `+0` and `-0` treated as equal, which is why `[NaN].includes(NaN)` is
  `true` while `[NaN].indexOf(NaN)` is `-1` — `indexOf` uses strict equality.

**There is no structural equality in the language**, and that absence is the reason this topic
exists. It is also why `Map` keyed on objects is identity-keyed
([11 · `memoize`](../11-memoize/README.md)).

## Short-circuits that are always right

```js
if (a === b) return true;                              // identity — the fast path
if (typeof a !== typeof b) return false;
if (Array.isArray(a) !== Array.isArray(b)) return false;
if (a.length !== b.length) return false;               // arrays: cheapest possible rejection
if (Object.keys(a).length !== Object.keys(b).length) return false;
```

Comparing sizes before contents turns most negative answers into O(1). **The identity check
first is the one that matters most** in practice, because immutable data structures reuse
untouched subtrees — `===` on a shared branch skips the whole subtree
([Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)).

## When not to ask at all

This is the part worth taking from the topic.

- **Comparing state to decide whether to re-render.** Deep equality on every render is work
  proportional to the state; immutable updates make the same question a single `===`. If you
  are reaching for `deepEqual` in a `shouldComponentUpdate`/`useMemo` dependency, the copying
  discipline upstream is what needs fixing.
- **Detecting whether a form changed.** Compare a version counter, a dirty flag, or a hash of
  the serialised value — all O(1) to check.
- **Deduplicating a list of objects.** Key them (`by id`) and use a `Map`, rather than
  comparing every pair — pairwise deep equality is quadratic in the list length.
- **Assertions in tests.** Use the framework's — `toEqual`, `assert.deepStrictEqual`. They are
  battle-tested, produce a *diff* rather than a boolean, and their policy is documented.

**Where it genuinely belongs:** comparing data from two sources (a server response against a
local copy), caching a computation keyed on a structure you do not control, and tests.

## Cheap alternatives, and their limits

```js
JSON.stringify(a) === JSON.stringify(b);
```

⚠️ It answers a **different question**: key order matters, `undefined` and functions are
dropped, `Date`s become strings, `Map`/`Set` become `{}`, cycles throw, and `NaN`/`Infinity`
become `null`. It is fine for two objects you built yourself from the same code path with a
stable key order — and a bug generator otherwise
([Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md)).

A **shallow** comparison is often the correct middle ground, and it is what React's `memo` and
most props comparisons do:

```js
const shallowEqual = (a, b) =>
  Object.is(a, b) ||
  (typeof a === "object" && a !== null && typeof b === "object" && b !== null &&
   Object.keys(a).length === Object.keys(b).length &&
   Object.keys(a).every((k) => Object.hasOwn(b, k) && Object.is(a[k], b[k])));
```

One level, O(number of keys), no recursion, no cycle handling. **If the data is immutable,
shallow equality is deep equality** — because unchanged subtrees are the same reference.

## Testing your implementation

The cases that catch a naive version, worth writing as a checklist:

```js
deepEqual(NaN, NaN);                            // policy: true
deepEqual(0, -0);                               // policy: false with Object.is
deepEqual({}, []);                              // false
deepEqual({ a: undefined }, {});                // false
deepEqual([1, , 3], [1, undefined, 3]);         // policy — a hole is not an undefined element
deepEqual(new Date(0), new Date(0));            // true
deepEqual(new Map([["a", 1]]), new Map([["a", 1]]));   // true
deepEqual(new Set([{}]), new Set([{}]));        // false with identity lookup — document it
const c = {}; c.self = c; deepEqual(c, { self: c });   // pair tracking, no overflow
```

## Gotchas

**Symptom:** A deep comparison in a render path made the app slow
**Cause:** Work proportional to the state, on every render.
**Fix:** Immutable updates plus `===`, or a shallow comparison.

**Symptom:** `JSON.stringify` comparison reported unequal for identical data
**Cause:** Key order differs.
**Fix:** A real comparison, or a canonical serialisation.

**Symptom:** Deduplicating a list took quadratic time
**Cause:** Pairwise deep equality.
**Fix:** Derive a key and use a `Map`/`Set`.

**Symptom:** The comparison disagreed with the test framework's
**Cause:** Different policies — prototypes, `undefined` keys, symbol keys, holes.
**Fix:** Use the framework's assertion in tests; keep your own for application logic and
document its policy.

**Symptom:** `[NaN].indexOf(NaN)` was `-1` but `includes` was `true`
**Cause:** `indexOf` uses strict equality; `includes` uses SameValueZero.
**Fix:** Expected — `includes` for membership when `NaN` is possible.

**Symptom:** Getters ran during a comparison and had side effects
**Cause:** Reading `a[k]` invokes accessors.
**Fix:** Compare descriptors, or do not put side effects in getters.

## Interview questions

**★ Is deep equality one thing?**
No — it is a set of policy decisions: `NaN`, `-0`, prototypes, `undefined` versus missing keys,
symbol and non-enumerable keys, holes, `Set`/`Map` members, cycles. Two correct implementations
can disagree. Name the policy.

**★ How do you make it fast?**
Short-circuit: `a === b` first, then type, then array-ness, then length or key count. Most
negative answers become O(1), and identity checks skip whole shared subtrees when the data is
immutable.

**★ Why is `JSON.stringify(a) === JSON.stringify(b)` not deep equality?**
Key order matters, `undefined`/functions/symbols are dropped, `Date` becomes a string,
`Map`/`Set` become `{}`, `NaN` becomes `null`, and cycles throw. It answers "do these serialise
identically", which is a different question.

**★ When should you avoid deep equality?**
In render paths and change detection — immutable updates turn the question into `===`. For
deduplication — key the items instead of comparing pairs. In tests — use the framework's
assertion, which also gives you a diff.

**What is SameValueZero and where does it show up?**
`Object.is` with `+0` and `-0` treated as equal. It is what `Map`/`Set` keys, `WeakMap` and
`Array.prototype.includes` use — which is why `includes` finds `NaN` and `indexOf` does not.

**Is shallow equality ever enough?**
Yes, and usually. With immutable data, unchanged subtrees keep their identity, so a one-level
comparison gives the same answer as a deep one at a fraction of the cost.

---

← Prev [Writing it](./01-writing-it.md) · [Topic index](./README.md)
