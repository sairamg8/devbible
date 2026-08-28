---
title: "A contract test that runs only against the fake proves the fake agrees with itself, which is the exact failure it was written to prevent — so the operating question is not how to write the suite but how to guarantee the expensive half keeps executing, and a mistyped tag removes a class from every selection with nothing but a log warning"
sidebar_label: "12e · Running both halves"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **JUnit 6.0.3** User Guide — "Tagging and Filtering"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/tagging-and-filtering.html)),
> "Tags" ([docs.junit.org](https://docs.junit.org/6.0.3/running-tests/tags.html)) and
> "Test Classes and Methods"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/test-classes-and-methods.html)) —
> together with the `@ParameterizedClass` status already verified in
> [08c · Parameterized classes](../03-parameterized-tests/08c-parameterized-classes.md) and the
> tag-syntax behaviour in [06d · Tagging](../01-junit-5/06d-tagging.md). The contract test is a
> test-design pattern, not an API.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Mockito 5.23.0, **JUnit Jupiter 6.0.3**. **No sandbox** — this page carries Java source, never a
> fabricated test run.

**[12c](12c-contract-testing-a-fake.md) builds the suite and
[12d](12d-keeping-a-contract-honest.md) decides what goes in it. This is the part that decays: the
fake's run is milliseconds and stays in every build, the real implementation's run needs a
database and quietly stops executing, and a contract with one live half is worth less than no
contract at all because it is believed. Plus the two Jupiter features that look like a better
shape for "one suite, two implementations" and are not.**

## Making the expensive half run without slowing the fast loop

The fake's run is milliseconds and belongs in every build. The real implementation's run needs a
database, and the temptation is to move it somewhere that quietly stops executing.

The arrangement that works is tagging, not exclusion —
[06d · Tagging](../01-junit-5/06d-tagging.md) and
[06e · Tag expressions](../01-junit-5/06e-tag-expressions-and-filtering.md):

```java
@Tag("db")
@DataJpaTest
class JpaOrderRepositoryTest extends AbstractPostgresTest implements OrderRepositoryContract { … }
```

with the local loop running `!db` and CI running everything. Two rules make it honest:

1. **The untagged fast run is not "the tests".** If the only build anyone watches excludes the
   `db` tag, the contract proves the fake agrees with itself, which is the exact failure the
   technique exists to prevent.
2. **A tag is a Platform-level string the compiler cannot check** — a typo'd tag is dropped with a
   log warning rather than a build failure, which [06d](../01-junit-5/06d-tagging.md) covers. A
   mistyped `@Tag("bd")` silently removes the class from both selections.

⚠️ The failure to watch for is not a red build; it is a green one that stopped running half the
suite. Whatever mechanism you use, something must periodically assert that the slow class *ran* —
a test count, a CI job that fails when zero tests match the `db` tag.

## Two shapes that look like alternatives and mostly are not

**`@ParameterizedClass` with both implementations as arguments.** Jupiter can run a whole class
once per argument set — [08c · Parameterized classes](../03-parameterized-tests/08c-parameterized-classes.md)
— so one class could take the fake and the real repository as two rows. It is a genuine option and
it is usually wrong here, for three reasons: both implementations must be constructible in the same
place, so the real one cannot carry its own `@DataJpaTest` or container base class; the two runs
cannot be tagged separately, so you cannot keep the slow one out of the fast loop; and the feature
is still `@API(status = EXPERIMENTAL)` at 6.0.3. It fits when both implementations are cheap and
constructed identically — two in-memory strategies, two serialisers — which is not the fake/database
case.

**`@TestFactory` generating a dynamic test per implementation.** Dynamic tests are not test methods
and do not get the per-test lifecycle: no `@BeforeEach` per generated case, no per-case extension
callbacks, and coarser filtering and reporting. For a contract suite, which is entirely about a
clean fixture per clause and about telling two runs apart in the report, that is the wrong trade.

## Growing the contract, and its one permanent limitation

> The contract proves the fake and the real implementation agree *about the things the contract
> states*. It cannot prove the contract is complete.

That sentence is [12b](12b-what-a-fake-costs.md)'s and it is the honest limit. The operating
consequence is a rule about bug fixes: **every divergence found in production is two commits'
worth of work — fix the fake, and add the contract clause that would have caught it.** Skipping the
second leaves the same class of drift undetectable everywhere else in the interface.

Two habits make the contract grow in the right places:

- **When you add a method to the interface, add its clauses in the same commit.** The fake will
  stop compiling, which is the good failure; the contract will not, which is the one to remember.
- **When you change a method's *semantics*, the fake compiles and lies.** That is precisely the case
  [12b](12b-what-a-fake-costs.md) calls the dangerous one, and the only thing that catches it is a
  clause that states the semantics.

