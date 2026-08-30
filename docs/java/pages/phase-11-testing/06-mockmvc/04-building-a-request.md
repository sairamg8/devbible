---
title: "param(), queryParam() and formField() all populate the same Servlet parameter map, but only two of them put anything in the query string and only one puts anything in the body — so a controller that reads getQueryString(), or a filter that rebuilds the URI, sees a completely different request depending on which one your test called"
sidebar_label: "04 · Building a request"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Performing Requests"
> ([hamcrest](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/requests.html),
> [assertj](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/requests.html))
> — read as asciidoc source at tag `v7.0.9`, and the `spring-test` 7.0.9 sources for
> `MockMvcRequestBuilders`, `MockHttpServletRequestBuilder` and
> `AbstractMockHttpServletRequestBuilder`, from which every javadoc sentence and code excerpt
> below is taken.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[01b](01b-the-blank-request.md) established that the mock request starts empty. This chunk is
how you fill it, and it is more interesting than a list of setters because several of the methods
look interchangeable and are not. The HTTP message — URI, parameters, headers, body, encoding — is
here; everything the Servlet environment carries around the message is
[04b · The Servlet environment](04b-the-servlet-environment.md).**

## One builder, two front doors

```java
// classic: static factories on MockMvcRequestBuilders
mockMvc.perform(post("/hotels/{id}", 42).accept(MediaType.APPLICATION_JSON));

// AssertJ: methods on the tester
assertThat(mvc.post().uri("/hotels/{id}", 42).accept(MediaType.APPLICATION_JSON)).hasStatusOk();
```

Both listings are the reference's own, and they build the same object. The AssertJ page says so:
`MockMvcTester` *"provides a fluent API to compose the request that **reuses the same
`MockHttpServletRequestBuilder`** as the Hamcrest support, except that there is no need to import
a static method."* So everything below applies to both, and the only difference is whether the
URI arrives as an argument to `get(...)` or to `.uri(...)`.

The factories are `get`, `post`, `put`, `patch`, `delete`, `options`, `head`, the generic
`request(HttpMethod, …)`, `multipart(…)` and `asyncDispatch(mvcResult)`
([03d](03d-async-and-streaming.md)).

## The URI is expanded, then encoded

```java
private static URI initUri(String uri, @Nullable Object[] vars) {
    Assert.notNull(uri, "'uri' must not be null");
    Assert.isTrue(uri.isEmpty() || uri.startsWith("/") || uri.startsWith("http://") || uri.startsWith("https://"),
            () -> "'uri' should start with a path or be a complete HTTP URI: " + uri);
    String uriString = (uri.isEmpty() ? "/" : uri);
    return UriComponentsBuilder.fromUriString(uriString).buildAndExpand(vars).encode().toUri();
}
```

Three things fall out of those five lines.

**A relative URI is rejected.** `get("orders/42")` fails the assertion with *"'uri' should start
with a path or be a complete HTTP URI"*. It must start with `/`, `http://` or `https://`.

**Variables are expanded first and the result is encoded second.** `get("/orders/{ref}", "A B")`
produces `/orders/A%20B`, which is what a client would send. You do not pre-encode template
variables, and if you do you get double encoding — `%2520` for a space.

**A query string in the template is part of the URI**, so `get("/hotels?thing={thing}",
"somewhere")` is a real query string that `getQueryString()` returns. That is not true of
`param(...)`, which is the next section.

## 🔴 `param`, `queryParam`, `formField` — same map, different requests

All three add to the Servlet parameter map. Only some of them add anything else. From the
javadoc, verbatim:

> **`param`** — *"Add a request parameter to `MockHttpServletRequest#getParameterMap()`. In the
> Servlet API, a request parameter may be parsed from the query string and/or from the body of an
> `application/x-www-form-urlencoded` request. **This method simply adds to the request parameter
> map.**"*
>
> **`queryParam`** — *"**Append to the query string** and also add to the request parameters map.
> The parameter name and value are encoded when they are added to the query string."*
>
> **`formField`** — *"**Append the given value(s) to the given form field** and also add them to
> the request parameters map."*

and the implementations make the relationship exact:

```java
public B queryParam(String name, String... values) {
    param(name, values);                                    // the map
    this.queryParams.addAll(name, Arrays.asList(values));   // and the query string
    return self();
}

public B formField(String name, String... values) {
    param(name, values);                                    // the map
    this.formFields.addAll(name, Arrays.asList(values));    // and the form body
    return self();
}
```

