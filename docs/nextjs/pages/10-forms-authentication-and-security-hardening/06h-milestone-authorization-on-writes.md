---
title: "A Server Action is a POST endpoint that anyone can call, so the page's auth check does not protect it — SprintDesk's actions are three lines each because every one of them delegates to a server-only module that re-authorizes from the session it reads itself"
sidebar_label: "06h · Milestone: authorization on writes"
sidebar_position: 166
description: "Chapter 10's capstone, step seven: why a page-level check does not extend to the actions defined on that page, the thin-action / DAL-for-mutations split the docs recommend, chapter 8's moveCard rewritten with ownership derived from the session, what a Server Action may return, and the CSRF protections Next.js gives you for free."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`) and [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag).
> Target: **Next.js 16.3.4** · React 19.2.8 · zod 4.4.3 · `@prisma/client` 7.10.0.
> Documentation-verified; **no sandbox run**.

**The single most expensive misconception in App Router security is that a Server Action inherits the protection of the page it is written on.** It does not. The action is compiled into a POST endpoint addressed by an id, and anyone who can send that POST reaches your function body — the `redirect('/login')` at the top of the page component never runs, because the page is not rendering. Everything on this page follows from that one fact: actions stay three lines long, every mutation goes through a `server-only` module that reads the session itself, and ownership is derived from that session rather than accepted from the request. Chapter 8's `moveCard` was already written in this shape; here is the half it was waiting for.

## The claim, in the docs' own words

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*
> — [Data Security, Built-in Server Actions Security features](https://nextjs.org/docs/app/guides/data-security#built-in-server-actions-security-features) (`lastUpdated: 2026-08-25`)

> *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action"*
> — [Data Security, Authentication and authorization](https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization)

> *"Treat every action as an untrusted entry point."*
> — [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`)

The theory behind all three quotes — what the endpoint actually is, and where in the request the check has to sit — is [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md); this page is the build. And the Authentication guide's framing, which is the one to quote in a design review because it names the mental model:

