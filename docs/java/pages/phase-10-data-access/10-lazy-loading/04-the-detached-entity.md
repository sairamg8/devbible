---
title: "Returning an entity from a @Transactional method is a promise about what is loaded that the signature cannot express, the caller cannot check and the method cannot keep"
sidebar_label: "04 · The detached entity"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.1 *Persistence contexts*
> and §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.LazyInitializationException` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/LazyInitializationException.html)),
> and Jakarta Persistence 3.2 `FetchType`
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/fetchtype)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Everything in this topic so far has been about the exception. This chunk is about the
design mistake that produces it, and it is one line of Java: a `@Transactional` method whose
return type is an entity. That signature says "you get an `Order`". What the caller actually
gets is an object graph that is real down to some boundary nobody wrote down, and throws
below it. The method cannot state where the boundary is, the compiler cannot check it, the
caller cannot inspect it without initialising the very things it is asking about, and the
boundary moves whenever anyone edits the query, the mapping or the entity. That is not a bug
in the caller. It is a return type that does not describe its own value.**

## The exact moment of detachment

Take the shape every Spring application has:

```java
@Service
class OrderService {

    private final OrderRepository orders;

    @Transactional(readOnly = true)
    public Order findOrder(long id) {
        return orders.findById(id).orElseThrow();
    }
}
```

`@Transactional` is applied by a proxy around `OrderService`. When `findOrder` is called from
outside the bean, the proxy starts a transaction; `JpaTransactionManager` obtains an
`EntityManager`, binds it to the thread, and — if it was the one that opened it — closes it
when the transaction completes. The `Order` returned was managed by that persistence context.

When the persistence context closes, every entity in it becomes **detached**. The
introduction's definition:

> *"detached — previously persistent in another session, but not currently associated with
> this persistence context."*

And the consequence for proxies, from §5.6:

> *"Hibernate will only do this for an entity which is currently associated with a
> persistence context. Once the session ends, and the persistence context is cleaned up, the
> proxy is no longer fetchable, and instead its methods throw the hated
> `LazyInitializationException`."*

So the object crosses the `return` statement in one state and arrives at the caller in
another. **Nothing about the object changes at the call site. The change happens on the way
out, in infrastructure the caller never sees.**

## The signature promises the whole graph

`Order findOrder(long id)` has a return type. Read it as a contract and it says: *you receive
an `Order`, and an `Order` has a `customer`, and a `customer` has an `address`, and the order
has `lines`, and each line has a `product`.* That is what the type says, because that is what
the class declares. The caller is entitled to read any of it.

What the method actually returns is an `Order` on which **some** of that is real and the rest
throws. Which part is which depends on:

- whether the repository method used a fetch join or an `@EntityGraph`;
- which associations are mapped `LAZY` and which took the `EAGER` default;
- whether the foreign keys on this particular row are null;
- what else happened to be in the persistence context when the row was read;
- whether some listener, validator or log statement touched an association first
  (**[03c · Something initialised it first](03c-something-initialised-it-first.md)**).

🔴 **Not one of those five is visible in the method signature, and three of them are not
visible anywhere in the source at all.** The contract is data-dependent and
configuration-dependent, and the language has no way to write it down.

## Where it stops being a philosophical point

```java
@RestController
class OrderController {

    private final OrderService service;

