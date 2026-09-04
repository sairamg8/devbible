---
title: "Naming controllers in @WebMvcTest does two things nobody expects — it removes @Controller from the default include set so only the named classes are scanned, and it changes the context cache key, so a codebase with fifty narrowly-scoped controller tests builds fifty application contexts to save time"
sidebar_label: "02b · Narrowing, and what it costs"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Boot 4.1.1** sources on GitHub (tag `v4.1.1`) —
> [`WebMvcTest`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTest.java),
> [`WebMvcTypeExcludeFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/WebMvcTypeExcludeFilter.java),
> [`AutoConfigureMockMvc`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc-test/src/main/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.java),
> `AnnotationCustomizableTypeExcludeFilter` and `TypeExcludeFiltersContextCustomizer` in
> `core/spring-boot-test`; plus the Spring Boot 4.1 reference "Testing Spring Boot Applications"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, **Spring Boot 4.1.1** (sources
> read at 4.1.1), Spring Framework 7.0.9, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[02](02-webmvctest.md) is the allow-list: which of your beans the slice will scan. This chunk is
what the slice therefore does not have, how you supply the missing pieces, what the
`controllers = ...` attribute really changes, and the cost that nobody puts on the invoice — a
distinct application context per distinct narrowing.**

## What is definitively not in the slice

Everything the two lists do not name. In particular `@Service`, `@Repository`, `@Component`, and
plain `@Configuration` classes are all filtered out, along with every auto-configuration that was
not imported: no `DataSource`, no JPA, no `EntityManagerFactory`, no `RestClient` builder
customisations that arrive through auto-configuration, no scheduling, no caching.

That is the point of a slice and it is [03b · What a slice excludes](../05-the-test-pyramid/03b-what-a-slice-excludes.md).
The consequence for this topic is that a controller with a constructor-injected service will not
start the context at all — the context fails with a missing-bean error rather than an NPE — and
the standard answer is in the annotation's own javadoc:

> *"Typically `@WebMvcTest` is used in combination with `@MockitoBean` or `@Import` to create any
> collaborators required by your `@Controller` beans."*

```java
@WebMvcTest(OrderController.class)
class OrderControllerTests {

    @Autowired MockMvcTester mvc;
    @MockitoBean OrderService orders;               // the collaborator the controller needs

    @Test
    void returns_the_order_as_json() {
        given(orders.byId(42L)).willReturn(new Order(42L, "ORD-42"));

        assertThat(mvc.get().uri("/orders/{id}", 42))
                .hasStatusOk()
                .bodyJson().extractingPath("$.reference").isEqualTo("ORD-42");
    }
}
```

`@MockitoBean` is topic 05's — [06 · Bean overriding](../05-the-test-pyramid/06-bean-overriding.md)
— including the fact that it changes the context cache key, which matters more here than
anywhere because a controller test class is the kind of thing a codebase has fifty of.

## The escape hatch the javadoc offers, and when to take it

> *"If you are looking to load your full application configuration and use MockMVC, you should
> consider `@SpringBootTest` combined with `@AutoConfigureMockMvc` rather than this annotation."*

That is the honest alternative and it is under-used. `@SpringBootTest @AutoConfigureMockMvc` gives
you the same `MockMvc`/`MockMvcTester` against the *whole* context: your real security
configuration, your real converters, your real `@ControllerAdvice`, your real filters — with a
real database underneath unless you replace it. It is slower and it shares one cached context
across every test that uses the same configuration, which for a large suite can be **faster** in
aggregate than fifty differently-filtered slice contexts. [04 · @SpringBootTest](../05-the-test-pyramid/04-springboottest.md)
and [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md) are where that trade
is decided.

## What `@AutoConfigureMockMvc` contributes

`@WebMvcTest` is meta-annotated with it, so its defaults are your defaults:

| Attribute | Default | What it does |
|---|---|---|
| `addFilters()` | `true` | registers the context's `Filter` beans with the `MockMvc` builder |
| `print()` | `MockMvcPrint.DEFAULT` | how `MvcResult` information is printed after each invocation |
| `printOnlyOnFailure()` | `true` | *"If `MvcResult` information should be printed only if the test fails"* |
| `htmlUnit()` | enabled | auto-configures HtmlUnit `WebClient` and Selenium `WebDriver` when present |

and the class javadoc carries the sentence that decides which API you get:

> *"Annotation that can be applied to a test class to enable and configure auto-configuration of
> `MockMvc`. **If AssertJ is available a `MockMvcTester` is auto-configured as well.**"*

Both are in the context, so `@Autowired MockMvc mvc` and `@Autowired MockMvcTester mvc` both work
in the same test class — [03 · MockMvcTester](03-mockmvctester.md) and
[03b · The classic API](03b-the-classic-api.md).

`addFilters = true` is why security applies in the slice at all: the context's `Filter` beans —
including `springSecurityFilterChain` — are registered with the builder, so
[01](01-no-socket-no-server.md)'s `MockFilterChain` contains them. Setting `addFilters = false`
removes *every* filter, not just security, which is a blunt instrument covered in
[08](08-security-in-a-slice.md).

## 🔴 `@WebMvcTest(OrderController.class)` changes the include set, not just the scope

The attribute looks like a filter on top of the normal behaviour. It is a switch between two
different include sets:

```java
private static final Set<Class<?>> KNOWN_INCLUDES;                  // no @Controller
private static final Set<Class<?>> KNOWN_INCLUDES_AND_CONTROLLER;   // with @Controller

@Override
protected Set<Class<?>> getKnownIncludes() {
    if (ObjectUtils.isEmpty(this.controllers)) {
        return KNOWN_INCLUDES_AND_CONTROLLER;      // no controllers named: every @Controller
    }
    return KNOWN_INCLUDES;                         // controllers named: @Controller is NOT included
}

@Override
protected Set<Class<?>> getComponentIncludes() {
    return new LinkedHashSet<>(Arrays.asList(this.controllers));
}
```

So the two forms differ in kind:

- **`@WebMvcTest`** with no attribute includes the `@Controller` annotation itself, so **every**
  controller in the application is scanned into the context. The annotation's javadoc says as
  much: *"May be left blank if all `@Controller` beans should be added to the application
  context."* Every one of them needs its collaborators satisfied, which is usually why a bare
  `@WebMvcTest` fails to start in a real codebase.
- **`@WebMvcTest(OrderController.class)`** drops the `@Controller` annotation from the includes
  and adds the named classes as *component includes* instead. Only those classes are scanned as
  controllers. `@ControllerAdvice`, `WebMvcConfigurer`, `Filter`, converters and the rest are
  still included either way — narrowing the controllers does **not** narrow anything else.

That second bullet is worth holding on to: a common belief is that naming a controller isolates
the test. It isolates the *controllers*. Your `@ControllerAdvice`, your `HandlerInterceptor` and
your `Filter` beans are still there and still run, which is usually what you want and is
occasionally a surprise — [07 · Exception handlers](07-exception-handlers.md).

## 🔴 The cost: one application context per distinct narrowing

`@TypeExcludeFilters` is implemented as a `ContextCustomizer`, and context customizers are part of
the key the TestContext framework caches contexts under —
[05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md). The customizer's
equality is its filter set:

```java
@Override
public boolean equals(@Nullable Object obj) {
    return (obj != null) && (getClass() == obj.getClass())
            && this.filters.equals(((TypeExcludeFiltersContextCustomizer) obj).filters);
}
```

and `AnnotationCustomizableTypeExcludeFilter.equals` compares, among other things,
`getComponentIncludes()` — which for `WebMvcTypeExcludeFilter` is the `controllers` array. Those
`equals`/`hashCode` implementations exist for no other reason than this comparison.

The consequence is arithmetic. `@WebMvcTest(OrderController.class)` and
`@WebMvcTest(CustomerController.class)` are **not** cache-compatible: two filters, two customizers,
two keys, two application contexts built and held for the duration of the suite. Add
`@MockitoBean` — which also changes the key ([06b · Overriding changes the cache key](../05-the-test-pyramid/06b-overriding-changes-the-cache-key.md))
— and near enough every controller test class gets its own context.

For a handful of controllers that is fine and fast. For fifty, the suite spends its time building
contexts, and the fix is counter-intuitive: **use fewer, wider contexts.** Either one
`@WebMvcTest` per group of controllers that share collaborators, or `@SpringBootTest` with
`@AutoConfigureMockMvc`, where one cached context serves the whole suite. Measure before choosing;
the slice is not automatically the fast option.

## The other attributes, and when each earns its place

| Attribute | Use it when |
|---|---|
| `properties()` | the controller's behaviour depends on a property — `properties = "app.page-size=5"` |
| `excludeAutoConfiguration()` | one of the slice's own imported auto-configurations is in the way |
| `includeFilters()` | a bean you own is rejected by the allow-list and `@Import` is not usable |
| `excludeFilters()` | a scanned bean is present and unwanted, e.g. a `Filter` you do not want in this test |
| `useDefaultFilters = false` | you want *nothing* by default and will list everything — rare, and usually a sign the slice is wrong |

`@Import` beats `includeFilters()` almost every time: it names a class, the compiler checks it,
and a reader can see it. `includeFilters()` takes a `@ComponentScan.Filter` and matches by
pattern or type, which reintroduces exactly the "which beans are actually here?" question the
slice was supposed to answer.

## Gotchas

**★ Expecting your `@Service` to be in the slice.**
It is not on the allow-list, so the scan filter rejects it and the context fails to start with a
missing-bean error. Use `@MockitoBean`, or `@Import` the real one if it has no further
dependencies.


**★ Thinking `@WebMvcTest` disables Spring Security.**
It does the opposite: *"By default, tests annotated with `@WebMvcTest` will also auto-configure
Spring Security and `MockMvc`."* The chain that applies is Boot's default one unless you imported
yours — [08 · Security in a slice](08-security-in-a-slice.md).


**★ A bare `@WebMvcTest` that will not start.**
With no `controllers` attribute the include set contains the `@Controller` annotation, so every
controller in the application is scanned and every one of their collaborators must be satisfiable.
Name the controller under test, or supply the missing beans.

**★ Expecting `@WebMvcTest(OrderController.class)` to exclude your `@ControllerAdvice`.**
It does not. Naming controllers switches the *controller* include from the annotation to the named
classes; `@ControllerAdvice`, `WebMvcConfigurer`, `Filter`, `HandlerInterceptor` and the converters
are included either way. If an advice is interfering, exclude it deliberately.

**★ Writing one narrow `@WebMvcTest` per controller and wondering why the suite got slower.**
Each distinct `controllers` array is a different `TypeExcludeFiltersContextCustomizer`, therefore a
different cache key, therefore another application context. Fifty narrow slices is fifty contexts.

**★ Adding `@MockitoBean` and assuming the context is still shared.**
Bean overrides participate in the cache key too. A slice that differs only in which collaborator
is mocked is still a separate context.

**★ Reaching for `includeFilters()` to pull in one bean.**
`@Import(TheBean.class)` names it, the compiler checks it and a reader can see it. A scan filter
matches by pattern and can pull in more than you intended.

**★ Using `addFilters = false` to get past a security failure.**
It removes every filter from the `MockMvc` builder, not just the security one — your request
logging filter, your correlation-id filter, your encoding filter. The test then exercises a
pipeline that does not exist anywhere. [08 · Security in a slice](08-security-in-a-slice.md) has
the targeted alternatives.

**★ Forgetting that `printOnlyOnFailure` defaults to `true`.**
Adding `print()` to debug a passing test prints nothing, because the default is to print only when
the test fails. Set `printOnlyOnFailure = false` — or better, assert on the thing you were about
to read out of the dump.

## Interview questions

**★ A controller test fails to start with "no qualifying bean of type OrderService". What is
wrong, and what are the options?**
Nothing is wrong — the slice deliberately excludes `@Service`. Either `@MockitoBean OrderService`
and stub it, which is the javadoc's own recommendation, or `@Import(RealOrderService.class)` if it
is a pure function with no further dependencies, or step up to `@SpringBootTest` with
`@AutoConfigureMockMvc` if you actually want the whole application behind the controller.


**★ When would you use `@SpringBootTest @AutoConfigureMockMvc` instead of `@WebMvcTest`?**
When you want the real configuration — your security chain, your converters, your advice, your
filters — rather than a filtered subset, and the annotation's javadoc suggests exactly that. It
also often wins on total suite time, because one full context is cached and shared while a
codebase full of differently-narrowed slices creates a new context per distinct configuration.


**★ Why does security apply in a `MockMvc` slice test at all, given that `MockMvc` starts no
container?**
Because `@AutoConfigureMockMvc` defaults `addFilters()` to `true`, so the context's `Filter` beans
— including `springSecurityFilterChain` — are registered with the `MockMvc` builder and run
through `MockFilterChain` before `DispatcherServlet`. Filters in a `MockMvc` test are the ones the
builder was told about, and in a Boot slice the builder is told about the context's.


**★ What is the difference between `@WebMvcTest` and `@WebMvcTest(OrderController.class)`?**
More than scope. With no attribute, the `@Controller` annotation itself is in the include set, so
every controller in the application is scanned. With an attribute, `@Controller` is removed from
the include set and the named classes are added as component includes instead — so only those
controllers are scanned. Everything else on the allow-list — advice, `WebMvcConfigurer`, filters,
interceptors, converters — is included in both cases.

**★ Does narrowing a slice make the suite faster?**
Not necessarily, and often the reverse. The type-exclude filter is a `ContextCustomizer` whose
`equals` compares the filter set, and context customizers are part of the context cache key. Every
distinct `controllers` array is therefore a distinct context. A suite of fifty single-controller
slices builds fifty contexts; one wider slice per group, or `@SpringBootTest` with
`@AutoConfigureMockMvc`, may build one or two.

**★ How do you get a bean into the slice that the allow-list rejects?**
`@Import(TheClass.class)` — explicit, compiler-checked and visible. `includeFilters()` also works
and matches by type or pattern, which makes the resulting bean set harder to predict, so keep it
for cases where `@Import` genuinely cannot express what you need.

{/* FOOTER */}
