---
title: "03 · Transactions at the JDBC level"
sidebar_label: "Overview"
sidebar_position: 0
---




<span className="db-tier t-understand">Understand</span>

> Verified: see each chunk's own `> Verified:` line.

**27 chunks.**

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · Autocommit](01-autocommit-is-a-transaction-you-did-not-choose.md)** | You are always in a transaction — autocommit just means somebody else decides where it ends |
| 2 | **[2 · commit, rollback, the shape](02-commit-rollback-and-the-shape-that-survives.md)** | `rollback()` in a catch block is the easiest place in Java to lose the exception that told you why |
| 3 | **[3 · What isolation means](03-what-isolation-actually-means.md)** | An isolation level is a list of things the database promises will not happen — not a description of how it stops them |
| 4 | **[4 · Three levels, four names](04-postgresql-has-three-levels.md)** | PostgreSQL accepts all four isolation levels and implements three — READ UNCOMMITTED is silently READ COMMITTED |
| 5 | **[5 · Read Committed](05-read-committed-in-practice.md)** | At READ COMMITTED each statement gets its own snapshot, which is how a withdrawal silently loses money |
| 6 | **[5b · The inconsistent snapshot](05b-when-re-evaluation-surprises-you.md)** | The same re-evaluation that makes a single UPDATE safe makes a set-based DELETE miss rows that match |
| 7 | **[6 · Repeatable Read](06-repeatable-read.md)** | REPEATABLE READ gives the whole transaction one snapshot, and hands you SQLSTATE 40001 as the price |
| 8 | **[6b · What RR does not fix](06b-what-repeatable-read-still-cannot-promise.md)** | A stable view is not a correct one — what Repeatable Read still cannot promise, and what it costs the rest of the database |
| 9 | **[7 · Serializable and SSI](07-serializable-and-ssi.md)** | SERIALIZABLE catches the anomaly nobody can see from inside a single transaction, by watching for dependency cycles instead of locking |
| 10 | **[7b · Living with Serializable](07b-making-serializable-perform.md)** | Making SERIALIZABLE perform is mostly about giving SSI less to track — and the retry loop is not optional |
| 11 | **[7c · DEFERRABLE and its limits](07c-deferrable-and-the-limits.md)** | DEFERRABLE is the one Serializable mode that cannot be aborted — and Serializable still cannot save a transaction that skips the check |
| 12 | **[8 · Setting the level](08-setting-the-level-from-java.md)** | setTransactionIsolation on pgJDBC changes the whole session, not the transaction — which is a problem when the connection came from a pool |
| 13 | **[8b · The level and the pool](08b-the-level-and-the-pool.md)** | A pooled connection remembers the isolation level you set — and if you set it with SQL, the pool cannot undo it |
| 14 | **[9 · Savepoints](09-savepoints.md)** | A savepoint lets you undo part of a transaction without ending it — which is the only reason the aborted-transaction escape hatch exists |
| 15 | **[9b · Cursors and the cost](09b-cursors-and-the-cost.md)** | Cursors ignore savepoint semantics, and a savepoint per row is a documented way to exhaust the server |
| 16 | **[10 · The aborted transaction](10-the-aborted-transaction.md)** | One failed statement poisons the whole transaction, and every statement after it reports a different error than the real one |
| 17 | **[10b · autosave](10b-autosave.md)** | pgJDBC can do the savepoint dance for you — but `autosave=always` changes what your application means, not just how robust it is |
| 18 | **[11 · Read-only transactions](11-read-only-transactions.md)** | setReadOnly is a hint in the JDBC spec and an enforced restriction on the server, and pgJDBC decides which one you get |
| 19 | **[11b · Read-only that earns its keep](11b-read-only-that-earns-its-keep.md)** | READ ONLY is close to free at REPEATABLE READ and a real performance instruction at SERIALIZABLE |
| 20 | **[12 · Row locks and FOR UPDATE](12-locking-and-select-for-update.md)** | SELECT FOR UPDATE closes the read-modify-write race by making the read itself a lock — and there are four strengths, not one |
| 21 | **[12b · NOWAIT, SKIP LOCKED, scope](12b-nowait-skip-locked-and-scope.md)** | SKIP LOCKED turns a table into a work queue by deliberately returning an inconsistent view of it |
| 22 | **[13 · Deadlocks](13-deadlocks-and-timeouts.md)** | PostgreSQL does not prevent deadlocks — it waits a second, notices the cycle, and kills one of you |
| 23 | **[13b · Which clock, and how to tell](13b-the-four-clocks.md)** | pg_stat_activity tells you whether a transaction is working, waiting or abandoned — and each one needs a different clock |
| 24 | **[14 · What to retry](14-retrying-safely.md)** | The SQLSTATE class decides whether a retry is correct, and only class 40 is a yes without conditions |
| 25 | **[14b · The commit in doubt](14b-when-the-commit-is-in-doubt.md)** | If the connection dies during commit you cannot know whether it landed, and no retry policy can tell you |
| 26 | **[15 · Where the boundary belongs](15-where-the-boundary-belongs.md)** | A transaction's length is a concurrency budget you are spending on behalf of everybody else |
| 27 | **[15b · Checklist and debugging order](15b-a-debugging-order-and-a-checklist.md)** | Start from the SQLSTATE, not from the stack trace — a debugging order for transaction problems, and a checklist to apply before they happen |
