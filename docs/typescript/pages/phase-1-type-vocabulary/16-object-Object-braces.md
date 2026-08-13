---
title: "`object`, `Object` and `{}`"
sidebar_label: "16 · object, Object, {}"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex7-object-types.sh`.

**Three types that look interchangeable and accept wildly different values.**
You will rarely write them deliberately; you will meet them in error messages and
in older declaration files, and misreading one costs an afternoon.

## What each accepts

```ts
declare const lower: object;    // any non-primitive
declare const upper: Object;    // anything with Object's methods — almost everything
declare const empty: {};        // anything except null/undefined
```

| Value | `object` | `Object` | `{}` |
|---|---|---|---|
| `{ a: 1 }` | ✅ | ✅ | ✅ |
| `[1, 2]` | ✅ | ✅ | ✅ |
| `() => {}` | ✅ | ✅ | ✅ |
| `'hello'` | ❌ | ✅ | ✅ |
| `42` | ❌ | ✅ | ✅ |
| `null` / `undefined` | ❌ | ❌ | ❌ |

The surprise is the middle column. `Object` and `{}` accept **primitives**,
because a string does have `toString` and `valueOf` — so they are close to
"anything except `null` and `undefined`", which is almost never what someone
meant to write.

## `object` — the only one that means "an object"

```ts
function inspect(value: object) { … }

inspect({ a: 1 });    // fine
inspect([1, 2]);      // fine — arrays are objects
inspect('hello');     // error: Argument of type 'string' is not assignable to parameter of type 'object'
```

It excludes all primitives. It is also nearly useless on its own, because you
cannot read any property from it:

```ts
function inspect(value: object) {
  return value.id;   // error: Property 'id' does not exist on type 'object'
}
```

So `object` says "not a primitive" and nothing more. When you actually want to
accept any object *and use it*, the honest type is `Record<string, unknown>`, or
`unknown` plus narrowing.

## `{}` — "anything but null and undefined"

```ts
function f(value: {}) { … }
f('hello');   // fine
f(42);        // fine
f(null);      // error: Type 'null' is not assignable to type '{}'
```

`{}` is not "an empty object" — it is "a value with at least these zero
members", which every non-nullish value satisfies. Under `strictNullChecks` it is
effectively `unknown` minus `null | undefined`.

It has one legitimate modern use, as a **generic constraint meaning "defined"**:

```ts
function requireValue<T extends {}>(v: T | null | undefined): T {
  if (v == null) throw new Error('missing');
  return v;
}
```

Outside that, seeing `{}` in code usually means someone wanted `object`,
`Record<string, unknown>` or `unknown`.

## `Object` — the interface, and why not to use it

`Object` describes the members every object inherits from `Object.prototype`:
`toString`, `valueOf`, `hasOwnProperty`. Primitives get them by autoboxing, so
they satisfy it.

Same trap as `String`, `Number` and `Boolean` — the capitalised **wrapper
interfaces** are not the primitive types:

```ts
const s: String = 'hello';   // legal, and wrong
const t: string = s;         // error: Type 'String' is not assignable to type 'string'
```

**Rule: lowercase for the primitive, always.** `string`, `number`, `boolean`.
Capitalised forms only when describing the wrapper objects themselves, which
you should not be creating.

## What to write instead

| You meant | Write |
|---|---|
| Any object, whose properties I will read | `Record<string, unknown>` |
| Any value at all, and I will narrow | `unknown` |
| Any non-primitive | `object` (rare, and you still cannot read from it) |
| Any defined value, as a constraint | `T extends {}` |
| A specific shape | the shape — this is the answer nearly every time |

## Trade-off

These types exist for legitimate edge cases — library authors constraining
generics, declaration files describing very old JavaScript. In application code
they are almost always a symptom of not knowing the shape yet, and the
alternative that keeps you honest is `unknown` plus a narrowing step
([Phase 9](../../syllabus/03-in-the-stack.md)).

## Gotchas

**Symptom:** `{}` accepted a string and a number
**Cause:** It means "not null or undefined", not "empty object".
**Fix:** `Record<string, unknown>` for an object bag, `unknown` for anything.

**Symptom:** `Property 'x' does not exist on type 'object'`
**Cause:** `object` carries no members.
**Fix:** Declare the shape, or `Record<string, unknown>` plus narrowing.

**Symptom:** `Type 'String' is not assignable to type 'string'`
**Cause:** The capitalised wrapper interface was used as a type.
**Fix:** Lowercase `string`.

**Symptom:** `Object` accepted a number and you expected a rejection
**Cause:** Primitives autobox and so satisfy `Object`'s members.
**Fix:** `object`, or a concrete shape.

**Symptom:** A lint rule flags `{}` or `Object` (`@typescript-eslint/no-empty-object-type`,
`no-unsafe-function-type`)
**Cause:** They are almost always a mistake.
**Fix:** Follow the rule's suggestion; `T extends {}` as a definedness constraint
is the one case to allow deliberately.

## Interview questions

**★ What is the difference between `object`, `Object` and `{}`?**
`object` is any non-primitive. `Object` is the interface of
`Object.prototype`'s members, which primitives satisfy by autoboxing. `{}` is
"any value with at least zero members" — everything except `null` and
`undefined`. Only the first actually means "an object".

**★ Why is `{}` not "an empty object"?**
Because a type describes a *minimum* set of members, and every non-nullish value
has at least zero. So `{}` accepts `'hello'` and `42`. Under `strictNullChecks`
it is effectively `unknown` minus `null | undefined`.

**★ What should you use for "any object" in real code?**
`Record<string, unknown>` if you will read properties from it, or `unknown` if
you will narrow first. `object` is technically correct and unusable, since it
exposes no members.

**Why never use `String`, `Number` or `Boolean` as types?**
They describe the wrapper objects, not the primitives, and the assignment goes
only one way — a `String` is not assignable to `string`. Lowercase is always what
you want.

**Is there a legitimate use for `{}`?**
As a generic constraint meaning "defined": `function f<T extends {}>(v: T | null)`
uses it to exclude `null` and `undefined` from `T`. That is the one place it is
the clearest tool.

---

← Prev: [Recursive types](./15-recursive-types.md) · Next → [`symbol` and `unique symbol`](./17-symbols.md)
