---
title: "Three things start behaving differently the moment `cacheComponents` is on, and none of them are in your diff: client hooks suspend, `GET` handlers throw to bail out, and routes stop unmounting"
sidebar_label: "01d · What changes once the flag is on"
sidebar_position: 4
description: "The runtime behaviour changes that arrive with the flag rather than with a code edit — the four navigation hooks that now suspend, the GET Route Handler model and its thrown bail-out, and React Activity preserving component state across navigations."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (docs `lastUpdated` 2026-08-25) and [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (`lastUpdated` 2026-06-22).
> Target: **Next.js 16.3.4**, App Router, Node.js runtime. Documentation-verified; **no sandbox run**.

**[01c](01c-flipping-the-flag-on-an-existing-app.md) is what you delete. This page is what starts behaving differently on its own — three changes that arrive with the flag, appear in no diff, and are therefore the ones that get attributed to the wrong commit. A breadcrumb component you have not touched in a year begins failing the build. A `GET` Route Handler starts returning 500s because a `try/catch` you wrote for database errors is now catching the framework's control flow. And a form shows last week's success message because routes are no longer unmounted when you navigate away from them. Each has a documented cause and a documented fix; none of them is discoverable by reading your own changes.**

## The client hooks that now suspend

This one arrives without any code of yours changing, because the hooks are usually in a shared nav or breadcrumb:

> *"When the route's pathname is fully known, they resolve during prerendering and need no boundary. When it depends on dynamic params not yet known, they suspend, wherever the component sits. A nav or breadcrumb in a shared layout, for instance, suspends while Next.js generates the static shell for any route below it that has dynamic params. Wrap the component that reads the hook in `<Suspense>` ... or the build fails"*

Affected: `usePathname`, `useParams`, `useSelectedLayoutSegment`, `useSelectedLayoutSegments`. And separately, unconditionally: *"The `useSearchParams` hook always needs a `<Suspense>` boundary, since search params are only known at request time."*

The guidance is to push the read to the smallest leaf rather than wrapping the nav:

```tsx
// ❌ One breadcrumb reading usePathname suspends the whole shared layout for
// every dynamic route beneath it.
'use client'
export function Breadcrumbs() {
  const pathname = usePathname()
  return <nav>{/* … */}</nav>
}
```

```tsx
// ✅ Wrap only the component that reads it, so its siblings stay in the shell.
import { Suspense } from 'react'

export function LayoutChrome({ children }) {
  return (
    <>
      <Logo />
      <PrimaryNav />
      <Suspense fallback={<BreadcrumbsSkeleton />}>
        <Breadcrumbs />
      </Suspense>
      {children}
    </>
  )
}
```

## `GET` Route Handlers follow the page model now

> *"With Cache Components, `GET` handlers follow the same model as pages: they prerender when they don't access uncached or runtime data ... The directive can't be applied to the `GET` export itself, so the handler calls a cached helper."*

The directive restriction is the part that bites: you cannot put `'use cache'` at the top of `GET`. It must go on a helper the handler calls. The corpus's treatment of the previous model is at [ch4 · 01d](../04-data-fetching-in-the-app-router/01d-route-handlers-and-their-caching-model.md).

```ts
// app/api/teams/[team]/tasks/route.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params
  return Response.json(await getTasks(team))
}

async function getTasks(teamSlug: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`team-${teamSlug}-tasks`)
  return db.tasks.findByTeam(teamSlug)
}
```

🔴 **The bail-out is a thrown exception, and your existing `try/catch` will swallow it:**

> *"Reading uncached or runtime data in a `GET` handler bails out of prerendering by **throwing**. A `try/catch` you already have around other operations will catch that bail-out. If the `catch` block logs the error, it adds noise to the build output. Set `experimental.hideLogsAfterAbort: true` to hide logs emitted after a bail-out."*

A defensive `catch` that returns a 500 envelope will therefore convert a prerender bail-out into a served error response. If a handler starts returning 500s after the migration, look at the `catch` before looking at the data layer.

## Component state now survives navigation

The last change needs no migration work and breaks UI anyway, because it is a React-level behaviour switch:

> *"When `cacheComponents` is enabled, Next.js uses React's `<Activity>` component to preserve component state during client-side navigation."*

> *"Rather than unmounting the previous route when you navigate away, Next.js sets the Activity mode to `\"hidden\"`."*

> *"Effects clean up and re-run normally, but `useState` values, form inputs, and scroll position are no longer reset when navigating away and back."*

Three patterns the docs name explicitly as breaking, with their documented fixes:

| Pattern | What happens | Documented fix |
|---|---|---|
| Dropdowns and popovers | *"stay open when navigating back"* | *"Close them in a `useLayoutEffect` cleanup function."* |
| Dialogs with init logic | effects that depend on dialog state *"won't re-fire if the state was preserved"* | *"Derive dialog state from the URL instead."* |
| Forms after submission | inputs and `useActionState` results *"persist when returning"* | reset in the submit handler, else a cleanup effect |

```tsx
// A dropdown that used to be reset by unmounting. It is not unmounted any more.
'use client'
import { useLayoutEffect, useState } from 'react'

export function TeamSwitcher() {
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    // Runs when this route is hidden by <Activity>, not only on unmount.
    return () => setOpen(false)
  }, [])

  return <Dropdown open={open} onOpenChange={setOpen} />
}
```

⚠️ **How many routes stay resident is not specified.** The documentation says only that *"Next.js uses heuristics to keep a few recently visited routes `\"hidden\"`, while older routes are removed from the DOM to prevent excessive growth."* "A few" is the only quantity given — do not build anything that assumes a specific number of retained routes, and do not treat a hidden route as reliably still mounted.


## Gotchas

**★ Symptom: a `GET` Route Handler starts returning 500s after enabling the flag.** Cause: the prerender bail-out is thrown, and an existing `try/catch` caught it and converted it into your error envelope. Fix: let the bail-out propagate — narrow the `catch` to the errors you actually mean to handle.

```ts
// ❌ Catches the framework's prerender bail-out along with real failures.
export async function GET() {
  try {
    return Response.json(await getTasks())
  } catch (error) {
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
```

```ts
// ✅ Handle what you know; let everything else — including the bail-out — through.
import { DataAccessError } from '@/lib/errors'

export async function GET() {
  try {
    return Response.json(await getTasks())
  } catch (error) {
    if (error instanceof DataAccessError) {
      return Response.json({ error: error.code }, { status: 502 })
    }
    throw error
  }
}
```

**★ Symptom: a form shows last submission's success message when the user navigates back to it.** Cause: `<Activity>` preserves `useState` and `useActionState` across navigation instead of unmounting the route. Fix: reset in the submit handler where you can, or add a cleanup effect; do not rely on unmounting, because it no longer happens.


**★ Symptom: a breadcrumb or nav component you have not edited starts failing the build, and the error names a route you were not working on.** Cause: `usePathname`, `useParams`, `useSelectedLayoutSegment` and `useSelectedLayoutSegments` suspend when the pathname depends on dynamic params that are not yet known — and a component in a shared layout suspends for *every* dynamic route beneath it. The failure is attributed to the layout, but it is caused by the routes under it. Fix: wrap the smallest component that reads the hook, not the layout, so its siblings stay in the shell.

**★ Symptom: you wrap the whole shared layout in `<Suspense>` to clear the hook error and every navigation now flashes a full-page skeleton.** Cause: the boundary went too high. A boundary satisfies validation wherever you put it, but everything inside it drops out of the static shell. Fix: push the boundary down to the leaf that actually reads the hook — the fix that clears the error and the fix that keeps the page fast are the same move done at different depths.

```tsx
// ❌ Clears the build error. Also removes the logo and nav from the shell.
<Suspense fallback={<LayoutSkeleton />}>
  <LayoutChrome>{children}</LayoutChrome>
</Suspense>
```

```tsx
// ✅ Only the breadcrumb leaves the shell.
<LayoutChrome>
  <Suspense fallback={<BreadcrumbsSkeleton />}>
    <Breadcrumbs />
  </Suspense>
  {children}
</LayoutChrome>
```

**★ Symptom: `useSearchParams` needs a boundary on a page load but appears to work fine during client navigation, so the requirement looks inconsistent.** Cause: it is genuinely different in the two cases. On a server render search params are not known, so the hook suspends; on a client navigation the router already holds them from the URL and the hook resolves synchronously. The same component can render immediately one way and sit behind a fallback the other. Fix: the boundary is unconditional for this hook — write it once and stop reasoning about which navigation you are testing.

**★ Symptom: a modal reopens by itself when the user navigates back to a route.** Cause: the route was never unmounted, so the `useState` holding `open` still says `true`. Fix: derive the dialog's state from the URL, which is the documented remedy, rather than adding cleanup — a URL-derived dialog is correct under both the old unmounting behaviour and the new hidden-route one.

## Interview questions

**★ Why can't you put `'use cache'` on a `GET` Route Handler, and what breaks if you catch its errors?**
The directive cannot be applied to the `GET` export itself, so caching goes on a helper function the handler calls. The subtler issue is the failure mode: reading uncached or runtime data in a `GET` handler bails out of prerendering by *throwing*. That means a pre-existing `try/catch` wrapped around the handler's body will catch the framework's own control-flow exception. If the catch block returns an error response, you have converted a prerender bail-out into a served 500; if it logs, you get build-output noise, which is what `experimental.hideLogsAfterAbort` exists to suppress. The fix is to narrow the catch to errors you actually intend to handle and rethrow everything else.

**★ Why does a breadcrumb in a shared layout fail the build for routes it does not know about?**
Because the navigation hooks resolve at prerender time only when the pathname is fully known. `usePathname`, `useParams`, `useSelectedLayoutSegment` and `useSelectedLayoutSegments` suspend whenever the path depends on dynamic params that have not been provided, and a component sitting in a layout is rendered as part of the shell for *every* route beneath that layout. So one breadcrumb suspends once per dynamic child route, and the build fails pointing at the layout even though nothing in the layout changed. The fix is to wrap the component that reads the hook rather than the layout, pushing the read to the smallest leaf so its siblings stay in the static shell. `useSearchParams` is the special case that always needs a boundary, because search params are never known at build time.

**Why does the same hook behave differently on a page load and a client navigation?**
Because they are different renders with different information available. On a page load the server renders from the document root and search params are not known, so `useSearchParams` suspends and needs a boundary. On a client navigation the router already has the params from the URL, so the hook resolves synchronously. The same asymmetry applies to `<Suspense>` boundaries generally: a client navigation only re-renders below the layout the two routes share, so a boundary in the root layout covers a page load but sits above the re-render scope during a transition and never triggers. This is the single most useful fact for debugging why a route is instant one way and blocking the other.

**Why does component state suddenly persist across navigations, and what has to change because of it?**
Because Cache Components renders previous routes through React's `<Activity>` component in `"hidden"` mode rather than unmounting them. Effects still clean up and re-run, but `useState`, form inputs and scroll position survive navigating away and coming back. Anything that was implicitly reset by unmounting now needs an explicit reset: dropdowns close in a `useLayoutEffect` cleanup, dialog state is better derived from the URL than from state, and form success or error messages need clearing in the submit handler. It is worth noting that the number of routes kept hidden is unspecified — the docs say only "a few" — so nothing should depend on a particular route still being resident.


---

← [01c · Flipping the flag on an existing app](01c-flipping-the-flag-on-an-existing-app.md) · [Chapter index](01-explanation.md) · Next → **02 · `use cache` and custom `cacheLife` profiles** *(not written yet)*
