---
title: "Declaring any selector at all on a @ControllerAdvice makes it unreachable for every failure where no handler was chosen — every 404, every multipart resolution error — because HandlerTypePredicate returns false for a null controller type, and basePackages is a raw string prefix on the class name rather than a package test"
sidebar_label: "07b · Which advice applies"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> [`HandlerTypePredicate`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/HandlerTypePredicate.java)
> (`test`, and the `basePackages` / `assignableTypes` / `annotations` comparisons),
> [`ControllerAdviceBean.isApplicableToBeanType`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/ControllerAdviceBean.java),
> `ExceptionHandlerExceptionResolver.getExceptionHandlerMethod` (the advice-applicability loop and
> the JDK-proxy target-class fix-up), and the
> [`@ControllerAdvice`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/bind/annotation/ControllerAdvice.java)
> javadoc for the selector attributes.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, Mockito 5.23.0,
> AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[07](07-exception-handlers.md) established that every advice in the application is loaded into the
slice and sorted. Before an advice is even asked whether it has a matching method, it is asked
whether it *applies to this controller* — and that question has an answer for the case where there
is no controller. This chunk is that check, the three selectors that trigger it, and what each one
actually compares. [07c](07c-which-method-matches.md) is the method-level match that happens after
it.**
## Narrowing an advice, and the `null` handler type that voids it

Three selectors, `OR`-ed, checked at request time:

```java
@RestControllerAdvice(assignableTypes = OrderController.class)   // that controller and its subtypes
@RestControllerAdvice(basePackages = "com.acme.api.orders")      // controllers in that package tree
@RestControllerAdvice(annotations = PublicApi.class)             // controllers carrying that annotation
```

> *"If multiple selectors are declared, boolean `OR` logic is applied, meaning selected controllers
> should match at least one selector. Note that selector checks are performed at runtime, so adding
> many selectors may negatively impact performance and add complexity."*

`ExceptionHandlerExceptionResolver` calls `advice.isApplicableToBeanType(handlerType)` before
consulting the advice, and that delegates to `HandlerTypePredicate.test`:

```java
public boolean test(@Nullable Class<?> controllerType) {
    if (!hasSelectors()) {
        return true;
    }
    else if (controllerType != null) {
        // basePackages / assignableTypes / annotations checks
    }
    return false;
}
```

🔴 When **no handler was chosen**, `handlerType` is `null`: a 404 (`NoResourceFoundException`,
`NoHandlerFoundException`), a failure during multipart resolution, an exception raised before the
handler is selected. An advice with **no** selectors returns `true` and handles it. An advice with
**any** selector returns `false` and does not. Adding `assignableTypes = OrderController.class` to
tidy an advice silently removes it from every handler-less failure in the application, and those
responses revert to whatever the resolvers below produce — an empty-bodied `sendError`
([06](06-validation-errors.md)).

The test that catches it is one line and belongs in every API's suite:

```java
@Test
void an_unmapped_path_still_returns_the_published_error_shape() {
    assertThat(mvc.get().uri("/orders/nope/nope").accept(MediaType.APPLICATION_JSON))
        .hasStatus(HttpStatus.NOT_FOUND)
        .bodyJson().extractingPath("$.code").isEqualTo("NOT_FOUND");
}
```

⚠️ For `NoHandlerFoundException` to be raised at all rather than the servlet container answering,
`spring.mvc.throw-exception-if-no-handler-found` and static-resource handling matter. In Boot 4 an
unmatched path under the resource handler surfaces as `NoResourceFoundException`, which
`ResponseEntityExceptionHandler` declares. **I could not confirm from the Boot 4.1 documentation
which of the two your application will see for a given path**, and it depends on your resource
configuration — so write the test against the status and shape you publish, and read the exception
type off `result.getResolvedException()` once rather than assuming it.

