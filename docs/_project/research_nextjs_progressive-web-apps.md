---
name: research-nextjs-progressive-web-apps
description: Banked primary-source research for the devbible Next.js topic "Progressive Web Apps" (docs/nextjs/pages/12-seo-metadata-and-accessibility/10*). Manifest, service workers, offline boundary vs experimental.useOffline, Web Push, iOS/Safari limits. do not re-derive.
metadata:
  type: project
---

# research_nextjs_progressive-web-apps — banked 2026-09-03 · do not re-derive

Version spine: **Next.js 16.3.4** · Node **>= 20.9** · App Router bundles React canary ·
Turbopack default bundler · browser floor Chrome/Edge/Firefox **111+**, Safari **16.4+**.
Library pulled in: **web-push 3.6.7** (registry.npmjs.org, checked 2026-09-03), pinned in
`src/data/pins.js` as `webpush`, tracks `['nextjs']`.

## Next.js PWA guide — https://nextjs.org/docs/app/guides/progressive-web-apps (version 16.3.4, lastUpdated 2026-07-30)

- Manifest: `app/manifest.ts` or `app/manifest.json`. Doc's example fields: name, short_name,
  description, start_url, display, background_color, theme_color, icons 192 + 512.
- Web Push support list, verbatim bullets: "iOS 16.4+ for applications installed to the home
  screen" · "Safari 16 for macOS 13 or later" · "Chromium based browsers" · "Firefox".
- Verbatim: *"Notably, you can trigger install prompts without needing offline support."*
- Service worker registration in the guide is bundler-processed:
  `navigator.serviceWorker.register(new URL('../lib/service-worker.js', import.meta.url), { scope: '/', updateViaCache: 'none' })`
