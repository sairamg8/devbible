---
title: "@WebMvcTest(OrderController.class) narrows the controllers and not the advices, so every @ControllerAdvice in your application is loaded into the slice and consulted in an order most of them never declare — and the first one with a matching @ExceptionHandler wins, which makes 'which handler produced this 400?' a question your test has to answer rather than assume"
sidebar_label: "07 · Exception handlers"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> [`ExceptionHandlerExceptionResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ExceptionHandlerExceptionResolver.java),
> [`ControllerAdviceBean`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/ControllerAdviceBean.java),
> [`HandlerTypePredicate`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/HandlerTypePredicate.java),
> the [`@ControllerAdvice`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/bind/annotation/ControllerAdvice.java)
> javadoc, and `WebMvcConfigurationSupport.addDefaultHandlerExceptionResolvers` — plus the
> **Spring Boot 4.1.1** sources for `AutoConfigureWebMvc.imports`, `ProblemDetailsExceptionHandler`
> and [`DefaultErrorAttributes`](https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/error/DefaultErrorAttributes.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, Mockito 5.23.0,
> AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[06](06-validation-errors.md) established that the error body in a slice comes from a
`@ControllerAdvice` and not from `/error`. This chunk is the advice as a testable unit, and its
argument is uncomfortable: `@WebMvcTest(OrderController.class)` isolates one controller and
isolates none of your advices. All of them load. They are consulted in an order four codebases out
of five never declare, and the first with a matching `@ExceptionHandler` method wins. A test that
asserts a 409 and passes may be passing because of an advice you were not thinking about.**

## The chain your exception actually walks in a `@WebMvcTest`

`DispatcherServlet` collects every `HandlerExceptionResolver` bean and sorts them. In a Boot slice
there are two, because `AutoConfigureWebMvc.imports` pulls in `ErrorMvcAutoConfiguration`:

| Order | Bean | What it does with your exception |
|---|---|---|
| `HIGHEST_PRECEDENCE` | `DefaultErrorAttributes` | stores it in a request attribute, **returns `null`** — resolves nothing |
| `0` | `handlerExceptionResolver`, a `HandlerExceptionResolverComposite` | delegates to the three below, in order |
| — | `ExceptionHandlerExceptionResolver` | your `@ExceptionHandler` methods: controller-local first, then advices |
| — | `ResponseStatusExceptionResolver` | `@ResponseStatus` on the exception class, and `ResponseStatusException` |
| — | `DefaultHandlerExceptionResolver` | Spring's own MVC exceptions → `sendError` ([06](06-validation-errors.md)) |

`DefaultErrorAttributes.resolveException` is three lines and the third is `return null`:

```java
@Override
public @Nullable ModelAndView resolveException(HttpServletRequest request, HttpServletResponse response,
        @Nullable Object handler, Exception ex) {
    storeErrorAttributes(request, ex);
    return null;
}
```

It is a resolver that never resolves; it exists so `/error` can read the exception later, and in
`MockMvc` "later" never arrives because there is no error dispatch
([01b](01b-the-blank-request.md)). The interesting position is the first resolver that *can*
resolve, and that is `ExceptionHandlerExceptionResolver` — always ahead of `@ResponseStatus` and
always ahead of Spring's defaults. **Any `@ExceptionHandler` that matches pre-empts both of the
other two resolvers**, which is why adding one advice changes the status of tests you did not
touch. The chain itself is
[02 · The resolver chain](../../phase-9-spring-boot/09-error-handling/02-the-resolver-chain.md).

## Every advice is in the slice; narrowing the controllers does not narrow the advices

`@ControllerAdvice` is on `WebMvcTypeExcludeFilter`'s include list ([02](02-webmvctest.md)), and
the `controllers` attribute of `@WebMvcTest` only restricts which `@Controller` classes are scanned
([02b](02b-narrowing-and-what-it-costs.md)). The result is asymmetric and it surprises people:

- `@WebMvcTest(OrderController.class)` → one controller, **all** advices.
- An advice that catches `Exception` in some other package is in your slice, sorted ahead of or
  behind yours by rules nobody wrote down, and can answer for an exception you meant to handle.

The mirror-image failure is a load failure. `@ControllerAdvice` is a `@Component` specialisation,
so it is constructed like one, and its dependencies must be satisfiable:

```java
@RestControllerAdvice
class ApiExceptionHandler {
    private final ErrorCodeCatalog catalog;   // a plain @Component
    ApiExceptionHandler(ErrorCodeCatalog catalog) { this.catalog = catalog; }
}
```

`ErrorCodeCatalog` is annotated `@Component`, which is **not** on the allow-list. The advice is
scanned, the catalog is not, and the context fails to start with an unsatisfied dependency — in a
test class whose only change was adding an unrelated controller. `@MockitoBean ErrorCodeCatalog`
or `@Import(ErrorCodeCatalog.class)` both fix the load; importing the real one is usually right,
because the catalog is part of the error contract you are trying to assert and a mock of it turns
the assertion into a tautology.

## The controller's own `@ExceptionHandler` beats every advice

`getExceptionHandlerMethod` searches the controller class hierarchy **before** it looks at a single
advice, and returns on the first match:

```java
if (handlerMethod != null) {
    // Local exception handler methods on the controller class itself.
    handlerType = handlerMethod.getBeanType();
    ExceptionHandlerMethodResolver resolver = this.exceptionHandlerCache.computeIfAbsent(
            handlerType, ExceptionHandlerMethodResolver::new);
    for (MediaType mediaType : acceptedMediaTypes) { /* … return on first match … */ }
}

for (Map.Entry<ControllerAdviceBean, ExceptionHandlerMethodResolver> entry :
        this.exceptionHandlerAdviceCache.entrySet()) { /* … */ }
```

No `@Order` on an advice can outrank a controller-local handler, because the advice loop is never
reached. A `@RestController` with an `@ExceptionHandler(IllegalArgumentException.class)` left over
from a spike silently shadows the global advice **for that controller only** — and the slice test
for that one controller is the only test in the suite that can show it.

## Ordering between advices, and where it stops being defined

`ControllerAdviceBean.findAnnotatedBeans` ends with `OrderComparator.sort(adviceBeans)`, and the
sorted result goes into a `LinkedHashMap`, so iteration order is sorted order. `getOrder()` resolves
in four steps, in this sequence:

1. the resolved bean implements `Ordered` → its `getOrder()`;
2. the `@Bean` factory method is known → `OrderUtils.getOrder(factoryMethod)`, i.e. `@Order` /
   `@Priority` **on the factory method**;
3. the bean type is known → `OrderUtils.getOrder(beanType, Ordered.LOWEST_PRECEDENCE)`, i.e.
   `@Order` / `@Priority` on the class;
4. otherwise `Ordered.LOWEST_PRECEDENCE`.

The `@ControllerAdvice` javadoc states the rule and two carve-outs verbatim:

> *"All such beans are sorted based on `Ordered` semantics or `@Order` / `@Priority`
> declarations, with `Ordered` semantics taking precedence over `@Order` / `@Priority`
> declarations. `@ControllerAdvice` beans are then applied in that order at runtime. Note, however,
> that `@ControllerAdvice` beans that implement `PriorityOrdered` are **not** given priority over
> `@ControllerAdvice` beans that implement `Ordered`. In addition, `Ordered` is not honored for
> scoped `@ControllerAdvice` beans."*

🔴 **Two advices that declare nothing are both `LOWEST_PRECEDENCE`, and their relative order is a
tie broken by bean discovery order.** `OrderComparator.sort` is a stable sort over the list
`findAnnotatedBeans` built by walking
`beanNamesForTypeIncludingAncestors(beanFactory, Object.class)`, so the winner is whichever the
component scan registered first — a function of classpath and directory order, not of anything you
wrote. It is stable enough that your suite is green and unspecified enough that it is not a
contract. **If two advices can both answer for one exception, order at least one of them.**

The javadoc settles what "applied in that order" means for exceptions:

> *"For handling exceptions, an `@ExceptionHandler` will be picked on the first advice with a
> matching exception handler method."*

and it settles the root-versus-cause interaction, which is the subtlest rule in the area:

> *"For `@ExceptionHandler` methods, a root exception match will be preferred to just matching a
> cause of the current exception, among the handler methods of a particular advice bean. However, a
> cause match on a higher-priority advice will still be preferred over any match (whether root or
> cause level) on a lower-priority advice bean. As a consequence, please declare your primary root
> exception mappings on a prioritized advice bean with a corresponding order."*

Read the middle sentence twice. An advice at `@Order(0)` that handles `DataAccessException` takes a
`MyDomainException` **whose cause is** a `DataAccessException` away from an unordered advice that
maps `MyDomainException` exactly. Specificity does not cross advice boundaries; order does. How
specificity works *inside* one advice is [07c](07c-which-method-matches.md).

## 🔴 The collision Boot introduces the moment problem details are on

[06](06-validation-errors.md) showed `ProblemDetailsExceptionHandler` registered under
`@ConditionalOnBooleanProperty("spring.mvc.problemdetails.enabled")`. Look again at *how*:

```java
@Bean
@ConditionalOnMissingBean(ResponseEntityExceptionHandler.class)
@Order(0)
ProblemDetailsExceptionHandler problemDetailsExceptionHandler() {
    return new ProblemDetailsExceptionHandler();
}
```

`@Order(0)` is on the **factory method** — step 2 of `getOrder()`, so it is honoured. Boot's advice
sorts **ahead** of your unordered `@RestControllerAdvice` at `LOWEST_PRECEDENCE`, and it declares
handlers for twenty Spring MVC exceptions including `MethodArgumentNotValidException`,
`HandlerMethodValidationException`, `HttpMessageNotReadableException` and
`MissingServletRequestParameterException`. If your advice maps any of those without declaring an
order, **Boot's advice answers and yours never runs** — and only when the property is on, which is
why it reproduces in production and not in a test that forgot to set it.

Two fixes, both fine: give your advice `@Order(Ordered.HIGHEST_PRECEDENCE)` so it sorts first, or
extend `ResponseEntityExceptionHandler` yourself so the `@ConditionalOnMissingBean` backs Boot's
out entirely ([07e](07e-what-the-handler-produces.md)). What is not fine is leaving it undeclared
and testing with the property unset.

[07b](07b-which-advice-applies.md) continues the mechanism: why narrowing an advice with
`assignableTypes` silently removes it from every 404. [07c](07c-which-method-matches.md) is how the
winning advice picks between its own handler methods.
[07d](07d-tests-that-pin-the-handler.md) is the three tests that pin all of it down, and how to
test an advice with no context at all. [07e](07e-what-the-handler-produces.md) and
[07f](07f-responseentityexceptionhandler.md) are what the winning handler is allowed to return.

## Gotchas

**★ Believing `@WebMvcTest(OrderController.class)` isolates you from other advices.**
It narrows the component scan to one `@Controller`. `@ControllerAdvice` is a separate entry on the
allow-list, so every advice in the application is loaded, sorted and consulted. The slice isolates
the controller, never the error handling.

**★ Two unordered advices that can both handle the same exception.**
Both are `Ordered.LOWEST_PRECEDENCE`; the tie is broken by bean discovery order, which follows the
classpath. The suite stays green until a package is renamed. Put `@Order` on at least one of them
and pin it with the ordering test in [07d](07d-tests-that-pin-the-handler.md).

**★ Your advice stopped running after someone set `spring.mvc.problemdetails.enabled=true`.**
Boot's `ProblemDetailsExceptionHandler` is registered with `@Order(0)` on the factory method, which
`ControllerAdviceBean.getOrder()` honours, so it sorts ahead of your unordered advice and claims all
twenty exceptions it declares. Order your advice, or extend `ResponseEntityExceptionHandler` so
Boot's backs off.

**★ A controller-local `@ExceptionHandler` shadowing the global advice.**
`getExceptionHandlerMethod` searches the controller's own class hierarchy first and returns on the
first match; the advice loop is never reached, and no `@Order` helps. Grep the controllers for
`@ExceptionHandler` before you debug the advice.

**★ Assuming a more specific mapping in a lower-priority advice beats a cause match in a
higher-priority one.**
It does not: *"a cause match on a higher-priority advice will still be preferred over any match
(whether root or cause level) on a lower-priority advice bean."* Specificity is compared only
within one advice class.

**★ A `@ControllerAdvice` whose collaborator is a plain `@Component`.**
The advice is on the allow-list, the collaborator is not, and the context fails to start with an
unsatisfied dependency. `@Import` the collaborator when it is part of the error contract; mocking
it usually mocks away the thing under test.

**★ Reading `DefaultErrorAttributes` as "something handles my exception".**
Its `resolveException` stores the exception in a request attribute and returns `null`. It resolves
nothing; it exists so a later error dispatch to `/error` can describe the failure, and `MockMvc`
performs no error dispatch.

**★ Adding an advice and watching unrelated tests change status.**
`ExceptionHandlerExceptionResolver` runs first in the composite, so a new
`@ExceptionHandler(Exception.class)` claims everything Spring's own resolvers used to answer —
including validation failures and 405s that had well-defined default statuses. Map narrow types, or
map `Exception` deliberately and re-run the whole suite.

**★ Registering an advice as a request-scoped or session-scoped bean.**
*"`Ordered` is not honored for scoped `@ControllerAdvice` beans"* — `getOrder()` deliberately avoids
resolving a scoped proxy's target during context initialisation, so it falls through to the
class-level `@Order` or to `LOWEST_PRECEDENCE`. A scoped advice with `implements Ordered` is
silently unordered.

## Interview questions

**★ Does `@WebMvcTest(OrderController.class)` load your `@ControllerAdvice`?**
Yes — all of them. The `controllers` attribute narrows which `@Controller` classes the component
scan accepts; `@ControllerAdvice` is a separate entry on `WebMvcTypeExcludeFilter`'s include list
and is unaffected. So the slice gives you one controller and your whole error-handling layer, which
is usually what you want and occasionally the reason a test passes for the wrong reason.

**★ Two advices can both handle `IllegalStateException`. Which one runs?**
The first in sorted order with a matching handler method — *"an `@ExceptionHandler` will be picked
on the first advice with a matching exception handler method."* Sorting is `OrderComparator.sort`
over `ControllerAdviceBean.getOrder()`, which reads `Ordered`, then `@Order` or `@Priority` on the
`@Bean` method, then on the class, and otherwise returns `Ordered.LOWEST_PRECEDENCE`. If neither
declares an order they are tied and the winner is bean discovery order — not a contract.

**★ When is an exception's *cause* consulted, and how does that interact with ordering?**
Only as a fallback within a single advice: the whole advice is searched for the thrown type first,
and only if nothing matches does the resolver recurse into `getCause()`. Across advices the rule
inverts — a cause-level match on a higher-priority advice beats a root-level match on a
lower-priority one, which is why the javadoc says to *"declare your primary root exception mappings
on a prioritized advice bean with a corresponding order."*

**★ Which resolver gets the exception first, and why does that matter for a test?**
`ExceptionHandlerExceptionResolver` — first in the composite that
`WebMvcConfigurationSupport.addDefaultHandlerExceptionResolvers` builds, ahead of
`ResponseStatusExceptionResolver` and `DefaultHandlerExceptionResolver`. It matters because adding
one `@ExceptionHandler` changes the response for every exception it matches, including ones Spring
handled itself: a `@Valid` failure that returned an empty-bodied 400 starts returning your body the
moment an advice claims `MethodArgumentNotValidException`, and tests you did not touch change.

**★ Your advice does not run for one particular controller, but runs everywhere else. Where do you
look?**
At that controller. `getExceptionHandlerMethod` resolves handler methods on the controller's own
class hierarchy before consulting any advice and returns on the first match, so a local
`@ExceptionHandler` — possibly inherited from a shared base controller — shadows the advice for
that controller alone. Ordering cannot override it, because the advice loop is never entered.

{/* FOOTER */}
