---
name: version-coverage-java-jdk-03
description: java-jdk version coverage, part 3 of 3 — §5 hand-off to the java lane — 5 CONTRADICTED rows and 1 mis-dated claim to fix first, the 70 MISSING rows by release with tier and the page each sits beside, the pin-true/latest-false PARTIALs, and the pins.js note.
metadata:
  type: project
---
# Java — JDK language and platform — version coverage vs LTS (2026-09-24) · part 3

Continues [java-jdk-02.md](java-jdk-02.md). Row numbers are §3's (rows 1–78 in
[java-jdk.md](java-jdk.md), 79–161 in part 2). Paths are under `docs/java/pages/`; every
"beside" page below was checked with `ls`/`test -f` on 2026-09-24. Tiers are the corpus's four:
Master · Understand · Know · When Needed. This lane edits nothing — the java lane owns the fixes.

## 5 · Hand-off to the owning lane

### 5.1 · Fix first — live pages stating a wrong fact (CONTRADICTED)

| Row | Page(s) | What is wrong | What upstream says (source) |
|---|---|---|---|
| **135** | `phase-7-io-time-stdlib/04-httpclient.md:69`, `:71-75` | The request timeout is tabled as "(whole exchange)" and sold as the guard against a stall mid-response — **on JDK 25, the page's target**. | Until 26 the `HttpRequest.Builder.timeout` applied *"only until the response headers were received"*; 26 extended it to the body (RN26 JDK-8208693). On the pin, a body that stalls after the headers is unguarded. Highest priority: it is on the pin and it is the page's central safety advice. |
| **126** | `phase-12-jvm-production/01-memory-layout/06b-virtual-thread-stacks.md:148-153`, `:173-176` | "★ The new thread dump omits lock information" — quoting JEP 444 (JDK 21) as current. | JDK 25: `Thread.dump_to_file` *"now includes lock information"* (RN25 JDK-8356870); 26 adds the park-blocker owner (RN26 JDK-8365057). Also on the pin. |
| **147** | 16 lines in 6 files: `phase-12-jvm-production/01-memory-layout/04b-the-metaspace-flags.md:2` (title), `:102`, `:114`, `:121`, `:188`, `:228`, `:236`; `…/01-memory-layout/09c-class-pointers-and-compact-headers.md:73`, `:83`, `:234`; `…/01-memory-layout/08b-compact-object-headers.md:179`, `:226`; `phase-12-jvm-production/04-out-of-memory-error/02b-the-four-native-messages.md:102`, `:195`; `…/04-out-of-memory-error/README.md:92`; and the root, `phase-12-jvm-production/_PHASE-NOTES.md:82` | "`UseCompressedClassPointers` … obsolete in 26" | Deprecated in 25, **obsolete in 27**: *"Ignoring option UseCompressedClassPointers; support was removed in 27.0"* (RN27 JDK-8363996). On 26 the flag still works with a deprecation warning. Fix `_PHASE-NOTES.md:82` first — it is the binding note the other 15 lines copied. |
| **144** | `phase-0-platform-jvm/03-release-model.md:21-22`, `:29`, `:30`, `:40-43` | "Latest release … JDK 26"; "Next release … JDK 27 — GA 15 September 2026" | 27 GA 2026-09-15 (P27); 26 EOL 2026-09-15 Temurin / 2026-09-18 Oracle; next is 28 (March 2027), next LTS 29 (September 2027) — Oracle support roadmap. |
| **157** | `docs/java/syllabus/02-core-library.md:110` | Structured concurrency "preview through 25/26, finalizing in 27" | JDK 27 ships it as the **seventh preview** (JEP 533); the page `phase-6-concurrency/08-structured-concurrency.md` is right to call it preview. |
| (41) | `phase-5-exceptions/03-try-with-resources/03-autocloseable-in-practice.md:190` | "`ExecutorService` is `AutoCloseable` (JDK 21+)" — row 41 is COVERED elsewhere, this line mis-dates it | `ExecutorService.close()` *"Since: 19"* (JDK 19 API docs; JEP 425). The corpus's own `phase-6-concurrency/06-executorservice-pools/README.md:61` says 19. |

### 5.2 · MISSING, by release — tier and the page each would sit beside

