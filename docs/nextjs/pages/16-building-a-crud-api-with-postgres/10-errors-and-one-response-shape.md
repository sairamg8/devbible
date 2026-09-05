---
title: "One service layer with two entry points has to render every failure twice — as an HTTP status for a Route Handler and as a typed return value for a Server Action — and the mistake is letting the service layer decide which"
sidebar_label: "10 · Errors and one response shape"
sidebar_position: 70
description: "Why a CRUD API in the App Router has two renderings of every failure, the failure taxonomy that makes both derivable from one thing, where the translation layer belongs, and the driver error that must never reach a client."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [`route.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) — which 🔴 **prescribes no error-response shape**, a point established and sourced in [ch7 · 04b](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md) — and the [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`). The envelope itself is **chapter 7's**; this page is what a two-entry-point CRUD API has to add to it.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Chapter 7 already designed the error envelope, and this chapter is not going to design a second one. What chapter 7 could not cover is the shape this chapter has been building since topic 01: one Data Access Layer with *two* entry points on top of it. A Route Handler renders a failure as an HTTP status code plus a body. A Server Action has no status code at all — it returns a value into a React render, and a `500` is not a thing it can say. So every failure in this API has two renderings, and the single most common way to get this wrong is to let the service layer pick one. A DAL that throws a `Response`, or returns `{ status: 409 }`, has quietly decided that HTTP is the only caller it will ever have — and the Server Action that imports it now has to parse an HTTP status out of a function call in its own process.**

## The rule, stated once

🔴 **The service layer describes *what went wrong*. The entry point decides *how to say it*.**

Everything else on this page is a consequence of that sentence. It is the same argument [the Data Access Layer](04-the-data-access-layer.md) makes about authorization — one place, so it cannot be forgotten, which is [04c · the ownership predicate](04c-the-ownership-predicate.md) — applied to failure instead of to access.

```ts
// lib/errors.ts — the vocabulary, and it mentions neither HTTP nor React
export type FailureKind =
  | 'validation_failed'   // the request could not be understood as a card
  | 'not_found'           // no such card, or the caller may not know it exists
  | 'forbidden'           // the caller is known and may not do this
  | 'unauthenticated'     // we do not know who is asking
  | 'conflict'            // current state disagrees with the write
  | 'precondition_failed' // a condition the CLIENT sent did not hold
  | 'rate_limited'
  | 'unavailable'         // the database, not the request, is the problem
  | 'internal'            // we do not know, and we are not going to guess in public

export class ApiFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly publicMessage: string,
    readonly details?: unknown,   // safe, structured, client-facing
    readonly cause?: unknown,     // NEVER serialized — this is the driver error
  ) {
    super(publicMessage)
    this.name = 'ApiFailure'
  }
}
```

Two fields carry the whole design. `publicMessage` and `details` are for the client. `cause` is for your log, and 🔴 **the only rule that matters on this page is that `cause` never crosses the wire.**

## Why a Server Action cannot use the Route Handler's answer

This is the part people discover late, usually when a form starts showing the string `"500"` to a user.

A Route Handler returns a `Response`. It has a status line, and the status line is the only part of your failure that **generic infrastructure understands** — a CDN, a load balancer, a client's retry policy and a monitoring dashboard all read the number and none of them read your body.

A Server Action returns a **value**. There is no status line. Chapter 7 settles the contract it should use — [expected errors are return values](../07-error-handling-loading-states-and-resilience/01b-expected-errors-are-return-values.md) and [the typed action result](../07-error-handling-loading-states-and-resilience/01c-the-typed-action-result-and-reading-it-back.md) — and the important consequence for this chapter is that a thrown error in an Action is *not* an error message, it is an error **boundary**: the user loses the form.

So the same `conflict` has two correct renderings:

