---
title: "The request body is a stream you may consume exactly once, which is why webhook signature verification is the shape it is — and why every FormData value is a string, an unchecked checkbox is absent rather than false, and an empty POST body becomes a 500 unless you catch it"
sidebar_label: "04e · Reading the body"
sidebar_position: 18
description: "json, text, formData, arrayBuffer and the raw stream; no bodyParser; single-use bodies and request.clone(); verifying a webhook signature over raw bytes; media-type and empty-body guards; what FormData can and cannot carry; and validating at the boundary with a schema the client can share."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (docs `lastUpdated` 2026-04-30) — the Request Body, Request Body FormData and Webhooks examples — and [How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (`lastUpdated` 2026-06-25) for the single-use body rule. Body-consumption semantics per the WHATWG Fetch Standard.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**The body arrives on the `Request` instance and you read it with the standard Web methods — no `bodyParser` configuration, unlike Pages Router API routes, and no middleware to install. What Next.js removed in ceremony it did not remove in constraints, and the constraint that structures every handler on this page is that **a body may be consumed exactly once**. That single rule dictates how a webhook verifies a signature (read the raw string, verify it, `JSON.parse` that same string — never re-read), how a proxy inspects and forwards a payload (`request.clone()` before the first read), and why `await request.text()` followed by `await request.json()` is a `500` in production and a passing test in isolation. The rest of the page is what happens after the bytes are in hand: a media-type guard, an empty-body guard, the fact that every `FormData` value is a string or a `File`, and one schema at the boundary because the pages before this one have all assumed you have a validated object.**

## The methods, and what has no body at all

| Call | Gives you | Use it for |
|---|---|---|
| `await request.json()` | the parsed value | a JSON API |
| `await request.text()` | the raw string | signatures, XML, anything you parse yourself |
| `await request.formData()` | a `FormData` | HTML form posts and multipart uploads |
| `await request.arrayBuffer()` | an `ArrayBuffer` | binary payloads |
| `await request.blob()` | a `Blob` | binary you will hand straight to storage |
| `request.body` | a `ReadableStream` or `null` | forwarding or counting bytes without buffering |

```ts
// app/items/route.ts — the documented minimum
export async function POST(request: Request) {
  const res = await request.json()
  return Response.json({ res })
}
```

**`GET` and `HEAD` requests do not carry a body**, so there is nothing to read on those. A handler that reads a body on a `GET` is either dead code or a sign that the verb is wrong ([04](04-route-handlers-routets-for-restful-apis.md)).

## 🔴 One read, and how to get a second

Every method in that table consumes the stream. A second consuming call throws. `request.clone()` before the first read gives you exactly one extra copy — the documentation's own example demonstrates the failure by cloning, reading both, and then reading the original a third time, which is the line that throws.

The case where this decides real code is webhook verification, which needs the exact bytes the sender signed **and** the parsed object:

```ts
// app/api/webhooks/billing/route.ts
export const POST = withApiErrors(async (request) => {
  const signature = request.headers.get('x-signature')
  if (!signature) return apiError(400, 'signature_missing', 'Missing signature header.')

  const raw = await request.text()                 // the bytes the signature covers
  if (!verifyHmac(raw, signature, process.env.BILLING_WEBHOOK_SECRET!)) {
    return apiError(401, 'signature_invalid', 'Signature did not verify.')
  }

  const event = JSON.parse(raw)                    // parse the SAME string
  await handleBillingEvent(event)
  return new Response(null, { status: 204 })
})
```

Two properties of that shape matter. The signature is checked against the **raw** string, because any parse-and-reserialise changes the bytes — key order, whitespace, number formatting — and the signature will not match. And `JSON.parse(raw)` is used instead of `await request.json()`, because the body is already gone.

The other place a second copy is genuinely needed is a proxy that must both inspect and forward:

```ts
// app/api/forward/route.ts
export const POST = withApiErrors(async (request) => {
  const inspectable = request.clone()
  const payload = await inspectable.json()
  if (!isAllowedOperation(payload.op)) {
    return apiError(403, 'operation_not_allowed', 'That operation is not permitted here.')
  }

  const upstream = await fetch('https://api.internal.example.com/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },   // build headers explicitly — see 12
    body: request.body,                                 // the ORIGINAL, still unread
    duplex: 'half',
  })
  return new Response(upstream.body, { status: upstream.status })
})
```

⚠️ `duplex: 'half'` is required by the Fetch Standard whenever a request body is a stream. The Next.js pages verified here do not mention it; it is a platform requirement rather than a framework one, and omitting it is a runtime error rather than a subtle bug — which at least means you find out immediately.

## Guards that turn a 500 into the right status

```ts
export const POST = withApiErrors(async (request) => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('application/json')) {
    return apiError(415, 'unsupported_media_type', 'Send application/json.')
  }

  let payload: unknown
  try {
    payload = await request.json()      // rejects on an empty or malformed body
  } catch {
    return apiError(400, 'malformed_json', 'The request body is not valid JSON.')
  }

  const parsed = CreateProject.safeParse(payload)
  if (!parsed.success) {
    return apiError(422, 'validation_failed', 'One or more fields are invalid.', {
      fields: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    })
  }

  const created = await db.project.create({ data: parsed.data })
  return Response.json({ data: created }, {
    status: 201,
    headers: { Location: `/api/projects/${created.id}` },
  })
})
```

Three statuses, three distinct client mistakes, and none of them a `500`. `startsWith` rather than `===` because a real header is usually `application/json; charset=utf-8`. And the `try` around `request.json()` because an empty body — which is what a client sends when its own serialiser produced `undefined` — rejects, and an unguarded rejection is an unhandled exception ([04c](04c-error-responses-a-client-can-branch-on.md)).

## `FormData` carries strings and `File`s, and nothing else

```ts
// app/api/avatars/route.ts
export const POST = withApiErrors(async (request) => {
  const form = await request.formData()

  const displayName = String(form.get('displayName') ?? '').trim()
  const subscribed = form.get('subscribed') === 'on'   // absent means unchecked
  const file = form.get('avatar')

  if (!displayName) {
    return apiError(422, 'validation_failed', 'Display name is required.', {
      fields: { displayName: ['Required.'] },
    })
  }
  if (!(file instanceof File)) {
    return apiError(422, 'validation_failed', 'An avatar file is required.', {
      fields: { avatar: ['Required.'] },
    })
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return apiError(415, 'unsupported_media_type', 'PNG, JPEG or WebP only.')
  }
  if (file.size > 2 * 1024 * 1024) {
    return apiError(413, 'file_too_large', 'Avatars must be under 2 MB.')
  }

  await storage.put(`avatars/${crypto.randomUUID()}`, file.stream(), { contentType: file.type })
  await db.user.update({ where: { id: userId }, data: { displayName, subscribed } })
  return new Response(null, { status: 204 })
})
```

There are no numbers and no booleans in a `FormData`. `form.get('quantity')` is `'3'`, and an unchecked checkbox is **absent** rather than `false` — which is why `form.get('subscribed') === 'on'` is correct and `Boolean(form.get('subscribed'))` is correct only by coincidence, since it also returns `true` for the string `'off'` if a form ever sends one.

The documentation says as much and points at `zod-form-data` for exactly this reason: hand-written coercion across a dozen fields is where the silent zeroes and the accidental `true`s come from.

Note also that `file.type` is the browser's claim about the content, not a fact. It is worth checking because it rejects the honest mistakes cheaply, and it is not a security control — a caller who wants to send an executable labelled `image/png` will.

## Size, and the limit that is not there

⚠️ `await request.formData()` resolves only after the **entire** multipart body has been read, so a `file.size` check runs after the bytes have already arrived. You cannot reject an oversized upload partway by inspecting the parsed form.

⚠️ The pages verified here **do not document a body size limit for Route Handlers**. The 1 MB figure that circulates is `serverActions.bodySizeLimit`, which applies to Server Actions ([01c](01c-server-action-hooks-optimistic-ui-and-security.md)) and says nothing about handlers. Treat the limit as unspecified and platform-dependent rather than assuming either that one exists or that one does not.

If you need a bound before the transfer completes, count the stream yourself:

```ts
async function readCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()          // stop reading; the sender learns the peer gave up
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer())
}
```

And for genuinely large uploads, the pattern that avoids the whole question is a signed URL: the handler authorises and returns a URL, the storage provider receives the bytes and enforces its own limit, and a second call records the metadata once the upload reports success. Your compute never sits in the path of the payload.

## One schema, at the boundary

Everything upstream of this line — the query parser on [04d](04d-cookies-headers-and-the-url.md), the status codes on [04b](04b-constructing-the-response-status-codes-and-streaming.md), the envelope on [04c](04c-error-responses-a-client-can-branch-on.md) — assumes the handler is working with a validated object. This is where that becomes true.

```ts
// lib/contracts/project.ts — imported by the handler AND by the client
import { z } from 'zod'

export const CreateProject = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  dueDate: z.iso.datetime({ offset: true }).optional(),
  tags: z.array(z.string().min(1).max(24)).max(10).default([]),
})

export type CreateProjectInput = z.infer<typeof CreateProject>
```

Three properties make it worth having a file rather than an inline `z.object`. The type is *derived* from the schema, so the two cannot drift. The client can import the same schema and validate before sending, turning a round trip into an instant field error without duplicating a rule. And the schema is the only artefact that states the endpoint's contract, so it can generate documentation instead of documentation being written beside it and going stale.

🔴 Validation is not authorization. A perfectly valid `{ projectId: "abc", archived: true }` may name a project belonging to somebody else. Schema validation checks shape; ownership is a separate lookup keyed on the session — the same rule [01c](01c-server-action-hooks-optimistic-ui-and-security.md) states for Server Actions, and it applies identically here because a Route Handler is a public endpoint ([04f](04f-caching-runtime-cors-and-the-public-endpoint-contract.md), [13](13-bff-security-and-the-caveats-that-decide-when-not-to-use-one.md)).

## Gotchas

**★ Symptom: a webhook handler returns `500`, and the log says the body has already been read.** Cause: the body is single-use and the handler consumed it twice — typically `request.text()` for the signature and then `request.json()` for the payload. Fix: read once and reuse the string.

```ts
const raw = await request.text()
if (!verifyHmac(raw, signature, secret)) return apiError(401, 'signature_invalid', '…')
const event = JSON.parse(raw)     // the same string, not a second read
```

**★ Symptom: a webhook signature never verifies, though the secret is right.** Cause: the signature was computed over the re-serialised object rather than the bytes the sender signed. `JSON.stringify(JSON.parse(raw))` is not `raw` — key order, whitespace and number formatting all move. Fix: verify against `await request.text()` and parse afterwards.

**★ Symptom: an empty `POST` body produces a `500`.** Cause: `await request.json()` rejects on an empty or malformed body, and an unguarded rejection becomes your generic internal error. Fix: wrap the parse and return `400`. This is unambiguously the client's mistake and should not appear on your error budget.

**★ Symptom: `formData.get('quantity')` yields `'3'` and the arithmetic downstream concatenates instead of adding.** Cause: every `FormData` value is a string or a `File`. Fix: coerce through a schema — `zod-form-data` exists for this and the documentation points at it — rather than sprinkling `Number(...)` at call sites where one omission is invisible.

**★ Symptom: an unchecked checkbox arrives as `undefined` and your update writes `undefined` over an existing `true`.** Cause: browsers omit unchecked checkboxes from the form entirely; there is no `false` to receive. Fix: default explicitly at the boundary — `const subscribed = form.get('subscribed') === 'on'` — so absence means `false` rather than "leave it alone".

**★ Symptom: a `content-type` check with `=== 'application/json'` rejects requests that are valid.** Cause: real clients send `application/json; charset=utf-8`, and some send `application/json;charset=utf-8` with no space. Fix: `startsWith('application/json')`, or parse the media type properly and compare the type alone.

**★ Symptom: an over-large upload is rejected only after it has finished uploading.** Cause: `await request.formData()` resolves after the whole multipart body has been read, so a size check necessarily runs after the transfer. Fix: for real uploads, do not receive the bytes at all — issue a signed upload URL and let the storage provider enforce the limit; for a hard bound in the handler, read `request.body` yourself and cancel past a byte count, as in `readCapped`.

**★ Symptom: a proxy handler forwards a body successfully in one runtime and throws about a duplex option in another.** Cause: the Fetch Standard requires `duplex: 'half'` when a request body is a stream. Fix: set it on the outbound `fetch`. It is a platform requirement, not a Next.js one, and the Next pages verified here do not mention it.

**★ Symptom: a file typed `image/png` turns out to be something else entirely.** Cause: `file.type` is the browser's claim, taken from the filename or the OS, and a caller constructing the request by hand sets whatever they like. Fix: keep the check as a cheap rejection of honest mistakes, and do the real one on the bytes — a magic-number sniff, or the storage provider's own validation — before anything renders or executes the file.

**Symptom: a handler reads a body on a `GET` and always sees nothing.** Cause: `GET` and `HEAD` carry no body. Fix: either the parameters belong in the query string, or the verb is wrong — a request with a payload that changes state is a `POST`, `PUT` or `PATCH`.

**Symptom: a proxy validates the payload and forwards an empty body.** Cause: the validation read consumed the stream, and the forward sent the already-drained original. Fix: `request.clone()` **before** the first read, inspect the clone, forward the original — the order is the whole trick.

**Symptom: the client and the server disagree about which fields are required, and each blames the other.** Cause: the validation rules exist twice, written from the same conversation at different times. Fix: one schema module imported by both; the server's rule and the client's pre-flight check become the same object, and the TypeScript type is inferred from it rather than maintained beside it.

**Symptom: a validated request completes an action on a record the caller does not own.** Cause: the schema passed, so the handler assumed the request was legitimate. Validation checks shape, not authority. Fix: derive identity from the session and look the row up by ownership — `findFirst({ where: { id, ownerId: session.user.id } })` — before touching it.

## Interview questions

**★ Why can you read the request body only once, and how do you verify a webhook signature given that?**
Because the body is a stream and consuming it moves it to completion; a second consuming call throws. For a signature you need the exact bytes the sender signed *and* the parsed object, so read the raw string once with `request.text()`, verify against it, and then `JSON.parse` that same string. Re-serialising is not an option — key order, whitespace and number formatting all change, and the HMAC will not match. `request.clone()` before the first read is the other documented route, and it is what a proxy needs when it must both inspect a body and forward it.

**★ What is the difference between a `400` and a `500` for a body that will not parse, and why does the default give you the wrong one?**
It is the client's mistake, so it is a `400`. The default gives you a `500` because `await request.json()` rejects on empty or malformed input, and an unguarded rejection is an unhandled exception that your error wrapper turns into a generic internal error. That means the status you ship depends on whether somebody remembered a `try/catch` — a contract decided by memory rather than structure. Wrap the parse, and keep `500` for conditions you genuinely did not anticipate, so that your error rate means something.

**★ What is true of every value in a `FormData`, and what does that imply for validation?**
Every value is a string or a `File`. There are no numbers, no booleans and no nulls, and an unchecked checkbox is absent rather than `false`. So a handler doing arithmetic on `form.get('quantity')` concatenates, and `Boolean(form.get('archived'))` returns `false` for a missing key and `true` for the string `'on'` — right, and by accident, since it would also be `true` for `'off'`. The implication is that `FormData` needs a coercing schema at the boundary, which is exactly why the documentation points at `zod-form-data`.

**★ How would you handle a 200 MB file upload through a Route Handler?**
Preferably not through the handler. `await request.formData()` resolves only after the whole body has arrived, so any size check runs after you have already paid for the transfer, and the documentation checked here does not state a body size limit for handlers — the 1 MB figure people quote is the Server Actions limit and does not apply. The pattern that scales is a handler that authorises and returns a signed upload URL, with the storage provider receiving the bytes and enforcing the limit; a second call records metadata once the upload reports success. If you must receive it, read `request.body` as a stream and cancel past a byte count, rather than parsing first and measuring second.

**★ A reviewer says "we validate with zod, so the endpoint is safe". What is the counter-argument?**
That validation checks shape and says nothing about authority. `{ projectId: "abc123", archived: true }` is a perfectly valid payload that may name somebody else's project, and a schema will pass it every time. The rule is to accept a reference plus the caller's change, derive identity from the session, and look the row up by ownership before writing. It is the same rule Server Actions need, for the same reason: a Route Handler is a public endpoint and anyone who can send the request reaches the code.

**★ Why is there no `bodyParser` configuration, and is that purely a simplification?**
Because the body is read through the standard Web methods on the `Request` — `json`, `text`, `formData`, `arrayBuffer`, `blob` — so there is nothing to configure and no middleware to install; the documentation notes the contrast with Pages Router API routes explicitly. It is a simplification with a trade: what a `bodyParser` gave you along with parsing was a configurable size limit and a documented behaviour for oversized payloads. Without it, the bound is whatever your platform imposes, and if you want a specific one you write it, by consuming `request.body` yourself.

**What do `request.clone()` and reading the stream directly each solve, and when is neither the answer?**
`clone()` solves "I need the body twice" — inspect and forward, verify and parse. Reading `request.body` directly solves "I do not want the whole thing in memory" — forwarding, counting, hashing as it arrives. Neither is the answer when the payload is large enough that receiving it at all is the problem; then the endpoint should be issuing a signed URL and the bytes should never reach your process.

**Where does a validation schema belong, and what do you get from putting it there?**
In a shared contracts module that both the handler and the client import. You get three things a local `z.object` cannot give you: a TypeScript type inferred from the schema so the two cannot drift; a client that can validate before sending, turning a round trip into an instant field error without a second copy of the rules; and one artefact that states the endpoint's contract, which can generate documentation rather than have documentation written beside it and left to rot.

---

← [04d · Cookies, headers and the URL](04d-cookies-headers-and-the-url.md) · [Chapter 4 overview](01-explanation.md) · Next → [04f · Caching, runtime, CORS and the public-endpoint contract](04f-caching-runtime-cors-and-the-public-endpoint-contract.md)
