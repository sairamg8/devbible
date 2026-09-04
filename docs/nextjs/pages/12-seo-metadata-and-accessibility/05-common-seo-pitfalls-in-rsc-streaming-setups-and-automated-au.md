---
title: "Streaming sends the status code before it knows the answer, so a 404 in the App Router is a 200 with a `noindex` tag in the body — and the SEO pitfalls of an RSC app are almost all consequences of that one ordering fact"
sidebar_label: "05 · SEO pitfalls in RSC apps"
sidebar_position: 5
description: "Why crawlers no longer need SSR arguments, the streamed-404 status code and the noindex Next.js inserts, when the response body starts streaming and where notFound() must go, the shell-versus-request-time-data trap, and the client-only content crawlers do get."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`loading.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading),
> section *Status Codes* (page `lastUpdated: 2026-06-08`), the
> [`not-found.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
> (`2026-07-10`), and
> [Google Search Central — *Block Search indexing with `noindex`*](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
> Crawler rendering behaviour is cross-referenced to
> [05 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md),
> which quotes the primary source.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no output blocks.

**Almost every SEO surprise in an App Router application traces back to one ordering fact: to start streaming a response you must first send the headers, and once the headers are sent the status code cannot change. That is why a not-found page in a streamed route returns 200, why `notFound()` has to be called before anything suspends, and why Next.js inserts a `noindex` tag into the body of a streamed 404 — a workaround for a constraint of the transport, not a design choice about SEO. Meanwhile the argument people spend most energy on, "can crawlers see React", has been settled for years and in a direction most teams have not updated for.**

## Start by retiring the argument you did not need to have

The framework detects crawlers by User-Agent and renders the whole page dynamically for them rather than serving the static shell. The primary quote is banked in [05 · 03b](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md):

> *"Browsers receive the static shell instantly. Bots and crawlers are detected by their user agent and handled differently: because they need a complete document, Next.js skips the shell and renders the entire page dynamically at request time, then sends the finished HTML once the render completes."*

So a crawler gets the finished document, not a skeleton. Which means:

- 🔴 **"We need SSR for SEO" is not an argument about your rendering strategy.** PPR, streaming and a static shell are all fine for crawlers. What matters is whether the *content* can be produced at all when the request comes from a bot.
- **`loading.tsx` skeletons are not what a crawler indexes.** The fallback is a browser-path artefact.
- **Client-only content is still invisible in the initial HTML** — the crawler executing JavaScript is a separate question from the framework's bot handling, and one you do not control.

That same page carries the trap that replaces the old one:

> *"If part of your shell depends on inputs that only exist while prerendering, such as build-time data or values that are not reachable in the request-time environment, a page that loads for a person can fail to render for a crawler."*

Read that carefully, because it is the sharpest new failure in this area: **a page that works for every human can fail for every bot.** The shell was prerendered with a build-time value; the crawler's render is a *request-time* render, in which that value does not exist. Nothing in your logs distinguishes this from a normal error, and no browser visit reproduces it.

## The status code, and why it cannot be what you expect

> *"When streaming, a `200` status code will be returned to signal that the request was successful."*

> *"Because the response headers have already been sent to the client, the status code of the response cannot be updated."*

And the specific consequence for `notFound()`:

> *"Next.js will return a `200` HTTP status code for streamed responses, and `404` for non-streamed responses"*

So the same `notFound()` call produces a 404 or a 200 depending on whether anything suspended first. That is not a bug you can configure away; it is HTTP.

Next.js compensates in the body:

> *"For example, when a 404 page is streamed to the client, Next.js includes a `<meta name="robots" content="noindex">` tag in the streamed HTML. This prevents search engines from indexing that URL even if the HTTP status is 200."*

> *"Some crawlers may label these responses as "soft 404s". In the streaming case, this does not lead to indexation because the page is explicitly marked `noindex` in the HTML."*

⚠️ **Note the scope of that reassurance.** It says indexation does not follow, and it says nothing about crawl budget, about analytics, or about any consumer that reads status codes rather than HTML — a monitoring probe, a link checker, a partner's ingestion pipeline. If you have a compliance or analytics requirement for a real 404, the docs tell you what it costs:

> *"If you need a 404 status, for compliance or analytics, ensure the resource exists before the response body is streamed, so that the server can set the HTTP status code."*

## When does the body start streaming?

This is the operational half, and the docs answer it precisely:

> *"The response body starts streaming when a Suspense fallback renders (for example, a `loading.tsx`) or when a Server Component suspends under a `Suspense` boundary. Place `notFound()` before those boundaries and before any `await` that may suspend."*

> *"To start streaming, the response headers must be set. This is why it is not possible to change the status code after streaming started."*

Which gives a concrete rule for where the existence check goes:

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // ✅ The existence check happens before anything can suspend,
  //    so the server can still set a real 404.
  const post = await getPost(slug)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <Suspense fallback={<CommentsSkeleton />}>
        {/* Slow, and it may stream — but the status is already decided */}
        <Comments postId={post.id} />
      </Suspense>
    </article>
  )
}
```

```tsx
// 🔴 The mirror image: the check is inside the boundary, so it 200s
export default async function Page({ params }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <PostBody params={params} /> {/* calls notFound() after suspending */}
    </Suspense>
  )
}
```

The second form is not *wrong* — the `noindex` still protects the index — but you have given up the status code, and you gave it up by accident rather than by choice.

If the check itself is what is slow, the docs offer the escape hatch:

> *"You can run this check in `proxy` to rewrite missing slugs to a not-found route, or produce a 404 response. Keep proxy checks fast, and avoid fetching full content there."*

A proxy check runs before rendering, so it can set the status. The caution in that same sentence — keep it fast, do not fetch full content — is the whole trade: you are moving work into a place that runs on every request to that route.

## `noindex` and the crawl block that cancels it

The Next.js mechanism depends on a crawler *reading* the page. Google's own rule:

> *"For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file, and it has to be otherwise accessible to the crawler."*

🔴 **So a `Disallow` covering the same path range as your not-found route defeats the framework's own protection.** The crawler is told not to fetch, never sees the `noindex`, and can list the URL from inbound links. This is the two-switch trap from [03b](03b-robotsts-and-the-crawl-directives.md), arriving from an unexpected direction — you did not write the `noindex`, the framework did, and you disabled it with an unrelated file.

## The four remaining pitfalls

**1 · Metadata in the body.** A dynamically-rendered route appends its metadata tags to `<body>` rather than `<head>`, unless the requester matches the HTML-limited bot list. That list is enumerated at v16.3.4 in [02f](02f-what-the-unfurlers-actually-fetch.md); the mechanism is [01e](01e-streaming-metadata-and-html-limited-bots.md). The pitfall is not the position — it is assuming a `curl` with a default User-Agent tells you what a crawler sees.

**2 · Static export cannot stream at all.** The `loading.js` platform-support table lists static export as **not supported** for streaming. Everything above about status codes is therefore irrelevant on a static export, and a whole class of behaviour differs between your deployment targets.

**3 · The buffering floor.** > *"Some browsers buffer a streaming response. You may not see the streamed response until the response exceeds 1024 bytes."* This is a browser behaviour, not a crawler one, and it matters mostly because it makes a small reproduction of a streaming bug behave differently from the real page.

**4 · The shell/request-time split, again.** It is worth stating twice because it is the failure with no visible symptom: anything the shell needs must exist at request time as well as build time, or the page renders for humans and fails for bots.

## Gotchas

**★ Your 404 pages return 200 and someone reports it as a bug.** They are streamed, and headers were sent before `notFound()` ran. Fix: call `notFound()` before any `await` that can suspend and before any Suspense boundary; if the check is inherently slow, do it in `proxy` instead.

**★ Search Console reports soft 404s.** The URLs are streamed 200s. The docs say this does not lead to indexation because Next inserts `<meta name="robots" content="noindex">`, so the report is informational — but check that a `Disallow` is not preventing the crawler from reading the tag.

**★ A `Disallow` cancels the framework's own `noindex`.** Google requires the page be crawlable for `noindex` to work. Fix: do not block the paths your not-found route serves.

**★ The whole site renders for people and fails for Googlebot.** The shell depended on a build-time value that does not exist at request time, and the crawler gets a request-time render. Fix: audit anything the shell reads for request-time availability — and reproduce with a crawler User-Agent, which is the only way to see it.

**★ You tested with `curl` and the metadata was in the body, so you assumed crawlers see it there too.** The default `curl` agent matches nothing in the HTML-limited bot list. Fix: `curl -A` with a real crawler agent.

**★ Analytics shows heavy traffic to a URL that "does not exist".** It is returning 200, so every counting system treats it as a page view. Fix: if the number matters, get a real 404 via the proxy check; otherwise stop counting on status alone.

**★ A monitoring probe reports the site as healthy while every product page 404s.** Streamed 200s again. Fix: probe on content, not status — assert an expected element or an absence of the `noindex` tag.

**★ Streaming works locally and not on your deployment target.** Static export does not support streaming at all, per the platform-support table. Fix: know which target you are on; the behaviour difference is by design, not a misconfiguration.

**★ A tiny reproduction behaves differently from the real page.** Some browsers buffer until the response exceeds 1024 bytes. Fix: reproduce against a realistic page, or add padding to get past the floor before drawing conclusions.

**★ `loading.tsx` content appears in a search result snippet.** That would mean the crawler indexed the fallback — which the framework's bot handling exists to prevent, since bots are given a full dynamic render. Fix: verify the User-Agent handling is actually in play on that deployment before redesigning anything; treat this as a signal that something upstream is serving the shell to bots.

**★ You "fixed" the status code by disabling streaming everywhere.** It works and it costs you TTFB and LCP on every dynamic route for a problem that affected a handful of URLs. Fix: move the existence check earlier, or into the proxy, and leave streaming on.

## Interview questions

**★ Why does a 404 in the App Router often return a 200 status?**
Because streaming requires the response headers to be sent before the body, and once they are sent the status cannot be changed. If anything suspends — a `loading.tsx` fallback rendering, or a Server Component suspending under a Suspense boundary — the headers are already out when `notFound()` runs, so the response is a 200 carrying the not-found UI. Next.js compensates by inserting `<meta name="robots" content="noindex">` into the streamed HTML, which the documentation says prevents indexation despite the status. The docs are equally clear about the escape: to get a real 404, the resource check must complete before the body starts streaming.

**★ Where exactly must `notFound()` be called to preserve the status code?**
Before any `await` that may suspend and before any Suspense boundary — the docs state that directly. In practice that means the existence check is the first thing the page component does, ahead of the boundaries that wrap slower sections. If the check itself is too slow to sit in the critical path, the documented alternative is to run it in `proxy`, which executes before rendering and can therefore rewrite to a not-found route or produce a 404 response outright — with the caveat, also documented, that a proxy check must be fast and must not fetch full content.

**★ "We need server rendering for SEO." What is wrong with that framing in 2026?**
It answers a question that is already settled. Next.js detects crawlers by User-Agent and, rather than serving the static shell, renders the entire page dynamically and sends the finished HTML once it completes — so a bot gets a complete document regardless of whether the human path is static, streamed or partially prerendered. The real question is different and sharper: is everything the page needs available *at request time*? The documented failure is a shell that depends on build-time inputs unreachable in the request-time environment, which renders fine for every human and fails for every crawler — and nothing in your monitoring distinguishes that from an ordinary error.

**★ A `robots.txt` `Disallow` and a framework-inserted `noindex` are both in play. What happens?**
The `noindex` is defeated. Google's documentation states that for `noindex` to be effective the page must not be blocked by robots.txt and must be accessible to the crawler; a blocked URL is never fetched, so the tag is never read, and the URL can still be listed from inbound links. What makes this case nasty is that you did not write the `noindex` — Next.js inserted it into a streamed 404 — so the interaction is between a framework behaviour and a config file that nobody edited together. The rule stands: never block the paths whose indexing you are controlling with a meta tag.

**★ How would you monitor for the shell/request-time-data failure?**
Not with a normal uptime probe, because the page renders fine for a browser User-Agent. You need a check that requests key routes with a crawler agent — one that matches the HTML-limited bot regex, so you get the blocking path — and asserts on content rather than status: a known element, the presence of the expected `<title>`, the absence of `<meta name="robots" content="noindex">`. That single check catches the crawler-only render failure, the streamed-404-as-200 case and metadata that failed to resolve, all of which return 200 with a plausible-looking body.

**★ Someone proposes disabling streaming metadata site-wide to make debugging simpler. Argue both sides.**
For: it makes every response's `<head>` complete before the body, so `curl` with any User-Agent shows the truth, and any scraper outside the bot list gets tags where it expects them — which is the correct fix if you have a real consumer that only parses `<head>`. Against: the documentation is explicit that the blocking path costs TTFB, because the whole document waits on `generateMetadata`, and that cost lands on every dynamically rendered route including the ones no crawler visits. The proportionate move is to fix the specific case — add the agent, or make that route's metadata static — and keep streaming for everything else.

{/* FOOTER */}
