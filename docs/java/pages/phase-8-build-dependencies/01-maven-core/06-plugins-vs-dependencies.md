---
title: "Plugins vs dependencies"
sidebar_label: "6 · Plugins vs dependencies"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html — `<build>`, `<plugins>`,
> `<pluginManagement>`, `<dependencies>`, `<dependencyManagement>`,
> plugin `<executions>` and `<configuration>`), the Maven lifecycle
> guide (goal binding, `default-*` execution ids), the Guide to
> Configuring Plugins, and "What's new in Maven 4"
> (maven.apache.org/whatsnewinmaven4.html — Plexus removal, JSR-330,
> `-Dmaven.plugin.validation=verbose`, the Super POM plugin-version
> warning, and `bom` packaging).

**A dependency is code your program links against; a plugin is code that
*runs the build*. They live in different classloaders, are resolved into
different graphs, appear in different POM sections, and share nothing
except the coordinate format — which is the entire reason people conflate
them. Adding a library to `<plugins>` does nothing at runtime; adding a
plugin to `<dependencies>` puts a build tool on your application
classpath. And the two "management" sections that sit above them do
almost opposite things: `<pluginManagement>` configures without
enabling, `<dependencyManagement>` versions without adding.**

## The distinction, stated once

| | Dependency | Plugin |
|---|---|---|
| Lives in | `<dependencies>` | `<build><plugins>` |
| Is | a jar your code compiles/runs against | a jar containing **mojos** (goals) Maven executes |
| Graph | transitive, mediated, scoped | resolved independently, **not** transitive into your build |
| Classloader | your application's classpath | a plugin classloader, isolated from your app |
| Ends up in the artifact | yes (per scope) | never |
| Failure mode | `NoClassDefFoundError` at runtime | a build step misbehaves or does not run |

The clean mental test: **would removing it change what your program can
call, or change what `mvn` does?** Jackson is a dependency. The compiler
plugin is a plugin. Lombok is the one that makes people argue, and the
answer is that it is *both roles in one artifact* — a dependency at
compile time (the annotations) that also plugs into `javac` as an
annotation processor. That is topic 09's subject.

## Plugins, mojos and goals

