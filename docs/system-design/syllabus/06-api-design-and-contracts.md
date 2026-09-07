---
title: "Part 6 — API design and contracts"
sidebar_label: "6 · API design"
sidebar_position: 6
---

> Phases 10–11 · The contract between systems: REST done properly, the alternatives and when each wins, and the tests that keep a contract honest

An API is the only part of a design that other teams and other companies build against, so a
wrong one is the most expensive mistake to fix. Senior interviews probe it directly ("design
the API for this") and indirectly (a bad API sketch in the first ten minutes derails the whole
design). The Express mechanics — validation, the error handler, webhooks — are in the
[Express track](../../expressjs/README.md) and the storefront's
[API phase](../../real-world/pages/phase-3-express-api/README.md); this part is the design
layer: shapes, guarantees, evolution and the decision between styles.

---

## Phase 10 — REST done properly

Most APIs are "REST" in name only. This phase is what the word should mean in a design: HTTP
semantics used as the contract, idempotency where money moves, pagination that does not
shift under the user, evolution without breaking anyone.

| Topic | Tier |
|---|---|
| **Resources, not actions** — nouns and hierarchy, the action that is really a resource (a cancellation, a refund), and the honest RPC-style endpoint when no noun fits | <span className="db-tier t-master">Master</span> |
| **HTTP semantics as the contract** — methods and their safety and idempotency, the status codes that carry meaning (created, accepted, not modified, conflict, precondition failed, unprocessable, too many requests) and the ones that lie | <span className="db-tier t-master">Master</span> |
| **Idempotency keys** — on every call that charges or creates; key scope and lifetime, storing the first response, the concurrent duplicate that arrives before the first finishes | <span className="db-tier t-master">Master</span> |
| **Pagination** — offset vs keyset vs opaque cursor, stable sort keys, the cost of total counts, the page that shifted because a row was inserted | <span className="db-tier t-master">Master</span> |
| **The error contract** — a problem-details-style body, stable machine-readable codes, field-level errors, never leaking internals; one shape for every failure | <span className="db-tier t-master">Master</span> |
| **Versioning and evolution** — path vs header vs evolve-only additive change, deprecation and sunset signals, running two versions at once; the version bump you never needed | <span className="db-tier t-master">Master</span> |
| **Conditional requests** — entity tags, `If-Match` for optimistic concurrency, `If-None-Match` and `Cache-Control` for cheap reads; the lost update an entity tag prevented | <span className="db-tier t-master">Master</span> |
| **Backward compatibility rules** — what is additive, what breaks a client (renames, type changes, tightened validation), tolerant readers, the field you can never remove | <span className="db-tier t-master">Master</span> |
| **Webhooks as an API you publish** — signed payloads, timestamps against replay, retries with backoff, idempotent receivers, typed and versioned events, a dashboard for failed deliveries | <span className="db-tier t-master">Master</span> |
| **Filtering, sorting and sparse fields** — a query grammar with allow-lists, the index each filter needs, the "everything is optional" endpoint that no index can serve | <span className="db-tier t-understand">Understand</span> |
| **Rate limiting as a contract** — the 429 response, retry-after, rate-limit headers, quotas per key; enforcement lives in [Part 2](02-the-network-path-and-caching.md) | <span className="db-tier t-understand">Understand</span> |
| **Bulk and batch endpoints** — partial success, per-item status, size limits, atomic vs best-effort semantics stated up front | <span className="db-tier t-understand">Understand</span> |
| **Long-running operations** — accepted-then-poll with a status resource, callbacks, server-sent progress, cancellation | <span className="db-tier t-understand">Understand</span> |
| **OpenAPI in practice** — design-first vs generated from the validation schemas (this stack's choice), linting and style rules, generated clients and mocks | <span className="db-tier t-understand">Understand</span> |
| **Authentication at the boundary** — bearer tokens, API keys, scopes; where authentication is enforced and where authorization is decided; continues in [Part 9](09-security-and-compliance.md) | <span className="db-tier t-understand">Understand</span> |
| **The storefront's public API** — catalogue, cart, checkout, orders and partner webhooks with every decision above applied and justified | <span className="db-tier t-understand">Understand</span> |
| **API governance** — a style guide, review, ownership, an internal catalogue; what a platform team enforces and what it leaves to teams | <span className="db-tier t-know">Know</span> |
| **Documentation as product** — reference vs guides, examples that actually run, changelogs; the doc page that is the real onboarding | <span className="db-tier t-know">Know</span> |
| **The maturity model and hypermedia** — what the top level buys, why almost nobody ships it, the parts worth keeping (links for pagination and next actions) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's checkout and orders API as an OpenAPI sketch: the
idempotency key, the pagination contract, the error shape, one deprecation plan and one
webhook — each with the failure it prevents written beside it.

---

## Phase 11 — GraphQL, gRPC, tRPC, realtime and contracts

The alternatives to REST each solve a real problem and create a different one. This phase is
knowing which problem you have — many client screens, service-to-service throughput, one
TypeScript monorepo, a live feed — and defending the pick, plus the testing that keeps any
contract from drifting.

| Topic | Tier |
|---|---|
| **GraphQL schema design** — types, connections, nullability as a promise you keep, input types, mutations named as actions; the schema as the whole contract | <span className="db-tier t-master">Master</span> |
| **Resolvers, N+1 and DataLoader** — per-request batching and caching, the resolver tree that issued four hundred queries for one screen | <span className="db-tier t-master">Master</span> |
| **GraphQL vs REST, honestly** — where client-driven shapes win (many screens, mobile bandwidth) and what they cost (caching, per-field authorization, complexity limits, tooling) | <span className="db-tier t-master">Master</span> |
| **gRPC and Protobuf** — services, unary and streaming calls, deadlines and cancellation, the error model, balancing long-lived connections, the browser path; inside the datacentre first | <span className="db-tier t-master">Master</span> |
| **The decision table** — REST vs GraphQL vs gRPC vs tRPC by consumer, team, performance and evolution needs; the mix most companies actually run | <span className="db-tier t-master">Master</span> |
| **Contract testing** — consumer-driven contracts, provider verification in the pipeline, against end-to-end tests; the deploy a contract test would have stopped | <span className="db-tier t-master">Master</span> |
| **GraphQL at scale** — persisted queries, depth and complexity limits, cost-based rate limiting, caching strategies, federation into one graph | <span className="db-tier t-understand">Understand</span> |
| **Protobuf schema evolution** — field numbers, reserved fields, unknown-field handling, the compatibility rules that make rolling deploys safe | <span className="db-tier t-understand">Understand</span> |
| **tRPC** — end-to-end types between React and Node in one repository; what it removes (code generation) and what it rules out (non-TypeScript clients, a public API) | <span className="db-tier t-understand">Understand</span> |
| **Backend-for-frontend and aggregation** — one BFF per client type, aggregating without growing a second monolith, who owns it | <span className="db-tier t-understand">Understand</span> |
| **Realtime APIs** — WebSocket, server-sent events, long polling, and the newer transports; authentication on upgrade, scaling connections, resuming a stream after a drop | <span className="db-tier t-understand">Understand</span> |
| **Streaming responses** — chunked HTTP, server-sent events for token-by-token output, server streaming in gRPC; backpressure toward a slow client; used in [Part 10](10-ai-systems-design.md) | <span className="db-tier t-understand">Understand</span> |
| **Internal vs public APIs** — different stability, authentication and versioning rules; the internal endpoint that became public by accident | <span className="db-tier t-understand">Understand</span> |
| **Security at the contract level** — validation generated from the schema, authorization per field and resolver, mass assignment, object-level authorization; continues in [Part 9](09-security-and-compliance.md) | <span className="db-tier t-understand">Understand</span> |
| **Typing the contract across the stack** — validation schemas as the single source, generated OpenAPI, a shared types package, a typed client; the storefront's [TypeScript phase](../../real-world/pages/phase-6-typescript/README.md) | <span className="db-tier t-understand">Understand</span> |
| **Describing event contracts** — the AsyncAPI idea: doing for topics and messages what OpenAPI does for HTTP | <span className="db-tier t-know">Know</span> |
| **Mocks and sandboxes** — for partners and for frontend development; the mock that quietly drifted from production | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can argue, for the storefront, gRPC between services, REST for
partners and a GraphQL or BFF layer for the mobile app — or argue against that split — with
a cost named for every choice, and describe the contract test that guards each boundary.

---

{/* NAV */}
