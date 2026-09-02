---
title: "keyof and indexed access are the two operators every utility type is built from, and knowing them directly is what lets you derive a DTO from a row type without reaching for a utility at all"
sidebar_label: "08 · keyof and indexed access"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the TypeScript handbook on
> [`keyof`](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html),
> [indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)
> and
> [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html),
> and the `lib.es5.d.ts` declarations of `Pick`, `Omit`, `Record` and `Exclude`
> read from `typescript@6.0.3` (TypeScript is not installed in this checkout).
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**`Pick`, `Omit`, `Record` and every other utility in this chapter is `keyof`
and indexed access with a name on it.** That is not a reason to stop using
them — a name is worth a lot — but it is the reason the utilities run out
exactly where these two operators do, and knowing the primitives is what lets
you write the derivation the standard library does not have. This chunk is the
two operators, the map-then-index idiom the corpus has used three times without
explaining it, and the derivation of a DTO from a row type.

## `keyof` and `T[K]`

```ts
interface OrderRow {
  id: number;
  status: OrderStatus;
  total_cents: number;
  created_at: Date;
  internal_notes: string | null;
}

type OrderKey    = keyof OrderRow;              // 'id' | 'status' | 'total_cents' | …
type Status      = OrderRow['status'];          // OrderStatus
type IdOrTotal   = OrderRow['id' | 'total_cents'];   // number
type AnyValue    = OrderRow[keyof OrderRow];    // number | OrderStatus | Date | string | null
```

Four facts that do most of the work:

1. **`keyof T` is a union of literal types**, so it composes with `Exclude`,
   `Extract` and a template literal.
2. **`T[K]` takes a union of keys** and gives the union of their value types —
   indexed access is not restricted to one key.
3. **`T[keyof T]` is the union of all value types**, which is the map-then-index
   idiom's second half.
4. **`keyof` on a type with an index signature is the index type**, so
   `keyof Record<string, Tone>` is `string | number` — a surprise the first time
   ([chunk 04](04-record-index-signatures-and-map.md) is the context).

## Arrays and tuples

```ts
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];
//   'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
```

