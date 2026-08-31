---
title: "A controller does three things, so a finished controller test makes three assertions — and the one that is almost always missing is the one that proves the request actually bound to the object the service received"
sidebar_label: "05b · The three assertions"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.8** `@MockitoBean` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/bean/override/mockito/MockitoBean.html))
> for `REPLACE_OR_CREATE` and `enforceOverride`, and the **Spring Framework 7.0.8**
> `RestTestClient` reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/resttestclient.html))
> for `bindToServer` / `bindToApplicationContext`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — this page carries Java source and
> documented behaviour, never console output.

**[05](05-testing-a-controller-end-to-end-ish.md) mapped the slice's edge. This page spends
it: what to assert, in what order, and what the hyphen in "end-to-end-ish" is quietly
excluding. The short version is that most controller tests stop one assertion early, and
the assertion they stop before is the one that catches binding bugs.**

## The three assertions, and the one people skip

A controller does three things, so a complete test asserts three things.

```java
@Test
void placingAnOrderReturns201AndPassesTheBoundRequestThrough() {
    when(orders.place(any())).thenReturn(new OrderId(42));

    assertThat(mvc.post().uri("/orders")
                    .contentType(APPLICATION_JSON)
                    .content("""
                        {"customerId":"c-1","deliverBy":"2026-09-04","lines":[
                          {"sku":"SKU-1","quantity":2}]}
                        """))
            .hasStatus(HttpStatus.CREATED)
            .hasHeader("Location", "/orders/42");

    ArgumentCaptor<PlaceOrder> captor = ArgumentCaptor.forClass(PlaceOrder.class);
    verify(orders).place(captor.capture());
    assertThat(captor.getValue().deliverBy()).isEqualTo(LocalDate.of(2026, 9, 4));
    assertThat(captor.getValue().lines()).singleElement()
            .satisfies(l -> assertThat(l.quantity()).isEqualTo(2));
}
```

1. **The status.** Cheap, and everybody writes it.
2. **The response body.** Also written, usually.
3. **What the controller handed the service.** Almost nobody writes this, and it is where
   binding bugs live: a date that parsed with the wrong format, an enum that silently became
   `null` because the JSON had lowercase, a nested list that arrived empty because the field
   name in the DTO does not match the JSON, a `BigDecimal` that became a `double` and lost a
   penny.

The third assertion is the direct analogue of RTL's *"assert on the arguments the mocked
module was called with"*, and it is skipped for the same reason in both ecosystems: the
first two are green, so the test looks finished. It is not. A controller that returns 201
having passed `deliverBy = null` to the service is a passing test and a broken feature.

## What "end-to-end-ish" is doing in the title

The hyphenated hedge is load-bearing. This test covers a genuinely large amount of your
web layer — and it is not an end-to-end test, because four categories of production
behaviour are outside it.

- **Wiring existence.** `@MockitoBean` uses `REPLACE_OR_CREATE`: *"If a corresponding bean
  does not exist, a new bean will be created"*. Delete `OrderService`'s `@Service`
  annotation and this test still passes, because the mock is created regardless. Only a
  context that loads the real bean can tell you the application still starts.
- **The container.** Tomcat's URL decoding, its handling of a trailing slash, its maximum
  header size, its behaviour on a malformed request line. `MockMvc` synthesises the request
  object rather than parsing bytes.
- **The far side of the mock.** Everything the service does. That is the point of the
  split, but it means "the endpoint works" is a claim this test does not make.
- **Serialization configuration you defined outside the slice.** Discussed above; the
  cheapest guard is a `@JsonTest` on the DTO itself, which
  [10 · JSON contracts](10-json-contracts-and-approval-tests.md) covers.

