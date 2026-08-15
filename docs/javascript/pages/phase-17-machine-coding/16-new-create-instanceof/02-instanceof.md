---
title: "16.2 · `instanceof`, and what it cannot tell you"
sidebar_label: "02 · instanceof"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`Function.prototype[Symbol.hasInstance]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Symbol.hasInstance), [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance), [`Object.getPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`Symbol.toStringTag`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toStringTag). Documentation-validated; **nothing was run**.

**`instanceof` is a walk up a chain, plus one hook.** MDN: it *"tests to see if the `prototype`
property of a constructor appears anywhere in the prototype chain of an object"*, and *"Its
behavior can be customized with `Symbol.hasInstance`"*.

Both halves matter, and the order between them is the part that gets missed.

## The implementation

```js
function myInstanceof(obj, Ctor) {
  if (Object(Ctor) !== Ctor) {
    throw new TypeError("Right-hand side of 'instanceof' is not an object");
  }

  const hasInstance = Ctor[Symbol.hasInstance];              // the hook comes FIRST
  if (typeof hasInstance === "function") {
    return Boolean(hasInstance.call(Ctor, obj));
  }

  if (typeof Ctor !== "function") {                          // no hook ⇒ must be callable
    throw new TypeError("Right-hand side of 'instanceof' is not callable");
  }
  if (Object(obj) !== obj) return false;                     // primitives are never instances

  const target = Ctor.prototype;
  if (Object(target) !== target) {
    throw new TypeError("Function has non-object prototype in instanceof check");
  }

  let proto = Object.getPrototypeOf(obj);                    // the walk
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

## The ordering, and the twist inside it

MDN: *"If `constructor` has a `Symbol.hasInstance` method, the method will be called in priority,
with `object` as its only argument and `constructor` as `this`."*

🔴 **In a real engine, every function has one.** MDN again: *"Because all functions inherit from
`Function.prototype` by default, they would all have the `[Symbol.hasInstance]()` method, so most
of the time, the `Function.prototype[Symbol.hasInstance]()` method specifies the behavior of
`instanceof` when the right-hand side is a function."*

So the prototype walk written out above **is** `Function.prototype[Symbol.hasInstance]`, not a
fallback that the language reaches only occasionally. The two branches in `myInstanceof` are the
same branch in the spec: look up the method, and the method you find is the default one unless
somebody defined their own. Saying that out loud is the difference between reciting the
implementation and understanding it.

📌 That property is *"non-configurable and non-writable"*, which MDN describes as *"a security
feature to prevent the underlying target function of a bound function from being obtainable"* —
you cannot monkey-patch the default behaviour globally, only override it per constructor.

## Three checks before the walk

- **A non-object right-hand side throws.** `x instanceof "String"` is a `TypeError`, not `false` —
  MDN: *"`TypeError` is thrown if `constructor` is not an object. If `constructor` doesn't have a
  `[Symbol.hasInstance]()` method, it must also be a function."*
- **A primitive left-hand side is always `false`.** `"a" instanceof String` is `false`, and no
  error is raised — the primitive is not boxed for the check. This is why `typeof` and
  `instanceof` cover different halves of the type question and neither replaces the other.
- **A non-object `prototype` throws.** `Ctor.prototype = 42` makes every `instanceof` against it a
  `TypeError`, even though [16.1](./01-new-and-object-create.md) showed that `new Ctor()` accepts
  it silently. Same mistake, two entirely different symptoms.

## Bound functions

MDN: *"For bound functions, `instanceof` looks up for the `prototype` property on the target
function, since bound functions don't have `prototype`."*

```js
const Bound = Ctor.bind(null);
new Bound() instanceof Bound;      // true — via Ctor.prototype
```

A bound function carries no `prototype` of its own, so the check is delegated to what it wraps.
That is the behaviour you want, and it is also why the default `hasInstance` is locked down: it
would otherwise be a route to the target function.

## Customising it — and why to be careful

```js
class Stringish {
  static [Symbol.hasInstance](value) {
    return typeof value === "string" || value instanceof String;
  }
}

