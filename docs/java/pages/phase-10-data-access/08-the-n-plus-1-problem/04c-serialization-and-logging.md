---
title: "Nobody wrote the loop: a Jackson serialiser and a log line will both walk your entity graph and issue a query per node"
sidebar_label: "4c · Serialisation and logging"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §31.6 *Fetching* and
> §6.2 *Bytecode Enhancement*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *A Short Guide to Hibernate 7* §8.4
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Spring Boot 4.1 reference *Data → JPA and Spring Data*
> ([docs.spring.io/spring-boot/reference/](https://docs.spring.io/spring-boot/reference/data/sql.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**Every shape so far had a loop somewhere, even if it was in another file. These
two have no loop at all — the iteration is inside a library, driven by
reflection, over a graph you handed it. That is what makes them the shapes that
survive longest: there is no code to review, because the code that walks your
entities is Jackson's or Logback's.**

## Shape 7 · Returning an entity from a controller

The single most common production N+1 in Spring applications:

```java
@RestController
class OrderController {

    @GetMapping("/orders")
    List<Order> all() {                 // ← returns ENTITIES
        return orders.findAll();
    }
}
```

There is no dereference in that method. There is no mapper. The method returns
and, as far as your code is concerned, it is finished.

Then Jackson serialises the result. Jackson does not know what a proxy is; it
sees a bean and calls every getter it can find. `getLines()` is a getter, so it
is called — once per order — and each call initialises a collection. `getLines()`
returns `OrderLine` objects, which have a `getProduct()`, so that is called too,
for every line of every order.

**The serialiser performs the traversal you would never have written by hand**,
and it performs it exhaustively, because its job is to render the whole object.
The statement count is the size of the reachable graph.

Three consequences follow, and each one bites separately.

### It fetches everything, not what the client asked for

A JSON representation built by reflection over an entity contains whatever the
entity happens to be mapped to. Add an association to `Order` next year for an
unrelated feature, and this endpoint silently starts fetching it for every row.
The endpoint's cost is coupled to the entity's mapping, forever.

### It can recurse

A bidirectional association — `Order.lines` and `OrderLine.order` — is a cycle.
Jackson follows `order → lines → order → lines` until it fails. The usual
remedies (`@JsonIgnore`, `@JsonManagedReference`/`@JsonBackReference`,
`@JsonIdentityInfo`) stop the recursion and leave the N+1 completely untouched,
which is why teams often fix the stack overflow and never notice the query
count.

### Outside the transaction it throws instead

If the persistence context has closed by the time serialisation runs, the proxy
cannot initialise and you get a `LazyInitializationException` from inside a
message converter, with a stack trace full of Jackson frames and nothing of
yours. The apparent fix — keep the persistence context open through view
rendering — is `open-in-view`, and it converts the exception back into the N+1.
That trade is **chunk 15** *(not written yet)*, and it is the single most
consequential non-fix in this topic.

### The fix is not a fetch join

It is tempting to fetch-join everything the serialiser will touch. That works,
and it is the wrong shape: you have now committed to loading the entire entity
graph on an endpoint whose response is a JSON document you do not control.

**Return a DTO.** The controller should serialise a type that exists for that
endpoint, whose fields are exactly what the contract promises, and which cannot
grow a new association behind your back. That is **chunk 12** *(not written yet)*,
and this shape is the strongest argument in it.

## Shape 8 · The `toString()` in a log line

```java
@Entity
class Order {
    @Override
    public String toString() {
        return "Order{ref=" + reference + ", lines=" + lines + "}";   // ← lines is lazy
    }
}
```

```java
log.debug("processing {}", order);
```

Every `toString()` initialises the collection. If the log statement is inside a
loop over orders — and log statements usually are — that is N queries whose only
purpose is to build a string.

Four things make this shape unusually dangerous.

**It is environment-dependent.** At `INFO` the placeholder is never rendered, so
the getters are never called and there is no N+1. Turn the logger to `DEBUG` to
investigate an unrelated problem in production and you add a query per iteration
to a system that is already unwell. The bug appears exactly when you start
looking.

**It is often generated.** Lombok's `@Data` and `@ToString` include every field
by default, associations among them, and IDE-generated `toString()` does the
same. Nobody typed the dereference; a code generator did.
`@ToString(exclude = "lines")` — or Lombok's `@ToString.Exclude` on the field —
fixes it, and so does simply not putting `@Data` on an entity.

**It affects `equals` and `hashCode` too.** Lombok's `@Data` also generates those
over every field. An entity whose `hashCode()` touches a lazy collection will
initialise it the moment the entity is added to a `HashSet` or used as a map key
— which is exactly what happens inside Hibernate when it manages a `Set`-mapped
association. See [chunk 4d](04d-the-ones-you-cannot-make-lazy.md).

**It can throw.** Same as above: a `toString()` on a detached entity raises
`LazyInitializationException`, and it does so from inside your logging framework,
frequently while it is trying to log a different error. An exception thrown by
the error path is a genuinely bad afternoon.

**The rule that avoids all four: an entity's `toString()` may reference only its
identifier and its own scalar columns. Never an association.**

## Shape 9 · Validation, auditing and event listeners

The same mechanism, one more layer away from your code. Anything that receives an
entity and inspects it reflectively can trigger the traversal:

- a Bean Validation constraint that walks `@Valid` associations,
- an `@EntityListener` or an application event handler that reads the graph,
- an audit interceptor that snapshots an entity before update,
- a caching layer that serialises entities to a byte array.

All of them share the property that made shapes 7 and 8 hard: **the iteration is
in library code, driven by reflection, and does not appear in any file you
would think to review.** The detector for all of them is the same one — count the
statements, and see whether the count varies with the size of the result.

## Gotchas

**⚠️ Fixing the Jackson recursion and thinking you fixed the performance.**
`@JsonIgnore` on the back-reference stops the infinite loop. It does nothing
about the hundred queries on the forward reference, and because the endpoint now
works, nobody looks again.

**⚠️ Putting `@JsonIgnore` on the collection to stop the fetching.**
It does stop that particular fetch, and it does it by making your API contract a
consequence of your persistence annotations. The next person who needs the lines
in the response removes the annotation, and the N+1 returns with no other change
to the code.

**⚠️ Assuming `@Transactional(readOnly = true)` on the controller makes it safe.**
It makes the lazy loading *work* rather than throw. That is the opposite of
safe — the exception was the only thing telling you the traversal was happening.

**⚠️ `@Data` on a JPA entity.**
It generates `toString`, `equals` and `hashCode` over every field including
associations, which gives you shape 8 and the `hashCode` trap in
[chunk 4d](04d-the-ones-you-cannot-make-lazy.md) at once. Entities want a
hand-written `equals`/`hashCode` based on a business key or the identifier, and a
`toString` that names no association.

**⚠️ Enabling DEBUG logging to diagnose a slow endpoint, and slowing it further.**
If any `toString()` on the path touches an association, raising the log level
adds a query per log statement. The measurement changes the thing being measured,
and it changes it in the same direction as the bug you are hunting.

**⚠️ Serialising entities into a cache.**
A cache that stores serialised entities runs the same reflective traversal as
Jackson, with the extra hazard that it may store initialised proxies and
uninitialised ones interchangeably depending on what the request happened to
touch. Cache DTOs, never entities.

**⚠️ Believing a `record` DTO built by a mapper is enough.**
It is the right destination, but if the mapper reaches into the entity graph to
populate it you have moved the traversal rather than removed it — that is shape 3
in [chunk 4](04-the-shapes-it-hides-in.md). The DTO has to be populated by the
*query*, not by walking an entity.

## Interview questions

**★ Why is returning a JPA entity from a `@RestController` a problem?**
Several reasons that compound, and N+1 is the one that hurts in production.
Jackson serialises by calling every getter it can reach, so a list of one hundred
orders becomes a full traversal of the reachable object graph — a query per lazy
collection, a query per lazy to-one, and the same again one level down. Nothing
in the controller says so, because the traversal happens after your method
returns. Beyond the query count, the endpoint's JSON contract becomes a function
of the entity's mapping, so adding an association for an unrelated feature
silently changes both the response body and its cost; bidirectional associations
give Jackson a cycle to fall into; and if the persistence context has closed you
get a `LazyInitializationException` thrown from inside a message converter. The
fix is to return a type that exists for the endpoint and is populated by the
query rather than by reflection over entities.

**★ An endpoint throws `LazyInitializationException` during JSON serialisation.
What are the options and which is right?**
There are three, and they are not equivalent. You can enable `open-in-view` so
the persistence context is still open during rendering — that makes the exception
go away and converts it into a silent N+1, which is strictly worse, and it is the
Spring Boot default that Boot itself warns about. You can fetch-join everything
the serialiser will touch — that works and couples the endpoint permanently to
the whole entity graph. Or you can return a DTO populated by the query, which
removes the traversal entirely because there is no proxy in the response object
at all. The third is right. The instructive part is that the exception was doing
you a favour: it was the only signal that a traversal was happening, and the
first option's real effect is to delete the signal while keeping the cost.

**★ How can a `toString()` cause N+1?**
If it interpolates a lazy association, then rendering it initialises that
association, and log statements are usually inside loops — so it becomes one
query per iteration whose only product is a string that may never be read. Two
details make it worse than it sounds. It is level-dependent: at INFO the
placeholder is never rendered and there is no cost, so the bug appears only when
someone raises the level to DEBUG to investigate something else, which is exactly
the worst moment. And it is usually generated rather than written — Lombok's
`@Data` and `@ToString` include every field by default, so nobody typed the
dereference. The rule that avoids it is that an entity's `toString()` references
only its id and its own scalar columns.

**★ Why is `@Data` a bad annotation to put on a JPA entity?**
Because it generates three methods that all walk fields the entity should not
walk. `toString()` interpolates associations, giving a query per call and a
`LazyInitializationException` on detached entities — often thrown from inside a
logging framework while it is handling another error. `equals()` and `hashCode()`
are generated over every field, so hashing the entity initialises its lazy
associations; that fires implicitly whenever the entity is put in a `HashSet`,
including inside Hibernate's own management of `Set`-mapped associations. And
value-based equality is wrong for entities anyway, since identity is the
identifier, not the current column values. Entities want a hand-written
`equals`/`hashCode` over a stable business key or the id, and a `toString` that
names no association.

**★ What do the Jackson case, the `toString()` case and the Bean Validation case
have in common?**
The iteration is in library code, reached by reflection, and does not appear in
any file a reviewer would open. In every earlier shape there was at least a
`.map()` or a `for` somewhere in the application; here the application merely
hands an entity to something that inspects it thoroughly, and the traversal is
that library doing its job correctly. That is why no textual search finds them
and no review checklist catches them, and it is the clearest argument in the
whole topic for a mechanical detector: measure the statement count per unit of
work and check whether it varies with the size of the result. That criterion
catches a traversal no matter who wrote the code performing it.

**★ Your team wants to keep returning entities because writing DTOs is
repetitive. What is the counter-argument?**
That the repetition is buying something specific, and the alternative is not free
— it is merely paying elsewhere. Returning entities makes your HTTP contract a
projection of your database schema, so a mapping change alters the response body,
a new association changes what the endpoint fetches, and a rename becomes a
breaking API change. It also makes the endpoint's cost unbounded and unstated,
since the serialiser walks whatever is reachable. Against that, the DTO is a few
lines that are boring to write and never surprising to read. If the repetition is
genuinely the objection there are cheaper answers than giving up the boundary:
Spring Data interface projections need no implementation at all, a JPQL
constructor expression populates a record directly from the query, and a `record`
declaration is one line. What none of those require is loading the entity first —
which is the point.

**★ Would `open-in-view` be an acceptable stopgap while the DTOs are written?**
It is what most teams do and it is worth being clear-eyed about the cost.
Enabling it does not make anything faster; it converts a loud
`LazyInitializationException` into a silent N+1, and it extends the persistence
context past the transaction so the queries run outside it. So as a stopgap it
buys working endpoints and pays with the removal of the only diagnostic you had.
If you take it, take it deliberately: set the property explicitly rather than
leaving it on by default, put the statement-count assertion in place first so the
silent version is still detectable, and treat the setting as a debt with a date
on it. **Chunk 15** *(not written yet)* argues the whole trade.

---

← Prev: [4b · Three more shapes](04b-three-more-shapes.md) · Index: [The N+1 problem](README.md) · Next → [4d · The ones you cannot make lazy](04d-the-ones-you-cannot-make-lazy.md)
