---
title: "Link map · Java · Part 1 (phases 0–1–2)"
sidebar_label: "01 · jvm language classes"
sidebar_position: 1
---

# Link map · Java · Part 1 (phases 0–1–2)

Covers every topic row of `docs/java/syllabus/01-foundations.md` in phase 0 (T00-01 to T00-13, the platform and the JVM), phase 1 (T01-01 to T01-16, language core) and phase 2 (T02-01 to T02-15, classes and objects). That is 44 rows, and every one of them has a written page of ours.
Reading a block: *Read this* is the best page for the concept, *Also good* is a second page, *Beyond the docs* is the one best non-official explanation I found, *Our delta* is what our page adds or does differently. A line is left out when nothing good was found.
Marks: *read* = I fetched the page and read the passage that supports the claim. *headings only* = fetched, only headings or opening checked. Every link was fetched on 2026-10-13 and returned HTTP 200 at the URL shown (canonical URL after redirects). Third-party links carry a date only where the page shows one. No `#anchors` are given.
The dev.java tutorial pages moved: the old `/learn/language-basics/...` paths answer 200 but only hold a script that redirects the browser, so the links below use the new `/learn/language/...` paths.

🔴 **Version note.** Our syllabus targets **Java 25 LTS** (`docs/java/README.md`). That README still lists JDK 26 as the latest release, but openjdk.org/projects/jdk shows **JDK 27 reached GA on 2026-09-15** and JDK 28 in development, so the README's version table is a month behind. Official links use the `/javase/25/` paths where one exists, and the JLS and JVMS links point at the se25 editions. Several third-party picks are older: the Nicolai Parlog module tutorial is Java 9 (2017), his JAR Hell piece is from 2015, the switch-expression guide is Java 13 preview (2019), the instanceof guide is Java 14 to 16 (2021), Allen Holub's inheritance essay is from 2003, and the Odersky/Spoon/Venners equality article is from 2009. Each block says so.

---

## Phase 0 — The platform and the JVM

### T00-01 · What Java is: source, bytecode, JVM — Master · ✅ written `docs/java/pages/phase-0-platform-jvm/01-what-java-is/01-source-to-bytecode.md`
- **Read this:** [The Java Virtual Machine Specification, chapter 1](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-1.html) · Oracle · calls the JVM the cornerstone of the platform and credits it for hardware and operating-system independence and the small size of compiled code (*read*) · covers our angle: **partial** — a specification, not a walk-through of `javac` then `java`
- **Also good:** [javac](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html) · Oracle man page for the compiler (*headings only*)
- **Our delta:** the "same `.jar` from a Mac on the Linux server" framing and where the promise stops (native libraries, JNI).

