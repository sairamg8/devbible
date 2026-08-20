---
title: "ProblemDetail and RFC 9457"
sidebar_label: "6 · ProblemDetail and RFC 9457"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Error
> Responses*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html
> — `ProblemDetail` as *"a simple container for both standard fields defined in
> the spec, and for non-standard ones"*, the `about:blank` default for `type`,
> and `instance` being *"set from the current URL path, if not already set"*)
> and the Spring Boot reference *Servlet Web Applications · Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html — *"Spring MVC can
> produce custom error messages with the `application/problem+json` media
> type"*). RFC 9457 obsoletes RFC 7807. Spring Boot 4.1.0, Spring Framework
> 7.0.x, JDK 25.

**RFC 9457 exists so that a client can parse *any* error from *any* service
without reading that service's documentation first. `ProblemDetail` is Spring's
implementation of it: five standard fields with defined meanings, a media type
that announces the shape, and room for your own fields alongside. Adopting it
is not about the JSON looking tidy — it is about giving up the right to invent
a private error format.**

## The five standard fields, and what each is actually for

```json
{
  "type": "https://api.example.com/problems/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Only 3 units of SKU-4417 remain; 10 were requested.",
  "instance": "/orders/9c3e1f22"
}
```

| Field | Type | What it is FOR |
|---|---|---|
| `type` | URI | **Identifies the kind of problem.** This is the field a client branches on. It is stable across occurrences and across releases |
| `title` | string | A short, **human-readable** summary of the problem *kind*. Same for every occurrence of the same `type` |
| `status` | int | The HTTP status code, duplicated into the body |
| `detail` | string | Human-readable explanation of **this occurrence** — the one field that may name the actual SKU, id or count |
| `instance` | URI | Identifies **this specific occurrence**. Spring sets it *"from the current URL path, if not already set"* |

🔴 **The field people get wrong is `type`, and it is the important one.** `type`
is a **URI that identifies a problem kind** — it is an *identifier*, and the
spec's requirement is that a client can compare it for equality. It is not "a
link to our docs" that happens to be a URI. The distinction has three practical
consequences:

- **It must be stable.** If your documentation site moves from
  `/docs/errors/stock` to `/help/errors/stock`, and `type` was a docs link, you
  have just changed an identifier every client branches on. Mint `type` URIs
  under a path you control and never move, e.g.
  `https://api.example.com/problems/insufficient-stock`, and let the docs live
  wherever they like.
- **It does not have to resolve.** A URI is an identifier, not necessarily a
  location. It is *good practice* for it to dereference to human-readable
  documentation, and it is not an error if it does not. Do not block adoption
  on building a docs site.
- **The default is `about:blank`,** which is the spec's way of saying "this
  problem has no type beyond its HTTP status". Spring uses it as the default,
  and when `type` is `about:blank` the `title` is expected to be the status
  phrase. Leaving it at the default is honest for a generic error and useless
  for a domain error — if the client needs to tell "out of stock" from "card
  declined", both being 409 `about:blank` gives it nothing.

The `title`/`detail` split is the other one worth stating flatly: **`title`
describes the class of problem and never varies; `detail` describes this
occurrence and may vary freely.** A client shows `title` in a heading and logs
`detail`. If your `title` contains an id, you have swapped them.

## The media type is part of the contract

The response content type is **`application/problem+json`**, not
`application/json`. The Boot reference states that Spring MVC *"can produce
custom error messages with the `application/problem+json` media type"*.

This matters for two mechanical reasons:

- **A client can tell an error body from a success body by content type alone**,
  without inspecting the status code — useful in generic middleware, and the
  reason the `+json` suffix exists.
- **Content negotiation still applies.** A client sending
  `Accept: application/json` will normally still get the problem body, because
  `application/problem+json` is a JSON structured syntax suffix type, but a
  client with a strict `Accept` list and an intolerant HTTP library can get a
  406 out of an error path — which is a genuinely confusing failure to debug.
  If your clients are strict, send `Accept: application/json,
  application/problem+json` from them.

## Building one

`ProblemDetail` has static factories and setters — it is a mutable container by
design, because the whole point is that a handler enriches it:

```java
// Status only. type=about:blank, title=the status phrase, instance=request path.
ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.CONFLICT);

// The common case: status plus an occurrence-specific explanation.
ProblemDetail pd = ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT,
        "Only 3 units of SKU-4417 remain; 10 were requested.");

// Then fill in what makes it useful.
pd.setType(URI.create("https://api.example.com/problems/insufficient-stock"));
pd.setTitle("Insufficient stock");
```

`instance` is set for you from the current request path if you do not set it —
which is right for most cases, and worth overriding when the "occurrence" you
want to identify is a business object rather than a URL (an order id, a job id,
a correlation id). Overriding it is one of the two good places to put a
correlation id; see [chunk 14](14-correlation-ids-and-logging.md).

## A complete handler, end to end

```java
@RestControllerAdvice
class ApiErrorHandler {

    private static final URI NOT_FOUND_TYPE =
            URI.create("https://api.example.com/problems/order-not-found");

    @ExceptionHandler
    ProblemDetail handle(OrderNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(NOT_FOUND_TYPE);
        pd.setTitle("Order not found");
        return pd;
    }
}
```

