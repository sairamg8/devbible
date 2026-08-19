---
title: "Fat jars: three strategies"
sidebar_label: "02 · Fat jars"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Apache Maven Shade Plugin 3.6.x
> documentation (goals, relocation, the resource-transformer catalogue,
> `minimizeJar`), the Maven Assembly Plugin's predefined
> `jar-with-dependencies` descriptor, the Spring Boot reference
> documentation on the executable jar format (nested jars, `JarLauncher`,
> `Start-Class`, `layers.idx`) and the Spring Boot 3.3 release notes
> (the `tools` jar mode superseding `layertools`).

**"One file you can copy and run" is a deployment convenience, and there
are exactly two ways to buy it: merge every dependency's entries into one
flat archive, or keep the dependency jars whole and teach the application
how to read a jar inside a jar. Maven's shade and assembly plugins do the
first. Spring Boot does the second, on purpose, and the reason is the
whole of the next chunk.**

## Three ways to build one deliverable

| Approach | What it produces | Relocation | Merges `META-INF/services` |
|---|---|---|---|
| **maven-shade-plugin** | One **flat** jar; every dependency unpacked and its entries merged | Yes — rewrites package names *and* the bytecode references to them | Only when you add `ServicesResourceTransformer` |
| **maven-assembly-plugin** (`jar-with-dependencies`) | One flat jar, same unpack-and-merge | No | Only with the `metaInf-services` container descriptor handler |
| **Spring Boot repackager** (`spring-boot-maven-plugin`) | Dependency jars kept **whole**, nested under `BOOT-INF/lib/` | Not applicable — nothing is merged | Not applicable — nothing collides |

The first two are the same idea with different ergonomics: explode every
dependency and write the union into one archive. Assembly is the older,
more general tool (it also builds tarballs and directory layouts) and its
`jar-with-dependencies` descriptor is the one-liner everyone reaches for
first. Shade is the one worth learning, because it is the only one of the
two with a real answer for the merge conflicts the approach creates —
resource transformers, filters and relocation. Gradle's equivalent is the
Shadow plugin, which is a port of the same model.

