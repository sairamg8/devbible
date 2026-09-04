---
title: "A Next.js PWA is a manifest route, an HTTPS origin and an install affordance — the service worker is a separate decision entirely"
sidebar_label: "10 · Progressive Web Apps"
sidebar_position: 31
description: "What actually makes a Next.js app installable: app/manifest.ts as a metadata route, the manifest fields that change behaviour, icons, and why the install prompt is not something you can rely on."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
> [`manifest.json` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest),
> [`generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> [`generateViewport`](https://nextjs.org/docs/app/api-reference/functions/generate-viewport),
> MDN's manifest reference for
> [`start_url`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)
> and [`display`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display),
> MDN's [`beforeinstallprompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event),
> and the Next.js source files `lib/metadata/get-metadata-route.ts` and
> `build/webpack/loaders/metadata/discover.ts`.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.

**"PWA" is four unrelated capabilities wearing one acronym: an installed window, offline
behaviour, push notifications, and OS integration like badging. Next.js gives you first-class
support for exactly one of them — the web app manifest, as a metadata file convention — and
leaves the other three to the platform.** That split matters, because the usual advice ("add
a manifest and a service worker and you have a PWA") hides the fact that installability and
offline are governed by completely different machinery with completely different failure
modes. This page is the narrowest and most load-bearing piece: where the manifest lives in a
Next.js app, what URL it ends up on, and how Next decides to cache it.

The rest of the topic runs across twenty-seven siblings; these are its entry points — the manifest members that actually change
behaviour in [10b](10b-manifest-fields-that-change-behaviour.md), install detection and the
prompt in [10d](10d-installability-and-the-install-prompt.md), service workers in
[10f](10f-service-workers-in-the-app-router.md), the two halves of "offline" in
[10i](10i-offline-strategy-and-the-useoffline-boundary.md), push in
[10l](10l-web-push-the-subscription-flow.md), and the platform that quietly breaks most PWA advice in
[10p](10p-ios-and-safari-limits.md).

Those cover the **read** side. Two later runs of chunks cover what the first seventeen did not.
The **write** side starts at [10r](10r-the-offline-write-queue-and-the-durable-outbox.md) — what
happens to a mutation the user makes while offline, why `experimental.useOffline` does not solve
it, and how far the Background Synchronization API in
[10t](10t-background-sync-registering-and-draining.md) can actually be trusted. **Testing and
auditing** starts at [10u](10u-the-lighthouse-pwa-category-is-gone.md), which opens on the fact
that reorganises every PWA checklist written before 2024: 🔴 **Lighthouse removed the PWA
category in 12.0.0**, because Chrome dropped the service-worker install requirement — so the
audit most guides still tell you to run no longer exists. The manual list that replaces it is in
[10z2](10z2-what-no-runner-can-reach-and-the-pre-release-checklist.md).

## The two installability requirements, and only two

The PWA guide is unusually blunt about the minimum bar: a valid web app manifest, and the
site served over HTTPS. That is it. **No service worker is required to install an app**, and
the guide says so explicitly — you can trigger install prompts without any offline support at
all. This is a change in the folklore that a lot of engineers have not absorbed: Chromium
dropped the "must have a fetch handler" requirement years ago, and Safari never had it.

Two consequences follow immediately:

1. If your only goal is a home-screen icon and a chrome-less window, you write one file and
   ship. Do not write a service worker for that.
2. If you *do* write a service worker, it is because you want offline behaviour or push — two
   things you should be able to justify independently. A service worker whose only job is to
   satisfy an install requirement that no longer exists is pure liability — see the update
   lifecycle in [10f](10f-service-workers-in-the-app-router.md).

## The manifest is a route, not a file you copy into `public/`

Next.js treats the manifest as a metadata file convention living at the root of `app/`. You
have two shapes.

**Static.** `app/manifest.json` or `app/manifest.webmanifest`, plain JSON. Served at the
matching path — `/manifest.json` or `/manifest.webmanifest`.

**Generated.** `app/manifest.ts` (or `.js`/`.tsx`/`.jsx`), default-exporting a function that
returns a `MetadataRoute.Manifest`. Next normalises this into a Route Handler, and the route
it lands on is **`/manifest.webmanifest`** regardless of your file's extension. That mapping
is not in the prose docs; it is in `normalizeMetadataRoute` in
`packages/next/src/lib/metadata/get-metadata-route.ts`, which special-cases exactly two
metadata pages — `/robots` gains `.txt` and `/manifest` gains `.webmanifest`.

```ts title="app/manifest.ts"
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/?source=pwa',
    name: 'SprintDesk — sprint planning for small teams',
    short_name: 'SprintDesk',
    description: 'Plan, estimate and track sprints without the ceremony.',
    start_url: '/board?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#0b0b0f',
    theme_color: '#0b0b0f',
    categories: ['productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
```

You do **not** write the `<link rel="manifest">` tag. When the metadata loader discovers a
`manifest.*` file at the root of `app/`, it records the resolved URL — prefixed with your
`basePath` — into the resolved metadata object, and the head is emitted from there
(`build/webpack/loaders/metadata/discover.ts`). The extension logic in that file is the
mirror image of the routing logic: a `webmanifest` or `json` source keeps its extension,
**anything else becomes `webmanifest`**.

### `manifest.ts` is a cached route by default

The file convention docs flag this in a "Good to know" and it is easy to skim past:
`manifest.js` is a special Route Handler that is **cached by default** unless it reaches for a
request-time API or sets a dynamic config option. So a manifest that reads `cookies()` to
personalise `name` per tenant is a dynamic route paying a per-request render; a manifest that
reads `process.env.TENANT_NAME` at module scope is frozen at build time and will not change
until you redeploy. Neither is wrong — but you should know which one you shipped. This is the
same caching model as every other metadata route, covered from the framework side in
[caching, PPR and cache components](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md).

## Gotchas

### The manifest route is behind your auth matcher
**Symptom.** Everything works while you are logged in; installability never triggers, or the
install lands on a login screen.
**Cause.** The browser fetches the manifest as its own request. If your proxy/middleware
matcher covers `/(.*)` and redirects unauthenticated requests, that fetch gets a redirect to
your login page instead of JSON. The manifest is never parsed, so there is nothing to install.
**Fix.** Exclude it explicitly, alongside the other metadata routes:

```ts title="proxy.ts"
export const config = {
  matcher: [
    // Everything except Next internals and the public metadata routes.
    '/((?!_next/static|_next/image|manifest.webmanifest|icons/|favicon.ico|sw.js).*)',
  ],
}
```

### `basePath` prefixes the link tag but not the manifest body
**Symptom.** App installs on a `basePath` deployment and launches to a 404.
**Cause.** The metadata loader prefixes the *href* it writes into `<head>` with `basePath`.
The `start_url`, `scope` and `icons[].src` strings inside your manifest are values you wrote;
nothing rewrites them.
**Fix.** Build them from the same constant your config uses.

```ts title="app/manifest.ts"
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    start_url: `${BASE}/board`,
    scope: `${BASE}/`,
    icons: [{ src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
    // ...
  }
}
```

### You wrote `app/manifest.ts` and hard-coded `/manifest.json` somewhere
**Symptom.** A 404 on the manifest, or two manifests where the browser picks the wrong one.
**Cause.** A generated manifest is served at `/manifest.webmanifest`. Any hand-written
`<link rel="manifest" href="/manifest.json">` left over from a Pages Router migration now
points at nothing — and because Next also emits its own link tag, you end up with two.
**Fix.** Delete the hand-written tag. Let the file convention emit it.

### A dynamic manifest that is silently static
**Symptom.** Per-tenant `name` and `theme_color` are correct in dev and identical for every
tenant in production.
**Cause.** `manifest.ts` is cached by default. Reading a build-time env var does not opt you
out; only a request-time API or an explicit dynamic option does.
**Fix.** Read the tenant from the request, which makes the route dynamic by construction:

```ts title="app/manifest.ts"
import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get('host') ?? 'app.example.com'
  const tenant = await getTenantByHost(host)
  return {
    id: '/',
    name: tenant.name,
    short_name: tenant.shortName,
    start_url: '/',
    display: 'standalone',
    theme_color: tenant.themeColor,
    icons: tenant.icons,
  }
}
```

Be deliberate about this one: you have just made a file the browser fetches on every cold load
into a per-request server render.

### The manifest is not at the root of `app/`
**Symptom.** No `<link rel="manifest">` in the HTML, no install option, no error.
**Cause.** The metadata loader looks for `manifest.*` at the root of the `app` directory
only. A `manifest.ts` inside `app/(marketing)/` or `app/[locale]/` is not a manifest — it is
an unreachable module, and nothing warns you.
**Fix.** Move it to `app/manifest.ts`. If you need per-locale naming, keep the single root
file and branch inside it on a request-time signal, accepting that this makes the route
dynamic:

```ts title="app/manifest.ts"
import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = (await headers()).get('x-locale') ?? 'en'
  const copy = { en: 'Sprint planning', de: 'Sprintplanung' }[locale] ?? 'Sprint planning'
  return { id: '/', name: `SprintDesk — ${copy}`, start_url: '/', display: 'standalone' }
}
```

### You put `manifest.json` in `public/` instead of `app/`
**Symptom.** The file is served, but nothing links to it, and its caching headers are wrong.
**Cause.** `public/` is a plain static directory: files there are served from `/` and Next
applies `Cache-Control: public, max-age=0` to them. It participates in no metadata
convention, so no head tag is generated and you are back to hand-authoring
`<link rel="manifest">` — the exact thing that goes stale during a migration.
**Fix.** Move it to `app/manifest.json`. Metadata files belong under `app/`; `public/` is for
the *assets* the manifest points at, such as your icon PNGs.

### Both `app/manifest.json` and `app/manifest.ts` exist
**Symptom.** Edits to one of them have no effect.
**Cause.** Discovery enumerates candidate extensions in one ordered list — the static
extensions (`webmanifest`, `json`) concatenated with your configured page extensions — and
takes the **first** match. Two manifests means one of them is dead code, and which one is a
detail of that ordering rather than something the documentation promises.
**Fix.** Keep exactly one. If you are migrating from static to generated, delete the JSON in
the same commit that adds the `.ts`, not the one after.

## Interview questions

**Does a Next.js app need a service worker to be installable?**
No. The documented requirements are a valid web app manifest and HTTPS; the guide explicitly
notes you can trigger install prompts without offline support. The old "must have a fetch
handler" rule is gone from Chromium and never existed in Safari. A service worker is
justified by offline behaviour or push, not by installability.

**What URL does `app/manifest.ts` end up on, and why does the extension change?**
`/manifest.webmanifest`. Next normalises metadata pages into routes, and
`normalizeMetadataRoute` special-cases `/manifest` by appending `.webmanifest` (the same way it
appends `.txt` to `/robots`). A static `app/manifest.json` keeps `.json`, because the discovery
loader preserves an extension that is already `json` or `webmanifest` and rewrites anything
else to `webmanifest`.

**Where does the `<link rel="manifest">` tag come from?**
The metadata loader. When it finds a `manifest.*` at the root of `app/`, it writes the
resolved URL — with `basePath` prefixed — into the resolved metadata, and the head tag is
emitted from that. You never author the tag, and authoring one anyway gives you two.

**Is `app/manifest.ts` static or dynamic?**
Cached by default, like other metadata routes, unless it uses a request-time API such as
`headers()` or `cookies()`, or sets a dynamic route option. That means a manifest built from
build-time environment variables is frozen until redeploy, which is usually fine and
occasionally a production incident when someone expects per-tenant branding.

**How would you make an installed PWA out of an app served under `basePath: '/app'`?**
Prefix `start_url`, `scope`, `id` and every `icons[].src` yourself. Next prefixes the
`<link rel="manifest">` href, but the JSON body is data you wrote and nothing rewrites it.
Derive all four from one exported constant so they cannot drift.

**Where exactly must the manifest file live, and what happens if it does not?**
At the root of the `app` directory. The metadata loader only looks there. Put it inside a
route group or a dynamic segment and it is silently inert — no head tag, no install, no
warning. This is a common casualty of a "let's organise `app/` into groups" refactor.

**Why not just serve `manifest.json` from `public/`?**
Because `public/` is a dumb static directory. It gets `Cache-Control: public, max-age=0`, it
takes part in no metadata convention, and it will not emit the `<link rel="manifest">` tag —
so you would hand-author that tag and own keeping it correct forever. `public/` is the right
home for the icon PNGs the manifest references, not for the manifest.

**What happens if you ship both `app/manifest.json` and `app/manifest.ts`?**
One wins and the other is dead. Discovery walks an ordered extension list — the static
extensions first, then your page extensions — and takes the first hit. Relying on that order
is relying on an implementation detail; ship one file.

---

[Chapter 12 overview](01-explanation.md) · Next → [10b · Manifest fields that change behaviour](10b-manifest-fields-that-change-behaviour.md)

---

← [The a11y pass and the acceptance criteria](06c-the-a11y-pass-and-the-acceptance-criteria.md) · [Chapter 12 overview](01-explanation.md) · Next → [Manifest fields that change behaviour](10b-manifest-fields-that-change-behaviour.md)
