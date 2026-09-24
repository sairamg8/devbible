---
name: research-nextjs-pwa-background-sync-and-testing
description: Banked primary-source research for the two remaining devbible Next.js PWA chunks — the offline write queue / Background Synchronization API, and PWA testing + auditing (Lighthouse 12 removed the PWA category). Companion to research_nextjs_progressive-web-apps.md. do not re-derive.
metadata:
  type: project
---

# research_nextjs_pwa_background-sync-and-testing — banked 2026-09-03 · do not re-derive

Companion bank to [[research-nextjs-progressive-web-apps]], which already carries the manifest,
service worker, `experimental.useOffline`, Web Push and iOS/WebKit material. **Read that one
first** — everything below is only what it does not cover.

Version spine: **Next.js 16.3.4** · Node **>= 20.9** · App Router bundles React canary ·
`web-push` **3.6.7** (pinned in `src/data/pins.js` as `webpush`, tracks `['nextjs']`).

---

## Background Synchronization API — https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API

- Availability banner, verbatim: *"Limited availability - This feature is not Baseline because
  it does not work in some of the most widely-used browsers."*
- Secure context, verbatim: *"This feature is available only in secure contexts (HTTPS), in some
  or all supporting browsers."* Also: *"This feature is available in Web Workers."*
- What it is, verbatim: *"The Background Synchronization API enables a web app to defer tasks so
  that they can be run in a service worker once the user has a stable network connection."*
- Second framing, verbatim: *"The Background Synchronization API allows web applications to defer
  server synchronization work to their service worker to handle at a later time, if the device is
  offline. Uses may include sending requests in the background if they couldn't be sent while the
  application was being used."*
- `SyncManager`, verbatim: *"Registers tasks to be run in a service worker at a later time with
  network connectivity. These tasks are referred to as background sync requests."*
- `SyncEvent`, verbatim: *"Represents a synchronization event, sent to the global scope of a
  ServiceWorker. It provides a way to run tasks in the service worker once the device has network
  connectivity."*
- `ServiceWorkerRegistration.sync` (read only), verbatim: *"Returns a reference to the SyncManager
  interface for registering tasks to run once the device has network connectivity."*
- Registration example, verbatim from the page:

  ```js
  async function syncMessagesLater() {
    const registration = await navigator.serviceWorker.ready;
    try {
      await registration.sync.register("sync-messages");
    } catch {
      console.log("Background Sync could not be registered!");
    }
  }
  ```

- Consumption example, verbatim from the page:

  ```js
  self.addEventListener("sync", (event) => {
    if (event.tag === "sync-messages") {
      event.waitUntil(sendOutboxMessages());
    }
  });
  ```

- Tag inspection, verbatim from the page:

  ```js
  registration.sync.getTags().then((tags) => {
    if (tags.includes("sync-messages")) {
      console.log("Messages sync already requested");
    }
  });
  ```

- 🔴 The MDN overview page states **no** retry counts, permission model or queue limits.
  Do not assert any.

## SyncManager.register() — https://developer.mozilla.org/en-US/docs/Web/API/SyncManager/register

- Signature `register(tag)`. `tag` is *"An identifier for this synchronization event. This will be
  the value of the `tag` property of the `SyncEvent` that gets passed into the service worker's
  `sync` event handler."*
- Returns *"A Promise that resolves to `undefined`."*
- Exceptions, verbatim:
  - `InvalidStateError` `DOMException` — *"Thrown if current service worker is not active."*
  - `NotAllowedError` `DOMException` — *"Thrown if background sync has been disabled by the user."*
- Description, verbatim: *"registers a synchronization event, triggering a `sync` event inside the
  associated service worker as soon as network connectivity is available."*

## SyncEvent — https://developer.mozilla.org/en-US/docs/Web/API/SyncEvent

- Verbatim: *"The SyncEvent interface of the Background Synchronization API represents a sync
  action that is dispatched on the `ServiceWorkerGlobalScope` of a ServiceWorker."* Inherits from
  `ExtendableEvent`.
