---
title: "pg vs postgres.js"
sidebar_label: "16 · pg vs postgres.js"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, `postgres` 3.4.9. Script:
> `sandbox/pg-api/ex22-notify-cursor-pgjs.mjs`.

**`postgres.js` replaces `$1` placeholders with tagged templates, so interpolation *is*
parameterization. It is a genuinely nicer API. It is also a second ecosystem, and `pg` is
what most tooling expects — so the honest answer for an existing codebase is usually
"no".**

## The same query, both ways

```js
// pg
const {rows} = await pool.query(
  'SELECT id, junk FROM cur_t WHERE id <= $1 ORDER BY id', [5]);

// postgres.js
const rows = await sql`SELECT id, junk FROM cur_t WHERE id <= ${5} ORDER BY id`;
```

```console
$ node ex22-notify-cursor-pgjs.mjs
=== 3. postgres.js — the same work, a different shape ===
tagged template → 5 rows; result is an Array: true | .count = 5
  the interpolation is a PARAMETER, not string concatenation
```

The result *is* the array — no `.rows` — with metadata hung off it as `.count`. That
removes the most common `pg` papercut, forgetting `.rows`.

## Interpolation is parameterization

```console
injection payload as a value → 0 rows; table still there: cur_t
```

```js
const evil = `1; DROP TABLE cur_t; --`;
await sql`SELECT count(*)::int AS n FROM cur_t WHERE junk = ${evil}`;
```

`${}` inside the tag **never** becomes SQL text — the library sends it as a bind
parameter. Compare the same payload concatenated into a `pg` query string, which dropped
a table ([Parameterized queries](../phase-4-crud/08-parameters.md)).

This is the real argument for the library: the safe path is the *default* path. In `pg`
you must remember to use `$1`; here you would have to go out of your way to be unsafe.

Identifiers still need an escape hatch, since they cannot be parameters:

```console
sql(identifier) → [{"id":"1"},{"id":"2"}]
```

```js
const col = 'id';                                   // still allowlist this
await sql`SELECT ${sql(col)} FROM cur_t ORDER BY id LIMIT 2`;
```

`sql(...)` marks a value as an identifier and quotes it properly. **It does not make user
input safe** — an attacker-controlled column name is still a bad idea; allowlist it
exactly as in [Allowlists](../phase-9-api-crud/allowlists/).

## Type decisions are the same

```console
types → {
  big: 'string "9007199254740993"',
  num: 'string "10.50"',
  d: 'Date',
  arr: true
}
```

`bigint` and `numeric` are strings, `date` is a `Date`, arrays are arrays. Switching
drivers changes none of the trade-offs in [Type parsing](08-type-parsing.md) — including
the `date`-becomes-local-midnight trap. Do not expect a migration to fix those.

## What each does better

| | `pg` | `postgres.js` |
|---|---|---|
| Query API | `$1` placeholders | Tagged templates |
| Safe by default | With discipline | By construction |
| Result | `Result` with `.rows` | The array itself |
| Pooling | `Pool` | Built in |
| Transactions | Manual `BEGIN`/`COMMIT` on a client | `sql.begin(async sql => …)` |
| `LISTEN` | Dedicated `Client` | `sql.listen()`, reconnects for you |
| Streaming | `pg-cursor` | `.cursor()` / `.forEach()` built in |
| Module format | CJS + ESM | ESM-first |
| Ecosystem | Assumed by most tools | Fewer integrations |
| Maturity | Since 2010, very widely deployed | Newer, smaller surface |

`postgres.js`'s transaction API is the other genuine ergonomic win, because it makes the
release-in-`finally` discipline structural:

```js
await sql.begin(async (sql) => {
  const [order] = await sql`INSERT INTO orders ${sql({userId, total})} RETURNING id`;
  await sql`INSERT INTO order_items ${sql({orderId: order.id, sku})}`;
});
```

Compare the hand-rolled `withTransaction` in
[`pool.connect` and release](07-connect-release.md) — same semantics, and here you cannot
forget the rollback.

## What "faster" means here

`postgres.js` advertises better throughput, and its pipelining does help on
round-trip-bound workloads. **This corpus has not benchmarked the two head to head**, and
driver micro-benchmarks are easy to get wrong — a fair comparison has to control for
pool size, prepared statements, parsing, and whether the workload is round-trip bound at
all.

