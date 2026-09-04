---
title: "Nesting layouts is automatic and free; the interesting move is decoupling the layout tree from the URL tree, which is what a parenthesised route group buys you — at the price of two failure modes the docs name explicitly"
sidebar_label: "02 · Nested layouts and route groups"
sidebar_position: 8
description: "How nested layouts compose and what they persist, route groups that organise without touching the URL, the three folder-name conventions that look alike, and the conflicting-path and full-page-load caveats."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) (`lastUpdated: 2025-06-16`), [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`2026-05-27`), [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) (`2026-08-25`) and [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) (`2026-07-21`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**A `layout.tsx` in a folder wraps every route below that folder, forever, with no wiring — that part is free and needs no explanation beyond the composition order. What actually takes thought is the case where the shape you want in the UI is not the shape you want in the URL: a marketing site and a shop that must not share chrome, an authenticated area whose paths must stay at the root, a subtree that needs its own root layout. Parentheses around a folder name solve exactly that, and the two ways it bites are both documented caveats rather than bugs.**

## Nested layouts, in one tree

```
app/
├── layout.tsx          wraps EVERYTHING — renders html + body
├── page.tsx            /
└── dashboard/
    ├── layout.tsx      wraps /dashboard and everything under it
    ├── page.tsx        /dashboard
    └── settings/
        ├── layout.tsx  wraps /dashboard/settings and below
        └── page.tsx    /dashboard/settings
```

At `/dashboard/settings` the rendered tree is `RootLayout(DashboardLayout(SettingsLayout(SettingsPage)))`. Nothing declares that; it follows from the recursion rule in [01](01-file-system-routing-pagetsx.md):

> *"The components are rendered recursively in nested routes, meaning the components of a route segment will be nested **inside** the components of its parent segment."*
> — [Project structure › Component hierarchy](https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy)

```tsx title="app/dashboard/layout.tsx"
import { DashboardNav } from './dashboard-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[16rem_1fr]">
      <DashboardNav />
      <section>{children}</section>
    </div>
  )
}
```

The value of that nesting is not code reuse — it is **persistence**. Navigating from `/dashboard` to `/dashboard/settings` keeps `DashboardLayout` mounted: the nav's scroll position, its open accordions, any client state in it, all survive, and its server render is not repeated. Navigating from `/dashboard/settings` to `/blog` unmounts it, because `blog` is not below `dashboard`. That is the whole design: **the layout tree is a cache keyed by URL prefix.** The mechanics and the props are [01b](01b-layout-and-the-root-layout.md).

A segment may have a layout and no page. `app/dashboard/layout.tsx` with no `app/dashboard/page.tsx` is legal and common — `/dashboard` itself 404s while `/dashboard/settings` works and is wrapped.

## Route groups: organisation that does not reach the URL

> *"Route Groups are a folder convention that let you organize routes by category or team."*
> *"A route group can be created by wrapping a folder's name in parenthesis: `(folderName)`."*
> *"This convention indicates the folder is for organizational purposes and should **not be included** in the route's URL path."*
> — [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)

```
app/
├── (marketing)/
│   ├── layout.tsx      marketing chrome only
│   ├── about/page.tsx  →  /about        ← no "marketing" in the URL
│   └── pricing/page.tsx → /pricing
└── (app)/
    ├── layout.tsx      product chrome only
    ├── dashboard/page.tsx → /dashboard
    └── settings/page.tsx  → /settings
```

The docs list three use cases, and the third is the one worth memorising because it is the only way to express it:

> *"• Organizing routes by team, concern, or feature.*
> *• Defining multiple root layouts.*
> *• Opting specific route segments into sharing a layout, while keeping others out."*

That third bullet is the escape from an otherwise rigid rule. Layout nesting follows the URL, so ordinarily two sibling routes either share their parent's layout or neither does. A group breaks the tie without renaming anything:

```
app/
├── layout.tsx              root: html + body, shared by all three
├── (with-sidebar)/
│   ├── layout.tsx          adds the sidebar
│   ├── inbox/page.tsx      →  /inbox     (has sidebar)
│   └── archive/page.tsx    →  /archive   (has sidebar)
└── compose/page.tsx        →  /compose   (no sidebar, same root layout)
```

## Three folder conventions that look similar and are not

| Written | Called | Appears in the URL? | Effect |
|---|---|---|---|
| `(marketing)` | route group | **No** | Groups routes; may carry its own `layout.tsx` |
| `_components` | private folder | **No** — and not routable at all | *"opting the folder and all its subfolders out of routing"* |
| `@analytics` | parallel-route slot | **No** | Passed to the parent layout as a prop of that name |
| `[slug]` | dynamic segment | **Yes** | Matches one path segment |

The private-folder rule, verbatim:

> *"Private folders can be created by prefixing a folder with an underscore: `_folderName`. This indicates the folder is a private implementation detail and should not be considered by the routing system, thereby **opting the folder and all its subfolders** out of routing."*
> — [Project structure › Private folders](https://nextjs.org/docs/app/getting-started/project-structure#private-folders)

And a genuinely obscure corner from the same section, worth banking:

> *"You can create URL segments that start with an underscore by prefixing the folder name with `%5F` (the URL-encoded form of an underscore): `%5FfolderName`."*

Slots — `@analytics` — are the subject of [02b](02b-parallel-routes-and-named-slots.md).

## The two caveats, verbatim

> *"**Full page load**: If you navigate between routes that use different root layouts, it'll trigger a full page reload. For example, navigating from `/cart` that uses `app/(shop)/layout.js` to `/blog` that uses `app/(marketing)/layout.js`. This **only** applies to multiple root layouts."*

> *"**Conflicting paths**: Routes in different groups should not resolve to the same URL path. For example, `(marketing)/about/page.js` and `(shop)/about/page.js` would both resolve to `/about` and cause an error."*

> *"**Top-level root layout**: If you use multiple root layouts without a top-level `layout.js` file, make sure your home route (/) is defined within one of the route groups, e.g. app/(marketing)/page.js."*
> — [Route Groups › Caveats](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups#caveats)

Read the first caveat carefully: the full page load is caused by **crossing root layouts**, not by crossing groups. Two groups under one shared `app/layout.tsx` navigate softly between each other like any other routes. The confusion is common enough that it is worth stating both configurations side by side:

```
# One root layout, two groups → soft navigation everywhere
app/layout.tsx
app/(marketing)/layout.tsx
app/(shop)/layout.tsx

# No top-level layout → two ROOT layouts → full page load between them
app/(marketing)/layout.tsx    ← renders its own html + body
app/(shop)/layout.tsx         ← renders its own html + body
```

## Gotchas

**★ Symptom: the build fails with a message about two pages resolving to the same path.** Cause: two route groups each contain the same route — `(marketing)/about/page.tsx` and `(shop)/about/page.tsx` both resolve to `/about`. The parentheses are invisible to the router, so this is a genuine duplicate. Fix — one of them has to move or be renamed:

```
app/(marketing)/about/page.tsx     →  /about
app/(shop)/about-us/page.tsx       →  /about-us     ✓
app/(shop)/about/page.tsx          →  /about        ✗ conflict
```

**★ Symptom: `/marketing/about` 404s and you expected it to work.** Cause: the group name is stripped from the URL — that is the entire point of the convention. `app/(marketing)/about/page.tsx` serves `/about` and nothing else. Fix — if you *want* the prefix in the URL, drop the parentheses; a plain folder is a real segment.

**★ Symptom: navigating between two sections of your own app does a full document reload.** Cause: they are served by **different root layouts** — usually two groups each with a `layout.tsx` and no `app/layout.tsx` above them. Documented, not a bug. Fix — introduce one shared root layout and demote the two to nested layouts:

```tsx title="app/layout.tsx"
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```tsx title="app/(shop)/layout.tsx"
// now a NESTED layout — no html/body here
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="shop-chrome">{children}</div>
}
```

**Symptom: with two root layouts, `/` itself 404s.** Cause: neither group defines the home route and there is no top-level `layout.js` to host one. Fix — put the home page inside a group: `app/(marketing)/page.tsx`.

**Symptom: a helper component in `app/(marketing)/components/card.tsx` is fine, but `app/(marketing)/components/page.tsx` became a live route at `/components`.** Cause: `components/` is a real segment; only the *parenthesised* folder is invisible. Fix — use a private folder, which is opted out of routing entirely:

```
app/(marketing)/_components/card.tsx    ✓ never routable
app/(marketing)/components/card.tsx     ✓ not routable either — but the FOLDER is a segment
app/(marketing)/components/page.tsx     ✗ now /components exists
```

**Symptom: you moved routes into a group and every `Link href` broke.** Cause: you also renamed the folders, or you wrote the group into the href. `href` is a URL, and the group is not part of the URL. Fix — `href="/about"`, never `href="/(marketing)/about"`.

**Symptom: `/dashboard` 404s although `app/dashboard/layout.tsx` exists.** Cause: a layout does not make a segment routable; only a `page.tsx` or `route.ts` does. Fix — add `app/dashboard/page.tsx`, or accept that `/dashboard` is a container path and redirect it:

```tsx title="app/dashboard/page.tsx"
import { redirect } from 'next/navigation'

export default function Page() {
  redirect('/dashboard/overview')
}
```

**Symptom: adding a group changed which `loading.tsx` or `error.tsx` applies.** Cause: those files resolve along the **folder** hierarchy, not the URL hierarchy, so moving a route into a group genuinely changes which boundaries wrap it. This is usually what you wanted — a group with its own `error.tsx` gives that whole section a shared error UI — but it is easy to do accidentally. Fix — put the boundary files at the level whose scope you actually mean:

```
app/(app)/error.tsx        every route in the (app) group
app/(app)/dashboard/error.tsx   only /dashboard and below
```

**Symptom: two nested layouts both render a `main` element and the page ends up double-wrapped.** Cause: every layout in the chain renders, all the way down; nesting composes, it does not override. Fix — decide once which level owns the landmark element, and let the deeper layouts render plain containers.

**Symptom: a deeply nested layout re-fetches the same user record the root layout already fetched.** Cause: layouts cannot pass data down, so each level fetches for itself. Fix — one `cache()`-wrapped accessor imported by both, as in [01b](01b-layout-and-the-root-layout.md).

## Interview questions

**★ What does a route group actually change, given that it does not appear in the URL?**
It changes the **folder** tree without changing the **URL** tree, and since layouts, loading UI, error boundaries and templates all resolve along the folder tree, a group changes which of those wrap a route. That is why the docs list "opting specific route segments into sharing a layout, while keeping others out" as a use case — without groups, layout nesting is rigidly tied to URL nesting, and two sibling paths must either both inherit their parent's layout or both not.

**★ Someone says "route groups cause full page reloads". Are they right?**
Only in the specific case they are probably thinking of. The reload is caused by navigating **between different root layouts**, and groups are just the usual way people end up with more than one root layout — by deleting `app/layout.tsx` and putting a `layout.tsx` inside each group. Two groups nested under a single shared root layout navigate softly between each other like any other routes. The distinction matters because "avoid route groups, they are slow" is the wrong lesson; "avoid multiple root layouts unless the two areas really are different applications" is the right one.

**★ How do you give `/inbox` and `/archive` a sidebar but not `/compose`, when all three are top-level routes?**
Wrap the first two in a route group with its own layout: `app/(with-sidebar)/inbox/page.tsx`, `app/(with-sidebar)/archive/page.tsx` and `app/(with-sidebar)/layout.tsx`, leaving `app/compose/page.tsx` outside it. All three keep their top-level URLs because the group name is stripped, and only the two inside the group get the sidebar layout. The alternative — moving them under a real `/app/` segment — would change the URLs, which is exactly what the convention exists to avoid.

**★ Distinguish `(folder)`, `_folder`, `@folder` and `[folder]`.**
`(folder)` is a route group: organisational, invisible in the URL, may carry its own layout and boundaries. `_folder` is a private folder: it and all its subfolders are opted out of routing entirely, so even a `page.tsx` inside it is inert — used to keep implementation files from ever becoming routes. `@folder` is a parallel-route slot: also invisible in the URL, but its content is passed to the parent layout as a prop named after the folder. `[folder]` is a dynamic segment and is the only one of the four that appears in the URL. The first three all vanish from the path for three completely different reasons.

**Two groups both contain `about/page.tsx`. What happens, and why is it not resolved by "first one wins"?**
It is a build error. Both resolve to `/about`, and the router has no basis for preferring one — the parentheses carry no precedence and no ordering. Next.js treats it as the ambiguity it is rather than picking silently, which is the right call: silent resolution would mean a route that changes behaviour when someone renames a group.

**Does a segment need a `page.tsx` for its layout to apply to children?**
No. `app/dashboard/layout.tsx` wraps `/dashboard/settings` whether or not `app/dashboard/page.tsx` exists. What is missing without a page is `/dashboard` itself, which 404s. Container segments with a layout and no page are a normal pattern; if you want the container URL to go somewhere, add a page that calls `redirect()`.

**Why does a nested layout not re-render when you navigate between its children?**
Because that is the point of the layout tree: Next.js caches layouts on the client and reuses them across navigations within their subtree, so a sidebar's state and its server-side data fetching survive. Only the segments below the common prefix are re-rendered. The trade-offs that follow — no `searchParams` prop, no raw request object — are covered in [01b](01b-layout-and-the-root-layout.md), and the way to force a remount deliberately is `template.tsx`, in [01c](01c-layout-vs-template.md).

---

← [01g · global-not-found.js](01g-global-not-found.md) · [Chapter 2 overview](01-explanation.md) · Next → [02b · Parallel routes and named slots](02b-parallel-routes-and-named-slots.md)
