---
title: "The plugins every build has"
sidebar_label: "8 · The plugins every build has"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven plugin sites —
> maven-compiler-plugin **3.15.0** (`release`, user property
> `maven.compiler.release`, `source`/`target` still defaulting to
> `1.8`), maven-surefire-plugin (**3.6.0-M1** documented, default
> includes), maven-failsafe-plugin (`integration-test` + `verify`
> goals), maven-shade-plugin **3.6.2** (`shade` bound to `package`,
> relocation), maven-jar-plugin, maven-dependency-plugin
> (`tree`, `analyze`, `analyze-only`), maven-enforcer-plugin, and
> "What's new in Maven 4" (Plexus removal, JSR-330,
> `-Dmaven.plugin.validation=verbose`, the compiler plugin 4.x preview,
> official Maven BOMs).

**A Maven build you have never seen is readable if you know a dozen
plugins, because the same dozen do ninety percent of the work in every
Java project on earth. Learning them is not memorising configuration —
it is knowing which one owns which failure, so that a message you have
never read still tells you where to look. Versions below are the ones
verified on the plugin sites in August 2026; check the plugin site
before copying a version into a real POM, because they move
independently of Maven itself.**

## The core eight, by phase

| Plugin | Binds at | Owns |
|---|---|---|
| **resources** | `process-resources`, `process-test-resources` | copying and filtering `src/main/resources` |
| **compiler** | `compile`, `test-compile` | `javac`, `--release`, annotation processor paths |
| **surefire** | `test` | unit tests, forked JVMs, `argLine` |
| **failsafe** | `integration-test`, `verify` | integration tests that must tear down cleanly |
| **jar** | `package` | the archive and `MANIFEST.MF` |
| **install** | `install` | copy into `~/.m2/repository` |
| **deploy** | `deploy` | upload to the remote repository |
| **shade** *(or spring-boot)* | `package` | an executable / uber jar |

The first seven are bound by default for `jar` packaging (chunk 4). The
eighth is the first one you add.

## compiler — the one that is misconfigured most often

```xml
<properties>
  <maven.compiler.release>25</maven.compiler.release>
</properties>
```

That is the whole configuration for most projects, and it is a property
rather than a `<plugin>` block because `release` declares
`maven.compiler.release` as its user property. Reach for the plugin
element when you need more:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <version>3.15.0</version>
  <configuration>
    <compilerArgs>
      <arg>-parameters</arg>          <!-- keep parameter names in the class file -->
      <arg>-Xlint:all</arg>
    </compilerArgs>
    <annotationProcessorPaths>
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>1.18.42</version>
      </path>
    </annotationProcessorPaths>
  </configuration>
</plugin>
```

Two things here earn their own topics later in this phase.
`-parameters` (topic 11) is what lets frameworks read constructor
parameter names at runtime instead of `arg0`, and its absence produces
some of the least helpful Spring and Jackson errors there are.
`<annotationProcessorPaths>` (topic 09) is the correct way to run
Lombok or MapStruct: it keeps the processor off the application
classpath while still handing it to `javac`, which is the plugin-versus-
dependency distinction from chunk 6 made concrete.

## surefire and failsafe — the same job, split by failure timing

Surefire runs unit tests at `test` and fails immediately. Failsafe runs
integration tests at `integration-test` **without** failing, and
reports at `verify` — so `post-integration-test` teardown always runs
(chunk 4). Their default includes are disjoint on purpose:

| | Default includes |
|---|---|
| surefire | `**/Test*.java`, `**/*Test.java`, `**/*Tests.java`, `**/*TestCase.java` |
| failsafe | `**/IT*.java`, `**/*IT.java`, `**/*ITCase.java` |

The configuration that actually matters in practice is `argLine`, which
sets the forked JVM's arguments — heap, `--enable-preview`, a JaCoCo
agent. It is also the classic collision: JaCoCo *prepends* its agent by
setting a property that `argLine` must reference, so hard-coding
`<argLine>-Xmx1g</argLine>` silently disables coverage. Write
`<argLine>@{argLine} -Xmx1g</argLine>` when an agent is in play.

## jar and shade — one artifact or one artifact containing everything

`jar:jar` produces `target/<artifactId>-<version>.jar` containing only
your classes. Nothing about it is executable: a plain jar has no
dependencies inside it and no `Main-Class` unless you add one.

`shade:shade` (3.6.2), bound to `package`, produces an **uber jar** with
every dependency unpacked into it. Its important feature is
**relocation** — renaming a dependency's packages as it is bundled — and
that is the *only* mechanism in the Java ecosystem for running two
incompatible versions of a library at once, because it changes the
package names the classes are loaded under. It is also how a library
avoids forcing its own transitive versions on consumers. Topic 08 goes
into jar anatomy and the shading trade-offs; the cost to know now is
that a shaded jar loses the dependency information a scanner needs, so
your SBOM and your CVE feed stop seeing what is inside it.

`spring-boot-maven-plugin`'s `repackage` goal is the alternative shape:
it keeps dependency jars **whole** inside a nested layout with a custom
launcher, renames the original to `.jar.original`, and preserves
signatures and per-jar identity that shading destroys. Two different
answers to "one file to run", with different costs.

## resources — the quiet one that corrupts files

`resources:resources` copies `src/main/resources` into
`target/classes`, and if you turn on **filtering** it also substitutes
`${...}` properties on the way through:

```xml
<build>
  <resources>
    <resource>
      <directory>src/main/resources</directory>
      <filtering>true</filtering>
      <includes><include>**/*.properties</include></includes>
    </resource>
    <resource>
      <directory>src/main/resources</directory>
      <filtering>false</filtering>            <!-- keystores, images, fonts -->
      <excludes><exclude>**/*.properties</exclude></excludes>
    </resource>
  </resources>
