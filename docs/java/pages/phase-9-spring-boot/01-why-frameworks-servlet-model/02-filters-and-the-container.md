---
title: "The container's own extension points"
sidebar_label: "2 · Filters and the container"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Jakarta Servlet 6.1 specification
> (jakarta.ee — `ServletContext`, `Filter`/`FilterChain`, `ServletContainerInitializer`,
> dispatcher types and mapping rules), the Spring Boot 4.0 Migration Guide
> (github.com/spring-projects/spring-boot wiki — the Servlet 6.1 baseline and
> the removal of Undertow support), and the Spring Boot reference *Servlet Web
> Applications* (docs.spring.io/spring-boot/reference/web/servlet.html —
> `FilterRegistrationBean`, `@ServletComponentScan`).
> Spring Boot 4.1.0, Spring Framework 7.0.x, Jakarta EE 11, JDK 25.

**Before Spring gets a say, the container has already offered you two extension
points of its own: `ServletContext`, which is the application-wide object
everything registers into, and the filter chain, which is the only place you
can stand *in front of* every request regardless of which handler will run.
Almost every framework feature you think of as Spring's — security, CORS,
correlation ids, request logging — is a filter underneath. Knowing that is what
lets you debug the ones that misbehave, because a filter that goes wrong fails
in ways no controller-level thinking will explain.**

## `ServletContext` — the application, not the request

`ServletContext` is one object per web application. It holds init parameters,
resource paths, and an attribute map. It is what `ServletContainerInitializer`
implementations receive at startup so they can register servlets and filters
programmatically — the hook that let Spring stop requiring `web.xml` in the
first place.

You will rarely touch it directly in a Boot application. You need to know it
exists for two reasons. It is where Spring stores its root
`WebApplicationContext`, under a well-known attribute name — which is what "the
root context" means in older Spring documentation. And it is the boundary that
makes `ServletContext` attributes application-scoped: unlike request or session
attributes, anything you put there is visible to every request and every
thread, so it carries the same shared-mutable-state warning as a servlet field.

## Filters — the only extension point the container itself offers

```java
public interface Filter {
    default void init(FilterConfig config) throws ServletException {}
    void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException;
    default void destroy() {}
}
```

A filter wraps the servlet. It sees the request before, the response after, and
decides whether to call `chain.doFilter(req, res)` at all — which makes it the
natural home for anything that must apply to *every* request regardless of
which handler runs, or that must run *before* Spring MVC has decided anything:

```java
public class CorrelationIdFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        String id = ((HttpServletRequest) req).getHeader("X-Correlation-Id");
        MDC.put("correlationId", id != null ? id : UUID.randomUUID().toString());
        try {
            chain.doFilter(req, res);       // omit this and the request stops here
        } finally {
            MDC.remove("correlationId");    // the thread is pooled and reused
        }
    }
}
```

Two details in that snippet earn their place. **Not calling `chain.doFilter` is
how a filter rejects a request** — that is the mechanism Spring Security's
entire filter chain is built on. And **the `finally` block is mandatory**,
because the request thread goes back to a pool and the next request inherits
whatever thread-locals you left behind. That failure mode is
[Phase 6 · ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)
in its most expensive form: one request logging another request's correlation
id, or worse, another user's identity.

### Registering one, and why order is explicit

Spring Boot auto-registers any `Filter` bean, mapped to `/*`. That is
convenient and it is also how people lose control of ordering, because the
default order is `Ordered.LOWEST_PRECEDENCE`. When order matters — and between
an authentication filter and a logging filter it always does — register
explicitly:

```java
@Configuration
class FilterConfig {

    @Bean
    FilterRegistrationBean<CorrelationIdFilter> correlationId() {
        var reg = new FilterRegistrationBean<>(new CorrelationIdFilter());
        reg.addUrlPatterns("/api/*");        // not everything — /actuator excluded
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);   // ✅ before security
        return reg;
    }
}
```

