---
title: "The membership test belongs in the WHERE clause, not in an if-statement after the row is already in memory — because a check the function performs is a check a refactor can remove, and a filter the query carries is not"
sidebar_label: "06f · Milestone: authorization on reads"
sidebar_position: 32
description: "Chapter 10's capstone, step five: requireBoardAccess as the only door to a board, why the subject of a check is never a parameter, why membership goes in the query rather than in a check after it, and how request-time authorization composes with a cached-and-tagged board read whose inner function is deliberately unexported."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`) and the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`).
> Target: **Next.js 16.3.4** · React 19.2.8 · `@prisma/client` 7.10.0.
> Documentation-verified; **no sandbox run**.

**Authentication asks "who are you"; this page is about the harder question, which is "does this row belong to you", and the two ways of answering it are not equivalent.** Fetching a board and then checking membership works, and it leaves the row sitting in a variable one careless refactor away from being returned. Putting membership in the `WHERE` clause means the query cannot return a board the caller is not on — the check is not something the function does, it is something the function *is*. The three rules that fall out are: the subject of a check is never a parameter, the check lives in the data function rather than the component, and the cached read is unexported so that the only route to it goes past the check. What the framework should *say* to a rejected caller is a separate argument, and it is [06g](06g-milestone-hide-do-not-forbid.md).

## The vulnerability class, named

The Data Security guide names it and gives the distinction that matters:

> *"Beyond authentication (is the user logged in?), remember to check **authorization** (does this user have permission to act on this specific resource?). This prevents [Insecure Direct Object Reference (IDOR)](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) vulnerabilities"*
> — [Data Security, Authentication and authorization](https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization) (`lastUpdated: 2026-08-25`)

And the Server Actions guide's version of the same point, which is the one to keep in your head because it kills the assumption that validation is enough:

> *"A well-formed `Item` object can still refer to a row the caller does not own."*
> — [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`)

zod will tell you `boardId` is a string matching `^board_[a-z0-9]+$`. It has no opinion about whose board it is. **Shape validation and authorization are orthogonal, and confusing them is the single most common way a well-typed application leaks data.** The zod half of that pair is boundary validation, which this chapter's [02 · The schema as a trust boundary](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md) owns; this page is the other half.

## `requireBoardAccess` — one door

```ts filename="lib/dal/board.ts"
import 'server-only'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from './user'

export type BoardRole = 'member' | 'admin'

/** The DTO. Not a Board row — the caller's *relationship* to a board. */
export class BoardAccess {
  constructor(
    readonly boardId: string,
    readonly userId: string,
    readonly role: BoardRole,
  ) {}

  get canManageMembers(): boolean {
    return this.role === 'admin'
  }
}

/**
 * The ONLY way to establish that the current user may see a board.
 * Calls notFound() — not forbidden() — for a non-member. The argument is in 06g.
 */
export const requireBoardAccess = cache(
  async (boardId: string): Promise<BoardAccess> => {
    const user = await requireUser()

    const membership = await db.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
      select: { role: true },
    })

    if (!membership) {
      notFound()
    }

    return new BoardAccess(boardId, user.id, membership.role as BoardRole)
  },
)
```

Four properties, each deliberate.

**It returns a relationship, not a board.** `BoardAccess` carries the role, because "may I see this" and "may I remove a member from this" are different questions with the same answer source. A boolean return would have forced a second query for the role.

**It takes the user from `requireUser()`, never from an argument.** A `requireBoardAccess(boardId, userId)` signature is an authorization bypass with a nice name: any caller could pass someone else's id. The rule generalises — **the subject of an authorization check is never a parameter.**

**It calls `notFound()` rather than returning `null`.** A nullable return is a check the caller can forget. `notFound()` throws, so `requireBoardAccess` either returns access or does not return.

**It is wrapped in `cache()`.** A board page calls it from the page, from the column list and from the card detail; the membership row is read once per render pass.

## Then the read, with membership in the query anyway

Belt and braces, and the braces are the important half:

```ts filename="lib/dal/board.ts"
import { cacheTag } from 'next/cache'

