---
title: "Enhancement intercepts the field, not the getter, which quietly promotes every method your entity declares — toString, equals, hashCode, a derived getter and the JPA lifecycle callbacks — into code that can issue a query or throw"
sidebar_label: "08c3 · The entity's own methods"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM `7.4` branch source of
> `org.hibernate.bytecode.enhance.internal.bytebuddy.PersistentAttributeTransformer`,
> `FieldReaderAppender` and `FieldAccessEnhancer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/bytecode/enhance/internal/bytebuddy/PersistentAttributeTransformer.java)),
> the Hibernate ORM 7.4 *Introduction* §9.15 *Using the bytecode enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> and the Jakarta Persistence 3.2 `ValidationMode` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/validationmode)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Everywhere else in this topic the code that triggers a lazy fetch is code outside the entity: a
serialiser, a mapper, a template, a log statement. Enhancement adds a set of callers that live
*inside* the class, because `PersistentAttributeTransformer` rewrites field access in the
entity's own declared methods. `this.fullText` in your own `toString()` is not a field read any
more. This chunk is which of your methods that promotes, which one it leaves alone, and why the
distinction is not the one people guess.**

## Where the rewrite lands

`PersistentAttributeTransformer` is a method visitor. It walks the methods the entity class
declares — filtering out only the ones Hibernate generated, matched by
`not(nameStartsWith("$$_hibernate_"))` — and for each `GETFIELD` on a persistent field it
substitutes `INVOKEVIRTUAL $$_hibernate_read_<name>()`, and for each `PUTFIELD` it substitutes
`$$_hibernate_write_<name>(…)`.

Three things follow, and only the first is obvious:

- **A getter is not special.** It is rewritten because it contains a `getfield`, not because it is
  named `getFullText`.
- **A method with no getter behind it is rewritten identically.** `toString`, `equals`,
  `hashCode`, a `summary()` helper, a `@PostLoad` callback — anything in the class that reads the
  field.
- **A method in a *different* class that reads the field directly is not rewritten.** That is
  *extended* enhancement, handled by a separate visitor (`FieldAccessEnhancer`), off by default and
  deprecated for removal. The documentation's replacement advice is *"use proper object-oriented
  encapsulation, exposing managed state via getters and setters"* — see
  [Topic 08 · 13d](../08-the-n-plus-1-problem/13d-lazy-groups.md).

So the review question "does this method call the lazy getter" is the wrong one twice over: a
method that never calls the getter can still fetch, and a class outside the entity that reads the
field can silently not fetch.

## `toString`

```java
@Entity
class Book {
    @Id Long id;
    String title;

    @Basic(fetch = FetchType.LAZY)
    @Column(length = Length.LONG32)
    String fullText;

