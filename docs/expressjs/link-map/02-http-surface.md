---
title: "Link map · Express · Part 2 (phases 3–5)"
sidebar_label: "02 · Express · HTTP surface"
sidebar_position: 2
---

# Link map · Express · Part 2 (phases 3–5)

Covers every topic row of `docs/expressjs/syllabus/02-http-surface.md`: T03-01 to T03-12 phase 3 (requests and body parsing), T04-01 to T04-12 phase 4 (responses, static files, cookies out), T05-01 to T05-10 phase 5 (error handling). That is 34 rows; the syllabus Counts table says 33, so its total is off by one.
All 34 are ✅ written. *read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** expressjs.com serves the 5.x docs; the syllabus pins Express 5.2.1, while npm on 2026-10-12 shows `express` 5.3.0, `body-parser` 2.3.0, `multer` 2.4.0, `cookie-parser` 1.4.7, `compression` 1.8.2, `http-errors` 2.0.1. Pin versions in each page's `> Verified:` line. Express 5 facts read in the docs: default `query parser` is `simple` (was `extended` in 4); `req.body` is `undefined` without a parser (was `{}`); async rejections reach error middleware; the wildcard must be named (`/*splat`).
Docs pages carry no date, so only the fetch date is given. `github.com` and `npmjs.com` return 403 to our fetcher, so READMEs are cited as `raw.githubusercontent.com` copies.

---

## Phase 3 — Requests and body parsing

