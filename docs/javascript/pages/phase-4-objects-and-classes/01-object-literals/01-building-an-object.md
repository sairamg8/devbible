---
title: "01.1 · Building an object literal"
sidebar_label: "01 · Building an object"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer), [Method definitions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions), [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). Documentation-validated.

The object literal is the most-typed construct in JavaScript, and almost all of it
is obvious. This page is about the parts that are not: the four shorthands, the
one that is **not** equivalent to what it looks like, and the two silent-overwrite
behaviours.

## Shorthand property names

When the variable name is already the property name, drop the repetition:

```js
const a = "foo";
const b = 42;
const c = {};

const o = { a, b, c };

console.log(o.a === { a }.a); // true
```

`{ a }` means `{ a: a }`. That is the whole feature, and its value is entirely in
what it prevents — `{ userId: usreId }` typos, and the noise of
`{ name: name, email: email, role: role }`.

**One thing shorthand cannot do:** rename. `{ a }` always produces the key `a`. If
the variable is `userId` and the key must be `user_id`, you write it out. This is
why an API boundary — where casing conventions differ — is the one place shorthand
usually cannot be used.

## Computed property names

A key can be an arbitrary expression, in square brackets:

```js
let i = 0;
const a = {
  [`foo${++i}`]: i,
  [`foo${++i}`]: i,
  [`foo${++i}`]: i,
};

console.log(a.foo1); // 1
console.log(a.foo2); // 2
console.log(a.foo3); // 3
```

MDN: *"That allows you to put an expression in square brackets `[]`, that will be
computed and used as the property name."*

The expressions are evaluated **in source order, as part of building the object** —
visible above, where `++i` runs three times and each key gets the value from its
own increment.

Where this earns its keep in real code:

```js
const key = sortBy;                       // a runtime value
const query = { [key]: direction };

// building an index from a list, in one pass
const byId = Object.fromEntries(users.map((u) => [u.id, u]));

// a symbol key, which is only expressible this way
const cache = { [Symbol.for("app.cache")]: new Map() };
```

Before computed keys existed you had to create the object first and assign
afterwards (`const query = {}; query[key] = direction;`). That still works, and is
still clearer when the key is conditional — but it costs you the ability to write
the object as a single expression, which matters when the object is an argument.

### Conditional keys, the idiom worth knowing

Computed keys plus spread give you a clean way to include a property only
sometimes:

```js
const filters = {
  status: "active",
  ...(cursor && { cursor }),
};
```

If `cursor` is falsy, you spread `false` or `undefined` — which contributes
nothing, silently and legally. If it is truthy, you spread `{ cursor }`. The
alternative is building the object then deleting the key, and `delete` is a worse
operation than never adding the property (see
[03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md)).

## Method shorthand — **not** the same as a function-valued property

```js
const o = {
  property(parameters) {},
  *generator() {},
  async asyncMethod() {},
};
```

This looks like pure syntax sugar for `property: function (parameters) {}`. It is
not, and MDN says so directly: *"note that the method syntax is not equivalent to a
normal property with a function as its value — there are semantic differences."*

**Two differences, both real:**

**1. Methods cannot be constructors.** MDN: *"Methods cannot be constructors! They
will throw a `TypeError` if you try to instantiate them."*

```js
const obj = {
  method() {},
};
new obj.method(); // TypeError: obj.method is not a constructor
```

The function-expression form *can* be `new`-ed. Methods have no `prototype`
property to hang instances off, which is the same reason arrow functions cannot be
constructed — see
[04 · Arrow functions and `this`](../../phase-3-functions/04-arrow-functions-and-this/README.md).

**2. Only methods get `super`.** MDN: *"Only functions defined as methods have
access to the `super` keyword."*

```js
const obj = {
  __proto__: {
    prop: "foo",
  },
  notAMethod: function () {
    console.log(super.prop); // SyntaxError: 'super' keyword unexpected here
  },
};
```

Note that is a **`SyntaxError`** — a parse-time failure, so the whole file fails to
load, not a runtime error on the line. The method form has a *home object* (the
object literal it was defined in), and `super` is resolved relative to that home
object's prototype. A plain function expression has no home object, so `super` is
not even grammatical there.

