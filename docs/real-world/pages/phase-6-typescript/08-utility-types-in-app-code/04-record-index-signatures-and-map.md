---
title: "Record over a closed key set is a checked table and Record<string, T> is an index signature that promises a value for every string, and the difference decides whether a lookup can be trusted"
sidebar_label: "04 · Record, index signatures and Map"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the `lib.es5.d.ts` declaration read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) —
> `type Record<K extends keyof any, T> = {[P in K]: T};` — the handbook on
> [index signatures](https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures)
> and
> [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html),
> the
> [`noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)
> compiler option, and MDN on
> [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
> Target: **TypeScript 7.0.2** (phase spine).
> Documentation-validated; **no console blocks, no timings**.

**`Record<OrderStatus, string>` and `Record<string, string>` are the same
utility and opposite tools.** The first is a table with five required entries
and a compile error for the sixth status you add; the second is an index
signature that claims every string in the universe maps to a value, which is
false for every object you will ever build. Getting the distinction wrong is
how a lookup returns `undefined` from a type that says it cannot.

## The declaration, and the two ways it is used

```ts
type Record<K extends keyof any, T> = {
    [P in K]: T;
};
```

**Closed key set — a table.**

```ts
// apps/web/src/components/OrderStatusBadge.tsx
const STATUS_TONE = {
  pending:   'muted',
  paid:      'info',
  shipped:   'info',
  delivered: 'success',
  cancelled: 'muted',
} as const satisfies Record<OrderStatus, Tone>;
```

Five statuses, five keys, and adding a sixth to `ORDER_STATUSES` makes this
object fail to compile — the phase gate, at a render site. `satisfies` rather
than an annotation, for the reason
[chunk 06](06-satisfies-versus-annotation.md) is about.

**Open key set — an index signature.**

```ts
const byId: Record<number, Product> = {};
byId[42];                                 // Product — and it is not there
```

🔴 **That type is a lie by construction.** `{[P in number]: Product}` says
every number is a key. The object is empty. The compiler will let you call
`byId[42].price_cents` and the program throws.

## `noUncheckedIndexedAccess` makes the lie visible

The compiler option's effect is exactly this case: with it on, reading through
an index signature yields `T | undefined`.

```ts
const p = byId[42];         // Product | undefined
p.price_cents;              // ✗ 'p' is possibly 'undefined'
if (p) render(p);           // ✓
```

📌 **It is off by default and it is not part of `strict`.** A codebase that has
never enabled it has a population of index-signature reads that all silently
assume presence. Turning it on in an existing app produces a large, boring diff
and finds real bugs; turning it on at the start costs almost nothing.

⚠️ **It also affects array indexing**, so `items[0]` becomes
`CartItem | undefined` everywhere. That is correct and it is the part teams
argue about — the honest framing is that `items[0]` on an empty array *is*
`undefined`, and the flag stops the type from claiming otherwise.

## `Partial<Record<K, V>>` for a table with holes

```ts
// the error-extras table from chapter 07
export const ERROR_EXTRAS = { … } as const satisfies Partial<Record<ErrorCode, z.ZodType>>;
```

`Record<ErrorCode, z.ZodType>` would require all twenty-one codes to have an
extras schema. `Partial<Record<…>>` says "keys come from this closed set, and
any of them may be absent" — which is the accurate description of that table
and the reason a lookup into it needs a check.

**Three shapes, three meanings, and they are worth keeping straight:**

| Type | Says | Lookup gives |
|---|---|---|
| `Record<OrderStatus, Tone>` | all five keys present | `Tone` |
| `Partial<Record<OrderStatus, Tone>>` | keys from the five, any may be absent | `Tone \| undefined` |
| `Record<string, Tone>` | every string is a key | `Tone` (or `Tone \| undefined` with the flag) |

## When a `Map` is the honest answer

Reach for `Map<K, V>` when the keys are **runtime data** rather than a known
set:

```ts
// apps/web/src/cart/CartProvider.tsx — an index built from a fetched cart
const byProduct = new Map<number, CartItem>(items.map((i) => [i.product_id, i]));
const line = byProduct.get(productId);        // CartItem | undefined — always
```

Four reasons this beats an object here, and only the first is about types:

1. **`get` returns `V | undefined` unconditionally**, with no compiler flag
   required. The type tells the truth about a lookup that can miss.
2. **Keys are not stringified.** An object's numeric keys become strings;
   `Map` keeps `number` a `number`, so `byProduct.get(42)` and
   `byProduct.get('42')` are different questions and the second does not
   type-check.
3. **No prototype keys.** `obj['constructor']` finds something; `map.get('constructor')`
   does not. For keys derived from user input — a slug, a header name, a form
   field — that difference is a security property, not a nicety.
4. **`size`, iteration order and deletion** are all defined and cheap.

⚠️ **And `Map` does not serialise.** `JSON.stringify(map)` is `{}`. Anything
that crosses the wire, goes into `localStorage`, or is handed to `structuredClone`'s
JSON-shaped consumers wants a plain object; a `Map` is for in-memory indexes.

## Gotchas

**★ `Record<string, T>` claims a value for every string, and the object has
five entries.** Without `noUncheckedIndexedAccess` the compiler will
confidently let you read a key that is not there. This is the most common
untruth in an average TypeScript codebase, and it never errors — it throws.

**★ `Record<K, V>` with a literal-union `K` requires *every* member.** That is
the feature, and it is also why a table added for four of five statuses does
not compile. If the table is genuinely partial, say so with
`Partial<Record<K, V>>` rather than widening `K` to `string`, which throws away
the key checking entirely.

**★ Object keys are strings, so `Record<number, T>` is a fiction at run
time.** `{1: 'a'}` has the key `'1'`. Iterating with `Object.keys` gives
`string[]`, so a `for (const k of Object.keys(byId))` loop has `k: string` and
`byId[k]` needs a cast or a parse. `Map<number, V>` keeps the number.

**★ `Object.keys` returns `string[]`, not `(keyof T)[]`, and that is
deliberate.** An object may have more keys at run time than its type declares —
structural typing means a `Record<OrderStatus, Tone>` value can be an object
with extra properties — so the standard library refuses to promise otherwise. A
typed helper is the usual workaround, and it is an assertion:

```ts
function keysOf<T extends object>(o: T): (keyof T)[] {
  return Object.keys(o) as (keyof T)[];      // an assertion — know that it is one
}
```

**★ `Object.entries` on a `Record<K, V>` widens the key back to `string`
too.** Every loop over a typed table loses the key type, which is why the
OpenAPI emitter in
[chapter 07·06b](../07-the-typed-api-client/06b-emitting-from-the-route-map.md)
is honest about iterating over values rather than trying to keep the literal
keys.

**★ An index signature swallows excess-property checks.** `const t:
Record<string, Tone> = {pending: 'muted', pendign: 'muted'}` compiles, because
both keys are strings. The typo'd key is exactly the bug the closed-key
`Record<OrderStatus, Tone>` catches, and widening the key type to fix an
unrelated error re-opens it.

**★ A `Map` keyed by an object compares by reference.** `map.get({id: 1})`
never finds an entry inserted with a different object of the same shape.
Neither the type nor the runtime warns; the lookup simply misses. Key by a
primitive derived from the object.

**★ `Map` does not `JSON.stringify`.** It serialises as `{}` with no error, so
a cart index accidentally stored in `localStorage` comes back empty and the
code that reads it sees a valid, empty structure. Convert with
`Object.fromEntries(map)` — or `[...map]` for non-string keys — before
serialising.

**★ `Record<K, V>` and a mapped type are the same thing, so `Record` gives you
no extra checking over `{[P in K]: V}`.** People sometimes reach for `Record`
expecting it to validate something; it is a one-line alias for the mapped type
and validates exactly what the mapped type does. The checking comes from `K`
being a closed union.

**★ `Partial<Record<K, V>>` is not the same as `Record<K, V | undefined>`.**
The first makes the keys optional; the second requires every key to be present
with a possibly-`undefined` value. Under `exactOptionalPropertyTypes` the
difference sharpens further. For a table with holes you want `Partial`, and
`'code' in table` remains a meaningful check.

## Interview questions

**★ What is the difference between `Record<OrderStatus, Tone>` and
`Record<string, Tone>`?**
The first is a closed table: five keys, all required, and adding a sixth status
breaks every table that has not been updated. The second is an index signature
claiming that every string maps to a `Tone`, which is false for any object you
actually build — so a lookup for a missing key type-checks and returns
`undefined` at run time. The declaration is the same mapped type in both cases;
the key parameter is doing all the work.

**★ What does `noUncheckedIndexedAccess` change, and why is it not on by
default?**
It makes reads through an index signature — and array indexing — produce
`T | undefined` instead of `T`, which is the truth. It is not part of `strict`
because turning it on in an existing codebase produces a large diff: every
`items[0]` and every `table[key]` now needs a check or a narrowing. That diff
is worth it, and it is much cheaper at the start of a project than in year
three.

**★ When do you choose a `Map` over an object?**
When the keys are runtime data rather than a known set. `Map.get` returns
`V | undefined` unconditionally with no compiler flag, numeric keys stay
numeric instead of being stringified, and there is no prototype for a
user-supplied key like `'constructor'` to collide with. The cost is that a
`Map` does not serialise — `JSON.stringify` gives `{}` — so it is an in-memory
index, not a wire format.

**★ Why does `Object.keys` return `string[]` rather than `(keyof T)[]`?**
Because structural typing means a value may have more properties at run time
than its type declares — a function taking `Record<OrderStatus, Tone>` can be
handed an object with extra keys — so promising `(keyof T)[]` would be unsound.
The usual workaround is a helper that asserts the cast, and the important part
is knowing it *is* an assertion rather than a check.

**★ You need a lookup table with an entry for only some of the members of a
union. How do you type it?**
`Partial<Record<K, V>>`, which keeps the key set closed — so a typo'd key is
still an error — while allowing entries to be absent, and makes every lookup
`V | undefined`. The tempting alternative, widening the key to `string`, buys
the optionality by giving up all key checking, which is a bad trade for the one
property you were trying to express.

**★ Why is an index signature dangerous for keys derived from user input?**
Because a plain object has a prototype: `table['constructor']`,
`table['__proto__']` and `table['toString']` all find something, so a lookup
keyed by a user-supplied string can return a function where a value was
expected. A `Map` has no such keys, and `Object.create(null)` is the object-side
answer. The type system shows none of this — both lookups have the same
declared type.

---

← Prev: [`Omit` accepts keys that do not exist](03-omit-accepts-keys-that-do-not-exist.md) ·
[Overview](README.md) ·
Next → [`Exclude`, `Extract` and distributivity](05-exclude-extract-and-distributivity.md)
