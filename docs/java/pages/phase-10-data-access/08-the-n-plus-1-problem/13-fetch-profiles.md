---
title: "A fetch profile is a named fetch plan that lives on the mapping and is switched on per session — the one fix that can ask for subselect fetching, and the one almost nobody knows"
sidebar_label: "13 · Fetch profiles"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §9.16 *Named fetch
> profiles* and Table 9.16
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Hibernate ORM 7.4 *User Guide* §12.1 *The basics* and §12.7 *Dynamic fetching
> via Hibernate profiles*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Every fix so far attaches the fetch plan to a query. A fetch profile does the opposite:
it declares the plan on the mapping, gives it a name, and leaves it switched off until a
session asks for it. That inversion buys exactly one thing no other fix offers — the
ability to request subselect fetching selectively — and costs one thing every other fix
avoids: the plan applies to every operation in the session, including ones you did not
write. Hibernate's own documentation recommends it lukewarmly at best, and it is still
worth knowing, because it is the only tool that fits a small, real class of problems.**

## The gap it fills

The user guide opens its fetching chapter by dividing fetch strategy definitions into two
scopes. **Static** definitions live in the mappings and are used "in the absence of any
dynamically defined strategies". **Dynamic** definitions are described as "use-case
centric", and the guide lists three of them: fetch profiles, HQL/JPQL and criteria
fetching, and Jakarta Persistence entity graphs.

Of those three, two are attached to a query. **`join fetch`** ([8 · join
fetch](08-join-fetch.md)) is query text. An [entity graph](09-entity-graph.md) is a hint
passed to a `find` or a query. Both require that you are the one issuing the operation.

The guide motivates profiles with the case where you are not:

> *"Suppose we wanted to leverage loading by natural-id to obtain the `Employee`
> information… Loading by natural-id uses the statically defined fetching strategies, but
> does not expose a means to define load-specific fetching. So we would leverage a fetch
> profile."*

That is the whole argument in one sentence. `session.bySimpleNaturalId(...).load(...)` has
no place to hang a fetch plan. Neither does `entityManager.find(Employee.class, id)` on
older APIs, neither does a `getReference` that later gets initialised, and neither does a
Spring Data derived method you did not write the body of. A profile is fetch configuration
for the loads whose call sites have nowhere to put it.

## Declaring one

The profile is a name. You attach it to a class or a package with `@FetchProfile`:

```java
@FetchProfile(name = "EagerBook")
@Entity
class Book {
    // ...
}
```

The introduction makes a point about this that is easy to skim past and matters a great
deal:

> *"Note that even though we've placed this annotation on the `Book` entity, a fetch
> profile — unlike an entity graph — isn't 'rooted' at any particular entity."*

**A profile is a global, session-scoped switch with a string name.** Putting the
declaration on `Book` is filing, not scoping. Once enabled, it applies to every entity
whose associations name that profile — `Book`, `Author`, `Publisher`, anything. An entity
graph, by contrast, is rooted: it describes a plan *for loading a `Book`*, and it means
nothing outside that load.

## The two ways to say what it fetches

### The one the documentation is embarrassed by

`@FetchProfile` takes a `fetchOverrides` member, and the user guide's own example shows
what it looks like:

```java
@Entity(name = "Employee")
@FetchProfile(
    name = "employee.projects",
    fetchOverrides = {
        @FetchProfile.FetchOverride(
            entity = Employee.class,
            association = "projects",
            mode = FetchMode.JOIN
        )
    }
)
class Employee { /* ... */ }
```

The introduction's assessment of this form is unusually direct:

> *"We may specify association fetching strategies using the `fetchOverrides` member of
> the `@FetchProfile` annotation, but frankly it looks so messy that we're embarrassed to
> show it to you here."*

The reason it is messy is structural, not cosmetic. **The association is named by a
string** (`"projects"`) and the entity by a class literal, so the declaration sits
somewhere other than the thing it configures, and refactoring the field does not move the
declaration with it. Whether a `fetchOverrides` entry naming an association that no longer
exists is rejected at boot or ignored is something *I could not confirm against the 7.4
documentation*, and the difference matters — one gives you a startup failure, the other
gives you a profile that reads as configured and overrides nothing. Either way the string
is a dependency the compiler does not see, which is enough reason not to use this form.

