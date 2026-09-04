---
title: "Every chunk in this topic answers a question you only have once you are already holding the ticket, so this last one runs in the other direction: here is the ticket, here is which of the preceding chapters applies, and here is the one test worth writing before you touch the code"
sidebar_label: "12 · The checklist"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01. This chunk makes no new technical claims — it routes to the chunks that
> do, and every fact it summarises is verified on the page it points at, against the Spring
> Framework 7.0.x reference and javadoc, the Spring Boot 4.1 reference, and the Mockito, WireMock,
> Awaitility and Testcontainers documentation as cited there.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5,
> Awaitility 4.3.0.
> ⚠️ **No sandbox, no Docker and no test run on this machine.** Nothing on this page or the ones
> it links to reports the output of a run.

**You have a ticket. It says the export is producing the wrong totals for one customer, or that
we need to call the new fraud-check API before authorising, or that the nightly job stopped
running some time last week. The preceding chunks each answer "how do I test this kind of thing";
this one answers the question that comes first — which kind of thing is this, and what do I write
before I start changing code.**

## Three questions, in this order

**1 · What is the boundary I am crossing?** Not "what class am I editing" — what leaves the
process. A method call on a collaborator you own, an HTTP call, a database query, a message, a
clock read, a file. The boundary decides the technique; the class does not.

**2 · Is there a test that would have caught this?** If the answer is no, that test is the
deliverable, and it is worth more than the fix. If the answer is yes but it did not run, that is
a different bug and it is in the build.

**3 · Can I make it fail first?** A regression test written after a fix asserts that the code does
what it now does. Written before, it asserts what the ticket says is wrong. The second one is
evidence; the first is decoration. This is the whole argument for writing the failing test first,
and it is worth the ten minutes even when the fix is obvious.

## The routing table

| The ticket is about… | Start at | The thing people get wrong |
|---|---|---|
| A calculation or a rule inside one class | [01 · What to mock, what to let run](01-what-to-mock-and-what-to-let-run.md) | Mocking the class under test, so the test asserts the mock |
| A collaborator you own | [02 · Mocking a class you own](02-mocking-a-class-you-own.md) | Reaching for a mocking trick where a constructor parameter would do |
| A `final` class, a `static` call, or `new` inside a method | [02c · Construction and final classes](02c-construction-and-final-classes.md) → [02e · The agent tax](02e-the-agent-tax-and-the-decision-table.md) | Paying the inline-mock-maker cost to avoid a five-line refactor |
| A vendor client with a huge surface | [02d · Vendor clients](02d-vendor-clients-and-private-methods.md) | Mocking the vendor type instead of your own interface over it |
| "Test this private method" | [02d2 · The private method](02d2-the-private-method.md) | Reflection, instead of noticing it wants to be its own class |
| Calling an outbound HTTP API | [03 · Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md) | Testing only the 200 |
| What we *send* — headers, auth, body, encoding | [03d · Asserting what you sent](03d-asserting-what-you-sent.md) | Asserting the response and never the request |
| A timeout, a reset, malformed JSON, an HTML error page | [03f · Failures with no status code](03f-the-failures-with-no-status-code.md) | Assuming every failure arrives with a status |
| Rate limits and retries | [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md) | Retrying without honouring the header |
| A third-party SDK | [04 · A third-party SDK](04-a-third-party-sdk.md) | Testing the SDK instead of your adapter |
| A controller: request in, JSON out | [05 · A controller, end-to-end-ish](05-testing-a-controller-end-to-end-ish.md) | Believing the slice proves more than it does |
| "As an authenticated user with role X" | [06 · Security in a test](06-security-in-a-test.md) | Never writing the unauthenticated 401 |
| `@Async`, a listener, "eventually" | [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md) → [07a · Waiting without sleeping](07a-waiting-without-sleeping.md) | `Thread.sleep`, and a suite that is slow *and* flaky |
| A `@Scheduled` job | [07b · Testing a scheduled job](07b-testing-a-scheduled-job.md) | Waiting for the schedule instead of calling the method |
| An application event, or a retry policy | [07c · Events and retries](07c-events-and-retries.md) | Assuming a listener is asynchronous, and not knowing the retry defaults |
| A message consumer | [08 · A message consumer](08-a-message-consumer.md) → [08b · The container and poison messages](08b-the-container-poison-messages-and-redelivery.md) | Testing the handler and calling it done |
| The payload, and what a handler test cannot prove | [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md) | Believing a green handler test covers deserialisation |
| A dead-letter destination | [08b2 · Asserting the dead letter](08b2-asserting-the-dead-letter.md) | Asserting redelivery happened rather than that it stopped |
| A cache | [09 · Caching, and the cache-hit test](09-caching-and-idempotency.md) → [09a · The cache that outlives the test](09a-the-cache-that-outlives-the-test.md) | A cache surviving into the next test, via the context cache |
| A duplicate charge, a replayed request | [09b · Idempotency: the client side](09b-idempotency-and-the-double-charge.md) | Testing the happy path of a mechanism that exists for the unhappy one |
| A payload another team consumes | [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md) | An approval test that is a change-detector |
| A payload with timestamps or ids in it | [10b · Volatile fields and review](10b-volatile-fields-and-the-review-workflow.md) | Pinning a payload that can never match twice |
| Code with no seams at all | [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md) | Refactoring before pinning the current behaviour |
| "Where does this object come from?" | [11b · Three seams for a collaborator](11b-three-seams-for-a-collaborator.md) | Reaching for a mocking agent before trying a parameter |
| "*When* was this value read?" | [11c · Class init, config, and the fifth answer](11c-class-init-config-and-the-fifth-answer.md) | Refactoring at all, when sprouting a new class would do |

