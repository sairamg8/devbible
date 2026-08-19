---
title: "Diagnostics, governance and Maven 4"
sidebar_label: "9 · Diagnostics and Maven 4"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the maven-dependency-plugin site
> (`tree`, `analyze` — which forks `test-compile` — and `analyze-only`),
> the maven-enforcer-plugin site (built-in rules), the
> maven-source-plugin, maven-javadoc-plugin and maven-gpg-plugin sites,
> and "What's new in Maven 4" (maven.apache.org/whatsnewinmaven4.html —
> Plexus removal, JSR-330, the experimental Maven 4 plugin API and
> maven-compiler-plugin 4.x, official Maven BOMs,
> `-Dmaven.plugin.validation=verbose`, `--fail-on-severity`, `mvnup`,
> `mvnsh`, `mvnenc`, Maven Resolver 2.0) and the Maven download page
> (4.0.0-rc-6, Java 17 required, not for production).

**Everything so far describes a build that works. This chunk is about
the build that does not, and about stopping the class of problem
recurring: the three goals that tell you what actually resolved, the
plugin that turns a convention into a build failure, and what Maven 4
demands of the plugins you already depend on. Diagnosis first, then
governance — in that order, because a rule enforced before the problem
is understood is just a rule people learn to bypass.**

## The diagnostic goals

```bash
mvn dependency:tree                        # what actually resolved, and why
mvn dependency:tree -Dincludes=com.fasterxml.jackson.core:*
mvn dependency:analyze                     # declared-but-unused, used-but-undeclared
mvn versions:display-dependency-updates    # what has moved upstream
mvn versions:display-plugin-updates
mvn help:effective-pom                     # the merged model (chunk 3)
```

`dependency:tree` answers nearly every version question and runs without
compiling, which makes it the right first command on a build that is
already broken. `-Dincludes` narrows a thousand-line graph to the one
library you care about, and is the difference between using the goal and
scrolling past it.

`dependency:analyze` forks `test-compile` (chunk 5) because it inspects
bytecode, and reports two things:

- **Used but undeclared** — your code compiles against a *transitive*
  dependency. It works today and breaks the day the intermediate library
  drops it, producing a `NoClassDefFoundError` from an upgrade you did
  not make and cannot easily connect to the cause. This is the finding
  that matters; treat every entry as a missing declaration.
- **Declared but unused** — dead weight, and attack surface you are
  carrying for nothing. Less urgent, and more prone to false positives:
  a dependency used only via reflection, an annotation processor, or a
  runtime SPI implementation will be reported and must not be removed.

That false-positive rate is the honest caveat. `analyze` is a report to
read, not a gate to enforce, until you have annotated the exceptions.

## versions — reading upstream, and rewriting POMs

The `versions-maven-plugin` (`org.codehaus.mojo`) has two very different
halves, and conflating them is how people lose an afternoon.

The **read-only** half is safe and belongs in a scheduled job:

```bash
mvn versions:display-dependency-updates
mvn versions:display-plugin-updates
mvn versions:display-property-updates
```

The **rewriting** half edits your POMs in place:

```bash
mvn versions:set -DnewVersion=2.5.0    # rewrites the version across the reactor
mvn versions:revert                    # undo, from the backup files
mvn versions:commit                    # accept, deleting the backups
```

`versions:set` writes `pom.xml.versionsBackup` next to every POM it
touches, and those files stay until you `commit` or `revert`. Leaving
them behind is untidy on a laptop and actively confusing in CI, where a
later step may read a POM whose backup nobody cleaned up. Either
complete the cycle or use git as your undo and add the backup files to
`.gitignore`.

The judgement here is worth stating: **automatic version bumping is not
the same as staying current.** A tool that rewrites versions with no
review and no test run moves the problem rather than solving it.
Dependabot or Renovate raising a pull request — pinned version in, CI
run, human review — is the shape that actually works, and it is topic
07's subject.

## enforcer — turning conventions into build failures

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-enforcer-plugin</artifactId>
  <version>3.5.0</version>
  <executions>
    <execution>
      <id>enforce-rules</id>
      <goals><goal>enforce</goal></goals>
      <configuration>
        <rules>
          <requireMavenVersion><version>[3.9,)</version></requireMavenVersion>
          <requireJavaVersion><version>[25,)</version></requireJavaVersion>
          <requireReleaseDeps/>
          <banDuplicatePomDependencyVersions/>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

