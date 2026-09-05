---
title: "The database is the last validator in the stack and it speaks SQLSTATE — but in `drizzle-orm` 0.45.2 the code you need is not on the error you catch, which is the precise mechanism behind the `try/catch` that turns every constraint violation into a 500"
sidebar_label: "05c · Reading a constraint violation"
sidebar_position: 32
description: "PostgreSQL class 23 in full, the pg DatabaseError fields that carry the SQLSTATE and the constraint name, the DrizzleQueryError wrapper that hides both, how to unwrap it safely, and what the naive catch block actually costs."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 error-codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html), the [`libpq` error-field reference](https://www.postgresql.org/docs/18/libpq-exec.html) (`PQresultErrorField`), and the [PostgreSQL 18 protocol error-fields reference](https://www.postgresql.org/docs/18/protocol-error-fields.html).
> Error-class and error-wrapping behaviour **read from the published build artifacts** — `drizzle-orm` **0.45.2** (`errors.js`, `pg-core/session.js`) and `pg-protocol` 1.16.0 `messages.d.ts`, the dependency `pg` **8.23.0** declares.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Node **24.20.0**.

**Everything upstream of the database validates a request in isolation. Only the database validates it against the current state of every other row, and that is the only place uniqueness, referential existence and cross-row invariants can actually be decided. The price is that the decision arrives as a five-character string wrapped in an error object your ORM has already re-boxed. This chunk is about getting that string out of the exception reliably; [05ca](05ca-mapping-sqlstate-to-status-codes.md) is about what to do with it once you have.**

## Class 23, in full

The [PostgreSQL 18 error-codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html) defines seven codes in Class 23 — *Integrity Constraint Violation*. Read them off the appendix rather than from memory; four are reachable from an `INSERT`.

| SQLSTATE | Condition name | Reachable from `INSERT INTO cards`? |
|---|---|---|
| `23000` | `integrity_constraint_violation` | the class fallback; you should not see it |
| `23001` | `restrict_violation` | no — a `DELETE` against `ON DELETE RESTRICT`; topic 08 |
| `23502` | `not_null_violation` | yes |
| `23503` | `foreign_key_violation` | yes — `board_id` |
| `23505` | `unique_violation` | yes — the primary key, or any unique index you add |
| `23514` | `check_violation` | yes — any `CHECK` on the table |
| `23P01` | `exclusion_violation` | only if you add an `EXCLUDE` constraint |

The appendix also states the property that makes class 23 mappable at all, and it is worth reading twice:

> *"For some types of errors, the server reports the name of a database object (a table, table column, data type, or constraint) associated with the error; for example, the name of the unique constraint that caused a unique_violation error. Such names are supplied in separate fields of the error report message so that applications need not try to extract them from the possibly-localized human-readable text of the message. As of PostgreSQL 9.3, complete coverage for this feature exists only for errors in SQLSTATE class 23 (integrity constraint violation), but this is likely to be expanded in future."*

🔴 **Class 23 is the one class with complete structured coverage.** That is not a coincidence with it being the class you need to map — it is why mapping is feasible at all. You never have to parse an error message, and you must not: the message text is localised and the fields are not.

The `libpq` reference is equally explicit about the code itself:

> *"PG_DIAG_SQLSTATE — The SQLSTATE code for the error. The SQLSTATE code identifies the type of error that has occurred; it can be used by front-end applications to perform specific operations (such as error handling) in response to a particular database error. For a list of the possible SQLSTATE codes, see Appendix A. This field is not localizable, and is always present."*

And the constraint name:

> *"PG_DIAG_CONSTRAINT_NAME — If the error was associated with a specific constraint, the name of the constraint. Refer to fields listed above for the associated table or domain. (For this purpose, indexes are treated as constraints, even if they weren't created with constraint syntax.)"*

That parenthesis is load-bearing: a bare `CREATE UNIQUE INDEX`, with no `CONSTRAINT` keyword anywhere, still populates this field with the index name. You can key a mapping off it.

🔴 **But you may not assume it is present.** The protocol's error-fields reference is explicit, and it is the reason `asPgError` below types `constraint` as optional rather than as a `string`:

> *"The fields for schema name, table name, column name, data type name, and constraint name are supplied only for a limited number of error types… Frontends should not assume that the presence of any of these fields guarantees the presence of another field."*

So the mapping is **constraint name first, SQLSTATE as the guaranteed fallback** — the code is always there, the name sometimes is. Code that reads `err.constraint` without a presence check works perfectly against every error you tested with and throws on the first one outside class 23.

The appendix also states, in its own words, why the code and not the message is the thing to branch on:

> *"Applications that need to know which error condition has occurred should usually test the error code, rather than looking at the textual error message. The error codes are less likely to change across PostgreSQL releases, and also are not subject to change due to localization of error messages."*

## What `pg` gives you

`pg` 8.23.0 depends on `pg-protocol`, whose `DatabaseError` class carries every diagnostic field as a property. Read from `pg-protocol` 1.16.0 `messages.d.ts`:

```ts
export declare class DatabaseError extends Error {
  severity: string | undefined
  code: string | undefined          // <- the SQLSTATE
  detail: string | undefined
  hint: string | undefined
  position: string | undefined
  internalPosition: string | undefined
  internalQuery: string | undefined
  where: string | undefined
  schema: string | undefined
  table: string | undefined
  column: string | undefined
  dataType: string | undefined
  constraint: string | undefined    // <- PG_DIAG_CONSTRAINT_NAME
  file: string | undefined
  line: string | undefined
  routine: string | undefined
}
```

On raw `pg`, `err.code === '23505'` works and `err.constraint` names the index. That is the mental model most mapping code is written against.

## What `drizzle-orm` 0.45.2 takes away

`drizzle-orm` 0.45.2 wraps every failing query. From the published `errors.js`:

```js
class DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}
params: ${params}`)
    this.query = query
    this.params = params
    this.cause = cause
    Error.captureStackTrace(this, DrizzleQueryError)
    if (cause) this.cause = cause
  }
}
```

and `pg-core/session.js` throws it from six separate `catch` sites, each in the form:

```js
} catch (e) {
  throw new DrizzleQueryError(queryString, params, e)
}
```

🔴 **Two consequences, both of which have shipped to production in real codebases.**

**First: `err.code` is `undefined`.** The thrown object is a `DrizzleQueryError`, not a `DatabaseError`. The SQLSTATE lives one level down, on `err.cause.code`. A mapper written against `pg` and then ported to Drizzle without re-reading the wrapper matches nothing, falls through to the default branch, and returns 500 for every constraint violation — while looking completely correct in review.

**Second: the message contains your SQL and your parameters.** `` `Failed query: ${query}\nparams: ${params}` `` — the full statement text and the interpolated parameter array. If your error path logs `err.message` anywhere less protected than a secured log sink, you are writing user-supplied values into logs; if it forwards `err.message` to the client, you are handing an attacker your schema one failed request at a time. Log the `cause` and its structured fields; never the wrapper's message, and never any message in a response body.

⚠️ **This is a version-specific fact, not a general property of ORMs.** It was read from the 0.45.2 build artifacts on unpkg. If you move the pin, re-read `errors.js` and `pg-core/session.js` before trusting an existing mapper — the wrapping behaviour is not part of any documented API surface and nothing will tell you when it changes.

## Unwrapping, correctly

```ts
// lib/db/pg-error.ts
import 'server-only'

