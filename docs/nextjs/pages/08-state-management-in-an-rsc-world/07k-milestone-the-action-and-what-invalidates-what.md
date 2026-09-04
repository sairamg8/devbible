---
title: "Whether the card stays where the user dropped it is decided by one line in the Server Action — updateTag ships a re-render in the action's own response and revalidateTag under a stale-while-revalidate profile deliberately does not"
sidebar_label: "07k · Milestone: the action and the tags"
sidebar_position: 53
description: "Chapter 8's capstone, step six concluded: the moveCard action with validation, authorisation, optimistic-concurrency detection and rank computation; the snap-back bug caused by revalidateTag's stale-while-revalidate profile; the invalidation table for SprintDesk; and what to do when the board read was never cached."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`), the [`revalidateTag` reference](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
> (`lastUpdated: 2026-08-25`) and the [`refresh` reference](https://nextjs.org/docs/app/api-reference/functions/refresh)
> (`lastUpdated: 2026-06-25`). Target: **Next.js 16.3.4** App Router · **zod 4.4.3**.
> Documentation-verified; **no sandbox run**.

**The client half of the drop ([07j](07j-milestone-the-drop-the-action-and-reconciliation.md)) is finished and correct, and it will still produce a card that jumps back after a successful move — because whether the optimistic value expires onto fresh props or stale ones is decided entirely on the server.** Four functions can update caches after a mutation and they differ on one axis that nobody memorises: whether the action's own response carries a re-render. Pick the wrong one and the database is right, the cache is scheduled for refresh, and the user watches their card return to where it started. This page is the action itself — validation, authorisation, concurrency, ranks — and then the invalidation table that makes the drop actually stick.

## The action

```ts filename="app/(dashboard)/boards/[boardId]/actions.ts"
'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rankBetween, renormalise, needsRenormalise } from '@/lib/board/rank'

const moveSchema = z.object({
  cardId: z.string().regex(/^card_[a-z0-9]{1,24}$/),
  toColumnId: z.string().regex(/^col_[a-z0-9]{1,24}$/),
  toIndex: z.number().int().min(0).max(10_000),
  /** Optimistic-concurrency token: where the client believed the card was. */
  expectedColumnId: z.string().regex(/^col_[a-z0-9]{1,24}$/),
})

export type MoveResult =
  | { ok: true; title: string; columnName: string; index: number }
  | { ok: false; reason: 'invalid' | 'forbidden' | 'conflict' }

