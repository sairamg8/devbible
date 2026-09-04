---
title: "The most dangerous assertion in a codebase is not a wrong one but a weak one — isNotNull passes for every incorrect value except one, and it is everywhere"
sidebar_label: "02b · Assertions that assert nothing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Avoiding incorrect usage"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-incorrect-usage)) —
> and the `assertj-core` 3.27.7 sources (`AbstractAssert.satisfies`,
> `AbstractAssert.satisfiesAnyOf`, `AbstractAssert.isNotNull`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**A test that fails when it should is easy to spot. A test that *passes* when it should
not is invisible by construction — it is green, it is in the coverage report, and it will
stay in the codebase until the bug it was supposed to catch reaches production. AssertJ
does not prevent this; the fluent chain makes weak assertions read more convincingly than
they deserve. This chunk is the list of shapes to grep for, and the one escape hatch —
`satisfies` — that lets you assert something hard without falling back to a boolean.**

## The question that grades an assertion

**How many distinct wrong values would still pass this assertion?**

That single question sorts assertions into useful and decorative faster than any style
guide. Apply it:

| Assertion | Wrong values that still pass |
|---|---|
| `isNotNull()` | every non-null value in the type's domain |
| `isNotEmpty()` on a list | every non-empty list, of any contents, of any size |
| `hasSizeGreaterThan(0)` | the same set, spelled longer |
| `isInstanceOf(User.class)` | every `User`, correct or not |
| `isNotEqualTo(null)` | see `isNotNull` |
| `hasSize(3)` | every 3-element list with wrong contents |
| `containsExactly(a, b, c)` | none |

The last row is the point. An assertion earns its place when the set of wrong values that
pass it is small — ideally empty.

## `isNotNull()` as a whole test body

```java
@Test
void findsTheUser() {
    assertThat(service.findUser(42L)).isNotNull();
}
```

This test passes if `findUser` returns a user with every field null, a user belonging to a
different tenant, a stale cached instance, or the wrong user entirely. It fails only for
`null` — and if the method returns `Optional<User>` it cannot even fail for that, because
`Optional.empty()` is not null.

`isNotNull()` earns its place in exactly two situations:

1. **As a genuine semantic assertion**, where null *is* the distinction under test: an
   audit timestamp that must have been populated by an entity listener, a nullable foreign
   key that must have been resolved, a lazily-initialised field that must have been
   touched.
2. **As a deliberate guard** before code that would otherwise `NullPointerException` in
   the test itself — though this is rarer than people assume, because AssertJ's own
   assertions null-check `actual` and report it as an assertion failure with your
   description attached, not as an NPE.

Everywhere else it is a placeholder someone meant to come back to.

## The longer chains that add nothing

```java
assertThat(response.getBody()).isNotNull()
                              .isNotEqualTo("")
                              .isNotBlank();
```

Three assertions, one bit of information: the body is a non-empty something. Compare:

```java
assertThat(response.getBody()).isEqualTo("""
    {"id":42,"status":"ACTIVE"}""");
```

The tell is that every link in the first chain is a *negative* assertion. Negatives
constrain weakly by nature — `isNotEqualTo(x)` excludes exactly one value out of infinity.
A chain that is all negatives is nearly always a chain that could be one positive.

## `hasSize` without content

```java
assertThat(orders).hasSize(3);
```

This is the most respectable-looking weak assertion in the family, and it is the one most
likely to survive review. It catches a filter that returns too much and a query that
returns too little, which is genuinely useful — and it catches nothing about *which* three
orders came back, in what order, or with what totals. If you know the expected contents,
`containsExactly` subsumes it: `containsExactly` asserts the size, the contents and the
order in one assertion with one failure message. See
[03 · Collection assertions](03-collections.md).

Where `hasSize` is right: when the count itself is the invariant (a page of 20, a batch
of 500) and the contents are genuinely arbitrary.

## The boolean fallback, and why it is the worst of all

```java
assertThat(order.getTotal().compareTo(expected) == 0).isTrue();
```

This is `assertTrue` with extra steps. It computes the comparison, throws away both
operands, and asserts on the survivor. The failure can only say that a boolean was false.
Any time you find yourself calling `.isTrue()` on an expression rather than on a value
that is *semantically* a flag, you have destroyed the failure message — see
[01 · Why fluent assertions](01-why-fluent-assertions.md).

The fix is almost always a real assertion:

```java
assertThat(order.getTotal()).isEqualByComparingTo(expected);
```

## `satisfies`: the escape hatch that keeps the message

When there is genuinely no built-in assertion for what you want, `satisfies` takes a
`Consumer` of the actual value so you assert *inside* it with ordinary AssertJ — and keep
every message:

```java
assertThat(order).satisfies(o -> {
  assertThat(o.total()).isEqualByComparingTo(new BigDecimal("42.00"));
  assertThat(o.lines()).hasSize(3);
  assertThat(o.placedAt()).isAfter(cutoff);
});
```

In 3.27.7 `satisfies` is declared on `AbstractAssert` as a varargs of
`Consumer<? super ACTUAL>`, with a `ThrowingConsumer` overload so a lambda that declares a
checked exception compiles. `satisfiesAnyOf` is the "at least one of these must hold"
sibling; when none holds, all the failures are reported, which is a great deal better than
an `||` of booleans that reports one `false`.

Two things `satisfies` does *not* do:

- It does not collect failures. The consumer body is ordinary code and the first failing
  assertion inside it throws. `satisfies` groups; it does not soften.
- It does not describe itself. A `satisfies` failure reports the inner assertion's message,
  which is usually what you want, but if you need to know *which* `satisfies` block failed,
  put an `as(...)` on the inner assertion — see
  [09 · as(), messages and representations](09-describedas-and-messages.md).

## The empty-lambda trap

```java
assertThat(x).satisfies(o -> {});
```

Compiles. Runs. Asserts nothing. Looks deliberate — more deliberate than `isNotNull()`,
because someone clearly typed a lambda. This shape appears when a test is stubbed out
during a refactor and never filled in, and unlike a `@Disabled` test it does not show up
anywhere as skipped.

## Gotchas

**★ `assertThat(x).isNotNull()` as an entire test body is a test that asserts almost
nothing.**
It passes for every wrong value that is not null. Ask how many wrong values would still
pass; if the answer is "all of them", the assertion is decoration.

**★ On an `Optional`, `isNotNull()` is worse than weak — it is nearly always a mistake.**
`Optional.empty()` is not null, so `assertThat(repo.findById(id)).isNotNull()` passes for a
missing row. The assertion you meant is `isPresent()` or `contains(expected)`. See
[08 · Optional assertions](08-optional-assertions.md).

**★ A chain of negatives is a positive assertion someone did not write.**
`isNotNull().isNotEqualTo("").isNotBlank()` excludes three values out of infinity.
`isEqualTo(expected)` excludes all but one.

**★ `hasSize(n)` alone lets every wrong element through.**
It is the right assertion when the count is the invariant and the contents are arbitrary;
it is the wrong one whenever you know what should be in the collection, because
`containsExactly` asserts size, contents and order together.

**★ `assertThat(someExpression).isTrue()` throws the operands away before the failure
exists.**
This is the `assertTrue` problem reintroduced through AssertJ's own API. Anything of the
form `assertThat(a.equals(b)).isTrue()` or `assertThat(x > y).isTrue()` should be a real
assertion on `a` or `x`.

**★ `assertThat(a.equals(b))` — with no assertion at all — compiles, passes, and is
undetectable without static analysis.**
It is the documentation's first listed misuse: *"DON'T DO THIS ! It does not assert
anything"*. Enable SpotBugs' `RV_RETURN_VALUE_IGNORED_INFERRED` or Sonar's S2970 on your
test source set; nothing else will catch it.

**★ `assertThat(1 == 2)` is the same bug wearing a more convincing costume.**
Also from the docs, also passing. It looks like a comparison assertion, and it is a
`BooleanAssert` that was never asserted on.

**★ `satisfies` with an empty body is `isNotNull` in a better suit.**
Grep for `satisfies(` followed by a short block during review. A stubbed-out lambda does
not report as skipped anywhere.

**★ `isInstanceOf` alone in a test about behaviour asserts the type system, not the
behaviour.**
`assertThat(result).isInstanceOf(Success.class)` is a reasonable *first* assertion in a
sealed-type test and a poor *only* one — pair it with `asInstanceOf` and assert the
payload.

**★ Coverage tools count a weak assertion exactly the same as a strong one.**
Line coverage records that the production line executed. It has no notion of whether the
test would have noticed a wrong answer. This is precisely the gap
**topic 11 · Mutation testing** *(not written yet)* exists to measure, and the honest
reason a 90 % coverage number tells you less than it seems to.

## Interview questions

**★ What is wrong with a test whose only assertion is `isNotNull()`, and when is it
actually the right assertion?**
It is wrong because the space of values that pass it is nearly the whole space of possible
values — every wrong object passes, only `null` fails. It is right when null is the
semantic distinction under test: an audit timestamp that must have been populated, an
optional foreign key that must have been resolved, a nullable cache entry that must have
been warmed. In those cases the value's identity genuinely is not what you are asserting.

**★ Give a one-question test for whether an assertion is pulling its weight.**
Ask how many distinct wrong values would still pass it. `isNotNull` passes for all but one;
`hasSize(3)` passes for every wrong three-element list; `containsExactly(a, b, c)` passes
for nothing else. The strength of an assertion is the size of the set it excludes, and
that framing survives contact with unfamiliar APIs in a way that "prefer specific
assertions" does not.

**★ Why is `assertThat(a.equals(b)).isTrue()` worse than `assertThat(a).isEqualTo(b)` even
though both fail on the same inputs?**
Because they differ entirely in what the failure can say. The first evaluates `equals`
before the assertion exists, so by the time the `AssertionError` is constructed the only
surviving value is `false`; nothing downstream can recover `a` or `b`. The second passes
both objects into the assertion, which renders both into the message and — under
opentest4j — into the structured expected/actual fields the IDE uses for its diff view.

**★ When would you reach for `satisfies` rather than a chain of assertions?**
When what you are asserting is not expressible as a single built-in assertion and you would
otherwise compute a boolean. `satisfies` lets you run arbitrary AssertJ assertions against
the actual value while keeping each one's own failure message, so you never end up at
`assertThat(complicatedPredicate).isTrue()`. It also reads well inside collection
assertions — `allSatisfy`, `anySatisfy` and `filteredOnAssertions` all take the same kind
of consumer.

**★ Does `satisfies` collect failures the way soft assertions do?**
No, and conflating the two is a common mistake. The body of a `satisfies` consumer is
ordinary code; the first failing assertion inside it throws and the rest of the block never
runs. `satisfies` is a grouping and readability construct. Collecting failures needs
`SoftAssertions`, which works by proxying the assert objects — see
[06 · Soft assertions](06-soft-assertions.md).

**★ How would you find weak assertions across an existing test suite?**
Three passes. Grep for the shapes: `isNotNull();` at the end of a test method,
`.isTrue()` applied to an expression, `satisfies(` with a short block, `hasSize(` not
followed by a content assertion. Enable SpotBugs' `RV_RETURN_VALUE_IGNORED_INFERRED` or
Sonar S2970 to catch the assertions that were never called at all. Then run mutation
testing, which is the only tool that measures whether the assertions would actually have
noticed a wrong answer.

{/* FOOTER */}