🔴 **`[number]` on a tuple type is the idiom that turns a runtime array into a
union**, and it is the single most-used derivation in this app —
[chapter 02·05](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
builds the status union, the error-code union and the sort union this way. It
works because a tuple's numeric indices are keys, so indexing by `number` gives
the union of all element types.

```ts
type FirstStatus = (typeof ORDER_STATUSES)[0];       // 'pending'
type Elem        = CartItem[]['length'];             // number — arrays have keys too
```

## The map-then-index idiom

```ts
export type ApiError = {
  [C in ErrorCode]: ErrorBase & {code: C} &
    (C extends keyof Extras ? z.output<Extras[C]> : {})
}[ErrorCode];
```

[Chapter 07·04b](../07-the-typed-api-client/04b-narrowing-errorbody-by-code.md)
built that and explained it locally; the general form belongs here:

```ts
type UnionFrom<K extends PropertyKey, F> = { [P in K]: F }[K];
```

**Build an object type with one property per union member, computing each
property's type for that member, then index the object by the whole union to
collapse it back into a union.** It is the only way to produce a union whose
members are *computed per member*, because a mapped type cannot produce a union
directly.

The tell that you need it: you want "for each member of this union, a different
type", and a plain conditional gives you one answer for the whole union.

## Deriving a DTO from a row type, without `Omit`

```ts
// the utility way, with the constraint problem chunk 03 described
type PublicOrder = Omit<OrderRow, 'internal_notes'>;

// the primitive way, with the check built in
type PublicKey = Exclude<keyof OrderRow, 'internal_notes'>;
type PublicOrder = {[K in PublicKey]: OrderRow[K]};
```

Neither version checks the key — `Exclude` is as silent as `Omit`
([chunk 05](05-exclude-extract-and-distributivity.md)) — which is the point:
writing it out shows you *where* the check would have to go, and the answer is
the key union. Constrain it and the problem is solved once:

```ts
type Without<T, K extends keyof T> = {[P in Exclude<keyof T, K>]: T[P]};
type PublicOrder = Without<OrderRow, 'internal_notes'>;
//                                    ^ now checked
```

📌 **That is `StrictOmit` again**, arrived at from the primitives instead of
from the standard library. The two are the same type; the difference is that
one of them explains itself.

### Renaming as well as selecting

```ts
type Camel<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<Camel<T>>}`
  : S;

type CamelKeys<T> = {[K in keyof T as Camel<Extract<K, string>>]: T[K]};

type OrderDto = CamelKeys<Pick<OrderRow, 'id' | 'total_cents' | 'created_at'>>;
//   { id: number; totalCents: number; createdAt: Date }
```

⚠️ **And this app does not do that.** The type is correct and the *runtime*
mapping is still a function somebody has to write and keep in step; deriving
the type without deriving the mapper is how you get a DTO type that no code
produces. [Chapter 02·04b](../02-zod-as-the-source-of-truth/04b-wire-types-and-envelopes.md)
settled this at the schema level, where the parse does the renaming and the
type follows it. The example is here because the technique is worth
recognising, not because it is the recommendation.

## Gotchas

**★ `keyof T` includes `number` and `symbol`, and a template literal needs
strings.** `` `get${Capitalize<keyof T>}` `` fails; `Extract<keyof T, string>`
or `string & keyof T` is the fix, and it is the same `Extract` that
[chapter 06·08c](../06-typing-the-custom-hooks/08c-useform-typed-from-the-schema.md)
needs for form field names.

**★ `keyof` on an interface with an index signature is the index type, not the
declared keys.** `keyof {[k: string]: Tone}` is `string | number` — the
`number` because a numeric index is also a string index at run time. If you
wanted the declared keys, the type should not have had an index signature.

**★ `T[K]` on an optional property includes `undefined`.**
`{a?: string}['a']` is `string | undefined`, which is usually what you want and
occasionally surprising in a mapped type that was meant to preserve the shape
exactly. `Required<T>[K]` or `NonNullable<T[K]>` are the two ways out, and they
mean different things.

**★ A mapped type cannot produce a union directly.** `{[K in U]: F<K>}` is an
object type; the `[U]` index at the end is what turns it into a union. Leaving
the index off is the most common way the map-then-index idiom fails, and the
error surfaces later as "property does not exist" on what you thought was a
union.

**★ `(typeof arr)[number]` needs the `as const`.** Without it,
`typeof ORDER_STATUSES` is `string[]` and the indexed access is `string`. The
`as const` and the `[number]` are one idiom in two halves, and half of it is
useless.

**★ `(typeof arr)[number]` on a non-`const` tuple gives you the widened
element type.** Same failure, different shape: a tuple declared
`['pending', 'paid']` without `as const` is `string[]`, so the derived union is
`string` and every later `switch` on it stops being exhaustive — silently,
because `string` accepts every case label.

**★ Homomorphic mapped types preserve modifiers and non-homomorphic ones do
not.** `{[K in keyof T]: T[K]}` keeps `?` and `readonly`; `{[K in Exclude<keyof
T, 'x'>]: T[K]}` does not, because the compiler only recognises the
`in keyof T` form as homomorphic. That is why hand-rolled `Omit` replacements
sometimes make optional properties required, and it is a real, confusing diff
when you switch a codebase from `Omit` to a custom version.

**★ Indexed access on a union of object types gives the union of the value
types, but only for keys present on every member.** `(A | B)['id']` works if
both have `id` and errors if only one does — the same rule as property access
on an unnarrowed union. That is why `Omit` over a discriminated union collapses
it ([chunk 03](03-omit-accepts-keys-that-do-not-exist.md)).

**★ `keyof any` is `string | number | symbol` and appears in real
declarations.** `Record<K extends keyof any, T>` and
`Omit<T, K extends keyof any>` both use it. Recognising it as "any property
key" rather than as a mistake is what makes both declarations readable — and,
in `Omit`'s case, what makes the problem obvious.

## Interview questions

**★ How do you turn a runtime array of strings into a union type?**
`as const` on the array and `(typeof ARR)[number]` to index it. The const
assertion keeps the elements as literal types instead of widening them to
`string`, and indexing a tuple by `number` yields the union of its element
types. Both halves are required: without the assertion the result is `string`,
and every exhaustive switch on it silently stops being exhaustive.

**★ Explain the map-then-index idiom and when you need it.**
`{[K in U]: F<K>}[U]` — build an object type with one property per union
member, computing each property's type for that member, then index it by the
whole union to collapse it into a union of those computed types. You need it
whenever the answer differs per member, because a mapped type produces an
object and a conditional over the whole union gives one answer. The chapter-07
`ApiError` type is the app's real use.

**★ Why does `` `get${Capitalize<keyof T>}` `` not compile?**
Because `keyof T` is `string | number | symbol` and a template literal
placeholder needs a string-like type. `Extract<keyof T, string>` (or
`string & keyof T`) narrows it. The same requirement shows up in form field
names, route parameter names, and anywhere else a key is used as text.

**★ What is a homomorphic mapped type and why should you care?**
One written as `{[K in keyof T]: …}` — the compiler recognises that form and
preserves the source's `?` and `readonly` modifiers. A mapped type over a
*computed* key union, such as `{[K in Exclude<keyof T, 'x'>]: T[K]}`, is not
homomorphic and drops the modifiers. It matters because a hand-rolled `Omit`
replacement can silently make optional properties required, which is a
confusing diff when you switch a codebase to a stricter custom version.

**★ You want a camelCase DTO type from a snake_case row type. Should you derive
it?**
The type is derivable — a recursive template literal type for the key
conversion and a mapped type with an `as` clause to apply it — and deriving it
alone is a trap, because the *runtime* mapping is still a function somebody
writes by hand, and now the type says one thing while the mapper may do
another. Do the conversion where the runtime work happens: at the schema, so
the parse renames the fields and the type follows.

**★ Why does `Omit` over a discriminated union lose the members' distinct
fields?**
Because it is `Pick<T, Exclude<keyof T, K>>`, and `keyof (A | B)` is only the
keys common to both members — indexed access and `keyof` over a union both
restrict themselves to what every member has. So the omit is computed over the
shared keys and the result is an object type with only those, which no longer
narrows. Distributing the conditional, or omitting at each member declaration,
is the fix.

---

← Prev: [Template literal types](07-template-literal-types.md) ·
[Overview](README.md) ·
Next → [Branded types in app code](09-branded-types-in-app-code.md)