**What this means in practice:** prefer the method shorthand. It is shorter, it
matches class syntax, and the two capabilities it removes — being `new`-ed, and
being reused as a standalone constructor — are things you almost never want from
an object literal's member anyway. The one time you need the long form is when you
genuinely want a constructor function as a property value.

Note that neither form gives you lexical `this`: both a method and a function
expression get `this` from the *call site*. Writing `handler: () => this.x` in an
object literal is the classic mistake — the arrow captures the surrounding scope's
`this`, not the object. That is
[07 · `this` inside methods, and losing it](../README.md), and it is the single
most common object-literal bug.

## Getters and setters in a literal

```js
const o = {
  get property() {
    return 1;
  },
  set property(value) {},
};
```

An accessor property looks like a data property from the outside — `o.property`
reads, `o.property = x` writes — but each side runs a function. Two consequences
worth holding now:

- **`get` makes reading arbitrary work.** A property access that triggers a
  network call, a recomputation or a `console.log` is legal and invisible at the
  call site. This is why "just add a getter" is a bigger decision than it looks.
- **Spread reads them; it does not copy them.** Covered next.

## Spread — own, enumerable, and shallow

MDN: *"It copies own enumerable properties from a provided object onto a new
object."*

```js
const obj1 = { foo: "bar", x: 42 };
const obj2 = { foo: "baz", y: 13 };

const clonedObj = { ...obj1 };
// { foo: "bar", x: 42 }

const mergedObj = { ...obj1, ...obj2 };
// { foo: "baz", x: 42, y: 13 }
```

Every word in "own enumerable" is load-bearing:

- **own** — inherited properties are not copied. Spreading an instance of a class
  gives you its fields, **not** its methods, because methods live on the
  prototype. This is why `{ ...someClassInstance }` produces a plain object that
  has lost all its behaviour, and it is the most common way people accidentally
  destroy an object they meant to copy.
- **enumerable** — non-enumerable properties are skipped.
- and, unstated but critical, **shallow** — nested objects are shared, not copied.
  MDN calls it *"shallow-cloning (excluding `prototype`)"*. That is topic 04's
  entire subject.

Later spreads win, which is what makes `{ ...defaults, ...overrides }` the
standard options-merging idiom. Note it is a *replace*, not a *deep merge*: if
both objects have a nested `options` object, the second one wins whole, and any
keys that were only in the first are gone.

### Spread does not trigger setters; `Object.assign` does

MDN flags this as a **warning**: *"Note that `Object.assign()` triggers setters,
whereas the spread syntax doesn't!"*

The distinction:

- `{ ...source }` **defines** properties on a fresh object. It never invokes a
  setter on the target, because the target is new and empty.
- `Object.assign(target, source)` **assigns** to the target. If `target` has a
  setter for that key, the setter runs — with all of its side effects, and with
  the possibility that it stores something other than what you passed, or throws,
  or silently ignores the write.

So `Object.assign(existingObject, patch)` and `{ ...existingObject, ...patch }`
are not interchangeable. The first mutates and may run arbitrary code; the second
builds a new plain object. Reach for spread by default: the immutable one is
almost always what you meant, and it is the one with no surprises.

Both read getters on the *source* side, though — a spread of an object with a
getter calls the getter once and stores the resulting **value**. The copy has a
plain data property where the original had an accessor. That is usually fine and
occasionally a disaster (a lazily-computed getter becomes eagerly computed, once,
and then frozen in time).

## Duplicate keys — last wins, silently

```js
const a = { x: 1, x: 2 };
console.log(a); // {x: 2}
```

MDN: *"When using the same name for your properties, the second property will
overwrite the first."*

And the part people get wrong about strict mode: *"After ES2015, duplicate
property names are allowed everywhere, including strict mode."* In ES5 strict mode
this was a `SyntaxError`; that rule was **removed** when computed keys arrived,
because with `{ [a]: 1, [b]: 2 }` a duplicate cannot be detected at parse time
anyway.

So there is no runtime protection here at all. Your linter is the only thing that
will catch `{ status: "active", ..., status: "archived" }` in a long literal —
`no-dupe-keys` is on in every standard ESLint config, and this is why.

