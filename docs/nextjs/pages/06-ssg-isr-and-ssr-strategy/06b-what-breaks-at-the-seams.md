---
title: "The blast radius of a request-time read is every route beneath the file it sits in, and every route that imports the component doing it — which is why a theme cookie in the root layout or a session check in a shared header converts a static marketing page into a per-request render with no error and nothing in its own directory to point at"
sidebar_label: "06b · What breaks at the seams"
sidebar_position: 23
description: "The render-tree seam failures between static, ISR'd and dynamic areas of one Next.js 16.3.4 deployment — the root layout, a shared header and a layout straddling a public page and a private board — each shown in code with its fix."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (docs `lastUpdated` 2026-08-25), [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) and [Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) (`lastUpdated` 2026-03-30).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. No build output, timings or route-summary tables are reproduced, because none were produced.

**[06](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) built three areas with three strategies. Every one of them is correct in isolation and every one of them is one shared file away from being wrong. The rule that explains all of it fits in a sentence: a request-time read makes the route it is in render per request, and its blast radius is every route beneath the file that performed the read. A `cookies()` call in `app/layout.tsx` is therefore not a small personalisation feature — it is a decision to render the entire product per request, including the pricing page. Nothing errors. The pages still work. They are simply no longer cached, and the first person to notice will be looking at an infrastructure bill or a latency graph, weeks later, with no commit to blame. This chunk is the three seams in the render tree; [06c](06c-data-layer-seams-and-choosing-a-fix.md) is the two in the data layer, plus how to choose between the fixes.**

## The rule, and the two directions it travels

**Down the tree.** A layout renders above every route beneath it, so a request-time read in a
layout applies to all of them. `app/layout.tsx` is above literally everything.

**Along imports.** A shared *component* is not a boundary either. If `SiteHeader` reads
`cookies()`, then every page that renders `SiteHeader` performs a request-time read, regardless
of which route group or directory that page lives in. Import graphs cross the directory
structure you were reasoning about.

**What does *not* travel: Suspense.** A request-time read inside a Suspense boundary keeps the
surrounding shell prerenderable — that is the component-level boundary the framework is built
around, and it is the mechanism behind every fix below.

## Seam 1 — the root layout reads a cookie

The commit is two lines and looks harmless.

```tsx
// app/layout.tsx — 🔴 this makes /pricing render per request
import { cookies } from 'next/headers'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = (await cookies()).get('sd_theme')?.value ?? 'light'

  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  )
}
```

Every route in the application is beneath this file. The marketing pages, the public team pages,
the board: all of them now read the request. The team that shipped this was adding dark mode.

**Fix — push the read to the client**, because the value is cosmetic and the flash is
acceptable:

```tsx
// app/layout.tsx — no request read; the server renders a stable default
import { ThemeSync } from '@/components/theme-sync'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  )
}
```

```tsx
// components/theme-sync.tsx
'use client'

import { useEffect } from 'react'

export function ThemeSync() {
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )sd_theme=([^;]*)/)
    const theme = match ? decodeURIComponent(match[1]) : 'light'
    document.documentElement.dataset.theme = theme
  }, [])

  return null
}
```

The trade is explicit and worth stating in the pull request: a user with dark mode sees a light
frame for one paint, and in exchange the entire site stays prerendered. If that flash is
unacceptable — and on a dark-mode toggle it sometimes genuinely is — then the correct answer is
**not** to put the read back in the root layout. It is to accept that the *shell* is
per-visitor, which is a decision to make deliberately and to write down, not one to arrive at
by accident.

## Seam 2 — the shared header knows who you are

This is the most common instance in real codebases, because the component is genuinely shared
and the requirement is genuinely reasonable.

```tsx
// components/site-header.tsx — 🔴 imported by marketing, team pages AND the board
import { getSessionUser } from '@/lib/auth' // reads cookies()

export async function SiteHeader() {
  const user = await getSessionUser()

  return (
    <header>
      <a href="/">SprintDesk</a>
      {user ? <Avatar user={user} /> : <a href="/sign-in">Sign in</a>}
    </header>
  )
}
```

Nothing about that file mentions the marketing pages. It still makes them dynamic, because they
render it.

**Fix — split the component and isolate the request-time part behind a boundary.** Use this
when the value must come from the server:

```tsx
// components/site-header.tsx — the shell is static; only the slot is dynamic
import { Suspense } from 'react'
import { SessionSlot } from './session-slot'

export function SiteHeader() {
  return (
    <header>
      <a href="/">SprintDesk</a>
      <Suspense fallback={<div className="session-slot" aria-hidden />}>
        <SessionSlot />
      </Suspense>
    </header>
  )
}
```

```tsx
// components/session-slot.tsx — the only request-time part
import { getSessionUser } from '@/lib/auth'
import { Avatar } from './avatar'

export async function SessionSlot() {
  const user = await getSessionUser()
  return user ? <Avatar user={user} /> : <a href="/sign-in">Sign in</a>
}
```

The fallback reserves the same space as the resolved content, which matters more here than
usual — a header slot that changes size is a layout shift on every page of the site.

## Seam 3 — the `[team]` layout serves a public page and a private board

`app/teams/[team]/layout.tsx` sits above both `/teams/acme` (ISR, public, indexable) and
`/teams/acme/board` (per request, authorized). Adding an owner-only affordance there is the
natural thing to do and it is wrong:

```tsx
// app/teams/[team]/layout.tsx — 🔴 drags the ISR'd public page dynamic
import { getSessionUser } from '@/lib/auth'
import { TeamNav } from '@/components/team-nav'

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const user = await getSessionUser()

  return (
    <div>
      <TeamNav team={team} canEdit={user?.teams.includes(team) ?? false} />
      {children}
    </div>
  )
}
```

