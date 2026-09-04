---
title: "Every HTTP client test in every codebase asserts the response and half of them assert nothing at all about the request, which is why the bugs that reach production are a wrong path, an unencoded query parameter, a missing auth header and an idempotency key that changes on retry"
sidebar_label: "03d · Asserting what you sent"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** javadoc for
> [`MockRestRequestMatchers`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/match/MockRestRequestMatchers.html)
> — every matcher signature on this page is read from it — the reference *Testing Client
> Applications*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html)),
> and **WireMock**'s JUnit 5 documentation
> ([wiremock.org/docs/junit-jupiter](https://wiremock.org/docs/junit-jupiter/)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**A client does two things: it builds a request and it interprets a response. Tutorials test
the second one, because a stubbed response is the interesting-looking part and the assertion
is a familiar `assertThat(result)`. But the response half is a mapping bug at worst, while
the request half is a wrong path, a query parameter encoded twice, a missing `Authorization`
header, a `Content-Type` you never set, or an idempotency key that is regenerated on every
attempt — and that last one is a double charge. This chunk is the request envelope: the
method, the URI, the query string and the headers. The body, and the JSON comparison modes
that make body assertions either useful or decorative, is
[03d2](03d2-asserting-the-body.md).**

## The shape of the omission

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
```

One matcher. That test passes when the method is `GET` instead of `POST`, when the
`Idempotency-Key` header is absent, when the `Authorization` header carries an empty token,
when the amount in the body is in major units instead of minor, and when a customer id with a
space in it went out unencoded. Every one of those is a real production incident shape, and
none of them is a response-mapping bug.

🔴 **`MockRestServiceServer`'s whole advantage over a mocked `RestClient` is that a request
object genuinely gets built** — the URI template is expanded, the query is encoded, the
message converter serialises the body ([03a](03a-what-the-mock-server-does-not-run.md)). The
only way to collect on that advantage is to assert on it.

## The matcher catalogue, verified

Static imports come from `MockRestRequestMatchers`. The reference is explicit about the
import style:

> *"As with server-side tests, the fluent API for client-side tests requires a few static
> imports. Those are easy to find by searching for `MockRest*`."*

| Matcher | Signature | Asserts |
|---|---|---|
| `anything()` | `RequestMatcher anything()` | *"Match to any request."* |
| `method(...)` | `method(HttpMethod method)` | *"Assert the `HttpMethod` of the request."* |
| `requestTo(...)` | `requestTo(String)`, `requestTo(URI)`, `requestTo(Matcher<? super String>)` | *"Assert the request URI matches the given string."* |
| `requestToUriTemplate(...)` | `requestToUriTemplate(String expectedUri, Object... uriVars)` | *"Variant of `requestTo(URI)` that prepares the URI from a URI template plus optional variables via `UriComponentsBuilder` including encoding."* |
| `queryParam(...)` | `queryParam(String name, String... expectedValues)` and a Hamcrest variant | *"Assert request query parameter values."* |
| `queryParamList(...)` | `queryParamList(String name, Matcher<? super List<String>> matcher)` | *"…matching on the entire `List` of values."* |
| `queryParamCount(...)` | `queryParamCount(int expectedCount)` | *"Assert the number of query parameters present in the request."* |
| `header(...)` | `header(String name, String... expectedValues)` and a Hamcrest variant | *"Assert request header values."* |
| `headerList(...)` | `headerList(String name, Matcher<? super List<String>> matcher)` | *"…matching on the entire `List` of values."* |
| `headerDoesNotExist(...)` | `headerDoesNotExist(String name)` | *"Assert that the given request header does not exist."* |
| `content()` | `ContentRequestMatchers content()` | *"Access to request body matchers."* → [03d2](03d2-asserting-the-body.md) |
| `jsonPath(...)` | `jsonPath(String expression, Object... args)` | *"…using a JsonPath expression to inspect a specific subset of the body."* |
| `xpath(...)` | `xpath(String expression, Object... args)` | the XML equivalent |

The three at the bottom belong to the body and are covered next door. The rest is the
envelope, and the envelope is what this page is about.

## 1 · The method, which costs one line and catches a real class of bug

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andExpect(method(HttpMethod.POST))
```

`requestTo` alone matches on URI only. A refactor that turns `http.post()` into
`http.put()` — say, someone switching to an upsert endpoint and updating one call site of
two — passes a URI-only expectation. Add `method(...)` to every expectation; there is no case
where you do not know the method.

## 2 · The absolute URI, which is the only thing that can catch a wrong host

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))     // ✅ absolute
server.expect(requestTo("/v1/charges"))                            // ⚠️ matches with any host
```

Nothing resolves DNS in this test ([03a](03a-what-the-mock-server-does-not-run.md)), so a
base URL of `https://pay.example.con` is invisible to a path-only matcher. Assert the
absolute URI in at least one test per client, and construct the client from the same
properties object production uses so the value is not independently typed in the test.

