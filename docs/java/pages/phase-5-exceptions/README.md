---
title: "Phase 5 — Exceptions and failure design"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JLS §11, the JDK 25 API documentation).
> No sandbox: pages carry Java code, never fabricated program output.

Exceptions are Java's failure channel across every layer boundary. Most
codebases get them wrong in one of two directions: swallowing, or wrapping
without cause. This phase is small and dense — eight topics that decide
whether your 3am stack trace names the real problem.

✅ **8 of 8 written — phase complete.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The hierarchy, checked vs unchecked](01-hierarchy-checked-unchecked/README.md)** | <span className="db-tier t-master">Master</span> | `Throwable` → `Error`/`Exception`; the modern lean to unchecked |
| 02 | **[`try`/`catch`/`finally` mechanics](02-try-catch-finally/README.md)** | <span className="db-tier t-master">Master</span> | Multi-catch; what happens when `finally` throws or returns |
| 03 | **[try-with-resources](03-try-with-resources/README.md)** | <span className="db-tier t-master">Master</span> | `AutoCloseable`, reverse close order, suppressed exceptions |
| 04 | **[Custom exceptions and layer translation](04-custom-exceptions-translation.md)** | <span className="db-tier t-understand">Understand</span> | `SQLException` → domain exception → clean 500; always pass the cause |
| 05 | **[Reading a stack trace fast](05-reading-stack-traces/README.md)** | <span className="db-tier t-master">Master</span> | `Caused by` chains, your-code-first scanning, lost traces |
| 06 | **[Checked exceptions inside lambdas](06-checked-exceptions-lambdas.md)** | <span className="db-tier t-understand">Understand</span> | Why `Files.lines(...).map(...)` fights you; wrapper patterns |
| 07 | **[Exceptions as control flow — why not](07-exceptions-as-control-flow.md)** | <span className="db-tier t-understand">Understand</span> | `fillInStackTrace` cost; `Optional` for absence, throw for broken invariants |
| 08 | **[Where the global handler lives](08-global-handler.md)** | <span className="db-tier t-know">Know</span> | `@ControllerAdvice`, `UncaughtExceptionHandler`, the swallow that hides incidents |

## Phase gate

Move on when your repository layer throws one domain exception with the SQL
cause attached, nothing in between logs-and-rethrows (double logging), and the
stack trace at the top still names the original line.

## Where this connects

- **[Phase 2](../phase-2-classes-objects/README.md)** — exception types are
  classes; inheritance decides what a `catch` clause matches.
- **Phase 9 — Spring** industrializes topic 08 as `@ControllerAdvice` +
  `ProblemDetail`.
- **Phase 10 — Data access** is where try-with-resources earns its keep
  (connections, statements, result sets).
