---
title: "A `notFound()` that fires mid-stream cannot be a 404, so Next.js ships a `noindex` meta tag instead — and that is why the existence check belongs before the first `await`"
sidebar_label: "02b · `notFound()` after the first chunk"
sidebar_position: 105
description: "The exact rule for when streaming starts, why a streamed 404 is a 200, the noindex tag and soft-404 labelling that follow, how a mid-stream redirect degrades to a client-side one, and the two places you can still set a real status."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (page metadata
> `version: 16.3.4`, `lastUpdated: 2026-08-25`), the
> [`loading.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (`lastUpdated: 2026-06-08`) and the
> [`not-found.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
> (`lastUpdated: 2026-07-10`). Status-code and `noindex` behaviour is quoted verbatim below.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**`notFound()` renders your 404 UI whether or not it can return a 404 status, and most teams
never notice which one they are shipping.** The `not-found.js` reference states the split in a
single sentence: Next.js returns *"a `200` HTTP status code for streamed responses, and `404`
for non-streamed responses"*. Whether a given request is streamed is not a configuration choice
— it is decided by whether anything suspended before the `notFound()` call ran. So the same
function, in the same file, produces a real 404 or a 200-with-404-UI depending on where in the
component the existence check happens to sit. For a user the two are identical. For a crawler,
an analytics pipeline, a compliance audit or a link checker, they are not.

## The rule for when streaming starts

> *"The response body begins streaming when a Suspense fallback renders (for example, a
> `loading.tsx`) or when a component suspends under a `<Suspense>` boundary."*

Two triggers, and both are easy to hit by accident:

- **A `loading.tsx` anywhere above the segment.** Its whole purpose is to render a fallback
  immediately, which is precisely the event that commits the response.
- **Any `await` under a boundary.** Awaiting `params`, `cookies()`, or a data fetch inside a
  component that sits beneath a `<Suspense>` suspends the render and starts the stream.

> *"To get a real HTTP status code for errors, place `notFound()` **before** any `await` or
> `<Suspense>` boundary"*

The documented shape puts a cheap existence check in front of the expensive render:

```tsx
// app/post/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PostContent } from './post-content'

export async function generateStaticParams() {
  const posts = await getPublishedPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // Fast existence check
  if (!exists) notFound() // Real 404, before any Suspense boundary

  return (
    <Suspense fallback={<p>Loading post...</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

🔴 **Note what this costs: a second query.** `checkSlugExists` runs before the render and the
full post is fetched again inside `PostContent`. That is the actual trade — one cheap
round trip in exchange for a truthful status code — and it is worth paying on public content
and usually not worth paying behind a login, where nothing crawls the URL anyway.

## What you get instead of a 404

Next.js does not simply lose the information; it moves it into the body.

> *"If a `notFound()` fires mid-stream, Next.js cannot go back and change the status to 404.
> Instead, it injects `<meta name="robots" content="noindex">` into the streamed HTML so that
> search engines don't index the page."*

The `loading.js` reference adds the part that matters when someone reads a crawl report:

> *"Some crawlers may label these responses as "soft 404s". In the streaming case, this does not
> lead to indexation because the page is explicitly marked `noindex` in the HTML."*

So the outcome is: **not indexed, but reported as a soft 404 by tools that classify on status.**
That is a reporting nuisance, not an SEO defect — and knowing the difference is what stops a team
from "fixing" it by restructuring pages that were fine.

## Redirects degrade the same way

> *"a `redirect()` mid-stream becomes a client-side redirect rather than an HTTP redirect
> header."*

The user still lands on the destination. What changes is everything that reads HTTP: no `3xx` in
the access log, no `Location` header for a proxy to act on, and a client that must have executed
JavaScript to move at all. A non-JS client — some crawlers, some link checkers, `curl` — stays on
the original URL and sees whatever was streamed before the redirect fired.

## Where a real status is still available

Two levers, both of which run before rendering:

> *"You can also reject requests early using `proxy` (for redirects, rewrites, or returning a
> response) or `next.config.js` redirects. Both run before the page renders, so HTTP status codes
> are still available."*

The `loading.js` reference points at the same escape hatch for 404s, with a warning attached:
run the check in `proxy` to rewrite missing slugs to a not-found route or produce a 404 response,
and **"Keep proxy checks fast, and avoid fetching full content there."** Proxy code runs on every
matched request; a database round trip there is a tax on the whole route, not just the missing
cases.

```ts
// proxy.ts — a real 404 for a URL shape that cannot exist
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const match = /^\/post\/([^/]+)$/.exec(pathname)

  // cheap, structural, no I/O: a slug must be lowercase kebab-case
  if (match && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(match[1])) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return NextResponse.next()
}