When you genuinely need the socket, Framework 7 ships `RestTestClient`, an *"HTTP client
designed for testing server applications"* that *"can be used to perform end-to-end HTTP
tests"* and can also *"test Spring MVC applications without a running server via MockMvc"*
— the same façade over both, bound with `bindToServer` for a real port or
`bindToApplicationContext` for the mock route. **Topic 06 · MockMvc** owns the crossing.
The rule of thumb is that you want a small number of real-port tests for the things in the
"outside" column and everything else in the slice.

## Where this connects

- The slice boundary this page assumes is
  [05 · Testing a controller, end-to-end-ish](05-testing-a-controller-end-to-end-ish.md).
- **Topic 06 · MockMvc** owns the assertion APIs — `MockMvcTester`, the classic
  `andExpect` chain, JSON path assertions, and crossing to a real port. **Topic 04 ·
  Mockito** owns `ArgumentCaptor`, matchers and strictness.
- Pinning the *whole* response rather than one path at a time is
  [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md).
- The security dimension of the same request is
  [06 · Security in a test](06-security-in-a-test.md).

## Gotchas

**★ `@MockitoBean` creates the bean if it is missing, so the slice test survives the service
being deleted from the context.**
`REPLACE_OR_CREATE` is the documented default: *"If a corresponding bean does not exist, a
new bean will be created"*. Remove `@Service` from `OrderService`, and your controller test
is still green while the application fails to start. Use `enforceOverride = true` when the
point of the test includes "this bean is actually wired". This is the highest-value
one-word change on this page.

**★ Asserting only on status and body lets a binding bug ship.**
A `POST` that returns 201 proves the controller ran, not that it received what the client
sent. `deliverBy` arriving as `null` because the JSON used `deliver_by`, a quantity of `0`
because the field name was `qty`, an enum silently defaulting — all of these produce a green
201. Capture the service argument and assert on it. If you write only two assertions per
controller test, make them the status and the captured argument, not the status and the
body.

**★ Stubbing the service with `any()` hides the exact bug the third assertion would catch.**
`when(orders.findById(any())).thenReturn(...)` returns the order no matter what the
controller parsed, so a path variable bound to the wrong value still produces a green test.
Stub with the *specific* expected argument — `findById(new OrderId(42))` — and a mis-bound
path variable becomes an unstubbed call returning `null`, which fails loudly. **Topic 04 ·
Mockito** owns matchers and strictness; this is the highest-leverage place to apply them.

**★ An `ArgumentCaptor` holds the reference, not a snapshot, so a mutable DTO can be
asserted after it has already changed.**
If the controller passes a mutable command object to the service and then mutates it — or
if a `@ControllerAdvice`, an interceptor or the controller itself clears a field on the way
out — the captor's `getValue()` returns the object in its *current* state, not its state at
call time. The symptom is an assertion that fails describing a value nothing in the test
ever set. Immutable records make the problem impossible, which is one more reason for
request DTOs to be records.

**★ A `verify` written after a failing response assertion never runs, so the diagnosis you
needed is the one you do not get.**
`assertThat(result).hasStatusOk()` throws on a 400, and the `verify(orders).place(captor…)`
below it never executes — so the failure message says "expected 200 but was 400" and says
nothing about what the controller parsed, which is what you actually wanted to know. When
you are debugging a binding problem, put the capture first, or use AssertJ's
`assertSoftly`/`SoftAssertions` so both report. **Topic 02 · AssertJ** owns soft assertions.

**★ `MockMvc` does not decode the URL the way Tomcat does, so path-encoding bugs survive the
slice.**
A path variable containing an encoded slash, a plus sign in a query parameter, a
double-encoded segment — the container's decoding rules and its security constraints around
them are outside the slice entirely. If your API takes user-supplied text in a path segment,
that is one of the few things genuinely worth a real-port test.

**★ A controller test that needs five `@MockitoBean`s is telling you about the controller.**
Each mock is a collaborator the controller reaches for directly. Five of them means the
controller is orchestrating, which is work that belongs in an application service — and the
orchestration is now only testable through HTTP, which is the slowest and least precise way
to test it. Treat the mock count as a design metric, not a test-setup chore.

