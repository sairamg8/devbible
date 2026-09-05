---
title: "ON DELETE CASCADE is a delete you wrote once and will execute for the rest of the system's life, in a graph you did not draw — and the reason it is dangerous is that it makes a small correct statement do an unbounded amount of work you never see"
sidebar_label: "08c · Cascades and integrity"
sidebar_position: 59
description: "NO ACTION, RESTRICT, CASCADE, SET NULL and SET DEFAULT with the manual's own guidance on choosing, transitive cascades, why a soft delete cascades nothing, what a hard delete does to an audit trail, and how to draw the graph before you rely on it."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [5.5. Constraints §5.5.5 Foreign Keys](https://www.postgresql.org/docs/18/ddl-constraints.html), [`CREATE TABLE`](https://www.postgresql.org/docs/18/sql-createtable.html), [13.3. Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html), [53.13. `pg_constraint`](https://www.postgresql.org/docs/18/catalog-pg-constraint.html), [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html). Every referential-action rule and the `confdeltype` letters are quoted verbatim.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**The chapter's schema says `references(() => boards.id, { onDelete: 'cascade' })` on `cards.boardId`, and that single option is a policy: deleting a board destroys every card on it, without a confirmation, without an audit entry unless you wrote one, and without appearing anywhere in the code that issued the delete. That is often exactly right. What makes it dangerous is that cascades compose — a delete at the root of a graph you never drew can remove rows in tables you have not thought about in a year — and that the cascade is invisible at the call site, so nobody reviewing the delete endpoint sees the blast radius. This page states the five actions precisely, gives the manual's own rule for choosing between them, and shows how to find out what your own graph does.**

## The five actions, quoted

PostgreSQL's `ON DELETE` takes five values. The manual defines each:

**`NO ACTION` — the default, and it is not "do nothing":**

> *"The default `ON DELETE` action is `ON DELETE NO ACTION`; this does not need to be specified. This means that the deletion in the referenced table is allowed to proceed. But the foreign-key constraint is still required to be satisfied, so this operation will usually result in an error. But checking of foreign-key constraints can also be deferred to later in the transaction … In that case, the `NO ACTION` setting would allow other commands to 'fix' the situation before the constraint is checked."*

**`RESTRICT` — stricter, and the difference is deferrability:**

> *"`RESTRICT` is a stricter setting than `NO ACTION`. It prevents deletion of a referenced row. `RESTRICT` does not allow the check to be deferred until later in the transaction."*

**`CASCADE`:**

> *"`CASCADE` specifies that when a referenced row is deleted, row(s) referencing it should be automatically deleted as well."*

**`SET NULL` and `SET DEFAULT`:**

> *"There are two other options: `SET NULL` and `SET DEFAULT`. These cause the referencing column(s) in the referencing row(s) to be set to nulls or their default values, respectively, when the referenced row is deleted. Note that these do not excuse you from observing any constraints. For example, if an action specifies `SET DEFAULT` but the default value would not satisfy the foreign key constraint, the operation will fail."*
> — all from [PostgreSQL 18 · 5.5.5](https://www.postgresql.org/docs/18/ddl-constraints.html)

⚠️ **`NO ACTION` versus `RESTRICT` is the distinction nobody remembers, and it is only observable inside a transaction.** With `NO ACTION` and a `DEFERRABLE INITIALLY DEFERRED` constraint, you can delete a parent and then fix the children before commit. `RESTRICT` refuses immediately and cannot be deferred. For a plain non-deferred constraint they behave identically, which is why the difference is usually invisible until the one migration where it matters.

## The manual's rule for choosing, which is better than most advice

> *"The appropriate choice of `ON DELETE` action depends on what kinds of objects the related tables represent. When the referencing table represents something that is a component of what is represented by the referenced table and cannot exist independently, then `CASCADE` could be appropriate. If the two tables represent independent objects, then `RESTRICT` or `NO ACTION` is more appropriate; an application that actually wants to delete both objects would then have to be explicit about this and run two delete commands. … The actions `SET NULL` or `SET DEFAULT` can be appropriate if a foreign-key relationship represents optional information."*
> — [PostgreSQL 18 · 5.5.5](https://www.postgresql.org/docs/18/ddl-constraints.html)

Three tests, in the manual's own terms, applied to SprintDesk:

| Relationship | Is the child *a component that cannot exist independently*? | Action | Why |
|---|---|---|---|
| `cards.board_id → boards.id` | Yes — a card without a board is meaningless | **`CASCADE`** | The chapter's schema |
| `comments.card_id → cards.id` | Yes | **`CASCADE`** | A comment on nothing is nothing |
| `time_entries.card_id → cards.id` | **No** — billable time is an independent fact about someone's day | **`RESTRICT`** | Losing a billing record because someone tidied a board is not recoverable |
| `cards.assignee_id → users.id` | No — optional information | **`SET NULL`** | A departing user should not delete their work |
| `audit_log.card_id → cards.id` | No — the log is the record | **no FK at all**, or `SET NULL` | See below |

**The line to hold: `CASCADE` for containment, `RESTRICT` for independent facts, `SET NULL` for optional links.** "It is annoying to delete children manually" is not one of the three tests.

## 🔴 Cascades compose, and nobody draws the graph

`ON DELETE CASCADE` is transitive. Deleting a team cascades to boards, boards cascade to cards, cards cascade to comments, attachments, checklists and reactions. One `DELETE FROM teams WHERE id = $1` can remove rows in a dozen tables, and the statement that did it mentions one.

Two consequences that show up in production:

1. **Duration.** The cascade is executed inside your transaction, so a delete that looks like one row can hold locks and a pooled connection for as long as the whole subtree takes — [09f](09f-transaction-duration-as-pool-occupancy.md)'s cost, arriving from a direction nobody expects.
2. **Missing indexes.** PostgreSQL does not create one for you, and the manual says why:

   > *"Since a `DELETE` of a row from the referenced table or an `UPDATE` of a referenced column will require a scan of the referencing table for rows matching the old value, it is often a good idea to index the referencing columns too. Because this is not always needed, and there are many choices available on how to index, the declaration of a foreign key constraint does not automatically create an index on the referencing columns."*
   > — [PostgreSQL 18 · 5.5.5](https://www.postgresql.org/docs/18/ddl-constraints.html)

```sql
-- Every referencing column of an FK you might cascade or restrict on wants an index.
CREATE INDEX comments_card_id_idx ON comments (card_id);
```

**Find out what your own graph does before you rely on it.** This query walks the constraints and tells you, for one table, what is pointing at it and with what action:

```sql
SELECT c.conname,
       src.relname   AS referencing_table,
       tgt.relname   AS referenced_table,
       c.confdeltype AS on_delete   -- a=no action, r=restrict, c=cascade, n=set null, d=set default
  FROM pg_constraint c
  JOIN pg_class src ON src.oid = c.conrelid
  JOIN pg_class tgt ON tgt.oid = c.confrelid
 WHERE c.contype = 'f'
   AND tgt.relname = 'cards'
 ORDER BY src.relname;
```

The `confdeltype` letters are the catalogue's own, quoted:

> *"`confdeltype` `char` — Foreign key deletion action code: `a` = no action, `r` = restrict, `c` = cascade, `n` = set null, `d` = set default"*
> — [PostgreSQL 18 · 53.13. `pg_constraint`](https://www.postgresql.org/docs/18/catalog-pg-constraint.html)

⚠️ The query is written from the catalogue definition; it was **not executed** in this session, so treat its output shape as unverified even though the column semantics are quoted.

## Soft delete cascades nothing, and that is a bug waiting

🔴 **A soft delete is an `UPDATE`. Foreign keys do not fire.** Setting `cards.deleted_at` does not touch `comments`, so every comment on that card is still live, still returned by any query that does not join through the card, and still counted by any aggregate over `comments`.

You now own the cascade in application code, which means it must be in one transaction with the delete:

```ts
// lib/dal/cards.ts — the soft cascade, written out because nothing does it for you
export async function softDeleteCardWithChildren(cardId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [card] = await tx.update(cards)
      .set({ deletedAt: sql`now()`, version: sql`${cards.version} + 1` })
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
      .returning({ id: cards.id, boardId: cards.boardId })
    if (!card) return null                      // already gone — idempotent, see 08d

    await tx.update(comments)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(comments.cardId, cardId), isNull(comments.deletedAt)))

    await tx.insert(boardEvents).values({
      boardId: card.boardId, kind: 'card.deleted', cardId, actorId,
    })
    return card
  })
}
```

**Or — usually better — do not soft-delete the children at all.** If every read of `comments` goes through its card, hiding the card hides the comments, and the child table needs no `deleted_at` of its own. That works exactly as long as nothing queries `comments` without joining `cards`, which is a promise you should write down rather than assume. Decide this per child table, and prefer the version with fewer predicates.

## A hard delete and the audit trail

Two shapes, and the choice is about what you want to be true when the parent is gone.

**A foreign key from the audit table** means the audit row must be cascaded, nulled or blocked when the card is deleted — and all three are wrong for an audit trail. Cascading destroys the record of the deletion at the moment it happens; `SET NULL` leaves an entry that cannot say what it was about; `RESTRICT` makes the card undeletable.

**No foreign key** means the audit table stores the card id as a plain `uuid` and denormalises whatever it needs to stay readable — the title at the time, the board, the actor. The row survives the card, and a join that finds nothing is expected rather than broken.

```sql
CREATE TABLE card_audit (
  id           bigserial PRIMARY KEY,
  card_id      uuid        NOT NULL,          -- deliberately NOT a foreign key
  board_id     uuid        NOT NULL,
  actor_id     uuid,
  action       text        NOT NULL,          -- 'created' | 'updated' | 'deleted'
  title_at_time text,                         -- denormalised so the row reads alone
  from_version integer,
  to_version   integer,
  at           timestamptz NOT NULL DEFAULT now()
);
```

**The trade you are making is explicit:** you give up the database's guarantee that `card_id` points at something real, and you get a record that outlives the thing it records. For an audit table that is the right trade. For anything else it usually is not — an unconstrained id column elsewhere in the schema is how orphans accumulate.

`from_version` and `to_version` are there for the reason [07c](07c-the-lost-update.md) gives: an audit row whose `from_version` is not the previous row's `to_version` is a detected overwrite, which turns "did we lose an update?" from an argument into a query.

## Gotchas

**★ Symptom: deleting one board removes rows in tables nobody mentioned in the code review.** Cause: transitive `ON DELETE CASCADE` through a graph nobody has drawn. Fix: enumerate the graph before shipping the endpoint — the `pg_constraint` query above lists every referencing table and its action — and change the ones that are independent facts to `RESTRICT`.

**★ Symptom: a `DELETE` of a single row takes a long time and blocks other writers.** Cause: the cascade is scanning child tables that have no index on the referencing column, and it all happens inside your transaction. Fix: index every FK column you might cascade or restrict on:

```sql
CREATE INDEX comments_card_id_idx ON comments (card_id);
CREATE INDEX time_entries_card_id_idx ON time_entries (card_id);
```

**★ Symptom: billable time entries disappeared when someone deleted an old board.** Cause: `CASCADE` on a relationship where the child is an independent fact, not a component. Fix: `RESTRICT`, so the delete fails and a human decides:

```sql
ALTER TABLE time_entries
  DROP CONSTRAINT time_entries_card_id_fkey,
  ADD  CONSTRAINT time_entries_card_id_fkey
       FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE RESTRICT;
```

**★ Symptom: a card is soft-deleted and its comments are still visible in a "recent activity" feed.** Cause: a soft delete is an `UPDATE`, so no foreign key fired and the children were untouched. Fix: either cascade in application code inside the same transaction, as `softDeleteCardWithChildren` does, or guarantee that every read of the child joins its parent — and write that guarantee down, because it is the thing a future query will break.

**★ Symptom: a `DELETE` fails with a foreign-key error the code has no branch for.** Cause: a `RESTRICT` or `NO ACTION` constraint doing its job. Fix: this is a 409, not a 500 — the request conflicts with the current state of the resource, and the response should name what is blocking it. The code is SQLSTATE `23503`, listed in the manual's error-code appendix as `foreign_key_violation` under *"Class 23 — Integrity Constraint Violation"*; mapping it to a status belongs to [10 · errors and one response shape](10-errors-and-one-response-shape.md), and the point here is only that the branch must exist.

**★ Symptom: `SET DEFAULT` on a foreign key fails at delete time.** Cause: the column's default does not itself satisfy the constraint — the manual warns *"if an action specifies `SET DEFAULT` but the default value would not satisfy the foreign key constraint, the operation will fail"*. Fix: either make the default a row that genuinely exists (an "unassigned" sentinel you insert in a migration) or use `SET NULL` and make the column nullable.

**★ Symptom: two delete endpoints deadlock against each other.** Cause: cascades acquire locks on child rows in whatever order the planner produces, and two deletes touching overlapping subtrees can take them in opposite orders. Fix: the manual's rule — *"be certain that all applications using a database acquire locks on multiple objects in a consistent order"* — plus keeping delete transactions short. If deletes are large and frequent, delete children explicitly in a fixed table order rather than relying on the cascade.

**★ Symptom: the audit table lost the record of a deletion at the moment of the deletion.** Cause: the audit row had a cascading foreign key to the thing it was auditing. Fix: no foreign key on the audit table, plus enough denormalised columns that the row reads on its own — the `card_audit` shape above.

**★ Symptom: after a hard delete, a report joins to a missing row and shows blanks.** Cause: something kept the id without a constraint and now points at nothing. Fix: decide per column whether an orphan is acceptable. If it is not, it needs a foreign key with an action you have chosen; if it is (an audit table), the reading code must expect the join to fail and render the denormalised copy instead.

**★ Symptom: a "delete everything for this tenant" job runs for hours and holds a connection the whole time.** Cause: one enormous cascading delete in one transaction. Fix: delete in bounded batches, each its own transaction, ordered from the leaves inward so no batch depends on a cascade:

```sql
DELETE FROM cards
 WHERE id IN (SELECT id FROM cards WHERE board_id = $1 LIMIT 1000);
```

## Interview questions

**★ What is the difference between `NO ACTION` and `RESTRICT`?**
`RESTRICT` refuses the delete immediately and its check cannot be deferred. `NO ACTION` — the default — also requires the constraint to hold, but the check can be deferred to the end of the transaction if the constraint is declared deferrable, which lets you delete a parent and repair the children before commit. With a plain non-deferred constraint the two behave the same, which is why the distinction is usually discovered during a migration that needed the deferral.

**★ How do you decide between `CASCADE` and `RESTRICT`?**
The manual's own test is the best one: ask whether the referencing row is a component of the referenced row that cannot exist independently. A comment on a card is; a billable time entry that happens to be attached to a card is not — it is a fact about someone's working day. Components cascade; independent objects restrict, and an application that genuinely wants to delete both has to say so with two statements. "It is inconvenient to delete children first" is not a reason, because that inconvenience is the confirmation step.

**★ Why is a cascade dangerous even when each individual constraint is correct?**
Because cascades compose and nobody has drawn the whole graph. Each `ON DELETE CASCADE` is a locally reasonable decision, and the composition of a dozen of them means one `DELETE` at the root of the tree removes rows in tables the calling code does not mention. The blast radius is invisible at the call site, it is executed inside your transaction so it holds locks and a pooled connection for its full duration, and it is unindexed by default because PostgreSQL does not index the referencing side of a foreign key for you.

**★ Your table uses soft delete. What happens to its children?**
Nothing, which is the trap. A soft delete is an `UPDATE`, so no referential action fires and every child row is still live. You have inherited the cascade as an application responsibility, and it has to run in the same transaction as the parent's update or the two can disagree. The alternative — and usually the better one — is to not soft-delete children at all and rely on every read of the child joining its parent, which is a promise worth writing down because it is exactly what a future query will violate.

**★ Should an audit table have a foreign key to the thing it audits?**
No. All three referential actions are wrong for it: cascading destroys the record of the deletion at the moment of the deletion, `SET NULL` leaves an entry that cannot say what it was about, and `RESTRICT` makes the audited row undeletable. Store the id as a plain column, denormalise enough context that the audit row reads on its own, and accept explicitly that you have given up the database's guarantee about that column — which is the right trade here and almost nowhere else.

**★ You need to hard-delete a large subtree. Why not just issue one `DELETE` and let the cascade work?**
Because it is one transaction whose duration is proportional to the size of the subtree, holding row locks and one pooled connection throughout, with a cascade that may be scanning unindexed child tables. It also cannot be resumed if it fails halfway. Batching from the leaves inward, each batch its own short transaction, turns an unbounded operation into a series of bounded ones and lets the job be stopped and restarted.

**★ A DELETE returns a foreign-key violation. What status code and why?**
409 Conflict — the request conflicts with the current state of the target resource, and a user could plausibly resolve it by removing the referencing rows first. It is not a 500, because nothing is broken, and it is not a 400, because the request itself was well-formed. The response should name what is blocking the delete, since "conflict" without a subject leaves the client with nothing to act on.

---

← [08b · What soft delete costs every read](08b-what-soft-delete-costs-every-read.md) · [Chapter 16 overview](01-explanation.md) · Next → [08d · Status codes and idempotency](08d-status-codes-and-idempotency.md)
