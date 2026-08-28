---
title: "Every slice failure arrives as the same sentence — no qualifying bean of type X — and the useful skill is not memorising which slice includes what, but reading that sentence well enough to know whether the missing thing is infrastructure Boot did not configure or a class of yours that was never scanned"
sidebar_label: "03b · What a slice excludes"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Boot 4.1.0 reference *Testing → Auto-configured Tests*
> and *Features → Developing Auto-configuration → Condition Evaluation Report*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> the Boot 4.1.0 javadoc for `TypeExcludeFilters`, `OverrideAutoConfiguration`,
> `ImportAutoConfiguration` and `WebMvcTypeExcludeFilter`, and the Spring Framework 7.0.x
> reference *Core → `@Import`*.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> **No sandbox** — exception text below is the standard `NoSuchBeanDefinitionException` shape as
> documented, not captured from a run.

**[03](03-the-slices.md) showed that a slice restricts two independent things: what Boot
auto-configures, and what of yours gets component-scanned. Both failures surface as a context
that will not start, with a message about a bean that is not there. This chunk is the diagnostic
half — how to tell the two apart from the message alone, what each fix is, and which of the
"fixes" people reach for actually dismantles the slice.**

## The message, and the fork in the road

A slice test that will not start almost always fails at context refresh with:

```text
No qualifying bean of type 'com.example.orders.OrderService' available
```

The whole diagnosis is in the package name.

- **It names one of your own packages** → this is a **component-scan** exclusion. Your class is
  annotated, it is on the classpath, and the slice's `@TypeExcludeFilters` chose not to make it a
  bean.
- **It names a Spring, Boot, Jackson, Hibernate or driver package** — `javax.sql.DataSource`,
  `ObjectMapper`, `RestClient.Builder`, `EntityManagerFactory` → this is an
  **auto-configuration** exclusion. Boot was told to configure nothing and this was not on the
  short list that came back on.

They are fixed differently, and applying the wrong fix is how a slice quietly becomes a slow
integration test.

## Fixing a component-scan exclusion

The slice deliberately left your collaborator out, because testing it is not this test's job.
There are three honest replies, in the order you should want them:

**1 · Supply it as a mock.** This is the intended answer and the one the `@WebMvcTest` javadoc
names:

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvcTester mvc;

    @MockitoBean OrderService orderService;   // the bean the slice did not scan
}
```

[06 · Bean overriding](06-bean-overriding.md) owns `@MockitoBean` in full, including the fact
that it is a **Spring Framework** annotation now and that `@MockBean` no longer exists.

**2 · Import the one real class you need.**

```java
@WebMvcTest(OrderController.class)
@Import(PriceFormatter.class)          // a pure, dependency-free collaborator
class OrderControllerTest { }
```

Reasonable when the collaborator is a small pure function whose real behaviour is part of what
you are asserting, and it drags nothing else in. Unreasonable the moment the imported class has
its own dependencies — you will import those too, then theirs, and you have rebuilt the
application context one `@Import` at a time.

**3 · Bring back a properties bean explicitly.**

```java
@WebMvcTest(OrderController.class)
@EnableConfigurationProperties(PricingProperties.class)
class OrderControllerTest { }
```

`@ConfigurationProperties` beans are in the excluded set, and this is the narrow way back.

🔴 **What is not on this list: `@ComponentScan`.** Adding it re-enables exactly the scanning the
type-exclude filter existed to prevent, so you get the full startup cost of scanning your
application *without* the auto-configuration that would make those beans work. The failures move
from "bean missing" to "bean present but its `DataSource` is not", which is a strictly worse
place to be.

## Fixing an auto-configuration exclusion

Here the missing thing is infrastructure. Three routes, narrowest first:

**1 · The matching `@AutoConfigure…` annotation.** Boot ships one per concern —
`@AutoConfigureJson`, `@AutoConfigureWebClient`, `@AutoConfigureCache`, `@AutoConfigureMockMvc`
and so on. Each resolves to a named set of auto-configuration classes. This is the mechanism the
slices themselves use, so it composes cleanly.

**2 · `@ImportAutoConfiguration(SomethingAutoConfiguration.class)`** — name the exact
auto-configuration class you want. More precise, and more brittle, since you are now naming an
internal class by its fully-qualified name.

**3 · `@OverrideAutoConfiguration(enabled = true)`** — the escape hatch. It cancels the slice's
central instruction and turns everything back on. The context is now essentially
`@SpringBootTest`'s, minus the component scanning, which is a strange middle ground. If you find
yourself writing this, the honest move is usually `@SpringBootTest`.

## Seeing what a slice actually configured, without guessing

You do not have to reason about it. Boot's condition evaluation report explains every
auto-configuration decision — what matched, what did not, and *why* — and it is available in a
test:

```java
@WebMvcTest(OrderController.class)
@TestPropertySource(properties = "debug=true")
class OrderControllerTest { }
```

The report groups classes into positive matches, negative matches with the failing condition
named, and exclusions. **The negative-match section is the answer to "why is this bean not
here"** and it is far faster than reading javadoc for the annotation stack.

The same information is available programmatically by injecting the
`ConditionEvaluationReport` from the context, which is worth knowing when you want to assert on
it rather than read it.

To see the *component-scan* side instead, inject the `ApplicationContext` and ask:

```java
@Autowired ApplicationContext ctx;

