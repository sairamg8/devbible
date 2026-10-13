---
title: "Link map · JavaScript · Part 7 (phases 11–12)"
sidebar_label: "07 · network and browser platform"
sidebar_position: 7
---

# Link map · JavaScript · Part 7 (phases 11–12)

Covers every topic row of `docs/javascript/syllabus/03-web-apis.md` in phase 11 (T11-01 to T11-21, network, storage and data transfer) and phase 12 (T12-01 to T12-21, the browser platform). That is 42 rows, and all 42 are ✅ written: phase 11 and phase 12 each have a page directory per topic (T12-14 is a single file).
*read* = I fetched the page and checked the passage the line cites; *headings only* = fetched at 200, title and size checked, body not read closely. Third-party links carry a date only where the page or its URL shows one (javascript.info chapters also show a last-modified date near the title, which I did not copy). No `#anchors` are given. A block with no "Beyond the docs" line means searches turned up nothing I could fetch and judge well enough to recommend (for example the GitHub repositories I found were not fetchable from this environment, so they are not listed).

🔴 **Version note.** Parts 3 and 5 of our JavaScript syllabus (`docs/javascript/README.md`) mark browser output with `VERIFY` rather than measuring it, so these links are for browser behaviour as MDN and the platform specs describe it on 2026-10-13. MDN has moved several URLs recently: the CORS, cookies, CSP and same-origin pages now sit under `/Web/HTTP/Guides/` and `/Web/Security/Defenses/`, and the links below are the canonical ones after redirects. Some pages are older than the APIs they describe: the Chrome transferable-objects post is from the Chrome 13 era (2011), the Jake Archibald offline cookbook is 2014 (the lifecycle parts still hold), and several third-party tutorials below are from 2017 to 2022 (dates are given on each line). Features still uneven across browsers at the time of fetching: `scheduler.yield`, `Response.textStream`, the Navigation API in Firefox, File System Access, the Battery Status API (Chromium only).

---

## Phase 11 — Network, storage and data transfer

