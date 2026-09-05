---
title: "ETag and If-Match are the same optimistic check expressed in headers instead of in your request body, and the reason to prefer them is that 412 answers a different question from 409 — one is about a precondition the client sent, the other about a conflict the client never mentioned"
sidebar_label: "07e · ETag, If-Match, 412"
sidebar_position: 54
description: "Generating a strong entity tag from the version column, the conditional PATCH and PUT, why RFC 9110 permits a 2xx on a repeated change, the 409-vs-412 rule stated by RFC 5789, and what an intermediary does to your tags."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 §8.8.3 (ETag), §8.8.3.2 (strong comparison), §13.1.1 (`If-Match`), §15.5.13 (412 Precondition Failed), §15.5.10 (409 Conflict) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html) — RFC 5789 §2.2 (Error Handling) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc5789.html) — and RFC 6585 §3 (428 Precondition Required) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6585.html). Quotes copied from the published RFC text files.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**The version column from [07d](07d-optimistic-concurrency-with-a-version-column.md) works and requires every client to know about a field called `version` and to thread it through its request body. `If-Match` is the same mechanism moved into headers, where a generic HTTP client, a cache and an intermediary already understand it — and where the RFC has already answered the questions you would otherwise be answering by taste. It also forces a distinction most APIs get wrong: 412 is the answer to a precondition the client *sent* and the server evaluated to false; 409 is the answer to a conflict the client never conditioned on. Sending 409 for a failed `If-Match` is not a smaller mistake than sending 200 — the client's error handling branches on it.**

## The entity tag

RFC 9110 §8.8.3:

> *"The 'ETag' field in a response provides the current entity tag for the selected representation, as determined at the conclusion of handling the request. An entity tag is an opaque validator for differentiating between multiple representations of the same resource … An entity tag consists of an opaque quoted string, possibly prefixed by a weakness indicator."*

*Opaque* is the operative word: the client must not parse it, and you may therefore derive it from anything that changes when the representation changes. The version column already is exactly that, so the tag is one line:

```ts
// lib/http/etag.ts
import type { cards } from '@/db/schema'

/** Strong validator: changes whenever the representation changes. */
export function cardETag(card: { id: string; version: number }): string {
  return `"c-${card.id}-${card.version}"`   // the DQUOTEs are part of the grammar
}

/** Parse an If-Match value back to a version. Returns null for `*` or garbage. */
export function versionFromIfMatch(header: string | null, cardId: string): number | null {
  if (!header) return null
  const m = header.trim().match(/^"c-([0-9a-f-]{36})-(\d+)"$/)
  if (!m || m[1] !== cardId) return null
  return Number(m[2])
}
```

Three grammar details that trip people:

- **The double quotes are part of the value.** `ETag: abc` is malformed; `ETag: "abc"` is a strong tag; `ETag: W/"abc"` is weak.
- **Do not put a backslash in a tag.** RFC 9110 notes that under the old `quoted-string` definition *"some recipients might perform backslash unescaping. Servers therefore ought to avoid backslash characters in entity tags."*
- **`If-Match` uses strong comparison, always.** RFC 9110 §13.1.1: *"An origin server MUST use the strong comparison function when comparing entity tags for If-Match … since the client intends this precondition to prevent the method from being applied if there have been any changes to the representation data."* A `W/` tag can never satisfy `If-Match`, so a weak tag on the read makes conditional writes impossible.

🔴 **If you serve a weak `ETag` (because you generated it from a hash of a JSON body that includes a timestamp, say), conditional updates silently stop working** — the precondition can never be satisfied and every write returns 412. Derive the tag from the version, not from the serialised body.

## Emitting it on the read

```ts
// app/api/cards/[cardId]/route.ts (GET)
import { readCardForCaller } from '@/lib/dal/cards'
import { cardETag } from '@/lib/http/etag'

export async function GET(_req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params
  const card = await readCardForCaller(cardId)
  if (!card) return new Response(null, { status: 404 })

  return Response.json(card, {
    status: 200,
    headers: {
      ETag: cardETag(card),
      'Cache-Control': 'private, no-cache',   // revalidate, do not serve blind
    },
  })
}
```

`private, no-cache` matters: an entity tag is only useful if the client has a *current* one, and a shared cache serving a stale representation hands the client a stale tag, which produces a 412 the user cannot explain. Caching a collection and invalidating it is topic 06's subject; this is only the single-resource case.

## The conditional write

RFC 9110 §13.1.1 states both the purpose and the obligation:

> *"If-Match is most often used with state-changing methods (e.g., POST, PUT, DELETE) to prevent accidental overwrites when multiple user agents might be acting in parallel on the same resource (i.e., to prevent the 'lost update' problem)."*

