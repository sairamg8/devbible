---
title: "Ask whether something is loaded without loading it — Hibernate's static helpers and JPA's PersistenceUnitUtil, and the operations that answer questions about a collection without fetching it"
sidebar_label: "14b · Inspecting initialization"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `org.hibernate.Hibernate` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Jakarta Persistence 3.2 `PersistenceUnitUtil` javadoc
> ([.../persistenceunitutil](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/persistenceunitutil))
> and the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**"Is this loaded?" is a question you can ask without loading it, and there are two APIs
for asking — the specification's `PersistenceUnitUtil` and Hibernate's `Hibernate` class,
whose javadoc describes it as "various utility functions for working with proxies and
lazy collection references". The second is more convenient and can do things the first
cannot, including several genuinely useful operations on collections that never fetch
anything.**

## The portable way: `PersistenceUnitUtil`

```java
PersistenceUnitUtil util = entityManagerFactory.getPersistenceUnitUtil();

boolean loaded  = util.isLoaded(book);                    // is the entity loaded?
boolean authors = util.isLoaded(book, "authors");         // is that attribute loaded?
Object  id      = util.getIdentifier(book);               // read the id
util.load(book, "authors");                               // force it to load
```

The javadocs, quoted:

- `isLoaded(Object)` — *"Determine the load state of an entity belonging to the persistence
  unit. This method can be used to determine the load state of an entity passed as a
  reference."*
- `isLoaded(Object, String)` — *"Determine the load state of a given persistent attribute of
  an entity."*
- `getIdentifier(Object)` — *"Return the id of the entity. A generated id is not guaranteed
  to be available until after the database insert has occurred."*
- `load(Object)` / `load(Object, String)` — *"Load the persistent state of an entity […]
  belonging to the persistence unit and to an open persistence context."*
- `getVersion(Object)` — the `@Version` value, with the same caveat as `getIdentifier`.

Obtained from the factory (`emf.getPersistenceUnitUtil()`) or, in JPA 3.2, from
`Persistence.getPersistenceUtil()` for the provider-agnostic `PersistenceUtil` form. Both
are standard, and both work on any provider.

⚠️ **`isLoaded` on an attribute takes a string.** No compile-time check. The JPA static
metamodel does not help here; there is a metamodel-typed variant on Hibernate's API but not
on this one.

## The convenient way: `org.hibernate.Hibernate`

```java
boolean loaded = Hibernate.isInitialized(book.getAuthors());
Hibernate.initialize(book.getAuthors());
```

The javadoc descriptions:

| Method | Javadoc |
|---|---|
| `isInitialized(Object)` | *"Determines if the given proxy or persistent collection is initialized."* |
| `initialize(Object)` | *"Force initialization of a proxy or persistent collection."* |
| `isPropertyInitialized(Object, String)` | *"Determines if the field or property with the given name of the given entity instance is initialized."* |
| `isPropertyInitialized(E, Attribute)` | the same, taking a metamodel `Attribute` — type-safe |
| `unproxy(Object)` | *"If the given object is not a proxy, return it […] return a direct reference to its proxied entity object."* |
| `unproxy(T, Class)` | *"If the given object is not a proxy, cast it to the given type, and return it."* |
| `getClass(T)` | *"Get the true, underlying class of a proxied entity."* |

Hibernate's *Introduction* presents these as the ergonomic equivalents of the standard API
— *"Hibernate has a slightly easier way to do it"* — and they are, notably because
`isPropertyInitialized` has a metamodel-typed overload the specification's version lacks.

`Hibernate.getClass(x)` is the answer to **[14](14-what-a-lazy-association-is.md)**'s first
problem: it returns the real entity class rather than the generated proxy class, so
class-keyed lookups can be made to work without unproxying.

## The part worth knowing about: operations that never fetch

This is where Hibernate's API stops being a convenience wrapper and starts doing something
the specification cannot. The *Introduction* flags it:

> Of particular interest are the operations which let us work with unfetched collections
> without fetching their state from the database.

| Method | Javadoc |
|---|---|
| `contains(Collection, T)` | *"Determine if the given persistent collection contains the given element, without fetching its state from the database."* |
| `size(Collection)` | *"Obtain the size of a persistent collection, without fetching its state from the database."* |
| `get(Map, K)` | *"Obtain the value associated with the given key by the given persistent map, without fetching the state of the map from the database."* |
| `get(List, int)` | *"Obtain the element of the given persistent list with the given index, without fetching the state of the list from the database."* |

The guide's worked example:

```java
Book book = session.find(Book.class, bookId);                      // authors unfetched
Author authorRef = session.getReference(Author.class, authorId);   // an unfetched proxy
boolean isByAuthor = Hibernate.contains(book.getAuthors(), authorRef);  // no fetching
```

Both the collection and the proxy stay unfetched. Hibernate answers the membership question
with a targeted query rather than by materialising the collection.

**`Hibernate.size(collection)` deserves a note of its own**, because
`collection.size()` — the ordinary Java call — initialises the whole collection. Swapping
one for the other turns "load every child row to count them" into a count. Where a mapped
collection exists and you need its size, this is the call to reach for.

## Where these belong, and where they do not

**Legitimate uses.**

