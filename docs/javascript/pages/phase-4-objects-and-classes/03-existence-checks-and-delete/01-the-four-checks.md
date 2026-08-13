---
title: "03.1 · The four existence checks"
sidebar_label: "01 · The four checks"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in), [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.prototype.hasOwnProperty`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty). Documentation-validated.

**"Does this object have that property?" has four answers in JavaScript, and they
disagree with each other on purpose.** Picking the wrong one produces a bug that
only appears for one specific input — an inherited name, an explicit `undefined`,
or a key a user chose.

The four:

| Check | Own | Inherited | Property exists but is `undefined` |
|---|---|---|---|
| `"k" in obj` | ✅ true | ✅ **true** | ✅ true |
| `Object.hasOwn(obj, "k")` | ✅ true | ❌ false | ✅ true |
| `obj.hasOwnProperty("k")` | ✅ true | ❌ false | ✅ true |
| `obj.k !== undefined` | ✅ true | ✅ **true** | ❌ **false** |

Two columns carry all the difference: **whether the prototype chain counts**, and
**whether a property holding `undefined` counts as present**.

## `in` — own *or* inherited

```js
const ages = { alice: 18, bob: 27 };

function hasPerson(name) {
  return name in ages;
}

hasPerson("hasOwnProperty"); // true — inherited from Object.prototype
```

That example is MDN's, and it is the entire argument against `in` for
dictionary lookups. `ages` has no person called `hasOwnProperty`, but `in` walks
the prototype chain and finds `Object.prototype.hasOwnProperty`. So does
`"toString" in ages`, `"constructor" in ages`, and every other name on
`Object.prototype`.

**If the key comes from user input, `in` is a bug.** A user named `constructor`
gets a `true` from a dictionary that never heard of them. MDN's own remedy is on
the same page: *"To check only own properties, use `Object.hasOwn()`."*

Where `in` is exactly right: checking for a **capability** rather than a data key,
where inherited absolutely should count.

```js
if ("scrollBehavior" in document.documentElement.style) { /* feature detection */ }
if ("then" in value) { /* thenable — a promise-like */ }
```

Feature detection is the canonical `in` use case, because a DOM method lives on the
prototype and `Object.hasOwn` would return `false` for every one of them.

### `in` throws on primitives

```js
const color1 = new String("green");
"length" in color1; // true

const color2 = "coral";
"length" in color2; // TypeError: cannot use 'in' operator to search for 'x' in 'y'
```

`in` requires an object on the right. A primitive string is not one — and unlike
property *access*, which auto-boxes, `in` does not. So `"length" in someString`
throws while `someString.length` works. This bites when a value that is usually an
object is occasionally a string, which is most of what comes out of an API.

`Object.hasOwn` does not have this problem: it coerces its first argument to an
object, so `Object.hasOwn("coral", "length")` is `true` rather than an exception.

## `Object.hasOwn` — the modern default

```js
const example = {};
example.prop = "exists";

Object.hasOwn(example, "prop");            // true
Object.hasOwn(example, "toString");        // false
Object.hasOwn(example, "hasOwnProperty");  // false

"prop" in example;                         // true
"toString" in example;                     // true
"hasOwnProperty" in example;               // true
```

This is the one to reach for by default. MDN recommends it explicitly over
`hasOwnProperty`, *"because it works for null-prototype objects and with objects
that have overridden the inherited `hasOwnProperty()` method."*

Those are the two cases where `obj.hasOwnProperty(k)` — the idiom of the previous
fifteen years — is actively broken.

**Case 1: a null-prototype object has no such method.**

```js
const foo = Object.create(null);
foo.prop = "exists";

foo.hasOwnProperty("prop");
// Uncaught TypeError: foo.hasOwnProperty is not a function

Object.hasOwn(foo, "prop"); // true
```

`Object.create(null)` is the recommended shape for a dictionary of untrusted keys
(see [01 · Keys, order and `__proto__`](../01-object-literals/02-keys-order-and-proto.md))
— so the two techniques you would naturally combine are exactly the two that do not
work together. `Object.hasOwn` is the fix.

**Case 2: the object shadowed the method.**

```js
const foo = {
  hasOwnProperty() {
    return false;
  },
  bar: "The dragons be out of office",
};

foo.hasOwnProperty("bar");   // false  ← lies
Object.hasOwn(foo, "bar");   // true
```

`obj.hasOwnProperty(k)` is an ordinary property lookup on `obj`, so an object can
override it — accidentally, or deliberately if it came from an attacker. Parsing
JSON that contains a `"hasOwnProperty"` key is enough to arm this.

The old workaround was `Object.prototype.hasOwnProperty.call(obj, prop)`, which
works but, in MDN's words, `Object.hasOwn()` is *"more intuitive and concise."* If
you need to support environments without it (it is ES2022), the `.call` form is
the polyfill-free fallback — but every current runtime has `Object.hasOwn`.

## `!== undefined` — the one that conflates two states

```js
const config = { retries: 0, timeout: undefined };

config.timeout !== undefined;          // false — but the key IS there
Object.hasOwn(config, "timeout");      // true
```

This is the check most code actually uses, and most of the time it is fine. It
becomes a bug the moment **an explicit `undefined` means something different from
a missing key** — which is precisely the situation in options objects, patch
payloads, and anything that distinguishes "leave it alone" from "clear it".

```js
// A PATCH handler. These two requests mean different things:
//   { "nickname": null }        → clear the nickname
//   { }                         → don't touch the nickname
// and if the client sends { "nickname": undefined }, JSON drops the key entirely.
if (patch.nickname !== undefined) { /* … */ }   // cannot tell them apart
if (Object.hasOwn(patch, "nickname")) { /* … */ } // can
```

Note the JSON detail in that comment: `JSON.stringify` **omits** properties whose
value is `undefined`, so `undefined` never survives a round trip. Over the wire the
distinction you need is present-vs-absent or `null`-vs-absent, never
`undefined`-vs-absent — which is why `null` is the conventional "explicitly empty"
value in an API payload.

**Where `!== undefined` is genuinely the right check:** when you only care about
the *value*, inherited or not, and `undefined` and missing mean the same thing to
you. That covers a lot of application code, and reaching for `Object.hasOwn`
everywhere is over-engineering. The rule is: **if `undefined` is a meaningful
value in your data, stop using `!== undefined`.**

### Optional chaining and `??` are value checks, not existence checks

```js
user?.profile?.name ?? "anonymous";
```

`?.` short-circuits on `null` and `undefined`, and `??` falls back on the same two.
Neither tells you whether a property exists — `{ name: undefined }` and `{}` are
identical to both. They are the right tool for *safely reading a value with a
default*, and the wrong tool for *deciding whether a key was supplied*.

The important distinction from `||`: `??` falls back only on `null`/`undefined`,
while `||` also falls back on `0`, `""`, `false` and `NaN`. `retries || 3` turns a
deliberate `retries: 0` into `3`; `retries ?? 3` does not. That is the same
"is it absent or is it a legitimate falsy value?" question this whole page is
about.

## Array holes make all four disagree

```js
const trees = ["redwood", "bay", "cedar", "oak", "maple"];
3 in trees;         // true
delete trees[3];
3 in trees;         // false — the slot is now a hole

const empties = new Array(3);
empties[2];         // undefined
2 in empties;       // false — never had a value

trees[3] = undefined;
3 in trees;         // true — the property exists and holds undefined
```

Three states, not two: **present with a value**, **present holding `undefined`**,
and **absent (a hole)**. Reading gives `undefined` for the last two, so only `in`
and `Object.hasOwn` can tell them apart. MDN confirms `Object.hasOwn(fruits, 4)` is
`false` for an index past the end, and `true` for a real element.

This matters because array methods disagree about holes too: `map` and `forEach`
skip holes while preserving them in the output, `Object.keys` omits them, but
spread and `for...of` visit them as `undefined`. **Never create holes deliberately**
— use `splice` to remove an element, or `filter` to build a new array. Holes are
covered properly in Phase 5.

## `#field in obj` — the brand check

An ES2022 form of `in` that has nothing to do with property existence in the
ordinary sense:

```js
class Person {
  #age;
  constructor(age) {
    this.#age = age;
  }
  static isPerson(o) {
    return #age in o; // branded check
  }
}

const p1 = new Person(20);
Person.isPerson(p1); // true
Person.isPerson({}); // false
```

This asks: *was this object constructed by this class?* Private fields cannot be
added afterwards, cannot be forged from outside the class body, and are not
inherited by anything that did not go through the constructor — so the answer is
trustworthy in a way `instanceof` is not. `instanceof` can be fooled by
`Symbol.hasInstance`, by a reassigned `prototype`, and by two copies of the same
class in different realms.

MDN notes the ergonomic point too: it *"avoids needing try-catch to detect private
elements and prevents `TypeError` when accessing undeclared private fields."*
Before this syntax, probing for a private field meant a `try`/`catch`, because
accessing `#age` on an object that does not have it is a `TypeError`.

## Which to use

- **`Object.hasOwn(obj, key)`** — the default for data. Own properties only, safe
  on null-prototype objects, immune to shadowing.
- **`key in obj`** — for capability and feature detection, where inherited members
  *should* count. Never for user-supplied keys.
- **`obj.key !== undefined`** — fine when `undefined` and missing mean the same
  thing to you. Never in a patch/options path.
- **`obj.hasOwnProperty(key)`** — legacy. MDN recommends `Object.hasOwn` instead.
  Use `Object.prototype.hasOwnProperty.call(obj, key)` only if you must support a
  pre-2022 runtime.
- **`#field in obj`** — brand checks, when you need to know an object really came
  from your class.

## Gotchas

**Symptom:** A dictionary lookup returns `true` for a key nobody added — `toString`,
`constructor`, `hasOwnProperty`
**Cause:** `in` walks the prototype chain. MDN's own example: `hasPerson("hasOwnProperty")`
is `true`.
**Fix:** `Object.hasOwn(obj, key)`. MDN: *"To check only own properties, use
`Object.hasOwn()`."*

**Symptom:** `TypeError: foo.hasOwnProperty is not a function`
**Cause:** The object was made with `Object.create(null)` and inherits nothing.
**Fix:** `Object.hasOwn(foo, prop)` — a static method that needs nothing from the
object.

**Symptom:** `hasOwnProperty` returns `false` for a property that is plainly there
**Cause:** The object has its own `hasOwnProperty` shadowing the inherited one —
MDN's example returns `false` for a key whose value is right beside it. Parsed JSON
can do this.
**Fix:** `Object.hasOwn`, or `Object.prototype.hasOwnProperty.call(obj, prop)`.

**Symptom:** `TypeError: cannot use 'in' operator to search for 'x' in 'y'`
**Cause:** The right operand is a primitive. `in` requires an object and does not
auto-box, unlike property access.
**Fix:** `Object.hasOwn`, which coerces, or guard with
`typeof v === "object" && v !== null`.

**Symptom:** A PATCH endpoint cannot distinguish "clear this field" from "leave it
alone"
**Cause:** `!== undefined` conflates a missing key with a key holding `undefined`.
**Fix:** `Object.hasOwn(patch, key)`. Note `JSON.stringify` drops `undefined`
values entirely, so over the wire the distinction must be present-vs-absent or
`null`-vs-absent.

**Symptom:** `arr[3]` is `undefined` but `3 in arr` is `false`
**Cause:** A hole — from `delete`, from `new Array(n)`, or from a sparse literal.
Reading a hole and reading a stored `undefined` both give `undefined`.
**Fix:** Do not create holes. Use `splice` to remove elements. Use `in` or
`Object.hasOwn` when you must tell the three states apart.

**Symptom:** `options.retries || 3` turns a deliberate `0` into `3`
**Cause:** `||` falls back on every falsy value, not just absence.
**Fix:** `options.retries ?? 3`, which only falls back on `null`/`undefined`.

## Interview questions

**★ Difference between `in` and `hasOwnProperty`?**
`in` returns `true` for inherited properties as well as own ones; `hasOwnProperty`
is own-only. So `"toString" in {}` is `true` and `{}.hasOwnProperty("toString")` is
`false`. Use `in` for feature detection, own-checks for data — and prefer
`Object.hasOwn` to `hasOwnProperty`.

**★ Why is `Object.hasOwn` preferred over `obj.hasOwnProperty()`?**
MDN's reason: it works on **null-prototype objects**, which do not inherit the
method at all, and on objects that have **overridden** `hasOwnProperty` — an
override that parsed JSON can introduce. It is a static method, so the object
cannot interfere with it.

**★ How do you tell a missing property from one whose value is `undefined`?**
`Object.hasOwn(obj, key)` (or `key in obj` if inherited should count).
`obj.key !== undefined` cannot distinguish them, and neither can `?.` or `??`. This
matters in PATCH payloads and options objects, where absent and explicitly-empty
mean different things.

**★ What is `#field in obj`?**
An ES2022 brand check: it asks whether the object was constructed by the class that
declares `#field`. Private fields cannot be added or forged from outside, so it is
more trustworthy than `instanceof`, which can be defeated by `Symbol.hasInstance`,
a reassigned prototype, or a cross-realm copy of the class.

**Why does `"length" in "coral"` throw?**
`in` requires an object on the right-hand side and does not auto-box primitives,
even though property access does. `new String("green")` is an object and works;
the primitive does not. `Object.hasOwn` coerces and so does not throw.

**What are the three states an array index can be in?**
Present with a value, present holding `undefined`, and a hole. Reading gives
`undefined` for the last two, so only `in`/`Object.hasOwn` distinguish them — MDN
shows `2 in new Array(3)` is `false` while `trees[3] = undefined` makes
`3 in trees` `true`.

---

[Topic index](./README.md) · Next → [`delete` and what it really costs](./02-delete-and-its-cost.md)
