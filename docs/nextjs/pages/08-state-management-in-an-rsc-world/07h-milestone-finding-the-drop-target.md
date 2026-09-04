---
title: "Pointer capture suppresses the enter and leave events, so the drop target cannot be discovered by listening — it has to be computed from rectangles you measured yourself, and every bug in this file is a rectangle that went stale"
sidebar_label: "07h · Milestone: the drop target"
sidebar_position: 50
description: "Chapter 8's capstone, step five continued: the ref registry of column and card elements, hit-testing pointer coordinates against measured rects, computing an insertion index from card midpoints, why the dragged card needs pointer-events: none, re-measuring on scroll, and suppressing a drop that does not move anything."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against MDN — [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
> (pointer capture and the events it suppresses) and
> [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run** — no frame rates or layout timings appear on this page.

**"Which column is the pointer over?" looks like a question the DOM should answer, and during a captured drag it refuses to.** MDN states the rule directly: while pointer capture is held, `pointerover`, `pointerenter`, `pointerleave` and `pointerout` do not fire. Every event goes to the capturing element as though it had occurred there. So the columns never learn the pointer arrived, and the drop target has to be computed — coordinates against rectangles, an index against card midpoints. This page is that computation, and the three ways the rectangles stop being true.

## The rule

> *"Pointer capture will cause the target to capture all subsequent pointer events as if they were occurring over the capturing target. Accordingly, `pointerover`, `pointerenter`, `pointerleave`, and `pointerout` will not fire as long as this capture is set."*
> — [MDN, *Pointer events* → Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#pointer_capture)

This is not a workaround being forced on you. It is the documented consequence of asking for the thing that makes the drag work at all ([07g](07g-milestone-the-drag-layer.md)). Give up capture and the enter/leave events come back — along with a drag that ends the moment the pointer leaves the card.

There is one more line worth knowing, because it explains why touch behaves differently before you write any code:

> *"For touchscreen browsers that allow direct manipulation, an implicit pointer capture will be called on the element when a `pointerdown` event triggers."*
> — [MDN, *Pointer events* → Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#pointer_capture)

Touch already captures implicitly. A mouse does not. A hand-rolled drag that omits `setPointerCapture` therefore works on a phone and fails on a desktop, which is the reverse of the usual bug report and takes a while to believe.

## The registry

Columns and cards register their DOM nodes on mount. It is a ref, not state: nothing renders from it, and it changes on every mount and unmount.

```tsx filename="app/(dashboard)/boards/[boardId]/rect-registry.tsx"
'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'

export type Registry = {
  columns: Map<string, HTMLElement>
  cards: Map<string, HTMLElement>
}

const RegistryContext = createContext<Registry | null>(null)

export function RectRegistryProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Registry>({ columns: new Map(), cards: new Map() })
  return (
    <RegistryContext.Provider value={registry.current}>
      {children}
    </RegistryContext.Provider>
  )
}

export function useRectRegistry(): Registry {
  const r = useContext(RegistryContext)
  if (!r) throw new Error('useRectRegistry must be used inside RectRegistryProvider')
  return r
}

/** Ref callback: registers on mount, removes on unmount. */
export function register(map: Map<string, HTMLElement>, id: string) {
  return (el: HTMLElement | null) => {
    if (el) map.set(id, el)
    else map.delete(id)
  }
}
```

Attached where the elements are rendered:

```tsx
const { columns, cards } = useRectRegistry()

// column.tsx
<section ref={register(columns, columnId)} data-column-id={columnId}>…</section>

// card.tsx
<article ref={register(cards, card.id)} data-card-id={card.id}>…</article>
```

The `else map.delete(id)` branch is not optional. React calls a ref callback with `null` on unmount, and a registry that never deletes accumulates detached nodes — every card the user has ever filtered away, retained for the lifetime of the page, with its subtree.

## The hit test

```ts filename="app/(dashboard)/boards/[boardId]/hit-test.ts"
import type { DropTarget } from '@/stores/board-ui-store'
import type { Registry } from './rect-registry'
import type { Session } from './use-card-drag'

/** Measured once at drag start, and again on scroll. */
export function measureColumns(registry: Registry) {
  return [...registry.columns].map(([id, el]) => ({
    id,
    rect: el.getBoundingClientRect(),
  }))
}

export function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.columnId === b.columnId && a.index === b.index
}

export function hitTest(
  x: number,
  y: number,
  s: Session,
  registry: Registry,
): DropTarget | null {
  const hit = s.columnRects.find(
    ({ rect }) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  )
  if (!hit) return null

  const columnEl = registry.columns.get(hit.id)
  if (!columnEl) return null

  // Index = how many cards in this column have their midpoint above the pointer.
  const cardEls = [...columnEl.querySelectorAll<HTMLElement>('[data-card-id]')]
  let index = 0
  for (const el of cardEls) {
    if (el.dataset.cardId === s.cardId) continue // ignore the card being dragged
    const r = el.getBoundingClientRect()
    if (y > r.top + r.height / 2) index++
  }
  return { columnId: hit.id, index }
}
```

### Why midpoints and not edges

Comparing the pointer against each card's **midpoint** gives a stable answer with no dead zones: every vertical position in the column maps to exactly one insertion index, and the index changes precisely when the pointer crosses the middle of a card. Comparing against a card's top or bottom edge leaves gaps between cards where the answer is ambiguous, and the placeholder flickers as the pointer crosses a margin.

### Why the dragged card is skipped

The card being dragged is still in the DOM — it is the ghost, transformed but not removed — so counting it would shift every index below it by one, and dropping a card back where it started would report a different index than it currently occupies. Skipping it makes the index mean "position in the column *excluding* this card", which is exactly what a move needs.

## Rectangles go stale three ways

**Scroll.** `getBoundingClientRect()` is viewport-relative, so any scroll during the drag invalidates every cached rect. Re-measure on scroll rather than per frame:

```ts
// in the branch that sets s.dragging = true
const onScroll = () => { s.columnRects = measureColumns(registry) }
window.addEventListener('scroll', onScroll, { passive: true, capture: true })
s.cleanup = () => window.removeEventListener('scroll', onScroll, { capture: true })
```

`capture: true` matters: a column that scrolls internally emits a `scroll` event that does not bubble, and only a capturing listener on `window` sees it.

**Layout.** A filter change landing mid-drag, a card being removed by another user's action arriving through a revalidation, or the optimistic placeholder itself changing a column's height all move the rects without a scroll event. The honest answer is that a drag and a re-render are hard to reconcile perfectly; the practical answer is to re-measure whenever the drop target changes column, which is cheap and catches the cases a user can perceive.

**Resize.** The same fix as scroll, on `resize`. On a desktop this is rare mid-drag; on a phone it is the address bar collapsing, which is not rare at all.

## Suppressing the drop that does nothing

`hitTest` deliberately still returns a target when the pointer is over the card's own current position — the placeholder needs to render there. The no-op is suppressed at the *emit* point instead:

```ts filename="app/(dashboard)/boards/[boardId]/use-card-drag.ts"
function isNoOp(cardId: string, target: DropTarget, cards: CardRow[]): boolean {
  const card = cards.find((c) => c.id === cardId)
  if (!card || card.columnId !== target.columnId) return false
  const siblings = cards
    .filter((c) => c.columnId === target.columnId && c.id !== cardId)
    .sort((a, b) => a.rank - b.rank)
  const currentIndex = cards
    .filter((c) => c.columnId === target.columnId)
    .sort((a, b) => a.rank - b.rank)
    .findIndex((c) => c.id === cardId)
  return target.index === currentIndex || target.index === siblings.length + 1
}
```

Without this, picking a card up and putting it back fires a Server Action, invalidates the board tag and re-renders the route — a full round trip that changes nothing. It is invisible in development and it is a meaningful share of production traffic on a board, because "pick up and reconsider" is a thing users do constantly.

## Gotchas

**★ Symptom: `onPointerEnter` on the columns never fires during a drag, so the drop target is always null.** Cause: exactly what capture does — *"`pointerover`, `pointerenter`, `pointerleave`, and `pointerout` will not fire as long as this capture is set."* Fix: do not use them; hit-test coordinates against measured rectangles. This is the most common reason a hand-rolled pointer drag "works until you drag fast", because the last enter event that did fire was before capture was established.

**★ Symptom: the drag works on a phone and does nothing on a desktop.** Cause: `setPointerCapture` was never called, and touchscreen browsers capture implicitly on `pointerdown` while a mouse does not. Fix: call it explicitly in `pointerdown`. The reversed platform pattern is the tell.

**★ Symptom: the drop lands one position off after the board has been scrolled.** Cause: rects cached at drag start are viewport-relative and the viewport moved. Fix: re-measure on scroll with a capturing listener on `window`, as above — a non-capturing listener misses a column's internal scroll because `scroll` does not bubble from an element.

**★ Symptom: `document.elementFromPoint` under the pointer always returns the card being dragged.** Cause: the floating card sits under the cursor and is therefore the topmost hit-test result. Fix: `pointer-events: none` on the dragged card, which removes it from hit-testing entirely:

```css
.card.is-dragging {
  pointer-events: none;
  will-change: transform;
}
```

The stored-rect approach in `hitTest` sidesteps this, but any fallback to `elementFromPoint` — and they creep in for edge cases — reintroduces it.

**★ Symptom: the placeholder flickers between two positions as the pointer moves slowly between cards.** Cause: the index is computed from card edges rather than midpoints, so the margin between two cards belongs to neither. Fix: compare against `r.top + r.height / 2`, which partitions the column with no gaps and no overlaps.

**★ Symptom: dropping a card back where it came from still fires a mutation.** Cause: `hitTest` returns a valid target for the card's own position, and nothing checks it. Fix: `isNoOp` at the emit point, not inside the hit test — the hit test's answer is still needed to render the placeholder while hovering in place.

**★ Symptom: memory grows steadily as the user filters the board.** Cause: the registry's ref callback stores nodes but never removes them, so every unmounted card's element is retained by the `Map`. Fix: the `else map.delete(id)` branch. React calls the callback with `null` on unmount precisely so you can do this, and it is the line people delete because "it looks redundant".

**★ Symptom: the index is right for the visible cards and wrong for the real list.** Cause: the column is virtualised, so `querySelectorAll('[data-card-id]')` sees only the rendered window and the index counts from the top of that window rather than from the top of the column. Fix: with virtualisation, the index cannot be derived from the DOM at all — compute it from the data using the virtualiser's item positions, or drop the index entirely and express the move as "before card X" / "after card X", which survives windowing because it names an anchor rather than a count.

**★ Symptom: the hit test throws because a column element is missing.** Cause: a column unmounted mid-drag — a filter change, or a column deleted by another user — leaving its id in the cached `columnRects` but not in the registry. Fix: the `if (!columnEl) return null` guard, which degrades to "no drop target" rather than crashing the pointer handler. A throw inside a `pointermove` handler leaves the gesture in whatever state it was in, with no cleanup.

## Interview questions

**★ Why can't you find the drop target with `pointerenter` on each column?**
Because you asked for pointer capture, and capture retargets every subsequent pointer event to the capturing element as if it were occurring there — MDN states that `pointerover`, `pointerenter`, `pointerleave` and `pointerout` do not fire while a capture is set. The columns never learn the pointer arrived. The alternative is not to capture, but then the drag ends the moment the pointer leaves the card, which is worse. Given capture, the drop target has to be computed geometrically: measure the columns' rectangles and test the pointer's coordinates against them.

**★ The hit test reads the DOM during a pointer move. Isn't that a performance problem?**
It is a real cost and the code is structured around it. Column rectangles are measured once at drag start and cached on the session rather than re-read per frame; only the per-card midpoint comparison walks the DOM, and only within the single column under the pointer. The remaining risk is the cache going stale on scroll, which is why re-measuring is triggered by the scroll event rather than by every move. The version to avoid is calling `getBoundingClientRect()` on every element on every frame, which forces a layout each time.

**★ Why is the insertion index computed from midpoints rather than from which card the pointer is over?**
Because "which card is the pointer over" has no answer in the gaps between cards, and a column with margins is mostly gaps at the boundaries where the answer changes. Counting how many cards have their midpoint above the pointer is total: every vertical coordinate in the column maps to exactly one index, the mapping is monotonic, and the index flips at the visual midpoint of a card, which is where a user expects it to. It also handles the empty column for free — no cards, no midpoints above, index 0.

**★ Your column is virtualised so only twenty of two hundred cards are in the DOM. What breaks and how do you fix it?**
The index breaks, because it is derived by counting DOM nodes and the DOM holds a window rather than the list. The fix is to stop deriving position from the DOM: either compute the index from the data using the virtualiser's own item offsets, or change the move's representation from an index to an anchor — "place this card after card X" — which is stable under windowing because it names a neighbour that is definitionally on screen. The anchor form is also more robust under concurrent edits, since an index computed against a list another user has changed refers to a different slot than you meant.

**★ Why suppress a drop that does not move the card, rather than letting the server no-op it?**
Because a Server Action is not free even when it decides to do nothing: it is a POST, it is dispatched sequentially with every other action from that client, it holds a transition open, and if it calls an invalidation it re-renders the route. "Pick up a card, think about it, put it back" is a constant user behaviour, so the no-op is a meaningful share of a board's traffic. The check belongs on the client because the client already knows the card's current position — it just rendered it — and the server would need a read to find out.

**★ Why does the registry store DOM nodes in a `Map` in a ref, rather than keeping an array of refs in state?**
Because it is a lookup table that changes on every mount and unmount and that nothing renders from. State would re-render the board every time a card mounted; an array of refs would need to stay index-aligned with a list that filters and reorders, which is exactly the invariant that breaks. A `Map` keyed by id survives reordering, filtering and virtualisation without any alignment to maintain, and the ref callback keeps it accurate in both directions as long as the `null` branch deletes.

---

← [07g · The drag gesture](07g-milestone-the-drag-layer.md) · [Chapter 8 overview](01-explanation.md) · Next → [07i · Ranks and the accessible move path](07i-milestone-ranks-and-the-accessible-move-path.md)
