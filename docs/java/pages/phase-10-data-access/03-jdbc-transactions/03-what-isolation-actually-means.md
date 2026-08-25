---
title: "An isolation level is a list of things the database promises will not happen — not a description of how it stops them"
sidebar_label: "3 · What isolation means"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> including Table 13.1, the PostgreSQL 18 reference page for `SET TRANSACTION`
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> and the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18. No sandbox: no console output, no timings.

**The SQL standard does not say what an isolation level *does*. It says what an
isolation level must *forbid*. Three of the four levels are defined purely as a
list of bad things — "at this level, a dirty read must not happen" — and the
implementation is free to prevent more than the list requires, by any mechanism
it likes. That single design decision explains almost every confusing thing about
isolation. It is why `REPEATABLE READ` on PostgreSQL and `REPEATABLE READ` on
another database behave differently and both are correct. It is why the
`java.sql.Connection` constants describe behaviour PostgreSQL does not actually
have. And it is why "we set the isolation level to X" is never, on its own, a
statement about what your application will observe.**

## The four bad things, named

The manual calls them *phenomena*. There are four, and every level is defined by
which of them it tolerates. These are the manual's own definitions:

**Dirty read** — *"A transaction reads data written by a concurrent uncommitted
transaction."* You read a row somebody else is halfway through changing. If they
roll back, you acted on a value that never existed.

**Nonrepeatable read** — *"A transaction re-reads data it has previously read and
finds that data has been modified by another transaction (that committed since
the initial read)."* You read a row twice inside one transaction and get two
different answers. The row is the same row; its contents moved under you.

**Phantom read** — *"A transaction re-executes a query returning a set of rows
that satisfy a search condition and finds that the set of rows satisfying the
condition has changed due to another recently-committed transaction."* You count
the orders over £100 twice and get 7 then 8. No row you read changed; a new row
appeared that matches.

**Serialization anomaly** — *"The result of successfully committing a group of
transactions is inconsistent with all possible orderings of running those
transactions one at a time."* Nothing you can point at looks wrong. Each
transaction read committed data and wrote committed data. But the combined result
is one no sequential ordering could ever have produced.

The first three are about **one transaction's view being disturbed**. The fourth
is different in kind — it is about the *set* of transactions producing a result
that is collectively impossible, and you cannot detect it by looking at any one
of them.

## The levels, and what each one forbids

The standard defines Serializable directly: *"any concurrent execution of a set
of Serializable transactions is guaranteed to produce the same effect as running
them one at a time in some order."* The other three are defined *by phenomena*.
This is Table 13.1 from the manual:

| Isolation level | Dirty read | Nonrepeatable read | Phantom read | Serialization anomaly |
|---|---|---|---|---|
| Read uncommitted | Allowed, **but not in PG** | Possible | Possible | Possible |
| Read committed | Not possible | Possible | Possible | Possible |
| Repeatable read | Not possible | Not possible | Allowed, **but not in PG** | Possible |
| Serializable | Not possible | Not possible | Not possible | Not possible |

🔴 **Stare at the two "Allowed, but not in PG" cells.** That is the whole point of
this page rendered as two table cells. The standard *permits* a dirty read at
Read Uncommitted — it does not require one. PostgreSQL provides none, so
requesting Read Uncommitted gets you something strictly stronger than you asked
for. Same at Repeatable Read: the standard permits phantoms there; PostgreSQL
forbids them anyway.

The manual states the licence explicitly, in the Repeatable Read section: this is
*"a stronger guarantee than is required by the SQL standard for this isolation
level ... this is specifically allowed by the standard, which only describes the
**minimum** protections each isolation level must provide."*

**Minimum protections.** A level is a floor, not a specification.

## Why two databases at "REPEATABLE READ" legitimately disagree

Two implementations can both be conformant and behave nothing alike, because
conformance only constrains the floor.

- One database may implement Repeatable Read by **holding read locks** on every
  row it read until commit. Concurrent writers to those rows block. Nobody gets
  a serialization failure; they get a wait, and sometimes a deadlock.
- PostgreSQL implements it with **snapshot isolation** — the transaction reads
  from a fixed point in time and takes no read locks at all. Concurrent writers
  never block. Instead, if *you* try to write a row somebody else already changed,
  **your transaction is aborted**, at `40001`.

Same level name. Same standard. Locks and waiting on one side; no waiting and
sudden aborts on the other. The manual is explicit that this happens: *"Some
other systems may even offer Repeatable Read and Snapshot Isolation as distinct
isolation levels with different behavior."*