```ts
// app/api/cards/[cardId]/route.ts — the HTTP rendering
export async function PATCH(req: Request, { params }: RouteContext<'/api/cards/[cardId]'>) {
  const { cardId } = await params
  try {
    const card = await updateCard(cardId, await req.json())
    return Response.json(card)
  } catch (e) {
    return toHttpResponse(e)          // status line + chapter 7's envelope
  }
}
```

```ts
// app/actions/update-card.ts — the Action rendering of the SAME failure
'use server'
import 'server-only'

export async function updateCardAction(cardId: string, input: unknown): Promise<ActionResult<Card>> {
  try {
    return { ok: true, data: await updateCard(cardId, input) }
  } catch (e) {
    return toActionResult(e)          // a value the form can render inline
  }
}
```

`updateCard` is identical in both. It threw an `ApiFailure`, and it does not know which of these called it.

## The two translators

They are small, they are the only places in the API that mention status codes, and they are exhaustive over `FailureKind` so the compiler tells you when you add one.

```ts
// lib/errors-http.ts
const STATUS: Record<FailureKind, number> = {
  validation_failed: 422,
  not_found: 404,
  forbidden: 403,
  unauthenticated: 401,
  conflict: 409,
  precondition_failed: 412,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
}

export function toHttpResponse(e: unknown): Response {
  const f = asApiFailure(e)                      // unknown -> ApiFailure('internal')
  const correlationId = crypto.randomUUID()
  logger.error({ correlationId, kind: f.kind, cause: f.cause })   // the cause is logged HERE
  return Response.json(
    { error: { code: f.kind, message: f.publicMessage, details: f.details, correlationId } },
    { status: STATUS[f.kind] },
  )
}
```

```ts
// lib/errors-action.ts
export function toActionResult<T>(e: unknown): ActionResult<T> {
  const f = asApiFailure(e)
  const correlationId = crypto.randomUUID()
  logger.error({ correlationId, kind: f.kind, cause: f.cause })
  return { ok: false, error: { code: f.kind, message: f.publicMessage, details: f.details, correlationId } }
}
```

⚠️ **`422` for validation is a choice, not a rule.** `400` is equally defensible and widely used; what is not defensible is using both in one API. Pick one, write it into [01b · the six routes and the codes they commit to](01b-the-six-routes-and-the-codes-they-commit-to.md), and let the exhaustive `Record` above enforce it.

🔴 **`409` and `412` are not interchangeable, and this is the pair that gets confused.** `412` means a precondition the **client sent** did not hold — it sent `If-Match` and the ETag had moved. `409` means the write conflicts with current state and the client never conditioned on anything. Topic 07 owns the mechanism; the taxonomy above owns keeping them distinct, and it can only do that because they are two different `FailureKind`s rather than one `conflict` with a comment.

## Where the translation layer belongs

Not in the handler, and not in the DAL. In between, and there is a concrete test for whether you got it right:

**Could you add a third entry point — a webhook, a CLI, a queue worker consuming the same service functions — without touching the service layer?** If yes, the boundary is correct. If adding one means the service layer grows a `if (isHttp)`, it was never a service layer.

```
Route Handler ──┐
Server Action ──┼──► service functions ──► Data Access Layer ──► Drizzle ──► Postgres
queue worker ───┘        throws ApiFailure       throws ApiFailure    throws DatabaseError
                              ▲                        ▲                     ▲
                              │                        │                     │
                    each entry point            authorization         SQLSTATE lives
                    owns its rendering          lives here            only this far
```

🔴 **The rightmost arrow is the one this chapter cares about most.** A `DatabaseError` from the driver must be converted before it leaves the DAL. [10b](10b-never-leak-a-driver-error.md) is that conversion and the reason it is not optional.

## Gotchas

**★ Symptom: a Server Action failure blanks the form and shows the nearest `error.tsx`.** Cause: the Action threw instead of returning. A thrown error in an Action is an error *boundary*, not an error *message* — the user loses everything they typed. Fix: catch at the Action boundary and return the failure as a value; chapter 7's [typed action result](../07-error-handling-loading-states-and-resilience/01c-the-typed-action-result-and-reading-it-back.md) is the contract, and `toActionResult` above is this chapter's implementation of it.