> *"An origin server that evaluates an If-Match condition MUST NOT perform the requested method if the condition evaluates to false."*

```ts
// app/api/cards/[cardId]/route.ts (PATCH, conditional)
import { updateCardVersioned } from '@/lib/dal/cards'
import { buildCardSet, CardPatch } from '@/lib/schemas/card'
import { cardETag, versionFromIfMatch } from '@/lib/http/etag'

export async function PATCH(req: Request, ctx: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await ctx.params

  const ifMatch = req.headers.get('if-match')
  if (!ifMatch) {
    // 428 says "condition your request" rather than letting an unconditional
    // write through. Use it only if you mean to require a precondition always.
    return Response.json({ code: 'precondition_required' }, { status: 428 })
  }
  const expected = versionFromIfMatch(ifMatch, cardId)
  if (expected === null) return new Response(null, { status: 400 })

  const parsed = CardPatch.safeParse(await req.json())
  if (!parsed.success) return Response.json({ issues: parsed.error.issues }, { status: 400 })

  const set = buildCardSet(parsed.data)
  if (Object.keys(set).length === 0) return new Response(null, { status: 400 })

  const outcome = await updateCardVersioned(cardId, expected, set)

  switch (outcome.kind) {
    case 'updated':
      return Response.json(outcome.card, {
        status: 200,
        headers: { ETag: cardETag(outcome.card) },   // the NEW tag, for the next write
      })
    case 'gone':
      return new Response(null, { status: 404 })
    case 'conflict':
      return Response.json(
        { code: 'precondition_failed', current: outcome.current },
        { status: 412, headers: { ETag: cardETag(outcome.current) } },
      )
  }
}
```

### 428 is the status that says "condition your request"

RFC 6585 §3 defines it, and its stated purpose is this exact bug:

