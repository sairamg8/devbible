---
title: "Binding the body, and the fallback that bites"
sidebar_label: "4 · Binding the body"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0.8 reference,
> *Web MVC → Annotated Controllers → Handler Methods → Method Arguments*
> (docs.spring.io — `@RequestBody`, `@RequestPart`, `@ModelAttribute`,
> `UriComponentsBuilder`, the requirement that `Errors`/`BindingResult`
> immediately follow the validated argument, and the fallback rule that
> unannotated **simple** types resolve as `@RequestParam` while **complex**
> types resolve as `@ModelAttribute`, with simplicity judged by
> `BeanUtils.isSimpleProperty`). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**The most damaging bug in Spring MVC binding produces no exception, no log line
and no failing test that does not exercise HTTP. Leave `@RequestBody` off a DTO
parameter and Spring does not complain — it applies a fallback rule, decides you
meant `@ModelAttribute`, instantiates the class and binds *query parameters*
into it. The endpoint returns a fully-constructed object with every field null,
and the JSON body is never read at all. Everything else in this chunk is
downstream of understanding that rule.**

## `@RequestBody` — the only resolver that reads the entity body

```java
@PostMapping
ResponseEntity<OrderDetail> create(
        @RequestBody NewOrder body,          // deserialised by a converter
        UriComponentsBuilder uriBuilder) {   // build URLs against this request
    ...
}
```

`@RequestBody` hands the request body to an `HttpMessageConverter` — in a Boot 4
web application, `JacksonJsonHttpMessageConverter` for JSON. Two consequences
follow from it being the only body-reading resolver:

- It is the only one that interacts with `consumes`, because it is the only one
  that cares what the body's media type is.
- There can be at most one per method. The body is a stream; it is read once.

## 🔴 The fallback rule, and why it is dangerous

The reference gives the rule for any argument that matches no other resolver:

- **simple types** — as judged by `BeanUtils.isSimpleProperty`: primitives and
  their wrappers, `String`, `Enum`, `Number`, `Date`, `URI`, `Locale`, and
  arrays of those — resolve as **`@RequestParam`**;
- **everything else** resolves as **`@ModelAttribute`**.

```java
// You wrote this meaning "a value I will compute or default"
@GetMapping("/search")
List<Order> search(String name) { ... }
// Spring reads:  @RequestParam(required = true) String name
// → 400 whenever ?name= is absent.  Noisy, but at least it fails.

// You wrote this meaning "the request body"
@PostMapping("/search")
List<Order> search(SearchCriteria criteria) { ... }
// Spring reads:  @ModelAttribute SearchCriteria criteria
// → it instantiates SearchCriteria and binds QUERY PARAMETERS into it.
//   The JSON body is never read. Every field is null. Nothing throws.
```

The second case is the genuinely nasty one, because **it does not fail**. The
object is non-null, its fields are empty, and the endpoint behaves exactly as
though the client had sent an empty request. There is no exception to catch, no
error to log, and no status code that looks wrong — the handler runs to
completion and returns a perfectly valid response computed from nothing.

It is one of the very few Spring MVC defects with no signal at all, which is why
the defence has to be a habit rather than a setting: **annotate every controller
method parameter**, including the ones where the fallback would happen to guess
right.

Note also that `@ModelAttribute` binding is a *form* mechanism — it exists to
populate a command object from an HTML form post. On a JSON API it is almost
never what you want, so its being the silent default for every complex type is
an artefact of Spring MVC's history as a server-rendering framework.

## Multipart: `@RequestPart` and `MultipartFile`

```java
@PostMapping(path = "/orders/{id}/attachments",
             consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
ResponseEntity<Void> upload(
        @PathVariable long id,
        @RequestPart("file") MultipartFile file,       // the binary part
        @RequestPart("meta") AttachmentMeta meta) {    // a JSON part, converted
    ...
}
```

The distinction between the two annotations for a multipart request is worth
stating precisely, because both "work":

- **`@RequestParam`** on a `MultipartFile` treats the part as a simple value.
- **`@RequestPart`** runs the part through an `HttpMessageConverter` selected
  from **that part's own `Content-Type`**.

