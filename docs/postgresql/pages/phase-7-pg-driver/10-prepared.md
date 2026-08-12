---
title: "Prepared statements"
sidebar_label: "10 · Prepared statements"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex21-types-prepared.mjs`.

**Adding a `name` to a query makes `pg` issue a server-side `PREPARE`, so the statement is
parsed and planned once per connection instead of once per execution. Measured 1.6×
faster on a hot path — and it is per-session, which is what makes it awkward.**

## Naming a query prepares it

```js
const found = await client.query({
  name: 'find-item',                            // ← this is the whole feature
  text: 'SELECT v FROM p_t WHERE id = $1',
  values: [id],
});
```

```console
$ node ex21-types-prepared.mjs
=== 4. named (prepared) statements ===
pg_prepared_statements → [
  {
    name: 'find-p',
    statement: 'SELECT v FROM p_t WHERE id = $1',
    generic_plans: '0',
    custom_plans: '1'
  }
]
```

The first call sends `Parse` with a name; later calls send only `Bind`/`Execute` with new
values. `pg_prepared_statements` shows what the current session has prepared — a useful
thing to know exists when debugging.

Every parameterized query already uses the extended protocol
([Parameterized queries](../phase-4-crud/08-parameters.md)); an *unnamed* one is parsed
each time. `name` is what makes the parse persist.

## What it buys

```console
2000 queries — unnamed 772 ms | named 481 ms
```

**1.6× faster** for one property on the query object, on a trivial single-row lookup.
The saving is parse and plan time, so it is proportionally largest exactly where it
matters: short queries run very often. On a query that takes 50 ms to execute, saving
0.15 ms of planning is noise.

## The plan changes after five executions

```console
after 8 more executions → { name: 'find-p', generic_plans: '4', custom_plans: '5' } ← PostgreSQL switches to a generic plan around the 6th execution
```

PostgreSQL plans a prepared statement with the actual parameter values (a **custom plan**)
for the first five executions. From the sixth it compares costs and may switch to a
**generic plan** built without knowing the values, which it then reuses.

That is usually a win — no planning at all. It is a loss when your data is skewed:

```sql
SELECT * FROM events WHERE tenant_id = $1;
```

If one tenant owns 90% of the rows and the others own a handful, the right plan differs
per value — a sequential scan for the big tenant, an index scan for the small ones. A
generic plan picks one and is wrong for the others, and the symptom is a query that was
fast for a week and is suddenly slow with no deploy.

You can force the issue per session:

```sql
SET plan_cache_mode = force_custom_plan;    -- always plan with the real values
SET plan_cache_mode = force_generic_plan;   -- never replan
SET plan_cache_mode = auto;                 -- the default, as measured above
```

`force_custom_plan` on a skewed table gives back correct plans at the cost of planning
every time — often the right trade.

## Prepared statements are per session

```console
session A pid 1932 prepared 'find-p'; session B pid 1933 sees 0 ← prepared statements are per-SESSION, not per-pool
```

This is the constraint that shapes how you can use the feature. A statement prepared on
one connection does not exist on any other, so with a pool of 10, a named query is
prepared up to 10 times — once per connection, on that connection's first use.

Consequences:

- **The warm-up is per connection.** A newly opened connection pays the parse again.
- **`pool.query({name})` still works** — whichever connection it lands on prepares it if
  it has not already — but you get no guarantee about which, so the benefit accrues
  gradually rather than immediately.
- **The name must be stable and unique per statement text.**

```console
reusing a name with different text → Prepared statements must be unique - 'find-p' was used for a different statement
```

`pg` catches the collision client-side. Generating names dynamically — a hash of the SQL,
or a counter — is how sessions accumulate hundreds of prepared statements and leak memory
on the server. Use a small fixed set of literal names.

## Connection poolers break this

If you deploy behind **PgBouncer in `transaction` or `statement` pooling mode**, a
"session" is not stable — consecutive queries from your connection can land on different
server backends. A statement prepared on one is missing on the next, and you get
`26000 prepared statement "find-item" does not exist`.

Options, in order of preference:

1. Use `session` pooling mode, where a client keeps one backend.
2. Turn named statements off in the application.
3. PgBouncer 1.21+ supports tracking prepared statements in transaction mode
   (`max_prepared_statements`) — verify it is enabled before relying on it.

This is the single most common reason teams disable prepared statements, and it is worth
checking your topology before adding names everywhere.

## When to use them

| Situation | Named? |
|---|---|
| Hot read on a request path, run thousands of times | **Yes** |
| Query inside a tight loop on one checked-out client | **Yes** |
| Analytical query run occasionally | No — planning is a rounding error |
| Skewed data where the right plan depends on the value | No, or `force_custom_plan` |
| Behind PgBouncer transaction pooling | No, unless configured for it |
| Dynamically built SQL | No — the text varies, so names cannot be stable |

The last row matters: dynamic `WHERE` clauses produce different statement text per filter
combination ([Safe dynamic `WHERE`](../phase-9-api-crud/safe-dynamic-where/)), so there is
no stable name to give them.

## Trade-off

Prepared statements buy parse and plan time — measured 1.6× on a small query — and cost
per-session state: warm-up per connection, a global name registry you must keep unique,
incompatibility with transaction-mode poolers, and the chance of a generic plan that suits
your data less well than a per-value plan.

Get the query and its indexes right first. This is a constant-factor optimisation; a
missing index is an order-of-magnitude one ([Indexes](../phase-10-indexes/)).

## Gotchas

**Symptom:** `26000 prepared statement "…" does not exist`
**Cause:** A transaction-pooling proxy moved you to a different backend.
**Fix:** Session pooling, drop the names, or configure PgBouncer's prepared-statement
support.

**Symptom:** `Prepared statements must be unique`
**Cause:** One name used for two different statement texts — measured, `pg` rejects it
client-side.
**Fix:** One literal name per statement.

**Symptom:** Server memory grows with connection age
**Cause:** Dynamically generated statement names accumulating per session.
**Fix:** A small fixed set of names; `DEALLOCATE ALL` or `DISCARD ALL` when recycling.

**Symptom:** A query is fast for days, then permanently slow
**Cause:** The switch to a generic plan after the sixth execution, on skewed data.
**Fix:** `SET plan_cache_mode = force_custom_plan`, or drop the name for that query.

**Symptom:** No measurable speed-up from adding names
**Cause:** The query's execution time dominates its planning time, or a pool spreading
calls across connections that each warm up separately.
**Fix:** Expected. Reserve names for short, very frequent queries.

**Symptom:** `DISCARD ALL` fails
**Cause:** It cannot run inside a transaction.
**Fix:** End the transaction first.

## Interview questions

**★ What does adding `name` to a `pg` query do?**
It issues a server-side `PREPARE`, so the statement is parsed and planned once per
connection and later executions send only the parameter values. Measured: 2000 executions
took 772 ms unnamed and 481 ms named — about 1.6×. The saving is planning time, so it
matters for short, frequently executed queries.

**★ Why can a prepared statement get slower over time?**
Because PostgreSQL uses a custom plan for the first five executions and may switch to a
generic plan from the sixth — measured, `custom_plans: 5` and `generic_plans: 4` after nine
executions. A generic plan is chosen without the parameter values, so on skewed data it
can be badly wrong for some of them. `plan_cache_mode = force_custom_plan` restores
per-value planning.

**★ Are prepared statements shared across a pool?**
No — they are per session. Measured, a statement prepared on backend pid 1932 was invisible
to pid 1933. With a pool of N, each connection prepares independently, so warm-up is
per connection and the benefit accrues gradually.

**★ Why do prepared statements break behind PgBouncer?**
In transaction or statement pooling mode consecutive queries can be routed to different
server backends, and the statement exists only on the one that prepared it — producing
`26000 prepared statement does not exist`. Use session pooling, disable named statements,
or enable PgBouncer's prepared-statement tracking.

**Should you name every query?**
No. Reserve it for short, hot queries. Analytical queries are dominated by execution time,
dynamically built SQL has no stable text to name, and names have real costs — uniqueness,
server memory, pooler compatibility.

---

← [Overriding type parsers](09-pg-types.md) · Next → [Query timeouts](11-timeouts.md)
