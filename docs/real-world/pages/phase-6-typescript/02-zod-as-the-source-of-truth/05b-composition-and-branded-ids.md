---
title: "Deriving a schema is checked where deriving a type is not, and branding is the only way two bigint ids stop being the same type"
sidebar_label: "05b · Composition & branded ids"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`classic/schemas.d.ts` — `ZodObject.pick`, `.omit`, `.extend`, `.merge`,
> `.partial`, `.required`; `ZodType.brand`) and the
> [zod API reference](https://zod.dev/api) on branded types. **TypeScript
> 7.0.2**, zod **4.4.3**. Concept homes:
> [TypeScript 5·03 — utility types](../../../../typescript/pages/phase-5-type-level/03-utility-types/README.md),
> [TypeScript 1·09 — structural typing](../../../../typescript/pages/phase-1-type-vocabulary/09-structural-typing.md).
> The ids being branded are the `bigint` keys of
> [1·01's schema](../../phase-1-database/01-the-schema/01-conventions-identity-catalog.md).

**A schema derived from another schema stays related to it; a type derived from
a type does too, but zod's derivations are *checked* where TypeScript's are
not.** `Order.omit({usr_id: true})` fails to compile and `Omit<Order,
'usr_id'>` does not. That asymmetry is a good enough reason on its own to
derive on the schema and read the type off the result. The second half of this
chunk is the other composition problem this app has: four `bigint` ids that are
all `number`, all interchangeable, and all passed to the same checkout
function.

## Composition: derive schemas, do not re-declare them

zod's object methods mirror TypeScript's utility types, and the pairing is the
point — a derived schema and a derived type stay related.

```ts
export const Order = z.object({
  id: z.number().int(),
  user_id: z.number().int(),
  status: OrderStatusSchema,
  address: AddressSchema,
  total_cents: z.number().int(),
  created_at: z.iso.datetime(),
});

// what the client sees in a list
export const OrderSummary = Order.pick({
  id: true, status: true, total_cents: true, created_at: true,
});

// what the checkout endpoint accepts — server-owned fields removed
export const CreateOrderBody = Order
  .omit({id: true, user_id: true, status: true, total_cents: true, created_at: true})
  .extend({cart_id: z.number().int(), idempotency_key: z.string().uuid()})
  .strict();
```

**zod's masks reject unknown keys, and TypeScript's `Omit` does not.** The
declaration, verbatim:

```ts
omit<M extends util.Mask<keyof Shape>>(
  mask: M & Record<Exclude<keyof M, keyof Shape>, never>
): ZodObject<util.Flatten<Omit<Shape, Extract<keyof Shape, keyof M>>>, Config>;
```

The `& Record<Exclude<keyof M, keyof Shape>, never>` intersection is what makes
`Order.omit({usr_id: true})` a compile error. `Omit<Order, 'usr_id'>` in plain
TypeScript compiles happily and silently omits nothing —
**chapter 08 · Utility types in app code** *(not written yet)* carries that
comparison in full. **Prefer deriving on the schema over deriving on the
type**: the schema derivation is checked and the runtime parser follows it for
free.

⚠️ **`.merge()` is deprecated in zod 4** — verbatim, `/** @deprecated Use
[`A.extend(B.shape)`](https://zod.dev/api?id=extend) instead. */`. Use
`.extend(Other.shape)`.

⚠️ **`.partial()` is not the schema you want for a PATCH endpoint.** It makes
every key optional, including the ones a client must never change. The admin
product update is `Product.pick({name: true, description: true, price_cents:
true, stock: true}).partial()` — pick first, then loosen. `.partial()` alone on
a full schema is mass assignment with a type.

## Branded ids: making two `number`s refuse to mix

Every id in this schema is a `bigint` arriving as a `number`. So `productId`,
`orderId`, `userId` and `cartId` are all `number`, and the compiler will let you
pass any of them anywhere another is expected. That is not hypothetical in a
checkout path that juggles four of them in one function.

The zod docs are explicit about what branding is:

> *"branded types do not affect the runtime result of `.parse`. It is a
> static-only construct."*

```ts
// packages/shared/src/ids.ts
export const ProductId = z.number().int().positive().brand<'ProductId'>();
export type ProductId = z.infer<typeof ProductId>;

export const OrderId = z.number().int().positive().brand<'OrderId'>();
export type OrderId = z.infer<typeof OrderId>;
```

```ts
function addToCart(cartId: CartId, productId: ProductId, qty: number) { … }

addToCart(orderId, productId, 1);
//        ^ Argument of type 'OrderId' is not assignable to parameter of type 'CartId'
```

**The cost, stated plainly, because it is real:** a branded type cannot be
produced from a plain `number` without going through the parse — which is fine
at the boundary, where a parse already happens, and painful everywhere else. In
particular a row type's `id: number` is not a `ProductId`, so either the row
types brand their ids too (more parsing at the data layer) or the mapper casts
once. This app brands **the ids that appear together in a signature** —
`ProductId`, `OrderId`, `CartId`, `UserId` — and leaves everything else a plain
number. Branding every scalar is a project that never ends and a codebase
nobody wants to edit.

## Gotchas

**★ `.brand()` with no type argument does nothing at all.**
The declaration is
`brand<T extends PropertyKey = PropertyKey, …>(value?: T): PropertyKey extends T ? this : core.$ZodBranded<this, T, Dir>`.
With `T` left at its default, `PropertyKey extends PropertyKey` is true and the
method returns `this` — the same unbranded schema. `z.number().brand()` compiles,
looks branded, and prevents nothing. Always pass the parameter:
`.brand<'ProductId'>()`.

**★ `.partial()` on a full schema is mass assignment.**
It optionalises `id`, `user_id`, `status` and `total_cents` along with the
fields the client may actually set, and `.strict()` no longer helps because the
keys *are* declared. Pick the mutable subset first, then `.partial()`.

**★ `.pick()` masks are `true`, not the field name.**
`Order.pick(['id', 'status'])` is a type error with a message about
`util.Mask`, which reads oddly the first time. The mask is an object —
`{id: true, status: true}` — because the same shape supports `false` for the
inverse in some methods, and because it composes with `Record` intersections to
reject unknown keys.

**★ A branded type in a shared package makes the client's constructors
awkward.** The React code that builds a link to `/products/:id` now needs a
`ProductId`, and it has a `number` from a URL parameter. That is correct — it
*should* parse — but it means the client's route params get parsed too, or the
brand stops at the API boundary. Decide which, once, and write it down; a brand
that is asserted away in half the codebase is a false guarantee.

## Interview questions

**★ Why derive `OrderSummary` from `Order` with `.pick()` rather than writing a
second schema?**
Because a second schema is a second declaration that can disagree, and zod's
mask is checked — `.pick({totl_cents: true})` fails to compile, thanks to the
`Record<Exclude<keyof M, keyof Shape>, never>` intersection in its signature.
Deriving keeps one source and gets the runtime parser for free.

**★ What does `.brand()` actually do, and what does it cost?**
Nothing at run time — the docs call it a static-only construct — and at build
time it makes two structurally identical types unassignable, which is exactly
what you want for four `number` ids that appear in the same function signature.
The cost is construction: a branded value can only come from a parse or an
assertion, so anywhere the value originates outside the boundary you either add
a parse or you cast. Brand the ids that get confused; do not brand everything.

**★ Someone writes `z.number().brand()` and the types do not change. Why?**
Because the type parameter defaults to `PropertyKey`, and the method's return
type is conditional: `PropertyKey extends T ? this : $ZodBranded<…>`. With the
default in place the condition is true and the method returns the schema
unchanged. The brand needs an explicit tag — `.brand<'ProductId'>()`.

**★ When would you *not* brand an id?**
When it never shares a signature with another id, and when branding it would
force parses into code that has no boundary. A `review_images.id` appears in one
query and one response; branding it buys nothing and costs a parse at the data
layer. The rule that scales is: brand the values that get *confused*, which in
practice means the ones that appear together in a parameter list.

---

← Prev: [The status enum, four ways](05-the-status-enum-four-ways.md) ·
[Overview](README.md) ·
Next chapter → [Typing raw `pg` results](../03-typing-raw-pg-results/README.md)
