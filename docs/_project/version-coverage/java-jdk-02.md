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

### 3.5 · JDK 26 (non-LTS, GA 2026-03-17, EOL 2026-09-15/18)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 128 | 26 | Warnings on deep-reflective mutation of `final` fields — prepare to make final mean final (JEP 500) | deprecated | PARTIAL | `p6/15-immutability-first-strategy/01-why-it-deletes-the-problem.md:140` says frameworks "can even write final fields reflectively" as permitted — pin-true, no mention of the 26 warnings or `--enable-final-field-mutation` | P26, JEP 500 |
| 129 | 26 | AOT object caching with any GC, including ZGC (JEP 516) | new | MISSING | `JEP 516`, `object caching`, `(AOT\|CDS).{0,100}ZGC` → 0 hits; heap objects in the cache are taught, `p12/10-packaging-for-deploy/05d-the-aot-cache.md:31` | P26, JEP 516 |
| 130 | 26 | HTTP/3 for `HttpClient`, opt-in (JEP 517) | new | MISSING | `HTTP/3`, `HTTP_3`, `JEP 517` → 0 hits; `p7/04-httpclient.md` covers 1.1/2 only | P26, JEP 517 |
| 131 | 26 | `Process` implements `AutoCloseable` / `Closeable` | new | MISSING | `Process.{0,20}AutoCloseable` → 0 hits; `p7/10-processbuilder.md` and `p5/03-try-with-resources/03-autocloseable-in-practice.md` silent | RN26 JDK-8364361 |
| 132 | 26 | `Comparator.min(T, T)` / `max(T, T)` default methods | new | MISSING | `Comparator\.(min\|max)`, `\.min\(T` → 0 hits; `p3/10-comparable-comparator/` silent | RN26 JDK-8356995 |
| 133 | 26 | `UUID.ofEpochMillis(long)` — a UUIDv7 factory | new | PARTIAL | `p7/07-uuid-and-randomness.md:52-53`: "no `UUID` factory for v7 exists as of JDK 25" — correct for 25, superseded by 26 (§2c S18) | RN26 JDK-8334015 |
| 134 | 26 | `Duration.MIN` / `Duration.MAX`; `Instant.plusSaturating(Duration)` | new | MISSING | `Duration\.(MIN\|MAX)`, `plusSaturating` → 0 hits | RN26 JDK-8366829, JDK-8368856 |
| 135 | 26 | `HttpRequest` timeout now also covers reading the response body | default | CONTRADICTED | `p7/04-httpclient.md:69` tables the request timeout as "(whole exchange)" and `:71-75` says it guards a stall mid-response — on JDK 25, the page's target, it ends at the headers (§2c S15) | RN26 JDK-8208693 |
| 136 | 26 | `HttpRequest.BodyPublishers.ofFileChannel(channel, offset, length)` | new | MISSING | `ofFileChannel` → 0 hits | RN26 JDK-8329829 |
| 137 | 26 | Default initial heap = `MinHeapSize` when `-Xms` is unset (no longer 1/64 of RAM) | default | PARTIAL | `p12/03-heap-sizing-in-containers/03-maxrampercentage.md:162`; `…/03b-the-ergonomics-algorithm.md:116` teach the 1/64 start — pin-true, latest-false (§2c S12) | RN26 JDK-8371986 |
| 138 | 26 | G1 supports `UseGCOverheadLimit`, on by default | default | PARTIAL | `p12/02-gc-in-practice/09b-why-g1-never-throws-it.md:2`, `:147`; `p12/04-out-of-memory-error/02c-gc-overhead-limit-is-parallel-only.md:2`, `:21` — true on 25, false from 26 (§2c S16) | RN26 JDK-8212084 |
| 139 | 26 | `-XX:MaxRAM`, `-XX:+AggressiveHeap`, `-XX:±AlwaysActAsServerClassMachine`/`NeverActAsServerClassMachine` deprecated | deprecated | PARTIAL | taught as live knobs with no deprecation: `p12/01-memory-layout/01e-the-native-budget.md:132`; `p12/03-heap-sizing-in-containers/03b-the-ergonomics-algorithm.md:256`; `…/07-what-ergonomics-picks-in-a-small-container.md:132` | RN26 JDK-8369346, JDK-8370813, JDK-8370843 |
| 140 | 26 | `Thread.stop` removed (deprecated for removal 18, throws UOE from 20; `suspend`/`resume`/`ThreadGroup.stop` removed 23) | removed | PARTIAL | `p6/01-threads-lifecycle-interrupt/02-interruption.md:19-21` "the platform now throws `UnsupportedOperationException`" — true 20–25; on 26 the call does not compile (§2c S17) | RN18 JDK-8277861, RN20 JDK-8289610, RN23 JDK-8320532, RN26 JDK-8368226 |
| 141 | 26 | Virtual threads unmount while waiting for another thread's class initializer | default | PARTIAL | `p6/14-virtual-thread-pinning.md:65` and `p12/01-memory-layout/06c-carriers-mounting-and-pinning.md:234` list class initialization as still pinning — pin-true, latest-false | RN26 JDK-8369238 |
| 142 | 26 | Hybrid Public Key Encryption, `Cipher.getInstance("HPKE")` | new (security) | MISSING | `HPKE`, `Hybrid Public Key` → 0 hits | RN26 JDK-8325448 |
| 143 | 26 | Tools and `KeyStore` APIs warn on JKS / JCEKS keystores | deprecated (security) | MISSING | `\bJKS\b`, `JCEKS`, `keytool` → only a Maven filtering example, `p8/06-layout-and-multi-module/01-the-standard-layout.md:111` | RN26 JDK-8353749 |

