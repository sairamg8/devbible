---
title: "The framework gives you an origin check and a 1MB body cap and nothing else, so rate limiting and idempotency are yours to build — and sequential dispatch is a client-side comfort that an attacker with curl does not have"
sidebar_label: "01e · The request envelope"
sidebar_position: 103
description: "The Origin-versus-Host CSRF check and what allowedOrigins really widens, the 1MB cap and the multipart bytes people forget, why in-memory rate limiting fails on the second instance, and the idempotency key a retried mutation needs."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [`serverActions`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) reference (`lastUpdated: 2026-06-25`), [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (`lastUpdated: 2026-06-17`), [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (`lastUpdated: 2026-06-25`), and [How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8**. Documentation-verified; **no sandbox run**.

**Everything before this page was about the contents of the request. This page is about the envelope: where it may come from, how big it may be, how often it may arrive, and what happens when the same one arrives twice. The framework has strong opinions about the first two and no opinion whatsoever about the last two — and the two it leaves to you are the ones that show up as an incident rather than a bug report.**

## CSRF: an Origin check, not a token

Server Actions do not carry a CSRF token. The protection is structural and comes in two halves. First, the method:

> *"Behind the scenes, Server Actions use the `POST` method, and only this HTTP method is allowed to invoke them. This prevents most CSRF vulnerabilities in modern browsers, particularly with [SameSite cookies](https://web.dev/articles/samesite-cookies-explained) being the default."*

Second, a header comparison:

> *"As an additional protection, Server Actions in Next.js also compare the [Origin header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin) to the [Host header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host) (or `X-Forwarded-Host`). If these don't match, the request will be aborted. In other words, Server Actions can only be invoked on the same host as the page that hosts it."*

That last clause is the whole guarantee, and it is a *deployment* guarantee as much as a code one. It holds while the host the browser sees and the host the Next.js server sees are the same string. Put a proxy, a CDN, an ingress rewrite or a second domain in between, and legitimate requests start failing — which is why the escape hatch exists:

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['my-proxy.com', '*.my-proxy.com'],
    },
  },
}
```

> *"A list of extra safe origin domains from which Server Actions can be invoked. Next.js compares the origin of a Server Action request with the host domain, ensuring they match to prevent CSRF attacks. If not provided, only the same origin is allowed."*

**Read `'*.my-proxy.com'` carefully before you copy it.** A wildcard entry trusts every subdomain, including one you did not create: a forgotten CNAME pointing at a decommissioned SaaS, a staging host someone can claim, a customer-controlled vanity domain. Subdomain takeover is the ordinary way this goes wrong, and the wildcard converts it directly into cross-site request forgery against your mutations. List the exact hosts you use.

⚠️ The documentation says the comparison is against `Host` *"(or `X-Forwarded-Host`)"* and does not state the precedence between them. I could not settle that from the pages above. The defensive posture that does not depend on knowing: make sure your reverse proxy **sets** `X-Forwarded-Host` itself and **strips any copy that arrived from the client**, which is good practice regardless of how the framework resolves the pair.

## The 1MB cap and the bytes you did not count

> *"By default, the maximum size of the request body sent to a Server Action is 1MB, to prevent the consumption of excessive server resources in parsing large amounts of data, as well as potential DDoS attacks."*

```js filename="next.config.js"
/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}
```

> *"It can take the number of bytes or any string format supported by bytes, for example `1000`, `'500kb'` or `'3mb'`."*

The reference then spells out the arithmetic that catches people who set the limit to exactly their maximum file size:

> *"The limit applies to the raw HTTP request body, including the bytes that `multipart/form-data` adds for boundaries, part headers, and field metadata. If you expect uploads close to the configured value, leave some room for this overhead. For typical multipart uploads, an additional 10–20 KB is a reasonable rule of thumb."*

Two things count toward that budget that are not form fields. The first is every other field in the form. The second is subtler: an inline action's captured variables are *"sent to the client and back to the server when the action is invoked"*, so a closure over a large object is part of the POST body too. The documentation does not spell that consequence out — it follows from the two statements together — but it is the reason a form that only uploads a 900 KB image can still be rejected.

**Raising the limit is a real trade-off, not a formality.** The default exists to bound the work an unauthenticated POST can make your server do; `bodySizeLimit: '50mb'` hands that lever to anyone who can reach the action. Where the payload is genuinely large, the Backend for Frontend guide's advice is to keep it out of the action entirely:

> *"Store user-generated static assets in dedicated services. When possible, upload them from the browser and store the returned URI in your database to reduce request size."*

That pattern — a short-lived signed upload URL, the browser writes to object storage, the action receives a key — leaves the action's body small and takes your server out of the byte path. [02e](02e-file-inputs-and-the-checks-that-must-be-server-side.md) covers the validation half of it.

## Sequential dispatch is not a rate limit

Chapter 08 covers the queuing behaviour; the security-relevant reading of it is the "good to know" attached to it:

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second."*
> *"**Good to know:** This is a property of the client dispatcher, not of Server Functions in general. Server-side, an action runs in its own request and can do anything an async function can do."*

**The serialisation lives in the browser.** It protects your UI's consistency and it protects nothing else. Two tabs are two dispatchers. A script that POSTs the action ID directly has no dispatcher at all. Any reasoning of the form "the user cannot submit twice because actions are sequential" is reasoning about one tab of one honest client.

## Rate limiting is yours

The data security guide's whole treatment is two sentences:

> *"For expensive operations (sending emails, writing to a database), consider adding rate limiting to prevent abuse."*

and, from the Backend for Frontend guide:

> *"You can implement rate limiting in your Next.js backend. In addition to code-based checks, enable any rate limiting features provided by your host."*

The documented example is a Route Handler returning `429`; nothing about Server Actions specifically. So the shape below is application code, not a framework feature — but the constraints on it are dictated by how Next.js deploys.

```ts filename="lib/rate-limit.ts"
import 'server-only'

