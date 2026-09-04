---
title: "notFound() reaches not-found.tsx by throwing an exception, so anything that catches exceptions between the call and the boundary silently deletes your 404 — and once the response has started streaming the status code is already 200"
sidebar_label: "01f · not-found.tsx"
sidebar_position: 104
description: "How notFound() propagates to not-found.tsx, why try/catch swallows it, the 200-vs-404 status question, and the root not-found file's double duty."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (`lastUpdated: 2026-07-10`), [`notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found) (`2026-07-24`) and [`loading.js` › Status Codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes) (`2026-06-08`).
> Target: **Next.js 16.3.4** · `not-found` introduced v13.0.0; root `app/not-found` handling global unmatched URLs since v13.3.0. Documentation-verified — **no sandbox run**.

**`notFound()` is not a return value and `not-found.tsx` is not a page you route to. The function throws a specific framework exception, and the file is the boundary that catches it. Everything people get wrong here is downstream of that: a `try/catch` in a data helper eats the 404, a call inside an un-awaited promise throws where nothing is listening, and if a Suspense fallback has already rendered then the HTTP status was committed as 200 before your code ever decided the resource was missing.**

## The two conventions

> *"Next.js provides two conventions to handle not found cases:*
> *• **`not-found.js`**: Used when you call the `notFound` function in a route segment.*
> *• **`global-not-found.js`**: Used to define a global 404 page for unmatched routes across your entire app. This is handled at the routing level and doesn't depend on rendering a layout or page."*
> — [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)

> *"The **not-found** file is used to render UI when the `notFound` function is thrown within a route segment. Along with serving a custom UI, Next.js will return a `200` HTTP status code for streamed responses, and `404` for non-streamed responses."*

> *"In the component hierarchy, `not-found.js` renders between `loading.js` and `page.js`. It is wrapped by the `<Suspense>` boundary from `loading.js` and the error boundary from `error.js` in the same segment."*

So the not-found UI is *inside* both of the segment's other boundaries: a `loading.tsx` fallback can be showing while the not-found decision is still being made, and an error thrown by `not-found.tsx` itself is caught by the sibling `error.tsx`.

## The delivery mechanism is an exception

> *"Invoking `notFound()` throws a `NEXT_HTTP_ERROR_FALLBACK;404` error and terminates rendering of the route segment where it was thrown. Next.js also injects a `<meta name="robots" content="noindex" />` tag so the page is not indexed. Because it works by throwing, call it in the render path: a component, or a function a component `await`s. A call left in an un-awaited promise throws where nothing catches it, and no not-found UI renders (in development the server logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;404`)."*
> — [`notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found)

> *"Like any exception, it travels up the call stack until something catches it. A `try/catch` around the call suppresses it, and the not-found UI won't render. If you need to catch errors near the call, use `unstable_rethrow` to let the interrupt through first."*

> *"You do not need to write `return notFound()`. Calling it is enough, because it throws an exception that stops function execution. TypeScript understands this from its `never` return type, so a value you check first stays narrowed afterward."*

```tsx title="app/user/[id]/page.tsx"
import { notFound } from 'next/navigation'

export default async function Profile(props: PageProps<'/user/[id]'>) {
  const { id } = await props.params
  const user = await fetchUser(id)

  if (!user) {
    notFound() // no `return` needed — it throws
  }

  return <UserProfile user={user} /> // `user` is narrowed to non-null here
}
```

`notFound()` *"can be invoked in Server Components, Server Functions, and Route Handlers"*, and in a route handler *"it serves a `404` to the caller"*:

```ts title="app/api/posts/[slug]/route.ts"
import { NextResponse } from 'next/server'
import { notFound } from 'next/navigation'

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/posts/[slug]'>
) {
  const { slug } = await params
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  if (!res.ok) {
    notFound()
  }
  return NextResponse.json(await res.json())
}
```

## Which `not-found.tsx` renders

> *"Add a `not-found.tsx` alongside the route to define that UI. Without one, the nearest parent `not-found` boundary renders, falling back to Next.js's default 404 page."*

And the root file does double duty:

> *"In addition to catching expected `notFound()` errors, the root `app/not-found.js` and `app/global-not-found.js` files handle any unmatched URLs for your whole application. This means users that visit a URL that is not handled by your app will be shown the exported UI."*

The file takes **no props** — *"`not-found.js` or `global-not-found.js` components do not accept any props"* — but it may be `async` and fetch:

```tsx title="app/not-found.tsx"
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function NotFound() {
  const headersList = await headers()
  const domain = headersList.get('host')
  const data = await getSiteData(domain)
  return (
    <div>
      <h2>Not Found: {data.name}</h2>
      <p>Could not find requested resource</p>
      <p>
        View <Link href="/blog">all posts</Link>
      </p>
    </div>
  )
}
```

> *"If you need to use Client Component hooks like `usePathname` to display content based on the path, you must fetch data on the client-side instead."*

## The status code

The trade-off, stated by the `notFound` reference itself:

> *"The trade-off is the HTTP status code. Because the check runs inside the `<Suspense>` boundary, the response has already begun streaming as a `200`, and the status can't change once streaming has started. The `noindex` tag keeps a soft 404 out of search results. To return a real `404` status, the resource has to be checked before the response streams."*

And from the `loading.js` reference, the exact trigger:

> *"The response body starts streaming when a Suspense fallback renders (for example, a `loading.tsx`) or when a Server Component suspends under a `Suspense` boundary. Place `notFound()` before those boundaries and before any `await` that may suspend."*

So there are two shapes and you choose deliberately:

**Shape A — check first, keep the real 404 status.** The check happens before anything suspends, so the shell has not streamed and Next.js can still set the header.

**Shape B — check inside a boundary, keep the instant shell.** The idiomatic version from the docs, where the existence check lives in the data-access function and the page keeps its streamed layout:

```tsx title="app/blog/[slug]/page.tsx"
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`)
  if (res.status === 404) {
    notFound()
  }
  if (!res.ok) {
    throw new Error(`Failed to load post: ${res.status}`)
  }
  return res.json()
}

async function Article({ slug }: { slug: string }) {
  const post = await getPost(slug)
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}

export default async function PostPage(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params

  return (
    <section>
      <Link href="/blog">Blog</Link>
      <Suspense fallback={<p>Loading...</p>}>
        <Article slug={slug} />
      </Suspense>
    </section>
  )
}
```

