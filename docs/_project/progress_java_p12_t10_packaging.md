---
name: progress-java-p12-t10-packaging
description: devbible Java phase 12 topic 10 (Packaging for deploy) — session a91e539d's run, the two proven splits, and the VERIFIED primary-source quotes for shading, jar signatures, ServiceLoader, layers.idx and the three Boot Dockerfiles. Read before writing any further chunk in 10-packaging-for-deploy.
metadata:
  type: project
---

# ☕ Java p12 · topic 10 · Packaging for deploy — run record

**Session `a91e539d`, 2026-09-01.** Claimed the row on [[java-board]] and committed the claim before
writing a word, per the claim protocol. Standing order in force: *"After completing current phase do
not start new"* — finish phase 12's 15 topics, then stop.

## What was written

| pos | file | lines | ★ |
|---|---|---|---|
| 1 | `01-the-fat-jar.md` *(pre-existing)* | 182 | 14 |
| 2 | `01b-why-not-shading.md` | 252 | 17 |
| 3 | `01c-the-collision-catalogue.md` | 236 | 17 |
| 4 | `01d-minimizing-relocating-and-choosing.md` | 215 | 20 |
| 5 | `02-layered-jars.md` | 223 | 19 |
| 6 | `02b-extracting-layers-and-the-image-cache.md` | 238 | 20 |
| 7 | `02c-a-real-layered-dockerfile.md` | 272 | 22 |
| 8 | `02d-the-cache-variants-of-the-dockerfile.md` | 222 | 18 |

**Topic total: 8 chunks, 1,875 lines, 149 ★.** No index yet — the topic is **not** closed.
QC at last commit: `mdxcheck.py` 0 hazards; 0 files over the 300-line cap; `devbible-linkcheck.py` 28 links, 1 broken
(`01-the-fat-jar.md → 05b-the-aot-cache.md`, a forward reference that resolves when 05b lands).

## 🔴 Two proven splits — both drafted whole, then cut

| Drafted | Before | After | Both up? |
|---|---|---|---|
| `01b-why-not-shading.md` | 1 file · 406 L · 25 ★ | 3 files · 703 L · 54 ★ | ✅ |
| `02-layered-jars.md` | 1 file · 352 L · 25 ★ | 2 files · 461 L · 39 ★ | ✅ |
| `02c-a-real-layered-dockerfile.md` | 1 file · 322 L · 24 ★ | 2 files · 494 L · 40 ★ | ✅ |

⚠️ **The first split landed at 303 lines — 3 over — and was re-cut three ways instead of shaved.**
Shaving three lines would have passed every check and destroyed content. The second boundary
(services+signatures / the transformer catalogue / minimize+relocate) is better than the first one
anyway, which is the general lesson: **an over-cap result after a split means the boundary was
wrong, not that the content was too long.**

🔴 **The `_plan.md` is maintained** — the Dockerfile chunk moved `02b` → `02c` when 02 split, `02d`
is new, and it now carries a "Written so far" position table. **Next free `sidebar_position` is 9.**

## 🔴 Banked research — VERIFIED, do NOT re-fetch

### Shading (Maven Shade plugin + Spring Boot spec + JAR spec + ServiceLoader javadoc)

**Boot's nested-jars spec** (`docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html`):
- *"A shaded jar packages all classes, from all jars, into a single "uber jar". The problem with
  shaded jars is that it becomes hard to see which libraries are actually in your application. It
  can also be problematic if the same filename is used (but with different content) in multiple
  jars."*
- *"Spring Boot takes a different approach and lets you actually nest jars directly."*
- Layout: `BOOT-INF/classes`, `BOOT-INF/lib`, `org/springframework/boot/loader/`.

**Shade — Resource Transformers page** (`maven.apache.org/plugins/maven-shade-plugin/examples/resource-transformers.html`):
- The framing quote: *"Aggregating classes/resources from several artifacts into one uber JAR is
  straight forward as long as there is no overlap. Otherwise, some kind of logic to merge resources
  from several JARs is required. This is where resource transformers kick in."*
