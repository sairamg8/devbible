---
title: "Link map · Express · Part 3 (phases 6–7)"
sidebar_label: "03 · Express · API product"
sidebar_position: 3
---

# Link map · Express · Part 3 — API product (phases 6–7)

Covers all 22 topic rows of `docs/expressjs/syllabus/03-api-product.md`: T06-01 to T06-14 (REST surface and HTTP API features), T07-01 to T07-08 (layering at the Express edge). **All 22 have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. No `#anchors` are given. Third-party links carry a date where the page shows one.

🔴 **Version note.** Express 5.x per our README (npm `latest` was 5.3.0 on 2026-10-12, see the Part 1 map). Almost every source here is protocol or design material and is not tied to an Express version. The Express-specific facts used (read on the 5.x API pages): the `etag` app setting defaults to weak, `express.json()` and friends take a `verify(req, res, buf, encoding)` hook that sees the raw Buffer, and `res.links()` fills the `Link` header. OpenAPI Specification latest is **3.2.1** (the spec page title on 2026-10-12). expressjs.com pages show no date. `github.com` returns 403 to our fetcher, so GitHub files are cited as `raw.githubusercontent.com` copies.

---

## Phase 6 — REST surface and HTTP API features

### T06-01 · REST resource modeling — Master · ✅ written `docs/expressjs/pages/phase-6-rest-surface/01-rest-resources/`
- **Read this:** [Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · learn.microsoft.com · nouns not verbs, plural collection URIs, `/customers` and `/customers/5` hierarchy, and a section on keeping relationships simple (*read*; about 7,000 words) · covers our angle: **partial** — thin on when RPC-style routes are honest · fetched 2026-10-12
- **Also good:** [AIP-122 Resource names](https://google.aip.dev/122) · google.aip.dev · collection identifiers must be plural; names alternate collection and ID segments (*read*) · [AIP-136 Custom methods](https://google.aip.dev/136) · google.aip.dev · Google's page on custom methods for actions that are hard to express with the standard Get, List, Create, Update and Delete methods (*read* the lead) · fetched 2026-10-12
- **Our delta:** the "when RPC-style routes are honest" rule and how the Express router mounts a nested relation URL; neither source is Express-aware.

### T06-02 · HTTP semantics and status mapping — Master · ✅ `docs/expressjs/pages/phase-6-rest-surface/02-status-mapping/`
- **Read this:** [Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · learn.microsoft.com · per-method tables: GET 200/204/404, PUT 200/201/204/409, PATCH 400/409/415, POST 201 with `Location` (*read*) · covers our angle: full for the mapping; idempotency is stated per method · fetched 2026-10-12
- **Also good:** [HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods) · MDN · safe, idempotent and cacheable properties of each method (*read*) · [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/info/rfc9110/) · rfc-editor.org · normative text: PUT, DELETE and safe methods are idempotent (*read* section 9.2) · fetched 2026-10-12
- **Our delta:** the Express calls that produce each status (`res.status(201).location(...)`, `res.sendStatus`) and the 409 versus 412 choice; MDN's Status page (*read* for 201/204/409) is the quick lookup.

### T06-03 · Pagination at the API layer — Master · ✅ `docs/expressjs/pages/phase-6-rest-surface/03-pagination/`
- **Read this:** [Evolving API Pagination at Slack](https://slack.engineering/evolving-api-pagination-at-slack/) · slack.engineering · Aug 2017, updated Jun 2020 · walks no pagination, offset (items repeat when data is added), then cursors, with the trade-offs (*read*) · covers our angle: **partial** — gives no server-side cap on `limit` and no Link headers; the total-count cost is only touched on (cursors avoid computing it) · fetched 2026-10-12
- **Also good:** [AIP-158 Pagination](https://google.aip.dev/158) · google.aip.dev · tokens must be opaque; `total_size` is optional and may be an estimate (*read*) · [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · use-the-index-luke.com · why `OFFSET` still reads skipped rows, and the seek method (*read*) · fetched 2026-10-12
- **Our delta:** `limit` cap and default in the handler, the `total` trade-off, and `res.links()` for optional `Link` headers (Express 5.x response API, *read*). Stripe's API pagination page (`starting_after`, `has_more`) is a good live example (*read*).

### T06-04 · Filtering and sorting safely — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/04-filter-sort-search.md`
- **Read this:** [NoSQL Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html) · OWASP · do not pass client objects through as filters; disallow client-controlled operators such as `$where`; validate expected scalar types first; its `"$` string check is called a denylist, not an allowlist (*read*) · covers our angle: **partial** — Mongo-flavoured, not an allow-list design for sort fields and operators · fetched 2026-10-12
- **Also good:** [AIP-132 Standard methods: List](https://google.aip.dev/132) · google.aip.dev · `order_by` as a comma-separated field list with `desc` suffix; filters and page size on the list request (*read*) · [AIP-160 Filtering](https://google.aip.dev/160) · google.aip.dev · a structured filter grammar and its limitations (*headings only*) · fetched 2026-10-12
- **Our delta:** an explicit map of allowed fields and operators in code, built from `req.query` with Express 5's query parser (value shapes: string, array, nested object), never spread into the query. Microsoft's design page notes sorting can hurt caching (*read*).

### T06-05 · Search endpoints — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/04-filter-sort-search.md`
- **Read this:** [Don't Block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · REDoS, JSON DoS, task partitioning and offloading (*read* the partitioning and offloading section; the rest headings only; long guide) · covers our angle: **partial** — nothing about full-text versus filter design · fetched 2026-10-12
- **Also good:** [Stripe Search API](https://docs.stripe.com/search) · docs.stripe.com · a separate `/search` endpoint with a query language; data is searchable in under a minute, so read-after-write needs the list API (*read*) · fetched 2026-10-12
- **Our delta:** full-text versus filter is not argued by any single page found (tried: "search endpoint API design" style searches, Zalando, Microsoft, Google AIPs). Our page keeps: use the store's index, cap result size, time-box scans, and say that search is eventually consistent when it is. "Debounce expectations" is client-side and **not confirmed** by any source read.

### T06-06 · API versioning strategies — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/05-versioning.md`
- **Read this:** [APIs as infrastructure: future-proofing Stripe with versioning](https://stripe.com/blog/api-versioning) · stripe.com · Aug 2017 · dated versions, compatibility with every version since 2011, and breaking changes wrapped in "version change modules" (*read*) · covers our angle: **partial** — one company's model, not a URL-versus-header-versus-media-type comparison · fetched 2026-10-12
- **Also good:** [Web API Design Best Practices: Implement versioning](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · learn.microsoft.com · sections for no, URI, query string, header and media type versioning (*headings only*, the five strategies are separate headings) · [AIP-185 API Versioning](https://google.aip.dev/185) · google.aip.dev · major version only, first part of the URI path (*read*) · fetched 2026-10-12
- **Our delta:** mounting a versioned router (`app.use('/v1', ...)`) and the deprecation signal; no source read gives the Express mount.

### T06-07 · Idempotency keys — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/06-idempotency-keys.md`
- **Read this:** [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · docs.stripe.com · saves status and body of the first request, retries return it (500s included for v1), keys up to 255 characters, pruned after 24 hours, changed parameters with the same key error (*read*) · covers our angle: **partial** — behaviour of one API, not how to build the store · fetched 2026-10-12
- **Also good:** [The Idempotency-Key HTTP Header Field (IETF draft)](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) · datatracker.ietf.org · draft 07; datatracker lists it as an **expired** Internet-Draft, last updated 2026-04-18 (*headings only*) · fetched 2026-10-12
- **Our delta:** 🔴 the draft is expired, so our page must call `Idempotency-Key` a convention (Stripe, Zalando list it) and not a standard. The store, in-flight request locking, and replay of the saved response are ours.

### T06-08 · ETags and conditional requests — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/07-etag-and-cache.md`
- **Read this:** [HTTP conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests) · MDN · `If-None-Match` (weak) and `If-Match` (strong) validators, cache revalidation with 304, and optimistic locking against lost updates (*read*) · covers our angle: **partial** — no Express wiring · fetched 2026-10-12
- **Also good:** [ETag header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag) · MDN · page modified 2025-07-28 · mid-air collision with `If-Match` and a 412 on mismatch (*read*) · [Application settings: etag](https://expressjs.com/en/5x/api/application/) · expressjs.com · `etag` setting, default weak (*read*) · fetched 2026-10-12
- **Our delta:** Express generates a weak ETag for `res.send` automatically; `If-Match` on writes (strong or version-column compare, 412) is ours to implement.

### T06-09 · `Cache-Control` on API responses — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/07-etag-and-cache.md`
- **Read this:** [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) · MDN · private versus shared caches; personalised content in a shared cache can leak to other users (*read*) · covers our angle: **partial** — general web caching, not authenticated JSON specifically · fetched 2026-10-12
- **Also good:** [Cache-Control header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control) · MDN · directive table including `private`, `no-store`, `no-cache`, `s-maxage` (*read*) · [RFC 9111 HTTP Caching](https://www.rfc-editor.org/info/rfc9111/) · rfc-editor.org · normative (*headings only*) · fetched 2026-10-12
- **Our delta:** the rule for authenticated JSON (`private` or `no-store`), and `Vary` for per-user variants; set in a small middleware.

### T06-10 · OpenAPI / Swagger — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/08-openapi.md`
- **Read this:** [Introduction to OpenAPI](https://learn.openapis.org/introduction.html) · learn.openapis.org · an API description is a machine-readable contract; tools can use it for docs and code (*read*) · covers our angle: **partial** — no Express generator and no drift check · fetched 2026-10-12
- **Also good:** [OpenAPI Specification v3.2.1](https://spec.openapis.org/oas/latest.html) · spec.openapis.org · the reference, about 39,600 words (*headings only*) · [What Is OpenAPI?](https://swagger.io/docs/specification/v3_0/about/) · swagger.io · the 3.0-era overview (*headings only*) · fetched 2026-10-12
- **Our delta:** keeping the document honest with the handlers (validate responses in tests, or derive from one schema). `swagger-ui-express` was not checked: its npm page returns 403, so its version is **not confirmed**.

### T06-11 · Receiving webhooks — Understand · ✅ `docs/expressjs/pages/phase-6-rest-surface/09-webhooks.md`
- **Read this:** [Stripe: Receive events in your webhook endpoint](https://docs.stripe.com/webhooks) · docs.stripe.com · raw body required for signatures; replay protection via a signed timestamp; default tolerance 5 minutes, never 0; track event IDs for duplicates; return 2xx before slow logic (*read*) · covers our angle: full for the concepts; its Node sample is Stripe-library specific · fetched 2026-10-12
- **Also good:** [Standard Webhooks specification (raw)](https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md) · github (raw) · HMAC-SHA256 or ed25519, check `webhook-timestamp` tolerance, use `webhook-id` as idempotency key (*read*) · [express.json / express.raw options](https://expressjs.com/en/5x/api/express/) · expressjs.com · `verify(req, res, buf, encoding)` receives the raw Buffer (*read*) · fetched 2026-10-12
- **Our delta:** mounting `express.raw` on the webhook route before any JSON parser, then `crypto.timingSafeEqual`; vendor docs hide the Express order-of-middleware trap.

### T06-12 · Delivering webhooks from a route — Know · ✅ `docs/expressjs/pages/phase-6-rest-surface/09-webhooks.md`
- **Read this:** [Standard Webhooks specification (raw)](https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md) · github (raw) · sender side: 2xx means success, retry schedule over days with backoff and jitter, status-code handling, disabling a dead endpoint (*read*) · covers our angle: **partial** — nothing on enqueue-and-202 from an Express route · fetched 2026-10-12
- **Also good:** [Asynchronous Request-Reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) · learn.microsoft.com · answer 202, hand off to a queue, point at a status endpoint (*read*) · fetched 2026-10-12
- **Our delta:** the route validates, enqueues and answers 202; the job lives in Node Phase 7 (cross-link).

### T06-13 · HATEOAS / hypermedia — When Needed · ✅ `docs/expressjs/pages/phase-6-rest-surface/11-hypermedia.md`
- **Read this:** [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html) · martinfowler.com · 18 Mar 2010 · level 3 adds hypermedia controls ("HATEOAS") to level 2 resources and verbs (*read*) · covers our angle: **partial** — explains the idea, not when the cost pays off · fetched 2026-10-12
- **Also good:** [REST APIs must be hypertext-driven](https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven) · roy.gbiv.com · 20 Oct 2008 · Fielding's argument that an API not driven by hypertext cannot be called REST (*read* the opening) · [Zalando REST guidelines](https://opensource.zalando.com/restful-api-guidelines/) · opensource.zalando.com · must use maturity level 2, may use level 3 (*headings only*, in the contents list) · fetched 2026-10-12
- **Our delta:** the "when links earn their complexity" judgement is ours; `res.links()` is the Express hook for `Link` header relations.

### T06-14 · Bulk endpoints and partial updates — Know · ✅ `docs/expressjs/pages/phase-6-rest-surface/10-patch-and-bulk.md`
- **Read this (1/2):** [PATCH method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/PATCH) · MDN · page modified 2026-06-22 · PATCH is a set of instructions, PUT a replacement; PATCH may not be idempotent (*read*) · covers our angle: **partial** — JSON formats are only linked · fetched 2026-10-12
- **Read this (2/2):** [RFC 7396 JSON Merge Patch](https://www.rfc-editor.org/info/rfc7396/) · rfc-editor.org · Oct 2014 · merge patch: null removes a member, other members replace or add (*read*) · fetched 2026-10-12
- **Also good:** [RFC 6902 JSON Patch](https://www.rfc-editor.org/info/rfc6902/) · rfc-editor.org · Apr 2013 · operations list: add, remove, replace, move, copy, test (*read* the contents) · [Zalando REST guidelines](https://opensource.zalando.com/restful-api-guidelines/) · opensource.zalando.com · use 207 for bulk requests that can partially fail (*read*) · fetched 2026-10-12
- **Our delta:** merge patch cannot set a field to null on purpose and replaces arrays whole; choose by that. The Express side: `Content-Type` check (415), 409 versus 400 for a valid patch that cannot apply (Microsoft table, *read*).

---

## Phase 7 — Layering at the Express edge

### T07-01 · Controller → service → repository wiring — Master · ✅ written `docs/expressjs/pages/phase-7-layering/01-controller-service-repository/`
- **Read this:** [Layer your app, keep Express within its boundaries](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/projectstructre/createlayers.md) · github (raw), Node.js Best Practices · entry points adapt the payload and call domain; domain takes plain objects; data-access hides the DB behind a repository-style interface (*read*) · covers our angle: full for the layering · fetched 2026-10-12
- **Also good:** [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) · martinfowler.com · the application boundary and its operations, controlling transactions (*read*) · [Repository](https://martinfowler.com/eaaCatalog/repository.html) · martinfowler.com · collection-like access that isolates domain objects from database code (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the Best Practices page uses a three-tier naming (entry-points, domain, data-access), while our syllabus says controller, service, repository; say the mapping once. Types must not leak upward; no source states it in those words.

### T07-02 · Domain vs transport — Understand · ✅ `docs/expressjs/pages/phase-7-layering/02-domain-vs-transport.md`
- **Read this:** [Layer your app, keep Express within its boundaries](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/projectstructre/createlayers.md) · github (raw) · domain layer "accepts protocol-agnostic payload", plain objects in and out (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Presentation Domain Separation](https://martinfowler.com/bliki/PresentationDomainSeparation.html) · martinfowler.com · 9 Oct 2003 · the principle behind it (*read* the opening) · fetched 2026-10-12
- **Our delta:** the concrete test: a service importable and callable with no `req` or `res` in scope; the error mapping at the edge.

### T07-03 · Avoiding fat controllers — Understand · ✅ `docs/expressjs/pages/phase-7-layering/03-fat-controllers.md`
- **Read this:** [Layer your app, keep Express within its boundaries](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/projectstructre/createlayers.md) · github (raw) · entry-point responsibility is minimal: adapt payload, first validation, call logic, respond, "a few lines of code" (*read*) · covers our angle: **partial** — validation and auth as middleware is not argued · fetched 2026-10-12
- **Also good:** [Writing middleware for use in Express apps](https://expressjs.com/en/guide/writing-middleware/) · expressjs.com · the mechanism for pulling cross-cutting work out of handlers (*headings only*) · [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) · martinfowler.com · avoids duplicated logic per interface (*read*) · fetched 2026-10-12
- **Our delta:** the 20-line handler gate, validation and auth as route-level middleware, one use case per handler; this page is one source for the first half only.

### T07-04 · Dependency injection without a framework — Understand · ✅ `docs/expressjs/pages/phase-7-layering/04-di-without-framework.md`
- **Read this:** [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) · blog.ploeh.dk · Mark Seemann, 2011-07-28 · compose "as close as possible" to the entry point; one place where modules are wired (*read*) · covers our angle: **partial** — .NET-flavoured, no `deps` object or router factory · fetched 2026-10-12
- **Also good:** [Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) · martinfowler.com · constructor injection versus service locator (*headings only*) · fetched 2026-10-12
- **Our delta:** a router factory taking `deps`, built in `createApp` (Phase 10); no Node/Express page found that frames DI without a container (tried: general searches). Written from the two patterns above.

### T07-05 · Background work from a route — Understand · ✅ `docs/expressjs/pages/phase-7-layering/05-jobs-from-routes.md`
- **Read this:** [Asynchronous Request-Reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) · learn.microsoft.com · validate first, 400 if invalid; return 202 with a `Location` status endpoint and `Retry-After`; offload to a queue (*read*) · covers our angle: **partial** — Azure examples, no Node · fetched 2026-10-12
- **Also good:** [Don't Block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · why slow work must not sit on the request path (*headings only*) · [Stripe: Receive events](https://docs.stripe.com/webhooks) · docs.stripe.com · return 2xx before complex logic (*read*) · fetched 2026-10-12
- **Our delta:** validate, persist, enqueue, respond, in that order, with the queue itself in Node Phase 7.

### T07-06 · Folder structure that scales — Know · ✅ `docs/expressjs/pages/phase-7-layering/06-folders-and-dtos.md`
- **Read this:** [Structure your solution by components](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/projectstructre/breakintcomponents.md) · github (raw) · one self-contained folder per business component; others use only its public interface (*read*) · covers our angle: **partial** — argues for feature folders; does not weigh layer folders · fetched 2026-10-12
- **Also good:** [Layer your app, keep Express within its boundaries](https://raw.githubusercontent.com/goldbergyoni/nodebestpractices/master/sections/projectstructre/createlayers.md) · github (raw) · layers inside each component (*read*) · fetched 2026-10-12
- **Our delta:** the "pick one and stay consistent" rule. The two pages combine both in one tree, so our page must name the choice.

### T07-07 · Transaction middleware — Know · ✅ `docs/expressjs/pages/phase-7-layering/07-transaction-middleware.md`
- **Read this:** [Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html) · martinfowler.com · tracks changes in a business transaction and coordinates writing them out (*read* the lead) · covers our angle: **partial** — the concept, nothing on per-request HTTP middleware · fetched 2026-10-12
- **Also good:** [Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html) · martinfowler.com · says the service layer controls transactions; that this argues against a per-request wrapper is our inference, not the page's (*read*) · fetched 2026-10-12
- **Our delta:** none found that explains begin/commit/rollback middleware for Express (tried: general searches). The mechanism stays in Node Phase 6; our page keeps the thin-wrapper warning and error-path rollback.

### T07-08 · DTO mapping at the edge — Know · ✅ `docs/expressjs/pages/phase-7-layering/06-folders-and-dtos.md`
- **Read this:** [Data Transfer Object](https://martinfowler.com/eaaCatalog/dataTransferObject.html) · martinfowler.com · carries data between processes; an assembler maps between DTO and domain objects on the server (*read*) · covers our angle: **partial** — framed around remote-call batching; its 2013 note adds that a DTO can also encapsulate the serialization mechanism · fetched 2026-10-12
- **Also good:** [OWASP API3:2023 Broken Object Property Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/) · api-security.owasp.org · covers APIs returning all of an object's properties and users changing properties they should not (the old mass assignment) (*read* the description) · fetched 2026-10-12
- *Not opened:* [Anti-corruption layer pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer) (returned 200; contents not read).
- **Our delta:** response DTOs as an allow-list of fields (never return the row), and request DTOs after validation; the security reason is ours to cite.
