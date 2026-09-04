---
title: "Two of the remaining candidates are applied outside the service — a transaction on the controller and an eager mapping — and the first does not cover response serialisation at all while the second is the one fetch decision that can never be taken back"
sidebar_label: "06b · More fixes that are not fixes"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Jakarta Persistence 3.2 `FetchType` — `EAGER` as *"a requirement on
> the persistence provider runtime"* and `LAZY` as *"a hint"*
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching* and §8.4 *Association
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> `org.hibernate.cfg.TransactionSettings.ENABLE_LAZY_LOAD_NO_TRANS`, annotated `@Unsafe`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html)),
> and the Spring Framework 7.0 reference on proxy-based `@Transactional`
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The previous chunk's two candidates at least ran in the right place. These two do not. Moving
`@Transactional` onto the controller is applied overwhelmingly to serialisation failures, and
it cannot fix those, because the response body is written after the handler method returns.
Making the association `EAGER` genuinely removes the proxy — and it is the one fetch decision
the specification makes irreversible, so it buys a fix on one path with a cost on every other
path forever. Two further candidates are on this page because they belong with them: the
Hibernate setting that turns the exception off, and catching the exception outright.**
Continues **[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)**.

## 1 · `@Transactional` on the controller

```java
@RestController
class OrderController {

    @GetMapping("/orders/{id}")
    @Transactional(readOnly = true)              // "keep the session open for the response"
    Order get(@PathVariable long id) {
        return service.findOrder(id);
    }
}
```

**What it genuinely does.** It opens a transaction for the duration of the controller *method
body*. If the controller itself navigates the entity, that navigation now happens inside a
session and succeeds.

🔴 **What it does not do — and this is the case it is almost always applied to.** In Spring
MVC, the handler method returns a value and the framework then selects a message converter and
writes the response body. **That happens after the handler method returns**, which is after the
transaction interceptor has completed the transaction and closed the persistence context. So
`@Transactional` on the controller does **not** make serialisation safe. The endpoint that was
throwing in Jackson throws in Jackson afterwards, and the change looks like it did nothing —
which is confusing enough that people conclude the annotation "did not apply" and go looking
for a proxy problem that is not there.

The pieces of this — where exactly the serialiser runs, and how to read the resulting stack
trace — are **[02b · Where it fires](02b-where-it-fires.md)**.

**Why it is not a fix even when it appears to work.**

- It puts a database transaction, and therefore a pooled connection, around presentation work.
  Rendering time is now connection-hold time.
- It makes the controller a transactional boundary, so a write performed by the service can be
  rolled back — or *not* rolled back — by controller-level behaviour nobody intended.
- It only ever covers the controller's own body, so it fixes one layer and leaves everything
  the framework does afterwards uncovered.
- It is architecturally backwards: the transaction is a property of the unit of work, and the
  controller is not one.

**The alternative, shown.** The controller should not need a session, because it should not
receive anything that has one:

```java
@GetMapping("/orders/{id}")
OrderView get(@PathVariable long id) {
    return service.findOrder(id);   // returns a record
}
```

## 2 · Making the association `EAGER`

```java
@ManyToOne(fetch = FetchType.EAGER)   // was LAZY
private Customer customer;
```

**What it genuinely does.** It removes the proxy. The specification is unambiguous that this
is not a hint:

> *"The `EAGER` strategy is a requirement on the persistence provider runtime that the
> associated entity must be eagerly fetched."*

Contrast the other direction:

> *"The `LAZY` strategy is a hint to the persistence provider runtime that data should be
> fetched lazily when it is first accessed. The implementation is permitted to eagerly fetch
> data for which the `LAZY` strategy hint has been specified."*

**So `EAGER` is a guarantee and `LAZY` is a request.** That asymmetry is why `EAGER` looks like
such a solid fix, and it is also why it is a one-way door: no query, no entity graph and no
fetch profile can make an `EAGER` association lazy again for one call site.

**Why it is not a fix.**

- **It only removes the proxy at the level you annotated.** `Order.customer` is now eager;
  `Customer.address` is not. The serialiser walks one node further and throws. Chasing that
  ends with the whole graph eager, which means every query loads the whole graph.
- **It is a global answer to a per-call-site question.** The list endpoint that needs no
  customer pays for the customer on every row, forever, because the detail endpoint needed it
  once.
