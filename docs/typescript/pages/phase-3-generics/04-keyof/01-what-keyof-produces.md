---
title: "What `keyof` produces"
sidebar_label: "01 · What it produces"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Type Manipulation →
> Keyof Type Operator*). That `keyof any` is `string | number | symbol` is
> corroborated by `lib.es5.d.ts`'s own use of it as the bound in
> `type Omit<T, K extends keyof any>`, read directly. ⚠️ Install inspected:
> TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No console block**
> — no sandbox run covers this phase.

`keyof` takes a type and gives you **the union of its keys, as literal types**.

```ts
type User = { id: string; name: string; age: number };

type UserKey = keyof User;        // 'id' | 'name' | 'age'
```

That is the whole definition, and it is worth saying what it is *not*: it is not
`Object.keys`, it does not run, and it does not produce strings. It produces a
**union of string literal types**, which is why it composes with everything else
in the type language and why it is the entry point to the rest of this phase and
all of Phase 5.

## Why it matters more than it looks

On its own it is a convenience. Combined with a type parameter it is the thing
that makes a generic able to talk about *another* type's structure:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { … }
```

`K extends keyof T` — a constraint whose bound is **computed from another
parameter** ([topic 02](../02-constraints/README.md)). Nothing before `keyof`
lets you say "one of that thing's keys", and almost every useful generic in a
real codebase says exactly that. **Topic 05 · The `getProp` pattern** *(not
written yet)* is the full treatment.

## Modifiers do not affect it

Optional and `readonly` change the *property*, not whether the key exists:

```ts
type Config = {
  readonly id: string;
  name?: string;
  tags: string[];
};

type ConfigKey = keyof Config;    // 'id' | 'name' | 'tags'
```

`'name'` is in there even though the property is optional. If you want only the
required keys, or only the mutable ones, that is a mapped type with a
conditional — Phase 5 territory, not something `keyof` does by itself.

## 🔴 Index signatures widen it in a way that surprises people

```ts
type Dict = { [key: string]: number };

type DictKey = keyof Dict;        // string | number   ← not just string
```

**`number` is in there.** The reason is JavaScript's own behaviour: property
keys are strings at runtime, and `obj[0]` is `obj['0']`, so a `string` index
signature genuinely does accept numeric access. TypeScript models that
faithfully rather than tidying it away.

The numeric case behaves as you would expect in the other direction:

```ts
type NumDict = { [key: number]: string };
type NumKey = keyof NumDict;      // number
```

**When you want only the string keys**, filter:

```ts
type StringKeys = Extract<keyof Dict, string>;    // string
```

`Extract<T, U> = T extends U ? T : never` — read from `lib.es5.d.ts` in
[topic 03](../03-generic-interfaces-and-aliases/README.md). This idiom appears
constantly once a codebase has index signatures in it.

## Arrays and tuples include everything

```ts
type ArrKey = keyof string[];
// number | 'length' | 'push' | 'pop' | 'concat' | … every Array member
```

`keyof` on an array gives you the numeric index type **and every method and
property on `Array.prototype`**, because those are genuinely keys of the type.
It is almost never what you want.

What you usually want is the **element type**, which is an indexed access rather
than a `keyof`:

```ts
type Elem = string[][number];               // string

type Levels = readonly ['debug', 'info'];
type Level = Levels[number];                // 'debug' | 'info'
```

That second form — `(typeof arr)[number]` — is the pairing with `as const` from
[Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md), and it
is one of the highest-value two-line patterns in TypeScript. It is
[topic 06 · Indexed access types](../06-indexed-access-types.md).

For a **tuple**, `keyof` gives the literal index positions plus the array
members:

```ts
type Pair = [string, number];
type PairKey = keyof Pair;    // '0' | '1' | 'length' | … (as string literals)
```

Note those are `'0'` and `'1'` — **strings**, not the numbers `0` and `1`.

## Classes: public instance members only

```ts
class Service {
  public url = '';
  private token = '';
  protected retries = 0;
  connect() {}
}

