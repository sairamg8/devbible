---
title: "When the domain type is a record: there are no setters to abuse and no field initializers to forget, the canonical constructor is positional and therefore silently reorderable, and JDK 25 still has no language-level `with` — so the builder earns its place for different reasons"
sidebar_label: "02d · Builders and records"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25** language rules for records (a record may not
> declare instance fields or instance initializers; the canonical constructor and the compact
> form; implicit `equals`/`hashCode`/`toString`), **JEP 468 · Derived Record Creation
> (Preview)** — 🔴 still at status **Candidate** and **not delivered in JDK 23, 24 or 25**,
> per [openjdk.org/jeps/468](https://openjdk.org/jeps/468) and the JDK 25 feature list — and
> the **AssertJ 3.27.7** documentation for `usingRecursiveComparison`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output from a suite.

**A record removes two of the hazards from [02b](02b-builder-design-rules.md) for free: there
are no setters, so a shared instance cannot be mutated out from under another test, and there
are no field initializers, so Lombok's `@Builder.Default` trap has nothing to attach to. It also
adds one the class version did not have — a positional canonical constructor, where swapping two
arguments of the same type compiles and passes review — and it leaves you with no language-level
copy-with-changes, because JEP 468 is still a Candidate and is not in JDK 25. On balance the
builder is *more* useful for records, not less.**

## What a record changes

```java
public record Customer(
        CustomerId id,
        String email,
        String firstName,
        String lastName,
        LoyaltyTier tier,
        CustomerStatus status,
        Address address) {

    public Customer {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("email");
        }
    }
}
```

Three consequences follow directly, and they matter to fixtures.

**Immutability is free, so the worst fixture bug is gone.** The
`private static final Customer GOLD` from
[01b · What the fix is not](01b-what-the-fix-is-not.md) is *safe* here, because nothing can
mutate it. Sharing an immutable value across a suite is fine. (The caveat is depth: a record
holding a mutable `List` is not immutable, and a shared instance is back to being dangerous.)

**The compact constructor runs on every construction, so a builder cannot bypass validation.**
Rule 4 in [02b](02b-builder-design-rules.md) — build through production's own doors — is
enforced by the language rather than by discipline. There is no field-assignment route past the
compact constructor short of reflection.

**There are no instance field initializers to defer to.** A record may not declare instance
fields beyond its components, so there is no `private LoyaltyTier tier = BRONZE;` to write, and
consequently nothing for Lombok's `@Builder.Default` to honour or ignore. The defaults have to
live in the builder — which is precisely where a test data builder wants them anyway.

## The hazard a record introduces: the positional constructor

```java
new Customer(id, "a@example.com", "Ada", "Lovelace", GOLD, ACTIVE, address);
```

Seven components, two of which are `String` and adjacent. Swap `firstName` and `lastName` and
the code compiles, the test passes, and nothing anywhere says the names are the wrong way round
until a report shows "Lovelace Ada". Adding an eighth component in the middle silently changes
the meaning of every call site that happens to type-check.

This is the strongest argument for a builder over "records are simple enough to construct
inline": the builder converts positional arguments into named ones, and a named argument cannot
be transposed.

```java
Customer c = aCustomer().firstName("Ada").lastName("Lovelace").gold().build();
```

⚠️ The same hazard applies to the *builder's own* `build()` method — it calls the canonical
constructor positionally, so the transposition risk is not eliminated, it is **centralised** to
one line that is written once and read often. That is a real improvement and it is worth being
honest that it is not a proof.

## Copy-with-changes: you have to write it

Java has no `with` expression for records in JDK 25. JEP 468 · *Derived Record Creation*, which
would give you `customer with { status = SUSPENDED; }`, is still at **Candidate** status and has
not shipped in a preview through JDK 25. So the three options are all hand-written:

**A `with`-style method on the record**, which is fine for one or two components and does not
scale, since each one repeats the whole component list:

```java
public Customer withStatus(CustomerStatus status) {
    return new Customer(id, email, firstName, lastName, tier, status, address);
}
```

**A `from` on the builder**, which is the version that scales and is the one to prefer in tests:

```java
public static CustomerBuilder from(Customer c) {
    return aCustomer()
            .withId(c.id()).withEmail(c.email())
            .firstName(c.firstName()).lastName(c.lastName())
            .withTier(c.tier()).withStatus(c.status()).withAddress(c.address());
}
```

```java
Customer suspended = CustomerBuilder.from(original).suspended().build();
```

**Lombok's `@Builder(toBuilder = true)` on the record**, which generates the equivalent — with
the shallow-copy caveat from [02b](02b-builder-design-rules.md) intact, since a record component
holding a mutable object is copied by reference like any other.

⚠️ The `from` method has the same silent-omission hazard as `but()`: nothing checks that it
covers every component, and a component it forgets is reset to the builder's default in every
copy. With a record you have one cheap guard the class version does not offer — write `from` by
destructuring in a record pattern, so that adding a component makes the pattern fail to compile
rather than silently drop a value.

## Assertions change too, and mostly for the better

A record's `equals` compares components, so whole-object assertions become meaningful:

```java
assertThat(service.register(form)).isEqualTo(
        aCustomer().withEmail("a@example.com").firstName("Ada").build());
```

This is genuinely useful and it sharpens the gotcha from [02](02-the-builder.md) about comparing
the code to itself: if the expected object is built by the same builder the production path
effectively uses, the assertion can pass while both are wrong. Two mitigations, in order of
preference:

- assert on the components the behaviour is about, not the whole record;
- when the whole object really is the subject, use AssertJ's
  `usingRecursiveComparison().ignoringFields("id", "createdAt")` so the generated and
  time-dependent components do not force you to fabricate them.

⚠️ `isEqualTo` on a record with a `BigDecimal` component is a trap that has nothing to do with
records: `BigDecimal.equals` compares scale, so `2.50` and `2.5` are not equal, and a record's
generated `equals` inherits that. Assertions on money-bearing records should compare with a
type whose equality means what you want, or use AssertJ's recursive comparison with a
`BigDecimal` comparator.

## Where this connects

- The pattern and its readability rules: [02 · The builder](02-the-builder.md); the correctness
  rules: [02b · Builder design rules](02b-builder-design-rules.md); packaging and Lombok:
  [02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md).
- The shared-mutable-fixture bug that records make impossible is in
  [01b · What the fix is not](01b-what-the-fix-is-not.md).
- Records themselves — components, the canonical and compact constructors, what `equals` and
  `hashCode` are generated as, and the immutability caveats — belong to
  [Phase 2 · Records](../../phase-2-classes-objects/08-records/README.md).
- Assertion style, `usingRecursiveComparison` and comparator configuration belong to
  [02 · AssertJ](../02-assertj/README.md).

## Gotchas

**★ A record is only as immutable as its components.**
`record Order(OrderId id, List<OrderLine> lines)` is a record holding a mutable list, and a
`static final` fixture of it is the shared-mutable-state bug again. Copy into `List.copyOf` in
the compact constructor if you want the immutability the type appears to promise — the record
gives you no defensive copying for free.

**★ The canonical constructor is positional, so two same-typed components can be silently transposed.**
`new Customer(id, email, firstName, lastName, …)` compiles identically with the names swapped.
No test fails, no reviewer sees it, and the bug surfaces as data. A builder converts the
positions into names; it does not remove the risk from `build()` itself, but it centralises it
to one line instead of every call site.

**★ Adding a component in the middle changes the meaning of every type-compatible call site.**
The compiler catches call sites whose arity changes, but a record whose new component happens to
match an existing one's type — two `String`s, two `Instant`s — can shift meaning at some call
sites and still compile. Append rather than insert, and prefer a builder so that call sites are
named and unaffected either way.

**★ `@Builder.Default` has nothing to attach to on a record, so record defaults must live in the builder.**
A record may not declare instance fields beyond its components, so the field-initializer
mechanism `@Builder.Default` exists to rescue is not available. This is not a limitation for
test data — the builder is the right home for defaults — but it does mean a plain Lombok
`@Builder` on a record gives you `null`/`0`/`false` for every component the caller omits, with
no way to fix it on the record itself.

**★ JEP 468 is not in JDK 25, so `customer with { … }` does not compile anywhere yet.**
It is still at Candidate status and was not delivered as a preview in JDK 23, 24 or 25. Sample
code and blog posts showing derived record creation are describing a proposal. Every
copy-with-changes in a record-based codebase today is hand-written — a `withX` method, a
builder `from(...)`, or Lombok's `toBuilder`.

**★ A hand-written `from(record)` silently drops components added later.**
Exactly the `but()` hazard from [02b](02b-builder-design-rules.md), and with records there is a
cheap defence the class version lacks: implement `from` using a record pattern that destructures
every component, so adding one makes the pattern fail to compile instead of quietly defaulting.

**★ Whole-record equality assertions make "the test compares the code to itself" easier to write.**
Because `equals` is component-wise and free, `isEqualTo(aCustomer()…build())` is tempting for
every test. When the expected object is assembled by the same logic the production path uses,
the assertion holds regardless of whether either is right. Assert the components the behaviour
is about, or use a recursive comparison that ignores the generated ones.

**★ `BigDecimal` components make `equals` scale-sensitive, and records inherit that.**
A record's generated `equals` calls `BigDecimal.equals`, which distinguishes `2.50` from `2.5`.
An assertion that fails with two apparently identical amounts is almost always this. Compare
with a money type whose equality is value-based, or configure a `BigDecimal` comparator in
AssertJ's recursive comparison.

**★ Records make the "no ids until persisted" question sharper, not softer.**
You cannot leave a component unset and fill it in after `save()`, so a record-based entity has
to decide up front whether its id component is nullable or whether an unsaved instance is a
different type entirely. Whichever the codebase chose, the builder must be able to express both
states — a `withPersistedId(...)` and a genuinely absent id — or tests cannot describe the
pre-save world at all.

## Interview questions

**★ Do you still need a test data builder if the domain is all records?**
Yes, and arguably more. Records remove two fixture hazards — no setters, so a shared instance
cannot be mutated; and no instance field initializers, so Lombok's `@Builder.Default` trap does
not arise — but they introduce a positional canonical constructor where two same-typed
components can be transposed with no compile error and no test failure. A builder turns those
positions into names. It also supplies the defaults, which a record cannot hold itself, and it
supplies copy-with-changes, which the language still does not provide.

**★ How do you express "the same record but with one field changed"?**
By hand, because JDK 25 has no language feature for it: JEP 468 · Derived Record Creation is
still at Candidate status and has not shipped even as a preview. The options are a `withX`
method on the record (fine for one or two components, poor beyond that because each repeats the
full component list), a `from(record)` factory on the test builder followed by the override you
want, or Lombok's `@Builder(toBuilder = true)`. The `from` version scales best in tests; its
hazard is that nothing forces it to cover every component, which you can defend against by
destructuring with a record pattern so a new component breaks the compile.

**★ Are records automatically safe to share as `static final` fixtures?**
Only as deep as their components. A record of value types is genuinely immutable and safe to
share across the whole suite. A record holding a `List`, a `Map`, a `Date` or a mutable entity
is not: the reference is final, the contents are not, and you are back to the order-dependent
failure that shared fixtures cause. If you want the guarantee the type appears to make, copy
collections in the compact constructor — a record does no defensive copying for you.

**★ A record component is a `BigDecimal` and your equality assertion fails on two amounts that look identical. What is happening?**
`BigDecimal.equals` compares scale as well as value, so `2.50` and `2.5` are unequal, and a
record's generated `equals` delegates to it component by component. The assertion is correct and
the expectation is wrong about what equality means. Fix it by comparing with `compareTo`
semantics — a money value object that normalises scale, or AssertJ's recursive comparison with a
comparator registered for `BigDecimal` — rather than by adjusting the literal in the test until
it passes, which encodes the scale into the test as an accident.

**★ What is the risk of asserting whole-record equality against a builder-produced expected value?**
That the test compares the code to itself. If the expected record is assembled by the same
builder — and by extension the same assumptions — that the production path uses, the assertion
passes whether or not either is correct, and it will keep passing through a change that breaks
both. Whole-object equality is genuinely valuable for records and worth using; the discipline is
to reserve it for cases where the entire object is the subject of the behaviour, and otherwise
to assert the specific components the behaviour is about.

{/* FOOTER */}
