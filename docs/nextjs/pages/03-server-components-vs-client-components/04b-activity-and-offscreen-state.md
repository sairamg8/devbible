---
title: "Conditional rendering does not hide a subtree, it destroys one — and in the App Router what it destroys includes server-rendered output you paid a request to produce, which is the gap Activity closes"
sidebar_label: "04b · Activity and offscreen state"
sidebar_position: 5
description: "React 19.2's Activity: what hidden actually does to state, DOM and Effects, the pre-rendering behaviour, selective hydration, and the consequences of display:none that the React docs do not spell out."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the React reference — [`<Activity>`](https://react.dev/reference/react/Activity) and the [React 19.2 release post](https://react.dev/blog/2025/10/01/react-19-2) (published October 1st 2025). **Export surface probed** on the installed package: `react` **19.2.8** (`Object.keys(require('react'))`), matching the corpus pin. Boundary rules from [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (`version: 16.3.4`), quoted in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md).
> Target: **React 19.2.8 · Next.js 16.3.4**, App Router. Documentation-verified and export-probed; **no sandbox run**; **no benchmarks run**. Consequences of `display: none` are marked where they are derived from CSS/HTML semantics rather than stated by React.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**`{isOpen && <Panel />}` is the most-written line in React and almost nobody reads it as what it is: an instruction to unmount a subtree, throw away its state, tear down its Effects and delete its DOM. That is usually fine and occasionally catastrophic — a half-filled form, a loaded table, an established subscription. `<Activity>` is React 19.2's answer: a boundary that hides a subtree while keeping it mounted, keeping its state, keeping its DOM, and destroying only its Effects. In the App Router the stakes are higher than in a client-only app, because a subtree passed as `children` from a Server Component is server-rendered output that cost a request to produce, and conditional rendering throws that away as readily as it throws away a checkbox.**

## 🔴 Stability, checked rather than assumed

| Check | Result |
|---|---|
| **T1 · export probe** — `Object.keys(require('react'))` on `react` **19.2.8** | `Activity` is exported under that exact name. **No `unstable_` prefix.** |
| **T2 · reference page** — [react.dev/reference/react/Activity](https://react.dev/reference/react/Activity) | No experimental, canary or under-construction banner. |
| **T2 · release notes** — the 19.2 post | Listed under *"New React Features"*: *"In React 19.2, Activity supports two modes: `visible` and `hidden`."* |

**Stable in React 19.2, under its final name, with two modes.** The wording *"In React 19.2, Activity supports two modes"* is worth noticing — it implies further modes later, so treat the two-mode surface as current rather than final.

⚠️ **`ViewTransition` is a different story.** It appears in the `<Activity>` caveats but is **not** exported by stable `react` 19.2.8 — the probe shows it absent. So the enter/exit animation caveat below describes an interaction you cannot reach on the stable channel with these two packages alone. Whether the React canary that the App Router builds in exposes it is not something the Next.js documentation states, and I did not confirm it.

## The API

```tsx
<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <Page />
</Activity>
```

Two props, and that is the whole surface:

- **`children`** — *"The UI you intend to show and hide."*
- **`mode`** — *"A string value of either `'visible'` or `'hidden'`. If omitted, defaults to `'visible'`."*

The release post gives the before/after directly:

```js
// Before
{isVisible && <Page />}

// After
<Activity mode={isVisible ? 'visible' : 'hidden'}>
  <Page />
</Activity>
```

## What `hidden` actually does — the four behaviours

This is the part to get exactly right, because three of the four match intuition and the fourth does not.

| | Conditional rendering | `<Activity mode="hidden">` |
|---|---|---|
| Component state | destroyed | **saved** |
| DOM | removed | **preserved**, via `display: none` |
| Effects | cleaned up | **cleaned up** |
| Updates while hidden | n/a — not rendered | **still re-renders**, at lower priority |

Quoted:

> *"React will "save" the state for later."*

> *"The children's DOM is preserved when hidden using `display: "none"` CSS property."*

> *"React will destroy their Effects, cleaning up any active subscriptions."*

> *"While hidden, children still re-render in response to new props, albeit at a lower priority than the rest of the content."*

The release post says the same about `hidden` in one line: *"hides the children, unmounts effects, and defers all updates until React has nothing left to work on."*

🔴 **State is preserved and Effects are not, and that asymmetry is the whole design.** A hidden tab keeps its scroll-independent UI state — form values, selected rows, expanded sections — while its subscription, interval, event listener and observer are all torn down. So a hidden panel stops costing you a WebSocket and stops costing you polls, and still remembers what the user typed. It also means **anything an Effect populated is now stale**, and will be refetched when the panel becomes visible again, because showing re-mounts the Effects.

## Pre-rendering: the behaviour nobody expects

An `<Activity>` that is hidden on its *first* render does not skip rendering:

> *"When an Activity boundary is hidden during its initial render, its children won't be visible on the page — but they will still be rendered, albeit at a lower priority than the visible content, and without mounting their Effects. This pre-rendering allows the children to load any code or data they need ahead of time."*

That is a feature and a bill. The feature: a tab the user has not opened yet can have its lazy chunk fetched and its Suspense-driven data resolved before they click, so opening it is instant. The bill: **hiding something is not the same as not doing it.** Ten hidden activities are ten subtrees React renders, at low priority, whose DOM exists and whose memory is retained. The reference does not quantify that cost, and neither will this page.

## Selective hydration

> *"Activity boundaries naturally divide your component tree into independent units, allowing them to participate in Selective Hydration. React can hydrate the app's server-rendered HTML in chunks, enabling parts of your app to become interactive as fast as possible."*

For a Next.js page this is the sentence with the most direct performance consequence, and it connects straight to [06](06-bundle-size-implications-and-core-web-vitals-impact.md): hydration is main-thread work, main-thread work is what INP is made of, and an `<Activity>` boundary lets React break one long hydration into units it can interleave.

## Why this belongs on a Server-versus-Client-Components page

Because of what `children` means here. Per the module-graph rule in [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md), a Client Component can receive a **Server Component subtree as `children`** — it arrives as already-rendered output rather than as an import. A tab strip built with conditional rendering throws that output away every time the user switches tabs:

```tsx
'use client'
import { useState } from 'react'

export function Tabs({ overview, activity }: { overview: React.ReactNode; activity: React.ReactNode }) {
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')
  return (
    <>
      <nav>
        <button onClick={() => setTab('overview')}>Overview</button>
        <button onClick={() => setTab('activity')}>Activity</button>
      </nav>
      {/* 🔴 switching away discards the server-rendered subtree and any client state inside it */}
      {tab === 'overview' ? overview : activity}
    </>
  )
}
```

```tsx
'use client'
import { Activity } from 'react'
import { useState } from 'react'

export function Tabs({ overview, activity }: { overview: React.ReactNode; activity: React.ReactNode }) {
  const [tab, setTab] = useState<'overview' | 'activity'>('overview')
  return (
    <>
      <nav>
        <button onClick={() => setTab('overview')}>Overview</button>
        <button onClick={() => setTab('activity')}>Activity</button>
      </nav>
      <Activity mode={tab === 'overview' ? 'visible' : 'hidden'}>{overview}</Activity>
      <Activity mode={tab === 'activity' ? 'visible' : 'hidden'}>{activity}</Activity>
    </>
  )
}
```

```tsx
// app/projects/[id]/page.tsx — a Server Component; both slots render on the server
import { Tabs } from './tabs'
import { Overview } from './overview'
import { ActivityLog } from './activity-log'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Tabs overview={<Overview projectId={id} />} activity={<ActivityLog projectId={id} />} />
}
```

`Overview` and `ActivityLog` are Server Components. They query the database directly, ship no JavaScript, and — with `<Activity>` — survive a tab switch instead of being discarded and re-created.

⚠️ **What I could not confirm:** whether `<Activity>` may be rendered *from* a Server Component, rather than from inside a Client Component as above. Neither the React reference nor the Next.js Server and Client Components documentation addresses it, and I found no statement either way. Use it inside a Client Component, which is unambiguously supported; do not assume the server case works because it looks like it should.

## The `display: none` consequences React does not list

The reference states the mechanism — *"preserved when hidden using `display: "none"` CSS property"* — and stops there. **The following follow from CSS and HTML semantics, not from the React documentation**, and each of them has bitten someone:

- **Layout measurement returns zeros.** An element with `display: none` generates no box, so `getBoundingClientRect()`, `offsetWidth` and `offsetHeight` are all `0`. Chart libraries that size themselves on mount will size to nothing.
- **`IntersectionObserver` never fires.** No box means no intersection, so a hidden lazy-loader or infinite scroll sentinel simply never triggers.
- **It is out of the accessibility tree and unfocusable.** `display: none` content is not announced by screen readers and cannot receive focus — which is correct for a hidden tab, and wrong if you were using `<Activity>` for something a user is meant to reach by keyboard.
- 🔴 **Form controls inside it are still submitted.** A control is excluded from a form's data set when it is *disabled* or has no `name` — not when it is invisible. A hidden `<Activity>` containing a form field posts that field's value.
- **Scroll position is not documented as preserved, and should not be assumed.** React documents preservation of *state* and of the *DOM*. A scroll offset is neither: it is layout state attached to a box, and `display: none` destroys the box. If restoring scroll position on re-show matters to you, capture it yourself and verify the behaviour in your target browsers rather than trusting that "the DOM is preserved" covers it.

**The text-only case is documented, and it is genuinely surprising:**

> *"A hidden Activity that just renders text will not render anything rather than rendering hidden text, because there's no corresponding DOM element to apply visibility changes to."*

So `<Activity mode="hidden"><ComponentThatJustReturnsText /></Activity>` produces no DOM output at all. If you were relying on the node being present, wrap the text in an element.

## Gotchas

**★ Symptom: switching to a hidden tab and back shows old data.** Cause: hiding destroys Effects, so the subscription or interval that kept the panel fresh was cleaned up — while the state it had already produced was preserved. You are looking at retained state with no live feed behind it. Fix: this is usually what you want, but if freshness matters on re-show, key the refetch off visibility rather than off mount, or accept the flash and show a staleness indicator.

```tsx
// the Effect re-mounts on show, so a fetch inside it re-runs — design for that,
// rather than assuming the panel stayed subscribed while hidden
```

**★ Symptom: a chart inside a hidden `<Activity>` renders at zero size when revealed.** Cause: the library measured its container during the pre-render pass, when `display: none` meant `getBoundingClientRect()` returned zeros. Fix: measure on visibility rather than on mount — a `ResizeObserver`, or a remount keyed on the visible state.

```tsx
<Activity mode={active ? 'visible' : 'hidden'}>
  <Chart key={active ? 'on' : 'off'} data={data} />
</Activity>
```

**★ Symptom: a hidden panel's form fields end up in the submitted payload.** Cause: `display: none` is a CSS concern and form submission is not — only `disabled` controls and controls without a `name` are excluded from the data set. Fix: disable the fields when the section is hidden, or keep each section in its own `<form>`.

```tsx
<Activity mode={step === 2 ? 'visible' : 'hidden'}>
  <fieldset disabled={step !== 2}><AddressFields /></fieldset>
</Activity>
```

**★ Symptom: replacing `{cond && <X/>}` with `<Activity>` made the initial page slower.** Cause: hidden-on-first-render children are still rendered, at lower priority — that is the documented pre-rendering behaviour. You converted "not doing the work" into "doing the work later, but still doing it". Fix: use `<Activity>` where re-entry is likely and state loss is expensive; keep conditional rendering for the branch a user will probably never open.

**★ Symptom: an `IntersectionObserver`-driven lazy load inside a hidden `<Activity>` never fires.** Cause: `display: none` produces no box, so nothing ever intersects. Fix: do not rely on intersection inside a hidden boundary; trigger the load from the visibility change itself.

**★ Symptom: a hidden `<Activity>` renders nothing at all in the DOM and a selector fails.** Cause: the documented text-only caveat — a component that returns bare text has no element on which to set `display: none`, so React renders nothing rather than hidden text. Fix: wrap the text in an element.

```tsx
// ❌ <Activity mode="hidden"><Greeting /></Activity>   // Greeting returns "Hello"
// ✅ <Activity mode="hidden"><span><Greeting /></span></Activity>
```

**★ Symptom: analytics reports a component unmounting every time a tab is switched, but the state is clearly still there.** Cause: Effect cleanup runs on hide even though the component stays mounted, so an "unmount" event emitted from a cleanup function fires on every hide. Fix: stop treating cleanup as unmount — emit visibility events from the mode change, and reserve cleanup for releasing resources.

**★ Symptom: memory grows as the user explores more tabs.** Cause: every `<Activity>` the user has visited stays mounted with its state and DOM retained, by design, and nothing evicts them. The reference does not quantify the cost and there is no built-in limit. Fix: bound what you keep alive — render only a window of recently-used activities and fall back to conditional rendering for the rest.

**Symptom: a keyboard user cannot reach content inside a hidden `<Activity>`.** Cause: `display: none` removes content from the accessibility tree and from the focus order. Fix: correct behaviour for a hidden tab; if you needed the content reachable, `<Activity>` is the wrong primitive — it is for *offscreen*, not for *visually de-emphasised*.

**Symptom: the enter/exit animation described in the caveats does not happen.** Cause: that caveat is about an `<Activity>` inside a `ViewTransition`, and `ViewTransition` is not exported by stable `react` 19.2.8. Fix: check the export before writing code against a caveat — the caveat documents an interaction, not a promise that both halves are on your channel.

**Symptom: `<Activity>` used from a Server Component behaves unexpectedly.** Cause: unknown — neither the React reference nor the Next.js docs address rendering it from the server graph, and this page does not claim to know. Fix: put it inside a Client Component, which is the documented usage, and treat the server case as unverified until a primary source says otherwise.

**Symptom: `mode` was omitted and the subtree is visible when it should be hidden.** Cause: `mode` defaults to `'visible'` when omitted. Fix: always pass it explicitly — an `<Activity>` with no `mode` is a `<Fragment>` with extra steps.

## Interview questions

**★ What is the difference between hiding a subtree with `<Activity>` and not rendering it?**
Not rendering it unmounts everything: state is destroyed, Effects are cleaned up, the DOM is removed. `<Activity mode="hidden">` keeps the component mounted — the state is saved, the DOM is preserved with `display: none`, and updates still flow to it at lower priority — while cleaning up the Effects, so live subscriptions and intervals stop. The asymmetry is the design: you keep the cheap thing to keep, which is state, and drop the expensive thing to keep, which is an open connection. And there is a cost you accept in exchange: a hidden boundary is still rendered and still occupies memory.

**★ What happens on the very first render if an `<Activity>` starts out hidden?**
It renders anyway. The reference calls this pre-rendering: the children are rendered at lower priority, without their Effects mounting, specifically so that any lazy code chunk or Suspense-driven data they need is fetched ahead of time and opening the panel is instant. This is the behaviour people are least prepared for, because it means `<Activity mode="hidden">` is not a way to avoid work — it is a way to reschedule it. Replacing conditional rendering with `<Activity>` across a page can therefore make the first load slower even though every interaction after it is faster.

**★ Why does `<Activity>` belong in a discussion of Server and Client Components at all?**
Because of what conditional rendering discards in an App Router page. A Client Component can receive a Server Component subtree as `children` — the server renders it and passes the output across the boundary, so it costs a database query and a render on the server. `{tab === 'a' ? panelA : panelB}` throws one of those away every time the user switches, and the framework has to produce it again. Wrapping each slot in an `<Activity>` keeps both server-rendered subtrees alive across switches. Conditional rendering is cheap when the thing being conditioned is a `<div>`; it is not cheap when it is server-rendered output.

**★ You replaced a modal's conditional rendering with `<Activity>` and a screen reader user reports the content is unreachable. Is that a bug?**
No, that is what hidden means. React hides with `display: none`, which removes content from the accessibility tree and from the focus order, so it is correctly unreachable while hidden. The bug is upstream, in the choice of primitive: `<Activity>` is for content that is genuinely offscreen and will return, not for content that should be present but visually de-emphasised. If the requirement is "rendered but not shown yet, and reachable", that is a different mechanism entirely.

**★ How would you verify `<Activity>` is stable rather than trusting a release post?**
Probe the installed package's exports and check the name has no `unstable_` or `experimental_` prefix; on `react` 19.2.8 it is exported as plain `Activity`. Then check the reference page for a channel banner and the release notes for which section lists it. The value of doing all three shows up on the neighbouring API: `ViewTransition` is referenced in `<Activity>`'s own caveats, but the probe shows it is not exported from stable 19.2.8 at all — so a caveat you read on a stable page can describe an interaction you have no way to reach. The export list is the cheapest of the three checks and it is the one that catches this.

**What is preserved and what is not, precisely, when a boundary is hidden?**
Preserved: component state, and the DOM, via `display: none`. Not preserved: Effects, which are destroyed with their cleanup functions run, so subscriptions, intervals, listeners and observers all go. Explicitly undocumented: scroll offsets — the reference says the DOM is preserved, but a scroll position is layout state attached to a box and `display: none` destroys the box, so it should not be assumed and is worth capturing yourself if it matters. That last one is the kind of gap where "the DOM is preserved" gets over-read into a guarantee it does not make.

**A hidden panel contains a half-completed multi-step form. What do you have to be careful about?**
Two things, in opposite directions. First, the state survives, which is the reason you reached for `<Activity>` — the user's typing is still there when they come back. Second, and less obviously, so do the form controls: a `display: none` field is still part of the form and is still submitted, because only `disabled` and unnamed controls are excluded from the data set. So a wizard that hides completed or future steps will post their fields unless you disable them. Wrapping each hidden step's inputs in a `disabled` fieldset is the smallest fix.

**When would you deliberately stay with `{cond && <X />}`?**
When re-entry is unlikely and the state is cheap. `<Activity>` trades memory and pre-render work for instant re-entry with preserved state, and that trade is only worth it if the user actually returns. A destructive-confirmation dialog opened once per session, an error branch, a route the user reaches and leaves — these should unmount. The useful heuristic is whether losing the subtree would annoy the user: a half-filled form, a loaded table with a chosen sort, an expanded tree. If nothing would be lost, unmounting is strictly cheaper.

**How does `<Activity>` interact with hydration?**
It gives React more places to cut. The reference says Activity boundaries *"naturally divide your component tree into independent units, allowing them to participate in Selective Hydration"*, so the server-rendered HTML can be hydrated in chunks and parts of the page become interactive sooner instead of waiting for one monolithic pass. Since hydration is main-thread work and long main-thread tasks are what degrade responsiveness, an `<Activity>` boundary is an INP lever as much as a state-preservation one — which is the thread [06](06-bundle-size-implications-and-core-web-vitals-impact.md) picks up.

---

← Prev [04 · `useEffectEvent`](04-react-192-primitives-useeffectevent-for-non-reactive-side-ef.md) · [Index](01-explanation.md) · Next → [05 · server-only / client-only](05-enforcing-boundaries-with-server-only-client-only-packages.md)
