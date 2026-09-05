---
title: "An SEO regression has no stack trace, no failing request and no error in your logs — so the only way to catch one is a test that fetches your own pages as a crawler and asserts on the tags, and `next build` stopped reporting the numbers a CI gate used to parse"
sidebar_label: "05c · Auditing SEO in CI"
sidebar_position: 27
description: "Why SEO defects are silent, asserting on head tags with Playwright and with a crawler User-Agent, validating the sitemap and robots output, structured-data validation, Lighthouse as a trend, and the build-output check that 16.0 made pass vacuously."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against
> [Playwright — *Accessibility testing*](https://playwright.dev/docs/accessibility-testing)
> (for the axe wiring reused here),
> [Lighthouse accessibility scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)
> (scoring mechanics), the Next.js
> [JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld) (`lastUpdated: 2026-03-02`)
> for the named validators, and the framework source
> [`html-bots.ts`](https://github.com/vercel/next.js/blob/v16.3.4/packages/next/src/shared/lib/router/utils/html-bots.ts)
> at tag **`v16.3.4`** for the crawler User-Agents used below; and the
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`lastUpdated: 2026-08-25`) for the removed build-output metrics.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, **no scores or timings reported**.

**Every other kind of defect announces itself. A broken query throws, a bad type fails to compile, a broken layout is visible in a screenshot. An SEO defect does none of that: the page renders, the status is 200, the logs are clean, and the only symptom arrives weeks later as a line on a graph nobody owns. That asymmetry is the entire argument for testing this in CI — not because head tags are hard, but because they are the only part of your output that no other part of your pipeline is looking at.**

## Assert on the tags, as a crawler

The unit of an SEO test is a rendered head, and the important detail is *which* client you pretend to be — [02f](02f-what-the-unfurlers-actually-fetch.md) establishes that Next.js gives a blocking render to agents matching its HTML-limited bots list and a streamed one to everything else.

```ts
// e2e/seo.spec.ts
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

// A UA that matches the HTML-limited bot regex, so tags land in <head>
const CRAWLER_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

test.describe('public page metadata', () => {
  test.use({ userAgent: CRAWLER_UA })

  for (const path of ['/', '/pricing', '/blog/hello-world']) {
    test(`${path} has complete social metadata`, async ({ page }) => {
      await page.goto(path)

      // The four properties the Open Graph protocol requires
      for (const property of ['og:title', 'og:type', 'og:image', 'og:url']) {
        await expect(
          page.locator(`meta[property="${property}"]`)
        ).toHaveCount(1)
      }

      // Absolute, not relative — the metadataBase failure mode
      const image = await page
        .locator('meta[property="og:image"]')
        .getAttribute('content')
      expect(image).toMatch(/^https:\/\//)

      // Alt text, which nothing else will ever check
      await expect(
        page.locator('meta[property="og:image:alt"]')
      ).toHaveCount(1)

      // The canonical exists and is on our own origin
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute('href')
      expect(canonical).toContain(new URL(BASE_URL).host)

      // Nothing public should be noindex
      await expect(
        page.locator('meta[name="robots"][content*="noindex"]')
      ).toHaveCount(0)
    })
  }
})
```

Five assertions, each catching a defect this chapter has described. Two notes on shape:

🔴 **Do not anchor selectors to `head`.** On the streamed path the tags are in `<body>` ([01e](01e-streaming-metadata-and-html-limited-bots.md)), so a `head meta[...]` selector silently passes zero and fails only when someone writes a positive assertion.

🔴 **The `noindex` assertion is the highest-value line in the file.** A `noindex` reaching production is the one SEO defect that is catastrophic rather than gradual, and it happens by exactly one mechanism: an environment check that returned the wrong answer. Assert its absence on every public route.

## Fetch the image, not just the tag

A correct `og:image` tag naming a URL that 404s is a preview with no picture, and no head assertion catches it:

```ts
test('the OG image actually resolves as an image', async ({ page, request }) => {
  await page.goto('/blog/hello-world')
  const src = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content')

  const res = await request.get(src!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toMatch(/^image\//)
})
```

The `content-type` check is the one that matters: an error page returns 200 with `text/html`, which passes a status-only assertion and produces no preview.

## Validate the sitemap and robots output

These are Route Handlers producing text, which makes them the easiest things in this chapter to test:

```ts
test('sitemap is well-formed and lists only absolute, non-redirecting URLs', async ({
  request,
}) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('xml')

  const xml = await res.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

  expect(urls.length).toBeGreaterThan(0)
  expect(urls.every((u) => u.startsWith('https://'))).toBe(true)

  // Spot-check a sample rather than the whole catalogue
  for (const url of urls.slice(0, 20)) {
    const head = await request.head(url, { maxRedirects: 0 })
    expect(head.status(), `${url} should not redirect`).toBe(200)
  }
})

test('production robots.txt does not disallow everything', async ({ request }) => {
  const txt = await (await request.get('/robots.txt')).text()
  expect(txt).not.toMatch(/^Disallow: \/$/m)
  expect(txt).toContain('Sitemap:')
})
```

That second test exists for one reason: the environment-driven `robots.ts` from [03b](03b-robotsts-and-the-crawl-directives.md) blocks everything when it believes it is not production, and *"the environment variable was not set on the production deploy"* is a real and recurrent way to take a site out of the index overnight.

⚠️ Spot-check the sitemap, do not walk it. A test that issues a `HEAD` for 50,000 URLs on every commit is a self-inflicted load test.

## Structured data

The JSON-LD guide names the two validators:

> *"You can validate and test your structured data with the Rich Results Test for Google or the generic Schema Markup Validator."*

Neither has a documented CI API that this page can point at, so the realistic split is:

- **In CI**, assert that the block exists, that it parses, and that it has the type and required-by-you fields:

```ts
test('product page emits parseable JSON-LD', async ({ page }) => {
  await page.goto('/products/widget')
  const raw = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent()

  const data = JSON.parse(raw!) // fails loudly if the escaping broke it
  expect(data['@type']).toBe('Product')
  expect(data.name).toBeTruthy()
  expect(String(data.image)).toMatch(/^https:\/\//)
})
```

- **Before release, by hand**, paste a representative URL into the Rich Results Test, which answers the different question of whether Google will act on it ([02c](02c-json-ld-and-structured-data.md)).

The `JSON.parse` is doing more work than it looks: it is the regression test for the `<` escaping, since a payload broken by an unescaped `</script>` will not survive round-tripping through the DOM as a single script element.

## Lighthouse, and what to do with the number

The scoring mechanics from [04g](04g-auditing-accessibility-and-what-no-tool-can-reach.md) apply to every Lighthouse category: a weighted average of pass/fail audits with no partial credit. That makes it a poor gate and a reasonable trend.

Run it nightly against a production build, store the categories, and review them with your other release metrics. 🔴 **Do not fail a build on a category score.** It is discontinuous, it moves on changes unrelated to your commit, and the first time it blocks a release for a reason nobody can explain, the job gets disabled.

Also worth knowing, from the enumerated bot list: **`Chrome-Lighthouse` is in the HTML-limited bots regex.** A Lighthouse run therefore exercises the blocking-metadata path, so it can never reproduce a streaming-metadata problem. It is the wrong instrument for that specific question.

## 🔴 The CI check that now passes vacuously

A common older gate parsed `next build` output for the per-route bundle sizes and failed when a number crossed a threshold. The 16 upgrade guide states that the release

> *"removes the `size` and `First Load JS` metrics from the `next build` output"*

A gate that greps for those columns now finds nothing, extracts no numbers, and — depending on how it was written — either compares an empty set successfully or silently reports zero.

If you inherited such a check, it is not protecting you. The current replacements are `next experimental-analyze` and the deployment platform's own reporting; the details belong to chapter 11 and chapter 17, not here. What belongs here is the warning: **a green gate that parses text is only green while the text exists.**

## What CI cannot tell you

Being explicit about this is what stops the suite becoming theatre:

| Question | Answerable in CI? |
|---|---|
| Are the tags present, absolute, and non-`noindex`? | ✅ |
| Does the OG image resolve as an image? | ✅ |
| Is the sitemap well-formed and free of redirects? | ✅ |
| Does the JSON-LD parse and carry the right type? | ✅ |
| Will Google show a rich result for it? | ❌ — Rich Results Test, by hand |
| Is the page actually indexed? | ❌ — Search Console, days later |
| Is the preview cached wrong on a platform? | ❌ — [02f](02f-what-the-unfurlers-actually-fetch.md), by hand |
| Is the copy any good? | ❌ |

The first four are cheap, deterministic and catch the defects that are otherwise invisible. The rest need a human and a calendar reminder.

## Gotchas

**★ Your head assertions are anchored to `head` and silently match nothing.** On a dynamically-rendered route the tags stream into `<body>`. Fix: select `meta[...]` document-wide, and set a crawler User-Agent when you specifically want the blocking path.

**★ The suite runs with the default Playwright User-Agent.** That matches no entry in the HTML-limited bots list, so you are testing the streamed path even when your users' unfurlers get the blocking one. Fix: `test.use({ userAgent })` with an agent that matches, and know which path each test is exercising.

**★ A `noindex` reached production and nothing caught it.** No test asserted its absence. Fix: assert `meta[name="robots"][content*="noindex"]` has count 0 on every public route — it is one line and it is the most valuable one in the file.

**★ `robots.txt` in production disallows everything.** The environment variable that `robots.ts` branches on was missing on the production deploy, so it took the preview branch. Fix: a test that fetches `/robots.txt` against the production URL and fails on a bare `Disallow: /`.

**★ The OG image test checks status and not `Content-Type`.** An HTML error page returns 200. Fix: assert the `content-type` starts with `image/`.

**★ The sitemap test walks every URL and takes twenty minutes.** Fix: spot-check a sample per run and rotate the sample; a full crawl belongs in a nightly job, if anywhere.

**★ The JSON-LD test regexes the payload instead of parsing it.** A regex passes on a payload whose escaping is broken. Fix: `JSON.parse` it — that is the actual escaping regression test.

**★ A build gate parses `next build` output for bundle sizes.** 16.0 removed `size` and `First Load JS` from that output, so the gate now finds nothing and passes vacuously. Fix: delete it and replace it with a check against something that still exists.

**★ CI fails on a Lighthouse category score after an unrelated commit.** Pass/fail audits with no partial credit make the number jump. Fix: treat category scores as a trend with an owner; gate on specific, attributable assertions instead.

**★ You audit the development build.** Development renders differently, does not cache like production and does not stream like production. Fix: audit a production build, ideally the deployed preview.

**★ Tests run against localhost while `metadataBase` points at production.** Every absolute-URL assertion passes for the wrong reason. Fix: assert the host matches the base URL under test, not a hard-coded production string.

**★ Someone deletes a flaky SEO test rather than fixing it.** These tests are deterministic — if one is flaky, the page is. Fix: treat flakiness here as a signal about dynamic rendering or caching, not about the test.

## Interview questions

**★ Why do SEO regressions need a CI test when nothing else in the head does?**
Because they are the only class of output defect with no other observer. A broken query throws, a type error fails the build, a broken layout shows up in review, a slow page shows up in monitoring. A missing `og:image`, a `noindex` that escaped from a preview branch, a canonical pointing at the wrong host — all of those render a perfectly healthy 200 page, produce no error anywhere in the stack, and surface weeks later as a traffic graph. The test is cheap precisely because the assertions are simple; the value is entirely in the fact that nothing else is looking.

**★ What User-Agent should an SEO test use, and why does it matter?**
One that matches the HTML-limited bots regex — Googlebot, Bingbot, Slackbot and the rest are enumerated in the framework source at the pinned version. It matters because Next.js branches on it: matching agents get a blocking render with metadata in `<head>`, everything else gets a streamed response with the tags appended to `<body>`. A test with the default Playwright agent is therefore exercising a different code path from the one your unfurlers use, and can pass while the crawler path is broken. Where possible, test both — the streamed path is what a new, unlisted scraper will get.

**★ Which parts of SEO can you meaningfully gate on, and which must stay manual?**
Gate on things that are deterministic and attributable: the presence and absoluteness of the required tags, the absence of `noindex` on public routes, the OG image resolving with an image content type, the sitemap being well-formed and free of redirects, the JSON-LD parsing and carrying the right `@type`. Keep manual anything that depends on an external system's judgement — whether Google will render a rich result, whether a page is actually indexed, whether a platform has cached the wrong preview. The failure mode of getting this wrong is not a missed bug, it is a gate that goes red for unactionable reasons and gets disabled.

**★ Why is `JSON.parse` the right assertion for structured data rather than a regex?**
Because the defect it is really testing for is the escaping. The documented pattern injects the payload with `dangerouslySetInnerHTML` after replacing `<` with `\u003c`, and if that replacement is dropped, a payload containing `</script>` terminates the script element early — so what you read back from the DOM is truncated and no longer valid JSON. A regex looking for `"@type"` can match the surviving fragment and pass. Parsing the extracted text is the only assertion that fails when the tag boundary was broken, which is also the assertion that fails when someone has introduced an XSS sink.

**★ You inherit a CI job that fails the build when the First Load JS number regresses. What do you do?**
Delete it, after confirming what it is doing. Next.js 16.0 removed `size` and `First Load JS` from the build output, so a job that parses those columns now matches nothing — and depending on how the parsing was written, it either compares an empty set and passes, or reports zero and passes. Either way it is green for a reason unrelated to the codebase, which is the worst state for a gate to be in because it looks like coverage. The replacement is the current analysis tooling and the platform's own reporting; the immediate action is to stop the team believing they have a budget check.

**★ Is a Lighthouse SEO score worth collecting?**
As a trend with an owner, yes; as a gate, no. The scoring model is a weighted average of pass/fail audits with no partial credit, so it moves discontinuously and can shift on changes that have nothing to do with the commit under test. It also cannot see the things this chapter is mostly about — whether a preview is cached wrong on a platform, whether a canonical is semantically right, whether the sitemap matches the routes that exist. The specific, attributable assertions are what belong in the pipeline; the score belongs in the same review as the rest of your release metrics, or nowhere.

---

← [Canonicals, duplicate URLs and redirect hygiene](05b-canonicals-duplicate-urls-and-redirect-hygiene.md) · [Chapter 12 overview](01-explanation.md) · Next → [Milestone: SprintDesk fully indexed](06-project-milestone-sprintdesk-public-pages-fully-indexed.md)
