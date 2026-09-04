---
title: "A 403 is an answer — it tells a stranger the board exists — so SprintDesk hides what a non-member asks for and forbids only what a member is not allowed to do, and the framework's own 403 function is experimental and usually returns a 200 anyway"
sidebar_label: "06g · Milestone: hide, do not forbid"
sidebar_position: 33
description: "Chapter 10's capstone, step six: forbidden(), the authInterrupts flag it needs, the three reasons SprintDesk answers a non-member with notFound() instead, the one screen where forbidden() is genuinely right, and why neither function reliably sets the status code you think it does on a streamed page."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden)
> (`lastUpdated: 2026-07-24`), [`authInterrupts`](https://nextjs.org/docs/app/api-reference/config/next-config-js/authInterrupts),
> [`notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found) and the Next.js
> [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · React 19.2.8. Documentation-verified; **no sandbox run** — no status codes
> here were observed on the wire; every one is quoted from the reference that specifies it.

**Choosing between `notFound()` and `forbidden()` looks like an ergonomics question and is actually an information-disclosure question.** `403` is a truthful, specific statement — *this resource exists and you may not have it* — and truthful statements to strangers are how enumeration attacks work. `404` says nothing. SprintDesk therefore hides a board from a non-member and forbids an action from a member, and the rule is not "always use one": it is **whether the caller already knows the resource exists.** There is also a mechanical wrinkle that makes the choice less consequential than it feels — on a streamed page, neither function reliably sets the status code you wrote it for.

## The two functions, and what each one says

Next.js has a purpose-built function for the 403 case, and SprintDesk does not use it on the board route. That deserves an argument rather than a preference.

### What `forbidden()` is

> *"Invoking `forbidden()` throws a `NEXT_HTTP_ERROR_FALLBACK;403` error and terminates rendering of the route segment where it was thrown. Next.js also injects a `<meta name="robots" content="noindex" />` tag so the page is not indexed."*
> — [`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden) (`lastUpdated: 2026-07-24`)

It needs a flag:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
}

export default nextConfig
```

And the same page opens with a warning that is not boilerplate:

> *"This feature is currently experimental and subject to change, it's not recommended for production."*

### Three reasons SprintDesk hides instead

**1 · A 403 is an oracle.** `403` means *this board exists and you are not on it*. Given a board id from a Slack paste, a leaked log or a pattern in `cuid()` output, an attacker can distinguish real boards from imaginary ones without an account on any of them. That is enumeration, and the count of boards in your product is not information you meant to publish. `404` says *no such thing, as far as you are concerned*, which is both true and useless to an attacker.

**2 · The status code you wanted probably will not arrive anyway.** SprintDesk's board page streams — its whole shape is a shell plus a boundary — and on a streamed page neither interrupt puts the status you wrote onto the wire. That is worked through with the quotes in *The status codes, precisely* below. The short version: choosing between these two functions on the strength of their status codes is choosing between two 200s.

**3 · It is experimental and behind a flag.** For an authorization path — the code you least want to rewrite — "subject to change" and "not recommended for production" are reasons enough on their own.

### Where `forbidden()` *is* the right call

Not never. The distinction is **whether the user already knows the resource exists.**

A member of a board who is not an admin, clicking "Manage members" on a board they can already see, has not learned anything from a 403 — they were looking at the board a second ago. Hiding it as a 404 there is actively worse UX: it suggests the feature is broken rather than restricted.

```tsx filename="app/(dashboard)/boards/[boardId]/members/page.tsx"
import { forbidden } from 'next/navigation'
import { requireBoardAccess } from '@/lib/dal/board'
import { MemberList } from './member-list'

export default async function MembersPage(
  props: PageProps<'/(dashboard)/boards/[boardId]/members'>,
) {
  const { boardId } = await props.params

  // notFound() for a non-member — they must not learn the board exists.
  const access = await requireBoardAccess(boardId)

  // forbidden() for a member who is not an admin — they already know it exists.
  if (!access.canManageMembers) {
    forbidden()
  }

  return <MemberList boardId={boardId} />
}
```

Two interrupts, two different facts being protected. That is the rule, and it is worth writing in a comment because the next person will otherwise "make it consistent".

⚠️ Note the ordering: `requireBoardAccess` runs **first**. Reversing them would check the role before establishing membership, and `access` would not exist to check. More subtly, any check that runs before the membership test risks answering a question for a stranger.

### What SprintDesk actually ships, given the flag

There is a real tension in the page above: `forbidden()` is the right *semantic* for that screen, and its own reference says it is experimental and not recommended for production. SprintDesk resolves it by not putting an experimental interrupt on an authorization path, and rendering the refusal instead — same information disclosed, no flag:

```tsx filename="app/(dashboard)/boards/[boardId]/members/page.tsx"
import { requireBoardAccess } from '@/lib/dal/board'
import { MemberList } from './member-list'