> *"When the post doesn't exist, `getPost` calls `notFound()`, which throws. Because this happens during rendering, the exception propagates to the nearest `not-found` boundary, which renders in place of the streamed-in content, even though the page shell has already been sent."*

The application-wide variant of this file — `global-not-found.js`, which handles URLs that
match no route at all — is [01g](01g-global-not-found.md).

## Gotchas

**★ Symptom: `notFound()` runs and nothing happens — the page renders on with `undefined` data.** Cause: a `try/catch` around the call swallowed the control-flow exception. Extremely common inside data-access helpers with generic error handling. Fix — rethrow the framework interrupt first:

```ts title="app/lib/posts.ts"
import { notFound, unstable_rethrow } from 'next/navigation'

export async function getPost(slug: string) {
  try {
    const res = await fetch(`https://api.example.com/posts/${slug}`)
    if (res.status === 404) notFound()
    return res.json()
  } catch (error) {
    unstable_rethrow(error) // lets NEXT_HTTP_ERROR_FALLBACK;404 through
    throw new Error('Post lookup failed', { cause: error })
  }
}
```

**★ Symptom: development logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;404` and the 404 UI never shows.** Cause: `notFound()` was called inside a promise nobody awaited, so it threw outside the render path where no boundary exists. Fix — await it:

```tsx
// ✗ the rejection escapes the render
const check = verifySlug(slug) // calls notFound() internally
return <Article slug={slug} />

// ✓
await verifySlug(slug)
return <Article slug={slug} />
```

**★ Symptom: an SEO tool reports your 404 pages as HTTP 200 "soft 404s".** Cause: the response began streaming — a `loading.tsx` fallback rendered, or a component suspended — before `notFound()` was called, and headers cannot be rewritten after the first byte. Fix — either accept it (Next.js injects `noindex`, which keeps the URL out of the index), or do the existence check before anything can suspend, in `proxy.ts`:

```ts title="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'
import { postExists } from '@/app/lib/posts'

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/blog\/([^/]+)$/)
  if (match && !(await postExists(match[1]))) {
    return new NextResponse('Not found', { status: 404 })
  }
  return NextResponse.next()
}
```

