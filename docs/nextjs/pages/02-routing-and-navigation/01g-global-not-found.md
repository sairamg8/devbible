---
title: "global-not-found.js exists for the two shapes where a route-level 404 cannot be composed at all — multiple root layouts, and a root layout under a dynamic segment — and it pays for that by skipping your rendering entirely"
sidebar_label: "01g · global-not-found.js"
sidebar_position: 7
description: "The experimental globalNotFound flag, why the file must return a whole HTML document, what it gains over not-found.js and what it gives up."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [`not-found.js` › `global-not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (`lastUpdated: 2026-07-10`) and [`layout.js` › Root Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`2026-05-27`).
> Target: **Next.js 16.3.4** · `global-not-found.js` introduced **experimental** in v15.4.0 and still behind `experimental.globalNotFound` at 16.3.4. Documentation-verified — **no sandbox run**.

**`not-found.tsx` renders inside your root layout, which is exactly what makes it inherit your fonts, your styles and your chrome — and exactly what makes it impossible when there is no single root layout to render inside. `global-not-found.js` is the escape hatch for that structural problem. It is handled at the routing level, it bypasses rendering entirely, and the price of that speed is that it inherits nothing at all.**

## What it is

> *"**`global-not-found.js`**: Used to define a global 404 page for unmatched routes across your entire app. This is handled at the routing level and doesn't depend on rendering a layout or page."*

> *"The `global-not-found.js` file lets you define a 404 page for your entire application. Unlike `not-found.js`, which works at the route level, this is used when a requested URL doesn't match any route at all. Next.js **skips rendering** and directly returns this global page."*
> — [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)

Read *"a requested URL doesn't match any route at all"* precisely. This file is about **unmatched URLs**, not about `notFound()` calls inside a matched route. A `notFound()` thrown in `app/blog/[slug]/page.tsx` still goes to the nearest `not-found.tsx`.

## The two cases it exists for

> *"`global-not-found.js` is useful when you can't build a 404 page using a combination of `layout.js` and `not-found.js`. This can happen in two cases:*
> *• Your app has multiple root layouts (e.g. `app/(admin)/layout.tsx` and `app/(shop)/layout.tsx`), so there's no single layout to compose a global 404 from.*
> *• Your root layout is defined using top-level dynamic segments (e.g. `app/[country]/layout.tsx`), which makes composing a consistent 404 page harder."*

Both are structural, not stylistic. In the first, an unmatched URL such as `/nonsense` belongs to neither route group, so Next.js has no layout to pick. In the second, `/nonsense` has no `[country]` value, so the root layout cannot even be instantiated.

## Turning it on

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
}

export default nextConfig
```

Then a file at the root of `app/`:

```tsx title="app/global-not-found.tsx"
// Import global styles and fonts
import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
}

export default function GlobalNotFound() {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>This page does not exist.</p>
      </body>
    </html>
  )
}
```

## The obligations, and the one thing it gains

> *"The `global-not-found.js` file bypasses your app's normal rendering, which means you'll need to import any global styles, fonts, or other dependencies that your 404 page requires. This includes your theme: because `global-not-found.js` bypasses your layout, the OS color scheme is the only signal the default UI sees, so apply your theme (class or attribute) inside this file."*

> *"Unlike `not-found.js`, this file must return a full HTML document, including `<html>` and `<body>` tags."*

> *"**Good to know**: A smaller version of your global styles, and a simpler font family could improve performance of this page."*

What it gains over `not-found.tsx` is metadata. Route-level `not-found.tsx` takes no props and lives under whatever layout supplied the head; `global-not-found.js` is a Server Component rendering its own document, so it can export `metadata` or `generateMetadata`:

> *"For `global-not-found.js`, you can export a `metadata` object or a `generateMetadata` function to customize the `<title>`, `<meta>`, and other head tags for your 404 page."*

> *"**Good to know**: Next.js automatically injects `<meta name="robots" content="noindex" />` for pages that return a 404 status code, including `global-not-found.js` pages."*

Note the contrast with `global-error.tsx`, which also renders its own document but is a Client Component and therefore **cannot** export metadata — it has to use React's `<title>` element instead. Same shape, opposite capability, for one reason: error boundaries must be Client Components and not-found pages need not be.

## Gotchas

**★ Symptom: you added `app/global-not-found.tsx` and it never renders.** Cause: the flag is not set. It is experimental and opt-in; without `experimental.globalNotFound` the file is inert. Fix:

```ts title="next.config.ts"
const nextConfig: NextConfig = { experimental: { globalNotFound: true } }
```

**★ Symptom: the 404 page renders unstyled, in a default serif, ignoring your dark theme.** Cause: it bypasses your layout by design, so nothing the root layout imported — global CSS, `next/font`, the `data-theme` attribute — is present. Fix — import them in the file itself and set the theme on the element you render:

```tsx title="app/global-not-found.tsx"
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="dark" className={inter.className}>
      <body>
        <h1>404</h1>
      </body>
    </html>
  )
}
```

**Symptom: hydration warnings, or the page renders inside another `body`.** Cause: returning a fragment or a `div`. Unlike `not-found.js`, this file *must* return the whole document. Fix — render `html` and `body` yourself.

**★ Symptom: a `notFound()` call in a matched route still shows the old design, not `global-not-found.tsx`.** Cause: correct behaviour — the global file only handles URLs that match **no route at all**. `notFound()` inside a matched route goes to the nearest `not-found.tsx`. Fix — if you want them to look alike, keep both files and share a component:

```tsx title="app/ui/not-found-body.tsx"
export function NotFoundBody() {
  return (
    <>
      <h1>404 - Page Not Found</h1>
      <p>This page does not exist.</p>
    </>
  )
}
```

```tsx title="app/not-found.tsx"
import { NotFoundBody } from '@/app/ui/not-found-body'
export default function NotFound() {
  return <NotFoundBody />
}
```

**Symptom: your 404 page is heavier than most real pages.** Cause: importing the full global stylesheet and a variable font into a document that exists to be discarded. Fix — the docs' own advice: ship a reduced stylesheet and a system font stack for this file specifically.

**Symptom: with two root layouts, `/` also 404s.** Cause: an unrelated but co-occurring caveat — with multiple root layouts and no top-level `layout.js`, the home route must be defined inside one of the groups. Fix — `app/(marketing)/page.tsx`. See [01b](01b-layout-and-the-root-layout.md).

## Interview questions

**★ When do you need `global-not-found.js` rather than `not-found.js`?**
When there is no single layout from which to compose a 404. The docs name two cases: multiple root layouts (e.g. `app/(admin)/layout.tsx` alongside `app/(shop)/layout.tsx`), where an unmatched URL belongs to neither group so no layout can be chosen; and a root layout under a top-level dynamic segment such as `app/[country]/layout.tsx`, where an unmatched URL has no value for the segment so the layout cannot be instantiated. Outside those two shapes, a plain `app/not-found.tsx` is better — it inherits your styles and chrome for free.

**★ What does `global-not-found.js` give up, and what does it gain?**
It gives up your whole render tree: no root layout, so no global CSS, no `next/font`, no providers, no theme attribute — the docs are explicit that it bypasses normal rendering and must import everything it needs, and that the OS colour scheme is the only signal the default UI sees. What it gains is speed (Next.js returns it directly rather than rendering a route) and metadata support, since unlike `global-error.tsx` it is a Server Component and can export a `metadata` object.

**Does `global-not-found.js` handle `notFound()` calls?**
No. It handles URLs that match no route at all. A `notFound()` thrown inside a matched route is an exception caught by the nearest `not-found` boundary, walking upward from the segment that threw — that path never reaches the global file. If the two need to look identical, factor the markup into a shared component and render it from both.

**Why can `global-not-found.js` export `metadata` when `global-error.tsx` cannot, given that both render their own document?**
Because `global-error.tsx` is an error boundary, and error boundaries must be Client Components — `metadata` and `generateMetadata` are server-only exports and are unsupported in a Client Component file. `global-not-found.js` has no such constraint; it is an ordinary Server Component. The documented workaround for `global-error.tsx` is React's `<title>` element rendered inside the component.

**It is still experimental at 16.3.4. What does that mean in practice?**
That the flag and possibly the file's contract can change in a minor release, so it should be behind a deliberate decision rather than added by default. If your app has one root layout — the common case — you do not need it at all, and `app/not-found.tsx` already handles unmatched URLs application-wide, which it has done since v13.3.0.

---

← [01f · not-found.tsx](01f-not-found-and-the-notfound-function.md) · [Chapter 2 overview](01-explanation.md) · Next → [02 · Nested layouts and route groups](02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md)
