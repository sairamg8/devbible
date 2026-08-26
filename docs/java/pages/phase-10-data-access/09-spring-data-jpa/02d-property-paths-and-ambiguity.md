---
title: "A predicate token is resolved against your entity by a greedy camel-case algorithm that prefers a direct property over any nested path, treats the underscore as a reserved character, and quietly exempts findById from the whole thing"
sidebar_label: "02d · Property paths and ambiguity"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Defining Query
> Methods", sections "Property Expressions" and "Reserved Method Names"
> ([query-methods-details.html](https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html)).
> Path-expression join semantics are Jakarta Persistence 3.2's. JDK 25,
> Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**`findByAddressZipCode` is not one lookup, it is a search. Spring Data splits the
token on camel-case boundaries and tries the longest match first, so the same
method name can resolve to a scalar property called `addressZipCode` or to a
traversal `address.zipCode`, and which one it picks depends on what else is
declared on the entity. The rule is stated in one sentence in the reference — a
direct match wins — and its consequence is that adding an unrelated field can
change what an existing query method queries.**

## The token is resolved, not looked up

The predicate is tokenised into property references, and each reference is
matched against the entity by splitting on camel case and trying progressively
shorter head segments. Given `AddressZipCode` on a `Person`:

1. Is there a property `addressZipCode`? If yes, done — that is the answer.
2. Otherwise split: is there `address`? If yes, continue resolving `zipCode`
   against that property's type.
3. Otherwise split further, and so on.

The reference's own example of the successful case:

```java
List<Person> findByAddressZipCode(ZipCode zipCode);
```

> *"Assume a `Person` has an `Address` with a `ZipCode`. In that case, the method
> creates the `x.address.zipCode` property traversal."*

## Direct match wins, and that is the whole ambiguity rule

> *"Since a direct match on a property is considered first, any potential nested
> paths will not be considered and the algorithm picks the direct property. In
> order to select nested properties, the underscore notation is required."*

That single sentence is the trap. If `Person` gains a scalar field
`addressZipCode` — a denormalised copy for searching, say — then the existing
`findByAddressZipCode` stops traversing into `address` and starts reading the new
column. It compiles, it starts, and it returns different rows.

🔴 **This makes an unrelated field addition a behavioural change to an existing
query method.** Nothing in the diff of the entity shows it, and nothing in the
repository changed. It is the strongest single argument for writing traversals
explicitly.

## The underscore makes the split explicit

> *"To resolve ambiguity you can use `_` inside your method name to manually
> define traversal points."*

```java
List<Person> findByAddress_ZipCode(ZipCode zipCode);
```

Now the traversal point is stated, not inferred, and a later `addressZipCode`
field cannot capture it. The cost is that the method name no longer reads as a
Java identifier should, which is why the same page immediately adds:

> *"Because we treat underscores (`_`) as a reserved character, we strongly
> advise to follow standard Java naming conventions (that is, not using
> underscores in property names but applying camel case instead)."*

Both halves of that advice matter. Use `_` in *method names* to disambiguate a
traversal; do not use `_` in *property names*, because the parser has already
claimed the character.

## When your property names do contain an underscore

The reference documents three escape routes for field names that fight the
algorithm:

| Field shape | Rule from the reference |
|---|---|
| `String _name` | *"Make sure to preserve the `_` as in `_name` and use double `_` to split nested paths like `user__name`."* |
| all-uppercase, e.g. `USER` | *"Field names that are all uppercase can be used as such. Nested paths if applicable require splitting via `_` as in `USER_name`."* |
| lower-then-upper, e.g. `String qCode` | *"Field names that consist of a starting lower case letter followed by an uppercase one like `String qCode` can be resolved by starting with two upper case letters as in `QCode`. Please be aware of potential path ambiguities."* |

⚠️ **These are documented workarounds, not a design to aim for.** Every one of
them is a rule a future reader has to know before they can tell what
`findByUser__name` queries. A legacy schema mapped with legacy field names is a
real reason to reach for them; a new entity is not.

