---
title: "Before you turn open-session-in-view off you need to know exactly what registers it, what the default is, when Boot warns about it and which callers it never covered — because half the surprises in the migration come from paths that were never protected in the first place"
sidebar_label: "07 · Turning open-in-view off"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix entry
> for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Boot `4.1.x` source of
> `org.springframework.boot.jpa.autoconfigure.JpaBaseConfiguration.JpaWebConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java)),
> and the `org.springframework.orm.jpa.support.OpenEntityManagerInViewInterceptor` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/support/OpenEntityManagerInViewInterceptor.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Turning this property off is the single change that converts this topic from theory into a
work queue. It is also the change most likely to be reverted within a day, because the failures
arrive all at once and some of them are not what they appear to be. This chunk is the
mechanics: the exact property, its default, the warning Boot logs and the precise condition
under which it logs it, the five conditions that decide whether the interceptor is registered
at all, and — the part that surprises everyone — the list of callers it never covered, whose
failures will be blamed on the migration and predate it by years.**

## The property

```yaml
spring:
  jpa:
    open-in-view: false
```

Boot's own description, from the properties appendix:

> *"Register `OpenEntityManagerInViewInterceptor`. Binds a JPA `EntityManager` to the thread
> for the entire processing of the request."*

**Default: `true`.**

And the interceptor's own javadoc, which is unusually candid about its purpose:

> *"Spring web request interceptor that binds a JPA `EntityManager` to the thread for the
> entire processing of the request. Intended for the 'Open EntityManager in View' pattern, i.e.
> to allow for lazy loading in web views despite the original transactions already being
> completed."*

🔴 **"Despite the original transactions already being completed."** That sentence is the whole
topic. The pattern exists to let you read through a reference after the unit of work that gave
it meaning has ended.

## The warning, and the exact condition for it

From Boot 4.1's `JpaWebConfiguration`:

```java
@Bean
public OpenEntityManagerInViewInterceptor openEntityManagerInViewInterceptor() {
    if (this.jpaProperties.getOpenInView() == null) {
        logger.warn("spring.jpa.open-in-view is enabled by default. "
                + "Therefore, database queries may be performed during view "
                + "rendering. Explicitly configure spring.jpa.open-in-view to disable this warning");
    }
    return new OpenEntityManagerInViewInterceptor();
}
```

Two things follow, and the second one is a trap.

1. **The warning fires only when the property is unset.** `getOpenInView()` is a `Boolean`; the
   check is for `null`, not for `false`.
2. ⚠️ **Setting it explicitly to `true` also silences the warning.** The warning says "disable
   this warning", and the fastest way to do that is `open-in-view: true`, which changes nothing
   and removes the only reminder. A codebase with an explicit `true` in it has usually been
   through this exact exchange.

**The right first move is not to turn it off. It is to write the value down.** An explicit
`true` is at least a decision that a reviewer can see and argue with, and it is a legitimate
step while you plan the migration — as long as everyone knows it is a placeholder.

## What actually registers the interceptor

The whole configuration class is gated:

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = Type.SERVLET)
@ConditionalOnClass(WebMvcConfigurer.class)
@ConditionalOnMissingBean({ OpenEntityManagerInViewInterceptor.class, OpenEntityManagerInViewFilter.class })
@ConditionalOnMissingFilterBean(OpenEntityManagerInViewFilter.class)
@ConditionalOnBooleanProperty(name = "spring.jpa.open-in-view", matchIfMissing = true)
protected static class JpaWebConfiguration { … }
```

Read as a list of facts about your application:

- **Servlet web applications only.** `Type.SERVLET`. A WebFlux application gets no interceptor
  at all, regardless of the property.
- **Spring MVC must be on the classpath.** `WebMvcConfigurer` is the marker.
- **A hand-declared interceptor or filter wins.** If somebody already defined an
  `OpenEntityManagerInViewInterceptor` or `OpenEntityManagerInViewFilter` bean, Boot backs off —
  and 🔴 **turning the property off does not remove *their* bean.** The property gates Boot's
  auto-configuration, not somebody's `@Bean` method. This is the single most common reason a
  migration appears to have no effect.
- **The property gates it, and defaults to on.** `matchIfMissing = true`.

Finally, the interceptor is added through a `WebMvcConfigurer` that calls
`registry.addWebRequestInterceptor(interceptor)` — so its scope is Spring MVC's handling of a
request, which matters for the next section.

## What open-in-view never covered

This is the part that decides how the migration is received, because these failures exist
today and will be attributed to the change.

**Anything that is not a servlet request.**

- A `@Scheduled` job.
- A `@KafkaListener`, `@RabbitListener` or JMS listener.
- An `ApplicationRunner` or `CommandLineRunner`.
- A `@PostConstruct`, an `@EventListener` fired outside a request, an actuator contributor
  written by hand.
- A thread from an `@Async` method or an executor — the binding is thread-local, and the
  interceptor bound it to the request thread.

**Anything that runs after MVC has finished handling the request.**

- `StreamingResponseBody`, `SseEmitter`, `ResponseBodyEmitter`, `DeferredResult`, a `Callable`
  return. The response body is written after the interceptor has unbound the `EntityManager`.
  Covered as a lifetime problem in
  **[04e · References that outlive](04e-references-that-outlive-the-method.md)**.

**Anything in a WebFlux application.** There is no interceptor to register.

**Test methods that are not transactional and not web.** A plain `@SpringBootTest` service test
has no request, so no binding.

So the honest framing for a team is: **open-in-view protects one caller — a Spring MVC request
— and your application already has failures on every other caller.** Turning it off does not
create a new class of bug; it makes one class of caller behave like all the others.

