---
title: "The fix is not to keep the session open longer — it is to make sure nothing that needs a session ever leaves the transaction, which means the boundary is a type change and not a configuration change"
sidebar_label: "05 · The DTO boundary"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching* (the recommended strategy) and §8.4 *Association fetching* (the fundamental rule
> of thumb), and §8.21 *Dealing with denormalized data* on returning record types instead of
> entity instances
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Spring Data JPA 4.1 reference on projections
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Every fix in the next chunk is an attempt to make the object safe after it has crossed the
boundary. This one changes what crosses. If the value that leaves your transactional method is
a record whose every field is already a value, then there is no proxy, no collection, no
session reference and nothing that can throw — not in the serialiser, not in the template, not
in the mapper, not in the log statement, not next year when somebody adds an association to
the entity. The exception stops being something you defend against and becomes something that
cannot be constructed. That is a much stronger property than any amount of keeping sessions
open, and it is the only fix on the list that cannot regress.**

## The rule, in one line

> **Read everything you need while the session is open; return values, not references.**

Hibernate's own recommended strategy says the same thing from the fetching side:

> *"All associations should be set `fetch=LAZY` to avoid fetching extra data when it's not
> needed… But strive to avoid writing code which triggers lazy fetching. Instead, fetch all
> the data you'll need upfront at the beginning of a unit of work, using one of the techniques
> described in Association fetching, usually, using `join fetch` in HQL or an `EntityGraph`."*

and the introduction's "most fundamental rule of thumb in ORM":

> *"explicitly specify all the data you're going to need right at the start of a
> session/transaction, and fetch it immediately in one or two queries, and only then start
> navigating associations between persistent entities."*

**Both quotes are about deciding what to fetch. The DTO boundary is what makes that decision
enforceable** — because once the return type is a record, "what does this operation need" has
exactly one answer and the compiler checks it.

## What a DTO has to be to actually work

Not every class called `OrderDto` closes the boundary. Three properties do the work, and all
three are load-bearing:

**1 · Total.** Every field holds a value that has already been read. No field is a lazily
computed accessor, a `Supplier`, a reference back to the entity, or a Hibernate-managed
collection. If any field can still reach the database, you have moved the exception, not
removed it.

**2 · Constructed inside the transaction.** The mapping runs while the persistence context is
open. That is the entire mechanism: the reads happen where reads are legal.

**3 · Free of the entity's types.** A `record OrderView(long id, String number, Customer
customer)` is not a DTO — it is an entity wearing a record's clothes, and `customer` is still a
proxy. Nested data becomes nested records.

```java
public record OrderView(
        long id,
        String number,
        Instant placedAt,
        BigDecimal total,
        CustomerView customer,
        List<LineView> lines) {

    public record CustomerView(long id, String name) {}
    public record LineView(long id, String sku, int quantity, BigDecimal price) {}
}
```

There is no way to write a `LazyInitializationException` into that type. It is not that it is
unlikely; there is no field on it that has a session.

## Where the boundary goes

```java
@Service
class OrderService {

    private final OrderRepository orders;

