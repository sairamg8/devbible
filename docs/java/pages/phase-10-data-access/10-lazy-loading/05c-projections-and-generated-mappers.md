---
title: "Spring Data's two projection styles are not equally safe at the boundary — a class-based projection is a value, and an interface projection is a proxy that forwards to a target on method invocation, which is a very different promise"
sidebar_label: "05c · Projections and mappers"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference, *Projections* — interface-based
> projections, closed and open projections, class-based (DTO) projections, dynamic
> projections, and *Using Projections with JPA*
> ([docs.spring.io/spring-data/jpa/reference/repositories/projections.html](https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html)),
> the Spring Boot 4.1 Maven plugin reference on what `spring-boot-starter-parent` provides
> ([docs.spring.io/spring-boot/maven-plugin/using.html](https://docs.spring.io/spring-boot/maven-plugin/using.html)),
> and the Hibernate ORM 7.4 *Introduction* §5.6 on proxies
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Spring Data offers two things both called projections, and the reference is precise about
the difference in a way that most usage is not. A class-based projection is instantiated — the
reference says of DTO types that "no proxying happens". An interface-based projection is a
*proxy*, created per result element, that "forwards calls to the exposed methods to the target
object" on method invocation. For this topic that distinction is decisive: one produces a
value that has finished reading, the other produces an object that reads when you ask it. If
you ask it after the transaction, you are in the same position you started in — holding a
reference that needs a session.** Continues
**[05b · Mapping to a DTO](05b-mapping-to-a-dto.md)**.

## Class-based (DTO) projections — a value

```java
public record NamesOnly(String firstname, String lastname) {}

interface PersonRepository extends Repository<Person, UUID> {
    List<NamesOnly> findByLastname(String lastname);
}
```

The reference on how the fields are chosen:

> *"If the store optimizes the query execution by limiting the fields to be loaded, the fields
> to be loaded are determined from the parameter names of the constructor that is exposed."*

and, for JPA specifically:

> *"Class-based projections use JPA's instantiation mechanism (constructor expressions) to
> create the projection instance."*

So a class-based projection compiles down to the constructor expression from
**[05b](05b-mapping-to-a-dto.md)** — the values are read in the query and the instance is
built from them. The reference's own contrast with interface projections is the sentence that
matters here:

> *"These DTO types can be used in exactly the same way projection interfaces are used, except
> that **no proxying happens** and no nested projections can be applied."*

**No proxying means no deferred reads means the boundary is closed.** A class-based projection
is a value in every sense this topic uses the word.

Two mechanical details:

- **Parameter names must survive compilation.** A `record`'s component names are always in the
  class file, so records are safe unconditionally. A hand-written class needs the compiler's
  `-parameters` flag, which `spring-boot-starter-parent` supplies — its feature list includes
  *"Compilation with `-parameters`."*
- **More than one constructor is ambiguous.** Annotate the intended one with
  `@PersistenceCreator`.

## Interface projections — a proxy over a target

```java
interface NamesOnly {
    String getFirstname();
    String getLastname();
}
```

> *"The query execution engine creates proxy instances of that interface at runtime for each
> element returned and forwards calls to the exposed methods to the target object."*

and for JPA:

> *"Spring Data JPA uses generally `Tuple` queries to construct interface proxies for
> Interface-based Projections."*

For a **closed** projection — *"a projection interface whose accessor methods all match
properties of the target aggregate"* — the target is that `Tuple`, and the query selects only
the columns the interface names:

> *"If you use a closed projection, Spring Data can optimize the query execution, because we
> know about all the attributes that are needed to back the projection proxy."*

A `Tuple`-backed proxy holds values. Nothing about it needs a session, so a closed interface
projection crosses the boundary safely.

## 🔴 Open projections are a different object

Add one `@Value` and the picture changes:

```java
interface NamesOnly {
    @Value("#{target.firstname + ' ' + target.lastname}")
    String getFullName();
}
```

> *"A projection interface using `@Value` is an open projection. Spring Data cannot apply query
> execution optimizations in this case, because the SpEL expression could use any attribute of
> the aggregate root."*

Read that carefully. "Could use any attribute of the aggregate root" means the query has to
supply the **aggregate root** — the entity — because the expression may reach anywhere in it.
Combine that with the mechanism sentence above, that the proxy *"forwards calls to the exposed
methods to the target object"* on method invocation, and you get:

**An open projection is a deferred computation whose target is an entity.** The expression is
evaluated when the accessor is called. If the accessor is called after the transactional
method returned — in a controller, in a serialiser, in a template — the expression is being
evaluated against a detached entity, and any association it navigates throws.

⚠️ **What I could confirm and what I could not.** The reference states plainly that calls are
forwarded to the target on method invocation, that open projections prevent query
optimisation because the expression could use any attribute of the aggregate root, and that
DTO projections do no proxying. **I did not find a sentence in the reference that says outright
"an open projection accessed outside the session can throw `LazyInitializationException`".**
That conclusion follows from the two documented facts, and I state it as a conclusion. The safe
practice either way is the same: treat an open interface projection as a reference, not a
value, and either consume it inside the transaction or use a record.

## Nested interface projections defer too

> *"Projections can be used recursively… On method invocation, the address property of the
> target instance is obtained and wrapped into a projecting proxy in turn."*

So `personSummary.getAddress()` obtains the address **when you call it** and wraps it in
another proxy. The chain of deferral is as long as the nesting. Class-based projections
sidestep this by not supporting nesting at all — *"no nested projections can be applied"* —
which is why nested records are built by mapping or by a second query rather than by the
projection machinery.

## The nested-property rule that surprises people

> *"Projections limit the selection to top-level properties of the target entity. Any nested
> properties resolving to joins select the entire nested property causing the full join to
> materialize."*

A projection that names `getCustomer().getName()`-style nested data does not narrow the join
the way the flat case narrows the column list. Expecting a projection to be uniformly "less
data" is wrong once a join is involved.

## Dynamic projections

```java
interface PersonRepository extends Repository<Person, UUID> {
    <T> Collection<T> findByLastname(String lastname, Class<T> type);
}
```

> *"However, you might want to select the type to be used at invocation time (which makes it
> dynamic)."*

One query method, many shapes, chosen by the caller. For this topic the safety of the result
is entirely the safety of the type you pass — `Person.class` gives you entities and all their
hazards, a record gives you values, an open interface gives you deferred evaluation. **The
signature makes no promise at all**, which is worth noticing given the whole argument of
**[04 · The detached entity](04-the-detached-entity.md)** was about signatures that promise
too little.

## Generated and reflective mappers

**MapStruct** generates a plain Java mapper at compile time. The generated code calls getters,
so it behaves exactly like the hand mapper in `05b`: reads happen where the mapping is invoked,
and every association it touches is a fetch requirement. It is safe at the boundary and it is
*not* a substitute for a fetch plan — and because the code is generated, the fetch requirement
is not visible in any file a reviewer opens.

**Reflective mappers** — ModelMapper, `BeanUtils.copyProperties`, `objectMapper.convertValue`
— are a different proposition. They walk whatever they find, including associations you did not
intend to map, and they do it by reflection so nothing about the walk is greppable. Inside a
transaction that is an unbounded fetch; outside one it is the failure in
**[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)**.

**`Tuple` and `Object[]`** close the boundary — they are values — and cost you every type
guarantee. Positional access with a cast per column is how a column reorder becomes a
`ClassCastException` in production.

## The full comparison

| Route | Values read | Boundary closed | Nested collections |
|---|---|---|---|
| Load entity + hand mapper | at each mapper line | yes, if no field holds an entity | natural |
| Load entity + MapStruct | at each generated getter call | yes | natural |
| Reflective mapper | wherever the walk reaches | only inside the transaction | walks everything |
| Constructor expression | in the query | yes | no — use two queries |
| Class-based projection | in the query | yes | no |
| Closed interface projection | in the query, into a `Tuple` | yes | via nested proxies |
| **Open interface projection** | **on accessor call** | **no** | via nested proxies |
| `Tuple` / `Object[]` | in the query | yes | no |

**The rule that falls out of the table:** prefer a record. Every route that produces one is
safe; the two routes that produce something else are safe only conditionally.

## Gotchas

**★ An open interface projection is not a DTO.** It is a proxy that computes on call, with an
entity behind it. It is introduced for exactly the reason a DTO is introduced — "we only need
two fields plus a full name" — and it does not deliver the property the DTO was for.

**★ One `@Value` converts a closed projection into an open one, silently.** The interface still
compiles, the repository method still works, and the query stops being optimised and starts
selecting the aggregate root. Nothing in the diff says "this now loads the whole entity".

**★ A hand-written class-based projection breaks without `-parameters`.** The field selection
is derived from constructor parameter names. `spring-boot-starter-parent` sets the flag, so
this bites projects with a custom parent or an unusual Gradle configuration — and it bites at
runtime. A `record` is immune, because component names are always retained.

**★ Two constructors on a projection class is an ambiguity, not an error.** Annotate the
intended one with `@PersistenceCreator` or accept whichever one Spring Data exposes.

**★ Projections do not narrow joins.** The reference says nested properties resolving to joins
"select the entire nested property causing the full join to materialize". So a projection over
a joined association can read more than you assume, and the "projections are always cheaper"
heuristic is only true for flat top-level columns.

**★ MapStruct hides the fetch requirement in generated code.** The mapper interface is three
lines and the generated implementation navigates the graph. A reviewer reading the diff sees a
mapping declaration; the queries it implies are in `target/generated-sources`.

**★ `BeanUtils.copyProperties` from an entity is an unbounded graph walk.** It copies every
readable property, including associations, and it does so reflectively — so no static analysis
and no grep will find the read that throws.

**★ A dynamic projection method's signature guarantees nothing.** `<T> List<T> find(…,
Class<T>)` can return entities or records depending on the argument, so the boundary property
of a call site is decided at the call site. That is fine if the team knows; it is a trap in a
codebase where "we use projections" is treated as a blanket assurance.

**★ Interface projections cannot be constructed in a test without the proxy machinery.** Which
means the type you assert against in a unit test is often a hand-written stub with different
behaviour from the real one. A record is trivially constructible, which is a small thing that
adds up.

**★ Returning a projection interface from a public API type-erases badly.** Jackson serialises
the proxy, which works, and the OpenAPI schema generated from an interface is frequently not
what you wanted. A record produces both correctly with no configuration.

## Interview questions

**★ What is the difference between an interface projection and a class-based projection in
Spring Data?**
A class-based projection is instantiated — for JPA it is compiled into a constructor
expression, and the reference says explicitly that for DTO types "no proxying happens". An
interface projection is a proxy created per result element that forwards calls to a target
object on method invocation. For a closed interface projection the target is a `Tuple` of the
selected columns, which holds values. For an open one — any interface with a `@Value` SpEL
accessor — the query cannot be optimised because the expression could use any attribute of the
aggregate root, so the target is the entity.

**★ Why would an open projection be unsafe at the transaction boundary?**
Because it defers evaluation. The proxy computes the SpEL expression when the accessor is
called, against a target that is the aggregate root. Call the accessor after the transactional
method has returned and the expression is evaluating against a detached entity; if it
navigates an association that was not fetched, that is a lazy load with no session. The
reference does not spell that consequence out, but it does state both premises, and the safe
practice is to treat an open projection as a reference rather than a value.

**★ Are projections always cheaper than loading the entity?**
For flat, top-level columns, yes — a closed projection or a class-based projection selects only
what it names. Once a nested property resolves to a join, no: the reference says such
properties "select the entire nested property causing the full join to materialize". So the
saving is on columns of the root, and the join behaviour is unchanged. Assuming otherwise is
how a projection ends up reading more than the entity did.

**★ Does MapStruct solve the lazy-loading problem?**
It solves the boilerplate problem and inherits the fetch problem. The generated mapper calls
getters, so it reads at the point of invocation exactly like a hand-written mapper: safe inside
the transaction, throwing outside it, and issuing a query per association the fetch plan
missed. The extra hazard is that the reads are in generated code, so the fetch requirement of a
mapping is invisible in review.

**★ Why is `BeanUtils.copyProperties` or ModelMapper worse than either?**
Because the set of properties it reads is decided reflectively at runtime from whatever the
source object exposes, rather than by a list you wrote. Applied to an entity it walks
associations you never intended to map, so inside a transaction it is an unbounded fetch and
outside one it throws — and in both cases nothing in the source names the property that caused
it, which makes the failure hard to locate from a stack trace.

**★ If you had one rule for a team, what would it be?**
Return a record. Everything that produces a record — a hand mapper, a generated mapper, a
constructor expression, a class-based projection — closes the boundary, and the two routes that
produce something else close it only under conditions the type does not state. "Records leave
the service" is a rule that can be checked in review by looking at a signature, which is the
property that makes it survive contact with a large team.

{/* FOOTER */}
