---
title: "@WebMvcTest is not a smaller application context, it is auto-configuration switched OFF plus a component-scan filter with a hard-coded allow-list — and the allow-list is a list of TYPES a bean must be or be annotated with, which is why your @Service is missing, your Converter is present, and your SecurityConfig behaves in the way nobody expects"
sidebar_label: "02 · The @WebMvcTest slice"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Boot 4.1.1** sources on GitHub (tag `v4.1.1`) —
> [`WebMvcTest`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.java),
> [`WebMvcTypeExcludeFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTypeExcludeFilter.java),
> [`AutoConfigureMockMvc`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.java),
> `AnnotationCustomizableTypeExcludeFilter` and
> `StandardAnnotationCustomizableTypeExcludeFilter` in `core/spring-boot-test`, and the
> `META-INF/spring/…WebMvcTest.includes` resource contributed by `spring-boot-security-test`;
> plus the Spring Boot 4.1 reference "Testing Spring Boot Applications"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, **Spring Boot 4.1.1** (sources
> read at 4.1.1), Spring Framework 7.0.9, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[01](01-no-socket-no-server.md) said a `MockMvc` test can be built two ways, and that the
context-based route in a Boot codebase is called `@WebMvcTest`. This chunk is what that
annotation actually does, which is two independent mechanisms bolted together: auto-configuration
is switched off and replaced with a fixed list, and component scanning is narrowed by a filter
whose rules are a hard-coded set of types. Almost every "why is that bean missing / why is that
bean there" question has its answer in one of those two lists, and both are readable. What the
slice consequently lacks, how you supply it, and what narrowing to one controller costs you is
[02b · Narrowing, and what it costs](02b-narrowing-and-what-it-costs.md).**

## What the annotation is made of

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@BootstrapWith(WebMvcTestContextBootstrapper.class)
@ExtendWith(SpringExtension.class)
@OverrideAutoConfiguration(enabled = false)
@TypeExcludeFilters(WebMvcTypeExcludeFilter.class)
@AutoConfigureWebMvc
@AutoConfigureMockMvc
@ImportAutoConfiguration
public @interface WebMvcTest { … }
```

Read the two lines that do the work:

- **`@OverrideAutoConfiguration(enabled = false)`** turns Boot's normal auto-configuration off
  entirely. Nothing is auto-configured because it is on the classpath. What comes back is only
  what `@ImportAutoConfiguration` pulls in from the slice's `.imports` files. That is the general
  slice mechanism and it belongs to
  [03 · The slices](../05-the-test-pyramid/03-the-slices.md) — this topic assumes it.
- **`@TypeExcludeFilters(WebMvcTypeExcludeFilter.class)`** narrows component scanning. It is a
  *separate* mechanism from the first, and conflating them is the source of most confusion: a
  bean can be missing because its auto-configuration was not imported, or because the scan filter
  rejected it, and the two have different fixes.

🔴 **Boot 4 moved the annotation.** It is now
`org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`, in the `spring-boot-webmvc-test`
module, and its javadoc reads `@since 4.0.0`. Code and blog posts written for Boot 3 import
`org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest`. The annotation's behaviour
is broadly the same; the import is not, and neither is the module you must have on the test
classpath.

## The scan filter's allow-list, verbatim

The javadoc gives it as two lists. Beans **annotated with**:

> *"`@Controller` · `@ControllerAdvice` · `@JacksonComponent` · `@JsonComponent` (Jackson 2,
> deprecated)"*

and beans that **implement**:

> *"`Converter` · `DelegatingFilterProxyRegistrationBean` · `ErrorAttributes` · `Filter` ·
> `FilterRegistrationBean` · `GenericConverter` · `HandlerInterceptor` ·
> `HandlerMethodArgumentResolver` · `HttpMessageConverter` · `IDialect`, if Thymeleaf is
> available · `JacksonModule`, if Jackson is available · `Module` (deprecated), if Jackson 2 is
> available · `SecurityFilterChain` · `WebMvcConfigurer` · `WebMvcRegistrations` ·
> `WebSecurityConfigurer`"*

That is not a summary written for the docs — it is `WebMvcTypeExcludeFilter.KNOWN_INCLUDES` plus
the types loaded from `META-INF/spring/org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest.includes`,
a resource file that `spring-boot-security-test` contributes:

```text
org.springframework.security.config.annotation.web.WebSecurityConfigurer
org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer
org.springframework.security.web.SecurityFilterChain
```

Two Boot 4 details worth noticing in the first list. `@JacksonComponent` is the Jackson 3
annotation and it is the live one; `@JsonComponent` is now labelled *"(Jackson 2, deprecated)"* —
the same Jackson 3 migration that
[09 · Jackson 3, what changed](../../phase-9-spring-boot/07-rest-controllers/09-jackson-3-what-changed.md)
covers. And the optional includes are resolved reflectively, so a type whose library is absent
simply never joins the set:

```java
for (String optionalInclude : OPTIONAL_INCLUDES) {
    try { includes.add(ClassUtils.forName(optionalInclude, null)); }
    catch (Exception ex) { /* Ignore */ }
}
```

## 🔴 "Beans that implement" means exactly that, and it decides your security config

The matching is one method, and it is worth reading because the whole `SecurityFilterChain`
question turns on it:

```java
protected final boolean isTypeOrAnnotated(MetadataReader metadataReader,
        MetadataReaderFactory metadataReaderFactory, Class<?> type) throws IOException {
    AnnotationTypeFilter annotationFilter = new AnnotationTypeFilter((Class<? extends Annotation>) type);
    AssignableTypeFilter typeFilter = new AssignableTypeFilter(type);
    return annotationFilter.match(metadataReader, metadataReaderFactory)
            || typeFilter.match(metadataReader, metadataReaderFactory);
}
```

