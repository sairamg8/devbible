---
title: "A cache changes nothing about what a method returns, so the only thing a test can observe is a call that did not happen — and three separate arrangements will each make that call-count assertion pass or fail for reasons that have nothing to do with your caching"
sidebar_label: "09 · Caching, and the cache-hit test"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.8** reference *Cache Abstraction*,
> read from the `v7.0.8` sources —
> [`cache/strategies.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/integration/cache/strategies.adoc)
> and
> [`cache/annotations.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/integration/cache/annotations.adoc)
> — every quoted sentence below is from one of those two; the `v7.0.8` sources of
> [`Cache`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-context/src/main/java/org/springframework/cache/Cache.java)
> and
> [`NoOpCacheManager`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-context/src/main/java/org/springframework/cache/support/NoOpCacheManager.java);
> and the **Spring Boot 4.1.0** source of
> [`AutoConfigureCache`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-cache-test/src/main/java/org/springframework/boot/cache/test/autoconfigure/AutoConfigureCache.java)
> plus the Boot reference *Caching · Testing*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/io/caching.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only, never console output or timings.

**Every other scenario in this topic has an observable outcome: a returned value, a thrown
exception, a request that went out, a row that changed. Caching has none. A cached method
returns exactly what an uncached one returns, so `assertThat(first).isEqualTo(second)` passes
identically whether the cache exists, is disabled, or was never wired at all. The only
evidence a cache leaves is negative — a call that did not happen — which means the test is a
`verify(..., times(1))` and the entire difficulty is making sure that assertion is measuring
your cache rather than one of the three arrangements that quietly decide it for you.**

## What the mechanism guarantees, and the precondition nobody checks

The reference states the behaviour and then, in the next paragraph, states a precondition
that is a design rule rather than a configuration note:

> *"each time a targeted method is invoked, the abstraction applies a caching behavior that
> checks whether the method has been already invoked for the given arguments. If it has been
> invoked, the cached result is returned without having to invoke the actual method."*

> **IMPORTANT:** *"This approach works only for methods that are guaranteed to return the
> same output (result) for a given input (or arguments) no matter how many times they are
> invoked."*

🔴 **That second quote is the most useful test you will ever apply to a `@Cacheable`
annotation, and it is applied by reading rather than by running.** A method whose result
depends on the clock, on a request's tenant, on the security context, or on a row somebody
else can update between calls does not satisfy it, and no amount of test coverage makes it
satisfy it. Half the caching incidents in the wild are this, not eviction.

## The test, and why it looks like nothing

```java
@SpringBootTest
class CatalogueCachingTest {

    @Autowired CatalogueService catalogue;      // the proxied bean
    @Autowired CacheManager caches;

    @MockitoBean ProductRepository products;    // the collaborator that must not be called twice

    @BeforeEach
    void clearEveryCache() {
        caches.getCacheNames().forEach(name -> caches.getCache(name).clear());
    }

    @Test
    void theSecondLookupDoesNotReachTheRepository() {
        given(products.findByIsbn("978-1")).willReturn(new Product("978-1", "Refactoring"));

        Product first  = catalogue.byIsbn("978-1");
        Product second = catalogue.byIsbn("978-1");

        assertThat(second).isEqualTo(first);                    // necessary, not sufficient
        verify(products, times(1)).findByIsbn("978-1");          // 🔴 the actual assertion
        assertThat(caches.getCache("products").get("978-1")).isNotNull();
    }

    @Test
    void aDifferentKeyIsAMiss() {
        given(products.findByIsbn(any())).willReturn(new Product("x", "y"));

        catalogue.byIsbn("978-1");
        catalogue.byIsbn("978-2");

        verify(products, times(2)).findByIsbn(any());
    }
}
```

Three assertions, and each one covers a different failure:

- **The equality** proves the cached value is the value, not a stale or empty placeholder. On
  its own it proves nothing about caching.
- **`verify(..., times(1))`** is the cache hit. It is the only assertion that fails when the
  cache is disabled.
- **The `CacheManager` lookup** proves the entry landed under the key you think, which is
  what the second test then exercises from the other side. `Cache.get(Object)` is precise
  about its return contract: *"Returns `null` if the cache contains no mapping for this key;
  otherwise, the cached value (which may be `null` itself) will be returned in a
  `ValueWrapper`."* — so a non-null wrapper means present, and a straight `null` means absent.

🔴 **`@MockitoBean`, not `@MockBean`** — Boot 4 removed the old annotation and the
replacement lives in Spring Framework, `org.springframework.test.context.bean.override.mockito`.
Every article about testing Spring caches predates that move. **Topic 05 · The test pyramid**
owns the bean-override mechanism.

## Arrangement 1 that decides the result for you: there is no proxy

`@Cacheable` is AOP. The reference:

