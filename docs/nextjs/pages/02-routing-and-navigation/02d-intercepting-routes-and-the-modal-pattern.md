---
title: "Intercepting routes exist so one URL can render two different UIs depending on how you arrived at it — a modal on a soft navigation, the full page on a hard one — and the (..) counting is done in route segments, not folders"
sidebar_label: "02d · Intercepting routes"
sidebar_position: 11
description: "The (.), (..), (..)(..) and (...) matchers, why they count segments rather than directories, the full modal pattern with a @modal slot, and what a hard refresh does differently."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes) (`lastUpdated: 2025-06-16`) and [Parallel Routes › Modals](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#modals) (`2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**Every "click the photo, it opens in a modal; send the link to a friend, they get the full page" implementation outside a framework ends up as a pile of client state that lies about the URL. Intercepting routes make it a routing concern instead: the same `/photo/123` resolves to the intercepted component when the user got there by clicking inside the feed, and to the real page when the browser asked the server for it cold. The convention looks like a relative path and behaves like one, with one twist — it counts route segments, so slots do not count.**

## What it is for

> *"Intercepting routes allows you to load a route from another part of your application within the current layout. This routing paradigm can be useful when you want to display the content of a route without the user switching to a different context."*

> *"For example, when clicking on a photo in a feed, you can display the photo in a modal, overlaying the feed. In this case, Next.js intercepts the `/photo/123` route, masks the URL, and overlays it over `/feed`."*

> *"However, when navigating to the photo by clicking a shareable URL or by refreshing the page, the entire photo page should render instead of the modal. No route interception should occur."*
> — [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)

That last paragraph is the behavioural contract in full. **Soft navigation → intercepted UI. Hard navigation (refresh, shared link, new tab) → the real page.** You do not write the branch; the file layout is the branch.

## The convention

> *"Intercepting routes can be defined with the `(..)` convention, which is similar to relative path convention `../` but for route segments."*
> *"You can use:*
> *• `(.)` to match segments on the **same level***
> *• `(..)` to match segments **one level above***
> *• `(..)(..)` to match segments **two levels above***
> *• `(...)` to match segments from the **root** `app` directory"*

Note the third form: **`(..)(..)`, not `(...)` and not `(../..)`.** `(...)` is the root matcher, which is a different thing entirely — an easy and expensive typo.

> *"For example, you can intercept the `photo` segment from within the `feed` segment by creating a `(..)photo` directory."*

## The twist that makes the counting non-obvious

> *"**Good to know:** The `(..)` convention is based on *route segments*, not the file-system. For example, it does not consider `@slot` folders in Parallel Routes."*

And the consequence spelled out on the same page:

> *"In the above example, the path to the `photo` segment can use the `(..)` matcher since `@modal` is a slot and **not** a segment. This means that the `photo` route is only one segment level higher, despite being two file-system levels higher."*

So for `app/@modal/(..)photo/[id]/page.tsx` you count `@modal` as zero and use `(..)`, even though your editor's file tree shows two levels. This is the single most common reason an interception silently does not happen: the matcher is off by one because someone counted directories.

Route groups are the same story — `(marketing)` is not a segment either, so it does not count.

## The modal pattern, end to end

The documented build, from [Parallel Routes › Modals](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#modals):

> *"Parallel Routes can be used together with Intercepting Routes to create modals that support deep linking. This allows you to solve common challenges when building modals, such as: making the modal content **shareable through a URL**; **preserving context** when the page is refreshed, instead of closing the modal; **closing the modal on backwards navigation** rather than going to the previous route; **reopening the modal on forwards navigation**."*

```
app/
├── layout.tsx              renders {children} and {modal}
├── page.tsx                the feed
├── login/page.tsx          the real /login page
└── @modal/
    ├── default.tsx         returns null — REQUIRED in Next.js 16
    ├── page.tsx            returns null — closes the modal at "/"
    ├── [...catchAll]/page.tsx   returns null — closes it anywhere else
    └── (.)login/page.tsx   the intercepted modal
```

**Step 1 — the real page.**

```tsx title="app/login/page.tsx"
import { Login } from '@/app/ui/login'

export default function Page() {
  return <Login />
}
```

**Step 2 — the slot's `default.js`.**

> *"Then, inside the `@auth` slot, add `default.js` file that returns `null`. This ensures that the modal is not rendered when it's not active."*

```tsx title="app/@modal/default.tsx"
export default function Default() {
  return null
}
```

Since Next.js 16 this file is mandatory rather than merely advisable — see [02c](02c-defaultjs-is-required-in-nextjs-16.md).

**Step 3 — the interception.**

```tsx title="app/@modal/(.)login/page.tsx"
import { Modal } from '@/app/ui/modal'
import { Login } from '@/app/ui/login'

export default function Page() {
  return (
    <Modal>
      <Login />
    </Modal>
  )
}
```

> *"By separating the `<Modal>` functionality from the modal content (`<Login>`), you can ensure any content inside the modal, e.g. forms, are Server Components."*

**Step 4 — the layout renders both.**

```tsx title="app/layout.tsx"
import Link from 'next/link'

export default function Layout({
  modal,
  children,
}: {
  modal: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/login">Open modal</Link>
        </nav>
        <div>{modal}</div>
        <div>{children}</div>
      </body>
    </html>
  )
}
```

> *"When the user clicks the `<Link>`, the modal will open instead of navigating to the `/login` page. However, on refresh or initial load, navigating to `/login` will take the user to the main login page."*

**Step 5 — closing it.**

> *"You can close the modal by calling `router.back()` or by using the `Link` component."*

```tsx title="app/ui/modal.tsx"
'use client'

import { useRouter } from 'next/navigation'

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <>
      <button onClick={() => router.back()}>Close modal</button>
      <div>{children}</div>
    </>
  )
}
```

**Step 6 — the part everyone omits, and then files a bug about.**

> *"When using the `Link` component to navigate away from a page that shouldn't render the `@auth` slot anymore, we need to make sure the parallel route matches to a component that returns `null`."*

> *"We use a catch-all route in our `@auth` slot to close the modal because of how parallel routes behave. Since client-side navigations to a route that no longer match the slot will remain visible, we need to match the slot to a route that returns `null` to close the modal."*

```tsx title="app/@modal/page.tsx"
export default function Page() {
  return null
}
```

```tsx title="app/@modal/[...catchAll]/page.tsx"
export default function CatchAll() {
  return null
}
```

Without these, closing the modal with a `Link` to another page leaves the modal on screen over the new content, because an unmatched slot keeps its last active subpage across soft navigation.

## Soft versus hard, in one table

| | Soft navigation (`Link`, `router.push`) | Hard navigation (refresh, pasted URL, new tab) |
|---|---|---|
| Which file renders `/login` | `@modal/(.)login/page.tsx` | `app/login/page.tsx` |
| What the slot shows | the intercepted modal | whatever `@modal/default.tsx` returns — `null` |
| Router state | preserved; the feed stays mounted | rebuilt from the URL alone |
| Back button | closes the modal | leaves the login page |

## Gotchas

**★ Symptom: the interception never fires; clicking the link navigates to the full page.** Cause: the wrong number of dots, almost always because slots or route groups were counted as segments. The convention counts **route segments**, and `@modal` and `(marketing)` are neither. Fix — count segments, not folders:

```
app/@modal/(.)login/page.tsx        ✓ login is ONE segment up from app/
app/@modal/(..)login/page.tsx       ✗ counts @modal as a level — it is not
app/feed/@modal/(..)photo/page.tsx  ✓ photo sits beside feed, one segment up
```

**★ Symptom: `(...)` does not behave like "three levels up".** Cause: `(...)` is the **root** matcher — it matches from the top of `app/`, not from three levels above. Two levels up is written `(..)(..)`. Fix:

```
(.)         same level
(..)        one level above
(..)(..)    two levels above
(...)       from the app root
```

**★ Symptom: the modal stays on screen after navigating somewhere else with a `Link`.** Cause: a slot keeps its last active subpage during soft navigation when the new URL does not match anything in it. Fix — give the slot a catch-all that renders nothing:

```tsx title="app/@modal/[...catchAll]/page.tsx"
export default function CatchAll() {
  return null
}
```

**★ Symptom: refreshing while the modal is open shows the modal over an empty page, or the app 404s.** Cause: no `default.tsx` in the slot, or one that renders the modal. On a hard load the slot cannot recover its state. Fix — `default.tsx` returns `null`, so the refresh lands on the real page:

```tsx title="app/@modal/default.tsx"
export default function Default() {
  return null
}
```

**Symptom: the build fails after upgrading to 16 with a parallel-route complaint, in an app whose only slot is `@modal`.** Cause: the mandatory `default.js` requirement introduced in Next.js 16 applies to the modal slot and to the implicit `children` slot beside it. Fix — see [02c](02c-defaultjs-is-required-in-nextjs-16.md).

**Symptom: the intercepted modal and the real page have drifted apart in content.** Cause: two files rendering the same thing twice. Fix — both should render one shared component; only the wrapper differs:

```tsx title="app/@modal/(.)photo/[id]/page.tsx"
import { Modal } from '@/app/ui/modal'
import { Photo } from '@/app/ui/photo'

export default async function Page(props: PageProps<'/photo/[id]'>) {
  const { id } = await props.params
  return (
    <Modal>
      <Photo id={id} />
    </Modal>
  )
}
```

```tsx title="app/photo/[id]/page.tsx"
import { Photo } from '@/app/ui/photo'

export default async function Page(props: PageProps<'/photo/[id]'>) {
  const { id } = await props.params
  return <Photo id={id} />
}
```

**Symptom: everything inside the modal became a Client Component.** Cause: the modal wrapper needs `'use client'` for `useRouter`, and the content was written inside it in the same file. Fix — keep the wrapper and the content in separate files and compose them as `children`, which is precisely why the docs separate `<Modal>` from `<Login>`.

**Symptom: closing with `router.back()` sends the user out of the app entirely.** Cause: the modal was opened by a hard navigation, so there is no in-app history entry behind it. Fix — offer a `Link` fallback to the underlying page rather than relying solely on `back()`:

```tsx title="app/ui/modal.tsx"
import Link from 'next/link'

export function Modal({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Link href="/">Close modal</Link>
      <div>{children}</div>
    </>
  )
}
```

**Symptom: an interception works from one page and not another.** Cause: interception is scoped to where the intercepting folder lives. `app/feed/@modal/(..)photo` only intercepts when the user is inside `/feed`; a click from `/search` gets the real page. Fix — if you want it application-wide, put the intercepting slot at the root and use `(...)` to match from `app/`.

## Interview questions

**★ What problem do intercepting routes solve that client state cannot?**
Making one URL render two different UIs depending on how the user arrived, without the URL lying about what is on screen. Hand-rolled modals either keep the URL unchanged — so the modal is not shareable and the back button does the wrong thing — or push a URL that the server cannot render standalone. Intercepting routes give you both halves: a soft navigation renders the intercepted component over the current layout with the URL updated, and a hard request for that same URL renders the real page. Deep linking, refresh, back and forward all behave, because they are all just routing.

**★ Explain `(.)`, `(..)`, `(..)(..)` and `(...)`.**
They mirror relative paths but count **route segments**: `(.)` matches a segment at the same level, `(..)` one level above, `(..)(..)` two levels above, and `(...)` matches from the root of `app/`. The trap is that `(...)` is not "three levels up" — two levels up is the repeated form `(..)(..)`. The second trap is that segments are not directories: `@slot` folders and `(group)` folders do not count, so a path that is two folders deep may be only one segment up.

**★ Why can `app/@modal/(..)photo` be wrong where `app/@modal/(.)photo` is right?**
Because `@modal` is a slot, not a route segment, and the convention explicitly *"does not consider `@slot` folders"*. From inside `app/@modal/`, the segment level is still the root, so a `photo` segment sitting at `app/photo` is at the same level — `(.)`. The docs make exactly this point about their own example: the photo route is *"only one segment level higher, despite being two file-system levels higher"*.

**★ Walk through what happens on a refresh while an intercepted modal is open.**
The browser makes a fresh request for `/login`. There is no router state, so nothing knows the modal was open and no interception occurs — `app/login/page.tsx` renders as `children`. The `@modal` slot has no matching subpage for this URL and its active state cannot be recovered, so Next.js renders `@modal/default.tsx`, which returns `null`. The user sees the standalone login page. That is the designed outcome, and it is why the modal slot's default must be `null` rather than `notFound()`.

**★ Why does the modal pattern need a catch-all page inside the slot?**
Because an unmatched slot keeps showing its last active subpage across client-side navigation. If the modal is open at `/login` and the user clicks a `Link` to `/pricing`, nothing in `@modal` matches `/pricing`, so the modal remains visible over the new page. Adding `@modal/[...catchAll]/page.tsx` that returns `null` gives the slot something to match on every other route, which clears it. You also want `@modal/page.tsx` returning `null` for the root, since the catch-all does not match the empty path.

**Do intercepting routes require parallel routes?**
Not strictly — the interception itself is a matching rule and works on its own. But a modal needs the intercepted content to render *alongside* the page it overlays rather than in place of it, and rendering two things in one layout is exactly what a slot is for. That is why the docs present them together and why every real modal implementation uses both.

**Where does the interception apply, and how do you make it global?**
Only from within the segment where the intercepting folder lives. `app/feed/@modal/(..)photo/[id]` intercepts clicks originating inside `/feed` and nowhere else. To intercept from anywhere in the application, put the slot at the root of `app/` and use the root matcher, `(...)photo`, which matches the `photo` segment from the top of the tree.

---

← [02c · default.js required](02c-defaultjs-is-required-in-nextjs-16.md) · [Chapter 2 overview](01-explanation.md) · Next → [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md)