The same silence applies to spread: `{ ...a, x: 1, ...b }` lets `b.x` overwrite the
explicit `x: 1` you wrote, because `b` comes later. Ordering a spread after an
explicit key is almost always a bug.

MDN notes one exception to the permissiveness: *"private elements, which must be
unique in the class body."* Duplicate `#name` declarations in a class are still an
error.

## Gotchas

**Symptom:** `TypeError: obj.method is not a constructor`
**Cause:** Method shorthand definitions cannot be `new`-ed (MDN). They have no
`prototype` property.
**Fix:** Use `method: function () {}` if you genuinely need a constructor, or a
`class`.

**Symptom:** `SyntaxError: 'super' keyword unexpected here`
**Cause:** `super` was used inside a function-valued property rather than a method
shorthand. MDN: *"Only functions defined as methods have access to the `super`
keyword."*
**Fix:** Rewrite `notAMethod: function () {}` as `notAMethod() {}`. Note this is a
parse error — nothing in the file runs.

**Symptom:** Spreading a class instance loses all its methods
**Cause:** Spread copies **own** enumerable properties; methods live on the
prototype, which is not own. MDN describes it as *"shallow-cloning (excluding
`prototype`)"*.
**Fix:** Do not spread instances. Use a `clone()` method, `Object.create` with the
same prototype, or keep the instance and copy only the data you need.

**Symptom:** `Object.assign` into an existing object behaves strangely — values
change, or something throws
**Cause:** `Object.assign` triggers **setters** on the target; spread does not
(MDN warning).
**Fix:** Use `{ ...target, ...patch }` to build a new object, unless you
specifically want the setters to run.

**Symptom:** A key in a long object literal has the wrong value and nothing errors
**Cause:** A duplicate key later in the literal silently overwrote it. Legal even
in strict mode since ES2015.
**Fix:** Enable ESLint's `no-dupe-keys`. Also check for a `...spread` placed
*after* the explicit key.

**Symptom:** A getter that was meant to be lazy runs immediately, or its value
goes stale
**Cause:** Spread and `Object.assign` both *read* source getters and store the
resulting value, converting the accessor into a plain data property.
**Fix:** Do not spread objects whose getters are meant to stay live. Copy the
descriptor with `Object.getOwnPropertyDescriptors` instead.

## Interview questions

**★ Is `{ foo() {} }` the same as `{ foo: function () {} }`?**
No. MDN states the two are *"not equivalent"*. Method shorthand produces a
function that **cannot be used as a constructor** (`new` throws `TypeError`) and
that **can use `super`**, because it has a home object. The function-expression
form is constructable and makes `super` a `SyntaxError`.

**★ What does object spread actually copy?**
Own, enumerable, string- and symbol-keyed properties — **shallowly**, and
excluding the prototype. Inherited properties, non-enumerable properties and
nested objects are all handled the way that sentence implies: the first two are
skipped, the third is shared by reference.

**★ Difference between `{ ...a, ...b }` and `Object.assign(a, b)`?**
Three: `Object.assign` **mutates** `a` while spread builds a new object; and
`Object.assign` **triggers setters** on the target while spread defines properties
directly (MDN flags this as a warning); and spread's result is always a plain
object, while `Object.assign` keeps the target's prototype.

**★ Are duplicate keys in an object literal an error?**
No — the last one silently wins. MDN: *"After ES2015, duplicate property names are
allowed everywhere, including strict mode."* The ES5 strict-mode `SyntaxError` was
removed because computed keys make duplicates undetectable at parse time. Only
private class elements must still be unique.

**When would you use a computed key rather than assigning after creation?**
When the object must be a single expression — as a function argument, a return
value, or inside another literal — or when the key is a symbol, which has no
other literal form. Assigning afterwards is clearer when the key is conditional,
though `...(cond && { key })` covers most of those cases.

**Why does spreading a class instance not give you a working object?**
Because methods are on the prototype and spread copies own properties only. You
get the fields as a plain object with `Object.prototype` as its prototype, and
every method call on it throws `TypeError: x.foo is not a function`.

---

[Topic index](./README.md) · Next → [Keys, order and `__proto__`](./02-keys-order-and-proto.md)
