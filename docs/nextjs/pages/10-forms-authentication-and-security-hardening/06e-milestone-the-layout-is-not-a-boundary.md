---
title: "A layout that renders a sign-in wall instead of its children has not stopped the children from running — it chose not to display data that is already in the RSC payload, and that distinction is the difference between hiding and protecting"
sidebar_label: "06e · Milestone: the layout is not a boundary"
sidebar_position: 31
description: "Chapter 10's capstone, step four: why an auth check in a layout protects nothing and does not even re-run on navigation, what a top-level await on the session costs every page beneath it, and the synchronous layout plus Suspense-wrapped user menu SprintDesk ships instead."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`) — sections *Layouts and auth checks* and *Auth and streaming* — and the
> [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · React 19.2.8. Documentation-verified; **no sandbox run**.

**"Put the auth check in the layout" is the single most common wrong answer in App Router authentication, and it is wrong twice over — once for security and once for performance.** It fails as a security control because a layout chooses what to *display*, not what to *render*: the route segments beneath it execute anyway, query the database anyway, and arrive in the RSC payload anyway. It fails as a shape because a top-level `await` on the session in a layout holds `{children}` behind that work, so every page under it loses its streamed shell for reasons nothing in those pages' own code explains. This page is short, and it is the one to re-read when someone proposes a `(protected)` route group whose layout does the checking.

## Why a layout cannot be the check

A layout is the wrong place for the check, and the Authentication guide gives two independent reasons.

> *"Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change."*
>
> *"A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."*
> — [Authentication, Layouts and auth checks](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)

The second sentence is the one that surprises people. A layout that renders `<SignInWall />` instead of `{children}` has not prevented `{children}` from running. The page still executed, its data still loaded, and the result is still in the RSC payload the browser received — the layout merely chose not to display it. "Hidden" and "not sent" are different words.

And the performance reason to keep the read low:

> *"A top-level `await` on `cookies()`, `headers()`, or the DAL in a layout delays the first streamed chunk for that segment and holds `{children}` behind that work."*
> — [Authentication, Auth and streaming](https://nextjs.org/docs/app/guides/authentication#auth-and-streaming)

So SprintDesk's `app/(dashboard)/layout.tsx` awaits nothing:

```tsx filename="app/(dashboard)/layout.tsx"
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { UserMenu } from './user-menu'
import { UserMenuSkeleton } from './user-menu-skeleton'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard">
      <header>
        <span className="wordmark">SprintDesk</span>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </header>
      {children}
    </div>
  )
}
```

```tsx filename="app/(dashboard)/user-menu.tsx"
import { getCurrentUser } from '@/lib/dal/user'
import { SignOutButton } from './sign-out-button'

