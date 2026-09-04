---
title: "What JpaRepository adds on top of the store-neutral interfaces is a flush family, a batch-delete family and getReferenceById — every one of which leaks the persistence context into the API"
sidebar_label: "1c · What JpaRepository adds"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `JpaRepository` javadoc and the deprecated list,
> Spring Data JPA Parent 4.1.0
> ([JpaRepository](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html),
> [deprecated-list](https://docs.spring.io/spring-data/jpa/docs/current/api/deprecated-list.html)),
> and the Spring Data JPA 4.1 reference "Defining Repository Interfaces"
> ([definition.html](https://docs.spring.io/spring-data/jpa/reference/repositories/definition.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**`CrudRepository` and `PagingAndSortingRepository` are store-neutral: nothing on
them mentions JPA. The seven methods `JpaRepository` adds are the opposite —
every one of them exists because there is a persistence context, and every one of
them is a way of telling it to behave unusually. That is why they are on a
JPA-specific interface, and it is also why publishing them to every caller is a
decision rather than a default.**

## The seven, with their javadoc

| Method | Since | Javadoc, condensed |
|---|---|---|
| `void flush()` | — | *"Flushes all pending changes to the database."* |
| `<S extends T> S saveAndFlush(S)` | — | *"Saves an entity and flushes changes instantly."* |
| `<S extends T> List<S> saveAllAndFlush(Iterable<S>)` | 2.5 | *"Saves all entities and flushes changes instantly."* |
| `void deleteAllInBatch()` | — | *"Deletes all entities in a batch call."* |
| `void deleteAllInBatch(Iterable<T>)` | 2.5 | one query; see the warning below |
| `void deleteAllByIdInBatch(Iterable<ID>)` | 2.5 | one query, by id, nothing loaded |
| `T getReferenceById(ID)` | 2.7 | a reference, no SELECT |

## The flush family

`flush()` is `EntityManager.flush()` on the repository. It pushes the pending
unit of work to the database without committing, and it exists for the two cases
where the automatic flush points are not enough: reading through a native query
that must see your uncommitted writes, and forcing a constraint violation to
surface at a line you control rather than at commit.

The mechanics — what triggers an automatic flush, what order operations go in,
and why "reading your own writes" is the usual reason to want one — belong to
[topic 06 · flush](../06-jpa-hibernate-model/15-flush.md) and its chunks.

What matters *here* is the API consequence. `saveAndFlush` reads like a stronger
`save`, and it is not: it is `save` plus a flush of **everything else pending in
the persistence context too**, because flush is not scoped to one entity. A
service that reaches for `saveAndFlush` because "I want to be sure it is saved"
has usually misdiagnosed the problem — the write was already going to happen at
commit — and has now also flushed unrelated dirty entities early, which changes
the order statements reach the database and can turn a latent constraint problem
into a visible one somewhere unrelated.

## The batch-delete family, and the warning attached to it

The javadoc for `deleteAllInBatch(Iterable)` is unusually blunt, and it is worth
quoting in full:

> *"Deletes the given entities in a batch which means it will create a single
> query. This kind of operation leaves JPAs first level cache and the database
> out of sync. Consider flushing the `EntityManager` before calling this method.
> It will also NOT honor cascade semantics of JPA, nor will it emit JPA lifecycle
> events."*

`deleteAllByIdInBatch(Iterable<ID>)` carries the same first two sentences.

Three separate hazards, stated by the API itself:

1. **The persistence context goes stale.** Entities you deleted are still managed
   and still look present. Reading one back within the same transaction returns
   the cached instance.
2. **Cascades do not run.** A `cascade = REMOVE` mapping is simply ignored, so a
   child row with a foreign key to a deleted parent stays behind and the database
   raises a constraint violation — or worse, does not, because nobody declared
   the constraint.
3. **Lifecycle callbacks do not fire.** `@PreRemove`, `@PostRemove` and any
   auditing hooked to them are skipped.

Against that, `deleteAll()` loads every entity and deletes them one at a time,
honouring all three. The contrast is the whole content of
[4 · modifying queries](04-modifying-queries.md), because it is exactly the same
trade a `@Modifying` bulk statement makes.

🔴 **Neither is "the right one".** `deleteAllInBatch` is one statement with no
semantics; `deleteAll` is N statements with full semantics. Choosing requires
knowing whether the entity has cascades, callbacks or an audit trail — which is a
property of the mapping, not of the call site.

## `getReferenceById`

```java
Order order = new Order();
order.setCustomer(customerRepository.getReferenceById(customerId));   // no SELECT
orderRepository.save(order);
```

That is the case it is for. The order needs a foreign key value, and reading the
customer row to obtain a value you already have in hand is wasted work.

The javadoc is careful in a way that matters:

> *"Returns a reference to the entity with the given identifier. Depending on how
> the JPA persistence provider is implemented this is very likely to always
> return an instance and throw an `EntityNotFoundException` on first access. Some
> of them will reject invalid identifiers immediately."*

So a nonexistent id does not fail at the call. It fails when something touches a
field on the returned proxy — possibly in another method, possibly during
serialisation, possibly at flush when the foreign key turns out not to exist.
This is `EntityManager.getReference`, and its semantics are argued in
[topic 06 · persist, find, getReference](../06-jpa-hibernate-model/13-persist-find-getreference.md).

## The three deprecated spellings

The 4.1.0 deprecated list is short and unambiguous:

| Deprecated | Replacement, per the javadoc |
|---|---|
| `getOne(ID)` | *"Use `getReferenceById(ID)` instead."* |
| `getById(ID)` | *"Use `getReferenceById(ID)` instead."* |
| `deleteInBatch(Iterable<T>)` | *"Use `deleteAllInBatch(Iterable)` instead."* |

🔴 **`getReferenceById` is the current spelling, and all three older names still
exist on 4.1.0** — deprecated, not removed. A codebase can be on Boot 4.1 and
still be full of `getOne`, compiling with warnings and behaving identically. The
rename happened twice (`getOne` → `getById` in 2.5, `getById` →
`getReferenceById` in 2.7), which is why so much material on the web names
whichever one was current when it was written, and why a codebase of any age
usually contains all three.

Two more deprecations on the same list are worth knowing because they show up
when you subclass the base repository: `SimpleJpaRepository.getCountQuery(
Specification)` is replaced by the two-argument form, and `readPage(TypedQuery,
Pageable, Specification)` by the four-argument one. And
`@org.springframework.data.jpa.repository.Temporal` is deprecated since 4.0 in
favour of `java.time` types.

## There is no reactive JPA repository

The reference lists `ReactiveCrudRepository`, `RxJava3CrudRepository`,
`CoroutineCrudRepository` and `ReactiveSortingRepository` alongside the blocking
interfaces. They belong to reactive Spring Data modules. **JPA has no reactive
variant**, because JDBC is a blocking API and the persistence context is bound to
a thread. There is no `ReactiveJpaRepository` to look for, and wrapping a
blocking repository call in a `Mono` on a scheduler buys nothing but a thread
hop.

On a JDK 25 baseline the productive answer to JPA concurrency is virtual threads
— the blocking call is fine when the thread carrying it is cheap. That is topic
04's ground:
[18b · reactive and virtual threads](../04-spring-transactional/18b-reactive-and-virtual-threads.md).

## Gotchas

**⚠️ Using `saveAndFlush` because "I want to be sure it saved".**
`save` already schedules the write; the flush only changes *when* the statement
is sent, not whether. And flush is not scoped to the entity you passed — every
dirty entity in the persistence context goes with it, which reorders statements
and can surface an unrelated constraint violation at your line.

**⚠️ Calling `deleteAllInBatch` on an entity with `cascade = REMOVE`.**
The cascade does not run. The javadoc says so: "It will also NOT honor cascade
semantics of JPA". The child rows stay, and whether you find out depends entirely
on whether a foreign key constraint exists to tell you.

**⚠️ Calling a batch delete and then reading the entity back in the same
transaction.**
It is still in the persistence context and is returned from there without a
query. The javadoc's phrase is "leaves JPAs first level cache and the database
out of sync", and its own advice — "Consider flushing the `EntityManager` before
calling this method" — addresses only half of it: flushing *before* orders the
statements correctly, but does not evict the now-deleted instances afterwards.

**⚠️ Expecting `@PreRemove` or auditing to fire on a batch delete.**
They do not. Anything that records who deleted what, or cleans up an external
resource on removal, is silently skipped. This is the failure that gets noticed
in an audit rather than in a test.

**⚠️ Assuming `getOne` was removed and that the compiler will find the call
sites.**
It is deprecated on 4.1.0 and still present, so an upgrade does not force the
rename and the build stays green. Grep for `getOne(` and `getById(` during an
upgrade; the compiler will only warn.

**⚠️ Assuming `getReferenceById` throws when the row is missing.**
It very likely does not — not there and then. The exception surfaces at first
access to a field, at a line that does not mention the lookup. If you need "does
this exist", the method is `existsById`, and if you need the entity, it is
`findById`.

**⚠️ Reaching for `getReferenceById` and then reading a field off the result.**
Every field access initialises the proxy, so you have paid for a lazy reference
and then bought the SELECT anyway — plus a possible
`LazyInitializationException` if the persistence context has closed by then. The
method is for assigning associations, not for fetching cheaply.

**⚠️ Treating `deleteAllInBatch()` — the no-argument one — as a testing
convenience.**
It deletes every row of the table in one statement, with no cascades and no
callbacks. In a test that shares a database with anything, or in code that
reaches production by accident, it is the most destructive method on the
interface and it is published to every caller by default.

**⚠️ Overriding `SimpleJpaRepository.getCountQuery(Specification)` on 4.1.**
That single-argument form is deprecated in favour of `getCountQuery(
Specification, Class)`. A subclass that overrides the old one still compiles and
may simply stop being called, which is the worst kind of deprecation to ignore.

**⚠️ Searching for a reactive JPA repository.**
There is not one and there will not be one; the blocking-ness is in JDBC and in
the thread-bound persistence context, not in Spring Data. Code that wants
`Mono<Order>` from JPA either wraps a blocking call in a scheduler, which buys
nothing, or should be using R2DBC with Spring Data Relational — a different
module with a different programming model.

## Interview questions

**★ What does `JpaRepository` add that `CrudRepository` does not have?**
Seven methods, all of which exist because JPA has a persistence context:
`flush()`, `saveAndFlush`, `saveAllAndFlush`, the three `deleteAll…InBatch`
forms, and `getReferenceById`. `CrudRepository` and `PagingAndSortingRepository`
are store-neutral and mention nothing JPA-specific; these are the leak, and that
is exactly why they live on a JPA-named interface.

**★ What is the difference between `deleteAll()` and `deleteAllInBatch()`?**
`deleteAll()` loads the entities and deletes them one at a time, honouring
cascades and lifecycle callbacks. `deleteAllInBatch()` issues a single statement
and the javadoc warns that it "leaves JPAs first level cache and the database out
of sync… will also NOT honor cascade semantics of JPA, nor will it emit JPA
lifecycle events." One is N statements with full semantics, the other is one
statement with none, and the right choice depends on the mapping.

**★ When would you use `saveAndFlush`?**
Rarely, and only when something has to observe the write before commit — a
native query in the same transaction that bypasses the persistence context, or a
deliberate attempt to surface a constraint violation at a line you control. It is
not a stronger `save`: the write was going to happen anyway, and the flush pushes
every other pending change out with it.

**★ What does `getReferenceById` return, and when does it fail?**
A reference, not a loaded entity — no SELECT is issued at the call. The javadoc
says the provider "is very likely to always return an instance and throw an
`EntityNotFoundException` on first access", with some providers rejecting invalid
identifiers immediately. So a bad id fails at whatever line first touches a field
on the proxy, which may be far from the lookup.

**★ What is it actually good for?**
Assigning an association when you have the identifier and do not need the row —
`order.setCustomer(customerRepository.getReferenceById(id))`. The foreign key
value is already in hand, so reading the customer row would be wasted work. If
the next line reads a field off the reference, you have bought the SELECT anyway
and should have used `findById`.

**★ Is `getOne` removed on Spring Data JPA 4.1?**
No — deprecated. The 4.1.0 deprecated list carries `getOne(ID)` and `getById(ID)`
with "Use `getReferenceById(ID)` instead", plus `deleteInBatch(Iterable)`
replaced by `deleteAllInBatch(Iterable)`. Old code keeps compiling, which is
convenient and also why the rename never quite finishes in a large codebase —
and why you will see all three spellings in material written at different times.

**★ Is there a reactive `JpaRepository`?**
No. The reactive interfaces belong to reactive Spring Data modules. JPA sits on
JDBC, which is blocking, and its persistence context is thread-bound, so there is
nothing to make reactive. On a JDK 25 baseline the productive answer to JPA
concurrency is virtual threads rather than a reactive wrapper — the blocking call
is fine when the thread carrying it is cheap.

**★ Would you publish these seven methods to your whole application?**
Not by default. `deleteAllInBatch()` deletes a table with no cascades and no
callbacks; `flush()` is a persistence-context detail that no caller of a
repository should be reasoning about; `getReferenceById` returns something that
fails later rather than now. If the application needs any of them, it needs them
in one or two places, which argues for extending bare `Repository` and copying in
what you actually want.

{/* FOOTER */}
