---
title: "16.1 · `new` and `Object.create` by hand"
sidebar_label: "01 · new and Object.create"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`new` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.defineProperties()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties), [`Reflect.construct()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct), [`Object.getPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf). Documentation-validated; **nothing was run**.

**`new` is four steps, and MDN numbers them.** Reimplementing it is the shortest proof that you
know what a prototype is — and the two things it *cannot* be made to do are the more interesting
half of the answer.

## What `new` actually does

MDN, verbatim:

> 1. *"Creates a blank, plain JavaScript object."*
> 2. *"Points `newInstance`'s [[Prototype]] to the constructor function's `prototype` property, if
>    the `prototype` is an `Object`. Otherwise, `newInstance` stays as a plain object with
>    `Object.prototype` as its [[Prototype]]."*
> 3. *"Executes the constructor function with the given arguments, binding `newInstance` as the
>    `this` context."*
> 4. *"If the constructor function returns a non-primitive, this return value becomes the result of
>    the whole `new` expression. Otherwise, if the constructor function doesn't return anything or
>    returns a primitive, `newInstance` is returned instead."*

Line for line:

```js
function myNew(Ctor, ...args) {
  if (typeof Ctor !== "function") {
    throw new TypeError(`${Ctor} is not a constructor`);
  }

  const proto = Object(Ctor.prototype) === Ctor.prototype   // step 2 — object, or fall back
    ? Ctor.prototype
    : Object.prototype;

  const instance = Object.create(proto);                    // step 1
  const result = Reflect.apply(Ctor, instance, args);       // step 3

  return Object(result) === result ? result : instance;     // step 4
}
```

`Object(x) === x` is the compact test for "is this a non-primitive" — it is `true` for objects,
arrays and **functions**, and `false` for every primitive including `null`. Writing step 4 as
`typeof result === "object"` is the classic near-miss: it lets `null` through (because
`typeof null === "object"`) and rejects a constructor that returns a function.

## The two lines people skip

**Step 2's fallback is real.** `Ctor.prototype` is an ordinary writable property, so it can be a
number:

```js
function Weird() {}
Weird.prototype = 42;
Object.getPrototypeOf(new Weird()) === Object.prototype;   // true
```

Nothing throws. The instance simply inherits from `Object.prototype`, and the mistake surfaces
much later as a missing method.

**Step 4 is why constructors can return something else.** It is the mechanism behind every factory
that hands back a `Proxy`, a cached singleton, or an object of a different shape — and behind the
bug where a constructor ends with `return this.value` and quietly returns the instance anyway
because the value happened to be a primitive.

## What `myNew` cannot do — and it is not a detail

**It cannot construct a `class`.** MDN: *"Classes can only be instantiated with the `new`
operator — attempting to call a class without `new` will throw a `TypeError`."* `Reflect.apply`
*calls*, so a class constructor throws immediately.

**It cannot set `new.target`.** MDN: *"`new.target` is only `undefined` when the function is
invoked without `new`."* Inside `myNew`, the constructor is being invoked without `new`, so any
guard written as `if (!new.target) throw …` fires, and any subclass logic that reads it sees the
wrong thing.

**It cannot tell a constructible function from a non-constructible one.** Arrow functions, methods
and generator functions are all `typeof "function"` and none of them can be constructed; `typeof`
is not the test, and there is no reliable one exposed to JavaScript.

All three are the same gap: `new` uses an internal `[[Construct]]` operation, and calling a
function is a different operation. The primitive that reaches it is `Reflect.construct`:

```js
Reflect.construct(Ctor, args);                 // real construction, new.target = Ctor
Reflect.construct(Ctor, args, NewTarget);      // …and the third argument sets new.target
```

**So the honest answer in an interview is both**: here is `new` reimplemented with `Object.create`
and `apply`, here are the three things that shape cannot express, and `Reflect.construct` is what
you use in real code — a `class` factory, a decorator that wraps a constructor, a subclass helper.

## `Object.create` by hand

The ES5-era shim is three lines and is worth writing for what it fails at:

```js
function myObjectCreate(proto, props) {
  if (Object(proto) !== proto && proto !== null) {
    throw new TypeError("Object prototype may only be an Object or null");
  }
  function F() {}
  F.prototype = proto;
  const obj = new F();                       // ⚠️ see below
  if (props !== undefined) Object.defineProperties(obj, props);
  return obj;
}
```

🔴 **It cannot produce a null-prototype object**, and the reason is step 2 above: with
`F.prototype = null`, `new F()` falls back to `Object.prototype`. `Object.create(null)` — the
dictionary object with no inherited keys, no `toString`, no `__proto__` accessor — is *only*
reachable through the real built-in. That single limitation is why `Object.create` had to become
a primitive rather than staying a shim, and it is the best one-sentence answer to "why does
`Object.create` exist when `new` exists".

