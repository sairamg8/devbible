---
title: "The return type is part of the query, not decoration on it — it decides whether a missing row is null, empty or an exception, and whether a second COUNT statement is issued"
sidebar_label: "1e · Return types"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Repository query
> return types"
> ([query-return-types-reference.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-return-types-reference.html))
> and "Defining Query Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Jakarta Persistence 3.2.

**Every query method has two halves: the name or annotation that decides the
`where` clause, and the return type that decides what happens to the result. The
second half is the one people write on autopilot, and it carries real behaviour —
a bare `T` returns `null` for a missing row while `Optional<T>` returns
`Optional.empty()`, both throw when a second row turns up, `Page` issues an extra
COUNT statement that `Slice` does not, and `Stream` needs a transaction held open
around the loop that consumes it.**

## The types that matter for JPA

The reference's table is long because it covers every store. These are the rows
that apply to a JPA repository:

| Return type | What the reference says |
|---|---|
| `void` | *"Denotes no return value."* |
| primitives, wrappers | for counts and `exists`-style queries |
| `T` | *"A unique entity. Expects the query method to return one result at most. If no result is found, `null` is returned. More than one result triggers an `IncorrectResultSizeDataAccessException`."* |
| `Optional<T>` | *"…If no result is found, `Optional.empty()`… More than one result triggers an `IncorrectResultSizeDataAccessException`."* |
| `List<T>`, `Collection<T>`, `Iterator<T>` | plain collections |
| `Stream<T>` | needs a surrounding transaction and must be closed |
| `Streamable<T>` | *"A convenience extension of `Iterable` that directly exposes methods to stream, map and filter results, concatenate them etc."* |
| `Slice<T>` | *"A sized chunk of data with an indication of whether there is more data available. Requires a `Pageable` method parameter."* |
| `Page<T>` | *"A `Slice` with additional information, such as the total number of results. Requires a `Pageable` method parameter."* |
| `Window<T>` | *"…obtained from a scroll query. Provides `ScrollPosition`… Requires a `ScrollPosition` method parameter."* |
| `Future<T>`, `CompletableFuture<T>` | *"Expects a method to be annotated with `@Async`…"* |

The reactive rows — `Mono`, `Flux`, `Single`, `Maybe`, `Flowable` — are in the
same table but belong to reactive modules. JPA has none, so they are not options
here.

## `T` versus `Optional<T>`

```java
Order findByReference(String reference);            // null when absent
Optional<Order> findByReference(String reference);  // Optional.empty() when absent
```

The difference is not stylistic. The first signature hands a `null` to a caller
that the compiler will not force to check, and the second makes the absence part
of the type. Both are legal, both are documented, and only one of them survives
contact with a codebase.

🔴 **Both throw on a second row**, and this is the part people miss. The
exception is `IncorrectResultSizeDataAccessException` — a Spring `DataAccessException`,
not a JPA one. Choosing `Optional<T>` does not make the method safe; it makes the
*empty* case safe. The *two rows* case is still a runtime failure, and the only
real defence against it is a unique constraint on the column.

⚠️ **A method whose name has no `Top`/`First` and whose return type is singular is
a uniqueness assertion.** If the data can have two matches, the signature is
wrong, not the data. Either the column is unique — say so in the schema — or the
method should return `List<T>`.

## The collection types never return `null`

`List<T>`, `Collection<T>` and `Set<T>` return an empty collection when nothing
matches. There is no case in which a Spring Data query method returns a `null`
list, so a null check on the result of `findByStatus` is dead code that suggests
to the next reader that it can happen.

`Streamable<T>` is the interesting one. It extends `Iterable` and adds `map`,
`filter`, `stream` and concatenation, so a repository can return something a
service can compose without an intermediate copy:

```java
Streamable<Order> findByStatus(OrderStatus status);

// in the service
var total = repository.findByStatus(PLACED)
        .map(Order::total)
        .stream()
        .reduce(Money.ZERO, Money::add);
```

It is fully materialised — it is `Iterable`, not a cursor — so it is a
convenience over `List`, not a memory strategy.

## `Stream<T>` is a cursor, with the obligations of one

