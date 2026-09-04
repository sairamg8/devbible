---
title: "The drag layer touches no network at all — it turns a finger into one MoveIntent object, and every line of it exists because pointer capture keeps the events coming and pointercancel takes them away"
sidebar_label: "07g · Milestone: the drag gesture"
sidebar_position: 49
description: "Chapter 8's capstone, step five: why pointer events rather than a library or HTML5 drag, setPointerCapture, the movement threshold that keeps a card clickable, writing the ghost's transform to the DOM instead of to state, deduping store writes, and cancelling cleanly when the browser takes the gesture."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against MDN — [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
> (pointer capture, `pointercancel`, `touch-action`) and
> [`Element.setPointerCapture()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zustand 5.0.15**.
> Documentation-verified; **no sandbox run** — no frame rates, no input-latency figures and no
> device matrix appear on this page.

**This layer touches no network, no Server Action and no cache. Its entire job is to turn a finger or a mouse into one `MoveIntent` object and hand it upward.** Keeping it that narrow is what makes it testable and what makes [07j](07j-milestone-the-drop-the-action-and-reconciliation.md) — where the optimism and the reconciliation live — comprehensible at all. The gesture has exactly three interesting moments: the press that is not yet a drag, the capture that keeps events flowing after the pointer leaves the card, and the cancellation that happens when the browser decides your drag was a scroll. Finding the drop target is a separate problem with a separate cause, and it is [07h](07h-milestone-finding-the-drop-target.md).

## Why pointer events, and not the alternatives

Three options exist and two are rejected.

**A drag-and-drop library** would work, and this milestone deliberately does not name one, because the pattern it teaches — ephemeral gesture state in a scoped store, an intent object crossing to an optimistic layer — is identical whichever library you pick, and a page that hinges on one teaches the library rather than the pattern. If you adopt one, the store in [07e](07e-milestone-the-scoped-zustand-store.md) holds whatever the library gives you and everything downstream is unchanged.

**HTML5 drag events** (`dragstart`, `dragover`, `drop`, `DataTransfer`) are the platform's built-in answer and they carry platform behaviour you do not control: a browser-rendered drag image, a `dragover` handler that must call `preventDefault()` for a drop to be permitted at all, and a gesture whose availability on touch input varies by platform. ⚠️ I did not verify per-browser touch support for the HTML5 drag events against a primary source, so treat that last point as a reason to prefer pointer events rather than as a compatibility claim.

**Pointer events** are one code path for mouse, touch and pen, with an explicit capture model and an explicit cancellation event. That is what this page uses.

## Capture, and cancellation

> *"Pointer capture allows events for a particular pointer event to be re-targeted to a particular element instead of the normal hit test at a pointer's location. This can be used to ensure that an element continues to receive pointer events even if the pointer device's contact moves off the element (for example by scrolling or panning)."*
> — [MDN, *Pointer events* → Pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#pointer_capture)

That is why you capture: without it, moving the mouse off the card stops the drag dead. It also has a consequence that shapes the *next* page rather than this one, and it is stated in the same section — the enter/leave family of events stops firing while capture is held.

Cancellation is the other half:

> *"A browser fires this event if it concludes the pointer will no longer be able to generate events (for example, if the related device is deactivated, or the browser decided to interpret the interaction as a pan/zoom instead). For information on how to control this behavior, see the section on the `touch-action` CSS property below."*
> — [MDN, `pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)

Read the parenthesis. On a touchscreen, the browser deciding your drag was a scroll arrives as a `pointercancel` and nothing else. If you do not handle that event, the store keeps `draggingCardId` set forever and the board is stuck with a floating card. The way to stop the browser making that decision in the first place is `touch-action`:

> *"The `touch-action` CSS property is used to specify whether or not the browser should apply its default (native) touch behavior (such as zooming or panning) to a region."*
> — [MDN, *Pointer events* → `touch-action`](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#touch-action_css_property)

## The gesture

```tsx filename="app/(dashboard)/boards/[boardId]/use-card-drag.ts"
'use client'

import { useRef } from 'react'
import { useBoardUiApi } from '@/providers/board-ui-provider'
import { useRectRegistry, type Registry } from './rect-registry'
import { hitTest, sameTarget, measureColumns } from './hit-test'
import type { DropTarget } from '@/stores/board-ui-store'

const THRESHOLD_PX = 5

export type MoveIntent = {
  cardId: string
  toColumnId: string
  toIndex: number
}

export type Session = {
  pointerId: number
  cardId: string
  startX: number
  startY: number
  dragging: boolean
  ghost: HTMLElement | null
  columnRects: { id: string; rect: DOMRect }[]
  lastTarget: DropTarget | null
}

export function useCardDrag(onMove: (intent: MoveIntent) => void) {
  const api = useBoardUiApi()
  const registry: Registry = useRectRegistry()
  const session = useRef<Session | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLElement>, cardId: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Capture must be taken while the element is still under the pointer.
    e.currentTarget.setPointerCapture(e.pointerId)
    session.current = {
      pointerId: e.pointerId,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      ghost: null,
      columnRects: [],
      lastTarget: null,
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return

    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY

    if (!s.dragging) {
      // Below the threshold this is still a click, not a drag.
      if (Math.hypot(dx, dy) < THRESHOLD_PX) return
      s.dragging = true
      s.ghost = registry.cards.get(s.cardId) ?? null
      s.columnRects = measureColumns(registry)
      document.body.classList.add('dragging')
      api.getState().beginDrag(s.cardId)
    }

    // 60Hz: write the transform straight to the DOM. No React, no store.
    if (s.ghost) s.ghost.style.transform = `translate3d(${dx}px, ${dy}px, 0)`

    const next = hitTest(e.clientX, e.clientY, s, registry)
    if (!sameTarget(next, s.lastTarget)) {
      s.lastTarget = next
      api.getState().setDropTarget(next) // store write only on a real change
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return
    finish(s, s.dragging ? s.lastTarget : null)
  }

  function onPointerCancel(e: React.PointerEvent<HTMLElement>) {
    const s = session.current
    if (!s || e.pointerId !== s.pointerId) return
    finish(s, null) // browser took the gesture: abandon, do not move
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && session.current) finish(session.current, null)
  }

  function finish(s: Session, target: DropTarget | null) {
    if (s.ghost) s.ghost.style.transform = ''
    document.body.classList.remove('dragging')
    api.getState().endDrag()
    session.current = null
    if (target) {
      onMove({ cardId: s.cardId, toColumnId: target.columnId, toIndex: target.index })
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown }
}
```

### The four decisions in that file

**The 5px threshold** is what keeps a card clickable. Without it, `pointerdown` starts a drag, `pointerup` ends it, and the card's `onClick` — which opens the card detail — either never fires or fires after a spurious move. A press that moves four pixels stays a click and the drag machinery never engages.

**`setPointerCapture` on `pointerdown`, not on the first move.** Capture must be established while the element is still under the pointer. It is also what makes `pointerup` reliably arrive at the element that started the gesture, which is why `finish()` can assume its session is the right one.

**The transform is written to `style.transform`, not to state.** A pointer move at 60Hz routed through `useState` or the store would re-render the board sixty times a second to move one element four pixels. The ghost's position is not state anyone renders from — it is a visual consequence of the pointer — so it is written directly to the node the registry already holds.

**`setDropTarget` is called only when the target changes.** `sameTarget` is not a last-resort optimisation. Without it the store is written on every frame regardless of whether anything differs, and every subscriber re-evaluates its selector sixty times a second for an answer that did not move. Dedupe at the source, not at the subscriber.

## The CSS that is part of the gesture

```css filename="app/(dashboard)/boards/[boardId]/board.css"
/* Without this, a finger drag is a scroll gesture and the browser fires
   pointercancel instead of pointermove. On the handle only — putting it on
   a scrollable column disables scrolling for that column. */
.card-handle {
  touch-action: none;
}

/* Stop the drag selecting card titles as text — for the duration only, so a
   user can still select and copy a title when not dragging. */
body.dragging {
  user-select: none;
}
```

## Gotchas

**★ Symptom: after adding drag, clicking a card no longer opens it.** Cause: the drag begins on `pointerdown`, so every click is a zero-distance drag and the click handler is either suppressed or races the drop. Fix: the movement threshold — a session exists from `pointerdown` so capture can be taken, but `dragging` stays false, and `finish()` only emits a `MoveIntent` when it became true:

```ts
if (!s.dragging) {
  if (Math.hypot(dx, dy) < THRESHOLD_PX) return
  s.dragging = true
}
```

**★ Symptom: the drag stops the instant the pointer leaves the card.** Cause: no pointer capture, so once the pointer is over a different element the card stops receiving `pointermove`. Fix: `e.currentTarget.setPointerCapture(e.pointerId)` in `pointerdown` — MDN's description is that capture ensures an element "continues to receive pointer events even if the pointer device's contact moves off the element."

**★ Symptom: on a phone, dragging a card scrolls the board instead.** Cause: the browser interpreted the gesture as a pan and fired `pointercancel`. Fix: `touch-action: none` on the drag handle, the property MDN points to for controlling exactly this decision. Put it on the handle, not on the column — `touch-action: none` on a scrollable container disables that container's scrolling entirely.

**★ Symptom: a card gets stuck floating and the board stays in drag mode until a reload.** Cause: `pointercancel` not handled, so `endDrag()` never runs and `draggingCardId` has no event that will ever clear it. Fix: bind `onPointerCancel` to the same `finish(s, null)` path as Escape. On touch devices cancellation is not an edge case; it is how the browser tells you it took the gesture.

**★ Symptom: the board stutters visibly while dragging and the React profiler shows constant renders.** Cause: the ghost's position, or the pointer coordinates, went into state or the store. Fix: write the transform to the element through the registry ref, and dedupe store writes with `sameTarget`. The rule: the store may be written when the *answer* changes; it may not be written when the *input* changes.

**★ Symptom: two fingers, two cards, chaos.** Cause: a single session object with no pointer identity check, so a second `pointerdown` overwrites the first session and the first drag's `pointerup` tears down the wrong one. Fix: every handler begins with `if (!s || e.pointerId !== s.pointerId) return`. Supporting genuinely simultaneous drags means a `Map` of sessions keyed by `pointerId`, and it is worth asking whether the product wants that before building it.

**★ Symptom: the card jumps so its corner is under the pointer instead of moving relative to where it was grabbed.** Cause: the transform was computed from absolute pointer coordinates rather than from displacement since `pointerdown`. Fix: `translate3d(dx, dy, 0)` where `dx = e.clientX - s.startX`, which preserves the grab offset so the user keeps hold of the same part of the card.

**★ Symptom: Escape does nothing during a drag.** Cause: `keydown` is delivered to the focused element, and a card that was never focused does not receive it. Fix: focus the handle on `pointerdown`, or bind the Escape listener to `window` for the duration of the session:

```ts
// inside the branch that sets s.dragging = true
const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(s, null) }
window.addEventListener('keydown', onEsc)
s.cleanup = () => window.removeEventListener('keydown', onEsc)
// and in finish(): s.cleanup?.()
```

**★ Symptom: the drag session survives a re-render and then throws when it touches a detached node.** Cause: `session` was stored in state, or the ghost element reference was captured before a re-render replaced the DOM node. Fix: the session is a `useRef` (it survives renders without causing them) and the ghost is looked up from the registry at drag start, which holds whatever node is currently mounted. If a re-render can unmount the dragged card — a filter change landing mid-drag — `finish()` must tolerate `s.ghost` being detached, which it does because it only writes a style property.

## Interview questions

**★ What is the movement threshold for, and what is the right value?**
It preserves the click. Without a threshold every press-and-release is a degenerate drag, and the card's own click handler is either swallowed or races a spurious move. The value is a compromise between accidental drags and unresponsive ones; a handful of pixels is the usual choice and the exact number matters less than having one. The important part is *where* the threshold lives: the session is created on `pointerdown` so capture can be established, but `dragging` stays false — no store write, no ghost, no `beginDrag` — until the pointer has actually travelled.

**★ Why does the ghost card's position not live in the store, when the drop target does?**
Because of who renders from each. Nothing renders from the ghost's position except the ghost itself, whose transform can be written straight to the DOM node, so putting it in the store would buy nothing and cost a re-render of every subscriber at pointer-move frequency. The drop target is different: the placeholder renders from it, the target column highlights from it, and the source column dims from it, so it must be a value React can observe. The dividing line is "does more than one component need to react to this?", not "is it about the drag?".

**★ Someone reports that on Android the card sometimes stops mid-drag and the board is left broken. Where do you look?**
`pointercancel`. The browser fires it when it decides the gesture is a pan or zoom, and with no handler the store keeps `draggingCardId` set with no event that will ever clear it. Two fixes, both needed: handle `pointercancel` by running the same teardown as Escape with no move emitted, and set `touch-action: none` on the drag handle so the browser stops reclassifying the gesture in the first place. MDN links these two explicitly — the `pointercancel` description points at `touch-action` for controlling the behaviour.

**★ Why implement this by hand rather than adopt a drag-and-drop library?**
For this milestone, so the lesson is the state architecture rather than a library's API — the store, the intent object and the optimistic layer are identical whichever library you use, and a page built on one teaches the wrong thing. For a real product the calculation is different and usually favours a library, because the parts these two pages do not build are the expensive ones: keyboard dragging with a live region, auto-scroll near container edges, nested droppables, collision strategies and virtualised lists. The decision rule is whether you need any of those; if you do, buy them.

**★ The gesture writes directly to the DOM. Doesn't that fight React?**
It would if React also rendered that property. It does not: the card's `style.transform` is not set by JSX anywhere, so nothing React commits will overwrite it, and `finish()` clears it back to `''` when the gesture ends. That is the contract for imperative DOM writes in a React app — own a property completely or not at all. The version that genuinely fights React is setting a property React also renders, where the next commit silently reverts your write and the bug appears only when something unrelated re-renders.

**★ Why is the session a ref rather than state, given it clearly is state?**
Because nothing renders from it. A ref is the correct home for a value that must survive renders and must not cause them, and the drag session is exactly that: it is read by event handlers, written by event handlers, and never appears in JSX. Making it state would re-render the component on every field change — including `startX` at gesture start and `lastTarget` on every crossing — for no rendering benefit. The things that *do* render from the drag are in the store, deliberately narrowed to two fields.

---

← [07f · Selectors and resets](07f-milestone-selectors-resets-and-hydration.md) · [Chapter 8 overview](01-explanation.md) · Next → [07h · Finding the drop target](07h-milestone-finding-the-drop-target.md)
