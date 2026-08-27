---
title: "readOnly = true is not a guard against writing, it is a hint to the driver and an instruction to Hibernate to stop dirty-checking — which is why the same flag that makes a large read cheaper can make an update disappear without an error"
sidebar_label: "09b · What readOnly does"
sidebar_position: 42
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Transactionality"
> ([jpa/transactions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html))
> — and PostgreSQL 18 `SET TRANSACTION`
> ([postgresql.org](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Every read method you inherit runs with `readOnly = true`
([09](09-transactions-on-repositories.md)), and a lot of teams put it on the repository
interface as well. It is worth knowing exactly what that flag does, because the name
suggests enforcement and the behaviour is three other things — one of which can lose a
write silently.**

## What the reference says it is

The whole answer is one paragraph, and it is worth having in full:

> *"You can use transactions for read-only queries and mark them as such by setting the
> `readOnly` flag. Doing so does not, however, act as a check that you do not trigger a
> manipulating query (although some databases reject `INSERT` and `UPDATE` statements
> inside a read-only transaction). The `readOnly` flag is instead propagated as a hint to
> the underlying JDBC driver for performance optimizations. Furthermore, Spring performs
> some optimizations on the underlying JPA provider. For example, when used with
> Hibernate, the flush mode is set to `MANUAL` when you configure a transaction as
> `readOnly`, which causes Hibernate to skip dirty checks (a noticeable improvement on
> large object trees)."*

Three separate claims:

1. **It is not a check.** Spring does not inspect your statements.
2. **It is a hint to the JDBC driver**, for whatever that driver chooses to do with it.
3. **With Hibernate it sets the flush mode to `MANUAL`,** so dirty checking is skipped.

The general mechanism — where the flag goes, which transaction manager acts on it, and
when it reaches the connection at all — belongs to
[04 · 15 · read-only](../04-spring-transactional/15-read-only.md) and
[04 · 15b](../04-spring-transactional/15b-where-read-only-pays.md). What follows is the
part that shows up specifically through a repository.

## The consequence that costs you: no dirty checking

Dirty checking is how a JPA update normally happens
([06 · 14 · dirty checking](../06-jpa-hibernate-model/14-dirty-checking.md)): you load an
entity, change a field, and Hibernate compares it against its snapshot at flush time and
issues the `UPDATE`. `FlushMode.MANUAL` removes the flush, so the comparison never runs.

```java
@Transactional(readOnly = true)                 // ← on the service, or on the interface
public void deactivate(Long id) {
    User user = repository.findById(id).orElseThrow();
    user.setActive(false);                      // no exception, no UPDATE, no log line
}
```

🔴 **Nothing fails.** The method returns normally, the transaction commits, and the row is
unchanged. There is no warning, no debug message and no failed assertion — the only
evidence is that the data did not change. This is the single most expensive way to be
wrong about `readOnly`, and it is common precisely because "annotate reads read-only" is
good advice that people then apply to a method that turned out not to be a read.

The same mechanism makes the flag *valuable*. On a query returning ten thousand entities,
skipping the snapshot comparison at flush is a real saving — the reference calls it *"a
noticeable improvement on large object trees"*. The flag is a performance tool, and its
failure mode is silence.

⚠️ **An explicit `flush()` is a different question.** `FlushMode.MANUAL` means Hibernate
does not flush automatically; it does not by itself make the persistence context refuse
work. The reference does not spell out what an explicit `EntityManager.flush()` inside a
`readOnly` transaction does, and I did not find a statement settling it — so do not build
on it. If a method needs to write, do not mark it read-only.

## What the database does — and PostgreSQL does enforce

The reference's parenthesis — *"although some databases reject `INSERT` and `UPDATE`
statements inside a read-only transaction"* — is not hypothetical on PostgreSQL:

> *"The transaction access mode determines whether the transaction is read/write or
> read-only. Read/write is the default. When a transaction is read-only, the following SQL
> commands are disallowed: `INSERT`, `UPDATE`, `DELETE`, `MERGE`, and `COPY FROM` if the
> table they would write to is not a temporary table; all `CREATE`, `ALTER`, and `DROP`
> commands; `COMMENT`, `GRANT`, `REVOKE`, `TRUNCATE`; and `EXPLAIN ANALYZE` and `EXECUTE`
> if the command they would execute is among those listed. This is a high-level notion of
> read-only that does not prevent all writes to disk."*

So if the read-only flag reaches the PostgreSQL session as `SET TRANSACTION READ ONLY`,
a write that *is* attempted fails loudly. That is a much better failure than silence — but
it only helps for statements that actually reach the database, and the dirty-checking case
above never produces one. **The two failure modes are complementary, not redundant:** the
database catches a bulk `@Modifying` statement in a read-only transaction; nothing catches
an entity mutation that was never flushed.

Whether the flag reaches the connection at all depends on the transaction manager and its
configuration, which is [04 · 15b](../04-spring-transactional/15b-where-read-only-pays.md)'s
subject, not this one.

## Where this lands for repositories

- The inherited read methods are `readOnly = true` and that is correct — they read.
- The inherited write methods override it with a plain `@Transactional`, so `save` is not
  affected.
- `@Transactional(readOnly = true)` on the repository *interface* covers your declared
  query methods, which otherwise have no configuration at all. Good default; put a plain
  `@Transactional` on every `@Modifying` method to lift it.
- 🔴 `@Transactional(readOnly = true)` on a **service** method covers everything that
  method does, including the `save` call it makes — because the outer transaction's
  configuration is the one in force
  ([09c](09c-the-service-boundary.md)). A read-only service method that calls `save` is the
  same silent failure with a different call stack.
- Re-declaring an inherited method to change a setting drops the flag entirely, per
  [09](09-transactions-on-repositories.md).

## Gotchas

**★ `readOnly = true` does not prevent writes; it stops Hibernate looking for them.** The
flush mode becomes `MANUAL`, dirty checking is skipped, and an entity mutation produces no
`UPDATE` and no error.

**★ The failure is silent, and tests usually miss it.** A test that changes a field and
asserts on the in-memory object passes. Only a test that re-reads in a *new* transaction
catches it — which is exactly the class of assertion
[04 · 20d](../04-spring-transactional/20d-what-a-test-must-assert.md) argues for.

**★ A read-only *service* method makes every repository write inside it read-only too.**
The outer configuration wins. `save` being annotated read-write on `SimpleJpaRepository`
does not save you, because it participates rather than starting a new transaction.

**★ PostgreSQL rejects writes in a read-only transaction — for statements that reach it.**
Useful for bulk `@Modifying` statements. Useless for a mutation Hibernate never flushed.

**★ "Some databases" means it is not portable.** The reference is deliberately vague; do
not design a safety property around database enforcement.

**★ `readOnly` is not an isolation level and not a lock.** It says nothing about what other
transactions can do or about what you will see. A read-only transaction can still observe a
concurrent commit exactly as its isolation level allows.

**★ Marking a method read-only "because it is mostly a read" is how this bug is written.**
The flag is per transaction, not per statement. One write in the method makes the whole
method not a read.

**★ It is a real optimisation, and worth having.** Skipping dirty checks on a large result
set is a genuine saving, and the JDBC driver hint may be too. The argument here is for
knowing what it does, not for avoiding it.

## Interview questions

**★ Does `@Transactional(readOnly = true)` stop you writing?**
No. The reference says it does not act as a check. It is a hint to the JDBC driver and, with
Hibernate, sets the flush mode to `MANUAL` so dirty checks are skipped. Some databases —
PostgreSQL among them — reject write statements that actually reach them.

**★ Why does an entity mutation inside a read-only transaction not throw?**
Because there is nothing to throw. Hibernate never flushes, so it never compares the entity
against its snapshot, so no `UPDATE` is ever generated and no statement reaches the database
to be rejected.

**★ What is the *benefit* of the flag then?**
Skipping dirty checking on large object graphs, which the reference calls a noticeable
improvement, plus whatever the JDBC driver does with the hint and whatever the database does
with a read-only transaction.

**★ A service method annotated `readOnly = true` calls `repository.save(…)`. What happens?**
The save participates in the outer read-only transaction, so the outer configuration is what
applies. `SimpleJpaRepository.save`'s own plain `@Transactional` does not take effect because
no new transaction is started.

**★ How would you catch this class of bug in a test?**
Re-read the row in a separate transaction and assert on the persisted state. Asserting on the
entity you just mutated always passes, because you are looking at your own in-memory object.

**★ Does PostgreSQL enforce read-only transactions?**
Yes, for the statements listed in `SET TRANSACTION`: `INSERT`, `UPDATE`, `DELETE`, `MERGE`,
non-temporary `COPY FROM`, all DDL, `TRUNCATE`, `GRANT`/`REVOKE`, and `EXPLAIN ANALYZE` or
`EXECUTE` of any of those. It is a high-level notion that does not prevent all writes to
disk.

**★ Would you put `readOnly = true` on a repository interface?**
Yes, with the discipline the reference demonstrates: interface-level `readOnly = true` so
declared query methods are transactional at all, plus a plain `@Transactional` on every
`@Modifying` method. The risk is a `default` method or a fragment that writes and inherits
the flag.

{/* FOOTER */}
