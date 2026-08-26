---
title: "In a Boot application nothing in your code names a transaction manager, so adding a dependency can change one — and two data sources mean two that cannot cover each other"
sidebar_label: "6c · What Boot picked for you"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Boot reference *SQL databases*
> ([docs.spring.io/spring-boot/reference/data/sql.html](https://docs.spring.io/spring-boot/reference/data/sql.html)),
> the Spring Boot 4.1 `TransactionProperties` javadoc
> ([docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/transaction/autoconfigure/TransactionProperties.html))
> and the Spring Framework 7.0 reference *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and the `AbstractPlatformTransactionManager` javadoc
> ([.../transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 6b](06b-which-manager-you-have.md) listed the implementations. This one
answers the question a Boot developer actually has: which one do I have, and who
decided? Nobody in your codebase wrote it down, so the answer is a function of
your dependencies — which means a dependency change can move it. The second half
is what happens when there is more than one, which is the point at which
`@Transactional` stops being able to guess.**

## What Spring Boot picks, and when

You write none of this in a Boot application. Auto-configuration supplies a
manager based on what is on the classpath and in the context:

| What Boot sees | What it configures |
|---|---|
| a `DataSource`, no JPA | a JDBC transaction manager for that `DataSource` |
| an `EntityManagerFactory` (JPA / Hibernate) | `JpaTransactionManager` |
| a JTA environment | `JtaTransactionManager` |
| an R2DBC `ConnectionFactory` | `R2dbcTransactionManager` (reactive) |
| **any `TransactionManager` bean you declare** | **yours — auto-configuration backs off** |

🔴 **The JPA row is the one that surprises people.** Add Spring Data JPA to a
project that had plain JDBC, and the manager changes. `JpaTransactionManager`
manages the `EntityManager` *and* the underlying `DataSource`, so plain
`JdbcTemplate` work still participates — but flush timing, exception types and
lazy-loading behaviour all change underneath code nobody edited.

Boot also exposes two settings on the manager itself, bound from
`spring.transaction`:

| Property | Type | Effect |
|---|---|---|
| `spring.transaction.default-timeout` | `Duration` | the default timeout for transactions that do not set one |
| `spring.transaction.rollback-on-commit-failure` | `Boolean` | whether to roll back when the commit throws |

⚠️ **Boot 4 moved the class.** `TransactionProperties` now lives in
`org.springframework.boot.transaction.autoconfigure`, not the old
`org.springframework.boot.autoconfigure.transaction`. The *property names* are
unchanged, so configuration files are unaffected; only code or documentation that
names the class is.

## More than one manager

With two data sources, there are two managers, and Spring cannot guess. The
annotation's `value` (aliased as `transactionManager`) names one:

```java
@Configuration
class TxConfig {

    @Bean
    JdbcTransactionManager ordersTxManager(@Qualifier("orders") DataSource ds) {
        return new JdbcTransactionManager(ds);
    }

    @Bean
    JdbcTransactionManager reportingTxManager(@Qualifier("reporting") DataSource ds) {
        return new JdbcTransactionManager(ds);
    }
}

@Service
class OrderService {

    @Transactional("ordersTxManager")            // ← by bean name
    public long placeOrder(NewOrder order) { ... }
}
```

Two refinements worth knowing:

- **A default**: implement `TransactionManagementConfigurer` and return the
  manager that unqualified `@Transactional` methods should use. Then only the
  exceptions need naming.
- **A qualifier**: the value is matched as a bean qualifier, so a custom
  `@Qualifier` annotation works and is more refactor-safe than a string bean name.

🔴 **The two managers are genuinely independent.** A method annotated with one
cannot roll back work done under the other. Two databases means two transactions,
and making them agree is a distributed-transaction problem that JTA exists to
solve and that a pair of local managers does not.

## The trade-off

Auto-configuration means you get a correct manager without knowing this page
exists, which is the right default for the overwhelming majority of applications.
What you pay is that **the implementation is an invisible dependency of your
service's behaviour**: adding a starter can change the manager, and with it the
flush timing, the exception types, whether `NESTED` works at all, and whether a
timeout is enforced. The mitigation is not to configure it by hand — hand
configuration costs you every future improvement Boot makes and, as the gotchas
below show, silently disables the `spring.transaction` properties. The mitigation
is to *know* which one you have, so that "why did this change?" has a first place
to look.

## Gotchas

**⚠️ Adding Spring Data JPA to a JDBC application**
**Symptom:** unchanged code starts behaving differently — different exception
types, different flush timing, lazy-loading failures.
**Cause:** the auto-configured manager changed from a JDBC one to
`JpaTransactionManager`.
**Fix:** expected, not a bug. Know that the starter changed the manager.

**⚠️ Two data sources and no qualifier**
**Symptom:** startup failure, or — worse — work committing against the wrong
database.
**Cause:** Spring cannot choose between two `TransactionManager` beans.
**Fix:** `@Transactional("ordersTxManager")`, or a
`TransactionManagementConfigurer` that names the default.

**⚠️ Expecting one `@Transactional` to cover two data sources**
**Symptom:** one database is rolled back and the other is not.
**Cause:** two local managers are two independent transactions.
**Fix:** accept the inconsistency and design for it, or use JTA. There is no
third option that a single annotation provides.

**⚠️ Marking one of two managers `@Primary` to silence a startup failure**
**Symptom:** the application starts and quietly writes to the wrong database.
**Cause:** `@Primary` resolves the ambiguity by picking one, which is not the
same as picking the right one for each method.
**Fix:** name the manager on every method that is not using the default, and use
`TransactionManagementConfigurer` to make the default explicit rather than
incidental.

**⚠️ Declaring your own manager bean and wondering why a property stopped
applying**
**Symptom:** `spring.transaction.default-timeout` has no effect.
**Cause:** those properties are applied by Boot's auto-configuration; declaring
your own `TransactionManager` bean makes it back off.
**Fix:** set the value on your bean, or customise rather than replace.

**⚠️ Searching for `TransactionProperties` in the Boot 4 codebase and not finding
it**
**Symptom:** an import that no longer resolves after upgrading.
**Cause:** Boot 4 moved it to `org.springframework.boot.transaction.autoconfigure`.
**Fix:** update the import. Property names in configuration files did not change.

**⚠️ A bean-name string in `@Transactional` surviving a rename**
**Symptom:** `NoSuchBeanDefinitionException` at runtime, from a method nobody
touched.
**Cause:** the `value` attribute is a string; renaming the `@Bean` method renames
the bean and nothing checks the annotation.
**Fix:** use a custom `@Qualifier` annotation instead of a string. It is a
compile-time reference and a refactor moves it.

**⚠️ Assuming `spring.transaction.default-timeout` bounds the method**
**Symptom:** a long-running method inside a short default timeout completes
normally.
**Cause:** the property sets a default on the manager; for JDBC that becomes
statement timeouts, not a deadline for your code.
**Fix:** [chunk 17](17-timeouts.md).

**⚠️ Setting `spring.transaction.default-timeout` and expecting it on
participating methods**
**Symptom:** the default applies to some transactions and not others.
**Cause:** a timeout applies to a newly started transaction; a method joining an
outer one inherits the outer timeout.
**Fix:** the outermost boundary owns it — [chunk 8](08-propagation-required.md).

## Interview questions

**★ Which transaction manager does a Spring Boot application use, and how does it
decide?**
Auto-configuration decides, from what is on the classpath and in the context.
With a `DataSource` and no JPA it configures a JDBC transaction manager; with an
`EntityManagerFactory` it configures `JpaTransactionManager`; in a JTA
environment it configures `JtaTransactionManager`; with an R2DBC
`ConnectionFactory` it configures the reactive one. And it backs off entirely if
you declare a `TransactionManager` bean yourself. The practically important
consequence is that **adding a dependency can change your transaction manager**:
introducing Spring Data JPA to an application that used plain JDBC swaps a JDBC
manager for a JPA one, which changes flush timing, the exceptions you see, and
whether operations that looked immediate are now deferred to flush — all without
any change to the service code.

**★ You have two databases. Can one `@Transactional` method cover both?**
Not with two local transaction managers, no. Each manager owns one resource and
knows nothing about the other, so a method annotated for one can commit or roll
back that one and has no ability to affect the second — you can end up with one
database updated and the other not. Making two resources commit atomically is a
distributed transaction, and the answer Spring provides for it is
`JtaTransactionManager` with XA-capable drivers, which brings a transaction
coordinator, two-phase commit, and a meaningful performance and operational cost.
The alternative most systems choose is to accept that the two are independent and
design for it — an outbox table, an idempotent retry, or a reconciliation step —
because XA is a large commitment to avoid an inconsistency window.

**★ How do you tell Spring which manager to use when there is more than one?**
Name it in the annotation: `@Transactional("ordersTxManager")`, using the `value`
attribute, which is aliased as `transactionManager`. The value is matched as a
bean name or a qualifier, so a custom `@Qualifier` annotation works too and
survives renaming better than a string. If most methods should use one particular
manager, implement `TransactionManagementConfigurer` and return it as the
default, so only the exceptions need to be annotated. What you should not do is
rely on there being an obvious primary — with two candidate beans and no
qualifier you get either a startup failure or, in the worse arrangement where one
is `@Primary` by accident, work quietly committing against the wrong database.

**★ What does `spring.transaction.default-timeout` do, and when would it not
apply?**
It sets a default timeout on Boot's auto-configured transaction manager, applied
to transactions that do not declare one of their own. Two things stop it
applying. The first is that you declared your own `TransactionManager` bean, in
which case auto-configuration backed off and nothing bound the property to
anything — the setting is silently inert. The second is the general rule about
timeouts from [chunk 6](06-the-transaction-manager.md): a timeout applies to a
newly started transaction, so a method participating in an outer transaction
inherits the outer one's timeout regardless. And even where it applies, a JDBC
timeout becomes a statement timeout rather than a wall clock over the method,
which is a distinction with real consequences — [chunk 17](17-timeouts.md).

**★ Why is "declare the manager yourself so nothing can change it" bad advice?**
Because it trades a small, visible risk for a set of invisible ones. Declaring
your own `TransactionManager` bean makes auto-configuration back off entirely, so
`spring.transaction.default-timeout` and `rollback-on-commit-failure` stop
applying, any future default Boot improves does not reach you, and the wiring
between your manager and the auto-configured `DataSource` becomes your problem to
keep correct across upgrades. The risk it protects against — a dependency change
silently swapping the manager — is real, but the better mitigation is to know
what you have and to have a test that fails when the behaviour changes, not to
opt out of the mechanism. Declaring the manager yourself is justified when you
genuinely need something auto-configuration will not give you: multiple data
sources, a custom `nestedTransactionAllowed`, or a manager wrapping a resource
Boot does not know about.

**★ Adding a starter changed your transaction manager. What would you check first
to find out what broke?**
The three things a manager change moves. First, exception types: a JPA manager
wraps failures differently, and a `catch` on a specific `DataAccessException`
subtype can stop matching. Second, timing: JPA buffers writes in the persistence
context and flushes them at the boundary or on demand, so code that read back its
own write through plain JDBC may now see stale data, and constraint violations
that used to fire at the statement now fire at flush or at commit. Third,
capability: `NESTED` propagation depends on savepoint support and is documented
as working out of the box only on the JDBC manager, so a `NESTED` annotation that
worked can start failing. Checking those three in order usually locates the
change faster than reading the diff, because the diff does not mention
transactions at all.

**★ The other Boot property is `spring.transaction.rollback-on-commit-failure`. What
does it do, and should you set it?**
It binds to `AbstractPlatformTransactionManager.setRollbackOnCommitFailure`, and the
javadoc's own verdict answers the second half: "Set whether `doRollback` should be
performed on failure of the `doCommit` call. Typically not necessary and thus to be
avoided, as it can potentially override the commit exception with a subsequent rollback
exception. Default is `false`." So the default is to let the commit failure propagate as
it is; switching it on adds a rollback attempt afterwards, and the risk named in the
javadoc is that the rollback can itself fail and replace the *real* diagnostic — you
lose "the commit failed because of a deferred constraint" and get "the rollback failed"
instead. That is a poor trade for the usual case, where a failed commit has already left
the transaction resolved. The property exists for resources where a failed commit
genuinely leaves work pending; treat it, like most flags in this topic, as something you
turn on for a named reason rather than defensively.

**★ Two related flags live on the same base class and change behaviour far more than
that one. What are they?**
`globalRollbackOnParticipationFailure` and `failEarlyOnGlobalRollbackOnly`, and both are
worth knowing because they are the switches behind the `UnexpectedRollbackException`
story. The first defaults to **true**: "If a participating transaction… fails, the
transaction will be globally marked as rollback-only. The only possible outcome of such
a transaction is a rollback: The transaction originator *cannot* make the transaction
commit anymore." That single default is why catching an exception from an inner
`@Transactional` call does not save the outer one — [chunk 9](09-marked-rollback-only.md).
The javadoc also explains why turning it off is rarely viable: doing so "will only work
as long as all participating resources are capable of continuing towards a transaction
commit even after a data access failure: This is generally not the case for a Hibernate
`Session`… neither is it for a sequence of JDBC insert/update/delete operations."

The second defaults to false, "only causing an `UnexpectedRollbackException` at the
outermost transaction boundary". Setting it true raises that exception "as early as the
global rollback-only marker has been first detected, even from within an inner
transaction boundary" — which is a genuinely useful diagnostic setting in a test or
staging profile, because it moves the failure to where the marking happened rather than
to the outer commit, where the stack trace tells you nothing about the cause.

---

← Prev: [6b · The implementations](06b-which-manager-you-have.md) · Index: [04 · Spring @Transactional](README.md) · Next → [6d · The status handle](06d-the-status-handle.md)
