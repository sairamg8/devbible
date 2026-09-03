---
title: "Every Route Handler eventually returns an error, and there are exactly two ways to get it wrong: shipping the caught exception's own message to the browser, and shipping a different envelope from every endpoint so no client can branch on any of them"
sidebar_label: "04c · Error responses"
sidebar_position: 4.2
description: "One error envelope served as application/problem+json, a wrapper that guarantees it on every path without swallowing redirect(), what must never appear in a body sent to a client, correlation ids, per-field validation errors, and Retry-After for 429 and 503."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (docs `lastUpdated` 2026-06-25) and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`lastUpdated` 2026-04-30). Media type and envelope shape per the IETF *Problem Details for HTTP APIs* convention.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**The documentation's own error-handling snippet returns `reason.message` to the client and then, in the very next line, warns you not to expose sensitive information in error messages. That is not a contradiction — it is the docs showing a shape and telling you to tighten it — and the tightening is the whole subject of this page. A driver error routinely carries a table name, a column name, a constraint name or a fragment of a connection string; an ORM error carries the query. Returning it is a disclosure. But the second failure is quieter and more expensive: an API where each handler invents its own error shape, so the client ends up with a `try/catch` per endpoint and no way to distinguish "you sent the wrong thing" from "we are broken" from "try again in thirty seconds". One envelope, one wrapper, one media type. The success paths are on [04b](04b-constructing-the-response-status-codes-and-streaming.md).**

## What an error body is for

An error response has three audiences and they want different things:

- **Code** wants a stable string it can `switch` on. Not the status — several conditions share `409` — and never the English text, which you will reword.
- **A human** wants one short sentence that is safe to render, and never a stack frame.
- **Support** wants an identifier that joins the user's screenshot to a line in your logs. That identifier must be in *both*.

The convention that encodes all three is *Problem Details for HTTP APIs*, served as `application/problem+json`. The media type matters: a client that sees `application/json` cannot tell a payload from a problem without inspecting it, whereas `application/problem+json` is self-describing and generic clients already know it.

```ts
// lib/api-error.ts
export type ApiErrorBody = {
  code: string                            // stable and machine-readable: 'project_not_found'
  title: string                           // short, human, safe to display verbatim
  status: number
  requestId: string                       // also written to the log line
  fields?: Record<string, string[]>       // per-field messages, for 422
}

export function apiError(
  status: number,
  code: string,
  title: string,
  extra?: {
    fields?: Record<string, string[]>
    retryAfterSeconds?: number
    requestId?: string
  },
): Response {
  const requestId = extra?.requestId ?? crypto.randomUUID()
  const headers = new Headers({ 'Content-Type': 'application/problem+json' })
  if (extra?.retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(extra.retryAfterSeconds))
  }

  const body: ApiErrorBody = { code, title, status, requestId, fields: extra?.fields }
  return new Response(JSON.stringify(body), { status, headers })
}
```

Every `code` in that API should live in one place, so that "what can this endpoint return" is answerable by reading a file rather than by grepping:

```ts
// lib/api-codes.ts
export const ApiCode = {
  ValidationFailed: 'validation_failed',
  ProjectNotFound: 'project_not_found',
  StaleVersion: 'stale_version',
  NameTaken: 'name_taken',
  RateLimited: 'rate_limited',
  StorageUnavailable: 'storage_unavailable',
  InternalError: 'internal_error',
} as const

export type ApiCode = (typeof ApiCode)[keyof typeof ApiCode]
```

## One wrapper, so the envelope is guaranteed rather than remembered

A handler that returns the envelope on the paths you thought about, and lets the framework produce an HTML error page on the paths you did not, has an API contract that holds only while nothing goes wrong. Wrap instead.

```ts
// lib/with-api-errors.ts
import { ZodError } from 'zod'
import { apiError } from './api-error'
import { ApiCode } from './api-codes'

type Handler<C> = (request: Request, context: C) => Promise<Response>

// A thrown redirect() or notFound() carries a `digest` string. Re-throw those untouched.
function isControlFlow(cause: unknown): boolean {
  return typeof (cause as { digest?: unknown } | null)?.digest === 'string'
}

export function withApiErrors<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    const requestId = crypto.randomUUID()
    try {
      return await handler(request, context)
    } catch (cause) {
      if (isControlFlow(cause)) throw cause          // 🔴 never swallow control flow

      if (cause instanceof ZodError) {
        return apiError(422, ApiCode.ValidationFailed, 'One or more fields are invalid.', {
          requestId,
          fields: cause.flatten().fieldErrors as Record<string, string[]>,
        })
      }

      // The real error goes to the log, joined to the id the client is holding.
      console.error('[api]', requestId, request.method, request.url, cause)
      return apiError(500, ApiCode.InternalError, 'Something went wrong on our side.', {
        requestId,
      })
    }
  }
}
```

