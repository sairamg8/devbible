---
title: "An optimistic value has no lifetime of its own — it borrows the transition's, and every mistake in this file is a consequence of forgetting that the moment the await resolves, the card is rendered from props again"
sidebar_label: "07j · Milestone: the optimistic drop"
sidebar_position: 168
description: "Chapter 8's capstone, step six: useOptimistic with a move reducer that also re-applies the filter predicate, calling the setter inside a transition and the two errors React raises when you do not, why the reducer must compute relative to current state, and animating a rejected move back instead of snapping."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against React's [`useOptimistic`](https://react.dev/reference/react/useOptimistic)
> (Reference, Caveats, Troubleshooting) and [`useTransition`](https://react.dev/reference/react/useTransition),
> and the Next.js [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`). Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**`useOptimistic` is not a store, a cache or a queue, and every bug people hit with it comes from treating it as one.** It holds a value for exactly as long as an Action is pending and then stops holding it — React's own wording is that the optimistic state *"is equal to `value` unless an Action is pending"*. That single sentence explains the setter that must live inside `startTransition`, the card that reverts the instant your `await` resolves, and the milestone's worst bug, where a move commits successfully on the server and the card visibly jumps back. This page builds the client half: the reducer, the drop handler, and the revert that animates instead of snapping. The Server Action and the invalidation that decides whether the revert is correct are [07k](07k-milestone-the-action-and-what-invalidates-what.md).

## The contract, in three quotes

> *"`optimisticState`: The current optimistic state. It is equal to `value` unless an Action is pending, in which case it is equal to the state returned by `reducer` (or the value passed to the set function if no reducer was provided)."*
>
> *"The set function must be called inside an Action. If you call the setter outside an Action, React will show a warning and the optimistic state will briefly render."*
> — [`useOptimistic`, Reference](https://react.dev/reference/react/useOptimistic)

And, from the troubleshooting section, the exact remedy when the optimistic value looks wrong:

> *"If your optimistic state seems to be based on old data, consider using an updater function or reducer to calculate the optimistic state relative to the current state."*
> — [`useOptimistic`, Troubleshooting: *My optimistic updates show stale values*](https://react.dev/reference/react/useOptimistic#my-optimistic-updates-show-stale-values)

The board obeys all three: a reducer rather than a replacement value, every setter call inside a transition, and the pending flag carried by the optimistic item itself.

## The reducer

The interesting part is not the move. It is that the reducer must also re-apply the **filter predicate** — because a card dragged from `Doing` to `Done` while the URL says `?status=doing` should disappear, and the server's next render will certainly make it disappear. If the reducer only changes the column, the card sits in the wrong place for one transition and then vanishes, which reads as a glitch rather than as a move.

```ts filename="app/(dashboard)/boards/[boardId]/optimistic-move.ts"
import { matchesFilters, type Filters } from '@/lib/board/filters'
import { rankBetween } from '@/lib/board/rank'
import type { CardRow } from '@/lib/board/query'

export type OptimisticCard = CardRow & { pending?: boolean; reverted?: boolean }

export type MoveAction = {
  cardId: string
  toColumnId: string
  toIndex: number
  /** The status implied by the destination column, so the predicate can run. */
  toStatus: CardRow['status']
  filters: Filters
}

export function moveReducer(
  cards: OptimisticCard[],
  action: MoveAction,
): OptimisticCard[] {
  const card = cards.find((c) => c.id === action.cardId)
  if (!card) return cards

  const siblings = cards
    .filter((c) => c.columnId === action.toColumnId && c.id !== action.cardId)
    .sort((a, b) => a.rank - b.rank)

  const i = Math.max(0, Math.min(action.toIndex, siblings.length))
  const prev = i > 0 ? siblings[i - 1].rank : null
  const next = i < siblings.length ? siblings[i].rank : null

  const moved: OptimisticCard = {
    ...card,
    columnId: action.toColumnId,
    status: action.toStatus,
    rank: rankBetween(prev, next),
    pending: true,
  }

  // The same predicate the server will apply. A card moved out of the
  // filtered set leaves the view now, not one render later.
  if (!matchesFilters(moved, action.filters)) {
    return cards.filter((c) => c.id !== action.cardId)
  }

  return cards
    .map((c) => (c.id === action.cardId ? moved : c))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
}
```

Note what the reducer does **not** do: it does not take the new rank as an input. It recomputes it from the current state, exactly as the troubleshooting note prescribes, so if a second move lands first the second application still produces a sensible rank rather than one computed against a list that has changed.

## The drop handler

```tsx filename="app/(dashboard)/boards/[boardId]/board.tsx"
'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { moveCard, type MoveResult } from './actions'
import { moveReducer, type OptimisticCard } from './optimistic-move'
import { useCardDrag, type MoveIntent } from './use-card-drag'
import { MoveMenu } from './move-menu'
import { MoveAnnouncer } from './move-announcer'
import type { Filters } from '@/lib/board/filters'
import type { BoardRead } from '@/lib/board/query'

export function Board({
  board,
  filters,
  visible,
}: {
  board: BoardRead
  filters: Filters
  visible: OptimisticCard[]
}) {
  const [optimisticCards, applyMove] = useOptimistic(visible, moveReducer)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [revertedId, setRevertedId] = useState<string | null>(null)
  const dropRect = useRef<DOMRect | null>(null)

  function onMove(intent: MoveIntent) {
    const el = document.querySelector<HTMLElement>(
      `[data-card-id="${intent.cardId}"]`,
    )
    dropRect.current = el?.getBoundingClientRect() ?? null

    const toStatus = statusOfColumn(board, intent.toColumnId)
    setError(null)
    setRevertedId(null)

    // Everything below happens inside one Action. The optimistic value lives
    // exactly as long as this function's promise is unresolved.
    startTransition(async () => {
      applyMove({ ...intent, toStatus, filters })

      const result: MoveResult = await moveCard(intent)

      if (!result.ok) {
        setRevertedId(intent.cardId)
        setError(
          result.reason === 'conflict'
            ? 'Someone else moved this card. It has been put back.'
            : 'That move was not allowed.',
        )
        return
      }
      setAnnouncement(`${result.title} moved to ${result.columnName}, position ${result.index + 1}`)
    })
  }

  const drag = useCardDrag(onMove)

  return (
    <>
      {board.columns.map((column) => (
        <section key={column.id} data-column-id={column.id}>
          <h2>{column.name}</h2>
          {optimisticCards
            .filter((c) => c.columnId === column.id)
            .map((card) => (
              <article
                key={card.id}
                data-card-id={card.id}
                data-pending={card.pending || undefined}
                data-reverted={card.id === revertedId || undefined}
                onPointerDown={(e) => drag.onPointerDown(e, card.id)}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
                onPointerCancel={drag.onPointerCancel}
              >
                {card.title}
                <MoveMenu
                  cardId={card.id}
                  columns={board.columns}
                  currentColumnId={card.columnId}
                  countByColumn={countByColumn(optimisticCards)}
                  onMove={onMove}
                />
              </article>
            ))}
        </section>
      ))}

      {error && <p role="alert">{error}</p>}
      <MoveAnnouncer message={announcement} />
    </>
  )
}
```

### The three properties of that handler

**The `applyMove` call and the `await` are in the same transition body.** That is what the caveat requires, and it is also what makes the optimistic value last for the whole round trip rather than for one frame.

**`setError` and `setRevertedId` are ordinary state, deliberately.** They must outlive the transition — an error message that vanished the instant the optimistic value did would be invisible. This is the dividing line: anything that describes *the attempt* is optimistic state; anything that describes *the outcome* is real state.

**Nothing about the drag survives into the handler.** `endDrag()` already ran in `finish()` ([07g](07g-milestone-the-drag-layer.md)), so by the time `onMove` is called the store is clean and the ghost's transform is cleared. If you clear the drag state *after* the action instead, the card floats under the cursor for the length of the network call.

## Animating the revert

A rejected move that snaps the card back with no transition reads as a bug. The card was in one place, then it is in another, and nothing connects the two.

The fix is the second half of a FLIP animation. The "first" rectangle is the one captured at drop time (`dropRect`); the "last" is where the card ends up after the revert commits; the delta is played backwards with the Web Animations API:

```tsx filename="app/(dashboard)/boards/[boardId]/use-revert-animation.ts"
'use client'

import { useEffect, type RefObject } from 'react'

export function useRevertAnimation(
  revertedId: string | null,
  from: RefObject<DOMRect | null>,
) {
  useEffect(() => {
    if (!revertedId || !from.current) return
    const el = document.querySelector<HTMLElement>(
      `[data-card-id="${revertedId}"]`,
    )
    if (!el) return

    const to = el.getBoundingClientRect()
    const dx = from.current.left - to.left
    const dy = from.current.top - to.top
    if (dx === 0 && dy === 0) return

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 180, easing: 'ease-out' },
    )
  }, [revertedId, from])
}
```

Called from the board as `useRevertAnimation(revertedId, dropRect)`. The card renders in its correct, reverted position immediately — so nothing about the DOM is a lie — and is then *drawn* travelling from where the user dropped it back to where it belongs. React state is never animated; only the visual is.

⚠️ Respect the user's motion preference. Wrap the `animate` call in a `matchMedia('(prefers-reduced-motion: reduce)')` check and skip it when the user has asked for less motion; a snap is the correct behaviour for that user, not a degraded one.

## Gotchas

**★ Symptom: `An optimistic state update occurred outside a Transition or Action` in the console, and the card flashes into its new column and immediately back.** Cause: the setter was called from a plain event handler. React documents both the message and the behaviour — the update happens, then reverts on the next render, because there is no pending Action for it to belong to. Fix: wrap the whole operation, not just the setter:

```ts
// 🚩 outside a Transition
function handleDrop(intent) { applyMove(intent); moveCard(intent) }
// ✅ inside one Action
function handleDrop(intent) {
  startTransition(async () => { applyMove(intent); await moveCard(intent) })
}
```

**★ Symptom: `Cannot update optimistic state while rendering`.** Cause: the setter was called in the component body rather than in a handler or effect — usually by deriving "if the card is pending, apply the move" during render. Fix: optimistic updates are caused by events, never by rendering. If you need a pending appearance, put the flag *in* the optimistic value (`pending: true` in the reducer) and render from that.

**★ Symptom: the card reverts the instant the `await` resolves, even though the server accepted the move.** Cause: the transition ended, so `optimisticState` went back to being `value` — and `value` is still the props from the render that preceded the action, because the action's response carried no new UI. Fix: the action must trigger a re-render in its own response. That is a server-side decision and it is the whole of [07k](07k-milestone-the-action-and-what-invalidates-what.md); the short version is `updateTag`, not `revalidateTag` with a stale-while-revalidate profile.

**★ Symptom: a card dragged out of the current filter stays visible for a moment and then disappears.** Cause: the reducer changed the card's column but did not re-run the filter predicate, so the optimistic render disagrees with the server render about whether the card belongs on screen. Fix: run `matchesFilters` inside the reducer and drop the card from the optimistic list when it no longer matches — the branch in `moveReducer`. This is the one place the predicate genuinely lives on both sides, and [07b](07b-milestone-filters-on-the-server.md) is why it is one module.

**★ Symptom: two quick drops and the second card lands in the wrong slot.** Cause: the reducer took a precomputed rank as input, so the second action's rank was computed against the list as it was before the first action applied. Fix: compute inside the reducer from the state it is given, which is the documented remedy — *"consider using an updater function or reducer to calculate the optimistic state relative to the current state."* `moveReducer` takes an index and derives the rank; it never accepts one.

**★ Symptom: the error message flashes and disappears with the optimistic state.** Cause: the message was stored in optimistic state, which by definition ends with the transition. Fix: ordinary `useState` for anything describing the outcome. The rule: the attempt is optimistic, the outcome is real.

**★ Symptom: the dragged card hangs under the cursor while the server thinks.** Cause: `endDrag()` is being called after the action resolves, so the store still reports a drag in progress for the length of the round trip. Fix: the gesture ends when the pointer is released; the mutation is a separate phase. `finish()` clears the drag before it calls `onMove`, and the pending appearance is carried by the optimistic card's `pending` flag instead.

**★ Symptom: the `pending` styling never goes away on one card.** Cause: `pending` was written into real state rather than produced by the reducer, so nothing removes it — there is no "the server confirmed" event to hook. Fix: `pending: true` belongs in the object the reducer returns, so it exists only while the optimistic value does and disappears with it. React's own list example does the same thing with a per-item flag.

**★ Symptom: firing three moves at once with `Promise.all` produces inconsistent UI.** Cause: Next.js dispatches Server Actions one at a time per client — *"If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second"* — so the parallelism is imaginary while the optimistic reducer has already applied all three. Fix: do not batch client-side. If a multi-select move must be atomic, pass the whole set to one action and let the reducer apply one multi-card `MoveAction`.

**★ Symptom: the action throws and the user sees nothing but the card jumping back.** Cause: a thrown error inside the transition reverts the optimistic value and, with no error boundary configured for it, produces no message. Fix: return a typed result rather than throwing for expected failures, and read it after the await — the pattern is in [`01c · The typed action result`](../07-error-handling-loading-states-and-resilience/01c-the-typed-action-result-and-reading-it-back.md). Reserve throwing for genuinely exceptional cases, where a boundary is the right receiver.

**★ Symptom: the revert animation plays from the wrong position, or not at all.** Cause: the "first" rectangle was measured after the revert had already committed, so the delta is zero. Fix: capture the rect at drop time, before the optimistic update is applied — `dropRect.current = el.getBoundingClientRect()` is the first statement in `onMove`, deliberately before `startTransition`.

**★ Symptom: an audit flags the revert animation under reduced-motion.** Cause: the animation runs unconditionally. Fix: check `matchMedia('(prefers-reduced-motion: reduce)').matches` and skip the `animate` call. The reverted position is already correct in the DOM, so skipping the animation degrades to an instant move, which is exactly what the setting asks for.

## Interview questions

**★ Where does the optimistic value live, and what ends it?**
It lives inside the `useOptimistic` hook and it ends when the Action that is pending completes — React's wording is that the optimistic state equals the underlying `value` unless an Action is pending. That is why the setter must be called inside `startTransition` or an action prop: outside one there is no pending Action for the value to attach to, so React warns and the value renders only briefly. It is also why an error message or a "reverted" marker cannot be optimistic state: those must survive the thing that ends the optimistic value.

**★ Why does the optimistic reducer re-apply the filter predicate?**
Because the board is a filtered view, and a move can change whether a card belongs in it. Dragging a card from `Doing` to `Done` under `?status=doing` means the server's next render will not include that card at all. If the reducer only changes the column, the optimistic render shows the card sitting in the `Done` column, and then it vanishes when the server render lands — a flicker that looks like a bug. Applying the predicate optimistically makes the two renders agree. It is also the one place in the design where the same rule genuinely exists on both sides of the network, which is why it is a single shared pure module rather than two implementations.

**★ Why does the reducer compute the rank instead of accepting one?**
Because the optimistic reducer may be applied more than once and against a list that has changed since the action was created. React's troubleshooting guidance for stale optimistic values is precisely this: calculate the optimistic state relative to the current state rather than passing an absolute value. An index plus the current list always produces a sensible rank; a rank computed at drop time is correct only if nothing else moved first.

**★ A move succeeds on the server and the card visibly jumps back. Walk through why.**
The transition ends when the action's promise resolves. At that moment `useOptimistic` stops returning the reducer's output and returns `value` — the `visible` prop — which comes from the last render of the route. If the action's response carried a new render, `value` is the post-move list and nothing moves. If it did not, `value` is still the pre-move list, so the card is drawn back where it started even though the database disagrees. Whether the response carries a render is decided entirely by which invalidation the action called, which is [07k](07k-milestone-the-action-and-what-invalidates-what.md).

**★ You need three cards moved at once from a multi-select. How?**
One action taking three cards, not three actions. Next.js dispatches Server Actions sequentially per client, so `Promise.all` over three of them produces a queue rather than parallelism, while the optimistic reducer has already applied all three updates — the UI is ahead of a server that is working through them one at a time, and a failure in the second leaves an inconsistent middle state. A single action with a list argument is one round trip, one transaction, one result, and one optimistic action for the reducer to apply.

**★ Why animate the revert rather than just letting it snap?**
Because a card that teleports gives the user no information about what happened, and a rejected move is exactly the moment they need information. The animation is purely visual — the DOM is put in the correct, reverted state immediately, and the card is then drawn travelling from the drop point back to its home over about two hundred milliseconds — so nothing about the app's state is animated or delayed. The one case where snapping is right is a user who has asked for reduced motion, which the implementation must check.

**★ What is the difference between `pending` on an optimistic card and `isPending` from `useTransition`?**
Scope. `isPending` is one boolean for the whole transition: something is happening. `pending: true` on an optimistic card says *this card* is the thing that is happening, which is what you need on a board where the user may have moved one card while another is still settling. React documents the per-item flag as one of the three ways to know an optimistic update is in flight, and it is the only one of the three with per-item granularity. Use `isPending` for a global affordance like dimming the filter bar; use the per-item flag for the card.

---

← [07i · Ranks and keyboard moves](07i-milestone-ranks-and-the-accessible-move-path.md) · [Chapter 8 overview](01-explanation.md) · Next → [07k · The action and what invalidates what](07k-milestone-the-action-and-what-invalidates-what.md)
