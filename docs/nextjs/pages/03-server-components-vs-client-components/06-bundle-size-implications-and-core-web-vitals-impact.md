---
title: "Deleting client JavaScript is an INP fix, not an LCP fix — roughly 80% of an LCP budget is TTFB and resource load duration, which is why the boundary decision that most improves your bundle can leave your headline metric exactly where it was"
sidebar_label: "06 · Bundle size and Core Web Vitals"
sidebar_position: 8
description: "How a server/client boundary decision shows up in LCP and INP, why the two metrics respond to opposite changes, the LCP sub-part budget, and why the RSC payload means zero JavaScript is not zero bytes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against web.dev — [Largest Contentful Paint](https://web.dev/articles/lcp), [Optimize LCP](https://web.dev/articles/optimize-lcp), [Interaction to Next Paint](https://web.dev/articles/inp); and against the Next.js documentation — [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling) (`version: 16.3.4`, `lastUpdated` 2026-06-01) and [`useReportWebVitals`](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals) (`version: 16.3.4`, `lastUpdated` 2026-02-27).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**; **no benchmarks run** and **no bundle measured** — every number below is quoted from web.dev, never produced here.

**"Server Components ship less JavaScript, therefore the site is faster" is true and almost useless, because it does not say *which* number moves. It is worth being precise: client JavaScript is main-thread work, main-thread work is what INP is made of, and INP is the metric that responds when you move a component to the server. LCP mostly does not — roughly 80% of an LCP budget is time to first byte and the time to fetch the largest resource, neither of which is affected by how much JavaScript you deleted. Worse, the boundary decisions in [chapter 1 · 03b](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md) that flip a route to request-time rendering push TTFB up, so it is entirely possible to halve your bundle and regress your headline metric in the same release. This page is about attributing a change to the decision that caused it.**

## The two metrics, with their real thresholds

**Largest Contentful Paint** — *"LCP reports the render time of the largest image, text block, or video visible in the viewport, relative to when the user first navigated to the page."* Candidate elements are `img`, `image` inside `svg`, `video`, elements with a CSS `url()` background image, and block-level elements containing text.

| LCP | Threshold |
|---|---|
| Good | **2.5 seconds or less** |
| Needs improvement | between 2.5 and 4.0 seconds |
| Poor | greater than 4.0 seconds |

**Interaction to Next Paint** — *"INP is a metric that assesses a page's overall responsiveness to user interactions by observing the latency of all click, tap, and keyboard interactions that occur throughout the lifespan of a user's visit to a page."*

| INP | Threshold, quoted |
|---|---|
| Good | *"An INP below or at 200 milliseconds means a page has good responsiveness."* |
| Needs improvement | *"An INP above 200 milliseconds and below or at 500 milliseconds means a page's responsiveness needs improvement."* |
| Poor | *"An INP above 500 milliseconds means a page has poor responsiveness."* |

🔴 **Both are defined at the 75th percentile of real page views** — LCP *"segmented by device type"*, INP over *"all page views"*. That is not a footnote. A local Lighthouse run on a fast laptop over a fast connection is one sample from the good end of a distribution whose 75th percentile is the thing being graded. Boundary work is judged in the field or it is not judged.

## 🔴 Where a boundary decision actually lands

| Decision | Effect on LCP | Effect on INP |
|---|---|---|
| Move a non-interactive component off the client | little to none | **direct** — less to download, parse, execute and hydrate |
| Move `'use client'` down toward the leaves | little to none | **direct** — smaller hydration units |
| Move expensive data-to-UI work to the server | small, indirect | **direct** — the library never reaches the browser |
| Something reads `cookies()` and the route goes dynamic | **direct and negative** — TTFB rises | none |
| Add an `<Activity>` boundary | none | **direct** — selective hydration splits one long task |
| Ship a large third-party client component | small | **direct and negative** |

Two of the six rows move LCP. Four move INP. That asymmetry is the shape of this whole subject.

## Why LCP barely notices your bundle

Every LCP breaks into four sub-parts, and web.dev publishes the breakdown a well-tuned page should have:

| Sub-part | Definition, quoted | Recommended share |
|---|---|---|
| Time to First Byte | *"The time from when the user initiates loading the page until the browser receives the first byte of the HTML document response."* | **~40%** |
| Resource load delay | *"The time between TTFB and when the browser starts loading the LCP resource."* | **&lt;10%** |
| Resource load duration | *"The duration of time it takes to load the LCP resource itself."* | **~40%** |
| Element render delay | *"The time between when the LCP resource finishes loading and the LCP element rendering fully."* | **&lt;10%** |

**Roughly 80% of the budget is TTFB plus fetching the LCP resource.** Neither is a function of how much client JavaScript you ship. If your LCP element is a hero image, the win is in the image and the connection. If it is a block of text rendered into the server HTML, it paints before hydration runs at all — meaning the JavaScript you just deleted was never on the LCP path.

The place client JavaScript *does* enter LCP is render delay, and only in the shapes where the largest element cannot appear until script has run:

