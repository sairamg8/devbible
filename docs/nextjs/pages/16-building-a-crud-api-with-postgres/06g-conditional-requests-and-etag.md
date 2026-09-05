---
title: "An `ETag` is worth the trouble only if the client is allowed to store the response it validates — so `Cache-Control: no-store`, which the previous chunk recommended for an authorised list, silently makes every conditional request impossible, and `private, no-cache` is the directive that actually means \"keep it, but always ask me\""
sidebar_label: "06g · Conditional requests"
sidebar_position: 33
description: "Strong versus weak validators from the specification, an ETag built from the version column, the exact headers a 304 must carry, the collection ETag problem and two honest answers, the no-store versus no-cache distinction, and where If-Match hands over to topic 07."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 9110 *HTTP Semantics* — [§8.8.1 Weak versus Strong](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.1), [§8.8.3 ETag](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3), [§13.1.2 If-None-Match](https://www.rfc-editor.org/rfc/rfc9110#section-13.1.2), [§15.4.5 304 Not Modified](https://www.rfc-editor.org/rfc/rfc9110#section-15.4.5) — and RFC 9111 *HTTP Caching* — [§5.2.2.4 no-cache](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.4), [§5.2.2.5 no-store](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.5), [§5.2.2.7 private](https://www.rfc-editor.org/rfc/rfc9111#section-5.2.2.7).
> Documentation-verified; **no sandbox run, no timings, no bandwidth figures.**
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Conditional requests are the cheapest optimisation available to a read endpoint and the one most often implemented in a way that can never fire. The mechanism is two headers and a status code: you send `ETag`, the client sends it back as `If-None-Match`, and you answer 304 with no body. But it only works if the client kept the response — and the header that stops a shared cache leaking one team's board is `no-store` if you write it carelessly, which forbids storing anything at all. The result is a correct `ETag` implementation that produces a 200 on every request, forever, with nothing in any log to say why.**

## Strong and weak, and which one you can actually produce

RFC 9110 §8.8.1 gives the definitions, and the distinction is not academic:

> *"A 'strong validator' is representation metadata that changes value whenever a change occurs to the representation data that would be observable in the content of a 200 (OK) response to GET."*

> *"A strong validator is unique across all versions of all representations associated with a particular resource over time."*

> *"In contrast, a 'weak validator' is representation metadata that might not change for every change to the representation data."*

And on how to build a strong one:

> *"The best are based on strict revision control, wherein each change to a representation always results in a unique node name and revision identifier being assigned before the representation is made accessible to GET."*

🔴 **That sentence describes the `version` column the chapter schema already carries.** `version integer NOT NULL DEFAULT 1`, incremented on every update by the optimistic-concurrency machinery of [07d](07d-optimistic-concurrency-with-a-version-column.md), is a revision identifier assigned before the new state is readable. It is exactly the shape §8.8.1 names as best.

But §8.8.1 adds the caveat that decides strong versus weak here:

> *"if a resource has distinct representations that differ only in their metadata, such as might occur with content negotiation over media types that happen to share the same data format, then the origin server needs to incorporate additional information in the validator to distinguish those representations."*

If `GET /api/cards/{id}` has exactly one representation, `version` is a strong validator and you may emit it unprefixed. The moment you add `?fields=`, content negotiation, or an embedded-relations parameter, one `version` maps to several byte sequences and the validator is weak — **and a weak validator that is not marked weak is a correctness bug**, because §8.8.3 makes the marking mandatory:

> *"If an origin server provides an entity tag for a representation and the generation of that entity tag does not satisfy all of the characteristics of a strong validator (Section 8.8.1), then the origin server MUST mark the entity tag as weak by prefixing its opaque value with 'W/' (case-sensitive)."*

## A card's `ETag`

🔴 **This is the chapter's only definition of the tag.** `lib/http/etag.ts` is written here, on the read side, because this is where the tag is first emitted — and the write side imports the same function rather than restating it. [07e · ETag, If-Match, 412](07e-etag-if-match-and-412.md) calls `cardETag` to fill the `ETag` header on a successful PATCH and on the 412 it returns when the precondition fails; if the two sides ever computed a tag differently, a client would revalidate against a value the writer never minted.

```ts
// lib/http/etag.ts
import 'server-only'

/**
 * Strong validator for the single canonical representation of a card.
 * `version` is incremented by every update (topic 07), so it changes
 * whenever the representation data changes.
 *
 * If this endpoint ever gains ?fields= or content negotiation, one version
 * maps to several byte sequences and this MUST become W/"..." — or must
 * incorporate the varying dimension into the tag.
 */
export function cardETag(card: { id: string; version: number }): string {
  return `"${card.id}.${card.version}"`
}
```

Note the double quotes are *part of the value*. §8.8.3's grammar is `opaque-tag = DQUOTE *etagc DQUOTE` — an entity tag without them is syntactically invalid, and the specification adds a warning worth heeding:

> *"Note: Previously, opaque-tag was defined to be a quoted-string ([RFC2616], Section 3.11); thus, some recipients might perform backslash unescaping. Servers therefore ought to avoid backslash characters in entity tags."*

So build tags from hex, base64url or dotted identifiers — never from anything that might contain a backslash.

```ts
// app/api/cards/[cardId]/route.ts
import { cardETag } from '@/lib/http/etag'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/cards/[cardId]'>,
) {
  const { cardId } = await ctx.params
  const id = CardIdParam.safeParse(cardId)
  if (!id.success) return errorResponse(400, 'invalid_card_id', 'cardId must be a UUID')

  const card = await getCard(id.data)
  if (!card) return errorResponse(404, 'not_found', 'No such card')

  const etag = cardETag(card)

  if (ifNoneMatchSatisfied(request.headers.get('If-None-Match'), etag)) {
    // §15.4.5: a 304 "cannot contain content or trailers", and MUST carry
    // any of Content-Location, Date, ETag, Vary, Cache-Control and Expires
    // that a 200 to the same request would have carried.
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, no-cache',
      },
    })
  }

  return Response.json(toWire(card), {
    headers: {
      ETag: etag,
      'Cache-Control': 'private, no-cache',
    },
  })
}
```

⚠️ **The database read still happens.** A 304 saves the response body on the wire, not the query — you cannot know the current `ETag` without knowing the current `version`. Saving the query as well means caching the validator, which is a different and larger design. Be clear about which cost you are removing before claiming a benefit.

## Comparing `If-None-Match`, correctly

§13.1.2 is precise about the comparison function and about the list form:

> *"A recipient MUST use the weak comparison function when comparing entity tags for If-None-Match (Section 8.8.3.2), since weak entity tags can be used for cache validation even if there have been changes to the representation data."*

> *"If the field value is a list of entity tags, the condition is false if one of the listed tags matches the entity tag of the selected representation."*

> *"If the field value is '*', the condition is false if the origin server has a current representation for the target resource."*

Weak comparison means `W/"abc"` and `"abc"` match each other for `If-None-Match`. The header is also a *list*, with the documented forms `If-None-Match: "xyzzy", "r2d2xxxx", "c3piozzzz"` — so a naive string equality against the whole header value fails the moment a client holds two cached representations.

```ts
/**
 * Weak comparison over a comma-separated list, per §13.1.2 and §8.8.3.2.
 * Weak comparison ignores the W/ prefix on either side.
 */
function ifNoneMatchSatisfied(header: string | null, current: string): boolean {
  if (!header) return false
  const trimmed = header.trim()
  if (trimmed === '*') return true   // we have a current representation

  const strip = (t: string) => t.trim().replace(/^W\//, '')
  const currentOpaque = strip(current)
  return trimmed.split(',').some((tag) => strip(tag) === currentOpaque)
}
```

⚠️ **Splitting on `,` is safe for entity tags and would not be for every header.** An `etagc` is *"VCHAR except double quotes, plus obs-text"*, so a comma can appear inside a tag's opaque value if you put one there. Do not — keep tags to hex, digits and dots, and the split stays correct.

## 🔴 `no-store` makes all of this dead code

[06e](06e-caching-a-collection.md) recommends keeping an authorised response out of shared caches. The directive that does that is `private`, and RFC 9111 §5.2.2.7 says exactly what it means:

> *"The unqualified private response directive indicates that a shared cache MUST NOT store the response (i.e., the response is intended for a single user). It also indicates that a private cache MAY store the response, subject to the constraints defined in Section 3"*

`no-store` is a different and much stronger thing — §5.2.2.5:

> *"The no-store response directive indicates that a cache MUST NOT store any part of either the immediate request or the response and MUST NOT use the response to satisfy any other request."*

> *"'MUST NOT store' in this context means that the cache MUST NOT intentionally store the information in non-volatile storage and MUST make a best-effort attempt to remove the information from volatile storage as promptly as possible after forwarding it."*

**If the client may not store the response, it has nothing to revalidate**, so it will never send `If-None-Match` and your `ETag` can never produce a 304. The implementation is not broken; it is unreachable.

`no-cache` is the directive people mean when they type `no-store` — §5.2.2.4:

> *"The no-cache response directive, in its unqualified form (without an argument), indicates that the response MUST NOT be used to satisfy any other request without forwarding it for validation and receiving a successful response"*

> *"This allows an origin server to prevent a cache from using the response to satisfy a request without contacting it, even by caches that have been configured to send stale responses."*

**Store it, and always revalidate.** That is exactly the contract a conditional request needs.

| You want | Header |
|---|---|
| No cache anywhere, not even the browser's disk — a token, a one-time code | `no-store` |
| Private, always revalidated — **an authorised resource with an `ETag`** | `private, no-cache` |
| Private, reusable for a bounded time without asking | `private, max-age=60` |
| Shared-cacheable — genuinely public data only | `public, max-age=60` |

🔴 **`public` on anything the ownership predicate gates is a data leak** — a shared cache keys on the URL, and the URL does not identify the caller. That argument is in [06e](06e-caching-a-collection.md) and it does not change here.

And add `Vary` if anything other than the URL selects the representation:

```ts
headers: {
  ETag: etag,
  'Cache-Control': 'private, no-cache',
  Vary: 'Accept, Accept-Encoding',
}
```

## The collection `ETag`, which is a harder problem

A single card has a revision identifier. A page of cards does not, and there is no column to read.

**Option 1 — a digest over the page's identity.** Hash the `(id, version)` pairs of the rows you are about to return, in order. It changes when any card on the page changes, when the ordering changes, and when membership changes, which is exactly right:

```ts
import { createHash } from 'node:crypto'

/**
 * Weak: the same set of (id, version) pairs can serialise to different bytes
 * if the projection or the encoding changes, so W/ is the honest prefix.
 */
export function cardPageETag(items: { id: string; version: number }[]): string {
  const h = createHash('sha256')
  for (const c of items) h.update(`${c.id}.${c.version}\n`)
  return `W/"${h.digest('hex').slice(0, 32)}"`
}
```

⚠️ **It saves the body, never the query.** You must have the rows to compute the digest, so the database work is already done before you know whether to send 304. On a large payload that is still worth it; on a twenty-row JSON page it may not be, and there is no sandbox here to tell you where the line is on your data.

**Option 2 — `max(updated_at)` plus a count.** One cheap aggregate, no page fetch, and it is genuinely weaker: it misses the case where one card is deleted and another created between requests, leaving the count identical and the maximum timestamp merely newer — which it does detect — but it also changes when a card *not on this page* is touched, producing false misses. It is a defensible trade when the page fetch is expensive and false misses are cheap. Mark it `W/` and say what it covers.

**Option 3 — do not.** For a paginated, filtered, sorted collection with a per-board framework cache already in front of it ([06e](06e-caching-a-collection.md)), a collection `ETag` is often complexity without a payer. A single resource is where conditional requests earn their keep.

## Where `If-Match` hands over

`If-None-Match` is the read-side precondition. Its write-side sibling, `If-Match`, is the mechanism for *"do not apply this update unless the resource is still in the state I read"*, and it produces `412 Precondition Failed` rather than 409. **That is [07e · ETag, If-Match, 412](07e-etag-if-match-and-412.md)** — the lost-update problem of [07c](07c-the-lost-update.md), the `version` column of [07d](07d-optimistic-concurrency-with-a-version-column.md), and the 409-versus-412 argument — and this page deliberately stops at the boundary, handing over `cardETag` rather than a second copy of it.

One thing worth carrying across: §13.1.2 notes that `If-None-Match: *` also serves a write purpose —

> *"If-None-Match can also be used with a value of '*' to prevent an unsafe request method (e.g., PUT) from inadvertently modifying an existing representation of the target resource when the client believes that the resource does not have a current representation."*

— which is the standardised way to say *create only, do not replace*, and is the correct answer to the create-versus-replace question [05e](05e-client-supplied-ids-and-identifier-choice.md) raises for a client-supplied id.

## Gotchas

**★ Symptom: the `ETag` is emitted correctly and no client ever sends `If-None-Match`.** Cause: the response also carries `Cache-Control: no-store`, which per §5.2.2.5 means a cache *"MUST NOT store any part of"* it — so there is no stored response to revalidate. Fix: `private, no-cache`. That stores it and forbids reuse *"without forwarding it for validation"*, which is the contract a conditional request needs.

**★ Symptom: `If-None-Match` matches in tests and never in a browser.** Cause: the comparison was string equality against the whole header value, and real clients send a list — the specification's own example is `If-None-Match: "xyzzy", "r2d2xxxx", "c3piozzzz"`. Fix: split on commas and compare each tag, as `ifNoneMatchSatisfied` does.

**★ Symptom: a client caches a stale card and never revalidates past it.** Cause: the tag was emitted unquoted, so it is not a syntactically valid entity tag and some clients discard it. Fix: the quotes are part of the value — the grammar is `opaque-tag = DQUOTE *etagc DQUOTE`. Build the header as `` `"${id}.${version}"` ``, not as `` `${id}.${version}` ``.

**★ Symptom: the `ETag` contains a backslash and one client's revalidation never matches.** Cause: the specification warns that *"some recipients might perform backslash unescaping"*, a legacy of `ETag` once being a `quoted-string`. Fix: keep tags to hex, digits and dots. Never embed a path, a filename, or anything else that can contain a backslash.

**★ Symptom: `?fields=title` and the full representation share an `ETag`, and a client that requests both gets the wrong body.** Cause: one `version` now maps to several byte sequences, so the validator is no longer strong — §8.8.1's *"distinct representations that differ only in their metadata"* case — and the specification requires that a non-strong tag be *"marked as weak by prefixing its opaque value with 'W/'"*. Fix: either incorporate the varying dimension into the tag, or emit `W/`, and in both cases send `Vary` naming the request header that selects the representation.

**★ Symptom: 304 responses break a client that reads `Content-Type`.** Cause: the 304 dropped headers a 200 would have carried. §15.4.5: the server *"MUST generate any of the following header fields that would have been sent in a 200 (OK) response to the same request: Content-Location, Date, ETag, and Vary; Cache-Control and Expires"*. Fix: echo `ETag`, `Cache-Control` and `Vary` on the 304, and do not add representation metadata beyond that list, which the same section advises against.

**★ Symptom: a 304 has a body and some intermediaries mangle the response.** Cause: §15.4.5 is absolute — *"A 304 response is terminated by the end of the header section; it cannot contain content or trailers."* Fix: `new Response(null, { status: 304, headers })`. Never `Response.json(..., { status: 304 })`, which is easy to type by symmetry with the 200 path.

**★ Symptom: adding conditional requests did not reduce database load at all.** Cause: correct and expected — you must read the row to compute its current validator, so the query runs whether the answer is 200 or 304. Fix: nothing here; the saving is response bytes and client parsing. If the query is the cost you need to remove, that is the framework cache in [06e](06e-caching-a-collection.md), and the two are complementary rather than alternatives.

**★ Symptom: a collection `ETag` never matches even on an unchanged board.** Cause: the digest was taken over the serialised response, which included a request id, a timestamp, or a `nextCursor` derived from something that varies. Fix: digest a canonical description of the *content* — the ordered `(id, version)` pairs — and never the envelope. Anything in the payload that varies independently of the data will destroy the hit rate silently.

**★ Symptom: `Vary` was omitted and a shared cache served a compressed body to a client that cannot decompress it.** Cause: the representation depends on `Accept-Encoding` and nothing said so. Fix: send `Vary` naming every request header that selects the representation. This matters even under `private`, because a private cache is still a cache and still keys on what you tell it to.

**★ Symptom: `If-Match` was implemented on the GET endpoint and does nothing useful.** Cause: `If-Match` is a precondition for unsafe methods — it exists to make an update conditional on the resource not having changed. Fix: it belongs on PATCH and PUT and produces 412, which is [07e](07e-etag-if-match-and-412.md). On a read, the precondition you want is `If-None-Match`.

**★ Symptom: a client uses the `ETag` value as a version number and starts incrementing it.** Cause: the tag was constructed transparently as `"<id>.<version>"`, so its structure invited interpretation. §8.8.3 is explicit that *"Since the value is opaque, there is no need for the client to be aware of how each entity tag is constructed."* Fix: document it as opaque, and if the coupling would be expensive to break, hash it so there is nothing to parse. The readable form is a debugging convenience you are trading for a contract you did not intend to offer.

## Interview questions

**★ Why does `Cache-Control: no-store` make an `ETag` implementation unreachable rather than merely less effective?**
Because conditional requests are a two-step protocol and `no-store` removes the first step. The client is supposed to store the response along with its validator, then send that validator back as `If-None-Match` on the next request so the server can answer 304. RFC 9111 §5.2.2.5 says `no-store` means a cache *"MUST NOT store any part of either the immediate request or the response"* and must make a best-effort attempt to remove it from volatile storage promptly — so there is no stored response, no validator to send, and `If-None-Match` never arrives. Every request is a 200 and nothing anywhere reports a problem, because the server is behaving correctly and so is the client. The directive people actually want is `no-cache`, which stores the response but forbids using it *"without forwarding it for validation and receiving a successful response"* — store it, always ask. Paired with `private`, that keeps the response out of shared caches and still enables 304s.

**★ Is the `version` column a strong validator? Under what circumstances does the answer change?**
It is strong as long as the endpoint has exactly one representation. §8.8.1 defines a strong validator as metadata that *"changes value whenever a change occurs to the representation data that would be observable in the content of a 200 (OK) response to GET"*, and it names revision control as the best source — *"each change to a representation always results in a unique node name and revision identifier being assigned before the representation is made accessible to GET"*, which describes `version` exactly. The answer changes the moment one version can map to more than one byte sequence: a `?fields=` parameter, content negotiation between JSON and something else, an `?include=labels` option. §8.8.1 covers that case explicitly and says the server *"needs to incorporate additional information in the validator to distinguish those representations"*. If you do not, §8.8.3 requires the tag be marked weak with `W/`, and shipping an unmarked weak tag is a correctness bug, not a stylistic one — clients use strong comparison for `If-Range` and range requests will assemble a corrupt representation.

**★ What must a 304 response contain, and what must it not?**
It must carry any of `Content-Location`, `Date`, `ETag`, `Vary`, `Cache-Control` and `Expires` that a 200 to the same request would have carried — §15.4.5 lists exactly those and makes it a MUST — because the client is updating a stored response and those fields are what it updates. It must not contain a body: *"A 304 response is terminated by the end of the header section; it cannot contain content or trailers."* And it should not carry other representation metadata; the same section says a sender *"SHOULD NOT generate representation metadata other than the above listed fields unless said metadata exists for the purpose of guiding cache updates"*. The failure people ship is the mirror of that advice — copying the whole 200 header set onto the 304, which is more forgivable, or dropping `ETag` and `Vary` from it, which breaks the client's ability to update what it stored.

**★ Why is a collection `ETag` harder than a single-resource one, and what are your options?**
Because a collection has no revision identifier. A card has `version`, incremented on every write, sitting in a column; a page of cards is a derived thing whose identity depends on which rows matched, in what order, in what state — and there is nothing to read. The first option is to digest the ordered `(id, version)` pairs of the rows you are returning, which changes correctly on any change to membership, ordering or content; its limitation is that you have already done all the database work by the time you can compute it, so it saves bytes and never a query. The second is a cheap aggregate like `max(updated_at)` plus a count, which avoids fetching the page but produces false misses whenever any card on the board changes, including ones not on this page. The third, and often the right one, is not to bother: a paginated, filtered, sorted collection sitting behind a per-board framework cache is already covered, and the conditional-request machinery is complexity nobody is paying for. Single resources are where it earns its keep.

**★ A colleague implements `If-None-Match` with `header === etag`. What breaks?**
Two things, and both only in production. The header is a list — §13.1.2's own examples include `If-None-Match: "xyzzy", "r2d2xxxx", "c3piozzzz"` — so a client holding several cached representations of the resource sends all of them, and a whole-string comparison matches none. And the comparison function is wrong: §13.1.2 says a recipient *"MUST use the weak comparison function when comparing entity tags for If-None-Match"*, which ignores the `W/` prefix on either side, so a client returning `W/"abc"` against a stored `"abc"` should match and will not. Both failures degrade silently to a 200, which is why the implementation passes every test written against a single-tag client and quietly never fires for real ones. The third case worth handling is `*`, which §13.1.2 defines as false *"if the origin server has a current representation for the target resource"* — so for an existing card, `*` means send the 304.

**★ Where does `If-Match` fit, and why is it not on this page?**
`If-Match` is the write-side precondition: it makes an unsafe method conditional on the resource still being in the state the client read, which is the standardised solution to the lost-update problem and produces `412 Precondition Failed` when it does not hold. That is [07e](07e-etag-if-match-and-412.md) — PUT versus PATCH, the `version` column as an optimistic-concurrency token, and the argument about when a conflict is 409 and when it is 412 — and splitting it across two pages would give the reader two half-answers. What does belong here is the read-side sibling and one write-side special case: §13.1.2 notes that `If-None-Match: *` prevents an unsafe method from *"inadvertently modifying an existing representation of the target resource when the client believes that the resource does not have a current representation"*, which is the specification's own answer to *create-only, never replace* — the exact question a client-supplied identifier raises in [05e](05e-client-supplied-ids-and-identifier-choice.md).

---

← [06f · The N+1 on a card list](06f-the-n-plus-1-on-a-card-list.md) · [Chapter 16 overview](01-explanation.md) · Next → [07 · UPDATE — PUT vs PATCH](07-update.md)
