---
title: "A row type is a claim about the driver's configuration, not about the schema, and the two disagree for bigint, numeric, dates and jsonb"
sidebar_label: "03 · What pg actually returns"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts)),
> the [node-postgres documentation](https://node-postgres.com/features/types),
> and the
> the
> [PostgreSQL 17 data-type reference](https://www.postgresql.org/docs/17/datatype.html)
> and
> [aggregate functions (Table 9.60)](https://www.postgresql.org/docs/17/functions-aggregate.html).
> **TypeScript 7.0.2**, `pg` **8.x**, PostgreSQL **17**. Concept homes:
> [PostgreSQL — Node and `pg`](../../../../postgresql/syllabus/03-node-and-pg.md),
> [1·07 — money and time](../../phase-1-database/07-money-and-time.md).

**`price_cents: number` in a row type is true only because one line ran in one
module at process start.** The column is `bigint`; the driver's default for
`bigint` is a JavaScript **string**; the app installs a type parser that
converts it; and the row type asserts the outcome of that conversion. Delete the
parser, or create a second pool that never sees it, and every `number` in every
row type is a lie the compiler will keep repeating. This chunk is the map of
where the driver's answer and the schema's answer differ, so a row type can be
written against the driver instead of against the DDL.

## The one line the types depend on

```ts
// db/pool.ts — 2·02 owns this file
import pg from 'pg';

pg.types.setTypeParser(pg.types.builtins.INT8, (v: string) => Number(v));
```

`int8` (`bigint`) arrives as a string by default because JavaScript's `number`
cannot represent the full 64-bit range exactly, and the driver refuses to lose
precision silently. [1·07](../../phase-1-database/07-money-and-time.md) argues
why this app opts into numbers anyway: every `int8` in this schema is a cent
count or an identity key, and both stay far below `Number.MAX_SAFE_INTEGER`.

🔴 **That decision is a precondition of every row type in `db/`.** It is worth a
comment in the pool module saying so, and it is worth the parity check in
[chunk 05](05-closing-the-loop.md) that asserts a sampled `price_cents` is
`typeof 'number'` — because the failure mode is not an exception. It is string
concatenation: `19.99 + 29.99` cents becomes `"19992999"`, and every type on the
path still says `number`.

## The mapping table, as this app configures it

| Postgres type | Default from `pg` | This app's row type | Why |
|---|---|---|---|
| `bigint` / `int8` | **`string`** | `number` | the `INT8` parser above |
| `integer`, `smallint` | `number` | `number` | fits exactly, parsed by default |
| `numeric` / `decimal` | **`string`** | 🔴 not used | unparsed on purpose — see below |
| `text`, `citext`, `varchar` | `string` | `string` | |
| `boolean` | `boolean` | `boolean` | |
| `timestamptz`, `timestamp` | `Date` | `Date` | converted in the mapper to ISO |
| `date` | `Date` | `Date` | ⚠️ a `Date` at local midnight — see the gotcha |
| `jsonb`, `json` | parsed value, typed `any` | **`unknown`** | the driver `JSON.parse`s; the shape is yours to prove |
| `uuid` | `string` | `string` | |
| enum types (`order_status`) | `string` | `OrderStatus` | an assertion — the parity test of 2·05 is what backs it |
| arrays (`int[]`, `text[]`) | `T[]` | `number[]` / `string[]` | element parsing follows the element type |
| `NULL` in any column | `null` | `T \| null` | 🔴 the most-forgotten half of every row type |

**`numeric` is absent from this schema deliberately.** It arrives as a string,
so a `numeric` column forces every consumer to choose between `parseFloat`
(reintroducing binary floating point, defeating the point of `numeric`) and a
decimal library. Integer cents avoid the choice entirely. If a `numeric` ever
does appear — an imported tax rate, a partner feed — its row type says `string`
and the parsing is explicit at the one call site. Typing it `number` because
that is what it means is exactly the lie this chunk exists to prevent.

## `jsonb` is `any`, and `any` is the wrong answer

The driver parses `jsonb` into a JavaScript value and the declarations cannot
know its shape, so it comes back through `QueryResultRow`'s
`[column: string]: any`. Writing `attributes: Record<string, string>` in the row
type is a guess presented as a fact.

```ts
export type ProductDetailRow = {
  // …
  attributes: unknown;          // jsonb: parsed, shape unproven
};
```

`unknown` forces the shape to be established where it is known —
[1·08's rule](../../phase-1-database/08-jsonb-attributes.md) that per-category
attribute keys are validated in the admin service, where the category is in
hand:

```ts
const AttributeBag = z.record(z.string().max(40), z.union([
  z.string(), z.number(), z.boolean(),
]));

export function productDetail(row: ProductDetailRow): ProductDetail {
  return {
    // …
    attributes: AttributeBag.parse(row.attributes),
  };
}
```

⚠️ **This is a real runtime cost on a hot read, and it is paid on purpose.**
The alternative — asserting the shape — means a hand-edited row in the database,
or an older writer's format, renders as `[object Object]` in a product page with
no error anywhere. `jsonb` is the one column type where the schema genuinely
does not constrain the value, so it is the one place a runtime parse is not
belt-and-braces.

## Nullability is where row types are wrong most often

Every column without `not null` can be `null`, and every outer join can turn a
`not null` column into `null` for unmatched rows. Both facts are invisible in
the select list.

```sql
select p.id, p.name, c.slug as category_slug
  from products p
  left join categories c on c.id = p.category_id
```

`categories.slug` is `not null` in the DDL. In this query it is `string | null`,
because the join may not match. A row type that copies the DDL's nullability is
wrong here, and wrong in the direction that produces
`Cannot read properties of null` in a mapper.

```ts
export type ProductWithCategoryRow = {
  id: number;
  name: string;
  category_slug: string | null;   // left join, not the DDL
};
```

📌 **The rule to internalise: a row type describes the *query's* nullability,
not the column's.** Aggregates make the same move in reverse — `count(*)` is
never null but `sum(total_cents)` over zero rows is, and `max(created_at)` on an
empty group is too.

## Aggregates, counts and the `int8` trap

```sql
select count(*) as order_count, sum(total_cents) as revenue_cents
  from orders where created_at >= $1
```

- **`count(*)` returns `bigint`.** Without the `INT8` parser it is a string;
  with it, a `number`. So `order_count: number` is again a claim about the pool.
- **`sum(bigint)` returns `numeric`.** Table 9.60 of the PostgreSQL 17 manual
  lists `sum ( bigint ) → numeric` — Postgres widens to avoid overflow — and
  `numeric` is unparsed by the driver, so `revenue_cents` is a **`string`** even
  with the `INT8` parser installed. This is the single most surprising row in
  this chapter, and it hits the
  [dashboard queries](../../phase-1-database/09-dashboard-queries.md) first.
  (Note the asymmetry: `sum ( integer ) → bigint`, so summing an `integer`
  column such as `cart_items.quantity` *does* come back through the `INT8`
  parser as a number.)
- **`sum(...)` over zero rows is `NULL`.** Verbatim: *"It should be noted that
  except for `count`, these functions return a null value when no rows are
  selected. In particular, `sum` of no rows returns null, not zero as one might
  expect"*. So the honest type is `string | null`.

```ts
export type RevenueRow = {
  order_count: number;          // count(*) → int8 → parsed to number
  revenue_cents: string | null; // sum(int8) → numeric → string, null when empty
};
```

The fix at the query, when a number is what you want, is to cast in SQL where
the widening is understood:

```sql
select count(*)::int                       as order_count,
       coalesce(sum(total_cents), 0)::bigint as revenue_cents
```

`::int` and `::bigint` both come back through the parsers as `number`, and the
`coalesce` removes the null. **Do the arithmetic where the types are known**,
which is the database, and let the row type describe the result rather than
apologise for it.

## Gotchas

**★ Every `number` in a row type is downstream of one `setTypeParser` call.**
A script, a migration runner or a test helper that builds its own `new pg.Pool`
without importing the app's pool module gets string `bigint`s, and the types say
`number` throughout. The symptom is concatenation, not an exception:
`"19992999"`. The fix is that there is exactly one module that constructs a
pool, and everything — including tests and one-off scripts — imports it.

**★ `sum()` of a `bigint` column is `numeric`, so it comes back as a string.**
`revenue_cents * 2` then produces a number for the wrong reason
(`"1999" * 2 === 3998`) while `revenue_cents + 100` concatenates. Cast in SQL:
`coalesce(sum(total_cents), 0)::bigint`.

**★ A `left join`'s columns are nullable regardless of the DDL.**
The row type must say `string | null` for a `not null` column reached through an
outer join. Copying nullability from the schema is the most common way a row
type is wrong, and it fails at the first row with no match — which in
development is usually never.

**★ `date` columns come back as `Date` objects, which are instants.**
A `date` has no time and no zone; `pg` hands back a `Date`, which is an instant
in the process's zone. Formatting it with `toISOString()` can therefore print
the previous day. This app has no `date` columns for exactly this reason —
every temporal column is `timestamptz`, per
[1·07](../../phase-1-database/07-money-and-time.md) — and if one is ever added,
its row type says `string` and the query selects `to_char(col, 'YYYY-MM-DD')`.

**★ `jsonb` typed as anything other than `unknown` is a guess with a type.**
`attributes: Record<string, string>` compiles and is unfalsifiable until a
number appears in the bag. The column's whole purpose is that the schema does
not constrain it, so the row type must not pretend otherwise. Parse it where
the expected shape is known.

**★ An enum column typed as its union is an assertion, and the parity test is
what backs it.** `status: OrderStatus` in a row type is `as OrderStatus` — the
driver returns a plain string. It is a reasonable assertion because the database
constrains the column, but only as long as the Postgres enum and the TypeScript
union agree, which is
[chapter 2·05's `pg_enum` test](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md).

**★ `interval` and `bytea` have no natural JavaScript type and no default
parser worth trusting.** `interval` returns an object with `years`/`months`/…
fields; `bytea` returns a `Buffer`. Neither appears in this schema —
[1·07's rule](../../phase-1-database/07-money-and-time.md) is that durations are
milliseconds in JavaScript and intervals in SQL, never crossing — and if one is
introduced its row type is written by reading the driver's output shape, not by
reading the SQL type name.

**★ A column selected twice under different aliases is one property in the row
type, and the last one wins at run time.** `select p.id, c.id from …` produces a
row object with a single `id` — the driver builds a plain object keyed by column
name. The row type will happily declare both if you alias them; if you forget to
alias, the type declares one field and the value is whichever column the driver
assigned last. Always alias on a join.

## Interview questions

**★ Why does `pg` return `bigint` as a string, and what does this app do about
it?**
Because a 64-bit integer does not fit exactly in a JavaScript `number` and the
driver will not lose precision without being asked. The app asks, once, with
`setTypeParser(INT8, Number)` in the single pool module, because every `int8`
in this schema is a cent count or an identity key and both stay well below
`Number.MAX_SAFE_INTEGER`. Every `number` in every row type depends on that
line.

**★ A dashboard number arrives as `"19992999"`. What happened?**
Two `bigint` cent values were added as strings, which means the `INT8` type
parser was not installed on the pool that ran the query — usually because a
script or a test created its own `pg.Pool` instead of importing the app's. The
types said `number` throughout; nothing threw. It is the canonical example of a
row type being a claim about the driver rather than about the schema.

**★ Why is `sum(total_cents)` a string even with the `INT8` parser installed?**
Because `sum` of a `bigint` returns `numeric`, not `bigint` — Postgres widens
the result type to avoid overflow — and `numeric` is deliberately unparsed by
the driver. The parser you installed is for `int8` and never sees the value.
Cast in SQL (`::bigint`) if a number is wanted, and `coalesce` it, because the
sum over zero rows is `NULL`.

**★ Which is more nullable, the column or the query, and why does it matter?**
The query. A `not null` column reached through a `left join` is `null` for
unmatched rows, and an aggregate over an empty group is `null` regardless of the
column. A row type copied from the DDL is therefore wrong in the direction that
crashes a mapper on the first unmatched row — which in a seeded development
database may be never.

**★ Why is a `jsonb` column typed `unknown` when the code clearly expects an
object of strings?**
Because nothing enforces that expectation. The schema constrains `jsonb` to
valid JSON and no further, so the shape can only be established by parsing.
`unknown` forces the parse to happen where the expected shape is actually known
— the admin service, which knows the category — rather than being assumed in a
row type nobody re-reads.

**★ How can a row type describing an enum column be trusted at all?**
It cannot, on its own — `status: OrderStatus` is an assertion over the plain
string the driver returns. What backs it is the database's own constraint (the
column is of an enum type, so no other value can be stored) plus the CI test
asserting that the enum's labels equal `ORDER_STATUSES` exactly, in order.
Type, constraint and test together; any two of the three leave a hole.

---

← Prev: [The query module, typed](02b-the-query-module-typed.md) ·
[Overview](README.md) ·
Next → [Rows that lie](04-rows-that-lie.md)
