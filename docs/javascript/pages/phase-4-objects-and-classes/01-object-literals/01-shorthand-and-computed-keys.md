---
title: "01.1 · Shorthand and computed keys"
sidebar_label: "01 · Shorthand and computed keys"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer). Documentation-validated.

The two shorthands that changed how object literals are written. Both are pure
convenience with no semantic surprises — which makes them the easy half of this
topic, and worth getting exactly right before the parts that *do* surprise.

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

**One thing shorthand cannot do: rename.** `{ a }` always produces the key `a`. If
the variable is `userId` and the key must be `user_id`, you write it out in full.
This is why an API boundary — where casing conventions differ between your code and
the wire format — is the one place shorthand usually cannot be used, and why
mapping layers stay verbose.

Shorthand also composes with destructuring in a way that reads well in both
directions:

```js
const { id, name } = user;     // out of an object
return { id, name };           // and back into a new one
```

That pair is the standard "pick these fields" idiom. Note the result is a **new**
object with only those keys — the safe way to narrow a payload before returning
it, as opposed to deleting the fields you do not want.

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

MDN: *"The object initializer syntax also supports computed property names. That
allows you to put an expression in square brackets `[]`, that will be computed and
used as the property name."*

The expressions are evaluated **in source order, as part of building the object** —
visible above, where `++i` runs three times and each key takes the value from its
own increment. This is worth noticing because it means a computed key can have side
effects, and those effects are ordered.

Where computed keys earn their place in real code:

```js
const key = sortBy;                       // a runtime value
const query = { [key]: direction };

// building an index from a list, in one pass
const byId = Object.fromEntries(users.map((u) => [u.id, u]));

// a symbol key, which has no other literal form
const cache = { [Symbol.for("app.cache")]: new Map() };
```

Before computed keys existed you had to create the object and then assign
(`const query = {}; query[key] = direction;`). That still works and is still
clearer when the key is conditional — but it costs you the ability to write the
object as a **single expression**, which matters when the object is an argument, a
return value, or nested inside another literal.

The symbol case is not merely nicer: a symbol key is only expressible through a
computed key. There is no literal syntax for one.

## Conditional keys — the idiom worth knowing

Computed keys plus spread give a clean way to include a property only sometimes:

```js
const filters = {
  status: "active",
  ...(cursor && { cursor }),
};
```

If `cursor` is falsy you spread `false`, `undefined`, `0` or `""` — all of which
contribute no properties, silently and legally. If it is truthy you spread
`{ cursor }`. The whole object stays one expression.

Two variants worth having:

```js
// when the KEY is dynamic too
...(sortBy && { [sortBy]: direction }),

// when you want the key present for an explicit null, but not when absent
...(nickname !== undefined && { nickname }),
```

The alternative is to build the object and then `delete` the key you did not want,
and `delete` is a worse operation than never adding the property — it is slower on
hot objects, and it reads as an undo. See
[03 · `delete` and what it really costs](../03-existence-checks-and-delete/03-delete-and-its-cost.md).

**The one caveat:** `...(cond && { k })` relies on spreading a non-object being a
no-op. That is well-defined, but it reads as a trick to people who have not seen
it. In a codebase where it is unfamiliar, an explicit `if` before the literal is
not worse.

## Gotchas

**Symptom:** A key comes out as the variable's name when you wanted a different
name
**Cause:** Shorthand `{ a }` always produces the key `a` — it cannot rename.
**Fix:** Write the pair in full: `{ user_id: userId }`.

**Symptom:** A computed key's expression ran twice, or its side effect happened at
an unexpected time
**Cause:** Computed key expressions are evaluated in source order while the object
is being built — MDN's `++i` example shows three separate evaluations.
**Fix:** Compute the key into a variable first if the expression is not pure.

**Symptom:** `{ ...(cond && { k }) }` silently contributes nothing when you expected
a key
**Cause:** `cond` was falsy, so a non-object was spread — which is legal and adds no
properties.
**Fix:** That is the intended behaviour of the idiom. If you wanted the key present
with a falsy value, use `...(cond !== undefined && { k: cond })` or just write
`k: cond`.

**Symptom:** A symbol key cannot be written in the literal
**Cause:** Symbols have no literal key syntax.
**Fix:** Use a computed key — `{ [Symbol.for("x")]: v }` — which is the only form
that accepts one.

## Interview questions

**★ What is shorthand property syntax and what can it not do?**
`{ a }` is `{ a: a }` — it removes the repetition when the variable name already
matches the key. It cannot rename, so any boundary where your naming differs from
the wire format (camelCase to snake_case) still needs the full form.

**★ When would you use a computed key instead of assigning after creation?**
When the object must be a **single expression** — as an argument, a return value or
nested inside another literal — or when the key is a **symbol**, which has no other
literal form. Assigning afterwards is clearer when the key is conditional, though
the `...(cond && { key })` spread idiom covers most of those.

**How do you conditionally include a property in an object literal?**
`...(cond && { key })`. Spreading a falsy non-object contributes nothing, so the
key appears only when `cond` is truthy. It keeps the object as one expression and
avoids `delete`, which is the alternative and a worse operation.

**In what order are computed key expressions evaluated?**
Source order, as the object is constructed — so side effects in the key expressions
happen predictably left to right. MDN's example uses `++i` three times and gets
`foo1`, `foo2`, `foo3` with matching values.

---

[Topic index](./README.md) · Next → [Methods, accessors and spread](./02-methods-accessors-and-spread.md)