> *"The 428 status code indicates that the origin server requires the request to be conditional. Its typical use is to avoid the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict. By requiring requests to be conditional, the server can assure that clients are working with the correct copies."*
> — [RFC 6585 §3](https://www.rfc-editor.org/rfc/rfc6585.html)

It also asks you to be helpful about it: *"Responses using this status code SHOULD explain how to resubmit the request successfully."* So the 428 body names the header the client is missing, rather than saying `precondition_required` and nothing else:

```ts
return Response.json(
  { code: 'precondition_required',
    detail: 'Send If-Match with the ETag from a GET of this card.' },
  { status: 428 },
)
```

Note that **the DAL function is unchanged**. `If-Match` is a transport encoding of the same expectation; the SQL and the `WHERE` clause are identical. That is the point of having a DAL: the concurrency guarantee lives in one statement and both encodings reach it.

## 🔴 409 versus 412 — the rule, quoted

RFC 5789 §2.2 states it in one paragraph, and it is the clearest statement of the distinction in any spec:

> *"Conflicting modification: When a client uses either the If-Match or If-Unmodified-Since header to define a precondition, and that precondition failed, then the 412 (Precondition Failed) error is most helpful to the client. However, that response makes no sense if there was no precondition on the request. In cases when the server detects a possible conflicting modification and no precondition was defined in the request, the server can return a 409 (Conflict) response."*

Which resolves cleanly onto the two encodings:

| The client sent | The check failed because | Status | Because |
|---|---|---|---|
| `If-Match: "c-…-7"` | current version is 8 | **412** | A condition the client stated evaluated false — RFC 9110 §15.5.13: *"one or more conditions given in the request header fields evaluated to false when tested on the server"* |
| `{"version": 7}` in the body | current version is 8 | **409** | There was no HTTP precondition; the server detected a conflict with current state |
| nothing conditional | the server refuses on other grounds (a card that cannot move to a done board, say) | **409** | *"a conflict with the current state of the target resource"* |
| `If-Match: "c-…-7"` | the card does not exist | **404** | There is no representation to condition on |

**Why the distinction is not pedantry.** A generic HTTP client, an SDK generator or a caching layer that sees 412 knows what happened: *my validator is stale, re-fetch and re-evaluate.* Seeing 409, it knows only that something about the request conflicted with state — which might be a version, a business rule, or a duplicate key from topic 05. The two failures lead to different client code, so conflating them means the client must parse your error body to recover, which is exactly what status codes exist to avoid.

⚠️ **A body-carried `version` producing 412 is the mirror-image mistake.** The client sent no header precondition, so a 412 tells it to inspect request headers that do not exist. 409, with the current representation in the body, is the answer.

## The 2xx escape hatch, and why you should probably decline it

RFC 9110 §13.1.1 permits something surprising:

> *"Alternatively, if the request is a state-changing operation that appears to have already been applied to the selected representation, the origin server MAY respond with a 2xx (Successful) status code (i.e., the change requested by the user agent has already succeeded, but the user agent might not be aware of it, perhaps because the prior response was lost or an equivalent change was made by some other user agent)."*

And then talks you out of it for the case this chapter is about:

> *"Allowing an origin server to send a success response when a change request appears to have already been applied is more efficient for many authoring use cases, but comes with some risk if multiple user agents are making change requests that are very similar but not cooperative. For example, multiple user agents writing to a common resource as a semaphore (e.g., a nonatomic increment) are likely to collide and potentially lose important state transitions. For those kinds of resources, an origin server is better off being stringent in sending 412 for every failed precondition on an unsafe method."*

A shared board is precisely *"multiple user agents making change requests that are very similar but not cooperative"*. **Be stringent: 412 for every failed precondition.**

## `If-Match: *` and what it is for

The wildcard is not a version check; it is an existence check. RFC 9110: *"If the field value is '*', the condition is true if the origin server has a current representation for the target resource."*

That makes it the right precondition for exactly one thing: **an update that must not create.** A PUT to a card id that does not exist would otherwise be entitled to create the row (§9.3.4 requires 201 in that case). `If-Match: *` turns "create if absent" into 412.

```ts
if (ifMatch.trim() === '*') {
  const exists = await cardExistsForCaller(cardId)
  if (!exists) return new Response(null, { status: 412 })
  // fall through to an unconditional-but-existence-checked update
}
```

## Which encoding should this API ship?

Both mechanisms are the same check. Choose by client.

| Encoding | Choose it when | Cost |
|---|---|---|
| `If-Match` / 412 | You have third-party or generated clients, or anything that speaks HTTP generically. It is the standard answer and needs no documentation. | Headers survive fewer hops intact than bodies; some proxies and some mobile HTTP stacks strip or rewrite them |
| `version` in the body / 409 | Your only clients are your own UI and Server Actions. A Server Action has no natural place to put a request header. | Every client must learn a field name; nothing generic understands it |

**A Server Action is the honest reason most Next.js codebases end up on the body form.** An action is not an HTTP request the caller composes — the framework serialises arguments into a POST — so there is nowhere for the caller to put `If-Match`. If mutations are actions and the public API is Route Handlers, you will end up supporting both, and the DAL is what makes that cost one function instead of two implementations.

## Gotchas

**★ Symptom: every conditional write returns 412, even the first one.** Cause: the `ETag` served on the read is weak (`W/"…"`), and RFC 9110 requires strong comparison for `If-Match`, so no weak tag can ever satisfy it. Fix: emit a strong tag derived from the version — `"c-${id}-${version}"` — and never generate it by hashing a serialised body that contains a timestamp or a field whose order is not stable.

**★ Symptom: `If-Match` never arrives at the handler.** Cause: an intermediary stripped it, or the client library did not forward it on a redirect, or a CORS preflight did not allow it. Fix: for a browser client on another origin, `If-Match` is not a CORS-safelisted request header, so it must be permitted explicitly:

```ts
// in the OPTIONS handler / middleware for the cross-origin case
headers.set('Access-Control-Allow-Headers', 'content-type, if-match')
headers.set('Access-Control-Expose-Headers', 'etag')
```

`Access-Control-Expose-Headers` is the other half people forget: without it, browser JavaScript can never read the `ETag` it is supposed to send back.

**★ Symptom: the client reads `ETag` on the response and gets `null` in the browser.** Cause: same as above — `ETag` is not one of the CORS-safelisted response headers, so `res.headers.get('etag')` is `null` cross-origin until the server exposes it. Fix: `Access-Control-Expose-Headers: etag`.

**★ Symptom: a 412 is returned and the client has no way to recover except a full reload.** Cause: the 412 had an empty body. Fix: put the current representation and the new `ETag` on the 412, as the handler above does. The RFC does not require it, and a client that has it can diff instead of discarding what the user typed.

**★ Symptom: writes succeed without any precondition, from a client that used to send one.** Cause: the handler treated a missing `If-Match` as "unconditional, go ahead". Every client bug or proxy that drops the header now silently reopens the lost-update hole. Fix: decide once, explicitly. Either require it — 428 Precondition Required, as above — or fall back to the body `version` and 409. Never let an unconditioned write through by default on a resource with concurrent editors.

**★ Symptom: the response after a successful write carries the old `ETag`.** Cause: the tag was computed from the card object read before the update. Fix: compute it from the row `RETURNING` gave you, which already has the incremented version. A stale tag on a 200 guarantees the client's *next* write fails a precondition for no reason.

**★ Symptom: a shared CDN cached a card and clients started getting 412 in bursts.** Cause: the read was cacheable by a shared cache, so several clients received the same old representation and the same old tag long after the row moved. Fix: `Cache-Control: private, no-cache` on a resource whose tag is used for conditional writes. If you must cache it publicly, accept that the tag is a cache validator and stop using it as a concurrency token.

**★ Symptom: `If-Match` works for PATCH and is ignored on DELETE.** Cause: the precondition was implemented in one handler. Fix: `If-Match` applies to any state-changing method — RFC 9110 names POST, PUT and DELETE explicitly — and a conditional delete is genuinely useful ("delete this card only if it is still the one I read"). [08d](08d-status-codes-and-idempotency.md) covers the delete side.

**★ Symptom: the tag is derived from `updated_at` and two rapid writes produce the same tag.** Cause: timestamp resolution. Two updates within the same tick are indistinguishable and the second client's precondition passes against a row it never saw. Fix: derive from `version`. This is also the argument against `Last-Modified` and `If-Unmodified-Since` for this job — HTTP-date values have one-second resolution, and RFC 9110 notes an entity tag *"can be more reliable for validation than a modification date … where the one-second resolution of HTTP-date values is not sufficient"*.

**★ Symptom: the entity tag includes the card id and a client uses a tag from a different card.** Cause: nothing checked. Fix: `versionFromIfMatch` above compares the embedded id against the path parameter and returns `null` on mismatch, which the handler turns into a 400. Embedding the id costs nothing and turns a nonsensical request into a diagnosis.

## Interview questions

**★ When do you return 412 and when 409?**
412 when the client sent a precondition header — `If-Match` or `If-Unmodified-Since` — and the server evaluated it to false. 409 when the server detected a conflict with current state and the client had stated no precondition. RFC 5789 spells it out: a 412 "makes no sense if there was no precondition on the request", and in that case the server "can return a 409 (Conflict) response". The practical consequence is that a client seeing 412 knows to re-fetch and re-evaluate, whereas a 409 could be anything from a stale version to a duplicate key, so the client must inspect the body.

**★ Why must `If-Match` use strong comparison, and what breaks if your tags are weak?**
RFC 9110 requires it because the client's intent is to prevent the method being applied "if there have been any changes to the representation data" — a weak validator only promises semantic equivalence, which is too loose a guarantee to write against. If you serve `W/"…"` tags, no `If-Match` can ever be satisfied and every conditional write returns 412 forever, which usually gets diagnosed as "conditional requests are broken" rather than as a one-character bug in the tag.

**★ Your ETag is a hash of the JSON body. What goes wrong?**
Anything in the body that changes without the resource changing — a serialisation order, a rendered timestamp, an embedded count from another table — makes the tag change, so a client that read the resource twice gets two tags and its precondition fails. The reverse is worse: if the hash covers only a subset of fields, two genuinely different states can share a tag and a stale write passes the precondition. Deriving the tag from a monotonic version the database owns has neither problem, and it costs a string concatenation.

**★ RFC 9110 allows returning 2xx on a failed If-Match. Would you?**
Not for a resource multiple people edit, and the RFC agrees. It permits the 2xx as an efficiency for authoring cases where the requested change appears to have already been applied, then warns that with "multiple user agents making change requests that are very similar but not cooperative" you are "better off being stringent in sending 412 for every failed precondition on an unsafe method". A shared board is exactly that case, and the risk it names — losing important state transitions — is the bug we are trying to fix.

**★ A Server Action cannot send `If-Match`. So how does the same guarantee reach it?**
By putting the guarantee in the SQL rather than in the transport. The DAL function takes an expected version and puts it in the `WHERE` clause; a Route Handler derives that number from the `If-Match` header and answers 412, while a Server Action takes it as an argument and surfaces a conflict result to the client component. Two encodings, one statement, one guarantee — and if the action instead called `db.update` directly, it would be the hole through which everything else leaks.

**★ What is `If-Match: *` for?**
Existence, not versioning. It succeeds if the server has any current representation of the target, so its use is to stop an update from creating the resource — a PUT to an unknown id is otherwise entitled, indeed required, to create it and return 201. `If-Match: *` turns that into a 412 and gives you an "update only, never create" verb without inventing a new endpoint.

**★ Why does a shared cache in front of this API cause 412 storms?**
Because a cached read hands several clients the same representation and therefore the same entity tag, and it keeps doing so after the row has moved on. Each of those clients then sends a precondition that is stale by construction. The tag is doing double duty as a cache validator and a concurrency token, and those two jobs want opposite caching policies — which is why a resource used for conditional writes is served `private, no-cache`.

---

← [07d · Optimistic concurrency](07d-optimistic-concurrency-with-a-version-column.md) · [Chapter 16 overview](01-explanation.md) · Next → [07f · Pessimistic locking](07f-pessimistic-locking-and-when-it-is-right.md)
