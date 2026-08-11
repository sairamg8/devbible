---
title: "Data-access layering: keeping driver types out of business logic"
sidebar_label: "10 · The repository pattern"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against PostgreSQL 17.10,
> tests run with the built-in `node --test`.

**This is not a layering doctrine. It is one rule: driver types must not leak past
one file.** The repository pattern is the cheapest way to enforce that rule, and the
payoff is measurable in your test suite, not in an architecture diagram.

## The leak, concretely

[Page 04](./04-postgresql-from-node.md) established that `pg` returns `bigint` and
`numeric` as **strings** and `count(*)` as a string. Suppose that fact travels:

```js
// refunds.js — business logic, and it now knows about pg's type mapping
export async function refundValue(pool, orderId) {
  const {rows} = await pool.query(
    'select total_cents, status from orders where id = $1', [orderId]);
  if (rows.length === 0) return null;
  return rows[0].status === 'paid' ? Number(rows[0].total_cents) * 0.9 : 0;
}
```

Three things leaked into a file that should only know about refunds:

1. **`rows`** — a driver-shaped result envelope, not a domain concept.
2. **`total_cents`** — a column name, and snake_case at that.
3. **`Number(...)`** — a workaround for a `pg` type-mapping detail.

Drop that `Number(` and the function silently returns `"250000.9"` from string
concatenation instead of a number. Swap `pg` for a builder and every call site
changes. Test it and you need a database.

## The repository

One module owns the SQL and the mapping, and returns domain objects:

```js
// order-repo.mjs — the only file that imports or knows about pg
export function makeOrderRepo(pool) {
  const toOrder = (row) => ({
    id: row.id,
    userId: row.user_id,
    status: row.status,
    totalCents: Number(row.total_cents),   // string -> number, exactly once
    createdAt: row.created_at,
  });

  return {
    async findById(id) {
      const {rows} = await pool.query(
        'select id, user_id, status, total_cents, created_at from orders where id = $1',
        [id]);
      return rows[0] ? toOrder(rows[0]) : null;
    },

    async markRefunded(id, {tx} = {}) {
      const executor = tx ?? pool;
      const {rowCount} = await executor.query(
        `update orders set status = 'refunded' where id = $1 and status = 'paid'`,
        [id]);
      return rowCount === 1;
    },
  };
}
```

```js
// refunds.mjs — no import of pg, no column names, no envelopes
export function makeRefunds({orders}) {
  return {
    async valueOf(orderId) {
      const order = await orders.findById(orderId);
      if (!order) return null;
      return order.status === 'paid' ? order.totalCents * 0.9 : 0;
    },
  };
}
```

`refunds.mjs` has **no driver import at all**. That is the whole test.

## What that buys, measured

```console
$ node --test
✔ refundValue returns 90% of a paid order (1.9ms)
✔ refundValue returns 0 for an unpaid order (0.4ms)
✔ refundValue returns null for a missing order (0.3ms)
✔ markRefunded is not called for an unpaid order (0.5ms)
ℹ pass 4
ℹ duration_ms 139.4
```

**Four tests, 139 ms, no database, no mocking library, no container.** The fake is
three lines:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRefunds} from './refunds.mjs';

const fakeRepo = (order) => ({findById: async () => order});

