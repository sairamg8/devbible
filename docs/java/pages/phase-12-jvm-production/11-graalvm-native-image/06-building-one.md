---
title: "Three routes produce a native executable — the Native Build Tools plugins, Cloud Native Buildpacks, and the raw native-image tool on an AOT-processed jar — and the one you pick decides who owns the C toolchain, the target platform and the reproducibility of the build"
sidebar_label: "06 · Building one"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Native Image" getting started
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/)), "Build Configuration"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildConfiguration/)) and "Build Options"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/));
> the **Spring Boot reference**, "Developing Your First GraalVM Native Application"
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/native-image/developing-your-first-application.html))
> and "Advanced Native Images Topics"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/advanced-topics.html));
> the **Native Build Tools 1.1.1 Maven plugin** reference ([graalvm.github.io](https://graalvm.github.io/native-build-tools/latest/maven-plugin.html)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Native Build Tools 1.1.1**.
> Documentation-validated; **no sandbox run**.

**The `native-image` tool is a compiler that links against your operating system's C toolchain, so a native build is a cross-language build with a platform-specific output. That single fact drives every decision on this page: whether you install a toolchain on the build agent or delegate it to a container, whether the artefact is per-platform, and where in the pipeline the build lives. Spring Boot supports two routes and GraalVM documents a third; they produce the same kind of artefact by very different means.**

## The prerequisite everybody forgets: a C toolchain

> *"The `native-image` tool, available in the `bin` directory of your GraalVM installation, depends on the local toolchain (header files for the C library, `glibc-devel`, `zlib`, `gcc`, and/or `libstdc++-static`)."*

On Oracle Linux the reference's own command is `sudo yum install gcc glibc-devel zlib-devel`, with a note that *"Some Linux distributions may additionally require `libstdc++-static`."*

⚠️ **This is why a JDK-only CI image fails.** A `maven:3-eclipse-temurin-25` agent has no `gcc`. It is also why the buildpack route is popular: it moves the toolchain problem into an image somebody else maintains.

And the cross-compilation constraint that decides your pipeline shape — Spring Boot states it as fact and links the upstream issue:

> *"As `native-image` does not support cross-compilation, you can keep an OS neutral deployment artifact which you convert later to different OS architectures."*

🔴 **Build on the target platform.** One native build per OS/architecture/libc combination you deploy to, in a container that matches it. There is no `-target` flag to substitute for this.

## Route 1 — Native Build Tools plugins

The route Spring Boot's `spring-boot-starter-parent` is set up for. The plugin declaration is minimal because the starter parent manages the version and the profile ([05](05-spring-boot-aot.md)):

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.graalvm.buildtools</groupId>
      <artifactId>native-maven-plugin</artifactId>
    </plugin>
  </plugins>
</build>
```

```bash
./mvnw -Pnative native:compile          # AOT-process, then compile — executable lands in target/
./mvnw -PnativeTest test                # build and run the test suite as a native image
```

Gradle needs no profile — Boot's plugin reacts to the presence of the GraalVM plugin:

```groovy
plugins {
    id 'org.springframework.boot' version '4.1.0'
    id 'org.graalvm.buildtools.native' version '1.1.1'
}
```

```bash
./gradlew nativeCompile                 # build/native/nativeCompile/<name>
./gradlew nativeRun
./gradlew nativeTest
```

> *"When the Native Build Tools Gradle plugin is applied to your project, the Spring Boot Gradle plugin will automatically trigger the Spring AOT engine. Task dependencies are automatically configured."*

**The configuration knobs you will actually use**, from the plugin reference:

```xml
<configuration>
  <imageName>billing-service</imageName>
  <buildArgs>
    <buildArg>--exact-reachability-metadata</buildArg>
    <buildArg>-H:+GenerateEmbeddedResourcesFile</buildArg>
    <buildArg>--initialize-at-run-time=com.example.security.TokenFactory</buildArg>
  </buildArgs>
  <agent>
    <enabled>false</enabled>
  </agent>
</configuration>
```

- `imageName` — *"If a custom image name is not supplied, the artifact ID of the project will be used by default."*
- `buildArgs` — the pass-through for any `native-image` option.
- `mainClass` — only needed *"If the execution fails with the `no main manifest attribute, in target/<name>.jar` error"*; otherwise the plugin consults the shade, assembly and jar plugin configurations in that order.
- `skipNativeBuild`, `skipNativeTests`, `skipTestExecution`, `failNoTests`, `debug` — the CI controls, and **08 · Testing a native image** *(not written yet)* covers the test-specific ones.

**The plugin also brings the metadata repository in for free** — see [03b](03b-reachability-metadata.md) — which is most of why this route is easier than driving `native-image` yourself.

## Route 2 — Cloud Native Buildpacks

> *"Spring Boot supports building Docker images containing native executables, using Cloud Native Buildpacks (CNB) integration with both Maven and Gradle and the Paketo Java Native Image buildpack. This means you can just type a single command and quickly get a sensible image into your locally running Docker daemon."*

```bash
./mvnw -Pnative spring-boot:build-image
```

```bash
./gradlew bootBuildImage               # produces a native image when the GraalVM plugin is applied
```

What you get, and it is a genuinely good default:

> *"The resulting image doesn't contain a JVM, instead the native image is compiled statically. This leads to smaller images."*

> *"The CNB builder used for the images is `paketobuildpacks/builder-noble-java-tiny:latest`. It has a small footprint and reduced attack surface. It does not include a shell and contains a reduced set of system libraries. If you need more tools in the resulting image, you can use `paketobuildpacks/ubuntu-noble-run:latest` as the *run* image."*

Three operational facts:

- 🔴 **JDK 25 minimum, for a stated reason**: *"You have to build your application with at least JDK 25, because Buildpacks use the same GraalVM native-image version as the Java version used for compilation."*
- **A Docker daemon is required**, and on Linux it must be usable by a non-root user.
- **No local GraalVM needed** on the `pack` path: *"You do not need to have a local GraalVM installation to generate an image in this way."*

⚠️ **No shell in the run image.** `kubectl exec ... -- sh` will not work, and neither will a `preStop` hook written as a shell command. Topic 12 owns graceful shutdown ([`12-graceful-shutdown/README.md`](../12-graceful-shutdown/README.md)) and this constraint belongs in that conversation. Swap the run image if you need a shell — and be honest that you are trading attack surface for convenience.

The `pack` variant, for turning an already-built AOT-processed jar into an image:

```bash
pack build --builder paketobuildpacks/builder-noble-java-tiny \
    --path target/myproject-0.0.1-SNAPSHOT.jar \
    --env 'BP_NATIVE_IMAGE=true' \
    my-application:0.0.1-SNAPSHOT
```

> *"Your executable jar must include AOT generated assets such as generated classes and JSON hint files."*

That is the `Spring-Boot-Native-Processed: true` jar the `native` profile produces ([05](05-spring-boot-aot.md)). Handing an ordinary jar to this command does not work.

## Route 3 — the `native-image` tool directly

The reason to know it: it decouples the JVM build from the native build, which is exactly what you want when the two run on different agents.

> *"You can keep your regular JVM pipeline and turn the JVM application into a native image on your CI/CD platform."*

Boot documents the exact sequence for a Boot executable jar, because you cannot simply point `native-image` at one:

```bash
rm -rf target/native
mkdir -p target/native
cd target/native
jar -xvf ../myproject-0.0.1-SNAPSHOT.jar
native-image -H:Name=myproject @META-INF/native-image/argfile \
    -cp .:BOOT-INF/classes:`find BOOT-INF/lib | tr '\n' ':'`
mv myproject ../
```

Two warnings from the documentation, both easy to trip over:

> *"The `@META-INF/native-image/argfile` might not be packaged in your jar. It is only included when reachability metadata overrides are needed."*

> *"The `native-image` `-cp` flag does not accept wildcards. You need to ensure that all jars are listed (the command above uses `find` and `tr` to do this)."*

For plain, non-Boot applications the tool is simpler and mirrors `java`:

```bash
native-image -jar app.jar                  # default executable name derived from the jar
native-image -cp . com.example.Main        # from a class
native-image --module com.example/com.example.Main
```

> *"The default behavior of `native-image` is aligned with the `java` command which means you can pass the `-jar`, `-cp`, `-m` options to build with Native Image as you would normally do with `java`."*

## Configuration that travels with the artefact

A library — or your own module — can carry build options in `META-INF/native-image/<groupId>/<artifactId>/native-image.properties`:

```properties
Args = --initialize-at-run-time=com.example.security.TokenFactory \
       -H:+GenerateEmbeddedResourcesFile
JavaArgs = -Xmx8g
ImageName = billing-service
```

- `Args` — *"Use this property if your project requires custom `native-image` command-line options to build correctly."*
- `JavaArgs` — *"Sometimes it can be necessary to provide custom options to the JVM that runs the `native-image` builder."*
- `ImageName` — a default that the command line can still override.

**Argument order is significant**, which is how you override a library's setting:

> *"The options passed to `native-image` are evaluated from left to right. This also extends to options that are passed indirectly via configuration files in the `META-INF/native-image` directory. Consider the example where there is a JAR file that includes `native-image.properties` containing `Args = -H:Optimize=0`. You can override the setting that is contained in the JAR file by using the `-H:Optimize=2` option after `-cp <jar-file>`."*

**And the diagnostic for "where did that option come from":**

```bash
native-image --verbose -jar target/app.jar
```

> *"This shows from where `native-image` picks up the configurations to construct the final composite configuration command-line options for the image builder."*

Also useful: `NATIVE_IMAGE_OPTIONS` as an environment variable, which the Build Output reference describes as *"Similar to `JAVA_TOOL_OPTIONS`, the value of the environment variable is prefixed to the options supplied to `native-image`"* and *"designed to be used by users, build environments, or tools to inject additional build options."* ⚠️ *"Argument files are not allowed to be passed via `NATIVE_IMAGE_OPTIONS`."*

## Choosing a route

| | Native Build Tools | Buildpacks | `native-image` directly |
|---|---|---|---|
| Toolchain | yours to install | the builder's | yours to install |
| Target platform | the build agent's | the builder's | the build agent's |
| Metadata repository | automatic | automatic (via the plugins) | manual |
| Base image | yours to choose | `-tiny`, no shell | yours to choose |
| Docker daemon needed | no | **yes** | no |
| Best for | local iteration, native tests | the default production path | splitting JVM and native builds across agents |

**The pragmatic combination most teams land on:** Native Build Tools locally and for `nativeTest`, buildpacks for the deployed image, and route 3 only when the pipeline genuinely needs the jar and the binary produced on different machines.

## Gotchas

**★ Symptom: the native build fails on a CI agent with a C compiler or linker error.** Cause: no local toolchain — the reference lists `glibc-devel`, `zlib`, `gcc` and sometimes `libstdc++-static` as dependencies. Fix: install them in the build image, or switch to buildpacks, which own the toolchain for you. Do not attempt to install `gcc` inside a `distroless` builder.

**★ Symptom: a binary built in CI will not execute on the deployment host.** Cause: a platform mismatch — a different libc, architecture or OS. `native-image` does not cross-compile. Fix: build in a container whose base matches the runtime image exactly, or use buildpacks so that the build and run images are chosen together.

**★ Symptom: `native-image -cp 'BOOT-INF/lib/*'` finds nothing.** Cause: *"The `native-image` `-cp` flag does not accept wildcards."* Fix: expand the list, exactly as Boot's documented command does with `find BOOT-INF/lib | tr '\n' ':'`.

**★ Symptom: `@META-INF/native-image/argfile` does not exist and the manual build fails.** Cause: *"It is only included when reachability metadata overrides are needed."* Fix: make the `@argfile` argument conditional in your script rather than assuming it, or use the plugin route where this is handled.

**★ Symptom: `pack` produces a JVM image instead of a native one.** Cause: either `BP_NATIVE_IMAGE=true` was not set, or the jar was not AOT-processed and lacks the generated assets. Fix: build with `-Pnative` so `process-aot` runs and the `Spring-Boot-Native-Processed: true` manifest entry is written, then pass the environment variable.

**★ Symptom: `kubectl exec` into a native pod fails with "no such file or directory".** Cause: the Paketo `-tiny` run image *"does not include a shell and contains a reduced set of system libraries."* Fix: either accept it and debug through logs, metrics and `jcmd` from a sidecar, or switch the run image to `paketobuildpacks/ubuntu-noble-run:latest`. The same constraint breaks shell-based `preStop` hooks — check topic 12's shutdown wiring before assuming it still applies.

**★ Symptom: an option set in a dependency's `native-image.properties` overrides yours.** Cause: left-to-right evaluation, and the dependency's arguments were applied after yours. Fix: place your option after the classpath entry that contributes the file — the reference's own example is overriding `-H:Optimize=0` from a jar by passing `-H:Optimize=2` after `-cp <jar-file>` — and use `native-image --verbose` to see which configurations were picked up and in what order.

**★ Symptom: the Gradle native build works locally and not in CI, with a configuration-cache error.** Cause: the Boot documentation's own note when generating a project — *"If caching was enabled by the project generator in the `gradle.properties` file, comment out or remove the `org.gradle.configuration-cache=true` line."* Fix: do that, and revisit later; treat configuration-cache compatibility as something to verify rather than assume.

**★ Symptom: the build runs but produces an executable named `com.example.main`.** Cause: the default naming rules — `native-image -jar <name.jar>` gives `<name>`, but `native-image -cp ... fully.qualified.MainClass` gives `fully.qualified.mainclass`. Fix: set `imageName` in the plugin, `ImageName` in `native-image.properties`, or `-H:Name=` on the command line.

**★ Symptom: nobody can reproduce a colleague's build result.** Cause: `native-image` composes options from the command line, every `native-image.properties` on the classpath, and `NATIVE_IMAGE_OPTIONS` in the environment. Fix: capture `native-image --verbose` output in CI, and pin the environment variable to a known value rather than letting it be inherited.

## Interview questions

**★ Why can't you produce a Linux native binary on a macOS developer machine?**
Because `native-image` compiles and links against the local C toolchain and produces a platform-specific executable, and it does not support cross-compilation — Spring Boot's reference states this and links the upstream issue. The consequence for a pipeline is that you need one build per OS/architecture/libc target, run on a machine or container matching that target. It is also the strongest practical argument for the buildpack route, which chooses the build and run images together so the mismatch cannot happen.

**★ What exactly does the Paketo Java Native Image buildpack give you that the Maven plugin does not?**
It owns the toolchain and the target platform. You need a Docker daemon but no local GraalVM, no `gcc`, and no decision about the base image — the builder is `paketobuildpacks/builder-noble-java-tiny:latest`, and the resulting image contains no JVM because *"the native image is compiled statically."* The costs are that you need Docker, that the run image has no shell, and that the GraalVM version is tied to the JDK you compiled with — which is why Boot documents a JDK 25 minimum for this route.

**★ Why does building from a Spring Boot executable jar require extracting it first?**
Because a Boot executable jar is a nested-jar layout that `native-image` cannot read as a classpath, and because `-cp` does not accept wildcards. Boot's documented sequence extracts the jar, then builds with an explicitly expanded classpath — `.:BOOT-INF/classes:` plus every jar in `BOOT-INF/lib` listed individually via `find` and `tr`. It also passes `@META-INF/native-image/argfile` when present, which the documentation notes *"is only included when reachability metadata overrides are needed"*, so the script has to tolerate its absence.

**★ A library ships a `native-image.properties` with a build option you disagree with. How do you override it?**
By argument position. Options are *"evaluated from left to right"*, including those contributed indirectly from `META-INF/native-image`, so passing your option after the classpath entry that supplies the file wins — the reference's own example overrides a jar's `-H:Optimize=0` by passing `-H:Optimize=2` after `-cp <jar-file>`. Confirm with `native-image --verbose`, which prints which configuration files were applied and in what order.

**★ Where in a CI pipeline does the native build belong, and why?**
Not on the pull-request path, in most cases. The JVM build and the JVM test suite should gate every commit; the native build and native tests are slower and, on a busy monorepo, expensive enough to become the bottleneck ([06b](06b-the-build-that-takes-ten-minutes.md)). The common shape is: JVM build and tests per commit, plus `spring.aot.enabled=true` on the JVM as a cheap AOT smoke check; native build and `nativeTest` nightly and on release branches. What must never happen is a release build that produces a native artefact nobody has ever executed.

**★ What is `NATIVE_IMAGE_OPTIONS` and why should you be careful with it?**
An environment variable whose value *"is prefixed to the options supplied to `native-image`"*, analogous to `JAVA_TOOL_OPTIONS`, and *"designed to be used by users, build environments, or tools to inject additional build options."* Be careful because it makes the build depend on ambient environment state: two agents with different values produce different binaries with no diff in the repository. Pin it explicitly in the pipeline, or do not use it, and capture `native-image --verbose` output so the effective option list is recorded with the build.

{/* FOOTER */}