type ServiceKey = keyof Service;    // 'url' | 'connect'
```

`private` and `protected` members are excluded, which is the right answer for
almost every use — a `getProp<Service, K>` helper should not be able to reach a
private field. Static members are not included either; they live on
`typeof Service`, not on `Service`.

## The two edge values worth memorising

```ts
type Nothing = keyof {};          // never
type Anything = keyof any;        // string | number | symbol
```

**`keyof {}` is `never`.** An empty object type has no keys, and `never` is the
empty union. This is not an error — but it does mean a `K extends keyof T`
parameter can silently become uninhabitable when `T` turns out to be `{}`, and
then *every* call fails with a confusing message.

**`keyof any` is `string | number | symbol`** — every possible property key.
This is the loosest bound available, and it is exactly what makes `Omit`
permissive: its declaration is `Omit<T, K extends keyof any>`, read verbatim in
[topic 03](../03-generic-interfaces-and-aliases/01-parameterising-a-type.md), so
a typo is not a key of `T` and nobody notices. When you write your own
key-taking type, prefer `keyof T`.

## Symbols are keys too

```ts
const tag = Symbol('tag');
type Tagged = { [tag]: string; name: string };

type TaggedKey = keyof Tagged;              // typeof tag | 'name'
type OnlyStrings = Extract<keyof Tagged, string>;   // 'name'
```

Worth knowing because a `K extends keyof T` used in a template literal type or
anywhere expecting a `string` will fail on the symbol member. `Extract<…,
string>` is the fix, again.

## Gotchas

**Symptom:** `keyof` a dictionary gives `string | number`
**Cause:** A `string` index signature accepts numeric access, because `obj[0]`
is `obj['0']` in JavaScript.
**Fix:** `Extract<keyof T, string>` when you need only the string keys.

**Symptom:** `keyof someArray` includes `push`, `length` and dozens more
**Cause:** Those are genuinely keys of the array type.
**Fix:** You wanted the element type — `T[number]` — not `keyof T`.

**Symptom:** A `K extends keyof T` parameter rejects every key
**Cause:** `T` resolved to `{}` or `object`, so `keyof T` is `never`.
**Fix:** Constrain `T` to a shape, or check what `T` actually inferred as.

**Symptom:** A tuple's keys are `'0' | '1'` and comparing to `0` fails
**Cause:** `keyof` produces string literal keys.
**Fix:** Use `T[number]` for elements, or a numeric literal type where an index
is meant.

**Symptom:** `keyof T` includes a symbol and breaks a template literal type
**Cause:** Symbol-keyed properties are keys.
**Fix:** `Extract<keyof T, string>`.

**Symptom:** A private field is unreachable through a `keyof`-constrained helper
**Cause:** By design — `keyof` on a class gives public instance members only.
**Fix:** Nothing; this is the behaviour you want.

## Interview questions

**★ What does `keyof T` give you?**
The union of `T`'s keys as **literal types** — `keyof { id: string; age: number }`
is `'id' | 'age'`. It is a type-level operation with no runtime counterpart; it
is not `Object.keys`, and it produces literal types rather than strings, which is
what lets it compose with constraints, indexed access and mapped types.

**★ Why is `keyof { [k: string]: number }` equal to `string | number`?**
Because a string index signature genuinely accepts numeric access — `obj[0]` is
`obj['0']` at runtime — so TypeScript models both. Use `Extract<keyof T, string>`
when you need only the string keys.

**★ What is `keyof any`, and why does it matter?**
`string | number | symbol` — every possible property key. It matters because
`Omit` is declared `Omit<T, K extends keyof any>`, so `Omit<User, 'nmae'>`
compiles and omits nothing. `Pick` uses `keyof T` and does catch it.

**What does `keyof` give you on an array, and what did you probably want?**
Every key of the array type: `number` plus `length`, `push`, `map` and the rest
of `Array.prototype`. What you almost certainly wanted is the element type,
which is the indexed access `T[number]`.

**What is `keyof {}`?**
`never` — the empty union, because there are no keys. It is worth recognising
because a `K extends keyof T` parameter becomes uninhabitable when `T` widens to
`{}`, and every call then fails for a reason that is not obvious from the error.

---

← [Topic index](./README.md) · Next → [02 · `keyof` in practice](./02-keyof-in-practice.md)