**TLS and crypto (15 rows: 10, 30, 37, 52, 59, 66, 78, 103, 108, 113, 127, 142, 143, 148, 160).** The syllabus has no TLS/JCA topic, so these have nowhere to land.
Proposal for the lane: one new Phase 7 topic, *"TLS and the JDK's security defaults"* (**Know**),
beside `phase-7-io-time-stdlib/04-httpclient.md` — `cacerts`/PKCS12 and the JKS warnings (37, 143),
`jdk.tls.disabledAlgorithms` and what each LTS switched off (52, 59, 78, 108, 127), SHA-1 JAR policy
(30, or beside `phase-8-build-dependencies/08-jar-anatomy/04-signatures-sealing-modules.md`), and a
**When Needed** tail for the new crypto APIs — EdDSA 10, KEM 66, ML-KEM/ML-DSA 103, KDF 113,
HPKE 142, PQ hybrid TLS 148, PEM 160. That is a syllabus change and needs the user's approval.

| Row | Since | Missing | Tier | Beside |
|---|---|---|---|---|
| 3 | 14 | JFR event streaming, `RecordingStream` | Know | `phase-12-jvm-production/06-jfr-and-profiling/04-the-event-model.md` |
| 8 | 15 | Nashorn removed (the `jjs`/`ScriptEngine` gap in old code) | When Needed | `phase-0-platform-jvm/10-stdlib-layout.md` |
| 9 | 15 | Hidden classes — how lambdas and framework proxies are defined | When Needed | `phase-2-classes-objects/04-polymorphism-dispatch/02-the-machinery-and-the-jit.md` |
| 14 | 16 | `jpackage` | Know | `phase-12-jvm-production/10-packaging-for-deploy/04-jlink.md` |
| 15 | 16 | Unix-domain socket channels | When Needed | `phase-7-io-time-stdlib/12-nio-channels-selectors.md` |
| 23 | 17 | Always-strict floating point; `strictfp` redundant | Know | `phase-1-language-core/05-floating-point-bigdecimal/01-ieee-754-doubles.md` |
| 24 | 17 | `jaotc`/Graal JIT removed — the AOT history before JEP 483 | Know | `phase-12-jvm-production/10-packaging-for-deploy/05d-the-aot-cache.md` |
| 26 | 17 | `HexFormat` | Know | `phase-1-language-core/04-operators-overflow/03-shifts-bitwise-strings.md` |
| 28 | 17 | `Console.charset()` | Know | `phase-7-io-time-stdlib/11-console-io-scanner.md` |
| 32 | 18 | `jwebserver` / `SimpleFileServer` | Know | `phase-0-platform-jvm/04-running-code.md` |
| 33 | 18 | `@snippet` in Javadoc | Know | `phase-0-platform-jvm/10-stdlib-layout.md` (the "read the Javadoc" page) |
| 34 | 18 | `InetAddressResolver` SPI | When Needed | `phase-7-io-time-stdlib/04-httpclient.md` |
| 38 | 18 | `Charset.forName(name, fallback)` | Know | `phase-7-io-time-stdlib/03-streams-buffers-charsets.md` |
| 43 | 19 | `Thread.threadId()`; `getId()` deprecated | Know | `phase-6-concurrency/01-threads-lifecycle-interrupt/01-lifecycle-start-daemons.md` |
| 45 | 19 | `ThreadGroup` degraded | Know | `phase-6-concurrency/01-threads-lifecycle-interrupt/01-lifecycle-start-daemons.md` |
| 46 | 19 | Regex `\b` ASCII-only by default | Understand | `phase-7-io-time-stdlib/06-regex.md` |
| 50 | 19 | String concatenation operand evaluation order (indy fix) | Know | `phase-1-language-core/16-precedence-evaluation.md` |
| 51 | 19 | `DateTimeFormatter.ofLocalizedPattern` | Know | `phase-7-io-time-stdlib/09-localization-basics.md` |
| 54 | 20 | `--release 7` removed — the lowest `--release` each JDK accepts | Know | `phase-8-build-dependencies/11-javac-flags/01-release-and-preview.md` |
| 55 | 20 | `URL` constructors deprecated → `URI.toURL()` | Understand | `phase-7-io-time-stdlib/04-httpclient.md` |
| 56 | 20 | `HttpClient` idle keep-alive 30 s | Know | `phase-7-io-time-stdlib/04-httpclient.md` |
| 67 | 21 | `Math.clamp` | Know | `phase-1-language-core/04-operators-overflow/01-division-remainder-overflow.md` |
| 68 | 21 | `String.indexOf(…, from, to)` | Know | `phase-1-language-core/06-strings/03-the-api-worth-knowing.md` |
| 69 | 21 | `splitWithDelimiters` | Know | `phase-1-language-core/06-strings/03-the-api-worth-knowing.md` |
| 70 | 21 | `StringBuilder.repeat` | Know | `phase-1-language-core/06-strings/02-building-and-formatting.md` |
| 71 | 21 | `Character.isEmoji…`, `\p{IsEmoji}` | When Needed | `phase-1-language-core/06-strings/03-the-api-worth-knowing.md` |
| 76 | 21 | `ProcessBuilder` command logging via `System.Logger` | Know | `phase-7-io-time-stdlib/10-processbuilder.md` |
| 77 | 21 | `System.exit` / `Runtime.exit` logging | Know | `phase-12-jvm-production/12-graceful-shutdown/03-shutdown-hooks.md` |
| 83 | 22 | `ListFormat` | Know | `phase-7-io-time-stdlib/09-localization-basics.md` |
| 85 | 22 | JFR `jdk.DeprecatedInvocation` — find calls to deprecated APIs before an upgrade | Know | `phase-12-jvm-production/06-jfr-and-profiling/04-the-event-model.md` |
| 87 | 23 | Markdown doc comments `///` | Know | `phase-1-language-core/15-naming-idiom.md` |
| 92 | 23 | `COMPAT` locale data removed — formatting changes on upgrade | Understand | `phase-7-io-time-stdlib/09-localization-basics.md` |
| 93 | 23 | `Instant.until(Instant)` | Know | `phase-7-io-time-stdlib/01-java-time/02-machine-vs-calendar-time.md` |
| 95 | 23 | `-XX:TrimNativeHeapInterval`, `jcmd System.trim_native_heap` | When Needed | `phase-12-jvm-production/01-memory-layout/02b-the-rest-of-the-map.md` |
| 97 | 24 | Class-File API | When Needed | `phase-8-build-dependencies/09-annotation-processing/01-how-processors-work.md` |
| 99 | 24 | Security Manager permanently disabled | Know | `phase-0-platform-jvm/11-module-system.md` |
| 105 | 24 | `Reader.of(CharSequence)` | Know | `phase-7-io-time-stdlib/03-streams-buffers-charsets.md` |
| 107 | 24 | `jar --dir` / `-k` | Know | `phase-8-build-dependencies/08-jar-anatomy/01-the-format.md` |
| 110 | 25 | Module import declarations, `import module` | Understand | `phase-0-platform-jvm/05-packages-classpath/01-packages-and-imports.md` |
| 122 | 25 | `stdin.encoding` | Know | `phase-7-io-time-stdlib/03-streams-buffers-charsets.md` |
| 123 | 25 | `BodyHandlers.limiting` — cap response bodies | Understand | `phase-7-io-time-stdlib/04-httpclient.md` |
| 124 | 25 | `ForkJoinPool` as a `ScheduledExecutorService` | Know | `phase-6-concurrency/07-completablefuture/02-fan-out-allof-anyof-timeouts.md` |
| 125 | 25 | JFR socket/file/exception events throttled by default | Know | `phase-12-jvm-production/06-jfr-and-profiling/03b-settings-profiles.md` |
| 129 | 26 | AOT cache with any GC, incl. ZGC | Know | `phase-12-jvm-production/10-packaging-for-deploy/05d-the-aot-cache.md` |
| 130 | 26 | HTTP/3 (opt-in) | Know | `phase-7-io-time-stdlib/04-httpclient.md` |
| 131 | 26 | `Process.close()` / try-with-resources | Understand | `phase-7-io-time-stdlib/10-processbuilder.md` |
| 132 | 26 | `Comparator.min/max` | Know | `phase-3-generics-collections/10-comparable-comparator/02-building-comparators.md` |
| 134 | 26 | `Duration.MIN/MAX`, `Instant.plusSaturating` | Know | `phase-7-io-time-stdlib/01-java-time/02-machine-vs-calendar-time.md` |
| 136 | 26 | `BodyPublishers.ofFileChannel` | When Needed | `phase-7-io-time-stdlib/04-httpclient.md` |
| 149 | 27 | JFR redacts secrets by default; `redact-key`/`redact-argument` | Understand | `phase-12-jvm-production/06-jfr-and-profiling/03b-settings-profiles.md` |
| 153 | 27 | `VFORK` launch mechanism removed | When Needed | `phase-7-io-time-stdlib/10-processbuilder.md` |
| 155 | 27 | ISO formatters parse short offsets | Know | `phase-7-io-time-stdlib/01-java-time/04-formatting-parsing-testing.md` |
| 156 | 26–27 | Instance-`main` launch rules tightened | Know | `phase-0-platform-jvm/04-running-code.md` |
| 158 | 23–27 | Primitive types in patterns *(preview)* | When Needed | `phase-1-language-core/08-control-flow-switch/02-patterns-null-and-legacy.md` |
| 159 | 25–27 | Lazy constants *(preview)* | When Needed | `phase-2-classes-objects/12-immutable-design/03-builders-laziness-and-cost.md` |

