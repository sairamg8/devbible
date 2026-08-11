---
title: "PostgreSQL from Node"
sidebar_label: "04 · PostgreSQL from Node"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, `pg` 8.23.0 against **PostgreSQL 17.10**.

**`pg` is the driver everything else is built on** — Knex, Drizzle, Prisma's
adapter, TypeORM. Learning it directly means the layer above is never magic, and
the day you need to drop below it you already can.

```bash
npm install pg
```

## `Pool` or `Client`

| | `Client` | `Pool` |
|---|---|---|
| What it is | One connection | A managed set of `Client`s |
| Connects | `await client.connect()` | Lazily, on first query |
| Use for | Transactions, cursors, `LISTEN`, migrations, one-shot scripts | **Everything a server does** |

`Pool` is the default answer ([page 01](./01-connection-pooling.md)). Reach for a
`Client` — or `pool.connect()`, which hands you one — only when consecutive
statements must land on the *same* connection.

```js
import pg from 'pg';                                  // CommonJS package: default import
const {Pool} = pg;

export const pool = new Pool({connectionString: process.env.DATABASE_URL});
```

`pg` is CommonJS, so `import {Pool} from 'pg'` works through Node's named-export
detection but `import pg from 'pg'` is the form that never surprises you
([Phase 1, page 04](../phase-1-modules/04-cjs-esm-interop.md)).

## The result object

```js
const result = await pool.query('select id, email from users where id = $1', [7]);
```

```console
by id: { id: 7, email: 'user7@example.com' } | rowCount 1
command: SELECT rowCount: 1 field 0 dataTypeID: 23
```

- **`rows`** — an array of plain objects, always. No rows is `[]`, not `null`.
- **`rowCount`** — rows returned, or rows *affected* for `update`/`delete`. The
  cheapest way to answer "did that update anything?".
- **`fields`** — column metadata, including `dataTypeID`, the Postgres OID.
- **`command`** — `SELECT`, `INSERT`, …

`rowMode: 'array'` skips building objects, which matters only when you are
exporting hundreds of thousands of rows:

```console
rowMode array -> [[1,"user1@example.com"],[2,"user2@example.com"]]
```

## Types: what the driver hands you

This is the part that bites. Postgres types do not map cleanly onto JavaScript
ones, and `pg` chooses **correctness over convenience**:

```console
$ node ex2-pg-types.mjs
int4     number = 42
int8     string = "42"
numeric  string = "42.50"
float8   number = 42.5
bool     boolean = true
ts       object = 2026-08-10T12:06:11.101Z
date     object = 2026-08-09T18:30:00.000Z
jsonb    object = {"a":1}
arr      object = [1,2,3]
nothing  object = null
```

**`int8` and `numeric` arrive as strings.** A `bigint` does not fit in a JS
`number`, and `numeric` is arbitrary-precision decimal — turning either into a
float would silently corrupt money. So the driver refuses to guess.

The most common way this surfaces:

```console
count(*) -> "5000" | + 1 = 50001
```

`count(*)` is `int8`, so `count + 1` is **string concatenation**. Cast in SQL when
you know the value is small — `count(*)::int` — or convert explicitly in the
mapping layer ([page 10](./10-repository-pattern.md)):

```js
const total = Number(rows[0].count);              // safe below 2^53
const cents = BigInt(rows[0].total_cents);        // safe always
```

You can change the mapping globally, and it applies to every connection:

```js
pg.types.setTypeParser(20, (v) => BigInt(v));     // 20 = INT8
```

```console
after setTypeParser(20) -> count is a bigint 5000n
```

That is a whole-process decision — libraries built on `pg` see it too. Prefer
converting in one mapping function unless the whole codebase agrees.

### The `date` trap

Look again at that output. `current_date` — a plain calendar date, no time, no zone
— came back as `2026-08-09T18:30:00.000Z`. The driver built a `Date` at **local
midnight**, and in a `UTC+05:30` process that is the previous day in UTC.
`JSON.stringify` then ships yesterday to the client.

For `date` columns, either read them as strings or format in SQL:

```js
pg.types.setTypeParser(1082, (v) => v);           // 1082 = DATE, keep 'YYYY-MM-DD'
```

`timestamptz` is fine — it is an instant, and `Date` is an instant.

## Writes worth knowing

```js
const {rows} = await pool.query(
  `insert into users (email, display_name) values ($1, $2)
   on conflict (email) do update set display_name = excluded.display_name
   returning id, created_at`,
  [email, name]);
```

```console
insert ... returning -> { id: 501, created_at: 2026-08-10T12:06:11.135Z }
```

**`returning`** saves the round trip that a select-after-insert costs, and it is
the only race-free way to get a generated id. **`on conflict … do update`** is an
upsert in one statement — the read-then-write version is a race between two
requests.

## Prepared statements

Naming a query lets the server plan it once and reuse the plan for that connection:

