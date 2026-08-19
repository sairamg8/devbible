---
title: "The effective POM and properties"
sidebar_label: "3 · Effective POM, properties"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Apache Maven POM Reference
> (maven.apache.org/pom.html — the Super POM, the five property types,
> profiles), the Maven Help Plugin site (`help:effective-pom`,
> `help:effective-settings`), the maven-compiler-plugin 3.15.0 site
> (`release` parameter, user property `maven.compiler.release`,
> `source`/`target` still defaulting to `1.8`), and "What's new in
> Maven 4" (consumer POM, native CI-friendly versions, condition-based
> profile activation, `--fail-on-severity`).

**The POM you are reading is an *input*, not the build. Maven merges the
Super POM, the whole parent chain, your file and every active profile
into one **effective POM**, interpolates properties over it, and executes
that. Every "who told it to do that?" — the plugin version you never
chose, the source directory nobody configured, the repository you never
added — is answered by reading the effective model instead of the file.
Reaching for `mvn help:effective-pom` first is the single habit that
separates people who debug Maven from people who delete `~/.m2` and
hope.**

## The Super POM

Every POM implicitly inherits from a **Super POM** shipped inside Maven
itself — the `java.lang.Object` of the build model. It supplies
`src/main/java`, `src/test/java`, `target/classes`, Maven Central as a
repository, the `release` profile, and a set of **default plugin
versions**. You will never see it in your project, and it is responsible
for a large share of Maven's apparent telepathy.

The default plugin versions are the part that bites. They make a
three-line POM work, and they make your build a function of *which Maven
binary ran it* — upgrade Maven, get a different jar plugin, get a
different manifest, with no commit anywhere. Maven 4 now **warns** when
a build relies on a Super POM plugin version, which is the strongest
available hint that you were always meant to pin them yourself
([chunk 7](07-the-management-sections.md)).

## The merge order

The effective POM is produced by merging, in order:

1. the Super POM;
2. the parent chain, **root-most first**, each child overriding;
3. your own `pom.xml`;
4. active profiles — from the POM, from `settings.xml`, or `-P`;
5. property interpolation across the whole result.

```bash
mvn help:effective-pom                    # the merged model, to stdout
mvn help:effective-pom -Doutput=eff.xml   # to a file, so you can diff it
mvn help:effective-settings               # the settings half: mirrors, servers, profiles
mvn -X verify                             # debug: resolution decisions, plugin versions
```

🔴 **Diff the effective POM, not the POM.** Between two branches, or
between your laptop and CI, `diff` over two `-Doutput=` files resolves
most mystery build differences in one read — and it catches exactly the
class of problem that is invisible in a `git diff`, because the change
lived in a parent, a profile, or a `settings.xml` nobody committed.

## `settings.xml` is the other input, and it is not in the POM

`~/.m2/settings.xml` (and `$MAVEN_HOME/conf/settings.xml`) contributes
mirrors, server credentials, proxies, the local repository location and
its own profiles. It is *machine-local and uncommitted by design*, which
makes it both the right place for secrets and the wrong place for
anything that affects the output.

The failure it produces is characteristic: a build that works on one
laptop and nowhere else, with no difference in the repository. `mvn
help:effective-settings` is the diagnostic, and the rule is simple —
credentials and mirrors in `settings.xml`, everything that shapes the
artifact in the POM.

## Properties

Five kinds are readable as `${...}`:

| Kind | Example | Source |
|---|---|---|
| custom | `${jackson.version}` | your `<properties>` block |
| `project.*` | `${project.version}`, `${project.build.directory}` | any POM element by dot path |
| `settings.*` | `${settings.offline}` | `settings.xml` |
| `env.*` | `${env.PATH}` | environment, **normalised to upper case on every platform** |
| system | `${java.home}`, `${user.home}` | JVM system properties, including anything you pass with `-D` |

```xml
<properties>
  <maven.compiler.release>25</maven.compiler.release>
  <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  <jackson.version>2.22.0</jackson.version>
</properties>
```

The first two lines are the load-bearing ones in a real project.

