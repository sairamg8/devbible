---
title: "The fetch method you choose is a statement about how many rows you expect, and picking the wrong one is how a query that should have failed loudly returns null instead"
sidebar_label: "03e · Fetching"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 `ResultQuery` javadoc
> ([org.jooq.ResultQuery](https://www.jooq.org/javadoc/latest/org.jooq/org/jooq/ResultQuery.html))
> and the manual — *Fetching*
> ([sql-execution/fetching](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/))
> and *Lazy fetching*
> ([fetching/lazy-fetching](https://www.jooq.org/doc/latest/manual/sql-execution/fetching/lazy-fetching/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, PostgreSQL 18.

**Everything up to this point built a tree. `fetch()` and its relatives are where a connection is
taken, SQL is rendered and rows come back — and jOOQ offers a dozen of them because "how many rows
do you expect" is a real design question that JDBC forces you to answer with an `if` and a
comment. Choosing deliberately here removes a whole category of defensive code, and choosing
carelessly is how "at most one" quietly becomes "the first one".**

## The single-row family, and the differences are not cosmetic

Four methods, four different answers to the same two questions — what if there are no rows, and
what if there are several:

| Method | No rows | Several rows |
|---|---|---|
| `fetchOne()` | returns `null` | throws `TooManyRowsException` |
| `fetchSingle()` | throws `NoDataFoundException` | throws `TooManyRowsException` |
| `fetchOptional()` | empty `Optional` | throws `TooManyRowsException` |
| `fetchAny()` | returns `null` | returns one, no exception |

🔴 **`fetchOne()` and `fetchAny()` look interchangeable and are opposites.** `fetchOne()` asserts
that at most one row exists and throws if that assertion is wrong. `fetchAny()` asserts nothing
and hands you an arbitrary row. Reaching for `fetchAny()` because `fetchOne()` "kept throwing" is
how a broken uniqueness assumption gets buried — the exception was the finding.

**The choice, stated as a rule:**

- **Looking up by primary key or a unique constraint, and absence is normal** →
  `fetchOptional()`. The signature tells the caller absence is expected, which `null` never does.
- **Looking up by a key that must exist** → `fetchSingle()`. It throws on zero rows, which is
  what you want when zero rows is a bug.
- **Legacy code that already handles `null`** → `fetchOne()`.
- **`fetchAny()`** → only when you genuinely do not care which row, which is much rarer than its
  use suggests.

## The whole-result family

```java
Result<Record3<Long, String, BigDecimal>> rows =
    create.select(ORDER.ID, ORDER.STATUS, ORDER.TOTAL).from(ORDER).fetch();
```

`fetch()` executes the query and **eagerly loads the entire result into memory**. That is the
right default for a bounded result and exactly wrong for an unbounded one — a `fetch()` over a
table with ten million rows is an out-of-memory error with a stack trace that blames jOOQ for
something the query asked for.

`fetchMany()` handles the case of a statement returning **several result sets** — a stored
procedure, or a batch of statements — returning a `Results` object holding each one.

## The lazy family, and the caveat that decides whether it works

`fetchLazy()` returns a `Cursor<R>`, consumed imperatively:

```java
try (Cursor<OrderRecord> cursor = create.selectFrom(ORDER).fetchLazy()) {
    while (cursor.hasNext()) {
        OrderRecord order = cursor.fetchOne();
        // ...
    }
}
```

The manual is explicit about the resource: *"As a `org.jooq.Cursor` holds an internal reference to
an open `java.sql.ResultSet`, it may need to be closed at the end of iteration."* It will close
the `ResultSet` if you scroll all the way through — **and relying on that is discouraged**. The
try-with-resources block is the documented shape.

`stream()` is the same laziness with a functional interface, and it needs the same treatment:
a `Stream` over a database result is a closeable resource, and letting it escape the
try-with-resources is a leak that looks like idiomatic Java.

🔴 **The caveat that makes or breaks all of this:** the manual warns that *"your underlying JDBC
driver may still"* load everything eagerly regardless of your `Cursor`. The lever is
`ResultQuery.fetchSize(int)`, which controls how many records the driver pulls at a time.

⚠️ **On PostgreSQL that lever has conditions attached**, and they are the driver's, not jOOQ's —
autocommit and the transaction state both matter. **[Topic 01 · JDBC](../01-jdbc/README.md)**
covers what pgJDBC actually requires before a fetch size does anything. Setting `fetchSize` and
assuming you are streaming is one of the most common false beliefs in Java database code, and it
is invisible until the heap fills.

## Shaping the result as it comes back

Two methods worth knowing before writing a loop that does the same thing worse:

```java
Map<Long, OrderRecord> byId =
    create.selectFrom(ORDER).fetchMap(ORDER.ID);

Map<Long, List<OrderRecord>> byCustomer =
    create.selectFrom(ORDER).fetchGroups(ORDER.CUSTOMER_ID);
```

`fetchMap` keys the result by a column; `fetchGroups` groups it. **`fetchGroups` is the reason a
lot of parent-child work needs no second query at all**: fetch the join, group by the parent key
in one pass, and assemble. It is the manual, in-memory version of what
**[04b · Nested collections with MULTISET](04b-nested-collections-with-multiset.md)** does in SQL,
and it is a perfectly respectable answer when the fan-out is small.

`fetchInto(Class)` maps rows onto your own type and returns a `List` of them — that is
**[04 · Mapping results](04-mapping-results.md)**, and every fetch method above has an `into`
variant.

## Gotchas

**★ `fetchOne()` returns `null` on no rows and throws on two.** Half of the codebases that use it
handle the `null` and never consider the exception, and the other half assume it throws on absence
and never check the `null`. Read the table above before choosing.

**★ `fetchAny()` silences a broken uniqueness assumption.** If `fetchOne()` throws
`TooManyRowsException`, your data or your predicate is wrong. Swapping in `fetchAny()` makes the
symptom go away and keeps the bug, and the row you get is not defined.

**★ `TooManyRowsException` means the query already fetched more than one row.** It is not a
protection against a large result — the work happened. For a genuinely unbounded query, `limit`
is the tool, not the exception.

**★ `fetch()` is eager, always.** No amount of iterating lazily over the returned `Result` makes
the fetch lazy; the rows are already in memory by the time you have the object. Streaming needs
`fetchLazy()` or `stream()`, plus a working fetch size.

**★ A `Stream` from `stream()` is a resource and looks like it is not.** Returning it from a
repository method hands the caller an open `ResultSet` and a checked-out connection, and the
caller has no idea. Consume it inside the method, or return a `List`.

**★ Relying on the cursor auto-closing when fully scrolled is discouraged by the manual itself.**
The moment someone adds a `break` or an early `return` to the loop, the `ResultSet` — and the
connection under it — leaks.

**★ Setting `fetchSize` does not guarantee streaming.** The manual says the driver *"may still"*
be eager; on PostgreSQL there are additional conditions. A memory profile is the only thing that
settles it, and assuming it works is the usual reason a "streaming" export still exhausts the
heap.

**★ `fetchMap` throws when the key column is not unique.** It is a map, so duplicate keys are an
error rather than a silent overwrite — which is correct, and surprising to anyone expecting
`Collectors.toMap`'s more forgiving overloads.

**★ `fetchGroups` on a large result is still an entirely in-memory operation.** It is a good
answer to fan-out and a bad answer to volume; the whole join result exists before grouping starts.

**★ Fetching inside a loop is the N+1 that jOOQ cannot save you from.** The DSL makes each query
cheap to write, and writing one per iteration produces exactly the pathology
**[Topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md)** describes. Nothing about
jOOQ prevents it; there is simply no lazy proxy quietly doing it *for* you.

**★ `fetchMany()` and `fetchGroups()` sound similar and are unrelated.** `fetchMany()` is about a
statement returning multiple *result sets*; `fetchGroups()` is about grouping one result set.

**★ A fetch outside a transaction takes and returns a connection per statement.** That is fine for
one query and wasteful for twelve — and it is also how a group of reads ends up seeing twelve
different snapshots. **[07 · Transactions and Spring](07-transactions-and-spring.md)** is where
that boundary belongs.

**★ Every fetch method has an `into` variant, so an extra mapping pass is usually unnecessary.**
`fetch()` followed by a manual `stream().map(...)` duplicates what `fetchInto(Class)` already
does, and does it later.

## Interview questions

**★ What is the difference between `fetchOne()`, `fetchSingle()`, `fetchOptional()` and
`fetchAny()`?** On zero rows: `null`, `NoDataFoundException`, empty `Optional`, `null`. On several
rows: the first three all throw `TooManyRowsException`; `fetchAny()` returns an arbitrary row
without complaint.

**★ Which one do you use for a lookup where absence is a normal outcome?** `fetchOptional()`. The
return type states the contract, so no caller has to guess whether `null` means "missing" or
"bug".

**★ Which one do you use when zero rows means something is wrong?** `fetchSingle()` — it throws
`NoDataFoundException`, turning a silent `null` into a stack trace at the point of the broken
assumption.

**★ Why is replacing `fetchOne()` with `fetchAny()` usually the wrong fix?**
`TooManyRowsException` is telling you the uniqueness assumption behind the query is false.
`fetchAny()` hides that and returns an undefined one of the rows, so the bug survives and becomes
non-deterministic.

**★ Does `TooManyRowsException` protect you from a huge result?** No. It is thrown after more than
one row has been fetched, so the work is already done. Bounding the result is what `limit` is for.

**★ How do you consume a large result without loading it all?** `fetchLazy()` for a `Cursor`, or
`stream()`, both inside try-with-resources, plus `fetchSize(...)` so the driver does not fetch
everything anyway.

**★ Why must a `Cursor` be closed?** Because it *"holds an internal reference to an open
`java.sql.ResultSet`"*. It closes that automatically only if you scroll all the way through, and
the manual discourages relying on it — one `break` in the loop and you have leaked a `ResultSet`
and the connection under it.

**★ Does `fetchSize` guarantee streaming?** No. The manual says the driver may still be eager, and
on PostgreSQL there are further conditions on autocommit and transaction state before a fetch size
changes anything. Verify with a memory profile rather than by reading the code.

**★ What is `fetchGroups` good for?** Grouping a joined result by the parent key in one pass, so a
parent-with-children structure needs one query rather than one per parent. It is the in-memory
counterpart to `MULTISET`, and it is the right answer when fan-out is small.

**★ When is `fetchGroups` the wrong tool?** When the joined result is large, because the entire
thing is materialised before grouping. Then the aggregation belongs in SQL.

**★ Why is returning a `Stream` from a repository method risky?** Because the stream holds an open
result set and a checked-out connection, and nothing in the signature says so. The caller decides
the lifetime of a resource they do not know exists.

**★ Can jOOQ produce an N+1 problem?** Yes — by fetching inside a loop. What it cannot do is
produce one *invisibly*, because there is no lazy proxy issuing queries on your behalf. Every
statement corresponds to a fetch you wrote.

**★ What does `fetchMany()` do, and how is it different from `fetchGroups()`?** `fetchMany()`
executes a statement that returns several result sets and gives you all of them.
`fetchGroups()` groups the rows of a single result set by a key column. The names are the only
thing they share.

{/* FOOTER */}