/**
 * The structured subset of a PostgreSQL error we are willing to act on.
 * Everything here comes from the error-report fields, never from message text.
 */
export type PgErrorInfo = {
  code: string
  constraint?: string
  table?: string
  column?: string
  detail?: string
}

function hasStringProp<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  )
}

/**
 * Walk the `cause` chain. drizzle-orm 0.45.2 wraps the pg DatabaseError in a
 * DrizzleQueryError, and a transaction helper may wrap that again, so a fixed
 * one-level `error.cause` unwrap is not enough.
 */
export function asPgError(error: unknown, depth = 5): PgErrorInfo | null {
  let current: unknown = error
  for (let i = 0; i <= depth; i++) {
    if (hasStringProp(current, 'code') && /^[0-9A-Z]{5}$/.test(current.code)) {
      const e = current as Record<string, unknown>
      return {
        code: current.code,
        constraint: typeof e.constraint === 'string' ? e.constraint : undefined,
        table: typeof e.table === 'string' ? e.table : undefined,
        column: typeof e.column === 'string' ? e.column : undefined,
        detail: typeof e.detail === 'string' ? e.detail : undefined,
      }
    }
    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause
    } else {
      return null
    }
  }
  return null
}
```

The five-character shape test matters because Node's own errors also have a `code` — `ECONNREFUSED`, `ETIMEDOUT`, `ERR_INVALID_ARG_TYPE`. A mapper that only checks for the *presence* of `code` will happily treat a refused TCP connection as a database constraint error, and report a connectivity outage to users as "that value is already taken". SQLSTATE is five characters of digits and uppercase letters, so the test is exact and cheap.

## The naive version, and exactly what it costs

```ts
// 🔴 the bug — every one of these becomes a 500
export async function POST(request: NextRequest, ctx: RouteContext<'/api/boards/[boardId]/cards'>) {
  try {
    const { boardId } = await ctx.params
    const parsed = CreateCardRequest.safeParse(await request.json())
    if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 422 })
    const card = await createCard(boardId, parsed.data)
    return Response.json(card, { status: 201 })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