## Before the fix: what to write

**A bug ticket.** One failing test at the lowest level that can express the bug. If the bug is in
a calculation, that is a plain unit test with the customer's actual numbers. If it only appears
through a collaborator's behaviour, it is a unit test with that behaviour stubbed. Resist
reproducing it at the highest level available — an end-to-end reproduction is slower, flakier,
and does not localise anything.

**A change to an outbound call.** The request assertion first
([03d](03d-asserting-what-you-sent.md)), because that is the half that breaks silently against a
live provider, and then the failure paths you are now exposed to
([03c](03c-the-error-paths-nobody-writes.md) and [03f](03f-the-failures-with-no-status-code.md)).

**A new endpoint.** The 401 before the 200 ([06b](06b-the-401-and-the-tests-nobody-writes.md)) —
it is the one everybody omits and the one a security review asks about. Then the validation
failure, then the happy path.

**Anything touching money or a downstream mutation.** The double-submit test
([09b](09b-idempotency-and-the-double-charge.md)) before the feature. It is far cheaper to build
idempotency in than to add it after the first duplicate charge.

**Legacy code you were sent to change.** Characterization tests over the current behaviour,
including the behaviour you believe is wrong
([11](11-the-legacy-class-with-no-seams.md)) — you are not endorsing it, you are recording it so
that your change is visible as a diff in test expectations rather than as a surprise in
production.

## Where this connects

- The decision every row above depends on is
  [01 · What to mock, what to let run](01-what-to-mock-and-what-to-let-run.md).
- Coming from a JavaScript or React background, the translation table is
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md), and its limits are
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).
- The mechanisms this topic reuses rather than re-teaches live in
  [04 · Mockito](../04-mockito/README.md), [05 · The test pyramid](../05-the-test-pyramid/README.md),
  [06 · MockMvc](../06-mockmvc/README.md), [07 · Testcontainers](../07-testcontainers/README.md)
  and [08 · Test data patterns](../08-test-data-patterns/README.md).

## Gotchas

**★ The routing table is by boundary, not by layer, and picking by layer is how a service test ends up mocking six things.**
"It is in the service package, so it is a service test" leads to stubbing every collaborator the
class happens to have, most of which the ticket does not touch. Route on what actually crosses a
boundary in the behaviour you are changing: if the fix is arithmetic, the HTTP client and the
repository are irrelevant and stubbing them is noise that will need maintaining forever.

**★ A regression test written after the fix passes on the first run, which is the one piece of evidence it can never give you.**
The value of a bug test is the moment it fails for the reason the ticket describes. Written
afterwards, it asserts the code does what it now does — which is true of any code — and it will
keep passing if a refactor reintroduces the bug in a slightly different form. If you have already
fixed it, revert the fix locally, watch the test fail, and put the fix back. That takes a minute
and converts a decorative test into a real one.

