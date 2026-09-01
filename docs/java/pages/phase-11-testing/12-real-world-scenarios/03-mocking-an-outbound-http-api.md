---
title: "Testing the code that calls somebody else's HTTP API is two tests at two levels, and the reason people write one bad test instead is that they mock RestClient rather than binding a MockRestServiceServer to the builder the client was made from"
sidebar_label: "03 · Mocking an outbound HTTP API"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** reference *Testing Client
> Applications*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html));
> the `MockRestServiceServer`, `MockRestRequestMatchers` and `MockRestResponseCreators`
> javadocs
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/MockRestServiceServer.html));
> the **Spring Boot 4.1** javadocs for `@RestClientTest` and `MockServerRestClientCustomizer`
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/restclient/test/autoconfigure/RestClientTest.html));
> and the Framework reference *REST Clients*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html))
> for `RestClient` error semantics.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, POM configuration and
> documented behaviour only, never console output.

**This is the scenario people search for more than any other in this topic, and the search
usually lands them on a four-mock-deep stub of `RestClient`'s fluent API. The right answer
is not one test, it is two, at two levels: the *service* test mocks your own gateway
interface, and the *client* test binds a `MockRestServiceServer` to the builder the client
was constructed from and asserts both the response handling and the outgoing request.
This chunk shows the second test — the seam, the binding API for `RestClient` on Boot 4
(which is not the `RestTemplate` snippet every blog shows), and the two ways to get at it:
with a Spring context and without one.**

## The two levels, stated once

You have a `CheckoutService` that calls a `PaymentGateway` interface, and a
`HttpPaymentGateway` that implements it over HTTP. Two boundaries, two tests:

| Test | What is real | What is doubled | What it can catch |
|---|---|---|---|
| `CheckoutServiceTest` | the service, the domain | `PaymentGateway` — a Mockito mock of **your** interface | order state, what happens on decline, what happens on failure |
| `HttpPaymentGatewayTest` | the client, the converters, the URI building | the **HTTP transport**, via `MockRestServiceServer` | wrong URL, wrong header, wrong body, wrong error mapping |

Neither substitutes for the other, and the failure mode of trying is
[01a](01a-the-four-failure-modes.md)'s wrong-altitude mock: stubbing
`when(restClient.get()).thenReturn(uriSpec)` is testing Spring's DSL, and it will pass with
the URL spelled wrong.

The first test is [02 · Mocking a class you own](02-mocking-a-class-you-own.md) and it needs
nothing from this page. Everything below is the second.

## The client under test

```java
public class HttpPaymentGateway implements PaymentGateway {

    private final RestClient http;

    public HttpPaymentGateway(RestClient.Builder builder, PaymentProperties props) {
        this.http = builder.baseUrl(props.baseUrl()).build();
    }

    @Override
    public ChargeResult charge(ChargeCommand command) {
        return http.post()
                .uri("/v1/charges")
                .header("Idempotency-Key", command.idempotencyKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ChargeRequest(command.amountMinorUnits(), command.currency()))
                .retrieve()
                .body(ChargeResult.class);
    }
}
```

🔴 **The constructor takes `RestClient.Builder`, not `RestClient`.** That single decision is
what makes the whole page work: the mock server is bound to a *builder*, so a class that
accepts an already-built `RestClient` has closed the seam before you got to it. Boot
auto-configures a prototype-scoped `RestClient.Builder` bean, so taking the builder is also
what you want in production — it inherits the observation, the message converters and any
`RestClientCustomizer` the application registered.

## Binding the mock server — the API, verified

`MockRestServiceServer` has three `bindTo` overloads, and the `RestClient` one is real and
first-class, not a workaround:

- `bindTo(RestClient.Builder)` — *"Return a builder for a `MockRestServiceServer` that
  should be used to reply to the `RestClient` for the given `RestClient.Builder`."*
- `bindTo(RestTemplate)` — *"Return a builder for a `MockRestServiceServer` that should be
  used to reply to the given `RestTemplate`."*
- `bindTo(RestGatewaySupport)`

The class-level javadoc is worth reading literally, because it names the mechanism:

> *"Main entry point for client-side REST testing. Used for tests that involve direct or
> indirect use of the `RestClient`. Provides a way to set up expected requests that will be
> performed through the `RestClient` as well as mock responses to send back thus removing
> the need for an actual server."*

⚠️ **Every article older than Framework 6.1 shows only the `RestTemplate` form.** The
binding is the one line people copy wrong, and the symptom is a test where the mock server
never sees a request and `verify()` fails — because the client was built from a *different*
builder than the one that was bound.

## Route A · No Spring context at all

This is the fast one, and it is a plain JUnit test with no `@SpringBootTest`, no slice, and
no context cache entry. Build the builder yourself, bind, construct the class under test:

```java
class HttpPaymentGatewayTest {

    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private HttpPaymentGateway gateway;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        gateway = new HttpPaymentGateway(builder, new PaymentProperties("https://pay.example.com"));
    }

    @Test
    void mapsASuccessfulChargeResponse() {
        server.expect(requestTo("https://pay.example.com/v1/charges"))
              .andExpect(method(HttpMethod.POST))
              .andRespond(withSuccess("""
                      {"id":"ch_123","status":"succeeded","amount":9000}
                      """, MediaType.APPLICATION_JSON));

        ChargeResult result = gateway.charge(aCharge().minorUnits(9000).build());

        assertThat(result.id()).isEqualTo("ch_123");
        assertThat(result.status()).isEqualTo(ChargeStatus.SUCCEEDED);
        server.verify();
    }
}
```

Static imports are `MockRestRequestMatchers.requestTo`, `MockRestRequestMatchers.method`
and `MockRestResponseCreators.withSuccess`.

Note what this test asserts that a mocked `RestClient` never could: the **absolute URL**,
the **method**, and that the JSON actually deserializes into `ChargeResult` through the real
message converters. Those three are most of the bugs an HTTP client has.

## Route B · The Boot slice, `@RestClientTest`

When the client needs the application's own Jackson configuration — a custom
`JacksonModule`, a naming strategy, a serializer for `Money` — use the slice, which builds
the context with exactly that and nothing else.

🔴 **In Boot 4 the annotation moved package.** It is
`org.springframework.boot.restclient.test.autoconfigure.RestClientTest`, not
`org.springframework.boot.test.autoconfigure.web.client.RestClientTest`. Every import line
in every pre-Boot-4 article is stale. Its javadoc:

> *"Annotation for a Spring rest client test that focuses **only** on beans that use
> `RestTemplateBuilder` or `RestClient.Builder`."*

> *"By default, tests annotated with `RestClientTest` will also auto-configure a
> `MockRestServiceServer`. For more fine-grained control the
> `@AutoConfigureMockRestServiceServer` annotation can be used."*

```java
@RestClientTest(HttpPaymentGateway.class)
@EnableConfigurationProperties(PaymentProperties.class)
class HttpPaymentGatewaySliceTest {

    @Autowired HttpPaymentGateway gateway;
    @Autowired MockRestServiceServer server;

    @Test
    void serialisesMoneyTheWayTheApplicationDoes() {
        server.expect(requestTo("https://pay.example.com/v1/charges"))
              .andExpect(jsonPath("$.amount").value(9000))
              .andRespond(withSuccess("{\"id\":\"ch_1\",\"status\":\"succeeded\"}",
                      MediaType.APPLICATION_JSON));

        gateway.charge(aCharge().minorUnits(9000).build());

        server.verify();
    }
}
```

The slice's component scanning is deliberately tiny. Its javadoc says scanning is *limited*
to `@JacksonComponent` beans (and the deprecated `@JsonComponent`) plus `JacksonModule`
implementations — so a `@Service` the gateway happens to need is **not** in the context, and
you name the class under test in the annotation's `value`/`components` attribute or import
it.

## Where this connects

- What actually got swapped, what that means the test cannot catch, and the
  expectation/ordering/count API in full:
  [03a · What the mock server does and does not run](03a-what-the-mock-server-does-not-run.md).
- When you need an actual socket, and how to choose the tool:
  [03b · WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md).
- The failure responses that are worth stubbing:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Asserting the *outgoing* request rather than the response:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- The service-level test, one boundary up: [02](02-mocking-a-class-you-own.md).
- Why mocking `RestClient` itself is the wrong altitude:
  [01a](01a-the-four-failure-modes.md).
