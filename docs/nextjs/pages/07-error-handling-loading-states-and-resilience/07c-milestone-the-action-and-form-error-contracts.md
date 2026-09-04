---
title: "Rows 5 and 6 never reach a boundary at all, so the milestone's next step is entirely about return values — and about one optimistic update that has to be able to take itself back"
sidebar_label: "07c · Milestone: action and form contracts"
sidebar_position: 131
description: "Chapter 7's capstone, step three: the drag-and-drop reconcile that must revert on rejection and explain itself, why updateTag rather than revalidateTag, ownership enforced in the query, and the card form's validation contract."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [Server Actions and Mutations guide](https://nextjs.org/docs/app/guides/server-actions)
> (`version: 16.3.4`, `lastUpdated: 2026-06-17`) and the
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`lastUpdated: 2026-06-10`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run**.

**Half the failure map is invisible to the boundary work, and that half is where users actually
spend their time.** Rows 5 through 10 — the rejected reconcile, the invalid title, the missing
board, the wrong team, the expired session, the stale tab — never render an `error.tsx` if the
application is built correctly, because each one has a mechanism designed for it. This page takes
the first two, and the reconcile is the one that rewards attention: it is the only place
SprintDesk shows a user something that may turn out to be false. The auth outcomes are
[07d](07d-milestone-the-boards-three-auth-answers.md).

## Row 5 — the optimistic reconcile

Drag-and-drop moves the card immediately and asks the server afterwards. That is the right
interaction and it creates an obligation: when the server says no, the card has to go back, and
the user has to be told why.

```ts
// app/(dashboard)/boards/[boardId]/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import type { ActionResult } from '@/lib/action-result'

export async function moveCard(
  cardId: string,
  toColumnId: string,
  toIndex: number
): Promise<ActionResult<null>> {
  const session = await auth()
  if (!session?.user) return { ok: false, error: 'Your session expired. Sign in to continue.' }

  // ownership is enforced by the query, not by a field the client sent
  const card = await db.card.findFirst({
    where: { id: cardId, board: { team: { members: { some: { id: session.user.id } } } } },
  })
  if (!card) return { ok: false, error: 'That card is no longer available.' }

  const column = await db.column.findFirst({ where: { id: toColumnId, boardId: card.boardId } })
  if (!column) return { ok: false, error: 'That column no longer exists.' }

  await db.card.move({ cardId, toColumnId, toIndex })
  updateTag(`board:${card.boardId}`) // read-your-own-writes: the re-render waits for fresh data
  return { ok: true, data: null }
}
```

Three deliberate choices, each traceable to an earlier page:

- **Returned, not thrown.** A rejected move is an expected error —
  [01](01-the-unified-error-model-errortsx-boundaries.md)'s test — and throwing it would replace
  the board rather than reverting one card.
- **`updateTag`, not `revalidateTag`.** The user must see their own write land, and
  `revalidateTag` with a stale-while-revalidate profile does not include a re-render in the
  action's response — [03](03-server-action-error-contracts-returning-typed-errors-vs.md).
- **Ownership in the `where` clause.** The client says *which* card; the session says *whose* —
  [03c](03c-an-action-is-a-public-post-endpoint.md).

```tsx
// app/(dashboard)/boards/[boardId]/board.tsx
'use client'

import { useOptimistic, useTransition, useState } from 'react'
import { moveCard } from './actions'

export function Board({ initial }: { initial: BoardState }) {
  const [board, applyOptimistic] = useOptimistic(initial, boardReducer)
  const [, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function onDrop(cardId: string, toColumnId: string, toIndex: number) {
    setMessage(null)
    startTransition(async () => {
      applyOptimistic({ type: 'move', cardId, toColumnId, toIndex })
      const result = await moveCard(cardId, toColumnId, toIndex)
      // on failure the optimistic state is discarded when the transition settles,
      // so the card returns to where it was — the message explains why
      if (!result.ok) setMessage(result.error)
    })
  }

  return (
    <>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      <Columns board={board} onDrop={onDrop} />
    </>
  )
}
```

🔴 **The revert is not code you write; it is what happens when the transition settles without the
optimistic state being confirmed.** What you must write is the *explanation*. A card that silently
slides back is a bug report; a card that slides back with "That column no longer exists" is an
interface.

⚠️ **Do not `await` several `moveCard` calls with `Promise.all` for a multi-card drag.** The
client dispatches actions one at a time, so they queue rather than race —
[03b](03b-sequential-dispatch-and-what-it-does-to-error-ui.md). One action taking the whole set is
the shape that works.

## Row 6 — the card form

Ordinary returned-value validation, and the only thing worth checking in review is that the
message reaches assistive technology and the button cannot be pressed twice:

```tsx
// app/(dashboard)/boards/[boardId]/new-card-form.tsx
'use client'

import { useActionState } from 'react'
import { createCard } from './actions'

export function NewCardForm({ columnId }: { columnId: string }) {
  const [state, formAction, pending] = useActionState(createCard, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="columnId" value={columnId} />
      <label htmlFor="title">Title</label>
      <input
        id="title"
        name="title"
        aria-invalid={state?.ok === false && state.field === 'title'}
        aria-describedby={state?.ok === false ? 'title-error' : undefined}
      />
      {state?.ok === false && (
        <p id="title-error" aria-live="polite">
          {state.error}
        </p>
      )}
      <button disabled={pending}>Add card</button>
    </form>
  )
}
```

The contract shape is [01c](01c-the-typed-action-result-and-reading-it-back.md)'s; nothing here is
board-specific except the hidden `columnId`, and even that is a *reference* rather than data the
server will trust.

## Step acceptance checklist — rows 5 and 6

- [ ] The reconcile action **returns** its failures; nothing in the drag path throws for an
      expected rejection.
- [ ] Every rejected optimistic update produces a visible, announced explanation, not just a
      revert.
- [ ] The action derives identity from the session and takes only an id plus the change from the
      client.
- [ ] `updateTag` (not `revalidateTag`) is used wherever the user must see their own write.
- [ ] No multi-item operation issues one action per item from the client.
- [ ] The form's error message is in a live region and its submit control is disabled while
      pending.

## Gotchas

### A rejected move that reverts silently
**Symptom.** A card jumps back to its old column and the user assumes the drag did not register,
so they try again — repeatedly, against a server that keeps refusing.
**Cause.** The optimistic state was discarded correctly and the returned error was not rendered.
**Fix.** Render `result.error` in a live region, as in the `Board` component above. The revert is
automatic; the explanation never is.

### `revalidateTag` on the board
**Symptom.** A moved card appears in its new column one interaction late — the next drag shows the
previous drag's result.
**Cause.** `revalidateTag` with a stale-while-revalidate profile marks the tag for background
refresh and deliberately does **not** include a re-render in the action's response.
**Fix.** `updateTag` for anything the user must see immediately.

### A multi-select drag that issues one action per card
**Symptom.** Moving twelve cards takes twelve sequential round trips and the board appears frozen.
**Cause.** Actions are dispatched one at a time per client; `Promise.all` does not change that.
**Fix.** One action taking the whole set, parallelising server-side, returning one result.

## Interview questions

**★ Why is a rejected drag-and-drop a returned value rather than a throw?**
Because it is an expected outcome of normal operation — the column was deleted, the card moved,
the session lapsed — and because throwing would replace the board through the nearest boundary.
The interaction needs one card to revert and a message to appear, which is a rendering decision,
not a crash.

**★ What actually performs the revert in an optimistic update?**
The transition settling without the optimistic state being confirmed; React discards it and the
UI returns to the server state. What the application must supply is the explanation — a revert
with no message is indistinguishable from a drag that did not register, and users respond by
retrying.

**★ Why `updateTag` rather than `revalidateTag` on the board?**
Because the user must see their own write in the same interaction. `updateTag` expires the tag
immediately and the re-render shipped with the action's response waits for fresh data;
`revalidateTag` with a stale-while-revalidate profile refreshes in the background and explicitly
does not include that re-render, so the change shows up one interaction late.

**★ Why is the hidden `columnId` in the new-card form acceptable when sending an entity from the
client is not?**
Because it is a *reference*, not data the server trusts. The action still has to prove the caller
may write to that column, by looking it up under the session's team rather than believing the
field. The rule is that the client says which thing to act on and the server decides everything
else — the shape in [03c](03c-an-action-is-a-public-post-endpoint.md).

**★ The board is optimistic. What does that add to the error design that a plain form does not
have?**
A window in which the interface is showing something that may turn out to be false. A plain form
shows nothing until the server answers, so a failure means "it did not happen". An optimistic UI
has already told the user it happened, so a failure means "take it back and explain" — and the
taking-back is automatic while the explaining is not.
---

← [07b · Placing the boundaries](07b-milestone-placing-the-boundaries.md) · **Next → [07d · The board's three auth answers](07d-milestone-the-boards-three-auth-answers.md)**