    @Transactional(readOnly = true)
    public OrderView findOrder(long id) {              // ← the boundary is this signature
        Order order = orders.findDetailById(id)         // fetch plan lives in the query
                            .orElseThrow(OrderNotFound::new);
        return OrderMapper.toView(order);               // reads happen HERE, in the session
    }
}
```

Three things changed and each one matters:

- **The return type is a value.** The caller cannot fail on it.
- **The mapping is inside the transaction.** Whatever it reads, it reads legally.
- **The repository method is specific.** `findDetailById` carries the fetch plan for this one
  view. A different view gets a different method, and the two cannot interfere.

🔴 **Note what is *not* in the fix: nothing about open-in-view, nothing about `EAGER`, no
`Hibernate.initialize`, no Jackson configuration, no `@JsonIgnore`.** Those all exist to
manage a hazard this design does not create.

## Two ways to build it, and they are not equivalent

**Load the entity, then map it.** The fetch plan is a `join fetch` or an `@EntityGraph` on the
repository method; the mapper reads fields. This keeps entity behaviour available (computed
methods, invariants) and pays for a full entity load plus persistence-context bookkeeping.

**Query directly into the DTO.** A constructor expression or a projection produces the record
from the result set with no entity ever instantiated. Nothing is managed, nothing is
snapshotted for dirty checking, and there is no graph to walk because there is no graph.

Both close the boundary. They differ in cost, in what they can express, and in how they fail
when you get them wrong — which is
**[05b · Mapping to a DTO](05b-mapping-to-a-dto.md)**. The N+1 argument for projections, which
is a different argument for the same technique, is
**[Topic 08 · 12 · Projections and DTOs](../08-the-n-plus-1-problem/12-projections-and-dtos.md)**.

## The DTO is the API contract, not a copy of the entity

This is the part teams get wrong in a way that makes them hate DTOs.

A DTO that mirrors the entity field-for-field is pure cost: you have written a second class
with the same shape, and every entity change is now two edits. It also does not solve the
problem it was introduced for, because a field-for-field mirror includes the associations.

A DTO that mirrors **the response** is different. It has the fields this endpoint returns and
no others. It is usually much smaller than the entity. It changes when the API changes, not
when the table changes, which is exactly the decoupling you wanted:

- renaming a column does not change the JSON;
- adding a column does not add a field to the response;
- adding an association to the entity does not add anything anywhere;
- the endpoint's payload is readable in one file.

The stronger version of this claim — that the entity was never the read model in the first
place — is
**[Topic 08 · 12d · The entity was never the model](../08-the-n-plus-1-problem/12d-the-entity-was-never-the-model.md)**.

## What you stop needing

Once the boundary is a type, a whole category of machinery becomes unnecessary:

| Thing | Why it existed | Why it goes |
|---|---|---|
| `spring.jpa.open-in-view: true` | keeps a session for the serialiser | the serialiser sees no proxies |
| The Jackson Hibernate module | teaches Jackson about proxies | there are none to teach it about |
| `@JsonIgnore` on associations | stop the walk reaching a proxy | the walk has nowhere to go |
| `@JsonManagedReference` / `@JsonBackReference` | break serialisation cycles | records have no back-references |
| `Hibernate.initialize(…)` calls | pull data in before returning | the mapper already read it |
| `EAGER` added defensively | make sure it is there | the query says what is there |
| `@Transactional` on a controller | keep the session open for the view | nothing in the view needs one |

Each of those is examined and rejected on its own terms in
**[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)** and
**[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)**.

## The honest costs

This is not free and pretending otherwise is why the argument loses.

- **More types.** One per view, not one per entity. A busy aggregate can have four or five.
- **Mapping code.** Somebody writes it, and it is boring. `05b` covers the options, including
  the ones that write it for you.
- **A second place to change** when a field is genuinely added to the API.
- **You lose entity behaviour** in the caller. If the caller needed to invoke domain methods,
  it needed the entity — which usually means the operation belonged inside the service.
- **Write paths still use entities**, and should. Loading an entity, mutating it and letting
  dirty checking flush is the correct shape for a command. The DTO boundary is about what
  *leaves*.

## Where the boundary is *not*

Two places people over-apply this:

**Between two methods inside the same transaction.** A service calling a helper, or a helper
calling a repository, is all inside the open session. Passing entities there is fine and
mapping there is noise.

**Inside a write.** `order.addLine(...)` on a managed entity is the point of having an ORM.
Do not map to a DTO to perform a mutation and map back.

The boundary is exactly one line: **the outermost transactional method's signature.**

## Gotchas

**★ A DTO containing an entity field is not a DTO.** `record OrderView(long id, Customer
customer)` compiles, looks like the pattern, and still holds a proxy. This is the single most
common way the boundary is drawn and then immediately breached, and it usually happens because
`Customer` was "already there".

**★ A DTO built *outside* the transaction fixes nothing.** Mapping in the controller, or in a
`@RestControllerAdvice`, or in a `ResponseEntity` builder, reads the same proxies at the same
wrong time. The location of the mapping is the mechanism; the type is only what makes the
location provable.

**★ A `Page<Entity>` mapped with `page.map(...)` after the transaction ends still throws.**
`Page.map` is lazy in the sense that it applies the function to the content list — the content
is entities, and mapping them happens wherever `.map` is called. Call it inside the service.

**★ Lombok `@Data` on a DTO reintroduces mutability and `equals` problems for no benefit.** A
`record` is the right shape: final fields, value equality, no accessor surprises, and it cannot
be subclassed by a bytecode enhancer.

**★ Mirroring the entity defeats the purpose and costs double.** If the DTO has every field the
entity has, including associations, you have written a second entity. Model the response.

**★ MapStruct and similar mappers will happily walk associations.** A generated mapper that
maps `Order` to `OrderView` including a nested `CustomerView` calls `order.getCustomer()`. That
is correct and safe *inside* the transaction and is a lazy load — so the fetch plan still has
to cover it, and the mapper's field list is now part of your fetch requirements.
**[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)** is what happens when it
runs outside.

**★ A DTO does not remove the N+1; it relocates the decision.** If the mapper reads
`order.getCustomer()` for a hundred orders and the query did not fetch customers, you get a
hundred queries — inside the transaction, silently, fast on your laptop. The boundary fixes
correctness. Fetch plans fix query counts, and both are still required.

**★ Nested collections in a DTO need a fetch strategy, not just a field.** `List<LineView>`
means the lines were read. Whether that was one join, one batch or a hundred selects is a
separate decision that the record's type says nothing about.

**★ "We will just add a DTO later" never happens.** The entity leaks into the controller, the
controller into the JSON, the JSON into a client, and now the entity's field names are a
published API. The cost of the boundary rises every week it is deferred.

## Interview questions

**★ Why is a DTO a stronger fix than keeping the session open?**
Because it removes the possibility rather than the occurrence. Keeping a session open means
every proxy in the returned graph *can* be dereferenced, so the code is correct only as long as
the configuration holds, the caller is a web request, and nobody adds an association. A record
of values has no proxy at all: there is no configuration that makes it fail and no future edit
to the entity that introduces a failure. One is a mitigation with preconditions; the other is a
type-level guarantee.

**★ Where exactly does the mapping have to happen, and why?**
Inside the transactional method, before it returns — because that is the only place where
reading an unfetched association is legal. The type of the returned object is what makes this
checkable: if the method returns `OrderView`, the mapping must have happened somewhere before
the `return`, and there is nowhere else it could have been. Returning `Order` and mapping in
the controller looks like the same design and closes nothing.

**★ Does a DTO fix N+1?**
Not by itself. If the mapper navigates associations that the query did not fetch, you get the
same N queries — you have moved them from after the transaction, where they threw, to inside
it, where they are silent. What a DTO does is make the fetch requirement explicit and local:
the record's fields are the list of things the query must supply. Querying *directly* into the
DTO does eliminate the N+1, because there is no graph to navigate; that is the separate
argument in Topic 08.

**★ Is it duplication to have both `Order` and `OrderView`?**
Only if `OrderView` mirrors `Order`. They answer different questions: the entity models the
data and its invariants for writing, the view models one response for reading. If they have the
same fields, that is a signal that the endpoint is exposing the table, which is the coupling
you would eventually want to break anyway. The test is whether an entity change should force an
API change — if the answer is no, the two types are earning their keep.

**★ Where should you *not* use a DTO?**
Inside the transaction. Passing entities between a service and its helpers, or into a domain
method, is what the entity is for. And on write paths: loading an entity, mutating it and
letting dirty checking produce the update is the correct shape for a command, and mapping to a
DTO and back adds a translation with no benefit. The boundary is the outermost transactional
signature, not every method signature.

**★ A team says DTOs are too much boilerplate. What is the counter-argument, and what is the
concession?**
The counter-argument is that the boilerplate is bounded and the alternative is not: mapping
code is written once per view and read by everyone, whereas leaked entities produce failures in
serialisers, templates, caches, event listeners and background jobs, each debugged separately.
The concession is real, though: they should not be writing mirror DTOs by hand. Query straight
into a record with a constructor expression, or let Spring Data derive it from the constructor
parameters, and most of the boilerplate disappears — which is
**[05b · Mapping to a DTO](05b-mapping-to-a-dto.md)**.

**★ You inherit a codebase that returns entities everywhere. What is the first move?**
Not a mass rewrite. Pick the endpoints that already fail, or the ones that would fail first
with open-in-view off, and convert those — each conversion is a record, a query and a
controller signature, and it is independently shippable. Then turn open-in-view off in tests to
get a list of everything remaining. The migration order and the property mechanics are
**[07 · Turning open-in-view off](07-turning-open-in-view-off.md)**.

{/* FOOTER */}
