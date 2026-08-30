---
title: "bodyJson().isEqualTo(...) is a STRICT comparison — the source defaults it to JsonCompareMode.STRICT, so an added field fails it — while hasPath() with a filter operator only validates that the expression parses and not that it matched anything, and jsonPath().value(x) silently re-evaluates the path as x's type while value(matcher) does not"
sidebar_label: "05b · JSON assertions"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the **Spring Framework 7.0.x** reference — "Defining Expectations ·
> JSON Support"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/mockmvc/assertj/assertions.html))
> and "Configuring MockMvcTester" — read as asciidoc source at tag `v7.0.9` — and the
> `spring-test` 7.0.9 sources for `AbstractJsonContentAssert`, `AbstractJsonValueAssert`,
> `JsonCompareMode`, `JsonAssert`, `JsonComparator` and `JsonPathExpectationsHelper`, from which
> every javadoc sentence and code excerpt below is taken.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8 (docs and sources read at 7.0.9), JUnit Jupiter 6.0.3, AssertJ 3.27.7,
> Hamcrest 3.0, JSONAssert via `spring-boot-starter-test`.
> **No sandbox** — this page carries Java source and library source, never a fabricated test run.

**[05](05-asserting-the-response.md) argues that asserting a response body as a string is a bad
default. This is the alternative: navigate the document with JSONPath, or compare it structurally
against an expected document. Both are well supported and both have a default that is the opposite
of what most people assume — one comparison mode is strict when you expected lenient, and one
"has this path" check passes when the path matched nothing. The classic `jsonPath(...)` matchers,
and the type-coercion rule that decides whether a number assertion passes, are
[05c · JSONPath in the classic API](05c-jsonpath-in-the-classic-api.md).**

## `bodyJson()` needs a message converter

```java
assertThat(mvc.get().uri("/orders/42"))
        .bodyJson().extractingPath("$.reference").isEqualTo("ORD-42");
```

In a Boot slice the converters come from the context and this just works. In a hand-built
standalone tester it does not, and the javadoc of `MockMvcTester.withHttpMessageConverters` says
why:

> *"If none are specified, only basic assertions on the response body can be performed. Consider
> registering a suitable JSON converter for asserting against JSON data structures."*

JSONPath navigation and structural comparison work on the raw text either way; it is
`convertTo(Order.class)` — turning the body, or a path within it, into one of your types — that
needs a converter. The reference states the same requirement: *"`MockMvcTester` can convert the
JSON response body, or the result of a JSONPath expression, to one of your domain object as long
as the relevant `HttpMessageConverter` is registered."*

## Navigating with JSONPath

```java
assertThat(result).bodyJson()
    .extractingPath("$.reference").asString().isEqualTo("ORD-42");

assertThat(result).bodyJson()
    .extractingPath("$.lines").asArray().hasSize(3);

assertThat(result).bodyJson()
    .extractingPath("$.total").asNumber().isEqualTo(new BigDecimal("42.50"));

assertThat(result).bodyJson()
    .extractingPath("$.customer").convertTo(Customer.class)
    .satisfies(c -> assertThat(c.email()).endsWith("@acme.test"));

assertThat(result).bodyJson().doesNotHavePath("$.error");
```

`extractingPath(path)` — *"Verify that the given JSON path is present, and extract the JSON value
for further assertions"* — returns a `JsonPathValueAssert` whose narrowing methods are
`asString()`, `asNumber()`, `asBoolean()`, `asArray()`, `asMap()`, `convertTo(Class)` and
`convertTo(AssertFactory)`, plus `isEmpty()` / `isNotEmpty()`.

`hasPathSatisfying(path, consumer)` is the variant that keeps the chain on the document rather
than descending into the value, which is what you want for several independent checks:

```java
assertThat(result).bodyJson()
    .hasPathSatisfying("$.reference", v -> assertThat(v).asString().startsWith("ORD-"))
    .hasPathSatisfying("$.lines",     v -> assertThat(v).asArray().isNotEmpty());
```

## 🔴 `hasPath` with an operator proves less than it looks

```java
/**
 * Verify that the given JSON {@code path} matches. For paths with an
 * operator, this validates that the path expression is valid, but does not
 * validate that it yield any results.
 */
public SELF hasPath(String path) { … }
```

Read the second sentence again. `hasPath("$.lines[?(@.sku == 'ABSENT')]")` — a filter expression —
**passes when nothing matches**, because all it establishes is that the expression is well formed.
Any assertion of the form "there is a line with this SKU" written with `hasPath` is vacuous.

The check that is not vacuous is to extract and assert:

```java
assertThat(result).bodyJson()
    .extractingPath("$.lines[?(@.sku == 'SKU-1')]").asArray().hasSize(1);
```

`doesNotHavePath(path)` is the mirror and does not carry the caveat — it asserts the path does not
match.

## 🔴 Structural comparison, and the mode nobody expects

```java
public SELF isEqualTo(@Nullable CharSequence expected) {
    return isEqualTo(expected, JsonCompareMode.STRICT);      // <- STRICT
}
```

`bodyJson().isEqualTo(json)` is a **strict** comparison. Adding a field to the response breaks it;
so does array reordering. That is very likely not what you wanted from a method called `isEqualTo`
on a JSON document, and it is the reverse of the older Boot `JsonContentAssert` habit people carry
over.

The full set:

| Method | Mode | Fails when |
|---|---|---|
| `isEqualTo(expected)` | STRICT | any extra field, any array reordering |
| `isStrictlyEqualTo(expected)` | STRICT | the same, said out loud |
| `isLenientlyEqualTo(expected)` | LENIENT | a promised field is missing or differs |
| `isEqualTo(expected, JsonCompareMode)` | yours | — |
| `isEqualTo(expected, JsonComparator)` | yours | — |