```java
@Transactional(readOnly = true)
public void reprice() {
    try (Stream<Order> orders = repository.streamByStatus(PLACED)) {
        orders.forEach(this::reprice);
    }
}
```

Two requirements, both documented and both easy to miss:

1. **A surrounding transaction.** The reference: *"A `Stream` implies operating
   on a stateful resource that is associated with closeable resources (such as a
   JDBC `ResultSet` or `Statement`). Returning a `Stream<T>` therefore requires a
   surrounding transaction to ensure proper contextual availability of resources
   (the same applies when returning a JDBC `ResultSet`)."*
2. **Closing it.** *"Make sure to close the `Stream` after usage"* — by calling
   `close()` or with try-with-resources. A leaked `Stream` is a leaked JDBC
   statement, and eventually a leaked connection.

🔴 **The transaction has to be around the *consumption*, not around the call.**
A repository method returning a `Stream` from a `@Transactional` method that then
returns the stream to an untransacted caller gives you a cursor over a closed
resource. That is why the pattern above puts both the call and the `forEach`
inside one method.

⚠️ **And a `Stream` does not solve the memory problem on its own.** Every entity
the stream yields stays in the persistence context, so a stream over a million
rows accumulates a million managed instances unless you periodically clear —
which is the same argument
[topic 06 · the persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md)
makes about any long-running unit of work. The reference's own note under query
hints points the same way: with a `Stream`, *"review provider-specific fetch
behavior and JDBC driver fetch-size settings"*.

## The types that require a parameter

Three return types are only legal alongside a matching parameter:

| Return type | Required parameter |
|---|---|
| `Slice<T>` | `Pageable` |
| `Page<T>` | `Pageable` |
| `Window<T>` | `ScrollPosition` |

Getting this wrong is a bootstrap failure, which is the right time for it.

The `Page`/`Slice` choice is the one with a cost attached: `Page` is *"a `Slice`
with additional information, such as the total number of results"*, and that
total is a second SQL statement on every call. The argument is in
[5 · pageable and sort](05-pageable-and-sort.md).

## `Future` and `CompletableFuture`

Both are documented as requiring `@Async` on the method and Spring's asynchronous
execution enabled. That means the query runs on another thread, which means it
runs in a different transaction — or in none.

On a JDK 25 baseline this is a pattern to think twice about. Its original purpose
was to avoid blocking a platform thread; with virtual threads, blocking is cheap
and the transaction complexity is not. See
[topic 04 · threads and async](../04-spring-transactional/18-threads-and-async.md).

## Gotchas

**⚠️ Declaring `Optional<T>` and believing the method is now safe.**
It is safe against absence, not against duplicates. Two matching rows give
`IncorrectResultSizeDataAccessException` from an `Optional`-returning method just
as from a `T`-returning one. The type system cannot express "at most one row";
only a unique constraint can.

**⚠️ Declaring a bare `T` return and null-checking the caller.**
It works and it is documented — `null` when nothing is found — and it is the one
signature that reintroduces the problem `Optional` exists to remove. Worse, it is
what you get by *copying a CRUD signature slightly wrong*: `Order findById(Long)`
instead of `Optional<Order> findById(Long)` compiles as a derived query method
with different semantics.

**⚠️ Null-checking a `List` return.**
Query methods returning collections return an empty collection, never `null`. The
check is dead code, and dead defensive code is worse than none: it tells the next
reader that `null` is a state this method can be in.

**⚠️ Returning a `Stream` across a transaction boundary.**
The stream is a cursor over a `ResultSet`. If the `@Transactional` method returns
it, the resources close as that method returns, and the consumer gets a failure
some distance from the cause. Consume inside the transaction, or do not use a
`Stream`.

**⚠️ Forgetting to close a `Stream`.**
The reference is explicit that you must. Without try-with-resources the statement
and result set stay open until something else reclaims them, and the symptom is
pool exhaustion under load rather than an error at the call site — see
[topic 02 · connection pooling](../02-connection-pooling/README.md).