- `SyncEvent.tag` (read only) — *"Returns the developer-defined identifier for this SyncEvent."*
- 🔴 `SyncEvent.lastChance` (read only), verbatim: *"Returns `true` if the user agent will not make
  further synchronization attempts after the current attempt."*
  ⇒ This is the ONLY documented statement about retry exhaustion on MDN. It establishes that the
  user agent retries, and that there is a final attempt — it does **not** give a count, an interval
  or a wall-clock budget. Do not invent one.

## Lighthouse v12.0.0 — https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0

- 🔴 **The PWA category was removed in Lighthouse 12.0.0**, released **April 22** (2024), shipped
  with Chrome 126. Release note, verbatim: *"Lighthouse has removed the PWA category"* — as per
  *"Chrome's updated Installability Criteria"*, and the notes point readers at the updated PWA
  documentation for future testing.
- Other audits removed in the same release, useful as corroboration that this was a general
  pruning and not a PWA-specific verdict: `layout-shifts-elements`, `no-unload-listeners`,
  `duplicate-id-active`, `plugins`; `tap-targets` replaced by `target-size` in the accessibility
  category; `uses-rel-preload` and `preload-fonts` moved to an experimental config.
- ⇒ **The consequence for a devbible page:** "run Lighthouse's PWA audit" is advice that no longer
  has a target. The installability check that used to live there is now Chrome's own criteria plus
  the DevTools Application panel. Any page telling a reader to score a PWA category is stale.

## Chrome's updated installability criteria — https://developer.chrome.com/blog/update-install-criteria

- 🔴 Verbatim: *"As a first step we have removed the requirement to have a service worker that
  implements the `fetch()` method for installation from the menu, since version 108 on mobile and
  112 on Desktop."*
- The post does not restate the full remaining criteria in one place; it says a manifest with
  certain fields plus quality criteria remain, and that Chrome intends to *"experiment with
  removing the requirement of certain manifest fields"* pending metrics and feedback.
- Still recommended even where not strictly required: `short_name` or `name`, `icons`
  (preferably maskable), `start_url`, `display`.
- ⇒ Cross-check with the Next.js PWA guide, which already states the bar as two items — a valid
  manifest and HTTPS — and says *"Notably, you can trigger install prompts without needing offline
  support."* The two sources agree; cite both.

## Already banked elsewhere — do not re-fetch

In [[research-nextjs-progressive-web-apps]]:

- `next dev --experimental-https` and the `mkcert` sentence (CLI doc) — the local HTTPS story a
  testing chunk needs.
- Prefetching is disabled in development, so **offline behaviour must be tested against a
  production build** (offline-support guide).
- The `experimental.useOffline` connectivity probe: one `HEAD` to the current page URL with the
  RSC header, aborted at 200 ms; backoff 500 ms → 1 s → 2 s → 3 s cap, never gives up.
- The RSC header constants (`rsc`, `next-router-prefetch`, `next-action`, `_rsc`) — why a
  URL-keyed service-worker cache confuses an HTML request with an RSC request.
- WebKit's seven-day script-writable-storage cap and the Home Screen carve-out.
- RFC 8030 §7.3: *"A push service MUST return a 404 (Not Found) status code"* for an expired
  subscription; 410 Gone is the **receipt** path, not the send path.

## Could NOT confirm (2026-09-03) — state as uncertain, never assert

1. Any concrete retry count, back-off interval or total time budget the browser gives a
   registered background sync. MDN documents only `lastChance`.
2. Whether Safari/WebKit implements the Background Synchronization API at all as of this date —
   MDN's banner says only that it is not Baseline and does not work in some widely-used browsers.
   Write it as "not available everywhere; treat it as an enhancement" rather than naming browsers.
3. Whether Next.js ships any first-party helper for background sync. Nothing in the PWA guide
   mentions it; the guide's only offline pointer is Serwist.
4. The exact set of manifest fields Chrome currently enforces for installability — the blog post
   deliberately leaves this in flux.
