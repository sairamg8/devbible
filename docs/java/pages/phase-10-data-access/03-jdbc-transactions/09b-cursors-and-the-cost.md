---
title: "Cursors ignore savepoint semantics, and a savepoint per row is a documented way to exhaust the server"
sidebar_label: "9b · Cursors and the cost"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 `ROLLBACK TO SAVEPOINT` reference
> page ([postgresql.org/docs/18/sql-rollback-to.html](https://www.postgresql.org/docs/18/sql-rollback-to.html)),
> the PL/pgSQL *Trapping Errors* section
> ([postgresql.org/docs/18/plpgsql-control-structures.html](https://www.postgresql.org/docs/18/plpgsql-control-structures.html)),
> and the pgJDBC connection-parameter documentation for `cleanupSavepoints` and
> `autosave` ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**[Chunk 9](09-savepoints.md) treated savepoints as clean, transactional rewind
points. Two things spoil that. Cursors do not obey savepoint semantics — the
manual opens the subject by saying they have "somewhat non-transactional
behavior", and the four rules that follow do not share a single principle. Since
setting a fetch size in JDBC makes pgJDBC use a server-side cursor, a streaming
`ResultSet` is subject to all of them. And savepoints cost real server-side
resources: pgJDBC ships a connection parameter whose documented purpose is to
avoid running out of shared buffers when thousands of them accumulate.**

## Cursors are the exception to everything above

Savepoints are transactional. Cursors, largely, are not. The `ROLLBACK TO
SAVEPOINT` page spells out four separate rules, and they do not follow one
principle:

> Cursors have somewhat non-transactional behavior with respect to savepoints. Any
> cursor that is opened inside a savepoint will be closed when the savepoint is
> rolled back. If a previously opened cursor is affected by a `FETCH` or `MOVE`
> command inside a savepoint that is later rolled back, the cursor remains at the
> position that `FETCH` left it pointing to (that is, the cursor motion caused by
> `FETCH` is not rolled back). Closing a cursor is not undone by rolling back,
> either. However, other side-effects caused by the cursor's query (such as
> side-effects of volatile functions called by the query) *are* rolled back if they
> occur during a savepoint that is later rolled back. A cursor whose execution
> causes a transaction to abort is put in a cannot-execute state, so while the
> transaction can be restored using `ROLLBACK TO SAVEPOINT`, the cursor can no
> longer be used.

As a table, because the asymmetry is the point:

| Thing | Rolled back with the savepoint? |
|---|---|
| A cursor **opened** inside the savepoint | ✅ it is closed |
| A cursor's **position** after `FETCH`/`MOVE` | ❌ it stays where `FETCH` left it |
| A cursor **closed** inside the savepoint | ❌ it stays closed |
| Side-effects of volatile functions in the cursor's query | ✅ rolled back |
| A cursor whose execution aborted the transaction | ❌ permanently in a cannot-execute state |

🔴 **This matters in Java the moment you use a streaming `ResultSet`.** Setting a
fetch size makes pgJDBC use a server-side cursor
([fetch size and streaming](../01-jdbc/15-fetch-size-and-streaming.md)), so a
`ResultSet` you are iterating *is* a cursor. Roll back to a savepoint taken before
you opened it and the `ResultSet` is dead. Roll back to a savepoint taken after
you started iterating and the rows you already consumed are still consumed — the
position does not rewind.

**The safe rule: do not hold an open streaming `ResultSet` across a savepoint
rollback.** Finish reading, close it, then do the work that might need rewinding.

## Savepoints are not free

The savepoint reference pages say nothing about cost, so the honest evidence is
pgJDBC's own documentation for the option that exists to control it.
`cleanupSavepoints` — *"determines if the SAVEPOINT created in autosave mode is
released prior to the statement"* — is justified like this:

> This is done to avoid running out of shared buffers on the server in the case
> where 1000's of queries are performed.

🔴 **That is a documented resource exhaustion, not a vague performance concern.**
A savepoint per statement, across thousands of statements in one transaction, is a
shape the driver's own maintainers found necessary to provide an escape from.

The PL/pgSQL documentation makes a related observation about the language
construct that uses the same machinery: *"A block containing an `EXCEPTION` clause
is significantly more expensive to enter and exit than a block without one.
Therefore, don't use `EXCEPTION` without need."*

⚠️ **I could not find a primary source that quantifies the per-savepoint cost**, so
this page does not give a number. What the documentation does support is the
shape of the advice:

- A handful of savepoints in a transaction: fine, and the right tool.
- **One savepoint per row in a large loop, never released: a known pathology.**
  Release each one when it is no longer needed, which is what the success path of
  the loop above is for.
- If you find yourself wanting a savepoint before literally every statement, that
  is what pgJDBC's `autosave` parameter does — and it comes with the same warning,
  in [chunk 10](10-the-aborted-transaction.md).

## The trade-off

| You gain | You pay |
|---|---|
| Recover from a statement failure without losing the whole transaction | server-side state per live savepoint, with a documented exhaustion risk |
| A per-item retry inside a batch | more code paths, and a `Savepoint` object whose validity you must track |
| An escape from the aborted-transaction state (`25P02`) | the transaction still holds every lock and its snapshot the whole time |
| Repeated rewinds to the same mark | cursors do not participate, and a streaming `ResultSet` is a cursor |

## Gotchas
**⚠️ Never releasing savepoints in a loop**
**Symptom:** a long batch transaction slows down or fails on the server side after
thousands of iterations.
**Cause:** every unreleased savepoint is live server-side state for the rest of the
transaction. pgJDBC's `cleanupSavepoints` documentation names the failure as
running out of shared buffers.
**Fix:** `releaseSavepoint(sp)` on the success path of every iteration.

**⚠️ Rolling back over an open streaming `ResultSet`**
**Symptom:** a `ResultSet` that throws on the next `next()` after an error was
handled, or one that silently continues from where it left off rather than from the
beginning.
**Cause:** a fetch-size `ResultSet` is a server-side cursor, and cursors do not
follow savepoint semantics: one opened inside the savepoint is closed, and one
merely `FETCH`ed inside it keeps its position.
**Fix:** do not hold an open streaming `ResultSet` across a savepoint rollback.

**⚠️ Expecting `RELEASE SAVEPOINT` to commit something**
**Symptom:** a developer releases savepoints expecting the work to be durable, and
loses all of it when the transaction later rolls back.
**Cause:** `RELEASE` destroys the mark and keeps the effects *within the
transaction*. It is not a commit and nothing is durable until the transaction
commits.
**Fix:** read it as "I will not rewind to here again", nothing more.

## Interview questions
**★ How do savepoints interact with cursors?**
Badly, and asymmetrically, which is why the manual opens that paragraph by saying
cursors have "somewhat non-transactional behavior with respect to savepoints". Four
separate rules: a cursor opened inside the savepoint is closed when you roll back;
a cursor's position after a `FETCH` or `MOVE` inside the savepoint is *not* rewound
— it stays where the fetch left it; closing a cursor is not undone either; but
side-effects of volatile functions in the cursor's query *are* rolled back. And a
cursor whose execution aborted the transaction is permanently unusable even after a
successful `ROLLBACK TO SAVEPOINT`. This is not academic in Java: setting a fetch
size makes pgJDBC use a server-side cursor, so a streaming `ResultSet` is subject
to all of it.

**★ Is it safe to take a savepoint before every statement?**
It is what pgJDBC's `autosave=always` mode does, so it is a supported strategy —
but it has a documented cost. The driver ships a separate parameter,
`cleanupSavepoints`, whose stated purpose is "to avoid running out of shared
buffers on the server in the case where 1000's of queries are performed". So a
savepoint per statement over thousands of statements is a known resource problem
that the driver's own maintainers had to provide an escape from. A handful of
savepoints per transaction is fine. A savepoint per row in a large loop, never
released, is a pathology — release each one on the success path.

**★ A streaming `ResultSet` is open and a statement fails. What are your options?**
Very few, and that is the design pressure. The `ResultSet` is a server-side cursor,
so the savepoint rules apply to it rather than the ordinary transactional ones. If
the cursor was opened after the savepoint you rewind to, it is closed and gone. If
it was opened before and you have been fetching from it, its position is *not*
rewound — the rows you consumed stay consumed, so retrying the loop from the top
would skip them. And if the cursor's own execution is what aborted the transaction,
it is in a permanent cannot-execute state that `ROLLBACK TO SAVEPOINT` will not
clear. The practical answer is to avoid the situation: read the stream to
completion and close it, then do the work that might fail, rather than interleaving
a long read with statements that could need rewinding.

**★ Why does releasing a savepoint matter if the transaction is going to end
anyway?**
Because "anyway" can be a very long time. Every live savepoint is state the server
tracks for the remainder of the transaction, and pgJDBC's `cleanupSavepoints`
parameter exists specifically because that state can be exhausted — its
documentation says releasing early is done "to avoid running out of shared buffers
on the server in the case where 1000's of queries are performed". In a short
transaction with three savepoints, releasing is tidiness. In a batch loop over
fifty thousand rows, releasing on the success path is the difference between a job
that finishes and one that does not.

---

← Prev: [9 · Savepoints](09-savepoints.md) · Index: [Transactions at the JDBC level](README.md) · Next → [10 · The aborted transaction](10-the-aborted-transaction.md)
