---
title: "Designing for the failures you cannot report"
sidebar_label: "20 · Unreportable failures"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the Jakarta Servlet 6.1 javadoc for
> `ServletResponse.setBufferSize` / `flushBuffer` / `isCommitted`
> (jakarta.ee/specifications/servlet/6.1/apidocs); the Spring Framework
> reference *Asynchronous Requests* — HTTP Streaming (`ResponseBodyEmitter`,
> `SseEmitter`, `StreamingResponseBody`, the `IOException`/`AsyncListener`
> cleanup rule quoted below, and the streaming-media-type adaptation of
> `Flux`/`Observable`,
> docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html); the
> `ExceptionHandlerExceptionResolver` behaviour when a handler method itself
> throws, cited from the Framework **source**; and RFC 9457 for what a problem
> document is and is not. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Every other chunk in this topic has ended with a fix. This one cannot, because
the failures it covers happen after the only channel you have has closed. What
is left is design: decide per endpoint whether a response is buffered or
streamed, give the streamed ones a failure signal the protocol can carry, and
make sure that when no signal is possible the failure is still loud somewhere
you look. A truncated `200 OK` nobody notices is worse than a 500, and the
difference is a decision you make before the request arrives.**

## The one real lever: buffered or streamed, decided per endpoint

Everything reportable in [chunk 19](19-committed-responses.md) was reportable
because nothing had flushed yet, so `resetBuffer()` succeeded. That is the
lever, and it has two settings.

| | Buffered | Streamed |
|---|---|---|
| Memory | proportional to the largest response you permit | flat |
| A failure mid-serialisation | fully reportable — status and body replaced | unreportable; client keeps its `200` |
| `Content-Length` | present | absent (chunked) |
| Right for | anything that fits comfortably in memory | exports, reports, feeds, files |

**Do not let this be decided by accident.** The failure mode that hurts is an
endpoint that was buffered when written and became streamed when the data grew
past the container's buffer. Nobody changed the code; the response got bigger
and the error path silently stopped working. Two consequences:

- **Cap the responses you intend to buffer.** Pagination is the mechanism
  ([REST controllers, chunk 8](../07-rest-controllers/08-collections-and-hypermedia.md)),
  and this is a second argument for it: a bounded response has a working error
  path.
- **Make streaming a decision, not a discovery.** Returning
  `StreamingResponseBody`, `SseEmitter` or a `Flux` with a streaming media type
  is a choice, and it owes the contract in the next section. Returning a `List`
  that can grow without limit is the same choice made by accident.

`setBufferSize` is not the escape hatch it looks like: the javadoc says it
*"must be called before any response body content is written"* or it throws, and
sizing a buffer to your largest response is buffering with a worse memory
profile.

## Materialise before you write

The most common unreportable failure is not a network problem. It is code that
computes while it serialises — a lazily-loaded association, a getter that
queries, an iterator paging through a database as Jackson walks it — all of
which move work *after* the status line has gone out.

```java
// Unreportable: the query runs while Jackson is already writing.
@GetMapping("/orders")
public Stream<Order> all() {
    return orderRepository.streamAll();       // fails at row 40,000 → truncated 200
}

// Reportable: everything that can fail has failed before the first byte.
@GetMapping("/orders")
public PageResponse<OrderView> all(Pageable pageable) {
    Page<Order> page = orderRepository.findAll(pageable);
    List<OrderView> views = page.map(OrderView::from).toList();   // mapping happens here
    return new PageResponse<>(views, page.getTotalElements());
}
```

The rule generalises: **anything that can throw should throw before the response
starts.** Serialising persistence entities is the classic violation, which gives
[REST controllers, chunk 5](../07-rest-controllers/05-records-as-dtos.md) an
error-handling justification on top of its design one.

## Give a stream an in-band failure contract

When streaming is the right answer, the failure has to travel *inside* the body,
because the status line is spent. RFC 9457 has nothing to offer — a problem
document is a whole response body, not a marker you splice into one — so the
contract is yours to define and document.

**Server-sent events have this built in.** `SseEmitter` sends named events, so
an error is just another event type and the client already switches on the name:

