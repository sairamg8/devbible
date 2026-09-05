---
title: "A NOT NULL, a CHECK, a unique index and a foreign key each reject a whole class of bad request before a line of your code runs — and each one arrives back as a different SQLSTATE, which is the only part of a database error that is safe to branch on"
sidebar_label: "02b · Constraints as validation"
sidebar_position: 14
description: "Why the constraint is the last line rather than a duplicate of zod, the four SQLSTATEs this API maps, the protocol error fields the driver surfaces and the two you must not branch on, naming constraints so the mapping is stable, and why a check constraint cannot produce a message a user should read."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 Error Codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html), [PostgreSQL 18 · Error and Notice Message Fields](https://www.postgresql.org/docs/18/protocol-error-fields.html), [PostgreSQL 18 · Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) and [PostgreSQL 18 · `ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html).
> Target: **PostgreSQL 18.4** · `pg` **8.23.0** · `drizzle-orm` **0.45.2** · `zod` **4.4.3** · **Next.js 16.3.4**.
> Documentation-verified; **no sandbox run, no timings**. Every SQLSTATE and every field description below is quoted from the PostgreSQL documentation, not reproduced from a run.

**Validation in a web application is usually described as a boundary concern: parse the request, reject what is malformed, proceed. That description is complete only if there is exactly one boundary, and there never is. A Server Action is one, a Route Handler is another, a queue consumer is a third, a seed script is a fourth, and a colleague with `psql` open is a fifth. A constraint is the only rule that holds across all five, because it is enforced by the process that owns the bytes. So the schema is not a duplicate of your zod schema — it is the layer that is still true when the zod schema was not the code path taken.**

## The division of labour, stated once

Both layers exist and they are not doing the same job.

| | zod at the boundary | The constraint in the database |
|---|---|---|
| Runs for | one entry point, one process | every writer that ever exists |
| Produces | a field-keyed message a human reads | a terse message and a SQLSTATE |
| Fails with | `422`, before any I/O | an exception mid-transaction |
| Can express | cross-field rules, formats, trimming, coercion | rules the database can check per row or per index |
| Is | the message | the truth |

🔴 **Neither is optional and neither is "defence in depth" applied to the same axis.** They protect against different things: zod protects the user from a confusing failure, the constraint protects the data from every code path zod does not sit in front of. Removing the constraint because "we validate in the API" is how a table acquires three rows with a null title, written by a backfill script somebody ran once.

The corollary is the rule this chapter follows: **validate for the message, constrain for the truth.** In the normal case the boundary rejects the request and the database never sees it. When the database rejects something instead, that is either a race the boundary could not have caught, or a code path that skipped the boundary — and both are worth knowing about, which is why the two produce different status codes.

## SQLSTATE is the only thing safe to branch on

PostgreSQL says this outright, and it is the sentence the whole error-mapping design rests on:

> *"All messages emitted by the PostgreSQL server are assigned five-character error codes that follow the SQL standard's conventions for "SQLSTATE" codes. Applications that need to know which error condition has occurred should usually test the error code, rather than looking at the textual error message. The error codes are less likely to change across PostgreSQL releases, and also are not subject to change due to localization of error messages."*
> — [PostgreSQL 18 · Appendix A](https://www.postgresql.org/docs/18/errcodes-appendix.html)

Two independent reasons in there. Codes are stable across releases, and codes are not translated — a server with a non-English `lc_messages` produces a message your `includes('duplicate key')` will never match. Any error handling built on message text is a latent bug that fires when someone changes a locale.

The structure is also load-bearing:

> *"According to the standard, the first two characters of an error code denote a class of errors, while the last three characters indicate a specific condition within that class. Thus, an application that does not recognize the specific error code might still be able to infer what to do from the error class."*

Which is why the fallback in the mapping below is on the class `23`, not on `500`.

## The four codes this API relies on

Quoted verbatim from Class 23 — Integrity Constraint Violation:

| Code | Condition name | The constraint that raised it | The request that caused it |
|---|---|---|---|
| `23502` | `not_null_violation` | `NOT NULL` | A create with no `title` |
| `23503` | `foreign_key_violation` | `FOREIGN KEY` | A create naming a board that does not exist, or a move to one |
| `23505` | `unique_violation` | `UNIQUE` / a unique index | A retried `POST` reusing an idempotency key |
| `23514` | `check_violation` | `CHECK` | A `title` of 300 characters, a non-finite `position` |

Two more from the same class are worth knowing even though this table does not use them: `23001 restrict_violation` (an `ON DELETE RESTRICT` refusing a parent delete) and `23P01 exclusion_violation` (an `EXCLUDE` constraint). And one from a different class matters enormously to topic 09: `40001 serialization_failure`, in Class 40 — Transaction Rollback, alongside `40P01 deadlock_detected`. Those two are not validation failures; they are retryable, and conflating them with Class 23 is how a transient conflict becomes a permanent `422`.

⚠️ **An invalid enum value is not `23514`.** `status = 'blocked'` against `card_status` raises `22P02 invalid_text_representation`, in Class 22 — Data Exception, because the failure happens converting the literal to the type, before any constraint is consulted. If your mapping only covers Class 23, an unknown status falls through to `500`.

## The constraints, on this table

The canonical schema in [02](02-the-schema-and-the-migration-story.md) declares `notNull` and `references`. The `CHECK` constraints are additive and are written as raw SQL in the migration, because they express rules Drizzle's column types cannot:

```sql
-- migrations/0002_card_domain_checks.sql

-- 23514 on an empty or over-long title. btrim, so "   " is not a title.
ALTER TABLE cards
  ADD CONSTRAINT cards_title_len_chk
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);

-- 23514 on NaN or Infinity, which double precision accepts and ordering cannot use.
ALTER TABLE cards
  ADD CONSTRAINT cards_position_finite_chk
  CHECK (position = position AND position <> 'Infinity'::float8 AND position <> '-Infinity'::float8);

-- 23514 if the body is stored as an empty string. The contract says null or content.
ALTER TABLE cards
  ADD CONSTRAINT cards_body_not_empty_chk
  CHECK (body IS NULL OR char_length(body) > 0);
```

`position = position` is the idiomatic finite test: IEEE `NaN` is not equal to itself, so that clause is false exactly when the value is `NaN`.

🔴 **Naming every constraint is not cosmetic — it is the join key between the database and your error mapping.** An unnamed `CHECK` gets a system-generated name, and a system-generated name can change when the constraint is dropped and re-added during a later migration. Name it, and `cards_title_len_chk` is stable forever.

⚠️ **Adding those constraints to a table that already has rows is not free**, and on a live table it needs `NOT VALID`. That is [02d](02d-the-lock-a-migration-actually-takes.md); the statements above are what you write on an empty table at the start of a project.

## What the driver hands you back

`pg` surfaces the protocol's error fields on the thrown error object. PostgreSQL defines exactly what each field is, and two of the definitions are the reason the mapping below is written the way it is:

> *"Code: the SQLSTATE code for the error… **Not localizable. Always present.**"*

> *"Constraint name: if the error was associated with a specific constraint, the name of the constraint… (For this purpose, indexes are treated as constraints, even if they weren't created with constraint syntax.)"*

> *"Detail: an optional secondary error message carrying more detail about the problem. Might run to multiple lines."*

and the caveat that kills a lot of naive code:

> *"The fields for schema name, table name, column name, data type name, and constraint name are supplied only for a limited number of error types… Frontends should not assume that the presence of any of these fields guarantees the presence of another field."*
> — [PostgreSQL 18 · Error and Notice Message Fields](https://www.postgresql.org/docs/18/protocol-error-fields.html)

So: **branch on `code` first, always. Use `constraint` only to refine, and always have a path for when it is absent.**

🔴 **Never put `detail` in a response.** For a unique violation, `detail` contains the conflicting key *values* — that is precisely what makes it useful in a log and precisely what makes it a disclosure in an API. It is also the field most likely to be localized-adjacent and multi-line, so it is unusable in a UI anyway.

## The mapping, in one place

```ts
// lib/dal/pg-errors.ts
import 'server-only'
import { DomainInvalid, NotFound, Conflict, Retryable } from './errors'

/** The shape `pg` throws. Only `code` and `message` are guaranteed present. */
type PgError = {
  code?: string
  message?: string
  constraint?: string
  detail?: string
}

function isPgError(reason: unknown): reason is PgError {
  return typeof reason === 'object' && reason !== null && 'code' in reason
}

/**
 * Translate a driver error into a domain error the entry points already map.
 * Returns the original if it is not a Postgres error we recognise, so an
 * unknown failure stays a 500 rather than being flattened into a 422.
 */
export function translatePgError(reason: unknown): unknown {
  if (!isPgError(reason) || typeof reason.code !== 'string') return reason
  const { code, constraint } = reason

  switch (code) {
    case '23505': // unique_violation
      return new Conflict(constraint ?? 'unique constraint')

    case '23503': // foreign_key_violation — the board in the URL does not exist
      return new NotFound('board')

    case '23502': // not_null_violation — validation should have caught this
      return new DomainInvalid('A required field was missing.')

    case '23514': // check_violation — refine by the constraint NAME, never the message
      if (constraint === 'cards_title_len_chk') {
        return new DomainInvalid('Title must be between 1 and 200 characters.')
      }
      if (constraint === 'cards_position_finite_chk') {
        return new DomainInvalid('Position must be a finite number.')
      }
      return new DomainInvalid('A field failed a validation rule.')

    case '22P02': // invalid_text_representation — an enum value outside the type
      return new DomainInvalid('Unknown value for a constrained field.')

    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
      return new Retryable(code)
  }

  // Class fallback: anything else in class 23 is still an integrity problem.
  if (code.startsWith('23')) return new DomainInvalid('The request violates a data rule.')

  return reason
}
```

Three properties of that function are worth naming, because each one is a decision:

**It returns rather than throws.** The caller decides; a translator that throws cannot be composed and cannot be unit-tested without a `try`.

**It returns the original for anything it does not recognise.** The temptation is a `default:` that produces a `422`, and that is exactly wrong — an unrecognised database error is a bug, and a bug that comes back as a client error never gets logged and never gets fixed.

**`40001` and `40P01` become `Retryable`, not `Conflict`.** Class 40 is transient by definition; the whole point of a serialization failure is that the same transaction may succeed on the next attempt. Turning it into a client-visible `409` throws away a retry the server should have done itself. [Topic 09d · Serialization failures and the retry loop](09d-serialization-failures-and-the-retry-loop.md) owns the loop.

## Where each layer catches what

Walk one bad request through both layers to see why both exist.

```ts
// A POST body of { "title": "   ", "boardId": "<a board the caller is not on>" }
```

1. **zod** trims and rejects the empty title → `422` with a field-keyed message. The database is never touched. This is the normal path and it is the one users experience.
2. If the boundary had not trimmed, `cards_title_len_chk` rejects it → `23514` → `422` with a generic message. Correct outcome, worse message, and now you know a code path skipped validation.
3. The board the caller is not on never reaches either layer, because the ownership predicate in [04c](04c-the-ownership-predicate.md) is in the `WHERE` clause of the insert's source query — the insert affects zero rows and the DAL raises `NotFound`. **A foreign key is not an authorization check**; it only tells you the board exists.

That third point is the one to keep. `23503` means "no such board", which for a caller who is not a member is the same answer as "not your board" — which is why both come back as `404` and why the `translatePgError` case for `23503` returns `NotFound` rather than a validation error.

## Gotchas

**★ Symptom: error handling stops working after a server is deployed with a non-English locale.** Cause: the code matched on message text — `message.includes('duplicate key value')` — and messages are localized. Fix: branch on `code`. The documentation says so directly: *"Applications that need to know which error condition has occurred should usually test the error code, rather than looking at the textual error message."*

**★ Symptom: a duplicate-key error surfaces to the user with the conflicting value in it.** Cause: `detail` was included in the response body. `detail` for `23505` names the key and its values, which is a disclosure — it tells an unauthenticated caller that a particular title, email or idempotency key already exists. Fix: log `detail`, return the code. The envelope for that is [the single error envelope, topic 10](10-errors-and-one-response-shape.md); not letting the driver's own text out at all is [10b](10b-never-leak-a-driver-error.md).

**★ Symptom: a check violation is mapped to the wrong message after a later migration.** Cause: the mapping keyed on a system-generated constraint name, and the constraint was dropped and re-added, so the generated name changed. Fix: name every constraint explicitly in the migration, and treat the name as part of the interface between the schema and the application.

**★ Symptom: `reason.constraint` is `undefined` and the handler throws while handling an error.** Cause: the field is optional — *"supplied only for a limited number of error types"*, and *"Frontends should not assume that the presence of any of these fields guarantees the presence of another field."* Fix: `constraint ?? 'unique constraint'`, and a branch that works with only `code` present.

**★ Symptom: an unknown `status` value comes back as `500`.** Cause: the mapping covers Class 23 and an enum coercion failure is `22P02` in Class 22, raised before any constraint is evaluated. Fix: the explicit `22P02` case above — or better, validate `status` against the same union at the boundary so it never reaches SQL.

**★ Symptom: a transient conflict under load is reported to users as a validation error.** Cause: `40001` fell into a `default:` that produced `422`. Fix: Class 40 is retryable and must be separated before any generic fallback. A serialization failure that a client is told to "fix its input" for is a bug that looks like a product complaint.

**★ Symptom: the constraint was removed because "the API validates it anyway" and bad rows appeared.** Cause: the API is one writer. The backfill script, the migration, the queue consumer and `psql` are not. Fix: keep the constraint; it is the only rule that is true for every writer. If the constraint is genuinely wrong, change it in a migration rather than deleting the enforcement.

**★ Symptom: adding a `CHECK` to a busy table caused an outage.** Cause: *"Adding a `CHECK` or `NOT NULL` constraint requires scanning the table to verify that existing rows meet the constraint"*, under an `ACCESS EXCLUSIVE` lock. Fix: add it `NOT VALID`, then `VALIDATE CONSTRAINT` separately — validation *"acquires only a `SHARE UPDATE EXCLUSIVE` lock"*. Shown in code in [02d](02d-the-lock-a-migration-actually-takes.md).

**★ Symptom: the same bad request produces `422` in dev and `409` in production.** Cause: two writers racing. Uniqueness cannot be validated by reading first — between the `SELECT` and the `INSERT` another request commits — so the boundary check passes and the constraint fires. Fix: this is correct behaviour and the reason `POST` commits to both codes in [01b](01b-the-six-routes-and-the-codes-they-commit-to.md). Do not try to remove the race with a pre-read; catch `23505` and map it.

**★ Symptom: a `NOT NULL` violation reaches production at all.** Cause: `23502` means a write path skipped validation entirely — a script, a consumer, or a DAL function taking a partially-built object. Fix: treat `23502` as an alert as well as a `422`. It is the one code in the table that should essentially never fire in a system whose boundaries are all in place, so its frequency is a direct measurement of how many writers bypass them.

## Interview questions

**★ If the API validates every field, why keep the constraints?**
Because "the API" is one writer among several and it is the only one you thought about. The seed script, the data-fix migration, the queue consumer, a colleague in `psql`, and the next entry point somebody adds are all writers with no zod schema in front of them. A constraint is enforced by the process that owns the bytes, so it holds for all of them and it holds retroactively — you cannot insert a row that violates it, ever, by any route. The two layers also have genuinely different jobs: zod exists to produce a message a human can act on, the constraint exists to make a state unrepresentable. Deleting one because the other exists is like removing the type checker because there are tests.

**★ Why is it wrong to detect a duplicate by reading before inserting?**
Because the read and the insert are two statements and something can commit between them. Under any isolation level below serializable, two concurrent requests both read "no such row", both insert, and one gets `23505` regardless — so the pre-read did not prevent the error, it only added a round trip and the false confidence that the error cannot happen. The unique index is the only mechanism that actually decides, because it decides at the moment of insertion, atomically. The correct shape is therefore to attempt the insert and translate `23505`, which is also why `POST` in the contract commits to a `409` it will occasionally produce.

**★ Which SQLSTATEs must never become a 4xx, and why does it matter?**
Class 40 — `40001 serialization_failure` and `40P01 deadlock_detected`. They are transient: the transaction failed because of concurrency, not because of anything the client sent, and the identical request may succeed immediately on retry. Returning `409` for them makes a server-side scheduling problem into the client's problem, and it hides the load condition from your own metrics, because it lands in the "user error" bucket. They belong in a retry loop inside the DAL, with a bounded number of attempts, and only the exhausted case should ever reach the client. The general rule is that the error class tells you who is responsible, and Class 40 is never the caller.

**★ Why branch on the constraint name rather than the message for a check violation?**
Because a check violation's code — `23514` — tells you a rule was broken and not which one, and the message that would tell you is localizable and free to change between releases. The constraint name is a stable identifier you chose, so keying on it is keying on your own interface. The two caveats are that you must name every constraint explicitly, or Postgres generates a name that can change when the constraint is re-created; and that the field is optional, since the documentation says these fields are *"supplied only for a limited number of error types"* and warns against assuming one field's presence implies another's. So the branch reads `code` first, refines on `constraint` if present, and falls back to a generic domain error if it is not.

**★ What does a `23502` in production actually tell you?**
That some write path reached the database without passing a validation layer, because a not-null violation is the easiest possible thing to catch at a boundary. So it is much more valuable as a signal than as an error: its rate is a direct measurement of how many writers bypass your entry points. Treat it as an alert, not just a mapped status code. The same reasoning applies less strongly to `23514`, which can legitimately fire for a rule too complex to express at the boundary, and not at all to `23505`, which fires because of a race no boundary can prevent.

**★ Why does a foreign-key violation map to `404` rather than `422`?**
Because `23503` on `board_id` means the board named in the URL does not exist, and "the addressed resource does not exist" is a `404` in every other route of this API. Mapping it to `422` would be describing it as a malformed field, which invites the client to fix its input when the correct action is to stop pointing at a board that is gone. It also lines up with the disclosure rule: a caller who is not a member of a board that *does* exist already gets `404` from the ownership predicate, so a nonexistent board producing the same code means the API cannot be used to distinguish "no such board" from "not your board". A foreign key tells you a row exists; it never tells you the caller may touch it, and that separation is what keeps the two topics from bleeding into each other.

**★ Where does an enum failure fit, and why is it easy to miss?**
It does not fit in Class 23 at all. Sending `status = 'blocked'` against `card_status` fails during input conversion with `22P02 invalid_text_representation`, in Class 22 — Data Exception, because the value never becomes a valid `card_status` and so no constraint is ever evaluated. Error mappings written by reading the integrity-constraint appendix therefore miss it entirely and return `500` for what is plainly a client error. The clean fix is upstream: validate `status` against the same three-member union at the boundary, so the database never sees an out-of-range literal and `22P02` becomes a signal that a non-boundary writer exists — the same diagnostic value `23502` carries.

---

← [02 · The schema](02-the-schema-and-the-migration-story.md) · [Chapter 16 overview](01-explanation.md) · Next → [02c · The migration is a release step](02c-the-migration-is-a-release-step.md)
