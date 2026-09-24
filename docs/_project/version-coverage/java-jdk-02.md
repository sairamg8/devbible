---
name: version-coverage-java-jdk-02
description: java-jdk version coverage, part 2 of 3 — §3.4 the delta table for JDK 22 → 25 (toward the 25 LTS), rows 79–127. Continues java-jdk.md; §3.5–§5 continue in java-jdk-03.md.
metadata:
  type: project
---
# Java — JDK language and platform — version coverage vs LTS (2026-09-24) · part 2

Continues [java-jdk.md](java-jdk.md) (frontmatter summary, §1, §2, §3 legend and rows 1–78).
Shorthand, grading and row selection are defined there in §3's header: paths under
`docs/java/pages/` with `p0`…`p12`; `P<N>` = openjdk.org/projects/jdk/N; `RN<N>` = the Oracle JDK N
release notes; all fetched 2026-09-24.

### 3.4 · JDK 22 → 25 (toward the 25 LTS, GA 2025-09-16)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 79 | 22 | Foreign Function & Memory API final (JEP 454; incubators 370/383/389/393/412/419, previews 424/434/442) | new | COVERED | `p7/13-ffm-api.md:40` (`Arena`, `Linker`), `:126` | P22 |
| 80 | 22 | Unnamed variables and patterns, `_` (JEP 456; preview 443) | new | PARTIAL | one interview answer on `try (var _ = …)`, `p5/03-try-with-resources/01-the-desugaring.md:227`; no `_` in patterns, `switch`, lambdas or `catch` anywhere (`case … _`, `(_)`, `catch (… _)` → 0 hits) | P22 |
| 81 | 22 | Launch multi-file source-code programs (JEP 458) | new (tool) | COVERED | `p0/04-running-code.md:62` | P22 |
| 82 | 22 | Region pinning for G1 — JNI critical regions no longer stall GC (JEP 423) | default | COVERED | `p12/02-gc-in-practice/03e-g1-when-it-goes-wrong.md:107`, `:127` | P22 |
| 83 | 22 | Locale-dependent list patterns, `java.text.ListFormat` | new | MISSING | `ListFormat`, `list pattern` → 0 hits; `p7/09-localization-basics.md` silent | RN22 JDK-8041488 |
| 84 | 22 | JLine becomes the default `System.console()` provider (22); reverted in 25 | default | COVERED | `p7/11-console-io-scanner.md:109-114` (both the 22 change and the step back) | RN22 JDK-8308591, RN25 JDK-8351435 |
| 85 | 22 | JFR event for calls to `@Deprecated` methods (`jdk.DeprecatedInvocation`) | new (tool) | MISSING | `DeprecatedInvocation`, `deprecated method.{0,20}event` → 0 hits | RN22 JDK-8211238 |
| 86 | 22 | Two-phase parallel heap dump, `jcmd GC.heap_dump -parallel=N` | new (tool) | COVERED | `p12/01-memory-layout/01d-taking-a-heap-dump-on-purpose.md:57`, `:76`, `:83` | RN22 JDK-8306441 |
| 87 | 23 | Markdown documentation comments, `///` (JEP 467) | new | MISSING | `JEP 467`, `Markdown.{0,30}(comment\|javadoc)`, `/// ` → 0 hits | P23 |
| 88 | 23 | `javac` no longer runs annotation processors implicitly (`-proc:full` to restore) | default | COVERED | `p8/09-annotation-processing/01-how-processors-work.md:112`, `:118`, `:172` | RN23 JDK-8321314 |
| 89 | 23→24 | `sun.misc.Unsafe` memory-access methods deprecated for removal (JEP 471, 23), warn on first use (JEP 498, 24) | deprecated | PARTIAL | named only: `p7/13-ffm-api.md:18` ("replacing … `sun.misc.Unsafe`"), `p12/01-memory-layout/07b-cleaners-and-deterministic-release.md:111` (`invokeCleaner`); no JEP 471/498, no `--sun-misc-unsafe-memory-access` | P23, P24 |
| 90 | 23→24 | ZGC generational by default (JEP 474, 23); non-generational mode removed, `-XX:±ZGenerational` obsolete (JEP 490, 24) | removed | COVERED | `p12/13-jvm-flags-that-matter/05c-the-live-list-gc.md:66-68`; `p12/01-memory-layout/03b-the-weak-generational-hypothesis.md:169` | P23, P24 |
| 91 | 23 | String templates withdrawn after two previews (JEP 430 in 21, 459 in 22; 465 withdrawn) | removed | COVERED | `p0/03-release-model.md:56`, `:115` | P21, P22, JEP 465 (Closed / Withdrawn) |
| 92 | 23 | Legacy `COMPAT` locale data removed (`java.locale.providers=COMPAT` no longer works) | removed | MISSING | `java\.locale\.providers`, `COMPAT` (case-sensitive: only `file.encoding=COMPAT`), `legacy locale data` → 0 hits | RN23 JDK-8174269; warning RN21 JDK-8304982 |
| 93 | 23 | `Instant.until(Instant)` returns a `Duration` | new | MISSING | `Instant\.until`, `until\(.*Instant` → 0 hits (`Duration.between` taught, `p7/01-java-time/02-machine-vs-calendar-time.md:26`) | RN23 JDK-8331202 |
| 94 | 23→26 | `LockingMode` default → lightweight (23), flag deprecated (24), obsolete (26) | removed | COVERED | `p12/01-memory-layout/08b-compact-object-headers.md:124-128`; `p12/01-memory-layout/09c-class-pointers-and-compact-headers.md:135` | RN23 JDK-8319251, RN24 JDK-8334299, JBS JDK-8359437 (fixed in 26) |
| 95 | 23 | `-XX:TrimNativeHeapInterval` becomes a product option (`jcmd System.trim_native_heap`) | new (CLI) | MISSING | `TrimNativeHeapInterval`, `trim_native_heap` → 0 hits, though `p12/01-memory-layout/` teaches glibc arena growth | RN23 JDK-8325496 |
| 96 | 24 | Stream gatherers, `Stream.gather` / `Gatherers` (JEP 485; previews 461, 473) | new | COVERED | `p4/13-stream-gatherers.md:18`, `:49` | P24 |
| 97 | 24 | Class-File API, `java.lang.classfile` (JEP 484; previews 457, 466) | new | MISSING | `JEP 484`, `class-file API`, `java\.lang\.classfile`, `ClassFile\.of` → 0 hits | P24 |
| 98 | 24 | Ahead-of-time class loading and linking — the AOT cache (JEP 483) | new | COVERED | `p12/10-packaging-for-deploy/05d-the-aot-cache.md:31`, `:83-86` | P24 |
| 99 | 24 | Security Manager permanently disabled (JEP 486; deprecated for removal 17 JEP 411; `java.security.manager` defaults to `disallow` in 18) | removed | MISSING | `security ?manager`, `SecurityManager`, `JEP 486`, `JEP 411` → only a native-image note, `p12/11-graalvm-native-image/03-what-breaks.md:134`, and a JFR aside, `p12/06-jfr-and-profiling/02-what-jfr-is.md:34` | P17, P24, RN18 JDK-8270380 |
| 100 | 24 | Virtual threads synchronize without pinning (JEP 491); `-Djdk.tracePinnedThreads` removed | default | COVERED | `p6/14-virtual-thread-pinning.md:70`, `:106`, `:114` | P24 |
| 101 | 24 | Prepare to restrict JNI — warnings unless `--enable-native-access` (JEP 472) | security | COVERED | `p7/13-ffm-api.md:126-134` | P24 |
| 102 | 24 | `jlink` without JMOD files, `--enable-linkable-runtime` builds (JEP 493) | new (tool) | PARTIAL | `p12/10-packaging-for-deploy/04-jlink.md:196`, `:244` state that `jlink` needs `jmods` — true for default builds only (§2c S19) | P24, JEP 493 |
| 103 | 24 | Post-quantum ML-KEM (JEP 496) and ML-DSA (JEP 497) | new (security) | MISSING | `ML-KEM`, `ML-DSA`, `quantum`, `JEP 496`, `JEP 497` → 0 hits | P24 |
| 104 | 24 | Virtual-thread scheduler MXBean; `jcmd Thread.vthread_scheduler` / `vthread_pollers` | new (tool) | COVERED | `p12/05-thread-dumps/07b-pinning-in-a-dump.md:81`, `:139` | RN24 JDK-8338890, JDK-8337199 |
| 105 | 24 | `Reader.of(CharSequence)` | new | MISSING | `Reader\.of` → 0 hits | RN24 JDK-8341566 |
| 106 | 24 | `Process.waitFor(Duration)` | new | PARTIAL | the timed form is taught with the older overload, `p7/10-processbuilder.md:82` (`waitFor(30, TimeUnit.SECONDS)`) | RN24 JDK-8336479 |
| 107 | 24 | `jar` tool: extract to a directory (`--dir`/`-C`), keep existing files (`-k`) | new (tool) | MISSING | `jar (-x\|--extract)…--dir`, `--no-overwrite`, `-xkf` → 0 hits; `p8/08-jar-anatomy/` teaches `jar` | RN24 JDK-8173970, JDK-8335912 |
| 108 | 24 | TLS_RSA cipher suites disabled by default | security | MISSING | `TLS_RSA`, `cipher suite` → 0 teaching hits | RN24 JDK-8245545 |
| 109 | 25 | Scoped values final (JEP 506; incubator 429, previews 446, 464, 481, 487) | new | COVERED | `p6/12-threadlocal-scopedvalue/02-scopedvalue.md:25` | P25 |
| 110 | 25 | Module import declarations, `import module java.base;` (JEP 511; previews 476, 494) | new | MISSING | `import module`, `JEP 511`, `module import` → 0 hits; `p0/11-module-system.md`, `p0/05-packages-classpath/01-packages-and-imports.md` silent | P25 |
| 111 | 25 | Compact source files and instance `main`; `java.lang.IO` (JEP 512; previews 445, 463, 477, 495) | new | COVERED | `p0/04-running-code.md:76-82`, `:136-150`; `p0/06-main-startup-config.md:42` | P25 |
| 112 | 25 | Flexible constructor bodies — statements before `super(...)` (JEP 513; previews 447, 482, 492) | new | COVERED | `p2/03-inheritance/01-extends-super-construction.md:41`, `:122` | P25 |
| 113 | 25 | Key Derivation Function API, `javax.crypto.KDF` (JEP 510; preview 478) | new (security) | MISSING | `KDF`, `key derivation`, `JEP 510` → 0 relevant hits | P25 |
| 114 | 25 | AOT command-line ergonomics, one-step `-XX:AOTCacheOutput` (JEP 514) | new (CLI) | COVERED | `p12/10-packaging-for-deploy/05e-aot-modes-and-diagnosis.md:38` | P25 |
| 115 | 25 | AOT method profiling — cached profiles cut warm-up (JEP 515) | new | COVERED | `p12/10-packaging-for-deploy/05f-when-the-cache-helps.md:44` | P25 |
| 116 | 25 | Compact object headers become a product option (JEP 519; experimental 450 in 24) | new (CLI) | COVERED | `p12/01-memory-layout/08b-compact-object-headers.md:164`, `:218`; `p1/01-primitives-vs-references/02-references-and-memory.md:80` | P25, RN25 JDK-8350457 |
| 117 | 25 | Generational Shenandoah becomes product (JEP 521; experimental 404 in 24) | new | COVERED | `p12/02-gc-in-practice/02b-shenandoah-and-availability.md:156` | P25 |
| 118 | 25 | JFR CPU-time profiling, `jdk.CPUTimeSample` (JEP 509, experimental, Linux) | new (tool) | COVERED | `p12/06-jfr-and-profiling/04-the-event-model.md:83`, `:232` | P25 |
| 119 | 25 | JFR cooperative sampling (JEP 518) | default | COVERED | `p12/06-jfr-and-profiling/10-choosing-between-them.md:66`, `:122` | P25 |
| 120 | 25 | JFR method timing and tracing, `jdk.MethodTiming` / `jdk.MethodTrace` (JEP 520) | new (tool) | COVERED | `p12/06-jfr-and-profiling/08-jdk-25-jfr.md:118-130` | P25 |
| 121 | 25 | `-XX:±UseCompressedClassPointers` deprecated | deprecated | COVERED | `p12/01-memory-layout/04b-the-metaspace-flags.md:102-114` (deprecation right; the obsoletion release is wrong — row 147) | RN25 JDK-8350753 |
| 122 | 25 | `stdin.encoding` standard system property | new | MISSING | `stdin\.encoding` → only a native-image property list, `p12/11-graalvm-native-image/04-build-time-vs-run-time-initialisation.md:77`; `p7/03-streams-buffers-charsets.md:85` covers stdout/stderr only | RN25 JDK-8350703 |
| 123 | 25 | `HttpClient` response-size caps, `BodyHandlers.limiting` / `BodySubscribers.limiting` | new (security) | MISSING | `limiting\(`, `BodyHandlers\.limiting` → 0 hits | RN25 JDK-8328919 |
| 124 | 25 | `ForkJoinPool` implements `ScheduledExecutorService`; `CompletableFuture` delayed-task changes | new | MISSING | `ForkJoinPool.{0,50}Scheduled` → 0 hits (`delayedExecutor` taught, `p6/07-completablefuture/02-fan-out-allof-anyof-timeouts.md:113`, predates 25) | RN25 JDK-8319447 |
| 125 | 25 | JFR socket, file and exception events throttled by default | default | MISSING | `throttl`, `jdk.SocketRead`, `jdk.JavaExceptionThrow` → 0 hits in `p12/06-jfr-and-profiling/` | RN25 JDK-8351594 |
| 126 | 25→27 | JSON thread dumps (`Thread.dump_to_file`, `dumpThreads`) include lock information (25), park-blocker owner (26), numeric ids (27) | new (tool) | CONTRADICTED | `p12/01-memory-layout/06b-virtual-thread-stacks.md:173`: "★ The new thread dump omits lock information" (quoting JEP 444) — false on JDK 25 (§2c S20) | RN25 JDK-8356870, RN26 JDK-8365057, RN27 JDK-8381002 |
| 127 | 25 | SHA-1 disabled in TLS/DTLS 1.2 handshake signatures | security | MISSING | `SHA-1` → only Maven checksum prose, `p8/10-artifact-repositories/01-local-remote-central.md:44` | RN25 JDK-8340321 |

Folded: 447/482/492 → 112; 455/488/507 → 158; 457/466 → 97; 459 → 91; 460/469/489/508 → 161;
461/473 → 96; 462/480/499/505 → 157; 463/477/495 → 111; 464/481/487 → 109; 470 → 160; 476/494 → 110;
478 → 113; 502 → 159; 404 → 117; 450 → 116; 498 → 89; 490 → 90. Excluded (not teachable): 475 G1 late
barrier expansion, 479/501/503 32-bit ports, the old core-reflection removal (22), `jdk.random`
module removal (23), `-Xnoagent`/`-Xdebug` deprecations, JAXP limits, CLDR 44–47, Unicode 15.1/16,
tzdata 2024b.