The broader lesson: `assignableTypes` is a poor way to split advices. Prefer one unnarrowed advice
plus distinct exception types, and reserve the selectors for a genuinely separate API surface
(`/api/**` versus `/admin/**`) where a handler-less 404 body per surface is something you actually
want to differ.

## What the selectors actually compare

The three checks are not what their names suggest, and the source is short enough to read:

```java
for (String basePackage : this.basePackages) {
    if (controllerType.getName().startsWith(basePackage)) {
        return true;
    }
}
for (Class<?> clazz : this.assignableTypes) {
    if (ClassUtils.isAssignable(clazz, controllerType)) {
        return true;
    }
}
for (Class<? extends Annotation> annotationClass : this.annotations) {
    if (AnnotationUtils.findAnnotation(controllerType, annotationClass) != null) {
        return true;
    }
}
```

- **`basePackages` is a raw string prefix on the fully-qualified class name**, not a package
  containment test. `basePackages = "com.acme.api"` also matches `com.acme.apiv2.OrderController`
  and `com.acme.apixyz.Anything`. The javadoc offers `basePackageClasses` as a *"Type-safe
  alternative to `basePackages` for specifying the packages in which to select controllers to be
  advised"* — use that, or make the prefix end at a package boundary you control.
- **`assignableTypes` accepts supertypes and interfaces.** `ClassUtils.isAssignable(declared,
  controllerType)` is true when the controller *is a* declared type, so naming a marker interface
  the controllers implement is a maintainable way to group them; naming a concrete controller
  covers its subclasses too.
- **`annotations` uses `AnnotationUtils.findAnnotation`**, so a meta-annotated composed annotation
  on the controller counts.

One subtlety that only bites proxied controllers: the advice check runs against the **target**
class, not the proxy.

```java
// For advice applicability check below (involving base packages, assignable types
// and annotation presence), use target class instead of interface-based proxy.
if (Proxy.isProxyClass(handlerType)) {
    handlerType = AopUtils.getTargetClass(handlerMethod.getBean());
}
```

So a controller wrapped in a JDK interface proxy — by `@Validated`, by an interceptor, by anything
that produces a `java.lang.reflect.Proxy` — still matches `basePackages` and `assignableTypes`
against its real class. Note that this reassignment happens *after* the controller-local handler
lookup, which used `handlerMethod.getBeanType()`; **I could not confirm from the source what
`getBeanType()` returns for a JDK-proxied controller**, so if you rely on a controller-local
`@ExceptionHandler` on a proxied controller, prove it with a test rather than reasoning about it.
## What a narrowed advice does to a slice test

The slice loads every advice ([07](07-exception-handlers.md)) and applicability is decided per
request, so a narrowed advice in a `@WebMvcTest` is in one of three states, and only one of them is
the one you meant:

| Situation | What the test sees |
|---|---|
| advice's selector matches the controller under test | your body — the intended case |
| advice's selector names a **different** controller | the advice is loaded, sorted, and never applies; every error falls through to the resolvers below and the body is empty |
| no handler was chosen (404, multipart failure) | the advice never applies, whichever controller is under test |

Row two is the expensive one, because the advice is still constructed — so its dependencies still
have to be satisfiable and it still costs you the context — while contributing nothing. A
`@WebMvcTest(OrderController.class)` whose only advice is narrowed to `CustomerController` reads
like a fully wired error-handling test and is testing Spring's defaults.

There is no clean unit-level assertion for "does this advice apply to that controller": the
predicate lives inside a `ControllerAdviceBean` built from the bean factory. Assert it the way a
client would — one request per controller that should be advised:

```java
@ParameterizedTest
@ValueSource(strings = {"/orders/0", "/orders/0/lines"})
void every_orders_endpoint_reports_errors_in_the_published_shape(String path) {
    assertThat(mvc.get().uri(path))
        .hasStatus(HttpStatus.NOT_FOUND)
        .bodyJson().extractingPath("$.code").isEqualTo("ORDER_NOT_FOUND");
}
```