- **Deciding what to serialise.** Skip attributes that are not loaded rather than
  triggering fetches during serialisation — the mechanism a Jackson Hibernate module uses.
  See **[16](16-serialising-an-entity-graph.md)**.
- **A safe `toString`.** Print `authors: <not loaded>` instead of forcing a fetch from a
  log statement. See **[15](15-equals-hashcode-tostring.md)**.
- **Assertions in tests.** `assertThat(Hibernate.isInitialized(order.getLines())).isFalse()`
  is how you prove a mapping is actually lazy — and it is worth writing, because
  **[12](12-fetch-type-defaults.md)** showed that `LAZY` is only a hint.
- **Reading a size or testing membership** without loading.

**Not legitimate.**

- **`Hibernate.initialize` as a general fetching strategy.** The *Introduction* is direct
  about the cost: *"the above code is very inefficient, requiring two trips to the database
  to obtain data that could in principle be retrieved with just one query."* Fetching what
  an operation needs, in the query that loads it, is Topic 08's material —
  [Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md).
- **`Hibernate.unproxy` to make an `instanceof` work.** It is a type question asked of
  something that should have been given a method.
- **Anything that makes production behaviour depend on load state.**
  `if (isInitialized(x)) { … } else { … }` is a branch on how the entity happened to be
  loaded, which is a property of an unrelated call site.

## Gotchas

**`isLoaded` returning `false` is not an error.** It is the normal state of a lazy
association. Code that treats it as a problem to fix by initialising is reimplementing eager
fetching one call at a time.

**`Hibernate.initialize` outside a session throws.** It needs an open persistence context,
exactly like touching the association would. It is not a repair for a detached entity —
that is **Topic 10 · Lazy-loading pitfalls** *(not written yet)*.

**`collection.size()` and `Hibernate.size(collection)` are different operations.** The first
loads everything; the second does not. They read almost identically at a glance.

**`isPropertyInitialized` is about bytecode-enhanced lazy *attributes*, not just
associations.** With enhancement enabled, a `@Basic(fetch = LAZY)` column can be unloaded
too, and this is how you ask.

**`getIdentifier` on a transient entity may return null.** The javadoc says a generated id
is not guaranteed to be available until after the insert. Same for `getVersion`.

**Neither API tells you whether an entity is managed, detached or transient.** The
`Hibernate` class has no `isDetached` in the 7.4 javadoc listing. Entity state is
[Topic 06 · JPA and the persistence context](../06-jpa-hibernate-model/README.md), and `em.contains(x)` is
the question you actually want there.

**Do not build a `hashCode` on load state.** It changes when the association initialises.
This is a subtler version of the generated-id problem in **[15](15-equals-hashcode-tostring.md)**.

## Interview questions

**★ How do you check whether a lazy association has been loaded, without loading it?**
Either the standard `PersistenceUnitUtil` — `emf.getPersistenceUnitUtil().isLoaded(entity)`
or `isLoaded(entity, "attributeName")` — or Hibernate's `Hibernate.isInitialized(x)`, whose
javadoc describes it as determining whether the given proxy or persistent collection is
initialized. The standard API is portable; Hibernate's is more convenient and has a
metamodel-typed overload of `isPropertyInitialized`, so the attribute name is checked at
compile time.

**★ What is the difference between `collection.size()` and `Hibernate.size(collection)`?**
`size()` on the collection is an ordinary Java call, and to answer it the persistent
collection has to load every element — so a call that looks like reading a counter is a full
fetch of every child row. `Hibernate.size` is documented as obtaining the size of a
persistent collection *without fetching its state from the database*; it answers with a
targeted query instead. Same for `Hibernate.contains` versus `collection.contains`.

**★ Is `Hibernate.initialize` a reasonable way to solve a fetching problem?**
Only as a targeted, deliberate act. Hibernate's own documentation calls the pattern very
inefficient, because it makes two round trips for data that a single query could have
returned. As a general strategy it is eager fetching applied one call at a time, with all
the round trips and none of the visibility. Fetching what the operation needs in the query
that loads the entity is the right answer, and the mechanisms for that belong to the N+1
topic.

**★ What is `Hibernate.getClass` for?**
Getting the true, underlying class of a proxied entity, which is what its javadoc says. A
proxy's own `getClass()` returns Hibernate's generated subclass, so anything keyed on the
entity class — a registry, a serialiser configuration, a naive `equals` — sees the wrong
type. `Hibernate.getClass(x)` gives the real one without needing to unproxy the object,
though the better design is usually to avoid asking the question at all.

**★ Where would you legitimately use these helpers in production code?**
Deciding what to include when serialising, so unloaded associations are skipped rather than
fetched; writing a `toString` that reports "not loaded" instead of triggering a query from a
log line; and answering size or membership questions against an unloaded collection using
`Hibernate.size` and `Hibernate.contains`. In tests they are also how you prove a mapping is
genuinely lazy, which is worth asserting because `LAZY` is only a hint by specification.
What they should not be is a branch in business logic, since load state is a property of
whichever call site happened to load the entity, not of the domain.

---

← Prev: [14 · What a lazy association is](14-what-a-lazy-association-is.md) · Index: [Relationships and fetch types](README.md) · Next → [15 · equals, hashCode, toString](15-equals-hashcode-tostring.md)
