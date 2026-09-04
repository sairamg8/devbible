---
title: "Turning open session in view off: the seven things that break, why each one was already a bug, and the fix for each that is not just re-enabling it"
sidebar_label: "15c · Turning it off"
sidebar_position: 55
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Boot 4.1 properties appendix for
> `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Boot `4.1.x` `JpaBaseConfiguration.JpaWebConfiguration` source
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java)),
> the Spring Framework reference on JPA transaction management and the
> `OpenEntityManagerInViewInterceptor` / `...Filter` class documentation
> ([docs.spring.io/spring-framework/reference/](https://docs.spring.io/spring-framework/reference/data-access.html)),
> and the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Hibernate ORM 7.4.1.

**Setting `spring.jpa.open-in-view: false` is one line and it is never the whole job. What
follows is what actually breaks, in rough order of how often, with the fix for each — and the
observation that every one of them was a latent bug that OSIV was paying for. The migration is
not "make the exceptions go away"; it is "each exception names a place where data access
escaped the data access layer, so put it back".**

## First, do it in tests

Before touching production configuration:

```yaml
# src/test/resources/application.yaml
spring:
  jpa:
    open-in-view: false
```

New code is then written against the stricter model from the day the setting lands, while
existing endpoints keep working in production. The list of failing tests **is** your migration
backlog, and it is a far better inventory than reading 300 controllers. If your integration
tests exercise real HTTP endpoints, this alone will find most of it.

## What breaks, and what to do about each

### 1 · Serialisation throws `LazyInitializationException`

The most common by a wide margin. Jackson walks the entity, hits an uninitialised association,
and the session is gone. The introduction describes the mechanism exactly: "Once the session
ends, and the persistence context is cleaned up, the proxy is no longer fetchable, and instead
its methods throw the hated `LazyInitializationException`."

**The fix is a DTO**, mapped inside the transaction. Not `@JsonIgnore` on the association —
that changes your API to make an error go away, and it hides the fact that the endpoint's
contract was never decided. Not an entity graph on the finder either, unless the association
genuinely belongs in the response; adding a fetch join so that the serialiser can walk it is
solving the wrong half. Decide what the endpoint returns, put that in a record, and map to it
in the service.

[14b · Worked: the list page](14b-the-list-page.md) is this fix worked end to end.

### 2 · A repository call outside any transaction

This one surprises people, and it is the deepest change. With OSIV on, a service method with
**no** `@Transactional` still works: the interceptor bound an `EntityManager` to the thread, so
the repository call joins it and the entities it returns stay managed. Turn OSIV off and each
repository call runs in its own short-lived context — Spring Data's own transaction — which is
closed by the time you get the result. **Every association on the returned entity is then
un-initialisable, immediately, in the very next line.**

**The fix is `@Transactional(readOnly = true)` on the service method**, which is what should
have been there all along. It gives the read a defined boundary, makes the persistence context
span the whole unit of work, and lets the driver and database know the transaction will not
write.

⚠️ This is worth auditing proactively rather than discovering endpoint by endpoint. A service
class with no transaction annotations anywhere is not a service class that does not need them;
it is a service class that has been relying on OSIV.

### 3 · The controller navigates the entity

```java
Order order = orderService.load(id);
model.addAttribute("customerName", order.getCustomer().getName());   // throws
```

**The fix is to move the navigation inside the transaction** — which in practice means the
mapping to a DTO or a view model belongs in the service, not the controller. This is the change
that has the largest effect on the shape of the codebase, and it is the one worth being
deliberate about: the boundary you are drawing is "entities do not leave the service layer",
and it is a good boundary for reasons that have nothing to do with fetching.

### 4 · A template dots through an association

Server-rendered views are the original reason OSIV exists, so this is the case with the most
genuine tension. **The fix is the same DTO**, populated by the controller's service call; the
template then has no association to walk. If your templates are complex enough that this feels
like a lot of view models, that is a real cost and it is the cost the OSIV decision is actually
about.

### 5 · Exception handlers, audit logging and interceptors touching entities

An `@ExceptionHandler` that logs `order` calls `toString()`; an audit aspect that reads
`order.getCustomer().getId()` after the method returned. Both run outside the transaction.

**The fix is to pass identifiers, not entities**, into anything that runs at the edges. A log
line wants an order id; an audit record wants an id and a user. Neither wants a managed object,
and passing one is how a log statement acquires the ability to issue queries
([4c · Serialisation and logging](04c-serialization-and-logging.md)).

### 6 · Security expressions evaluated after the method returns

`@PostAuthorize("returnObject.customer.owner == authentication.name")` navigates the returned
entity, and `@PostAuthorize` is evaluated after the transactional method completes.

**The fix is to authorise on data you already have** — check ownership inside the method, or
include the owning identifier in the returned DTO so the expression can read it without
navigating. Post-authorisation that triggers database access is a performance problem even with
OSIV on, because it happens per returned object.

### 7 · Async controller returns and streaming responses

`OpenEntityManagerInViewInterceptor` implements `AsyncWebRequestInterceptor` and cooperates with
`WebAsyncManager`, so with OSIV **on**, a `Callable` return has session handling arranged for it.
With OSIV off, the async work runs on another thread with no bound session at all — and this was
always the more honest state, because a persistence context is not thread-safe and sharing one
across an async boundary is a bug regardless.

**The fix is for the async task to do its own transactional work**, load what it needs, and
return values rather than entities. The same applies to `StreamingResponseBody` and to anything
returning a `Flux`.

## What is not a fix

**`@Transactional` on the controller.** It does not even solve case 1: the response is
serialised by a message converter *after* the controller method returns, so the transaction has
already committed by the time Jackson walks the object. What it does do is stretch a transaction
across everything the controller does, which is worse in every respect than the boundary you are
trying to establish.

**`Hibernate.initialize` on everything before returning.** This is N+1 written by hand, and it
gets its own chunk: [17 · Initialize loops](17-initialize-loops.md).

**Changing associations to `EAGER`.** The exception stops, and the cost becomes unconditional
and unremovable: [16 · EAGER is not a fix](16-eager-is-not-a-fix.md).

**`@JsonIgnore` on every association.** Sometimes correct, often a way of deciding an API
contract by chasing stack traces. If the field does not belong in the response, saying so is
right; if it does, this is not the tool.

**Turning it back on because the list is long.** The list is the point. It is an inventory of
places where data is loaded outside a declared plan, and it does not get shorter by being
hidden.

## Gotchas

**★ The failures do not arrive in one batch.** A test suite that does not exercise every
endpoint will pass, and the remaining cases surface in production one endpoint at a time. Turn
it off in tests first precisely so this is a list rather than a series of incidents.

**★ Case 2 is invisible until it fires.** A service class with no `@Transactional` anywhere
looks clean in review. Under OSIV it works; without OSIV it fails on the first association it
touches. Grep for public service methods that call repositories and lack a transaction
annotation before you flip anything.

**★ `@Transactional(readOnly = true)` is not just documentation.** It defines the boundary that
makes lazy loading work at all in a non-OSIV world. Adding it is a behavioural change, not a
hint, and adding it broadly is most of the migration.

**★ `@JsonIgnore` and a DTO are not equivalent even when they produce the same JSON.**
`@JsonIgnore` leaves a managed entity being serialised, with everything that implies for
mutation and for the next association someone adds. A record cannot regress.

**★ `@PostAuthorize` runs after the transaction, always.** This is true with OSIV on too — it
simply issues queries instead of throwing. Turning OSIV off converts a per-object query into an
exception, which is an improvement in information and a temporary loss of functionality.

**★ The async case looks like a regression and is a bug being uncovered.** Sharing a persistence
context across threads was never safe; OSIV's async support made it survivable.

**★ Do not flip it globally on the same day you find the failures.** The intermediate state —
off in tests, on in production, backlog being worked — is stable and safe to sit in for a while.

## Interview questions

**★ You set `spring.jpa.open-in-view: false` and a service that never had `@Transactional`
starts throwing. Why?**
Because with OSIV on, the interceptor bound an `EntityManager` to the request thread and the
repository call joined it, so the returned entities stayed managed for the rest of the request.
With OSIV off there is no ambient context, so each repository call runs in its own short
transaction that is closed by the time the call returns — the entities come back detached and
every lazy association is un-initialisable on the next line. The fix is
`@Transactional(readOnly = true)` on the service method, which is the boundary that should have
been declared in the first place. This is the case that makes turning OSIV off a real migration
rather than a config change.

**★ Would `@Transactional` on the controller solve the serialisation problem?**
No, and it is worth knowing why, because it is a common suggestion. The response body is written
by a message converter after the handler method returns, so the transaction the annotation opens
has already committed before Jackson touches the object. It fixes navigation inside the
controller method and nothing after it, while stretching a transaction over request handling —
so it gives you a worse boundary and does not solve the case people reach for it to solve.

**★ Is `@JsonIgnore` on the association an acceptable fix?**
Only if the association genuinely does not belong in the response, in which case it is not a fix
at all but a correct API decision that happens to stop an exception. Using it to make a stack
trace go away decides your API contract by accident, and it leaves a managed entity being
serialised — so the next association someone adds recreates the problem, and an accidental
setter in a mapper is still a write. A DTO answers the question the exception was asking, which
is "what does this endpoint actually return".

**★ How would you sequence this migration on a large application?**
Off in tests first, so the failing suite becomes the backlog and all new code is written against
the strict model. Then work through the list by endpoint — a DTO or a fetch plan, plus
`@Transactional(readOnly = true)` where it is missing — adding a statement-count assertion for
each one as I go, since I am touching the fetch path anyway. Flip the production setting only
when the backlog is short enough to finish in one change, and expect a tail of endpoints the
tests did not cover. What I would not do is flip production first and triage exceptions, because
the fix for each is the same work either way and doing it under incident pressure is strictly
worse.

**★ Are there breakages that turning OSIV off reveals rather than causes?**
All of them, and that is the argument for doing it. The async case is the clearest: a persistence
context is not thread-safe, so a `Callable` return sharing one across threads was unsafe whether
or not it threw. Post-authorisation navigating a returned entity was issuing a query per object
before, and now it fails. A service without a transaction was reading without a defined boundary.
In every case OSIV was not preventing a bug, it was paying for one — the exception is the bug
becoming visible, not the setting introducing it.

**★ What do you do about server-rendered templates, where OSIV was genuinely designed to help?**
Populate a view model in the service and let the template see only that. It is more code, and
that is the real cost of the decision rather than a rhetorical one — a complex page can need a
substantial view model. What you get back is that the template cannot issue queries, so page
performance stops depending on which branches of the template a given request takes, which for
anything with conditional sections is worth a lot. If a team decides the trade goes the other way
for a low-traffic internal application, that is a defensible decision; it just needs to be a
decision.

**★ Which of the seven breakages would you expect to find last?**
The ones the test suite does not exercise, which in practice means error paths and rarely-used
endpoints. An `@ExceptionHandler` that logs an entity only runs when something already went wrong,
so it fails in production for the first time during an incident — which is the worst possible
moment to discover a `LazyInitializationException` inside error handling. I would specifically go
looking at exception handlers, audit aspects and admin endpoints rather than waiting for them,
because they are exactly the code paths integration tests skip.

**★ You turn OSIV off and one endpoint gets slower rather than throwing. How?**
Because you fixed it with a fetch plan that fetches more than the endpoint needs. The usual shape
is someone chasing exceptions: an association throws, they add it to an entity graph, the next one
throws, they add that too, and the graph ends up describing the union of everything the serialiser
might touch. The result is a single query joining five tables to render a response that uses three
fields. That is why the recommended fix is a DTO rather than a graph — the DTO forces you to decide
what the response contains, and the fetch plan then follows from the decision rather than from the
stack traces.

---

← Prev: [15b · What it costs](15b-what-open-in-view-costs.md) · Index: [08 · The N+1 problem](README.md) · Next → [16 · EAGER is not a fix](16-eager-is-not-a-fix.md)
