---
title: "Generated data earns its place in exactly one region of a fixture — the fields nobody asserts on — and every failure mode of Datafaker traces back to a value that escaped that region into an assertion, a validator or a golden file"
sidebar_label: "07 · Faker and generated data"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Datafaker documentation — *Getting started*
> ([datafaker.net](https://www.datafaker.net/documentation/getting-started/)) and *Basic
> usage* ([datafaker.net](https://www.datafaker.net/documentation/usage/)). The coordinates
> shown on the *Getting started* page at the time of writing are `net.datafaker:datafaker:2.7.0`;
> **check the current version before copying it**, and note that Datafaker is not managed by
> `spring-boot-dependencies`, so no version comes from the Boot BOM. Version spine from
> `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit
> Jupiter 6.0.3, AssertJ 3.27.7. **No sandbox** — Java source and documented behaviour only,
> never a run, and no example output is reproduced from any generator.

**A test fixture has two regions. There are the fields the test is about, which must be
literal, and the fields that exist only because the constructor demands them, which must be
*obviously* irrelevant. Generated data is a tool for the second region and a hazard in the
first, and every argument about Faker — is it good, is it bad, does it cause flaky tests —
collapses once you hold that line. This chunk makes the two-sided case: the four jobs
generated data genuinely does better than a literal, the five ways it destroys a suite, and
the single rule that separates them.**

## What Datafaker is, and where it came from

> *"Datafaker is a library for Java and Kotlin to generate fake data. This can be very helpful
> when generating test data to fill a database, to generate data for a stress test, or
> anonymize data from production services."*

It is the maintained successor to JavaFaker; the artifact is `net.datafaker:datafaker`. Usage
is what you would guess:

```java
Faker faker = new Faker();

String name          = faker.name().fullName();
String firstName     = faker.name().firstName();
String streetAddress = faker.address().streetAddress();
```

Locales are constructor arguments — `new Faker(new Locale("nl"))` — and the documentation's
advice for mixing them is blunt: *"the easiest way to do so is to create a Faker per locale, and
mix between those fakers."* Seeding exists and is
[07b](07b-the-seed-discipline.md)'s entire subject.

That is the whole API surface you need. The rest of this page is about *where* to point it.

## Where generated data genuinely helps

### 1 · Filling the tier-2 fields nobody asserts on

[01](01-the-forty-line-setup.md) is about a setup block where the field the test is actually
about is buried among fifteen that exist only to satisfy a constructor. A builder
([02](02-the-builder.md)) fixes half of that by defaulting them. Generation fixes the other
half: it makes the defaults *visibly* arbitrary.

```java
private static final Faker FAKER = new Faker();          // see 07b on where this should live

static CustomerBuilder aCustomer() {
    return new CustomerBuilder()
        .name(FAKER.name().fullName())              // nobody asserts on this
        .addressLine(FAKER.address().streetAddress())
        .phone(FAKER.phoneNumber().phoneNumber())
        .status(ACTIVE);                            // ← the one that matters, and it is literal
}
```

A reader scanning that builder can tell at a glance which field carries meaning: three of them
came out of a generator, so no test can be depending on their values, and the fourth was chosen.
A literal `"Test User"` does not carry that signal — it looks equally deliberate.

### 2 · Smoking out accidental dependencies on a specific literal

This is the strongest argument and the least often made. A test that passes only because the
name happened to be `"Test User"` — a substring match, a length assumption, a `split(" ")` that
assumes exactly two words, a case-insensitive compare that works only for ASCII — is a test
carrying a hidden assumption. Vary the value and the assumption fails, loudly, once.

That is a real class of bug: address parsers that assume a comma, name splitters that assume two
tokens, validators that were only ever fed `"a@b.com"`. Generated data finds them because it
supplies the shapes a human fixture author never thinks to type.

⚠️ It finds them **non-deterministically**, which is the same property that makes it dangerous.
[07b](07b-the-seed-discipline.md) is about what you owe the next person when it does.

### 3 · Volume

A fixture of 10,000 rows for a pagination, index or batch-size test is not something you write
by hand, and 10,000 copies of `"Test User"` are a *worse* fixture than 10,000 generated names —
identical values collapse cardinality, so an index behaves differently, `DISTINCT` behaves
differently and the plan is not the plan production would use. Generated data is the honest
choice here precisely because the *distribution* is part of what is under test.

### 4 · Demo and anonymised data

Realistic-looking, PII-free data for a demo environment, a screenshot, or a load test against a
staging system. The documentation names this use case explicitly — *"anonymize data from
production services"* — and it is the one place where the generator's realism is the point
rather than a side effect.

## Where it destroys you

### 1 · Assertions written against generated values

```java
Customer c = aCustomer().build();
repository.save(c);

assertThat(repository.findById(c.id()).orElseThrow().name())
    .isEqualTo(c.name());              // circular: both sides came from the same generated value
```

That assertion is true no matter what `save` and `findById` do to the name — truncate it,
trim it, upper-case it, drop it and return the input object from a cache. It compares the fixture
to itself. The rule at the end of this page exists to make this impossible to write by accident.

### 2 · A value the validator rejects, occasionally

A name generator will eventually produce an apostrophe (`O'Brien`), a hyphen, a non-ASCII
character, a 32-character surname, or — in some locales — a very short or unusually formatted
value. If the entity is `@Size(max = 30)`, or the column is `varchar(20)`, or a regex validator
insists on `[A-Za-z ]+`, the test fails on maybe one run in fifty, in a place unrelated to what
the test is about.

Two responses, and only one of them is right:

- ❌ Widen the constraint so the generated value fits. You have just let a test tool change
  production validation.
- ✅ Constrain the *generator* to the domain: pick from a fixed list, use a narrower generator, or
  post-process. If the constraint is genuinely wrong, that is a separate decision made on its own
  merits.

### 3 · A failure you cannot reproduce

The generated input is not in the report. You get an assertion diff and no way to reconstruct
what was fed in, which is the worst debugging position there is — worse than a deterministic
failure and worse than no test. This is the failure mode that gives generated data its bad
reputation, and it is entirely preventable: [07b](07b-the-seed-discipline.md) is about printing
the seed.

### 4 · Generated data in a snapshot or golden-file test

A snapshot test compares output against a recorded file. Feed it generated data and the
comparison fails on the first run after recording — every run produces a different name, so the
recorded file is wrong immediately. Teams then "fix" it by seeding the generator, at which point
the snapshot contains a list of names that look meaningful, are not, and will change wholesale
the day the library's algorithm changes.

**Golden files take literals. Always.** The whole value of a golden file is that a human can read
the diff and say "yes, that change was intended", and nobody can say that about `Jaquelyn Hessel`
becoming `Marisol Kertzmann`.

### 5 · The generated value that quietly becomes an identifier

A generated email or username used as a lookup key works until two rows collide, which happens
sooner than intuition suggests over a suite of thousands of tests sharing a schema. The
documentation's seeding section does not promise uniqueness, and no name generator can — the
value space is a list. If a field must be unique per test, generate it from something that *is*
unique (a `UUID`, a counter), not from a name generator.

## The rule

> **Generated data belongs in fields nobody asserts on. Asserted fields are always explicit.**

Read as a review heuristic: for every assertion in the test, trace the expected value back. If it
came out of a generator, either the assertion is circular or the field should have been literal.

```java
@Test
void aSuspendedCustomerCannotOrder() {
    Customer customer = aCustomer()               // name, address, phone: generated, irrelevant
        .status(SUSPENDED)                        // the subject: literal
        .build();

    assertThatThrownBy(() -> orders.place(customer, anOrder()))
        .isInstanceOf(CustomerSuspendedException.class);
}
```

Nothing generated appears in an assertion. The test reads as "a suspended customer", and the
three generated fields say "these do not matter" more convincingly than any literal could.

## Where this connects

- Seeds, reproducibility and what a fixed seed actually buys:
  [07b · The seed discipline](07b-the-seed-discipline.md).
- Generated identifiers, `UUID.randomUUID()` and seeded generators:
  [07c · Generated ids](07c-generated-ids.md).
- The setup this is trying to shrink: [01 · The forty-line setup](01-the-forty-line-setup.md).
- The builder these defaults live in: [02 · The builder](02-the-builder.md).
- Named scenarios, which are the alternative to generating: [03 · Object mothers](03-object-mothers.md).
- Property-based testing, which varies inputs **and** checks invariants rather than examples:
  **10 · Property-based testing** *(not written yet)*, topic 10 of this phase.

## Gotchas

**★ An assertion whose expected value came out of the generator.**
`assertThat(loaded.name()).isEqualTo(saved.name())` compares the fixture to itself and passes
whatever the persistence layer did to the value. Trace every expected value back to its origin;
if it came from a `Faker`, the assertion proves nothing.

**★ A generated value that occasionally violates a constraint.**
Apostrophes, hyphens, non-ASCII characters and 32-character surnames all appear eventually, and
`@Size(max = 30)` or `varchar(20)` then fails one run in fifty. Constrain the generator, not the
production validation — widening a column to fit a test tool is the same defect as rewriting SQL
to fit H2.

**★ Generated data in a snapshot or golden-file test.**
The recorded file is stale on the next run, and seeding to "fix" it produces a golden file full of
names that look meaningful and are not. Golden files take literals, because their entire value is
that a human can read the diff.

**★ A generated email or username used as a lookup key.**
Name generators draw from finite lists and promise nothing about uniqueness, so collisions appear
once a suite is large enough to share a schema — as an intermittent constraint violation in a
test that has nothing to do with names. Derive unique values from a `UUID` or a counter.

**★ `"Test User"` as a default, which reads as deliberate.**
A literal default in a builder looks chosen, so a reader cannot tell whether a test depends on it
— and eventually one does, via a substring match or a two-token split. A generated default carries
the signal "nobody may depend on this" in the code itself.

**★ A new `Faker` per builder call, when the suite also wants reproducibility.**
Each `new Faker()` seeds itself independently, so a suite has as many uncoordinated generators as
it has construction sites and there is no single seed to print or pin. Decide deliberately where
the `Faker` lives ([07b](07b-the-seed-discipline.md)); the default of "wherever it was
convenient" makes the seed discipline impossible later.

**★ Assuming a locale has data for every generator.**
Datafaker's locale support is per-locale data files, and the documentation's own advice for mixing
locales is to keep one `Faker` per locale rather than expecting one to cover everything. A
generator that has no data for a locale is a source of empty or unexpectedly-shaped values, and it
will surface as a validation failure in a test about something else.

**★ Using generation to avoid deciding what the test is about.**
If every field in the fixture is generated, nothing in the setup says what matters, and the reader
is no better off than with the forty-line block from [01](01-the-forty-line-setup.md). Generation
makes the irrelevant fields obviously irrelevant *because* the relevant ones are literal; without
that contrast it communicates nothing.

## Interview questions

**★ When is generated test data a good idea, and when is it not?**
Good for fields nobody asserts on: it fills the tier-2 values a constructor demands and, crucially,
signals in the code that those values are arbitrary, which a literal like `"Test User"` cannot do.
Also good for volume fixtures, where 10,000 identical values would give an index and a query plan
nothing to work with, and for demo or anonymised data, which the library names as a use case. Bad
anywhere a value reaches an assertion, because comparing a generated value to itself is circular;
bad in a golden-file test, where it makes the recorded file meaningless; and bad as a source of
uniqueness, because name generators draw from finite lists. The rule that covers all of it:
generated data belongs in fields nobody asserts on, and asserted fields are always explicit.

**★ A test using Faker fails once a week in CI and passes locally. How do you approach it?**
First, get the input into the failure report — without the seed there is nothing to debug, and
that is a defect in the test rather than a mystery ([07b](07b-the-seed-discipline.md)). Then ask
which of two things is happening. Either the generator produced a value that violates a constraint
— an apostrophe, a length, a locale-specific shape — in which case the generator is under-
constrained and should be narrowed to the domain; or the generator produced a value that exposed a
real assumption in the production code, such as a name splitter expecting two tokens. The second
case is the generator doing its job, and the fix belongs in production, not in the test.

**★ Someone proposes replacing all your object mothers with Faker calls. What is your response?**
That they solve different problems and the proposal loses the one that matters more. An object
mother names a *scenario* — `aCustomerWithNoOrders`, `aSuspendedCustomer` — so the test says what
situation it is about ([03 · Object mothers](03-object-mothers.md)). Faker fills fields with
arbitrary values; it has no notion of a scenario and cannot express one. The two compose: the
mother chooses the fields that define the scenario, literally, and delegates the rest to
generation. Replacing mothers with Faker leaves every test setting the significant fields inline
again, which is the forty-line setup with extra dependencies.

**★ Why is generated data particularly wrong in a golden-file or snapshot test?**
Because the entire premise of a golden file is that a human reads the diff and confirms the change
was intended. If the file contains generated values, every run produces a diff that means nothing,
so the file has to be re-recorded constantly, and the review step it exists for is abandoned within
a week. Seeding the generator makes the file stable but not meaningful: it now contains a list of
names that look like data and encode nothing, and a library upgrade that changes the algorithm
rewrites the entire file with no semantic change at all.

**★ How does this differ from property-based testing, which also uses generated inputs?**
Intent and what is checked. Faker fills in values a test does not care about, so the test still
asserts on one specific example; the generation is scenery. Property-based testing generates
inputs deliberately, over a described domain, and asserts an *invariant* that must hold for all of
them — and then shrinks a failing case to a minimal reproducer and reports the seed. So one is a
way to stop irrelevant fields from cluttering a fixture, and the other is a way to test a claim
you could not test with examples. Using Faker to "get coverage of many inputs" is the confusion to
avoid: it varies the inputs without strengthening the assertion, which buys flakiness and no
information.

{/* FOOTER */}
