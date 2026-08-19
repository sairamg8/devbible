---
title: "The bean-condition attributes"
sidebar_label: "5 · The bean-condition attributes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the `@ConditionalOnMissingBean` API javadoc
> (docs.spring.io/spring-boot/api — the `value`, `type`, `name`, `annotation`,
> `ignored`, `ignoredType`, `parameterizedContainer` and `search` attributes,
> the quoted `parameterizedContainer` example and the `SearchStrategy` default
> of `ALL`) and the Spring Boot reference *Creating Your Own Auto-configuration ·
> Condition Annotations* (`@ConditionalOnBean`, `@ConditionalOnMissingBean`,
> `@ConditionalOnSingleCandidate`). Spring Boot 4.1.0, Spring Framework 7.0.x,
> JDK 25.

**`@ConditionalOnMissingBean` with no attributes answers one question — "is
there already a bean of my return type?" — and that question is wrong more often
than starter authors expect. It cannot see a bean wrapped in a generic
container, it cannot be told to ignore a bean the same auto-configuration
registered a moment ago, and it silently consults parent contexts you may not
have known existed. Each of those has a dedicated attribute, and each attribute
exists because somebody's back-off silently failed to back off.**

## The attributes

| Attribute | What it does |
|---|---|
| `value` | Bean **types** to check for. When omitted, the method's return type is used |
| `type` | The same, as `String` class names — for types that may be absent from the classpath |
| `name` | Bean **names** to check for |
| `annotation` | Match beans decorated with a given annotation |
| `ignored` | Bean types to **exclude** from the search |
| `ignoredType` | The same, as `String` class names |
| `parameterizedContainer` | Also detect the type when it sits inside a generic container |
| `search` | Whether parent contexts in a hierarchy are considered. Default `ALL` |

The explicit forms:

```java
@Bean
@ConditionalOnMissingBean(name = "libXClient")            // by bean NAME, not type
LibXClient defaultLibXClient() { … }

@Bean
@ConditionalOnMissingBean(annotation = EnableLibX.class)  // by annotation
LibXClient annotationGuardedClient() { … }

@Bean
@ConditionalOnMissingBean(type = "com.acme.libx.LibXClient")  // type may be absent
Object stringNamedCheck() { … }
```

`name` is worth calling out because it changes the question entirely. Matching
by **type** asks "does any bean of this shape exist"; matching by **name** asks
"is this specific bean id taken". They diverge the moment an application has two
beans of one type, and choosing by name when you meant type produces a default
that appears alongside a bean that was clearly meant to replace it.

## `parameterizedContainer` — the generics blind spot

A plain type check does not look inside a generic parameter. Beans are often
registered wrapped — a registration object, a holder, a provider — and to the
condition those are simply a different type.

The javadoc's own example states the fix:

> *"Additional classes that may contain the specified bean types within their
> generic parameters. For example, an annotation declaring `value=Name.class`
> and `parameterizedContainer=NameRegistration.class` would detect both `Name`
> and `NameRegistration<Name>`."*

```java
@Bean
@ConditionalOnMissingBean(value = Name.class,
                          parameterizedContainer = NameRegistration.class)
Name defaultName() { … }     // backs off for a Name OR a NameRegistration<Name>
```

Without it, a user who registered `NameRegistration<Name>` gets your default as
well as their registration, and the two compete for the same role — a back-off
that silently failed. This is the attribute most starter authors have never
heard of, and the bug it prevents is reported as "the library ignores my
configuration".

## `search` and context hierarchies

`search` takes a `SearchStrategy` and controls whether the condition consults
**parent contexts**, defaulting to `ALL`.

Most applications have one context and never notice. It matters in the place
Boot routinely builds a hierarchy: Actuator's management context can be a child
of the application context. A condition searching `ALL` sees beans defined in
the parent; one restricted to the current context does not — so the same
annotation can reach different conclusions depending on which context it is
evaluated in.

This is also why the conditions report carries a `parentId` field
([chunk 7](07-the-conditions-report.md)): without it you cannot tell which
context's evaluation you are reading, and two contexts legitimately disagree.

## `ignored` and `ignoredType`

These remove specific types from the search. The case they exist for is narrow
and real: an auto-configuration that registers a placeholder or fallback bean
earlier in its own execution, and then wants to ask "did the *user* define one",
not "did anything define one".

