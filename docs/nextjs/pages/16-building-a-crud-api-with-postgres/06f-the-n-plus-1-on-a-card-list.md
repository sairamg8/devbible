---
title: "The N+1 on a card list is not written by anyone as a loop of queries — it is written as a `map` over an array with an `await` inside, which reads like data shaping and is twenty round trips, and the join that fixes it introduces a row explosion that the batched query does not"
sidebar_label: "06f · The N+1 and its fixes"
sidebar_position: 43
description: "Where the N+1 actually comes from in a Route Handler, the three fixes and what each costs, what drizzle-orm 0.45.2's relational with: clause really emits, the row explosion a naive join produces, and the N+1 hiding inside the ownership check."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 `SELECT` reference](https://www.postgresql.org/docs/18/sql-select.html) (`LATERAL`), the [aggregate-functions reference](https://www.postgresql.org/docs/18/functions-aggregate.html) (`json_agg`), and the [PostgreSQL 18 `LIMIT` and `OFFSET` reference](https://www.postgresql.org/docs/18/queries-limit.html).
> The SQL that `drizzle-orm` **0.45.2** emits for a relational `with:` clause **read from the published build** (`pg-core/dialect.js`); `relations()` versus `defineRelations` **probed on the published 0.45.2 typings** (`relations.d.ts`).
> Documentation-verified; **no sandbox run, no timings, no query counts from a log.**
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Nobody writes a loop of database queries on purpose. The N+1 arrives disguised as data shaping — a `map` over the rows you just fetched, with an `await` inside it, producing a list of cards each with its labels attached. It reads as one operation and executes as one query per card. Worse, it scales exactly with the page size, so a twenty-item page is twenty extra round trips and the endpoint that looked fine in review is the slowest thing in the service. This page is where it comes from, the three fixes, what each one costs, and the second N+1 that hides in the ownership check where nobody looks for it.**

## Where it comes from

Assume a `labels` table and a `card_labels` join table — the standard many-to-many, and not part of the canonical chapter schema, so treat this as the shape of the problem rather than as SprintDesk's DDL:

```sql
CREATE TABLE labels (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name     text NOT NULL,
  colour   text NOT NULL
);

CREATE TABLE card_labels (
  card_id  uuid NOT NULL REFERENCES cards(id)  ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX card_labels_label_idx ON card_labels (label_id);
```

The endpoint should return each card with its labels. Here is the code that does it wrongly, and it is not obviously wrong:

```ts
// 🔴 one query, then one more per card
const rows = await db.select(CARD_COLUMNS).from(cards)
  .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
  .orderBy(desc(cards.createdAt), desc(cards.id))
  .limit(limit)

const withLabels = await Promise.all(
  rows.map(async (card) => ({
    ...card,
    labels: await db
      .select({ id: labels.id, name: labels.name, colour: labels.colour })
      .from(cardLabels)
      .innerJoin(labels, eq(labels.id, cardLabels.labelId))
      .where(eq(cardLabels.cardId, card.id)),
  })),
)
```

There is no loop keyword, the `Promise.all` makes it look concurrent and therefore fine, and the shape of the result is exactly what the API contract asks for. **It is `limit + 1` queries**, and the count is set by the client through `?limit=`.

⚠️ **`Promise.all` makes this worse, not better.** Twenty concurrent queries all check out a connection from a pool whose `max` defaults to 10 in `pg` 8.23.0 — so ten run and ten queue, and a second concurrent request for the same endpoint finds an exhausted pool. The sequential version is slower per request and degrades more gracefully; both are the wrong shape.

## Fix 1 — the batched second query

Two queries total, regardless of page size:

```ts
// lib/dal/cards.ts
import { inArray } from 'drizzle-orm'

export async function listCardsWithLabels(boardId: string, q: ListCardsInput) {
  await requireBoardAccess(boardId)

  const rows = await db.select(CARD_COLUMNS).from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
    .orderBy(desc(cards.createdAt), desc(cards.id))
    .limit(q.limit)

  if (rows.length === 0) return { items: [], nextCursor: null }

  // ONE query for every label on every card in the page.
  const pairs = await db
    .select({
      cardId: cardLabels.cardId,
      id: labels.id,
      name: labels.name,
      colour: labels.colour,
    })
    .from(cardLabels)
    .innerJoin(labels, eq(labels.id, cardLabels.labelId))
    .where(inArray(cardLabels.cardId, rows.map((c) => c.id)))

  const byCard = new Map<string, { id: string; name: string; colour: string }[]>()
  for (const p of pairs) {
    const list = byCard.get(p.cardId)
    if (list) list.push({ id: p.id, name: p.name, colour: p.colour })
    else byCard.set(p.cardId, [{ id: p.id, name: p.name, colour: p.colour }])
  }

  return {
    items: rows.map((c) => ({ ...c, labels: byCard.get(c.id) ?? [] })),
    nextCursor: null,   // 06d builds the real cursor
  }
}
```

**Why this is the default recommendation.** Two round trips, both indexed, neither one duplicating card rows. The page query keeps its exact `LIMIT` semantics — this is the property that breaks under a naive join, below. And the grouping is ordinary in-memory work over a bounded set: at most `limit × labels_per_card` rows, which you control.

⚠️ **The `IN` list is bounded by your page size, which is bounded by your schema.** [06b](06b-filtering-and-sorting-without-injection.md) caps `limit` at 100 for exactly this kind of reason. Without that cap, `?limit=50000` produces an `IN` list with fifty thousand parameters, and PostgreSQL's protocol limit on bind parameters is finite.

⚠️ **`rows.length === 0` is not an optimisation.** `inArray(column, [])` has to render *something*, and an empty `IN ()` is not valid SQL. Guard the empty case explicitly rather than finding out how your ORM version chooses to handle it.

## Fix 2 — one query with a `LATERAL` aggregate, which is what Drizzle already does

Drizzle's relational query builder handles this in one statement. First the relations — and note the version trap:

```ts
// db/relations.ts
import { relations } from 'drizzle-orm'
import { cards, labels, cardLabels } from './schema'

export const cardsRelations = relations(cards, ({ many }) => ({
  cardLabels: many(cardLabels),
}))

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, { fields: [cardLabels.cardId], references: [cards.id] }),
  label: one(labels, { fields: [cardLabels.labelId], references: [labels.id] }),
}))

export const labelsRelations = relations(labels, ({ many }) => ({
  cardLabels: many(cardLabels),
}))
```

🔴 **`relations()`, not `defineRelations()`.** The published documentation at `orm.drizzle.team` describes the **1.0 release candidate**, where the API is `defineRelations`. That export does not exist in 0.45.2 — probed on the published `relations.d.ts`, which exports `relations`, `createOne`, `createMany` and no `defineRelations`. If a documentation page shows `defineRelations`, you are reading the rc and it will not compile against this pin.

```ts
const rows = await db.query.cards.findMany({
  where: (c, { and, eq, isNull }) =>
    and(eq(c.boardId, boardId), isNull(c.deletedAt)),
  orderBy: (c, { desc }) => [desc(c.createdAt), desc(c.id)],
  limit: q.limit,
  columns: { id: true, boardId: true, title: true, body: true, status: true,
             position: true, version: true, createdAt: true, updatedAt: true },
  with: { cardLabels: { with: { label: true } } },
})
```

**What that actually emits, read from the published 0.45.2 `pg-core/dialect.js`.** The relational builder sets `lateral: true` on the join it constructs and builds the nested selection as

```js
let field = sql`json_build_array(${sql.join(/* selected columns */)})`
// ...
field = sql`coalesce(json_agg(${field}${orderBy.length > 0 ? sql` order by ...` : void 0}), '[]'::json)`
```

so a `with:` clause becomes a **`LEFT JOIN LATERAL` against a subquery that aggregates the related rows into a JSON array**, wrapped in `coalesce(..., '[]'::json)` so a card with no labels gets an empty array rather than a null. One statement, one round trip, and — this is the part that matters — **the `LIMIT` applies to the outer card query**, because the related rows are aggregated inside the lateral subquery rather than multiplying the outer rows.

That is a genuinely good design and it is why `with:` is not the trap people assume ORM eager-loading to be.

**Its costs, which are real.** The rows come back as JSON that PostgreSQL builds and your driver parses, which is work the batched version does not do. The nesting is `card → cardLabels → label`, so you get an extra level of wrapping to flatten in application code unless you reshape it. And the `where` and `orderBy` callbacks are a different API surface from the core builder, so a codebase that uses both has two ways of expressing the same predicate.

## The row explosion, which is what a naive join does instead

The fix people reach for before either of the above is a plain join:

```sql
-- 🔴 the LIMIT now applies to the wrong thing
SELECT c.*, l.id AS label_id, l.name AS label_name
  FROM cards c
  LEFT JOIN card_labels cl ON cl.card_id = c.id
  LEFT JOIN labels l       ON l.id = cl.label_id
 WHERE c.board_id = $1 AND c.deleted_at IS NULL
 ORDER BY c.created_at DESC, c.id DESC
 LIMIT 20;
```

A card with three labels produces three rows. So `LIMIT 20` returns twenty **joined** rows, which might be six cards, and your "page of twenty" is now a page of however many cards happened to fit. Add a second `many` relation — labels and comments — and the join produces `labels × comments` rows per card, which is the classic multiplication.

**Two consequences beyond the wrong page size.** Every card column is repeated once per label, so the bytes on the wire scale with the product rather than the sum. And the pagination is broken in a way that keyset does not fix, because the cursor is derived from the last row of a result set whose rows are no longer cards.

The correct join-based form is the lateral aggregate — which is what Drizzle emits, and which you can also write by hand:

```sql
SELECT c.id, c.title, c.status, c.created_at, l.labels
  FROM cards c
  LEFT JOIN LATERAL (
    SELECT coalesce(json_agg(json_build_object('id', lb.id, 'name', lb.name)), '[]'::json) AS labels
      FROM card_labels cl
      JOIN labels lb ON lb.id = cl.label_id
     WHERE cl.card_id = c.id
  ) l ON true
 WHERE c.board_id = $1 AND c.deleted_at IS NULL
 ORDER BY c.created_at DESC, c.id DESC
 LIMIT 20;
```

`LIMIT 20` means twenty cards again, because the lateral subquery produces exactly one row per card.

## The N+1 inside the ownership check

This is the one that survives every fix above, because it does not look like data loading at all.

```ts
// 🔴 one authorisation query per card
const cards = await listCards(boardId, q)
const visible = await Promise.all(
  cards.items.map(async (c) => ((await canAccessCard(c.id)) ? c : null)),
)
```

If `canAccessCard` queries the membership tables, that is one query per card, added to whatever the data path costs. And it is redundant: every card in the list is on the board, the board's access was already checked once, and the ownership predicate for a card is *defined* through its board.

**The fix is not to batch it. It is to check once, at the scope.**

```ts
export async function listCardsWithLabels(boardId: string, q: ListCardsInput) {
  await requireBoardAccess(boardId)   // once, for the whole page
  // ...every card returned is on this board by construction
}
```

The general rule: **authorise the scope, then read within it.** Per-row authorisation is the right shape only when rows in one result set can have different owners, which for a board-scoped collection they cannot. Where the predicate genuinely is per row, it belongs in the `WHERE` clause as a join against membership — one query — not in a `map`.

## Gotchas

**★ Symptom: an endpoint's latency scales linearly with the page size, and no single query is slow.** Cause: an `await` inside a `map` over the page — the N+1, wearing data-shaping clothes. Fix: one batched second query with `inArray`, or one statement with the relational `with:`. The tell in review is any `await` inside an array callback that touches the database.

**★ Symptom: wrapping the per-card queries in `Promise.all` made it worse under load.** Cause: the queries now run concurrently and each checks out a pool connection; `pg` 8.23.0 defaults `max` to 10, so a twenty-item page saturates the pool and a second concurrent request queues behind it. Fix: reduce the number of queries rather than parallelising them. `Promise.all` over database calls converts a latency problem into a connection-exhaustion problem.

**★ Symptom: adding a join made every page return fewer cards than the limit.** Cause: row explosion — one row per card per label, with `LIMIT` applied to the joined result. Fix: aggregate in a lateral subquery so the outer query still produces one row per card, or use the two-query batch. Never apply `LIMIT` to a result set whose rows are not the entity you are paginating.

**★ Symptom: adding a second relation multiplied the row count instead of adding to it.** Cause: two `LEFT JOIN`s to `many` relations produce the cross product — `labels × comments` rows per card. Fix: one lateral aggregate per relation, which Drizzle's `with:` does automatically, or separate batched queries. The multiplication is the reason "just add another join" stops working at exactly two relations.

**★ Symptom: `defineRelations` is not exported and the documentation says it should be.** Cause: `orm.drizzle.team` documents the 1.0 release candidate; the pin here is 0.45.2, whose published `relations.d.ts` exports `relations` and has no `defineRelations`. Fix: use `relations()` with the `one`/`many` helpers, and treat any documentation page showing `defineRelations` as describing a version you are not on.

**★ Symptom: `inArray(cards.id, [])` produces a syntax error on an empty page.** Cause: an empty `IN` list is not valid SQL and something has to render it. Fix: guard the empty case before the second query, as `if (rows.length === 0)` does above. Do not rely on the ORM's handling of the empty array; it is a behaviour you would be depending on without a documented guarantee.

**★ Symptom: `?limit=50000` produces a driver error about too many parameters rather than a slow response.** Cause: the `IN` list has one bind parameter per id, and the wire protocol bounds how many a statement may carry. Fix: the page-size cap in the query schema — `.max(100)` — bounds the `IN` list as a side effect. This is a second reason the cap is not optional.

**★ Symptom: a card with no labels comes back with `labels: null` and the client crashes mapping it.** Cause: `json_agg` over an empty set returns `NULL`, not `'[]'`. Fix: `coalesce(json_agg(...), '[]'::json)`, which is exactly what Drizzle's dialect emits for a `with:` clause. In the batched version the equivalent is `byCard.get(c.id) ?? []`, and it is just as necessary.

**★ Symptom: the list endpoint is fast and the authorisation is slow.** Cause: a per-card access check running in a `map`, which is an N+1 in the security path rather than the data path. Fix: authorise the *scope* once — `requireBoardAccess(boardId)` — and let the board membership imply access to every card on it. If the predicate really is per row, express it as a join in the `WHERE` clause, not as a loop.

**★ Symptom: the ORM's relational query is slower than the two-query version despite being one round trip.** Cause: the JSON aggregation is real work — PostgreSQL builds the arrays and your driver parses them — and for wide related rows that can outweigh a saved round trip. Fix: measure the two on your data rather than assuming one round trip always wins. Both shapes are correct; which is faster is an empirical question this page cannot answer for you, and neither can a blog post about someone else's schema.

**★ Symptom: the N+1 was fixed for the list endpoint and reintroduced by a new field a month later.** Cause: nothing structural prevents it — the fix was a local rewrite, and the next person adding "assignee" to the response wrote the same `map`. Fix: make the loading shape explicit in the DAL's API. A `listCardsWithLabels` function that takes an explicit set of relations to include is harder to bypass than a convention, and a lint rule flagging `await` inside an array callback catches the rest at review time.

**★ Symptom: the join fix works and pagination starts returning duplicates.** Cause: the cursor is built from the last row of a joined result set, so it is derived from a row that is a card-label pair rather than a card. Fix: paginate the entity, not the join. Both correct shapes preserve this — the batched version pages the card query untouched, and the lateral version produces one row per card — which is another way of saying that the row explosion breaks more than the page size.

## Interview questions

**★ Why is the N+1 hard to spot in review, when everyone knows what it is?**
Because it is never written as a loop of queries. It is written as a `map` producing exactly the response shape the API contract asks for, and the database access is one `await` in the middle of what reads as data transformation. Wrapping it in `Promise.all` makes it look like a deliberate concurrency optimisation, which further disarms the reader. And it usually performs fine in review and in development, where the page has three rows and the database is on localhost — the cost only appears at the page size real users request, which is set by a query parameter rather than by anything in the code. The reliable tell is syntactic rather than semantic: any `await` inside an array callback that touches the database is an N+1 until proven otherwise, and that is something a lint rule can find.

**★ Compare the batched second query with the ORM's relational `with:` clause. What does each actually cost?**
The batched version is two round trips, both plain indexed queries, with the grouping done in memory over a bounded set. It keeps the card query completely untouched, so the `LIMIT` and the keyset cursor mean exactly what they meant before, and the SQL is the SQL you would write by hand. Its costs are the extra round trip and the mapping code. The relational `with:` is one round trip: read from the 0.45.2 dialect source, it emits a `LEFT JOIN LATERAL` against a subquery that aggregates the related rows with `coalesce(json_agg(json_build_array(...)), '[]'::json)`, so the outer `LIMIT` still counts cards. Its costs are that PostgreSQL builds the JSON and the driver parses it, which for wide related rows is real work; that the result is nested one level deeper than your API shape through the join table; and that the query callbacks are a second API surface alongside the core builder. Which is faster on your data is an empirical question, and I would not assert an answer without measuring.

**★ Why does a plain `LEFT JOIN` break pagination, and why is that worse than being slow?**
Because the rows in the result are no longer cards. A card with three labels contributes three rows, so `LIMIT 20` returns twenty joined rows — perhaps six cards — and the page size becomes a function of how many labels the cards happen to have. That is not a performance problem you can tune away; it is a correctness problem in the contract, and it gets worse rather than better under keyset, because the cursor is derived from the last row of the result set and that row is a card-label pair rather than a card. Adding a second `many` relation turns the addition into a multiplication, `labels × comments` per card, which is where the bytes on the wire stop being proportional to anything useful. The lateral aggregate is the join that does work, because the subquery collapses the related rows to one row per card before the outer `LIMIT` sees them.

**★ Where is the N+1 that survives fixing the data loading, and what is the fix?**
In the authorisation. A `map` over the page calling a per-card access check is one query per card, and it does not look like data loading so it survives every rewrite of the data path — people fix the labels query and leave the security loop untouched. It is also redundant here: every card in the result is on one board, that board's access was established once, and a card's ownership is *defined* through its board, so the per-card check is asking a question whose answer cannot vary within the page. The fix is not to batch it but to move it: authorise the scope once with `requireBoardAccess(boardId)` and read within it. Where a predicate genuinely does vary per row — a result set spanning multiple owners — it belongs in the `WHERE` clause as a join against membership, so the database applies it once across the whole query.

**★ Why is the page-size cap load-bearing for the batched fix specifically?**
Because the batched query's `IN` list has one bind parameter per row on the page, so the page size directly determines how many parameters the statement carries, and the wire protocol bounds that. Without the cap in the query schema, `?limit=50000` is not merely a large response — it is a statement with fifty thousand parameters, which fails at the driver in a way that surfaces as a 500 rather than as a 4xx, and it does so for an input the client supplied. The cap also bounds the in-memory grouping and the response size, so it is doing three jobs at once. That is a good example of why bounds belong in the schema at the boundary: a limit that exists for one reason usually turns out to be protecting several things downstream that nobody enumerated.

**★ Why should the fix be structural rather than a rewrite of the offending function?**
Because the N+1 is a shape people reach for naturally, and fixing one instance does nothing to stop the next. The month after you batch the labels query, someone adds "assignee" to the card response and writes the same `map`, for the same good reason — it produces exactly the shape the contract wants. What prevents recurrence is making the correct shape the reachable one: a DAL function that takes an explicit set of relations to include, so adding a related entity means extending a function that already batches rather than writing a new loop in a handler; and a lint rule flagging database calls inside array callbacks, which catches the cases where someone works around the DAL anyway. Neither is perfect, and both are better than a code review that has to remember.

---

← [06e · Caching a collection](06e-caching-a-collection.md) · Next → [06g · Conditional requests and ETag](06g-conditional-requests-and-etag.md)
