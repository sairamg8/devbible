---
title: "The `worker` strategy is the one honest answer to main-thread contention and you cannot use it — it is experimental, it is `pages/`-only, and on the App Router the real levers are fewer scripts, later scripts and scripts on fewer routes"
sidebar_label: "05d · worker and Partytown"
sidebar_position: 20
description: "What the experimental worker strategy does, the Partytown dependency, why it is unavailable on the App Router at 16.3.4, the component's version history and what it reveals, and the App Router alternatives for getting third-party code off the main thread."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (doc `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [Optimizing third-party scripts](https://nextjs.org/docs/app/guides/scripts) (`lastUpdated: 2026-06-01`).
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**, so no package probe was possible. 🔴 **Partytown's own documentation could not be reached at the time of writing** — three URLs were attempted and none resolved — so this page describes only what the Next.js documentation states about it and marks the rest as unconfirmed. **No sandbox run**; no timings.

**Third-party JavaScript is the largest source of main-thread work on most production sites, and the main thread is where your interaction latency is decided. The `worker` strategy is Next.js's answer to that: move the vendor's code onto a web worker so it cannot block a click. It is also, at 16.3.4, unavailable to you — it is experimental, it requires a third-party runtime, and its own documentation says it does not work with the App Router. This page exists so that you can recognise it in a code review, know why the snippet you found online does not apply, and know what to do instead. The honest App Router answer is unglamorous and effective: load fewer third-party scripts, load them later, and load them on fewer routes.**

## What it claims to do

> *"Scripts that use the `worker` strategy are off-loaded to a web worker in order to free up the main thread and ensure that only critical, first-party resources are processed on it. While this strategy can be used for any script, it is an advanced use case that is not guaranteed to support all third-party scripts."*

The motivation is exactly right. A worker has its own thread, so a tag manager's parsing, a session-replay recorder's serialization and an ad script's polling are all work your click handler is no longer queued behind. This is the INP problem stated as an architecture: see [web vitals · reducing INP](../../../web-vitals-performance/pages/05-inp-optimization/01-reducing-inp.md) for why main-thread occupancy is the metric that moves.

The caveat in the same sentence is equally important. A web worker has **no DOM**. A vendor script that reads `document`, sets cookies, measures the viewport or injects a widget — which is most of them — cannot simply be relocated to a worker and expected to function. That is why the strategy is described as *"not guaranteed to support all third-party scripts"* rather than as a universal switch.

## Why you cannot use it

Two blocking statements, both verbatim, both repeated on the guide and the reference:

> *"**Warning:** The `worker` strategy is not yet stable and does not yet work with the App Router. Use with caution."*

> *"`worker` scripts can **only currently be used in the `pages/` directory**"*

If your application is App Router — which everything else in this chapter assumes — the strategy is off the table. This is the single most common source of confusion around `next/script`, because the strategy is fully documented alongside the other three, appears in the same list, and is type-valid. Nothing about writing `strategy="worker"` in an App Router file looks wrong.

## The configuration, for completeness

On the Pages Router it is opt-in behind an experimental flag:

```js
// next.config.js
module.exports = {
  experimental: {
    nextScriptWorkers: true,
  },
}
```

```jsx
// pages/_app.jsx — Pages Router only
import Script from 'next/script'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Script src="https://cdn.example-analytics.com/tag.js" strategy="worker" />
      <Component {...pageProps} />
    </>
  )
}
```

And the runtime it depends on:

> *"Scripts that use the `worker` strategy are offloaded and executed in a web worker with Partytown."*

The guide documents that the dev server tells you to install it, with the instruction string `Please install Partytown by running npm install @qwik.dev/partytown`. The `@qwik.dev` scope is worth noting when you are searching: a great deal of the writing about Partytown predates that scope, so snippets naming a different package name are not necessarily wrong, merely older than the one Next.js asks for today.

🔴 **How Partytown gives worker-hosted code access to the DOM is not explained by the Next.js documentation, and its own documentation could not be reached while writing this page.** There is a well-known general answer in circulation involving proxied, synchronous access back to the main thread, but *this page will not state a mechanism it could not verify against a primary source.* If you are evaluating the strategy seriously, that mechanism — and its performance characteristics, which are the entire question — is the thing to read first.

## The version history says something the prose does not

| Version | Change |
|---|---|
| `v13.0.0` | `beforeInteractive` and `afterInteractive` modified to support `app` |
| `v12.2.4` | `onReady` prop added |
| `v12.2.2` | `beforeInteractive` allowed in `_document` |
| `v11.0.0` | `next/script` introduced |

🔴 **There is no entry newer than `v13.0.0`.** The component's surface has not changed since the App Router shipped. Read that alongside the `worker` warning and the conclusion is uncomfortable but useful: `worker` has been experimental and Pages-Router-only across four major versions, and nothing in the published history suggests movement. ⚠️ **The documentation states no plan, timeline or intent to stabilise it or to bring it to the App Router**, and this page does not infer one. Treat it as a feature that exists, not one that is arriving.

## What to do instead, on the App Router

None of these is a worker. All of them are available today.

**Remove the script.** The cheapest third-party script is the one nobody could justify in a review. Ask what decision each tag informs and who reads it; a surprising number of tags outlive the person who added them and the question they were added to answer.

**Load it later.** `lazyOnload` puts the script in browser idle time after all page resources are fetched — see [05](05-next-script-loading-strategies-for-third-party-scripts.md). It does not remove main-thread work, but it moves it out of the window where the user is trying to interact for the first time, which is where INP is measured.

**Load it on fewer routes.** A tag in `app/(marketing)/layout.tsx` instead of `app/layout.tsx` removes the script entirely from every authenticated route — see [05c](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md). This is usually the largest available win and it costs one line.

**Move the work to the server.** Anything whose purpose is to record an event can be recorded by your own code, on your own server, without a vendor's script on the page at all. A Server Action or Route Handler that forwards an event to the vendor's HTTP API costs the client one `fetch` instead of a bundle — and it survives ad blockers, which the client-side tag does not.

```ts
// app/api/track/route.ts — first-party endpoint, no vendor script on the page
export async function POST(request: Request) {
  const event = await request.json()
  await fetch('https://api.example-analytics.com/v1/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.ANALYTICS_SERVER_KEY!}`,
    },
    body: JSON.stringify({ ...event, ts: Date.now() }),
  })
  return new Response(null, { status: 204 })
}
```

**Consider `@next/third-parties`.** Next.js publishes a package of optimised wrappers for common vendors — [chapter 10's CSP page](../10-forms-authentication-and-security-hardening/11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md) imports `GoogleTagManager` from `@next/third-parties/google`. ⚠️ **Neither `next/script` page covers it and its API reference was not fetched in this pass**, so what it optimises and how is not something this page can state. Read its own reference before adopting it.

## Gotchas

**★ Symptom: `strategy="worker"` was shipped in an App Router application and the script loads on the main thread — or not at all.** Cause: the strategy is documented as not working with the App Router and usable *"only currently … in the `pages/` directory"*. ⚠️ Which of those two outcomes you get is not documented. Fix: pick a strategy that exists for your router, and get the win from placement instead:

```tsx
// app/(marketing)/layout.tsx
<Script src="https://cdn.example-analytics.com/tag.js" strategy="lazyOnload" />
```

**★ Symptom: `experimental.nextScriptWorkers: true` is in `next.config.js` and appears to do nothing.** Cause: the flag enables a Pages Router feature; an App Router build has no `worker` scripts to act on. Fix: remove the flag. A stale experimental flag is worse than no flag — it reads as an active decision to the next person, and experimental keys change meaning between majors.

**★ Symptom: a vendor script moved to a worker on a Pages Router app and its widget never renders.** Cause: a worker has no DOM, and the docs warn the strategy is *"not guaranteed to support all third-party scripts"*. Anything that injects UI, reads layout or sets cookies is in that category. Fix: reserve the strategy for scripts that only compute and phone home — and verify per vendor, not per category. There is no list of which scripts survive it.

**★ Symptom: an INP regression was blamed on the framework after a third-party tag was added.** Cause: main-thread contention from vendor code, which no rendering strategy addresses — the script runs on the same thread as your event handlers whichever strategy created its tag. Fix: measure which script, then remove it, scope it, or move its job to the server. [Reducing INP](../../../web-vitals-performance/pages/05-inp-optimization/01-reducing-inp.md) is the diagnostic path; the fix is nearly always fewer scripts rather than differently-loaded ones.

**Symptom: a blog post's Partytown setup does not match what the Next.js dev server asks for.** Cause: the package the docs name today is `@qwik.dev/partytown`, and much of the available writing predates that scope. Fix: follow the instruction the dev server prints rather than a post, and check the package name in `package.json` against it before debugging anything else.

**Symptom: analytics events stop arriving for a segment of users and no error is reported.** Cause: blocklists remove vendor hostnames outright — a problem that no loading strategy solves, because the request never leaves the browser. Fix: this is the strongest argument for the first-party endpoint above. Events posted to your own origin are not on anyone's third-party blocklist, and you keep an `onError` fallback ([05b](05b-onload-onready-onerror-and-the-client-component-boundary.md)) for whatever still loads client-side.

## Interview questions

**★ What problem does the `worker` strategy solve that the other three do not?**
Thread contention. `beforeInteractive`, `afterInteractive` and `lazyOnload` all differ in *when* a script runs, and all three run it on the main thread — the same thread that handles clicks and keystrokes. A tag that occupies 200ms of main thread is 200ms of potential interaction delay regardless of when it is scheduled. `worker` is the only option that changes *where* the code runs rather than when, which is why it is the only one that addresses INP directly rather than by rescheduling.

**★ Why can you not use it on the App Router today?**
Because the documentation says so, in two places: the strategy *"is not yet stable and does not yet work with the App Router"*, and worker scripts *"can only currently be used in the `pages/` directory"*. It has been in that state across several majors, and the component's published version history has no entry newer than `v13.0.0`. There is no documented plan to change it, so the correct posture is to design without it rather than to wait for it.

**★ Why is a web worker a poor host for most third-party scripts?**
Because a worker has no DOM, no `window` as the page defines it, and no direct access to cookies or layout — and the majority of vendor scripts do at least one of those things. That is why the docs call it *"an advanced use case that is not guaranteed to support all third-party scripts"* rather than a general optimisation. The scripts that can survive relocation are the ones that only compute and transmit; anything that renders a widget or measures the page is not a candidate.

**★ Your INP is poor and a vendor tag is the cause. Rank your options on the App Router.**
Remove the tag if its output is not read by anyone — most effective, most often available, and least often attempted. Scope it to the routes that need it, which frequently eliminates it from every authenticated page for one line of diff. Move the work server-side, so the client posts an event to your own endpoint and the vendor never ships JavaScript to the page — this also survives ad blockers. Only then consider loading it later with `lazyOnload`, which moves the cost out of the first interaction window without reducing it.

**Why is a first-party tracking endpoint a better answer than a worker in practice?**
Because it removes the vendor's code from the client entirely instead of relocating it. There is no bundle to download, no main-thread work to schedule, no DOM-access compatibility question, and no blocklist to defeat — the request goes to your own origin. The costs are real and worth stating: you own an endpoint, its rate limiting and its abuse surface, and you lose whatever automatic instrumentation the vendor's script performed. For event-based analytics that trade is usually good; for session replay it is not available at all.

**What does it tell you that `next/script`'s version history stops at `v13.0.0`?**
That the component's public surface has been stable across the App Router's entire life, which is reassuring for the three strategies you can use and discouraging for the one you cannot. Stability here is not neglect — the API is small and the three usable strategies work — but it is evidence against the assumption that `worker` is a feature in progress. Reading a version history for what is *absent* is a habit worth keeping: it is often the clearest signal a documentation page emits.

---

← [05c · Inline scripts and placement](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md) · [Chapter index](01-explanation.md) · Next → [06 · Milestone: SprintDesk design system pass](06-project-milestone-sprintdesk-design-system-pass.md)
