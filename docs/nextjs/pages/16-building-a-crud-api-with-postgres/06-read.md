---
title: "GET one and GET many are two different problems that share a verb — a missing card is a 404 and an empty board is a 200 with `[]`, the Data Access Layer returns the projection and the handler is forbidden from reshaping it, and every single read carries a soft-delete predicate that is the easiest thing in the codebase to forget"
sidebar_label: "06 · READ"
sidebar_position: 38
description: "Why the two GETs have different failure modes, 404 versus an empty collection versus 410, projections that belong to the DAL, the soft-delete predicate and how to make it impossible to omit, and the Date that becomes a string on the wire."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 *HTTP Semantics* — [§9.3.1 GET](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.1), [§15.3.1 200 OK](https://www.rfc-editor.org/rfc/rfc9110#section-15.3.1), [§15.5.5 404 Not Found](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.5), [§15.5.11 410 Gone](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.11) — the Next.js [Route Handlers guide](https://nextjs.org/docs/app/getting-started/route-handlers) and [data security guide](https://nextjs.org/docs/app/guides/data-security) (both `version: 16.3.4`), and the [PostgreSQL 18 `LIMIT` and `OFFSET` reference](https://www.postgresql.org/docs/18/queries-limit.html).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Read looks like the easy verb because nothing changes. It is the verb with the most surface: two endpoints with different semantics, a query shape a client can influence, a result set that has to be bounded, a cache that has to be invalidated, and a predicate that must appear on every query or deleted rows come back. This chunk is the part that is the same for both endpoints — the projection contract, the status codes, and the soft-delete predicate. [06b](06b-filtering-and-sorting-without-injection.md) is the query surface, [06c](06c-offset-pagination-and-why-it-degrades.md) and [06d](06d-keyset-pagination.md) are the bounding, [06e](06e-caching-a-collection.md) is the cache, [06f](06f-the-n-plus-1-on-a-card-list.md) the join, [06g](06g-conditional-requests-and-etag.md) the revalidation.**

## Two endpoints, two failure models

```
GET /api/boards/[boardId]/cards      the collection
GET /api/cards/[cardId]              the member
```

They share a verb and almost nothing else.

| | Member (`/api/cards/[cardId]`) | Collection (`/api/boards/[boardId]/cards`) |
|---|---|---|
| Nothing matched | **404** — the resource does not exist | **200** with `[]` — the collection exists and is empty |
| Result size | one row, bounded by definition | unbounded unless you bound it |
| Client can influence the query | only via the id | filter, sort, page — [06b](06b-filtering-and-sorting-without-injection.md) |
| Cacheable | per resource, invalidated by one card | per board, invalidated by any card on it |
| Ownership check | on the card's board | on the board itself, before any row is read |

🔴 **The status-code line is the one people get wrong, in both directions.** An empty list returned as 404 makes a client that is correctly paging through results treat *"you have reached the end"* as *"the board was deleted"*. A missing card returned as `200 {}` makes every client write a null check that some client will forget.

RFC 9110 §15.5.5 defines 404 as being about the *target resource*:

> *"The 404 (Not Found) status code indicates that the origin server did not find a current representation for the target resource or is not willing to disclose that one exists."*

`/api/boards/{id}/cards` is a collection, and a collection with no members still has a representation — the empty list. `/api/cards/{missing}` has none. That is the whole rule, and it falls out of what the URI names rather than from a convention.

⚠️ Note the second clause: *"or is not willing to disclose that one exists"*. The specification explicitly sanctions returning 404 for a resource the caller may not see. That is the hook topic 11 hangs the 401/403/404 argument on; this page just needs you to know that a deliberate 404 is spec-conformant, not a hack.

## 404 or 410 for a soft-deleted card?

§15.5.11:

> *"The 410 (Gone) status code indicates that access to the target resource is no longer available at the origin server and that this condition is likely to be permanent."*

and §15.5.5 adds the selection rule:

> *"A 404 status code does not indicate whether this lack of representation is temporary or permanent; the 410 (Gone) status code is preferred over 404 if the origin server knows, presumably through some configurable means, that the condition is likely to be permanent."*

**Soft delete is exactly the case where you *do* know**, which is an argument for 410. It is also the case where the knowledge is a leak: a 410 tells the caller *this id existed and was deleted*, while a 404 tells them nothing. For a card on a board they are a member of, 410 is more useful and the disclosure is not a disclosure. For a card id they guessed, 410 is an existence oracle.

The defensible rule, and the one this chapter uses: **410 only after the ownership predicate has passed; 404 otherwise.** Which means the decision belongs in the DAL, where ownership is already known — not in the handler, which cannot tell the two cases apart.

## The projection belongs to the DAL, and the handler does not touch it

```ts
// lib/dal/cards.ts
import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { requireCardAccess } from '@/lib/dal/access'

/** The public shape of a card. Adding a column to the table does not add it here. */
export const CARD_COLUMNS = {
  id: cards.id,
  boardId: cards.boardId,
  title: cards.title,
  body: cards.body,
  status: cards.status,
  position: cards.position,
  version: cards.version,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
} as const

export type CardDTO = {
  id: string
  boardId: string
  title: string
  body: string | null
  status: 'todo' | 'doing' | 'done'
  position: number
  version: number
  createdAt: Date
  updatedAt: Date
}

export async function getCard(cardId: string): Promise<CardDTO | null> {
  await requireCardAccess(cardId)          // ownership, before any row is returned

  const [card] = await db
    .select(CARD_COLUMNS)
    .from(cards)
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
    .limit(1)

  return card ?? null
}
```

```ts
// app/api/cards/[cardId]/route.ts
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/cards/[cardId]'>,
) {
  const { cardId } = await ctx.params
  const id = CardIdParam.safeParse(cardId)
  if (!id.success) return errorResponse(400, 'invalid_card_id', 'cardId must be a UUID')

  const card = await getCard(id.data)
  if (!card) return errorResponse(404, 'not_found', 'No such card')

  return Response.json(card)          // no reshaping, no field renaming, no filtering
}
```

**Three reasons the handler must not reshape.**

**It creates a second definition of "a card".** If the handler maps `body` to `description`, there are now two contracts — the DAL's and the HTTP one — and only one of them is checked by the type system. The Server Action calling the same DAL function returns the other shape, so two clients of the same data see different field names.

**It moves the leak surface away from the query.** The explicit `CARD_COLUMNS` projection is what stops a future `internalNotes` column reaching a client. If the handler is also filtering fields, the safety of the endpoint depends on two places agreeing, and a reviewer looking at the query sees a projection that is already correct and stops reading.

**It defeats caching.** [06e](06e-caching-a-collection.md) puts `use cache` around a DAL function, and what gets cached is that function's return value. Post-processing in the handler runs on every request regardless, so any work you move there is work the cache cannot save you.

The Next.js data-security guide makes the same argument for the DAL generally:

> *"A Data Access Layer should: Only run on the server. Perform authorization checks. Return safe, minimal **Data Transfer Objects (DTOs)**."*

## The soft-delete predicate, and how to stop forgetting it

`deletedAt` belongs to topic 08 and its behaviour is not this topic's to define. **Its consequence for reads is entirely this topic's problem:** every query that returns cards must exclude soft-deleted rows, and there is no compiler, no type and no test that will notice when one does not.

The symptom is specific and nasty. A deleted card reappears — in a list, in a search result, in a count, in a CSV export — and only in the one code path that forgot the predicate. Nobody can reproduce it, because every other path is correct.

🔴 **Do not solve this with discipline.** Solve it structurally, with one of three mechanisms.

**A shared base condition**, cheapest and least reliable, because a new query can still be written without it:

```ts
// lib/dal/cards.ts
const live = () => isNull(cards.deletedAt)

const [card] = await db.select(CARD_COLUMNS).from(cards)
  .where(and(eq(cards.id, cardId), live()))
```

**A single entry point per table**, so there is no way to build a card query without going through the predicate:

```ts
// lib/dal/cards.ts — the ONLY place `from(cards)` appears
function liveCards() {
  return db.select(CARD_COLUMNS).from(cards).where(isNull(cards.deletedAt))
}

export async function getCard(cardId: string) {
  await requireCardAccess(cardId)
  const [card] = await liveCards().where(eq(cards.id, cardId)).limit(1)
  return card ?? null
}
```

⚠️ **In Drizzle 0.45.2 a second `.where()` replaces the first rather than appending to it.** Read from the published build, `pg-core/query-builders/select.js`: the method body is `this.config.where = where; return this;` — a plain assignment, not a composition. The snippet above is therefore a trap in the exact form written — the `isNull` is discarded. Compose the conditions instead:

```ts
function liveCardsWhere(extra?: SQL) {
  return db.select(CARD_COLUMNS).from(cards).where(and(isNull(cards.deletedAt), extra))
}
const [card] = await liveCardsWhere(eq(cards.id, cardId)).limit(1)
```

**A database view**, the only mechanism a new query cannot bypass by accident:

```sql
CREATE VIEW live_cards AS
  SELECT id, board_id, title, body, status, position, version,
         created_at, updated_at
    FROM cards
   WHERE deleted_at IS NULL;
```

Point the read path at the view and the predicate cannot be omitted, because it is not in the query. The cost is that the view is a second schema artefact to migrate, and that writes still go to the table — so this is a read-path mechanism, not a general one.

## The `Date` that is a string by the time the client sees it

`CardDTO` declares `createdAt: Date`, and `Response.json` serialises with `JSON.stringify`, which calls `Date.prototype.toJSON` and produces an ISO 8601 string. **So the type your DAL exports and the type your client receives are different types, and nothing warns you.**

This matters more than it looks, because pagination cursors are built from `createdAt` ([06d](06d-keyset-pagination.md)) and a client that round-trips the value has a string where the server had a `Date`. Make the wire shape explicit rather than implicit:

```ts
/** What the DAL returns, in-process. */
export type CardDTO = {
  id: string
  createdAt: Date
  updatedAt: Date
  // ...the rest as above
}

/** What crosses the wire. Different type, deliberately. */
export type CardWire = Omit<CardDTO, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

export function toWire(card: CardDTO): CardWire {
  return {
    ...card,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  }
}
```

That `toWire` is not the reshaping this page just forbade — it is a serialisation boundary, it is total, it changes no field names, and it exists so the client-facing type is written down instead of inferred from `JSON.stringify`'s behaviour. Keep it in the DAL module beside the DTO, not in the handler.

## Gotchas

**★ Symptom: a client paging through a board treats the last page as a deleted board.** Cause: the collection endpoint returned 404 when the query matched no rows. Fix: an empty collection is `200` with `[]`. The collection resource exists — §15.5.5 is about the server not finding *"a current representation for the target resource"*, and an empty list is a perfectly good representation of an empty board.

**★ Symptom: a deleted card reappears in one screen and not the others.** Cause: one query is missing `isNull(cards.deletedAt)`, and nothing type-checks that predicate. Fix: make it structural rather than remembered — a single composed entry point per table, or a `live_cards` view the read path uses. Discipline does not survive the tenth query.

**★ Symptom: filtering by `deletedAt` was added and the query now returns everything.** Cause: in Drizzle 0.45.2 a second `.where()` on a builder replaces the first rather than appending, so a helper that pre-applies a predicate loses it as soon as the caller adds one. Fix: compose the conditions with `and()` and pass them in one call:

```ts
// ❌ the isNull is replaced and silently lost
liveCards().where(eq(cards.id, cardId))
// ✅ one where(), both conditions
db.select(CARD_COLUMNS).from(cards).where(and(isNull(cards.deletedAt), eq(cards.id, cardId)))
```

**★ Symptom: a new column added by a migration shows up in the API the same day.** Cause: the query used `db.select().from(cards)` with no projection, so it widens automatically with the table. Fix: always project explicitly with `CARD_COLUMNS`. The friction of adding a field in two places is the feature — it is what makes exposing a column a decision rather than an accident.

**★ Symptom: the client's TypeScript says `createdAt` is a `Date` and `.getTime()` throws at runtime.** Cause: `Response.json` calls `JSON.stringify`, which converts a `Date` to an ISO string via `toJSON`, so the wire type and the server type differ and the shared type declaration lies. Fix: declare the wire type separately and convert explicitly, as `toWire` above does. Sharing the server DTO type with the client is the mistake, not the serialisation.

**★ Symptom: two endpoints return the same card with different field names.** Cause: one handler reshaped and the other did not. Fix: the projection lives in the DAL and handlers serialise it unchanged. If the shape genuinely needs to differ, that is a second named projection in the DAL — `CARD_SUMMARY_COLUMNS` — not an ad-hoc `map` in a route file.

**★ Symptom: a 410 on a guessed card id reveals that the id was real.** Cause: the deleted/never-existed distinction was made before the ownership check. Fix: 410 only after the caller has been shown to have access to the card's board; 404 in every other case, which the specification explicitly permits — *"or is not willing to disclose that one exists."*

**★ Symptom: the ownership check runs after the query, on the row that came back.** Cause: the handler fetched first and then compared `card.boardId` to the caller's boards. Fix: check before you read. Fetching first means the row is in memory, in logs, in a trace payload and in an error message before anybody established the caller was allowed to have it — and the version that returns early on `!card` skips the check entirely for ids that do not exist, which is how a timing difference becomes an existence oracle.

**★ Symptom: `GET /api/cards/[cardId]` returns 500 for a malformed id.** Cause: the path parameter was passed straight to a `uuid` column and PostgreSQL raised `22P02`. Fix: validate path parameters as input — the same argument as [05b](05b-validating-at-the-boundary-with-zod.md), and the same one-line `safeParse` guard.

**★ Symptom: the collection endpoint returns every card on a board with ten thousand cards.** Cause: no `LIMIT`. Fix: a collection endpoint has a default page size and a maximum page size, both enforced server-side, and neither is optional — [06c](06c-offset-pagination-and-why-it-degrades.md). An unbounded read is a denial-of-service primitive that any client can trigger without meaning to.

## Interview questions

**★ Why is an empty collection a 200 and a missing member a 404, when both "found nothing"?**
Because the status code describes the *target resource*, not the result set. §15.5.5 says 404 means the server *"did not find a current representation for the target resource"* — and `/api/boards/{id}/cards` is a collection that exists and whose current representation is the empty list. There is a representation; it just has no members. `/api/cards/{missing}` names a member that does not exist, so there is genuinely no representation to return. The practical consequence is what a client does next: an empty 200 means "you have reached the end, stop paging", and a 404 means "this thing is gone, stop asking and remove it from your UI". Conflating them makes a client that finishes a page range conclude the board was deleted.

**★ When is 410 better than 404, and why does this chapter use it sparingly?**
410 is better when you know the absence is permanent — §15.5.5 says 410 *"is preferred over 404 if the origin server knows, presumably through some configurable means, that the condition is likely to be permanent"* — and a soft-deleted row is exactly that knowledge, written down in a column. The reason to be careful is that the knowledge is also a disclosure. Answering 410 tells the caller that this id was real and has been deleted, which is useful to a team member looking at a stale bookmark and is an existence oracle for someone enumerating ids. So the rule is to make the distinction only after the ownership predicate has passed, which also means the decision cannot live in the handler — the handler does not know why the row was absent, and the DAL does.

**★ Why must the handler not reshape what the DAL returns?**
Because it creates a second definition of the resource that nothing keeps in sync. The DAL's projection is the one a reviewer reads when asking "can this endpoint leak a column"; if the handler is also filtering or renaming, that review is now wrong, and the Server Action calling the same function returns a different shape to a different client. It also defeats caching: `use cache` wraps a function and stores its return value, so anything the handler does afterwards runs on every request no matter how warm the cache is. The one thing that legitimately belongs at the boundary is serialisation — turning a `Date` into an ISO string — and that should still be a named, total function next to the DTO rather than an inline `map` in a route file.

**★ Why is "remember to filter out deleted rows" the wrong solution, and what replaces it?**
Because the failure is silent and per-query. Nothing type-checks a `WHERE` clause, no test covers a query that has not been written yet, and the symptom — a deleted card appearing in one list and not another — surfaces weeks later as an unreproducible bug report. The replacement has to make the correct query the only one that is easy to write. The strongest form is a `live_cards` view, because a query against the view cannot omit a predicate that is not in it; the middle form is a single composed entry point per table in the DAL, so `from(cards)` appears exactly once in the codebase; the weakest is a shared `live()` helper, which still permits a new query written without it. And there is a version-specific trap in the middle form: in Drizzle 0.45.2 a second `.where()` replaces the first, so a helper that pre-applies the predicate loses it the moment a caller adds a condition, and the query silently starts returning tombstones.

**★ Your DTO type says `createdAt: Date` and the client's type says the same. What is wrong?**
The client's is a lie. `Response.json` serialises with `JSON.stringify`, which invokes `Date.prototype.toJSON` and emits an ISO 8601 string, so what actually arrives is a `string` and any `.getTime()` on it throws. Sharing the server DTO type with the client makes the compiler confirm a falsehood, which is worse than having no type at all, because it stops anyone checking. The fix is to declare the wire type separately — `Omit` the date fields and re-add them as `string` — and to convert with an explicit total function. It matters beyond neatness because cursors in keyset pagination are built from timestamps, so a client that round-trips one is round-tripping a string it must not silently reinterpret.

**★ Where does the ownership check go relative to the query, and why does the order matter?**
Before. If you fetch first and check the returned row afterwards, the row has already been materialised into your process — it can be in a log line, a trace attribute, an error message or a crash dump before anyone established the caller was entitled to it. Worse, the natural shape of that code returns early when nothing is found, which means the ownership check is skipped entirely for ids that do not exist, and the two paths take measurably different amounts of work. That difference is exactly the existence oracle the deliberate-404 pattern exists to close. Checking first — `requireCardAccess(cardId)` before `select` — makes the authorisation decision independent of whether the row is there, which is the property topic 11 needs.

---

← [05ea · The position value](05ea-the-position-value-and-concurrent-creates.md) · Next → [06b · Filtering and sorting without injection](06b-filtering-and-sorting-without-injection.md)
