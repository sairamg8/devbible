---
title: "The gaps: the window your advice covers, and the filter outside it"
sidebar_label: "15 · The gaps"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the Spring Framework reference *Exceptions*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/exceptionhandlers.html
> — the resolver chain contract and the **Container Error Page** section); the
> Spring Boot reference *Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html — the `/error`
> mapping); the Jakarta Servlet 6.1 javadoc for `HttpServletResponse.sendError`
> (jakarta.ee/specifications/servlet/6.1/apidocs); and the
> `WebMvcConfigurationSupport` javadoc for the `handlerExceptionResolver`
> composite bean (docs.spring.io/spring-framework/docs/current/javadoc-api).
> One behaviour is cited from the Framework **source**, where the reference is
> silent, and is marked as such. Spring Boot 4.1.1, Spring Framework 7.0.x,
> JDK 25.

**Everything in the preceding fourteen chunks is true inside exactly one window:
the stretch of code the `DispatcherServlet` wraps in a `try`. Outside it your
advice does not exist. The list of places outside it is short, finite and
learnable — and each is a real production incident where someone spent a day
asking why their handler was "not being called". It is being called. It is being
called for the requests that got far enough to reach it.**

## The window your advice actually covers

`DispatcherServlet.processHandlerException` is where the chain from
[chunk 2](02-the-resolver-chain.md) is walked, and it is reached only from the
`catch` inside `doDispatch`. So the covered window opens when the
`DispatcherServlet` begins dispatching and closes when it returns. Inside it:
handler lookup, `HandlerInterceptor.preHandle`, argument resolution, message
converters *reading* the request, your controller method, and return-value
handling.

Two details from that method's source explain behaviour you would otherwise
call a bug. Before consulting any resolver it clears `Content-Type` and
`Content-Disposition` and calls `response.resetBuffer()` — which is why a
handler that had already written half a success body still gets a clean error
body, provided nothing was flushed. And that reset is wrapped in a
`catch (IllegalStateException)` whose entire body is the comment *"the response
is already committed, leave it to exception handlers anyway"*. Commitment is not
an error path here; it is a known state the framework shrugs at, and
[chunk 19](19-committed-responses.md) is what it costs you.

## The four gaps, and which chunk owns each

A throw in a servlet **`Filter`** never reaches the chain at all — that is this
chunk. Anything that reaches no resolver, including a failure inside one of your
own `@ExceptionHandler` methods, ends at **`/error`**
([chunk 16](16-the-error-floor.md)). A throw on a worker thread after the
container thread was released comes back through an `ASYNC` dispatch
([chunk 17](17-async-requests.md), [chunk 18](18-timeouts-and-async.md)). And a
throw after the response is **committed** can be reported to nobody — which also
explains why two of an interceptor's three callbacks are too late to matter
([chunk 19](19-committed-responses.md)). Everything else — handler lookup,
`preHandle`, argument resolution, request-reading converters, your controller
method — is inside the window and behaves exactly as chunks 1–14 describe.

## A servlet `Filter` is outside the servlet

This is the single most-asked question about Spring error handling, and the
answer is structural rather than configurational. The filter chain **wraps** the
`DispatcherServlet`; the `DispatcherServlet` does not wrap the filter chain. An
exception thrown in `doFilter` therefore never enters `doDispatch`, so
`processHandlerException` is never called, so no `HandlerExceptionResolver` —
including the one that invokes `@ExceptionHandler` methods — is ever consulted.

What the client gets instead is the path from
[chunk 1](01-the-error-shape-is-a-contract.md): the exception propagates to the
container, the container makes an `ERROR` dispatch to the error page Boot
registered, and `BasicErrorController` produces Boot's default body. Your
`ProblemDetail` contract, your `type` URIs, your correlation-id extension
member — all absent, on exactly the requests a caller is most likely to be
confused by, because authentication, rate limiting and tenant resolution all
live in filters.

**It is worse on the far side of `chain.doFilter`**, where the response has
usually been committed already and *nothing* can change it —
[chunk 19](19-committed-responses.md).

## Fix A — hand the exception to the same chain deliberately