```js
await pool.query({
  name: 'order-by-id',
  text: 'select id from orders where id = $1',
  values: [id],
});
```

```console
200 lookups: unnamed 120 ms | named (prepared) 78 ms
```

**35% off a trivial query**, and more on a complex one. Two caveats: the plan is
per-connection, so a pool prepares it once per connection; and a name must always
map to the same SQL, or `pg` throws.

Do not reach for this first. It is worth it for a hot query in a loop, not for
everything.

## `LISTEN` / `NOTIFY`

Postgres can push. This needs a dedicated `Client`, because a pooled connection
would wander:

```js
const listener = new pg.Client({connectionString: process.env.DATABASE_URL});
await listener.connect();
await listener.query('LISTEN order_paid');
listener.on('notification', (msg) => {
  handle(JSON.parse(msg.payload));                 // payload is text, max 8000 bytes
});
```

It is fire-and-forget: a listener that is disconnected misses everything sent while
it was away, so it is a *cache invalidation* or *wake up and check the table*
signal, never a queue ([Phase 7](../../syllabus/03-application.md)).

## Errors are `code`, not message

```js
try {
  await pool.query('insert into users (email, display_name) values ($1, $2)', [email, name]);
} catch (err) {
  if (err.code === '23505') return res.status(409).json({error: 'email already registered'});
  throw err;
}
```

| Code | Meaning | Usual response |
|---|---|---|
| `23505` | unique violation | 409 |
| `23503` | foreign key violation | 400 or 409 |
| `23514` | check constraint | 400 |
| `25P02` | transaction aborted, statements ignored | rollback |
| `57014` | canceled by `statement_timeout` | 504 |
| `53300` | too many clients | 503 |
| `28P01` | password auth failed | boot failure |
| `42601` | syntax error | your bug |

Never match on `err.message` — it is localised and it changes between versions.
`err.constraint` names the exact constraint, which is how you turn `23505` into a
message that says *which* field collided.

## Gotchas

**Symptom:** A total is `"1234"` or a sum comes out as `"12" + "34"`
**Cause:** `int8` / `numeric` are returned as strings on purpose.
**Fix:** Cast in SQL (`::int`, `::float8`) or convert in your mapper. Don't
`parseFloat` money.

**Symptom:** Dates are off by one day for some users
**Cause:** A `date` column became a `Date` at local midnight, then serialised to
UTC.
**Fix:** Keep `date` as a string (`setTypeParser(1082, v => v)`) or format in SQL.

**Symptom:** `error: bind message supplies 1 parameters, but prepared statement requires 2`
**Cause:** Placeholder numbering — `$1`/`$2` must be contiguous and match the array.
**Fix:** Build the values array alongside the SQL, never by hand-editing one side.

**Symptom:** `cannot insert multiple commands into a prepared statement`
**Cause:** A multi-statement string sent with parameters.
**Fix:** One statement per `query()`, or use `client.query` inside an explicit
transaction.

**Symptom:** Every request re-plans an expensive query
**Cause:** Unnamed statements are planned each time.
**Fix:** Name the hot ones; measure before and after.

**Symptom:** `column "x" does not exist` for a value you passed
**Cause:** Double quotes around a *value* — `"abc"` is an identifier in SQL.
**Fix:** Single quotes are for literals; better, use `$1`.

## Interview questions

**★ Why does `pg` return `bigint` and `numeric` as strings?**
Because neither fits JavaScript's `number` safely — `int8` exceeds 2^53 and
`numeric` is arbitrary-precision decimal. Returning a float would silently corrupt
money and large ids, so the driver hands you the exact text and lets you choose
`Number`, `BigInt` or a decimal library. It is why `count(*) + 1` gives `"50001"`.

**★ When do you need `pool.connect()` instead of `pool.query()`?**
When several statements must run on the *same* connection: transactions, cursors,
`LISTEN`, `set local`. Everything else should use `pool.query()`, which cannot leak
a connection.

**★ What does `RETURNING` buy you?**
The generated row in the same round trip as the write, with no race. Without it you
need a second query, and `select max(id)` or a re-read can see another
transaction's row.

**★ How do you handle a duplicate email cleanly?**
Let the unique index reject it and catch `err.code === '23505'`, mapping it to 409.
Checking first and then inserting is a race — two concurrent requests both see
"available".

**★ What does a named/prepared statement change?**
The server plans the SQL once per connection and reuses the plan; measured 120 ms →
78 ms for 200 lookups. The plan is per-connection, and one name must always mean
one query.

**Why must you never build error handling on `err.message`?**
It is human-facing text: localised, version-dependent, and it includes values.
`err.code` is the stable SQLSTATE contract, and `err.constraint` tells you which
constraint fired.

---

← Prev: [Driver lifecycle](./03-driver-lifecycle.md) · Next → [MongoDB from Node](./05-mongodb-from-node.md)