    @GetMapping("/orders/{id}")
    Order get(@PathVariable long id) {
        return service.findOrder(id);   // Jackson will walk this
    }
}
```

The controller does not dereference anything. It hands the object to the framework, which
serialises it, which walks the graph, which touches `order.getCustomer()`, which is a
detached proxy. The failure surfaces in a message converter with a stack trace that names no
line of your code — the full anatomy is
**[02b · Where it fires](02b-where-it-fires.md)**.

The important thing here is not the stack trace. It is that **the controller did nothing
wrong**. It used the value at the type its provider gave it. If that is a mistake, the
mistake is in the signature.

## The four ways the boundary moves without a code change

**1 · Someone edits the repository method.** A `@EntityGraph` is removed from
`findById`-equivalent because a different endpoint was loading too much. Every caller that
depended on that graph now throws, and none of them referenced it.

**2 · Someone edits the entity.** A new `@ManyToOne` is added to `Order`. If it is `LAZY`,
every serialisation of an `Order` outside a session now has one more thing to fail on. If it
is `EAGER` — which is the default nobody chooses — every query for an `Order` now joins one
more table. See
**[Topic 07 · 12 · Fetch type defaults](../07-relationships-fetch/12-fetch-type-defaults.md)**.

**3 · The caller changes.** The method works from a controller with open-in-view on and
throws from a `@Scheduled` job — the same code, the same data, a different caller. That split
is **[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**.

**4 · The data changes.** A row whose `customer_id` was null returns `null` and serialises
fine; the next row has it populated and returns a proxy.

**A contract that four unrelated edits can silently invalidate is not a contract.**

## Detached is not dead

It is worth being precise, because "detached" gets used as a synonym for "unusable" and it is
not. A detached entity's already-loaded fields are ordinary fields and read normally; its
identifier is readable; it can be used as the target of an association; already-initialised
proxies keep working forever. The full list of what survives detachment, and the operations
that look safe and are not, is
**[04b · What still works on a detached entity](04b-what-still-works-when-detached.md)**.

The point of this chunk is narrower and harsher: **the set of things that survive is a
property of a particular object at a particular moment, and the return type describes the
class.** Those are different sets, and the gap between them is the bug.

## Gotchas

**★ The `return` statement is where the object's state changes, and it is invisible.** The
method body sees a managed entity; the caller sees a detached one. No line of code performs
the transition — the transaction interceptor does, after the last line of the method has run.

**★ A method that returns `Optional<Order>` has exactly the same problem.** So does one that
returns `List<Order>`, and the list version is worse, because whichever element the caller
touches first is the one that fails. Wrapping an entity in a container does not change what
the container holds.

**★ The graph is partially real, which is why testing one path proves nothing.** A caller
that reads `order.getTotal()` passes forever. The caller that reads `order.getLines()` fails
on the first call. Same object, same moment, same method.

**★ Documenting the contract in a javadoc comment does not work.** Not because people do not
read comments, but because the comment cannot stay true: the four edits listed above all
invalidate it without touching the file the comment is in.

**★ Entities returned from a `@Transactional` method are also mutable and unsynchronised.**
Even ignoring lazy loading, the caller can set a field on a detached entity and nothing will
persist, with no error and no log line. Whatever fixes the fetch boundary fixes that at the
same time, for the same reason.

**★ The caller cannot check what is loaded without changing it.** The obvious defensive move —
"I will just look and see whether `customer` is there" — is `order.getCustomer()`, which is a
fetch. `Hibernate.isInitialized` does not fetch, but calling it on every association at every
call site is not a design, it is a symptom. See
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**.

**★ The exception is thrown by the *reader*, so the blame lands on the wrong team.** The
serialiser, the template, the mapper or the audit listener appears in the stack trace; the
service method that returned the entity does not. Bug reports for this land on whoever owns
the reader.

**★ Repository methods have the same signature problem, one layer down.** `Optional<Order>
findById(Long)` on a Spring Data repository is exactly as unspecific as the service method
wrapping it, so "the service is the problem" is only true because the service is where the
transaction ends.

## Interview questions

**★ At what exact point does an entity become detached in a Spring service?**
When the persistence context that holds it closes. With `JpaTransactionManager` and no
open-in-view, that is when the outermost `@Transactional` method returns and the transaction
interceptor completes the transaction — the `EntityManager` it opened is unbound from the
thread and closed, and everything it managed becomes detached at once. The transition happens
after the method body has finished and before the caller resumes, so no line of application
code is executing when it occurs.

**★ Why is returning an entity from a service method a design problem rather than just a
risk?**
Because the return type makes a promise the method cannot keep and the caller cannot verify.
`Order` declares a `customer`, `lines` and everything reachable from them, so a caller reading
the type is entitled to all of it. What is actually loaded depends on the query, the fetch
mappings, the data in this particular row, what else was in the persistence context, and
whether anything touched an association first. None of that is expressible in the signature,
and four different edits in four different files can change it without any caller changing.

**★ Is returning `List<Order>` from a transactional method different from returning one
`Order`?**
Only in that it fails less predictably. Every element is detached with the same partial graph,
so whether the caller sees the exception depends on which element it touches and which
association it reads. A list also multiplies the cost of every wrong answer to "what is
loaded", because the caller reading one association across the whole list is the classic N+1
if a session is open and a `LazyInitializationException` if it is not — the same design fault
producing two different symptoms depending on configuration. The performance side is
**[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)**.

**★ Someone proposes documenting, in javadoc, exactly which associations each service method
leaves initialised. Why is that not enough?**
Because the document is not checkable and cannot stay correct. Adding an association to the
entity, removing an `@EntityGraph` from a repository method, changing a fetch type, or simply
encountering a row with a different null pattern all change the true answer without touching
the javadoc. It also does not help the framework code — Jackson, a template engine, a mapper —
that is doing the actual walking and has never read your comment. A type is checkable; a
comment is a promise made by whoever last edited it.

**★ Can the caller defend itself?**
Not usefully. To find out whether an association is loaded it must either dereference it —
which is the fetch it was trying to avoid — or call `Hibernate.isInitialized` on every
association it might read, on every object, at every call site. The second is technically
correct and is an admission that the type is not carrying the information. Defensive code at
the boundary is a sign the boundary is in the wrong place.

**★ What would a correct signature look like?**
One whose return type cannot be partially loaded: a record, or a small tree of records,
containing values that were read while the session was open. Then "what is loaded" is
answered by the type itself, the compiler enforces it, adding a field to the entity does not
change any caller, and there is no object in the caller's hands that has a live relationship
with a database session. That is the argument of
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

{/* FOOTER */}
