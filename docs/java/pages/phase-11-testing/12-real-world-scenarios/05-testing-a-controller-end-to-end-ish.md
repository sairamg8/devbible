---
title: "The controller slice is Java's React Testing Library render: a real request goes in, real JSON comes out, and everything below the service interface is a mock — which makes the interesting question not how to write it but exactly where the slice's edge falls"
sidebar_label: "05 · A controller, end-to-end-ish"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** javadoc for `@WebMvcTest`
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.html))
> — 🔴 package `org.springframework.boot.webmvc.test.autoconfigure`, **since 4.0.0**, not
> the Boot 3 location — the **Spring Framework 7.0.8** `RestTestClient` reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/resttestclient.html)),
> and the `@MockitoBean` javadoc for `REPLACE_OR_CREATE`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/bean/override/mockito/MockitoBean.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**If you have written React tests, you already know the shape of this one. `render` the
component for real, mock the network module, then assert on what the user sees. The Java
version renders a controller through the real `DispatcherServlet`, mocks the service, and
asserts on the JSON. The mechanics belong to **topic 06 · MockMvc**. What this page is
about is the part nobody writes down: precisely which of your production wiring is inside
the slice, which is outside, and therefore which class of production bug this test can and
cannot catch.**

## The analogy, and where it stops

```jsx
// React Testing Library
jest.mock('./api');
api.fetchOrder.mockResolvedValue({ id: 42, total: '25.00', status: 'PAID' });

render(<OrderPage orderId={42} />);

expect(await screen.findByText('£25.00')).toBeInTheDocument();
```

```java
// Spring MVC, the same test
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvcTester mvc;
    @MockitoBean OrderService orders;

    @Test
    void anExistingOrderIsReturnedAsJson() {
        when(orders.findById(new OrderId(42)))
                .thenReturn(Optional.of(anOrder().paid().totalling("25.00").build()));

        assertThat(mvc.get().uri("/orders/{id}", 42))
                .hasStatusOk()
                .bodyJson().extractingPath("$.total").isEqualTo("25.00");
    }
}
```

**What transfers exactly.** You are running the real thing, not a stub of it: the real
routing, the real binding, the real serializer, the real error handling. You mock at one
boundary — the module that talks to the outside — and you assert on the artefact a consumer
sees, not on internal state. Both tests fail if you rename a field, change a route, or
break serialization, which is exactly what you want.

**Where the analogy stops, and it matters three ways:**

1. **There is no DOM and no user.** RTL's whole discipline is "query the way a user would".
   There is no equivalent here, because your consumer is a program, and it reads the field
   `total` at the JSON path `$.total`. That means Java's version of `getByRole` is *the
   JSON contract itself* — which is why [10 · JSON contracts](10-json-contracts-and-approval-tests.md)
   is a separate scenario rather than a footnote.
2. **There is no server.** `MockMvc` does not open a socket. There is no HTTP parsing, no
   `Content-Length` negotiation, no chunked encoding, no reverse proxy. **Topic 06 ·
   MockMvc** owns that argument in full; the consequence for *this* page is in the
   boundary table below.
3. **`jest.mock` is a module-level lie; `@MockitoBean` is a container-level one.** Jest
   replaces a module for the file. `@MockitoBean` replaces — or, dangerously, *creates* — a
   bean in a Spring context that is then cached and shared with other test classes. That
   difference produces two real failure modes that have no React equivalent, both in the
   gotchas below.

## Where the slice's edge actually falls

This is the part worth memorising, because almost every "but the test passed" conversation
about a controller is really a disagreement about this table. The javadoc for `@WebMvcTest`
in Boot 4.1 states that component scanning is limited to beans annotated with `@Controller`,
`@ControllerAdvice`, `@JacksonComponent` (and the deprecated Jackson 2 `@JsonComponent`), as
well as beans implementing `Converter`, `GenericConverter`, `Filter`,
`FilterRegistrationBean`, `DelegatingFilterProxyRegistrationBean`, `ErrorAttributes`,
`HandlerInterceptor`, `HandlerMethodArgumentResolver`, `HttpMessageConverter`,
`JacksonModule`, `SecurityFilterChain`, `WebMvcConfigurer`, `WebMvcRegistrations` and
`WebSecurityConfigurer`.

