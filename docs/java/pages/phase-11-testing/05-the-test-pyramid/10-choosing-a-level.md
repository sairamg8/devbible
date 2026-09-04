---
title: "The decision is not which annotation to use, it is what the assertion is about — and the level follows from that answer mechanically, because a test can only observe what its context actually configured, so anything above the level that owns the behaviour is expensive and anything below it is impossible"
sidebar_label: "10 · Choosing a level"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.1 reference *Testing*
> ([spring-boot-applications](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html))
> and the *Test Auto-configuration Annotations* appendix
> ([slices](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html));
> every mechanism referenced here is sourced in the chunk it links to, and this page adds no new
> claims about the framework.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> **No sandbox** — Java source only.

**Every other chunk in this topic explains a mechanism. This one is the decision they exist to
support, and it is a single question asked in the right order — not a preference, not a ratio, and
not a rule about how many tests of each kind a codebase should have.**

## The question

> **What is this test's assertion actually about?**

Not "what does the code touch". A method can touch six layers and still make a claim about
exactly one of them. The level is decided by the claim.

## The procedure

**1 · Is the claim about a value your code computes?**
A total, a validation outcome, a state transition, a formatted string, a decision. → **Level 0**:
construct the class with `new`, no Spring at all ([02](02-a-unit-test-needs-no-spring.md)).
This is the answer far more often than the length of this topic suggests.

**2 · Is the claim about a decision the *framework* makes?**
Which handler serves a URL, what SQL a derived method name produces, how Jackson renders a field,
whether a constraint fires. → **A slice**, chosen by which framework
([03c](03c-the-slice-catalogue.md)). Your code cannot be asked these questions directly, because
your code is not the thing deciding.

**3 · Is the claim about how *several* configured components fit together?**
A transaction spanning two repositories, security applied to a real handler chain, an event
crossing a commit boundary. → **`@SpringBootTest`** ([04](04-springboottest.md)) with the
narrowest `webEnvironment` that can express it ([04b](04b-webenvironment.md)).

**4 · Is the claim about HTTP itself, or about a real external system?**
Wire format, a client library, a genuine SQL dialect. → `@SpringBootTest(webEnvironment = RANDOM_PORT)`,
Testcontainers, or both ([topic 07](../07-testcontainers/01-passed-on-h2-proves-nothing.md)).

**Stop at the first "yes".** Each level costs an order of magnitude more than the one above it and
answers a question the one above it cannot.

## The rule that makes step 1 sharp

If your answer to *"what would have to break for this to fail?"* is a line of **your own code**,
you are at level 0 and you should stay there. If it is a line of **Spring's** code, you need the
level that configures that part of Spring.

That is the whole heuristic, and it disposes of most disagreements about test levels — including
the common one where someone insists a service test "needs the context" because the service is
annotated. It does not: the annotations tell the container how to build the object, and once built
it is an ordinary Java object ([02](02-a-unit-test-needs-no-spring.md)).

## Worked: the Phase 9/10 order service, three ways

The service the earlier phases built has a controller, a service with a transactional method, and a
repository with a hand-written query. It gets tested at three levels, and **each test asserts
something the other two cannot**.

**Level 0 — the domain rule.**

> *An order over £100 gets free shipping, unless it is to a non-mainland postcode.*

The claim is about a value the code computes. `new`, two arguments, an assertion. No context, no
cache key, sub-millisecond. **This is where the interesting cases live** — the boundary at exactly
£100, the null postcode, the overseas edge — and where a table-driven
`@ParameterizedTest` ([topic 03](../03-parameterized-tests/README.md)) covers twenty of them for the
price of one.

**Slice — the web contract.**

> *`POST /orders` with an invalid payload returns 400 and a body naming the offending field.*

The claim is about a decision Spring MVC makes: bean validation firing, the exception handler
mapping it, the message converter rendering it. Your code does not make any of those choices, so no
level-0 test can observe them. `@WebMvcTest` with the service as a `@MockitoBean`
([06](06-bean-overriding.md)) — small context, shared with every other `@WebMvcTest`.
Topic 06 owns the detail.

**Slice — the query.**

> *`findOverdue(cutoff)` returns orders whose status is `PENDING` and whose date precedes the
> cutoff, and no others.*

The claim is about SQL — generated or hand-written — which only a real database can answer
honestly. `@DataJpaTest` against Testcontainers PostgreSQL, not H2, because the dialect difference
*is* the thing under test ([topic 07](../07-testcontainers/01-passed-on-h2-proves-nothing.md)).

**And the one integration test.**

> *Placing an order reserves stock and publishes an event, and if reservation fails nothing is
> persisted.*

