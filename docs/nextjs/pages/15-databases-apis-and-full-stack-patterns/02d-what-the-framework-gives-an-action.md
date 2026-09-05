---
title: "The framework protections around a Server Action are exactly four, they are all mechanical, and a Route Handler gets none of them — so knowing the list is the difference between defence in depth and misplaced trust"
sidebar_label: "02d · What the framework gives you"
sidebar_position: 18
description: "The Origin/Host CSRF comparison and serverActions.allowedOrigins, the 1MB body cap and bodySizeLimit, why both are browser-scoped mechanical checks rather than a security boundary, and the asymmetry with Route Handlers."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Security*, § *Configuration*), [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Allowed origins*) and [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Public Endpoints*, § *Security*, § *Verify payloads*) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Next.js enforces four protections on a Server Action, and the list is worth memorising because it is short, mechanical, and much narrower than the reassurance it produces. The framework checks that the POST carries a same-origin `Origin` header and that it is under a megabyte; it encrypts the action's identifier and any variables the action closed over. That is the whole of it. Every one of those four is about the *transport* — none is about the *caller* — and a Route Handler doing the same job gets none of them.**

## The list, verbatim

> *"Next.js enforces a few framework-level protections:"*

> *"**CSRF check.** The request's `Origin` is compared to the `Host` (or `X-Forwarded-Host`). Mismatches are rejected. Configure [`serverActions.allowedOrigins`] for proxy or CDN domains."*

> *"**Body size limit.** Action requests are capped at 1MB by default. Configure [`serverActions.bodySizeLimit`] when accepting larger payloads."*

> *"**Encrypted action IDs and dead code elimination.** Action references are encrypted at build time, and unused Server Functions are stripped from client bundles so they have no public endpoint."*

> *"**Closure variable encryption.** Variables captured by an inline action are encrypted before being sent to the client. For multi-instance and self-hosted deployments, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable key shared across instances."*

The last two are build-artefact machinery and are covered in [02c](02c-closures-action-ids-and-deploys.md). The first two are runtime checks, and both are configured in one block:

```js
// next.config.js
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
      bodySizeLimit: '2mb',
    },
  },
}
```

## The origin check, precisely

The CSRF story has two layers, and the documentation separates them deliberately:

> *"Behind the scenes, Server Actions use the `POST` method, and only this HTTP method is allowed to invoke them. This prevents most CSRF vulnerabilities in modern browsers, particularly with [SameSite cookies] being the default."*

> *"As an additional protection, Server Actions in Next.js also compare the [Origin header] to the [Host header] (or `X-Forwarded-Host`). If these don't match, the request will be aborted. In other words, Server Actions can only be invoked on the same host as the page that hosts it."*

Three things follow.

**It is browser-enforced, not server-verified.** `Origin` is a forbidden header name — a browser sets it and page script cannot override it. That is what makes the check meaningful against a malicious page. It is *meaningless* against a caller that is not a browser: `curl`, a script, a compromised mobile client or a server-side attacker holding a leaked cookie sets any `Origin` it likes. The check defends against cross-site request forgery. It does not defend against a direct POST, which is exactly the threat the docs warn about elsewhere — *"the route is reachable to anyone who can send the same POST."*

**It is host equality, so anything that rewrites `Host` breaks it.** A reverse proxy terminating `app.example.com` and forwarding to an internal `Host`, a CDN with a different customer-facing domain, a preview URL fronting a production backend — all of them produce a mismatch and an aborted request before your action body runs. `allowedOrigins` is the escape hatch and it accepts wildcards:

```js
experimental: {
  serverActions: {
    allowedOrigins: ['app.example.com', '*.preview.example.com'],
  },
}
```

**It says nothing about identity.** A same-origin POST from a logged-out visitor passes cleanly. The check narrows *where* a request may come from, never *who* sent it. Authentication is separate work — [02e](02e-authentication-and-authorisation-at-the-entry-point.md).

## The body cap, precisely

1MB by default, and it counts the entire POST body: form fields, serialised arguments, and any encrypted closure payload the action carried ([02c](02c-closures-action-ids-and-deploys.md)). A generously-capturing inline action spends part of the budget before your form does.

