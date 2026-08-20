---
title: "Collections, pagination and hypermedia"
sidebar_label: "8 · Collections and hypermedia"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against RFC 9110 *HTTP Semantics* (the `Link` header and
> the status-code semantics referenced here), the Spring Framework 7.0.8
> reference on controller return values (docs.spring.io), and the Spring
> HATEOAS project documentation for the hypermedia representation model.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The response shape of a list endpoint is the least reversible decision in an
HTTP API. A status code can be corrected, a field can be added, an endpoint can
be deprecated and replaced — but the top-level JSON type is load-bearing for
every client that parsed it, and changing an array into an object breaks all of
them at once. This is why a bare JSON array, which looks like the simplest
possible answer, is the one shape you can never grow.**

## Wrap the list. Always, from the first release.

```java
// ⛔ Nowhere to put a total, a cursor, or anything else. Ever.
@GetMapping
List<OrderSummary> list() { ... }

// ✅ Extensible from day one.
public record Page<T>(List<T> items, String nextCursor, long totalCount) { }

@GetMapping
Page<OrderSummary> list(@RequestParam(defaultValue = "50") int limit,
                        @RequestParam(required = false) String after) { ... }
```

The wrapper costs one level of nesting on the client. What it buys is that every
piece of metadata you have not thought of yet — a cursor, a total, a warning
about a partial result, a deprecation notice, a facet count — has somewhere to
go without a major version.

There is also a historical security argument for not returning a top-level JSON
array, from an era of JSON hijacking via overridden array constructors. Modern
browsers closed that, so it is no longer the reason — but it is why some older
style guides state the rule without explaining it.

## Offset paging versus cursor paging

**Offset paging** — `?page=2&size=50` or `?offset=100&limit=50`:

```java
@GetMapping
Page<OrderSummary> list(@RequestParam(defaultValue = "0")  int page,
                        @RequestParam(defaultValue = "50") int size) { ... }
```

Simple, and it supports jumping straight to page 37, which product teams ask for
because it is what a page-number UI needs. It degrades in two distinct ways:

- **Cost grows with depth.** The database must traverse and discard every
  skipped row, so page 1 and page 1,000 are not the same query. `OFFSET 50000`
  reads fifty thousand rows to return fifty.
- **The window shifts under concurrent writes.** If a row is inserted before
  your offset between two requests, everything slides by one — the client sees
  an item twice. A deletion makes it miss one entirely. Neither is detectable
  from the client side.

**Cursor (keyset) paging** — `?after=<opaque>&limit=50`:

```java
@GetMapping
Page<OrderSummary> list(@RequestParam(required = false) String after,
                        @RequestParam(defaultValue = "50") int limit) { ... }
```

The cursor encodes the sort key of the last row returned, so the next query is
`WHERE (created_at, id) < (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT
:limit`. Two properties follow:

- **Constant cost at any depth**, because the sort key is indexed and the
  database seeks rather than counts.
- **Stable under concurrent modification**, because the position is anchored to
  a row rather than to a count of rows.

The price is no random access — there is no way to ask for page 37 — and the
requirement that the sort key be **unique and stable**, which is why real
cursors are almost always a composite of a timestamp and a tiebreaker id.

🔴 **Make the cursor opaque.** Base64 the composite and treat it as a token the
client only ever echoes back. The moment clients can read it, they start
constructing their own, and the encoding becomes a public contract you cannot
change.

## The total count is not free

`totalCount` in the wrapper above is optional in two senses. It is optional in
the schema, and it is often the single most expensive part of serving the page:
a `COUNT(*)` with the same predicate scans everything the predicate matches,
which on a large filtered table can cost more than the page itself.

The options, in ascending order of honesty:

- **Omit it.** Cursor-paged APIs frequently do. The client gets `nextCursor` and
  knows only whether there is more, which is all an infinite-scroll UI needs.
- **Return `hasMore` instead**, computed by fetching `limit + 1` rows and
  discarding the extra. Nearly free, and answers the only question most clients
  actually have.
