---
sidebar_position: 0
title: "Instant Navigations is an opt-in suite of five tools that make a server-driven app feel like an SPA, and Vercel has said its behaviours become the default in a future major version"
sidebar_label: "10 · Instant Navigations"
description: "Index for the Instant Navigations topic: what instant means, Partial Prefetching and the App Shell, per-link prefetching, Instant Insights validation, the Navigation Inspector, and ISR under Cache Components."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3) and [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation).
> Target: **Next.js 16.3.4** (16.3 GA 2026-08-03, Active LTS; 15.5 Maintenance LTS) · Node.js **>= 20.9** · TypeScript floor **5.1** · Turbopack default bundler · Chrome/Edge/Firefox 111+, Safari 16.4+.

**Server Components fixed data fetching and broke perceived responsiveness. Instant Navigations is Vercel's answer: a definition of "instant" you can validate, a prefetch model that costs one artifact per route instead of one per link, a DevTools panel that finds every navigation that fails the definition, and a Playwright helper that stops the fix regressing. It is opt-in behind two flags today — `cacheComponents` and `partialPrefetching` — and the release notes say the behaviours behind it become the default in a future major version.**

## The two flags

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

`partialPrefetching` requires `cacheComponents`; without it, `next dev` and `next build` throw at config validation.

## Chunks

| # | Chunk | What it settles |
| --- | --- | --- |
| 1 | [What "instant" means](01-what-instant-means.md) | The definition verbatim, the static shell vs the App Shell, why a refresh and a click produce different UI, the two levers (`'use cache'` and `<Suspense>`) |
| 2 | [Partial Prefetching and the App Shell](02-partial-prefetching-and-the-app-shell.md) | One shell per route, what changes for every `<Link>` prop, and the five-case audit of legacy `prefetch={true}` calls |
| 3 | [Per-link prefetching and adoption](03-per-link-prefetching-and-incremental-adoption.md) | The URL-data-outside-Suspense bug, what `prefetch={true}` resolves and costs, `prefetch = 'partial'` for incremental adoption |
| 4 | [Instant Insights and validation](04-instant-insights-and-validation.md) | What validation simulates, `validationLevel`, the `instant` export's three forms, and the precedence rule that governs static-shell validation |
| 5 | [Navigation Inspector and the fix loop](05-the-navigation-inspector-and-the-fix-loop.md) | Freezing a navigation at its shell, a worked two-step fix, and the documented agent loop |
| 6 | [Better ISR](06-better-isr-with-cache-components.md) | App Shell for unlisted params, background upgrade, and why params resolve in route order |

## Where the rest of it lives

- The `instant()` Playwright helper — the fifth part of the suite — is in [ch. 13 · 10 · Testing that a navigation stays instant](../../13-testing-and-developer-experience/10-the-instant-playwright-helper.md).
- Prefetch request volume and the `prefetch` segment config in isolation are in [13 · Prefetch inlining](../13-prefetch-inlining.md) and [13b · Prefetch control and link status](../13b-prefetch-control-and-link-status.md).
- The `<Link>` and `useRouter` fundamentals this builds on are in [04 · Navigation mechanics](../04-navigation-mechanics-link-userouter-redirect-notfound.md) and [05 · Prefetching fundamentals](../05-prefetching-fundamentals-and-the-native-view-transitions-api.md).

---

Start → [1 · What "instant" means](01-what-instant-means.md)
