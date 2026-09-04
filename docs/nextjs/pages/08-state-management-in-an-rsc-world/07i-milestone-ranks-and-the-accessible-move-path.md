---
title: "An integer position column makes every move a write to every card below it, so cards carry a fractional rank instead — and because the rank is arithmetic, a keyboard menu can produce exactly the same MoveIntent a drag does"
sidebar_label: "07i · Milestone: ranks and keyboard moves"
sidebar_position: 167
description: "Chapter 8's capstone, step five concluded: fractional ranks and why they beat integer positions, the precision limit that eventually forces renormalisation, why the client sends an index and the server computes the rank, and the keyboard move path with focus management and a live region."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against MDN — [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-live)
> and [`Number` — double-precision format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number),
> and the Next.js [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> (`lastUpdated: 2026-06-17`) for the trust boundary.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run** — no benchmarks and no screen-reader transcripts
> appear on this page.

**Two things decide whether "move this card to position 3" is a cheap operation or an expensive one, and neither is about drag-and-drop.** The first is how order is represented: an integer `position` column means a move rewrites every row below the insertion point and two concurrent moves silently corrupt each other, while a fractional `rank` means a move writes one row. The second is who computes the new rank: if the client sends it, the client is deciding where a row goes in a table it does not own. Getting both right also produces something unexpected — because a move is now expressible as pure arithmetic over two neighbours, a keyboard menu can emit the identical `MoveIntent` a drag does, and the accessible path stops being a parallel implementation.

## Why not an integer position

```sql
-- Moving a card from position 7 to position 2 in the same column:
UPDATE cards SET position = position + 1
 WHERE column_id = $1 AND position >= 2 AND position < 7;
UPDATE cards SET position = 2 WHERE id = $2;
```

Two problems, and the second is the one that hurts.

**Cost.** A move writes as many rows as it skips. On a column of two hundred cards, dragging from the bottom to the top is two hundred writes for one user gesture — and every one of them invalidates the same cache entry, so the cost is not only the writes.

**Concurrency.** Two users moving cards in the same column at the same time each compute their shifts against the state they read. The two `UPDATE` statements interleave, and the result is a column where two cards share a position or a position is skipped. Fixing that properly means serialising moves per column, which is a lock on a hot row for a gesture people perform constantly.

## Fractional ranks

Give each card a `rank` (a `double precision` column). A card's position is its rank's place in the sorted order, and moving a card means computing a rank *between* its new neighbours. One row changes.

```ts filename="lib/board/rank.ts"
/** Gap between ranks when a column is created or renormalised. */
export const RANK_STEP = 1024

/**
 * A rank strictly between prev and next.
 * null means "no neighbour on that side" — the start or the end of the column.
 */
export function rankBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return RANK_STEP
  if (prev === null) return next! - RANK_STEP
  if (next === null) return prev + RANK_STEP
  return (prev + next) / 2
}

/** The ranks a renormalised column should have. */
export function renormalise(ids: string[]): { id: string; rank: number }[] {
  return ids.map((id, i) => ({ id, rank: (i + 1) * RANK_STEP }))
}

/**
 * True when the gap between two neighbours is too small to bisect safely.
 * A double has a 53-bit significand, so repeatedly halving the same gap
 * exhausts it; this triggers renormalisation long before that point.
 */
export function needsRenormalise(prev: number | null, next: number | null): boolean {
  if (prev === null || next === null) return false
  return Math.abs(next - prev) < 1e-6
}
```

`RANK_STEP = 1024` is not superstition: a column created with ranks 1024, 2048, 3072 can absorb ten insertions between any two adjacent cards before the gap drops below 1, and the gap only matters once it approaches the floating-point limit.

### The precision limit, stated honestly

A JavaScript number is an IEEE 754 double with a 53-bit significand. Bisecting the same gap repeatedly halves it each time, so around fifty successive insertions between the same two neighbours drive the gap to the smallest representable difference at that magnitude, after which `(prev + next) / 2` returns a value equal to one of its endpoints and the ordering breaks — silently, because no error is thrown and the two cards simply compare equal.

Fifty insertions between the *same two cards* is not a thing a human does by accident; it is a thing a script does, or a thing that happens over years on a busy board. `needsRenormalise` is the guard, and renormalisation is a bulk update of one column's ranks back to `1024, 2048, 3072…`, run inside the same transaction as the move that triggered it.

The production-grade alternative is a string-based fractional index — LexoRank and its relatives — which has no precision ceiling because a string can always be extended. This milestone uses doubles because the arithmetic is legible and the renormalisation path has to exist either way; if your boards are long-lived and heavily reordered, the string scheme is the better engineering choice and the surrounding design does not change.

## The client sends an index; the server computes the rank

This is a trust boundary, not an optimisation. The Server Actions guide's rule for mutation arguments is exactly this:

> *"For example, a client legitimately tells the server *which* item to act on, but it should not supply the row's contents or ownership. Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session."*
> — [Server Actions and Mutations, Security](https://nextjs.org/docs/app/guides/server-actions#security)

A rank is row content. If the client sends `rank: 3.5`, the client has decided where a row sits in a table it cannot see the rest of, and a hand-crafted POST can send `rank: -1e308` or a rank that collides with another card's. So `MoveIntent` carries `{ cardId, toColumnId, toIndex }` — a reference and a change — and the action re-reads the column, finds the neighbours at that index, and computes the rank itself:

```ts filename="app/(dashboard)/boards/[boardId]/actions.ts"
// (excerpt — the full action, with auth and validation, is in 07j)
const siblings = await db.card.findMany({
  where: { columnId: toColumnId, NOT: { id: cardId } },
  orderBy: { rank: 'asc' },
  select: { id: true, rank: true },
})
const i = Math.max(0, Math.min(toIndex, siblings.length))
const prev = i > 0 ? siblings[i - 1].rank : null
const next = i < siblings.length ? siblings[i].rank : null
const rank = rankBetween(prev, next)
```

The clamp on `i` matters: `toIndex` came from a hit test on a DOM that may no longer match the database, so an out-of-range index is a normal event rather than an attack, and clamping is the right response to both.

## The keyboard path

A board that can only be reordered by dragging cannot be operated with a keyboard or a screen reader. The fix is not to make the drag keyboard-operable — that is a large, subtle piece of work — but to provide a second producer of the same `MoveIntent`.

```tsx filename="app/(dashboard)/boards/[boardId]/move-menu.tsx"
'use client'

import { useId, useState } from 'react'
import type { MoveIntent } from './use-card-drag'

export function MoveMenu({
  cardId,
  columns,
  currentColumnId,
  countByColumn,
  onMove,
}: {
  cardId: string
  columns: { id: string; name: string }[]
  currentColumnId: string
  countByColumn: Record<string, number>
  onMove: (intent: MoveIntent) => void
}) {
  const id = useId()
  const [columnId, setColumnId] = useState(currentColumnId)
  const max = countByColumn[columnId] ?? 0
  const [index, setIndex] = useState(0)

  return (
    <div className="move-menu">
      <label htmlFor={`${id}-col`}>Move to column</label>
      <select
        id={`${id}-col`}
        value={columnId}
        onChange={(e) => {
          setColumnId(e.target.value)
          setIndex(0)
        }}
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label htmlFor={`${id}-pos`}>Position</label>
      <input
        id={`${id}-pos`}
        type="number"
        min={0}
        max={max}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
      />

      <button
        type="button"
        onClick={() => onMove({ cardId, toColumnId: columnId, toIndex: index })}
      >
        Move
      </button>
    </div>
  )
}
```

Two native form controls and a button. It is not glamorous and it is completely operable by keyboard, by switch control and by voice, which the drag is not.

### Announcing the result

A move changes the page in a place the user may not be looking. A polite live region says what happened, once, on commit:

```tsx filename="app/(dashboard)/boards/[boardId]/move-announcer.tsx"
'use client'

export function MoveAnnouncer({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
```

The board sets `message` to something like `Fix flaky login test moved to Doing, position 2` after the action resolves, and clears it before the next move so a repeated identical move still announces. Announcing on every `pointermove` — "position 1, position 2, position 1" — is worse than announcing nothing, because a screen-reader user cannot skip it.

### Keeping focus

After a move the card re-renders in a new column, and if the trigger was a button inside the card, the focused element may be unmounted and focus falls to `body` — which sends a keyboard user back to the top of the document. Restore it deliberately:

```tsx
const pendingFocus = useRef<string | null>(null)

function move(intent: MoveIntent) {
  pendingFocus.current = intent.cardId
  onMove(intent)
}

useEffect(() => {
  const id = pendingFocus.current
  if (!id) return
  pendingFocus.current = null
  document.querySelector<HTMLElement>(`[data-card-id="${id}"] .move-trigger`)?.focus()
})
```

## Gotchas

**★ Symptom: moving one card writes a hundred rows and the board's cache entry is invalidated for every one of them.** Cause: an integer `position` column, so a move shifts everything between the old and new slots. Fix: a fractional `rank` and a single-row update — `rankBetween(prev, next)` — which touches exactly the card that moved.

**★ Symptom: two users reorder the same column at the same time and the order ends up nonsensical for both.** Cause: integer shifts computed against separately-read snapshots, interleaved. Fix: fractional ranks make the two moves independent, because each writes only its own row and neither depends on the others' positions. Where they can still collide is on producing the *same* rank, which the next gotcha covers.

**★ Symptom: two cards end up with identical ranks and their order flips on every render.** Cause: two clients dropped into the same gap at the same moment, both computed the same midpoint, and the sort is not total. Fix: make the sort total with a deterministic tie-break, and add a uniqueness guarantee if the order must be stable across clients:

```ts
cards.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
```

**★ Symptom: after months of use, dropping a card between two specific cards has no effect at all.** Cause: the gap between those two ranks reached the floating-point limit, so `(prev + next) / 2` returns one of the endpoints and the "new" rank sorts equal to a neighbour. Fix: check before bisecting and renormalise the column in the same transaction:

```ts
if (needsRenormalise(prev, next)) {
  const ordered = siblings.map((s) => s.id)
  ordered.splice(i, 0, cardId)
  await db.$transaction(
    renormalise(ordered).map(({ id, rank }) =>
      db.card.update({ where: { id }, data: { rank } }),
    ),
  )
} else {
  await db.card.update({ where: { id: cardId }, data: { rank: rankBetween(prev, next) } })
}
```

**★ Symptom: a card can be moved to a position the UI never offered, or a rank outside every reasonable value.** Cause: the client sent the rank. Fix: the client sends `toIndex`; the server re-reads the column and computes the rank, clamping the index into range. A rank is row content and the Server Actions guide is explicit that a client sends a reference plus a change, not the row's contents.

**★ Symptom: dropping into an empty column produces `NaN` or throws.** Cause: `rankBetween` called with two nulls, or with arithmetic that assumes a neighbour exists. Fix: the three explicit branches at the top of `rankBetween` — both null returns `RANK_STEP`, one null extends past the single neighbour by a step. An empty column is the common case on a new board, not an edge case.

**★ Symptom: an accessibility audit fails the board outright.** Cause: reordering is available only through a pointer gesture, which is unusable by keyboard, switch and voice users. Fix: a second producer of `MoveIntent` — the `MoveMenu` above — reachable in the tab order from the card. This is also why the drag layer emits an intent rather than calling the action: two producers, one consumer.

**★ Symptom: after a keyboard move, the next Tab press starts from the top of the page.** Cause: the focused control was inside the card, the card re-rendered elsewhere, and the focused node was unmounted, so focus reverts to `body`. Fix: record the card id before the move and restore focus to its trigger in an effect after the commit, as above.

**★ Symptom: a screen reader reads a stream of position changes throughout the drag.** Cause: the live region is bound to the drop target in the store, which changes on every crossing. Fix: announce on commit only. The live region's content comes from the *result* of the move, never from the in-progress gesture — and `aria-live="polite"` rather than `assertive`, so it waits for a pause instead of interrupting.

**★ Symptom: the same identical move announces the first time and is silent afterwards.** Cause: a live region only announces when its text content *changes*, so setting it to the same string twice produces one announcement. Fix: clear the message before setting the next one, or append an invisible counter, so consecutive identical moves are two distinct strings.

**★ Symptom: the drag handle is a `div` with `role="button"` and does nothing when a keyboard user presses Enter.** Cause: `role` announces a control; it does not make one. Fix: use a real `button` for anything keyboard-operable — the `MoveMenu`'s trigger — and leave the drag handle without a role, since it is a pointer affordance whose functionality is provided elsewhere. A control that announces itself as a button and does not respond to Enter is worse than an unlabelled one.

## Interview questions

**★ Why store a fractional rank instead of an integer position?**
Because a move under integer positions rewrites every row between the old and new slots, and two concurrent moves computed against separate snapshots interleave into a corrupt order. A fractional rank makes a move a single-row update — compute a value between the two new neighbours — so cost is constant regardless of distance and two users moving different cards never touch the same rows. The price is a precision ceiling: bisecting the same gap repeatedly runs out of double precision after roughly fifty insertions, which is why a renormalisation path has to exist.

**★ What actually happens when fractional ranks run out of precision, and how do you detect it?**
A double has a 53-bit significand, so halving the same gap repeatedly reaches the smallest representable difference at that magnitude, and `(prev + next) / 2` then returns a value equal to one of its endpoints. Nothing throws: two cards simply have the same rank and their relative order becomes whatever the sort does with ties. You detect it before it happens by checking the gap size before bisecting, and you fix it by renormalising the column's ranks back to evenly-spaced values in the same transaction as the move. The alternative that has no ceiling is a string-based fractional index, which can always be extended by another character.

**★ Should the client send the new rank or the new index?**
The index. A rank is content of the row being written, and the Server Actions guide's rule is that a client sends a reference plus its change, with everything else re-read from a trusted source. A client that sends a rank can send one that collides, one that is out of range, or one that places a card somewhere the UI never offered — and the server has no way to tell a legitimate rank from a crafted one. Sending the index means the server re-reads the column, finds the neighbours itself, clamps an out-of-range index, and computes a rank it can reason about.

**★ How do you make a drag-and-drop board usable without a pointer?**
Not by making the drag keyboard-operable, which is a large and subtle piece of work, but by providing a second, ordinary way to express the same operation — a menu on each card that selects a target column and position and emits the identical `MoveIntent`. That is why the drag layer's output is a plain object rather than a call to the mutation: two producers, one consumer, and the accessible path is not a parallel implementation that can drift. Add a polite live region announcing the result on commit, and restore focus to the moved card afterwards, because a re-rendered card unmounts the focused element and dumps focus on `body`.

**★ Why announce on commit rather than during the drag?**
Because a live region is a queue a user cannot skip. Announcing during the drag emits a string per crossing — "position 1, position 2, position 1" — which for a screen-reader user is a wall of noise that arrives after the fact and describes a gesture they are not performing. The useful announcement is one sentence naming what changed, after it changed. `polite` rather than `assertive` for the same reason: the move is not urgent enough to interrupt whatever is being read.

**★ Both a drag and a keyboard menu can move a card. How do you stop the two paths diverging?**
By making the drag produce data rather than perform an action. `useCardDrag` ends by calling `onMove(intent)` and knows nothing about Server Actions, optimism or revalidation; `MoveMenu` calls the same callback with the same object type. Everything downstream — validation, the optimistic update, the reconciliation — has exactly one implementation and does not know which producer it came from. The divergence people ship happens when the drag calls the mutation directly and the accessible path is added later as a second call site with its own slightly different behaviour.

---

← [07h · Finding the drop target](07h-milestone-finding-the-drop-target.md) · [Chapter 8 overview](01-explanation.md) · Next → [07j · The drop, the action and reconciliation](07j-milestone-the-drop-the-action-and-reconciliation.md)
