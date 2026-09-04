---
title: "`robots.txt` controls crawling and cannot control indexing, so the file everyone reaches for to hide a page is the one file that guarantees the crawler never sees the `noindex` telling it to"
sidebar_label: "03b · robots.ts and crawl directives"
sidebar_position: 15
description: "The MetadataRoute.Robots type, the array form and its required userAgent, the 16.3 `other` field for non-standard directives, why Disallow is not noindex, and the environment-driven robots.ts that keeps a preview deployment out of the index."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`robots.txt` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
> (page `lastUpdated: 2026-05-01`), the
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> section *`robots`* (`2026-08-25`), and Google Search Central —
> [*Introduction to robots.txt*](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
> (*Last updated 2025-12-10 UTC*) and
> [*Block Search indexing with `noindex`*](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
> Version spine: **Next.js 16.3.4** · React 19.2.8 (`other` field is **16.3.0**). `next` is **not
> installed in this checkout** — documentation-verified only, **no sandbox run**.

**There are two independent switches and almost everyone conflates them. `robots.txt` says *do not fetch this*; a `noindex` meta tag says *do not list this*. They are not two ways to do the same thing — they interact, and the interaction is a trap that Google documents in a single sentence: a page blocked in `robots.txt` can still be indexed, because the crawler never fetched it and therefore never saw the `noindex` you put there to stop exactly that. This page is `robots.ts` as an API, the directives you can actually express in it, and the two-switch model that decides which one you should be reaching for.**

## The type

```tsx
type Robots = {
  rules:
    | {
        userAgent?: string | string[]
        allow?: string | string[]
        disallow?: string | string[]
        crawlDelay?: number
        other?: Record<string, string | number | Array<string | number>>
      }
    | Array<{
        userAgent: string | string[]
        allow?: string | string[]
        disallow?: string | string[]
        crawlDelay?: number
        other?: Record<string, string | number | Array<string | number>>
      }>
  sitemap?: string | string[]
  host?: string
}
```

🔴 **Look at the difference between the two branches.** In the single-object form `userAgent` is optional; in the array form it is **required**. That is deliberate — one rule with no agent is unambiguous, several rules with no agent are not — and it is the one type error you will hit when converting a single rule into an array.

```tsx
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/private/' },
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

Like `sitemap.ts`, this is *"a special Route Handler that is cached by default unless it uses a Request-time API or dynamic config option"* — and like `sitemap.ts`, `metadataBase` does not apply, so `sitemap` and `host` must be absolute URLs you build yourself.

## Per-agent rules fan out

```tsx
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: ['/'], disallow: '/private/' },
      { userAgent: ['Applebot', 'Bingbot'], disallow: ['/'] },
    ],
    sitemap: 'https://acme.com/sitemap.xml',
  }
}
```

produces:

```txt
User-Agent: Googlebot
Allow: /
Disallow: /private/

User-Agent: Applebot
Disallow: /

User-Agent: Bingbot
Disallow: /

Sitemap: https://acme.com/sitemap.xml
```

**One rule with an array of agents becomes several blocks, not one block with several agents.** That is the serialiser making a choice for you, and it is the safe one — group syntax in `robots.txt` is one of the more inconsistently implemented parts of the standard.

## `other` — non-standard directives, new in 16.3

Before 16.3 there was no way to emit `Request-Rate` or `Clean-param` from `robots.ts` at all; you had to abandon the code form and write a static file.

```tsx
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      {
        userAgent: 'SeznamBot',
        allow: '/',
        other: { 'Request-Rate': '10/1m' },
      },
    ],
  }
}
```

```txt
User-Agent: *
Allow: /

