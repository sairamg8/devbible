---
title: "A jar is one file, and a Docker layer is one file's worth of cache invalidation — layers.idx exists to cut that single file into four along the axis of how often each part changes, so that recompiling your code no longer re-pushes Spring"
sidebar_label: "02 · Layered jars"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference documentation** — "Packaging → Container
> Images → Efficient Container Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/efficient-images.html)),
> "Packaging → Container Images → Dockerfiles"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/dockerfiles.html)),
> and "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)).
> 🔴 **No sandbox** — no build was run and no image size, layer size or push duration below is a
> measurement. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[01](01-the-fat-jar.md) established that a Boot jar keeps its dependencies whole and that you
should extract it before running it in production. This page is the second reason to extract, and
in day-to-day terms it is the bigger one: a jar is a single file, and a container image caches at
file granularity, so one unchanged byte of your own code is the difference between pushing 2 MB and
pushing everything Spring ships.**

## The problem, stated by the documentation

Spring Boot's own framing is unusually blunt about the naive approach, and it names two separate
costs:

> *"It is easily possible to package a Spring Boot uber jar as a Docker image. However, there are
> various downsides to copying and running the uber jar as-is in the Docker image. There's always a
> certain amount of overhead when running an uber jar without unpacking it, and in a containerized
> environment this can be noticeable. The other issue is that putting your application's code and
> all its dependencies in one layer in the Docker image is not optimal."*

🔴 **Those are two independent problems and they are fixed by the same step.** The first is the
nested-jar reading cost from [01](01-the-fat-jar.md), paid at every start. The second is a *build
and distribution* cost, paid at every push and every pull. Extraction addresses both, which is why
"extract in the builder stage" is the single highest-leverage line in a Java Dockerfile.

The rationale for splitting follows immediately, and it is a statement about *rates of change*:

> *"Since you probably recompile your code more often than you upgrade the version of Spring Boot
> you use, it's often better to separate things a bit more. If you put jar files in the layer before
> your application classes, Docker often only needs to change the very bottom layer and can pick
> others up from its cache."*

⚠️ **"The very bottom layer" here means the last one added**, not the base image. Layer vocabulary
inverts depending on whether you picture the stack growing up or down; the operational meaning is
unambiguous — **the layer added last is the only one that has to change.**

## `layers.idx` — an index, not a repackaging

The critical property is that layering does **not** alter the jar's contents. It adds a file
describing how to cut it up later:

> *"To make it easier to create optimized Docker images, Spring Boot supports adding a layer index
> file to the jar. It provides a list of layers and the parts of the jar that should be contained
> within them. The list of layers in the index is ordered based on the order in which the layers
> should be added to the Docker/OCI image."*

🔴 **Two things in that sentence carry weight.** First, the index maps *"the parts of the jar"* to
layers — it is a partition of entries that already exist, so a layered jar is still a perfectly
ordinary runnable Boot jar. Second, **the order in the file is prescriptive**: it is the order the
layers *should be added* in, and the whole benefit depends on honouring it.

The documented shape of the file:

```text
- "dependencies":
  - BOOT-INF/lib/library1.jar
  - BOOT-INF/lib/library2.jar
- "spring-boot-loader":
  - org/springframework/boot/loader/launch/JarLauncher.class
  - ... <other classes>
- "snapshot-dependencies":
  - BOOT-INF/lib/library3-SNAPSHOT.jar
- "application":
  - META-INF/MANIFEST.MF
  - BOOT-INF/classes/a/b/C.class
```

**Note what is in the `application` layer besides your classes**: `META-INF/MANIFEST.MF`. The
manifest names your `Start-Class`, so it belongs with the thing that changes when your code does.

## The four layers and why each is separate

> *"Out-of-the-box, the following layers are supported:*
> - *`dependencies` (for regular released dependencies)*
> - *`spring-boot-loader` (for everything under `org/springframework/boot/loader`)*
> - *`snapshot-dependencies` (for snapshot dependencies)*
> - *`application` (for application classes and resources)"*

**Read the list as a sort by expected change frequency, slowest first:**

| Layer | Changes when | Typical rate |
|---|---|---|
| `dependencies` | you bump a released dependency version | weeks to months |
| `spring-boot-loader` | you upgrade Spring Boot itself | months |
| `snapshot-dependencies` | any snapshot you depend on is rebuilt | 🔴 possibly hourly |
| `application` | you recompile | every build |

🔴 **`snapshot-dependencies` is the layer people ask about, and its existence is the whole design in
miniature.** A `-SNAPSHOT` dependency is by definition unstable — it can change without its version
changing. Leaving it in `dependencies` would make your slowest-changing, largest layer as volatile
as your fastest-changing one, destroying the cache benefit for everything. Isolating it means one
teammate's snapshot rebuild invalidates a small layer instead of the big one.

⚠️ **If you have no snapshot dependencies the layer is empty, and that is fine.** An empty layer
costs essentially nothing and keeps the Dockerfile identical across projects that do and do not use
snapshots.

The documentation states the principle directly:

> *"This layering is designed to separate code based on how likely it is to change between
> application builds. Library code is less likely to change between builds, so it is placed in its
> own layers to allow tooling to re-use the layers from cache. Application code is more likely to
> change between builds so it is isolated in a separate layer."*

