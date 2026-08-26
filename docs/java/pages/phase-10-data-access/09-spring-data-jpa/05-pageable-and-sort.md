---
title: "Pageable is one parameter that changes the query, the result type and the number of round-trips at once — and the choice between Page, Slice, List and Window is a choice about how much the database has to do per request"
sidebar_label: "05 · Pageable, Page and Slice"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query
> Methods", section "Paging, Iterating Large Results, Sorting & Limiting" and its
> "Consuming Large Query Results" table
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html));
> "JPA Query Methods"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Adding a `Pageable` parameter does three things at once: it applies an offset
and a limit to the query, it makes the sort order part of the request rather than
part of the method, and — depending on what you return — it may add a second
query to every call. The reference recognises `Pageable`, `Sort` and `Limit` as
special parameters and applies them to whatever query the method already
describes, derived or declared. The interesting decision is not how to page; it
is which of the four result shapes you can afford.**

## The parameter and the shapes it can produce

```java
Page<User>   findByLastname(String lastname, Pageable pageable);
Slice<User>  findByLastname(String lastname, Pageable pageable);
Window<User> findTop10ByLastname(String lastname, ScrollPosition position, Sort sort);
List<User>   findByLastname(String lastname, Sort sort);
List<User>   findByLastname(String lastname, Sort sort, Limit limit);
List<User>   findByLastname(String lastname, Pageable pageable);
```

⚠️ **None of these parameters may be `null`.** *"APIs taking `Sort`, `Pageable`
and `Limit` expect non-`null` values to be handed into methods. If you do not want
to apply any sorting or pagination, use `Sort.unsorted()`, `Pageable.unpaged()`
and `Limit.unlimited()`."* Passing `null` to mean "everything" is the single most
common way to meet a `NullPointerException` from inside the framework.

**A `Pageable` is built with `PageRequest`:**

```java
var page = repository.findByLastname("Stark",
        PageRequest.of(0, 20, Sort.by("lastname").ascending()));
```

The page number is zero-based, the sort travels inside the `Pageable`, and the
same object is what an argument resolver builds for you from `?page=0&size=20`
in a web layer.

## `Page` versus `Slice` versus `List`

This is the choice that costs money, and the reference states it plainly:

> "A `Page` knows about the total number of elements and pages available. It does
> so by the infrastructure triggering a count query to calculate the overall
> number. As this might be expensive (depending on the store used), you can
> instead return a `Slice`. A `Slice` knows only about whether a next `Slice` is
> available, which might be sufficient when walking through a larger result set."

and about returning a plain collection:

> "In this case, the additional metadata required to build the actual `Page`
> instance is not created (which, in turn, means that the additional count query
> that would have been necessary is not issued). Rather, it restricts the query to
> look up only the given range of entities."

The mechanics behind each, from the reference's own comparison table:

| Return type | Rows fetched | Queries | The constraint it names |
|---|---|---|---|
| `List<T>` | all results | one | *"Query results can exhaust all memory. Fetching all data can be time-intensive."* |
| `Streamable<T>` | all results | one | the same warning |
| `Stream<T>` | chunked as consumed | one, typically with a cursor | *"Streams must be closed after usage to avoid resource leaks."* |
| `Slice<T>` | `Pageable.getPageSize() + 1` | one | can only navigate to the next `Slice`; offset gets expensive at depth |
| `Page<T>` | `Pageable.getPageSize()` | one, plus a `COUNT` that *"can be required"* | *"Often times, `COUNT(…)` queries are required that are costly."* |
| offset-based `Window<T>` | `limit + 1` | one | forward-only; same offset problem |
| keyset-based `Window<T>` | `limit + 1` via a rewritten `where` | one | needs a proper index; nulls break it; the sort keys must be selected |

🔴 **The `+ 1` is how a `Slice` knows there is a next one.** It asks for one more
row than you wanted and reports `hasNext()` from whether it got it. That is the
entire difference in cost between "is there more" and "how many are there", and
it is a row versus a whole count query.

