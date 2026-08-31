---
title: "The three rules that decide whether a builder stays correct as the code moves: build through production's own doors, let builders compose with builders, and model copy-with-changes explicitly instead of relying on builder aliasing"
sidebar_label: "02b · Builder design rules"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Project Lombok** `@Builder` feature documentation
> ([projectlombok.org/features/Builder](https://projectlombok.org/features/Builder)) for what
> `toBuilder()` produces, and the **JUnit Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for lifecycle.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output from a suite.

**[Chunk 02](02-the-builder.md) established the pattern and the three rules that make a builder
readable. This chunk is about the three that make it *stay* correct as the codebase moves: what
`build()` is allowed to do, how a builder composes with other builders, and what
copy-with-changes should mean — because the default answer, reusing a builder instance, is
aliasing that nothing in the source declares.**

## Rule 4 · `build()` goes through the same doors production uses

If production creates a customer through `Customer.register(...)`, the builder calls
`Customer.register(...)`. If it goes through a constructor that validates, the builder uses that
constructor. What a builder must **not** do is reach past the type's own rules — reflection,
package-private setters added "for tests", or field pokes.

The reason is not purity. A builder that bypasses invariants can produce an object that
production can never produce, and then:

- a test passes for a state that cannot occur, so it proves nothing about the system, and
- when someone tightens the invariant, the *tests* keep passing, because they never went
  through the check.

The second one is the expensive failure: the safety net stops noticing the thing it exists to
notice, and nothing goes red to tell you.

⚠️ There is one honest exception — an object that only exists in a persisted form, where
production gets its id from the database. A builder often needs to fabricate an id so the object
can be used in a map or compared. Make that explicit with a method named for what it is
(`withPersistedId(42L)`), rather than making an id part of the silent default, so that a test
which depends on an id being present has to say so. In JPA this distinction is load-bearing:
"not yet persisted" and "persisted with id 42" are different states with different behaviour on
`merge`, on `equals`, and in a `HashSet`.

## Rule 5 · Builders take builders, not just built objects

```java
public OrderBuilder forCustomer(CustomerBuilder customer) {
    this.customer = customer.build();
    return this;
}

public OrderBuilder forCustomer(Customer customer) {
    this.customer = customer;
    return this;
}
```

Accepting the *builder* is what makes `anOrder().forCustomer(aCustomer().gold())` read as one
sentence. The overload taking the built type covers the case where a test already holds a
`Customer` it wants to reuse.

⚠️ The two overloads are not stylistic variants — they express different scenarios. Passing a
builder gives each order its **own** customer; passing an object gives two orders **the same**
customer. "Two orders for the same customer" and "two orders for two identical customers" behave
differently the moment the domain type compares by identity, or the moment a test asserts on
`customer.getOrders()`. Choose deliberately.

## Rule 6 · Model copy-with-changes explicitly, or not at all

A builder instance is mutable and reusable, which is convenient and occasionally surprising:

```java
CustomerBuilder b = aCustomer().gold();
Customer a = b.build();
Customer c = b.withEmail("other@example.com").build();   // ⚠️ also gold
```

If a test wants "the same customer but suspended", give it a real operation rather than letting
it depend on builder aliasing. Two forms are common:

```java
// on the builder: a fresh builder with the same state
public CustomerBuilder but() {
    return aCustomer().withEmail(email).withTier(tier).withStatus(status).withAddress(address);
}
```

```java
// on the built object, Lombok-generated: @Builder(toBuilder = true)
Customer suspended = original.toBuilder().status(SUSPENDED).build();
```

Lombok's documentation describes `toBuilder()` as producing a builder initialised with the
current object's values, giving you a **shallow** copy. Shallow is the word to hold on to: the
copy shares every mutable sub-object with the original, so `original.toBuilder().build()` gives
you two customers pointing at one `Address`. For value-typed graphs that is fine; for entities
it is another way to get aliasing you did not ask for.

⚠️ A hand-written `but()` has a maintenance hazard of its own: it must be updated when a field
is added, and nothing enforces that. A field that `but()` forgets is silently reset to the
default in every copy — a bug that only shows up in the one test that copies. If you write
`but()`, write it as the *only* way the builder copies itself, and keep it directly beneath the
field list where an added field is visibly missing.

## Where this connects

- The pattern and its three readability rules are in [02 · The builder](02-the-builder.md).
- Where the builder class lives in a multi-module build, and what Lombok's `@Builder` does to
  your defaults, are in
  [02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md).
- What changes when the domain type is a `record` — no setters, and `with`-style copying — is
  in [02d · Builders and records](02d-builders-and-records.md).
- The shared-mutable-fixture failure these rules keep away from is in
  [01b · What the fix is not](01b-what-the-fix-is-not.md).
- When the reusable unit is a scenario spanning several objects, the pattern is
  **03 · Object mothers** *(not written yet)*.

## Gotchas

**★ A builder that only has `withX` setters is a constructor with more typing.**
If every method mirrors a field and no method names a situation, the builder has added
ceremony and removed nothing: the test still spells out ten values, just fluently. The value
comes from defaults the test does not state plus concepts the test does state; a builder with
neither is worse than the constructor it replaced.

**★ Builders that bypass validation quietly disable the validation for the whole suite.**
Reaching past a factory method into raw field assignment gives the builder more power than
production has. The system then has a class of state that only tests can produce, and a later
tightening of the invariant will not turn any test red — because none of them ever went through
the check. Build through production's own doors.

**★ Reusing one builder instance for two objects carries the first object's overrides into the second.**
`CustomerBuilder b = aCustomer().gold(); b.build(); b.withEmail("x").build();` produces two gold
customers, which is usually intended and occasionally a nasty surprise inside a loop. If you
want independence, call the static factory again; if you want copy-with-changes, use an explicit
`but()` or `toBuilder()` so the intent is in the source.

**★ `toBuilder()` gives you a shallow copy, and shallow means shared sub-objects.**
Lombok describes it as a builder initialised from the current instance. Every mutable field is
copied by reference, so a "copy" of an order shares its line list with the original, and a
mutation through one is visible through the other. For entity graphs that is aliasing you did
not ask for; copy the parts you intend to vary.

**★ A hand-written `but()` silently drops any field added after it was written.**
Nothing checks that `but()` covers every field, so a new field is reset to its default in every
copy — visible only in the tests that copy, and only if they happen to assert on that field.
Keep `but()` adjacent to the field declarations so an omission is visible, and treat adding a
field to the builder as a two-line change.

## Interview questions

**★ Your builder needs to set an id, but production gets ids from the database. What do you do?**
Expose it as a method that says what it is — `withPersistedId(42L)` — rather than baking an id
into the defaults. A test that depends on the object having an id then has to say so, and a test
that does not gets an object in the state production would have before a save. Always setting an
id is the thing to avoid, because then no test can express "not yet persisted", which under JPA
is a genuinely different state: it changes what `persist` versus `merge` does, and it changes
`equals`/`hashCode` behaviour for entities keyed on the id, which in turn changes what happens
when you put them in a `HashSet`.

**★ Is there a risk in a builder that produces objects production cannot?**
Yes, and it is the main risk of the pattern. A builder that assigns fields directly, bypassing a
validating factory, can create states the system can never reach. Tests then verify behaviour
for impossible inputs — at best wasted, at worst misleading — and, worse, tightening the
invariant later turns nothing red, because no test ever went through the check. Building via the
same constructor or factory production uses keeps the builder honest and makes tests inherit
validation changes for free.

**★ How should a test express "the same customer, but suspended"?**
With an explicit copy operation, not by reusing a builder instance and hoping. Either a `but()`
method that returns a fresh builder carrying the current state, or Lombok's
`@Builder(toBuilder = true)` giving `original.toBuilder().status(SUSPENDED).build()`. Both have
a catch worth stating: `toBuilder()` is a shallow copy, so mutable sub-objects are shared with
the original; and a hand-written `but()` silently drops fields added after it was written. The
thing to avoid is depending on builder aliasing — `b.build()` then `b.withX().build()` — because
the second object inherits the first's overrides invisibly.

**★ When is a builder the wrong tool?**
When the repetition is in the *cases* rather than the objects — twelve tax bands differing only
in two numbers is `@ParameterizedTest` with a table, not twelve builder calls. When the reusable
unit is a whole *scenario* spanning several objects — a customer with three unpaid invoices and
a suspended card — an object mother naming that scenario reads better than three builders wired
together in every test. And when the object is a two-field record whose constructor is already
self-explanatory, a builder is pure ceremony.

{/* FOOTER */}
