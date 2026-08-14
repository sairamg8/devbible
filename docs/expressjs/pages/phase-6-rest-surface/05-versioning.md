---
title: "API versioning"
sidebar_label: "05 · Versioning"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Public APIs need a compatibility story. URL prefix is the clearest default for this stack.**

> Verified: 2026-08-14 — **no sandbox run**. The strategies are industry practice, not an
> Express feature; what Express contributes is the mounting mechanism —
> `app.use('/api/v1', router)` mounts a router at a prefix and strips it from `req.url`
> before the router sees it ([routing guide](https://expressjs.com/en/guide/routing.html),
> [router reference](https://expressjs.com/en/5x/api/router/)), which is why two version
> routers can share identical internal paths. Header and media-type versioning both rely
> on `res.vary()` so caches key on the negotiating header
> ([Phase 4](../phase-4-responses/09-content-negotiation.md)) — the same `Vary` obligation
> content negotiation has. **`Sunset` is a real standard**
> ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html)), not a convention:
> a `Sunset` header carries an HTTP date after which the resource is expected to become
> unresponsive.

## Strategies

| Strategy | Example | Trade-off |
|---|---|---|
| URL prefix | `/api/v1/users` | Visible, cache-friendly, easy routers |
| Header | `Accept-Version: 1` | Cleaner URLs, harder to explore |
| Media type | `Accept: application/vnd.app.v1+json` | Strict, heavy |

Mount version routers:

```js
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);
```

Deprecate with docs + sunset headers; do not break v1 silently.

## What actually needs a new version

Most changes do not. Versioning is expensive — two code paths, two test suites,
two things to keep alive — so the question worth answering precisely is **which
changes break a client**.

| Change | Breaking? | Why |
|---|---|---|
| Adding a field to a response | **No** | Clients ignore unknown fields — unless yours reject them, which is a client bug |
| Adding an **optional** request field | **No** | Old clients simply omit it |
| Adding a new endpoint | **No** | Nothing existing changes |
| Removing or renaming a field | **Yes** | Something reads it |
| Changing a field's type | **Yes** | `"42"` → `42` breaks parsers, and silently |
| Making an optional field required | **Yes** | Every old request now 400s |
| Changing an error `code` | **Yes** | Clients branch on it ([Phase 5](../phase-5-errors/03-error-contract/README.md)) |
| Tightening validation | **Yes**, quietly | Requests that used to work now fail |

The last row is the one that ships by accident. Adding a `maxLength` to a field is
a one-line change that rejects requests which succeeded yesterday, and nobody
labels it a breaking change in review.

**Additive changes do not need a version.** If your release process treats every
change as a version bump, you will end up with v7 and six dead code paths.

## Running two versions without duplicating everything

The naive approach — copy the v1 router to v2 and edit — doubles the surface
immediately and drifts within a month. Keep one implementation and version the
**edge**:

```js
// one service layer, two presentation layers
app.use('/api/v1', makeRouter({present: presentV1}));
app.use('/api/v2', makeRouter({present: presentV2}));
```

Because Express strips the mount prefix, both routers register the same internal
paths and the difference stays in the shape of the output. That maps directly onto
the layering argument in [Phase 7](../phase-7-layering/README.md): if versioning
forces you to duplicate business logic, the logic was in the wrong layer.

## Deprecating without breaking anyone

Removing a version is the part teams skip, and then support v1 forever.

1. **Announce** in the docs and changelog, with a date.
2. **Signal in the response** — `Deprecation: true` and a
   [`Sunset`](https://www.rfc-editor.org/rfc/rfc8594.html) date header, so a client
   discovers it from traffic rather than from a newsletter nobody read.
3. **Measure.** Log the version on every request and count callers. You cannot
   retire what you cannot see.
4. **Brown-out** before the cut: return errors for short windows on announced days,
   so silent clients notice while you are still watching.
5. **Then remove**, and answer 410 Gone rather than 404 — the difference tells a
   caller "this existed and is deliberately gone" instead of "you have a typo".

Step 3 is the one that unblocks everything else. "We can't remove v1, someone might
be using it" is a statement about missing instrumentation, not about clients.

## Trade-off

URL versioning is the honest default: the version is visible in every log line,
curl command and cache key, and routing to it is one `app.use`. It costs you REST
purity — the same resource now has two URLs, so a link to `/api/v1/orders/7` is not
a link to the resource, it is a link to one rendering of it. Bookmarks and stored
links pin themselves to a version that will eventually disappear.

Header and media-type versioning keep one URL per resource and hide the version
from everything that makes debugging easy — and both add a `Vary` obligation that,
if forgotten, lets a cache serve v1 to a v2 client. **Take the URL prefix** unless
you have a specific reason; the debuggability is worth more than the purity.

## Gotchas

**Symptom:** A cache serves v1 responses to v2 clients  
**Cause:** Header or media-type versioning without `Vary` on the negotiating header  
**Fix:** `res.vary('Accept-Version')` — or use a URL prefix, where the cache key already
differs

**Symptom:** v1 can never be retired because "someone might still use it"  
**Cause:** No per-version request metrics  
**Fix:** Log the version on every request from day one. The decision needs a number, not
an opinion

**Symptom:** Clients break after a change nobody considered breaking  
**Cause:** Validation tightened, or a field's type changed from `"42"` to `42`  
**Fix:** Treat validation tightening and type changes as breaking in review. They are
invisible in a diff and obvious in production

**Symptom:** v2 fixes a bug that v1 still has, in duplicated code  
**Cause:** The version boundary was drawn around the whole router  
**Fix:** Version the presentation layer only; share the service beneath it

**Symptom:** Old clients get 404 after v1 is removed and report it as an outage  
**Cause:** A removed version is indistinguishable from a typo  
**Fix:** **410 Gone** with a message pointing at the current version

## Interview questions

**★ Most common versioning style for REST JSON APIs?**  
URL path prefix (`/v1`).

**★ Which API changes actually require a new version?**  
Removals, renames, type changes, newly-required fields, changed error codes — and
tightened validation, which is the one that slips through. Additive changes do not:
new fields and new endpoints leave existing clients working.

**★ How would you get a v1 retired?**  
Instrument first — log the version per request so you know who is calling. Then
announce, send `Deprecation` and `Sunset` headers so clients learn from traffic,
brown-out on announced windows, and finally return **410 Gone** rather than 404.

**Why does header-based versioning need a `Vary` header?**  
Because the response now depends on a request header. Without `Vary`, a shared cache
keys on the URL alone and hands a v1 body to a v2 client — the same failure mode as
content negotiation.

**How do you avoid duplicating logic across versions?**  
Version the edge, not the core. Both routers call one service and differ in how they
present the result. If a version bump forces you to fork business logic, the logic is
sitting in the wrong layer.


---

← Prev: [Filter sort search](04-filter-sort-search.md) · Next → [Idempotency keys](06-idempotency-keys.md)
