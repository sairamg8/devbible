---
title: "The tracing agent writes metadata by watching a JVM run, which means its output is exactly as complete as the run that produced it — the agent is a coverage tool wearing a configuration tool's clothes"
sidebar_label: "03c · The tracing agent"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Collect Metadata with the Tracing Agent"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/AutomaticMetadataCollection/))
> and "Build Options" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/));
> the **Native Build Tools 1.1.1 Maven plugin** reference
> ([graalvm.github.io](https://graalvm.github.io/native-build-tools/latest/maven-plugin.html), source checked at tag `1.1.1`);
> the **Spring Boot reference**, "Advanced Native Images Topics"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/advanced-topics.html)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Native Build Tools 1.1.1**.
> Documentation-validated; **no sandbox run**.

**The tracing agent attaches to an ordinary JVM run, records every reflective lookup, resource read, proxy creation and serialization it observes, and writes the corresponding metadata files when the JVM exits. It is genuinely the fastest way to get a native build working. It is also the single most over-trusted tool in this topic, because the documentation's own caution — *"the agent observes only executed code"* — means the metadata you ship has exactly the coverage of the run you did, and nothing catches the gap until production.**

## Attaching it

> *"GraalVM provides a **Tracing Agent** to easily gather metadata and prepare configuration files. The agent tracks all usages of dynamic features during application execution on a regular Java VM."*

```bash
$JAVA_HOME/bin/java -agentlib:native-image-agent=config-output-dir=/path/to/config-dir/ -jar app.jar
```

🔴 **Position matters and the reference says so**: *"`-agentlib` must be specified *before* a `-jar` option or a class name or any application parameters as part of the `java` command."* Put it after `-jar` and it becomes an application argument, silently.

Output is written on exit:

> *"When the application completes and the JVM exits, the agent writes metadata to JSON files in the specified output directory."*

⚠️ **On exit.** A container killed with `SIGKILL`, a process that never terminates, or a `kill -9` in frustration produces nothing. Two options cover long-running services:

> *"- `config-write-period-secs=n`: writes metadata files every `n` seconds; `n` must be greater than 0.*
> *- `config-write-initial-delay-secs=n`: waits `n` seconds before first writing metadata; defaults to `1`."*

```bash
$JAVA_HOME/bin/java \
  -agentlib:native-image-agent=config-output-dir=/out/,config-write-period-secs=300,config-write-initial-delay-secs=5 \
  -jar app.jar
```

Multiple runs accumulate with `config-merge-dir=` instead of `config-output-dir=`, and the reference tells you why you will need it:

> *"It may be necessary to run the application more than once (with different execution paths) for improved coverage of dynamic features."*

Where the JVM command line is not yours to change — a start script, an embedded launcher — inject it through the environment, with placeholders so concurrent processes do not overwrite each other:

```bash
export JAVA_TOOL_OPTIONS="-agentlib:native-image-agent=config-output-dir=/out/config-{pid}-{datetime}/"
```

`{pid}` becomes the process id and `{datetime}` an ISO 8601 UTC timestamp.

## 🔴 Coverage is the whole story

The reference states the limitation in one sentence and then moves on; it deserves a page of its own:

> *"It is advisable to manually review the generated configuration files. Because the agent observes only executed code, the application input should cover as many code paths as possible."*

**Restate that as an engineering claim: the metadata you ship is a projection of your test coverage onto the dynamic-features axis.** An error branch that constructs a different exception type reflectively, an admin endpoint nobody exercised, a Jackson polymorphic subtype that only appears for one tenant, a locale that only European traffic requests — none of them are in the file, and none of them fail the build.

Two consequences follow, and both are actionable:

1. **Run the agent over your *tests*, not over a manual click-through.** Native Build Tools does it for you — `./mvnw -Pnative -Dagent=true test` attaches the agent to the Surefire execution and writes to `target/native/agent-output/test`. That makes coverage a number you already track.
2. **Then verify with the other end of the tooling.** Ship the metadata, build the image, and run the native tests with `-XX:MissingRegistrationReportingMode=Exit` ([03b](03b-reachability-metadata.md)) so an access the agent never saw fails loudly instead of silently. **The agent finds what ran; the reporting mode finds what did not.** Neither alone is enough.

## Filtering: two different filters, and people confuse them

By default the agent already excludes accesses that Native Image supports without configuration:

> *"By default, the agent filters dynamic accesses which Native Image supports without configuration. The filter mechanism works by identifying the Java method performing the access, also referred to as *caller* method, and matching its declaring class against a sequence of filter rules."*

**Caller filters** are about *where the access came from*; **access filters** are about *what was accessed*:

> *"Unlike the caller-based filters described above, which filter dynamic accesses based on where they originate, *access filters* apply to the *target* of the access. Therefore, access filters enable directly excluding packages and classes (and their members) from the generated configuration."*

Both use the same file shape:

```json
{ "rules": [
    { "excludeClasses": "org.junit.**" },
    { "excludeClasses": "org.testcontainers.**" },
    { "includeClasses": "com.example.**" }
  ],
  "regexRules": [
    { "includeClasses": ".*" },
    { "excludeClasses": ".*\\$\\$Generated[0-9]+" }
  ]
}
```

Rule semantics that matter: `.*` matches one package level, `.**` matches subpackages at any depth, a bare name matches one class, *"All rules are processed in the sequence in which they are specified, so later rules can partially or entirely override earlier ones"*, and *"The rules of the built-in caller filter are always processed first, so they can be overridden in custom filter files."* When a `regexRules` section is present, *"a class will be considered included if (and only if) both `rules` and `regexRules` include the class and neither of them exclude it."*

⚠️ **Do not disable the built-in filters.** `no-builtin-caller-filter` and `no-builtin-heuristic-filter` exist, and the reference is explicit that *"the resulting metadata files are generally unsuitable for the build"* and *"will also generally lead to less usable metadata files."* They are debugging switches.

**Access filters are how you make test-driven collection usable.** Spring Boot names the exact problem:

> *"The second option sounds more appealing for a repeatable setup, but by default the generated hints will include anything required by the test infrastructure. Some of these will be unnecessary when the application runs for real. To address this problem the agent supports an access-filter file that will cause certain data to be excluded from the generated output."*

So: collect from tests, and filter out JUnit, Testcontainers, Mockito and the assertion library, or you will ship metadata for your test harness inside your production binary.

## Native Build Tools does the wiring

The Maven plugin *"simplifies generation of the required configuration files by injecting the agent automatically for you"*, writing to `target/native/agent-output`. It is off by default:

```xml
<plugin>
  <groupId>org.graalvm.buildtools</groupId>
  <artifactId>native-maven-plugin</artifactId>
  <configuration>
    <agent>
      <enabled>true</enabled>
      <defaultMode>standard</defaultMode>
    </agent>
  </configuration>
</plugin>
```

or, per invocation, `-Dagent=true` (and `-Dagent=false` overrides a POM-enabled agent). Three modes exist: `standard` (options from the `options` block), `direct` (*"a user is fully responsible for agent configuration, and the rest of the agent configuration, provided in `pom.xml` file, will be ignored"*), and `conditional` (filter files produce conditional entries).

The reference is emphatic about what to do with the output:

> *"Although those files will be automatically used by `native-image`, you should consider reviewing the generated files and adding them to your sources instead."*

🔴 **Commit the metadata.** Agent output regenerated on every CI run is not reproducible: it changes when a test changes, and nobody reviews the diff. Copy it into `src/main/resources/META-INF/native-image/`, review it like code, and let the diff tell you when a dependency starts reflecting on something new. Spring Boot says the same thing about the direct-launch route: *"To use them as input, copy them into the `src/main/resources/META-INF/native-image/` directory."*

Running the agent against the *application* rather than the tests takes more setup, because the Java process must be forked — the plugin documents an `exec-maven-plugin` execution for it, invoked as:

```bash
./mvnw -Pnative -Dagent=true -DskipTests -DskipNativeBuild=true package exec:exec@java-agent
```

For Spring specifically, launch with AOT already active so that what you trace is the AOT-processed application and not the plain-JVM one:

```bash
java -Dspring.aot.enabled=true \
  -agentlib:native-image-agent=config-output-dir=/path/to/config-dir/ \
  -jar target/myproject-0.0.1-SNAPSHOT.jar
```

## Tracing the native image itself — the better workflow

There is now a second, more accurate mechanism, and it produces *conditional* metadata rather than unconditional:

> *"This workflow collects metadata dynamically by tracing an actual native image execution. The generated metadata is conditional because each traced access can be guarded by a `typeReached` condition derived from the run-time call stack."*

Build with tracing support, and with enough of the world preserved that there is something to observe:

```bash
native-image -H:+UnlockExperimentalVMOptions -H:+MetadataTracingSupport -H:-UnlockExperimentalVMOptions \
             -H:Preserve=package=com.example.library.* ...
```

The reason for the preservation is stated plainly: *"Metadata tracing can only record metadata that was included in the native image at build time."* Then run with tracing on:

```bash
./application -XX:TraceMetadata=path=metadata-output -XX:TraceMetadataConditionPackages=com.example.application
```

The condition-packages list is prefix-based, and *"When a traced access occurs, Native Image uses the first stack frame whose class is in one of those packages as the `typeReached` condition. Trace events without a matching stack frame are ignored."*

Merge runs with the tool — note the name, which changed:

```bash
native-image-utils generate --input-dir=metadata-output-1 --input-dir=metadata-output-2 --output-dir=merged-metadata
```

The same tool converts an agent trace file into configuration (`--trace-input=/path/to/trace-file.json`), which is useful when you want to see *individual* accesses rather than the summarised config.

**Why this beats the JVM agent when you can afford it:** *"This produces the most accurate conditional metadata because the traced accesses follow Native Image semantics."* The JVM agent records what a JVM did; this records what the native image did, under the rules that actually apply.

## Gotchas

**★ Symptom: the agent produced no files.** Cause: the JVM did not exit cleanly — the agent writes *"when the application completes and the JVM exits"*. A `SIGKILL`, a container `docker kill`, or a service you stopped with the wrong signal all produce nothing. Fix: stop it with `SIGTERM`/Ctrl-C, or add `config-write-period-secs=300` so files land periodically regardless of how the process ends.

**★ Symptom: `-agentlib` appears to be ignored entirely.** Cause: it was placed after `-jar` or after the main class, where it becomes an application argument. The reference calls this out explicitly. Fix: `java -agentlib:... -jar app.jar`, never `java -jar app.jar -agentlib:...`.

**★ Symptom: the native image contains reflection metadata for JUnit, Mockito and Testcontainers.** Cause: the agent was run over the test suite with no access filter, and *"by default the generated hints will include anything required by the test infrastructure."* Fix: supply an access-filter file excluding the test packages, and review the committed metadata for anything that has no business in a production binary.

**★ Symptom: metadata regenerates differently on every CI run and nobody can tell what changed.** Cause: agent output is being consumed straight from `target/native/agent-output` instead of being committed. Fix: follow the reference's own advice — *"you should consider reviewing the generated files and adding them to your sources instead"* — copy into `src/main/resources/META-INF/native-image/`, commit, and treat the diff as a code review artefact.

**★ Symptom: a rarely-hit endpoint throws `MissingReflectionRegistrationError` weeks after the migration.** Cause: the agent run never exercised it, and nothing failed the build. Fix: two changes, both needed. Collect from the test suite so coverage is a number you already measure, and gate the native test run with `-XX:MissingRegistrationReportingMode=Exit` so an unregistered access is a test failure rather than a production incident.

**★ Symptom: the agent output is enormous and the image balloons.** Cause: built-in filters were disabled, or nothing filtered the caller side. Fix: re-enable them — the reference says output with `no-builtin-caller-filter` or `no-builtin-heuristic-filter` is *"generally unsuitable for the build"* — and prefer conditional collection, either the agent's `conditional` mode or native-image metadata tracing, which produces `typeReached`-guarded entries instead of unconditional ones.

**★ Symptom: metadata traced from a native image is empty for a library you care about.** Cause: *"Metadata tracing can only record metadata that was included in the native image at build time."* If it was not preserved, it cannot be observed. Fix: build the discovery image with `-H:Preserve=package=<the library's package>.*` (or `-H:Preserve=all` for one exploratory build only), trace, then drop the preservation from normal builds.

**★ Symptom: `native-image-configure` is not found.** Cause: the merge tool is documented as `native-image-utils generate` in the current reference. Fix: use `native-image-utils generate --input-dir=... --output-dir=...`; `native-image-utils help` lists the options.

**★ Symptom: tracing a Spring Boot jar produces hints that do not match the native build.** Cause: the jar was launched without `-Dspring.aot.enabled=true`, so the agent watched the reflective, runtime-configured JVM path rather than the AOT-processed one. Fix: set that property when tracing, exactly as Spring Boot's own advanced-topics page does.

## Interview questions

**★ What does the tracing agent actually do, and what is its fundamental limitation?**
It runs on a stock JVM via JVMTI, intercepts reflective lookups, resource access, proxy creation, serialization and JNI, and writes the corresponding metadata JSON when the JVM exits. Its fundamental limitation is stated in the reference: *"the agent observes only executed code"*. So its output is your test coverage projected onto the dynamic-features axis. Anything that did not run is not in the file, and no build step will tell you. That is why the agent is half a workflow — the other half is `-XX:MissingRegistrationReportingMode=Exit` on a native test run, which fails on the accesses the agent never saw.

**★ Should the agent run against the application or against the test suite?**
Both, for different reasons, and Spring Boot's reference says so. Running the application directly is *"interesting for identifying the missing hints when a library or a pattern is not recognized by Spring"* — an exploratory tool. Running the tests is *"more appealing for a repeatable setup"* because coverage is measurable and it fits CI, but it drags in the test infrastructure's own reflection, which is what access filters exist to remove. In practice: tests for the repeatable baseline with an access filter, direct launch when a specific library is misbehaving.

**★ What is the difference between a caller filter and an access filter?**
A caller filter matches the class *performing* the access — it decides whose reflection you record. An access filter matches the *target* of the access — it decides what shows up in the output regardless of who touched it. Excluding `org.junit.**` as a caller filter stops recording reflection performed by JUnit; excluding it as an access filter stops recording reflection *on* JUnit classes. For cleaning test-harness noise out of collected metadata, the access filter is usually the one you want, and it is the one Spring Boot's documentation names.

**★ Why is metadata traced from a native image better than metadata traced from a JVM?**
Because it is conditional and it is semantically accurate. The reference: *"This produces the most accurate conditional metadata because the traced accesses follow Native Image semantics."* Each access is guarded by a `typeReached` condition derived from the first stack frame in your configured packages, so entries cost nothing until the guarding type is reached — which keeps images small. The JVM agent, by contrast, records what a JVM did under JVM rules and emits mostly unconditional entries. The price of the better route is a discovery build with `-H:Preserve`, which is large and memory-hungry, so it is a workflow rather than a default.

**★ Should agent output be committed to the repository or regenerated in CI?**
Committed. The reference's own recommendation is to review the generated files and add them to your sources. Regenerated output is unreviewed, non-reproducible and silently sensitive to unrelated test changes; a committed file makes "our HTTP client started reflecting on a new class" a visible diff in a pull request. The regeneration workflow stays available for investigation, but what ships should be a file a human approved.

**★ Your build already collects metadata with the agent. What else do you need before you trust the artefact?**
Three things. An access filter, so the test harness's reflection is not in the production binary. A native test run with `-XX:MissingRegistrationReportingMode=Exit`, so an access the agent never observed fails the build rather than degrading at run time. And `native:list-libraries-missing-metadata` from Native Build Tools, so you know which direct dependencies have no repository metadata at all — a gap the agent will only reveal if a test happens to walk through it.

{/* FOOTER */}
