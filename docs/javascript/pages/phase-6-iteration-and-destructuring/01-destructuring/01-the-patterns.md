---
title: "01.1 · The patterns"
sidebar_label: "01 · The patterns"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring). Documentation-validated.

**Destructuring is pattern-matching on the left-hand side of an assignment.** You write
the *shape* of the value you expect, and the names in that shape become bindings.

```js
const [a, b] = [1, 2];        // a is 1, b is 2
const { a, b } = { a: 1, b: 2 };
```

The two forms differ in one fundamental way: **array destructuring matches by
position, object destructuring matches by name.** Everything else follows from that.

## Renaming — objects only

MDN: *"Array elements cannot be renamed, but object properties can."*

```js
const { a: newName } = { a: 1 };
newName; // 1
```

The syntax reads backwards to most people at first: the **key is on the left of the
colon, the new binding name on the right**. `{ a: newName }` means "take the property
`a`, bind it as `newName`" — the opposite direction from an object literal, where
`{ a: value }` puts `value` into `a`.

Array destructuring needs no renaming because the names were never fixed — position is
the only thing that matters, so you simply choose the names you want. To skip a
position, leave a hole:

```js
const [, second, , fourth] = arr;
```

## Defaults apply to `undefined` only

MDN: *"Default values are **only used when a property is `undefined`**, not when it's
`null`"*:

```js
const [a = 1] = [];                  // a is 1
const { b = 2 } = { b: undefined };  // b is 2
const { c = 2 } = { c: null };       // c is null (default not applied)
```

🔴 **`null` does not trigger a default.** This is the same rule as function parameter
defaults ([Phase 3 · 02](../../phase-3-functions/02-parameters/README.md)), and the
consequence is the same: a JSON payload where "no value" is `null` — which is the
convention, because `JSON.stringify` drops `undefined` entirely — bypasses every default
you wrote.

```js
const { retries = 3 } = JSON.parse('{"retries": null}');  // retries is null, not 3
```

Use `??` after destructuring when the source may send `null`:

```js
const { retries } = payload;
const count = retries ?? 3;
```

Defaults combine with renaming, in the order key-then-binding-then-default:

```js
const { a: aa = 10, b: bb = 5 } = { a: 3 };
aa; // 3
bb; // 5
```

Note a default expression is only **evaluated when needed**, so
`const { conn = expensive() } = opts` does not call `expensive()` when `conn` is present.

## Nesting

```js
const { a: a1, b: { c: d } } = { a: 1, b: { c: 2 } };
// a1 = 1, d = 2
```

Note what nesting does **not** create: `b` is not bound. The pattern `b: { c: d }` says
"go into `b` and take `c`" — `b` itself is only a path. If you want both, name it twice:
`const { b, b: { c } } = obj`.

🔴 **Nesting is where destructuring throws.** If `b` is missing, `{ c: d }` is applied to
`undefined`, which fails. Defend each level that might be absent:

```js
const { b: { c } = {} } = obj;   // safe if b is missing
```

Deeply nested destructuring of an API response is a common source of crashes; optional
chaining (`obj?.b?.c`) is often the better tool when the shape is uncertain.

## Rest

```js
const { a, ...others } = { a: 1, b: 2, c: 3 };
others; // { b: 2, c: 3 }

const [first, ...rest] = [1, 2, 3];
rest; // [2, 3]
```

MDN: the rest property *"must be last and cannot have a trailing comma"*.

**Object rest is the idiomatic "omit a key"**, and it is better than `delete` for every
reason in
[Phase 4 · 03](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md):

```js
const { password, ...safeUser } = user;   // a new object, stable shape, no mutation
```

It is **shallow** — nested objects are shared — and it copies own enumerable properties,
so a class instance's methods do not come along.

## The swap

```js
let a = 1, b = 3;
[a, b] = [b, a];
a; // 3
b; // 1
```

No temporary variable. The right side is fully evaluated into an array before any
assignment happens, which is why it works. The same mechanism rotates three or more:
`[a, b, c] = [c, a, b]`.

## Assigning without declaring needs parentheses

MDN: when assigning to already-declared variables, parentheses are **required**:

```js
let a, b;
({ a, b } = { a: 1, b: 2 }); // Parentheses required!

// Without parentheses, it's a syntax error:
// { a, b } = { a: 1, b: 2 }; // SyntaxError
```