Folded: 524 → 160; 525 → 157; 526 → 159; 529 → 161; 530 → 158; `LockingMode` obsolete → 94.
Excluded: 504 applet API removal (client), 522 G1 synchronization throughput (internal), `jrunscript`
and `jdk.jsobject` removal, JDBC 4.5 (the `java-spring` data unit), Unicode 17, CLDR 48,
`ByteOrder` enum conversion, `DecimalFormat` algorithm alignment.

### 3.6 · JDK 27 (non-LTS, latest stable, GA 2026-09-15)

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 144 | 27 | JDK 27 is GA; 26 is end-of-life — the release-model facts | default | CONTRADICTED | `p0/03-release-model.md:29` "Latest release … JDK 26", `:30` "Next release … JDK 27" (§2c S2–S5) | P27; endoflife.date `oracle-jdk`, `eclipse-temurin` |
| 145 | 27 | G1 is the default collector in all environments — no more ergonomic Serial on small machines (JEP 523) | default | PARTIAL | `p12/03-heap-sizing-in-containers/07-what-ergonomics-picks-in-a-small-container.md:2`, `:89`, `:178`; `…/10-the-checklist.md:63`; `p12/13-jvm-flags-that-matter/05c-the-live-list-gc.md:41` teach Serial auto-selection — pin-true, latest-false (§2c S11); `JEP 523` → 0 hits | P27, JEP 523 |
| 146 | 27 | Compact object headers on by default (JEP 534) | default | COVERED | `p12/01-memory-layout/09c-class-pointers-and-compact-headers.md:10`, `:129`; `…/01-memory-layout/README.md:74`; `…/04b-the-metaspace-flags.md:117` | P27, RN27 JDK-8360700 |
| 147 | 27 | `-XX:±UseCompressedClassPointers` obsolete — in **27**, not 26 | removed | CONTRADICTED | 16 lines in 6 files say "obsolete in 26": `p12/01-memory-layout/04b-the-metaspace-flags.md:2`, `:102`, `:114`, `:121`, `:188`, `:228`, `:236`; `…/09c-class-pointers-and-compact-headers.md:73`, `:83`, `:234`; `…/08b-compact-object-headers.md:179`, `:226`; `p12/04-out-of-memory-error/02b-the-four-native-messages.md:102`, `:195`; `…/04-out-of-memory-error/README.md:92`; `p12/_PHASE-NOTES.md:82` (§2c S6–S10) | RN27 JDK-8363996 ("now obsolete in JDK 27") |
| 148 | 27 | Post-quantum hybrid key exchange for TLS 1.3, `X25519MLKEM768` (JEP 527) | security | MISSING | `JEP 527`, `hybrid key`, `X25519MLKEM768` → 0 hits | P27 |
| 149 | 27 | JFR redacts sensitive arguments, env vars and properties by default; `-XX:FlightRecorderOptions:redact-key/redact-argument` (JEP 536) | security | MISSING | `JEP 536`, `redact-key`, `InitialEnvironmentVariable`, `(secret\|password).{0,80}(JFR\|recording)` → 0 hits | P27, RN27 JDK-8367584 |
| 150 | 27 | `-XX:InitiatingHeapOccupancyPercent` renamed `-XX:G1IHOP` (old name a deprecated alias) | deprecated | PARTIAL | old name only: `p12/02-gc-in-practice/03c2-the-g1-flag-table.md:113`; `…/03c-g1-pause-time-and-the-knobs.md:17`, `:136`; `G1IHOP` → 0 hits | RN27 JDK-8227106 |
| 151 | 24→27 | Legacy launcher options: `-Xfuture`, `-t`, `-tm`, `-checksource`, `-cs`, `-noasyncgc` removed (24); `-verbosegc`, `-ms`, `-mx`, `-ss`, `-verify` deprecated (24); `-noclassgc`, `-noverify`, `-verifyremote`, `-Xverify:none` removed (27) | removed | MISSING | `Xverify:none`, `noverify`, `-noclassgc`, `-verbosegc` → 0 hits; the retired-flags list is planned in `p12/13-jvm-flags-that-matter/_plan.md:24` but unwritten | RN24 JDK-8339918, JDK-8286851, RN27 JDK-8373481 |
| 152 | 27 | JVMCI removed (with `jdk.graal.compiler`) — no Graal JIT on HotSpot | removed | PARTIAL | `p12/01-memory-layout/02b-the-rest-of-the-map.md:92` ("Zero unless you are running the Graal JIT") and `…/01-heap-is-not-the-process.md:218` treat JVMCI as live | RN27 JDK-8382582 |
| 153 | 25→27 | `-Djdk.lang.Process.launchMechanism=VFORK` deprecated (25), removed (27) | removed | MISSING | `VFORK`, `launchMechanism` → 0 hits (a `vfork` memory aside only, `p12/01-memory-layout/02b-the-rest-of-the-map.md:123`) | RN25 JDK-8357179, RN27 JDK-8357089 |
| 154 | 27 | JFR `jdk.OldObjectSample` disabled under generational ZGC | default | PARTIAL | taught as the leak-hunting alternative with no collector caveat: `p12/04-out-of-memory-error/04d-old-object-sample-instead-of-a-dump.md`; `…/03d-the-dump-you-could-not-take.md:169` | RN27 JDK-8382740 |
| 155 | 27 | Predefined ISO-8601 formatters parse short offsets (`+01`) | default | MISSING | `short (zone )?offset`, `ISO_OFFSET_DATE_TIME` → one listing, `p7/01-java-time/04-formatting-parsing-testing.md:39`; the parse change not taught | RN27 JDK-8210336 |
| 156 | 26→27 | Launch rules for instance `main` tightened: the source launcher rejects a private no-arg constructor (26); a package-private `main` inherited from another package is no longer launched (27) | default | MISSING | `no-arg constructor`, `package-private.{0,40}main`, `inherit.{0,40}main` → 0 hits in `p0/04-running-code.md`, `p0/06-main-startup-config.md` (which teach the 25 launch protocol) | RN26 JDK-8371470, RN27 JDK-8377004 |

