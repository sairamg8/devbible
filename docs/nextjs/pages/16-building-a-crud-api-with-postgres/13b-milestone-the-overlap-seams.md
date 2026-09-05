---
title: "The overlap seams — five failures that need two requests to appear, all of which answer 200 or 201, plus the one envelope that has to render every one of them twice because a Route Handler has a status code and a Server Action does not"
sidebar_label: "13b · Milestone: the overlap seams"
sidebar_position: 69
description: "The lost update and why 412 and 409 are different answers, position collisions on concurrent creates, the retried POST, the delete that races a patch, why a transaction cannot span the interval, and the single error envelope rendered two ways without leaking a driver error."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified in topics [05](05-create.md), [07](07-update.md), [08](08-delete.md), [09](09-transactions-and-multi-table-writes.md) and [10](10-errors-and-one-response-shape.md) of this chapter against RFC 9110, the IETF Idempotency-Key draft, the PostgreSQL 18 manual and the Next.js documentation. **It introduces no new claims of its own**; every quote is one already banked and sourced on the page named beside it.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · `pg` **8.23.0** · Node 24.20.0.

**The chapter's thesis is that CRUD is easy until two requests overlap, and this is the page where that is cashed out. Every failure below requires two requests to exist, none of them requires two requests to be *simultaneous* in any interesting sense — a few hundred milliseconds is plenty — and every single one of them returns a success code. There is no log line, no alert, no failed test and no stack trace. A team can run this API for a year, lose an edit a week, and file it under "the board is a bit flaky sometimes". The seams below are the ones you have to demonstrate closed, because absence of a bug report is not evidence when the bug has no reporter.**

## Seam 4 · Two people drag the same card

**The failure.** Two clients `GET` the same card, both edit, both `PATCH`. Two `200`s. One edit no longer exists, and neither user is told.

**The mechanism, and PostgreSQL is behaving exactly as documented while it happens.** Read Committed is the default:

> *"Read Committed is the default isolation level in PostgreSQL. When a transaction uses this isolation level, a `SELECT` query (without a `FOR UPDATE/SHARE` clause) sees only data committed before the query began; it never sees either uncommitted data or changes committed by concurrent transactions during the query's execution."*
> — [PostgreSQL 18 · Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), banked in [09c](09c-isolation-levels-in-postgresql-18.md)

Both reads are correct. Both writes are correct. The interleaving is what is wrong, and no isolation level fixes it, because the two requests are not in one transaction — there is a human being between the read and the write. → [07c](07c-the-lost-update.md)

**The check.** The `version` column, the extra clause, and the affected-row count. There is no lock, no retry and no held transaction: the conflict test and the write are one statement.

```ts
// lib/dal/cards.ts — the whole of optimistic concurrency
const updated = await db
  .update(cards)
  .set({ title: input.title, version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
  .where(and(
    eq(cards.id, cardId),
    eq(cards.version, expectedVersion),   // ← the entire mechanism
    isNull(cards.deletedAt),              // ← 08b: writes carry the guard too
    ownedByCaller(userId),                // ← 04c: the predicate, still in the WHERE
  ))
  .returning(CARD_COLUMNS)

if (updated.length === 0) {
  // Zero rows means one of FOUR things and you must disambiguate before answering.
  throw await explainZeroRows(cardId, userId, expectedVersion)
}
```

🔴 **Zero affected rows is not one outcome, it is four**, and answering the wrong one is a bug of its own: the card never existed, the card is not yours, the card is soft-deleted, or somebody else wrote first. The first three are `404` by the disclosure decision in [11](11-ownership-on-the-api-surface.md); only the fourth is a conflict. A handler that maps "zero rows" straight to `409` tells a stranger that a card they cannot see exists.

**And the code you return for the fourth case depends on how the client asked.** This is the distinction most APIs get wrong:

> *"If-Match is most often used with state-changing methods (e.g., POST, PUT, DELETE) to prevent accidental overwrites when multiple user agents might be acting in parallel on the same resource (i.e., to prevent the 'lost update' problem)."*

> *"An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false."*
> — [RFC 9110 §13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html), banked in [07e](07e-etag-if-match-and-412.md)

