---
title: "The migration is six steps and the first two are about tests, because a suite that runs everything inside a transaction cannot tell you where the work is and a suite that can will hand you the list"
sidebar_label: "07b · Doing the migration"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix entry
> for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Spring Framework 7.0 reference on transaction management in tests and
> `@Transactional` test semantics
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> and the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer` and
> `org.hibernate.collection.spi.AbstractPersistentCollection` for the exact exception messages
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The failure mode of this migration is doing it in production first, discovering fourteen
broken endpoints in an afternoon, reverting, and concluding that open-session-in-view is
load-bearing. It is not; it is concealing. The way to do it is to make the boundary real in
tests, where a failure costs a red build rather than an incident, and to accept that the first
job is fixing the tests themselves — because a suite that wraps every method in a transaction
is structurally incapable of producing the list you need.** Continues
**[07 · Turning open-in-view off](07-turning-open-in-view-off.md)**.

## Step 0 · Write the value down

```yaml
spring:
  jpa:
    open-in-view: true    # TODO: migrating to false — see ticket ABC-123
```

This changes nothing at runtime and silences Boot's startup warning, which is exactly why it
must carry a comment and a ticket. The value of this step is that the setting is now a
decision in a file a reviewer can see, rather than a default nobody knows about.

Skip it if you are going straight to the next step. Do not leave it in place for a year.

## Step 1 · Turn it off in tests, and fix the tests

```yaml
# src/test/resources/application.yaml
spring:
  jpa:
    open-in-view: false
```

Then the harder half. A test method annotated `@Transactional` — which `@DataJpaTest` applies
by default — runs the test body inside the same transaction as the code under test, so the
persistence context is open for the whole test and **every lazy access succeeds**. Such a test
cannot fail the way production fails. The argument in full is
**[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**.

Three ways to make a test see the real boundary, in increasing order of fidelity:

**a · Clear the persistence context between arrange and act.**

```java
@DataJpaTest
class OrderMapperTest {

    @Autowired TestEntityManager em;

    @Test
    void mapsWithoutTouchingUnfetchedAssociations() {
        Order saved = em.persistFlushFind(anOrder());
        em.clear();                                   // ← everything becomes detached
        Order reloaded = em.find(Order.class, saved.getId());
        assertThatThrownBy(() -> OrderMapper.toView(reloaded))
                .isInstanceOf(LazyInitializationException.class);
    }
}
```

`clear()` detaches everything the context is managing, so subsequent reads exercise proxies
rather than the identity map. This is the cheapest way to test a mapper's fetch requirement.

**b · Run the service test non-transactionally.**

```java
@SpringBootTest                 // no @Transactional on the class or the method
class OrderServiceTest {

    @Autowired OrderService service;

    @Test
    void returnsAFullyLoadedView() {
        OrderView view = service.findOrder(existingId);   // its own transaction, then closed
        assertThat(view.lines()).hasSize(3);              // a value — cannot throw
    }
}
```

The service's `@Transactional` opens and closes a real unit of work, and the assertion runs
after it. If the service returns an entity, this test is where it fails.

**c · Drive a real HTTP request.**

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class OrderEndpointTest { … }
```

A real request through a real port exercises the whole path including serialisation, with no
test transaction anywhere. It is the slowest and the only one that catches a failure in a
message converter.

🔴 **Expect this step to be most of the work, and expect it to be resisted**, because it makes
green tests go red without any production change. That is precisely the point: the tests were
asserting something other than what production does.

## Step 2 · Read each exception properly

The messages are specific and each one names the thing you need. From Hibernate 7.4, a **proxy**
failure reads:

```
Could not initialize proxy [com.example.Customer#42] - the owning session was closed
```

and a **collection** failure reads:

```
Cannot lazily initialize collection of role 'com.example.Order.lines' with key '17' (the owning session was closed)
```