**That is the model. The tooling that reads the index, the `COPY` ordering rule it implies, and what
you actually launch afterwards are
[02b](02b-extracting-layers-and-the-image-cache.md).**

## Gotchas

**★ 🔴 Layering does not change the jar — it adds an index.**
`layers.idx` maps *"the parts of the jar"* to layers. A layered jar is still an ordinary runnable
Boot jar, which is why layering can be added to an existing build without changing how anything
runs, and why turning it off is not a rollback risk.

**★ The index is a partition of entries that already exist.**
Nothing is moved, renamed, duplicated or repackaged. Every path listed in `layers.idx` is a path
that was already in the archive — which is what makes the feature safe to adopt.

**★ 🔴 The order in the index is prescriptive, not descriptive.**
It is *"ordered based on the order in which the layers should be added to the Docker/OCI image."*
The file is instructions for your build, and the benefit is entirely conditional on following them.

**★ `snapshot-dependencies` exists to protect the big layer from the volatile one.**
A `-SNAPSHOT` can change without its version changing. Leaving it among released dependencies would
make the largest, slowest-changing layer as volatile as the fastest-changing one.

**★ An empty `snapshot-dependencies` layer is normal and harmless.**
It keeps one Dockerfile working across projects that do and do not use snapshots, at essentially no
cost.

**★ `META-INF/MANIFEST.MF` is in the `application` layer, not a metadata layer.**
It names your `Start-Class`, so it changes when your application does and is grouped by that rate
rather than by what kind of file it is.

**★ `spring-boot-loader` is its own layer because it tracks Boot's version, not yours.**
Everything under `org/springframework/boot/loader` changes when you upgrade Boot — a third distinct
rate, separate from both your code and your third-party dependencies.

**★ A dependency bump invalidates every layer after `dependencies`.**
All four are rebuilt. The design makes code changes cheap; it does not make dependency upgrades
cheap, and expecting otherwise misreads what the layers are sorted by.

**★ "The very bottom layer" in the docs means the one added last.**
Layer vocabulary inverts depending on which way you picture the stack. The operational meaning is
unambiguous: the layer added last is the only one that has to change on a recompile.

**★ Layering is a build-and-distribution optimisation, not a runtime one.**
It changes what gets built, pushed and pulled. It does nothing for throughput, and the startup gain
credited to it in [01](01-the-fat-jar.md) actually comes from extraction rather than from layering
as such.

**★ 🔴 The two documented downsides of an uber jar image are independent problems.**
Nested-jar reading overhead is paid at every start; single-layer caching is paid at every push and
pull. They are fixed by the same extraction step, which is why that one line carries so much of the
value in a Java Dockerfile.

**★ The sort key is rate of change, not size or kind.**
This is why third-party jars and Boot's loader are separated even though both are "libraries", and
why the manifest sits with application classes even though it is metadata.

## Interview questions

**★ What problem does `layers.idx` solve, and why can a plain fat jar not solve it?**
A container image caches per layer, and a fat jar is one file, so any change to it invalidates the
whole layer — a one-line code change re-pushes every dependency you have. `layers.idx` partitions
the jar's entries into groups ordered by how often each changes, so a build can copy them as
separate image layers. Then a recompile only invalidates the `application` layer and everything else
is reused from cache.

**★ Name the four default layers and say why each is separate.**
`dependencies` for released third-party jars, which change when you bump a version;
`spring-boot-loader` for everything under `org/springframework/boot/loader`, which changes when you
upgrade Boot; `snapshot-dependencies` for `-SNAPSHOT` artefacts, which can change without their
version changing; and `application` for your classes and resources, which changes every build. The
split is purely by expected rate of change — that is the documented design intent.

**★ Why does `snapshot-dependencies` deserve its own layer?**
Because a snapshot is mutable at a fixed version. If it sat in `dependencies`, every snapshot
rebuild would invalidate the largest and otherwise most stable layer, and everything after it. On
its own, a snapshot rebuild costs one small layer.

**★ Is a layered jar still a normal Boot jar?**
Yes. Layering adds an index describing how to partition the entries; it does not move, rename or
repackage anything. The jar runs exactly as it did before, which is why adopting layering is a
low-risk build change and why the layer boundaries have no runtime existence at all.

**★ Your image is layered correctly and a colleague reports that a Spring Boot patch upgrade still
re-pushed almost everything. Is something broken?**
No. A Boot upgrade changes `spring-boot-loader` and almost certainly several entries in
`dependencies`, and invalidating `dependencies` invalidates every layer after it. Layering makes
*code* changes cheap; it does not promise cheap dependency or framework upgrades, and expecting it
to is a misreading of what the split is sorted by.

**★ Why is the manifest grouped with application classes rather than with Boot's loader?**
Because the layers are sorted by rate of change, not by what kind of file something is. The manifest
carries `Start-Class`, so it changes when your application changes. Grouping it by category instead
of by volatility would put a fast-changing file in a slow-changing layer and invalidate that layer
on every build.

**★ The documentation lists two downsides of running an uber jar as a container image. What are
they, and are they related?**
Nested-jar reading overhead at startup, and putting code and dependencies in one image layer. They
are independent problems — one is a runtime cost, the other a build and distribution cost — but a
single extraction step fixes both, which is why extracting in the builder stage is the highest-value
line in a Java Dockerfile.

{/* FOOTER */}