The claim is about the transaction boundary — several configured components and a rollback. That is
`@SpringBootTest`, and it is genuinely the only level that can see it. **One such test, not
twenty**: the phase gate asks for the service covered three ways with the suite still running in
seconds, and that is achievable precisely because the expensive level is used once, for the claim
only it can make.

## The two failure modes

**Testing too high** is the common one and the expensive one. A `@SpringBootTest` mocking five
collaborators to assert a calculation starts an entire application to test one method. It is slow,
it fragments the context cache ([06b](06b-overriding-changes-the-cache-key.md)), and when it fails
the set of possible causes is the whole application.

**Testing too low** is rarer and more dangerous, because it produces confidence rather than delay.
A unit test of a repository class with a mocked `EntityManager` asserts that you called the methods
you called. It cannot tell you the query is valid, the mapping is right, or the constraint exists.
It passes forever, including the day the query stops working — and topic 04's
[10 · Never mock the class under test](../04-mockito/10-never-mock-the-class-under-test.md) is the
general form of the mistake.

**The asymmetry matters.** Testing too high wastes minutes. Testing too low wastes the test.

## Gotchas and pitfalls

**★ Choosing the level from what the code touches.**
A service that touches a repository, a clock and an HTTP client can still be making one claim about
one calculation. Ask what the assertion is about, not what the call graph contains.

**★ "It has `@Service` on it, so it needs Spring."**
The annotation instructs the container how to build the object. The built object is ordinary Java.
Constructor injection is what makes this true, and it is the reason to prefer it.

**★ `@SpringBootTest` with five `@MockitoBean` fields.**
A slow unit test. Everything real has been replaced, so the context is starting an application in
order to not use it — and it now has a cache key nothing else shares.

**★ A repository "unit test" with a mocked `EntityManager`.**
It asserts that your code calls the methods your code calls. The query, the mapping and the
constraints — the only things that can actually be wrong — are untested.

**★ Reaching for a higher level because the lower one is awkward to write.**
Difficulty at level 0 is a design signal: too many constructor arguments, a static call, a hidden
`Instant.now()`. Escalating suppresses the signal and keeps the design problem.

**★ Believing the pyramid prescribes ratios.**
No Spring, Boot or JUnit reference defines the test pyramid or endorses a 70/20/10 split — it is an
industry convention, usually credited to Mike Cohn's *Succeeding with Agile* (2009). The claim the
documentation *does* support is that context count drives suite cost
([01](01-the-pyramid-and-the-honest-version.md), [05](05-the-context-cache.md)).

**★ Writing the integration test twenty times.**
One test of the transaction boundary proves the boundary works. Twenty of them prove it twenty
times, at twenty times the cost, and the extra nineteen usually differ only in data — which is a
`@ParameterizedTest` at level 0.

## Interview questions

**★ How do you decide what level to test at?**
By asking what the assertion is about, not what the code touches. A value your code computes is
level 0. A decision the framework makes is a slice, chosen by which framework. Several configured
components interacting is `@SpringBootTest`. HTTP or a real external system is a running server or
Testcontainers. Stop at the first match.

**★ Give a one-line heuristic for level 0.**
If what would have to break for the test to fail is a line of your own code, it is a unit test. If
it is a line of Spring's, you need the level that configures that part of Spring.

**★ Why is testing too low more dangerous than testing too high?**
Because testing too high only costs time, while testing too low costs the test. A repository test
with a mocked `EntityManager` passes forever, including on the day the query breaks — it asserts
that your code called the methods your code calls, and the query, mapping and constraints are the
only things that could actually be wrong.

**★ When is `@SpringBootTest` genuinely the right choice?**
When the claim is about several configured components fitting together — a transaction spanning
repositories, security applied to a real handler chain, an event crossing a commit boundary. Those
behaviours are created by the container, so no smaller context can observe them. Use it for the
claims only it can make, then stop.

**★ Your `@SpringBootTest` has five `@MockitoBean` fields. What is wrong?**
It has replaced everything real, so it is starting a whole application in order not to use it —
a slow unit test. It also has a cache key nothing else shares, so it costs a second full context.
The assertion almost certainly belongs at level 0 with a constructor call.

**★ Someone says the pyramid means 70% unit tests. What do you say?**
That no Spring, Boot or JUnit documentation defines the pyramid or endorses any ratio — it is an
industry convention, usually credited to Mike Cohn. The defensible version is not about
proportions: each level answers questions the others cannot, and the expensive level should be used
only for the claims that require it, because context count drives suite cost.

**★ A test at level 0 is awkward to write. Is that a reason to move up a level?**
No — it is a design signal. Awkwardness at level 0 usually means too many constructor arguments, a
static call, or an unmockable `Instant.now()`. Escalating to a context hides the signal and keeps
the problem; the pain is a faithful measurement of the design.

{/* FOOTER */}
