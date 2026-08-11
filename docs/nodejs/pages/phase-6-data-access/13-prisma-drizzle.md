---
title: "Prisma and Drizzle — schema-first vs SQL-first"
sidebar_label: "13 · Prisma and Drizzle"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `drizzle-orm` 0.45.2, `prisma` /
> `@prisma/client` / `@prisma/adapter-pg` **7.9.1**, against PostgreSQL 17.10.

**Both give you end-to-end types. They disagree about where the schema lives.**
Prisma owns a schema file and generates a client from it. Drizzle declares the schema
in TypeScript and generates SQL you can read. [Page 08](./08-drivers-builders-orms.md)
covered the category; this is the concrete shape of each, on current versions.

## Drizzle — the schema is TypeScript

```ts
// schema.ts
import {pgTable, serial, text, integer, bigint, timestamp} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status').notNull(),
  totalCents: bigint('total_cents', {mode: 'number'}).notNull(),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow(),
});
```

```ts
import {drizzle} from 'drizzle-orm/node-postgres';
import {eq, and, gt} from 'drizzle-orm';
import pg from 'pg';

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const db = drizzle(pool, {schema});

const rows = await db.select({
    id: orders.id, totalCents: orders.totalCents, email: users.email,
  })
  .from(orders)
  .innerJoin(users, eq(orders.userId, users.id))
  .where(and(eq(orders.status, 'paid'), gt(orders.totalCents, 500_000)))
  .limit(3);
```

Note `bigint('total_cents', {mode: 'number'})`. That option is **you deciding** how
`bigint` crosses into JavaScript — `'number'` or `'bigint'`. The string-shaped
surprise from [page 04](./04-postgresql-from-node.md) becomes a declaration instead of
a bug.

**You can always see the query**, which is the strongest practical argument for the
tool:

```js
console.log(query.toSQL());
```

```console
generated SQL:
  select "orders"."id", "orders"."total_cents", "users"."email" from "orders"
  inner join "users" on "orders"."user_id" = "users"."id"
  where ("orders"."status" = $1 and "orders"."total_cents" > $2) limit $3
params: [ 'paid', 500000, 3 ]
```

The escape hatch stays parameterized:

```ts
import {sql} from 'drizzle-orm';
const hostile = `x' or '1'='1`;
await db.execute(sql`select id from users where email = ${hostile}`);
// -> select id from users where email = $1   ·  params: [ "x' or '1'='1" ]
```

Verified: the hostile string was sent as `$1`. `sql.raw()` does **not** do this —
that is the one to grep for in review ([page 02](./02-parameterized-queries.md)).

Drizzle sits on **your** `pg.Pool`. Pool sizing, the `'error'` listener and
`pool.end()` on shutdown are still yours ([page 01](./01-connection-pooling.md)).

## Prisma 7 — the schema is a file, and the setup changed

Prisma's model lives in `schema.prisma`, and `prisma generate` produces a typed
client from it.

```prisma
model User {
  id     Int     @id @default(autoincrement())
  email  String  @unique
  orders Order[]
}

model Order {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  status     String
  totalCents BigInt   @map("total_cents")
  user       User     @relation(fields: [userId], references: [id])

  @@map("orders")
}
```

**Prisma 7 is a breaking change and most tutorials are still on 5 or 6.** Two things
moved:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // ⚠ hard error in Prisma 7
}
```

```console
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: The `url` property in `datasource` is no longer supported.
```

The connection URL now lives in `prisma.config.ts`:

```ts
// prisma.config.ts
import {defineConfig, env} from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {url: env('DATABASE_URL')},
});
```

And the client requires a **driver adapter** — there is no built-in engine
connection any more:

```ts
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

const adapter = new PrismaPg({connectionString: process.env.DATABASE_URL});
const prisma = new PrismaClient({adapter});
```

Which means Prisma, like Drizzle, is now running on a `pg` pool you configure — the
same pooling rules apply.

**Introspection works well.** Against an existing database:

```console
$ npx prisma db pull
Introspecting based on datasource defined in prisma/schema.prisma …
✔ Introspected 6 models and wrote them into prisma/schema.prisma in 134ms

*** WARNING ***
These constraints are not supported by Prisma Client, but they will be enforced
by the database:
  - Model: "accounts", constraint: "accounts_balance_cents_check"
