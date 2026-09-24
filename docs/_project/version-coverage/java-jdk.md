---
name: version-coverage-java-jdk
description: java-jdk (java phases 0–8 and 12 + syllabus) · content applies up to JDK 25 LTS (floor 17 for the language core, 21 operationally) · LTS lines 17/21/25 compared, plus 26 (EOL) and 27 (latest, GA 2026-09-15) · 161 changes graded — 62 COVERED, 23 PARTIAL, 70 MISSING (15 of them TLS/crypto), 5 CONTRADICTED, 1 PLANNED · 17 and 21 complete for features; 25 has 19 missing and 1 contradicted; 26+27 have 1 of 29 covered · 20 stale/false claims (S1–S20) · parts java-jdk.md (§1–§3.3), java-jdk-02.md (§3.4–§4), java-jdk-03.md (§5)
metadata:
  type: project
---
# Java — JDK language and platform — version coverage vs LTS (2026-09-24)

**Parts:** this file (§1 upstream lines · §2 baseline · §3 rows 1–78) → [java-jdk-02.md](java-jdk-02.md)
(§3 rows 79–161 · §4 summary) → [java-jdk-03.md](java-jdk-03.md) (§5 hand-off).

Unit `java-jdk` = the language/platform half of the java track: `docs/java/pages/phase-0` … `phase-8`,
`phase-12-jvm-production`, and `docs/java/syllabus`. Spring and third-party libraries are the
`java-spring` unit and are out of scope here. Read-only audit — nothing under `docs/` was changed.

## 1 · Upstream release lines

Fetched 2026-09-24. Java has an LTS concept: one feature release every six months, an LTS every
two years. Oracle's roadmap names the next planned LTS as Java 29, due September 2027.

### Supported lines today

| Line | Kind | GA (OpenJDK / Oracle) | GA (Temurin) | Latest patch (2026-09-24) | Oracle Premier ends | Oracle Extended ends | Temurin EOL |
|---|---|---|---|---|---|---|---|
| **8** | LTS (legacy) | 2014-03-18 | — | Temurin `8u504-b01` (2026-08-25) | ended Mar 2022 | Dec 2030 | 2030-12-31 |
| **11** | LTS (legacy) | 2018-09-25 | — | Temurin `11.0.32.1+1` (2026-08-24) | ended Sep 2023 | Jan 2032 | 2027-10-31 |
| **17** | LTS (oldest in audit scope) | 2021-09-14 | 2021-09-22 | `17.0.20.1` / Temurin `17.0.20.1+1` (2026-08-18/19) | **2026-09-30 — six days from today** | Sep 2029 | 2027-10-31 |
| **21** | LTS (previous) | 2023-09-19 | 2023-10-10 | `21.0.12.1` / Temurin `21.0.12.1+1` (2026-08-18/19) | Sep 2028 | Sep 2031 | 2029-12-31 |
| **25** | **LTS (current) — the devbible pin** | 2025-09-16 | 2025-09-22 | `25.0.4.1` / Temurin `25.0.4.1+1` (2026-08-18/19) | Sep 2030 | Sep 2033 | 2031-09-30 |
| **27** | feature release (non-LTS) — **latest stable** | **2026-09-15** | Temurin `jdk-27+35` published 2026-09-22 | `27` (GA) | Mar 2027 | n/a | not yet in endoflife.date |

### Lines out of support in the audit window

| Line | Kind | GA | Superseded / EOL | Last patch |
|---|---|---|---|---|
| 26 | feature (non-LTS) | 2026-03-17 | EOL 2026-09-15 (Temurin) / 2026-09-18 (Oracle) — superseded by 27 | `26.0.2.1` (2026-08-18) |
| 24, 23, 22 | feature (non-LTS) | 2025-03-18 · 2024-09-17 · 2024-03-19 | each EOL at the next GA | `24.0.2` · `23.0.2` · `22.0.2` |
| 20, 19, 18 | feature (non-LTS) | 2023-03-21 · 2022-09-20 · 2022-03-22 | each EOL at the next GA | `20.0.2` · `19.0.2` · `18.0.2.1` |

### Next

| Release | Kind | Date | State on 2026-09-24 |
|---|---|---|---|
| **28** | feature (non-LTS) | March 2027 (Oracle roadmap) | main line open; targeted so far: JEP 401 Value Objects (Preview), 535 Shenandoah generational by default, 539 Strict Field Initialization (Preview), 540 Simple JSON API (Incubator), 541 Deprecate macOS/x64 port, 542 PEM Encodings (final); 544 AOT Code Compilation *proposed* (review ends 2026-09-28). No schedule published yet. |
| **29** | **next LTS** | **September 2027** (Oracle roadmap: premier to Sep 2032, extended to Sep 2035) | not opened |

**Adoptium API (`available_releases`)**: `most_recent_lts: 25`, `most_recent_feature_release: 27`,
`tip_version: 28`, LTS list 8/11/17/21/25.

### Sources (all fetched 2026-09-24)

- `https://endoflife.date/api/eclipse-temurin.json` — Temurin cycles, latest patches, EOL dates.
- `https://endoflife.date/api/oracle-jdk.json` — Oracle JDK cycles incl. 27 GA 2026-09-15, 17 EOL 2026-09-30, extended-support dates.
- `https://endoflife.date/api/openjdk-builds-from-oracle.json` — jdk.java.net GA builds (27 on 2026-09-15).
- `https://www.oracle.com/java/technologies/java-se-support-roadmap.html` — LTS cadence; "next planned LTS release is Java 29 in September 2027"; 28 = March 2027.
- `https://api.adoptium.net/v3/info/available_releases` and `https://api.adoptium.net/v3/assets/latest/27/hotspot` — Temurin 27 (`jdk-27+35`, 2026-09-22).
- `https://openjdk.org/projects/jdk/{17..28}/` — per-release JEP lists and GA dates (JDK 26 GA 2026-03-17, JDK 27 GA 2026-09-15). These pages are the feature source for §2b and §3.

