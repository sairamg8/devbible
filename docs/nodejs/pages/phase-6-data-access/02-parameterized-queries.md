---
title: "Parameterized queries"
sidebar_label: "02 · Parameterized queries"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, `pg` 8.23.0 / PostgreSQL 17.10 and
> `mongodb` 7.5.0 / MongoDB 8.2.12.

**Never build a query out of string concatenation. Not for a number, not for an
enum you validated, not "just this once for the admin page".** The rule has no
exceptions worth the argument, and the fix is shorter than the vulnerability.

```js
// ✗
const {rows} = await pool.query(`select id, email from users where email = '${email}'`);
// ✓
const {rows} = await pool.query('select id, email from users where email = $1', [email]);
```

## What concatenation actually costs

A login lookup, built by hand, given three different inputs. Every line below is
real output.

```console
$ node ex3-injection.mjs
-- concatenated, honest input --
  sql: select id, email from users where email = 'user1@example.com'
  rows: [ { id: 1, email: 'user1@example.com' } ]

-- concatenated, hostile input: always-true --
  sql: select id, email from users where email = 'x' or '1'='1'
  rows: 500 rows returned

-- concatenated, hostile input: reading another table --
  sql: select id, email from users where email = 'x' union all select id, token from sessions --'
  rows: [
  { id: 1, email: 'sk_live_9f3a...' },
  { id: 2, email: 'sk_live_77bd...' }
]
```

The second returns the entire user table. The third returns **session tokens from a
table the query never mentioned**, in a response field the frontend will happily
render. No error, no warning, HTTP 200.

## Stacked statements really do execute

The comforting belief is that `pg` only ever runs one statement, so `'; drop
table` cannot work. It does work:

```console
-- concatenated, hostile input: destructive --
  sql: select id, email from users where email = 'x'; drop table sessions; --'
  sessions table still there? null
```

`to_regclass('sessions')` returned `null` — **the table is gone.** The reason is
protocol-level: `pool.query(text)` with **no parameters** uses Postgres's *simple
query* protocol, which accepts multiple statements separated by semicolons. Pass
even one parameter and the driver switches to the extended protocol, where the
server refuses:

```console
multi-statement WITH a param -> 42601 | cannot insert multiple commands into a prepared statement
```

So the same string is dangerous or harmless depending on whether you used
placeholders. That is not a distinction to leave to chance.

## Why placeholders are safe

A parameter is never parsed as SQL. The server plans
`select … where email = $1` first and then binds `$1` as a *value*. There is no
grammar in which the value can become syntax:

```console
-- the same hostile inputs, parameterized --
  $1 = "x' or '1'='1" -> rows: 0
  $1 = "x' union all select id, token from sessions --" -> rows: 0
```

Zero rows, because no user has that literal email address. Exactly right.

This also means **you cannot escape your way to safety**. Hand-rolled quote
doubling has to be perfect against every encoding, every backslash mode and every
place a value is not quoted at all. Placeholders sidestep the entire class.

## Placeholders are values, never identifiers

```console
$1 as a table name -> 42601 syntax error at or near "$1"
```

Table names, column names, `ORDER BY` targets and `ASC`/`DESC` cannot be
parameters. That is where injection sneaks back in, usually as a sort feature:

```js
// ✗ req.query.sortBy is now SQL
await pool.query(`select * from orders order by ${req.query.sortBy}`);
```

Two fixes, in order of preference:

```js
// 1. an allow-list. Boring, and it cannot be wrong.
const COLUMNS = {date: 'placed_at', total: 'total_cents', status: 'status'};
const column = COLUMNS[req.query.sortBy] ?? 'placed_at';
const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
await pool.query(`select * from orders order by ${column} ${dir}`);

// 2. quote it, when the set of names is genuinely dynamic
await pool.query(`select * from orders order by ${pg.escapeIdentifier(name)}`);
```

```console
quoted identifier instead: pg.escapeIdentifier -> "email; drop table sessions; --"
```

The whole hostile string became one quoted identifier — which then fails as
"column does not exist" instead of dropping a table. An allow-list is still
better: it fails at *your* boundary with a 400, not at the database.

## Lists: one parameter, not `n`

Building `in ($1, $2, $3…)` by joining indexes is where people give up and
concatenate. Don't — pass the array:

```js
const {rows} = await pool.query(
  'select id from users where id = any($1::int[])', [[1, 2, 3]]);
```

```console
= any($1) -> [ 1, 2, 3 ]
```