MDN's own framing of the relationship:

> *"You can use `Object.create()` to mimic the behavior of the `new` operator."*
>
> *"Of course, if there is actual initialization code in the `Constructor` function, the
> `Object.create()` method cannot reflect it."*

That is the division exactly: **`Object.create` does step 1 and step 2; the constructor call is
steps 3 and 4.** `myNew` above is literally `Object.create` followed by an `apply`.

## The second argument is descriptors, not values

```js
Object.create(proto, { id: 1 });                 // ⛔ TypeError — 1 is not a descriptor
Object.create(proto, { id: { value: 1 } });      // ✅ …but read the next line
```

MDN: the second parameter is *"an object whose enumerable own properties specify property
descriptors to be added to the newly-created object"*, and *"By default properties are not
writable, enumerable or configurable."*

So the second form creates an `id` that is **frozen and invisible** — absent from
`Object.keys`, from `JSON.stringify`, from a spread. It is a genuinely useful default for a
constant, and a genuinely confusing one if you meant `{ id: 1 }`. Write descriptors deliberately:

```js
Object.create(proto, {
  id: { value: 1, writable: true, enumerable: true, configurable: true },
});
```

📌 **The upside is the reason to use it:** the second argument is the only place you can set a
prototype *and* control enumerability and getters in a single expression — an object literal
cannot express that.

## Two words that are not the same thing

- **`Ctor.prototype`** — an ordinary property *on the function*, holding the object that future
  instances will inherit from. Functions have it; instances do not.
- **`[[Prototype]]`** — the internal link *on the object*, read with `Object.getPrototypeOf(obj)`.

`obj.prototype` is `undefined` for an ordinary instance and that surprises people constantly.
`__proto__` reaches the internal link but is legacy — deprecated, and absent entirely on an object
created with `Object.create(null)`. **Use `Object.getPrototypeOf` and `Object.setPrototypeOf`.**

## Gotchas

**Symptom:** `myNew` returns the instance when the constructor clearly returned something.
**Cause:** The returned value was a primitive — step 4 ignores those by design.
**Fix:** Nothing to fix in the operator; return an object if you mean to override the result.

**Symptom:** A hand-written `new` returns `null` instead of the instance.
**Cause:** Step 4 written as `typeof result === "object"`, which is true for `null`.
**Fix:** `Object(result) === result`, which also admits functions.

**Symptom:** `myNew(SomeClass)` throws `TypeError: Class constructor cannot be invoked without 'new'`.
**Cause:** `apply`/`call` invoke, they do not construct.
**Fix:** `Reflect.construct(SomeClass, args)`.

**Symptom:** A `new.target` guard fires inside a hand-written `new`.
**Cause:** The constructor really was called without `new`.
**Fix:** `Reflect.construct`, whose third argument sets `new.target` explicitly.

**Symptom:** Instances do not have the methods on the constructor's prototype.
**Cause:** `Ctor.prototype` was replaced with a non-object, so the instance fell back to
`Object.prototype` silently.
**Fix:** Check what `Object.getPrototypeOf(instance)` actually is.

**Symptom:** `Object.create(proto, { a: 1 })` throws, or the property is invisible.
**Cause:** The second argument takes descriptors, and descriptor defaults are all `false`.
**Fix:** `{ a: { value: 1, writable: true, enumerable: true, configurable: true } }`.

## Interview questions

**★ Implement `new`.**
Create an object whose prototype is `Ctor.prototype` (falling back to `Object.prototype` if that
is not an object), call the constructor with it as `this`, and return the constructor's result if
it is a non-primitive, otherwise the new object.

**★ What does your implementation get wrong?**
It calls rather than constructs, so it cannot instantiate a class, cannot set `new.target`, and
cannot detect a non-constructible function. `Reflect.construct` is the real primitive.

**★ Why is `Object(x) === x` the right test in step 4?**
It is exactly "non-primitive": true for objects, arrays and functions, false for every primitive
including `null` — where a `typeof === "object"` test would be wrong twice.

**★ Why can `Object.create` not be shimmed completely?**
The `F.prototype = null; new F()` trick cannot produce a null-prototype object — the `new`
operator falls back to `Object.prototype` when the prototype is not an object. Only the real
`Object.create(null)` gets there.

**★ What is the difference between `Ctor.prototype` and an object's prototype?**
`prototype` is a property on the *function*, holding what its instances will inherit from. The
object's own link is `[[Prototype]]`, read with `Object.getPrototypeOf`. Instances have no
`prototype` property at all.

**What is the second argument to `Object.create`?**
A map of property names to descriptors, as `Object.defineProperties` takes — and every descriptor
attribute defaults to `false`, so an omitted `enumerable: true` produces a hidden property.

---

[Topic index](./README.md) · Next → [`instanceof`, and what it cannot tell you](./02-instanceof.md)