- the LCP element is rendered by a Client Component with no server-rendered output (a chart, a client-only carousel);
- a render-blocking resource sits in the `head` — *"Style sheets loaded from the HTML markup will block rendering of all content that follows them"*, and synchronous scripts do the same;
- the LCP element is inside a Suspense boundary whose data has not resolved.

**And the mechanism that moves LCP the most is not the bundle at all — it is TTFB.** A route that was prerendered and becomes request-time rendered now runs your code, and possibly your slowest query, before the first byte. That is up to 40% of the budget moving in the wrong direction, caused by a `cookies()` call in a shared layout that nobody associated with performance. See [chapter 1 · 03b](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md).

## Why INP is the metric the boundary owns

An interaction has three phases: **input delay** before the event handlers start, **processing duration** while the callbacks run, and **presentation delay** until the frame is painted. web.dev names the cause of the first directly: *"Long tasks on the main thread"* can prevent event handlers from running promptly.

Client JavaScript feeds all three:

1. **Download and parse** — every byte of the client bundle is bytes the main thread eventually compiles.
2. **Hydration** — attaching React to server-rendered HTML is a single main-thread pass whose length is proportional to the size of the client tree. An interaction arriving during it queues behind it, which is input delay.
3. **Re-render cost** — a client boundary placed high in the tree owns more of the page, so more of the page re-renders per interaction, which is processing duration.

So the push-down rule from [chapter 1 · 03](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) is an INP rule with a bundle-size side effect, not the other way round. And `<Activity>` earns its place here too: its boundaries *"participate in Selective Hydration"*, letting React hydrate in chunks rather than in one long task — see [04b](04b-activity-and-offscreen-state.md).

## "Zero JavaScript" is not zero bytes

A Server Component ships no JavaScript **of its own**, and people round that to "free". It is not. Its rendered output travels as the RSC payload — *"a compact, serialized representation of the rendered React Server Components tree"* — which carries the rendered result of Server Components, placeholders and script references for Client Components, and every prop passed across the boundary. That is a download, it is parsed, and on client-side navigation it is fetched again for the new segment.

Two consequences that matter for the metrics:

- **A very large server-rendered list is a large payload.** Moving a 5,000-row table from client rendering to server rendering removes the table library from the bundle and adds 5,000 rows of serialized output to every request for that route. That is usually still a win, and it is not a free one — pagination and virtualisation remain the actual fix.
- **Fat props are paid twice.** A prop crossing to a Client Component is serialized into the payload *and* rehydrated in the browser. Passing an entire row when the component renders three fields inflates the payload and the hydration pass, and neither shows up in a bundle-size number at all. This is the performance argument for the field projection that [05b](05b-what-server-only-does-not-protect.md) argues for on security grounds — the same discipline, two reasons.

## What to look at, and how to attribute a change — [06b](06b-measuring-the-boundary.md)

The mechanism above tells you which metric *should* move. Turning that into a diagnosis needs a toolchain: the module-graph analyzers and their import-chain view, field instrumentation with `useReportWebVitals`, the two config levers the documentation names, and an ordered procedure for pinning a regression on a specific boundary decision. That is [06b](06b-measuring-the-boundary.md).


## Gotchas

**★ Symptom: a big refactor moved half the page to Server Components and LCP is unchanged.** Cause: the LCP element was server-rendered text that painted before hydration, so it was never on the JavaScript path — and roughly 80% of the LCP budget is TTFB plus fetching the LCP resource, neither of which the refactor touched. Fix: this is not a failure. Check INP, which is the metric that should have moved, and take LCP work to the image and the server response instead.

**★ Symptom: the client bundle shrank and LCP got worse.** Cause: the same release introduced a request-time read, so the route stopped being prerendered and TTFB rose — up to ~40% of the LCP budget. Fix: find the `cookies()`, `headers()` or `searchParams` read and push it into the component that needs it, behind its own Suspense boundary, so the shell still streams immediately.

**★ Symptom: Lighthouse is green in CI and the field data is amber.** Cause: the thresholds are defined at the 75th percentile of real page views, segmented by device type for LCP. One lab run on fast hardware is a sample from the good tail. Fix: instrument with `useReportWebVitals` and grade against your own distribution; keep the lab run for detecting regressions, not for declaring compliance.

**★ Symptom: INP is bad only during the first few seconds of a page's life.** Cause: hydration is a main-thread pass proportional to the client tree, and an interaction arriving during it queues behind it — that is input delay, which web.dev attributes to *"long tasks on the main thread"*. Fix: shrink the client tree by pushing the boundary down, and split what remains with `<Activity>` boundaries so React can hydrate in chunks.

**★ Symptom: a page with almost no client JavaScript is still slow to navigate to.** Cause: the RSC payload is a download too — the "no JavaScript" claim is about the bundle, not about bytes on the wire, and a large server-rendered tree produces a large payload that is fetched on every navigation to that segment. Fix: reduce what the route renders, not just what it ships — paginate, virtualise, and narrow the props crossing each boundary.

