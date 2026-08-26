---
title: "The two techniques that belong permanently in a project: a test that fails when the boundary is missing, and a build rule that refuses the placement in the first place"
sidebar_label: "5c · Proving it and preventing it"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Transaction management in the TestContext framework*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 5b](05b-detecting-a-dead-annotation.md)'s three techniques all answer
"is it broken right now". They are diagnostics: you add them, learn something,
and take them out. These two are different. They stay in the project, they cost
nothing to keep, and between them they turn a silent failure into a loud one —
one at test time, one at build time.**

## 1 · Make the failure loud in a test

The single most valuable test in this whole topic is the one almost nobody
writes:

```java
@SpringBootTest
class OrderServiceTransactionTest {

    @Autowired OrderService service;     // the PROXY, from the context
    @Autowired JdbcClient db;

    @Test
    void partialFailureLeavesNothingBehind() {
        NewOrder bad = orderWhoseThirdLineViolatesAConstraint();

        assertThatThrownBy(() -> service.placeOrder(bad))
                .isInstanceOf(DataAccessException.class);

        Long orders = db.sql("SELECT count(*) FROM orders").query(Long.class).single();
        assertThat(orders).isZero();     // ← this is the assertion that matters
    }
}
```

Every entry on the list fails this test and passes a happy-path test. The
reference's own warning is the reason: *"your transaction annotations may be
silently ignored: Your code might appear to 'work' until you test a rollback
scenario."* This is that scenario, written down.

🔴 **The test must obtain the bean from the context.** A test that does
`new OrderService(db)` holds the target, has no proxy, and cannot distinguish a
working boundary from a missing one — it will pass whether the annotation works
or not.

## 2 · Catch it at build time

The test above proves one boundary works, forever. It does nothing about the
boundary somebody adds next month. An ArchUnit rule finds those before they
ship:

```java
@ArchTest
static final ArchRule transactional_methods_are_not_private =
    noMethods().that().areAnnotatedWith(Transactional.class)
               .should().bePrivate()
               .orShould().beStatic()
               .orShould().haveModifier(JavaModifier.FINAL);
```

A second rule — no method annotated `@Transactional` may be called from within
its own declaring class — catches entry 1, which is the most common one of all.

## Why both, and in that order

They catch different things and neither subsumes the other.

| | The rollback test | The ArchUnit rule |
|---|---|---|
| catches | this boundary being broken, by any of the nine causes | a *placement* that cannot work, anywhere in the codebase |
| runs | when the test suite runs | on every build, before any test |
| needs | a database and a context | nothing but bytecode |
| misses | boundaries nobody wrote a test for | reachability failures that depend on runtime configuration |
| cost to keep | one test per genuine unit of work | one rule file |

The rule is cheaper and catches more placements; the test is the only thing that
proves a specific boundary actually rolls back. A project that has one and not
the other is missing real coverage either way.

## The trade-off

Neither of these is free. The rollback test needs a real database and a real
context, so it is slower than a unit test and it is the kind of test people
delete when the suite gets slow — which is exactly when the annotation quietly
stops working. The ArchUnit rule will occasionally reject something a developer
believes is fine, and answering "why is this rule here" is a recurring cost. Both
are worth paying, and the reason is the same one that runs through this whole
topic: **Spring will never tell you.** These two are the only mechanisms in the
project that will.

## Gotchas

**⚠️ Testing the boundary with a hand-constructed service**
**Symptom:** a green test for behaviour that is broken in the application.
**Cause:** `new` gives you the target; there is no proxy either way.
**Fix:** `@Autowired` from the context, always, for anything about a boundary.

**⚠️ A test that asserts the exception but not the database**
**Symptom:** the test passes and the rollback never happened.
**Cause:** the exception propagates identically whether or not there was a
transaction to roll back.
**Fix:** assert on row counts after the failure. The exception is not the
evidence; the empty table is.

