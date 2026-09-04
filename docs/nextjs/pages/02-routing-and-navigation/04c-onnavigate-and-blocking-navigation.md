---
title: "onNavigate is not a rename of onClick — it is a hook into the router's own work, so it skips modifier-key clicks, external URLs and downloads, and that single fact decides where analytics and leave-guards belong"
sidebar_label: "04c · onNavigate vs onClick"
sidebar_position: 21
description: "The three documented cases where onNavigate and onClick diverge, why the divergence follows from onNavigate being scoped to router-owned navigations, and which of the two each common handler belongs on."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`) — the `onNavigate` prop and its "Good to know" comparison with `onClick`.
> Target: **Next.js 16.3.4** · `onNavigate` introduced in **v15.3.0**. Documentation-verified — **no sandbox run**.

**`onNavigate` looks like `onClick` with a better name, and it is not. It fires only when Next.js is actually going to perform a client-side, same-origin navigation — so a `Cmd`-click that opens a new tab, a link to another origin, and a link with the `download` attribute all run `onClick` and none of them run `onNavigate`. That single fact decides where two very common handlers belong: click analytics must live on `onClick`, because a `Cmd`-click is still a click your product wants to count, and an unsaved-changes prompt must live on `onNavigate`, because opening a background tab is not a departure. Swap them and you ship an undercount and a false prompt, neither of which will look like a routing bug.**

## The shape of the API

`onNavigate` receives an event object with `preventDefault()`, which is what makes it a decision point rather than a notification:

```tsx title="app/page.tsx"
import Link from 'next/link'

export default function Page() {
  return (
    <Link
      href="/dashboard"
      onNavigate={(e) => {
        // Only executes during SPA navigation
        console.log('Navigating...')

        // Optionally prevent navigation
        // e.preventDefault()
      }}
    >
      Dashboard
    </Link>
  )
}
```

The comment on the first line is the reference's own, and it is the whole API in four words: *only executes during SPA navigation*.

## The three documented divergences

> *"When using modifier keys (`Ctrl`/`Cmd` + Click), `onClick` executes but `onNavigate` doesn't since Next.js prevents default navigation for new tabs."*
> *"External URLs won't trigger `onNavigate` since it's only for client-side and same-origin navigations."*
> *"Links with the `download` attribute will work with `onClick` but not `onNavigate` since the browser will treat the linked URL as a download."*

| Situation | `onClick` | `onNavigate` |
| --- | --- | --- |
| Plain left-click on a same-origin route | runs | runs |
| `Ctrl` / `Cmd` + click (new tab) | runs | **does not run** |
| Link to another origin | runs | **does not run** |
| Link carrying `download` | runs | **does not run** |

There is one rule behind all three rows, and it is worth extracting because it predicts cases the table does not list: **`onNavigate` is a hook into *the router's* work.** If the router is not the thing doing the navigation — because the browser is opening a new tab, or leaving your origin, or saving a file — then there is no client-side transition to hook into, and the handler does not run.

That also tells you what `onNavigate` will never see, without needing a fourth bullet in the docs: browser Back and Forward, a typed URL, a bookmark, a tab close, a plain `<a href>` in your own markup, and your own `router.push` calls. None of those pass through a `<Link>`.

## Which handler takes which job

```tsx title="app/ui/tracked-link.tsx"
'use client'

import Link from 'next/link'
import { track } from '@/lib/analytics'

export function TrackedLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      // fires for every click, including Cmd-click into a new tab
      onClick={() => track('nav_click', { to: href })}
      // fires only when this tab is actually leaving the current route
      onNavigate={(e) => {
        if (!confirmLeave()) e.preventDefault()
      }}
    >
      {children}
    </Link>
  )
}
```

A useful way to hold the distinction: **`onClick` answers *"did the user express interest in this destination?"* and `onNavigate` answers *"is this tab about to stop showing the current page?"*** Almost every handler you want to write is clearly one or the other once phrased that way.

| Handler you want to write | Belongs on |
| --- | --- |
| Click / interest analytics | `onClick` |
| Closing a dropdown or mobile nav drawer | `onClick` |
| Ripple or press animation | `onClick` |
| Recording a download request | `onClick` — the only one that fires |
| Unsaved-changes confirmation | `onNavigate` |
| Flushing an autosave before the route changes | `onNavigate` |
| Cancelling a navigation on a validation failure | `onNavigate` — it is the one with `preventDefault()` |

The full leave-guard, its Context plumbing, and the departures it cannot cover are in [04d · Blocking navigation](04d-blocking-navigation-and-what-it-cannot-see.md).

## Gotchas

**★ Symptom: your click analytics under-counts by exactly the users who open links in new tabs.** Cause: the handler is on `onNavigate`, which the reference states does not run for `Ctrl`/`Cmd`-click, external URLs or `download` links. Fix: analytics goes on `onClick`; only the leave-guard goes on `onNavigate`.

```tsx
<Link
  href="/pricing"
  onClick={() => track('nav_click', { to: '/pricing' })}   // every click
  onNavigate={(e) => { if (isDirty) e.preventDefault() }}  // client-side navs only