### T11-01 · `fetch` — Master · ✅ written `docs/javascript/pages/phase-11-network-storage/01-fetch/01-the-critical-surprise.md`
- **Read this:** [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · MDN · the request/response shape and the `response.ok` check · covers our angle: **full** · fetched 2026-10-13 (*read*)
- **Also good:** [Fetch](https://javascript.info/fetch) · javascript.info · the same flow taught step by step, with `response.ok` before `.json()` · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [The Fetch API Trap: When HTTP Errors Don't Land in Catch](https://dev.to/kresohr/the-fetch-api-trap-when-http-errors-dont-land-in-catch-40l6) · DEV Community · builds the whole article on the 404 or 500 that skips `catch`, then shows the `response.ok` guard; narrower than MDN but a clearer single-point lesson · fetched 2026-10-13 (*read*)
- **Our delta:** which failures do reject (network, abort) versus which resolve, in one table.

### T11-02 · Request bodies — Master · ✅ written `docs/javascript/pages/phase-11-network-storage/02-request-bodies/01-choosing-a-body.md`
- **Read this:** [Using FormData objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects) · MDN · building a `FormData` and sending it as a body · covers our angle: **partial** — not the `Content-Type` the browser chooses for each body type · fetched 2026-10-13 (*read*)
- **Also good:** [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · MDN · lists the accepted `body` types and shows a `URLSearchParams` body with an explicit `Content-Type` header; it does not tabulate the automatic header per type · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Uploading files using fetch and FormData](https://muffinman.io/blog/uploading-files-using-fetch-multipart-form-data/) · Muffin Man blog, 2018-03-19 · explains the multipart boundary the browser writes into the header, and why setting `Content-Type` by hand breaks the upload · fetched 2026-10-13 (*read*)
- **Our delta:** one table of body type to automatic `Content-Type`.

### T11-03 · A `fetch` wrapper worth reusing — Master · ✅ written `docs/javascript/pages/phase-11-network-storage/03-fetch-wrapper/01-what-fetch-leaves-you.md`
- **Read this:** [Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · MDN · checking `ok`, headers and aborting, the pieces a wrapper combines · covers our angle: **partial** — no wrapper design, typed errors or base URL · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Safe Data Fetching in Modern JavaScript](https://www.builder.io/blog/safe-data-fetching) · Builder.io blog · a `ResponseError` class that carries the failed response so `catch` can read status and body; also recommends a library, which our page does not · fetched 2026-10-13 (*read*)
- **Our delta:** one wrapper with timeout, cancellation, typed errors, base URL and auth header together.

### T11-04 · `URL` and `URLSearchParams` — Master · ✅ written `docs/javascript/pages/phase-11-network-storage/04-url-and-searchparams/01-the-url-object.md`
- **Read this:** [URL API](https://developer.mozilla.org/en-US/docs/Web/API/URL_API) · MDN · the `URL` object, its parts and `searchParams` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) · MDN · methods and iteration · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [URL objects](https://javascript.info/url) · javascript.info · `new URL(path, base)` for relative resolution, then `searchParams` and the `encodeURIComponent` versus `encodeURI` difference in one chapter · fetched 2026-10-13 (*read*)
- **Our delta:** encoding rules shown as input and output pairs.

### T11-05 · CORS from the client side — Master · ✅ written `docs/javascript/pages/phase-11-network-storage/05-cors-client-side/01-what-the-browser-is-doing.md`
- **Read this:** [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) · MDN · simple versus preflighted requests, credentials and the wildcard rule · covers our angle: **full** · fetched 2026-10-13 (*read*)
- **Also good:** [Fetch Standard](https://fetch.spec.whatwg.org/) · WHATWG · the normative CORS protocol; large (*headings only*) · fetched 2026-10-13
- **Also good:** [CORS errors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors) · MDN · starts from the console message, notes that JavaScript cannot see why a CORS request failed, and lists what the client can do · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to Debug Any CORS Error](https://httptoolkit.com/blog/how-to-debug-cors-errors/) · HTTP Toolkit blog · walks from the console message to the Network tab and the missing header, which is the "read the console error" skill in our row · fetched 2026-10-13 (*read*)
- **Our delta:** the exact preflight a cross-origin `PUT` sends, written out header by header.

### T11-06 · `Request`, `Response` and `Headers` — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/06-request-response-headers/01-the-three-objects.md`
- **Read this:** [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) · MDN · the constructor and the `bodyUsed` property · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Response.clone()](https://developer.mozilla.org/en-US/docs/Web/API/Response/clone) · MDN · clone before reading; throws if the body is already used · [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) · MDN · fetched 2026-10-13 (*read* for `clone()`, *headings only* for Headers)
- **Beyond the docs:** [What happens when you read a response?](https://jakearchibald.com/2014/reading-responses/) · Jake Archibald, 2014-08-12 · the design argument for one-shot bodies and for calling `clone()` before reading; written against an early draft (its `response.body.asJSON()` no longer exists), so take the reasoning, not the code · fetched 2026-10-13 (*read*)
- **Our delta:** why a body is one-shot (it is a stream) and the clone cost.

### T11-07 · Reading responses — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/07-reading-responses/01-the-body-readers.md`
- **Read this:** [Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams) · MDN · `response.body.getReader()` and reading chunks · covers our angle: **partial** — the other body readers are on the Response page · fetched 2026-10-13 (*read*)
- **Also good:** [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) · MDN · `json`, `text`, `blob`, `arrayBuffer`, `formData` · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Fetch: Download progress](https://javascript.info/fetch-progress) · javascript.info · a `reader.read()` loop that counts received bytes, and the rule that you cannot use both a reader and a body method on one response · fetched 2026-10-13 (*read*)
- **Our delta:** the decision of which reader to call, and decoding text chunks across boundaries.

### T11-08 · Aborting and timing out — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/08-aborting-and-timing-out/01-the-controller-and-the-signal.md`
- **Read this:** [AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) · MDN · a signal that aborts after a delay, with a `TimeoutError` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Fetch: Abort](https://javascript.info/fetch-abort) · javascript.info · `AbortController` with `fetch`, step by step · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Cancelling In-Flight Fetch Requests with AbortController](https://blog.openreplay.com/cancelling-in-flight-fetch-abortcontroller/) · OpenReplay blog · the `useEffect` cleanup that aborts on unmount; does not cover `AbortSignal.timeout` · fetched 2026-10-13 (*read*)
- **Our delta:** telling a timeout from a manual abort by error name.

### T11-09 · Cookies — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/09-cookies/01-the-api-and-the-attributes.md`
- **Read this:** [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) · MDN · `Set-Cookie`, `HttpOnly`, `Secure`, `SameSite` · covers our angle: **partial** — not the `document.cookie` quirks · fetched 2026-10-13 (*read*)
- **Also good:** [Cookies, document.cookie](https://javascript.info/cookie) · javascript.info · reading and writing through `document.cookie` · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Cookies vs localStorage for JWT Authentication](https://blog.openreplay.com/cookies-vs-localstorage-jwt-auth/) · OpenReplay blog · compares XSS exposure for localStorage with CSRF exposure for cookies, which frames "a decision, not a default" · fetched 2026-10-13 (*read*)
- **Our delta:** the token-storage trade-off stated as a decision with both attack paths.

### T11-10 · `localStorage` and `sessionStorage` — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/10-web-storage/01-the-api-and-what-it-costs.md`
- **Read this:** [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) · MDN · the two areas, the synchronous API and the `storage` event · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Window: storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) · MDN · fires in other documents of the same origin, not the one that wrote · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [LocalStorage, sessionStorage](https://javascript.info/localstorage) · javascript.info · the `storage` event across tabs and string-only values with JSON round-tripping · fetched 2026-10-13 (*read*)
- **Our delta:** the blocking cost and quota failure handling.

### T11-11 · Uploading files — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/11-uploading-files/01-getting-the-file.md`
- **Read this:** [Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) · MDN · `input type="file"`, `File`, drag and drop · covers our angle: **partial** — chunking is not covered · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Resumable file upload](https://javascript.info/resume-upload) · javascript.info · asks the server how many bytes it has, then sends the rest; uses XHR for upload progress · fetched 2026-10-13 (*read*)
- **Our delta:** progress and chunking tied to the XHR versus fetch limit (T11-21).

### T11-12 · `Blob`, `File`, `FileReader` and object URLs — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/12-blob-file-filereader/01-blob-and-file.md`
- **Read this:** [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) · MDN · slices and readers · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) · MDN · [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Blob](https://javascript.info/blob) · javascript.info · explains the URL-to-Blob mapping the browser holds and why `revokeObjectURL` frees memory · fetched 2026-10-13 (*read*)
- **Our delta:** a preview-and-revoke recipe.

### T11-13 · WebSocket — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/13-websocket/01-connecting.md`
- **Read this:** [WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) · MDN · the API, with warnings about backpressure · covers our angle: **partial** — no reconnection or heartbeat design · fetched 2026-10-13 (*read*)
- **Also good:** [WebSocket](https://javascript.info/websocket) · javascript.info · handshake, framing and close codes · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to Implement Reconnection Logic for WebSockets](https://oneuptime.com/blog/post/2026-01-27-websocket-reconnection/view) · OneUptime blog · exponential backoff with jitter and heartbeats, the two pieces our row names; I read the sections on both, not every example · fetched 2026-10-13 (*read*)
- **Our delta:** when a WebSocket is overkill (see T11-18).

### T11-14 · Same-origin policy and `postMessage` — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/14-same-origin-and-postmessage/01-what-an-origin-is.md`
- **Read this:** [Window: postMessage()](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) · MDN · check `event.origin`, pin the target origin · covers our angle: **full** · fetched 2026-10-13 (*read*)
- **Also good:** [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Testing Web Messaging](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/11-Client-side_Testing/11-Testing_Web_Messaging/) · OWASP Web Security Testing Guide, v4.2 · the attacker's view of a missing origin check, with vulnerable handlers · fetched 2026-10-13 (*read*)
- **Our delta:** the sandboxed iframe whose origin is the string `null`.

### T11-15 · Content Security Policy from the JavaScript side — Understand · ✅ written `docs/javascript/pages/phase-11-network-storage/15-csp/01-what-a-policy-breaks.md`
- **Read this:** [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) · MDN · directives and what inline script needs · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Mitigate cross-site scripting (XSS) with a strict Content Security Policy](https://web.dev/articles/strict-csp) · web.dev (Google) · a nonce-based policy with `strict-dynamic`, and why host allowlists are weak · fetched 2026-10-13 (*read*)
- **Our delta:** what each directive breaks in client code, such as inline handlers.

### T11-16 · `IndexedDB` — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/16-indexeddb/01-the-shape-of-it.md`
- **Read this:** [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) · MDN · stores, transactions, `onupgradeneeded` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [IndexedDB](https://javascript.info/indexeddb) · javascript.info · the upgrade-by-`oldVersion` pattern for schema changes, in plain callbacks · fetched 2026-10-13 (*read*)
- **Our delta:** when it is the right store and when `localStorage` suffices. (A popular promise wrapper, `idb` by Jake Archibald, is on GitHub; the page was not fetchable here, so it is not listed.)

### T11-17 · Service workers and the Cache API — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/17-service-workers/01-the-lifecycle-and-the-cache.md`
- **Read this:** [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · MDN · install, activate, fetch events · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [The service worker lifecycle](https://web.dev/articles/service-worker-lifecycle) · web.dev · why a new worker waits, which is the stale-worker trap · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [The offline cookbook](https://jakearchibald.com/2014/offline-cookbook/) · Jake Archibald, 2014 · names each caching strategy, including stale-while-revalidate; 2014, so the lifecycle detail should be checked against MDN · fetched 2026-10-13 (*read*)
- **Our delta:** the update lifecycle shown as a timeline.

### T11-18 · Server-sent events — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/18-server-sent-events/01-eventsource-and-the-stream-format.md`
- **Read this:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · the stream format and `EventSource` · covers our angle: **full** · fetched 2026-10-13 (*read*)
- **Also good:** [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [WebSocket vs SSE: Which One Should You Use?](https://websocket.org/comparisons/sse/) · WebSocket.org · compares automatic reconnection with `Last-Event-ID` against hand-built WebSocket retry, which is the "when it beats a WebSocket" half of the row · fetched 2026-10-13 (*read*)
- **Our delta:** the HTTP/1.1 six-connection limit across tabs.

### T11-19 · Streams — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/19-streams/01-the-three-streams.md`
- **Read this:** [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) · MDN · overview and links to each class · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Streams — The definitive guide](https://web.dev/articles/streams) · web.dev (Google) · push versus pull sources, `pipeThrough` and `TransformStream` with worked examples · fetched 2026-10-13 (*read*)
- **Our delta:** piping a `fetch` body through a transform.

### T11-20 · `navigator.sendBeacon` and `keepalive` — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/20-sendbeacon-keepalive/01-sending-on-the-way-out.md`
- **Read this:** [Navigator: sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) · MDN · send on `visibilitychange`, not `unload` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) · Chrome for Developers · why `unload` is unreliable · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Sending Background Data with the Beacon API](https://blog.openreplay.com/sending-background-data-beacon-api/) · OpenReplay blog · when to use `sendBeacon` versus `fetch` with `keepalive` · fetched 2026-10-13 (*read*)
- **Our delta:** fire-and-forget limits (no response, payload cap).

### T11-21 · `XMLHttpRequest` — Know · ✅ written `docs/javascript/pages/phase-11-network-storage/21-xmlhttprequest/01-what-it-still-does.md`
- **Read this:** [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) · MDN · `upload` and `progress` events · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [XMLHttpRequest](https://javascript.info/xmlhttprequest) · javascript.info · lists upload progress as a thing `fetch` cannot do · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Has fetch() caught up with XMLHttpRequest in JavaScript?](https://waspdev.com/articles/2025-10-10/has-fetch-caught-up-with-xhr) · WaspDev blog, 2025-10-10 · tests what `fetch` still lacks; recent, so it matches our "why upload progress is the reason" claim · fetched 2026-10-13 (*read*)
- **Our delta:** a side-by-side upload with progress.

---

## Phase 12 — The browser platform

### T12-01 · DevTools beyond `console.log` — Master · ✅ written `docs/javascript/pages/phase-12-browser-platform/01-devtools/01-the-console-api.md`
- **Read this:** [Console API reference](https://developer.chrome.com/docs/devtools/console/api) · Chrome for Developers · `table`, `time`, `group`, `trace` · covers our angle: **partial** — Chrome only · fetched 2026-10-13 (*read*)
- **Also good:** [Memory panel overview](https://developer.chrome.com/docs/devtools/memory) · Chrome for Developers · [Coverage: find unused JavaScript and CSS](https://developer.chrome.com/docs/devtools/coverage) · fetched 2026-10-13 (*headings only*) · [console](https://developer.mozilla.org/en-US/docs/Web/API/console) · MDN · cross-browser list · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Hidden Gems in Chrome DevTools](https://blog.openreplay.com/hidden-gems-chrome-devtools/) · OpenReplay blog · Coverage, request blocking and other panels in a short tour · fetched 2026-10-13 (*read*)
- **Our delta:** a debugging checklist tied to symptoms.

### T12-02 · Client-side security — Master · ✅ written `docs/javascript/pages/phase-12-browser-platform/02-client-side-security/01-the-trust-boundary.md`
- **Read this:** [Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) · OWASP · output encoding by context, with dangerous sinks such as `innerHTML` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Clickjacking Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html) · OWASP · [Web security](https://developer.mozilla.org/en-US/docs/Web/Security) · MDN · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Prevent DOM-based cross-site scripting vulnerabilities with Trusted Types](https://web.dev/articles/trusted-types) · web.dev (Google) · makes sinks like `innerHTML` reject plain strings · fetched 2026-10-13 (*read*)
- **Our delta:** `target="_blank"` and dependency risk in the same checklist.

### T12-03 · Timers and frames — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/03-timers-and-frames/01-timers.md`
- **Read this:** [Window: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) · MDN · paused in background tabs · covers our angle: **partial** — no clamping detail · fetched 2026-10-13 (*read*)
- **Also good:** [Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) · Jake Archibald · Posted 2015-08-17 · where `setTimeout` callbacks sit among tasks and microtasks, with rendering between tasks; it never mentions `requestAnimationFrame`, so it covers the timer half only · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Heavy throttling of chained JS timers beginning in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88) · Chrome for Developers · the conditions for hidden-tab throttling, and a pointer to animation APIs; I read the opening, Chrome-only · fetched 2026-10-13 (*read*)
- **Our delta:** one table of clamping and throttling rules.

### T12-04 · `IntersectionObserver` — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/04-intersectionobserver/01-the-api.md`
- **Read this:** [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) · MDN · thresholds and root margin · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to Implement Infinite Scroll in Vanilla JavaScript](https://blog.openreplay.com/implement-infinite-scroll-vanilla-javascript/) · OpenReplay blog · a sentinel element, a fetch guard against overlap, and `disconnect()` at the end · fetched 2026-10-13 (*read*)
- **Our delta:** impression tracking.

### T12-05 · `ResizeObserver` — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/05-resizeobserver/01-element-level-responsiveness.md`
- **Read this:** [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to fix ResizeObserver loop completed with undelivered notifications](https://trackjs.com/javascript-errors/resizeobserver-loop-completed-with-undelivered-notifications/) · TrackJS · explains when the warning is harmless and when your callback resizes what it observes · fetched 2026-10-13 (*read*)
- **Our delta:** a loop-safe callback pattern.

### T12-06 · `PerformanceObserver` and the metrics that matter — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/06-performanceobserver/01-the-timeline.md`
- **Read this:** [Web Vitals](https://web.dev/articles/vitals) · web.dev (Google) · LCP, INP and CLS with thresholds · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Custom metrics](https://web.dev/articles/custom-metrics) · web.dev (Google), last updated 2024-08-02 · User Timing marks and measures read back through a `PerformanceObserver`, and a `longtask` observer, which is the hands-on half of our row · fetched 2026-10-13 (*read*)
- **Our delta:** `performance.now`, marks and measures with the long-task entry. The Google `web-vitals` library repository exists on GitHub but was not fetchable here, so it is not listed.

### T12-07 · Web Workers — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/07-web-workers/01-starting-and-talking.md`
- **Read this:** [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) · MDN · what transfer detaches · fetched 2026-10-13 (*read*) · [Use web workers to run JavaScript off the browser's main thread](https://web.dev/articles/off-main-thread) · web.dev · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Transferable objects - Lightning fast](https://developer.chrome.com/blog/transferable-objects-lightning-fast) · Chrome for Developers · structured clone is a copy, transfer is zero-copy, with a 32 MB example; the numbers are from the Chrome 13 era · fetched 2026-10-13 (*read*)
- **Our delta:** measuring the 500 ms move in the performance panel.

### T12-08 · The History API and client-side routing — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/08-history-and-routing/01-the-history-api.md`
- **Read this:** [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) · MDN · `pushState`, `popstate` · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Modern client-side routing: the Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api) · Chrome for Developers · the `navigate` event; [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Building Client-Side Routing with the History API](https://blog.openreplay.com/build-client-side-routing-history-api/) · OpenReplay blog · a small router, showing that `pushState` does not fire `popstate` · fetched 2026-10-13 (*read*)
- **Our delta:** scroll restoration and the server fallback for deep links.

### T12-09 · `window`, `document`, `navigator`, `screen` — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/09-window-document-navigator/01-window-and-document.md`
- **Read this:** [Window](https://developer.mozilla.org/en-US/docs/Web/API/Window) · MDN · [Navigator](https://developer.mozilla.org/en-US/docs/Web/API/Navigator) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Browser environment, specs](https://javascript.info/browser-environment) · javascript.info · separates the DOM from the BOM and the host objects around it · fetched 2026-10-13 (*read*)
- **Our delta:** a legacy-versus-useful verdict per property.

### T12-10 · `WebCrypto` — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/10-webcrypto/01-randomness-and-hashing.md`
- **Read this:** [SubtleCrypto: digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) · MDN · SHA-256 of a string to hex · covers our angle: **full** for hashing · fetched 2026-10-13 (*read*)
- **Also good:** [Crypto: randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) · MDN · secure context only · [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Hashing a string with the Web Cryptography API](https://jameshfisher.com/2017/10/30/web-cryptography-api-hello-world/) · James Fisher, 2017-10-30 · a short `digest` walk-through; 2017, so read it with the MDN page · fetched 2026-10-13 (*read*)
- **Our delta:** why not to write your own crypto.

### T12-11 · Accessibility from JavaScript — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/11-accessibility-from-javascript/01-the-four-moments.md`
- **Read this:** [Keyboard focus](https://web.dev/learn/accessibility/focus) · web.dev Learn Accessibility · tab order and focus management · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) · MDN · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Accessibility improvements to client-side routing in Gatsby](https://www.gatsbyjs.com/blog/2020-02-10-accessible-client-side-routing-improvements/) · Gatsby blog, 2020-02-10 · the ARIA live region that announces a route change and why, from user testing; framework-specific, from 2020 · fetched 2026-10-13 (*read*)
- **Our delta:** focus on route change plus `matchMedia` for both preference queries.

### T12-12 · Feature detection and progressive enhancement — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/12-feature-detection/01-detecting-a-capability.md`
- **Read this:** [Implementing feature detection](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing/Feature_detection) · MDN · covers our angle: **full** · fetched 2026-10-13 (*read*)
- **Also good:** [Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent) · MDN · why UA sniffing is a last resort · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Not Everything Can Be Feature Detected](https://www.abeautifulsite.net/posts/not-everything-can-be-feature-detected/) · A Beautiful Site (Cory LaViska), 2022-08-15 · the cases where detection cannot answer the question · fetched 2026-10-13 (*read*)
- **Our delta:** a degrade-without-breaking example.

### T12-13 · What belongs on the server instead — Understand · ✅ written `docs/javascript/pages/phase-12-browser-platform/13-what-belongs-on-the-server/01-the-trust-boundary.md`
- **Read this:** [A01:2021 Broken Access Control](https://top10.owasp.org/2021/A01_2021-Broken_Access_Control/index.html) · OWASP Top 10 · access control only works in trusted server-side code (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) · OWASP · client-side validation is bypassable and is for feedback only (*read*) · fetched 2026-10-13
- **Also good:** [Web Parameter Tampering](https://community.owasp.org/attacks/Web_Parameter_Tampering) · OWASP Community · the attack that changes price, quantity or permissions held in hidden fields, cookies or query strings, which is the concrete case for server-side checks · fetched 2026-10-13 (*read*)
- **Our delta:** the explicit list: prices, roles, rate limits, secrets. Three searches turned up only vendor posts and training pages beyond OWASP, so no further third-party page is recommended.

### T12-14 · Yielding to the main thread — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/14-yielding-to-the-main-thread.md`
- **Read this:** [Scheduler: yield()](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield) · MDN · feature-detect before use · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) · web.dev · splitting work, with `scheduler.yield()` and its fallbacks · [Use scheduler.yield() to break up long tasks](https://developer.chrome.com/blog/use-scheduler-yield) · Chrome for Developers · [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) · MDN · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [How to Yield to the Main Thread to Improve INP](https://www.corewebvitals.io/pagespeed/yield-to-main-thread) · CoreWebVitals.io, Arjen Karel (a web performance consultancy), last update 2026-03-04 · lists the older ways to yield with the limit of each (a `setTimeout` task goes to the back of the queue) and a `yieldToMain()` helper that falls back to `setTimeout`, which is our fallback-chain delta; the page says Safari lacks `scheduler.yield`, so check MDN for the current state · fetched 2026-10-13 (*read*)
- **Our delta:** a fallback chain for browsers without `scheduler.yield`.

### T12-15 · Cross-tab coordination — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/15-cross-tab-coordination/01-the-channels.md`
- **Read this:** [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) · MDN · locks released when a tab closes · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Cross-tab Synchronization with the Web Locks API](https://www.sitepen.com/blog/cross-tab-synchronization-with-the-web-locks-api) · SitePen, Umar Hansa, 2018-08-14 · what a lock request is, the queueing, and release on completion or when the tab closes or crashes; from the API's early days and Web Locks only, so it does not cover `BroadcastChannel` · fetched 2026-10-13 (*read*)
- **Our delta:** which of the three tools for which job. The `broadcast-channel` library on GitHub does leader election, but its page was not fetchable here.

### T12-16 · Clipboard, Web Share and File System Access — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/16-clipboard-share-files/01-the-clipboard.md`
- **Read this:** [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) · MDN · [The File System Access API: simplifying access to local files](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) · Chrome for Developers; Chromium only at the time of fetching · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Unblocking clipboard access](https://web.dev/articles/async-clipboard) · web.dev (Google) · `writeText`, `write` with `ClipboardItem`, and the permission model · fetched 2026-10-13 (*read*)
- **Our delta:** the fallback when an API is missing.

### T12-17 · Permissions, Geolocation and Notifications — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/17-permissions-geolocation-notifications/01-the-permission-model.md`
- **Read this:** [Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API) · MDN · query a state without prompting · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) · [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) · MDN · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [Web permissions best practices](https://web.dev/articles/permissions-best-practices) · web.dev (Google) · ask after a user action, in context, and keep a fallback · fetched 2026-10-13 (*read*)
- **Our delta:** handling the blocked state.

### T12-18 · Media from JavaScript — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/18-media/01-controlling-media-elements.md`
- **Read this:** [MediaDevices: getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Canvas tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial) · MDN · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [The definitive guide to getUserMedia()](https://flaviocopes.com/getusermedia/) · Flavio Copes, updated 2026-08-10 · has sections on stopping every track (clearing `srcObject` or removing the element does not release the camera) and on muting with `enabled` instead; it is the release-the-camera point of our delta · fetched 2026-10-13 (*read*)
- **Also good:** [getUserMedia sample](https://webrtc.github.io/samples/src/content/getusermedia/gum/) · WebRTC samples · a minimal working demo; its script (`js/main.js`) assigns the stream to `video.srcObject` · fetched 2026-10-13 (*read*)
- **Our delta:** stopping tracks to release the camera.

### T12-19 · Page Visibility, Wake Lock and Battery — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/19-visibility-wakelock-battery/01-the-page-lifecycle.md`
- **Read this:** [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) · MDN · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · MDN · [Stay awake with the Screen Wake Lock API](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock) · Chrome for Developers · [Battery Status API](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API) · MDN · fetched 2026-10-13 (*read*) · [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) · Chrome for Developers · fetched 2026-10-13 (*read*)
- **Beyond the docs:** [How to Detect When a Browser Tab Becomes Inactive](https://blog.openreplay.com/detect-browser-tab-inactive/) · OpenReplay blog, 2026-05-25 · a `visibilitychange` handler that stops and restarts a polling `setInterval`, and the note that browsers throttle rather than stop timers in hidden tabs; visibility only, nothing on Wake Lock or Battery · fetched 2026-10-13 (*read*)
- **Our delta:** how hidden tabs break timers and polling. Searches found only old specs and news items on the battery API, so no third-party link is given for it.

### T12-20 · Internationalisation in the browser — Know · ✅ written `docs/javascript/pages/phase-12-browser-platform/20-i18n-in-the-browser/01-locale-and-negotiation.md`
- **Read this:** [Navigator: language](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language) · MDN · [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) · MDN · covers our angle: **partial** — no negotiation algorithm · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [@fluent/langneg](https://projectfluent.org/fluent.js/modules/_fluent_langneg.html) · Project Fluent (Mozilla) · API docs for matching requested locales, such as `navigator.languages`, against the ones you ship; a library reference, not a tutorial · fetched 2026-10-13 (*read*)
- **Our delta:** a short negotiation function for requested versus available locales.

### T12-21 · `SharedArrayBuffer` and `Atomics` — When Needed · ✅ written `docs/javascript/pages/phase-12-browser-platform/21-sharedarraybuffer-and-atomics/01-cross-origin-isolation.md`
- **Read this:** [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) · MDN · needs a secure, cross-origin isolated context · covers our angle: **partial** · fetched 2026-10-13 (*read*)
- **Also good:** [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics) · MDN · [A guide to enable cross-origin isolation](https://web.dev/articles/cross-origin-isolation-guide) · web.dev · fetched 2026-10-13 (*headings only*)
- **Beyond the docs:** [Make your website cross-origin isolated using COOP and COEP](https://web.dev/articles/coop-coep) · web.dev (Google) · the two headers, what COEP blocks, and checking `crossOriginIsolated` · fetched 2026-10-13 (*read*)
- **Our delta:** the headers shipped first, and a fallback to a plain `ArrayBuffer`.
