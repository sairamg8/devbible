---
name: research-java-p11-t05-spring-test-context
description: Verified Spring Boot 4.1 / Framework 7.0 test-context research for devbible Java Phase 11 topic 05 — bean overrides, the ten-part context cache key, the 19 relocated slice annotations, webEnvironment, and test transactions. Read before writing topic 05 chunks 03-11.
metadata:
  type: project
---

# Java P11 T05 · Spring test-context research — verified 2026-08-28, DO NOT re-derive

Gathered by an authoring fork from the primary references (URLs at the bottom) before it was
wound down at the 3-agent ceiling. **Topic 05 chunks 03–13 are unwritten; this is their
source material.** Chunks 01 (235 lines) and 02 (259) are on disk and committed.

🔴 **Every pre-Boot-4 sample on the internet is wrong about the first section.**

## Bean overrides — the packages moved into Spring Framework

`@MockBean` and `@SpyBean` are **gone**. Replacements, in **Framework**, not Boot:

- `org.springframework.test.context.bean.override.mockito.MockitoBean`
- `org.springframework.test.context.bean.override.mockito.MockitoSpyBean`
- `org.springframework.test.context.bean.override.convention.TestBean`
- `MockReset` also in `…bean.override.mockito`

Three strategies, verbatim: `REPLACE` *"Replaces the bean. Throws an exception if a
corresponding bean does not exist."* · `REPLACE_OR_CREATE` *"Replaces the bean if it exists.
Creates a new bean if a corresponding bean does not exist."* · `WRAP` *"Retrieves the original
bean and wraps it."* `@MockitoBean`/`@TestBean` use `REPLACE_OR_CREATE`; `@MockitoSpyBean` uses
`WRAP` and **requires exactly one candidate** — it cannot create one.

`@MockitoBean` attributes with defaults: `value`/`name` `""` · `types` `{}` (*"Types must be
omitted when the annotation is used on a field"*) · `contextName` `""` · `extraInterfaces` `{}`
· `answers` `RETURNS_DEFAULTS` · `serializable` `false` · 🔴 `reset` **`MockReset.AFTER`** ·
🔴 `enforceOverride` **`false`** — set `true` to throw instead of silently minting a new bean
when a typo means nothing matched. Selection is by field type; on ambiguity `@Qualifier`, and
*"In the absence of a `@Qualifier` annotation, the name of the annotated field will be used as
a fallback qualifier."*

`@TestBean`: factory method must be `static`, no args, compatible return type; named after the
field or via `methodName`, including cross-class `"org.example.TestUtils#createCustomService"`.

### 🔴 Bean overrides and AOP proxies — almost nothing online covers this

Verbatim: *"Overrides that use the `REPLACE` or `REPLACE_OR_CREATE` strategy (such as
`@TestBean` and `@MockitoBean`) register their override instance directly as a manual
singleton, which bypasses the container's normal bean post-processing. Consequently, the
override instance is a bare object: none of the AOP advice that would otherwise apply to the
original bean (`@Transactional`, `@Cacheable`, `@Retryable`, method security, and so on) is
present."* For `WRAP` the proxy is still created and wraps the override instance.

Consequence the reference spells out: stubbing a `@MockitoSpyBean` **through** a `@Cacheable`
proxy caches the empty value Mockito returns while recording the stub, *"which then
permanently shadows the spy for that combination of arguments"*. Documented fix:
`AopTestUtils.getUltimateTargetObject(dateService)`, then stub the unwrapped spy. `verify()`
is unaffected. `@MockitoSpyBean` **cannot** spy a scoped proxy
(`@Scope(proxyMode = TARGET_CLASS)`) — it throws. Any override converts a non-singleton to a
singleton.

## 🔴 The context cache key — all ten components, verbatim

> *"The TestContext framework uses the following configuration parameters to build the context
> cache key:"* `locations` · `classes` · `contextInitializerClasses` · **`contextCustomizers`**
> *"– this includes `@DynamicPropertySource` methods, bean overrides (such as `@TestBean`,
> `@MockitoBean`, `@MockitoSpyBean` etc.), as well as various features from Spring Boot's
> testing support."* · `contextLoader` · `parent` · `activeProfiles` ·
> `propertySourceDescriptors` · `propertySourceProperties` · `resourceBasePath`

That fourth bullet is the load-bearing sentence for chunk `06b`. And from the `@MockitoBean`
page: *"Qualifiers (including field names) determine if a separate `ApplicationContext` is
needed"* — **two classes mocking the same bean into differently-named fields get two
contexts.**

