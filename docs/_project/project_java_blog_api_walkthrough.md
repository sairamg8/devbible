---
name: project-java-blog-api-walkthrough
description: DESIGN (awaiting approval) — the Java/Spring Boot blog API walkthrough, a build-it-piece-by-piece capstone showing how a backend REST API is actually constructed. 24 chapters, the decisions each one turns on, and how it differs from the phase corpus.
metadata:
  type: project
---

# Java · The blog API walkthrough — DESIGN, awaiting approval

**User instruction, 2026-09-01:**

> *"i want a complete piece by explanation of real world reset API example project based like
> creating a simple blog based application to demonstrate how to build backend APIs"*

Stack decided the same day by the user: **Java + Spring Boot** (not Node/Express), and
**blog first, the storefront addon stays queued** — see
[[project-realworld-addon-syllabus-design]], which is NOT superseded, only deferred behind this.

## What makes this different from phases 0–16, and why it is worth building

The phase corpus is **organised by mechanism** — here is `@Transactional`, here is `MockMvc`,
here is the N+1 problem. That is the right shape for a reference and the wrong shape for the
question *"I have to build an API on Monday, what do I actually type, in what order, and why?"*

This track is **organised by construction order**. One application, built front to back, each
chapter adding the next piece and **naming the decision it turned on** before showing the code.
It links back to the phase that owns each mechanism instead of re-teaching it — the same
reuse-don't-re-teach contract as phase 11 topic 12.

⛔ **It must not become a tutorial.** The distinguishing content is the decisions and the things
that go wrong: why a DTO and not the entity, why keyset and not offset, what breaks the first
time two people publish the same slug. A chapter that only shows working code has failed.

## The application

A blog API: authors, posts with a draft → published lifecycle, comments, tags, search, cover
images, and roles (reader / author / editor). Chosen over the storefront because checkout, stock
and payment are where a construction walkthrough drowns in domain rules that teach nothing about
API building. **A blog is small enough to hold in your head and still has every real problem in
it:** ownership, concurrent edits, a public read path that must be fast, a write path that must
be correct, uploads, and a state machine.

## Placement

- Syllabus: `docs/java/syllabus/06-real-world-blog-api.md` (parts 01–05 exist).
- Pages: `docs/java/pages/phase-17-blog-api/` (phases 0–16 exist).
- Standard page contract throughout: tier badges, `> Verified:` lines, 300-line cap → chunk
  directories, gotchas, interview questions, `{/* FOOTER */}`.
- ⚠️ **No sandbox on this machine.** The code is written and documentation-validated; there are
  **no console blocks, no timings and no test output**. A walkthrough is the strongest temptation
  yet to invent a terminal transcript — it must be resisted in every chapter.

## The chapters (a PLAN, not a budget)

| # | Chapter | The decision it turns on |
|---|---|---|
| 1 | What we are building, and what we are deliberately not | Scope, the API surface, the non-goals — written before any code |
| 2 | Project setup and the shape of the package tree | Feature-sliced vs layered, and why the answer changes at ~20 endpoints |
| 3 | The domain model and the first migration | Schema before entities; Flyway from commit one |
| 4 | One endpoint end to end: `POST /posts` | The full vertical slice — the smallest thing that proves the architecture |
| 5 | Request and response contracts | DTOs vs entities, records, hand-mapping vs MapStruct, Jackson configuration |
| 6 | Validation and the error contract | Bean Validation, `@ControllerAdvice`, **RFC 9457 Problem Details** |
| 7 | The read path: `GET /posts` | Filtering, sorting, and **keyset vs offset pagination** — the decision that ages worst |
| 8 | Comments and tags: the relationships | N+1, fetch joins, projections; when a nested resource earns its own endpoint |
| 9 | The publish lifecycle | Draft → published as a state machine, optimistic locking, idempotent publish |
| 10 | Slugs and uniqueness | The concurrency case nobody tests, and what the database has to enforce |
| 11 | Search over posts | Full-text in PostgreSQL vs reaching for a search engine too early |
| 12 | Authentication | Issuing your own tokens vs an authorization server — links to phase 13 |
| 13 | Authorization: who may edit whose post | Method security, ownership checks, and why a role check is not an ownership check |
| 14 | Cover images: upload and serve | Streaming, limits, cleanup on every path, and never trusting a filename |
| 15 | Caching the read path | What to cache, and the invalidation that publish must trigger |
| 16 | Async and scheduled work | Publish notifications, a digest job, the outbox pattern for correctness |
| 17 | Testing this codebase | The pyramid applied to *this* app — links to phase 11, especially topic 12 |
| 18 | Observability | Structured logs, Actuator, the four metrics worth having, tracing |
| 19 | Configuration, profiles and secrets | The twelve-factor points that are real and the ones that are cargo cult |
| 20 | Packaging and running it | Layered jars, a container image, health vs readiness |
| 21 | The performance pass | How to measure before changing; what was actually slow |
| 22 | Splitting it into two services | What breaks the moment it is over a network — links to phase 14 |
| 23 | The API design review | REST maturity, versioning, what I would change knowing what I know now |
| 24 | The checklist | Given a new endpoint on Monday, here is what you write and in what order |

## Ordering against the phase work

The user's 2026-09-01 priority is **phase 14 next** (see [[java-board]]). Chapters 22 and 17 lean
on phases 14 and 11 respectively, so the natural order is: **close phase 11 → phase 14 → this
track**. It is independently claimable if the user wants it sooner; chapters 1–21 do not depend
on phase 14.

## Open questions for the user

1. **Persistence:** Spring Data JPA (matches phase 10's centre of gravity), or raw SQL / jOOQ to
   mirror the eKommerce house style of no ORM?
2. **Auth in chapter 12:** issue tokens in-app (self-contained, teaches JWT end to end), or stand
   up Keycloak (honest, matches phase 13's *"buy, don't build the AS"* argument, needs Docker —
   which this machine does not have)?
3. **Depth:** 24 chapters at the corpus's usual depth is roughly 150–200 files. Confirm that is
   the intent rather than a shorter, thinner walkthrough.
