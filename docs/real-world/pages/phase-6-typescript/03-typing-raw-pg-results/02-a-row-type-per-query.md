---
title: "A row type belongs to a query, not to a table, because the select list is the shape and two queries on products return different things"
sidebar_label: "02 · A row type per query"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the **`@types/pg`** declarations on DefinitelyTyped
> ([`types/pg/index.d.ts`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts))
> — `Pool`, `Client extends ClientBase`, `PoolClient extends Client`,
> `QueryResult`. **TypeScript 7.0.2**, `pg` **8.x**, PostgreSQL **17**.
> Concept homes:
> [TypeScript 3·04 — `keyof`](../../../../typescript/pages/phase-3-generics/04-keyof/README.md),
> [TypeScript 2·10 — `satisfies`](../../../../typescript/pages/phase-2-narrowing/10-satisfies/README.md).
> The queries being typed are
> [1·04's catalog query](../../phase-1-database/04-the-catalog-query.md) and
> [2·02's data layer](../../phase-2-node-services/02-the-data-layer.md).

**`products` is one table and this app runs five different queries against it,
each returning a different set of columns.** A single `ProductRow` type that
covers all five is a type where two thirds of the fields are optional — which
means every consumer starts with a null check for a column that particular query
always returns. The rule that avoids this is short: **name the row type after
the query, not the table**, accept that there will be more row types than
tables, and let each one describe exactly one select list.

## The naming rule, and what it produces

```ts
// db/products.ts
export type ProductListRow = {          // GET /products — the grid
  id: number; name: string; slug: string;
  price_cents: number; stock: number;
  sort_value: number | string;          // whichever column the sort chose
  cover: string | null;                 // correlated subquery, may be absent
};

export type ProductDetailRow = {        // GET /products/:slug
  id: number; name: string; slug: string;
  description: string; price_cents: number; stock: number;
  attributes: unknown;                  // jsonb — see chunk 03
};

export type CheckoutItemRow = {         // the locked read inside checkout
  product_id: number; quantity: number;
  price_cents: number; stock: number;
};

export type AdminProductRow = ProductListRow & {
  created_at: Date; updated_at: Date; deleted_at: Date | null;
};
```

Four types, one table, and every one of them is exactly what its query returns.
Notice what is *not* shared: `ProductListRow` has `sort_value` and `cover`,
which exist in no table; `CheckoutItemRow` has `product_id` rather than `id`,
because it comes from a join with `cart_items`. A table-shaped type could
express neither without lying.

📌 **`AdminProductRow` extends by intersection because that query genuinely is
a superset.** Reuse where the relationship is real; do not manufacture one. If
the admin query later stops selecting `stock`, the intersection stops being
true and the type gets written out longhand — which is a smaller change than
unpicking a hierarchy.

## snake_case in, camelCase out — and where the rename happens

Row types are `snake_case` because columns are. Domain types are `camelCase`
because JavaScript is. There are three places the rename could happen and only
one of them is right:

| Where | Cost |
|---|---|
| **In the SQL** — `select price_cents as "priceCents"` | Quoted identifiers everywhere, `ORDER BY` clauses that no longer match the index, and a `psql` session where the column names do not match the schema |
| **In a generic key-mapping helper** | A `SnakeToCamel<T>` mapped type over every row — real type-level cost, an unreadable error message when it goes wrong, and a runtime `Object.entries` loop per row |
| ✅ **In the mapper** — `{priceCents: row.price_cents}` | Five lines per query, explicit, greppable, and it is the same function that already enforces the response contract |

The mapper already exists —
[chapter 2's typed mappers](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md)
are where a row becomes a response — so the rename costs nothing extra and
lands in the one file that is *about* the row-to-resource translation.

⚠️ **The wire keeps snake_case in this app.** `price_cents` and `next_cursor`
go out as written, per
[3·05's contract](../../phase-3-express-api/05-catalog-endpoints.md), so the
mapper is often a pass-through and the rename is only for values that become
JavaScript-facing (`cover` → `cover_url`, `stock` → `in_stock`). Consistency
with the wire beats consistency with the language when a public contract is
involved.

## The querier, typed once

[2·02](../../phase-2-node-services/02-the-data-layer.md) propagates the
transaction client through `AsyncLocalStorage`, so every query module asks a
helper for "the client I should use". Typing it means naming both possibilities:

```ts
// db/tx.ts
import type {Pool, PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';

export type Querier = Pool | PoolClient;

const als = new AsyncLocalStorage<PoolClient>();

export function q(pool: Pool): Querier {
  return als.getStore() ?? pool;
}
```

`PoolClient extends Client`, `Client extends ClientBase`, and `Pool` extends
`EventEmitter` directly — they are two unrelated classes that happen to expose
the same `query` overloads. A union is the honest spelling.

🔴 **`q(pool)` is the only expression `.query` is ever called on.** Both `Pool`
and `PoolClient` expose `.query`, so a module that writes `pool.query(...)`
compiles perfectly and runs *outside* any active transaction — committing on its
own, invisible to the surrounding rollback. **The type system cannot stop
this**, because the two classes are interchangeable at the call site. What the
`Querier` type does is give the correct thing a name, so `q(pool).query(...)`
and `pool.query(...)` are visibly different in review and mechanically
different to a lint rule.

## Gotchas

**★ One row type per *table* forces optionality that lies.**
`ProductRow` covering five queries means `description?`, `cover?`,
`sort_value?`, `deleted_at?` — and every consumer writes a null check for a
column its query always returns. Worse, the optionality is indistinguishable
from genuine nullability, so the one field that really can be `null` looks
exactly like the four that cannot.

**★ `pool.query(...)` instead of `q(pool).query(...)` silently escapes the
transaction, and no type catches it.** `Pool` and `PoolClient` both declare
`.query`, so both calls compile and both work; only one of them joins the
enclosing transaction. The rollback then leaves the escaped statement
committed, which is the worst possible half-state. Enforcement is a lint rule
banning member access on the `pool` parameter inside `db/`, plus the review
habit of reading every `.query` for the `q(` in front of it.

**★ Two row types with identical fields are still two types, and TypeScript
will not tell you.** Structural typing means `CheckoutItemRow` and a
hypothetical `CartItemRow` with the same five fields are interchangeable, so a
function meant for one silently accepts the other. Where that matters — and in
the checkout path it does — the
[branded ids of chapter 2·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md)
are what make the two stop being assignable.

**★ Deriving a row type from the shared package's resource type is the
row/resource collapse in a new costume.** `type ProductListRow =
Pick<Product, 'id' | 'name' | 'slug'>` looks tidy and inverts the dependency:
now the *database* layer's type is downstream of the wire contract, so changing
the API shape changes what the query claims to return. Rows come first; the
resource is derived from them by a mapper, never the other way round.

## Interview questions

**★ Why is a row type per query rather than per table?**
Because a query's shape is its select list, not its table. Five queries on
`products` return five different column sets, including computed columns like
`sort_value` and `cover` that belong to no table. A per-table type has to make
every non-universal column optional, and optionality-for-coverage is
indistinguishable from genuine nullability at the point of use.

**★ Where do you rename `price_cents` to `priceCents`, and why not in the SQL?**
In the mapper. Renaming in SQL requires quoted identifiers, which makes the
query text stop matching the schema and the `ORDER BY` stop matching the index
name a DBA is reading. A generic snake-to-camel mapped type costs type-level
complexity and a per-row runtime loop for a rename that is five explicit lines
in a function that already exists.

**★ Why must every query function take `Querier` rather than `Pool`?**
Because the transaction client is propagated through `AsyncLocalStorage`, and a
function holding a `Pool` will use the pool even when it is called inside a
transaction — committing independently and surviving the rollback. `Querier =
Pool | PoolClient` plus the `q()` helper is what makes "inside a transaction"
a property of the call rather than of the signature.

**★ Someone proposes `type ProductListRow = Pick<Product, …>` to avoid
duplication. What is wrong with it?**
It inverts the dependency. The row describes what the database returns and the
resource describes what the API sends; deriving the row from the resource makes
a change to the public contract silently change what the data layer claims to
have read. Rows are the source, the resource is derived, and the mapper is the
arrow between them.

---

← Prev: [The generic is an assertion](01-the-generic-is-an-assertion.md) ·
[Overview](README.md) ·
Next → [The query module, typed](02b-the-query-module-typed.md)