```java
@Bean
@ConditionalOnMissingBean(ignored = PlaceholderClient.class)
LibXClient libXClient() { … }
```

Without the exclusion, the auto-configuration backs off against its own earlier
contribution and neither useful bean is created — a self-inflicted deadlock that
is genuinely hard to read in the conditions report, because the vetoing bean
looks like a legitimate user definition.

## The positive form: `@ConditionalOnBean`

`@ConditionalOnBean` creates something only if a bean is **already** there. It
shares the attribute set and carries exactly the same ordering caveat, for
exactly the same reason — it can only see what has been processed so far.

The typical use is a secondary feature that only makes sense alongside a
primary one:

```java
@Bean
@ConditionalOnBean(DataSource.class)
LibXAuditWriter auditWriter(DataSource dataSource) { … }
```

⚠️ It is more fragile than `@ConditionalOnMissingBean`, because it depends on
something existing *by the time it is evaluated* rather than on something not
existing. A bean that appears later satisfies the intent but not the condition.

## `@ConditionalOnSingleCandidate`

This is the one that surprises people. It matches when there is **exactly one**
bean of the type, *or* several with one marked `@Primary`:

```java
@Bean
@ConditionalOnSingleCandidate(DataSource.class)
LibXClient libXClient(DataSource dataSource) { … }
```

An application with three `DataSource` beans and no primary has not said which
to use, so matching would mean guessing. The condition declines instead — and
the symptom is your bean quietly not existing in an application where the
required type is obviously, abundantly present.

It is the correct condition whenever an auto-configuration needs to **consume**
a bean rather than merely detect one.

## The trade-off

Each attribute makes the condition more precise and the starter harder to reason
about. A `@ConditionalOnMissingBean` with four attributes encodes assumptions
about how consumers will register their beans — wrapped or not, named or typed,
in this context or a parent — and every assumption is one more way a consumer
can surprise you. The discipline that actually works is to keep the plain form
wherever it suffices and add an attribute only in response to a concrete case
you can write a test for, using the runner from
[chunk 8](08-excluding-and-writing-your-own.md).

## Gotchas

**Symptom:** a user registers `NameRegistration<Name>` and still gets your default `Name` bean, so two beans compete
**Cause:** a plain type check does not look inside generic container types — to the condition, `NameRegistration<Name>` is an unrelated type
**Fix:** tell the condition about the container:
```java
@ConditionalOnMissingBean(value = Name.class, parameterizedContainer = NameRegistration.class)
```

**Symptom:** an auto-configuration backs off against a bean it registered itself moments earlier, and neither useful bean exists
**Cause:** the search sees every definition processed so far, including the placeholder this same auto-configuration contributed
**Fix:** exclude it explicitly:
```java
@ConditionalOnMissingBean(ignored = PlaceholderClient.class)
```

**Symptom:** an auto-configured bean is missing in an application that clearly has the required type
**Cause:** the condition is `@ConditionalOnSingleCandidate` and the application has several beans of that type with none marked `@Primary`, so it declined rather than guess
**Fix:** designate the intended one, which is exactly what the condition looks for:
```java
@Bean @Primary DataSource appDataSource() { … }
@Bean DataSource reportingDataSource() { … }
```

**Symptom:** `@ConditionalOnMissingBean(name = "…")` fails to back off against a user bean of the right type
**Cause:** matching by name asks whether that bean *id* is taken, not whether the type exists. The user named theirs something else
**Fix:** match by type unless the bean id is genuinely the contract:
```java
@ConditionalOnMissingBean(LibXClient.class)
```

**Symptom:** a condition behaves differently for Actuator's endpoints than for the application's beans
**Cause:** the management context can be a child of the application context, and `search` defaults to `ALL`, so parent beans are visible from the child but not the reverse
**Fix:** be explicit about the intended scope when a bean is meant to be per-context, and check `parentId` in the conditions report to confirm which evaluation you are reading

**Symptom:** `@ConditionalOnBean` on an auto-configuration bean is unreliable — it works in one application and not another
**Cause:** it requires the other bean to exist *at evaluation time*, and nothing guarantees a bean contributed by a different auto-configuration has been processed yet
**Fix:** declare the ordering as well as the condition; the condition alone states a wish, not a constraint:
```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
```

