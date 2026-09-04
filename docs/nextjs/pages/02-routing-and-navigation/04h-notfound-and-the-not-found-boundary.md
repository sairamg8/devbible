---
title: "notFound() is an interrupt, not a return value — it throws NEXT_HTTP_ERROR_FALLBACK;404 and travels up the call stack, so a try/catch around it or an un-awaited promise loses the 404 entirely and the page renders on"
sidebar_label: "04h · notFound"
sidebar_position: 26
description: "How notFound throws and where it is legal to call it, the two symmetrical ways to lose the interrupt silently, putting the check in the data-access function, never-type narrowing, and notFound in a Route Handler."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found) reference (`lastUpdated: 2026-07-24`) and [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (`lastUpdated: 2026-07-10`).
> Target: **Next.js 16.3.4** · `notFound` since **v13.0.0**. Documentation-verified — **no sandbox run**.

**`notFound()` is an interrupt, not a return value. It throws `NEXT_HTTP_ERROR_FALLBACK;404`, terminates rendering of the segment it was thrown in, and travels up the call stack until a `not-found` boundary catches it. Everything surprising about it follows from that one sentence. A `try/catch` of yours between the throw and the boundary suppresses it, and the page renders on as though the resource existed. A call left in a promise nothing awaits throws where no boundary is listening, and does the same. Both failures are silent in production, and both are avoided by the same discipline: put the check inside the data-access function the component `await`s. What happens *after* the interrupt is caught — which file renders and what status code ships — is [04i](04i-the-not-found-boundary-and-the-404-status.md).**

## The mechanism

> *"The `notFound` function throws an error that renders a Next.js 404 page. It's useful for handling missing resources in your application."*

> *"Invoking `notFound()` throws a `NEXT_HTTP_ERROR_FALLBACK;404` error and terminates rendering of the route segment where it was thrown. Next.js also injects a `<meta name="robots" content="noindex" />` tag so the page is not indexed."*

Legal call sites: *"`notFound()` can be invoked in Server Components, Server Functions, and Route Handlers."*

```tsx title="app/user/[id]/page.tsx"
import { notFound } from 'next/navigation'

async function fetchUser(id: string) {
  const res = await fetch('https://...')
  if (!res.ok) return undefined
  return res.json()
}

export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await fetchUser(id)

  if (!user) {
    notFound()
  }

  // ...
}
```

No `return` is needed, and TypeScript keeps the narrowing:

> *"You do not need to write `return notFound()`. Calling it is enough, because it throws an exception that stops function execution. TypeScript understands this from its `never` return type, so a value you check first stays narrowed afterward."*

## It must be thrown where something is listening

This is the load-bearing constraint, and the reference states it in the opening paragraph:

> *"Because it works by throwing, call it in the render path: a component, or a function a component `await`s. A call left in an un-awaited promise throws where nothing catches it, and no not-found UI renders (in development the server logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;404`)."*

and the corollary for `try/catch`:

> *"Like any exception, it travels up the call stack until something catches it. A `try/catch` around the call suppresses it, and the not-found UI won't render. If you need to catch errors near the call, use `unstable_rethrow` to let the interrupt through first."*

So the two ways to lose a `notFound()` are symmetrical: catch it yourself, or throw it somewhere no one is awaiting. Both fail silently in production.

## Calling it after streaming has started

The documented pattern keeps the shell and the loading UI visible by putting the check inside a `<Suspense>` boundary rather than blocking the route:

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

export default async function PostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params

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

Note where the check lives: **inside the data-access function**, which the reference calls *"the idiomatic place"*. One check serves every component that awaits that function, and it cannot be forgotten at a call site.

## In a Route Handler

> *"`notFound()` also works in a Route Handler, where it serves a `404` to the caller."*

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

## The sibling interrupts

`notFound()` is one of three interrupts built the same way. They differ only in the status they represent and the file convention that catches them:

| Function | Catches in | Meaning |
| --- | --- | --- |
| [`notFound()`](https://nextjs.org/docs/app/api-reference/functions/not-found) | `not-found.js` | the resource does not exist |
| [`forbidden()`](https://nextjs.org/docs/app/api-reference/functions/forbidden) | `forbidden.js` | the caller is authenticated and not allowed |
| [`unauthorized()`](https://nextjs.org/docs/app/api-reference/functions/unauthorized) | `unauthorized.js` | the caller is not authenticated |

Everything on this page about throwing, `try/catch`, un-awaited promises and `never`-type narrowing applies to all three. Reaching for `notFound()` to hide a resource the user is not allowed to see is a deliberate choice — it leaks less than a 403 and it also tells your own monitoring the wrong story, so make it on purpose rather than by default.

## Gotchas

**★ Symptom: `notFound()` runs, nothing renders differently, and the log shows a caught error.** Cause: a `try/catch` around the call. *"A `try/catch` around the call suppresses it, and the not-found UI won't render."* Fix: move the call outside, or rethrow the framework's interrupt first.

```ts
import { unstable_rethrow } from 'next/navigation'

try {
  const post = await getPost(slug) // may call notFound()
  return render(post)
} catch (error) {
  unstable_rethrow(error) // lets NEXT_HTTP_ERROR_FALLBACK;404 through
  logger.error(error)
  throw error
}
```

**★ Symptom: no not-found UI renders and development logs `⨯ unhandledRejection: NEXT_HTTP_ERROR_FALLBACK;404`.** Cause: `notFound()` was thrown inside a promise nothing awaited, so it escaped the render path and no boundary saw it. Fix: `await` the work in the render path.

```tsx
// 🚩 the rejection escapes; the page renders as if the post existed
getPost(slug).then((p) => cache.set(slug, p))

// ✅
const post = await getPost(slug)
```

**★ Symptom: TypeScript says the value may be `undefined` after your `notFound()` guard.** Cause: the guard is inside a `try`, so the compiler cannot treat the call as terminal. Fix: outside a `try`, the `never` return type narrows for you and no `return` is required.

```tsx
const user = await fetchUser(id)
if (!user) {
  notFound()
}
return <Profile user={user} /> // user is defined here
```

**Symptom: a `notFound()` inside `getPost` fires for a network error as well as a genuine 404.** Cause: the guard was written as `if (!res.ok) notFound()`, which folds 500s and timeouts into "does not exist". Fix: separate the two — the reference's own example does, and the distinction is what lets `error.tsx` handle failures while `not-found.tsx` handles absence.

```ts
if (res.status === 404) notFound()
if (!res.ok) throw new Error(`Failed to load post: ${res.status}`)
```

**★ Symptom: `notFound()` in a Client Component event handler does nothing useful.** Cause: the documented call sites are Server Components, Server Functions and Route Handlers — an interrupt thrown from a click handler is not on any render path. Fix: decide on the server. If a client interaction can discover that something is gone, navigate to a route whose Server Component performs the check.

```tsx
'use client'
import { useRouter } from 'next/navigation'

const router = useRouter()
// the destination's Server Component calls notFound() if the id is stale
<button onClick={() => router.push(`/posts/${id}`)}>Open</button>
```

**Symptom: your JSON API returns an HTML 404 page instead of a JSON error body.** Cause: `notFound()` in a Route Handler serves a `404` to the caller, which is right for a resource endpoint and wrong if your clients parse every response as JSON. Fix: choose per endpoint — `notFound()` when the URL genuinely names nothing, an explicit `NextResponse.json` when the contract says errors are JSON.

```ts
// resource-shaped: 404 is the honest answer
if (res.status === 404) notFound()

// contract-shaped: clients parse JSON unconditionally
if (res.status === 404) {
  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
```

## Interview questions

**★ Trace what happens between `notFound()` and the 404 page appearing.**
The call throws `NEXT_HTTP_ERROR_FALLBACK;404`, which terminates rendering of the segment it was thrown in. Like any exception it travels up the call stack until something catches it — here, the nearest `not-found` boundary, which is `not-found.js` in the closest segment that has one, falling back to the nearest parent and ultimately Next.js's default 404 page. That boundary renders in place of the content, and Next.js injects `<meta name="robots" content="noindex" />`. If a `try/catch` of yours sits between the throw and the boundary, none of that happens.

**★ Two different mistakes cause `notFound()` to silently do nothing. Name both.**
Catching it: a `try/catch` around the call intercepts the interrupt, so the not-found UI never renders and you get a logged error instead. And throwing it off the render path: a call inside a promise nothing awaits rejects where no boundary is listening, producing an `unhandledRejection` in development and, in production, a page that renders as though the resource existed. Both are silent in the sense that neither shows the user a 404.

**★ Where should the existence check actually live in a well-structured app?**
Inside the data-access function that fetches the resource, which the reference calls the idiomatic place. The component awaits `getPost(slug)`, and `getPost` calls `notFound()` when the upstream returns 404. That means every consumer of the function inherits the check, no call site can forget it, and the throw happens on the render path because the component is awaiting it. It also gives you a natural place to distinguish absence from failure — 404 becomes `notFound()`, other non-ok statuses become a thrown `Error` for `error.tsx`.

**★ `notFound()` or `redirect()` for a resource that no longer exists?**
`notFound()` when the URL names something that does not exist and never will again under that URL — the honest answer is absence, and a crawler should be told so, which the injected `noindex` tag does. `redirect()`, or better `permanentRedirect()`, when the resource still exists at a different canonical URL: a renamed slug, a merged record, a changed username. The failure mode of getting this backwards is redirecting every dead URL to the homepage, which search engines treat as a soft 404 anyway and which strands the user with no explanation.

**Why does `notFound()` not need a `return` in front of it?**
Because its declared return type is `never`, so TypeScript knows control does not continue past the call. That is not cosmetic: a value you checked for `undefined` before the call stays narrowed afterwards, so `const user = await fetchUser(id); if (!user) notFound(); return <Profile user={user} />` type-checks without a non-null assertion. The narrowing stops working if the call sits inside a `try`, which is a useful early warning that it is in the wrong place.

---

← [04g · `redirect`](04g-redirect-and-permanentredirect.md) · [Chapter 2 overview](01-explanation.md) · Next → [04i · The not-found boundary and the 404 status](04i-the-not-found-boundary-and-the-404-status.md)
