---
title: "The response: status codes chosen on purpose"
sidebar_label: "7 · The response"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.8 reference,
> *Web MVC → Annotated Controllers → Handler Methods → ResponseEntity*
> (docs.spring.io — the builder methods `ok`, `created(URI)`, `noContent`,
> `status`, `badRequest`, the `eTag` and `lastModified` builders, and the
> `Resource` return type for file content), and RFC 9110 *HTTP Semantics*
> (the method and status-code definitions, safe and idempotent method
> properties, and the `Location`, `ETag` and `If-Match` header semantics).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A status code is the only part of your response every client, proxy, cache and
monitoring system understands without being told anything about your API. That
makes choosing it a design decision rather than a formality — and the two
choices that cost the most are the ones people make by habit: returning 200 for
everything because it works, and returning 404 for "you may not see this"
because it feels secure. Both throw away information the protocol was built to
carry.**

## `ResponseEntity` versus `@ResponseStatus`

Two mechanisms, and the distinction is *when the status is known*.

```java
// @ResponseStatus — fixed at compile time, same for every successful call
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
OrderDetail create(@RequestBody NewOrder body) {
    return service.create(body);
}

// ResponseEntity — decided per request
@GetMapping("/{id}")
ResponseEntity<OrderDetail> byId(@PathVariable long id) {
    return service.find(id)
                  .map(ResponseEntity::ok)
                  .orElseGet(() -> ResponseEntity.notFound().build());
}
```

`@ResponseStatus` is the right tool when the status is a property of the
*endpoint* — a create always returns 201, a delete always returns 204. It keeps
the method signature clean, returning the domain type rather than a wrapper.

`ResponseEntity` is the right tool when the status is a property of the
*outcome*, or when you need to set headers. The reference's comparison is worth
internalising: `@ResponseStatus` fixes the status at method level with limited
header support, while `ResponseEntity` sets both per request.

The builders the reference documents:

| Builder | Status |
|---|---|
| `ResponseEntity.ok()` | 200 |
| `ResponseEntity.created(URI)` | 201, with `Location` set |
| `ResponseEntity.noContent()` | 204 |
| `ResponseEntity.badRequest()` | 400 |
| `ResponseEntity.status(HttpStatus)` | anything |

⚠️ **Do not use `ResponseEntity` to return errors from a controller.** Mapping
exceptions to status codes belongs in one place, not scattered through handlers;
that is **[topic 09 · Error handling](../09-error-handling/README.md)**, and it is what
`@ControllerAdvice` and `ProblemDetail` exist for. Use `ResponseEntity` for
*successful* responses whose status or headers vary.

## The status codes worth choosing deliberately

### 201 and the `Location` header

```java
@PostMapping
ResponseEntity<OrderDetail> create(@RequestBody NewOrder body,
                                   UriComponentsBuilder uriBuilder) {
    OrderDetail saved = service.create(body);
    URI location = uriBuilder.path("/orders/{id}")
                             .buildAndExpand(saved.id())
                             .toUri();
    return ResponseEntity.created(location).body(saved);
}
```

**201 without a `Location` header is a half-finished response.** The whole point
of 201 is to tell the client where the thing it created now lives; omitting it
forces every client to dig the identifier out of the body and reconstruct the
URL, which means every client hardcodes your URL structure. Including the body
as well is optional but usually kind — it saves an immediate `GET`.

### 202 when the work has not happened yet

202 Accepted means *I have taken this and will act on it, but not yet*. It is the
honest answer for anything queued, and it is routinely misused as 201 — which
tells the client a resource exists that it can then fail to fetch. If you return
202, give the client something to poll: a `Location` pointing at a status
resource is the usual shape.

### 204 versus 200 with a body

204 No Content is correct for a `DELETE` and for a `PUT` where the client already
knows the resulting state. Returning 200 with a body is also defensible when
the server changed something the client cannot predict — a computed field, a
version number. What is not defensible is 204 with a body, which is a
contradiction the servlet container will resolve by discarding your body.

