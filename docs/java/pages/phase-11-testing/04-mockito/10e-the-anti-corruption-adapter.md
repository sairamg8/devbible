---
title: "The way out of mocking a library is a one-method interface written in your own vocabulary, and the thing that makes the pattern real rather than ceremonial is the integration test behind it — without that, you have not removed the guess, you have concentrated it"
sidebar_label: "10e · The anti-corruption adapter"
sidebar_position: 54
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (*"Don't mock a type you don't own!"* — the wrapper prescription and the abstraction-leakage
> warning), and the JDK 25 javadoc for
> [`HttpClient.send`](https://docs.oracle.com/en/java/javase/25/docs/api/java.net.http/java/net/http/HttpClient.html)
> and
> [`Thread.interrupt`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10b](10b-do-not-mock-types-you-do-not-own.md) argues that a mock of a library type is your
guess about that library, certified by nothing. This is the construction that removes the
guess: a thin interface you own, one implementation that knows about the library and nothing
else, and — the half that people skip — an integration test on that implementation. Skip the
integration test and you have not fixed the problem; you have moved all of the unverified
beliefs into one class and made them look tidy.**

## The adapter, before and after

**Before** — the SUT talks to the SDK, so its test must mock the SDK:

```java
public class ExchangeRateService {
    private final HttpClient http;             // java.net.http.HttpClient — not yours
    private final ObjectMapper mapper;         // Jackson — also not yours

    public Money convert(Money amount, Currency to) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE + "?from=" + amount.currency() + "&to=" + to))
                .timeout(Duration.ofSeconds(2))
                .build();
        HttpResponse<String> response = http.send(request, BodyHandlers.ofString());
        BigDecimal rate = mapper.readTree(response.body()).get("rate").decimalValue();
        return amount.times(rate);
    }
}
```

```java
// Before — every test of currency conversion is really a test of your HTTP beliefs
@Mock HttpClient http;
@Mock ObjectMapper mapper;                     // and now a second library's contract too

when(http.send(any(), any())).thenReturn(response);
when(response.body()).thenReturn("{\"rate\":\"1.09\"}");
when(response.statusCode()).thenReturn(200);
```

**After** — one interface, owned by you, named for the role:

```java
public interface ExchangeRates {
    /** @return the rate, or empty if this pair is not quoted. Never throws for an unknown pair. */
    Optional<BigDecimal> rate(Currency from, Currency to);
}
```

```java
public class HttpExchangeRates implements ExchangeRates {
    private final HttpClient http;
    private final ObjectMapper mapper;

    @Override
    public Optional<BigDecimal> rate(Currency from, Currency to) {
        try {
            HttpResponse<String> response = http.send(
                    HttpRequest.newBuilder()
                            .uri(URI.create(BASE + "?from=" + from + "&to=" + to))
                            .timeout(Duration.ofSeconds(2))
                            .build(),
                    BodyHandlers.ofString());
            if (response.statusCode() == 404) {
                return Optional.empty();               // the mapping the SDK does not make
            }
            if (response.statusCode() >= 400) {
                throw new ExchangeRatesUnavailable(response.statusCode());
            }
            return Optional.of(mapper.readTree(response.body()).get("rate").decimalValue());
        } catch (IOException e) {
            throw new ExchangeRatesUnavailable(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();        // restore the flag; do not swallow
            throw new ExchangeRatesUnavailable(e);
        }
    }
}
```

```java
public class ExchangeRateService {
    private final ExchangeRates rates;                // one type, one method, yours

    public Money convert(Money amount, Currency to) {
        return rates.rate(amount.currency(), to)
                .map(amount::times)
                .orElseThrow(() -> new NoQuoteFor(amount.currency(), to));
    }
}
```

```java
// After — the SUT's test knows nothing about HTTP, JSON, status codes or checked exceptions
@Mock ExchangeRates rates;
@InjectMocks ExchangeRateService service;

@Test
void an_unquoted_currency_pair_is_rejected() {
    when(rates.rate(EUR, XYZ)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.convert(Money.of("10.00", EUR), XYZ))
            .isInstanceOf(NoQuoteFor.class);
}
```

Three things changed and all three are the point:

1. **The mock is now of a type you wrote**, so stubbing it cannot encode a false belief about
   anyone else's contract — the contract is one you defined and can enforce.
2. **All the library-specific knowledge is in one file.** Status codes, timeouts, the JSON
   field name, the checked exceptions, the interrupt handling. When the SDK changes, exactly
   one class needs review.
3. **The interface's method count is the leak detector.** `ExchangeRates` has one method and
   no HTTP in its signature. If it grew `HttpResponse` parameters or started throwing
   `IOException`, the wrapper would be leaking, which is the risk the Mockito wiki names.

## 🔴 The adapter's own test is an integration test

This is the part people skip, and skipping it converts the pattern into ceremony. `HttpExchangeRates` contains all the beliefs that used to be spread through the mocks. **Those
beliefs still need checking against the real thing.** The wiki says so directly: *"In order to
verify integration with the third party library, write integration tests."*

So `HttpExchangeRatesTest` is not a Mockito test at all. It runs against something that
actually speaks HTTP — a real dependency in a container, or a local HTTP stub server for a
third-party API you cannot host. That is the argument of **07 · Testcontainers** *(not written
yet)*, and the two pages meet exactly here: the adapter is what makes the number of integration
tests small, and the integration test is what makes the adapter's mock trustworthy in every
other test.

The trade is explicit and it is a good one. Before: dozens of fast tests that all encode a
guess. After: dozens of fast tests that encode a contract you own, plus one slow test that
checks the guess for real.


## Where to put the boundary

An adapter that is too thin leaks; one that is too thick becomes a second application. Two
rules settle almost every case.

**The interface's signature must be expressible to someone who has never heard of the
library.** `Optional<BigDecimal> rate(Currency from, Currency to)` passes. `HttpResponse<String> fetchRate(HttpRequest r) throws IOException` does not — it is a
rename with extra steps, and the coupling it was supposed to remove is still in every caller's
`throws` clause.

**The adapter translates; it does not decide.** Mapping `404` to `Optional.empty()` is
translation: it turns the library's vocabulary into yours. Deciding that an unquoted pair
should fall back to yesterday's rate is a business rule, and putting it in the adapter buries
it behind the one test in your suite that needs a network.

A useful third check: **count the mocks in the adapter's collaborators' tests.** If callers
still mock two things to talk to one boundary, the boundary is in the wrong place.

## The adapter is also where the ugly parts go

Every library has behaviour you must handle and would rather not repeat. Concentrating it is
half the value of the pattern:

- **Checked exceptions.** `IOException` and `InterruptedException` stop at the adapter and
  become one unchecked domain exception. Nothing downstream declares `throws`.
- **The interrupt flag.** `catch (InterruptedException e) { Thread.currentThread().interrupt(); … }` is easy to get wrong and easy to forget;
  in the adapter it is written once. Swallowing an `InterruptedException` without restoring the
  flag hides a cancellation request from every layer above.
- **Timeouts and retries.** The `Duration.ofSeconds(2)` above lives with the code that knows
  what the remote system is like, not scattered through services.
- **Serialisation.** The JSON field name `"rate"` appears exactly once in the codebase.
- **Nullability.** Whatever the library returns for "absent" — `null`, an empty string, a
  sentinel — becomes `Optional.empty()` at the boundary and never travels inward.

That list is also the list of things a mock of the library would have let you get wrong
silently, because a stub returns whatever you told it to.

## Gotchas

**★ An adapter that leaks the library through its own signature.**
`interface ExchangeRates { HttpResponse<String> fetch(...) throws IOException; }` is a rename,
not an adapter. The wiki's warning is *"the risk of abstraction leakage, where too much low
level API, concepts or exceptions, goes beyond the boundary of the wrapper"*. If the interface
mentions the library's types, its exceptions or its vocabulary, nothing was decoupled.

**★ Writing the adapter and never writing its integration test.**
All the risky beliefs are now concentrated in one unverified class. That is arguably worse
than before, because the concentration creates the impression of rigour. The adapter and its
integration test are one deliverable.

**★ Mocking the adapter's *implementation* class rather than its interface.**
`mock(HttpExchangeRates.class)` puts you straight back where you started: the stubbing now
describes the HTTP implementation's behaviour, and the class it belongs to is the one class
whose real behaviour you care about. Mock `ExchangeRates`.

**★ Treating the adapter as a place to put logic.**
The adapter translates; it does not decide. Business rules that drift into `HttpExchangeRates`
end up only reachable through the slow integration test, which is exactly the coverage you were
trying to avoid needing.

**★ One adapter per library instead of one per role.**
`VendorSdkWrapper` with fourteen methods is the SDK with a different package name. The unit of
extraction is the capability your application needs — `ExchangeRates`, `PaymentAuthorisation`
— not the surface the vendor happens to ship.

**★ Swallowing `InterruptedException` in the adapter.**
`catch (InterruptedException e) { return Optional.empty(); }` loses the interrupt flag, so
nothing above ever learns the thread was asked to stop. Restore it with
`Thread.currentThread().interrupt()` before translating, every time.

**★ Letting the library's exception type escape as the adapter's own.**
Rethrowing `IOException` from `rate(...)` — even wrapped in `RuntimeException` without a domain
type — pushes the library's failure vocabulary into the caller's `catch` blocks, and now those
callers' tests stub `IOException` again. Define the domain exception.

**★ Adding a method to the interface because one test needed it.**
The interface grows toward the SDK one convenience method at a time, and the leak reappears
gradually rather than all at once. A new method on an adapter interface should be justified by
a new capability the application needs, not by a test's convenience.

## Interview questions

**★ What do you do instead of mocking a library?**
Put a thin interface you own in front of the library, expressed in your domain's vocabulary,
and mock that. All the library-specific knowledge — status codes, exception types, timeouts,
serialisation — concentrates into a single implementation class, and the rest of the codebase
tests against a contract you defined. Mockito's wiki calls this the wrapper and warns about the
one way to get it wrong: abstraction leakage, where the library's types or exceptions appear in
the wrapper's own signature.

**★ How is the adapter itself tested?**
Not with mocks. It gets an integration test against the real dependency — a container, or a
local HTTP stub server for an API you cannot run — because it is the one class whose whole job
is being right about somebody else's behaviour. That is also why the adapter is worth having
even though it is more code: it makes the number of slow tests small and bounded.

**★ How do you tell an adapter from a rename?**
Look at the interface's signature. If it mentions the library's types, throws the library's
exceptions, or uses its vocabulary, it is a rename and everything downstream is still coupled.
A real adapter's signature is expressible to someone who has never heard of the library.

**★ Isn't this just more code for the same behaviour?**
It is more code, and it buys three things a mock cannot: the library's contract is checked once
against the real thing instead of guessed at in every test; a version upgrade that changes
behaviour under an unchanged signature fails a test instead of shipping; and the fast tests
stop containing HTTP, JSON and checked exceptions that have nothing to do with what they are
asserting.

**★ Where do you draw the boundary — one adapter per library, or per use?**
Per capability the application needs. An adapter named after the vendor tends to grow toward
the vendor's whole surface; an adapter named after the role — `ExchangeRates`,
`PaymentAuthorisation` — has an obvious stopping point, and its interface stays small enough
that a stub of it is one line.

**★ Why does the interrupt flag come up in a discussion about mocking?**
Because it is a concrete example of the class of detail an adapter concentrates and a mock
erases. A stub of `HttpClient.send` never throws `InterruptedException` unless you tell it to,
so no test ever exercises the handling; and the handling — restoring the flag with
`Thread.currentThread().interrupt()` before translating the failure — is exactly the kind of
thing that is wrong in most codebases precisely because nothing forces it to be right.

{/* FOOTER */}
