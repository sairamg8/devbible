# Topic 10 · Packaging for deploy — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **turning a build output into a thing that runs**: the executable jar, layers, images,
`jlink`, CDS and the **AOT cache**. 🔴 **Phase 8 owns the build**; **11 owns native image**;
**03 owns sizing the container**; **12 owns stopping it**. Docker mechanics are linked.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-fat-jar.md` | Boot's nested-jar format and `JarLauncher`; not a shaded jar |
| 1b | `01b-why-not-shading.md` | Duplicate resources, signatures, and `META-INF/services` collisions |
| 2 | `02-layered-jars.md` | `layers.idx`, `jarmode=tools extract`, and the Docker cache that stops rebuilding |
| 2b | `02b-a-real-layered-dockerfile.md` | Multi-stage, ordered `COPY`, and what each layer costs |
| 3 | `03-base-images.md` | JRE vs JDK, distroless, Alpine/musl, and the debugging you gave up |
| 3b | `03b-non-root-and-filesystem.md` | `USER`, read-only root, writable tmp, and the dump directory |
| 4 | `04-jlink.md` | A custom runtime; `jdeps`; when it beats a stock JRE |
| 5 | `05-class-data-sharing.md` | Default CDS, AppCDS, `-XX:SharedArchiveFile`, auto-creation |
| 5b | `05b-the-aot-cache.md` | 🔴 JEP 483 (JDK 24) + **JEP 514 ergonomics** and **JEP 515 method profiling** (JDK 25); training run → `-XX:AOTCache` |
| 5c | `05c-when-aot-helps-and-when-it-does-not.md` | Startup vs peak; the cache that went stale |
| 6 | `06-spring-boot-aot-processing.md` | Build-time bean definitions; what it does for the JVM, not just native |
| 7 | `07-buildpacks.md` | `bootBuildImage`/`spring-boot:build-image`, Paketo, and what it decides for you |
| 8 | `08-configuration-at-deploy-time.md` | Env vars, profiles, and the secret that must not be in the image |
| 9 | `09-image-size-and-startup.md` | What actually moves each number, in measured order |
| 10 | `10-the-checklist.md` | A production-shaped image, item by item |

## Verify, do not assume
- ⚠️ 🔴 The **Boot 4.1** `jarmode` invocation — `-Djarmode=tools` and its subcommands. The
  older `-Djarmode=layertools` was superseded; check which 4.1 documents.
- ⚠️ 🔴 The exact AOT cache flags on JDK 25: `-XX:AOTMode`, `-XX:AOTConfiguration`,
  `-XX:AOTCache`. Quote the `java` tool reference; JEP 514 changed the ergonomics.
- ⚠️ Whether default CDS is on by default on JDK 25 and for which archive.
- ⚠️ **No fabricated image sizes or startup timings.**
