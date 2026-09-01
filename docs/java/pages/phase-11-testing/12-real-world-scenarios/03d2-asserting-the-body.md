---
title: "content().json(...) defaults to a lenient, extensible comparison, which means the assertion most people write about an outgoing request body cannot fail on an extra field, a null where a value was meant, or a number that grew a decimal place"
sidebar_label: "03d2 · Asserting the body"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** javadoc for
> [`ContentRequestMatchers`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/match/ContentRequestMatchers.html)
> and
> [`JsonPathRequestMatchers`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/web/client/match/JsonPathRequestMatchers.html)
> — every signature and quoted sentence on this page is read from those two — and
> [`JsonCompareMode`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/json/JsonCompareMode.html)
> (`STRICT`, `LENIENT`; since 6.2), cross-checked against its
> [source at tag `v7.0.8`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/json/JsonCompareMode.java);
> plus the **Mockito 5.23.0** javadoc §55 *"Verification with assertions"* from
> [`Mockito.java` at `v5.23.0`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[03d](03d-asserting-what-you-sent.md) did the envelope: method, URI, query, headers. This
is the payload, and it has a trap the envelope does not, because the obvious assertion is
weaker than it looks. `content().json(expected)` is documented as a *lenient* comparison, and
lenient means extensible — extra fields in the actual body pass. So the test that appears to
pin the request body is in fact pinning a subset of it, and the fields it does not mention
are unconstrained. That matters most for exactly the payloads you would bother writing this
test for: the ones with an amount in them.**

## The matcher catalogue, verified

Reached through `MockRestRequestMatchers.content()`, which returns a `ContentRequestMatchers`.

| Matcher | Javadoc |
|---|---|
| `contentType(MediaType)` / `contentType(String)` | *"Assert the request content type as a `MediaType`."* |
| `contentTypeCompatibleWith(...)` | *"Assert the request content type is compatible with the given content type as defined by `MediaType.isCompatibleWith(MediaType)`."* |
| `string(String)` / `string(Matcher<? super String>)` | *"Get the body of the request as a UTF-8 string and compare it to the given `String`."* |
| `bytes(byte[])` | *"Compare the body of the request to the given byte array."* |
| `json(String)` | lenient — quoted in full below |
| `json(String, JsonCompareMode)` | *"Parse the request body and the given string as JSON and assert the two using the given mode."* |
| `json(String, JsonComparator)` | same, with a comparator you supply |
| `json(String, boolean strict)` | 🔴 **deprecated since 6.2** in favour of the `JsonCompareMode` form |
| `formData(MultiValueMap<String,String>)` | *"Parse the body as form data and compare to the given `MultiValueMap`."* |
| `formDataContains(Map<String,String>)` | *"Variant of `formData(MultiValueMap)` that matches the given subset of expected form parameters."* |
| `multipartData(MultiValueMap<String,?>)` | *"Parse the body as multipart data and assert it contains exactly the values from the given `MultiValueMap`."* |
| `multipartDataContains(Map<String,?>)` | *"…only for a subset of the actual values."* |
| `xml(String)` | *"…assert that the two are 'similar' — i.e. they contain the same elements and attributes regardless of order."* |
| `node(Matcher<? super Node>)`, `source(Matcher<? super Source>)` | DOM-level access |

## 🔴 The default is lenient, and lenient is extensible

`json(String)` is documented in these words:

> *"Parse the expected and actual strings as JSON and assert the two are 'similar' - i.e.
> they contain the same attribute-value pairs regardless of formatting with a lenient
> checking (extensible, and non-strict array ordering)."*

Take **extensible** literally. The following passes:

```java
// expected
server.expect(content().json("""
        {"amount": 9000, "currency": "GBP"}
        """));

// actual body the client sent
// {"amount":9000,"currency":"GBP","capture":false,"customer":null,"metadata":{"env":"dev"}}
```

`capture: false` would leave the charge unsettled. `metadata.env` leaks the environment to a
partner. `customer: null` may be rejected by a partner that treats null differently from
absent. The assertion mentioned none of them, and lenient mode does not care.

**Non-strict array ordering** is the second half. `["a","b"]` and `["b","a"]` are the same
under lenient comparison, which is usually right for a set-like field and wrong for anything
where order is meaning — line items on an invoice, steps in a workflow, a signature base
string.

### The fix, and it is one argument

```java
server.expect(content().json("""
        {"amount":9000,"currency":"GBP","capture":true}
        """, JsonCompareMode.STRICT));
```

`JsonCompareMode` (since 6.2, `org.springframework.test.json`) has exactly two constants —
`STRICT` (*"Strict checking."*) and `LENIENT` (*"Lenient checking."*). For an **outbound**
request body, `STRICT` is almost always the right default, and the reasoning is asymmetric
with the inbound case:

- When you assert a **response** you received, leniency is a feature: the partner may add
  fields and your test should not break.
- When you assert a **request** you sent, every field is yours. An unexpected one is either a
  bug or a change nobody wrote down. There is no upside to tolerating it.

⚠️ The older `json(String, boolean strict)` overload is **deprecated since 6.2**. Code and
articles written against it still compile with a warning, and the boolean at the call site
reads as `json(expected, true)`, which is unreadable in review compared with the named
constant.

## When STRICT is too much: `jsonPath` on the request

Sometimes the body is large, generated, or contains one field you care about and forty you do
not. `MockRestRequestMatchers.jsonPath(...)` — *"using a JsonPath expression to inspect a
specific subset of the body"* — is the scalpel:

```java
server.expect(jsonPath("$.amount").value(9000))
      .andExpect(jsonPath("$.currency").value("GBP"))
      .andExpect(jsonPath("$.capture").value(true))
      .andExpect(jsonPath("$.metadata").doesNotExist());
```

🔴 **`exists()` and `hasJsonPath()` are not the same assertion, and neither are their
negations.** From the javadoc:

- `exists()` — *"assert that a **non-null** value exists at the given path."*
- `hasJsonPath()` — *"assert that a value, **possibly null**, exists."*
- `doesNotExist()` — *"assert that a value does not exist at the given path."*
- `doesNotHaveJsonPath()` — *"assert that a value, **including null values**, does not exist
  at the given path."*

That pair of distinctions is the whole JSON null-versus-absent problem in four method names.
If your partner treats `{"customer": null}` differently from a body with no `customer` key —
and payment and CRM APIs routinely do, one meaning "clear this field" and the other meaning
"leave it alone" — then `doesNotExist()` is not enough. It passes on an explicit null.
`doesNotHaveJsonPath()` is the one that proves the key is absent.

The type matchers are worth knowing for the classic serialization slip: `isNumber()`,
`isString()`, `isBoolean()`, `isArray()`, `isMap()`. A `Money` that serialises as `"90.00"`
rather than `9000` passes `value("90.00")` and fails `isNumber()`, and the partner rejects it.

## Form and multipart bodies

Not every partner takes JSON. OAuth token endpoints, legacy payment gateways and most webhook
registration endpoints take `application/x-www-form-urlencoded`.

```java
server.expect(content().contentType(MediaType.APPLICATION_FORM_URLENCODED))
      .andExpect(content().formData(new LinkedMultiValueMap<>(Map.of(
              "grant_type", List.of("client_credentials"),
              "scope",      List.of("payments:write")))));
```

`formData(MultiValueMap<String,String>)` compares the whole parsed form;
`formDataContains(Map<String,String>)` is the subset variant, which is what you want when
the client adds a nonce or a timestamp you cannot predict. 🔴 **Do not assert a form body
with `content().string(...)`** — that pins the parameter order and the encoding, both of
which are implementation details, and it is the form-encoded twin of
[03d](03d-asserting-what-you-sent.md)'s query-string-as-substring mistake.

For multipart the javadoc names the value types `multipartData` understands:

> *"Values may be of type: `String` - form field, `Resource` - content from a file, `byte[]` -
> other raw content, `HttpEntity` - entity with a `Resource` or `byte[]`, and a `Content-Type`
> header"*

`multipartData` asserts the body *"contains exactly the values"*; `multipartDataContains` is
the subset form. A file upload test almost always wants the subset variant, because the
client adds boundary and filename metadata you have no reason to pin.

## The same discipline one layer up: the collaborator's argument

[02](02-mocking-a-class-you-own.md) sends you here for the non-HTTP version of the same
problem. `verify(gateway).charge(any())` is the `content().json` leniency mistake without the
JSON: it proves a call happened and nothing about what was in it.

Two APIs, and the choice between them is about failure messages rather than power.

```java
// captor — the argument is available afterwards, for several assertions and for reuse
ArgumentCaptor<ChargeCommand> captor = ArgumentCaptor.forClass(ChargeCommand.class);
verify(gateway).charge(captor.capture());
assertThat(captor.getValue().amountMinorUnits()).isEqualTo(9000);
assertThat(captor.getValue().idempotencyKey()).isEqualTo(order.id());
```

```java
// assertArg — the assertions run inline, during verification
verify(gateway).charge(assertArg(command -> {
    assertThat(command.amountMinorUnits()).isEqualTo(9000);
    assertThat(command.idempotencyKey()).isEqualTo(order.id());
}));
```

Mockito's §55 introduces the second as the alternative to the first: *"To validate arguments
during verification, instead of capturing them with `ArgumentCaptor`, you can now use
`ArgumentMatchers#assertArg(Consumer)`"*. The practical difference: when `assertArg` fails,
Mockito reports it as a verification failure with the invocation attached, so the message
names the call; a captor's assertions fail afterwards, as ordinary AssertJ failures, which is
better when you want several independent assertions or need the object for a later step.
**Topic 04 · Mockito** owns both in full — see
[`../04-mockito/06-argument-captors.md`](../04-mockito/06-argument-captors.md).

⚠️ Neither helps if the argument is mutated after the call. A captor holds a **reference**, so
if the production code calls `gateway.charge(command)` and then mutates `command`, the captor
shows the mutated state and the assertion is about the wrong moment. `assertArg` runs at
verification time, which is also after the fact. The robust answer is an immutable command
object — a `record` — which removes the question.

## Where this connects

- The envelope — method, URI, query encoding, headers, the idempotency key:
  [03d · Asserting what you sent](03d-asserting-what-you-sent.md).
- Why the message converters are real in this test, which is what makes a body assertion
  meaningful at all: [03a · What it does not run](03a-what-the-mock-server-does-not-run.md).
- The slice that gives you the application's own Jackson configuration, which is when a body
  assertion is testing *your* serialization rather than the defaults:
  [03 · Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md), route B.
- Pinning a whole payload as a fixture instead of writing the expected JSON inline is the
  approval-test idea, which is [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md) in this topic.
- The money-shaped version of all of this — the amount, the currency, the key — is
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md) and
  [04b](04b-the-adapter-and-the-three-test-populations.md).