    @Override
    public String toString() {
        return "Book[" + id + ", " + title + ", " + fullText.length() + " chars]";
    }
}
```

Before enhancement that `toString()` is a pure memory read on any instance in any state. After
enhancement it is a `select` on a managed instance and a `LazyInitializationException` on a
detached one.

The reason it matters out of proportion to how trivial it looks is that `toString()` is invoked
by code you did not write:

- a log statement — `log.debug("loaded {}", book)` — which makes the failure depend on the log
  level, exactly as [02c · The mapper and the logger](02c-the-mapper-and-the-logger.md) describes
  for associations;
- a debugger's variable pane, which is why the bug disappears when you step through it;
- an assertion failure message in a test, so the test that was going to tell you what broke throws
  something else instead;
- the message of another exception that interpolates the entity — **which means an unrelated
  production failure can be replaced by a `LazyInitializationException` from the code that was
  trying to report it.**

That last one is the reason to care. Losing the original error is worse than the lazy fetch.

## `equals` and `hashCode`

Worse than `toString`, because the callers are the collections framework rather than your code.

**The association case — a `hashCode()` that dereferences a lazy `@ManyToOne`, turning a working
fetch join into a query per element as a `Set` is populated — is argued in full in
[Topic 08 · 4e · Lazy columns and hashCode](../08-the-n-plus-1-problem/04e-lazy-columns-and-hashcode.md).**
Do not re-derive it. What enhancement adds is that the identical failure now arrives from a plain
column, with no association anywhere in sight:

```java
@Data                       // Lombok: equals and hashCode over every field
@Entity
class Book {
    @Id Long id;
    String title;
    @Basic(fetch = FetchType.LAZY) String fullText;    // now part of equals()
}
```

`new HashSet<>(books)` after the transaction closed throws. `books.stream().distinct()` throws.
A `Map<Book, X>` throws. And the diff that caused it added `fetch = FetchType.LAZY` to one field,
in a class whose `equals` nobody has looked at since it was generated.

Those two chunks arrive from different directions at one rule:
**`equals`, `hashCode` and `toString` must read only attributes that are certain to be loaded** —
in practice an immutable business key, never an association, and now never a lazy column either.
The same rule stated for associations is
[Topic 07 · 15 · equals, hashCode and toString](../07-relationships-fetch/15-equals-hashcode-tostring.md),
and the identity argument behind it is
[Topic 06 · 10 · equals and hashCode](../06-jpa-hibernate-model/10-equals-and-hashcode.md).

## Derived getters and lifecycle callbacks

Two more categories that are easy to miss because neither reads like a database call.

**A derived accessor.** `public int wordCount() { return fullText.split("\\s+").length; }` is a
computation over a field, and after enhancement it is a `select` followed by a computation. If
something calls it while mapping to a DTO — which is precisely the mapping code
[05b](05b-mapping-to-a-dto.md) recommends — it fetches the column the mapping was written to
avoid.

**A `@PostLoad` callback that touches the lazy field defeats the feature entirely.** The callback
runs on the managed instance with the session open, so it does not throw; it simply fetches the
lazy group on every single load, which is the eager behaviour you removed the annotation to get
rid of, now costing an extra round trip per instance instead of a wider select. **This is the
worst possible outcome and it produces no error at all.**

**A constraint on the lazy attribute is read at flush.** Jakarta Persistence's default validation
mode is `AUTO`, defined as: *"If a Bean Validation provider is present in the environment, the
persistence provider must perform the automatic validation of entities."* That validation happens
on the pre-persist and pre-update lifecycle events, and to check `@Size(max = 1_000_000)` on
`fullText` the validator has to read `fullText`. Under enhancement that read is a fetch, on the
update path, for a column you never intended to load. ⚠️ I could not find a statement in the
Hibernate 7.4 documentation confirming whether the integration skips uninitialised lazy attributes
during automatic validation, so treat this as a thing to verify against your own SQL rather than a
settled fact — but a constraint annotation on a lazy column is worth a second look either way.

## The constructor is the one place that is safe

A constructor is a declared method, so its field writes are rewritten too. They are harmless,
because Hibernate has not set the interceptor at that point — the generated accessor's null check
short-circuits and the write lands directly on the field. The same holds for every instance you
build yourself with `new`, at any point in its life, until Hibernate takes ownership of it.

**So "does this method touch a lazy field" is the wrong review question; "can this method run on
an instance Hibernate created" is the right one.** A constructor never can. `toString` always can.

## Gotchas

**★ `toString()` became a database call.** On a managed instance it issues a `select`; on a
detached one it throws — from inside a log statement, a debugger, or the message of another
exception. An entity whose `toString` reads a lazy column can turn an unrelated failure into a
`LazyInitializationException` that hides it.

**★ A Lombok-generated `equals`/`hashCode` now includes the lazy column.** `@Data` and
`@EqualsAndHashCode` cover every field unless excluded. Adding `@Basic(fetch = LAZY)` to a field
of a Lombok entity, in a module where enhancement runs, makes every hash-based operation on that
entity a potential fetch and every one performed after detachment a potential exception. Lombok's
`@ToString` has the same problem one method over.

**★ The failure is field-based, so removing the getter does not help.** Interception is on
`getfield`, not on the accessor. Reading the field from another class still does not go through
the interceptor — that is *extended* enhancement, deprecated for removal
([Topic 08 · 13d](../08-the-n-plus-1-problem/13d-lazy-groups.md)) — and reading it from inside the
entity does, whether or not a getter exists.

**★ A `@PostLoad` that touches a lazy attribute silently un-lazies it, forever, on every load.**
No exception, no warning, and the statement count goes up rather than down. This is the one
failure on this page that never surfaces as an error, and the only way to see it is in the SQL.

**★ The identifier field is excluded from interception, and nothing else is.** Reading the id
inside `equals` is free; reading anything else is not. That asymmetry is why "use the id in
`equals`" survives enhancement while "use the fields" does not — although the id has its own
problem before flush ([Topic 06 · 10b](../06-jpa-hibernate-model/10b-fixing-entity-equality.md)).

**★ Enhancement changes what a code review has to look at.** Before it, the dangerous methods
were the ones that dereferenced an association. After it, any method of the entity that reads any
lazy attribute is dangerous, and that includes methods that look like pure computation over
strings and numbers.

## Interview questions

**★ Why does the entity's own `toString()` matter more after enhancement than before?**
Because interception happens at the field, and the enhancer rewrites field access inside the
entity's own declared methods. `this.fullText` in `toString()` compiles to a `getfield` that the
enhancer replaces with a call to a generated reader, so `toString()` becomes a fetch on a managed
instance and an exception on a detached one. That matters disproportionately because `toString()`
is invoked by code you did not write — a log statement, a debugger, a test assertion message, the
interpolation of the entity into another exception's message — so the failure appears in places
that have nothing to do with the feature, and can hide the original error it was called to report.

**★ If interception is on field access, why doesn't the constructor blow up?**
Because the check in the generated accessor is `if (interceptor != null)`, and during construction
Hibernate has not set the interceptor yet. Field writes in a constructor go through the generated
writer, find a null interceptor, and fall through to the plain field. The same is true of any
object you create with `new`. That is also why unit tests that build entities by hand never see
any of this — enhancement is only live on instances that came out of a session — and why the
useful review question about a method is not "does it touch a lazy field" but "can it be called on
an instance Hibernate created".

**★ Someone proposes removing the getter and reading the field directly from the mapper, to avoid
the fetch. Does that work?**
No, in both directions. If the mapper is a different class then reading the entity's field
directly is exactly what *extended* enhancement exists for, and extended enhancement is deprecated
for removal — the documentation's replacement advice is to expose state through getters, the
opposite of the proposal. And if the mapper is the entity itself, or an inner class the enhancer
processed, the field read is rewritten anyway. Interception is on `getfield`, so hiding the
accessor changes nothing except the readability of the code. If the goal is genuinely "produce
this DTO without reading that column", the answer is a projection that never selects it
([08b](08b-the-lob-reflex-and-the-group.md)).

**★ Your lazy column is enhanced and correctly mapped, and the SQL still reads it on every load.
The session is open the whole time, so nothing throws. Where do you look?**
At code that runs on every load and touches the field, in this order. A `@PostLoad` callback in
the entity or an entity listener. A `toString` called by a log line that is enabled in that
environment. An `equals`/`hashCode` over all fields, combined with anything that puts the entity
into a hash-based collection — including `Collectors.toSet()` and `distinct()`. A Bean Validation
constraint on the attribute, since automatic validation is on by default when a provider is
present and validating the value requires reading it. And finally the lazy group: another lazy
attribute in the same default group being read is indistinguishable from this one being read
([08b](08b-the-lob-reflex-and-the-group.md)).

**★ How does this change what you look for when reviewing an entity class?**
Before enhancement I would read an entity's methods for one thing: does anything dereference an
association. After enhancement the surface is larger and less obvious, because a method that only
manipulates a `String` can now be a query. The three methods worth reading every time are
`toString`, `equals` and `hashCode`, because their callers are frameworks rather than application
code; after those, any `@PostLoad` or `@PreUpdate` callback, because they run on every load or
every flush; and then any derived accessor that a mapper might call. The single-line version is
that `equals`, `hashCode` and `toString` may read the identifier and an immutable business key and
nothing else — a rule that was already right for associations and is now load-bearing for columns
too.

**Enhancement's effect on the rest of the object — associations that stop being proxies,
serialisation, and where the enhancer does and does not apply — continues in
[08c4 · The enhanced instance](08c4-the-enhanced-instance.md).**

{/* FOOTER */}
