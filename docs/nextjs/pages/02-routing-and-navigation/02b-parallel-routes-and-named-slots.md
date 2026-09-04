---
title: "A parallel-route slot is a folder that becomes a prop on the parent layout rather than a segment in the URL, which is why two slots can navigate independently — and why a conditional layout still renders both of them on the server"
sidebar_label: "02b · Parallel routes"
sidebar_position: 9
description: "@folder slots, the implicit children slot, independent loading and error states, useSelectedLayoutSegment with a parallelRouteKey, conditional routes and the authorization trap they hide."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) (`lastUpdated: 2026-08-25`) and [`default.js`](https://nextjs.org/docs/app/api-reference/file-conventions/default) (`2025-10-09`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**A dashboard that shows a team panel and an analytics panel is two independent pages sharing one layout, and the App Router models that literally: `@team/page.tsx` and `@analytics/page.tsx` arrive at `layout.tsx` as props named `team` and `analytics`. They stream separately, they get their own `loading.tsx` and `error.tsx`, and each remembers its own subpage across a soft navigation. What they do not get is independence from each other's rendering mode, or from the URL — and the file that reconciles slots with the URL after a refresh, `default.js`, became mandatory in Next.js 16.**

## Slots

> *"Parallel Routes allows you to simultaneously or conditionally render one or more pages within the same layout. They are useful for highly dynamic sections of an app, such as dashboards and feeds on social sites."*
> *"Parallel routes are created using named **slots**. Slots are defined with the `@folder` convention."*
> *"Slots are passed as props to the shared parent layout."*
> — [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)

```
app/
├── layout.tsx        receives children, team, analytics
├── page.tsx          the implicit @children slot
├── @team/
│   ├── page.tsx
│   └── settings/page.tsx
└── @analytics/
    └── page.tsx
```

```tsx title="app/layout.tsx"
export default function Layout({
  children,
  team,
  analytics,
}: {
  children: React.ReactNode
  analytics: React.ReactNode
  team: React.ReactNode
}) {
  return (
    <>
      {children}
      {team}
      {analytics}
    </>
  )
}
```

Two rules follow, both stated outright:

> *"However, slots are **not** route segments and do not affect the URL structure. For example, for `/@analytics/views`, the URL will be `/views` since `@analytics` is a slot."*

> *"The `children` prop is an implicit slot that does not need to be mapped to a folder. This means `app/page.js` is equivalent to `app/@children/page.js`."*

That second one matters more than it looks: `children` is a slot like any other, so every rule about slots — including the `default.js` requirement in [02c](02c-defaultjs-is-required-in-nextjs-16.md) — applies to it too.

`LayoutProps` infers the slot props from the directory structure, so you do not have to hand-write the type:

```tsx title="app/layout.tsx"
export default function Layout(props: LayoutProps<'/'>) {
  return (
    <>
      {props.children}
      {props.team}
      {props.analytics}
    </>
  )
}
```

## The constraint people hit first

> *"Slots are combined with the regular Page component to form the final page associated with the route segment. Because of this, you cannot have separate prerendered and dynamically rendered slots at the same route segment level. If one slot is dynamic, all slots at that level must be dynamic."*

One slot reading `cookies()` drags every sibling slot at that level into dynamic rendering. If you want a static shell with one live panel, the live part has to be pushed **inside** a slot behind its own Suspense boundary, not made into a sibling slot.

## Behaviour across navigation

> *"By default, Next.js keeps track of the active *state* (or subpage) for each slot. However, the content rendered within a slot will depend on the type of navigation:*
> *• **Soft Navigation**: During client-side navigation, Next.js will perform a partial render, changing the subpage within the slot, while maintaining the other slot's active subpages, even if they don't match the current URL.*
> *• **Hard Navigation**: After a full-page load (browser refresh), Next.js cannot determine the active state for the slots that don't match the current URL. Instead, it will render a `default.js` file for the unmatched slots, or `404` if `default.js` doesn't exist."*

⚠️ That last clause — *"or `404` if `default.js` doesn't exist"* — is the pre-16 behaviour and the Parallel Routes page still carries it. The version 16 upgrade guide states something stronger and newer: the build fails. The conflict, and which to believe, is the subject of [02c](02c-defaultjs-is-required-in-nextjs-16.md).

## Independent loading and error states

> *"Parallel Routes can be streamed independently, allowing you to define independent error and loading states for each route."*

```
app/
├── @team/
│   ├── loading.tsx    only the team panel shows a skeleton
│   ├── error.tsx      only the team panel shows an error
│   └── page.tsx
└── @analytics/
    ├── loading.tsx
    ├── error.tsx
    └── page.tsx
```

This is the strongest practical argument for slots over plain components: a failing analytics query degrades one panel instead of the whole dashboard, without you hand-writing an error boundary per widget.

## Reading the active segment of a slot

> *"Both `useSelectedLayoutSegment` and `useSelectedLayoutSegments` accept a `parallelRouteKey` parameter, which allows you to read the active route segment within a slot."*

```tsx title="app/layout.tsx"
'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

export default function Layout({ auth }: { auth: React.ReactNode }) {
  const loginSegment = useSelectedLayoutSegment('auth')
  return <div data-auth-open={loginSegment === 'login'}>{auth}</div>
}
```

> *"When a user navigates to `app/@auth/login` (or `/login` in the URL bar), `loginSegment` will be equal to the string `"login"`."*

## Tab groups

> *"You can add a `layout` inside a slot to allow users to navigate the slot independently. This is useful for creating tabs."*

```tsx title="app/@analytics/layout.tsx"
import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav>
        <Link href="/page-views">Page Views</Link>
        <Link href="/visitors">Visitors</Link>
      </nav>
      <div>{children}</div>
    </>
  )
}
```

Note the hrefs: `/page-views`, not `/@analytics/page-views`. The slot is invisible to the URL, so a link into a slot's subpage is written as a normal path — and navigating there changes only that slot while its siblings keep their active subpages.

## Conditional routes — and the security trap inside them

> *"You can use Parallel Routes to conditionally render routes based on certain conditions, such as user role."*

```tsx title="app/dashboard/layout.tsx"
import { checkUserRole } from '@/lib/auth'

export default function Layout({
  user,
  admin,
}: {
  user: React.ReactNode
  admin: React.ReactNode
}) {
  const role = checkUserRole()
  return role === 'admin' ? admin : user
}
```

🔴 Read the sentence the docs put immediately after that example, because it inverts the intuition the example creates:

> *"Both slots render on the server, regardless of which one the layout returns. The conditional decides what the user sees, not what runs: `@admin/page.js` executes its data fetches for every user, and its output is included in the response sent to the browser. Authorize inside each slot's page, or in your Data Access Layer."*

So the ternary is **presentation, not authorization**. The admin slot's queries run for every visitor and its rendered output is in the payload. The fix is to check inside the slot:

```tsx title="app/dashboard/@admin/page.tsx"
import { getAdminStats } from '@/lib/dal' // authorizes internally

export default async function AdminPage() {
  const stats = await getAdminStats()
  return <Stats stats={stats} />
}
```

## Gotchas

**★ Symptom: the slot folder exists but the layout prop is `undefined`.** Cause: the prop name must match the folder name without the `@`, and the slot needs a `page.tsx` to render anything. Fix:

```
app/@analytics/page.tsx   →  prop is `analytics`
app/@team/page.tsx        →  prop is `team`
```

```tsx
export default function Layout({ analytics }: { analytics: React.ReactNode }) {
  return <aside>{analytics}</aside>
}
```

**★ Symptom: adding a `@notifications` slot made the whole dashboard render dynamically and your static shell disappeared.** Cause: slots at the same segment level share a rendering mode — *"If one slot is dynamic, all slots at that level must be dynamic."* Fix — do not make the live panel a sibling slot; keep it inside one slot behind its own boundary:

```tsx title="app/@team/page.tsx"
import { Suspense } from 'react'
import { LiveNotifications } from './live-notifications'

export default function TeamPage() {
  return (
    <>
      <TeamRoster />
      <Suspense fallback={<NotificationsSkeleton />}>
        <LiveNotifications />
      </Suspense>
    </>
  )
}
```

**★ Symptom: `/@analytics/views` 404s.** Cause: the slot name is not part of the URL. `app/@analytics/views/page.tsx` serves `/views`. Fix — link to `/views`.

**★ Symptom: a role-gated `@admin` slot's data appears in the network payload for non-admins.** Cause: both slots render on the server regardless of which the layout returns; the ternary only chooses what is displayed. Fix — authorize inside the slot's page or in the data access layer, as shown above. Treat the parallel-route conditional as a layout technique with no security properties whatsoever.

**Symptom: two slots must render in a specific visual order and the layout's JSX order is being ignored.** Cause: it is not — but slots stream independently, so the one that resolves first paints first. Fix — this is a CSS problem, not a routing one: reserve the space with a `loading.tsx` per slot so the layout does not shift as each arrives.

**Symptom: `useSelectedLayoutSegment()` in a layout with slots returns the wrong thing.** Cause: with no argument it reads the `children` slot. Fix — pass the `parallelRouteKey`:

```tsx
const authSegment = useSelectedLayoutSegment('auth')
```

**Symptom: an `error.tsx` inside a slot does not catch a failure in the parent layout that renders the slot.** Cause: the same ancestor rule as everywhere else — the slot's boundary is below the layout. Fix — put the boundary at the level whose failures you mean to catch. See [01e](01e-error-and-not-found-boundaries.md).

**Symptom: after a browser refresh, a slot that was showing a subpage shows something else — or the route errors.** Cause: on a hard navigation Next.js cannot recover a slot's active state and falls back to `default.js`. Fix — provide one for every slot. This is [02c](02c-defaultjs-is-required-in-nextjs-16.md), and in Next.js 16 it is not optional.

## Interview questions

**★ What is a parallel route, mechanically?**
A folder named `@something` that is not a route segment. Its matched page is passed to the nearest parent `layout.tsx` as a prop named `something`, alongside `children`. Because the layout receives several rendered subtrees rather than one, they can stream independently, each can have its own `loading.tsx` and `error.tsx`, and each remembers its own active subpage across client-side navigation. The slot name never appears in the URL.

**★ What is the `children` prop, in the parallel-routes model?**
An implicit slot. The docs state that `app/page.js` is equivalent to `app/@children/page.js` — `children` is simply the slot you get without naming a folder. This is not trivia: it means every rule about slots also applies to `children`, including the requirement for a `default.js` when Next.js cannot recover the parent page's active state after a full reload.

**★ Two slots, one of them reads `cookies()`. What happens to the other?**
It becomes dynamic too. Slots at the same route segment level are combined into the single page for that segment, so they share a rendering mode — the docs are explicit that you cannot have separate prerendered and dynamically rendered slots at the same level. If you need a static shell alongside live data, the live part belongs inside a slot behind its own Suspense boundary rather than as a sibling slot.

**★ You gate an admin panel with `role === 'admin' ? admin : user` in the layout. Is that secure?**
No, and the documentation says so directly: both slots render on the server regardless of which one the layout returns, so `@admin/page.js` runs its data fetches for every user and its output is included in the response sent to the browser. The ternary controls display, not execution. Authorization has to happen inside the slot's page or in the data access layer that the slot calls — the same rule as anywhere else in RSC, just easier to forget because the layout code *looks* like a gate.

**When would you use a slot instead of just rendering two components in a layout?**
When the two regions need independent *routing*, not just independent layout. Slots give you a per-region URL-driven active subpage that survives soft navigation, per-region `loading.tsx` and `error.tsx` for free, independent streaming, and the ability to intercept a route into one region while the rest of the page stays put — which is how modals work. If the two regions never change independently and never need their own error states, two components are simpler and you should use two components.

**How do you build tabs inside a slot?**
Add a `layout.tsx` inside the slot folder with the tab links, and give the slot subpages — `@analytics/page-views/page.tsx` and `@analytics/visitors/page.tsx`. The links use ordinary URLs (`/page-views`), because the slot name is not in the path. Navigating between them re-renders only that slot; the sibling slots keep whatever subpage they were showing.

---

← [02 · Nested layouts and route groups](02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md) · [Chapter 2 overview](01-explanation.md) · Next → [02c · default.js is required in Next.js 16](02c-defaultjs-is-required-in-nextjs-16.md)
