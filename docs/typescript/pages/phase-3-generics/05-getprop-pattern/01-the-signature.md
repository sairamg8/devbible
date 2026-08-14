---
title: "The signature, piece by piece"
sidebar_label: "01 · The signature"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Keyof Type Operator*, *Indexed Access Types*, *Generics → Using Type Parameters
> in Generic Constraints*), where this exact signature is the worked example.
> `TS2345` and `TS7053` were read out of the **compiler's own diagnostic table**
> — ⚠️ TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No console
> block** — no sandbox run covers this phase.

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

Eleven tokens, and they are the most reusable eleven in the language. Every typed
accessor you will meet — a form library's `watch('email')`, an ORM's
`select('id')`, a table component's `sortBy` prop, `lodash.get`'s modern typings
— is this shape with a domain name on it.

It is worth taking apart one piece at a time, because **each piece is answering a
specific failure of the version without it.**

## Start from what fails

```ts
function getProp(obj: object, key: string): unknown { … }

const name = getProp(user, 'name');    // unknown — caller must cast
getProp(user, 'nmae');                 // no error
```

Two problems: the key is unchecked, and the return type has lost the connection
to it. Fixing them one at a time is what produces the signature.

## `<T>` — remember which object

```ts
function getProp<T>(obj: T, key: string): unknown { … }
```

`T` is inferred from `obj`, so the compiler now *knows* which type it is dealing
with. Nothing uses that knowledge yet, but it is available — and it must come
first, because the next piece is defined in terms of it.

## `K extends keyof T` — check the key against that object

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): unknown { … }

getProp(user, 'nmae');
```

```text
error TS2345: Argument of type '"nmae"' is not assignable to parameter of
type '"id" | "name" | "age"'.
```

The constraint's bound is **computed from another type parameter**
([topic 02](../02-constraints/README.md)), which is the capability `keyof`
([topic 04](../04-keyof/README.md)) unlocked. The error even lists the valid keys,
which makes it one of the more pleasant messages in TypeScript.

### 🔴 Why `K` and not just `key: keyof T`

This is the part people leave out, and it silently costs the whole return type.

```ts
function getA<T>(obj: T, key: keyof T): T[keyof T] { … }
function getB<T, K extends keyof T>(obj: T, key: K): T[K] { … }

const a = getA(user, 'name');    // string | number   ← every value type
const b = getB(user, 'name');    // string            ← just this one
```

Both check the key. Only the second **remembers which key**.

With `key: keyof T` the parameter's type is the whole union, so the only return
type expressible is `T[keyof T]` — the union of *all* the property types. The
extra type parameter exists solely to capture **which member of that union was
passed**, and inference fixes it to the literal `'name'` at the call site.

**That is the entire reason the pattern has two type parameters**, and it is the
one-sentence answer if you are ever asked.

## `T[K]` — the indexed access

`T[K]` reads the type of property `K` out of type `T`. With `T = User` and
`K = 'name'`, it is `string`.

It is the type-level counterpart of `obj[key]`, and it composes the way you would
hope: a union key gives a union result.

```ts
type V = User['name' | 'age'];    // string | number
```

Which is also why `getProp(user, cond ? 'name' : 'age')` returns
`string | number` — correctly, since the compiler cannot know which branch ran.
Indexed access types get their own page at
**topic 06** *(not written yet)*.

## The body needs no assertion

```ts
return obj[key];        // checks, with no `as`
```

Worth pausing on, because the pre-generic version of this function almost always
contained an `as`. Here the compiler can verify the body: `key` is a `K`, `K` is
a key of `T`, so `obj[key]` is a `T[K]`, which is the declared return type. The
types line up without a claim from you — which is the difference between a
generic that helps and one that is decoration over an assertion.

If you find yourself writing `return obj[key] as T[K]`, something upstream is
wrong — usually `T` is unconstrained where the body assumes an object, or the
parameter order lost the inference.

## Inference order makes it work

```ts
getProp(user, 'name');
//      ^^^^  T = User, solved first
//            ^^^^^^ K = 'name', checked against keyof User, then fixed
```

`T` comes from the first argument, then `K` from the second — the ordering from
[topic 01](../01-generic-functions-and-inference/02-where-inference-comes-from.md).
**Swap the parameters and the pattern breaks**: with `key` first there is no `T`
yet to constrain it against, and you get either an error or a uselessly wide
inference.

That ordering constraint is why every API of this shape in the wild takes the
object (or the collection) first. It is not a stylistic convention.

## Gotchas

**Symptom:** The return type is a union of every property type
**Cause:** The signature is `(obj: T, key: keyof T): T[keyof T]` — it checks the
key but does not remember it.
**Fix:** Add the second type parameter: `<T, K extends keyof T>(obj: T, key: K):
T[K]`.

**Symptom:** `TS2345` listing all valid keys
**Cause:** The key is not one of them — usually a typo.
**Fix:** Read the list in the message; this is the pattern doing its job.

**Symptom:** The body needs `as T[K]`
**Cause:** `T` is not constrained to an object, or the inference order is wrong.
**Fix:** Constrain `T`, and take the object first.

**Symptom:** Inference gives `K = string` instead of a literal
**Cause:** The key was passed as a `let`-bound or otherwise widened variable.
**Fix:** `as const` at the call site, or a `const` binding — the constraint
`extends keyof T` keeps literals only if the argument has one.

**Symptom:** A conditional key returns a union
**Cause:** `T['a' | 'b']` really is `T['a'] | T['b']`.
**Fix:** Nothing — this is correct. Narrow the key before the call if you need a
single type.

## Interview questions

**★ Write a typed property accessor from an empty file.**
`function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key] }`
— `T` inferred from the object, `K` constrained to its keys and fixed to the
literal that was passed, and `T[K]` reading that property's type back out. No
assertion in the body.

**★ Why does it need two type parameters?**
Because `key: keyof T` checks the key but forgets *which* key, so the widest
expressible return type is `T[keyof T]` — the union of every property type. The
second parameter captures the specific literal that was passed, which is what
makes the return type exact.

**★ What is `T[K]`?**
An indexed access type: the type of property `K` in type `T`. It is the
type-level counterpart of `obj[key]`, and it distributes over unions — `User['name'
| 'age']` is `string | number`.

**Why must the object be the first parameter?**
Inference runs over the arguments in order. `T` has to be solved from the object
before `K extends keyof T` has anything to be checked against. Every API of this
shape in the wild takes the object or collection first for exactly this reason.

**What does it mean if the body needs an `as`?**
That the signature is not actually proving what it claims — usually `T` is
unconstrained where the body assumes an object shape. A correct version of this
pattern type-checks its body with no assertion, which is the test of whether the
generic is doing real work.

---

← [Topic index](./README.md) · Next → [02 · Variants, and where it breaks](./02-variants-and-limits.md)
