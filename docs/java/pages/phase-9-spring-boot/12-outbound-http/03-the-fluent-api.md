---
title: "The terminal operation is the decision: body, toEntity, toBodilessEntity, exchange"
sidebar_label: "3 · The fluent API"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *REST Clients* —
> the `RestClient` creation, fluent-API, error-handling and `exchange` sections
> (docs.spring.io/spring-framework/reference/integration/rest-clients.html) — and
> the Spring Framework 7.0.x API for `RestClient.Builder`. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**A `RestClient` call is one chain with exactly one decision in it that matters:
what you ask for at the end. `body(Pet.class)` throws away the status and the
headers. `toEntity(Pet.class)` keeps them. `toBodilessEntity()` says you do not
want the body and — importantly — that you are done with the response.
`exchange(...)` hands you the raw response and takes the framework's error
handling away with it. Everything before the terminal is configuration; the
terminal is the only part that changes what your code can *know* about what
happened.**

## The chain, one segment at a time

```java
Pet pet = restClient.get()
        .uri("https://petclinic.example.com/pets/{id}", id)
        .accept(MediaType.APPLICATION_JSON)
        .retrieve()
        .body(Pet.class);
```

| Segment | What it decides |
|---|---|
| `get()` / `post()` / `method(HttpMethod)` | the method; `method(...)` for a dynamic one |
| `.uri(...)` | the path, relative to `baseUrl` if one was set |
| `.accept(...)` / `.contentType(...)` / `.header(...)` | request headers |
| `.body(...)` | the request body (on `post`, `put`, `patch`) |
| `.retrieve()` | switches from building to consuming, with default error handling |
| `.onStatus(...)` | overrides that error handling for matching statuses |
| terminal | what you get back |

Note the deliberate overload: `.body(pet)` **before** `retrieve()` sets the
*request* body; `.body(Pet.class)` **after** `retrieve()` reads the *response*
body. Same word, opposite direction. It reads well in a chain and confuses people
reading a fragment.

## 🔴 Always pass URI variables, never concatenate

```java
// ❌ works, and quietly destroys your metrics
.uri("/pets/" + id)

// ✅
.uri("/pets/{id}", id)
```

Two things go wrong with concatenation, and only one of them is obvious.

The obvious one is encoding: a value containing `/`, `?`, `#`, a space or a
non-ASCII character produces a URL that means something other than you intended.
The template form encodes each variable as a path segment.

The non-obvious one is **observability**. The `uri` tag on the
`http.client.requests` observation is documented as "URI template used for HTTP
request, or `none` if none was provided". Concatenate, and every distinct id
becomes a distinct tag value — a metrics cardinality explosion that will either
blow up your time-series database or get your metric dropped by a sampler. Use
the template and every call to that endpoint aggregates under `/pets/{id}`, which
is the row you actually want on the dashboard. Full detail in
[chunk 16](16-observing-outbound-calls.md).

For anything more complex than variable substitution, take the `UriBuilder`:

```java
List<Pet> pets = restClient.get()
        .uri(uriBuilder -> uriBuilder
                .path("/pets")
                .queryParam("status", status)
                .queryParam("limit", limit)
                .build())
        .retrieve()
        .body(new ParameterizedTypeReference<List<Pet>>() {});
```

`ParameterizedTypeReference` is how you read a generic type. `body(List.class)`
compiles and gives you a `List<LinkedHashMap>`, because the element type was
erased before Jackson ever saw it. That is a language fact, not a Spring one —
see [Phase 3 — Generics and collections](../../phase-3-generics-collections/README.md).

## Choosing the terminal

**`.body(Class)`** — "give me the deserialised body, and I do not care about
anything else." The right default for an endpoint whose only success shape is a
200 with a body.

**`.toEntity(Class)`** — "give me the body *and* the status and headers." Reach
for this when the caller genuinely branches on the status (201 vs 200), or needs
a header: `Location` after a create, `ETag` for a conditional follow-up,
`Retry-After` on a 429, a pagination cursor in a `Link` header.

```java
ResponseEntity<Pet> response = restClient.post()
        .uri("/pets")
        .contentType(MediaType.APPLICATION_JSON)
        .body(newPet)
        .retrieve()
        .toEntity(Pet.class);

URI created = response.getHeaders().getLocation();
```

