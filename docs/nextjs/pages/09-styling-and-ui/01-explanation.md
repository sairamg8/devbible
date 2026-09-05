---
title: "09 · Styling and UI — four built-in mechanisms, and the reason each of them is a contract rather than an optimisation"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 9 index: CSS Modules and Tailwind v4, CSS-in-JS at the server boundary, next/font, next/image, next/script, and the SprintDesk design system milestone — with the chapter's corrected claims listed up front."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — the [CSS](https://nextjs.org/docs/app/getting-started/css), [Font Module](https://nextjs.org/docs/app/api-reference/components/font), [Image component](https://nextjs.org/docs/app/api-reference/components/image) and [`<Script>`](https://nextjs.org/docs/app/api-reference/components/script) references, plus Tailwind's own Next.js framework guide at **v4.3**. Every chunk below carries its own `> Verified:` line naming the pages and `lastUpdated` values it was written from.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**, so nothing in this chapter is probed — it is documentation-verified throughout, with **no sandbox run**, no timings and no byte counts.

**Every mechanism in this chapter looks like a performance feature and behaves like a contract. `next/image` is a sizing contract before it is an optimizer — the `width` and `height` it forces on you exist to reserve layout space, and `remotePatterns` is an allow-list deciding whose bytes reach a decoder on your server. `next/font` is a build-time self-hosting step whose zero-layout-shift claim rests on a metric-matched fallback face, not on `font-display`. `next/script` does not choose how fast a script loads; it chooses who injects the tag and when, and only one of its four strategies is rendered by the server. And CSS Modules are not a naming convention — they are a build-time rename, which is why the order of your imports is the order of your stylesheets and why "it works locally" is a CSS bug class in its own right. Read the chapter for the mechanisms; the milestone at the end is where all four land in the same root layout and start interfering with each other.**

## 🔴 What this chapter corrects

Four claims in wide circulation are wrong at 16.3.4, and each is corrected with a verbatim source on the page that owns it:

