---
title: "A driver error is a schema disclosure with a stack trace attached, and the reason it reaches clients is never a decision — it is the one code path nobody wrote a test for"
sidebar_label: "10b · Never leak a driver error"
sidebar_position: 54
description: "What a Postgres error object actually contains, why the same SQLSTATE means different things in different queries, converting at the DAL boundary, logging the cause without logging the row, and the paths the translator never sees."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 [Error Codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html) and [Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html), and the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`). SQLSTATE values are quoted from the appendix rather than recalled; **no error text on this page was reconstructed from memory** — where a real message would be needed to make a point, the mechanism is described instead.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**Nobody decides to return a database error to a client. It arrives through the path that had no `catch`, or through a `catch` that logged and re-threw, or through a `JSON.stringify(err)` written during a debugging session and never removed — and what arrives is not a message, it is a disclosure. A Postgres error carries the constraint name, which carries the column names, which carries the shape of your uniqueness rules. It carries the table. Under some configurations it carries the statement. An attacker who can provoke one has been handed a partial schema and, more usefully, a map of which inputs reach which query. This page is the conversion that stops it, where the conversion belongs, and — the part that actually matters — the paths where the conversion never runs at all.**

## What is actually in the object

A `pg` error is an `Error` subclass with structured fields populated from the server's `ErrorResponse` message. The fields that matter here, described rather than quoted, because their *contents* are your schema:

| Field | What it holds | Safe to return? |
|---|---|---|
| `code` | the five-character `SQLSTATE` | ✅ **after translation**, never raw |
| `constraint` | the constraint's name — usually built from table and column names | 🔴 **no** |
| `table`, `column`, `schema` | exactly what they say | 🔴 **no** |
| `detail` | often includes **the offending value** | 🔴 **no** — it can contain user data belonging to another tenant |
| `message` | the server's rendering, frequently embedding `constraint` and `detail` | 🔴 **no** |
| `severity`, `position`, `where` | statement position and context | 🔴 **no** |

🔴 **`detail` is the worst of them, and it is the one people assume is safe** because it sounds like debugging metadata. For a unique violation it identifies the row that already exists — which, in a multi-tenant table, is a row the caller has no right to know about. Returning it turns a duplicate-key error into an existence oracle: an attacker submits values and learns which ones are already taken by somebody else.

## The same SQLSTATE means different things in different queries

This is why the conversion cannot live at the edge, and it is the argument for the boundary this chapter draws.

`23505` is `unique_violation`. In this chapter it can arise from at least three unrelated situations:

```
23505 raised by INSERT INTO cards ... on the (board_id, position) unique index
      -> "that position is taken"           -> conflict, and the fix is a retry with a new position

23505 raised by INSERT INTO cards ... on the idempotency-key unique index
      -> "you already sent this request"    -> NOT an error at all; replay the original 201

23505 raised by restoring a soft-deleted card whose title collides with a live one
      -> "cannot restore under that title"  -> conflict, and the fix is the caller's
```

**One code, three meanings, three responses — and the only thing that distinguishes them is which query was running.** A translator at the Route Handler has lost that; it sees `23505` and can do nothing better than "conflict". A translator inside the DAL function that issued the statement knows exactly which of the three it is.

🔴 **So the rule is: convert where the query was written, not where the request arrived.**

```ts
// db/cards.ts — inside the DAL, next to the statement that can raise it
import { ApiFailure } from '@/lib/errors'

const UNIQUE_VIOLATION = '23505'          // PostgreSQL 18 Error Codes appendix, Class 23
const FOREIGN_KEY_VIOLATION = '23503'
const NOT_NULL_VIOLATION = '23502'
const CHECK_VIOLATION = '23514'

function isPgError(e: unknown): e is { code?: string; constraint?: string } {
  return typeof e === 'object' && e !== null && 'code' in e
}