> *"The default advice mode for processing caching annotations is `proxy`, which allows for
> interception of calls through the proxy only. Local calls within the same class cannot get
> intercepted that way."*

> *"In proxy mode (the default), only external method calls coming in through the proxy are
> intercepted. This means that self-invocation (in effect, a method within the target object
> that calls another method of the target object) does not lead to actual caching at runtime
> even if the invoked method is marked with `@Cacheable`. […] Also, the proxy must be fully
> initialized to provide the expected behavior, so you should not rely on this feature in your
> initialization code (that is, `@PostConstruct`)."*

Two consequences for a test, and they pull in opposite directions:

- **`new CatalogueService(repo)` in a plain unit test is never cached.** There is no proxy, so
  a `verify(..., times(1))` assertion in a Mockito-only test is asserting that the cache does
  not work — and it will pass, forever, for that reason. Caching cannot be unit-tested; it
  needs a context. That is the same constraint [06c](06c-method-security-with-no-request.md)
  describes for `@PreAuthorize`, and it is one rule with four names: `@Transactional`,
  `@Cacheable`, `@Async` and method security all share it.
- **A self-invocation is not cached in production either**, and the test that calls the
  cached method directly passes while the real entry point bypasses the proxy entirely. Write
  the test through the same entry point production uses.

## 🔴 Arrangement 2: the `CacheManager` in the context is a no-op

This is the one that silently makes a whole test class meaningless, and Boot ships it as a
convenience. `@AutoConfigureCache` — in Boot 4 at
`org.springframework.boot.cache.test.autoconfigure`, since 4.0.0 — has this javadoc:

> *"Annotation that can be applied to a test class to customize the cache provider. By
> default, a `NoOpCacheManager` is auto-configured."*

Its single attribute is `CacheType cacheProvider() default CacheType.NONE`, mapped to the
property `spring.cache.type`. And `NoOpCacheManager`'s own javadoc says what that means:

> *"A basic, no operation `CacheManager` implementation suitable for disabling caching,
> typically used for backing cache declarations without an actual backing store."*

> *"This implementation will simply accept any items into the cache, not actually storing
> them."*

**Every `put` succeeds and every `get` misses.** A cache-hit test running against it calls
through every time, and `verify(..., times(1))` fails with a count of 2 — which reads as "my
caching is broken" and is in fact "caching is switched off in this test".

Three routes to the same state, and all three are things a sensible team does:

1. `@AutoConfigureCache` on the class, or inherited from a shared test base class.
2. `spring.cache.type: none` in `application-test.yml`. The Boot reference actively suggests
   this: *"It is generally useful to use a no-op implementation when running a test
   suite."*
3. A test profile that excludes the `@Configuration` class declaring the real `CacheManager`
   — which the Boot reference also recommends as a structuring technique: *"the best option
   is to make sure that caching configuration is defined in an isolated `Configuration`
   class. Doing so makes sure that caching is not required by slice tests."*

🔴 **The resolution is not to undo any of that.** A no-op cache is the right default for the
other nine hundred tests, because caching in a test suite hides bugs. The caching test is the
exception, and it should say so loudly — an explicit `@AutoConfigureCache(cacheProvider = CacheType.SIMPLE)`
or an explicit property override on that class, plus a comment saying why. A caching test
that depends on the ambient profile is a test that will be disabled by someone else's
unrelated change.

## Arrangement 3: the context is cached, so the cache is already warm

The third one gets its own chunk, because it is a test-isolation problem rather than a
wiring problem and it produces false *passes* as well as false failures: the `CacheManager`
is a singleton bean inside an `ApplicationContext` that the TestContext framework reuses
across test classes, so entries written by one test are visible to the next. That, the
`@BeforeEach` that fixes it, why `@DirtiesContext` is the wrong tool, and the assertions that
distinguish a real cache hit from a method that returned early are
[09a · The cache that outlives the test](09a-the-cache-that-outlives-the-test.md).

## Where this connects

- Test isolation, key collisions, cached nulls, eviction and `sync` — everything that makes a
  *passing* cache test wrong:
  [09a · The cache that outlives the test](09a-the-cache-that-outlives-the-test.md).
- The idempotency half of this chunk's title — proving a retried request did not double-charge:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The identical proxy-and-self-invocation rule for method security:
  [06c · Method security with no request](06c-method-security-with-no-request.md).
- **Topic 05 · The test pyramid** owns the context cache, what evicts it, `@DirtiesContext`,
  and `@MockitoBean`/`@TestBean` —
  [`../05-the-test-pyramid/05-the-context-cache.md`](../05-the-test-pyramid/05-the-context-cache.md),
  [`../05-the-test-pyramid/05b-what-evicts-it.md`](../05-the-test-pyramid/05b-what-evicts-it.md),
  [`../05-the-test-pyramid/06-bean-overriding.md`](../05-the-test-pyramid/06-bean-overriding.md).
