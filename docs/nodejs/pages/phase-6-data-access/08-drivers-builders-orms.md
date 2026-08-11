---
title: "Drivers, query builders and ORMs"
sidebar_label: "08 · Drivers vs builders vs ORMs"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0, `drizzle-orm` 0.45.2,
> `prisma` 7.9.1 against PostgreSQL 17.10.

**The choice is not "how much typing do I save". It is "who writes the SQL, and
what happens on the day it is wrong".** All three layers are defensible; picking
one without knowing what it takes away is not.

## The three layers

```js
// driver — you write SQL, it sends bytes
const {rows} = await pool.query(
  'select id, email from users where id = $1', [id]);

// query builder — you compose SQL in JavaScript, it prints SQL you recognise
const rows = await db.select({id: users.id, email: users.email})
  .from(users).where(eq(users.id, id));

// ORM — you describe objects, it decides the SQL
const user = await prisma.users.findUnique({
  where: {id}, select: {id: true, email: true},
});
```

| | Driver (`pg`, `mongodb`) | Query builder (Drizzle, Knex) | ORM (Prisma, TypeORM, Mongoose) |
|---|---|---|---|
| Who writes SQL | You | You, in JS | The tool |
| Composition | String concatenation (careful) | Native — conditions are values | Object filters |
| Types | Hand-written | Inferred from the schema | Generated |
| Migrations | Your own ([page 11](./11-migrations.md)) | Usually included | Included, opinionated |
| Escape hatch | n/a | a `sql` tagged template | `$queryRaw` / raw |
| The bad day | You already know the SQL | You already know the SQL | Decode the generated SQL first |

## What the abstraction costs, measured

500 single-row lookups, same database, same machine:

```console
raw pg     296 ms
Drizzle    388 ms
Prisma     597 ms
```

Roughly **0.6 ms · 0.8 ms · 1.2 ms** per query. In a handler that spends 40 ms on
one badly-indexed query, this is noise, and choosing a driver "for performance"
while writing an N+1 is a rounding error chasing a catastrophe
([page 07](./07-n-plus-1.md)).

Where it *does* matter is the tight loop: a batch job doing 100 000 lookups pays
60 seconds of overhead with Prisma against 30 with `pg`. That is an argument for
one query with `= any($1)`, not for changing your whole data layer.

## The real differences

**Composition.** Optional filters are where hand-written SQL rots:

```js
// driver: correct, and it will get worse with the fourth filter
const clauses = ['1=1'], values = [];
if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
if (minTotal) { values.push(minTotal); clauses.push(`total_cents >= $${values.length}`); }
const {rows} = await pool.query(`select * from orders where ${clauses.join(' and ')}`, values);
```

```js
// builder: conditions are values, and undefined ones drop out
const rows = await db.select().from(orders).where(and(
  status ? eq(orders.status, status) : undefined,
  minTotal ? gte(orders.totalCents, minTotal) : undefined,
));
```

That is the strongest argument for a builder, and it is a maintainability argument,
not a performance one.

**Visibility.** A builder prints the exact query:

```console
$ node ex11-drizzle.mjs
generated SQL:
  select "orders"."id", "orders"."total_cents", "users"."email" from "orders"
  inner join "users" on "orders"."user_id" = "users"."id"
  where ("orders"."status" = $1 and "orders"."total_cents" > $2) limit $3
params: [ 'paid', 500000, 3 ]
```

An ORM's is something you have to go and ask for — and it may not be the query you
expected. Prisma's relation `include` is two statements, not a join
([page 13](./13-prisma-drizzle.md)).

**Types.** All three can be typed; they differ in where the type comes from. A
builder infers it from the schema you declared; an ORM generates it from a schema
file; a driver gives you `any` unless you write the interface yourself. `pg` types
`rows` as `any[]` by default — `pool.query<User>(…)` is worth the two seconds.

**The bad day.** This is the one people underweight. At 3 a.m., with one endpoint
timing out, the question is always *what SQL is running and why is it slow*. With a
driver you already have it. With a builder, `.toSQL()`. With an ORM you enable
query logging, find the statement, run `EXPLAIN` on it, and then work out which
part of your object graph produced it — three steps you did not need.

## Choosing