Returning the `ProblemDetail` alone is enough: the return-value handler renders
it as RFC 9457 and takes the HTTP status from the object's own `status` field.
No `ResponseEntity` is needed unless you also want headers.

## Should you adopt it?

**Yes, for a new API, with almost no argument.** It costs nothing over
inventing your own shape, and it means a client library, an API gateway or a
generic error-reporting tool can understand your errors without configuration.

**The honest counter-arguments**, because they exist:

- **It is verbose for trivial APIs.** Five fields where `{"error":"not found"}`
  would do. True — and irrelevant the moment a second client appears.
- **Existing clients depend on your current shape.** Real cost, and the reason
  RFC 9457 adoption usually lands at a version boundary rather than in place.
  Pin the old shape to the old version
  ([API versioning](../07-rest-controllers/12-api-versioning.md)) rather than
  changing it under live clients.
- **Frontend developers will still want a machine-readable code**, and will be
  unhappy that `type` is a long URI. That is what `type` *is*, but nothing stops
  you from also emitting a short `code` extension member — see
  [chunk 7](07-extension-members.md).

## The trade-off

RFC 9457 standardises the *envelope* and says nothing about the *vocabulary*
inside it. Two services can both be perfectly compliant and still be
incomprehensible to a shared client, because one mints
`/problems/insufficient-stock` and the other mints `/errors/STOCK_LOW`. The
standard removes the argument about field names; it does not remove the need to
agree on problem types across your own services. Treat the `type` URI namespace
as a registry someone owns.

## Gotchas

**Symptom** — every error comes back with `"type": "about:blank"`.
**Cause** — nobody called `setType`. That is the documented default.
**Fix** — mint a URI per problem kind. A constant per exception in the advice
is enough; a shared `ProblemTypes` class is better once there are more than
five.

**Symptom** — clients start branching on `detail` text.
**Cause** — `type` was left at the default, so `detail` is the only field that
distinguishes one 409 from another.
**Fix** — set `type`, and then treat `detail` as free-form prose you are allowed
to reword. Any field a client parses is a field you cannot change; make that
field `type` deliberately rather than `detail` accidentally.

**Symptom** — a strict HTTP client gets 406 Not Acceptable on the error path
only.
**Cause** — it sent `Accept: application/json` and its stack refuses
`application/problem+json`.
**Fix** — have clients send both types in `Accept`. Do not "fix" it by forcing
the error content type to `application/json`; that throws away the ability to
distinguish an error body generically.

**Symptom** — `instance` is the same value for every error, or is missing.
**Cause** — it was set explicitly to a constant, or the field was cleared.
**Fix** — leave it unset and let Spring populate it from the request path, or
set it to something genuinely per-occurrence such as
`URI.create("urn:uuid:" + correlationId)`.

**Symptom** — the `title` string contains an order id.
**Cause** — `title` and `detail` were swapped.
**Fix** — `title` is per-*kind* ("Order not found"); `detail` is
per-*occurrence* ("No order with id 9c3e1f22"). Clients cache and display
`title`; they log `detail`.

**Symptom** — the JSON has a `status` field that disagrees with the HTTP status
line.
**Cause** — the handler built the `ProblemDetail` with one status and wrapped
it in `ResponseEntity.status(...)` with another.
**Fix** — build the detail once and derive the entity from it, or return the
`ProblemDetail` alone so there is only one source of the status.

## Interview questions

**★ What problem does RFC 9457 solve?**
Every API used to invent its own error JSON, so every client wrote a bespoke
parser and every generic tool — gateways, SDK generators, error trackers — could
do nothing useful with an error body. RFC 9457 defines a small standard envelope
and a media type announcing it, so a client can extract "what kind of problem"
and "what happened this time" from any compliant service without prior
knowledge.

**★ What exactly is the `type` field?**
A URI that **identifies the kind of problem** — an identifier a client compares
for equality, not a documentation link. It should be stable forever and should
live in a namespace you control; it is good practice but not required for it to
dereference to human-readable documentation. Its default is `about:blank`,
meaning "no problem type beyond the HTTP status".

**★ What is the difference between `title` and `detail`?**
`title` is a short human-readable summary of the *problem kind* and is the same
for every occurrence of a given `type`. `detail` explains *this* occurrence and
is where the specific id, count or field name belongs. Putting occurrence data
in `title` is the common mistake and it breaks any client that keys off it.

**★ Why is the content type `application/problem+json` rather than
`application/json`?**
So a consumer can recognise an error body from the content type alone,
independently of the status code. The `+json` structured-syntax suffix means
anything that can parse JSON can still parse it, while anything that understands
the problem type can treat it specially. The practical cost is that overly
strict `Accept` handling in a client can produce a 406 on error paths.

**★ Does `ProblemDetail` set anything automatically?**
Yes — `instance` is populated from the current request path if you have not set
it, and `type` defaults to `about:blank`. `status` comes from the factory
method. `title` and `detail` are yours, with `title` defaulting to the status
reason phrase when the type is `about:blank`.

---

← Prev: [@ControllerAdvice](05-controlleradvice.md) · Index: [Error handling](README.md) · Next → [Extension members](07-extension-members.md)
