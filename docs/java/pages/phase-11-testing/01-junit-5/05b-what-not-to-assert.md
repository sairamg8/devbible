---
title: "A test that asserts an exception's message string is a test that a copy-editor can break, and the same failure mode — asserting on something that is not the contract — is behind most of the tests a team eventually deletes rather than fixes"
sidebar_label: "05b · What not to assert"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Exception Handling"
> ([exception-handling](https://docs.junit.org/6.0.3/writing-tests/exception-handling.html))
> and "Assertions"
> ([assertions](https://docs.junit.org/6.0.3/writing-tests/assertions.html)); Spring
> Framework 7.0 `ProblemDetail` reference
> ([web mvc / error responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[05](05-assertthrows.md) argued for asserting on the exception rather than only its
type. This chunk draws the other boundary: *which* parts of the exception. The default
answer people reach for — `assertEquals("expected message", thrown.getMessage())` — pins
your test to a string that nobody has agreed is an interface, and the JUnit user guide's
own examples use it because they are demonstrating an API, not designing a test suite.**

## The message is not a contract until someone says it is

```java
// ⚠️ Red build the day someone fixes "occured" -> "occurred".
IllegalArgumentException thrown = assertThrows(IllegalArgumentException.class,
        () -> Sku.parse("??"));

assertEquals("Invalid SKU format: ?? — expected 3 letters followed by 4 digits",
        thrown.getMessage());
```

Everything about that assertion is fragile. The message contains punctuation choices, an
em dash, the input echoed back, and a description of a format that will be reworded the
first time a support ticket says it is unclear. None of that is behaviour. A test failing
because prose improved is a test that trains the team to change tests without reading
them, which is how a suite stops being a safety net.

**The message becomes a contract in exactly one circumstance: when it is displayed to
somebody or parsed by something.** If the message is the `detail` field of an HTTP
`ProblemDetail` response body, or is matched by a log-alerting rule, then it is an
interface with a consumer, and a test asserting it is correct — but that test belongs at
the layer where the contract lives, which is the controller test
(**topic 06 · MockMvc**, *(not written yet)*), not the domain unit test.

## What to assert instead

**Structured data on the exception.** Give the exception the fields the caller needs, and
assert on those:

```java
public final class SkuFormatException extends IllegalArgumentException {

    private final String rejectedValue;

    public SkuFormatException(String rejectedValue) {
        super("Invalid SKU format: " + rejectedValue);
        this.rejectedValue = rejectedValue;
    }

    public String rejectedValue() { return rejectedValue; }
}
```

```java
SkuFormatException thrown = assertThrows(SkuFormatException.class, () -> Sku.parse("??"));

assertEquals("??", thrown.rejectedValue());
```

Now the message can be rewritten freely and the test still defends the thing the caller
uses. This is not test-driven design for its own sake — an exception carrying only a
message is an exception a caller cannot act on programmatically, so the test pressure is
pointing at a real design gap.

**An error code, when one exists.** A `ValidationFailure` with `field()` and `rule()`, a
`PaymentDeclined` with a decline code from the gateway. Codes are stable by contract;
messages are not.

**A substring, as a last resort.** If the exception is third-party and carries nothing but
a message, assert on the smallest invariant fragment — the SQL state, the offending
identifier — and never on the whole sentence. AssertJ's `hasMessageContaining` is built for
this (**topic 02 · AssertJ**, *(not written yet)*).

## The same failure mode, six other places

Message assertions are the most common instance of a general defect: **asserting on
something that is not part of the behaviour you are protecting.**

**★ Asserting on `toString()`.** It is a debugging aid. Records generate it, IDEs generate
it, and both change format between JDK versions and refactors.

**★ Asserting on iteration order of an unordered collection.** `HashMap` and `HashSet`
have no defined order. A test that passes today because of a hash distribution fails on a
different JDK, a different key set, or after a rename changes a `hashCode`. Assert on
membership; if order is the contract, the production type should be a `List` or a
`SortedSet`.

**★ Asserting on a generated identifier.** A UUID, a database sequence value, a
`created_at` from `Instant.now()`. Assert that it is present and well-formed, or inject a
fixed `Clock` and an id generator so the value is deterministic — that is
**topic 08 · test data patterns** *(not written yet)*.

**★ Asserting on a full JSON string.** One added optional field, one whitespace change
from a Jackson upgrade, and every such test fails. Assert on the fields that matter with
JSONPath or a JSON-aware comparison.

**★ Asserting on the number of SQL statements by reading a log.** The log format is not an
API and log configuration differs between environments. Count statements with a mechanism
built for counting — see
[Phase 10 · count, do not read](../../phase-10-data-access/08-the-n-plus-1-problem/06-count-do-not-read.md).

**★ Asserting on private state through reflection.** The test passes, the field gets
renamed, the test breaks, and it never told you anything about behaviour in between.

**★ Asserting on wall-clock timings.** "This completes in under 200 ms" is a statement
about the CI runner's load, not about your code. [13](13-timeouts.md) covers what a
`@Timeout` is legitimately for, which is bounding a hang and not measuring performance.

## The test-for-the-test question

Before writing any assertion, one question settles it: **if a reasonable person changed
the implementation without changing the behaviour, would this assertion still hold?**
Renaming a private field, rewording a message, reordering a `HashSet`, upgrading Jackson —
all "reasonable changes with no behavioural effect". Any assertion that breaks under one
of them is testing the implementation.

The inverse question is just as useful: **if the behaviour broke, would this assertion
catch it?** A test asserting only that `SkuFormatException` was thrown does not catch a
bug where the *wrong* SKU is reported in the error. Both questions have to answer yes.

## Gotchas

**★ `assertEquals` on `getMessage()` as the default exception assertion.**
It is the example in every tutorial, including the JUnit user guide, because a
documentation example needs *something* concrete to assert. It is not a recommendation.

**★ Copying the message assertion pattern into a hundred tests.**
The first one is a nuisance. A hundred of them means every message change is a
multi-file diff, and the team starts pattern-matching the fix instead of reading it.

**★ Asserting a message that includes a value you did not control.**
`"Invalid SKU format: " + input` puts test data into the assertion, so the test breaks when
the test data changes for an unrelated reason.

**★ Treating a message assertion at the domain layer as the API contract test.**
If the message really is the user-facing `detail` of an error response, test it where the
response is produced. A unit test on a domain exception cannot know whether the controller
advice passes the message through, replaces it, or logs it and returns a generic one.

**★ Asserting on `toString()` of a record.**
The generated format is a JDK implementation detail. It has changed before and there is no
promise it will not again.

**★ Asserting on `HashMap`/`HashSet` iteration order.**
Undefined, and stable enough in practice to pass for months before it does not. If the
order is meaningful, the production type is wrong.

**★ Asserting an exact `Instant`.**
`Instant.now()` in production code is untestable by construction. Inject a `Clock`; assert
against a fixed one.

**★ Asserting on a stack trace's contents.**
It is affected by inlining, by the JIT, and — since JUnit 6.0 — by stack-trace pruning,
which the release notes describe as pruning *"up to the test method or lifecycle method"*.

**★ Asserting that a mock method was called, when the observable outcome is available.**
Interaction assertions are implementation assertions unless the interaction *is* the
contract (sending an email, publishing an event). That argument belongs to
**topic 04 · Mockito** *(not written yet)*, and it is the same argument as this page.

## Interview questions

**★ Why is asserting on an exception message usually a mistake?**
Because the message is prose with no stated contract. It gets reworded for clarity, for
translation, for a support ticket — all behaviour-preserving changes that turn the build
red. The test then teaches people to edit tests reflexively, which costs far more than the
assertion was ever worth.

**★ When is asserting on a message correct?**
When the message is genuinely an interface: the `detail` of a `ProblemDetail` response body
that clients read, a string an alerting rule matches, a message rendered in a UI. In those
cases, assert it at the boundary that publishes it, not in a domain unit test.

**★ What do you assert on instead?**
Structured state on the exception — a rejected value, a field name, an error code, a
decline reason. If the exception carries nothing but a message, that is a design signal:
callers cannot react to it programmatically either.

**★ Give three other assertions with the same defect.**
`toString()` output, iteration order of a `HashSet` or `HashMap`, and a full JSON body
compared as a string. All three break under changes that preserve behaviour, and all three
pass while genuine behavioural regressions slip past.

**★ What two questions decide whether an assertion is worth writing?**
Would it still hold after a behaviour-preserving implementation change? And would it fail
if the behaviour actually broke? An assertion that answers no to the first is coupled to
the implementation; one that answers no to the second is decoration.

**★ A test asserts `thrown.getMessage()` and the product owner asks for the wording to
change. What is the right fix?**
Not updating the string. Move the assertion onto structured data the exception exposes, and
if the wording genuinely has a consumer, add one test at that consumer's boundary. Updating
the literal keeps a test whose only function is to object to copy-editing.

{/* FOOTER */}
