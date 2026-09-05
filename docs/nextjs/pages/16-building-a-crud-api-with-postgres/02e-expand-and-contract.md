---
title: "During every deploy there are two versions of your code running against one database, so the only migrations that are safe are the ones both versions can live with — which makes renaming a column two deploys, dropping one the last step rather than the first, and rolling back a thing you have to earn days in advance"
sidebar_label: "02e · Expand and contract"
sidebar_position: 17
description: "The overlap window that makes additive-only a hard rule, the four phases worked through for a rename, a NOT NULL, a drop, an enum value and a type change, why a backfill is batched and idempotent, and the API-side version of exactly the same discipline."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html), [`ALTER TYPE`](https://www.postgresql.org/docs/18/sql-altertype.html), [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html), [release notes](https://www.postgresql.org/docs/18/release-18.html) — and [Drizzle Kit · overview](https://orm.drizzle.team/docs/kit-overview).
> Target: **PostgreSQL 18.4** · `drizzle-kit` **0.31.10** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**A deploy is not an instant. For some window — seconds on a rolling deploy of a Node server, potentially minutes on a serverless platform with warm instances still serving — old code and new code are both running, both connected to the same database, both writing. Every migration therefore has two consumers, not one, and the safe set is exactly the migrations *both* of them can live with. That single constraint generates the entire expand/contract discipline: additive first, destructive last, and never in the same release. It is also the only thing that makes "roll it back" a real option, because a rollback is just the overlap window running in the other direction.**

## The overlap window

```text
t0   old code            ──────────────────►
t1   migration runs                │
t2   new code starts              ─┴──────────────────►
t3   old instances drain    ───────────────┘
                            ▲                ▲
                            └── both versions writing ──┘
```

Between t1 and t3 the database must satisfy two schemas' worth of expectations simultaneously. And there is a fourth line nobody draws:

```text
t4   the deploy is bad, old code comes back  ◄────────
```

If the migration at t1 was destructive, t4 is not available. **A rollback is not a database operation; it is a property you either built into the migration days earlier or did not.**

## The four phases

| Phase | What it does | Deployed with |
|---|---|---|
| **Expand** | Add the new thing. Nullable, defaulted, unconstrained. Nothing reads it. | A release of its own, or the one before the writer |
| **Dual-write** | New code writes both old and new. Old code still writes only old. | The release that introduces the new field |
| **Backfill** | Populate the new thing for existing rows, in batches, idempotently. | An operational step, not a migration |
| **Contract** | Stop writing the old thing, then drop it. | A release well after every reader is gone |

The rule that makes it work is: **every phase boundary is a deploy boundary, and no two phases ship together.** Compressing phases is how people end up with a rename in one release that works in staging, where the old instances drained before anyone tested.

## Worked: renaming `body` to `description`

The tempting migration is one line, and it is the one migration that cannot be made safe:

```sql
-- 🔴 Never on a live table. Old instances still SELECT body and INSERT body.
ALTER TABLE cards RENAME COLUMN body TO description;
```

`RENAME COLUMN` is instant and cheap, which is exactly what makes it seductive. It is also atomic in the wrong sense: the instant it commits, every running instance of the previous release starts failing with `42703 undefined_column` on every read and every write of that field. There is no partial state and no grace period.

The safe version is five steps across at least three deploys.

**Step 1 — expand. Its own release.**

```sql
-- migrations/0009_add_description.sql
SET lock_timeout = '3s';

-- Nullable, no default, no constraint. Nothing reads it yet.
ALTER TABLE cards ADD COLUMN description text;
```

Non-volatile (in fact absent) default, so no rewrite — *"In neither case is a rewrite of the table required."* Old code does not know the column exists, which is fine, because nothing requires it.

**Step 2 — dual-write. The next release.**

```ts
// lib/dal/cards.ts — during the overlap only. Delete this in step 5.
export async function updateCardBody(cardId: string, text: string | null) {
  const value = text?.trim() ? text.trim() : null
  await db.update(cards)
    .set({ body: value, description: value, updatedAt: new Date() })
    .where(eq(cards.id, cardId))
}
```

New code writes both. Old code writes only `body`, and that is acceptable because `description` is still nullable and nothing reads it yet.

**Step 3 — backfill. An operational step, batched and re-runnable.**

```sql
-- ops/2026-09-08-backfill-description.sql
-- Run repeatedly until it reports 0 rows. Each run is one short transaction.
UPDATE cards
   SET description = body
 WHERE id IN (
   SELECT id FROM cards
    WHERE description IS NULL AND body IS NOT NULL
    ORDER BY id
    LIMIT 5000
 );
```

Three properties, all deliberate. **Bounded**, so no single statement holds row locks over the whole table. **Idempotent**, because the `WHERE` clause excludes rows already done, so a crashed run is resumed by running it again. **Ordered**, so successive batches make monotonic progress rather than re-visiting the same rows. A backfill written as one unbounded `UPDATE` is a long transaction, and a long transaction is exactly what makes the next migration wait for a lock ([02d](02d-the-lock-a-migration-actually-takes.md)).

**Step 4 — switch readers. The next release.** New code reads `description` and still writes both. Now `body` is written and never read.

**Step 5 — contract. A later release, once no instance of step 2's code can still exist.**

```ts
// The dual write goes away first, in its own deploy.
await db.update(cards).set({ description: value, updatedAt: new Date() }).where(eq(cards.id, cardId))
```

```sql
-- migrations/0014_drop_body.sql — days later, deliberately.
SET lock_timeout = '3s';
ALTER TABLE cards DROP COLUMN body;
```

`DROP COLUMN` does not rewrite and does not scan; it is a catalogue change plus a brief `ACCESS EXCLUSIVE`. The cost of dropping a column is never the statement — it is that it is irreversible without a restore, which is why it is last.

⚠️ **The API-side rename is the identical five steps**, applied to a different set of consumers. [01c](01c-what-the-client-may-rely-on.md) lists it: add the new field, populate both, migrate the callers, remove the old one. The difference is that you deploy your instances and you do not deploy your clients, so the "wait until nobody uses it" phase is measured in quarters rather than hours.

## Worked: making a nullable column `NOT NULL`

Assume `description` should now be required.

**Step 1 — stop creating nulls.** A release where every write path supplies a value. This is code, not schema, and it must be fully deployed before anything else happens.

**Step 2 — backfill the existing nulls**, batched, as above.

**Step 3 — add the constraint without the scan.** PostgreSQL 18 lets you do this directly on a `NOT NULL`:

> *"Allow `ALTER TABLE` to set the `NOT VALID` attribute of `NOT NULL` constraints"*
> — [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)

```sql
-- 0015: enforce for new rows immediately; do not scan the backlog.
SET lock_timeout = '3s';
ALTER TABLE cards
  ADD CONSTRAINT cards_description_nn CHECK (description IS NOT NULL) NOT VALID;
```

**Step 4 — validate, under the weaker lock.**

```sql
-- 0016: acquires only SHARE UPDATE EXCLUSIVE.
SET lock_timeout = '3s';
SET statement_timeout = 0;
ALTER TABLE cards VALIDATE CONSTRAINT cards_description_nn;
```

The ordering matters and is not arbitrary: **stop the bleeding, clean the backlog, then declare it clean.** Doing step 3 before step 1 means new nulls keep arriving and validation can never succeed.

## Worked: adding an enum value

`status` gains `'blocked'`. Three separate hazards, one of which is not obvious.

```sql
-- 0017: additive, and re-runnable.
ALTER TYPE card_status ADD VALUE IF NOT EXISTS 'blocked' AFTER 'doing';
```

> *"If `IF NOT EXISTS` is specified, it is not an error if the type already contains the new value: a notice is issued but no other action is taken. Otherwise, an error will occur if the new value is already present."*

**Hazard one — the transaction rule.**

> *"If `ALTER TYPE ... ADD VALUE` (the form that adds a new value to an enum type) is executed inside a transaction block, the new value cannot be used until after the transaction has been committed."*
> — [PostgreSQL 18 · `ALTER TYPE`](https://www.postgresql.org/docs/18/sql-altertype.html)

So a migration that adds the value **and** uses it — an `UPDATE … SET status = 'blocked'` in the same file — fails if the runner wraps the file in a transaction. The two operations belong in two migrations.

**Hazard two — ordering has a cost.**

> *"Comparisons involving an added enum value will sometimes be slower than comparisons involving only original members of the enum type. This will usually only occur if `BEFORE` or `AFTER` is used to set the new value's sort position somewhere other than at the end of the list… The slowdown is usually insignificant; but if it matters, optimal performance can be regained by dropping and recreating the enum type, or by dumping and restoring the database."*

`AFTER 'doing'` is the semantically right position for a workflow status and it is the form the documentation names as the slower one. That is a trade worth making knowingly rather than discovering.

**Hazard three — the one people miss.** Old code is still running and its `switch (status)` has three cases. Adding the value is safe; **writing** it is not, until every reader can handle it. So the sequence is: add the value in one release, and only start producing it in a later one. This is the schema-side twin of the promise [01c](01c-what-the-client-may-rely-on.md) makes to API clients about the enum being growable — and the reason that promise had to be written down before the fourth value existed.

⚠️ **Removing an enum value is effectively not supported.** There is no `DROP VALUE`. The route is to create a new type, migrate the column, and drop the old type — a full column type change, which is the next section. Plan enums as append-only.

## Worked: changing a column's type

The general form, for a change Postgres cannot do in place without a rewrite, is the same five steps as a rename with one addition — a trigger keeps the two in sync so the backfill can converge while writes continue:

```sql
-- 0018 expand
ALTER TABLE cards ADD COLUMN position_num numeric(20,10);
```

```sql
-- 0019 keep them in sync during the overlap, so the backfill terminates
CREATE OR REPLACE FUNCTION cards_sync_position() RETURNS trigger AS $$
BEGIN
  NEW.position_num = NEW.position::numeric;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_sync_position_trg
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION cards_sync_position();
```

Then batch-backfill, switch readers, drop the trigger, drop the old column, rename the new one — and note that the final rename is itself a rename, so it needs its own expand/contract unless you are willing to take a moment of downtime. In practice most teams stop before that last step and live with `position_num` as the name, which is an ugly name and a correct decision.

🔴 **The trigger is the part people skip, and it is what makes the backfill terminate.** Without it, rows written during the backfill have a null `position_num`, so the "remaining" set never empties and you chase your own tail.

## What this buys, stated as the property

**Every release is independently reversible.** Deploy the new code, discover it is wrong, deploy the old code — and the database is fine, because at no point did a migration remove something the old code needed. That property is the entire return on the extra deploys, and it is worth more than it looks, because the alternative is that a bad release can only be fixed by rolling forward under pressure with an untested hotfix.

The corollary is the honest cost: **a rename is three to five deploys and about a week of calendar time.** That is not overhead you can optimise away; it is the price of the reversibility. What you *can* do is notice earlier that the name is wrong.

## Gotchas

**★ Symptom: a deploy is green and the previous version's instances are throwing `undefined_column` until they drain.** Cause: a `RENAME COLUMN` or a `DROP COLUMN` shipped in the same release as the code that stopped using it. Fix: expand and contract in separate releases, with the drop last. There is no version of a rename that is safe in one step, because the rename is atomic and the deploy is not.

**★ Symptom: the backfill has been running for forty minutes and the next migration is stuck.** Cause: the backfill is one unbounded `UPDATE`, so it is one enormous transaction holding row locks and preventing the DDL from acquiring `ACCESS EXCLUSIVE`. Fix: batch it — `LIMIT 5000` per statement, ordered, with the completed rows excluded by the `WHERE` clause so it is re-runnable.

**★ Symptom: the backfill never finishes; the "remaining" count stops going down.** Cause: writes arriving during the backfill create new rows that also need backfilling, and nothing populates the new column on write. Fix: dual-write from the application before the backfill starts, or a `BEFORE INSERT OR UPDATE` trigger, so the only rows left to fix are the ones that existed when you started.

**★ Symptom: a migration adds an enum value and then uses it, and fails.** Cause: *"If `ALTER TYPE ... ADD VALUE`… is executed inside a transaction block, the new value cannot be used until after the transaction has been committed"*, and migration runners wrap files in a transaction. Fix: two migrations — add the value in one, use it in the next.

**★ Symptom: a fourth `status` value was added and a partner's integration started throwing.** Cause: the value was added to the type and immediately written, while consumers still had exhaustive three-case switches. Fix: add the value in one release and start producing it in a later one, and make sure the contract said the enum could grow before it did — see [01c](01c-what-the-client-may-rely-on.md).

**★ Symptom: someone wants to remove an unused enum value to tidy up.** Cause: reasonable instinct, unsupported operation. There is no `DROP VALUE`; the only route is a new type and a full column migration. Fix: leave it. An unused enum member costs nothing; the migration to remove it costs a week.

**★ Symptom: a bad release cannot be rolled back because the migration dropped a column.** Cause: the destructive step shipped with the feature. Fix: this is not recoverable at rollback time — it is decided when the migration is written. The rule that prevents it is that a release may contain expand *or* contract, never both, and contract only for things nothing has read for a full deploy cycle.

**★ Symptom: expand/contract was followed and the rollback still failed, because the new code had written values the old code cannot parse.** Cause: the schema was compatible and the *data* was not — the new release started writing `'blocked'` into a column the old code switches on. Fix: expand/contract applies to values as well as to columns. A new enum member, a new discriminator, a new JSON shape: add the capacity in one release, deploy readers that tolerate it, and only then start producing it.

**★ Symptom: the type change finished and everyone still has to write `position_num`.** Cause: the final rename back to the original name is itself a rename, and therefore its own three-deploy cycle. Fix: either accept the name, or plan the rename as a separate future exercise. What you must not do is take the "quick" rename at the end and undo the safety of everything before it.

**★ Symptom: a `CHECK` added `NOT VALID` was never validated, and a year later nobody knows whether the data is clean.** Cause: the second migration was treated as optional because everything worked without it. Fix: make the validation a tracked follow-up with the same weight as the first migration. `NOT VALID` is a two-step operation, and stopping after step one leaves a constraint that protects the future and says nothing about the past — which is a legitimate state to be *in* and not a legitimate state to *forget*.

## Interview questions

**★ Why is renaming a column two deploys rather than one?**
Because a deploy is a window, not an instant, and during that window old and new code are both connected to the same database. `RENAME COLUMN` is atomic: the moment it commits, every running instance of the previous release begins failing on every read and write of that field, and there is no partial state to soften it. So the rename has to be decomposed into operations both versions tolerate — add the new column, write both, backfill, switch readers, and drop the old one only once no instance that touches it can still exist. That is at minimum three deploys and in practice five steps, and the thing you buy is that every one of them is individually reversible.

**★ What makes a backfill safe?**
Three properties. It is **bounded**, so each statement is a short transaction that does not hold locks across the whole table and does not block the next migration. It is **idempotent**, so a run that is killed halfway is resumed simply by running it again — which means the `WHERE` clause must exclude rows already done rather than relying on an external cursor. And it **converges**, which requires that new writes arriving during the backfill already populate the new column, via a dual write in the application or a trigger in the database. Miss the third and the remaining count never reaches zero, because you are racing production traffic.

**★ Why is dropping a column the last step and not the first?**
Because it is the only irreversible one. Adding a column can be undone by dropping it; a backfill can be re-run; switching readers can be reverted with a deploy. Dropping a column destroys data, and getting it back means a restore. So it belongs at the point of maximum confidence: after the new path has been in production long enough that you would already know if it were wrong, and after every instance and every cached deployment that referenced the old column is gone. The cost of waiting is a column nobody uses, which is nothing; the cost of not waiting is a restore.

**★ What is the relationship between expand/contract and rollback?**
They are the same thing seen from two directions. Expand/contract exists to keep the database compatible with the *previous* version of the code, and "compatible with the previous version" is precisely the definition of being able to roll back. So a team that follows the discipline gets rollback for free and never has to think about it, and a team that does not has no rollback at all — regardless of how good their deployment tooling is, because the constraint is in the schema rather than in the pipeline. This is also why "can we roll back?" is a question you answer when writing the migration, not when the alert fires.

**★ Is `ADD COLUMN … DEFAULT` safe, and does the answer depend on anything?**
It depends on exactly one thing: whether the default expression is volatile. A non-volatile default is stored in the table's metadata and returned when existing rows are read, so *"In neither case is a rewrite of the table required"* and the statement is fast on any size of table. A volatile one — `clock_timestamp()` is the documentation's own example — rewrites the entire table and its indexes under `ACCESS EXCLUSIVE`. The two look nearly identical in a migration diff, which is the whole trap. The same list includes stored generated columns and identity columns as rewriting, and PostgreSQL 18's *virtual* generated columns as never rewriting, which is a genuinely useful new escape.

**★ Why does adding an enum value need its own release before anything writes it?**
Because the schema change and the data change have different blast radii. Adding the value is invisible to old code — nothing reads the type's member list — so it is purely additive. Writing the value is not: old instances, old mobile clients and old partner integrations all have code that enumerates three possibilities, and a fourth arriving mid-deploy is a runtime failure in someone else's process. So the value is added in one release and produced in a later one, which gives every consumer a window to become tolerant. It is the same principle as a column drop, mirrored — you add capacity before you use it, and you remove usage before you remove capacity.

**★ When is it acceptable to take the unsafe, one-step migration?**
When there is genuinely no overlap window and you have proven it: a maintenance window with all instances stopped, or a table that no deployed code touches yet because the feature is behind a flag that has never been on. Both are real and both are rarer than people assume — a serverless platform can keep a warm instance of the previous deployment alive longer than you expect, and "no code touches it" has to include the queue consumer, the cron job and the analytics export. The honest version of the shortcut is to state which of those two conditions holds and how you verified it. "It is a small table" is not one of the conditions; size affects duration, and the problem is compatibility.

---

← [02d · The lock it takes](02d-the-lock-a-migration-actually-takes.md) · Next → [03 · The connection you actually get](03-the-connection-you-actually-get.md)