Folded: 531 → 159; 532 → 158; 533 → 157; 537 → 161; 538 → 160. Excluded: bash completion for
`jcmd`, `jcmd VM.security_properties`, ML-KEM/ML-DSA key encodings, TLS certificate compression,
`ffdhe6144/8192` default-group removal, `ThreadPoolExecutor.finalize` removal,
`java.locale.useOldISOCodes` removal, CLDR 48.2.

### 3.7 · Still in preview or incubation at JDK 27

| # | Since | Change | Kind | Status | Evidence | Source |
|---|---|---|---|---|---|---|
| 157 | 19→27 | Structured concurrency, `StructuredTaskScope`: incubator 19 (428), 20 (437); preview 21 (453), 22 (462), 23 (480), 24 (499), 25 (505), 26 (525), **27 (533, seventh preview)** | new (preview) | CONTRADICTED | `syl/02-core-library.md:110` "finalizing in 27" — false (§2c S1). The page itself, `p6/08-structured-concurrency.md:25-31`, `:50`, teaches the 25 shape correctly labelled; 26's renames (`anySuccessfulOrThrow`, list-returning `allSuccessfulOrThrow`, `Joiner.onTimeout`) and 27's third type parameter are absent (§2c S13) | JEP 525, JEP 533, P27 |
| 158 | 23→27 | Primitive types in patterns, `instanceof` and `switch`: 23 (455), 24 (488), 25 (507), 26 (530), 27 (532, fifth preview) | new (preview) | MISSING | `primitive types? in patterns`, `JEP 455`, `JEP 532` → 0 hits | P23–P27 |
| 159 | 25→27 | Lazy constants (was Stable Values): 25 (502), 26 (526), 27 (531, third preview) | new (preview) | MISSING | `StableValue`, `lazy constant`, `JEP 502` → 0 hits | P25–P27 |
| 160 | 25→28 | PEM encodings of cryptographic objects: 25 (470), 26 (524), 27 (538); final targeted to 28 (542) | new (preview) | MISSING | `PEM` → only a secrets `grep` pattern, `p12/11-graalvm-native-image/04b-the-secret-baked-into-the-image.md:89` | P25–P28 |
| 161 | 16→27 | Vector API, `jdk.incubator.vector`: incubators 16 (338) through 27 (537, twelfth) | new (incubator) | PARTIAL | named once, `p7/13-ffm-api.md:150` ("still-incubating"); not taught | P16–P27 |

### 3.8 · Targeted to JDK 28 (March 2027) — not shipped, not graded

JEP 401 Value Objects (Preview) · 535 Shenandoah generational mode by default (already
pre-announced, `p12/02-gc-in-practice/02b-shenandoah-and-availability.md:129`) · 539 Strict Field
Initialization in the JVM (Preview) · 540 Simple JSON API (Incubator) · 541 Deprecate the macOS/x64
port · 542 PEM Encodings final · 544 Ahead-of-Time Code Compilation (proposed; review ends
2026-09-28). Source: P28.
