---
title: "A fourth family of detachment bugs involves no transaction annotation at all — a future, a repository Stream or a streamed HTTP response simply carries a reference off the thread or past the moment the unit of work ended"
sidebar_label: "04e · References that outlive"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.1 on persistence-context
> lifetime and thread confinement
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Spring Data JPA 4.1 reference on streaming query results
> ([docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The previous chunk's cases all involve `@Transactional` behaving differently from how it
reads. This one has no annotation problem at all. The transaction is correct, the propagation
is correct, the method is correct — and a reference to an entity is still alive somewhere
after the persistence context that produced it has gone. A future holds it. A stream is still
producing them. The container is still writing the response. The symptom is the same
exception; the cause is a lifetime mismatch between a Java reference and a database session,
and no amount of reading the transaction configuration will show it to you.** Continues
**[04d · The boundary moves](04d-the-boundary-is-not-where-you-think.md)**.

## The rule, restated for lifetimes

The introduction is unusually blunt about the constraint:

> *"A persistence context—that is, a `Session` or `EntityManager`—absolutely positively must
> not be shared between multiple threads or between concurrent transactions."*

> *"If you accidentally leak a session across threads, you will suffer."*

and about the lifetime:

> *"Furthermore, a persistence context holds a hard reference to all its entities, preventing
> them from being garbage collected. Thus, the session must be discarded once a unit of work
> is complete."*

Put those together and you get the rule this chunk is about:

🔴 **A managed entity is only meaningful inside one unit of work on one thread. Any reference
that outlives either is holding a detached object — and it does not announce it.**

## 1 · A future, an executor, `@Async`

```java
@Transactional(readOnly = true)
public CompletableFuture<Report> buildAsync(long id) {
    Order order = orders.findById(id).orElseThrow();
    return CompletableFuture.supplyAsync(() -> render(order));  // another thread, later
}
```

The lambda captures `order` and runs somewhere else at some later time. The unit of work has
ended; every unfetched association in `order` throws. The correct shape is to do the reading
before the boundary and let the future carry values:

```java
@Transactional(readOnly = true)
public ReportData load(long id) { … }              // reads everything, returns a record

public CompletableFuture<Report> buildAsync(long id) {
    ReportData data = self.load(id);
    return CompletableFuture.supplyAsync(() -> render(data));
}
```

`@Async` on a `@Transactional` method is the same problem with an extra layer: two independent
proxies, whose ordering decides whether a transaction exists on the async thread at all.
Whatever the answer, the entity that comes out was produced on one thread and is being read on
another.

## 2 · A `Stream` from a repository

Spring Data supports `Stream<T>` return types, and the reference is explicit that the result
is resource-backed:

> *"A `Stream` potentially wraps underlying data store-specific resources and must, therefore,
> be closed after usage."*

```java
@Query("select o from Order o")
Stream<Order> streamAll();
```

⚠️ The reference page does not state, in those words, that consumption must happen inside the
transaction — **I could not confirm that requirement from the documentation**. What is
documented is that the stream holds store-specific resources that must be closed, and the
mechanism follows: the elements are produced from a live result set through the
`EntityManager`, so a stream consumed after the unit of work has ended is reading through
something that is no longer there. Treat "open the stream and consume it inside the same
`@Transactional` method, in a try-with-resources" as the rule.

The variant that catches people is returning the stream from the service and consuming it in
the controller — which is exactly what the type invites.

## 3 · Streaming and deferred web responses

`StreamingResponseBody`, `ResponseBodyEmitter`, `SseEmitter`, a `Callable` return, a
`DeferredResult` — all of them exist to let the container write the response after the
controller method has returned. So the writing happens after the request-handling method
completed, which is after any transaction it started completed.

Under open-session-in-view this is the one place OSIV **also** does not save you: the
interceptor unbinds the `EntityManager` when the request handling completes, and the
asynchronous write happens after that. It is the case where "we have OSIV on, so this is fine"
is false, which is why it is worth naming explicitly. The catalogue of what breaks when OSIV
is switched off, including this shape, is
**[Topic 08 · 15c · Turning it off](../08-the-n-plus-1-problem/15c-turning-it-off.md)**.

## The other half: references that are stored rather than moved

Everything above moves a reference off the thread or past the response. The rest of the family
does something quieter — it *stores* the reference: in an HTTP session, in a cache, in an
event payload, on a message, in a field. Those are
**[04f · References that get stored](04f-references-that-get-stored.md)**.

## Gotchas

**★ Handing an entity to another thread is never safe.** Either the context has closed and the
object is detached, or it has not and you are sharing a persistence context across threads,
which Hibernate's documentation forbids in unusually blunt language. There is no third case
where it is fine.

**★ A repository method returning `Stream<Order>` invites the exact wrong usage.** The type
says "consume me lazily, later, wherever you like", and the correct usage is "consume me here,
now, inside this transaction, in a try-with-resources". Every review of a `Stream` return type
should ask where it is closed and where it is consumed.

**★ Open-session-in-view does not cover asynchronous response writing.** The interceptor
unbinds when request handling completes, and `StreamingResponseBody`, `SseEmitter` and
`DeferredResult` write after that. So this shape fails even in the environment where every
other lazy access succeeds — which makes it look like a framework bug rather than the same bug
as everything else.

**★ `@Async` plus `@Transactional` on the same method is two proxies whose ordering you did
not choose.** Whether the method runs transactionally on the async thread depends on advisor
ordering. Rather than reason about it, split the method: one transactional method that returns
values, one async method that calls it.

## Interview questions

**★ What is wrong with returning a `CompletableFuture` of something computed from an entity?**
Nothing, if the computation happened inside the transaction and the future carries values. The
bug is capturing the *entity* in the lambda and computing later on another thread. By then the
persistence context has closed, so every unfetched association throws — and in the case where
it has not closed, you are using a persistence context from two threads, which Hibernate's
documentation forbids outright. Map to a value type before the boundary and let the future
carry that.

**★ Why does open-session-in-view not rescue a `StreamingResponseBody`?**
Because the interceptor's scope is the processing of the request, and asynchronous response
writing happens after that processing has handed control back. The `EntityManager` is unbound
before the body is written. This is the one lazy access that fails in an OSIV application, and
it is a useful thing to know, because it means "we have OSIV on" is not a complete answer to
"is this path safe".

**★ A `Stream<Order>` repository method throws when the controller consumes it. Where is the
bug?**
In the return type. Spring Data's reference says the stream wraps store-specific resources
that must be closed, and it is produced from a live result set through the `EntityManager`. If
the service method that opened it is `@Transactional`, that unit of work ended when the method
returned — the controller is consuming a stream whose backing resources belong to a finished
scope. Consume and close it inside the same transactional method, and return a list of value
objects, or a `Slice`, to the caller.

{/* FOOTER */}
