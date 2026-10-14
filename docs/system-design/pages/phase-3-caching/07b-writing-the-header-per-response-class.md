---
title: "Writing the Cache-Control header is classifying the response first and choosing the directive set for the class second, in Express and in Spring, and then checking what actually reached the browser rather than what the controller built"
sidebar_label: "07b · Writing the header"
sidebar_position: 7.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §5.2.2 (directives, quoted in [07](07-http-caching-semantics.md)), MDN's
> [`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
> page, and the Spring Framework reference
> [HTTP Caching](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-caching.html)
> (the `CacheControl` builder, quoted); the 429 rule is [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4 as already quoted in [CDNs](../phase-2-request-path/05-cdns.md). Express behaviour (`res.set`, `express.static` options)
> is mechanism and was **not fetched** this session. **No sandbox run.**

**The directive vocabulary of [07](07-http-caching-semantics.md) becomes a design only when it is
applied per class of response — and the failures in production are a class that was never
classified, a header that was set and then overwritten, and a framework default nobody read.**
This page is the working half: the five response classes of the storefront, the header each
needs, the same code in Express and Spring, and the reasons a correct header in the controller is
not the header the browser gets.

## The five classes and their headers

The skill is not memorising directives; it is classifying the response and writing the header
that class needs. Five classes cover the storefront.

| Response class | Header | Why |
|---|---|---|
| content-hashed asset (`/static/app.3f9c1e.js`) | `public, max-age=<a year>, immutable` | the name is the version; never changes under its URL ([07d](07d-vary-stale-directives-and-configuring-the-edge.md) for `immutable`) |
| HTML shell referencing those assets | `no-cache` (or a short `max-age` with `must-revalidate`) | must pick up a new build; a `304` makes revalidation cheap |
| anonymous, semi-static API or page (product detail) | `public, max-age=<short>, s-maxage=<short>` plus a stale directive | shareable; short because a price can change |
| personalised response (cart, account, order history) | `private, no-store` for anything sensitive; `private, max-age=<short>` for a harmless per-user read | must never reach a shared cache; sensitive data should not touch disk |
| a mutating response, an error, a rate-limit reply | `no-store` | no caller should reuse it |

Writing it in Express:

```js
// Content-hashed bundles: a year, immutable.
app.use('/static', express.static('dist', { maxAge: '365d', immutable: true }));

// A reusable helper: the intent is in the name, not in the string.
const cache = {
  hashedAsset: 'public, max-age=31536000, immutable',
  revalidate:  'no-cache',
  sharedShort: (s) => `public, max-age=${s}, s-maxage=${s}`,
  perUser:     'private, no-store',
};

app.get('/products/:id', async (req, res) => {
  const product = await catalogue.get(req.params.id);
  // Only the anonymous page is shareable. A session cookie means a personal page.
  if (req.headers.cookie?.includes('session=')) {
    res.set('Cache-Control', cache.perUser);
  } else {
    res.set('Cache-Control', cache.sharedShort(60));
  }
  res.json(product);
});

app.get('/cart', requireSession, async (req, res) => {
  res.set('Cache-Control', cache.perUser);
  res.json(await carts.forUser(req.user.id));
});
```

The cookie check above is deliberately crude and is itself a gotcha (a page that *varies* on the
cookie should name the cookie in `Vary`, or be uncacheable, [07d](07d-vary-stale-directives-and-configuring-the-edge.md)).
In Spring, the `CacheControl` type is built for exactly this "use case, not directive" style:

> *"`CacheControl` provides support for configuring settings related to the `Cache-Control` header and is accepted as an argument in a number of places"* — Spring Framework reference, HTTP Caching

```java
// From the Spring reference:
// Cache for an hour - "Cache-Control: max-age=3600"
CacheControl ccCacheOneHour = CacheControl.maxAge(1, TimeUnit.HOURS);

// Prevent caching - "Cache-Control: no-store"
CacheControl ccNoStore = CacheControl.noStore();

// Cache for ten days in public and private caches,
// public caches should not transform the response
// "Cache-Control: max-age=864000, public, no-transform"
CacheControl ccCustom = CacheControl.maxAge(10, TimeUnit.DAYS).noTransform().cachePublic();
```

Applied to a controller:

```java
@GetMapping("/products/{id}")
public ResponseEntity<ProductView> product(@PathVariable long id) {
    ProductView view = catalogue.view(id);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic())
        .body(view);
}