⚠️ **So a claim like "we run at REPEATABLE READ, so we are safe from X" does not
port.** It is a claim about one engine's implementation. Moving the same code to
another engine at the same nominal level can change which failures you get, and
whether you get failures at all rather than waits. Isolation level is portable
syntax over non-portable behaviour.

## The JDBC constants describe a database you are not using

`java.sql.Connection` names the four levels as integer constants, and their
javadoc defines them the standard's way — by phenomena. `TRANSACTION_REPEATABLE_READ`
is documented as:

> *"A constant indicating that dirty reads and non-repeatable reads are
> prevented; phantom reads can occur."*

**On PostgreSQL, phantom reads cannot occur at Repeatable Read.** The javadoc is
not wrong — it is describing the standard's minimum, which is the only thing a
vendor-neutral API *can* describe. But a Java developer reading that javadoc and
concluding "I need SERIALIZABLE to stop phantoms" has been misled about
PostgreSQL specifically, and will pay for a level they did not need.

The same gap runs the other way. `TRANSACTION_SERIALIZABLE`'s javadoc talks only
about phantom rows. It says nothing about serialization anomalies — the
[write-skew shaped failures](07-serializable-and-ssi.md) that are the actual
reason to reach for Serializable on PostgreSQL — because the phenomenon was not
in the standard's original vocabulary.

**Read the constants as names, and the engine's manual as the meaning.**

## What isolation is not

Two things get confused with isolation constantly, and neither is it.

**Isolation is not atomicity.** Atomicity is all-or-nothing for *your* statements
— [commit and rollback](02-commit-rollback-and-the-shape-that-survives.md).
Isolation is what you see of *other people's* work while yours runs. You can have
perfect atomicity and still read a value that has gone stale by the time you use
it.

**Isolation is not a lock.** On PostgreSQL, raising the level does not add
blocking. Repeatable Read and Serializable take no additional read locks —
Serializable's predicate locks, the manual says, *"do not cause any blocking and
therefore can **not** play any part in causing a deadlock."* What raising the
level adds is **aborts**. You trade "sometimes waits" for "sometimes fails and
must be retried", which is a very different thing to design around, and it is why
[retrying safely](14-retrying-safely.md) is a chunk of its own.

## The trade-off

Every level above Read Committed costs you something, and on PostgreSQL the
currency is not usually speed — it is **failed transactions you have to handle**.

| You gain | You pay |
|---|---|
| A stable view across the whole transaction (RR) | `40001` aborts on write conflicts; your code needs a retry path |
| True serializability (SER) | Predicate-lock tracking overhead, plus `40001` from dependency cycles you cannot predict by reading one transaction |
| Fewer explicit `SELECT ... FOR UPDATE` locks | Less control over *which* transaction loses |
| Simpler reasoning per transaction | Harder reasoning about the system's failure rate under load |

And there is a subtler cost. A long-running transaction at Repeatable Read or
Serializable pins an old snapshot, which means the old row versions it might need
cannot be cleaned up. That is a storage and performance cost paid by the whole
database, not just by your session.

## Gotchas

**⚠️ Reading the JDBC javadoc as if it described PostgreSQL**
**Symptom:** a team sets `TRANSACTION_SERIALIZABLE` to prevent phantom reads,
absorbs the abort rate, and discovers Repeatable Read would have done it.
**Cause:** the `Connection` constants document the SQL standard's minimum, not
any particular engine's behaviour.
**Fix:** decide the level from the engine's manual — Table 13.1 — and use the
constant only as the name for it.

**⚠️ Assuming a stricter level means more locking**
**Symptom:** a change from Read Committed to Repeatable Read is rejected in
review as "it will serialize all our traffic", and nobody measures it.
**Cause:** intuition borrowed from lock-based engines, where higher levels do
hold more locks for longer.
**Fix:** on PostgreSQL, higher levels do not block more; they abort more. The
review question is "do we have a retry path?", not "will this queue up?".

**⚠️ Treating "serialization anomaly" as a synonym for "nonrepeatable read"**
**Symptom:** a bug report says data was inconsistent, the team confirms every
individual read was of committed data, and concludes there is no isolation
problem.
**Cause:** the fourth phenomenon is not visible from inside any single
transaction. Every read was legal; the *combination* was impossible.
**Fix:** learn the shape — two transactions each read what the other is about to
write, and each writes based on a state the other invalidated. It is the subject
of [chunk 7](07-serializable-and-ssi.md).

**⚠️ Porting an isolation-level decision between databases**
**Symptom:** code that was correct on one engine develops a race after a
migration, at the same isolation level.
**Cause:** the standard fixes the floor, not the behaviour. Snapshot-based and
lock-based implementations of the same level differ in what they prevent, what
they block, and what they abort.
**Fix:** re-derive the level from the new engine's own table, and re-check every
place that depended on a read blocking a writer.

