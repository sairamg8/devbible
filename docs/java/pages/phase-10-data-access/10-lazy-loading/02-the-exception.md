---
title: "The exception message names the entity, the id and which of three different things went wrong — and in Hibernate 7 the wording changed enough that most search results are answering a question about a different version"
sidebar_label: "02 · The exception"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)),
> the `org.hibernate.LazyInitializationException` and `org.hibernate.SharedSessionContract`
> javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/LazyInitializationException.html)),
> and `org.hibernate.cfg.TransactionSettings.ENABLE_LAZY_LOAD_NO_TRANS`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html)).
> JDK 25, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**`LazyInitializationException` is one exception type covering three genuinely different
failures, and the suffix on the message is the only thing that tells them apart: `no
session`, `the owning session was closed`, `the owning session is disconnected`. The prefix
gives you the entity and the identifier, which is usually enough to find the call site
without a debugger. And in Hibernate 7 every one of these strings was rewritten — the
famous Hibernate 5 wording is gone — so a search for the message you actually got returns
far less than a search for the one people remember.**

## The class

```
org.hibernate.LazyInitializationException  extends  org.hibernate.HibernateException
```

Its javadoc is one sentence, and it is a good definition:

> *"Indicates an attempt to access unfetched data outside the context of an open stateful
> `Session`."*

Three load-bearing words. **Unfetched** — the data was never read, so this is not a
staleness problem. **Outside** — the failure is about where the code is, not what it asked
for. **Stateful** — a `StatelessSession` has no persistence context and no proxies to
outlive it, so this exception belongs to the `Session` / `EntityManager` programming model
specifically.

It extends `HibernateException`, which extends `RuntimeException`. There is one public
constructor, taking a message. There is no error code, no cause chain, and nothing on the
type to interrogate — **the message string is the entire diagnostic payload**, which is why
it is worth reading properly.

## The three messages, from the 7.4 source

`AbstractLazyInitializer.initialize()` builds each one the same way and differs only in the
final clause:

```java
throw new LazyInitializationException( "Could not initialize proxy ["
        + entityName + "#" + id + "] - no session" );

throw new LazyInitializationException( "Could not initialize proxy ["
        + entityName + "#" + id + "] - the owning session was closed" );

throw new LazyInitializationException( "Could not initialize proxy ["
        + entityName + "#" + id + "] - the owning session is disconnected" );
```

### `Could not initialize proxy`

A proxy, not a collection. That single word tells you the failure is on a `@ManyToOne` or a
`@OneToOne`, not a `@OneToMany` — collections produce a different message entirely, covered
in **[01c · A collection is not a proxy](01c-a-collection-is-not-a-proxy.md)**.

### `[com.acme.Customer#4711]`

The entity name and the identifier, from the two fields the `LazyInitializer` carries. This
is more useful than it looks:

- **The entity name narrows the mapping.** You now know which association is unloaded — it
  is one of the fields whose type is `Customer`.
- **The identifier is a real key.** You can go and look at the row. If it is an id that
  should not exist, or an id from a different tenant, the problem is not lazy loading at all.
- **Together they are enough to find the call site by grep** most of the time, without
  reproducing anything.

⚠️ The identifier here is the proxy's `id` field, so it is present even though nothing was
ever fetched. That is the same fact as
**[01 · What a proxy actually is](01-what-a-proxy-actually-is.md)**'s "reading the id is
free", read from the other direction.

### `- no session`

`session == null`. The proxy was **detached**: `unsetSession()` ran on it. The session may
still be open and serving other work; this object was cut loose from it.

This is the overwhelmingly common one, and it is the shape produced by every scenario in this
topic — returning an entity from a `@Transactional` method, serialising after the transaction
without open-session-in-view, reading an entity out of a cache, passing one to another
thread.

### `- the owning session was closed`

`session != null` but `!session.isOpenOrWaitingForAutoClose()`. The proxy still holds a
reference to its session; that session has been closed.

The distinction from the previous case is real and it points somewhere different. The object
was **not** detached — nothing evicted it, nothing cleared the context — so this is not a
"you returned an entity" problem. It is a *lifetime* problem: something is holding the object
past the end of the session it belongs to, with the reference intact. Typical sources are a
field on a long-lived bean, a static or thread-local cache, a collection accumulated across
requests, or an object captured by a lambda that runs later.

### `- the owning session is disconnected`