```ts
// app/api/projects/[id]/route.ts
import { withApiErrors } from '@/lib/with-api-errors'
import { apiError } from '@/lib/api-error'
import { ApiCode } from '@/lib/api-codes'

export const GET = withApiErrors(async (request, ctx: RouteContext<'/api/projects/[id]'>) => {
  const { id } = await ctx.params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return apiError(404, ApiCode.ProjectNotFound, 'No project with that id.')
  return Response.json({ data: project })
})
```

`export const GET = withApiErrors(...)` is a named export whose value is a function, and the router reads only the name ([04](04-route-handlers-routets-for-restful-apis.md)) — so wrapping every handler is structurally free.

⚠️ The `digest` test is a heuristic, not a documented contract: the pages verified here do not specify how a thrown `redirect()` or `notFound()` is identified from user code. If you would rather not depend on it at all, keep `redirect()` outside the `try` block — the structural fix rather than the detection one. Either way the rule stands: **a blanket `catch` around a Next.js handler will convert a redirect into an error unless something stops it.**

## What must never appear in a body sent to a client

- **The caught error's `message`.** This is the whole point. Driver, ORM and HTTP-client errors carry table names, column names, constraint names, hostnames, ports and sometimes credentials.
- **A stack trace**, in any environment that a user can reach. It maps your source tree.
- **The upstream response body** from a service you called. It is a different system's error contract and it may be far more detailed than yours.
- **The value that failed validation**, echoed back. Echoing a password, a token or a card number into a `422` puts it into every log between you and the browser.
- **Whether a record exists**, on an endpoint where existence is itself private. That is the `403`-versus-`404` decision from [04b](04b-constructing-the-response-status-codes-and-streaming.md), and it applies to the error *text* as well as the status: "no user with that email" and "wrong password" are two different disclosures.

⚠️ I could not confirm from the pages verified here what Next.js itself sends to the client for an *unhandled* throw in a Route Handler in production, or whether the message is redacted. Do not build on an assumption either way — wrap the handler so the question never arises.

## Validation errors that a form can render

A `422` is the only error a client usually renders field by field, so its shape decides how much translation the client has to do. Flatten to `field → messages` and let the caller map it straight onto inputs.

```ts
// app/api/projects/route.ts
import { z } from 'zod'

const CreateProject = z.object({
  name: z.string().min(1, 'Name is required.').max(120, 'Name is too long.'),
  description: z.string().max(2000).optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
})

export const POST = withApiErrors(async (request) => {
  const parsed = CreateProject.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(422, ApiCode.ValidationFailed, 'One or more fields are invalid.', {
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    })
  }

  try {
    const created = await db.project.create({ data: parsed.data })
    return Response.json({ data: created }, {
      status: 201,
      headers: { Location: `/api/projects/${created.id}` },
    })
  } catch (cause) {
    if (isUniqueViolation(cause, 'name')) {
      return apiError(409, ApiCode.NameTaken, 'A project with that name already exists.', {
        fields: { name: ['Already taken.'] },
      })
    }
    throw cause          // let the wrapper produce the 500 and the log line
  }
})
```

Two things are deliberate. `safeParse` returns rather than throws, so the `422` is an explicit code path rather than a side effect of the wrapper. And the uniqueness violation becomes a `409` with the *same* `fields` shape as the `422`, so the client renders it with the same code.

## Back-pressure: `429` and `503` are instructions, not complaints

An error the client can act on is worth far more than one it can only log. `Retry-After` is what turns a rejection into a schedule — and without it, a well-behaved client and a badly-behaved one are indistinguishable, because neither has been told anything.

```ts
export const POST = withApiErrors(async (request) => {
  const key = clientKey(request)             // see 13 for how to derive this safely
  const verdict = await rateLimiter.check(key)
  if (!verdict.allowed) {
    return apiError(429, ApiCode.RateLimited, 'Too many requests. Try again shortly.', {
      retryAfterSeconds: verdict.retryAfterSeconds,
    })
  }
  return handleCreate(request)
})
```

`Retry-After` accepts either a number of seconds or an HTTP date. Seconds is the safer choice: a date requires the client's clock to be right, and a client whose clock is wrong will either hammer you immediately or wait for hours.