**⚠️ A `@Transactional` test method hiding the bug**
**Symptom:** the test passes because the *test* opened a transaction that rolled
back at the end, not because the service did.
**Cause:** Spring's TestContext support makes annotated test methods
transactional and rolls them back by default.
**Fix:** for this specific test, `@Commit` or
`@Transactional(propagation = NOT_SUPPORTED)` so the service's own boundary is
the only one in play. This trap is the reason transaction tests so often prove
nothing.

**⚠️ Asserting row counts without a flush, under JPA**
**Symptom:** the test sees zero rows and reports success, whether or not the
rollback happened.
**Cause:** with an `EntityManager` in play the changes may still be pending in
the persistence context and never have reached the database.
**Fix:** flush, or query through the same `EntityManager`. The reference calls
these out as false positives in its testing chapter.

**⚠️ The injected failure being caught inside the service**
**Symptom:** the test passes, and it passes for the wrong reason.
**Cause:** if the exception never escapes the method, the interceptor sees a
normal return and commits — a different bug with the same symptom.
**Fix:** verify the exception actually propagates out of the service call before
trusting the row-count assertion.

**⚠️ An in-memory database that does not enforce the constraint you rely on**
**Symptom:** the failure you injected does not happen, so nothing is tested.
**Cause:** the test database silently accepts the row the real one would reject.
**Fix:** fail the operation with something the database cannot ignore, or run the
test against the same engine as production.

**⚠️ Adding the visibility rule and not the self-invocation one**
**Symptom:** the rare failures are caught at build time and the common one is
not.
**Cause:** the visibility rules are easy to express and the call-graph rule is
the one that matters.
**Fix:** write both. Entry 1 in
[chunk 5](05-annotations-that-do-nothing.md) outnumbers entries 2 to 9 combined
in practice.

**⚠️ An ArchUnit rule that also matches `jakarta.transaction.Transactional`, or
does not**
**Symptom:** a rule that silently covers half the codebase.
**Cause:** two annotations with the same simple name, and a rule written against
one of them.
**Fix:** decide which annotation the project uses, enforce that too, and write
the rule against it.

## Interview questions

**★ Why is a happy-path test worthless here, and what does a useful test look
like?**
Because without a transaction, JDBC is in autocommit and every statement commits
by itself — so all the rows appear, all the assertions pass, and the test
observes exactly what a working transaction would have produced. The failure only
exists on the path where something throws partway through. A useful test obtains
the bean from the application context, invokes the unit of work with input that
fails midway, asserts the exception, and then asserts that the database contains
nothing — the row count is the evidence, not the exception. It also has to make
sure the *test itself* is not supplying the transaction: Spring's test support
makes `@Transactional` test methods roll back by default, which will make a
broken service look fine.

**★ Your rollback test passes but you are still not sure it proves anything. What
would you check?**
Three things, all of which produce a passing test for the wrong reason. First,
whether the test class or method is itself `@Transactional` — Spring's
TestContext framework rolls those back automatically, so the table is empty
because the *test* rolled back, not the service. Second, whether the assertion
reads through the same persistence context that wrote: under JPA, unflushed
changes never reached the database, so "zero rows" is true regardless. Third,
whether the failure you injected actually escapes the service method — if
something inside catches it, the interceptor never sees an exception and commits
normally, which is a different bug with the same test outcome. A test that
asserts a row count through a fresh, non-transactional query after an exception
that genuinely propagated is the version that proves something.

**★ How would you prevent dead annotations rather than diagnose them?**
Move the check to build time, because the runtime gives you nothing. Two ArchUnit
rules cover almost everything: no `@Transactional` method may be `private`,
`static` or `final`, and no `@Transactional` method may be invoked from within
its own declaring class. The second is the important one — internal calls
outnumber every other cause — and it catches the disguised forms too, since a
lambda or method reference compiles to an invocation on the declaring class.
Beyond that, a convention that transactional methods live only on beans whose
public surface *is* the set of transactional entry points removes the opportunity
structurally. Code review is the weakest control here, because every one of these
placements looks completely ordinary at the call site.