| | parameter map | query string | request body |
|---|---|---|---|
| `param("a", "b")` | ✓ | — | — |
| `queryParam("a", "b")` | ✓ | ✓ (encoded) | — |
| `formField("a", "b")` | ✓ | — | ✓ |
| `uri("/x?a=b")` | ✓ | ✓ | — |
| `content("a=b")` + `contentType(FORM_URLENCODED)` | ✓ | — | ✓ |

The reference gives the rule of thumb and its caveat:

> *"If application code relies on Servlet request parameters and does not check the query string
> explicitly (as is most often the case), it does not matter which option you use. Keep in mind,
> however, that **query parameters provided with the URI template are decoded while request
> parameters provided through the `param(...)` method are expected to already be decoded**."*

**When it does matter** — and it matters more than that sentence suggests:

- Anything calling `request.getQueryString()` — a filter building a redirect, an audit log, a
  correlation-id filter, a cache key — sees `null` under `param(...)`.
- `ServletUriComponentsBuilder.fromRequest(request)` and `fromCurrentRequest()` rebuild the URI
  from the request, so a `Location` header or a HATEOAS self-link built that way loses parameters
  added with `param(...)`.
- Spring Security matchers and Boot's `/error` forwarding both work off the URI.

`queryParam` is the safer default for a `GET`: it produces the parameter map *and* a request that
looks like the one a client sends. Use `param` when you genuinely mean "a Servlet parameter from
wherever", and `formField` for a form `POST`.

⚠️ Note also that `queryParam` **encodes** what you give it, while `param` does not — so
`param("q", "a b")` yields the value `a b` (already decoded, as documented) and
`queryParam("q", "a b")` yields `?q=a%20b` on the wire and `a b` in the map. Passing a
pre-encoded `a%20b` to `param` gives the controller the literal string `a%20b`.

## Headers

```java
.header("X-Tenant", "acme")                      // one name, one or more values
.headers(httpHeaders)                            // merge a whole HttpHeaders
.headers(h -> h.setBearerAuth(token))            // a Consumer<HttpHeaders>, since 5.1
.accept(MediaType.APPLICATION_JSON)              // varargs, MediaType or String
.acceptCharset(StandardCharsets.UTF_8)
.contentType(MediaType.APPLICATION_JSON)
.ifModifiedSince(zonedDateTime)
.ifNoneMatch("\"v1\"", "\"v2\"")
```

The `Consumer<HttpHeaders>` variant is the one worth remembering, because it gives you the typed
setters — `setBearerAuth`, `setBasicAuth`, `setIfNoneMatch`, `setRange` — instead of hand-writing
header strings.

🔴 **Set `accept` deliberately, always.** [01b](01b-the-blank-request.md) makes the general point;
here is the concrete one. With no `Accept` header, content negotiation resolves `*/*`, which is
not what any real client sends, and at least three things branch on it: which
`HttpMessageConverter` is selected, what a `produces = ...` mapping does, and — most
surprisingly — which authentication entry point Spring Security uses, which is the difference
between a 401 and a 302 in [08 · Security in a slice](08-security-in-a-slice.md).

## The body, and the encoding trap

```java
.content("{\"reference\":\"ORD-42\"}")
.content(bytes)
.contentType(MediaType.APPLICATION_JSON)
```

Two documented behaviours, both easy to trip over.

**`content(String)` is always UTF-8.** Not "the request's character encoding" — UTF-8, hard-coded:

```java
public B content(String content) {
    this.content = content.getBytes(StandardCharsets.UTF_8);
    return self();
}
```

So `.characterEncoding("ISO-8859-1").content("café")` builds a request whose declared encoding is
Latin-1 and whose bytes are UTF-8. The controller decodes two bytes as two characters and you get
mojibake that exists only in the test. If you are testing a non-UTF-8 encoding, use
`content(byte[])` and produce the bytes yourself.

**Form content is parsed into the parameter map.** From the javadoc of `content` and of
`contentType`: *"If content is provided and `contentType` is set to
`application/x-www-form-urlencoded`, the content will be parsed and used to populate the request
parameters map."* That is a convenience and it is also why a form `POST` written with `content(...)`
behaves like one written with `formField(...)` — as far as `@RequestParam` is concerned.

## `defaultRequest` — the properties every request inherits

```java
mockMvc = standaloneSetup(new AccountController())
    .defaultRequest(get("/")
        .contextPath("/app").servletPath("/main")
        .accept(MediaType.APPLICATION_JSON)).build();
```

> *"The preceding properties affect every request performed through the `MockMvc` instance. If the
> same property is also specified on a given request, it overrides the default value. That is why
> the HTTP method and URI in the default request do not matter, since they must be specified on
> every request."*