**★ Symptom: LCP is poor and the largest element is a chart.** Cause: the LCP candidate list includes images, videos, `url()` backgrounds and block-level text — and a chart drawn by a Client Component has no server-rendered output, so it cannot paint until its chunk has downloaded, parsed and run. That is render delay, which should be under 10% of the budget. Fix: render a server-side placeholder of the right size and shape so something paints early, or move the rendering to the server entirely when the output is static.

**Symptom: streaming was added to fix a slow route and LCP did not improve.** Cause: the shell that streams first contains no LCP candidate — navigation and a skeleton are not the largest contentful element, so the metric still waits for the real content. Fix: make sure something that can *be* the LCP element is in the immediately-streamed shell, typically the hero image or the heading, rather than only chrome.

**Symptom: CLS regressed after moving rendering to the server.** Cause: not a boundary issue — layout shift comes from content arriving without reserved space, and streaming a Suspense fallback that is a different size from the resolved content produces exactly that. Fix: size the fallback to match; this is a skeleton problem, not a Server Components problem.

## Interview questions

**★ Which Core Web Vital improves when you move a component from the client to the server, and which does not?**
INP improves; LCP usually does not. Client JavaScript is main-thread work — download, parse, hydrate, re-render — and the main thread is what an interaction competes with, so removing it directly reduces input delay and processing duration. LCP is dominated by two things a bundle change does not touch: web.dev's recommended breakdown puts about 40% of the budget in TTFB and about 40% in the time to load the LCP resource, with under 10% each in resource load delay and element render delay. Unless the largest element is itself client-rendered, the JavaScript you removed was not on the LCP path at all.

**★ How can a release that halves the client bundle make LCP worse?**
By changing the rendering strategy in the same commit. If anything in the route — including a shared layout the change did not obviously touch — starts reading `cookies()`, `headers()` or `searchParams`, the route stops being prerendered and the server runs code before emitting the first byte. TTFB is around 40% of the LCP budget, so that alone can outweigh a bundle win entirely. The tell is the sub-part breakdown: TTFB up, render delay flat.

**★ Why is a green Lighthouse score not evidence that a boundary decision worked?**
Because the thresholds are defined against field distributions, not single runs. LCP is graded at the 75th percentile of page loads segmented by device type, and INP at the 75th percentile of all page views. A local run is one sample, taken on hardware and a connection that sit at the good end of that distribution, and hydration cost in particular scales with device speed in a way that a developer laptop hides. `useReportWebVitals` with results posted via `sendBeacon` gives you the distribution you are actually being graded on.

**★ Where does hydration show up in INP, exactly?**
In input delay, mostly. Hydration is a main-thread pass whose length scales with the size of the client component tree, and web.dev attributes input delay to long tasks on the main thread preventing event handlers from running promptly. So a click that lands during hydration waits for it, and the user experiences the whole pass as the latency of their click. That is why a client boundary placed high in the tree is an INP problem even when the components inside it are individually cheap — and why `<Activity>` boundaries help, since they let React hydrate in chunks instead of in one pass.

**★ Do Server Components really cost the browser nothing?**
They cost no JavaScript, which is not the same claim. Their rendered output travels as the RSC payload — a serialized representation of the rendered tree, including placeholders and references for Client Components and every prop passed across the boundary — and that payload is downloaded, parsed, and refetched per segment on client-side navigation. So moving a very large rendered tree to the server converts bundle bytes into payload bytes rather than eliminating them. It is normally still the right trade, because payload bytes do not have to be compiled or hydrated, but "zero JavaScript" is a statement about one column of the cost, not the whole row.

**Which element ends up being the LCP element, and why does that decide whether your work mattered?**
LCP considers images, `image` elements inside SVG, videos, elements with a CSS `url()` background, and block-level elements containing text — the largest of those in the viewport. That identity decides everything downstream: if it is server-rendered text, it paints from the HTML before any script runs, and removing client JavaScript cannot help it. If it is a hero image, the levers are the image itself and the connection. Only when the largest element is produced by client code — a chart, a client-only carousel — does the bundle sit on the LCP path, and then the problem is render delay, which web.dev budgets at under 10%. Identifying the element is therefore the first step, not an optimisation detail.

**A route is fast for you and slow for users on a mid-range Android. What is the most likely cause and which metric shows it?**
Hydration and script execution, showing up as INP rather than LCP. Parse and execute time scales with CPU, so a client tree that costs a few tens of milliseconds on a developer machine can produce a long task on a mid-range phone, and any tap landing in that window is delayed. LCP is comparatively less sensitive because its budget is dominated by network time, which the device does not change much. This is also the case that makes field measurement non-optional: the difference between the two devices is invisible in every metric you can collect locally.

---

← Prev [05b · What it does not protect](05b-what-server-only-does-not-protect.md) · [Index](01-explanation.md) · Next → [06b · Measuring the boundary](06b-measuring-the-boundary.md)