## Reserved methods: `findById` ignores all of this

There is one carve-out where the resolver does not run at all:

> *"While derived repository methods bind to properties by name, there are a few
> exceptions to this rule when it comes to certain method names inherited from
> the base repository targeting the identifier property. Those reserved methods
> like `CrudRepository#findById` (or just `findById`) are targeting the
> identifier property regardless of the actual property name used in the
> declared method."*

The reference's example is worth reading twice:

```java
class User {

  @Id Long pk;   // the identifier property
  Long id;       // a property named `id` — but NOT the identifier
}

interface UserRepository extends Repository<User, Long> {

  Optional<User> findById(Long id);      // targets pk   — reserved method
  Optional<User> findByPk(Long pk);      // targets pk   — ordinary derived query
  Optional<User> findUserById(Long id);  // targets id   — descriptive token breaks the match
}
```

Three signatures, two different columns, and the difference between the first and
third is the word `User` in the middle. The reference adds that *"this special
behaviour not only targets lookup methods but also applies to the `exists` and
`delete` ones"*, so `existsById` and `deleteById` follow the identifier too.

🔴 **The practical rule: name your identifier property `id`.** The carve-out
exists so `CrudRepository` works on entities that did not, and it is a rule you
have to remember rather than one you can see. Identifier choice is
[topic 06 · the identifier](../06-jpa-hibernate-model/06-the-identifier.md).

## A traversal is a join, and by default an inner one

`findByAddressZipCode` produces the JPQL path `x.address.zipCode`. In Jakarta
Persistence, navigating an association inside a path expression implies a join,
and a plain path navigation is an **inner** join.

That has two consequences the method name does not show:

- **Rows with a `null` association disappear.** A `Person` with no `address` will
  never match `findByAddressZipCode(...)`, not even when the predicate is a
  negation. If the association is optional, the derived form cannot express the
  left join you need — that is `@Query` with an explicit `left join`.
- **Traversing a *collection* multiplies rows.** `findByLinesSkuCode` joins to
  the child table, so a parent with three matching lines can come back three
  times. `Distinct` in the subject is the usual reflex and the wrong fix; the
  argument is
  [topic 08 · duplicate parents and distinct](../08-the-n-plus-1-problem/08c-duplicate-parents-and-distinct.md).

⚠️ **And the join it creates is for filtering only.** It does not fetch the
association — the returned entities still have lazy proxies for `address`.
A traversal predicate is not a fetch, which is
[topic 08 · join fetch](../08-the-n-plus-1-problem/08-join-fetch.md).

## Gotchas

**⚠️ Adding a denormalised scalar field that shadows an existing traversal.**
A new `addressZipCode` column makes the existing `findByAddressZipCode` read that
column instead of `address.zipCode`. Direct match wins. The application still
starts and the method still returns rows — different ones.

**⚠️ Using `_` in property names.**
The parser treats it as a reserved character, so every traversal through that
property needs the doubled-underscore spelling. The reference explicitly advises
against it, and the workaround is documented precisely because people inherit
schemas where it is unavoidable.

**⚠️ Assuming a traversal predicate returns entities with the association
loaded.**
It joins to filter, not to fetch. `findByAddressZipCode` still hands back a
`Person` whose `address` is a proxy, so touching it outside the session is a
`LazyInitializationException` waiting to happen.

**⚠️ Traversing an optional association and losing rows.**
The implicit join is an inner join. "Find people whose address zip is not X"
written as a derived query silently excludes everyone with no address at all,
which is usually the opposite of the requirement.

**⚠️ Traversing a collection without expecting duplicates.**
One parent row per matching child. The count of results is not the count of
distinct parents, and `countByLinesSkuCode` counts the joined rows unless you are
careful — verify what you are counting before you build a page count on it.

**⚠️ Confusing `findById` with a query on a field called `id`.**
On an entity whose identifier is `pk`, `findById` queries `pk` and
`findUserById` queries `id`. Both compile, both start, and the only visible
difference is a word in the middle of a method name.