What is measured here is that the things that actually dominate query time are elsewhere:
a missing index turns 1.22 ms into 105.85 ms
([`LIMIT`/`OFFSET`](../phase-4-crud/03-limit-offset.md)), and `unnest` beats row-by-row
inserts by 241× ([`INSERT`](../phase-4-crud/04-insert.md)). Driver choice is not where
the wins are.

## When to choose which

**Choose `pg`** for an existing codebase, when your dependencies expect it — session
stores, job queues, `node-pg-migrate`, most ORM escape hatches — or when you want the
option most people you hire will already know.

**Choose `postgres.js`** for a greenfield ESM service, especially where a team is writing
raw SQL by hand and you want the safe path to be the default one, or where the built-in
transaction and `LISTEN` handling saves real code.

**Do not migrate an existing codebase for the API alone.** Every query, every test and
every helper changes; the placeholder-to-template rewrite is mechanical but exhaustive,
and the risk is concentrated in exactly the queries you touch least. Since neither driver
changes your schema, indexes or query plans, the payoff is ergonomics — worth it for new
code, rarely worth it for old.

Both can coexist during a migration: they are independent connection pools to the same
database. Two pools means two connection budgets, so size them together
([Installing and wiring pg](01-install-wire.md)).

## Trade-off

Tagged templates make injection structurally hard and remove ceremony, at the cost of a
smaller ecosystem, ESM-first packaging, and an API that fewer developers and fewer tools
know. `pg` is the boring choice — more verbose, easy to misuse if you concatenate, and
supported by everything.

The rest of this corpus uses `pg` for exactly that reason: it is what the surrounding
tooling assumes, and its explicit `$1`/`Result` shape makes the protocol behaviour visible
in a way that teaches better.

## Gotchas

**Symptom:** `rows.rows` is undefined after switching to `postgres.js`
**Cause:** The result *is* the array; metadata is on `.count`.
**Fix:** Use it directly.

**Symptom:** A dynamic column name is rejected or misquoted
**Cause:** `${col}` sends it as a *value*.
**Fix:** `sql(col)` — and still allowlist the input.

**Symptom:** `bigint` is still a string after migrating
**Cause:** Both drivers make the same precision-preserving choice.
**Fix:** Expected — see [Type parsing](08-type-parsing.md).

**Symptom:** A library fails to accept the connection
**Cause:** It expects a `pg` `Pool` instance.
**Fix:** Keep a `pg` pool for that library, or stay on `pg`.

**Symptom:** Connection count doubles during a migration between drivers
**Cause:** Two independent pools.
**Fix:** Size both against `max_connections`.

**Symptom:** `require('postgres')` fails
**Cause:** ESM-first packaging.
**Fix:** Use `import`, or a dynamic `import()` from CommonJS.

## Interview questions

**★ What is the main advantage of `postgres.js` over `pg`?**
Tagged templates make interpolation a bind parameter, so the ergonomic path and the safe
path are the same — measured, an injection payload interpolated directly into a template
was sent as a value and the table survived. With `pg` you have to remember `$1`. It also
has pooling, transactions, `LISTEN` and cursors built in rather than as separate concerns.

**★ Would you migrate an existing `pg` codebase to it?**
Usually not. Every query, helper and test changes, much of your tooling expects a `pg`
`Pool`, and neither driver affects schema, indexes or plans — so the payoff is ergonomics
rather than performance or correctness. It is a good default for a greenfield ESM
service.

**★ Does switching drivers fix the `bigint`-as-string or `date` timezone behaviour?**
No — measured, `postgres.js` returns `bigint` and `numeric` as strings and `date` as a
`Date`, the same as `pg`. Those follow from JavaScript's number type and the shape of the
data, not from the driver.

**Is `${value}` inside a `postgres.js` template safe?**
Yes for values — it is sent as a bind parameter, never as SQL text. Identifiers need
`sql(name)`, and that quotes rather than validates, so user-supplied column names still
need an allowlist.

**Which is faster?**
Not benchmarked here, and it rarely decides anything. `postgres.js` pipelines well on
round-trip-bound workloads, but measured query costs in this corpus are dominated by
indexes and statement shape — a deep `OFFSET` costing 87× more than a keyset lookup dwarfs
any driver difference.

---

← [pg-cursor streaming](15-cursors.md) · Next → [Phase 8 · Schema and data from Node](../phase-8-schema-from-node/)
