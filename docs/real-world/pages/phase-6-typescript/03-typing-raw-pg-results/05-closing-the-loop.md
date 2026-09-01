---
title: "Nothing in TypeScript can compare a SQL string to a row type, so the loop closes in CI with information_schema and a runtime parse where money is involved"
sidebar_label: "05 · Closing the loop in CI"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the
> [PostgreSQL 17 `information_schema.columns` reference](https://www.postgresql.org/docs/17/infoschema-columns.html),
> the [`pg_type` catalogue](https://www.postgresql.org/docs/17/catalog-pg-type.html),
> and the **`@types/pg`** declarations on DefinitelyTyped. **TypeScript 7.0.2**,
> `pg` **8.x**, PostgreSQL **17**, zod **4.4.3**. Concept homes:
> [PostgreSQL — Node and `pg`](../../../../postgresql/syllabus/03-node-and-pg.md),
> [TypeScript 10·13 — unknown-first APIs](../../../../typescript/pages/phase-10-strictness/13-unknown-first-apis.md).
> The phase gate this chunk finally delivers is stated in
> [the phase overview](../README.md).

**The phase gate says a column rename must break the build in the query module,
the endpoint and the component.** Chunks 01–04 delivered the second and third
of those: once `ProductListRow` changes, everything downstream stops compiling.
What none of them delivered is the *first* — nothing makes `ProductListRow`
change when the column does. This chunk is that missing link, and it is the one
place in the phase where the answer is not a type. It is three graded levels of
assurance, applied unevenly on purpose.

## Level 1 — the type, reviewed

What chunks 01–04 built: one row type per query, adjacent to its SQL, written
against the driver's behaviour rather than the DDL. The verification mechanism
is a human reading a nine-line function in which the select list and the type
are twelve lines apart.

**This is enough for most of this app.** It fails in exactly one way — someone
edits one and not the other — and the failure surfaces as `undefined` where a
value was expected, on the first request that reaches that path. For the
catalog grid that is a missing image. For the checkout that is a wrong charge,
which is why level 1 is not the whole answer.

## Level 2 — a CI check against the catalogue

The database knows its own columns, so ask it. This is not codegen and does not
write files; it is a test that fails when the schema and the declared row types
disagree about a column's existence, nullability or type family.

```ts
// apps/api/test/schema-parity.test.ts
import {pool} from '../src/db/pool.js';

/** What the row types CLAIM about the columns they read.
 *  One entry per column any query module selects directly. */
const CLAIMED = {
  products: {
    id:          {type: 'bigint',      nullable: false},
    name:        {type: 'text',        nullable: false},
    slug:        {type: 'text',        nullable: false},
    description: {type: 'text',        nullable: false},
    price_cents: {type: 'bigint',      nullable: false},
    stock:       {type: 'integer',     nullable: false},
    attributes:  {type: 'jsonb',       nullable: false},
    created_at:  {type: 'timestamptz', nullable: false},
    deleted_at:  {type: 'timestamptz', nullable: true},
  },
  orders: {
    id:              {type: 'bigint',       nullable: false},
    user_id:         {type: 'bigint',       nullable: false},
    status:          {type: 'order_status', nullable: false},
    total_cents:     {type: 'bigint',       nullable: false},
    idempotency_key: {type: 'text',         nullable: false},
  },
  // …one block per table a query module reads
} as const satisfies Record<string, Record<string, {type: string; nullable: boolean}>>;

type Claimed = typeof CLAIMED;

test.each(Object.keys(CLAIMED) as (keyof Claimed)[])(
  '%s columns match what the row types claim',
  async (table) => {
    const {rows} = await pool.query<{
      column_name: string; data_type: string; udt_name: string; is_nullable: 'YES' | 'NO';
    }>(
      `select column_name, data_type, udt_name, is_nullable
         from information_schema.columns
        where table_schema = 'public' and table_name = $1`,
      [table],
    );

    const actual = new Map(rows.map((r) => [r.column_name, r]));

    for (const [column, claim] of Object.entries(CLAIMED[table])) {
      const found = actual.get(column);
      expect(found, `${table}.${column} is missing from the database`).toBeDefined();
      expect(normalise(found!), `${table}.${column} type`).toBe(claim.type);
      expect(found!.is_nullable === 'YES', `${table}.${column} nullability`)
        .toBe(claim.nullable);
    }
  },
);

/** information_schema spells things its own way; udt_name is the internal name. */
function normalise(c: {data_type: string; udt_name: string}): string {
  if (c.data_type === 'USER-DEFINED') return c.udt_name;    // 'order_status'
  if (c.data_type === 'timestamp with time zone') return 'timestamptz';
  if (c.data_type === 'character varying') return 'varchar';
  return c.data_type;                                        // 'bigint', 'text', …
}
```

**What this catches:** a dropped column, a renamed column, a column that
silently became nullable, an `integer` widened to `bigint` (which changes what
the driver returns, per
[chunk 03](03-what-pg-actually-returns.md)), and a `text` column turned into an
enum.

🔴 **What it does not catch, and it is important to say so plainly:** it does
not know which columns each *query* selects, so a query that stops selecting
`cover` still has a row type claiming `cover`. The `CLAIMED` table is a
hand-maintained list — a third declaration of the schema — and its only defence
is being small, mechanical and in one file. It buys the *database* half of the
loop; the *query* half is still level 1.

⚠️ **`information_schema.columns` reports `data_type` as
`'USER-DEFINED'` for enum types** and puts the real name in `udt_name`; it spells
`timestamptz` as `'timestamp with time zone'` and `varchar` as `'character
varying'`. The `normalise` function is not cosmetic — without it every enum
column compares equal to every other enum column.

## Gotchas

**★ The `CLAIMED` table is a third declaration and will itself drift.**
Adding a column to the schema and to a row type but not to `CLAIMED` produces a
passing test that checks nothing about the new column. Mitigate by also
asserting the *reverse* direction for the tables you fully own — every column in
`information_schema` must appear in `CLAIMED` — which turns "forgot to add it"
into a failure instead of a silence.

**★ `information_schema` reports enums as `USER-DEFINED`.**
Without normalising through `udt_name`, `order_status` and `review_status`
compare equal to each other and to every future enum. The test passes while the
columns are wrong.

**★ A parity test needs a migrated database, so it runs in CI and not in the
unit suite.** Wiring it into a test run that has no database gives a red build
for the wrong reason, and the usual fix — skipping when `DATABASE_URL` is unset
— quietly disables it in CI the day the variable is renamed. Make it a distinct
test job that *fails* without a database rather than skipping.

**★ The parity test asserts type *families*, not the driver's JavaScript
type.** `bigint` in the catalogue means the column is `int8`; whether it arrives
as `number` or `string` depends on the type parser. Those are two different
checks, and the second one is the sampled `typeof` assertion in the pool
module's own test —
[chunk 03](03-what-pg-actually-returns.md) explains why the difference matters.

## Interview questions

**★ The phase gate says a column rename breaks the build. Where does that chain
actually start, and what holds it up?**
It starts at the row type, and *nothing in TypeScript* holds it up — the SQL is
a string. The chain from the row type onward is genuine: mapper, response
schema, client, component. The first link is closed by a CI test that compares
declared columns against `information_schema`, which is a check rather than a
type, and by review of a nine-line function where the SQL and the type are
adjacent.

**★ Your parity test skips when `DATABASE_URL` is unset. What is wrong with
that?**
It converts a missing database from a loud failure into a silent pass, and the
day someone renames the variable in CI the check disappears with no signal. A
test whose whole purpose is to catch drift must fail when it cannot run. Give it
its own job that requires a migrated database and fails loudly without one.

---

← Prev: [Rows that lie](04-rows-that-lie.md) ·
[Overview](README.md) ·
Next → [Where the parse earns its cost](05b-where-the-parse-earns-its-cost.md)
