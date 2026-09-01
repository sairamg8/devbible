---
title: "A runtime parse of database rows is spent where a wrong type costs money and nowhere else, because assurance is a budget"
sidebar_label: "05b · Where the parse pays"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations in this repo
> (`classic/parse.d.ts`), the **`@types/pg`** declarations on DefinitelyTyped,
> and the
> [PostgreSQL 17 `information_schema.columns` reference](https://www.postgresql.org/docs/17/infoschema-columns.html).
> **TypeScript 7.0.2**, zod **4.4.3**, `pg` **8.x**, PostgreSQL **17**.
> The transaction being protected is
> [1·06's](../../phase-1-database/06-the-checkout-transaction/01-the-transaction.md);
> the ORM-free decision is
> [2·02's](../../phase-2-node-services/02-the-data-layer.md).

**Two levels of assurance are free and the third is not, so the third is spent
unevenly on purpose.** [The previous chunk](05-closing-the-loop.md) built the
catalogue parity test, which catches everything the *database* can tell you
about. This one adds the only check that catches what the *driver* does, prices
it honestly, and then argues against the two obvious ways of deleting the whole
problem — because both of them are right at a scale this app is not at.

## Level 3 — a runtime parse, on money only

For the queries where a wrong type costs money, the type is not the last word:

```ts
// db/checkout.ts
import {z} from 'zod';

const CheckoutItemRow = z.object({
  product_id:  z.number().int().positive(),
  quantity:    z.number().int().positive(),
  price_cents: z.number().int().nonnegative(),   // ← catches string bigints
  stock:       z.number().int().nonnegative(),
});
export type CheckoutItemRow = z.infer<typeof CheckoutItemRow>;

const {rows} = await tx.query(
  `select ci.product_id, ci.quantity, p.price_cents, p.stock
     from cart_items ci join products p on p.id = ci.product_id
    where ci.cart_id = $1
    order by ci.product_id
      for update of p`,
  [cartId],
);
const items = z.array(CheckoutItemRow).parse(rows);
```

Note there is **no type parameter on `query` here** — the schema does the
naming, `z.infer` produces the type, and the assertion is gone. The parse costs
one validation pass over a cart's worth of rows, inside a transaction that
already holds row locks, and it catches:

- a missing `INT8` type parser (`price_cents` arrives as `'1999'` and fails
  `z.number()`),
- a `numeric` column introduced by a well-meaning migration,
- a `null` where the query's shape says there cannot be one,
- a renamed column, because the property is absent and `z.number()` rejects
  `undefined`.

**Every one of those is a wrong-charge bug that levels 1 and 2 would let
through.** That is the whole justification, and it is why the same treatment is
*not* applied to the catalog grid: a wrong `cover` is a missing image.

📌 **This inverts chapter 02's arrow inside the data layer.** Everywhere else in
this app the schema describes untrusted input; here it describes the *database's
own output*, which is trusted-but-configuration-dependent. The pattern is
identical and the justification is different: not "someone might attack this"
but "the driver's configuration is a runtime fact the compiler cannot see".

## The allocation, stated once

| Query | Level | Because |
|---|---|---|
| `checkout`'s locked read | 1 + 2 + **3** | prices and stock — wrong means money |
| `orders.byUser`, order detail | 1 + 2 | totals shown to a user; contract test covers the wire shape |
| `listProducts`, search, categories | 1 | a wrong field is a cosmetic defect on a cached read |
| dashboard aggregates | 1 + 2 | `sum()`'s `numeric` surprise is exactly what level 2 catches |
| `sessions` lookups | 1 + 2 | nullability of `user_id` is the guest/account distinction |

⚠️ **Do not read this table as "level 3 is better".** A parse on the catalog
query would run on the hottest read in the app to catch a class of bug whose
worst outcome is a broken image. Assurance is a budget; spending it evenly is
the same mistake as not spending it.

## What about generating the row types?

The honest options, and why this app does not take them:

- **Generate types from `information_schema`.** Removes the hand-maintained
  `CLAIMED` table and gives *table*-shaped types — which
  [chunk 02](02-a-row-type-per-query.md) argued against, because queries select
  computed columns and joins. Generated table types plus hand-written query
  types is two systems.
- **Generate types from the queries themselves**, by preparing each statement
  and reading `RowDescription` field OIDs. This is the technically correct
  answer: the database tells you the exact result shape of the exact SQL. It
  requires a live database in the build, a mapping from OID to TypeScript type
  that must agree with the installed type parsers, and a build step that fails
  when the database is unavailable. **For an app with roughly thirty queries
  the cost exceeds the benefit** — and the cost is not the code, it is the
  permanent coupling of `tsc` to a running Postgres.
- **Adopt a query builder or ORM.** Out of scope by the track's founding
  decision; the trade-off is argued in
  [2·02](../../phase-2-node-services/02-the-data-layer.md).

🔴 **The decision, plainly: hand-written row types, a catalogue parity test, and
a runtime parse where money is involved.** If this app grew to three hundred
queries, the OID-based generation would become correct — and the migration would
be mechanical, because the row types are already one-per-query and already
adjacent to their SQL.

## Gotchas

**★ Runtime-parsing rows inside a transaction lengthens the lock window.**
`for update of p` holds row locks until commit, and the parse happens between
the read and the update. It is a small, bounded cost for a cart-sized array, and
it is a cost — worth knowing before someone applies the same pattern to a
10,000-row report inside a transaction.

**★ `z.array(Row).parse(rows)` copies the array.** The parsed result is a new
array of new objects, so any code holding the original `rows` is looking at
different objects. In a function that reads, parses and returns, this is
invisible; in one that also mutates `rows`, it is a bug that reads as a caching
problem.

**★ Turning the parse on and leaving the `query<Row>` parameter in place is
belt and braces that hides a mismatch.** If the type parameter says one thing
and the schema another, the schema wins at run time and the parameter wins in
the editor — a disagreement with no error. Where the parse exists, delete the
type parameter and let `z.infer` be the only source.

**★ A schema-parsed row type and a hand-written one look identical at every
call site, which makes the level invisible.** Nothing in `items.price_cents`
tells a reader whether that number was parsed or asserted. Name the schema
after the query and keep it in the same file as the query — and put the level in
one table, as above, so "is this path protected?" is a lookup rather than an
archaeology exercise.

**★ Parsing turns a driver misconfiguration into a 500 rather than a wrong
charge, and someone will call that a regression.** It is the entire point. A
`ZodError` from the checkout read reaches
[the error contract](../../phase-3-express-api/09-the-error-contract.md) as an
unclassified error and becomes a 500 with a loud log — which is correct, because
the alternative was charging the wrong amount. Give it a classify row so the log
says `ROW_SHAPE` rather than `INTERNAL`, but do not make it a 4xx: nothing the
client did caused it.

## Interview questions

**★ Why not generate row types from the database and delete the problem?**
Because the two generation strategies each buy the wrong thing at this scale.
Generating from `information_schema` gives table-shaped types, and this app's
queries return join- and computation-shaped rows. Generating from prepared
statements gives exactly the right shape and permanently couples the type-check
step to a live database, with an OID-to-TypeScript mapping that must be kept in
sync with the installed type parsers. At thirty queries the coupling costs more
than the drift; at three hundred it would not.

**★ Why is the runtime parse applied to the checkout query and not the catalog
query?**
Because assurance is a budget and the two failures cost differently. A wrong
type in the checkout read is a wrong charge; in the catalog read it is a missing
image on a cached page that is hit orders of magnitude more often. Spending the
same effort on both would mean either under-protecting the money path or taxing
the hot path to catch a cosmetic defect.

**★ What class of bug does the runtime parse catch that the parity test cannot?**
Anything that depends on the driver's *configuration* rather than the database's
schema. The canonical one is a missing `INT8` type parser: the catalogue
correctly reports `price_cents` as `bigint`, the parity test passes, and the
value arrives as the string `'1999'`. `z.number()` rejects it; the type
parameter would not have.

**★ Why does the parsed version drop the `query<Row>` type parameter?**
Because keeping both creates two sources for one shape, and they can disagree
silently — the editor believes the parameter, the process believes the schema.
With the parse in place, `z.infer<typeof CheckoutItemRow>` is the type and the
assertion is gone entirely, which is the only configuration where the compile-
time and run-time claims cannot diverge.

**★ You are told to "just add the parse everywhere, it is only a few
microseconds". What is the argument against?**
That the cost is not the microseconds, it is the coupling: a parse is a second
declaration of every row shape, so every query gains a schema that must be
maintained alongside its SQL. On the money path that duplication buys a
guarantee worth having. On a cached catalog read hit orders of magnitude more
often, it buys protection against a missing image, and it doubles the number of
places a column rename has to land. Uneven spending is the decision, not an
oversight.

---

← Prev: [Closing the loop in CI](05-closing-the-loop.md) ·
[Overview](README.md) ·
Next chapter → [Discriminated unions](../04-discriminated-unions/README.md)