Every rule replaces a convention nobody remembers with a failure that
explains itself. `requireJavaVersion` and `requireMavenVersion` turn a
wrong toolchain into an immediate, readable error instead of a confusing
compiler message three phases later. `requireReleaseDeps` enforces
chunk 1's rule that nothing releasable depends on a snapshot.
`bannedDependencies` is how you keep a driver or a logging backend out
of modules that must not have it (chunk 2).

`dependencyConvergence` is the rule teams argue about, and the argument
is legitimate: it fails the build whenever two paths reach different
versions of one artifact, which on a large graph is *most days*. Run it
as a report, converge the graph with a BOM (chunk 7), and only then make
it a gate — a rule people routinely disable with `-Denforcer.skip` is
worse than no rule, because it teaches everyone the flag.

## The publishing plugins

`maven-source-plugin` and `maven-javadoc-plugin` attach the `sources`
and `javadoc` classifiers that consumers' IDEs look for (chunk 1);
`maven-gpg-plugin` signs artifacts, which Maven Central requires. Put
all three in a `release` profile rather than the main build — otherwise
every local `install` pays for javadoc generation and stops to ask for a
signing key, and the people who feel that cost are the ones who did not
choose it.

Maven 4 also replaces Maven 3's password *obfuscation* with a real
encryption tool, **`mvnenc`**, which supports decryption and external
vaults. Maven 3's `settings.xml` "encryption" was never a security
boundary; treating it as one is a mistake worth un-learning before you
migrate.

## What Maven 4 demands of plugins

- **Plexus dependency injection is removed** (deprecated since Maven
  3.2). Plugins must use Maven 3+ APIs with **JSR-330** annotations; one
  that still relies on Plexus will not run at all.
- **A new Maven 4 plugin API** exists and is experimental in 4.0.0 —
  maven-compiler-plugin **4.x** is the published example written against
  it.
- **Rely only on the official Maven BOMs** when building a plugin;
  hand-mixing `maven-core`, `maven-model` and friends is exactly what
  that BOM exists to prevent.
- **Warnings by default** on Super POM plugin versions and on plugin
  validation problems, with `-Dmaven.plugin.validation=verbose` for
  detail and `--fail-on-severity WARN` to make them fatal.
- **Maven Resolver 2.0** underneath, with a native Java HTTP client
  (JDK 17+) replacing the previous transport.

**The practical consequence: plugins block a Maven 4 migration, not
POMs.** `mvnup` migrates POM shape and reports deprecated constructs; it
says nothing about a plugin's internals. Audit in-house and
long-abandoned plugins first, because that is where the work is.

## The state of Maven 4, stated plainly

Maven 4 is at **4.0.0-rc-6** and the download page says release
candidates are not suitable for production. It requires **Java 17** to
run Maven itself, independent of what you compile. Everything this topic
attributes to Maven 4 comes from the project's own "What's new"
documentation, not from a migration anyone here performed — treat it as
what is coming and as context for warnings an RC may emit, and pilot it
on a low-stakes repository before believing any timeline.

## Gotchas

**Symptom:** the application fails at runtime with `NoClassDefFoundError` after a routine dependency upgrade
**Cause:** the code compiled against a transitive dependency the upgraded library no longer brings
**Fix:** `dependency:analyze`, then declare everything you actually use — this is precisely the failure it exists to predict

**Symptom:** `dependency:analyze` flags a dependency you know is needed
**Cause:** it is used reflectively, as an annotation processor, or as a runtime SPI implementation — none of which appear in bytecode references
**Fix:** treat the report as advisory; do not automate removals from it

**Symptom:** `mvn install` locally stops and prompts for a GPG passphrase
**Cause:** the signing plugin is in the main build rather than a release profile
**Fix:** move `gpg`, `source` and `javadoc` into a profile activated only for releases

**Symptom:** `dependencyConvergence` makes the build unfixable overnight and everyone learns `-Denforcer.skip`
**Cause:** it is genuinely strict — any two paths to different versions of one artifact fail it
**Fix:** report first, converge with a BOM, gate last. A rule people habitually skip is worse than no rule

