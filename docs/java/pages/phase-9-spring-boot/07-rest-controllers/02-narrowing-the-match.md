---
title: "Narrowing the match: media types and conditions"
sidebar_label: "2 · Narrowing the match"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.9 reference,
> *Web MVC → Annotated Controllers → Request Mapping* (docs.spring.io — the
> `consumes`/`produces` sections including the explicit statement that
> method-level declarations **override** rather than extend class-level ones,
> the negation syntax, the `params` and `headers` condition forms with the
> advice not to use `headers` for `Content-Type`/`Accept`, transparent HTTP HEAD
> support and automatic OPTIONS with the `Allow` header, and the explicit
> `RequestMappingInfo` / `registerMapping` example). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**`consumes` and `produces` do not describe your response — they decide whether
your method exists. They are *mapping conditions*, evaluated alongside the path
and the HTTP verb, which means a client with the wrong `Accept` header does not
get your endpoint and a wrong answer; it gets no endpoint at all. Understanding
that they narrow the match rather than configure the output explains the two
status codes that most confuse people (415 and 406) and one rule that reverses
the intuition built up from `path`: method-level media types *replace* the
class-level ones instead of adding to them.**

## `consumes` narrows by `Content-Type`

```java
@PostMapping(path = "/orders", consumes = MediaType.APPLICATION_JSON_VALUE)
OrderDetail create(@RequestBody NewOrder body) { ... }
```

This method is a candidate only when the request's `Content-Type` is
`application/json`. Send `text/plain` and the mapping does not match on that
condition, and the framework reports **415 Unsupported Media Type**.

Negation is supported — `consumes = "!text/plain"` matches every content type
except that one.

## `produces` narrows by `Accept`

```java
@GetMapping(path = "/orders/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
OrderDetail byId(@PathVariable long id) { ... }
```

Now the request's `Accept` header must be satisfiable by `application/json`. A
client sending `Accept: application/xml` does not match, and gets **406 Not
Acceptable**.

Use the `MediaType.*_VALUE` constants rather than string literals —
`MediaType.APPLICATION_JSON_VALUE`, `MediaType.APPLICATION_XML_VALUE`,
`MediaType.APPLICATION_PROBLEM_JSON_VALUE`. They are `String` constants, so they
are legal in an annotation attribute, and they remove a class of typo that
otherwise fails as a silent non-match.

## 🔴 Method-level media types **override**, they do not extend

This is the rule that catches experienced people, because it is the opposite of
how `path` behaves.

```java
@RestController
@RequestMapping(path = "/orders", produces = MediaType.APPLICATION_JSON_VALUE)
class OrderController {

    @GetMapping("/{id}")
    OrderDetail byId(@PathVariable long id) { ... }
    // produces application/json — inherited from the class

    @GetMapping(path = "/{id}/receipt", produces = "application/pdf")
    Resource receipt(@PathVariable long id) { ... }
    // ⚠️ produces application/pdf ONLY. The class-level JSON is GONE,
    //    not added to. A client sending Accept: application/json gets 406.
}
```

The reference states this directly for both attributes: a method-level
`consumes` or `produces` overrides the class-level declaration. If you want
both, restate both:

```java
    @GetMapping(path = "/{id}/receipt",
                produces = {"application/pdf", MediaType.APPLICATION_JSON_VALUE})
```

`path`, meanwhile, composes: the class value is a prefix and the method value is
appended. Two attributes on the same annotation, two different composition
rules. There is no mnemonic for it — it is simply worth knowing that the media
types are the ones that replace.

## `params` and `headers` conditions

```java
@GetMapping(path = "/orders", params = "status=open")   // only when ?status=open
List<OrderSummary> openOrders() { ... }

@GetMapping(path = "/orders", params = "!status")        // only when absent
List<OrderSummary> allOrders() { ... }
```

Three forms, for both `params` and `headers`:

| Form | Meaning |
|---|---|
| `myParam` | the parameter/header is present, any value |
| `!myParam` | it is absent |
| `myParam=myValue` | it is present with exactly that value |

⚠️ **Do not use `headers` for `Content-Type` or `Accept`.** The reference says so
directly: use `consumes` and `produces` instead. They participate in content
negotiation and produce the semantically correct 415 or 406; a `headers`
condition on the same header produces a bare non-match, which surfaces as 404.