- **Topic 05 · The test pyramid** owns slice choice and the context cache;
  **topic 08 · Test data patterns** owns the `aCharge()` builder.

## Gotchas

**★ Binding to a builder and then building the client from a *different* builder is the commonest way this test fails, and the error message does not say so.**
`RestClient.Builder` methods return a builder, and `RestClient.builder().baseUrl(x)` may or may not be the same instance you bound. The safe pattern is: create the builder, bind the server to *that* reference, then hand *that same reference* to the class under test and let the class do its own `baseUrl(...).build()`. When you get it wrong the symptom is a real outbound connection attempt or an `AssertionError` from `verify()` saying zero of one expected requests were performed — neither of which points at the binding.

**★ A class that takes a built `RestClient` instead of a `RestClient.Builder` has no seam for this technique at all.**
There is no `bindTo(RestClient)`. If the constructor signature is `HttpPaymentGateway(RestClient http)`, your options are: change the signature (do this), or fall back to a real socket with WireMock or `MockWebServer` ([03b](03b-wiremock-and-mockwebserver.md)). Taking the builder is also the better production design, because it is how the client picks up the application's customizers.

**★ `@RestClientTest` does not scan your `@Service` beans, and the failure is a `NoSuchBeanDefinitionException` that reads like a misconfiguration.**
The javadoc is explicit that component scanning is limited to Jackson component and module beans. Name the class under test in the annotation — `@RestClientTest(HttpPaymentGateway.class)` — and supply anything else with `@Import`, a nested `@TestConfiguration`, or `@MockitoBean`. This is exactly the same rule `@WebMvcTest` has, and it surprises people the second time as reliably as the first.

**★ In Boot 4, `@RestClientTest` and `@AutoConfigureMockRestServiceServer` live in `org.springframework.boot.restclient.test.autoconfigure`, and `MockServerRestClientCustomizer` in `org.springframework.boot.restclient.test`.**
Boot 4 split the monolithic autoconfigure module into per-technology modules and the test slices moved with them. An IDE will offer you the old package from a stale index or a cached dependency and the code will not compile; worse, on a mixed classpath it may compile against an old Boot 3 jar and behave oddly. Check the import, not the annotation name.

## Interview questions

**★ A colleague shows you a test that mocks `RestClient` with four chained stubs. What do you replace it with, concretely?**
Two tests, because the one test they wrote is trying to be both. If the class under test is the *service* that uses the gateway, I mock our own `PaymentGateway` interface — one method, three outcomes, no fluent API in sight. If the class under test is the *gateway itself*, I bind a `MockRestServiceServer` to the `RestClient.Builder` that the gateway is constructed from, stub the response with `withSuccess(json, APPLICATION_JSON)`, and assert both the mapped result and the outgoing request. The concrete win is that the second test can catch a wrong URL, a wrong HTTP method, a missing header and a broken JSON mapping, all of which the four-stub version passes with flying colours because it never builds a request at all.

**★ Why does the class take `RestClient.Builder` rather than `RestClient`?**
Because the builder is the seam. `MockRestServiceServer.bindTo` accepts a `RestClient.Builder` or a `RestTemplate`; there is no overload for a built `RestClient`, so a constructor that takes the finished client has no in-process test route left and forces you to a real socket. It is also the better production shape: Boot auto-configures a prototype `RestClient.Builder` that already carries the application's message converters, observation instrumentation and any registered `RestClientCustomizer`, so accepting the builder means the client inherits all of that instead of re-declaring it.

**★ When do you use `@RestClientTest` and when do you use plain JUnit with a hand-built builder?**
Plain JUnit whenever the test is about the URL, the method, the headers, the body and the error mapping — which is most of the time. It is the fastest possible form: no Spring context, no cache entry, and the failure messages are shorter. I reach for `@RestClientTest` when the correctness of the test depends on the application's own JSON configuration — a custom module, a naming strategy, a serializer for a value type like `Money` — because a hand-built `RestClient.builder()` uses default converters and would let a serialization bug through. The slice is also the right answer when the client is assembled by configuration rather than by a constructor I can call.

{/* FOOTER */}