| Inside the slice — a bug here fails the test | Outside — a bug here does not |
|---|---|
| Route matching, path variables, request params | The servlet container itself (Tomcat, Netty) |
| `@RequestBody` deserialization and `@ResponseBody` serialization | A custom `ObjectMapper` defined in a plain `@Configuration` |
| `@Valid` and every Bean Validation constraint | Any `@Service`, `@Component` or `@Repository` |
| `@ControllerAdvice` / `@ExceptionHandler` | `@ConfigurationProperties` beans |
| `HandlerInterceptor`s and `Filter`s declared as beans | Filters registered outside Spring |
| Your `SecurityFilterChain` — security **is** in the slice | Real TLS, CORS as a browser performs it |
| `Converter`/`GenericConverter` for path and param types | Anything the database does |
| Content negotiation and `HttpMessageConverter`s | HTTP framing, `Content-Length`, streaming |

Two entries surprise people every time.

**Security is inside.** `SecurityFilterChain` and `WebSecurityConfigurer` are on the scan
list, so your real authorisation rules apply to the slice. An unauthenticated request gets
whatever your chain does to unauthenticated requests, which is usually a 401 or a redirect,
and your happy-path test fails with a status you did not expect until you authenticate it.
That is not a nuisance — it is the slice correctly telling you the endpoint is protected.
[06 · Security in a test](06-security-in-a-test.md) is the whole scenario.

**A custom `ObjectMapper` may be outside.** If you configure Jackson with a
`Jackson2ObjectMapperBuilderCustomizer` or a `JacksonModule` bean, it is picked up. If you
declare a bare `@Bean ObjectMapper` in a `@Configuration` class that is not on the scan
list, it is *not*, and the slice serializes with Boot's default while production serializes
with yours. Dates are where you find out: `2026-08-31` in production, an epoch number in
the test, and the assertion you wrote passes.

## Where this connects

- **Topic 06 · MockMvc** owns `@WebMvcTest`, `MockMvcTester` and the classic API, request
  building, JSON assertions, validation errors, `@ControllerAdvice` and the real-port
  crossing. This page assumes all of it and spends its words on the boundary.
- **Topic 05 · The test pyramid** owns slice choice, the context cache, and
  `@MockitoBean`/`@TestBean` as mechanisms.
- What to assert once you have the slice, and the four things "end-to-end-ish" excludes,
  are in [05b · The three assertions](05b-the-three-assertions-and-the-hedge.md).
- Authenticating the request, and the 401 test nobody writes, is
  [06 · Security in a test](06-security-in-a-test.md).
- Pinning the JSON the controller emits, rather than asserting field by field, is
  [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md).
- **Fork C's 01 · What to mock and what to let run** is the general form of the decision
  this page makes at one specific boundary.

## Gotchas

**★ `@WebMvcTest` moved package in Boot 4, and every sample on the internet has the old one.**
It is `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`, **since 4.0.0** —
not `org.springframework.boot.test.autoconfigure.web.servlet`. If you are migrating, the
import is a compile error rather than a silent misbehaviour, which is the good case, but it
means the first thing to check when a copied snippet does not compile is the import, not the
annotation's attributes.

**★ Your happy-path test starts returning 401 the day someone adds Spring Security, and the
fix is not `@AutoConfigureMockMvc(addFilters = false)`.**
Security is inside the slice by design — `SecurityFilterChain` is on the scan list. Turning
the filters off makes the test pass by removing the protection you are shipping, and the
day the rule is wrong nothing tells you. Authenticate the request instead; see
[06](06-security-in-a-test.md).

**★ A bare `@Bean ObjectMapper` is invisible to the slice, so date formats differ between
test and production.**
The scan list includes `JacksonModule` and `@JacksonComponent` but not arbitrary
`@Configuration` classes. If your date format, naming strategy or null-inclusion policy is
set on a hand-built `ObjectMapper`, the slice does not see it. The symptom is the worst
kind: the test asserts a format that is correct for the test and wrong for production. Move
the configuration to a `Jackson2ObjectMapperBuilderCustomizer` or a `JacksonModule` bean,
which the slice does pick up.

