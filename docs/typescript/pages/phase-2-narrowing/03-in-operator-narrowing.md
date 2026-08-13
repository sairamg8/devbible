---
title: "The `in` operator"
sidebar_label: "03 · The in operator"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Narrowed types revealed by
> assignment to `1`; `sandbox/ts-p2/ex2-guards-and-loss.sh`.

**When two object types differ by which properties they have — and there is no
discriminant field to check — `in` is the narrowing that works.**

## The measurement

```ts
type Cat = { name: string; meow(): void };
type Dog = { name: string; bark(): void };
declare const pet: Cat | Dog;

if ('meow' in pet) { const r: 1 = pet; }
else               { const r: 1 = pet; }
```

```console
src-ex2/guards.ts(5,28): error TS2322: Type 'Cat' is not assignable to type '1'.
src-ex2/guards.ts(6,28): error TS2322: Type 'Dog' is not assignable to type '1'.
```

`Cat` in the true branch, `Dog` in the false branch. **Both directions**, from one
property-name check.

## Why you need it

`typeof` cannot help — both are objects
([01](./01-typeof-narrowing.md)). `instanceof` cannot help — they are plain
object types with no constructor ([04](./04-instanceof-narrowing.md)). Without a
discriminant field, `in` is the only built-in narrowing left.

That makes it the tool for types you did not design:

```ts
type SuccessResponse = { data: unknown[] };
type ErrorResponse = { error: string; code: number };

function handle(res: SuccessResponse | ErrorResponse) {
  if ('error' in res) {
    return `${res.code}: ${res.error}`;
  }
  return res.data.length;
}
```

Third-party APIs frequently return exactly this shape — no `kind`, no `ok`, just
different keys.

## Optional properties do not narrow cleanly

```ts
type A = { shared: string; extra?: number };
type B = { shared: string };

declare const v: A | B;

if ('extra' in v) {
  v;   // A — but at runtime `extra` may be absent from an A too
}
```

Because `extra` is optional, an `A` without it takes the **else** branch, where
the type is `A | B` rather than `B`. `in` narrows on *declared* properties, and
an optional property is declared in only one branch.

**If the property that distinguishes your types is optional, `in` is the wrong
tool** — add a discriminant, or check the value rather than the key.

## `in` is a runtime operator with real semantics

It checks the **prototype chain**, not just own properties:

```ts
'toString' in {};        // true — inherited
Object.hasOwn({}, 'toString');   // false
```

For narrowing that rarely matters, because you are checking a property you
declared. It matters when the object came from `JSON.parse` or an untrusted
source, where a key named `constructor` or `__proto__` can behave unexpectedly —
in which case `Object.hasOwn` is the safer runtime check, even though it does not
narrow.

## `in` also narrows unions of literals-keyed records

```ts
type Config = Record<'dev' | 'prod', { url: string }>;
declare const env: string;
declare const config: Config;

if (env in config) {
  // env is still `string` — `in` narrows the OBJECT, not the key
}
```

A common misreading: `k in obj` narrows `obj`, never `k`. To narrow the key you
need a type predicate ([07](./07-type-guards.md)):

```ts
function isConfigKey(k: string, c: Config): k is keyof Config {
  return k in c;
}
```

## When to prefer a discriminant instead

```ts
// works, but every consumer must know which keys exist
type Result = { data: string } | { error: string };

// better: one property to check, and exhaustiveness comes free
type Result =
  | { kind: 'ok'; data: string }
  | { kind: 'err'; error: string };
```

`in` is the right answer for shapes you do not control. For shapes you design,
a discriminant is clearer, survives refactoring, and enables exhaustiveness
checking ([06](./06-exhaustiveness.md)).

## Trade-off

**`in`** needs no changes to the types and no helper functions — it works on any
union of object types that differ structurally. It costs clarity: the check names
a property rather than a variant, so a rename silently changes which branch runs,
and optional properties break it.

## Gotchas

**Symptom:** `in` narrowed the true branch but the else branch is still a union
**Cause:** The property is optional, so it is not guaranteed absent in the other
member.
**Fix:** Make it required in one variant, or add a discriminant.

**Symptom:** A key check did not narrow the key
**Cause:** `k in obj` narrows `obj`, never `k`.
**Fix:** A type predicate returning `k is keyof T`.

**Symptom:** `in` returned true for a property nobody set
**Cause:** It walks the prototype chain — `'toString' in {}` is `true`.
**Fix:** `Object.hasOwn(obj, key)` for the runtime check; keep `in` for narrowing
declared properties.

**Symptom:** Renaming a property silently changed behaviour
**Cause:** `'meow' in pet` is a string literal the rename tool may miss.
**Fix:** A discriminant field, which is a type the compiler checks everywhere.

## Interview questions

**★ When do you reach for the `in` operator to narrow?**
When the union members are object types with no discriminant and no shared class
— `typeof` says `'object'` for both and `instanceof` needs a constructor.
Measured, `'meow' in pet` narrows to `Cat` in the true branch and `Dog` in the
false branch.

**★ Why does `in` narrowing break with optional properties?**
It narrows on *declared* properties. If the distinguishing property is optional,
a value of that type may not have it at runtime, so the else branch cannot
exclude that member and stays a union.

**★ Does `k in obj` narrow `k`?**
No — it narrows `obj`. To narrow the key you need a type predicate returning
`k is keyof T`, because the compiler will not infer that from the runtime check.

**How does `in` differ from `Object.hasOwn` at runtime?**
`in` walks the prototype chain, so `'toString' in {}` is `true`. `Object.hasOwn`
checks own properties only. For narrowing declared properties the difference
rarely matters; for untrusted parsed data it does.

---

← Prev: [Truthiness and equality](./02-truthiness-and-equality.md) · Next → [`instanceof` narrowing](./04-instanceof-narrowing.md)
