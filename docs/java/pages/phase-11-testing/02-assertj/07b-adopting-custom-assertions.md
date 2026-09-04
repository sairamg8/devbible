---
title: "The hard part of custom assertions is not the class, it is that OrderAssert.assertThat and Assertions.assertThat collide as static imports — so adoption depends on one project entry-point class and on nobody quietly importing around it"
sidebar_label: "07b · Adopting custom assertions"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) —
> [`Assertions`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/Assertions.java)
> as the standard entry point and
> [`AbstractAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractAssert.java);
> plus the AssertJ Core documentation
> ([assertj.github.io/doc](https://assertj.github.io/doc/)).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**[07](07-custom-assertions.md) covered how to write the class. This chunk is why teams
write one and then stop using it. The obstacle is not difficulty — it is a static-import
collision that makes a custom assertion and the standard ones mutually exclusive inside one
file, and a set of failure modes where the abstraction quietly stops meaning what its name
says.**

## The entry point problem

The one genuinely awkward part. `OrderAssert.assertThat` and
`org.assertj.core.api.Assertions.assertThat` are different static imports with the same
name, and a test asserting on both an `Order` and a `String` needs both — which does not
work, because a static import of a name shadows rather than overloads across types.

The conventional fix is one project-wide entry point class:

```java
public class MyAssertions extends org.assertj.core.api.Assertions {

    public static OrderAssert assertThat(Order actual) {
        return new OrderAssert(actual);
    }

    public static CustomerAssert assertThat(Customer actual) {
        return new CustomerAssert(actual);
    }
}
```

`import static com.example.test.MyAssertions.*;` then gives you every AssertJ assertion plus
yours, resolved by overload. It costs one class and it is the difference between custom
assertions being adopted and being written once and abandoned.

⚠️ **This is the hidden cost of the technique.** Not the assertion class — the entry point,
the team convention, and the day someone adds a plain `import static
org.assertj.core.api.Assertions.assertThat` to a file and the custom overload silently stops
being used.

## When it earns its keep

- **A type asserted on in many tests** with checks that are not one-liners. Ten tests
  asserting an `Order` is confirmed *and* has an audit entry *and* has no pending payment.
- **A domain concept with an invariant** — "a valid IBAN", "a settled trade" — where the
  check is the definition and belongs in one place.
- **When the default failure message is genuinely bad.** `expected: <Order@3f2a> but was: <Order@8b1c>` helps nobody; a custom message naming the reference and the status does.

## When it does not

- **Once.** A single test does not need a class.
- **When `Condition` would do.** One named check, no chaining, no custom message: a
  `Condition` is three lines and no new vocabulary.
- **When the recursive comparison would do.** "This object equals that one, field by field"
  is [04 · Recursive comparison](04-recursive-comparison.md), not a custom assertion.
- **When the assertion class starts containing logic.** An assertion that recomputes what
  the production code computes is a second implementation, and the test passes when both are
  wrong the same way.

## Gotchas

**★ The static-import collision.**
`OrderAssert.assertThat` and `Assertions.assertThat` cannot both be imported by name in one
file. Without a combined entry-point class, adopting custom assertions means every test
using one gives up the standard ones.

**★ Someone adds the standard import and the overload stops being used.**
The test still compiles, still passes, and silently no longer uses your assertion. Nothing
warns. This is the maintenance cost of the entry point and it is worth a checkstyle rule.

**★ Logic in the assertion class.**
An assertion that computes the expected value duplicates the production algorithm. It then
agrees with the code when the code is wrong. Assertions compare; they do not calculate.

**★ A custom assertion that only wraps `isEqualTo`.**
`assertThat(order).hasStatus(CONFIRMED)` where the body is one `isEqualTo` is a rename, not
an abstraction. Worth it only if the message improves or several such checks chain.

**★ Assertion classes drifting from the domain.**
`OrderAssert.isConfirmed()` written when confirmation meant one flag, still compiling after
confirmation became three. The assertion is now a partial check with a total-sounding name —
worse than no abstraction, because every test that reads it is misled.

## Interview questions

**★ What is the practical obstacle to adopting custom assertions on a team?**
The entry point. `OrderAssert.assertThat` and `Assertions.assertThat` collide as static
imports, so you need a project `MyAssertions extends Assertions` class carrying overloads for
every custom type. Without it, using a custom assertion means giving up the standard ones in
that file — and even with it, anyone adding the standard import silently bypasses the
overload.

**★ When would you not write one?**
For a single test; when a `Condition` covers it; when the real question is "these two objects
match field by field", which is the recursive comparison's job; and whenever the assertion
class would end up computing the expected value, because a test that recomputes the
production algorithm agrees with it when it is wrong.

{/* FOOTER */}
