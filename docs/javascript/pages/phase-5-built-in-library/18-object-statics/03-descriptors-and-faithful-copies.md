---
title: "3 · Descriptors, and faithful copies"
sidebar_label: "3 · Descriptors and faithful copies"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors), [`Object.getOwnPropertyDescriptor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor), [`Object.defineProperties()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap). Documentation-validated; **no timings**.

[Chunk 2](./02-seeing-everything.md) was about the **enumerable** axis. This one is about
the fourth axis — **value versus descriptor** — and the single practical thing it buys:
a copy that still behaves like the original.

## The problem, in six lines

Spread and `Object.assign` **read values**. That is a `[[Get]]`, which means a getter is
*called* and its answer stored as a plain data property:

```js
const account = {
  balanceCents: 1000,
  get balance() { return this.balanceCents / 100; },
};

const bad = { ...account };
account.balanceCents = 5000;
bad.balance;        // 🔴 10 — a stale snapshot; the getter is gone
```

🔴 **The getter did not survive the copy — its return value did.** From that moment
`bad.balance` is a number that will never change again, and nothing about the object's
appearance says so. `bad` still has a `balance` property that reads `10`; the fact that
it stopped being computed is invisible until the numbers disagree.

## Descriptors copy the definition, not the answer

```js
Object.getOwnPropertyDescriptor(account, "balance");
// { get: f, set: undefined, enumerable: true, configurable: true }

Object.getOwnPropertyDescriptor(bad, "balance");
// { value: 10, writable: true, enumerable: true, configurable: true }
```

**Two different kinds of property wearing the same name.** `getOwnPropertyDescriptors`
(plural, ES2017) hands you every one of them at once, and MDN documents this exact pair
as the faithful shallow clone:

```js
const good = Object.create(
  Object.getPrototypeOf(account),
  Object.getOwnPropertyDescriptors(account),
);

account.balanceCents = 5000;
good.balance;       // ✅ 50 — still a live getter
```

**Three things this recovers that spread cannot:**

| | spread / `Object.assign` | `create` + descriptors |
|---|---|---|
| accessors stay accessors | ❌ flattened to values | ✅ |
| non-enumerable properties | ❌ dropped | ✅ |
| the prototype | ❌ becomes `Object.prototype` | ✅ preserved |

⚠️ **The prototype row matters more than it looks.** A spread of a class instance is a
plain object: its methods are gone and `instanceof` is now `false`. The descriptor form
keeps the chain, so the clone is still an instance of the same class.

## Folding one object's definitions into another

The same descriptors go into an **existing** object with `Object.defineProperties` — the
correct way to give a target another object's accessors, and the shape MDN uses for
mixin-style composition:

```js
Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
```

Compare it with the naive version:

```js
Object.assign(target, source);   // ⚠️ getters called, setters on target fired, flags lost
```

**`Object.assign` performs a `[[Set]]` on the target**, so a setter already on the target
runs and can store something other than what you passed — or refuse the write entirely.
`defineProperties` performs a `[[DefineOwnProperty]]`, which installs the property as
specified and ignores inherited setters. The four differences in full are in
[Phase 4 · 04 · 01 · What shallow actually means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md);
the mixin question is [Phase 4 · 18 · 02](../../phase-4-objects-and-classes/18-mixins-and-composition/02-the-three-patterns.md).

🔴 **Still shallow.** Nested objects are shared references either way — the descriptor
form fixes **fidelity**, not **depth**. For depth,
[`structuredClone`](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md),
which has the opposite trade: it goes deep, and it drops functions, accessors and
prototypes entirely.

**The three copies, side by side:**

| You need | Use |
|---|---|
| a quick flat copy of data | `{ ...o }` |
| the same, merged into an existing object | `Object.assign(target, o)` |
| accessors, flags and prototype preserved | `Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))` |
| nested data genuinely detached | `structuredClone(o)` |
| a real domain object | a constructor or factory — not a copy at all |

## What no descriptor can see

🔴 **`#private` class fields are not properties.** They live in a separate internal
mechanism, so no amount of reflection reaches them — and no copy carries them:

```js
class Token {
  #secret = "abc";
  reveal() { return this.#secret; }
}
const t = new Token();

Object.getOwnPropertyNames(t);          // []
Reflect.ownKeys(t);                     // []
Object.getOwnPropertyDescriptors(t);    // {}
JSON.stringify(t);                      // "{}"

const clone = Object.create(Object.getPrototypeOf(t), Object.getOwnPropertyDescriptors(t));
clone.reveal();   // 🔴 TypeError — the method exists, the private field does not
```

⚠️ **A "faithful" clone of a class instance with private state is not faithful.** It
copies the prototype, so every method comes along, and every method that touches `#state`
throws on the copy. This is the argument for giving a class an explicit `clone()` or a
static `from()` rather than reflecting over it.