**`.toBodilessEntity()`** — "I want the status and headers; there is no body I
care about." Use it for `DELETE`, for a `POST` that returns 202, for a health
probe. It is not merely `toEntity(Void.class)` with nicer spelling: it is the
statement that the response is finished, which matters because a response you
neither read nor close can hold a pooled connection until something times out.
That interaction is the subject of [chunk 9](09-the-pool-is-the-real-limit.md).

**`.exchange((request, response) -> ...)`** — "give me the raw exchange." You get
the `ClientHttpRequest` and `ClientHttpResponse` and full control:

```java
Pet result = restClient.get()
        .uri("/pets/{id}", id)
        .accept(MediaType.APPLICATION_JSON)
        .exchange((request, response) -> {
            if (response.getStatusCode().value() == 404) {
                return null;
            }
            if (response.getStatusCode().isError()) {
                throw new UpstreamFailure(response.getStatusCode());
            }
            return convertResponse(response);
        });
```

🔴 **`exchange` disables the default status handling.** That is the whole point of
it, and it is also its whole danger: a 500 does not throw unless *you* throw. An
`exchange` block that forgets an error branch will happily attempt to deserialise
an error page into your DTO, and what happens next depends on whether the error
page is valid JSON. Prefer `retrieve()` plus `onStatus` for anything a status
predicate can express; keep `exchange` for the cases it cannot — streaming the
body yourself, or making a decision that needs the request object too.

## Defaults on the builder versus per call

Anything you set on the builder becomes the default for every call from that
client; the per-call setting wins where both exist.

```java
RestClient client = builder
        .baseUrl("https://inventory.internal")
        .defaultHeader("Accept", "application/json")
        .defaultUriVariables(Map.of("tenant", tenantId))
        .defaultVersion("1.2")
        .apiVersionInserter(ApiVersionInserter.fromHeader("API-Version").build())
        .requestInterceptor(loggingInterceptor)
        .requestInitializer(correlationInitializer)
        .defaultStatusHandler(HttpStatusCode::is5xxServerError, this::toUpstreamFailure)
        .build();
```

One of these is worth pausing on — the interceptor/initializer pair is argued
in [chunk 2](02-wiring-it-in-boot-4.md).

**`defaultVersion` and `apiVersionInserter`** are the *client* half of Framework
7's first-class API versioning. The server half — the `version` condition on
`@RequestMapping` — is in
[Topic 07 — API versioning](../07-rest-controllers/12-api-versioning.md). The
inserter decides where the version goes: a header, a query parameter, a path
segment. Setting a default version on the client is how you avoid a version
literal at every call site.

## Gotchas

**⚠️ `body(List.class)` and the `LinkedHashMap` surprise**
**Symptom:** a `ClassCastException` far from the call site, complaining that
`LinkedHashMap` cannot be cast to your DTO.
**Cause:** the element type was erased, so Jackson had nothing to bind to and
produced maps.
**Fix:** `body(new ParameterizedTypeReference<List<Pet>>() {})`. The anonymous
subclass is what preserves the type argument at runtime.

**⚠️ A trailing slash on `baseUrl` and a leading slash on `uri`**
**Symptom:** requests go to `https://host//pets` or to the wrong path entirely.
**Cause:** the two halves are concatenated according to URI resolution rules, not
string rules; a `uri` starting with `/` is absolute against the *host*, so a base
URL with a path prefix is discarded.
**Fix:** pick one convention and hold it — base URL without a trailing slash,
path with a leading slash — and if the base URL carries a path prefix
(`https://host/api/v2`), assert the resulting URL in a test, because this is not
something the compiler will help you with.

**⚠️ `exchange` with no error branch**
**Symptom:** a downstream 503 surfaces as a deserialisation failure, or worse, as
a DTO with every field null.
**Cause:** `exchange` disables default status handling.
**Fix:** either branch on `response.getStatusCode().isError()` inside the lambda,
or do not use `exchange` — `retrieve()` plus `onStatus` covers almost every case.

**⚠️ Ignoring the response entirely**
**Symptom:** connection-pool exhaustion under load on a fire-and-forget call.
**Cause:** the terminal was never called, or the body was never consumed, so the
connection was never returned to the pool.
**Fix:** call `.toBodilessEntity()` on calls whose body you do not want. It
consumes and completes the exchange.

