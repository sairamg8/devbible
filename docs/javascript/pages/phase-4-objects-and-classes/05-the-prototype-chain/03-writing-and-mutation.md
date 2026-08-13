---
title: "05.3 · Writing, shadowing and mutating the chain"
sidebar_label: "03 · Writing and mutation"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [`Object.setPrototypeOf`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf). Documentation-validated.

Reads walk the chain. **Writes do not.** That asymmetry is the source of the two
remaining prototype traps — the shared-mutable-state bug, and the performance cost
of changing a prototype after the fact.

## A write always creates an own property

```js
const parent = {
  value: 2,
  method() {
    return this.value + 1;
  },
};

const child = {
  __proto__: parent,
};

console.log(child.method()); // 3

child.value = 4; // assign the value 4 to child
// This shadows the 'value' property on parent.
// The child object now looks like:
// { value: 4, __proto__: { value: 2, method: [Function] } }

console.log(child.method()); // 5
```

MDN's commentary on the last line: *"Since `child` now has the `value` property,
`this.value` means `child.value` instead of `parent.value`."*

**The write did not travel up the chain.** It created a new own property on `child`
that shadows the inherited one. `parent.value` is still `2`, and every other object
inheriting from `parent` still sees `2`.

This is almost always what you want, and it is why inherited defaults work: put the
default on the prototype, and any instance that assigns gets its own value without
disturbing anyone else.

## The trap: mutation is not assignment

The rule above protects you from **assignment**. It does nothing about **mutation**:

```js
function Basket() {}
Basket.prototype.items = [];      // ⚠️ one array, shared by every instance

const a = new Basket();
const b = new Basket();

a.items.push("apple");   // MUTATES the shared array — no own property created
b.items;                 // ["apple"]  ← b's basket has a's apple

a.items = ["pear"];      // ASSIGNMENT — creates an own property on a
b.items;                 // ["apple"]  ← unaffected this time
```

`a.items.push(…)` is a **read** of `items` followed by a method call on the result.
The read walks the chain and finds the *one* array on `Basket.prototype`; `push`
mutates it in place. No assignment ever happens, so no own property is created, and
every instance sees the change.

**This is why object and array values do not belong on a prototype.** Primitives are
safe — you cannot mutate a number, so the only way to change it is assignment, which
shadows. Anything with internal state is shared.

The fix is to create the value per instance, in the constructor or as a class field:

```js
class Basket {
  items = [];            // ✅ an own property on every instance
}
// or
function Basket() { this.items = []; }
```

Class fields are own properties of the instance, not prototype properties, precisely
so this works.

## Setters on the prototype **do** intercept the write

One exception to "a write creates an own property": if the chain has an **accessor**
with a setter for that key, the setter runs and no own property is created.

```js
const proto = {
  set name(v) { this._name = v.trim(); },
  get name() { return this._name; },
};
const obj = Object.create(proto);

obj.name = "  Ada  ";
Object.hasOwn(obj, "name");   // false — the setter handled it
Object.hasOwn(obj, "_name");  // true  — the setter's own write
```

So "assignment always shadows" is true for **data** properties and false for
accessors. This is what makes `Object.defineProperty`-based reactivity systems work,
and it is also why `Object.assign` triggering setters
([01 · Methods, accessors and spread](../01-object-literals/02-methods-accessors-and-spread.md))
can reach a setter the target inherited rather than owns.

A read-only inherited property is the other half of the same rule: assigning to it
fails silently in sloppy mode and throws `TypeError` in strict mode, rather than
creating a shadow.

## Changing a prototype after creation

You can, and MDN is unusually direct that you should not:

```js
// ❌ BAD: Avoid mutating prototypes dynamically
const obj = { a: 1 };
const anotherObj = { b: 2 };
Object.setPrototypeOf(obj, anotherObj);
// This causes engines to recompile code for de-optimization
```

MDN's reasons, quoted:

- *"JavaScript engines make optimizations based on the prototype chain at object
  creation time"*
- *"Dynamically changing `[[Prototype]]` invalidates those optimizations"*
- *"The property lookup time for high-up properties can have negative performance
  impact"*

The engine specialises property access on an object's shape *including its chain*.
Re-pointing the chain invalidates every one of those specialisations — not only for
this object, but for the compiled code that touched it.

Note what this page does **not** claim: no multiplier. MDN says engines *"recompile
code for de-optimization"* and gives no figure, and no run here produced one.
"Measurably slower and worth avoiding" is the whole of the honest claim.

### Set it at creation instead

MDN's recommended alternatives, in its own order of preference:

```js
// ✅ BETTER: Set prototype during object creation
const obj = Object.create(anotherObj, {
  a: { value: 1, enumerable: true }
});

// ✅ BEST: Use object literal syntax
const obj = {
  a: 1,
  __proto__: anotherObj
};
```

