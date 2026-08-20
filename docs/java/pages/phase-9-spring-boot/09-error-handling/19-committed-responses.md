---
title: "Committed responses: the errors nobody can report"
sidebar_label: "19 · Committed responses"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the Jakarta Servlet 6.1 javadoc for
> `ServletResponse` (`isCommitted`, `reset`, `resetBuffer`, `flushBuffer`,
> `setBufferSize`) and `HttpServletResponse` (`sendError`, `setStatus`,
> `setHeader`) at jakarta.ee/specifications/servlet/6.1/apidocs; the
> `AsyncRequestNotUsableException`, `ResponseEntityExceptionHandler` and
> `DefaultHandlerExceptionResolver` javadoc
> (docs.spring.io/spring-framework/docs/current/javadoc-api); the Framework
> reference *Interception*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/handlermapping-interceptor.html);
> and the Boot reference note that *"[t]he error page filter can only forward
> the request to the correct error page if the response has not already been
> committed"* (docs.spring.io/spring-boot/reference/web/servlet.html).
> `DispatcherServlet.processHandlerException` and
> `HandlerExecutionChain.triggerAfterCompletion` are cited from the Framework
> **source**. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**There is a point in every response after which your error handling is
decoration. Once the status line and headers are on the wire, no advice, no
`ProblemDetail`, no resolver and no property can change what the client will
receive — the best anyone can do is stop writing and log. This is the one gap in
this topic with no fix, only mitigations, and pretending otherwise is how a
service ends up returning `200 OK` for an operation that failed.**

## "Committed" is a precise state, not a vague one

The Servlet javadoc defines it in one sentence: *"A committed response has
already had its status code and headers written."* And `flushBuffer` says
*"[f]orces any content in the buffer to be written to the client. A call to this
method automatically commits the response, meaning the status code and headers
will be written."*

So commitment is caused by bytes leaving, and bytes leave for three ordinary
reasons:

- **the buffer filled.** The container buffers response body up to the size
  `getBufferSize` reports; beyond that it flushes and the response commits. This
  is why the same bug is invisible on a small response and fatal on a large one.
- **something called `flushBuffer`**, directly or through a `flush()` on the
  writer or stream.
- **the response completed**, or `sendError` was called — after which *"the
  response should be considered to be committed and should not be written to"*.

The consequence nobody plans for: **whether an error is reportable depends on
the size of the successful part of the response.** A `@RestController` returning
ten records recovers from a serialisation failure on record nine. The same code
returning ten thousand does not.

## What stops working, exactly

| Call | Behaviour once committed |
|---|---|
| `sendError(int)` / `sendError(int, String)` | *"throws an IllegalStateException"* |
| `reset()` | *"If the response has been committed, this method throws an IllegalStateException."* — clears buffer, status **and** headers |
| `resetBuffer()` | same exception; clears the body buffer only |
| `setStatus(int)` | *"has no effect if called after the response has been committed"* — silent |
| `setHeader(String, String)` | *"has no effect if called after the response has been committed"* — silent |
| `setBufferSize(int)` | throws `IllegalStateException` once content has been written |

Note the split: the calls that would *undo* what was sent throw, and the ones
that would *contradict* it fail silently. That silence is why this bug is found
in production rather than in review — a `setStatus(500)` in a `catch` block
looks like it did something.

Spring knows about this at both ends of the chain.
`DispatcherServlet.processHandlerException` clears `Content-Type` and calls
`response.resetBuffer()` inside a `catch (IllegalStateException)` whose entire
body is the comment *"the response is already committed, leave it to exception
handlers anyway"*. At the other end,
`ResponseEntityExceptionHandler.handleExceptionInternal` is documented to return
*"a `ResponseEntity` for the response to use, possibly `null` when the response
is already committed"* — the base class declining to build a body it cannot
send.

Even Boot's WAR-deployment fallback has the same caveat: *"[t]he error page
filter can only forward the request to the correct error page if the response
has not already been committed."* Every layer of the stack has the same floor
under it.

## `AsyncRequestNotUsableException`: the exception for "there is no response"

Spring has a dedicated type for this, and its javadoc is worth reading closely:

> *"Raised when the response for an asynchronous request becomes unusable as
> indicated by a write failure, or a Servlet container error notification, or
> after the async request has completed. The exception relies on response
> wrapping, and on `AsyncListener` notifications, managed by
> `StandardServletAsyncWebRequest`."*

Three triggers; the third is [chunk 18](18-timeouts-and-async.md)'s timeout case
— the request finished and your task is still writing to it. What the framework
does with it is the honest part. `ResponseEntityExceptionHandler` handles it
with a method that — uniquely among its handlers — takes neither headers nor a
status, and *"[b]y default, return[s] `null` since the response is not
usable"*, while `DefaultHandlerExceptionResolver` is listed with **no** status
mapping and *"[b]y default, do[es] nothing since the response is not usable."*