The MVC config registers the composite resolver as a bean named
`handlerExceptionResolver`. Its javadoc: it returns a
*"`HandlerExceptionResolverComposite` containing a list of exception resolvers"*
— by default the same three from [chunk 2](02-the-resolver-chain.md). A filter
can inject it and call it:

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ApiKeyFilter extends OncePerRequestFilter {

    private final HandlerExceptionResolver resolver;

    public ApiKeyFilter(@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
        this.resolver = resolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        try {
            chain.doFilter(req, res);
        }
        catch (ApiKeyException ex) {
            // null handler: there is no HandlerMethod, because mapping never happened
            resolver.resolveException(req, res, null, ex);
        }
    }
}
```

⚠️ **Read the `null` carefully.** You are passing "no handler", because at
filter time there is none. Controller-local `@ExceptionHandler` methods
([chunk 4](04-handler-signatures.md)) therefore cannot match, and any advice
scoped by `assignableTypes` or `annotations`
([chunk 5](05-controlleradvice.md)) has no controller type to be scoped
against. If your error contract lives in one unscoped `@RestControllerAdvice`
this works cleanly; if you scoped your advices, verify the behaviour for your
version rather than assuming it.

⚠️ **The `catch` must be narrow.** Catching `Exception` re-routes every failure
from every downstream filter *and the whole dispatch* back through the resolver
chain — including exceptions the `DispatcherServlet` already resolved and
responded to. Catch your own filter's exception type and nothing else.

## Fix B — write the response in the filter and do not throw at all

More code, zero magic, and it is the honest choice when the filter runs before
anything Spring-shaped exists:

```java
private void writeProblem(HttpServletResponse res, HttpStatus status, String detail) throws IOException {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setType(URI.create("https://api.example.com/problems/api-key-invalid"));
    pd.setTitle("API key invalid");

    res.setStatus(status.value());
    res.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    jsonMapper.writeValue(res.getOutputStream(), pd);   // the CONFIGURED mapper, not a new one
}
```

Three things go wrong here, each worth stating.

**Use the injected mapper.** A freshly constructed one loses
`ProblemDetailJacksonMixin`, and your extension members come out nested under
`properties` instead of at the top level ([chunk 7](07-extension-members.md)).

**Use `setStatus` plus a written body — never `sendError`.** The Servlet javadoc
is explicit that `sendError` *"[s]ends an error response to the client using the
specified status and clears the buffer"*, and that *"[i]f an error-page
declaration has been made … it will be served back in preference to the
suggested msg parameter"*. Boot registers exactly such a declaration, so
`sendError` here deliberately discards your body and routes to `/error` — the
one outcome you were trying to avoid.

**Return, do not continue.** After writing you must not call `chain.doFilter`
and nothing downstream may write again — the same javadoc's *"should be
considered to be committed and should not be written to"* applies in spirit to
any body you write yourself.

## Fix C — do not use a filter

An interceptor's `preHandle` runs inside the window, so an exception thrown
there reaches your advice normally — the point
[chunk 2](02-the-resolver-chain.md) makes in its interceptor question. Use a
filter only when you genuinely need to see requests that never reach a handler,
or to wrap the request or response objects. Choosing between the two in general
is
[Topic 10 — the request pipeline](../10-the-request-pipeline/README.md)'s job;
choosing for *error shaping* has a one-line answer — the interceptor is inside
the window and the filter is not.

**Spring Security is the worked example.** Its filter chain translates
`AuthenticationException` and `AccessDeniedException` itself, which is why an
`@ExceptionHandler(AccessDeniedException.class)` frequently never fires —
[chunk 12](12-validation-and-foreign-exceptions.md).

## The trade-off

Closing this gap costs duplication: the error-shaping logic now exists in the
advice and again in the filter, and the two drift. Fix A minimises the
duplication and buys it back with a `null` handler whose consequences you have
to know. Fix B duplicates the most and surprises the least.

The proportionate answer for most services is to fix **the status and the
response header everywhere, and the body only where clients branch on it.** A
correlation id set as a header by an early filter
([chunk 14](14-correlation-ids-and-logging.md)) survives every gap on this page,
because it is written before anything can fail; a perfectly-shaped
`ProblemDetail` for a request that died in the security filter chain is a far
larger investment serving a far smaller class of caller.

## Gotchas

**⚠️ The handler that "is never called"**
**Symptom:** an `@ExceptionHandler` for your own exception type never fires and
the client gets Boot's default JSON.
**Cause:** the throw happened in a filter. Nine times in ten it is
authentication, rate limiting, or a request-logging filter that reads the body.
**Fix:** Fix A, B or C above — but confirm the diagnosis first by logging inside
the filter's `catch`. If that line appears and the advice's does not, this is
it.

**⚠️ `sendError` deletes your body**
**Symptom:** a filter writes a careful `ProblemDetail` and the client receives
Boot's `/error` body instead.
**Cause:** the code called `sendError(...)`, which clears the buffer and prefers
a registered error page over anything you supplied.
**Fix:** `setStatus(...)` and write the body. Never both mechanisms in one
filter.

**⚠️ Extension members come out nested**
**Symptom:** the filter's problem body reads
`{"properties":{"correlationId":"…"}}` instead of a top-level field.
**Cause:** the filter constructed its own JSON mapper, losing Spring's
`ProblemDetailJacksonMixin` registration.
**Fix:** inject the configured mapper; customise it with
`JsonMapperBuilderCustomizer` (Boot 4) rather than building one.

**⚠️ The resolver-injection fix swallows the whole application's errors**
**Symptom:** after adding Fix A, unrelated 500s start returning odd bodies, or
responses are written twice.
**Cause:** the filter caught `Exception` rather than its own type, so exceptions
that the dispatch had already resolved and responded to were pushed back through
the resolver chain.
**Fix:** narrow the `catch` to the filter's own exception type.

## Interview questions

**★ My `@ControllerAdvice` handler is not being called. Give me your list of
causes, in order.**
First: was the exception thrown inside the `DispatcherServlet`'s dispatch? If it
came from a servlet filter — security, rate limiting, request logging — the
resolver chain is never consulted and the container's `/error` page produced the
response. Second: was the response already committed, so the reset failed and
nothing could be written? Third: did an earlier resolver claim it, or is a more
specific handler in a higher-priority advice winning
([chunk 3](03-matching-which-handler-wins.md))? Fourth: is the advice scoped so
that it does not apply to that controller? Fifth: did the handler method itself
throw? The first is by far the most common, and it is not a misconfiguration —
it is the shape of the servlet stack.

**★ Why can't `@ExceptionHandler` see an exception from a `Filter`?**
Because the filter chain wraps the `DispatcherServlet`, not the other way round.
`processHandlerException` — the only place the resolver chain is walked — is
reached from a `catch` inside `doDispatch`, and a filter's exception is thrown
either before `doDispatch` is entered or after it has returned. The container
sees it, and Boot has registered `/error` as the container's error page, so that
is what produces the response.

**★ How would you make a filter produce the same error body as the rest of your
API?**
Either inject the `handlerExceptionResolver` composite bean and call
`resolveException(req, res, null, ex)` from a narrow `catch`, which reuses the
whole `@ExceptionHandler` machinery; or build and write the `ProblemDetail` in
the filter using the injected JSON mapper. The first duplicates less but passes
a `null` handler, so controller-local handlers and type-scoped advices cannot
match. The second is more code and no surprises. Both must use `setStatus` and
write the body, never `sendError`.

**★ Why is `sendError` the wrong call in a JSON API?**
Because it is defined to clear the buffer and to hand the response to the
container's error-page mechanism, which in a Boot application is `/error`. So it
throws away any body you prepared and substitutes Boot's default shape. It also
commits the response — the javadoc says that afterwards the response *"should be
considered to be committed and should not be written to"* — so anything
downstream that tries to write gets an error of its own.

**★ Is a `try`/`catch` around `chain.doFilter` enough to close the gap?**
Only for exceptions thrown *downstream of that filter and upstream of the
response being committed*. It does nothing for a failure in a filter ordered
before yours, and nothing at all once the response has been committed — which
covers most of what happens on the far side of `chain.doFilter`. It is a real
fix for a real subset, not a general one.

**★ When would you deliberately choose a filter over an interceptor, knowing
this gap exists?**
When you need to see traffic that never reaches a handler — unmapped paths,
requests rejected before mapping, anything where there is no `HandlerMethod` to
intercept — or when you must wrap the request or response objects, which only a
filter can do. Correlation-id generation is the canonical example: it has to
cover the 404 for a mistyped URL too, so it must be a filter, and the price is
that you set a header rather than shaping a body.

---

← Prev: [Correlation ids and logging](14-correlation-ids-and-logging.md) · Index: [Error handling](README.md) · Next → [The /error floor](16-the-error-floor.md)
