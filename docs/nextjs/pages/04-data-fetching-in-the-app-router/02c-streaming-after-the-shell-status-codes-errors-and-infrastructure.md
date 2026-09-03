---
title: "The moment the first chunk leaves the server the status code is `200` and the headers are gone — so `notFound()`, `redirect()` and every thrown error after that point are handled inside the HTML, and half of production streaming bugs are a proxy that buffered the whole thing anyway"
sidebar_label: "02c · streaming after the shell"
sidebar_position: 10
description: "What happens once streaming has started: the committed HTTP status code, notFound and redirect mid-stream, error.js boundaries interacting with Suspense, bots and blocking metadata, and every layer that can buffer a streamed response."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Streaming](https://nextjs.org/docs/app/guides/streaming) (docs `lastUpdated` 2026-08-25), [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) (`lastUpdated` 2026-06-08) and [`<Suspense>`](https://react.dev/reference/react/Suspense) on react.dev.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Streaming is a trade you make with HTTP, and the price is paid up front: to send the first chunk the server must send the response headers, and once they are sent nothing can change them. Every surprise in this page descends from that one constraint — why a streamed 404 is a `200`, why a mid-stream `redirect()` becomes a client-side navigation, why an error after the shell replaces a section rather than the page, and why a crawler gets a completely different response from a browser. Then there is the other half, which is not about your code at all: a reverse proxy, a CDN, a compression layer or a serverless platform that buffers the response undoes all of it, and the page still works, so nobody notices for months.**

## When the response body actually starts streaming

The trigger is precise: the body begins streaming when a Suspense fallback renders — for example a `loading.tsx` — or when a component suspends under a `<Suspense>` boundary. To start streaming, the response headers must be set. That is the whole mechanism, and everything below is a consequence.

If a route has no boundary and nothing suspends, nothing streams, and the server is free to set whatever status it likes because it is still holding the response.

## `notFound()` and `redirect()` after the shell

When a `notFound()` fires mid-stream, Next.js cannot go back and change the status to `404`. Instead it injects a `robots` meta tag with `noindex` into the streamed HTML so search engines do not index the page. Google may label such responses **soft 404s**, but in the streaming case that does not lead to indexation, because the page is explicitly marked `noindex` in the HTML.

A `redirect()` mid-stream becomes a **client-side** redirect rather than an HTTP redirect header, for the same reason.

If you need a real `404` — for compliance, for analytics, or because a crawler's behaviour matters — the resource must be checked before the response body is streamed:

```tsx
// app/post/[slug]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PostContent } from './post-content'

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // fast existence check, no boundary above it
  if (!exists) notFound()                    // real 404 — nothing has streamed yet

  return (
    <Suspense fallback={<PostSkeleton />}>
      <PostContent slug={slug} />            {/* the expensive load streams */}
    </Suspense>
  )
}
```

Note the tension with everything [02b](02b-where-to-put-boundaries-loading-js-and-granular-streaming.md) argued for. Pushing every `await` down maximises the static shell; putting a cheap existence check *above* the first boundary is deliberately doing the opposite, in exchange for a correct HTTP status. Make that trade knowingly, and keep the check cheap — it blocks the response.

The alternative placement is earlier still. A [`proxy`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) or a `next.config.js` redirect runs before the page renders, so real status codes are still available there. The documented caveat is to keep proxy checks fast and avoid fetching full content in them.

## Errors after the shell has flushed

If a component throws after streaming has started, the nearest `error.js` boundary catches it and renders the error UI **in place of the failed component**. The rest of the page remains intact; only the section that errored is replaced. The status code is still `200`, because it was committed with the first chunk, and the error is handled entirely within the streamed HTML.

This is the interaction to hold in your head: **a `<Suspense>` boundary decides what streams; an `error.js` boundary decides what a failure replaces.** They are different boundaries with different granularity, and `loading.js` does not wrap the `error.js` of its own segment.

```tsx
// app/dashboard/recommendations/error.tsx
'use client'

export default function RecommendationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div role="alert">
      <p>Recommendations are unavailable right now.</p>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

Place the `error.js` at the segment whose failure you want contained. An `error.js` only at the root means any failure anywhere replaces the whole route's content, which is rarely what a dashboard wants: the revenue card failing should not take the orders table with it.

There is a second, quieter failure mode. If a fallback itself suspends while rendering, it activates the closest **parent** boundary — so a "skeleton" that fetches something escalates the fallback one level up, and the section you were protecting disappears into a bigger one. Keep fallbacks synchronous and dumb.

## What happens when a boundary suspends *again*

On the initial server stream a boundary shows its fallback once and then resolves. On the client, a boundary that has already displayed content can suspend again — a transition, a re-render with new data — and React's rules are specific.

- If a boundary was displaying content and suspends again, the fallback is shown again **unless** the update was caused by `startTransition` or `useDeferredValue`. That is the mechanism behind "the page flashed a skeleton when I changed a filter", and the fix is to mark the update as a transition.
- React does not preserve state for renders that suspended before they were able to mount for the first time; when the component loads, it retries rendering the suspended tree from scratch.
- If React has to hide already-visible content because it suspended again, it cleans up layout effects in that content tree and fires them again when the content is shown once more.
- React reveals suspended content at most once every 300 ms, measured from the last reveal — so several boundaries finishing together arrive as a short cascade rather than simultaneously.

```tsx
'use client'

import { useTransition, useState } from 'react'

export function FilterBar({ onChange }: { onChange: (v: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState('')

  return (
    <input
      value={value}
      data-pending={isPending}
      onChange={(e) => {
        setValue(e.target.value)
        // Without startTransition, the results boundary re-shows its fallback.
        startTransition(() => onChange(e.target.value))
      }}
    />
  )
}
```

## Bots, metadata and SEO

Streaming does not hurt SEO, and the docs say so directly: because streaming is server-rendered, it does not affect SEO, and Google's Rich Results Test will show you the serialized HTML the crawler sees. What *does* differ is who gets a stream at all.

- **HTML-limited bots** — crawlers that scrape static HTML without executing JavaScript, Twitterbot being the named example — need metadata in the `<head>` of the initial HTML. Next.js detects them by user agent and resolves `generateMetadata` **before** streaming, so they receive one fully formed document rather than a stream.
- **Full browsers and DOM-capable crawlers** may instead receive streaming metadata alongside the page content. The detection is automatic, and which bots get the blocking treatment is configurable with `htmlLimitedBots`.

🔴 Under Cache Components there is a trap worth naming. Visitors and DOM-capable crawlers receive the prerendered shell immediately without re-running the code that produced it. HTML-limited bots skip the shell and render the page dynamically. So if the shell depends on inputs that only exist while prerendering — build-time data, values unreachable in the request-time environment — a page that loads perfectly for a person can **fail to render for a crawler**. Make sure anything the shell relies on is also available at request time.

## Everything between you and the browser that buffers

The HTML can be generated progressively and still arrive as one lump, because any intermediate layer that collects chunks defeats it. This is the most common reason streaming "does not work in production".

**Reverse proxies.** Nginx and similar buffer responses by default. The documented fix is the `X-Accel-Buffering: no` header:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ]
  },
}
```

**CDNs.** May buffer entire responses before forwarding. Some require specific configuration or plan tiers to pass chunked responses through; check the provider's documentation.

**Serverless platforms.** Not all support streaming. AWS Lambda requires response streaming mode to be explicitly enabled — it is not the default. Vercel supports streaming natively.

**Compression.** Gzip and Brotli buffer internally because the algorithm needs enough data to compress efficiently, which adds latency to the first visible chunk.

**The client.** WebKit buffers a streaming response until 1024 bytes have been received, so tiny responses paint at once. Real pages exceed that immediately. `curl` buffers too; `-N` disables output buffering but it still relies on newlines to flush lines to the terminal, so a newline-free stream can appear to stall.

**Static export** does not support streaming at all. Node.js servers and Docker containers do; adapters are platform-specific.

To confirm the response is genuinely chunked, the docs point at Chrome DevTools: select the document request and look at the Timing breakdown — an early Time to First Byte with a long Content Download phase is the signature of a streamed response. They also give a small Node script that reads `res.body.getReader()` and logs chunk arrival times, sending `Accept-Encoding: identity` so the compression layer does not buffer.

## Gotchas

**★ Symptom: a missing page returns HTTP `200` and your monitoring shows no 404s at all.** Cause: `notFound()` fired after streaming had begun, and the status was committed with the first chunk. Next.js injects a `noindex` robots meta tag instead. Fix: do the existence check before any `await` that can suspend and before any boundary.

```tsx
const { slug } = await params
const exists = await checkSlugExists(slug)
if (!exists) notFound()                     // still holding the response
return (
  <Suspense fallback={<Skeleton />}>
    <Body slug={slug} />
  </Suspense>
)
```

**★ Symptom: a `redirect()` inside a streamed component redirects, but analytics never sees a `3xx`.** Cause: after streaming starts, `redirect()` becomes a client-side redirect rather than an HTTP redirect header. Fix: redirect before the first boundary, or move the decision into `proxy` or a `next.config.js` redirect, both of which run before the page renders and can still set real status codes.

**★ Symptom: one failing widget replaces the entire dashboard with a full-page error.** Cause: the nearest `error.js` is at the root segment, so it is what catches the throw. Fix: add an `error.js` at the segment you want the failure contained to.

```tsx
// app/dashboard/recommendations/error.tsx
'use client'
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <button onClick={reset}>Reload recommendations</button>
}
```

**★ Symptom: a skeleton disappears and a *larger* skeleton appears in its place.** Cause: the fallback itself suspended while rendering, which activates the closest parent boundary. Almost always a "skeleton" component that fetches something — a shimmer that reads a theme from the server, an avatar placeholder that loads a default image server-side. Fix: fallbacks must be synchronous and self-contained.

```tsx
// pure markup, no data access of any kind
export function GridSkeleton() {
  return <div className="grid gap-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 rounded bg-gray-200" />)}</div>
}
```

**★ Symptom: streaming works in `next dev` and the production deployment sends the whole document at once.** Cause: an intermediate layer is buffering — nginx by default, a CDN, a compression layer, or a serverless platform without response streaming enabled. Fix: set `X-Accel-Buffering: no` for the proxy case, verify the CDN passes chunked responses, and on AWS Lambda enable response streaming mode explicitly.

**Symptom: changing a filter flashes the results skeleton every keystroke.** Cause: a boundary that was displaying content suspended again, and React shows the fallback again unless the update came from `startTransition` or `useDeferredValue`. Fix: wrap the state update that triggers the refetch in a transition, and use the pending flag for a subtle indicator instead.

**Symptom: a page renders for users and fails for a crawler after enabling Cache Components.** Cause: HTML-limited bots skip the prerendered shell and render dynamically, so any input the shell depended on that exists only at build time is unavailable to them. Fix: make everything the shell relies on reachable at request time too, and test with a bot user agent.

**Symptom: a component state resets when its boundary resolves.** Cause: React does not preserve state for renders that suspended before they mounted for the first time — when the content loads, it retries rendering the suspended tree from scratch. Fix: do not put state you need to survive inside a subtree that has not mounted yet; lift it above the boundary, or key it off something stable such as the URL.

**Symptom: a `useLayoutEffect` in streamed content fires twice.** Cause: when React hides already-visible content because it suspended again, it cleans up layout effects in that tree and fires them again when the content is shown once more. Fix: make layout effects idempotent, and return a real cleanup function rather than assuming a single invocation.

**Symptom: a hello-world route does not stream and you conclude the setup is broken.** Cause: WebKit buffers streaming responses until 1024 bytes have arrived, and `curl` buffers by default. Fix: test on a page with a real layout, styles and scripts, or read chunks with a Node script sending `Accept-Encoding: identity` so compression does not hide the boundaries.

**Symptom: response headers set in a Server Component "do not apply".** Cause: once streaming begins the headers are already on the wire, and nothing after the first chunk can change them. Fix: set headers where they are still available — `next.config.js` `headers()`, `proxy`, or a Route Handler that is not streaming.

## Interview questions

**★ Why does a streamed 404 return HTTP `200`?**
Because the response headers, including the status code, are sent with the first chunk, and the first chunk goes out as soon as a Suspense fallback renders or a component suspends under a boundary. A `notFound()` that fires after that cannot retroactively change the status. Next.js compensates inside the body: it injects a `noindex` robots meta tag so search engines do not index the URL. Google may classify it as a soft 404, but with an explicit `noindex` it does not get indexed. If you need a genuine 404 status, the existence check has to run before any boundary or suspending `await` — or earlier still, in `proxy`.

**★ How do `error.js` and `<Suspense>` boundaries interact during streaming?**
They answer different questions. A `<Suspense>` boundary decides what streams independently and what fallback appears while it is pending. An `error.js` boundary decides what a thrown error replaces. If a component throws after streaming has started, the nearest `error.js` renders its UI in place of the failed component and the rest of the page stays intact — but the status code is still `200`, because it was committed with the first chunk. Note also that `loading.js` does not wrap the `error.js` of its own segment, and that placement of the `error.js` decides granularity: only at the root means any failure replaces the whole route.

**★ A skeleton is replaced by a bigger skeleton. What happened?**
The fallback suspended while rendering, and when a fallback suspends it activates the closest *parent* boundary. That escalates the loading state one level up and swallows the section you were trying to isolate. The cause is nearly always a fallback that is not purely presentational — one that fetches an image, reads a theme, or renders a component that does async work. Fallbacks must be synchronous markup.

**★ Why does streaming work in development and not in production?**
Because the code is not the variable — the network path is. Nginx buffers responses by default and needs `X-Accel-Buffering: no`. CDNs may buffer entire responses and some need specific configuration or plan tiers. AWS Lambda requires response streaming mode to be explicitly enabled. Gzip and Brotli buffer internally to compress efficiently. Any one of these turns a progressively-generated document into a single delayed one, and the page still works, so it is easy to ship. Verify with the DevTools Timing breakdown — early TTFB, long Content Download — or by reading the response body as a stream with compression disabled.

**★ Does streaming hurt SEO?**
No. Streaming is server-rendered, so the crawler receives real HTML, and the docs point at Google's Rich Results Test to confirm what is seen. The subtlety is that crawlers are not all served the same way: Next.js detects HTML-limited bots by user agent and resolves `generateMetadata` before streaming so their metadata is in the `<head>` of the initial document, while browsers and DOM-capable crawlers may receive streaming metadata. Which bots get blocking metadata is configurable with `htmlLimitedBots`. Under Cache Components there is an additional risk: HTML-limited bots skip the prerendered shell and render dynamically, so a shell that depends on build-time-only inputs can fail for them while working for everyone else.

**Changing a filter re-shows the loading skeleton on every keystroke. Why, and what fixes it?**
Because a boundary that was already displaying content and then suspends again shows its fallback again — unless the update that caused it was wrapped in `startTransition` or produced by `useDeferredValue`. Marking the state update as a transition tells React to keep the stale content visible while the new content is prepared, and gives you an `isPending` flag for a subtle indicator instead of a full skeleton flash.

**Why can you not set a response header from inside a streamed Server Component?**
Because streaming requires the headers to have been sent in order to begin the body, so by the time the component runs they are already on the wire. This is the same constraint that makes status codes uncontrollable mid-stream. Headers belong in `next.config.js`'s `headers()`, in `proxy`, or in a Route Handler that is not streaming — all of which run while the response is still being assembled.

**Why does React reveal streamed content on a throttle rather than instantly?**
React reveals suspended content at most once every 300 ms, measured from the last reveal. Without it, several boundaries finishing within a few milliseconds of each other would each trigger their own reflow and repaint, producing a visibly jittery page. The visible consequence is that a handful of sections arrive as a short cascade rather than all at once, which is a deliberate smoothing rather than a bug in your fetches.

**A component's state resets whenever its Suspense boundary resolves. Why?**
Because React does not preserve state for renders that suspended before they were able to mount for the first time — when the content loads, it retries rendering the suspended tree from scratch. Anything that was only ever in that subtree's memory is gone. State that must survive belongs above the boundary or in something durable like the URL. The related effect is layout effects: if React hides visible content because it suspended again, it cleans up layout effects in that tree and re-fires them when the content returns, so they need to be idempotent.

---

← [02b · where to put boundaries](02b-where-to-put-boundaries-loading-js-and-granular-streaming.md) · Next → [03 · static vs dynamic rendering](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md)
