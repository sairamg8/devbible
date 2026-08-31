---
title: "Every reflex you built testing React has a Java equivalent — jest.mock, msw, render, waitFor, useFakeTimers, spyOn and snapshots all map onto something — but four of the mappings are lies, and those four are where a JS developer's Java tests go wrong"
sidebar_label: "01b · The JS-to-Java map"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc (§13 spying, §48 static
> mocking, §55 `assertArg`), read from `mockito-core-5.23.0-javadoc.jar`; the **Spring
> Framework 7.0.x** reference *Testing Client Applications*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-client.html))
> and the `MockMvcTester`, `MockRestServiceServer`, `MockRestResponseCreators` and
> `ContentRequestMatchers` javadocs; the **Awaitility 4.3.0** javadoc
> ([javadoc.io](https://javadoc.io/static/org.awaitility/awaitility/4.3.0/org/awaitility/Awaitility.html));
> the **WireMock** JUnit 5 documentation ([wiremock.org](https://wiremock.org/docs/junit-jupiter/));
> and **JEP 451** ([openjdk.org](https://openjdk.org/jeps/451)) for dynamic agent loading.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Awaitility 4.3.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java and JS source and documented
> behaviour only, never console output.

**If you have written React tests, you already own the vocabulary this topic needs:
replace the module, intercept the network, render the thing, wait for the async bit,
assert what was sent. Java has an answer for every one of those. This chunk is the
translation table, written the way you would actually consult it: six tables, and a third
column that tells you where each equivalence is only approximate. Four of the rows are
flagged as not equivalences at all — they are marked 🔴 and they get their own chunk,
[01c · Where the analogy breaks](01c-where-the-analogy-breaks.md), because those four are
where every developer coming from Jest writes their first bad Java test.**

## How to read the tables

These are equivalents of **purpose**, not of mechanism. `jest.mock` and `@Mock` both give
you "the collaborator does what I say", but they get there so differently that the second
column is often a *design change* rather than a library call. The third column is the
catch, and it is the column to read.

## 1 · Replacing a collaborator

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `jest.fn()` | `mock(Sender.class)`, or a `@Mock Sender sender;` field | The Java mock is typed. A misspelled method is a compile error, not a silent `undefined`. |
| `jest.mock('./paymentClient')` | Constructor injection + `@Mock` + `@InjectMocks` | 🔴 **There is no module interception.** The class has to *accept* the collaborator. See [break 1](01c-where-the-analogy-breaks.md). |
| `jest.mock('./x', () => ({...}))` — factory form | A hand-written fake class implementing your interface | Java fakes are cheap when the interface is small. If writing the fake is painful, the interface is too wide. |
| `mockFn.mockReturnValue(v)` | `when(mock.m()).thenReturn(v)` | — |
| `mockFn.mockResolvedValue(v)` | `when(mock.m()).thenReturn(v)` | A blocking Java call *is* the resolved value. On a reactive stack: `thenReturn(Mono.just(v))`. |
| `mockFn.mockRejectedValue(e)` | `when(mock.m()).thenThrow(e)` | If the method declares no such checked exception, Mockito refuses — a genuine improvement. |
| `mockFn.mockImplementation(fn)` | `when(mock.m(any())).thenAnswer(inv -> ...)` | `inv.getArgument(0)` for the argument. |
| `.mockReturnValueOnce(a).mockReturnValueOnce(b)` | `thenReturn(a, b)` | Consecutive stubbing: after the values run out, the **last one repeats forever**, it does not fall back to the default. |
| `expect(fn).toHaveBeenCalledWith(x)` | `verify(mock).m(x)` | Matching is by `equals()`. Records and Lombok `@Value` give you that free; a hand-written DTO without `equals` will never match. |
| `expect(fn).toHaveBeenCalledTimes(2)` | `verify(mock, times(2)).m(any())` | — |
| `expect(fn).not.toHaveBeenCalled()` | `verify(mock, never()).m(any())` | — |
| `fn.mock.calls[0][0]` | `ArgumentCaptor`, or `verify(m).send(assertArg(a -> ...))` | `assertArg(Consumer)` arrived in Mockito 5.3 and is usually shorter than a captor. |
| `jest.clearAllMocks()` in `beforeEach` | Nothing to write | `MockitoExtension` creates fresh mocks per test method. See [break 2](01c-where-the-analogy-breaks.md). |
| `jest.mock` of a module used deep in the tree | `@MockitoBean` in a Spring test | Replaces the **bean in the context**, not the type everywhere. **Topic 05** owns it. |

## 2 · Replacing the network

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `global.fetch = jest.fn()` | ⛔ Don't. Mock your own gateway interface instead | Mocking `RestClient` itself is the "wrong altitude" failure from [01a](01a-the-four-failure-modes.md). |
| `nock('https://api').get('/u/1').reply(200, body)` | `MockRestServiceServer.bindTo(builder).expect(requestTo("...")).andRespond(withSuccess(body, APPLICATION_JSON))` | No socket at all — it swaps the `ClientHttpRequestFactory`. [03](03-mocking-an-outbound-http-api.md). |
| `msw` `setupServer(http.get(...))` | WireMock (`@WireMockTest`) or OkHttp `MockWebServer` | A **real socket**, so the real client, real TLS options and real serialization run. [03b](03b-wiremock-and-mockwebserver.md). |
| `msw` handlers module | WireMock stub-mapping JSON under `src/test/resources/mappings` | WireMock loads them from the file source automatically. |
| `nock.isDone()` | `mockServer.verify()` | *"Verify that all expected requests set up via `expect(RequestMatcher)` were indeed performed."* |
| `nock` failing on an unmatched request | WireMock's JUnit 5 extension does this by default: *"if the WireMock instance receives unmatched requests during a test run an assertion error will be thrown and the test will fail"* | Turn it off with `.failOnUnmatchedRequests(false)` — rarely what you want. |
| `msw` `passthrough()` | `ExecutingResponseCreator` | Documented in the Framework reference: respond to one expectation by making the real call while stubbing the rest. |
| `nock.cleanAll()` in `afterEach` | `mockServer.reset()`, or WireMock's automatic reset | WireMock's extension *"will reset the stubs and any requests that have been made"* before each test method by default. |

## 3 · Rendering the thing

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `render(<UserCard />)` | `@WebMvcTest(UserController.class)` + `MockMvcTester` | 🔴 Different layer, different omissions. See [break 3](01c-where-the-analogy-breaks.md). |
| `screen.getByRole('heading')` | `assertThat(mvc.get().uri("/users/1")).bodyJson().extractingPath("$.name")` | The "query" is a JSON path, not a DOM query. |
| `userEvent.click(saveButton)` | `mvc.post().uri("/users").contentType(APPLICATION_JSON).content(json)` | You send the request the button would have sent. |
| `expect(el).toBeInTheDocument()` | `.hasStatusOk()`, `.hasBodyTextEqualTo("...")` | `MockMvcTester` is the AssertJ-flavoured API: *"Simple, single-statement assertions can be done wrapping the request builder in `assertThat()`"*. |
| Mocking a hook or a context provider | `@MockitoBean` on the service the controller calls | The slice does not load `@Service` beans, so you must supply them. |
| Cypress / Playwright | `@SpringBootTest(webEnvironment = RANDOM_PORT)` with `RestTestClient` or `TestRestTemplate` | A real connector on a real port. Boot 4's reference names `RestTestClient` alongside `WebTestClient` for this. |

**Topic 06 · MockMvc** owns everything about that slice; this row exists only to tell you
which door to open.

## 4 · Time, waiting and the async bit

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `jest.useFakeTimers()` | Inject a `Clock` and pass `Clock.fixed(...)` | 🔴 There is **no global time freeze** in Java. See [break 4](01c-where-the-analogy-breaks.md). |
| `jest.setSystemTime(d)` | `Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC)` | Production code must read time *through* the injected clock or nothing changes. |
| `jest.advanceTimersByTime(1000)` | A mutable test clock you write (below) | About eight lines and worth having in every codebase. |
| `await waitFor(() => expect(...))` | `await().atMost(Duration.ofSeconds(2)).untilAsserted(() -> assertThat(...))` | Awaitility 4.3.0, managed by Boot. Defaults: 10 s timeout, 100 ms poll interval, 100 ms poll delay. |
| `await screen.findByText('Done')` | `await().until(() -> repo.findById(id).isPresent())` | — |
| `await act(async () => ...)` | Nothing — the call is blocking | The whole category of "flush the microtask queue" does not exist. |
| `jest.setTimeout(10000)` | `@Timeout(10)` on the method, or `assertTimeoutPreemptively(...)` | **Topic 01 · JUnit** owns these. |
| `Thread.sleep(500)` in a test | ⛔ Never. Use Awaitility | A sleep is either too short (flaky) or too long (slow), and usually both on different machines. |

The mutable clock, since the table promises it and the rule is never to name a fix
without showing it:

```java
public final class MutableClock extends Clock {

    private Instant instant;
    private final ZoneId zone;

    public MutableClock(Instant start, ZoneId zone) {
        this.instant = start;
        this.zone = zone;
    }

    public static MutableClock at(String isoInstant) {
        return new MutableClock(Instant.parse(isoInstant), ZoneOffset.UTC);
    }

    /** The jest.advanceTimersByTime equivalent. */
    public void advance(Duration amount) { this.instant = this.instant.plus(amount); }

    @Override public Instant instant()          { return instant; }
    @Override public ZoneId  getZone()          { return zone; }
    @Override public Clock   withZone(ZoneId z) { return new MutableClock(instant, z); }
}
```

```java
@Test
void aTokenExpiresAfterFifteenMinutes() {
    MutableClock clock = MutableClock.at("2026-01-01T00:00:00Z");
    TokenService tokens = new TokenService(clock);

    Token token = tokens.issue("user-1");
    clock.advance(Duration.ofMinutes(14));
    assertThat(tokens.isValid(token)).isTrue();

    clock.advance(Duration.ofMinutes(2));
    assertThat(tokens.isValid(token)).isFalse();
}
```

Note what this does **not** do: it does not make a `@Scheduled` method fire, and it does
not release a thread blocked in `Thread.sleep`. `jest.advanceTimersByTime` does both,
because Jest owns the event loop. Java's clock is a value you read, not a scheduler you
control — which is [break 4](01c-where-the-analogy-breaks.md).

## 5 · Spies, partials and snapshots

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `jest.spyOn(obj, 'm')` | `@Spy` on a real instance, or `spy(realObject)` | Mockito **copies** the object: *"Mockito does not delegate calls to the passed real instance, instead it actually creates a copy of it."* Mutating the original afterwards is invisible to the spy. |
| `jest.spyOn(obj,'m').mockImplementation(...)` | `doReturn(v).when(spy).m()` | 🔴 Not `when(spy.m())` — that **calls the real method** while arranging the stub. The javadoc's own example is a spy on an empty list throwing `IndexOutOfBoundsException` during `when(spy.get(0))`. |
| `jest.spyOn` then `mockRestore()` | Nothing — the spy dies with the test instance | Break 2 again. |
| `jest.spyOn(console, 'log')` | Boot's `OutputCaptureExtension` (`@ExtendWith(OutputCaptureExtension.class)`) | Asserting on log output is a last resort in both languages. |
| `expect(payload).toMatchSnapshot()` | `content().json(expectedJson, JsonCompareMode.LENIENT)` — or an approval-testing library | 🔴 There is **no `jest -u`**. Java has no blessed auto-update, which is a feature: see chunk 10. |
| `toMatchInlineSnapshot()` | The expected JSON as a Java text block right in the test | Text blocks make the inline form genuinely pleasant. |
| Snapshotting a whole render tree | Pinning one endpoint's JSON payload | **Chunk 10 · JSON contracts and approval tests** in this topic. |

The comparison mode is the part with no Jest analogue at all, and it is the useful part.
`JsonCompareMode` (Spring Framework 6.2+) has exactly two constants — `LENIENT` and
`STRICT` — and the `ContentRequestMatchers.json(String)` overload without a mode is
documented as *"lenient checking (extensible, and non-strict array ordering)"*. Lenient
means **extra fields in the actual payload do not fail the test**. That is the right
default for a consumer asserting a contract it depends on, and the wrong default for a
producer pinning exactly what it emits.

## 6 · The rest of the toolchain

| React / Jest | Java / Spring | The catch |
|---|---|---|
| `describe('...', () => {...})` | `@Nested class ...` | Nested classes inherit the outer class's fields and `@BeforeEach`, which `describe` also does. **Topic 01** owns them. |
| `it.each([[1,2],[3,4]])('...')` | `@ParameterizedTest` + `@CsvSource` / `@MethodSource` | **Topic 03** owns every source. The Java version is typed, so a wrong column is a compile error. |
| `it.skip` / `it.only` | `@Disabled("reason")` / tags plus a filter | There is no `.only`. Jupiter has no "run just this one" annotation — you filter by tag, method or IDE. |
| `beforeAll` / `afterAll` | `@BeforeAll` / `@AfterAll` (static, unless `@TestInstance(PER_CLASS)`) | The `static` requirement surprises everyone once. |
| `jest --coverage` | JaCoCo, wired into Maven/Gradle | **Topic 09**. Branch coverage and line coverage are reported separately and the difference matters. |
| `jest --watch` | The IDE's continuous test runner, or Gradle `--continuous` | No first-class watch mode in Maven. |
| `faker` / factory functions | Builders and object mothers | **Topic 08**. Random data in a test is a flake generator unless the seed is pinned. |
| `fast-check` property tests | jqwik | **Topic 10**. |
| Testing against a real Postgres in CI | Testcontainers | **Topic 07**. This one has no mainstream JS equivalent that is as normalised — it is the capability Java testing has and JS mostly does not. |

## Where this connects

- The decision the whole map serves — mock at a boundary you own — is
  [01](01-what-to-mock-and-what-to-let-run.md), and the four ways it goes wrong are
  [01a](01a-the-four-failure-modes.md).
- The four places the analogy stops being an analogy — no module registry, inverted
  reset, different slice layers, and a clock that is not a scheduler — are
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).
- The `jest.mock` reflex applied to a class you own:
  [02](02-mocking-a-class-you-own.md). Applied to something with no seam:
  [02b](02b-when-the-collaborator-is-hard-to-mock.md).
- The `nock`/`msw` row in full: [03](03-mocking-an-outbound-http-api.md) for the in-process
  route and [03b](03b-wiremock-and-mockwebserver.md) for the real socket.

## Gotchas

**★ `when(spy.method())` calls the real method before it stubs anything — this is the single most common Jest-to-Mockito injury.**
`jest.spyOn(obj, 'm').mockReturnValue(v)` never invokes `m`. Mockito's `when(spy.m())` must *evaluate* `spy.m()` to know which call you are stubbing, and on a spy that runs the real body. The javadoc's own example is stubbing `get(0)` on a spied empty list, which throws `IndexOutOfBoundsException` while you are still writing the arrangement. The fix is the `doReturn`/`doThrow`/`doAnswer` family: `doReturn("foo").when(spy).get(0);`. There is no such asymmetry in Jest, so nothing in your instincts warns you.

**★ `thenReturn(a, b)` keeps returning `b` forever; `mockReturnValueOnce` chains fall back to the base implementation.**
Jest's `mockReturnValueOnce(a).mockReturnValueOnce(b)` gives you `a`, `b`, then whatever `mockReturnValue`/the real implementation says. Mockito's consecutive stubbing gives you `a`, `b`, `b`, `b`, … forever. A retry test that expects "fail, fail, then succeed" and stubs two failures will loop on the second failure rather than reaching the success path. State the success explicitly as the last value.

**★ `verify(mock).send(dto)` compares with `equals()`, so a DTO without `equals` can never match.**
Jest's `toHaveBeenCalledWith` does a structural deep-equality check by default. Mockito uses Java's `equals`, which for a plain class is identity. Because the DTO your production code constructed is a different instance from the one your test built, the verification fails with a message that looks like the values differ when they are in fact identical. Use a `record`, or capture the argument and assert on its fields — `verify(m).send(assertArg(d -> assertThat(d.email()).isEqualTo("a@b.c")))`.

**★ There is no `jest -u`, and treating that as a missing feature produces the worst kind of snapshot test.**
Jest's auto-update makes it cheap to accept a diff without reading it, which is how snapshot suites become change-detectors nobody trusts. Java's absence of that button is why JSON pinning tests here tend to be *smaller and deliberate* — one endpoint, one payload, LENIENT or STRICT chosen on purpose. If you find yourself writing a script to regenerate expected JSON files, you have re-invented `-u` and will inherit its problem.

**★ `Clock.fixed` freezes the clock so hard that a "how long did it take" assertion always reads zero.**
`Duration.between(start, end)` where both come from a fixed clock is always `ZERO`. Code that logs elapsed time, enforces a minimum interval, or computes a rate will behave in ways no production run ever will. That is normally fine and occasionally the exact thing under test — in which case use the `MutableClock` above and advance it between the two reads.

**★ Awaitility's default timeout is 10 seconds, and a suite of failing eventual assertions is a ten-second-per-test suite.**
Unlike `waitFor`'s 1000 ms default, Awaitility waits ten seconds before it gives up (poll interval 100 ms, poll delay 100 ms). Twenty failing async tests is over three minutes of CI spent waiting for things that will never happen. Set `.atMost(Duration.ofSeconds(2))` explicitly, per test, at a value that is generous for the operation and hostile to a hang.

**★ `@Mock` fields are `null` until something initialises them, and the something is not always there.**
Jest's `jest.fn()` is an expression; it cannot be forgotten. `@Mock` is a request that `MockitoExtension` — or `MockitoAnnotations.openMocks(this)` — fulfils. Copy a test class without its `@ExtendWith(MockitoExtension.class)` and every mock is `null`, producing a `NullPointerException` that points at your service rather than at the missing annotation.

**★ Mixing a matcher and a raw value in one call throws, and Jest lets you do it freely.**
`expect(fn).toHaveBeenCalledWith(expect.anything(), 'user-1')` is fine in Jest. `verify(mock).send(any(), "user-1")` is not: Mockito requires that if *any* argument uses a matcher, *all* of them do. The failure is an `InvalidUseOfMatchersException` that often surfaces in a *later*, unrelated test, because the stray matcher is left on an internal stack. Use `eq("user-1")` for the literal.

**★ `@InjectMocks` fails quietly — it leaves fields null rather than telling you it could not wire them.**
There is no Jest analogue for this because Jest never wires anything. If the class under test gained a fifth constructor parameter and your test class has only four `@Mock` fields, `@InjectMocks` will still construct something, and you get a `NullPointerException` inside the service. Prefer explicit construction — `new CheckoutService(payments, orders, clock)` — which turns the same mistake into a compile error.

## Interview questions

**★ Your team's JS tests use `msw`. What is the equivalent for a Spring service calling a payment API, and is there more than one answer?**
There are two, at different levels, and choosing between them is the actual question. `MockRestServiceServer` is the in-process equivalent of `nock`: it swaps the client's `ClientHttpRequestFactory`, so no socket is opened, and it lets you both stub the response and assert the outgoing request. It is fast and it is the natural fit for a client's own unit test. WireMock or OkHttp's `MockWebServer` is the equivalent of `msw` in its "real server" mode: an actual HTTP listener, so the production client, its connection pool, its timeouts and its serialization all run for real. Spring's own reference now recommends the second by default, saying `MockRestServiceServer` *"predates the existence of mock web servers"* and that *"at present, we recommend using mock web servers for more complete testing of the transport layer and network conditions."* I would use `MockRestServiceServer` for the fast assertion of what was sent, and a mock web server for the error and timeout paths, which are the ones that need a real transport.

**★ A colleague translates `expect(sender.send).toHaveBeenCalledWith({to: 'a@b.c'})` into `verify(sender).send(new Email("a@b.c"))` and it fails even though the values look identical. Why?**
Because Jest's `toHaveBeenCalledWith` does a structural deep comparison and Mockito's argument matching uses `equals()`. If `Email` is a plain class without an `equals` implementation, `equals` is identity, and the instance the production code built can never be equal to the instance the test built — so the verification fails with a message showing two objects that print the same. The fixes, in order of preference: make `Email` a `record`, which generates `equals` from the components; or stop comparing whole objects and assert on the fields, either with an `ArgumentCaptor` or with Mockito 5.3's `assertArg(Consumer)` inside the `verify` call, which reads better and produces an AssertJ failure message instead of a Mockito one.

**★ What replaces `describe` and `it.each` in JUnit, and what does not survive the translation?**
`describe` becomes `@Nested` inner classes, which give you the same grouping and the same inherited setup, with the bonus that the IDE and the report show the nesting. `it.each` becomes `@ParameterizedTest` with a source — `@ValueSource`, `@CsvSource`, `@MethodSource`, `@EnumSource` — and it is strictly better in one respect: the parameters are typed, so a wrong column is a compile error rather than an `undefined` at run time. What does not survive is `it.only`. Jupiter has no "run only this" annotation; you narrow the run with tags, an IDE gesture, or a build-tool filter. In practice that is a small loss and arguably a safety feature, because `.only` is the single most commonly committed-by-accident piece of JS test code.

**★ What is the Java equivalent of `jest --coverage`, and why is the answer less satisfying?**
JaCoCo, wired into the Maven or Gradle build (**topic 09** owns it). The mechanics are comparable, but the interpretation is where Java teams get into trouble in a way Jest teams also do: the headline number is line coverage, which measures execution, not assertion. A test that runs a method and asserts nothing scores identically to one that asserts everything. JaCoCo does report branch coverage separately, which is a better signal, and it is the number worth putting a floor under. The genuinely more useful answer to "are these tests any good" is mutation testing with PIT (**topic 11**), which has no mainstream JS equivalent in common use — it changes the production code and asks whether any test noticed, which is exactly the question coverage cannot answer.

{/* FOOTER */}