// Any client exposing atomic increment + expiry works: Redis, Upstash, Cloudflare KV,
// a Postgres table with a unique key. What must NOT work is a module-scope Map.
export interface CounterStore {
  increment(key: string, windowMs: number): Promise<number>
}

export class RateLimitExceeded extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('RATE_LIMIT_EXCEEDED')
  }
}

export async function enforceLimit(
  store: CounterStore,
  { key, limit, windowMs }: { key: string; limit: number; windowMs: number },
) {
  const bucket = Math.floor(Date.now() / windowMs)
  const count = await store.increment(`${key}:${bucket}`, windowMs)
  if (count > limit) {
    throw new RateLimitExceeded(windowMs - (Date.now() % windowMs))
  }
}
```

```ts filename="data/invitations.ts"
import 'server-only'
import { auth } from '@/lib/auth'
import { enforceLimit } from '@/lib/rate-limit'
import { counters } from '@/lib/counters'

export async function inviteTeammate(email: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Key on the identity you actually control, not on the IP.
  await enforceLimit(counters, {
    key: `invite:${session.user.id}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })

  await sendInvitationEmail(email, session.user.id)
}
```

Three design points that are not optional. **The counter is shared**, because a serverless deployment has no stable process to hold a `Map` and a container deployment has several — a module-scope counter is a limiter that resets whenever the platform feels like it. **The key is the session user**, because behind a corporate NAT or a mobile carrier every one of your users shares an IP, and an IP-keyed limit either blocks a whole office or is set so high it blocks nobody. **The check lives in the DAL**, next to the authorization check, so it cannot be forgotten by an action added later.

For unauthenticated endpoints — signup, password reset, contact forms — there is no session to key on, and IP is what remains. Combine it with a cost the attacker pays (a challenge, a delay) rather than pretending the IP identifies a person.

## Idempotency: the framework promises nothing

Nothing in the documentation makes a Server Action idempotent, and three documented facts make retries a certainty rather than an edge case:

- A rolling deploy can invalidate an in-flight action reference, and the recommended handling is to *"Surface the error as a retry path in the UI rather than a hard failure, so a refresh recovers the user."* — a retry of a mutation that may already have committed.
- With the experimental `useOffline` config, *"a Server Action interrupted by a connectivity drop stays pending and completes when the network returns, so a user does not lose their submission."* The action completes *later*, and the user has had time to try again.
- A user who sees no response double-clicks. Sequential dispatch orders those two submissions; it does not merge them.

The application-level answer is a key generated by the client, made unique in the database:

```ts filename="app/orders/actions.ts"
'use server'

import { placeOrder } from '@/data/orders'

export async function placeOrderAction(
  requestId: string,
  formData: FormData,
): Promise<{ ok: true; orderId: string } | { ok: false; code: 'INVALID' }> {
  const cartId = String(formData.get('cartId') ?? '')
  if (!cartId) return { ok: false, code: 'INVALID' }
  const orderId = await placeOrder({ requestId, cartId })
  return { ok: true, orderId }
}
```

```ts filename="data/orders.ts"
import 'server-only'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function placeOrder({ requestId, cartId }: { requestId: string; cartId: string }) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // `requestId` is UNIQUE in the schema. The second attempt loses the race and
  // reads back the winner's result instead of creating a second order.
  const existing = await db.order.findUnique({ where: { requestId } })
  if (existing) return existing.id

  try {
    const order = await db.order.create({
      data: { requestId, cartId, userId: session.user.id },
    })
    return order.id
  } catch (error) {
    if (isUniqueViolation(error, 'order_requestId_key')) {
      const winner = await db.order.findUniqueOrThrow({ where: { requestId } })
      return winner.id
    }
    throw error
  }
}
```

```tsx filename="app/orders/checkout-form.tsx"
'use client'

import { useState } from 'react'
import { placeOrderAction } from './actions'

export function CheckoutForm({ cartId }: { cartId: string }) {
  // One id per mounted form: a retry of the same submission reuses it,
  // a genuinely new order remounts and gets a new one.
  const [requestId] = useState(() => crypto.randomUUID())
  const action = placeOrderAction.bind(null, requestId)

  return (
    <form action={action}>
      <input type="hidden" name="cartId" value={cartId} />
      <button type="submit">Place order</button>
    </form>
  )
}
```

The unique index is what does the work — the pre-check is an optimisation, and the `catch` is the correct path under concurrency. A check-then-create without the constraint is the same race with extra steps.

## Gotchas

**★ Symptom: uploads just under your configured `bodySizeLimit` are rejected.** Cause: the limit applies to the raw HTTP body, and `multipart/form-data` adds boundaries, part headers and field metadata on top of the file — the reference suggests 10–20 KB for a typical upload. Fix: set the limit above your real maximum, and validate the file's own size in the schema so the user gets a field error rather than a transport failure.

```js
// next.config.js — 5MB of file, plus room for the envelope
module.exports = { experimental: { serverActions: { bodySizeLimit: '6mb' } } }
```

**★ Symptom: actions work locally and fail behind the CDN or ingress with the request aborted.** Cause: the `Origin` the browser sends no longer matches the `Host` (or `X-Forwarded-Host`) the server sees. Fix: enumerate the real origins — and resist the wildcard.

```js
module.exports = {
  experimental: {
    serverActions: { allowedOrigins: ['app.example.com', 'admin.example.com'] },
  },
}
```

**★ Symptom: the rate limiter works in development and lets everything through in production.** Cause: the counter is a module-scope `Map`, so each instance, each container and each cold start has its own. Fix: a shared atomic counter, as in `enforceLimit` above; the store is the part that must be external, not the algorithm.

**★ Symptom: one duplicate order per few thousand checkouts, always with two rows milliseconds apart.** Cause: a client retry — a double-click in another tab, an offline resume, a post-deploy retry — and a `findFirst`-then-`create` with no unique constraint. Fix: the request id plus a unique index, so the database arbitrates instead of your code.

```sql
ALTER TABLE "order" ADD CONSTRAINT order_requestId_key UNIQUE ("requestId");
```

**Symptom: `bodySizeLimit` was raised to `'50mb'` and the host now falls over under a trickle of traffic.** Cause: the cap exists *"to prevent the consumption of excessive server resources in parsing large amounts of data, as well as potential DDoS attacks"*, and raising it hands that lever to unauthenticated callers. Fix: keep the action's body small and move bytes out of band.

```ts
// action returns a short-lived upload target; the browser PUTs the file directly
export async function createUploadTargetAction(contentType: string) {
  await requireSession()
  return storage.createSignedUploadUrl({ contentType, expiresInSeconds: 60 })
}
```

**Symptom: an IP-keyed limit blocks an entire customer's office, or never triggers at all.** Cause: behind NAT, a proxy or a mobile carrier, thousands of users share an address; behind a CDN, the address you read may be the CDN's. Fix: key authenticated operations on the session user, and only fall back to IP where there is no session — reading it from the proxy header your infrastructure actually sets.

**Symptom: "the user cannot double-submit, actions are sequential" turns out to be false in production.** Cause: sequential dispatch is *"a property of the client dispatcher, not of Server Functions in general"*. It orders submissions within one page's dispatcher; a second tab, a second device or a direct POST is unaffected. Fix: idempotency at the data layer, and a `disabled` button only as UX.

**Symptom: the CSRF check passes for a request from a subdomain you have never heard of.** Cause: an `'*.example.com'` entry in `allowedOrigins`, plus a dangling DNS record someone else claimed. Fix: exact hosts, and audit the list when a domain is retired.

**Symptom: a rate limit added to an action is bypassed by a second action that does the same work.** Cause: the limit was attached to the transport function rather than to the operation. Fix: put `enforceLimit` in the DAL function that sends the email or writes the row, where every caller passes through it.

## Interview questions

**★ How does Next.js defend a Server Action against CSRF, and where does that defence stop?**
With two structural properties rather than a token: actions are invocable only over POST, which combined with SameSite cookie defaults blocks the classic cross-site form submission, and the request's `Origin` is compared against `Host` or `X-Forwarded-Host`, aborting on mismatch. It stops at deployment topology. Any architecture where the browser's origin and the server's host legitimately differ — proxies, CDNs, multiple domains — has to widen the check with `allowedOrigins`, and every entry there is trust you are granting by hand. A wildcard entry grants it to subdomains you may not control.

**★ Why is the 1MB body cap a security setting rather than a convenience?**
Because it bounds the work an unauthenticated POST can force the server to do. Parsing a large body costs memory and CPU before any of your code runs, so the cap is the framework's answer to a trivially cheap denial-of-service. That is why raising it deserves a reason: `bodySizeLimit: '50mb'` is not "supporting bigger uploads", it is granting every caller a 50× larger free workload. The better answer for genuinely large payloads is to move them out of the action entirely, uploading from the browser to storage and passing the resulting key.

**★ Sequential dispatch means a user cannot run two mutations at once. True?**
Not in the sense that matters. The documentation is explicit that it is a property of the client dispatcher, not of Server Functions — server-side, an action runs in its own request. So it holds for one tab of one browser and is irrelevant to a second tab, a second device or a script POSTing the action ID. It is a consistency feature for the UI, not a concurrency control for your data.

**★ What makes a mutation idempotent, and why does Next.js not do it for you?**
A key the client supplies and the database enforces: a `requestId` with a unique constraint, so a second attempt collides and reads back the first result instead of creating a second row. Next.js cannot do it for you because idempotency is defined per operation — the framework has no idea whether two identical payloads mean "retry" or "the user really did want two of these". What it does do is make retries likely: rolling deploys invalidate action references and the guidance is to offer a retry, and the experimental offline support resumes an interrupted action after the user has had time to resubmit.

**★ Where should a rate limit live, and what should it be keyed on?**
In the Data Access Layer, alongside the authorization check, so that every action which performs the expensive operation passes through it rather than only the one you remembered. The key should be the authenticated identity where there is one; IP is a poor identity behind NAT, corporate proxies and CDNs, blocking whole populations at low thresholds and nobody at high ones. The counter itself must be external to the process — a serverless function has no durable memory and a container fleet has one per replica, so a module-scope map is a limiter that silently resets.

**Why does the reference tell you to leave 10–20 KB of headroom in `bodySizeLimit`?**
Because the limit applies to the raw HTTP request body, and `multipart/form-data` is a wire format with per-part overhead: boundary delimiters, part headers and field metadata for every field in the form, not just the file. A limit set to exactly the maximum file size therefore rejects a maximum-size file. The same budget also carries any other form fields and, for an inline action, the encrypted closure variables that are posted back with the call.

**Your action sends an email. What has to be true before you ship it?**
It authenticates and authorizes the caller; it enforces a rate limit keyed on that caller from a shared counter; it is idempotent, or sending twice is harmless; the recipient address is validated and — more importantly — is one this caller is entitled to send to, so the endpoint is not an open relay for your domain's reputation; and the failure is logged with enough context to spot a pattern, because "one user sent four thousand invitations" is a graph, not an error.

---

← [01d · Return values, DTOs and tainting](01d-return-values-dtos-and-tainting.md) · [Chapter 10 overview](01-explanation.md) · Next → [02 · The schema as a trust boundary](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md)
