---
title: "jdeps computes the module set from class files, which makes its answer a lower bound rather than an answer — every dependency your Spring application resolves reflectively is invisible to it, so the honest workflow is compute, widen deliberately, then prove it by running the tests on the linked runtime"
sidebar_label: "04b · jdeps and the module set"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 tool reference** for
> [`jdeps`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jdeps.html) and
> [`jlink`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jlink.html); the **JDK 25 API
> documentation module index**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/index.html)); the module
> summaries for
> [`jdk.charsets`](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.charsets/module-summary.html),
> [`jdk.naming.dns`](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.naming.dns/module-summary.html)
> and
> [`java.instrument`](https://docs.oracle.com/en/java/javase/25/docs/api/java.instrument/module-summary.html);
> the **`ServiceLoader` javadoc, JDK 25**; and the **Spring Boot reference**, "Packaging →
> Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)).
> 🔴 **No sandbox** — no analysis was run and no module list below is the output of a tool. JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[04](04-jlink.md) left one decision unmade: what goes in `--add-modules`. The tooling makes this
look mechanical — `jdeps --print-module-deps` even documents its output as being for
`jlink --add-modules` — and for a modular application it nearly is. For a Spring Boot application
on the classpath it is not, and the reason is structural rather than a bug: `jdeps` reads class
files, and the dependencies that break a trimmed runtime are precisely the ones that are not in
class files.**

## The documented pipeline

`jdeps` describes itself narrowly and the narrowness is the point:

> *"The `jdeps` command shows the package-level or class-level dependencies of Java class files.
> The input class can be a path name to a `.class` file, a directory, a JAR file, or it can be a
> fully qualified class name to analyze all class files."*

and the option that connects it to [04](04-jlink.md) states the intended workflow outright:

> *"`--print-module-deps` — Same as `--list-reduced-deps` with printing a comma-separated list of
> module dependences. The output can be used by `jlink --add-modules` to create a custom image
> that contains those modules and their transitive dependences."*

Two supporting options you will need on any real dependency tree:

> *"`--ignore-missing-deps` — Ignore missing dependences."*

> *"`--multi-release version` — Specifies the version when processing multi-release JAR files.
> version should be an integer `>=9` or `base`."*

> *"`--list-deps` — Lists the module dependences and also the package names of JDK internal APIs
> (if referenced). This option transitively analyzes libraries on class path and module path if
> referenced. Use `--no-recursive` option for non-transitive dependency analysis."*

## Running it against a Spring Boot jar

🔴 **Do not point `jdeps` at the executable jar.** Inside a Boot jar the dependencies live at
`BOOT-INF/lib/*.jar` as **nested** entries, which is the whole subject of
[01](01-the-fat-jar.md) — `jdeps` sees a jar containing resources, not a jar containing a
dependency graph. Extract first, with the same `tools` jar mode from
[02b](02b-extracting-layers-and-the-image-cache.md):

```bash
java -Djarmode=tools -jar my-app.jar extract --destination extracted

jdeps \
  --ignore-missing-deps \
  --multi-release 25 \
  --print-module-deps \
  --recursive \
  extracted/my-app.jar extracted/lib/*.jar
```

- `--multi-release 25` is not optional in practice: a great many modern libraries ship as
  multi-release jars, and `jdeps` needs to be told which release to analyse.
- `--ignore-missing-deps` is what stops the run aborting on the first optional dependency your
  application never uses — a compile-time-only annotation library, an alternative logging binding,
  a driver for a database you do not run.

The result is a comma-separated module list you can paste into `jlink --add-modules`. **Treat it
as the floor of the answer, not the answer.**

## Why it is a floor: four things class files do not contain

`jdeps` reports what the constant pool references. Every one of the following puts a dependency
somewhere else.

**1 · `ServiceLoader` providers.** The `ServiceLoader` javadoc describes location by resource
lookup: *"Service providers in unnamed modules are located if their class names are listed in
provider-configuration files located by the class loader's `getResources` method."* A provider is
named in a **text file**. No class file references it. This is how the JDK itself wires charsets,
security providers, JNDI providers, `java.nio.file` file-system providers and JDBC drivers —
`DriverManager` has used `ServiceLoader` since JDBC 4.

**2 · Resource-only modules.** `jdk.localedata` and `jdk.charsets` are not code your application
calls; they are *data*. `jdk.charsets` says so: *"Provides charsets that are not in java.base
(mostly double byte and IBM charsets)."* Nothing in your bytecode references them, and their
absence shows up as a formatting difference, a collation difference or an
`UnsupportedCharsetException` on one code path.

