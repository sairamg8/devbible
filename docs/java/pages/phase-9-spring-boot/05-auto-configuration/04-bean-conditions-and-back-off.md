---
title: "The back-off contract"
sidebar_label: "4 · The back-off contract"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the `@ConditionalOnMissingBean` API javadoc
> (docs.spring.io/spring-boot/api — the note that the condition matches only
> against bean definitions processed so far, and the instruction to order an
> auto-configuration after one that may create a candidate bean), the Spring
> Boot reference *Creating Your Own Auto-configuration · Condition Annotations*
> (the warning restricting bean conditions to auto-configuration classes) and
> *Using Spring Boot · Auto-configuration* (auto-configuration described as
> non-invasive, with the `DataSource` back-off example). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**"Define your own bean and Boot backs off" is the behaviour that makes the
framework tolerable, and it is not a feature of the framework — it is an
emergent property of two facts stacked on each other. Auto-configuration is
imported *last*, and `@ConditionalOnMissingBean` is evaluated against whatever
has been registered *so far*. Remove either half and the contract collapses,
which is why the javadoc says in as many words that this condition belongs on
auto-configuration classes only. Almost every strange "why did my bean not win"
story is somebody having broken one of the two halves.**

## The contract

The reference calls auto-configuration *non-invasive*, and gives the canonical
example: define your own `DataSource` bean and the default embedded-database
support backs away.

```java
@Bean
@ConditionalOnMissingBean          // "…unless the developer already defined one"
LibXClient libXClient(DataSource dataSource) {
    return new LibXClient(dataSource);
}
```

With no attributes it matches on the **return type** of the annotated method.

The wording matters here, because the mental model most people carry is wrong.
Nothing is *overridden*. No bean is *replaced*. No precedence is registered.
The default is simply **never created**, because at the moment its condition was
evaluated a bean of that type was already in the registry. There is no conflict
to resolve, because the two beans never coexist.

## Why the ordering guarantee is the whole mechanism

The javadoc is unambiguous about the limit:

> *"The condition can only match the bean definitions that have been processed
> by the application context so far and, as such, it is strongly recommended to
> use this condition on auto-configuration classes only."*

Auto-configurations are imported after component scanning and after your own
`@Configuration` classes have contributed their definitions — the guarantee from
[chunk 2](02-what-springbootapplication-triggers.md). That is the *only* reason
"missing" reliably means "the developer did not define one".

Put `@ConditionalOnMissingBean` on a `@Bean` method in your own
`@Configuration` and "missing" degrades to "had not been registered yet at the
arbitrary moment this class happened to be processed". It will work, then stop
working when someone renames a class or moves a package, and the diff will look
entirely unrelated to the bean that disappeared.

### The other half of the warning, which people miss

The javadoc continues:

> *"If a candidate bean may be created by another auto-configuration, make sure
> that the one using this condition runs after."*

So the guarantee orders auto-configuration after **user beans** and says nothing
about the order of two auto-configurations relative to each other. If your
starter should defer to a bean that a *different* auto-configuration might
create, you must say so — and this is precisely what the ordering attributes
from [chunk 2](02-what-springbootapplication-triggers.md) exist for:

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class LibXAutoConfiguration { … }
```

Get this wrong and the bug looks intermittent: your default is created because
the other auto-configuration had not run yet, and whether it had was never
specified anywhere.

## Class-level versus method-level

A condition on the `@Configuration` **class** prevents the entire class from
being registered: none of its beans are contributed and none of its other
conditions are even evaluated. On a single `@Bean` **method**, it prevents just
that bean.

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnMissingBean(LibXClient.class)   // ⚠️ guards ALL FIVE beans below
class LibXConfiguration {
    @Bean LibXClient client() { … }
    @Bean LibXMetrics metrics() { … }         // disappears too
    @Bean LibXHealthIndicator health() { … }  // and this
    // …
}
```

The difference matters whenever a class has several beans and only one should
defer to a user definition. A class-level guard there throws away four beans
nobody was overriding, and the symptom — "I defined one bean and four unrelated
ones vanished" — reads as a framework bug rather than a misplaced annotation.

## The trade-off

The back-off contract means you override defaults by **declaring** rather than
by **configuring**: no registry, no `@Order`, no XML, no `@Override`. The price
is that overriding is invisible at the point it happens.

There is no line anywhere saying "this replaces Boot's default" — only a `@Bean`
method that looks like any other, and a framework default that silently never
appeared. Someone reading a configuration class cannot tell overrides from
additions, and deleting what looks like a redundant bean can silently reactivate
a framework default with different behaviour. The conditions report
([chunk 7](07-the-conditions-report.md)) is the only thing that will say which
is which.

## Gotchas

**Symptom:** `@ConditionalOnMissingBean` in your own `@Configuration` works locally, then stops backing off after an unrelated refactor
**Cause:** bean conditions evaluate against what has been registered *so far*, and outside auto-configuration you do not control that order. The refactor changed configuration-class processing order
**Fix:** do not use bean conditions in application configuration at all. Express the choice with a property condition, or move the defaulting into a real auto-configuration in a starter module where "last" is guaranteed