A plugin is an artifact with normal GAV coordinates containing one or
more **mojos** ("Maven plain Old Java Objects"). Each mojo is a
**goal** — `compiler:compile`, `surefire:test`, `jar:jar`. A goal may
declare a default phase; that is how it lands in the lifecycle without
you saying where.

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-failsafe-plugin</artifactId>
      <version>3.5.4</version>
      <executions>
        <execution>
          <id>integration-tests</id>          <!-- names this binding -->
          <phase>verify</phase>               <!-- optional: override the default -->
          <goals>
            <goal>integration-test</goal>
            <goal>verify</goal>
          </goals>
          <configuration>
            <includes><include>**/*IT.java</include></includes>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

Three levels of configuration, and they are not equivalent:

- **`<configuration>` directly under `<plugin>`** applies to *every*
  execution of that plugin, including the default lifecycle bindings.
- **`<configuration>` inside an `<execution>`** applies to that
  execution only.
- **A user property** (`-Dmaven.compiler.release=25`) supplies a value
  the plugin declares a property for, and is the only one settable from
  the command line.

Default lifecycle bindings carry generated execution ids of the form
`default-<goal>` — `default-compile`, `default-testCompile`,
`default-jar`. That naming is not trivia: **declaring an execution with
the same id reconfigures the built-in binding instead of adding a second
one**, which is how you change the default compile without ending up
compiling twice.

The same plugin can be bound several times with different
configurations. Two `jar:jar` executions with different classifiers and
different includes produce two jars from one build — normal, and only
possible because executions are named.

## Plugin classpath isolation, and a plugin's own `<dependencies>`

A plugin runs in its own classloader. It does not see your application's
dependencies, and your application does not see the plugin's. This is
why the compiler plugin can use one version of a library while your code
uses another with no conflict — and why "add it to the plugin, they are
all jars" never works.

When a plugin needs an extra artifact — a JDBC driver for a migration
plugin, a specific Surefire provider, a checkstyle ruleset jar — it goes
in the **plugin's own** `<dependencies>` block:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-checkstyle-plugin</artifactId>
  <version>3.6.0</version>
  <dependencies>
    <dependency>                      <!-- available to the PLUGIN only -->
      <groupId>com.acme</groupId>
      <artifactId>acme-checkstyle-rules</artifactId>
      <version>1.4.0</version>
    </dependency>
  </dependencies>
</plugin>
```

This block is one of the most-missed features in Maven, and its absence
is why people put a driver in `<dependencies>` "so the migration plugin
can find it" — shipping a database driver to production to satisfy a
build step.

## Two `<plugin>` elements nobody reads about

Both live on the `<plugin>` element itself, and both answer a question
that otherwise looks unanswerable.

```xml
<plugin>
  <groupId>org.apache.felix</groupId>
  <artifactId>maven-bundle-plugin</artifactId>
  <version>6.0.0</version>
  <extensions>true</extensions>       <!-- contribute new packaging + bindings -->
  <inherited>false</inherited>        <!-- do NOT run in child modules -->
</plugin>
```

**`<extensions>true</extensions>`** lets a plugin contribute new
packaging types and lifecycle mappings to the build. It is why declaring
`<packaging>bundle</packaging>` fails with "unknown packaging" until you
set it — the packaging does not exist until the plugin is loaded as an
extension. Any plugin that invents a packaging needs it.

**`<inherited>false</inherited>`** stops a plugin declared in a parent
from running in every child. Without it, a plugin in the parent's
`<plugins>` runs everywhere, which is right for a formatter and wrong
for something that should run once at the root — a report aggregator, a
release step, a repository-wide check.

And when the documentation is not to hand:

```bash
mvn help:describe -Dplugin=org.apache.maven.plugins:maven-jar-plugin
mvn help:describe -Dplugin=jar -Dgoal=jar -Ddetail=true
```

That prints the goals, their default phases and every parameter with its
user property — which is the fastest cure for the untyped-configuration
problem, because you can check a parameter name before you guess it.

## The honest trade in the split

The separation is right and it costs you. A single artifact that plays
both roles has to be declared twice — Lombok is a `<dependency>` *and*
an annotation-processor path entry for the compiler plugin, and getting
one without the other produces errors that name neither. A JUnit 5
engine has to be on the *test* classpath for Surefire's provider to find
it, which is why "I added the API and no tests run" is a weekly
occurrence. When something is "on the classpath" and still not found,
the first question is always **whose** classpath you put it on — and
Maven's error messages are unhelpfully silent about that distinction,
because from the plugin's point of view the artifact simply is not
there.

## Gotchas

**Symptom:** adding an `<execution>` for `compiler:compile` makes the project compile twice
**Cause:** a new execution id was created alongside the built-in `default-compile`
**Fix:** reuse the id `default-compile` to reconfigure the built-in binding instead of adding a second one

**Symptom:** a JDBC driver ships in production because "the migration plugin needs it"
**Cause:** the driver was added to `<dependencies>` instead of the plugin's own `<dependencies>` block
**Fix:** move it inside the `<plugin>` element; plugins have isolated classloaders and their own dependency lists

**Symptom:** a setting intended for one execution changes the default lifecycle execution too
**Cause:** `<configuration>` was placed directly under `<plugin>`, which applies to every execution including the built-in ones
**Fix:** put it inside the specific `<execution>`; reserve plugin-level configuration for settings you genuinely want everywhere

**Symptom:** a plugin is declared with goals and nothing ever runs it
**Cause:** the goal has no default phase and no `<phase>` was given, so it is bound nowhere
**Fix:** check the goal's documentation for its default phase; supply `<phase>` explicitly when there is none

**Symptom:** you add a library under `<build><plugins>` and get `NoClassDefFoundError` at runtime
**Cause:** the two sections are not interchangeable — a plugin entry never contributes to the application classpath
**Fix:** it belongs in `<dependencies>`; if it is needed by both your code and a build step, it is declared in both places on purpose

**Symptom:** `<packaging>bundle</packaging>` (or any plugin-provided packaging) fails with "unknown packaging"
**Cause:** the plugin that defines that packaging was not loaded as a build extension
**Fix:** `<extensions>true</extensions>` on that plugin — packaging types and lifecycle mappings only exist once the extension is loaded

**Symptom:** a plugin declared once in the parent runs in all twelve modules
**Cause:** `<plugins>` is inherited, and a plugin with a bound goal runs wherever it is inherited to
**Fix:** `<inherited>false</inherited>` on the plugin element for things meant to run once at the root

**Symptom:** JUnit 5 tests are found by the IDE and not by Surefire
**Cause:** the engine (not just the API) must be on the test classpath for Surefire's provider to discover it
**Fix:** depend on `junit-jupiter` (which brings the engine) rather than `junit-jupiter-api` alone, and check `dependency:tree -Dscope=test`

## Interview questions

**★ What is the difference between a plugin and a dependency?**
A dependency is a jar your code compiles and runs against; a plugin is a
jar containing goals Maven executes to *perform* the build. They live in
separate classloaders, resolve into separate graphs, and only the
dependency ends up in the artifact. They share the coordinate format and
nothing else — which is precisely why they get confused.

**★ What is a mojo, and how does a goal end up running at the right time?**
A mojo is the Java class implementing one goal. A goal may declare a
default lifecycle phase in its metadata; that is how `compiler:compile`
lands at `compile` with nobody saying so. If it declares none, you bind
it yourself with `<phase>` inside an `<execution>`.

**★ Name the three places plugin configuration can live and what each covers.**
`<configuration>` under `<plugin>` — every execution of that plugin,
including the built-in lifecycle ones. `<configuration>` inside an
`<execution>` — that execution only. A user property such as
`maven.compiler.release` — the only form settable from the command line
with `-D`.

**★ How do you give a plugin an artifact it needs at build time only?**
The `<dependencies>` block *inside* the `<plugin>` element. Plugins have
isolated classloaders, so a project dependency is not visible to them —
which is why "put the driver in `<dependencies>`" appears to work in
some setups and ships build tooling to production in all of them.

**★ You add an execution for `compiler:compile` and the project compiles twice. What happened?**
You created a second execution alongside the built-in one. Default
lifecycle bindings have generated ids of the form `default-<goal>` —
reuse `default-compile` and you reconfigure the existing binding instead
of adding another.

**★ Why can the compiler plugin use a different version of a library than your application does?**
Because a plugin runs in its own classloader, resolved from its own
dependency graph. Plugin dependencies are not transitive into your build
and your dependencies are not visible to plugins, so there is no
conflict to mediate. It also means "they are all jars, just add it
somewhere" is never a valid fix.

**★ What does `<extensions>true</extensions>` on a plugin do?**
It loads the plugin as a build extension, letting it contribute new
packaging types and lifecycle mappings. It is the answer to "unknown
packaging" for anything a plugin invents — the packaging literally does
not exist to Maven until the extension is loaded.

**★ A plugin in the parent should run only at the root. How?**
`<inherited>false</inherited>` on the `<plugin>` element. Otherwise
inheritance carries it to every child, which is correct for a formatter
and wrong for a release step or a report aggregator.

**★ How do you find a plugin's goals and parameter names from the terminal?**
`mvn help:describe -Dplugin=<prefix or coordinates> -Ddetail=true`, and
add `-Dgoal=<goal>` to narrow it. It lists default phases, parameters
and their user properties — the practical antidote to configuration that
is never validated.

**★ Can one plugin be bound more than once?**
Yes, and it is routine — executions are named, so two `jar:jar`
executions with different classifiers and includes produce two jars from
one build. It is also why execution ids matter: reusing a built-in id
reconfigures, and inventing a new one adds.

---

← Prev: [Running the build](05-running-the-build.md) · Index: [Maven core](README.md) · Next → [The management sections](07-the-management-sections.md)