@GetMapping("/cart")
public ResponseEntity<CartView> cart(Principal user) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(carts.forUser(user.getName()));
}
```

One Spring trap belongs here rather than in the gotchas list because it determines whether the
header is sent at all: **Spring Security adds its own `Cache-Control` headers to responses by
default** (to stop sensitive pages being cached), and a header you set in a controller may be
overwritten or may fight with it. I could not confirm the exact precedence from the pages
fetched, so the instruction is: *inspect the response the browser receives, not the one the
controller built*, and configure the security headers deliberately rather than assuming the
controller's value survives.

## Make the safe default the one you get by forgetting

The leak in [07](07-http-caching-semantics.md) happens when a route forgets a header. The
structural fix is to invert the default: a global middleware sets `private, no-store` on every
response, and only routes that opt in to sharing override it. A new endpoint then fails *closed*
— uncached and slow, a performance ticket — instead of failing open as a data leak.

```js
// Default: nothing is cached unless a route says so.
app.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

// Opt-in helper: refuses to share anything touched by a session.
function shareable(seconds) {
  return (req, res, next) => {
    if (req.headers.authorization || req.headers.cookie?.includes('session=')) {
      return next();                       // keep the private default
    }
    res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
    next();
  };
}

app.get('/products/:id', shareable(60), productHandler);
app.get('/categories',   shareable(300), categoryHandler);
```

Two properties of this shape. The opt-in lives next to the route, so a reviewer sees the sharing
decision in the diff. And the helper checks the request for session state rather than trusting
the handler, so a route that *sometimes* personalises cannot share by accident. The remaining
gap is a page that varies on something other than a session — currency, language — which needs
the `Vary` mechanism of [07d](07d-vary-stale-directives-and-configuring-the-edge.md), not a
cookie test.

The same inversion in Spring is a `HandlerInterceptor` or a servlet filter that writes the
private default before the controller runs, with `ResponseEntity.cacheControl(...)` on the
controllers that opt in. Whichever the language, the order matters: the default must be written
*before* the handler and the handler must be allowed to replace it; a filter that writes after
the handler overwrites every opt-in.

## The HTML shell and the API are two different problems

The single-page storefront has an HTML document that names hashed bundles, and JSON endpoints
the bundles call. They look alike and are configured opposite ways.

- **The shell**: tiny, identical for everyone, and must reflect the latest build. `no-cache`
  with an `ETag` is the shape — every navigation is a conditional request that usually returns a
  `304` with no body ([07c](07c-validators-etag-and-conditional-requests.md)), and a deploy is
  visible on the next navigation. A short `max-age` is the alternative when the extra round trip
  matters more than a minute's delay in seeing a deploy.
- **The API**: varies in sensitivity per endpoint. The catalogue read is shareable and short; the
  cart is `private, no-store`; a search endpoint with the user's query in the URL is shareable
  only if the response does not depend on the user. Classify per endpoint, not per service.

## Errors are responses too

An error response is a cacheable response unless it says otherwise, and the worst cache
poisoning in production is an error stored for a lifetime meant for a success: a `404` for a
product page that was created a minute later, or a `500` held at the edge. Make errors
`no-store` in the framework's error handler, not in each route, and let the CDN's own rule
about not storing server errors be a second layer rather than the only one. The rate-limit
reply of [CDNs](../phase-2-request-path/05-cdns.md) is the protocol's example: a `429` *"MUST NOT
be stored by a cache"* (RFC 6585 §4) — a rule you should not need, because your handler never
made it cacheable.

## Spring: the header you set versus the header you get

Spring's builder makes the controller side easy. The part the reference does not settle for me is
precedence with the security layer: Spring Security adds cache-suppressing response headers by
default for its protected paths, and a controller setting `max-age` on a protected route may be
overridden or may conflict. I did not confirm the exact interaction from the pages fetched, so
the verifiable rule is operational:

1. Decide per path whether the security layer's default headers should apply, and configure them
   explicitly — for public catalogue paths disable the default no-cache headers; for everything
   authenticated, leave them.
2. Write one integration test per response class that calls the endpoint through the full filter
   chain and asserts on the final `Cache-Control` header.
3. For the shareable classes, assert there is no `Set-Cookie` on the response, because a cookie
   on a public response is the other half of the leak.

The Spring reference also documents explicit support for conditional handling in controllers,
covered in [07c](07c-validators-etag-and-conditional-requests.md); here it matters only that
`ResponseEntity.ok().cacheControl(...)` and the validator are set in the same builder chain, so
the lifetime and the check travel together.

## Gotchas

**★ Symptom: a logged-in user's page shows up for other users, and nobody noticed in test.**
Cause: a personalised response with no `private`; the default permits a shared cache to store it,
and development environments have no shared cache in the path. Fix: `private` (and `no-store`
if sensitive) on every response derived from a session, applied in middleware keyed on "has a
session" so a new route cannot forget; test through the CDN or proxy configuration, not directly.

**★ Symptom: the CDN holds a stale page for hours after a change although `max-age` is 60.**
Cause: `s-maxage` (or a CDN-side TTL override) is larger and wins on shared caches, per the quote
above. Fix: read the effective lifetime per layer — `s-maxage` for shared, `max-age` for the
browser — and confirm what the CDN does with the header, since vendors differ in whether they
honour the origin's value or apply their own default.

**★ Symptom: assets are re-downloaded on every visit despite a long `max-age`.** Cause: the
lifetime is long but the response is not being stored — a `Set-Cookie`, a `Vary` that fragments
the key, or `private` on a response meant for the CDN; or the URL changes each build because the
hash is not content-derived. Fix: look at what the cache stored, not at what you sent;
content-derive the hash.

**Symptom: after a release the new HTML cannot find its scripts, or loads old scripts with new
markup.** Cause: HTML with a long lifetime, or assets deployed after the HTML. Fix: hashed
assets deployed first and kept for old HTML still in flight; HTML short-lived or `no-cache`.

**Symptom: the header set in the controller is not what the browser receives.** Cause: a
framework layer — Spring Security's default headers, an Express middleware such as one that sets
`no-store` globally, or the proxy — wrote after the handler. Fix: assert on the final response in
an integration test, and configure the global default deliberately.

**Symptom: the origin sees every request though everything is "cacheable".** Cause: no explicit
lifetime, so a cache estimates (or declines to), or a lifetime of zero. Fix: send an explicit
`max-age`/`s-maxage`; do not rely on the cache's guess.

**Symptom: a product page was created a minute after someone requested it, and the CDN keeps
saying it does not exist.** Cause: a `404` carrying a cacheable header (or none, with an
estimated lifetime) was stored. Fix: the error handler sets `no-store` globally; for deliberate
negative caching use a short, explicit lifetime on purpose (**12 · Negative caching and
penetration** *(not written yet)*).

**Symptom: someone changed the global default to `no-cache` and the origin load doubled.**
Cause: the default applied to hashed assets that had been relying on route-level overrides which
were removed in the same change. Fix: assets are served by a separate static handler with its own
policy, and a test asserts the header on a bundle URL.

## Interview questions

**★ What header do you send on the storefront's cart and account pages, and why?**
`private, no-store`. `private` forbids shared caches (CDN, proxy) from storing a per-user
response, which is the leak MDN warns about; `no-store` keeps it off the browser's disk as well,
because a cart or account page holds personal data and nothing is gained by reuse. I also put
that in middleware keyed on "request has a session" so a new route cannot omit it, and I check it
through the CDN, not against the origin directly.

**★ How do you give the CDN a long lifetime without the browser getting one?**
`s-maxage` for the shared cache and a short or zero `max-age` for the browser: `s-maxage`
*"overrides the maximum age specified by either the max-age directive or the Expires header
field"* for shared caches (§5.2.2.10). The reason is that I can purge the CDN and cannot reach the
browser, so the long lifetime sits on the layer I can empty, and a price change is a purge plus a
short browser lifetime.

**A developer says the response is "not cached" because the `Cache-Control` is set. How do you
check?**
Look at what each cache actually stored and served rather than what the origin sent: the response
as received through the CDN, the `Age` header which shows time spent in caches, and any
CDN-added hit/miss header. The origin's header is the intent; the intermediaries may have
overridden it with their own default lifetime, a framework may have rewritten it, and a `Vary`
may be fragmenting the entries.

{/* FOOTER */}
