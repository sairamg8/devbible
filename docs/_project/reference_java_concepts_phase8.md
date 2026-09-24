---
name: reference-java-concepts-phase8
description: devbible Java — Phase 8 concept record (The build: Maven, Gradle, dependencies)
metadata:
  type: reference
---

# devbible Java — Phase 8 concept record (The build: Maven, Gradle, dependencies)

Written 2026-08-19, session `32f4663f`. 12 topics, 53 files, 11,156 lines, 0 over the
300-line cap. Commits `5b32ffdd` + `8fa5bf33`. **Documentation-validated — no sandbox,
no console blocks anywhere in the phase.**

## Version facts, all web-verified August 2026 (re-check before reuse)

- **Maven stable is 3.9.16** (2026-05-13). **Maven 4 is still RC — 4.0.0-rc-6**
  (2026-08-04), explicitly not for production, needs JDK 17. Three forks verified this
  independently and agreed. Do NOT write Maven 4 as GA.
- **Gradle 9.7.0** (2026-08-07). Gradle 9 requires Java 17 to *run* Gradle; Kotlin DSL
  default since 8.2; configuration cache "preferred" but not default (target: Gradle 10).
- maven-compiler-plugin **3.15.0** — `source`/`target` still default to **1.8**.
- maven-dependency-plugin **3.11.0**, maven-enforcer-plugin **3.6.3**,
  maven-shade-plugin **3.6.2**.
- **JDK 23+ no longer enables annotation processing implicitly** — `javac` stopped
  searching the class path for processors; `-proc:full` restores it, backported to
  17u/11u/8u. Failure mode is a **succeeding** build with missing generated classes.
- Lombok **1.18.42** carries the JDK 25 fix (stated as "the 1.18.4x line").
- Spring Boot **3.3+** `-Djarmode=tools` supersedes deprecated `layertools`.

## The load-bearing claims (what a reader should leave with)

1. **Mediation differs between the tools and this is the single most surprising fact in
   the phase.** Maven takes **nearest-wins** (with a first-declaration tiebreak at equal
   depth); Gradle takes **highest-wins**. A Maven→Gradle migration silently changes which
   version ships. `requireUpperBoundDeps` is framed as Gradle's rule retrofitted onto
   Maven as an assertion.
2. **A compile-clean build can still ship a `NoSuchMethodError`** — the diamond resolves
   at build time against one version and runs against another. This is why
   `dependency:tree` is the first command in any wrong-version incident, not the last.
3. **Scope transitivity is a rewrite table, not an inheritance rule** — a dependency's
   scope changes when it arrives transitively. Nobody knows this table; it earns a real
   table on the page.
4. **Spring Boot's repackager includes `provided` in `BOOT-INF/lib`** (documented),
   inverting the plain jar/war rule and defeating the common "use `provided` as a
   poor man's exclusion" habit.
5. **`--release N` constrains the API, `-source`/`-target` do not.** The latter pair alone
   produces a jar that throws `NoSuchMethodError` at runtime on the older JDK — the exact
   failure `--release` exists to prevent (`ByteBuffer.flip()` is the classic case).
6. **`META-INF/services` files are overwritten, not merged, when jars are flattened** —
   unless a `ServicesResourceTransformer` is configured, and under relocation it must also
   rename *inside* the service files. This is the concrete "two libraries collide in one
   jar" failure.
7. **A lost `Multi-Release: true` attribute is more dangerous than a lost signature.** A
   signature mismatch throws, a sealing violation throws, a bad `module-info` fails
   resolution — but a dropped `Multi-Release` fails **silently**: the `versions/` tree goes
   inert and the base implementation runs forever.
8. **Lombok is not a normal annotation processor** — it mutates the compiler's AST through
   internal APIs, which is why it breaks on each new JDK until updated and why IDEs need a
   plugin. Records ate a large share of its use cases but **not** builders, `@Slf4j`, or
   mutable DTOs.
9. **MapStruct's error names the wrong class.** It resolves properties from accessor
   elements; with Lombok ordered after it, the *target* side is reported first (an
   unwritable target is a hard error, an unreadable source only a warning), so the message
   names the DTO when the missing accessors are on the entity. Fix is Lombok first in
   `annotationProcessorPaths` **plus** `lombok-mapstruct-binding` (Lombok 1.18.16+).
10. **The wrapper pins the build tool; toolchains pin the JDK.** Complementary, constantly
    confused. Gradle's toolchain lives in the build script so it travels with the repo;
    Maven's `toolchains.xml` is per-developer, which is its weakness.
11. **`rm -rf ~/.m2` is superstition.** The real mechanism is `*.lastUpdated` markers
    (a failed lookup suppresses retry until the update interval) and `_remote.repositories`
    (which repo served each file). `mvn -U` or deleting the one marker is the fix.
12. **A release to Maven Central is immutable** — you cannot delete or re-publish a
    version, so a bad release becomes a new version. Checksums prove non-truncation, not
    authorship; that is what signatures and namespace verification are for.
13. **log4shell's hard part was inventory, not patching** — CVE-2021-44228 (CVSS 10.0,
    disclosed 9 Dec 2021), fixed in 2.3.1/2.12.2/2.15.0, then 2.16.0 and 2.17.0 for the
    follow-ons. `log4j-api` alone was **not** vulnerable. Shading is the blind spot: a
    shaded log4j does not show up as log4j. Verified against the Apache Log4j 2 security
    page directly, not from memory.
14. **OWASP dependency-check `failBuildOnCVSS` defaults to 11** — i.e. never fails. A
    scanner nobody wired to a threshold is decoration.

## Process notes for the next phase

- 🔴 **All 12 topics needed chunking.** Every phase README row points at
  `NN-topic/README.md`. The python resolver **cannot** catch a dangling `NN-topic.md`
  against a directory `NN-topic/` — always grep the single-file forms explicitly. Done
  here, none found.
- 🔴 **The rule-13 uniform-count tell fired twice in one phase.** Fork 6 landed three
  files at exactly 5 questions; fork 5's thinnest chunks were at 3. Both got a depth pass
  and both **split rather than trimmed** when out of headroom. **QC counts before
  committing, not after** — it has now fired on P7 (java.time) and twice on P8.
- Forks that finish early leave stale *(not written yet)* placeholders pointing at topics
  that landed later. 16 files needed repointing at close. A scripted pass over
  `\*\*name\*\*\s*\*\(not written yet\)\*` with a name→path map and `os.path.relpath`
  handles it; keep the forward refs to genuinely unwritten phases.
- ⚠️ **A fork can still be writing when you measure it.** The Maven core count was taken
  mid-write (2,264) and the true figure is 2,575 — the commit message carries the stale
  number. Take the count *after* the completion notification, or re-verify before writing
  it into a message.
