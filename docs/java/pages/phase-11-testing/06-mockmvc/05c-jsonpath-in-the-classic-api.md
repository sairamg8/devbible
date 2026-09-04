---
title: "jsonPath(path).value(expected) re-evaluates the JSON path as the expected value's own class before comparing, so a number assertion passes regardless of how the parser typed it — while jsonPath(path, matcher) does no such coercion, which is why the same assertion written two ways gives two different answers about the same document"
sidebar_label: "05c · JSONPath in the classic API"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Defining Expectations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/expectations.html))
> — read as asciidoc source at tag `v7.0.9` — and the `spring-test` 7.0.9 sources for
> `JsonPathExpectationsHelper`, `JsonPathResultMatchers` and `XpathResultMatchers`, from which
> every javadoc sentence, code excerpt and message string below is taken.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, Hamcrest 3.0.
> **No sandbox** — every message string on this page is read out of `spring-test`'s own source,
> never from a console.

**[05b · JSON assertions](05b-json-assertions.md) covers the AssertJ document API. The classic
`jsonPath(...)` matcher uses the same expression language and behaves differently in one respect
that decides whether your assertions pass: it coerces types for a plain expected value and does
not for a Hamcrest matcher. Everything here also applies when you reach the classic matchers from
`MockMvcTester` through `matches(...)` ([05](05-asserting-the-response.md)).**

## The classic side: `jsonPath(...)`

```java
mockMvc.perform(get("/orders/42"))
    .andExpectAll(
        jsonPath("$.reference").value("ORD-42"),
        jsonPath("$.total").value(42.50),
        jsonPath("$.lines").isArray(),
        jsonPath("$.error").doesNotExist(),
        jsonPath("$.lines[*].sku", containsInAnyOrder("SKU-1", "SKU-2")));
```

The expression language is the same one `extractingPath` uses. Two behaviours are worth knowing
because they are in `JsonPathExpectationsHelper` and not in the reference.

**`value(Object)` coerces; `value(Matcher)` does not.**

```java
// value(Object): if the types differ, the path is re-evaluated as the expected type
else if (actualValue != null && expectedValue != null &&
        !actualValue.getClass().equals(expectedValue.getClass())) {
    actualValue = evaluateJsonPath(content, expectedValue.getClass());
}

// value(Matcher): no coercion at all
public <T> void assertValue(String content, Matcher<? super T> matcher) {
    T value = (T) evaluateJsonPath(content);
    MatcherAssert.assertThat("JSON path \"" + this.expression + "\"", value, matcher);
}
```

So `jsonPath("$.total").value(42.50)` works even when the underlying parser produced an `Integer`
or a `BigDecimal`, because the path is re-read as a `Double`. `jsonPath("$.total",
is(42.50))` compares whatever the parser produced against a `Double` and can fail on the type
alone. The typed overload exists for this and its javadoc names the case: *"This can be useful for
matching numbers reliably for example coercing an integer into a double."*

When coercion is impossible the message is specific, and it is assembled in the helper:

```text
At JSON path "$.total", value <...> of type <...> cannot be converted to type <...>
```

**An indefinite path that yields one element is unwrapped.** If the expression returns a `List` and
the expected value is not a list, the helper takes the single element — and refuses when there is
more than one:

```text
No matching value at JSON path "$.lines[?(@.sku == 'SKU-1')].price"
Got a list of values [...] instead of the expected single value ...
```

Those two strings come from `JsonPathExpectationsHelper`'s source. The practical reading: a filter
expression that you believe selects one thing quietly becomes a single-element assertion, and the
day it selects two you get the second message rather than a value mismatch.

## The matcher catalogue

Beyond `value(...)`, `JsonPathResultMatchers` offers presence and type predicates that read better
than a value comparison when presence or shape is the point:

```java
jsonPath("$.reference").exists()
jsonPath("$.error").doesNotExist()
jsonPath("$.deletedAt").hasJsonPath()      // the path matched, even if the value is null
jsonPath("$.deletedAt").doesNotHaveJsonPath()
jsonPath("$.lines").isArray()
jsonPath("$.lines").isNotEmpty()
jsonPath("$.customer").isMap()
jsonPath("$.reference").isString()
jsonPath("$.total").isNumber()
jsonPath("$.paid").isBoolean()
jsonPath("$.cancelledAt").value(nullValue())
```

