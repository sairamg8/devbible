---
title: "The Neon HTTP driver does not solve the connection problem, it deletes it — an HTTP query has no session to keep alive, and everything you gain and everything you lose follows from that one substitution"
sidebar_label: "01e · The HTTP driver"
sidebar_position: 104
description: "`neon()` one-shot queries: why the query function is template-only, what `arrayMode`, `fullResults` and `fetchOptions` are for, the 64 MB transport ceiling, and exactly what a non-interactive transaction cannot express."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) and [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection); package version read from the npm registry.
> Documentation-verified; **no sandbox run**. The round-trip counts below are Neon's published figures, not measurements of mine.
> Target: **`@neondatabase/serverless` 1.1.0** · **Next.js 16.3.4** · Node 24.20.0 · PostgreSQL 18.4.

**`@neondatabase/serverless` replaces the TCP transport under a Postgres driver with either `fetch` or a WebSocket. That is the entire idea, and it is worth stating plainly because the marketing framing ("serverless Postgres driver") hides how ordinary the trade is. Over HTTP there is no session, so there is no connection to pool, leak, warm or exhaust — and equally no session state, no interactive transaction and no `LISTEN`. This page is the HTTP half; [01f](01f-websockets-pool-and-the-lifecycle-rule.md) is the WebSocket half, where you buy the session back and inherit the lifecycle problem with it.**

## Two transports, one package