>
  Pricing
</Link>
```

**★ Symptom: your unsaved-changes prompt fires when the user `Cmd`-clicks a link to read something in a background tab.** Cause: the guard is on `onClick`, which runs for modifier-key clicks. Fix: move it to `onNavigate`, which by design does not run when Next.js hands the click to the browser for a new tab.

```tsx
// 🚩 prompts a user who is not leaving
<Link href="/docs" onClick={(e) => { if (isDirty && !confirm('Leave?')) e.preventDefault() }}>

// ✅ only when this tab is actually navigating
<Link href="/docs" onNavigate={(e) => { if (isDirty && !confirm('Leave?')) e.preventDefault() }}>
```

**★ Symptom: an `onNavigate` handler on a download link never runs, so a "file requested" event is never recorded.** Cause: the browser treats a `download` link as a download rather than a navigation, and the reference says so explicitly. Fix: record it on `onClick`, which is the only one of the two that fires.

```tsx
<Link
  href="/exports/report.csv"
  download
  onClick={() => track('export_downloaded', { file: 'report.csv' })}
>
  Download CSV
</Link>
```

**Symptom: a dropdown menu stays open when the user `Cmd`-clicks an item.** Cause: the close handler is on `onNavigate`, so it does not run for a new-tab click and the menu is left open over the unchanged page. Fix: closing UI is presentation, not navigation — put it on `onClick`.

**Symptom: `onNavigate` never runs on links your CMS renders.** Cause: those are plain `<a href>` strings in HTML, not `<Link>` components, so there is no prop to fire. Fix: post-process the rendered content into `<Link>` elements, or accept full document loads for CMS links and guard departures with `beforeunload` instead.

**Symptom: `window.confirm` inside `onNavigate` blocks the whole tab and reads as a hang in automated tests.** Cause: `confirm` is synchronous and modal. Fix: for production UI, `preventDefault()` unconditionally, render your own dialog, and navigate with the router once the user chooses — the documented `confirm` version is a minimal illustration, not a design recommendation.

```tsx
onNavigate={(e) => {
  if (!isBlocked) return
  e.preventDefault()
  openLeaveDialog(href) // resolve later with router.push(href)
}}
```

## Interview questions

**★ What is the difference between `onClick` and `onNavigate` on a `<Link>`, and which one takes analytics?**
`onClick` fires for every click event. `onNavigate` fires only for client-side, same-origin navigations, and it receives an event with `preventDefault()`. The reference names three cases where they diverge: modifier-key clicks run `onClick` but not `onNavigate`, external URLs never trigger `onNavigate`, and `download` links run `onClick` only. Analytics goes on `onClick`, because a `Cmd`-click is still a click your product wants to count. Navigation blocking goes on `onNavigate`, because a `Cmd`-click is not a departure.

**★ There is one rule behind all three divergences. What is it, and what else does it predict?**
That `onNavigate` is scoped to navigations *the router performs*. Every case where it does not fire is a case where the browser, not Next.js, is doing the work: opening a new tab, leaving the origin, saving a file. From that rule you can derive what the docs do not list — Back and Forward, a typed URL, a bookmark, a tab close, a plain `<a href>`, and your own `router.push` calls all bypass `onNavigate` too, because none of them go through a `<Link>` the router owns.

**★ A colleague proposes putting the leave-guard on `onClick` "so it also catches new-tab clicks". What do you say?**
That catching new-tab clicks is the bug, not the feature. A `Cmd`-click opens the destination in a second tab and leaves the current one — with the unsaved form — exactly where it was. Prompting there asks the user to confirm leaving a page they are not leaving, and if they decline, `preventDefault` on `onClick` cancels a navigation that was going to happen somewhere else entirely.

**Why does `onNavigate` receiving `preventDefault()` matter more than the name suggests?**
Because it makes the handler part of the navigation decision rather than a notification about it. `onClick` on an anchor can technically `preventDefault` too, but it fires in cases where the router is not the one navigating, so cancelling there produces inconsistent behaviour across modifier keys and download links. `onNavigate` is scoped to exactly the navigations the router owns, which is exactly the set a client-side guard can meaningfully veto.

**You need to record downloads and block departures on the same set of links. How do you wire it?**
Two handlers on the same `<Link>`, doing different jobs. `onClick` records the intent — it is the only one that fires for a `download` link at all. `onNavigate` holds the guard, and on a download link it correctly never runs, because downloading a file does not take the user off the page there is unsaved work on. The two handlers do not need to know about each other.

---

← [04b · Scroll on navigation](04b-scroll-behaviour-and-the-navigation-lifecycle.md) · [Chapter 2 overview](01-explanation.md) · Next → [04d · Blocking navigation](04d-blocking-navigation-and-what-it-cannot-see.md)