⚠️ `exists()` and `hasJsonPath()` are not the same question, and the javadoc draws the line
precisely:

> `exists()` — *"assert that **a non-null value**, possibly an empty array or map, exists at the
> given path. If the JSON path expression is not definite, this method asserts that the value at
> the given path is not empty."*
>
> `hasJsonPath()` — *"assert that **a value, possibly `null`,** exists. If the JSON path expression
> is not definite, this method asserts that the list of values at the given path is not empty."*

So a field serialised as `null` rather than omitted satisfies `hasJsonPath()` and fails
`exists()`. That is the distinction that matters when an API deliberately writes `null` for an
absent optional value — and note that both methods change meaning for an **indefinite** path (one
with a wildcard or a filter), where they assert on the emptiness of the result *list* rather than
on a single value.

`isEmpty()` and `isNotEmpty()` are a third pair again, defined by `ObjectUtils.isEmpty` — the
javadoc sends you there: *"For the semantics of empty, consult the Javadoc for
`org.springframework.util.ObjectUtils#isEmpty(Object)`."* An empty string, an empty array and an
empty map are all "empty"; `null` is too.

## XPath, for the XML case

The reference's own example:

```java
Map<String, String> ns = Collections.singletonMap("ns", "http://www.w3.org/2005/Atom");
mockMvc.perform(get("/handle").accept(MediaType.APPLICATION_XML))
    .andExpect(xpath("/person/ns:link[@rel='self']/@href", ns).string("http://localhost:8080/people"));
```

`xpath(...)` takes an optional namespace map and offers `string`, `number`, `booleanValue`,
`nodeCount`, `exists` and `doesNotExist`. It is the XML counterpart and it has the same property as
JSONPath: the expression is a string the compiler cannot check, so a typo fails as "no value" and
not as a mismatch.

## Gotchas

**★ `jsonPath("$.total", is(42.50))` failing on a whole number.**
The matcher variant does no coercion, so the parsed type has to match. `value(42.50)` re-evaluates
the path as `Double`; the three-argument matcher overload takes a target type for the same reason.


**★ Assuming a filter expression asserts multiplicity.**
`value(...)` on an indefinite path unwraps a single-element list silently and fails with *"Got a
list of values … instead of the expected single value"* only once there are two. If the count
matters, assert the array and its size.


**★ Using `exists()` where you meant `hasJsonPath()`.**
A field serialised as `null` matches the path but has no value. `exists()` fails on it;
`hasJsonPath()` passes. Deciding which you mean is a decision about your API's null policy, not
about the test.

**★ A JSONPath typo failing as "no value at path".**
The expression is an unchecked string, so `$.data.itmes[0]` and `$.data.items[0]` fail
identically. When a path assertion fails, confirm the document's shape before assuming the value
is wrong.

**★ Writing five `jsonPath` expectations as five chained `andExpect` calls.**
`andExpect` is fail-fast, so the first wrong field hides the other four —
[03b](03b-the-classic-api.md). `andExpectAll(...)` reports all of them, which for JSON assertions
is almost always what you want.

## Interview questions

**★ Why does `jsonPath("$.total").value(42.50)` pass where `jsonPath("$.total", is(42.50))`
fails?** `value(Object)` compares types first and, if they differ, re-evaluates the JSON path with
the expected value's class — so an `Integer` or `BigDecimal` becomes a `Double` before comparison.
The Hamcrest variant does no such coercion and matches whatever the parser produced. There is a
three-argument overload taking a target type precisely *"for matching numbers reliably, for example
coercing an integer into a double."*


**★ What is the difference between `exists()` and `hasJsonPath()`?**
`hasJsonPath()` asserts the path matched something; `exists()` additionally requires a non-null
value. For a field your serialiser writes as `null` rather than omitting, the first passes and the
second fails. The pair is only worth reaching for when your API deliberately distinguishes an
absent field from a present null one.

**★ Do the classic JSONPath matchers work with `MockMvcTester`?**
Yes, through `MvcTestResultAssert.matches(ResultMatcher)`, which runs any classic matcher against
the underlying `MvcResult` inside the fluent chain. That matters for matcher libraries with no
AssertJ equivalent, and it means a mixed codebase does not need two setups.

{/* FOOTER */}
