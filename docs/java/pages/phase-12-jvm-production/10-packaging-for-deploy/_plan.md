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
| 1b | `01b-why-not-shading.md` | `META-INF/services` collisions and jar-signature invalidation |
| 1c | `01c-the-collision-catalogue.md` | The fifteen resource transformers read as an incident log |
| 1d | `01d-minimizing-relocating-and-choosing.md` | `minimizeJar`, relocation, and the library-vs-application rule |
| 2 | `02-layered-jars.md` | `layers.idx` as an index, the four layers, and the rate-of-change sort |
| 2b | `02b-extracting-layers-and-the-image-cache.md` | `tools` jar mode, `extract --layers`, `COPY` order, and what you launch |
| 2c | `02c-a-real-layered-dockerfile.md` | Multi-stage, ordered `COPY`, and what each layer costs |
| 2d | `02d-the-cache-variants-of-the-dockerfile.md` | The AOT-cache and CDS variants: forced instruction positions |
| 3 | `03-base-images.md` | JRE vs JDK, the `jdk.*` modules you delete, and the debugging you gave up |
| 3b | `03b-alpine-and-musl.md` | JEP 386, the SA attach limitation, and the 6 MB / 38 MB arithmetic |
| 3c | `03c-musl-runtime-differences.md` | Thread stacks, the parallel resolver, `ndots`, and JEP 400's residue |
| 3d | `03d-distroless.md` | No shell, no package manager, the `:debug` JDK swap, and the fixed ENTRYPOINT |
| 3e | `03e-non-root-and-filesystem.md` | `USER`, read-only root, writable tmp, and the dump directory |
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

## Written so far — positions are contiguous, do not reuse
| pos | file |
|---|---|
| 1 | `01-the-fat-jar.md` |
| 2 | `01b-why-not-shading.md` |
| 3 | `01c-the-collision-catalogue.md` |
| 4 | `01d-minimizing-relocating-and-choosing.md` |
| 5 | `02-layered-jars.md` |
| 6 | `02b-extracting-layers-and-the-image-cache.md` |
| 7 | `02c-a-real-layered-dockerfile.md` |
| 8 | `02d-the-cache-variants-of-the-dockerfile.md` |
| 9 | `03-base-images.md` |
| 10 | `03b-alpine-and-musl.md` |
| 11 | `03c-musl-runtime-differences.md` |
| 12 | `03d-distroless.md` |
| 13 | `03e-non-root-and-filesystem.md` |
| 14 | `04-jlink.md` |
| 15 | `04b-jdeps-and-the-module-set.md` |
| 16 | `05-class-data-sharing.md` |
| 17 | `05b-creating-a-cds-archive.md` |
| 18 | `05c-the-training-run.md` |
| 19 | `05d-the-aot-cache.md` |
| 20 | `05e-aot-modes-and-diagnosis.md` |
| 21 | `05f-when-the-cache-helps.md` |
| 22 | `06-spring-boot-aot-processing.md` |
| 23 | `06b-enabling-spring-aot-on-the-jvm.md` |
| 24 | `06c-what-aot-processing-gives-up.md` |
| 25 | `07-buildpacks.md` |
| 26 | `07b-what-paketo-decides.md` |
| 27 | `08-configuration-at-deploy-time.md` |
| 28 | `09-image-size-and-startup.md` |
| 29 | `10-the-checklist.md` |

## 🔴 STILL OWED — the topic is NOT closed

**`README.md` at `sidebar_position: 0`** — `sidebar_label: "Overview"`, argumentative `title:`,
`t-understand` badge, `> Verified:` line, opening argument, the full 29-row chunk table
(`| # | Chunk | Tier | What it argues |`) in the reading order above, and a "what this topic is
really about" section. Copy `../../phase-11-testing/02-assertj/README.md` exactly.
**That is the only outstanding file.** All 29 content chunks are written.

🔴 **Next free `sidebar_position` is 30** if any further chunk is ever added; the README takes **0**.

## Renumbering that happened (the plan's chunk letters were a plan, not a budget)

| Plan row | Became |
|---|---|
| `3` base images | `03` (JRE vs JDK) + `03b` (Alpine/musl port) + `03c` (musl runtime differences) + `03d` (distroless) |
| `3b` non-root | `03e-non-root-and-filesystem.md` |
| `4` jlink | `04` + `04b-jdeps-and-the-module-set.md` |
| `5` CDS | `05` + `05b-creating-a-cds-archive.md` + `05c-the-training-run.md` |
| `5b` AOT cache | `05d-the-aot-cache.md` + `05e-aot-modes-and-diagnosis.md` |
| `5c` when AOT helps | `05f-when-the-cache-helps.md` |
| `6` Spring AOT | `06` + `06b-enabling-spring-aot-on-the-jvm.md` + `06c-what-aot-processing-gives-up.md` |
| `7` buildpacks | `07` + `07b-what-paketo-decides.md` |

Proven splits this session (drafted whole, then cut on a concept boundary; both totals up each time):

| Drafted | Before | After | Both up? |
|---|---|---|---|
| `03b-alpine-and-musl.md` | 1 file · 317 L · 20 ★ | 2 files · 520 L · 35 ★ | ✅ |
| `05b-creating-a-cds-archive.md` | 1 file · 306 L · 19 ★ | 2 files · 499 L · 34 ★ | ✅ |
| `06-spring-boot-aot-processing.md` | 1 file · 319 L · 17 ★ | 2 files · 494 L · 31 ★ | ✅ |

Earlier session's splits: `01b` 406 L → 3 files; `02` 352 L → 2 files; `02c` 322 L → 2 files.
