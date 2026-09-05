---
title: "Acceptance is not \"it works\" — every failure this chapter names is silent, so the deliverable is a piece of evidence per seam that would fail loudly if the seam reopened, plus one naming conflict the chapter leaves you to resolve before you ship"
sidebar_label: "13d · Milestone: acceptance"
sidebar_position: 93
description: "Fifteen acceptance questions you must answer without opening anything, the evidence that counts for each seam and the evidence that does not, the one vocabulary conflict this chapter leaves open, what topics 12 and 13 take over, what chapter 17 owns, and what this chapter deliberately did not solve."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified in topics [01](01-the-resource-contract.md) through [11](11-ownership-on-the-api-surface.md) of this chapter. **It introduces no new claims of its own.** The one open item it records — three different names for the same error vocabulary across [04](04-the-data-access-layer.md), [05ca](05ca-mapping-sqlstate-to-status-codes.md) and [10](10-errors-and-one-response-shape.md) — was found by reading those pages, and is reported here rather than silently reconciled.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · **PostgreSQL 18.4** · React 19.2.8 · Node 24.20.0.

**Every failure in this chapter is silent. Not "hard to find" — silent: a lost update is two `200`s, a soft-delete leak is a `200` with extra rows, an unenforced Data Access Layer is a codebase that compiles, an unused partial index is a query that returns the right answer, a duplicate from a retried `POST` is a `201`, and connection exhaustion is latency right up until it is an outage. That property makes "we tested it and it worked" worthless as acceptance, because the passing state and the broken state produce the same observations. The acceptance criterion for this milestone is therefore not a demo. It is, per seam, one artefact that would *fail loudly* if the seam reopened — and this page is the list, followed by the parts of the build this chapter deliberately hands to somebody else.**

## The fifteen questions

Answer these without opening anything. If you have to look one up, that seam is not closed — it is unobserved.

1. How many Postgres connections does a peak deploy of this API open, what are the two terms in that product, and which one do you control?
2. Which connection string does the application use, which does `drizzle-kit` use, and what breaks if you swap them?
3. Name three things that stop working behind a transaction-mode pooler, and say why none of them errors.
4. What, at deploy time, proves the running database matches `db/schema.ts` — and what happens to the deploy if it does not?
5. Your migration is one `ALTER TABLE` that takes a millisecond. Why can it still cause a ten-minute outage, and what setting prevents that?
6. During a deploy, two versions of your code are live. Which migrations are safe in that window and which are not?
7. Which mechanism stops a Route Handler from writing its own query — and why is `import 'server-only'` not it?
8. Where is the ownership predicate, and what would a new entry point have to do to route around it?
9. A `PATCH` affects zero rows. Name the four things that could mean and the status code each one produces.
10. A client sent `If-Match` and lost the race. What code, and how is that different from the code you send a client who sent nothing?
11. Two cards are created on one board in the same instant. What stops them landing on the same `position`, and why is `INSERT … SELECT max(position) + 1024` not the answer?
12. A `POST` was retried after a timeout. What makes the second one return the first one's card instead of creating a second — and why can the replay path not use `RETURNING`?
13. Your retry loop for `40001` is running during an incident. What resource is it competing for, and with whom?
14. You added a partial index on `WHERE deleted_at IS NULL` and plans ignore it. What did you write?
15. Your `ETag` implementation is correct and no client ever sends `If-None-Match`. Which header did you choose, and which one did you mean?

Every one of those is a failure this chapter names, and not one of them is detectable by reading your own route files.

## What counts as evidence, per seam

The pattern is the same each time: **turn the invariant into something that has a failure mode.** A rule with no failure mode is a preference.

