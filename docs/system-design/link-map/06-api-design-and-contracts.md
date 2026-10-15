---
title: "Link map · System design · Part 6 (phases 10–11)"
sidebar_label: "06 · API design"
sidebar_position: 6
---

# Link map · System design · Part 6 (phases 10–11)

Covers every topic row of phases 10 and 11 in `docs/system-design/syllabus/06-api-design-and-contracts.md`: REST done properly (T10-01 to T10-19) and GraphQL, gRPC, tRPC, realtime and contracts (T11-01 to T11-17). That is 36 rows. Ten have a written page of ours (the API sketch, rate limiting, long-lived connections, serialization, the gateway and GraphQL-at-the-edge pages, all in phases 1 and 2); `docs/system-design/pages` holds phases 0 to 3 only, so the rest are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means specifications, RFCs, vendor and project documentation; blogs and vendor engineering posts count as beyond the docs.

---

## Phase 10 — REST done properly

### T10-01 · Resources, not actions — Master · 🔲 not written
- **Read this:** [Web API Design Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) · Microsoft Azure Architecture Center · organise the API around resources, base URIs on nouns and avoid verbs in URIs (*read*) · covers our angle: **partial** — the noun rule, not the cancellation-as-a-resource move · fetched 2026-10-14
- **Also good:** [AIP-136: Custom methods](https://google.aip.dev/136) · Google API Improvement Proposals · custom methods only for functionality that cannot be expressed through the standard methods, with a request and response message named after the RPC (*read*) · covers our angle: **full** for the honest-RPC-endpoint half · fetched 2026-10-14
- **Beyond the docs:** [Understanding RPC, REST and GraphQL](https://apisyouwonthate.com/blog/understanding-rpc-rest-and-graphql/) · Phil Sturgeon · RPC is a method plus arguments and leaves the client in charge of the workflow, which is the cost an action-shaped endpoint carries (*read*) · fetched 2026-10-14
- **Our delta:** the refund or cancellation modelled as a resource with its own lifecycle, and when to stop pretending and ship a named action.

### T10-02 · HTTP semantics as the contract — Master · ✅ written `docs/system-design/pages/phase-1-the-method/05-the-api-sketch.md`
- **Read this:** [409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409) · MDN · a request conflict with the current state of the target resource (*read*) · covers our angle: **partial** — one code; the full status table is on the index page [HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status) (*headings only*) · fetched 2026-10-14
- **Also good:** [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) · IETF · the normative definition of safe and idempotent methods that our page quotes (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Choosing the Right HTTP Status Codes for Your API](https://milanjovanovic.tech/blog/rest-api-http-status-codes) · Milan Jovanović · never return 200 with an error in the body, because caches, retry policies and dashboards key on the status class (*read*) · fetched 2026-10-14
- **Our delta:** our page quotes RFC 9110 on safe and idempotent methods and uses 201, 409 and 412 in the checkout sketch, but has no status-code treatment; the codes that carry meaning (202, 304, 412, 422, 429) and the ones that lie (200 with an error body) are this row's extra.

### T10-03 · Idempotency keys — Master · ✅ written `docs/system-design/pages/phase-1-the-method/05-the-api-sketch.md`
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API Reference · keys can be pruned after at least 24 hours, and the layer compares incoming parameters to the original request and errors if they differ; a request that conflicts with one executing concurrently is not saved and may be retried (*read*) · covers our angle: **partial** — key lifetime and parameter mismatch; the concurrent duplicate gets one sentence · fetched 2026-10-14
- **Also good:** [The Idempotency-Key HTTP Header Field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) · IETF HTTPAPI working group draft (expired) · a header to make non-idempotent methods such as POST or PATCH fault-tolerant (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach · builds the key table with a unique index on user and key, atomic phases and recovery points so a retry resumes rather than repeats, and answers a request for a key that is still locked with `409 Conflict` (*read*) · 2017-10-27 · fetched 2026-10-14
- **Our delta:** our page already states key scope per principal, the stored request hash and response, and the unique constraint that serialises a concurrent duplicate; the retention window's length, what a replay returns while the first is still running, and resuming a half-finished request are the extra.

### T10-04 · Pagination — Master · ✅ written `docs/system-design/pages/phase-1-the-method/05-the-api-sketch.md`
- **Read this:** [Pagination](https://docs.stripe.com/api/pagination) · Stripe API Reference · list methods use cursor-based pagination with `starting_after` and `ending_before` object IDs, newest first (*read*) · covers our angle: **partial** — the cursor shape, not the cost of totals · fetched 2026-10-14
- **Also good:** [AIP-158: Pagination](https://google.aip.dev/158) · Google API Improvement Proposals · `page_token` in, `next_page_token` out, and the page size must not be required (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [We need tool support for keyset pagination](https://use-the-index-luke.com/no-offset) · Markus Winand · offset makes the database fetch and order the skipped rows first, so deep pages cost more (*read*) · fetched 2026-10-14
- **Our delta:** our page has the opaque `(createdAt, id)` cursor and the page that shifted under offset; the cost of total counts and a full offset-vs-keyset-vs-cursor comparison are the extra.

### T10-05 · The error contract — Master · 🔲 not written
- **Read this:** [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) · IETF · defines a machine-readable "problem detail" so APIs need not invent new error formats, with `type` and `instance` members (*read*) · covers our angle: **partial** — the envelope, not stable code vocabularies or field-level errors · fetched 2026-10-14
- **Also good:** [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807.html) · IETF · the original version that 9457 obsoletes (*headings only*) · fetched 2026-10-14
- **Our delta:** one shape for every failure, stable codes, field errors and no leaked internals.

### T10-06 · Versioning and evolution — Master · 🔲 not written
- **Read this:** [RFC 9745: The Deprecation HTTP Response Header Field](https://www.rfc-editor.org/rfc/rfc9745.html) · IETF · the act of deprecation changes no behaviour; the header tells clients a resource will be or has been deprecated, with a `Link` for docs and replacement (*read*) · covers our angle: **partial** — the signal, not the plan · fetched 2026-10-14
- **Also good:** [RFC 8594: The Sunset HTTP Header Field](https://www.rfc-editor.org/rfc/rfc8594.html) · IETF · a response header announcing when a resource is expected to become unavailable (*read*) · fetched 2026-10-14
- **Also good:** [Versioning](https://docs.stripe.com/api/versioning) · Stripe API Reference · monthly dated releases with no breaking changes and two major releases a year that carry them, the account default overridden per request with the `Stripe-Version` header (*read*) · fetched 2026-10-14
- **Beyond the docs:** [APIs as infrastructure: future-proofing Stripe with versioning](https://stripe.com/blog/api-versioning) · Stripe engineering · rolling date-named versions, accounts pinned on first request, and version change modules that keep old versions out of core code paths (*read*) · 2017-08-15 · predates the monthly-plus-major release model the reference page now describes · fetched 2026-10-14
- **Our delta:** path vs header vs additive-only, running two versions at once, and the bump you never needed.

### T10-07 · Conditional requests — Master · 🔲 not written
- **Read this:** [HTTP conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests) · MDN · the ETag as an opaque version identifier, `If-Match` doing strong validation, and conditional requests preventing lost updates (*read*) · covers our angle: **partial** — validators and headers, not the write-side `412` flow in an API · fetched 2026-10-14
- **Beyond the docs:** [Optimistic Locking in a REST API](https://sookocheff.com/post/api/optimistic-locking-in-a-rest-api/) · Kevin Sookocheff · two clients fetch, edit and PUT the same resource and the second silently overwrites the first, fixed by `If-Match` and `412 Precondition Failed` (*read*) · 2016-12-21 · fetched 2026-10-14
- **Our delta:** `If-Match` as optimistic concurrency on a PATCH, and the lost update an entity tag prevented; the phase 1 API sketch already uses it on the admin stock change, without the treatment.

### T10-08 · Backward compatibility rules — Master · 🔲 not written
- **Read this:** [AIP-180: Backwards compatibility](https://google.aip.dev/180) · Google API Improvement Proposals · existing interfaces, methods, messages, fields and enum values must not be removed or renamed within a major version (*read*) · covers our angle: **full** for the rule list · fetched 2026-10-14
- **Beyond the docs:** [Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html) · Martin Fowler · decoupled collaboration should follow Postel's law; evolution is the sticky point for collaborating services (*read*) · fetched 2026-10-14
- **Our delta:** tightened validation as a breaking change, and the field you can never remove.

### T10-09 · Webhooks as an API you publish — Master · 🔲 not written
- **Read this:** [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks) · Stripe Documentation · signature verification needs the raw body, live-mode deliveries retry for up to three days with exponential back-off, manual resend works for up to 15 days from the dashboard, a signed timestamp with a 5-minute default tolerance against replay, and deduplication by event ID because delivery can repeat and is unordered (*read*) · covers our angle: **partial** — signing, replay, retries and duplicates from one sender's side, not typed versioned events as a product · fetched 2026-10-14
- **Also good:** [Standard Webhooks](https://www.standardwebhooks.com/) · Standard Webhooks project · a spec so webhooks resist spoofing, SSRF and replay attacks and are interoperable (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Webhook best practices](https://www.svix.com/resources/webhook-best-practices/) · Svix · webhooks bring unreliable endpoints, spoofing, SSRF and replay attacks, with a practice list from running a delivery service (*read*) · fetched 2026-10-14
- **Our delta:** timestamps against replay, idempotent receivers, typed versioned events and a failed-delivery dashboard.

### T10-10 · Filtering, sorting and sparse fields — Understand · 🔲 not written
- **Read this:** [AIP-160: Filtering](https://google.aip.dev/160) · Google API Improvement Proposals · a filter grammar with binary operators and a stated precedence for `OR` (*read*) · covers our angle: **partial** — grammar, not the index each filter needs · fetched 2026-10-14
- **Also good:** [AIP-132: Standard methods: List](https://google.aip.dev/132) · Google API Improvement Proposals · a `filter` string and an `order_by` string on list methods (*read*) · fetched 2026-10-14
- **Also good:** [JSON:API](https://jsonapi.org/format/) · JSON:API specification v1.1 · per-type sparse fieldsets via `fields[TYPE]`, a `sort` parameter with a minus prefix for descending, and `400 Bad Request` when the requested sort is unsupported — an allow-list in the spec (*read*) · fetched 2026-10-14
- **Our delta:** allow-lists, the index behind every filter, and the everything-optional endpoint no index can serve.

### T10-11 · Rate limiting as a contract — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/07-rate-limiting.md`
- **Read this:** [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) · MDN · a `Retry-After` header may say how long to wait, with a worked 3600-second example (*read*) · covers our angle: **partial** — the response, not quotas per key · fetched 2026-10-14
- **Also good:** [RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) · IETF HTTPAPI draft · defines `RateLimit-Policy` and `RateLimit` for advertising quota policies and the current state (*read*) · fetched 2026-10-14
- **Also good:** [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) · GitHub Docs · 5,000 requests per hour per user and `x-ratelimit-reset` in epoch seconds, a header contract in production (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe engineering · a load shedder looks at whole-system state, and a concurrent-requests limiter caps requests in flight rather than per second (*read*) · fetched 2026-10-14
- **Our delta:** our page already has the algorithms, where to enforce, per-API-key limits and the 429 contract (Retry-After, no-store, 503 for overload); it names `RateLimit-Limit`, `-Remaining` and `-Reset` as convention, while the current IETF draft defines `RateLimit-Policy` and `RateLimit` instead. Published per-plan quotas for partners are the extra.

### T10-12 · Bulk and batch endpoints — Understand · 🔲 not written
- **Read this:** [AIP-231: Batch methods: Get](https://google.aip.dev/231) · Google API Improvement Proposals · a `BatchGet` RPC that reads a consistent set of resources in one call (*read*) · covers our angle: **partial** — atomic reads, not partial-success writes · fetched 2026-10-14
- **Also good:** [AIP-233: Batch methods: Create](https://google.aip.dev/233) · Google API Improvement Proposals · the RPC name must begin with `BatchCreate` and use the plural resource name (*read*) · fetched 2026-10-14
- **Also good:** [Combine multiple HTTP requests using JSON batching](https://learn.microsoft.com/en-us/graph/json-batching) · Microsoft Graph · up to 20 requests per batch, each individual response carrying its own `status` (*read*) · covers our angle: **full** for per-item status · fetched 2026-10-14
- **Our delta:** atomic vs best-effort stated up front, size limits and per-item results.

### T10-13 · Long-running operations — Understand · 🔲 not written
- **Read this:** [AIP-151: Long-running operations](https://google.aip.dev/151) · Google API Improvement Proposals · a method that cannot finish quickly returns an Operation resource the client can poll (*read*) · covers our angle: **partial** — polling, not callbacks or progress streams · fetched 2026-10-14
- **Also good:** [Asynchronous Request-Reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) · Microsoft Azure Architecture Center · answer `202 Accepted` at once, then poll a status endpoint (*read*) · covers our angle: **full** for accepted-then-poll · fetched 2026-10-14
- **Our delta:** callbacks, server-sent progress and cancellation as a first-class call.

### T10-14 · OpenAPI in practice — Understand · 🔲 not written
- **Read this:** [OpenAPI Specification v3.2.1](https://spec.openapis.org/oas/latest.html) · OpenAPI Initiative · a language-agnostic interface description for HTTP APIs that humans and tools can read without source access (*read*) · covers our angle: **partial** — the format, not design-first vs generated · fetched 2026-10-14
- **Also good:** [Redocly CLI](https://redocly.com/docs/cli) · Redocly · an open-source tool for linting, bundling and enhancing OpenAPI descriptions (*read*) · fetched 2026-10-14
- **Also good:** [Zod OpenAPI Hono](https://hono.dev/examples/zod-openapi) · Hono docs · define schemas in Zod, validate with them and generate the OpenAPI document from the same definitions (*read*) · covers our angle: **partial** — one framework's take on this stack's generated-from-schemas choice · fetched 2026-10-14
- **Our delta:** this stack's choice (generate from the validation schemas) and what linting buys.

### T10-15 · Authentication at the boundary — Understand · 🔲 not written
- **Read this:** [RFC 6750: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html) · IETF · how to use bearer tokens in HTTP requests, where possession of the token is enough to use it (*read*) · covers our angle: **partial** — the transport, not scopes or API keys · fetched 2026-10-14
- **Also good:** [Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) · OWASP API Security Top 10 (2023) · object-level checks belong in every function that uses a client-supplied ID (*read*) · covers our angle: **partial** — authorization, which this row says is decided separately · fetched 2026-10-14
- **Our delta:** where authentication is enforced and where authorization is decided; continues in Part 9.

### T10-16 · The storefront's public API — Understand · 🔲 not written
- **Read this:** [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) · Stripe API Reference · create, update, retrieve, list and expire as one resource's lifecycle, and a new Session recommended for each payment attempt (*read*) · covers our angle: **partial** — a real checkout resource to compare against, not our decisions · fetched 2026-10-14
- **Our delta:** catalogue, cart, checkout, orders and partner webhooks with every decision above applied and justified.

### T10-17 · API governance — Know · 🔲 not written
- **Read this:** [Zalando RESTful API and Event Guidelines](https://opensource.zalando.com/restful-api-guidelines/) · Zalando · a published style guide that requires the API specification to be a single self-contained YAML document published with the service (*read*) · covers our angle: **partial** — the guide, not the review process · fetched 2026-10-14
- **Beyond the docs:** [How to create an API style guide, and why](https://tyk.io/blog/how-to-create-an-api-style-guide-and-why/) · Tyk · a style guide brings a need for central governance and migration paths, so how to avoid strict enforcement with negative consequences for consumers (*read*) · fetched 2026-10-14
- **Our delta:** what a platform team enforces and what it leaves to teams.

### T10-18 · Documentation as product — Know · 🔲 not written
- **Read this:** [Diátaxis](https://diataxis.fr/) · Daniele Procida · four needs and four forms: tutorials, how-to guides, technical reference and explanation (*read*) · covers our angle: **partial** — the structure, not changelogs or runnable examples · fetched 2026-10-14
- **Also good:** [Software documentation guide](https://www.writethedocs.org/guide/) · Write the Docs · the community's collected practices for documentation (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How Stripe creates the best documentation in the industry](https://www.mintlify.com/blog/stripe-docs) · Mintlify · credits writing quality to leadership example and documentation in career ladders and performance reviews (*read*) · fetched 2026-10-14
- **Our delta:** reference vs guides, examples that run, and the page that is the real onboarding.

### T10-19 · The maturity model and hypermedia — Know · 🔲 not written
- **Read this:** [REST APIs must be hypertext-driven](https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven) · Roy Fielding, 2008 · if application state is not driven by hypertext it cannot be a REST API, and effort belongs in media types and link relations (*read*) · covers our angle: **partial** — the purist case · fetched 2026-10-14
- **Beyond the docs:** [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html) · Martin Fowler · walks levels 0 to 3 through one doctor's-appointment example, and credits level 3 with letting the server change its URI scheme without breaking clients and advertise new capabilities through links (*read*) · covers our angle: **partial** — the case for, not why nobody ships it · 2010-03-18 · fetched 2026-10-14
- **Our delta:** why almost nobody ships the top level, and the parts worth keeping (links for pagination and next actions).

---

## Phase 11 — GraphQL, gRPC, tRPC, realtime and contracts

### T11-01 · GraphQL schema design — Master · 🔲 not written
- **Read this:** [Schemas and Types](https://graphql.org/learn/schema/) · graphql.org · `String!` is a promise the service gives a value, `[Episode!]!` promises an array of non-null items, plus input object types (*read*) · covers our angle: **partial** — the type system, not the promise-keeping cost · fetched 2026-10-14
- **Also good:** [Pagination](https://graphql.org/learn/pagination/) · graphql.org · the cursor-based connection model for paginated fields (*read*) · fetched 2026-10-14
- **Also good:** [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) · Relay · the standard shape for cursors and for telling the client more results are available (*read*) · fetched 2026-10-14
- **Also good:** [Nullability in GraphQL.js](https://www.graphql-js.org/docs/nullability/) · GraphQL.js · fields are nullable by default, and a non-null failure propagates ("bubbles") to the nearest nullable parent (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Nulls in GraphQL: Cheatsheet](https://hasura.io/blog/graphql-nulls-cheatsheet) · Hasura · lists the four reasons a nullable field can come back null, one being a bubbled non-null error (*read*) · fetched 2026-10-14
- **Our delta:** nullability as a promise you keep for years, and mutations named as actions.

### T11-02 · Resolvers, N+1 and DataLoader — Master · ✅ written `docs/system-design/pages/phase-2-request-path/17f-graphql-authorisation-cost-and-federation.md`
- **Read this:** [Solving the N+1 Problem with DataLoader](https://www.graphql-js.org/docs/n1-dataloader/) · GraphQL.js · batches per-key loads into one call such as `getUsersByIds`, caches within the request, and says to create a new DataLoader per request (*read*) · covers our angle: **full** for the mechanism · fetched 2026-10-14
- **Also good:** [Performance](https://graphql.org/learn/performance/) · graphql.org · the N+1 problem defined with the hero-and-friends example, mitigated by batching and caching (*read*) · fetched 2026-10-14
- **Also good:** [Batching and caching](https://goldenpath.graphql.org/solutions/batching-caching/) · GraphQL Golden Path · notes that inconsistent usage fragments batches (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Solving the N+1 Problem for GraphQL through Batching](https://shopify.engineering/solving-the-n-1-problem-for-graphql-through-batching) · Shopify Engineering · resolvers return promises, loaders group similar loads and run once per group, and nested fields resolve and batch again — the same mechanism in Ruby (*read*) · 2018-04-24 · fetched 2026-10-14
- **Our delta:** page 17f has the 101-calls-to-3 resolver N+1, the per-request loader (for authorisation as well as correctness), the upstream batch endpoints it needs and the upstream-calls-per-query metric from 17c; the library mechanics (one tick of key collection, result order matching key order) are the extra.

### T11-03 · GraphQL vs REST, honestly — Master · ✅ written `docs/system-design/pages/phase-2-request-path/17e-graphql-at-the-edge.md`
- **Read this:** [Introduction to GraphQL](https://graphql.org/learn/introduction/) · graphql.org · a query language and server runtime over a type system you define; clients describe the shape they need and get just that data in a single request (*read*) · covers our angle: **partial** — the case for, not the cost · fetched 2026-10-14
- **Beyond the docs:** [GraphQL vs. REST](https://www.apollographql.com/blog/graphql-vs-rest) · Apollo · concedes GraphQL results cannot use HTTP caching as effectively as REST and has fewer tools and integrations (*read*) · fetched 2026-10-14
- **Our delta:** page 17e has the transport cost (single POST, no CDN keys, no retry allowance, 200 with an errors array) that the vendor posts underplay, and 17f the per-field authorisation and complexity limits; the tooling gap is the only syllabus cost neither page treats.

### T11-04 · gRPC and Protobuf — Master · 🔲 not written
- **Read this:** [Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/) · gRPC · unary and streaming call lifecycles with deadlines and cancellation (*read*) · covers our angle: **partial** — the call model, not balancing or the browser path · fetched 2026-10-14
- **Also good:** [Deadlines](https://grpc.io/docs/guides/deadlines/) · gRPC · deadlines as the way to cope with unreliable backends (*read*) · fetched 2026-10-14
- **Also good:** [Error handling](https://grpc.io/docs/guides/error/) and [Status codes and their use in gRPC](https://grpc.io/docs/guides/status-codes/) · gRPC · the standard and richer error models, and `INVALID_ARGUMENT` as distinct from `FAILED_PRECONDITION` (*read*) · fetched 2026-10-14
- **Also good:** [gRPC Load Balancing](https://grpc.io/blog/grpc-load-balancing/) · gRPC · load balancing for deployments with several backends, proxy and client-side options (*read*) · fetched 2026-10-14
- **Also good:** [gRPC-Web basics](https://grpc.io/docs/platforms/web/basics/) · gRPC · a browser client for gRPC services, with a proxy in front (*read*) · fetched 2026-10-14
- **Beyond the docs:** [gRPC Load Balancing on Kubernetes without Tears](https://linkerd.io/2018/11/14/grpc-load-balancing-on-kubernetes-without-tears/) · Linkerd · gRPC breaks standard connection-level load balancing, because HTTP/2 multiplexes many calls on one connection (*read*) · fetched 2026-10-14
- **Our delta:** inside the datacentre first, and the long-lived-connection balancing problem.

### T11-05 · The decision table — Master · 🔲 not written
- **Read this:** [Understanding RPC, REST and GraphQL](https://apisyouwonthate.com/blog/understanding-rpc-rest-and-graphql/) · Phil Sturgeon · the three styles side by side, starting from RPC as method-plus-arguments (*read*) · covers our angle: **partial** — no gRPC or tRPC column · fetched 2026-10-14
- **Also good:** [tRPC concepts](https://trpc.io/docs/concepts) · tRPC · RPC at its heart, designed for TypeScript monorepos (*read*) · fetched 2026-10-14
- **Our delta:** a table by consumer, team, performance and evolution, and the mix companies actually run.

### T11-06 · Contract testing — Master · 🔲 not written
- **Read this:** [Pact documentation](https://docs.pact.io/) · Pact · contract tests assert that messages conform to a shared contract without deploying the world first (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Can I Deploy](https://docs.pact.io/pact_broker/can_i_deploy) · Pact · the matrix of tested consumer and provider versions and the tool that answers whether a version is safe to deploy (*read*) · covers our angle: **full** for the pipeline gate · fetched 2026-10-14
- **Also good:** [Consumer-driven contract testing](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/cdc-testing/) · Microsoft Code-with-Engineering Playbook · components tested in isolation against mocks that follow a shared contract, then verified against a real provider (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Consumer-Driven Contracts: A Service Evolution Pattern](https://martinfowler.com/articles/consumerDrivenContracts.html) · Ian Robinson on martinfowler.com · the ProductSearch example with two consumers, one internal and one external, using different fields (*read*) · fetched 2026-10-14
- **Our delta:** the deploy a contract test would have stopped, set against end-to-end tests.

### T11-07 · GraphQL at scale — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/17f-graphql-authorisation-cost-and-federation.md`
- **Read this:** [Safelisting with Persisted Queries](https://www.apollographql.com/docs/graphos/platform/security/persisted-queries) · Apollo GraphOS · an allowlist of trusted operations, optionally requiring clients to send operation IDs (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Rate limits and query limits for the GraphQL API](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api) · GitHub Docs · points assigned per query, 5,000 points per hour per user (*read*) · covers our angle: **full** for cost-based limiting · fetched 2026-10-14
- **Also good:** [Introduction to Apollo Federation](https://www.apollographql.com/docs/graphos/schema-design/federated-schemas/federation) · Apollo · federate many subgraphs into one supergraph (*read*) · fetched 2026-10-14
- **Also good:** [GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html) · OWASP · depth and amount limits, timeouts and disabling introspection (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Rate Limiting GraphQL APIs by Calculating Query Complexity](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity) · Shopify Engineering · static cost before execution (objects 1 point, connections 2 plus items, mutations 10), 50 points a second up to 1,000, and the difference between requested and actual cost refunded (*read*) · 2021-06-22 · fetched 2026-10-14
- **Our delta:** page 17f has depth and cost limits, cost-based rate limiting, the persisted-query allowlist and federation; page 17e has persisted queries as `GET` for edge caching and per-entity caching inside the server. What is left is the registry's operational detail (automatic persisted queries, retiring old app versions' queries).

### T11-08 · Protobuf schema evolution — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/13-serialization-on-the-wire.md`
- **Read this:** [Protocol Buffers Language Guide (proto3)](https://protobuf.dev/programming-guides/proto3/) · protobuf.dev · changing a field number is unsafe, equal to deleting the field and adding a new one; unknown fields are preserved (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Dos and Don'ts](https://protobuf.dev/best-practices/dos-donts/) · protobuf.dev · use `reserved` for deleted field numbers and names (*read*) · fetched 2026-10-14
- **Also good:** [Buf breaking change detection](https://buf.build/docs/breaking/) · Buf · compares the schema against a baseline (for example the main branch) under FILE, PACKAGE, WIRE_JSON or WIRE rules, and runs in CI (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Schema evolution in Avro, Protocol Buffers and Thrift](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html) · Martin Kleppmann · names are not on the wire so fields can be renamed but tags never changed or reused, unknown tags are skipped by their type code, and `required` is where disagreement becomes a runtime error (*read*) · 2012-12-05 · fetched 2026-10-14
- **Our delta:** our page already states never renumber, reserve removed fields, unknown fields ignored, adding safe and requiring not, and consumers accepting the previous version; wire-compatible vs source-compatible changes, enum evolution and a breaking-change check in CI are the extra.

### T11-09 · tRPC — Understand · 🔲 not written
- **Read this:** [tRPC introduction](https://trpc.io/docs/) · tRPC · keeps client and server contracts in sync through TypeScript type inference with no code generation step (*read*) · covers our angle: **partial** — what it removes, not what it rules out · fetched 2026-10-14
- **Also good:** [tRPC concepts](https://trpc.io/docs/concepts) · tRPC · it is RPC, designed for TypeScript monorepos (*read*) · fetched 2026-10-14
- **Our delta:** non-TypeScript clients and a public API are what it rules out.

### T11-10 · Backend-for-frontend and aggregation — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/17-gateway-patterns.md`
- **Read this:** [Backends for Frontends pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends) · Microsoft Azure Architecture Center · a separate backend per frontend interface instead of one general-purpose backend (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Backends For Frontends](https://samnewman.io/patterns/architectural/bff/) · Sam Newman · a general-purpose API backend can become a bottleneck for rollouts because so many changes target one deployable (*read*) · fetched 2026-10-14
- **Our delta:** page 17 covers all three syllabus points — one BFF per client type, the client team owning it, and the no-domain-state test against a second monolith — plus N BFFs implementing the same policy N times as the failure mode.

### T11-11 · Realtime APIs — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/06-long-lived-connections.md`
- **Read this:** [WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) · MDN · a two-way interactive session between browser and server without polling (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) · MDN · the browser waits the `retry` time before reconnecting (*read*) · fetched 2026-10-14
- **Also good:** [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) · WHATWG HTML Standard · the `Last-Event-ID` header and the reconnect states of an `EventSource` (*read*) · covers our angle: **full** for resume · fetched 2026-10-14
- **Beyond the docs:** [Our Journey to a Scalable SSE Architecture](https://artera.io/blog/server-sent-events-architecture/) · Artera engineering · SSE gateways fed by Redis, with a reconnect carrying `Last-Event-ID` replayed from a per-user Redis stream, a long-polling fallback and server-side closes every 10 to 15 minutes to rebalance (*read*) · covers our angle: **partial** · 2025-08-15 · fetched 2026-10-14
- **Our delta:** our page covers the three mechanisms, connections per node, routing to the node, resume with `Last-Event-ID` or a cursor, and the reconnection storm; authenticating the WebSocket upgrade and the newer transports are the extra.

### T11-12 · Streaming responses — Understand · 🔲 not written
- **Read this:** [Transfer-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding) · MDN · `chunked` splits a message body into chunks, as in `gzip, chunked` (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Backpressuring in Streams](https://nodejs.org/learn/modules/backpressuring-in-streams) · Node.js · a Readable stream that respects backpressure checks the return value of `this.push()` (*read*) · covers our angle: **full** for the Node mechanism · fetched 2026-10-14
- **Also good:** [Streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming) · Claude API docs · `"stream": true` returns the response incrementally as server-sent events (*read*) · fetched 2026-10-14
- **Our delta:** backpressure toward a slow client, with the AI use in Part 10.

### T11-13 · Internal vs public APIs — Understand · 🔲 not written
- **Read this:** [Hyrum's Law](https://www.hyrumslaw.com/) · Hyrum Wright · with enough users of an API, all observable behaviours will be depended on by somebody, whatever the contract promises; the step to "an internal endpoint with users is a public one" is ours (*read*) · covers our angle: **partial** — why internal APIs become public by accident · fetched 2026-10-14
- **Our delta:** different stability, authentication and versioning rules for each audience.

### T11-14 · Security at the contract level — Understand · 🔲 not written
- **Read this:** [Broken Object Property Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/) · OWASP API Security Top 10 (2023) · merges excessive data exposure and mass assignment under missing authorization at the object property level (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) · OWASP · manipulating an object ID in the request is the attack, and a check belongs in every function that uses one (*read*) · fetched 2026-10-14
- **Also good:** [Authorization](https://graphql.org/learn/authorization/) · graphql.org · delegate authorization to the business logic layer rather than the resolvers, so every entry point shares one rule; an `@auth` directive is shown only as an option that still delegates (*read*) · fetched 2026-10-14
- **Our delta:** validation generated from the schema and authorization per field and resolver; continues in Part 9.

### T11-15 · Typing the contract across the stack — Understand · 🔲 not written
- **Read this:** [Zod](https://zod.dev/) · Zod · a TypeScript-first validation library with type inference from schemas (*read*) · covers our angle: **partial** — the single source, not the generated spec or client · fetched 2026-10-14
- **Also good:** [Zod OpenAPI Hono](https://hono.dev/examples/zod-openapi) · Hono docs · Zod schemas that validate requests and generate the OpenAPI document (*read*) · fetched 2026-10-14
- **Also good:** [openapi-typescript](https://openapi-ts.dev/) · openapi-ts · static TypeScript types from an OpenAPI description with zero runtime cost (*read*) · fetched 2026-10-14
- **Our delta:** schemas as the single source, a shared types package and a typed client, tied to the storefront's TypeScript phase.

### T11-16 · Describing event contracts — Know · 🔲 not written
- **Read this:** [AsyncAPI Specification 3.0.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0) · AsyncAPI · describes message-driven APIs in a machine-readable, protocol-agnostic format (AMQP, MQTT, WebSockets, Kafka and others) (*read*) · covers our angle: **full** for the idea · fetched 2026-10-14
- **Our delta:** doing for topics and messages what OpenAPI does for HTTP.

### T11-17 · Mocks and sandboxes — Know · 🔲 not written
- **Read this:** [Prism](https://stoplight.io/open-source/prism) · Stoplight · an open-source mock server generated from OpenAPI documents so frontend work need not wait for the backend (*read*) · covers our angle: **partial** — the frontend mock, not drift · fetched 2026-10-14
- **Also good:** [Testing use cases](https://docs.stripe.com/testing-use-cases) · Stripe Documentation · a sandbox simulates real objects without moving real money (*read*) · covers our angle: **partial** — a partner sandbox in production · fetched 2026-10-14
- **Also good:** [WireMock](https://wiremock.org/docs/) · WireMock · an open-source API mocking tool with record-and-playback and fault and latency injection (*read*) · fetched 2026-10-14
- **Our delta:** the mock that quietly drifted from production, and mocks for partners as well as for the frontend.
