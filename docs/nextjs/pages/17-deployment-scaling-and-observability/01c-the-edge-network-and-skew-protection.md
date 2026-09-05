---
title: "126 points of presence in front of 20 compute regions is a caching decision, not a marketing number — and skew protection is the feature that decides which of your immutable deployments a given client keeps talking to"
sidebar_label: "01c · Edge network and skew protection"
sidebar_position: 3
description: "PoPs versus compute regions and why density raises cache hit rate, then version skew in full: what the framework pins, what it deliberately does not, the ?dpl parameter, x-deployment-id, the __vdpl cookie, maximum age, and the crawler exception."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Global network and regions](https://vercel.com/docs/regions) (`last_updated: 2026-08-11`) and [Skew Protection](https://vercel.com/docs/skew-protection) (`2026-08-28`) on vercel.com, cross-checked against the Next.js [Self-hosting guide § Version Skew](https://nextjs.org/docs/app/guides/self-hosting) (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run**, no timings. Prior page: [01b · Environments](01b-vercel-environments-and-the-build-time-runtime-split.md).

**Two things about the network are worth carrying around. The first is architectural and mildly counter-intuitive: there are far more points of presence than compute regions, deliberately, because a request has to *arrive* somewhere close but the cache it hits should be *dense*. Spreading caches thinner would lower the hit rate that makes the whole thing fast. The second is the feature that exists because deployments are immutable: version skew. A user loaded your app twenty minutes ago; you deployed since; their next click asks for a JavaScript chunk and a Server Action ID that no longer exist. Skew protection pins framework-managed requests to the deployment that served the page — and the important part, the part that produces every surprise, is the precise list of what it does *not* pin.**

## PoPs, regions and why they are different counts

> *"**Points of Presence (PoPs)**: We operate over 126 PoPs distributed across the globe. These PoPs serve as the first point of contact for incoming requests, ensuring low-latency access for users worldwide."*

> *"**Vercel Regions**: Behind these PoPs, we maintain 20 compute-capable regions where your code can run close to your data."*

> *"**Private Network**: Traffic flows from PoPs to the nearest region through private, low-latency connections"*

The design reasoning is stated outright, and it is the useful part:

> *"By maintaining fewer, dense regions, we increase cache hit probability. This means that popular content is more likely to be available in each region's cache."*

A cache split 126 ways holds 1/126th of your traffic each and misses constantly; a cache split 20 ways is six times denser. So the PoP's job is not caching — it is arriving:

> *"PoPs terminate TCP and route requests over a private network to the nearest Vercel region with single-digit millisecond latency."*

> *"The Vercel region the request is routed to handles TLS encryption and decryption."*

Note where TLS terminates: at the **region**, not the PoP. And regional failure is handled by rerouting rather than by degradation — *"In the event of regional downtime, application traffic is automatically rerouted to the next closest region."*

The practical takeaway for a Next.js app: **the network makes your static and cached responses fast almost for free, and does nothing at all for a route that runs a function on every request.** Everything you can move from the second category to the first is a latency win in every region simultaneously. That is the entire argument for the caching work in [chapter 5](../05-caching-ppr-and-cache-components/01-explanation.md) and [chapter 6](../06-ssg-isr-and-ssr-strategy/01-explanation.md), restated as infrastructure.

## Version skew, stated precisely

> *"Version skew occurs when different versions of your application run on client and server, causing application errors and other unexpected behavior."*

The Next.js self-hosting guide enumerates the three failure shapes, and they are worth memorising because each has a different symptom:

> *"**Missing assets**: The client requests JavaScript or CSS files that no longer exist on the server"*
> *"**Server Function mismatches**: The client invokes a Server Function using an ID from a previous build that the server no longer recognizes"*
> *"**Navigation failures**: Prefetched page data from an old deployment is incompatible with the new server"*

The first shows up as a chunk-load error. The second shows up as a failed form submission — a Server Action that returns an error the user cannot act on. The third shows up as a navigation that hangs or hard-reloads for no visible reason.

## What the framework pins, and what it does not

> *"the framework automatically includes the deployment ID in **framework-managed requests** from the client. These include: **Static assets**: JavaScript bundles, CSS files, and images loaded by the framework; **Client-side navigations**: Route transition data fetches and Server Actions; **Prefetches**: Route and data prefetch requests triggered by the framework"*

> *"The framework attaches the deployment ID as a `?dpl=` query parameter or `x-deployment-id` header, ensuring these requests resolve to the same deployment that served the initial page."*

Now the two exclusions, which are where every real incident starts.

🔴 **Your own client-side `fetch` calls are not pinned.**

> *"The framework doesn't automatically pin custom `fetch()` calls you make from client components. To pin those, pass the deployment ID yourself"*

So a Client Component polling `/api/board` every ten seconds is talking to *the latest* deployment while the rest of the page is pinned to the old one. If that route's response shape changed in the new deploy, you get a runtime error inside an otherwise perfectly version-locked page. The manual protocol is documented for exactly this:

```ts
// lib/pinned-fetch.ts
export function pinnedFetch(input: string, init?: RequestInit) {
  const enabled = process.env.NEXT_PUBLIC_VERCEL_SKEW_PROTECTION_ENABLED === '1'
  const id = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID

  if (!enabled || !id) return fetch(input, init)

  return fetch(input, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'x-deployment-id': id },
  })
}
```

The documented check is `VERCEL_SKEW_PROTECTION_ENABLED === '1'` plus `VERCEL_DEPLOYMENT_ID`; on Next.js those reach the browser under the framework prefix, which means they are inlined at build time — correct here, because the deployment ID you want *is* the one that built the artefact. This is one of the rare cases where `NEXT_PUBLIC_` inlining is the desired behaviour rather than the trap described in [01b](01b-vercel-environments-and-the-build-time-runtime-split.md).

🔴 **Full-page navigations are not pinned either.**

> *"**The framework doesn't pin full-page navigations by default.** When the browser makes a top-level document request, such as a hard refresh, entering a URL in the address bar, or opening a link in a new tab, Vercel serves the latest production deployment. If a new deployment went live since the user's last page load, the client detects the version mismatch and triggers a full page reload so the user receives the updated version."*

That is the intended behaviour and it is correct for most applications — the user is moving to a fresh document anyway, so give them the current one. Next.js describes the same mechanism from the framework side: on a mismatch, *"Next.js triggers a hard navigation (full page reload) instead of a client-side navigation"*, and warns about the consequence:

> *"When the application is reloaded, there may be a loss of application state if it's not designed to persist between page navigations. URL state or local storage would persist, but component state like `useState` would be lost."*

Which is the argument for keeping filter and pagination state in the URL — see [chapter 8](../08-state-management-in-an-rsc-world/01-explanation.md).

## Pinning document navigations with `__vdpl`

For sessions where a reload is unacceptable — the docs name live assessments, real-time audio or video, and multi-step workflows — there is an explicit opt-in:

> *"When Vercel receives a request with the `__vdpl` cookie set, it routes that request to the deployment ID stored in the cookie, including document navigations."*

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID

  if (deploymentId && !request.cookies.get('__vdpl')) {
    response.cookies.set('__vdpl', deploymentId, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    })
  }

  return response
}

