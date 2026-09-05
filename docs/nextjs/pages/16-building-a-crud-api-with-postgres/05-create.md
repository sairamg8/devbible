---
title: "POST is the verb with no safety net — it is neither safe nor idempotent, the server chooses the identifier, and every one of those properties turns into a decision you have to make explicitly about status codes, the Location header, and what comes back in the body"
sidebar_label: "05 · CREATE"
sidebar_position: 30
description: "What POST actually means for the cards collection, why 201 plus Location is the specified response rather than a convention, why RETURNING is not an optimisation, and the four things a create handler must never do."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 *HTTP Semantics* — [§9.3.3 POST](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.3), [§15.3.2 201 Created](https://www.rfc-editor.org/rfc/rfc9110#section-15.3.2), [§10.2.2 Location](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.2) — the [PostgreSQL 18 `INSERT` reference](https://www.postgresql.org/docs/18/sql-insert.html), and the Next.js [Route Handlers guide](https://nextjs.org/docs/app/getting-started/route-handlers) and [`route.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) (both `version: 16.3.4`).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `zod` **4.4.3** · Node **24.20.0**.

**Create is the verb people think is easy and it is the one with the most decisions per line. POST is defined as neither safe nor idempotent, which means the client cannot retry it and a proxy is forbidden from retrying it for you — so every network hiccup on the way to your handler becomes a question you have to answer in application code. The server, not the client, mints the identifier, so the response has to hand it back or the client has no way to address what it just made. And the database is the last validator in the stack: it will reject a row your zod schema happily approved, and it will do so in a language of five-character SQLSTATE codes rather than exceptions with useful names. This chunk covers the HTTP contract. [05b](05b-validating-at-the-boundary-with-zod.md) covers the boundary schema, [05c](05c-constraint-violations-and-sqlstate.md) the SQLSTATE mapping, [05d](05d-idempotency-keys-for-a-retried-post.md) the retry, [05e](05e-client-supplied-ids-and-identifier-choice.md) the identifier, and [05ea](05ea-the-position-value-and-concurrent-creates.md) the position.**

## What POST actually means, per the specification

The definition is deliberately loose, and that looseness is the source of most disagreement about REST:

> *"The POST method requests that the target resource process the representation enclosed in the request according to the resource's own specific semantics."*

Creation is listed as one use among several — the spec names *"Creating a new resource that has yet to be identified by the origin server"* alongside appending to a representation and handing a block of data to a data-handling process. So `POST /api/boards/[boardId]/cards` is not "the create endpoint" because REST says so; it is the create endpoint because **this** resource's specific semantics say so, and the contract you publish is what makes that true.

Two properties are not loose at all, and they are the ones that cost you.

**POST is not safe.** It changes server state, so it may not be prefetched, speculatively issued, or replayed by anything in the path.

**POST is not idempotent.** RFC 9110 §9.2.2:

> *"A request method is considered 'idempotent' if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request. Of the request methods defined by this specification, PUT, DELETE, and safe request methods are idempotent."*

And the consequence that people miss:

> *"A client SHOULD NOT automatically retry a request with a non-idempotent method unless it has some means to know that the request semantics are actually idempotent, regardless of the method, or some means to detect that the original request was never applied."*
>
> *"A proxy MUST NOT automatically retry non-idempotent requests."*

That is the whole problem in two sentences. A POST that times out leaves the client with **no defined recovery**: it cannot retry, and it cannot tell whether the card exists. The spec's escape hatch — *"some means to know that the request semantics are actually idempotent"* — is exactly what an idempotency key manufactures, and it is why [05d](05d-idempotency-keys-for-a-retried-post.md) exists as its own chunk rather than as a footnote here.

## The route file, and the line it draws

```ts
// app/api/boards/[boardId]/cards/route.ts
import type { NextRequest } from 'next/server'
import { createCard } from '@/lib/dal/cards'
import { CreateCardRequest } from '@/lib/schemas/card'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/boards/[boardId]/cards'>,
) {
  const { boardId } = await ctx.params

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    // A malformed body never reaches zod — request.json() throws first.
    return Response.json(
      { error: { code: 'invalid_json', message: 'Request body is not valid JSON' } },
      { status: 400 },
    )
  }

  const parsed = CreateCardRequest.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: 'validation_failed',
          message: 'The request body did not match the card schema',
          details: parsed.error.issues,
        },
      },
      { status: 422 },
    )
  }

  const card = await createCard(boardId, parsed.data)

  return Response.json(card, {
    status: 201,
    headers: { Location: `/api/cards/${card.id}` },
  })
}
```

Four things about that file are deliberate.

**`ctx.params` is awaited.** The `route.js` version history is explicit: `v15.0.0-RC` — *"`context.params` is now a promise."* The `RouteContext<'/api/boards/[boardId]/cards'>` helper is a global generated during `next dev`, `next build` or `next typegen`, so the route literal is checked against your actual file tree rather than being a string you typed hopefully.

**The `try` around `request.json()` is not defensive padding.** `Request.json()` rejects on a syntactically invalid body, and that rejection happens *before* any schema sees the input. Without the catch, a truncated body produces an unhandled rejection and a 500 for what is unambiguously a client error.

**The handler shapes no data.** `createCard` returns the projection the Data Access Layer chose; the handler serialises it and stops. That is the rule the chapter is built on — see [04 · The Data Access Layer](04-the-data-access-layer.md).

**The error bodies here are illustrative of status choice, not the chapter's canonical envelope.** The shape a client should actually rely on — machine-readable `code`, a safe `message`, a correlation id — is argued in [ch7 · Designing the error envelope](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md), and where the translation from a thrown domain error to that envelope lives is [10 · Errors and one response shape](10-errors-and-one-response-shape.md). Do not build a second one here.

## The DAL side, and where `RETURNING` earns its place

```ts
// lib/dal/cards.ts
import 'server-only'
import { db } from '@/db'
import { cards } from '@/db/schema'
import { requireBoardAccess } from '@/lib/dal/access'
import type { CreateCardInput } from '@/lib/schemas/card'

export type CardDTO = {
  id: string
  boardId: string
  title: string
  body: string | null
  status: 'todo' | 'doing' | 'done'
  position: number
  version: number
  createdAt: Date
  updatedAt: Date
}

export async function createCard(
  boardId: string,
  input: CreateCardInput,
): Promise<CardDTO> {
  await requireBoardAccess(boardId) // ownership lives here, not in the handler

  const [card] = await db
    .insert(cards)
    .values({
      boardId,
      title: input.title,
      body: input.body ?? null,
      status: input.status ?? 'todo',
      position: input.position,
    })
    .returning({
      id: cards.id,
      boardId: cards.boardId,
      title: cards.title,
      body: cards.body,
      status: cards.status,
      position: cards.position,
      version: cards.version,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
    })

  return card
}
```

`RETURNING` is a PostgreSQL extension, and the `INSERT` reference says what it is for:

> *"The optional RETURNING clause causes INSERT to compute and return value(s) based on each row actually inserted (or updated, if an ON CONFLICT DO UPDATE clause was used). This is primarily useful for obtaining values that were supplied by defaults, such as a serial sequence number."*

Look at the canonical `cards` schema and count how many columns the client did not send: `id` (`defaultRandom()`), `status` (`default('todo')` if omitted), `version` (`default(1)`), `createdAt` and `updatedAt` (`defaultNow()`). That is five values the row has and the request did not. Without `RETURNING` you have three bad options: a second `SELECT` (a second round trip, and in READ COMMITTED a second snapshot — the row could already have been updated by someone else), reconstructing the values in TypeScript (which duplicates every default and drifts the first time one changes in a migration), or returning `204 No Content` and making every client immediately issue a GET.

`RETURNING` is not a micro-optimisation. **It is the only way to hand back exactly the row the database committed**, which is what a create response is supposed to be.

Two details from the same reference that matter later:

> *"Only rows that were successfully inserted or updated will be returned."*

That sentence is the entire trap in `ON CONFLICT DO NOTHING` — [05d](05d-idempotency-keys-for-a-retried-post.md).

> *"Use of the RETURNING clause requires SELECT privilege on all columns mentioned in RETURNING."*

If your application role is deliberately write-only on some column, `.returning()` on it fails with a permission error rather than a constraint error, and it will look nothing like a validation problem.

## 201, `Location`, and what goes in the body

RFC 9110 §9.3.3 states the create response in one sentence, and it is a SHOULD, not a MAY:

> *"If one or more resources has been created on the origin server as a result of successfully processing a POST request, the origin server SHOULD send a 201 (Created) response containing a Location header field that provides an identifier for the primary resource created (Section 10.2.2) and a representation that describes the status of the request while referring to the new resource(s)."*

§15.3.2 explains why `Location` is load-bearing rather than decorative:

> *"The 201 (Created) status code indicates that the request has been fulfilled and has resulted in one or more new resources being created. The primary resource created by the request is identified by either a Location header field in the response or, if no Location header field is received, by the target URI."*

🔴 **That fallback is the bug.** If you return 201 without `Location`, a spec-conforming client concludes the created resource is identified by the **target URI** — which for us is `/api/boards/{boardId}/cards`, the collection. You have just told the client that the thing it created is the list it posted to. Nothing crashes; the client simply has a wrong URI for the new card and every subsequent request against it is a 404 or a surprise.

§10.2.2 permits a relative reference and defines how it resolves:

> *"When it has the form of a relative reference ([URI], Section 4.2), the final value is computed by resolving it against the target URI ([URI], Section 5)."*

So `Location: /api/cards/019a...` is correct and portable; you do not need to reconstruct the origin, and reconstructing it from `request.headers.get('host')` behind a proxy is a way to emit a `Location` pointing at an internal hostname.

**The body should be the created representation, not an acknowledgement.** `{ "ok": true }` forces the client into an immediate GET, which costs a round trip and — because `id` was server-minted — the client cannot even construct that GET without reading `Location` first. Return the row. You already have it from `RETURNING`.

## What the handler must not do

**It must not authorise.** `requireBoardAccess` is called inside `createCard`, and only there. A check in the handler protects the handler; a check in the DAL protects every caller including the Server Action that will eventually call the same function.

**It must not be cached, and Next.js already guarantees that.** From the Route Handlers guide:

> *"Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached."*

> *"Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET` method that is cached, in the same file."*

So co-locating a cached `GET` list handler with this `POST` in one `route.ts` is safe. RFC 9110 does define conditions under which a POST *response* is cacheable — it requires explicit freshness information plus a `Content-Location` equal to the target URI — but that is a shared-cache optimisation for POST-as-query, not something a create endpoint wants.

**It must not read the body twice.** The BFF guide is blunt: *"You can only read the request body once. Clone the request if you need to read it again."* A logging middleware that consumes the body and a handler that then calls `request.json()` produce a failure that reads like malformed input from a perfectly valid client.

**It must not define `POST` and then hand-roll a 405.** Next.js already does it: *"If an unsupported method is called, Next.js will return a `405 Method Not Allowed` response."* And `OPTIONS` is synthesised with a correct `Allow` header from the methods you exported, so adding a hand-written `OPTIONS` usually loses information rather than adding it.

## Gotchas

**★ Symptom: the client creates a card, then fetches it, and gets a 404.** Cause: the response was `201` with no `Location` header, so per §15.3.2 the client resolved the created resource to the target URI — the collection — and built its follow-up request from that. Fix: always emit `Location`, and make it the canonical single-resource URI, not the collection you posted to:

```ts
return Response.json(card, {
  status: 201,
  headers: { Location: `/api/cards/${card.id}` },
})
```

**★ Symptom: a truncated or non-JSON body produces a 500 and an alert page.** Cause: `request.json()` rejects before validation runs, and an unhandled rejection in a Route Handler is a server error by definition. Fix: the parse of the *envelope* and the validation of the *content* are two different failures and need two different guards — the `try` shown in the route file above, returning 400, then `safeParse` returning 422.

**★ Symptom: `Location` points at `http://10.0.3.41:3000/api/cards/...` in production.** Cause: the header was built by concatenating a scheme and `request.headers.get('host')`, which behind a load balancer is the internal hop, not the public origin. Fix: emit a relative reference and let §10.2.2 resolution do the work — `` `/api/cards/${card.id}` `` — or read a trusted, explicitly configured public base URL from the environment. Never trust an inbound `Host`.

**★ Symptom: the created card's `createdAt` in the API response is a few milliseconds off from what a later GET returns.** Cause: the timestamp was generated in Node (`new Date()`) and sent as a value, while the column also carries `defaultNow()`; two clocks, two values, and the one the client saw was never the one stored. Fix: never send a value for a defaulted column, and read the committed value back:

```ts
// wrong — a second source of truth for a column the database owns
.values({ boardId, title, createdAt: new Date() })
// right — let the default fire, then return what committed
.values({ boardId, title }).returning({ createdAt: cards.createdAt })
```

**★ Symptom: creates succeed but the response is `{}` for one field the client needs.** Cause: `.returning({ ... })` is an explicit projection and the field was simply not listed. Unlike `.returning()` with no argument, it does not widen when the schema gains a column. Fix: this is the correct trade — an explicit projection is what stops a future `passwordHash`-shaped column leaking through a create response — so keep it explicit and treat the DTO type as the contract. Add the field to both the `CardDTO` type and the projection, in the same commit.

**★ Symptom: a middleware that logs request bodies makes every POST fail validation.** Cause: the body stream was already consumed; the second read yields nothing and `request.json()` rejects. Fix: clone before consuming — `const forLogging = request.clone()` — and read the clone, never the original.

**★ Symptom: a create endpoint returns 200 and a mobile client treats it as an update.** Cause: 200 says the request succeeded and says nothing about a resource having come into existence; 201 says one did. Clients that branch on the status code, and offline queues that decide whether to keep a local optimistic row, read that difference. Fix: 201 for "a row now exists that did not", 200 only when you deliberately mean "processed, nothing created" — for example an idempotent replay, which [05d](05d-idempotency-keys-for-a-retried-post.md) argues should be 200, not 201.

**★ Symptom: an `OPTIONS` handler was added for CORS and preflight started failing for `PATCH`.** Cause: Next.js only synthesises `OPTIONS` — with an `Allow` header derived from the methods you exported — when you have not defined one. Defining one replaces that logic wholesale, including the header it was generating. Fix: if you define `OPTIONS`, you now own `Allow` and every CORS response header for the route; enumerate the methods yourself and keep the list beside the exports so it cannot drift.

## Interview questions

**★ Why does the HTTP specification forbid a proxy from retrying a POST, and what does that force you to build?**
Because a proxy has no idea what the POST meant. RFC 9110 §9.2.2 says a proxy *"MUST NOT automatically retry non-idempotent requests"*, and the reason is that the intended effect of two identical POSTs is not defined to be the same as one — for a create endpoint it is literally two cards. So the recovery that TCP and HTTP give you for free on GET and PUT is unavailable, and there is exactly one place left to solve it: the application. That is the argument for an idempotency key. The spec even names the escape route — a client may retry when it has *"some means to know that the request semantics are actually idempotent, regardless of the method"* — and a key plus a unique constraint is what manufactures that means.

**★ A colleague says `RETURNING` is a performance optimisation that saves a round trip. Why is that framing wrong?**
Because the round trip is the smaller half. `RETURNING` is the only construct that gives you the values **as committed by this statement**. If you instead `SELECT` the row afterwards you are reading a new snapshot: under READ COMMITTED, *"a SELECT query sees only data committed before the query began"*, and another transaction may have updated the row between your `INSERT` committing and your `SELECT` starting. Your create response would then describe a state your create did not produce. Reconstructing the defaults in TypeScript is worse still — it duplicates every `DEFAULT` in the DDL in a second place that no migration will ever update.

**★ You return 201 with the created row in the body. Why also send `Location` when the body already contains the id?**
Because `Location` is the part of the response defined by the protocol, and the body is defined by you. Generic HTTP tooling — a client library that follows the created resource, an API gateway, a test harness, a documentation generator — reads `Location`; none of them knows that your body puts the identifier at `.id` rather than `.data.card.uuid`. And §15.3.2's fallback rule makes the omission actively wrong rather than merely unhelpful: without `Location`, the created resource is defined to be identified by the target URI, which is the collection.

**★ Why is a malformed-JSON body a 400 and a schema violation a 422, when both are "the client sent something bad"?**
Because they fail at different layers and a client debugs them differently. §15.5.1 gives 400 for *"malformed request syntax"* — the bytes are not parseable as the declared media type, and no field-level feedback is even possible. §15.5.21 gives 422 for content where *"the syntax of the request content is correct, but it was unable to process the contained instructions"* — the JSON parsed, so you can point at `title` and say it was too long. A client that gets a 400 should look at its serialiser; a client that gets a 422 should look at its form. Collapsing both into 400 is defensible and common, but you then owe the client a discriminator inside the envelope, because the status code no longer carries the distinction.

**★ Your create handler and a Server Action both create cards. Which one holds the authorisation check?**
Neither — the Data Access Layer does. Both are entry points, and the Next.js data-security guidance is explicit that *"A page-level authentication check does not extend to the Server Actions defined within it"* and that an action *"is reachable to anyone who can send the same POST"*. If the check lives in the Route Handler, the action is unprotected; if it is duplicated in both, you have two implementations that will diverge at the first requirements change. Putting `requireBoardAccess` inside `createCard` means the predicate is enforced once, by construction, for every current and future caller — including the third entry point nobody has written yet.

**★ Is it ever right for a create endpoint to return 202 instead of 201?**
Yes, when the row does not exist by the time you respond. §15.3.3 describes 202 as *"intentionally noncommittal"* — the request was accepted, processing has not completed, and *"There is no facility in HTTP for re-sending a status code from an asynchronous operation."* If creating a card enqueues work and a worker inserts the row later, you cannot honestly send 201, because no resource has been created and you have no `Location` to give. For SprintDesk that is the wrong design — a card creation that the user must poll for is worse UX than a synchronous insert — but for a bulk import endpoint it is exactly right, and the 202 response should point at a status resource the client can poll.

**★ Why is it safe to put a cached `GET` and this `POST` in the same `route.ts`?**
Because the caching decision in Next.js is per method, not per file. The Route Handlers guide states it twice, the second time specifically to close this question: *"Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET` method that is cached, in the same file."* The file is a routing artefact; the method exports are independent handlers with independent caching semantics. What you cannot do is put a `route.js` at the same path as a `page.js` — that is a hard conflict.

---

← [04e · One function per use case](04e-function-per-use-case.md) · [Chapter index](01-explanation.md) · Next → [05b · Validation at the boundary](05b-validating-at-the-boundary-with-zod.md)
