---
title: "ETag and Cache-Control"
sidebar_label: "07 · ETag · Cache-Control"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

**Conditional requests avoid useless transfers. Authenticated JSON is usually `Cache-Control: private, no-store`.**

> Verified: 2026-08-14 — **no sandbox run**. Express's `etag` setting defaults to
> **`"weak"`** ([application settings](https://expressjs.com/en/5x/api/application/)), and
> `express.static` sets `etag: true` and `lastModified: true` by default
> ([express reference](https://expressjs.com/en/5x/api/express/)). Conditional-request
> semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): a failed
> `If-Match` precondition means the server responds **412 Precondition Failed** instead of
> applying the request, and a 304 *"MUST NOT contain a message-body"*.
>
> 🔴 **Correction — the block below overstates what Express does.** Express generates
> `ETag`s and handles `If-None-Match` → 304 for responses it serves. It does **not**
> evaluate `If-Match`: an earlier run in this project measured a **stale `If-Match`
> returning 200 on both PUT and GET**, not 412. RFC 9110 puts precondition evaluation on
> the origin server — that is *you*. The `If-Match → 412` line is what you must
> **implement**, not something you get. See "Lost updates" below. The block is left as
> written rather than replaced, because this pass runs nothing and inventing corrected
> output would be worse than a labelled correction.

## ETags

```http
ETag: "v3"
If-None-Match: "v3"  → 304
If-Match: "v2"       → 412 if current is v3 (lost update)
```

Express can generate weak ETags for some responses (`etag` setting). For APIs,
explicit version fields or hashes are often clearer.

## Lost updates, and the code Express will not write for you

`If-Match` is the whole point of ETags on a write API, and it is entirely yours to
implement:

```js
app.put('/orders/:id', async (req, res, next) => {
  const order = await orders.find(req.params.id);
  if (!order) return next(new HttpError(404, 'NOT_FOUND'));

  const expected = req.get('If-Match');
  if (!expected) return next(new HttpError(428, 'PRECONDITION_REQUIRED'));
  if (expected !== etagOf(order)) {
    return next(new HttpError(412, 'PRECONDITION_FAILED'));
  }

  const updated = await orders.update(req.params.id, req.body, {
    expectedVersion: order.version,       // and re-check at the write itself
  });
  res.set('ETag', etagOf(updated)).json(updated);
});
```

Two details decide whether this actually works:

- **Requiring the header.** If `If-Match` is optional, a client that omits it gets
  last-write-wins and never knows. **428 Precondition Required** is the honest
  answer for a resource where concurrent edits matter.
- **Re-checking at the write.** The comparison above happens before the update; two
  requests can both pass it. The version check has to be part of the write —
  `UPDATE … WHERE version = $expected` — or you have moved the race rather than
  closed it.

Weak versus strong matters here too. Express's default weak ETag (`W/"…"`) means
"semantically equivalent", and **RFC 9110 requires strong comparison for
`If-Match`** — so a weak validator is not usable for lost-update protection. Derive
your own strong validator from a version column or a content hash.

## Cache-Control on APIs

| Audience | Directive |
|---|---|
| User-specific JSON | `private, no-store` |
| Public catalog | `public, max-age=…` carefully |
| Static hashed assets | long `max-age` + immutable (Phase 4) |

`no-store` and `no-cache` are not synonyms, and the pair is worth getting right:

- **`no-store`** — do not write this anywhere. The correct choice for authenticated
  or personal data.
- **`no-cache`** — you may store it, but revalidate before every reuse. Fine for
  data that is cacheable but must be fresh.
- **`private`** — a browser may cache it, a shared cache may not.

The failure that matters is `public` (or a bare `max-age`) on an authenticated
response: a shared cache stores one user's data and serves it to the next. Default
authenticated JSON to `private, no-store` and opt specific endpoints out
deliberately.

## Trade-off

Conditional requests save bandwidth on the responses that were going to be
unchanged, and `If-Match` is the cheapest correct answer to concurrent edits — no
locks, no transactions held across a user's think-time. What you pay is a
validator you must compute and keep honest: an ETag derived from the wrong fields
either never matches, and you gain nothing, or matches when the resource has
changed, which is worse than not having one.

For a JSON API the 304 saving is often small — the response was a few kilobytes
and the round trip happened anyway. **Use ETags for concurrency control, and treat
the bandwidth saving as a bonus.** That reframing usually settles the "are ETags
worth it here?" argument.

## Gotchas

**Symptom:** `If-Match` sends a stale ETag and the write succeeds anyway  
**Cause:** Nothing evaluates it — Express does not, and RFC 9110 makes it the origin
server's job  
**Fix:** Compare it yourself and return 412, then re-check the version at the write

**Symptom:** Lost-update protection passes but two writes still overwrite each other  
**Cause:** The check ran before the update, so both requests passed it  
**Fix:** Push the version into the write — `UPDATE … WHERE version = $expected` — and
treat zero rows affected as a 412

**Symptom:** `If-Match` never matches  
**Cause:** Comparing against a weak validator (`W/"…"`). RFC 9110 requires strong
comparison for `If-Match`  
**Fix:** Generate a strong ETag from a version column or content hash for writable
resources

**Symptom:** One user sees another user's data from a CDN  
**Cause:** `Cache-Control: public` or a bare `max-age` on an authenticated response  
**Fix:** `private, no-store` by default for anything user-specific

**Symptom:** A 304 breaks a client that expected JSON  
**Cause:** The client does not implement conditional requests but sends
`If-None-Match` anyway — often a caching HTTP library  
**Fix:** Nothing on your side; a 304 has no body by specification. Fix the client, or
stop sending ETags on that endpoint

**Symptom:** ETags change on every request for identical data  
**Cause:** The validator includes a timestamp, or hashes a serialisation with unstable
key order  
**Fix:** Derive it from a version column, or hash a canonical serialisation

## Interview questions

**★ What does If-None-Match enable?**  
304 Not Modified when the client already has the current representation.

**★ Does Express handle `If-Match` for you?**  
No. It generates ETags and answers `If-None-Match` with 304, but `If-Match` is never
evaluated — measured in this project, a stale `If-Match` returned 200. RFC 9110 puts
precondition evaluation on the origin server, which means your handler.

**★ How do ETags prevent a lost update?**  
The client sends the ETag it read as `If-Match`. If the resource changed since, the
validator no longer matches and you return 412 instead of applying the write — so the
second editor is told to re-read rather than silently overwriting the first.

**Why can a weak ETag not be used for `If-Match`?**  
Weak validators mean "semantically equivalent", and RFC 9110 requires strong
comparison for `If-Match`. Express's default `etag` setting is `weak`, so a writable
resource needs a validator you generate.

**`no-store` versus `no-cache`?**  
`no-store` means do not persist it anywhere; `no-cache` means you may store it but
must revalidate before reuse. Authenticated JSON wants `no-store`.

**Is comparing the ETag before the update enough?**  
No. Two concurrent requests can both pass that check. The version has to be part of
the write itself, with zero rows affected treated as a 412.

## Cache-Control on APIs

| Audience | Directive |
|---|---|
| User-specific JSON | `private, no-store` |
| Public catalog | `public, max-age=…` carefully |
| Static hashed assets | long `max-age` + immutable (Phase 4) |

---

← Prev: [Idempotency keys](06-idempotency-keys.md) · Next → [OpenAPI](08-openapi.md)