User-Agent: SeznamBot
Allow: /
Request-Rate: 10/1m
```

The rules, verbatim:

> *"Keys preserve their casing and array values emit one line per entry, scoped to the rule's `User-Agent` block."*

> *"Values in `other` are passed through verbatim. Next.js does not validate directive names or values, so refer to the target search engine's documentation for the exact syntax."*

🔴 **"Does not validate" means a typo ships.** `Crawl-Delay: ten` is emitted exactly as written and is simply ignored by every crawler. There is no feedback loop here at all — no build error, no runtime warning, and the only observable consequence is a directive that does nothing. If you are using `other`, the syntax check has to come from reading the target engine's own documentation, and it is worth a comment in the file naming which engine each key is for.

## The two switches, and the trap

This is the part that matters more than the API.

| | `robots.txt` `Disallow` | `<meta name="robots" content="noindex">` |
|---|---|---|
| Controls | whether the URL is **fetched** | whether the URL is **listed** |
| Delivered | one file, before any page fetch | in the page's own HTML, per route |
| In Next.js | `robots.ts` | `metadata.robots` |
| Removes an already-indexed page? | **No** | Yes, once re-crawled |

Google's own framing of the first column:

> *"This is used mainly to avoid overloading your site with requests; it is not a mechanism for keeping a web page out of Google."*

And the interaction, which is the actual trap:

> *"For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file, and it has to be otherwise accessible to the crawler."*

Read those together. **Disallowing a URL in `robots.txt` prevents the crawler from ever reading the `noindex` on it**, so a URL that is both disallowed *and* carries `noindex` can remain in the index indefinitely — typically as a bare URL with no snippet, because the engine knows the URL from inbound links but has never been permitted to fetch it. It is the worst of both outcomes.

Also worth knowing, because it appears in blog posts as a solution and is not one:

> *"Specifying the `noindex` rule in the robots.txt file is not supported by Google."*

**The correct pairing:**

- *"I do not want this crawled"* — because it is expensive, or infinite, or a search-results page with unbounded query permutations → `Disallow` in `robots.ts`.
- *"I do not want this in results"* → `metadata.robots` with `index: false` on the route, **and no `Disallow`**, so the crawler can fetch it and see the directive.
- *"It must not be in results and must not be crawled"* → `noindex` first, wait for it to drop out of the index, *then* add the `Disallow`.

## The per-route switch

```tsx
// app/dashboard/layout.tsx — nothing under /dashboard should be indexed
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}
```

Because metadata inherits, declaring this once in a layout covers the whole subtree — which is exactly the right granularity for an authenticated area, and the opposite of the `alternates.canonical` advice in [02b](02b-twitter-cards-and-the-companion-blocks.md), where inheritance is the bug.

## Keeping a preview deployment out of the index

This is the handoff [01d](01d-metadatabase-url-composition-and-the-parent-promise.md) makes: `metadataBase` gets the *URLs* right per environment, but it does nothing about a preview deployment being crawled at all. `robots.ts` is where that is solved, and because it is a function rather than a file, it can read the environment:

```tsx
// app/robots.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENV === 'production'

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/'] },
      { userAgent: 'GPTBot', disallow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
```

Three things about that:

- The environment variable is read at **module scope from a build-time variable**, so the handler stays static. Reading a request header instead would make it dynamic and hand every crawler a function invocation.
- 🔴 **`disallow: '/'` on a preview is a crawl block, not an index block** — by the table above, it is the *wrong* switch if the preview URL has already been shared and linked. The complete answer for a preview is platform-level protection (authentication on the deployment), with `robots.ts` as the belt to that braces.
- The `GPTBot` rule is included as a shape, not a recommendation. Whether to block AI crawlers is a policy decision; the mechanism is a `userAgent` string and a `disallow`, and the agent strings are published by each operator.

## Gotchas

**★ You disallowed a URL and it is still in search results.** `robots.txt` controls crawling, not indexing; an engine can list a URL it has never fetched if other pages link to it. Fix: remove the `Disallow`, add `robots: { index: false }` to that route's metadata, wait for a re-crawl, and only then consider blocking the crawl.

**★ You added both `Disallow` and `noindex` and nothing happened.** The crawler cannot fetch the page, so it never reads the `noindex`. This is documented explicitly by Google. Fix: the `noindex` alone, with the URL crawlable.

**★ You put `Noindex:` in `robots.txt`.** Not supported by Google. Fix: the meta tag or the `X-Robots-Tag` header; `metadata.robots` emits the former for you.

**★ Converting one rule into an array of rules fails to typecheck.** `userAgent` is optional in the single-object branch and required in the array branch. Fix: add `userAgent: '*'` to the rule you already had — which was implicit anyway.

**★ A `Crawl-delay` typo in `other` ships silently.** Values are passed through verbatim and nothing validates them. Fix: check the syntax against the target engine's documentation and leave a comment naming that engine beside the key, because nobody will re-derive it later.

**★ The preview deployment's sitemap points at production.** `robots.ts` returned the production `sitemap` URL because `BASE_URL` was hard-coded. Fix: derive both `sitemap` and `host` from the same environment variable that feeds `metadataBase`, so all three agree per deployment.

**★ Blocking `/api/` breaks a rich result.** If structured data references an image or feed served from a disallowed path, the crawler cannot fetch it and the enhancement is dropped. Fix: disallow narrowly — the specific mutation routes, not the whole `/api/` prefix — or serve public assets from a path that is not blocked.

**★ `robots.ts` became dynamic and you did not notice.** Reading `headers()` or `cookies()` — for example to vary rules by host in a multi-tenant app — makes it a per-request function invocation. Fix: if rules genuinely vary per tenant this is correct and you should accept it knowingly; if you only needed the deployment environment, use a build-time environment variable instead.

**★ Your `robots.txt` change has not taken effect.** Crawlers cache the file. Meta's crawler documentation says up to 24 hours. Fix: nothing — wait. Do not chase it with a deploy.

**★ Both `app/robots.txt` and `app/robots.ts` exist.** One of them is dead and it is not obvious which. Fix: delete the static file; a repository containing both is a repository where someone will edit the wrong one.

## Interview questions

**★ Explain, precisely, why `Disallow` plus `noindex` is worse than `noindex` alone.**
`Disallow` stops the crawler fetching the URL. `noindex` lives *inside* the response to that fetch. So blocking the crawl guarantees the directive is never read, and the engine falls back to whatever it can learn from elsewhere — inbound links — which is enough to list the URL without a snippet. Google states the dependency directly: for `noindex` to be effective, the page must not be blocked by `robots.txt` and must be accessible to the crawler. The correct sequence when both are eventually wanted is `noindex` first, verify it has dropped out, then add the block.

**★ When is `Disallow` the right tool at all?**
When the problem is *load*, not visibility: faceted search with unbounded query permutations, calendar routes that generate infinite next-months, expensive endpoints that no one should be crawling. Google's own framing is that robots.txt exists mainly to avoid overloading the site with requests. Anything phrased as "I do not want people to find this" is either a `noindex` question or, if it is genuinely private, an authentication question — `robots.txt` is a public file that advertises the paths you named in it.

**★ What changed in 16.3 for `robots.ts`, and what is the risk in using it?**
The `other` field, which lets a rule emit non-standard per-agent directives such as Seznam's `Request-Rate` or Yandex's `Clean-param`; before that, needing one of those forced you to abandon `robots.ts` for a static file. The risk is stated in the docs: values are passed through verbatim and Next.js validates neither names nor values. So the entire correctness burden is on you, with zero feedback — a misspelled directive is emitted faithfully and silently ignored by the crawler, and no test you are likely to write will catch it.

**★ How would you keep preview deployments out of search results, and what is the limitation of the `robots.ts` answer?**
Return a blanket `disallow: '/'` when a build-time environment variable says the deployment is not production, reading it at module scope so the handler stays static. The limitation is the two-switch model: that is a crawl block, and a preview URL that has already been shared and linked can be listed without ever being fetched. So `robots.ts` is the cheap belt; the braces is deployment-level authentication, which also stops the preview leaking data and stops it caching a wrong OG image against a URL a scraper will remember ([02f](02f-what-the-unfurlers-actually-fetch.md)).

**★ Where does the per-route `noindex` live, and why is a layout the right place for it?**
In `metadata.robots` on the segment, which emits `<meta name="robots">` and a separate `<meta name="googlebot">` when the `googleBot` sub-object is set. A layout is right for an authenticated area because metadata inherits: one declaration in `app/dashboard/layout.tsx` covers every route beneath it, and a new page added to that subtree is protected by default rather than by remembering. That is the mirror image of `alternates.canonical`, where inheritance from a layout is the bug — the test is whether the value is a property of the subtree or of the individual page.

---

← [`sitemap.ts`](03-sitemapts-and-robotsts-automation-localized-metadata-for-i18.md) · [Chapter 12 overview](01-explanation.md) · Next → [Splitting a sitemap and the 50,000-URL rule](03c-splitting-a-sitemap-generatesitemaps-and-the-50000-url-rule.md)
