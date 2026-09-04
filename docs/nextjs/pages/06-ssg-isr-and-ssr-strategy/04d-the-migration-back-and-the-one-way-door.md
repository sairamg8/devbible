---
title: "Deleting `output: 'export'` takes one line; unwinding the eighteen months of workarounds you built because you did not have those thirteen features is the actual migration, and two of them are one-way doors"
sidebar_label: "04d · The migration back"
sidebar_position: 28
description: "What it really costs to discover late that a static export needed a server: the workaround-by-workaround unwind, which decisions are irreversible, and the cheap insurance that keeps the door open from day one."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to create a static export](https://nextjs.org/docs/app/guides/static-exports) (docs `lastUpdated` 2026-08-25) and [Deploying](https://nextjs.org/docs/app/getting-started/deploying) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. The migration sequencing below is engineering judgement derived from the documented feature list, not a documented procedure — the docs describe no migration path in either direction, and I say so rather than implying one exists.

**The framework makes the reversal look trivial, and for the framework it is: delete `output: 'export'` and all thirteen features come back on the next build. What does not come back is the eighteen months of code you wrote *because* they were missing — the client-side auth gate, the redirects living in a CDN console, the public API you stood up so the browser could fetch what a Server Component used to read directly. That is the migration. Two items on the list are one-way doors: a public API other people are now consuming, and any data your client-side auth gate shipped into publicly cached HTML. This chunk is the unwind, in order, plus the cheap insurance that makes it a weekend instead of a quarter.**

## The config change is the easy ten percent

```js
// next.config.js — the entire framework-level migration
/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',   <- delete this
  output: 'standalone',  // or nothing at all, if you deploy with `next start`
}

module.exports = nextConfig
```

That is genuinely it, at the framework level. Route Handlers accept every verb again, `cookies()`
returns cookies, `proxy.ts` runs, `generateStaticParams` may return a subset, Server Actions
work, ISR works, Draft Mode works. Nothing in your `app/` directory has to change for the build
to succeed.

Which is exactly the trap: **the build succeeding is not the migration succeeding.** Everything
below still behaves the way you made it behave when there was no server.

## The unwind, workaround by workaround

| What you built | Why | What it costs to unwind |
|---|---|---|
| Client-side auth gate | `cookies()` unavailable | Re-implement server-side, re-test **every** route, and audit what the public HTML already leaked |
| Redirects and headers in the CDN console | `next.config.js` `redirects`/`headers` inert | Migrate back, or accept a permanently split source of truth — the split is the expensive state |
| A public API for the browser to call | Server Components could not fetch per-request | 🔴 **One-way door.** Other consumers found it. See below |
| A third-party form endpoint | Server Actions unavailable | Re-implement as Server Actions; the vendor's spam filtering, notifications and stored submissions all have to be replaced or kept |
| A CDN worker doing auth or geo rewrites | No `proxy.ts` | Move into `proxy.ts`, then delete the worker — leaving both is a rules-precedence bug waiting to happen |
| Image URLs from a vendor loader | No `/_next/image` | Vendor URLs are baked into published content; either keep the vendor or rewrite content |
| `generateStaticParams` returning everything | Enumeration mandatory | Re-tune to prerender the head and let the tail generate on demand — a behaviour change, so re-check your 404 handling |
| Webhook-triggered full rebuilds | No ISR | Replace with `revalidateTag` / `revalidatePath`; the CMS integration is rewritten, not reconfigured |
| A second serverful deploy for CMS preview | No Draft Mode | Delete it — this is the one item that gets *cheaper*, and the only unambiguous win in the table |

The pattern to notice: **almost nothing on that list is application code.** It is integrations,
vendor contracts, console configuration and published URLs. That is why the migration is
estimated at one line and delivered in a quarter.

## The two one-way doors

### 🔴 The public API you stood up

You needed the browser to fetch data that a Server Component used to read directly, so you built
an endpoint. Once that endpoint has been live and reachable, you no longer control who calls it.
A partner integration, a customer's script, an internal tool someone built in a week — all of
them now depend on a shape you intended as an implementation detail.

You can move the *rendering* back to the server. You cannot un-publish the API. The realistic
outcome is that you keep it, versioned and supported, forever — which means the real cost of
the original export decision includes permanently owning a public API you never wanted.

**The insurance is cheap and it goes in on day one:** if the data is the same for every visitor,
emit it as a build-time file rather than an endpoint. A `GET` Route Handler marked
`force-static` produces a real file (see [04b](04b-what-survives-and-the-force-static-trap.md)),
and nobody builds an integration against `/search-index.json` expecting a stable contract the
way they do against `/api/v1/products`.

### 🔴 What the client-side auth gate already shipped

A client-side gate renders the page and then hides it. Which means the data was in the HTML, and
the HTML was served by a CDN to anyone who asked, and it was cached.

```tsx
// 🔴 The pattern that is a disclosure, not a bug: the markup exists before the check.
'use client'

export default function Dashboard({ projects }: { projects: Project[] }) {
  const { user, loading } = useSession()
  if (loading) return <Skeleton />
  if (!user) return <SignIn />
  return <ProjectList projects={projects} /> // ...but `projects` came from the static build
}
```

If `projects` was baked into the export at build time, every visitor has it — `view-source` is
enough, and no login is involved. Migrating to a server does not undo that; the pages were
public for as long as they were deployed.

The only correct version of this pattern in a static export is that **the export contains no
data the public may not see**, and the gated data is fetched at runtime from an endpoint that
performs its own authorization. Then the migration back is a rendering change rather than an
incident.

## The cheap insurance, written on day one

### Keep redirects and headers in code, and generate the host config from them

One source of truth, two consumers. This is the fix for the split-source-of-truth row in the
table, and it costs about twenty lines:

```ts
// config/redirects.ts — the single source of truth
export type Redirect = { source: string; destination: string; permanent: boolean }

export const redirects: Redirect[] = [
  { source: '/old-pricing', destination: '/pricing', permanent: true },
  { source: '/docs/v1/:path*', destination: '/docs/:path*', permanent: false },
]
```

```js
// next.config.js — used verbatim the moment you are serverful again
const { redirects } = require('./config/redirects.ts')

module.exports = {
  output: 'export',
  // Inert under `export`, correct the moment the key above is removed.
  redirects: async () => redirects,
}
```

```ts
// scripts/emit-host-redirects.ts — run in CI after `next build`
import { writeFileSync } from 'node:fs'
import { redirects } from '../config/redirects'

// Netlify/Cloudflare `_redirects` format: <from> <to> <status>
const body = redirects
  .map((r) => `${r.source}  ${r.destination}  ${r.permanent ? 301 : 302}`)
  .join('\n')

writeFileSync('out/_redirects', body + '\n')
```

Now the console configuration is a build artifact, reviewed in pull requests, and the migration
back is deleting one script.

### The other four, in one list

- **Never add `proxy.ts` while exporting.** Not even commented out. A file that cannot run is a
  control a reviewer will believe in.
- **`export const dynamic = 'error'` on every page segment**, so a request-time read fails the
  build instead of blanking. This is the difference between finding the problem in CI and
  finding it in a disclosure report — see [04b](04b-what-survives-and-the-force-static-trap.md).
- **Keep the data-access layer server-only and untouched.** It already works at build time; it
  will work at request time unchanged. Do not let "we're static now" become a reason to move
  queries into the browser.
- **Write the review triggers into the ADR**, not just the decision: content moves to a CMS, a
  login appears, or build duration crosses a threshold. An architecture decision with no
  expiry condition is one nobody revisits.

## Migrating the other way — serverful to export

Rarer, and the reason it is rarer is instructive: the checklist is the thirteen-item list read
as an audit, and most applications fail it on the first item they check. In order of how often
they fail:

1. Does anything call `cookies()` or `headers()`? A session, a theme cookie, a locale — usually
   yes, and usually in the root layout, where it affects every route.
2. Does any form use a Server Action?
3. Does `next.config.js` define `redirects`, `headers` or `rewrites`?
4. Does `proxy.ts` exist?
5. Can every dynamic segment be fully enumerated, and will that enumeration finish inside the
   CI timeout?
6. Does any route rely on ISR or Draft Mode?

**The docs describe no migration procedure in either direction.** This ordering is judgement:
put the checks that fail cheapest first, and the ones that fail an entire product line first
of all. Note also that under `next dev` the export mode is documented to error on unsupported
features — which makes running the app locally with `output: 'export'` set the cheapest possible
version of this audit, and much better than reading the code.

## Gotchas

**★ Symptom: the migration off static export "completed" in a sprint, and six months later the CDN console still holds redirects nobody knows about.** Cause: the config change is trivial, so the project is declared done at the framework boundary while the console configuration is left in place. Fix: make the console the artifact of a build step (the `emit-host-redirects.ts` pattern above) *before* migrating, so decommissioning it is a file deletion with a diff, not an archaeology exercise.

**★ Symptom: after migrating back, a redirect fires twice or loops.** Cause: the rule now exists in both `next.config.js` and the host, and the host's copy runs first — Next.js redirects execute inside the application, host rules execute before it ever sees the request. Fix: delete the host copy in the same change that enables the config copy, and verify with a request that follows no redirects and inspects the chain. Migrating both halves in separate deploys is what produces the loop.

**★ Symptom: an internal API built for the static frontend now has external consumers and cannot be removed.** Cause: any reachable, undocumented endpoint acquires dependents. Fix going forward: prefer build-time file emission over an endpoint for data that is identical for every visitor, and where an endpoint is genuinely needed, put it behind authentication from the first day so an unauthorized consumer cannot silently become a dependency.

**★ Symptom: a security review finds private data in cached HTML from the static-export era.** Cause: a client-side auth gate that hid, rather than withheld, data that was baked in at build time. Fix: treat it as a disclosure with a date range, not as a migration task — the pages were public for as long as they were deployed, and moving rendering to the server changes nothing about what was already served. Prevention is the rule that the export contains no data the public may not see.

**★ Symptom: after removing `output: 'export'`, build times get *worse* rather than better.** Cause: `generateStaticParams` still returns every path, because enumeration was mandatory and nobody revisited it — and now the build is doing that work in a mode that no longer requires it. Fix: cut it back to the high-traffic head and let the tail generate on demand, then confirm `dynamicParams` is no longer `false`, or the tail will 404 instead of generating. See [02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md).

**★ Symptom: CMS editors still trigger a full rebuild after the migration, and complain nothing improved.** Cause: the webhook still calls the deploy hook, because replacing it means rewriting the integration rather than reconfiguring it. Fix: point the webhook at a Route Handler that calls `revalidateTag` for the affected content type — see [ch5 · `revalidateTag` and `updateTag`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md). Until that lands, the team has paid the migration cost without receiving the benefit that justified it.

**★ Symptom: image URLs in published CMS content point at the image vendor long after the vendor was cancelled.** Cause: the custom loader produced absolute vendor URLs and editors pasted rendered output into content. Fix: keep the vendor until the content is rewritten, and make the loader the *only* place a vendor hostname appears in the codebase so a future swap is one file. This is why the image row is nearly a one-way door too.

**Symptom: `output: 'export'` is removed and a stale `_redirects` or `_headers` file keeps shipping.** Cause: those files live in `public/`, which is copied verbatim into every build regardless of output mode. Fix: generate them into `out/` from a script, never author them in `public/` — a generated file disappears when you stop generating it, and a committed one does not.

## Interview questions

**★ How hard is it to move a static export back to a serverful deployment?**
At the framework level, one line: delete `output: 'export'` and all thirteen unsupported features return on the next build. That is also the trap, because the build succeeding is not the migration succeeding. The real work is unwinding what you built in their absence — a client-side auth gate, redirects living in a CDN console, a public API standing in for server-side fetching, a third-party form endpoint standing in for Server Actions. Almost none of it is application code, which is why it gets estimated as one line and delivered in a quarter.

**★ Which parts of that migration are genuinely irreversible?**
Two. The public API you stood up so the browser could fetch what a Server Component used to read: once it has been reachable, external consumers exist, and you can move rendering back to the server but you cannot un-publish the endpoint — you now own it. And anything a client-side auth gate rendered into HTML that a CDN cached and served: that data was public for the deployment's lifetime, and no later change alters that. The first is a permanent maintenance cost; the second is an incident.

**★ What would you put in place on day one of a static-export project to keep the door open?**
Four things, all cheap. Keep redirects and headers in a TypeScript module and generate the host configuration from it in CI, so the console is a build artifact rather than a second source of truth. Put `export const dynamic = 'error'` on every page segment so a request-time read fails the build rather than silently blanking. Never add a `proxy.ts` that cannot run. And prefer emitting build-time files from `GET` Route Handlers over standing up an API, because a file does not acquire external consumers the way an endpoint does.

**★ You are asked to move an existing serverful app to a static export. What is your audit, in order?**
Cheapest failures first: does anything call `cookies()` or `headers()` — usually yes, usually in the root layout, which fails the whole application at once; does any form use a Server Action; does `next.config.js` define `redirects`, `headers` or `rewrites`; does `proxy.ts` exist; can every dynamic segment be enumerated inside the CI timeout; does anything rely on ISR or Draft Mode. The docs describe no migration procedure, so this ordering is judgement — but there is one cheap mechanical check: set `output: 'export'` locally and run `next dev`, which is documented to error on unsupported features.

**★ Why is a split source of truth for redirects worse than either extreme?**
Because both places look authoritative and neither is complete. A developer adds a rule to `next.config.js` and it silently does nothing under export; an operator adds one to the console and it is invisible to code review and to every test. During a migration both are live simultaneously, and the host's copy executes before the application ever sees the request — which is how you get a redirect that fires twice or loops. One source of truth with a generated second consumer removes the entire failure class for about twenty lines of script.

**★ Deleting the CMS preview deployment is the only line in the unwind table that saves money. Why does that matter to the argument?**
Because it is the honest counterweight. Every other row is a cost, and a page that only lists costs is advocacy rather than analysis. Draft Mode replaces a whole second deployment — same repository, same build, pointed at draft content, kept in sync forever — with a cookie and a bypass. That is a real operational saving, and it is worth stating precisely so the comparison is credible when you argue the other nine rows.

---

← [04c · When export wins, what a server buys](04c-when-export-wins-and-what-a-server-buys.md) · [Chapter 6 overview](01-explanation.md) · Next → [05 · Deciding a rendering strategy, and marketing pages](05-architecture-decision-walkthroughs-marketing-pages.md)
