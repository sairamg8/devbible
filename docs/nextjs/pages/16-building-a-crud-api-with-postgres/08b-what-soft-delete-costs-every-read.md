---
title: "The cost of soft delete is not the column, it is that every query against the table now needs a predicate that nothing enforces — and the query that forgets it does not fail, it returns deleted rows to a user and calls that a 200"
sidebar_label: "08b · What soft delete costs"
sidebar_position: 58
description: "Why the predicate spreads to every read, join, count and export, the four containment strategies ranked from weakest to strongest, partial indexes and the planner rule that decides whether yours is used, and RLS as the only mechanism that cannot be bypassed."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [11.8. Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html), [`CREATE VIEW`](https://www.postgresql.org/docs/18/sql-createview.html), [5.9. Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html). The planner rule for partial-index usability, the `CHECK OPTION` rule and the RLS bypass rule are quoted verbatim. `pgView` was checked against the published `drizzle-orm` **0.45.2** typings ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/view.d.ts)).
> Documentation-verified; **no sandbox run, no timings, no query plans**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**Adding `deleted_at` to a table is not adding a column, it is adding a global invariant that no mechanism in your stack enforces by default. Every `SELECT`, every `COUNT`, every join that reaches the table, every aggregate, every CSV export, every dashboard query somebody writes against a read replica six months from now — all of them must carry `deleted_at IS NULL`, and the one that does not is a data leak that returns a 200. There is no compiler error, no runtime warning and no test that catches it, because a query that returns extra rows is a perfectly valid query. This page is about pushing that invariant somewhere it cannot be forgotten, and about the index that stops the predicate from costing you a scan.**

## Why it spreads further than you expect

The predicate is not needed once per endpoint. It is needed once per *reference to the table*, and references multiply:

```sql
-- 1. the obvious read
SELECT * FROM cards WHERE board_id = $1 AND deleted_at IS NULL;

-- 2. a count that drives a badge in the UI
SELECT count(*) FROM cards WHERE board_id = $1 AND status = 'doing' AND deleted_at IS NULL;

-- 3. a join, where the predicate belongs on the JOIN and not the WHERE if it is a LEFT JOIN
SELECT b.id, c.title
  FROM boards b
  LEFT JOIN cards c ON c.board_id = b.id AND c.deleted_at IS NULL
 WHERE b.team_id = $1;

-- 4. an aggregate used for a WIP limit — the one where a missing predicate changes a decision
SELECT count(*) FROM cards WHERE board_id = $1 AND status = 'doing' AND deleted_at IS NULL;

-- 5. an EXISTS in an authorization check
SELECT EXISTS (SELECT 1 FROM cards WHERE id = $1 AND deleted_at IS NULL);
```

🔴 **Case 3 is the one people get wrong.** Putting `c.deleted_at IS NULL` in the `WHERE` clause of a query with a `LEFT JOIN cards` turns the outer join into an inner one for precisely the rows you were filtering: a board whose cards have all been deleted produces only rows the `WHERE` throws away, so **the board itself disappears from the list**. A board with no cards ever survives, because its null-extended row satisfies the predicate — which is why this is discovered late, by a user with one deleted card. The predicate has to be on the `ON` clause.

Case 4 is the most expensive: a WIP-limit count that includes deleted cards refuses a legal write, and the user sees "board is full" for a board that visibly is not.

## The four containment strategies

Ranked by how hard they are to bypass, which is the only ranking that matters.

### 1 · A convention. (Weakest — it is not a mechanism)

*"Always remember to add the predicate."* This works until the first person who has not read this page writes a query. It is not a strategy; it is the absence of one.

### 2 · One base query in the Data Access Layer

```ts
// lib/dal/cards.ts
import { and, eq, isNull, SQL } from 'drizzle-orm'
import { db } from '@/db'
import { cards } from '@/db/schema'

/** The ONLY predicate anything in this module starts from. */
const live = () => isNull(cards.deletedAt)

export const liveCards = (extra?: SQL) =>
  db.select().from(cards).where(extra ? and(live(), extra) : live())

export async function listBoardCards(boardId: string) {
  return liveCards(eq(cards.boardId, boardId))
    .orderBy(asc(cards.position), asc(cards.createdAt), asc(cards.id))
}
```

Strong *inside* the module and worth nothing outside it. It relies on nobody calling `db.select().from(cards)` directly, which is exactly the guarantee **the Data Access Layer, topic 04** *(not written yet)* exists to make. It does nothing for `psql`, migrations, BI tools, or a colleague's one-off script.

### 3 · A view, so the live set has its own name

```sql
CREATE VIEW live_cards AS
  SELECT * FROM cards WHERE deleted_at IS NULL;
```

Now "the cards" and "all rows ever in the cards table" are two different names, and picking the wrong one is a visible choice rather than an omission. A dashboard tool pointed at `live_cards` cannot leak. A view is also automatically updatable in PostgreSQL when it is a simple `SELECT` from one table, so writes still work through it — but 🔴 **an automatically updatable view will happily let you write a row that the view's own condition excludes**:

> *"When this option is specified, `INSERT`, `UPDATE`, and `MERGE` commands on the view will be checked to ensure that new rows satisfy the view-defining condition (that is, the new rows are checked to ensure that they are visible through the view). If they are not, the update will be rejected. If the `CHECK OPTION` is not specified, `INSERT`, `UPDATE`, and `MERGE` commands on the view are allowed to create rows that are not visible through the view."*
> — [PostgreSQL 18 · `CREATE VIEW`](https://www.postgresql.org/docs/18/sql-createview.html)

```sql
CREATE VIEW live_cards AS
  SELECT * FROM cards WHERE deleted_at IS NULL
  WITH CHECK OPTION;      -- reject writes that would produce an invisible row
```

Declare the view in Drizzle so the types follow:

```ts
// db/schema.ts
import { pgView } from 'drizzle-orm/pg-core'
export const liveCardsView = pgView('live_cards').as((qb) =>
  qb.select().from(cards).where(isNull(cards.deletedAt)))
```

### 4 · Row-level security, the only version that cannot be bypassed

A policy is enforced by the database for every client, including `psql`, including the BI tool, including a script written by someone who has never heard of `deleted_at`.

```sql
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_hide_deleted ON cards
  FOR SELECT
  USING (deleted_at IS NULL);
```

⚠️ Two caveats decide whether this is available to you. The first is who you connect as:

> *"Superusers and roles with the `BYPASSRLS` attribute always bypass the row security system when accessing a table. Table owners normally bypass row security as well, though a table owner can choose to be subject to row security with `ALTER TABLE ... FORCE ROW LEVEL SECURITY`."*
> — [PostgreSQL 18 · 5.9](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)

The Neon-specific version of that trap — `neondb_owner` has `BYPASSRLS` and is the role the console hands you — is in ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md). The second caveat is that an admin path which legitimately needs to *see* deleted rows now needs a second role or a policy that admits it, which is real operational work.

**The honest recommendation: 2 plus 3.** The DAL for application code, the view for everything else. Reach for 4 when the table is genuinely sensitive and you already run RLS for tenancy, because turning it on for one column is a large amount of machinery for one predicate.

## The index, and the planner rule that decides if it is used

Every live-row query now filters on `deleted_at IS NULL`. A partial index stores only the rows that satisfy the predicate:

> *"A partial index is an index built over a subset of a table; the subset is defined by a conditional expression (called the predicate of the partial index). The index contains entries only for those table rows that satisfy the predicate."*
> — [PostgreSQL 18 · 11.8](https://www.postgresql.org/docs/18/indexes-partial.html)

Applied to the composite index the chapter's schema already carries for topic 06's keyset pagination:

```sql
CREATE INDEX cards_board_created_live_idx
    ON cards (board_id, created_at, id)
 WHERE deleted_at IS NULL;
```

The index is smaller than the full one — deleted rows are not in it at all — and it stays smaller as deletions accumulate. It also, as the manual notes, *"speed[s] up many table update operations because the index does not need to be updated in all cases."*

🔴 **But it is only usable if the planner can prove your query implies its predicate, and the proof is syntactic:**

> *"To be precise, a partial index can be used in a query only if the system can recognize that the WHERE condition of the query mathematically implies the predicate of the index. PostgreSQL does not have a sophisticated theorem prover that can recognize mathematically equivalent expressions that are written in different forms. … otherwise the predicate condition must exactly match part of the query's WHERE condition or the index will not be recognized as usable. Matching takes place at query planning time, not at run time. As a result, parameterized query clauses do not work with a partial index."*
> — [PostgreSQL 18 · 11.8](https://www.postgresql.org/docs/18/indexes-partial.html)

Two consequences that decide how you write the DAL:

- **Write `deleted_at IS NULL` literally, everywhere, in exactly that form.** `NOT (deleted_at IS NOT NULL)` is mathematically identical and will not match. Neither will `coalesce(deleted_at, 'infinity') = 'infinity'`.
- **Never parameterise the flag.** `WHERE deleted_at IS NULL = $2` or `WHERE ($2 OR deleted_at IS NULL)` — the "include deleted for admins" shortcut — defeats the index by construction, because the matching happens at plan time and the parameter's value is not known then. An admin view that needs deleted rows is a **different query**, not the same query with a boolean:

```ts
// ✅ two queries, each planner-friendly
export const listLiveCards = (boardId: string) =>
  db.select().from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))

export const listAllCardsIncludingDeleted = (boardId: string) =>
  db.select().from(cards).where(eq(cards.boardId, boardId))
```

⚠️ Drizzle's `isNull(cards.deletedAt)` emits the literal `"deleted_at" is null`, which is the form the planner needs — the parameterisation trap is one you have to introduce deliberately, usually by trying to be clever with a flag.

## What the predicate does not cover

Soft delete only hides rows from queries you control. Three places it does not reach, each of which needs its own deletion:

1. **A search index.** A soft-deleted card is still in Elasticsearch, Typesense or a `tsvector` column until something removes it.
2. **A cache.** A rendered board page, an RSC payload, a CDN entry. The delete must invalidate the same tags an update does.
3. **A replica of the data in another service.** Anything you exported, streamed or webhooked.

None of these is soft-delete-specific — a hard delete has the same obligations — but soft delete makes them easier to forget, because the row still being there feels like nothing has changed.

## Gotchas

**★ Symptom: a board disappears from a list after all its cards are deleted.** Cause: `c.deleted_at IS NULL` was written in the `WHERE` clause of a query with a `LEFT JOIN cards`, which turns the outer join into an inner one. Fix: the predicate goes on the `ON` clause:

```sql
LEFT JOIN cards c ON c.board_id = b.id AND c.deleted_at IS NULL
```

**★ Symptom: the WIP limit rejects a move on a board with visibly fewer cards than the limit.** Cause: the counting query omitted the predicate, so deleted cards count toward it. Fix: add it — and when you add `deleted_at` to a table, enumerate every aggregate over that table in the same change, because aggregates are where a missing predicate is least visible.

**★ Symptom: the partial index exists and query plans do not use it.** Cause: the query's `WHERE` condition does not syntactically imply the index predicate — usually because the flag was parameterised, or written as `NOT (deleted_at IS NOT NULL)`. Fix: write the literal `deleted_at IS NULL`, and split "include deleted" into a separate query rather than a bound parameter, as above.

**★ Symptom: a deleted card is still returned by full-text search.** Cause: the search index is a separate store and the soft delete only touched the row. Fix: treat the delete like any other mutation — it removes from the index, invalidates the cache tag, and emits the event, in the same transaction as the `UPDATE` where possible.

**★ Symptom: the view `live_cards` exists and someone still queried `cards` directly.** Cause: the table is still there and still selectable. Fix: a view is a naming mechanism, not an access control; if it must be unbypassable, revoke `SELECT` on the base table from the application role and grant it on the view only:

```sql
REVOKE SELECT ON cards FROM sprintdesk_app;
GRANT  SELECT ON live_cards TO sprintdesk_app;
```

**★ Symptom: an `INSERT` through the view succeeds and the new row is immediately invisible.** Cause: an automatically updatable view does not check that written rows satisfy its own condition. Fix: `WITH CHECK OPTION` on the view, which rejects the write instead of swallowing it.

**★ Symptom: RLS was enabled and the application still sees deleted rows.** Cause: the connecting role owns the table, or has `BYPASSRLS`. Fix: connect as a non-owning application role without `BYPASSRLS`, or set `ALTER TABLE cards FORCE ROW LEVEL SECURITY` so the owner is subject to its own policies too. Verify rather than assume:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'sprintdesk_app';
```

**★ Symptom: the table keeps growing and queries get slower even though the live set is small.** Cause: soft-deleted rows are never removed, so the heap grows without bound. Fix: soft delete needs a retention job that hard-deletes rows past the window, and that job is the reason `deleted_at` is a timestamp rather than a boolean:

```sql
DELETE FROM cards WHERE deleted_at < now() - interval '90 days';
```

**★ Symptom: a unique constraint rejects a new card whose only conflict is with a deleted one.** Cause: constraints do not know about your predicate. Fix: a partial unique index over the live subset, which is [08e](08e-restoring-a-soft-deleted-row.md)'s subject.

**★ Symptom: an admin needs to see deleted rows and the DAL cannot express it.** Cause: every function in the module hard-codes the live predicate, which is correct for application code and wrong for the one caller that legitimately needs everything. Fix: a separate, explicitly named function — `listAllCardsIncludingDeleted` — with its own authorization, rather than a boolean parameter threaded through the normal path. The name is the safety mechanism: nobody calls it by accident.

## Interview questions

**★ What is the real cost of soft delete?**
A permanent, unenforced invariant on every query against the table — present and future, application code and everything else. The column costs nothing; the obligation costs forever. And the failure mode is the worst kind: a query that forgets the predicate returns *more* rows, which is a valid result, so there is no error, no exception and no failing test. The only witness is a user seeing something they deleted.

**★ Where should the `deleted_at IS NULL` predicate live?**
As far down as you can push it. A convention is not a mechanism. A base query in the DAL covers application code and nothing else. A view gives the live set its own name, so choosing the wrong one is visible, and combined with revoking `SELECT` on the base table it becomes enforceable. Row-level security is the only version the database enforces for every client including `psql`, at the cost of needing a non-owning role without `BYPASSRLS` and a deliberate escape hatch for admin paths.

**★ You added a partial index on `WHERE deleted_at IS NULL` and plans ignore it. Why?**
Because the planner has to prove your query's `WHERE` condition implies the index predicate, and the manual is explicit that it does not have a theorem prover — the predicate "must exactly match part of the query's WHERE condition". Matching happens at plan time, so a bound parameter can never satisfy it; that is why the "include deleted rows if this flag is true" shortcut silently disables the index. Two separate queries, each with a literal predicate, is the fix.

**★ Why does `c.deleted_at IS NULL` in the WHERE clause break a LEFT JOIN?**
Because the `ON` clause decides what joins and the `WHERE` clause decides what survives, and a soft-delete predicate belongs to the first question. Work through the three cases: a board with no cards at all gets one null-extended row, `c.deleted_at` is null, the predicate is true, and the board survives. A board with live cards keeps them. But a board whose cards were *all* deleted produces only real rows with `deleted_at` set, the `WHERE` removes every one of them, and the board itself vanishes from the result — the outer join has been silently converted into an inner join for exactly the rows you were trying to filter. Moving the predicate to the `ON` clause makes the deleted cards not join at all, so that board falls back to its null-extended row and stays in the list with zero cards, which is what you meant.

**★ Does soft delete remove your obligation to invalidate caches and search indexes?**
No, and it makes the obligation easier to overlook because the row is still present, which feels like less of a change. A soft delete has exactly the same downstream consequences as a hard one: de-index it, invalidate the cache tag, notify anything that has a copy. On this stack that means the delete emits the same event and invalidates the same tag as an update, ideally in the same transaction as the write.

**★ How do you stop a soft-deleted table growing forever?**
A retention job that hard-deletes past the window, which is why the column is a timestamp: `DELETE FROM cards WHERE deleted_at < now() - interval '90 days'`. Without it, soft delete is a policy of never deleting anything, and every sequential scan and every index that is not partial pays for rows nobody will ever read. Deciding the window at the same time as adding the column is the difference between a design and a deferral.

---

← [08 · DELETE — hard vs soft](08-delete.md) · [Chapter 16 overview](01-explanation.md) · Next → [08c · Cascades and referential integrity](08c-cascades-and-referential-integrity.md)