**★ Symptom: the Server Action shows users the literal text `500`.** Cause: the service layer returned an HTTP status and the Action rendered it, because the DAL decided the transport on the handler's behalf. Fix: the service layer emits a `FailureKind`, never a number. The number appears in exactly one file, `lib/errors-http.ts`, and a Server Action never imports it.

**★ Symptom: a new failure mode is handled in the Route Handler and forgotten in the Server Action.** Cause: the two translators are hand-written `switch` statements with `default` cases, so adding a `FailureKind` compiles cleanly and silently falls through. Fix: make the map an exhaustive `Record<FailureKind, number>` with no index signature and no `default` — adding a kind then breaks the build in exactly the two files that must change.

**★ Symptom: a client sees a different error shape from `/api/cards` than from `/api/boards`.** Cause: each handler built its own body inline, so the envelope is a convention rather than a type. Fix: no handler constructs a body — `toHttpResponse` is the only thing that does, and a review rule of "no `Response.json` with an `error` key outside `lib/errors-http.ts`" is greppable.

**★ Symptom: a bug is reported with a screenshot and nobody can find the log line.** Cause: the response carries no correlation id, so the user's failure and your log have nothing in common. Fix: generate one per failure, log it beside the cause, and return it in the body — it is the Route Handler's substitute for the `digest` that `error.tsx` gets for free, which is exactly the gap [ch7 · 04b](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md) identifies.

**★ Symptom: the correlation id is in the body but support still cannot find anything.** Cause: it was generated at response time and never logged, or logged at a level the retention policy drops. Fix: one `logger.error` call in the translator, containing both the id and the cause. If the id exists in a response but not in a log, it is decoration.

**★ Symptom: a 500 response has a helpful message describing exactly what went wrong.** Cause: `error.message` was passed through. That message frequently contains the SQL statement, the table name and the constraint name. Fix: `internal` gets a fixed public string and nothing else; the detail goes to the log under the correlation id. [10b](10b-never-leak-a-driver-error.md) has the specifics.

**★ Symptom: `not_found` and `forbidden` leak which cards exist.** Cause: the taxonomy is being applied literally rather than deliberately — returning 403 for a card the caller may not see confirms the card exists. Fix: decide per resource whether an unauthorised read is a 403 or a deliberate 404, write the decision into the contract, and implement it in the DAL rather than the translator. Topic 11 owns this; the taxonomy above only makes it *expressible*.

**★ Symptom: a database outage returns 500 and the client's retry logic never fires.** Cause: `unavailable` was collapsed into `internal`. Generic infrastructure treats those differently — 503 is retryable and often carries `Retry-After`, 500 is not. Fix: keep them as separate kinds, and map a connection failure to `unavailable` rather than letting it fall into the catch-all.

**★ Symptom: validation errors give the client no way to highlight the offending field.** Cause: the zod error was flattened to a sentence. Fix: `details` exists for exactly this — put the structured issue list there. It is safe to expose because it describes the request the client just sent, and it is the difference between a form that highlights a field and one that shows a paragraph.

**★ Symptom: everything is well designed and one endpoint still returns a raw stack trace.** Cause: it throws outside the `try`, or after the response has begun. Fix: the translator only runs on paths that reach it. A route with no `try` is not covered by any of this, and the only reliable check is reading each handler for the shape, since nothing in the framework requires it — the `route.js` reference prescribes no error handling at all.

## Interview questions

**★ Why does a CRUD API in the App Router need two renderings of every failure?**
Because it has two entry points over one service layer, and they speak different languages. A Route Handler returns a `Response`, whose status line is the only part of the failure that CDNs, load balancers, retry policies and dashboards understand. A Server Action returns a value into a React render and has no status line at all — and if it throws instead, the user hits an error boundary and loses the form. The same `conflict` therefore has to become a `409` in one place and a typed return value in the other, which is only possible if the service layer described the failure without choosing a transport.

