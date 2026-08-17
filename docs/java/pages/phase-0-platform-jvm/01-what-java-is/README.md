---
title: "What Java is: source → bytecode → JVM"
sidebar_label: "01 · What Java is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 documentation
> ([docs.oracle.com/en/java/javase/25/](https://docs.oracle.com/en/java/javase/25/)),
> the Java Virtual Machine Specification (JVMS SE 25, §4 class file format), and
> JEP 400 (UTF-8 by default, finalized in 18).

**Java is two compilations with a virtual machine between them. `javac` compiles
your source into *bytecode* — instructions for an abstract machine that no CPU
implements — and the JVM executes that bytecode on the real CPU, first by
interpreting it, then by compiling the hot parts to native code while the
program runs. Every strength and every quirk of the platform falls out of this
one design decision.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Source to bytecode](01-source-to-bytecode.md)** | What `javac` produces, the class file, version numbers, why `javac` barely optimizes |
| 2 | **[The JVM at run time](02-the-jvm-at-run-time.md)** | Load → verify → interpret → JIT; what "managed runtime" buys; when the process actually exits |
| 3 | **[Write once, run anywhere](03-write-once-run-anywhere.md)** | Why the same `.jar` runs on any OS, where WORA leaks, and the other languages riding the same JVM |

## Why this is the Master topic of Phase 0

Every practical question later in the syllabus resolves against this model:

- *"Why is the service slow right after deploy?"* — because execution starts in
  the interpreter and the JIT needs traffic to find the hot paths (chunk 2,
  deepened in [JIT compilation](../07-jit-compilation.md) once written).
- *"Why did the jar built on my Mac just run on the Linux server?"* — because
  the artifact is bytecode, and the platform-specific half is the JVM already
  installed there (chunk 3).
- *"Why does `java -jar app.jar` fail with `UnsupportedClassVersionError`?"* —
  because class files carry a version stamp and an older JVM refuses newer
  stamps (chunk 1).

## Phase gate contribution

After this topic you can narrate `java -jar app.jar` from process start to
steady state — load, verify, interpret, JIT — which is the Phase 0 gate.

---

← Index: [Phase 0 — The platform and the JVM](../README.md)