## 3 · Query parameters — assert them as parameters, not as a substring

This is the single most valuable matcher on the page, because the bug it catches is
invisible by inspection.

```java
@Test
void encodesTheSearchTermRatherThanConcatenatingIt() {
    server.expect(requestToUriTemplate("https://pay.example.com/v1/charges?customer={c}", "acme corp & sons"))
          .andExpect(method(HttpMethod.GET))
          .andExpect(queryParam("customer", "acme corp & sons"))
          .andExpect(queryParamCount(1))
          .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

    gateway.chargesFor("acme corp & sons");

    server.verify();
}
```

Three things are being tested there and it is worth being precise about which is which.

- **`queryParam("customer", "acme corp & sons")` compares the *decoded* parameter value.**
  That is what makes it a good assertion: it passes whether the client encoded the space as
  `%20` or `+`, and it fails if the `&` split the parameter in two — which is exactly the
  bug. A `requestTo(...)` string comparison against a hand-written encoded URL asserts the
  encoding *scheme* instead, and breaks on a harmless change.
- **`requestToUriTemplate` runs the expected URI through `UriComponentsBuilder`**, per its
  javadoc, *"including encoding"*. So the expectation is built the same way the client built
  the actual URI, and you are not hand-encoding anything in the test.
- **`queryParamCount(1)` catches the parameter you did not mean to send.** A stray
  `?page=0&size=20` added by a helper, an empty optional serialised as `filter=`, a debug
  flag left in — none of these fail any per-parameter assertion, because per-parameter
  assertions are existence checks. The count is the only matcher that fails on an *extra*.

### The double-encoding bug, which this catches and nothing else does

`RestClient`'s `uri(...)` overloads expand and encode a template. Pass an already-encoded
string into a template and you get `%2520` where you wanted `%20`; build the URI yourself
with `UriComponentsBuilder.build(true)` and hand it to a method that encodes again, same
result. The failure in production is a partner returning "customer not found" for a customer
that plainly exists, and it is invisible when you read the code because both halves look
right. `queryParam` fails on it immediately, because the decoded value is
`acme%20corp` rather than `acme corp`.

## 4 · Headers — including the one that must not be there

```java
server.expect(requestTo("https://pay.example.com/v1/charges"))
      .andExpect(method(HttpMethod.POST))
      .andExpect(header(HttpHeaders.CONTENT_TYPE, "application/json"))
      .andExpect(header(HttpHeaders.ACCEPT, "application/json"))
      .andExpect(header("Idempotency-Key", command.idempotencyKey()))
      .andExpect(header(HttpHeaders.AUTHORIZATION, startsWith("Bearer ")))
      .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
```

Four observations, one per line.

- **`Content-Type` is set by the client, not by you, unless you set it.** A body posted
  without `contentType(...)` gets whatever converter selection produced, which for a `String`
  body is `text/plain` — and a partner that requires JSON returns a 415 that no test caught.
- **`Accept` decides what comes back.** Partners that content-negotiate will send XML to a
  client that sent no `Accept`, and the failure is a message-conversion error a long way from
  the missing header.
- **The idempotency key is asserted against the value from the command**, not against
  `notNullValue()`. Asserting mere presence passes when the client generates a fresh key per
  attempt, which is the bug that produces a double charge on retry — see
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- **The `Authorization` header is asserted on its *shape*, not its value.** `startsWith`
  is `org.hamcrest.Matchers.startsWith`, used through the
  `header(String, Matcher<? super String>...)` overload. Pinning the literal token means the
  test either contains a secret or duplicates the token-building logic it is meant to check.

### `headerDoesNotExist` is not a curiosity

```java
.andExpect(headerDoesNotExist(HttpHeaders.AUTHORIZATION))
```

Two situations make this the assertion you actually want. **A public endpoint on a partner
that also has authenticated endpoints**: sending credentials to a URL that does not need them
is a leak, and one shared `RestClient.Builder` with a `defaultHeader` sends them everywhere.
**A header you deliberately removed**: someone strips `X-Internal-Trace` before calling out,
and the only test that can protect that decision is the negative one. This is the outbound
twin of the argument in [06b](06b-the-401-and-the-tests-nobody-writes.md) — the positive test
passes whether or not the rule exists.

### Multi-valued headers need `headerList`

