---
title: "A @Configuration class that DECLARES a @Bean SecurityFilterChain is not itself assignable to SecurityFilterChain, so @WebMvcTest's include list never fires for it — the slice enforces Boot's anyRequest().authenticated() default, your green security test proves nothing about your rules, and Boot's own how-to prescribes @Import"
sidebar_label: "08e · The chain you are not testing"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Boot 4.1.1** sources —
> [`AnnotationCustomizableTypeExcludeFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/core/spring-boot-test/src/main/java/org/springframework/boot/test/context/filter/annotation/AnnotationCustomizableTypeExcludeFilter.java),
> [`StandardAnnotationCustomizableTypeExcludeFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/core/spring-boot-test/src/main/java/org/springframework/boot/test/context/filter/annotation/StandardAnnotationCustomizableTypeExcludeFilter.java),
> `WebMvcTypeExcludeFilter`, `SpringBootMockMvcBuilderCustomizer`,
> `ServletWebSecurityAutoConfiguration`, `spring-boot-security-test`'s
> `META-INF/spring/….WebMvcTest.includes`, and that module's own
> `SecurityWebMvcTestIntegrationTests` / `ExampleWebSecurityConfigurer`; plus the Boot
> how-to
> ["Structure @Configuration Classes for Inclusion in Slice Tests"](https://docs.spring.io/spring-boot/how-to/testing.html)
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/testing.html)) and the
> reference ["Auto-configured Spring WebFlux Tests"](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html),
> read as asciidoc at tag `v4.1.1`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Spring Security 7.1.1, AssertJ 3.27.7.
> **No sandbox** — this page carries Java and library source, never a fabricated test run.

**This is the one that makes tests pass rather than fail, which is why it survives code
review. The `SecurityFilterChain` being enforced in your slice is Boot's default, not the
one you wrote — so a test asserting "anonymous is rejected" is green regardless of whether
your own configuration would have rejected it. The mechanism is a single method in Boot's
type-exclude filter, and Boot's how-to guides document the consequence using
`SecurityFilterChain` as the worked example.**

## The include list, and the method that decides it

`spring-boot-security-test` contributes a resource named
`org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest.includes` containing three
types:

```text
org.springframework.security.config.annotation.web.WebSecurityConfigurer
org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer
org.springframework.security.web.SecurityFilterChain
```

`StandardAnnotationCustomizableTypeExcludeFilter.getDefaultIncludes()` merges those with the
hard-coded set in `WebMvcTypeExcludeFilter`:

```java
protected final Set<Class<?>> getDefaultIncludes() {
    Set<Class<?>> defaultIncludes = new HashSet<>();
    defaultIncludes.addAll(getKnownIncludes());
    defaultIncludes.addAll(TypeIncludes.load(this.annotation.getType(), getClass().getClassLoader()).getIncludes());
    return defaultIncludes;
}
```

and every entry is tested against the scanned class by exactly one method:

```java
protected final boolean isTypeOrAnnotated(MetadataReader metadataReader,
        MetadataReaderFactory metadataReaderFactory, Class<?> type) throws IOException {
    AnnotationTypeFilter annotationFilter = new AnnotationTypeFilter((Class<? extends Annotation>) type);
    AssignableTypeFilter typeFilter = new AssignableTypeFilter(type);
    return annotationFilter.match(metadataReader, metadataReaderFactory)
            || typeFilter.match(metadataReader, metadataReaderFactory);
}
```

