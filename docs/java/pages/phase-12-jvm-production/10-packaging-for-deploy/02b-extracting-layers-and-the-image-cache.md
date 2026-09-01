---
title: "The layer index is instructions for your Dockerfile, and nothing enforces them — `extract --layers` is not the default, the COPY order must match the index, and getting either wrong still builds, still runs, and silently costs you the entire benefit"
sidebar_label: "02b · Extracting layers"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference documentation** — "Packaging → Container
> Images → Dockerfiles"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/dockerfiles.html)),
> "Packaging → Container Images → Efficient Container Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/efficient-images.html)),
> and "Packaging → Efficient Deployments"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/efficient.html)).
> 🔴 **No sandbox** — no build was run and no image size, layer size or push duration below is a
> measurement. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[02](02-layered-jars.md) described what `layers.idx` is and why the four layers are sorted the way
they are. This page is the part that can go wrong: the command that reads the index, the ordering
rule the index is really stating, and the jar you are supposed to launch at the end — three places
where the mistake produces a working image that quietly behaves like the single-layer one you were
escaping.**


## The `tools` jar mode

Layering is consumed through the same jar mode that [01](01-the-fat-jar.md) used for plain
extraction. Launching it with no arguments prints the available commands:

```bash
java -Djarmode=tools -jar my-app.jar
```

> *"Available commands:*
> - *`extract` — Extract the contents from the jar*
> - *`list-layers` — List layers from the jar that can be extracted*
> - *`help` — Help about any command"*

**`list-layers` is the diagnostic you want before you write a Dockerfile.** It answers "does this
jar actually have an index, and what are its layers called" without you having to unzip anything —
and if the answer is that there is no index, your carefully ordered `COPY` lines were never going
to work.

The extraction that produces the four directories:

```bash
java -Djarmode=tools -jar application.jar extract --layers --destination extracted
```

🔴 **`--layers` is not the default.** Plain `extract`, as in [01](01-the-fat-jar.md), gives you the
non-layered extracted form — a `lib/` directory and an application jar. **Adding `--layers` gives
you one directory per layer instead**, named for the layers in the index. Omitting the flag in a
Dockerfile that then copies `extracted/dependencies/` produces a build failure at `COPY` time, which
is at least a *loud* mistake.

⚠️ **`--destination` is a directory that the command creates relative to the working directory.**
The documented invocation pairs it with a `WORKDIR`, and the extracted tree is then addressed from
the second build stage by that path.

**One piece of build magic worth knowing about**, because it explains a dependency you did not
declare:

> *"When you create a jar containing the layers index file, the `spring-boot-jarmode-tools` jar is
> added as a dependency automatically."*

🔴 **The tooling that reads the index ships inside the jar that has the index.** That is what makes
`java -Djarmode=tools -jar` work against an arbitrary Boot jar with no extra downloads in the
builder stage — a genuinely nice property when your build environment has no network.

## Why this maps onto the image cache

A container image is an ordered stack of layers, and **each `COPY` instruction produces one**:

> *"Every copy step creates a new docker layer. This allows docker to only pull the changes it
> really needs."*

**The rule that makes ordering matter** is that a layer's cache validity depends on every layer
before it. Change something early in the stack and everything after it is rebuilt and re-pushed,
regardless of whether its own content changed. So the copies go slowest-changing first:

```dockerfile
COPY --from=builder /builder/extracted/dependencies/ ./
COPY --from=builder /builder/extracted/spring-boot-loader/ ./
COPY --from=builder /builder/extracted/snapshot-dependencies/ ./
COPY --from=builder /builder/extracted/application/ ./
```

🔴 **That order is exactly the order in `layers.idx`, and that is not a coincidence** — the
documentation says the index *"is ordered based on the order in which the layers should be added to
the Docker/OCI image."* **The index is telling you how to write your `COPY` lines.** Reordering
them to taste silently inverts the benefit: put `application` first and every subsequent layer is
invalidated by every code change, which is the single-layer behaviour you were trying to escape,
with extra steps.

**The everyday consequence:** a normal commit changes only `BOOT-INF/classes`, so only the
`application` layer's digest changes, so only that layer is rebuilt, pushed to the registry, and
pulled by every node. Dependencies — which is nearly all of the bytes — are reused from cache
everywhere.

⚠️ **A dependency bump invalidates `dependencies` and therefore everything after it.** All four
layers are rebuilt. That is correct and unavoidable; the design does not promise to make dependency
upgrades cheap, only to stop *code changes* from costing what a dependency upgrade costs.

## What you actually run afterwards

The extracted layout does not leave you running the uber jar. The documentation is explicit that the
jar you launch is a different artefact:

> *"Start the application jar - this is not the uber jar used by the builder. This jar only contains
> application code and references to the extracted jar files. This layout is efficient to start up
> and AOT cache (and CDS) friendly."*

```dockerfile
ENTRYPOINT ["java", "-jar", "application.jar"]
```

🔴 **All four `COPY` lines land in the same `WORKDIR`**, which is why a single `application.jar`
sits alongside the extracted `lib/` contents and finds them through its manifest's class path. The
layer boundaries exist in the *image*, not in the filesystem the JVM sees at runtime.

**And this is the second time the same layout has paid for itself.** [01](01-the-fat-jar.md) noted
that the AOT cache *"has to be used with the extracted form of the application, otherwise it has no
effect"*. The extraction you did for cache-friendly layers is the same extraction the AOT cache
requires — one step, three benefits: startup, image caching, and cache eligibility. The concrete
Dockerfiles, including the AOT and CDS training runs, are
[02c](02c-a-real-layered-dockerfile.md) and [02d](02d-the-cache-variants-of-the-dockerfile.md).

## Gotchas