**3 · Spring's own reflection.** Boot's auto-configuration resolves class **names** from
`META-INF/spring/…AutoConfiguration.imports`, evaluates `@ConditionalOnClass` by attempting to load
names, and instantiates beans reflectively. The dependency from your application to a JDK module
can therefore run through a string in a text file inside a jar you did not write.

**4 · Runtime-attached machinery.** `java.instrument` — *"Defines services that allow agents to
instrument programs running on the JVM"* — is needed by an agent that is attached on the command
line, not called from your code. So is `jdk.jfr` for a recording, and `jdk.attach` plus `jdk.jcmd`
for the diagnostics from [03](03-base-images.md). None appear in any class file you own.

⚠️ **The failure mode is the worst available shape.** The image links, the container starts, the
health check passes, and the missing module surfaces on the code path that formats a Turkish
locale, negotiates one TLS cipher suite, or resolves one JNDI name. It is a latent,
traffic-dependent failure introduced by a build-time optimisation.

## The workflow that actually holds

**Step 1 — compute the floor.** `jdeps --print-module-deps` as above. Record it in the repository
so a change in it is visible in a diff.

**Step 2 — widen deliberately, module by module, with a reason.** Get the candidate list from the
JDK itself:

```bash
java --list-modules
```

🔴 **`java --list-modules` is the authority, not the API documentation index.** The javadoc index
lists only modules that export documented API, so a module can exist in your JDK and be absent
from that page. Read the list from the JDK in your builder stage.

For each module you add, write down the reason next to it in the Dockerfile. Typical reasons, each
of which you should confirm applies to *your* application rather than copying:

| Module | Why a Spring service might need it |
|---|---|
| `java.sql`, `java.naming` | JDBC and JNDI; `java.naming` also backs several `ServiceLoader` lookups |
| `java.management` | JMX beans, and much of what Micrometer's JVM metrics read (topic 08) |
| `java.instrument` | Any `-javaagent` — an APM agent, a tracing agent (topic 09) |
| `jdk.charsets` | Charsets outside `java.base` |
| `jdk.localedata` | Any locale beyond the root locale; also required by `--include-locales` |
| `jdk.naming.dns` | *"Provides the implementation of the DNS Java Naming provider"* — JNDI DNS lookups |
| `jdk.jfr`, `jdk.management.agent`, `jdk.jcmd`, `jdk.attach` | Everything topics 05 and 06 tell you to do at 03:00 |
| `jdk.zipfs` | The zip file-system provider, if anything reads a jar or zip via `java.nio.file` |
| `jdk.crypto.*` | Crypto providers; use `jlink --suggest-providers java.security.Provider` to see the real candidates on your JDK |

**Step 3 — use `--suggest-providers` rather than `--bind-services`.** [04](04-jlink.md) showed the
man page's own example expanding a four-module image to thirty-five under `--bind-services`.
`--suggest-providers` asks which modules provide a given service so you can add them by name.

**Step 4 — make surprises fail at link time.** `--limit-modules` *"limits the universe of
observable modules to those in the transitive closure of the named modules"*, which turns an
accidental broadening into a build failure rather than a silently larger image.

**Step 5 — prove it, because nothing above is proof.** Run the integration test suite against a
container built on the linked runtime, in CI, on every change to the module list or the dependency
tree. This is the only step that catches reflective dependencies, and a `jlink` pipeline without it
is a bet, not an optimisation.

## What `jdeps` is for that this is not

Two options exist for a different job and get mistaken for this one:

> *"`--generate-module-info dir` — Generates `module-info.java` under the specified directory. The
> specified JAR files will be analyzed."*

> *"`--check module-name` — Analyzes the dependence of the specified modules. It prints the module
> descriptor, the resulting module dependences after analysis and the graph after transition
> reduction. It also identifies any unused qualified exports."*

Those are for **modularising your own code** — turning classpath jars into named modules. That is
a worthwhile but entirely separate project, and Spring Boot's packaging does not require it: the
extracted layout the reference recommends still puts everything on the classpath. Do not let a
`jlink` conversation turn into a JPMS migration by accident.

## Gotchas

**★ `jdeps` output is a lower bound, always.** It analyses class files; `ServiceLoader`,
`Class.forName`, Spring's auto-configuration imports and resource-only modules are all invisible to
it. Treating `--print-module-deps` as authoritative is the single mistake that makes `jlink`
dangerous instead of merely fiddly.

**★ Pointing `jdeps` at a Boot uber jar analyses almost nothing.** The dependencies are nested
entries under `BOOT-INF/lib`. Extract with `-Djarmode=tools … extract` first, then analyse the
extracted jars.

**★ Without `--multi-release`, `jdeps` fails on modern libraries.** The option takes *"an integer
`>=9` or `base`"*. Set it to the JDK version you are targeting, not to `base`, or you analyse the
Java 8 copies of classes that ship in the same jars.