### T03-01 · `req` anatomy — Master · ✅ written `docs/expressjs/pages/phase-3-requests/01-req-anatomy/README.md`
- **Read this:** [Express 5.x API: Request](https://expressjs.com/en/5x/api/request/) · expressjs.com · every property and method; `req.body` is `undefined` until a parser runs, `req.cookies` needs cookie-parser, and docs warn `req.query` and `req.body` are untrusted (*read*) · covers our angle: **partial** — lists properties but not which layer of the prototype chain supplies them · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · `req.body` now `undefined`, `req.query` is a getter, `req.host` keeps the port, `req.param()` removed (*read*) · fetched 2026-10-12
- **Our delta:** the two-objects-in-one prototype story and which getters read `trust proxy`.

### T03-02 · Body parsers — Master · ✅ written `docs/expressjs/pages/phase-3-requests/02-json-and-urlencoded/README.md`
- **Read this:** [Express 5.x API: express](https://expressjs.com/en/5x/api/express/) · expressjs.com · `express.json()` and `express.urlencoded()` options with defaults: `strict` true, `type` `application/json`, `extended` false; only requests whose Content-Type matches `type` are parsed (*read*) · covers our angle: **partial** — no worked empty-body case · fetched 2026-10-12
- **Also good:** [body-parser](https://expressjs.com/en/resources/middleware/body-parser/) · expressjs.com · the module behind them, with its error table (*read*) · fetched 2026-10-12
- **Our delta:** empty or mismatched body leaves `req.body` as `undefined` in 5 (migration guide, *read*); the four gates before a byte is read.

### T03-03 · Body size limits — Master · ✅ written `docs/expressjs/pages/phase-3-requests/03-size-limits/README.md`
- **Read this:** [Express 5.x API: express](https://expressjs.com/en/5x/api/express/) · expressjs.com · `limit` default `"100kb"` (number or `bytes` string), `parameterLimit` default 1000 for urlencoded (*read*) · covers our angle: **partial** — options only, no per-route layering or DoS reasoning · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · set a request size limit and reject with 413 (*read*) · [body-parser](https://expressjs.com/en/resources/middleware/body-parser/) · expressjs.com · size error has status 413, type `entity.too.large` (*read*) · fetched 2026-10-12
- **Our delta:** per-route overrides and the proxy layer in front; a body limit does not cap header size or slow senders (not confirmed on any page read).

### T03-04 · `query parser` — `simple` vs `extended` — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/04-query-parser.md`
- **Read this:** [Express 5.x API: Application](https://expressjs.com/en/5x/api/application/) · expressjs.com · `query parser` default `"simple"` (Node `querystring`); `"extended"` uses `qs`; also `false` or a custom function (*read*) · covers our angle: **partial** — nothing on nested-key breakage or pollution · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · default changed from extended to simple (*read*) · [qs README (raw)](https://raw.githubusercontent.com/ljharb/qs/main/README.md) · github (raw) · `depth`, `parameterLimit` 1000, `arrayLimit`, `throwOnLimitExceeded` (*read* the option text) · fetched 2026-10-12
- *Checked, not chosen:* [CodeQL: type confusion through parameter tampering](https://codeql.github.com/codeql-query-help/javascript/js-type-confusion-through-parameter-tampering/) · a request value can arrive as an Array instead of a String (*read*), but it is a scanner rule, not an Express guide.
- **Our delta:** the `a[b]=1` break on upgrade and the repeated-key-becomes-array pollution angle; check the runtime type before use.

### T03-05 · Malformed JSON / bad urlencoded payloads — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/05-malformed-bodies.md`
- **Read this:** [body-parser](https://expressjs.com/en/resources/middleware/body-parser/) · expressjs.com · parse failure: status 400, type `entity.parse.failed`; too large: 413 `entity.too.large`; verify failure: 403; length mismatch case (*read*) · covers our angle: **partial** — status table only, nothing on masking the message · fetched 2026-10-12
- **Also good:** [Error Handling in Express](https://expressjs.com/en/guide/error-handling/) · expressjs.com · parser errors travel the normal error path to the handler (*read*) · [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · "generic error messages", no internals to the client (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the parse error's `body` property holds the text that failed to parse (body-parser page, *read*), so do not echo the error object to the client.

### T03-06 · `express.raw()` and `express.text()` — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/06-raw-and-text.md`
- **Read this:** [Stripe: Webhooks](https://docs.stripe.com/webhooks) · Stripe docs · "Stripe requires the raw body" and any framework manipulation breaks verification (*read*) · covers our angle: **partial** — states the rule but no Express wiring was found on the page · fetched 2026-10-12
- **Also good:** [Express 5.x API: express](https://expressjs.com/en/5x/api/express/) · expressjs.com · `express.raw()` yields a `Buffer` for matching Content-Type (*read*) · [body-parser](https://expressjs.com/en/resources/middleware/body-parser/) · expressjs.com · `verify(req, res, buf, encoding)` gets the raw bytes before parsing (*read*) · fetched 2026-10-12
- **Our delta:** mount `raw` on the webhook route before any global JSON parser; a mismatched type leaves `req.body` `undefined`.

### T03-07 · Headers and content-type discipline — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/01-req-anatomy/03-reading-headers-and-content.md`
- **Read this:** [MDN: Content-Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type) · MDN · `charset` value is case insensitive (lowercase preferred), `boundary` required for multipart (*read*) · covers our angle: **partial** — header semantics only, no Express behaviour · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · require a supported Content-Type, else 415; keep 406 for response negotiation (*read*) · [Express 5.x API: Request](https://expressjs.com/en/5x/api/request/) · expressjs.com · `req.get()` is case-insensitive, `req.is()` matches the body type (*read*) · fetched 2026-10-12
- **Our delta:** which Express parsers reject a charset, and when a mismatch yields 415 versus a silently skipped parser.

### T03-08 · Client IP and protocol — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/01-req-anatomy/02-the-twelve-getters.md`
- **Read this:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · `trust proxy` default false (IP from socket); `true` takes the left-most `X-Forwarded-For`; match the setting to your proxy setup (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: X-Forwarded-For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For) · MDN · warns of security risk from improper use (*headings only*) · [Express 5.x API: Request](https://expressjs.com/en/5x/api/request/) · expressjs.com · `req.ips` is empty unless `trust proxy` is set (*read*) · fetched 2026-10-12
- **Our delta:** pairing with `trust proxy` in Phase 9; a client can forge the header.

### T03-09 · Multipart uploads — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/07-multipart-uploads.md`
- **Read this:** [multer](https://expressjs.com/en/resources/middleware/multer/) · expressjs.com · v2.4.0, built on busboy; no `dest` means memory storage; `limits`, `fileFilter`; "Never add multer as a global middleware" (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** memory versus disk trade-offs and field limits; Multer 2.x only handles `multipart/form-data`.

### T03-10 · Upload validation — Understand · ✅ written `docs/expressjs/pages/phase-3-requests/07-multipart-uploads.md`
- **Read this:** [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) · OWASP · sections on extension and Content-Type allowlists, file signature (not alone), filename safety, storage location, size limits (*read* those sections) · covers our angle: **partial** — Java examples, no Multer wiring · fetched 2026-10-12
- **Also good:** [multer](https://expressjs.com/en/resources/middleware/multer/) · expressjs.com · `fileFilter`, `limits`, `file.mimetype` and `originalname` fields (*read*) · fetched 2026-10-12
- **Our delta:** the multer page says `file.originalname` is always client-supplied and untrusted, but says nothing similar about `mimetype` (OWASP does: the Content-Type is user-provided and trivial to spoof); the object-store boundary is ours.

### T03-11 · Reading cookies — Know · ✅ written `docs/expressjs/pages/phase-3-requests/08-cookies-and-helpers.md`
- **Read this:** [cookie-parser](https://expressjs.com/en/resources/middleware/cookie-parser/) · expressjs.com · v1.4.7; fills `req.cookies`; a secret enables signed cookies; array of secrets tried in order (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Express 5.x API: Request](https://expressjs.com/en/5x/api/request/) · expressjs.com · `req.cookies` defaults to `{}` with the middleware, signed ones go to `req.signedCookies` (*read*) · fetched 2026-10-12
- **Our delta:** the asymmetry: `res.cookie` is built in, reading is not.

### T03-12 · `req` helpers: `accepts`, `is`, `range` — Know · ✅ written `docs/expressjs/pages/phase-3-requests/08-cookies-and-helpers.md`
- **Read this:** [Express 5.x API: Request](https://expressjs.com/en/5x/api/request/) · expressjs.com · `req.accepts()` returns the best match or `false`; `req.is()` returns match, `false` or `null`; `req.range(size, options)` (*read*) · covers our angle: full for awareness · fetched 2026-10-12

---

## Phase 4 — Responses, static files, and cookies on the way out

### T04-01 · `res` methods with discipline — Master · ✅ written `docs/expressjs/pages/phase-4-responses/01-res-methods/README.md`
- **Read this:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `res.send` by body type (strings as HTML, objects and arrays as JSON, Buffers binary); `res.sendStatus` sends the status text as body (*read*) · covers our angle: **partial** — no advice on picking one terminal call · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · `res.json(obj, status)` and `res.send(status)` signatures removed; chain `res.status(n).json(obj)` (*read*) · fetched 2026-10-12
- **Our delta:** the `typeof` dispatch, which methods are terminal, and one-ending-per-path.

### T04-02 · Status and header discipline — Master · ✅ written `docs/expressjs/pages/phase-4-responses/02-status-and-headers/README.md`
- **Read this:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `res.status`, `res.set`, `res.headersSent` (*read* the method list and `res.sendStatus`) · covers our angle: **partial** — states the API, not the timing rule · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · "don't just use 200 for success or 404 for error" (*read*) · [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) · MDN · the code reference (*read* the 409 entry) · fetched 2026-10-12
- **Our delta:** why a late `res.set` fails and the two Express 5 throws; the status is the only thing intermediaries read.

### T04-03 · Response shape conventions — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/03-response-shapes.md`
- **Read this:** [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/) · Zalando · rule: always return JSON objects as top-level structures, including collections, for future extension (*read* the rule) · covers our angle: **partial** — argues for objects, not for when to skip a wrapper · fetched 2026-10-12
- **Also good:** [Where to Put Response Metadata: Envelope or HTTP Headers?](https://dev.to/tiguchi/where-to-put-response-metadata---envelope-or-http-headers-4ai9) · Thomas Werner, 15 Dec 2018 · the opposite view: metadata in headers (*read*) · fetched 2026-10-12
- **Our delta:** the envelope-versus-bare choice is our design call; no source settles it.

### T04-04 · Content negotiation — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/09-content-negotiation.md`
- **Read this:** [MDN: Content negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation) · MDN · server-driven negotiation: `Accept`, `Accept-Encoding`, `Accept-Language`, and the `Vary` header (*headings only*) · covers our angle: **partial** — protocol level, no `res.format` · fetched 2026-10-12
- **Also good:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `res.format()` negotiates on `Accept` with a default handler (*read*) · [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · 406 reserved for response negotiation (*read*) · fetched 2026-10-12
- **Our delta:** default sensibly to JSON for APIs and set `Vary`.

### T04-05 · Headers already sent — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/04-headers-already-sent.md`
- **Read this:** [Error [ERR_HTTP_HEADERS_SENT]](https://sentry.io/answers/error-err-http-headers-sent-cannot-set-headers-after-they-are-sent-to-the-client/) · Sentry Answers, updated 1 Oct 2026 · cause: setting a header after the response is sent, or two responses per request, with an Express example (*read* the opening) · covers our angle: **partial** — causes, little on error-handler and stream cases · fetched 2026-10-12
- **Also good:** [Error Handling in Express](https://expressjs.com/en/guide/error-handling/) · expressjs.com · custom handlers must delegate to the default one when `res.headersSent` is true (*read*) · fetched 2026-10-12
- **Our delta:** `return` after responding; the stream-error case.

### T04-06 · Streaming a response from a handler — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/08-streaming-and-downloads.md`
- **Read this:** [Node.js stream docs: `stream.pipeline`](https://nodejs.org/api/stream.html) · nodejs.org (v26.11.1 docs) · `pipeline()` destroys the streams on error, and `close` before `end` gives `ERR_STREAM_PREMATURE_CLOSE` (*read* those passages) · covers our angle: **partial** — Node level, no Express handler · fetched 2026-10-12
- **Also good:** [The Production Playbook for Node.js Stream Leaks](https://blog.master.dev/the-production-playbook-for-node-js-stream-leaks/) · master.dev, date not confirmed (a reader comment on the page is dated 4 June 2026) · `pipeline()` tears down an upstream cursor when the client drops (*read*) · fetched 2026-10-12
- **Our delta:** the mid-stream failure case is ours: the Express error-handling guide says to delegate to the default handler when `res.headersSent` is true (T04-05), but neither it nor the Sentry page mentions streams or `ERR_STREAM_PREMATURE_CLOSE` (not confirmed on any page read); cross-link Node streams.

### T04-07 · `res.sendFile` / `res.download` — Know · ✅ written `docs/expressjs/pages/phase-4-responses/08-streaming-and-downloads.md`
- **Read this:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `sendFile` path must be absolute unless `root` is set; with `root`, Express checks the path resolves inside it; `download` forwards options to `sendFile` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · `hidden`/`from` options gone, `dotfiles` also covers hidden directories in the path (*read*) · fetched 2026-10-12

### T04-08 · `express.static` — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/05-static-files.md`
- **Read this:** [Serving static files in Express](https://expressjs.com/en/starter/static-files/) · expressjs.com · mount path as virtual prefix, multiple directories, use an absolute path (*read*) · covers our angle: **partial** — no `fallthrough` or dotfile defaults · fetched 2026-10-12
- **Also good:** [Express 5.x API: express](https://expressjs.com/en/5x/api/express/) · expressjs.com · `dotfiles` default `"ignore"`, `fallthrough` default true, `etag` weak, `index` (*read*) · fetched 2026-10-12
- **Our delta:** the Express 5 dotfile defaults in one table.

### T04-09 · Serving a built SPA from Express — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/06-spa-fallback.md`
- **Read this:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · wildcard must be named, use `/*splat` not `/*`; `/{*splat}` also matches the root (*read*) · covers our angle: **partial** — no SPA recipe · fetched 2026-10-12
- **Also good:** [Serving static files in Express](https://expressjs.com/en/starter/static-files/) · expressjs.com · the `express.static` half (*read*) · fetched 2026-10-12
- **Our delta:** register the fallback after API routes so it does not take `/api`; send `index.html` with `res.sendFile` and `root`.

### T04-10 · Cache headers on static assets — Know · ✅ written `docs/expressjs/pages/phase-4-responses/05-static-files.md`
- **Read this:** [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · `Cache-Control: max-age=31536000, immutable` for versioned URLs avoids reload revalidation (*read*) · covers our angle: **partial** — no Express options · fetched 2026-10-12
- **Also good:** [serve-static](https://expressjs.com/en/resources/middleware/serve-static/) · expressjs.com · `maxAge`, `immutable` (needs `maxAge`), `etag`, `cacheControl` (*read*) · fetched 2026-10-12

### T04-11 · Setting cookies on the response — Understand · ✅ written `docs/expressjs/pages/phase-4-responses/07-cookies-out.md`
- **Read this:** [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies) · MDN · `Secure`, `HttpOnly`, `SameSite`, cookie prefixes (*read* the security opening) · covers our angle: **partial** — no Express API · fetched 2026-10-12
- **Also good:** [Express 5.x API: Response](https://expressjs.com/en/5x/api/response/) · expressjs.com · `res.cookie` options; `res.clearCookie` options must match the original (*read*) · [Production Best Practices: Security](https://expressjs.com/en/advanced/best-practice-security/) · expressjs.com · cookie security options: `secure`, `httpOnly`, `domain`, `path` (*read*) · fetched 2026-10-12
- **Our delta:** Express 5 `clearCookie` ignores `maxAge`/`expires` (migration guide, *read*).

### T04-12 · Compression middleware — Know · ✅ written `docs/expressjs/pages/phase-4-responses/08-streaming-and-downloads.md`
- **Read this:** [Production best practices: performance](https://expressjs.com/en/advanced/best-practice-performance/) · expressjs.com · use `compression`, but on a busy site do it at the reverse proxy instead (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [compression](https://expressjs.com/en/resources/middleware/compression/) · expressjs.com · `threshold` default 1kb, `filter(req, res)` (*read*) · fetched 2026-10-12

---

## Phase 5 — Error handling and propagation

### T05-01 · Four-argument error middleware — Master · ✅ written `docs/expressjs/pages/phase-5-errors/01-error-middleware/README.md`
- **Read this:** [Error Handling in Express](https://expressjs.com/en/guide/error-handling/) · expressjs.com · four-argument signature, default handler added at the end, stack hidden when `NODE_ENV` is `production` (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** arity is the whole detection mechanism; register last.

### T05-02 · Express 5 async errors — Master · ✅ written `docs/expressjs/pages/phase-5-errors/02-async-errors/README.md`
- **Read this:** [Error Handling in Express](https://expressjs.com/en/guide/error-handling/) · expressjs.com · handlers returning a Promise call `next(value)` on reject; callback APIs still need `next(err)` by hand (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Moving to Express 5](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · "Rejected promises handled" section (*read*) · fetched 2026-10-12
- **Our delta:** the shapes that escape: callbacks, events, detached promises.

### T05-03 · Error response contract — Master · ✅ written `docs/expressjs/pages/phase-5-errors/03-error-contract/README.md`
- **Read this:** [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) · IETF, July 2023 · standard error body: members `type`, `status`, `title`, `detail`, `instance`, plus extension members (*headings only*) · covers our angle: **partial** — our `code`/`message`/`details` is a house design · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · generic messages, no call stacks to the client (*read*) · fetched 2026-10-12
- **Our delta:** Express has no opinion on body shape; say which fields we use and why.

### T05-04 · Mapping operational failures to HTTP — Understand · ✅ written `docs/expressjs/pages/phase-5-errors/04-mapping-to-http.md`
- **Read this:** [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) · MDN · reference for 400 to 503 (*read* the 409 entry; *headings only* elsewhere) · covers our angle: **partial** — meanings, not which to pick · fetched 2026-10-12
- **Also good:** [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) · OWASP · "HTTP Return Code" table of security-relevant codes (*read*) · fetched 2026-10-12

### T05-05 · A thin typed error helper — Understand · ✅ written `docs/expressjs/pages/phase-5-errors/04-mapping-to-http.md`
- **Read this:** [http-errors README (raw)](https://raw.githubusercontent.com/jshttp/http-errors/master/README.md) · github (raw) · `status`/`statusCode` default 500, `expose` defaults to false when status is 500 or above, `createError(...)` forms (*read*) · covers our angle: **partial** — a library, not the "thin helper, no tree" argument · fetched 2026-10-12
- **Our delta:** `statusCode` + `code` + `expose` is the same idea, kept as a small helper.

### T05-06 · Programmer vs operational at the HTTP edge — Understand · ✅ written `docs/expressjs/pages/phase-5-errors/05-operational-vs-programmer.md`
- **Read this:** [Node.js Error Handling Best Practices](https://sematext.com/blog/node-js-error-handling/) · Sematext, published 2 Feb 2021, modified 19 Mar 2025 · defines both kinds; user-not-found must not restart the app (*read*) · covers our angle: **partial** — Express handler shown, little on hiding versus logging · fetched 2026-10-12
- **Also good:** [Distinguish operational vs programmer errors (raw)](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/errorhandling/operationalvsprogrammererror.md) · github (raw), undated · after a programmer error, restart gracefully (*read*) · [Operational vs Programmer Errors](https://dev.to/moose978/nodejs-error-handling-operational-vs-programmer-errors-561i) · Aman Kumar Singh, 24 Jul 2026 · funnel operational errors to one handler (*read*) · fetched 2026-10-12
- **Our delta:** a Node community distinction, not an Express API; the original Joyent guide is no longer reachable (its host returned a stub page).

### T05-07 · 404 handler — Know · ✅ written `docs/expressjs/pages/phase-5-errors/06-not-found-and-process.md`
- **Read this:** [Express FAQ: How do I handle 404 responses?](https://expressjs.com/en/starter/faq/) · expressjs.com · a 404 is not an error; add a final middleware below all routes (*read*) · covers our angle: full · fetched 2026-10-12

### T05-08 · Process-level `uncaughtException` / `unhandledRejection` — Know · ✅ written `docs/expressjs/pages/phase-5-errors/06-not-found-and-process.md`
- **Read this:** [Node.js process docs](https://nodejs.org/api/process.html) · nodejs.org (v26.11.1 docs) · `uncaughtException` is "a crude mechanism" for last resort, and the process is in an undefined state (*read*) · covers our angle: full for the Node side · fetched 2026-10-12
- **Our delta:** cross-link to the Node pages only; no Express re-lesson.

### T05-09 · Error logging at the edge — Know · ✅ written `docs/expressjs/pages/phase-5-errors/07-error-logging.md`
- **Read this:** [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · OWASP · which events and attributes to log, and data to exclude or mask: source code, session identifiers, access tokens, sensitive personal data (*read*) · covers our angle: **partial** — not Express specific · fetched 2026-10-12
- **Also good:** [Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) · OWASP · return a generic response, log details server side (*read*) · fetched 2026-10-12
- **Our delta:** the method/path/status/request-id field set is ours (the syllabus row).

### T05-10 · Every error that can reach the handler — Master · ✅ written `docs/expressjs/pages/phase-5-errors/08-every-error-that-arrives/README.md`
- **Read this:** [Node.js Errors](https://nodejs.org/api/errors.html) · nodejs.org (v26.11.1 docs) · error classes, system error codes, error propagation (*headings only*) · covers our angle: **partial** — Node and network families only; no driver codes · fetched 2026-10-12
- **Also good:** [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html) · postgresql.org · SQLSTATE appendix (*headings only*) · [Error Handling in Express](https://expressjs.com/en/guide/error-handling/) · expressjs.com · the default handler's status rules (*read*) · fetched 2026-10-12
- **Our delta:** no single page catalogues the families; the Mongo driver codes were **not checked** here. The rule that the global handler formats and does not interpret is ours.