**★ Boot 4 is on Jackson 3, so the annotation on the scan list is `@JacksonComponent` and
`@JsonComponent` is the deprecated Jackson 2 name.**
The `@WebMvcTest` javadoc lists both, with the Jackson 2 pair — `@JsonComponent` and
`Module` — marked deprecated, alongside their Jackson 3 replacements `@JacksonComponent`
and `JacksonModule`. A serializer still annotated `@JsonComponent` may be scanned but
registered against a Jackson 2 `ObjectMapper` that nothing else in a Boot 4 application
uses, which produces a serializer that is present, scanned, and never invoked. Check the
annotation before you spend an afternoon on why your custom serializer does nothing.

**★ `@WebMvcTest` with no argument loads every controller in the application, and the
context is a different one from the single-controller version.**
Both work, but they are different context cache keys, so a codebase that mixes them pays
for two contexts, and the no-argument form drags in every `@ControllerAdvice` and every
controller's dependencies — each of which then needs a `@MockitoBean` or the context fails
to start. Name the controller. **Topic 05 · The test pyramid** owns the cache-key argument.

**★ The slice runs your `@ControllerAdvice`, so a test that expects a 500 may get your
custom error payload instead — and that is the advice working.**
People write `.hasStatus(500)`, get a 400 with a problem-detail body, and conclude the test
is broken. It is not: the advice mapped the exception. The right assertion is on the
contract you publish, which is the status *and* the error body shape. **Topic 06 ·
MockMvc** owns exception-handler testing in depth.

## Interview questions

**★ What exactly does a `@WebMvcTest` cover that a plain unit test of the controller class
does not?**
Everything Spring MVC does *around* the method: route matching, path-variable and
request-param conversion, `@RequestBody` deserialization by the real message converters,
Bean Validation on `@Valid` arguments, content negotiation, `@ControllerAdvice` exception
mapping, registered `HandlerInterceptor`s and `Filter`s, and your `SecurityFilterChain`.
Calling `controller.getOrder(42)` directly in a test skips all of it, which means it cannot
catch a wrong `@RequestMapping` path, a DTO field that does not match the JSON, a missing
`@Valid`, or an endpoint you forgot to protect. That is a large class of the bugs that
controllers actually have, which is why the slice earns its cost even though it starts a
Spring context.

**★ Is security inside or outside a `@WebMvcTest`, and how do you know?**
Inside. The javadoc's scan list for `@WebMvcTest` includes `SecurityFilterChain` and
`WebSecurityConfigurer`, so your real authorisation rules apply. You can confirm it
empirically without reading the javadoc: add Spring Security to a project with an existing
green controller slice and the slice turns red with a 401. The important corollary is that
`addFilters = false` "fixes" that by deleting the protection from the test, which converts
your best security test into no security test, so the correct response is to authenticate
the request rather than to disable the chain.

**★ How do you work out what is inside a slice without guessing?**
Read the slice annotation's javadoc — it lists the scanned annotations and interfaces
explicitly, and that list is the definitive answer rather than folklore. When the javadoc
does not settle it, the empirical check is to print the bean names from the test's
`ApplicationContext` and look for the bean you expect; a bean that is absent is a bean whose
behaviour the slice cannot exercise. The failure mode this avoids is the reasoning-by-vibe
argument in code review about whether "filters run in a `@WebMvcTest`", which has a written
answer.

**★ How is this different from what a React developer does, and is either better?**
Structurally it is the same test — render the real unit, mock the boundary, assert on the
consumer-visible output — and neither is better; they are testing different consumers. RTL
pushes you towards querying as a human would because the consumer is a human. The Spring
slice's consumer is another program, so the equivalent discipline is asserting against the
published contract: the status code, the media type, the JSON paths a client actually reads.
The one habit worth importing wholesale from the JS side is asserting on the arguments the
mocked boundary received — `expect(api.fetchOrder).toHaveBeenCalledWith(42)` is
`ArgumentCaptor`, it catches binding bugs nothing else catches, and it is under-used in
Java.

{/* FOOTER */}
