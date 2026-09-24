---
name: devbible-expressjs-completion
description: Express completion run — live resume point, per-phase state, the measured effort estimate, and what each of the three jobs actually involves
metadata:
  type: project
---

# Express completion — live resume point (session `8679dc8c`, started 2026-08-14)

Picked up immediately after [[progress_nodejs_completeness_audit]] confirmed Node
complete. Claimed in `docs/README.md` and `docs/expressjs/pages/README.md`.
Background on how the 78 pages got here, and the quality cliff, is in
[[reference_express_verification]] — read that first, it is still accurate.

## ⛔ CORRECTION 2026-08-14 — read this before the sections below

**The user instructed mid-run: "there is no sandbox — validate against documentation and
online", and separately "do not rewrite anything already written."**

So, going forward: **no sandbox runs, no harness, no `ex*` scripts.** Every claim is
validated against the official Express/Node docs or the web, with the source named in
the `> Verified:` line. **No run means no console block.**

Two consequences for what is written below:

- The Phase 0 `> Verified:` lines cite `sandbox/express-verify` and say
  "Sandbox-measured". **They stay as they are** — the user explicitly said not to rewrite
  finished work. Do not go back and "fix" them.
- The DONE section below describes a harness re-run, and the NEXT section used to say
  "reuse `sandbox/express-verify`". **That instruction is dead.** It is left in place
  rather than rewritten, per the same instruction — but do not act on it.

**Phases 1–2 are done documentation-only.** Existing console blocks on those pages are
left untouched; the `> Verified:` line cites docs and says *no sandbox run*.

## DONE