**So the rule is simple to state and widely ignored: return a `Page` only when
something on screen prints a total.** A "load more" button, an infinite scroll,
an export job walking pages, and a batch consumer all need `hasNext()` and
nothing else. Every one of them written as `Page` pays a count query per request
forever.

⚠️ **Note the wording — the count query *can be* required.** Spring Data can skip
it in cases where the answer is already known, such as a first page shorter than
the page size. Do not read that as "the count is usually free"; read it as "you
cannot predict when you pay for it", which is another argument for `Slice` when
you do not need the number.

## Sorting travels inside the `Pageable`

> "Sorting options are handled through the `Pageable` instance, too. If you need
> only sorting, add an `org.springframework.data.domain.Sort` parameter to your
> method."

`Sort` composes, and there are three ways to build one:

```java
Sort sort = Sort.by("firstname").ascending()
        .and(Sort.by("lastname").descending());

TypedSort<Person> person = Sort.sort(Person.class);
Sort typed = person.by(Person::getFirstname).ascending()
        .and(person.by(Person::getLastname).descending());

QSort qsort = QSort.by(QPerson.firstname.asc())
        .and(QSort.by(QPerson.lastname.desc()));
```

⚠️ **The type-safe form has a deployment cost that is easy to miss:**
*"`TypedSort.by(…)` makes use of runtime proxies by (typically) using CGlib, which
may interfere with native image compilation when using tools such as GraalVM
Native Image."* If you are building a native image, the string form is the safe
one, and the Querydsl form is safe because the metamodel is generated at compile
time.

What sorting actually costs at the database — indexes, expressions and the
`JpaSort.unsafe` escape hatch — is
[05c · sort is not free](05c-sort-is-not-free.md).

## The combinations that are rejected

> "Special parameters may only be used once within a query method. Some special
> parameters described above are mutually exclusive."

| Invalid | Reason given |
|---|---|
| `findBy…(Pageable page, Sort sort)` | *"`Pageable` already defines `Sort`"* |
| `findBy…(Pageable page, Limit limit)` | *"`Pageable` already defines a limit."* |

And one combination that *is* allowed and is easy to misread:

> "The `Top` keyword can be used together with `Pageable`: `Top` defines the total
> maximum number of results, while the `Pageable` parameter may reduce this number
> further."

So `Page<User> queryFirst10ByLastname(String lastname, Pageable pageable)` means
"at most ten rows in total, paged within those ten". The static keyword is a
ceiling on the whole result and the `Pageable` works inside it — which is the same
rule
[02e · limiting and static ordering](02e-limiting-and-static-ordering.md)
states for pagination applied to a limiting query.

## Gotchas

**⚠️ Returning `Page` when nothing shows a total.**
A count query per request, forever, for a number nobody reads. This is the single
most common avoidable cost in a Spring Data application, and the fix is a one-word
change to the return type.

**⚠️ Passing `null` for `Pageable` or `Sort`.**
They must be non-null. `Pageable.unpaged()`, `Sort.unsorted()` and
`Limit.unlimited()` exist for exactly the case you were reaching for `null` to
express.

**⚠️ Adding both a `Pageable` and a `Sort` parameter.**
Rejected — `Pageable` already carries a `Sort`. The same goes for `Pageable` plus
`Limit`. Both fail when the repository is created, which is the good outcome.

**⚠️ Using a special parameter twice.**
Two `Sort` parameters, or two `Pageable`s, is not a way to express secondary
ordering. The reference states that special parameters may be used only once per
query method.

**⚠️ Paging without a total order.**
Two pages of an unordered query can overlap or skip rows, because the database is
free to return them in any order between statements. Every paged query needs an
`order by` that ends in something unique — usually the primary key.

**⚠️ Assuming the count query has the same joins as yours.**
It is derived from your query, and derivation is where fetch joins, `distinct`
and native SQL cause trouble. For a native query it may not be derivable at all —
[03g2 · native pagination](03g2-native-pagination-and-results.md).

**⚠️ Reading `Page.getTotalElements()` as a live number.**
It is the count as of that request. On a busy table it is already out of date, and
paging deep into a set that is being written to will show rows twice or not at
all regardless of the total.