The same header belongs on a `503` when you are shedding load or a dependency is down, and it is the difference between a fleet of clients backing off and a fleet of clients synchronising into a thundering herd the moment your dependency recovers. Rate limiting itself — where the counter lives, and how to derive a client key that cannot be spoofed — is on [13](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md).

## Distinguishing your failure from theirs

When the handler is a front for something else, the status should say whose fault it is:

```ts
const upstream = await fetch(url, { signal: AbortSignal.timeout(3_000) }).catch(() => null)

if (upstream === null) {
  // Timed out or the connection failed: THEY did not answer.
  return apiError(504, ApiCode.StorageUnavailable, 'Upstream timed out.', { retryAfterSeconds: 5 })
}
if (!upstream.ok) {
  // They answered, with a failure. Do not forward their body.
  console.error('[api] upstream', upstream.status, url)
  return apiError(502, ApiCode.StorageUnavailable, 'Upstream returned an error.')
}
```

A `502`/`504` tells a caller that retrying may work and that the bug is not in their request; a blanket `500` tells them nothing and invites a support ticket. The `AbortSignal.timeout` is not decoration — without it a hung upstream holds your handler until the platform's own execution limit kills it, and every concurrent caller queues behind that.

## Gotchas

**★ Symptom: a `500` in your logs contains a stack trace and the same `500` in the browser contains a table name.** Cause: the handler returned the caught error's `message`, exactly as the documentation's illustrative snippet does before warning you against it. Fix: log the real error against a correlation id; return the opaque envelope carrying only that id.

```ts
console.error('[api]', requestId, request.method, request.url, cause)
return apiError(500, ApiCode.InternalError, 'Something went wrong on our side.', { requestId })
```

**★ Symptom: the client receives an HTML error page from an endpoint that has only ever returned JSON.** Cause: the handler threw on a path you did not anticipate, the framework produced its own error response, and your envelope never ran. The client's `await res.json()` then fails with a parse error naming neither the endpoint nor the real cause. Fix: wrap every handler, so the envelope is structural rather than remembered.

**★ Symptom: two endpoints in the same API return errors with different field names, and the client has two parsers.** Cause: envelopes written per handler. Fix: one `apiError` helper, one code enum, one wrapper, imported everywhere — the shape becomes reviewable in code review rather than discovered by the consumer.

**★ Symptom: a redirect in a wrapped handler turns into a `500` with your generic envelope.** Cause: `redirect()` and `notFound()` signal by throwing, and the wrapper's `catch` treated the control-flow exception as an error. Fix: re-throw it before any other branch, or keep the call outside the `try`.

```ts
catch (cause) {
  if (isControlFlow(cause)) throw cause   // first line of the catch, before anything else
  // …
}
```

**★ Symptom: the client cannot tell "you sent the wrong thing" from "we are broken" and retries both.** Cause: everything returns `500`. Fix: give each condition a status *and* a stable `code`, and reserve `500` for "we threw and did not expect to". A client's retry policy is written against those codes, not against your prose.

**★ Symptom: `429` responses are ignored and the client hammers straight through the limit.** Cause: no `Retry-After`, so there is nothing to obey. Fix: send it — in seconds, not as an HTTP date, so a wrong client clock cannot turn a thirty-second pause into a six-hour one.

**★ Symptom: a login endpoint's error text tells an attacker which email addresses are registered.** Cause: "no user with that email" and "wrong password" are two different messages for two different conditions. Fix: one message and one code for both, and keep the distinction only in the log.

**★ Symptom: one slow upstream makes every endpoint that touches it slow, then makes the whole deployment slow.** Cause: a `fetch` with no timeout holds the handler until the platform's execution limit fires, and concurrent callers queue behind it. Fix: `AbortSignal.timeout(...)` on every outbound call, and a `504` when it fires.

**Symptom: a `422` echoes the rejected value back and the value was a password.** Cause: a generic "invalid value: X" formatter. Fix: return the field *name* and a message about the rule, never the submitted value.

**Symptom: support cannot find the log line for the error the user screenshotted.** Cause: the correlation id is generated in the log statement, or in the response, but not shared between them. Fix: generate it once at the top of the wrapper and pass it to both — as `withApiErrors` does.

**Symptom: an error `code` was reworded and a client broke.** Cause: `code` and `title` got conflated, so the human-readable string was the thing being matched on. Fix: keep them structurally separate — `code` is an identifier under change control, `title` is prose you may rewrite whenever you like.