```java
try {
    for (Batch batch : batches) {
        emitter.send(SseEmitter.event().name("batch").data(batch));
    }
    emitter.send(SseEmitter.event().name("complete").data(Map.of("count", total)));
    emitter.complete();
}
catch (IOException transportFailure) {          // client gone: do NOT complete() — see below
    log.debug("SSE client disconnected after {} batches", sent);
}
catch (ExportException workFailure) {                 // your failure, not the transport's
    log.error("Export failed after {} batches [cid={}]", sent, correlationId, workFailure);
    try {
        emitter.send(SseEmitter.event().name("error")
                .data(Map.of("title", "Export failed", "correlationId", correlationId)));
        emitter.complete();
    }
    catch (IOException alsoGone) { log.debug("Client gone before the error event"); }
}
```

⚠️ **Never clean up after an `IOException` from `send`.** The reference is
explicit: *"When an `emitter` throws an `IOException` (for example, if the
remote client went away), applications are not responsible for cleaning up the
connection and should not invoke `emitter.complete` or
`emitter.completeWithError`. Instead, the servlet container automatically
initiates an `AsyncListener` error notification, in which Spring MVC makes a
`completeWithError` call. This call, in turn, performs one final `ASYNC`
dispatch to the application, during which Spring MVC invokes the configured
exception resolvers and completes the request."* The chain runs once more, with
no usable response — [chunk 19](19-committed-responses.md) exactly.

⚠️ **`completeWithError()` is not an error response** for your own failures
either: it routes through exception handling, which on a committed response
changes nothing the client sees. Reserve it for failures before anything was
sent — once streaming, an explicit `error` event is all the client can observe.

**For NDJSON and similar line-delimited formats**, the same idea in a different
shape: reserve a record type. Every line is an object with a `type` field, the
last line is `{"type":"complete","count":N}` or
`{"type":"error","title":…,"correlationId":…}`, and — the load-bearing half —
**the client treats a stream ending without either as a failure.** Without that
clause the contract is decorative, because the case you are guarding against is
the stream that just stops.

**For a single large JSON document** there is no good in-band answer: an array
cannot carry a trailing error without breaking the format for every existing
parser, and HTTP trailers are not reliably surfaced by proxies and client
libraries. Page it, switch to a line-delimited format, or accept truncation and
make it detectable externally.

## Make the undetectable detectable

Whatever you cannot tell the client, you must be able to tell yourself.

- **Count started versus completed streams.** A metric pair makes truncation
  visible as a divergence between two numbers; nothing else does, because the
  request looks like a `200` to every HTTP-level metric you have.
