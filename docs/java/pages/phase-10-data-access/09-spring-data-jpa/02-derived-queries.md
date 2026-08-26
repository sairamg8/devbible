---
title: "A derived query is a method name that Spring Data compiles into JPQL at startup — it splits the name at the first By, reads a subject that decides what kind of statement to build, and resolves the rest against your entity's properties"
sidebar_label: "02 · Derived queries"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query
> Methods"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)),
> "Repository query keywords"
> ([query-keywords-reference.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-keywords-reference.html))
> and "JPA Query Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**`findByStatusAndPlacedAtAfter` is not a name. It is source code in a second
language, parsed by Spring Data at bootstrap into a JPQL statement, and the
parser has a grammar with a subject, a predicate, keywords, and a property
resolver that walks your entity model. Everything good about derived queries and
everything bad about them follows from that one fact: the method name is
compiled, so a typo is a startup failure rather than a wrong answer — and a
requirement that outgrows the grammar produces a name nobody can read long
before it produces a query that does not work.**

## The name is split at the first `By`

Every derived query method has exactly two parts, and the boundary is the first
occurrence of `By`:

```java
List<Order> findByStatusAndPlacedAtAfter(OrderStatus status, Instant cutoff);
//           ^^^^^^^^ subject   ^^^^^^^^^^^^^^^^^^^^^^^^^^ predicate
```

- The **subject** — everything before `By` — decides what kind of statement is
  built: a select, a count, an exists check, a delete. It can also carry a result
  limit and a `Distinct` flag.
- The **predicate** — everything after `By` — becomes the `where` clause. It is
  parsed into property references joined by keywords.

The reference calls the first part the *query method subject* and the second the
*query method predicate*, and it keeps two separate keyword tables for them. That
separation is worth holding onto, because the two halves fail in different ways:
a bad subject usually gives you a method that does something other than what you
meant, and a bad predicate usually gives you a bootstrap failure.

## The subject keywords, in full

| Keyword | What the reference says it does |
|---|---|
| `find…By`, `read…By`, `get…By`, `query…By`, `search…By`, `stream…By` | *"General query method returning typically the repository type, a `Collection` or `Streamable` subtype or a result wrapper such as `Page`… Can be used as `findBy…`, `findMyDomainTypeBy…` or in combination with additional keywords."* |
| `exists…By` | *"Exists projection, returning typically a `boolean` result."* |
| `count…By` | *"Count projection returning a numeric result."* |
| `delete…By`, `remove…By` | *"Delete query method returning either no result (`void`) or the delete count."* |
| `…First<n>…`, `…Top<n>…` | *"Limit the query results to the first `<number>` of results. This keyword can occur in any place of the subject between `find` (and the other keywords) and `by`."* |
| `…Distinct…` | *"Use a distinct query to return only unique results. Consult the store-specific documentation whether that feature is supported."* |

Two things fall out of that table immediately.

**The six select verbs are synonyms.** `findByEmail`, `getByEmail`,
`readByEmail`, `queryByEmail`, `searchByEmail` and `streamByEmail` all produce
the same JPQL. Only the return type distinguishes them, and `stream…By` is not
special — it is a synonym like the rest; what makes a method return a cursor is
declaring `Stream<T>`, which is
[1e · return types](01e-return-types.md). Pick one verb and use it everywhere;
a codebase where three of the six appear reads as though the difference is
meaningful.

**`delete…By` and `remove…By` are queries too.** They look like commands, but
they go through the same parser, and — this is the part that surprises people —
a derived delete does not issue a bulk `delete` statement. The reference is
explicit that a derived `deleteByRoleId(…)` *"runs a query and then deletes the
returned instances one by one, so that the persistence provider can actually
invoke `@PreRemove` callbacks on those entities"*. The bulk form is a
`@Modifying` `@Query`, and the two are not interchangeable. That argument is
[04 · modifying queries](04-modifying-queries.md).

## The tokens between the verb and `By` are yours

`findAllOrdersPlacedByCustomer` does not mean "placed by customer". The parser
strips the leading verb, then discards descriptive tokens until it reaches `By`,
so the subject `findAllOrdersPlaced` is read as `find` plus noise. That is a
deliberate feature — the reference calls out `findMyDomainTypeBy…` as a
supported spelling — and it exists so a method can read as English:

```java
List<Order> findOpenOrdersByCustomerId(Long customerId);   // "OpenOrders" is noise
List<Order> findByCustomerId(Long customerId);             // identical query
```

⚠️ **This is one of the two places the grammar will quietly accept a lie.** The
first signature promises open orders and filters on nothing but the customer.
Nothing warns you, because from the parser's point of view the words are
decoration. If a constraint is in the name, it has to be after the `By`.

⚠️ **And those discarded words are not always inert.** A descriptive token is
what breaks the reserved-method match on `findById`, so `findUserById` and
`findById` can resolve to two different properties on the same entity. That rule
is [02d · property paths and ambiguity](02d-property-paths-and-ambiguity.md).

## When the parsing happens

At bootstrap, not at call time. Spring Data resolves every query method on every
repository while the context is starting — that is the same startup pass that
[1 · what a repository is](01-what-a-repository-is.md) describes, and it is why a
`Page` return with no `Pageable` parameter, or a predicate token that resolves to
no property, stops the application instead of failing on the first request.

A property that cannot be resolved surfaces as a `PropertyReferenceException`
naming the token it could not match and, helpfully, listing the properties it did
find on the type. Read that list before assuming the parser is wrong: nine times
out of ten it is a rename that did not reach the method name.

⚠️ **Which is exactly the maintenance cost of derived queries.** Renaming
`Order.placedAt` to `Order.createdAt` is a safe refactor everywhere in Java and a
breaking change to every method name that mentioned it. The IDE will not rename
`findByPlacedAtAfter` for you, and nothing else will tell you until the context
starts. A repository with thirty derived methods is thirty string references to
your field names that no compiler checks.

## What a derived query is genuinely good at

It is worth being fair to the mechanism before the next page takes it apart.
For a predicate of one or two properties, a derived query is the shortest correct
thing you can write:

```java
Optional<Order> findByReference(String reference);
List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);
boolean existsByReference(String reference);
long countByStatus(OrderStatus status);
```

Four lines, no JPQL to keep in sync with the model, no parameter binding to get
wrong, and every one of them validated at startup. Nothing else in the JPA stack
gives you that. The failure mode is not that derived queries are bad — it is that
they scale badly, and the point at which they stop is discussed in
[02f · where derived queries stop](02f-where-derived-queries-stop.md).

## Gotchas

**⚠️ Putting a constraint in the descriptive part of the subject.**
`findActiveUsersByLastname` filters by lastname and nothing else. The word
`Active` is discarded. This is the single most common way a derived query returns
the wrong rows without anyone noticing, because the name reads as though the
filter is there.

**⚠️ Assuming `deleteByX` issues one `delete` statement.**
It does not. The reference says the derived form runs a select and then deletes
the instances one by one so `@PreRemove` callbacks fire. On a predicate matching
ten thousand rows that is ten thousand deletes plus the select. The bulk form is
`@Modifying` with an explicit `delete` query — and it skips the callbacks, which
is the trade.

**⚠️ Mixing the select verbs across a codebase.**
`find`, `get`, `read`, `query`, `search` and `stream` are synonyms to the parser.
When all of them appear, readers start looking for a distinction that does not
exist — usually guessing that `get` throws and `find` returns `Optional`, which
is a convention from other APIs and means nothing here.

**⚠️ Expecting `exists…By` and `count…By` to be cheap because they return small
values.**
The subject changes the projection, not the plan. `countByStatus` on an
unindexed status column is a full scan that returns one number. The size of the
result and the cost of producing it are unrelated, which is the same lesson
[topic 01 · JDBC](../01-jdbc/README.md) teaches about `SELECT count(*)`.

**⚠️ Treating a renamed field as a safe refactor.**
Method names are untyped references to property names. Renaming the property
compiles fine and fails at context startup. If the rename happens in a module
whose tests do not start a context, it fails in whatever environment does — which
may be production if a repository is only loaded on a rarely-exercised path.