Four distinct outcomes collapse into one. A duplicate title (`23505`) — which the user could fix by typing a different title — becomes a 500 with no field-level feedback. A board deleted a moment ago (`23503`) becomes a 500. A check violation (`23514`) becomes a 500. And the one that genuinely *is* a server defect, `23502`, becomes indistinguishable from the other three, so it never gets investigated.

The second-order cost is worse than the first. **Your 500 rate now tracks user typing behaviour.** It rises when the product is popular and falls at night, it has no correlation with anything being broken, and within two weeks everyone has learned to ignore the alert — including on the morning it fires for a real reason. A `catch` block that cannot tell a rule from a fault destroys the signal value of the fault channel.

The corrected shape keeps the same structure and adds one branch:

```ts
export async function POST(request: NextRequest, ctx: RouteContext<'/api/boards/[boardId]/cards'>) {
  const requestId = crypto.randomUUID()
  try {
    const { boardId } = await ctx.params
    const id = BoardIdParam.safeParse(boardId)
    if (!id.success) return errorResponse(400, 'invalid_board_id', 'boardId must be a UUID', requestId)

    const parsed = CreateCardRequest.safeParse(await request.json())
    if (!parsed.success) return validationResponse(parsed.error, requestId)

    const card = await createCard(id.data, parsed.data)
    return Response.json(card, {
      status: 201,
      headers: { Location: `/api/cards/${card.id}` },
    })
  } catch (error) {
    const domain = toDomainError(error)      // <- 05ca defines this
    if (domain) {
      // A rule the database enforced. Log at info: it is normal traffic.
      logger.info({ requestId, code: domain.code, status: domain.status }, 'constraint rejected')
      return errorResponse(domain.status, domain.code, domain.message, requestId)
    }
    // Genuinely unexpected. Log the structured cause, never the wrapper message.
    logger.error({ requestId, cause: describeCause(error) }, 'unhandled create failure')
    return errorResponse(500, 'internal_error', 'Something went wrong', requestId)
  }
}
```

The two log calls are the point as much as the two responses: a constraint rejection is **information**, not an incident, and it must not share a severity with a bug. Where that translation lives so it is not repeated per handler is **the single error envelope, topic 10** *(not written yet)*; the shape of `errorResponse` is [ch7 · Designing the error envelope](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md).

