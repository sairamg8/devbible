---
title: "Inside one advice the matching method is chosen by hierarchy distance and never by declaration order, the cause chain is only a fallback that runs after the whole advice has been searched for the thrown type, and two methods claiming one exception break the CONTEXT for an advice but only the REQUEST for a controller"
sidebar_label: "07c · Which method matches"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-30 against the **Spring Framework 7.0.9** sources —
> [`ExceptionHandlerMethodResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-web/src/main/java/org/springframework/web/method/annotation/ExceptionHandlerMethodResolver.java)
> (class javadoc, constructor, `detectExceptionMappings`, `addExceptionMapping`, `getMappedMethod`,
> `resolveExceptionMapping`, the `ExceptionMapping` record and `ExceptionMappingComparator`) and
> [`ExceptionHandlerExceptionResolver`](https://github.com/spring-projects/spring-framework/blob/v7.0.9/spring-webmvc/src/main/java/org/springframework/web/servlet/mvc/method/annotation/ExceptionHandlerExceptionResolver.java)
> (`afterPropertiesSet`, `initExceptionHandlerAdviceCache`, `exceptionHandlerCache`,
> `doResolveHandlerMethodException`), plus the `@ControllerAdvice` javadoc on root-versus-cause
> matching.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (sources read at 7.0.9 / 4.1.1), JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[07](07-exception-handlers.md) chose the advice and [07b](07b-which-advice-applies.md) confirmed
it applies to this controller. Now one class holds five `@ExceptionHandler` methods and exactly one
of them runs. Nothing about that choice is visible in the file: it is not declaration order, it is
not annotation order, and the mappings do not even live in an ordered collection. It is hierarchy
distance, and the two places it surprises people are the cause chain and the duplicate mapping that
fails the context rather than the request.**

## Selection *within* one advice: depth, then media type — never declaration order

`ExceptionHandlerMethodResolver.getMappedMethod` collects every mapping whose exception type
`isAssignableFrom` the thrown type, sorts when there is more than one, and takes the first:

```java
List<ExceptionMapping> matches = new ArrayList<>();
for (ExceptionMapping mappingInfo : this.mappedMethods.keySet()) {
    if (mappingInfo.exceptionType().isAssignableFrom(exceptionType)
            && mappingInfo.mediaType().isCompatibleWith(mediaType)) {
        matches.add(mappingInfo);
    }
}
if (!matches.isEmpty()) {
    if (matches.size() > 1) {
        matches.sort(new ExceptionMappingComparator(exceptionType, mediaType));
    }
    return Objects.requireNonNull(this.mappedMethods.get(matches.get(0)));
}
```

`ExceptionMappingComparator` compares on `ExceptionDepthComparator` first — **the mapped type
closest to the thrown type in the class hierarchy wins** — and only breaks a depth tie on media
type. So inside one advice, `@ExceptionHandler(OrderNotFound.class)` beats
`@ExceptionHandler(RuntimeException.class)` regardless of where either sits in the file. There is
no `@Order` for methods and you do not need one. Note also that `mappedMethods` is a `HashMap`, so
the iteration order feeding `matches` is not meaningful — only the comparator is.

Cause traversal is a *fallback*, not a competitor:

```java
public @Nullable ExceptionHandlerMappingInfo resolveExceptionMapping(Throwable exception, MediaType mediaType) {
    ExceptionHandlerMappingInfo mappingInfo = resolveExceptionMappingByExceptionType(exception.getClass(), mediaType);
    if (mappingInfo == null) {
        Throwable cause = exception.getCause();
        if (cause != null) {
            mappingInfo = resolveExceptionMapping(cause, mediaType);
        }
    }
    return mappingInfo;
}
```

The whole advice is searched for the top-level type first; only if nothing matches at all is the
cause tried, recursively. That is the *"a root exception match will be preferred to just matching a
cause"* rule, implemented — and it is per-advice, which is why [07](07-exception-handlers.md)'s
ordering rule dominates it across advices.

One consequence worth holding for a test: **the handler method can declare the cause as its
parameter and still be invoked**. `doResolveHandlerMethodException` walks the cause chain and
passes every level as a candidate argument:

```java
Throwable exToExpose = exception;
while (exToExpose != null) {
    exceptions.add(exToExpose);
    Throwable cause = exToExpose.getCause();
    exToExpose = (cause != exToExpose ? cause : null);
}
```

so a handler mapped on a cause receives the cause, not the wrapper — which changes what your error
body can say. If your test asserts a detail message taken from the exception, that detail comes
from whichever level matched.

## The mapping key is a *pair*, and that is why some duplicates are legal

The mappings are keyed by a record, not by an exception type:

```java
private record ExceptionMapping(Class<? extends Throwable> exceptionType, MediaType mediaType) { }
```

and the constructor registers one entry per (exception type × producible media type), falling back
to `MediaType.ALL` when the handler declares no `produces`:

```java
for (Class<? extends Throwable> exceptionType : mappingInfo.getExceptionTypes()) {
    for (MediaType producibleType : mappingInfo.getProducibleTypes()) {
        addExceptionMapping(new ExceptionMapping(exceptionType, producibleType), mappingInfo);
    }
    if (mappingInfo.getProducibleTypes().isEmpty()) {
        addExceptionMapping(new ExceptionMapping(exceptionType, MediaType.ALL), mappingInfo);
    }
}
```

Two consequences a test depends on. **One:** a handler with no `produces` is registered against
`MediaType.ALL`, and matching is `mappingInfo.mediaType().isCompatibleWith(requested)` — it matches
every request, so media type never discriminates until at least one handler declares `produces`.
**Two:** two methods mapping the same exception with *different* `produces` values are two distinct
keys and are perfectly legal; the same two without `produces` collide. That is
[07f](07f-responseentityexceptionhandler.md)'s subject, and it is also why the duplicate check
below sometimes does not fire when you expect it to.

## 🔴 A duplicate mapping fails the context for an advice and the request for a controller

`addExceptionMapping` throws while the resolver is being *constructed*:

```java
ExceptionHandlerMappingInfo oldMapping = this.mappedMethods.put(mapping, mappingInfo);
if (oldMapping != null && !oldMapping.getHandlerMethod().equals(mappingInfo.getHandlerMethod())) {
    throw new IllegalStateException("Ambiguous @ExceptionHandler method mapped for [" +
            mapping + "]: {" + oldMapping.getHandlerMethod() + ", " + mappingInfo.getHandlerMethod() + "}");
}
```

*When* that constructor runs is the whole difference:

- **Advice.** All advice resolvers are built in `initExceptionHandlerAdviceCache()`, called from
  `ExceptionHandlerExceptionResolver.afterPropertiesSet()`. Two methods in one advice mapping the
  same exception type break the **application context**, and every test in the class errors before
  a single request is built.
- **Controller.** The resolver is built lazily —
  `this.exceptionHandlerCache.computeIfAbsent(handlerType, ExceptionHandlerMethodResolver::new)` —
  on the first exception thrown by that controller. The same duplicate surfaces at request time as
  an **unresolved** exception ([03c](03c-resolved-and-unresolved-failures.md)) with the
  `IllegalStateException` inside it.

Same bug, two entirely different-looking failures. The class javadoc lists all three
`IllegalStateException` cases together:

> *"This will throw `IllegalStateException` instances if: No Exception information could be found
> for a method · An invalid `MediaType` has been declared as `@ExceptionHandler` attribute ·
> Multiple handlers declare the same exception + media type mapping"*

The first of those is the one people hit by accident: an `@ExceptionHandler` with no `value()` and
no `Throwable` parameter — for example a handler refactored to take only `HttpServletRequest` —
throws `"No exception types mapped to " + method` at construction.

What any of this looks like as an executable assertion — including a plain JUnit test that asserts
which method a given exception type selects, with no Spring context at all — is
[07d · Tests that pin the handler](07d-tests-that-pin-the-handler.md).

## Gotchas

**★ Expecting declaration order inside an advice to matter.**
It does not. `ExceptionMappingComparator` sorts by `ExceptionDepthComparator` — hierarchy distance
from the thrown type — and only breaks depth ties on media type. Moving the catch-all method to the
bottom of the file changes nothing, and neither does moving it to the top. The mappings live in a
`HashMap` anyway.

**★ Two `@ExceptionHandler` methods in one advice mapping the same exception type.**
`ExceptionHandlerMethodResolver`'s constructor throws
`IllegalStateException("Ambiguous @ExceptionHandler method mapped for …")`, and for an advice that
constructor runs inside `afterPropertiesSet()` — so the **context** fails and every test in the
class errors before a request is made. The message names both methods; read it instead of
suspecting the slice.

**★ The same ambiguity on a controller looking like a completely different bug.**
There the resolver is built lazily on the first exception from that controller, so the
`IllegalStateException` arrives during exception resolution and comes back as an *unresolved*
failure ([03c](03c-resolved-and-unresolved-failures.md)) rather than a startup error.

**★ An `@ExceptionHandler` with neither a `value()` nor a `Throwable` parameter.**
`detectExceptionMappings` throws `"No exception types mapped to " + method`. It happens when
someone refactors the exception parameter out of a handler that now only takes the request.
**★ Assuming an `@ExceptionHandler` with no `produces` competes on media type.**
A mapping declared without `produces` is registered against `MediaType.ALL`, and matching is
`mappingInfo.mediaType().isCompatibleWith(requested)`, so it matches everything. Media type only
discriminates once at least one mapping declares `produces` ([07f](07f-responseentityexceptionhandler.md)).

**★ Forgetting that a handler mapped on a *cause* receives the cause.**
`doResolveHandlerMethodException` exposes every level of the cause chain as a candidate argument,
so a method declaring `@ExceptionHandler(SQLException.class)` gets the `SQLException`, not the
`DataAccessException` that wrapped it. Any message or code your body derives from the parameter
comes from the level that matched.

**★ Forgetting that handler methods are inherited.**
The class javadoc is explicit — the resolver *"discovers `@ExceptionHandler` methods in a given
class, **including all of its superclasses**"*. A shared abstract base advice contributes its
mappings to every subclass, so a subclass that re-maps an exception the base already maps is the
duplicate that fails the context, and a subclass that maps nothing still handles everything the
base did.

**★ Expecting a private or package-private `@ExceptionHandler` to be skipped.**
Method selection is `AnnotatedElementUtils.hasAnnotation(method, ExceptionHandler.class)` over
`MethodIntrospector.selectMethods`, not a visibility check. Reducing a handler's visibility does not
take it out of the mapping; deleting the annotation does.

## Interview questions

## Interview questions

**★ Inside one advice, does declaration order decide which `@ExceptionHandler` matches?**
No. `ExceptionHandlerMethodResolver` collects every mapping whose type is assignable from the
thrown type and sorts them with `ExceptionDepthComparator`, so the closest ancestor in the class
hierarchy wins; media type only breaks a depth tie. An `@ExceptionHandler(RuntimeException.class)`
declared above `@ExceptionHandler(OrderNotFound.class)` does not shadow it, and the mappings are
held in a `HashMap` so file order is not even preserved.

**★ Your whole test class fails to load with "Ambiguous `@ExceptionHandler` method mapped for". What
happened, and why did the same mistake on a controller behave differently?**
Two methods in one advice mapped the same exception type, and `ExceptionHandlerMethodResolver`'s
constructor throws on the duplicate. For advices that constructor runs inside
`ExceptionHandlerExceptionResolver.afterPropertiesSet()`, so it is a context failure and nothing in
the class runs. Controller-local resolvers are built lazily on the first exception from that
controller, so the identical duplicate surfaces at request time as an unresolved exception instead.
**★ An exception is thrown wrapped in another. Which handler is chosen, and what does it receive?**
Within an advice, the resolver first tries every mapping against the top-level exception type; only
if none matches does it recurse into `getCause()`. So the wrapper wins if anything maps it, and the
cause is a fallback. Whichever level matched, the resolver exposes the entire cause chain as
candidate arguments, so a handler declaring the cause type is invoked with the cause instance —
which matters if your error body derives its detail from the parameter.

**★ You move three `@ExceptionHandler` methods into an abstract base class that two advices extend.
What changes?**
Both advices now declare those mappings, because `ExceptionHandlerMethodResolver` discovers methods
*"including all of its superclasses"*. If either subclass already mapped one of those exceptions,
that is now a duplicate in a single class and the constructor throws at context startup. And if both
advices are consulted for the same controller, they are now two advices that can both answer for the
same exception, which puts you back on [07](07-exception-handlers.md)'s ordering tie.

{/* FOOTER */}
