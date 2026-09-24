---
name: research-java-p11-t06-mockmvc
description: Verified Spring Framework 7.0 / Boot 4.1 / Security 7.1 research for devbible Java Phase 11 topic 06 MockMvc — settles MockMvcTester vs the classic API and exactly what @WebMvcTest does to Spring Security. Read before writing topic 06 chunks 02-10.
metadata:
  type: project
---

# Java P11 T06 · MockMvc research — verified 2026-08-28

Gathered by an authoring fork before it was wound down at the 3-agent ceiling. **Chunks 02–10
and the index are UNWRITTEN; this is their source material.** Chunks `01-no-socket-no-server`
(229) and `01b-the-blank-request` (162) are on disk. **Next `sidebar_position` is 3** — the
plan's `02-webmvctest.md` takes 3 and everything after shifts by one.

## 🔴 A correction to what I put in the dispatch brief

I told the fork *"`MockMvcTester` is the current idiom … teach that first"*. **That
overstates what the Framework reference says**, and the fork checked rather than complying:

**The Framework 7.0 reference does not deprecate the classic API and does not declare a
winner. It presents both as front ends on the same engine, and names the classic one first:**

> *"MockMvc can be used on its own to perform requests and verify responses using Hamcrest or
> through `MockMvcTester` which provides a fluent API using AssertJ."*

The page tree is `mockmvc/` → `overview`, `setup-options`, **`hamcrest/`** (8 pages),
**`assertj/`** (4 pages), `htmlunit/`, `vs-end-to-end-integration-tests`. Hamcrest comes first
and has more pages.

**But the Boot 4.1 reference is a different story, and it is the one that decides house
style.** Every MockMvc example in Boot's `testing/spring-boot-applications.html` and
`how-to/testing.html` is now `MockMvcTester` + `assertThat(...)`. Boot auto-configures both —
`@AutoConfigureMockMvc` javadoc (v4.1.1): *"If AssertJ is available a `MockMvcTester` is
auto-configured as well."*

🔴 **So the accurate sentence for chunk 03 is:** the Framework reference documents both as
peers; the **Boot** reference has switched all of its own examples to `MockMvcTester`, and it
is the newer API (`@since 6.2`). Do **not** write "the reference presents it as current".

Three reasons the AssertJ page gives for existing, verbatim:
> *"There is no need to use static imports as both the requests and assertions can be crafted
> using a fluent API. · Unresolved exceptions are handled consistently so that your tests do
> not need to throw (or catch) `Exception`. · By default, the result to assert is complete
> whether the processing is asynchronous or not."*

`MockMvcTester` javadoc: *"an unresolved exception is not thrown directly … Rather an
`MvcTestResult` is available with an unresolved exception"* and *"Any attempt to access the
result with an unresolved exception will throw an `AssertionError`."*

Quotable error strings from `MvcTestResultAssert` (7.0.9 source — real, not fabricated):
`"Expected request to fail, but it succeeded"`, `"Expected request to succeed, but it failed"`,
`"%nRequest failed unexpectedly:%n%s"`. Async default: *"The default timeout is 10 seconds but
it can be controlled on a request-by-request basis"* — `exchange(Duration)`; `asyncExchange()`
opts out.

## 🔴 Does `@WebMvcTest` auto-configure Spring Security on Boot 4.1? YES

Source-verified, not inferred. `WebMvcTest.java` at tag `v4.1.1`:
> *"By default, tests annotated with `@WebMvcTest` will also auto-configure Spring Security and
> `MockMvc`."*

Boot reference: *"If Spring Security is on the classpath, `@WebMvcTest` will also scan
`WebSecurityConfigurer` beans. Spring Security is **not disabled** automatically."*

Mechanism, from `spring-boot-security-test`'s
`META-INF/spring/org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc.imports`:
`SecurityAutoConfiguration`, `UserDetailsServiceAutoConfiguration`,
`SecurityFilterAutoConfiguration`, `ServletWebSecurityAutoConfiguration`,
`SecurityMockMvcAutoConfiguration`.

Boot's **default** chain (`ServletWebSecurityAutoConfiguration`, v4.1.1) — *"If the user
specifies their own `SecurityFilterChain` bean, this will back-off completely."*
```java
http.authorizeHttpRequests((requests) -> requests.anyRequest().authenticated());
http.formLogin(withDefaults());
http.httpBasic(withDefaults());
```

