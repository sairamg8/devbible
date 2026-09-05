---
title: "A cached function cannot read `cookies()`, so the ownership check cannot live inside the cache — which forces the useful split: cache the board-scoped data that is identical for every member, and run the per-caller authorisation outside it, on every request"
sidebar_label: "06e · Caching a collection"
sidebar_position: 42
description: "Why use cache must be extracted from a Route Handler body, the runtime-API restriction that dictates where authorisation goes, per-board cacheTag, why updateTag is unavailable on a REST surface, what an invalidation reaches on more than one instance, and the coalescing question the documentation does not answer."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js documentation — [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run, no timings, no hit rates.**
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Caching a collection looks like a performance decision and is actually an architecture decision, because the framework's constraint on what a cached function may read decides where your authorisation check has to go. `use cache` forbids `cookies()` and `headers()` inside the cached scope and follows the call stack while doing it — so the moment you try to cache a function that identifies the caller, it fails. The right response is not to work around it. It is to notice that the constraint is describing a correct design: a board's card list is the same bytes for every member of that team, so it should be cached once per board and authorised once per request.**

## `use cache` cannot live in the handler

The Route Handlers guide is explicit:

> *"`use cache` cannot be used directly inside a Route Handler body; extract it to a helper function. Cached responses revalidate according to `cacheLife` when a new request arrives."*

and describes the model:

> *"When Cache Components is enabled, `GET` Route Handlers follow the same model as normal UI routes in your application. They run at request time by default, can be prerendered when they don't access uncached or runtime data, and you can use `use cache` to include uncached data in the static response."*

with the list of things that stop prerendering:

> *"Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`, `headers()`, `connection()`, or non-deterministic operations."*

A card-list handler does all of those. It reads `request.nextUrl.searchParams`, it reads a session cookie, and it queries a database. So it runs at request time, and the only thing you can cache is a helper it calls.

⚠️ **That default is recent enough to be worth knowing.** The `route.js` version history records `v15.0.0-RC` — *"The default caching for `GET` handlers was changed from static to dynamic"* — so material written against Next.js 14 describes `GET` handlers being cached by default, which is the opposite of what happens on this pin. If you are reading a tutorial that says your list endpoint is already cached, check its date before believing it.

## The restriction that decides your architecture

The `use cache` reference states it, and states that it propagates:

> *"Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`, and the restriction follows the call stack: a helper the cached function calls that reads one of these fails the same way, with the `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`. Read these values outside the cached scope and pass them as arguments."*

🔴 **"The restriction follows the call stack" is the sentence that matters.** `requireBoardAccess` reads a session from `cookies()`. So a cached `listCards` that calls it fails — not with a type error at build, but at runtime, on a dynamically rendered route, which the reference warns *"can pass `next build` and fail under `next start`."*

The framework is telling you something true. **The board's card list does not depend on who is asking.** Every member of the team sees identical bytes. Caching it per caller would be wrong even if it were possible — it would multiply the entries by the number of members and invalidate them all on one write.

So the split is:

```ts
// lib/dal/cards.ts
import 'server-only'
import { cacheTag, cacheLife } from 'next/cache'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

/**
 * Cached. Takes only serialisable arguments, reads no runtime API, and
 * returns data that is identical for every member of the board.
 */
async function readBoardCards(
  boardId: string,
  limit: number,
  cursorCreatedAt: string | null,
  cursorId: string | null,
): Promise<CardDTO[]> {
  'use cache'
  cacheTag(`board:${boardId}:cards`)
  cacheLife('minutes')

  const after =
    cursorCreatedAt && cursorId
      ? sql`(${cards.createdAt}, ${cards.id}) < (${new Date(cursorCreatedAt)}, ${cursorId})`
      : undefined

  return db
    .select(CARD_COLUMNS)
    .from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt), after))
    .orderBy(desc(cards.createdAt), desc(cards.id))
    .limit(limit + 1)
}

/**
 * NOT cached. Authorises the caller, then reads through the cache.
 * The check runs on every request; the query does not.
 */
export async function listCards(boardId: string, q: ListCardsInput) {
  await requireBoardAccess(boardId)          // reads cookies() — outside the cache

  const cursor = q.cursor ? decodeCursor(q.cursor) : null
  const rows = await readBoardCards(
    boardId,
    q.limit,
    cursor ? cursor.createdAt.toISOString() : null,
    cursor ? cursor.id : null,
  )

  const hasMore = rows.length > q.limit
  const items = hasMore ? rows.slice(0, q.limit) : rows
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  }
}
```

⚠️ **The cursor is passed as two primitives, not as a `Date` object.** The reference requires that *"Arguments to cached functions and their return values must be serializable"*, and a `Date` inside the cache key is a shape you would rather control explicitly than discover. Reconstructing it inside the cached function keeps the key a pair of strings.

🔴 **Note what is missing from the cached function's arguments: the caller.** That is the property that makes the cache useful. Add a `userId` parameter — even one you do not use — and you have multiplied the number of entries by your team size for no benefit, because the cache key is composed from the arguments:

> *"A cache entry's key is generated using a serialized version of its inputs, which includes: 1. **Build ID** … 2. **Function ID** - A secure hash of the function's location and signature in the codebase 3. **Serializable arguments** … 4. **HMR refresh hash** (development only)"*

and closures count:

> *"When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key."*

That second sentence is a trap worth naming: a cached function that closes over a request-scoped variable silently gains it as a key component, so the entry is per-request and the cache never hits.

## Tagging per board, and what a tag can hold

``cacheTag(`board:${boardId}:cards`)`` scopes invalidation to the board a write touched. The limits are documented:

> *"**Limits**: A single `cacheTag()` call accepts up to 128 tags, each with a maximum length of 256 characters. Tags longer than 256 characters are skipped, and any tags past the 128th in one call are dropped. Both cases log a console warning."*

and

> *"**Idempotent Tags**: Applying the same tag multiple times has no additional effect."*

A UUID-based tag is around thirty characters, so the length limit is not a practical constraint here — but it is a real one for anyone tempted to build a tag out of a serialised filter object, which will exceed 256 characters and then be *silently skipped*. A skipped tag is a cache entry that nothing can ever invalidate.

## 🔴 `updateTag` is not available to you, and that changes the guarantee

The `updateTag` reference is unambiguous:

> *"`updateTag` can **only** be called from within Server Actions. It cannot be used in Route Handlers, Client Components, or any other context."*

> *"If you need to invalidate cache tags in Route Handlers or other contexts, use `revalidateTag` instead."*

And the two are not equivalent. `updateTag` gives read-your-own-writes:

> *"`updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache, ensuring users see their changes immediately."*

`revalidateTag` does not:

> *"Calling `revalidateTag` marks the tagged data as stale. The next request for that data kicks off a revalidation and is served stale content while it runs, using stale-while-revalidate semantics."*

**So on this chapter's REST surface, a client that POSTs a card and immediately GETs the list may legitimately receive a list without it.** That is not a bug and it is not fixable from the Route Handler; it is what the available primitive does.

Three honest responses:

**Return the created card from the POST** and let the client insert it locally. The create response already carries the full row from `RETURNING` ([05](05-create.md)), so the client never needs to re-read to see its own write.

**Invalidate with a zero window** where correctness genuinely outranks latency — `revalidateTag(tag, { expire: 0 })`, which the reference describes as *"Stale content is never served, so the next request is a blocking revalidate/cache miss. Use it when the caller needs the data gone immediately and you cannot use `updateTag`."* Every reader of that board then blocks on the next render, which on a broad tag is a self-inflicted thundering herd.

**Do the mutation in a Server Action** where `updateTag` is available. That is the right answer for the SprintDesk UI and the wrong one for a public API, which is precisely why the chapter has both entry points.

```ts
// app/api/boards/[boardId]/cards/route.ts
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest, ctx: RouteContext<'/api/boards/[boardId]/cards'>) {
  const { boardId } = await ctx.params
  // ...validate, create...
  revalidateTag(`board:${boardId}:cards`, 'max')   // second argument is required
  return Response.json(card, { status: 201, headers: { Location: `/api/cards/${card.id}` } })
}
```

⚠️ **The second argument is not optional any more.** The reference: *"The single-argument form `revalidateTag(tag)` is deprecated. It currently works if TypeScript errors are suppressed, but this behavior may be removed in a future version."* And *"No second argument (deprecated): Behaves like `{ expire: 0 }`"* — so the deprecated short form is the *blocking* one, which is the opposite of what most people assume they are writing.

## What an invalidation actually reaches

This is the seam the SprintDesk milestone numbers as six, and it does not go away because you are on a REST endpoint.

`revalidateTag` runs on the instance that handled the mutation. The `use cache` reference describes the runtime picture:

> **Serverless** — *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."*

> **Self-hosted** — *"Cache entries persist across requests."*

So on a serverless deployment the framework cache may not survive between requests at all, which makes the invalidation question moot and the caching largely ineffective; on a multi-instance self-hosted deployment the entries persist per instance and an invalidation reaches one of them. Either way you need to know which of your layers a mutation touches — the argument and the shared-cache-handler answer are in [ch15 · 05h](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md).

And there is a third layer this page does own: **the `Cache-Control` header on your response is a different cache from the framework's, and `revalidateTag` does not touch it.** If you send `Cache-Control: public, max-age=60` on a card list, a CDN and every browser will serve it for sixty seconds regardless of what you invalidate server-side.

```ts
// A per-board list is not public. Say so, or a shared cache will serve
// one team's board to another.
return Response.json(page, {
  headers: { 'Cache-Control': 'private, no-store' },
})
```

🔴 **`public` on any response gated by an ownership check is a data leak**, because a shared cache keyed on the URL alone will serve it to the next caller. If you want a shared cache to hold it, the URL must be the whole key — which for an authorised resource it is not.

## The coalescing question, which is still open

If a board's cache entry goes stale and twenty requests arrive at once, do you get one background regeneration or twenty?

**I do not know, and neither does the documentation.** [ch6 · 03b](../06-ssg-isr-and-ssr-strategy/03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md) records this as an explicit non-answer after reading the ISR guide, `cacheLife`, and the *How revalidation works* page — none of which mentions a lock, single-flight, request coalescing or in-flight deduplication. That is unchanged as of this page's verification date, and I am not going to resolve it by assertion.

Engineer for the pessimistic case, which costs nothing if the optimistic one is true: keep the cached function's work small — one indexed keyset query rather than a fan-out — so that duplicate regenerations converge on cheap reads, and measure duplicate queries against the database rather than inferring them from the framework.

## Gotchas

**★ Symptom: `use cache` at the top of a `GET` handler produces a build or runtime error.** Cause: it is not permitted there — *"`use cache` cannot be used directly inside a Route Handler body; extract it to a helper function."* Fix: put the directive in the data function the handler calls, which is where you want it anyway, because that function is the thing with a stable cache key.

**★ Symptom: a cached list function fails with `next-request-in-use-cache`, and it does not call `cookies()` anywhere.** Cause: a helper it calls does — the reference says *"the restriction follows the call stack"*, so `requireBoardAccess` reading a session is enough. Fix: hoist the authorisation out of the cached scope. The cached function takes a `boardId` and returns board-scoped data; the caller authorises and then reads through it.

**★ Symptom: the error appears under `next start` and never in `next build`.** Cause: on a dynamically rendered route the runtime-API access surfaces when the route runs, and the reference states plainly that this *"can pass `next build` and fail under `next start`."* Fix: exercise cached data paths in a production-mode smoke test, not just a build. A green build is not evidence for this class of failure.

**★ Symptom: the cache never hits and every request re-queries.** Cause: something request-scoped became part of the key. Either it was passed as an argument, or it was closed over — *"When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key."* Fix: give the cached function an explicit, minimal parameter list of primitives, and define it at module scope so it cannot close over a request.

**★ Symptom: a client creates a card and the immediately-following list request does not contain it.** Cause: `revalidateTag` is stale-while-revalidate — *"The next request for that data kicks off a revalidation and is served stale content while it runs"* — and `updateTag`, which blocks for read-your-own-writes, *"can only be called from within Server Actions."* Fix: return the created row from the POST so the client does not need to re-read; the `RETURNING` projection already has it. If a blocking invalidation is genuinely required, `revalidateTag(tag, { expire: 0 })` does it, at the cost of making every reader of that board block.

**★ Symptom: `revalidateTag(tag)` compiles and behaves like a blocking invalidation.** Cause: the deprecated single-argument form *"Behaves like `{ expire: 0 }`"*, which is the blocking variant — the opposite of what most people assume the short form does. Fix: always pass the profile. `revalidateTag(tag, 'max')` for the stale-while-revalidate behaviour the reference recommends.

**★ Symptom: a tag built from a filter object silently stops invalidating anything.** Cause: it exceeded 256 characters, and *"Tags longer than 256 characters are skipped"* — with a console warning nobody reads in production. Fix: tags are short, structured identifiers — `board:<uuid>:cards` — not serialised state. If you need a tag per filter combination, you need a different cache design, because the number of entries is now unbounded.

**★ Symptom: a mutation invalidates and half the users still see stale data, with no errors.** Cause: `revalidateTag` reached the instance that handled the mutation and no others. Fix: enumerate your cache layers and know which one a mutation actually reaches — [ch15 · 05h](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md). This is the SprintDesk milestone's sixth seam and it is not made easier by being on a REST endpoint.

**★ Symptom: caching a serverless deployment appears to do nothing.** Cause: documented — *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation."* Fix: this is a platform property, not a bug in your code. If the framework cache cannot persist, move the caching to a layer that can — a shared cache handler, or the CDN for genuinely public data — and stop paying the invalidation complexity for a cache that is not holding anything.

**★ Symptom: one team's board appears in another team's browser.** Cause: `Cache-Control: public` on an authorised response, so a shared cache keyed on the URL served it to the next caller. Fix: `private, no-store` on anything the ownership predicate gates. A response is only safely `public` when the URL alone determines the body, and an authorised resource is by definition one where it does not.

**★ Symptom: invalidation works and the CDN still serves the old list.** Cause: `revalidateTag` operates on the framework's data cache; the CDN is a separate layer with its own lifetime driven by the `Cache-Control` you sent. Fix: know your three layers and address each explicitly — the framework tag, the other instances, and the CDN. A single call reaches one of them.

**★ Symptom: every page of a paginated list is a separate cache entry, and one write invalidates all of them.** Cause: correct behaviour — the cursor is part of the key, and the tag is per board. Fix: this is usually the right trade and worth being deliberate about. Cache the first page, which is what most callers request and what a fresh visitor always gets, and consider leaving deep pages uncached rather than accumulating entries that are each read once and invalidated by any write to the board.

## Interview questions

**★ Why does the runtime-API restriction on `use cache` end up being an architectural constraint rather than an inconvenience?**
Because it forces you to answer *what is this cache entry keyed by*, and the honest answer decides your design. A cached function cannot call `cookies()`, and the reference says the restriction *"follows the call stack"* — so any helper that identifies the caller is off-limits too, which means your authorisation check cannot be inside the cached scope. The workaround people reach for is passing the user id in as an argument, and that is worse than the error: the key now includes the caller, so the entry count multiplies by team size, the hit rate collapses, and every one of those entries is invalidated by the same single write. The constraint is pointing at the correct shape. A board's card list is identical bytes for every member, so it should be one entry per board, authorised per request outside the cache. The framework is refusing to let you build the wrong thing.

**★ Your API is REST-only, using Route Handlers. What can you not have, and what do you do instead?**
Read-your-own-writes through the cache. `updateTag` is the primitive that gives it, and the reference says it *"can only be called from within Server Actions. It cannot be used in Route Handlers"*; the available alternative, `revalidateTag`, is stale-while-revalidate by design, so a client that creates a card and immediately lists may not see it. The right response is to sidestep the need: the POST already returns the created row from `RETURNING`, so the client has the data and can update locally without re-reading. If a blocking invalidation is genuinely required, `revalidateTag(tag, { expire: 0 })` is documented for exactly the case where *"the caller needs the data gone immediately and you cannot use `updateTag`"* — at the cost of making the next reader of that board block on a render, which on a widely-read tag you have converted into a stampede you caused.

**★ Why is `revalidateTag(tag)` with no second argument a worse default than it looks?**
Because the deprecated short form is the *blocking* one. The reference says *"No second argument (deprecated): Behaves like `{ expire: 0 }`"*, so the ergonomic call people type when they want "just invalidate this" is the variant that makes the next request for every affected entry wait for a fresh render. On a narrow tag that is fine and often what you want; on a broad tag it is a self-inflicted thundering herd triggered by a single write. It also *"currently works if TypeScript errors are suppressed"* and may be removed, so code relying on it is depending on a suppressed error. `revalidateTag(tag, 'max')` is the form the documentation recommends and it means what people think the short form means.

**★ Do N concurrent requests to one stale cache entry cause one regeneration or N?**
I do not know, and the documentation does not say. [ch6 · 03b](../06-ssg-isr-and-ssr-strategy/03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md) records this as an explicit non-answer after reading the three most relevant pages — the ISR guide, `cacheLife`, and *How revalidation works*, the last of which is written for people implementing custom cache handlers and would be the natural place to state it. None of them mentions a lock, single-flight, coalescing or in-flight deduplication. What is bounded regardless is the user-visible consequence: on the stale-while-revalidate path nobody blocks, so the worst case is duplicated origin work rather than latency. So I would engineer for the pessimistic reading, which costs nothing if the optimistic one is true — keep the cached function's work to one indexed query so duplicate regenerations are cheap, and measure duplicate queries at the database rather than inferring framework behaviour.

**★ You invalidated the tag and users still see stale data. Name every layer that could be responsible.**
Four, and only one of them is what you invalidated. The framework data cache on the instance that ran the mutation — that one is now correct. The framework data cache on every *other* instance, which `revalidateTag` did not reach; on a self-hosted multi-instance deployment those entries persist and are stale, and closing that needs a shared cache handler. A CDN, holding the response because of the `Cache-Control` header you sent, on a lifetime that has nothing to do with your tags. And the browser's own HTTP cache, for the same reason. The tag mechanism addresses one layer; the other three are addressed by a shared handler, a purge, and a correct `Cache-Control` respectively. The most common production version of this is the second, because it produces the signature symptom of some users seeing fresh data and others stale with no pattern and no errors.

**★ Why is `Cache-Control: public` dangerous on this endpoint specifically, when the data is not secret within the team?**
Because "not secret within the team" is a statement about *who* may read it, and a shared cache keyed on the URL knows nothing about who. `GET /api/boards/{id}/cards` returns different-authorised content to different callers at the same URL, so a CDN or a corporate proxy that stores one team member's response will serve it to the next request for that URL — which may be someone with no access to that board at all. The rule is that a response is only safely `public` when the URL alone determines the body, and any resource behind an ownership predicate is by construction one where it does not. `private, no-store` is the correct header, and the framework's own cache — which is keyed by function and arguments on your server, not by URL in an intermediary — is where the caching should happen.

---

← [06d · Keyset pagination](06d-keyset-pagination.md) · Next → [06f · The N+1 on a card list](06f-the-n-plus-1-on-a-card-list.md)