export type BoardRead = {
  id: string
  name: string
  columns: { id: string; name: string }[]
  cards: {
    id: string
    columnId: string
    status: 'todo' | 'doing' | 'blocked' | 'done'
    assigneeId: string | null
    title: string
    rank: number
  }[]
}

/** The exported getter. Resolves identity, then delegates to the cached read. */
export async function readBoard(boardId: string): Promise<BoardRead> {
  const access = await requireBoardAccess(boardId)
  return readBoardById(access.boardId)
}

/**
 * Unexported on purpose. It takes a board id and no identity, so it MUST NOT
 * be reachable except through the getter above.
 */
async function readBoardById(boardId: string): Promise<BoardRead> {
  'use cache'
  cacheTag(`board:${boardId}`)

  const board = await db.board.findUniqueOrThrow({
    where: { id: boardId },
    select: {
      id: true,
      name: true,
      columns: {
        select: { id: true, name: true },
        orderBy: { position: 'asc' },
      },
      cards: {
        select: {
          id: true,
          columnId: true,
          status: true,
          assigneeId: true,
          title: true,
          rank: true,
        },
        orderBy: { rank: 'asc' },
      },
    },
  })

  return board
}
```

### Why the split, and why the inner function is not exported

This is [13 · Auth with Cache Components: sharing, caching and mutating](13-authentication-with-cache-components-sharing-caching-and-mutating.md)'s pattern applied to a board instead of a note list, and there are two independent reasons for the shape.

**The mechanical one.** `readBoardById` is a `'use cache'` scope, and a plain `'use cache'` scope may not read `cookies()`. `requireBoardAccess` reads the session, so it cannot live inside. The authorization has to happen *outside* the cached function and the cached function has to take only what identifies the resource.

**The security one, which is the reason the inner function has no `export`.** Page 13 states it for its own example: the inner function stays unexported so that no caller can request another user's data simply by passing a different id, and resolving identity inside the exported getter is what makes the arrangement safe. An exported `readBoardById(boardId)` is exactly the bypass this whole page exists to prevent, with a cache in front of it to make it fast.

🔴 **And the cache key rule that applies here.** Page 13 quotes the guide's bolded warning that *cache keys and tags are stored in plain text*. `board:${boardId}` is fine — an opaque id. `board:${user.email}` would put an email address into a plain-text tag list, in process memory and in any remote cache you configure. Tag on ids, never on identifiers a human recognises.

## The page, unchanged in shape

Chapter 8's board page gains three lines and loses nothing:

```tsx filename="app/(dashboard)/boards/[boardId]/page.tsx"
import { Suspense } from 'react'
import { parseFilters } from '@/lib/board/filters'
import { readBoard } from '@/lib/dal/board'
import { BoardUiProvider } from '@/providers/board-ui-provider'
import { FilterBar } from './filter-bar'
import { Board } from './board'
import { BoardSkeleton } from './board-skeleton'

export default async function BoardPage(
  props: PageProps<'/(dashboard)/boards/[boardId]'>,
) {
  const { boardId } = await props.params

  return (
    <BoardUiProvider key={boardId}>
      <header className="board-chrome">
        <Suspense fallback={<div className="filter-bar-skeleton" />}>
          <FilterBar />
        </Suspense>
      </header>

      <Suspense fallback={<BoardSkeleton />}>
        <BoardData boardId={boardId} searchParams={props.searchParams} />
      </Suspense>
    </BoardUiProvider>
  )
}