## Gotchas

**★ Symptom: every constraint violation returns 500, and the mapper looks correct.** Cause: `drizzle-orm` 0.45.2 throws `DrizzleQueryError`, not the `pg` `DatabaseError`, so `error.code` is `undefined` and every `switch` arm misses. Fix: walk the `cause` chain and test the shape, as `asPgError` above does. Do not use a fixed single-level `error.cause` unwrap — a transaction helper can add a second layer.

**★ Symptom: an SQL statement and a user's card title appear in the application log.** Cause: something logged `err.message`, and `DrizzleQueryError`'s constructor builds that message as `` `Failed query: ${query}\nparams: ${params}` `` — the statement text and the bound parameter array. Fix: log only the structured fields you have deliberately extracted:

```ts
function describeCause(error: unknown) {
  const pg = asPgError(error)
  if (pg) return { sqlstate: pg.code, constraint: pg.constraint, table: pg.table }
  return { kind: error instanceof Error ? error.name : typeof error }
}
```

**★ Symptom: a connection failure is reported to the client as "That value is already taken".** Cause: the mapper tested `if ('code' in error)` and branched on it, but Node's `ECONNREFUSED` and `ETIMEDOUT` also live on `.code`. Fix: test the SQLSTATE *shape* — `/^[0-9A-Z]{5}$/` — before treating a `code` as a SQLSTATE. Five characters, digits and uppercase letters only.

**★ Symptom: `err.detail` was included in the error response "to be helpful", and it contains another user's data.** Cause: `PG_DIAG_MESSAGE_DETAIL` is documented only as *"an optional secondary error message carrying more detail about the problem"* — the docs do not enumerate its contents, and for integrity violations it commonly names the conflicting key values. Fix: treat `detail` as sensitive by default. Log it inside a protected sink if you must; never place it in a response body. Your client-facing message comes from a table of constraint names you wrote — [05ca](05ca-mapping-sqlstate-to-status-codes.md).

**★ Symptom: a "check before insert" `SELECT` still produces `23505` under load.** Cause: check-then-act. Under READ COMMITTED *"a SELECT query sees only data committed before the query began"*, so two concurrent requests both see no conflicting row and both proceed to insert. Fix: delete the pre-flight `SELECT` — it costs a round trip and prevents nothing — and let the constraint decide, then map `23505`. The constraint is the only atomic check available. Keep a pre-flight query only if its purpose is a nicer message on the *uncontended* path, and understand it is an optimisation, never a guarantee.

**★ Symptom: the mapping works in the Route Handler and not in the Server Action.** Cause: the unwrapping helper was written inside the handler file rather than beside the database code, so the second entry point never got it. Fix: `asPgError` and `toDomainError` belong next to the DAL, and both entry points import them — the same reason `requireBoardAccess` lives in the DAL. Each entry point then only decides how a domain error is *rendered*: a status code plus envelope for HTTP, a typed return value for an action.

**★ Symptom: the error mapper throws on an error it was supposed to classify.** Cause: it read `err.constraint` and used it without checking, but the protocol reference says those fields *"are supplied only for a limited number of error types"* and that *"Frontends should not assume that the presence of any of these fields guarantees the presence of another field."* Outside class 23 the name is usually absent. Fix: type it optional and branch on presence, with the SQLSTATE as the guaranteed fallback:

```ts
// ❌ constraint is `string | undefined`, and undefined outside class 23
if (CONSTRAINT_RULES[pg.constraint]) return CONSTRAINT_RULES[pg.constraint]()
// ✅ presence check first, then the code, which is "always present"
if (pg.constraint && pg.constraint in CONSTRAINT_RULES) return CONSTRAINT_RULES[pg.constraint]()
```

**★ Symptom: the mapper stopped working after a routine dependency bump, with no code change and no type error.** Cause: the wrapping behaviour is an implementation detail of the ORM build, not a documented API, so nothing surfaces a change to it. Fix: pin the ORM version deliberately, and cover the unwrap with a test that constructs the wrapper shape you expect rather than one that mocks your own helper — that test is the only thing that will fail when the shape moves.

