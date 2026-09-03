---
title: "Most manifest members are decoration; six of them decide where a launch lands, what the window looks like and whether an update is an update"
sidebar_label: "10b · Manifest fields that change behaviour"
sidebar_position: 11
description: "start_url, scope, display, display_override, id, icons and theme_color — the manifest members with real consequences, and the ones that fail silently."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against MDN's Web App Manifest reference —
> [members index](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest),
> [`start_url`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url),
> [`display`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display),
> [`prefer_related_applications`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/prefer_related_applications) —
> plus the Next.js [`manifest.json` convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)
> and [`generateViewport`](https://nextjs.org/docs/app/api-reference/functions/generate-viewport).
> Target: **Next.js 16.3.4**, App Router.

**A manifest has around two dozen members and you can ignore most of them. Seven change
observable behaviour, and every one of those seven fails *silently* when you get it wrong —
no console error, no build warning, just an app that installs and then launches somewhere you
did not intend, in a window you did not ask for, under an identity that does not match the one
you shipped last month.** This page is about those seven: `start_url`, `scope`, `display`,
`display_override`, `id`, `icons` and `theme_color`. It follows
[10 — the manifest route](10-progressive-web-apps.md), which covers where the file lives and
what URL it lands on; the members that shape the *install surface* rather than the running
app are in [10c](10c-secondary-manifest-members-and-typing.md).

## The members that actually change behaviour

### `start_url` — where a launch lands, and where scope comes from

`start_url` is resolved **against the manifest's own URL**, not against the page that linked
it. With `app/manifest.ts` the manifest lives at the origin root, so a relative `start_url`
resolves from the root — which is usually what you meant, and is exactly what breaks under
`basePath`.

It must be same-origin with the manifest. MDN is explicit that a cross-origin `start_url` is
not an error you will see: the browser silently falls back to using the URL of the page that
linked the manifest. If you host the app on `app.example.com` and point `start_url` at
`example.com`, installs will appear to work and launch somewhere you did not choose.

`scope` is inferred from `start_url` when you omit it. Setting `scope: '/'` explicitly is
worth the one line, because it is the difference between an installed window that keeps every
in-app link inside itself and one that hands half your routes back to the browser.

### `scope` — the boundary between "in the app" and "in a browser"

`scope` is a URL prefix. A document navigation to a URL underneath it stays in the installed
window; anything outside it is handed to the browser, typically in a new tab, and the user has
left your app. It is inferred from `start_url` when absent, which is where the surprise comes
from — a `start_url` of `/board` infers `/board/`, not `/`.

Because `start_url`, `scope` and `id` are three views of the same decision, derive them from
one place so they cannot drift:

```ts title="app/manifest.ts"
import type { MetadataRoute } from 'next'

const ORIGIN_SCOPE = '/' // never change this after the first public release
const LAUNCH = '/board'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: ORIGIN_SCOPE,
    scope: ORIGIN_SCOPE,
    start_url: LAUNCH,
    name: 'SprintDesk',
    short_name: 'SprintDesk',
    display: 'standalone',
    icons: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  }
}
```

`id` and `scope` are the immutable pair; `start_url` is the one you are allowed to move later.

### `display` and `display_override` — a fallback chain, not a switch

Per MDN the values fall back in a fixed order — `fullscreen` → `standalone` →
`minimal-ui` → `browser` — and the default when you omit `display` entirely is `browser`,
which is to say *no app window at all*. `display_override` lets you name a non-standard mode
first (`window-controls-overlay` for a desktop title-bar app) with the classic values behind
it as the fallback, without changing what `display` says for browsers that ignore the
override list.

### `id` — the thing that decides whether an update is an update

An installed app's identity is its `id`, resolved against the manifest URL; when absent, it
falls back to `start_url`. Ship without an `id`, later change `start_url` from `/` to
`/board`, and browsers that key on `start_url` see a **different app** — the installed one
keeps pointing at the old URL and a fresh install appears alongside it. Set `id` once, on day
one, and never change it. Changing `start_url` afterwards is then a routine edit.

### `icons` — separate from the metadata icon convention

Next has *two* icon systems and they do different jobs:

| Mechanism | Produces | Consumed by |
|---|---|---|
| `app/icon.png`, `app/apple-icon.png` file conventions | `<link rel="icon">` / `<link rel="apple-touch-icon">` in `<head>` | Browser tabs, bookmarks, iOS home screen |
| `icons[]` in the manifest | Entries in the manifest JSON | The OS install flow, app switcher, splash screens |

Filling in one does not fill in the other. Ship both. The 192 px and 512 px PNGs in the Next
guide's example are the pair Chromium wants; add a `purpose: 'maskable'` variant with its art
inside the safe zone, or Android will crop your logo into its adaptive-icon shape and take a
bite out of it.

### `theme_color` lives in two places and they are not the same field

`theme_color` in the manifest colours the installed app's window. The `<meta name="theme-color">`
tag colours the *browser* UI, and in Next it comes from the **`viewport` export**, not
`metadata`:

```ts title="app/layout.tsx"
import type { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0f' },
  ],
}
```

Set both. The manifest one cannot respond to `prefers-color-scheme`; the viewport one can.



## Gotchas

### `display: 'standalone'` with no `scope`
**Symptom.** The installed app opens a system browser the first time a user clicks certain
links, and never comes back.
**Cause.** With `scope` omitted it is inferred from `start_url`. A `start_url` of `/board`
infers a scope of `/board/`, so `/settings` is out of scope and opens outside the app window.
**Fix.** `scope: '/'`, explicitly, unless you genuinely want a sub-app.

### Changing `start_url` after launch, with no `id`
**Symptom.** A second copy of the app appears on users' home screens after a release.
**Cause.** Without `id`, identity falls back to `start_url`. Change it and you have described
a different application.
**Fix.** Ship `id` from the first release. Changing `start_url` then costs nothing.

### Manifest edits do not reach installed apps promptly
**Symptom.** You fix the icon; installed users keep the old one for days.
**Cause.** The manifest is re-fetched on the browser's own schedule, and OS-level assets
(home screen icon, splash) are typically captured at install time. There is no API to force it.
**Fix.** Treat manifest identity fields as immutable and version the *content* of icon URLs
(`/icons/icon-512.v2.png`) rather than replacing bytes at a stable URL. Get the icons right
before you promote the install prompt.

### The 512 px icon is not maskable and Android crops it
**Symptom.** The Android home-screen icon has its edges shaved off inside a circle or squircle.
**Cause.** Android applies an adaptive-icon mask. A non-`maskable` icon is placed as-is; a
`maskable` one is expected to keep its content inside a central safe zone and bleed its
background to the edges.
**Fix.** Ship a third entry with `purpose: 'maskable'` and a padded design, as in the manifest
above. Keep the un-masked one — `purpose` defaults to `any`, and some surfaces want that.

## Interview questions

**What is `start_url` resolved against?**
The manifest's URL, not the page that links it. It must be same-origin with the manifest; a
cross-origin value is silently ignored and the browser substitutes the URL of the linking page.

**What does `id` do and when must you set it?**
It is the installed app's stable identity, resolved against the manifest URL. If you omit it,
identity falls back to `start_url`, so any later change to `start_url` reads as a different
app and produces a duplicate install. Set it in the first release you ship publicly; after
that it is effectively immutable.

**Why is `display` a fallback chain rather than a single value?**
Because not every browser supports every mode. Browsers walk `fullscreen` → `standalone` →
`minimal-ui` → `browser`, taking the first they support. The default when `display` is absent
is `browser`, i.e. no app window. `display_override` sits in front of that chain so you can
request a non-standard mode like `window-controls-overlay` without disturbing the fallback.

**Manifest icons or `app/icon.png` — which one do you need?**
Both, for different consumers. The file conventions produce `<link rel="icon">` and
`<link rel="apple-touch-icon">` tags used by tabs, bookmarks and the iOS home screen. Manifest
`icons[]` are what the install flow, app switcher and splash screen read. Neither populates
the other.

**Why does `theme_color` appear in two places?**
The manifest member colours the installed window; the `<meta name="theme-color">` tag colours
browser UI. In the App Router the meta tag comes from the `viewport` export, not `metadata`,
and unlike the manifest field it can carry `prefers-color-scheme` media variants. Set both.

**Which manifest members are effectively immutable after the first public release?**
`id` and `scope`. `id` is the installed app's identity, so changing it produces a second
install rather than an update; `scope` is the boundary that decides which of your own URLs stay
inside the app window, and narrowing it after the fact ejects users into a browser tab from
routes that used to work. `start_url` is the one of the three you can safely move later — but
only if you set `id` on day one, because otherwise identity falls back to `start_url`.

**What is the practical difference between an out-of-scope URL and a cross-origin one?**
Neither stays in the installed window, but only the cross-origin case is obvious to the
person writing the manifest. An out-of-scope URL is one of *your own* routes that happens to
sit outside a prefix you never explicitly set, because you left `scope` to be inferred from
`start_url`. That is why `scope: '/'` is worth writing even when it looks redundant.

{/* FOOTER */}