## A shade configuration that is not a trap

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-shade-plugin</artifactId>
  <version>3.6.0</version>
  <executions>
    <execution>
      <phase>package</phase>
      <goals><goal>shade</goal></goals>
      <configuration>
        <createDependencyReducedPom>true</createDependencyReducedPom>
        <transformers>
          <transformer implementation="org.apache.maven.plugins.shade.resource.ManifestResourceTransformer">
            <mainClass>com.acme.App</mainClass>
          </transformer>
          <!-- APPENDS provider entries instead of overwriting the file -->
          <transformer implementation="org.apache.maven.plugins.shade.resource.ServicesResourceTransformer"/>
          <!-- any other text resource that must concatenate rather than replace -->
          <transformer implementation="org.apache.maven.plugins.shade.resource.AppendingTransformer">
            <resource>reference.conf</resource>
          </transformer>
          <transformer implementation="org.apache.maven.plugins.shade.resource.ApacheNoticeResourceTransformer"/>
        </transformers>
        <filters>
          <filter>
            <artifact>*:*</artifact>
            <excludes>
              <exclude>META-INF/*.SF</exclude>
              <exclude>META-INF/*.DSA</exclude>
              <exclude>META-INF/*.RSA</exclude>
              <exclude>META-INF/*.EC</exclude>
              <exclude>module-info.class</exclude>
            </excludes>
          </filter>
        </filters>
        <relocations>
          <relocation>
            <pattern>com.google.common</pattern>
            <shadedPattern>com.acme.shaded.guava</shadedPattern>
          </relocation>
        </relocations>
      </configuration>
    </execution>
  </executions>
</plugin>
```

Every block in there exists because of a failure: the transformers because
same-path resources overwrite each other, the filters because merged
signature files invalidate the jar, the relocation because two versions of
a library cannot share a package name. Chunk 3 walks each one.

`<createDependencyReducedPom>` is the quiet one. Shade rewrites the
published POM to drop the dependencies it absorbed, so consumers do not
download them twice. Leave it on for libraries; it is the difference
between a shaded library and one that ships its dependencies twice.

## Why Spring Boot nests instead of flattening

Boot's repackager builds a very different archive:

```
app.jar
├── META-INF/MANIFEST.MF        Main-Class: org.springframework.boot.loader.launch.JarLauncher
│                               Start-Class: com.acme.App
├── org/springframework/boot/loader/…   the launcher + its class loader
└── BOOT-INF/
    ├── classes/                your code and resources
    ├── lib/                    every dependency, as an intact .jar file
    └── layers.idx              which entries belong to which container layer
```

`Main-Class` points at the launcher, not your code; your real entry point
is recorded as `Start-Class`. The launcher installs a class loader that
can read classes out of jars nested inside a jar — something the JDK's own
loaders will not do, because a zip entry is not a file the OS can map.

Why they took the harder path, plainly:

- **Nothing merges, so nothing collides.** Two libraries with the same
  `META-INF/services/x.Y` file each keep their own copy, in their own jar,
  and `getResources()` returns both — exactly as on a normal classpath.
  The entire class of bug in chunk 3 does not exist here.
- **Dependencies stay identifiable.** SBOM generation, CVE scanning and
  licence auditing can read `BOOT-INF/lib/jackson-databind-2.18.2.jar` and
  know precisely what it is. In a shaded jar, a merged and relocated Guava
  is invisible to every scanner you own.
- **Signatures survive**, because a signed dependency is never rewritten.
- **Layering becomes possible.** Preserved boundaries let the build emit
  `layers.idx`, so a container image can cache dependencies separately
  from application code.

The costs are real too. A Boot jar is **not a normal classpath jar**:
`java -cp app.jar com.acme.App` will not work, and you cannot depend on it
from another module — that is what the plain, un-repackaged jar the plugin
also produces is for. Nested jars are stored **uncompressed** so the
loader can read them in place, so the artifact is larger than a shaded
equivalent. And any tool that expects a flat jar (some agents, some
scanners, some app servers) needs the archive extracted first.

## Layered jars for containers

Because the dependency boundaries survive, the build writes `layers.idx`
naming which entries belong to `dependencies`, `spring-boot-loader`,
`snapshot-dependencies` and `application`. Extracting by layer lets an
image put the ~200 MB of dependencies in a layer that changes monthly and
your ~2 MB of classes in a layer that changes on every commit — so a
rebuild pushes megabytes rather than hundreds of them:

```bash
java -Djarmode=tools -jar app.jar extract --layers --destination extracted
java -Djarmode=tools -jar app.jar list-layers
```

That `tools` jar mode superseded the older `-Djarmode=layertools` form in
Spring Boot 3.3; `layertools` was deprecated in the same release. The
container half of this story — the `Dockerfile` stages, why layer order
decides cache hit rate, and running the extracted form rather than the jar
— is **Phase 12 · Delivery, packaging and containers** *(not written
yet)*.

## When not to build a fat jar

Fat jars solve a deployment problem and charge for it. Be honest about the
bill before reaching for shade:

- **Shading is for libraries and CLI tools, not applications.** A library
  that must not force its Guava version on consumers has a genuine reason
  to relocate. An application deployed by itself has no such constraint,
  and should prefer Boot's nesting or a plain jar plus a `lib/` directory
  and a manifest `Class-Path`.
- **Supply-chain tooling stops working.** Merged and relocated code has no
  coordinates left in it, so scanners report an artifact with no
  dependencies and no CVEs. That is not a clean bill of health; it is
  blindness.
- **Attribution obligations do not disappear** when you overwrite a
  `NOTICE` file. Shade ships `ApacheLicenseResourceTransformer` and
  `ApacheNoticeResourceTransformer` because this is a real legal
  obligation, not a tidiness feature.
- **Debugging degrades.** Relocated packages mean unfamiliar stack traces,
  no matching source jars, and search results about "the real library"
  that no longer match what you see.
- **The build is slower and the artifact bigger** than the sum of the
  parts, on every commit, forever.

If the reason for shading is "two versions of a library conflict", the
honest reading is that the dependency graph has a problem and shading is
the anaesthetic. Fix the graph first; relocate only what genuinely cannot
be reconciled.

## Gotchas

**Symptom:** `java -cp app.jar com.acme.App` fails with `ClassNotFoundException` on a Spring Boot jar that runs fine with `-jar`
**Cause:** a repackaged Boot jar puts your classes under `BOOT-INF/classes/` and its dependencies under `BOOT-INF/lib/`; only `JarLauncher` and its class loader can read that layout
**Fix:** launch it with `java -jar`, or extract it first (`-Djarmode=tools … extract`); to use the code as a library, depend on the plain jar the plugin also produces

**Symptom:** a class disappears at runtime only in the shaded build — `ClassNotFoundException` on a Spring bean or a JDBC driver
**Cause:** `<minimizeJar>true</minimizeJar>` removed it, because nothing referenced it *statically*, which is exactly the set that reflection, DI containers and `ServiceLoader` depend on
**Fix:** turn minimization off, or add explicit `<filter><includes>` entries for the reflectively-loaded packages

**Symptom:** dependency scanning reports the fat jar has zero dependencies and zero CVEs
**Cause:** shading merged and relocated everything; there are no coordinates left inside the artifact to match
**Fix:** scan the *build* — the resolved dependency graph or a generated SBOM — not the artifact; or use Boot's nested format, where `BOOT-INF/lib/` names every jar

**Symptom:** consumers of a shaded library end up downloading its dependencies anyway
**Cause:** `<createDependencyReducedPom>` was disabled, so the published POM still declares the dependencies that were absorbed into the jar
**Fix:** leave the dependency-reduced POM on for any shaded artifact you publish

**Symptom:** `-Djarmode=layertools` prints a deprecation warning, or is not recognised at all
**Cause:** Spring Boot 3.3 introduced the `tools` jar mode and deprecated `layertools`; later versions removed it
**Fix:** switch the `Dockerfile` to `-Djarmode=tools … extract --layers`

## Interview questions

**★ Contrast maven-shade-plugin with the Spring Boot repackager. Why did Spring Boot not just build an uber jar?**
Shade explodes every dependency and merges the entries into one flat
archive, which creates path collisions it then manages with transformers,
filters and relocation. Boot nests the dependency jars whole under
`BOOT-INF/lib/` and ships a class loader that reads a jar inside a jar.
Nothing merges, so nothing collides; dependencies stay identifiable for
SBOM, CVE and licence tooling; signatures survive; and preserved
boundaries make layered container images possible via `layers.idx`. The
price is a non-standard jar — it cannot go on a plain `-cp`, and it is
larger because nested jars are stored uncompressed.

**★ Your team wants one runnable artifact. When would you choose shading over Boot's format, and when neither?**
Shade when the artifact is a **library** whose dependencies must not leak
into consumers' graphs, or a standalone CLI where relocation genuinely
buys isolation. Boot's repackaging when it is a service you deploy —
because you keep dependency visibility, signatures and layering. Neither
when the deployment target can hold a directory: a plain jar plus `lib/`
and a manifest `Class-Path` is smaller, faster to build, trivially
scannable and debuggable. "One file" is a convenience, not a requirement.

**★ What is a resource transformer and why is one needed at all?**
Because a flat merge is a filesystem-style copy: two archive entries with
the same path cannot both exist, so the second overwrites the first. A
transformer intercepts specific paths and defines a *merge* instead of a
replace — concatenating `META-INF/services` provider lists, appending
`reference.conf`, combining `NOTICE` files, rebuilding the manifest.
Without them the fat jar keeps whichever copy the packager happened to
write last, which is why fat jars fail in ways the classpath they were
built from did not.

**★ What do layered jars buy, and what makes them possible?**
They split the artifact into groups that change at different rates —
dependencies, loader, snapshot dependencies, application — so a container
image can cache the slow-moving layers and rebuild only the fast one, and
a redeploy pushes a couple of megabytes instead of the whole image. They
are possible **because Boot did not flatten**: a flat uber jar is one
opaque blob with no boundaries to split on, so no equivalent exists for a
shaded artifact.

---

← Prev: [The format](01-the-format.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [When two libraries collide](03-the-collision.md)