- Cache is *"bounded with a default maximum size of 32"*, LRU, via
  `spring.test.context.cache.maxSize`.
- *"To view the statistics … set the log level for the `org.springframework.test.context.cache`
  logging category to `DEBUG`."*
- Forking kills it: *"if tests run in separate processes, the static cache is cleared between
  each test execution, which effectively disables the caching mechanism."* (Surefire
  `forkMode` `always`/`pertest`.)
- 🔴 `@TestPropertySource` inlined properties: *"the exact strings you provide will be used to
  determine the key for the context cache … you must ensure that you define inlined properties
  consistently."* — `key = value` vs `key=value` is **two contexts**.
- 🔴 **Context Pausing is NEW in Framework 7.0**, in no Boot 3 material: `PauseMode` is
  `ALWAYS`/`ON_CONTEXT_SWITCH`/`NEVER`, **defaults `ON_CONTEXT_SWITCH`**, property
  `spring.test.context.cache.pause`; `SmartLifecycle` opts out via `isPauseable()`.
- Context failure threshold (6.1+): default `1`, second attempt gets *"an immediate
  `IllegalStateException`"*; `spring.test.context.failure.threshold`.

## 🔴 The slices moved — the plan's list is stale, follow the reference

Boot 4.1's appendix lists **19** slices and adds a **Module** column: each ships in its own
artifact and **its package changed**. `WebMvcTest` → `org.springframework.boot.webmvc.test.autoconfigure`
· `DataJpaTest` → `…boot.data.jpa.test.autoconfigure` · `JdbcTest` → `…boot.jdbc.test.autoconfigure`
· `DataJdbcTest`, `WebFluxTest`, `RestClientTest`, `GraphQlTest`, `JooqTest`, `DataMongoTest`,
`DataRedisTest`, `DataNeo4jTest`, `DataLdapTest`, `DataR2dbcTest`, `DataCassandraTest`,
`DataCouchbaseTest`, `DataElasticsearchTest` all follow the pattern ·
`WebServiceClientTest`/`WebServiceServerTest` → `…boot.webservices.test.autoconfigure.{client,server}`
· `AutoConfigureMockMvc` → `…boot.webmvc.test.autoconfigure` · `AutoConfigureTestDatabase` →
`…boot.jdbc.test.autoconfigure` · `TestEntityManager` → `…boot.jpa.test.autoconfigure`.

Two reconciliations the author **must state explicitly**:
- 🔴 **`@WebClientTest` is new** (`…boot.webclient.test.autoconfigure`, `@since 4.0.0`) —
  *"focuses only on beans that use `WebClient.Builder`"*. Not in the plan.
- 🔴 **`@JsonTest` is absent from the appendix table but still exists**, at the *old* address
  `org.springframework.boot.test.autoconfigure.json.JsonTest` — it stayed in core
  `spring-boot-test-autoconfigure`, which is why the per-module table omits it. Plan and
  appendix are both right.

Slice composition: `@BootstrapWith(<X>TestContextBootstrapper)` + `@ExtendWith(SpringExtension)`
+ `@OverrideAutoConfiguration(enabled=false)` + `@TypeExcludeFilters(<X>TypeExcludeFilter)` +
`@ImportAutoConfiguration`. `@DataJpaTest`/`@JdbcTest` additionally carry **`@Transactional`**
and `@AutoConfigureTestDatabase`. `@WebMvcTest` scans `@Controller`, `@ControllerAdvice`,
`@JacksonComponent`, and implementors of `Converter`, `Filter`, `HandlerInterceptor`,
`HttpMessageConverter`, `SecurityFilterChain`, `WebMvcConfigurer` — its javadoc names
`@MockitoBean` as the intended way to supply collaborators. *"Regular `@Component` and
`@ConfigurationProperties` beans are not scanned when slice test annotations are used"* and
*"Including multiple 'slices' by using several `@…Test` annotations in one test is not
supported."*

🔴 **`@AutoConfigureTestDatabase`'s `replace` defaults to `Replace.NON_TEST`, not `ANY`** —
*"Replace the `DataSource` bean unless it is auto-configured and connecting to a test
database"*, where a Testcontainers `@ServiceConnection` datasource, a Docker Compose
connection and a `@DynamicPropertySource`-backed `spring.datasource.url` all count. So
**`@DataJpaTest` no longer blindly swaps Testcontainers PostgreSQL for H2** — this changes the
classic "it passed on H2" advice and topic 07 must agree with it.