Selecting a handler on a *query parameter* is legitimate but sharp. It splits
one resource across two methods on a value the client controls, and the
"nothing matched" case degrades to a 404 that explains nothing. Branching inside
a single method is usually clearer, and keeps the failure inside your code where
you can produce a real error.

## Choosing between 404, 405, 415 and 406

Because every one of these conditions narrows a *match*, the status code tells
you which condition failed — and that makes the codes a genuine debugging tool
rather than trivia:

| Status | What it means about the mapping |
|---|---|
| **404** Not Found | No mapping matched the **path** at all — or a `params`/`headers` condition failed |
| **405** Method Not Allowed | The path matched, the **verb** did not. The response carries `Allow` |
| **415** Unsupported Media Type | Path and verb matched, the request's **`Content-Type`** failed `consumes` |
| **406** Not Acceptable | Path and verb matched, the request's **`Accept`** failed `produces` |

The asymmetry worth internalising: `consumes` and `produces` failures are
*informative* — they name the dimension that failed. `params` and `headers`
failures are *not* — they collapse into a 404 indistinguishable from a typo in
the URL. That is a real argument for preferring the media-type conditions where
either would work.

## HEAD and OPTIONS come free

`@GetMapping` supports HTTP **HEAD** transparently: the method runs and the body
is discarded, so `Content-Length` and the other headers are correct rather than
guessed.

HTTP **OPTIONS** is answered automatically with an `Allow` header listing the
verbs actually mapped for that path. Neither requires a line of controller code,
and a hand-written OPTIONS handler is usually *worse* than the generated one,
because the generated one is derived from the registry and cannot drift out of
sync with the routes.

## Registering a mapping programmatically

When the routes are data — a plugin architecture, tenant-configured endpoints, a
gateway mirroring a downstream service — the annotation model runs out. The
reference documents direct registration against the same registry:

```java
@Configuration
class DynamicRoutes {

    @Autowired
    void register(RequestMappingHandlerMapping mapping, UserHandler handler)
            throws NoSuchMethodException {

        RequestMappingInfo info = RequestMappingInfo
                .paths("/user/{id}").methods(RequestMethod.GET).build();

        Method method = UserHandler.class.getMethod("getUser", Long.class);
        mapping.registerMapping(info, handler, method);
    }
}
```

You are writing by hand the entry the annotation scan would have written. Reach
for it only when the route set genuinely is not known at compile time — you give
up compile-time checking, IDE navigation and the startup duplicate-detection
that makes the annotation model pleasant to live with.

## The trade-off: conditions are matched, not diagnosed

Every condition in this chunk narrows a match, and when nothing matches the
framework can only report that nothing matched. It cannot tell you that you were
one header away, because it does not compute near-misses — it computes a lookup.

That is the inherent cost of a declarative mapping model, and it is why "the
route exists but 404s" is the most common Spring MVC support question there is.
The compensating discipline is to keep the condition set small: **path plus verb
for almost everything**, `consumes`/`produces` only where a resource genuinely
has more than one representation, `params` and `headers` almost never. Every
condition you add is another invisible way for a request to miss.

## Gotchas

**Symptom:** a method mapped at exactly the requested path and verb returns 406 Not Acceptable
**Cause:** `produces` is a mapping condition, so a client sending `Accept: application/xml` does not match a method declaring `produces = "application/json"`. For that client the route effectively does not exist
**Fix:** check what the client actually sends — a browser address bar sends an `Accept` that prefers HTML. If the API is JSON-only, the honest fix is to **remove** `produces` entirely so the mapping stops depending on `Accept` at all; declare it only when one path really does serve several representations

**Symptom:** a class-level `produces = "application/json"` stops applying as soon as one method declares `produces = "application/pdf"`
**Cause:** method-level `consumes`/`produces` **override** the class-level value rather than adding to it — unlike `path`, which composes
**Fix:** restate every media type you still want on the method: `produces = {"application/pdf", MediaType.APPLICATION_JSON_VALUE}`

