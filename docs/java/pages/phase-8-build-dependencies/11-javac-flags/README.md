---
title: "javac flags that matter"
sidebar_label: "11 · javac flags that matter"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the JDK 25 `javac` tool specification
> (docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html), JEP 247
> (Compile for Older Platform Versions), JEP 12 (Preview Features), JEP 400
> (UTF-8 by Default), the Apache Maven Compiler Plugin documentation, and the
> Gradle user guide on building Java projects.

**Build tools hide `javac` behind a handful of configuration elements, and
four of those flags change what your code *is*, not merely how it compiles:
`--release` decides which API you are even allowed to call, `-parameters`
decides whether frameworks can see your parameter names, `--enable-preview`
stamps a class file that only one JDK release will ever load, and `-g`
decides how much of a production stack trace is readable. The rest are
diagnostics, and the interesting question there is which warnings you make
fatal.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | [Targeting a release: `--release`, `-source`/`-target`, `--enable-preview`](01-release-and-preview.md) | Why `-source`/`-target` ships jars that throw `NoSuchMethodError`; what `--release` adds; the Maven and Gradle mapping; preview features and why they cannot be shipped |
| 02 | [Parameter names and debug info: `-parameters` and `-g`](02-parameters-and-debug-info.md) | `MethodParameters` vs `LocalVariableTable`; why Spring 6.1 made `-parameters` mandatory; what `-g` costs you in a production stack trace |
| 03 | [Diagnostics and how the compiler runs](03-lint-encoding-proc.md) | `-encoding` and JEP 400; the `-Xlint` categories worth enabling; the honest case against `-Werror`; `-proc:none`; `-J` and forking |

## Why this is three files

The seams are real ones. Chunk 01 is about **which Java you are compiling
for** — a decision that determines whether your artifact runs at all on the
target runtime. Chunk 02 is about **what the compiler writes into the class
file beyond your code**, which decides what frameworks and stack traces can
see. Chunk 03 is about **what the compiler reads, says and runs in** — source
encoding, diagnostics, annotation processing and the compiler's own JVM. The
first breaks in production, the second breaks a framework or an incident
investigation, the third breaks your afternoon.

## Where this connects

- **[Phase 0 · The release model](../../phase-0-platform-jvm/03-release-model.md)**
  — LTS cadence is why `--release` exists at all.
- **[Phase 0 · Packages and the classpath](../../phase-0-platform-jvm/05-packages-classpath/README.md)**
  — `--release` also governs which JDK-internal packages you can reach.
- **[12 · Toolchains](../12-toolchains.md)** — `--release` pins the API level,
  a toolchain pins the actual compiler binary; you usually want both.
- [Annotation processing](../09-annotation-processing/README.md) — `-proc:none` and
  `-proc:full` belong to that topic's mechanism.

---

← Prev: [Artifact repositories](../10-artifact-repositories/README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Toolchains](../12-toolchains.md)

Start here → [Targeting a release](01-release-and-preview.md)
