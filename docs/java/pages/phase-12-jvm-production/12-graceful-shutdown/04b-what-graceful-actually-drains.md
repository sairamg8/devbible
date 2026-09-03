---
title: "In-flight HTTP requests drain; a Server-Sent Events stream, a WebSocket and a long poll do not finish on their own — for those, 'graceful' is a decision you have to make rather than a behaviour you can enable"
sidebar_label: "04b · What graceful actually drains"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 reference**, "Web → Graceful Shutdown"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)) —
> including its statements about persistent connections and network-layer rejection — and the
> **Kubernetes** "Pod Lifecycle" documentation for what happens when the grace period expires.
> 🔴 **No sandbox** — no connection was opened or drained for this page.

**"Existing requests will be allowed to complete" is precise and narrower than it sounds. It
covers requests that will complete on their own, within the timeout. Not every open connection
is one of those.**

## The clean case

A normal request-response exchange — a REST call, a form post, a page render — is in flight for
milliseconds to seconds. Graceful shutdown stops new connections at the network layer and waits
for these to finish. Nothing is dropped, and the wait is short.

⚠️ **The only tuning question here is the tail**: is your slowest legitimate request shorter
than `spring.lifecycle.timeout-per-shutdown-phase`? A report endpoint that takes 45 seconds is
cut off by a 20-second phase timeout, gracefully-configured or not.

🔴 **Measure the p99.9 of your slowest endpoint before choosing the timeout**, and remember the
whole chain has to fit inside Kubernetes' grace period
(**08b** *(not written yet)*).

## The connections that do not end by themselves

| Connection | Why draining does not apply | What "graceful" has to mean |
|---|---|---|
| **Server-Sent Events** | The response is open indefinitely by design | Close the stream deliberately, letting the client reconnect elsewhere |
| **WebSocket** | Long-lived, bidirectional, not a request | Send a close frame with a status so the client reconnects rather than errors |
| **Long polling** | The request is *waiting*, not working | Return the empty/timeout response early so the client re-polls elsewhere |
| **Streaming download / upload** | Duration is data-size-bound | Usually let it be cut; retry-with-range is the client's job |
| **gRPC streams** | Long-lived like WebSockets | Half-close the stream; rely on the client's reconnect |
| **SSE-like reactive `Flux`** | Completes when the publisher does | Complete or error the publisher explicitly at shutdown |

🔴 **The pattern is the same in every row: end the connection deliberately, early, with
something the client can interpret as "reconnect", rather than waiting for a timeout and being
killed mid-stream.** A close frame is graceful; a reset is not.

⚠️ **If you do nothing, the phase timeout expires and the server stops anyway** — so the choice
is not between draining and closing, it is between closing at a moment you chose and closing at
`SIGKILL`.

## Persistent connections

The documentation flags keep-alive as a complication:

> *"The use of persistent connections can also change the way that requests stop being
> accepted."*

An established keep-alive connection can carry a *new* request into a server that has begun
draining. Different servers handle that differently; the reference points at each server's
`shutDownGracefully` API documentation. ⚠️ **In practice this is another argument for the
readiness handshake** (**08** *(not written yet)*): the reliable way to stop
new requests arriving on old connections is for the routing layer to stop using the instance
before the drain begins.

## Where the boundary sits

Spring's graceful shutdown owns **the web server's inbound work**. It does not own:

- background tasks and schedulers ([06](06-executors-and-schedulers.md));
- message consumers, whose "in-flight work" is an unacknowledged message
  ([06b](06b-message-consumers.md));
- outbound calls your handlers are making — those finish or fail with the request;
- anything started with a bare `new Thread(...)`, which nothing tracks at all.

🔴 **That last one is worth stating plainly: work handed to an untracked thread is invisible to
every shutdown mechanism in this topic.** Use the container's executors so shutdown can see them.

## Async request handling

A servlet request that returned a `DeferredResult`, a `CompletableFuture` or a reactive publisher
is still "in flight" while the container waits for completion — but the work is happening on
another thread, possibly in an executor that shutdown is about to stop. ⚠️ **The ordering trap:
stopping the executor before the web layer finishes draining cancels the very work the drain is
waiting for.** Phase ordering ([05b](05b-smartlifecycle-and-phases.md)) is what prevents that,
and it is a real bug rather than a theoretical one.

## Gotchas

🔴 **A request slower than the phase timeout is cut regardless.** Graceful means bounded.

🔴 **WebSockets and SSE need explicit closing**, or they consume the whole grace period doing
nothing and end in a reset.

⚠️ **Keep-alive connections can deliver a new request during the drain.** Server-specific
behaviour; the readiness handshake is the general answer.

⚠️ **Async handlers depend on executors that shutdown may stop first.** Order phases so the
executors outlive the web layer's drain.

⚠️ **`new Thread(...)` work is untracked** and will simply die. If it matters, it belongs in a
managed executor.

⚠️ **A long-running upload cut mid-stream leaves a partial object** wherever it was being
written. Idempotency and cleanup are the backstop (**09** *(not written yet)*).

⚠️ **Clients differ in how they treat a WebSocket close code.** Choosing a code that signals
"go away and reconnect" rather than "fatal error" is part of the design.

## Interview questions

**★ What exactly does Spring's graceful shutdown drain?**
In-flight requests to the embedded web server, within the phase timeout, while new requests are
refused at the network layer. It does not drain background tasks, message consumers or anything
running on threads it does not manage.

**★ Why is a WebSocket not covered by "existing requests will be allowed to complete"?**
Because it never completes on its own — it is a long-lived connection, not a request. The
application has to close it deliberately, ideally with a close frame the client interprets as a
reason to reconnect elsewhere.

**★ How should SSE and long polling be handled at shutdown?**
By ending them early and deliberately: complete the stream, or return the empty long-poll
response, so the client re-establishes against another instance instead of being reset when the
timeout expires.

**★ What is the risk with persistent connections?**
An already-established keep-alive connection can carry a new request into a draining server.
Behaviour is server-specific, so the reliable mitigation is to have the routing layer stop using
the instance before the drain starts.

**★ What is the ordering trap with async request handling?**
The web layer is waiting for work running on an executor; if that executor is stopped first, the
work it is waiting for is cancelled. Phases must be arranged so executors outlive the web
server's drain.

**★ How do you choose the phase timeout?**
From the measured tail latency of your slowest legitimate endpoint, with room to spare, and
small enough that the whole shutdown — preStop wait, phases, exit — fits inside the container's
termination grace period.

**★ What happens to work started on a bare `new Thread(...)`?**
Nothing tracks it, so no shutdown mechanism waits for it. It is killed when the JVM exits. Work
that must survive shutdown belongs in a managed executor with a lifecycle.

Next: [The order of teardown](05-the-order-of-teardown.md).

{/* FOOTER */}