**★ What is wrong with a Data Access Layer that throws a `Response`?**
It has decided that HTTP is the only caller it will ever have. The Server Action that imports it now has to unpack a status code out of an in-process function call, and any third caller — a queue worker, a CLI, a webhook — inherits the same absurdity. The concrete test is whether you could add that third entry point without touching the service layer; if adding one means the service grows a branch on transport, the layering was decorative.

**★ Chapter 7 already designed an error envelope. What does this chapter add?**
Two things chapter 7 could not. First, the second rendering: chapter 7 is about Route Handlers and pages, and this chapter has a Server Action over the same service functions, so it needs a failure vocabulary that predates both transports. Second, the database: this chapter's failures largely originate in the driver as `SQLSTATE`s, and translating those into the taxonomy — while making sure the driver's own message never reaches a client — is a problem an error-handling chapter with no database in it does not have.

**★ Why should the status map be an exhaustive `Record` rather than a `switch` with a default?**
Because the failure that matters is adding a new `FailureKind` and updating only one of the two translators. A `switch` with a `default` compiles, runs, and silently renders the new kind as whatever the default says — most likely a 500 for something that was not an internal error. An exhaustive `Record<FailureKind, number>` with no index signature makes the compiler fail in exactly the files that must change, which turns a silent divergence into a build error.

**★ A 500 response includes the message "duplicate key value violates unique constraint cards_board_id_position_key". What is wrong, in order of severity?**
It leaks the schema — table name, column names and the shape of a unique constraint — to anyone who can provoke it, which is reconnaissance. It is wrong as a status code, because a unique violation is a client-correctable conflict rather than a server fault, so a client that retries on 5xx will retry something that can never succeed. And it is useless to the client as a message, because it describes a database constraint rather than the request. All three come from the same mistake: passing `error.message` through instead of translating it.

**★ Why is 503 worth distinguishing from 500 when both are "the server is broken"?**
Because they are read by machines with different policies. A 503 is a documented retryable condition and can carry `Retry-After`, so a well-behaved client backs off and tries again; a 500 tells the same client the request will never succeed and it should stop. Collapsing a database outage into 500 turns a recoverable blip into permanent failures for every client that respects the distinction, and it also erases the difference on your dashboards between "we are down" and "we have a bug".

**★ What is the correlation id for, given the client cannot do anything with it?**
The client can do exactly one thing with it, and it is the important one: quote it. It is the Route Handler's substitute for the `digest` that `error.tsx` gets automatically — the one token shared between what a user saw and what your server logged. Without it, debugging a customer's failed request from the outside means correlating on timestamps and a URL, which fails as soon as there is traffic. It is only useful if it is logged alongside the cause at a level your retention keeps; an id in a response with no matching log line is decoration.

**★ Where does the driver error stop, and why there?**
At the Data Access Layer boundary — the DAL catches it, maps the `SQLSTATE` to a `FailureKind`, and attaches the original as `cause`. It stops there because that is the last place that knows what the query was trying to do, which is the information you need to translate `23505` into something meaningful: the same code means "that card position is taken" in one query and "that idempotency key has been used" in another. Translating further out loses the query context; translating further in puts SQL knowledge into the handler.

## Where this connects

- [ch7 · designing the error envelope](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md) — the envelope this chapter uses rather than replaces
- [ch7 · expected errors are return values](../07-error-handling-loading-states-and-resilience/01b-expected-errors-are-return-values.md) — why an Action returns rather than throws
- [ch15 · thin entry points over one rule](../15-databases-apis-and-full-stack-patterns/02n-thin-entry-points-over-one-rule.md) — the same argument at the chapter-15 scale

---

← [09g · The one genuine superpower](09g-the-one-genuine-superpower.md) · [Chapter 16 overview](01-explanation.md) · Next → [10b · Never leak a driver error](10b-never-leak-a-driver-error.md)