- **It moves the decision from the query to the mapping**, which is the opposite of where
  Hibernate's own advice puts it: *"fetch all the data you'll need upfront at the beginning of
  a unit of work… usually, using `join fetch` in HQL or an `EntityGraph`."*
- **It does not close the boundary at all.** The returned object is still an entity, still
  detached, still able to throw on any association that is *not* eager — including one added
  next month.

**The alternative, shown.** Keep the mapping lazy and state the requirement per query:

```java
@EntityGraph(attributePaths = {"customer", "customer.address"})
Optional<Order> findDetailById(long id);
```

The performance argument — that `EAGER` on a collection produces the very N+1 it was meant to
prevent — is **[Topic 08 · 16 · EAGER is not a fix](../08-the-n-plus-1-problem/16-eager-is-not-a-fix.md)**,
and the time-bomb argument for `EAGER` on a collection specifically is
**[Topic 07 · 13 · EAGER on a collection](../07-relationships-fetch/13-eager-on-a-collection.md)**.

## Two more candidates that belong with these

Both of the above try to keep the session alive. Two others go further and remove the failure
itself — the Hibernate setting that fetches without a session, and simply catching the
exception. Those are
**[06b2 · Turning the exception off](06b2-turning-the-exception-off.md)**, together with the
extended persistence context and re-querying in the view.

## Gotchas

**★ `@Transactional` on a controller does not cover response serialisation.** The body is
written after the handler returns, which is after the transaction completes. This is the single
most common wasted change in this whole area, because it is applied precisely to the
serialisation case it cannot help.


**★ `@Transactional` on a controller holds a connection for the duration of rendering.** On a
slow template or a large JSON payload, that is connection-pool pressure caused by a fix for an
unrelated problem.


**★ `@Transactional` on a controller also makes the controller a rollback boundary.** An
exception thrown while building a response can now roll back a write the service already
performed, and a caught exception can commit one that should not have been.


**★ `EAGER` cannot be undone per query.** `LAZY` is documented as a hint the provider may
ignore; `EAGER` is documented as a requirement. So the eager decision wins everywhere, and the
call site that wanted less has no mechanism to ask for less.


**★ Going eager one level at a time terminates only when the whole graph is eager.** Each step
looks like progress because the exception moves. It is the same bug being pushed down the
graph, and the end state is that every query loads everything.


**★ An eager mapping is invisible at the call site.** The repository method, the service and
the controller all look identical before and after; only the entity changed, and only the SQL
log shows the difference.


**★ Both candidates on this page leave the return type alone.** That is the single
question worth asking of any proposed fix: does the next caller, who has not read this pull
request, still have a way to get it wrong?


## Interview questions

**★ A colleague adds `@Transactional` to a controller to fix a serialisation failure and it
does not help. Why not?**
Because in Spring MVC the response body is written by a message converter after the handler
method returns. The transaction interceptor completes the transaction when the method returns,
so by the time Jackson walks the object the persistence context is closed. The annotation does
extend a session across the controller's own body, so it would help code *inside* the handler —
which is not where the failure is.


**★ `EAGER` is a requirement and `LAZY` is a hint. What follows from that?**
That eager is a one-way door. A provider is allowed to fetch a `LAZY` association eagerly, but
it is not allowed to defer an `EAGER` one, so no query, entity graph or fetch profile can undo
an eager mapping for a single call site. Fetch decisions therefore belong on the query, where
they can differ per use case, and the mapping should default to lazy so that every call site
retains the ability to ask for what it needs.


**★ Why does making one association eager tend to lead to making all of them eager?**
Because it does not address the reader. The serialiser, mapper or template walks until it hits
something unfetched; making the first thing eager just moves the wall one node further out.
Each step is locally successful and globally worse, and the terminal state is a mapping where
every query materialises the entire reachable graph — which is both slow and still not a
boundary, because the object handed to the caller is still an entity.


**★ What single question separates a fix from a suppression here?**
Does the return type change? Every candidate in this series leaves the method returning an
entity, so each protects one code path and leaves the interface exactly as
dangerous as it was. A fix changes what crosses the boundary; a suppression changes what
happens after it has crossed.


{/* FOOTER */}