export const config = {
  matcher: ['/exam/:path*', '/session/:path*'],
}
```

And it must be cleared, or the user is pinned to an ageing deployment indefinitely:

```ts
// app/actions.ts
'use server'

import { cookies } from 'next/headers'

export async function clearDeploymentPin() {
  const cookieStore = await cookies()
  cookieStore.delete('__vdpl')
}
```

⚠️ The matcher is not optional in practice. A `__vdpl` cookie set at `/` pins *everything* for that user, including routes you are actively fixing.

## Maximum age, retention, and the 404

> *"If a client requests a deployment that no longer exists or is older than the configured maximum age (via the `?dpl=` query parameter, `x-deployment-id` header, or `__vdpl` cookie), the request returns a 404."*

> *"The default maximum age is one day from deployment creation."*

> *"You can configure a maximum age up to your project's Deployment Retention limit."*

> *"Deployments that have been deleted either manually or automatically using a retention policy will not be accessible through Skew Protection."*

So there are two independent clocks — maximum age and retention — and the pinned client dies at whichever fires first. The docs give the clean configuration: when retention is short, set maximum age to the same value, since deployments are deleted before they could age out of the protection window; a low maximum age is only needed when retention is long and you want to limit how far back skew protection reaches.

There is also a break-glass control for a bad artefact: a **Custom Skew Protection Threshold** set on a deployment stops it and everything older from serving active clients.

## The crawler exception

> *"Vercel automatically adjusts the maximum age to 60 days for requests from Googlebot and Bingbot in order to handle any delay between document crawl and render."*

This is a real and non-obvious behaviour: a crawler may fetch the HTML today and render it weeks later, and without the extension every asset the render requests would 404 — producing a rendered page with no CSS and no JavaScript, scored as such. It also means crawler traffic can reach deployments long after you stopped thinking about them.

## Cross-origin: pinning is off by default

> *"By default, Skew Protection ignores the deployment ID on cross-origin requests. If another site fetches assets from your project with a `?dpl=` parameter or `x-deployment-id` header, Skew Protection does not pin the request to the specified deployment. Instead, the request is routed to the latest production deployment."*

The failure this causes is described exactly: a consumer bakes your asset URLs into its HTML at build time, you redeploy, and those pinned URLs route to a deployment where the old assets no longer exist — 404s and broken JavaScript on someone else's site. The fix is the **Allowed Domains for Cross-Site Fetch** list, configured *on the project that serves the assets*, up to 12 entries, with wildcards matching exactly one subdomain level.

## Enablement, and the one prerequisite people miss

> *"Projects created after November 19th 2024 using one of the supported frameworks already have Skew Protection enabled by default."*

> *"If you are using Next.js 14.1.4 or newer and building on Vercel, there is no additional configuration needed"*

But the first enablement step is a project setting, not a toggle on the feature itself:

> *"Ensure your project has the Enable access to System Environment Variables setting enabled"*

And prebuilt deployments are a documented special case:

> *"If you're building outside of Vercel using `vercel build` and then deploying with `vercel deploy --prebuilt`, Skew Protection requires a custom deployment ID so the build-time ID matches the one Vercel assigns at deploy time."*

Self-hosting gets the same mechanism through `deploymentId` in `next.config.js` — covered in [02b](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) and [17](17-choosing-a-deployment-target-beyond-vercel.md).

## Gotchas

**★ Symptom: the page is pinned to the old deployment but one polling widget throws on a response shape it does not recognise.** Cause: skew protection covers framework-managed requests only; *"the framework doesn't automatically pin custom `fetch()` calls you make from client components"*. Fix: route every client-side call through a wrapper that attaches the deployment ID, as in `pinnedFetch` above — and grep for bare `fetch(` in `'use client'` files as a review habit.

**★ Symptom: users on a long form lose everything when you deploy.** Cause: document navigations are not pinned, so the next top-level request serves the latest deployment and the client detects the mismatch and hard-reloads; component state in `useState` does not survive that. Fix: pin the session with `__vdpl` scoped by matcher to the routes that need it, and clear it when the session completes. Where pinning is overkill, move the state to the URL or `localStorage` — the documentation names both as surviving a reload.

**★ Symptom: a user who left a tab open over the weekend gets 404s on every asset.** Cause: the default maximum age is one day from deployment creation, and a request naming an older deployment returns 404. Fix: raise the maximum age for applications with long-lived sessions — dashboards and monitoring tools are the documented examples — up to the project's retention limit, and set retention deliberately rather than leaving both defaults to interact.

**★ Symptom: raising maximum age to 30 days left a known-bad deployment reachable.** Cause: a long protection window keeps old artefacts serving active clients by design. Fix: set a **Custom Skew Protection Threshold** on the deployment that fixed the problem, which stops it and everything older from serving; or delete the bad deployment outright, which removes it from skew protection entirely.

**★ Symptom: a partner site that embeds your widget breaks on every one of your deploys.** Cause: cross-origin requests are not pinned by default and route to the latest production deployment, where the build-time-baked asset URLs no longer resolve. Fix: add the partner's hostname to **Allowed Domains for Cross-Site Fetch** on the project that *serves* the assets, and set maximum age above your deployment interval — the docs warn that if the pinned deployment ages out, cross-site requests fail even with the domain allowed.

**★ Symptom: skew protection is toggled on and version-skew errors continue.** Cause: the prerequisite setting — *"Enable access to System Environment Variables"* — is off, so the deployment ID never reaches the client. Fix: enable it in project settings and redeploy the latest production deployment, which the enablement steps list explicitly as the final step.

**★ Symptom: skew protection works from the dashboard pipeline and not from your CI.** Cause: CI runs `vercel build` then `vercel deploy --prebuilt`, and the build-time deployment ID does not match the one Vercel assigns at deploy time. Fix: supply a custom deployment ID so the two agree, per the prebuilt note in the docs.

**Symptom: Google's rendered version of your page has no CSS.** Cause: the crawler fetched the document, rendered it much later, and the assets it asked for had aged out. Fix: nothing, on Vercel — the platform already extends maximum age to 60 days for Googlebot and Bingbot. If you see this anyway, look at retention: a *deleted* deployment is unreachable regardless of maximum age.

**Symptom: a `__vdpl` cookie set once at `/` means a subset of users never see any new deployment.** Cause: the cookie pins document navigations for as long as the deployment remains accessible, and nothing clears it. Fix: scope the middleware with a matcher, and delete the cookie from a Server Action at the end of the session. Treat an unbounded `__vdpl` as an outage waiting for the retention policy to fire.

**Symptom: cache hit rates look worse than expected for users far from any compute region.** Cause: PoPs terminate the connection but do not hold the cache; the cache lives in the 20 dense regions behind them. A user in a PoP-only location still traverses the private network to a region. Fix: nothing to configure — but do not model the network as "126 caches", because capacity planning and revalidation reasoning built on that number will be wrong.

## Interview questions

**★ Why are there six times as many points of presence as compute regions rather than a cache in every PoP?**
Because arriving close and caching densely are different problems. A PoP's job is to terminate TCP near the user and hand the request onto a private network — the docs put that at single-digit millisecond latency to the nearest region. Caching, by contrast, gets better the fewer places it lives: the same documentation says maintaining fewer, dense regions increases cache hit probability, because popular content is more likely to be present in each region's cache. Spreading the cache across 126 locations would divide the same working set 126 ways and miss far more often. TLS termination also happens at the region, not the PoP.

**★ Name the three failure modes of version skew and the user-visible symptom of each.**
Missing assets — the client requests a JavaScript or CSS file that no longer exists, surfacing as a chunk-load error, usually on a lazily-loaded route. Server Function mismatches — the client invokes a Server Action by an ID from a previous build that the current server does not recognise, surfacing as a form submission that fails with an error the user cannot act on. Navigation failures — prefetched data from an old deployment is incompatible with the new server, surfacing as a navigation that hangs or unexpectedly hard-reloads.

**★ Skew protection is enabled. Why can a client-side `fetch` still hit the wrong deployment?**
Because the framework only pins *framework-managed* requests: static assets, client-side navigations and Server Actions, and prefetches. The documentation states plainly that custom `fetch()` calls from client components are not pinned automatically. So a polling widget or a hand-written data call goes to the latest production deployment while the surrounding page is locked to an older one. The fix is to attach the deployment ID yourself — `?dpl=` query parameter, `x-deployment-id` header, or the `__vdpl` cookie — guarded on `VERCEL_SKEW_PROTECTION_ENABLED === '1'`.

**★ Why does Vercel deliberately *not* pin full-page navigations, and when should you override that?**
Because a top-level document request is the natural moment to move a user forward: they get the latest deployment, and the client's mismatch detection triggers a reload so nothing stale lingers. For most applications that is exactly right. You override it with the `__vdpl` cookie when a reload destroys something valuable — the docs name live assessments where progress could be lost, real-time audio or video where a reload breaks the connection, and multi-step workflows with unsaved state. The override needs a matcher so it applies only to those routes, and an explicit clear when the session ends.

**★ Two independent clocks govern how long a pinned client keeps working. What are they, and how should they be set together?**
Skew protection's **maximum age** (default one day from deployment creation, configurable up to the project's retention limit) and **deployment retention** (which actually deletes the artefact). A deleted deployment is unreachable regardless of maximum age. The documented pairing is: if retention is short, set maximum age to the same value, because deployments are deleted before they could age out anyway; a deliberately low maximum age is only useful when retention is long and you want to bound how far back protection reaches. If you need long sessions supported, you must raise *both*.

**★ Why does the platform extend the skew window to 60 days for Googlebot and Bingbot?**
Because crawling and rendering are separated in time. A crawler may fetch the HTML now and execute it weeks later; by then the pinned assets would normally have aged out and returned 404, so the rendered page would be evaluated without its CSS or JavaScript. Extending maximum age to 60 days for those two agents keeps the render faithful. It is a good example of skew protection being an SEO feature as much as a reliability one.

**★ You raised maximum age to 30 days and then shipped a security fix. What now?**
The old deployments are still serving pinned clients for up to 30 days, including the vulnerable one. Set a Custom Skew Protection Threshold on the deployment that contains the fix, which stops it and every older deployment from serving requests to active clients, or delete the bad deployment so it is unreachable through skew protection at all. This is the trade-off the long window buys you: fewer disruptive reloads, and an explicit action required when an old artefact must stop being reachable.

**A partner embeds assets from your project and breaks whenever you deploy. Diagnose it.**
Their HTML has your asset URLs baked in at *their* build time, complete with a `?dpl=` for whatever deployment was current then. Skew protection ignores the deployment ID on cross-origin requests by default, so those requests route to your latest production deployment, where the old asset filenames no longer exist — 404s and broken JavaScript on their site, invisible on yours. Add their hostname to Allowed Domains for Cross-Site Fetch on your project, and make sure maximum age exceeds your deployment interval, because an allowed domain pinned to an aged-out deployment still fails.

**How does this whole feature depend on deployments being immutable?**
Entirely. Pinning a client to "the deployment that served their page" is only meaningful if that deployment is still exactly what it was — same chunk filenames, same Server Action IDs, same prerendered output. If deployments were mutable, pinning would guarantee nothing. It is the same property that makes rollback a pointer move rather than a rebuild, and it is why the two limits on skew protection are both about *existence over time* — maximum age and retention — rather than about content.

---

← [Environments and the build-time/runtime split](01b-vercel-environments-and-the-build-time-runtime-split.md) · [Chapter 17 overview](01-explanation.md) · Next → [Self-hosting: standalone output and Docker](02-self-hosting-docker-containerization.md)