> *"Treat [Server Actions] with the same security considerations as public-facing API endpoints, and verify if the user is allowed to perform a mutation."*
> — [Authentication, Server Actions](https://nextjs.org/docs/app/guides/authentication#server-actions)

The Data Security guide's own example makes the point visually: a page redirects unauthenticated users on line 6, and the action defined inside its JSX re-checks `auth()` anyway. Its commentary is explicit that the page-level redirect controls which UI is rendered while the Server Action is a separate entry point that must verify the caller on its own.

## What the framework does give you, and what it does not

Two real protections exist and are worth understanding precisely, because they are frequently over-trusted.

**Secure action IDs.** Next.js creates encrypted, non-deterministic IDs for the client to reference the action, and these are periodically recalculated between builds. The ids are created during compilation and cached for a maximum of 14 days, regenerating on a new build or when the build cache is invalidated.

**Dead code elimination.** An action that is never used is removed from the client bundle, so no public endpoint is created for it.

Then the sentence that tells you how much to lean on them:

> *"This security improvement reduces the risk in cases where an authentication layer is missing. However, you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."*
> — [Data Security, Built-in Server Actions Security features](https://nextjs.org/docs/app/guides/data-security#built-in-server-actions-security-features)

*Reduces the risk*, not removes it. An id that is unguessable is still an id that every one of your users' browsers holds, in plain sight, for up to 14 days.

**CSRF, on the other hand, is genuinely handled** — and knowing this stops you from adding a token layer you do not need. Server Actions use `POST` and only `POST`; on top of that, Next.js compares the `Origin` header to the `Host` header (or `X-Forwarded-Host`) and aborts the request when they do not match, so an action can only be invoked from the same host as the page that hosts it. Behind a reverse proxy where those legitimately differ, the escape hatch is configuration rather than code:

```js filename="next.config.js"
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

🔴 That list is an allow-list for *your own* infrastructure. Adding a domain you do not control to it hands that domain the ability to invoke every action in your application.

## The shape: thin actions, a DAL that mutates

The Data Security guide recommends the split directly:

> *"Just as we recommend a [Data Access Layer] for reading data, you can apply the same pattern to mutations. This keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `"use server"` actions stay thin."*
> — [Data Security, Using a Data Access Layer for mutations](https://nextjs.org/docs/app/guides/data-security#using-a-data-access-layer-for-mutations)

So SprintDesk's mutation module looks like its read module, and the action file is a list of one-liners.

```ts filename="lib/dal/board-writes.ts"
import 'server-only'

import { db } from '@/lib/db'
import { requireBoardAccess } from './board'
import { rankBetween, renormalise, needsRenormalise } from '@/lib/board/rank'

export type MoveResult =
  | { ok: true; title: string; columnName: string; index: number }
  | { ok: false; reason: 'forbidden' | 'conflict' }

export async function moveCardForCurrentUser(input: {
  cardId: string
  toColumnId: string
  toIndex: number
  expectedColumnId: string
}): Promise<MoveResult> {
  const { cardId, toColumnId, toIndex, expectedColumnId } = input

  // 1. Which card, and therefore which board? Read it WITHOUT trusting anything.
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { id: true, title: true, columnId: true, boardId: true },
  })
  if (!card) return { ok: false, reason: 'forbidden' }

  // 2. Authorize against THAT board. Throws notFound() for a non-member.
  const access = await requireBoardAccess(card.boardId)

  // 3. The destination must belong to the same board the caller was cleared for.
  const column = await db.column.findFirst({
    where: { id: toColumnId, boardId: access.boardId },
    select: { id: true, name: true, status: true },
  })
  if (!column) return { ok: false, reason: 'forbidden' }

  // 4. Optimistic concurrency: someone else moved it since this client rendered.
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
      await tx.card.update({
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

  return { ok: true, title: card.title, columnName: column.name, index: i }
}
```

And the action:

```ts filename="app/(dashboard)/boards/[boardId]/actions.ts"
'use server'

import { z } from 'zod'
import { updateTag } from 'next/cache'
import { moveCardForCurrentUser, type MoveResult } from '@/lib/dal/board-writes'
import { db } from '@/lib/db'

const moveSchema = z.object({
  cardId: z.string().regex(/^card_[a-z0-9]{1,24}$/),
  toColumnId: z.string().regex(/^col_[a-z0-9]{1,24}$/),
  toIndex: z.number().int().min(0).max(10_000),
  expectedColumnId: z.string().regex(/^col_[a-z0-9]{1,24}$/),
})

export async function moveCard(
  input: unknown,
): Promise<MoveResult | { ok: false; reason: 'invalid' }> {
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }

  const result = await moveCardForCurrentUser(parsed.data)

  if (result.ok) {
    const card = await db.card.findUnique({
      where: { id: parsed.data.cardId },
      select: { boardId: true },
    })
    if (card) updateTag(`board:${card.boardId}`)
  }

  return result
}
```

### Reading that in order

**Validate first, authorize second, act third.** zod runs at the top because the rest of the code should be able to assume structure. It is not a security control on its own — a well-formed `cardId` is still an id the caller may not own — but it turns an entire class of "what if they send an object" questions into one early return.

**The board id is derived, never accepted.** The client sends a `cardId`; the server looks up which board that card is on and authorizes against *that*. Had the action accepted a `boardId` from the form and authorized against it, an attacker would supply a board they are on plus a card they are not, and pass.

**The destination is constrained to the authorized board.** Step 3's `where: { id: toColumnId, boardId: access.boardId }` is the line that turns a cross-board move into a `forbidden` result. Nothing about `toColumnId`'s *shape* could have caught it.

**`updateTag` runs on the server-derived id.** The tag is built from `card.boardId`, read from the database, not from anything in the request — so a caller cannot address, or invalidate, a cache entry for a board they have nothing to do with. Which of the four invalidation functions to call, and why `updateTag` rather than `revalidateTag` when the user who moved the card must see the result immediately, is [chapter 8's `10b`](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md).

## What an action may return

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*
> — [Data Security, Controlling return values](https://nextjs.org/docs/app/guides/data-security#controlling-return-values)

`MoveResult` carries a title, a column name and an index — the three things the toast needs. It does not carry the updated `Card` row, and that restraint is the same discipline as the DTO in [06d](06d-milestone-the-data-access-layer.md): returning `db.card.update(...)` directly ships every column of the row, including whatever the schema gains next quarter.

The failure reasons are equally deliberate. `'forbidden'` is returned for *both* "no such card" and "not your board", because distinguishing them would rebuild the existence oracle that [06g](06g-milestone-hide-do-not-forbid.md) spent a page removing — this time in a JSON response body rather than a status code.

## Gotchas

**★ Symptom: an action is called successfully by someone who is signed out, even though its page redirects unauthenticated users.** Cause: the page's check runs when the page renders, and a direct POST to the action's endpoint does not render the page. The docs put it flatly — a page-level authentication check does not extend to the Server Actions defined within it. Fix: the action's first meaningful line resolves identity itself.

```ts
export async function moveCardForCurrentUser(input: MoveInput) {
  const card = await db.card.findUnique({ where: { id: input.cardId }, select: { boardId: true } })
  if (!card) return { ok: false, reason: 'forbidden' } as const
  await requireBoardAccess(card.boardId)   // ← reads the session itself
  // ...
}
```

**★ Symptom: a user moves a card from a board they are on into a column of a board they are not on.** Cause: the destination id was validated for shape and never checked against the board the caller was cleared for. Fix: constrain the lookup.

```ts
const column = await db.column.findFirst({
  where: { id: toColumnId, boardId: access.boardId },
})
if (!column) return { ok: false, reason: 'forbidden' }
```

**★ Symptom: an attacker changes the hidden `boardId` field in the form and edits another team's card.** Cause: the action authorized against a `boardId` the client supplied. Fix: never accept the subject or the scope of an authorization decision from the request — derive the board from the card, server-side, as the code above does. If a form genuinely needs to carry a scope id, treat it as a *hint* to be re-validated, never as the thing you check against.

**★ Symptom: an unused, unexported-from-any-page action turns out to be callable.** Cause: it was `export`ed from a `'use server'` module and something referenced it, so it was not eliminated as dead code and an id exists for it. Fix: delete actions you do not use, and treat every exported member of a `'use server'` file as a public route. Dead-code elimination is a bundle optimisation that happens to have a security effect; it is not an access control you can plan around.

**★ Symptom: someone proposes adding CSRF tokens to every Server Action form.** Cause: reasonable instinct, wrong framework. Server Actions are POST-only and Next.js already compares `Origin` to `Host`/`X-Forwarded-Host` and aborts on a mismatch. Fix: do nothing, except configure the real origins if a proxy makes them legitimately differ:

```js filename="next.config.js"
module.exports = {
  experimental: { serverActions: { allowedOrigins: ['my-proxy.com'] } },
}
```

**★ Symptom: `allowedOrigins` was widened until the errors stopped.** Cause: a same-origin failure was treated as a configuration nuisance rather than as the check working. Fix: put only hosts you operate in that list, and diagnose the mismatch instead — most often `X-Forwarded-Host` is not being set by the proxy, which is the same root cause as the `AUTH_TRUST_HOST` problem in [06c](06c-milestone-the-environment.md).

**★ Symptom: an action returns the updated row and a client component now has fields nobody meant to expose.** Cause: `return db.card.update(...)`. The return value is serialized to the client. Fix: return a purpose-built result.

```ts
await db.card.update({ where: { id: cardId }, data })
return { ok: true, title: card.title } as const
```

**★ Symptom: the API tells an attacker which card ids are real, because "not found" and "not yours" return different reasons.** Cause: helpful error reporting rebuilt the oracle. Fix: collapse both into one reason at the boundary. Log the distinction server-side if you need it for support; do not send it.

**★ Symptom: the action authorizes correctly and the board still shows the old positions to the user who moved the card.** Cause: the wrong invalidation function, or none. This is an invalidation bug rather than an auth bug, and it is the exact failure chapter 8 documents at length. Fix: `updateTag` on the tag the read used, built from the server-derived board id — and before any `redirect()`, since `redirect` throws and anything after it never runs.

**★ Symptom: `revalidatePath('/')` was used "because it also refreshes" and the whole application's cache is being purged by a drag-and-drop.** Cause: reaching for the biggest hammer. Fix: `updateTag(\`board:${boardId}\`)`. The comparison of all five refresh APIs — what each invalidates, where each may be called, and who pays the round trip — is [chapter 8's `10b`](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md).

**★ Symptom: a `try/catch` in the action swallows the `notFound()` that `requireBoardAccess` throws, and the mutation proceeds.** Cause: the interrupt is an exception, and a broad catch caught it. Fix — and note this is more dangerous in an action than in a page, because the code after the catch *writes*:

```ts
import { unstable_rethrow } from 'next/navigation'

try {
  await requireBoardAccess(card.boardId)
} catch (error) {
  unstable_rethrow(error)
  return { ok: false, reason: 'forbidden' } as const
}
```

**★ Symptom: the same authorization logic exists in the action and in the DAL, and a refactor removes the DAL copy.** Cause: it looks like duplication. Fix: keep the DAL copy — it is the one every future caller will inherit — and let the action stay thin. If you want the duplication gone, delete it from the action, never from the module that owns the data.

## Interview questions

**★ A page redirects unauthenticated users at the top of its component. Is the Server Action defined on that page protected?**
No, and this is the highest-value fact in App Router security. The action compiles to a POST endpoint addressed by an id; invoking it does not render the page, so the redirect never executes. The docs state it directly — a page-level authentication check does not extend to the Server Actions defined within it — and the Server Actions guide's framing is to treat every action as an untrusted entry point. The practical consequence is that the guard has to be inside the action, or better, inside the `server-only` module the action delegates to, so that a new action written next month inherits it.

**★ Next.js encrypts action ids and eliminates unused actions. Why is that not enough?**
Because both are mitigations for the case where a check is missing, not substitutes for the check. The docs are careful about this: the features *reduce* the risk where an authentication layer is missing, and you should still treat actions as reachable via direct POST and verify inside each one. Mechanically, an unguessable id is still an id that every signed-in user's browser holds, and the docs note the ids are cached for up to 14 days — so an id captured from a page is usable for a fortnight by anyone who captured it, including the user who was legitimately given it and then left the company.

**★ Do you need CSRF tokens on Server Action forms?**
No, and adding them suggests you have not read what the framework does. Actions are invoked with `POST` and only `POST`, which with SameSite cookie defaults already blocks most of the classic attack; on top of that Next.js compares the `Origin` header to `Host` or `X-Forwarded-Host` and aborts the request when they differ, so an action can only be invoked from the same host as the page hosting it. The only configuration you may need is `serverActions.allowedOrigins`, and it is an allow-list of infrastructure you operate — putting a third-party domain in it grants that domain the right to call every action you have.

**★ The form sends a `boardId`. Why does the action ignore it?**
Because the scope of an authorization decision must be derived on the server, not accepted from the client. If the action authorized against the submitted `boardId`, an attacker would submit a board they belong to together with a card they do not, and every check would pass while the wrong row was written. The safe order is: read the card by its id, learn which board it is on from the database, authorize against that board, and then require the destination to belong to the same board. The submitted id can be kept as a hint for a nicer error message; it can never be what you check.

**★ Why does the action return `{ ok: false, reason: 'forbidden' }` for both "no such card" and "not your board"?**
For the same reason the page answers a non-member with a 404: distinguishing them tells an unauthorised caller which ids are real. A JSON body is just as good an oracle as a status code, and it is a place people forget to look because it feels like internal API design rather than a response to an attacker. If support needs the distinction, log it server-side with the actor and the id; what crosses the wire is one reason.

**★ Why put the mutation logic in a `server-only` module rather than in the `'use server'` file itself?**
Three reasons, and the docs recommend the split explicitly. First, the action file is a public routing surface: everything exported from it is an endpoint, so the fewer things it exports the smaller that surface. Second, the DAL module can be called from a Route Handler, a background job or another action without duplicating the authorization. Third — the one that matters in a year — a new developer adding a mutation is far more likely to call an existing `moveCardForCurrentUser` than to reproduce a five-step check they have never read. The docs also note you can put `import 'server-only'` in both the DAL and the `"use server"` file, and that both work when the action is imported into a Client Component, because `"use server"` modules resolve in a server-only layer.

**★ Where does `updateTag` get its board id from, and why does that matter?**
From the card row the server read, never from the request. A tag built from client input lets a caller name a cache entry belonging to someone else — at best a denial-of-service by repeatedly expiring a busy board's entry, at worst a lever on data they should not be able to affect at all. Deriving it from the row you already authorized closes both. The related discipline from [13](13-authentication-with-cache-components-sharing-caching-and-mutating.md) is that tags are stored in plain text, so the value should be an opaque id rather than anything identifying.

**★ A reviewer says the action and the DAL both check membership, and asks you to remove one. Which one goes?**
The one in the action, if either. The DAL check is the one every future call site inherits for free; the action's is a convenience for readers of that file. In practice the version in this milestone has no duplication at all — the action validates shape and delegates — but where duplication does appear during a refactor, the rule to state is that the check nearest the data is never the one deleted. A check in a caller protects that caller; a check in the data function protects every caller that has not been written yet.

---

← [06g · Hide, do not forbid](06g-milestone-hide-do-not-forbid.md) · [Chapter 10 overview](01-explanation.md) · Next → [06i · Sign-in as a form](06i-milestone-sign-in-as-a-form.md)