### The one you should use

Annotate the association with the profiles it participates in:

```java
@FetchProfile(name = "EagerBook")
@Entity
class Book {

    @ManyToOne(fetch = LAZY)
    @FetchProfileOverride(profile = Book_.PROFILE_EAGER_BOOK, mode = JOIN)
    Publisher publisher;

    @ManyToMany
    @FetchProfileOverride(profile = Book_.PROFILE_EAGER_BOOK, mode = JOIN)
    Set<Author> authors;
}

@Entity
class Author {

    @OneToOne
    @FetchProfileOverride(profile = Book_.PROFILE_EAGER_BOOK, mode = JOIN)
    Person person;
}
```

Three things are worth stopping on.

**`Book_.PROFILE_EAGER_BOOK` is generated.** The introduction says it "is generated by
Hibernate Processor, and is just a constant with the value `"EagerBook"`". So the profile
name is a compile-time constant produced from the `@FetchProfile` declaration, and a typo
in the profile name becomes a compile error rather than a profile that quietly does
nothing. If you are going to use profiles at all, use the metamodel constants — the raw
string form is the single largest source of profiles that appear to be enabled and are not.

**The override sits on the field it overrides.** Rename `publisher` and the annotation
moves with it. That is the entire difference from `fetchOverrides`, and it is why this form
exists.

**`Author.person` participates in `EagerBook` even though `Author` never declares the
profile.** This is the non-rooted property made concrete: enabling `EagerBook` to load a
`Book` also changes how an `Author` loaded anywhere in that session fetches its `Person`.
That is a feature when you want a deep plan and a trap when you did not realise the plan
was deep.

## Gotchas

**★ A profile declared and never enabled changes nothing, and there is no warning.**
`@FetchProfile` on the entity and `@FetchProfileOverride` on the field are inert until some
session calls `enableFetchProfile`. The mapping reads as if the fetch plan is configured.
It is not — it is *available*. This is the reverse of every other annotation on the class,
and the reason profiles are so often found half-wired in a codebase.

**★ The `fetchOverrides` string form silently survives a rename.** Refactoring
`projects` to `activeProjects` updates every reference in Java and leaves
`association = "projects"` pointing at nothing. Prefer `@FetchProfileOverride` on the
field for exactly this reason.

**★ A mistyped profile name fails at the call, not at startup.**
`Session.enableFetchProfile(String)` is documented to throw `UnknownProfileException` when
"the given name does not match any known fetch profile names", and so are
`disableFetchProfile` and `isFetchProfileEnabled`. That is better than failing silently —
but it is still a runtime failure on whichever request first reaches that line, which on a
rarely-exercised path can mean production. `Book_.PROFILE_EAGER_BOOK` turns the same
mistake into a compile error.

**★ It is not rooted, so it reaches further than the entity you declared it on.** Enabling
a profile to fix a `Book` load also changes `Author` loads in the same session if `Author`
carries an override for that profile. Deep profiles are how a fix for one endpoint turns
into a slower query on another that happens to run in the same session.

**★ `mode = SELECT` is a legal override and it is the N+1 strategy by name.** The user
guide defines `SELECT` as "a separate SQL select to load the data… This is the strategy
generally termed N+1." A profile is a mechanism for changing fetch strategy in either
direction; nothing stops you writing the bug into it deliberately.

**★ Profiles do not compose with entity graphs — one of them loses.** Which one, and why,
is the subject of [13b · Enabling a profile](13b-enabling-and-the-default-profile.md),
along with the one fetch mode a profile can request that nothing else can.

## Interview questions

**★ What problem does a fetch profile solve that `join fetch` and an entity graph do
not?**
Two. The first is call sites you do not control or cannot annotate — the user guide's
motivating case is `bySimpleNaturalId(...).load(...)`, which "uses the statically defined
fetching strategies, but does not expose a means to define load-specific fetching". A
Spring Data derived finder, a `getReference` initialised later, and a cascade-driven load
are in the same category. The second, and the one the introduction calls "the one and only
advantage unique to fetch profiles", is selective **subselect** fetching: you cannot ask
for `SUBSELECT` from HQL and you cannot ask for it from an entity graph, so a profile is
the only way to enable it for one use case instead of for the whole mapping.