- Captors, `assertArg`, matchers and verification belong to **topic 04 · Mockito** —
  [`../04-mockito/06-argument-captors.md`](../04-mockito/06-argument-captors.md) and
  [`../04-mockito/04-argument-matchers.md`](../04-mockito/04-argument-matchers.md).

## Gotchas

**★ `content().json(expected)` is lenient and extensible, so it cannot fail on a field you did not mean to send.**
The javadoc says it: *"lenient checking (extensible, and non-strict array ordering)"*. The test looks like it pins the body and pins a subset. For an outgoing request that is the wrong default — every field in the body is yours, so an unexpected one is a bug — and the fix is one argument, `JsonCompareMode.STRICT`.

**★ Lenient comparison also ignores array order, which is wrong whenever order is meaning.**
Line items, workflow steps, a signature base string, a batch whose processing order matters. Under lenient checking `["a","b"]` equals `["b","a"]`, so a reordering bug is invisible. `STRICT` restores order sensitivity for the whole document; if you need it for one field only, `jsonPath("$.items[0].sku").value(...)` is the targeted form.

**★ `json(String, boolean strict)` is deprecated since 6.2 and its call sites read as `json(expected, true)`.**
Two problems at once: a deprecation warning that gets suppressed, and a boolean literal at the call site that nobody can decode without opening the javadoc. `JsonCompareMode.STRICT` says what it means and is the supported form.