**⚠️ Building a `PageRequest` with a one-based page number.**
`PageRequest.of(1, 20)` is the *second* page. Off-by-one here shows up as "the
first record is missing" in a UI, which reads as a data problem.

**⚠️ Letting the client choose the page size.**
`size=100000` is a request to materialise the whole table. Cap it in the argument
resolver or in the controller; a `Pageable` from an HTTP request is user input
like any other.

**⚠️ Using `Top` with `Pageable` and expecting per-page limiting.**
`Top10` is a ceiling on the *entire* result, and the `Pageable` pages inside it.
So `findTop10By(PageRequest.of(2, 10))` returns nothing, and the query looks
correct.

**⚠️ Returning `Stream<T>` and not closing it.**
It typically holds a cursor. The reference says streams must be closed after use
to avoid resource leaks, and the try-with-resources has to be at the caller, which
is a leaky bit of API design to accept deliberately or not at all.

**⚠️ Treating `List<T>` with a `Pageable` as free pagination.**
It is genuinely cheaper — no count query — but you also lose `hasNext()`. You
know how many rows you got and nothing about what comes after, so the caller ends
up inferring "there is more" from a full page, which is what `Slice` already does
correctly.

## Interview questions

**★ What does a `Pageable` parameter actually do?**
It applies an offset and a limit to whatever query the method describes, and it
carries the sort order. It is one of the special parameters Spring Data
recognises, alongside `Sort`, `Limit` and `ScrollPosition`, and it works with both
derived and declared queries.

**★ What is the difference between `Page` and `Slice`?**
`Page` knows the total number of elements and pages, which requires a count query;
`Slice` only knows whether there is a next one, which it determines by fetching
`pageSize + 1` rows. One extra row versus one extra query.

**★ When should you return a `Page`?**
Only when something needs the total — a pager that prints "page 7 of 143", or a
UI that shows a result count. For "load more", infinite scroll, exports and batch
walks, `Slice` gives you everything you use and skips the count.

**★ Is the count query always issued for a `Page`?**
Not necessarily — the reference says a `COUNT(…)` query "can be required", and
Spring Data can avoid it when the answer is already determined, for example when
the first page is shorter than the page size. That unpredictability is itself a
reason to prefer `Slice` when the total is not displayed.

**★ What happens if you return a `List` with a `Pageable`?**
You get that range of entities and no metadata: no total, no `hasNext()`, and no
count query. It is the cheapest option and it pushes the "is there more" question
back to the caller, who usually re-implements `Slice` badly.

**★ Why can't you take both a `Pageable` and a `Sort`?**
Because a `Pageable` already defines a `Sort`, so the two would have to be
reconciled. The same reasoning rules out `Pageable` plus `Limit`. Special
parameters may also appear only once per method.

**★ Can you combine `Top` with `Pageable`?**
Yes, and the semantics catch people out: `Top` is the maximum for the entire
result and the `Pageable` pages within it. `findTop10By(…)` with a page size of
ten therefore has exactly one page.

**★ What must every paged query have that an unpaged one does not?**
A total order — an `order by` that ends in something unique, usually the primary
key. Without it the database may return equal rows in a different order between
requests, so pages can duplicate or skip records even though each query is
correct.

**★ How do you build a `Sort` safely?**
`Sort.by("property")` for the plain form, `Sort.sort(Type.class)` with method
references for the type-safe form, or `QSort` if you generate a Querydsl
metamodel. The type-safe form uses CGlib proxies at runtime, which the reference
warns may interfere with GraalVM native image compilation.

**★ A `Pageable` comes from an HTTP request. What do you check?**
The page size, first — an unbounded `size` parameter is a request to materialise
the table. Then the sort properties, because they are strings that reach the
query, and then whether the return type needs to be a `Page` at all given what
the client renders.

**★ What is the relationship between `Slice` and `Window`?**
Both are forward-only chunks that fetch one extra row to know whether more exist.
`Window` is the scroll API's shape and can be offset-based or keyset-based; the
keyset form rewrites the `where` clause instead of using an offset, which is what
makes it survive at depth.

{/* FOOTER */}