Lower `order` runs earlier. Spring Security installs its own chain at a
configurable order (`spring.security.filter.order`, default `-100`), so a
filter that must see the authenticated principal has to sort *after* that, and
a filter that must run on unauthenticated requests has to sort *before* it.
Getting this backwards is the single most common filter bug.

### Filters vs the two things Spring adds

Filters are container-level and see raw `ServletRequest`/`ServletResponse` —
they do not know which controller will handle the request or what it will
return. Spring adds `HandlerInterceptor`, which runs inside
`DispatcherServlet` and *does* know the handler, and AOP advice, which wraps
the method call itself. Choosing between the three is
**Topic 10 — The request pipeline** *(not written yet)*.

### Dispatcher types: the reason your filter runs twice, or not at all

A filter registration names which dispatch types it applies to —
`REQUEST` (the default), `FORWARD`, `INCLUDE`, `ERROR` and `ASYNC`. This is
why a filter can appear to run twice on one logical request (once for `REQUEST`,
once when the container forwards to an error page) and why a filter can miss
the error path entirely:

```java
reg.setDispatcherTypes(DispatcherType.REQUEST, DispatcherType.ERROR);   // both
```

## Gotchas

### A filter that swallows the chain

**Symptom.** Requests return `200` with an empty body, or hang, and no
controller breakpoint is ever hit.

**Cause.** A code path through `doFilter` that does not call
`chain.doFilter(req, res)` — usually an early `return` inside a validation
branch someone added later.

**Fix.** Make the pass-through the last statement and every rejection an
explicit, complete response:

```java
@Override
public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
        throws IOException, ServletException {
    if (((HttpServletRequest) req).getHeader("X-Api-Key") == null) {
        ((HttpServletResponse) res).sendError(401);   // ✅ terminates deliberately
        return;
    }
    chain.doFilter(req, res);                          // ✅ the only other exit
}
```

### Thread-locals left behind on a pooled thread

**Symptom.** Log lines attributed to the wrong request; a security context that
belongs to whoever used the thread before you.

**Cause.** Request threads are pooled and reused. Anything you put in a
`ThreadLocal` outlives your request unless you remove it.

**Fix.** Every `set` gets a `finally { remove(); }` in the same method — shown
in the `CorrelationIdFilter` above. Spring's own `RequestContextHolder` and
Security's context filter do exactly this, which is why they are safe and
hand-rolled equivalents usually are not.

### Filter ordering you never chose

**Symptom.** A filter reads `SecurityContextHolder.getContext().getAuthentication()`
and gets `null`, even though the request is definitely authenticated.

**Cause.** The filter was auto-registered as a plain `Filter` bean at
`LOWEST_PRECEDENCE`… which sounds like "last", but Spring Security's chain is a
single filter at order `-100`, and anything auto-registered without an explicit
order relative to it is a coin toss you did not know you were flipping.

**Fix.** Register through `FilterRegistrationBean` with an explicit `setOrder`,
or annotate the bean `@Order`. To see the authenticated principal, sort after
`spring.security.filter.order`:

```java
reg.setOrder(SecurityProperties.DEFAULT_FILTER_ORDER + 10);   // ✅ after security
```

### Reading the request body in a filter, then finding the controller sees nothing

**Symptom.** A logging filter that prints the JSON body works, and every POST
controller starts receiving an empty body.

**Cause.** `HttpServletRequest`'s body is an `InputStream` — it is consumable
once. Reading it in a filter drains it before `DispatcherServlet` ever gets
there.

**Fix.** Wrap the request so the bytes are cached and can be re-read. Spring
ships the wrapper:

```java
@Override
public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
        throws IOException, ServletException {
    var cached = new ContentCachingRequestWrapper((HttpServletRequest) req);
    chain.doFilter(cached, res);              // ✅ pass the WRAPPER downstream
    log.info("body={}", new String(cached.getContentAsByteArray()));
    // ⚠️ getContentAsByteArray() is only populated AFTER the chain has read it
}
```

