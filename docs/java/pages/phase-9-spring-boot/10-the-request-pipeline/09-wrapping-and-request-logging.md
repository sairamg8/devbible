---
title: "Wrapping: the power only a filter has"
sidebar_label: "9 · Wrapping and request logging"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Jakarta Servlet 6.1 javadoc for
> `jakarta.servlet.Filter` (the wrapping clauses of the `doFilter` contract), the
> Spring Framework 7.0 javadoc for `ContentCachingRequestWrapper`,
> `ContentCachingResponseWrapper` and `AbstractRequestLoggingFilter`
> (docs.spring.io/spring-framework/docs/current/javadoc-api), the Framework
> reference *Web MVC → Filters* for `ShallowEtagHeaderFilter`, and the Spring Boot
> 4.1 reference *Enable HTTP Response Compression*
> (docs.spring.io/spring-boot/how-to/webserver.html). Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**The servlet body is a stream, and a stream can be read once. That single
sentence is why "just log the request body" is the hardest cheap-sounding request
in web development, why the fix lives in a filter and nowhere else, and why the
obvious implementation produces controllers whose `@RequestBody` binds to
nothing. Wrapping is the mechanism that makes a second read possible, and it is
the one capability no interceptor and no aspect can imitate.**

## Why the body can only be read once

`HttpServletRequest.getInputStream()` and `getReader()` return a live stream over
the connection. There is no rewind, no `reset()`, no second call that starts from
the beginning. When a filter reads the body to log it, the bytes are consumed;
`DispatcherServlet` later asks the message converter to read the same stream, gets
nothing, and `@RequestBody` binds an empty object or fails — with no message
naming the filter that caused it.

The Servlet contract's answer is in the `doFilter` description itself: a filter
may "optionally wrap the request object with a custom implementation to filter
content or headers for input filtering", and do the same for the response. That
is a genuine substitution — everything downstream, including `DispatcherServlet`,
receives *your* object:

```java
chain.doFilter(new CachingRequest(request), response);   // the app sees the wrapper
```

`HttpServletRequestWrapper` and `HttpServletResponseWrapper` are the decorator
base classes: extend, override the few methods you care about, and the rest
delegates. Nothing at any other depth can do this. By the time an interceptor
runs, the request object has been fixed for the whole dispatch; an aspect never
sees it at all.

## `ContentCachingRequestWrapper`, and the caveat that defeats most uses

Spring ships the wrapper you would otherwise write. Its javadoc:

> `HttpServletRequest` wrapper that caches all content read from the input stream
> and reader, and allows this content to be retrieved via a byte array.
>
> This class acts as an interceptor that only caches content as it is being read
> but otherwise does not cause content to be read. That means if the request
> content is not consumed, then the content is not cached, and cannot be retrieved
> via `getContentAsByteArray()`.

Read the second paragraph twice, because it inverts the naive design. The wrapper
does **not** slurp the body up front. It records bytes as somebody else reads
them. So:

- Calling `getContentAsByteArray()` **before** the chain returns gives you an
  empty array.
- If the request never reaches a handler — a 404, or security rejected it — nobody
  reads the body, so there is nothing to log.
- If the handler reads only part of it, you get only that part. The related
  `AbstractRequestLoggingFilter` javadoc says the same thing about its own payload
  option: "this will only log the part of the payload which has actually been
  read, not necessarily the entire body of the request."

The correct shape follows directly: wrap on the way in, read the cache on the way
out.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 40)   // ≤ OrderedFilter.REQUEST_WRAPPER_FILTER_MAX_ORDER
class BodyLoggingFilter extends OncePerRequestFilter {

