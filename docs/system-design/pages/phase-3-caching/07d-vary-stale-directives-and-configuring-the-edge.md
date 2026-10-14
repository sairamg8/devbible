---
title: "Vary widens the cache key at the price of fragmenting it, stale-while-revalidate and stale-if-error turn expiry from a wait into a background refresh and an outage into a degraded read, immutable ends revalidation for content-hashed URLs, and a CDN honours all of it only as far as its own configuration allows"
sidebar_label: "07d · Vary, stale, immutable"
sidebar_position: 7.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §4.1 (`Vary`),
> §4.2.4 (serving stale);
> [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html) §3 and §4 (`stale-while-revalidate`,
> `stale-if-error`); [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html) §2 (`immutable`);
> and MDN's [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
> page — all quoted verbatim. The fragmentation consequence of `Vary`, the hashed-asset pattern
> and what a CDN does with these headers are stated as mechanism; vendor behaviour was **not
> fetched** and no hit-rate figure is claimed. **No sandbox run.**

**`Vary` is how one URL holds several stored responses, and every header you add to it multiplies
the entries; `stale-while-revalidate` and `stale-if-error` are how a cache is told it may serve
an old answer on purpose; `immutable` is how a content-hashed file is told it never needs
asking; and a CDN is a shared cache that reads all of these as input to its own configuration
rather than as commands ([07e](07e-unsafe-methods-and-configuring-the-edge.md)).** Together with [07](07-http-caching-semantics.md)'s freshness model and
[07c](07c-validators-etag-and-conditional-requests.md)'s validators, this completes the
vocabulary — and it is where the storefront's interesting failures live: a product page that
fragments into hundreds of copies, a catalogue that returns 502 while a stale copy sat unused,
and a bundle that a returning visitor revalidates a thousand times for nothing.

## Vary: the secondary cache key

A cache stores a response under the request URL. But a URL can map to several representations —
compressed or not, English or French, priced in dollars or euros — and a cache must not hand a
French page to an English reader. The origin states which request headers the response depended
on in `Vary`, and the cache must match them:

> *"When a cache receives a request that can be satisfied by a stored response and that stored response contains a Vary header field, the cache MUST NOT use that stored response without revalidation unless all the presented request header fields nominated by that Vary field value match those fields in the original request."* — RFC 9111 §4.1

So `Vary: Accept-Encoding` makes the stored entry for `/app.js` keyed by URL **and** the
`Accept-Encoding` the request presented; a request with a different value is a different key and,
absent a match, a miss. This is the mechanism behind the "cache key" of
[CDNs](../phase-2-request-path/05-cdns.md): `Vary` is the origin writing the key.

**The cost is fragmentation, and it is mechanism, not a measurement.** The number of stored
entries for one URL is the number of distinct value-combinations of the nominated headers seen in
requests. `Vary: Accept-Encoding` has a handful of realistic values. `Vary: User-Agent` has as
many as there are user-agent strings in the wild; `Vary: Cookie` has as many as there are
sessions, which is a per-user cache that can never hit across users. Each fragment is a separate
miss to fill and a separate entry to evict. I give no hit-rate figure because none is quoted; the
direction is certain.

Rules that follow:

- **Vary on the smallest set of headers the response genuinely depends on.** `Accept-Encoding`
  yes; `Accept-Language` only if you serve differing languages from the same URL, and then
  ideally with a *normalised* value; `User-Agent` almost never.
- **Normalise the header before the cache sees it**, where the CDN allows: collapse the many
  `Accept-Encoding` spellings to the few you serve, or map `Accept-Language` to the languages you
  support. The cache key is built from what the request presented, so a messy header is a
  fragmented key.
- **Do not `Vary: Cookie`; put the variation in the URL or make the response `private`.** A
  response that depends on the session is not shareable, and `Vary: Cookie` is the roundabout way
  of saying so that also stores a copy per visitor. Currency or language chosen by the user should
  ideally appear in the path or a dedicated, low-cardinality header, so the key is small.
- **`Vary: *`** declares that the response depends on something not expressible as headers; in
  practice it makes the response unusable from a shared cache. If you meant "do not cache", say
  `no-store`.

A missing `Vary` is the opposite failure and the dangerous one: a response that depended on a
header but did not declare it will be served to a requester with a different value. That is the
leak of [CDNs](../phase-2-request-path/05-cdns.md)'s "key too wide", and it is invisible until
two users with different headers hit the same edge.

## Serving stale, on purpose

A stale response is not necessarily unusable. The rules are layered, and the order matters.

> *"A cache MUST NOT generate a stale response unless it is disconnected or doing so is explicitly permitted by the client or origin server."* — RFC 9111 §4.2.4.3

> *"A cache MUST NOT generate a stale response if it is prohibited by an explicit in-protocol directive (e.g., by a no-cache response directive, a must-revalidate response directive, or an applicable s-maxage or proxy-revalidate response directive)."* — RFC 9111 §4.2.4.2