## `@SpringBootTest` webEnvironment — verbatim

`MOCK` (default) *"Creates a `WebApplicationContext` with a mock servlet environment if servlet
APIs are on the classpath, a `ReactiveWebApplicationContext` if Spring WebFlux is on the
classpath or a regular `ApplicationContext` otherwise."* + *"Embedded servers are not
started."* · `RANDOM_PORT` *"sets a `server.port=0` Environment property … Requires a
dependency on `spring-boot-web-server`"* (Boot 4 wording, **not** "starter-web") ·
`DEFINED_PORT` same dependency, no `server.port=0` · `NONE` sets `WebApplicationType.NONE`.

🔴 The transaction trap for chunk 08: *"as using this arrangement with either RANDOM_PORT or
DEFINED_PORT implicitly provides a real servlet environment, the HTTP client and server run in
separate threads and, thus, in separate transactions. Any transaction initiated on the server
does not roll back in this case."*

## Test transactions — chunk 08

*"Annotating a test method with `@Transactional` causes the test to be run within a transaction
that is, by default, automatically rolled back after completion of the test."* Only
`value`/`transactionManager` and `propagation` (`NOT_SUPPORTED`/`NEVER` only) are supported;
`isolation`, `timeout`, `readOnly`, `rollbackFor`, `noRollbackFor` are **not**. `@Transactional`
is **not** supported on `@BeforeAll`/`@BeforeEach` lifecycle methods; `@BeforeEach`/`@AfterEach`
run *inside* the test transaction, `@BeforeAll`/`@AfterAll` outside. `TestTransaction`:
`flagForCommit()`, `flagForRollback()`, `end()`, `start()`, `isActive()`.

🔴 Preemptive-timeout trap: transaction state is bound to the thread via a `ThreadLocal`, so
`assertTimeoutPreemptively(…)` runs the body on another thread and its writes **commit** even
though the test transaction rolls back. (Topic 01 chunk `13b` already argues the same mechanism
from the JUnit side — cross-link them.)

⚠️ The ORM false-positive story is already exhaustive in **Phase 10 topic 04's `20`–`20k`
series** — chunk 08 links there rather than re-teaching it, and owns the test-level view:
whether the test should be transactional at all, `@Commit`/`@Rollback`, `TestTransaction`,
`@BeforeTransaction`/`@AfterTransaction`, and the two Boot traps above.

## Uncertain, stated in place — do not "fix" it

**No Spring, Boot or JUnit reference defines, endorses or gives ratios for the test pyramid.**
It is an industry convention (usually Mike Cohn, *Succeeding with Agile*, 2009). Any 70/20/10
split is blog material. Chunk 01 says so and pivots to the claim the reference *does* make:
the cost driver is the number of contexts.

## 🔴 A link defect worth telling every phase-11 fork

From inside a **topic** directory, phase-10 is `../../phase-10-data-access/…`, not `../`. The
one-level-too-high form *resolves silently in a README index* and ships a 404.

## The proposed chunk breakdown (from the fork's research, not yet written)

03 mechanism / 03b what a slice excludes / 03c the slice catalogue · 04 `@SpringBootTest` +
config discovery / 04b `webEnvironment` · 05 cache / 05b eviction / 05c context pausing ·
06 mechanism + `@MockitoBean` / 06b cache key / 06c `@MockitoSpyBean` / 06d `@TestBean` /
06e AOP proxies · 07 + 07b · 08 + 08b · 09 · 10 · 11. **Next `sidebar_position` is 3.**

## URLs actually read

`docs.spring.io/spring-framework/reference/testing/testcontext-framework/bean-overriding.html`
· `…/annotations/integration-spring/annotation-mockitobean.html` · `…-testbean.html` ·
`…/ctx-management/caching.html` · `…/context-pausing.html` · `…/failure-threshold.html` ·
`…/property-sources.html` · `…/dynamic-property-sources.html` · `…/env-profiles.html` ·
`…/testcontext-framework/tx.html` · `docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html`
· `docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html` · Boot javadoc for
`SpringBootTest`, `WebEnvironment`, `WebMvcTest`, `DataJpaTest`, `JdbcTest`, `RestClientTest`,
`WebClientTest`, `JsonTest`, `AutoConfigureTestDatabase.Replace`, plus `type-search-index.js`
for the authoritative package mapping.

⚠️ Framework reference pages currently link javadoc at **7.0.9** while our spine says 7.0.8.
The spine was kept per `_PHASE-NOTES.md`; do not re-derive it.