**★ `doesNotExist()` passes on an explicit `null`, and for many partners `null` and absent mean opposite things.**
`doesNotExist()` asserts *"a value does not exist"*; `doesNotHaveJsonPath()` asserts *"a value, including null values, does not exist"*. A partner that treats `{"customer": null}` as "clear the customer" and an absent key as "leave it alone" will do something destructive on a body your test approved. Use `doesNotHaveJsonPath()` when absence is the property you need.

**★ `exists()` and `hasJsonPath()` differ on null in the same way, in the positive direction.**
`exists()` requires a *non-null* value; `hasJsonPath()` accepts a value *"possibly null"*. Asserting `exists()` on a field your serializer omits when null is the assertion you want; asserting `hasJsonPath()` there will pass on a `null` you did not intend to send.

**★ A `Money` that serialises as a string passes `value("90.00")` and is rejected by the partner.**
This is the commonest serialization slip in payments, and the `isNumber()` / `isString()` type matchers exist for it. It happens when a value type gains a `toString`-based serializer, when a `BigDecimal` is written through a custom module, or when someone "fixes" a rounding display bug in the wrong class. A JSON comparison in lenient mode will not necessarily catch it either, since `"9000"` and `9000` differ by type.

**★ Asserting a form-encoded body with `content().string(...)` pins parameter order and encoding.**
It is the same mistake as matching a query string as a substring: the assertion goes red when the client legitimately reorders parameters or encodes a space differently, and it passes when a value was double-encoded. `formData(MultiValueMap)` parses the body and compares the parsed values; `formDataContains(Map)` does it for a subset when the client adds a nonce or timestamp.

