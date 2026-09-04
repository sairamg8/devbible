---
title: "Every Suspense boundary is a layout-shift risk, a hydration unit and a delay on whatever it contains, so the right number of them is the smallest number that does the job"
sidebar_label: "05c · Skeletons and layout shift"
sidebar_position: 121
description: "Why a skeleton must match the dimensions of what replaces it, why an LCP element inside a boundary waits for a script even when its image is preloaded, what boundaries do for INP, and React's warning that it may use a boundary you did not expect it to."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) — page metadata
> `version: 16.3.4`, `lastUpdated: 2026-08-25`; its "Streaming and Web Vitals" section, including
> the "Good to know" note about when React uses a boundary, is quoted verbatim below — and
> React's [`<Suspense>`](https://react.dev/reference/react/Suspense) reference, which the guide
> links for what activates a boundary. Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no timings**.

**A skeleton is a promise about size, and a boundary is a promise about time — breaking either
one is a measurable regression rather than a cosmetic one.** The parts of streaming that show up
in Web Vitals are not the parts people tune. Teams spend effort on how a skeleton *looks* and
almost none on whether it is the same height as the content it stands in for, which is the only
property that decides whether the page jumps when it resolves. And the instinct that more
boundaries means a smoother page is wrong in a specific, documented way: a boundary you added for
one slow query is a boundary React may choose to use for something else entirely.

## CLS: the skeleton's only job that is measurable

> *"When a Suspense fallback is replaced by the resolved content, the browser reflows the page. If
> the fallback and the resolved content are different sizes, the surrounding layout shifts."*

The two documented mitigations:

> - *"Design skeleton fallbacks that **match the dimensions** of the content they represent. A
>   skeleton with the same height and width as the final card grid prevents shifts."*
> - *"Use fixed or min-height containers around Suspense boundaries so the space is reserved
>   before content arrives."*

```tsx
// app/dashboard/revenue-skeleton.tsx
// The chart renders at exactly h-64; the skeleton reserves exactly h-64.
export function RevenueSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-lg bg-gray-200" aria-busy="true">
      <span className="sr-only">Loading revenue</span>
    </div>
  )
}
```

```tsx
// app/dashboard/page.tsx — the container reserves the space regardless of which child is in it
<div className="min-h-64">
  <Suspense fallback={<RevenueSkeleton />}>
    <Revenue />
  </Suspense>
</div>
```

🔴 **A variable-height list is where this gets hard**, and the honest answer is to constrain the
container rather than to guess the content. A skeleton showing five rows for a list that usually
has twelve shifts every time; a container with a `min-height` sized to the common case shifts
rarely and by less.

## LCP: a boundary delays what is inside it, and `preload` does not fix that

> *"If your LCP element (a hero image, a main heading, a product photo) is inside a Suspense
> boundary, it can't paint until that boundary's content is swapped in. The element then depends
> on the work the server does to render it, not on your initial server response time. Revealing
> it costs something on the client too, because React streams a small inline script alongside the
> boundary's HTML and the content only appears once that script runs."*

And a second reason, which has nothing to do with your data:

> *"Data fetching is not the only reason a boundary delays your LCP element. React also holds
> back a large boundary, because sending its HTML takes time."*

The guidance:

> - *"Keep LCP elements **outside** or **above** Suspense boundaries so they render as part of
>   the static shell."*
> - *"Use the `preload` prop on `next/image` for LCP images. This injects a
>   `<link rel="preload">` into the `<head>`, so the browser starts fetching the image from the
>   very first chunk, before the `<img>` tag even appears in the HTML. It controls when the image
>   is fetched, not when it paints. An image inside a boundary still waits for the swap."*
> - *"For non-image LCP elements (text, headings), render them outside Suspense boundaries."*

⚠️ **"It controls when the image is fetched, not when it paints"** is the sentence that
invalidates the usual workaround. Adding `preload` to a hero image inside a boundary makes the
bytes arrive early and the pixels arrive exactly as late as before.

## INP: a boundary is a hydration unit

> *"Streaming enables selective hydration: React hydrates components independently as they stream
> in, and prioritizes hydrating whatever the user is interacting with. Each `<Suspense>` boundary
> is a hydration unit. Without them, React hydrates the entire page in one blocking pass. With
> them, hydration is broken into smaller tasks that yield to the browser, keeping the main thread
> responsive."*

This is the one metric where more boundaries is straightforwardly better, and it is worth
weighing against the LCP and CLS costs rather than treating "add a boundary" as uniformly good or
uniformly bad. A heavy interactive widget benefits from its own boundary even if its data is
fast, because it becomes its own hydration task.

## The warning that should change how you place boundaries

> **Good to know:** *"As a rule of thumb, if there's a Suspense boundary, React might use it.
> Under a slow network or a busy CPU, concurrent rendering can fall back to it even when you
> didn't expect it. Adding a boundary means accepting that, so don't add one you don't need."*

🔴 **This makes an unused boundary a liability rather than a no-op.** A boundary added
"defensively" around fast content can still show its fallback on a slow device — so a placeholder
you never expected a user to see is a placeholder you have to design properly anyway, and a flash
you have to accept.

## TTFB and FCP, for completeness

> *"Without streaming, the server waits for all data before sending any HTML, so TTFB equals the
> slowest query. With streaming, the server sends the static shell as soon as it's ready. TTFB
> drops to the time it takes to render your layouts and fallbacks. The browser paints the static
> shell immediately, so FCP is decoupled from your data fetching time."*

Note what this implies for monitoring: **improving TTFB by adding a boundary is not the same as
improving the page.** The shell arrives sooner and the content does not arrive any sooner at all.
A TTFB improvement with no corresponding LCP improvement usually means the boundary moved the
measurement rather than the experience.

## Gotchas