- **Return an estimate**, clearly named as one (`approximateTotalCount`), from
  table statistics.
- **Return an exact count**, and accept the cost, when a product requirement
  genuinely needs it.

The failure mode worth naming: shipping an exact `totalCount` because it was
cheap on a development dataset, then discovering in production that the count
query dominates the endpoint's latency. Fetching `limit + 1` is the default that
ages best.

## Filtering and sorting belong in the contract too

Anything a list endpoint supports becomes a contract the moment a client uses
it, so decide deliberately rather than accreting parameters:

- **Whitelist sortable fields.** `?sort=createdAt,desc` where `createdAt` is
  checked against a fixed set. Passing a client string into an `ORDER BY` is an
  injection vector, and it also silently commits you to keeping every column
  name stable.
- **Cap `limit`.** An uncapped `?limit=1000000` is a denial-of-service parameter
  you published. Clamp server-side rather than trusting documentation.
- **Filter parameters are forever.** Each one is a query shape you have promised
  to keep serving efficiently, which usually means an index.

## HATEOAS, and why this topic stops here

Full REST as Fielding described it has responses carry links describing the
transitions available from the current state, so a client *discovers* the API
rather than hardcoding URL structure. Spring has genuine support for it in
Spring HATEOAS — `EntityModel`, `CollectionModel`, link builders and the HAL
media type.

It is named and set aside for one reason: **almost nobody builds the client that
would benefit.** The value only arrives if consumers follow links at runtime
instead of constructing URLs from a specification, and in practice consumers
generate a typed client from an OpenAPI document and construct URLs. Paying for
hypermedia that clients ignore is a poor trade, and a generated contract
delivers most of the decoupling benefit for far less effort — that contract is
**[topic 14 · OpenAPI with springdoc](../14-openapi-springdoc/README.md)**.

Where hypermedia does pay: long-lived public APIs with many independent
consumers you cannot coordinate a release with, and workflow resources where the
set of legal next actions genuinely varies per instance and per caller — an
order that may or may not be cancellable, depending on state and permissions.
Encoding that in links is real information a client would otherwise have to
reimplement.

If none of that applies, two pieces of hypermedia are still worth having
unconditionally: a **`Location` header on 201**, and a **`nextCursor`** or
`Link: rel="next"` on a paged collection. Both are hypermedia in the useful
sense — the server telling the client where to go next — without any of the
machinery.

## Gotchas

**Symptom:** adding a `totalCount` or a cursor to a list endpoint is a breaking change
**Cause:** the endpoint returns a bare JSON array, so the top-level type itself must change to carry anything that is not an element
**Fix:** return an object wrapping the list, from the first release. This is effectively irreversible once clients exist, which is why it is worth insisting on before launch rather than negotiating after

**Symptom:** a deeply-paged list endpoint gets slower the further in you go, and clients report seeing the same row twice
**Cause:** offset paging — the database traverses and discards the skipped rows, and rows inserted or deleted between requests shift the window
**Fix:** move to cursor paging keyed on a unique, stable sort key. If random page access is a genuine product requirement, keep offsets but cap the maximum depth rather than pretending the cost is not there

**Symptom:** clients start constructing cursors themselves, and a change to the pagination query breaks them
**Cause:** the cursor was a readable value — a raw timestamp or an id — so clients could reverse-engineer it, and the encoding became a public contract nobody agreed to
**Fix:** Base64-encode a composite token and document it as opaque. This is one of the few cases where obscurity is a legitimate engineering tool: it is not security, it is contract minimisation

**Symptom:** a list endpoint's latency is dominated by counting rather than by fetching
**Cause:** an exact `totalCount` runs a `COUNT(*)` over everything the filter matches — cheap on a development dataset, dominant in production
**Fix:** fetch `limit + 1` rows and return `hasMore` instead. If a real total is required, name it as approximate and source it from table statistics, or accept the cost knowingly