export async function UserMenu() {
  const user = await getCurrentUser()
  if (!user) return null

  return (
    <div className="user-menu">
      <span>{user.name}</span>
      <SignOutButton />
    </div>
  )
}
```

The layout is a synchronous function. The session read lives one component down, inside a boundary. Under Cache Components this stops being a preference and becomes a build requirement — [12 · Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md) has the exact rule and the `instant = false` migration valve.

## Gotchas

**★ Symptom: a layout renders a "please sign in" wall, and a tester reports the private data is in the page source anyway.** Cause: the layout chose what to display; it did not stop the route segment from rendering. The guide states it directly — a layout does not control whether the rest of the route renders, and the segments still appear in the RSC payload. Fix: the check must be in the function that loads the data, so that no data exists to serialize:

```ts filename="lib/dal/board.ts"
export const readBoard = cache(async (boardId: string) => {
  const user = await requireUser()          // ← the gate is here
  return db.board.findFirst({
    where: { id: boardId, members: { some: { userId: user.id } } },
  })
})
```

**★ Symptom: the entire dashboard blocks until the session resolves, including parts that have nothing to do with the user.** Cause: `await getCurrentUser()` at the top level of the layout, which holds `{children}`. Fix: make the layout synchronous and push the read into a component inside `<Suspense>`, as in `app/(dashboard)/layout.tsx` above. Under Cache Components the same mistake is a build error rather than a slow page, which is the better outcome.

**★ Symptom: a user is signed out in another tab, navigates between two pages in this tab, and stays logged in.** Cause: the check lives in a layout, and layouts do not re-render on navigation under partial rendering — so the check ran once, when the segment first mounted, and has not run since. Fix: move it into the data functions, which run on every request that needs data. A layout check does not become correct by adding `export const dynamic = 'force-dynamic'`; that changes caching, not whether the layout re-renders on a client-side transition.

**★ Symptom: a `(protected)` route group was added, its layout checks the session, and a code review calls the routes protected.** Cause: the route group's name is a claim the framework does not enforce — a group is a URL-shaping device and its layout has exactly the same non-powers as any other layout. Fix: keep the group if it is useful for shared chrome, and put the enforcement where the data is. A useful test for the review: delete the layout entirely and ask which requests would now return data they should not. If the answer is "all of them", the layout was the control and the control was imaginary.

**★ Symptom: `return null` from a top-level component when the user is unauthorized, and the data still reaches the browser.** Cause: the same mechanism, and the guide names this pattern specifically as **not recommended**, because Next.js applications have multiple entry points that this does not prevent from being accessed. Fix: return nothing *because there is nothing* — the data function refused — rather than returning nothing while holding the data.

**★ Symptom: the user menu shows a stale name after a profile edit, but only in the header.** Cause: the header lives in the layout's tree, and a layout does not re-render on navigation, so the client-side transition that followed the edit re-rendered the page and not the chrome. Fix: this one is genuinely a cache-invalidation problem rather than an auth problem — expire the tag the user read is stored under, which also triggers the re-render. The mechanics are in [13 · Auth with Cache Components: sharing, caching and mutating](13-authentication-with-cache-components-sharing-caching-and-mutating.md).

## Interview questions

**★ You have a layout that checks the session and renders a sign-in prompt instead of `{children}`. Is the data behind it protected?**
No. The guide is explicit that a layout does not control whether the rest of the route renders — route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them running or appearing in the RSC payload. The page under it executed, queried the database and put the result on the wire; the layout only declined to display it. On top of that, layouts do not re-render on navigation under partial rendering, so the check does not even run on every route change. The check belongs in the function that loads the data.

**★ What does a top-level `await` on the session in a layout cost, and who pays it?**
Every page under that layout pays, and none of them contains the cause. The guide states that a top-level `await` on `cookies()`, `headers()` or the DAL in a layout delays the first streamed chunk for that segment and holds `{children}` behind that work. Concretely: the static shell disappears, time-to-first-byte for the segment becomes the session lookup's latency, and a developer debugging a slow page reads that page's code and finds nothing wrong. The fix is structural rather than an optimisation — keep the layout synchronous and move the read into a component inside a `Suspense` boundary, so only that component waits.

**★ Someone proposes a `(protected)` route group as the app's authorization mechanism. What do you tell them?**
That the parentheses do not do anything a security reviewer can rely on. A route group organises URLs and lets a set of routes share a layout; its layout has the same two limitations as every other layout — it does not gate rendering of its children, and it does not re-run on navigation. The group can stay, because shared chrome is a real reason to have one. What has to move is the enforcement: into the DAL functions the pages call, so that being inside or outside the group changes the URL and nothing about who can read the data.

**★ Why is `return null` from a top-level component when unauthorized specifically called out as bad, rather than merely insufficient?**
Because it reads like a decision and behaves like a comment. The pattern is imported from single-page applications, where returning null from the root really does prevent the rest from happening. The guide names it as not recommended for App Router because Next.js applications have multiple entry points — nested route segments still render, and Server Actions are reachable by direct POST regardless of what any component returned. So the code looks defensive, passes review, and protects nothing, which is worse than an obviously missing check because nobody goes looking for it.

**★ Where does the session check belong, then, in one sentence?**
Inside the function that touches the data, so that "authorized" and "has the data" are the same event rather than two events that a refactor can separate.

---

← [06d · The Data Access Layer](06d-milestone-the-data-access-layer.md) · [Chapter 10 overview](01-explanation.md) · Next → [06f · Authorization on the board](06f-milestone-authorization-on-the-board.md)
