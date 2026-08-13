---
title: "04.1 · What shallow actually means"
sidebar_label: "01 · What shallow means"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer). Documentation-validated.

**"Copy" is not one operation.** It is at least four, they differ in what happens
to nested values, and the difference is invisible until something mutates. This is
the topic the syllabus calls *"the one that costs teams real money"*, and the
reason is that a shallow copy looks completely correct in every test that does not
mutate a nested object.

## The model: a copy duplicates references, not the things they point to

An object property holds either a primitive or a **reference**. Copying a property
copies whatever is in the slot:

```js
const original = {
  name: "Ada",                  // a primitive — copied by value
  address: { city: "London" },  // a reference — the reference is copied
};

const copy = { ...original };

copy.name = "Grace";
original.name;          // "Ada"  — independent

copy.address.city = "Paris";
original.address.city;  // "Paris" ← the SAME object
```

Both objects now point at **one** `address`. Nothing was duplicated at depth one;
the reference was.

**That is the entire concept.** A shallow copy makes the top-level properties
independent and leaves everything below shared. Every "why did my state mutate?"
bug in this family is this diagram.

## Everything convenient is shallow

There is no shallow-versus-deep *choice* in the ordinary tools. They are all
shallow:

| Operation | Copies | Depth |
|---|---|---|
| `{ ...obj }` | own enumerable string+symbol properties | **shallow** |
| `Object.assign({}, obj)` | own enumerable string+symbol properties | **shallow** |
| `[...arr]`, `arr.slice()`, `Array.from(arr)` | elements | **shallow** |
| `arr.concat()`, `arr.toSpliced()`, `arr.toSorted()` | elements | **shallow** |
| `Object.create(Object.getPrototypeOf(o))` + copy | whatever you copy | **shallow** |
| `structuredClone(obj)` | see [chunk 2](./02-structuredclone.md) | **deep** |

MDN describes spread as *"shallow-cloning (excluding `prototype`)"* — both halves
matter, and the second is covered below.

The array row catches people because array methods feel like they "make a new
array", and they do — but `[...users]` gives you a new array holding **the same
user objects**. Sorting the copy does not disturb the original; editing
`copy[0].name` does.

## The four differences between spread and `Object.assign`

They are used interchangeably and are not interchangeable:

| | `{ ...target, ...source }` | `Object.assign(target, source)` |
|---|---|---|
| Mutates the target | no — builds a new object | **yes** |
| Triggers setters on the target | no — **defines** properties | **yes** — MDN flags this as a warning |
| Prototype of the result | always `Object.prototype` | the target's, unchanged |
| Return value | the new object | the (mutated) target |

The setter difference is the one that produces genuinely mysterious behaviour: if
your target has a setter, `Object.assign` runs it, so the stored value may not be
the value you passed, and it may throw. Spread never invokes a target setter
because the target is new and empty.

**Both read getters on the source side**, invoking them once and storing the
resulting value. So a lazily-computed getter becomes an eagerly-computed snapshot in
the copy, in both cases.

## The prototype is not copied

```js
class User {
  constructor(name) { this.name = name; }
  greet() { return `hi ${this.name}`; }
}

const u = new User("Ada");
const copy = { ...u };

copy.name;    // "Ada"  — fields survive
copy.greet(); // TypeError: copy.greet is not a function
```

`greet` lives on `User.prototype`, and spread copies **own** properties only. The
copy is a plain object with the right data and none of the behaviour.

This is the most common way people accidentally destroy an object they meant to
copy, and it is silent until something calls a method. **Do not spread class
instances.** If you need a copy of an instance, give the class a `clone()` method,
or construct a new one from the data.

The same applies to anything with identity: a `Date`, a `Map`, a `Set`, a
`RegExp`. `{ ...new Map([[1, 2]]) }` gives you `{}` — a `Map`'s contents are
internal slots, not own properties.

## When shallow is the right answer

Most of the time, and it is worth saying clearly, because "always deep clone" is a
real and costly overreaction.

**Shallow is correct when the nested values are treated as immutable.** This is the
whole basis of idiomatic React and Redux state updates:

```js
// replace the nested object rather than mutating it
setState((s) => ({ ...s, filters: { ...s.filters, status: "active" } }));
```