**⚠️ Setting `Content-Type` by hand and fighting the converter**
**Symptom:** a 415 from the downstream service, or a body serialised in an
unexpected format.
**Cause:** `.header("Content-Type", "application/json")` set as a raw header
races with the message converter's own decision.
**Fix:** use `.contentType(MediaType.APPLICATION_JSON)`, which is what the
converter selection actually consults.

**⚠️ A `defaultStatusHandler` that hides a status one call site needed**
**Symptom:** a call that should treat 404 as "absent" throws instead.
**Cause:** a builder-level handler that maps all 4xx to an exception.
**Fix:** keep the default handler narrow — 5xx, say — and express per-call
exceptions with `onStatus` at the call site that needs them:

```java
Optional<Pet> pet = Optional.ofNullable(restClient.get()
        .uri("/pets/{id}", id)
        .retrieve()
        .onStatus(s -> s.value() == 404, (req, res) -> { })   // swallow
        .body(Pet.class));
```

## Interview questions

**★ What is the difference between `body(Class)`, `toEntity(Class)` and
`toBodilessEntity()`, and how do you choose?**
They differ in how much of the response survives into your code. `body` gives you
the deserialised payload and discards the status and headers — the right default
when the only success shape is a 200 with a body. `toEntity` gives you a
`ResponseEntity`, so you keep the status code and headers; you need it whenever
the caller branches on the status or reads a header such as `Location`, `ETag`,
`Link` or `Retry-After`. `toBodilessEntity` says there is no body you want but
you still want the exchange completed properly — for a `DELETE`, a 202, a probe.
The last one is not cosmetic: completing the exchange is what returns the
connection to the pool.

**★ Why is `.uri("/pets/{id}", id)` better than `.uri("/pets/" + id)`, beyond
encoding?**
Because the URI *template* is what the observation records as the `uri` tag. With
the template, every call to that endpoint aggregates into one time series named
`/pets/{id}`, which is the row you want on a latency dashboard. With
concatenation, each distinct id becomes its own tag value, so a service calling
one endpoint with a million ids produces a million series — which either exhausts
your metrics backend or gets the whole metric dropped. Encoding is the reason you
notice in a code review; cardinality is the reason it costs money.

**★ When would you use `exchange` rather than `retrieve`, and what do you give
up?**
`exchange` hands you the `ClientHttpRequest` and `ClientHttpResponse` and lets
you decide everything, which you need when the decision depends on the request as
well as the response, or when you want to consume the body yourself rather than
letting a message converter do it. What you give up is the default status
handling: nothing throws on a 4xx or 5xx unless your lambda throws it. That is
the source of the classic bug where a downstream error page gets deserialised
into a DTO of nulls. My rule is that `retrieve()` plus `onStatus` handles
everything a status predicate can express, which is nearly everything, and
`exchange` is reserved for the rest.

**★ You call an endpoint that returns a JSON array of objects. Write the call.**
`restClient.get().uri("/pets").retrieve().body(new ParameterizedTypeReference<List<Pet>>() {})`.
The `ParameterizedTypeReference` matters: `body(List.class)` compiles but erases
the element type, so Jackson binds each element to a `LinkedHashMap` and you get
a `ClassCastException` at whatever line first treats an element as a `Pet` — a
long way from the call. The anonymous-subclass trick is the standard way to
smuggle a generic type into runtime, and it is a language mechanism, not a Spring
one.

**★ Where does the client-side half of Framework 7's API versioning live?**
On the builder: `defaultVersion("1.2")` sets the version to send, and
`apiVersionInserter(...)` decides where it goes — a header, a query parameter or
a path segment — matching whatever the server declared. Doing it on the builder
rather than at each call site means the version appears once per client, so
moving to `1.3` is a one-line change rather than a search-and-replace. It pairs
with the `version` condition on the server's `@RequestMapping`, which is what
turns "unsupported version" into a routing decision instead of a runtime check.

---

← Prev: [Wiring it in Boot 4](02-wiring-it-in-boot-4.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [HTTP interfaces](04-http-interfaces.md)