**⚠️ Renaming a nested property and only fixing the obvious call sites.**
`findByAddressZipCode` breaks at bootstrap when `ZipCode` is renamed, which is
good — but `findByAddress_ZipCode` breaks in exactly the same way, and a
`@Query("… where p.address.zipCode = :z")` breaks at bootstrap too if the query
is validated, or later if it is native. Derived and JPQL forms fail early; native
does not.

**⚠️ Relying on the camel-case resolver with a two-letter property.**
A field like `qCode` needs `QCode` in the method name, and the reference itself
adds "please be aware of potential path ambiguities" to that advice. If a
property name is fighting the resolver, rename the property.

**⚠️ Writing a four-level traversal because it resolves.**
`findByCustomerAddressCountryIsoCode` is three inner joins in a method name. It
works, it is unreadable, and it hides the join count from the person reviewing
the change. Past two levels, JPQL is more honest, not less.

**⚠️ Expecting the resolver to consider nested paths when a direct match
exists.**
It does not — it stops. There is no "did you mean" and no warning that a
traversal was shadowed. The underscore notation is the only way to force the
nested interpretation.

## Interview questions

**★ How does Spring Data turn `findByAddressZipCode` into a property path?**
It tokenises the predicate and resolves `AddressZipCode` against the entity by
splitting on camel case, trying the longest head first. If `Person` has a
property `addressZipCode`, that direct match wins. Otherwise it looks for
`address` and continues resolving `zipCode` against that type, producing the
traversal `x.address.zipCode`.

**★ What happens if the entity has both `addressZipCode` and
`address.zipCode`?**
The direct property wins. The reference says a direct match is considered first
and "any potential nested paths will not be considered". To reach the nested one
you must write `findByAddress_ZipCode`.

**★ Why is that dangerous?**
Because it makes adding a field to an entity a behavioural change to an existing
repository method. Nothing in the repository changed, nothing fails at startup,
and the method now reads a different column. Explicit underscore traversals are
immune to it.

**★ What does the underscore mean in a method name?**
It is a manual traversal point — `findByAddress_ZipCode` states where the split
happens instead of letting the algorithm infer it. Because the character is
reserved for that, the reference strongly advises against underscores in property
names, and documents doubled underscores as the escape when you have them anyway.

**★ How would you query a property whose field is `_name`?**
Preserve the underscore in the method name and use a doubled underscore to split
a nested path — the reference's example is `user__name` for `user._name`. It is
documented, it works, and it is a strong hint that the field should be renamed.

**★ On an entity with `@Id Long pk` and a separate field `id`, what does
`findById` return?**
The row matched on `pk`. `findById`, `existsById` and `deleteById` are reserved
methods that target the identifier property whatever it is called. Querying the
field actually named `id` requires breaking the reserved-method match with a
descriptive token, as in `findUserById`.

**★ Is a traversal predicate a join?**
Yes — path navigation through an association is a join in JPQL, and a plain
navigation is an inner join. So a derived traversal both filters and restricts:
entities whose association is `null` cannot match, and traversing a collection
can return the same parent once per matching child.

**★ Does a traversal fetch the association as well?**
No. The join exists to evaluate the predicate. The returned entities still have
lazy associations, so a traversal predicate does nothing to help the N+1 problem
— fetching is a separate decision, made with a fetch join or an entity graph.

**★ You need "people whose address is missing or whose zip is not 12345". Can
a derived query express it?**
No. The implicit join is inner, so anyone with no address is excluded before the
predicate is evaluated, and there is no left-join spelling in the method-name
grammar. That needs JPQL with an explicit `left join`.

**★ When does a property-path mistake surface?**
At context startup, as a `PropertyReferenceException` naming the token it could
not resolve. That is true for both the camel-case and the underscore forms. The
mistakes that do *not* surface are the ones where a wrong-but-valid property
exists — a shadowed traversal, or a transposed pair of same-typed parameters.

{/* FOOTER */}