"Is annotated with it, **or** is assignable to it." Both questions are asked of the class
being scanned. Now look at how everyone writes security configuration since
`WebSecurityConfigurerAdapter` was removed
([05 · Configuring the chain](../../phase-9-spring-boot/11-spring-security/05-configuring-the-chain.md)):

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {                        // NOT a SecurityFilterChain

    @Bean
    SecurityFilterChain api(HttpSecurity http) { … }  // the bean is; the class is not
}
```

`SecurityConfig` is not annotated `@SecurityFilterChain` — that is not an annotation — and
is not assignable to `SecurityFilterChain`. The include never fires and the class is
excluded from the scan.

## What the include list *does* catch

Boot's own tests answer this, and they are worth reading because they are easy to
misread. `ExampleWebSecurityConfigurer` is
`@Component class … implements WebSecurityConfigurer<WebSecurity>` and
`ExampleWebSecurityCustomizer` is `@Component class … implements WebSecurityCustomizer` —
classes that *are* the type, so `AssignableTypeFilter` matches. Then:

```java
@Test
void includesSecurityFilterChain() {
    assertThat(AssertableApplicationContext.get(() -> this.context)).hasSingleBean(SecurityFilterChain.class);
}
```

`hasSingleBean` — and the test application declares no chain of its own, so the single bean
is Boot's auto-configured one. The test proves a chain exists. It does not prove that a
user-declared chain was found, and there is no test in the module that does.

## Boot documents the consequence, and prescribes `@Import`

This is not an inference from source that the documentation is silent about. The Boot
how-to guides state the general rule:

> *"Slice tests work by restricting Spring Framework's component scanning to a limited set
> of components based on their type. For any beans that are not created through component
> scanning, for example, beans that are created using the `@Bean` annotation, slice tests
> will not be able to include/exclude them from the application context."*

and then use `SecurityFilterChain` as the worked example:

> *"For a `@WebMvcTest` for an application with the above `@Configuration` class, you might
> expect to have the `SecurityFilterChain` bean in the application context so that you can
> test if your controller endpoints are secured properly. However, `MyConfiguration` is not
> picked up by @WebMvcTest's component scanning filter because it doesn't match any of the
> types specified by the filter. You can include the configuration explicitly by annotating
> the test class with `@Import(MyConfiguration.class)`."*

So:

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)          // your rules, not Boot's defaults
class OrderSecurityTests {

    @Autowired MockMvcTester mvc;
    @MockitoBean OrderService orders;
}
```

Once that bean exists, `@ConditionalOnDefaultWebSecurity` is no longer satisfied and Boot
backs off: *"If the user specifies their own `SecurityFilterChain` bean, this will back-off
completely and the users should specify all the bits that they want to configure as part of
the custom security configuration."* Which also means the 401/302 behaviour of
[08b](08b-the-401-and-the-302.md) changes — your chain has the entry points you configured,
and probably not both.

## The design consequence Boot spells out

`@Import` takes the whole configuration class. The how-to's example class deliberately holds
a `SecurityFilterChain` **and** a `HikariDataSource`, and says what happens:

> *"This will load all the beans in `MyConfiguration` including the `HikariDataSource` bean
> which isn't required when testing the web tier. Splitting the configuration class into two
> will enable importing just the security configuration."*

— into a `MySecurityConfiguration` and a `MyDatasourceConfiguration`, and more generally:

> *"Having a single configuration class can be inefficient when beans from a certain domain
> need to be included in slice tests. Instead, structuring the application's configuration as
> multiple granular classes with beans for a specific domain can enable importing them only
> for specific slice tests."*

That is a production code shape driven by testability, and it is the rare case where "do it
for the tests" is the documented advice.

## Gotchas

**★ Expecting your `@Configuration class SecurityConfig` to be in the slice.**
The include list matches classes that *are* a `SecurityFilterChain`, not classes that declare
one as a `@Bean`. Boot's how-to says so explicitly. Without `@Import`, you are testing
`anyRequest().authenticated()`.

**★ Concluding "security works" from a green slice test with no `@Import`.**
This is the dangerous one, because nothing fails. Boot's default chain protects everything,
so a test asserting "anonymous gets rejected" passes whatever your configuration says —
including when your real chain accidentally permits the endpoint. The test proves Boot's
default works.

**★ Expecting a `permitAll()` endpoint to be reachable.**
Same root cause seen from the other side. The `permitAll()` is in your chain; Boot's has no
exceptions at all. The fix is `@Import`, not a `permitAll()` bolted onto the test.

**★ `@Import(SecurityConfig.class)` suddenly demanding a `DataSource`.**
`@Import` takes the whole configuration class, including beans that have nothing to do with
the web tier. Boot's how-to names this exact symptom and recommends splitting the class in
production code.

**★ Assuming `@Import` of a `@Configuration` class does not bring its `@ComponentScan`.**
It brings the class, its `@Bean` methods, its nested configuration classes *and* any
`@ComponentScan` on it — which can pull the entire application into a slice and defeat the
purpose. Import a class that declares beans, not one that scans for them.

