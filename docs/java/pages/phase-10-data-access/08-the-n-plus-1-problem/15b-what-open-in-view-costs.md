---
title: "What open session in view costs: queries outside the transaction, a response that can be internally inconsistent, writes with nowhere to go, and pool demand that extends into the time you spend talking to a slow client"
sidebar_label: "15b · What it costs"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §8.10 *Connection handling*,
> §8.10.1 *Transaction type and connection handling* and Appendix A.3.15
> `hibernate.connection.handling_mode`
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Spring Framework `OpenEntityManagerInViewInterceptor` class documentation
> ([docs.spring.io/spring-framework/reference/](https://docs.spring.io/spring-framework/reference/data-access.html)),
> and the Spring Boot 4.1 properties appendix for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1, HikariCP 7.0.2,
> PostgreSQL 18.

**The extra queries are the cost everybody names. They are not the interesting one. Because
the session outlives the transaction, those queries run with no transaction around them —
which changes what the response means, what happens to anything you modify, when connections
are wanted, and where the time shows up in a trace. Each of these is a consequence of one
sentence in the Spring documentation: lazy loading happens "despite the original transactions
already being completed".**

## The queries are outside the transaction

This is the fact everything else follows from.

Your service method opens a transaction, loads an order, and returns. The transaction commits.
The controller then serialises the order, and Jackson dots into `order.getLines()`. That query
executes now — after the commit — in whatever transactional context happens to exist, which is
none.

**So the response is assembled from two or more points in time.** The header was read inside a
transaction at time T; the lines are read at time T+40ms with no isolation relationship to the
first read. If another transaction cancelled a line in between, the JSON you return shows an
order total that includes a line the array does not contain. Nothing is corrupt in the database
and nothing threw; the document is simply not a snapshot of anything.

With OSIV off, this cannot happen, because everything the response contains was read inside the
one transaction that produced it. **That is not a performance property, it is a correctness
property**, and it is the strongest argument against OSIV — considerably stronger than the query
count, which is what most discussions stop at.

The severity depends on isolation level and on how much the data moves. On a read-committed
database with hot rows it is routine. On a reporting endpoint over a closed month it is
theoretical. Knowing which of those you have is part of the decision.

## Writes during rendering have nowhere to go

An entity in the persistence context is managed, and OSIV keeps it managed after the
transaction. So this compiles, runs, throws nothing, and does nothing:

```java
@GetMapping("/orders/{id}")
public OrderDetail detail(@PathVariable Long id) {
    Order order = orderService.load(id);       // transaction opens and commits inside
    order.setLastViewedAt(Instant.now());      // managed entity, no transaction
    return OrderDetail.from(order);
}
```

There is no transaction to commit, so nothing is written. The entity is dirty in a persistence
context that will be discarded when the request ends.

**The dangerous version is the one where a transaction turns up later.** If anything else in
the same request enters a transaction that joins this persistence context — a second service
call, an audit write, an interceptor — that transaction commits *everything* dirty in the
context, including the modification made outside it. You get an `UPDATE` you did not write,
attributed to a transaction that has nothing to do with it, and it appears only when the two
code paths happen to run in the same request.

Without OSIV, the first line throws or the entity is detached, and the mistake is impossible to
make.

## Connection demand extends into response writing

Here the documented facts and the folklore diverge, so it is worth separating them.

**What the documentation says.** Hibernate's default connection handling mode for
`RESOURCE_LOCAL` transactions — which is what Spring's `JpaTransactionManager` uses — is
`DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION`: the connection "is acquired when needed
and released after the current running transaction is either committed or rolled back". The
same value is given as the global default for `hibernate.connection.handling_mode` in Appendix
A.3.15. The guide adds a detail that matters for the acquisition half: because Hibernate must
ensure autocommit is off when a transaction starts, the connection is acquired at that point
unless you set `hibernate.connection.provider_disables_autocommit = true`, which most pooled
setups can.

**What I could not confirm.** The documentation states the release point in terms of a
transaction completing. It does not state when the connection is released for a statement
issued **outside** any transaction, which is precisely the OSIV case. I could not settle that
against the Hibernate 7.4 documentation, so I am not going to repeat the common claim that OSIV
holds a pooled connection for the entire request as though it were established.

**What is true regardless.** A lazy load during rendering **needs a connection at that moment**,
because that is when the statement runs. So pool demand no longer ends at commit — it extends
into the phase of the request where you are writing bytes to the client. That matters most
exactly where you can least afford it:

- **A slow client** — a mobile network, a large JSON body — makes the write phase the longest
  part of the request. A lazy load triggered halfway through serialisation wants a connection
  while a socket is the bottleneck.
- **A streamed response** cannot be buffered and released early; the serialiser is interleaved
  with the socket for the whole duration.
- **Pool exhaustion under load** then presents as timeouts on endpoints that are not slow in
  themselves, because the connections are held by requests waiting on clients.

If you must keep OSIV, `hibernate.connection.handling_mode=DELAYED_ACQUISITION_AND_RELEASE_AFTER_STATEMENT`
bounds the window explicitly rather than relying on an inference. It has its own cost — a
pool checkout per statement — and it is a deliberate trade, not a free improvement.

## Everything loaded stays reachable until the response is written

The persistence context holds a strong reference to every entity loaded through it. With OSIV
that context lives for the whole request, so an endpoint that lazily walks a graph accumulates
entities in memory until rendering completes, and nothing is collectable before then.

For a detail view that is a handful of objects. For an endpoint that serialises a page of
parents and walks their collections, it is the page multiplied by the graph — and, unlike the
report case in [14c · Worked: the report](14c-the-report.md), there is no chunk boundary at
which you could call `clear()`, because you are inside the serialiser.

## The time does not show up where the problem is

Queries issued during rendering are outside the `@Transactional` span. In a trace they land in
the servlet or serialisation phase, attributed to no repository method and no service. So a
profile of the application shows a fast service layer and a mysteriously slow "response
writing" step, which is where an investigation dies — the numbers point at Jackson.

This compounds the diagnosis problem from [15 · Open session in view](15-open-in-view.md). The
statement count tools in this topic still work — [6 · Count, do not read](06-count-do-not-read.md)
counts everything the session did — but the moment you try to attribute a count to a call site
([7 · From a count to a call site](07-from-a-count-to-a-call-site.md)), OSIV has moved the call
site out of your code and into a library's reflection loop.

## Gotchas

**★ A response assembled across two points in time is not a snapshot of anything.** The header
and the collection can disagree, and no test that runs against a static database will ever show
it.

**★ Modifying an entity in a controller silently does nothing — until it silently does
something.** No transaction means no write. But any later transaction joining the same context
flushes it, so the same code is a no-op in one request shape and a surprise `UPDATE` in another.

**★ `readOnly = true` on the service does not protect the rendering phase.** The flag applies to
the transaction, which has already committed. Anything that happens after it is outside its
scope entirely.

**★ Connection demand moving into the write phase interacts badly with slow clients.** The
requests that hold resources longest are then the ones with the worst networks, which is the
opposite of what capacity planning assumes.

**★ The pool metric that catches this is wait time, not utilisation.** Average connection
utilisation can look fine while p99 acquisition time is terrible, because the holding is bursty
and correlated with response size.

**★ You cannot `clear()` your way out of the memory growth.** The accumulation happens inside
the serialiser, where there is no place to put a boundary.

**★ The trace blames the serialiser.** Time spent on lazy loads during rendering is attributed
to response writing, so the investigation starts by looking at Jackson configuration, which is
innocent.

**★ Turning OSIV off does not by itself fix any of this — it makes it visible.** The queries
become exceptions, the exceptions become fetch plans, and the fetch plans are what actually fix
it. Expect a phase where you have replaced silent costs with loud failures and not yet finished.

## Interview questions

**★ Beyond the extra queries, what is the strongest argument against open-session-in-view?**
That it breaks the transactional consistency of the response. Everything loaded lazily during
rendering is read after the transaction committed, with no isolation relationship to the reads
that preceded it, so a single JSON document can contain a header from one point in time and a
collection from another. With OSIV off, everything in the response was read inside one
transaction and the document is a snapshot. That is a correctness property, not a performance
one, and it does not show up in any test that runs against a database nothing else is writing
to.

**★ What happens if you modify a managed entity in a controller with OSIV on?**
Usually nothing — there is no transaction to commit, so the dirty state is discarded when the
request ends. The problem is the "usually". The entity is dirty in a live persistence context,
so if anything later in the same request opens a transaction that joins that context, the flush
at its commit writes those changes too. The same line of code is therefore a no-op in one call
path and an unexplained `UPDATE` in another, which is a far worse failure mode than either
consistently working or consistently not.

**★ Does OSIV hold a database connection for the whole request?**
That is the common claim and I would be careful with it. What the Hibernate documentation
establishes is that the default handling mode for resource-local transactions is
`DELAYED_ACQUISITION_AND_RELEASE_AFTER_TRANSACTION` — acquire when needed, release when the
transaction completes — and it does not spell out the release point for statements issued
outside a transaction, which is exactly the OSIV case. What is certainly true, and enough for
the argument, is that a lazy load during rendering needs a connection at that moment, so pool
demand now extends into the phase where you are writing to the client. If I needed a hard bound
I would set the handling mode to release after each statement and measure, rather than reason
about it.

**★ Why does this get worse with slow clients?**
Because the response-writing phase is where the connection is now wanted, and that phase is
governed by the client's network rather than by your database. A large JSON body over a mobile
connection can take orders of magnitude longer than the query that produced it. With the session
closed at commit, that time costs you a thread; with OSIV and a lazy load mid-serialisation, it
can cost you a pooled connection as well. The symptom is pool exhaustion on endpoints whose own
work is fast.

**★ How would you detect that OSIV is costing you, given the endpoint is not throwing
anything?**
Three signals. Statement counts that grow with response size rather than with anything the
service did — the counting technique still works because it counts everything the session did.
Connection-pool acquisition latency at high percentiles rather than average utilisation, since
the holding is bursty. And a trace whose slow span is response serialisation with no repository
call inside it, which is the specific fingerprint of queries issued after the transaction. The
decisive experiment is to turn OSIV off in a test profile and see how much fails; the size of
that list is the size of the hidden dependency.

**★ Is there a case where you would keep it on deliberately?**
Yes, and I would want it written down. A server-rendered application with templates that are
genuinely part of the domain presentation, low traffic, and a team that has decided the
development speed is worth the cost, is a coherent position — that was the pattern's original
context. What I would not accept is keeping it because turning it off breaks things, or setting
it to `true` to silence a warning. Those are not decisions; the first is a migration and the
second is an omission.

**★ Does `spring.jpa.open-in-view` affect anything other than lazy loading?**
Yes, and this is the part that is usually missed. It changes what "managed" means for the whole
request, so an entity returned from a service is still attached while the controller runs — which
means identity, dirty state and first-level caching all extend past the transaction. Two service
calls in the same request return the *same* instance from the same persistence context rather than
two loads, which is sometimes convenient and sometimes a source of surprising staleness, since the
second call reads from the context rather than the database. None of that is lazy loading, and all
of it disappears when the setting is off.

**★ How does OSIV interact with a `readOnly = true` transaction?**
It does not, and that is the problem. `readOnly` is a property of the transaction — it can let
Hibernate skip dirty-check bookkeeping and can be signalled to the driver — and by the time
rendering happens the transaction has committed, so nothing about the reads issued during
serialisation is governed by it. People reasonably assume marking the service read-only makes the
whole request read-only. It makes the transaction read-only and leaves the largest, least
observable part of the data access outside its scope entirely.

**★ Two service calls in one request, and the second sees data the first would not have. Explain.**
With OSIV, both calls join the same thread-bound persistence context, so the first-level cache
spans them: an entity loaded by the first call is returned by identity from the second without a
database read, even if it changed in between — and conversely, anything the second call loads
fresh may reflect a state the first call's snapshot does not. Without OSIV each call has its own
context and its own transaction, so each is internally consistent and the boundary between them is
explicit. The OSIV version is not wrong so much as undefined: the consistency of the response
depends on which call happened to load which entity first.

---

← Prev: [15 · Open session in view](15-open-in-view.md) · Index: [08 · The N+1 problem](README.md) · Next → [15c · Turning it off](15c-turning-it-off.md)