So the default is *no stale unless permitted*, with the origin able to permit it, and
`must-revalidate` ([07](07-http-caching-semantics.md)) taking the permission away. MDN states what
that takes away:

> *"HTTP allows caches to reuse stale responses when they are disconnected from the origin server. `must-revalidate` is a way to prevent this from happening - either the stored response is revalidated with the origin server or a 504 (Gateway Timeout) response is generated."* — MDN, `Cache-Control`

The cost of `must-revalidate` is exactly the storefront's outage case: with it, an unreachable
origin means errors even though a usable copy sits in the cache. Use it where staleness is
worse than an error, and leave it off where it is not.

### stale-while-revalidate

RFC 5861 gives the origin a way to *grant* the permission, with a bound:

> *`stale-while-revalidate = "stale-while-revalidate" "=" delta-seconds`* — RFC 5861 §3

> *"caches MAY serve the response in which it appears after it becomes stale, up to the indicated number of seconds."* — RFC 5861 §3

> *"If delta-seconds passes without the cached entity being revalidated, it SHOULD NOT continue to be served stale, absent other information."* — RFC 5861 §3

The words are `MAY` and `SHOULD NOT`; the directive is a permission, not an order. What it does:
when the response expires, the next request is answered **immediately** with the stale copy while
the cache revalidates in the background. MDN describes the effect from the client's side:

> *"Revalidation will make the cache be fresh again, so it appears to clients that it was always fresh during that period — effectively hiding the latency penalty of revalidation from them."* — MDN, `Cache-Control`

Two consequences make this the HTTP-level answer to the stampede problem. No user waits for the
origin at expiry, and the revalidation is one request per cache rather than one per waiting user.
It is not a complete defence — a cache that does not implement it, or a cold entry with nothing to
serve stale, still misses synchronously — which is the territory of
**04 · Stampede and thundering herd** *(not written yet)*. The cost is the window of staleness it
permits, which you have chosen by the number.

### stale-if-error

> *"when an error is encountered, a cached stale response MAY be used to satisfy the request, regardless of other freshness information."* — RFC 5861 §4

> *"when the cached response is more stale than the indicated amount, the cached response SHOULD NOT be used to satisfy the request, absent other information."* — RFC 5861 §4

This is the degraded-mode directive: if the origin errors or is unreachable, the cache may serve
what it has, up to the stated age. A catalogue page that is a day old beats a 502 on a storefront
whose origin is down. It is the HTTP form of the "serve stale" option in
[01b](01b-stacking-layers-and-the-arithmetic-of-staleness.md)'s down-layer decision, and like all
of them it needs the copy to have been retained.

A realistic header for the anonymous product page combines all three:

```text
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400
```

The shared cache holds it 60 seconds, serves it stale for up to five minutes more while refreshing
in the background, and if the origin is erroring may serve it up to a day stale. The browser's
`max-age=0` makes it ask each time (cheaply, if the CDN answers). Whether a given CDN honours the
RFC 5861 directives, and with what limits, is vendor behaviour that was not verified here — read
the CDN's documentation for each directive before depending on it.

## immutable: ending the question

A content-hashed URL (`/static/app.3f9c1e.js`) never changes under that name. Revalidating it is
a request with a certain answer. RFC 8246 defines the directive that says so:

> *"When present in an HTTP response, the immutable Cache-Control extension indicates that the origin server will not update the representation of that resource during the freshness lifetime of the response."* — RFC 8246 §2

> *"Clients SHOULD NOT issue a conditional request during the response's freshness lifetime (e.g., upon a reload) unless explicitly overridden by the user (e.g., a force reload)."* — RFC 8246 §2

> *"The immutable extension only applies during the freshness lifetime of the stored response. Stale responses SHOULD be revalidated as they normally would be in the absence of the immutable extension."* — RFC 8246 §2

The point is the reload: without `immutable`, some clients revalidate cached assets when the user
reloads, producing a `304` per asset for files that cannot have changed. With it, a client that
honours the extension does not. It is an extension, not part of RFC 9111, and clients that do not
recognise it ignore it harmlessly — it is an optimisation, never a correctness mechanism.
The **pattern** around it is common practice rather than specification:

1. Build step content-hashes every asset name.
2. Assets: `public, max-age=<very long>, immutable`.
3. The HTML shell: short-lived or `no-cache` with an `ETag`, naming the hashed files.
4. Deploy the assets **before** the HTML, and keep the previous build's assets available for
   pages still in flight.

Because the old URL is never reused, there is nothing to purge, and the browser — the cache you
cannot reach — is kept correct by the name changing.

## Gotchas