**⚠️ Using a `Stream` to "avoid loading everything into memory" and loading
everything into the persistence context instead.**
Each entity the stream yields is managed. The `ResultSet` streams; the first-level
cache does not. A batch job over a large table needs periodic clearing, or a
projection, or `JdbcClient` — not just a different return type.

**⚠️ Expecting `Streamable` to be lazy.**
It is an `Iterable` convenience, not a cursor. It is fully materialised before you
get it, and `map`/`filter` on it operate in memory. Choosing it over `List`
buys composition ergonomics and nothing else.

**⚠️ Declaring `Page<T>` without a `Pageable` parameter.**
A bootstrap failure, which is fine. The subtler version is declaring `Page<T>`
*with* a `Pageable` when nobody needed the total — you have bought a COUNT query
per call for a number the UI never renders.

**⚠️ Reaching for `CompletableFuture` on JDK 25.**
`@Async` moves the query to another thread and out of the caller's transaction.
That was a reasonable trade when a blocked platform thread was expensive; on
virtual threads it usually is not, and the transaction semantics it costs are
real.

**⚠️ Looking for `Mono` or `Flux` on a JPA repository.**
They are in the return-type table because the table is store-neutral. JPA has no
reactive module, so those rows do not apply, and a method declaring them will not
resolve.

## Interview questions

**★ What is the difference between a query method returning `Order` and one
returning `Optional<Order>`?**
Absence handling. A bare `T` returns `null` when nothing is found; `Optional<T>`
returns `Optional.empty()`. Both are documented and both throw
`IncorrectResultSizeDataAccessException` when more than one row matches. So
`Optional` fixes the absence case and does nothing about the duplicate case.

**★ What happens if a singular query method matches two rows?**
`IncorrectResultSizeDataAccessException` — a Spring `DataAccessException`, thrown
by the query execution regardless of whether the return type is `T` or
`Optional<T>`. The signature is an assertion of uniqueness, and the only thing
that can actually enforce it is a unique constraint in the schema.

**★ Can a query method returning `List<T>` return `null`?**
No. Collection returns are empty collections when nothing matches. A null check
on one is dead code, and it misleads the next reader into thinking `null` is
reachable.

**★ What does returning a `Stream<T>` require?**
A surrounding transaction and an explicit close. The reference says a `Stream`
"implies operating on a stateful resource that is associated with closeable
resources", so it "requires a surrounding transaction to ensure proper contextual
availability of resources", and "make sure to close the `Stream` after usage" —
`close()` or try-with-resources. The transaction has to enclose the consumption,
not just the repository call.

**★ Does a `Stream` solve the memory problem for a large table?**
Only half of it. The `ResultSet` is consumed incrementally, but every entity the
stream yields becomes managed and stays in the persistence context, so a stream
over a million rows still accumulates a million instances. A batch job needs
periodic clearing, a projection, or SQL-first access — the return type alone does
not do it.

**★ How is `Streamable<T>` different from `Stream<T>`?**
`Streamable` is an `Iterable` convenience that adds `map`, `filter`, `stream` and
concatenation. It is fully materialised, needs no transaction and needs no
closing. `Stream` is a cursor with both obligations. They read similarly and have
almost nothing in common operationally.

**★ Which return types require a matching parameter?**
`Page<T>` and `Slice<T>` require a `Pageable`; `Window<T>` requires a
`ScrollPosition`. Missing it is a bootstrap failure. The interesting choice is
`Page` versus `Slice`: `Page` is "a `Slice` with additional information, such as
the total number of results", and that total is a second SQL statement on every
call.

**★ Would you use `CompletableFuture` from a repository?**
Not on this baseline. It requires `@Async`, which runs the query on another
thread and therefore outside the caller's transaction. The reason to do that was
to stop blocking an expensive platform thread; with virtual threads on JDK 25 the
block is cheap and the transaction complexity is not worth trading for it.

**★ Why are `Mono` and `Flux` in the return-type table if JPA cannot use them?**
Because the table is Spring Data's, not JPA's — it documents every return type
any module supports. JPA sits on blocking JDBC with a thread-bound persistence
context and has no reactive variant, so those rows never apply to a
`JpaRepository`.

{/* FOOTER */}