The reason is grammatical: a statement starting with `{` is parsed as a **block**, not
an object pattern. Wrapping in parentheses forces expression position. Array
destructuring has no such problem — `[a, b] = [b, a]` is fine, because `[` never starts
a block.

This is also the classic ASI hazard: a line starting with `(` after a statement with no
semicolon is read as a function call on the previous line.

## Destructuring `null` or `undefined` throws

```js
const { a } = undefined;
// TypeError: Cannot destructure property 'a' of 'undefined' as it is undefined.

const { b } = null;
// TypeError: Cannot destructure property 'b' of 'null' as it is null.

const {} = null;
// TypeError: Cannot destructure 'null' as it is null.
```

MDN notes this happens *"even with empty patterns"* — the third case has nothing to
extract and still throws.

**Guard at the boundary**, which is why the `= {}` default in a parameter list matters so
much:

```js
const { a } = response ?? {};
function f({ a } = {}) { … }     // safe when called as f()
```

Any other value destructures fine, because it is coerced to an object: `const { length }
= "abc"` gives `3`.

## Gotchas

**Symptom:** `TypeError: Cannot destructure property 'x' of 'undefined'`
**Cause:** The source is `null` or `undefined`. MDN notes this throws *"even with empty
patterns"*.
**Fix:** `const { x } = source ?? {}`, or `= {}` on a parameter.

**Symptom:** A default did not apply, and the value is `null`
**Cause:** Defaults trigger on **`undefined` only**. `null` is a value.
**Fix:** `??` after destructuring, or normalise the payload.

**Symptom:** `SyntaxError` when destructuring into existing variables
**Cause:** A statement starting with `{` is parsed as a block.
**Fix:** Wrap it: `({ a, b } = obj);` — and mind the ASI hazard on the preceding line.

**Symptom:** Nested destructuring crashes on a missing intermediate object
**Cause:** `{ b: { c } }` applies the inner pattern to `undefined` when `b` is absent.
**Fix:** Default each risky level — `{ b: { c } = {} }` — or use optional chaining
instead when the shape is uncertain.

**Symptom:** The intermediate name is not bound after nested destructuring
**Cause:** In `{ b: { c } }`, `b` is a **path**, not a binding.
**Fix:** `const { b, b: { c } } = obj;` to bind both.

**Symptom:** `{ a: newName }` bound the wrong way round
**Cause:** The **key** is on the left of the colon and the **new name** on the right —
the reverse of an object literal.
**Fix:** Read it as "take `a`, call it `newName`".

## Interview questions

**★ When does a destructuring default apply?**
Only when the value is **`undefined`** — MDN: *"not when it's `null`"*. Since JSON
carries `null` for "no value" (`undefined` is dropped by `JSON.stringify`), defaults are
routinely bypassed by real payloads. Use `??` after destructuring.

**★ Why does `{ a, b } = obj` throw a `SyntaxError`?**
Because a statement beginning with `{` is parsed as a **block**, not an object pattern.
Parentheses force expression position: `({ a, b } = obj);`. Array destructuring needs no
parentheses since `[` never starts a block.

**★ What happens when you destructure `null` or `undefined`?**
`TypeError` — and MDN notes it throws *"even with empty patterns"*, so `const {} = null`
fails too. Every other value is coerced to an object, so `const { length } = "abc"` gives
`3`. Guard with `?? {}` or a `= {}` parameter default.

**★ How do you omit a property from an object?**
Rest destructuring: `const { password, ...safeUser } = user`. It builds a new object with
a stable shape and does not mutate the original — better than `delete` on every count. It
is shallow, and it copies own enumerable properties only.

**Does nested destructuring bind the intermediate name?**
No. In `const { b: { c } } = obj`, `b` is only a path — only `c` is bound. Write
`const { b, b: { c } } = obj` if you need both.

**How does the swap idiom work?**
`[a, b] = [b, a]` — the right-hand array is fully evaluated before any assignment, so no
temporary is needed. It extends to any rotation, such as `[a, b, c] = [c, a, b]`.

---

[Topic index](./README.md) · Next → [Destructuring in parameters and loops](./02-in-parameters-and-loops.md)
