---
title: "Typing raw pg results"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts)),
> the [node-postgres documentation](https://node-postgres.com/features/types),
> the PostgreSQL 17 references for
> [data types](https://www.postgresql.org/docs/17/datatype.html),
> [aggregate functions](https://www.postgresql.org/docs/17/functions-aggregate.html)
> and
> [`information_schema.columns`](https://www.postgresql.org/docs/17/infoschema-columns.html).
> Target: **TypeScript 7.0.2** on **Node 24.19.0**, `pg` **8.x**, PostgreSQL
> **17**. Declaration- and documentation-validated; **no console blocks, no
> timings**.

**There is no ORM here, so nothing anywhere compares a SQL string to a
TypeScript type.** Every guarantee in this chapter is built on that admission
rather than around it: `pool.query<Row>` is an assertion, a row type is a claim
about the *driver* and not the schema, and the link from a renamed column to a
broken build is the one link the compiler cannot supply.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The generic is an assertion](01-the-generic-is-an-assertion.md)** | `QueryResultRow`, `QueryResult` and the `query` overloads verbatim; 🔴 `R` defaults to `any`; why the parameter is never checked against the SQL; what it buys anyway; `rowCount: number \| null`; the `I` parameter nobody notices |
| 2 | **[A row type per query](02-a-row-type-per-query.md)** | Name the type after the query, not the table — five queries on `products`, four shapes; snake_case in, camelCase out, and the three places the rename could happen; `Querier = Pool \| PoolClient` and the transaction escape no type can catch |
| 3 | **[The query module, typed](02b-the-query-module-typed.md)** | 1·04's catalog query with types and nothing else changed; `as const satisfies` making the sort table a union; `params: unknown[]`; `at(-1)` as the honest indexer; why the narrowness of `Sort` is a security property |
| 4 | **[What `pg` actually returns](03-what-pg-actually-returns.md)** | 🔴 Every `number` is downstream of one `setTypeParser` call; the full mapping table; `sum(bigint) → numeric → string`, quoted from the manual; `jsonb` is `unknown`, not a guess; a `left join` makes `not null` columns nullable |
| 5 | **[Rows that lie](04-rows-that-lie.md)** | `rows[0]` is typed `R` and is often `undefined`; `noUncheckedIndexedAccess` and why the flag alone invites `!`; `maybeOne` / `exactlyOne`; `on conflict … returning` where zero rows is the *replay signal* |
| 6 | **[Closing the loop in CI](05-closing-the-loop.md)** | The one link the type system cannot supply; the `information_schema` parity test in full; `USER-DEFINED` and `udt_name`; why a parity test must fail rather than skip without a database |
| 7 | **[Where the parse pays](05b-where-the-parse-earns-its-cost.md)** | A runtime parse of rows on the money path only; the per-query assurance table; why generating types from `information_schema` or from prepared statements is right at a scale this app is not at |

## The four sentences to keep

1. **`pool.query<Row>(sql)` is `as Row[]` with better ergonomics.** Worth
   writing, never a check.
2. **A row type describes a query, and it describes the driver.**
   `price_cents: number` is true because of one `setTypeParser` call.
3. **`rows[0]` is a lie by default.** Two helpers own every array-to-row
   transition; the flag alone is not the fix.
4. **The last link closes in CI, not in the compiler** — and a runtime parse
   is spent only where a wrong type costs money.

## Phase gate

You are done with this topic when you can explain why the generic parameter is
unchecked and still worth writing, place a new query's row type without
consulting the DDL, say what `sum(total_cents)` returns and why, produce the
empty-result branch for a `returning` clause without being reminded, and
describe the CI check that makes a column rename break the build.

## Where this connects

Backwards to [2·02's data layer](../../phase-2-node-services/02-the-data-layer.md)
and [1·07's money and time rules](../../phase-1-database/07-money-and-time.md),
which are the runtime facts these types assert. Forwards to
[the mappers](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md),
which consume every row type here, and to
[the order state machine](../04-discriminated-unions/README.md), which turns one
nullable-heavy `orders` row into a union that cannot represent a shipped order
with no shipping date.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [zod as the source of truth](../02-zod-as-the-source-of-truth/README.md) ·
Next chapter → [Discriminated unions](../04-discriminated-unions/README.md)