export async function moveCard(input: unknown): Promise<MoveResult> {
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const { cardId, toColumnId, toIndex, expectedColumnId } = parsed.data

  const session = await auth()
  if (!session?.user) return { ok: false, reason: 'forbidden' }

  // Ownership is re-read from the session, never taken from the client.
  const card = await db.card.findFirst({
    where: { id: cardId, board: { members: { some: { userId: session.user.id } } } },
    select: { id: true, title: true, columnId: true, boardId: true },
  })
  if (!card) return { ok: false, reason: 'forbidden' }

  const column = await db.column.findFirst({
    where: { id: toColumnId, boardId: card.boardId },
    select: { id: true, name: true, status: true },
  })
  if (!column) return { ok: false, reason: 'forbidden' }

  // Someone else moved it since this client last rendered.
  if (card.columnId !== expectedColumnId) return { ok: false, reason: 'conflict' }

  const siblings = await db.card.findMany({
    where: { columnId: toColumnId, NOT: { id: cardId } },
    orderBy: { rank: 'asc' },
    select: { id: true, rank: true },
  })

  const i = Math.max(0, Math.min(toIndex, siblings.length))
  const prev = i > 0 ? siblings[i - 1].rank : null
  const next = i < siblings.length ? siblings[i].rank : null

  await db.$transaction(async (tx) => {
    if (needsRenormalise(prev, next)) {
      const ordered = siblings.map((s) => s.id)
      ordered.splice(i, 0, cardId)
      await tx.card.updateMany({
        where: { id: cardId },
        data: { columnId: toColumnId, status: column.status },
      })
      for (const { id, rank } of renormalise(ordered)) {
        await tx.card.update({ where: { id }, data: { rank } })
      }
    } else {
      await tx.card.update({
        where: { id: cardId },
        data: {
          columnId: toColumnId,
          status: column.status,
          rank: rankBetween(prev, next),
        },
      })
    }
  })

  // 🔴 The line that decides whether the card stays where it was dropped.
  updateTag(`board:${card.boardId}`)

  return { ok: true, title: card.title, columnName: column.name, index: i }
}
```

### Why every guard is there

**The action is a public endpoint.** Not a metaphor:

> *"A Server Action runs as a POST request against the page that invokes it. … The implementation stays on the server, but the route is reachable to anyone who can send the same POST. Treat every action as an untrusted entry point."*
>
> *"**Authenticate and authorize.** Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."*
> — [Server Actions and Mutations, Security](https://nextjs.org/docs/app/guides/server-actions#security)

So the card is looked up *through the membership relation* rather than by id, and the destination column is verified to belong to the same board. Without the second check, a member of board A can move a card into a column of board B by sending one crafted POST — the card id passes the ownership check and the column id is never verified against anything.

**The return value is shaped, not raw.** The guide again: *"**Constrain return values.** Action returns are serialized to the client. Shape them to what the UI renders, not raw database records."* `MoveResult` carries a title, a column name and an index because those are what the announcement in [07i](07i-milestone-ranks-and-the-accessible-move-path.md) renders. Returning the `card` row would ship every column of that table, including any you add later.

**`expectedColumnId` is a concurrency token, not an authorisation input.** It is compared, never trusted: a client that lies about it gets a `conflict` result, which is a refusal, not an escalation. This is the cheap form of optimistic concurrency — a version column or an `updatedAt` comparison is stronger and costs a column.

## Now the line that matters

Four functions can update caches after a mutation, and the Server Actions guide separates them by what the action's own response carries:

> *"A re-render is included in the same response when the action does any of these: Calls `updateTag` or `revalidatePath` to immediately invalidate cached data. Calls `refresh` to refetch the current route's RSC Payload. Mutates cookies … Calls `redirect`."*
>
> *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response. The page reflects the change on a later read."*
> — [Server Actions and Mutations, *A single response carries data and UI*](https://nextjs.org/docs/app/guides/server-actions#a-single-response-carries-data-and-ui)

And from the reference for the one to use here:

> *"`updateTag`: immediate expiration of a tag. The next read (including the route re-render that ships with the action's response) waits for fresh data. Use when the action needs **read-your-own-writes** so the user immediately sees their change. Server Actions only."*
> — [Server Actions and Mutations, *Choosing a cache update*](https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update)

**Read-your-own-writes is exactly the requirement a drag-and-drop board has.** The user moved the card. They are looking at it. There is no version of "eventually consistent" that is acceptable when the alternative is the card visibly returning to its old column half a second after they let go.

## The snap-back, end to end

Written as a sequence, because it is the one bug in this milestone that requires holding four things in mind at once:

1. The user drops the card. `applyMove` runs inside the transition; the optimistic list has the card in `Done`.
2. The action runs. The database row is updated. The move is real and permanent.
3. The action calls `revalidateTag('board:b_12', 'max')`. The tag is marked stale; a background refresh is scheduled; **no re-render is included in the response**, by design.
4. The promise resolves. The transition ends.
5. `useOptimistic` stops returning the reducer's output and returns `value` — the `visible` prop from the render *before* the move.
6. The card is drawn back in `Doing`.
7. Some later navigation or read picks up the refreshed cache and the card is in `Done` again.

Nothing is broken. Every component did what it documents. The fix is one word:

```ts
// 🚩 correct data, wrong UX: no re-render in this response
revalidateTag(`board:${card.boardId}`, 'max')
// ✅ the action's response carries the post-move render
updateTag(`board:${card.boardId}`)
```

## SprintDesk's invalidation table

| Event | Invalidate | Function | Why |
|---|---|---|---|
| Card moved | `board:<id>` | **`updateTag`** | The user must see it now |
| Card renamed inline | `board:<id>` | **`updateTag`** | Same — they are looking at the text they typed |
| Card created from the quick-add box | `board:<id>` | **`updateTag`** | Read-your-own-writes |
| A webhook syncs an external tracker | `board:<id>` | `revalidateTag(tag, 'max')` | Nobody is waiting; stale-while-revalidate is ideal |
| A nightly job rebuilds labels | `labels:<orgId>` | `revalidateTag(tag, 'max')` | Background, no user in the loop |
| Board renamed | `board:<id>` **and** `boards:<userId>` | `updateTag` twice | Two cached reads hold the name |
| Activity feed entry written | — | *nothing* | The feed is uncached and re-read per render |
| Board deleted | `boards:<userId>`, then `redirect` | `updateTag` **before** `redirect` | `redirect` throws; code after it never runs |

The activity-feed row is the one worth arguing about, and it is deliberate: a panel that is cheap to read and expected to be roughly current does not need a tag at all. Tagging everything is not caution, it is a larger invalidation surface with more ways to be wrong.

## If the board read is not cached

`updateTag` expires a cache entry. If the board is read without `'use cache'` — the fifty-thousand-card case from [07c](07c-milestone-reading-filters-in-the-page.md), where the filtered query goes straight to the database — there is no entry, so `updateTag` has nothing to expire and the response carries no re-render for it to trigger. The card snaps back for a completely different reason.

That is what `refresh()` is for:

> *"`refresh`: refetch the current route's RSC Payload without invalidating cached data. Use when the view depends on state outside the cache that the action just changed."*
> — [Server Actions and Mutations, *Choosing a cache update*](https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update)

The mechanics, the Server-Actions-only restriction and the case where `refresh()` silently does nothing are covered in [10 · `refresh()`](10-refresh.md), and the full five-way comparison is [10b](10b-refresh-against-the-alternatives.md). Do not re-derive them here — the decision for this action is only: *was the thing I changed in a cache?* If yes, `updateTag`. If no, `refresh()`.

## Gotchas

**★ Symptom: the move is saved but the card jumps back to its old column immediately.** Cause: `revalidateTag` with a stale-while-revalidate profile, which the docs state does **not** include a re-render in the action's response, so the optimistic value expires onto pre-move props. Fix: `updateTag(tag)` for anything the acting user is looking at. If you must use `revalidateTag`, `{ expire: 0 }` forces the next read to block rather than serve stale — but `updateTag` is the function designed for this and is Server-Actions-only for exactly this reason.

**★ Symptom: the board updates, and so does every other page on the site, and cold-start latency spikes.** Cause: `revalidatePath('/')` used as a big hammer. It invalidates by URL path, and the root path is every route. Fix: invalidate the tag you actually changed. `revalidatePath` is right when one route is affected and tagging would be overkill — not as a substitute for knowing what changed.

**★ Symptom: an action redirects after a mutation and the destination shows stale data.** Cause: the invalidation was placed after `redirect`, which throws a control-flow exception, so the line never ran. Fix: invalidate first:

```ts
updateTag(`boards:${session.user.id}`)
redirect('/boards')
```

**★ Symptom: `updateTag` runs and nothing changes.** Cause: the tag string does not match the one `cacheTag` assigned — usually a template-literal typo, a different id variable, or a tag over the length limit. The reference is explicit that *"Tags are case-sensitive and must not exceed 256 characters. A tag that exceeds the limit is never assigned to cached data, so revalidating it does nothing."* Fix: build every tag through one helper so the read and the write cannot disagree:

```ts
export const boardTag = (id: string) => `board:${id}`
// query.ts: cacheTag(boardTag(boardId))
// actions.ts: updateTag(boardTag(card.boardId))
```

**★ Symptom: a card can be moved into another board's column.** Cause: the destination column id was validated for shape and never checked against the card's board. Fix: the `db.column.findFirst({ where: { id: toColumnId, boardId: card.boardId } })` lookup, which turns a cross-board move into a `forbidden` result. Shape validation cannot catch this — the guide's own wording is that a well-formed object can still refer to a row the caller does not own.

**★ Symptom: two users drag the same card and one user's move silently disappears.** Cause: last-write-wins with no concurrency check, so the second write overwrites the first and neither user is told. Fix: `expectedColumnId` compared against the row's current column, returning `conflict` when they differ. The client then reverts with a message rather than pretending the move happened, which is the `reason === 'conflict'` branch in [07j](07j-milestone-the-drop-the-action-and-reconciliation.md).

**★ Symptom: after a renormalisation, some cards in the column have new ranks and some do not.** Cause: the renormalising updates ran outside a transaction and something failed partway. Fix: one `$transaction` around the move and the renormalisation together, as above. A half-renormalised column is worse than an unnormalised one, because the ordering is now genuinely wrong rather than merely tight.

**★ Symptom: a bulk move of nine selected cards fails with a request-size error.** Cause: the action's payload exceeded the limit — *"Action requests are capped at 1MB by default"* — which happens when the client sends card objects rather than ids. Fix: send ids. Nine ids is a few hundred bytes; nine card rows with descriptions is not. This is the same rule as the rank: references and changes, not contents.

**★ Symptom: actions fail intermittently after scaling to multiple instances.** Cause: closure variables in inline actions are encrypted at build time, and the guide requires a stable key across instances — *"set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable key shared across instances."* Fix: set it in the deployment environment. Nothing about the board's logic is involved, which is why this one takes so long to find.

**★ Symptom: the action returns and the announcement says `undefined moved to undefined`.** Cause: the result was shaped from data read *after* the update, or from a variable that the transaction's callback scoped away. Fix: capture what you need from the pre-update reads (`card.title`, `column.name`) and return those; they cannot change during the transaction because the transaction is the only writer of that row in this request.

**★ Symptom: an action that only reads returns stale data to the caller.** Cause: expecting an action's return value to reflect a `revalidateTag` fired in the same action. It does not: the tag is marked for background refresh, and the action's own subsequent reads may still be served the stale entry. Fix: if the action must read its own write, either read from the database directly rather than through the cached function, or use `updateTag`, whose documented behaviour is that the next read waits for fresh data.

## Interview questions

**★ Why `updateTag` rather than `revalidateTag` for a drag-and-drop move?**
Because the user is looking at the thing they changed. `updateTag` expires the tag immediately and the route re-render that ships in the action's response waits for fresh data, so the response carries the post-move UI and the optimistic value expires onto correct props. `revalidateTag` with a stale-while-revalidate profile is documented as deliberately *not* including that re-render — it schedules a background refresh and the page reflects the change on a later read. That is exactly right for a webhook and exactly wrong for a gesture, because the visible consequence is the card jumping back to where it started.

**★ When is `revalidateTag` the right choice, then?**
When nobody is waiting. A webhook syncing an external tracker, a nightly job, an admin bulk edit whose effects users will see whenever they next load — all of these want stale-while-revalidate, because blocking a read on a refresh nobody asked for is a latency cost with no user-visible benefit. The docs describe it as ideal for content where a slight delay is acceptable, and note that revalidation is triggered by a request rather than by the call, so pages refresh as they are visited rather than all at once. The question to ask is "is there a person at the other end of this mutation, watching?"

**★ What is the cost of reaching for `revalidatePath` instead of a tag?**
Blast radius. `revalidatePath` invalidates by URL, so it discards everything cached under that route regardless of whether your mutation had anything to do with it — and `revalidatePath('/')` discards essentially everything. It is the right tool when one route is affected and setting up tags would be more machinery than the case deserves. It is the wrong tool as a default, because the failure mode is invisible: nothing breaks, the site is just colder and slower than it should be, and no error points at the line that caused it.

**★ Your board read is not cached at all. What happens when the action calls `updateTag`?**
Nothing useful. `updateTag` expires a cache entry, and there is no entry to expire, so the response carries no re-render triggered by it and the optimistic value expires onto the props from the previous render — the same visible symptom as the stale-while-revalidate bug, from a different cause. The correct call is `refresh()`, which re-renders the current route inside the action's own response without invalidating anything. The decision rule is one question: was the thing I changed in a cache?

**★ How do you detect that another user moved the card while this user was dragging it?**
Send what the client believed to be true — the card's current column — and compare it on the server. If they differ, someone else got there first and the action returns a `conflict` result rather than overwriting. The important part is that the token is *compared*, never *trusted*: a client that sends a false `expectedColumnId` gets a refusal, not an escalation, so this is optimistic concurrency and not an authorisation input. A monotonic version column is the stronger form and detects same-column reorders too, which a column comparison misses.

**★ The form is only rendered on an authenticated page. Isn't that enough?**
No, and the guide says so in as many words: render-time gating is not a security boundary because requests can be sent without going through the UI. A Server Action is a POST endpoint reachable by anyone who can construct the request. The framework gives you a CSRF origin check, a body size limit and encrypted action ids, and none of those establishes *who* is asking or *what* they may touch. Every action authenticates, authorises against the specific row through a relation the session controls, validates its inputs, and shapes its return value — four checks, every time, including the ones that "obviously" cannot be reached.

**★ Why does the action re-read the column's siblings instead of trusting the index the client computed?**
Because the index was computed against a DOM that reflects a render that may be several seconds old, and against a filtered view that may not contain every card in the column. Re-reading gives the server the true neighbours at that position, lets it clamp an out-of-range index rather than failing, and means the rank it writes is computed from data it just read inside the same transaction. The client's index is a statement of intent — "about here" — and the server's job is to turn intent into a value that is correct against the current state.

---

← [07j · The optimistic drop](07j-milestone-the-drop-the-action-and-reconciliation.md) · [Chapter 8 overview](01-explanation.md) · Next → [07l · What this design costs](07l-milestone-what-it-costs-and-where-it-generalises.md)