**Symptom:** a POST returns 415 even though the body is valid JSON
**Cause:** the client is not sending `Content-Type: application/json` — commonly a form post, an HTTP client defaulting to `application/x-www-form-urlencoded`, or a `Content-Type` with an unexpected charset parameter that does not satisfy the declared type
**Fix:** fix the client's header. Resist "fixing" it by widening to `consumes = "*/*"`, which converts a clear 415 into a confusing body-binding failure further down the pipeline

**Symptom:** adding `params = "version=2"` to split an endpoint produces 404s for older clients rather than anything explanatory
**Cause:** a failed `params` condition is not a distinguishable outcome — it collapses into "no mapping matched", which is 404, exactly as a mistyped path would
**Fix:** if the split is genuinely about versioning, use the first-class API version support in [chunk 12](12-api-versioning.md), which has real semantics and its own error handling. If it is not versioning, branch inside one method so you control the error

**Symptom:** a hand-written OPTIONS handler starts reporting verbs the controller no longer supports
**Cause:** the automatic OPTIONS response is derived from the mapping registry and cannot drift; a hand-written one is a second source of truth that nothing keeps in sync
**Fix:** delete it and let the framework answer. Override only when a specification demands headers the generated response does not carry

## Interview questions

**★ Are `consumes` and `produces` about the request or the response?**
Both are conditions on the *request*, and neither configures the response.
`consumes` tests the request's `Content-Type` header; `produces` tests the
request's `Accept` header. The naming reads from the handler's point of view —
what it consumes and what it is willing to produce — but mechanically they are
both filters applied at mapping time, before your method is a candidate. That is
why a mismatch removes the endpoint from consideration rather than causing your
method to respond differently.

**★ Give me the four status codes a mapping can fail with and what each one tells you.**
404 means nothing matched the path — or, less obviously, that a `params` or
`headers` condition failed, because those degrade into the same outcome. 405
means the path matched but the verb did not, and the response carries an `Allow`
header naming the verbs that would have worked. 415 means path and verb matched
but the request's `Content-Type` failed `consumes`. 406 means path and verb
matched but the request's `Accept` failed `produces`. The practical value is that
the code narrows the search before you have read any code: a 406 is never a
routing typo.

**★ Why is it a problem that `params` conditions fail as 404?**
Because a 404 is indistinguishable from a mistyped URL, so the failure gives the
client no signal about what to change and gives you no signal about what
happened. `consumes` and `produces` failures name the dimension that failed;
`params` and `headers` failures do not. That asymmetry is a genuine argument for
preferring media-type conditions where either would work, and for handling
parameter-driven variation *inside* a single method — where you can return a 400
that says which parameter was wrong — rather than by splitting the mapping.

**★ Class-level `produces = "application/json"`, one method declaring `produces = "application/pdf"`. What can that method now serve?**
PDF only. Method-level `consumes` and `produces` override the class-level
declaration rather than extending it, which the reference states explicitly, so
the class-level JSON is gone for that method and a client sending
`Accept: application/json` receives 406. To serve both you must restate both in
the method-level array. This is worth flagging in review precisely because it
inverts the intuition people build from `path`, where the class-level value is a
prefix that the method-level value composes with.

**★ Do you need to write HEAD and OPTIONS handlers?**
No, and you generally should not. `@GetMapping` supports HEAD transparently —
the handler executes and the body is discarded, so `Content-Length` and the
other headers are accurate rather than fabricated. OPTIONS is answered
automatically with an `Allow` header derived from the mapping registry. A
hand-written OPTIONS handler is a second source of truth for which verbs exist,
and it will eventually disagree with the routes; the generated one cannot,
because it is computed from them.

**★ When would you call `registerMapping` on `RequestMappingHandlerMapping` directly?**
When the route set is genuinely not known at compile time — modules in a plugin
architecture contributing endpoints, tenants configuring paths, or a gateway
mirroring a downstream service's routes. You build a `RequestMappingInfo`,
obtain the `Method` reflectively, and register it against the same registry the
annotation scan populates. It should stay rare: you lose compile-time checking,
IDE navigation and the startup duplicate detection, so "the routes are
configuration" needs to be genuinely true rather than merely elegant-sounding.

---

← Prev: [The controller and the pipeline](01-the-controller-and-the-pipeline.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Binding the named inputs](03-the-named-inputs.md)