Note the literal form is MDN's **best** recommendation here — the one legitimate use
of the `__proto__` colon form from
[01 · `__proto__` and null-prototype objects](../01-object-literals/04-proto-and-null-prototype.md).
It is dedicated creation-time syntax, not the deprecated accessor, and the engine
sees the final shape immediately.

`Object.setPrototypeOf` remains the right tool for the rare genuine case — fixing up
an object you did not create, or the old-style inheritance wiring you may still meet
in legacy code.

## Keep the chain short

MDN: *"Accessing non-existent properties traverses the entire chain."* A miss on a
deep chain visits every level. That is a real argument against deep inheritance
hierarchies in JavaScript specifically — not merely a design preference. Two or
three levels is normal; ten is a smell, and each extra level taxes every failed
lookup.

The same reasoning is why **extending built-in prototypes** is bad practice beyond
the obvious collision risk: it lengthens the chain for every object of that type in
the program, it makes properties appear in `for...in` if assigned normally (they are
enumerable), and two libraries doing it will silently fight.

## Gotchas

**Symptom:** Mutating an array on one instance changed it on every instance
**Cause:** The array lives on the **prototype**, so all instances read the same one.
`push` is a mutation, not an assignment, so no shadowing own property is created.
**Fix:** Create the value per instance — a class field (`items = []`) or an
assignment in the constructor.

**Symptom:** Assigning to an inherited property did not change it for other objects
**Cause:** Correct behaviour — a write creates an **own** property that shadows the
prototype's, leaving the prototype untouched.
**Fix:** Nothing. If you meant to change the shared value, assign to the prototype
explicitly.

**Symptom:** Assigning to a property did *not* create an own property
**Cause:** The chain has an inherited **setter** for that key, which intercepted the
write. Or the inherited property is read-only, in which case strict mode throws.
**Fix:** Check with `Object.getOwnPropertyDescriptor` up the chain. This is the
mechanism reactivity systems rely on, so it may be deliberate.

**Symptom:** Performance dropped after a refactor that called `Object.setPrototypeOf`
**Cause:** MDN: engines optimise on the chain as it is *"at object creation time"*,
and changing it *"causes engines to recompile code for de-optimization."*
**Fix:** Set the prototype at creation — `{ __proto__: proto, … }` (MDN's "best") or
`Object.create(proto, descriptors)`.

**Symptom:** A `for...in` loop picked up methods added to a built-in's prototype
**Cause:** `Fn.prototype.m = …` creates an **enumerable** property, and `for...in`
walks the chain.
**Fix:** Do not extend built-in prototypes. If you must, use
`Object.defineProperty` with `enumerable: false` — and prefer `Object.keys` in your
own loops regardless.

**Symptom:** Property misses are slow in a deep hierarchy
**Cause:** A miss traverses the **entire** chain before returning `undefined`.
**Fix:** Flatten the hierarchy, or use a `Map` where you are really doing lookups.

## Interview questions

**★ What happens when you assign to a property that exists on the prototype?**
For a **data** property, the write creates an **own** property on the receiver that
shadows the inherited one — the prototype is untouched and other objects inheriting
from it are unaffected. For an inherited **accessor**, the setter runs instead and no
own property is created. For an inherited read-only property, strict mode throws.

**★ Why is `Fn.prototype.items = []` a bug?**
Because every instance shares that one array. `instance.items.push(x)` is a *read*
followed by a mutation, so no shadowing own property is ever created and every
instance sees the change. Primitives on a prototype are safe — you can only replace
them, which shadows — but anything with internal state must be created per instance.

**★ Why should you avoid `Object.setPrototypeOf`?**
MDN: engines optimise property access based on the prototype chain *"at object
creation time"*, and changing it dynamically *"causes engines to recompile code for
de-optimization"*. Set the chain at creation instead — MDN's preferred forms are the
`{ __proto__: proto }` literal, then `Object.create(proto, descriptors)`.

**★ Why are deep prototype chains discouraged in JavaScript specifically?**
Because a lookup that **misses** traverses the entire chain before returning
`undefined`, so every extra level taxes every failed lookup. Combined with dynamic
lookup and the shared-mutable-state trap, it is why composition is usually preferred
over deep inheritance here.

**Does a write ever travel up the prototype chain?**
Only through an inherited **setter**, which intercepts the assignment and does
whatever it wants. Plain data-property writes never modify the prototype; they
shadow it.

**Why is extending `Array.prototype` bad practice?**
It lengthens the chain for every array in the program, a normal assignment makes the
addition **enumerable** so it shows up in `for...in`, and two libraries adding the
same name silently conflict. Future language additions can collide with it too.

---

← [`prototype` vs `[[Prototype]]`](./02-prototype-vs-the-slot.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
