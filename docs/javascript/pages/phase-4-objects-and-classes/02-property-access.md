---
title: "02 · Property access"
sidebar_label: "02 · Property access"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Property accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_accessors), [Objects guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects), [Optional chaining (`?.`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array), [`Object.prototype.toString()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString). Documentation-validated; **no timings**.

**There are two ways to read a property and one rule underneath both of them:**

> **Every property key is a string or a symbol. Anything else you write is converted to a string
> first.**

Almost every surprise in this topic is that sentence being applied where you did not expect it.

## Dot versus bracket

```js
user.name          // dot — the key is written literally
user["name"]       // bracket — the key is any expression
```

**Dot notation requires the key to be a valid identifier**: letters, digits, `_`, `$`, not
starting with a digit, and not a reserved word in older engines. Everything else needs brackets:

```js
data["first name"];      // ✅ a space
data["2fa-enabled"];     // ✅ a hyphen and a leading digit
data[42];                // ✅ a number
data[key];               // ✅ a variable — the main reason brackets exist
data[`col_${i}`];        // ✅ a computed key
```

🔴 **The distinction that actually matters is literal versus computed.** `obj.key` looks up the
property *named* `"key"`; `obj[key]` looks up the property named by the **value** of the variable
`key`. Mixing them up produces a property called `"key"` that nobody asked for and no error:

```js
const field = "email";
user.field;      // undefined — there is no property literally called "field"
user[field];     // ✅ the email
```

⚠️ **Prefer dot where it is legal.** It is checked by tooling, renamed correctly by refactors, and
minifies better. Reach for brackets when the key is computed, or when it is not a valid identifier.

## Keys are stringified — and that is where collisions come from

```js
const obj = {};
obj[1] = "a";
obj["1"];          // "a"  ← the same property
obj[true] = "b";   // key "true"
obj[null] = "c";   // key "null"
obj[undefined];    // reads key "undefined"
```

The conversion is not a quirk of numbers; it applies to **every** non-symbol key. Which leads to
the single most expensive form of it:

```js
const cache = {};
const userA = { id: 1 };
const userB = { id: 2 };

cache[userA] = "first";
cache[userB] = "second";

Object.keys(cache);       // ["[object Object]"] — 🔴 ONE key
cache[userA];             // "second" — userB overwrote userA
```

🔴 **Two different objects used as keys collapse into the same string, `"[object Object]"`.**
Every object shares it, so an object-keyed plain-object cache holds exactly one entry no matter how
many things you put in it. The read still "works" — it just returns whatever was written last.

**The fix is `Map`**, which keys by value identity and accepts anything:

```js
const cache = new Map();
cache.set(userA, "first");
cache.set(userB, "second");
cache.get(userA);         // ✅ "first"
```

⚠️ **The same collapse hits arrays used as keys**, less visibly, because arrays stringify to their
joined contents: `obj[[1,2]]` is `obj["1,2"]`. Two different arrays with equal contents therefore
*do* collide, which occasionally looks like the behaviour you wanted and is never reliable.

## Symbols are the exception

```js
const id = Symbol("id");
const user = { [id]: 42, name: "Ada" };

user[id];                    // 42
Object.keys(user);           // ["name"]     — symbol skipped
JSON.stringify(user);        // {"name":"Ada"}
Object.getOwnPropertySymbols(user);   // [Symbol(id)]
```

**A symbol key is not converted to a string**, and two symbols with the same description are still
different keys. That is what makes them collision-proof: a library can attach metadata to your
object with no chance of clashing with a property you own.

The cost is that they are invisible to the ordinary enumeration paths — `Object.keys`,
`JSON.stringify`, spread of string keys — which is usually the point and occasionally the bug.

## Arrays are objects with stringified indices

```js
const arr = ["a", "b"];
arr[0] === arr["0"];        // true — same property
arr[1.5] = "x";             // an ordinary property, NOT an element
arr[-1]  = "y";             // likewise
arr.length;                 // 2 — unchanged
```

🔴 **Only integer-like keys within range participate in `length` and in iteration.** A float or
negative "index" becomes a plain property that array methods ignore, so `arr[-1]` never behaves
like Python's last-element access — it just adds an invisible property while every array method
carries on as if nothing happened.

The [property-order rules](./01-object-literals/README.md) come from the same place: integer-like
keys are enumerated in ascending numeric order, before string keys in insertion order, before
symbols.

## Reading what might not be there

```js
user.profile.avatar;         // 🔴 TypeError if profile is undefined
user.profile?.avatar;        // ✅ undefined
user?.[key];                 // ✅ bracket form
users[0]?.name;              // ✅
```

Accessing a property of `null` or `undefined` throws
`TypeError: Cannot read properties of undefined (reading 'avatar')`. **Optional chaining
short-circuits the whole chain** and evaluates to `undefined` instead.

⚠️ **`?.` is not a general error suppressor, and over-using it hides real bugs.** It answers "this
may legitimately be absent". If `profile` should always exist, `?.` converts a loud failure into a
silent `undefined` that surfaces three functions later. Use it where absence is part of the
contract, and let the rest throw.

⚠️ **It short-circuits the rest of the chain, including calls.** In `a?.b.c`, if `a` is nullish the
whole expression is `undefined` and `.c` is never evaluated — but if `a` exists and `b` does not,
`.c` still throws. One `?.` does not protect the whole line.

## Dynamic keys and the prototype

A computed key reaches the prototype chain like any other lookup, and that is a real hazard when
the key comes from outside:

```js
const opts = {};
opts["toString"];            // 🔴 a function, from Object.prototype — not "missing"
"toString" in opts;          // true
Object.hasOwn(opts, "toString");   // ✅ false
```

**A lookup that finds an inherited property is indistinguishable from one that found your data**,
unless you ask specifically. `Object.hasOwn` is the modern check — full comparison of `in` versus
`hasOwnProperty` versus `Object.hasOwn` in
[03 · Existence checks](./03-existence-checks-and-delete/README.md).

🔴 **Writing a user-supplied key is worse than reading one.** `obj[key] = value` where `key` is
`"__proto__"` can reach the prototype rather than the object, which is the basis of prototype
pollution — the subject of **16 · Prototype patterns to avoid** *(not written yet)*.

**Two defences, and they compose:**

```js
const dict = Object.create(null);   // ✅ no prototype at all — no inherited keys, no __proto__
const map  = new Map();             // ✅ keys are values, never property names
```

`Object.create(null)` gives a true dictionary: `dict.toString` is `undefined`, and there is nothing
to pollute. **Its cost is that the object has no `Object.prototype` methods at all** — no
`toString`, so string coercion throws, and `console.log` renders it differently.

## Gotchas

**Symptom:** `obj.field` is `undefined` but the data is definitely there
**Cause:** Dot notation used with a variable — it looked up a property literally named `"field"`.
**Fix:** `obj[field]`.

**Symptom:** An object-keyed cache holds one entry
**Cause:** Every object stringifies to `"[object Object]"`, so all keys collapse into one.
**Fix:** `Map`, which keys by identity.

**Symptom:** Two different arrays hit the same cache entry
**Cause:** Arrays stringify to their joined contents, so equal contents produce equal keys.
**Fix:** `Map`, or an explicit, deliberate key function.

**Symptom:** `arr[-1]` does not return the last element
**Cause:** It is an ordinary property, not an index; `length` and array methods ignore it.
**Fix:** `arr.at(-1)`.

**Symptom:** `arr.length` did not grow after assigning to an index
**Cause:** The "index" was not an integer-like key — `arr[1.5]` is a plain property.
**Fix:** Use an integer index, or `push`.

**Symptom:** A symbol-keyed property vanished after `JSON.stringify` or a `Object.keys` round trip
**Cause:** Symbol keys are skipped by every string-key enumeration path.
**Fix:** Expected — use `Object.getOwnPropertySymbols` if you need them, or a string key.

**Symptom:** `TypeError: Cannot read properties of undefined`
**Cause:** A property access on `null`/`undefined` partway along a chain.
**Fix:** `?.` at the link that is legitimately optional — not at every link.

**Symptom:** `a?.b.c` still threw
**Cause:** `?.` guards only the link it is on; if `a` exists and `b` is nullish, `.c` throws.
**Fix:** `a?.b?.c`.

**Symptom:** A lookup with a user-supplied key returned a function
**Cause:** It found an inherited `Object.prototype` member such as `toString` or `constructor`.
**Fix:** `Object.hasOwn` before use, or store data in `Object.create(null)` / a `Map`.

**Symptom:** Writing a key from a request body changed unrelated objects
**Cause:** Prototype pollution through `__proto__` or `constructor.prototype`.
**Fix:** Never write untrusted keys into a plain object — use a `Map` or a null-prototype object, and reject the dangerous keys explicitly.

## Interview questions

**★ When must you use bracket notation?**
When the key is computed from a variable or expression, or when it is not a valid identifier — a
space, a hyphen, a leading digit. Otherwise prefer dot: it is checked by tooling and survives
refactors and minification better.

**★ What types can a property key be?**
Strings and symbols, and nothing else. Every other value you write as a key is converted to a
string first, which is why `obj[1]` and `obj["1"]` are the same property.

**★ What happens if you use an object as a key?**
It stringifies to `"[object Object]"`, so every object key collapses into that one property and
each write overwrites the last. Use a `Map`, which keys by identity and accepts any value.

**★ Why are symbols different?**
They are not converted to strings, and two symbols with the same description are still distinct
keys — so a symbol key cannot collide with anyone else's property. In exchange they are skipped by
`Object.keys`, `JSON.stringify` and other string-key enumeration.

**★ Is `arr[-1]` the last element?**
No. Array indices are integer-like string keys; `-1` is an ordinary property that `length` and
every array method ignore. `arr.at(-1)` is the real thing.

**★ What does optional chaining actually do?**
Short-circuits the rest of the chain to `undefined` when the value before it is `null` or
`undefined`, instead of throwing. It guards only the link it is written on, so `a?.b.c` still
throws when `a` exists and `b` does not.

**★ Why is looking up a user-supplied key on a plain object risky?**
Because lookup walks the prototype chain, so keys like `toString` or `constructor` return inherited
members rather than "not found" — and *writing* such a key can reach the prototype, which is
prototype pollution. Use `Object.create(null)` or a `Map` for anything keyed by untrusted input.

**What does `Object.create(null)` cost you?**
Every `Object.prototype` method. There is no `toString`, so implicit string coercion throws, and
tooling displays it differently. That is the price of a genuinely empty dictionary.

---

← [01 · Object literals](./01-object-literals/README.md) · [Phase index](./README.md) · [03 · Existence checks and `delete`](./03-existence-checks-and-delete/README.md) →