**Take a driver when** the schema is small, the queries are yours, or the workload
is unusual enough (CTEs, window functions, `COPY`, LISTEN/NOTIFY, cursors) that
you would be fighting the abstraction. Add a migration runner and a mapping layer
(pages [10](./10-repository-pattern.md) and [11](./11-migrations.md)) and you have
everything you actually needed.

**Take a query builder when** the schema is real, filters are dynamic, and you want
end-to-end types without giving up SQL. This is the default that ages best for a
typical MERN/PERN application.

**Take an ORM when** the team is large or junior-heavy, the domain is mostly CRUD,
and the value of one generated client, one migration story and one convention
outweighs the opacity. Or when it is already there — swapping data layers to satisfy
an opinion is rarely the best use of a sprint.

**Do not mix three of them.** One tool owns the schema, the migrations and the
connection pool. A second tool "just for reports" means two migration histories and
two pools against the same connection budget.

## What every layer must still get right

None of these choices exempt you from the rest of this phase:

- Injection ([page 02](./02-parameterized-queries.md)) — every layer parameterizes,
  and every layer has a raw escape hatch that does not unless you use its tagged
  template. Verified in Drizzle and Prisma: both ``sql`…` `` and
  ``$queryRaw`…` `` sent the hostile string as `$1`. The `Unsafe` variants do not.
- N+1 ([page 07](./07-n-plus-1.md)) — ORMs make it easier to write.
- Pooling ([page 01](./01-connection-pooling.md)) — Drizzle and Prisma 7 both sit on
  a `pg.Pool` you supply, so its sizing is still your problem.
- Transactions ([page 06](./06-transactions.md)) — each has a `transaction()`
  helper; the scoping rules do not change.

## Gotchas

**Symptom:** "We chose X for performance" and it is still slow
**Cause:** The layer costs sub-millisecond per query; the problem is query count or
indexes.
**Fix:** Count queries and read plans before changing tools.

**Symptom:** Two migration histories in one repository
**Cause:** A second data layer added for one feature.
**Fix:** One tool owns the schema; others read it.

**Symptom:** Nobody can explain what SQL an endpoint runs
**Cause:** ORM query logging was never turned on.
**Fix:** Enable it in development permanently; `.toSQL()` in a builder.

**Symptom:** An unusual query is impossible to express
**Cause:** The abstraction does not cover window functions, CTEs, `COPY`,
`FOR UPDATE SKIP LOCKED`.
**Fix:** Use the raw escape hatch, parameterized — that is what it is for.

**Symptom:** Types say the row has a `number`, at runtime it is a string
**Cause:** Hand-written interfaces over a driver do not check anything; `bigint`
and `numeric` come back as strings ([page 04](./04-postgresql-from-node.md)).
**Fix:** Map and convert in one place, or let a builder/ORM declare the type.

## Interview questions

**★ What is the difference between a query builder and an ORM?**
A builder composes SQL — you still choose the joins and the shape, and it can print
the exact statement. An ORM maps objects to tables and decides the SQL for you,
including how relations are loaded. The builder keeps SQL as the mental model; the
ORM replaces it.

**★ How much overhead does an ORM add per query?**
Measured here: 500 single-row lookups took 296 ms through `pg`, 388 ms through
Drizzle, 597 ms through Prisma — under a millisecond each. That is irrelevant next
to one missing index or one N+1, and it only matters in tight batch loops.

**★ When would you deliberately use the raw driver?**
Small or unusual schemas, and workloads that need SQL an abstraction hides — CTEs,
window functions, `COPY`, cursors, `FOR UPDATE SKIP LOCKED`, `LISTEN/NOTIFY`. The
cost is that migrations and result mapping become yours to write.

**★ What is the strongest argument for a query builder?**
Composition with types: optional filters become values that can be `undefined`
instead of string surgery on a WHERE clause, and the result type is inferred from
the schema. You keep SQL semantics and `.toSQL()` for debugging.

**Does using an ORM protect you from SQL injection?**
For generated queries, yes. Its raw escape hatch does not, unless you use the
tagged-template form — the `Unsafe` variants interpolate exactly what you give
them.

**Two teams disagree on ORM vs driver. How do you decide?**
On the failure mode you can afford: how quickly someone can find and fix a slow
query at 3 a.m., and how much unusual SQL the workload needs. Then pick one tool
to own schema, migrations and the pool — the expensive mistake is running two.

---

← Prev: [N+1 queries](./07-n-plus-1.md) · Next → [Mongoose](./09-mongoose.md)
