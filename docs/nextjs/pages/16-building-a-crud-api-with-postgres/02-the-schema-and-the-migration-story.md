---
title: "You do not design a table for the noun, you design it for the six queries the contract has already committed you to — which is why the schema comes after the contract and why every column in it has a request that justifies it"
sidebar_label: "02 · The schema"
sidebar_position: 13
description: "The five queries the six routes actually issue, the SprintDesk cards table derived from them, why every column exists including the two whose behaviour other topics own, the composite index that is the cursor written a second time, and the columns deliberately absent."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/index.html) — [`CREATE TABLE`](https://www.postgresql.org/docs/18/sql-createtable.html), [Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html), [UUID Type](https://www.postgresql.org/docs/18/datatype-uuid.html), [release notes](https://www.postgresql.org/docs/18/release-18.html) — and the [Drizzle ORM PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg) and [indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints) references.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**The instinct when told to build a cards API is to write a `cards` table by listing the attributes of a card. That produces a table that is correct and slow, because it is shaped by the noun rather than by the requests. The contract in [01](01-the-resource-contract.md) has already committed you to six routes, and those six routes issue exactly five distinct query shapes. Every one of those shapes is a demand on the physical design — an ordering, a filter, a uniqueness, a cascade — and a column or an index that does not answer one of them is speculation you will pay to migrate later.**

## The five queries the contract actually issues

Read them off the routes, before touching a schema file.

| # | Route | The query, in words |
|---|---|---|
| 1 | `GET /api/boards/[boardId]/cards` | Rows for one board, in a stable total order, from a cursor, limited |
| 2 | `POST /api/boards/[boardId]/cards` | Insert one row for a board, returning what the server computed |
| 3 | `GET /api/cards/[cardId]` | One row by primary key |
| 4 | `PATCH` / `PUT /api/cards/[cardId]` | Update one row by primary key, conditional on its current version |
| 5 | `DELETE /api/cards/[cardId]` | Remove one row by primary key |

Plus one that is not a route and drives more of the design than any of them: **the ownership predicate** — for a given card, is the caller a member of the team that owns the board that owns it? That is a three-hop join, it runs on *every* one of the five, and it is the reason `board_id` is `NOT NULL` and indexed rather than merely present.

Four of the five are primary-key lookups, which any table gives you for free. **The entire physical design is driven by query 1 and by the predicate.** That is a useful thing to notice early, because it tells you where the one index that matters goes.

## The table

```ts
// db/schema.ts
import { pgTable, uuid, text, integer, doublePrecision, timestamp, pgEnum, index, unique } from 'drizzle-orm/pg-core'

export const cardStatus = pgEnum('card_status', ['todo', 'doing', 'done'])

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body'),
  status: cardStatus('status').notNull().default('todo'),
  position: doublePrecision('position').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  boardCreatedIdx: index('cards_board_created_idx').on(t.boardId, t.createdAt, t.id),
}))
```

That is the whole table, and every line answers something above. Going through it column by column is not padding — each one is a decision with a cost, and three of them are decisions people routinely get wrong.

### `id: uuid().primaryKey().defaultRandom()`

`defaultRandom()` emits `gen_random_uuid()`, a version 4 UUID: uniformly random, so successive inserts land in random leaves of the primary key's b-tree. That is the known cost of random UUID keys, and PostgreSQL 18 offers the fix:

> *"Add `UUID` version 7 generation function `uuidv7()` … This `UUID` value is temporally sortable. Function alias `uuidv4()` has been added to explicitly generate version 4 UUIDs."*
> — [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)

⚠️ **I could not confirm that `drizzle-orm` 0.45.2 exposes a dedicated v7 default helper**, and the 0.45.x column-type documentation does not list one. If you want v7 keys on this version, express the default as raw SQL rather than assuming a helper exists:

```ts
import { sql } from 'drizzle-orm'

// PostgreSQL 18 only. Temporally sortable keys, no client-visible change.
id: uuid('id').primaryKey().default(sql`uuidv7()`),
```

The contract in [01c](01c-what-the-client-may-rely-on.md) calls the id an opaque string precisely so that this stays a schema decision rather than a client-visible one.

### `boardId: uuid().notNull().references(boards.id, { onDelete: 'cascade' })`

Three separate things in one line.

**`notNull`** — a card with no board has no owner, so it has no authorization answer. It is not merely required data; a nullable `board_id` would mean the ownership predicate has a third outcome nobody wrote a status code for.

**`references`** — a real `FOREIGN KEY` constraint, so a `POST` naming a board that does not exist is rejected by the database as `23503 foreign_key_violation` before any application code has an opinion. That is the subject of [02b](02b-constraints-are-the-first-validation-layer.md).

**`onDelete: 'cascade'`** — deleting a board deletes its cards. This is the one clause in the schema with a genuine argument against it: cascade is a data-loss primitive, and it fires from a statement that never mentions `cards`. It is right here because a card outside a board is meaningless — there is no orphan state to preserve — but it is worth knowing that the alternative, `restrict`, turns "delete this board" into "delete every card first", which is a client-visible workflow rather than a schema detail. [Topic 08c · Cascades and referential integrity](08c-cascades-and-referential-integrity.md) owns the behaviour; the schema owns the choice.

🔴 **A foreign key needs an index on the referencing side, and Postgres does not create one for you.** It creates a unique index for the *referenced* primary key, not for `cards.board_id`. Without one, every delete of a board scans `cards` to check the constraint, and every ownership join does the same. Here the composite index below happens to lead with `board_id`, so it serves that purpose — which is worth noticing rather than assuming, because on a table where the FK column is not the leading column of any index, this is a silent full-scan on every parent delete.

### `title: text().notNull()` — and why not `varchar(200)`

The contract says 1–200 characters. The column says `text`.

In PostgreSQL there is no storage or performance difference between `text` and `varchar(n)`; the length limit is a check, implemented as a constraint. Putting the limit in the column type means changing it is a type change; putting it in a `CHECK` constraint means changing it is a constraint swap, which can be done with `NOT VALID` and validated concurrently ([02d](02d-the-lock-a-migration-actually-takes.md)). Same enforcement, cheaper evolution. [02b](02b-constraints-are-the-first-validation-layer.md) adds the constraint.

`notNull` with no default: a card with no title is not a card. There is deliberately no `''` default, because a default here would convert a client bug into a silently-created empty card.

### `body: text()` — nullable, on purpose

The only nullable content column, and [01c](01c-what-the-client-may-rely-on.md) already committed to what `null` means: no description, and never `''`. The normalisation from `''` to `null` happens on write in the DAL, not in a database default, because a default cannot see the difference between "not supplied" and "supplied as empty".

### `status: cardStatus().notNull().default('todo')`

A `pgEnum`, not a `text` column with a `CHECK`. The trade is real and worth stating in both directions:

| | `pgEnum` | `text` + `CHECK (status IN (…))` |
|---|---|---|
| Invalid value rejected | yes, as `22P02 invalid_text_representation` | yes, as `23514 check_violation` |
| Adding a member | `ALTER TYPE … ADD VALUE`, with its own restrictions | swap the check constraint |
| Removing a member | effectively not supported | drop and re-add the constraint |
| Ordering | the declared order, usable in `ORDER BY` | alphabetical unless you write a `CASE` |
| Storage | 4 bytes | the string |

The enum wins on ordering, which matters for a board that renders columns in `todo → doing → done` order, and loses on removal, which you should not be doing anyway. The migration hazard of `ALTER TYPE … ADD VALUE` is [02e](02e-expand-and-contract.md).

### `position: doublePrecision().notNull()`

The sparse ordering key. No default, because the correct initial value depends on the board's current contents — the DAL computes it.

The reason for a float rather than an integer is one query: inserting a card between two others must write one row. With integers, "between 3 and 4" does not exist, so you renumber everything after the insertion point. With doubles, it is `(3 + 4) / 2`. That is the entire justification, and it has a known limit: repeatedly splitting the same gap exhausts double precision after roughly fifty subdivisions, at which point two positions compare equal and the order becomes whatever the tiebreaker says. That is survivable *because the query's ordering is a total order that includes the id* — the rows do not shuffle, they just stop respecting the user's intent — and the fix is a periodic renormalisation pass, not a schema change.

⚠️ **`position` is not `UNIQUE`.** It cannot be, given the exhaustion case above, and making it unique would convert a cosmetic degradation into a `23505` on a drag-and-drop.

### `version: integer().notNull().default(1)`

Optimistic concurrency. The column exists here because it is schema; [topic 07d · Optimistic concurrency with a version column](07d-optimistic-concurrency-with-a-version-column.md) owns what it means. The two things the schema commits to are that it starts at 1 and that it is `NOT NULL`, so that `WHERE id = $1 AND version = $2` is never a comparison against null — which would match nothing and produce a `409` that no client could explain. (A version supplied as a body field is a `409`, not a `412`: RFC 9110 scopes 412 to *"conditions given in the request header fields"*, which is the `If-Match` path in [07e](07e-etag-if-match-and-412.md).)

### `createdAt` / `updatedAt: timestamp({ withTimezone: true })`

`withTimezone: true` produces `timestamptz`, and this is the one type choice in the table that is not a trade-off — it is simply correct, and `timestamp without time zone` is simply wrong for an instant.

`timestamptz` stores a UTC instant. It does not store a zone; it converts on input and output using the session's `TimeZone` setting. Two consequences land directly on this chapter:

- Comparison and ordering are absolute, so a card created on an instance in Frankfurt sorts correctly against one created in Oregon. `timestamp` without a zone gives you two local wall-clock times and no way to compare them.
- The session-dependent *rendering* is a reason to format the value in application code rather than relying on the session, because a session `SET` does not survive a transaction pooler ([15 · 01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md)).

`defaultNow()` emits `now()`, which is transaction-start time, not statement time. Every row inserted in one transaction gets the *same* `created_at`. That is a feature — it makes a multi-row insert consistent — and it is also exactly why the ordering in [01c](01c-what-the-client-may-rely-on.md) is `(created_at, id)` and not `(created_at)`.

🔴 **`updatedAt` has a `defaultNow()` and nothing that maintains it.** A default fires on insert, never on update. Unless every write path sets it explicitly or a trigger does, `updated_at` will equal `created_at` forever and nobody will notice until a sync client relies on it. The DAL setting it on every write is the answer this chapter takes ([04](04-the-data-access-layer.md)); a `BEFORE UPDATE` trigger is the answer that survives someone writing SQL by hand.

### `deletedAt: timestamp({ withTimezone: true })` — nullable, and the index it implies

Soft delete. [Topic 08 · DELETE](08-delete.md) owns the semantics and [08b](08b-what-soft-delete-costs-every-read.md) owns the cost; the schema's contribution is the column and one consequence people miss: **once `deleted_at` exists, every read query in the API gains `AND deleted_at IS NULL`**, which means the index below is answering a filtered query it was not built for. The remedy is a partial index, and the reason it is not in the canonical block above is that it only pays once soft delete is actually in use:

```sql
-- The index the list query wants once soft delete exists.
CREATE INDEX CONCURRENTLY cards_board_created_live_idx
  ON cards (board_id, created_at, id)
  WHERE deleted_at IS NULL;
```

A partial index is smaller, and — more importantly — it does not carry the rows the query can never return.

## The index, which is the cursor written a second time

```ts
boardCreatedIdx: index('cards_board_created_idx').on(t.boardId, t.createdAt, t.id)
```

Three columns, in that order, for one query:

```sql
SELECT id, board_id, title, body, status, position, version, created_at, updated_at
FROM cards
WHERE board_id = $1
  AND (created_at, id) > ($2, $3)     -- the cursor
ORDER BY created_at, id
LIMIT $4;
```

`board_id` leads because it is an equality filter and equality columns always lead. `created_at, id` follow in exactly the order the `ORDER BY` needs, so the index supplies the sort rather than the executor performing one. And `id` is in the index rather than only in the `ORDER BY` because the row comparison `(created_at, id) > ($2, $3)` is what makes the cursor a *seek* rather than a filter — a two-column comparison against a two-column index prefix.

**The index, the ordering in the contract and the cursor's contents are one decision written in three places.** If any of the three drifts, the symptom is not an error — it is a page that quietly skips or repeats rows. That is worth a comment in the schema file naming the other two.

The single-row routes need nothing: `id` is the primary key, which is a unique index already.

## What is deliberately not in this table

- **No `team_id`.** It is reachable through `board_id`, and denormalising it means every board move has to update its cards. The ownership predicate joins; the join is indexed; that is the correct trade at this size, and [04c](04c-the-ownership-predicate.md) shows the query.
- **No `board_name`, no `assignee_name`.** Denormalised display fields make renaming a board a write to every card.
- **No `comment_count`, no `attachment_count`.** A counter column is a write-amplification and a contention point on every child insert, for a number the contract does not promise ([01c](01c-what-the-client-may-rely-on.md) refuses counts explicitly).
- **No `unique(board_id, title)`.** It would be easy to add and it is a product decision, not a technical one — and the moment it exists, `POST` gains a `409` that [01b](01b-the-six-routes-and-the-codes-they-commit-to.md) would have to have committed to. The `unique` import is in the schema block above because topic 05 uses it for the idempotency-key table, not for this one.

Each of those absences is the same principle: **a column that no query in the contract needs is a column you are choosing to migrate later.**

## Gotchas

**★ Symptom: the list query is fast on a small board and slow on a large one, with the index apparently present.** Cause: the index is on `(board_id, created_at)` and the `ORDER BY` is `created_at, id`, so the index supplies the filter but not the sort, and the executor sorts the whole matching set before applying `LIMIT`. Fix: put `id` in the index, in the position the `ORDER BY` uses it. The three-column form above is not belt-and-braces; the third column is what turns a sort into a seek.

**★ Symptom: deleting a board takes a long time and blocks.** Cause: the cascade has to find the child rows, and if no index leads with `board_id` that is a sequential scan of `cards` for every board deleted. Fix: index the referencing column — here the composite index leads with `board_id` and covers it. Verify that rather than assuming it; on a table where the FK column is not a leading column anywhere, this is a scan nobody sees until the table is large.

**★ Symptom: `updated_at` is always identical to `created_at`.** Cause: `defaultNow()` fires on insert only. There is no such thing as an "on update" default in Postgres. Fix: set it in the DAL on every write path, or add a trigger so hand-written SQL cannot bypass it:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**★ Symptom: two cards inserted in the same request have identical `created_at`, and a cursor built on `created_at` alone skips one.** Cause: `now()` is transaction-start time, so every row in one transaction shares it exactly. Fix: never build a cursor on a non-unique column. The total order is `(created_at, id)`, which is why the index carries the id.

**★ Symptom: dragging a card between two others eventually stops respecting the drop position.** Cause: repeated midpoint insertion into the same gap exhausts double precision, and two positions become equal. Fix: detect the collapse and renormalise the board — rewrite positions as `1.0, 2.0, 3.0…` in one transaction. This is maintenance, not a schema change, and it is why `position` must not be `UNIQUE`: a unique constraint turns a cosmetic problem into a failed drag.

**★ Symptom: `deleted_at` was added and every list query got slower.** Cause: the index now covers rows the query filters out, so the scan reads deleted rows to discard them. Fix: a partial index with `WHERE deleted_at IS NULL`, built `CONCURRENTLY` so it does not block writes — and note that `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, which is why it does not belong in an ordinary generated migration ([02d](02d-the-lock-a-migration-actually-takes.md)).

**★ Symptom: a card exists whose board does not, and no error was ever raised.** Cause: the foreign key was declared in the Drizzle schema and the migration that would create it was never applied, so `references()` is a TypeScript fact rather than a database one. Fix: this is exactly the class of failure [02c](02c-the-migration-is-a-release-step.md) exists to close — the schema file is a claim, and only the ledger proves the database agrees.

**★ Symptom: `status` accepts a value that is not in the enum after a deploy.** Cause: the enum value was added to the TypeScript union and the `ALTER TYPE` was never generated, or vice versa — the two halves of the change live in two files. Fix: generate the migration from the schema and apply it as a release step, and remember that the API's `422` for an unknown status comes from validation, not from the database, on the write path that never reaches SQL.

**★ Symptom: someone proposes `varchar(200)` "since the contract says 200".** Cause: reasonable instinct, wrong mechanism. In PostgreSQL `varchar(n)` and `text` are the same storage; the only difference is that the length limit is welded into the type. Fix: `text` plus a `CHECK`, so the limit is a constraint you can swap with `NOT VALID` and validate under a `SHARE UPDATE EXCLUSIVE` lock instead of a type change that rewrites.

**★ Symptom: `timestamp` columns compare wrongly between two deployment regions.** Cause: `timestamp without time zone` was used, so each row holds a local wall-clock reading with no zone, and comparing them is meaningless. Fix: `timestamptz` — which is what `withTimezone: true` produces — everywhere an instant is stored. There is no case in this API where the zone-less type is correct.

## Interview questions

**★ Why derive the schema from the routes rather than from the entity?**
Because the physical design is answering queries, and the entity does not tell you what the queries are. Listing the attributes of a card gives you the columns and nothing about ordering, filtering, uniqueness or cascade — the four things that decide whether the table is usable at size. Reading the six routes instead gives you five query shapes, of which four are primary-key lookups that need nothing, and one that needs a specific three-column index in a specific order. That is a much smaller and much better-justified design, and it has the side benefit that every column can be traced to a request; anything that cannot is speculation you will pay to migrate.

**★ Why is `position` a double rather than an integer, and what breaks eventually?**
Because insertion between two neighbours has to be a one-row write. Integers give you no value between 3 and 4, so a drop in the middle of a board renumbers everything after it — a write proportional to the board size, on a user interaction that happens constantly. Doubles give you the midpoint. What breaks is precision: repeatedly splitting the same gap runs out of representable values after roughly fifty subdivisions, and two cards end up with equal positions. That is survivable because the query's ordering is a total order that includes the id, so nothing shuffles randomly; the user's intended order just stops being honoured in that spot. The fix is a periodic renormalisation, and the schema's contribution is to *not* make `position` unique, because a unique constraint would turn that cosmetic degradation into a failed request.

**★ What does `ON DELETE CASCADE` actually commit you to?**
That deleting a board is a bulk delete of an unbounded number of rows, triggered by a statement that does not mention them. Three consequences follow. It needs an index on `cards.board_id` or every board delete scans the child table. It makes the delete's duration a function of the child count, so a lock that looked brief is not. And it is irreversible from the application's point of view — nothing in the `DELETE FROM boards` statement tells you how many cards went with it unless you count first. It is the right choice here because a card outside a board has no meaning and therefore no orphan state worth preserving, but "there is no valid orphan" is the actual test, not "it is convenient".

**★ Why `timestamptz` and not `timestamp`, given the database is in one region?**
Because the database's region is not the property in question — the instant is. `timestamp without time zone` stores a wall-clock reading with no zone attached, so two values are only comparable if you happen to know they were recorded in the same zone, and nothing in the type enforces that. `timestamptz` stores a UTC instant and converts on the way in and out, which makes comparison and ordering absolute regardless of where the writer was. The "one region" argument also expires the first time you add a read replica elsewhere, run a migration from a laptop in another country, or restore a backup on a machine with a different `TimeZone`, and by then the wrong values are already stored.

**★ Why is the index three columns and not two?**
Because the third column is what makes the pagination a seek. The query filters on `board_id`, orders by `created_at, id`, and compares the cursor as a row value `(created_at, id) > ($2, $3)`. An index on `(board_id, created_at)` can satisfy the filter and part of the order, but the executor still has to sort to break `created_at` ties and cannot use the two-column comparison as a starting point in the tree — so it reads more than the page and sorts it. With `id` in the index, the comparison lands directly on an index prefix and the scan starts where the previous page stopped. The deeper point is that the index, the ordering the contract promises and the contents of the cursor are the same decision written three times, and drift between them produces skipped rows rather than an error.

**★ `pgEnum` or a text column with a check constraint?**
Enum if you want the declared order to be the sort order and you expect the set to grow but never shrink, which is the usual shape of a workflow status. A check constraint if the set is volatile, or if it is genuinely reference data that belongs in a lookup table. The decisive practical differences are that adding an enum member is `ALTER TYPE … ADD VALUE` with its own transactional restrictions, removing one is effectively not supported, and an invalid value arrives as `22P02` rather than `23514` — which matters because your error mapping keys on the SQLSTATE. For SprintDesk the enum wins because a board renders its columns in workflow order and getting that ordering from the type rather than from a `CASE` expression in every query is worth the migration awkwardness.

**★ What is wrong with adding a `comment_count` column now, before you need it?**
It turns every comment insert into a write to the card row, which serialises concurrent comments on the same card behind one row lock, and it makes the count something you must keep correct forever including through deletes, cascades and restores. It also becomes a client promise the moment it appears in a response — and [01c](01c-what-the-client-may-rely-on.md) explicitly refuses to promise counts, precisely because an exact count is the cheapest-looking and most expensive-to-serve field in any API. The general rule is that a derived column is a cache with no invalidation story, and adding one before a query demands it means you have taken on the maintenance without having measured the benefit.

---

← [01c · What the client may rely on](01c-what-the-client-may-rely-on.md) · [Chapter 16 overview](01-explanation.md) · Next → [02b · Constraints are the first validation layer](02b-constraints-are-the-first-validation-layer.md)
