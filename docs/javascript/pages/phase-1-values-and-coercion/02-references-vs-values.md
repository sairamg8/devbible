---
title: "02 · Primitives are copied, objects are shared"
sidebar_label: "02 · References vs values"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex5-references.mjs`.

**The single biggest source of "why did this value change?"** Assigning a
primitive copies it. Assigning an object copies the *reference*, and both names
now point at the same thing.

## Measured

```js
// sandbox/js-p1/ex5-references.mjs
let a = 5, b = a; b++;
console.log('primitives copied:      a =', a, ' b =', b);

const cart1 = { items: ['sku-1'] };
const cart2 = cart1; cart2.items.push('sku-2');
console.log('objects shared:         cart1.items =', cart1.items);

const shallow = { ...cart1 }; shallow.items.push('sku-3');
console.log('spread is SHALLOW:      cart1.items =', cart1.items);

const deep = structuredClone(cart1); deep.items.push('sku-4');
console.log('structuredClone deep:   cart1.items =', cart1.items, '| clone =', deep.items);
```

```
primitives copied:      a = 5  b = 6
objects shared:         cart1.items = [ 'sku-1', 'sku-2' ]
spread is SHALLOW:      cart1.items = [ 'sku-1', 'sku-2', 'sku-3' ]
structuredClone deep:   cart1.items = [ 'sku-1', 'sku-2', 'sku-3' ] | clone = [ 'sku-1', 'sku-2', 'sku-3', 'sku-4' ]
```

Line 3 is the one that costs teams real time. **`{ ...cart1 }` looked like a
copy and the mutation still reached the original**, because spread copies one
level: `shallow.items` and `cart1.items` are the same array.

Only the fourth line is actually independent.

## Equality follows the same rule

```
  {a:1} === {a:1}         false
  [1,2] === [1,2]         false
  same reference          true
```

Objects compare by **identity**, never by content. Two separately-built objects
with identical contents are never `===`. This is why you cannot use `===` to
check whether a cart changed, and why [page 14](./14-value-equality.md) exists.

## The three copy depths

```js
const cart = {
  id: 'c-1',
  items: [{ sku: 'A', qty: 1 }],
  meta: { coupon: null },
};

// 1. No copy — a second name for the same object
const alias = cart;

// 2. Shallow — new outer object, SAME inner objects
const shallow1 = { ...cart };
const shallow2 = Object.assign({}, cart);
shallow1.id = 'c-2';           // safe: id is a primitive on the outer level
shallow1.items.push({});       // NOT safe: reaches cart.items

// 3. Deep — fully independent
const deep = structuredClone(cart);
deep.items.push({});           // safe
```

| Technique | Depth | Handles cycles? | Handles `Map`/`Set`/`Date`? | Loses |
|---|---|---|---|---|
| `{ ...obj }` / `Object.assign` | 1 level | n/a | n/a | nested sharing remains |
| `structuredClone(obj)` | full | ✅ | ✅ | **functions**, DOM nodes, prototypes |
| `JSON.parse(JSON.stringify(obj))` | full | ❌ throws | ❌ mangles | `undefined`, functions, `Symbol`, `NaN`→`null` |
| hand-written | full | if you write it | if you write it | — |

**`structuredClone` is the default answer.** It is a built-in, present in both
Node and browsers, and it handles cycles and the collection types that the JSON
round-trip destroys. It throws on functions, which is usually a signal your data
had something in it that should not be there.

## Why this is the prerequisite for React

Immutable state updates are not a style preference; they follow from this page.

```js
// WRONG — mutates the existing object, so the reference never changes
function addItemBad(cart, item) {
  cart.items.push(item);
  return cart;                    // same reference: React sees no change
}

// RIGHT — new references all the way down the changed path
function addItem(cart, item) {
  return { ...cart, items: [...cart.items, item] };
}
```

React (and every state library) decides "did this change?" with a reference
comparison, exactly like the `===` results above. Mutating in place leaves the
reference identical, so the check says "unchanged" and the UI does not update.
Returning new objects along the changed path is what makes the comparison work.

Note what `addItem` does **not** do: it does not deep-clone. Untouched
branches — `cart.meta` here — keep their original references on purpose. That is
**structural sharing**, and it is why immutable updates stay cheap.

## Function arguments follow the same rule

```js
function applyDiscount(cart, pct) {
  cart.total = cart.total * (1 - pct);   // caller's object IS modified
  cart = { total: 0 };                    // rebinding the parameter does NOTHING outside
}
```

JavaScript is always pass-by-value — but for an object, the *value* passed is
the reference. So the function can mutate what the reference points at, and
cannot change which object the caller's variable names.

**Practical rule:** a function that takes an object should either be obviously a
mutator (named `updateX`, returns nothing) or be pure (returns a new object and
touches nothing). Anything in between is where bugs live.

## Gotchas

**Symptom:** you spread an object to copy it, and a mutation still affected the
original.
**Cause:** spread is one level deep; nested objects and arrays are still shared.
**Fix:** `structuredClone` for a true copy, or spread each nested level you
actually change.

**Symptom:** two objects with identical contents are not `===`.
**Cause:** objects compare by identity, not content.
**Fix:** compare the fields you care about, or use a deep-equal helper —
[page 14](./14-value-equality.md).

**Symptom:** React state changed but the component did not re-render.
**Cause:** the state object was mutated in place, so its reference is unchanged
and the equality check reports no change.
**Fix:** return a new object along the changed path.

**Symptom:** `structuredClone` threw `DataCloneError`.
**Cause:** the object contains a function, a DOM node, or a class instance whose
prototype cannot be transferred.
**Fix:** clone only the data, or write an explicit clone. A function in your
state is usually the real problem.

**Symptom:** a default parameter object seems shared between calls.
**Cause:** you hoisted it — `const DEFAULTS = {}` used as `function f(o = DEFAULTS)`
— so every caller mutates the same object.
**Fix:** `function f(o = {})`, which creates a fresh object per call.

## Interview questions

**★ Is JavaScript pass-by-value or pass-by-reference?**
Always pass-by-value — but for objects the value *is* a reference. So a function
can mutate the object the caller passed, and cannot change which object the
caller's variable points to. Reassigning a parameter has no effect outside.

**★ What is the difference between a shallow and a deep copy?**
A shallow copy (`{...obj}`, `Object.assign`) creates a new outer object whose
nested values are the *same* references. A deep copy recreates every level.
Measured: after `{...cart}`, pushing to `shallow.items` still changed
`cart.items`.

**★ Why do immutable updates matter in React?**
Because change detection is a reference comparison. Mutating state in place
leaves the reference identical, so React concludes nothing changed and skips the
re-render. Returning new objects along the changed path makes the comparison
correct — while untouched branches keep their references, which keeps it cheap.

**How do you deep-copy an object?**
`structuredClone` is the default: built in, handles cycles, `Map`, `Set`, `Date`
and typed arrays. It throws on functions and DOM nodes. The
`JSON.parse(JSON.stringify(x))` trick is worse — it drops `undefined`, functions
and symbols, turns `Date` into a string, empties `Map`/`Set`, converts `NaN` to
`null`, and throws on cycles.

**Why is `{} === {}` false?**
Objects compare by identity. Two object literals create two distinct objects, so
they are never `===` regardless of contents. Only two names for the same object
compare equal.

---

← [01 · The eight types](./01-the-eight-types.md) · [Phase index](./) · Next: [03 · `==` vs `===`](./03-equality.md) →
