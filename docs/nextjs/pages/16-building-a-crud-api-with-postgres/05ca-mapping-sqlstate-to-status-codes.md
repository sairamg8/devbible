---
title: "Four class-23 codes map to four different HTTP responses, and the one everybody reclassifies as a client error — `23502` not_null_violation — is the one that should stay a 500, because the client's request was fine and your schema and your table have drifted apart"
sidebar_label: "05ca · SQLSTATE to status codes"
sidebar_position: 33
description: "The mapping table with the reasoning behind each status, why 23503 depends on where the broken reference came from, why 23502 must not become a 4xx, and how to name constraints so the mapping has a key that survives a rename."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 *HTTP Semantics* — [§15.5.10 409 Conflict](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.10), [§15.5.21 422 Unprocessable Content](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.21), [§15.5.5 404 Not Found](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.5) — the [PostgreSQL 18 error-codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html), the [PostgreSQL 18 lexical-structure reference](https://www.postgresql.org/docs/18/sql-syntax-lexical.html), the [PostgreSQL 18 numeric-types reference](https://www.postgresql.org/docs/18/datatype-numeric.html) (the `NaN` ordering rule), and the [PostgreSQL 18 protocol error-fields reference](https://www.postgresql.org/docs/18/protocol-error-fields.html).
> Drizzle's generated foreign-key name **read from the published `drizzle-orm` 0.45.2 build** (`pg-core/foreign-keys.js`, `getName()`).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Node **24.20.0**.

**Getting the SQLSTATE out of the exception was [05c](05c-constraint-violations-and-sqlstate.md); deciding what it means is this page. Each code answers a different question about the request — is this a conflict with existing state, is the content unprocessable, or is this actually our bug? — and those are three different status classes. The temptation is to write one line per code and be done, but two of the four codes cannot be mapped by code alone: `23503` depends on whether the broken reference came from the URL or the body, and `23505` is meaningless to the user unless you know which constraint fired. Both are keyed on the constraint name, which means the mapping only works if you named your constraints.**

## The mapping

```ts
// lib/db/constraint-map.ts
import 'server-only'
import { asPgError } from './pg-error'

export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

/**
 * Constraint names are OUR names, declared in the migration. Never derive a
 * client-facing message from PostgreSQL's message text — it is localisable.
 */
const CONSTRAINT_RULES: Record<string, () => DomainError> = {
  cards_board_title_unique: () =>
    new DomainError(409, 'duplicate_title', 'A card with that title already exists on this board', 'title'),
  cards_board_id_boards_id_fk: () =>
    new DomainError(404, 'board_not_found', 'No such board', 'boardId'),
  cards_title_not_blank: () =>
    new DomainError(422, 'title_blank', 'Title must contain a non-space character', 'title'),
  cards_position_finite: () =>
    new DomainError(422, 'position_invalid', 'Position must be a finite number', 'position'),
}

export function toDomainError(error: unknown): DomainError | null {
  const pg = asPgError(error)
  if (!pg) return null

  // Prefer the named rule; it is the only way to produce a useful message.
  if (pg.constraint && pg.constraint in CONSTRAINT_RULES) {
    return CONSTRAINT_RULES[pg.constraint]()
  }

  switch (pg.code) {
    case '23505': // unique_violation
      return new DomainError(409, 'conflict', 'That value is already taken')
    case '23503': // foreign_key_violation
      return new DomainError(422, 'reference_invalid', 'A referenced record does not exist')
    case '23514': // check_violation
      return new DomainError(422, 'constraint_failed', 'The request violates a rule for this resource')
    case '23P01': // exclusion_violation
      return new DomainError(409, 'conflict', 'That value overlaps an existing record')
    case '22P02': // invalid_text_representation — a malformed UUID reached the driver
      return new DomainError(400, 'invalid_identifier', 'An identifier in the request is malformed')
    case '23502': // not_null_violation — deliberately unmapped; see below
      return null
    default:
      return null // unknown: let it become a 500, loudly logged
  }
}
```

Note the order: **constraint name first, SQLSTATE second**, and note that the name is checked for presence before it is used. That is not defensive style — the protocol error-fields reference requires it:

> *"The fields for schema name, table name, column name, data type name, and constraint name are supplied only for a limited number of error types… Frontends should not assume that the presence of any of these fields guarantees the presence of another field."*

The SQLSTATE is *"not localizable, and is always present"*; the constraint name is not. So the code tells you what kind of rule broke and is the guaranteed fallback; the name tells you *which* rule and is what lets you write a message a user can act on — when it is there.

## `23505` unique_violation → 409

RFC 9110 §15.5.10 defines the case exactly:

> *"The 409 (Conflict) status code indicates that the request could not be completed due to a conflict with the current state of the target resource. This code is used in situations where the user might be able to resolve the conflict and resubmit the request."*

Both halves fit a duplicate title. The request is well-formed — the identical body would have succeeded five minutes ago — so nothing about the *content* is unprocessable, which rules out 422. And the user can resolve it, by renaming the card, which is precisely the situation §15.5.10 names. The spec adds that the server *"SHOULD generate content that includes enough information for a user to recognize the source of the conflict"*, which is the argument for `field: 'title'` in the envelope rather than a bare status.

## `23503` foreign_key_violation → 422, or 404 when the reference is in the URL

This is the one that cannot be mapped by code alone, and the distinction is real rather than pedantic: **is the broken reference part of the resource's identity, or part of its content?**

`POST /api/boards/{boardId}/cards` against a board that does not exist is a request to a collection that has no existence. §15.5.5: *"the origin server did not find a current representation for the target resource"* — 404. The client should stop retrying and stop rendering that board.

A `parentCardId` inside the body naming a card that was just deleted is different. The addressed resource exists; the content you sent cannot be processed. §15.5.21 — 422.

Same SQLSTATE, two statuses, and the only thing that distinguishes them is which foreign key fired. Hence `cards_board_id_boards_id_fk` having its own entry in `CONSTRAINT_RULES` while the `switch` default gives 422.

⚠️ **In this chapter you will almost never reach the 404 branch**, because the DAL's `requireBoardAccess(boardId)` has already resolved the board and already returned 403 or 404 for one the caller cannot reach — the ownership predicate doing double duty as an existence check. The `23503` branch is the backstop for the narrow race where the board is deleted between that check and the insert, and it is worth keeping precisely because that race is invisible in testing.

## `23514` check_violation → 422

> *"the syntax of the request content is correct, but it was unable to process the contained instructions."*

A `CHECK` encodes a rule about the content itself, so retrying the identical body will never succeed and the client must change something. 422 is the accurate statement.

`23514` carries a second meaning worth acting on. If it fires with a constraint name that is **not** in `CONSTRAINT_RULES`, the database is enforcing a rule your boundary schema does not know about — nearly always a `CHECK` added in a migration and never mirrored back into zod. That is a drift alarm, and it deserves its own alert rather than being absorbed by a generic 422.

## `23502` not_null_violation → deliberately unmapped, so it becomes a 500

This is the row people get wrong, and they get it wrong for a sympathetic reason: it *looks* like a missing field, and a missing field is obviously the client's fault.

It is not. Every `NOT NULL` column on `cards` is either required by `CreateCardRequest` or defaulted by the table. So a `null` arriving at the insert means one of two things: the boundary schema and the table have drifted, or the DAL built the row wrongly. **Both are defects on your side of the wire, and a 500 is the honest answer.**

Mapping it to 400 does active harm. The client is told to fix a request that was correct, so it retries identically and gets the same 400 forever; and your dashboards show a healthy 4xx rate, so nothing ever prompts anyone to look. Leaving it as a 500 puts it in the bucket that gets investigated, which is the only route by which it gets fixed.

The one case people offer as a counterexample — a column that is `NOT NULL` with no default and genuinely optional at the boundary — is a description of the bug rather than an exception to the rule. The fix is to make the schema require what the table requires:

```ts
// the cause: optional at the boundary, NOT NULL with no default in the table
status: CardStatus.optional(),   // fine — the column has DEFAULT 'todo'
title: z.string().optional(),    // 🔴 not fine — title is NOT NULL, no default
// the fix
title: z.string().trim().min(1).max(200),
```

## Naming your constraints, so the mapping has a key

An automatically-named constraint is a mapping key you did not choose. In `drizzle-orm` 0.45.2 the foreign-key name is generated by `getName()` in the published `pg-core/foreign-keys.js` as `` `${chunks.join('_')}_fk` ``, where the chunks are the table name, the local column names, the foreign table name and the foreign column names — so `cards.boardId → boards.id` yields `cards_board_id_boards_id_fk`. Derivable, but inherited rather than declared, and a column rename changes it silently.

Name them explicitly in the migration:

```sql
-- an addition this topic proposes; the canonical cards table in the chapter
-- schema has no unique constraint beyond its primary key
ALTER TABLE cards
  ADD CONSTRAINT cards_title_not_blank CHECK (length(btrim(title)) > 0);

ALTER TABLE cards
  ADD CONSTRAINT cards_position_finite
  CHECK (position > '-Infinity'::float8 AND position < 'Infinity'::float8);
  -- 🔴 NOT 'position = position'. That idiom rejects NaN in IEEE 754 and in
  -- most languages, but PostgreSQL deliberately deviates: it "treats NaN
  -- values as equal, and greater than all non-NaN values" so NaN = NaN is
  -- TRUE and the check would pass. The range form works precisely because
  -- of that same ordering rule: NaN sorts above Infinity, so NaN < Infinity
  -- is false and NaN is rejected, along with both infinities.

CREATE UNIQUE INDEX cards_board_title_unique
  ON cards (board_id, lower(btrim(title)))
  WHERE deleted_at IS NULL;
```

Three things about that index. It is **partial** — `WHERE deleted_at IS NULL` — so a soft-deleted card does not block reusing its title, which is a rule you will want the moment topic 08 lands. It is **on an expression**, `lower(btrim(title))`, so `"Deploy"` and `" deploy "` collide, which is almost always what a user means by *already exists*. And it is a bare `CREATE UNIQUE INDEX` with no `CONSTRAINT` keyword — which still populates the constraint field, because *"indexes are treated as constraints, even if they weren't created with constraint syntax."*

⚠️ **Keep constraint names under 63 bytes.** From the PostgreSQL lexical-structure reference: *"The system uses no more than NAMEDATALEN-1 bytes of an identifier; longer names can be written in commands, but they will be truncated. By default, NAMEDATALEN is 64 so the maximum identifier length is 63 bytes."* A longer name is silently truncated, and the truncated form is what arrives in the error field — so your `CONSTRAINT_RULES` lookup misses and every violation of that constraint falls back to the generic 409.

## Gotchas

**★ Symptom: the 409 message says "That value is already taken" and the user has no idea which field.** Cause: the mapping keyed on the SQLSTATE alone, which cannot distinguish the primary key from a board-scoped title index. Fix: key on `err.constraint` first and fall back to the SQLSTATE — the `CONSTRAINT_RULES` lookup above — and name every constraint explicitly in the migration so the key is one you chose. RFC 9110 asks for this directly: the server *"SHOULD generate content that includes enough information for a user to recognize the source of the conflict."*

**★ Symptom: the constraint-name lookup stops matching after a column rename.** Cause: the constraint was auto-named by Drizzle from the column names, so renaming `board_id` renamed the constraint too, and no TypeScript anywhere referenced the old string. Fix: declare the name in the migration and, where the ORM supports it, in the schema. An explicitly named constraint survives a rename, and a rename that *should* change the name then surfaces as a failing test rather than as a silent downgrade to a generic status in production.

**★ Symptom: `23505` fires on a card whose title is only used by a card the user deleted last week.** Cause: the unique index covers soft-deleted rows, because `deletedAt` is an ordinary column and the index has no idea it means "gone". Fix: make the index partial — `WHERE deleted_at IS NULL`, as in the DDL above. This is the first of several places where soft delete leaks into code that has nothing to do with delete; [06](06-read.md) has the rest.

**★ Symptom: `23502` was mapped to 400, and a client is stuck retrying an identical request forever.** Cause: a `NOT NULL` violation on a create is schema/table drift or a DAL bug — the client's body was fine, so "fix your request" is advice it cannot act on. Fix: leave `23502` unmapped so it surfaces as a 500 and gets investigated, and close the real gap by making the boundary schema require what the table requires, as shown above.

**★ Symptom: `23514` fires with a constraint name nobody in the codebase recognises.** Cause: the database enforces a rule the boundary schema does not mirror — usually a `CHECK` added directly in a migration and never reflected back into zod. Fix: treat it as a drift signal, not just an error. Alert on `23514` with an unmapped constraint name, then do both halves: add the rule to the request schema so the client gets a precise 422 with no round trip, and add the name to `CONSTRAINT_RULES` so the backstop message is useful too.

**★ Symptom: `NaN` is stored in `position`, and the card sorts to the end of every board instead of being rejected.** Cause: `double precision` accepts `NaN` — a JSON body cannot produce it, but a `FormData` path through `Number()` can — and PostgreSQL's ordering rule puts it last: *"PostgreSQL treats NaN values as equal, and greater than all non-NaN values."* Fix: reject it at the boundary with `z.number().finite()`, and in the table with a **range** check, not the `x = x` idiom. 🔴 `CHECK (position = position)` is the reflex here and it does not work in PostgreSQL, because the same rule that makes `NaN` sort last also makes `NaN = NaN` true, so the check passes:

```sql
-- 🔴 passes for NaN in PostgreSQL, unlike in IEEE 754 or in JavaScript
CHECK (position = position)
-- correct: NaN sorts above Infinity, so this is false for NaN and for both infinities
CHECK (position > '-Infinity'::float8 AND position < 'Infinity'::float8)
```

**★ Symptom: two entry points disagree about the status for the same violation.** Cause: the mapping was written inside the Route Handler, so the Server Action grew its own copy that drifted. Fix: `toDomainError` returns a `DomainError` carrying a status and a code; the handler renders it as an HTTP response and the action renders it as a typed return value. One mapping, two renderings — which is exactly the split **the single error envelope, topic 10** *(not written yet)* formalises.

**★ Symptom: an unknown SQLSTATE reaches the client as a 409.** Cause: the `switch` had a catch-all arm that returned a `DomainError` instead of `null`, so serialization failures (`40001`), deadlocks (`40P01`) and disk-full conditions were all reported as conflicts the user could resolve by retrying with different input. Fix: the default arm returns `null` and the caller turns `null` into a logged 500. Only codes you have deliberately reasoned about get a 4xx. `40001` in particular is a *retry* signal, not a client error, and topic 09 owns it.

## Interview questions

**★ Argue for and against mapping `23503` to 404.**
For: a `POST` to `/api/boards/{boardId}/cards` where the board does not exist is a request against a collection that has no existence, and §15.5.5's *"did not find a current representation for the target resource"* is the accurate description. The client should stop retrying and stop rendering that board. Against: a foreign key inside the *body* — a `parentCardId` naming a card that was just deleted — is not about the target URI at all; the resource you addressed exists, and the content you sent is unprocessable, which is 422. So `23503` alone does not determine the status; the *position of the broken reference* does, which is why the mapping keys on the constraint name rather than the code. In this chapter the URL case is mostly theoretical, because the ownership check in the DAL has already resolved the board — the `23503` branch is a backstop for the race where the board disappears between that check and the insert.

**★ Why is 500 the right answer for a `NOT NULL` violation?**
Because a 4xx is a statement that the client can fix the request, and here it cannot. Every `NOT NULL` column is either required by the boundary schema or defaulted by the table, so a `null` arriving at the insert means the schema and the table disagree, or the DAL constructed the row wrongly — in both cases a defect on your side. Returning 400 hides that: the client sees "bad request" for a request that was well-formed, retries identically, and gets the same answer forever, while your dashboards show a healthy 4xx rate and nothing prompts anyone to look. Returning 500 puts it in the bucket that gets investigated, which is the only way it gets fixed. The counterexample people reach for — a column that is `NOT NULL` and genuinely optional at the boundary — is a description of the bug, not an exception to the rule.

**★ Why must the client-facing message come from your own table of constraint names rather than from the database's error message?**
Two reasons, and the first is in the docs. The appendix says object names are supplied in separate fields *"so that applications need not try to extract them from the possibly-localized human-readable text of the message"* — the message text is localisable, so a server with a different `lc_messages` produces different strings and any parsing you do breaks silently. The second reason is that the database's message describes a *storage* rule and your user needs to hear a *product* rule. `duplicate key value violates unique constraint` is true and useless; "a card with that title already exists on this board" is the same fact expressed in the domain the user is working in, and it can name the field so the UI can highlight it.

**★ A `23514` arrives with a constraint name your code has never heard of. What does that tell you, and what do you do?**
It tells you the database is enforcing an invariant your boundary schema does not know about — almost always a `CHECK` added in a migration and never mirrored into zod. That is a drift alarm rather than merely an error. Short term, the generic 422 is at least the right status class, so nothing is broken for the client beyond a vague message. Medium term you do two things: add the rule to the request schema so the client gets a precise field-level rejection without a database round trip, and add the constraint name to the mapping so the backstop message is useful too. It is worth alerting specifically on the unmapped-constraint case, because it is the only signal you will get that the two definitions of "valid" in your system have diverged.

**★ Why does an unnamed constraint make your error handling fragile?**
Because the mapping key becomes a string you did not write and cannot see in your codebase. Drizzle 0.45.2 derives a foreign-key name from the table and column names — `cards_board_id_boards_id_fk` for this schema — so renaming a column renames the constraint, and nothing in TypeScript references the old value, so no compiler and no test notices. The next deploy silently drops from a precise 404 to a generic 422. Worse, PostgreSQL truncates identifiers at 63 bytes, so a long derived name is stored truncated and your lookup misses from day one on a table with verbose column names. Naming constraints explicitly in the migration makes the key a declared artefact, and a rename then becomes something you must do deliberately in two places — which is exactly the friction you want.

**★ Why should the default branch of a SQLSTATE mapping return "unmapped" rather than a sensible-looking 4xx?**
Because the set of SQLSTATEs is large and most of them are not about the request at all. `40001` serialization_failure means "retry this transaction"; `40P01` deadlock_detected means the same; `53100` disk full and `57014` query_canceled are operational conditions; `42P01` undefined_table means you shipped code ahead of a migration. Rendering any of those as a 4xx tells the client its request was wrong, which is false, and suppresses the alert that would have told you the truth. A default that returns `null` and lets the caller emit a logged 500 is the conservative choice: only codes you have deliberately reasoned about get demoted to a client error, and everything else stays visible.

**★ Why does a partial unique index change your API's behaviour, not just its storage?**
Because it decides what "already exists" means to a user. A plain `UNIQUE (board_id, title)` includes soft-deleted rows, so deleting a card and re-creating it with the same title returns 409 — the user sees a conflict with something they cannot see, which is unexplainable in the UI. `WHERE deleted_at IS NULL` makes the constraint agree with the user's mental model: a deleted card is gone, so its title is free. The same reasoning runs through every read query in [06](06-read.md), and it is the reason soft delete is never a purely additive change.

---

← [05c · Reading a constraint violation](05c-constraint-violations-and-sqlstate.md) · Next → [05d · Idempotency keys for a retried POST](05d-idempotency-keys-for-a-retried-post.md)