**★ Symptom: the CDN's hit ratio collapsed after a change that "just added a Vary header".**
Cause: `Vary` on a high-cardinality header (`User-Agent`, `Cookie`, an unnormalised
`Accept-Language`) stores a separate entry per distinct value; the same URL is now many entries,
each needing its own fill. Fix: Vary on the smallest set, normalise at the edge, move
variation that matters (currency, language) into the path or a low-cardinality header.

**★ Symptom: two users get each other's language or currency.** Cause: the response depended on a
request header but `Vary` did not name it, so the cache matched on URL alone. Fix: nominate every
header the response depends on, or put the dimension in the URL.

**★ Symptom: the site returns 502s from the CDN though it holds a copy of every page.** Cause: no
`stale-if-error`, or `must-revalidate` withdrawing the permission to serve stale on origin
failure. Fix: grant `stale-if-error` for a bound you can defend, drop `must-revalidate` where a
stale page beats an error, and confirm the CDN honours the directive.

**★ Symptom: expiry causes a visible latency spike every minute on the busiest page.** Cause: at
the end of the lifetime requests wait for a synchronous origin fetch. Fix:
`stale-while-revalidate` so expiry is a background refresh; a CDN that coalesces concurrent
misses; a warm entry for the flash-sale page before the sale.

**Symptom: users who reload see the page slow down, with a `304` per asset.** Cause: hashed
assets served without `immutable`, so reload revalidates each. Fix: `immutable` on content-hashed
URLs (an optimisation; clients that ignore it behave as before).

**Symptom: `immutable` was added to a file whose URL does not change, and a bug fix never
reaches users.** Cause: `immutable` promises the representation will not change during its
lifetime; it was applied to a stable URL, not a hashed one, and the lifetime is long. Fix:
`immutable` only on URLs whose name encodes the content; stable URLs get a short lifetime and a
validator.

**Symptom: `stale-while-revalidate` is set and users still wait at expiry.** Cause: the
cache in the path does not implement the extension, or the entry was evicted or never filled, so
there is no stale copy to serve. Fix: confirm each cache's behaviour; do not rely on it for a
cold start.

**Symptom: the deploy order broke the site for one cache tier.** Cause: new HTML referenced
hashed bundles that the CDN had not yet been given, and cached the `404`. Fix: assets first, kept
for old HTML, error responses `no-store` ([07b](07b-writing-the-header-per-response-class.md)).

## Interview questions

**★ What does `Vary` do, and what is wrong with `Vary: Cookie`?**
`Vary` lists request headers the response depended on; the cache must not reuse a stored response
unless those headers on the new request match the original (RFC 9111 §4.1), so it is the origin
writing part of the cache key. `Vary: Cookie` makes the key include the whole cookie, so there is
a separate stored copy per session and nothing is shared across users — all the cost of a shared
cache, none of the benefit, and a tempting way to feel safe about a personalised page. The right
answers are `private` for a response that is truly per-user, or moving a low-cardinality
dimension such as currency into the URL.

**★ What does `stale-while-revalidate` give you, and what does it not?**
The cache may serve a response after it goes stale, for the stated number of seconds, while it
revalidates in the background; the user gets an immediate answer and the origin sees one refresh
per cache rather than one per waiting request. The RFC's words are `MAY` and `SHOULD NOT`, so it is
a permission a cache can decline. It does not help a cold or evicted entry (nothing stale to
serve), it does not make the data fresher (it permits a bounded staleness window), and it is not
guaranteed to be implemented by every cache in the path.

**★ How do you make the storefront survive its origin being down?**
`stale-if-error` on the cacheable classes so the CDN may serve what it holds when the origin
errors, up to a bound I choose; no `must-revalidate` on content where stale beats an error;
caches that retain stale copies rather than deleting on expiry; and the application's own layers
([01b](01b-stacking-layers-and-the-arithmetic-of-staleness.md)) doing the same. Money-shaped
pages — checkout — are not in that list; they fail closed.

**★ A deploy goes out and some users see broken pages. What are the cache-side causes?**
HTML cached longer than the assets it names; assets deployed after the HTML so an edge cached a
`404` for a bundle; old HTML in flight referencing assets that a cleanup removed; or hashed
assets on a stable URL. The structure that prevents all of them: content-hashed asset names with
a long lifetime and `immutable`, deployed before the HTML, previous builds kept for a window,
the HTML short-lived or revalidated, and errors `no-store`.

**What does `immutable` change, and is it safe to rely on?**
It says the representation will not change during its freshness lifetime, so clients should not
revalidate on reload (RFC 8246 §2). It is an optimisation: a client that ignores it behaves as
before, so correctness never depends on it. It is correct only on URLs whose name encodes the
content.

**How does `s-maxage` interact with `stale-while-revalidate`?**
`s-maxage` sets the freshness lifetime for shared caches, overriding `max-age`; the
`stale-while-revalidate` window then extends serving past that lifetime. The browser's cache sees
`max-age`. The combination is what lets the CDN carry the lifetime and the refresh behaviour
while the browser always asks.

{/* FOOTER */}