export async function insertCard(input: NewCard): Promise<CardDTO> {
  try {
    const [row] = await db.insert(cards).values(input).returning()
    return toCardDTO(row)
  } catch (e) {
    if (isPgError(e)) {
      // The constraint name is used to DECIDE, and is never returned.
      if (e.code === UNIQUE_VIOLATION && e.constraint === 'cards_board_position_key') {
        throw new ApiFailure('conflict', 'That position on the board is already taken.', undefined, e)
      }
      if (e.code === FOREIGN_KEY_VIOLATION && e.constraint === 'cards_board_id_fkey') {
        throw new ApiFailure('not_found', 'No such board.', undefined, e)
      }
      if (e.code === CHECK_VIOLATION || e.code === NOT_NULL_VIOLATION) {
        throw new ApiFailure('validation_failed', 'The card is missing a required value.', undefined, e)
      }
    }
    throw new ApiFailure('internal', 'Could not create the card.', undefined, e)
  }
}
```

Three properties of that function are the whole lesson. The constraint name is read and **never returned**. The original error is attached as `cause` and travels no further than the log. And the fallthrough is `internal` with a fixed string — an unrecognised code is not an invitation to improvise.

⚠️ **The foreign-key case above deliberately becomes `not_found`, not `validation_failed`.** A caller posting to a board that does not exist — or that they cannot see — should get the same answer either way; topic 11 owns that argument, and this page only notes that the DAL is where it can be honoured.

## Logging the cause without logging the row

The cause has to go somewhere, and "somewhere" is a log that may be shipped to a third-party service, retained for a year, and readable by more people than the database is.

```ts
logger.error({
  correlationId,
  kind: f.kind,
  pgCode: (f.cause as { code?: string })?.code,
  constraint: (f.cause as { constraint?: string })?.constraint,
  // 🔴 deliberately NOT logged: `detail`, which can contain another tenant's values,
  // and not the input, which can contain the body the client just sent.
})
```

🔴 **`detail` is as dangerous in a log as in a response, and it is more likely to survive.** A response is seen by one client and discarded; a log line is retained, indexed, and searchable by everyone with dashboard access. If you need the offending value to debug, you can get it from the row — you do not need a copy in the log.

## The paths the translator never sees

Everything above assumes the failure passes through a `catch`. These do not, and they are where leaks actually come from.

**A handler with no `try`.** Nothing in the framework requires one; the `route.js` reference prescribes no error handling at all. An uncaught throw in a Route Handler produces a framework 500 that you did not shape.

**A throw after the response has started.** In a streamed response the status and headers are already sent, so there is nothing left to convert.

**A promise you did not await.** A rejection in a floating promise never reaches your `catch` — and under `after()` it happens once the response is gone entirely. This is one of the specific ways ch15's queue work goes wrong.

**A parse before the try.** `await req.json()` on a malformed body throws before any of your logic runs. If it sits outside the `try`, you have an unshaped 500 for what is straightforwardly a 400.

```ts
// 🔴 WRONG — the parse is outside the try, so a malformed body is an unshaped 500
export async function POST(req: Request) {
  const body = await req.json()
  try { /* ... */ } catch (e) { return toHttpResponse(e) }
}