Raising it is one config line and it costs you something real. The cap is the **only volumetric control the framework applies to an endpoint it does not rate-limit for you**. `bodySizeLimit: '50mb'` converts every action in the app into a cheap resource-exhaustion target, and there is no per-action override — the setting is app-wide.

When the reason to raise it is file upload, the documentation points somewhere else entirely:

> *"Store user-generated static assets in dedicated services. When possible, upload them from the browser and store the returned URI in your database to reduce request size."*

```ts
// app/profile/actions.ts — the action carries a reference, never the bytes
'use server'

import { auth } from '@/lib/auth'
import { setAvatarKey } from '@/data/users'

export async function attachAvatar(objectKey: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  // the key namespace is the ownership check — the client chose the string
  if (!objectKey.startsWith(`avatars/${session.user.id}/`)) throw new Error('Forbidden')
  await setAvatarKey(session.user.id, objectKey)
}
```

That pattern keeps the body small, keeps the cap at its default, and moves the megabytes onto storage infrastructure built to receive them. It also removes the upload from the action queue, which matters for a different reason entirely — see [02g](02g-sequential-dispatch-and-the-single-response.md).

## A Route Handler gets none of this

The four protections above are documented as protections **on Server Actions**. The Route Handler documentation opens from the opposite position:

> *"Route Handlers are public HTTP endpoints. Any client can access them."*

> *"To restrict access, implement authentication and authorization."*

> *"Always verify credentials before granting access. Do not rely on proxy alone for authentication and authorization."*

| | Server Action | Route Handler |
|---|---|---|
| Origin/Host comparison | applied by the framework | not applied — CORS and origin policy are yours |
| Body size limit | 1MB default, app-wide config | none by default; validate size yourself |
| Identifier | encrypted, rotates per build | a URL you published on purpose |
| Unused-endpoint removal | dead-code elimination | the file exists, so the route exists |
| Authn / authz / rate limit / validation | **yours** | **yours** |

The bottom row is identical, which is the point of [02m](02m-the-data-access-layer.md): put the four application checks somewhere both entry points must pass through, and the asymmetry above stops being a source of drift.

⚠️ The asymmetry cuts the other way too. The reflex "an API route feels more like a real API, let's use one" silently drops the CSRF check that an action applied for free — and if the caller is your own browser UI, you have taken on a protection you now have to rebuild.

## Payload hygiene the framework will not do for you

> *"Never trust incoming request data. Validate content type and size, and sanitize against XSS before use."*

> *"Use timeouts to prevent abuse and protect server resources."*

Content type in particular is worth naming: the 1MB cap does not care what the megabyte contains, and a handler with no cap at all will happily buffer whatever arrives. For a handler, check both before you read:

```ts
// app/api/import/route.ts
export async function POST(request: Request) {
  if (request.headers.get('content-type') !== 'application/json') {
    return new Response('Unsupported Media Type', { status: 415 })
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (!declared || declared > 1_000_000) {
    return new Response('Payload Too Large', { status: 413 })
  }

  const body = await request.json()
  return Response.json({ received: Array.isArray(body) ? body.length : 0 })
}
```

⚠️ `Content-Length` is client-supplied and absent on a chunked request, so it is a cheap first filter, not the enforcement. Enforcement means reading the stream with your own byte counter, or a host-level limit in front of the function.

## Gotchas