### The four consequences chunk 08 must get right

1. 🔴 **401 vs 302 is decided by content negotiation, not chance.**
   `HttpBasicConfigurer.registerDefaults` (Security 7.1.1) registers
   `BasicAuthenticationEntryPoint` behind an `OrRequestMatcher` of `X-Requested-With:
   XMLHttpRequest`, a "REST but not HTML" media matcher, **and an `allMatcher` with
   `setUseEquals(true)` on `MediaType.ALL`**. Form login's `LoginUrlAuthenticationEntryPoint`
   sits behind `xhtml/image/text-html/text-plain` with `MediaType.ALL` **ignored**. A bare
   `MockMvc` request sends **no `Accept` header** → `HeaderContentNegotiationStrategy` resolves
   `*/*` → matches basic's `allMatcher` → **401**. Add `.accept(TEXT_HTML)` and the identical
   request becomes a **302 to `/login`**. That is the real answer to "the 401 that surprises
   everyone", and why the status flips when someone adds an `Accept` header.
2. **CSRF is on.** `HttpSecurityConfiguration.httpSecurity()` applies `.csrf(withDefaults())`
   first, so a `POST` in the slice is **403** unless the test uses
   `SecurityMockMvcRequestPostProcessors.csrf()`. Security's doc: *"When testing any non-safe
   HTTP methods and using Spring Security's CSRF protection, you must include a valid CSRF
   Token in the request"* — `post("/").with(csrf())`, `csrf().asHeader()`,
   `csrf().useInvalidToken()`.
3. 🔴 **Your production `SecurityConfig` is almost certainly NOT loaded into the slice, and
   the docs' wording hides it.** `spring-boot-security-test` contributes `WebMvcTest.includes`
   listing `WebSecurityConfigurer`, `WebSecurityCustomizer`, `SecurityFilterChain`. But
   `AnnotationCustomizableTypeExcludeFilter.isTypeOrAnnotated` (v4.1.1) matches with
   `AnnotationTypeFilter` **or `AssignableTypeFilter` against the scanned class itself**. A
   `@Configuration class SecurityConfig` that *declares a* `@Bean SecurityFilterChain` is **not
   assignable to** `SecurityFilterChain`, so it is filtered out — the include only ever fired
   for the old `WebSecurityConfigurerAdapter` style where the class implemented the interface.
   **Net effect on Boot 4.1: the slice runs Boot's default chain, not yours, unless you
   `@Import(SecurityConfig.class)`.**
   ⚠️ **State this carefully.** It follows from the type-exclude filter source; the Boot
   reference and the `@WebMvcTest` javadoc both still read as though the chain is picked up.
   Present it as "verified from the type-exclude filter source, contradicted by no doc
   sentence but stated by none either" — do not assert it as documented.
4. **You do NOT need `apply(springSecurity())` in a Boot slice.**
   `SecurityMockMvcAutoConfiguration` registers a `MockMvcBuilderCustomizer`
   (`@ConditionalOnBean(name = "springSecurityFilterChain")`) applying
   `testSecurityContext()`, so `@WithMockUser` flows through. The manual
   `.apply(springSecurity())` in Security's own docs is for plain `spring-test`, not Boot.

**The hinge between chunks 08 and 09**, from Security's docs: *"`@WithMockUser`,
`@WithUserDetails`, and `@WithSecurityContext` populate the `SecurityContextHolder` for the
test thread. This cannot apply to full HTTP requests a test makes to a running server since
those requests are handled by a different thread. For end-to-end HTTP tests, authenticate the
request itself."*

## 🔴 FIVE CORRECTIONS, established 2026-08-30 while writing chunk 07 — source-verified at `v7.0.9`

The authoring fork checked my dispatch brief against the source rather than complying, and the
brief was wrong five times. **The written pages follow the source.** Do not "fix" them back.

1. 🔴 **`ResponseStatusException` EXTENDS `ErrorResponseException`** — it is a subclass, not a
   sibling: `ResponseStatusException extends ErrorResponseException implements ErrorResponse`.
   This inverts the consequence. `ResponseEntityExceptionHandler` maps `ErrorResponseException.class`
   and matching is `mapped.isAssignableFrom(thrown)`, so a plain `ResponseStatusException` **IS**
   caught by any `ResponseEntityExceptionHandler` subclass and by Boot's
   `ProblemDetailsExceptionHandler`. Only with neither present does it fall through to
   `ResponseStatusExceptionResolver`. Four-row table in `07e`.
