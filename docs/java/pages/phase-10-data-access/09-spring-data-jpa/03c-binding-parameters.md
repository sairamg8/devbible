---
title: "Positional binding numbers the bindable method parameters and nothing else, named binding decouples the argument order from the query, and since version 4 the names come from the compiler rather than from @Param"
sidebar_label: "03c · Binding parameters"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", sections "Using Named Parameters" and "Using Advanced LIKE
> Expressions"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)).
> Binding mechanics read from the Spring Data source:
> [`Parameter`](https://github.com/spring-projects/spring-data-commons/blob/main/src/main/java/org/springframework/data/repository/query/Parameter.java)
> and
> [`QueryParameterSetterFactory`](https://github.com/spring-projects/spring-data-jpa/blob/main/spring-data-jpa/src/main/java/org/springframework/data/jpa/repository/query/QueryParameterSetterFactory.java);
> the `-parameters` default read from
> [`spring-boot-starter-parent`](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-parent/)
> and the Boot Gradle plugin's `JavaPluginAction`. JDK 25, Spring Boot 4.1.0,
> Spring Data JPA 4.1.0, Hibernate ORM 7.4.1.

**A `@Query` string is not compiled against your method signature, so the link
between the two is made by a binding convention — and there are two of them.
Positional binding (`?1`) is the default and is the one that breaks silently when
somebody edits the parameter list. Named binding (`:name`) makes the query
independent of argument order, and since Spring Data 4 the names come from the
`-parameters` compiler flag, which every Spring Boot build turns on for you. In a
Boot application there is no longer a cost to naming your parameters, which
removes the last reason anyone used positional binding.**

## Positional binding, and what the number actually counts

> "By default, Spring Data JPA uses position-based parameter binding, as
> described in all the preceding examples."

```java
@Query("select u from User u where u.lastname = ?1 and u.firstname = ?2")
List<User> byName(String lastname, String firstname);
```

🔴 **`?1` is the first *bindable* method parameter, not the first token in the
query and not the first parameter of the method.** Two consequences, both worth
knowing precisely:

- **The same number can appear several times.** `where u.firstname = ?1 or
  u.lastname = ?1` binds one argument to both places. Positions index arguments,
  not occurrences.
- **Special parameters are not counted.** `Pageable`, `Sort`, `Limit`,
  `ScrollPosition` and the dynamic-projection `Class<T>` argument are excluded
  from the numbering — Spring Data resolves a position against
  `parameters.getBindableParameters()`, so a `Pageable` in the middle of the
  signature does not shift the numbers. (Read from
  `QueryParameterSetterFactory.findParameterForBinding`; the reference does not
  spell this out.)

Give it a position that does not exist and the failure is an assertion naming
both counts — *"At least N parameter(s) provided but only M parameter(s) present
in query"* — raised while the repository is being created, not at call time.

## Named binding, and why the reference recommends it

The reference's own framing is a warning:

> "This makes query methods a little error-prone when refactoring regarding the
> parameter position. To solve this issue, you can use `@Param` annotation to
> give a method parameter a concrete name and bind the name in the query."

Its example is deliberately perverse, and worth copying out because it makes the
point in one line:

```java
@Query("select u from User u where u.firstname = :firstname or u.lastname = :lastname")
User findByLastnameOrFirstname(@Param("lastname") String lastname,
                               @Param("firstname") String firstname);
```

The method's parameters are in the opposite order to the query's, and it is
correct — *"the method parameters are switched according to their order in the
defined query"*. That is the whole feature: with names, the signature and the
query stop being coupled by order, so reordering either one is safe.

## Since version 4, the compiler supplies the names

> "As of version 4, Spring fully supports Java 8's parameter name discovery based
> on the `-parameters` compiler flag. By using this flag in your build as an
> alternative to debug information, you can omit the `@Param` annotation for
> named parameters."

```java
@Query("select u from User u where u.firstname = :firstname or u.lastname = :lastname")
User findByLastnameOrFirstname(String lastname, String firstname);
```

🔴 **In a Spring Boot application the flag is already on.** Both build plugins set
it without being asked: `spring-boot-starter-parent` sets
`<parameters>true</parameters>` for the Maven compiler plugin, and the Boot Gradle
plugin's `JavaPluginAction` appends `-parameters` to the compiler arguments of
every `JavaCompile` task. So the annotation-free form above works in a normal Boot
project with no configuration at all.

Two details the reference leaves out, both read from
`Parameter` in Spring Data Commons:

- **`@Param` wins when both are available.** The name is resolved as *"the
  annotation's value if present, otherwise the reflected parameter name"* — so an
  annotation is an override, and a stale one silently beats the real name.
- **When no name can be found, the failure names the fix.** `getRequiredName()`
  throws `IllegalStateException` with *"Parameter … is not named. For queries with
  named parameters you need to provide names for method parameters; Use `@Param`
  for query method parameters, or use the javac flag `-parameters`."* If you ever
  see that message, the build lost the flag — a plain `javac` invocation, a module
  compiled outside the Boot plugin, or a repository interface inherited from a
  library jar that was not compiled with it.

⚠️ **The flag is a property of the class file, not of your project.** A repository
interface declared in a dependency and extended in your code carries that
dependency's compilation settings. That is the one case where `@Param` is not
optional, and it is the reason libraries that ship repository interfaces still
annotate.

## Gotchas

**⚠️ Using positional binding with two same-typed parameters.**
`byName(String lastname, String firstname)` transposed at one call site compiles,
starts, passes a test that only checks the row count, and returns wrong rows.
This is the single reason the reference tells you to use names.

**⚠️ Inserting a parameter in the middle of the signature.**
Every `?n` after it now points one place to the left. Nothing fails at compile
time, and the query still parses, because the numbers are still valid — they are
just wrong. Named binding makes this a non-event.

**⚠️ Assuming `?1` counts the `Pageable`.**
It does not — positional numbering runs over bindable parameters only, so a
`Pageable` or `Sort` in the argument list is skipped. Assuming the opposite
produces an off-by-one in exactly the queries that are hardest to test.

**⚠️ Leaving a stale `@Param` after renaming the method parameter.**
The annotation wins over the reflected name, so the rename compiles and the
binding keeps working under the old name — until somebody deletes the annotation
"because version 4 makes it optional" and the query stops resolving.

**⚠️ Believing `-parameters` is on everywhere because it is on here.**
It is a compilation setting. Code compiled by a plain `javac`, by an IDE with its
own settings, or in a dependency built without the flag has no parameter names at
runtime, and named binding fails at repository creation with the
`is not named` message.

**⚠️ Mixing positional and named binding in one query.**
The reference's own SpEL examples do it deliberately, but in ordinary code it is
a maintenance trap: half the query is order-coupled and half is not, so a
refactor that is safe for one half breaks the other.

**⚠️ Using a positional parameter more than once and then removing one use.**
Because a position may legitimately appear several times, deleting one occurrence
leaves the argument bound elsewhere and no error anywhere. The method now filters
on less than it says, and the test that covered it probably still passes.

**⚠️ Naming a parameter after the entity field and assuming that connects them.**
`:status` binds to the *parameter* called `status`, not to the column. Rename the
field in the entity and this query keeps binding perfectly well — it fails later,
at parse time, on the path expression rather than on the parameter.

**⚠️ Annotating the `Pageable` with `@Param`.**
It is a special parameter, not a bindable one; naming it achieves nothing and
suggests to the next reader that it appears in the query. The same goes for
`Sort`, `Limit` and the dynamic-projection `Class<T>` argument.

**⚠️ Assuming a startup failure means the query is wrong.**
The two binding failures — an out-of-range position and an unnamed parameter —
are both about the *signature*, not the query text. Reading the message as a JPQL
problem sends you editing the string when the fix is in the method declaration.

## Interview questions

**★ What does `?1` refer to?**
The first bindable parameter of the method. Not the first token in the query and
not necessarily the first parameter of the signature: special parameters such as
`Pageable`, `Sort`, `Limit` and `ScrollPosition` are excluded from the numbering,
and the same position may be used several times in one query.

**★ Can one position appear twice in a query?**
Yes. Positions index arguments, not occurrences, so
`where u.firstname = ?1 or u.lastname = ?1` binds one value to both places. It is
useful for a "match either field" search and it is a small trap when one of the
two uses is later deleted.

**★ Why does the reference push you towards named parameters?**
Because positional binding couples the query to the argument order, and that
coupling is invisible to the compiler. Reordering, inserting or transposing
parameters produces a query that still parses and still runs, with different
results. Names remove the coupling entirely.

**★ Do you still need `@Param` in Spring Data 4?**
Not in a normal Spring Boot application: version 4 supports parameter-name
discovery from the `-parameters` flag, and both Boot build plugins enable it.
You still need it when the class file was compiled without the flag — typically a
repository interface inherited from a library — and it is still useful as an
explicit override.

**★ What happens if the names are not available?**
Repository creation fails with an `IllegalStateException` saying the parameter is
not named and naming both fixes: annotate with `@Param`, or compile with
`-parameters`. It is a startup failure, not a runtime one, which is the good
version of this problem.

**★ If both `@Param` and a compiled name exist, which wins?**
`@Param`. The name is resolved as the annotation's value when present and the
reflected parameter name otherwise. That makes a stale annotation more dangerous
than no annotation, because it keeps a rename from being visible.

**★ What error do you get for `?3` in a two-argument method?**
An assertion raised while the repository is being created, naming both numbers —
"At least 3 parameter(s) provided but only 2 parameter(s) present in query". Like
the naming failure, it is a startup error, and like the naming failure it is
about the signature rather than the query.

**★ Why is positional binding still the default?**
Because it needs nothing from the compiler and nothing from the author — it
worked before parameter names were available at runtime, and changing the default
would silently change the meaning of existing queries. It is a compatibility
default, not a recommendation.

**★ How would you make named binding fail in a working application?**
Compile the module without `-parameters` and remove the `@Param` annotations, or
move the repository interface into a jar built without the flag. Both are easy to
do accidentally in a multi-module build where only the application module uses
the Boot plugin.

**★ Does binding protect you from SQL injection?**
Yes, for values: a bound parameter is never parsed as query text. It does not
protect you from *pattern* injection in a `like`, and it does nothing at all for
a query assembled by string concatenation in a custom implementation, which is
where injection actually appears in JPA codebases.

{/* FOOTER */}