## What it costs while it is on

Deliberately not re-derived here, because Topic 08 works it out properly: queries issued
outside any transaction, a response that can be internally inconsistent, connection-hold time
across rendering, and traces where the database time is attributed to view rendering. See
**[Topic 08 · 15 · Open session in view](../08-the-n-plus-1-problem/15-open-in-view.md)** and
**[Topic 08 · 15b · What it costs](../08-the-n-plus-1-problem/15b-what-open-in-view-costs.md)**.

What belongs here is only the correctness observation from
**[03 · Why it never fires in dev](03-why-it-never-fires-in-dev.md)**: with it on, whether your
code works depends on who called it, and nothing in the code says so.

## The procedure

The mechanics above are the prerequisites; the migration itself — turning it off in tests
first, reading each exception it uncovers, and the order to convert endpoints in — is
**[07b · Doing the migration](07b-doing-the-migration.md)**. The catalogue of the seven things
that break in a running application and the proper fix for each is already written as
**[Topic 08 · 15c · Turning it off](../08-the-n-plus-1-problem/15c-turning-it-off.md)**; this
topic does not repeat it.

## Gotchas

**★ Setting the property explicitly to `true` silences the warning and changes nothing.** The
warning's own text tells you to "explicitly configure spring.jpa.open-in-view to disable this
warning", and the check in the source is `getOpenInView() == null`. So the most literal reading
of the advice produces a codebase with OSIV on, no warning, and no reminder.

**★ Turning the property off does not remove a hand-declared filter or interceptor bean.** The
property gates Boot's auto-configuration, which already backs off when such a bean exists. If
`spring.jpa.open-in-view: false` appears to have no effect, grep for
`OpenEntityManagerInViewFilter` and `OpenEntityManagerInViewInterceptor` before doubting the
property.

**★ A WebFlux application never had it.** `@ConditionalOnWebApplication(type = Type.SERVLET)`.
So a team migrating from MVC to WebFlux gets the whole of this topic's failure list on the day
of the migration, attributed to WebFlux.

**★ Every non-web caller has always run without it.** Scheduled jobs, message listeners,
runners and async threads were never covered. Failures there predate the property change and
will be blamed on it.

**★ The binding is thread-local, so it does not follow your work onto another thread.** An
`@Async` method called from a controller does not inherit the request thread's
`EntityManager`.

**★ Asynchronous response writing happens after the interceptor unbinds.** So OSIV does not
protect `SseEmitter`, `StreamingResponseBody` or `DeferredResult`, which is the one case where
"we have OSIV on" is not a valid answer to "is this safe".

**★ The property name is `spring.jpa.open-in-view`, not `spring.jpa.properties.…`.** It is a
Boot property, not a Hibernate one, and misfiling it under `properties` makes it inert with no
error — Hibernate ignores unknown keys there.

**★ The warning appears once, at startup, at `WARN`.** In an application that logs a hundred
lines at startup it is invisible, which is why so many teams have never seen it despite it
having been there for years.

**★ `@ConditionalOnMissingBean` means a third-party starter can turn it back on.** Any library
that defines its own OSIV filter bean will keep the pattern alive regardless of your property.

## Interview questions

**★ What is `spring.jpa.open-in-view`, what is its default, and what does Boot say about it?**
It controls registration of `OpenEntityManagerInViewInterceptor`, described in Boot's properties
appendix as binding "a JPA EntityManager to the thread for the entire processing of the
request". It defaults to `true`. Boot logs a warning at startup when the property is not set at
all, saying that it is enabled by default, that database queries may therefore be performed
during view rendering, and that you should configure it explicitly to disable the warning.

**★ Why is setting it explicitly to `true` a trap?**
Because the warning is emitted only when the property is `null`, so writing `true` silences it
while leaving the behaviour exactly as it was. The warning is doing a useful job — it is the
only thing telling a team that this is on — and the change that most directly satisfies its
wording is the change that removes the signal. Writing `true` down is defensible as an
intentional, temporary decision; doing it to clear a log line is not.

**★ Someone sets `spring.jpa.open-in-view: false` and nothing changes. What do you check?**
Whether a bean is declaring the filter or interceptor directly. Boot's auto-configuration is
`@ConditionalOnMissingBean` on both `OpenEntityManagerInViewInterceptor` and
`OpenEntityManagerInViewFilter`, and the property only gates Boot's own registration — it has
no power over a `@Bean` method in the application or in a third-party starter. Also check that
the property was not filed under `spring.jpa.properties`, where it is silently ignored.

**★ Which parts of your application were never covered by open-in-view?**
Everything that is not a Spring MVC request. Scheduled jobs, message listeners, application
runners, async threads and lifecycle callbacks have no interceptor and never did — the
configuration is conditional on a servlet web application. Anything that writes the response
after MVC finishes handling the request is also uncovered, because the interceptor unbinds at
that point. And a WebFlux application has none of it at all.

**★ Why does that matter for the migration?**
Because it changes what the failures mean. When the property is turned off and twenty things
break, some of them were already broken on other callers and had simply never been exercised.
Framing the change as "we are making the web path behave like every other path" is both true
and much easier to defend than "we removed a safety net", which is how it is usually described.

**★ Why does the interceptor's own javadoc make the case against it?**
Because it says the pattern exists "to allow for lazy loading in web views despite the original
transactions already being completed". Read plainly, that is a description of reading
transactional data outside the transaction that produced it. It is honest about what it does;
the disagreement is only about whether that is a thing you want.

{/* FOOTER */}
