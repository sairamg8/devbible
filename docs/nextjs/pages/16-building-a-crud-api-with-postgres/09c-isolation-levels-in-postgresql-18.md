---
title: "PostgreSQL implements three isolation levels rather than four, each one prevents a specific named set of anomalies and nothing else, and the level you did not choose — Read Committed — is the one every request in your API is already running at"
sidebar_label: "09c · Isolation levels"
sidebar_position: 64
description: "Read Committed, Repeatable Read and Serializable quoted from the PostgreSQL 18 manual, what each actually prevents, the read-only anomaly Repeatable Read still allows, how to set the level in Drizzle 0.45.2, and the rule for choosing per operation."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.2. Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [13.4. Data Consistency Checks at the Application Level](https://www.postgresql.org/docs/18/applevel-consistency.html) — and the published `drizzle-orm` **0.45.2** typings for `PgTransactionConfig` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/session.d.ts)). Every isolation rule below is a verbatim quote from the manual.
> Documentation-verified; **no sandbox run, no timings, no query plans**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**Isolation levels are usually taught as a ladder of strictness with an implied "higher is safer", which is true and useless — what you need is the specific list of anomalies each level prevents, because that list is what tells you whether your operation is safe. PostgreSQL narrows the question helpfully: it accepts all four standard levels but implements three, and the one you have never set is the one every statement in your API runs at. Nothing on this page changes what a *single* statement does; isolation only constrains what happens across the statements of one transaction, which is why it cannot fix the lost update in [07c](07c-the-lost-update.md) and can fix the multi-statement invariants in this topic.**

## Three, not four

> *"In PostgreSQL, you can request any of the four standard transaction isolation levels, but internally only three distinct isolation levels are implemented, i.e., PostgreSQL's Read Uncommitted mode behaves like Read Committed. This is because it is the only sensible way to map the standard isolation levels to PostgreSQL's multiversion concurrency control architecture."*
> — [PostgreSQL 18 · 13.2](https://www.postgresql.org/docs/18/transaction-iso.html)

And PostgreSQL gives more than the standard requires at the middle level:

> *"The table also shows that PostgreSQL's Repeatable Read implementation does not allow phantom reads. This is acceptable under the SQL standard because the standard specifies which anomalies must not occur at certain isolation levels; higher guarantees are acceptable."*

🔴 **So "Repeatable Read allows phantom reads" — the sentence in every database textbook — is false for PostgreSQL.** If you learned isolation from the standard, the map you are carrying is wrong here in a way that matters.

## Read Committed — the default, and what it does not promise

> *"Read Committed is the default isolation level in PostgreSQL. When a transaction uses this isolation level, a `SELECT` query (without a `FOR UPDATE/SHARE` clause) sees only data committed before the query began; it never sees either uncommitted data or changes committed by concurrent transactions during the query's execution. In effect, a `SELECT` query sees a snapshot of the database as of the instant the query begins to run. However, `SELECT` does see the effects of previous updates executed within its own transaction, even though they are not yet committed. Also note that two successive `SELECT` commands can see different data, even though they are within a single transaction, if other transactions commit changes after the first `SELECT` starts and before the second `SELECT` starts."*
> — [PostgreSQL 18 · 13.2.1](https://www.postgresql.org/docs/18/transaction-iso.html)

**The snapshot is per statement, not per transaction.** That last sentence is the whole character of the level: two reads in one transaction may disagree, so any decision computed from read A and applied by write B can be based on a state that no longer holds.

For writes, the rule from [07c](07c-the-lost-update.md) applies: a would-be updater waits for a concurrent updater, then *"the search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches"*. No error is raised. The statement quietly operates on the newer row, or on no row.

**What Read Committed prevents:** dirty reads. That is the complete list.

**What it permits, and what each looks like:**

| Anomaly | In SprintDesk terms |
|---|---|
| **Non-repeatable read** | Count the `doing` cards, then read them — the count and the list disagree |
| **Phantom read** | Count twice in one transaction and get different answers because a card was inserted |
| **Lost update across statements** | Read a card's `position`, compute a new one, write it — someone else wrote in between |
| **Serialization anomaly** | Two transactions each check a WIP limit and each insert, and together they exceed it |

## Repeatable Read — one snapshot for the whole transaction

> *"The Repeatable Read isolation level only sees data committed before the transaction began; it never sees either uncommitted data or changes committed by concurrent transactions during the transaction's execution. (However, each query does see the effects of previous updates executed within its own transaction, even though they are not yet committed.) This is a stronger guarantee than is required by the SQL standard for this isolation level, and prevents all of the phenomena described in Table 13.1 except for serialization anomalies."*
> — [PostgreSQL 18 · 13.2.2](https://www.postgresql.org/docs/18/transaction-iso.html)

And the sentence that defines *when* the snapshot is taken, which is not at `BEGIN`:

> *"This level is different from Read Committed in that a query in a repeatable read transaction sees a snapshot as of the start of the first non-transaction-control statement in the transaction, not as of the start of the current statement within the transaction. Thus, successive `SELECT` commands within a single transaction see the same data, i.e., they do not see changes made by other transactions that committed after their own transaction started."*

⚠️ **"The first non-transaction-control statement"** — `BEGIN` does not take the snapshot, and neither does `SET TRANSACTION ISOLATION LEVEL`. The first real query does. A transaction that opens, does some application work, and then queries has a snapshot from the query, not from the open.

Writes stop being silent and start failing:

> *"But if the first updater commits (and actually updated or deleted the row, not just locked it) then the repeatable read transaction will be rolled back with the message*
> ```
> ERROR:  could not serialize access due to concurrent update
> ```
> *because a repeatable read transaction cannot modify or lock rows changed by other transactions after the repeatable read transaction began."*

And the obligation that comes with it, which is [09d](09d-serialization-failures-and-the-retry-loop.md):

> *"Applications using this level must be prepared to retry transactions due to serialization failures."*

> *"Note that only updating transactions might need to be retried; read-only transactions will never have serialization conflicts."*

That last sentence is worth banking: **a read-only report at Repeatable Read needs no retry loop.** It is the cheapest correct use of the level and the one most worth adopting.

**What it prevents:** dirty reads, non-repeatable reads, phantom reads. In this implementation, all three.

**What it still permits — and the manual's example is the one people do not expect:**

> *"The Repeatable Read mode provides a rigorous guarantee that each transaction sees a completely stable view of the database. However, this view will not necessarily always be consistent with some serial (one at a time) execution of concurrent transactions of the same level. For example, even a read-only transaction at this level may see a control record updated to show that a batch has been completed but not see one of the detail records which is logically part of the batch because it read an earlier revision of the control record. Attempts to enforce business rules by transactions running at this isolation level are not likely to work correctly without careful use of explicit locks to block conflicting transactions."*

🔴 **"Attempts to enforce business rules … are not likely to work correctly"** is the sentence that decides when Repeatable Read is not enough. A WIP limit is a business rule. A uniqueness rule expressed in application code is a business rule. Those need Serializable, or an explicit lock, or a database constraint.

⚠️ Also worth knowing for anyone reading older material:

> *"Prior to PostgreSQL version 9.1, a request for the Serializable transaction isolation level provided exactly the same behavior described here. To retain the legacy Serializable behavior, Repeatable Read should now be requested."*

## Serializable — Repeatable Read plus a detector

> *"The Serializable isolation level provides the strictest transaction isolation. This level emulates serial transaction execution for all committed transactions; as if transactions had been executed one after another, serially, rather than concurrently. However, like the Repeatable Read level, applications using this level must be prepared to retry transactions due to serialization failures. In fact, this isolation level works exactly the same as Repeatable Read except that it also monitors for conditions which could make execution of a concurrent set of serializable transactions behave in a manner inconsistent with all possible serial (one at a time) executions of those transactions. This monitoring does not introduce any blocking beyond that present in repeatable read, but there is some overhead to the monitoring, and detection of the conditions which could cause a serialization anomaly will trigger a serialization failure."*
> — [PostgreSQL 18 · 13.2.3](https://www.postgresql.org/docs/18/transaction-iso.html)

**"Does not introduce any blocking beyond that present in repeatable read"** is the fact that surprises people who expect Serializable to mean table locks. The mechanism is predicate locking, which does not block:

> *"To guarantee true serializability PostgreSQL uses predicate locking, which means that it keeps locks which allow it to determine when a write would have had an impact on the result of a previous read from a concurrent transaction, had it run first. In PostgreSQL these locks do not cause any blocking and therefore can not play any part in causing a deadlock."*

The payoff, stated by the manual as a development property rather than a performance one:

> *"Consistent use of Serializable transactions can simplify development. The guarantee that any set of successfully committed concurrent Serializable transactions will have the same effect as if they were run one at a time means that if you can demonstrate that a single transaction, as written, will do the right thing when run by itself, you can have confidence that it will do the right thing in any mix of Serializable transactions, even without any information about what those other transactions might do, or it will not successfully commit."*

And the condition attached to that payoff, which is not optional:

> *"It is important that an environment which uses this technique have a generalized way of handling serialization failures (which always return with an SQLSTATE value of '40001'), because it will be very hard to predict exactly which transactions might contribute to the read/write dependencies and need to be rolled back to prevent serialization anomalies."*

🔴 **"a generalized way of handling serialization failures" means a retry loop.** Without one, Serializable is not safer than Read Committed — it is a different set of failures, delivered as 500s. That is [09d](09d-serialization-failures-and-the-retry-loop.md), and it is the reason this page cannot end here.

⚠️ One deployment caveat the manual raises and most summaries omit:

> *"This level of integrity protection using Serializable transactions does not yet extend to hot standby mode … or logical replicas. Because of that, those using hot standby or logical replication may want to use Repeatable Read and explicit locking on the primary."*
> — [PostgreSQL 18 · 13.4.1](https://www.postgresql.org/docs/18/applevel-consistency.html)

## Setting the level in Drizzle 0.45.2

Verified against the published typings:

```ts
interface PgTransactionConfig {
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable'
  accessMode?: 'read only' | 'read write'
  deferrable?: boolean
}
```

```ts
// a report that must see one consistent snapshot across several queries
const summary = await db.transaction(async (tx) => {
  const [{ total }] = await tx.select({ total: count() }).from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
  const byStatus = await tx.select({ status: cards.status, n: count() }).from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
    .groupBy(cards.status)
  return { total, byStatus }
}, { isolationLevel: 'repeatable read', accessMode: 'read only' })
```

**No retry loop is needed there**, and the manual is the authority: *"only updating transactions might need to be retried; read-only transactions will never have serialization conflicts."* That makes read-only Repeatable Read the one isolation upgrade that is free.

⚠️ `deferrable` is only meaningful in a specific combination — a read-only Serializable transaction — and it trades latency for never being aborted. Chapter 15 [01e](../15-databases-apis-and-full-stack-patterns/01e-the-http-driver-and-one-shot-queries.md) covers the option surface for the HTTP driver's own transaction API, which is spelled differently.

## Choosing, per operation

| Operation | Level | Why |
|---|---|---|
| A single-statement write | **Read Committed** (default) | The statement is atomic; nothing to isolate |
| A versioned update ([07d](07d-optimistic-concurrency-with-a-version-column.md)) | **Read Committed** | The `WHERE version = $2` predicate is the check; isolation adds nothing |
| Card move plus event row | **Read Committed** | Two writes, no read-then-decide between them |
| A multi-query report | **Repeatable Read, read only** | One snapshot; no retry loop required |
| Enforcing a WIP limit by counting then inserting | **Serializable + retry**, or Read Committed + a row lock | The manual: business rules "are not likely to work correctly" at Repeatable Read |
| A batch that reads and writes many rows | **Serializable + retry** | Exactly the case the manual's "simplify development" argument is about |

**The default answer is Read Committed, because almost every write in a CRUD API is one statement.** Raise the level when a transaction reads something, decides, and writes based on the decision — and when you raise it, you owe a retry loop unless the transaction is read-only.

## Gotchas

**★ Symptom: a textbook says Repeatable Read allows phantom reads, and your tests cannot produce one.** Cause: PostgreSQL's Repeatable Read is Snapshot Isolation and gives more than the standard requires — the manual states plainly that it "does not allow phantom reads". Fix: nothing to fix; update the mental model, and be careful with material written for other engines.

**★ Symptom: `default_transaction_isolation` was set to `serializable` and lost updates continued.** Cause: the read and the write are in different HTTP requests, so there is no transaction spanning them for any level to constrain. Fix: optimistic concurrency, which carries the check across the gap — [07d](07d-optimistic-concurrency-with-a-version-column.md). Isolation and cross-request staleness are different problems.

**★ Symptom: after switching an endpoint to Serializable, it started returning 500s under load.** Cause: serialization failures, which are the level's normal operating mode, surfacing as unhandled errors. Fix: a bounded retry loop around the whole transaction — [09d](09d-serialization-failures-and-the-retry-loop.md). Without it, raising the level made things worse, not better.

**★ Symptom: a report's total does not match the sum of its parts.** Cause: two `SELECT`s at Read Committed took separate snapshots, and a write committed between them. Fix: one `repeatable read` + `read only` transaction around the whole report, which costs nothing and needs no retry loop.

**★ Symptom: a WIP-limit check at Repeatable Read still lets two writers exceed the limit.** Cause: neither transaction wrote a row the other read, so there is nothing for snapshot isolation to conflict on — the manual warns that enforcing business rules at this level is "not likely to work correctly without careful use of explicit locks". Fix: Serializable with a retry loop, or Read Committed with an explicit lock on the parent row, which is the pattern in [07f](07f-pessimistic-locking-and-when-it-is-right.md).

**★ Symptom: a `repeatable read` transaction aborts with `could not serialize access due to concurrent update` on a plain `UPDATE`.** Cause: correct behaviour — at this level a transaction "cannot modify or lock rows changed by other transactions after the repeatable read transaction began", so it aborts rather than silently applying to the newer row as Read Committed would. Fix: retry the whole transaction. The manual's own instruction is to "abort the current transaction and retry the whole transaction from the beginning".

**★ Symptom: raising the isolation level on a read replica did not give the expected guarantee.** Cause: the manual states that Serializable protection "does not yet extend to hot standby mode … or logical replicas". Fix: run the transaction on the primary, or use Repeatable Read plus explicit locking on the primary, which is the manual's own recommendation.

**★ Symptom: `SET TRANSACTION ISOLATION LEVEL` appears to have no effect behind a pooler.** Cause: it is a session-level statement issued outside the transaction it was meant to affect, and behind a transaction pooler the session is not yours. Fix: pass `isolationLevel` in the transaction config so Drizzle emits it as part of `BEGIN`, rather than as a separate statement — and see ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md) for why session-scoped settings do not survive.

## Interview questions

**★ How many isolation levels does PostgreSQL implement, and what happens if you ask for Read Uncommitted?**
Three. You may request any of the four standard levels, but Read Uncommitted behaves as Read Committed — the manual says this is "the only sensible way to map the standard isolation levels to PostgreSQL's multiversion concurrency control architecture". There are no dirty reads to be had; MVCC never exposes an uncommitted row version to another transaction, so the level has nothing to offer.

**★ Is it true that Repeatable Read allows phantom reads?**
Not in PostgreSQL. The standard permits phantoms at that level, but PostgreSQL's implementation is Snapshot Isolation and the manual states explicitly that it "does not allow phantom reads", noting that higher guarantees than the standard requires are acceptable. What Repeatable Read still permits is serialization anomalies — the manual's own example is a read-only transaction seeing a control record marked complete without seeing all of its detail records.

**★ What does Serializable add over Repeatable Read, and what does it cost?**
Monitoring. The manual says it "works exactly the same as Repeatable Read except that it also monitors for conditions which could make execution of a concurrent set of serializable transactions behave in a manner inconsistent with all possible serial executions". The mechanism is predicate locking, which does not block — so the cost is not contention but monitoring overhead plus the restart cost of transactions aborted with a serialization failure. The obligation is a retry loop, which the manual calls "a generalized way of handling serialization failures".

**★ Why does raising the isolation level not fix the lost update in a REST API?**
Because there is no transaction spanning the client's read and the client's write. The `GET` is one request and the `PATCH` is another, seconds later, quite possibly on a different backend behind a pooler. Isolation constrains what happens within one transaction's lifetime, and the staleness lives in the gap between two of them. That gap can only be closed by the client carrying a token across it, which is what the version column and `If-Match` are.

**★ Which isolation upgrade is free, and why?**
Read-only Repeatable Read. The manual says "only updating transactions might need to be retried; read-only transactions will never have serialization conflicts", so a multi-query report wrapped in `repeatable read` with `read only` gets one consistent snapshot with no retry loop and no additional blocking. It is the cheapest correctness win available and it fixes the classic bug where a total does not match the sum of the rows beneath it.

**★ A colleague proposes setting `default_transaction_isolation = serializable` globally. What do you say?**
That it is a defensible position the manual itself suggests — "it may be a good idea to set `default_transaction_isolation` to serializable" — but only alongside a framework that automatically retries transactions rolled back with a serialization failure. Without that, every operation that would have quietly resolved at Read Committed now returns a 500 under contention, and you have traded silent anomalies for loud outages. The retry loop is the price of admission, not an optimisation.

**★ Where does Serializable not protect you?**
On hot standbys and logical replicas — the manual says the protection "does not yet extend" to them, and recommends Repeatable Read with explicit locking on the primary for deployments that rely on those. It also does nothing about anything outside the database: an external API call inside a serializable transaction is neither isolated nor rolled back, and a serialization failure means it may have happened twice.

---

← [09b · The tx rule](09b-the-tx-rule.md) · [Chapter 16 overview](01-explanation.md) · Next → [09d · Serialization failures and the retry loop](09d-serialization-failures-and-the-retry-loop.md)