export default async function MembersPage(
  props: PageProps<'/(dashboard)/boards/[boardId]/members'>,
) {
  const { boardId } = await props.params
  const access = await requireBoardAccess(boardId) // notFound() for a non-member

  if (!access.canManageMembers) {
    return (
      <main>
        <h1>Members</h1>
        <p>Only board admins can manage members. Ask an admin of this board.</p>
      </main>
    )
  }

  return <MemberList boardId={boardId} />
}
```

🔴 **This is only safe because the refusal is at the top of the page and the member list is a separate component with its own DAL call.** `return <p>…</p>` is *not* an access control — [06e](06e-milestone-the-layout-is-not-a-boundary.md) is entirely about why. What protects the member list is that `MemberList` calls a DAL function that re-checks `canManageMembers`; this early return only decides what the page looks like. When `authInterrupts` stabilises, `forbidden()` replaces the early return and the DAL check stays exactly where it is.

## The status codes, precisely

This is where people over-invest, so it is worth being exact about what each function puts on the wire.

- `forbidden()` — the docs state that when the check runs inside a `<Suspense>` boundary the response has **already begun streaming as a `200`**, and the status cannot change once streaming has started. To get a real `403` the check must run before the response streams, which means `proxy.ts` or a Route Handler.
- `notFound()` — returns **200 for a streamed response and 404 for a non-streamed one**. Same mechanism, same constraint.

So on SprintDesk's board page — a shell, a boundary, a streamed board — both functions produce a `200` carrying error UI. The user experience differs (a "not found" page versus a "forbidden" page); the HTTP semantics do not. **If your reason for choosing one is the status code, check first whether that route streams**, because it very likely does, and then the reason evaporates and the information-disclosure argument is the only one left.

Where the status code genuinely matters — a Route Handler serving a mobile client, a health check, a crawler — it is not a component-level decision at all. Return the response yourself:

```ts filename="app/api/boards/[boardId]/route.ts"
import { getCurrentUser } from '@/lib/dal/user'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params
  const user = await getCurrentUser()
  if (!user) return new Response(null, { status: 401 })

  const board = await db.board.findFirst({
    where: { id: boardId, members: { some: { userId: user.id } } },
    select: { id: true, name: true },
  })
  // 404, not 403 — same reasoning, now with a status code that actually ships.
  if (!board) return new Response(null, { status: 404 })

  return Response.json(board)
}
```

Note that the API surface makes the same choice as the UI surface. Answering `403` here and `404` in the page would let an attacker read the difference off the API and apply it to the pages.

## Gotchas

**★ Symptom: an attacker can tell which board ids exist by watching status codes.** Cause: `forbidden()` on a non-member, which confirms existence. Fix: `notFound()` for the "you are not on this" case, and reserve `forbidden()` for users who can already see the resource:

```ts
const membership = await db.boardMember.findUnique({
  where: { boardId_userId: { boardId, userId: user.id } },
})
if (!membership) notFound()
```

**★ Symptom: `forbidden()` was added, and the response is a 200 with forbidden-looking UI in it.** Cause: the call ran inside a `<Suspense>` boundary, and the docs state the response has already begun streaming as a 200 and the status cannot change once streaming has started. Fix: if you genuinely need a `403` on the wire — for an API client, or for a scanner's benefit — the check has to run before the response streams, which means `proxy.ts` or a Route Handler, not a component. The docs point at exactly that.

**★ Symptom: `forbidden()` is imported, the flag is not set, and the build fails or the call does nothing useful.** Cause: `forbidden` and `unauthorized` are behind the experimental `authInterrupts` option. Fix — and read the "not recommended for production" line on the same page before you commit to it:

```ts filename="next.config.ts"
const nextConfig: NextConfig = { experimental: { authInterrupts: true } }
```

**★ Symptom: `forbidden()` is called and no forbidden UI renders; the dev server logs an unhandled rejection instead.** Cause: it was called inside a promise nobody awaited. The reference is explicit that a `forbidden()` left in an un-awaited promise throws where nothing catches it, and that in development the server logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;403`. Fix: `await` the function that may call it — which in SprintDesk means the DAL call, since the interrupt always lives in the data function.

**★ Symptom: the interrupt is swallowed and the page renders as if nothing happened.** Cause: a `try/catch` around the call. Both `notFound()` and `forbidden()` work by throwing, and a catch-all handler suppresses them along with the errors it was written for. Fix: re-throw the framework's own control-flow errors.

```ts
import { unstable_rethrow } from 'next/navigation'

try {
  await readBoard(boardId)
} catch (error) {
  unstable_rethrow(error)   // lets notFound()/forbidden()/redirect() through
  logAndReport(error)
  throw error
}
```