| Claim you will meet | What the documentation says | Where |
|---|---|---|
| Tailwind needs a `tailwind.config.js` and the `@tailwind` triple | v4 is CSS-first: a PostCSS plugin and one `@import 'tailwindcss'`. No config file on the documented path | [01c](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md) |
| `beforeInteractive` blocks hydration | *"their execution does not block page hydration from occurring"* | [05](05-next-script-loading-strategies-for-third-party-scripts.md) |
| `priority` marks the LCP image | Deprecated in Next.js 16 in favour of `preload` | [04b](04b-loading-priority-preload-eager-fetchpriority.md) |
| Naming a hostname in `remotePatterns` is enough | Every omitted field implies `**`, and a redirect is followed without re-validating | [04d](04d-remote-patterns-is-a-security-control.md) |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[CSS Modules and global stylesheets](01-css-modules-global-stylesheets-utility-first-tailwind-config.md)** | 🔴 the build-time rename that *is* the scoping mechanism, and what a global stylesheet costs |
| 2 | **[Import order, chunking and what CSS costs](01b-css-import-order-chunking-and-what-css-costs.md)** | 🔴 `cssChunking` is bundler-split — `'strict'`/`false` are webpack-only, `'graph'` Turbopack-only |
| 3 | **[Tailwind v4, CSS-first](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md)** | the current setup verified against two primary sources; coexisting with CSS Modules |
| 4 | **[CSS-in-JS at the server boundary](02-css-in-js-caveats-at-server-component-boundaries.md)** | why runtime CSS-in-JS cannot work in a Server Component — the mechanism, not a missing feature |
| 5 | **[Style registries and the client boundary](02b-style-registries-and-what-the-client-boundary-actually-costs.md)** | the bill is not the wrapper; it is every component that touches the styling API |
| 6 | **[Choosing a CSS-in-JS road](02c-choosing-a-css-in-js-road.md)** | 🔴 the three exits, and why the choice decides which components may be Server Components — not styling taste |
| 7 | **[next/font and zero layout shift](03-font-optimization-with-next-font-zero-layout-shift.md)** | build-time self-hosting first; the shift is removed by `adjustFontFallback`, not `display` |
| 8 | **[The loader API](03b-the-loader-api-google-local-and-variable-fonts.md)** | google vs local option sets, and the two unrelated meanings of *variable* |
| 9 | **[Applying the font](03c-applying-the-font-classname-style-css-variables-and-tailwind.md)** | `className`, `style` and the CSS variable are not interchangeable |
| 10 | **[Subsetting and preload scope](03d-subsetting-preloading-and-where-the-loader-must-be-called.md)** | 🔴 where you call the loader decides which routes preload the font |
| 11 | **[next/image as a sizing contract](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md)** | `width`/`height`/`fill`, and why `sizes` decides the byte count |
| 12 | **[Loading priority](04b-loading-priority-preload-eager-fetchpriority.md)** | 🔴 `priority` deprecated in 16; `preload`, `loading` and `fetchPriority` |
| 13 | **[Blur placeholders](04c-blur-placeholders-where-the-bytes-come-from.md)** | who produces the base64 — the build for static imports, nobody for remote URLs |
| 14 | **[remotePatterns is a security control](04d-remote-patterns-is-a-security-control.md)** | 🔴 omitted fields imply `**`; redirects are not re-validated |
| 15 | **[Format negotiation and bounding the optimizer](04e-format-negotiation-and-bounding-the-optimizer.md)** | 🔴 the cache key is source × width × quality × format; AVIF is a priced trade, not a free win |
| 16 | **[When not to optimize](04f-when-not-to-use-the-optimizer.md)** | the four classes that gain nothing, why authenticated images structurally cannot work, custom loaders |
| 17 | **[next/script strategies](05-next-script-loading-strategies-for-third-party-scripts.md)** | the four strategies, injection point, ordering, and once-per-document |
| 18 | **[Script handlers](05b-onload-onready-onerror-and-the-client-component-boundary.md)** | 🔴 all three handlers require a Client Component, and the `beforeInteractive` contradiction |
| 19 | **[Inline scripts and placement](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md)** | the mandatory `id`, attribute forwarding that carries a nonce, layout-vs-page scope |
| 20 | **[The worker strategy](05d-the-worker-strategy-partytown-and-what-to-use-instead.md)** | experimental, `pages/`-only, and what to do on the App Router instead |
| 21 | **[Milestone: design system pass](06-project-milestone-sprintdesk-design-system-pass.md)** | theming with custom properties, the flash fix, one font definitions module |
| 22 | **[Milestone: avatars, attachments, scripts](06b-avatars-attachments-and-the-scripts-pass.md)** | the allow-list, the header-forwarding trap, the scripts pass, acceptance criteria |

## Phase gate

You are done with this chapter when you can open an unfamiliar App Router root layout and say, for each thing in it — the global stylesheet import, the font `className`, an inline script, a third-party tag — **which routes pay for it, when it executes relative to hydration, and what would change if it moved one level down the tree.** Being able to answer that for the font alone is the common stopping point and it is not the gate.

## Where this connects

- [Chapter 3 · Server and Client Components](../03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md) — the boundary that decides why CSS-in-JS and every `<Script>` handler need a Client Component
- [Chapter 10 · CSP: nonces and the dynamic-rendering tax](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) — the policy that governs every inline script this chapter adds
- [Chapter 10 · CSP without nonces](../10-forms-authentication-and-security-hardening/11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md) — build-time SRI, and the third-party-script security surface
- [Chapter 11 · Performance milestone](../11-performance-optimization-turbopack/07-project-milestone-sprintdesk-performance-audit.md) — where the work in this chapter is actually measured
- [Chapter 12 · SEO, metadata and accessibility](../12-seo-metadata-and-accessibility/01-explanation.md) — structured data, which uses this chapter's inline-script mechanism
- [Web Vitals · preventing CLS](../../../web-vitals-performance/pages/06-cls-optimization/01-preventing-cls.md) — the font-metric mismatch `adjustFontFallback` exists to solve
- [Web Vitals · reducing INP](../../../web-vitals-performance/pages/05-inp-optimization/01-reducing-inp.md) — why third-party main-thread work is the metric that moves

---

Start → [01 · CSS Modules and global stylesheets](01-css-modules-global-stylesheets-utility-first-tailwind-config.md)
