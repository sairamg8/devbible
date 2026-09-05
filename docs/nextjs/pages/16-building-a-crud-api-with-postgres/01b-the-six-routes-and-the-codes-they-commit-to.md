---
title: "State every status code each verb may produce before you write a handler, because a status code is not a detail of the implementation — it is the only part of your response a proxy, a cache, a retry policy and a monitoring dashboard all agree on"
sidebar_label: "01b · Six routes, and the codes"
sidebar_position: 11
description: "The full status table for the six card routes, the RFC 9110 definitions the codes are held to, safe and idempotent as commitments rather than trivia, why 405 and Allow are the framework's business and 404-vs-403 is yours, and the codes this chapter deliberately does not use."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [RFC 9110 · HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) (§9.2.1 safe, §9.2.2 idempotent, §9.3.3–9.3.5, §15.3.2, §15.3.5, §15.5.6, §15.5.10, §15.5.13), [RFC 5789 · PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789.html) and [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`version: 16.3.4`).
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**A status code is the only field in your response that every intermediary understands without knowing anything about cards. A CDN decides caching from it. A client library decides whether to retry from it. Your dashboard decides whether to page someone from it. That makes the code table a public interface in a way the JSON body never is — and it is why the table below is written now, in [01](01-the-resource-contract.md)'s contract file, rather than discovered later by reading six handlers. Every entry here is a commitment; the topics that implement each verb inherit it rather than choosing it.**

## The table

| Route | Verb | Success | Failures it may produce |
|---|---|---|---|
| `/api/boards/[boardId]/cards` | `GET` | `200` | `401` `404` `400` |
| `/api/boards/[boardId]/cards` | `POST` | `201` + `Location` | `401` `404` `400` `422` `409` |
| `/api/cards/[cardId]` | `GET` | `200` | `401` `404` `304` |
| `/api/cards/[cardId]` | `PATCH` | `200` | `401` `404` `400` `422` `409` `412` |
| `/api/cards/[cardId]` | `PUT` | `200` | `401` `404` `400` `422` `409` `412` |
| `/api/cards/[cardId]` | `DELETE` | `204` | `401` `404` |
| either | anything else | — | `405` + `Allow` |
| either | anything at all | — | `500` |

Read the failure columns as **the complete list**. A code not in a row is a code that row does not produce, and that is itself a promise: a client integrating against `DELETE` never has to write a branch for `409`, and if one appears, that is a bug in the server rather than a case the client forgot.

Two absences are deliberate and are argued at the bottom of this page: **`403` does not appear anywhere**, and **`200` does not appear for `DELETE`**.

## Safe and idempotent, as commitments rather than trivia

These two words look like exam material and are actually operational promises, because other people's software acts on them without asking you.

> *"Request methods are considered 'safe' if their defined semantics are essentially read-only; clients do not expect state changes on the origin server resulting from applying a safe method to a target resource."*
> — [RFC 9110 §9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html)

> *"A request method is considered 'idempotent' if the intended effect of successfully applying it to a target resource the same single time is identical to the effect of applying it multiple times."*
> — [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html)

| Verb | Safe | Idempotent | The practical consequence |
|---|---|---|---|
| `GET` | yes | yes | A crawler, a link prefetcher or a CDN may issue it at any time, unprompted |
| `POST` | no | **no** | A retried `POST` may create a second card. Topic 05 owns the idempotency key |
| `PUT` | no | yes | A client library may safely retry a timeout without asking you |
| `PATCH` | no | **no** | RFC 5789: *"PATCH is neither safe nor idempotent"*. A retry is not automatically harmless |
| `DELETE` | no | yes | A retried delete must return the same thing as the first — which is why the row says `204`, `404` |

🔴 **A `GET` that mutates is not a style error, it is an outage waiting for a prefetcher.** The reason is in the definition: clients — including software you have never heard of — *do not expect state changes*, so they feel free to issue it speculatively. If `GET /api/cards/[cardId]` bumps a "last viewed" counter, that counter is being written by every link preview generator that ever sees the URL.