**Symptom:** a `?sort=` parameter is passed into the query and someone sorts by a column that no longer exists — or worse
**Cause:** the client-supplied sort field reached the query unvalidated, which is both an injection vector and an accidental promise to keep every column name stable
**Fix:** whitelist sortable fields against a fixed set and reject anything else with a 400 naming the permitted values

**Symptom:** one client requests `?limit=1000000` and the service falls over
**Cause:** the limit was documented but not enforced, so it was a denial-of-service parameter published as a feature
**Fix:** clamp server-side to a maximum. Documentation is not a control

## Interview questions

**★ What is wrong with returning a bare JSON array from a list endpoint?**
There is nowhere to put anything that is not an element. The first time you need
a total count, a next-page cursor, a partial-result warning or any other
metadata, adding it means changing the top-level type from array to object,
which breaks every consumer simultaneously. Wrapping the list in an object from
the first release costs one level of nesting and keeps the response extensible
forever. It is one of the few API shape decisions that is effectively
irreversible once clients exist, which is why it belongs in the first review
rather than the first refactor.

**★ Offset paging or cursor paging — and what does each cost?**
Offset paging is simple and supports jumping to an arbitrary page, which is what
a page-number UI needs. It degrades in two ways: cost grows with depth because
the database traverses and discards skipped rows, and the window shifts under
concurrent writes so clients see duplicates or miss rows without any way to
detect it. Cursor paging anchors the position to a row rather than a count, so
it costs the same at any depth and is stable under concurrent modification, at
the price of no random access and a requirement that the sort key be unique and
stable — which in practice means a composite of a timestamp and a tiebreaker id.
I default to cursor paging for anything that grows, and keep offsets only when
random page access is a genuine product requirement, with a capped maximum
depth.

**★ Why should a pagination cursor be opaque?**
Because anything clients can read, they will eventually construct. If the cursor
is a plain timestamp or an id, clients start synthesising their own instead of
echoing back what you sent, and the encoding silently becomes a public contract
— at which point changing the sort key or adding a tiebreaker becomes a breaking
change. Base64-encoding a composite token and documenting it as opaque keeps the
contract to "send back what I gave you". It is worth being clear that this is
not a security measure; it is contract minimisation, and it is one of the few
places where making something unreadable is legitimate engineering.

**★ A list endpoint returns a `totalCount`. What would you check?**
Whether anyone needs it, and what it costs. An exact count runs a `COUNT(*)`
over everything the filter matches, which is frequently more expensive than
fetching the page itself and scales with the table rather than with the page
size — so it is cheap in development and dominant in production. Most clients
only actually need to know whether there is more, which you can answer by
fetching `limit + 1` rows and discarding the extra, at essentially no cost. If a
real total is genuinely required I would either source an estimate from table
statistics and name the field so it cannot be mistaken for exact, or accept the
cost knowingly rather than by default.

**★ Why isn't this topic recommending HATEOAS?**
Because the benefit is conditional on having clients that follow links at
runtime rather than constructing URLs from a specification, and almost nobody
builds those — consumers generate a typed client from an OpenAPI document and
build URLs from it, so the hypermedia is paid for and ignored. A generated
contract delivers most of the decoupling benefit for a fraction of the effort.
Where it genuinely pays is long-lived public APIs with consumers you cannot
coordinate releases with, and workflow resources where the legal next actions
vary per instance and per caller — an order that may or may not be cancellable
is real information a client would otherwise reimplement. Even without adopting
it, two pieces are worth having unconditionally: `Location` on a 201, and a next
link or cursor on a paged collection.

**★ What would you check on a list endpoint's filter and sort parameters in review?**
Three things. That sortable fields are whitelisted against a fixed set rather
than passed through to the query, because a client-supplied `ORDER BY` is both
an injection vector and an accidental promise to keep every column name stable.
That `limit` is clamped server-side, since an uncapped limit is a
denial-of-service parameter you published and documentation is not a control.
And that every filter parameter has an index behind it, because each one is a
query shape you have committed to serving efficiently — filters accrete quietly
and the performance bill arrives much later.

---

← Prev: [The response](07-the-response.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Jackson 3: what changed](09-jackson-3-what-changed.md)