**★ 🔴 `--layers` is not the default for `extract`.**
Plain `extract` produces the non-layered form — `lib/` plus an application jar. Only
`extract --layers` produces one directory per layer. A Dockerfile that copies
`extracted/dependencies/` after a plain extract fails at `COPY`, which is at least a loud mistake.

**★ 🔴 The `COPY` order must match the index order, and nothing enforces it.**
The documentation says the index *"is ordered based on the order in which the layers should be
added"*. Reordering the `COPY` lines still builds, still runs, and silently destroys the cache
benefit. There is no warning and no error.

**★ Putting `application` first is the exact anti-pattern.**
Every layer after it is invalidated by every code change, reproducing single-layer behaviour while
still paying for the extraction step. The symptom is push and pull times, not a failure.

**★ `list-layers` is the check you skip and then wish you had run.**
It tells you whether the jar has an index at all and what its layers are called, before you write
`COPY` lines against names you assumed.

**★ 🔴 `spring-boot-jarmode-tools` is added to your jar automatically when the index is present.**
That is why `java -Djarmode=tools -jar` works with no extra download in the builder stage — useful
when the build environment has no network. It is also a dependency in your artefact that you never
declared, which surprises people auditing the dependency list.

**★ `--destination` creates a directory relative to the working directory.**
The documented invocation pairs it with a `WORKDIR`, and the second build stage addresses the
extracted tree by that path. Getting the `WORKDIR` and the `--from` path out of step is the other
way the `COPY` lines fail.

**★ The four `COPY` lines all target the same `WORKDIR`.**
Layer boundaries are an image-build concept. At runtime the JVM sees one flat directory containing
`application.jar` and the extracted libraries, found through the manifest's class path.

**★ 🔴 The jar you run after extraction is not the uber jar.**
*"This jar only contains application code and references to the extracted jar files."* An
`ENTRYPOINT` still pointing at the original uber jar works, so nothing complains — while keeping the
nested-jar startup cost and forfeiting AOT cache eligibility.

**★ The extraction serves three purposes at once.**
Startup cost, image-layer caching, and AOT cache/CDS eligibility — *"efficient to start up and AOT
cache (and CDS) friendly"*. Skipping it to keep the Dockerfile short gives up all three, and only
the first is visible without measuring.

**★ A dependency bump invalidates `dependencies` and everything copied after it.**
All four layers are rebuilt. That is correct and unavoidable — the design stops *code* changes from
costing what a dependency upgrade costs, not the upgrade itself.

**★ Every `COPY` creates a layer, including the ones you add for other reasons.**
*"Every copy step creates a new docker layer."* An unrelated `COPY` of a config file inserted
between the extracted layers becomes a cache boundary of its own, in a position nobody chose
deliberately.

**★ Extracting at container start instead of build time defeats the whole thing.**
An entrypoint script that runs `extract` on every start pays the unpacking cost on every start and
produces no image layers at all — the extraction has to happen in the builder stage to become
cache structure.

## Interview questions

**★ Does the order of the `COPY` lines matter, and how would you know if you got it wrong?**
It matters completely, and nothing tells you. Image layers cache in order, so a change early in the
stack invalidates everything after it — the copies must go slowest-changing first, which is exactly
the order `layers.idx` lists. If you got it wrong the image still builds and the application still
runs; the symptom is that ordinary code changes keep re-pushing the full image, so you notice it in
push and pull times rather than in any error.

**★ What is the difference between `extract` and `extract --layers`?**
Plain `extract` gives the non-layered extracted form — a `lib/` directory and an application jar
whose manifest references it. `--layers` additionally splits that output into one directory per
layer from the index, which is what the `COPY` lines address. Both give you the extracted runtime
layout; only `--layers` gives you the cache structure.

**★ How do you check whether a jar you have been handed is layered?**
`java -Djarmode=tools -jar my-app.jar list-layers`. It lists the layers the jar declares, and its
failure to list anything useful tells you there is no index — which you want to know before writing
`COPY` lines against layer names you assumed.

**★ Where does `spring-boot-jarmode-tools` come from?**
Boot adds it automatically when the jar contains a layers index. That is why the `tools` jar mode
works against the jar itself with no additional download in the builder stage, and it is also why an
extra dependency you never declared appears in the artefact.

**★ After extraction, which jar does the `ENTRYPOINT` run?**
The extracted application jar, not the uber jar — *"this jar only contains application code and
references to the extracted jar files."* Pointing the entrypoint at the original uber jar is a
common and invisible mistake: it works, so nothing complains, but you keep the nested-jar startup
cost and forfeit the AOT cache.

**★ You extract the jar for layering. What else does that buy you, and what would you lose by
skipping it?**
The same extracted layout is what the AOT cache and CDS require — the documentation calls it
*"efficient to start up and AOT cache (and CDS) friendly"*, and the cache has no effect on a
non-extracted application. So one step buys reduced startup cost, per-layer image caching, and cache
eligibility. Skipping extraction to keep the Dockerfile short gives up all three.

**★ Why must the extraction happen in a builder stage rather than at container start?**
Because the point is to turn the jar's contents into image layers, and only build-time `COPY`
instructions create layers. Extracting in an entrypoint script produces one opaque layer containing
the uber jar, pays the unpacking cost on every single container start, and gives you no caching at
all — it has the shape of the right idea and none of the benefit.

**★ Someone inserts a `COPY config.yml .` between two of the extracted layer copies. What have they
done?**
Created an unplanned cache boundary. Every `COPY` is a layer, so that file now sits at a fixed
position in the stack and anything after it is invalidated whenever it changes — and it was placed
there by accident rather than by any judgement about how often it changes relative to dependencies
and application code.

{/* FOOTER */}