- Push client: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) })`,
  then `JSON.parse(JSON.stringify(sub))` before handing to a Server Action.
- Server Actions in `app/actions.ts` with `webpush.setVapidDetails(mailto, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`.
  The guide stores the subscription in a module-level `let subscription` and says in prose:
  "In a production environment, you would want to store the subscription in a database for
  persistence across server restarts and to manage multiple users' subscriptions."
- VAPID keys: `web-push generate-vapid-keys`; env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`.
- Service worker handlers shown: `push` (event.data.json(), showNotification via
  `event.waitUntil(self.registration.showNotification(...))`, options body/icon/badge/vibrate/data)
  and `notificationclick` (`event.notification.close()`, `clients.openWindow(...)`).
- Install requirements, verbatim: "1. A valid web app manifest (created in step 1)" /
  "2. The website served over HTTPS".
- On `beforeinstallprompt`, verbatim: *"we do not recommend this as it is not cross browser and platform"*
  (full sentence: "You can provide a custom installation button with `beforeinstallprompt`,
  however, we do not recommend this as it is not cross browser and platform (does not work on
  Safari iOS).")
- Local testing: `next dev --experimental-https`; notifications enabled in browser.
- Security headers example: global `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`; and for `source: '/sw.js'`:
  `Content-Type: application/javascript; charset=utf-8`,
  `Cache-Control: no-cache, no-store, must-revalidate`,
  `Content-Security-Policy: default-src 'self'; script-src 'self'`.
  ⚠️ NOTE THE INCONSISTENCY: step 5 registers a **bundled** worker via `new URL(..., import.meta.url)`,
  but step 8's header rule targets the literal path `/sw.js`. The docs never state the emitted
  URL of the bundled worker. UNCONFIRMED — do not assert a path.
- Extending: "Offline Support" bullet points at `useOffline` for connectivity-aware UI and says
  "For full service-worker-based offline caching, one option is Serwist", linking
  https://github.com/serwist/serwist and its next-turbo-basic / next-basic examples.
- Static export caveat: "you will need to move from Server Actions to calling an external API,
  as well as moving your defined headers to your proxy."

## Offline support guide — https://nextjs.org/docs/app/guides/offline-support

🔴 THE BOUNDARY SENTENCE (line 145 of the .md), verbatim:
"This feature only applies to soft navigations into prefetched routes and Server Action calls
from the current page. A full page reload while offline still fails because the browser needs
the network to deliver the HTML; full offline loads would need a service worker (see the
Progressive Web Apps guide)."
Short quotable fragment (18 words): "A full page reload while offline still fails because the
browser needs the network to deliver the HTML".

- Guide pairs `experimental.useOffline` with `cacheComponents` and `partialPrefetching`;
  the prefetched **App Shell** is what renders offline.
- Prefetching is disabled in development → test offline against a production build.

## useOffline hook — https://nextjs.org/docs/app/api-reference/functions/use-offline

- Header banner, verbatim: "This feature is currently experimental and subject to change, it's
  not recommended for production."
- Without the flag the hook always returns `false`. Import is `import { useOffline } from 'next/offline'`.
- Returns table: `true` = "The app is offline. A network request has failed, or the browser has
  fired an `offline` event." `false` = "The app is online, or rendering on the server. This is
  also the initial value before hydration completes."
- Version history row: `v16.x.0` `useOffline` hook introduced.

## experimental.useOffline config — https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline

- Enabling listens for `offline`/`online`, detects network failures on navigation/prefetch/Server
  Action, polls with `HEAD` + backoff, retries blocked requests, exposes the hook.
- Connectivity check: one `HEAD` to the current page URL with the RSC header, aborted at 200 ms.
  Both "resolves" and "aborted at 200 ms" count as online (a truly offline request fails at DNS/TCP
  almost instantly).
- Backoff table: attempt 1 → 500 ms, 2 → 1 s, 3 → 2 s, 4+ → 3 s cap. Never gives up.

## manifest.json convention — https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest (lastUpdated 2026-03-03)

- "Add or generate a `manifest.(json|webmanifest)` file that matches the Web Manifest
  Specification in the **root** of `app` directory".
- Verbatim Good-to-know: "`manifest.js` is a special Route Handlers that is cached by default
  unless it uses a Request-time API or dynamic config option." (sic — "Route Handlers")
- For the full field list the doc defers to the `MetadataRoute.Manifest` type and MDN.

## Next.js source (canary), read 2026-09-03

- `packages/next/src/lib/metadata/get-metadata-route.ts` → `normalizeMetadataRoute`:
  `if (page === '/robots') route += '.txt'` / `else if (page === '/manifest') route += '.webmanifest'`.
  ⇒ a generated `app/manifest.ts` serves at **`/manifest.webmanifest`**.
- `packages/next/src/build/webpack/loaders/metadata/discover.ts`:
  `staticManifestExtension = ['webmanifest','json']`, enumerates
  `staticManifestExtension.concat(pageExtensions)` and takes `manifestFile[0]`;
  `extension = staticManifestExtension.includes(ext.slice(1)) ? ext.slice(1) : 'webmanifest'`;
  writes `` `${basePath}/${name}.${extension}` `` into `staticImagesMetadata.manifest`.
  ⇒ the `<link rel="manifest">` href is emitted by the framework and basePath-prefixed;
  ⇒ a static `manifest.json` keeps `.json`; anything else becomes `.webmanifest`;
  ⇒ two manifests = first match wins, ordering is an implementation detail.
- `packages/next/src/client/components/app-router-headers.ts`:
  `RSC_HEADER = 'rsc'`, `RSC_CONTENT_TYPE_HEADER = 'text/x-component'`,
  `NEXT_RSC_UNION_QUERY = '_rsc'`, `NEXT_ROUTER_PREFETCH_HEADER = 'next-router-prefetch'`,
  `NEXT_ROUTER_STATE_TREE_HEADER = 'next-router-state-tree'`, `ACTION_HEADER = 'next-action'`.
  ⇒ an RSC request to a page URL differs from the HTML request only by headers (+ a `_rsc`
  query on prefetches). A URL-keyed service-worker cache will confuse the two.

## generateMetadata / generateViewport

- `appleWebApp: { title, statusBarStyle, startupImage }` emits `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title">`, `<link rel="apple-touch-startup-image">`,
  `<meta name="apple-mobile-web-app-status-bar-style">`. `itunes: { appId, appArgument }` emits
  `<meta name="apple-itunes-app">`. Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- `metadata.manifest: 'https://…/manifest.json'` emits `<link rel="manifest" href="…">` (only
  needed when pointing at a manifest you did not generate via the file convention).
- `themeColor` lives on the **`viewport`** export, supports media variants.
  https://nextjs.org/docs/app/api-reference/functions/generate-viewport

## next CLI — https://nextjs.org/docs/app/api-reference/cli/next

- "`next dev --experimental-https` is only intended for development and creates a locally trusted
  certificate with `mkcert`. In production, use properly issued certificates from trusted authorities."
- Also `--experimental-https-key/-cert/-ca`. Default port 3000, server at `https://localhost:3000`.

## public folder — https://nextjs.org/docs/app/api-reference/file-conventions/public-folder

- Files under `public/` are served from `/`. Default header applied: `Cache-Control: public, max-age=0`.

## MDN — service workers

- `ServiceWorkerContainer.register()`
  https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register
  - "The default `scope` for a service worker registration is the directory where the service
    worker script is located (resolving `./` against `scriptURL`)."
  - "A service worker can't have a scope broader than its own location, unless the server
    specifies a broader maximum scope in a `Service-Worker-Allowed` header on the service worker script."
  - `updateViaCache`: `'all'` (HTTP cache for main script + imports), `'imports'` (main script
    always from network), `'none'` (nothing from the HTTP cache).
  - Secure context only. `SecurityError` when scriptURL is not a potentially trustworthy origin,
    or scriptURL/scope are not same-origin with the registering page.

## MDN — manifest members

- Members index: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
  background_color, categories, description, display, display_override, file_handlers, icons, id,
  launch_handler, name, note_taking, orientation, prefer_related_applications, protocol_handlers,
  related_applications, scope, scope_extensions, screenshots, serviceworker, share_target,
  short_name, shortcuts, start_url, theme_color, `*_localized`. `dir`, `lang`, `iarc_rating_id`
  listed as not implemented.
- `start_url` https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url
  - "If the value is relative, it is resolved against the manifest file's URL."
  - "If `start_url` is unspecified or the value is invalid (i.e., not a string, not a valid URL,
    or not same-origin as the page that links to the manifest), the URL of the page that links to
    the manifest is used."
  - "If `scope` is not specified in the manifest it will be inferred from the `start_url`".
- `display` https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
  - Fallback chain `fullscreen` → `standalone` → `minimal-ui` → `browser`; default `browser`.
- `prefer_related_applications` https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/prefer_related_applications
  - "should be set to `false` or omitted to make your web app installable" (Chromium note).

## MDN — install and push APIs

- `beforeinstallprompt` https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
  - "Limited availability - This feature is not Baseline because it does not work in some of the
    most widely-used browsers." Spec: WICG **Manifest Incubations**.
  - `preventDefault()` "Cancels the event, which prevents the browser displaying its own install UI on some platforms".
  - "There's no guaranteed time this event is fired, but it usually happens on page load."
  - `prompt()` → `userChoice` promise resolving `{ outcome }`.
- `Navigator.getInstalledRelatedApps()` https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps
  - Limited availability. Must be a **top-level secure context**; cannot be called in an iframe;
    throws `InvalidStateError` otherwise. Returns `[{ platform, id?, url?, version? }]`.
    Platforms include `"webapp"`. Cannot detect the invoking PWA unless it self-lists in
    `related_applications`.
- `PushManager.subscribe()` https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
  - `userVisibleOnly`: "This parameter is required in some browsers like Chrome and Edge. They
    will reject the Promise if `userVisibleOnly` is not set to `true`."
  - `applicationServerKey`: base64 string or ArrayBuffer holding an **ECDSA P-256 public key**;
    "This key IS NOT the same ECDH key that you use to encrypt the data."
  - "you should not be spamming users with notifications they didn't agree to — but going forward
    browsers will explicitly disallow notifications not triggered in response to a user gesture."

## RFC 8030 (HTTP Web Push) — https://www.rfc-editor.org/rfc/rfc8030.txt

- §7.3, verbatim: "A push service MUST return a 404 (Not Found) status code if an application
  server attempts to send a push message to an expired push message subscription."
  (Quotable ≤25-word fragment: "A push service MUST return a 404 (Not Found) status code".)
- §7.3 also: "A push service MAY expire a subscription at any time."
- Undelivered-before-expiry receipt case returns **410 (Gone)**: "the push service MUST push a
  failure response with a status code of 410 (Gone)." (This is the *receipt* path, not the
  application-server send path — do not conflate them on a page.)