This is the right home for a context path, a servlet path or a default `Accept` that would
otherwise be repeated on every line. It is **not** the right home for `alwaysExpect`, which cannot
be overridden at all — [03b](03b-the-classic-api.md).

## Gotchas

**★ Using `param(...)` for a `GET` and expecting a query string.**
`param` *"simply adds to the request parameter map"*. `getQueryString()` returns `null`, so any
filter, interceptor or `ServletUriComponentsBuilder` call that rebuilds the URI sees no
parameters. Use `queryParam(...)`, or put them in the URI template.

**★ Pre-encoding a value passed to `param(...)`.**
Parameters given to `param` *"are expected to already be decoded"*, so `param("q", "a%20b")` gives
the controller the seven-character string `a%20b`. Query parameters in the URI template are
decoded for you; these are not.

**★ Pre-encoding a URI template variable.**
`uri(...)` expands variables and *then* encodes the whole URI —
`buildAndExpand(vars).encode()`. A value you encoded yourself is encoded twice, so a space becomes
`%2520`.

**★ A relative URI.**
`get("orders/42")` throws on an assertion: *"'uri' should start with a path or be a complete HTTP
URI"*. Leading slash, or a full `http://` URI.

**★ `characterEncoding("ISO-8859-1")` with `content(String)`.**
`content(String)` hard-codes `StandardCharsets.UTF_8`. The declared encoding and the actual bytes
then disagree, and the corruption is an artefact of the test rather than of the application. Use
`content(byte[])` when the encoding is the thing under test.

**★ Forgetting `contentType` on a `POST` with a body.**
With no `Content-Type` there is no matching `HttpMessageConverter`, and the result is a 415
`Unsupported Media Type` that reads like a controller bug. It is a missing line in the test.

**★ Omitting `accept` and then being surprised by the response format, the status, or the
redirect.** No `Accept` means `*/*`, which selects converters differently from any real client and
changes Spring Security's entry point. Set it on the request, or once via `defaultRequest`.

**★ Setting `contentType(APPLICATION_FORM_URLENCODED)` and also calling `param(...)`.**
Both populate the parameter map, from different places, and the merge is not obvious to a reader.
Pick one representation of the form per test.

**★ Building headers by hand when `headers(Consumer)` exists.**
`.headers(h -> h.setBearerAuth(token))` is checked by the compiler; `.header("Authorization",
"Bearer " + token)` is a string you can get wrong in four ways, and every one of them produces a
401 that looks like a security-configuration problem.

## Interview questions

**★ What is the difference between `param`, `queryParam` and the URI's own query string?**
`param` adds only to the Servlet parameter map. `queryParam` adds to the map *and* appends to the
query string, encoding as it goes. A query in the URI template is a real query string and is
decoded into the parameter map for you. All three satisfy `@RequestParam`; only two of them are
visible to anything that reads `getQueryString()` or rebuilds the URI from the request — which
includes redirect-building filters, `ServletUriComponentsBuilder`, and security matchers.

**★ Why does a value with a space behave differently in `param` and in a URI template?**
Because they sit on opposite sides of the encoding step. `uri(template, vars)` expands the
variables and then calls `.encode()`, so you pass the raw value and Spring encodes it. `param`
takes values that *"are expected to already be decoded"* and puts them straight in the map, so a
`%20` you supply is data, not an escape.

**★ Your test sends `café` in a body and the controller receives mojibake. What happened?**
`content(String)` always encodes as UTF-8 — the method body is
`content.getBytes(StandardCharsets.UTF_8)` — while `characterEncoding(...)` only sets what the
request *claims*. If the two disagree the controller decodes UTF-8 bytes as something else. Use
`content(byte[])` with bytes you produced in the encoding under test.

**★ A `POST` test returns 415 and the controller looks correct. What is missing?**
`contentType`. Without it there is no media type to match against, so no `HttpMessageConverter`
can read the body and Spring MVC rejects the request before the handler. It is the single most
common cause of an unexplained 415 in a MockMvc test.

**★ How do you avoid repeating `contextPath`, `servletPath` and `accept` on every request?**
`defaultRequest(get("/").contextPath("/app").servletPath("/main").accept(APPLICATION_JSON))` on
the builder. Per-request values override the defaults, and the method and URI in the default
request are ignored because both must be given per request. Do not reach for `alwaysExpect` in the
same breath — that one cannot be overridden and it makes error-path tests impossible.

{/* FOOTER */}
