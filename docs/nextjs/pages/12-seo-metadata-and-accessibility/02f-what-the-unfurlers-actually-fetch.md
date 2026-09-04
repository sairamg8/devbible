---
title: "Your preview is stale because a scraper fetched the page once, keyed the image by URL and will not look again — and every debugger you reach for is also a cache-buster, which is why the bug disappears the moment you try to reproduce it"
sidebar_label: "02f · What the unfurlers fetch"
sidebar_position: 110
description: "The scraper as a client: which crawlers Next.js gives blocking metadata to, Meta's documented URL-keyed image cache, the 1 MB and few-seconds budgets, why the debugger fixes the bug it is meant to diagnose, and how to cache-bust a generated OG image deliberately."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Meta's
> [Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/)
> (page states *Updated: Jun 30, 2026*) and
> [Meta Web Crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/)
> (*Updated: May 21, 2026*); the Next.js
> [`htmlLimitedBots` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots)
> (`lastUpdated: 2025-10-03`); and the framework source
> [`html-bots.ts`](https://github.com/vercel/next.js/blob/v16.3.4/packages/next/src/shared/lib/router/utils/html-bots.ts)
> **read at tag `v16.3.4`**.
> ⚠️ **X/Twitter is not sourced here** — `docs.x.com` returned 404 for the Cards path on this date.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**Every other page in this chapter is about producing correct tags. This one is about the only consumer that matters and how badly it behaves: a scraper that fetched your URL once, cached what it found — including the image, keyed by URL — and has no reason to come back. The tags being right is necessary and not sufficient. The stale preview that will not go away, the image that never updates after a redeploy, the unfurl that works in Slack and not in a chat app you have never heard of: all of them are cache and budget problems in someone else's infrastructure, and there are exactly two levers you hold.**

## Which scrapers get which rendering path

[01e](01e-streaming-metadata-and-html-limited-bots.md) establishes that a dynamically-rendered route streams its metadata into `<body>` unless the requester is an **HTML-limited bot**, which gets a blocking render with the tags in `<head>`. The bank of that page could not settle the full list from the documentation, which names only four examples. The framework source settles it.

Read at tag `v16.3.4` — its own comment first:

> *"This regex contains the bots that we need to do a blocking render for and can't safely stream the response due to how they parse the DOM."*

```ts
// packages/next/src/shared/lib/router/utils/html-bots.ts — v16.3.4
export const HTML_LIMITED_BOT_UA_RE =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i
```

Three readings of that list are worth having:

1. 🔴 **Every unfurler you care about is in it** — `facebookexternalhit`, `Twitterbot`, `Slackbot`, `Discordbot`, `LinkedInBot`, `WhatsApp`, `SkypeUriPreview`. So the streaming-metadata change did not break link previews, and *"my Slack unfurl still works"* is a User-Agent match, not luck.
2. **`Chrome-Lighthouse` is in it.** A Lighthouse run therefore exercises the *blocking* path, not the streamed one. If you are auditing to find out what a streaming crawler sees, Lighthouse is the wrong instrument.
3. **Anything not in the list gets the streamed response**, tags appended to `<body>`. A new chat platform's scraper, an internal link-preview service, a monitoring probe with a custom UA — none of them are here.

The list is what `htmlLimitedBots` **replaces**, not extends. That is the trap [01e](01e-streaming-metadata-and-html-limited-bots.md) covers in full, and it is worth restating in one line because the cost is high: setting `htmlLimitedBots` to add one agent removes all twenty-six.

## The scraper is a hostile HTTP client

Meta's crawler documentation is the most specific public statement of what an unfurler will and will not tolerate, and every constraint in it generalises.

> *"Any Open Graph properties need to be listed before the first 1 MB of your website or app, or it will be cutoff."*

A megabyte of HTML before the tags sounds impossible until you remember that a Server Component tree inlines its RSC payload into the document. On a data-heavy page it is not impossible at all. Because `facebookexternalhit` is an HTML-limited bot, its tags are in `<head>` and therefore near the top — that is the mechanism protecting you, and it is worth understanding as a mechanism rather than a coincidence, because it stops protecting you the moment someone sets `htmlLimitedBots` and removes it from the list.

> *"Ensure that the content can be crawled by the crawler within a few seconds or Facebook will be unable to display the content."*

A slow `generateMetadata` is not just a TTFB problem. For an HTML-limited bot the render *blocks* on it, so a 4-second database call in a metadata function is 4 seconds of the scraper's patience spent before a single tag exists.

> *"For your website to be shared correctly by our crawler, your server must also use the gzip and deflate encodings."*

Almost always already true, and the exception is a self-hosted deployment behind a proxy someone configured to strip `Accept-Encoding`.

The docs also give you their own reproduction command, which is worth keeping because it is *their* description of *their* client rather than your guess at it:

```bash
curl -v --compressed \
  -H "Range: bytes=0-524288" \
  -H "Connection: close" \
  -A "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" \
  "https://sprintdesk.app/blog/hello"
```

Note the `Range` header. The crawler asks for the first 512 KB and the docs say your server should either honour it or ignore it — a server that responds to a `Range` request incorrectly is a failure mode that will never show up in a browser.

## The stale preview, and the one sentence that explains it

> *"Images are cached based on the URL and won't be updated unless the URL changes."*

That is the whole thing. Not "cached for a while", not "cached with a TTL you can influence" — **keyed by URL, updated only when the URL changes.** Alongside it:

> *"To update an image after it's been published, use a new URL for the new image."*

So the failure is now fully explicable. You redeploy with a new OG image at the same path, share the link, and get the old picture. Your HTML is correct. Your CDN is correct. The scraper is doing exactly what it documented.

**Two levers, and only two.**

**Lever one — change the URL.** For a static image, this means putting a version in the path or query:

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost((await params).slug)
  return {
    openGraph: {
      images: [
        {
          // the URL changes when the post's content changes
          url: `/blog/${post.slug}/og.png?v=${post.updatedAt.getTime()}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  }
}
```

The version token must be derived from something that changes when the image should change — a content timestamp, a content hash — and **not** from the deploy, or every deploy invalidates every preview and you have simply moved the problem.

⚠️ This lever is not available in the same way when the image comes from the file convention, because Next.js generates that URL. If you need explicit version control over the OG image URL, that is a reason to use `metadata.openGraph.images` with a URL you construct rather than the file convention — one of the few cases where the config object beats the file.

**Lever two — ask the platform to re-scrape.** Meta's Sharing Debugger does this as a side effect:

> *"The debugger also triggers a scrape of your page"*

which is the reason for the maddening experience in the heading of this page: you paste the URL into the debugger to find out why the preview is stale, the debugger re-scrapes, the preview is now correct, and you have learned nothing except that the cache existed. **If you are diagnosing rather than fixing, `curl` with the crawler's User-Agent first, debugger second.** The order matters and it is the single most useful habit in this area.

## A debugging order that actually converges

1. **`curl -A` with the real crawler UA.** Does the tag exist in the response at all? This separates "my HTML is wrong" from "the platform is stale" before you touch anything else. Do this *before* any debugger.
2. **Is the tag in `<head>` or `<body>`?** If it is in the body for a UA that is in the list above, something is overriding `htmlLimitedBots`.
3. **Fetch the image URL directly.** A 404, a redirect, or a `Content-Type` of `text/html` from an error page all produce "no image" with a perfectly valid `og:image` tag.
4. **Compare the image URL to the one in the stale preview.** Same URL means the cache is doing what it documented; different URL means the platform has not re-fetched the *page* yet, which is a different problem.
5. **Only now, the platform debugger** — to force the re-scrape, having already learned what you needed.

## What is not asserted here

**X/Twitter's cache behaviour, its Card Validator's current URL and its rendering rules are not sourced on this page.** The documentation path returned 404 when this was written. The `twitter:*` tags Next.js emits are documented ([02b](02b-twitter-cards-and-the-companion-blocks.md)); what X does with them is not, and inventing a cache duration would be worse than the gap.

Similarly, **Slack, Discord and LinkedIn cache durations are not stated** anywhere primary that this page could verify. The safe operating assumption for all of them is the one Meta documents explicitly: assume the image is cached by URL indefinitely, and make the URL change when the image should.

## Gotchas

**★ You fixed the OG image, redeployed, and the preview is still the old picture.** The image is cached by URL and the URL did not change. Fix: put a content-derived version token in the image URL — `?v=${post.updatedAt.getTime()}` — not a deploy-derived one.

**★ You pasted the URL into the Sharing Debugger and the bug vanished.** The debugger triggers a scrape, so it fixed the symptom before you diagnosed it. Fix: `curl -A "facebookexternalhit/1.1 …"` first, every time; the debugger is a remediation tool, not a diagnostic one.

**★ Your `og:image` tag is present and correct and the preview has no image.** The tag names a URL; nothing checks that the URL serves an image. A 404 page returning `text/html` with a 200 status is the classic version. Fix: fetch the image URL itself and check the status *and* the `Content-Type`.

**★ A preview works in Slack and not in a newer chat app.** That app's scraper is not in the HTML-limited bot list, so it received the streamed response with the tags in `<body>` — and it only parses `<head>`. Fix: this is exactly what `htmlLimitedBots` is for, but adding the agent **replaces the whole default list**, so you must re-include every agent you still care about, or disable streaming metadata for the route.

**★ Adding one bot to `htmlLimitedBots` broke every other unfurl.** Same mechanism, worse blast radius: the config overrides rather than extends. Fix: either compose your regex to include the twenty-six defaults, or use `htmlLimitedBots: /.*/` to opt every requester into blocking metadata and accept the TTFB cost.

**★ Metadata streams into `<body>` and a crawler with a 1 MB budget never reaches it.** Only relevant for a UA outside the list, but it is the interaction that makes streaming metadata genuinely risky for a heavy page. Fix: for routes whose previews matter commercially, prefer static metadata so nothing streams at all.

**★ A metadata function that takes four seconds makes the scraper give up.** Meta documents "within a few seconds". An HTML-limited bot gets a blocking render, so the whole document waits on your metadata query. Fix: cache the metadata query independently of the page's data, so a slow page does not become a slow *head*.

**★ A `Range: bytes=0-524288` request returns the wrong thing.** The crawler sends one, and the docs say the server must honour it or ignore it — a proxy that mishandles ranges breaks unfurls only, and only for that crawler. Fix: reproduce with the documented `curl` including the `Range` header before blaming your application.

**★ Your preview shows a login page.** The scraper is anonymous. Any route behind auth, or behind a preview-deployment protection, unfurls as whatever the anonymous response is. Fix: make sure the URL you are sharing is public, and remember that a protected preview deployment can never produce a correct preview by design.

**★ The preview is correct on production and wrong from a staging link someone shared.** The staging deployment has its own `metadataBase` (or none), so its `og:image` points at staging, and the platform has now cached *that* image against the staging URL. Fix: keep previews out of the index and out of chat — [03b](03b-robotsts-and-the-crawl-directives.md) covers the environment-driven `robots.ts` that does the first half.

## Interview questions

**★ Why does a stale social preview persist after a correct redeploy, and what are your options?**
Because the platform keyed the image by URL and, in Meta's own words, will not update it unless the URL changes. Nothing about your deployment — new build, purged CDN, changed headers — alters that key. There are exactly two levers: change the image URL, ideally with a token derived from the content's own updated-at so it changes when it should and only then; or force a re-scrape through the platform's debugger, which is manual and does not scale. The one thing that never works is waiting.

**★ You are told "the OG tags are missing" for a new chat platform's link preview but Slack works fine. Where do you look?**
At the User-Agent, not at the metadata. Next.js gives a blocking render — tags in `<head>` — only to agents matching its HTML-limited-bots regex, and every well-known unfurler is in it. A newer scraper is not, so it receives the streamed response with the tags appended to `<body>`, and if it only parses `<head>` it sees nothing. The confirmation is a single `curl` with that agent's UA string. The fix is `htmlLimitedBots`, with the loud caveat that it replaces the default list rather than extending it.

**★ What is wrong with using the deploy ID as the cache-busting token on an OG image URL?**
It changes on every deploy, including deploys that did not touch that page. Every existing share therefore points at an image URL that the platform has never seen, so every preview is re-fetched — and until it is, the old cached image is still what people see, because the *page* has not been re-scraped either. You get maximum churn with no improvement in freshness. The token has to be derived from the content the image depicts.

**★ Someone reports that a debugger shows the correct preview but the real share is wrong. Is that possible?**
Yes, and it is the normal state of things rather than an anomaly. The debugger triggers a fresh scrape, so it shows you the *current* state of your page; the share shows the *cached* state from whenever the URL was first seen. They are answering different questions. It also means a debugger screenshot is not evidence that users are seeing the right thing — only a fresh share of that exact URL is.

**★ Your OG image is generated per-post and the pages are dynamically rendered. What is the worst-case cost profile?**
Every scrape of every share triggers a render of the page's metadata and, if the image handler is also dynamic, a Satori render of a PNG. Scrapes are not once per URL — platforms re-scrape, and every re-share by a new user can trigger one. The mitigation stack is: make the metadata static or cached so the head is cheap; make the image handler statically optimised, or give it explicit long-lived cache headers through `ImageResponse`'s `headers` option ([02e](02e-imageresponse-and-its-hard-limits.md)); and accept a static per-section image for the long tail where per-post branding earns nothing.

{/* FOOTER */}