So a part declaring `application/json` deserialises into a typed object under
`@RequestPart` and arrives as a raw `String` under `@RequestParam`. Use
`@RequestPart` whenever a part is structured; either is defensible for the
binary part itself.

The corollary is that `@RequestPart` on a structured part depends on the *client*
setting a `Content-Type` on that individual part. Many HTTP clients do not by
default, and without one there is nothing for converter selection to work from.

## `UriComponentsBuilder` — not an input

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

`UriComponentsBuilder` is a builder pre-populated with the current request's
scheme, host, port and context path. It matters disproportionately behind a
reverse proxy, an ingress or a TLS terminator, where the externally visible
address is not the one the JVM is bound to — hardcode a base URL or read the
container's own host and you emit `Location` headers pointing somewhere clients
cannot reach, in a way that never reproduces locally.

Building from it is necessary but not sufficient: forwarded headers must also be
honoured so the proxy's real scheme and host reach the application at all.

## `Errors` and `BindingResult` must come immediately after

```java
@PostMapping
OrderDetail create(@Valid @RequestBody NewOrder body,
                   BindingResult result) {   // ← MUST be the very next parameter
    if (result.hasErrors()) { ... }
    ...
}
```

The reference is strict about placement: an `Errors` or `BindingResult` argument
must **immediately follow** the validated argument it reports on. Put anything
between them and it no longer binds to that argument, and the validation failure
becomes a thrown exception instead of a value you can inspect.

Which exception, and how the arrangement of parameters changes the answer, is
worked through in **[topic 08 · Validation](../08-validation/README.md)** — it is a
genuinely intricate corner and it belongs with validation rather than here.

## The trade-off: convention that `javac` cannot check

Every resolver across this chunk and the last is a convention matched at runtime
from annotations, parameter names and types. None of it is checked at compile
time. A misspelled `@RequestParam("statu")`, a missing `@RequestBody`, a
`BindingResult` one position too late — all compile perfectly, and fail (or,
worse, fail to fail) only when a real request arrives.

That is the price of the model, and what it buys is a controller signature that
reads as a *description of the request* rather than as ceremony pulling values
out of an `HttpServletRequest` by hand. The mitigation is not to avoid the
convention but to be maximally explicit inside it: annotate everything, name the
parameter in the annotation wherever the wire contract matters, and give every
endpoint at least one test that goes through the HTTP layer rather than calling
the method directly. A unit test that invokes the controller method as a plain
Java method proves nothing about binding, because binding is precisely the part
it skips.

## Gotchas

**Symptom:** a POST endpoint receives an object whose fields are all null, and nothing anywhere throws
**Cause:** `@RequestBody` is missing, so the complex-type fallback applied `@ModelAttribute` — Spring instantiated the class and bound *query parameters* into it. The JSON body was never read
**Fix:** add `@RequestBody`. This is the single strongest argument for annotating every parameter, because it is the one binding bug that produces no error, no log and no wrong-looking status code

**Symptom:** two `@RequestBody` parameters on one method, and the second is always null or the request fails outright
**Cause:** the request body is a stream and is consumed once; there is no second body to bind
**Fix:** model the payload as one object with two fields. If the two halves genuinely come from different places, one of them is not a body — it is a header, a path variable or a query parameter

**Symptom:** a JSON part of a multipart upload arrives as a raw string rather than a typed object
**Cause:** the part was bound with `@RequestParam`, which treats it as a simple value; only `@RequestPart` runs a part through an `HttpMessageConverter` using that part's own `Content-Type`
**Fix:** switch to `@RequestPart("meta") AttachmentMeta meta`, and confirm the client sets a `Content-Type` on that individual part — without one there is nothing for converter selection to act on

**Symptom:** a `Location` header points at `http://localhost:8080/...` in production
**Cause:** the URL was built from the container's own address — by concatenating a hardcoded base URL, or by reading the request host directly while behind a proxy that did not forward it
**Fix:** build from an injected `UriComponentsBuilder`, and ensure forwarded headers are honoured so the proxy's scheme and host reach the application. Both halves are required; the builder cannot invent information the request never carried

**Symptom:** validation errors that should have landed in a `BindingResult` are thrown as an exception instead
**Cause:** the `BindingResult` parameter is not *immediately* after the argument it validates; the reference requires adjacency
**Fix:** move it so it directly follows the validated parameter. The full consequences are in **[topic 08 · Validation](../08-validation/README.md)**