**Read that as a design statement, not an omission.** Spring declines to handle
this because there is nothing to handle it *with*: an `@ExceptionHandler` for
`AsyncRequestNotUsableException` can log and clean up, and cannot inform
anybody.

## Why `ProblemDetail` cannot save you here

Everything from [chunk 6](06-problemdetail-and-rfc-9457.md) onward assumes you
get to choose the response body. RFC 9457 describes a *body*, and a body is sent
after a status line that has already gone. There is no mechanism in it — no
sentinel, no trailer, no in-band error marker — for saying "disregard the two
megabytes you just received". HTTP has trailers, but their support across
proxies and client libraries is uneven enough that a service cannot rely on a
client reading one.

So the client's experience of a mid-write failure is a `200 OK`, a
`Content-Type` promising JSON, and a body that stops mid-sentence. Whether it
notices depends on framing:

- **`Content-Length` set** — the connection closes short, and a well-written
  client raises a transport error. This is the good case, and it happens only
  when the whole body was buffered, which is the case where the error was
  recoverable anyway.
- **Chunked transfer encoding** — the terminating zero-length chunk is never
  sent, so a careful client sees a premature end-of-stream. Many clients report
  this clearly; some report it as an empty or truncated result.
- **A parser that tolerates truncation** — the worst case. A client reading
  NDJSON line by line, or catching parse errors and returning what it has,
  reports success for a partial result.

The lesson generalises past Spring: **a failure you cannot report is one you
must make detectable by design** — [chunk 20](20-designing-for-unreportable-failures.md).

## The late callbacks are the same problem wearing a different hat

Once you have the commitment model, two things from earlier in this topic stop
being quirks and become consequences.

**`postHandle` runs after the response is written.** The reference: *"For
`@ResponseBody` and `ResponseEntity` controller methods, the response is written
and committed within the `HandlerAdapter`, before `postHandle` is called. That
means it is too late to change the response, such as to add an extra header."*
An exception thrown there *does* still reach the resolver chain — and the chain
will try to write an error body over a response that is already gone, which is
exactly the silent-no-op case in the table above. The documented alternative is
on the same page: *"You can implement `ResponseBodyAdvice` and declare it as a
Controller Advice bean"*, which runs **before** the body is written.

**`afterCompletion` cannot fail the request.** From
`HandlerExecutionChain.triggerAfterCompletion` in the Framework source, the call
is wrapped in `catch (Throwable ex2)` and logged with
`logger.error("HandlerInterceptor.afterCompletion threw exception in interceptor [...]")`.
Swallowed by design — the response is finished, so there is nothing left to
influence. Cleanup that lives there must not assume anyone notices it failing.

## Converters: reading is comfortable, writing is not

Reading happens during argument resolution, well inside the window
([chunk 15](15-the-gaps.md)). A malformed body fails in an
`HttpMessageConverter`, `HttpMessageNotReadableException` reaches the chain, and
`DefaultHandlerExceptionResolver` maps it to **400** — or your
`ResponseEntityExceptionHandler` override shapes it
([chunk 10](10-responseentityexceptionhandler.md)).

Writing is the asymmetric case. `HttpMessageNotWritableException` maps to
**500**, and that mapping is reachable only while the response can still be
changed. Same exception, same resolver, two completely different client outcomes
depending on how many bytes had already flushed.

## Gotchas

**⚠️ `setStatus(500)` in a `catch` that does nothing**
**Symptom:** the log says the request failed; the client received `200 OK`.
**Cause:** the response was committed, and `setStatus` *"has no effect if called
after the response has been committed"* — no exception, no warning.
**Fix:** check `response.isCommitted()` before deciding what to do, and log the
fact that you could not report the failure. There is no fix that changes what
the client got.

**⚠️ `IllegalStateException` on top of the real exception**
**Symptom:** the stack trace you are debugging is
`IllegalStateException: response already committed`, not the failure you care
about.
**Cause:** an error path called `sendError`, `reset` or `resetBuffer` after
commitment; the javadoc says all three throw.
**Fix:** guard with `isCommitted()`. Then hunt the *original* exception, which is
usually logged just above.

**⚠️ It only breaks in production**
**Symptom:** the endpoint is fine on the dev dataset and truncates on the real
one.
**Cause:** the response now exceeds the container's buffer, so it commits before
the failure. The bug did not change; the data did.
**Fix:** test error paths with production-scale responses, and treat "the
response is large enough to flush" as a functional boundary rather than a
performance one.