A candidate is included if the scanned **class itself** carries the annotation, or if the scanned
**class itself** is assignable to the type. Nothing looks at the class's `@Bean` methods.

Now look at how everybody writes security configuration since `WebSecurityConfigurerAdapter` was
removed ([05 · Configuring the chain](../../phase-9-spring-boot/11-spring-security/05-configuring-the-chain.md)):

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {                       // is NOT a SecurityFilterChain
    @Bean
    SecurityFilterChain api(HttpSecurity http) { … } // the bean is; the class is not
}
```

`SecurityConfig` is not annotated `@SecurityFilterChain` — that is not even an annotation — and
it is not assignable to `SecurityFilterChain`. So the include does not fire, and the class is
filtered out of the scan.

✅ **And Boot's own how-to states this outright** — it is not an inference from the filter
source, though the filter source is why it happens. `howto.testing.slice-tests`, using
`SecurityFilterChain` as its worked example:

> *"For a `@WebMvcTest` … you might expect to have the `SecurityFilterChain` bean in the
> application context so that you can test if your controller endpoints are secured properly.
> However, `MyConfiguration` is not picked up by `@WebMvcTest`'s component scanning filter
> because it doesn't match any of the types specified by the filter. You can include the
> configuration explicitly by annotating the test class with `@Import(MyConfiguration.class)`."*

The how-to even ships the `MyConfiguration` class with a `@Bean SecurityFilterChain` beside a
`HikariDataSource`, which is exactly the shape above. So: **name the configuration explicitly** —
and note that the how-to's remedy is the same one, `@Import`.

```java
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)                       // your rules, not Boot's defaults
class OrderControllerTests { … }
```

What runs when you do not is Boot's default chain, and the consequences of *that* — a 401 where
you expected a 200, a 403 on every `POST` — are [08 · Security in a slice](08-security-in-a-slice.md).

## Gotchas

**★ Importing `org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest` on Boot 4.**
The annotation moved to `org.springframework.boot.webmvc.test.autoconfigure` in the
`spring-boot-webmvc-test` module and is marked `@since 4.0.0`. Every Boot 3 snippet on the
internet has the old import.

**★ Expecting your `@Configuration class SecurityConfig` to be in the slice.**
The include is for classes that *are* a `SecurityFilterChain`, not for classes that declare one as
a `@Bean`. `@Import(SecurityConfig.class)` is correct under any reading and costs one line.

**★ Assuming a plain `@Configuration` class is picked up because it configures MVC.**
Only a class that implements `WebMvcConfigurer` (or one of the other listed types) matches. A
`@Configuration` class with a `@Bean HandlerInterceptor` method is filtered out, and the
interceptor never registers — even though `HandlerInterceptor` is on the list, because the list
matches the *scanned class*.

**★ Reading a missing bean as "the auto-configuration is broken".**
There are two independent mechanisms and they fail differently. `@OverrideAutoConfiguration(enabled = false)`
means an auto-configuration you expect is simply not imported; the type-exclude filter means your
own component was scanned and rejected. `@ImportAutoConfiguration` / `excludeAutoConfiguration`
fixes the first; `@Import` or `includeFilters` fixes the second.

**★ Relying on `@JsonComponent` in a Boot 4 slice.**
It still matches — but the javadoc labels it *"(Jackson 2, deprecated)"*, and Boot 4's Jackson 3
equivalent is `@JacksonComponent`. Mixing the two means half your customisations bind to a
Jackson that is no longer the default.

**★ Adding `@ComponentScan` to a `@WebMvcTest` class to "just get the beans".**
The type-exclude filter still applies to whatever you scan, so most of what you wanted is still
rejected, and what does get through is now unpredictable. `@Import` names exactly what you want
and is checked by the compiler.

## Interview questions

**★ What does `@WebMvcTest` actually do?**
Two independent things. It sets `@OverrideAutoConfiguration(enabled = false)`, so Boot's normal
auto-configuration does not run and only the entries listed in the slice's `.imports` files are
applied; and it registers `WebMvcTypeExcludeFilter` as a `@TypeExcludeFilters`, which narrows
component scanning to a fixed allow-list of annotations and types. It also meta-annotates
`@AutoConfigureWebMvc` and `@AutoConfigureMockMvc`, which is where `MockMvc` and — if AssertJ is
present — `MockMvcTester` come from.

**★ Which of your own beans end up in the slice?**
Only those annotated `@Controller`, `@ControllerAdvice`, `@JacksonComponent` or the deprecated
`@JsonComponent`, or whose class implements one of `Converter`, `GenericConverter`, `Filter`,
`FilterRegistrationBean`, `DelegatingFilterProxyRegistrationBean`, `ErrorAttributes`,
`HandlerInterceptor`, `HandlerMethodArgumentResolver`, `HttpMessageConverter`, `WebMvcConfigurer`,
`WebMvcRegistrations`, `SecurityFilterChain`, `WebSecurityConfigurer`, `WebSecurityCustomizer`,
plus `JacksonModule` and Thymeleaf's `IDialect` when those libraries are present. Everything else —
`@Service`, `@Repository`, `@Component`, plain `@Configuration` — is filtered out.

**★ Why is your `SecurityConfig` not applied even though `SecurityFilterChain` is on the
allow-list?**
Because the filter matches the scanned class itself: `AnnotationTypeFilter(type)` or
`AssignableTypeFilter(type)`. A `@Configuration` class that declares a `@Bean SecurityFilterChain`
is neither annotated with nor assignable to `SecurityFilterChain`, so it is excluded. The
javadoc's phrasing — *"beans that implement … `SecurityFilterChain`"* — is literally accurate; it
is the reading that trips people. `@Import(SecurityConfig.class)` makes it explicit.

{/* FOOTER */}
