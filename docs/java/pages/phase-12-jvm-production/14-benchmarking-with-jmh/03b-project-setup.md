---
title: "The archetype is not a convenience, it is the supported configuration — and the reason every JMH troubleshooting guide starts with 'generate a clean archetype project and move your benchmark into it'"
sidebar_label: "03b · Project setup"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `README.md`** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/README.md)) — the
> "Usage", "IDE Support" and "Other Build Systems" sections — and against Maven Central
> metadata for `org.openjdk.jmh:jmh-core`, whose newest published release is **1.37**.
> JDK 25, Maven build. 🔴 **No sandbox** — no project was generated and no build was run.

**JMH's setup instructions read like an over-cautious quickstart until you notice that every
sentence is defending a measurement property. The standalone project, the archetype, the
`-jar` run and the warning about IDEs are all the same argument: the environment the
benchmark runs in is part of the experiment.**

## The recommended shape, and why

> *"The recommended way to run a JMH benchmark is to use Maven to setup a standalone project
> that depends on the jar files of your application. This approach is preferred to ensure
> that the benchmarks are correctly initialized and produce reliable results. It is possible
> to run benchmarks from within an existing project, and even from within an IDE, however
> setup is more complex and the results are less reliable."*

🔴 **"Depends on the jar files of your application" is the load-bearing phrase.** The
benchmark module consumes your code the way another service would — as a published artifact
on the classpath — rather than sharing a compilation unit with it. That keeps the benchmark
from accidentally seeing package-private internals, and keeps your production build free of
a benchmark dependency.

And the mechanism the whole setup exists to enable:

> *"In all cases, the key to using JMH is enabling the annotation- or bytecode-processors to
> generate the synthetic benchmark code. Maven archetypes are the primary mechanism used to
> bootstrap the project that has the proper build configuration. We strongly recommend new
> users make use of the archetype to setup the correct environment."*

## The three commands

**Generate**, into a directory that is not already a Maven project — the README notes
*"current and target folder should not already contain any Maven project for this to work
reliably"*:

```bash
mvn archetype:generate \
  -DinteractiveMode=false \
  -DarchetypeGroupId=org.openjdk.jmh \
  -DarchetypeArtifactId=jmh-java-benchmark-archetype \
  -DgroupId=org.sample \
  -DartifactId=test \
  -Dversion=1.0
```

**Build** — note it is `verify`, not `package` or `test`:

```bash
cd test/
mvn clean verify
```

**Run** the self-contained jar:

```bash
java -jar target/benchmarks.jar
```

> *"After the build is done, you will get the self-contained executable JAR, which holds your
> benchmark, and all essential JMH infrastructure code."*

`-h` lists every runtime option. ⚠️ **The jar is executable because the shade/assembly
configuration in the archetype's `pom.xml` makes it so** — this is one of the "minute
differences in the build configurations" the README warns about when a hand-rolled setup
misbehaves.

For a different JVM language, the README says to use another archetype artifact id from the
published list, *"it usually amounts to replacing `java` to another language in the artifact
ID"*, and that *"using alternative archetypes may require additional changes in the build
configuration"*.

## Benchmarks in a real repository

> *"When dealing with large projects, it is customary to keep the benchmarks in a separate
> sub-project, which then depends on the tested modules via the usual build dependencies."*

🔴 **A separate module, not a source set inside the production module.** That gives you the
archetype's build configuration in one place, keeps `jmh-generator-annprocess` off the
production compile path, and makes it obvious that benchmarks are not built or run by default.
See [Benchmarks in CI](10-benchmarks-in-ci.md) for what to do with that module afterwards.

## IDEs: possible, discouraged, and the reason

> *"Running benchmarks from the IDE is generally not recommended due to generally uncontrolled
> environment in which the benchmarks run."*

