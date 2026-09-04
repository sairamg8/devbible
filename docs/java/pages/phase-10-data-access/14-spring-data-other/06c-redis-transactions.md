---
title: "Redis has no rollback, Spring Data Redis has no transaction manager of its own, and a `GET` inside a Redis transaction returns null — three sentences that dismantle everything the word transaction implies"
sidebar_label: "06c · Redis transactions"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Redis documentation *Transactions*
> ([redis.io/docs/latest/develop/using-commands/transactions/](https://redis.io/docs/latest/develop/using-commands/transactions/))
> and the Spring Data Redis 4.1 reference *Redis Transactions*
> ([docs.spring.io/spring-data/redis/reference/redis/transactions.html](https://docs.spring.io/spring-data/redis/reference/redis/transactions.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Redis 8.

**`MULTI`/`EXEC` is called a transaction and Spring exposes it through `@Transactional`,
and between those two facts sits a set of assumptions that are all wrong. Redis gives you
isolation and no atomicity-on-failure. Spring gives you participation in somebody else's
transaction, because Spring Data Redis ships no transaction manager. And inside the
transaction your own writes are invisible to your own reads. Everything you learned in
[03 · Transactions at the JDBC level](../03-jdbc-transactions/README.md) has to be set
down before this page makes sense.**

## What Redis guarantees, in its own words

> *"All the commands in a transaction are serialized and executed sequentially. A request
> sent by another client will never be served **in the middle** of the execution of a Redis
> Transaction. This guarantees that the commands are executed as a single isolated
> operation."*

That is genuine isolation, and it is free — Redis executes the queued block without
interleaving anything else. What you do **not** get is the other half:

> *"Redis does not support rollbacks of transactions since supporting rollbacks would have a
> significant impact on the simplicity and performance of Redis."*

> *"even when a command fails, all the other commands in the queue are processed – Redis
> will _not_ stop the processing of commands."*

So a Redis transaction is **all-or-nothing only against interruption, never against
error**. If the third of five queued commands fails at execution time — a list operation
against a string, say — the other four still apply, `EXEC` returns an array containing an
error in position three, and nothing is undone. Errors detected *while queueing* (a
malformed command) are different: since 2.6.5 the server refuses the whole transaction at
`EXEC`.

**Reframe it as "a batch that cannot be interleaved" and every subsequent decision becomes
clearer.**

### `WATCH` is the only mechanism that resembles a concurrency guarantee

> *"`WATCH`ed keys are monitored in order to detect changes against them. If at least one
> watched key is modified before the `EXEC` command, the whole transaction aborts, and
> `EXEC` returns a Null reply to notify that the transaction failed."*

This is optimistic locking, in exactly the sense of
[06 · `@Version` and optimistic locking](../06-jpa-hibernate-model/16-version-and-optimistic-locking.md):
read, compute, and let the commit fail if the world moved. A null reply from `EXEC` means
retry the whole read-compute-write sequence. Note what counts as a modification —
*"modifications made by the client, like write commands, and by Redis itself, like
expiration or eviction"* — so an expiring key can abort your transaction, which in a store
full of TTLs is not a rare event.

And the documentation's own conclusion about the whole feature:

> *"Everything you can do with a Redis Transaction, you can also do with a script, and
> usually the script will be both simpler and faster."*

A Lua script runs atomically on the server and can *branch on values it read*, which
`MULTI`/`EXEC` fundamentally cannot. For anything with a condition in the middle, a script
is the better tool. (Redis 8.4 also documents `SET` with `IFEQ`/`IFNE` and a `DELEX`
command for single-key compare-and-set — worth knowing about, and a version above this
page's Redis 8 spine.)

## Same connection or nothing

> *"`RedisTemplate` is not guaranteed to run all the operations in the transaction with the
> same connection."*

`MULTI` is connection state. A template that hands you a different connection for the next
call has queued your commands somewhere you will never `EXEC` them. `SessionCallback` is
the fix, and it is not optional:

```java
List<Object> txResults = redisOperations.execute(new SessionCallback<List<Object>>() {
  public List<Object> execute(RedisOperations operations) throws DataAccessException {
    operations.multi();
    operations.opsForSet().add("key", "value1");

    // This will contain the results of all operations in the transaction
    return operations.exec();
  }
});
```

The reference also shows the defensive form, because an exception between `multi()` and
`exec()` — a timeout, a serialization failure, a bug in your own code — can leave the
connection stuck in a transactional state:

```java
try {
  operations.multi();
  operations.opsForSet().add("key", "value1");
  return operations.exec();
} catch (RuntimeException e) {
  operations.discard();
  throw e;
}
```

**Always write the `discard()`.** A connection returned to the pool mid-`MULTI` poisons
whatever borrows it next.

## `@Transactional` support, and what it is actually attached to

By default `RedisTemplate` does not participate in Spring-managed transactions. Turning it
on is one setter — and the reference's own configuration example says something remarkable:

```java
@Configuration
@EnableTransactionManagement
public class RedisTxContextConfiguration {

  @Bean
  public StringRedisTemplate redisTemplate() {
    StringRedisTemplate template = new StringRedisTemplate(redisConnectionFactory());
    template.setEnableTransactionSupport(true);
    return template;
  }

  @Bean
  public PlatformTransactionManager transactionManager() throws SQLException {
    return new DataSourceTransactionManager(dataSource());
  }
}
```

The transaction manager in the Redis documentation's Redis example is a
**`DataSourceTransactionManager`** — a JDBC one. That is not an oversight. **Spring Data
Redis does not ship a `PlatformTransactionManager`.** There is nothing to declare, so
`setEnableTransactionSupport(true)` means "bind my Redis connection to whatever Spring
transaction is already running", and in practice that transaction belongs to a relational
database.

With it enabled:

- the `RedisConnection` is bound to the current transaction through a `ThreadLocal`;
- a successful commit issues `EXEC`, a rollback issues `DISCARD`;
- **write commands are queued** until commit;
- **read-only commands are piped to a fresh, non-thread-bound connection**, because a queued
  read would return `QUEUED` rather than a value.

Which produces the behaviour the reference documents in three lines of comments:

```java
// must be performed on thread-bound connection
template.opsForValue().set("thing1", "thing2");

// read operation must be run on a free (not transaction-aware) connection
template.keys("*");

// returns null as values set within a transaction are not visible
template.opsForValue().get("thing1");
```

**You cannot read your own writes.** In every relational database in this phase, a
transaction sees its own uncommitted changes; that is the most basic property of a
transaction. Here the write is sitting in a queue on one connection and the read is being
served by another. Any code that writes and then reads back — a check, a merge, an
"increment if present" — is broken by enabling transaction support, and broken *silently*,
because `null` is a valid answer to a `GET`.

## And it is still not two-phase commit

A JDBC rollback issues `DISCARD`, which is neat. The other direction does not exist: if
`EXEC` runs and one of its commands fails, there is no rollback in Redis to propagate, and
the database transaction has already been told everything is fine. Two stores, one
annotation, no distributed atomicity — the same conclusion reached from the MongoDB side in
[04b · Wiring a Mongo transaction](04b-wiring-a-mongo-transaction.md), and the same remedy:
an outbox, an idempotent replay, or a compensating action.

## Gotchas

**★ Redis has no rollback.** A command that fails during `EXEC` does not stop or undo the
others. The word "transaction" is doing work here that it does not do anywhere else in this
phase.

**★ A transaction is isolation without atomicity-on-error.** Nothing interleaves, and
nothing is undone. If you needed all-or-nothing on failure, a Lua script with an early
return is the mechanism, not `MULTI`.

**★ `RedisTemplate` may use a different connection per call.** `MULTI` on one connection and
`EXEC` on another is not a transaction; it is two unrelated commands. `SessionCallback` is
the only supported way.

**★ An exception between `multi()` and `exec()` can strand the connection in a transactional
state.** Wrap it and call `discard()`, or the next borrower of that connection inherits your
queue.

**★ With transaction support enabled, reads do not see your writes.** They are served on a
different connection, and `get` after `set` returns `null`. This is documented and it is
still the most surprising line in the Spring Data Redis reference.

**★ Spring Data Redis has no transaction manager.** The reference's own example uses
`DataSourceTransactionManager`. Redis participates in a transaction owned by something else,
or in none at all.

**★ `@Transactional` around Redis-only work does nothing useful without another store.**
There is no manager to start a transaction, so the annotation is inert — the dead-annotation
pattern again, this time with no candidate manager at all.

**★ A rollback of the database rolls back the Redis queue, but never the reverse.** A failed
`EXEC` cannot undo a committed SQL transaction. Ordering the two operations is the only lever
you have.

**★ `WATCH` aborts on expiry and eviction, not just on writes.** In a keyspace full of TTLs,
`EXEC` returning null is normal traffic and the retry loop must be real, not an exception
you log.

**★ `EXEC` returns an array with one entry per queued command, and errors live inside it.**
Code that checks only for an exception misses a failure sitting in position three of the
result list.

**★ Redis repository saves are not transactional either.** Four commands per save, no
`MULTI` around them — see
[05 · Redis repositories](05-redis-repositories.md). Enabling template transaction support
does nothing for repository writes.

**★ Pipelining is not a transaction and a transaction is not pipelining.**
`executePipelined` removes round trips with no isolation; `MULTI`/`EXEC` gives isolation with
the round trips intact. Confusing them produces code that has neither property it was meant
to have.

## Interview questions

**★ Is a Redis `MULTI`/`EXEC` block atomic?**
It is isolated, not atomic in the failure sense. No other client's command is served in the
middle, but Redis does not support rollbacks — if one queued command fails at execution
time, the rest still run and nothing is undone.

**★ What happens when a command inside a transaction fails?**
It depends on when. A command that cannot be queued — bad syntax — causes the server to
refuse the whole transaction at `EXEC`. A command that fails at execution time returns an
error in its slot of the `EXEC` reply array while every other command applies.

**★ Why must you use `SessionCallback`?**
Because `MULTI` is per-connection state and `RedisTemplate` is not guaranteed to use the same
connection for consecutive operations. `SessionCallback` pins one connection for the whole
block.

**★ Why does `get` return null after `set` inside a Spring-managed Redis transaction?**
Because writes are queued on the thread-bound connection and read-only commands are piped to
a separate, non-transaction-aware connection. The write has not been executed yet and the
reader is not looking at that connection anyway.

**★ Which transaction manager does Redis use?**
None of its own. Spring Data Redis ships no `PlatformTransactionManager`; the reference's
example wires a `DataSourceTransactionManager`. `setEnableTransactionSupport(true)` makes
the Redis connection join a transaction that some other resource owns.

**★ Can you make a Postgres write and a Redis write atomic?**
No. A database rollback will `DISCARD` the Redis queue, but a failed `EXEC` cannot roll back
a committed database transaction, and there is no two-phase commit. You order the operations
so the recoverable one goes second, and you make the second one idempotent and replayable.

**★ What is `WATCH` for, and what does a null `EXEC` mean?**
`WATCH` makes `EXEC` conditional on a set of keys being unmodified — check-and-set. A null
reply means one of them changed, including by expiry or eviction, and the correct response is
to retry the whole read-compute-write cycle.

**★ When would you use a Lua script instead?**
Whenever the operation needs to branch on a value it read. A script runs atomically on the
server and can make decisions mid-flight; `MULTI` queues commands blindly. The Redis
documentation says outright that anything a transaction can do, a script can do, usually more
simply and faster.

{/* FOOTER */}
