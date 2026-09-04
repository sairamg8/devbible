---
title: "The board's interaction latency is not a mystery to be profiled — it is a drag handler doing work proportional to the number of cards, and the audit's job is to prove that from field data first and only then go looking for the loop"
sidebar_label: "07b · The INP problem on the board"
sidebar_position: 131
description: "Act two of the SprintDesk audit: collecting INP from real users with useReportWebVitals, why a drag-and-drop surface produces interaction latency by construction, seven candidate causes with the fix for each in code, and acceptance criteria that need no stopwatch."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [Analytics](https://nextjs.org/docs/app/guides/analytics) (`version: 16.3.4`, ⚠️ `lastUpdated: 2025-05-13`) and [Package bundling and optimization](https://nextjs.org/docs/app/guides/package-bundling) (`2026-06-01`).
> Target: **Next.js 16.3.4** · React **19.2.8**. Documentation-verified, **no sandbox run** — 🔴 **no millisecond figures, profiler output or before/after numbers appear on this page.** The thresholds for Core Web Vitals are defined by web.dev and are **not** stated in the Next.js documentation; [05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) owns them.

**A drag-and-drop board is an interaction-latency problem by construction, because the one thing the user does continuously is the one thing that re-renders a list. INP closes at the next frame the browser paints after an interaction — not when your Server Action resolves — so everything that matters happens between the pointer event and that frame, and everything that happens there is code you wrote. This act has a fixed order for a reason: collect the metric from real users first, because a drag feels fine on the machine that wrote it and INP is a field metric; then look for work proportional to the number of cards, because that is what a board has more of than your test fixture does. The seven candidate causes below are ordered by how often they are the answer on a board specifically.**

## Step one: collect INP, in the field, tagged by route

> *"Next.js has built-in support for measuring and reporting performance metrics."*

```tsx
// app/_components/web-vitals.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (metric.name !== 'INP') return

    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      // "id unique to current page load"
      id: metric.id,
      route: window.location.pathname,
    })
    const url = '/api/vitals'

    // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body)
    } else {
      fetch(url, { body, method: 'POST', keepalive: true })
    }
  })
  return null
}
```

Three details in that file are load-bearing.

**The `metric.name` switch is the whole point of the audit.** The guide states it plainly — *"You can handle all the results of these metrics using the `name` property"* — and an audit that ships all six metrics to one endpoint and then filters in a dashboard has made the noisiest possible version of a specific question.

**It must be its own component.** The documented reason is a bundling one and it belongs in this chapter:

> *"Since the `useReportWebVitals` hook requires the `'use client'` directive, the most performant approach is to create a separate component that the root layout imports. This confines the client boundary exclusively to the `WebVitals` component."*

Putting the hook in the layout itself makes the layout a Client Component, which drags its whole subtree across the boundary — undoing act one's work in a single line.

**`sendBeacon` before `fetch`.** Beacons survive page unload; a `fetch` issued as the user navigates away may be cancelled, and the interactions most worth measuring are often the last ones before someone leaves.

```tsx
// app/layout.tsx
import { WebVitals } from './_components/web-vitals'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

⚠️ **The analytics guide is the oldest page in this chapter's sources** (`lastUpdated: 2025-05-13`) and its metric list still includes **FID**, which the web-vitals project retired in favour of INP. Read the list as historical; the hook and the `name` switch are current.

### Why field data, and not a lab run

INP is a field metric because it depends on what users actually do. A synthetic run gives you one scripted interaction on a fast machine with a warm cache and an empty board. Your board has a team's worth of cards in it, on a laptop with thirty tabs open, and the interaction that hurts is the twentieth drag of the session, not the first. Collect for a few days across real routes before changing anything — otherwise the audit's second act is a guess with a commit attached.

## What INP is measuring, precisely enough to optimise

INP is *interaction to next paint*. The clock starts at the input and stops at the next frame the browser paints. Two consequences follow, and both are counter-intuitive:

- **A slow Server Action does not necessarily hurt INP.** If the drop paints an optimistic state immediately and the mutation resolves later, the metric closed at that first paint. A slow mutation is a correctness and UX problem measured elsewhere.
- **Fast JavaScript can still produce a terrible INP.** If the work is fast but blocks the frame — a synchronous re-render of 400 cards — the paint is late, and the paint is what is measured.

So the target is not "make the handler fast". It is **make the frame after the interaction cheap**, which usually means doing less rendering rather than faster computing.

🔴 The numeric thresholds for INP are web.dev's, not Next.js's; the analytics guide lists the metric and does not define it. Do not present a threshold as framework documentation. [05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) is the page that handles thresholds and the other vitals.

## The seven candidates, in board order

### 1 · Every card subscribes to the whole store

The most common cause on a board, and the easiest to create. A card component reads the store without a selector, so every store write — and a drag writes on every pointer move — re-renders every subscribed card.

```tsx
// 🔴 before: the whole store object is the subscription
'use client'
import { useBoardStore } from '@/stores/board'

export function Card({ cardId }: { cardId: string }) {
  const store = useBoardStore()
  const isDragTarget = store.dragOverCardId === cardId
  return <li data-drag-target={isDragTarget}>{store.cards[cardId].title}</li>
}
```

```tsx
// ✅ after: two scalar selectors, so a re-render needs a value change
'use client'
import { useBoardStore } from '@/stores/board'

export function Card({ cardId }: { cardId: string }) {
  const title = useBoardStore((s) => s.cards[cardId].title)
  const isDragTarget = useBoardStore((s) => s.dragOverCardId === cardId)
  return <li data-drag-target={isDragTarget}>{title}</li>
}
```

The second selector is the important one. Returning `s.dragOverCardId` and comparing in the component means every card re-renders whenever *any* card becomes the target; returning the boolean means only the two cards whose boolean actually flipped re-render. It is the same information and a different number of renders, and it needs no custom equality function because a boolean compares by identity.

### 2 · The drag handler recomputes derived state per pointer event

Grouping, sorting and filtering the card list is `O(n log n)`, and a pointer move fires many times a second. If that computation is inside the move path, the cost of a drag is proportional to the board.

```tsx
// ✅ compute the ordering once when the drag starts, not per move
const orderedIds = useMemo(
  () => sortCards(cardIds, sortKey),
  [cardIds, sortKey]
)

function onDragOver(overId: string) {
  // Only the index changes during a drag. The ordering does not.
  setDragOverCardId(overId)
}
```

The general rule for a drag surface: **during a drag, exactly one thing is changing.** Any computation whose inputs did not change belongs outside the handler.

### 3 · The mutation is in the same synchronous path as the drop

The drop handler awaits the Server Action, so the paint waits for the network.

```tsx
// 🔴 before
async function onDrop(cardId: string, columnId: string) {
  await moveCard(cardId, columnId) // Server Action
  setColumns(await fetchColumns())
}
```

```tsx
// ✅ after: paint the optimistic state, reconcile afterwards
import { useOptimistic, startTransition } from 'react'

const [optimisticCards, applyOptimistic] = useOptimistic(cards, moveReducer)

function onDrop(cardId: string, columnId: string) {
  startTransition(async () => {
    applyOptimistic({ cardId, columnId })
    await moveCard(cardId, columnId)
  })
}
```

The optimistic state paints at the next frame; the action resolves whenever it resolves. Note what this does *not* fix: if `moveReducer` rebuilds the entire card array and every card re-renders, candidate 1 is still your problem and this change only moved it.

### 4 · A heavy subtree re-renders inside the interaction

If a card preview renders markdown or highlights code, every re-render of that card runs the parser. Act one removed the library from the client bundle by moving it to a Server Component — see [07](07-project-milestone-sprintdesk-performance-audit.md) — and that fix is also an INP fix, because server-rendered markup does not re-parse when React re-renders around it. If any client-side transformation of data into UI survives on the board, it is a candidate here.

### 5 · The board renders every card in every column

Style, layout and paint costs scale with node count regardless of how good your React is. A sprint board with a large backlog column can have more nodes on screen than any interaction budget tolerates.

Two fixes, in order of preference:

- **Fewer nodes per card.** A card that is a nested stack of nine wrapper elements with a badge component per label is eight elements more than the design needs. This is unglamorous and often sufficient.
- **Render only what is visible.** Windowing the long column so off-screen cards are not in the DOM. It costs real complexity — scroll restoration, keyboard focus, find-in-page all get harder — so it is a second resort, and its accessibility consequences are a chapter-12 problem, not a free win.

### 6 · Layout thrash in the move handler

Reading a geometry property after a style write forces the browser to recompute layout synchronously, and doing it per pointer move does it per frame or worse.

```tsx
// 🔴 read after write, inside the move handler
function onPointerMove(e: PointerEvent) {
  el.style.transform = `translateY(${e.clientY - startY}px)`
  const rect = el.getBoundingClientRect() // forces layout, every move
  maybeScroll(rect)
}
```

```tsx
// ✅ measure once at drag start; move with transform only
const startRect = useRef<DOMRect | null>(null)

function onPointerDown() {
  startRect.current = el.getBoundingClientRect()
}

function onPointerMove(e: PointerEvent) {
  el.style.transform = `translateY(${e.clientY - startY}px)`
}
```

Transforms are the cheap property to animate precisely because they do not require layout. Anything that reads geometry belongs at the start of the gesture or at its end.

### 7 · Work in the pointer event rather than in a frame

Pointer events can fire more often than the display refreshes, so a handler that does per-move work does it several times per painted frame — all of it discarded except the last.

```tsx
// ✅ coalesce to one update per frame
const pending = useRef<number | null>(null)
const latest = useRef({ x: 0, y: 0 })

function onPointerMove(e: PointerEvent) {
  latest.current = { x: e.clientX, y: e.clientY }
  pending.current ??= requestAnimationFrame(() => {
    pending.current = null
    applyDragPosition(latest.current)
  })
}
```

This is the fix that looks like a micro-optimisation and is not: it divides the work by however many events arrive per frame, and on a high-rate pointer device that is not a small number.

## Where React Compiler fits, and where it does not

Candidate 1 is a subscription problem, not a memoisation problem, so the compiler does not solve it: the component *is* re-rendering because its input genuinely changed. What the compiler does address is the cost of the re-render once it happens, by memoising derived values and child elements automatically. It is worth having on — see [02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md) — but enabling it is not a substitute for narrowing the subscription, and reaching for it first will produce a disappointing result that is easy to misread as "the compiler does not work".

## Act 2 acceptance checklist

- [ ] INP samples are arriving from real users, tagged with the route, and the board route can be looked at on its own.
- [ ] The `WebVitals` component is its own file with `'use client'`, imported by the root layout — the layout itself is still a Server Component.
- [ ] During a drag, only the cards whose own state changed re-render. Verifiable with React DevTools' "highlight updates when components render" option: cards elsewhere in the board should not flash.
- [ ] No sort, filter or group runs inside a pointer-move handler. This is a code-review criterion, checkable by reading the handler.
- [ ] The drop paints the optimistic state before the Server Action resolves — check by throttling the network and confirming the card moves immediately.
- [ ] No `getBoundingClientRect`, `offsetWidth` or `scrollHeight` read inside the move handler.
- [ ] After the fixes, the field INP for the board route is compared against the pre-change collection window. Same instrumentation, same route, different weeks.

## Gotchas

**★ Symptom: the drag is smooth in development and the field INP is bad.** Cause: your board has a handful of cards, real boards have hundreds, and every candidate on this page scales with card count. Fix: test with a fixture the size of your largest customer's board. There is no reason a seed script cannot create one, and every candidate above becomes obvious at that size.

**★ Symptom: adding `useReportWebVitals` to the root layout made the whole app a Client Component.** Cause: the hook requires `'use client'`, and putting it in the layout marks the layout. Fix: the documented pattern is a separate component that the root layout imports, which *"confines the client boundary exclusively to the `WebVitals` component"*. Confirm it in the bundle map from act one — this mistake is very visible there.

**★ Symptom: INP improved and users say the board feels the same or worse.** Cause: the optimistic paint was made fast, but the reconciliation now arrives late and visibly re-orders cards a second time. INP closed at the first paint and did not measure the second one. Fix: make the optimistic state match what the server will produce, so the reconciliation is a no-op visually. If it cannot match, that is a data-model problem, and the metric will not tell you about it.

**★ Symptom: you memoised the card component and nothing changed.** Cause: it re-renders because its subscription genuinely changed value, not because its props are unstable — a component subscribed to the whole store has a new input on every store write. Fix: narrow the selector to a scalar, as in candidate 1. Memoisation only helps when the inputs are stable and the render is expensive; here the inputs are unstable by construction.

**★ Symptom: only one specific column is slow.** Cause: that column has the most cards, and the cost is per node rather than per column. Fix: attack node count — first by simplifying the card, then, if it must be, by windowing. The uneven symptom is itself the diagnosis: a per-card cost produces a per-column difference.

**★ Symptom: INP is fine on the board and terrible on the card modal.** Cause: something in the modal does client-side transformation of data into UI on every render, which is the same class of problem act one removed from the bundle. Fix: check whether the modal reintroduced a client-side markdown or highlighting path; the treemap will tell you, and the fix is the Server Component move from [07](07-project-milestone-sprintdesk-performance-audit.md).

**Symptom: the INP number arrives with no route attached and every page is averaged together.** Cause: the beacon body carried only the metric object. Fix: add the pathname at send time, as in the component above. Without it the metric tells you the application has a problem and nothing about where, which for an audit is the same as no data.

**Symptom: vitals stop arriving for users who navigate away quickly.** Cause: a plain `fetch` was cancelled at unload. Fix: `navigator.sendBeacon` with the `fetch` and `keepalive: true` fallback, which is the shape the analytics guide itself uses.

**Symptom: `requestAnimationFrame` coalescing made the drag feel laggy.** Cause: the visual drag feedback — the element following the pointer — was moved into the coalesced update along with the expensive work. Fix: keep the transform update on the pointer event, where it is one cheap style write, and coalesce only the expensive derived work such as computing the drop target.

**Symptom: the board re-renders on every keystroke in the filter box.** Cause: filters live in the URL, and typing is pushing a navigation per character. Fix: this is a real trade-off rather than a bug — URL filters are worth keeping — so debounce the URL write and keep the input's own value in local state, so the character appears immediately and the navigation follows.

## Interview questions

**★ Why is INP measured in the field rather than in a lab, and what does that mean for an audit?**
Because it depends on interactions that only real users perform, on data volumes and devices you do not control. A lab run measures one scripted interaction on an empty board on a fast machine — precisely the conditions under which every candidate cause on this page is invisible, since they all scale with card count. For an audit, that means the first deliverable is a collection window, not a fix: `useReportWebVitals` filtered to `INP` and tagged by route, running for long enough to produce a distribution. Only then is there something a change can be compared against.

**★ A drop handler awaits a Server Action. Does that hurt INP?**
Only if the paint waits for it. INP closes at the next paint after the interaction, so if the handler paints an optimistic state and lets the mutation resolve afterwards, the metric is already closed and the mutation's latency is a different problem. If the handler awaits the action before updating anything visible, the paint is behind the network and INP measures your server round trip. This is the distinction that makes optimistic updates a performance technique and not only a UX one — and it is also why a good INP number is not evidence that the mutation is fast.

**★ Cards re-render on every pointer move during a drag. What is the fix, and why is memoisation not it?**
Narrow what each card is subscribed to, so that only the cards whose own value changed re-render. Returning `dragOverCardId` from the store and comparing inside the component means every card sees a new value each time the target changes; returning the boolean `dragOverCardId === cardId` means only the two cards whose boolean flipped have a changed input. Memoisation cannot help here because the component's input really did change — memoisation prevents re-renders caused by unstable references, not ones caused by genuinely new data. React Compiler is the same story: it makes each render cheaper, it does not make an unnecessary render stop happening.

**★ You are told to fix the board's interaction latency and given no measurements. What do you do first, and what do you refuse to do?**
Instrument first: ship the `WebVitals` component filtered to INP with the route attached, and wait for data. What I would refuse to do is optimise from intuition, because a board has at least seven plausible causes and they have different fixes — a subscription problem and a node-count problem look identical from the outside and share no solution. The one thing worth doing before the data arrives is building a realistically-sized fixture, because most of these causes are invisible on a small board and obvious on a large one, and that costs an afternoon rather than a release cycle.

**★ Why does `useReportWebVitals` need to live in its own component?**
Because the hook requires the `'use client'` directive, and directives apply to a module and everything it pulls in. Putting the hook directly in the root layout makes the root layout a Client Component, which pushes the whole tree it renders across the boundary and undoes exactly the bundle work act one did. The documentation calls a separate component *"the most performant approach"* and says it confines the client boundary exclusively to that component. It is a one-line mistake with an application-wide consequence, and the bundle map from act one is where you would notice it.

**Why is windowing the long column the last resort rather than the first fix?**
Because it trades a measurable win for a set of hard problems: scroll position restoration, find-in-page no longer finding off-screen cards, keyboard navigation into elements that do not exist, and screen readers being told the list is shorter than it is. Reducing the DOM per card gets a large fraction of the same benefit with none of that, and narrowing the subscriptions gets a different large fraction. Windowing is correct when a column genuinely holds more cards than a browser can lay out at any framerate — but by then you have already done the other two, and you know how much they bought.

**What would make you conclude the board's INP problem is *not* in your React code at all?**
If the interaction re-renders almost nothing and the paint is still late. That points at style and layout cost — a huge node count, an expensive selector in CSS, a filter or backdrop effect on every card — or at layout thrash from a geometry read in the move handler, which is JavaScript but is not React. The distinguishing check is cheap: with DevTools set to highlight renders, a React problem lights up the board and a style problem does not.

**The analytics guide still lists FID, which the web-vitals project retired in favour of INP. How do you treat a stale list in official documentation?**
By separating the API from the catalogue. The hook, the `name` switch and the beacon pattern are the page's API surface and they are current — nothing about `useReportWebVitals` changed when FID was retired. The list of metric names is data, and data ages: that page's `lastUpdated` is from May 2025, so a metric being present in the list is evidence the list is old rather than evidence the metric is worth collecting. The general rule is to check the freshness stamp on a documentation page before treating an enumeration as complete or current, and to source metric definitions from the body that owns them, which for Core Web Vitals is web.dev and not Next.js.

---

← [07 · Milestone: performance audit](07-project-milestone-sprintdesk-performance-audit.md) · [Chapter 11 overview](01-explanation.md) · Next → [07c · Instrumenting what you changed](07c-instrumenting-what-you-changed.md)