The README's own steps for those who insist: import the archetype-generated Maven project
(*"IDEA and NetBeans are able to build JMH benchmark projects with little to no effort.
Eclipse build configuration may need to set up JMH annotation processors to run"*), and drive
the run through the Java API:

```java
public static void main(String[] args) throws RunnerException {
    Options opt = new OptionsBuilder()
            .include(JMHSample_08_DeadCode.class.getSimpleName())
            .forks(1)
            .build();

    new Runner(opt).run();
}
```

⚠️ **Every sample carries that `main` method, and every sample also carries the
command-line invocation as option (a).** The API is for automation and IDE convenience; the
`-jar` run is the supported measurement path. ⚠️ The README also notes that some IDEs need an
explicit build step before running — *"adding Maven target `verify` should help there"* —
because a stale build silently runs yesterday's generated harness.

## Other build systems

> *"JMH project does not ship the build scripts for build systems other that Maven. But there
> are community-supported bindings"*

— the **Gradle JMH Plugin** (`melix/jmh-gradle-plugin`) and the **Scala SBT plugin**
(`ktoso/sbt-jmh`), plus an **Ant sample** in the JMH repository describing the steps for a
manual build. 🔴 **"Community-supported" is a real caveat**: when a result looks wrong under
Gradle, the README's diagnostic is to reproduce it in a clean archetype-generated Maven
project before concluding anything about JMH or about your code. Phase 8 owns build tooling;
this topic only cares that the annotation processor runs and the jar is self-contained.

## Versions

The newest `jmh-core` release published to Maven Central is **1.37**. ⚠️ **`jmh-core` and
`jmh-generator-annprocess` must move together** — the archetype pins both from one property,
which is another reason to start from it rather than hand-assemble the two dependencies.

The README's escalation path when something is wrong is worth internalising, because it is
also good general advice: check you are on the latest version, regenerate a clean archetype
project and transplant the benchmark, then search the mailing-list archives, and only then
report a bug (OpenJDK Bug System, project `CODETOOLS`, component `tools`, sub-component
`jmh`).

## Gotchas

🔴 **Generating the archetype inside an existing Maven project is explicitly unreliable.**
Generate into an empty directory and move the result where you want it.

🔴 **`mvn clean install` appears in the samples' run instructions and `mvn clean verify` in
the README's.** Either produces the jar; `verify` is the smaller hammer and does not publish
anything to your local repository. Do not substitute `mvn package` on a hand-rolled build
without checking the shade plugin is bound to it.

⚠️ **Running `java -cp … org.openjdk.jmh.Main` against your application classpath is not
equivalent to the self-contained jar.** Classpath ordering and missing generated resources
are the usual failures, and they surface as "no benchmarks found".

⚠️ **"No matching benchmarks" almost always means the annotation processor did not run.**
Check that `jmh-generator-annprocess` is on the annotation processor path and that the
generated sources directory is non-empty before suspecting your regex.

⚠️ **Benchmarks in the production module leak the annotation processor into every build.**
It slows compilation for everyone and makes it possible to ship benchmark classes in the
application jar.

⚠️ **A benchmark module must depend on the *published* artifact shape you actually ship.**
If production is a Spring Boot fat jar with a relocated layout, benchmark against the plain
library jar — otherwise you are also measuring the loader. Topic 10 owns that distinction.

⚠️ **IDE run configurations are the most common source of "it was fast on my machine".** The
IDE may attach an agent, run with a debugger port open, or reuse a warm JVM. The README's
"uncontrolled environment" is not hypothetical.

## Interview questions

**★ Why does JMH recommend a standalone project rather than a source set in your app?**
Because the benchmark should depend on your application the way anything else does — on its
jar — which keeps initialisation correct and results reliable, keeps the annotation processor
off the production build, and prevents the benchmark from compiling against internals it
would not otherwise see.

**★ What does the archetype actually give you?**
The supported build configuration: the annotation processor wired up and the shading that
produces a self-contained executable `benchmarks.jar`. The README calls archetypes *"the
primary mechanism used to bootstrap the project that has the proper build configuration"* and
strongly recommends them for new users.

**★ A colleague reports "no benchmarks found" after adding `@Benchmark`. Where do you look
first?**
At whether the annotation processor ran — is `jmh-generator-annprocess` on the processor
path, and does `target/generated-sources/annotations/` contain generated classes? Missing
generation, not the include regex, is the usual cause.

**★ Is running benchmarks from an IDE wrong?**
Not impossible, but discouraged: the README calls the IDE environment *"generally
uncontrolled"* and says results are less reliable. If you must, import the archetype project,
drive it through `Runner`/`OptionsBuilder`, and make sure a build (`verify`) runs first so
you are not executing a stale harness.

**★ How do you run JMH from Gradle?**
Through the community-supported Gradle JMH plugin — JMH itself ships build scripts only for
Maven. Because the binding is community-supported, the first diagnostic for a strange result
is to reproduce it in a clean archetype-generated Maven project.

**★ Which JMH artifacts must be version-matched, and why?**
`jmh-core` and `jmh-generator-annprocess`. The generated harness code is produced by the
processor and executed by the core; a mismatch produces obscure failures, which is why the
archetype pins both from a single version property.

**★ What is the README's recommended escalation path for a suspicious result?**
Read the annotation javadocs and samples, get the benchmark peer-reviewed, upgrade to the
latest JMH, regenerate a clean archetype project and transplant the benchmark into it, search
the mailing-list archives, and only then report a bug against `CODETOOLS`/`tools`/`jmh`.

Next: [The annotations](04-the-annotations.md).

{/* FOOTER */}