**★ Why is `@FetchProfileOverride` on the association better than `fetchOverrides` on the
profile, given they do the same thing?**
Because `fetchOverrides` names the association with a string and the entity with a class
literal, so the configuration lives away from the thing it configures and nothing keeps the
two in sync. Renaming the field breaks the override silently — the association reverts to
its mapped strategy and you get the N+1 back with a profile that still looks enabled.
`@FetchProfileOverride` sits on the field, moves with it under refactoring, and takes the
profile name from a generated metamodel constant rather than a literal.

**★ A profile is declared on `Book`. Does it only affect loads of `Book`?**
No, and this is the single most misunderstood thing about the feature. The documentation
says a fetch profile "isn't 'rooted' at any particular entity" — the annotation's placement
is filing, not scoping. Once the profile is enabled on the session, every association
anywhere in the model that carries an override for that profile name changes behaviour. An
entity graph is the opposite: it is rooted at the type it is defined for and means nothing
outside a load of that type.

**★ Where does the `Book_.PROFILE_EAGER_BOOK` constant come from, and why does it
matter?**
Hibernate Processor generates it from the `@FetchProfile` declaration; the introduction
describes it as "just a constant with the value `"EagerBook"`". It matters because the
alternative is passing the profile name as a string literal to `enableFetchProfile`, and the
javadoc for that method says it throws `UnknownProfileException` when the name "does not
match any known fetch profile names". So the typo does not fail your build and it does not
fail at startup — it throws the first time that line of code executes, which may be on a
seasonal report nobody runs until December. Moving the name into the type system converts a
late runtime exception into a compile error, which is the only place a string-keyed
configuration mistake should ever be allowed to surface.

**★ How would you use a profile to fix an N+1 without changing any query?**
Add `@FetchProfileOverride(profile = X_.PROFILE_Y, mode = JOIN)` to the offending
association, then enable the profile on the session — or, better, pass the generated
`EnabledFetchProfile` as a `FindOption` at the one call site that needs it, which is
covered in the next chunk. The queries are untouched; what changes is the plan the session
uses when it materialises those associations. That is genuinely useful when the call site
is a derived repository method whose query text you cannot edit, and it is genuinely
dangerous when you enable it broadly, because a session-wide switch is a session-wide
switch.

**★ A profile and a named entity graph are both named and both declared on an entity. What is
actually different about them?**
Scope and rooting. A named entity graph is rooted at a type — it describes a plan *for loading a
`Book`* and means nothing outside a load of that type, and it is passed to one operation. A fetch
profile is a global name with session scope: the documentation says it "isn't 'rooted' at any
particular entity", so enabling it changes fetching for every association anywhere in the model
that names that profile, for every operation until it is disabled. There is also a capability
difference — a profile can request `SUBSELECT` and a graph cannot — and a precedence rule, since a
graph wins when both apply.

**★ Does `@FetchProfileOverride` have to be on an entity that declares the profile?**
No, and that is a direct consequence of profiles not being rooted. The introduction's own example
puts `@FetchProfile(name = "EagerBook")` on `Book` and then an override for that profile on
`Author.person`, where `Author` declares no profile at all. The declaration and the overrides are
matched by name across the whole model. This is convenient for building a deep plan and it is the
reason a profile's reach is easy to underestimate — you cannot see everything a profile does by
reading the class it was declared on.

**★ A filter enables one fetch profile for every request. What goes wrong?**
Everything the profile touches becomes eager for every operation in every request, including the
count queries, the existence checks and the writes — none of which wanted it, and none of which
can decline, because a session-wide switch has no per-call opt-out. It is `EAGER` reimplemented at
the session level, with the extra property that it is invisible from the mapping: a reader of the
entity sees `fetch = LAZY` and a `@FetchProfileOverride` that looks conditional. If a plan really
should apply to everything, that is a statement about the mapping and belongs there; if it applies
to some calls, it belongs on those calls.

---

← Prev: [12d · The entity was never the model](12d-the-entity-was-never-the-model.md) · Index: [08 · The N+1 problem](README.md) · Next → [13b · Enabling a profile](13b-enabling-and-the-default-profile.md)