- **Log the correlation id on the failure**, so a support ticket ("the export
  was short") joins to a server-side exception
  ([chunk 14](14-correlation-ids-and-logging.md)).
- **Distinguish client disconnect from server failure.** A write failure on a
  closed connection is not your bug and belongs at `DEBUG`; a serialisation
  failure at the same point is, and belongs at `ERROR`.
- **Publish the count.** If the response can say how many records it *should*
  contain — a header set before writing, or a first record — the client can
  check its own result. Cheapest detection available, and almost nobody uses it.

## The trade-off

You cannot eliminate this gap, only decide how much of your API is exposed to
it. Buffering makes errors reportable and costs memory proportional to the
largest response you allow — precisely the pressure streaming exists to avoid.
Streaming keeps memory flat and accepts unreportable late failures. Neither is
right for a whole API: decide **per endpoint on response size**, and give the
streaming ones an in-band failure contract plus the metric pair that makes
truncation visible. What is not defensible is streaming by accident.

## Gotchas

**⚠️ Streaming an entity or a lazy collection**
**Symptom:** a partially-written response, sometimes with a persistence
exception in the log.
**Cause:** serialisation triggered a lazy load, or the session closed mid-write,
long after the status line went out.
**Fix:** materialise a DTO first, so every value exists before a byte is
written — the design rule from
[REST controllers, chunk 5](../07-rest-controllers/05-records-as-dtos.md), with
an error-handling reason behind it.

**⚠️ Cleaning up after a client disconnect**
**Symptom:** duplicated or confused completion handling after an SSE client
closes its connection.
**Cause:** the code called `emitter.complete()`/`completeWithError()` on an
`IOException` from `send`, which the reference says applications *"are not
responsible for"* — the container raises the `AsyncListener` notification and
Spring makes that call itself.
**Fix:** catch that `IOException`, log at `DEBUG`, and return.

**⚠️ The in-band error contract nobody implemented client-side**
**Symptom:** the server dutifully emits `{"type":"error"}` and the client's
import succeeds with missing rows.
**Cause:** the contract was documented and never enforced — the client reads
records until the stream ends.
**Fix:** require a terminal record, and make "stream ended without a terminator"
a client-side error. Contract-test it, because it is the one path integration
tests never exercise.

**⚠️ Sizing the buffer instead of fixing the design**
**Symptom:** `setBufferSize` throws `IllegalStateException`, or memory use
climbs.
**Cause:** the call came after content was written, which the javadoc forbids;
or the buffer was sized to the largest response, which is buffering with a worse
memory profile.
**Fix:** page the endpoint, or stream it properly with a failure contract.

**⚠️ A `@ControllerAdvice` that can itself fail**
**Symptom:** occasional generic 500s with a `Failure in @ExceptionHandler`
warning next to them.
**Cause:** the handler dereferenced something null, called a service, or built a
URI from user input while handling an unrelated exception
([chunk 16](16-the-error-floor.md)).
**Fix:** keep handlers total and dependency-free; alert on that warning string.

**⚠️ Truncation invisible to every dashboard**
**Symptom:** clients report short exports; error rate, latency and status-code
panels all look healthy.
**Cause:** the response was a `200` at the HTTP layer, and nothing counts
completions.
**Fix:** the started/completed metric pair. This is the only signal that
distinguishes a finished stream from an abandoned one.

## Interview questions

**★ You must return a million rows. How do you handle a failure at row
900,000?**
You decide before the request arrives. Either the endpoint is paged, so every
response is buffered and a failure is a normal 500 — or it is streamed, in which
case the status line is long gone and the failure has to be carried in-band: an
`error` event for SSE, a terminal error record for NDJSON, and a client contract
that treats a stream ending without a terminator as a failure. Plus a
started/completed metric pair, because at the HTTP layer a truncated stream is
indistinguishable from a successful one.

**★ Why is pagination an error-handling decision as well as a performance one?**
Because a bounded response is a buffered response, and a buffered response still
has a working error path — `resetBuffer()` succeeds, the advice runs, the client
gets your `ProblemDetail`. An unbounded endpoint eventually exceeds the
container's buffer, commits early, and silently loses the ability to report any
failure after that point. The change that breaks it is not a code change; it is
the data growing.

**★ What is wrong with returning a `Stream` straight from a repository?**
It moves work after the response starts. The query is still running while
Jackson is writing, so anything that fails — a lazy load, a closed session, a
timeout — fails on a committed response and cannot be reported. Materialise into
DTOs first: everything that can throw should throw before the first byte.

**★ Can RFC 9457 describe a failure that happens mid-stream?**
No. A problem document is an entire response body with its own media type, so it
presupposes that the body has not started and the status is unchosen. Neither is
true mid-stream. HTTP trailers are the theoretical answer and are not reliably
surfaced through proxies and client libraries, so the practical answer is a
format-specific in-band signal that you define and document yourself.

**★ How would you detect that a streaming endpoint is truncating in
production?**
Two counters — streams started and streams completed cleanly — and alert on the
divergence. Every HTTP-level metric reports a `200` with a normal latency, so
nothing else will tell you. Add the correlation id to the failure log so a
customer report can be joined to the server-side exception, and consider
publishing an expected count so the client can check its own result.

**★ Your `@ExceptionHandler` throws an NPE. What does the client get?**
A generic 500 for the *original* exception, not for the NPE.
`ExceptionHandlerExceptionResolver` catches it, logs a warning naming the
handler method, and returns `null`, which means "unresolved" — so the original
exception continues down the remaining resolvers and out to `/error`
([chunk 16](16-the-error-floor.md)). The insidious part is that the symptom
points at the original failure, not at the handler, so the bug hides behind the
thing it was supposed to report.

**★ What log lines would you alert on, from this whole topic?**
`Failure in @ExceptionHandler`, because a broken handler is invisible otherwise;
`HandlerInterceptor.afterCompletion threw exception`, because that one is
swallowed entirely; and any `AsyncRequestNotUsableException` that is *not* a
client disconnect. All three share a property — the client never learns anything
went wrong — so the log line is the only evidence there is.

**★ Summarise the whole topic in one rule.**
Decide the error shape once, produce it in one place, and know precisely the
window in which that place has authority — from the `DispatcherServlet` entering
its dispatch to the moment the response commits. Outside that window, filters,
`/error`, async plumbing and commitment each have their own rules, and the only
thing that survives all of them is a correlation id written into a response
header before anything else happens.

---

← Prev: [Committed responses](19-committed-responses.md) · Index: [Error handling](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md)