`JsonCompareMode` has exactly two constants, `STRICT` and `LENIENT`, and `JsonAssert.comparator`
maps them onto JSONAssert's:

```java
public static JsonComparator comparator(JsonCompareMode compareMode) {
    JSONCompareMode jsonAssertCompareMode = (compareMode != JsonCompareMode.LENIENT ?
            JSONCompareMode.STRICT : JSONCompareMode.LENIENT);
    return comparator(jsonAssertCompareMode);
}
```

so the semantics are JSONAssert's `DefaultComparator` under `JSONCompareMode.STRICT` and
`JSONCompareMode.LENIENT` respectively — extensibility and array-order strictness are what differ
between them. **`isLenientlyEqualTo` is the right default for a response contract**: it says "the
response contains at least these fields with these values", which is precisely the promise an API
makes, and it does not break when someone adds an optional field.

⚠️ If you need something neither mode expresses — ignoring one volatile field such as a generated
id or a timestamp — supply a `JsonComparator`. The reference: *"If you prefer to use another
library, you can provide an implementation of `JsonComparator`."*

## 🔴 A `CharSequence` ending in `.json` is a filename

Every `isEqualTo`/`isLenientlyEqualTo`/`isStrictlyEqualTo` overload taking a `CharSequence` says
the same thing:

> *"The `expected` value can contain the JSON itself or, **if it ends with `.json`, the name of a
> resource to be loaded from the classpath**."*

That is a feature — the reference demonstrates
`bodyJson().isLenientlyEqualTo("sample/hotel-42.json")` — and it is a trap in exactly one case: a
JSON *value* that happens to end in `.json`, such as asserting a body that is the bare string
`"schema.json"`. Use the `Resource` overloads when you mean a file and want to be unambiguous;
`withResourceLoadClass(...)` and `withCharset(...)` control where and how it is loaded.

The expected-document file is a good pattern for a response whose whole shape is the contract: the
file is reviewable in a diff, it can be shared with a consumer, and a change to it is a visible
change to the contract rather than a line edited inside a test.

## Gotchas

**★ `bodyJson().isEqualTo(json)` and being surprised that an added field fails it.**
`isEqualTo(CharSequence)` delegates to `JsonCompareMode.STRICT`. Use `isLenientlyEqualTo` for a
contract assertion, and keep strict comparison for the cases where the document shape genuinely is
fixed.

**★ `hasPath("$.items[?(@.id == 7)]")` as an existence check.**
It is not one. *"For paths with an operator, this validates that the path expression is valid, but
does not validate that it yield any results."* Extract the path and assert on the result.

**★ An expected-JSON string that ends in `.json`.**
It is interpreted as a classpath resource name. Use the `Resource` overloads when you mean a file,
and beware asserting a body whose entire content is a filename-shaped string.

**★ Comparing a whole document when only three fields are promised.**
Even leniently, an expected document states more than the contract does; every field in it becomes
something the response must keep. Use it when the shape is the contract, and JSONPath when it is
not.

**★ Ignoring a volatile field by deleting it from the expected document.**
Under LENIENT that works and under STRICT it does not, and either way the field is now untested. A
`JsonComparator` that ignores one path is honest about what it is doing.

**★ `convertTo(MyType.class)` in a standalone tester with no converters.**
*"If none are specified, only basic assertions on the response body can be performed."* JSONPath
still works; conversion does not.

**★ Reaching for `@JsonTest` to test a controller's response body.**
`@JsonTest` is a serialisation slice: it tests that an object maps to the JSON you expect, with no
controller, no mapping and no HTTP status. It is a good complement to a MockMvc test and not a
substitute — the controller test proves the endpoint returns that object at all.

**★ Writing JSONPath expressions against a document you have not looked at.**
`$.data.items[0].name` is four assumptions in one string, and a wrong one fails as "no value at
path" rather than as the mismatch you were testing for. Print the body once — `debug()` or
`andDo(print())` — write the expression, then remove the print.

## Interview questions

**★ Is `bodyJson().isEqualTo(...)` lenient or strict?**
Strict. The one-argument overload is implemented as `isEqualTo(expected, JsonCompareMode.STRICT)`,
so an extra field or a reordered array fails it. `isLenientlyEqualTo` is the one that says "at
least these fields with these values", which is what an API contract usually promises.

**★ What does `hasPath` actually assert for a filter expression?**
That the expression is syntactically valid — *"for paths with an operator, this validates that the
path expression is valid, but does not validate that it yield any results."* So it passes when the
filter matches nothing. To assert presence, use `extractingPath(...)` and then assert on the value
or the array's size.

**★ When would you compare against a whole expected JSON document rather than picking fields?**
When the document's shape *is* the contract — a published response schema, a payload another team
consumes. Then keep the expected document in a `.json` file on the classpath, compare leniently,
and let the file be the reviewable artefact. When only a few fields are promised, JSONPath keeps
the test from asserting more than the contract.

**★ How do you ignore a generated id or timestamp in a structural comparison?**
Supply a `JsonComparator`. Deleting the field from the expected document only works under LENIENT
and silently stops testing it under both modes; a comparator that ignores a named path says what
it is doing and keeps the rest strict. The reference offers the extension point for exactly this:
*"If you prefer to use another library, you can provide an implementation of `JsonComparator`."*

**★ What does `bodyJson()` need that plain `bodyText()` does not?**
A registered `HttpMessageConverter`, for the conversion methods. Navigation and structural
comparison operate on the text, but `convertTo(SomeType.class)` needs something that can
deserialise — *"If none are specified, only basic assertions on the response body can be
performed."* In a Boot slice the converters come from the context; in a hand-built standalone
tester you must register them.

{/* FOOTER */}
