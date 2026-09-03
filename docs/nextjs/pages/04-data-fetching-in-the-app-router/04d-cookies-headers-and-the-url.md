---
title: "Every input to a Route Handler has two doors — next/headers and NextRequest — and the one that surprises people is request.cookies.set, which mutates the request the server is holding and never reaches the browser at all"
sidebar_label: "04d · Cookies, headers and the URL"
sidebar_position: 4.3
description: "cookies() and headers() versus request.cookies and request.headers, why request.cookies.set never reaches a browser, the nextUrl surface, the ip and geo removal in v15.0.0, and query parameters that survive repeated keys and empty values."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`NextRequest`](https://nextjs.org/docs/app/api-reference/functions/next-request) (docs `lastUpdated` 2025-12-04) and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`lastUpdated` 2026-04-30) — the Cookies, Headers and URL Query Parameters examples.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Next.js gives you two ways to read almost everything a request carries, and the documentation shows both without saying which to prefer, so codebases end up using each at random. The rule is simple once stated: `cookies()` and `headers()` from `next/headers` are request-scoped async accessors that work anywhere on the server — a Server Component, a Server Action, a Route Handler — whereas `request.cookies` and `request.headers` are properties of the object this handler was called with. In a Route Handler both are available and the parameter form is usually clearer. What is *not* simple is `request.cookies.set()`, which the documentation describes as setting a cookie on the request: it mutates the object the server is holding, produces no warning, and the browser never hears about it. That one API is responsible for more "the cookie is not being set" hours than everything else in this chapter. Reading the body is [04e](04e-reading-the-request-body-and-validating-at-the-boundary.md).**

## Two doors, and which one to use

| What you want | From `next/headers` | From the handler's parameter |
|---|---|---|
| a cookie's value | `(await cookies()).get('token')` | `request.cookies.get('token')` |
| **send** a cookie to the browser | `(await cookies()).set('token', v)` | 🔴 not this — set it on the **response** |
| a request header | `(await headers()).get('referer')` | `request.headers.get('referer')` |
| **send** a header to the browser | ❌ read-only | set it on the **response** |
| the query string | ❌ | `request.nextUrl.searchParams` |
| the body | ❌ | `await request.json()` and friends |

Both `cookies()` and `headers()` are **async** — you `await` the accessor, then call methods on what it returns. The instance `headers()` gives you is **read-only**; to send a header you return a new `Response` carrying it.

```ts
// app/api/session/route.ts
import { cookies, headers } from 'next/headers'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const headerList = await headers()

  const token = cookieStore.get('token')?.value      // via next/headers
  const alsoToken = request.cookies.get('token')     // via the parameter
  const referer = headerList.get('referer')

  return Response.json({ signedIn: Boolean(token && alsoToken), referer })
}
```

In a Route Handler, prefer the parameter form: it is explicit about where the value came from, it needs no `await` on the accessor, and it keeps the handler readable as an ordinary function of its argument. Reach for `next/headers` when the reading code is a shared helper that must also work inside a Server Component or a Server Action, where there is no `request` to pass it.

## 🔴 `request.cookies.set` does not reach the browser

The documented surface of `request.cookies` is `get`, `getAll`, `set`, `delete`, `has` and `clear` — and every one of them, the three mutating ones included, operates on **the request**. `set` is documented as setting a cookie with the given value *on the request*; `delete` removes it *from the request*; `clear` removes all of them *from the request*.

That is genuinely useful: it lets one part of a server-side pipeline hand a value to a later part. It is never how you set a cookie on a client. For that, set it on the response:

```ts
// app/api/session/route.ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  const session = await signIn(email, password)
  if (!session) return apiError(401, 'invalid_credentials', 'Email or password is incorrect.')

  // (a) via next/headers — the cookie is attached to the outgoing response
  const cookieStore = await cookies()
  cookieStore.set('session', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })

  return Response.json({ data: { userId: session.userId } })
}

export async function DELETE() {
  // (b) via NextResponse — the same thing, expressed on the response object
  const response = NextResponse.json(null, { status: 200 })
  response.cookies.delete('session')
  return response
}
```

Both forms work. What does not work — and produces no error, no warning and no cookie — is `request.cookies.set('session', token)` followed by returning a response. `httpOnly` and `secure` are not optional decoration on a session cookie: without the first, any XSS reads the token; without the second, a plaintext request leaks it ([12](12-bff-proxying-webhooks-and-callback-routes.md)).

## `nextUrl`, and the two properties that were removed

`nextUrl` extends the native `URL` with Next-specific values. The documented additions are:

| Property | Type | What it is |
|---|---|---|
| `basePath` | `string` | the configured `basePath` of the URL |
| `buildId` | `string` \| `undefined` | the build identifier of the application |
| `pathname` | `string` | the pathname of the URL |
| `searchParams` | `Object` | the parsed search parameters |

`request.nextUrl.searchParams` is the reason to prefer it over `new URL(request.url).searchParams`: the parsing is done for you, and `basePath` is exposed separately so a handler under a configured base path can build correct links without string surgery. The one place the raw `request.url` remains the right input is as a base for resolving a relative URL — `new URL('/projects', request.url)`.

🔴 **`ip` and `geo` were removed from `NextRequest` in `v15.0.0`.** Code reading `request.ip` gets `undefined` — not a type error in JavaScript, and not a runtime error either — so a geo-gate silently lets everyone through and a rate limiter silently collapses every visitor into one bucket. Read the platform's forwarding header instead:

```ts
// x-forwarded-for is client-settable unless a trusted proxy overwrites it.
const forwarded = request.headers.get('x-forwarded-for')
const clientIp = forwarded?.split(',')[0]?.trim() ?? null
```

⚠️ Which header carries a trustworthy client address, and how many hops to skip before the value can be believed, is a property of your deployment rather than of Next.js. The pages verified here do not specify one; treat any value you did not put there yourself as attacker-controlled, and see [13](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md) before keying anything security-relevant on it.

## Query parameters that survive real URLs

`searchParams` is a `URLSearchParams`, and it has exactly two failure modes: `get()` silently returns only the first value for a repeated key, and everything it returns is a string.

```ts
// app/api/projects/route.ts — GET /api/projects?status=open&status=blocked&page=2&limit=500
import { type NextRequest } from 'next/server'
import { z } from 'zod'

const ListQuery = z.object({
  status: z.array(z.enum(['open', 'blocked', 'done'])).default([]),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(200).optional(),
})

export const GET = withApiErrors(async (request) => {
  const sp = (request as NextRequest).nextUrl.searchParams

  const parsed = ListQuery.safeParse({
    status: sp.getAll('status'),                    // getAll, not get
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    q: sp.get('q') ?? undefined,
  })
  if (!parsed.success) {
    return apiError(422, 'validation_failed', 'Invalid query parameters.', {
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    })
  }

  const { status, page, limit, q } = parsed.data
  const rows = await db.project.findMany({
    where: {
      status: status.length ? { in: status } : undefined,
      name: q ? { contains: q } : undefined,
    },
    skip: (page - 1) * limit,
    take: limit,
  })
  return Response.json({ data: rows, page, limit })
})
```

Three decisions there are worth naming. `getAll` for anything that can legitimately repeat. `z.coerce` because every value is a string and `Number('')` is `0` — a `limit=` with nothing after it becomes a page size of zero unless something rejects it. And `.max(100)` on `limit`, because a query parameter is a request from a stranger for however much of your database they would like.

Keeping the schema next to the handler, exported, has a second payoff: it is the only artefact that states the endpoint's query contract, so it can generate both the client's types and the documentation instead of the three drifting apart.

## Gotchas

**★ Symptom: you call `request.cookies.set(...)`, return a response, and the browser has no cookie.** Cause: `request.cookies.set` operates on the request the server is holding, exactly as documented. It is not a response API and it produces no warning. Fix: set it on the response.

```ts
const response = NextResponse.json({ ok: true })
response.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
return response
```

**★ Symptom: `cookies().get is not a function`, or `headers().get is not a function`.** Cause: both accessors are async and you called a method on the promise. Fix: `const store = await cookies()`, then `store.get(...)`.

**★ Symptom: a rate limiter or a geo-gate treats every visitor as the same visitor.** Cause: `request.ip` and `request.geo` were removed from `NextRequest` in `v15.0.0`, so the read yields `undefined` and every key collapses into one bucket. Fix: read the forwarding header your platform sets, and take the hop your platform guarantees — not simply the first entry, which the client supplies.

**★ Symptom: `?status=open&status=blocked` filters on `open` only.** Cause: `searchParams.get()` returns the first value for a repeated key, silently. Fix: `getAll('status')` for anything that can repeat, and decide explicitly what a repeated key means for the ones that cannot.

**★ Symptom: `?limit=` (empty) returns zero rows, and `?limit=100000` returns the whole table.** Cause: every query value is a string; `Number('')` is `0` and `Number('100000')` is exactly what it says. Fix: coerce and clamp in a schema — `z.coerce.number().int().min(1).max(100).default(20)` — so both cases are handled before the query is built.

**★ Symptom: an endpoint under a configured `basePath` builds links with the prefix missing or doubled.** Cause: `new URL(request.url).pathname` is the raw path; `nextUrl` separates `pathname` from `basePath` after Next has parsed the request. Fix: route on `request.nextUrl.pathname` and construct with `request.nextUrl.basePath`, rather than slicing strings.

**Symptom: a header lookup returns `null` for a header you can see in the browser's dev tools.** Cause: the `Headers` API already normalises case, so it is not a capitalisation problem — a hop stripped the header, or it was never forwarded. Fix: check with `has()` and log the whole header list once while debugging, instead of guessing at spellings the API has already normalised for you.

**Symptom: you set a session cookie and a later XSS report shows the token was readable from JavaScript.** Cause: the cookie was set without `httpOnly`, and often without `secure` too. Fix: both flags on anything that authenticates, always — two words that decide whether an XSS is an annoyance or an account takeover.

**Symptom: two handlers disagree about whether a query parameter is required and the client cannot tell which is right.** Cause: query parsing written inline, per handler, from memory. Fix: one exported schema per endpoint next to its handler — a value the tests, the client types and the documentation can all read.

**Symptom: a value read through `next/headers` in a shared helper differs from the one on `request` in the caller.** Cause: something upstream mutated the request's cookie jar with `request.cookies.set`, which is exactly what that API is for. Fix: nothing is broken — but be deliberate about it, because a helper reading through `next/headers` and a handler reading through `request.cookies` can legitimately see two different values in the same invocation.

## Interview questions

**★ There are two ways to read a cookie in a Route Handler. Which do you use, and where does the choice actually matter?**
`request.cookies.get()` inside a handler that already has the request — explicit about provenance, no `await` on an accessor, and it reads as an ordinary function of its argument. `(await cookies()).get()` when the reading code is a shared helper that must also work in a Server Component or a Server Action, where there is no `request` to hand it. The choice matters most for the mutating case: `request.cookies.set()` mutates the *request*, so if the helper's job is to **send** a cookie, only the `next/headers` store or the response object will do.

**★ Someone reports that setting a cookie in a Route Handler "does nothing". What do you look at first?**
Whether they called `request.cookies.set()`. It is documented as setting a cookie on the request, so it mutates the object the server is holding and never becomes a `Set-Cookie` on the way out — and because it is a legitimate API doing precisely what it says, there is no warning, no error and nothing in the logs. The fix is to set it on the response, either through `NextResponse`'s `cookies` or through the `next/headers` cookie store, which attaches to the outgoing response.

**★ What was removed from `NextRequest` in v15, and why does its absence not crash anything?**
`ip` and `geo`. They are removed rather than deprecated, so the properties simply do not exist — and reading a missing property in JavaScript yields `undefined` rather than throwing. A rate limiter keyed on `request.ip` therefore keeps working, with every request landing in the same bucket, and a geo-gate keeps working by letting everybody through. That is the worst failure shape available: no error, no alert, and a security control that is off. The replacement is whatever forwarding header your platform sets, with the caveat that a client can put anything in `x-forwarded-for` unless a trusted hop overwrites it.

**★ Why is `searchParams.get()` a hazard, and what do you use instead?**
Because a repeated key is legal in a URL and `get()` returns only the first value, silently. `?status=open&status=blocked` filters on `open` and nobody sees an error. `getAll()` is the answer for anything that can legitimately repeat. The related hazard in the same line of code is that everything `URLSearchParams` yields is a string, so `Number('')` gives a page size of zero — which is why query parsing belongs in a coercing, bounded schema rather than a chain of `??` defaults.

**★ Why prefer `request.nextUrl` over `new URL(request.url)`?**
Because `nextUrl` is already parsed and carries the Next-specific values the raw URL does not separate — `basePath`, `buildId`, and a `pathname` reflecting how the framework routed the request. Constructing your own `URL` works, and then every link you build under a configured `basePath` needs string surgery you would otherwise not write. The exception is resolution: `new URL('/projects', request.url)` is still the right way to turn a relative path into an absolute one.

**What is the practical difference between the `headers()` instance and `request.headers`?**
For reading, none that matters — both give you the incoming headers, and the `Headers` API normalises case on both. The difference is availability and intent: `headers()` works anywhere on the server and is async, `request.headers` exists only where a request object was passed. Neither can send a header, because the `headers()` instance is explicitly read-only and `request.headers` is the inbound set. Sending is a property of the `Response` you return, always.

**A query parameter is used to build a database filter. What are the three things you check before it reaches the query?**
That repeated keys are handled — `getAll` versus `get`. That the string is coerced to the type the query expects, because everything from a URL is a string and empty strings coerce to zero. And that any unbounded value is clamped, because `limit`, `depth`, `radius` and `days` are all requests from a stranger for as much work as you are willing to do. A schema does all three in one place and produces a `422` with per-field messages when it fails.

---

← [04c · Error responses](04c-error-responses-a-client-can-branch-on.md) · [Chapter 4 overview](01-explanation.md) · Next → [04e · Reading the body](04e-reading-the-request-body-and-validating-at-the-boundary.md)