**Phase 0 — complete, 2026-08-14.** 7 pages, all 8 syllabus topics covered (the
README's Coverage table maps topic 8 onto pages 01 · 07).

- Re-ran `sandbox/express-verify` (`extract.mjs` → `run-all.mjs`) on **express 5.2.1 /
  Node 24.19.0**. 39 blocks extracted corpus-wide, 1 threw (`phase-10/06`, a
  `createApp is not defined` fragment — a phase-10 problem, not phase 0).
- **Fixed the known `0/05` defect**: the page printed `strict routing = false` and
  `case sensitive routing = false`; both are actually **`undefined`**. Corroborated by
  the [Application settings table](https://expressjs.com/en/5x/api/application/), which
  lists both as `N/A (undefined)`. Added the *why* (Express only stores those when you
  call `app.set`; the router reads unset as off), the `=== false` branch trap as a
  gotcha, an interview question, and two table rows.
- Added `> Verified:` to all 7 pages, each naming its own evidence. Page 07 has no
  runnable claims by design — its line says so and cites the npm registry instead
  (`latest` 5.2.1, `latest-4` 4.22.2, checked 2026-08-14).
- Enriched `0/06` with the concrete Express 5 path replacements (`'*'` → `'/*splat'` or
  `'/{*splat}'`; `'/:file.:ext?'` → `'/:file{.:ext}'`; alternation → array) and the fact
  that `req.params.splat` is an **array**, from the migration guide.

**After the fix, every phase-0 console block matches a real run.**

## Phase 1 — COMPLETE 2026-08-14, documentation-only

9 of 9 topics, 7 pages, all carrying a `> Verified:` line that names Express docs and
says **no sandbox run**. Existing console blocks left untouched; none added.

Doc facts worth reusing (these are the phase-1 concept record):

- **404 not 405** — [FAQ](https://expressjs.com/en/starter/faq.html): *"404 responses are
  not the result of an error … Express has executed all middleware functions and routes,
  and found that none of them responded."* No built-in `Allow` header anywhere in the docs.
- **HEAD caveat the page missed** — `app.get()` covers HEAD *"if `app.head()` was not
  called for the path **before** `app.get()`"*. Registering `head` first silently takes
  HEAD away from the GET handler.
- **`app.all` covers `QUERY`** — the routing guide now lists QUERY among the verbs.
- ⚠️ **Express's own docs contradict each other on the query parser.** The
  [`req.query` reference](https://expressjs.com/en/5x/api/request/) still says *"by
  default uses the `qs` module"* (stale Express 4 text); the 5.x settings table and the
  migration guide say `simple`. Recorded on the page as a warning — read back
  `app.get('query parser')` rather than trusting either prose page.
- **`req.baseUrl` / `path` / `originalUrl`** — docs' worked example:
  `originalUrl '/admin/new?sort=desc'` · `baseUrl '/admin'` · `path '/new'`.
- **`mergeParams`** — parent path params are *"not accessible by default from the
  sub-routes"*.
- **`router.param` runs once** — *"a param callback will be called only once in a
  request-response cycle, even if the parameter is matched in multiple routes."*
- **Splat params are arrays** — `/files/images/image.png` → `req.params.file =
  ['images','image.png']`.
- **`mountpath` is sub-app-only** — *"contains one or more path patterns on which a
  sub-app was mounted"*, a sub-app being *"an instance of `express`"*. A `Router` has
  none. Sub-apps also fire a **`mount`** event with the parent app.

## Phase 2 — COMPLETE 2026-08-14, documentation-only

9 of 9 topics, 7 pages. Concept record:

- **The hang is documented, not folklore** — *"if a middleware function does not end the
  request-response cycle, it must call `next()` … Otherwise, the request will be left
  hanging"* ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
- **Error middleware is last and four-arg** — *"defined last, after other `app.use()` and
  routes calls"*; *"you must provide four arguments to identify it as an error-handling
  middleware function"* ([error handling](https://expressjs.com/en/guide/error-handling.html)).
- **`next(err)` after the response started** — *"the Express default error handler closes
  the connection and fails the request"*, hence the documented guard
  `if (res.headersSent) return next(err)`.
- **Default error handler** — status from `err.status`/`err.statusCode` (500 if outside
  4xx/5xx), `err.stack` in development, HTML page in production, headers from `err.headers`.
- **404 is not an error** — it never reaches error middleware; the 404 handler goes at the
  very bottom of the stack.
- **Built-ins are exactly six** — `json`, `urlencoded`, `raw`, `text` (all *"based on
  body-parser"*, reintroduced into core), `static` (*"based on serve-static"*), `Router`.
  Everything else is a package under Resources → Middleware.
- **Factories are Express's own convention** — the docs' "configurable middleware" is a
  module that *"exports a function which accepts an options object and returns the
  middleware implementation"*; every built-in is called for its return value.
- ⚠️ **Where the docs stop:** there is **no documented reserved-name list** for `req`/`res`.
  Page 06's Verified line says so outright and points at the request/response references
  as the de-facto list, rather than inventing a rule.

## Phase 3 — COMPLETE 2026-08-14, documentation-only

12 of 12 topics, 8 pages. Concept record:

- **Body-parser defaults (all four)** — `limit` **`"100kb"`**, `inflate` `true`.
  `json`: `type` `"application/json"`, `strict` **`true`**. `urlencoded`: `type`
  `"application/x-www-form-urlencoded"`, `extended` **`false`** (Express 5 change).
  `raw`: `type` **`"application/octet-stream"`**. `text`: `type` `"text/plain"`.
- **The content-type gate, quoted** — body is populated *"or `undefined` if there was no
  body to parse, the `Content-Type` was not matched, or an error occurred."* Wrong type
  is not an error; it is an absent body.
- **Webhook trap worth keeping** — `express.raw` defaults to `application/octet-stream`,
  so a provider posting `application/json` never reaches it unless you widen `type`.
- **`req.ip`** — *"derived from the left-most entry in the `X-Forwarded-For` header"*
  whenever `trust proxy` does not evaluate to false; `req.ips` is `[]` otherwise. This is
  the same mechanism as the phase-9 rate-limit bypass still unwritten.
- **`req.cookies` / `req.signedCookies`** need cookie-parser; `res.cookie` is built in.
  That asymmetry is documented on both sides.
- **Multer** — `latest` **2.2.0** (registry, 2026-08-14), `next` is a 3.0 alpha.
  `limits.fileSize` **defaults to `Infinity`**. Its README warns memory storage can
  *"run out of memory"* and to *"never add multer as a global middleware."*
- ⚠️ **Where the docs stop:** Multer's README has **no** warning about sanitising
  `originalname` or distrusting `mimetype` — page 07 now says those are this bible's
  advice, not upstream guidance.

**The two `body: undefined` console blocks (pages 01, 02) are confirmed wrong and were
left in place, each flagged in its Verified line.** `JSON.stringify` omits undefined
object properties (MDN), so the key is absent. Not rewritten — inventing replacement
output is worse than a flagged error. **If a run is ever authorised again, fix these two
first.**

## Phase 4 — COMPLETE 2026-08-14, and it was NOT just a verification pass

12 of 12 topics, **9 pages — one of them new**. This is where the quality cliff starts.

- 🔴 **Content negotiation had no page at all.** The syllabus lists it as topic 4;
  nothing in the phase covered `res.format`, `req.accepts` or `Vary`. Written as
  **`09-content-negotiation.md`** (numbered last to avoid renumbering existing links;
  the README's new Coverage table says to read it after 03).
  **The phase README had no Coverage table, which is why nobody caught it.** Check every
  remaining phase for a Coverage table before assuming its topics are covered.
- **Pages 04, 07, 08 had no Gotchas and no Trade-off**; 05 and 06 had no Trade-off.
  All written. Page 08 went 38 → ~200 lines (it carries three syllabus topics:
  streaming, sendFile/download, compression).

Concept record:

- **`res.format`** — *"performs content-negotiation on the `Accept` HTTP header"*,
  ordered by quality values; no match ⇒ **406**, unless `default` is given, which takes
  over that case entirely. `*/*` matches the **first** key in the object.
- **`Vary`** — the line everyone forgets. Negotiated responses cached without
  `Vary: Accept` get served to the wrong client. `res.vary(field)` adds it.
- **`express.static` defaults** — `index` `"index.html"`, `dotfiles` **`"ignore"`**,
  `fallthrough` **`true`**, `etag` `true`, `lastModified` `true`, `maxAge` **`0`**,
  `immutable` `false`, `redirect` `true`. **`maxAge: 0` is why "caching is on" still
  costs a revalidation round trip**, and **`fallthrough: true`** is what makes the SPA
  history fallback work — a miss calls `next()` rather than 404ing.
- **`res.sendFile` `root`** — the documented traversal guard: with `root` set Express
  verifies the resolved path stays inside it. Without `root` the path must be absolute
  and containment is entirely yours. Treat "no `root`" as a smell when the path comes
  from the request.
- **`res.download` option defaults** — `dotfiles` `"ignore"`, `maxAge` `0`,
  `lastModified` `true`, `acceptRanges` `true`, `cacheControl` `true`, `immutable` `false`.
- **`res.cookie`** — `path` defaults to `"/"`; `expires` unset or `0` ⇒ session cookie;
  **`maxAge` is milliseconds** (the wire attribute is seconds — Express converts);
  `signed: true` needs cookie-parser. `clearCookie` must repeat `path`/`domain` or it
  clears nothing.
- **Express 5 restricts `res.status()` to 100–999** and rejects anything else.
- **`req.params.splat` is an array** — Express 4 code reading `req.params[0]` as a string
  silently gets `"a,b"` instead of `"a/b"`.

## Phase 5 — COMPLETE 2026-08-14. Second missing topic found.

9 of 9 topics, **7 pages — one new**. A top-up, like phase 4 but thinner to start:
the six pages had **one Gotchas section and zero Trade-offs between them**.

- 🔴 **`Error logging at the edge` (syllabus topic 9) had no page.** Written as
  **`07-error-logging.md`**. **Same gap, same cause as phase 4's content negotiation:
  the phase README had no Coverage table.** Both now have one. **Assume every remaining
  phase (6–10) is hiding a topic until you have checked its Coverage table.**
- Every page got a Verified line, a Trade-off, Gotchas and a full interview set.

Concept record:

- **Arity is the entire detection mechanism** — `fn.length === 4`. Docs: *"you must
  provide four arguments … Even if you don't need to use the `next` object, you must
  specify it to maintain the signature."* **Consequence worth keeping: default params
  and rest args change `length`** — `(err, req, res, next = null)` is length 3 and
  silently registers as ordinary middleware. `(...args)` is length 0.
- **Multiple error handlers chain** via `next(err)` — the clean way to split a logging
  handler from a responding one.
- **What Express 5 does NOT catch** — only what it awaited. Not: a `throw` in an
  error-first callback, a **floating promise** (the one that bites, because the request
  succeeds), a `setTimeout` callback, an event-emitter handler. Docs are explicit that
  callback APIs still need manual `next(err)`.
- **404 is not an error** — three-arg middleware, below routes, above the error handler.
  A four-arg version is unreachable.
- **`err.headers` is copied onto the response** by the default handler — so
  `503` + `Retry-After` can travel together on the error object.
- **Express 5 restricts `res.status()` to 100–999**; a mapping table emitting a made-up
  code now throws.
- **404-vs-403 is a security decision** — 403 confirms a resource exists. Cross-tenant
  access should answer 404.
- ⚠️ **Where the docs stop, all three now stated on-page:** the operational/programmer
  split is a **Node community distinction, not an Express API**; the error **envelope is
  this bible's design** (Express has no opinion on body shape); the
  **what-never-to-log list is security reasoning**, not upstream guidance.
- **`req.originalUrl`, not `req.path`, in logs** — inside a mounted router `path` has the
  prefix stripped, so errors log as `/42` or `/`.
- **`Error` properties are non-enumerable**, so a naive serialiser logs `{}`. Needs a
  logger with an error serialiser — not `console.log(err.message)`, which discards the
  stack and the `cause` chain.

## Phase 6 — COMPLETE 2026-08-14. THIRD and FOURTH missing topics.

14 of 14 topics, **11 pages — two new**. First genuinely *outline* phase: 9 pages
averaging 36 lines, **4 Gotchas and 1 Trade-off between all nine**.

- 🔴 **Two topics had no page**: **bulk endpoints / PATCH semantics** (now
  `10-patch-and-bulk.md`) and **HATEOAS / hypermedia** (now `11-hypermedia.md`).
  **Same cause again: no Coverage table in the phase README.** That is three phases in a
  row (4, 5, 6) and four missing topics found this way. **Phases 7–10 have not been
  checked yet — do that first.**
- 🔴 **Fixed-by-labelling the known `6/07` defect.** The page showed `If-Match → 412` as
  if Express did it. **Express does not evaluate `If-Match` at all** (earlier measured
  run: stale `If-Match` → **200** on PUT *and* GET). RFC 9110 puts precondition
  evaluation on the origin server. Block left in place, labelled, and the page now
  carries the handler code you actually have to write — including the two subtleties:
  **428 when the header is absent**, and **re-checking the version at the write**
  (`UPDATE … WHERE version = $expected`), because the pre-check races.

Concept record:

- **`Idempotency-Key` is NOT a standard** — IETF HTTPAPI Internet-Draft
  `draft-ietf-httpapi-idempotency-key-header-07`, published 2025-10-15, Standards Track,
  expires 2026-04-18. Checked 2026-08-14. Cite as convention, not RFC.
- **The idempotency race** — check-then-insert is broken; retries arrive *concurrently*
  because that is what a timeout means. Claim the key with a **unique constraint first**,
  conflict ⇒ duplicate; `in_progress` ⇒ **409**, never block, never execute. Store key +
  side effect in **one transaction**. Scope on `(client, key)` — client-generated UUIDs
  are not a global namespace.
- **RFC 9110** — GET/HEAD/PUT/DELETE idempotent, POST not; 412 on failed `If-Match`;
  **304 MUST NOT contain a body**; 204 carries no body.
  **Weak validators cannot be used for `If-Match`** (strong comparison required) — and
  Express's `etag` default is **weak**, so writable resources need your own validator.
- **Patch formats are standardised, two of them** — **JSON Merge Patch** RFC 7386
  (`application/merge-patch+json`; **`null` means delete**, so it cannot set null, and
  arrays are replaced wholesale) and **JSON Patch** RFC 6902
  (`application/json-patch+json`; addresses array positions, has a `test` op that is a
  lightweight `If-Match`).
- **Bulk has no honest status code** — `207 Multi-Status` (RFC 4918, from WebDAV) or a
  documented 200 with per-item statuses. Cap batch size like `limit`.
- **`Sunset` is real** — RFC 8594. Deprecation flow: instrument per-version first, then
  announce, `Deprecation`/`Sunset` headers, brown-out, then **410 Gone** (not 404).
- **The shape attack** — Express's own docs warn `req.query`'s **shape** is
  user-controlled. `?email[$ne]=x` and `?role=a&role=b` (array!) both bypass value-only
  validation. `simple` parser defuses brackets but **not** repeated keys, and not if
  someone switches to `extended`. Check `typeof value === 'string'`.
- **Offset pagination is *incorrect*, not just slow** — an insert before your position
  makes page 2 repeat one row and skip another, silently. That is the argument that wins,
  not the deep-page cost.
- **`timingSafeEqual` throws on length mismatch** (Node docs) — a short attacker
  signature becomes a **500**, and providers retry 5xx. Compare lengths first.
- **`express.raw` defaults to `application/octet-stream`** — the #1 reason webhook
  signature checks fail on first setup; providers send `application/json`.

## Phase 7 — COMPLETE 2026-08-14. Fifth missing topic.

8 of 8 topics, **7 pages — one new**. **Thinnest phase yet**: six pages of 26–33 lines
with **zero Gotchas and zero Trade-offs across all six**.

- 🔴 **Transaction-per-request middleware (topic 7) existed only as one sentence** inside
  page 06. Written as `07-transaction-middleware.md`. **No Coverage table again** — that
  is phases 4, 5, 6 and 7, five topics found this way.
- **Almost nothing in this phase is an Express feature**, and every Verified line says so.
  No controllers, services, repositories, DI container or folder opinion exists in
  Express. The only two documented mechanisms it rests on: a `Router` is a mountable
  *"mini-app"*, and a route accepts **several handler functions in sequence** (the docs'
  "middleware sub-stacks") — which is what makes
  `router.post('/x', auth, validate, handler)` plain Express rather than a library.

Concept record:

- **The test for whether layering is real** — call the service from a plain script with
  no HTTP. If it needs `req`, the layers are folder names. Mirror test: swap the database
  without touching the service.
- **Three shapes, not two** — DTO (changes when the public API changes), domain object
  (when rules change), persistence row (when the schema changes). They look identical
  early, which is why people collapse them.
- **The dangerous leak is persistence *upward***, not transport downward. `res.json(row)`
  works perfectly until a row gains `password_hash`. Defence: **assert on exact response
  keys** in tests.
- **The authorisation check middleware physically cannot do** is ownership — "does this
  caller own *this* record?" — because the record is not loaded yet. It belongs in the
  service. Highest-consequence bug in most APIs.
- **Singleton-import DI fails at import time**: a module-level `createPool()` connects on
  import, so unrelated unit tests open real connections and **the suite hangs after
  passing**. Also inject clock, uuid, logger, config — the usual causes of flaky tests.
- **Transaction middleware, three things wrong with the common version**, all now on the
  page: deciding commit on `res.statusCode` couples data integrity to HTTP mapping;
  committing in `res.on('finish')` means a commit failure **cannot be reported** (headers
  already sent) and its rejection is unhandled; and one transaction per request holds a
  connection across slow external calls, exhausting the pool. **The service should own
  the boundary.** The middleware is right for retrofits and for request-scoped state
  (`SET LOCAL` tenant id, RLS).
- **202 per RFC 9110** — accepted, processing not complete, *"intentionally noncommittal"*.
  Enqueue **after** commit; payload carries an **id, not a snapshot**; the remaining gap
  (commit succeeds, enqueue fails) needs the outbox — Node Phase 7.

## Phase 8 — COMPLETE 2026-08-14 (13/13). SIXTH missing topic.

Thinnest and highest-consequence phase: 8 pages of 21–39 lines, **0 Gotchas and
0 Trade-offs across all eight**. No Coverage table (again). **Topic 5, type inference
from schemas, has no coverage at all** — sixth missing topic; page 05 to be written.

All nine pages written: 01 boundary, 02 factory, 03 coercion, 04 authn,
05 cookies/sessions, 06 RBAC, 07 ownership, 08 tenant/logout, **09 type-inference (NEW)**.

**The new page was APPENDED as 09**, keeping 06/07/08 where they were — renumbering
breaks inbound links. (One slip caught mid-write: page 04's cross-links were authored
against a renumbered layout and corrected.)

Additional concepts from 08 and 09:

- **Tenant scope comes from identity, never input.** Stronger than a check: **keep the
  field out of the validation schema** so it cannot arrive at all, and put the tenant id
  in the repository signature (or RLS scoped per transaction) so the query cannot run
  without it.
- **`res.clearCookie` must repeat `path`/`domain`** or it clears a different cookie —
  the mechanical half of "logout didn't work". The structural half: **a stateless token
  cannot be revoked, only refused**; every revocation mechanism reintroduces the lookup
  the token was chosen to avoid.
- **Optional-auth's dangerous line**: absent token ⇒ anonymous, **present-but-invalid ⇒
  401**. Falling through turns a forged token into an unauthenticated request some
  downstream route may trust.
- **`z.infer` erases refinements** — `z.number().int().positive()` infers as `number`.
  The runtime guarantee is always stronger than the type; the type's value is *drift
  removal*, not enforcement.
- **Declaring `req.user` non-optional is a type that lies** — `req.user.id` then compiles
  on a public route and throws. Declare optional, narrow in handlers.
- **Express 5 rules out the Express 4 typing trick**: `req.query` is a getter, so the
  parsed value cannot be assigned back to it regardless of types.

Concept record so far:

- **Parse, don't validate** — the parse output is a *new object containing only what the
  schema described*. That single property kills **mass assignment**
  (`{"role":"admin"}` survives a validate-and-pass-through, not a parse), prototype
  pollution, and unbounded fields. **The most common mistake in Express codebases is
  calling `schema.parse(req.body)` and then passing `req.body` onward anyway.**
- **Express 5 breaks the common Express 4 validation pattern** — quoted from the
  migration guide: *"the `req.query` property is no longer a writable property and is
  instead a getter."* Assigning the parsed value back to `req.query` throws. Use
  `req.validated`.
- **`req.body` is `undefined` when unparsed** in Express 5 (Express 4 gave `{}`).
- **`req.params` has a NULL PROTOTYPE** for string paths — `req.params.hasOwnProperty(...)`
  is a TypeError; use `Object.hasOwn`. Wildcard params are **arrays**; unmatched params
  are **omitted entirely**, not `undefined`.
- **Every query value is `string | string[]`** — a repeated key becomes an array on the
  default `simple` parser with no bracket syntax. `req.query.role.toLowerCase()` throws.
- **`z.coerce.number()` accepts `''` as `0`** (`Number('')` is 0), so `?limit=` becomes a
  limit of zero. Always `.min(1)`. And `NaN` is falsy, so `Number(x) || 20` hides garbage.
- **`safeParse` over `parse`** in the factory, so all three sections' issues are collected
  and returned once — otherwise users fix one field per round trip.
- **Order: authn → authz → validate.** Do not describe your schema to anonymous callers.
  Webhooks are the documented exception — signature verification needs the raw body first.
- **Three distinct questions, three layers** — *who is this?* (authn → `req.user` or 401),
  *what may this role do?* (RBAC → 403), *may they touch **this row**?* (ownership → the
  service). Collapsing any two is where the bugs are.
- 🔴 **The highest-consequence gap in most APIs: RBAC present, ownership absent** (IDOR /
  broken object-level authorization, OWASP API #1). Every line looks right — valid token,
  correct permission, ordinary fetch — and **tests never exercise another user's id**.
  The fix that removes the class rather than the instance: **scope the query**
  (`findOwned(id, actorId)`) instead of comparing after the load, so the unauthorised row
  never enters the process and list endpoints inherit the same defence.
- **Check permissions, not role names** — `requirePermission('orders:delete')` with one
  role→permission map. Role-name checks mean every capability change is a search across
  routes. Retrofitting this is an audit of every route; do it on day one.
- **401 vs 403 is behavioural, not cosmetic** — 401 tells a client to re-authenticate and
  retry, so using it for an authorisation failure produces a retry loop that cannot succeed.
- **Fail closed**: unknown role ⇒ empty permission list; missing `req.user` ⇒ 401, not a
  crash on `undefined.role`; authn mounted **opt-in per route** (greppable) rather than
  opt-out (a route added above the `app.use` is silently public).
- **Auth failures must be indistinguishable** — expired and invalid tokens get the same
  code and message, or an attacker learns their token was once real.
- **Cookie asymmetry is documented** — `res.cookie` is built in; `req.cookies` /
  `req.signedCookies` exist **only** with cookie-parser. `signed` proves **origin, not
  secrecy** — the value is still readable.
- **`secure: true` + TLS at a proxy + no `trust proxy` = no cookie in production**, works
  locally. Most common "cookie disappeared" cause.
- **Regenerate the session id at login** — session fixation, one line, invisible in testing.

## Phase 9 — COMPLETE 2026-08-14 (9/9). Seventh missing topic, merged.

6 pages of 21–32 lines, **0 Gotchas / 0 Trade-offs across all six**. No Coverage table.
All six pages written, Coverage table added.

**Seventh missing topic — handled by merge, not a new page.** Syllabus topic 7,
"security headers beyond defaults (COOP/COEP, API-only apps skipping noisy headers)",
had no coverage. It belongs with Helmet, so **page 03 now covers it** and the Coverage
table will record the merge (same pattern phases 0–3 use legitimately).

**The long-outstanding gap is now written**: the `trust proxy` → rate-limit bypass link
that no page connected. It is on [01] and [04], both directions.

Concept record:

- 🔴 **`trust proxy: true` makes `req.ip` client-controlled.** `X-Forwarded-For` is an
  ordinary request header; `true` makes Express believe its **left-most** entry. The docs
  attach the condition: safe only if *"the last trusted reverse proxy removes/overwrites"*
  those headers. **Rate limiting, brute-force protection and IP allow-lists all collapse**
  — and the limiter *appears* to work, counting fabricated addresses.
- **Two mirror failures for a limiter**: trust **off** behind a proxy ⇒ everyone shares
  one bucket (one client locks out all); trust **`true`** unsanitised ⇒ no limit at all.
  **Verify the key with a forged header**, not the configuration.
- **`trust proxy` values** — number = hops **counted right to left** (socket address is
  hop 1); named subnets `loopback` / `linklocal` / `uniquelocal`; a list of addresses; or
  a `(ip) => boolean` function. Prefer hop count or subnet list; they degrade safely.
- **It changes more than `req.ip`** — `req.secure`, `req.protocol`, `req.hostname`,
  `req.ips` (documented as `[]` when trust is off). `req.secure` false behind TLS
  termination is why **`secure` cookies silently never reach the browser**.
- **CORS is not access control.** Browser-enforced; curl/Postman/mobile ignore it. It
  protects *users* from other origins reading responses with ambient credentials.
- **Origin reflection with credentials is the CORS vulnerability** — it defeats the
  no-`*`-with-credentials rule by naming the attacker's origin. And
  **`endsWith('example.com')` matches `evil-example.com`** — compare whole strings.
- **Preflight lands on Express as `OPTIONS`** — mount CORS **before authn** (a preflight
  carries no credentials, so auth answers 401 and the browser reports "CORS"), and an
  unhandled `OPTIONS` becomes your 404.
- **Login limits key on IP *and* username** — IP alone misses distributed stuffing,
  username alone is an account-lockout DoS. Username-level ⇒ step-up, not hard block.
- **Memory store counts per process** — 4 instances × `max:100` = 400, and every deploy
  resets counters.
- **COOP/COEP** = cross-origin isolation (the `SharedArrayBuffer` / high-res timer gate,
  post-Spectre). A JSON API needs neither; **COEP is disruptive** — every third-party
  subresource must opt in.
- **CSRF decision is mechanical**: does the browser attach the credential automatically?
  Cookie ⇒ yes ⇒ CSRF applies. `Authorization` header ⇒ no. **A JWT in a cookie is a
  cookie** — "we use JWTs" is not an answer unless you say where it lives.
- **`SameSite=Lax` covers most of it but not all** — top-level **GET** is still permitted
  (second reason GET must never mutate), `None` turns it off where you needed it, and
  **same-site ≠ same-origin**, so a sibling subdomain sidesteps it. `csurf` is **archived**;
  use double-submit + an `Origin` check on unsafe methods.
- **`startsWith('/')` does not stop an open redirect** — `//evil.example` is
  protocol-relative. **Map a key to a known path**; URL validation is a normalisation arms
  race. Express's own `res.redirect` docs link to its open-redirect guidance.
- **A timeout middleware stops the waiting, not the work.** Nothing in Express or Node
  cancels a running handler — no thread to kill, no cancellation of an in-flight `await`.
  The query keeps its pooled connection. **Real cancellation is at the resource**
  (statement timeout, `AbortSignal`). Order timeouts **inside-out**: dependency < app <
  proxy < client.
- **Never default a secret** — `process.env.SECRET ?? 'dev-secret'` ships a known signing
  key and **nothing fails**, which is the problem. One config module parsed at import, so
  a missing value fails the boot, not the first login.

## Phase 10 — COMPLETE 2026-08-14 (11/11). EIGHTH + NINTH missing topics.

# ✅ EXPRESS IS COMPLETE — 114/114 topics, 85 pages.

## 🔴 A defect this run introduced, and the check that catches it

Appending Gotchas / Trade-off / Interview sections to a page that **already had one**
produced **duplicate `##` headings on 9 pages** — my new section landed above the
original stub, leaving an orphan below. The build does not complain; only a reader
would notice.

Also produced **one genuinely broken link**: page `8/01` pointed at
`05-type-inference.md` after the new page was appended as **09** instead.

**Both are now fixed.** The scan that finds them, worth running after any top-up pass:

```bash
for f in $(find docs/<lang>/pages -name '*.md'); do
  for h in '^## Interview questions' '^## Gotchas' '^## Trade-off'; do
    n=$(grep -c "$h" $f); [ "$n" -gt 1 ] && echo "DUP $h $f"
  done
done
```

**Lesson for the Redis track and any future top-up:** when adding a section that may
already exist, **replace the existing heading's block** rather than appending a new
one — and grep for duplicates before declaring a phase done.

6 pages of 25–32 lines, **0 Gotchas / 0 Trade-offs**, no Coverage table.
All seven pages written; `07-flags-and-serverless.md` is the new one, appended.

**Eighth and ninth missing topics**: *feature flags / route toggles at mount time* and
*exporting the app for serverless adapters* — both **When Needed** tier, both currently
one dismissive sentence at the bottom of page 06. Writing them as a single appended
page 07 (they are both mount-time composition concerns).

Concept record:

- **Factory purity is the rule**: no `listen`, no connecting, no `process.env`, no
  `process.on`. Each breaks something specific — port conflicts in parallel tests, a
  socket opened by an *import*, an unconfigurable instance, and **`MaxListenersExceeded`
  when a suite builds a hundred apps**.
- **Why an app works without `listen`**: an Express app *is* a request listener;
  `app.listen()` is documented as a convenience for `http.createServer(app).listen()`.
  That is what Supertest and serverless adapters use — and why the factory must not bind.
- **The factory is where mount order becomes readable** — settings first (`trust proxy`
  before anything reads `req.ip`), request-id first among middleware, CORS before authn,
  health above the rate limiter, 404 then error handler. Ordering bugs are invisible when
  the sequence is assembled across six files.
- **Inbound `X-Request-Id` is untrusted input** — bound length and alphabet or you get
  log injection (newlines) and 10 MB log lines. `X-Request-Id` is a **convention**;
  **`traceparent` (W3C Trace Context)** is the standard OpenTelemetry propagates.
- **`AsyncLocalStorage`: observability only.** Request id and logger, yes. Current
  user/tenant, no — that makes authorisation invisible and untestable.
- **Mocking Express means testing nothing.** Calling a handler directly skips routing,
  body parsing, validation, authn, the 404 and the error handler — every layer where this
  bible's bugs live.
- **Assert the exact response key set**, not individual fields — the only test that
  catches the persistence leak (`password_hash` riding along).
- **Stubbing auth middleware in tests is the equivalent mistake**: a route that forgot
  `requireAuth` then passes identically. Mint a real token; test the **deny** paths
  (401 no token / expired / forged, 403 wrong role, **404 another user's record** — the
  only automated defence against IDOR).
- 🔴 **A liveness probe that checks the database is a restart-storm generator** — the DB
  blips, liveness fails on every instance at once, the orchestrator kills them all, they
  restart into the same struggling DB. Liveness checks **nothing**; dependencies go in
  readiness. Both probes must sit **above** the rate limiter.
- 🔴 **Graceful shutdown without a drain delay still produces 502s.** The load balancer
  polls; between your last good probe and its next poll it is still routing to you.
  Sequence: **fail readiness → wait longer than the probe interval → `server.close()` →
  close pools inside its callback → hard `setTimeout(...).unref()` deadline.**
- **`server.close()`'s callback fires only when ALL connections have ended** — idle
  keep-alives can stall it. `server.closeIdleConnections()` (Node ≥ 18.2) is the fix.
- **`app.close` does not exist.** `app.listen()` returns the `http.Server`; only it closes.
- **Listening ≠ ready.** Keep a `ready` flag flipped after warm-up.
- **The one fact the whole phase rests on**: an Express app **is a request listener**;
  `app.listen()` is documented as a convenience for `http.createServer(app).listen()`.
  That is why the factory must not listen, why Supertest works, why serverless adapters
  work, and why `close` belongs to the server.
- **Serverless breaks four of this phase's assumptions** — no graceful shutdown, no shared
  in-memory state (rate limits!), cold starts re-paying module scope, and **pools across
  many short-lived instances exhausting the DB connection limit**. Express solves none of
  them.

## UI semantics changed 2026-08-14 — do not revert

`progress.js` Express rows now count **topics brought to standard**, not files on disk.
Phases 2–10 are set to `pages: 0` even though outline files exist, because counting
outlines as finished is what made Express read **100% while the claims table called it a
draft**. A comment in `progress.js` says the same thing. Phase 0 = 8/8, Phase 1 = 9/9.

## NEXT — resume here

~~Phases 0–7~~ — **all done. Resume at Phase 8 · Validation and authorization.**

**Position: 81 of 114 topics done, 33 left.** Phases 8, 9 and 10 remain.

🔴 **FIRST ACTION on each remaining phase: check whether its README has a Coverage
table.** Phases 4, 5 and 6 each hid missing topics behind a README that had none —
**four topics found that way so far**. Count the syllabus rows, map them to pages, and
write the table before writing anything else.

**Phase 8 · Validation & authz** — 8 pages / 13 topics, median 25 lines, **0 gotchas**.
The thinnest in the corpus and the highest-consequence (ownership checks, multi-tenant
isolation). The earlier review recommended doing this one first of the outline block.
**Phase 9 · Hardening** — 6 pages / 9 topics, median 29, 0 gotchas. Carries the unwritten
**`trust proxy: true` → client-controlled `req.ip` → rate-limit bypass** link.
**Phase 10 · App factory** — 6 pages / 11 topics, median 30, 0 gotchas. Also holds the one
extraction failure from the old harness (`10/06`, a `createApp is not defined` fragment).

## Per-phase state, measured 2026-08-14

Baseline measured before work started; the Job column now records what was actually done.

| Phase | Pages | Topics | Median lines | Gotchas | Job |
|---|---|---|---|---|---|
| 0 · basics | 7 | 8 | 130 | 7/7 | ✅ **DONE 8/8** |
| 1 · routing | 7 | 9 | 109 | 7/7 | ✅ **DONE 9/9** |
| 2 · middleware | 7 | 9 | 91 | 7/7 | ✅ **DONE 9/9** |
| 3 · requests | 8 | 12 | 82 | 8/8 | ✅ **DONE 12/12** (the two bad blocks flagged, not fixed) |
| 4 · responses | 8→**9** | 12 | 57 | 5/8 | ✅ **DONE 12/12** — wrote the missing topic + 3 gotcha sets + 4 trade-offs |
| 5 · errors | 6 | 9 | 45 | 1/6 | 👈 **NEXT — top up** |
| 6 · REST surface | 9 | 14 | 36 | 4/9 | **write** |
| 7 · layering | 6 | 8 | 30 | 0/6 | **write** |
| 8 · validation/authz | 8 | 13 | 25 | 0/8 | **write** (do first of the three) |
| 9 · hardening | 6 | 9 | 29 | 0/6 | **write** |
| 10 · app factory | 6 | 11 | 30 | 0/6 | **write** |

**114 topics, 78 pages, 36-row gap.** Some of that gap is legitimate merging — phase 0
proves it, with 8 topics on 7 pages and a Coverage table saying so. **Each phase needs
its Coverage table checked before assuming a page is missing**; that is the same trap
Node had.

## Known unfixed defects (from the earlier verification run)

- `3/01` and `3/02`: shown output has `body: undefined`; the key is actually **absent**,
  because `res.json` drops undefined values.
  **Status 2026-08-14: confirmed against MDN and flagged in each page's `> Verified:`
  line, deliberately NOT rewritten** — with runs forbidden, inventing replacement output
  would be worse than a documented error. Fix these two first if a run is ever authorised.
- `6/07-etag-and-cache`: shows `If-Match → 412` as if Express does it — **it does not**;
  stale `If-Match` returned 200 on both PUT and GET.
- No page connects `trust proxy: true` → client-controlled `req.ip` (leftmost XFF) →
  rate-limit bypass. That belongs in phase 9.
- **Trap:** you cannot verify a 304 with `fetch` (returns 200 + body); use `node:http`.

## Effort estimate — original, and what actually happened

**Given to the user 2026-08-14:** roughly **16–22 hours**, in three unequal jobs —
verify 1–3 (~2h), top up 4–5 (~2–3h), write 6–10 (~12–17h, the bulk).

**Actual so far:** phases 0–4 (50 topics) took roughly **2 hours**, so the verification
half ran ahead of estimate. **The estimate for phases 6–10 still stands and is the whole
remaining cost** — 55 of the 64 remaining topics are in genuinely thin pages. Phase 4 is
the honest data point for what "top up" costs: 12 topics, one page written from nothing,
three gotcha sets, four trade-off sections, ~45 minutes.

Revised remaining: **~12–16 hours**, dominated by phases 6–10.

## Rules that bind this work

- **NO SANDBOX AT ALL** — the user overrode the earlier "reuse the harness" plan
  mid-session. Documentation and the web only, source named in the `> Verified:` line,
  and **no console block unless a run produced it**. [[feedback_no_new_sandbox_scripts]]
- **Do not rewrite anything already written** — user instruction, same session. Additive
  work only: a page missing Gotchas gets Gotchas; a page with finished prose keeps it.
- **Update the UI after EVERY topic**, memory every 3 — `progress.js`, the phase README,
  `docs/<lang>/pages/README.md`, and both `docs/README.md` rows.
  [[feedback_ui_progress_and_build_cadence]]
- **Only grep the build log for your own language.** Other sessions' warnings are theirs;
  the user said not to spend time on them. Express has had **0 warnings** every build.
- 300-line cap is not a content budget ([[feedback_never_compress_to_fit_cap]]); shared
  checkout, never `git add -A` ([[feedback_parallel_sessions]]).