`session.isOpenOrWaitingForAutoClose()` is true but `!session.isConnected()`. The session
object is alive and has not been closed; what it does not currently have is a JDBC
connection. `SharedSessionContract.isConnected()` is documented as *"Check if the session is
currently connected"*, and `close()` as *"End the session by releasing the JDBC connection
and cleaning up"* — so connectedness is about holding a physical connection, separately from
being open.

This is the rarest of the three and the most informative when it appears. It says the
persistence machinery is intact and the *plumbing* is not: the connection was returned to
the pool while the session stayed open. Suspect connection-release settings, a JTA
environment, or code running after a transaction boundary in a container that hands the
connection back at commit.

## Two more, from the escape hatch

If `hibernate.enable_lazy_load_no_trans` is on — the `@Unsafe`-annotated setting whose
javadoc says *"Generally speaking, all access to transactional data should be done in a
transaction. Use of this setting is discouraged"* — `initialize()` delegates to
`permissiveInitialization()`, which opens a temporary session instead of throwing. When
*that* fails you get one of:

```java
"Could not initialize proxy [" + entityName + "#" + id + "] - no session"          // no factory UUID
"Could not initialize proxy [" + entityName + "#" + id + "]: " + e.getMessage()    // temp session failed
"Could not initialize proxy [" + entityName + "#" + id + "] - session was closed or disconnected"
```

**The third one is a tell.** `session was closed or disconnected`, with the two joined by
`or`, appears nowhere in the normal path — which distinguishes the two by design. Seeing it
means the unsafe setting is enabled in the environment that produced the trace, whether or
not anyone remembers turning it on. The setting is treated properly in
**[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)**.

## Two neighbours that are not this exception

**`Could not retrieve real entity name [Entity#id] - no session`** — also a
`LazyInitializationException`, thrown from `getImplementationEntityName()`. It comes from
asking what concrete type the proxy stands for, which is a fetch. If you see this rather than
`Could not initialize proxy`, something in the stack is doing type resolution — a serialiser
choosing a writer, a polymorphic mapper, an `instanceof` workaround.

**`Illegally attempted to associate proxy [Entity#id] with two open sessions`** — a plain
`HibernateException`, not a `LazyInitializationException`, thrown from `setSession` when a
proxy that is already connected to one open session is handed to another. Same object, same
family of causes, completely different diagnosis: this is a caching or object-sharing bug,
not a fetching one.

## 🔴 The wording changed, and it matters for searching

Hibernate 5's strings for these situations were different — a lower-case `could`, a
capital-S `Session`, and a quite different construction for collections. Hibernate 7.4's are
the ones quoted above: **capital `Could`, lower-case `session`.**

The practical consequence is not cosmetic:

- **Pasting your actual message into a search engine returns much less** than pasting the
  Hibernate 5 form, because fifteen years of questions, answers and blog posts use the old
  wording.
- **The advice attached to those old results is Hibernate 5 advice.** Some of it is still
  right; some of it names settings, defaults and behaviours that have since changed. The two
  are not distinguishable from the snippet.
- **A log-based alert or a test that greps for the old string silently stopped matching** on
  upgrade. If a monitoring rule for this exception has gone quiet since a Hibernate upgrade,
  check the pattern before concluding the problem was fixed.

The reliable way to alert on it is the type, not the text: catch or match
`org.hibernate.LazyInitializationException`.

## Gotchas

**★ The message is the whole diagnostic.** The type carries no code, no entity handle and no
cause. Truncating it in a log format, or wrapping it in a generic "internal error", destroys
everything you would have used.

**★ `no session` and `the owning session was closed` mean different bugs.** Detached versus
outliving. The first points at a boundary — something returned an entity. The second points
at *storage* — something kept one. They are fixed differently and the message is the only
thing separating them.

**★ The identifier in the message is real and worth reading.** It is the value Hibernate
built the proxy from. An id that does not exist, is zero, or is null is telling you about a
mapping or a data problem that has nothing to do with laziness.

**★ `session was closed or disconnected` proves the unsafe setting is on.** The `or` form
only exists in `permissiveInitialization`. That is a configuration discovery, not a fetching
one.

**★ A stack trace can point at a framework, not at your code.** Serialisers, template
engines, loggers and reflective mappers are the callers in most real occurrences. The
`[Entity#id]` prefix is often the only part of the trace that names your domain.

**★ This exception cannot be caught usefully at the point it is thrown.** By the time it
fires, the data needed to complete the operation is unavailable and the session that could
have got it is gone. Catching it to return a partial response converts a visible bug into a
silent one.

