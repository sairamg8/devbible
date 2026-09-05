---
title: "Hard delete and soft delete are not a fashion choice between an old way and a modern way — they are a requirements question with an answer per table, and picking soft delete because it feels safer is how a system acquires a predicate that every future query must remember"
sidebar_label: "08 · DELETE — hard vs soft"
sidebar_position: 57
description: "What DELETE means in HTTP, what soft delete actually buys — undo, audit, referential survival — what it costs, the four questions that decide it per table, and the shape of the deletedAt column this chapter uses."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against RFC 9110 §9.3.5 (DELETE) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html) — and the PostgreSQL 18 manual — [5.5. Constraints, Foreign Keys](https://www.postgresql.org/docs/18/ddl-constraints.html), [11.8. Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html). Quotes copied from the published sources.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Delete is the verb people implement fastest and regret longest. Hard delete is simple, honest and irreversible; soft delete is reversible and turns every read in the system into a query with a predicate that one developer, one day, will forget. Neither is the right default. What decides it is a small set of requirements — does anyone need to undo this, does anyone need to prove it existed, does anything else point at it, and does the law require its removal — and those requirements are answered per table, not per codebase. This page settles the decision. What soft delete costs on every read forever is [08b](08b-what-soft-delete-costs-every-read.md); what cascades do to rows you did not name is [08c](08c-cascades-and-referential-integrity.md).**

## What DELETE means in HTTP, which is less than people assume

RFC 9110 §9.3.5:

> *"The DELETE method requests that the origin server remove the association between the target resource and its current functionality. In effect, this method is similar to the 'rm' command in UNIX: it expresses a deletion operation on the URI mapping of the origin server rather than an expectation that the previously associated information be deleted."*

Read that twice, because it settles an argument before it starts:

> *"If the target resource has one or more current representations, they might or might not be destroyed by the origin server, and the associated storage might or might not be reclaimed, depending entirely on the nature of the resource and its implementation by the origin server."*

🔴 **HTTP does not require you to erase anything.** A `DELETE` that sets `deleted_at` and returns 204 is a fully conforming implementation of the method. Soft delete is not a deviation from REST that needs defending; it is one of two implementations the specification explicitly anticipates. What the specification *does* require is that the resource stop being there afterwards — a `GET` that still returns the card is the violation, not the surviving row.

## What soft delete actually buys

Three things, and it is worth being precise about which of them you need, because each has a cheaper alternative if it is the only one.

**1 · Undo.** A user deletes the wrong card and wants it back in the next thirty seconds. This is the requirement soft delete serves best and the one people most often actually have. It is also the one with the shortest useful lifetime — nobody undoes a deletion from four months ago.

**2 · Audit and reference survival.** *"Which cards were in this sprint when it closed?"* asked after the cards are gone. A hard delete makes that unanswerable; a soft delete leaves the rows in place with their titles and timestamps intact. The cheaper alternative, if this is the only requirement, is an append-only events or audit table — the deleted row's history is preserved without every live query needing a predicate.

**3 · Referential survival.** A `comments` row points at a card, an `activity` row records who moved it, a `time_entries` row bills against it. Hard-deleting the card forces a decision on each of those — cascade them away, null them out, or block the delete — and every one of those decisions is lossy or annoying. A soft delete leaves every foreign key valid.

**And the honest fourth: soft delete does *not* buy compliance.** If a legal obligation says the data must be erased, a row with `deleted_at` set is still the data. Soft delete makes deletion-on-request harder, not easier, because the erasure now has to be a separate, deliberate operation that finds every soft-deleted copy.

## The four questions that decide it, per table

| Question | If yes | If no |
|---|---|---|
| Will a user want this back within minutes or days? | Soft, with a retention window | Hard |
| Does anything need to prove it existed later? | Soft, **or** an audit table plus hard delete | Hard |
| Do other rows reference it, and would losing them be wrong? | Soft, or `ON DELETE SET NULL` on the pointers | Hard with `CASCADE` |
| Is there a legal or contractual duty to erase it on request? | You need a **real** erase path regardless of the answer above | — |

Applied to SprintDesk:

- **`cards`** — soft. Users delete cards by accident constantly, comments and activity point at them, and a closed sprint's report needs their titles. This is why `deletedAt` is in the shared schema.
- **`board_events`** (the SSE history from ch15 [03fa](../15-databases-apis-and-full-stack-patterns/03fa-designing-a-resumable-sse-stream.md)) — hard, on a retention schedule. Nobody undoes an event; the table is pruned by age.
- **`jobs`** (the queue from ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md)) — hard, after completion. A finished job is not a resource anyone reads.
- **`sessions`** — hard, and promptly. A soft-deleted session is a live credential with a flag on it.

