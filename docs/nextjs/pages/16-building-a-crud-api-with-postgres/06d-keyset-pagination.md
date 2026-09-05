---
title: "Keyset pagination replaces \"give me rows 41 to 60\" with \"give me the rows after this one\", which makes a page cost the same at any depth and makes concurrent writes unable to shift it — and the row-constructor comparison that expresses it is one operator that people reliably expand into a wrong `OR` chain"
sidebar_label: "06d · Keyset pagination"
sidebar_position: 30
description: "The tuple comparison in SQL and in Drizzle, why the naive OR expansion is both wrong and unindexable, the composite index the chapter schema already carries, opaque cursors and why they must be validated, and the four things keyset cannot do."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 row-constructor comparison reference](https://www.postgresql.org/docs/18/functions-comparisons.html) (§9.25.5), the [multicolumn-index reference](https://www.postgresql.org/docs/18/indexes-multicolumn.html) (§11.3), the [index-ordering reference](https://www.postgresql.org/docs/18/indexes-ordering.html) (§11.4), and the [`LIMIT` and `OFFSET` reference](https://www.postgresql.org/docs/18/queries-limit.html).
> Drizzle condition helpers probed from the published `drizzle-orm` **0.45.2** typings (`sql/expressions/conditions.d.ts`).
> Documentation-verified; **no sandbox run, no timings, no query plans.**
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Offset asks a question whose answer changes underneath it — *which rows are numbers 41 to 60 right now* — so it is slow at depth and wrong under writes ([06c](06c-offset-pagination-and-why-it-degrades.md)). Keyset asks a question with a stable answer: *which rows sort after this specific row*. The position is a value from the data rather than a count of rows, so nothing anybody inserts above it can move it, and the database can jump straight to it in an index instead of walking everything before it. The whole technique is one comparison, and the composite index in the chapter schema — `(board_id, created_at, id)` — exists for exactly this query.**

## The comparison, written properly

The sort is `(created_at, id)`, descending, on one board. The cursor is the last row of the previous page. The query is:

```sql
SELECT id, board_id, title, body, status, position, version, created_at, updated_at
  FROM cards
 WHERE board_id = $1
   AND deleted_at IS NULL
   AND (created_at, id) < ($2, $3)
 ORDER BY created_at DESC, id DESC
 LIMIT $4;
```

`(created_at, id) < ($2, $3)` is a **row-constructor comparison**, and PostgreSQL's §9.25.5 defines it precisely:

> *"Each side is a row constructor, as described in Section 4.2.13. The two row constructors must have the same number of fields. The given operator is applied to each pair of corresponding fields."*

> *"For the `<`, `<=`, `>` and `>=` cases, the row elements are compared left-to-right, stopping as soon as an unequal or null pair of elements is found. If either of this pair of elements is null, the result of the row comparison is unknown (null); otherwise comparison of this pair of elements determines the result."*

Left to right, stop at the first difference. That is exactly lexicographic ordering, which is exactly what `ORDER BY created_at DESC, id DESC` produces — so the predicate and the sort agree by construction rather than by your having reasoned them into agreement.

⚠️ **Note the null rule and check your columns against it.** *"If either of this pair of elements is null, the result of the row comparison is unknown (null)"* — and a row where the comparison is unknown is not returned by a `WHERE`. Both `created_at` and `id` are `NOT NULL` in the chapter schema, so this is safe. Paginate on a nullable column and rows with a null in the cursor position vanish silently from every page. §9.25.5 offers `IS DISTINCT FROM` for equality with null-safe semantics, but there is no null-safe `<`, so the practical rule is: **keyset columns must be `NOT NULL`.**

## The `OR` expansion everybody writes, and why it is worse

Without knowing the row-constructor form, the natural expansion is:

```sql
-- 🔴 wrong AND unindexable
AND (created_at < $2 OR (created_at = $2 AND id < $3))
```

It is **logically equivalent** in this two-column case, and it is still the wrong thing to write, for three reasons.

**It stops being equivalent as soon as you touch it.** Add a third sort column and the correct expansion has three branches with nested equalities; almost every hand-written version drops one. The row-constructor form extends by adding a field to each side.

**The planner treats it differently.** The multicolumn-index reference explains what a B-tree scan can use:

> *"A multicolumn B-tree index can be used with query conditions that involve any subset of the index's columns, but the index is most efficient when there are constraints on the leading (leftmost) columns. The exact rule is that equality constraints on leading columns, plus any inequality constraints on the first column that does not have an equality constraint, will always be used to limit the portion of the index that is scanned."*

A row comparison is a single inequality against the index's leading columns, which is precisely the shape that rule describes. An `OR` of two conditions is a disjunction the planner has to handle as such — it may still produce a reasonable plan, but you have converted a clean index range into something the optimiser must work at, and you have done it for no benefit.

**It reads as two rules and it is one.** *"Rows that sort after this one"* is a single idea, and writing it as a disjunction invites someone to edit one branch.

⚠️ I am not going to tell you which plan PostgreSQL picks for either form on your data. There is no sandbox here, and the plan depends on statistics, the index, and the values. Read the documented rule above, write the form the rule matches, and run `EXPLAIN` yourself.

## In Drizzle 0.45.2

Drizzle has `lt`, `gt`, `and`, `or` (probed from the published 0.45.2 typings, `sql/expressions/conditions.d.ts`) and no row-constructor helper — so the comparison goes through the `sql` template, which parameterises the interpolated values:

```ts
// lib/dal/cards.ts
import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { CARD_COLUMNS, type CardDTO } from './projections'
import { requireBoardAccess } from './access'

export type Cursor = { createdAt: Date; id: string }

export type KeysetPage<T> = {
  items: T[]
  nextCursor: string | null
}

export async function listCardsByKeyset(
  boardId: string,
  limit: number,
  cursor: Cursor | null,
): Promise<KeysetPage<CardDTO>> {
  await requireBoardAccess(boardId)

  // Both values are interpolated as bind parameters, not concatenated.
  const after = cursor
    ? sql`(${cards.createdAt}, ${cards.id}) < (${cursor.createdAt}, ${cursor.id})`
    : undefined

  // Fetch one extra row: its existence is what tells us there is a next page,
  // without a count(*) over the whole board.
  const rows = await db
    .select(CARD_COLUMNS)
    .from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt), after))
    .orderBy(desc(cards.createdAt), desc(cards.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items.at(-1)

  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  }
}
```

Two details worth naming.

**`and()` accepts `undefined` and skips it** — the probed signature is `and(...conditions: (SQLWrapper | undefined)[]): SQL | undefined` — so the first page, with no cursor, needs no separate branch.

**One `.where()` call.** As [06b](06b-filtering-and-sorting-without-injection.md) establishes, a second `.where()` in 0.45.2 assigns over the first, which here would drop the board scope and the soft-delete predicate together.

## The index this query needs, and the one the schema already has

```ts
boardCreatedIdx: index('cards_board_created_idx').on(t.boardId, t.createdAt, t.id),
```

Read it against the multicolumn rule: `board_id` is an **equality** constraint on the leading column, and `(created_at, id)` carries the **inequality** on the columns that follow. That is exactly *"equality constraints on leading columns, plus any inequality constraints on the first column that does not have an equality constraint"* — the shape the reference says *"will always be used to limit the portion of the index that is scanned."* The index also supplies the ordering, so the `ORDER BY` needs no sort step.

🔴 **The column order is the whole index.** `(created_at, board_id, id)` has the same three columns and is close to useless here, because the leading column carries no equality constraint and the board filter cannot restrict the scan range. The reference is explicit that constraints on later columns *"do not necessarily reduce the portion of the index that has to be scanned."*

**On direction.** The index-ordering reference notes that a two-column index on `(x, y)` *"can satisfy `ORDER BY x, y` if we scan forward, or `ORDER BY x DESC, y DESC` if we scan backward"*, and that a mixed `ORDER BY x ASC, y DESC` needs an index declared with matching per-column directions. Our sort is uniformly descending on both keyset columns, so a plain ascending index serves it by scanning backward. **Do not mix directions across your keyset columns** unless you are also prepared to declare a matching index — and note that mixing them also breaks the row-constructor form, since a single `<` cannot express "descending on one, ascending on the other".

## The cursor is opaque, and it is still input

Encode it so clients cannot build one by hand and cannot come to depend on its shape:

```ts
// lib/dal/cursor.ts
import 'server-only'
import { z } from 'zod'

const CursorPayload = z.object({
  t: z.iso.datetime({ offset: true }),  // created_at, ISO 8601
  i: z.uuid(),                          // id
})

export function encodeCursor(c: { createdAt: Date; id: string }): string {
  const payload = JSON.stringify({ t: c.createdAt.toISOString(), i: c.id })
  return Buffer.from(payload, 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed = CursorPayload.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    return { createdAt: new Date(parsed.data.t), id: parsed.data.i }
  } catch {
    return null   // not base64url, or not JSON
  }
}
```

🔴 **Base64 is not a security boundary and this code does not pretend otherwise.** Anyone can decode it, and the point of encoding is to stop clients parsing and constructing cursors so that you can change the sort key later without breaking them. The `safeParse` is the part that matters: a cursor is request input, it goes into a `WHERE` clause, and an unvalidated `id` field lands in a `uuid` comparison as `22P02` — a 500 for a malformed cursor, which is exactly the [05b](05b-validating-at-the-boundary-with-zod.md) failure again.

If the cursor must not be forgeable — because it encodes a filter, an offset into a restricted set, or anything a caller could edit to widen their view — sign it. If it only encodes a sort position within a set the ownership predicate already bounds, base64url is enough, because forging a cursor only lets a caller start at a different point in data they are already allowed to read.

⚠️ **A cursor is coupled to the sort.** A cursor minted under `sort=createdAt` is meaningless under `sort=title`, and using it produces silently wrong pages rather than an error. Either put the sort key inside the cursor payload and reject a mismatch, or document that changing `sort` resets paging — and then actually enforce it.

## What keyset cannot do

**It cannot jump to page 500.** A cursor says *where you are*, not *how far in you are*, and there is no way to construct one for a page you have not walked to. If the UI needs a numbered pager with random access, keyset does not provide it — [06c](06c-offset-pagination-and-why-it-degrades.md) names the cases where offset is the honest answer.

**It cannot give you a total count.** Nothing about the technique produces one; a total still needs `count(*)`, with the same cost, and the same staleness. What it does give you for free is `hasMore`, from the extra row.

**It cannot page backwards without a second query shape.** Going back means reversing the comparison and the `ORDER BY` and then reversing the resulting array in application code:

```ts
// Previous page: flip the comparison and the sort, then flip the rows back.
const before = sql`(${cards.createdAt}, ${cards.id}) > (${cursor.createdAt}, ${cursor.id})`
const rows = await db.select(CARD_COLUMNS).from(cards)
  .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt), before))
  .orderBy(asc(cards.createdAt), asc(cards.id))
  .limit(limit + 1)
const items = (rows.length > limit ? rows.slice(0, limit) : rows).reverse()
```

**It cannot page on a mutable sort key without anomalies.** If a client is paging by `updatedAt` and a row it has already passed gets updated, that row moves ahead of the cursor and will be seen again. Keyset removes the shifting caused by *other* rows being inserted or deleted; it does not make a row that has genuinely moved stay put. **Page on immutable keys** — `created_at` and `id` are both immutable, which is precisely why the chapter's index uses them.

## Gotchas

**★ Symptom: the last row of each page reappears as the first row of the next.** Cause: the comparison is `<=` rather than `<`, so the cursor row itself matches. Fix: strict inequality. The cursor is the last row you have already delivered, so it must be excluded — `(created_at, id) < ($2, $3)`.

**★ Symptom: a hand-expanded `OR` cursor condition drops rows when a third sort column is added.** Cause: the correct expansion for three columns has three branches with nested equality prefixes, and the version that was written has two. Fix: use the row-constructor form, which extends by adding one field to each side and cannot be got wrong:

```sql
AND (created_at, priority, id) < ($2, $3, $4)
```

**★ Symptom: rows silently disappear from every page after a nullable column was added to the sort.** Cause: §9.25.5 — *"If either of this pair of elements is null, the result of the row comparison is unknown (null)"* — and an unknown `WHERE` does not return the row. Fix: keyset columns must be `NOT NULL`. If the natural sort key is nullable, sort on `coalesce(col, sentinel)` and index that same expression, so the predicate and the index agree.

**★ Symptom: pagination is correct and still slow.** Cause: the index does not match the query — usually the column order, with the equality column not leading. Fix: `(board_id, created_at, id)`, in that order, so the equality constraint is on the leading column and the inequality follows it. `(created_at, board_id, id)` contains the same columns and cannot restrict the scan.

**★ Symptom: switching the sort to `ORDER BY created_at DESC, id ASC` breaks paging.** Cause: a single row-constructor comparison applies one operator to all fields, so it cannot express mixed directions — and the index only serves a uniform direction by scanning backward. Fix: keep all keyset columns in the same direction. If mixed order is genuinely required, you need both an index declared with matching per-column directions (§11.4) and a hand-written comparison, and you should be certain the product requirement justifies it.

**★ Symptom: `?cursor=hello` returns a 500.** Cause: the cursor was decoded and its fields passed to the query without validation, so a malformed `id` reached a `uuid` comparison and PostgreSQL raised `22P02`. Fix: `decodeCursor` returns `null` for anything that is not valid base64url containing valid JSON matching the schema, and the handler turns `null` into a 400. A cursor is request input like any other.

**★ Symptom: changing the sort order mid-session returns nonsense pages with no error.** Cause: the cursor encodes a position in one ordering and was applied under a different one. Fix: put the sort key and direction inside the cursor payload, compare them to the request, and reject a mismatch with a 400 telling the client to restart paging. Silently continuing produces plausible, wrong results, which is the worst failure available.

**★ Symptom: a client parses the cursor, increments the timestamp, and builds its own.** Cause: the encoding was documented, or was guessable JSON, so a client came to depend on the internal shape. Fix: treat the payload as private and say so in the API documentation — the only supported operation on a cursor is to send it back. Base64url does not enforce this, so if the coupling would be expensive to break later, sign the payload and reject anything with a bad signature.

**★ Symptom: a row already paged past shows up again when a colleague edits it.** Cause: the sort key is `updated_at`, which is mutable, so the edit moved the row to a position the client has not reached. Fix: page on immutable keys. Sorting the *display* by `updated_at` while paging by `(created_at, id)` is not the same thing and is usually not what users want, so the honest resolution is often to accept the anomaly on a "recently updated" view and document it.

**★ Symptom: `nextCursor` is returned on the last page, so the client makes one extra empty request forever.** Cause: the cursor was emitted whenever `items` was non-empty rather than when there was a further row. Fix: fetch `limit + 1` rows and emit `nextCursor` only when the extra row exists. That is what makes `hasMore` free — no `count(*)` anywhere.

**★ Symptom: keyset was adopted and the endpoint still returns duplicates.** Cause: the ordering is not total — `ORDER BY created_at DESC` alone, with the `id` present in the cursor but missing from the sort. Fix: the sort and the comparison must use the same tuple, in the same order. If the cursor is `(created_at, id)`, the `ORDER BY` is `created_at DESC, id DESC`, with no exceptions.

**★ Symptom: the first page is fine, and every page after it returns nothing.** Cause: the timestamp round-tripped through JSON lost sub-second precision, so the reconstructed cursor sorts *before* rows it should follow, or the comparison excludes everything. Fix: `toISOString()` preserves milliseconds and `new Date(iso)` restores them, which the `encodeCursor`/`decodeCursor` pair above relies on. If your column is `timestamptz` with microsecond precision and you need it exactly, carry the value as the raw string PostgreSQL returned rather than through a JavaScript `Date`, which is millisecond-resolution.

## Interview questions

**★ Why is keyset pagination immune to the drift that breaks offset?**
Because the two techniques define a page differently. Offset says "skip 40 rows of the current result set", and which rows those are depends on everything above them — insert one row at the top and every subsequent page shifts by one. Keyset says "give me the rows that sort after this specific row", and the anchor is a value taken from the data itself, not a count. Inserting a thousand rows above the cursor does not change which rows sort after it; deleting rows above it does not either. The anchor is stable because it is a fact about a row rather than a fact about the result set's shape, and that is the entire property. The performance benefit — jumping to a position in the index instead of walking to it — is a consequence of the same change, not a separate feature.

**★ Write the keyset predicate for `ORDER BY created_at DESC, id DESC` and explain why the row-constructor form is preferred over the `OR` expansion.**
`WHERE (created_at, id) < ($cursor_created_at, $cursor_id)`. §9.25.5 says the operator is applied field by field, *"left-to-right, stopping as soon as an unequal or null pair of elements is found"*, which is lexicographic comparison and therefore exactly the ordering the `ORDER BY` produces — the predicate and the sort agree by construction. The `OR` expansion, `created_at < $1 OR (created_at = $1 AND id < $2)`, is logically equivalent for two columns and inferior for three reasons: it stops being equivalent the moment a third sort column is added, because the correct three-column expansion has three branches with nested equality prefixes and hand-written versions reliably drop one; it presents the planner with a disjunction where the multicolumn-index rule describes a clean equality-plus-inequality shape; and it expresses one idea as two clauses, so a future edit can change one and not the other.

**★ Explain, from the documented rule, why the index must be `(board_id, created_at, id)` and not `(created_at, board_id, id)`.**
The multicolumn-index reference states the rule: *"equality constraints on leading columns, plus any inequality constraints on the first column that does not have an equality constraint, will always be used to limit the portion of the index that is scanned"*, and constraints on columns to the right of those *"do not necessarily reduce the portion of the index that has to be scanned."* Our query has one equality — `board_id = $1` — and one inequality over `(created_at, id)`. With `(board_id, created_at, id)` the equality is on the leading column and the inequality on the columns immediately after it, which is precisely the shape the rule covers, and the index also delivers the rows already ordered so no sort is needed. With `(created_at, board_id, id)` the leading column has no equality constraint, so the board filter cannot restrict the scan range and is reduced to a filter applied to entries the scan has already visited. Same three columns, entirely different query.

**★ Why must the cursor be validated when it is a value your own server produced?**
Because it does not arrive from your server, it arrives from a client, and anything a client sends is input regardless of where it originated. A cursor goes straight into a `WHERE` clause, so an `id` field that is not a UUID reaches a `uuid` comparison and produces `22P02` — a 500 for what is a malformed request — and a `created_at` field that is not a timestamp does the same. Beyond the crash, an unvalidated payload lets a client change the sort position arbitrarily, which is benign when the cursor only positions within a set the ownership predicate already bounds and is not benign if the cursor also carries a filter or a scope. The base64 wrapper is opacity, not integrity: it discourages clients from depending on the shape so you can change the sort key later, and it stops nothing. Where forgery would matter, sign it.

**★ What are the four things keyset cannot do, and which one most often forces a design change?**
It cannot jump to an arbitrary page number, because a cursor encodes a position rather than a distance. It cannot produce a total count — that still costs a `count(*)` — though it gives you `hasMore` for free from one extra row. It cannot page backwards with the same query: you flip the comparison, flip the `ORDER BY`, and reverse the array in application code. And it cannot page on a mutable sort key without anomalies, because a row that is genuinely edited moves, and a row that moves ahead of the cursor will be seen twice. The one that forces a design change is the first: a table with a numbered pager and a "go to page" box cannot be built on keyset, so either the UI becomes infinite scroll or previous/next, or the endpoint stays on offset with the depth bounded. That conversation is worth having early, because retrofitting a cursor API onto a UI built around page numbers means changing both ends.

**★ Why does the `hasMore` trick avoid a `count(*)`, and what does it cost?**
Because the only question a next-page control actually asks is *is there anything after this*, and one extra row answers it exactly. Requesting `limit + 1` and checking whether you got back more than `limit` costs one additional row of work — bounded, constant, and on the same index scan the page is already doing — whereas a `count(*)` has to identify every matching row in the filtered set on every request. The cost is that you lose the total, so the UI cannot say "page 3 of 47" or show a progress bar. That is usually the correct trade, because an exact total on a live list is stale by the time it renders, and the thing it was being used for is nearly always just enabling or disabling a button.

---

← [06c · Offset pagination](06c-offset-pagination-and-why-it-degrades.md) · [Chapter 16 overview](01-explanation.md) · Next → [06e · Caching a collection](06e-caching-a-collection.md)