**`maven.compiler.release`** is the *user property* of the compiler
plugin's `release` parameter, so setting it configures the plugin with
no `<plugin>` block at all. It is the correct modern replacement for the
`source`/`target` pair, which still default to **`1.8`** in
maven-compiler-plugin 3.15.0 if you set nothing — a default that quietly
compiles a Java 25 codebase against Java 8 language rules until someone
uses a record. `release` also does what `source`+`target` never did: it
checks your code against that version's *API*, so calling a method added
in 21 fails at compile time instead of at runtime on the target JVM
([phase 0 topic 03](../../phase-0-platform-jvm/03-release-model.md)).

**`project.build.sourceEncoding`** matters because several plugins
otherwise fall back to the platform default charset and warn about it;
on a mixed fleet that is a genuine source of corrupt resources
([phase 7 topic 03](../../phase-7-io-time-stdlib/03-streams-buffers-charsets.md)
covers what actually goes wrong at the decode boundary).

Precedence is worth memorising: a child's redefinition beats an
inherited property, and `-Djackson.version=2.21.0` on the command line
beats both. That is what makes properties the standard hook for a CI
override or a one-off local experiment — and also why a property whose
name collides with something Maven or a plugin already reads will
misbehave in ways that are hard to trace. Namespace your custom
properties (`acme.something`), and never invent a name starting with
`maven.`.

## CI-friendly versions

```xml
<version>${revision}</version>
```

Maven 3.5+ supports this only partially: the placeholder must be
resolved before the POM is published, which is exactly what the Flatten
Plugin exists for — publish an unflattened one and every consumer
resolves `${revision}` against *their* build, which is nonsense. Set the
value on the command line (`-Drevision=4.0.1`) or in
`.mvn/maven.config`.

**Maven 4 supports it natively**: the flattened **consumer POM** it
publishes already carries the resolved value, so the Flatten Plugin
workaround disappears. This is the clearest single example of what the
consumer POM is *for* — a build-time model that is convenient to write,
and a published model that is safe to consume.

## Profiles, and when the declarative model is the wrong tool

Be honest about the cost. A POM cannot express "if this is the release
branch, sign the artifact" without profile activation, and profiles
scale badly. Activation is by property, JDK, OS or file presence
(Maven 4 adds richer `<condition>` activation with property comparison
and logical operators, plus optional profiles via `-P?name` that do not
fail when absent). A POM with nine interacting profiles is a build
nobody can read and nobody can test, because the combination CI runs is
never the combination anyone runs locally.

Builds with genuine logic — code-generation matrices, multi-target
native artifacts, custom packaging pipelines — fight Maven the whole
way, and that is the strongest honest argument for Gradle
([Gradle](../04-gradle/README.md), topic 04).

The counter-argument is equally real, and it is why Maven still wins by
volume: **a declarative POM is analysable without running it.**
Dependabot, SBOM generators, repository scanners, IDE import and the
entire supply-chain toolchain read your POM statically. A build script
that must be executed to reveal its own dependency graph cannot offer
that, and the gap looks academic right up to the week a CVE lands and
someone asks which of four hundred repositories are affected.

## Gotchas

**Symptom:** the build behaves differently after a Maven upgrade, with no commit
**Cause:** a plugin version inherited from the Super POM, which ships inside the Maven distribution
**Fix:** pin every plugin version in `<pluginManagement>`; on Maven 4, the new warning and `-Dmaven.plugin.validation=verbose` surface the ones you missed

**Symptom:** a property set in `settings.xml` works locally and vanishes in CI
**Cause:** `settings.xml` profiles are machine-local; the CI agent has a different file, or none
**Fix:** anything affecting the build output belongs in the POM; keep `settings.xml` for credentials and mirrors

**Symptom:** a Java 25 codebase compiles but rejects a record or a switch pattern
**Cause:** neither `maven.compiler.release` nor `source`/`target` was set, so the compiler plugin used its `1.8` defaults
**Fix:** set `<maven.compiler.release>25</maven.compiler.release>`; prefer it to `source`+`target` because it also validates against the target API

**Symptom:** a published POM contains a literal `${revision}` and consumers cannot resolve it
**Cause:** CI-friendly versions on Maven 3 without the Flatten Plugin
**Fix:** flatten before deploying on Maven 3; Maven 4's consumer POM resolves it natively

