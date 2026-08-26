---
title: "Expressions over the arguments buy you escaping, an extension-supplied value and a configuration property — each is evaluated on every execution, and the reference is explicit that an expression from an untrusted source is a vulnerability, not a bug"
sidebar_label: "03e2 · Expressions, escaping and their cost"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Templated Queries and Expressions"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html))
> and "Value Expressions Fundamentals"
> ([value-expressions.html](https://docs.spring.io/spring-data/jpa/reference/jpa/value-expressions.html));
> `SecurityEvaluationContextExtension` read from the Spring Security source
> ([spring-security-data](https://github.com/spring-projects/spring-security/blob/main/data/src/main/java/org/springframework/security/data/repository/query/SecurityEvaluationContextExtension.java));
> Jakarta Persistence 3.2 §4.6.9 (`like … escape`).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**Past the entity name, every expression in a query is doing something to a
value: reading an argument by index, pulling a root object an extension
contributed, escaping a `like` pattern, or pasting in a configuration property.
Exactly one of those — escaping — has no alternative spelling. The rest have a
plainer one, and the plainer one is cheaper: an expression is parsed and
evaluated on every execution, and it is evaluated in a context powerful enough
that the reference calls untrusted input into it a security vulnerability rather
than a defect.**

## Expressions over the arguments

Inside a query method the arguments are available to SpEL by index, and named
properties contributed by extensions are available too. The reference's example
uses both at once:

```java
@Query("""
        select u from User u
        where u.firstname = ?1
          and u.firstname = ?#{[0]}
          and u.emailAddress = ?#{principal.emailAddress}
        """)
List<User> findByFirstnameAndCurrentUser(String firstname);
```

🔴 **`principal` is not built in.** SpEL evaluation happens in a context that
extensions can hydrate *"with: a root object, named properties, and functions"*,
and the `principal` root object comes from
`SecurityEvaluationContextExtension` in `spring-security-data`, which has to be
on the classpath and registered as a bean. A query copied from a blog that uses
`principal` fails with an expression-evaluation error until that extension is
present — and the failure is at execution, not at startup.

For `like` conditions the wildcard can go outside the expression:

```java
@Query("select u from User u where u.lastname like %:#{[0]}% and u.lastname like %:lastname%")
List<User> findByLastnameWithSpelExpression(@Param("lastname") String lastname);
```

## Escaping, which is the security half

The evaluation context exposes an `escape(String)` function, and it is the
documented way to make a user-supplied `like` term safe:

> "It prefixes all instances of `_` and `%` in the first argument with the single
> character from the second argument."

```java
@Query("select u from User u where u.firstname like %?#{escape([0])}% escape ?#{escapeCharacter()}")
List<User> findContainingEscaped(String namePart);
```

Given that declaration, `findContainingEscaped("Peter_")` finds `Peter_Parker`
and **not** `Peter Parker` — the underscore has stopped being a single-character
wildcard and become a literal. The escape character itself is configurable with
`escapeCharacter` on `@EnableJpaRepositories`, and `escapeCharacter()` in the
expression emits whatever you configured, so the two never drift apart.

⚠️ **The escaping is not total, and the reference says so:** *"the method
`escape(String)` available in the SpEL context will only escape the SQL and JPQL
standard wildcards `_` and `%`. If the underlying database or the JPA
implementation supports additional wildcards these will not get escaped."*

## Property placeholders, and when the value is read

```java
@Query("select u from User u where u.applicationName = ?${spring.application.name:unknown}")
List<User> forThisApplication();
```

The `:unknown` after the colon is the fallback when the property is not set.
Two facts about it that matter more than the syntax:

- **It is resolved from the `Environment` at execution time** — *"The property is
  being evaluated upon query execution"* — not baked in at startup. A property
  source that changes at runtime changes the query.
- **It is a String-ish substitution.** *"Typically, property placeholders resolve
  to String-like values."* This is a value being pasted into the query text, not a
  bound parameter, which is exactly why it must come from configuration and never
  from a request.

## The two costs

**Every execution pays.** *"Doing so requires evaluation of the expression on each
usage and, therefore, value expression evaluation has an impact on the
performance profile."* A query method that would otherwise be a cached, prepared
statement now runs a parser-and-evaluate step first. For `#{#entityName}` that is
nothing; for an expression calling a bean method on a hot path it is not nothing.

**Every expression is a small program.** The context is *"a powerful
`StandardEvaluationContext` allowing a wide range of operations, access to static
types and context extensions"*, and the reference's warning is unambiguous:

> "Make sure to parse and evaluate only expressions from trusted sources such as
> annotations. Accepting user-provided expressions can create an entry path to
> exploit the application context and your system resulting in a potential
> security vulnerability."

An annotation is a trusted source because it is source code. A string assembled
from a request is not, and there is no sanitiser for it.

## Gotchas

**⚠️ Reaching for SpEL where a parameter would do.**
`?#{[0]}` is the same value as `?1`, evaluated more expensively and read by fewer
people. The expression forms exist for the things binding cannot do — an
extension-supplied value, an escaped pattern, a configuration property — and for
nothing else.

**⚠️ Using `principal` without the Spring Security extension.**
The root object is contributed by `SecurityEvaluationContextExtension`; without
`spring-security-data` on the classpath and the bean registered, the expression
cannot resolve. It fails on the first call of that method, not at startup, so a
rarely-used query can carry the fault for weeks.

**⚠️ Putting the current user into the query with an expression at all.**
It reads neatly and it hides an authorisation decision inside a string. A
parameter passed by the service makes the same query testable and puts the
security rule where a reviewer will see it.

**⚠️ Writing `escape([0])` and forgetting the `escape` clause.**
The function prefixes the wildcards; the JPQL `escape ?#{escapeCharacter()}`
clause is what tells the database that the prefix character means "literal". With
one and not the other, the escape character becomes a searched-for character and
the query silently returns nothing.

**⚠️ Hard-coding the escape character in the query.**
Write the character as a literal in the `escape` clause and it drifts the moment
somebody sets `escapeCharacter` on `@EnableJpaRepositories`. `escapeCharacter()`
exists precisely so the two cannot disagree.

**⚠️ Believing `escape(…)` sanitises everything.**
It handles `_` and `%` only. A provider or database with additional pattern
characters escapes none of them, and the reference says so explicitly. Escaping
is about pattern widening, never about injection — the value was always bound.

**⚠️ Escaping the value and then wrapping it in more wildcards at the call site.**
The `%…%` in the query is already outside the escaped expression. Adding
wildcards to the argument as well escapes *those* too, so the search becomes a
literal match on a string containing percent signs.

**⚠️ Treating a property placeholder as a bound parameter.**
`?${…}` pastes a configuration value into the query text. It is safe because
configuration is trusted; it stops being safe the instant somebody makes that
property settable from outside, and it is invisible in the parameter list.

**⚠️ Expecting the placeholder to be fixed at startup.**
It is evaluated on each execution, so a refreshable property source changes the
query underneath a running application. That is occasionally the point and
usually a surprise, especially when the property is missing and the default
quietly takes over.

**⚠️ Using a placeholder without a default.**
`?${tenant.discriminator}` with no `:fallback` fails at execution when the
property is absent, in an environment you did not test. A default is cheap and it
turns a runtime failure into a value you can assert on.

**⚠️ Putting an expensive call inside an expression on a hot query.**
`#{someService.currentThing()}` runs on every invocation of the query method, in
front of the database round-trip. The reference names the cost in general terms;
the specific cost is whatever that bean does, multiplied by your query rate.

**⚠️ Building any part of an expression from request data.**
There is no escaping function for this and no safe subset. The evaluation context
reaches beans and static types, so a user-controlled expression is code execution
rather than a bad query.

## Interview questions

**★ How do you make a user-supplied `like` term safe?**
Use the `escape(…)` function in the expression together with JPQL's `escape`
clause and `escapeCharacter()`, so that `%` and `_` in the value become literals.
Both halves are required — the function alone escapes nothing as far as the
database is concerned.

**★ Does that make the search fully safe?**
Safe from pattern widening for the two standard wildcards, yes. The reference is
explicit that only `_` and `%` are escaped, so a database or provider with extra
pattern characters is not covered. Injection was never the risk here; the value
is still a bound parameter.

**★ What is `escapeCharacter()` and why not just write the character?**
It emits whatever `escapeCharacter` is configured to on `@EnableJpaRepositories`,
so the query and the configuration cannot drift apart. Writing the character as a
literal creates two places that must agree and no mechanism to make them.

**★ Where does `principal` in the reference's example come from?**
Not from Spring Data. SpEL evaluation contexts can be extended with a root
object, properties and functions, and Spring Security's
`SecurityEvaluationContextExtension` — in `spring-security-data` — contributes
the security root object. Without it the expression fails when the method is
called.

**★ Would you use that in production?**
Rarely. It hides an authorisation input inside an unchecked string, it fails at
execution rather than at startup, and it makes the method impossible to test
without a security context. Passing the current user as a parameter from the
service is the same query with the decision visible.

**★ What does an expression cost?**
An evaluation on every execution — the reference calls this out as an impact on
the performance profile. Negligible for a constant like the entity name; real for
an expression that calls a bean method on a query invoked thousands of times a
minute, because it runs before the round-trip rather than during it.

**★ Why is "only trust annotations" such a strong warning?**
Because the evaluation context is a `StandardEvaluationContext` with access to
static types and beans. An expression is code, not a value, so an expression
built from user input is remote code execution rather than a query defect. There
is no escaping function that makes that safe.

**★ When is a property placeholder in a query the right tool?**
When the value is genuinely deployment configuration — a tenant discriminator, an
application name, a schema-level constant — and it must not be a method
parameter. Anything that varies per request is a parameter, and anything that
varies per user is an argument the service should pass explicitly.

**★ When is the placeholder read?**
On each execution, from the `Environment` — not once at startup. That is what
makes a refreshable property source able to change the query, and it is why a
missing property without a default fails at call time in whichever environment
lacks it.

**★ You inherited a repository whose queries are full of `#{…}`. What do you look
for first?**
Whether each expression is doing something binding cannot: an
extension-provided value, escaping, configuration. Every expression that is just
`?#{[0]}` for an argument can become `?1` or a named parameter, which removes an
evaluation per call and a line of unreadable string per query.

**★ Is there anything in this mechanism you would ban outright?**
Two things: an expression whose input is not source code or configuration, and an
expression that emits query *structure* rather than a value. The first is a
vulnerability by the reference's own wording; the second is string-built SQL that
happens to be spelled in SpEL.

{/* FOOTER */}