**★ Symptom: `forbidden()` in the root layout does nothing.** Cause: the reference states the function cannot be called in the root layout. Fix: it belongs in the data function anyway — see [06e](06e-milestone-the-layout-is-not-a-boundary.md) for why a layout was never the right place for the check regardless of which interrupt you use.

**★ Symptom: `return forbidden()` was written and a reviewer asks whether the return value matters.** Cause: a reasonable assumption that a function called for its effect should be returned. Fix: drop the `return`. The docs note the function's TypeScript return type is `never` and that execution stops because it throws, so `return` adds nothing — and it misleads the next reader into thinking there is a value to handle.

**★ Symptom: the 403 page shows up in search results.** Cause: it would not, and this is worth knowing rather than fixing — the reference states Next.js injects a `<meta name="robots" content="noindex" />` tag so the page is not indexed. If you are hand-rolling an equivalent interrupt instead of using `forbidden()`, that tag is one of the things you have to remember to reproduce.

**★ Symptom: the team standardises on one interrupt for consistency and now board members are told their own admin screen does not exist.** Cause: consistency was applied to the function name rather than to the rule. Fix: state the rule in a comment at both call sites — hide what the caller does not know exists, forbid what they cannot do — so the next "cleanup" pass has something to read.

## Interview questions

**★ A non-member requests a board. Why `notFound()` rather than `forbidden()`?**
Because `403` is a statement of fact — *this exists and you may not have it* — and that fact is exactly what an enumeration attack is looking for. `404` reveals nothing. On top of that, `forbidden()` is behind the experimental `authInterrupts` flag with the docs' own "not recommended for production" warning, and its status-code advantage largely evaporates on a streamed page, where the response has already committed to a 200 before the check runs. The exception is a user who already knows the resource exists — a board member hitting an admin-only screen — where a 403 leaks nothing and a 404 is just confusing.

**★ Two interrupt functions, two different pages in the same feature. How do you explain that to a reviewer who wants consistency?**
By naming what each one protects. `notFound()` protects the *existence* of the board from someone with no relationship to it. `forbidden()` protects an *action* from someone who already knows the board exists because they are looking at it. Consistency at the level of "always use the same function" would either leak existence to strangers or tell members their own board's admin screen does not exist. The consistent rule is the one about information, not the one about function names — and it belongs in a comment next to both calls.

**★ Someone argues the 404-for-non-members approach is security through obscurity. Are they right?**
Partly, and the distinction matters. It is not a substitute for the access control — the membership filter in the query is what actually prevents the read, and it would prevent it just as well if the response said 403. Hiding existence is a *defence in depth* measure that removes an oracle: it denies an attacker the ability to map your resource space cheaply before doing anything else. Obscurity is a problem when it is the only control; it is straightforwardly good when it sits on top of a real one and costs nothing.

**★ You need a genuine `403` on the wire for a mobile client. Where does the check go?**
Not in a component. Anything inside a `<Suspense>` boundary is downstream of a response that has already committed to `200`, so the check has to run before streaming starts — which means either a Route Handler that constructs the response itself, or `proxy.ts`. For an API surface, the Route Handler is the honest answer: it can return `401` for no session and whatever you choose for no access, and it is the same code path a browser never touches. Keep the *policy* identical to the UI's, though: if the pages hide non-members behind a 404, the API must too, or the API becomes the oracle the pages were designed not to be.

**★ Why is `try/catch` around a DAL call dangerous in this design?**
Because every one of the framework's control-flow interrupts — `notFound()`, `forbidden()`, `redirect()` — works by throwing, and a `catch` written to handle a database error will silently swallow an authorization interrupt too. The page then renders as if the check had passed, minus whatever data the throw prevented from loading, which is the worst possible outcome: it looks like a rendering bug and it is a missing security response. `unstable_rethrow` exists for exactly this, and any catch block anywhere near the data layer should start with it.

**★ Does `forbidden()` being experimental actually matter, given the API is three characters long?**
It matters more than the API surface suggests, because the failure mode of a change is not a compile error. `authInterrupts` gates both `forbidden` and `unauthorized`; the docs say the feature is subject to change and not recommended for production. A behavioural change — in which boundary catches the interrupt, in whether it renders at all in some rendering mode — would present as an authorization screen not appearing, which is precisely the class of regression that ships. For a product decision you can express with `notFound()` today and no flag, waiting costs nothing.

---

← [06f · Authorization on reads](06f-milestone-authorization-on-the-board.md) · [Chapter 10 overview](01-explanation.md) · Next → [06h · Authorization on writes](06h-milestone-authorization-on-writes.md)
