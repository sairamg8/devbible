---
title: "`OFFSET n` makes the server produce and discard `n` rows, so page 500 costs five hundred pages of work — but the performance problem is the one you will notice second, because a single insert between two requests shifts every subsequent page and the client silently receives duplicates and misses rows"
sidebar_label: "06c · Offset pagination"
sidebar_position: 40
description: "What OFFSET actually does per the reference, the drift problem that no index fixes, the total-count query that costs as much as the page, and the three cases where offset is nevertheless the right answer."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 `LIMIT` and `OFFSET` reference](https://www.postgresql.org/docs/18/queries-limit.html), [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), the [PostgreSQL 18 aggregate-functions reference](https://www.postgresql.org/docs/18/functions-aggregate.html), and the [`pg-types` README](https://github.com/brianc/node-pg-types) — the module `pg` re-exports as `pg.types`, and the source of the `int8`-as-string rule.
> Documentation-verified; **no sandbox run, no timings, no row counts.**
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Offset pagination is what everybody writes first, and it is wrong in two independent ways that people discover in the wrong order. The performance problem is famous and is actually the milder one: the reference says plainly that skipped rows *"still have to be computed inside the server"*, so the cost of a page grows with how deep it is. The correctness problem is quieter and is not fixable by any index, cache or query plan — a page is defined by a count of rows from the start of a result set that changes between requests, so an insert or a delete anywhere above your position shifts everything below it. A client walking a busy list does not get a slow answer; it gets a wrong one, with a 200.**

## What `OFFSET` does, per the reference

The `LIMIT` and `OFFSET` page is short and every load-bearing sentence is in it.

> *"`OFFSET` says to skip that many rows before beginning to return rows. `OFFSET 0` is the same as omitting the `OFFSET` clause"*

> *"If both `OFFSET` and `LIMIT` appear, then `OFFSET` rows are skipped before starting to count the `LIMIT` rows that are returned."*

🔴 And the sentence the entire performance argument rests on:

> *"The rows skipped by an OFFSET clause still have to be computed inside the server; therefore a large OFFSET might be inefficient."*

**Computed, then discarded.** Not seeked past. The server evaluates the query, produces rows in order, throws away the first `n`, and returns the next `limit`. So `OFFSET 10000 LIMIT 20` does the work of producing 10,020 rows in order to return 20 of them, and every row of that work is billed to the request that will never see it.

⚠️ **An index does not remove this, it only changes what the discarded work costs.** With an index matching the `ORDER BY`, the skipped rows are walked in the index rather than sorted from scratch, which is a large improvement and still linear in the offset. The reference's warning is unconditional for a reason.

I am deliberately not giving you a number for how much slower page 500 is than page 1. There is no sandbox here, the answer depends on the index, the row width, the buffer cache and the plan, and a fabricated figure would be worse than the mechanism you now understand.

## The correctness problem, which is worse and which nothing fixes

Offset defines a page as *"rows 41 through 60 of the current result set"*. That definition is only stable if the result set does not change between the request for rows 1–20 and the request for rows 41–60. On any list users can write to, it does.

Take a board sorted newest-first. The client fetches page 1 — the twenty newest cards. Somebody creates a card. The client fetches page 2 with `OFFSET 20`. Every card has shifted down one position, so the card that was last on page 1 is now the first row of page 2. **The client sees it twice.**

Delete a card instead, and the row that would have been first on page 2 shifts up into page 1's range, which the client has already passed. **The client never sees it at all.**

Neither produces an error. The client's list has a duplicate or a hole, the server did exactly what it was asked, and the bug report says *"sometimes a card appears twice when I scroll"*.

**The isolation level does not help.** READ COMMITTED gives each statement its own snapshot — *"a SELECT query sees a snapshot of the database as of the instant the query begins to run"* — and the two page requests are separate statements in separate transactions minutes apart. Even inside one transaction, the reference is explicit that *"two successive SELECT commands can see different data, even though they are within a single transaction, if other transactions commit changes after the first SELECT starts and before the second SELECT starts."* You would need a `REPEATABLE READ` transaction held open across every page request, which means holding a database transaction across HTTP requests — something a stateless API structurally cannot do, and topic 09 explains why you must not try.

The only fix is to stop defining a page by counting from the start. That is [06d](06d-keyset-pagination.md).

## The `ORDER BY` you must have anyway

> *"When using LIMIT, it is important to use an ORDER BY clause that constrains the result rows into a unique order. Otherwise you will get an unpredictable subset of the query's rows. You might be asking for the tenth through twentieth rows, but tenth through twentieth in what ordering?"*

> *"The query optimizer takes LIMIT into account when generating query plans, so you are very likely to get different plans (yielding different row orders) depending on what you give for LIMIT and OFFSET. Thus, using different LIMIT/OFFSET values to select different subsets of a query result will give inconsistent results unless you enforce a predictable result ordering with ORDER BY. This is not a bug; it is an inherent consequence of the fact that SQL does not promise to deliver the results of a query in any particular order unless ORDER BY is used to constrain the order."*

Two separate claims there, and both matter.

**Without any `ORDER BY`, pagination is meaningless.** There is no defined sequence to take the 41st through 60th elements of.

**With a non-unique `ORDER BY`, it is still meaningless.** `ORDER BY created_at DESC` with two cards created in the same millisecond leaves their relative order to the plan, and the reference says the plan *changes with the `LIMIT` and `OFFSET` values*. So the tie can resolve one way on page 1 and the other way on page 2, and the same duplicate-and-hole symptom appears with no concurrent writes at all.

That is why every ordering in this topic ends with the id:

```ts
.orderBy(desc(cards.createdAt), desc(cards.id))
```

and why the chapter's index is `(board_id, created_at, id)` rather than `(board_id, created_at)`.

## The implementation, written honestly

```ts
// lib/dal/cards.ts
import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

export type OffsetPage<T> = {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export async function listCardsByOffset(
  boardId: string,
  page: number,
  pageSize: number,
): Promise<OffsetPage<CardDTO>> {
  await requireBoardAccess(boardId)

  const where = and(eq(cards.boardId, boardId), isNull(cards.deletedAt))

  // Two queries. The count is not free — see below.
  const [items, [{ total }]] = await Promise.all([
    db
      .select(CARD_COLUMNS)
      .from(cards)
      .where(where)
      .orderBy(desc(cards.createdAt), desc(cards.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(cards)
      .where(where),
  ])

  return {
    items,
    page,
    pageSize,
    totalItems: total,
    totalPages: Math.ceil(total / pageSize),
  }
}
```

Note `count(*)::int`. PostgreSQL's `count()` returns `bigint`, and the `pg-types` README — the module `pg` re-exports as `pg.types` — states the rule and the reason:

> *"Because JavaScript doesn't have support for 64-bit integers node-postgres cannot confidently parse `int8` data type results as numbers because if you have a huge number it will overflow and the result you'd get back from node-postgres would not be the result in the database. That would be a **very bad thing** so node-postgres just returns `int8` results as strings and leaves the parsing up to you."*

and it names this exact case:

> *"you're tired of receiving results from the `COUNT(*)` function as strings (because that function returns `int8`)"*

So without the cast, `total` is the string `'137'`, `Math.ceil(total / pageSize)` still works through coercion, and `totalItems` reaches the client as a string while your type declaration claims a number. The cast makes the type honest and is safe for any value that fits in a signed 32-bit integer, which every page count does.

## The total-count query is not free either

`count(*)` with the same `WHERE` has to identify every matching row. It reads less per row than the page query — no wide columns, and it can often be satisfied from an index — but it is still proportional to the size of the filtered set, and it runs on **every page request**, not just the first.

Three ways out, in increasing order of how much you have to explain to a designer:

**Fetch the count once and pass it back.** The client already has `totalItems` from page 1; the drift means it is approximate anyway. Accept the approximation explicitly rather than paying for a fresh exact count that is stale by the time it renders.

**Ask for one more row than you need.** `LIMIT pageSize + 1` tells you whether there is a next page without any count at all. You lose the total, and *"Next"* / *"Previous"* is all most UIs actually use:

```ts
const rows = await db.select(CARD_COLUMNS).from(cards).where(where)
  .orderBy(desc(cards.createdAt), desc(cards.id))
  .limit(pageSize + 1)
  .offset((page - 1) * pageSize)

const hasMore = rows.length > pageSize
const items = hasMore ? rows.slice(0, pageSize) : rows
```

**Use an estimate for the total.** PostgreSQL keeps a planner estimate in `pg_class.reltuples`, which is cheap and approximate — but it is per *table*, not per filtered set, so it is only useful when the filter is the whole table. For a per-board count it does not apply, and reaching for it there produces a confidently wrong number. Query-planner-based estimation for arbitrary filters belongs in the separate `docs/postgresql/` track, not here.

## When offset is nevertheless right

Offset is not a mistake everywhere. It is the correct choice in three situations, and knowing them stops keyset becoming a cargo cult.

**A bounded, small set.** A board with a hard cap of a few hundred cards has no deep pages, and the drift window is small enough that a user rarely spans it. Offset's simplicity wins.

**A static or append-only set with a stable sort.** An archive that only grows at one end, sorted so new rows land where the client has already been, does not drift for a forward-paging client.

**A user interface that genuinely needs page numbers.** Keyset cannot jump to page 500 — [06d](06d-keyset-pagination.md) — so a table with a numbered pager and a "go to page" box needs offset, or needs a redesign. Admin tools with a known-small dataset are the honest case for this.

The dishonest case is an infinite-scroll feed, which needs none of offset's properties and gets all of its problems.

## Gotchas

**★ Symptom: a user scrolling a busy list sees the same card twice.** Cause: a row was inserted above their position between two page requests, shifting everything down by one, so the last row of page 1 became the first row of page 2. Fix: no index, cache or isolation level addresses this — the page is defined by a count from the start of a changing result set. Switch to keyset, [06d](06d-keyset-pagination.md).

**★ Symptom: an export that pages through the whole table quietly misses rows.** Cause: the mirror of the above — a delete above the cursor pulls a row up into a range that has already been read. Fix: for a full traversal, keyset ordered by an immutable key is the correct tool, because a deleted row cannot move a row that has not been visited yet.

**★ Symptom: page 1 is instant and page 400 times out.** Cause: *"The rows skipped by an OFFSET clause still have to be computed inside the server"*, so page 400 does four hundred pages of work. Fix: keyset. As a stopgap, cap the maximum reachable page and return a 400 past it — an ugly limit that responds beats an elegant one that times out.

**★ Symptom: the API is fast and the page is slow, and the page query is not the problem.** Cause: the `count(*)` runs on every request against the same filtered set. Fix: drop the exact total. Either fetch `pageSize + 1` rows and expose only `hasMore`, or take the count once and let the client keep it. An exact total that drifts between requests was never exact anyway.

**★ Symptom: `totalItems` arrives at the client as a string.** Cause: `count()` returns `bigint`, and `pg` 8.23.0 parses `bigint` to a string by default to avoid silent precision loss beyond `Number.MAX_SAFE_INTEGER`. Fix: `count(*)::int` in the projection, which is safe for any page count and makes the wire type match the declared type. ⚠️ The `pg-types` README does offer the alternative — `types.setTypeParser(20, (val) => parseInt(val, 10))` — under the condition that *"you know you don't and wont ever have numbers greater than `int4` in your database"*. That is a real option and a global one: it changes every `int8` column in the process, including any id or counter where the precision guarantee is the point. Prefer the per-query cast, which is local and self-documenting.

**★ Symptom: results shuffle between pages even with no writes at all.** Cause: the `ORDER BY` is not unique, and the planner *"is very likely to get different plans (yielding different row orders) depending on what you give for LIMIT and OFFSET"*, so a tie resolves differently per page. Fix: append the primary key to every sort — `ORDER BY created_at DESC, id DESC` — so the ordering is total and plan-independent.

**★ Symptom: `?page=0` returns the same rows as `?page=1`, and `?page=-1` errors.** Cause: `(page - 1) * pageSize` yields `-pageSize` for page 0, and PostgreSQL rejects a negative `OFFSET`. Fix: validate the page number as `z.coerce.number().int().min(1)` at the boundary, so the arithmetic can never produce a negative and the client gets a 422 naming the parameter rather than a 500.

**★ Symptom: `?page=999999999` produces a slow empty response instead of a fast one.** Cause: an offset past the end still computes and discards every row before it before discovering there is nothing left. Fix: bound the reachable depth. Either cap `page` in the schema, or reject any request whose offset exceeds a threshold — the client cannot usefully be at page nine hundred million, and letting it try is a free denial-of-service.

**★ Symptom: the count and the page disagree — `totalItems` says 100 and paging finds 99.** Cause: the two queries ran as separate statements with separate snapshots, so a delete landed between them. Fix: either accept it and document `totalItems` as approximate, or run both inside one `REPEATABLE READ` transaction so they share a snapshot — which makes them consistent with each other and still not consistent with the *next* request, so it buys less than it looks like.

**★ Symptom: an infinite-scroll feed was built on offset because it was simpler, and it now has all three problems at once.** Cause: infinite scroll needs *forward traversal of a changing list*, which is precisely offset's worst case and keyset's design target — and it needs none of offset's only real advantage, random page access. Fix: keyset. This is the single clearest case in the topic, because the UI never exposes a page number to begin with.

## Interview questions

**★ Why is `OFFSET 10000 LIMIT 20` slow, in mechanical terms?**
Because the skipped rows are produced and thrown away rather than seeked past. The reference states it directly: *"The rows skipped by an OFFSET clause still have to be computed inside the server; therefore a large OFFSET might be inefficient."* The server evaluates the query, generates rows in the specified order, discards the first ten thousand, and returns the next twenty — so the request pays for 10,020 rows of work to deliver 20. An index matching the `ORDER BY` improves the constant a great deal, because the skipped rows are walked in index order instead of being sorted, but the cost is still linear in the offset. That is why the degradation is gradual and sneaks up on you: it looks fine in development, fine at launch, and becomes a timeout at whatever page depth your data eventually reaches.

**★ Which of offset's two problems is worse, and why do people meet them in the wrong order?**
The correctness problem is worse and is met second. Performance is visible — page 400 gets slow, someone profiles it, and there is a clear trigger. Drift is silent: the page returns 200 with plausible data, and the duplicate or the missing row only shows up as a user saying "sometimes a card appears twice", which is unreproducible on a quiet dataset. It is also the one that no amount of optimisation touches, because it is not a cost problem at all — a page is defined as a count of rows from the start of a result set, and any write above the client's position redefines what that count selects. You cannot index your way out of a definition.

**★ Why can't `REPEATABLE READ` fix the drift?**
It can, and only within one transaction, which is not where your pages are. A `REPEATABLE READ` transaction sees one snapshot for its whole duration, so paging inside it is consistent. But each page request is a separate HTTP request, arriving seconds or minutes apart, on a connection that has been returned to the pool in between — so making them share a snapshot means holding an open database transaction across HTTP requests. That pins a connection per paging user, which on a serverless deployment with a pooler is not merely expensive but structurally impossible, and it leaves a transaction open for as long as somebody leaves a browser tab sitting there. The reference underlines the point even for the single-transaction case at the default level: *"two successive SELECT commands can see different data, even though they are within a single transaction"* under READ COMMITTED.

**★ Your product manager wants exact result counts and page numbers on an infinite-scroll feed. What do you tell them?**
That the two requests are in tension and only one of them is load-bearing. Page numbers require offset, which requires computing and discarding every row before the page, and an exact total requires a `count(*)` over the whole filtered set on every request — so both costs scale with the data and both are paid by a UI that never shows a page number to the user. Meanwhile the drift means the exact total is stale by the time it renders anyway. What infinite scroll actually needs is *is there more*, which one extra row in the `LIMIT` answers for free, and *what comes after this*, which is keyset. If a numbered pager is genuinely required — an admin table where someone jumps to page 40 — that is a different screen with different data volumes, and offset is the right answer there.

**★ Why does `count(*)` return a string in this stack, and what is the correct fix?**
`count()` returns `bigint`, and `pg` 8.23.0 parses `bigint` values to JavaScript strings by default rather than to numbers, because a `bigint` can exceed `Number.MAX_SAFE_INTEGER` and silently losing precision on an id would be far worse than returning a string. The correct fix is a cast in the query — `count(*)::int` — which is safe for anything that fits in a signed 32-bit integer and every realistic page count does. The tempting wrong fix is to register a global type parser converting `bigint` to `number`, because that changes the behaviour of every `bigint` column in the application, including ones where the precision guarantee is the point, to solve a problem in one aggregate.

**★ Name a situation where you would deliberately choose offset over keyset.**
An admin table over a bounded dataset where someone genuinely jumps to page 40. Keyset structurally cannot do that — a cursor encodes *where you are*, not *how far in you are*, so there is no way to construct one for a page you have not walked to. If the requirement is a numbered pager with random access, offset is the only option that satisfies it, and on a few thousand rows the cost is irrelevant and the drift window is small enough that nobody notices. The mistake is generalising from that case: the same reasoning does not survive contact with a growing table or a feed, and "we already use offset elsewhere" is not an argument for using it on the endpoint that pages through everything.

---

← [06b · Filtering and sorting](06b-filtering-and-sorting-without-injection.md) · Next → [06d · Keyset pagination](06d-keyset-pagination.md)