"hello" instanceof Stringish;      // true
```

Legitimate uses are narrow: an abstract "shape" check, a branded value, a class whose instances
can also arrive as plain deserialised objects. The cost is that **`instanceof` stops meaning what
every reader assumes it means** — a static method on a class two files away can make the operator
return `true` for something that inherits from nothing. Prefer a plainly named function
(`isStringish(x)`) unless the operator's ergonomics genuinely matter.

## When `instanceof` is the wrong tool

The prototype walk compares object *identity*, so it is exactly as reliable as "there is only one
copy of that constructor, in this realm".

- 🔴 **Across realms it fails.** MDN: *"`[] instanceof window.frames[0].Array` will return
  `false`, because `Array.prototype !== window.frames[0].Array.prototype`"* — iframes, workers,
  Node's `vm` contexts. MDN's own remedy for the common case: *"You can securely check if a given
  object is in fact an Array using `Array.isArray()`, neglecting which realm it comes from."*
- 🔴 **Two copies of a package fail the same way.** A dependency installed twice produces two
  distinct classes with identical source, and `err instanceof LibraryError` is `false` for the
  error the *other* copy threw. Bundling, transitive versions and a mixed ESM/CJS build all
  produce this, and it reproduces only in the built application.
- **Subclassed built-ins in old output.** A `class MyError extends Error` compiled to an ES5
  constructor loses the chain, so `instanceof MyError` is `false` — a `catch` block that filters
  by class silently swallows nothing and rethrows everything.

The alternatives, in the order to reach for them:

| Question | Check |
|---|---|
| Is it an array? | `Array.isArray(x)` |
| Which built-in is it? | `Object.prototype.toString.call(x)` — reads `Symbol.toStringTag` |
| Is it one of *my* error types? | a `code`/`kind` string field on the object |
| Is it a thing from any copy of my library? | a registered symbol brand: `x[Symbol.for("lib.brand")]` |
| Does it have the capability I need? | `typeof x.then === "function"` — duck typing, which is what the language does for thenables |

**`instanceof` is fine inside one module for your own classes.** It stops being fine the moment
the value crosses a package boundary, a realm or a serialisation step.

## Gotchas

**Symptom:** `instanceof` throws instead of returning `false`.
**Cause:** The right-hand side is not an object, or is an object with no `Symbol.hasInstance` and
no callability.
**Fix:** Guard the operand, or use a predicate function instead.

**Symptom:** `"abc" instanceof String` is `false` although the value is clearly a string.
**Cause:** Primitives are never instances — they are not boxed for the check.
**Fix:** `typeof x === "string"`, or `Object.prototype.toString.call(x)` if boxed strings must
also match.

**Symptom:** `err instanceof AppError` is `false` for an error the library definitely threw.
**Cause:** Two copies of the package, or two realms — two distinct constructor objects.
**Fix:** Check a stable `code` field, or a `Symbol.for()` brand that survives duplicate copies.

**Symptom:** An `instanceof` check started returning `true` for unrelated values.
**Cause:** Someone defined a static `[Symbol.hasInstance]` on the class.
**Fix:** Find it — the hook takes priority over the prototype chain and is invisible at the call
site.

**Symptom:** Everything is `instanceof Object`.
**Cause:** Correct — `Object.prototype` is at the end of nearly every chain.
**Fix:** Use it only as a "not a primitive, not a null-prototype object" test, which is what it is.

## Interview questions

**★ Implement `instanceof`.**
Reject a non-object right-hand side; call `Ctor[Symbol.hasInstance]` if it is a function;
otherwise return `false` for a primitive left-hand side and walk `Object.getPrototypeOf` upwards
comparing each link against `Ctor.prototype` until `null`.

**★ Where does `Symbol.hasInstance` fit in?**
It takes priority over the prototype walk — and since every function inherits
`Function.prototype[Symbol.hasInstance]`, the walk *is* that method's default behaviour rather
than a separate path.

**★ Why is `"abc" instanceof String` false?**
Primitives are never instances. The operator inspects an object's prototype chain and a primitive
does not have one for this purpose; it is not auto-boxed.

**★ Why does `instanceof` fail across iframes or between two copies of a package?**
It compares identity with one specific `prototype` object. A second realm or a second installed
copy has a different constructor object, so nothing on the chain matches.

**★ What would you use instead for an error type?**
A `code` or `kind` string on the error, or a `Symbol.for()` brand — both survive duplicate copies,
realm boundaries and serialisation, none of which `instanceof` survives.

**When is `instanceof` still the right call?**
Within one module or package, for your own classes, on values that never crossed a boundary — it
is cheap, reads well and is exactly right there.

---

← Prev [`new` and `Object.create`](./01-new-and-object-create.md) · [Topic index](./README.md)
