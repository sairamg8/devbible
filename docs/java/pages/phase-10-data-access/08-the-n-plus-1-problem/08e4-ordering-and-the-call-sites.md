---
title: "A bag's order was never guaranteed, so the Set fix does not remove ordering — it removes the illusion of it, and the code that depended on the illusion"
sidebar_label: "8e4 · Ordering and the call sites"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §11.1.43
> *OrderBy Annotation* and §11.1.44 *OrderColumn Annotation*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> and the Hibernate ORM 7.4 user guide §3.9.12 *Ordered Lists* and §3.9.14
> *Sorted sets*
> ([docs.hibernate.org/orm/7.4/userguide](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The second half of the `Set` bill from [8e3](08e3-what-set-costs-the-model.md).
A plain `List` was a bag, and the user guide says bags "don't retain element
order" — so the ordering you are about to lose was never promised. The problem is
that it *looked* reliable for years, so call sites, templates, exports and tests
grew to depend on it, and the compiler can only find about half of them.**

## The order you had was an accident

A bag returns rows in whatever order the database produced for a select with no
`ORDER BY`. On PostgreSQL that is whatever the plan produced: a sequential scan of
a freshly-loaded table returns physical order, which is insertion order, which is
why it looks stable. After the first `UPDATE` moves a row, or the planner picks
an index scan, or the table is `VACUUM FULL`-ed, or the same query runs in
parallel, it stops being insertion order and nothing announces the change.

So the honest framing is not "the `Set` broke ordering". It is: **the `Set` made
a latent bug visible immediately instead of eventually.** Code that depended on
bag order was already wrong; you have just moved its failure from "some Tuesday
in production" to "this afternoon".

That reframing matters when you are deciding how much to invest in restoring
order: if the order was load-bearing, it needed a mapping all along.

## `@OrderBy` — ordering at the database

`@OrderBy` names properties of the child and Hibernate appends an `ORDER BY` to
the select that loads the collection. No schema change, no write cost.

```java
@OneToMany(mappedBy = "order")
@OrderBy("lineNumber ASC")
Set<OrderLine> lines = new LinkedHashSet<>();
```

Three details from the specification, §11.1.43, that get missed:

- **The value is optional, and omitting it is not "no ordering".** *"If the
  ordering element is not specified for an entity association, ordering by the
  primary key of the associated entity is assumed."* A bare `@OrderBy` means
  "order by the child's id".
- **`ASC` is the default.** *"If `orderby_list` is not specified or if `ASC` or
  `DESC` is not specified, `ASC` (ascending order) is assumed."*
- **It must be a basic property.** *"A property or field name specified as an
  `orderby_item` must correspond to a basic persistent property or field of the
  associated class or embedded class within it."* The dot notation exists **only
  for attributes inside an embeddable** — so `@OrderBy("shippingAddress.city")`
  is legal when `shippingAddress` is `@Embedded`, and `@OrderBy("product.name")`
  is **not** legal when `product` is a `@ManyToOne`. Ordering by a value that
  lives across an association is not something `@OrderBy` can express; that is a
  query's job.

🔴 **The field's runtime type has to preserve order too.** Hibernate issues the
`ORDER BY`, the rows arrive ordered, and a `HashSet` throws the order away as
fast as they arrive. Declare the field `LinkedHashSet` — or use a `SortedSet`,
accepting the comparator contract discussed in
[8e3](08e3-what-set-costs-the-model.md). A mapping that says `@OrderBy` while the
initialiser says `new HashSet<>()` is the single most confusing shape in this
chunk, because the annotation is right there in the source, being ignored.

## `@OrderColumn` — ordering as data

An indexed list is not a bag, so two indexed lists are legal in one fetch join.
That makes `@OrderColumn` a *third* way out of `MultipleBagFetchException`, and
it keeps `List`, and it keeps duplicates. It looks free.

It is not, and the specification says who pays. §11.1.44:

> *"The `OrderColumn` annotation specifies a column that is used to maintain the
> persistent order of a list. The persistence provider is responsible for
> maintaining the order upon retrieval and in the database. The persistence
> provider is responsible for updating the ordering upon flushing to the database
> to reflect any insertion, deletion, or reordering affecting the list."*

Read that as a cost statement. Removing element 3 of a 200-element list means the
provider must renumber elements 4 through 200 — a write per element after the
one you touched. Appending is cheap; inserting or deleting in the middle is
proportional to the tail.

Two more facts from the same section:

- *"The order column is not visible as part of the state of the entity or
  embeddable class."* Nothing in your Java code will remind you the column
  exists — it appears in the schema, the migrations and the query plans, and
  nowhere in the model.
- *"The `OrderBy` annotation is not used when `OrderColumn` is specified."* They
  are alternatives, not layers. Writing both is not an error you will be told
  about; one of them simply does nothing.

**Use `@OrderColumn` when the position is domain data** — a playlist, a
checklist, the fields of a user-built form, the steps of a workflow. In those
cases you wanted it before the exception showed up. Do not use it because it was
the cheapest-looking way to stop being a bag.

## The positional call sites

The compiler finds most of the breakage, which makes this the least dangerous
consequence — but not all of it, and the half it misses is the half that faces
other people.

| Breaks loudly, at compile time | Breaks quietly, at runtime |
|---|---|
| `lines.get(0)` | JSON array order in an API response |
| `lines.indexOf(x)` | a server-rendered table iterating the collection |
| `lines.subList(0, 10)` | a CSV or PDF export whose rows are positional |
| `Collections.sort(lines)` | an approval or snapshot test with an ordered fixture |
| `lines.listIterator()` | a client that pages by index into the array |
| `lines.set(i, x)` | a checksum or ETag computed over the serialised list |

The right-hand column is a contract with somebody outside your codebase.
Changing a collection type to fix a query is not a change anybody expects to
renegotiate a response contract, which is why the ticket that comes back a week
later never mentions the exception.

**The cheap audit:** grep the codebase for the getter name, not for `get(`. Every
site that touches `order.getLines()` is a candidate; there are usually fewer than
you fear, and the ones in templates and serialisers are exactly the ones a search
for `get(0)` would miss.

## So which one do you actually pick?

Ordered by how often it is the right answer:

1. **Do not change the collection type at all.** Take fix 2 or fix 3 from
   [8e2](08e2-the-three-ways-out.md). A query problem gets a query fix, and the
   blast radius stays inside the query.
2. **`Set` with identifier-based `equals` and `hashCode`**, when both collections
   are genuinely small and bounded and the single round trip is worth having.
3. **`LinkedHashSet` with `@OrderBy`**, when a defined order matters and it is
   derivable from a basic column on the child.
4. **`@OrderColumn` on a `List`**, only when the persisted position *is* part of
   the domain.

Notice that (1) is not a compromise between the others. It is the answer that
leaves the model alone, and the model is the thing every other query in the
application shares.

## Gotchas

**⚠️ `@OrderBy` on a field initialised to `new HashSet<>()`.**
The database orders, the `HashSet` un-orders, and the mapping looks correct while
being ignored. `LinkedHashSet`, every time.

**⚠️ Ordering by a property across an association.**
`@OrderBy("product.name")` is not what the specification allows — dot notation is
for attributes *within an embeddable*. Depending on the provider you get a
startup failure or a surprise; either way, ordering by data on the far side of an
association belongs in a query with a join, not in a mapping.

**⚠️ Writing `@OrderBy` and `@OrderColumn` on the same association.**
The spec says `@OrderBy` "is not used when an order column is specified". One of
the two annotations is dead code, and which one is dead is not obvious from
reading the class.

**⚠️ Adding `@OrderColumn` to an existing table without backfilling it.**
The column starts `NULL` for every existing row. A list with null indexes is not
a list, and the provider's behaviour when it meets one is not something to
discover in production. The migration is: add the column, backfill it with a
window function over whatever ordering you are asserting, make it `NOT NULL`,
*then* deploy the mapping.

**⚠️ Putting `@OrderColumn` on the wrong side.**
The spec requires it "on the side of the relationship that references the
collection that is to be ordered". On a bidirectional `@OneToMany` that is the
parent, next to the collection — not on the child's `@ManyToOne`.

**⚠️ Sorting in Java to compensate.**
`list.sort(comparing(OrderLine::getLineNumber))` after every load works, and it
moves ordering out of the mapping and into whichever call sites remembered to do
it. The one that forgets is the bug. If the order is part of what the collection
*is*, it belongs in `@OrderBy`.

**⚠️ Assuming `@OrderBy` costs nothing at the database.**
It adds an `ORDER BY` to the collection select, which the database must satisfy —
free if an index already provides that order, a sort otherwise. On a collection
of twenty rows that is noise; on an element collection with a hundred thousand
rows per owner, it is not, and it is another reason such a collection should not
be a mapped collection.

**⚠️ Believing the API response order was "just how it came back".**
Downstream clients treat a JSON array as ordered because JSON arrays *are*
ordered. If your response is built from a bag, you have been publishing an
unspecified order as though it were specified. That is worth fixing on its own
merits — with an explicit `@OrderBy` or an explicit sort in the mapper — and the
`Set` change is a good moment to do it.

**⚠️ Treating the compile errors as the whole audit.**
They are the easy half. The list above of things that break quietly is the half
that generates the incident, and none of it is visible to `javac` or to a test
suite that asserts on sets.

## Interview questions

**★ Is `@OrderColumn` a legitimate way out of `MultipleBagFetchException`?**
It genuinely removes it, because an indexed list is not a bag and the provider
can reconstruct positions from the index column. But the specification puts the
maintenance obligation on the provider — it must update the ordering "to reflect
any insertion, deletion, or reordering affecting the list" — so deleting from the
middle of a long list issues an update per element after it. Taking a schema
change and a permanent write-path cost to silence a read-path exception is a poor
trade, unless the persisted position is part of the domain, in which case it was
never a fix; it was a feature you happened to need.

**★ What is the difference between `@OrderBy` and `@OrderColumn`?**
`@OrderBy` names basic properties of the child and becomes an `ORDER BY` on the
select that loads the collection: no schema change, no write cost, and the order
must be derivable from data that already exists. `@OrderColumn` adds a column
storing each element's index, which the provider maintains on every insertion,
deletion and reordering; it can express an arbitrary, user-chosen order that no
child column implies. The spec says they are mutually exclusive — "the `OrderBy`
annotation is not used when an order column is specified". Choose `@OrderBy`
unless the position itself is data.

**★ You add `@OrderBy` to a `Set` and the order still is not there. Why?**
Because the field is initialised to a `HashSet`. Hibernate issues the `ORDER BY`,
the rows come back ordered, and the `HashSet` discards the order as it inserts
them. Declare the field a `LinkedHashSet`, which preserves insertion order, and
the database's ordering survives into iteration.

**★ What does a bare `@OrderBy` with no value mean?**
Not "unordered". The specification says that if the ordering element is not
specified for an entity association, "ordering by the primary key of the
associated entity is assumed" — so it means order by the child's id, ascending.
For a sequence-generated id that is usually insertion order, which is often what
people wanted; for a UUID id it is an arbitrary but stable order, which is
usually not.

**★ Can you order a collection by a property of an associated entity?**
Not with `@OrderBy`. The specification restricts `orderby_item` to a basic
persistent property of the associated class "or embedded class within it", and
the dot notation is for reaching inside an embeddable, not across an association.
Ordering by, say, the product's name requires a query that joins to the product
and orders there — which is a good indication that what you needed was a
projection, not a mapped collection.

**★ What breaks in application code when a collection changes from `List` to
`Set`?**
Everything positional: `get(i)`, `indexOf`, `subList`, `set(i, x)`, sorting the
collection in place, and any code that assumed the first element meant something.
The compiler finds those. What it does not find is the serialised order of a JSON
array a client depends on, a template that renders the collection as a table, a
positional export, and any test that asserted on order without saying so. Those
are found later, by someone else.

**★ Was the ordering you lost ever guaranteed?**
No — and this is the useful thing to say in the interview. A plain `List` maps to
a bag, and the Hibernate user guide states that bags "don't retain element
order". A select with no `ORDER BY` returns rows in whatever order the plan
produced, which on a freshly loaded table looks exactly like insertion order and
stops looking like it after the first update, index scan or parallel plan. So the
`Set` did not break ordering; it converted a latent, timing-dependent bug into an
immediate and obvious one, which is the better failure.

**★ How would you audit the call sites before making this change?**
Search for the accessor — `getLines()` — rather than for `get(0)`, because the
dangerous sites are the ones that never index at all: serialisers, templates,
exports, checksum builders. Then let the compiler enumerate the positional ones.
Then look at the response contract: if the collection reaches an API as a JSON
array, the order is already published, and the change needs either an explicit
`@OrderBy` to preserve it or a note to the consumers that it was never specified.

**★ When would you accept `@OrderColumn` without hesitation?**
When the domain has a concept of position that a user controls and no child
column implies — the order of tracks in a playlist, of questions in a
questionnaire, of steps in a runbook. In those cases the index is not bookkeeping,
it is the data, and the provider maintaining it is exactly what you want. The
tell that you are in the other case is that you cannot name what the position
*means* without saying "the order they were inserted".

---

← Prev: [8e3 · What Set costs the model](08e3-what-set-costs-the-model.md) · Index: [08 · The N+1 problem](README.md) · Next → [9 · Entity graphs](09-entity-graph.md)