**★ `--ignore-missing-deps` hides real problems as well as noise.** It exists so an optional
dependency does not abort the run, and it will equally quietly swallow a genuinely broken
dependency tree. Read the run *without* it once before you add it permanently.

**★ Missing `jdk.localedata` is not an error, it is a difference.** Dates, number formats and
collation silently fall back to what remains. Nothing throws. This is why "the tests passed" is a
weaker signal here than usual, unless the tests assert on locale-sensitive output.

**★ Missing `jdk.charsets` throws late and specifically.** `UnsupportedCharsetException` on the one
integration that speaks a legacy encoding, at whatever hour that integration runs.

**★ A missing security provider looks like a TLS handshake failure.** Not like a missing module.
Use `jlink --suggest-providers java.security.Provider` to enumerate the candidates on your JDK
before trimming crypto modules.

**★ The javadoc module index is not the module list.** It documents modules that export documented
API. `java --list-modules`, run against the JDK in your builder stage, is the authority.

**★ An agent needs `java.instrument` even though your code never mentions it.** APM and tracing
agents are attached with `-javaagent` on the command line. A runtime linked from a `jdeps` analysis
of your code alone will not have the module, and the JVM will refuse to start with the agent
attached — which at least fails early, unlike most items on this list.

**★ `jdk.zipfs` is easy to lose and quietly needed.** Anything opening a jar or zip through
`FileSystems.newFileSystem` depends on it as a `ServiceLoader` provider, which means no class file
mentions it.

**★ Recompute the module set when dependencies change, not when you remember.** A new library or a
Boot upgrade can introduce a reflective path into a module you trimmed. Make `jdeps` and the
integration run part of the pipeline, not a task someone did once.

**★ `--generate-module-info` is a different project.** It exists to modularise your own jars, not
to size a runtime. Boot's recommended extracted layout is still classpath-based.

## Interview questions

**★ How do you decide the `--add-modules` list for a `jlink`ed runtime?**
Start with `jdeps --print-module-deps` over the **extracted** application and its libraries — the
man page documents that output as being for `jlink --add-modules`. Then widen it deliberately for
everything class files cannot express: `ServiceLoader` providers, resource-only modules like
`jdk.localedata` and `jdk.charsets`, anything an agent needs, and the diagnostic modules if your
runbook uses them. Then validate by running the integration suite on the linked runtime, because
that is the only step that can detect a reflective dependency.

**★ Why is `jdeps` structurally unable to give the right answer for Spring Boot?**
Because it reports what class files reference, and Spring's wiring is name-based. Auto-configuration
resolves class names out of `AutoConfiguration.imports`, `@ConditionalOnClass` probes names, beans
are instantiated reflectively, and the JDK's own extension points — charsets, security providers,
JDBC drivers, file-system providers — are `ServiceLoader` lookups located, per the javadoc, through
*"provider-configuration files located by the class loader's `getResources` method"*. None of that
is in a constant pool.

**★ You linked a runtime, everything passed CI, and three weeks later one customer's requests fail
on a date format. What happened?**
`jdk.localedata` is missing. It is resource data, not code, so nothing referenced it, `jdeps` never
reported it, and its absence does not throw — locale-sensitive behaviour just falls back. The fix
is `--add-modules jdk.localedata` plus `--include-locales` for the tags you support; the lesson is
that a trimmed runtime needs tests that assert on locale-sensitive output.

**★ Why prefer `--suggest-providers` to `--bind-services`?**
`--bind-services` links every module providing any service used anywhere in the graph — the `jlink`
man page's own example expands four modules to thirty-five, including `jdk.compiler` and
`jdk.javadoc`, which defeats the exercise. `--suggest-providers` lists the candidate providers for a
named service so you can add the two or three that are real. It is more work and it keeps the image
small.

**★ What is `--limit-modules` good for in a build pipeline?**
Turning drift into a build failure. It limits the observable universe to a named closure, so if a
dependency change quietly pulls in another platform module, the link fails rather than producing a
larger image nobody notices. It is the same instinct as pinning versions.

**★ Is modularising the application itself the better answer?**
It is a different answer to a different question. `jdeps --generate-module-info` and `--check` exist
to help turn classpath jars into named modules, which improves `jlink`'s precision — and it is a
large migration that Spring Boot does not require, since the documented efficient layout is
classpath-based. Do it because you want JPMS, not because you want a smaller image.

**★ What is the one non-negotiable step in a `jlink` pipeline?**
Running the full integration suite against the linked runtime, in CI, on every change to the
dependency tree or the module list. Every other step produces an estimate. This is the only one that
produces evidence, and without it the optimisation is a latent, traffic-dependent outage waiting for
the right request.

{/* FOOTER */}