`412` is the answer to a precondition **the client sent** and the server found false. `409` is the answer to a conflict the client never conditioned on. They are different answers to different questions, and client retry logic branches on them — *"re-read and re-apply my change"* is right for one and meaningless for the other. Sending `409` for a failed `If-Match` is not a smaller mistake than sending `200`. → [07e](07e-etag-if-match-and-412.md)

## Seam 5 · Two creates at the same instant, and the board starts shuffling

**The failure.** Two cards are created on one board within the same moment. Both succeed. Both land on the same `position`, and from then on the board's order changes between page loads. The bug report says the board *"shuffles sometimes"* — which is nobody's idea of a concurrency bug, so it is triaged as a UI problem.

**The mechanism.** `position` is the only column in the canonical table that is `NOT NULL`, has no default, and is not supplied by the client on a normal create. Something has to invent it, and the obvious invention — read `max(position)`, add one — is a read-modify-write across two statements. Under Read Committed the second request reads exactly the same maximum as the first, because the first has not committed. Nothing errors. → [05ea](05ea-the-position-value-and-concurrent-creates.md)

**The check, and the part that is easy to get wrong.** Collapsing the read and the write into one `INSERT … SELECT max(position) + 1024` is a genuine improvement and **does not close the race** — it narrows the window from two round trips to one statement, which is a constant factor. A design that treats it as atomic produces duplicates at exactly the traffic level where it matters. What actually closes it is one of three, and you must pick deliberately:

```sql
-- 1 · make the race an error you can retry
CREATE UNIQUE INDEX cards_board_position_unique
  ON cards (board_id, position)
  WHERE deleted_at IS NULL;
```

The loser now gets `23505` and a **bounded** retry keyed on that one constraint name recomputes the maximum against a fresh snapshot and converges. Keying the retry on `23505` generally instead of on the constraint would loop three times on a duplicate-title violation and still fail. The cost is that two cards may never share a position, so every drag-reorder that would transiently create a tie needs its own handling.

