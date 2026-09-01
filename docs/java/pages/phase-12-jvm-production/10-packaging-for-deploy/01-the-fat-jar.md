---
title: "A Spring Boot jar is not a shaded jar — it is a nested archive with its dependencies kept whole inside it and a launcher that knows how to read them, which is why it works when a shaded jar would have silently broken"
sidebar_label: "01 · The fat jar"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference documentation**, "Packaging → Efficient
> Deployments" (documented for Spring Boot 4.1.x)
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)),
> and the **JDK 25 `java` tool reference** for class-path and jar behaviour
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> 🔴 **No sandbox** — no build was run and no image size or startup timing below is a measurement.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"Fat jar" is a single name for two quite different things, and the difference decides whether
your application works. A *shaded* jar unpacks every dependency and merges the classes together. A
Spring Boot jar keeps each dependency intact as a nested jar and ships a launcher that can read
them. This page is that distinction and why Boot chose the harder one.**

## The layout

A Boot jar is a jar containing jars:

```text
my-app.jar
├── META-INF/
│   └── MANIFEST.MF          Main-Class: the launcher; Start-Class: yours
├── org/springframework/boot/loader/   the launcher classes
└── BOOT-INF/
    ├── classes/             your compiled classes and resources
    ├── lib/                 every dependency, as an intact .jar
    └── layers.idx           the layer index — 02
```

🔴 **`BOOT-INF/lib/` contains real, unmodified jars.** Nothing is unpacked, nothing is renamed,
nothing is merged.

**The manifest carries two entries**, and the distinction between them is the whole trick:
`Main-Class` names Boot's launcher, and `Start-Class` names *your* class with `main`. The JVM
starts the launcher; the launcher sets up a class loader that can read classes out of nested jars,
then calls your `Start-Class`.

⚠️ **The standard Java class path cannot do this.** `java -jar` reads classes from *within* one
archive, not from archives *inside* it. The launcher exists precisely because there is no
JVM-native way to put a jar on the class path when it lives inside another jar.

## Why not just merge everything

Shading — unpacking every dependency and writing all the classes into one flat archive — is the
obvious alternative and it is what the Maven Shade plugin does. It works for many applications and
fails in ways that are hard to diagnose. [01b](01b-why-not-shading.md) is that argument in full;
the short version is **resource collisions, signature invalidation and `META-INF/services`
overwrites**, all of which produce runtime failures rather than build errors.

**Keeping the jars whole avoids all of it by construction.** Two dependencies can both contain
`META-INF/services/java.sql.Driver` and neither overwrites the other, because neither was ever
unpacked.

## 🔴 Do not run the nested jar in production

The Boot documentation is direct about this, and it surprises people who assume the single-file
artefact is the point:

> *"Loading classes from nested jars has a small startup cost"* and running from an exploded
> structure *"is faster and recommended in production"*.

**The recommended sequence** is to extract at image-build time and run the extracted form:

```bash
java -Djarmode=tools -jar my-app.jar extract
java -jar my-app/my-app.jar
```

After extraction, the documentation describes the layout:

> *"Libraries are extracted to a `lib/` folder"* and *"The application jar contains the application
> classes and a manifest which references the libraries in the `lib/` folder"*

— so the extracted application jar is an ordinary jar with an ordinary `Class-Path` manifest entry.
The launcher's nested-jar machinery is no longer in the picture.

⚠️ **`extract` is a subcommand of `-Djarmode=tools`.** The older `-Djarmode=layertools` was
superseded; a Dockerfile still using it is written against an older Boot.
`java -Djarmode=tools -jar my-app.jar help extract` lists the options.

**Two things this buys**, and only the first is obvious:

1. **Faster startup**, by removing the nested-jar reading cost.
2. 🔴 **It is the prerequisite for the AOT cache and CDS.** The documentation says the default
   layout is *"AOT cache and CDS friendly"*, and — decisively —
   [05d](05d-the-aot-cache.md) records that a cache *"has to be used with the extracted form of the
   application, otherwise it has no effect"*. **The single-file jar silently gets no benefit.**

⚠️ **Runtime performance is unaffected.** The documentation: *"After startup, you should not expect
any differences in execution time between running an executable jar and running an extracted
jar."* This is a startup-time and cache-enablement decision, not a throughput one.