**Pin check:** `src/data/pins.js` → `jdk { source eol:eclipse-temurin, policy lts, cycle 25, pin 25 }`.
Correct by policy: 25 is the current LTS and the newest LTS Temurin ships. `newestOverall` in
`static/currency.json` still reads 26.0.2.1+1 — it predates Temurin 27 (published 2026-09-22) and
endoflife.date has not listed Temurin 27 yet, so the next currency run should see 27 as the newest line.

## 2 · Content baseline — "applies up to"

### 2a · Version spines (measured 2026-09-24)

Every `> Verified:` / `> Target:` / `> Version spine:` blockquote in the unit's dirs, read whole
(multi-line), with every JDK/SE/Java version it names extracted.

| Measure | Result |
|---|---|
| Spine blockquotes | **661** — 651 `> Verified:` + 10 `> Target:` (the `Version spine:` lines sit inside `Verified` blocks: 4, all phase-12, all "JDK 25") |
| `> Target:` lines | **10 / 10 phase READMEs say "Java 25 (LTS)"** (phase-8 adds "Maven 3.9/4 · Gradle 8+") |
| Highest JDK named per spine | **25 → 605** · 17 → 4 (phase-8 toolchain/Log4Shell pages) · 8 → 1 · no JDK named → 51 (Maven/Gradle/library-sourced pages) |
| Spines naming each version (any mention) | 25: 605 · 24: 12 · 17: 5 · 21: 4 · 22: 4 · 9: 4 · 15: 3 · 18: 3 · 16: 2 · 19: 2 · 20: 2 · 23: 2 · 8: 2 · 11: 1 · 12: 1 · **26: 0 · 27: 0** |
| `Verified:` dates | 2026-08 (330: 124 month-only, 120 on -18, 52 on -19, 34 on -31) · 2026-09 (321: 29 month-only, 266 on -01, 8 on -02, 18 on -03). **Newest: 2026-09-03 — twelve days before JDK 27 GA** |
| "on JDK 25" / "JDK 25+" / "since 25" in body text | 225 lines in 94 files |
| Bolded JDK version (currency checker's anchor) | none — matches `static/currency.json` "unanchored-by-bold" |

The spines are uniform: the unit was written against **the JDK 25 docs, the JLS/JVMS SE 25 and
the JEP that finalized each feature**. Nothing was verified against a JDK 26 or 27 document.

### 2b · Feature probes, one release line at a time

Headline features taken from `openjdk.org/projects/jdk/<N>/` (fetched 2026-09-24); each grepped
with ≥ 2 terms over the unit's dirs (`g.sh` = `grep -rniE` over the 11 dirs).

| Line | Headline features (JEP) | Taught? (evidence) | Line verdict |
|---|---|---|---|
| **17 LTS** (incl. what 12–16 finalized) | records 395 · sealed 409 · text blocks 378 · switch expressions 361 · `instanceof` patterns 394 · helpful NPEs 358 · strong encapsulation 403 · RandomGenerator 356 · `InstantSource` · context-specific deserialization filters 415 · `HexFormat` · `jpackage` 392 | 10/12 taught: `phase-2…/09-sealed-adts.md:59`, `phase-2…/08-records/`, `phase-1…/07-text-blocks.md`, `phase-1…/08-control-flow-switch/01-the-modern-switch.md`, `phase-1…/14-casting-instanceof/02-instanceof-flow-scoping.md:127`, `phase-1…/13-null-and-npe/01-reading-an-npe.md:39`, `phase-0…/11-module-system.md:51`, `phase-7…/07-uuid-and-randomness.md:78`, `phase-7…/01-java-time/04-formatting-parsing-testing.md:118`, `phase-7…/08-java-serialization.md:79`. **`HexFormat`, `jpackage`: 0 hits** | **Fully taught** |
| **21 LTS** (18–21) | UTF-8 by default 400 · simple web server 408 · finalization deprecated 421 · `@snippet` 413 · virtual threads 444 · record patterns 440 · pattern `switch` 441 · sequenced collections 431 · generational ZGC 439 · KEM API 452 · dynamic-agent warning 451 | 8/11 taught: `phase-0…/01-what-java-is/03-write-once-run-anywhere.md`, `phase-0…/08-garbage-collection.md:83`, `phase-6…/02-platform-vs-virtual-threads/`, `phase-2…/09-sealed-adts.md:97`, `phase-1…/08-control-flow-switch/02-patterns-null-and-legacy.md`, `phase-3…/04-collection-hierarchy.md:37`, `phase-12…/01-memory-layout/03b-the-weak-generational-hypothesis.md:169`, JEP 451 only in `phase-12…/09-distributed-tracing/05-wiring-it-in-spring-boot.md:114`. **`jwebserver`, `@snippet`, KEM: 0 hits** | **Fully taught** (gaps are tools/security APIs) |
| **25 LTS** (22–25) | FFM 454 · unnamed variables 456 · multi-file source 458 · gatherers 485 · class-file API 484 · Markdown doc comments 467 · module imports 511 · compact source files/instance `main` 512 · flexible constructor bodies 513 · scoped values 506 · KDF 510 · AOT cache 483/514/515 · compact object headers 519 · generational Shenandoah 521 · JFR 509/518/520 · VT sync without pinning 491 · Security Manager disabled 486 · JNI restrictions 472 · `Unsafe` memory-access 471/498 · ZGC non-gen removed 490 · ML-KEM/ML-DSA 496/497 | 16/24 taught: `phase-7…/13-ffm-api.md`, `phase-0…/04-running-code.md:62`, `phase-4…/13-stream-gatherers.md`, `phase-0…/06-main-startup-config.md:42`, `phase-2…/03-inheritance/01-extends-super-construction.md:41`, `phase-6…/12-threadlocal-scopedvalue/02-scopedvalue.md`, `phase-12…/10-packaging-for-deploy/` (AOT, 114 hits), `phase-12…/01-memory-layout/08b-compact-object-headers.md`, `phase-12…/02-gc-in-practice/02b-shenandoah-and-availability.md`, `phase-12…/06-jfr-and-profiling/10-choosing-between-them.md`, `phase-6…/14-virtual-thread-pinning.md`, `phase-7…/13-ffm-api.md:129` (472). Unnamed variables: one Q&A only (`phase-5…/03-try-with-resources/01-the-desugaring.md:227`). **Class-file API, Markdown doc comments, module imports, KDF, ML-KEM/ML-DSA, JEP 486: 0 teaching hits** | **Taught, with 7 gaps** |
| **26** (non-LTS, EOL) | final-means-final warnings 500 · AOT object caching any GC 516 · HTTP/3 517 · G1 throughput 522 · SC 6th preview 525 · lazy constants 526 · primitive patterns 530 · PEM 524 — plus API adds: `Process` `AutoCloseable`, `Comparator.min/max`, UUIDv7, `Duration.MIN/MAX`, `HttpRequest` timeout now covers the body | **0 of the JEPs taught; 0 of the API adds.** Only 26 mentions in the unit are flag-obsoletion claims — and one of those is wrong (§2c) | **Not taught** |
| **27** (non-LTS, latest stable) | G1 default everywhere 523 · PQ hybrid TLS 1.3 527 · SC 7th preview 533 · compact headers by default 534 · JFR in-process redaction 536 · `UseCompressedClassPointers` obsolete | Only JEP 534 is taught, forward-looking: `phase-12…/01-memory-layout/09c-class-pointers-and-compact-headers.md:10`, `…/README.md:74`. 523, 527, 533, 536: 0 hits. The `UseCompressedClassPointers` obsoletion is taught but **dated to 26** | **Not taught** (one feature, pre-announced) |

**Floor.** The oldest line the content still holds for is **17 for the language core (phases 1–5,
7)** — every post-17 feature is tagged with its release in the text ("final in 21", "(22+)",
"since JDK 21 (JEP 431)"), so a 17 reader can see what does not apply. **The operational floor is 21:**
phase 6 teaches virtual threads as the default (`newVirtualThreadPerTaskExecutor`, 16 lines in 10
files), and phase 0/12 examples run only on 25 (instance `main` + `IO.println`,
`phase-0…/04-running-code.md:76`; `-XX:+UseCompactObjectHeaders` without an unlock flag;
`AOTCache`; `ScopedValue.where`, 9 lines).

### 2c · Stale and false claims (true on the day written, or never true)

Grep: `latest|current|newest|recent|upcoming|will be|not yet|next|experimental|preview|incubat|LTS|obsolete`
within ~50 chars of a version number, blockquote spines excluded. Every hit read in context.

| # | File:line | Claim (≤ 15 words) | Why it is false on 2026-09-24 |
|---|---|---|---|
| S1 | `docs/java/syllabus/02-core-library.md:110` | "preview through 25/26, finalizing in 27" | JDK 27 ships Structured Concurrency as a **seventh preview** (JEP 533, openjdk.org/projects/jdk/27). Nothing is finalizing. |
| S2 | `phase-0-platform-jvm/03-release-model.md:29` | "Latest release … JDK 26 … its support ends when 27 ships" | 27 went GA 2026-09-15; 26 is EOL (Temurin 2026-09-15, Oracle 2026-09-18). |
| S3 | `phase-0-platform-jvm/03-release-model.md:30` | "Next release … JDK 27 — GA 15 September 2026" | Past tense now; the next release is 28 (March 2027), next LTS 29 (Sep 2027). |
| S4 | `phase-0-platform-jvm/03-release-model.md:21-22` | "spans 8 to 26 in real production fleets" | Upper bound is 27 now. Minor. |
| S5 | `phase-0-platform-jvm/03-release-model.md:40-43` | "26 is not a beta … when 27 ships, 26's patches stop" | The example is right in principle; the tense is past. Minor. |
| S6 | `phase-12-jvm-production/01-memory-layout/04b-the-metaspace-flags.md:2` (title), `:102`, `:114`, `:121`, `:188`, `:228`, `:236` | "`UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26" | **Wrong release.** The JDK 27 release notes (JDK-8363996): deprecated in 25, *"now obsolete in JDK 27"*. On JDK 26 the flag is still deprecated and still honoured. |
| S7 | `phase-12-jvm-production/01-memory-layout/09c-class-pointers-and-compact-headers.md:73`, `:83`, `:234` | "on JDK 26 it becomes obsolete" | Same as S6. |
| S8 | `phase-12-jvm-production/01-memory-layout/08b-compact-object-headers.md:179`, `:226` | "deprecated in JDK 25 and obsolete in 26" | Same as S6. |
| S9 | `phase-12-jvm-production/04-out-of-memory-error/02b-the-four-native-messages.md:102`, `:195`; `…/04-out-of-memory-error/README.md:92` | "obsolete in JDK 26" | Same as S6. |
| S10 | `phase-12-jvm-production/_PHASE-NOTES.md:82` | "obsolete in 26 — do not write" | The authoring note that spread S6–S9. Same fix. |
| S11 | `phase-12-jvm-production/03-heap-sizing-in-containers/07-what-ergonomics-picks-in-a-small-container.md:2`, `:89`, `:178`; `…/10-the-checklist.md:63`, `:190`; `phase-12…/13-jvm-flags-that-matter/05c-the-live-list-gc.md:41` | "the JVM quietly selects Serial" under 2 CPUs or 1792 MB | True on ≤ 26 (and on the pin, 25). **False on 27**: JEP 523 makes G1 the default in all environments. The pages scope themselves to `jdk-25+36`, so this is pin-true, latest-false. |
| S12 | `phase-12-jvm-production/03-heap-sizing-in-containers/03-maxrampercentage.md:162`; `…/03b-the-ergonomics-algorithm.md:116` | "`InitialRAMPercentage`'s default of 1.5625 percent means the heap starts tiny" | True on 25. JDK 26 (JDK-8371986): the default initial heap is now `MinHeapSize`, not 1/64 of RAM. Pin-true, latest-false. |
| S13 | `phase-6-concurrency/08-structured-concurrency.md:25-31`, `:50` | "The JDK 25 shape" | Correctly labelled as the 25 preview; but 26 renamed `anySuccessfulResultOrThrow` → `anySuccessfulOrThrow`, made `allSuccessfulOrThrow` return a list, and 27 added a third type parameter (JEP 525, JEP 533). Not false — just one preview behind twice. |
| S14 | `phase-5-exceptions/03-try-with-resources/03-autocloseable-in-practice.md:190` | "`ExecutorService` is `AutoCloseable` (JDK 21+)" | **Wrong release.** JDK 19 API docs: `ExecutorService.close()` *"Since: 19"* (JEP 425). The corpus's own `phase-6…/06-executorservice-pools/README.md:61` says 19. |
| S15 | `phase-7-io-time-stdlib/04-httpclient.md:69` (table) and `:71-75` | "Request (whole exchange)" timeout covers a stall mid-response | **False on the page's own target, JDK 25.** JDK 26 release notes (JDK-8208693): the request timeout *"previously applied only until the response headers were received"*; 26 extended it to the body. On 25, a body that stalls after the headers is not covered. |
| S16 | `phase-12-jvm-production/02-gc-in-practice/09b-why-g1-never-throws-it.md:2`, `:147`; `phase-12…/04-out-of-memory-error/02c-gc-overhead-limit-is-parallel-only.md:2`, `:21`; `…/02e-the-message-decides-the-fix.md:32` | "G1 never throws it" / "Parallel GC only" | True on 25 (the titles scope it). **False from 26**: JDK-8212084, *"G1: Support UseGCOverheadLimit"*, enabled by default. `09b:147` states it unscoped. Pin-true, latest-false. |
| S17 | `phase-6-concurrency/01-threads-lifecycle-interrupt/02-interruption.md:19-21` | "`Thread.stop` … the platform now throws `UnsupportedOperationException`" | True 20–25. **JDK 26 removed `Thread.stop`** (JDK-8368226) — calls no longer compile. Pin-true, latest-false. |
| S18 | `phase-7-io-time-stdlib/07-uuid-and-randomness.md:52-53` | "no `UUID` factory for v7 exists as of JDK 25" | Correctly scoped to 25; **JDK 26 added `UUID.ofEpochMillis(long)`** (JDK-8334015). Pin-true, latest-false. |
| S19 | `phase-12-jvm-production/10-packaging-for-deploy/04-jlink.md:196`, `:244` | "`jlink` needs a JDK with a `jmods` directory" | Since 24 (JEP 493) a JDK built with `--enable-linkable-runtime` has no `jmods` and still links. Off by default and vendor-optional, so the claim holds for most builds — but not all. |
| S20 | `phase-12-jvm-production/01-memory-layout/06b-virtual-thread-stacks.md:148-153`, `:173-176` | "★ The new thread dump omits lock information" | **False on the pin.** It quotes JEP 444 (JDK 21). The JDK 25 release notes (JDK-8356870): `jcmd Thread.dump_to_file` *"now includes lock information"*; 26 adds the park-blocker owner. |

Checked and **true**: `08b-compact-object-headers.md:114` ("JDK 25 asks, JDK 27 defaults" — JEP 534);
`08b…:128` ("`LockingMode` is obsolete in 26" — JBS JDK-8359437, fixed in 26); `02b-shenandoah-and-availability.md:129`
(generational Shenandoah default targeted to 28 — JEP 535 on the JDK 28 page); `phase-8…/11-javac-flags/01-release-and-preview.md:140`
(25 preview class files do not load on 26); every "experimental on JDK 25" claim for `jdk.CPUTimeSample`, `jmap`, `jstack`.

**Verdict: content applies up to JDK 25 (floor 17 for the language core, 21 operationally).**
All 10 phase READMEs target Java 25 LTS and 605 of 661 spines name JDK 25 as the highest version,
with the newest verification dated 2026-09-03. The 17, 21 and 25 lines' headline features are taught;
JDK 26's are not taught at all and JDK 27's only as a pre-announcement, with one wrong release boundary
repeated on 16 lines across 6 files (S6–S10), plus three claims that are false on the pin itself (S14 `ExecutorService` 21+ → 19; S15 the HttpClient
request timeout; S20 the JSON thread dump "omits locks").

## 3 · The delta table

**Row selection.** Every JEP on `openjdk.org/projects/jdk/{17..27}/` is accounted for — a finished
feature gets one row at the release that **finalized** it, with its preview/incubator JEPs listed in
the row (so the preview trajectory is visible and no JEP is lost); a feature still in preview at 27
gets one row in §3.8. Release-note items (Oracle `NN-relnote-issues.html`, fetched for 16–27) become
rows when they change code, flags or defaults in an area the unit's syllabus covers: the language,
`java.lang/util/time/io/nio/net/text`, collections, streams, concurrency, `javac`/`java`/`jshell`/
`jar`/`jlink`/`jcmd`/JFR tooling, GC/heap/container flags, and the TLS/crypto defaults a service meets.
**Excluded (listed per release, not graded):** OS/CPU ports, internal performance JEPs, client-libs
(AWT/Swing/applet), root-CA adds/removes, javadoc cosmetics, Kerberos/PKCS#11/JNDI/JMX internals,
Unicode/CLDR/tzdata version bumps (except CLDR 42's formatting break, row 57), pure bug fixes.

**Grading.** COVERED = a page teaches it. PARTIAL = mentioned but not taught, **or taught in the
older shape** — including *pin-true, latest-false* (right on 25, superseded by 26/27). CONTRADICTED =
a live page states something false for the version it names. MISSING = no page teaches it (terms
listed; every term was also grepped over all of `docs/java/pages/` — no other java phase teaches
any MISSING row). PLANNED = syllabus lists it, no page yet.

**Shorthand.** Paths are under `docs/java/pages/`: `p0` = phase-0-platform-jvm · `p1` language-core ·
`p2` classes-objects · `p3` generics-collections · `p4` lambdas-streams · `p5` exceptions · `p6`
concurrency · `p7` io-time-stdlib · `p8` build-dependencies · `p12` jvm-production · `syl` =
`docs/java/syllabus/`. Sources: `P<N>` = `https://openjdk.org/projects/jdk/<N>/` · `RN<N>` =
`https://www.oracle.com/java/technologies/javase/<N>-relnote-issues.html` (+ issue id) · `JEP n` =
`https://openjdk.org/jeps/n`. All fetched 2026-09-24.

### 3.1 · The 17 LTS baseline — finalized in 12–16, first shipped in an LTS at 17

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 1 | 14 | Switch expressions: `->` arms, `yield`, exhaustiveness (JEP 361; previews 325, 354) | new | COVERED | `p1/08-control-flow-switch/01-the-modern-switch.md` (spine :9, body) | P14 |
| 2 | 14 | Helpful `NullPointerException` messages (JEP 358) | default | COVERED | `p1/13-null-and-npe/01-reading-an-npe.md:39` | P14 |
| 3 | 14 | JFR event streaming — `RecordingStream`, in-process consumption (JEP 349) | new | MISSING | `RecordingStream`, `JEP 349`, `event streaming` → only a native-image support note `p12/11-graalvm-native-image/07b-no-jit-no-jfr-no-jstack.md:107` | P14 |
| 4 | 14 | CMS collector removed (JEP 363) | removed | COVERED | `p12/01-memory-layout/README.md:120`; `p12/02-gc-in-practice/03-g1.md:57` | P14 |
| 5 | 15 | Text blocks (JEP 378; previews 355, 368) | new | COVERED | `p1/07-text-blocks.md` | P15 |
| 6 | 15 | ZGC and Shenandoah become product features (JEP 377, 379) | new | COVERED | `p12/02-gc-in-practice/02b-shenandoah-and-availability.md:55`; `p12/02-gc-in-practice/04-zgc.md` | P15 |
| 7 | 15 | Biased locking disabled and deprecated (JEP 374; obsoleted in 18, RN18 JDK-8256425) | removed | COVERED | `p3/16-legacy-types.md:12`, `:37`; `p12/01-memory-layout/README.md:120` | P15, RN18 |
| 8 | 15 | Nashorn JavaScript engine removed (JEP 372) | removed | MISSING | `Nashorn`, `jjs` → 0 hits | P15 |
| 9 | 15 | Hidden classes — the framework proxy/lambda mechanism (JEP 371) | new | MISSING | `hidden class`, `JEP 371`, `defineHiddenClass` → 0 hits | P15 |
| 10 | 15 | EdDSA signatures (JEP 339) | new (security) | MISSING | `EdDSA`, `Ed25519` → 0 hits | P15 |
| 11 | 16 | Records (JEP 395; previews 359, 384) | new | COVERED | `p2/08-records/01-the-feature.md` (spine :9, :29) | P16 |
| 12 | 16 | Pattern matching for `instanceof` (JEP 394; previews 305, 375) | new | COVERED | `p1/14-casting-instanceof/02-instanceof-flow-scoping.md:127` | P16 |
| 13 | 16 | `Stream.toList()` (unmodifiable) | new | COVERED | `p4/11-tolist-vs-collectors.md:16` | RN16 JDK-8180352 |
| 14 | 16 | `jpackage` packaging tool (JEP 392; incubator 343) | new (tool) | MISSING | `jpackage`, `JEP 392` → 0 hits | P16 |
| 15 | 16 | Unix-domain socket channels (JEP 380) | new | MISSING | `UnixDomainSocketAddress`, `unix.domain socket`, `JEP 380` → 0 hits | P16 |
| 16 | 16 | Warnings for value-based classes — `synchronized` on `Integer` etc. (JEP 390) | new (lint) | COVERED | `p6/04-synchronized-intrinsic-locks/03-choosing-the-lock-object.md:67`, `:147` | P16 |
| 17 | 16 | Elastic metaspace (JEP 387) | default | COVERED | `p12/01-memory-layout/04c-the-classloader-leak.md:31` | P16 |
| 18 | 13 | Dynamic CDS archives, `-XX:ArchiveClassesAtExit` (JEP 350; default CDS JEP 341, 12) | new (CLI) | COVERED | `p12/10-packaging-for-deploy/05-class-data-sharing.md:96` | P12, P13 |

Excluded (12–16): Shenandoah experimental 189, microbenchmark suite 230, JVM constants API 334,
AArch64/Alpine/Windows-AArch64 ports 340/386/388, G1 internals 344/345/346, ZGC uncommit/ports
351/364/365/376, socket reimplementations 353/373, NVM buffers 352, Solaris/SPARC 362/381, Pack200
removal 367, raw string literals (withdrawn preview) 326, C++14/Git/GitHub 347/357/369, the
foreign-memory/linker/vector incubators 370/383/389/393/338 (tracked in rows 79, 161).

### 3.2 · JDK 17 (LTS, GA 2021-09-14)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 19 | 17 | Sealed classes and interfaces (JEP 409; previews 360, 397) | new | COVERED | `p2/09-sealed-adts.md:59`; `p2/05-abstract-vs-interfaces/03-skeletons-sealed-and-api-design.md` | P17 |
| 20 | 17 | Strong encapsulation of JDK internals; `--illegal-access` removed (JEP 403; 396 in 16) | removed | COVERED | `p0/11-module-system.md:51`, `:154` | P17 |
| 21 | 17 | Enhanced pseudo-random generators — `RandomGenerator`, `RandomGeneratorFactory` (JEP 356) | new | COVERED | `p7/07-uuid-and-randomness.md:78` | P17 |
| 22 | 17 | Context-specific deserialization filters — filter factory, `jdk.serialFilterFactory` (JEP 415) | security | PARTIAL | `p7/08-java-serialization.md:94` names the factory in one bullet; the code at `:83` is a single static filter — no factory, no per-stream selection | P17, RN17 JDK-8264859 |
| 23 | 17 | Always-strict floating point; `strictfp` redundant (JEP 306) | default | MISSING | `strictfp`, `JEP 306`, `strict floating` → 0 hits (`p1/05-floating-point-bigdecimal/` silent) | P17 |
| 24 | 17 | Experimental `jaotc` AOT compiler and Graal JIT removed (JEP 410) | removed | MISSING | `jaotc`, `JEP 410`, `JEP 295` → 0 hits; the AOT story in `p12/10-packaging-for-deploy/05d-the-aot-cache.md` starts at JEP 483 | P17 |
| 25 | 17 | `java.time.InstantSource` | new | COVERED | `p7/01-java-time/04-formatting-parsing-testing.md:118`, `:211` | RN17 JDK-8266846 |
| 26 | 17 | `java.util.HexFormat` | new | MISSING | `HexFormat`, `hex (format\|encod)` → only hand-rolled hex prose `p1/04-operators-overflow/03-shifts-bitwise-strings.md:72` | RN17 JDK-8251989 |
| 27 | 17 | `native.encoding` system property | new | COVERED | `p7/03-streams-buffers-charsets.md:81` | RN17 JDK-8265989 |
| 28 | 17 | `Console.charset()` | new | MISSING | `Console.{0,30}charset`, `charset\(\)` → 0 hits; `p7/11-console-io-scanner.md` exists | RN17 JDK-8264208 |
| 29 | 17 | Unified logging asynchronous flush, `-Xlog:async` | new (CLI) | COVERED | `p12/02-gc-in-practice/07d-rotating-and-shipping-gc-logs.md:93-115` | RN17 JDK-8229517 |
| 30 | 17→18 | SHA-1-signed JARs treated as unsigned (17), disabled (18) | security | MISSING | `SHA-1.{0,30}jar`, `signed JAR` → `p8/08-jar-anatomy/04-signatures-sealing-modules.md:23` teaches signing, no algorithm policy | RN17 JDK-8196415, RN18 JDK-8269039 |

Folded elsewhere: JEP 406 (switch preview → row 62), 411 (Security Manager → row 99), 412/414
(FFM → row 79; Vector → row 161). Excluded: 382 macOS rendering, 391 macOS/AArch64 port, 398
applet deprecation, 407 RMI Activation removal.

### 3.3 · JDK 18 → 21 (toward the 21 LTS, GA 2023-09-19)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 31 | 18 | UTF-8 is the default charset; `file.encoding=COMPAT` escape (JEP 400) | default | COVERED | `p7/03-streams-buffers-charsets.md:81-85`; `p12/10-packaging-for-deploy/03c-musl-runtime-differences.md:209` | P18 |
| 32 | 18 | Simple web server, `jwebserver` / `SimpleFileServer` (JEP 408) | new (tool) | MISSING | `jwebserver`, `JEP 408`, `SimpleFileServer` → 0 hits | P18 |
| 33 | 18 | Code snippets in Javadoc, `@snippet` (JEP 413) | new (tool) | MISSING | `@snippet`, `JEP 413` → 0 hits | P18 |
| 34 | 18 | Internet-address resolution SPI, `InetAddressResolver` (JEP 418) | new | MISSING | `InetAddressResolver`, `JEP 418`, `resolution SPI` → 0 hits | P18 |
| 35 | 18 | Finalization deprecated for removal; `--finalization=disabled` (JEP 421) | deprecated | COVERED | `p0/08-garbage-collection.md:83`, `:146` | P18 |
| 36 | 18 | String deduplication for Serial, Parallel and ZGC (was G1-only) | new (CLI) | COVERED | `p12/01-memory-layout/10c-string-deduplication.md:67`, `:99` | RN18 JDK-8267186/8272609/8267185 |
| 37 | 18 | `cacerts` migrated from JKS to password-less PKCS12 | default (security) | MISSING | `cacerts`, `PKCS12`, `keytool` → 0 hits | RN18 JDK-8275252 |
| 38 | 18 | `Charset.forName(String, Charset)` with a fallback | new | MISSING | `Charset\.forName\(…,`, `forName.{0,40}fallback` → 0 hits | RN18 JDK-8270490 |
| 39 | 19 | Pre-sized `HashMap.newHashMap(int)` / `HashSet.newHashSet` / `LinkedHashMap.newLinkedHashMap` | new | COVERED | `p3/14-choosing-a-collection/03-api-shape-and-sizing.md:63`, `:102` | RN19 JDK-8186958 |
| 40 | 19 | `Locale` constructors deprecated → `Locale.of(...)` | deprecated | COVERED | `p7/09-localization-basics.md:35`, `:198` | RN19 JDK-8282819 |
| 41 | 19 | `ExecutorService` extends `AutoCloseable` (`close()` = shutdown and await) | new | COVERED | `p6/06-executorservice-pools/04-shutdown-and-virtual-threads.md:19`; ⚠️ `p5/03-try-with-resources/03-autocloseable-in-practice.md:190` mis-dates it "(JDK 21+)" — §2c S14 | JEP 425; JDK 19 API `ExecutorService.close()` "Since: 19" |
| 42 | 19 | `Future.state()`, `resultNow()`, `exceptionNow()` | new | PARTIAL | named once in a Fix line, `p6/06-executorservice-pools/02-submit-and-futures.md:142`; never shown | JEP 425 |
| 43 | 19 | `Thread.threadId()`; `Thread.getId()` deprecated | deprecated | MISSING | `threadId\(\)`, `getId\(\).{0,30}deprecat` → 0 hits | JEP 425; RN19 JDK-8284161 |
| 44 | 19 | `Thread.sleep(Duration)`, `Thread.join(Duration)` | new | PARTIAL | `sleep(Duration)` appears in a code sample, `p6/02-platform-vs-virtual-threads/01-what-a-thread-costs.md:96`; `join(Duration)` 0 hits | JEP 425 |
| 45 | 19 | `ThreadGroup` degraded (destroy/daemon/suspend become no-ops) | deprecated | MISSING | `ThreadGroup` → only the uncaught-handler rung, `p5/08-global-handler.md:39` | RN19 JDK-8284161 |
| 46 | 19 | Regex `\b` matches ASCII word characters only by default | default | MISSING | `UNICODE_CHARACTER_CLASS`, `\\b.{0,40}ASCII` → 0 hits; `p7/06-regex.md` silent | RN19 JDK-8264160 |
| 47 | 19 | `Double.toString` / `Float.toString` now return the shortest decimal | default | PARTIAL | `p1/05-floating-point-bigdecimal/02-bigdecimal-correctly.md:36` relies on "the shortest decimal" without saying it is only true since 19 | RN19 JDK-4511638 |
| 48 | 19 | `stdout.encoding` / `stderr.encoding` properties | new | COVERED | `p7/03-streams-buffers-charsets.md:85`; `p7/11-console-io-scanner.md:38` | RN19 JDK-8283620 |
| 49 | 19 | Automatic CDS archive, `-XX:+AutoCreateSharedArchive` | new (CLI) | COVERED | `p12/10-packaging-for-deploy/05b-creating-a-cds-archive.md:139` | RN19 JDK-8261455 |
| 50 | 19 | `javac` indy string concatenation now evaluates operands in JLS order | default | MISSING | `StringConcatFactory`, `indy.{0,30}concat` → only an `invokedynamic` table row, `p2/04-polymorphism-dispatch/02-the-machinery-and-the-jit.md:36` | RN19 JDK-8273914 |
| 51 | 19 | `DateTimeFormatter.ofLocalizedPattern` (additional date-time formats) | new | MISSING | `ofLocalizedPattern` → 0 hits; `p7/09-localization-basics.md:142` teaches `ofLocalizedDate` only | RN19 JDK-8176706 |
| 52 | 19 | Security defaults: 3DES TLS suites off by default; larger default key sizes; MD5/SHA-1 off for HTTP Digest | security | MISSING | `3DES`, `cipher suite`, `key size`, `Digest` → no TLS/JCA teaching anywhere in the unit | RN19 JDK-8163327, JDK-8267319, JDK-8281561 |
| 53 | 20 | `javac -Xlint:lossy-conversions` (implicit narrowing in `+=` etc.) | new (lint) | PARTIAL | lint name listed, `p8/11-javac-flags/03-lint-encoding-proc.md:53`; the implicit cast itself is taught at `p1/16-precedence-evaluation.md:86` without the lint | RN20 JDK-8244681 |
| 54 | 20 | `javac --release 7` / `-source 7` removed | removed | MISSING | `--release 7`, `-source 7` → 0 hits; `p8/11-javac-flags/01-release-and-preview.md` teaches `--release` | RN20 JDK-8173605 |
| 55 | 20 | `java.net.URL` constructors deprecated → `URI.toURL()` | deprecated | MISSING | `new URL\(`, `URL constructors? deprecated` → 0 hits | RN20 JDK-8294241 |
| 56 | 20 | `HttpClient` idle keep-alive default cut from 1200 s to 30 s | default | MISSING | `keep.?alive`, `jdk.httpclient.keepalive` → only `ThreadPoolExecutor.keepAliveTime` | RN20 JDK-8297030 |
| 57 | 20 | CLDR 42: NNBSP before AM/PM, " at " dropped — formatted/parsed times change | default | PARTIAL | the principle is taught, `p7/09-localization-basics.md:175`, `:204`; the 20 break itself (`NNBSP`, ` `, `CLDR 42`) 0 hits | RN20 JDK-8284840 |
| 58 | 20 | Exhaustive enum `switch` throws `MatchException` (not `IncompatibleClassChangeError`) | default | COVERED | `p1/08-control-flow-switch/01-the-modern-switch.md:81`, `:128` | RN20 JDK-8297118 |
| 59 | 20 | TLS_ECDH suites and DTLS 1.0 disabled | security | MISSING | `TLS_ECDH`, `DTLS`, `disabledAlgorithms` → 0 hits | RN20 JDK-8279164, JDK-8256660 |
| 60 | 21 | Virtual threads (JEP 444; previews 425, 436) | new | COVERED | `p6/02-platform-vs-virtual-threads/03-using-them-well.md`; `…/01-what-a-thread-costs.md:96` | P21 |
| 61 | 21 | Record patterns (JEP 440; previews 405, 432) | new | COVERED | `p2/09-sealed-adts.md:97` | P21 |
| 62 | 21 | Pattern matching for `switch` (JEP 441; previews 406, 420, 427, 433) | new | COVERED | `p1/08-control-flow-switch/02-patterns-null-and-legacy.md:27`, `:170` | P21 |
| 63 | 21 | Sequenced collections (JEP 431) | new | COVERED | `p3/04-collection-hierarchy.md:37` | P21 |
| 64 | 21 | Generational ZGC (JEP 439) | new | COVERED | `p12/01-memory-layout/03b-the-weak-generational-hypothesis.md:169` | P21 |
| 65 | 21 | Warnings on dynamically loaded agents; `-XX:+EnableDynamicAgentLoading` (JEP 451) | security | PARTIAL | `p12/09-distributed-tracing/05-wiring-it-in-spring-boot.md:114` says only "strict boundaries" — no warning text, no flag, no `-javaagent` vs attach distinction | P21 |
| 66 | 21 | Key Encapsulation Mechanism API, `javax.crypto.KEM` (JEP 452) | new (security) | MISSING | `KEM\b`, `JEP 452`, `key encapsulation` → 0 hits | P21 |
| 67 | 21 | `Math.clamp` / `StrictMath.clamp` | new | MISSING | `Math\.clamp`, `clamp\(` → 0 hits | RN21 JDK-8301226 |
| 68 | 21 | `String.indexOf(ch/str, from, to)` — bounded search | new | MISSING | `indexOf\(…,…,…\)` → 0 hits | RN21 JDK-8302590 |
| 69 | 21 | `String.splitWithDelimiters` / `Pattern.splitWithDelimiters` | new | MISSING | `splitWithDelimiters` → 0 hits | RN21 JDK-8305486 |
| 70 | 21 | `StringBuilder.repeat` / `StringBuffer.repeat` | new | MISSING | `StringBuilder.{0,20}repeat` → 0 hits (`String.repeat` (11) at `p1/06-strings/02-building-and-formatting.md:110`) | RN21 JDK-8302323 |
| 71 | 21 | `Character.isEmoji…` and regex emoji properties | new | MISSING | `isEmoji`, `\p{IsEmoji}` → 0 hits (emoji only as a UTF-16 hazard, `p1/06-strings/03-the-api-worth-knowing.md:141`) | RN21 JDK-8303018, JDK-8305107 |
| 72 | 21 | `HttpClient` implements `AutoCloseable` | new | COVERED | `p7/04-httpclient.md:48` | RN21 JDK-8267140 |
| 73 | 21 | `javac -Xlint:this-escape` | new (lint) | COVERED | `p8/11-javac-flags/03-lint-encoding-proc.md:65`, `:191` | RN21 JDK-8015831 |
| 74 | 21 | `jfr view` / `jcmd JFR.view` | new (tool) | COVERED | `p12/06-jfr-and-profiling/11-the-checklist.md:74`; `…/10-choosing-between-them.md:82` | RN21 JDK-8306703 |
| 75 | 21 | `jcmd Thread.dump_to_file -format=json` — dumps virtual threads | new (tool) | COVERED | `p6/13-deadlock-livelock-starvation/02-dumps-livelock-starvation.md:30` | JEP 444 |
| 76 | 21 | `Runtime.exec` / `ProcessBuilder` logging via `System.Logger` "java.lang.ProcessBuilder" | new | MISSING | `ProcessBuilder.{0,40}logg` → 0 hits; `p7/10-processbuilder.md` silent | RN21 JDK-8303392 |
| 77 | 21 | `System.exit` / `Runtime.exit` logging via `System.Logger` "java.lang.Runtime" | new | MISSING | `System\.exit.{0,60}logg`, `java\.lang\.Runtime.{0,20}log` → 0 hits | RN21 JDK-8301627 |
| 78 | 21 | Default TLS Diffie-Hellman group raised from 1024 to 2048 bits | security | MISSING | `Diffie`, `DH group`, `TLS` → no TLS teaching | RN21 JDK-8301700 |

Folded: 405/432 → 61; 406/420/427/433 → 62; 417/426/438/448 → 161; 419/424/434/442 → 79;
425/436 → 60; 428/437/453 → 157; 429/446 → 109; 430 → 91; 443 → 80; 445 → 111.
Thread.stop deprecation (18), UOE (20) → row 140. Excluded: 416 (reflection on method handles —
internal; old implementation removed in 22), 422 RISC-V port, 449 Win32 x86 deprecation, G1 region
size and card-table sizes (18), Unicode 14/15, CLDR 41/43, tzdata.