**★ Symptom: every action fails behind a new reverse proxy, on a preview domain, or after a CDN change — aborted before any of your code runs.** Cause: the `Origin`/`Host` comparison. The browser sends the customer-facing origin; the app sees the internal `Host`. Fix: list the fronting origins, wildcards included.

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: { allowedOrigins: ['app.example.com', '*.preview.example.com'] },
  },
}
```

**★ Symptom: `bodySizeLimit: '50mb'` was set to accept image uploads and the app is now trivially exhaustible.** Cause: the cap is app-wide and is the only size control on an endpoint with no framework rate limiting. Fix: leave the cap at its default and stop sending bytes through the action — upload direct to storage, pass the URI, as in `attachAvatar` above.

**★ Symptom: a team treats "Next.js protects Server Actions from CSRF" as "Server Actions are protected".** Cause: the origin check is transport-scoped and browser-dependent; it never inspects the caller's identity. Fix: keep the check *and* authenticate inside the action — the two are not substitutes, and [02e](02e-authentication-and-authorisation-at-the-entry-point.md) is the other half.

**Symptom: an action works from the app and fails from a Playwright or integration test that posts directly.** Cause: the test client is not sending a matching `Origin`. Fix: drive the test through the real page rather than synthesising the POST — synthesising it is what an attacker does, and the check is doing its job.

**Symptom: a Route Handler accepts a 200MB upload and the function is OOM-killed.** Cause: handlers have no default body cap; the 1MB figure belongs to actions only. Fix: reject on content type and declared length before reading, then bound the read itself or push the limit into the host's configuration.

**Symptom: switching a mutation from an action to a `POST` handler "for a cleaner API" introduces a CSRF hole.** Cause: the handler inherits none of the action's origin checking, and browser cookies are still attached to a cross-site POST unless `SameSite` fully covers your flows. Fix: if the caller really is your own UI, keep the action; if it must be a handler, verify the origin yourself.

```ts
// app/api/transfer/route.ts
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || new URL(origin).host !== host) {
    return new Response('Forbidden', { status: 403 })
  }
  // ... authenticate, authorize, then act
  return new Response(null, { status: 204 })
}
```

## Interview questions

**★ Next.js "protects Server Actions from CSRF". What exactly does that buy you, and what does it not?**
It buys you a comparison of the `Origin` header against `Host` or `X-Forwarded-Host`, with mismatches aborted, on top of actions being POST-only and modern browsers defaulting to `SameSite` cookies. Together that stops a page on `evil.com` from causing a logged-in user's browser to submit a mutation to your app. What it does not buy you is anything about a caller that is not a browser: a script holding a leaked session cookie sets `Origin` to whatever it likes, so the check never fires. Nor does it identify anyone — a same-origin POST from a logged-out visitor passes cleanly. It narrows *where from*, never *who*.

**★ Which of the four framework protections apply to a Route Handler?**
None. The handler documentation describes them as *"public HTTP endpoints. Any client can access them"* with the instruction to *"implement authentication and authorization"* yourself. There is no origin comparison, no default body cap, no encrypted identifier, and no dead-code elimination — a `route.ts` on disk is a live route. That asymmetry is a real input to the entry-point decision: choosing a handler for a browser-initiated mutation means rebuilding the CSRF check by hand, and choosing an action for a third-party caller is impossible anyway because there is no URL to hand out.

**★ The 1MB body cap is configurable. When should you raise it, and what do you lose?**
Raise it when a legitimate payload genuinely exceeds it and cannot be restructured — a large structured document, a bulk import from a trusted internal tool. You lose the only volumetric defence the framework applies, on an endpoint it does not rate-limit, and you lose it *application-wide* because there is no per-action override. For file uploads the documentation points elsewhere: store assets in a dedicated service, upload from the browser, and *"store the returned URI in your database to reduce request size."* That keeps the cap at its default, keeps request bodies small, and has the side benefit of keeping a slow upload out of the per-client action queue.

**Why does the origin check break behind a reverse proxy, and why is `allowedOrigins` the right fix rather than disabling the check?**
Because the check is host *equality*: the browser sends the public origin it navigated to, and the app sees whatever `Host` — or `X-Forwarded-Host` — the proxy passed on. When those differ the request is aborted before your code runs. `allowedOrigins` is the right fix because it keeps the check and widens its accept-list to a set of hosts you deliberately name, wildcards included. There is no supported way to turn it off, and there should not be: the alternative is an application where any page on the internet can drive an authenticated mutation in a user's browser.

**Both entry points require the same four application checks. Why is that an architectural argument rather than a checklist item?**
Because a checklist is per-entry-point and therefore duplicated, and duplicated security rules drift — the action gains an ownership check during a bug fix and the handler that does the same job does not. If instead both entry points are thin and delegate to one `server-only` module that authenticates, authorises, validates and shapes the return value, then the number of places the rule lives is one regardless of how many doors you open onto it. That is the argument for a Data Access Layer, and it is also why the documentation's audit checklist asks whether *"database access [is] delegated to a `server-only` Data Access Layer"* rather than asking whether each action is correct.

---

← [02c · Closures, action IDs and deploys](02c-closures-action-ids-and-deploys.md) · Next → [02e · The checks the framework does not do](02e-authentication-and-authorisation-at-the-entry-point.md)