```ts
// 2 · serialise position assignment per board — transaction-scoped, never session-scoped
await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${boardId}))`)
```

🔴 **`pg_advisory_xact_lock`, not `pg_advisory_lock`.** Session-level advisory locks do not survive a transaction-mode pooler — the seam from [03d](03d-what-does-not-survive-the-pooler.md) reappearing as a security-shaped bug. The session variant works in development and silently protects nothing in production.

The third option is to stop asking for a total order at all and use a fractional index — `(before + after) / 2` for an insertion, seeded with wide gaps so `1024` steps rather than `1, 2, 3` leave room to insert. That is the right shape when the product need is *drop this card between those two* rather than *append*. → [07g](07g-position-collisions-and-updatedat.md)

**And the second column on that page matters as much.** `updatedAt` must be the database's clock — `now()` in the `SET` clause, not `new Date()` in your process. A timestamp produced by whichever instance handled the request is worthless as an audit field and actively dangerous as a concurrency signal, because two instances' clocks disagree and the ordering you derive from them is fiction.

## Seam 6 · The POST that was retried

**The failure.** A phone changes cell tower mid-request; a serverless function is killed at its timeout *after* the insert committed; a user taps the button twice because the first tap produced no visible change. The client has sent a create and does not know whether it happened. There are now two identical cards, or the user is staring at an error for a card that exists.

**The mechanism.** `POST` is not idempotent, and the specification has already ruled out every automatic recovery:

> *"A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied."*

> *"A proxy MUST NOT automatically retry non-idempotent requests. A client SHOULD NOT automatically retry a failed automatic retry."*
> — [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), banked in [05d](05d-idempotency-keys-for-a-retried-post.md)

So the only place a safe retry can be built is your table. → [05d](05d-idempotency-keys-for-a-retried-post.md)

**The check.** A client-supplied key, a unique index, and a replay path:

> *"An idempotency key is a unique value generated by the client which the resource uses to recognize subsequent retries of the same request. The `Idempotency-Key` HTTP request header field carries this value."*

> *"The idempotency key MUST be unique and MUST NOT be reused with another request with a different request payload."*
> — [draft-ietf-httpapi-idempotency-key-header-07](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.txt), banked in [05d](05d-idempotency-keys-for-a-retried-post.md)

🔴 **The replay path cannot use `RETURNING`.** `ON CONFLICT DO NOTHING` returns nothing on the conflicting row — *"Only rows that were successfully inserted or updated will be returned"* ([PostgreSQL 18 · INSERT](https://www.postgresql.org/docs/18/sql-insert.html)) — so a create that replays must fall through to an explicit `SELECT` on the key. A handler written as insert-and-return will answer the retry with an empty result and a `500`, which is the worst possible outcome: the card exists and the client has been told the operation failed, so it will retry again.

**Three operational decisions the key column cannot make for you**, all in [05da](05da-scoping-expiry-and-the-records-table.md): the key must be scoped (a globally unique key space is an enumerable one), it must expire (a promise to remember every key forever is one you cannot keep), and the record must live **in the same database as the row it protects** — a shared cache with TTL eviction can drop the record while the row persists, producing a duplicate at an arbitrary later time, and an in-memory map is per-instance and sees nothing after a retry is routed elsewhere.

## Seam 7 · The delete that races a patch

**The failure.** A card is deleted while another user is mid-edit. Depending on which guard you forgot, either the patch silently resurrects a deleted card, or the card ends up with an `updated_at` newer than its `deleted_at` — a state that makes no sense and that nothing will ever flag.

**The mechanism.** Both orders are safe *if every write carries the guard*. Under Read Committed the second writer waits on the first's row lock and then re-evaluates its own `WHERE`. If the soft delete won, the patch's `deleted_at IS NULL` no longer matches, it affects zero rows, and it answers `404` — correctly, because the card the user was editing is gone. → [08d](08d-status-codes-and-idempotency.md)

🔴 **The failure case is a patch without `deleted_at IS NULL`.** That is why [08b](08b-what-soft-delete-costs-every-read.md) insists on the predicate for **writes** and not only for reads, which is the half everybody drops.

**And the replay decision underneath it.** `DELETE` is defined as idempotent:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request. Of the request methods defined by this specification, PUT, DELETE, and safe request methods are idempotent."*
> — [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html), banked in [08d](08d-status-codes-and-idempotency.md)

The specification is unambiguous about the success code and deliberately silent about the *repeat*, so the choice is yours and it must be made once: `204` is the goal-state reading, `404` is the resource reading. The chapter takes `204`, and the reason is not purity — it is that every retry mechanism in the world will replay your `DELETE`, and `404` turns a successful outcome into an error your client has to special-case.

## Seam 8 · The transaction somebody wants to hold open

**The failure.** A colleague proposes opening a transaction when the user starts editing, holding it while they type, and committing on save. It is a clean model borrowed from a desktop application with one persistent connection, and it is impossible three times over in a serverless HTTP API.

**The mechanism.** Only the first reason is about the database, and the manual states it as advice rather than as an error, which is why nothing stops you:

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or row-level lock will wait indefinitely for conflicting locks to be released. This means it is a bad idea for applications to hold transactions open for long periods of time (e.g., while waiting for user input)."*
> — [PostgreSQL 18 · 13.3.5](https://www.postgresql.org/docs/18/explicit-locking.html), banked in [09e](09e-a-transaction-cannot-span-an-http-boundary.md)

The other two — a transaction is bound to one connection that a pooler will not keep for you, and a serverless instance can be frozen or replaced between two requests — are in [09e](09e-a-transaction-cannot-span-an-http-boundary.md).

**The check is that you never wanted it.** Optimistic concurrency exists *because* the interval between a client's read and its write cannot be locked. If you have implemented seam 4, this seam is already closed and the correct response to the proposal is to point at the `version` column.

## The envelope that renders all of this twice

Every seam above produces a non-2xx outcome, and each has to be said in two languages, because the two doors from [13](13-project-milestone-sprintdesk-cards-api.md) are not the same kind of thing. **A Route Handler has a status line, which is the only part of your failure that generic infrastructure understands** — a CDN, a load balancer, a retry policy and a dashboard all read the number and none of them reads your body. **A Server Action has no status line at all**; it returns a value into a React render, and `500` is not a thing it can say.

🔴 **The mistake is letting the service layer pick.** A DAL that throws a `Response`, or returns `{ status: 409 }`, has decided that HTTP is the only caller it will ever have — and the Server Action importing it now has to parse an HTTP status out of an in-process function call.

```
DAL ─── throws a domain failure (kind + publicMessage + details + cause) ───┐
                                                                            ├─ toHttpResponse()  → 409 + envelope
                                                                            └─ toActionResult()  → { ok: false, … }