**Symptom:** an in-house plugin fails to load on Maven 4 with an injection error
**Cause:** it was written against Plexus, which Maven 4 removed
**Fix:** port it to JSR-330 and the Maven 3+ APIs; there is no compatibility shim

**Symptom:** stray `pom.xml.versionsBackup` files appear across the repository
**Cause:** `versions:set` was run and neither `versions:commit` nor `versions:revert` followed
**Fix:** complete the cycle, or treat git as the undo and ignore the backups; never leave them for CI to trip over

**Symptom:** `dependency:tree` output is a thousand lines and tells you nothing
**Cause:** you read it instead of querying it
**Fix:** `-Dincludes=<groupId>:<artifactId>` to show only the paths that reach the artifact in question

**Symptom:** credentials in `settings.xml` were treated as encrypted and turn out to be recoverable
**Cause:** Maven 3's password support is obfuscation, not encryption — the master password is on the same machine
**Fix:** treat `settings.xml` secrets as plaintext for threat-modelling purposes; use a CI secret store, and `mvnenc` with an external vault once on Maven 4

## Interview questions

**★ What does `dependency:analyze` tell you that `dependency:tree` does not?**
Tree shows what resolved; analyze compares that against your bytecode —
**used but undeclared** (compiling against a transitive, which breaks on
someone else's upgrade) and **declared but unused**. It forks
`test-compile` because it needs compiled classes; `analyze-only` is the
non-forking variant for binding into a build.

**★ Why is "used but undeclared" the dangerous one?**
Because the build is green and the failure is deferred to an unrelated
future upgrade, which is the hardest kind of bug to attribute. Your code
depends on something no POM records, so nothing warns when the
intermediate library stops supplying it.

**★ Give three enforcer rules worth having from day one.**
`requireJavaVersion` and `requireMavenVersion` so a wrong toolchain
fails immediately with a readable message; `requireReleaseDeps` so
nothing releasable depends on a snapshot; and `bannedDependencies` to
keep a driver or logging backend out of modules that must not have it.
`dependencyConvergence` only after the graph has been converged.

**★ Why can a good enforcer rule make things worse?**
Because a gate that fires constantly gets skipped, and once a team
learns `-Denforcer.skip` it applies to every rule, including the ones
that were catching real problems. Introduce strict rules as reports
first and gate only what the codebase already satisfies.

**★ Where should `gpg`, `source` and `javadoc` be configured, and why?**
In a release profile. In the main build they slow every local `install`
and make signing interactive for people who are not releasing anything —
cost imposed on developers by a decision that belongs to the release
pipeline.

**★ The versions plugin has a read half and a write half. Why does the distinction matter?**
`display-*` goals only report and are safe to schedule. `versions:set`
rewrites every POM in the reactor and leaves `pom.xml.versionsBackup`
files until you `commit` or `revert`. Running the second kind casually
edits your source tree, and half-completed runs leave artefacts a later
build may read.

**★ Is automatic dependency bumping a good idea?**
Bumping is not the same as staying current. A tool that rewrites
versions without a test run and a review has moved the risk, not removed
it. The working shape is a bot that raises a pull request against a
pinned version so CI and a human both see it before it lands.

**★ What would block a Maven 4 migration in a large codebase?**
Plugins, not POMs. Maven 4 removed Plexus injection, so anything built
on it fails to load, and in-house or abandoned plugins are the usual
casualties. `mvnup` migrates POM shape and says nothing about plugin
internals, so audit those first.

**★ How much should you trust `settings.xml` password encryption on Maven 3?**
Not at all as a security boundary — it is obfuscation, with the master
password on the same machine. Treat those values as plaintext when
threat-modelling, keep real secrets in the CI provider's store, and use
Maven 4's `mvnenc` with an external vault when you get there.

**★ Someone asks whether to adopt Maven 4 now. What do you tell them?**
That it is at release-candidate status and the project itself says RCs
are not for production, that it requires Java 17 to run, and that the
migration risk is concentrated in plugins rather than POMs. Pilot it on
a low-stakes repository, run `mvnup`, turn on
`-Dmaven.plugin.validation=verbose`, and treat the findings as the real
estimate.

---

← Prev: [The plugins every build has](08-the-plugins-every-build-has.md) · Index: [Maven core](README.md) · Next → [Dependency scopes](../02-dependency-scopes/README.md)