- **Fifteen transformers**, each with a one-line doc string: `ApacheLicenseResourceTransformer`
  (*"Prevents license duplication"*), `ApacheNoticeResourceTransformer` (*"Prepares merged
  NOTICE"*), `AppendingTransformer` (*"Adds content to a resource"*),
  `ComponentsXmlResourceTransformer` (*"Aggregates Plexus `components.xml`"*),
  `DontIncludeResourceTransformer`, `GroovyResourceTransformer`, `IncludeResourceTransformer`,
  `ManifestResourceTransformer`, `PluginXmlResourceTransformer`,
  `ResourceBundleAppendingTransformer`, `ServicesResourceTransformer` (*"Relocated class names in
  `META-INF/services` resources and merges them."*), `XmlAppendingTransformer`,
  `PropertiesTransformer` (*"Merges properties files owning an ordinal to solve conflicts"*),
  `OpenWebBeansPropertiesTransformer`, `MicroprofileConfigTransformer`.

**Shade — `shade:shade` mojo** (`.../shade-mojo.html`):
- `minimizeJar`: *"dependencies will be stripped down on the class level to only the transitive hull
  required"*; *"This feature uses jdependency. Its accuracy therefore depends on jdependency's
  limitations."* See also `entryPoints`.
- `relocations`: `org.apache` → `hidden.org.apache`; *"Support for includes exists only since
  version 1.4."*
- `createDependencyReducedPom` **default `true`**; writes `dependency-reduced-pom.xml` into the
  project basedir.
- `shadedArtifactAttached`: *"If false, the shaded jar will be the main artifact of the project"*.

**Shade FAQ** (`.../faq.html`) — ⚠️ **the FAQ has exactly ONE entry**, and it is *not* about
signatures: *"the second shade execution will (by default) start from the result of the first shade
execution."* Do not cite the FAQ for the signature problem.

**JAR File Specification, JDK 25** (`docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html`) —
this is the source for the signature argument:
- Signature-related files: `META-INF/MANIFEST.MF`, `META-INF/*.SF`, `*.DSA`, `*.RSA`, `*.EC`,
  `SIG-*`. *"Every file entry, including non-signature related files in the `META-INF` directory,
  will be signed."*
- *"if such files are located in `META-INF` subdirectories, they are not considered
  signature-related."*
- `x-Digest-Manifest-Main-Attributes` — *"If this calculation fails, then JAR file verification
  fails."* and *"If any of the digest values don't match, then JAR file verification fails."*

**`ServiceLoader` javadoc, JDK 25** — the load-bearing quote for the whole services argument:
- *"Service providers in unnamed modules are located if their class names are listed in
  provider-configuration files located by the class loader's `getResources` method."*
  🔴 **`getResources`, PLURAL** — the mechanism is designed around many files at one path, which is
  exactly what a flat archive destroys.
- *"If a service provider class is named in more than one configuration file then the duplicate is
  ignored."* — so merging is strictly correct and dropping is indefensible.

### Layering (Spring Boot 4.1.x container-images docs)

**`.../packaging/container-images/efficient-images.html`:**
- *"There's always a certain amount of overhead when running an uber jar without unpacking it, and
  in a containerized environment this can be noticeable. The other issue is that putting your
  application's code and all its dependencies in one layer in the Docker image is not optimal."*
- *"Since you probably recompile your code more often than you upgrade the version of Spring Boot
  you use… If you put jar files in the layer before your application classes, Docker often only
  needs to change the very bottom layer and can pick others up from its cache."*
- *"The list of layers in the index is ordered based on the order in which the layers should be
  added to the Docker/OCI image."* 🔴 **Prescriptive, not descriptive — it is telling you the `COPY`
  order.**
- Four layers: `dependencies`, `spring-boot-loader`, `snapshot-dependencies`, `application`.
- *"This layering is designed to separate code based on how likely it is to change between
  application builds."*
- `layers.idx` example includes `META-INF/MANIFEST.MF` in the **`application`** layer.
- ⚠️ **This page does NOT mention `jarmode`** — the jarmode material is on the dockerfiles page.

**`.../packaging/container-images/dockerfiles.html`** — 🔴 **all three Dockerfiles quoted verbatim
below; this is the banked research for `02c`, `05`, `05b` and `06`.**
- Base image used throughout: **`bellsoft/liberica-openjre-debian:25-cds`**, two-stage
  (`AS builder`, `WORKDIR /builder` → runtime `WORKDIR /application`).
- `ARG JAR_FILE=target/*.jar` (*"Adjust this to 'build/libs/*.jar' if you're using Gradle"*),
  `COPY ${JAR_FILE} application.jar`.
- Extract: `RUN java -Djarmode=tools -jar application.jar extract --layers --destination extracted`
- Four ordered copies, all into the same `WORKDIR`:
  `COPY --from=builder /builder/extracted/dependencies/ ./` then `spring-boot-loader/`, then
  `snapshot-dependencies/`, then `application/`.
- *"Every copy step creates a new docker layer. This allows docker to only pull the changes it
  really needs."*
- *"Start the application jar - this is not the uber jar used by the builder. This jar only contains
  application code and references to the extracted jar files. This layout is efficient to start up
  and AOT cache (and CDS) friendly."* → `ENTRYPOINT ["java", "-jar", "application.jar"]`
- **`tools` jar mode commands**: `extract`, `list-layers` (*"List layers from the jar that can be
  extracted"*), `help`.
- *"When you create a jar containing the layers index file, the `spring-boot-jarmode-tools` jar is
  added as a dependency automatically."*
- 🔴 **AOT cache variant (Java 25+, recommended over CDS)**:
  `RUN java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar application.jar` then
  `ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-jar", "application.jar"]`
- 🔴 **CDS variant (Java 24+)**:
  `RUN java -XX:ArchiveClassesAtExit=application.jsa -Dspring.context.exit=onRefresh -jar application.jar`
  then `ENTRYPOINT ["java", "-XX:SharedArchiveFile=application.jsa", "-jar", "application.jar"]`
- Build: `docker build --build-arg JAR_FILE=path/to/myapp.jar .`

**`.../packaging/aot-cache.html` — the version gate and validity condition:**
- *"Spring Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of
  Java, you have to use CDS instead."* and *"we recommend using the AOT cache whenever possible."*
  🔴 **AOT-vs-CDS is a version gate, not a preference.**
- Cache valid *"as long as the application is not updated and the same Java version is used"* —
  which an in-image training run satisfies by construction, since neither can change without a
  rebuild. **That is a stronger argument for build-time training than "don't pay it at startup".**

**Spring Boot Maven plugin, `.../maven-plugin/packaging.html`** — verified 2026-09-01 for the
`target/*.jar` glob question:
- *"By default, the `repackage` goal replaces the original artifact with the repackaged one."*
- *"The original (that is non-executable) artifact is renamed to `.original` by default but it is
  also possible to keep the original artifact using a custom classifier."*
  🔴 **So the documented `ARG JAR_FILE=target/*.jar` is safe by default and breaks when a
  `classifier` is configured** — two real `.jar` files then match the glob.
- `attach`: *"If no classifier has been configured, it will replace the normal jar."*

⚠️ **The Shade plugin FAQ has exactly ONE entry and it is about chained executions, not signatures.**
Do not cite it for the signature problem — the JAR File Specification is the source.

## 🔴 Banked research for `03-base-images.md` — fetched and verified 2026-09-01, do NOT re-fetch

**JEP 386 · Alpine Linux Port** (`openjdk.org/jeps/386`, Closed/Delivered, **Release 16**,
Scope: Implementation) — fetched with `curl -A "Mozilla/5.0"`, which works where WebFetch 403s:
- Summary: *"Port the JDK to Alpine Linux, and to other Linux distributions that use musl as their
  primary C library, on both the x64 and AArch64 architectures"*.
- *"Musl is an implementation, for Linux-based systems, of the standard library functionality
  described in the ISO C and POSIX standards."*
- *"A Docker base image for Alpine Linux, for example, is less than 6 MB."*
- 🔴 **The limitation nobody quotes:** *"This port will not support the attach mechanism of the
  HotSpot Serviceability Agent."* — **that is the load-bearing fact for this topic**, because the
  attach mechanism is how `jcmd`/`jstack` reach a running JVM. Ties directly to topics 05 and 06.
- jlink angle: *"if a target application depends only on the java.base module then a Docker image
  with Alpine Linux and a Java runtime with just that module and the server VM fits in 38 MB."*
- The glibc-layer alternative was rejected: base Alpine 3.11 musl 5.6 MB + glibc layer 26 MB +
  runtime 38 MB = *"the static footprint overhead of having the glibc portability layer in the image
  is 30%."*

**Distroless** (`github.com/GoogleContainerTools/distroless` README):
- *"'Distroless' images contain only your application and its runtime dependencies."*
- *"They do not contain package managers, shells or any other programs you would expect to find in a
  standard Linux distribution."*
- *"Restricting what's in your runtime container to precisely what's necessary for your app… improves
  the signal to noise of scanners (e.g. CVE) and reduces the burden of establishing provenance to
  just what you need."*
- Size: *"The smallest distroless image, `gcr.io/distroless/static-debian13`, is around 2 MiB.
  That's about 50% of the size of `alpine` (~5 MiB)."*
- 🔴 **Debug variants exist:** *"The `:debug` image set for each language provides a busybox shell to
  enter."*, tagged `debug-<existing tag>`.
- ⚠️ **Java images are NOT deprecated** — current offerings include `java-base`, `java17`, `java21`
  and `java25` for Debian 13. Do not repeat the old "distroless java is going away" claim.

⚠️ **Still to verify before writing 03**: whether `jcmd`/`jstack` ship in a vendor JRE image (they
are JDK tools), and what `bellsoft/liberica-openjre-debian:25-cds` actually contains. **Do not
assert either from memory** — that is exactly the claim that makes topic 03 useful or wrong.

## What is still owed on this topic

`03-base-images.md` at **pos 9**, then `03b`, `04`, `05`, `05b`, `05c`, `06`, `07`, `08`, `09`, `10`
and a `README.md` index. 🔴 **A topic is not closed without the index** — see
[[cursor-java]] for the four-board close checklist.

Related: [[cursor-java]] · [[java-board]] · [[progress-java-p12-run-20260901]] · [[java-playbook]]