**★ The equivalent failure for a *missing row* is `EntityNotFoundException`, not this.** A
proxy created by `getReference` for an id that has no row throws
`jakarta.persistence.EntityNotFoundException` on first access — a completely different
exception with a different meaning. See
**[04b · What still works on a detached entity](04b-what-still-works-when-detached.md)**.

**★ Wrapping frameworks may translate it.** Spring's exception translation can surface
Hibernate exceptions as `org.springframework.orm` types depending on where they cross a
boundary. If you are matching on the class name in a test or a handler, match the cause
chain too.

## Interview questions

**★ Read this message and tell me what happened: `Could not initialize proxy
[com.acme.Order#88] - no session`.**
A lazy singular association pointing at `Order` with id 88 was touched by code that had a
detached proxy. `no session` means the initializer's session field was `null`, which happens
when the entity is detached — the persistence context was cleared, the owner was evicted, or
far more commonly, the object was returned out of a `@Transactional` method and used after
the session that loaded it had gone. The word "proxy" rules out a collection, and the entity
name plus the id are usually enough to find both the mapping and the row without reproducing
it.

**★ What is the difference between `no session` and `the owning session was closed`?**
Whether the proxy still holds a reference to its session. `no session` means `unsetSession()`
ran and the field is `null` — the object was detached, and it may have been detached while
the session carried on working. `the owning session was closed` means the reference survived
and the session behind it has been closed — nothing detached the object, something *kept* it.
The first is a boundary problem, fixed by not letting entities cross the boundary. The second
is a lifetime problem, fixed by finding what is storing the object: a field on a singleton, a
cache, a thread-local, a captured lambda.

**★ What does `the owning session is disconnected` tell you?**
That the session is open but does not currently hold a JDBC connection — `isOpen()` is true
and `isConnected()` is false. Hibernate documents `isConnected` as checking whether the
session is currently connected, and `close()` as releasing the JDBC connection, so the two
states are independent. It is the rarest of the three and it points at the plumbing rather
than at the code: connection-release timing, a JTA container that returns the connection at
commit, or work continuing after a transaction boundary that handed the connection back.

**★ Why does the message contain an identifier when nothing has been loaded?**
Because the identifier is the one piece of state the proxy holds without fetching. Hibernate
read the foreign key with the owning row and built the proxy from it, so `entityName` and
`id` are fields on the `LazyInitializer`. That is the same property that makes
`getPublisher().getId()` free, seen from the failure side, and it is why this exception is
unusually easy to diagnose from a log line alone.

**★ You upgrade from Hibernate 5 to 7 and your alert for this exception stops firing. Why?**
Because the message strings were rewritten. The Hibernate 5 wording is gone — 7.4 emits
`Could not initialize proxy [X#1] - no session` with a capital C and a lower-case s, and the
collection form was rebuilt entirely around the mapped role and key. Any alert, log filter or
test assertion matching on the old text silently stops matching, which reads as "the problem
went away". Match on the exception type `org.hibernate.LazyInitializationException`, never on
the text.

**★ Is `Illegally attempted to associate proxy with two open sessions` a lazy-loading bug?**
Not in the sense this topic means. It is a `HibernateException` rather than a
`LazyInitializationException`, thrown from `setSession` when a proxy already bound to one
open session is offered to another. It means the same entity instance is being shared across
sessions — usually a second-level or application-level cache handing out managed objects, or
an object passed between threads. The fix is to stop sharing managed instances, which is the
same conclusion this topic reaches by a different route.

**★ Should you catch `LazyInitializationException`?**
Not to recover from — at the point it is thrown, the data is unavailable and the session that
could have fetched it is gone, so any handler is choosing between failing and lying. There
are two legitimate uses. One is at the very top of a request, to turn it into a clear
server-side error and a log entry that keeps the full message. The other is in a test, as an
assertion that a boundary is real — a test that asserts the exception fires when a DTO
boundary is bypassed is a test that will catch the regression later.

**★ Why does the javadoc say "stateful Session" specifically?**
Because the exception is a property of the persistence-context model. A `StatelessSession`
has no persistence context, so it does not hand out managed entities whose associations can
outlive a context — there is nothing to become detached. The wording is a pointer to the
alternative programming model, which Hibernate 7 brought to near feature parity with
`Session`, rather than idle precision.

{/* FOOTER */}
