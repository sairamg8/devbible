---
title: "The lost update is the only bug in this chapter with no witness — two clients read the same row, both write, the second overwrites the first, every response is 200, and the only person who ever finds out is the user whose edit vanished"
sidebar_label: "07c · The lost update"
sidebar_position: 36
description: "The interleaving drawn out in full, why Read Committed permits it and is not at fault, why a single-statement update is not automatically safe, why no test and no log line catches it, and the three families of fix."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.2. Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [13.4. Data Consistency Checks at the Application Level](https://www.postgresql.org/docs/18/applevel-consistency.html) — and RFC 9110 §13.1.1 (`If-Match`) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html). Every isolation rule below is quoted verbatim from the manual.
> Documentation-verified; **no sandbox run, no timings, no query plans**.
> Target: **PostgreSQL 18.4** · **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Every other failure in this chapter announces itself. A constraint violation throws. A missing row is a 404. A pool exhaustion is a timeout with a stack trace. The lost update produces none of those: two `200 OK` responses, two satisfied clients, two rows in the access log, no error anywhere, and one edit that no longer exists. It is not a race in the sense of a flaky test — it is deterministic given the interleaving, and the interleaving happens whenever two people have the same card open, which on a shared board is most of the time. This page draws it out, shows why PostgreSQL is behaving exactly as documented while it happens, and names the three families of fix so the next three pages can build them.**

## The interleaving, in full

Two people have card `c1` open. Its description says *"needs review"*. Alice fixes a typo in the title; Bob rewrites the description. Neither touches the other's field.

```text
time   Alice (request A)                    Bob (request B)             cards row c1
────────────────────────────────────────────────────────────────────────────────────
t0                                                                      title='Loign bug'
                                                                        body='needs review'
t1     GET /api/cards/c1
       → title='Loign bug'
         body='needs review'

t2                                          GET /api/cards/c1
                                            → title='Loign bug'
                                              body='needs review'

t3     user fixes the title                 user rewrites the body
       in a form bound to the
       whole card

t4     PUT /api/cards/c1
       {title:'Login bug',
        body:'needs review'}                                            title='Login bug'
       → 200 OK                                                         body='needs review'

t5                                          PUT /api/cards/c1
                                            {title:'Loign bug',
                                             body:'repro in #482'}      title='Loign bug'
                                            → 200 OK                    body='repro in #482'
────────────────────────────────────────────────────────────────────────────────────
final state: title='Loign bug'   body='repro in #482'
```

**Alice's fix is gone.** Not delayed, not queued, not in a conflict list — gone, with no record that it ever existed. Alice saw `200 OK`. Bob saw `200 OK`. The server did exactly what both of them asked.

## PATCH does not save you

The instinct is that PATCH avoids this because each client sends only its own field. It narrows the window; it does not close it. Any patch whose value was *computed from a read* carries the same staleness:

```text
time   Alice (request A)                    Bob (request B)             c1.status
──────────────────────────────────────────────────────────────────────────────────
t0                                                                      'doing'
t1     GET → status='doing'
t2                                          GET → status='doing'
t3     UI shows "Mark done"                 UI shows "Move back to todo"
t4     PATCH {status:'done'}                                            'done'
       → 200 OK
t5                                          PATCH {status:'todo'}       'todo'
                                            → 200 OK
──────────────────────────────────────────────────────────────────────────────────
final: 'todo' — Bob's decision was made against a card that was still 'doing'
```

Bob did not choose to undo Alice's transition; he chose an action that only made sense against the state he read. The write is *not* what was lost — the **decision** was made on stale data and applied anyway. A patch that carries a delta (`position + 1`) is worse still: both deltas apply, and the result is a value neither client predicted.

🔴 **The rule: any update whose value depends on a value the client read is a read-modify-write, and every read-modify-write over an HTTP boundary can lose an update.**

## PostgreSQL is not at fault, and knowing why matters

The manual is explicit about what Read Committed guarantees, and it does not include this:

> *"Read Committed is the default isolation level in PostgreSQL. When a transaction uses this isolation level, a SELECT query (without a FOR UPDATE/SHARE clause) sees only data committed before the query began; it never sees either uncommitted data or changes committed by concurrent transactions during the query's execution."*
> — [PostgreSQL 18 · 13.2.1](https://www.postgresql.org/docs/18/transaction-iso.html)

Both requests read committed data. Both wrote committed data. There was never a moment where either saw something dirty. **The two statements did not even overlap in time** — Alice's `UPDATE` had committed and released its row lock before Bob's `UPDATE` looked for the row.

If they *had* overlapped, Postgres would have serialised them, and the manual describes exactly what that looks like:

> *"However, such a target row might have already been updated (or deleted or locked) by another concurrent transaction by the time it is found. In this case, the would-be updater will wait for the first updating transaction to commit or roll back … If the first updater commits, the second updater will ignore the row if the first updater deleted it, otherwise it will attempt to apply its operation to the updated version of the row. The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition."*

Read the last sentence twice, because it is the hinge for [07d](07d-optimistic-concurrency-with-a-version-column.md). Postgres **re-evaluates the `WHERE` clause against the updated row**. If your `WHERE` clause only says `id = $1`, the re-evaluation always matches and the second write always lands. If it also says `version = $2`, the re-evaluation *fails* and the second write affects zero rows — and that is the entire mechanism of optimistic concurrency. You are not adding a lock; you are giving the existing re-check something to fail on.

## Why raising the isolation level does not fix this on its own

A tempting move is to run both requests at Repeatable Read or Serializable. It does not help here, for a reason that is worth internalising: **there is no transaction spanning the read and the write.** Alice's `GET` is one request on one connection; her `PUT` is a different request, seconds later, quite possibly on a different backend behind a pooler. There is nothing for the database to serialise.

The manual assumes the read and the write are inside the same transaction:

> *"Applications using this level must be prepared to retry transactions due to serialization failures."*

That is the model for a batch job. It is not available to an HTTP API — a transaction cannot span a client round trip, for three separate reasons enumerated in [09e](09e-a-transaction-cannot-span-an-http-boundary.md). Isolation levels protect a transaction from concurrency *inside its own lifetime*. The lost update happens in the gap **between** two transactions, which is a gap the database cannot see.

## Why no test and no log line catches it

This is the part that makes the bug expensive.

- **Unit tests** call the DAL once. One caller cannot lose an update to itself.
- **Integration tests** issue requests in sequence. The interleaving requires two clients holding stale reads, which no sequential test produces.
- **The access log** shows two successful `PUT`s to the same path, which is also what two legitimate consecutive edits look like. There is no signal to alert on.
- **Error tracking** sees nothing, because nothing threw.
- **The database** logs nothing, because both statements were valid and both committed.
- **Row-level audit** — if you have it — records both writes faithfully, and reading it later tells you the second overwrote the first. That is the *only* mechanism on this list that retains any evidence, and it is after the fact.

The user-facing symptom is *"I definitely saved that"*, reported hours later, and it is unreproducible by definition. Teams routinely close these as user error. **Absence of reports is not evidence the bug is absent**, and that is the argument for fixing it before you have seen it.

## The three families of fix

Each gets its own page, because each has a different cost and a different failure mode.

| Family | Mechanism | Cost | Page |
|---|---|---|---|
| **Optimistic, server token** | A `version` column in the `WHERE` clause; zero rows affected means conflict; respond **409** | One extra column, one extra clause, clients must round-trip the version | [07d](07d-optimistic-concurrency-with-a-version-column.md) |
| **Optimistic, HTTP-native** | `ETag` on the read, `If-Match` on the write; failed precondition means **412** | Same, but expressed in headers a cache and a generic client already understand | [07e](07e-etag-if-match-and-412.md) |
| **Pessimistic** | `SELECT … FOR UPDATE` inside a transaction that also writes | Holds a row lock and a pooled connection for the duration; wrong by default over HTTP | [07f](07f-pessimistic-locking-and-when-it-is-right.md) |

There is a fourth option that is sometimes right and is not a fix: **make the conflict impossible by narrowing what a write touches.** If the API exposes `PATCH` with only the fields the interaction actually changes, two people editing different fields of the same card never conflict at all. That does not help two people editing the *same* field, which is what the version column is for, but it removes a large class of false conflicts before they exist. It is also why [07](07-update.md) argues most APIs want PATCH.

## The one case that is genuinely safe without any of this

A write whose new value does not depend on a value the client read cannot lose an update, because there is nothing stale in it:

```sql
-- safe: the new value is computed by the database from the current row
UPDATE cards SET position = position + 1024 WHERE board_id = $1 AND position >= $2;
```

That is a single statement. Postgres locks each matching row, applies the arithmetic to the version it locked, and no client-side read is involved. It is the reason [09](09-transactions-and-multi-table-writes.md) opens by saying a single-statement update does not need a transaction. **But note what it costs you: the client cannot know what the result will be, and cannot reject the operation on the grounds that the row changed.** For a counter that is fine. For an edit a human made against something they read, it is not.

## Gotchas

**★ Symptom: a user insists an edit was saved and it is not there, and it cannot be reproduced.** Cause: a lost update — another client wrote the same row from a stale read between this user's read and write. Fix: it is not reproducible by design, so stop trying; add the conflict detection and the report class disappears. The cheapest version is [07d](07d-optimistic-concurrency-with-a-version-column.md).

**★ Symptom: switching to PATCH "fixed" the reports, and then they came back.** Cause: PATCH narrows the window to writes that touch the *same* field rather than any field, so the rate drops far enough to look like a fix. The mechanism is unchanged. Fix: keep the PATCH — it genuinely removes false conflicts — and add a version check for the fields two people actually contend on.

**★ Symptom: setting `default_transaction_isolation` to `serializable` did not change anything.** Cause: there is no transaction spanning the read and the write; each HTTP request is its own transaction, and isolation only constrains what happens inside one. Fix: the check has to be carried by the client across the gap — a version, an `ETag`, or a timestamp the client echoes back — because that gap is the only place the staleness exists.

**★ Symptom: a counter is wrong by exactly the number of concurrent writers.** Cause: `read count → count + 1 → write` in application code. Fix: do the arithmetic in SQL so the value is never round-tripped:

```ts
await db.update(cards)
  .set({ commentCount: sql`${cards.commentCount} + 1` })
  .where(eq(cards.id, cardId))
```

**★ Symptom: drag-and-drop reordering produces two cards at the same position.** Cause: both clients computed a new `position` from the list they had rendered, and both were valid against that list. Fix: this is the lost update wearing a different costume, and it needs both a conflict check and a position scheme that tolerates collisions — [07g](07g-position-collisions-and-updatedat.md).

**★ Symptom: adding a version column did not stop the losses.** Cause: the version was read and echoed but never put in the `WHERE` clause — the update matched on `id` alone and the version column was merely set. Fix: the version must be a **predicate**, not a payload; the affected-row count is the signal, and [07d](07d-optimistic-concurrency-with-a-version-column.md) shows the statement.

**★ Symptom: an audit table shows the overwriting write, and everyone still argues about whether it happened.** Cause: the audit records what was written, not what the writer believed it was overwriting. Fix: record the prior version alongside the new one, so a lost update is a query rather than an argument — an audit row whose `from_version` is not the immediately preceding row's `to_version` is a detected overwrite.

## Interview questions

**★ Walk me through a lost update. Where exactly does the data disappear?**
Two clients read the same row, each computes a new state from what it read, and each writes. The second write commits over the first, and because both `WHERE` clauses matched on the primary key alone, the database has no basis to object. The data disappears at the moment of the second commit, and the point to make in an interview is that **nothing anywhere errors** — both clients get 200, both statements were valid, and the only trace is in an audit trail if you happened to have one.

**★ Is a lost update a database bug, an isolation-level problem, or an application design problem?**
An application design problem. PostgreSQL at Read Committed did exactly what it documents: each statement saw committed data and each `UPDATE` re-evaluated its `WHERE` clause against the current version of the row. Raising the isolation level cannot help because the read and the write are in different transactions on different connections, separated by a human. The staleness lives in the gap between requests, which is outside every transaction, so the check has to be carried across that gap by the client.

**★ Why does `UPDATE cards SET position = position + 1024 WHERE …` not lose updates, when `UPDATE cards SET position = 5120 WHERE id = $1` can?**
Because the first computes its new value from the row version the database itself locked, so there is no client-side read to be stale. Postgres finds the row, takes the row lock, waits if another transaction holds it, re-reads the updated version and applies the arithmetic to that. The second carries a value the client computed from something it read earlier; whatever happened to the row in between is simply overwritten.

**★ Your CI is green, error tracking is empty, and a customer says their edits keep vanishing. What is your first hypothesis?**
Lost update. It is the only failure class in a CRUD API that produces successful responses on every path and leaves nothing in logs or error tracking, and it is invisible to sequential tests because it requires two clients holding stale reads simultaneously. The next question is which fields two users actually contend on, because that tells you whether the fix is narrowing the write surface, adding a version predicate, or both.

**★ Why is "we have never had a report of this" a bad argument for not fixing it?**
Because the symptom is indistinguishable from a user misremembering, so the reports that do arrive are usually closed as user error, and the ones that do not arrive are people who assumed they made a mistake. The failure produces no signal you could alert on, so the absence of alerts carries no information. On a shared board with concurrent editors, the interleaving is not rare — it is the normal case, and the only reason it is not constant is that most edits touch different fields.

**★ What is the cheapest fix that does not require touching clients?**
There isn't one, and that is the honest answer. Every mechanism requires the client to send back something it received on the read — a version, an entity tag, a timestamp — because that token is the only carrier of "the state I based this on". The nearest thing to a client-free fix is to shrink each write to the smallest set of fields the interaction genuinely changes, which removes conflicts between users editing different fields but does nothing for two users editing the same one.

---

← [07b · Absent vs null](07b-absent-versus-null.md) · [Chapter 16 overview](01-explanation.md) · Next → [07d · Optimistic concurrency with a version column](07d-optimistic-concurrency-with-a-version-column.md)