2. **`@ControllerAdvice` ordering has two carve-outs the javadoc states and most write-ups miss:**
   `PriorityOrdered` gets **no** precedence over `Ordered`, and `Ordered` is **not honoured at all**
   for scoped advices.
3. 🔴 **The ordering problem that actually bites is Boot's, not yours.**
   `ProblemDetailsExceptionHandler` is registered with `@Order(0)` **on the `@Bean` factory
   method** — step 2 of `ControllerAdviceBean.getOrder()`, therefore honoured. With
   `spring.mvc.problemdetails.enabled=true`, Boot's advice **outranks every unordered advice you
   wrote**, for twenty exceptions. Far commoner than the unordered-tie case.
4. 🔴 **`ResponseStatusExceptionResolver.applyStatusAndReason` also calls `response.sendError(...)`.**
   So `@ResponseStatus` on an exception class has the **same** empty-body-in-a-slice problem as
   `@Valid` — the same call, not a different behaviour. My brief framed them as distinct.
5. 🔴 **`ErrorMvcAutoConfiguration` IS inside the `@WebMvcTest` slice** (`AutoConfigureWebMvc.imports`,
   Boot 4.1.1). `BasicErrorController` and `DefaultErrorAttributes` are beans there — `/error` is
   **unreachable via error dispatch, not absent**. And `DefaultErrorAttributes` is itself a
   `HandlerExceptionResolver` at `HIGHEST_PRECEDENCE`, which is why `@Autowired
   HandlerExceptionResolver` is ambiguous by type in a slice.

**The load-bearing quote for advice ordering**, `ControllerAdvice.java` @ `v7.0.9`:
> *"a cause match on a higher-priority advice will still be preferred over any match (whether root
> or cause level) on a lower-priority advice bean."*

### ⚠️ Three things NOT settled — written into the pages as uncertain, do not "resolve" them by guessing

- **Which of `NoHandlerFoundException` / `NoResourceFoundException` an unmatched path raises by
  default on Boot 4.1**, given resource handling and `spring.mvc.throw-exception-if-no-handler-found`.
  The pages say to read it off `result.getResolvedException()` rather than assume.
- **What `HandlerMethod.getBeanType()` returns for a JDK-proxied controller.**
  `ExceptionHandlerExceptionResolver` fixes the type up to the target class *after* the
  controller-local lookup, so the local lookup's behaviour on a proxy is not settled by the source.
- **Whether tie order among unordered standalone advices is contractual.** Only that `@Order`/
  `Ordered` on the class is honoured is claimed.

## Links verified from this topic

`../../phase-9-spring-boot/10-the-request-pipeline/01-the-full-path.md` ·
`../../phase-9-spring-boot/07-rest-controllers/01-the-controller-and-the-pipeline.md`
🔴 Note the `../../` — from inside a topic directory, phase-9 and phase-10 are two levels up.
The one-level form resolves silently in a README index and ships a 404. Same defect recorded
in [[research-java-p11-t05-spring-test-context]].

## Sources read

`docs.spring.io/spring-framework/reference/testing/mockmvc.html` + `/mockmvc/overview`,
`/setup-options`, `/assertj` (+`setup`,`requests`,`assertions`,`integration`), `/hamcrest`
(+8 pages), `/vs-end-to-end-integration-tests`, cross-checked against asciidoc at tag `v7.0.9`
· `docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html` ·
`docs.spring.io/spring-boot/how-to/testing.html` ·
`docs.spring.io/spring-security/reference/servlet/test/mockmvc/` (`setup`, `authentication`,
`csrf`, `request-post-processors`, `result-matchers`, `http-basic`) at tag `7.1.1` ·
spring-boot sources at `v4.1.1`: `WebMvcTest`, `AutoConfigureMockMvc`, `WebMvcTypeExcludeFilter`,
`SecurityMockMvcAutoConfiguration`, `ServletWebSecurityAutoConfiguration`,
`AnnotationCustomizableTypeExcludeFilter`, and the `.imports`/`.includes` resource files.