## The pattern is not about repositories

Anything with more than one implementation and a fake worth writing takes the same treatment:

| Interface | Fake | Real | Clauses that matter |
|---|---|---|---|
| `OrderRepository` | `LinkedHashMap` | JPA / JDBC | absence, identity, idempotence, ordering |
| `EventPublisher` | recording list | Kafka / SNS | delivery, ordering guarantees, at-least-once |
| `BlobStore` | `Map<Key, byte[]>` | S3 | overwrite semantics, absent key, listing |
| `Cache` | `HashMap` | Redis | eviction visibility, absent key, `null` values |
| `Clock` | `Clock.fixed` | `Clock.systemUTC` | monotonicity only — a fixed clock is not a fake |

The last row is the counter-example worth keeping: `Clock.fixed` is a real implementation supplied
by the JDK, not a fake you maintain, so there is nothing to drift and no contract to write —
[10f · Mocking JDK types](10f-mocking-jdk-types.md). A contract test is only worth its cost when
**you** own the second implementation.

## Gotchas

**★ Only running the fake's subclass in the default build and forgetting the other one.**
Then the contract proves the fake agrees with itself. Whatever tagging or profile arrangement keeps
the slow run out of the fast loop must still run it somewhere on every change —
[12d](12d-keeping-a-contract-honest.md).



**★ Tagging the slow run out of the fast loop and never checking it still runs.**
A green build that stopped executing half the suite looks identical to a green build that ran it.
A typo'd tag is dropped with a log warning rather than a failure, so nothing tells you.


**★ Reaching for `@ParameterizedClass` to run both implementations in one class.**
Both then share one construction site, so the real implementation cannot have its own slice or
container base class, and the two runs cannot be tagged apart. It also remains an experimental API
at 6.0.3.


**★ Using `@TestFactory` to generate one dynamic test per implementation.**
Dynamic tests have no per-test lifecycle, so the clean-fixture-per-clause property the contract
depends on has to be hand-rolled, and filtering and reporting get worse.


**★ Fixing a fake/real divergence found in production without adding a clause.**
The bug is fixed and the mechanism that let it through is untouched, so the next divergence is
just as invisible. The fix is two commits' worth of work, and the second is the one that matters.


**★ Adding a method to the interface and only fixing the compile error.**
The fake stops compiling, you implement the method, and nothing tests it. New methods need new
clauses in the same commit — the compiler covers signatures, never semantics.


**★ Writing a contract for something you do not own two implementations of.**
`Clock.fixed` versus `Clock.systemUTC` needs no contract: both are the JDK's. The pattern earns its
cost only when you maintain the stand-in.


**★ Running the tagged class only on a nightly job.**
A divergence introduced on Monday is found on Monday night, in a build nobody is watching, and
attributed to whichever commit is convenient. The contract's value is that the two runs fail
*together*, in the same build, on the same change.

**★ Excluding the slow class with a Maven or Gradle source-set split instead of a tag.**
It works and it is invisible: nothing in the test file says it is excluded, and a reader opening
`JpaOrderRepositoryTest` has no way to tell whether it runs. A `@Tag` is at least written on the
class.

## Interview questions

**★ How do you keep the real implementation's run in the build without slowing everyone down?**
Tag it and run the untagged set locally, everything in CI. Then add something that fails when the
tagged class does *not* run — a count, or a CI job that errors on zero matching tests. A tag is an
unchecked string: a typo removes the class from every selection with only a log warning, and the
resulting build is green.


**★ Would `@ParameterizedClass` be a better shape than inheritance?**
Rarely for this problem. It forces both implementations to be constructed in the same place, so the
real one cannot carry its own Spring slice or Testcontainers base; it gives the two runs one set of
tags; and it is still marked experimental at 6.0.3. It fits when both implementations are cheap and
built identically, which is not the fake-versus-database case.


**★ A production bug turns out to be a place where the fake and the database disagree. What do you
do?** Two things. Fix the fake, and add the contract clause that would have caught it. Without the
second, the same class of drift stays invisible for every other method on the interface — and the
clause is usually one line, because you now know exactly what the two implementations disagreed
about.


**★ Does a passing contract mean the fake is correct?**
No. It means the two implementations agree about what the contract states. Completeness is not
provable — anything production relies on that the contract never mentions is still a place the fake
can quietly differ. That is why the contract is grown from discovered divergences rather than
declared finished.


**★ Why is a contract test with only the fake's half running worse than no contract test?**
Because it is believed. The suite is green, the technique is visibly in place, and the property it
appears to guarantee — that the fake and the real implementation agree — has never been checked.
A missing contract is at least honestly missing; a half-running one has the shape of evidence
without being any.

{/* FOOTER */}