Plus the 15 TLS/crypto rows above (10, 30, 37, 52, 59, 66, 78, 103, 108, 113, 127, 142, 143, 148,
160) → 55 + 15 = **70 MISSING**. Row 151 (legacy launcher options) is **PLANNED**: it belongs in the
unwritten `phase-12-jvm-production/13-jvm-flags-that-matter/06-the-retired-list.md`
(`_plan.md:24`), with `-Xverify:none`, `-noverify`, `-noclassgc`, `-verbosegc`, `-ms/-mx` added to
that chunk's list.

### 5.3 · PARTIAL — what each needs

**Wrong on 26/27, right on the pin (refresh with a "since 26/27" line now, or at the next pin move):**
128 final-field mutation warnings (JEP 500) · 133 `UUID.ofEpochMillis` · 137 initial heap =
`MinHeapSize` · 138 G1 now throws `GC overhead limit exceeded` (`09b-why-g1-never-throws-it.md:147`
states it unscoped — fix that line now) · 139 `MaxRAM`/`AggressiveHeap`/`*ActAsServerClassMachine`
deprecated · 140 `Thread.stop` removed · 141 VT class-init unmounting · 145 G1 default everywhere
(the whole `07-what-ergonomics-picks-in-a-small-container.md` becomes a ≤26 page on 27 — add a
version banner) · 150 `G1IHOP` · 152 JVMCI/Graal JIT removed · 154 `OldObjectSample` off under ZGC.