**★ `multipartData` asserts *exactly* the values and `multipartDataContains` asserts a subset, and file uploads almost always want the second.**
The exact form fails on any additional part the client adds — a filename, an extra metadata field, a content-type header the framework attached. The javadoc lists what values may be: `String`, `Resource`, `byte[]` and `HttpEntity`. Reaching for the exact form on an upload produces a test that fails for framework reasons rather than behaviour reasons.

**★ A body assertion in a plain `RestClient.builder()` test is asserting Jackson's defaults, not your application's.**
The message converters are real, but a hand-built builder gets the default ones. If your application registers a `JacksonModule`, a naming strategy or a `Money` serializer, the body in this test is not the body production sends. That is the case `@RestClientTest` exists for ([03](03-mocking-an-outbound-http-api.md)), and it is precisely the case where a body assertion is worth having.

**★ `verify(gateway).charge(any())` is the leniency mistake without the JSON.**
It proves a call happened. It does not prove the amount, the currency, the key, the customer or the reason. For anything with money in it, `any()` in a verification is a gap, and the two fixes — a captor or `assertArg` — are one line each.

**★ A captor holds a reference, so a command object mutated after the call is asserted in its mutated state.**
`captor.getValue()` returns the object, not a snapshot of it. Production code that passes a builder or a mutable DTO and then modifies it makes the assertion about the wrong moment, and the failure reads as if the wrong values were sent. `assertArg` has the same exposure, since it also runs at verification time. Immutable commands — `record` types — remove the problem rather than working around it.

## Interview questions

**★ What is wrong with `content().json(expectedJson)` as an assertion on an outgoing request body?**
It is lenient by default, and the javadoc's own words for lenient are *"extensible, and non-strict array ordering"*. Extensible means extra fields in the actual body pass, so the assertion is really "the body contains at least these pairs" while it reads as "the body is this". On an outgoing request that is the wrong polarity: every field is mine, so an extra one is either a bug or an undocumented change, and there is nothing to be gained from tolerating it. The concrete damage I have in mind is a `capture: false` that leaves a charge unsettled, or a metadata block that leaks environment or customer detail to a partner — both of which pass a lenient comparison silently. The fix is `JsonCompareMode.STRICT`. For a *response* body the default is right, because the partner may legitimately add fields.

**★ A partner distinguishes a null field from an absent field. How do you assert that in a request test?**
With `doesNotHaveJsonPath()`, not `doesNotExist()`. The javadoc separates them precisely: `doesNotExist()` asserts a value does not exist, and `doesNotHaveJsonPath()` asserts a value *"including null values"* does not exist — so `doesNotExist()` is satisfied by an explicit `{"customer": null}` and only the second one proves the key is absent. The positive direction has the same pair, `exists()` requiring a non-null value and `hasJsonPath()` accepting a possibly-null one. This matters far more than it sounds for CRM and payment APIs where a null means "clear this field" and absence means "leave it alone", because the destructive case is the one your test approved.

**★ Captor or `assertArg` — when do you use which?**
`assertArg` when the assertions are about that one argument and I want the failure reported as a verification failure with the invocation attached, which is a better message and less ceremony — no captor field, no `getValue()`. A captor when I need the object afterwards for something else: several independent assertions I want to fail independently, feeding the captured value into a follow-up step, or capturing multiple invocations and asserting across them with `getAllValues()`. The trap common to both is that they hold or inspect a reference after the call, so if the production code mutates the argument afterwards, both report the mutated state and the failure looks like the wrong values were sent. That is an argument for immutable command objects rather than for a different matcher.

**★ Your body assertion passes locally and the partner rejects the request. What are the candidates?**
Three, in the order I would check them. First, the test uses a hand-built `RestClient.builder()`, so Jackson ran with default converters rather than the application's — a custom module, a naming strategy or a `Money` serializer registered in the app is simply absent, and the body under test is not the body production sends. Second, the comparison was lenient, so a field the client adds — a null, a default, a metadata block — was never in the expected JSON and never checked. Third, a type slip that a value comparison cannot see: an amount serialised as the string `"9000"` rather than the number `9000`, which passes `value("9000")` and fails `isNumber()`. The first is fixed by moving the test to `@RestClientTest`, the second by `JsonCompareMode.STRICT`, and the third by asserting the type as well as the value on anything numeric that matters.

{/* FOOTER */}