The public page's whole value was that it is prerendered and revalidated on a webhook. It now
renders per request, and the `revalidateTag` in the profile webhook has nothing to invalidate
that anyone reads.

**Fix — stop sharing the file.** The two subtrees genuinely differ, so express that with route
groups rather than with a conditional:

```
app/teams/[team]/
├── layout.tsx              🔴 no request reads: markup and params only
├── page.tsx                public, ISR
└── board/
    ├── layout.tsx          reads cookies() — private subtree only
    └── page.tsx
```

```tsx
// app/teams/[team]/layout.tsx — the shared file, made safe by having no reads
// 🔴 RULE: this layout is shared by a cacheable public page and a per-request
// board. No cookies(), no headers(), no searchParams, no segment config here.
export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  return (
    <div>
      <TeamBrandBar team={team} />
      {children}
    </div>
  )
}
```

The owner-only "Edit" affordance moves into the board layout, where the session is already
being read for authorization anyway — or, if it genuinely must appear on the public page, into
its own Suspense boundary on that page. The comment in the file is not decoration: it is the
only mechanism preventing the next person from re-introducing the bug, because nothing in the
type system or the linter knows this file is shared across a caching boundary.

## Gotchas

**★ Symptom: adding dark mode makes the whole product render per request, and the pricing page's response time triples.** Cause: `cookies()` in `app/layout.tsx`, which is above every route in the application. Fix: read the cookie in a Client Component after hydration, as `ThemeSync` above. If the flash is genuinely unacceptable, the honest conclusion is that the shell is per-visitor and the caching strategy for the whole site needs redeciding — not that the read belongs in the root layout after all.

**★ Symptom: a marketing page becomes dynamic and nothing in its own directory changed.** Cause: a shared component it imports started reading the request — a session-aware header, a locale-aware footer, a consent banner. Import graphs cross route groups, so the file that caused it may be nowhere near the page. Fix: split the component into a static shell plus a request-time slot inside Suspense, as `SiteHeader` above, and keep `dynamic = 'error'` on the marketing segments so the next occurrence fails the build instead of shipping.

**★ Symptom: the public team page stops being revalidated by the webhook, and `revalidateTag` appears to do nothing.** Cause: the page is no longer cached — a request-time read in the shared `[team]` layout made it render per request, so there is no cache entry for the tag to invalidate. Fix: remove the read from the shared layout and move it into the board subtree. Note the misleading symptom: this is reported as a broken webhook, and the webhook is fine.

**★ Symptom: the "Edit team" button is missing on the public page for signed-in owners, after the seam fix.** Cause: it was rendered from the shared layout's session read, which is exactly what was removed. Fix: put it in its own Suspense boundary on the public page, or render it client-side after hydration. Do not restore it to the layout — that is the bug, re-introduced with a business justification attached.

**★ Symptom: a `revalidate` export added to a shared layout changes behaviour on routes nobody was thinking about.** Cause: segment config applies to the whole subtree beneath the file. Fix: never place segment config on a layout shared across a caching boundary, and record the prohibition as a comment in the file. Under Cache Components this class of bug disappears with the config itself, since `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` when the flag is on.

**★ Symptom: the team header shows a signed-in avatar on a page served from cache to an anonymous visitor.** Cause: a session-dependent value rendered into a cached shell rather than into a boundary — the same shape as a paywall implemented above the data layer. Fix: the `SessionSlot` split above. And check whether anything else session-derived reached the cached markup, because this class of bug rarely appears alone.

## Interview questions

**★ State the rule that explains every seam failure in one sentence.**
A request-time read makes the route it occurs in render per request, and its blast radius is every route beneath the file that performed the read — plus, along the import graph, every route that renders a component performing the read. That is why a `cookies()` call in `app/layout.tsx` is a decision about the entire product's caching strategy rather than a small personalisation feature, and why a shared header can make a marketing page dynamic from a file in a different directory.

**★ A marketing page went from prerendered to per-request and nothing in its directory changed. Where do you look?**
Upward and along the imports. Upward: every layout above it, ending at `app/layout.tsx`, for a `cookies()`, `headers()` or `searchParams` read, or for segment config that was added to a shared file. Along the imports: every shared component it renders — headers, footers, consent banners, CTA buttons — because the import graph crosses route groups and directory structure. The tell is usually a recent feature that sounds unrelated to rendering: dark mode, a locale switcher, a "signed in as" indicator.

**★ You need the user's name in the site header, and the header is on every page including the static ones. What do you do?**
Split the component. The header shell — logo, navigation, layout — stays a plain component with no request reads, so it prerenders into every page. The session-dependent slot becomes its own async component inside a Suspense boundary with a fallback that reserves the same space. The route keeps its static shell and streams one small hole. The alternative that must be rejected explicitly is making the header a Client Component that fetches the session after hydration — that works, but it puts an extra round trip on every page load for a value the server already has.

**★ Why is a shared `[team]` layout more dangerous than a shared root layout, even though the root layout has a larger blast radius?**
Because the root layout is obviously shared and everybody treats it carefully, while the `[team]` layout looks local. It sits inside the team feature, it is edited by whoever owns team pages, and nothing in it hints that one of its children must stay cacheable while another must not. The root layout's danger is proportional to its blast radius and everyone knows the radius; the `[team]` layout's danger is that its radius crosses a caching boundary invisibly.

---

← [06 · Milestone: three strategies, one deploy](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) · [Chapter 6 overview](01-explanation.md) · Next → [06c · Data-layer seams, and choosing a fix](06c-data-layer-seams-and-choosing-a-fix.md)