**Symptom:** `@ConditionalOnMissingBean(type = "…")` never backs off, in any application
**Cause:** the string class name is misspelled or stale after a package rename, so no bean of that "type" is ever found. Nothing validates the string
**Fix:** use the class literal via `value` wherever the type is on the classpath, and reserve `type` for genuinely optional types — the same trade as `@ConditionalOnMissingClass` in [chunk 3](03-class-conditions.md)

## Interview questions

**★ What is `parameterizedContainer` for?**
For beans registered inside a generic container type, which a plain type check
cannot see through. The javadoc's example declares `value=Name.class` with
`parameterizedContainer=NameRegistration.class`, which makes the condition
detect both a `Name` bean and a `NameRegistration<Name>` bean. Without it, a
user who registered the wrapped form gets your default *as well as* their own
registration, and the two compete for the same role — reported by the user as
"the library ignores my configuration" rather than as a back-off failure.

**★ What is `@ConditionalOnSingleCandidate` for, and how is it different from `@ConditionalOnBean`?**
`@ConditionalOnBean` matches when at least one bean of the type is present.
`@ConditionalOnSingleCandidate` matches only when there is exactly one — or when
there are several and one is marked `@Primary`. The distinction exists because
an auto-configuration that needs to *consume* a bean has to pick one, and an
application with three `DataSource` beans and no primary has not told it which.
Matching there would mean guessing, so the condition declines, and the symptom
is a missing bean in an application that obviously has the type in abundance.

**★ What does the `search` attribute control, and when would you ever need it?**
Whether the condition considers parent contexts in a context hierarchy; it
defaults to `ALL`. It matters in the one place Boot routinely builds a
hierarchy — Actuator's management context, which can be a child of the
application context. A condition searching `ALL` sees beans defined in the
parent; one restricted to the current context does not, so the same annotation
reaches different conclusions in the two. It is also why the conditions report
carries a `parentId`: without it you cannot tell whose evaluation you are
reading.

**★ When would you match by `name` rather than by type, and what goes wrong if you get it backwards?**
Match by name only when the bean *id* is genuinely part of the contract — a
starter that documents "define a bean called `libXTaskExecutor` to supply your
own". Everywhere else, match by type, because that is the question you actually
mean: does a bean of this shape already exist. Getting it backwards produces a
default that appears alongside a user bean that was plainly intended to replace
it, because the user named theirs something reasonable and the condition was
looking for a specific string.

**★ Why do `ignored` and `ignoredType` exist?**
Because a bean condition sees *every* definition processed so far, including
ones the same auto-configuration registered a moment earlier. An
auto-configuration that contributes a placeholder or fallback and then asks "did
the user define one" will otherwise back off against its own contribution, and
neither useful bean is created. `ignored` removes specific types from the
search so the question narrows to "did somebody *else* define one". The bug it
prevents is unusually hard to read in the conditions report, because the vetoing
bean looks like a legitimate user definition.

**★ Why is `@ConditionalOnBean` more fragile than `@ConditionalOnMissingBean`?**
Because it depends on something *existing* at evaluation time rather than on
something not existing. Absence is stable — if a user was going to define the
bean, their definition is already registered by the time auto-configuration
runs. Presence is not: a bean contributed by another auto-configuration may not
have been processed yet, so the condition can be false even though the bean will
exist moments later. Using it safely means declaring the ordering with
`@AutoConfiguration(after = …)` as well, since the condition alone states a wish
rather than a constraint.

**★ How should a starter author decide how many attributes to use?**
Start with the plain form and add an attribute only in response to a concrete
case, ideally one you have reproduced in an `ApplicationContextRunner` test.
Every attribute encodes an assumption about how consumers register their beans —
wrapped or bare, named or typed, in this context or a parent — and each
assumption is another way a consumer can surprise you. A condition with four
attributes is precise about a situation somebody once hit and opaque about every
other, which is a worse position than a simple condition with a documented
limitation.

---

← Prev: [The back-off contract](04-bean-conditions-and-back-off.md) · Index: [Boot auto-configuration](README.md) · Next → [Property and environment conditions](06-property-and-environment-conditions.md)
