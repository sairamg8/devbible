---
title: "Almost nobody writes the line that throws — and the two callers that produce it most often, a JSON serialiser and a template engine, both run after the response has already started being written"
sidebar_label: "02b · Where it fires"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.6 *Proxies and lazy
> fetching*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `org.hibernate.Hibernate` javadoc for `getClass`, `unproxy` and `isInitialized`
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/Hibernate.html)),
> the Spring Boot 4.1 reference *JSON* section on the auto-configured `JsonMapper`
> ([docs.spring.io/spring-boot/reference/features/json.html](https://docs.spring.io/spring-boot/reference/features/json.html)),
> and the Spring Framework `OpenEntityManagerInViewInterceptor` class documentation
> ([docs.spring.io/spring-framework/reference/data-access.html](https://docs.spring.io/spring-framework/reference/data-access.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**If you go looking for the statement that threw, you will usually find that nobody in your
team wrote it. The four commonest callers are a JSON serialiser, a template engine, a
reflective bean mapper and a `toString()` inside a log line, and they share one property:
each of them is handed an object and told to visit everything reachable from it. None of
them knows which fields are proxies, none of them can be told to stop at the transaction
boundary, and all four are driven by reflection, so there is no code in your repository to
review. That is why this failure survives code review, and it is also why the stack trace
is thirty frames of somebody else's library with one frame of yours near the bottom.**

## The shape every one of these callers shares

Write out what an ordinary lazy fetch looks like when *you* do it:

```java
Publisher p = book.getPublisher();   // you wrote this line
String name = p.getName();           // and this one — this is the fetch
```

Two lines, both yours, both greppable. Now write out what happens when a serialiser does it:

```java
return bookRepository.findById(id).orElseThrow();   // the only line you wrote
```

The fetch is somewhere inside a `for` loop over `BeanPropertyWriter` instances, in a
library, driven by a list of properties discovered from the class by reflection at startup.
**There is no line to grep for**, because the decision "visit `publisher` next" is data, not
code.

This gives the failure three properties worth naming up front:

- **It is not local to a call site.** Adding a field to an entity can make a controller
  written two years ago start throwing, with no change to the controller.
- **It is total, not selective.** These callers do not fetch the association you meant; they
  fetch *every* association, and then every association of those, until the graph is
  exhausted or it recurses.
- **The trace names the library.** Which is why the `[Entity#id]` prefix in the message —
  see **[02 · The exception](02-the-exception.md)** — is often the only part of the whole
  failure that names your domain.

:::note What this chunk is not about
Every one of these callers *also* produces a pile of extra queries when the session **is**
open, and that is the N+1 story, argued in
**[Topic 08 · 4c · Serialisation and logging](../08-the-n-plus-1-problem/04c-serialization-and-logging.md)**.
Here the session is gone, so instead of being slow the program stops. Same caller, different
failure, and it is worth being able to tell which one you are looking at.
:::

## The first caller · the JSON serialiser

The single most common producer of this exception in a Spring application.

```java
@GetMapping("/books/{id}")
public Book get(@PathVariable Long id) {
    return service.load(id);        // @Transactional inside — commits before returning
}
```

Spring Boot auto-configures a mapper and hands your return value to it. In the Boot 4.1
generation that is a Jackson 3 `JsonMapper` — the reference states plainly that *"Jackson 3
is the preferred and default library. Support for Jackson 2 is deprecated and will be
removed in a future Spring Boot 4.x release"* — but the mechanism is identical in either
version and has been for a decade.

What the mapper does with a `Book`:

1. Introspects `Book` once and builds a list of serialisable properties.
2. For each property, calls the getter.
3. If the value is not a scalar, recurses into it.

Step 2 is the fetch. `getPublisher()` returns a proxy; step 3 asks the proxy for its
properties; the proxy's initializer finds `session == null` and throws.

Three things make this worse than it sounds:

- **The serialiser runs after your transaction has committed**, because the return value is
  serialised by the framework, on the way out, long after the `@Transactional` proxy
  released the session. Chronologically the fetch is the last thing that happens in the
  request, which is the furthest possible point from where the object was loaded.
- **It serialises what the class has, not what the endpoint needs.** Nobody asked for the
  publisher. It is in the JSON because it is a field.
- **A partially written response is not rolled back.** By the time it throws, bytes may
  already be on the wire. What the client receives is a truncated body, or a 200 followed by
  a broken stream, depending on buffering — which is a far worse failure mode than a clean
  500.

⚠️ **Getting a `Could not retrieve real entity name` message rather than `Could not
initialize proxy` is a strong hint the caller is a serialiser**, because choosing a writer
for a polymorphic property is exactly the type-resolution question that
`getImplementationEntityName()` answers. See
**[01b · Type questions are fetches](01b-type-questions-are-fetches.md)**.

## The second caller · the template engine

Server-side rendering — Thymeleaf, JSP, FreeMarker, Mustache — is the case
open-session-in-view was actually designed for, and it is worth understanding why.

```html
<span th:text="${book.publisher.name}">…</span>
```

The dot is a fetch. The expression is a string, evaluated at render time by reflection, and
render time is **after the controller returned**. There is no compiler, no IDE warning and
no type checker between you and it; a template that dots one level too deep is a runtime
failure that no build catches.

Two differences from the serialiser case:

- **It is selective, not total.** A template touches only the paths it mentions, so a
  template can be correct for years and break when a designer adds one expression.
- **The failure lands mid-page.** Half the HTML has been flushed. Most template engines
  cannot un-write it, so the user sees a truncated page rather than an error page — and the
  server log shows a `LazyInitializationException` with a stack trace that goes through the
  view resolver.

This is the one case where "keep the session open" has a real argument behind it, and Spring
documents the interceptor for exactly this purpose. That argument is taken seriously, and
answered, in **[07 · Turning open-in-view off](07-turning-open-in-view-off.md)**.

Two callers remain — the reflective bean mapper and the log statement — and they differ from
these two in one way that matters: they are not in the response-writing path, so they can
fire at any point in the request. They are
**[02c · The mapper and the logger](02c-the-mapper-and-the-logger.md)**.

## Gotchas

**★ There is no line of code to review.** Both callers decide what to visit from metadata,
not from source. A reviewer looking at the diff that introduced the bug will see a new field
on an entity, or a new template expression — never a fetch.

**★ Adding a field to an entity can break an endpoint that nobody touched.** The serialiser
picks it up automatically, because its property list is derived from the class. This is the
mechanism by which a change in one team's module breaks another team's endpoint with no
compile-time link between them.

**★ A partially written response is worse than a 500.** The exception fires
mid-serialisation, after the status line and possibly after some body bytes. The framework
cannot retract them. Clients see truncated JSON or a broken chunked stream, and error-rate
dashboards may not count it as an error at all.

**★ The exception may be swallowed rather than thrown.** Some template engines, and some
serialiser configurations, catch exceptions per property and substitute a placeholder or a
`null`. Then you do not get an exception; you get a field quietly missing from the response,
which is a data-correctness bug rather than an availability one — and far harder to notice.

**★ Error handlers are themselves a place it fires.** A `@ExceptionHandler` or an error page
that renders details of the entity involved walks the same graph, throwing a second
exception while handling the first. The second one is often the only one that gets logged,
so the original failure disappears.

**★ The same code is safe in one deployment and not in another.** With open-session-in-view
on, both callers succeed. That is not a difference in the code; it is a difference in when
the session closes, and it is the subject of
**[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**.

**★ Both of these run after the response has begun.** That is what removes your ability to
return a clean error. It is also why the fix has to happen earlier — before the controller
returns — rather than by catching anything.

**★ `@JsonIgnore` on the association makes the symptom go away and the design worse.** It
does stop the walk. It also means the serialisation shape of your domain model is now
decided by annotations scattered across entity classes, and the next endpoint that genuinely
wants that association cannot have it. Treated properly in
**[06 · Fixes that are not fixes](06-fixes-that-are-not-fixes.md)**.

**★ A `ResponseEntity<Book>` is exactly as dangerous as a `Book`.** So is
`List<Book>`, `Page<Book>`, `Map<String, Book>` and a DTO with a `Book` field in it. The
wrapper is irrelevant; what matters is whether an entity is reachable from the returned
object.

**★ Streaming responses extend the window.** A `StreamingResponseBody`, an SSE emitter or a
`ResponseBodyEmitter` serialises over a period that can be arbitrarily long, on a different
thread, with the session long gone. Everything above applies, for longer, on a thread that
never had a persistence context at all.

## Interview questions

**★ Why is `LazyInitializationException` so often thrown by a line nobody wrote?**
Because the commonest callers are reflective graph walks: a JSON serialiser, a template
engine, a bean mapper and a `toString` in a log statement. Each is handed a root object and
visits everything reachable from it, deciding what to visit from metadata discovered at
runtime rather than from source. So the fetch is real but there is no statement in your
repository that performs it — which is why it survives code review and why the stack trace
is almost entirely library frames.

**★ Walk me through what happens when a controller returns a managed entity.**
The `@Transactional` proxy around the service commits and closes the session as the service
method returns, so the object handed back to the controller is detached. The controller
returns it; Spring's message converter passes it to the auto-configured mapper — a Jackson 3
`JsonMapper` in the Boot 4.1 generation. The mapper introspects the entity's properties and
calls each getter. Any lazy association returns a proxy whose `session` field is `null`, and
recursing into that proxy throws. The transaction is long gone, so nothing can fetch the
data, and some of the response may already have been written.

**★ Why is a truncated response worse than a clean 500?**
Because the exception fires during serialisation, and by then the status line — usually 200 —
and possibly part of the body have been written. The client gets valid-looking headers with a
body that ends mid-object, which many HTTP clients report as a parse failure rather than a
server error, and which many error dashboards do not count at all. A failure that does not
show up as a failure is the expensive kind.

**★ Why is a template failure different in kind from a serialiser failure?**
A serialiser is total and mechanical: it visits every property, so for a given entity shape it
either works or never works. A template is selective and textual: it touches only the paths
written in the markup, evaluated by reflection with no compile-time check. So a template can
be correct for years and break because someone added one expression, and the failure lands
halfway through a partially flushed page. It is also the one case with a genuine argument for
keeping the session open, which is why Spring ships an interceptor for it.

**★ Can this exception be thrown while handling another exception?**
Yes, and it is common. An `@ExceptionHandler`, an error-page controller or an APM agent
capturing local variables will all touch whatever objects are in scope, including detached
entities. The `LazyInitializationException` then masks the original problem, because it is
the exception that reaches the log. If a trace shows this exception thrown from an error
handler, the real failure is the one that got you into the handler.

**★ You are asked to find every place in a codebase where this could fire. How?**
Not by grepping, because there is nothing to grep. You look for the boundaries instead: every
controller method whose return type is an entity or contains one, every template expression
that dots past a mapped association, every logger call passing an entity, and every reflective
mapper invocation outside a transaction. Then you make the boundary enforceable rather than
audited — turn open-in-view off in tests so the failures are real, and stop entities being a
legal return type from the service layer.

**★ If open-session-in-view is on, are these callers safe?**
They stop throwing. They are not safe: each of them now issues an unbounded number of queries
outside the transaction, during response rendering, and the fetch plan of an endpoint becomes
whatever the object graph happens to contain. The exception was the signal that the boundary
had been crossed; removing the signal does not move the boundary. What it costs is argued in
**[Topic 08 · 15b · What open-in-view costs](../08-the-n-plus-1-problem/15b-what-open-in-view-costs.md)**.

**★ Would returning a `ResponseEntity<Book>` instead of a `Book` change anything?**
No. The message converter unwraps the `ResponseEntity` and serialises the body, so the graph
walk is identical. The same is true of `List<Book>`, `Page<Book>`, `Optional<Book>` and a DTO
that happens to hold an entity reference. The question to ask about any return type is not
what the outer type is but whether an entity is reachable from it.

**★ Why does the serialiser fetch associations nobody asked for?**
Because it serialises the class, not the request. Its property list comes from introspecting
`Book`, so every mapped field is a property, and every association is a subtree to descend
into. There is no notion of "what this endpoint needs" anywhere in the mechanism — that
notion exists only in a type you define for the purpose, which is the argument for
**[05 · The DTO boundary](05-the-dto-boundary.md)**.

**★ An SSE endpoint throws this ten seconds after the request started. How?**
Because a streaming response serialises over time, usually on a different thread from the one
that ran the controller. The transaction ended at the controller return; every element
emitted after that is serialised with no session anywhere, and the thread it runs on never
had one bound to it. Streaming does not create a new failure mode — it stretches the existing
one out and moves it onto a thread where even open-session-in-view would not have helped.

{/* FOOTER */}