async function BoardData({
  boardId,
  searchParams,
}: {
  boardId: string
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)
  const board = await readBoard(boardId) // ← authorization happens in here
  return <Board board={board} filters={filters} />
}
```

Note what is **not** there: no `if (!access) notFound()` in the component, no `session` read, no role check around the render. Chapter 8's version had an explicit `requireBoardAccess` call in the component; this version deletes it, because the check moved inside `readBoard` where it cannot be omitted. **A check a component performs is a check a component can stop performing.**

## Gotchas

**★ Symptom: a URL from another team's Slack loads a board you are not on.** Cause: the page called `readBoardById(boardId)` directly, or an equivalent unfiltered query. Nothing was wrong with the id — it was well-formed and real. Fix: membership in the query, identity from the session, and the raw read unexported:

```ts
export async function readBoard(boardId: string) {
  const access = await requireBoardAccess(boardId)   // throws for a non-member
  return readBoardById(access.boardId)               // unexported below
}
```

**★ Symptom: a cached board read throws as soon as the authorization check is moved inside it.** Cause: `requireBoardAccess` reads the session, and a plain `'use cache'` scope may not call `cookies()`. Fix: keep the two apart — the exported getter authorizes at request time, the unexported cached function takes only the board id. That is the split shown above, and [13](13-authentication-with-cache-components-sharing-caching-and-mutating.md) has the full rule set.

**★ Symptom: the cached read is exported "for testing" and a year later something imports it.** Cause: the only thing preventing the bypass was that the function had no `export` keyword, and someone removed the obstacle for a good reason. Fix: keep it unexported and test through the getter with a stubbed session; if you must reach the raw read from a test, do it through a dedicated test entry point that is not part of the module's public surface. An `export` on that function is a review-stopping change and should be treated as one.

**★ Symptom: a `cacheTag` was built from the user's email so the tag would be readable in logs, and now emails are in the cache's tag list.** Cause: cache keys and tags are stored in plain text — in the default cache and in a remote one alike. Fix: tag on the opaque id. If you want readability in logs, log the mapping, not the tag.

**★ Symptom: `requireBoardAccess(boardId, userId)` exists because a background job needed to act on behalf of a user.** Cause: a legitimate need was solved by widening the security-critical function, and now every caller can pass any id. Fix: keep `requireBoardAccess` subject-less and give the job its own explicitly-named function that does not pretend to be a user check.

```ts filename="lib/dal/board.ts"
/** 🔴 System-only. No session. Every call site needs a comment saying why. */
export async function readBoardAsSystem(boardId: string): Promise<BoardRead> {
  return readBoardById(boardId)
}
```

The point is not that this is safer code — it is the same query. It is that `readBoardAsSystem` is greppable and `requireBoardAccess(id, userId)` is not.

**★ Symptom: the membership check is correct and the board page still shows a card from another board.** Cause: the board-level check passed and a card-level query did not filter by board — the classic "authorized at the wrong granularity". Fix: every query that takes an id from the client filters on the parent the caller was authorized for.

```ts
const card = await db.card.findFirst({
  where: { id: cardId, boardId: access.boardId }, // ← the parent, from the DAL
})
```

**★ Symptom: `requireBoardAccess` is called in the page component *and* inside `readBoard`, and someone deletes one of them as duplication.** Cause: it looks like duplication and it is not — one of them is the control and the other is a convenience. Fix: delete the one in the component, keep the one in the DAL, and let `cache()` make the double call free where both survive. The rule to state in review: **the check in the data function is never the one that gets removed.**

**★ Symptom: `findUniqueOrThrow` inside the cached read throws for a board id that a member legitimately holds.** Cause: the membership row outlived the board — the board was deleted and `BoardMember` had no cascade, so `requireBoardAccess` succeeded on a board that no longer exists. Fix: the `onDelete: Cascade` on `BoardMember.board` shown in [06b](06b-milestone-wiring-authjs-into-the-app-router.md). The `orThrow` variant is deliberate and stays: past the membership check, a missing board is a genuine invariant violation and should be loud.

**★ Symptom: the board loads for a removed member for up to a few minutes after they were removed.** Cause: `readBoardById` is cached and tagged on the board, and removing a member changes `BoardMember`, not `Board` — so nothing expired the entry. This one is subtler than it looks: the *authorization* is correct and immediate, because `requireBoardAccess` is uncached and queries the membership row on every request. Only the board *contents* would be stale, and the removed member never reaches them. Fix: nothing, for this case — and that is the payoff of keeping authorization outside the cached scope. If you had moved the membership test inside the cached function, you would have cached a permission.

## Interview questions

**★ Why put the membership test in the `WHERE` clause instead of fetching the row and checking afterwards?**
Because the two differ in what happens when someone edits the function later. With the check in the query, the row simply does not exist for an unauthorized caller — there is nothing in memory to accidentally return, log, or pass to a component. With the check after the fetch, the sensitive row is a live variable, and every subsequent edit is one early return away from leaking it. The database is also better at this than your code is: an index on `(boardId, userId)` makes it free, and the filter applies to every row rather than to the one you remembered to check.

**★ Where exactly does the authorization check go relative to a `'use cache'` boundary, and why can it not go inside?**
Outside, in an exported getter that then calls an unexported cached function. It cannot go inside because a plain `'use cache'` scope may not read `cookies()`, and the session read does. The unexportedness is the security half: the cached function takes a board id and no identity, so if it were reachable, passing any id would return any board. The exported getter resolves the session, throws for a non-member, and only then delegates — which also means the cache stays keyed on the board rather than on the viewer, so one entry serves every member of that board.

**★ What is wrong with `requireBoardAccess(boardId, userId)`?**
The `userId` parameter. The subject of an authorization check must come from the request's own credentials, never from an argument, because an argument is something a caller chooses. The signature invites exactly one bug — a caller that passes an id it received from the client — and that bug is invisible at the call site because the code looks like it is doing a check. If a background job genuinely needs to read a board without a session, give it a separate, alarmingly-named function, so that "no user check happened here" is greppable rather than inferable.

**★ zod validated the `boardId` and the request still returned someone else's data. Explain.**
Because validation and authorization answer different questions. zod confirms the input has the right *shape* — a string, matching a pattern, of a plausible length. It has no way to know whose board that id names; the Server Actions guide puts it as *a well-formed `Item` object can still refer to a row the caller does not own.* You need both, in that order: reject malformed input at the boundary so the rest of the code can assume structure, then resolve the caller from the session and constrain the query with it. Skipping either one produces a different bug, and skipping the second is the one that makes the news.

**★ The board page used to call `requireBoardAccess` and now does not. Is that a regression?**
No — it is the point of the refactor. The call moved into `readBoard`, which is the only function that can produce a board, so authorization now happens on every path that reads a board rather than on the paths whose authors remembered. A check performed by a component is a check a future component can omit; a check inside the data function is one that a future component cannot omit without also failing to get any data. The Authentication guide makes this argument directly: centralising it *guarantees that wherever the function is called, the auth check is performed, and prevents developers from forgetting.*

**★ Why does `requireBoardAccess` return a `BoardAccess` object rather than a boolean?**
Because the next question after "may I see this" is almost always "may I do this", and a boolean forces a second query to answer it. `BoardAccess` carries the role that the membership row already contained, so the admin-only screen and the member-only screen are answered from one read. It is also a DTO in the same sense as `CurrentUser`: a class, so it cannot be serialized to a Client Component by accident, exposing a `canManageMembers` getter rather than a raw role string that UI code would start comparing to literals in six places.

**★ Is caching the board read a security risk, given every member sees the same entry?**
Not if the authorization is where this page puts it. The cached entry is keyed on the board and contains only board data, so two members sharing an entry is correct — they are entitled to identical content. The risk would come from caching something *derived from the viewer* under a board-shaped key, or from moving the membership test inside the cached scope, which would cache a permission and keep a removed member authorized until the tag expired. The rule that falls out: cache the resource, never the decision.

---

← [06e · The layout is not a boundary](06e-milestone-the-layout-is-not-a-boundary.md) · [Chapter 10 overview](01-explanation.md) · Next → [06g · Hide, do not forbid](06g-milestone-hide-do-not-forbid.md)
