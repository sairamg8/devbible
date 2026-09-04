---
title: "Chrome's Application panel is what replaced the PWA audit, and its Manifest and Service Workers panes answer questions no automated test can — provided you leave its three checkboxes in the state you found them"
sidebar_label: "10v · Auditing with the Application panel"
sidebar_position: 53
description: "The Manifest and Service Workers panes: what each one actually tells you about a Next.js PWA, what a missing Installability section does and does not prove, and the emulation checkboxes that lie to you if left on."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Chrome DevTools'
> [Debug Progressive Web Apps](https://developer.chrome.com/docs/devtools/progressive-web-apps)
> (pane, checkbox and button labels taken from that page), the Next.js
> [Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps), and the
> Next.js canary source for the generated manifest route.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.
> Documentation-verified; **no sandbox run**. DevTools UI labels move between Chrome versions.

**The Application panel is not a score, it is a window onto the four pieces of state a PWA
actually consists of — the parsed manifest, the registration, the storage bucket and the cache
contents — and every PWA bug this topic has taught you to avoid is visible in one of them.** This
page takes the first two, which are where installability and the worker lifecycle live. The
Storage pane is the reset that makes any of it repeatable and is covered with the rest of the test
environment in [10w](10w-a-testable-environment-https-and-a-production-build.md); the Cache Storage
pane is where the RSC-payload-under-a-document-URL bug becomes visible and is covered where you go
looking for it, in [10x](10x-reproducing-the-failures-deliberately.md).

The panel is also the most dangerous tool in the set, because three of its controls are *emulation
switches* that persist while the panel is open and quietly invert the behaviour you are trying to
observe. More engineers have concluded "the cache is broken" from a forgotten **Bypass for
network** checkbox than from any real cache bug.

## The Manifest pane: what the browser parsed, not what you wrote

The pane renders the manifest **as parsed**, under a link to the source, with sections named
**Identity**, **Presentation**, **Protocol Handlers**, **Icons**, and one **Shortcut #N** and
**Screenshot #N** section per entry. An **Installability** section appears when errors are
detected.

Three Next-specific things this catches that reading `app/manifest.ts` never will.

**The URL.** A manifest generated from `app/manifest.ts` is served at
**`/manifest.webmanifest`**, not `/manifest.json` — `normalizeMetadataRoute` in the Next source
appends `.webmanifest` for the `/manifest` route. A static `app/manifest.json` keeps `.json`. The
framework emits the matching `link rel="manifest"` for you, so the two stay consistent — but the
moment someone hardcodes a `metadata.manifest` value or hand-writes the link tag, the pane is where
you find out it points at a 404. If the pane is empty or shows an error rather than parsed fields,
stop and fetch the href yourself before changing anything else.

**The icons.** The Icons section renders each icon. An icon that 404s, is the wrong declared size,
or is a `.svg` where you declared `image/png` shows up here as a broken or mis-sized entry. Nothing
in your build fails for any of those.

**`start_url` resolution.** Per MDN, a relative `start_url` resolves against the *manifest file's*
URL, and an unspecified or invalid `start_url` falls back to the URL of the page that links the
manifest. The pane shows the resolved value, which is the only way to see that your `start_url:
'/dashboard'` quietly became something else — and `scope`, if you did not set it, is inferred from
`start_url`.

🔴 **The absence of an Installability section is not proof of installability.** The docs describe
it as appearing when errors are detected; a pane with no such section means Chrome found nothing to
complain about *in the manifest*, not that Chrome will offer to install the app on this visit.
Install offers are also gated on engagement heuristics that no panel exposes — see
[10d](10d-installability-and-the-install-prompt.md).

## The Service Workers pane: the registration, and three switches that lie

The pane lists each registration for the origin with a **Source** line carrying the install
timestamp, a **Status** line carrying the update count, a **Clients** line with the origin scope
and a **Focus** button, and an **Update Cycle** table of timestamps. Its actions are **Update**,
**Unregister**, **Start**/**Stop**, **See all registrations** and **Network requests** links, plus
**Push** and **Sync** buttons.

| Control | What it is for | What it costs you if left on |
|---|---|---|
| **Offline** checkbox | Emulating a dead network for this registration | You debug an app you think is online |
| **Update on reload** checkbox | Forcing install + activate on every reload | 🔴 The `waiting` state never happens, so the update bug you are hunting becomes invisible |
| **Bypass for network** checkbox | Sending requests straight to the network, skipping the worker | 🔴 Your cache appears to do nothing at all |
| **Update** link | Triggering `registration.update()` by hand | — |
| **Unregister** link | Removing the registration (**not** its caches) | Orphaned caches, see [10k](10k-service-worker-cache-budget-and-eviction.md) |
| **Push** button | Firing a synthetic `push` event at the worker | Proves your handler runs; proves nothing about delivery |
| **Sync** button | Firing a synthetic `sync` event with a tag you type | Same caveat |
| **Start**/**Stop** | Waking or killing the worker thread | Useful for proving your worker survives being terminated between events |

**Update on reload deserves its own warning.** It is the single most useful checkbox during
development — it makes every reload pick up your new worker immediately — and it is the reason
teams ship the "users stuck on the old build" bug. With it on, a new worker never sits in
`waiting`, so the entire failure mode taught in
[10g](10g-the-service-worker-update-lifecycle.md) cannot be reproduced. Turn it **off** before you
test an update. That reproduction is [10x](10x-reproducing-the-failures-deliberately.md).

The **Push** and **Sync** buttons are worth being precise about: they dispatch the event locally.
They exercise your `push` and `sync` handlers, which is genuinely valuable, and they say nothing at
all about VAPID, your subscription store, the push service, or whether an expired subscription is
being cleaned up. Those are [10n](10n-sending-push-from-the-server.md) and
[10m](10m-storing-push-subscriptions.md).

## Gotchas

### Bypass for network left ticked
**Symptom.** The cache appears empty of effect — every request hits the server, offline fails
instantly, and the worker's `fetch` handler seems never to run.
**Cause.** **Bypass for network** in the Service Workers pane routes requests around the worker
entirely, and it persists while DevTools is open.
**Fix.** Untick it, then prove the worker is in the request path from the page rather than by eye:

```ts
// app/(dev)/sw-status/page.tsx — is a worker actually controlling this document?
'use client';
export default function SwStatus() {
  const controller =
    typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null;
  return (
    <p>
      {controller
        ? `controlled by ${controller.scriptURL} (${controller.state})`
        : 'no controller — this document is not going through a service worker'}
    </p>
  );
}
```

### Update on reload left ticked while testing an update
**Symptom.** You cannot reproduce the stuck-on-old-build report, and conclude it does not happen.
**Cause.** The checkbox forces install and activation on every reload, so no worker ever waits.
**Fix.** Untick it and drive the update from code instead, which also works headlessly and in CI:

```ts
// lib/sw-test-harness.ts — run in the page to force a real update check
export async function forceUpdateCheck() {
  const registration = await navigator.serviceWorker.ready;
  await registration.update();
  return {
    installing: registration.installing?.state ?? null,
    waiting: registration.waiting?.state ?? null,
    active: registration.active?.state ?? null,
  };
}
```

A non-null `waiting` is the bug reproduced — see
[10x](10x-reproducing-the-failures-deliberately.md).

### Reading the Manifest pane and believing you read your file
**Symptom.** You fix `app/manifest.ts`, reload, and the pane shows the old values.
**Cause.** The pane shows what the browser parsed, and the manifest response can be sitting in the
HTTP cache like any other response.
**Fix.** Hard-reload, and if it persists, fetch the URL directly with the cache bypassed so you are
looking at the server's answer, not the browser's memory of it:

```ts
// lib/sw-test-harness.ts
export async function readServedManifest() {
  const href =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ??
    '/manifest.webmanifest';
  const res = await fetch(href, { cache: 'reload' });
  return { href, status: res.status, body: await res.json() };
}
```

### Taking a missing Installability section as a pass
**Symptom.** The manifest pane is clean, and Chrome never offers to install.
**Cause.** The section is described as appearing when errors are detected; its absence says the
manifest parsed, not that the browser will prompt. Chrome's own post is explicit that engagement
heuristics and quality criteria sit alongside the manifest requirements.
**Fix.** Do not infer the prompt. Detect the real signal — the event itself — and log it, per
[10d](10d-installability-and-the-install-prompt.md):

```ts
// app/install-probe.tsx — did the browser consider us installable on this visit?
'use client';
import { useEffect } from 'react';

export function InstallProbe() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      document.documentElement.dataset.installable = 'true';
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return null;
}
```

`beforeinstallprompt` has limited availability and no guaranteed timing, so a missing
`data-installable` attribute is weak evidence, not proof — and on iOS the event does not exist at
all ([10p](10p-ios-and-safari-limits.md)).

### Both `app/manifest.json` and `app/manifest.ts` exist
**Symptom.** Edits to one of them have no effect, and the pane shows fields from the other.
**Cause.** Next's metadata discovery enumerates the static manifest extensions concatenated with
your page extensions and takes the first match. Which file wins is an ordered `concat` in the
build, i.e. an implementation detail — I could not find a documented guarantee of the order, so do
not rely on either winning.
**Fix.** Keep exactly one, and fail the build if a second appears:

```json
// package.json — a guard that costs nothing and prevents a silent overwrite
{
  "scripts": {
    "check:one-manifest": "test $(ls app/manifest.* 2>/dev/null | wc -l) -le 1 || (echo 'more than one app/manifest.* file' && exit 1)",
    "build": "yarn check:one-manifest && next build"
  }
}
```

### `prefer_related_applications` left at `true`
**Symptom.** Everything in the manifest looks right and Chrome will not install the web app.
**Cause.** MDN records a Chromium note that the member should be `false` or omitted to make your
web app installable — with it true, the browser steers the user to a listed native app instead.
**Fix.** Omit it. If you genuinely list native apps in `related_applications`, keep the flag false
and use `getInstalledRelatedApps()` to decide what to show, per
[10e](10e-detecting-install-state.md).

### Reading the Update Cycle table as a schedule
**Symptom.** "The browser checks for a new worker every N minutes" appears in a design document.
**Cause.** The table is a log of the update attempts that happened, with timestamps. It is history,
not policy.
**Fix.** Drive updates yourself rather than inferring a cadence. MDN's `update()` note is the one
concrete rule available: the fetch of the worker script bypasses browser caches if the previous
fetch occurred over 24 hours ago. Everything faster than that is something you build —
[10h](10h-service-worker-update-detection-and-recovery.md).

### The Push button convincing you push works
**Symptom.** The synthetic push shows a notification; real pushes never arrive.
**Cause.** The button dispatches a local `push` event straight at the worker. It never touches
VAPID, the subscription record, or the push service.
**Fix.** Use the button to prove the handler, then test delivery separately by sending through
`web-push` to a stored subscription and handling the expiry status codes — RFC 8030 requires a push
service to return **404** for an expired subscription, which is your cue to delete the record. That
is [10n](10n-sending-push-from-the-server.md).

## Interview questions

**★ Which Application-panel control most often produces a false bug report, and why?**
**Bypass for network**, with **Update on reload** close behind. Bypass routes every request around
the service worker, so a perfectly good cache appears to do nothing and offline fails instantly —
the engineer concludes the worker is broken. Update on reload is the opposite kind of lie: it
forces install and activation on every reload so a new worker never sits in `waiting`, which makes
the most common real-world service worker bug impossible to reproduce on the machine of the person
trying to fix it. Both persist while DevTools is open, and neither is visible unless you look at
the checkbox.

**★ Why does the Manifest pane show `/manifest.webmanifest` when your file is `app/manifest.ts`?**
Because Next normalises the metadata route: `normalizeMetadataRoute` appends `.webmanifest` to the
`/manifest` route, so a *generated* manifest is served at `/manifest.webmanifest` while a static
`app/manifest.json` keeps its `.json` extension. The framework emits the matching
`link rel="manifest"` for you, so nothing is broken — but any code that hardcodes
`/manifest.json`, any test that fetches it, and any CDN rule keyed on the path will be pointing at
a URL that does not exist. Read the href out of the document rather than assuming either name.

**What is the difference between the Update link and the Update on reload checkbox?**
The link performs one update check now — the equivalent of calling `registration.update()`, which
fetches the worker script and installs the new worker if it is not byte-for-byte identical. The
checkbox changes the rules for every subsequent reload: install and activate immediately, skipping
the `waiting` state entirely. The link is a probe you can use while still observing normal
lifecycle behaviour; the checkbox suppresses the behaviour you are usually trying to observe. Use
the link when debugging an update, the checkbox only when you want fast iteration and are not
testing the lifecycle.

**The manifest declares `scope: '/'` but the worker only controls part of the site. Why?**
Because they are two different scopes. The manifest's `scope` governs which URLs the installed app
window treats as in-app; the service worker's scope defaults to the directory of the worker script
and cannot be broader than that location unless the server sends a `Service-Worker-Allowed` header
on the script. A worker served from a nested path therefore controls only that subtree, no matter
what the manifest says. The Clients line in the Service Workers pane shows the registration's
scope; compare it against the manifest's, because a mismatch means navigations that look in-app
are not going through your worker at all.

**Why is the Manifest pane more useful than reading `app/manifest.ts`?**
Because it shows what the browser parsed from what the server actually served. It catches a
manifest URL that 404s, icons that do not resolve or whose declared size is wrong, and a
`start_url` whose relative resolution against the manifest URL is not what you assumed — none of
which fails a build. For Next specifically it is where you discover that a generated `app/manifest.ts`
serves at `/manifest.webmanifest` while something in your app hardcoded `/manifest.json`.

**What do the Push and Sync buttons actually prove?**
That your `push` and `sync` event handlers run and do what you wrote. They dispatch the event
locally at the worker. They do not exercise VAPID signing, your subscription store, the push
service, delivery to a real device, or expiry handling. Passing them and having no working push in
production is entirely consistent.

---

← [The Lighthouse PWA category is gone](10u-the-lighthouse-pwa-category-is-gone.md) · [Chapter 12 overview](01-explanation.md) · Next → [A testable environment](10w-a-testable-environment-https-and-a-production-build.md)