## Gotchas

**★ Adding `assignableTypes` or `basePackages` to an advice and losing the 404 body.**
`HandlerTypePredicate.test` returns `false` for a `null` handler type as soon as *any* selector is
present, and the handler type is `null` whenever no handler was chosen — 404s, multipart resolution
failures, pre-handler exceptions. An unnarrowed advice handles those; a narrowed one does not.

**★ Reading `basePackages` as a package check.**
It is `controllerType.getName().startsWith(basePackage)` — a string prefix on the FQCN. A sibling
package whose name begins with the same characters is silently included. `basePackageClasses` is
the javadoc's *"Type-safe alternative to `basePackages`"* and does not have this failure mode.

**★ Expecting `assignableTypes = SomeController.class` to mean "only that class".**
`ClassUtils.isAssignable(declared, controllerType)` matches subclasses and implementors too, so a
test-only subclass or a second controller extending a shared base is also advised. If you meant
exactly one class, there is no selector for that — use distinct exception types instead.

**★ Narrowing an advice to a controller that is not in the slice.**
The advice still loads, still has to have its dependencies satisfied and still costs you a context
— and never applies. Every error in the test falls through to Spring's defaults, and the test reads
like it is exercising your error handling.

**★ Treating the selectors as a scan-time filter.**
They are evaluated on every request that raises an exception: *"selector checks are performed at
runtime, so adding many selectors may negatively impact performance and add complexity."* They do
not remove the advice from the context, and they do not stop its dependencies being required.

**★ Splitting one API's error handling across several narrowed advices.**
Each of them loses the handler-less failures, and now none of them owns the 404. One unnarrowed
advice with distinct exception types is almost always the right shape; reserve selectors for a
genuinely separate surface — `/api/**` versus `/admin/**` — where you *want* the two 404 bodies to
differ, and then test both.

## Interview questions

**★ You add `assignableTypes = OrderController.class` to an advice and your 404 test starts failing.
Why?**
`HandlerTypePredicate.test` short-circuits: with no selectors it returns `true` unconditionally,
but once any selector is declared it returns `false` for a `null` controller type — and the
controller type is `null` when no handler was ever chosen, which is exactly the 404 case. The
narrowed advice is no longer consulted, so the response falls through to
`ResponseStatusExceptionResolver` or the defaults and loses its body.

**★ Your advice is scoped with `basePackages = "com.acme.api"` and it started advising a controller
in `com.acme.apiv2`. Is that a bug in Spring?**
No — it is the documented mechanism read too generously. `HandlerTypePredicate` compares with
`controllerType.getName().startsWith(basePackage)`, a plain string prefix over the fully-qualified
class name, with no package-boundary logic. `com.acme.apiv2.OrderController` starts with
`com.acme.api`. Switch to `basePackageClasses`, the javadoc's *"Type-safe alternative to
`basePackages` for specifying the packages in which to select controllers to be advised"*, and the
ambiguity disappears.

**★ An advice narrowed with `assignableTypes` is in your `@WebMvcTest` but never runs. Is it
excluded from the slice?**
No — it is loaded, its dependencies are resolved, it is sorted into the advice cache and it costs
you exactly what an applying advice costs. `isApplicableToBeanType` simply returns `false` for the
controller under test on every request, so the exception falls through to the resolvers below and
the response is whatever Spring's defaults produce. The give-away is a slice test full of
error-shape assertions that only pass on status.

**★ How do you test that an advice covers every endpoint it is supposed to?**
Not by inspecting the predicate — it is built from the bean factory and there is no clean seam. Do
it the way a client experiences it: a parameterized test that drives one failing request per path
in the advised surface and asserts the published error code each time. That also catches the case
nobody else catches, which is a new controller added to the package after the advice was narrowed
by `assignableTypes` rather than by package.

{/* FOOTER */}