@Test
void whatIsInHere() {
    assertThat(ctx.getBeanDefinitionNames()).contains("orderController");
}
```

Written as a throwaway, this settles arguments in seconds. It is a diagnostic, not a test to
commit — a test asserting on bean names asserts on Spring's naming, not on your behaviour
([02b · Assertions that assert nothing](../02-assertj/02b-assertions-that-assert-nothing.md) is
the general form of that mistake).

## The pattern behind all of it

A slice is a claim: *"this test is about the web layer, so nothing below it should be able to
break it."* Every widening you apply weakens that claim. The value of a slice is not the
milliseconds — it is that when the test goes red, the set of things that could have caused it is
small. A `@WebMvcTest` with four `@Import`s and a `@ComponentScan` has given that up while still
paying for the ceremony.

So the review question for a slice test is not "does it start?" but **"if this fails, how many
places do I have to look?"**

## Gotchas and pitfalls

**★ Diagnosing a missing-bean failure by adding annotations until it starts.**
It always terminates — `@SpringBootTest` starts everything — and it always ends with a test whose
level nobody chose. Read the package in the message first; it tells you which of the two
mechanisms excluded the bean, and there is exactly one right fix per mechanism.

**★ `@Import`ing a `@Configuration` class "just for one bean".**
You get every bean that class declares, plus everything they require. The one-bean version is
`@Import(TheBean.class)` — importing the component itself, not its configuration.

**★ Expecting `@ComponentScan`-excluded beans to be reported at startup.**
They are not. A class that was never scanned produces no message of its own; you only hear about
it indirectly, when something that needs it cannot be satisfied. Silence about your `@Service` is
normal, not a symptom.

**★ Believing the slice excluded something when the condition did.**
Auto-configuration classes carry `@ConditionalOn…` guards. A `DataSource` can be absent because
the slice excluded its auto-configuration *or* because no driver is on the test classpath. The
condition evaluation report distinguishes them; the exception does not.

**★ Adding `@EnableConfigurationProperties` and still getting nothing bound.**
The annotation registers the properties bean; it does not supply values. The values come from
the environment, so a slice with no property source binds defaults. `@TestPropertySource` or the
`properties` attribute is the other half — see
[07 · Test properties and profiles](07-test-properties-and-profiles.md).

**★ Assuming `@WebMvcTest(OrderController.class)` restricts scanning to that controller only.**
The argument narrows which controllers are registered; it does not change the type-exclude filter
or the auto-configuration set. `@ControllerAdvice` classes, converters and filters are still
picked up — which is usually what you want, and occasionally the reason a test fails for a
reason that has nothing to do with the controller you named.

**★ Using `@OverrideAutoConfiguration(enabled = true)` as a quick fix.**
It cancels the defining instruction of the slice. The resulting context is neither a slice nor a
`@SpringBootTest`, it is a third thing nobody reviews, and it will be cached separately from
both — see [05 · The context cache](05-the-context-cache.md).

## Interview questions

**★ A `@WebMvcTest` fails with "no qualifying bean of type OrderService". What went wrong?**
Nothing went wrong — the slice worked. `@WebMvcTest` restricts component scanning to controllers,
advices and web infrastructure, so `OrderService` was never made a bean. The intended fix is
`@MockitoBean OrderService orderService`, which supplies it as a mock and keeps the test at the
web layer.

**★ The same test fails on `javax.sql.DataSource` instead. Same fix?**
No. That is an auto-configuration exclusion, not a scanning one — `@WebMvcTest` does not
auto-configure a `DataSource` because a web-layer test should not have one. If the failure is
real, something in your web layer is reaching into persistence, and the design question is more
interesting than the test question. If you genuinely need it, the narrow fix is the matching
`@AutoConfigure…` annotation, not `@SpringBootTest`.

**★ How do you find out what a slice actually auto-configured?**
Turn on the condition evaluation report with `debug=true` as a test property, or inject the
`ConditionEvaluationReport` bean. It lists positive matches, negative matches *with the failing
condition*, and exclusions. That is faster and more reliable than reading the annotation stack.

**★ Why is `@ComponentScan` on a slice test a bad idea?**
It re-enables the scanning that the slice's `@TypeExcludeFilters` exists to prevent, so you pay
the full scan cost while keeping the reduced auto-configuration. The beans come back, but the
infrastructure they need does not, so failures shift from "missing bean" to "misconfigured bean".
It also produces a context configuration nothing else in the suite shares, so it is cached on its
own.

**★ What is the difference between `@Import(MyService.class)` and
`@Import(MyConfig.class)`?**
The first registers exactly one bean definition — the component itself. The second processes a
configuration class and registers every `@Bean` method on it, plus anything it imports in turn.
In a slice test the first is a scalpel and the second is usually how a slice test grows into an
integration test without anyone deciding to.

**★ When is widening a slice the right answer?**
When the thing you are asserting genuinely spans the layers — a transaction boundary, a real SQL
statement, an end-to-end serialisation round trip. Then stop widening and choose
`@SpringBootTest` deliberately, because a fully widened slice costs the same and hides the
decision. [10 · Choosing a level](10-choosing-a-level.md) is the decision procedure.

{/* FOOTER */}
