---
title: "Chapter 05 declined to type the per-code extras on the server and named this page as where the client does it, so a mapped type over the code union turns catchall unknowns into product_ids: number[] under exactly one case label"
sidebar_label: "04b · Narrowing ErrorBody by code"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo
> (`ZodObject.extend`, `ZodObject.catchall`, `_enum`'s
> `const T extends readonly string[]`, `ZodSafeParseResult`), the TypeScript
> handbook on
> [mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html),
> [indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)
> and
> [conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html);
> and the error contract fixed in
> [chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md)
priced typing the per-code extras on the server, declined it — "an `ApiError`
subclass per code, which is more ceremony than twenty-one codes justify" — and
said the client narrows them by `code`.** This is that. The server's
`ErrorBody` ends in `.catchall(z.unknown())`, so `product_ids` on an
`OUT_OF_STOCK` and `retry_after_seconds` on a `RATE_LIMITED` cross the wire
untyped. Five codes carry extras, sixteen do not, and one mapped type turns the
whole set into a discriminated union that a `switch` narrows exactly like the
order status. [04c](04c-parsing-and-rendering-api-errors.md) then builds the
parser that produces it, the panel that reads it, and the test that proves the
two sides still agree.

## The contract, as chapter 05 left it

```ts
// packages/shared/src/api.ts — unchanged from 05·03c
export const ERROR_CODES = [
  'VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND',
  'OUT_OF_STOCK', 'EMPTY_CART', 'PAYMENT_DECLINED', 'INVALID_TRANSITION',
  'STALE_STATUS', 'EMAIL_TAKEN', 'ALREADY_REVIEWED', 'BAD_REFERENCE',
  'BAD_CURSOR', 'BAD_SIGNATURE', 'TOO_MANY_FILES', 'TOO_LARGE', 'BAD_TYPE',
  'PAYLOAD_TOO_LARGE', 'RATE_LIMITED', 'TIMEOUT', 'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorBody = z.object({
  type: z.string(), title: z.string(), status: z.number().int(),
  code: z.enum(ERROR_CODES), request_id: z.string(),
}).catchall(z.unknown());
```

## The extras table, and the type it generates

```ts
// packages/shared/src/error-extras.ts
export const ERROR_EXTRAS = {
  OUT_OF_STOCK:     z.object({product_ids: z.array(z.number().int())}),
  PAYMENT_DECLINED: z.object({decline_code: z.string()}),
  STALE_STATUS:     z.object({current: OrderStatusSchema}),
  RATE_LIMITED:     z.object({retry_after_seconds: z.number().int()}),
  VALIDATION:       z.object({issues: z.array(FieldIssue)}),
} as const satisfies Partial<Record<ErrorCode, z.ZodType>>;
```

```ts
type ErrorBase = Omit<z.output<typeof ErrorBody>, 'code'>;
type Extras = typeof ERROR_EXTRAS;

export type ApiError = {
  [C in ErrorCode]: ErrorBase & {code: C} &
    (C extends keyof Extras ? z.output<Extras[C]> : {})
}[ErrorCode];
```

Read the second declaration in three steps:

1. **`{[C in ErrorCode]: …}`** builds an object type with one property per
   code — a mapped type over the union of twenty-one string literals.
2. **Each property's type is that code's error shape**: the common fields, plus
   `code: C` as a *literal*, plus the extras if that code has any.
3. **`[ErrorCode]` at the end is an indexed access over the whole union**,
   which collapses the object back into the union of its property types. That
   idiom — build a map, then index it by the same union — is how you write a
   union whose members are computed per member.

`C extends keyof Extras ? … : {}` is a conditional inside the mapped type, so
`OUT_OF_STOCK` gains `{product_ids: number[]}` and `NOT_FOUND` gains `{}`.