`header(name, "a", "b")` asserts values positionally. When the assertion is about the set
rather than the sequence — `Accept` with several media types, several `Cookie` values —
`headerList(name, Matcher<? super List<String>>)` takes a matcher over the whole list and
lets you use `containsInAnyOrder`. Positional assertions on headers whose order is not
guaranteed by your code are a slow-burning source of order-dependent failures.

## The same assertions on a socket

If the test is running against WireMock or `MockWebServer` ([03b](03b-wiremock-and-mockwebserver.md),
[03e](03e-mockwebserver-and-the-cost-of-a-socket.md)), the ideas transfer and the API does
not.

**WireMock** verifies as a query after the fact, which is why it composes well:

```java
verify(postRequestedFor(urlPathEqualTo("/v1/charges"))
        .withQueryParam("customer", equalTo("acme corp & sons"))
        .withHeader("Idempotency-Key", matching(".+"))
        .withoutHeader("X-Internal-Trace"));
```

**MockWebServer** reads from a queue, so the request assertions are the only thing standing
between you and a test that cannot fail — the queue serves the next response regardless of
what was asked for:

```java
RecordedRequest request = server.takeRequest();
assertThat(request.getMethod()).isEqualTo("POST");
assertThat(request.getTarget()).isEqualTo("/v1/charges");
assertThat(request.getHeaders().get("Idempotency-Key")).isNotNull();
```

⚠️ `getTarget()` is *"sometimes a path, but it can also be a path and query, or a full URL"*
per OkHttp's own changelog, so a naive equality assertion on it is fragile the moment a query
string appears. WireMock's `urlPathEqualTo` plus `withQueryParam` separates the two; with
`MockWebServer` you parse it yourself or use `request.getUrl()`.

## Where this connects

- The body, `content().json(...)`, the comparison modes and the form/multipart matchers:
  [03d2 · Asserting the body](03d2-asserting-the-body.md).
- What is actually running when these matchers see a request, and what is not:
  [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).
- The binding and the two routes: [03 · Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md).
- On a real socket: [03b](03b-wiremock-and-mockwebserver.md) and
  [03e](03e-mockwebserver-and-the-cost-of-a-socket.md).
- The idempotency key asserted across a *retry* rather than a single call:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The same "assert what was sent" discipline one layer up, on a mocked collaborator rather
  than an HTTP request: [02 · Mocking a class you own](02-mocking-a-class-you-own.md) and
  [03d2](03d2-asserting-the-body.md)'s captor section.
- Why the negative assertion is the only one that can detect a missing rule, in the inbound
  direction: [06b](06b-the-401-and-the-tests-nobody-writes.md).

## Gotchas

**★ `requestTo` matches the URI only, so a `POST` that became a `PUT` passes.**
The single-matcher expectation is the default people copy, and `method(...)` is the cheapest assertion in the whole file. There is never a case where the method is unknown at test-writing time, so there is never a reason to omit it.

**★ A path-only `requestTo("/v1/charges")` cannot fail on a wrong host, because nothing resolves it.**
`MockRestServiceServer` replaces the request factory, so there is no DNS lookup and no connection. `https://pay.example.con/v1/charges` matches a path-only expectation happily. At least one test per client must assert the absolute URI, and the base URL should come from the same properties type production binds.

**★ Asserting the query string as a substring of the URI tests the encoding scheme, not the value.**
`requestTo("…?customer=acme%20corp")` fails if the client legitimately emits `+`, and passes if the value was double-encoded to `%2520` when your expectation was written from the same broken code. `queryParam(name, value)` compares the decoded value, so it is insensitive to the scheme and sensitive to the bug.

**★ Per-parameter assertions cannot fail on an extra parameter, and `queryParamCount` is the only matcher that can.**
Every `queryParam(...)` is an existence-and-value check. A stray `?debug=true`, an empty `filter=` from an unwrapped `Optional`, or pagination defaults added by a shared helper all pass. Partners do reject or mis-handle unexpected parameters, and some log them, which is a data-leak surface. One `queryParamCount(n)` per request assertion closes it.

**★ Double encoding produces a request that looks correct in every log and fails only at the partner.**
It happens when an already-encoded string is passed into a URI template, or when a `UriComponentsBuilder.build(true)` result is handed to a method that encodes again. The client's own logs show the encoded form, which looks plausible; the partner sees `acme%2520corp`. `queryParam` with the raw expected value is the assertion that fails on it, and it fails at the point the request is built rather than at the partner.

**★ Not setting `Content-Type` means the converter picks one, and for a `String` body that is not JSON.**
The failure is a 415 from the partner, discovered in an environment where the partner is real. `contentType(MediaType.APPLICATION_JSON)` on the request and `header(CONTENT_TYPE, "application/json")` in the expectation cost one line each. The same argument applies to `Accept` for a partner that content-negotiates.