One parameter, any length, and the plan is reusable ([page
04](./04-postgresql-from-node.md) on prepared statements).

## MongoDB: no SQL, same wound

There is no query string to concatenate, so the hole moves to **object shape**. A
JSON body can carry an operator where your code expects a string:

```js
// the handler
await accounts.findOne({username: body.username, password: body.password});
```

```console
-- mongo: filter built from the request body --
  honest  -> { username: 'ada', password: 'hunter2', role: 'admin' }
  hostile -> { username: 'ada', password: 'hunter2', role: 'admin' }
```

The hostile request body was `{"username":"ada","password":{"$ne":null}}` — "any
password that is not null". **It logged in as the admin.** `{"$regex":"^h"}` is
the quieter version: it confirms a password *prefix*, one character at a time,
until the whole secret is recovered.

Three defences, use all of them:

```js
// 1. validate at the boundary so the type is a string before it reaches the driver
const {username, password} = LoginSchema.parse(req.body);   // zod / valibot

// 2. force values to be values
await accounts.findOne({username: {$eq: String(username)}, password: {$eq: String(password)}});
```

```console
  hostile, with $eq + String() -> null
```

```js
// 3. never enable server-side JavaScript
```

```console
  $where -> [ 'ada', 'bob' ]
```

`$where` ran arbitrary JavaScript inside the database. Disable it server-side
(`security.javascriptEnabled: false`), and never let user input near `$where`,
`$accumulator` or `$function`.

Of course, storing a raw password at all is its own crime — [Phase
8](../../syllabus/03-application.md) covers hashing. The injection is the point
here.

## Gotchas

**Symptom:** A search box returns every row in the table
**Cause:** Concatenated input closed the quote and added `or '1'='1`.
**Fix:** Placeholders. Audit for backticks around SQL.

**Symptom:** A table disappeared and no deploy touched it
**Cause:** A stacked `; drop table …` through a no-parameter `pool.query`, which
uses the simple protocol.
**Fix:** Placeholders everywhere; grant the app role only the privileges it needs.

**Symptom:** `syntax error at or near "$1"`
**Cause:** A placeholder used where SQL expects an identifier or keyword.
**Fix:** Allow-list the column and direction; `pg.escapeIdentifier` if it must be
dynamic.

**Symptom:** Login succeeds with a wrong password from an API client but not from
the browser
**Cause:** The JSON body carried `{"$ne": null}`; the browser form could only send
a string.
**Fix:** Parse the body into typed values, and wrap comparisons in `$eq`.

**Symptom:** ORM code is safe but one report endpoint is not
**Cause:** The raw escape hatch (`$queryRawUnsafe`, `sql.raw`, `knex.raw`) with
interpolation.
**Fix:** Use the tagged-template form, which parameterizes — a
``sql`… where email = ${input}` `` template sends `$1`.

## Interview questions

**★ Why is a parameterized query safe when escaping is not?**
The parameter never passes through the SQL parser. The statement is planned first
and the value is bound afterwards, so there is no sequence of characters that can
turn a value into syntax. Escaping tries to enumerate dangerous characters, which
is a moving target across encodings and quoting modes.

**★ Can `node-postgres` really execute `; drop table users; --`?**
Yes, when the query has no parameters — that path uses the simple query protocol,
which permits multiple statements. Verified: the table was dropped. Adding any
parameter switches to the extended protocol, where the server answers
`42601 cannot insert multiple commands into a prepared statement`.

**★ How do you parameterize an `ORDER BY` column?**
You cannot — placeholders are values only. Map the user's input through an
allow-list of permitted column names, or quote it with `pg.escapeIdentifier`.

**★ MongoDB has no SQL. How is it injectable?**
Because the filter is an object, and JSON can carry an operator where a string was
expected. `{"password":{"$ne":null}}` matches any record — measured here logging in
as an admin. `$regex` leaks the value one character at a time, and `$where` runs
JavaScript on the server.

**★ What is the fix for operator injection?**
Validate the body into typed values at the boundary, and compare with `{$eq: value}`
so an object can never be interpreted as an operator. Keep server-side JavaScript
disabled.

**Does an ORM make you safe from injection?**
For its generated queries, yes — they parameterize. The raw escape hatch every ORM
provides does not, unless you use its tagged-template form. That one endpoint is
where the vulnerability lives.

---

← Prev: [Connection pooling](./01-connection-pooling.md) · Next → [Driver lifecycle](./03-driver-lifecycle.md)
