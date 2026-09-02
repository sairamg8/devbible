---
title: "A brand is a phantom property that makes two numbers refuse to mix, and the reason to reach for one is a signature holding four ids of the same type rather than a general policy about primitives"
sidebar_label: "09 · Branded types in app code"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo
> (`ZodType.brand`, whose return type is
> `PropertyKey extends T ? this : core.$ZodBranded<this, T, Dir>`), the
> [zod branded types documentation](https://zod.dev/api?id=branded-types), the
> TypeScript handbook on
> [intersection types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)
> and
> [unique symbol](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol),
> and the `lib.es5.d.ts` `Omit`/`Pick` declarations read from
> `typescript@6.0.3` (TypeScript is not installed in this checkout). The zod
> side of this was
> [chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**Every id in this schema is a `bigint` arriving as a `number`, so `productId`,
`orderId`, `userId` and `cartId` are the same type and the compiler will let
you pass any of them anywhere another is expected.**
[Chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
solved that with zod's `.brand()` at the parse boundary. This chunk is the
plain-TypeScript version — for values that never pass through a schema — plus
the thing neither chapter has said yet: what a brand survives when it meets the
utility types in the rest of this chapter.

## The brand, without zod

```ts
// packages/shared/src/brand.ts
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & {readonly [brand]: B};
```

```ts
export type ProductId = Brand<number, 'ProductId'>;
export type OrderId   = Brand<number, 'OrderId'>;
export type Cents     = Brand<number, 'Cents'>;
```

```ts
function addToCart(cartId: CartId, productId: ProductId, qty: number): Promise<Cart>;

addToCart(cartId, orderId, 1);
//                ^^^^^^^ Argument of type 'OrderId' is not assignable to parameter of type 'ProductId'
```

Three details in the declaration:

- **`declare const brand: unique symbol`** — declared, never defined, so it
  exists only in the type system and cannot be constructed. The zod docs say
  the same thing about their version: *"branded types do not affect the runtime
  result of `.parse`. It is a static-only construct."*
- **The symbol is not exported**, so no other module can build a value with
  that property. Brands made from a string key — `{__brand: 'ProductId'}` —
  are forgeable by anyone who writes the same object literal.
- **`readonly`**, so the phantom property cannot be assigned even in the
  unlikely case someone reaches it.

## Constructing one

A branded value cannot be produced by ordinary arithmetic, which is the entire
point and the entire cost:

```ts
const id: ProductId = 42;
//    ^ Type 'number' is not assignable to type 'ProductId'
```

Three legitimate constructions, in descending order of preference:

```ts
// 1 — a parse at a boundary. The brand rides on validated data. (chapter 02·05b)
export const ProductId = z.number().int().positive().brand<'ProductId'>();

// 2 — a checked constructor, for values that never see a schema
export function productId(n: number): ProductId {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`bad product id: ${n}`);
  return n as ProductId;                     // the one assertion, inside the check
}

// 3 — an unchecked assertion, confined to a mapper
const id = row.id as ProductId;              // acceptable only next to the query that produced it
```

📌 **Every construction bottoms out in an assertion**, because there is no
runtime representation to produce. What separates the three is how much
evidence sits next to it — a parse, a check, or nothing.

## What a brand survives, and what it does not

| Operation | Brand survives? |
|---|---|
| `Exclude<ProductId \| OrderId, OrderId>` | ✅ — filtering a union does not touch members |
| `NonNullable<ProductId \| null>` | ✅ — `T & {}` keeps the intersection |
| Passing to `(n: number) => …` | ✅ (it *is* a number) — and the brand is gone in the callee |
| `id + 1` | ❌ — arithmetic gives a plain `number` |
| `JSON.parse(JSON.stringify(id))` | ❌ — nothing exists at run time to survive |
| `Pick<Order, 'id'>` where `id: ProductId` | ✅ — the property type is copied intact |
| `Omit<BrandedObject, 'k'>` on an object-level brand | ⚠️ — see the gotcha |

🔴 **Arithmetic is the one that surprises people.** `total_cents + shipping` on
two `Cents` values gives a plain `number`, so a branded `Cents` type stops you
mixing cents with dollars at *signature boundaries* and does nothing inside an
expression. If arithmetic safety is the goal, the brand has to live on a
wrapper object with methods, and that is a much larger commitment than a type
alias.

## Where this app brands, and where it declines

**Brands:** `ProductId`, `OrderId`, `CartId`, `UserId` — the four that appear
together in checkout's signatures, which is the whole justification. Chapter
02·05b put it exactly: *"This app brands the ids that appear together in a
signature … and leaves everything else a plain number."*

**Declines:** `Cents`, `Slug`, `Email`. Each is defensible on its own and each
costs a construction site at every literal, and the combination is a codebase
where every value needs a constructor call. **A brand that is asserted away in
half the codebase is a false guarantee** — the same sentence chapter 02·05b
ended on, and the reason the list is four items long.

⚠️ **`product_ids: number[]` in the error extras is a deliberate decline too**
([chapter 07·04b](../07-the-typed-api-client/04b-narrowing-errorbody-by-code.md)):
branding one side of a comparison whose other side is a plain number buys a
cast, not a guarantee.

## Gotchas

**★ Every construction is an assertion; the only variable is what stands next
to it.** There is no runtime value to build, so `n as ProductId` appears
somewhere in every path. Confine it to a parse or a checked constructor, and
treat a bare assertion in application code as a review comment.

**★ A brand made from a string-keyed property is forgeable.**
`type ProductId = number & {__brand: 'ProductId'}` can be satisfied by anyone
writing `{__brand: 'ProductId'}`-shaped code, and — worse — the property name
appears in autocompletion, inviting exactly that. A module-private
`declare const brand: unique symbol` cannot be named from outside.

**★ Arithmetic strips the brand silently.** `a + b` on two `Cents` is a
`number`, and the result assigned back to a `Cents` variable is an error at the
assignment rather than at the arithmetic, so the diagnostic points at the wrong
line. Money is the classic case, and it is the classic case *against* branding
primitives you compute with.

**★ A brand does not survive the wire.** `JSON.stringify` writes a number and
`JSON.parse` reads one, so a branded id sent to the server and read back is
plain. Re-branding on the way in is the parse's job — which is why
`z.number().brand<'ProductId'>()` at the boundary is a better arrangement than
a hand-made brand plus a cast.

**★ `.brand()` with no type argument does nothing at all.** zod's declaration
is `brand<T extends PropertyKey = PropertyKey, …>(value?: T): PropertyKey
extends T ? this : $ZodBranded<this, T, Dir>` — with the default in place the
condition is true and the method returns `this`, unbranded. `z.number().brand()`
compiles, looks branded, and prevents nothing.

**★ An object-level brand becomes a real key under a mapped type.** If you
brand an *object* type — `type Order = {…} & {readonly [brand]: 'Order'}` —
then `keyof` includes the symbol, and `Pick`/`Omit` map over it like any other
property. The derived type keeps the phantom key as a required property, so a
literal cannot satisfy it without an assertion. Brand primitives; for objects, a
discriminant property with a real value is both cheaper and visible at run time.

**★ Branded types in a shared package make the client's constructors
awkward.** A React route parameter is a `string`, so a link builder wanting a
`ProductId` needs a parse or a cast on every page. That is *correct* — it
should parse — and it means deciding once whether the brand stops at the API
boundary or reaches the components. Half-branded is worse than either.

**★ Two brands with the same tag are the same type.**
`Brand<number, 'Id'>` in two packages is one type, because the tag is a string
literal in the property's type. That is usually harmless and occasionally
exactly wrong — two services' `'Id'` are not interchangeable. Tag with
something specific: `'storefront:ProductId'`.

**★ A branded parameter does not stop a caller passing a branded value of the
same brand from somewhere unrelated.** The brand says "this went through *a*
check", not "this came from the right place". A `ProductId` from a URL and a
`ProductId` from the cart are the same type, so the guarantee is about the
*kind* of value, never about its provenance.

**★ Branding after the fact is a large diff.** Adding `ProductId` to an
existing codebase means every construction site, every test fixture and every
mock needs a constructor call, and the compiler will find all of them at once.
That is the argument for branding the four ids early or not at all — and for
never starting the exercise on a Friday.

## Interview questions

**★ What is a branded type and what does it cost at run time?**
An intersection of a primitive with a phantom property that exists only in the
type system — `T & {readonly [brand]: 'ProductId'}` with `brand` a
module-private `unique symbol`. At run time it costs nothing and *is* nothing;
zod's docs say the same of their version, calling it a static-only construct.
The cost is at construction: since there is no value to build, every branded
value comes from an assertion, and the discipline is to confine that assertion
to a parse or a checked constructor.

**★ Why a `unique symbol` rather than a string key?**
Because a string-keyed brand is forgeable and discoverable: anyone can write an
object with `__brand: 'ProductId'` and satisfy the type, and the property shows
up in autocompletion inviting exactly that. A `declare const` symbol that is
never exported cannot be named from another module, so the only way to obtain
the type is through the code that produces it.

**★ What does a brand *not* protect?**
Arithmetic, the wire, and provenance. `a + b` on two branded numbers gives a
plain `number`; `JSON.stringify`/`parse` round-trips to a plain number with no
brand to restore; and a `ProductId` parsed from a URL is indistinguishable from
one that came from the cart, because the brand records that a check happened,
not where the value came from. Branding is about signatures, not values.

**★ Which values does this app brand, and why not more?**
The four ids that appear together in the same signatures — `ProductId`,
`OrderId`, `CartId`, `UserId` — because that is where two `number`s are
genuinely confusable. `Cents`, `Slug` and `Email` are each defensible alone and
collectively turn every literal in the codebase into a constructor call, at
which point people start asserting past the brand and the guarantee becomes
false. The rule is: brand the values that get confused, not the values that
could be.

**★ What happens if you brand an object type and then `Pick` from it?**
The phantom key is a real key of the object type, so `keyof` includes it and
mapped types copy it. The derived type therefore still requires the branded
property, and an object literal cannot satisfy it without an assertion — which
is usually a surprise, because the brand was supposed to be invisible. Brands
belong on primitives; an object that needs identity should carry a discriminant
property with a real run-time value.

**★ You inherit a codebase with `type ProductId = number`. What is the
migration?**
Change the alias to a brand, add a constructor and a parse at each boundary,
and then work through the compile errors — every construction site, fixture and
mock at once. There is no incremental version, because a partially branded type
is one where half the code asserts past it, and an asserted brand guarantees
nothing. That "all at once" property is the argument for branding the ids at
the start of a project, and for scoping the exercise to the four that matter.

---

← Prev: [`keyof` and indexed access](08-keyof-and-indexed-access.md) ·
[Overview](README.md) ·
Phase index: [Phase 6 — TypeScript across the stack](../README.md)
