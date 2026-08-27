---
title: "The last three candidates do not try to keep the session open — they remove the failure instead, by fetching without a session, by catching the exception, or by keeping one persistence context alive across the whole conversation"
sidebar_label: "06b2 · Turning it off"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against `org.hibernate.cfg.TransactionSettings.ENABLE_LAZY_LOAD_NO_TRANS`,
> annotated `@Unsafe`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/TransactionSettings.html)),
> the `org.hibernate.LazyInitializationException` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/LazyInitializationException.html)),
> the Spring Framework 7.0 reference, *JPA · Implementing DAOs* on
> `@PersistenceContext(type = EXTENDED)`
> ([docs.spring.io/spring-framework/reference/data-access/orm/jpa.html](https://docs.spring.io/spring-framework/reference/data-access/orm/jpa.html)),
> and the Hibernate ORM 7.4 *Introduction* §5.1 on persistence-context lifetime
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**The candidates so far have all tried to keep a session alive long enough for somebody to
read through it. These three go the other way: make the read succeed without a session, make
the exception not be thrown, or make the session never end. Each works. The first is annotated
`@Unsafe` by Hibernate itself, the second converts a detectable defect into wrong data, and the
third is documented by Spring as unusable in the component model every Spring application is
built out of.** Continues
**[06b · More fixes that are not fixes](06b-more-fixes-that-are-not-fixes.md)**.

## 1 · `hibernate.enable_lazy_load_no_trans`

```properties
spring.jpa.properties.hibernate.enable_lazy_load_no_trans=true
```

**What it genuinely does.** Exactly what it says, and Hibernate documents it plainly:

> *"Allows a detached proxy or lazy collection to be fetched even when not associated with an
> open persistence context, by creating a temporary persistence context when the proxy or
> collection is accessed."*

The exception stops. Every lazy access anywhere in the application now works.

**What Hibernate itself says about it.** The constant is annotated `@Unsafe`, and its api note
is a single sentence:

> *"Generally speaking, all access to transactional data should be done in a transaction. Use
> of this setting is discouraged."*

**Why it is not a fix.**

- **It opens a temporary session and a temporary transaction per access.** So a serialiser
  walking a hundred-element collection can open a hundred short-lived units of work, each with
  its own connection acquisition.
- **Every read is now in a different transaction.** A single JSON response can contain data
  from a dozen points in time, with no isolation between them. It is not merely slow; the
  result can be internally inconsistent in a way no database-level isolation setting can
  prevent.
- **It is application-wide and invisible.** It logs nothing, warns about nothing, and is
  usually one line in a profile nobody reads. Two developers on the same commit with different
  profiles get different behaviour.
- **It removes your only signal.** After this setting, the application cannot tell you where
  its fetch-plan debt is, because nothing fails.

The tell that it is on — a distinctive message variant on the code path where the escape hatch
itself fails — is in **[02 · The exception](02-the-exception.md)**, and the case for it as a
reason the exception hides in dev is
**[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**.

## 2 · Catching the exception

```java
String customerName;
try {
    customerName = order.getCustomer().getName();
} catch (LazyInitializationException e) {
    customerName = null;                 // "graceful degradation"
}
```

**What it genuinely does.** It converts a 500 into a response with missing data.

**Why it is not a fix.**

- **The data is silently wrong.** A null customer name and an unfetched customer are
  indistinguishable to every consumer. A client that renders "—" for a missing name will render
  it for a fetch-plan bug, and nobody will report it as one.
- **It is per-field.** Every association needs its own `try`, and a new association needs a new
  one.
- **It suppresses the only thing telling you the design is wrong**, permanently, and does so in
  a way that looks defensive and responsible in review.
- **The exception may not be catchable where you think.** If the failure happens inside a
  message converter or a template engine, the throw site is framework code and there is no
  block of yours around it — the wrapping is
  **[02b · Where it fires](02b-where-it-fires.md)**.

The variant that shows up in `@ControllerAdvice` — an exception handler that catches
`LazyInitializationException` and returns a partial response for the whole application — is the
same argument at a larger radius, and it is worse because it makes the failure invisible in
monitoring too.

## 3 · An extended persistence context

```java
@PersistenceContext(type = PersistenceContextType.EXTENDED)
private EntityManager em;
```

**What it genuinely does.** It decouples the persistence context from the transaction. The
context lives from creation until it is closed, spanning several transactions, so entities
loaded in one stay managed afterwards and lazy loading keeps working.

**Why it is not a fix in a Spring application.** The reference is blunt:

> *"The alternative, `PersistenceContextType.EXTENDED`, is a completely different affair. This
> results in a so-called extended `EntityManager`, which is not thread-safe and, hence, must
> not be used in a concurrently accessed component, such as a Spring-managed singleton bean.
> Extended `EntityManager` instances are only supposed to be used in stateful components that,
> for example, reside in a session, with the lifecycle of the `EntityManager` not tied to a
> current transaction but rather being completely up to the application."*

Every `@Service` and `@Repository` in a default Spring application is a singleton. So the
annotation on the bean you were about to put it on is documented as incorrect, and the failure
mode is not an exception — it is a persistence context shared between concurrent requests.

Even in the stateful case it is designed for, it inherits everything from Hibernate's own
warning: *"a persistence context holds a hard reference to all its entities, preventing them
from being garbage collected"*, and it must not be shared across threads. A conversation-scoped
context is a real pattern in stateful frameworks; it is not a way to make a REST endpoint stop
throwing.

## 4 · Re-querying in the view

```java
@GetMapping("/orders/{id}")
String get(@PathVariable long id, Model model) {
    Order order = service.findOrder(id);
    model.addAttribute("order", order);
    model.addAttribute("lines", service.findLines(id));    // a second call, a second transaction
    return "order";
}
```

**What it genuinely does.** It replaces navigation with a second service call, and the second
call runs in its own transaction, so it succeeds.

**Why it is not a fix.**

- **Two transactions, two points in time.** The order and its lines were read separately, with
  a window between them. The page can show a total that does not match the lines.
- **It scales by multiplication.** A list page becomes a call per row, each one a separate
  transaction with its own connection acquisition, which is an N+1 with extra overhead per
  query.
- **It leaves the entity in the model anyway**, so the template can still navigate it and still
  throw on anything else.

**The alternative, shown.** One transactional method, one consistent read, one value:

```java
@Transactional(readOnly = true)
public OrderView findOrder(long id) { … }        // header and lines, one unit of work
```

## Where this series ends

Eight candidates across three chunks, and the only thing they have in common is that not one
of them changes what the method returns. The remaining two are the serialiser-specific ones —
Jackson's Hibernate module and `@JsonIgnore` — which get their own chunk because they are the
most defensible of the set and still not a fix:
**[06c · Jackson and the Hibernate module](06c-jackson-and-the-hibernate-module.md)**.

## Gotchas

**★ `enable_lazy_load_no_trans` opens a temporary session per access.** It is not "lazy loading
without a transaction" in any efficient sense — it is one short unit of work per proxy, which
on a collection walk is one per element.


**★ `enable_lazy_load_no_trans` makes a single response internally inconsistent.** The
customer was read in one transaction, the address in another, milliseconds apart, with a
concurrent update possible in between. No isolation level protects you, because the reads are
genuinely in different transactions.


**★ The escape-hatch setting leaves no trace.** No warning, no startup banner, no log line. It
is the hardest of all these to discover from the outside, and the easiest to inherit.


**★ Catching `LazyInitializationException` turns a loud bug into silently wrong data.** A null
because nothing was fetched and a null because the column is null are indistinguishable
downstream, so the defect stops being reportable.


**★ You often cannot catch it anyway.** When the throw happens inside a message converter or a
template, it is wrapped by framework code and surfaces as something else entirely, so the
`try` block you added around your own call never sees it.


**★ `@PersistenceContext(type = EXTENDED)` on a `@Service` is documented as wrong, and it does
not fail loudly.** Spring says an extended `EntityManager` "must not be used in a concurrently
accessed component, such as a Spring-managed singleton bean". What you get instead of an error
is a persistence context shared between concurrent requests.

**★ An extended persistence context never releases its entities.** Hibernate's own warning is
that a context holds hard references to everything it has loaded. A long-lived one is a
long-lived object graph, which is a memory profile problem long before it is a correctness one.

**★ Re-querying in the view splits one read into two transactions.** The two halves of the
response can disagree, and no isolation setting helps, because they are genuinely different
transactions.

**★ Re-querying per row is an N+1 with transaction overhead on top.** Each call acquires a
connection, begins, commits and releases. It is strictly worse than the lazy loading it
replaced.

## Interview questions

**★ What is actually wrong with `enable_lazy_load_no_trans`, given it makes the exception go
away?**
Two things, and the second is the serious one. It opens a temporary persistence context and
transaction for each access, so a graph walk becomes a series of short units of work with
their own connection acquisitions. And because each read is a separate transaction, a single
response can contain data from many points in time with no isolation between the parts.
Hibernate annotates the setting `@Unsafe` and says use of it is discouraged, which is unusually
direct for a configuration option.


**★ Is catching `LazyInitializationException` ever defensible?**
Not as a fix. There is a narrow diagnostic use — catching it at a boundary to log which entity
and which association failed, then rethrowing — which is a temporary instrument, not a
behaviour. Swallowing it converts a detectable defect into wrong data, and it is not reliably
possible anyway: when the throw happens inside a message converter or a template engine the
exception is wrapped by framework code before any of your handlers see it.


**★ Someone proposes a `@ControllerAdvice` that catches it globally and returns a partial
response. What is your objection?**
That it makes the failure invisible everywhere at once. The endpoint returns 200, monitoring
shows no errors, the client renders missing fields as blanks, and the fetch-plan debt that
caused it is now undiscoverable. If the aim is to avoid 500s during a migration, the honest
version is to log at error level with the entity name and association from the message and
return 500 anyway — you want to know.


**★ Can you use an extended persistence context to keep entities managed across a request?**
Not in a normal Spring application. Spring's reference says an extended `EntityManager` is not
thread-safe and must not be used in a concurrently accessed component such as a Spring-managed
singleton bean — which is what every `@Service` and `@Repository` is by default. It is intended
for stateful components whose lifecycle the application controls, such as something living in a
session. Using it to stop a REST endpoint throwing swaps a visible exception for a shared
mutable persistence context across concurrent requests.

**★ A template needs the lines and the service only returns the order. Someone adds a second
service call. What is wrong with that?**
It reads the two halves of the page in two different transactions, so they can disagree — the
order's stored total and the lines it shows are snapshots from different instants. On a list
page it also becomes a call per row, each with its own transaction and connection acquisition,
which costs more than the lazy loading it was replacing. The fix is one transactional method
that reads everything the view needs and returns it as one value.

**★ Rank these eight candidates from least to most harmful.**
A defensible ordering: `Hibernate.initialize` and warming a getter are stopgaps that at least
do the right operation in the right place; `@Transactional` on the controller is mostly
ineffective; re-querying in the view is slow and inconsistent; `EAGER` is a permanent
per-call-site cost; an extended persistence context is documented as unusable in the standard
component model; `enable_lazy_load_no_trans` produces internally inconsistent responses
silently; and catching the exception is the worst, because it converts every one of the others'
symptoms into wrong data that nobody will ever report.

{/* FOOTER */}