> *"The Neon serverless driver is a low-latency Postgres driver for JavaScript and TypeScript that allows you to query data from serverless and edge environments over **HTTP** or **WebSockets** in place of TCP."*
> — [Neon · Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

The decision rule, in Neon's own words:

> *"**HTTP**: Querying over an HTTP fetch request is faster for single, non-interactive transactions, also referred to as \"one-shot queries\". Issuing multiple queries via a single, non-interactive transaction is also supported."*

> *"**WebSockets**: If you require session or interactive transaction support or compatibility with node-postgres (the popular npm `pg` package), use WebSockets."*

and the numbers Neon publishes for why HTTP wins on a single query:

> *"**HTTP** uses `fetch` requests. It is faster for single queries (~3 round trips vs. ~8 for TCP) and supports non-interactive transactions."*
> — [Neon · Choosing your connection method](https://neon.com/docs/connect/choose-connection)

⚠️ Those are Neon's figures for their proxy, quoted; I have not measured anything. Treat them as a statement about protocol shape — TLS plus Postgres startup plus authentication versus one HTTPS request — rather than as a benchmark you can port to another provider.

One hard prerequisite, easy to miss:

> *"The GA version of the Neon serverless driver, v1.0.0 and higher, requires Node.js version 19 or higher."*

## `neon()` and the template-literal-only query function

```ts
// lib/db/sql.ts
import 'server-only'
import { neon } from '@neondatabase/serverless'

// No pool, no lifecycle, no cleanup. This is a function, not a connection.
export const sql = neon(process.env.DATABASE_URL!)
```

```tsx
// A Server Component using it directly.
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db/sql'

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [card] = await sql`SELECT id, title, status FROM cards WHERE id = ${id}`
  if (!card) notFound()
  return <CardView card={card} />
}
```

The API deliberately refuses the unsafe shape:

> *"The function returns a query function that can only be used as a template function for improved safety against SQL injection vulnerabilities."*

That is a real design decision, not a documentation nicety. `sql("SELECT * FROM cards WHERE id = " + id)` is not something you can accidentally write, because plain-string invocation is not the calling convention. When you genuinely need a runtime-built statement there are two explicit escape hatches, and their names tell you which one is dangerous:

```ts
// Manual parameterisation — the pg-shaped API. Still fully parameterised.
const rows = await sql.query('SELECT * FROM cards WHERE id = $1', [id])

// Trusted-string interpolation. The name is the warning.
const table = isArchived ? 'archived_cards' : 'cards' // known-safe, from your own code
const rows2 = await sql`SELECT * FROM ${sql.unsafe(table)} WHERE id = ${id}`
```

Template fragments compose, which is what makes conditional filters survivable without pulling in a query builder:

```ts
const name = 'Olivia'
const limit = 1
const whereClause = sql`WHERE name = ${name}`
const limitClause = sql`LIMIT ${limit}`
// Neon: "Parameters are numbered appropriately at query time"
const result = await sql`SELECT * FROM table ${whereClause} ${limitClause}`
```

## Return shape, and the three options that change it

By default you get rows as objects. Three flags change behaviour, and all three are settable on `neon()` or per query:

| Option | Default | Effect |
|---|---|---|
| `arrayMode` | `false` | `true` returns rows as arrays of values instead of objects. |
| `fullResults` | `false` | `true` returns `{ rows, fields, rowCount, rowAsArray, command }` — Neon: *"The metadata matches what would be returned by `node-postgres`."* |
| `fetchOptions` | — | *"an object that is merged with the options to the `fetch` call."* |

`fetchOptions` is the one that matters operationally, because it is how you get a timeout on a database query in an environment where the driver gives you no `connectionTimeoutMillis` — there is no connection to configure.

```ts
const abortController = new AbortController()
const timeout = setTimeout(() => abortController.abort('timed out'), 10_000)
const rows = await sql('SELECT * FROM posts WHERE id = $1', [postId], {
  fetchOptions: { signal: abortController.signal },
})
clearTimeout(timeout)
```

`fullResults` is worth knowing about for one specific reason: `rowCount` is the only way to distinguish "the `UPDATE` matched nothing" from "the `UPDATE` matched and changed nothing" when you are not using `RETURNING`. Prefer `RETURNING` — it is one fewer flag and it gives you the row — but when you cannot, this is the lever.

## The size ceiling

> *"The maximum request size and response size for queries over HTTP is 64 MB."*

64 MB is generous for a page of cards and immediately fatal for a bulk import or a `SELECT *` over a large table. It is a **hard limit imposed by the transport**, not a tunable, and it is the first thing to check when a query that works in `psql` fails from the app with something that does not look like a SQL error.

## Non-interactive transactions: what `transaction()` can and cannot express

> *"The `transaction(queriesOrFn, options)` function is exposed as a property on the query function. It allows multiple queries to be executed within a single, non-interactive transaction."*

```ts
const showLatestN = 10

const [posts, tags] = await sql.transaction(
  [
    sql`SELECT * FROM posts ORDER BY posted_at DESC LIMIT ${showLatestN}`,
    sql`SELECT * FROM tags`,
  ],
  { isolationLevel: 'RepeatableRead', readOnly: true }
)
```

The options are `isolationLevel` (`ReadUncommitted` | `ReadCommitted` | `RepeatableRead` | `Serializable`), `readOnly`, and `deferrable` — with `deferrable` only meaningful *"if `readOnly` is also `true`, and `isolationLevel` is `Serializable`"*. See [PostgreSQL · isolation levels](../../../postgresql/pages/phase-11-mvcc/06-isolation-levels.md) for what each one actually guarantees.

🔴 **"Non-interactive" is the whole limitation and it is easy to skim past.** The full list of statements is fixed before the transaction starts. You cannot read a row, branch on its value in JavaScript, and then decide what to write — because the second statement would have to be constructed after the first one's result came back, and there is no open session to construct it into. Anything of the form *"check the balance, then debit if sufficient"* is not expressible here.

Two ways out. Push the branch into SQL:

```ts
// The conditional lives in the statement, so the whole thing is one round trip
// AND one transaction. Also removes a read-modify-write race by construction.
const [row] = await sql`
  UPDATE accounts
     SET balance = balance - ${amount}
   WHERE id = ${accountId} AND balance >= ${amount}
  RETURNING id, balance
`
if (!row) throw new InsufficientFunds()
```

Or switch transport, which is [01f](01f-websockets-pool-and-the-lifecycle-rule.md).

There is also a documented ergonomics trap:

> *"Note that options **cannot** be supplied for individual queries within a transaction."*

Options belong to `transaction()`, not to the individual `sql` calls inside its array. The doc says TypeScript will reject the wrong form; in plain JavaScript it silently does nothing.

## Retrying, and the read/write asymmetry

> *"Like any cloud database service, Neon may occasionally experience brief connection drops during maintenance, updates, or network interruptions. When using the Neon serverless driver, especially over HTTP, you should implement retry logic to handle these transient errors gracefully."*

Neon singles out HTTP for a structural reason: a TCP driver has a pool underneath it that can discard a bad client and hand you a fresh one, so a blip is often absorbed below your code. An HTTP query is one `fetch`; if it fails, it fails.

```ts
import retry from 'async-retry'

const result = await retry(async () => sql`SELECT * FROM users WHERE id = ${userId}`, {
  retries: 5, factor: 2, minTimeout: 1000, randomize: true,
})
```

🔴 Retry **reads** freely; retry **writes** only if they are idempotent. A retried `INSERT` without a unique key or an `ON CONFLICT` clause creates duplicates, and the failure that triggered the retry may well have committed before the response was lost.

```ts
// Idempotent by construction: the client supplies the key, the constraint absorbs the retry.
await sql`
  INSERT INTO cards (id, board_id, title)
  VALUES (${clientGeneratedId}, ${boardId}, ${title})
  ON CONFLICT (id) DO NOTHING
`
```

## Gotchas

**★ Symptom: `sql` is not a function, or a runtime-built query string is rejected.** Cause: `neon()` returns a *template* function; plain-string invocation is not the calling convention, by design — Neon says it *"can only be used as a template function for improved safety against SQL injection vulnerabilities."* Fix: use `sql.query(text, values)` for a manually parameterised statement, and `sql.unsafe()` only for identifiers you control.

```ts
const rows = await sql.query('SELECT * FROM cards WHERE board_id = $1 AND status = $2', [boardId, status])
```

**★ Symptom: a "transaction" built from separate `await sql` template calls does not roll back.** Cause: each template call is its own HTTP request and therefore its own transaction. There is no session holding them together and no `BEGIN` anywhere. Fix: use `sql.transaction()` with the statement list, which is the only way to get one transaction over HTTP.

```ts
// 🔴 Three transactions.
await sql`INSERT INTO cards (id, board_id, title) VALUES (${id}, ${boardId}, ${title})`
await sql`UPDATE columns SET card_count = card_count + 1 WHERE id = ${columnId}`
await sql`INSERT INTO events (kind, card_id) VALUES ('card.created', ${id})`

// ✅ One.
await sql.transaction([
  sql`INSERT INTO cards (id, board_id, title) VALUES (${id}, ${boardId}, ${title})`,
  sql`UPDATE columns SET card_count = card_count + 1 WHERE id = ${columnId}`,
  sql`INSERT INTO events (kind, card_id) VALUES ('card.created', ${id})`,
])
```

**★ Symptom: you cannot express "read, decide, then write" inside `sql.transaction()`.** Cause: it is non-interactive — the statement list is fixed before anything executes, so no later statement can depend on an earlier result. Fix: move the decision into SQL with a conditional `WHERE` and `RETURNING`, or switch to the WebSocket `Pool`.

```ts
const [claimed] = await sql`
  UPDATE jobs SET status = 'running', claimed_by = ${workerId}
   WHERE id = ${jobId} AND status = 'queued'
  RETURNING id
`
if (!claimed) return { ok: false, reason: 'already-claimed' }
```

**★ Symptom: a large `SELECT` or bulk `INSERT` fails from the app but succeeds in `psql`.** Cause: the HTTP transport's 64 MB request/response ceiling. It is not a SQL error and the message will not mention your query. Fix: page the read, or move the bulk path to a TCP connection — `COPY` over a direct connection is the right tool for imports. See [PostgreSQL · `COPY` streams](../../../postgresql/pages/phase-8-schema-from-node/09-copy-streams.md).

```ts
// Page it, and make the page size a function of row width, not a round number.
const PAGE = 500
for (let offset = 0; ; offset += PAGE) {
  const rows = await sql`SELECT id, title FROM cards ORDER BY id LIMIT ${PAGE} OFFSET ${offset}`
  if (rows.length === 0) break
  await handle(rows)
}
```

**★ Symptom: `arrayMode` or `fullResults` set on an individual query inside `sql.transaction()` has no effect.** Cause: *"options cannot be supplied for individual queries within a transaction"*; they belong on the `transaction()` call. Fix: hoist them.

```ts
// ✅
await sql.transaction([sql`SELECT now()`], { arrayMode: true })
```

**★ Symptom: an HTTP query hangs for the whole function timeout with no error.** Cause: `fetch` has no default timeout, and the HTTP driver exposes no `connectionTimeoutMillis` because there is no connection. Fix: pass an `AbortSignal` through `fetchOptions`, either per query or once on `neon()`, and set a server-side `statement_timeout` on the role so the database also stops doing the work.

```ts
export const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: { signal: AbortSignal.timeout(10_000) },
})
```

**★ Symptom: intermittent one-off failures under otherwise normal load.** Cause: transient drops during Neon maintenance; over HTTP there is no driver-level reconnect to absorb them. Fix: bounded retry with jitter for reads, and an idempotency key plus `ON CONFLICT` before you retry a write.

**★ Symptom: RLS policies do not apply when using the HTTP driver.** Cause: you connected as a role with `BYPASSRLS` — Neon names `neondb_owner` specifically — or you set the claim outside the transaction that reads. Fix: connect as a non-bypassing role and set the claim inside `sql.transaction()` with `set_config(..., true)`, as in [01c](01c-transaction-pooling-and-session-state.md).

```ts
const [, rows] = await sql.transaction([
  sql`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`,
  sql`SELECT * FROM cards WHERE board_id = ${boardId}`,
])
```

**★ Symptom: `sql.unsafe()` crept into a code path that takes user input.** Cause: it is the only interpolating escape hatch and it is easy to reach for when building a dynamic `ORDER BY`. Fix: never pass a request value to it — map to an allowlist first, so the value that reaches `unsafe()` is one of a fixed set of literals you wrote.

```ts
const SORTS = { newest: 'created_at DESC', title: 'title ASC' } as const
const order = SORTS[sortParam as keyof typeof SORTS] ?? SORTS.newest
const rows = await sql`SELECT * FROM cards WHERE board_id = ${boardId} ORDER BY ${sql.unsafe(order)}`
```

## Interview questions

**★ Why does an HTTP Postgres driver not need a connection pool?**
Because a pool exists to amortise the cost of establishing and keeping a session, and an HTTP query has no session. Each query is an HTTPS request carrying SQL and parameters; the proxy on the far side owns the actual Postgres connection and its lifecycle. Nothing on your side is stateful, so there is nothing to warm, nothing to leak, nothing to close, and nothing to exhaust — which is exactly why it suits a runtime whose process lifetime you do not control. The cost of the deal is everything session-shaped: no interactive transaction, no `SET`, no `LISTEN`, no cursors held across statements.

**★ What is a "non-interactive transaction" and what can it not do?**
It is a transaction whose complete statement list is known before execution starts. The driver ships all of them together, the server wraps them in `BEGIN`/`COMMIT`, and you get back an array of results. What it cannot do is branch: you cannot read a row, evaluate it in JavaScript, and choose the next statement based on the answer, because there is no open session to send that next statement into. Any read-modify-write with a business rule in the middle has to be re-expressed as a single conditional statement — `UPDATE … WHERE balance >= $1 RETURNING …` — or move to a transport with a real session. The good news is that pushing the condition into SQL usually also fixes a race condition the JavaScript version had.

**★ The `neon()` query function refuses plain strings. Is that just inconvenience?**
No, it is the injection defence expressed as an API constraint rather than a lint rule. If the only way to call the function is as a tagged template, then every interpolated value arrives as a parameter and cannot become part of the statement text — the mistake is not available. Compare that with a driver that accepts a string, where the safe and unsafe calls look almost identical and correctness depends on every developer, forever. The escape hatches exist because identifiers genuinely cannot be parameterised, and the one that interpolates is named `unsafe()`, so a reviewer can find every occurrence with one grep. That is a considerably stronger position than "we use parameterised queries by convention".

**★ How do you time out a query on the HTTP driver?**
With an `AbortSignal` passed through `fetchOptions`, because the transport is `fetch` and `fetch` has no default timeout. There is no `connectionTimeoutMillis` equivalent on the driver, because there is no connection object to configure. If you forget, a slow query consumes the whole function invocation budget and dies with the platform's timeout rather than yours, which loses you the diagnosis. The other half of the answer is server-side: a `statement_timeout` set on the application role bounds the query at the database, which is the layer that can actually cancel the work rather than merely stopping waiting for it. Aborting the fetch does not necessarily stop the query.

**★ Why does Neon single out HTTP as the transport that most needs retry logic, and how do you retry safely?**
A TCP driver has a connection object with reconnect behaviour, error events and a pool that can discard a bad client — a transient blip is often absorbed below your code. An HTTP query is one `fetch`; if the request fails, it fails, and nothing underneath does anything about it. So bounded retry with exponential backoff and jitter becomes an application-level responsibility. Safety comes from distinguishing reads from writes: reads are naturally idempotent and can be retried freely, whereas a retried write needs a uniqueness constraint or an `ON CONFLICT` clause, because the request that appeared to fail may have committed before the response was lost. The client-generated id is what turns "at least once" into "exactly once" here.

**★ A colleague says the Edge runtime is why we should use the HTTP driver. Is that still the argument?**
Not on Next.js 16. Proxy has defaulted to the Node.js runtime since 16.0 and the `runtime = 'edge'` segment value is deprecated as of 16.3, so "my code cannot open a TCP socket" is no longer the common case it was. The remaining arguments for HTTP are about shape rather than capability: fewer round trips for a single query, no connection object with a lifecycle to get wrong, and no possibility of a leaked pool in a runtime you do not control. Those are good arguments. Choosing it *because of the edge* in 2026 answers a question the framework stopped asking, and it will lead you to accept the non-interactive transaction limit for no benefit.

**★ When does the 64 MB HTTP ceiling actually bite, and what do you do about it?**
It bites on exports, bulk imports, and any `SELECT` that returns a large `jsonb` or `bytea` column across many rows — the classic case is a "download all my data" endpoint written as one query. It also bites on the request side for a multi-megabyte `INSERT … VALUES` list built in a loop. The fix is to stop treating the HTTP driver as a general-purpose data pipe: page reads with `LIMIT`/`OFFSET` or keyset pagination, and move bulk writes to a direct TCP connection where `COPY` is available, which is faster than a large `INSERT` anyway. The important part is recognising the failure, because the error comes from the transport and says nothing about SQL.

---

← [01d · Prepared statements](01d-prepared-statements-under-a-pooler.md) · Next → [01f · WebSockets, `Pool` and the lifecycle rule](01f-websockets-pool-and-the-lifecycle-rule.md)