### The page jumps when the skeleton resolves
**Symptom.** Content below the boundary shifts down (or up) the moment the real content swaps in,
and CLS is flagged in the field data.
**Cause.** The fallback and the resolved content are different sizes, so the browser reflows.
**Fix.** Match the dimensions, or reserve the space on the container so the boundary's height is
the same either way — both are documented mitigations, and the container version is more robust
because it survives changes to the skeleton.

### `preload` on a hero image that is still slow to paint
**Symptom.** The LCP image is preloaded, the network panel shows it arriving early, and LCP does
not improve.
**Cause.** The image is inside a Suspense boundary. `preload` controls when it is fetched, not
when it paints; the element still waits for the boundary's swap.
**Fix.** Move the LCP element above the boundary so it is part of the static shell. If it cannot
be — the image comes from the data being awaited — then the LCP is genuinely gated on that
query, and the fix is to make the query faster or to render a meaningful placeholder that can
itself be the LCP element.

### A "defensive" boundary that shows an unstyled fallback on slow devices
**Symptom.** A minimal `fallback={null}` or a bare "Loading…" appears in field screenshots from
low-end devices around content that is fast on a developer machine.
**Cause.** React may fall back to any boundary under a slow network or busy CPU, whether or not
you expected it to.
**Fix.** Either remove the boundary — the guidance is *"don't add one you don't need"* — or give
it a fallback you are willing to have users see.

### A large boundary that delays its own content
**Symptom.** A boundary's content is ready quickly and still appears late.
**Cause.** React holds back a large boundary because sending its HTML takes time; the delay is
not about your data at all.
**Fix.** Split a very large boundary into several smaller ones, or move the parts that are cheap
to render out of it and into the shell.

### `aria-busy` and a screen reader that announces nothing
**Symptom.** A sighted user sees a shimmer; a screen reader user gets silence, then content
appears with no indication that anything happened.
**Cause.** A visual skeleton carries no accessible text, and the swap is not announced.
**Fix.** Give the fallback an accessible name and mark the region busy, so the transition is
perceivable.

```tsx
export function OrdersSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="min-h-48 animate-pulse">
      <span className="sr-only">Loading recent orders</span>
    </div>
  )
}
```

### Chasing a TTFB improvement that users cannot feel
**Symptom.** TTFB halves after boundaries are added; LCP and user-reported speed are unchanged.
**Cause.** Streaming moves the shell earlier without making the data faster. TTFB now measures
how long it takes to render layouts and fallbacks, which is a different quantity than it was
before.
**Fix.** Track LCP and INP alongside it. TTFB after streaming is a measure of the shell, not of
the page.

### A skeleton designed for the empty case
**Symptom.** The skeleton shows one row; real data shows twenty; the page grows by a screenful on
resolve.
**Cause.** The skeleton was drawn to look tidy rather than to reserve the typical space.
**Fix.** Size the fallback for the common case, not the minimum. A skeleton is a size
reservation that happens to look like content, not the other way round.

## Interview questions

**★ What decides whether a Suspense boundary causes layout shift?**
Whether the fallback and the resolved content occupy the same space. When the fallback is
replaced the browser reflows; if the two are different sizes, everything around them moves. The
documented fixes are to match the skeleton's dimensions to the content or to reserve the space on
a container with a fixed or minimum height.

**★ Does `preload` on a `next/image` fix an LCP element that sits inside a boundary?**
No. It injects a `<link rel="preload">` so the browser starts fetching from the first chunk, but
the guide is explicit that it *"controls when the image is fetched, not when it paints"* — an
image inside a boundary still waits for the swap. The real fix is to keep the LCP element outside
or above the boundary.

**★ Why might a boundary delay content that was ready quickly?**
Because React holds back a large boundary — sending its HTML takes time — and because revealing a
boundary costs a client-side step: React streams a small inline script alongside the boundary's
HTML, and the content appears only once that script runs. Neither has anything to do with how
fast your data was.

**★ How do Suspense boundaries affect INP?**
Each boundary is a hydration unit. Without them React hydrates the whole page in one blocking
pass; with them hydration is split into smaller tasks that yield to the browser, and React
prioritises hydrating whatever the user is interacting with. This is the metric where more
boundaries genuinely helps.

**★ Is there a cost to adding a boundary you do not think will ever be used?**
Yes, and the guide states it as a rule of thumb: if there is a boundary, React might use it. Under
a slow network or a busy CPU, concurrent rendering can fall back to it unexpectedly — so an
unused boundary is a fallback you may still have to design and a flash users may still see. The
advice is not to add one you do not need.

**★ Streaming improved TTFB dramatically and users say the page feels the same. Explain.**
TTFB now measures the time to render layouts and fallbacks rather than the time to complete the
slowest query, because the shell is sent as soon as it is ready. The data takes exactly as long as
it did before. FCP improves with the shell; LCP only improves if the largest element is in the
shell too.

**★ How should a skeleton be sized when the content's height varies?**
For the common case, with the space reserved on the container rather than inside the skeleton.
Sizing to the minimum guarantees a shift on almost every load; a container with an appropriate
`min-height` bounds the shift regardless of what the fallback itself looks like.

**★ What makes a skeleton accessible?**
An accessible name and a busy state, so the wait is perceivable rather than purely visual. A
shimmer is invisible to a screen reader; `aria-busy` with visually-hidden text describing what is
loading turns it into information. The same reasoning as the `aria-live` region on a returned
form error in [01c](01c-the-typed-action-result-and-reading-it-back.md).

---

← [05b · The layout that blocks your skeleton](05b-the-layout-that-stops-your-skeleton-appearing.md) · **Next → [06 · Retry, fallback and graceful degradation](06-retry-fallback-and-graceful-degradation-patterns.md)**