## What the single file is still good for

Being fair: the executable jar is an excellent *distribution* format and that is what it was
designed for. One file, one `java -jar`, no unpacking, no layout to get wrong. For a CLI tool, a
developer running it locally, or anything handed to someone else to run, it is the right artefact.

🔴 **The tension is only in a container**, where you control the filesystem, build the image once,
and start the process thousands of times. There, the packaging convenience buys nothing and costs
startup time plus the AOT cache.

## Gotchas

**★ A Boot jar is not a shaded jar.**
Dependencies stay whole inside `BOOT-INF/lib/`. Nothing is unpacked or merged, which is what avoids
the entire class of collisions in [01b](01b-why-not-shading.md).

**★ `Main-Class` is Boot's launcher; `Start-Class` is yours.**
The JVM cannot load classes from a jar nested inside another jar, so the launcher exists to provide
a class loader that can. Expecting `java -jar` alone to do this misreads the format.

**★ The nested format costs startup time, and the docs say so.**
*"Loading classes from nested jars has a small startup cost"*, and running extracted *"is faster
and recommended in production"*.

**★ 🔴 The AOT cache has no effect on a non-extracted jar.**
The documentation states the cache *"has to be used with the extracted form of the application,
otherwise it has no effect"*. It does not warn you — the cache simply does nothing, which is the
most expensive silent failure in this topic.

**★ It is `-Djarmode=tools`, not `layertools`.**
The older spelling was superseded. A Dockerfile carrying it is written against an older Boot, and
`help extract` lists the current options.

**★ Extraction does not change runtime performance.**
*"After startup, you should not expect any differences in execution time."* If someone justifies
extraction on throughput grounds, the justification is wrong even though the conclusion is right.

**★ The single-file jar is a good distribution format.**
For a CLI tool or an artefact handed to someone else, one file and one command is exactly right.
The argument against it applies to containers, where you control the filesystem anyway.

**★ Extracting at runtime instead of build time wastes the benefit.**
An entrypoint that extracts on every container start pays the unpacking cost every time and defeats
Docker layer caching. Extract in the build.

## Interview questions

**★ What is inside a Spring Boot executable jar?**
Your classes in `BOOT-INF/classes/`, every dependency as an intact jar in `BOOT-INF/lib/`, Boot's
launcher classes, a `layers.idx` index, and a manifest whose `Main-Class` is the launcher and whose
`Start-Class` is your application class. It is a jar containing jars — nothing is unpacked or
merged.

**★ How is that different from a shaded jar, and why does Boot do it that way?**
A shaded jar unpacks every dependency and merges all the classes into one flat archive. Boot keeps
each dependency whole. That avoids resource collisions, invalidated signatures and overwritten
`META-INF/services` files by construction — two dependencies can both contain the same resource
path and neither loses, because neither was ever unpacked.

**★ Why does the JVM need a launcher at all?**
Because the standard class path cannot reference a jar nested inside another jar. `java -jar` reads
classes from within one archive, not from archives inside it. Boot's launcher installs a class
loader that understands the nested layout and then invokes the real `Start-Class`.

**★ Should you run the executable jar directly in production?**
No. The documentation says loading classes from nested jars has a startup cost and that running
from an extracted structure is faster and recommended. Extract at image-build time with
`java -Djarmode=tools -jar my-app.jar extract` and run the extracted jar. Crucially, extraction is
also a prerequisite for the AOT cache — the cache has no effect on a non-extracted application.

**★ What is the most expensive mistake in Boot packaging?**
Configuring an AOT cache against a non-extracted jar. The documentation states plainly that the
cache *"has to be used with the extracted form of the application, otherwise it has no effect"* —
and there is no warning. The startup improvement simply never materialises, and because nothing
fails, the configuration looks correct in review and in the pipeline.

**★ Does extracting the jar make the application faster?**
Only to start. The documentation is explicit that after startup there is no expected difference in
execution time. The reasons to extract are startup latency and enabling the AOT cache and CDS — not
throughput, and anyone justifying it on throughput grounds has the right answer for the wrong
reason.

{/* FOOTER */}