**Symptom: your handler forwards the upstream service's error body and a caller starts depending on its shape.** Cause: pass-through error handling. Fix: translate into your own envelope. You now own that upstream's error contract as part of your public API otherwise, including the next time they change it.

**Symptom: `502`, `503` and `504` never appear in your API, only `500`.** Cause: every failure path collapses into one branch. Fix: distinguish "they did not answer" (`504`), "they answered with a failure" (`502`) and "we are deliberately shedding load" (`503`) — three different remediations for the caller, and three different alerts for you.

## Interview questions

**★ Design an error response a client can branch on. What must never be in it?**
A stable machine-readable `code`, a short human `title`, the numeric `status`, and a correlation id that also appears in your logs; for validation failures, a `fields` map from field name to messages. Serve it as `application/problem+json` so a generic client knows it is a problem without inspecting it. What must never be in it: the caught error's own message, a stack trace, the upstream's error body, or the value that failed validation. Log the real error against the correlation id and return the opaque one — that pairing is what makes support possible without disclosure.

**★ The documentation's own snippet returns `reason.message` to the client. Is the documentation wrong?**
No — it shows the shape of a `try/catch` in a handler and then warns, in the next line, against exposing sensitive information in error messages sent to the client. It is illustrating structure, not endorsing the payload. But it is worth knowing that the snippet is the one people copy, which is why a large number of production APIs return driver errors verbatim. Treat the warning as the instruction and the snippet as the skeleton.

**★ Why wrap every handler rather than writing `try/catch` where you need it?**
Because the paths you did not think about are exactly the ones that produce the wrong response. A handler with per-path error handling has a contract that holds while nothing unexpected happens; a wrapped handler has one that holds always. The wrapper also gives you a single place for the three cross-cutting jobs — generating the correlation id, writing the log line, and mapping known exception types like `ZodError` onto statuses — so those stop being copy-pasted and start being reviewable.

**★ What is the one thing a `catch` in a Next.js Route Handler must do before anything else?**
Re-throw control-flow exceptions. `redirect()` and `notFound()` signal by throwing, so a blanket `catch` converts a working redirect into a `500` with a perfectly formatted error envelope — which is worse than crashing, because it looks deliberate. The alternative that needs no detection at all is structural: keep those calls outside the `try`.

**★ How should a `422` be shaped so a form can render it?**
As `field → array of messages`, flattened, using the same field names the client submitted. That lets the client map errors straight onto inputs without a translation layer. The follow-on that most APIs miss is consistency: a uniqueness violation caught from the database is not a schema failure, but it is *rendered* in the same place, so it should carry the same `fields` shape with a `409` status and its own code. One rendering path, two conditions.

**★ Why does `Retry-After` matter, and why seconds rather than a date?**
Because it converts a rejection into a schedule. Without it a client has no information at all and its only options are to give up or to retry immediately, and the second is what turns a rate limit into an outage. Seconds rather than an HTTP date because a date depends on the client's clock being correct: a skewed clock either retries instantly or waits for hours, and you find out from whichever failure mode is more expensive.

**★ How do you distinguish your failures from your upstream's in a status code, and why bother?**
`504` when the upstream did not answer within your timeout, `502` when it answered with a failure, `503` when you are deliberately shedding load, and `500` only when you threw unexpectedly. It matters because each implies a different action for the caller — retry with backoff, stop and report, wait for `Retry-After`, open a ticket — and a blanket `500` implies all of them and none of them. It also matters for your own alerting: a spike in `502` is somebody else's incident, a spike in `500` is yours.

**Your API returns `404` for a resource the caller is not allowed to see. Is that a lie?**
It is a deliberate reduction in disclosure, and it is defensible — `403` confirms that the resource exists, which on some resources is itself the secret. What is not defensible is inconsistency, because a client's behaviour diverges: many treat `404` as "stop, it is gone" and `403` as "escalate to a human". Choose per resource, write it down, and make sure the error *text* respects the same choice — a `404` whose message says "you do not have access to this project" has given the game away anyway.

**What goes in the log that does not go in the response, and vice versa?**
The log gets the exception, its stack, the resolved identity of the caller, the upstream status if there was one, and the request URL. The response gets the status, a stable code, a safe sentence and the correlation id. The id is the only field that appears in both, and it is the entire reason this arrangement works: the user can paste something into a ticket that leads you to the full detail, without that detail ever having crossed the network.

---

← [04b · Constructing the response](04b-constructing-the-response-status-codes-and-streaming.md) · [Chapter 4 overview](01-explanation.md) · Next → [04d · Reading the request](04d-cookies-headers-and-the-url.md)