| Seam | Evidence that counts | Evidence that does not |
|---|---|---|
| Connection arithmetic ([03b](03b-the-arithmetic-and-the-three-escapes.md)) | An explicit `max` you computed, plus the pooled/direct split as two named env vars asserted at boot | "It has been fine so far" |
| Hot-reload leak ([03c](03c-the-dev-hot-reload-leak.md)) | The `globalThis` stash present in `lib/dal/db.ts` | A restart habit |
| Pooler compatibility ([03d](03d-what-does-not-survive-the-pooler.md)) | A grep for `pg_advisory_lock`, `SET`, `PREPARE`, `LISTEN` outside an explicit transaction | Working in `next dev` |
| Migration applied ([02c](02c-the-migration-is-a-release-step.md)) | A release step that reads the ledger and **fails the deploy** on a pending migration | A migration run by hand |
| Migration lock ([02d](02d-the-lock-a-migration-actually-takes.md)) | `lock_timeout` set in the migration session | A short statement |
| Expand/contract ([02e](02e-expand-and-contract.md)) | A review rule that no release contains both an additive and a destructive change | A careful author |
| The DAL boundary ([04b](04b-what-server-only-does-not-protect.md)) | `no-restricted-imports` failing CI on `pg`, `@/lib/dal/db` and `@/db/schema` | `import 'server-only'` |
| The predicate ([04c](04c-the-ownership-predicate.md)) | A test per route asserting a non-member receives `404`, and a grep proving no DAL query builds a `WHERE` without it | A code review |
| Lost update ([07d](07d-optimistic-concurrency-with-a-version-column.md)) | A test that interleaves two writes with a stale version and asserts the second is rejected | Two browser tabs, once |
| 412 vs 409 ([07e](07e-etag-if-match-and-412.md)) | Two tests: one sending `If-Match`, one not, asserting different codes | A comment in the handler |
| Position collisions ([05ea](05ea-the-position-value-and-concurrent-creates.md)) | The partial unique index existing in a migration, plus a constraint-keyed bounded retry | A wider gap constant |
| Idempotent `POST` ([05d](05d-idempotency-keys-for-a-retried-post.md)) | A test replaying an identical request with the same key and asserting one row and the original status | A disabled submit button |
| Soft-delete predicate ([08b](08b-what-soft-delete-costs-every-read.md)) | The predicate enforced structurally — DAL, view or RLS — plus a test that a deleted card is absent from list, item, count and export | Every query being written carefully |
| Partial index used ([08b](08b-what-soft-delete-costs-every-read.md)) | A literal `deleted_at IS NULL` in the query text, and the admin view as a separate query | The index existing |
| Retry loop ([09d](09d-serialization-failures-and-the-retry-loop.md)) | A bounded attempt count, an allow-list of SQLSTATEs, and nothing non-transactional in the body | A `try`/`catch` |
| Transaction duration ([09f](09f-transaction-duration-as-pool-occupancy.md)) | A rule and a grep: no `fetch` inside a `db.transaction` callback | A fast integration |
| `tx` vs `db` ([09b](09b-the-tx-rule.md)) | A lint rule or a review checklist — types cannot catch it | Reading carefully |
| No driver leak ([10b](10b-never-leak-a-driver-error.md)) | Every exported HTTP method routes its `catch` through `toHttpResponse`, checked by grep; plus a test asserting no `constraint`, `detail` or `table` key in any error body | A `try`/`catch` per route |
| Drizzle `cause` unwrap ([05c](05c-constraint-violations-and-sqlstate.md)) | An exact pinned `drizzle-orm` version and a test asserting on the **wrapper shape**, not on a mock of your helper | The mapper looking right |

🔴 **Two rows in that table say "types cannot catch it".** The `tx`/`db` confusion and the missing `catch` are both invisible to TypeScript, which is why they need a grep or a lint rule rather than a stricter compiler setting. Knowing which of your invariants the type system can carry and which it cannot is itself part of the milestone.

## One thing to reconcile before you ship

⚠️ **This chapter names the same idea three times, in three shapes, and you have to choose one.** It is recorded here rather than papered over, because a reader assembling the code will hit it in the first hour:

- [04](04-the-data-access-layer.md) uses a **closed set of error classes** — `Unauthorized`, `NotFound`, `DomainInvalid`, `Conflict`, `VersionConflict`, `Retryable` — mapped to status codes by a lookup on the constructor.
- [05ca](05ca-mapping-sqlstate-to-status-codes.md) uses **one class carrying a status** — `DomainError(status, code, message, field)` — produced by `toDomainError` from a SQLSTATE.
- [10](10-errors-and-one-response-shape.md) uses **one class carrying a kind** — `ApiFailure(kind, publicMessage, details, cause)` — with `toHttpResponse` and `toActionResult` as the two renderings.

