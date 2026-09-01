---
title: "The wire has three types the database does not — string timestamps, integer money and open jsonb — and the response schema is where each one is admitted"
sidebar_label: "04b · Wire types & envelopes"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`classic/iso.d.ts` — `z.iso.datetime`; `classic/schemas.d.ts` — `ZodType`)
> and the [zod JSON Schema docs](https://zod.dev/json-schema) for the list of
> unrepresentable types. **TypeScript 7.0.2**, zod **4.4.3**, PostgreSQL **17**.
> The money and time rules are
> [1·07's](../../phase-1-database/07-money-and-time.md); the jsonb discipline is
> [1·08's](../../phase-1-database/08-jsonb-attributes.md).

**A row type describes what `pg` hands you; a response schema describes what
`JSON.stringify` puts on the socket, and those are three different types apart.**
[The previous chunk](04-response-schemas-and-mappers.md) made the mapper the
one checked seam. This one is about what the mapper has to *convert* on the way
through — and about the envelope generic that every paginated response shares,
whose single rule is the opposite of every other rule in this chapter.

## Dates and money on the wire

Two shapes that look obvious and are not.

**A `Date` is not a wire type.** `pg` hands back `Date` objects for
`timestamptz` columns; `JSON.stringify` turns a `Date` into an ISO-8601 string
via `toJSON`. So the row type says `Date`, the wire carries `string`, and the
response schema must say `string`:

```ts
export const OrderSummary = z.object({
  id: z.number().int(),
  status: OrderStatusSchema,
  total_cents: z.number().int(),
  created_at: z.iso.datetime(),          // string on the wire, always
});
```

If the mapper returns `created_at: row.created_at` — a `Date` — it fails to
compile against `string`, which is exactly the error you want. Writing
`z.date()` in a response schema instead makes the mapper compile and the
*client's* parse fail at run time on a string, and it makes
[3·12's spec generation](../../phase-3-express-api/12-openapi.md) throw, because
`z.date()` is on zod's list of types unrepresentable in JSON Schema. The
conversion belongs in the mapper: `created_at: row.created_at.toISOString()`.

**Money stays an integer, and the type says so.** `z.number().int()` on every
`*_cents` field. The int8 type parser
([1·07](../../phase-1-database/07-money-and-time.md)) is what makes that true at
run time, and **chapter 03** *(not written yet)* is where the type and the
parser are tied together — because a `number` in a row type is a claim about a
driver setting, not about the database.

## The page envelope, generically

Every paginated response has the same envelope, so write it once:

```ts
export function page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export const ProductPage = page(ProductSummary);
export const OrderPage = page(OrderSummary);
export type ProductPage = z.infer<typeof ProductPage>;
```

🔴 **Do not annotate `page`'s return type.** `function page<T extends
z.ZodType>(item: T): z.ZodType` compiles and destroys every caller: `z.infer` of
a bare `z.ZodType` is `unknown`, because its output parameter defaults to
`unknown`. Leave the return type to inference — this is the one place in the
codebase where an explicit return annotation is the bug and inference is the
contract.

## What still cannot be checked

Honest remainder, because the phase gate is about builds and not vibes:

- **Nothing verifies that the mapper's *values* are right.** `in_stock: p.stock
  >= 0` type-checks and is wrong. Types constrain shape, not meaning.
- **Nothing verifies that the schema matches what the client renders**, only
  that both sides refer to the same inferred type. If the client imports its
  own copy, the check evaporates —
  [chapter 1](../01-the-shared-types-package/01-why-a-package.md) is what stops
  that.
- **Nothing runs the response schema in production**, by design. The contract
  test parses real responses with the same schemas
  ([3·12's argument](../../phase-3-express-api/12-openapi.md)), which catches
  the residue — a handler that bypassed the helper, a mapper spreading a row —
  at test time rather than taxing every request.

## Gotchas

**★ A `Date` in a response type is a lie the compiler will not catch if the
schema also says `Date`.** `z.date()` in a response schema makes the mapper
compile with a `Date` and the client's parse fail at run time on a string —
and it makes JSON Schema generation throw, since `z.date()` is unrepresentable.
Use `z.iso.datetime()` and convert in the mapper.

**★ `z.iso.datetime()` validates format, not timezone semantics.** It accepts
an ISO-8601 datetime string; it does not assert UTC. The app's rule that every
instant on the wire is UTC comes from
[1·07](../../phase-1-database/07-money-and-time.md) and from `toISOString()`
always emitting `Z` — not from the schema. If a mapper ever formats a date any
other way, the schema will happily accept it.

**★ Annotating a schema factory's return type makes every caller `unknown`.**
`function page<T extends z.ZodType>(item: T): z.ZodType` is the mistake, and it
produces no error at the definition. The symptom is `z.infer<typeof
ProductPage>` being `unknown` and every consumer failing with a message about
the consumer. Never annotate the return type of a function that builds a
schema.

**★ `z.array(item)` infers `T[]`, and `readonly` never enters the picture.**
The inferred response type is mutable, so a React component can `.sort()` the
array it was handed and mutate the parsed value in place. If that matters, the
client's copy is `readonly` by its own type (`ReadonlyArray<ProductSummary>`) at
the point the API client returns it — the schema cannot express it.

**★ `jsonb` columns infer as whatever you declare, which is a guess.**
`attributes: z.record(z.string(), z.unknown())` is honest;
`attributes: z.any()` is a hole with a type. The
[jsonb discipline](../../phase-1-database/08-jsonb-attributes.md) says the
per-category keys are validated in the admin service where the category is
known — so the *response* schema must stay open, and the component that renders
attributes must handle `unknown`, not `string`.

## Interview questions

**★ Why must a response schema say `string` for a timestamp when the row type
says `Date`?**
Because JSON has no date type and `JSON.stringify` serialises a `Date` through
`toJSON` into an ISO string. The wire carries a string, so the schema — which
the client uses to parse the wire — must say string. Declaring `z.date()`
instead makes the server compile, the client fail at run time, and JSON Schema
generation throw, since dates are unrepresentable in JSON Schema.

**★ When would you annotate a function's return type as `z.ZodType`?**
Never, if any caller needs `z.infer` of the result. `z.ZodType`'s output
parameter defaults to `unknown`, so the annotation erases exactly the
information the schema exists to carry. Schema factories are the one category
of function in this codebase whose return type is always left to inference.

**★ The mapper compiles, the schema matches, and the response is still wrong.
How?**
Because types check shape and not meaning. `in_stock: p.stock >= 0` is always
true and type-checks perfectly; `cover_url: p.cover` without the URL prefix is a
`string` and type-checks. Shape correctness is a floor, not a ceiling — the
contract test that parses a real response and asserts on values is what covers
the rest.

**★ Why is leaving a return type off a schema factory correct, when leaving it
off a mapper is a bug?**
Because the two functions carry information in opposite directions. A mapper's
return type is the contract it must satisfy, so it has to be stated
independently of the body. A schema factory's return type *is* the information
— the precise `ZodObject` with its shape — and any annotation you can write is
necessarily wider than what inference produces, up to and including `z.ZodType`,
whose output parameter is `unknown`.

**★ How does an integer-cents field survive the round trip, and what would
break it?**
The database stores `bigint`; `pg` returns int8 as a string unless a type
parser is installed; the app installs `setTypeParser(INT8, Number)` in the one
pool module; the response schema says `z.number().int()`; JSON carries a
number; the client parses a number. The break is a second pool created
somewhere without the parser — every `price_cents` becomes a string, the
response schema starts rejecting at the contract test, and the type said
`number` the whole time. The type is downstream of a driver setting, which is
why the setting lives in exactly one file.

---

← Prev: [Response schemas and the mappers](04-response-schemas-and-mappers.md) ·
[Overview](README.md) ·
Next → [The status enum, four ways](05-the-status-enum-four-ways.md)
