---
title: "@Modifying switches the execution from getResultList to executeUpdate — and everything difficult about it comes from four sentences in the specification that say a bulk statement bypasses cascades, optimistic locking and the persistence context"
sidebar_label: "04 · Modifying queries"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Modifying Queries"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> Jakarta Persistence 3.2 §4.11 "Bulk Update and Delete Operations"
> ([spec](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html))
> and the `jakarta.persistence.Query` javadoc for `getResultList()` and
> `executeUpdate()`
> ([apidocs](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/query)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**`@Modifying` looks like a marker and behaves like a switch: with it, Spring Data
calls `executeUpdate()` on the query instead of `getResultList()`. That one change
takes you out of the world JPA spends most of its effort maintaining. A bulk
`update` or `delete` goes straight to the database — it does not cascade, it does
not fire lifecycle callbacks, it does not check or increment `@Version`, and the
persistence context is left holding objects that no longer match the rows they
came from. None of that is Spring Data's doing; all four are stated in the
specification, and they are the reason this annotation deserves more thought than
its size suggests.**

## The switch, and what happens without it

```java
@Modifying
@Query("update User u set u.firstname = ?1 where u.lastname = ?2")
int setFixedFirstnameFor(String firstname, String lastname);
```

> "Doing so triggers the query annotated to the method as an updating query
> instead of a selecting one."

and, on its scope:

> "The `@Modifying` annotation is only relevant in combination with the `@Query`
> annotation. Derived query methods or custom methods do not require this
> annotation."

**Leave it off and the query is executed as a selecting one**, which the
specification does not allow: `Query.getResultList()` throws
`IllegalStateException` *"if called for a Jakarta Persistence query language
UPDATE or DELETE statement"*. So the failure is loud and immediate — at the first
call, not at startup, because the string itself parses perfectly well.

⚠️ **`@Modifying` without `@Query` does nothing at all.** It is not an error and
nothing warns you; the derived method or the inherited `CrudRepository` method
runs exactly as it would have. An annotation that has no effect and looks like it
does is worse than a missing one.

**The return type is `int` or `void`.** `executeUpdate()` is documented as
returning *"the number of entities updated or deleted"*, and Spring Data hands
that back. `void` throws the count away, which is usually a mistake — the count is
the only evidence you have that the statement matched anything.

**A transaction is required.** `executeUpdate()` throws
`TransactionRequiredException` when there is no transaction, and the read-only
default that repositories carry on query methods does not apply to a modifying
one. This is where a repository method genuinely needs the service above it to
own the boundary —
[09 · transactions on repositories](09-transactions-on-repositories.md) and
[topic 04 · `@Transactional`](../04-spring-transactional/01-not-a-language-feature.md).

## The four rules from the specification

Everything surprising about bulk operations is in §4.11, and it is short enough
to quote in full where it matters.

**1. One entity class at a time.**

> "Bulk update and delete operations apply to entities of a single entity class
> (together with its subclasses, if any). Only one entity abstract schema type may
> be specified in the `FROM` or `UPDATE` clause."

So there is no `update … from … join …`. A statement that needs another table to
decide which rows to touch has to express it as a subquery in the `where` clause,
or become native SQL.

**2. Delete does not cascade.**

> "A delete operation only applies to entities of the specified class and its
> subclasses. It does not cascade to related entities."

`cascade = REMOVE` and `orphanRemoval` are `EntityManager.remove()` behaviours,
implemented by the provider walking the object graph. A bulk `delete` never loads
the graph, so it never walks it. What actually happens to the children is decided
by the *database* — a foreign key with `on delete cascade` removes them, one
without it rejects the statement, and the difference is in your schema rather
than in your mappings.
[07 · cascade](../07-relationships-fetch/08-cascade.md) has the mapping side.

**3. Optimistic locking is bypassed.**

> "Bulk update maps directly to a database update operation, bypassing optimistic
> locking checks. Portable applications must manually update the value of the
> version column, if desired, and/or manually validate the value of the version
> column."

🔴 **Read that twice if the entity has a `@Version` field.** The bulk statement
neither checks the version nor increments it, so a concurrent editor holding an
older copy will still pass its own version check and overwrite your change. If
you want the version to move, you write `set u.version = u.version + 1` yourself
— and the specification says so in as many words.
[06 · `@Version` and optimistic locking](../06-jpa-hibernate-model/16-version-and-optimistic-locking.md).

**4. The persistence context is not updated.**

> "The persistence context is not synchronized with the result of the bulk update
> or delete."

followed by the caution that is the practical rule:

> "Caution should be used when executing bulk update or delete operations because
> they may result in inconsistencies between the database and the entities in the
> active persistence context. In general, bulk update and delete operations should
> only be performed within a transaction in a new persistence context or before
> fetching or accessing entities whose state might be affected by such
> operations."

That is the whole of the stale-context problem, and Spring Data's two
`@Modifying` attributes exist to manage it —
[04b · flush, clear and the stale context](04b-flush-clear-and-the-stale-context.md).

## What you gain, and it is real

Set against all of that, the reason bulk statements exist: **one statement instead
of N**. Deactivating fifty thousand accounts through the entity model means
loading fifty thousand entities, dirty-checking them, and flushing fifty thousand
`update` statements; as one `@Modifying` query it is a single round-trip and the
database does the work. The entity model is the wrong shape for set-based work,
and this is the escape hatch that admits it.

⚠️ **A bulk statement is also a lock footprint.** One statement touching fifty
thousand rows holds row locks on all of them until the transaction commits, which
on a busy table is a different production problem from the one you solved.
Batching by key range is often the right compromise —
[topic 03 · locking and `select for update`](../03-jdbc-transactions/12-locking-and-select-for-update.md).

## Gotchas

**⚠️ Forgetting `@Modifying` on an `update` or `delete` `@Query`.**
The query is run as a select and the specification requires an
`IllegalStateException`. It fails on first call rather than at startup, because
the string is valid JPQL either way.

**⚠️ Putting `@Modifying` on a derived method or an inherited one.**
It is *"only relevant in combination with the `@Query` annotation"*. On anything
else it is decoration — no effect, no warning, and a strong suggestion to the
next reader that something special is happening.

**⚠️ Declaring the method `void`.**
`executeUpdate()` returns the number of entities affected, and `void` discards
it. That count is the only cheap check that the `where` clause matched what you
expected; without it, a predicate that matches nothing looks exactly like a
successful call.

**⚠️ Assuming the count is a count of *rows in the table*.**
It is the number of entities updated or deleted by *this statement*. Zero means
the predicate matched nothing — which may be correct, may be a bug, and is worth
asserting either way.

**⚠️ Calling a modifying method with no transaction.**
`executeUpdate()` requires one and throws `TransactionRequiredException` without.
The repository's own defaults do not supply a writable transaction for you on a
declared modifying query; the service boundary does.

**⚠️ Expecting `cascade = REMOVE` to apply.**
It does not — cascading is a persistence-context operation and a bulk delete does
not load the graph. What happens to the children is whatever the foreign key
says, which is a schema question your mappings do not answer.

**⚠️ Expecting `@PreRemove` or `@PreUpdate` to fire.**
They do not. Anything implemented as a lifecycle callback — auditing fields,
denormalised counters, search-index invalidation — is silently skipped by a bulk
statement.

**⚠️ Running a bulk update on a versioned entity and thinking you are safe.**
The statement bypasses the optimistic-locking check *and* leaves the version
unchanged, so concurrent editors continue to succeed against a row you have
already modified. If the version matters, increment it in the `set` clause
yourself.

**⚠️ Joining in a bulk statement.**
Only one entity type may appear in the `UPDATE` or `FROM` clause. The portable
way to filter by another table is a subquery in the `where` clause; anything
beyond that is native SQL.

**⚠️ Treating a bulk delete as a cheap version of the derived one.**
They are different operations with different semantics — one issues a statement,
the other loads entities and removes them one by one so callbacks fire. Swapping
them for speed changes behaviour, and the change is invisible in the diff.
[04c · derived delete versus bulk delete](04c-derived-delete-versus-bulk-delete.md).

**⚠️ Updating fifty thousand rows in one statement on a busy table.**
It is one round-trip and it is also a lock on every one of those rows until
commit. The set-based version can be the right call and still need to be done in
batches.

**⚠️ Writing a bulk update that "just fixes the data" outside a migration.**
A `@Modifying` query is application code that mutates rows in bulk with no
history and no review trail beyond the commit. Data repairs usually belong in a
migration, where they are versioned and applied once —
[Topic 11 · Migrations with Flyway](../11-flyway-migrations/README.md).

## Interview questions

**★ What does `@Modifying` actually change?**
The execution. With it, Spring Data calls `executeUpdate()` on the query; without
it, the query is run as a selecting one. It only means anything alongside
`@Query` — derived and custom methods do not need it and are unaffected by it.

**★ What happens if you leave it off an `update` query?**
The query is executed with `getResultList()`, and the specification requires
`IllegalStateException` when that is called for a JPQL `UPDATE` or `DELETE`
statement. The failure is at the first invocation, because the query string is
valid JPQL regardless.

**★ What should the method return?**
`int` — the number of entities updated or deleted, straight from
`executeUpdate()`. `void` is legal and throws away the only signal that the
statement matched anything, which is exactly what you want to assert in a test.

**★ Does a bulk delete cascade to children?**
No. The specification says a delete applies only to entities of the specified
class and its subclasses and does not cascade to related entities. Whether the
children go away is decided by the foreign key definition in the schema, not by
`cascade = REMOVE` in the mapping.

**★ What happens to `@Version` during a bulk update?**
Nothing, and that is the danger. The statement bypasses optimistic-locking checks
and does not increment the version, so concurrent editors with a stale copy still
pass their own checks. The specification tells portable applications to update
and validate the version column manually.

**★ Why is the persistence context a problem here?**
Because it is not synchronised with the result. Entities already loaded keep
their old field values, so code that reads them after the bulk statement sees the
pre-update state — and if it then flushes, it can write that state back.

**★ What is the specification's own advice about when to run one?**
In a transaction with a new persistence context, or before fetching or accessing
any entity whose state the statement might affect. In Spring terms that means
early in the method, or in its own transaction, and never in the middle of code
that is holding managed copies of those rows.

**★ Why use a bulk statement at all, given all that?**
Because the alternative is one statement per row. Updating fifty thousand
entities through the persistence context means loading and dirty-checking fifty
thousand objects; the bulk statement is a single round-trip. For set-based work
the entity model is the wrong tool and this is the documented way out of it.

**★ Can a bulk update join another table?**
Not directly — only one entity type may appear in the `UPDATE` or `FROM` clause.
Use a subquery in the `where` clause for the portable version, or drop to native
SQL if the database's own `update … from` syntax is genuinely needed.

**★ Where would you draw the line between a bulk update and a migration?**
On whether it is a repeatable operation of the application or a one-off repair of
the data. Application behaviour — deactivating expired accounts nightly — is a
`@Modifying` query. A correction applied once to fix bad rows belongs in a
versioned migration, where it is reviewed, ordered and recorded.

**★ How do you make a modifying repository method safe to review?**
Return `int` and assert it; keep the statement to one entity type; increment the
version explicitly if the entity has one; decide `clearAutomatically` and
`flushAutomatically` deliberately rather than by default; and put it at a point in
the transaction where nothing is holding affected entities.

{/* FOOTER */}
