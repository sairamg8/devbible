---
title: "One line in junit-platform.properties improves the report of every parameterized test in a repository that never set a name attribute — which makes the display-name configuration parameter, its precedence rules and the 5.13 relocation of the placeholder constants the cheapest legacy-suite improvement in this topic"
sidebar_label: "07d · Project-wide defaults"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Default Display Name Pattern" and
> "Precedence Rules"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> "Configuration Parameters"
> ([docs.junit.org](https://docs.junit.org/6.0.3/running-tests/configuration-parameters.html)),
> and the `@ParameterizedTest`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html))
> and `ParameterizedInvocationConstants`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedInvocationConstants.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**A four-hundred-test suite where nobody ever set `name` is not a problem you fix method by
method. It is one properties line, because the default `name` value is a flag that defers to a
configuration parameter — and understanding the three-step precedence behind that flag is what
tells you whether your line will take effect or be silently outranked.**

## The configuration parameter

> *"If you'd like to set a default name pattern for all parameterized classes and tests in
> your project, you can declare the `junit.jupiter.params.displayname.default` configuration
> parameter in the `junit-platform.properties` file as demonstrated in the following example"*
>
> ```properties
> junit.jupiter.params.displayname.default = {index}
> ```

A more useful value than the guide's minimal example, for a repository whose CI flattens the
test tree:

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.params.displayname.default = [{index}] {displayName} — {argumentSetNameOrArgumentsWithNames}
```

That keeps the default's index and either/or argument rendering
([07](07-display-names.md), [07c](07c-naming-arguments.md)) and adds back the method name the
built-in default deliberately omits.

⚠️ The file must be **at the root of the test classpath**, which in a Maven or Gradle module
means `src/test/resources/junit-platform.properties`. A copy in `src/main/resources` is
shipped to production and read by nothing useful in either place. In a multi-module build each
module needs its own copy, or the value has to come from the build tool instead.

## Four ways to supply it

The javadoc lists them: *"The configuration parameter can be supplied via the Launcher API,
build tools (e.g., Gradle and Maven), a JVM system property, or the JUnit Platform
configuration file"*. Concretely:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <properties>
      <configurationParameters>
        junit.jupiter.params.displayname.default = [{index}] {displayName}
      </configurationParameters>
    </properties>
  </configuration>
</plugin>
```

```groovy
tasks.named('test', Test) {
    useJUnitPlatform()
    systemProperty 'junit.jupiter.params.displayname.default', '[{index}] {displayName}'
}
```

The Console Launcher takes `--config`, and the Launcher API takes
`configurationParameter(…)` / `configurationParameters(…)` on
`LauncherDiscoveryRequestBuilder`.

**These four are not equal.** The Platform defines a strict lookup order:

> *"Configuration parameters are looked up in the exact order defined above. Consequently,
> configuration parameters supplied directly to the Launcher take precedence over those
> supplied via custom configuration files, system properties, and the default configuration
> file. Similarly, configuration parameters supplied via system properties take precedence
> over those supplied via the default configuration file."*

So a Gradle `systemProperty` beats your `junit-platform.properties`, and an IDE that builds a
`LauncherDiscoveryRequest` with its own parameters beats both. That is the usual explanation
for "the pattern works in Gradle but not in IntelliJ", or the reverse.

## The precedence that decides the final pattern

Two separate precedence chains are in play and conflating them is the standard confusion. The
Platform chain above decides **which value of the configuration parameter wins**. The Jupiter
chain below decides **whether the configuration parameter is consulted at all**:

> *"The display name for a parameterized class or test is determined according to the
> following precedence rules:*
> 1. *`name` attribute in `@ParameterizedClass` or `@ParameterizedTest`, if present*
> 2. *value of the `junit.jupiter.params.displayname.default` configuration parameter, if
>    present*
> 3. *`DEFAULT_DISPLAY_NAME` constant defined in
>    `org.junit.jupiter.params.ParameterizedInvocationConstants`"*

A per-method `name` always wins. The configuration parameter is a **floor for the methods that
did not bother**, which is exactly the right shape for a large existing codebase: methods that
already thought about their report keep their pattern, and everything else improves at once.

It also means you cannot use the configuration parameter to *enforce* a convention. If a
reviewer wants every parameterized test to carry the method name, that is a review rule, not a
configuration one.

## The constants moved in 5.13

If you build patterns from constants rather than string literals — reasonable, since a typo in
`{argumentsWithNames}` is silent — use the new home:

```java
import static org.junit.jupiter.params.ParameterizedInvocationConstants.ARGUMENTS_WITH_NAMES_PLACEHOLDER;
import static org.junit.jupiter.params.ParameterizedInvocationConstants.INDEX_PLACEHOLDER;

@ParameterizedTest(name = "[" + INDEX_PLACEHOLDER + "] " + ARGUMENTS_WITH_NAMES_PLACEHOLDER)
void cases(String input) { }
```