The `PATCH` row is the one that surprises people. `PATCH` is non-idempotent by specification, because the body is a set of instructions rather than a state:

> *"In a PUT request, the enclosed entity is considered to be a modified version of the resource stored on the origin server, and the client is requesting that the stored version be replaced. With PATCH, however, the enclosed entity contains a set of instructions describing how a resource currently residing on the origin server should be modified to produce a new version."*
> — [RFC 5789 §1](https://www.rfc-editor.org/rfc/rfc5789.html)

A merge-patch of `{ "status": "done" }` happens to be idempotent; an instruction like "increment position by 1" would not be. Since the specification does not promise it, no client may assume it, and SprintDesk's `PATCH` therefore has to be safe to call twice by construction rather than by hope — which is what the `version` column and `412` are for in topic 07.

RFC 5789 also imposes an atomicity requirement that is easy to miss and lands directly on topic 09:

> *"The server MUST apply the entire set of changes atomically and never provide (e.g., in response to a GET during this operation) a partially modified representation."*

A `PATCH` touching two columns and two tables is one transaction. That is not a design preference; it is the method's definition.

## The codes, one by one, against their definitions

**`200 OK`** — a read succeeded, or a write succeeded and the new representation is in the body. `PATCH` and `PUT` return the card, not an empty body, because the server computed `updatedAt` and `version` and the client would otherwise have to `GET` again to learn them. That extra round trip is the entire cost of returning `204` from an update.

**`201 Created`** — `POST` only.

> *"The 201 (Created) status code indicates that the request succeeded, has led to the creation of a new resource, and the newly created resource is identified by one or more response Location header fields."*
> — [RFC 9110 §15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html)

The `Location` header is part of the definition, not an optional nicety, and the value is the item route for the new card: `/api/cards/{id}`. This is the one place the two addresses in the contract meet — a create against the collection hands back the item URL.

**`204 No Content`** — `DELETE` only.

> *"The 204 (No Content) status code indicates that the server has successfully fulfilled the request and there is no additional content to send in the response payload body."*
> — [RFC 9110 §15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html)

**`304 Not Modified`** — `GET` on the item, when the client sent `If-None-Match` and the card has not changed. It appears in the table because it is a *success* the client must handle, and clients that treat any non-`200` as an error break on it. Only the item route offers it; a collection's validator would have to change whenever any member changes, which is achievable and not worth it here.

**`400 Bad Request`** — the request could not be parsed at all: malformed JSON, a `cardId` path segment that is not a UUID, a query parameter that is not a number. Nothing about cards is known yet.

**`401 Unauthorized`** — no usable credential. Every row has it, because every route requires a caller.

**`404 Not Found`** — the card does not exist, *or* the caller is not a member of the team that owns its board. Those are one code on purpose; see below.

**`405 Method Not Allowed`** — the framework's, not yours.

> *"A server that receives a request method for a target resource that does not support that method MUST generate an Allow header field."*
> — [RFC 9110 §15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html)

You get this for free by not exporting the function. Next.js derives `Allow` from the methods you did export, and the same derivation is what powers the automatic `OPTIONS` handler.

**`409 Conflict`** — the request is well-formed and meaningful, and the current state of the resource makes it impossible: a unique constraint the database rejected, or a serialization failure the retry loop gave up on.

> *"The 409 (Conflict) status code indicates that the request conflicts with the current state of the target resource."*
> — [RFC 9110 §15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html)

**`412 Precondition Failed`** — the caller sent `If-Match` with an `ETag` and the card has moved on since.

> *"The 412 (Precondition Failed) status code indicates that one or more conditions given in the request header fields evaluated to false when tested on the server."*
> — [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html)

The distinction between this and `409` is *where the caller stated their expectation*. `412` means they stated it in a header and it was false; `409` means they did not state one and the server found a conflict anyway. Topic 07 owns the choice.

**`422 Unprocessable Content`** — RFC 9110 §15.5.21 defines this for a request that is syntactically valid and semantically wrong; the specification's framing is that the content is understood but cannot be processed. In this API it means the JSON parsed, the field types are right, and a domain rule said no — a title of 300 characters, a `status` outside the enum, a `position` that is `NaN`.

**`500 Internal Server Error`** — every row, always, because a bug is always possible. It is on the table so that the client contract says "you may see this", not because any handler chooses it.

## The 400 / 422 line, drawn once

This is the argument that produces the most churn in review, so decide it here and never again:

- **`400`** — the server could not turn the bytes into a request. Broken JSON, wrong `Content-Type`, a path segment that cannot be a UUID.
- **`422`** — the server understood the request completely and the *domain* rejected it. Empty title, unknown status, `position` out of range.

The line is drawn at *"did parsing succeed"*, and the reason it is worth drawing at all is that the two failures have different audiences. A `400` is a bug in the client's serialisation code, fixable by a developer. A `422` is a message for a human — it is what the form renders under the field. Collapsing them means the UI has to guess which of your `400`s is worth showing a user.

⚠️ **Both of these come from the same zod parse in practice**, which is why they get conflated. The distinction survives if you parse in two stages: the transport shape first, the domain rules second. Topic 05 owns the code for that.

## `404` for a non-member, and why `403` never appears

Both codes are correct English and only one of them is correct here.

`403` tells an unauthenticated stranger *"this card exists and you may not see it"*. That is a disclosure: it turns your API into an oracle for card ids, which for a UUID matters less than it does for a sequential id but still leaks the existence of boards, and by extension of customers. `404` tells them nothing.

The rule this chapter follows, argued in full in [ch10 · 06g](../10-forms-authentication-and-security-hardening/06g-milestone-hide-do-not-forbid.md) and carried into [topic 11 · Ownership on the API surface](11-ownership-on-the-api-surface.md):

- **`401`** — you have not told me who you are. Recoverable by signing in.
- **`404`** — you have told me who you are, and for you this resource does not exist. Not recoverable, and deliberately indistinguishable from a card that was never created.
- **`403`** — reserved for the case where the caller *knows* the resource exists because they can see it, and is being refused a specific operation on it. SprintDesk cards have no such case at this point in the build, so the code is not in the table.

The structural payoff is that "not a member" and "no such card" become the same code path, which means they cannot diverge. When the ownership predicate is inside the `WHERE` clause ([04c](04c-the-ownership-predicate.md)), a non-member's query returns zero rows — the handler cannot tell the two cases apart even if it wanted to, and that is the point.

## What the handler looks like once the table exists

The handler contributes exactly two things: reading the transport, and mapping a domain outcome onto a row of the table.

```ts
// app/api/cards/[cardId]/route.ts
import { NotFound, Unauthorized, DomainInvalid, VersionConflict } from '@/lib/dal/errors'
import { readCard, deleteCard } from '@/lib/dal/cards'

const CODE_FOR = new Map<Function, number>([
  [Unauthorized, 401],
  [NotFound, 404],
  [DomainInvalid, 422],
  [VersionConflict, 412],
])

export async function GET(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    const card = await readCard(cardId)
    return Response.json(card, { status: 200 })
  } catch (reason) {
    return toResponse(reason)
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await ctx.params
  try {
    await deleteCard(cardId)
    return new Response(null, { status: 204 })
  } catch (reason) {
    return toResponse(reason)
  }
}

function toResponse(reason: unknown): Response {
  const status = CODE_FOR.get((reason as object)?.constructor) ?? 500
  if (status === 500) console.error('cards route failed', reason)
  // The body shape is the single error envelope, topic 10.
  return new Response(null, { status })
}
```

No `PUT`, `PATCH` or `POST` is exported from that file yet — those are topics 05 and 07 — and the framework will already answer them with `405` and an `Allow` header naming `GET` and `DELETE`. That is the contract holding before the implementation exists, which is the whole argument of [01](01-the-resource-contract.md) in one observable behaviour.

The body of an error response is [the single error envelope, topic 10](10-errors-and-one-response-shape.md). This page commits to the codes; that topic commits to what travels with them.

## Gotchas

**★ Symptom: a client's retry-on-timeout logic creates duplicate cards.** Cause: `POST` is not idempotent by specification and the client is treating a network timeout as "unknown, retry". Both sides are behaving correctly. Fix: give `POST` an idempotency key so a repeat of the same logical request returns the original `201` rather than creating a second row — topic 05 owns the mechanism. Do not "fix" it by making `POST` idempotent implicitly; a client cannot detect that and will not rely on it.

**★ Symptom: `DELETE` returns `204` the first time and `404` the second, and a client calls that a bug.** Cause: a reasonable misreading of idempotency. Idempotency is about the *effect* on the server — *"the intended effect of successfully applying it… the same single time is identical to the effect of applying it multiple times"* — and after both calls the card is gone either way. Fix: state it in the contract. The alternative, returning `204` forever, is also defensible; what is not defensible is having no answer, which is what happens when nobody wrote the row down.

**★ Symptom: a `PATCH` that arrived twice applied twice.** Cause: `PATCH` is non-idempotent by specification and the body described a change rather than a state. Fix: make the body a merge-patch of absolute values, never a delta, and gate it on `version` so the second application fails with `412` instead of applying. A delta-shaped `PATCH` body is the one design that makes retries structurally unsafe.

**★ Symptom: `403` and `404` are both in use for "not your card", chosen per handler.** Cause: no rule, so each author picked. Fix: one rule for the whole surface, written in the contract, and enforced structurally by putting the membership predicate in the `WHERE` clause so the handler physically cannot distinguish the cases.

**★ Symptom: the front end shows "Something went wrong" for a title that is too long.** Cause: the domain rejection came back as `400`, and the client's error handler treats `400` as a client bug rather than a user-facing message. Fix: `422` for domain rules, `400` for unparseable requests, and a field-keyed body so the form can render the message next to the input.

**★ Symptom: a CDN is serving a stale card and nobody configured a CDN.** Cause: `GET` responses with no explicit cache directives are at the mercy of whatever sits in front of the app. Fix: decide the caching for `GET` in the contract and set the header explicitly. Route Handler `GET` has been dynamic by default since `v15.0.0-RC` — *"The default caching for `GET` handlers was changed from static to dynamic"* — but that governs the framework's own cache, not an intermediary's, and the intermediary reads `Cache-Control`. Topic 06 owns the collection's caching.

**★ Symptom: `OPTIONS` works and the browser still blocks the request.** Cause: the automatic `OPTIONS` handler sets `Allow`, which is HTTP method discovery, not CORS. Fix: CORS needs `Access-Control-Allow-Origin` and friends, which you set yourself — and for a same-origin resource like this one, the correct action is to set none of them.

**★ Symptom: monitoring shows a 4xx spike and nobody can tell whether it is an attack, a client bug or a form validation storm.** Cause: everything is `400`. Fix: the table above is also a dashboard schema. `401` spiking is an auth outage, `404` spiking is a scanner or a broken link, `409` spiking is contention, `422` spiking is a UI regression. Codes that mean one thing each are what make that read possible.

**★ Symptom: a handler returns `500` for a permission failure and someone is paged at 03:00.** Cause: the DAL threw a domain error and the handler had no mapping, so it fell through the `?? 500`. Fix: the `CODE_FOR` map above, plus the rule that only `500` logs — a `404` is not an incident and should not be in the error log at all.

## Interview questions

**★ Why is `PATCH` not idempotent, when your `PATCH` obviously is?**
Because idempotency is a property of the *method* as specified, not of your implementation, and clients act on the specification. RFC 5789 states outright that *"PATCH is neither safe nor idempotent"*, and the reason is in the definition of the method: the body is *"a set of instructions describing how a resource… should be modified"*, and instructions can compound. Your merge-patch of `{"status":"done"}` happens to be repeatable, but nothing in the protocol tells a client library that, so no correct client will auto-retry a `PATCH` on your behalf. If you want a retry-safe partial update you have to make it safe yourself — absolute values in the body and a version precondition — and if you want the client to know it is safe, that is `PUT` or an explicit idempotency key.

**★ When would you return `409` and when `412` for a concurrent update?**
`412` when the caller stated a precondition and it turned out false — they sent `If-Match: "7"`, the card is now at version 9, and the correct response is *"one or more conditions given in the request header fields evaluated to false"*. `409` when they made no such claim and the server detected a conflict anyway, most commonly a unique constraint firing or a serializable transaction failing to commit. The difference matters to the client because the remedies differ: after a `412` the client re-reads, re-applies its edit and retries with a fresh validator; after a `409` there is no validator to refresh, so it must show the conflict to a human or apply a domain-specific merge.

**★ Why does this API never return `403`?**
Because `403` confirms existence to somebody who has no right to know the resource exists, and that confirmation is the leak. Answering `404` collapses "no such card" and "not your card" into one indistinguishable response, so the API cannot be used as an oracle to enumerate boards or infer which customers exist. It also has a structural benefit that is easy to undervalue: once the membership test is a predicate in the `WHERE` clause, a non-member's query returns zero rows and the handler *cannot* tell the two cases apart — the correct behaviour is the only behaviour available, rather than something a reviewer has to notice. `403` earns its place later, when a caller can already see a resource and is refused a specific operation on it; until then it is disclosure with no benefit.

**★ Why is `Location` part of `201` rather than a nicety?**
Because RFC 9110 defines `201` in terms of it — *"the newly created resource is identified by one or more response Location header fields"* — so a `201` with no `Location` is not a smaller version of the same response, it is an incomplete one. Practically, it is the only thing that tells a client the item address for something it just created, and it is what makes the two-address design in [01](01-the-resource-contract.md) usable: the client posts to the collection and is handed the item URL, rather than having to know how to construct it. A client that constructs the URL itself has taken on a dependency on your routing scheme that you never agreed to.

**★ Why should a `GET` never change state, beyond it being untidy?**
Because "safe" is a licence you have granted to software you will never see. The definition says clients *"do not expect state changes on the origin server resulting from applying a safe method"*, and a great deal of infrastructure acts on that: link prefetchers, chat clients generating previews, security scanners, CDNs warming caches, and browsers speculatively fetching on hover. Any of them will issue your `GET` without a user asking. A view counter is the mild version; a `GET /api/cards/[cardId]/archive` is a resource that gets archived by a Slack unfurl. The rule is not about purity, it is about who else is allowed to press the button.

**★ Why write the status table before the handlers rather than after?**
Because before the handlers exist the table is a set of decisions, and after they exist it is a transcript. Written first, "what does `DELETE` do for a card that is already gone?" is a question with two defensible answers you have to choose between; written second, the answer is whatever the first implementation happened to do, which is usually a `500` from an unhandled `null` and which nobody will ever revisit because it does not look like a decision. The table is also the only artefact that makes an omission visible: a row with an empty failure column is a route nobody has thought about, and that is not something you can notice by reading code that already compiles.

**★ What does it cost to add `403` to the surface later?**
More than it looks, because it is a behavioural change to responses clients already handle. Anyone who wrote `if (res.status === 404) { treat as deleted }` now receives `403` for a case they were previously told was `404`, and their cleanup logic stops firing. That makes it a breaking change even though nothing about the success path moved — which is the general shape of status-code evolution and the reason the failure column in the table is stated as complete. Adding a code is easy; adding one that overlaps a code you already return for the same situation is not.

---

← [01 · The resource contract](01-the-resource-contract.md) · Next → [01c · What the client may rely on](01c-what-the-client-may-rely-on.md)