**⚠️ Reaching for `Distinct` to fix duplicate rows from a join.**
The reference warns directly: *"DISTINCT can be tricky and not always producing
the results you expect. For example, `select distinct u from User u` will produce
a complete different result than `select distinct u.lastname from User u`."* When
duplicates come from a collection join, `Distinct` de-duplicates in the wrong
place and hides a fan-out; that argument belongs to
[topic 08 · duplicate parents and distinct](../08-the-n-plus-1-problem/08c-duplicate-parents-and-distinct.md).

**⚠️ Believing a derived query is validated against the database.**
It is validated against the *entity model*. Bootstrap will happily accept
`findByStatus` when the `status` column does not exist in the schema — the model
says it does. Schema drift is caught by
[topic 06 · ddl-auto](../06-jpa-hibernate-model/17-ddl-auto.md)-style validation
or by a migration tool, not by the query parser.

**⚠️ Adding a derived method to a shared `@NoRepositoryBean` base interface.**
The base interface is parsed for every entity that extends it, so a property that
exists on three of your five aggregates makes the other two fail to start. Base
interfaces should hold generic signatures, not derived predicates —
[1d · shaping the interface](01d-shaping-the-interface.md).

**⚠️ Assuming the parser is deterministic across a property rename that
introduces an ambiguity.**
It is deterministic, but the rule is not the one you would guess: a direct match
on a property wins over any nested path. Adding a scalar field can therefore
change which column an existing method queries. That is
[02d · property paths and ambiguity](02d-property-paths-and-ambiguity.md).

## Interview questions

**★ What actually happens to the string `findByStatusAndPlacedAtAfter`?**
Spring Data splits it at the first `By`. `find` is the subject, which selects a
select statement; `StatusAndPlacedAtAfter` is the predicate, which is tokenised
into property references (`status`, `placedAt`) joined by keywords (`And`,
`After`) and turned into a JPQL `where` clause. All of that happens at bootstrap,
so the method is either a valid query before the first request or the context
does not start.

**★ Is there any difference between `findByEmail` and `getByEmail`?**
No. The reference lists `find…By`, `read…By`, `get…By`, `query…By`, `search…By`
and `stream…By` as general query-method subjects — they are synonyms. Any
difference in behaviour between two such methods comes from their return types,
not their verbs.

**★ What does `findActiveUsersByLastname` filter on?**
Lastname only. Everything between the verb and the `By` is descriptive and
discarded, which is what makes `findMyDomainTypeBy…` a supported spelling. The
word `Active` contributes nothing to the query, so the method's name is a false
promise.

**★ How is a derived `deleteByStatus` different from a `@Modifying` bulk
delete?**
The derived form selects the matching entities and deletes them one by one so
the provider can fire `@PreRemove`; the bulk form issues one JPQL `delete`
statement and fires no lifecycle callbacks. The reference states this explicitly.
So the derived form is correct-by-default and slow, and the bulk form is fast and
skips a mechanism you may be relying on.

**★ When does a bad derived query method fail?**
At context startup. Query methods are resolved during the repository bootstrap
pass, so an unresolvable property token throws — a `PropertyReferenceException`
naming the token and listing the properties it could see. That is the strongest
argument for derived queries: the failure is early, loud, and in the same place
for everybody.

**★ What is the maintenance cost of that, though?**
Method names are unchecked string references to property names. Renaming a field
is a safe refactor in Java and a breaking change to every method name mentioning
it, and no IDE rename will follow it. Thirty derived methods are thirty places a
rename can break, all of which surface only when a context starts.

**★ Does a derived query validate anything about the database?**
No — only about the entity model. If the mapping claims a column that the schema
does not have, the query method still resolves. Catching that needs schema
validation or a migration tool, not the query parser.

**★ Why is `countBy…` not automatically cheap?**
Because the subject changes the projection, not the access path. A count over an
unindexed predicate still reads every candidate row; it just returns one number
at the end. Result size and query cost are independent.

**★ When is a derived query the right tool?**
When the predicate is one or two properties, the return type is obvious, and the
name still reads as a sentence. At that size it is shorter than JPQL, needs no
parameter binding, and is validated at startup. It stops being the right tool
when the name stops being readable — which usually happens before it stops being
expressible.

{/* FOOTER */}