They are three encodings of one design and the arguments do not conflict: the vocabulary is closed, the DAL never names a transport, and each entry point renders. **Pick the third.** `ApiFailure` carries a `kind` rather than a status, which is the property the whole split depends on — a class carrying `status: 409` has already decided that HTTP is the caller, which is exactly what [10](10-errors-and-one-response-shape.md) argues against. Then let `toDomainError` from [05ca](05ca-mapping-sqlstate-to-status-codes.md) return an `ApiFailure` instead of its own class, and treat [04](04-the-data-access-layer.md)'s six classes as the enumeration of `FailureKind` values rather than as six types.

I am recording this as an inconsistency in the chapter's naming and **not** as a defect in any of the three arguments, because each page's reasoning is sound on its own terms and none of them contradicts another about behaviour.

## What this milestone hands to somebody else

**Testing.** Half the evidence table above is the word "a test", and this chapter deliberately does not own the runner, the fixtures, the seed or the reset story. What is worth asserting at the HTTP boundary versus in the DAL belongs to [topic 12 · Testing the API](12-testing-the-api.md), and the runner, the CI gate and the Playwright flows belong to [ch13](../13-testing-and-developer-experience/01-explanation.md) — whose own milestone, [the SprintDesk test suite](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md), is the other half of this one.

🔴 **The concurrency seams are the ones the test story has to be designed around**, because a test that exercises a lost update has to interleave two writes deliberately rather than hope. If your suite cannot express *"read here, write there, then write here"*, seams 4, 5 and 7 have no evidence at all and the table above is aspirational.

**Deployment.** "Deployed" is a real word with real content and it is [ch17](../17-deployment-scaling-and-observability/01-explanation.md)'s, not this chapter's. The instance count in seam 1 is a platform property; the release step in seam 2 is a pipeline; the observability that would let you *notice* a retry storm is instrumentation. [ch17's milestone](../17-deployment-scaling-and-observability/06-project-milestone-sprintdesk-deployed-twice.md) deploys this same application twice, on two targets, which is the only honest way to find out which of your assumptions were about the framework and which were about one vendor.

**The parts that came before.** Who the caller *is* — sessions, passwords, CSRF — is [ch10](../10-forms-authentication-and-security-hardening/01-explanation.md); this chapter only ever asked what an already-identified caller may touch. The driver and pooling *choice* is [ch15](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md); this chapter picked one and lived with the consequences. And the error envelope's *shape* is [ch7's](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md); this chapter only added the second rendering.

## What this chapter deliberately did not solve

Naming the gaps is part of the deliverable, because an unnamed gap is indistinguishable from an oversight:

- **Real-time.** Nothing here pushes a card change to another user's open board. That is SSE and it is [ch15](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md)'s milestone.
- **Multi-tenancy beyond one predicate.** The ownership check is per-row and per-caller. Isolation across paying customers — schema-per-tenant, RLS as the primary mechanism, noisy-neighbour limits — is a different design.
- **Audit history.** The schema records `updatedAt` and `version`, not *what changed*. A card's edit history is another table and another set of transactional guarantees.
- **Search.** `title` and `body` are `text` with no full-text index. Query planning and full-text search belong to the `postgresql` track.
- **Bulk operations.** Every route here handles one card, or a page of them. A bulk reorder or a bulk import interacts with the position scheme and the unique index in ways [05ea](05ea-the-position-value-and-concurrent-creates.md) flags and no page here works through.
- **Rate limiting.** `rate_limited` is a `FailureKind` in the vocabulary and nothing in this chapter produces one.

## The phase gate

You are done with this chapter when you can take a resource nobody has modelled yet and ship an API for it that survives two clients writing the same row in the same second — and can say, for each verb, which status code that collision produces and why. That is the chapter index's own gate, and the fifteen questions above are how you check it against this build rather than against a memory of reading it.

## What I could not confirm

Two items on this page are stated as uncertain rather than asserted, because no primary source settles them:

- **Whether the `drizzle-orm` wrapper shape survives a version bump.** [05c](05c-constraint-violations-and-sqlstate.md) established that a failing query throws `DrizzleQueryError` with the `pg` `DatabaseError` on `cause` by reading the shipped source for **0.45.2** specifically, and notes that nothing in the Drizzle documentation states it. So "walk the `cause` chain" is correct for the pinned version and is **not** a contract. Treat the exact pin and the wrapper-shape test as part of the evidence, not as belt-and-braces.
- **The mechanism the test suite should use to interleave two writes.** The evidence table names the *requirement* — two logical clients with independent state — and deliberately does not name a tool, because [topic 12 · Testing the API](12-testing-the-api.md) owns that decision and [ch13](../13-testing-and-developer-experience/01-explanation.md) owns the runner. The rows in that table reading "a test" should be re-pointed at topic 12's chunks as they land.

## Gotchas

**★ Symptom: acceptance was a demo, everything worked, and three of the seams are open.** Cause: every failure in this chapter produces the same observations as the working system. Fix: acceptance is per-seam evidence with a failure mode — the table above — not a walkthrough. A demo can only ever show you the happy path, which is the path none of these bugs is on.

**★ Symptom: the DAL boundary is documented in the README and violated in four files.** Cause: a convention was written down instead of being made to fail. Fix: the lint rule in CI. Any invariant whose only enforcement is a document degrades at exactly the rate the team grows.

**★ Symptom: the test suite is green and cannot express any of the concurrency seams.** Cause: the suite was designed around request/response, and every seam in [13b](13b-milestone-the-overlap-seams.md) needs two interleaved requests. Fix: design for the interleaving first — read here, write there, then write here — and treat the arrangement as part of the test infrastructure rather than as a per-test trick.

**★ Symptom: the API is "done" and there is no way to know a retry storm is happening.** Cause: correctness was instrumented and behaviour was not. Fix: this is [ch17](../17-deployment-scaling-and-observability/01-explanation.md)'s material, and the hand-off should be explicit: name the counters this chapter's fixes make meaningful — `40001` retries, `412` responses, idempotency replays, `23505` on the position constraint — so somebody knows what to graph.

**★ Symptom: three different error classes exist in the codebase and each entry point maps a different one.** Cause: the three encodings in [04](04-the-data-access-layer.md), [05ca](05ca-mapping-sqlstate-to-status-codes.md) and [10](10-errors-and-one-response-shape.md) were each adopted where they were first read. Fix: the reconciliation above — one class carrying a `kind`, two rendering functions, and `toDomainError` producing that class rather than its own.

**★ Symptom: a reviewer asks why the API returns `404` for a card the user can see in a screenshot.** Cause: the disclosure decision is correct and undocumented, so it reads as a bug every time somebody new meets it. Fix: put it in the contract next to the route table, with the reason. A deliberate decision that is not written down will be "fixed" by the next person.

**★ Symptom: a gap in the API is treated as an oversight in a design review.** Cause: the things this chapter did not solve were never listed. Fix: the section above. Naming real-time, audit history, bulk operations and rate limiting as out of scope converts each of them from a defect into a decision with a successor.

**★ Symptom: nothing asserts the deployed schema matches the code, and the deploy is green.** Cause: the migration ran as a side effect rather than as a gate. Fix: read the ledger in the release step and fail the deploy on a pending migration. A green deploy that did not check is not evidence of anything — it is the absence of a question.

**★ Symptom: the version pins drifted and every constraint violation became a `500` again.** Cause: `drizzle-orm`'s wrapper shape is not a documented contract, and a caret range picked up a new minor. Fix: pin the exact version, and put the `cause`-chain unwrap behind a test that asserts on the real wrapper rather than on a mock — a mock of your own helper proves only that your helper calls itself.

**★ Symptom: two people give different answers to question 9 and both work on the same codebase.** Cause: the four meanings of zero affected rows were never written down, so each entry point's author reasoned it out separately. Fix: one `explainZeroRows` helper in the DAL, so the mapping exists once and is the thing both people would have to read.

## Interview questions