```

The service layer describes *what went wrong*. The entry point decides *how to say it*. That is the same argument the DAL makes about authorization, applied to failure. → [10](10-errors-and-one-response-shape.md)

**And one field never crosses the wire.** A Postgres error carries the constraint name, which carries your column names; it carries the table; and `detail` often carries the offending *value* — which in a multi-tenant table is a row the caller has no right to know about, turning a duplicate-key error into an existence oracle. Nobody decides to return one. It arrives through the path with no `catch`, or through a `JSON.stringify(err)` left over from a debugging session. → [10b](10b-never-leak-a-driver-error.md)

🔴 **The version-specific trap that makes every mapper silently wrong.** `drizzle-orm` **0.45.2** wraps every query failure, so the `pg` `DatabaseError` — with its `code`, `constraint`, `table` and `detail` — is on `error.cause`, not on `error`. A mapper written against `pg` and ported without re-reading the wrapper matches nothing, falls through to the default arm, and returns `500` for every constraint violation while looking completely correct in review. Worse, the wrapper's `message` is built from **the SQL text and the bound parameters**, so logging `err.message` writes user-supplied values into your logs and forwarding it hands an attacker your schema one failed request at a time. Walk the `cause` chain rather than unwrapping one fixed level, and identify the real error by the *shape* of its `code` — five characters of digits and uppercase letters — rather than by its presence, since Node's own `ECONNREFUSED` and `ETIMEDOUT` also carry a `code`. → [05c](05c-constraint-violations-and-sqlstate.md)

⚠️ **This behaviour is not in any documented Drizzle contract.** [05c](05c-constraint-violations-and-sqlstate.md) established it by reading the shipped `errors.js` and `pg-core/session.js` for 0.45.2 specifically, which means a minor bump can change it, no type will complain, and the regression is silent. Pin the exact version and put the unwrap behind a test that asserts on the wrapper shape.

## Gotchas

**★ Symptom: two users edit a card, both get `200`, and one edit is gone.** Cause: last-write-wins, which is what an `UPDATE` with no version predicate does, and every layer behaved correctly. Fix: the `version` clause in the `WHERE` and a check of the affected-row count — shown in full above. There is no configuration or isolation level that substitutes for it, because the two requests are not in one transaction.

**★ Symptom: zero affected rows is reported as `409` and a stranger learns a card exists.** Cause: the handler treated "the write matched nothing" as one outcome when it is four — absent, not yours, soft-deleted, or version-stale. Fix: disambiguate with a follow-up query before choosing a code, and map the first three to `404` per the disclosure decision in [11](11-ownership-on-the-api-surface.md).

**★ Symptom: a client that sent `If-Match` receives `409` and its retry logic does nothing useful.** Cause: the handler collapsed both conflict shapes into one code. Fix: `412` when a precondition the client sent evaluated false, `409` when the conflict is one the client never mentioned. The RFC requires the server to *"NOT perform the requested method"* in the first case, so the two are not even the same event.

**★ Symptom: the board's card order changes between page loads.** Cause: two concurrent creates read the same `max(position)` under Read Committed and both wrote it. Fix: one of the three remedies in seam 5 — a partial unique index plus a constraint-keyed bounded retry, a `pg_advisory_xact_lock` on the board, or a fractional index. Collapsing the read and write into one statement is *not* one of the three.

**★ Symptom: the advisory lock works locally and duplicate positions appear in production.** Cause: `pg_advisory_lock` is session-scoped and a transaction-mode pooler does not preserve the session between statements. Fix: `pg_advisory_xact_lock`, which is released by `COMMIT` or `ROLLBACK` and is therefore compatible with transaction pooling — and cannot be leaked by a handler that returns early.

**★ Symptom: `updatedAt` values are out of order and an audit query returns nonsense.** Cause: the timestamp was produced by `new Date()` in whichever instance served the request, and instance clocks disagree. Fix: `now()` in the `SET` clause. The database's clock is the only one all writers share.

**★ Symptom: a user taps create twice and gets two cards.** Cause: `POST` is not idempotent and nothing recorded that the first attempt had already been applied. Fix: an `Idempotency-Key` header, a unique index on the scoped key, and a replay path — and note that RFC 9110 forbids proxies from retrying `POST` automatically precisely because there is no safe general recovery, so this cannot be pushed down to infrastructure.

**★ Symptom: a retried create returns `500`, so the client retries again.** Cause: the replay path used `ON CONFLICT DO NOTHING … RETURNING`, and PostgreSQL returns only *"rows that were successfully inserted or updated"* — so the conflicting row came back as nothing and the handler treated an empty result as a failure. Fix: on zero returned rows, fall through to an explicit `SELECT` on the idempotency key and return the original representation.

**★ Symptom: duplicates appear days after the idempotency layer shipped, with no pattern.** Cause: the idempotency record lives in a shared cache with TTL eviction, so it disappeared while the card persisted. Fix: the record goes in the same database as the row, in the same transaction. A cache may front the lookup as an optimisation; it can never be the thing that enforces uniqueness.

**★ Symptom: a card exists with `updated_at` later than its `deleted_at`.** Cause: the patch statement carried no `deleted_at IS NULL` guard, so it wrote to a row a concurrent delete had already tombstoned. Fix: every write carries the guard, not only every read. This is the half of [08b](08b-what-soft-delete-costs-every-read.md) that gets dropped, because "soft delete affects reads" is the sentence people remember.

**★ Symptom: a client's automatic retry of `DELETE` produces a `404` its error handler escalates.** Cause: the repeat-delete answer was chosen by copying a previous endpoint rather than decided. Fix: pick `204` for the replay and document it in the contract. `DELETE` is defined as idempotent, every retry layer in the stack will replay it, and `404` converts a success into an error the client must special-case.

**★ Symptom: a Server Action failure blanks the form and renders `error.tsx`.** Cause: the Action threw. A thrown error in an Action is an error *boundary*, not an error *message*, and the user loses everything typed. Fix: catch at the Action boundary and return the failure as a value through `toActionResult`, exactly as the wiring in [13](13-project-milestone-sprintdesk-cards-api.md) does.

**★ Symptom: every constraint violation returns `500` and the mapper looks correct in review.** Cause: `drizzle-orm` 0.45.2 throws its own wrapper, so `error.code` is `undefined` and every `switch` arm misses. Fix: walk the `cause` chain and test the code's shape rather than its presence. Do not unwrap one fixed level — a transaction helper can add a second wrapper.

**★ Symptom: production logs contain card titles, user emails and full SQL statements.** Cause: something logged the Drizzle wrapper's `message`, which is built from the query text and the bound parameters. Fix: log the structured fields of the unwrapped driver error and never the wrapper's message — and never any message in a response body.

## Interview questions

**★ Why can no isolation level fix the lost update in this API?**
Because the two requests are not in one transaction. A user reads a card, thinks about it for forty seconds, and writes — the interval spans an HTTP boundary, and there is no transaction alive across it to isolate. Read Committed, Repeatable Read and Serializable all describe what a transaction sees relative to other transactions; here each request's transaction is short, correct, and entirely unaware that the value it is overwriting was read by somebody else in a different transaction that has long since committed. The fix has to be a value the client carries between the two requests, which is what `version` and `If-Match` are, and this is precisely why optimistic concurrency exists rather than being a weaker substitute for locking.

**★ Your `UPDATE` affected zero rows. What do you return?**
Not yet decided — zero rows is four different facts and you have to find out which. The card may never have existed, it may exist but belong to a team the caller is not on, it may be soft-deleted, or somebody may have written first so the version predicate missed. The first three all answer `404`, because the chapter deliberately refuses to distinguish "gone" from "not yours". Only the fourth is a conflict, and *its* code depends on how the client asked: `412` if they sent `If-Match` and the precondition was evaluated false, `409` if they never conditioned on anything. A handler that skips the disambiguation and returns `409` for all four has built an existence oracle out of a concurrency check.

**★ Why is 412 not interchangeable with 409?**
Because they answer different questions, and the client's recovery differs. `412` says *"the condition you attached to this request was false, so I did not perform the method"* — the RFC's requirement is explicit that the server MUST NOT perform it — which tells a client that its own stated assumption is stale and that re-reading and re-applying is the correct move. `409` says the current state of the resource is incompatible with the request, with no reference to anything the client asserted; the client may have no idea what to re-read. Collapsing them means every client has to guess, and the guess is usually "retry blindly", which is how a failed precondition becomes an overwrite.

**★ Why doesn't `INSERT … SELECT max(position) + 1024` close the position race?**
Because it narrows the window rather than removing it. Under Read Committed the statement takes its own snapshot and does not see another transaction's uncommitted insert, so two statements running at the same moment still compute the same maximum. What changed is the size of the window — from two network round trips with application code holding a stale value across an `await`, down to the duration of one statement. That is a large constant-factor improvement and worth doing, and it is also the most dangerous kind of partial fix, because it converts a reliable failure into an intermittent one that only reproduces at the traffic level where it matters most.

**★ What breaks if you use `pg_advisory_lock` instead of `pg_advisory_xact_lock` behind a pooler?**
Everything, silently. A session-level advisory lock is held by the *session*, and a transaction-mode pooler gives you a backend for the duration of a transaction and no longer — so the lock may be taken on one backend and the protected work done on another, or the lock may leak on a backend returned to the pool. In development, where you are on a direct connection with one process, it works perfectly. In production it protects nothing and there is no error to see. The transaction-scoped variant is released by `COMMIT` or `ROLLBACK`, which is exactly the unit the pooler preserves, so it is the only one compatible with the connection you actually have.

**★ Why can the idempotency replay path not use `RETURNING`?**
Because PostgreSQL documents that `RETURNING` on an `INSERT … ON CONFLICT DO NOTHING` gives back only *"rows that were successfully inserted or updated"*, and the whole point of the replay case is that no row was inserted. So the natural one-statement implementation returns an empty array on precisely the code path idempotency exists to serve, and a handler that treats empty as failure answers a retry with a `500` — after which the client, which still does not know whether its card was created, retries again. The correct shape is: attempt the insert, and if nothing came back, `SELECT` on the idempotency key and return the original representation with the original status.

**★ Why must the idempotency record live in the same database as the card?**
Because the guarantee is atomicity between "the card exists" and "we remember creating it", and two systems cannot give you that. A shared cache with TTL eviction can drop the record while the card persists, which produces a duplicate at some arbitrary later time with no correlation to anything — the worst debugging experience in this chapter. An in-memory map is per-instance, so a retry routed to a different instance sees nothing at all. A cache in front of the database lookup is a fine optimisation, but the uniqueness must be enforced by a unique index in the same transaction as the insert.

**★ Somebody proposes holding a transaction open while the user edits. Give three reasons it cannot work.**
The manual says not to, and says why: a lock request *"will wait indefinitely"*, so a transaction held while waiting for user input can block every other writer for as long as the user leaves the tab open — and there is no timeout unless you set one. A transaction is bound to a single connection, and a transaction-mode pooler hands out a backend per transaction, so there is no stable connection to hold across two requests even if you wanted one. And a serverless instance can be frozen, replaced or scaled to zero between the read request and the write request, so the process holding the transaction may not exist when the save arrives. Any one is decisive; together they are the reason optimistic concurrency is the design rather than a compromise.

**★ Why must the DAL not know what status code its failure maps to?**
Because a status code is a rendering, and there are two renderings. A Route Handler has a status line, and it is the only part of a failure that generic infrastructure reads — a CDN, a load balancer, a retry policy and a monitoring dashboard all branch on the number and none of them parses your body. A Server Action has no status line; it returns a value into a React render, so a `500` is not something it can express, and throwing instead of returning destroys the user's form. If the service layer picks one, the other door has to reverse-engineer it — parsing an HTTP status out of an in-process function call — and the day you add a queue consumer there is no sensible answer at all.

**★ Why is `err.cause.code` rather than `err.code` the single most expensive line in the error-mapping layer?**
Because getting it wrong produces a system that is *uniformly* broken and *individually* plausible. Every constraint violation falls to the default arm and becomes a `500`: a duplicate title, a bad board reference, a check-constraint failure. Each one looks like an unrelated server bug, so nobody connects them; the mapping code reads correctly in review because it is correct for `pg`; and the types cannot help, because the thrown value is `unknown` either way. It is also unstable — Drizzle documents no contract for this, so the shape was read out of the shipped 0.45.2 source and a minor bump could change it silently. That combination of high blast radius, invisibility to review, invisibility to types and version fragility is why it deserves a pinned version and a test that asserts on the wrapper.

---

← [13 · Milestone: the build](13-project-milestone-sprintdesk-cards-api.md) · [Chapter 16 overview](01-explanation.md) · Next → [13c · What it costs the database](13c-milestone-what-it-costs-the-database.md)