**The pattern in that list: soft delete belongs on the tables users manipulate directly, and hard delete on machine-generated rows.** That is not a rule, but it is a good prior.

## The column, and what makes it a real deletion

```ts
// db/schema.ts — the column this topic owns
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

A nullable timestamp, not a boolean. `deleted_at IS NULL` means live; a value means deleted *and when*, which is what makes a retention policy expressible (`WHERE deleted_at < now() - interval '30 days'`) and what lets an undo endpoint decide whether it is still in the window. A `is_deleted boolean` answers strictly less and costs the same.

Consider adding `deleted_by uuid REFERENCES users(id)` if anyone will ever ask who did it. Adding it later is a migration; the answer for rows deleted before the migration is permanently null.

```ts
// lib/dal/cards.ts — soft delete is an UPDATE with a guard
export async function softDeleteCard(cardId: string, actorId: string) {
  const [row] = await db.update(cards)
    // deletedBy exists only if you added the optional column described above;
    // drop it from this .set() if your schema is the chapter's minimum.
    .set({ deletedAt: sql`now()`, deletedBy: actorId, version: sql`${cards.version} + 1` })
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))   // idempotent guard
    .returning({ id: cards.id })
  return row ?? null     // null = already deleted, or never existed — see 08d
}
```

Two details carry weight. The `isNull(cards.deletedAt)` guard makes a second delete affect zero rows rather than overwriting the original deletion timestamp, which matters because the timestamp is what the retention job reads. And bumping `version` invalidates any editor someone has open on that card, so their next save gets a conflict instead of writing to a deleted row.

## The cost, stated once here and unpacked in [08b](08b-what-soft-delete-costs-every-read.md)

🔴 **Every read in the system now needs `WHERE deleted_at IS NULL`, forever, including the ones nobody has written yet.** Not most reads — every read, every count, every join, every aggregate, every export, every admin screen, every report someone writes in a BI tool that connects straight to the replica. The one that forgets returns deleted rows to a user, and it does not throw, log or alert: it just shows a card someone deleted last Tuesday.

That is the entire argument of the next page, and it is why the decision is per table. Adding `deleted_at` to a table is adding a permanent obligation to every future query against it.

## Gotchas

**★ Symptom: a deleted card reappears in one screen and not others.** Cause: a query somewhere omits `deleted_at IS NULL`. Fix: the predicate belongs in one place, not in every call site — a base query in the Data Access Layer that every read composes from, plus a view for anything outside it. Both shapes are in [08b](08b-what-soft-delete-costs-every-read.md).

**★ Symptom: deleting a card twice moves its deletion date forward, and the retention job never collects it.** Cause: the `UPDATE` had no `deleted_at IS NULL` guard, so a repeated request rewrote the timestamp. Fix: guard the predicate, as `softDeleteCard` does — the second call then affects zero rows and the original timestamp stands.

**★ Symptom: the team adopted soft delete "for safety" and nobody can say what would ever read a deleted row.** Cause: the decision was made by default rather than from a requirement. Fix: name the requirement or drop the column. If the only real need is audit, an append-only audit table plus a hard delete gives you the history without a predicate on every live query.

**★ Symptom: a user asks for their data to be erased and it is still there after the deletion.** Cause: soft delete satisfied the API and not the obligation. Fix: erasure is a separate operation from deletion and needs its own path — a hard `DELETE` that also clears soft-deleted rows, plus whatever the audit table retains. Decide up front whether your audit trail stores personal data, because that is the copy people forget.

**★ Symptom: a soft-deleted session, API token or invite still works.** Cause: the authorization check tests existence and not `deleted_at`. Fix: credentials are the wrong table for soft delete — hard-delete them, so there is nothing to forget a predicate on. If revocation history is required, record the revocation in an audit table rather than the credential row.

**★ Symptom: a deleted card still appears in a search index, an export or a cached page.** Cause: the delete updated the row and nothing else. Fix: a soft delete has the same downstream obligations as a hard one — de-index it, invalidate the cache tag, emit the event. On the SprintDesk stack that means the same `revalidateTag` and `board_events` insert the update path performs, in the same transaction.

**★ Symptom: `deleted_at` is set but the row still counts toward a limit or a quota.** Cause: the counting query was written before soft delete existed. Fix: the predicate again — and it is worth listing every aggregate over the table when you add the column, because aggregates are where a missing predicate is least visible and most consequential.

## Interview questions

**★ Does a soft delete violate the semantics of HTTP DELETE?**
No. RFC 9110 says DELETE "requests that the origin server remove the association between the target resource and its current functionality" and explicitly notes that representations "might or might not be destroyed by the origin server, and the associated storage might or might not be reclaimed". What the specification requires is that the resource stops being available afterwards; how you achieve that is an implementation detail. A soft delete that leaves the card visible on `GET` is the actual violation.

**★ What does soft delete buy that an audit table does not?**
Undo, cheaply, and referential survival. An audit table can reconstruct what a row looked like, but restoring it means re-inserting with a new identity or replaying the history, and every foreign key that pointed at the old row is already broken or cascaded away. Soft delete keeps the row and its identity intact, so undo is a single `UPDATE` and nothing that referenced it ever noticed. If you only need the history and never the undo, the audit table is the cheaper design because it puts no predicate on live queries.

**★ Why is `deleted_at timestamptz` better than `is_deleted boolean`?**
Because it answers strictly more for the same storage. It supports a retention policy (`deleted_at < now() - interval '30 days'`), lets an undo endpoint decide whether the request is still within a permitted window, and gives a support engineer the one fact they always want, which is when it happened. A boolean can be derived from it; it cannot be derived from a boolean.

**★ Is soft delete a GDPR-friendly design?**
It is the opposite. A row with `deleted_at` set is still the data, so an erasure obligation is unmet by exactly the operation that looks like it met it. Soft delete makes real erasure harder, because the erase path now has to find and remove soft-deleted rows as well as live ones, plus whatever your audit trail retained. If a table holds personal data, plan the erase path at the same time as the delete path — they are different operations with different authorization.

**★ Which tables in a typical application should be hard delete?**
Anything machine-generated with no user-facing identity — event logs, completed jobs, cache rows, materialised aggregates — because nobody undoes them and nothing points at them by name. And anything that is a credential: sessions, tokens, invites, password reset links. A soft-deleted credential is a live credential with a flag on it, and the flag is one missing predicate away from being ignored.

**★ How do you decide, for a table you have never seen?**
Ask the four questions in order: will a user want it back soon, does anything need to prove it existed, do other rows reference it, and is there a duty to erase. The first three push toward soft; the fourth is orthogonal and means you need a real erase path either way. If none of the first three is a yes, hard delete — because the default choice is the one that adds no permanent obligation to every future query.

---

← [07g · position and updatedAt](07g-position-collisions-and-updatedat.md) · [Chapter 16 overview](01-explanation.md) · Next → [08b · What soft delete costs every read](08b-what-soft-delete-costs-every-read.md)