**★ Asserting that the idempotency key is merely *present* passes for a client that regenerates it on every attempt.**
`header("Idempotency-Key", notNullValue())` is a test of the header's existence, and existence is not the property that prevents a double charge — stability across retries is. Assert the exact value the command carried, and assert it again on the second attempt in a retry test ([09b](09b-idempotency-and-the-double-charge.md)).

**★ Pinning the literal `Authorization` value either puts a secret in the repository or re-implements the token logic in the test.**
Both are worse than asserting the shape. `header(AUTHORIZATION, startsWith("Bearer "))` proves the scheme and that something non-empty followed it, without the test knowing the token. If the token *construction* is the thing under test — a signature, an HMAC, a JWT you build — that is its own unit test on the class that builds it, not an assertion smuggled into an HTTP expectation.

**★ A `defaultHeader` on a shared `RestClient.Builder` sends credentials to every host that builder reaches.**
Boot auto-configures a prototype-scoped `RestClient.Builder`, and a `RestClientCustomizer` that adds an `Authorization` header applies to every client built from it, including ones calling a different partner entirely. `headerDoesNotExist(AUTHORIZATION)` in the test of the client that should not send it is the only automated check for this.

**★ `header(name, "a", "b")` is positional, so a set-valued header with an unspecified order gives you an order-dependent test.**
Use `headerList(name, containsInAnyOrder("a", "b"))` when your code does not itself guarantee an order — a header built from a `Set`, from a stream over a map, or by concatenating configuration. The positional form is correct only when the ordering is part of the behaviour.

**★ With `MockWebServer`, request assertions are not extra rigour — without them the test structurally cannot fail on a wrong request.**
The queue has no matcher. `enqueue(response)` serves the next request whatever it was, so a misspelled path returns the same 200 and maps cleanly. `takeRequest()` plus assertions on method, target and headers is the minimum, and `getTarget()` may include the query string, so compare it carefully rather than with a bare equality against a path.

## Interview questions

**★ You are reviewing an HTTP client test that stubs a 200 and asserts the mapped object. What do you ask for?**
The request assertions, because as written the test covers one of the two things the client does. Concretely I want the method, the absolute URI, the query parameters compared as decoded values plus a parameter count, the `Content-Type` and `Accept` headers, any auth header asserted on its shape, and — for anything that moves money or creates a resource — the idempotency key asserted against the exact value the command carried. Then `server.verify()`, without which none of the expectations are assertions at all. The reason this matters more than it sounds is that the response-mapping half fails loudly and locally when it is wrong, while a wrong path or an unencoded parameter fails at the partner, in an environment where the partner is real, usually during an incident.

**★ Why assert `queryParam("customer", "acme corp & sons")` rather than matching the URI string?**
Because the two assertions are about different things. Matching the URI string asserts the encoding scheme the client chose — `%20` versus `+`, whether the `&` was escaped, the parameter order — none of which is behaviour I care about, all of which can change without a bug. `queryParam` compares the decoded value, so it is exactly the question I want answered: did the parameter arrive with the value I intended? It fails on the real bugs, which are the `&` splitting the parameter into two, the double encoding producing `%2520`, and the value silently truncated at a space. And it does not fail on the harmless changes, so it will not be the test somebody deletes because it keeps going red for no reason.

**★ What can `queryParamCount` catch that nothing else can, and is it worth the line?**
An extra parameter. Every other matcher is an existence-and-value assertion, so anything additional in the query string is invisible to all of them. The realistic causes are a shared request helper adding pagination defaults, an `Optional` that serialises as an empty value rather than being omitted, and a debug or feature-flag parameter that got merged. It is worth the line for two reasons beyond correctness: some partners reject unknown parameters and some log full URLs, so an accidental parameter carrying an identifier is a data-exposure question rather than a tidiness one.

**★ How do you test the `Authorization` header without putting a token in the test?**
By asserting the shape and testing the construction separately. In the client test I use the Hamcrest overload — `header(AUTHORIZATION, startsWith("Bearer "))` — which proves a bearer token was attached and that it was not empty, and that is all the client under test is responsible for. Whatever produces the token — a credentials provider, a token cache with refresh, an HMAC signer — is its own class with its own test where the inputs and the expected output can be fixtures rather than secrets. Where I do want a stronger assertion is the negative one: `headerDoesNotExist(AUTHORIZATION)` on any client that should not be sending credentials, because a `defaultHeader` on a shared builder will happily send them to every host, and no positive test anywhere will notice.

{/* FOOTER */}
