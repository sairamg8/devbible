---
title: "Open session in view is on by default in Spring Boot, and it is not a fix — it is the mechanism that makes every N+1 in this topic invisible while making each one more expensive"
sidebar_label: "15 · Open session in view"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Boot 4.1 *Common Application Properties* appendix
> entry for `spring.jpa.open-in-view`
> ([docs.spring.io/spring-boot/appendix/application-properties/](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> the Boot `4.1.x` source of `JpaBaseConfiguration.JpaWebConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-jpa/src/main/java/org/springframework/boot/jpa/autoconfigure/JpaBaseConfiguration.java)),
> and the Spring Framework `OpenEntityManagerInViewInterceptor` /
> `OpenEntityManagerInViewFilter` class documentation
> ([docs.spring.io/spring-framework/reference/](https://docs.spring.io/spring-framework/reference/data-access.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Hibernate ORM 7.4.1.

**Every fix in this topic assumes you can tell when an association is loaded outside the
plan you wrote. Open-session-in-view removes that signal. It keeps the persistence context
open until the response has been written, so a lazy association touched in a controller, a
serialiser or a template initialises successfully instead of throwing — which means the
`LazyInitializationException` that would have shown you the bug never happens, and the extra
queries happen instead. Spring Boot ships it enabled, and logs a warning about it that most
teams silence by setting the property to `true`.**

:::note The other half of this argument
This chunk is about what open-in-view does to *query counts*. What it does to the
*unit of work* — how long the persistence context lives, and what that changes about
dirty checking, flush and `readOnly = true` — is
[Topic 06 · 18c · open-in-view](../06-jpa-hibernate-model/18c-open-in-view.md).
:::

## What it actually does

The Spring class documentation for `OpenEntityManagerInViewInterceptor` states the mechanism
and the motivation in one sentence:

> *"Spring web request interceptor that binds a JPA `EntityManager` to the thread for the
> entire processing of the request. Intended for the 'Open EntityManager in View' pattern,
> i.e. to allow for lazy loading in web views despite the original transactions already being
> completed."*

Read the last clause twice. **"Despite the original transactions already being completed."**
That is not incidental phrasing — it is the whole design, and it is the source of every
problem below. There are two boundaries in a Spring request that people habitually think of
as one:

- **The transaction boundary** — opened and closed by `@Transactional` on your service
  method, typically the innermost few milliseconds of the request.
- **The session boundary** — the lifetime of the `EntityManager` and therefore of the
  persistence context.

Without OSIV those two coincide: the persistence context is created when the transaction
starts and closed when it commits. With OSIV, the session is opened by an interceptor before
the controller runs and closed after the response is rendered, and the transaction is a short
window inside it. **The entities you return from a service are still managed after the
transaction that loaded them has committed.**

Boot's property description says the same thing in fewer words: "Register
`OpenEntityManagerInViewInterceptor`. Binds a JPA `EntityManager` to the thread for the
entire processing of the request."

## The default, and the warning

`spring.jpa.open-in-view` is documented in the properties appendix with a default of
**`true`**.

The registration in `JpaBaseConfiguration.JpaWebConfiguration` is conditional on
`@ConditionalOnBooleanProperty(name = "spring.jpa.open-in-view", matchIfMissing = true)` —
`matchIfMissing = true` being the "on unless you say otherwise". And the bean method carries
this:

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

Three details in that snippet are worth more than the warning itself.

**The warning fires only when the property is `null`** — that is, unset. It is a nudge to
make a decision, not a claim that the setting is wrong. Setting
`spring.jpa.open-in-view: true` silences the warning **and leaves OSIV on**, which is very
often what happens: someone greps the warning text, finds a StackOverflow answer that says
"set it explicitly", sets it to `true`, and the log goes quiet with nothing else changed.
**Silencing the warning is not answering it.**

**The warning names the symptom precisely** and it is not "lazy loading works". It is
"database queries may be performed during view rendering". Boot is warning you that your data
access has escaped your data access layer.

**It is only registered for servlet web applications.** The surrounding conditions are
`@ConditionalOnWebApplication(type = Type.SERVLET)` and
`@ConditionalOnClass(WebMvcConfigurer.class)`, plus `@ConditionalOnMissingBean` for the
interceptor and the filter. So a WebFlux application, a batch job, a message consumer and a
scheduled task **never** get OSIV. This matters enormously in practice: code that works in a
controller throws `LazyInitializationException` the moment the same service method is called
from a `@Scheduled` job or a Kafka listener, and the team concludes the scheduler is broken.
It is not — the controller was.

## Why this is not a fix for N+1

It is worth being exact, because OSIV genuinely does make a symptom disappear.

**What it fixes:** `LazyInitializationException`. Genuinely, completely. Touch any lazy
association anywhere in the request and it initialises.

**What it does not fix:** the number of queries. **It increases it**, because the whole class
of accidental lazy loads that would have failed loudly now succeed quietly. Every serialiser
walk ([4c · Serialisation and logging](04c-serialization-and-logging.md)), every `toString`
in a log line, every template expression that dots through an association is now a query
instead of an exception.

So OSIV converts **a loud failure into a silent cost**. That is the entire trade, and it is
the reason it belongs in the "not a fix" part of this topic rather than the "fixes" part. The
bug is not that lazy loading fails; the bug is that something is loading data outside the plan.
An exception is a bug report. A slower endpoint is not.

There is a second-order effect that is worse. Because OSIV makes lazy loading always work,
**it removes the pressure to declare a fetch plan at all.** A team that has had it on since
day one has no `LazyInitializationException` in its history, no habit of writing fetch joins,
and no reason to think about the persistence context boundary — so the fetch plans never get
written, and the N+1s accumulate uniformly across the application rather than appearing one at
a time where someone has to deal with them.

## The argument people make for it, taken seriously

It deserves a fair hearing, because the argument is not stupid.

**"It decouples the view from the fetch plan."** True, and that is exactly the property in
dispute. If the view can pull whatever it needs, the service does not have to anticipate every
consumer. The counter-argument is that "the view pulls whatever it needs, one row at a time,
outside the transaction" is a description of the bug this topic is about.

**"It makes development faster."** Also true, especially early. You write the query, write the
template, and it works. The cost is deferred rather than avoided, and it is paid by whoever is
on call.

**"Turning it off breaks everything."** Often true on an existing codebase, and it is the
honest reason most teams leave it on. That is a migration problem with a known shape rather
than a reason the default is right —
[15c · Turning it off](15c-turning-it-off.md) works through what actually breaks and how each
one is fixed properly.

## Gotchas

**★ Setting `spring.jpa.open-in-view: true` to silence the warning changes nothing.** The
warning is conditional on the property being unset. Explicitly enabling OSIV silences it and
leaves every consequence in place — and now the setting reads as a deliberate decision to the
next person, which makes it harder to revisit.

**★ It is servlet-only, so the same service behaves differently by caller.** Controller: works.
`@Scheduled` job, message listener, `CommandLineRunner`, test without a web context, WebFlux
endpoint: `LazyInitializationException`. The service method did not change; the ambient session
did.

**★ It hides fetch-plan regressions completely.** Someone changes a controller to call
`findById` instead of `findDetailById` and the endpoint keeps working. Without OSIV it would
throw on the first association it touches. This is the specific regression that
[14d · Worked: the detail view](14d-the-detail-view.md) ends by warning about.

**★ "Database queries may be performed during view rendering" also means during
serialisation.** With a JSON API there is no view template, so teams assume the warning does
not apply to them. Jackson serialising a managed entity is view rendering by any useful
definition, and it is the single most common way OSIV-enabled applications generate queries
after the transaction.

**★ It changes what an exception during rendering means.** A query issued while the response
is being written can fail — connection exhausted, statement timeout — after the response status
and some of the body have already gone out. You get a truncated response with a 200 status.

**★ Enabling it does not make writes work.** Lazy loading works after the transaction commits;
mutation does not get a transaction of its own. Changes made to a managed entity during
rendering may simply be lost — the details are in [15b · What it costs](15b-what-open-in-view-costs.md).

**★ It is on in every Boot starter web application ever generated.** Nobody chose it. Treat
"we use OSIV" as a description of the default, not of a decision, until you find the commit
that made it one.

## Interview questions

**★ What does `spring.jpa.open-in-view` actually do?**
It registers `OpenEntityManagerInViewInterceptor`, which binds a JPA `EntityManager` to the
request thread for the whole request, so the persistence context outlives the transaction that
populated it. The Spring documentation's phrasing is the precise one: it exists "to allow for
lazy loading in web views despite the original transactions already being completed". The
practical consequence is that entities returned from a `@Transactional` service are still
managed while the controller runs and while the response is serialised, so touching a lazy
association there issues a query instead of throwing.

**★ Boot logs a warning about it. What is the correct response to that warning?**
To decide, and the decision is usually to turn it off. What the warning is asking is whether you
intend database queries to happen during view rendering — it fires only when the property is
unset, so setting it to `true` silences the log line while accepting exactly the behaviour the
warning was about. The correct responses are `false` plus fixing what breaks, or `true` plus a
comment in the config explaining why this application wants it.

**★ Is open-session-in-view a fix for `LazyInitializationException`?**
It is *a* fix in the narrow sense that the exception stops happening, and it is the wrong fix,
because the exception was the signal rather than the problem. `LazyInitializationException`
means something outside your data access layer is loading data. OSIV answers that by letting it
succeed. The alternative answers — fetch what you need in the query, or return a DTO — remove the
navigation instead of servicing it. Choosing OSIV is choosing to convert a build-time-visible
failure into a runtime cost.

**★ Why does the same service method work from a controller and fail from a scheduled job?**
Because OSIV is registered only for servlet web applications — the auto-configuration is
conditional on `@ConditionalOnWebApplication(type = Type.SERVLET)` and on `WebMvcConfigurer`
being present. A `@Scheduled` method, a message listener or a startup runner has no request, so
no interceptor bound a session to the thread, so the persistence context ends with the
transaction as it normally would. The failure is correct behaviour becoming visible, and the fix
is to give the service an explicit fetch plan rather than to wrap the job in a session.

**★ Does OSIV make N+1 better or worse?**
Worse, in both the count and the diagnosis. Worse in the count because lazy loads that would
have thrown now succeed, so serialisers, templates and log statements all generate queries.
Worse in diagnosis because those queries run after the transaction, in a phase of the request
nobody profiles, attributed to no service method — and because a team that never sees
`LazyInitializationException` never develops the habit of writing fetch plans at all. The only
thing it makes better is the number of stack traces, which was never the metric.

**★ You join a team with OSIV on and 300 endpoints. What do you do?**
Not flip the flag. I would leave the default in place, turn it off for tests first so new code
is written against the stricter model, then work endpoint by endpoint: give each read path an
explicit fetch plan or a DTO, add statement-count assertions as I go, and only flip the global
setting when the list of failures is short enough to fix in one change. Flipping it first turns
a slow application into a broken one, which is a worse position to argue from — and the fix for
each individual breakage is the same work either way.

**★ Why does Boot log a warning about it instead of just changing the default?**
Because changing it would break a large number of existing applications in a way that is not
mechanically fixable — every endpoint relying on lazy loading during rendering would start
throwing, and the fix for each is a design decision about what that endpoint returns. The warning
is the compromise: the default stays compatible, and applications that never made the decision are
told there is one to make. That is also why the warning is conditional on the property being unset
rather than on it being `true` — it is aimed at the applications that inherited the behaviour, not
at the ones that chose it.

**★ What is the difference between `OpenEntityManagerInViewFilter` and
`OpenEntityManagerInViewInterceptor`?**
They implement the same pattern at different points in the stack. The filter is a servlet
`Filter` — Spring's own documentation notes it looks the `EntityManagerFactory` up in the root web
application context and supports init-params in `web.xml` — so it wraps everything downstream
including other filters. The interceptor is a Spring MVC web request interceptor, "set up in a
Spring application context and can thus take advantage of bean wiring", so its scope starts later
and it is the one Boot registers. Boot's auto-configuration backs off if either bean is already
present, which is how you take manual control.

**★ If OSIV is on and an endpoint is fast, is there anything to fix?**
Possibly not today, and there are still two things I would want to know. Whether the statement
count grows with the response size, because "fast enough on this data" is a statement about the
current data. And whether the endpoint is doing its data access after the transaction committed,
because that is a consistency property rather than a speed one — a response assembled from reads
at different points in time can be internally inconsistent no matter how quick it was. OSIV's real
cost is not that it makes things slow; it is that it makes both of those questions invisible.

---

← Prev: [14d · Worked: the detail view](14d-the-detail-view.md) · Index: [08 · The N+1 problem](README.md) · Next → [15b · What it costs](15b-what-open-in-view-costs.md)
