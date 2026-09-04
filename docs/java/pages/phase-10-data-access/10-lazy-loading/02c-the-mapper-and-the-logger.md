---
title: "The other two callers are worse than the serialiser because they are the fix people reach for and the diagnostic people turn on: a reflective bean mapper walks the same graph, and a log statement makes the bug depend on the log level"
sidebar_label: "02c · The mapper and the logger"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching* and §3.26 *equals() and hashCode()*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.Hibernate` javadoc for `getClass`, `unproxy` and `isInitialized`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> and the `7.4` source of `org.hibernate.proxy.AbstractLazyInitializer`
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/proxy/AbstractLazyInitializer.java)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**The serialiser and the template at least look like output. These two do not, and that is
what makes them interesting. A reflective bean mapper is the thing people reach for as the
*fix* for the serialiser case, and it fails identically because it reads the same fields at
the same moment. A log statement is a diagnostic, and it makes the presence of the bug
depend on the log level — so the failure appears when you turn logging up to investigate
something else, and vanishes when you turn it back down. Neither runs in the response path,
so neither is constrained to fire at the end of a request; both can fire anywhere.**

## The third caller · the reflective bean mapper

`ModelMapper`, `Dozer`, `BeanUtils.copyProperties`, an assertion library's `usingRecursiveComparison`,
a generic `Map<String,Object>` flattener — anything that says "map A to B without me listing
the fields".

```java
BookDto dto = modelMapper.map(book, BookDto.class);   // outside the transaction
```

This one deserves its own entry rather than being lumped in with the serialiser, because
**people reach for it specifically as the fix for the serialiser case.** The reasoning is
"the problem is that I returned an entity, so I will map it to a DTO first" — which is
correct in principle and wrong in this implementation, because a reflective mapper walks the
same graph the serialiser would have walked, by the same mechanism, at the same point in
time.

The variants and what each does:

| Tool | How it decides what to visit | Does it touch lazy fields? |
|---|---|---|
| `ModelMapper` with implicit matching | name matching over the whole graph | yes, and transitively |
| `BeanUtils.copyProperties` | every readable property with a matching writable one | yes, one level |
| MapStruct | **generated code you can read** | only what the generated method reads |
| A hand-written mapper | the lines you wrote | only what you wrote |

The bottom two rows are the point. **MapStruct generates a plain Java class at compile
time**, so the mapping is code in your build output that you can open and read; if it dots
into an association, you can see it. The top two rows are configuration-driven, and the set
of fields they touch is discovered at runtime.

A mapper is the right idea. It has to run **inside** the transaction, and it has to be one
whose reachable set you can see — that is **[05b · Mapping to a DTO](05b-mapping-to-a-dto.md)**.

## The fourth caller · the log statement

```java
log.debug("loaded {}", book);
```

If `Book.toString()` includes `publisher`, this line is a database access. Lombok's
`@ToString` includes every field by default, so **the annotation that generates the method
is usually the reason the method is dangerous** — nobody wrote out the field list, so nobody
noticed the association in it.

This one has a property none of the others have, and it is nasty:

🔴 **The behaviour changes with log level.** At `INFO` the argument is never formatted, so
nothing is touched and the program works. Turn on `DEBUG` to investigate an unrelated
problem and the application starts throwing `LazyInitializationException` from a logging
statement. Turn it back off and the exception goes away. This is the single most confusing
version of this failure, because the change that caused it is a configuration change with no
apparent connection to persistence.

Related shapes with the same cause:

- **`String.valueOf(entity)` / `"" + entity`** in an exception message, which formats
  eagerly and unconditionally.
- **`assertThat(x).isEqualTo(y)` on entities**, because a failure message calls `toString`
  on both sides — so the assertion *passes* silently and *fails* with a
  `LazyInitializationException` instead of a comparison, hiding what actually differed.
- **A structured-logging encoder** that serialises the whole argument object to JSON, which
  is case 1 wearing a different hat.
- **An APM or error-reporting agent** capturing local variables at the point an unrelated
  exception was thrown. The agent walks whatever is on the stack, and one of those things is
  a detached entity.

The `toString` recursion problem — a bidirectional association making `toString` non-terminating
— is a separate failure with the same trigger, covered in
**[Topic 07 · 15 · equals, hashCode and toString](../07-relationships-fetch/15-equals-hashcode-tostring.md)**.

## What all four have in common, stated once

**Every one of them is a general-purpose graph walk over an object model that was designed
for a database, not for traversal.** An entity's fields are a mapping of foreign keys. A
serialiser reads them as a document tree. A template reads them as a navigable expression
namespace. A mapper reads them as a source of values. None of those readings is wrong; they
just all assume that dereferencing a field is free, and in an entity model it is a query, and
after the session closes it is an exception.

That observation is the whole argument for
**[05 · The DTO boundary](05-the-dto-boundary.md)**: the fix is not to make the walk safe, it
is to give these tools an object whose fields really are just values.

## Reading the stack trace

A trace from this failure is long and almost entirely other people's code. Read it from the
bottom of the library frames, not from the top:

- **The topmost frames** are `AbstractLazyInitializer.initialize` and the generated proxy
  class — always the same, no information.
- **The next block** is the getter on the generated subclass, named
  `Book$HibernateProxy$…` or similar, then a `ByteBuddyInterceptor` frame. Also always the
  same.
- **Then a long run of library frames.** *This* is the useful part: it tells you which of the
  four callers you have. Jackson's `BeanSerializer` / `PropertyWriter`, Thymeleaf's
  `SpelExpression`, ModelMapper's `PropertyMappingImpl`, Logback's `MessageFormatter`.
- **Then, finally, one frame of yours** — usually a controller method, sometimes a filter.
  That frame is the *boundary*, not the bug. The bug is that an entity was allowed past it.

⚠️ The frame of yours nearest the exception is frequently a method with **no data access in
it at all** — a controller that only returns what the service gave it. Reading the trace
top-down invites the conclusion "the controller is doing database work", which is exactly
backwards: the controller is doing nothing, and that is the problem.


## Gotchas

**★ A reflective mapper is not a DTO boundary.** Converting an entity to a DTO with
`ModelMapper` or `BeanUtils` outside the transaction fails in exactly the way returning the
entity would have. The boundary is about *when* the values are read, not about what type
they end up in. This is the single most common failed fix for this exception.

**★ The log-level case makes the bug appear and disappear with configuration.** `DEBUG` on
in staging, off in production, and the failure only ever reproduces in staging — which reads
as an environment problem and is not one. It also means a `DEBUG`-level rollout can take
production down with no code change.

**★ Lombok's `@ToString` includes associations by default.** Nobody wrote the field list, so
nobody reviewed it. `@ToString(exclude = …)` and `@ToString.Exclude` exist and are almost
never applied to entity classes at the time they are written, because at that moment the
association is not obviously a hazard.

**★ Assertion libraries walk the whole graph.** `usingRecursiveComparison`, a generated
`equals`, and JSON-comparison assertions all dereference associations. A test that fails with
`LazyInitializationException` instead of a diff is this — and worse, an assertion that
*passes* never formats its message, so the same test can be green for months and then throw
on the day it first fails.

**★ `String.valueOf(entity)` in an exception message formats unconditionally.** Unlike a
parameterised log call, string concatenation has no level guard. An exception message built
by concatenating an entity is a fetch that happens on every error path, including error
paths taken outside a transaction.

**★ Debuggers and IDE variable views are graph walkers too.** Expanding an entity in a
debugger calls getters. On an attached entity that quietly initialises associations and
changes the program's query count; on a detached one the view shows the proxy's own fields
rather than throwing, which makes the object look loaded when it is not. See
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**.

**★ An APM or error-reporting agent captures locals.** When an unrelated exception is thrown,
the agent serialises whatever is on the stack — including detached entities. The report you
then read may contain a `LazyInitializationException` raised by the reporting of the original
problem, not by the problem.

**★ A structured-logging encoder is the serialiser in disguise.** Logback and Log4j2 JSON
encoders serialise argument objects rather than calling `toString` on them, so excluding
fields from `toString` does not protect you. What protects you is not passing entities.

**★ MapStruct is different in kind, not just in speed.** It generates a plain Java class at
compile time, so the set of fields the mapping touches is code you can open and read, and a
mapping that dots into an association is visible in a diff. Runtime mappers make that set
invisible by design.

**★ The mapper case usually fires in the middle of the request, not at the end.** Which means,
unlike the serialiser, it *can* be caught and turned into a clean error response — and that
is a trap, because catching it converts a loud bug into a quiet one.

**★ `Map<String, Object>` flatteners and CSV/Excel writers count as reflective mappers.** So
do "generic export" endpoints and anything driven by a list of property-path strings. They
have every property of `ModelMapper` and are usually not thought of as mappers at all.

**★ `toString` on a *collection* field throws a different message.** Formatting a lazy
`@OneToMany` produces the `Cannot lazily initialize collection of role '…'` form rather than
`Could not initialize proxy`, which is a useful tell about which field the log statement
reached. See **[01c · A collection is not a proxy](01c-a-collection-is-not-a-proxy.md)**.

## Interview questions

**★ A colleague fixes the serialisation failure by mapping the entity to a DTO with
ModelMapper in the controller. Does that work?**
No, and it is instructive that it looks like it should. The problem was never the *type* that
crossed the boundary; it was that the values were read after the session closed. A reflective
mapper reads them by calling the same getters the serialiser would have called, at the same
point in the request, so it throws in the same place. What fixes it is moving the mapping
inside the transaction — and preferably to a mapper whose reachable set you can read, such as
generated MapStruct code or a hand-written method.

**★ Your application throws this only when `DEBUG` logging is enabled. Explain.**
A log statement is passing an entity as a parameter. At `INFO` the message is never
formatted, so `toString()` is never called and no association is dereferenced. At `DEBUG` the
formatter calls `toString()`, and if that method includes an association — which a Lombok
`@ToString` does by default, because it includes every field — it dereferences a detached
proxy. The fix is not the log level; it is to stop passing entities to loggers, or to exclude
associations from `toString`.

**★ How do you tell from a stack trace which of the four callers you have?**
Skip the top — `AbstractLazyInitializer.initialize` and the generated proxy frames are
identical every time. Read the block of library frames underneath: Jackson's `BeanSerializer`
means the JSON path, a SpEL or Thymeleaf expression frame means a template, `MessageFormatter`
or an appender means logging, a mapper's internals mean reflective mapping. The first frame of
your own code below that is the boundary the entity escaped through, not the bug.

**★ Why is MapStruct safer than ModelMapper here?**
Not because it is faster, though it is. Because it generates the mapping as ordinary Java
source at compile time, so the set of fields it reads is fixed, visible in your build output,
and reviewable in a diff. A runtime mapper decides what to read by matching names over the
object graph at execution time, which means the set of associations it will touch is not
knowable from reading the code — and grows silently when someone adds a field.

**★ A test passes for six months and then fails with `LazyInitializationException` rather
than an assertion message. What happened?**
The assertion started failing. An assertion library formats its failure message by calling
`toString` on both sides, or by walking both graphs to produce a diff — work it does only on
failure. So the day the values genuinely diverged, the library tried to describe the
difference, walked a detached entity and threw. The lazy-loading exception is a side effect of
the real failure and it has hidden it.

**★ Where in a request does the mapper case fire, and why does that matter?**
Wherever you call the mapper, which is usually in a controller or an application service
before anything has been written to the response. That makes it recoverable in a way the
serialiser case is not — you could catch it and return an error. Which is precisely why it is
dangerous: catching it means choosing between failing and returning a response with fields
silently missing, and the second option is the one people pick.

**★ You exclude associations from `toString` and the log still throws. Why?**
Because the appender is not using `toString`. A JSON or structured encoder serialises the
argument object through a reflective serialiser, exactly as an HTTP message converter would,
so the property list comes from the class rather than from your `toString`. Excluding fields
from one does nothing to the other. The rule that survives both is: entities are not log
arguments.

**★ Is `Hibernate.isInitialized` a reasonable guard inside a mapper?**
It stops the exception and it is still the wrong answer. Guarding each association means the
DTO now has fields that are populated or `null` depending on what the caller happened to
fetch, so the same mapper produces different documents for the same row and no caller can
tell which. It converts a loud failure into a data-dependent one. The mapper should be able to
assume the data it needs is there, which means the *query* is what has to change.

**★ Why do all four callers behave the same way despite having nothing to do with each other?**
Because all four are general-purpose graph walks over an object model designed for a database
rather than for traversal. An entity's fields are a mapping of foreign keys; a serialiser
reads them as a document tree, a template as an expression namespace, a mapper as a source of
values, a logger as a description. All four assume dereferencing a field is free. In an entity
model it is a query, and after the session closes it is an exception.

**★ Given all four, what single change removes the whole class of failure?**
Stop letting entities leave the transaction. If the object handed to the serialiser, the
template, the mapper and the logger is a value type whose fields were read while the session
was open, none of these callers can trigger a fetch, because there is nothing to fetch. That
is not a workaround for four separate problems; it is the observation that all four were the
same problem, and it is the argument for
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

{/* FOOTER */}