</build>
```

Two directory entries, because **filtering a binary file corrupts it**.
A keystore, a `.p12`, a PNG or a font passed through the filter comes
out subtly different and fails at runtime with an error that never
mentions the build. Split filtered text from unfiltered binaries; it is
the standard shape and it exists for exactly this reason.

The second trap is delimiter collision. Spring's own property
placeholders are also `${...}`, so Maven filtering an
`application.properties` will eat `${DB_PASSWORD}` at build time,
substituting nothing and leaving an empty value. Spring Boot's parent
solves it by setting the filtering delimiter to `@…@`, which is why Boot
projects write `@project.version@` in resources and plain `${...}`
survives to runtime. Outside Boot you configure the same thing yourself,
or you do not filter that file.

## The honest trade: plugin configuration is untyped

Binding one goal to one phase with one setting costs about fifteen lines
of XML where an imperative build tool needs one. That is verbosity, and
you can live with it. The genuine problem is that **plugin configuration
is not validated on Maven 3**: misspell a parameter, or put a valid
parameter under the wrong goal, and Maven silently ignores it. There is
no error, no warning, and no observable difference between "the setting
did nothing" and "the setting was never read" — which is the single most
demoralising Maven experience there is, and the reason people conclude a
plugin is broken when their POM is.

Maven 4 finally addresses it: `-Dmaven.plugin.validation=verbose`
reports plugin problems in detail and `--fail-on-severity WARN` makes
them fatal. Both belong in
[chunk 9](09-diagnostics-governance-maven4.md)'s migration checklist.

## Gotchas

**Symptom:** JaCoCo reports zero coverage after someone adds a heap setting
**Cause:** a hard-coded `<argLine>` in surefire replaced the property JaCoCo injects its agent through
**Fix:** `<argLine>@{argLine} -Xmx1g</argLine>` so the agent argument survives

**Symptom:** Spring or Jackson complains about `arg0`, or cannot bind constructor parameters
**Cause:** the class was compiled without `-parameters`, so parameter names are not in the class file
**Fix:** add `-parameters` to `<compilerArgs>`. Spring Boot's parent does it for you, which is why this only bites outside Boot

**Symptom:** Lombok works in the IDE and not in the Maven build, or the reverse
**Cause:** it is a plain `<dependency>` in one place and an `<annotationProcessorPaths>` entry in the other, and the two disagree
**Fix:** make `<annotationProcessorPaths>` the source of truth — the IDE reads it too, and it keeps Lombok off the application classpath

**Symptom:** a shaded jar passes every test and its contents are invisible to the CVE scanner
**Cause:** shading unpacks and often relocates dependencies, destroying the coordinates a scanner keys on
**Fix:** scan before shading, or publish the thin jar alongside; an uber jar trades traceability for a single file and you should make that trade knowingly

**Symptom:** a plain `jar` will not run with `java -jar`
**Cause:** `jar:jar` writes no `Main-Class` and puts no dependencies inside — that is not its job
**Fix:** add a manifest entry for a dependency-free program, or use shade / `spring-boot:repackage` for anything with dependencies

**Symptom:** integration tests named `*Test` run twice, or unit tests named `*IT` never run
**Cause:** the file name decides which runner claims it — surefire and failsafe have disjoint default includes
**Fix:** name by intent (`FooTest` for unit, `FooIT` for integration) rather than configuring overlapping includes

**Symptom:** a keystore or image in `src/main/resources` is corrupt in the jar
**Cause:** resource filtering was enabled for the whole directory and rewrote a binary file
**Fix:** two `<resource>` entries — filtered for text, unfiltered for binaries — which is the standard layout for exactly this reason

**Symptom:** a `${...}` placeholder in `application.properties` is empty at runtime
**Cause:** Maven's resource filtering consumed it at build time, because Spring uses the same `${...}` syntax
**Fix:** Spring Boot's parent sets the filtering delimiter to `@…@` — use `@project.version@` in filtered resources, and configure the same delimiter yourself outside Boot

**Symptom:** a `<compilerArgs>` flag is ignored for test sources only
**Cause:** `compile` and `testCompile` are separate executions and plugin-level configuration reaches both, but an execution-scoped one does not
**Fix:** decide deliberately which level the setting belongs at (chunk 6's three configuration levels)

## Interview questions

**★ Which plugins run in a default `jar` build, and what does each own?**
resources (copy and filter), compiler (`javac`), surefire (unit tests),
jar (the archive and manifest), install (local repository), deploy
(remote). Failsafe and an uber-jar plugin are the first two most
projects add. Mapping a failure message to one of these is most of what
"knowing Maven" means in practice.

**★ How do you compile for Java 25, and what is wrong with `source`/`target`?**
`<maven.compiler.release>25</maven.compiler.release>`. `source` and
`target` set only language level and bytecode version, so you can still
call an API that does not exist on the target JVM and fail at runtime;
`release` validates against that version's API as well. Both still
default to `1.8` in maven-compiler-plugin 3.15.0 if you set neither.

**★ Coverage drops to zero right after a surefire change. What happened?**
Someone hard-coded `<argLine>`, replacing the property the coverage
agent injects itself through. `@{argLine}` in the value preserves it.
Worth recognising instantly, because a 0% report looks like a coverage
tool problem and is a surefire configuration problem.

**★ `shade` vs `spring-boot:repackage` — what is the actual difference?**
Shade unpacks every dependency into one flat jar and can relocate
packages; Boot's repackage keeps dependency jars whole in a nested
layout with its own launcher and renames the original to
`.jar.original`. Shading can resolve version conflicts by renaming, and
destroys per-jar identity, signatures and scanner visibility. Boot's
form preserves all of that and only runs through its launcher.

**★ Why is relocation the only way to run two majors of a library at once?**
Because Maven puts exactly one version of a `groupId:artifactId` on the
classpath (chunk 1), and even if it did not, both copies would declare
the same package and class names. Relocation rewrites the package names
during shading, so the two copies stop being the same classes as far as
the JVM is concerned.

**★ Why does the same source file compile in your IDE and fail under Maven?**
Almost always an annotation processor difference — the IDE has one
configured that `<annotationProcessorPaths>` does not, or vice versa —
or a `release` level the IDE has not picked up. The build tool is the
authority; make the IDE import the POM rather than configuring both.

**★ What does resource filtering do, and where does it bite?**
It substitutes `${...}` properties into resources as they are copied to
`target/classes`. It bites twice: filtering a binary file corrupts it,
so filtered and unfiltered resources need separate `<resource>` entries;
and Spring's placeholders use the same syntax, so Maven eats them at
build time unless the delimiter is changed.

**★ Why do Spring Boot projects write `@project.version@` in resources?**
Because `spring-boot-starter-parent` changes Maven's filtering delimiter
to `@…@`, so build-time substitution and Spring's runtime `${...}`
placeholders stop colliding. Outside Boot you either configure the same
delimiter or do not filter files that contain runtime placeholders.

**★ Why is a misspelled plugin parameter such a common time sink?**
Because Maven 3 does not validate plugin configuration — an unknown
element is silently dropped, so "the setting did nothing" and "the
setting was never read" are indistinguishable. Maven 4's
`-Dmaven.plugin.validation=verbose` and `--fail-on-severity` are the
first real fix.

---

← Prev: [The management sections](07-the-management-sections.md) · Index: [Maven core](README.md) · Next → [Diagnostics, governance and Maven 4](09-diagnostics-governance-maven4.md)
