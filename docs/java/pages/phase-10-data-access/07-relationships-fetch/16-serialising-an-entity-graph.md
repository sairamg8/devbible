---
title: "Serialising an entity graph to JSON hits the same recursion as toString, and every annotation that patches it is a worse answer than a DTO"
sidebar_label: "16 · Serialising an entity graph"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §31.6 *Fetching*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Jackson annotation sources for `@JsonManagedReference` and `@JsonBackReference`
> ([github.com/FasterXML/jackson-annotations](https://github.com/FasterXML/jackson-annotations/blob/2.x/src/main/java/com/fasterxml/jackson/annotation/JsonManagedReference.java)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Return an entity from a controller and the serialiser walks the object graph. A
bidirectional association is a cycle in that graph, so the walk does not terminate — the
same failure as `toString` in [chunk 15](15-equals-hashcode-tostring.md), from a
different caller. There is a family of annotations that patch it, and every one of them
puts a presentation decision inside your domain model. The honest answer is to serialise
a DTO.**

## The two failures, and they are different

```java
@GetMapping("/publishers/{id}")
public Publisher get(@PathVariable Long id) {
    return publisherRepository.findById(id).orElseThrow();   // ⛔
}
```

**Failure one: the cycle.** `Publisher` has `books`; each `Book` has `publisher`; the
serialiser follows both. It emits publisher, then books, then for each book its publisher,
then that publisher's books — until the stack ends. This is a pure object-graph problem,
established in **[1 · Two models, one foreign key](01-two-models-one-foreign-key.md)**: the
object model has two references where the database has one column, and a serialiser sees
both.

**Failure two: the proxies.** Walking the graph touches lazy associations, so the serialiser
initialises them. Every association becomes a query, and the response contains data no
caller asked for. If the transaction has already closed — which for a controller method it
usually has — the walk throws instead, because a proxy outside its persistence context is
not fetchable. That specific exception belongs to **Topic 10 · Lazy-loading pitfalls** *(not
written yet)*.

**Failure two-and-a-half**, worth separating because it is often what people actually
notice: even when it works, the response shape is your **database schema**, published to
every client. Rename a column, add a lazily-loaded association, change a mapping — and the
API changes with it.

## The patches, and what each one costs

### `@JsonIgnore` on the child's back-reference

```java
class Book {
    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnore
    private Publisher publisher;
}
```

Breaks the cycle by removing the edge. **The cost:** the field is now unserialisable
everywhere, including on the endpoint that returns a book and legitimately wants its
publisher. One annotation, one global decision, made in the entity for the benefit of one
endpoint.

### `@JsonManagedReference` / `@JsonBackReference`

The Jackson sources describe the pair precisely. `@JsonManagedReference` marks the *"parent"
(or "forward") link*, and:

> Value type (class) of property must have a single compatible property annotated with
> `@JsonBackReference`. Linkage is handled such that the property annotated with this
> annotation is handled normally (serialized normally, no special handling for
> deserialization); it is the matching back reference that requires special handling.

And `@JsonBackReference` marks the *"child" (or "back") link*:

> the property annotated with this annotation is not serialized; and during
> deserialization, its value is set to instance that has the "managed" (forward) link.

So the forward direction serialises and the back direction is omitted and reconstructed on
the way in. Two more details from the sources worth knowing:

- **The back reference cannot be a collection.** *"Value type of the property must be a
  bean: it can not be a Collection, Map, Array or enumeration."* So the pair is only usable
  in the parent-collection / child-reference direction, not the reverse.
- **References are named**, with `value()` defaulting to `"defaultReference"`, and it is an
  error for a class to have two managed references with the same name. An entity with two
  bidirectional pairs needs distinct names on each.

**The cost:** it is directional and global. `Publisher` always serialises its books;
`Book` never serialises its publisher. Every endpoint gets that shape whether it suits them
or not.

### `@JsonIdentityInfo`

Emits each object once and replaces subsequent occurrences with its identifier. The cycle
terminates and no data is lost.

**The cost:** the JSON now has two shapes for the same concept — a full object the first
time, a bare id afterwards — and which one a client sees depends on traversal order. Every
consumer has to handle both. That is a hard API to document and a harder one to consume from
a statically-typed client.

### A Hibernate-aware Jackson module

Modules exist that teach the serialiser about proxies and persistent collections, so
uninitialised associations are emitted as `null` or omitted rather than being fetched. This
addresses failure two.

**The cost:** the response shape now depends on **how the entity happened to be loaded** —
which associations some service method fetched. The same endpoint returns different JSON
after an unrelated change to a query. That is a genuinely bad property for an API.

> ⚠️ I have quoted the two reference annotations from Jackson's own sources. The exact
> behaviour of the other Jackson features named here, and of the Hibernate-aware modules,
> I did not verify against a primary source in this pass — treat the descriptions as
> orientation and check the library's own documentation before relying on the details.

## The answer: a DTO

```java
public record BookSummary(String isbn, String title) {}

public record PublisherView(Long id, String name, List<BookSummary> books) {}
```

```java
@GetMapping("/publishers/{id}")
public PublisherView get(@PathVariable Long id) {
    return publisherService.view(id);
}
```

Every failure above disappears, and not by being patched:

- **No cycle**, because a DTO graph is a tree — you did not put a back-reference in it.
- **No accidental fetching**, because nothing in the DTO is a proxy. It holds values.
- **No schema leak**, because the response shape is written down in a type you control.
- **No lazy-loading exception**, because the DTO is built inside the transaction and the
  controller returns plain data.
- **A stable contract**, because renaming an entity field is a compile error in the
  mapping code rather than a silent change to the API.

Hibernate's own performance chapter makes the argument from a different direction, and
arrives at the same place:

> For read-only transactions, you should fetch DTO projections because they allow you to
> select just as many columns as you need to fulfill a certain business use case. This has
> many benefits like reducing the load on the currently running Persistence Context because
> DTO projections don't need to be managed.

🔴 **Selecting a projection directly in the query — rather than loading entities and mapping
them — is Topic 08's material.** **Topic 08 · The N+1 problem** *(not written yet)* owns
projections, entity graphs and fetch joins. What belongs here is the mapping-level point:
the recursion is a property of bidirectional associations, and the way to not have it in
your API is to not send entities.

## "But that is boilerplate"

It is some, and the objection is worth answering rather than dismissing.

**It is less than it looks.** A record and a mapping method per view. The mapping method is
the only place the shape is decided, which is where you want it.

**It is boilerplate that pays interest.** The annotations above are also boilerplate — spread
across the entity model, invisible from the controller, and coupling your persistence
mapping to your HTTP contract. The DTO's boilerplate is local and legible.

**It is the boundary you were going to need anyway.** The first time a client needs a
computed field, a renamed property, or a subset of a collection, the entity-as-response
approach has no place to put it and the DTO already does.

## Gotchas

**Fixing `toString` does not fix JSON.** They are two different walkers over the same cycle.
Both need addressing, and they need different fixes.

**Returning an entity from a `@RestController` serialises outside the transaction.** By the
time Jackson runs, the persistence context is typically gone. Whether that throws or
silently returns a half-graph depends on configuration — either way, the response shape is
being decided by transaction timing.

**Accepting an entity as a `@RequestBody` is worse than returning one.** Jackson constructs a
detached instance with whatever fields the client sent, including ones they should not
control. Bind to a DTO and map explicitly.

**`@JsonIgnore` on the owning side hides the foreign key from every consumer.** People
usually mean to hide it from one response. It applies to all of them, and to deserialisation
too.

**Two bidirectional pairs on one entity need distinct reference names.** Jackson's sources
say it is an error for a class to have multiple managed references with the same name, even
if the types differ, and the default name is shared.

**`@JsonBackReference` cannot go on a collection.** Its source says the value type must be a
bean, not a `Collection`, `Map`, array or enum — so the pair only works with the collection
as the managed side.

**A Hibernate-aware serialiser module makes the response depend on load state.** Change a
service method's fetching and an endpoint's JSON changes. It is a fix for the mechanism and
a problem for the contract.

**Mapping the DTO outside the transaction reintroduces the whole problem.** Build it in the
service, inside the transaction, where the associations are still loadable.

## Interview questions

**★ Why does returning a JPA entity from a controller cause infinite recursion?**
Because a bidirectional association is a cycle in the object graph, and a serialiser walks
the graph. The parent renders its collection, each child renders its parent, and so on. It
is the same structural problem as `toString` recursion — one relationship represented by two
Java references — arriving from a different caller. Nothing about the database is involved;
the database has one foreign key and no cycle at all.

**★ What is the second problem, besides the cycle?**
The walk touches lazy associations, so it initialises them — the response contains data
nobody asked for and each association costs a query. And since serialisation usually happens
after the controller method returns, the persistence context is typically closed by then, so
instead of extra queries you get an exception from a proxy that is no longer fetchable. A
third issue, easy to overlook, is that the response shape becomes your database schema,
published to every client.

**★ Explain `@JsonManagedReference` and `@JsonBackReference`.**
They mark the two ends of a two-way linkage. The managed reference is the forward or parent
link and is serialised normally; the back reference is the child link, is not serialised at
all, and on deserialisation is set to the instance holding the managed link — that is
straight from Jackson's own source documentation. Two constraints matter in practice: the
back reference cannot be a collection, so the collection must be the managed side; and
references are named, with a shared default, so an entity with two bidirectional pairs needs
distinct names or it is an error.

**★ Why is a DTO better than any of the annotation-based fixes?**
Because the annotations put a presentation decision inside the persistence model, globally.
`@JsonIgnore` hides a field from every endpoint to help one. The reference pair fixes a
direction for the whole application. `@JsonIdentityInfo` gives the same concept two JSON
shapes depending on traversal order. A Hibernate-aware module makes the response depend on
what some service method happened to fetch. A DTO instead states the response shape in a
type you own: no cycle because it is a tree, no accidental fetching because it holds values,
no schema leak, and a contract that breaks at compile time when the entity changes rather
than silently.

**★ Does Hibernate's own documentation take a position on this?**
Yes, from the performance side rather than the API side. Its fetching chapter says that for
read-only transactions you should fetch DTO projections, because they let you select only
the columns the use case needs and because projections do not have to be managed by the
persistence context. That is the same conclusion by a different route: entities are for
mutation inside a transaction, and data leaving the transaction should be data, not entities.

**★ What about accepting an entity as a request body?**
Worse than returning one. Jackson constructs a detached instance from whatever the client
sent, which means the client decides which fields are populated — including fields they
should have no control over — and the resulting object has no relationship to the managed
state in the database. Bind to a DTO, validate it, and map it onto a loaded entity
explicitly, so every field the client can influence is one you chose to expose.

---

← Prev: [15b · No natural key, and Lombok](15b-no-natural-key-and-lombok.md) · Index: [Relationships and fetch types](README.md)