**★ Why can a build-time rule catch a lambda's self-invocation when it looks
nothing like one in the source?**
Because the rule reads bytecode, not source. A lambda that calls an instance
method of its enclosing class compiles to a synthetic method on that class, and
the call inside it is an ordinary invocation on the declaring type — exactly the
same shape as a plain `this.method()` call. A method reference is even more
direct: `this::importOne` compiles to an invocation of `importOne` bound to the
enclosing instance. So a rule phrased as "no method annotated `@Transactional`
may be called from within its declaring class" catches all three syntactic forms
without needing to know they exist, which is the main argument for the bytecode
rule over an IDE inspection or a review checklist.

**★ Which of the two would you add first to a codebase that has neither?**
The ArchUnit rule, because it is cheap, needs no infrastructure, and immediately
tells you the size of the problem across the whole codebase rather than for one
method at a time. Running it for the first time on an existing project usually
produces a list, and that list is more valuable than any single test: it is the
inventory of boundaries that were never working. Then write rollback tests for
the units of work that matter, prioritised by what the rule found. Doing it the
other way round means writing careful tests one at a time while the placement
mistakes keep arriving.

**★ Is `@Rollback(false)` or `@Commit` on a test ever the right call?**
Yes, and this is one of the cases. Spring's TestContext framework makes
`@Transactional` test methods roll back by default, which is excellent for
keeping tests isolated and disastrous for a test whose entire purpose is to
observe whether the *service* rolled back. If the test's own transaction is
rolling everything back, the table is empty either way and the assertion proves
nothing. `@Commit` — or not making the test transactional at all, which is
cleaner — removes the second boundary so the service's is the only one in play.
The cost is that you now have to clean up after the test yourself, which is the
correct trade for the handful of tests that exist to verify a boundary.

**★ Where should the rollback test's failure come from — a real constraint, or a
stubbed collaborator?**
A stubbed collaborator, in most cases, and the reason is reliability rather than
purity. A constraint-driven failure depends on the test database actually enforcing
the constraint, which an embedded in-memory engine may not, and on the statement
reaching the database at all, which under JPA needs a flush. Both are ways the test
quietly stops injecting a failure and starts passing for no reason. A collaborator the
service calls *after* its first write, stubbed to throw, fails deterministically on
every engine:

```java
@MockitoBean InventoryClient inventory;

@Test
void a_failure_after_the_first_write_leaves_nothing_behind() {
    when(inventory.reserve(any())).thenThrow(new IllegalStateException("boom"));

    assertThatThrownBy(() -> service.placeOrder(order))
            .isInstanceOf(IllegalStateException.class);

    assertThat(JdbcTestUtils.countRowsInTable(jdbc, "orders")).isZero();
}
```

The ordering is the load-bearing part: the stub must throw *after* something has
already been written, or there is nothing for the rollback to undo and the test passes
vacuously. Keep a constraint-driven variant too if the constraint itself is what you
are asserting on — but then run it against the real engine, for the reasons in
[20j](20j-the-fixture-and-the-real-database.md).

**★ You add the ArchUnit rules to an existing codebase and they fail on forty
methods. Now what?**
Do not weaken the rules and do not fix forty things in one change. Freeze the existing
set as a baseline — ArchUnit supports a violation store for exactly this, and a plain
allow-list of fully-qualified method names works too — so the rule blocks *new*
violations from day one while the old ones stay visible and counted. That converts the
problem from "a large refactor nobody has time for" into "a number that only goes
down", which is the only version that survives contact with a delivery schedule. Then
triage the forty by risk rather than by ease: a self-invocation on a method that writes
several tables is a live data-integrity bug and should be fixed this week; a
`@Transactional` on a `private` helper that only ever reads is a dead annotation to
delete, which costs nothing and shrinks the list. The list itself is the most useful
artefact — it is the inventory of boundaries that were never working, and nothing else
in the project produces it.

---

← Prev: [5b · Detecting a dead annotation](05b-detecting-a-dead-annotation.md) · Index: [04 · Spring @Transactional](README.md) · Next → [6 · The transaction manager](06-the-transaction-manager.md)