## web-push library README — https://github.com/web-push-libs/web-push

- `sendNotification()` resolves/rejects with an object exposing `statusCode`, `headers`, `body`.
- `webpush.generateVAPIDKeys()` exists in-process as well as via the CLI.

## WebKit

- Web Push for Web Apps on iOS and iPadOS — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  - iOS/iPadOS **16.4+**; only for **Home Screen web apps** (manifest `display` `standalone` or
    `fullscreen`); permission must be requested "in response to direct user interaction — such as
    tapping on a 'subscribe' button"; Badging API (`setAppBadge`/`clearAppBadge`) supported on
    Home Screen web apps from 16.4.
- Full Third-Party Cookie Blocking and More — https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
  - Seven-day cap: "deleting all of a website's script-writable storage after seven days of Safari
    use without user interaction on the site." Covers IndexedDB, LocalStorage, SessionStorage,
    media keys, **Service Worker registrations and cache**.
  - Home Screen carve-out, verbatim: "We do not expect the first-party in such a web application to
    have its website data deleted." Home Screen web apps have "their own counter of days of use".

## Could NOT confirm (2026-09-03) — state as uncertain on the page, never assert

1. The emitted URL of a service worker registered via `new URL('../lib/service-worker.js', import.meta.url)`
   under Turbopack, and whether Next sets `Service-Worker-Allowed` for it. The docs show
   `scope: '/'` with a bundled worker but never explain how the scope rule is satisfied.
2. Whether Next.js emits a `crossOrigin` attribute on the generated `<link rel="manifest">`.
   `discover.ts` only records a URL string; the render site was not read.
3. Whether iOS 16.4+ reads manifest `icons[]` for the Home Screen icon, or still requires
   `apple-touch-icon`. Ship both.
4. Whether resolution order between `app/manifest.json` and `app/manifest.ts` is a documented
   guarantee (it is an ordered `concat` in `discover.ts`, i.e. an implementation detail).