**Symptom: you wrote `return notFound()` and TypeScript complains about the return type.** Cause: `notFound()` returns `never`; there is nothing to return. Fix — drop the `return`. As a bonus, TypeScript then narrows the value you checked, so the code after the guard sees a non-nullable object.

**Symptom: the wrong 404 design renders — the site-wide one instead of the section's.** Cause: there is no `not-found.tsx` in the segment that threw, so the nearest parent boundary won. Fix — add one alongside the route:

```tsx title="app/blog/[slug]/not-found.tsx"
export default function NotFound() {
  return (
    <section>
      <h1>Post not found</h1>
      <p>The post you're looking for doesn't exist.</p>
    </section>
  )
}
```

**Symptom: `usePathname()` in `not-found.tsx` fails or forces the whole file client-side.** Cause: `not-found.tsx` is a Server Component with no props; the pathname is not available to it on the server. Fix — keep the file a Server Component and put the pathname-dependent bit in a small `'use client'` child that reads it in the browser.

**Symptom: the default 404 ignores your dark theme and follows the operating system instead.** Cause: the *default* not-found UI follows `prefers-color-scheme` and does not read an app-level class or `data-theme`. Fix — ship your own `app/not-found.tsx` (it renders inside your root layout, so it inherits everything), or add a higher-specificity rule pair in the global stylesheet scoped to your theme selector, e.g. `html[data-theme='dark'] body`.

## Interview questions

**★ How does `notFound()` reach `not-found.tsx`?**
By throwing. It raises a `NEXT_HTTP_ERROR_FALLBACK;404` error that terminates rendering of the current segment and propagates up the call stack until Next.js's not-found boundary catches it, at which point the nearest `not-found.tsx` — walking upward from the throwing segment — renders in place of that segment's content. Because it is an exception, it must be called in the render path, and any `try/catch` between the call and the boundary swallows it. That is also why `return notFound()` is unnecessary and why its TypeScript return type is `never`.

**★ Why can a `notFound()` produce a 200 status, and does that hurt SEO?**
Because the response may already be streaming. Streaming begins as soon as a Suspense fallback renders — a `loading.tsx`, or any component that suspended under a boundary — and once the headers are on the wire the status is committed; the not-found UI then arrives inside the body of a 200 response. Next.js compensates by injecting `<meta name="robots" content="noindex" />`, so search engines do not index the URL even though the status says success. Crawlers may label it a "soft 404", but the explicit `noindex` means it does not lead to indexation. If a genuine 404 status is needed for compliance or analytics, the existence check has to run before anything suspends — typically in `proxy.ts`.

**★ A generic error handler in your data layer catches everything. What breaks, and how do you fix it?**
Every Next.js control-flow interrupt — `notFound()`, `redirect()`, `forbidden()`, `unauthorized()` — is implemented as a thrown exception, so a blanket `catch` swallows all of them and the corresponding UI never renders. The supported fix is `unstable_rethrow(error)` as the first statement of the catch block: it re-throws framework interrupts and returns normally for genuine errors, so your own handling still runs for the cases it was written for.

**Where do you put the existence check — in the page, or in the data-access function?**
The docs' idiomatic answer is the data-access function, awaited by a component that sits inside a `Suspense` boundary. That keeps the page shell and its loading UI visible while the lookup runs, and the throw still finds the not-found boundary because it happens during rendering. The cost is the status code, which is already committed as 200 by then. Put the check at the top of the page component instead when the real 404 status matters more than the instant shell.

**Does `app/not-found.tsx` handle URLs that match no route, or only explicit `notFound()` calls?**
Both, since v13.3.0. The root `app/not-found.js` is documented as handling *"any unmatched URLs for your whole application"* in addition to catching expected `notFound()` errors. A `not-found.tsx` in a nested segment only ever handles `notFound()` thrown within that segment's subtree; only the root one gets the unmatched-URL job.

**Can `not-found.tsx` fetch data?**
Yes — it is a Server Component by default and can be `async`, so it can call `headers()` or query a database to render, say, a tenant-specific 404. What it cannot do is receive props: no `params`, no `searchParams`, nothing. Anything it needs about the request has to come from a request-time API such as `headers()`, and anything path-dependent that requires `usePathname` has to be delegated to a Client Component child.

---

← [01e · error.tsx](01e-error-and-not-found-boundaries.md) · [Chapter 2 overview](01-explanation.md) · Next → [01g · global-not-found.js](01g-global-not-found.md)