test('refundValue returns 90% of a paid order', async () => {
  const refunds = makeRefunds({orders: fakeRepo({id: 7, status: 'paid', totalCents: 250000})});
  assert.equal(await refunds.valueOf(7), 225000);
});
```

Compare the alternative: to test the leaky version you need a running PostgreSQL, a
seeded `orders` row, and cleanup between tests. That is an integration test, it is
worth having, and it should not be how you test a percentage calculation.

## Where the boundary goes

The rule is **one direction**: the repository knows about the domain, the domain
knows nothing about the driver.

| Belongs in the repository | Belongs above it |
|---|---|
| SQL and Mongo filters | Business rules and policy |
| Column names, snake_case → camelCase | Domain field names |
| `Number(row.total_cents)`, `ObjectId` ↔ string | Numbers and strings |
| `rows` / `rowCount` / `insertedId` | Booleans and objects |
| Driver error codes (`23505` → `DuplicateEmail`) | Catching `DuplicateEmail` |

That last row matters more than it looks. A caller writing
`catch (e) { if (e.code === '23505') ... }` has coupled itself to PostgreSQL just as
firmly as if it wrote the SQL. Translate at the boundary:

```js
async create(user) {
  try {
    const {rows} = await pool.query(
      'insert into users (email) values ($1) returning id', [user.email]);
    return {id: rows[0].id, email: user.email};
  } catch (err) {
    if (err.code === '23505') throw new DuplicateEmailError(user.email);
    throw err;
  }
}
```

## Keeping transactions out of it

The obvious objection: a transaction spans several repositories, and the transaction
handle is a driver object. If every method takes a `tx`, the driver has leaked again
— just more politely.

Both answers from [page 06](./06-transactions.md) still work here, and neither one
puts `pg` in the business logic:

```js
// explicit executor, passed as an opaque handle
await withTransaction(pool, async (tx) => {
  await orders.markRefunded(id, {tx});
  await ledger.credit(userId, amount, {tx});
});
```

```js
// AsyncLocalStorage — the repository reads the ambient executor itself
const executor = txStore.getStore() ?? pool;
```

The explicit form is honest and noisy; the ambient form is quiet and easy to get
wrong when a call escapes the store. Pick one per codebase. Whichever you pick,
`tx` stays an opaque token to the caller — nobody above the repository calls
`tx.query()`.

## When not to do this

**A CRUD endpoint that reads a row and returns it as JSON gains nothing.** You have
added a file and a mapping function to protect logic that does not exist. The pattern
pays when there *is* business logic worth testing without a database.

**Do not build a generic `Repository<T>` with `findAll`, `findWhere`, `save`.** A
generic repository ends up exposing a query language of its own, which is the driver
leak with extra steps, and it forces every query through an abstraction that cannot
express the interesting ones. Repositories are **per aggregate, with named methods**
that say what the application actually asks for: `findOverdueInvoices()`, not
`findWhere({status: 'overdue', dueDate: {lt: now}})`.

**An ORM is not automatically a repository.** A Prisma client passed into business
logic leaks `prisma.order.findUnique` call shapes and Prisma's error classes just as
readily as `pool.query` leaks `rows`. The boundary is about what your domain code
imports, not about how much SQL you write.

## Gotchas

**Symptom:** A money total is wrong by string concatenation — `"250000.9"`
**Cause:** `numeric`/`bigint` arrive as strings and the conversion is scattered or
missing.
**Fix:** Convert once, in the repository's mapper. Nothing above it sees a string.

**Symptom:** Unit tests need a running database to check a percentage
**Cause:** Business logic imports the pool.
**Fix:** Inject a repository; fake it in three lines. Keep real-database tests for
the repository itself.

**Symptom:** Swapping or upgrading the driver touches dozens of files
**Cause:** `rows`, `rowCount` and column names spread through the codebase.
**Fix:** One module per aggregate owns them.

**Symptom:** `catch (e) { if (e.code === '23505') }` appears in a service
**Cause:** Driver error codes leaked past the boundary.
**Fix:** Translate to a domain error at the repository edge.

**Symptom:** The repository interface has grown a query DSL
**Cause:** A generic `findWhere(criteria)` instead of named methods.
**Fix:** Name the queries the application needs; delete the generic one.

**Symptom:** A write inside a transaction survives the rollback
**Cause:** A repository method used the pool because no `tx` was threaded through.
**Fix:** See [page 06](./06-transactions.md) — this was measured, and it is the
failure mode both propagation styles exist to prevent.

## Interview questions

**★ What problem does the repository pattern actually solve?**
It stops driver-shaped values — result envelopes, column names, `numeric`-as-string,
`ObjectId`, error codes — from spreading through business logic. The concrete payoff
is that domain logic can be tested without a database: measured here, four tests in
139 ms with a three-line fake and no mocking library.

**★ Is it worth it for a CRUD app?**
Often not. If a handler reads a row and returns it as JSON, the repository adds a
file to protect logic that does not exist. It earns its place once there is business
logic worth testing independently, or once more than one call site needs the same
query.

**★ How do you handle transactions without leaking the driver?**
Pass the executor as an opaque handle into repository methods (`{tx}`), or keep it in
`AsyncLocalStorage` and let the repository read it. Either way the caller never calls
`tx.query()` itself; it only scopes the transaction.

**★ Why not a generic `Repository<T>` with `findWhere`?**
Because the generic filter object becomes a query language, which is the same
coupling in a new shape, and it cannot express the queries that matter — joins,
CTEs, aggregation. Named methods per aggregate say what the application needs and
leave the SQL free.

**If you use Prisma, do you still need a repository?**
The question is what your business logic imports. Prisma call shapes and error
classes leak just like `pg`'s. If the domain code is thin, injecting the client is
fine; if it is worth testing on its own, the boundary still pays.

**Where should `snake_case` become `camelCase`?**
In the repository's mapper, once per aggregate. Doing it in the SQL with `as` aliases
also works; doing it ad hoc at call sites is how both spellings end up in the
codebase.

---

← Prev: [Mongoose](./09-mongoose.md) · Next → [Migrations as code](./11-migrations.md)