⚠️ These are the 7.4 strings. The Hibernate 5 wordings that populate every search result —
`could not initialize proxy … - no Session` and `failed to lazily initialize a collection of
role:` — no longer exist. Searching for them finds advice for a different version. The full
decoding, including which variant means what, is
**[02 · The exception](02-the-exception.md)** and
**[01c · A collection is not a proxy](01c-a-collection-is-not-a-proxy.md)**.

**Every message gives you three facts:** which entity, which identifier, and — for a collection
— which association role. That is enough to name the missing fetch without reading any code.

## The next three steps

Triage, conversion order, flipping it per environment and keeping it off are
**[07c · Triage and rollout](07c-triage-and-rollout.md)**.

## Gotchas

**★ The test suite is the first thing that has to change, and it will look like a regression.**
Tests that pass today will fail after you stop wrapping them in a transaction, with no
production code change. Communicating that in advance is the difference between a migration and
a revert.


**★ `@DataJpaTest` is transactional by default.** So is a `@SpringBootTest` class annotated
`@Transactional`. Neither can reproduce this failure, and both will certify a mapper that
throws in production.


**★ `em.clear()` and `em.detach()` are not the same test.** `clear()` detaches everything;
`detach(x)` detaches one object and leaves its associations' targets managed, so a subsequent
read can still hit the identity map and succeed. If you want a realistic test, clear.


**★ Hibernate 7.4's exception strings are not Hibernate 5's.** Searching the old wording finds
advice written for a different version, and some of it is wrong for 7.4 — `@LazyCollection`,
for instance, no longer helps, and extra-lazy collection support has been dropped.


**★ A test that asserts an endpoint returns 200 cannot detect this.** Under a registered
Jackson Hibernate module the endpoint returns 200 with a `null` field, and under open-in-view it
returns 200 with the data. Assert on the payload, not the status.

**★ `assertThatThrownBy(...).isInstanceOf(LazyInitializationException.class)` is a legitimate
test.** Pinning the boundary — "this mapper must not touch the customer" — is a real assertion
and it is the only one that fails when somebody adds a field to the mapper.

**★ The exception may be wrapped by the time your test sees it.** Through `MockMvc` or a real
HTTP call the throw happens inside a message converter and arrives wrapped. Assert on the root
cause, not the top-level type.

## Interview questions

**★ How would you turn open-session-in-view off in an application that has had it on for
years?**
Not in production. First make the value explicit so it is a visible decision, then turn it off
in the test profile and fix the tests that were passing only because they ran inside a
transaction. That produces a list of real failures at CI cost rather than incident cost. Triage
that list into "returns an entity", "missing a fetch plan", "was never covered anyway",
"asynchronous response" and "cannot be made lazy", because those have different fixes. Convert,
flip in staging, watch payload shapes as well as error rates, then make it the default.


**★ Why is the test suite the first obstacle?**
Because `@DataJpaTest` and `@Transactional` test classes run the test body inside the same
transaction as the code under test. The persistence context stays open for the whole test, so
every lazy access succeeds and no test can reproduce the production failure. Until that is
fixed, turning the property off changes nothing about what CI can tell you — the suite will
stay green and the endpoints will still break.


**★ How do you make a test see the real boundary?**
Three levels. Clear the persistence context between arranging and acting, which detaches
everything and makes a mapper test meaningful. Run service tests without `@Transactional`, so
the service's own transaction opens and closes and the assertion runs after it. Or drive a real
HTTP request against a running port, which is the only version that exercises the message
converter, where most of these failures actually surface.


**★ What three facts does the exception message give you, and why does that matter for
triage?**
The entity name, the identifier, and — for a collection — the association role, for example
`'com.example.Order.lines'`. That is enough to name the missing fetch without opening the code:
you know which query needs the join and which association it is. It also distinguishes a proxy
failure from a collection failure, which matters because the fixes differ — a proxy is one row
and a collection is a set, and the second is where a fetch join starts multiplying rows.

{/* FOOTER */}