**⚠️ The correlation-id header is missing exactly on late failures**
**Symptom:** the errors hardest to debug are the ones with no id.
**Cause:** the header was set after `chain.doFilter` rather than before, so the
response was already committed.
**Fix:** set it before the chain runs — which is precisely why
[chunk 14](14-correlation-ids-and-logging.md)'s filter does it in that order.

**⚠️ An `@ExceptionHandler` for `AsyncRequestNotUsableException` that returns a
body**
**Symptom:** it appears to work in tests and changes nothing in production.
**Cause:** the response is by definition unusable; Spring's own handlers return
`null` and do nothing for this exception for that reason.
**Fix:** handle it for logging and cleanup only, and keep it quiet — this
exception is usually a client disconnect, and logging each one at `ERROR` will
flood you.

**⚠️ Client disconnects logged as server errors**
**Symptom:** a wall of errors during a deploy or when users navigate away.
**Cause:** a write failure on a closed connection is one of the documented
triggers for `AsyncRequestNotUsableException`.
**Fix:** log client disconnects at `DEBUG`; they are not your failures. Keep
`ERROR` for the ones that indicate your own bug, which is the level-by-status
discipline from [chunk 14](14-correlation-ids-and-logging.md).

## Interview questions

**★ What does "the response is committed" mean, and what causes it?**
That the status code and headers have been written to the client — the Servlet
javadoc's own definition. It is caused by bytes leaving: the body exceeding the
container's response buffer, an explicit `flushBuffer` or `flush()`, the
response completing, or a `sendError`. The practically important part is the
first one, because it makes reportability a function of response size rather
than of your code.

**★ A serialisation error happens halfway through writing a large JSON array.
What does the client get?**
A `200 OK`, a `Content-Type` of `application/json`, and a truncated body. The
status line went out when the buffer first flushed, so nothing can change it —
`setStatus` silently no-ops, `reset` throws. The exception is real and it is in
your log; it is simply not in the response. Whether the client notices depends
on framing: with `Content-Length` or chunked encoding a careful client sees a
premature end, and a tolerant parser sees a short list.

**★ Why does `ResponseEntityExceptionHandler` sometimes return `null`?**
Because its `handleExceptionInternal` is documented to return *"possibly `null`
when the response is already committed"*. Returning a `ResponseEntity` that
cannot be sent would be worse than returning nothing — it would mask the real
failure behind a second one. It is the framework acknowledging the same floor
your own code has to.

**★ What is `AsyncRequestNotUsableException` and how should you handle it?**
It is raised when the response for an async request becomes unusable — a write
failure, a container error notification, or the async request having already
completed. You handle it for logging and cleanup and nothing else:
`ResponseEntityExceptionHandler` returns `null` for it *"since the response is
not usable"* and `DefaultHandlerExceptionResolver` does nothing for the same
reason. It is very often a client disconnect, so it belongs at `DEBUG`, not
`ERROR`.

**★ Why can't RFC 9457 help once the response is committed?**
Because `ProblemDetail` describes a response *body*, and a body follows a status
line that has already been sent. There is no in-band way in the format to
retract what the client has received. HTTP trailers exist in principle, but
support across proxies and client libraries is too uneven to build a contract
on. The problem is not that Spring lacks a mechanism; it is that HTTP does not
offer one at this point.

**★ Why is `postHandle` nearly useless in a REST API, and what replaces it?**
Because for `@ResponseBody` and `ResponseEntity` methods the response is written
and committed inside the `HandlerAdapter` before `postHandle` is called, so
adding a header or changing the status silently does nothing. `ResponseBodyAdvice`
replaces it for anything body- or header-related, because it runs before the
write. Anything that must be present even when the handler fails belongs in a
filter, earlier still.

**★ An interceptor's `afterCompletion` throws. What does the client see?**
Nothing different. `HandlerExecutionChain.triggerAfterCompletion` catches
`Throwable` and logs at `ERROR` — the response is finished, so there is nothing
to change. The implication is that cleanup or auditing placed there fails
invisibly to every metric you have except that one log line, so either monitor
the line or move the work somewhere failure is observable. This comes from the
Framework source rather than the reference, so treat the exact message as
version-specific.

**★ The same exception type gives a clean 500 on one endpoint and a truncated
200 on another. Explain.**
`HttpMessageNotWritableException` maps to 500 through the ordinary chain, and
that mapping can only take effect while the response is still changeable. On the
endpoint with a small body nothing had flushed, so
`processHandlerException`'s `resetBuffer` succeeded and the error body replaced
the partial one. On the endpoint with a large body the buffer had already
flushed, the reset threw and was swallowed, and the client kept the 200 it had
already been given. Same code, same exception, different response size.

---

← Prev: [Timeouts and @Async](18-timeouts-and-async.md) · Index: [Error handling](README.md) · Next → [Designing for unreportable failures](20-designing-for-unreportable-failures.md)
