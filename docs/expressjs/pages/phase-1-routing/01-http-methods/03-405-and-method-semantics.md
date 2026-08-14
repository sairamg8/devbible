---
title: "405 and method semantics"
sidebar_label: "03 · 405 and method semantics"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Express answers 404 for a known path with an unregistered method. Whether that
is a bug depends on who is calling — and if you want 405, you write it.**

> Verified: 2026-08-14. The 404 behaviour is documented in the Express
> [FAQ](https://expressjs.com/en/starter/faq.html): *"404 responses are not the
> result of an error … Express has executed all middleware functions and routes,
> and found that none of them responded."* The absence of any built-in 405 or
> `Allow` outside the `OPTIONS` responder is read from `router@2.2.0` in
> `sandbox/express-verify/node_modules/`. Method semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2 (safe, idempotent,
> cacheable) and §15.5.6 (405 — the `Allow` header is **required**).
> **No sandbox run backs this page and it carries no console block.**

## Why it is 404

Nothing in Express is deciding this. The router walks its stack; a route layer
whose method does not match simply fails `_handlesMethod` and the loop moves on.
When the walk ends with nothing matched and no error, `finalhandler` gets a call
with no error — and its answer to "nothing handled this" is 404.

There is no point in the machinery where "the path matched but the method did
not" is a distinguishable state. To produce 405 you would have to ask, after the
fact, *"did any route exist for this path under a different method?"* — and
nothing accumulates that question except the `OPTIONS` collector.

## Does it matter?

Honestly: usually not, and the case where it does is specific.

**Where 404 is fine.** A browser client, a first-party SPA, a mobile app you
ship. They call the endpoints you gave them; a wrong method is a bug you find in
development, and the status code it produced is irrelevant.

**Where 405 earns its keep:**

- **A public API with third-party clients.** 405 with `Allow` tells an integrator
  "this resource exists, you used the wrong verb" in one round trip. 404 sends
  them to check their URL, their base path and their auth first.
- **Anything generating client SDKs or contract tests.** A 405 is a machine-
  readable "you called it wrong"; a 404 is indistinguishable from "not deployed
  yet".
- **Caches and intermediaries.** 404 and 405 have different cacheability
  defaults, and some intermediaries treat a 404 as a signal to stop retrying a
  path entirely.

**Where 404 is actively the right answer even though the path exists:** when the
resource is real but the caller must not learn that. Cross-tenant access should
answer 404, not 403 and not 405 — anything that confirms existence is an
information leak. [Phase 8 · 07](../../phase-8-validation-authz/07-ownership.md)
makes that argument in full.

## Writing 405 yourself

RFC 9110 §15.5.6 makes the `Allow` header **mandatory** on a 405 — a 405 without
it is worse than a 404, because it promises information and withholds it.

The honest version, per path, using `app.route` so the path string appears once:

```js
app.route('/orders/:id')
  .get(sendOrder)
  .put(replaceOrder)
  .all((req, res) => {
    res.set('Allow', 'GET, HEAD, PUT, OPTIONS');
    res.status(405).json({error: 'method_not_allowed', allow: ['GET', 'PUT']});
  });
```

That works because `route.all` runs for any method and is registered **after**
the verbs, so it is only reached when none of them matched. Note `HEAD` and
`OPTIONS` in the header: HEAD because `get` covers it
([chunk 02](02-head-and-options.md)), OPTIONS because the router answers it.

**Do not try to make this global.** A single catch-all middleware cannot know
which methods a path supports — that information lives on `Route` objects inside
each router's stack, and reaching into `router.stack` to compute it means
depending on an internal that has already changed once between major versions.
Per-route is verbose and correct; global is clever and brittle.

If you find yourself writing that block on more than a handful of routes, the
real answer is a route-definition helper that takes a map of method → handler and
appends the `.all` for you — one place that knows the shape, and the `Allow`
string derived from the map's keys rather than typed twice.

## The method semantics Express does not enforce

Express will happily let you delete records from a GET handler. The properties
below are contracts with the rest of the internet — browsers, proxies, CDNs,
crawlers and retry logic all assume them — and **the framework checks none of
them**.

| Method | Safe | Idempotent | Body | The assumption you are breaking if you ignore it |
|---|---|---|---|---|
| `GET` | ✓ | ✓ | no | Crawlers, prefetchers and link previews will call it unprompted |
| `HEAD` | ✓ | ✓ | no | Same, and it runs your GET handler |
| `OPTIONS` | ✓ | ✓ | no | Preflights fire it without user intent |
| `PUT` | ✗ | ✓ | yes | A client may safely retry it after a timeout |
| `DELETE` | ✗ | ✓ | no* | Same — a second DELETE must not fail differently |
| `POST` | ✗ | ✗ | yes | Nothing may retry it safely — hence idempotency keys |
| `PATCH` | ✗ | ✗ | yes | Not idempotent in general; a merge-patch usually is |
| `QUERY` | ✓ | ✓ | yes | A GET-shaped search that needs a body |

\* A `DELETE` may carry a body, but [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
notes it has no defined semantics and some intermediaries drop it. Do not rely on it.

Three consequences that cause real incidents:

- 🔴 **A GET that mutates will be triggered by something you did not write** — a
  link prefetcher, a security scanner, a Slack unfurl. "Only our app calls it" has
  never been true.
- **POST is the only common method that is not idempotent**, which is why safe
  retries need an `Idempotency-Key` and a uniqueness constraint —
  [Phase 6 · 06](../../phase-6-rest-surface/06-idempotency-keys.md).
- **`SameSite=Lax` still permits top-level GET**, so a mutating GET remains
  CSRF-reachable even with modern cookie defaults. That is the second, less
  quoted reason GET must never mutate —
  [Phase 9 · 05](../../phase-9-hardening/05-csrf-and-injection.md).

## Method override: almost never

`X-HTTP-Method-Override` and `?_method=DELETE` exist because HTML forms can only
send GET and POST. If you are serving JSON to a client that can send any verb,
adding an override is **turning every POST into a potential DELETE** for anyone
who can set a header — including through a CSRF-able form post, which is exactly
the case the override was invented to serve.

Use it only when you genuinely have HTML forms, restrict it to a fixed set of
target methods, and never let it upgrade a request to a method the caller could
not otherwise reach.

## Gotchas

**Symptom:** An integrator reports "your endpoint doesn't exist" for a path you
can see in the route table
**Cause:** They used the wrong verb and got a 404, which reads as "wrong URL"
**Fix:** 405 with `Allow` on public paths, per route. The one round trip pays for
itself in support time

**Symptom:** A 405 you wrote makes clients retry forever
**Cause:** No `Allow` header. RFC 9110 requires it, and a client with no list has
nothing to correct to
**Fix:** Always send `Allow`, and derive it from the same map the routes came from
so it cannot drift

**Symptom:** Records are being deleted with no matching POST or DELETE in the
access log
**Cause:** A mutating GET, triggered by a crawler, prefetcher or link unfurl
**Fix:** Move the mutation to POST or DELETE. This is not a style preference —
the whole internet assumes GET is safe

**Symptom:** A retried `PATCH` after a timeout produced a doubled value
**Cause:** `PATCH` is not idempotent in general. A `{"$inc": 1}`-shaped patch is
the classic case
**Fix:** Use JSON Merge Patch semantics (absolute values), or an idempotency key.
[Phase 6 · 10](../../phase-6-rest-surface/10-patch-and-bulk.md)

**Symptom:** Adding method override "for compatibility" opened a security finding
**Cause:** It lets a POST — the method a CSRF-able form can send — become a DELETE
**Fix:** Remove it unless HTML forms genuinely require it, and then allow-list the
target methods

## Interview questions

**★ Why does Express return 404 instead of 405, and could it do otherwise?**
Because "path matched, method did not" is never a distinct state in the router: a
route layer whose method does not match simply fails to match, and the walk ends
with nothing handled, which is `finalhandler`'s 404. Producing 405 needs an
after-the-fact question about other routes on that path, which only the `OPTIONS`
collector asks.

**★ When would you implement 405, and what must it include?**
On a public API with third-party clients, or anywhere contract tests and
generated SDKs consume the status. It must include an `Allow` header — RFC 9110
requires it, and a 405 without one is less useful than the 404 it replaced.

**★ Why is a global 405 middleware a bad idea?**
Because it cannot know which methods a path supports without reading each
router's internal `stack` of `Route` objects — an undocumented structure that has
already changed between major versions. Attach the fallback per route with
`route.all`, after the verbs.

**★ Which common HTTP methods are idempotent, and why does it matter to your
handler?**
GET, HEAD, OPTIONS, PUT and DELETE. It matters because clients, proxies and job
runners **will** retry them after a timeout without asking. POST is the one that
is not, which is why safe retries on POST need an idempotency key.

**★ What is the risk of a `GET` that changes state?**
It will be called by things you did not write — prefetchers, crawlers, scanners,
link unfurlers — with no user intent. And `SameSite=Lax` still permits top-level
GET, so it stays reachable cross-site even with modern cookie defaults.

**Should you accept `X-HTTP-Method-Override`?**
Only for HTML forms, which cannot send anything but GET and POST. On a JSON API
it converts every POST into a potential DELETE for anyone who can set a header,
which reintroduces exactly the CSRF surface you were trying to shrink.

---

← Prev: [HEAD and OPTIONS](02-head-and-options.md) · Index: [HTTP methods](README.md) · Next topic → [Params and query](../02-params-and-query/README.md)