**★ Reproducing a bug at the highest available level feels safest and is the most expensive habit in this topic.**
An end-to-end reproduction proves the bug exists and tells you nothing about where, runs in
seconds instead of milliseconds, and brings its own flakiness. The discipline is to reproduce at
the level of the boundary named in question one, and to add the higher-level test only when the
bug is genuinely about the wiring between layers — which is rarer than it feels while you are
still confused.

**★ "There is already a test for this" is worth checking rather than believing, because the common case is a test that covers the line and asserts nothing about it.**
Before concluding a bug slipped past the suite, find the test and read its assertions. Very often
the code path was executed as a side effect of testing something else, so it counted as covered
and nothing checked the result. That is the coverage argument in
[09 · JaCoCo](../09-jacoco/README.md), and the tool that finds it deliberately is
[11 · Mutation testing](../11-mutation-testing/README.md).

**★ Writing the test first is a rule people abandon exactly when it matters, because "this fix is obvious".**
The obvious fixes are the ones most likely to be wrong in a way nobody notices — an off-by-one in
a boundary condition, a null path, the second call. Ten minutes spent making it fail first is
cheap insurance precisely because you are confident; when you are uncertain you will write the
test anyway.

**★ A ticket that touches two rows of the table is two tests, and merging them produces one that diagnoses nothing.**
"Call the fraud API and cache the result" is an outbound-call ticket and a caching ticket. A
single test that stubs the API, checks the cache hit and asserts the response is fine as an
integration check and useless as a diagnostic: when it goes red, three things could be wrong.
Write the two focused tests, then the combined one if the interaction itself carries risk.

## Interview questions

**★ You are handed a bug ticket. Walk me through what you do before changing any code.**
I work out which boundary the behaviour crosses, because that decides the technique and the level
— an arithmetic bug is a plain unit test, a bug in what we send to a provider is a request
assertion against a mock server, a bug that only appears on the second call is an idempotency or
caching test. Then I write the test that reproduces it and I watch it fail for the reason the
ticket describes, which is the only moment it can prove anything; a test written after the fix
asserts that the code does what it now does, which is true of all code. I also check whether a
test already covers that path, because the usual answer is that it was executed while something
else was being tested and nothing asserted on it — covered but unchecked. Only then do I fix it,
and I keep the reproduction at the lowest level that can express the bug rather than reaching for
an end-to-end test, which is slower, flakier, and localises nothing.

**★ How do you decide what to mock for a given change?**
By what leaves the process in the behaviour I am actually changing, not by what the class happens
to depend on. If the change is a calculation, nothing gets mocked even if the class holds a
repository and an HTTP client, because stubbing them adds setup that has to be maintained forever
and tests nothing. If it crosses a boundary I own, that collaborator gets a mock, and if mocking
it is awkward — a `final` class, a static call, construction inside the method — that awkwardness
is information about the design, and a small refactor is usually cheaper than the mocking
machinery required to avoid it. If it crosses a boundary I do not own, like a vendor SDK, I mock
my own interface over it rather than their type, so the test survives their next major version.
The rule I would state is that the class under test is never mocked and value objects are never
mocked; everything else is a judgement about boundaries.

**★ Your team ships a fix for a duplicate-charge incident. What tests go in with it, and what would you have wanted beforehand?**
Going in with the fix: a test that submits the same request twice and asserts exactly one charge
and one stored result, which is the behaviour the incident was about; a test that the second
response is the same as the first rather than an error, because a client that retried is entitled
to its answer; and a test at the receiving end that a replayed message is recognised and
discarded. Beforehand I would have wanted the double-submit test written when the payment feature
was built, because idempotency is one of the few things that is drastically cheaper to design in
than to retrofit — retrofitting means choosing a key, storing it, and reasoning about every
in-flight request that already exists. The broader lesson I would take to the postmortem is that
the happy path of a mechanism that exists for the unhappy path is not a test of that mechanism,
and the same shape shows up in retries, caches and dead-letter handling.

{/* FOOTER */}