- **Topic 04 · Mockito** owns `verify`, `times(n)` and `verifyNoMoreInteractions` —
  [`../04-mockito/05-verification.md`](../04-mockito/05-verification.md).

## Gotchas

**★ A cache is invisible in the return value, so the only assertion that can fail is the call count.**
`assertThat(second).isEqualTo(first)` passes with caching on, off, misconfigured or absent. Teams write it, see green, and believe the cache is covered. `verify(collaborator, times(1))` is the assertion; everything else is supporting evidence.

**★ `@Cacheable` does nothing in a plain unit test, and the resulting test passes for the wrong reason.**
There is no proxy around a `new`-ed instance, so the annotation is inert. A `verify(..., times(1))` there fails honestly; worse is a test that asserts equality only, passes, and is filed as caching coverage. Caching cannot be unit-tested — it needs a context, which is the same constraint `@Transactional`, `@Async` and `@PreAuthorize` have.

**★ Boot's `@AutoConfigureCache` installs a `NoOpCacheManager` by default, and a no-op cache accepts every write and serves no read.**
Its javadoc says *"By default, a `NoOpCacheManager` is auto-configured"* and the attribute defaults to `CacheType.NONE`. `NoOpCacheManager` *"will simply accept any items into the cache, not actually storing them"*. So nothing throws, nothing warns, and every cache-hit test fails with a call count of 2 that looks like a caching bug.

**★ `spring.cache.type: none` in a shared test profile disables the thing your caching test is testing, and Boot's own docs recommend setting it.**
The reference says *"It is generally useful to use a no-op implementation when running a test suite"*, which is correct advice for the suite and fatal for this one test class. The caching test must override it explicitly on the class rather than depending on the ambient profile, or it becomes collateral damage the first time someone tidies the test configuration.

**★ Putting the `CacheManager` bean in an isolated `@Configuration` — which Boot recommends — means slice tests have no cache at all.**
The reference's suggestion is *"to make sure that caching configuration is defined in an isolated `Configuration` class. Doing so makes sure that caching is not required by slice tests."* That is good structure and it means a `@WebMvcTest` or a `@DataJpaTest` will not have your real cache manager. A caching test therefore cannot be a slice test unless it imports that configuration explicitly.

**★ Annotating a method whose result is not a pure function of its arguments is a correctness bug no test will catch.**
The reference marks this IMPORTANT: the approach *"works only for methods that are guaranteed to return the same output (result) for a given input […] no matter how many times they are invoked."* A method that reads the security context, the current tenant, the clock, or a row another request can update violates it. Your cache-hit test will pass beautifully, because it calls the method twice with the same arguments in the same context — which is exactly the situation the bug does not appear in.

## Interview questions

**★ How do you test that a `@Cacheable` method is actually caching?**
By asserting the absence of a second call, because that is the only observable difference. The arrangement is a Spring context — never a plain unit test, since there is no proxy around a `new`-ed instance and the annotation is inert — with the collaborator replaced by a `@MockitoBean` and a real `CacheManager` in the context. Then: call the method twice with the same argument, assert the two results are equal, and assert `verify(repository, times(1))`. I add a third assertion on the cache contents through the injected `CacheManager`, because a call count of one is also what you get if the method short-circuited before reaching the repository for an entirely different reason. And the whole thing is worthless without a `@BeforeEach` that clears every cache, because the `CacheManager` is a singleton in a context the TestContext framework reuses across classes.

**★ Your cache test fails with "wanted 1 time but was 2". What do you check first?**
Whether there is a cache at all in that context, before touching the production code. The three routine causes are all configuration: a `@AutoConfigureCache` on the class or an inherited base class, which defaults to `CacheType.NONE` and installs a `NoOpCacheManager` that accepts every write and stores nothing; a `spring.cache.type: none` in the test profile, which Boot's own documentation recommends for suites generally; and a `CacheManager` declared in an isolated `@Configuration` that this test's context does not import. After that I would check for self-invocation — whether the entry point I called reaches the cached method through the proxy or from inside the same object — because in proxy mode the reference is explicit that self-invocation *"does not lead to actual caching at runtime even if the invoked method is marked with `@Cacheable`"*. Only then would I suspect the key.

**★ When should you *not* write a caching test?**
When the annotation is on a method that does not satisfy the precondition, because then the test is documenting a bug. The reference marks it IMPORTANT: caching works only for methods guaranteed to return the same output for the same input, however many times they are invoked. A method that consults the security context, resolves the current tenant, reads the clock, or returns a row another request can update fails that, and a two-call cache-hit test passes anyway — same thread, same context, same arguments, microseconds apart. So the finding is not "we need a test", it is "the arguments are incomplete": the tenant or the user belongs in the key, or the method should not be cached. That review is worth more than the test, and the test written without it gives the wrong idea permanent cover.

{/* FOOTER */}