**Symptom:** a custom property is ignored or takes a value nobody set
**Cause:** the name collides with a plugin's user property or a system property
**Fix:** namespace custom properties (`acme.report.dir`) and never start one with `maven.`; `help:effective-pom` shows the interpolated value that actually won

**Symptom:** `${env.PATH}` works on Linux and `${env.Path}` does not work on Windows
**Cause:** environment property names are normalised to upper case on every platform
**Fix:** always write them upper case

**Symptom:** a resource file ends up with mangled characters on one developer's machine only
**Cause:** no `project.build.sourceEncoding`, so plugins used that machine's platform default charset
**Fix:** set it to `UTF-8` in the parent's `<properties>`; this is the one property worth adding to a POM before anything else

## Interview questions

**★ What is the effective POM, and why is it the first thing you look at?**
The merged model of Super POM + parent chain + your POM + active
profiles, with properties interpolated — the thing Maven actually
executes. Your file is one input among several.
`mvn help:effective-pom` prints it, and diffing it between two
environments explains most "works on my machine" builds in one step.

**★ Where do `src/main/java` and Maven Central come from, given they are in nobody's POM?**
The Super POM, built into the Maven distribution, which every POM
implicitly inherits. It also supplies default plugin versions — which
makes small POMs work and makes builds depend on the Maven binary, so
pin them. Maven 4 warns when a build relies on a Super POM version.

**★ How would you investigate a plugin behaving differently after a Maven upgrade?**
Compare `help:effective-pom` before and after. If the plugin has no
version in the POM or in `<pluginManagement>`, the value came from the
Super POM inside the distribution, so upgrading Maven changed it. The
fix is to pin the plugin, not to pin Maven.

**★ `maven.compiler.release` vs `source` and `target` — why does it matter which you use?**
`source`/`target` only control language level and bytecode version; you
can still compile against JDK 25's API and produce a class file that
fails at runtime on a Java 17 JVM. `release` passes `javac --release`,
which validates against that version's *API* too. It is also a user
property, so one line in `<properties>` configures the plugin with no
`<plugin>` block. Both default to `1.8` in maven-compiler-plugin 3.15.0
if you set nothing, which is a silent trap on a modern codebase.

**★ What belongs in `settings.xml` and what does not?**
Credentials, mirrors, proxies and the local repository location. Nothing
that shapes the artifact — because the file is machine-local and
uncommitted, so anything build-affecting there produces a build that is
reproducible on exactly one laptop. `help:effective-settings` is the
diagnostic.

**★ What is the property precedence, and why does it matter?**
Command-line `-D` beats a child POM's definition, which beats an
inherited one. That ordering is what makes properties the standard
override hook for CI. The corollary is that a custom property whose name
collides with a plugin's user property will be silently overridden by
something you did not set — so namespace them.

**★ What problem do CI-friendly versions solve, and what did they cost on Maven 3?**
They let one version value be injected at build time (`${revision}`)
instead of being committed, so a pipeline can stamp a build number
without touching the POM. On Maven 3 the published POM must have the
placeholder resolved first, which needed the Flatten Plugin; Maven 4's
consumer POM does it natively.

**★ When is Maven's declarative model actively the wrong choice, and what do you give up by leaving?**
When the build genuinely needs logic — generation matrices, multi-target
native artifacts, custom packaging — profiles become an untestable
combinatorial mess. What you give up by moving to an imperative build is
static analysability: the dependency graph can be read without executing
anything, which dependency bots, SBOM tooling and IDE import all rely
on.

**★ You inherit a repository where CI passes and your machine fails on the same commit. First three commands?**
`mvn help:effective-pom -Doutput=` on both sides and diff;
`mvn help:effective-settings` to catch a mirror or a local profile; and
`mvn -X` on the failing goal to see which plugin version and which
artifact actually resolved. All three answer "what is different", which
is the only question worth asking before changing anything.

---

← Prev: [Inheritance and aggregation](02-inheritance-and-aggregation.md) · Index: [Maven core](README.md) · Next → [The lifecycle](04-the-lifecycle.md)
