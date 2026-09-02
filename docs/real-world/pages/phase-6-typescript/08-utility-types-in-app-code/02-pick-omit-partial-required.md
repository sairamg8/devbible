---
title: "Pick, Omit, Partial, Required and Readonly are five one-line mapped types, and knowing which of this app's shapes each is wrong for is worth more than knowing what they do"
sidebar_label: "02 · Pick, Omit, Partial, Required"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the `lib.es5.d.ts` declarations read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout) — `Partial`,
> `Required`, `Readonly`, `Pick`, `Omit` quoted verbatim below — the handbook's
> [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
> and
> [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
> references, and the
> [`exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes)
> compiler option. The zod counterparts are the **4.4.3** declarations in this
> repo.
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**All five are mapped types you could have written yourself in one line, and
that is the point of reading them: once you can see the mapping, you can see
exactly what it does and does not do.** `Readonly` is shallow because the
mapping is one level deep. `Partial` puts `| undefined` in play. `Required`
strips a modifier and nothing else. None of that is trivia — each is the reason
one of these utilities is the wrong tool for one of this app's shapes.

## The five declarations

```ts
type Partial<T> = {
    [P in keyof T]?: T[P];
};

type Required<T> = {
    [P in keyof T]-?: T[P];
};

type Readonly<T> = {
    readonly [P in keyof T]: T[P];
};

type Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

Four of the five constrain their key parameter to something sensible. **`Omit`
does not** — `K extends keyof any` — and that single asymmetry is large enough
to have [its own chunk](03-omit-accepts-keys-that-do-not-exist.md).

## Where each one earns its place in this app

```ts
// packages/shared/src/order.ts and apps/api/src/db/orders.ts
interface OrderRow {
  id: number;
  user_id: number | null;
  session_id: number | null;
  status: OrderStatus;
  total_cents: number;
  created_at: Date;
  internal_notes: string | null;
  cost_cents: number;
}
```

**`Pick` — the admin list needs six of eight columns.**

```ts
type OrderListRow = Pick<OrderRow, 'id' | 'status' | 'total_cents' | 'created_at'>;
```

The key union is checked (`K extends keyof T`), so a renamed column breaks this
line rather than a screen. This is the safe one, and it is safe *because* of a
constraint `Omit` lacks.

**`Partial` — a PATCH body, after picking.**

```ts
type ProductUpdate = Partial<Pick<ProductRow, 'name' | 'description' | 'price_cents' | 'stock'>>;
```

🔴 **Pick first, then loosen.** `Partial<ProductRow>` optionalises `id`,
`created_at` and `cost_cents` too, which is
[chapter 02·05b's](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
mass-assignment warning restated in plain TypeScript: a handler that spreads
that object into an `UPDATE` lets a client set anything it names.

**`Required` — the one place a config's defaults are resolved.**

```ts
interface ClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}
type ResolvedOptions = Required<ClientOptions>;

function resolve(opts: ClientOptions): ResolvedOptions {
  return {baseUrl: opts.baseUrl ?? '/api', timeoutMs: opts.timeoutMs ?? 10_000, retries: opts.retries ?? 3};
}
```

The value of `Required` here is that the resolver is *checked*: forget a key
and the return type fails. Everything downstream then reads a fully-populated
object with no `??` in sight.

**`Readonly` — a reducer's state parameter, and nothing deeper.**

```ts
export function cartReducer(state: Readonly<CartState>, action: CartAction): CartState
```

⚠️ **The mapping is one level, so `state.items.push(item)` still compiles.**
`Readonly<T>` makes the *properties* readonly; the array a property points at
is untouched. `readonly CartItem[]` on the field is what stops the push, and
[chapter 06·04](../06-typing-the-custom-hooks/04-usereducer-and-the-action-union.md)
priced how far down that goes.

**`Omit` — the DTO that hides internal columns.**

```ts
type PublicOrder = Omit<OrderRow, 'internal_notes' | 'cost_cents'>;
```

…and this is the one to be nervous about, for two separate reasons: the missing
constraint ([next chunk](03-omit-accepts-keys-that-do-not-exist.md)), and the
coupling of a public type to an internal one
([chunk 01](01-derive-never-redeclare.md)).

## Where each is the wrong tool

| Utility | Wrong when | Use instead |
|---|---|---|
| `Pick` | you want *most* fields and would list ten of twelve | `Omit` of the two — but see the constraint problem |
| `Omit` | the omitted key set is the thing you care about being right | `Pick` of what remains, or a `StrictOmit` |
| `Partial` | the shape has fields a client must not set | `Pick` the mutable subset first, then `Partial` |
| `Partial` | you mean "this field may be absent from the JSON" | the schema's `.optional()`, so the runtime parse agrees |
| `Required` | the source's optionality is meaningful, not just unresolved defaults | leave it optional and narrow at use |
| `Readonly` | you need deep immutability | `readonly T[]` per field, or a library — `Readonly` is one level |
| all five | the target is a **schema**, not a type | zod's `.pick()`, `.omit()`, `.partial()`, `.required()` — the masks are checked and you get the runtime parser too |

🔴 **That last row is the standing recommendation of this phase.** Derive on
the schema and the type follows for free through `z.infer`; derive on the type
and the runtime parser stays where it was, describing the old shape.

## Gotchas

**★ `Partial<T>` and `T | undefined` per field are different under
`exactOptionalPropertyTypes`.** With that flag on, `{name?: string}` accepts a
missing key but *not* an explicit `{name: undefined}`, while
`{name: string | undefined}` requires the key and allows the value. `Partial`
produces the first. Code that builds patch objects with
`{name: maybeName}` then fails to compile — correctly, and confusingly if you
have not met the flag.

**★ `Readonly<T>` is one level deep and reads as though it is not.** The name
promises more than the mapping delivers. Every nested object and array is still
mutable, so a `Readonly<CartState>` is a guard against `state.items = []` and
not against `state.items.push(x)`.

**★ `Required<T>` removes optionality and leaves `undefined` in the type if it
was written explicitly.** `{a?: string | undefined}` becomes
`{a: string | undefined}` — the key is now required and its value may still be
`undefined`. `Required` strips the `?` modifier, not the union member. If the
goal was "definitely a string", the fix is `NonNullable` on the property, not
`Required` on the object.

**★ `Pick`'s constraint catches typos and `Omit`'s does not, and people learn
the wrong lesson from that.** Having been burned by `Omit`, developers
sometimes conclude that all of these are unchecked. `Pick<T, 'nmae'>` is a
compile error today; the asymmetry is specific to `Omit`, and the next chunk is
about why.

**★ `Partial` on a type with a union member optionalises the whole property,
not the members.** `Partial<{owner: {kind:'guest'} | {kind:'user'}}>` gives
`owner?: …`, so the union is intact and the *property* is now absent-able. If
what you wanted was "either variant, partially filled", no utility does that;
you want a different union.

**★ Mapped utilities lose call and construct signatures.** `Pick`, `Omit`,
`Partial` and friends map over `keyof T`, and a class's constructor or a
function type's call signature are not keys. `Partial<SomeClass>` gives you the
properties and drops the methods' `this` typing subtleties; `Omit` over a
function type produces an object with no call signature at all. For anything
callable, these are the wrong tools.

**★ `Omit` and `Pick` erase optionality information only if you go through a
conditional.** Both are homomorphic mapped types over `T`, so `?` and
`readonly` modifiers on the source properties are preserved — `Pick<{a?: string},
'a'>` is `{a?: string}`. That is worth knowing because hand-rolled equivalents
written with a conditional type often *do* lose the modifiers, and the
difference shows up as spurious "missing property" errors.

**★ Deriving a DTO with `Omit` means every new internal column joins the public
type automatically.** `Omit<OrderRow, 'internal_notes' | 'cost_cents'>` is a
blocklist: add `margin_cents` to the row and it is public the moment the column
exists, because nobody edited the omit list. `Pick` is an allowlist and fails
the other way — a new column is invisible until someone adds it, which is the
failure you want on a public shape.

## Interview questions

**★ Why is `Readonly<T>` not enough to make a reducer's state immutable?**
Because the mapping is one level: `{readonly [P in keyof T]: T[P]}` marks the
properties readonly and says nothing about what they point at. `state.items =
[]` is blocked, `state.items.push(item)` is not. Deep immutability means
declaring the fields themselves as `readonly CartItem[]`, or a recursive
mapped type, and both make construction inside the reducer more awkward — which
is why this app takes the shallow version and treats the rest as review.

**★ `Partial<ProductRow>` for a PATCH body — what is wrong with it?**
It optionalises everything, including `id`, `created_at` and `cost_cents`, so a
handler that spreads the parsed body into an `UPDATE` lets a client set columns
it must never touch. The order matters: `Partial<Pick<ProductRow, 'name' |
'description' | 'price_cents' | 'stock'>>` picks the mutable subset first and
then loosens it. On the schema side the same rule is `.pick({…}).partial()`,
and that version also gives you the runtime parser.

**★ What does `Required<T>` actually remove?**
The `?` modifier — the declaration is `{[P in keyof T]-?: T[P]}`. It does not
remove `undefined` from a property's *type*, so `{a?: string | undefined}`
becomes `{a: string | undefined}`: the key must now be present and its value may
still be `undefined`. If the goal is a definitely-defined value, the tool is
`NonNullable` on the property type, not `Required` on the object.

**★ When would you use zod's `.omit()` instead of TypeScript's `Omit`?**
Whenever the thing you are deriving from is a schema, which in this app is most
of the time. zod's mask is *checked* — its signature intersects
`Record<Exclude<keyof M, keyof Shape>, never>`, so a key that is not in the
shape fails to compile — and the result is a schema, so the runtime parse
follows the derivation for free. `Omit` on the inferred type leaves the parser
describing the old shape, which is a second declaration by another route.

**★ `Omit` for a public DTO is an allowlist or a blocklist?**
A blocklist, which is the wrong polarity for anything public. Add a column to
the row type and it appears in the derived DTO immediately, because nobody
edited the omit list — so an internal `margin_cents` is published by the
migration that adds it. `Pick` is the allowlist: a new column is invisible
until someone deliberately includes it, and "the field is missing" is a far
better failure than "the field leaked".

---

← Prev: [Derive, never re-declare](01-derive-never-redeclare.md) ·
[Overview](README.md) ·
Next → [`Omit` accepts keys that do not exist](03-omit-accepts-keys-that-do-not-exist.md)