### Assuming the container decodes the path the way you do

**Symptom.** A path variable containing an encoded slash (`%2F`) either 404s or
arrives already decoded and splits your parsing.

**Cause.** Servlet 6.1 leaves several path-normalization behaviours to the
container, and Tomcat rejects encoded slashes by default as a
directory-traversal defence.

**Fix.** Do not put values that may contain `/` in a path segment. Put them in
a query parameter or the body, where the encoding is unambiguous. If you truly
cannot, that is a deliberate container configuration change with a security
review attached — not a Spring setting.

## Interview questions

**★ What is a `Filter`, how does it differ from a servlet, and what does returning without calling `chain.doFilter` do?**
A filter wraps request processing: it runs before the servlet, can wrap or
replace the request and response objects, and runs again on the way out. A
servlet is the terminal handler. Not calling `chain.doFilter` terminates the
request at that filter — the servlet never runs — which is precisely how
authentication, rate limiting and CORS preflight rejection are implemented.
Spring Security is, mechanically, one servlet filter that delegates to an
ordered internal chain of its own.

**★ Why must a filter that sets a `ThreadLocal` remove it in a `finally` block?**
Because container request threads are pooled and reused for unrelated requests.
A value left in a `ThreadLocal` is inherited by whatever request lands on that
thread next, which turns a logging convenience into a cross-request data leak —
the serious version being a security context or a tenant id belonging to a
different user. The `finally` is required rather than merely tidy because an
exception thrown downstream would otherwise skip the cleanup entirely.

**★ How do you control the order filters run in, and what breaks when you don't?**
Register them as `FilterRegistrationBean` with an explicit `setOrder`, or
annotate the bean with `@Order`; lower values run earlier. A plain `Filter`
bean is auto-registered by Boot at `LOWEST_PRECEDENCE` and mapped to `/*`,
which means its position relative to Spring Security's chain (order `-100` by
default, `spring.security.filter.order`) is not something you chose. The
symptom is a filter reading `SecurityContextHolder` and getting `null` because
it ran before authentication, or an audit filter that never sees rejected
requests because it ran after.

**★ What are dispatcher types and why would a filter run twice on one request?**
A filter registration declares which `DispatcherType` values it applies to:
`REQUEST`, `FORWARD`, `INCLUDE`, `ERROR`, `ASYNC` — with `REQUEST` the default.
A container forwarding to an error page is a second dispatch of the same
underlying request, so a filter registered for both `REQUEST` and `ERROR` runs
twice. The mirror problem is more common: a filter registered only for
`REQUEST` never observes the error dispatch, so error responses escape your
logging or your correlation-id header.

**★ Why does reading the request body in a filter break the controller, and what is the fix?**
The body is exposed as an `InputStream` (or a `Reader`), and the servlet
contract permits it to be read exactly once — there is no rewind. A filter that
consumes it leaves nothing for `DispatcherServlet`'s message converters, so
`@RequestBody` binds an empty body. The fix is to wrap the request in something
that caches the bytes and replays them; Spring provides
`ContentCachingRequestWrapper` and you must pass the *wrapper* down the chain,
not the original. Note the cached bytes are only available after the chain has
actually read them, so the logging happens on the way out, not the way in.

**★ Where does `ServletContext` fit, and why does Spring documentation talk about "the root context"?**
`ServletContext` is the container's one-per-web-application object: init
parameters, resource lookup, and an attribute map. Spring stores its root
`WebApplicationContext` as a `ServletContext` attribute under a well-known key,
which is what "root context" means in the classic two-context arrangement — a
parent context of shared infrastructure beans, with each `DispatcherServlet`
owning a child context of web beans. Spring Boot collapses this to a single
context in practice, so the hierarchy is mostly something you meet in older
codebases and in the `DispatcherServlet` documentation rather than something
you configure.

---

← Prev: [The servlet contract](01-the-servlet-contract.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [DispatcherServlet](03-dispatcherservlet.md)
