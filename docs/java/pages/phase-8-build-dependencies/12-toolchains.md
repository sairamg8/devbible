---
title: "Toolchains"
sidebar_label: "12 · Toolchains"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Maven "Guide to Using Toolchains"
> (maven.apache.org) and the Maven Toolchains Plugin documentation; the Gradle
> user guide chapters "Toolchains for JVM projects" and "Toolchain Resolver
> Plugins" (docs.gradle.org); and the `gradle/foojay-toolchains` resolver
> plugin documentation (plugins.gradle.org,
> `org.gradle.toolchains.foojay-resolver-convention`, 1.0.0, requiring
> Gradle 7.6+ and Java 17+).

**The JDK that runs your build tool and the JDK you want to compile and test
against are two different choices, and conflating them is why "works on my
machine" survives into 2026. A toolchain separates them: the build tool runs
on whatever JDK started it, and forks compilation, tests and Javadoc onto a
JDK you named. Gradle's version of this travels with the repository; Maven's
does not, and that difference is the whole practical story.**

## The problem, stated plainly

Maven and Gradle are Java programs. They run on some JDK — whatever
`JAVA_HOME` pointed at, or whatever your version manager last switched to.
Without further configuration, that same JDK compiles your code and runs your
tests. So:

- A developer on JDK 25 and a CI agent on JDK 21 are running genuinely
  different compilers over the same source, and only one of them will find the
  problem.
- A repository with several services targeting different Java versions cannot
  be built in one pass.
- `--release` ([topic 11](11-javac-flags/README.md)) constrains the *API and
  bytecode* but does nothing about which compiler binary, or which JVM your
  **tests** execute on — and tests are where JDK behaviour differences
  actually surface.

The workaround everyone uses first is `JAVA_HOME` juggling: `sdk use java …`,
a `.sdkmanrc`, a CI step that installs a specific JDK, a wiki page nobody
reads. It works, and it is unenforced — nothing fails when someone skips it,
it just produces a different artifact.

## Maven toolchains

Maven's mechanism is a per-machine registry plus a plugin that selects from
it. The registry is `~/.m2/toolchains.xml` (an alternate path is available via
`--global-toolchains` since Maven 3.3.1):

```xml
<toolchains>
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>21</version>
      <vendor>temurin</vendor>
    </provides>
    <configuration>
      <jdkHome>/opt/jdks/temurin-21</jdkHome>
    </configuration>
  </toolchain>
</toolchains>
```

The POM states a *requirement*, and `maven-toolchains-plugin` matches it
against that file, storing the result in the session for toolchain-aware
plugins to pick up:

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-toolchains-plugin</artifactId>
  <version><!-- pin the current release --></version>
  <executions>
    <execution><goals><goal>toolchain</goal></goals></execution>
  </executions>
  <configuration>
    <toolchains>
      <jdk><version>21</version><vendor>temurin</vendor></jdk>
    </toolchains>
  </configuration>
