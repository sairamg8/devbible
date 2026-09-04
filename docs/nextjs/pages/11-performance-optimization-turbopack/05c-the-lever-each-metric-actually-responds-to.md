---
title: "Each Core Web Vital responds to exactly one class of Next.js decision, and the audit that works is the one that refuses to touch a lever until the field data says which metric moved"
sidebar_label: "05c · The lever per metric"
sidebar_position: 122
description: "LCP as a discovery-and-TTFB problem with preload, loading and fetchPriority as its levers; INP as a client-boundary problem; CLS as a reserved-space problem solved by next/font and next/image; and an ordered audit that starts in the field."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js documentation — [Image component](https://nextjs.org/docs/app/api-reference/components/image), [Font Module](https://nextjs.org/docs/app/api-reference/components/font), [Lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) (`lastUpdated: 2026-03-10`) and [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling) (`lastUpdated: 2026-06-01`), all `version: 16.3.4`. Image and Font quotes reused from the corpus's chapter 9 verification of the same references — not re-fetched here. Metric definitions, sub-part budgets and thresholds belong to [web.dev](https://web.dev/articles/lcp) and are cited as theirs in [chapter 3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**, **no measurements**, **no threshold numbers asserted as Next.js's**.

**The reason performance work drifts is that "make the site faster" is not a task, and every lever in Next.js looks plausible for every metric. It is not so. LCP is dominated by when the browser *discovers* the largest resource and how long your server took to send the first byte; deleting client JavaScript barely touches it. INP is made of main-thread work, which is where client JavaScript lives, so it is the metric your boundary decisions own. CLS is neither — it is a question of whether space was reserved before content arrived, and Next.js solves it in two components with defaults that are already correct until someone overrides them. This page maps each metric to the decision class that moves it, names the specific Next.js API, and is explicit about where the framework's documentation simply has nothing to say.**

## The map

| Metric | What it is made of | The Next.js decision class | Where it is argued |
|---|---|---|---|
| **LCP** | server response time, then resource *discovery* and download | prerendering vs request-time rendering; how the hero image is announced | this page · [ch5](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) · [ch9 · 04b](../09-styling-and-ui/04b-loading-priority-preload-eager-fetchpriority.md) |
| **INP** | main-thread work: hydration, handlers, re-renders | where the `'use client'` boundary sits, and what it drags in | [ch3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md) · this page |
| **CLS** | whether space was reserved before content landed | `next/image` sizing, `next/font` fallback metrics | this page · [ch9 · 03](../09-styling-and-ui/03-font-optimization-with-next-font-zero-layout-shift.md) · [ch9 · 04](../09-styling-and-ui/04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md) |
| **TTFB** | how much work the server did before the first byte | whether the route is prerendered, and where the dynamic holes are | [ch5](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) |

🔴 **The single most useful fact on this page is the diagonal:** the lever for one metric is usually a no-op for the others. A release that halves the client bundle and moves nothing is not a failed release; it is a release that improved INP and was graded on LCP.

## LCP is a discovery problem before it is a bandwidth problem

Per web.dev's breakdown (quoted and attributed in [ch3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md)), roughly **40% of an LCP budget is time to first byte** and another ~40% is downloading the LCP resource itself. The two thin slices in between are *resource load delay* — the gap between the first byte and the browser starting the fetch — and *element render delay*.

**Resource load delay is the slice Next.js gives you a specific API for**, and the Image reference states the case exactly:

> *"The image is the Largest Contentful Paint (LCP) element. The image is above the fold, typically the hero image. You want to begin loading the image in the `<head>`, before its discovered later in the `<body>`."*

An `<img>` in the body is discovered when the parser reaches it. On a streamed RSC response with a substantial layout above the fold, that can be meaningfully late — the connection sits idle while HTML that is not the LCP element streams past. A `<link>` in the head is discovered in the first chunk.

⚠️ **The prop your syllabus and every pre-2026 tutorial names is deprecated.** From the Image reference version history:

> *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property in order to make the behavior clear."*

And the replacement comes with an instruction that surprises people:

> 🔴 *"In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`."*

```jsx
// The one hero. Known LCP element, and the same element at every viewport.
<Image src={hero} alt="" preload sizes="100vw"
       style={{ width: '100%', height: 'auto' }} />

// Two candidates depending on viewport — you cannot preload a conditional,
// because preloading both puts an image the user will never see on the
// critical path, competing with the one they will.
<Image src={desktopHero} alt="" fetchPriority="high" sizes="(max-width: 768px) 0px, 100vw" />
```

**The decision procedure, and why `preload` is the narrow case:** `preload` emits a `<link>` unconditionally, so it is only correct when you are certain which element is the LCP element at *every* viewport. The moment there are two candidates — an art-directed pair, a carousel, a light/dark swap — the certainty is gone and `fetchPriority="high"` is the right tool, because it reorders a fetch that was going to happen rather than adding one that might not. The full four-lever decision tree is [ch9 · 04b](../09-styling-and-ui/04b-loading-priority-preload-eager-fetchpriority.md).

**And the ~40% you cannot fix with a prop is TTFB.** If a route reads `cookies()`, `headers()` or `searchParams`, it renders at request time and the first byte waits for your slowest data dependency. That is a caching and PPR decision, not an image decision, and it belongs to [chapter 5](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md). It is also the reason a bundle-shrinking release can *regress* LCP: shipping less JavaScript while accidentally making a route dynamic moves the biggest slice of the budget in the wrong direction.

## INP is the metric your boundary owns

Main-thread work is what an interaction queues behind, and client JavaScript is main-thread work three times over: downloading and parsing it, hydrating with it, and re-rendering through it. The mechanism is argued in [ch3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md); the levers Next.js documents are these.

**1 · Move the work to the server.** The package-bundling guide's own example is the clearest statement of the pattern:

> *"A common cause of large client bundles is doing expensive rendering work in Client Components. This often happens with libraries that exist only to transform data into UI, such as syntax highlighting, chart rendering, or markdown parsing."*
> *"If that work does not require browser APIs or user interaction, it can be run in a Server Component."*
> *"Even though the final output is just a `<code>` block, the entire highlighting library is bundled into the client JavaScript bundle"*

```jsx
// ❌ The whole highlighting library ships to the browser to produce static HTML.
'use client'
import { Highlight } from 'prism-react-renderer'

export function Code({ source }) {
  return <Highlight code={source} language="ts">{/* render */}</Highlight>
}
```

```jsx
// ✅ Server Component. The client receives markup, not a parser.
import { codeToHtml } from 'shiki'

export async function Code({ source }) {
  // The Shiki package runs on the server and is never bundled for the client.
  const html = await codeToHtml(source, { lang: 'ts', theme: 'github-dark' })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

**2 · Defer what must stay on the client.** The lazy-loading guide is precise about scope, and the precision matters:

> *"By default, Server Components are automatically code split, and you can use streaming to progressively send pieces of UI from the server to the client. **Lazy loading applies to Client Components.**"*
> *"`next/dynamic` is a composite of `React.lazy()` and Suspense."*

```jsx
'use client'
import dynamic from 'next/dynamic'

// A chart that only exists below the fold, or behind a tab.
const Chart = dynamic(() => import('./chart'), {
  loading: () => <div className="h-64" />, // reserve the box — see CLS below
})
```

🔴 **The trap the guide names:** *"When a Server Component dynamically imports a Client Component, automatic code splitting is currently **not** supported."* And `ssr: false` is a Client-Component-only option — *"`ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."* Full treatment in [03 · bundle analysis and lazy loading](03-bundle-analysis-dynamic-imports-lazy-loading.md).

**3 · Narrow what a wide import pulls in.**

```js
// next.config.js
const nextConfig = {
  experimental: { optimizePackageImports: ['icon-library'] },
}
```

> *"This option will only load the modules you actually use, while still giving you the convenience of writing import statements with many named exports."*

⚠️ **What the Next.js documentation does not give you is INP guidance beyond bundle and boundary.** There is no framework API for scheduling, yielding, or breaking up a long task; the techniques that address processing duration directly — yielding to the main thread, deferring non-urgent updates — are React and web-platform concerns, not Next.js ones. Do not go looking for a Next.js option that isn't there.

## CLS is solved by two defaults, and broken by overriding them

CLS is not about speed at all. It is about whether the box was reserved before the content arrived, and Next.js reserves boxes in two components.

**Images.** The `width`/`height` you are forced to supply exist for this and nothing else:

> *"The `width` and `height` properties represent the intrinsic image size in pixels. This property is used to infer the correct **aspect ratio** used by browsers to reserve space for the image and avoid layout shift during loading. It does not determine the *rendered size* of the image, which is controlled by CSS."*

The two documented ways to lose that reservation:

```jsx
// ❌ CSS sets one axis and discards the ratio the attributes encoded.
<Image src="/hero.jpg" width={1600} height={900} alt="" style={{ width: '100%' }} />

// ✅ The reference's own instruction: "If you're using the `style` prop to set
// a custom width, be sure to also set `height: 'auto'` to preserve the
// image's aspect ratio."
<Image src="/hero.jpg" width={1600} height={900} alt=""
       style={{ width: '100%', height: 'auto' }} />
```

🔴 **`fill` trades a known layout shift for an unknown one.** With explicit dimensions the browser reserves the right box from the attributes; with `fill` it reserves whatever the parent's CSS says — and if the parent is sized from its content, or from a value that only resolves once a font has loaded, the shift comes back through the parent. `fill` is not a way to avoid the sizing rule; it is a way to move the obligation onto a parent you must then size yourself.

**Fonts.** The thing that removes font-swap shift is not `font-display`:

> *"For `next/font/google`: A boolean value that sets whether an automatic fallback font should be used to reduce Cumulative Layout Shift. The default is `true`."*
> *"For `next/font/local`: A string or boolean `false` value that sets whether an automatic fallback font should be used to reduce Cumulative Layout Shift. The possible values are `'Arial'`, `'Times New Roman'` or `false`. The default is `'Arial'`."*

`display` defaults to `'swap'` and `adjustFontFallback` defaults to `true`, and **they are safe as a pair**: fallback text shows immediately, and it occupies close to the space the real font will occupy, so the swap is a repaint rather than a reflow. Setting `adjustFontFallback: false` while leaving `display: 'swap'` is the combination that reintroduces the shift, and it is usually done for an unrelated reason — see [ch9 · 03](../09-styling-and-ui/03-font-optimization-with-next-font-zero-layout-shift.md).

**Everything else that shifts is yours.** A `loading` fallback with no height, a banner injected after hydration, an ad slot with no reserved box, a skeleton whose dimensions do not match the content it is replacing. Next.js has no API for these; the rule is that anything appearing after first paint must occupy space that was already there.

```jsx
// The Suspense fallback must be the same height as what replaces it,
// or the boundary resolving *is* a layout shift.
<Suspense fallback={<div className="h-64" />}>
  <Chart />
</Suspense>
```

## The audit, in an order that does not waste a week

1. **Start in the field, not the lab.** Read the distribution from your own `useReportWebVitals` pipeline ([05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md), [05b](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md)), segmented by route pattern. A lab run on developer hardware is a sample from the good tail.
2. **Name the metric before naming a fix.** If it is LCP, no amount of bundle work will help. If it is INP, no amount of image work will.
3. **For LCP, split the budget first.** Is the first byte late, or is the resource discovered late? The first is a rendering-mode question for [chapter 5](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md); the second is `preload` / `loading` / `fetchPriority`.
4. **For INP, get an import chain, not a byte count.** *Which* client module pulled the library in is the actionable fact; the analyzer procedure is [ch3 · 06b](../03-server-components-vs-client-components/06b-measuring-the-boundary.md) and [03](03-bundle-analysis-dynamic-imports-lazy-loading.md).
5. **For CLS, look for the thing that appeared late.** Reserved space is binary; find the element that had none.
6. **Verify in the field again, on the same route segmentation.** One release, one metric, one comparison.

## Gotchas

**★ Symptom: you shipped a large Server Component refactor, the client bundle halved, and LCP is unchanged.** Cause: roughly 80% of an LCP budget is TTFB plus fetching the LCP resource, and neither is a function of how much JavaScript you deleted. Fix: this is a success graded against the wrong metric — check INP, which is what should have moved, and take LCP to the image and the server response instead.

**★ Symptom: the hero image has `priority` and a reviewer says the prop no longer exists.** Cause: *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property."* Fix: migrate deliberately rather than mechanically, because the reference also says most cases want neither:

```jsx
// Single, viewport-invariant LCP element:
<Image src={hero} alt="" preload sizes="100vw" style={{ width: '100%', height: 'auto' }} />

// Above the fold but not the LCP element, or LCP at only some viewports:
<Image src={hero} alt="" fetchPriority="high" />
```

**★ Symptom: ten images were marked urgent and the hero got slower.** Cause: priority is a *relative ordering over a fixed pipe*. Preloading ten images opens ten fetches on the critical path against the same connection budget, so the hero now competes with nine images the user may never scroll to — and lazy loading was disabled on all nine. Fix: exactly one `preload`, and only when the LCP element is the same at every viewport.

**★ Symptom: CLS regressed after a release that only touched CSS.** Cause: a `style` prop set `width` without `height: 'auto'`, discarding the aspect ratio the `width`/`height` attributes encoded — the reservation is made from the ratio, not from the numbers themselves. Fix:

```jsx
<Image src={src} width={1600} height={900} alt=""
       style={{ width: '100%', height: 'auto' }} />
```

**★ Symptom: text reflows when the web font loads, even though you use `next/font`.** Cause: `adjustFontFallback` was turned off — it defaults to `true` and is the thing that removes the shift, while `display: 'swap'` only decides what you read while waiting. The pair is safe; disabling one half is not. Fix: leave `adjustFontFallback` at its default, or if you must disable it, change `display` deliberately at the same time and understand what you are trading.

**Symptom: a Suspense boundary resolving causes a visible jump.** Cause: the fallback had no height, so the reserved box was zero and the real content pushed everything down. Fix: give the fallback the dimensions of what replaces it — `<div className="h-64" />`, not `null`.

**Symptom: `next/dynamic` was added to a component and the bundle did not shrink.** Cause: the dynamic import was written in a Server Component — *"When a Server Component dynamically imports a Client Component, automatic code splitting is currently not supported."* Fix: move the `dynamic()` call into a Client Component, which is also where `ssr: false` must live.

**Symptom: INP is bad only in the first seconds after a page loads.** Cause: hydration is a main-thread pass proportional to the client tree, and an interaction arriving during it queues behind it. Fix: shrink the client tree by pushing the boundary down; there is no Next.js scheduling option that will do this for you.

**Symptom: a per-route dashboard shows one route is far worse and nobody can see why.** Cause: metric distributions were computed across all routes, so a single bad segment was averaged away until someone segmented. Fix: segment by *route pattern* — `/orders/[id]`, not `/orders/8f2c` — at the sender, as described in [05b](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md).

## Interview questions

**★ A release halved the client bundle and LCP did not move. Did the release fail?**
No — it was graded on the wrong metric. LCP is dominated by time to first byte and by fetching the largest resource, which together account for roughly 80% of the budget per web.dev's breakdown, and neither is a function of how much JavaScript you shipped. The metric that should have moved is INP, because client JavaScript is main-thread work and main-thread work is what an interaction queues behind. The correct follow-up is to check INP, and to take LCP work to the image's discovery time and to the server's response time instead.

**★ Your LCP element is a hero image. What is the current Next.js API for making it load early, and what is the catch?**
The prop most people reach for, `priority`, was deprecated in Next.js 16 in favour of `preload` — the reference says the rename was made *"in order to make the behavior clear"*, because the old boolean was doing three separable things at once. The catch is that the same reference then tells you that in most cases you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`. `preload` inserts a `<link>` in the head unconditionally, so it is only correct when you are certain the same element is the LCP element at every viewport. With art direction, a carousel, or a light/dark pair there is more than one candidate, and preloading them all puts images on the critical path that the user will never see.

**★ Why is CLS the metric Next.js mostly solves with defaults?**
Because both of its common causes have a component with the right default already. `next/image` requires `width` and `height`, and those exist purely so the browser can compute an aspect ratio and reserve the box before the bytes arrive — the reference says explicitly that they do not determine rendered size. `next/font` generates an adjusted fallback face, with `adjustFontFallback` defaulting to `true`, so that the swap from fallback to web font is a repaint rather than a reflow. Both defaults are correct, and CLS regressions in a Next.js app almost always come from overriding one of them — a `style` width with no `height: 'auto'`, a `fill` on a parent that is sized from content, or `adjustFontFallback: false`. Everything else that shifts is application markup, where the framework has no API and the rule is simply that late content must occupy space that was already reserved.

**★ What is the first thing you do when told "the site is slow"?**
Refuse to touch a lever until the field data names a metric and a route pattern. Every optimisation in Next.js is metric-specific and most of them are no-ops for the other metrics, so starting from a lever means a substantial chance of shipping a correct change that improves nothing measurable and then concluding performance work does not pay. The pipeline for that data is `useReportWebVitals` reporting real sessions, graded at the 75th percentile — a definition from web.dev — not a Lighthouse run on a developer laptop, which samples the good tail by construction.

**Does Next.js give you anything for INP beyond reducing the bundle?**
Not really, and it is worth being straight about that. The documented levers all reduce the amount of client JavaScript or defer when it arrives: moving rendering work into Server Components, `next/dynamic` for Client Components, `optimizePackageImports` for wide packages. There is no Next.js API for yielding to the main thread, chunking a long task, or deprioritising a state update — those are React and web-platform concerns. If the processing duration inside a single handler is the problem, no framework configuration will fix it.

**Why can shrinking a bundle make LCP worse?**
Because bundle work and rendering-mode changes often land in the same release. If the same commit introduces a `cookies()`, `headers()` or `searchParams` read, the route stops being prerendered and renders at request time, so the first byte now waits for the slowest data dependency — and TTFB is up to ~40% of the LCP budget. The bundle genuinely got smaller and the headline metric genuinely got worse, and the two facts have nothing to do with each other. This is the strongest argument for one change per release when you are tuning, and for segmenting the field data by route.

---

← [05b · Shipping the metric](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md) · [Chapter index](01-explanation.md) · Next → [06 · `instrumentation.ts` and monitoring](06-instrumentationts-for-opentelemetry-and-application-monitori.md)
