---
title: "Threads: lifecycle, interrupt"
sidebar_label: "01 · Threads: lifecycle, interrupt"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `java.lang.Thread`,
> `Thread.State`, `Thread.UncaughtExceptionHandler` and
> `InterruptedException`, the JDK 20 release notes (removal of
> `Thread.stop`/`suspend`/`resume`), and JLS SE 25 §17.

**A `Thread` is the smallest thing the JVM schedules, and the only way one
thread ever stops another is by *asking*. Java has no kill switch — `stop`
is gone from the platform — so every cancellation in every framework you
use is built from one cooperative protocol: set the interrupt flag, and
write code that notices it. Reading the six lifecycle states and handling
`InterruptedException` correctly are the two skills this topic installs;
everything later in the phase assumes them.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Lifecycle, `start`, daemons](01-lifecycle-start-daemons.md)** | Creating threads, `start()` vs `run()`, the six `Thread.State` values and what each tells you in a thread dump, daemon vs user threads and JVM exit, uncaught exceptions |
| 2 | **[Interruption — the cancellation protocol](02-interruption.md)** | What `interrupt()` actually does, `InterruptedException` and the cleared flag, restore-or-rethrow, `interrupted()` vs `isInterrupted()`, what does and doesn't respond to interrupt, why `stop`/`suspend` were removed |

## Where this connects

- **[The JVM at run time](../../phase-0-platform-jvm/01-what-java-is/02-the-jvm-at-run-time.md)** —
  when the process actually exits is a statement about non-daemon threads.
- **[The exception tree](../../phase-5-exceptions/01-hierarchy-checked-unchecked/01-the-tree.md)** —
  called `InterruptedException` "checked — and special"; chunk 2 is where
  the special part is paid off.
- **Topic 02 · Platform vs virtual threads** — everything here (states,
  interruption, daemons) holds for virtual threads too; what changes is
  what a thread *costs*.

---

← Index: [Phase 6 — Concurrency](../README.md) · Next → [Lifecycle, `start`, daemons](01-lifecycle-start-daemons.md)