</plugin>
```

Toolchain-aware plugins include `maven-compiler-plugin`,
`maven-surefire-plugin`, `maven-failsafe-plugin`, `maven-javadoc-plugin` and
`maven-jarsigner-plugin`. Anything not on that list — and Maven core itself —
still runs on the launching JDK.

**The weakness is the file.** `toolchains.xml` is per developer and per agent.
It is not in the repository, so the POM's requirement is a promise the
repository cannot keep: a clone on a machine without a matching entry does not
silently fall back, it **fails**. That is the right behaviour — a silent
fallback would defeat the point — but it means onboarding, every CI image, and
every new agent must provision the file, and the error a newcomer sees is
about a missing toolchain rather than about anything they did. Teams end up
generating `toolchains.xml` in a setup script or a container image, which is
the same JDK-installation problem moved one level down.

## Gradle toolchains

Gradle puts the declaration **in the build script**, which is the substantive
difference:

```kotlin
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
        vendor = JvmVendorSpec.ADOPTIUM      // optional
    }
}
```

Because it is in `build.gradle.kts`, it travels with the repository and is
versioned with it. Every clone, every agent, every IDE import gets the same
requirement without out-of-band setup. Gradle then configures **all compile,
test and Javadoc tasks** to use that JDK, forking as needed; per-task
overrides exist (`javaCompiler`, `javaLauncher`, `javadocTool`) for the case
where one module genuinely differs.

Gradle finds JDKs by **auto-detection** — `JAVA_HOME`, version managers such
as SDKMAN and asdf, IDE-installed JDKs, and, neatly, entries in Maven's own
`toolchains.xml`. If nothing matches, it can **auto-provision**: download a
matching JDK. That requires a toolchain resolver, conventionally the foojay
plugin, applied in `settings.gradle.kts` because it is a settings plugin:

```kotlin
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}
```

Auto-provisioned JDKs are cached under `~/.gradle/jdks`. The knobs are
`org.gradle.java.installations.auto-download=false`,
`…auto-detect=false`, and `org.gradle.java.installations.paths` to point at
pre-installed locations.

**Auto-download is a supply-chain decision, not a convenience.** A build that
provisions its own JDK is a build that fetches and then *executes* a
compiler and runtime resolved through a third-party API. That is a strictly
larger trust boundary than a jar on the classpath, and it is not covered by
Gradle's dependency verification. In a locked-down organisation the honest
configuration is: `auto-download=false`, JDKs pre-installed on agents and in
base images (or served from an internal mirror), and the toolchain block kept
so the *requirement* is still declared and still enforced. In a small OSS
project, auto-download removes a whole class of contributor friction and is
worth it. Decide it deliberately; the default is on.

## How it composes with `--release` and with the wrapper

Three independent pins, and mature builds use all three:

| Pin | Mechanism | Answers |
|---|---|---|
| **Build tool version** | wrapper — `./mvnw`, `./gradlew` | which Maven/Gradle runs |
| **JDK** | toolchain | which compiler compiles and which JVM runs the tests |
| **API and bytecode level** | `--release` / `options.release` | which Java SE API you may call and what class-file version you emit |

They are not substitutes. A toolchain alone lets you compile on JDK 25 and
emit Java 25 bytecode that will not load on your Java 21 runtime. `--release`
alone constrains the API but leaves the actual compiler and, crucially, the
**test JVM** as whatever the machine had. The wrapper pins neither. The common
correct combination for a service that runs on Java 21 while the team develops
on 25 is: wrapper pinning Gradle, toolchain 21 (so tests run on the real
runtime), and `release` 21.

Wrappers are covered in **Wrappers** *(not written yet)*; the short version is
that wrapper pins the build tool, toolchain pins the JDK, and neither implies
the other.

## When a toolchain is not worth it

For a single-module project where every developer and the CI image already run
the same JDK — enforced by a base image or a version-manager file everybody
actually uses — a toolchain adds a moving part without changing an outcome.
The costs are real: Maven's approach adds a per-machine file that can fail a
clean clone; Gradle's adds either a download step or a provisioning
requirement, plus a second JVM forked for compilation and tests, which is a
measurable slowdown on short builds. Adopt it when there is a genuine
divergence to control — more than one target version in the repo, a CI image
you do not own, or a runtime older than the JDK the team develops on.

## Gotchas

**Symptom:** a fresh clone fails immediately with "no matching toolchain found" and the developer changed nothing
**Cause:** Maven toolchains live in `~/.m2/toolchains.xml`, which is per machine and not in the repository
**Fix:** provision it in the onboarding script and the CI image; the failure is deliberate — a silent fallback to the launching JDK would defeat the mechanism — so fix the provisioning, not the requirement

**Symptom:** the Maven toolchain is configured but a code-generation or static-analysis plugin still runs on the wrong JDK
**Cause:** only toolchain-aware plugins consume the selected toolchain; Maven core and everything else run on the launching JDK
**Fix:** check whether the plugin supports toolchains at all; if not, the launching JDK must also be acceptable to it, which usually means running Maven itself on the newer JDK and letting the toolchain pull compilation down

**Symptom:** a Gradle build works locally and fails on an air-gapped agent with a toolchain provisioning error
**Cause:** auto-provisioning tried to download a JDK and there is no egress
**Fix:** pre-install the JDK and set `org.gradle.java.installations.paths`, or point the resolver at an internal mirror; set `auto-download=false` so the failure is a clear configuration error rather than a network timeout

**Symptom:** the toolchain is set to 21 but the artifact will not load on the Java 21 runtime
**Cause:** `release`/`targetCompatibility` was left at the default, so bytecode was emitted for the toolchain's own version — or the toolchain was set to 25 and only the tests were checked
**Fix:** set both — toolchain for the compiler and test JVM, `options.release`/`<release>` for the API and class-file level ([topic 11](11-javac-flags/README.md))

**Symptom:** builds got noticeably slower after adopting toolchains, with no other change
**Cause:** compilation and tests are now forked into a separate JVM instead of running in the build daemon
**Fix:** expected, and usually worth it; if the build is short enough that fork cost dominates, that is an argument for standardising the JDK instead of pinning it

**Symptom:** the same Gradle build resolves a different JDK on two machines despite an identical `languageVersion`
**Cause:** auto-detection found different vendors — one machine had Temurin, another a distribution installed by the IDE — and no `vendor` was specified
**Fix:** pin `vendor` if vendor actually matters (a JVM implementation difference, a licensing constraint); otherwise accept it, because `languageVersion` is the property the build depends on

## Interview questions

**★ What problem do toolchains solve that `--release` does not?**
`--release` constrains the API you may call and the class-file version you
emit, but it does not change which compiler binary runs, and it has no effect
on tests at all — they still execute on the JVM that launched the build. So
`--release 21` on a JDK 25 machine gives you Java 21-compatible bytecode
verified by a Java 25 compiler and exercised by a Java 25 runtime. A toolchain
pins the actual JDK used for compilation, tests and Javadoc, which is what
makes "we tested on the runtime we deploy to" true.

**★ Why is Gradle's toolchain configuration considered stronger than Maven's?**
Because of where it lives. Gradle declares the requirement in
`build.gradle.kts`, so it is versioned with the code and every clone, agent
and IDE import inherits it. Maven declares the requirement in the POM but
resolves it through `~/.m2/toolchains.xml`, a per-machine file that is not in
the repository — so the repository cannot make the build reproducible on its
own, and a machine without the file fails rather than building. Gradle can
also auto-provision a missing JDK; Maven cannot.

**★ Is failing on a missing toolchain the right behaviour?**
Yes. The alternative — falling back to whatever JDK launched the build — would
produce an artifact silently compiled against the wrong version, which is
precisely the failure the mechanism exists to prevent. A loud error at the
start of the build is cheap; a wrong artifact discovered in production is not.
The fix is to provision the toolchain in the image or setup script.

**★ Why is toolchain auto-provisioning a supply-chain decision?**
Because the build downloads and then executes a compiler and a runtime,
resolved through a third-party discovery API. That is a strictly larger trust
boundary than adding a dependency to the classpath, and it is not covered by
dependency verification. The defensible configurations are either
auto-download off with JDKs pre-installed or mirrored internally, or
auto-download on with a conscious decision that the convenience is worth the
exposure — which is often correct for a small open-source project and rarely
correct inside a regulated organisation.

**★ How do the wrapper, the toolchain and `--release` divide up the job?**
Three independent pins. The wrapper pins the *build tool* version, so
everyone runs the same Maven or Gradle. The toolchain pins the *JDK*, so
everyone compiles with the same compiler and runs tests on the same runtime.
`--release` pins the *API and bytecode level*, so you cannot call a method the
deployment target does not have. None implies another, and a build that wants
reproducibility sets all three.

**★ You develop on JDK 25 and deploy on Java 21. What do you configure?**
Toolchain `21` so compilation and — more importantly — tests run on the
runtime you actually deploy to, plus `release = 21` so the API surface and
class-file version match. The wrapper pins the build tool. Setting only
`release` would leave tests running on 25, which is where behavioural
differences (garbage collector defaults, library behaviour, new deprecations)
hide. Setting only the toolchain would still be fine here, since a JDK 21
compiler cannot emit Java 25 bytecode — but setting both makes the intent
explicit and survives someone later bumping the toolchain.

**★ How does Gradle find a JDK before deciding to download one?**
Auto-detection first: `JAVA_HOME`, version managers such as SDKMAN and asdf,
IDE-installed JDKs, common install locations, and — usefully in a mixed shop —
entries in Maven's `~/.m2/toolchains.xml`. Only when nothing matches the
requested `languageVersion` (and `vendor`, if specified) does it fall through
to a toolchain resolver such as the foojay plugin, which is applied in
`settings.gradle.kts` because it is a settings plugin. Both stages can be
disabled with `org.gradle.java.installations.auto-detect` and `…auto-download`.

---

← Prev: [`javac` flags that matter](11-javac-flags/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](README.md) · Next → **Phase 9 — Spring Boot and the web** *(not written yet)*
