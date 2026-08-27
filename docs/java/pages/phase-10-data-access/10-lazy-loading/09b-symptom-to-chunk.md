---
title: "Half the tickets that arrive labelled lazy loading are a different failure wearing the same clothes — a missing row, a proxy bound to two sessions, a serialiser walking a cycle, a LOB locator outliving its transaction — and each has a different fix in a different chunk"
sidebar_label: "09b · Symptoms that are not this exception"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `EntityManager#getReference` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)),
> the `7.4` branch source and javadoc of `org.hibernate.NonUniqueObjectException`,
> `ObjectNotFoundException`, `UnresolvableObjectException` and `AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/NonUniqueObjectException.java)),
> the Hibernate ORM 7.4 *User Guide* §3.2.47 *Handling LOB data*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Spring Data JPA `JpaRepository#getReferenceById` javadoc and
> `org.springframework.orm.jpa.EntityManagerFactoryUtils` source
> ([github.com/spring-projects](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/JpaRepository.java)),
> and the `2.19` source of `com.fasterxml.jackson.databind.ser.impl.UnknownSerializer`
> ([github.com/FasterXML/jackson-databind](https://github.com/FasterXML/jackson-databind/blob/2.19/src/main/java/com/fasterxml/jackson/databind/ser/impl/UnknownSerializer.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2,
> PostgreSQL 18.

**[09](09-the-checklist.md) is what you do before a merge. This is what you do when a ticket
arrives saying "lazy loading is broken" and the stack trace does not say
`LazyInitializationException`. Every symptom below comes from the same design mistake — a
session-bound object being used outside its session, or an entity being used as a value — and
every one of them has a different name, a different exception type and a different fix. Getting
the routing right is most of the diagnosis. This chunk takes the ones that arrive as a Hibernate
or Jakarta exception; the ones that arrive with no exception at all — a `{}` in the JSON, a null,
a driver error — are [09b2](09b2-symptoms-with-no-exception.md).**

## The routing table

| Symptom | What it actually is | Goes to |
|---|---|---|
| `EntityNotFoundException` on first access to a `getReferenceById` result | the row does not exist; the proxy was always going to find that out late | [below](#entitynotfoundexception-from-getreferencebyid) |
| `JpaObjectRetrievalFailureException` | the same thing, after Spring's exception translation ran | [below](#entitynotfoundexception-from-getreferencebyid) |
| `ObjectNotFoundException` / `UnresolvableObjectException` | a foreign key pointing at a row that is not there | [below](#objectnotfoundexception-a-dangling-foreign-key) |
| `HibernateException: Illegally attempted to associate proxy […] with two open sessions` | one object shared between two sessions — a caching or object-sharing bug | [below](#a-proxy-bound-to-two-sessions) |
| `NonUniqueObjectException` | two Java objects claiming the same row in one persistence context | [below](#nonuniqueobjectexception) |
| `LazyInitializationException: Could not retrieve real entity name […]` | it *is* this exception, from a type question rather than a state access | [01b](01b-type-questions-are-fetches.md) |
| `LazyInitializationException: Unable to perform requested lazy initialization […]` | it *is* this exception, from the bytecode-enhancement path | [08c](08c-when-enhancement-is-on.md) |
| `HibernateException: identifier of an instance of X was altered from A to B` | a setter on the identifier of an unloaded enhanced instance | [08c4](08c4-the-enhanced-instance.md) |
| JSON contains `{}` where an object was expected | the serialiser found no properties, or was told to write empty beans | [09b2](09b2-symptoms-with-no-exception.md) |
| `StackOverflowError` inside Jackson, or a response that never ends | a bidirectional association and a cycle | [Topic 07 · 16](../07-relationships-fetch/16-serialising-an-entity-graph.md) |
| JSON contains `null` for an association that exists in the database | the Jackson Hibernate module writing unfetched data as null | [06c](06c-jackson-and-the-hibernate-module.md) |
| An association is `null` where you expected a proxy | a null foreign key, or an inverse `@OneToOne` | [09b2](09b2-symptoms-with-no-exception.md) |
| A driver error reading a `Clob`/`Blob` after the transaction | a LOB locator outliving its transaction — not a Hibernate failure at all | [09b2](09b2-symptoms-with-no-exception.md) |
| A lazy column reads as `null` instead of throwing | the entity was Java-serialised and restored; the interceptor is gone | [08c5](08c5-serialising-an-enhanced-instance.md) |
| Everything works and the SQL is enormous | over-fetching, not a correctness failure | [Topic 08 · 1](../08-the-n-plus-1-problem/01-one-hundred-and-one-queries.md) |
| An empty collection where rows exist | the collection was replaced, so change tracking stopped | [01c](01c-a-collection-is-not-a-proxy.md) |

## `EntityNotFoundException` from `getReferenceById`

The most common misrouting in the list, because the symptom is "a proxy blew up in the caller",
which is the exact shape of a lazy-loading failure. It is not one.

The Jakarta Persistence 3.2 javadoc for `EntityManager#getReference`:

> *"Obtain a reference to an instance of the given entity class with the given primary key, whose
> state may be lazily fetched. **If the requested instance does not exist in the database, the
> `EntityNotFoundException` is thrown when the instance state is first accessed.** (The persistence
> provider runtime is permitted but not required to throw the `EntityNotFoundException` when
> `getReference()` is called.)"*

Spring Data's wrapper says the same thing about providers in general:

> *"Returns a reference to the entity with the given identifier. Depending on how the JPA
> persistence provider is implemented this is very likely to always return an instance and throw an
> `EntityNotFoundException` on first access. Some of them will reject invalid identifiers
> immediately."*

Three things follow.

- **The proxy is not defective and the session is not the problem.** There is no row. The failure
  would have happened inside the transaction too; the deferral is by design.
- **`getReferenceById` is not "a cheaper `findById`".** It is "give me a reference I promise not to
  read", and its legitimate use is assigning a foreign key without loading the target
  ([04b](04b-what-still-works-when-detached.md)). The specification is explicit that programs
  should use `find` to test whether a row exists.
- **The exception you see may have been translated.** Spring's
  `EntityManagerFactoryUtils.convertJpaAccessExceptionIfPossible` maps
  `jakarta.persistence.EntityNotFoundException` to `JpaObjectRetrievalFailureException`. That
  translation happens where the repository proxy is involved; because this exception is raised
  lazily on first *access*, it frequently escapes untranslated from wherever the access happened.
  **Seeing both types in one codebase for the same underlying cause is normal.**

The same specification sentence carries the line that belongs to this topic:

> *"The application should not expect the instance state to be available upon detachment, unless it
> was accessed by the application while the entity manager was open."*

That is the spec stating [04](04-the-detached-entity.md)'s argument in its own words.

## `ObjectNotFoundException`: a dangling foreign key

Different origin, similar confusion. `UnresolvableObjectException` is *"Thrown when Hibernate could
not resolve an object by id, especially when loading an association"*, with the default message `No
row with the given identifier exists`; `ObjectNotFoundException` extends it and its javadoc draws
the distinction that matters here:

> *"Thrown when `Session.find(Class, Object)` fails to select a row with the given primary key
> (identifier value). On the other hand, this exception might not be thrown immediately by
> `Session.getReference(Class, Object)` is called, even when there was no row on the database,
> because `getReference()` returns a proxy if possible. **Programs should use `Session.find()` to
> test if a row exists in the database.**"*

When this arrives while initialising an association, the diagnosis is a **referential integrity
problem, not a fetching one**: a foreign key column holding a value with no matching row.
Databases with no foreign key constraints, soft deletes that remove rows a `@ManyToOne` still
points at, and data migrations are the usual producers. No fetch plan fixes it; the row has to
exist or the column has to be null.

## A proxy bound to two sessions

```
org.hibernate.HibernateException: Illegally attempted to associate proxy [com.acme.Order#42]
with two open sessions
```

Thrown from `AbstractLazyInitializer.setSession` when a proxy that is already attached to one open
session is handed to another. Note the type: **a plain `HibernateException`, not a
`LazyInitializationException`** ([02](02-the-exception.md) records it as a neighbour).

The diagnosis is the opposite of the usual one. This is not an object that lost its session; it is
an object that has one and was given a second. That means something is **sharing entity instances
across units of work**:

- a cache holding entity references rather than values ([04f](04f-references-that-get-stored.md));
- an object stashed in the HTTP session and reused on a later request
  ([04f](04f-references-that-get-stored.md));
- a static or singleton field ([04f](04f-references-that-get-stored.md));
- concurrent requests reaching one shared object.

The fix is never `merge` or `evict`; it is to stop sharing the instance.

## `NonUniqueObjectException`

Hibernate's javadoc is the whole diagnosis:

> *"This exception is thrown when an operation would break session-scoped identity. This occurs if
> the user tries to associate two different instances of the same Java class with a particular
> identifier, in the scope of a single `Session`."*

and its default message is *"A different object with the same identifier value was already
associated with this persistence context"*.

It belongs on this page because the code that produces it is the code this topic keeps warning
about: an entity detached earlier, carried around as if it were a value, and then reattached into a
context that has already loaded that row. The classic sequence is `find`, then `persist` or `save`
on a *different* instance with the same id — very often the object that came back from a previous
request or from a cache.

**The persistence-context rule behind it is
[Topic 06 · 11 · The persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md),
and the reason `merge` is the right operation and `save` is not is
[Topic 06 · 13b](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md).** What this topic
contributes is the earlier question: why is an entity from a previous unit of work still in your
hands at all ([04f](04f-references-that-get-stored.md))?

## Gotchas

**★ The exception type is a better router than the message.** `EntityNotFoundException`,
`ObjectNotFoundException`, `NonUniqueObjectException` and `HibernateException` are four different
diagnoses, and only one branch of the table above is about fetching. Reading the type first saves
the twenty minutes spent looking for a missing fetch join that was never missing.

**★ `EntityNotFoundException` and `JpaObjectRetrievalFailureException` are the same event.** Spring
translates the first into the second where the translation post-processor is in the path. Whether
you see the translated form depends on where the *access* happened, not on where the reference was
obtained, so both appear in one codebase for one cause.

**★ "Illegally attempted to associate proxy with two open sessions" is a sharing bug, not a
fetching bug.** The object has too many sessions, not too few. `merge`, `evict` and a bigger fetch
plan all fail to address it, and the only fix is to stop reusing the instance.

## Interview questions

**★ A ticket says "lazy loading is broken" and the stack trace shows `EntityNotFoundException`.
What has actually happened?**
Somebody called `getReference` or `getReferenceById` for an identifier with no matching row. The
specification says the provider returns a reference whose state may be lazily fetched, and that if
the instance does not exist the `EntityNotFoundException` is thrown when the state is first
accessed — with the provider permitted but not required to throw it earlier. So this is a missing
row surfacing late, not a session that closed too early. The distinction matters because the fixes
are opposite: a lazy-loading failure is fixed by loading earlier or returning a DTO, and this is
fixed by using `find` when you need to know whether the row exists, and by reserving
`getReferenceById` for the case it is designed for, which is assigning a foreign key without
loading the target.

**★ How would you tell a lazy-loading failure from a referential-integrity problem?**
By the exception type and by whether the identifier is real. `LazyInitializationException` means
the data was never fetched and there is now no session to fetch it with — the row is presumed to
exist. `ObjectNotFoundException` or `UnresolvableObjectException` while initialising an association
means Hibernate went to the database and found nothing: *"No row with the given identifier
exists."* The first is a boundary problem in your code; the second is a data problem, usually a
foreign key pointing at a deleted row, and it will reproduce inside a transaction where a lazy
failure will not. That last property is the quickest test: re-run the same access with the session
open. A lazy failure disappears; a missing row does not.

**★ What does `Illegally attempted to associate proxy with two open sessions` tell you?**
That one entity instance is being used by two units of work at once, which is a sharing problem
rather than a fetching one. The proxy already holds a live session reference and something tried to
attach it to a second, so `AbstractLazyInitializer.setSession` refuses. In practice it means
entities are being held somewhere they outlive a request: a cache storing references, the HTTP
session, a static or singleton field, or two concurrent requests reaching one object. The fix is to
store values instead of entities. Note also that it is a plain `HibernateException`, so a catch
block or an alert written for `LazyInitializationException` will not see it.

**The other half of the differential — symptoms that produce no Hibernate exception at all, and
are therefore never filed as a persistence problem — is
[09b2 · Symptoms with no exception](09b2-symptoms-with-no-exception.md).**

{/* FOOTER */}
