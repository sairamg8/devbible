---
title: "Every correctness fix in this chapter is paid for on the database, and the milestone is not complete until you can name the bill — the retry loop that consumes connections, the transaction that occupies one for its whole life, the predicate every read now carries, and the two pages of this chapter that appear to give you opposite caching advice"
sidebar_label: "13c · Milestone: what it costs"
sidebar_position: 92
description: "Transaction duration as pool occupancy and the classic outage, the serialization retry loop and what it may not contain, the tx-versus-db trap, soft delete's partial index and the planner rule that decides whether it is used, the N+1 on a card list, keyset over offset, and the no-store versus no-cache contradiction the chapter deliberately contains."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified in topics [06](06-read.md), [08](08-delete.md) and [09](09-transactions-and-multi-table-writes.md) of this chapter against the PostgreSQL 18 manual, RFC 9110 and RFC 9111. **It introduces no new claims of its own**; every quote is one already banked and sourced on the page named beside it.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node 24.20.0.

**[13b](13b-milestone-the-overlap-seams.md) closed six failures. Each fix has a price and the price is charged to the same resource: the pool. A retry loop needs a connection to retry on. A transaction holds one for its entire life whether it is working or waiting. A soft-delete predicate makes every read narrower and every index a decision. A collection endpoint that is safe from cache leakage is, written the obvious way, also a collection endpoint whose `ETag` can never fire. None of this argues against the fixes — it argues that a milestone which lists the fixes and not their costs has described half a system, and the missing half is the one that produces the outage.**

## Cost 1 · A transaction is one connection multiplied by its duration

The arithmetic is short enough to hold in your head and is the reason the classic outage happens. A pool has `max` connections. A transaction holds exactly one for its whole life. So your maximum concurrent transactions is `max`, full stop — and the number of *requests* you can serve is `max` divided by how long each transaction is open relative to your arrival rate. → [09f](09f-transaction-duration-as-pool-occupancy.md)

🔴 **Which makes the worst thing you can put inside a transaction a network call to somebody else's server.** You have handed a third party the ability to set your database's concurrency limit, and they will exercise it on a day you hear about from your users rather than from your alerts.

```ts
// 🔴 the classic outage
await db.transaction(async (tx) => {
  const card = await tx.insert(cards).values(input).returning(CARD_COLUMNS)
  await fetch('https://hooks.example.com/notify', {          // a stranger's latency,
    method: 'POST',                                          // now your pool's problem
    body: JSON.stringify(card),
  })
})
```

```ts
// ✅ the transaction commits the facts; the outbound call is a row somebody else drains
await db.transaction(async (tx) => {
  const [card] = await tx.insert(cards).values(input).returning(CARD_COLUMNS)
  await tx.insert(jobs).values({ kind: 'card.created', payload: { cardId: card.id } })
})
```

**That second block is also the chapter's one genuine superpower and not merely a workaround.** When the job lives in the same database as the write, the enqueue and the write are one atomic fact: if the transaction rolls back, the job was never enqueued; if the job exists, the write definitely committed. No external broker can participate in your database transaction, so a broker forces you to choose between enqueueing before the commit and possibly acting on a write that failed, or after it and possibly losing the job. That is structural, not a configuration problem. → [09g](09g-the-one-genuine-superpower.md)

**The related trap, which is invisible to the language, the linter and the test suite.** Inside `db.transaction(async (tx) => …)`, a query written against `db` instead of `tx` runs on a *different connection*, commits on its own, and survives the rollback. Both objects have the same methods and the same types, so nothing tells you. → [09b](09b-the-tx-rule.md)

```ts
await db.transaction(async (tx) => {
  await tx.update(cards).set({ status: 'done' }).where(eq(cards.id, cardId))
  await db.insert(auditLog).values({ cardId, action: 'completed' })   // 🔴 `db`, not `tx`
  throw new Error('boom')       // the card update rolls back; the audit row does not
})
```

## Cost 2 · The retry loop that buys correctness with connections

If you raise the isolation level, the database will abort transactions and expect you to run them again. That is not a fault report:

> *"When an application receives this error message, it should abort the current transaction and retry the whole transaction from the beginning. The second time through, the transaction will see the previously-committed change as part of its initial view of the database, so there is no logical conflict in using the new version of the row as the starting point for the new transaction's update."*
> — [PostgreSQL 18 · Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), banked in [09d](09d-serialization-failures-and-the-retry-loop.md)

and the responsibility is explicitly yours, not the server's:

> *"It is important to retry the complete transaction, including all logic that decides which SQL to issue and/or which values to use. Therefore, PostgreSQL does not offer an automatic retry facility, since it cannot do so with any guarantee of correctness."*
> — same page

🔴 **A Serializable transaction with no retry loop is not safer than Read Committed — it is differently broken.** You have paid for the level and converted a class of anomaly into a class of `500`. → [09d](09d-serialization-failures-and-the-retry-loop.md)

**The cost, and the reason this seam belongs on the cost page.** Every attempt occupies a connection. Under contention the manual warns the attempts are not bounded by anything comfortable:

> *"Transaction retry does not guarantee that the retried transaction will complete; multiple retries may be needed. In cases with very high contention, it is possible that completion of a transaction may take many attempts."*
> — same page

So the loop that fixes correctness competes for exactly the resource that is scarce during the incident that triggered it. Bound the attempt count, back off between attempts, and keep the retried body free of anything that is not a database statement — a retried outbound `fetch` is a duplicated side effect, and a retried in-memory accumulation is a corrupted one.

**And retry only what the manual says to retry.** `40001` unconditionally, `40P01` (`deadlock_detected`) advisedly. `23505` is a *conditional* case — the manual sanctions retrying a unique-key failure where the application picked the value after inspecting existing keys, which is exactly the `position` retry in [13b](13b-milestone-the-overlap-seams.md) — but warns that these *"might represent persistent error conditions rather than transient failures"*. A retry loop with a catch-all arm turns a permanently duplicate title into three attempts and the same failure, more slowly.

## Cost 3 · The predicate every read now carries

Adding `deleted_at` is not adding a column. It is adding a global invariant that nothing in your stack enforces: every `SELECT`, every `COUNT`, every join reaching the table, every export, and every dashboard query somebody writes against a replica six months from now must carry `deleted_at IS NULL`. The one that does not returns deleted rows and calls that a `200`. → [08b](08b-what-soft-delete-costs-every-read.md)

**And the index that stops the predicate being a scan comes with a rule that surprises people.** A partial index only helps if the planner can *see* that it applies:

> *"To be precise, a partial index can be used in a query only if the system can recognize that the WHERE condition of the query mathematically implies the predicate of the index. PostgreSQL does not have a sophisticated theorem prover that can recognize mathematically equivalent expressions that are written in different forms. … otherwise the predicate condition must exactly match part of the query's WHERE condition or the index will not be recognized as usable. Matching takes place at query planning time, not at run time. As a result, parameterized query clauses do not work with a partial index."*
> — [PostgreSQL 18 · Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html), banked in [08b](08b-what-soft-delete-costs-every-read.md)

```sql
CREATE INDEX cards_board_created_live_idx
    ON cards (board_id, created_at, id)
 WHERE deleted_at IS NULL;
```

🔴 **So the convenient "include deleted rows for admins" flag defeats the index by construction.** `WHERE ($2 OR deleted_at IS NULL)` cannot match at plan time, because the parameter's value is not known then. An admin view that needs deleted rows is a **different query**, not the same query with a boolean — and writing it as a boolean is the single most common way a partial index ends up existing and never being used.

**The last cost is the one people defer into permanence.** Soft delete without a retention job is a policy of never deleting anything, and every non-partial index and every sequential scan pays forever for rows nobody will read. Deciding the window when you add the column — `DELETE FROM cards WHERE deleted_at < now() - interval '90 days'` — is the difference between a design and a deferral.

## Cost 4 · The list endpoint

Two costs, and they compound because they hit the same endpoint.

**The N+1.** A card list that resolves each card's board, or assignee, or comment count with its own query issues one query plus one per row — and it is fastest in development, where the list has four rows and the database is on localhost. → [06f](06f-the-n-plus-1-on-a-card-list.md)