**That is also the genuine difference between `#` and every convention before it** — an
underscore prefix, a symbol key, a non-enumerable property. All three hide from casual
iteration and all three are findable. `#` is not
([Phase 4 · 20 · 02 · `#` today and choosing](../../phase-4-objects-and-classes/20-private-state-before-hash/02-hash-today-and-choosing.md)).

State held in a `WeakMap` keyed by the instance is equally invisible and equally lost,
for the same reason: it is not on the object.

## Where this family belongs — and where it does not

✅ **Tooling.** Serialisers, deep-equality helpers, test matchers, dev-tools inspectors, a
logger that has to render an `Error` — all of these must see what is really there.

✅ **Copying faithfully**, as above, and defining properties with deliberate flags
([Phase 4 · 11 · Property descriptors](../../phase-4-objects-and-classes/11-property-descriptors.md)).

✅ **Debugging.** `Reflect.ownKeys(thing)` and
`Object.getOwnPropertyDescriptors(thing)` in a console are the fastest answers to "what
is actually on this object, and how is it configured".

🔴 **Not business logic.** If feature code reaches for `getOwnPropertyNames` or
descriptors, it is usually working around a shape that should have been modelled: a
non-enumerable property was made non-enumerable *on purpose*, and iterating one means
depending on a decision someone made to keep it out of iteration. A `Map`, an explicit
field or a documented interface is the answer.

⚠️ **None of this makes anything safe.** `getOwnPropertySymbols` finds library symbols,
and a non-enumerable property is still writable unless its descriptor says otherwise.
Hiding is not access control ([Phase 4 · 12 · `freeze` and `seal`](../../phase-4-objects-and-classes/12-freeze-and-seal/README.md)).

## Gotchas

**Symptom:** A copied object's getter returned a stale value
**Cause:** Spread and `Object.assign` invoke the getter once and store a plain value.
**Fix:** `Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))`.

**Symptom:** Spreading an instance lost all its methods, and `instanceof` became `false`
**Cause:** Methods are non-enumerable and live on the prototype; spread produces a plain
object with `Object.prototype`.
**Fix:** Keep the instance, clone with descriptors, or give the class a `clone()`.

**Symptom:** The descriptor clone of an instance throws on every method call
**Cause:** `#private` fields are not properties, so they were never copied; the methods
that read them came along anyway.
**Fix:** An explicit `clone()` or static `from()` on the class.

**Symptom:** `Object.assign(target, source)` stored something other than the source value
**Cause:** `assign` does a `[[Set]]`, so a setter on the target — including an inherited
one — ran instead.
**Fix:** `Object.defineProperties(target, Object.getOwnPropertyDescriptors(source))`.

**Symptom:** A property survived the copy but its `writable: false` did not
**Cause:** Value-copying rebuilds every property with the default flags, all `true`.
**Fix:** Copy descriptors.

**Symptom:** `structuredClone` threw on an object that copied fine with spread
**Cause:** It refuses functions, and it does not carry accessors or prototypes.
**Fix:** Pick by what you need — depth, or fidelity. They are different problems.

## Interview questions

**★ How do you shallow-copy an object without turning its getters into stale values?**
`Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))`. It copies
definitions rather than values, so accessors stay accessors, non-enumerable properties
survive and the prototype is preserved. Still shallow — nested objects are shared.

**★ What is the difference between `Object.assign` and `Object.defineProperties`?**
`assign` reads values with `[[Get]]` and writes them with `[[Set]]`, so source getters run
and target setters fire, and every property lands as a plain writable-enumerable-
configurable data property. `defineProperties` installs descriptors directly with
`[[DefineOwnProperty]]`, preserving accessors and flags and ignoring inherited setters.

**★ Can reflection reach a `#private` field?**
No. Private elements are not properties; they are held in a separate internal mechanism,
so `getOwnPropertyNames`, `Reflect.ownKeys`, `getOwnPropertyDescriptors` and
`JSON.stringify` all return nothing for them. That is the real difference from an
underscore prefix or a symbol key, both of which are findable.

**★ Why can a "faithful" clone of a class instance still be broken?**
Because it copies properties and the prototype, but not private state. Every method comes
across and every method that touches `#state` throws on the copy. Classes with private
fields need an explicit `clone()` or static `from()`.

**When would you choose `structuredClone` over the descriptor clone?**
When the requirement is depth rather than fidelity — genuinely detaching nested data,
including `Map`, `Set`, `Date` and typed arrays. It is the opposite trade: it goes deep
and drops functions, accessors and prototypes.

**Where should descriptor reflection appear in an application?**
In tooling — serialisers, matchers, loggers, inspectors — and in deliberate property
definition. Feature code reaching for it is usually coupling itself to internals that
were hidden on purpose.

---

← [2 · Seeing everything](./02-seeing-everything.md) · [Topic index](./README.md) · Next: [4 · Grouping, and the statics that do not exist](./04-grouping-and-the-gaps.md) →