`ParameterizedInvocationConstants` is `@API(status = MAINTAINED, since = "5.13")` and declares
seven constants: `DISPLAY_NAME_PLACEHOLDER`, `INDEX_PLACEHOLDER`, `ARGUMENTS_PLACEHOLDER`,
`ARGUMENTS_WITH_NAMES_PLACEHOLDER`, `ARGUMENT_SET_NAME_PLACEHOLDER`,
`ARGUMENT_SET_NAME_OR_ARGUMENTS_WITH_NAMES_PLACEHOLDER` and `DEFAULT_DISPLAY_NAME`.

The identically named fields on `@ParameterizedTest` itself are all
`@Deprecated(since = "5.13")` with `@API(status = DEPRECATED, since = "5.13")`, each carrying
the same javadoc note — for example:

> *"Deprecated. Please reference
> `ParameterizedInvocationConstants.ARGUMENTS_WITH_NAMES_PLACEHOLDER` instead."*

They still exist in 6.0.3, so nothing breaks on the Boot 4.1 upgrade; they are a deprecation
warning waiting for the next major version. Note the asymmetry: `@ParameterizedClass` never
had these fields, because it arrived in 5.13 — the same release that moved them out. A
codebase using both annotations therefore *has* to use the shared class for one of them, which
is the point of the relocation.

## Gotchas

**★ Setting a project-wide default and expecting it to override a method's `name`.** The
Jupiter precedence runs the other way: the annotation wins, the configuration parameter is the
fallback, the constant is the fallback's fallback. The parameter cannot enforce a convention,
only supply one.

**★ Putting `junit-platform.properties` outside the test classpath root.** The javadoc says *"a
file named `junit-platform.properties` in the root of the class path"*. In a Maven or Gradle
module that is `src/test/resources/`. Anywhere else and the file is inert, with no warning.

**★ Forgetting that each module needs the file.** The properties file is found on the
classpath, so a multi-module build has one per module unless the value is supplied by the
build tool. Half-configured is the worst outcome: the same test renders differently depending
on which module it lives in.

**★ A Gradle `systemProperty` silently outranking the properties file.** System properties beat
the default configuration file in the Platform's documented lookup order, and Launcher-supplied
parameters beat both. When the pattern differs between the IDE and the build, this ordering is
the first thing to check.

**★ Importing the placeholder constants from `@ParameterizedTest`.** They compile, they are
deprecated since 5.13, and a build configured to fail on deprecation warnings will stop on a
JUnit upgrade rather than at the moment the import was written.

**★ Assuming `@ParameterizedClass` has the same constants.** It never had them. It was
introduced in the release that moved them to `ParameterizedInvocationConstants`, so that class
is the only home for both annotations ([08c](08c-parameterized-classes.md)).

**★ Writing the pattern with a bare `{` in a properties file and worrying about escaping.** A
Java properties file does not treat braces specially; the value goes through verbatim. What it
*does* treat specially is a trailing backslash (line continuation) and a leading `!` or `#`
(comment) — so a pattern is fine, and a pattern spread over two lines is not.

**★ Setting `{index}` alone project-wide because it is the guide's example.** The guide is
demonstrating syntax, not recommending a value. `{index}` alone strips the arguments out of
every report in the repository, which is a large step backwards from the built-in default.

## Interview questions

**★ How do you set one display-name convention for a whole repository?**
Declare `junit.jupiter.params.displayname.default` at the root of the test classpath in
`junit-platform.properties`, or supply it as a configuration parameter from Maven Surefire,
Gradle, a JVM system property or the Launcher API. It applies to every parameterized class and
method that does not set `name` itself.

**★ What is the precedence between the annotation, the configuration parameter and the
constant?**
Annotation `name` first, then the `junit.jupiter.params.displayname.default` configuration
parameter, then `ParameterizedInvocationConstants.DEFAULT_DISPLAY_NAME`. The
`{default_display_name}` value the annotation defaults to is what triggers the fallthrough — a
flag meaning "I did not choose", rather than a placeholder.

**★ Your pattern works in Gradle and not in the IDE. Why?**
Because the configuration parameter can arrive by four routes with a documented lookup order:
Launcher API, custom configuration resources, JVM system properties, then the default
`junit-platform.properties`. Gradle typically supplies it as a system property, which outranks
the file; an IDE builds its own `LauncherDiscoveryRequest`, which outranks everything. Whoever
is highest in that order supplies the value actually used.

**★ Can you use the configuration parameter to force every parameterized test to include the
method name?**
No. It is a default, not an override — any method with its own `name` attribute keeps it. If
that is a standard the team wants enforced, it has to be enforced in review or by a static
analysis rule, not by configuration.

**★ Where do the placeholder constants live now, and why did they move?**
`org.junit.jupiter.params.ParameterizedInvocationConstants`, `@API(status = MAINTAINED,
since = "5.13")`. They moved because 5.13 added `@ParameterizedClass`, and constants living on
`@ParameterizedTest` would have been the wrong home for an annotation that shares the same
patterns. The old fields are deprecated since 5.13 and still present in 6.0.3.

{/* FOOTER */}