**The pagination.** `OFFSET` degrades with *depth*, not with page size: the database must produce and discard every row before the offset, so page 500 costs 500 pages of work to return one. Keyset pagination asks for *rows after this key* and costs the same at any depth — which is why the canonical schema carries a composite index on `(board_id, created_at, id)` rather than on `(board_id, created_at)`. The trailing `id` is what makes the sort key unique, and a non-unique cursor either skips rows or repeats them at page boundaries. → [06c](06c-offset-pagination-and-why-it-degrades.md), [06d](06d-keyset-pagination.md)

## Cost 5 · The two caching rules of this chapter that appear to contradict each other

This is the seam most worth noticing, because it is a real tension inside the chapter rather than a mistake, and [06g](06g-conditional-requests-and-etag.md) names it in its own title.

**[06e](06e-caching-a-collection.md) says:** a response behind an ownership predicate must never be `public`, because a shared cache keyed on the URL knows nothing about who is asking, and `GET /api/boards/{id}/cards` returns different authorised content to different callers at the same URL. Its recommendation for an authorised collection is `private, no-store`.

**[06g](06g-conditional-requests-and-etag.md) says:** `no-store` makes conditional requests dead code, and quotes the reason:

> *"The no-store response directive indicates that a cache MUST NOT store any part of either the immediate request or the response and MUST NOT use the response to satisfy any other request."*
> — [RFC 9111 §5.2.2.5](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.5), banked in [06g](06g-conditional-requests-and-etag.md)

If nothing may be stored, the client has no stored representation to validate, so it never sends `If-None-Match`, so your correct `ETag` implementation returns `200` on every request forever with nothing in any log to explain it.

**Both are right and the resolution is that they answer different questions.** `no-store` answers *"may anything keep this?"* and `no-cache` answers *"may anything serve this without asking me?"* — the directive that means *keep it, but always revalidate* is `private, no-cache`. So:

| The endpoint | Header | Because |
|---|---|---|
| An authorised collection you will never revalidate | `private, no-store` | Nothing keeps it; no leak is possible; no `ETag` will ever fire |
| An authorised item you want `304`s on | `private, no-cache` | The client's own cache keeps it, no shared cache may serve it, and every request revalidates |
| Anything at all | never `public` | The URL does not determine the body once a predicate gates it |

🔴 **Choosing `no-store` and then implementing `ETag` is the failure**, and it is silent in both directions: the caching works, the conditional requests do not, and neither produces a log line.

## Gotchas

**★ Symptom: latency climbs across every endpoint whenever one third-party integration is slow.** Cause: an outbound `fetch` inside a transaction, so their p99 is your connection hold time and your pool drains. Fix: the transaction commits facts only — insert a job row and let a worker make the call, which is also the pattern that makes the enqueue atomic with the write.

**★ Symptom: a transaction rolled back and one of its writes is still there.** Cause: that statement was written against `db` instead of `tx` inside the callback, so it ran on a different connection and committed independently. Fix: nothing inside a `transaction` callback may reference the outer client. It cannot be caught by types — both objects have the same shape — so it needs a lint rule or a review habit.

**★ Symptom: switching to Serializable produced a new class of 500 and no new safety.** Cause: the level was raised without a retry loop, so `40001` — which is an instruction to run the transaction again — was rendered as a server error. Fix: the bounded loop from [09d](09d-serialization-failures-and-the-retry-loop.md), retrying the *whole* transaction including the logic that decides which SQL to issue, because the manual is explicit that partial retries cannot be guaranteed correct.

**★ Symptom: the retry loop made an incident worse.** Cause: every attempt occupies a connection, so under contention the loop competes for the resource that is already exhausted. Fix: bound the attempts, back off between them, and make sure the loop body is nothing but database statements — a retried outbound call is a duplicated side effect.

