---
title: "A CDN is a cache in every city the users are in, and the design decisions are what the cache key is, how long an object lives against how it is purged, whether the edges shield the origin from a stampede, how a private object is served from a public cache, and what the edge does for a request it cannot cache"
sidebar_label: "05 · CDNs"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method and common practice — cache keys, TTL versus purge, origin
> shields, signed URLs and dynamic acceleration are described as the major CDNs implement them,
> without vendor names, defaults or price claims. HTTP cache-control semantics (RFC 9111) were
> **not fetched**; directives are named as mechanism. The one quoted rule is
> [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4 — 429 *"MUST NOT be stored by a
> cache"*. Latency figures are the ladder of [phase 0](../phase-0-the-interview/05-the-latency-ladder.md).
> **No sandbox run.**

**A content delivery network is a fleet of caches placed where the users are, so that a request
for something already seen is answered in one nearby round trip instead of a crossing to the
origin — and for the storefront, whose bill is image egress and whose reads are two orders of
magnitude above its writes, it is the box that decides both the latency and the cost.** The
mechanism is a cache, and every cache question applies: what identifies an object (the cache
key), how long it may be served without asking (the TTL), how it is removed before then (the
purge), what happens when a thousand edges miss at once (the stampede the origin shield
prevents), and how something that is not public — a customer's invoice — can be served from a
public cache (a signed URL). Then the part candidates miss: for a request that cannot be
cached at all, the CDN still terminates the user's handshakes nearby and carries the request to
the origin over warm connections on its own backbone. This page is each of those decisions,
the storefront's images and catalogue pages at the edge, and the failure modes a cache in a
hundred cities has.

## What the edge does

| Request | The edge | The origin sees |
|---|---|---|
| static asset — image, bundle, font | cache hit after the first request per edge | one request per edge per TTL |
| semi-static page — a product page for an anonymous visitor | cache hit on a key that excludes the cookie; short TTL or event-driven purge | one request per edge per TTL, or per purge |
| personalised page — the cart, the account | not cacheable; pass-through | every request |
| API write — `POST /orders` | not cacheable; pass-through, with the edge's handshakes and backbone | every request |
| 429, 5xx, `Set-Cookie` responses | not stored | — |

The two pass-through rows are where "the CDN makes it fast" is half true: the user's TCP and
TLS handshakes end at the edge, tens of milliseconds away, and the edge holds pooled,
already-open connections to the origin over the provider's backbone, so the request pays one
crossing and no handshakes — [01](01-from-the-tap-to-the-first-byte.md)'s arithmetic. Some CDNs
call this dynamic acceleration; it is connection reuse and route optimisation, and the floor is
still the crossing.

## The cache key

An edge stores an object under a key, and the key decides what counts as "the same request".
The default is the URL — scheme, host, path, query — and every design mistake at the edge is a
key that is too wide or too narrow:

- **Too wide** — the key ignores something the response depends on. A product page cached under
  its URL while the response varies by currency, language or logged-in state serves one user's
  page to another. The fix is to include the varying input in the key (a header, a cookie
  value, a query parameter) or to not cache the varying response at all. The `Vary` header is
  the origin's way of telling the cache which request headers to add to the key.
- **Too narrow** — the key includes something that does not change the response. A session
  cookie in the key gives every user their own copy; a cache-busting query parameter or a
  tracking parameter in the key gives every campaign link its own copy; the hit ratio collapses
  and the origin sees every request. The fix is to strip from the key what the response ignores:
  cookies on static assets, query parameters not used by the page, the ordering of parameters.

The storefront's rule: images and bundles keyed by path and a content hash in the filename,
cookies stripped; the product page for anonymous visitors keyed by path plus a currency cookie,
and *not cached at all* when a session cookie is present.

## TTL against purge

Two ways to keep an edge from serving something stale, and they trade against each other:

**Time-to-live.** The origin says how long the object may be served without revalidation
(`Cache-Control: max-age`). Long TTLs give high hit ratios and stale content for up to the TTL
after a change; short TTLs give freshness and origin load. The way out for assets is
**immutable content with a hashed name** — `app.3f9c1e.js` never changes, so its TTL can be a
year, and a new build produces a new name; the HTML that references it has a short TTL.

**Purge.** The origin tells the CDN to drop an object now, by URL, by tag, or everything.
Purge is the answer for content that must change immediately — a price, a recall, a legal
notice — and its costs are that it is an API call across a hundred edges that completes in
seconds rather than instantly, that tag-based purge needs the origin to tag responses, and that
a purge of a popular object turns the next request at every edge into a miss at once.

The combination most designs land on: long TTLs on hashed assets, a short TTL (a minute) on
semi-static pages as a safety net, and **event-driven purge** from the same outbox that
invalidates the application cache ([phase 1's data-model page](../phase-1-the-method/06-the-data-model-from-access-patterns.md))
— a price change publishes an event, a consumer purges the product's page and image by tag.

```text
Cache-Control: public, max-age=31536000, immutable      # /static/app.3f9c1e.js — a year; the name is the version
Cache-Control: public, max-age=60, stale-while-revalidate=300   # /products/42 for anonymous visitors — a minute, then serve stale while refreshing
Cache-Control: private, no-store                        # /cart, /account, anything with Set-Cookie
```

`stale-while-revalidate` is the directive that turns a TTL expiry from a miss into a background
refresh: the edge serves the stale copy immediately and fetches a fresh one behind it, so the
origin sees one request per edge per window and no user waits.

## The stampede, and the origin shield

A popular object expires or is purged at the same moment in every edge; the next request at
each edge misses; a hundred edges each ask the origin at once — for the same object. Within one
edge the same thing happens across requests: a thousand concurrent misses for one key. Two
mechanisms:

- **Request coalescing** at the edge — the first miss fetches; the concurrent misses for the
  same key wait for that fetch rather than each going to origin. This is the cache-standby
  argument of [phase 1's failure walk](../phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md),
  at the edge.
- **An origin shield** — one designated cache layer between the edges and the origin, so a
  hundred edge misses become one shield miss and one origin request. The shield sits in the
  origin's region; the cost is one more hop for misses and a second cache to reason about.

With both, a purge of the home page at peak is one origin request, not a hundred thousand.
Without them, a purge is a self-inflicted outage — which is the sentence to say when purge is
proposed.

## Private content from a public cache

An invoice, a paid download, a customer's uploaded photo: cacheable bytes that not everyone may
see. The mechanism is a **signed URL** — the origin issues a URL carrying an expiry and a
signature over the path and expiry; the edge verifies the signature with a shared key, serves
from cache if it has the object, and refuses without a valid signature. The object is cached
once and served to many authorised requests; authorisation is decided at issue time, not per
edge request. The trade: a signed URL can be shared for as long as it lives, so expiries are
short and the URL is issued per view, not stored. **Signed cookies** do the same for a set of
paths — a whole album — rather than one object. Object-storage uploads of
[04](04-stateless-services-and-where-the-state-went.md) used the same idea in the other
direction.

## The storefront at the edge

| Content | Key | TTL / purge | Notes |
|---|---|---|---|
| product images | path with content hash; cookies stripped | a year, immutable | resized variants pre-generated; the largest egress line of [phase 1's cost page](../phase-1-the-method/13-designing-for-cost.md) |
| JS/CSS bundles | path with build hash | a year, immutable | the HTML shell has a short TTL and references the hashed names |
| product page, anonymous | path + currency; skip on session cookie | 60 s + stale-while-revalidate; purge by product tag on price change | the event from the outbox drives the purge |
| category listing | path + query (page, sort) — parameters whitelisted | 60 s; purge by category tag | tracking parameters stripped from the key |
| search results | not cached | — | too many keys, too personal |
| cart, account, checkout | `private, no-store` | — | pass-through with edge TLS and warm origin connections |
| invoices | signed URL, 10-minute expiry | cached; access controlled at issue | one object, many authorised views |
| the API's 429s | never stored | — | RFC 6585 §4: *"Responses with the 429 status code MUST NOT be stored by a cache."* |

## Failure modes of a cache in a hundred cities

- **A stale price after a change** — TTL too long, purge missing, or purge by URL when the page
  has a dozen URLs (query variants, locales). Fix: purge by tag; short TTL as the net.
- **One user's page served to another** — key too wide. Fix: `Vary`, or the varying input in
  the key, or `private`.
- **Hit ratio in the low tens** — key too narrow: cookies or tracking parameters in the key.
  Fix: strip them; whitelist the query parameters the page uses.
- **The origin down, and the edge serving errors** — no `stale-if-error`. Fix: allow the edge
  to serve a stale copy while the origin is unreachable; a stale catalogue beats a 502.
- **A purge at peak took the origin down** — no coalescing or shield. Fix: both.
- **The edge cached a `Set-Cookie` response** — a session handed to every visitor. Fix: never
  cache responses that set cookies; `private, no-store` on anything personalised, and a CDN
  rule that refuses to store `Set-Cookie` regardless.
- **A point of presence down** — DNS routes users to the next nearest; the failover is the
  CDN's, and the design's only job is not to depend on a single edge.

## Gotchas

**★ Symptom: a price changed an hour ago and some users still see the old one.** Cause: a long
TTL with no purge, or purge by URL missing the page's variants. Fix: event-driven purge by tag
from the outbox; a short TTL on semi-static pages as the safety net.

**★ Symptom: a logged-in user sees another user's name on a cached page.** Cause: the cache
key omits the session; a personalised response cached under its URL. Fix: `private, no-store`
on anything with a session cookie; `Vary` or the key extended for legitimately varying public
content.

**★ Symptom: the hit ratio is 20 %.** Cause: cookies, tracking parameters or parameter order in
the key — every visitor a unique key. Fix: strip cookies from static keys, whitelist query
parameters, normalise ordering.

**Symptom: a purge of the home page took the origin down.** Cause: every edge missed at once,
no coalescing, no shield. Fix: request coalescing and an origin shield; `stale-while-revalidate`
so expiry is a background refresh.

**Symptom: the origin is down and the site shows 502s though everything is cached.** Cause: no
`stale-if-error`. Fix: allow stale on origin error; a day-old catalogue is a product, a 502 is
not.

**Symptom: a signed invoice URL is being shared on a forum.** Cause: a long expiry, or the URL
stored and reused. Fix: short expiry, issued per view; revoke by rotating the signing key if
needed.

**Symptom: a deploy broke the site because the HTML referenced a bundle the edge did not have
yet.** Cause: the HTML cached longer than the assets it names, or assets deployed after HTML.
Fix: hashed asset names with a year TTL, deployed *before* the HTML; the HTML with a short TTL.

**Symptom: "the CDN makes checkout fast."** Cause: the pass-through row misunderstood. Fix: the
edge removes the handshakes and carries the request on warm connections; the floor is still one
crossing to the origin.

**Symptom: the edge cached a response with `Set-Cookie`.** Cause: a cacheable status on a
personalised response. Fix: a CDN rule refusing to store any response with `Set-Cookie`;
`no-store` from the origin.

## Interview questions

**★ What is the cache key, and what are the two ways to get it wrong?**
The identity under which the edge stores a response — by default the URL. Too wide omits
something the response depends on, so one user's page is served to another; the fix is `Vary`,
adding the varying input to the key, or marking the response private. Too narrow includes
something the response ignores — cookies, tracking parameters, parameter order — so every
visitor gets a private copy and the hit ratio collapses; the fix is to strip and normalise.
Static assets are keyed by a path containing a content hash with cookies stripped.

**★ TTL or purge — how do you keep the edge fresh after a price change?**
Both, in layers: hashed, immutable assets get a year; semi-static pages get a short TTL with
`stale-while-revalidate` so expiry is a background refresh; and the price change itself
publishes an event from the outbox whose consumer purges the product's page and image by tag,
so the change is live in seconds. Purge by URL misses the page's variants; purge without
coalescing or a shield turns a popular object into an origin stampede.

**★ What does the CDN do for the checkout request, which cannot be cached?**
It terminates the user's TCP and TLS handshakes at a nearby edge instead of across the ocean,
and it carries the request to the origin over the provider's backbone on connections that are
already open — so the request pays one crossing and no handshakes. That is worth a hundred
milliseconds or more on a first visit from another continent. It does not remove the crossing:
the floor for a write is still one round trip to the origin.

**How do you serve a private file — an invoice — from a public cache?**
With a signed URL: the origin issues a URL carrying an expiry and a signature over path and
expiry, the edge verifies the signature with a shared key and serves the cached object only to
valid requests. Authorisation happens once at issue time; the object is cached once and served
to every authorised viewer. Expiries are short and URLs are issued per view, because a signed
URL is a bearer credential for as long as it lives; signed cookies extend the same idea to a set
of paths.

**A purge at peak took the origin down. Why, and what prevents it?**
Every edge dropped the object at once, the next request at each edge missed, and a hundred
edges — and a thousand concurrent requests within each — went to the origin for the same key.
Request coalescing makes the concurrent misses within an edge wait on one fetch; an origin
shield makes the edges' misses converge on one intermediate cache that sends the origin a single
request; `stale-while-revalidate` avoids the synchronous miss entirely by refreshing in the
background. With all three, a purge is one origin request.

**Why hash asset filenames, and what is the deploy-order rule?**
Because a file whose name encodes its content never changes, so it can be cached for a year as
immutable, and a new build is a new name — no purge, no staleness, a perfect hit ratio. The
HTML that references the names carries a short TTL. The order rule: deploy the hashed assets
before the HTML that references them, or an edge serving the new HTML will request a bundle the
origin does not yet have, and cache the 404.

---

← Prev: [04 · Stateless services, and where the state went](04-stateless-services-and-where-the-state-went.md) · Index: [Phase 2 — The request path](README.md) · Next → [06 · Long-lived connections](06-long-lived-connections.md)
