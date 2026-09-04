---
title: "Next.js prescribes no error-response shape for a Route Handler, so the envelope, the status mapping and the correlation id are all yours to design and to enforce"
sidebar_label: "04b · Designing the error envelope"
sidebar_position: 14
description: "A minimum useful envelope — machine-readable code, safe message, correlation id — the handler's substitute for error.digest, and why the status code is the only part of your failure that generic infrastructure understands."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`route.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/route)
> — page metadata `version: 16.3.4`, `lastUpdated: 2026-04-30`. 🔴 **The reference prescribes no
> response shape**; its only error example is the webhook `try`/`catch` quoted in
> [04](04-route-handler-error-responses-and-consistent-api-error-envel.md). Everything below is
> **this book's recommendation**, marked as such, built on what the reference does guarantee.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**The absence is the point.** A page gets `error.js`, a fallback UI, a `retry()` and a `digest`
that correlates what the user saw with what the server logged. A Route Handler gets a function
signature. Every one of those affordances has an equivalent that you have to build, and teams
usually build three of them — one per endpoint, subtly different, discovered by the client
developer at integration time. The work here is not difficult; it is just work nobody is prompted
to do, because nothing fails until somebody has to debug a customer's failed request from the
outside.


## What an envelope buys, and why you have to design it

*(This section is this book's recommendation. The `route.js` reference does not prescribe a
response shape.)*

A consistent envelope means a client can write one error path instead of one per endpoint. The
minimum useful shape carries a machine-readable code, a human-readable message, and something to
correlate with a log:

```ts
// lib/api-error.ts
export type ApiErrorBody = {
  error: {
    code: string // stable, machine-readable: 'validation_failed', 'not_found'
    message: string // safe to show a human; never a raw exception message
    requestId: string // the same value you logged server-side
    details?: unknown // field-level errors, only for validation
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiErrorResponse(err: ApiError, requestId: string): Response {
  return Response.json(
    { error: { code: err.code, message: err.message, requestId, details: err.details } },
    { status: err.status, headers: { 'x-request-id': requestId } }
  )
}
```

```ts
// app/api/tasks/[id]/route.ts
import { randomUUID } from 'node:crypto'
import { ApiError, apiErrorResponse } from '@/lib/api-error'
import { getTaskForUser } from '@/lib/tasks'

export async function GET(_req: Request, ctx: RouteContext<'/api/tasks/[id]'>) {
  const requestId = randomUUID()

  try {
    const { id } = await ctx.params
    const task = await getTaskForUser(id)
    if (!task) throw new ApiError(404, 'not_found', 'No task with that id')
    return Response.json({ data: task })
  } catch (cause) {
    if (cause instanceof ApiError) return apiErrorResponse(cause, requestId)

    // unclassified: log the real error, return a safe one
    console.error({ requestId, cause })
    return apiErrorResponse(
      new ApiError(500, 'internal_error', 'Something went wrong'),
      requestId
    )
  }
}
```

🔴 **The `requestId` is the handler's substitute for `error.digest`.** In a page, the framework
generates a digest that ties the generic client-side message to a server log entry — that
mechanism is described in [09 · `error.js` props](09-errorjs-props-retry-and-reset.md). No such
thing exists for a handler, so if you want a support engineer to be able to find the log line for
a customer's failed request, you have to mint and return the correlator yourself.

## Choosing the status code honestly

The status is the only part of your error that generic infrastructure understands — retries,
circuit breakers, alerting and client SDKs all branch on it. Two rules earn their keep:

- **4xx means "do not retry this request unchanged".** If a retry of the identical request could
  succeed, it is a 5xx.
- **Never return 200 with an error body.** It defeats every layer above you, and it is
  indistinguishable from success to anything that does not parse JSON.

```ts
function statusForFailure(cause: unknown): number {
  if (cause instanceof ValidationError) return 400 // client must change the request
  if (cause instanceof UnauthenticatedError) return 401
  if (cause instanceof ForbiddenError) return 403
  if (cause instanceof NotFoundError) return 404
  if (cause instanceof ConflictError) return 409 // e.g. optimistic-concurrency mismatch
  if (cause instanceof UpstreamTimeoutError) return 504 // retriable: not the caller's fault
  return 500
}
```

## Gotchas

### The raw exception message returned to a public caller
**Symptom.** A pen-test report quotes your database table names and file paths back to you, taken
from an API error response.
**Cause.** `error.message` was passed through into the body.
**Fix.** Log the real error with a correlator, return a safe message and the correlator — the
`apiErrorResponse` shape above does exactly this.

### Returning 200 with `{ "error": ... }` because "the client checks the body"
**Symptom.** Retries never happen, monitoring shows a perfect success rate, and a CDN caches the
failure.
**Cause.** The status is the only signal every layer between you and the caller understands.
**Fix.** Set the status to match the failure, and put the detail in the body as well.

### A different error shape on every endpoint
**Symptom.** The client SDK has a per-endpoint error path, and a new endpoint means new client
code before it can be used at all.
**Cause.** No shared envelope. Each handler invented its own, and each one is individually
reasonable.
**Fix.** Put the shape and the mapping in one module and route every handler through it, so
adding an endpoint adds no client work.

```ts
// lib/with-api-errors.ts — one wrapper, one shape, every route
import { randomUUID } from 'node:crypto'
import { ApiError, apiErrorResponse } from './api-error'

export function withApiErrors<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
) {
  return async (...args: A): Promise<Response> => {
    const requestId = randomUUID()
    try {
      return await handler(...args)
    } catch (cause) {
      if (cause instanceof ApiError) return apiErrorResponse(cause, requestId)
      console.error({ requestId, cause })
      return apiErrorResponse(
        new ApiError(500, 'internal_error', 'Something went wrong'),
        requestId
      )
    }
  }
}
```

```ts
// app/api/tasks/route.ts
import { withApiErrors } from '@/lib/with-api-errors'

export const GET = withApiErrors(async () => {
  return Response.json({ data: await listTasks() })
})
```

### A correlation id that is logged but not returned
**Symptom.** Support asks the customer for "the request id" and the customer does not have one,
because it only ever existed in the server log.
**Cause.** The id was generated for logging and never made it into the response.
**Fix.** Return it in both the body and a header. The header survives a client that discards the
body on a non-2xx status, which many HTTP libraries do by default.

### A wrapper that swallows the framework's control-flow throws
**Symptom.** A `redirect()` inside a wrapped handler stops working after the shared error wrapper
is introduced.
**Cause.** The wrapper's `catch` treats every throw as an application error, including the
control-flow exceptions `redirect()` and `notFound()` rely on.
**Fix.** Let framework throws through — the same rule, and the same tool, as everywhere else in
this chapter. See [01d · Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md).

```ts
import { unstable_rethrow } from 'next/navigation'

// inside the wrapper's catch, before anything else:
catch (cause) {
  unstable_rethrow(cause)
  // ...classify and respond
}
```
## Interview questions

**★ Is there an official error-envelope format in Next.js?**
No. The `route.js` reference shows a `try`/`catch` returning a 400 with a text body and does not
prescribe a response shape at all. Any envelope — a `code`, a safe `message`, a correlation id —
is an application-level convention you design and enforce yourself.

**★ A page has `error.digest` to correlate a user-visible error with a server log. What is the
equivalent in a Route Handler?**
There isn't one — you build it. Generate a request id at the top of the handler, log it alongside
the real error, and return it in both the body and a header so a support engineer can find the
log line from what the customer can see.

**★ Why is "never return 200 with an error body" a strong rule rather than a preference?**
Because the status line is the only part of the response that generic infrastructure reads.
Client SDKs, retry policies, circuit breakers, CDN caching rules and uptime monitors all branch
on it and none of them parse your JSON. A 200 with an error body is invisible to every one of
them — the same blindness that a mid-stream failure creates for a page, described in
[02 · Errors in streaming](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md).

**★ What belongs in an error body that is safe to return to an untrusted caller?**
A stable machine-readable code, a message written for a human that you chose deliberately, and a
correlation id. Not the exception's own message, not a stack, not a query — those name tables,
paths and infrastructure. The rule is that everything in the body is something you wrote on
purpose, rather than something that happened to be attached to an error object.

**★ Why put the correlation id in a header as well as the body?**
Because many HTTP clients discard or never parse the body of a non-2xx response, and because
proxies and log aggregators can capture a header without understanding your schema. The body is
for the application; the header is for everything between you and it.

**★ How do you decide between 4xx and 5xx when the cause is ambiguous?**
Ask whether an identical retry could succeed. If it could — a timeout, a dependency being
briefly unavailable, a lock contention — it is a 5xx, because the caller did nothing wrong and
retrying is the correct behaviour. If the request must change before it can succeed, it is a 4xx.
Getting this backwards is what makes senders discard events they should have redelivered.

**★ A shared error wrapper sounds like it belongs in middleware. Why a wrapper function
instead?**
Because the failure it handles happens *inside* the handler, after routing has already chosen it,
and because the wrapper needs the handler's own return type. Proxy-level code runs before the
handler and cannot catch what the handler throws; it is the right place for early rejection, not
for shaping an error the handler produced.
---

← [04 · Route Handler error responses](04-route-handler-error-responses-and-consistent-api-error-envel.md) · **Next → [05 · `loading.tsx` vs inline Suspense](05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md)**