**Gaps on the pin itself:** 22 serial-filter factory (show one) · 42 `Future.state()` family (show
it) · 44 `Thread.join(Duration)` · 47 `Double.toString` shortest-repr is a 19 change · 53 name the
`lossy-conversions` lint at the compound-assignment page · 57 the CLDR 42 NNBSP break as the worked
example of "CLDR changes output" · 65 JEP 451: the warning, `-XX:+EnableDynamicAgentLoading`,
`-javaagent` vs attach · 80 `_` in patterns, `switch`, lambdas, `catch` · 89 JEP 471/498 and
`--sun-misc-unsafe-memory-access` · 102 JEP 493 linkable runtimes · 106 `waitFor(Duration)` ·
161 Vector API (one paragraph, When Needed).

### 5.4 · `src/data/pins.js` — report only

- `jdk { source eol:eclipse-temurin, policy lts, cycle 25, pin 25 }` is **correct**: 25 is the
  current LTS and Temurin's `most_recent_lts`. No bump.
- `checked: '2026-08-31'` predates JDK 27 GA; refresh to the next check date.
- **Blind spot:** `static/currency.json` reports `newestOverall: 26.0.2.1+1` because
  endoflife.date's `eclipse-temurin` feed has no 27 row yet, although Adoptium published
  `jdk-27+35` on 2026-09-22 (`api.adoptium.net/v3/info/available_releases`:
  `most_recent_feature_release: 27`). Until the feed catches up, the weekly check cannot see 27.
  Worth a cross-check against the Adoptium API in `scripts/currency.mjs` (a code change — the
  user's call).
- **Unanchored-by-bold:** no page bolds a JDK version, so the checker cannot find the pin in prose.
  The 10 `> Target: Java 25 (LTS)` lines are the natural anchor; bolding "Java 25" inside the
  existing `**Target: …**` span would not work because the span is already bold — the checker's
  pattern needs to be taught `Target: Java NN` instead (again, a script change).
