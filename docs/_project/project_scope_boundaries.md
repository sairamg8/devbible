---
name: devbible-scope-boundaries
description: Where each technology's syllabus stops — especially the Node/Express line and what stays project-based
metadata:
  type: project
---

Decided 2026-08-09 while revising the Node.js syllabus for [[devbible-brief]]. Each
technology syllabus covers **its own layer only**; nothing absorbs a neighbour.

## Node stops before the framework

**Nobody builds an API on raw `node:http`** — the user's own framing, and it settles the
line. Node teaches `node:http` for exactly one reason: so Express is not magic and can
be debugged. API *design* is Express's job.

**Express picks up:** REST resource modeling · middleware architecture · request
lifecycle · controller/service/repository wiring · status code design · response and
error-body contracts · pagination · filtering, sorting, searching · API versioning ·
idempotency keys · ETags and conditional requests · `Cache-Control` · multipart uploads ·
OpenAPI · webhook delivery and verification · route-level authorization (RBAC,
ownership checks).

This list is written into the Node syllabus under "Where this connects → Deliberately
not here", so the handoff is explicit rather than a silent gap.

## What stays in Node

Framework-free primitives: timeouts and timeout budgets, deadline propagation via
`AbortSignal`, retry safety, exponential backoff and jitter, concurrency limiting,
background jobs, worker processes, job idempotency, graceful worker shutdown. These are
plain functions and separate processes — no framework involved — so they belong to the
runtime.

## What is project-based, not syllabus material

Circuit breakers, bulkheads, load shedding, delivery guarantees (at-least-once /
exactly-once), and application-architecture layering. Learned against a real build, not
from a topic list.

## Parked — beyond the committed eleven

Added 2026-08-09. **Git · GraphQL · tRPC · Kubernetes** are named on the homepage under
"Beyond the core stack" with a `Someday` pill, dashed and unfilled so they never read as
scheduled work. They are **not** among the eleven in `instructions.md` §2 and get no
content until all eleven are done. Recorded in the brief's §2 so the file stays the
source of truth on scope.

GraphQL, tRPC and Kubernetes come from the Node review's §4.3 "things not to add" — the
point of carding them is to have somewhere to put them *other than* the Node syllabus.

## Same rule elsewhere

Data access in Node covers **Node-side concerns only** — pooling, transactions,
cursors, N+1, migration execution. Query planners, MVCC, indexes, aggregation,
replication and sharding belong to the PostgreSQL and MongoDB syllabi. Queue
*mechanics* belong to Redis; the Node side is the producer/consumer shape.

### The two Phase 6 rows that straddle the Node/Express line — settled 2026-08-10

**Transaction propagation through service layers** and the **repository pattern**
both look like they could go either way. **Both stay in Node, whole.** A first
proposal to *split* each row — Node keeps the mechanism, Express keeps the wiring
— was rejected: this rule says *pick the layer*, and splitting one concept across
two syllabi leaves a reader holding half an answer in each place, which is worse
than either choice on its own.

Why Node wins both:

1. **Phase 7 depends on transactions and has no Express in it.** The transactional
   outbox row is "write the job into the same transaction". Put transactions in
   Express and Phase 7 cannot be written.
2. Jobs, migrations and workers all need both concepts and none of them are HTTP.
3. Express is technology #8 of eleven and Node is being written now — deferring
   leaves the hole open for a long time.

**Express later covers only the genuinely Express part** — the middleware that
begins and commits a transaction per request — and links back to the Node page
rather than re-explaining.

**One narrowing on the repository row:** keep it to *why driver types must not
leak upward* (business logic stays testable without a database), **not** a
layering tour. This same file already calls application-architecture layering
project-based rather than syllabus material, so the wiring stays out.

**Why:** Without this rule the first syllabus written absorbs everything and the
later ones have nothing left, which is how a reference turns into an encyclopedia.

**How to apply:** When a topic could sit in two syllabi, ask which layer you would be
working in when you need it. Name the handoff explicitly in a "Where this connects"
section rather than dropping it.