**⚠️ Believing a level applies to the whole application**
**Symptom:** `default_transaction_isolation` is raised globally to fix one
endpoint, and unrelated endpoints start failing at `40001`.
**Cause:** the level is a property of a transaction, and a global default applies
it to transactions that never needed it and have no retry path.
**Fix:** set it per transaction where it is needed —
[chunk 8](08-setting-the-level-from-java.md).

## Interview questions

**★ What are the four phenomena the SQL standard names, in your own words?**
A dirty read is seeing a row another transaction has written but not committed —
so if they roll back, you acted on a value that never existed. A nonrepeatable
read is reading the same row twice in one transaction and getting different
contents, because somebody committed a change in between. A phantom read is
running the same *query* twice and getting a different set of rows, because a
newly committed row now matches the WHERE clause — no row you read changed, the
population did. A serialization anomaly is the odd one out: every individual read
and write was of committed data and looks fine, but the committed result of the
group of transactions is one that no serial ordering of them could have produced.
The first three are disturbances to one transaction's view; the fourth is only
visible from outside all of them.

**★ Why do two databases at the same isolation level behave differently?**
Because the standard defines three of the four levels by what they must *forbid*,
not by how they work, and it explicitly describes only the *minimum* protection
each level provides. An implementation is free to prevent more than required, and
free to use any mechanism. PostgreSQL uses snapshot isolation and takes no read
locks, so at Repeatable Read a concurrent writer never blocks you — but writing a
row somebody else already changed aborts you with `40001`. A lock-based engine at
the same nominal level may instead hold read locks and make that writer wait.
Both conform. The name is portable; the behaviour is not.

**★ PostgreSQL forbids phantom reads at Repeatable Read. Is that a violation of
the standard?**
No, and the manual says so directly: the levels describe minimum protections, so
preventing a phenomenon the standard permits is allowed. Table 13.1 records it as
"Allowed, but not in PG". The practical consequence for a Java developer is that
`TRANSACTION_REPEATABLE_READ` on PostgreSQL is stronger than its javadoc
promises, and reaching for `TRANSACTION_SERIALIZABLE` purely to stop phantoms is
paying for something you already have. What Serializable adds on PostgreSQL is
protection from serialization anomalies, which is a different problem.

**★ If isolation is not locking, what does raising the level actually cost?**
On PostgreSQL it costs failed transactions and some bookkeeping, not blocking.
Repeatable Read pins one snapshot for the whole transaction, so a write conflict
that Read Committed would have quietly re-evaluated becomes an abort you must
catch and retry. Serializable adds predicate-lock tracking to detect read/write
dependency cycles — the manual notes this monitoring "does not introduce any
blocking beyond that present in repeatable read", but it has overhead and it
produces aborts that are genuinely hard to predict from reading a single
transaction. There is also a system-wide cost: a long transaction at either level
holds an old snapshot and prevents cleanup of row versions the whole database
would like to reclaim.

**★ Is it enough to say "we run at READ COMMITTED" to describe an application's
concurrency behaviour?**
No. The level is a floor on what the engine forbids; it says nothing about what
your code does with what it read. Read Committed prevents dirty reads and nothing
else, so any read-compute-write sequence in Java is still a race unless you
either do the work in a single SQL statement, take an explicit row lock, or move
to a level that turns the conflict into a detectable abort. The level is one of
three inputs to the answer — the others are the shape of your statements and
where your transaction boundaries are.

**★ Which of the four phenomena can a read-only transaction suffer?**
Dirty reads, nonrepeatable reads and phantoms are all read-side problems, so a
read-only transaction is exposed to whichever of them its level permits — at Read
Committed, all three. It cannot *cause* a serialization anomaly by writing, but
the manual is careful to say it can still *observe* an inconsistent state at
Repeatable Read: it gives the example of a read-only transaction seeing a control
record marked complete while missing a detail row that logically belongs to that
batch. What a read-only transaction is safe from is the write-conflict abort — the
manual notes that "only updating transactions might need to be retried;
read-only transactions will never have serialization conflicts" at Repeatable
Read. At Serializable that changes, and declaring the transaction read-only is
how you get the guarantee back.

---

← Prev: [2 · commit, rollback, the shape](02-commit-rollback-and-the-shape-that-survives.md) · Index: [Transactions at the JDBC level](README.md) · Next → [4 · Three levels, four names](04-postgresql-has-three-levels.md)