**★ Every `@MockitoBean` you add changes the context cache key, so a slice suite with
inconsistent mocks starts several contexts instead of one.**
Two test classes for the same controller, one mocking `OrderService` and the other mocking
`OrderService` plus `Clock`, are two distinct contexts and two startups. This is invisible
until the suite's wall-clock time doubles. **Topic 05 · The test pyramid** owns the cache
key; the practical rule for controller slices is to keep the set of overrides identical
across the test classes that share a slice.

**★ Asserting `hasStatus(200)` on a `POST` that creates something means the contract is
wrong, not the test.**
It is worth being pedantic here because the test is the only place the contract is written
down. A create returns 201 with a `Location`; an accepted-but-not-done returns 202; a
delete returns 204. A test that pins 200 for all of them freezes a contract nobody chose,
and consumers will build on it. The slice is the cheapest possible place to have this
argument.

## Interview questions

**★ You mock the service. What are you now unable to detect?**
Three things. That the service bean exists at all — `@MockitoBean` will create it if it is
missing, so the test survives the wiring being deleted. Anything the service or the layers
below it do, which is deliberate. And any mismatch between the mock's contract and the real
implementation's — if the real service throws where your stub returns `Optional.empty()`,
the controller's behaviour in production differs from the test and nothing here notices.
The last one is the reason mock-based slice tests need a small number of context-loading
tests underneath them, not as a replacement but as a wiring check.

**★ Your controller test passes but the endpoint 404s in production. What are the
candidates?**
In rough order of likelihood: the controller is not being component-scanned in production
because it sits outside the `@SpringBootApplication`'s package, and the slice loaded it
explicitly by class so the scan gap is invisible; a `server.servlet.context-path` or a
`spring.mvc.servlet.path` prefix that the slice does not apply; a reverse proxy stripping or
adding a path segment; and a security rule that denies before the handler mapping runs,
producing what looks like a 404 rather than a 403. Only the first two are findable in the
test suite at all, and both are found by one context-loading test that hits the endpoint,
which is a good argument for having exactly one.

**★ Why capture the argument instead of just stubbing with the exact expected value — are
they not the same assertion?**
They fail differently, and the difference matters when you are the one reading the failure.
A strict stub (`findById(new OrderId(42))`) makes a mis-bound value fail as an *unstubbed
call* returning `null`, which usually surfaces as an unrelated `NullPointerException` or a
404 further down — correct, but the message does not name the problem. A captor fails with
"expected `deliverBy` to be 2026-09-04 but was null", which names it exactly. Use the strict
stub as the tripwire and the captor when the binding of a complex body is the thing under
test; for a `POST` with a nested request object, the captor is worth the three extra lines
every time.

**★ When do you abandon the slice and start a real server?**
When the thing you are worried about is in the "outside" column: URL decoding, TLS,
compression, CORS as a browser actually performs it, streaming or chunked responses,
`Content-Length`, or the behaviour of filters registered by the container rather than by
Spring. Framework 7's `RestTestClient` gives you the same fluent façade over both worlds —
`bindToServer` for a real port, `bindToApplicationContext` for the mock route — so the
migration cost of moving one test across is small. Keep the number small deliberately: a
real-port test is an order of magnitude slower and buys you only the things in that column.

**★ How many tests should one controller endpoint have?**
Fewer than people write, and covering different *shapes* rather than different data. One
happy path with the three assertions; one for each distinct error contract the endpoint
publishes (validation failure, not-found, forbidden); and one for authentication if the
endpoint is protected. Variations of the same shape with different values belong in a
parameterized test or, better, in the service's own unit tests where they run in
microseconds. The anti-pattern is fifteen controller tests that differ only in the request
body, all paying for a Spring context, all testing validation rules that a plain unit test
of the DTO would cover faster.

{/* FOOTER */}