📌 **`as const satisfies Partial<Record<ErrorCode, z.ZodType>>` is doing two
jobs.** `satisfies` checks that every key is a real `ErrorCode` — so a table
entry for `'OUT_OF_STOK'` fails to compile — while leaving `keyof Extras` as
the five literal keys, which the conditional above needs. An annotation would
make `keyof Extras` the whole `ErrorCode` union and every code would look as
though it had extras. Same lesson as
[the route map](03-the-route-map.md), one chunk later.

## Gotchas

**★ The mapped-type-then-index idiom is the whole trick, and it is easy to
mistype.** `{[C in ErrorCode]: …}[ErrorCode]` produces the union; dropping the
trailing `[ErrorCode]` leaves you with an object type whose properties are the
members, which is not a union and will not narrow. The tell is a `switch` on
`error.code` that fails with "property `code` does not exist".

**★ Annotating `ERROR_EXTRAS` instead of using `satisfies` makes every code
look as though it has extras.** With `const ERROR_EXTRAS: Partial<Record<
ErrorCode, z.ZodType>>`, `keyof Extras` is the full `ErrorCode` union, so
`C extends keyof Extras` is true for all twenty-one and `Extras[C]` is
`z.ZodType | undefined` — giving every member the extras of none of them.

**★ `Omit<z.output<typeof ErrorBody>, 'code'>` also drops the catchall index
signature's usefulness, and that is fine.** `ErrorBody` has
`.catchall(z.unknown())`, so its output type carries an index signature for the
extras; `ErrorBase` keeps it, which means `error.anything` is `unknown` rather
than an error on members without extras. That is a weaker guarantee than a
closed object, and it is the price of a contract that must tolerate fields the
client has not modelled.

**★ `error.current` on `STALE_STATUS` is an `OrderStatus`, so the panel it
feeds must handle all five values.** That is the good kind of coupling: the
extras table imports `OrderStatusSchema`, so adding a sixth status makes the
stale-status panel's own switch incomplete and the build fails — the phase
gate reaching the error path.

**★ `product_ids: number[]` and not `ProductId[]`.** The branded id from
[chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
would require the extras schema to brand, which means the panel's lookup into
the cart is checked. It is a real option and this app declines it: the
`OUT_OF_STOCK` panel matches ids against cart lines that are themselves plain
numbers, so branding one side alone buys a cast rather than a guarantee.

## Interview questions

**★ Chapter 05 refused to type the per-code error extras on the server. Why is
the client a better place for it?**
Because the server's job is to *produce* the extras, one code at a time, in
twenty-one handlers — typing that means a class or a schema per code, and each
handler already knows exactly what it is attaching. The client *consumes* them
in one place, the error panel, where it must decide what to render per code
anyway. So the type earns its keep on the client, where a single switch reads
every variant, and would be ceremony on the server, where each site touches
one.

**★ Explain `{[C in ErrorCode]: …}[ErrorCode]`.**
It is a mapped type immediately indexed by the same union. The mapped type
builds an object with one property per code, each property's type computed for
that code — common fields, `code: C` as a literal, plus a conditional lookup of
that code's extras. Indexing the resulting object by `ErrorCode` yields the
union of all its property types, which is the discriminated union you wanted.
Without the trailing index you have an object type, and `switch (error.code)`
will not compile.

**★ Why `as const satisfies Partial<Record<ErrorCode, z.ZodType>>` on the
extras table?**
`satisfies` checks that every key is a real error code — a typo'd key is a
compile error — while leaving the declared type as the literal object, so
`keyof Extras` is the five codes that actually have extras. That literal
`keyof` is what the conditional `C extends keyof Extras` reads. An annotation
would replace the literal type with the `Partial<Record<…>>`, making `keyof`
the full code union and giving every member extras typed
`z.ZodType | undefined`.

---

← Prev: [Errors as a result](04-errors-as-a-result.md) ·
[Overview](README.md) ·
Next → [Parsing and rendering API errors](04c-parsing-and-rendering-api-errors.md)
