---
title: "router.prefetch warms a route no visible Link covers, onInvalidate fires at most once so a warm route needs re-arming, and every step further from Link buys you the maintenance of prefetching, cache invalidation and accessibility"
sidebar_label: "04f · Prefetching by hand"
sidebar_position: 24
description: "router.prefetch and its once-per-request onInvalidate callback, the hover-triggered prefetch pattern, extending versus ejecting from Link, and the concrete debt the docs say you take on when you do."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [Prefetching guide](https://nextjs.org/docs/app/guides/prefetching) (`lastUpdated: 2026-08-25`) — "Manual prefetch", "Hover-triggered prefetch", "Extending or ejecting link", "Disabled prefetch" — and [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`).
> Target: **Next.js 16.3.4** · `onInvalidate` on `router.prefetch` since **v15.4.0**. Documentation-verified — **no sandbox run**.

**There are three distances you can stand from `<Link>`, and the docs price each one. Calling `router.prefetch()` alongside a normal `<Link>` is free — you are adding a warm-up, not replacing anything. Wrapping `<Link>` to change *when* it prefetches costs you a small amount of prop discipline. Replacing `<Link>` with an `<a>` and `router.push` costs you prefetching, cache invalidation and accessibility, and the guide says so in those words. The subtle part in all three is `onInvalidate`: it fires *at most once per prefetch request*, so any code that wants a route to stay warm has to call `prefetch` again from inside the callback. Register it once and you have a single stale prefetch that looks like a working one.**

## Manual prefetch: the free tier

`router.prefetch(href)` warms a route the prefetch scheduler cannot see — one reached from a modal, a route your analytics says users hit next, or a destination behind a control that is not a link:

```tsx title="app/ui/pricing-card.tsx"
'use client'

import { useRouter } from 'next/navigation'
import { CustomLink } from '@components/link'

export function PricingCard() {
  const router = useRouter()

  return (
    <div onMouseEnter={() => router.prefetch('/pricing')}>
      {/* other UI elements */}
      <CustomLink href="/pricing">View Pricing</CustomLink>
    </div>
  )
}
```

> *"To prefetch manually, import the `useRouter` hook from `next/navigation`, then call `router.prefetch()` to warm routes outside the viewport or in response to analytics, hover, or scroll."*

Nothing here replaces `<Link>`. The link still renders an anchor, still gets picked up by the scheduler when it enters the viewport, and still handles the click. You have widened the hover target, which is a genuine improvement on a card where the clickable text is small.

## `onInvalidate` fires once

> *"`router.prefetch(href: string, options?: { onInvalidate?: () => void })`: Prefetch the provided route for faster client-side transitions. The optional `onInvalidate` callback is called when the prefetched data becomes stale."*

and the bound that decides how you use it:

> *"The `onInvalidate` callback is called at most once per prefetch request. It signals when you may want to trigger a new prefetch for updated route data."*

**At most once, per request.** It is a one-shot signal, not a subscription. The documented self-renewing pattern re-arms from inside the callback:

```tsx title="app/ui/manual-prefetch-link.tsx"
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

function ManualPrefetchLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      if (!cancelled) router.prefetch(href, { onInvalidate: poll })
    }
    poll()
    return () => {
      cancelled = true
    }
  }, [href, router])

  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        router.push(href)
      }}
    >
      {children}
    </a>
  )
}
```

The `cancelled` flag matters as much as the recursion: without it, an unmounted component keeps re-prefetching a route nobody is going to visit, forever.

## Hover-triggered prefetch: the middle tier

The guide's own framing before it shows you the code:

> *"**Proceed with caution:** Extending `Link` opts you into maintaining prefetching, cache invalidation, and accessibility concerns. Do this only when the defaults are insufficient."*

```tsx title="app/ui/hover-prefetch-link.tsx"
'use client'

import Link from 'next/link'
import { useState } from 'react'

export function HoverPrefetchLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const [active, setActive] = useState(false)

  return (
    <Link
      href={href}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  )
}
```

The load-bearing detail is the value: `prefetch={active ? null : false}`, and the guide explains why it is `null` and not `true`:

> *"`prefetch={null}` restores default (static) prefetching once the user shows intent."*

`true` would force a *full* prefetch of a dynamic route, which is more work than the default. `null` restores the framework's own decision. Writing `true` here is the common misreading and it turns a resource-saving measure into a resource-spending one. The prop's three values and their interaction with the destination segment's own ceiling are in [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md).

The realistic use case is stated plainly: this *"targets only links the user is likely to visit"*, which matters on an infinite-scroll table or any list where the viewport contains dozens of links.

## Disabled prefetch, as a component

If the goal is simply "these links are not worth warming", wrap it rather than repeating the prop:

```tsx title="app/ui/no-prefetch-link.tsx"
'use client'

import Link, { LinkProps } from 'next/link'

function NoPrefetchLink({
  prefetch,
  ...rest
}: LinkProps & { children: React.ReactNode }) {
  return <Link {...rest} prefetch={false} />
}
```

> *"For example, you may still want to have consistent usage of `<Link>` in your application, but links in your footer might not need to be prefetched when entering the viewport."*

Note that this component destructures `prefetch` out of the props specifically so a caller cannot pass one — the opposite of the spread-ordering bug in [04d](04d-blocking-navigation-and-what-it-cannot-see.md), and a deliberate choice rather than an accident.

## Ejecting entirely: the expensive tier

> *"Alternatively, you can use `useRouter` to recreate some of the native `<Link>` behavior. However, be aware this opts you into maintaining prefetching and cache invalidation."*

and the trap that catches everyone who writes it from memory:

> *"An `a` tag triggers a full page navigation. Use `onClick` to prevent it, then call `router.push` to navigate on the client."*

So a hand-rolled link that omits `preventDefault()` is not a slightly-worse `<Link>`; it is a full document load with a redundant prefetch attached. The complete list of what you now own:

| Concern | `<Link>` does it | You do it |
| --- | --- | --- |
| Prefetch on viewport entry | yes | `router.prefetch` in an effect |
| Prefetch scheduling and priority queue | yes | no equivalent — you fire requests directly |
| Re-prefetch on invalidation | yes | re-arm `onInvalidate` yourself |
| Preventing the browser's full navigation | yes | `e.preventDefault()` on every click |
| Modifier-key clicks opening a new tab | yes | your `onClick` must not swallow them |
| `onNavigate` semantics and guards | yes | gone — see [04c](04c-onnavigate-and-blocking-navigation.md) |
| Managed scroll behaviour | yes | pass `{ scroll }` yourself — see [04b](04b-scroll-behaviour-and-the-navigation-lifecycle.md) |
| `useLinkStatus` pending state | yes | gone — see [13b](13b-prefetch-control-and-link-status.md) |

The guide's non-exhaustive middle path is worth knowing about before you write any of this: it names [ForesightJS](https://foresightjs.com/docs/integrations/nextjs) as an example of extending `<Link>` — *"which prefetches links by predicting the direction of the user's cursor"* — rather than replacing it.

## Gotchas

**★ Symptom: `router.prefetch` in a `useEffect` warms the route once and it goes stale.** Cause: `onInvalidate` *"is called at most once per prefetch request"* — it is a one-shot signal, not a subscription. Fix: re-arm inside the callback, with a cancellation flag so unmount stops the cycle.

```tsx
useEffect(() => {
  let cancelled = false
  const poll = () => { if (!cancelled) router.prefetch(href, { onInvalidate: poll }) }
  poll()
  return () => { cancelled = true }
}, [href, router])
```

**★ Symptom: a hand-rolled link component navigates but does a full page load.** Cause: an `<a href>` with no `onClick` interception — the browser navigates before the router sees anything, and the guide states it outright. Fix: `preventDefault()` then `router.push`. Better fix: use `<Link>` and stop maintaining this.

```tsx
<a href={href} onClick={(e) => { e.preventDefault(); router.push(href) }}>{children}</a>
```

**★ Symptom: a hover-prefetch link prefetches *more* than the default did.** Cause: the prop was written `prefetch={active ? true : false}`. `true` forces the *full* route to be prefetched for dynamic routes as well as static ones, so on hover you now pull more than the framework would have. Fix: `null`, which the guide describes as restoring default prefetching once the user shows intent.

```tsx
// 🚩 forces a full prefetch on hover
<Link href={href} prefetch={active ? true : false} onMouseEnter={() => setActive(true)} />

// ✅ restores the default once intent is shown
<Link href={href} prefetch={active ? null : false} onMouseEnter={() => setActive(true)} />
```

**★ Symptom: a hand-rolled link stops `Cmd`-click from opening a new tab.** Cause: the `onClick` calls `preventDefault()` unconditionally, including for modifier-key clicks that the browser was going to handle itself. Fix: let modified clicks through — or, again, use `<Link>`, which already does.

```tsx
<a
  href={href}
  onClick={(e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    router.push(href)
  }}
>
  {children}
</a>
```

**★ Symptom: unmounting a list of manual-prefetch rows keeps issuing prefetch requests.** Cause: the `onInvalidate` recursion has no cancellation, so each unmounted row's callback re-prefetches forever. Fix: the `cancelled` flag returned from the effect's cleanup — it is in the documented example for exactly this reason.

**Symptom: `router.prefetch` appears to do nothing while you are developing.** Cause: automatic prefetching runs only in production, and manual prefetching is subject to the same environment difference — see [05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md). Fix: verify against a production build before concluding the call is wrong.

**Symptom: a wrapper meant to disable prefetching still prefetches on some links.** Cause: `{...rest}` spread after `prefetch={false}` lets a caller's `prefetch` win. Fix: destructure `prefetch` out of the props so it cannot be passed through, which is precisely what the documented `NoPrefetchLink` does.

**Symptom: prefetching a route runs your analytics for users who never visit it.** Cause: an impure layout or page — the prefetch renders it on the server. Fix: move the side effect into a Client Component effect; the mechanism and the full before/after are in [05](05-prefetching-fundamentals-and-the-native-view-transitions-api.md).

## Interview questions

**★ What does `onInvalidate` guarantee, and what does that mean for the code you write around it?**
That it will be called *at most once per prefetch request*, when Next.js suspects the prefetched data has gone stale. It is a one-shot signal, not a subscription, so any pattern that wants to keep a route warm indefinitely must call `router.prefetch` again from inside the callback. Code that registers it once and assumes repeated notifications silently degrades into a single stale prefetch — which is worse than none, because the navigation still feels instant and then shows old data.

**★ Someone hand-rolls a link with `<a href>` plus `router.push` to get custom prefetching. What do you review for?**
Whether they added `preventDefault()` on the click — without it the browser navigates first and the whole exercise is a full page load. Then whether modifier-key clicks are let through, whether `onInvalidate` is re-armed, whether the effect cancels on unmount, and whether the element is still keyboard-focusable and announced as a link. The guide's warning is the review comment: extending `Link` opts you into maintaining prefetching, cache invalidation and accessibility yourself, so the bar is "the defaults were genuinely insufficient", not "this seemed neater".

**★ In the hover-prefetch pattern, why is the value `null` rather than `true`?**
Because `null` means "use the framework's default decision", while `true` forces a full prefetch of the whole route including dynamic ones. The pattern exists to *reduce* work on pages with many links, so forcing the heaviest prefetch mode the moment the cursor lands is the opposite of the goal. The guide states it directly: `prefetch={null}` restores default (static) prefetching once the user shows intent.

**When is `router.prefetch` the right call rather than a `<Link>` change?**
When the destination is not behind a link at all — a route reached from a modal or a wizard's next step — or when you want to widen the *trigger* without changing the link: hovering a whole card, scrolling past a threshold, or acting on an analytics prediction. In all of those the `<Link>` stays exactly as it is and you add a warm-up, which costs you nothing in maintenance.

**Why does the "disabled prefetch" wrapper destructure `prefetch` out of its props instead of just spreading?**
So a caller cannot override the one decision the component exists to make. It is the mirror image of a very common bug in wrapper components — spreading incoming props *after* your own handler or value, which lets a call site silently disable the wrapper's whole purpose. Destructuring the prop out makes the override impossible rather than merely unlikely.

---

← [04e · `useRouter`](04e-userouter-programmatic-navigation-and-refresh.md) · [Chapter 2 overview](01-explanation.md) · Next → [04g · `redirect` and `permanentRedirect`](04g-redirect-and-permanentredirect.md)
