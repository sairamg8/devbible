---
title: "\"You cannot see this board\" is three different facts with three different remedies, and the milestone's job is to stop them collapsing into one unhelpful page"
sidebar_label: "07d · Milestone: the three auth answers"
sidebar_position: 24
description: "Routing SprintDesk's missing-board, wrong-team and expired-session cases to their own files, the information-disclosure trade-off hidden in the order of the checks, why none of the three calls may sit inside a try, and the stale-tab error that needs a reload rather than a retry."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`version: 16.3.4`, `lastUpdated: 2026-06-10`), the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`) for the action-ID rotation behaviour, and the
> [`unstable_rethrow` reference](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)
> (`lastUpdated: 2026-03-03`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run**.

**Every application eventually writes `if (!board) notFound()` and stops thinking about it, and
that single line is three product decisions taken by accident.** A board that does not exist, a
board on a team you are not on, and a request from someone whose session has lapsed are different
facts with different remedies — nothing, ask for access, sign in — and the user can only act on
the one they are actually in. Rows 7 to 9 of the failure map exist to force the distinction, and
row 10 is the odd one out: a failure caused by a deployment, whose only working recovery is the
one button the framework does not give you.


## Rows 7, 8 and 9 — three different answers

A single `if (!board) notFound()` collapses three outcomes that should be distinguishable to the
user and to your logs:

```tsx
// app/(dashboard)/boards/[boardId]/page.tsx
import { notFound, forbidden, unauthorized } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params

  const session = await auth()
  if (!session?.user) unauthorized() // row 9 → unauthorized.tsx

  const board = await db.board.findUnique({ where: { id: boardId } })
  if (!board) notFound() // row 7 → not-found.tsx

  if (!(await isTeamMember(session.user.id, board.teamId))) {
    forbidden() // row 8 → forbidden.tsx
  }

  return <BoardView board={board} />
}
```

🔴 **All three calls sit outside any `try`.** Each works by throwing, and a `catch` anywhere in
their path renders the page as though the check had passed —
[01d](01d-control-flow-throws-and-what-a-catch-swallows.md). The functions themselves, and the
`authInterrupts` flag they require, are
[11 · Auth interrupts](11-auth-interrupts-forbidden-and-unauthorized.md)'s subject.

⚠️ **There is a deliberate information-disclosure choice in that order.** Checking existence
before membership tells an unauthorised caller that the board exists. Checking membership first —
and returning `notFound()` for both cases — reveals nothing but also gives a legitimate user who
lost access a misleading 404. SprintDesk is a team tool where board ids are not secret, so the
order above is the right trade; a system where the existence of a resource is itself sensitive
should invert it and say so.

## Row 10 — the stale tab

The one row whose cause is a deployment rather than a request, covered in
[03d](03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md). The board's boundary should
recognise it and offer the thing that actually works:

```tsx
// app/(dashboard)/error.tsx
'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/observability'

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const staleBuild = /Failed to find Server Action/i.test(error.message)

  useEffect(() => {
    reportError(error, { digest: error.digest, surface: 'dashboard', staleBuild })
  }, [error, staleBuild])

  return (
    <section role="alert">
      <h2>{staleBuild ? 'This page is out of date' : 'We could not load your board'}</h2>
      {staleBuild ? (
        <>
          <p>SprintDesk was updated while this tab was open. Reload to continue.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </>
      ) : (
        <>
          <button onClick={() => retry()}>Try again</button>
          <p>
            If this keeps happening, quote reference <code>{error.digest ?? 'unknown'}</code>.
          </p>
        </>
      )}
    </section>
  )
}
```

## Step acceptance checklist — rows 7 to 10

- [ ] `notFound()`, `forbidden()` and `unauthorized()` each have a corresponding file.
- [ ] The order of the three checks is a decision someone made on purpose, and the reasoning is
      written down.
- [ ] None of the three calls is inside a `try`.
- [ ] Which of the three fired is recorded in the logs, since that is the distinction support
      needs.
- [ ] The dashboard boundary distinguishes the stale-build error and offers a reload rather than
      a retry.
- [ ] The boundary surfaces `error.digest` for every other failure.

## Gotchas

### A single "not allowed" branch for three outcomes
**Symptom.** Support cannot tell whether a user hit a deleted board, a board on another team, or
an expired session, because all three produce the same page.
**Cause.** One `notFound()` covering everything.
**Fix.** Three calls, three files — and log which one fired, since that distinction is the one
support actually needs.

### The auth check wrapped in a `try` for "safety"
**Symptom.** An unauthorised user sees the board.
**Cause.** `forbidden()` throws, and the `catch` treated it as a failure to be logged and
continued past.
**Fix.** Never wrap the interrupt functions. If a `try` is unavoidable, `unstable_rethrow` at the
top of the `catch` — [01e](01e-unstable-rethrow-and-its-exact-contract.md).

### `unauthorized()` used for a user who is signed in
**Symptom.** A member of another team is shown a sign-in prompt, signs in again as the same
person, and lands back on the same prompt.
**Cause.** The two states were conflated: the session is valid, the permission is missing.
**Fix.** `unauthorized()` means *we do not know who you are*; `forbidden()` means *we do, and the
answer is no*. Only the first is fixable by signing in, so only the first should ask.

### A reload offered for an error a reload cannot fix
**Symptom.** The boundary tells every user to reload, and for a database outage they reload into
the same failure repeatedly.
**Cause.** The stale-build branch was made the default rather than a detected special case.
**Fix.** Detect it by message and keep `retry()` as the general recovery. The two errors need
opposite advice, so guessing is worse than either.
## Interview questions

**★ Rows 7, 8 and 9 are all "you cannot see this board". Why three mechanisms?**
Because they are three different facts and each has a different correct response: the board does
not exist, it exists and is not yours, or we do not know who you are. The third is recoverable by
signing in, the second by asking for access, and the first by nothing at all. Collapsing them
gives every user the least useful of the three answers.

**★ There is a security trade-off in the order of those checks. What is it?**
Checking existence before membership discloses that a board exists to someone who may not access
it; checking membership first and reporting "not found" for both hides that, at the cost of
telling a legitimate user who lost access that their board is gone. Neither is universally right —
the point is that it is a decision, and for a team tool with non-secret ids the more informative
order is defensible.

**★ Why must the auth interrupts stay outside any `try`?**
They work by throwing. A `catch` in their path absorbs the control-flow exception and the page
continues rendering as though the check had passed — which for `forbidden()` means showing data
to someone who should not see it. It is the same class of bug as a swallowed `notFound()`, with a
much worse consequence.

**★ How should the boundary treat the stale-action error differently from any other failure?**
By offering a reload rather than a retry. The action ID no longer exists on the server, so
`retry()` cannot succeed; only fetching the current build can. That makes it the one error in the
chapter where the correct recovery is not the button the framework provides.

---
**★ What is the difference between `unauthorized()` and `forbidden()` in one sentence each?**
`unauthorized()` says the request carries no valid identity, so signing in may resolve it;
`forbidden()` says the identity is known and lacks permission, so signing in will not. Sending the
second case to a sign-in page produces a loop the user cannot escape.

**★ Where should the record of which auth outcome fired actually go?**
Into the server-side log for that request, not only into the rendered page. The three files tell
the *user* which case they are in; support needs to know which case a past request was in, and by
then the page is gone. It is the same reasoning that makes `error.digest` worth surfacing.
---

← [07c · The action and form contracts](07c-milestone-the-action-and-form-error-contracts.md) · **Next → [07e · Skeletons and making failures visible](07e-milestone-skeletons-and-making-failures-visible.md)**
