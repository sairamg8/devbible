---
title: "The two fixes applied inside the service — forcing the fetch and warming the getter — each remove one instance of the exception, leave the design intact, and are documented to cover only one level of the graph"
sidebar_label: "06 · Fixes that are not fixes"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` javadoc for `initialize(Object)`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> its javadoc for `isInitialized(Object)`, the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies
> and lazy fetching* and §8.4 *Association fetching*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the `7.4` source of `org.hibernate.Hibernate.initialize` and
> `org.hibernate.proxy.AbstractLazyInitializer.initialize`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/Hibernate.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**A pull request titled "fix LazyInitializationException" almost always contains one of about
ten changes, and this topic works through all of them. Each of them makes the failing test pass, and none of them changes the fact that a
reference to a persistence context is leaving a transactional method. This chunk takes the two
that are applied inside the service — forcing the fetch, and touching the getter to warm it —
says exactly what each genuinely does, and then says what it does not do. It also shows the
alternative each time, because "the correct fix is a DTO" without the DTO on the page is not an
argument.**

## 1 · `Hibernate.initialize(...)` before the return

```java
@Transactional(readOnly = true)
public Order findOrder(long id) {
    Order order = orders.findById(id).orElseThrow();
    Hibernate.initialize(order.getLines());     // "now it's loaded"
    return order;
}
```

**What it genuinely does.** It forces the fetch, inside the session, where fetching is legal.
The endpoint stops throwing. That is real and it is why the pattern spreads.

**What the javadoc actually says it does:**

> *"Force initialization of a proxy or persistent collection. **In the case of a many-valued
> association, only the collection itself is initialized.**"*

🔴 **Read the second sentence twice.** `Hibernate.initialize(order.getLines())` loads the
`OrderLine` rows. It does *not* initialise `line.getProduct()` on any of them. So the
serialiser walks one level further than before and throws there instead — and the natural
response is another `Hibernate.initialize`, in a loop, one level down.

**Why it is not a fix.**

- It is per-association and per-call-site. The next association added to `Order` is a new bug
  on every path that returns an `Order`.
- It states the fetch plan in the service body rather than in the query, so the query and the
  requirement drift apart with nothing to detect it.
- It is invisible to the caller. The signature still says `Order`, so a *different* caller
  that reads a *different* association is unserved, and nothing tells it so.
- Deleting the line is a legal-looking refactor. There is no test that names it and no comment
  that survives.

**The alternative, shown.** Put the requirement in the query and the reading in a mapper:

```java
@Query("select o from Order o join fetch o.lines l join fetch l.product where o.id = :id")
Optional<Order> findDetailById(@Param("id") long id);
```

```java
@Transactional(readOnly = true)
public OrderView findOrder(long id) {
    return OrderMapper.toView(orders.findDetailById(id).orElseThrow());
}
```

Now the fetch requirement is one artefact, the return type cannot fail, and adding an
association to `Order` changes nothing.

The *performance* case against a loop of these — that it is an N+1 written by hand and given a
reassuring name — is
**[Topic 08 · 17 · Initialize loops](../08-the-n-plus-1-problem/17-initialize-loops.md)**. This
page is only arguing that it does not close the boundary.

## What `Hibernate.initialize` does when there is nothing to do

This is worth knowing precisely, because the method's failure modes are all silence.

Reading the 7.4 implementation, `initialize(Object)` does nothing at all in three cases:

- **The argument is `null`.** The whole body is guarded by `if (proxy != null)`. So
  `Hibernate.initialize(order.getCustomer())` on a row whose foreign key is null is a no-op —
  correct, and indistinguishable from success.
- **The argument is not a proxy, not a persistent collection and not a bytecode-enhanced
  interceptable object.** It falls through every branch and returns. Passing a plain DTO, a
  `String`, or an already-unproxied entity is legal and does nothing.
- **The proxy is already initialised.** `AbstractLazyInitializer.initialize()` checks its
  `initialized` flag first and returns immediately.

And it does exactly one thing loudly: if the proxy is uninitialised and has no live session, it
throws. The javadoc: *"Throws `HibernateException` if the proxy cannot be initialized, such as
when the `Session` was closed."*

🔴 **So `Hibernate.initialize` called on the wrong side of the boundary does not "fail to
help" — it throws the same exception you were trying to prevent.** Putting it in a controller,
a `@RestControllerAdvice`, or a mapper that runs after the transaction is a very common
misapplication, and the resulting stack trace names `Hibernate.initialize` rather than the
getter, which sends people to read the wrong documentation.

## The loop, and why it terminates by accident

Because initialisation is one level deep, the honest version of this fix on a two-level graph
is:

```java
Order order = orders.findById(id).orElseThrow();
Hibernate.initialize(order.getLines());
for (OrderLine line : order.getLines()) {
    Hibernate.initialize(line.getProduct());     // one query per line
}
```

It works. It is also literally the N+1 the whole of Topic 08 is about, written by hand with a
Hibernate method name on it — see
**[Topic 08 · 17 · Initialize loops](../08-the-n-plus-1-problem/17-initialize-loops.md)** for
the query-count argument. The point *here* is narrower: the loop terminates only because
somebody enumerated the graph by hand, and the enumeration is not checked by anything. Add a
`@ManyToOne` to `OrderLine` and the loop is silently incomplete again.

## 2 · Touching the getter to "warm it up"

```java
Order order = orders.findById(id).orElseThrow();
order.getLines().size();          // warm the collection
order.getCustomer().getName();    // warm the customer
return order;
```

**What it genuinely does.** Exactly what `Hibernate.initialize` does, with a discarded return
value.

**Why it is not a fix, and is worse than option 1.**

- It is the accidental initialisation of
  **[03c · Something initialised it first](03c-something-initialised-it-first.md)** made
  deliberate but not made visible. Nothing distinguishes it from dead code.
- Static analysis flags it as such. "Result of `size()` is never used" is a warning that a
  well-meaning cleanup will act on, and the cleanup breaks production without touching
  persistence code.
- It has the same one-level-only problem: warming `getLines()` does not warm the products.
- A comment is the only thing keeping it alive, and comments do not fail builds.

**The alternative, shown.** If you genuinely want to force a fetch and be honest about it,
call `Hibernate.initialize` — it at least names the intent. But the real alternative is the
same as above: fetch in the query, map to a record.

## What both share

Each one asks: *how do I make this object survive outside the session?* The answer to that
question is always partial, because the object's reachable graph is unbounded and its readers
are unknown. **[05 · The DTO boundary](05-the-dto-boundary.md)** asks a different question:
*what values does this operation produce?* That question has a finite answer, and the answer
is a type.

The next two candidates — `@Transactional` on the controller, and making the association
`EAGER` — are in **[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)**,
along with the escape-hatch setting and catching the exception. The rest of the list, including
`@JsonIgnore` and re-querying in the view, continues from there.

## Gotchas

**★ `Hibernate.initialize` on a collection initialises the collection and nothing inside it.**
The javadoc says so in the same breath as the headline sentence: "In the case of a many-valued
association, only the collection itself is initialized." The failure moves one level down and
looks like a new bug.

**★ A discarded `getLines().size()` is indistinguishable from dead code.** Linters flag it,
cleanups delete it, and the deletion is a persistence change that no reviewer will recognise as
one.

**★ `Hibernate.initialize(null)` is a no-op, so it cannot be used as an assertion.** A fixture
with a null foreign key runs the call successfully and proves nothing about the path that has
one.

**★ `Hibernate.initialize` on a non-proxy is also a no-op.** Pass it something that was never
lazy and it returns silently. So a defensive `initialize` sprinkled over a mapper gives no
signal about whether it was needed or whether it did anything.

**★ Called after the boundary, `Hibernate.initialize` throws rather than helping.** Its javadoc
says it throws when the proxy cannot be initialised, "such as when the `Session` was closed" —
which is exactly the condition it is usually reached for. The stack trace then blames the
helper rather than the design.

**★ `Hibernate.isInitialized` returns `true` for anything that is not a proxy or a
collection.** So a test asserting `isInitialized(view.customer())` on a DTO passes vacuously
and is not testing what its name suggests.

**★ Initialising in a loop is an N+1 with a respectable name.** The method comes from the
Hibernate API, so it reads as sanctioned. The query count is identical to the naive loop it
replaced.

**★ Both of these fixes are invisible in the entity and the query.** Someone reading `Order`,
or reading the repository method, has no way to discover that a service two files away is
compensating for the fetch plan.

**★ Neither of these changes the return type**, so neither helps the *next* caller. They
fix a path, not an interface, and the interface is where the defect is.

**★ Both make the failing test pass**, which is why they get merged. A test that asserts
"this endpoint returns 200" cannot distinguish a fix from a suppression.

## Interview questions

**★ Why is `Hibernate.initialize` not a fix?**
Because it satisfies one association on one path. Its javadoc notes that for a many-valued
association only the collection itself is initialised, so the elements' own associations are
still proxies and the failure moves one level deeper. More fundamentally it leaves the return
type unchanged: the method still hands out an entity, so the next caller that reads a different
association is unprotected, and the fetch requirement now lives in the service body instead of
in the query where it can be seen and tested.

**★ What happens if you call `Hibernate.initialize` on something that is not a proxy?**
Nothing. The implementation checks for a lazy initializer, then for a `LazyInitializable`
collection, then for a bytecode-enhanced interceptable object, and if none matches it returns.
The same is true for `null`. That silence is why the call is a poor diagnostic: it tells you
nothing about whether the object needed initialising or whether the initialisation happened.

**★ Someone moves `Hibernate.initialize` into the controller so it runs "closer to where the
data is used". What happens?**
It throws. The javadoc says it raises a `HibernateException` when the proxy cannot be
initialised, such as when the session was closed, and a controller runs after the transactional
service method has returned. The result is the same failure with a different stack trace — one
that names a Hibernate helper, which makes it look like a Hibernate problem rather than a
boundary problem.

**★ What is the difference between calling `Hibernate.initialize(x)` and calling
`x.size()` to warm a collection?**
Mechanically almost nothing; both force the fetch. The differences are in intent and in
survivability. `Hibernate.initialize` names what it is doing, so a reader knows it is load
bearing; a discarded `size()` looks like dead code and will eventually be deleted by a linter
or a cleanup. Neither expresses the requirement anywhere a query or a test can see it, which is
why both are stopgaps rather than fixes.

**★ Why does initialising one level make the problem look like a new bug?**
Because the exception moves. `Hibernate.initialize(order.getLines())` initialises only the
collection — the javadoc is explicit that for a many-valued association only the collection
itself is initialised — so the next failure is on `line.getProduct()`, in a different class,
with a different entity name in the message. It reads as an unrelated regression, and the
natural response is to add another `initialize`, which is how the loop gets written.

**★ Is there ever a legitimate use of `Hibernate.initialize`?**
Yes, in narrow places: a batch job that must fetch one association after a decision that could
only be made after loading the parent, or a diagnostic. What makes those legitimate is that
the object never leaves the unit of work — the initialisation is a step in a computation, not
a preparation for an escape. The moment it is being called so that something *after* the
transaction can read the result, it is standing in for a fetch plan.

{/* FOOTER */}
