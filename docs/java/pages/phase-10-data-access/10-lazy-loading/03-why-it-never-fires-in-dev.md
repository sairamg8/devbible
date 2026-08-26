---
title: "There are at least ten independent reasons a lazy access succeeds, open-session-in-view is only the famous one, and every single one of them is a way this exception hides on your machine and appears somewhere else"
sidebar_label: "03 · Why it never fires in dev"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix
> entry for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Jakarta Persistence 3.2 specification's `FetchType` defaults and persistence-context
> identity guarantee
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)),
> and `org.hibernate.cfg.TransactionSettings.ENABLE_LAZY_LOAD_NO_TRANS`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**This is the exception with the worst reputation for environment dependence, and the reason
is not one setting — it is that a lazy access can succeed for at least ten unrelated
reasons, and your development machine tends to hit several of them at once. The famous one
is open-session-in-view. The rest are quieter and more common: the association was already
loaded, or it was never lazy, or the foreign key in your fixture is null, or your test shares
a transaction with the code it tests, or a log line warmed the proxy before the serialiser
got to it. Each of these makes the same source code work here and fail there, and none of
them shows up in a diff.**

## First, the one everybody names

`spring.jpa.open-in-view` defaults to **`true`**. Boot's own description of it, from the
properties appendix, is *"Register OpenEntityManagerInViewInterceptor. Binds a JPA
EntityManager to the thread for the entire processing of the request."* The consequence for
this topic is a single sentence: **for the whole of a servlet request, there is a
persistence context bound to the thread, so no proxy is ever detached, so this exception
cannot be thrown.**

The mechanism, the warning Boot logs about it, the conditions under which the interceptor is
registered at all, and the argument that it is not a fix for query counts are all worked out
in **[Topic 08 · 15 · Open session in view](../08-the-n-plus-1-problem/15-open-in-view.md)**
and its two follow-on chunks. What belongs *here* is the narrower correctness observation,
and it is worth stating on its own:

🔴 **With open-in-view on, whether your code works depends on who called it.** The same
service method, returning the same entity, is correct when a controller called it and
broken when a `@Scheduled` job called it — because the interceptor is registered for
servlet web requests and nothing else. That is not a bug in the job. It is a service method
that never had a well-defined contract, and OSIV was supplying one for exactly one caller.

That split is the subject of
**[03c · The same method with two contracts](03c-the-same-method-with-two-contracts.md)**.
The rest of this chunk is about the reasons the exception hides that have **nothing to do
with open-in-view at all** — the ones that still hide it after you have turned OSIV off,
and the ones that explain why a colleague cannot reproduce your failure.

## Group A · The session is still open

### A1 · The test shares a transaction with the code under test

The most productive liar in the whole list. A `@DataJpaTest`, or any test method annotated
`@Transactional`, runs the test body **inside** the transaction that the service also runs
in. So:

```java
@DataJpaTest
class BookRepositoryTest {
    @Test
    void loadsBook() {
        Book book = repository.findById(1L).orElseThrow();
        assertThat(book.getPublisher().getName()).isEqualTo("Acme");  // works. always.
    }
}
```

The assertion dereferences a lazy association and it succeeds, because the persistence
context is still open — it will not be closed until the test method returns and Spring rolls
back. **A test written this way cannot detect a lazy-loading boundary problem, and it will
happily assert that a mapper which throws in production is correct.**

Worse, it is not only repository tests. A `@SpringBootTest` with `@Transactional` on the
class does the same thing for service tests and even for `MockMvc` tests, so the entire
suite can be structurally incapable of seeing this exception.

### A2 · A single long-lived `EntityManager`

A `main` method, a migration script, a data-loader, an integration harness that opens one
`EntityManager` and never closes it. Nothing is ever detached, so nothing ever throws. This
is how sample code in tutorials is usually written, which is part of why the exception feels
like a surprise the first time.

### A3 · `hibernate.enable_lazy_load_no_trans` is on somewhere

Hibernate's `@Unsafe`-annotated escape hatch, whose javadoc describes it as allowing *"a
detached proxy or lazy collection to be fetched even when not associated with an open
persistence context, by creating a temporary persistence context when the proxy or
collection is accessed"*, and whose api note says *"Generally speaking, all access to
transactional data should be done in a transaction. Use of this setting is discouraged."*

Default is `false`. But it is exactly the kind of setting that gets added to a `dev` or
`local` profile years ago to make a demo work and is never removed — and it is invisible
unless you go looking, because it produces no warning and no log line. The tell that it is
on is in **[02 · The exception](02-the-exception.md)**: the message variant
`session was closed or disconnected`, with the two joined by `or`, exists only on that code
path. It is treated as a proposed fix, and rejected, in
**[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)**.

## Group B is the other half of this

The reasons above all keep a persistence context open past the point you expected. The
larger group does something different: it arranges for there to be **no proxy at all**, so
there is nothing left to throw. Those are in
**[03b · It was never a proxy](03b-it-was-never-a-proxy.md)**, and they are the ones that
survive turning open-session-in-view off.

## Gotchas

**★ A green test suite is not evidence.** If tests run transactionally — and by default
`@DataJpaTest` and `@Transactional` tests do — the suite is structurally unable to produce
this exception. It is not that the tests are weak; they are exercising a different program.

**★ `enable_lazy_load_no_trans` leaves no trace.** No warning, no log line, no startup
banner. The only signal that it is on is a message variant you will see only when the escape
hatch itself fails, and by then you are debugging something else.

**★ Two developers on the same commit can get different results.** Different local data,
different active profiles, one of them running under a debugger. All three change whether the
exception fires, and none of them is visible in `git status`.

## Interview questions

**★ Why does this exception have such a reputation for only appearing in production?**
Because at least ten independent things make a lazy access succeed, and a development
environment tends to satisfy several at once: open-in-view is on, tests run inside a
transaction, fixture rows have null foreign keys, the data set is small enough that most
association targets are already in the persistence context, and `DEBUG` logging is
initialising proxies as a side effect. Production has none of those. So the same bytecode
takes a different path through the same code, and nothing in the diff explains it.

**★ Your `@DataJpaTest` asserts that the mapper produces the right DTO, and it passes. Does
that tell you the mapper is safe?**
No. `@DataJpaTest` runs the test method inside a transaction, so the persistence context is
open for the whole test and every lazy access in the mapper succeeds. The test verifies the
mapping logic, which is useful, and asserts nothing at all about the fetch boundary, which is
what the production failure is about. To test the boundary you have to close the context — by
not running the test transactionally, or by detaching or clearing before the mapping runs.

**★ A service method throws when a scheduled job calls it and works when a controller calls
it. Is the scheduler misconfigured?**
No. The interceptor that keeps a persistence context bound for the whole request is
registered for servlet web requests only, so the controller path has one and the job does
not. The job is running the method under the contract the method actually has; the controller
was running it under a contract supplied by infrastructure. The method never declared what it
needed loaded, which is the bug.

**★ You are handed a codebase with no `LazyInitializationException` in its history. Is that
good news?**
Not on its own. It is equally consistent with a codebase that has had open-in-view on since
day one, or that maps everything `EAGER`, or whose tests all run transactionally. In each of
those the boundary has never been enforced, so there is no habit of declaring fetch plans and
no evidence about where the leaks are. A history of this exception is a history of the
boundary being real.

{/* FOOTER */}