**★ Symptom: a permanently duplicate title takes three times as long to fail.** Cause: the retry loop has a catch-all arm rather than an allow-list of SQLSTATEs. Fix: retry `40001` unconditionally, `40P01` advisedly, and `23505` only for the specific constraint where the application chose the value itself — the manual warns these codes *"might represent persistent error conditions rather than transient failures"*.

**★ Symptom: a dashboard, an export or a replica query shows deleted cards.** Cause: `deleted_at IS NULL` is an invariant no mechanism enforces, and the query that omits it is valid SQL returning extra rows. Fix: push it somewhere it cannot be forgotten — the DAL is the first line, a view is stronger, and row-level security is the only one that cannot be bypassed. Ranked with their costs in [08b](08b-what-soft-delete-costs-every-read.md).

**★ Symptom: you added the partial index and plans ignore it.** Cause: the query's `WHERE` does not syntactically imply the index predicate — usually because the live/deleted flag was parameterised, or the condition was written as `NOT (deleted_at IS NOT NULL)`. Fix: the literal `deleted_at IS NULL` in the query text, and a separate query for the admin view rather than a bound boolean. Matching happens at plan time, when the parameter's value does not exist.

**★ Symptom: the table grows forever and every scan gets slower.** Cause: soft delete shipped without a retention policy, so nothing is ever removed. Fix: a scheduled hard delete past the window, which is why `deleted_at` is a timestamp rather than a boolean.

**★ Symptom: the card list is instant in development and unusable in production.** Cause: an N+1 — one query per row, against a database that is no longer on localhost and a list that is no longer four rows. Fix: one query with a join or a batched second query keyed on the collected ids, per [06f](06f-the-n-plus-1-on-a-card-list.md).

**★ Symptom: page 1 is fast, page 400 times out, and page size is not the variable.** Cause: `OFFSET` makes the database produce and discard every preceding row, so cost scales with depth. Fix: keyset pagination on `(created_at, id)` — and the trailing `id` is not decoration, it is what makes the cursor unique so rows are neither skipped nor repeated at a boundary.

**★ Symptom: `ETag` is implemented correctly and no client ever sends `If-None-Match`.** Cause: `Cache-Control: no-store`, which forbids storing any part of the response, so there is nothing to validate. Fix: `private, no-cache` — *keep it, but always ask me* — which is the directive people mean when they write `no-store`.

**★ Symptom: one team member's board appears in another person's browser.** Cause: `Cache-Control: public` on a response the ownership predicate gates, so a shared cache keyed on the URL served it to the next caller. Fix: never `public` on anything behind a predicate. A response is only safely `public` when the URL alone determines the body, which an authorised resource by definition is not.

**★ Symptom: the milestone is "done" and nobody can say what it costs per request.** Cause: the fixes were adopted individually and their bills were never added up. Fix: for each of them name the resource it consumes — connections for the retry loop and for transaction duration, index size and query rigidity for the partial index, one extra round trip for the batched list. The acceptance questions in [13d](13d-milestone-acceptance-and-hand-off.md) ask for exactly this.

## Interview questions

**★ What is the real cost of a transaction, and why is it not CPU?**
It is one pooled connection multiplied by wall-clock duration, and it is charged whether the transaction is working or waiting. A pool has `max` connections and a transaction holds exactly one for its whole life, so `max` is a hard ceiling on concurrent transactions, and the number of requests you can serve follows from that ceiling divided by how long each transaction stays open. This is why duration matters more than complexity: a transaction doing three fast writes costs almost nothing, and a transaction doing one fast write and then waiting 800 ms on somebody else's HTTP endpoint costs a connection for 800 ms. Multiply that by your arrival rate and a third party's latency becomes your database's concurrency limit.

**★ Why does a query written against `db` inside a `db.transaction` callback not participate in the transaction, and why is that so hard to catch?**
Because `tx` is a handle bound to the one connection the transaction is running on, and `db` is the pool — asking the pool for a connection inside the callback gives you a *different* backend, which has its own implicit transaction and commits on its own. The reason it is hard to catch is that both objects expose the same methods and the same types, so there is no type error, no lint error by default and no runtime warning; the only symptom is that a rollback leaves one write behind, and rollbacks are rare enough in testing that the bug ships. It is one of the few defects in this chapter that a reviewer can catch by eye, which is why it is worth naming the rule out loud: inside the callback, nothing references the outer client.