**Symptom:** a controller unit test passes while the endpoint is broken in production
**Cause:** the test calls the controller method as a plain Java method, so no argument resolution happens at all — the exact stage where the bug lives is the stage the test skips
**Fix:** test through the HTTP layer. ⚠️ Note that in Boot 4 `@SpringBootTest` no longer auto-provides MockMvc, `WebTestClient` or `TestRestTemplate`; the test slice or the `spring-boot-starter-restclient-test` dependency has to be added deliberately

## Interview questions

**★ A controller parameter has no annotation. What does Spring do with it?**
It applies a fallback rule based on the type. If the type is *simple* — as
judged by `BeanUtils.isSimpleProperty`, covering primitives and wrappers,
`String`, `Enum`, `Number`, `Date`, `URI`, `Locale` and arrays of those — it is
treated as a `@RequestParam`, and therefore as required. Anything else is
treated as an `@ModelAttribute`, meaning Spring instantiates the type and binds
request parameters into its properties. The dangerous half is the second one: a
missing `@RequestBody` on a DTO does not error, it hands you a
fully-constructed object with every field null, because query parameters were
bound instead of the JSON body.

**★ Why is a missing `@RequestBody` worse than most binding bugs?**
Because it has no signal. Almost every other binding mistake produces a 400, a
conversion failure or a startup error — something that points at the problem.
This one produces a valid object, a completed handler and a 200 response
computed from an empty payload. Nothing is logged, nothing throws, and any test
that calls the controller method directly rather than over HTTP will pass. It
only shows up as a business-level anomaly — records created with no data — which
is a long way from the cause.

**★ Can a handler method take two `@RequestBody` parameters?**
No. The request body is a stream and it is consumed once, so there is no second
body to bind; the attempt fails rather than silently producing something. If the
payload genuinely has two halves, they belong in one object with two fields.
More often the second "body" is not a body at all — it is metadata that ought to
be a header, a path variable or a query parameter, and the design pressure to
add a second `@RequestBody` is a signal that the request shape needs rethinking.

**★ When would you use `@RequestPart` rather than `@RequestParam` for a multipart request?**
Whenever the part is structured rather than a plain value. `@RequestParam` on a
`MultipartFile` works and treats the part as a simple value, while
`@RequestPart` runs the part through an `HttpMessageConverter` chosen from
*that part's own* `Content-Type`. So a part declaring `application/json`
deserialises into a typed object under `@RequestPart` and arrives as a raw
string under `@RequestParam`. That makes `@RequestPart` the right choice for the
metadata part of a file upload, with either annotation defensible for the binary
part. The catch is that it depends on the client setting a `Content-Type` on the
individual part, which many HTTP clients do not do by default.

**★ Why inject `UriComponentsBuilder` instead of building the `Location` URL yourself?**
Because it is pre-populated with the current request's scheme, host, port and
context path, so the URL is correct for however the service is actually reached
— which is rarely the address the JVM bound to. Behind a reverse proxy, an
ingress or a TLS terminator, a hardcoded base URL or the container's own host
produces `Location` headers pointing at an internal address, and clients that
follow them fail in a way that never reproduces on a developer machine. The
builder is necessary but not sufficient, though: forwarded headers must also be
honoured, or the proxy's real scheme and host never reach the application for
the builder to use.

**★ Why does a passing controller unit test tell you almost nothing about binding?**
Because calling the controller method as a plain Java method skips argument
resolution entirely — you construct the DTO yourself and pass it in, so the
whole stage where binding bugs live never executes. A missing `@RequestBody`, a
required parameter, a `BindingResult` in the wrong position: none of them can
fail in that test, because none of them are involved. The test has to go through
the HTTP layer to be evidence. Worth knowing for Boot 4 specifically:
`@SpringBootTest` no longer auto-provides MockMvc, `WebTestClient` or
`TestRestTemplate`, so the appropriate test slice or the
`spring-boot-starter-restclient-test` dependency now has to be added
deliberately rather than arriving for free.

---

← Prev: [Binding the named inputs](03-the-named-inputs.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Records as DTOs](05-records-as-dtos.md)
