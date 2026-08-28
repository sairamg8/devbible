---
title: "A mock of a third-party client is a machine-readable copy of your beliefs about that library, and the test that uses it goes green because your beliefs are self-consistent — not because the library agrees with them, which is why the failure arrives one dependency upgrade later with a green build behind it"
sidebar_label: "10b · Types you do not own"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (the *"Don't mock a type you don't own!"*, *"Don't mock everything"* and *"Don't mock value
> objects"* sections), the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) — section 51
> (*"Mark classes as unmockable"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> — and the JDK 25 javadoc for
> [`HttpClient.send`](https://docs.oracle.com/en/java/javase/25/docs/api/java.net.http/java/net/http/HttpClient.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10](10-never-mock-the-class-under-test.md) is about replacing part of your own class. This
is the mirror image: replacing something that is not your class and never was. When you stub
`when(httpClient.send(any(), any())).thenThrow(new IOException())`, the test does not consult
the HTTP client about whether that is what happens — it consults you. Everything downstream is
then verified against your memory of a library's contract, on a build that is green because
the two halves of the test agree with each other. This page is why that goes wrong and where
the line between "yours" and "not yours" actually falls;
[10e · The anti-corruption adapter](10e-the-anti-corruption-adapter.md) is the construction
that makes the question moot, and
[10f · Mocking JDK types](10f-mocking-jdk-types.md) and
[10g · Mocking value objects](10g-mocking-value-objects.md) apply the same argument to the
standard library and to your own data.**

## 🔴 Mockito's own position, in full

The project states this as one of its opinionated principles, and the framing is about design
rather than about safety:

> *"TDD is just as much about design as it is about test, when mocking an external API the
> test cannot be used to drive the design, the API belongs to someone else ; this third party
> can and will change the signature and behaviour of the API."*

Then three consequences, verbatim:

> *"1. Imagine code that mocks a third party lib. After a particular upgrade of a third
> library, the logic might change a bit, but the test suite will execute just fine, because
> it's mocked. So later on, thinking everything is good to go, the build-wall is green after
> all, the software is deployed and… **Boom**"*

> *"2. It may be a sign that the current design is not decoupled enough from this third party
> library."*

> *"3. Also another issue is that the third party lib might be complex and require a lot of
> mocks to even work properly. That leads to overly specified tests and complex fixtures,
> which in itself compromises the compact and readable goal. Or to tests which do not cover
> the code enough, because of the complexity to mock the external system."*

And the prescription, also verbatim:

> *"Instead, the most common way is to create wrappers around the external lib/system, though
> one should be aware of the risk of abstraction leakage, where too much low level API,
> concepts or exceptions, goes beyond the boundary of the wrapper. In order to verify
> integration with the third party library, write integration tests, and make them as compact
> and readable as possible as well."*

The page is careful to say this is *"not a hard line, but crossing this line may have
repercussions! (it most likely will)"*. That is the correct strength: it is a default, not a
compiler error.

## The guess, made concrete

Here is a guess that a very large number of Java developers hold and that a mock will happily
encode. `java.net.http.HttpClient.send` — what does it do when the server answers `404`?

The javadoc lists exactly three thrown exceptions:

> *"`IOException` - if an I/O error occurs when sending or receiving, or the client has shut
> down"*, *"`InterruptedException` - if the operation is interrupted"*, *"`IllegalArgumentException` - if the `request` argument is not a request that could have been
> validly built"*.

An HTTP error status is none of those. `send` returns normally with an `HttpResponse` whose
`statusCode()` is `404`. So this stubbing is a lie:

```java
// Encodes a belief the javadoc contradicts: "a 404 arrives as an exception"
when(httpClient.send(any(), any())).thenThrow(new IOException("not found"));

// and the production code written against that belief
try {
    return parse(httpClient.send(request, ofString()).body());
} catch (IOException e) {
    return Optional.empty();          // "customer not found" — never reached for a 404
}
```

The test passes. In production, `send` returns a `404` response, `body()` is an HTML error
page, `parse` throws something unrelated, and the "not found" path is never taken. The mock
did not test the code; it certified the misunderstanding.

**This is the general shape.** Every stubbing of a type you do not own is an assertion about
that type's contract, written by someone who is not its author, checked by nothing.

## What survives a version upgrade, and what does not

Split the failure modes by whether the compiler sees them:

| The library changes… | With a mock of it | With an adapter you own |
|---|---|---|
| a method signature | **compile error** — you find out | compile error, in one file |
| a return type or nullability | compile error | compile error, in one file |
| **what it does with the same signature** | 🔴 **nothing happens; suite stays green** | the adapter's integration test fails |
| an exception type it throws | 🔴 nothing happens | the adapter's integration test fails |
| a default (timeout, retry, charset) | 🔴 nothing happens | the adapter's integration test fails |
| the meaning of a status code | 🔴 nothing happens | the adapter's integration test fails |

The rows that matter are the ones the compiler cannot see, and they are the majority of what
actually changes between minor versions. A mocked third-party type converts every one of them
from "a test goes red on the branch that upgraded the dependency" into "an incident".

## Where the line actually falls

"Do not mock what you do not own" is not "do not mock anything outside your package". The
question is whether *you* define the contract the mock is asserting.

| Type | Mock it? | Why |
|---|---|---|
| Your `OrderRepository` interface | **yes** | you define the contract |
| Your `ExchangeRates` adapter | **yes** | you define the contract |
| `java.net.http.HttpClient` | **no** | the JDK defines it; wrap it |
| A vendor SDK client class | **no** | the vendor defines it, and changes it |
| `javax.sql.DataSource`, a JDBC `Connection` | **no** | a spec you do not implement; use the real thing |
| A Spring `RestClient` / `JdbcClient` | **no** | wrap; Spring's own test support exists for these |
| `org.slf4j.Logger` | **no**, and do not assert on logging | the contract is the log output, not the call |
| An interface from another team's module in your repo | **prefer not** | you *can* change it — raise the pull request |
| A framework interface you implement (`Converter`, `Filter`) | **situational** | you own the implementation, not the contract |

The last two rows are where honest disagreement lives. The test to apply: *if this type's
behaviour changed under me, would anything in my build tell me?* If the answer is "the
compiler, only if the signature changed", it belongs behind an adapter — which is
[10e](10e-the-anti-corruption-adapter.md).

The JDK is the case people forget is on this list at all. `java.time`, collections and
`Optional` are types nobody owns and almost nobody should mock, and the reasons are specific
enough to be worth their own page: [10f](10f-mocking-jdk-types.md). Your own value objects are
the mirror case — you *do* own them, and mocking them is still always wrong:
[10g](10g-mocking-value-objects.md).

## Gotchas

**★ The green suite after a dependency bump is the failure mode, not the reassurance.**
Verbatim: *"the test suite will execute just fine, because it's mocked. So later on, thinking
everything is good to go, the build-wall is green after all, the software is deployed and…
Boom."* A dependency upgrade that changes no test result, in a codebase that mocks that
dependency, has told you nothing.

**★ Mocking two libraries in one test to reach one assertion.**
The `HttpClient` + `ObjectMapper` pair above is the tell the wiki describes as *"the third
party lib might be complex and require a lot of mocks to even work properly"*. Two mocked
third-party types in one test is a design signal, not a fixture problem.

**★ Mocking `Logger` and verifying log calls.**
It is a type you do not own, and worse, it makes log statements load-bearing — a refactor that
changes a message level breaks a test that has nothing to do with the behaviour. If log output
genuinely matters, assert on a captured appender, not on a mocked logger.

**★ Mocking a Spring or JDK interface because it *is* an interface.**
Mockability is not permission. `DataSource`, `Connection`, `ResultSet` and `RestClient` are all
interfaces and all define contracts you did not write; a mocked `ResultSet` chain is a
particularly complete way of testing your recollection of JDBC.

**★ "But it's just one method" — stubbed with a behaviour the library does not have.**
Method count is not the risk; the risk is that any stubbing at all is a claim about a contract
you do not control. A one-method stub of a third-party client can encode the 404 mistake above
just as thoroughly as a ten-method one.

**★ Reaching for `@DoNotMock` to enforce this.**
It works only on types you can annotate — which, by definition, excludes every type this page
is about. It is still the right tool for your own unmockable types, and it is covered in
[02c · Choosing a mock maker](02c-choosing-a-mock-maker.md); it is not an enforcement
mechanism for this rule. Review is.

## Interview questions

**★ Why is mocking a third-party client a problem when the test passes?**
Because the test passing is a statement about the consistency of your stubbings with your
production code, not about either one's agreement with the library. Mockito's own wiki puts
the consequence plainly: after a library upgrade *"the logic might change a bit, but the test
suite will execute just fine, because it's mocked… the build-wall is green after all, the
software is deployed and… Boom."* The class of change that hurts — behaviour under an
unchanged signature — is exactly the class a mock cannot notice.

**★ Does this rule mean you can never mock an interface from a library?**
No — the wiki itself says *"This is not a hard line, but crossing this line may have
repercussions! (it most likely will)"*. The usable form of the rule is: mock the types whose
contract you define. A framework interface you implement yourself sits in a grey area; a vendor
client class does not.

**★ Someone mocks `ResultSet` to test a row mapper. What is your objection?**
That the test now asserts your recollection of the JDBC specification — when `next()` returns
false, what `getString` does for a NULL column, how column indexes behave — none of which the
mock will ever check against a driver. A real database in a container, or a plain in-memory row
representation the mapper accepts, tests the mapping instead of the memory.

**★ Is mocking another team's internal interface, in the same repository, covered by this rule?**
Softly. The spirit of the rule is "you do not control the contract", and you *can* control that
one — the cost is a pull request rather than an adapter. In practice, treat it as owned if you
are willing to raise that pull request when the contract turns out to be wrong, and as
unowned if you are not.

**★ What is wrong with mocking a logger and verifying that a warning was logged?**
Two things. It is a type you do not own, so the stubbing encodes assumptions about SLF4J's
dispatch. And it makes log text part of the tested contract, so a message reword breaks a test
about behaviour. If a log line is genuinely a requirement, capture the appender's output and
assert on that — it is the observable thing the requirement is actually about.

{/* FOOTER */}