```

That warning is the shape of the whole trade-off: the database has rules Prisma's
type layer cannot express, so a check-constraint violation arrives at runtime as a
driver error, not as a type error.

## The thing to know about Prisma relations

```ts
const users = await prisma.user.findMany({
  where: {id: {in: [1, 2, 3]}},
  include: {orders: true},
});
```

```console
select "id", "email" from "users" where "id" IN ($1,$2,$3)
select "id", "user_id", "status", "total_cents" from "orders" where "user_id" IN ($1,$2,$3)
```

**Two queries, not a join.** This is deliberate and mostly good — it avoids the row
multiplication a join produces across a one-to-many, and it is a *batched* pair, not
an N+1 ([page 07](./07-n-plus-1.md)). But it means "include the relation" is not free
and not a single round trip, and nested includes multiply the statements. When you
need one query with a join, that is `$queryRaw`.

`BigInt` columns arrive as JavaScript `BigInt` — correct, and `JSON.stringify` throws
on it, so a serialiser is required at the edge.

## Which one

| | Drizzle | Prisma |
|---|---|---|
| Schema lives in | TypeScript | `schema.prisma` |
| Mental model | SQL | Objects |
| See the query | `.toSQL()`, always | Query logging |
| Relations | Your join | Two batched queries |
| Migrations | `drizzle-kit generate` — SQL you review | `prisma migrate` — generated, opinionated |
| Introspection | Yes | Yes, plus warnings on what it cannot model |
| Overhead (500 lookups) | 388 ms | 597 ms |
| Runs on | your `pg.Pool` | your `pg.Pool` (7+, via adapter) |

Against `pg`'s 296 ms baseline that is **~0.8 ms and ~1.2 ms per query** — and
[page 08](./08-drivers-builders-orms.md) is the argument for why that is the wrong
axis to choose on.

**Take Drizzle when** the team knows SQL and wants to keep knowing it, when queries
get non-trivial (CTEs, window functions, partial indexes), or when you want the
schema and the types to be the same TypeScript file. It is the closest thing to
"typed SQL" and the safer default for a PERN app whose queries will get interesting.

**Take Prisma when** the domain is mostly CRUD, the team benefits from one strong
convention, and the generated client, migrations and studio tooling are worth more
than direct control of the SQL. Its ergonomics for straightforward object graphs are
genuinely better than anyone's.

**On MongoDB**, this comparison mostly evaporates: Prisma supports it, Drizzle does
not, and the realistic choice is the driver or Mongoose
([page 09](./09-mongoose.md)).

## Gotchas

**Symptom:** `P1012 … The url property in datasource is no longer supported`
**Cause:** A Prisma 6-style schema on Prisma 7.
**Fix:** Move the URL into `prisma.config.ts` via `defineConfig`.

**Symptom:** Prisma 7 client cannot connect, no engine
**Cause:** No driver adapter — 7 removed the built-in connection.
**Fix:** `new PrismaClient({adapter: new PrismaPg({connectionString})})`.

**Symptom:** `TypeError: Do not know how to serialize a BigInt`
**Cause:** A `bigint` column reached `JSON.stringify`.
**Fix:** Serialise at the edge, or declare `bigint(col, {mode: 'number'})` in Drizzle
when the values genuinely fit.

**Symptom:** An `include` is slower than expected
**Cause:** It is two queries per relation level, and nesting multiplies them.
**Fix:** Select only the relations you use; drop to `$queryRaw` for a real join.

**Symptom:** A check constraint fires at runtime that the types never mentioned
**Cause:** Prisma does not model check constraints — it says so during `db pull`.
**Fix:** Validate in the application too; treat the database as the last line, not
the only one.

**Symptom:** Injection through a builder or ORM
**Cause:** `sql.raw()` or `$queryRawUnsafe`.
**Fix:** The tagged-template forms parameterize — verified. Grep for the `raw` and
`Unsafe` variants in review.

**Symptom:** Connections exhausted although the ORM "manages" them
**Cause:** Both now run on a `pg.Pool` you supplied, at default `max: 10` per process.
**Fix:** Size it deliberately ([page 01](./01-connection-pooling.md)).

## Interview questions

**★ Prisma vs Drizzle in one sentence each?**
Prisma is schema-first: one `.prisma` file is the source of truth and the client is
generated from it, with objects as the mental model. Drizzle is SQL-first: the schema
is TypeScript, queries compose into SQL you can print with `.toSQL()`, and the mental
model stays relational.

**★ Does `include` in Prisma produce a join?**
No — it issues a second query with `where "user_id" IN (…)`. That is a batched pair,
not an N+1, and it avoids the row duplication a one-to-many join causes. It does mean
relations cost extra round trips, and nested includes multiply them.

**★ What changed in Prisma 7?**
`url` in the `datasource` block is a hard error (`P1012`); the connection URL moves
to `prisma.config.ts`. And the client requires a driver adapter — `PrismaPg` over a
`pg` pool — so connection pooling is now explicitly your configuration.

**★ How do these protect against SQL injection?**
Generated queries are always parameterized, and the tagged-template escape hatches
(``sql`…` ``, ``$queryRaw`…` ``) interpolate as `$1` — verified with a hostile
string. `sql.raw()` and `$queryRawUnsafe` do not; they exist for dynamic identifiers
and must never see user input.

**Which would you pick for a new PERN app?**
Drizzle, unless the team specifically wants Prisma's conventions. The queries in a
real application get non-trivial, and being able to read and print the SQL is worth
more over time than the CRUD ergonomics. Either is defensible; running both is not.

**What can Prisma's schema not express?**
Check constraints, among other things — `db pull` warns about exactly this. The
database enforces rules the generated types do not know about, so those failures
arrive at runtime.

---

← Prev: [`node:sqlite`](./12-node-sqlite.md) · Next → [Retry and backoff](./14-retry-backoff.md)