**★ Why does PostgreSQL not retry serialization failures for you?**
Because it cannot know what to retry. The manual says it directly — retrying must include *"all logic that decides which SQL to issue and/or which values to use"*, so a correct retry is a re-execution of your application's decision-making, not a re-execution of the statements it happened to emit last time. The database has only the statements. If it replayed them it would replay decisions made against a snapshot that has since been invalidated, which is precisely the anomaly the isolation level exists to prevent. The consequence for you is that the loop belongs at the outermost boundary of the transaction, wrapping the code that chooses the values, and that anything non-transactional inside that boundary will be executed more than once.

**★ A partial index exists and the planner will not use it. What did you write?**
Almost certainly a parameter where a literal was needed. Partial index matching happens at *planning* time and requires the query's `WHERE` to syntactically imply the index predicate, and the manual says plainly that PostgreSQL has no theorem prover for equivalent expressions written differently — so `WHERE ($2 OR deleted_at IS NULL)`, the "include deleted for admins" convenience, cannot match, because at plan time `$2` has no value. The same applies to `NOT (deleted_at IS NOT NULL)`, which is logically identical and syntactically not. The fix is to stop treating "include deleted" as a parameter of one query and treat it as a second query, which is also the honest description of what it is.

**★ Why does the canonical index end in `id` when the sort is by `created_at`?**
Because a keyset cursor has to be unique or it is not a cursor. If two cards share a `created_at` — and they will, because rows created in the same transaction or the same millisecond do — then "everything after this timestamp" either skips the second row or returns it again on the next page, depending on which side of the comparison you put the boundary. Adding `id` as a tiebreaker makes the sort key a total order, so `(created_at, id) > (cursorCreatedAt, cursorId)` names exactly one position in the sequence. The index has to carry the same trailing column, or the database can seek to the timestamp and then has to sort within it.

**★ Two pages of this chapter recommend `no-store` and `no-cache` for the same-looking endpoint. Which is wrong?**
Neither — they are answering different questions and the endpoints are not the same. `no-store` says nothing may keep any part of the response, which is the right answer for an authorised collection you never intend to revalidate, because it makes leakage through any cache impossible. `no-cache` says a cache may keep it but may not serve it without revalidating, which is the right answer for an item endpoint where you want `304`s, and combining it with `private` keeps it out of shared caches. The failure is choosing `no-store` and then implementing `ETag`, because the client is forbidden from storing the representation your validator exists to validate — and both halves keep working, so nothing complains. If you want conditional requests, the directive is `private, no-cache`.

**★ Why is an outbound HTTP call inside a transaction worse than a slow query inside one?**
Because you control the query and you do not control the call. A slow query is bounded by your data, your indexes, your `statement_timeout` and your own ability to fix it; a call to a third party is bounded by their availability, and their bad day arrives without warning and without a deploy on your side. It is also the shape that scales in the wrong direction: as your traffic rises, more transactions are simultaneously parked on their latency, so the failure appears at exactly the moment the product is succeeding. And because the transaction is holding a connection the whole time, the blast radius is not that endpoint — it is every endpoint, since they all draw from the same pool.

**★ Why is enqueueing a job inside the transaction the one thing a database queue does that a broker cannot?**
Because the enqueue and the write become a single atomic fact. If the transaction rolls back, the job was never enqueued; if the job row exists, the write definitely committed. An external broker cannot join your database transaction, so it forces a choice between enqueueing before the commit — and possibly acting on a write that never landed — or after it, and possibly losing the job because the process died in the gap. Retries do not fix this; it is a property of having two systems that cannot agree on a commit point. Every operational feature a real broker offers is a convenience by comparison, because it makes a class of problem easier to survive rather than removing it.

---

← [13b · The overlap seams](13b-milestone-the-overlap-seams.md) · [Chapter 16 index](01-explanation.md) · Next → [13d · Acceptance and hand-off](13d-milestone-acceptance-and-hand-off.md)