### 400 versus 422

Both mean "your request was wrong", and the split that survives contact with
reality is:

- **400 Bad Request** — the request is malformed. Unparseable JSON, a missing
  required parameter, a value that will not convert to the target type. The
  server could not even work out what was being asked.
- **422 Unprocessable Content** — the request parsed fine and the values are
  individually well-formed, but they are semantically wrong. An end date before
  a start date; a currency the account does not support.

Being consistent matters more than which line you draw. Many perfectly good APIs
use 400 for both, and that is a defensible choice; what is not defensible is
choosing per endpoint according to who wrote it.

### 🔴 404 versus 403, and the case for lying

The reflex is that 403 means "forbidden" and 404 means "not there", so use 403
when a user may not see something. The problem is that 403 confirms the resource
*exists* — and for identifiers a user could enumerate, that confirmation is the
leak:

```
GET /orders/1042  → 403   ← order 1042 exists, and is not yours
GET /orders/1043  → 404   ← order 1043 does not exist
```

A client that can iterate identifiers now has an oracle for which ones are real,
which for sequential IDs maps out your entire dataset and its volume.

The convention that avoids it is to **return 404 for resources the caller is not
permitted to know about**, reserving 403 for cases where the caller's access to
the *resource* is not secret — typically where authorisation is about the action
rather than the object, like a read-only user attempting a delete on something
they can plainly see.

The cost is real: a genuine permission problem now looks like a typo, and
support time goes into "the page says not found but I know it exists". The
mitigation is to make the two distinguishable *internally* — log the
authorisation denial with the real reason — while keeping them identical on the
wire.

### 405, 409 and 412

**405 Method Not Allowed** you get for free from the mapping registry, complete
with an `Allow` header. Never hand-write it.

**409 Conflict** is for a request that is valid but contradicts current state —
creating something whose unique key is taken, or transitioning a state machine
along an edge that does not exist from where it is.

**412 Precondition Failed** is the answer to an `If-Match` that did not match,
which is the mechanism below.

## `ETag`, `If-Match` and optimistic concurrency

```java
@GetMapping("/{id}")
ResponseEntity<OrderDetail> byId(@PathVariable long id) {
    Order order = service.find(id).orElseThrow(OrderNotFound::new);
    return ResponseEntity.ok()
                         .eTag("\"" + order.getVersion() + "\"")   // quoted, per RFC 9110
                         .lastModified(order.getUpdatedAt())
                         .body(mapper.toDetail(order));
}
```

Two independent benefits from one header. **Caching**: a client that stores the
`ETag` can send `If-None-Match` and receive 304 Not Modified, saving the body.
**Concurrency**: a client that sends `If-Match` on an update is saying "only
apply this if the resource is still in the state I read" — and the server
answers 412 if it is not, which is how you stop two concurrent updates from
silently overwriting one another.

The second use is the one that matters most, and it is the missing piece in
almost every API that offers `PUT` or `PATCH`. Without it, last-write-wins is
your concurrency model whether you chose it or not — the problem
[chunk 6](06-the-absent-field.md) raised for `PATCH` and which applies just as
much to `PUT`.

⚠️ An `ETag` value is a *quoted* string in RFC 9110, and the quotes are part of
the syntax. Emitting a bare number produces a header that strict clients reject.

## Gotchas

**Symptom:** a 201 response that clients handle by parsing the body for an id and building a URL themselves
**Cause:** the `Location` header was omitted, so the one piece of information 201 exists to convey is missing
**Fix:** `ResponseEntity.created(location)`, with the URI built from an injected `UriComponentsBuilder` so it is correct behind a proxy

**Symptom:** a response is 204 and the body is silently discarded
**Cause:** 204 means *no content*; a body contradicts it and the container drops it
**Fix:** decide which you meant. 200 with the body if the client needs the new state, 204 with nothing if it does not

