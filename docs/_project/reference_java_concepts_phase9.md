---
name: reference-java-concepts-phase9
description: Load-bearing claims and their sources from devbible Java Phase 9 (Spring Boot and the web, 16 topics) — including three corrections to Boot 4 property names that every online sample gets wrong
metadata:
  type: reference
---

# Java Phase 9 · Spring Boot and the web — concepts and sources

Written 2026-08-20, session `885d2430`. 16 topics, 209 files, 51,348 lines.
Target: **Spring Boot 4.1.0** on **Spring Framework 7.0**, Jakarta EE 11, Jackson 3,
JDK 25. No sandbox — everything documentation-validated. See
[[progress-java-python-syllabus]].

## 🔴 Boot 4 facts that contradict almost every sample online

- `spring-boot-starter-web` → **`spring-boot-starter-webmvc`**; `-aop` → `-aspectj`;
  new `-restclient` / `-webclient` starters. Validation is **no longer transitive**.
- `@MockBean` / `@SpyBean` **REMOVED** → `@MockitoBean` / `@MockitoSpyBean`.
- `Jackson2ObjectMapperBuilderCustomizer` → `JsonMapperBuilderCustomizer`;
  `@JsonComponent` → `@JacksonComponent`.
- **`RestTemplate` is DEPRECATED** (formal in 7.1). `RestClient` is the sync default.
- Framework 7 **removed** Undertow support, `spring-jcl`, `javax.annotation`,
  `ListenableFuture`; **added** first-class API versioning, `@Retryable`,
  `@ConcurrencyLimit`, `@EnableResilientMethods`, `BeanRegistrar`,
  `@ImportHttpServices`. JSpecify replaces JSR 305.

## 🔴 Three corrections found while writing topic 12 — do NOT re-derive

1. **`spring.http.client.*` is wrong for Boot 4 — it is `spring.http.clients.*`, and
   the rename is NOT uniform.** `spring.http.client.connect-timeout` →
   `spring.http.clients.connect-timeout`, but `spring.http.client.factory` →
   `spring.http.clients.`**`imperative`**`.factory`. A blanket search-and-replace
   breaks the factory property.
2. **`ClientHttpRequestFactorySettings` does not exist in Boot 4.1** — it is
   **`HttpClientSettings`**. Confirmed absent from the 4.1
   `org.springframework.boot.http.client` package listing. Its presence in a sample
   is a reliable Boot-3 tell.
3. **`@Retryable` uses `maxRetries`, not Spring Retry's `maxAttempts`**, and total
   attempts = **1 + `maxRetries`**.

## 🔴 springdoc — and its own README is wrong

- **springdoc-openapi 3.1.0** (2026-08-01), release notes *"Upgrade Spring Boot to
  version 4.1.0"*, build parent `spring-boot-starter-parent:4.1.0` per the published
  POM. The 3.x line began at **3.0.0** (2025-11-21) for Boot 4.0. **2.9.0** is the
  maintained Boot 3.5.x line. Artifact ids unchanged
  (`springdoc-openapi-starter-{webmvc,webflux}-{api,ui}`).
- ⚠️ **springdoc's own `README.md` on `main` still says *"For Spring-boot v4 support,
  make sure you use springdoc-openapi v2"* and *"Java 17 & Jakarta EE 9"* — both
  stale.** A reader following the project front page pins the wrong major version.
  The release notes and POMs are the authority.

## Validation (topic 08)

- `LocalValidatorFactoryBean.setValidationMessageSource(MessageSource)` — javadoc:
  *"instead of relying on JSR-303's default `ValidationMessages.properties` bundle"*.
  🔴 The `MessageSource` **must not** use `useCodeAsDefaultMessage`, or Hibernate's
  own default messages stop resolving. Specify **either** this **or**
  `messageInterpolator`, never both.
- Code resolution: `Size.person.name` → `Size.name` → `Size.java.lang.String` →
  `Size`. ⚠️ **Message argument order is field-name, MAX, MIN.**
  `DefaultMessageCodesResolver` defaults to `Format.PREFIX_ERROR_CODE`.