Nothing is deep-cloned. Each level that *changes* is copied one level; every
untouched branch is **shared by reference**, deliberately. That sharing is what
makes `prevState.items === nextState.items` a valid "did this change?" check, which
is what makes memoisation and `React.memo` work at all.

**A deep clone would break that**, not just cost time: every branch would get a new
identity, every equality check would report a change, and every memoised component
would re-render. So deep cloning React state is worse than useless — it defeats the
mechanism the framework relies on.

The rule: **copy the path you are changing, share everything else.** Reach for a
deep clone only when you genuinely need an independent object graph — a snapshot to
compare against later, a defensive copy of untrusted input you will mutate, or a
structure you are handing to code you do not control.

## Gotchas

**Symptom:** Editing a nested property of a copy changed the original
**Cause:** The copy is shallow — the nested object's **reference** was copied, so
both objects point at one object.
**Fix:** Copy the nested level too (`{ ...o, inner: { ...o.inner } }`), or
`structuredClone` if the depth is unknown.

**Symptom:** `TypeError: copy.someMethod is not a function` after copying an object
**Cause:** Spread and `Object.assign` copy **own** properties; methods live on the
prototype. MDN: *"shallow-cloning (excluding `prototype`)"*.
**Fix:** Do not spread class instances. Add a `clone()` method, or reconstruct with
`new`.

**Symptom:** `{ ...someMap }` or `{ ...someDate }` produces `{}` or nonsense
**Cause:** `Map`, `Set`, `Date` and `RegExp` keep their data in internal slots, not
in own enumerable properties.
**Fix:** `new Map(oldMap)`, `new Set(oldSet)`, `new Date(oldDate)` — each accepts
its own type. Or `structuredClone`, which handles all four.

**Symptom:** `Object.assign` into an existing object behaved unexpectedly
**Cause:** It **mutates** the target and **triggers its setters** (MDN warning),
unlike spread.
**Fix:** `{ ...target, ...patch }` unless you specifically want mutation and
setters.

**Symptom:** Sorting a copied array reordered the original too
**Cause:** You copied the array but `sort` mutates — or you never copied it.
`[...arr].sort()` is fine; `arr.slice().sort()` is fine; `arr.sort()` is not.
**Fix:** `toSorted()` in a modern runtime, or copy first.

**Symptom:** React components stopped memoising after a "fix" that deep-cloned state
**Cause:** A deep clone gives every branch a new identity, so every
`prev === next` check reports a change.
**Fix:** Shallow-copy only the path that changed and share the rest — that identity
sharing is what memoisation depends on.

## Interview questions

**★ What is the difference between a shallow and a deep copy?**
A shallow copy duplicates the top-level properties, so primitives become
independent but **nested objects are shared by reference** — mutating
`copy.a.b` changes `original.a.b`. A deep copy duplicates the whole object graph, so
nothing is shared. Spread, `Object.assign`, `slice` and `Array.from` are all
shallow; `structuredClone` is deep.

**★ Why does spreading a class instance break it?**
Because spread copies **own** enumerable properties and methods live on the
prototype. You get a plain object with the right fields and no behaviour, and the
failure is silent until a method is called — then
`TypeError: x.foo is not a function`.

**★ Difference between spread and `Object.assign`?**
`Object.assign` **mutates** its target and **triggers the target's setters** (MDN
flags this as a warning), and keeps the target's prototype. Spread builds a new
plain object and defines properties directly, so no setter runs. Both invoke
*source* getters and store the resulting values.

**★ Should you always deep clone to be safe?**
No — it is usually the wrong answer. Idiomatic immutable state updates copy only
the path that changed and **deliberately share** the untouched branches, because
that reference sharing is what makes `prev === next` a valid change check and what
makes memoisation work. Deep cloning state defeats the mechanism it was meant to
protect.

**Is `[...arr]` a deep copy of an array of objects?**
No. It is a new array containing the **same** object references. Sorting or
filtering the copy leaves the original alone; editing `copy[0].name` does not.

**How do you copy a `Map` or a `Date`?**
Their own constructors: `new Map(oldMap)`, `new Date(oldDate)`. Spread does not
work because their contents live in internal slots rather than own enumerable
properties — `{ ...new Map(…) }` is `{}`.

---

[Topic index](./README.md) · Next → [`structuredClone`](./02-structuredclone.md)