## Interview questions

**★ Why is a `UNIQUE` constraint the only correct way to enforce uniqueness, when a `SELECT` before the `INSERT` seems to do the same job?**
Because the `SELECT` and the `INSERT` are two statements with a gap between them, and under PostgreSQL's default READ COMMITTED isolation the `SELECT` *"sees only data committed before the query began"*. Two requests arriving in the same millisecond both read a state with no conflicting row, both conclude they are clear, and both insert. The pre-flight query does not narrow the race — it makes it less frequent, which is worse, because it converts a reliable failure into an intermittent one that reproduces only under load. A unique index is enforced by the index insertion itself, so exactly one of the two transactions wins and the other gets `23505`. The correct pattern is to attempt the insert and map the failure; the pre-flight check is optional decoration on the happy path.

**★ You catch an error from Drizzle and `error.code` is undefined. What is happening, and how do you fix it without guessing?**
`drizzle-orm` 0.45.2 wraps every query failure. Its `pg-core/session.js` throws `new DrizzleQueryError(queryString, params, e)` from each `catch` site, and `DrizzleQueryError` sets `this.cause = cause` — so the `pg` `DatabaseError`, with its `code`, `constraint`, `table` and `detail` fields, is on `error.cause`, not on `error`. The fix is to walk the `cause` chain rather than unwrap one fixed level, because a transaction helper can add another wrapper, and to identify the real error by the shape of its `code` — five characters of digits and uppercase letters — rather than by its presence, since Node's own I/O errors also carry a `code`. And while you are in there: do not log the wrapper's message, because it is built from the SQL text and the bound parameters.

**★ Why is parsing the database's error message to find out what went wrong a bug rather than a shortcut?**
Because PostgreSQL says so twice in the appendix. Directly: *"Applications that need to know which error condition has occurred should usually test the error code, rather than looking at the textual error message. The error codes are less likely to change across PostgreSQL releases, and also are not subject to change due to localization of error messages."* And structurally: object names are supplied in separate fields *"so that applications need not try to extract them from the possibly-localized human-readable text of the message."* The message text depends on the server's `lc_messages` setting, so the same violation on a differently-configured server produces a different string and your regex silently stops matching — with no error, no type failure and no test coverage unless someone thought to run the suite under another locale. The structured fields are explicitly guaranteed not to be localised, and for class 23 the coverage is documented as complete, so there is never a reason to reach for the text.

**★ What is the second-order cost of mapping every database error to 500, beyond the wrong status code?**
It destroys the meaning of your 500 metric. Constraint violations are driven by user behaviour — people type duplicate titles — so the server-error rate starts correlating with traffic and time of day instead of with anything being wrong. Dashboards show a permanently non-zero error rate that nobody can drive to zero, alert thresholds get raised until they only fire on catastrophes, and the class of bug that a 500 alert exists to catch stops being caught. The status code being wrong for the client is the visible cost; the monitoring channel becoming useless is the expensive one.

**★ Why does the ORM wrapping the driver error count as a versioned risk you should write down?**
Because it is not part of any documented contract. Nothing in the Drizzle documentation states that a failing query throws `DrizzleQueryError` with the driver error on `cause`; it was read out of the shipped `errors.js` and `pg-core/session.js` for 0.45.2 specifically. That means a minor version bump can change it, no type will complain, and the failure mode is silent — every constraint violation quietly becomes a 500 again. So the version belongs in the `> Verified:` line of your own runbook, the unwrap belongs behind a test that asserts on the wrapper shape rather than mocking your helper, and the pin belongs in `package.json` as an exact version rather than a caret range.

---

← [05b · Validation at the boundary](05b-validating-at-the-boundary-with-zod.md) · Next → [05ca · Mapping SQLSTATE to status codes](05ca-mapping-sqlstate-to-status-codes.md)