### T00-02 · JDK vs JRE vs JVM, and distributions — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/02-jdk-jre-jvm.md`
- **Read this:** [Adoptium FAQ](https://adoptium.net/docs/faq/) · Eclipse Adoptium · Temurin is free under GPLv2 with the Classpath Exception, each release passed the Java compatibility kit (it links a TCK affidavit) and the AQAvit suite; release frequency and support are on a separate page it links (*read*) · covers our angle: **partial** — about one distribution, not a comparison
- **Beyond the docs:** [Choosing the Right OpenJDK Distribution for Production](https://foojay.io/today/which-java-runtime-should-you-use-in-production-comparing-openjdk-distributions/) · Catherine Edelveis, Foojay, 2026-04-18 · compares eight distributions (Temurin, Liberica, Zulu, Corretto, Semeru, Red Hat, SapMachine, Microsoft) on TCK status and who sells support, which is the CVE-time question our row raises; the author is a developer advocate at BellSoft, one of the vendors compared, and the article leans toward the Java-focused vendors; it does not explain JDK vs JRE vs JVM · fetched 2026-10-13 (*read*)
- **Our delta:** which distribution your Docker base image is, and why that matters at CVE time; the JDK/JRE/JVM terms themselves.

### T00-03 · Release model: six-month cadence, LTS — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/03-release-model.md`
- **Read this:** [Oracle Java SE Support Roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html) · Oracle · the vendor's own Premier Support dates per release (JDK 25 until September 2030, Extended Support until September 2033, in the table I read) and the free-use licence terms for Oracle JDK 25 (*read*) · covers our angle: **partial** — Oracle's dates only; other vendors differ
- **Also good:** [JDK project page](https://openjdk.org/projects/jdk/) · OpenJDK · every release from 10 to 28 with its GA date (JDK 27 GA 2026/09/15, 28 in development), each linking to its JEP list (*read*)
- **Beyond the docs:** [Java Version and LTS Timeline](https://hidekazu-konishi.com/entry/java_version_and_lts_timeline.html) · Hidekazu Konishi, personal site, first published 2026-07-26, updated 2026-10-12 · release history plus a per-distribution support table (Temurin, Corretto, Red Hat, Microsoft) with sources linked, and the point that "end of life" depends on which build you run; its forward-looking LTS claims are the author's reading of vendor roadmaps, check them before quoting · fetched 2026-10-13 (*read*)
- **Our delta:** "we're on Java 8" as an interview sentence, and the rule build on the LTS, read the feature releases.

### T00-04 · Running code: `java`, `javac`, source launch, `jshell` — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/04-running-code.md`
- **Read this:** [Launching Simple Source-Code Programs](https://dev.java/learn/first-steps/first-java-code/launch-simple-source-code-programs/) · dev.java · single-file launch (the first class must hold `main`), passing arguments, several classes in one file, and multi-file launch since JDK 22 (*read*) · covers our angle: **partial** — no `jshell`
- **Also good:** [JEP 330: Launch Single-File Source-Code Programs](https://openjdk.org/jeps/330) · OpenJDK · the design: compiled in memory, the first class found is executed (*read*) · [JEP 458: Launch Multi-File Source-Code Programs](https://openjdk.org/jeps/458) · OpenJDK (*headings only*) · [JShell introduction](https://docs.oracle.com/en/java/javase/25/jshell/introduction-jshell.html) · Oracle, the REPL since JDK 9 (*read*)
- **Beyond the docs:** [Running Single-file Programs without Compiling in Java 11](https://www.infoq.com/articles/single-file-execution-java11/) · Mohamed Taman, InfoQ, 2019-07-24 · explains the in-memory compile, what happens to a file without a `.java` extension (`--source` is needed), and shebang scripts; written for Java 11, so it predates multi-file launch · fetched 2026-10-13 (*read*)
- **Our delta:** multi-file source programs and `jshell` as a ten-second API probe.

### T00-05 · Packages and the classpath — Master · ✅ written `docs/java/pages/phase-0-platform-jvm/05-packages-classpath/01-packages-and-imports.md`
- **Read this:** [`java` launcher man page](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html) · Oracle · `--class-path`, wildcards, the module path option (*read*) · covers our angle: **partial** — reference, not the "why it works in the IDE" diagnosis
- **Also good:** [`NoClassDefFoundError`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/NoClassDefFoundError.html) · Javadoc · the official definition of the error half of the pair (*read*) · [JVMS chapter 5, loading, linking and initializing](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-5.html) · Oracle (*headings only*)
- **Beyond the docs:** [JAR Hell](https://nipafx.dev/jar-hell/) · Nicolai Parlog (nipafx), 2015-10-19 · why class-path problems happen: a JAR cannot express its dependencies, so a missing one surfaces at run time as `NoClassDefFoundError`, and when two JARs hold the same class name the first on the class path shadows the rest, so behaviour can differ between a developer's IDE and the production machine; written before the module system shipped · fetched 2026-10-13 (*read*)
- **Our delta:** `ClassNotFoundException` vs `NoClassDefFoundError` side by side, and the IDE vs server classpath gap.

### T00-06 · `main`, startup, arguments, `-D` vs environment variables — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/06-main-startup-config.md`
- **Read this:** [`System`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/System.html) · Javadoc · `getProperty`, `getenv` and the standard property list (*read*) · covers our angle: **partial** — API facts, no guidance on which channel to pick
- **Also good:** [A Deep Dive into JVM Start-up](https://inside.java/2025/01/28/jvm-start-up/) · Billy Korando, Inside Java, 2025-01-28 · traces what HotSpot does from the `java` command to printing Hello World on JDK 23: initialization, class loading, linking, GC selection, the CDS archive (*read*) · fetched 2026-10-13
- **Our delta:** the deploy-script view: `-D` for the process, environment for the container. Searched twice for a non-official comparison: the best hit (Baeldung) returned HTTP 403, so none is listed.

### T00-07 · JIT compilation, tiers, warm-up — Know · ✅ written `docs/java/pages/phase-0-platform-jvm/07-jit-compilation.md`
- **Read this:** [Java HotSpot Virtual Machine Performance Enhancements](https://docs.oracle.com/en/java/javase/25/vm/java-hotspot-virtual-machine-performance-enhancements.html) · Oracle JVM Guide · the Tiered Compilation section: since Java SE 7 the server VM also uses the client compiler to produce profiled code, on by default, switch off with `-XX:-TieredCompilation`; also compressed oops and escape analysis (*read*) · covers our angle: **partial** — says nothing about warm-up time or numbered levels
- **Also good:** [Java Virtual Machine Technology Overview](https://docs.oracle.com/en/java/javase/25/vm/java-virtual-machine-technology-overview.html) · Oracle · a one-paragraph description of the adaptive compiler (hot spots compiled, cold code not); it does not name C1, C2 or tiers (*read*)
- **Beyond the docs:** [How we solved a HotSpot performance puzzle](https://developers.redhat.com/articles/2023/09/29/how-we-solved-hotspot-performance-puzzle) · Ashutosh Mehra, Red Hat Developer, 2023-09-29 · defines warm-up as time to peak throughput, shows C1 levels 1 to 3 and C2 level 4, and a case where compiler and application threads competed for CPU so compilation starved; JDK of 2023 · fetched 2026-10-13 (*read*)
- **Our delta:** why the first 100 requests after a deploy are slower than the next 100,000.

### T00-08 · Garbage collection, the working model — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/08-garbage-collection.md`
- **Read this:** [HotSpot Virtual Machine Garbage Collection Tuning Guide: Introduction](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html) · Oracle · when the choice of collector matters and why GC cost grows with core count (throughput and pause time) (*read*) · covers our angle: **partial** — tuning-guide framing, we defer tuning to Phase 12
- **Beyond the docs:** [Understanding Classic Java Garbage Collection](https://www.infoq.com/articles/understand-classic-java-garbage-collection/) · Ben Evans, InfoQ, 2020-05-06 · the generational hypothesis (short-lived temporary objects vs the long-lived working set) behind the young and old split, tracing from GC roots, concurrent vs parallel vs stop-the-world; "classic" means it describes the older collectors, not ZGC or generational ZGC · fetched 2026-10-13 (*read*)
- **Our delta:** what allocation costs, and the hand-off to Phase 12.

### T00-09 · Version managers: SDKMAN!, `.sdkmanrc` — Understand · ✅ written `docs/java/pages/phase-0-platform-jvm/09-version-managers.md`
- **Read this:** [SDKMAN! usage](https://sdkman.io/usage/) · SDKMAN! · `sdk install`, `sdk use`, `sdk env init`, `sdk env`, `sdk env install` (*read*) · covers our angle: **partial** — commands, not the team-pinning argument
- **Beyond the docs:** [Automatic Switching Of Java Versions With SDKMAN!](https://jdriven.com/blog/2020/10/Automatic-Switching-Of-Java-Versions-With-SDKMAN) · Hubert Klein Ikkink, JDriven, 2020-10-16 · `sdk env init` writes `.sdkmanrc`, `sdk env` applies it, `sdkman_auto_env=true` switches on `cd`; 2020 identifiers will differ from today's `sdk list java` · fetched 2026-10-13 (*read*)
- **Our delta:** pinning the JDK on purpose so the team and CI agree.

### T00-10 · Standard library layout — Know · ✅ written `docs/java/pages/phase-0-platform-jvm/10-stdlib-layout.md`
- **Read this:** [Module `java.base`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/module-summary.html) · Javadoc · every exported package with a one-line description (*read*) · covers our angle: **full** for the "where things live" half
- **Also good:** [Java SE 25 API index](https://docs.oracle.com/en/java/javase/25/docs/api/index.html) · Javadoc (*headings only*) · [dev.java learn](https://dev.java/learn/) · tutorials hub (*headings only*)
- **Our delta:** reading the Javadoc as a first reflex, including the since tags. Searched twice for a non-official overview: results were mirrors of the same Javadoc, so none is listed.

### T00-11 · The module system (JPMS) — Know · ✅ written `docs/java/pages/phase-0-platform-jvm/11-module-system.md`
- **Read this:** [JEP 261: Module System](https://openjdk.org/jeps/261) · OpenJDK · the design goals and the rules, including how module paths differ from class paths (*read*) · covers our angle: **partial** — design document, not the "why apps stay on the classpath" advice
- **Also good:** [Project Jigsaw quick start](https://openjdk.org/projects/jigsaw/quick-start) · OpenJDK, a worked `module-info.java` example (*read*) · [`jlink`](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jlink.html) · Oracle man page, assembles modules into a custom runtime image (*read*)
- **Beyond the docs:** [Code-First Java Module System Tutorial](https://nipafx.dev/java-module-system-tutorial/) · Nicolai Parlog (nipafx), 2017-10-03 · `module-info.java`, `requires`, `exports`, `opens`, `uses`/`provides`, and module path vs class path with plain JARs becoming automatic modules; written for Java 9, and it does not cover `jlink` or `--add-opens` · fetched 2026-10-13 (*read*)
- **Our delta:** `--add-opens` errors from frameworks, and `jlink` as the place modules still reach you.

### T00-12 · Java vs Kotlin vs the JVM ecosystem — Know · ✅ written `docs/java/pages/phase-0-platform-jvm/12-java-vs-kotlin.md`
- **Read this:** [Comparison to Java](https://kotlinlang.org/docs/comparison-to-java.html) · Kotlin documentation · what Kotlin fixes and what Java has that Kotlin lacks (*read*) · covers our angle: **partial** — Kotlin's own view; it does list Java's records, `var` and pattern matching but says nothing of sealed types or virtual threads
- **Our delta:** an honest comparison against current Java (records, `var`, pattern matching). Searched three times for a balanced non-official comparison: results were vendor and SEO listicles plus a forum thread, so none is listed.

### T00-13 · HotSpot internals — When Needed · ✅ written `docs/java/pages/phase-0-platform-jvm/13-hotspot-internals.md`
- **Read this:** [HotSpot Group](https://openjdk.org/groups/hotspot/) · OpenJDK · the group's page and links into its documents (*read*) · covers our angle: **partial** — an index, not an explanation
- **Also good:** [Java HotSpot Virtual Machine Performance Enhancements](https://docs.oracle.com/en/java/javase/25/vm/java-hotspot-virtual-machine-performance-enhancements.html) · Oracle JVM Guide · tiered compilation and escape analysis, the two entries from our row that Oracle documents (*read*)
- **Beyond the docs:** [JVM Anatomy Quark 29: Uncommon Traps](https://shipilev.net/jvm/anatomy-quarks/29-uncommon-traps/) · Aleksey Shipilëv, last updated 2021-07-21 · the JIT replaces never-taken branches with an uncommon trap, and when one fires the method is deoptimized and recompiled (C2 version "made not entrant"); a measured walk through the mechanism · fetched 2026-10-13 (*read*)
- **Our delta:** tiered compilation detail and intrinsics as a pointer, not a deep dive. Quark 29 covers deoptimization only; intrinsics are not covered by it.

---

## Phase 1 — Language core

### T01-01 · Primitives vs reference types — Master · ✅ written `docs/java/pages/phase-1-language-core/01-primitives-vs-references/01-the-eight-primitives.md`
- **Read this:** [Creating Primitive Type Variables in Your Programs](https://dev.java/learn/language/constructs/basics/primitive-types/) · dev.java · the eight primitives, ranges, and a table of default values for fields ("zero or null") (*read*) · covers our angle: **partial** — no `long` vs `Long` unset-field contrast
- **Also good:** [Types, Values, and Variables (JLS chapter 4)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-4.html) · Oracle · the normative definition (*headings only*)
- **Our delta:** the `long` field vs `Long` field behaviour when unset, and the null unboxing trap. Searched twice for a good non-official page: results were thin tutorial sites, and the one Baeldung candidate returned HTTP 403, so none is listed. Stack vs heap is also simplified in most such pages.

### T01-02 · Autoboxing and the integer cache — Master · ✅ written `docs/java/pages/phase-1-language-core/02-autoboxing-integer-cache/01-mechanics-and-cache.md`
- **Read this:** [Conversions and Contexts (JLS chapter 5)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-5.html) · Oracle · boxing conversion (5.1.7), including the rule that values from -128 to 127 must be cached (*read*) · covers our angle: **partial** — states the rule, not the bug story
- **Also good:** [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html) · Javadoc · `valueOf` (*read*)
- **Beyond the docs:** [EXP03-J. Do not use the equality operators when comparing values of boxed primitives](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/expressions-exp/exp03-j/) · SEI CERT Oracle Coding Standard for Java, Carnegie Mellon SEI · quotes JLS 5.1.7 on which boxed values are always cached (booleans, bytes, chars up to `\u007f`, ints and shorts from -128 to 127), notes a JVM may cache more so code relying on it is nonportable, and shows a `Comparator` that uses `==` on `Integer` and compares references; the fix is `<`, `>` or `equals`; a rule write-up, not a narrative · fetched 2026-10-13 (*read*)
- **Our delta:** the "works in the test, fails with real IDs" bug and the `valueOf` link the rule skips.

### T01-03 · `var` — Understand · ✅ written `docs/java/pages/phase-1-language-core/03-var.md`
- **Read this:** [Local Variable Type Inference: Style Guidelines](https://openjdk.org/projects/amber/guides/lvti-style-guide) · Stuart Marks, OpenJDK Amber, March 2018 · seven numbered guidelines, for example choose informative names, minimise scope, use `var` when the initializer is clear (*read*) · covers our angle: **full** for the "where it hides the type" half · fetched 2026-10-13
- **Also good:** [LVTI FAQ](https://openjdk.org/projects/amber/guides/lvti-faq) · OpenJDK Amber (*read*) · [Using the Var Type Identifier](https://dev.java/learn/language/constructs/basics/using-var/) · dev.java, the restrictions (locals only, an initializer is required) (*read*)
- **Beyond the docs:** [First Contact With 'var' In Java 10](https://nipafx.dev/java-10-var-type-inference/) · Nicolai Parlog (nipafx), 2017-11-16 · what the compiler infers from the initializer, where `var` is allowed and why not for fields and methods, and the point that an IDE can show the inferred type but a code review cannot; written for Java 10 · fetched 2026-10-13 (*read*)
- **Our delta:** the reviewer's view: what a diff shows without an IDE.

### T01-04 · Operators: division, overflow, `%`, bit operations — Master · ✅ written `docs/java/pages/phase-1-language-core/04-operators-overflow/01-division-remainder-overflow.md`
- **Read this:** [Operators (JLS chapter 15)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-15.html) · Oracle · 15.17.2 and 15.17.3: integer division rounds toward 0 and the remainder follows the dividend's sign; the "integer operators do not indicate overflow" statement is in JLS 4.2.2 (chapter 4), not here (*read*) · covers our angle: **partial** — normative, no worked failures
- **Also good:** [`Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html) · Javadoc · `addExact` and friends (*read*)
- **Beyond the docs:** [NUM00-J. Detect or prevent integer overflow](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/numeric-types-and-operations-num/num00-j/) · SEI CERT Oracle Coding Standard for Java · says Java's integer operators silently wrap without signalling overflow, and compares precondition testing, upcasting and `Math.addExact`, which throws `ArithmeticException` (it lists `absExact` from Java 15 and `divideExact` from Java 18) · fetched 2026-10-13 (*read*)
- **Our delta:** `%` with negatives and bit operations.

### T01-05 · Floating point and `BigDecimal` for money — Master · ✅ written `docs/java/pages/phase-1-language-core/05-floating-point-bigdecimal/01-ieee-754-doubles.md`
- **Read this:** [`BigDecimal`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigDecimal.html) · Javadoc · scale, `setScale(int, RoundingMode)` and the `divide` overloads that take a `RoundingMode` (*read*) · covers our angle: **partial** — the API, not the argument for money
- **Also good:** [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) · David Goldberg, hosted by Oracle · the classic long paper (*headings only*) · [NUM10-J. Do not construct BigDecimal objects from floating-point literals](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/numeric-types-and-operations-num/num10-j/) · SEI CERT · `new BigDecimal(0.1)` prints 0.1000000000000000055511151231257827021181583404541015625, the fix is the `String` constructor (*read*)
- **Beyond the docs:** [Floating-point cheat sheet for Java](https://floating-point-gui.de/languages/java/) · The Floating-Point Guide (floating-point-gui.de), Creative Commons licence, no author named on the page · `new BigDecimal("0.1")` plus `"0.2"` gives exactly 0.3, rounding with `setScale` and a `RoundingMode`, `String.format` for display; the site's home page explains why 0.1 + 0.2 gives 0.30000000000000004; its `strictfp` paragraph is out of date, since all floating-point arithmetic is strict from Java 17 on · fetched 2026-10-13 (*read*)
- **Our delta:** `BigDecimal` with the `String` constructor and explicit scale, as the rule for money.

### T01-06 · Strings: immutability, pool, equality — Master · ✅ written `docs/java/pages/phase-1-language-core/06-strings/01-immutability-pool-equality.md`
- **Read this:** [`String`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html) · Javadoc · `intern`, `equals`, `formatted` (*read*) · covers our angle: **partial** — API facts, no `StringBuilder`-in-loops guidance
- **Also good:** [Strings (dev.java)](https://dev.java/learn/language/constructs/numbers-strings/strings/) · dev.java, creating strings and immutability, `equals` among the methods (*read*)
- **Beyond the docs:** [JVM Anatomy Quark 10: String.intern()](https://shipilev.net/jvm/anatomy-quarks/10-string-intern/) · Aleksey Shipilëv, last updated 2019-03-03 · how the native string table works, why `intern()` is slower than a hand-written deduplicator, and "do not use `String.intern()` without thinking very hard about it"; advanced, assumes you know what the pool is · fetched 2026-10-13 (*read*)
- **Our delta:** the `==` vs `equals` bug at beginner level, which the quark assumes known.

### T01-07 · Text blocks — Understand · ✅ written `docs/java/pages/phase-1-language-core/07-text-blocks.md`
- **Read this:** [Programmer's Guide to Text Blocks](https://openjdk.org/projects/amber/guides/text-blocks-guide) · Jim Laskey and Stuart Marks, OpenJDK Amber · incidental white space and how it is stripped, escape sequences, where the closing delimiter goes (*read*) · covers our angle: **full**
- **Also good:** [JEP 378](https://openjdk.org/jeps/378) · OpenJDK (*read*) · [Text blocks (Oracle docs)](https://docs.oracle.com/en/java/javase/25/text-blocks/index.html) · Oracle, the same guide by the same authors in the Java 25 docs (*read*)
- **Our delta:** SQL and JSON in tests as the use case. Searched twice for a non-official page: results were mirrors of the guide and tutorial stubs, so none is listed.

### T01-08 · Control flow and the modern `switch` — Master · ✅ written `docs/java/pages/phase-1-language-core/08-control-flow-switch/01-the-modern-switch.md`
- **Read this:** [Branching with Switch Expressions (dev.java)](https://dev.java/learn/language/constructs/basics/switch-expression/) · dev.java · arrow labels, `yield`, and enum exhaustiveness, including the default the compiler adds that throws `IncompatibleClassChangeError` if a constant is added later (*read*) · covers our angle: **partial**
- **Also good:** [JEP 361: Switch Expressions](https://openjdk.org/jeps/361) · OpenJDK (*read*) · [Control Flow Statements](https://dev.java/learn/language/constructs/basics/controlling-flow/) · dev.java (*read*)
- **Beyond the docs:** [Definitive Guide To Switch Expressions In Java 13](https://nipafx.dev/java-13-switch-expressions/) · Nicolai Parlog (nipafx), 2019-08-16 · arrows mean no fall-through, `yield` supplies a block's value, and an enum switch without `default` gets a compiler-added throwing default to guard against later constants; written for the Java 13 preview, so it needs `--enable-preview` there, its summary line says Java 13 finalized switch expressions although JEP 361 finalized them in Java 14, and it predates pattern switches · fetched 2026-10-13 (*read*)
- **Our delta:** the replacement for `if`/`else` chains over enums, on Java 25.

### T01-09 · Arrays — Understand · ✅ written `docs/java/pages/phase-1-language-core/09-arrays.md`
- **Read this:** [Creating Arrays in Your Programs (dev.java)](https://dev.java/learn/language/constructs/basics/arrays/) · dev.java (*read*) · covers our angle: **partial** — no covariance or `ArrayStoreException`
- **Also good:** [Arrays (JLS chapter 10)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-10.html) · Oracle · 10.5 states the `ArrayStoreException` rule with an example (*read*)
- **Beyond the docs:** [Stringifying Java Arrays](https://www.infoworld.com/article/2160708/stringifying-java-arrays.html) · Dustin Marx, InfoWorld, 2010-11-30 · `Arrays.toString` shows one level only (nested arrays print as `[Ljava.lang.Object;@...`), `deepToString` goes deep, both return "null" for a null array; covers only the printing half of our row · fetched 2026-10-13 (*read*)
- **Our delta:** covariance and why collections replace arrays in application code.

### T01-10 · Methods: overloading, varargs, pass-by-value — Understand · ✅ written `docs/java/pages/phase-1-language-core/10-methods.md`
- **Read this:** [Passing Information to a Method](https://docs.oracle.com/javase/tutorial/java/javaOO/arguments.html) · Oracle Java Tutorial · reference arguments are passed by value (*read*) · covers our angle: **partial** — no overload resolution with `null`
- **Also good:** [Method invocation expressions (JLS chapter 15)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-15.html) · Oracle · 15.12.2: the phased overload resolution and "choosing the most specific method" (*read*)
- **Beyond the docs:** [Pass-by-Value Please (Cup Size continued)](https://javaranch.com/campfire/StoryPassBy.jsp) · JavaRanch Campfire, no author or date shown, early-2000s style · the remote-control picture: the reference is copied, so changes through it are visible but reassigning the parameter does not touch the caller; "you never pass the object" · fetched 2026-10-13 (*read*)
- **Our delta:** which overload runs for `null`, and varargs traps.

### T01-11 · `static` — Master · ✅ written `docs/java/pages/phase-1-language-core/11-static/01-class-not-instance.md`
- **Read this:** [Understanding Class Members](https://docs.oracle.com/javase/tutorial/java/javaOO/classvars.html) · Oracle Java Tutorial · class variables and class methods (*read*) · covers our angle: **partial** — nothing on tests or thread-safety
- **Also good:** [Initialization of Classes and Interfaces (JLS 12.4)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html) · Oracle · when static state is set up (*read*)
- **Our delta:** static mutable state as the enemy of tests and thread-safety. Searched twice: results were singleton and C# or Kotlin material, nothing Java-specific and deep, so none is listed.

### T01-12 · `final` — Understand · ✅ written `docs/java/pages/phase-1-language-core/12-final.md`
- **Read this:** [Variables (JLS chapter 4)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-4.html) · Oracle · 4.12.4 `final` variables and definite assignment (*read*) · covers our angle: **partial** — normative, no "final is not deep immutability" explanation
- **Our delta:** what each use of `final` prevents, and that the object stays mutable. Searched twice: results were mostly beginner pages, some of which blur final with immutable, so none is listed.

### T01-13 · `null` and `NullPointerException` — Master · ✅ written `docs/java/pages/phase-1-language-core/13-null-and-npe/01-reading-an-npe.md`
- **Read this:** [JEP 358: Helpful NullPointerExceptions](https://openjdk.org/jeps/358) · OpenJDK · the message names the exact variable or expression that was null; its stated non-goal is tracking down the ultimate producer of the null, only the consumer (*read*) · covers our angle: **partial** — no boundary patterns
- **Also good:** [`Objects`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Objects.html) · Javadoc · `requireNonNull` with a message (*read*)
- **Beyond the docs:** [How to Avoid NullPointerException in Java Code](https://foojay.io/today/avoiding-nullpointerexception/) · Victor Rentea, Foojay, 2020-12-22 · validate in the constructor with `Objects.requireNonNull`, return `Optional` from getters for nullable fields, keep collections non-null; one engineer's opinionated style, and the `Optional` advice is debated · fetched 2026-10-13 (*read*)
- **Our delta:** reading the helpful message, and defensive patterns at boundaries.

### T01-14 · Casting and `instanceof` pattern matching — Master · ✅ written `docs/java/pages/phase-1-language-core/14-casting-instanceof/01-reference-casts.md`
- **Read this:** [JEP 394: Pattern Matching for instanceof](https://openjdk.org/jeps/394) · OpenJDK · the pattern variable is in scope only where the match is definite (*read*) · covers our angle: **partial** — the checked-cast idiom is only the motivation
- **Beyond the docs:** [Pattern Matching in Java](https://nipafx.dev/java-pattern-matching/) · Nicolai Parlog (nipafx), 2021-02-16 · flow scoping: the variable is usable after `&&` and after an early return on a negated test; pattern variables were implicitly final in Java 14 and 15 and are reassignable from Java 16 · fetched 2026-10-13 (*read*)
- **Our delta:** reference casts and `ClassCastException` before the pattern form.

### T01-15 · Naming and idiom — Understand · ✅ written `docs/java/pages/phase-1-language-core/15-naming-idiom.md`
- **Read this:** [Google Java Style Guide, naming](https://google.github.io/styleguide/javaguide.html) · Google · package and module names lowercase with no underscores, types in UpperCamelCase, `CONSTANT_CASE` for static final immutable fields (*read*) · covers our angle: **full**
- **Also good:** [Code Conventions for the Java Programming Language](https://www.oracle.com/java/technologies/javase/codeconventions-contents.html) · Oracle, archive-only document last revised 1999 (*read*)
- **Our delta:** one public type per file and package naming from a domain. This is a style guide, not an official Java rule. Searched twice for another source: results were course style pages, so none is listed.

### T01-16 · Operator precedence and evaluation order — Know · ✅ written `docs/java/pages/phase-1-language-core/16-precedence-evaluation.md`
- **Read this:** [Evaluation Order (JLS chapter 15)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-15.html) · Oracle · 15.7: operands are evaluated left to right, and argument lists too (15.7.4) (*read*) · covers our angle: **partial** — normative, hard to read
- **Also good:** [Operator Precedence in Java](https://introcs.cs.princeton.edu/java/11precedence/) · Princeton introcs · a precedence table written for Java 11 and the note that the JLS has no explicit table, it is inferred from the grammar (*read*)
- **Our delta:** parenthesize instead of relying on it. Searched twice: results were interview-quiz pages, so no third-party pick is listed.

---

## Phase 2 — Classes and objects, done properly

### T02-01 · Class anatomy and initialization order — Master · ✅ written `docs/java/pages/phase-2-classes-objects/01-class-anatomy/01-the-parts-and-the-order.md`
- **Read this:** [Initializing Fields](https://docs.oracle.com/javase/tutorial/java/javaOO/initial.html) · Oracle Java Tutorial · static and instance initializer blocks and field initializers (*read*) · covers our angle: **partial** — no superclass-first ordering
- **Also good:** [Creation of New Class Instances (JLS 12.5)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html) · Oracle · the exact order (*read*) · [Providing Constructors](https://docs.oracle.com/javase/tutorial/java/javaOO/constructors.html) · Oracle Java Tutorial (*read*)
- **Beyond the docs:** [MET05-J. Ensure that constructors do not call overridable methods](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/methods-met/met05-j/) · SEI CERT Oracle Coding Standard for Java · quotes JLS 12.5: Java does not alter method dispatch while an object is being created, so an overriding method can run before the subclass is initialized and use uninitialized data; a constructor should call only static, final or private methods; a rule write-up with a noncompliant example · fetched 2026-10-13 (*read*)
- **Our delta:** the full order (field initializers, then constructor body) and `this(...)` chaining.

### T02-02 · Encapsulation and access modifiers — Master · ✅ written `docs/java/pages/phase-2-classes-objects/02-encapsulation-access/01-the-four-levels.md`
- **Read this:** [Controlling Access to Members of a Class](https://docs.oracle.com/javase/tutorial/java/javaOO/accesscontrol.html) · Oracle Java Tutorial · the four levels and the access table (*read*) · covers our angle: **partial** — no argument for package-private as the default
- **Our delta:** package-private as the underrated default for internals. Searched twice: Effective Java "minimize accessibility" summaries came up only as slide decks and study notes (Item 15 of the 3rd edition), not primary text, so none is listed.

### T02-03 · Inheritance, `super`, overriding — Master · ✅ written `docs/java/pages/phase-2-classes-objects/03-inheritance/01-extends-super-construction.md`
- **Read this:** [Overriding and Hiding Methods](https://docs.oracle.com/javase/tutorial/java/IandI/override.html) · Oracle Java Tutorial · override rules and `@Override` (*read*) · covers our angle: **partial** — nothing on why deep hierarchies rot
- **Also good:** [Interfaces and Inheritance (Java Tutorial)](https://docs.oracle.com/javase/tutorial/java/IandI/index.html) · Oracle, the lesson index (*read*)
- **Beyond the docs:** [Why extends is evil](https://www.infoworld.com/article/2160788/why-extends-is-evil.html) · Allen Holub, InfoWorld, 2003-08-01 · the fragile base class: a stack subclass that tracks the maximum stack size broke when the base class changed `push_many()` to a block transfer instead of calling `push()`; Holub argues against `extends` almost entirely, which is stronger than our line, and it is from 2003 · fetched 2026-10-13 (*read*)
- **Our delta:** `@Override` as a compile-time safety net, with shallow hierarchies allowed.

### T02-04 · Polymorphism and dynamic dispatch — Master · ✅ written `docs/java/pages/phase-2-classes-objects/04-polymorphism-dispatch/01-the-two-machines.md`
- **Read this:** [Polymorphism](https://docs.oracle.com/javase/tutorial/java/IandI/polymorphism.html) · Oracle Java Tutorial (*read*) · covers our angle: **partial** — the idea, not the mechanism
- **Also good:** [JVMS chapter 5](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-5.html) · Oracle · method resolution (5.4.3.3) and method selection (5.4.6) (*read*)
- **Beyond the docs:** [How Does JVM Handle Polymorphism (Method Overloading and Overriding) Internally](https://dev.to/njnareshjoshi/how-does-jvm-handle-polymorphism-method-overloading-and-overriding-internally-2m26) · Naresh Joshi, DEV Community, 2019-06-09 · `invokevirtual` dispatches on the object's runtime type through a per-object method table, while overloads are resolved at compile time and show different bytecode; the article quotes the JVMS on the table layout being implementation-specific, so treat it as the usual implementation · fetched 2026-10-13 (*read*)
- **Our delta:** overloading chosen at compile time vs overriding chosen at runtime, the "two machines".

### T02-05 · Abstract classes vs interfaces — Master · ✅ written `docs/java/pages/phase-2-classes-objects/05-abstract-vs-interfaces/01-the-decision-line.md`
- **Read this:** [Abstract Methods and Classes](https://docs.oracle.com/javase/tutorial/java/IandI/abstract.html) · Oracle Java Tutorial · includes the "Abstract Classes Compared to Interfaces" section (*read*) · covers our angle: **partial** — has the comparison but not the choose-by-shared-state rule
- **Also good:** [Defining an Interface](https://docs.oracle.com/javase/tutorial/java/IandI/createinterface.html) · Oracle Java Tutorial · default, static methods (*read*) · [Interfaces (JLS chapter 9)](https://docs.oracle.com/javase/specs/jls/se25/html/jls-9.html) · Oracle (*read*)
- **Our delta:** "is-a with shared state" vs "can-do contract", plus `private` interface methods. Searched twice: results were comparison tables from tutorial sites with no new angle, so none is listed.

### T02-06 · `equals` and `hashCode` — Master · ✅ written `docs/java/pages/phase-2-classes-objects/06-equals-hashcode/01-the-contract.md`
- **Read this:** [`Object`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html) · Javadoc · the contract is written out on `equals` and `hashCode` (*read*) · covers our angle: **partial** — no failure story
- **Also good:** [How To Implement hashCode Correctly](https://nipafx.dev/implement-java-hashcode-correctly/) · Nicolai Parlog (nipafx), 2016-06-13 · hash-based structures do not recompute the position of a stored element when its hash fields change, so do not build `hashCode` from mutable fields (*read*) · [MET11-J. Ensure that keys used in comparison operations are immutable](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/methods-met/met11-j/) · SEI CERT, quotes the `Map` Javadoc warning about mutable keys (*read*)
- **Beyond the docs:** [How to Write an Equality Method in Java](https://www.artima.com/articles/how-to-write-an-equality-method-in-java) · Martin Odersky, Lex Spoon and Bill Venners, Artima, 2009-06-01 · four pitfalls: wrong signature, `equals` without `hashCode`, defining `equals` on mutable fields (a point added to a `HashSet` then changed can no longer be found by `contains`), and breaking the equivalence relation with subclasses; 2009, Java 5/6 style code, and the `canEqual` fix is rarely used now · fetched 2026-10-13 (*read*)
- **Our delta:** the entity that "disappears" from a `HashSet`, using a record or an immutable key.

### T02-07 · `toString` — Understand · ✅ written `docs/java/pages/phase-2-classes-objects/07-tostring.md`
- **Read this:** [`Object`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html) · Javadoc · `toString` recommendation: a concise but informative representation that is easy to read (*read*) · covers our angle: **partial**
- **Our delta:** no secrets, no lazy-loaded graphs, for logs only. Searched twice: results were generic tips and a Lombok-with-JPA pitfall write-up that I did not read, so none is listed.

### T02-08 · Records — Master · ✅ written `docs/java/pages/phase-2-classes-objects/08-records/01-the-feature.md`
- **Read this:** [`Record`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Record.html) · Javadoc · mandated members and why you would write an explicit canonical constructor: validation, defensive copies, normalisation (*read*) · covers our angle: **partial**
- **Also good:** [JEP 395: Records](https://openjdk.org/jeps/395) · OpenJDK, "transparent carriers for immutable data" (*read*) · [Using Records to Model Immutable Data (dev.java)](https://dev.java/learn/language/oop/records/) · dev.java, canonical and compact constructors (*read*)
- **Beyond the docs:** [Why Java's Records Are Better\* Than Lombok's @Data and Kotlin's Data Classes](https://nipafx.dev/java-record-semantics/) · Nicolai Parlog (nipafx), 2021-05-05 · argues that boilerplate removal is a side effect and the point is the semantics: records are transparent carriers of shallowly immutable data, which is why they allow no extra fields, no inheritance, and require an accessor per component and a canonical constructor; opinionated, written when records were new in Java 16 · fetched 2026-10-13 (*read*)
- **Our delta:** records as the default data carrier replacing DTO classes.

### T02-09 · Sealed interfaces, records and `switch` as ADTs — Understand · ✅ written `docs/java/pages/phase-2-classes-objects/09-sealed-adts.md`
- **Read this:** [JEP 409: Sealed Classes](https://openjdk.org/jeps/409) · OpenJDK (*read*) · covers our angle: **partial** — the language rules, not the modelling
- **Beyond the docs:** [Data Oriented Programming in Java](https://www.infoq.com/articles/data-oriented-programming-java/) · Brian Goetz, InfoQ, 2022-06-20 · records are product types, sealed classes are sum types, and a switch over a sealed type with no `default` makes the compiler show which switches break when a subtype is added; it has a "complex return types" section close to our `PaymentResult`; written in 2022, before pattern switch and record patterns were final in Java 21 · fetched 2026-10-13 (*read*)
- **Our delta:** the `PaymentResult` example with `Approved`, `Declined`, `Failed`.

### T02-10 · Enums — Master · ✅ written `docs/java/pages/phase-2-classes-objects/10-enums/01-the-machinery.md`
- **Read this:** [Enum Types](https://docs.oracle.com/javase/tutorial/java/javaOO/enum.html) · Oracle Java Tutorial · fields, methods and `values()` (*read*) · covers our angle: **partial**
- **Also good:** [`Enum`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Enum.html) · Javadoc · `valueOf` throws `IllegalArgumentException` for an unknown name (*read*)
- **Our delta:** per-constant behaviour for status machines and strategy tables. Searched twice: results were Effective Java Item 34 summaries (slides, not primary) and coaching sites, so none is listed.

### T02-11 · Nested classes — Understand · ✅ written `docs/java/pages/phase-2-classes-objects/11-nested-classes.md`
- **Read this:** [Nested Classes](https://docs.oracle.com/javase/tutorial/java/javaOO/nested.html) · Oracle Java Tutorial · static nested vs inner, local and anonymous (*read*) · covers our angle: **partial** — no leak shape
- **Beyond the docs:** [Avoid memory leaks in inner classes](https://www.infoworld.com/article/2255920/avoid-memory-leaks-in-inner-classes.html) · Jeff Friesen, InfoWorld, 2020-02-20 · uses `javap` to show the synthetic `this$0` field holding the outer instance, then an example that exhausts memory as each inner object pins a large array; caution: I compiled its empty `EnclosedClass` with JDK 21 and `javap` showed no `this$0` field, because javac now leaves the field out when the inner class never uses the outer instance, so reproduce the leak with an inner class that reads outer state · fetched 2026-10-13 (*read*)
- **Our delta:** the outer-instance reference inner classes hold secretly.

### T02-12 · Designing immutable classes — Master · ✅ written `docs/java/pages/phase-2-classes-objects/12-immutable-design/01-the-recipe-and-defensive-copies.md`
- **Read this:** [`List`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html) · Javadoc · `copyOf` and the unmodifiable-collection rules (*read*) · covers our angle: **partial**
- **Also good:** [OBJ05-J. Do not return references to private mutable class members](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/object-orientation-obj/obj05-j/) · SEI CERT Oracle Coding Standard for Java · a getter that returns the internal `Date` breaks encapsulation, the fix returns a defensive copy (*read*)
- **Beyond the docs:** [Model Data Immutably and Transparently - Data-Oriented Programming v1.1](https://nipafx.dev/dop-v1-1-immutable-transparent-data/) · Nicolai Parlog (nipafx), 2024-05-27 · starts from a `HashSet` entry that becomes undiscoverable after a hash field changes and argues immutability removes that class of bug, then shows records as the vehicle; it says little about defensive copies, only that a constructor should store values directly or as a copy · fetched 2026-10-13 (*read*)
- **Our delta:** the whole recipe: final fields, defensive copies, no leaked `this`.

### T02-13 · Composition over inheritance — Understand · ✅ written `docs/java/pages/phase-2-classes-objects/13-composition-over-inheritance.md`
- **Read this:** [Interfaces and Inheritance (Java Tutorial)](https://docs.oracle.com/javase/tutorial/java/IandI/index.html) · Oracle (*read*) · covers our angle: **partial** — it teaches inheritance, not its limits
- **Beyond the docs:** [Why extends is evil](https://www.infoworld.com/article/2160788/why-extends-is-evil.html) · Allen Holub, InfoWorld, 2003-08-01 · argues for programming to interfaces and, for a stack built on `ArrayList`, encapsulating the data structure instead of subclassing; pairs with T02-03, same article, different half · fetched 2026-10-13 (*read*)
- **Our delta:** delegation, and the `extends ArrayList` mistake. Effective Java Item 18 is the standard reference for this, but only course PDFs of it turned up and I did not read them.

### T02-14 · Object lifecycle: `Cleaner`, no finalization — Know · ✅ written `docs/java/pages/phase-2-classes-objects/14-object-lifecycle.md`
- **Read this:** [JEP 421: Deprecate Finalization for Removal](https://openjdk.org/jeps/421) · OpenJDK · why finalization is going away and what replaces it; the text is JDK 18 era and says finalization stays enabled by default for now (*read*) · covers our angle: **partial**
- **Also good:** [`Cleaner`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ref/Cleaner.html) · Javadoc (*read*) · [MET12-J. Do not use finalizers](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/methods-met/met12-j/) · SEI CERT, no fixed finalizer time, two GC cycles, may never run (*read*)
- **Beyond the docs:** [Clean your Memory: From Finalize to Cleaner](https://blog.frankel.ch/java-cleaner/) · Stefano Fago, blog.frankel.ch, 2025-03-23 · finalizer problems (undetermined timing, an extra GC cycle, unintended retention) and Cleaner rules: prefer try-with-resources, keep the cleaning action from capturing the object (avoid lambdas), call `clean()` from `close()` · fetched 2026-10-13 (*read*)
- **Our delta:** resource cleanup belongs to try-with-resources (Phase 5). The JEP's removal timeline may have moved since it was written; check the current JDK notes.

### T02-15 · The rest of `Object`: `clone`, `getClass`, `wait`/`notify` — Know · ✅ written `docs/java/pages/phase-2-classes-objects/15-rest-of-object.md`
- **Read this:** [`Object`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html) · Javadoc · every method with its contract (*read*) · covers our angle: **partial**
- **Beyond the docs:** [NoClone](https://checkstyle.org/checks/coding/noclone.html) · Checkstyle documentation · `clone` "relies on strange, hard to follow rules": `Cloneable` does not declare `clone()`, `clone` does not work with final mutable references, and a copy constructor or static factory method can be used instead; it covers `clone` only, not `getClass` or `wait`/`notify` · fetched 2026-10-13 (*read*)
- **Our delta:** `getClass` and `wait`/`notify` as legacy pointers (Phase 6).