// ✅ RIGHT — everything that can throw is inside
export async function POST(req: Request) {
  try {
    const body = await req.json()
    // ...
  } catch (e) {
    return toHttpResponse(e)
  }
}
```

**A `console.error(err)` in production.** Not a client leak, but on many platforms it is a log leak of exactly the fields above, and it is usually left over from development.

## Gotchas

**★ Symptom: a 500 body names a constraint, a table and a column.** Cause: `error.message` was returned, and the Postgres message embeds `constraint` and often `detail`. Fix: `internal` returns a fixed string; the original goes to `cause` and stops at the log. Nothing derived from the driver error is ever interpolated into a response.

**★ Symptom: an attacker can enumerate which values are already taken.** Cause: `detail` was returned on a unique violation, and for a unique violation `detail` identifies the existing row. Fix: use `constraint` to *decide* the failure kind and return your own sentence. The client needs to know the write failed and whether retrying differently could work — it does not need the colliding row.

**★ Symptom: every constraint violation returns the same generic conflict message.** Cause: the translation happens at the edge, where the only available information is the code, so all `23505`s look alike. Fix: translate inside the DAL function that issued the statement, branching on `constraint` as well as `code` — that is the only place that knows whether this `23505` is a taken position, an idempotency replay, or a restore collision.

**★ Symptom: an idempotent retry of a POST returns 409 instead of the original 201.** Cause: the idempotency-key unique violation was translated as a conflict along with every other `23505`. Fix: branch on the constraint name and treat that one as a **replay** rather than an error — fetch and return the original result. Topic 05 owns the mechanism; this page's point is that a code-only translator cannot express it.

**★ Symptom: a malformed request body produces an unshaped 500.** Cause: `await req.json()` sits outside the `try`, so its throw never reaches the translator. Fix: put the parse inside. The rule is that a handler contains nothing but a `try`, its body, and the translator call.

**★ Symptom: everything is handled and one endpoint still returns a stack trace.** Cause: that handler has no `try` at all, and nothing in the framework requires one — the `route.js` reference prescribes no error handling. Fix: this cannot be caught by types, so it needs a convention plus a grep: every exported HTTP method in `app/api/**/route.ts` contains `toHttpResponse`. A route that does not is unshaped by construction.

**★ Symptom: a failure inside `after()` or a background job never appears anywhere.** Cause: the response is already sent, so there is no translator left to run, and a floating rejection has no `catch` to reach. Fix: the background path needs its own boundary that logs — it cannot report to a client, and pretending otherwise is how these become invisible. ch15's [`after()` and `waitUntil()` are not a queue](../15-databases-apis-and-full-stack-patterns/04b-after-and-waituntil-are-not-a-queue.md) is the surrounding argument.

**★ Symptom: the logs contain user data from tables the log readers cannot query.** Cause: the whole error object was logged, including `detail`. Fix: log the fields you named — code, constraint, correlation id — and never the object. The convenience of `logger.error(err)` is exactly the problem: it ships whatever the driver decided to attach.

**★ Symptom: an unrecognised SQLSTATE is guessed at and mapped to a plausible status.** Cause: the mapping has a permissive fallthrough that tries to be helpful. Fix: fall through to `internal`. A wrong-but-specific status is worse than a generic one, because clients build retry logic on it — a `409` for something no retry can fix loops forever.

**★ Symptom: the translation is correct in the DAL and a Route Handler still returns a raw driver error.** Cause: a handler bypassed the DAL and used the driver directly, usually for something "quick". Fix: this is the failure [the Data Access Layer](04-the-data-access-layer.md) exists to prevent, and the enforcement is the same — the driver is imported in exactly one directory, and a lint rule or a review convention says so.

**★ Symptom: development shows helpful database errors and production shows nothing useful in the logs either.** Cause: the helpful behaviour was the framework's dev overlay, not your code, so removing the leak removed the only diagnosis anyone had. Fix: the correlation id plus the logged `pgCode` and `constraint` are the replacement, and they need to exist *before* you close the leak — otherwise closing it feels like a regression and gets reverted.

## Interview questions

**★ Why is returning a Postgres error message to a client a security problem rather than an aesthetic one?**
Because the message embeds the constraint name, and constraint names are built from table and column names, so the client is handed a partial schema. The `detail` field is worse: on a unique violation it identifies the existing row, which in a multi-tenant table belongs to somebody else — that converts a duplicate-key error into an existence oracle where an attacker submits candidate values and learns which are already taken. None of that is a leak anyone chose; it arrives through the one handler that had no `catch`.

**★ Why can the driver-error translation not live in the Route Handler?**
Because a `SQLSTATE` is ambiguous without the query. `23505` in this chapter can mean a taken board position, an idempotency-key replay that should return the original 201, or a title collision when restoring a soft-deleted card — three different responses, one code. The handler sees only the code; the DAL function that issued the statement knows which constraint fired and therefore which of the three it is. Translating at the edge throws away the only information that disambiguates.

**★ What is the `cause` field for if it is never returned?**
It carries the original error to the log without letting it near the response. The public message is fixed and safe, the correlation id ties the two together, and the cause is where the actual diagnosis lives. Splitting them is what makes it possible to give the client nothing useful and still be able to debug — before the split, teams choose between a leak and an unfixable bug report.

**★ Why is `detail` dangerous in a log as well as in a response?**
Because a log outlives the request and reaches more people. A response is seen by one client and discarded; a log line is retained, shipped to a third-party service, indexed and searchable by everyone with dashboard access — a set of people usually larger than those who can query the database. So logging `detail` can put one tenant's values in front of readers who have no database access at all. The fix costs nothing: log the code, the constraint and the correlation id, and get the offending value from the row if you ever need it.

**★ An unrecognised SQLSTATE arrives. Why map it to 500 rather than to the closest plausible status?**
Because the status code is a contract with the client's retry logic, and a wrong-but-specific code corrupts it. A `409` tells the client the request conflicts with current state and could succeed if it changes something; if the real cause was, say, a serialization failure, the client retries with different data forever and never succeeds. A `500` says "we do not know", which is true, and it is the answer a client can handle correctly. Guessing optimises for looking precise at the cost of being right.

**★ Where do leaks actually come from, given a team that has done all of this correctly?**
The paths the translator never runs on. A handler with no `try` — and nothing in the framework requires one, since the `route.js` reference prescribes no error handling. A `await req.json()` placed outside the `try`, so a malformed body is an unshaped 500. A throw after a streamed response has begun, when the status is already sent. A floating promise whose rejection has no `catch`, including anything under `after()`, where the response is already gone. And a leftover `console.error(err)`. None of these is a design mistake; all of them are omissions, which is why the check is a grep over every exported HTTP method rather than a review of the error design.

**★ Why does a foreign-key violation on `board_id` become `not_found` rather than a validation error?**
Because the client posted to a board it named, and the two reasons that board is unavailable — it does not exist, or it exists and the caller may not see it — must be indistinguishable in the response, or the API confirms the existence of boards to people who cannot access them. Calling it a validation failure invites a message about the field, which is the beginning of that disclosure. Topic 11 argues the general rule; the point here is that the DAL is the only layer positioned to honour it, since it is the layer that knows both the constraint and the caller.

## Where this connects

- [10 · Errors and one response shape](10-errors-and-one-response-shape.md) — the taxonomy this page feeds
- [ch15 · `after()` and `waitUntil()` are not a queue](../15-databases-apis-and-full-stack-patterns/04b-after-and-waituntil-are-not-a-queue.md) — why the background path needs its own boundary
- [ch10 · the data access layer](../10-forms-authentication-and-security-hardening/06d-milestone-the-data-access-layer.md) — safe, minimal DTOs, quoted from the Data Security guide

---

← [10 · Errors and one response shape](10-errors-and-one-response-shape.md) · [Chapter 16 overview](01-explanation.md) · Next → [11 · Ownership on the API surface](11-ownership-on-the-api-surface.md)
