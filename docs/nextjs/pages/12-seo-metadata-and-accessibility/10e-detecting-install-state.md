---
title: "Knowing whether the app is already installed is a different question from whether it can be installed, and only one of them has a cross-browser answer"
sidebar_label: "10e · Detecting install state"
sidebar_position: 14
description: "display-mode: standalone versus getInstalledRelatedApps(), self-listing in related_applications, and keeping the install button a Client Component leaf."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against MDN's
> [`Navigator.getInstalledRelatedApps()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps)
> and [`related_applications`](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/prefer_related_applications),
> and the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router.

**There are two install questions and they are constantly confused. "Am I running inside an
installed window right now?" has a cross-browser answer that costs one media query. "Has this
user installed the app at all?" has a Chromium-only answer that costs a manifest entry, a
capability check and an ignored rejection — and if you skip it, every returning user who
installed your app last week gets nagged to install it again from inside their browser tab.**
This page is the second question, plus where the resulting component belongs in an App Router
tree. It continues [10d](10d-installability-and-the-install-prompt.md), which builds the
prompt itself.

## `getInstalledRelatedApps()` — the one API that answers "is it already installed?"

`display-mode: standalone` only tells you about the window you are *in*. A user browsing your
site in a normal tab, who already installed the app yesterday, matches nothing — so the naive
component keeps offering an install they already have.

`navigator.getInstalledRelatedApps()` is the API for that. It returns a promise resolving to
an array of installed related apps, and it can report your **own** PWA if you list yourself in
`related_applications` with `platform: 'webapp'` and an `id` pointing at your manifest URL. It
requires a top-level secure context, refuses to run inside an iframe (throwing
`InvalidStateError`), and MDN marks its availability as limited — Chromium only, in practice.

```ts title="app/manifest.ts (excerpt)"
related_applications: [
  { platform: 'webapp', url: 'https://sprintdesk.example/manifest.webmanifest' },
],
```

```tsx title="in the install component"
useEffect(() => {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ platform: string; id?: string }>>
  }
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.some((app) => app.platform === 'webapp')) setInstalled(true)
    })
    .catch(() => {
      /* iframe or insecure context — leave the state alone */
    })
}, [])
```

Note the `?.()` and the swallowed rejection. This is an enhancement layered on top of a
component that must already be correct without it.

## Where the install button belongs in an App Router tree

The component is a Client Component and it reads browser-only state, so it is a leaf. Do not
push `'use client'` up into the layout to accommodate it — render it as a child slot:

```tsx title="app/layout.tsx"
import { InstallButton } from './components/install-button'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          {/* Server Component tree; only this leaf is client-side. */}
          <InstallButton />
        </header>
        {children}
      </body>
    </html>
  )
}
```

That is the ordinary boundary rule from
[server vs client components](../03-server-components-vs-client-components/01-explanation.md);
it matters here because an install button in a header is exactly the kind of thing that
accidentally converts an entire root layout into a Client Component.


## Gotchas
### The install component is rendered inside an iframe
**Symptom.** `InvalidStateError` from `getInstalledRelatedApps()`, and no install prompt at
all.
**Cause.** `getInstalledRelatedApps()` must be called in a top-level secure context and throws
otherwise; installation itself is likewise a top-level concern.
**Fix.** Catch and ignore the rejection (as above) so the rest of the component survives, and
do not expect install UI to work in an embedded preview.


### Self-listing in `related_applications` without `prefer_related_applications: false`
**Symptom.** You added a `webapp` entry so `getInstalledRelatedApps()` could see your own PWA,
and now Chromium stopped offering to install it.
**Cause.** `related_applications` is harmless on its own, but it sits next to
`prefer_related_applications`, and MDN states that member must be `false` or omitted for a
Chromium install. Anyone editing that block later is one line away from switching installs off.
**Fix.** Self-list, and leave the preference member out entirely with a comment saying why:

```ts title="app/manifest.ts (excerpt)"
related_applications: [
  // Self-reference so getInstalledRelatedApps() can report our own PWA.
  { platform: 'webapp', url: 'https://sprintdesk.example/manifest.webmanifest' },
],
// Do NOT add prefer_related_applications: true here — it suppresses the web install prompt.
```

### `getInstalledRelatedApps` typed as missing, so nobody calls it
**Symptom.** TypeScript rejects `navigator.getInstalledRelatedApps()`, so the feature is
dropped from the ticket.
**Cause.** It is not in the DOM lib, because it is not a standard. That is information, not an
obstacle.
**Fix.** Narrow at the call site rather than casting `navigator` to `any` — the optional call
then also handles the browsers that genuinely do not have it, which is the same code path you
needed anyway:

```ts
const nav = navigator as Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{ platform: string; id?: string }>>
}
const apps = (await nav.getInstalledRelatedApps?.()) ?? []
```

### Marking the layout `'use client'` for one button
**Symptom.** Bundle size jumps, Server Component data fetching in the header stops working.
**Cause.** `'use client'` is a boundary, not an annotation: everything imported below it goes
to the client. A header that renders one browser-only leaf does not need to be a Client
Component; the leaf does.
**Fix.** Keep the directive on the leaf file and render it as a child, as shown above.

## Interview questions

**What is the difference between `display-mode: standalone` and `getInstalledRelatedApps()`?**
The media query tells you whether *this* window is an installed one. It says nothing about a
user sitting in a normal browser tab who installed the app last week — for them it is false,
and a naive component keeps nagging. `getInstalledRelatedApps()` answers that second question,
including for your own PWA if you self-list in `related_applications` with
`platform: 'webapp'`, but it is Chromium-only, top-level-only, and rejects inside an iframe.

**Where should the install button live in the component tree, and why does it matter?**
As a Client Component leaf rendered by a Server Component parent. It needs `window`, so it has
to be client-side; but marking a shared header or the root layout `'use client'` to accommodate
it drags the whole subtree across the boundary. Render it as a child and keep the boundary at
the leaf.

**Why is `getInstalledRelatedApps()` not in the TypeScript DOM lib, and how do you call it?**
Because it is not a standard — MDN marks its availability as limited and it ships in Chromium
only. Narrow at the call site with an intersection type and an optional call, which gives you
the type *and* the runtime feature check in one expression. Casting `navigator` to `any` loses
both.

**What must be in the manifest for `getInstalledRelatedApps()` to see your own PWA?**
A self-referencing entry in `related_applications` with `platform: 'webapp'` pointing at your
manifest URL. Without it the API is only useful for detecting a companion native app. Add the
entry, but do not add `prefer_related_applications: true` alongside it — that suppresses the
web install prompt in Chromium.

**Under what conditions does `getInstalledRelatedApps()` throw rather than resolve empty?**
Outside a top-level secure context — notably inside an iframe, or over plain HTTP. It throws
`InvalidStateError`. Since neither condition is one your install UI can fix, the correct
handling is a caught, ignored rejection that leaves the component's existing state alone.

{/* FOOTER */}
