---
title: "The layered Dockerfile Spring Boot actually documents, line by line — two stages so the uber jar never reaches the runtime image, four COPY lines in index order, and an ENTRYPOINT that runs the extracted jar rather than the one you built"
sidebar_label: "02c · A real layered Dockerfile"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference documentation** — "Packaging → Container
> Images → Dockerfiles"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/dockerfiles.html))
> and "Packaging → Container Images → Efficient Container Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/efficient-images.html));
> and the **Spring Boot Maven Plugin** reference, "Packaging Executable Archives"
> ([docs.spring.io](https://docs.spring.io/spring-boot/maven-plugin/packaging.html)).
> 🔴 **No sandbox** — no image was built and no size, layer size or startup timing below is a
> measurement. Every Dockerfile on this page is quoted from the documentation, not composed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[02](02-layered-jars.md) gave the model and [02b](02b-extracting-layers-and-the-image-cache.md)
gave the commands. This is the artefact those two pages have been describing: the Dockerfile Spring
Boot publishes, read line by line, plus the two variants that add a startup cache. Nothing here is
invented — the value of this page is knowing *why* each line is where it is, so that you can tell
which of them are load-bearing when someone hands you a modified copy.**

## The documented Dockerfile

```dockerfile
# Perform the extraction in a separate builder container
FROM bellsoft/liberica-openjre-debian:25-cds AS builder
WORKDIR /builder

# This points to the built jar file in the target folder
# Adjust this to 'build/libs/*.jar' if you're using Gradle
ARG JAR_FILE=target/*.jar

# Copy the jar file to the working directory and rename it to application.jar
COPY ${JAR_FILE} application.jar

# Extract the jar file using an efficient layout
RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# This is the runtime container
FROM bellsoft/liberica-openjre-debian:25-cds
WORKDIR /application

# Copy the extracted jar contents from the builder container into the working directory in the runtime container
# Every copy step creates a new docker layer
# This allows docker to only pull the changes it really needs
COPY --from=builder /builder/extracted/dependencies/ ./
COPY --from=builder /builder/extracted/spring-boot-loader/ ./
COPY --from=builder /builder/extracted/snapshot-dependencies/ ./
COPY --from=builder /builder/extracted/application/ ./
# Start the application jar - this is not the uber jar used by the builder
# This jar only contains application code and references to the extracted jar files
# This layout is efficient to start up and AOT cache (and CDS) friendly
ENTRYPOINT ["java", "-jar", "application.jar"]
```

Built with either of:

```bash
docker build --build-arg JAR_FILE=path/to/myapp.jar .
```

```bash
docker build .
```

## Why two stages

**The builder stage exists to hold the uber jar, and it is discarded.** That is the entire reason
for the multi-stage structure, and it is worth being explicit because a single-stage version of this
file *works* and is meaningfully worse.

🔴 **In a single stage, the uber jar is in the image.** You copied it in, so it occupies a layer,
and extracting it beside itself means the image carries **two copies of every dependency** — one
inside the archive, one extracted. Deleting the jar in a later `RUN` does not help: layers are
additive, and a file removed in layer N is still present in layer N−1 and still shipped.

**With two stages, only the four `COPY --from=builder` lines contribute to the final image.**
Everything the builder did — receiving the jar, running the extraction, writing an `extracted/`
tree — is thrown away.

⚠️ **The `WORKDIR` differs deliberately between stages**: `/builder` while extracting, `/application`
at runtime. The `--from=builder` paths are absolute (`/builder/extracted/...`) precisely because the
second stage's working directory is somewhere else.

## Line by line

**`FROM bellsoft/liberica-openjre-debian:25-cds`** — a **JRE**, not a JDK, and the tag pins Java
**25**. The documentation uses the same image for both stages, which keeps the extraction and the
runtime on identical bytes.

⚠️ **The extraction genuinely only needs a JRE**, because the `tools` jar mode ships inside your jar
— [02b](02b-extracting-layers-and-the-image-cache.md) noted that Boot adds
`spring-boot-jarmode-tools` automatically when the layers index is present. **No JDK, no network, no
extra tooling in the builder.** *(Base image choice — JRE versus JDK, distroless, Alpine and the
debugging you give up — is its own argument in `03-base-images.md`* **not written yet**.*)*

**`ARG JAR_FILE=target/*.jar`** — a default that makes `docker build .` work with no arguments in a
Maven project, and the comment tells Gradle users to change it to `build/libs/*.jar`.

🔴 **The glob is the fragile part of this file.** It works because Boot's Maven plugin, per its
documentation, *"replaces the original artifact with the repackaged one"* and *"the original (that
is non-executable) artifact is renamed to `.original` by default"* — and `*.jar` does not match
`.jar.original`. **Configure a `classifier` and that stops being true**: you then have two real
`.jar` files in `target/`, the glob matches both, and the build breaks in a way whose message is
about `COPY`, not about your POM.

**`COPY ${JAR_FILE} application.jar`** — the rename is what makes every subsequent line
version-independent. Without it the `RUN` and the `ENTRYPOINT` would have to name
`myapp-1.4.2.jar`, and every release would edit the Dockerfile.

**`RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted`** —
`--layers` is the flag that produces one directory per layer instead of the flat extracted form.
[02b](02b-extracting-layers-and-the-image-cache.md) has the full argument; the short version is that
without it the four `COPY` lines below have nothing to copy.

**The four `COPY --from=builder` lines** — in `layers.idx` order, slowest-changing first, all landing
in the same `WORKDIR`. The documentation's own comment states the mechanism: *"Every copy step
creates a new docker layer. This allows docker to only pull the changes it really needs."*

**`ENTRYPOINT ["java", "-jar", "application.jar"]`** — 🔴 **this `application.jar` is not the one the
builder received.** It came out of `extracted/application/`, and the documentation is explicit:
*"this is not the uber jar used by the builder. This jar only contains application code and
references to the extracted jar files."* The name is the same; the artefact is not.

⚠️ **The exec form — a JSON array — matters and is not decoration.** It runs `java` as PID 1 with no
intervening shell, which is what lets a `SIGTERM` from the orchestrator reach the JVM. *(What the
JVM then does with that signal is `12-graceful-shutdown`'s subject.)*

## What each layer costs

**Qualitatively, and without inventing numbers** — the ordering is the point, not the magnitudes:

| Layer | Relative bulk | Rebuilt when |
|---|---|---|
| `dependencies` | 🔴 nearly all of it | a released dependency version changes |
| `spring-boot-loader` | tiny | Spring Boot is upgraded |
| `snapshot-dependencies` | usually empty | a snapshot is rebuilt |
| `application` | small | every commit |

🔴 **The asymmetry between the first and last row is the whole return on this Dockerfile.** The
layer that is nearly all of the bytes changes rarely; the layer that changes constantly is small.
Ordering them the other way round would give you the single-layer behaviour at every commit.

⚠️ **This page deliberately quotes no sizes.** Actual figures depend entirely on the dependency set,
and `09-image-size-and-startup.md` *(not written yet)* is where measurement belongs.

**The same skeleton gains a startup cache with two more instructions — a training run and a flag —
and where those go is not arbitrary:
[02d](02d-the-cache-variants-of-the-dockerfile.md).**

## Gotchas

**★ 🔴 A single-stage version of this file ships two copies of every dependency.**
The uber jar occupies a layer and the extracted tree occupies another. Deleting the jar in a later
`RUN` does not reclaim it — layers are additive, so a file removed in layer N is still present in
layer N−1 and still pulled.

**★ The builder stage is discarded, which is the entire point of it.**
Only the four `COPY --from=builder` lines contribute to the final image. Everything the builder
received, ran and wrote is thrown away.

**★ `ARG JAR_FILE=target/*.jar` breaks the moment you configure a `classifier`.**
Boot's Maven plugin *"replaces the original artifact"* and renames the non-executable one to
`.original`, so by default exactly one `.jar` matches. A `classifier` leaves two real `.jar` files
in `target/` and the glob matches both — and the error is about `COPY`, not about your POM.

**★ The `.original` rename is why the default glob is safe at all.**
*"The original (that is non-executable) artifact is renamed to `.original` by default."* If Boot had
left it as a `.jar`, `target/*.jar` would never have worked as a documented default.

**★ The rename to `application.jar` is what keeps the file version-independent.**
Skip it and the `RUN` and `ENTRYPOINT` have to name a versioned jar, so every release edits the
Dockerfile.

**★ 🔴 The `ENTRYPOINT`'s `application.jar` is a different file from the builder's.**
It came from `extracted/application/`. *"This is not the uber jar used by the builder."* Same name,
different artefact — which is exactly why pointing the entrypoint at the wrong one is invisible.

**★ The exec form of `ENTRYPOINT` is load-bearing for shutdown.**
The JSON-array form runs `java` as PID 1 with no shell in between, which is what lets `SIGTERM`
reach the JVM at all. The shell form silently breaks orchestrated shutdown.

**★ Both stages use the same base image, deliberately.**
Extraction and runtime then run on identical bytes. Using a JDK for the builder and a JRE at runtime
works, but it buys nothing here — the extraction needs no compiler.

**★ 🔴 The extraction needs no JDK and no network.**
`spring-boot-jarmode-tools` is added to your jar automatically when the layers index is present, so
the tooling arrives inside the artefact being extracted.

**★ `WORKDIR` differs between the stages on purpose.**
`/builder` while extracting, `/application` at runtime, and the `--from=builder` paths are absolute
because of it. Copying this file into a project and "tidying" the paths to be relative breaks it.

**★ The four-layer ordering is the entire return, and reversing it is silent.**
`dependencies` is nearly all of the bytes and changes rarely; `application` is small and changes
constantly. Copy them the other way round and every commit rebuilds everything, with no error.

**★ The Gradle change is one line, and the comment says so.**
*"Adjust this to 'build/libs/*.jar' if you're using Gradle."* Nothing else in the file is
build-tool-specific — which is worth knowing before someone rewrites it for Gradle from scratch.

**★ 🔴 Do not add sizes to this file from memory.**
Image and layer sizes depend entirely on the dependency set. Any number quoted without a measurement
in front of you is fabricated, and it is the easiest thing on this page to get confidently wrong.

## Interview questions

**★ Why is the documented Dockerfile multi-stage? What breaks if you flatten it to one stage?**
The builder stage exists to receive the uber jar and extract it, and then be thrown away. Flatten it
and the uber jar is in the final image — so the image carries every dependency twice, once inside
the archive and once extracted. Deleting the jar afterwards does not help, because layers are
additive: a file removed in a later layer is still present in the earlier one and still gets pulled.

**★ Walk through what each instruction is for.**
`FROM ... AS builder` and `WORKDIR /builder` set up a throwaway stage. `ARG JAR_FILE` with a glob
default lets `docker build .` work unmodified in a Maven project. `COPY ${JAR_FILE} application.jar`
renames the artefact so nothing downstream names a version. The `RUN` extracts with `--layers`,
producing one directory per layer. The second `FROM` starts the real image, and the four
`COPY --from=builder` lines bring the layers over in index order, slowest-changing first, each
creating an image layer. `ENTRYPOINT` runs the extracted application jar in exec form.

**★ The builder and the runtime use the same base image. Is that necessary?**
No, but it is sensible. The extraction needs only a JRE, because the tooling that reads the layer
index is added to your jar automatically when the index is present — so there is no reason to pull a
JDK for the builder. Using one image for both keeps extraction and runtime on identical bytes and
means one thing to upgrade.

**★ `ARG JAR_FILE=target/*.jar` is a glob. When does it bite?**
When more than one `.jar` is in `target/`. By default it is safe: Boot's Maven plugin replaces the
main artefact and renames the non-executable original to `.original`, which the glob does not match.
Configure a `classifier` and both the plain and the repackaged jar are real `.jar` files, the glob
matches two, and the build fails with a message about `COPY` that says nothing about the POM change
that caused it.

**★ Why is the `ENTRYPOINT` running `application.jar` when the builder also had an
`application.jar`?**
Because they are different files with the same name. The builder's was the uber jar you copied in;
the runtime's came out of `extracted/application/` and, per the documentation, *"only contains
application code and references to the extracted jar files."* The naming collision is why an
entrypoint pointed at the wrong artefact is such a quiet mistake — it runs fine, keeps the
nested-jar startup cost, and forfeits AOT cache eligibility.

**★ Why does the exec form of `ENTRYPOINT` matter?**
The JSON-array form runs `java` directly as PID 1. The shell form wraps it in `/bin/sh -c`, so the
shell is PID 1 and `SIGTERM` from the orchestrator goes to the shell rather than the JVM. Graceful
shutdown then does not happen and the container is eventually killed instead.

**★ Someone hands you this Dockerfile with the four `COPY` lines alphabetised. What do you tell
them?**
That it still builds, still runs, and has quietly lost most of its value. Image layers cache in
order, so the copies must be slowest-changing first — the order `layers.idx` itself specifies.
Alphabetising puts `application` first, which means every commit invalidates every layer after it.
There is no error; the symptom is push and pull times.

**★ Why does this page not tell you how big each layer is?**
Because layer sizes are a property of the dependency set, not of the technique, and there was no
build behind this page. The structural claim — that `dependencies` is nearly all of the bytes and
changes rarely, while `application` is small and changes constantly — is what justifies the
ordering, and it holds without any specific number. A quoted size with no measurement behind it is
fabrication.

**★ What is the minimum change to make this file work for a Gradle project?**
One line: `ARG JAR_FILE=build/libs/*.jar`. The documentation's own comment says so, and nothing else
in the file depends on the build tool — the jar mode, the layer names and the copy order are
properties of the artefact, not of what produced it.

{/* FOOTER */}
