---
title: "A response schema only becomes a check when it appears in the type of the function that builds the response, and the mapper is that function"
sidebar_label: "04 · Response schemas & mappers"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo (`Send`, `Response`) and the **zod 4.4.3** declarations
> (`classic/iso.d.ts`, `classic/schemas.d.ts`). **TypeScript 7.0.2**, Express
> **5**. Concept homes:
> [TypeScript 10·09 — excess property checks](../../../../typescript/pages/phase-10-strictness/09-excess-property-checks/README.md),
> [TypeScript 1·04 — object types](../../../../typescript/pages/phase-1-type-vocabulary/04-object-types.md).
> The mappers being typed are
> [3·05's `productSummary` and `productDetail`](../../phase-3-express-api/05-catalog-endpoints.md);
> the enforcement asymmetry is
> [3·12's](../../phase-3-express-api/12-openapi.md).

**3·12 admitted the gap honestly: request schemas run, response schemas are
declared and nothing validates `res.json`.** This chunk closes most of that gap
without adding a single runtime check, by putting the response schema's inferred
type into the *signature of the mapper*. The mapper is the only place a database
row becomes public JSON; make its return type `z.infer<typeof ProductSummary>`
and every drift between the schema, the row and the wire is a compile error in
one small file. What remains uncloseable — and it is a real remainder — is
named at the end.

## The mapper, typed

```ts
// apps/api/src/routes/catalog.schemas.ts
import {z} from 'zod';

export const ProductSummary = z.object({
  slug:        z.string(),
  name:        z.string(),
  price_cents: z.number().int(),
  in_stock:    z.boolean(),
  cover_url:   z.string().nullable(),
});
export type ProductSummary = z.infer<typeof ProductSummary>;

export const ProductPage = z.object({
  items:       z.array(ProductSummary),
  next_cursor: z.string().nullable(),
});
export type ProductPage = z.infer<typeof ProductPage>;
```

```ts
// apps/api/src/routes/catalog.mappers.ts
import type {ProductListRow} from '../db/products.js';   // chapter 03's row type
import type {ProductSummary} from './catalog.schemas.js';

export function productSummary(p: ProductListRow): ProductSummary {
  return {
    slug: p.slug,
    name: p.name,
    price_cents: p.price_cents,
    in_stock: p.stock > 0,
    cover_url: p.cover ? `/uploads/images/${p.cover}` : null,
  };
}
```

Five lines and three separate guarantees:

1. **The row type constrains the input.** Rename `price_cents` in the schema,
   regenerate or hand-edit `ProductListRow`, and `p.price_cents` stops
   resolving — in the mapper, at build time.
2. **The response type constrains the output.** Forget `in_stock` and the
   return object is missing a required property.
3. **`in_stock: p.stock > 0` is where the contract decision lives.** 3·05
   argued that the count is not shipped; the type now says so. A future
   `cover_url: p.cover` (forgetting the URL prefix) is still valid — types
   cannot check semantics — but a future `stock: p.stock` cannot compile,
   because `ProductSummary` has no such key.

🔴 **The explicit return annotation is the whole mechanism.** Delete
`: ProductSummary` and the function's return type is inferred from its body,
which is to say: whatever it returns is correct. Every guarantee above
disappears and the file still compiles, forever. This is the single most
important line in the chapter and it looks like noise.

## Why `satisfies` is the wrong tool here, and where it is right

```ts
// ✗ looks equivalent, is not
export function productSummary(p: ProductListRow) {
  return {
    slug: p.slug, name: p.name, price_cents: p.price_cents,
    in_stock: p.stock > 0, cover_url: p.cover ? `/uploads/${p.cover}` : null,
    stock: p.stock,                       // ← caught: excess property
  } satisfies ProductSummary;
}
```

`satisfies` does catch the excess property, and it keeps the literal type — so
callers see `cover_url: string` rather than `string | null` when the branch is
statically known. That last part is the problem: **the function's public type
is now narrower than the contract**, and a caller can come to depend on a
narrowness the schema never promised. For a mapper whose entire job is to
produce exactly the contract's shape, the annotation is correct and `satisfies`
is a subtly worse fit.

`satisfies` earns its place on **tables**, not on mappers — the sort table, the
error-code map, the route registry. That argument is
**chapter 08 · Utility types in app code** *(not written yet)*.

## The excess-property hole you will hit within a week

```ts
export function productDetail(p: ProductDetailRow): ProductDetail {
  const body = {
    ...productSummary(p),
    description: p.description,
    attributes: p.attributes,
    images: p.images.map((i) => `/uploads/images/${i.object_key}`),
    reviews: p.reviews,
    internal_notes: p.internal_notes,     // ← NOT caught
  };
  return body;
}
```

Excess property checking applies to **object literals assigned directly** to a
typed target. Assign the literal to a `const` first and return the variable, and
the check is gone: the object is now a *value* with a wider type, and a wider
type is assignable to a narrower one under structural typing as long as every
required property is present. The internal note ships.

**Fix — return the literal, or annotate the variable:**

```ts
  const body: ProductDetail = { … };      // annotate the variable
  return body;
```

```ts
  return { … };                           // or just return the literal
```

⚠️ This is not a zod problem and not an Express problem. It is
[structural typing](../../../../typescript/pages/phase-1-type-vocabulary/09-structural-typing.md)
behaving exactly as documented, and it is why "the mapper is the only place a
row becomes JSON" has to be enforced by review as well as by types. Spread
syntax makes it worse: `{...row}` in a mapper defeats the entire design in one
character.

## `res.json` checks nothing by default

Verbatim from `@types/express-serve-static-core@5.1.3`:

```ts
export type Send<ResBody = any, T = Response<ResBody>> = (body?: ResBody) => T;

export interface Response<
    ResBody = any,
    LocalsObj extends Record<string, any> = Record<string, any>,
    StatusCode extends number = number,
> extends http.ServerResponse, Express.Response { … }
```

`ResBody` defaults to `any`, so `res.json(literallyAnything)` compiles in every
unannotated handler in every Express codebase. Two ways to make it mean
something, and this app takes the second:

- **Annotate the response**: `Response<ProductPage>` per handler. Works,
  requires an annotation on every route, and is silently defeated the moment
  someone writes `res` without the generic.
- **Never call `res.json` in a handler.** The
  [route helper](03b-the-route-helper.md) takes the response schema and types
  the handler's return, so the only `res.json` in the API is inside the helper.
  One call site, one place to be right.

## Gotchas

**★ Deleting the mapper's return annotation deletes the contract silently.**
An inferred return type makes any returned object correct by definition. There
is no error, no warning, and the function still looks like it maps a row to a
response. Every mapper in `routes/*.mappers.ts` carries an explicit return type,
and the lint rule `@typescript-eslint/explicit-module-boundary-types` scoped to
that directory is what keeps it true.

**★ Assigning the literal to a variable turns off excess property checking.**
`const body = {…}; return body;` ships extra fields. Return the literal, or
annotate the variable. The spread `{...row, …}` is the same bug in a friendlier
costume and defeats the mapper design entirely.

**★ `res.json` accepts anything because `ResBody` defaults to `any`.**
An unannotated `Response` types `json` as `(body?: any) => Response`. Every
handler that calls `res.json` directly is outside the type system. Keep the one
call inside the route helper.

## Interview questions

**★ 3·12 says response schemas are "declared, not enforced". What does typing
the mapper change about that?**
It moves the enforcement from run time to build time for the one thing that
actually constructs a response. Nothing validates the bytes leaving `res.json`,
but the object handed to it has a type checked against `z.infer` of the response
schema, and the only function producing that object is the mapper. The
remaining hole is code that bypasses the mapper, which is why exactly one place
in the API calls `res.json`.

**★ Why is an explicit return annotation on a mapper more important than an
annotation almost anywhere else?**
Because a mapper's job *is* its return type. With inference, the function
trivially satisfies itself and the response schema becomes documentation. It is
the rare case where leaving out an annotation does not weaken a check — it
deletes it.

**★ Explain the excess-property hole in one sentence, and give the fix.**
Excess property checking fires on object literals assigned directly to a typed
target, so introducing a variable first widens the object and lets extra fields
through; fix it by returning the literal or by annotating the variable.

**★ Why does `res.json` accept anything, and what does this app do about it?**
`Response`'s `ResBody` parameter defaults to `any`, and `json` is `Send<ResBody>
= (body?: ResBody) => T`, so an unannotated response types its body as `any`.
The app never calls `res.json` in a handler: the route helper takes the response
schema and types the handler's return, so there is one call site and it is
typed by construction.

---

← Prev: [The route helper](03b-the-route-helper.md) ·
[Overview](README.md) ·
Next → [Wire types, envelopes and the remainder](04b-wire-types-and-envelopes.md)