export const config = { matcher: '/post/:slug' }
```

## Gotchas

### The 404 UI is right and the status is 200
**Symptom.** A missing article renders the custom not-found page, but `curl -I` reports
`HTTP/1.1 200 OK` and the SEO crawl flags a soft 404.
**Cause.** Something suspended before `notFound()` ran — usually a `loading.tsx` in the segment,
or an `await` inside a component under a boundary — so the response had already committed.
**Fix.** Do the existence check before anything suspends, as in the documented shape above. If
the check itself is expensive, push it into `proxy` where a real status is still available.

### Adding `loading.tsx` silently turns every 404 on the route into a 200
**Symptom.** Status codes were correct last month; nothing about the 404 logic changed; they are
all 200 now.
**Cause.** A `loading.tsx` was added to improve perceived performance. Rendering its fallback
*is* the event that starts the stream, so every code path below it now runs post-commit.
**Fix.** Know that this is the trade and make it deliberately. If the route's status codes
matter, keep the existence check above the boundary — a `loading.tsx` does not change *when*
your check runs, only whether the response has committed by the time it does.

### A mid-stream redirect that non-JS clients never follow
**Symptom.** A link checker reports the pre-redirect URL as live with a 200; server logs show no
`3xx` at all; a scraper reads the wrong page.
**Cause.** The redirect fired after streaming began, so it was delivered as a client-side
navigation rather than a `Location` header.
**Fix.** Redirect before anything suspends, or move the decision to `proxy` or a
`next.config.js` redirect where the response has not been sent yet.

```ts
// next.config.js — permanent moves belong here, not in a component
module.exports = {
  async redirects() {
    return [
      { source: '/blog/:slug', destination: '/posts/:slug', permanent: true },
    ]
  },
}
```

### An expensive existence check that doubles every request
**Symptom.** Correct 404 statuses, and p50 latency up by a full round trip on every successful
page view.
**Cause.** The pre-boundary check fetches the whole record, then the streamed component fetches
it again.
**Fix.** Make the pre-check as narrow as the question — an existence probe, not a read. A
`SELECT 1` keyed by the slug is a different query from loading the post.

```ts
// lib/posts.ts
export async function checkSlugExists(slug: string): Promise<boolean> {
  const row = await db.post.findFirst({
    where: { slug, publishedAt: { not: null } },
    select: { id: true }, // existence only — not the body, not the relations
  })
  return row !== null
}
```

### Setting `Cache-Control` for the 404 case from inside the page
**Symptom.** Missing pages are cached by the CDN as successful responses, so a slug that is later
published keeps 404ing for the TTL.
**Cause.** Headers were already sent, and the response is a `200` as far as every cache is
concerned, so the route's normal caching rules applied to it.
**Fix.** Decide caching where headers are still writable — `proxy` or config — and be wary of
caching streamed routes that can render a not-found body.

### Treating a soft-404 report as a bug in the 404 page
**Symptom.** A team rewrites `not-found.tsx` repeatedly trying to make a crawler stop calling it
a soft 404.
**Cause.** The label comes from the status code, not from the page. Next.js already injects
`<meta name="robots" content="noindex">`, so the URL is not indexed regardless.
**Fix.** Either accept the label — the page is not being indexed — or move the check before the
first suspension so the status is genuinely 404. Editing the not-found UI cannot affect either.

## Interview questions

**★ Does `notFound()` return a 404?**
Sometimes. The reference is precise: Next.js returns *"a `200` HTTP status code for streamed
responses, and `404` for non-streamed responses."* Whether the response is streamed depends on
whether a Suspense fallback rendered or a component suspended before `notFound()` executed — so
the same call site gives you either, depending on what sits above it.

**★ What starts the stream, exactly?**
Either a Suspense fallback rendering — a `loading.tsx` counts — or a component suspending under a
`<Suspense>` boundary. Once either happens the status line and headers have been sent.

**★ Where must the existence check go to get a real 404, and what does it cost?**
Before any `await` that can suspend and before any Suspense boundary — the documented pattern is
a fast existence check at the top of the page component, with the expensive render inside a
boundary below it. The cost is an extra query on every request, including the successful ones,
which is why it is worth it for public crawlable content and usually not behind authentication.

**★ If the status has to be 200, is the page indexed?**
No. Next.js injects `<meta name="robots" content="noindex">` into the streamed HTML. Some
crawlers still label the response a "soft 404" because they classify on status, but the guide is
explicit that this *"does not lead to indexation because the page is explicitly marked `noindex`
in the HTML."*

**★ What happens to `redirect()` called mid-stream?**
It becomes a client-side redirect instead of an HTTP one. Users with JavaScript still arrive at
the destination; there is no `Location` header and no `3xx` in the logs, and a client that does
not execute JavaScript stays where it was.

**★ Your route needs a genuine 404 status but the check requires a database read you cannot make
cheap. What are the options?**
Move the decision earlier in the request lifecycle. `proxy` and `next.config.js` redirects both
run before rendering, so a real status is still available — but the guidance is to keep proxy
checks fast and avoid fetching full content there, so this works when the check can be reduced
to something narrow, such as a lookup keyed by ID against a cache. Otherwise the honest answer is
that a streamed route trades status fidelity for time-to-first-byte, and that trade should be
made explicitly.

**★ Someone adds `loading.tsx` to a route and the 404s become 200s. Whose bug is it?**
Nobody's — it is the documented consequence. Rendering a Suspense fallback commits the response,
so every path below it executes after the status was sent. It is worth knowing before the change
lands, because it is invisible in review: the diff adds a skeleton and silently changes the HTTP
behaviour of the whole route.

---

← [02 · Errors in streaming](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md) · **Next → [02c · What silently defeats streaming](02c-what-silently-defeats-streaming-in-production.md)**