- Hibernate Validator `ExpressionLanguageFeatureLevel` (since 6.2):
  `NONE` / `VARIABLES` / `BEAN_PROPERTIES` / `BEAN_METHODS` (*"can lead to serious
  security issues, including arbitrary code execution"*). 🔴 **Default is
  `BEAN_PROPERTIES` for constraint messages and `NONE` for custom violations**
  (HV-1816) — because custom-violation templates get built from user input.
- Three exceptions come out of failed validation and **the method signature decides
  which**: `MethodArgumentNotValidException` (level 1, parameter validation),
  `HandlerMethodValidationException` (level 2, method validation — the reference says
  it *"supersedes"* level 1), `ConstraintViolationException` (AOP `@Validated`, maps
  to nothing, so 500 unless handled).

## Error handling (topic 09) — where `@ControllerAdvice` does NOT run

- **A servlet `Filter`'s exception never reaches `@ControllerAdvice`** — the chain is
  outside `DispatcherServlet`, so `HandlerExceptionResolver` is never consulted.
- Boot's `/error` fallback (`BasicErrorController`, `ErrorAttributes`,
  `ErrorViewResolver`, `server.error.*`). ⚠️ *"the default `FilterRegistrationBean`
  does not include the `ERROR` dispatcher type"*.
- Async: `Callable` / `DeferredResult` / `WebAsyncTask`, `AsyncRequestTimeoutException`
  (503), `AsyncRequestNotUsableException`. The async request-timeout default is
  container-specific by definition.
- **After the status line is committed the response cannot be changed** —
  `handleExceptionInternal` javadoc says the return is *"possibly `null` when the
  response is already committed"*. `ProblemDetail` cannot save you there.

## Actuator (topic 13)

- 🔴 **`heapdump` hands an attacker every secret in memory over one HTTP GET.** Boot
  **3.5 release notes**: *"The `heapdump` actuator endpoint now defaults to
  `access=NONE`"*. Wiz's survey (vendor research, attributed as such) found heapdump
  publicly reachable on 2.3% of exposed deployments and `/env` on 4%.
- The Boot 3.4+ **`access`** model (`management.endpoint.<id>.access`,
  `management.endpoints.access.default` / `max-permitted`) replaced `enabled`.
- **Client-side percentiles are NOT aggregatable across instances**; percentile
  **histograms** ship buckets a backend can aggregate. That distinction is the whole
  reason `percentiles-histogram` exists.
- Sanitisation is `show-values` + a `SanitizingFunction` bean; `keys-to-sanitize` is
  the older, replaced approach.

## Request pipeline (topic 10)

- The three mechanisms differ in what each can **see** (filter: raw bytes; interceptor:
  the resolved handler; AOP: typed arguments), what each can **change** (only a filter
  can wrap request/response — and a servlet body can be read **once**, which is why
  request logging needs `ContentCachingRequestWrapper`), and how each **fails**.
- `postHandle` is useless once a `@ResponseBody` handler has written the body.
- Boot already registers most of what people hand-write: Security's
  `DelegatingFilterProxy` → `FilterChainProxy`, `CharacterEncodingFilter`,
  `ForwardedHeaderFilter`, `FormContentFilter`, `RequestContextFilter`,
  `ShallowEtagHeaderFilter`, `ServerHttpObservationFilter`.

## The alternatives (topic 16)

- The trade is **flexibility for startup and footprint**: Spring wires at runtime
  (scanning, reflection, proxies); Quarkus/Micronaut wire at build time.
- The honest counter: **Spring AOT, CDS, and Leyden's AOT cache** closed much of the
  gap without leaving the JVM. JEP 483 (JDK 24, AOT class loading & linking) and
  JEP 515 (JDK 25, AOT method profiling).
- 🔴 **No benchmark numbers were used** beyond two attributed JEP figures. Vendor
  self-benchmarks (Helidon's homepage) were deliberately excluded.

## Standing lesson — inherited repoint tables

🔴 **Four of the seven agents found errors in the repoint tables they were handed.**
The recorded table for topic 08 was already known-wrong in 3 places; agents found
**5 more** there, **2** in topic 09, and **4** in topic 13 — including cases where the
link *text* was wrong, not just the target, and cases where one link had to become
two because the sentence named two failure modes. **Never apply a repoint table
without reading each link in its sentence.** See [[feedback-never-compress-to-fit-cap]].