    private static final int LIMIT = 8 * 1024;   // bound it, always

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        var wrapped = new ContentCachingRequestWrapper(request, LIMIT);
        try {
            chain.doFilter(wrapped, response);          // ← the app reads through it
        } finally {
            byte[] body = wrapped.getContentAsByteArray();   // ← populated only NOW
            if (body.length > 0) {
                log.info("{} {} body={}", request.getMethod(), request.getRequestURI(),
                        redact(new String(body, StandardCharsets.UTF_8)));
            }
        }
    }
}
```

The `cacheLimit` constructor argument is not optional in spirit: the javadoc calls
it "the maximum number of bytes to cache per request; no limit is set if the value
is 0 or less. It is recommended to set a concrete limit in order to avoid using
too much memory." An unbounded cache turns a large upload into a heap copy of that
upload, per concurrent request.

## Wrapping the response, and why it is harder

`ContentCachingResponseWrapper` caches "all content written to the output stream
and writer" so you can read it back. The catch is a consequence of buffering: the
cached bytes never reach the client on their own. Its `flushBuffer()` javadoc is
explicit — "This method neither flushes content to the client nor commits the
underlying response, since the content has not yet been copied to the response.
Invoke `copyBodyToResponse()` to copy the cached body content to the wrapped
response object and flush its buffer."

So a response-caching filter that forgets `copyBodyToResponse()` in a `finally`
returns an empty body to every client. It is a total outage caused by a logging
feature, and it does not show up in a unit test of the filter.

```java
var wrapped = new ContentCachingResponseWrapper(response);
try {
    chain.doFilter(request, wrapped);
} finally {
    log.info("status={} bytes={}", wrapped.getStatus(),
             wrapped.getContentAsByteArray().length);
    wrapped.copyBodyToResponse();      // ← without this the client gets nothing
}
```

The compensation is that buffering restores a power the pipeline otherwise takes
away: while the response is held in the wrapper it is not committed, so headers can
still be set *after* the handler ran. That is how `ShallowEtagHeaderFilter` works
— the reference describes it as creating "a 'shallow' ETag by caching the content
written to the response and computing an MD5 hash from it", then comparing against
`If-None-Match` and returning 304 when they match. It cannot know the hash before
the body exists, so it must buffer.

⚠️ **Buffering has a real cost.** The whole response sits in memory, streaming
stops being streaming, and a large download becomes a heap spike proportional to
concurrency. Turn it on for the routes that need it, not globally.

## Why request logging is genuinely hard

Every item here is a reason the feature is bigger than the filter:

- **Bodies are consumed once**, so a wrapper is mandatory, and a wrapper only
  caches what was read.
- **Secrets travel in bodies.** Passwords, tokens, card numbers, personal data. A
  log of raw bodies is a compliance incident with a retention period; redaction
  has to be structural, not a regular expression over a string.
- **Multipart uploads are not text.** Logging a 50 MB file upload as a string is a
  memory and disk problem, and gives no information.
- **`Content-Type` may not be JSON**, so decoding bytes as UTF-8 can produce
  garbage or mojibake in the log.
- **Ordering matters twice.** Wrap early enough that nothing has consumed the body
  first, but the reference also warns against reading it at
  `Ordered.HIGHEST_PRECEDENCE`, where character-encoding configuration has not
  been applied yet.
- **Volume.** Full request/response logging on a busy service can generate more
  data than the service itself handles.

Spring's own `AbstractRequestLoggingFilter` — with `CommonsRequestLoggingFilter`
as its usable subclass — exists for the modest version of this and exposes exactly
the switches that keep it modest: `includeQueryString`, `includeClientInfo`,
`includeHeaders`, `includePayload`, and `maxPayloadLength`, whose default is 50
characters. That default is a hint about intended scope. For a real audit trail,
log a *structured, redacted* summary from a layer that understands the data — an
aspect over the service method, per [chunk 5](05-the-decision-table.md) — rather
than raw bytes from the edge.

## Gotchas

**⚠️ Reading the body in a filter without wrapping**
**Symptom:** `@RequestBody` binds an empty object, or the converter fails, and
nothing points at the filter.
**Cause:** the stream was consumed; there is no second read.
**Fix:** wrap with `ContentCachingRequestWrapper` and pass the wrapper to
`chain.doFilter`.

**⚠️ Calling `getContentAsByteArray()` before the chain returns**
**Symptom:** an empty body in every log line.
**Cause:** the wrapper "only caches content as it is being read"; nobody has read
it yet.
**Fix:** read the cache in the `finally`, after `chain.doFilter`.

**⚠️ Expecting a body for requests that 404 or are rejected**
**Symptom:** the interesting failures are exactly the ones with no logged body.
**Cause:** no handler read the body, so nothing was cached.
**Fix:** accept it, or read the stream deliberately in the filter — knowing that
you are now paying for it on every request.

**⚠️ Forgetting `copyBodyToResponse()`**
**Symptom:** every client receives an empty body, status codes look fine.
**Cause:** `ContentCachingResponseWrapper` holds the content until it is copied.
**Fix:** call it in a `finally`, unconditionally.

**⚠️ An unbounded cache limit**
**Symptom:** heap pressure that scales with upload size times concurrency.
**Cause:** `new ContentCachingRequestWrapper(request)` with no limit caches
everything.
**Fix:** pass a concrete `cacheLimit`, as the javadoc recommends.

**⚠️ Logging bodies with secrets in them**
**Symptom:** credentials and personal data in a log aggregator with a long
retention.
**Cause:** raw byte logging at the edge, where nothing knows what the fields mean.
**Fix:** log a redacted, structured summary from a layer that has the typed
object.

## Interview questions

**★ Why does reading the request body in a filter break the controller?**
Because the servlet body is a one-shot stream over the connection. A filter that
reads it consumes it, so when the message converter later reads the same stream it
finds nothing and `@RequestBody` binds an empty object. There is no error naming
the filter, which is what makes it expensive to diagnose. The fix is to wrap the
request so the bytes are replayable, and passing the wrapper — not the original —
to `chain.doFilter`.

**★ Explain the trap in `ContentCachingRequestWrapper`.**
It is not a buffering wrapper, it is a recording one. The javadoc says it "only
caches content as it is being read but otherwise does not cause content to be
read", so `getContentAsByteArray()` returns whatever somebody else has consumed so
far. Call it before the chain and you get an empty array; call it after and you get
what the handler read. If no handler ran — a 404, or a rejected request — you get
nothing at all.

**★ What is the one-line mistake that empties every response body?**
Wrapping the response in `ContentCachingResponseWrapper` and not calling
`copyBodyToResponse()`. The wrapper holds the content deliberately; its own
`flushBuffer()` documentation says it "neither flushes content to the client nor
commits the underlying response, since the content has not yet been copied to the
response". Put the copy in a `finally` so it survives an exception on the way out.

**★ How does `ShallowEtagHeaderFilter` set a header after the handler has run, when `postHandle` cannot?**
By buffering. It caches the content written to the response and computes an MD5
hash from it, which means the response has not been committed at the point the
hash is known — so the ETag header can still be set, and a 304 can still replace
the body. `postHandle` has no such buffer: for a `@ResponseBody` handler the bytes
have already gone to the client by then.

**★ Someone asks for full request and response body logging in production. What do you say?**
That it is a wrapper on both sides, and each has a memory cost proportional to
payload size times concurrency; that bodies contain secrets, so it needs
structural redaction and a retention policy, not a regex; that multipart uploads
must be excluded outright; and that for requests which never reach a handler there
is no body to log anyway. Then I would offer the version that actually answers
their question: a structured, redacted audit record written from an aspect over the
service method, where the data is typed and its meaning is known.

**★ A colleague wants a filter that gzips responses. Talk them out of it.**
`server.compression.enabled=true` already does it, in the container, with a
2048-byte minimum via `server.compression.min-response-size` and a fixed
content-type list adjustable through `server.compression.mime-types` or
`server.compression.additional-mime-types`. A hand-written version has to wrap the
response, negotiate `Accept-Encoding`, recompute or drop `Content-Length`, avoid
double-compressing images and archives, and coexist with every other filter that
touches the response. The container implementation has none of those bugs.

---

← Prev: [Registration and ordering](08-registration-and-ordering.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Threads, scope and async](10-threads-scope-and-async.md)