**★ Why is "we shipped it and nothing broke" not an acceptance criterion for this API?**
Because for every failure in this chapter, the broken state and the working state produce identical observations. A lost update is two `200`s and a satisfied client. A soft-delete leak is a `200` with extra rows in it. An unenforced Data Access Layer compiles, deploys and serves. A partial index that the planner ignores still returns correct answers. A duplicate from a retried `POST` is a `201`. There is no log line, no alert and no failed request in any of them, so "nothing broke" is a statement about your monitoring, not about your system. Acceptance has to be a piece of evidence per seam that would fail loudly if the seam reopened — a lint rule, a gated release step, an interleaved test, a header assertion — because that is the only thing that converts silence into signal.

**★ Which of this chapter's invariants can the type system carry, and which cannot?**
Types carry the shape of the DTO, the closed set of failure kinds, and the difference between a partial and a full update payload — that last one being why `undefined` and `null` mean different things in a `PATCH`. Types carry nothing at all for four of the most expensive defects: `db` versus `tx` inside a transaction callback, because both objects have the same methods and the same types; a Route Handler importing the driver, because that is a valid server-to-server import; a route with no `catch`, because nothing requires one; and a partial index that the planner declines, because that is a runtime planning decision about SQL text. Those four need lint rules, greps and tests. Knowing the split matters because the instinct when a bug is invisible is to reach for a stricter compiler, and for half of these there is no setting that helps.

**★ Why does the ownership predicate need a test per route rather than one test?**
Because the guarantee it provides is topological, not local. The predicate itself is one `EXISTS` fragment and is trivially correct; what you are actually asserting is that every route reaches the database only through functions that use it, and that assertion is about six independent code paths. A single test proves one path. The failure mode you are guarding against is precisely a *new* path — a new handler, a new action, a bulk endpoint added next quarter — whose author never learned the rule, so the evidence has to be structured as "for each route, a non-member gets `404`", with the list of routes derived from the file system rather than hand-maintained. That is also why the lint boundary matters as much as the tests: it catches the seventh route before anybody writes a test for it.

**★ Your acceptance table says "a test" for the lost update. What does that test actually have to do?**
It has to interleave, which is a stronger requirement than most suites are built for. Reading a card, writing it, and asserting the response proves nothing about concurrency. The test has to read the card as client A, read it as client B, write as B so the version advances, and only then write as A with A's now-stale version — asserting that A is rejected with the right code and that B's value survives. That means the test infrastructure needs a way to hold two logical clients with independent state, and if the suite cannot express it, the seam has no evidence. It is worth building that capability once, because seams 4, 5 and 7 all need the same arrangement.

**★ This chapter did not solve real-time updates, audit history or rate limiting. Why list them?**
Because an unnamed gap is indistinguishable from an oversight, and the two get handled very differently. A gap that is named, with its successor pointed at, is a scoping decision a reviewer can accept or challenge on its merits; the same gap unnamed is read as a thing the author did not think of, which costs credibility and usually costs a rushed implementation as well. It is also the honest reading of what a milestone is: not "here is a finished product" but "here is a resource built to a stated standard, and here is precisely what that standard did and did not cover."

**★ Why is the deployment half deliberately somebody else's chapter?**
Because the two halves fail for different reasons and mixing them produces a page that teaches neither. Everything in this chapter is a property of the code and the schema, and it is true on any platform: the lost update does not care where the function runs. Everything in chapter 17 is a property of the platform — how many instances exist, what the release pipeline can gate, what the observability stack can see — and it changes when you change vendors. The seam between them is exactly one number, the instance count, which this chapter takes as an input and that chapter determines. Keeping the boundary sharp is what makes the connection arithmetic in seam 1 portable rather than a fact about one host.

**★ You have to hand this API to another team on Monday. What are the three artefacts you give them?**
The route table with its status codes and the `403` decision written down with its reason, because the disclosure choice is the one a newcomer will "fix". The Data Access Layer boundary, expressed as the lint configuration rather than as a paragraph, because that is the only form of it that survives contact with a team that did not read this chapter. And the evidence table, which is the map from each silent failure to the artefact that guards it — so when one of those artefacts is deleted during a refactor, someone can find out what it was for. Everything else is readable from the code; those three are the things the code cannot tell you.

---

← [13c · What it costs the database](13c-milestone-what-it-costs-the-database.md) · [Chapter 16 index](01-explanation.md) · Next chapter → [17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md)
