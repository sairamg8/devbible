---
title: "The protocol's one specified invalidation reaches only the cache the write passed through and only the URI it targeted, so the edge is configured by sending explicit headers, verifying what the CDN does with them, and keeping the key small"
sidebar_label: "07e · Unsafe methods and the edge"
sidebar_position: 7.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §4.4.2
> (invalidation by unsafe methods, quoted), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §9.2.1 (safe, quoted), and the RFC 9111 and MDN quotes of [07](07-http-caching-semantics.md) and
> [07d](07d-vary-stale-directives-and-configuring-the-edge.md). What a particular CDN does with the
> directives is vendor behaviour and was **not fetched**; the storefront table is a worked design,
> not a measurement. **No sandbox run.**

**HTTP specifies exactly one form of invalidation — a successful write invalidates the target
URI in the caches it passed through — and the rest of keeping the browser and the CDN correct is
the headers you send and the verification you do on what the CDN made of them.** This page
closes the topic: the rule and its limits, the edge configuration discipline, and the storefront's
complete header map.

## Unsafe methods invalidate

> *"Request methods are considered 'safe' if their defined semantics are essentially read-only; they do not commit to any action on the origin server."* — RFC 9110 §9.2.1

The complement of *safe* is what the cache rule keys on, and it is the one piece of invalidation specified rather than designed:

> *"A cache MUST invalidate the target URI when it receives a non-error status code in response to an unsafe request method (including methods whose safety is unknown)."* — RFC 9111 §4.4.2

When a `PUT` to `/products/42` succeeds through a cache, that cache drops its stored response for
`/products/42`. Know its limits, because they are where a design assumes more than the protocol
gives: it applies only to caches the write **passes through** (a browser invalidates its own copy;
the CDN does only if the write went via the CDN; other users' browsers are untouched), it names
the **target URI** only (the listing page that includes the product is a different URI and is not
invalidated), and it protects nothing when the write goes around the cache — a background job, an
admin tool on another host. It is a courtesy, not an invalidation strategy; the strategy is the
next topic (**03 · Invalidation** *(not written yet)*).

## Configuring the edge

The browser and the CDN are the two caches you do not build. The CDN reads your headers as the
**origin's declaration** and then applies its own configuration over them: a default lifetime when
none is sent, a cap on how long it will keep anything, a rule that ignores or overrides certain
directives, its own cache key that may or may not include query strings and headers.
[CDNs](../phase-2-request-path/05-cdns.md) covers the key, the purge and the shield; the
HTTP-header discipline is:

- **Send explicit headers and verify what the CDN does with them**, per directive. The origin's
  header is the intent; the CDN's behaviour is the fact.
- **Use `s-maxage` for the shared tier and `max-age` for the browser** so the CDN, which you can
  purge, carries the long lifetime.
- **Make the key as small as the response allows**: `Vary` on few headers, normalised; query
  parameters whitelisted.
- **Treat `Set-Cookie` on a cacheable response as a bug**; whether a given CDN refuses to store it
  is vendor behaviour — enforce it in the origin.

## The storefront's header map

| Response | `Cache-Control` | Validator | Notes |
|---|---|---|---|
| `/static/app.<hash>.js`, images with hashed names | `public, max-age=<very long>, immutable` | none needed | deployed before the HTML; old builds kept for a window |
| HTML shell | `no-cache` | `ETag` from the build id | a deploy is visible on the next navigation; the `304` is tiny |
| `GET /products/:id`, anonymous | `public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400` | version-derived `ETag` | purge by product tag from the price-change event; `Vary: Accept-Encoding` only |
| `GET /categories/:slug?page=` | as above with a shorter lifetime | version of the category | query parameters whitelisted in the CDN key |
| `GET /search?q=` | `private, max-age=<short>` or `no-store` | none | too many keys for the shared tier; see **11 · Caching computed results** *(not written yet)* |
| `GET /cart`, `/account`, `/orders` | `private, no-store` | none | middleware default; session cookie present |
| `POST /orders`, any mutation | `no-store` | none | never reusable |
| `PUT /admin/products/:id` | `no-store` | requires `If-Match` with the record's `ETag`; `412` on mismatch | write guard from [07c](07c-validators-etag-and-conditional-requests.md) |
| error responses, `429` | `no-store` | none | set once in the error handler |
| the flash-sale product page | the product-page row, with a warmed edge and a lifetime that is a design decision | version-derived `ETag` | the price and stock *charged* are read at checkout, not from this response |

Reading the table as a whole: the lifetime on every shareable row is a statement about how long
the business tolerates a wrong answer, the purge is what makes it safe to leave that lifetime
long, and the rows that are `no-store` are the rows where the answer must never be anyone else's.

## Gotchas

**★ Symptom: after writing a product, the product page updates and the category listing still
shows the old price.** Cause: relying on invalidation by unsafe methods; RFC 9111 §4.4.2
invalidates only the target URI of a write that passed through that cache. Fix: purge related
URIs by tag from the write path; treat the protocol rule as a courtesy.

**★ Symptom: the CDN cached nothing although the origin sent `public, max-age=60`.** Cause: a
`Set-Cookie` on the response, a CDN rule that bypasses the cache for requests with cookies, or a
cache key that includes a per-user value; the header was correct and the edge's configuration
overrode it. Fix: look at the CDN's own hit/miss indication and `Age` on the response, remove
the cookie from the shareable response, strip cookies from the key.

**★ Symptom: the CDN served a stale page longer than the origin's headers allow.** Cause: the CDN
applies its own minimum or default lifetime over the origin's, or ignores a directive it does not
implement. Fix: read the CDN's documented behaviour per directive; do not assume the RFC is the
whole story, and verify with a test request after a change.

**Symptom: a purge works for the product page and not the search page that lists the product.**
Cause: purging by URL addresses one object, and listings are other URLs. Fix: tag responses with
the entities they contain and purge by tag, or accept a short lifetime on the listing.

**Symptom: the origin cannot tell what the CDN is doing.** Cause: no observability on the edge
behaviour. Fix: log `Age` and the CDN's hit/miss header at the client edge or in a synthetic
check, so a header regression shows as a changed pattern rather than as a customer report.

## Interview questions

**Does a successful `PUT` through the CDN clear every cached copy of the product?**
No. Per RFC 9111 §4.4.2 a cache invalidates the target URI of a non-error response to an unsafe
method, only if the request passed through it. Other URIs that embed the product — listings,
search — are untouched, other users' browsers are untouched, and a write that bypassed the cache
invalidates nothing. Purge by tag from the write path is the real mechanism.

**★ A product description was changed and the support team says the page still shows the old
text. Walk the layers.**
Browser: how long did the response allow reuse (`max-age`), and is the client-side data cache
involved. CDN: is the lifetime `s-maxage`, did the write trigger a purge by tag, and does the CDN
apply its own minimum. Gateway and in-process caches ([01](01-where-a-cache-can-live.md)). Then
the distributed cache entry and any replica lag. The HTTP-specific checks are the `Age` and CDN
hit/miss headers on the response, and whether the purge targeted every URI that embeds the text.

**What is the one thing you verify after changing a caching header?**
The response as the client receives it, through the CDN — `Cache-Control`, `Vary`, `Age`, any
`Set-Cookie`, and the CDN's hit or miss indicator — because the origin's header is only the
intent and a framework layer or the edge may have changed it.

{/* FOOTER */}