**★ Importing a security configuration that depends on beans the slice does not have.**
A chain injecting a `UserDetailsService`, a `JwtDecoder` or a `CorsConfigurationSource` fails
*context startup*, not a test assertion, and the message names the missing bean rather than
the slice. `@MockitoBean` the collaborator, or import the small configuration that supplies
it.

**★ Importing the chain and forgetting it changes the failure mode.**
Boot's default answers 401 or 302 depending on `Accept`; your chain answers whatever its own
entry points do — often 403 from `Http403ForbiddenEntryPoint` if it configures neither form
login nor Basic ([08c](08c-asserting-protection-not-the-challenge.md)). Adding the `@Import`
to fix a "wrong chain" problem will legitimately change statuses, and that is the test
becoming honest rather than breaking.

**★ Carrying this conclusion to `@WebFluxTest` without checking.**
The conclusion is the same but the route is different: `spring-boot-security-test` ships a
`WebMvcTest.includes` resource and **no** `WebFluxTest.includes`, and Boot documents the
outcome directly — *"`@WebFluxTest` cannot detect custom security configuration registered as
a `@Bean` of type `SecurityWebFilterChain`. To include that in your test, you will need to
import the configuration that registers the bean."* On the reactive side even a
`WebSecurityCustomizer`-shaped bean needs the import.

**★ Deciding the slice is not worth it and using `@SpringBootTest` for everything.**
That does load your real chain, and it also loads your datasource, your message broker and
your scheduled tasks, and it changes the context-cache key for every variation
([02b](02b-narrowing-and-what-it-costs.md)). `@WebMvcTest` plus one `@Import` is the cheap
middle, and it is what Boot's own documentation recommends.

## Interview questions

**★ Is your production `SecurityConfig` loaded into a `@WebMvcTest`?**
Almost certainly not. The include list contributed by `spring-boot-security-test` names
`SecurityFilterChain`, `WebSecurityConfigurer` and `WebSecurityCustomizer`, but
`AnnotationCustomizableTypeExcludeFilter.isTypeOrAnnotated` matches an `AnnotationTypeFilter`
or an `AssignableTypeFilter` against the *scanned class*, and a `@Configuration` class that
declares a `@Bean SecurityFilterChain` is not itself assignable to `SecurityFilterChain`.
Boot's how-to guides confirm the outcome with this exact example and prescribe
`@Import(MyConfiguration.class)`.

**★ Then what does the include list actually catch?**
Classes that *are* the type: a `@Component class … implements WebSecurityConfigurer<WebSecurity>`
or `implements WebSecurityCustomizer` — which is precisely what Boot's own
`SecurityWebMvcTestIntegrationTests` uses to assert the includes work. The
`SecurityFilterChain` entry catches the old `WebSecurityConfigurerAdapter`-era shapes and any
class that literally implements `SecurityFilterChain`; it does not catch the idiom everybody
writes today.

**★ Why is a green security slice test with no `@Import` worse than a failing one?**
Because it asserts Boot's `anyRequest().authenticated()` and reports success. A failing test
tells you something is wrong; this one tells you your rules are correct when it has never
seen them. The check is mechanical: keep the `@Import` on every security-relevant slice test,
or assert that a bean declared by your configuration class is in the context.

**★ What happens to Boot's default chain once you `@Import` yours?**
It backs off entirely. `ServletWebSecurityAutoConfiguration`'s
`SecurityFilterChainConfiguration` is `@ConditionalOnDefaultWebSecurity`, and its javadoc
says *"If the user specifies their own `SecurityFilterChain` bean, this will back-off
completely and the users should specify all the bits that they want to configure as part of
the custom security configuration."* Expect the statuses to change with it.

**★ Why does Boot recommend splitting your `@Configuration` classes?**
Because `@Import` is all-or-nothing at class granularity. A class holding both a
`SecurityFilterChain` and a `DataSource` cannot be imported into a web slice without the
datasource. Boot's how-to says so and prescribes granular, domain-shaped configuration
classes — one of the few places where the documentation asks you to change production code
for the benefit of tests.

The same exclusion has two further victims, and both of them make a test look healthier than
it is — [08f · Method security and the blunt instrument](08f-method-security-and-the-blunt-instrument.md).

{/* FOOTER */}
