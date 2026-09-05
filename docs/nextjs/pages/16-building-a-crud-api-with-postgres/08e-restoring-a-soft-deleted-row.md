---
title: "Restore is the operation soft delete was bought for and the one nobody implements until it is needed — and it fails on a uniqueness constraint the deleted row still occupies, which is why the constraint has to be partial before the delete, not after the restore"
sidebar_label: "08e · Restore and partial uniqueness"
sidebar_position: 61
description: "Why a deleted row still holds a unique key, the partial unique index that fixes it with the manual's own example, the migration that gets there without downtime, restore as its own endpoint with its own authorization, and what restoring does to children and to the retention window."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [11.8. Partial Indexes, Example 11.3](https://www.postgresql.org/docs/18/indexes-partial.html), [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html), [5.5. Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) — and RFC 9110 §9.3.3 (POST) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html). The partial-unique-index rule and example, and the `CREATE INDEX CONCURRENTLY` failure semantics, are quoted verbatim. Drizzle's index builder was checked against the published `drizzle-orm` **0.45.2** typings — `uniqueIndex(name?)`, `IndexBuilder.where(condition: SQL)`, `IndexBuilder.concurrently()` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/indexes.d.ts)).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**A soft-deleted row is invisible to your queries and completely visible to your constraints. `UNIQUE (board_id, slug)` does not know about `deleted_at`, so a card you deleted still owns its slug: the user cannot create a new card with the same name, and cannot restore the old one either if they created a replacement in the meantime. The fix is a partial unique index over the live subset, and it is the reason soft delete has to be designed before it is deployed — retrofitting it means dropping a constraint on a table that already has duplicate keys hiding in the deleted rows.**

## The failure, precisely

Suppose SprintDesk gives each card a per-board slug so URLs are readable, with the obvious constraint:

```sql
ALTER TABLE cards ADD CONSTRAINT cards_board_slug_key UNIQUE (board_id, slug);
```

Then:

```text
1. User creates  "Login bug"     → slug 'login-bug'          ✅
2. User deletes it               → deleted_at = now()        ✅ row still present
3. User creates  "Login bug"     → slug 'login-bug'          ❌ 23505 unique_violation
                                    against a row they cannot see
4. Support restores card #1      → deleted_at = NULL          ❌ if step 3 had succeeded,
                                    two live rows now claim the same slug
```

Step 3 is the failure users report — *"it says this name is taken and nothing on the board has that name"* — and it is unanswerable from the UI, because the conflicting row is invisible by construction. Step 4 is the failure that arrives later and is worse, because a restore that succeeds when it should not leaves the data in a state the constraint was supposed to make impossible.

## The partial unique index

PostgreSQL's manual describes the technique and gives the pattern:

> *"A third possible use for partial indexes does not require the index to be used in queries at all. The idea here is to create a unique index over a subset of a table, as in Example 11.3. This enforces uniqueness among the rows that satisfy the index predicate, without constraining those that do not."*

> *"Suppose that we have a table describing test outcomes. We wish to ensure that there is only one 'successful' entry for a given subject and target combination, but there might be any number of 'unsuccessful' entries. Here is one way to do it:*
> ```
> CREATE UNIQUE INDEX tests_success_constraint ON tests (subject, target)
>     WHERE success;
> ```
> *This is a particularly efficient approach when there are few successful tests and many unsuccessful ones."*
> — [PostgreSQL 18 · 11.8](https://www.postgresql.org/docs/18/indexes-partial.html)

Substitute "live" for "successful":

```sql
DROP   INDEX IF EXISTS cards_board_slug_key;          -- or drop the constraint
CREATE UNIQUE INDEX cards_board_slug_live_key
    ON cards (board_id, slug)
 WHERE deleted_at IS NULL;
```

Now a deleted card holds no claim on its slug. Step 3 succeeds. Step 4 — the restore — correctly fails, because restoring would produce two live rows with the same key, and *that* is a real conflict a human should resolve.

In Drizzle **0.45.2**, a partial unique index is expressed with the `where` on the index builder:

```ts
// db/schema.ts
import { pgTable, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const cards = pgTable('cards', {
  /* … the chapter's canonical columns … */
}, (t) => ({
  boardCreatedIdx: index('cards_board_created_idx').on(t.boardId, t.createdAt, t.id),
  boardSlugLive: uniqueIndex('cards_board_slug_live_key')
    .on(t.boardId, t.slug)
    .where(sql`${t.deletedAt} is null`),
}))
```

⚠️ A partial *unique index* is an index, not a table constraint — so it cannot be the target of `ON CONFLICT ON CONSTRAINT`, and it does not appear in `information_schema.table_constraints`. `ON CONFLICT (board_id, slug) WHERE deleted_at IS NULL` does work, because the inference clause accepts an index predicate. Tooling that enumerates constraints will not see it, which surprises people writing schema-diff checks.

## Getting there on a table that already has data

You cannot create the partial unique index if the live rows already violate it, and you cannot drop the old constraint after creating the new one if the old one is what is currently protecting you. The order matters:

```sql
-- 1. Find out whether the live set is already clean.
SELECT board_id, slug, count(*)
  FROM cards
 WHERE deleted_at IS NULL
 GROUP BY board_id, slug
HAVING count(*) > 1;

-- 2. Build the new index without an exclusive lock on writes.
CREATE UNIQUE INDEX CONCURRENTLY cards_board_slug_live_key
    ON cards (board_id, slug)
 WHERE deleted_at IS NULL;

-- 3. Only once step 2 reports a valid index, drop the old one.
ALTER TABLE cards DROP CONSTRAINT cards_board_slug_key;
```

🔴 **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.** The manual: *"a regular `CREATE INDEX` command can be performed within a transaction block, but `CREATE INDEX CONCURRENTLY` cannot."* Most migration runners wrap each file in `BEGIN`/`COMMIT`, so this has to be a custom migration — the kind of thing topic 02 is about.

It can also fail, and the failure state is specific:

> *"If a problem arises while scanning the table, such as a deadlock or a uniqueness violation in a unique index, the `CREATE INDEX` command will fail but leave behind an 'invalid' index. This index will be ignored for querying purposes because it might be incomplete; however it will still consume update overhead. … The recommended recovery method in such cases is to drop the index and try again to perform `CREATE INDEX CONCURRENTLY`."*
> — [PostgreSQL 18 · `CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html)

⚠️ **Read the manual's next paragraph before assuming an invalid index is inert**, because for a *unique* index it is not:

> *"Another caveat when building a unique index concurrently is that the uniqueness constraint is already being enforced against other transactions when the second table scan begins. This means that constraint violations could be reported in other queries prior to the index becoming available for use, or even in cases where the index build eventually fails. Also, if a failure does occur in the second scan, the 'invalid' index continues to enforce its uniqueness constraint afterwards."*

So the danger is not a silent gap in enforcement — it is the opposite. A failed build can leave you **enforcing uniqueness through an index that is invisible to the planner**, producing violations from an index nothing in your schema documentation mentions. Check `pg_index.indisvalid`, drop and rebuild rather than leaving it, and do not drop the old constraint until the new index reports valid.

## Restore is an endpoint, not a field

🔴 **Restoring must never be `PATCH {"deletedAt": null}`.** [07b](07b-absent-versus-null.md) already excludes `deletedAt` from the writable set, and this is why: restore has different authorization (who may undelete is not who may edit), a different failure mode (the uniqueness conflict above), a different time window (a retention policy may have expired), and different side effects (children, caches, search index).

```ts
// app/api/cards/[cardId]/restore/route.ts
import { restoreCard } from '@/lib/dal/cards'

export async function POST(_req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const outcome = await restoreCard(cardId)

  switch (outcome.kind) {
    case 'restored':  return Response.json(outcome.card, { status: 200 })
    case 'not_deleted': return Response.json(outcome.card, { status: 200 })  // idempotent
    case 'expired':   return Response.json(
      { code: 'restore_window_expired', deletedAt: outcome.deletedAt }, { status: 409 })
    case 'conflict':  return Response.json(
      { code: 'slug_taken', conflictingCardId: outcome.conflictId }, { status: 409 })
    case 'gone':      return new Response(null, { status: 404 })
  }
}
```

POST rather than PUT because restore is not idempotent in the sense that matters — RFC 9110 §9.3.3 describes POST as requesting that the resource *"process the representation enclosed in the request according to the resource's own specific semantics"*, which is what an operation endpoint is. Making a repeated restore return 200 rather than an error is a choice, made for the same reason as the repeated delete in [08d](08d-status-codes-and-idempotency.md): the goal state is achieved.

```ts
// lib/dal/cards.ts
export type RestoreOutcome =
  | { kind: 'restored'; card: Card } | { kind: 'not_deleted'; card: Card }
  | { kind: 'expired'; deletedAt: Date } | { kind: 'conflict'; conflictId: string }
  | { kind: 'gone' }

const RESTORE_WINDOW_DAYS = 30

export async function restoreCard(cardId: string): Promise<RestoreOutcome> {
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(cards)
      .where(eq(cards.id, cardId)).limit(1).for('update')
    if (!card) return { kind: 'gone' }
    if (card.deletedAt === null) return { kind: 'not_deleted', card }

    const ageMs = Date.now() - card.deletedAt.getTime()
    if (ageMs > RESTORE_WINDOW_DAYS * 86_400_000) {
      return { kind: 'expired', deletedAt: card.deletedAt }
    }

    // Check the live uniqueness ourselves so the client gets a diagnosis, not a 23505.
    const [clash] = await tx.select({ id: cards.id }).from(cards)
      .where(and(eq(cards.boardId, card.boardId), eq(cards.slug, card.slug),
                 isNull(cards.deletedAt)))
      .limit(1)
    if (clash) return { kind: 'conflict', conflictId: clash.id }

    const [restored] = await tx.update(cards)
      .set({ deletedAt: null, version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
      .where(eq(cards.id, cardId))
      .returning()

    await tx.update(comments)            // undo the application-level cascade from 08c
      .set({ deletedAt: null })
      .where(and(eq(comments.cardId, cardId), eq(comments.deletedAt, card.deletedAt)))

    return { kind: 'restored', card: restored }
  })
}
```

Four decisions in there worth naming.

1. **`.for('update')` on the initial read.** The whole function is a read-modify-write on the server, which is one of the three cases [07f](07f-pessimistic-locking-and-when-it-is-right.md) says a row lock is right for. Without it, two concurrent restores can both pass the clash check.
2. **The explicit clash check.** The partial unique index is still the guarantee; this check exists to turn a `23505` into a response that names the conflicting card. Belt and braces, and the braces are the index.
3. **`eq(comments.deletedAt, card.deletedAt)`** — restore only the children this delete removed, not children that were deleted separately beforehand. That works because the cascade in [08c](08c-cascades-and-referential-integrity.md) stamps them all with the same `now()` inside one transaction. **This is why the soft cascade must set the timestamp rather than a boolean**: the timestamp is the correlation key that makes an undo possible.
4. **The retention window is enforced here, not by the retention job.** A card whose window has expired should refuse to restore even if the purge job has not run yet, otherwise the behaviour depends on cron timing.

## What restore does not do

- **It does not restore a hard-deleted row.** Nothing does. If restore matters, the table cannot be on a hard-delete purge without a window.
- **It does not un-emit events.** The `card.deleted` event went out; the restore emits `card.restored`. Consumers must handle both, and a consumer that only handles the first has permanently removed the card from its copy.
- **It does not fix a stale search index or cache.** Same obligations as the delete, in reverse.
- **It does not resolve the version conflict for a client holding the old card.** Restoring bumps `version`, so an editor open since before the delete gets a 409 on its next save — which is correct, because the row has been through two state changes it never saw.

## Gotchas

**★ Symptom: a user cannot create a card with a name they can see nowhere on the board.** Cause: a deleted row still holds the unique key, because `UNIQUE (board_id, slug)` does not know about `deleted_at`. Fix: replace the constraint with a partial unique index over the live subset:

```sql
CREATE UNIQUE INDEX cards_board_slug_live_key
    ON cards (board_id, slug) WHERE deleted_at IS NULL;
```

**★ Symptom: after switching to a partial unique index, a restore now fails.** Cause: correct behaviour — a live row already claims that key, and restoring would create a duplicate. Fix: this is a 409 that names the conflicting card, so the user can rename one of them. Silently renaming on restore is the wrong fix; it produces a card the user did not ask for.

**★ Symptom: `CREATE INDEX CONCURRENTLY` failed inside a migration with a transaction-block error.** Cause: it cannot run inside `BEGIN`/`COMMIT`, and most migration runners wrap each file in a transaction. Fix: a custom migration outside the transaction. Then check the result before dropping the old constraint:

```sql
SELECT indisvalid FROM pg_index WHERE indexrelid = 'cards_board_slug_live_key'::regclass;
```

**★ Symptom: inserts are rejected for a uniqueness rule that appears nowhere in the schema, and no plan uses the index.** Cause: a failed `CREATE INDEX CONCURRENTLY` on a unique index. The manual is explicit that the invalid index *"will be ignored for querying purposes"* but that *"if a failure does occur in the second scan, the 'invalid' index continues to enforce its uniqueness constraint afterwards"* — so it is invisible to the planner and fully active as a constraint. Fix: find it and remove it, then rebuild:

```sql
SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
 WHERE NOT i.indisvalid AND i.indrelid = 'cards'::regclass;
DROP INDEX cards_board_slug_live_key;
```

**★ Symptom: constraint violations start appearing partway through a concurrent unique-index build, before the index is usable.** Cause: expected — *"the uniqueness constraint is already being enforced against other transactions when the second table scan begins."* Fix: nothing to fix, but do not schedule the build during a period when a transient uniqueness rejection would be costly, and do not interpret the errors as a bug in application code.

**★ Symptom: restoring a card brings back comments that were deleted separately weeks earlier.** Cause: the child restore matched on `deleted_at IS NOT NULL` rather than on the parent's exact deletion timestamp. Fix: correlate on the timestamp the cascade stamped, as `restoreCard` does — which only works if the soft cascade set them all in one transaction with one `now()`.

**★ Symptom: restore works after the retention purge has removed the row, in some environments and not others.** Cause: the window is enforced only by the cron job, so behaviour depends on when it last ran. Fix: enforce the window in the restore path itself, so the answer is deterministic regardless of the purge schedule.

**★ Symptom: two support engineers restore the same card simultaneously and both succeed, producing a duplicate key error on one of them as a 500.** Cause: the clash check is a read-modify-write with no lock, so both passed it. Fix: `.for('update')` on the initial read, so the second waits and then sees the first's result — and keep the partial unique index, which turns any remaining race into a `23505` rather than corrupt data.

**★ Symptom: a schema-diff tool reports the uniqueness constraint as missing after the migration.** Cause: a partial unique index is an index, not a table constraint, so it does not appear in `information_schema.table_constraints`. Fix: nothing is wrong — point the check at `pg_indexes` instead. Worth knowing before someone "fixes" it by re-adding the full constraint, which would reintroduce the original bug.

**★ Symptom: `ON CONFLICT ON CONSTRAINT cards_board_slug_live_key` raises an error.** Cause: that form requires a real constraint name. Fix: infer on the columns and repeat the predicate, which PostgreSQL matches against the index:

```sql
INSERT INTO cards (board_id, slug, title, position)
VALUES ($1, $2, $3, $4)
ON CONFLICT (board_id, slug) WHERE deleted_at IS NULL DO NOTHING;
```

**★ Symptom: an external consumer permanently lost a card that was later restored.** Cause: it handled `card.deleted` and there was no `card.restored` to handle. Fix: emit the restore event, and treat any state change that can be undone as needing a matching event — a consumer's copy is only as correct as the events it was sent.

## Interview questions

**★ Why does a unique constraint break under soft delete?**
Because the constraint sees rows, not your predicate. A deleted card is still a row, so it still occupies its slot in `UNIQUE (board_id, slug)`, and the user is told a name is taken by something they cannot see. The fix is a partial unique index whose predicate matches the live set — PostgreSQL's manual describes this exact technique, enforcing "uniqueness among the rows that satisfy the index predicate, without constraining those that do not".

**★ What is the difference between a partial unique index and a unique constraint, in practice?**
A constraint is a schema object with a name that `ON CONFLICT ON CONSTRAINT` can target and that appears in `information_schema.table_constraints`; a partial unique index is only an index. It enforces uniqueness just as effectively, but constraint-enumerating tooling will not see it, and `ON CONFLICT` must infer on the columns plus the predicate rather than name the constraint. Neither difference is a problem once you know about it; both are surprises if you do not.

**★ Why can restoring a soft-deleted row fail, and what should that return?**
Because between the delete and the restore, someone may have created a live row with the same unique key. Restoring would then produce two live rows the constraint was written to prevent. That is a 409 — a genuine conflict with current state that a human can resolve by renaming one of them — and the response should name the conflicting row, because "conflict" without a subject leaves the user with no next step.

**★ Why is restore a separate endpoint rather than `PATCH {"deletedAt": null}`?**
Because it is a different operation in every way that matters: different authorization, since permission to undelete is not permission to edit; a different failure mode, in the uniqueness clash; a time window that editing has no concept of; and side effects on children, caches and event consumers. Modelling it as a field also means `deleted_at` has to be in the writable set, which is exactly the column you least want a client to be able to write.

**★ How do you restore the children a soft delete cascaded, without restoring children that were deleted earlier for other reasons?**
By correlating on the deletion timestamp. If the application-level cascade sets every affected child's `deleted_at` to the same `now()` inside one transaction, the restore can match `comments.deleted_at = card.deleted_at` and touch exactly the rows that delete removed. This is the concrete reason `deleted_at` is a timestamp and not a boolean — a boolean discards the correlation and makes a precise undo impossible.

**★ What is the risk in the migration from a full constraint to a partial unique index?**
A window with no uniqueness. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, can fail and leave an invalid index that enforces nothing, and the temptation is to drop the old constraint as part of the same change. The safe order is: check the live set for existing duplicates, build the new index concurrently, verify `pg_index.indisvalid`, and only then drop the old constraint. The failure mode is subtler than "no uniqueness", though — the manual notes that a unique index whose build failed in the second scan *continues to enforce its uniqueness constraint* while being ignored for querying, so a botched migration can leave you with an invisible constraint rejecting writes rather than an absent one letting them through.

**★ A card is restored. What else has to happen?**
Everything the delete did, in reverse, and none of it is automatic. The children the application-level cascade soft-deleted have to come back; the cache tag has to be invalidated; the search index has to be reinstated; and a `card.restored` event has to be emitted, because a consumer that only ever saw `card.deleted` has permanently removed it from its own copy. The version bump is a fifth consequence and a desirable one — any editor open since before the delete correctly gets a conflict rather than writing to a row that has been through two state changes it never saw.

---

← [08d · 204, 200, and idempotent delete](08d-status-codes-and-idempotency.md) · [Chapter 16 overview](01-explanation.md) · Next → [09 · Transactions and multi-table writes](09-transactions-and-multi-table-writes.md)