**Symptom:** your starter's default bean is created even though another auto-configuration also provides one, and which one wins varies between environments
**Cause:** the ordering guarantee only places auto-configuration after *user* beans. Two auto-configurations have no defined order unless one declares it
**Fix:** declare the dependency the javadoc asks for:
```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
public class LibXAutoConfiguration { … }
```

**Symptom:** adding one override to a `@Configuration` class makes four other beans disappear
**Cause:** the bean condition sits on the class rather than on the method, so the whole class stopped being registered along with every bean in it
**Fix:** move the annotation onto the single `@Bean` method it was meant to guard, and reserve the class level for classes that are meaningless in their entirety without the condition

**Symptom:** someone deletes a `@Bean` method that "looked redundant" and behaviour changes in production
**Cause:** it was an override. Removing it let a framework default that had been backing off for years come into existence for the first time
**Fix:** treat every bean whose type Boot also auto-configures as load-bearing, and check the conditions report's negative matches before deleting — the entry naming that type is the proof it was an override

**Symptom:** two beans of the same type both exist, and `@ConditionalOnMissingBean` appears to have done nothing
**Cause:** the user's bean was registered *after* the auto-configuration ran — usually because it comes from another auto-configuration, or from a `BeanFactoryPostProcessor` that registers definitions late
**Fix:** order the auto-configurations explicitly with `@AutoConfiguration(after = …)`; late programmatic registration cannot participate in the contract at all, so a bean registered that way must not rely on it

**Symptom:** a test that defines its own bean sees the auto-configured one instead
**Cause:** the test registers the bean through a mechanism that runs after auto-configuration — a nested `@TestConfiguration` imported late, rather than a configuration class contributed before it
**Fix:** verify the contract directly with `ApplicationContextRunner` and `withUserConfiguration(...)`, shown in [chunk 8](08-excluding-and-writing-your-own.md), rather than inferring it from a full-context test

## Interview questions

**★ Explain the back-off contract. What makes "define your own bean and Boot steps aside" work?**
Two facts in combination. Auto-configuration classes are imported *last*, after
component scanning and after the application's own `@Configuration` classes have
registered their definitions. And the auto-configured beans carry
`@ConditionalOnMissingBean`, which is evaluated against the definitions
registered so far. So by the time the condition runs, your bean is already in
the registry, the condition is false, and the default is never created. Nothing
is overridden or replaced — the two beans never coexist, because the default
never comes into existence at all.

**★ Why does the javadoc restrict `@ConditionalOnMissingBean` to auto-configuration classes?**
Because it can only match bean definitions processed so far, and outside
auto-configuration nothing guarantees the processing order. In an
auto-configuration class the order *is* guaranteed — they load after all
user-defined bean definitions — so "missing" reliably means "the developer did
not define one". In your own `@Configuration` it degrades to "had not been
defined yet at whatever arbitrary moment this class was processed", which can
flip on a rename or a package move with nothing in the diff to connect the two.

**★ The ordering guarantee covers user beans. What does it *not* cover, and what do you do about it?**
It says nothing about the order of two auto-configurations relative to each
other. The javadoc spells out the consequence: if a candidate bean may be
created by another auto-configuration, the one using the condition must be made
to run after it. You declare that with `@AutoConfiguration(after = Other.class)`,
or `afterName` when the class may be absent. Skipping it produces a bug that
looks intermittent — your default is created because the other auto-configuration
had not run yet, and whether it had was never specified.

**★ Class-level or method-level bean conditions — what is the difference?**
A condition on the `@Configuration` class prevents the whole class from being
registered, so none of its beans are contributed and none of its other
conditions are even evaluated. A condition on an individual `@Bean` method
prevents just that bean. Use the class level when the entire block is
meaningless without the guard, and the method level when one bean among several
should defer — putting it on the class instead is how defining one override
makes four unrelated beans disappear, which reads as a framework bug.

**★ What is the cost of the back-off contract, as a design choice?**
That overriding becomes invisible at the point it happens. You override a
default by declaring a bean, so there is no line anywhere announcing "this
replaces Boot's default" — just a `@Bean` method indistinguishable from any
other, and a framework default that silently never appeared. Someone reading the
configuration class cannot tell overrides from additions, which is how a
"redundant-looking" bean gets deleted and a long-dormant framework default
springs into existence in production.

**★ A colleague says `@ConditionalOnMissingBean` "overrides" the Boot bean. Correct them.**
Nothing is overridden. Overriding implies two definitions exist and one wins,
which would need a precedence rule and a conflict to resolve. What actually
happens is that the condition is evaluated while the registry already contains
the user's definition, returns false, and the auto-configured bean is never
registered at all. That distinction is not pedantry: it explains why there is no
ordering knob to reach for when it goes wrong, and why the fix is always about
*when* definitions are processed rather than about precedence.

**★ How would you prove to yourself that a bean in your codebase is an override rather than an addition?**
Look for it in the conditions report's negative matches. An auto-configured bean
that backed off appears there with the condition that vetoed it — a
`OnBeanCondition` entry naming the type — which is direct evidence that
something in your configuration pre-empted a framework default. Absence from
that section means Boot never had an opinion about the type and your bean is a
straightforward addition. Reading the configuration class alone cannot tell you,
because both cases look identical in source.

---

← Prev: [Class conditions](03-class-conditions.md) · Index: [Boot auto-configuration](README.md) · Next → [The bean-condition attributes](05-bean-condition-attributes.md)