**Symptom:** an attacker maps the full set of valid identifiers by watching status codes
**Cause:** 403 is returned for resources that exist but belong to someone else, and 404 for ones that do not — the difference is an existence oracle over enumerable ids
**Fix:** return 404 for both, and log the authorisation denial internally so support can still tell them apart. Reserve 403 for cases where the resource's existence is not itself a secret

**Symptom:** two users edit the same record and one edit vanishes without any error
**Cause:** no optimistic concurrency — last write wins, and neither client is told
**Fix:** serve an `ETag` on `GET`, require `If-Match` on updates, and answer 412 when it does not match. Note this must be enforced server-side: an `If-Match` the server ignores is worse than none, because clients believe they are protected

**Symptom:** a client rejects the `ETag` header as malformed
**Cause:** the value was emitted unquoted; RFC 9110 makes the quotes part of the syntax
**Fix:** emit `"\"" + version + "\""`, and use `W/"..."` if the tag is intended to be weak

## Interview questions

**★ When do you use `ResponseEntity` and when `@ResponseStatus`?**
`@ResponseStatus` when the status is a property of the endpoint and never varies
— a create that always returns 201, a delete that always returns 204. It keeps
the signature returning the domain type rather than a wrapper, which reads
better and is easier to test. `ResponseEntity` when the status depends on the
outcome, or when the response needs headers such as `Location` or `ETag` set per
request. The reference frames the difference the same way: `@ResponseStatus` is
fixed at method level with limited header support, `ResponseEntity` is
per-request for both. I would add that neither should be used to return *errors*
from a controller — that belongs in a `@ControllerAdvice` so the mapping lives
in one place.

**★ What must a 201 response contain, and why?**
A `Location` header naming the URI of the resource that was created. That is the
entire purpose of 201 as distinct from 200: it tells the client where the new
thing lives. Omit it and every client has to extract the identifier from the
body and reconstruct the URL itself, which means every client now hardcodes your
URL structure and you cannot change it. Including the created representation in
the body as well is optional but usually worth it, because it saves the client
an immediate `GET`.

**★ Why might you return 404 instead of 403 for a resource the user is not allowed to see?**
Because 403 confirms the resource exists, and for enumerable identifiers that
confirmation is itself the leak — iterate the ids, and the 403/404 split tells
you exactly which are real, which for sequential ids reveals your whole dataset
and its size. Returning 404 for anything the caller is not permitted to know
about removes the oracle. The cost is honest: a real permission problem now
looks like a typo, and support time gets spent on it. The mitigation is to make
the two distinguishable internally by logging the authorisation denial with the
real reason, while keeping the wire responses identical. I would still use 403
where the resource's existence is not secret — a read-only user attempting a
delete on something they can plainly see.

**★ How do you stop two concurrent updates from silently overwriting each other?**
Optimistic concurrency with `ETag` and `If-Match`. The `GET` returns an `ETag`
derived from a version column or a content hash; the client sends it back as
`If-Match` on the update; the server compares and answers 412 Precondition
Failed if the resource has moved on, so the losing client is told rather than
silently discarded. The critical detail is that this has to be enforced on the
server — an API that documents `If-Match` but does not check it is worse than
one that never offered it, because clients believe they are protected. Without
this, last-write-wins is your concurrency model whether or not you chose it.

**★ 400 or 422 — where do you draw the line?**
400 for a request the server could not make sense of: unparseable JSON, a
missing required parameter, a value that will not convert to its target type.
422 for a request that parsed cleanly and whose values are individually
well-formed but which is semantically wrong — an end date before the start date,
a currency the account cannot use. That said, I would treat consistency as more
important than the exact line: plenty of good APIs use 400 for both and are
perfectly usable. The genuinely bad outcome is choosing per endpoint depending
on who wrote it, because then the status code stops carrying information at all.

---

← Prev: [The absent field, and `PATCH`](06-the-absent-field.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Collections and hypermedia](08-collections-and-hypermedia.md)
