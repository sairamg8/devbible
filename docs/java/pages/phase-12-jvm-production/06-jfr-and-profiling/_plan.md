# Topic 06 · JFR, Mission Control and async-profiler — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **finding where the time and the allocations go**. 🔴 **05 owns the stuck service**
(a dump answers "what is blocked"); this topic answers "what is *busy*". **02 owns the GC
log**; JFR's GC events are read here only as a cross-check. **14 owns microbenchmarks.**

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-regex-that-ate-a-core.md` | The motivating incident: high CPU, no error, nothing in the logs |
| 2 | `02-what-jfr-is.md` | An event recorder built into the JVM, not a bolt-on agent |
| 2b | `02b-the-overhead-argument.md` | Why "always on" is a defensible default, and what the docs claim |
| 3 | `03-starting-a-recording.md` | `-XX:StartFlightRecording`, `jcmd JFR.start/dump/stop/check` |
| 3b | `03b-settings-profiles.md` | `default.jfc` vs `profile.jfc`; editing a `.jfc`; per-event thresholds |
| 3c | `03c-continuous-recording-in-production.md` | `disk=true`, `maxage`, `maxsize`, and dumping on demand |
| 4 | `04-the-event-model.md` | Duration/instant/sample events; the ones worth knowing by name |
| 4b | `04b-custom-events.md` | `jdk.jfr.Event`, `@Name`/`@Label`/`@Category`, `shouldCommit()` |
| 5 | `05-the-jfr-command-line-tool.md` | `jfr summary`, `jfr print`, `jfr metadata` — analysis without a GUI |
| 6 | `06-jdk-mission-control.md` | Loading a recording, the pages that matter, automated analysis |
| 6b | `06b-reading-the-automated-analysis.md` | What its rules actually check, and where they mislead |
| 7 | `07-execution-sampling.md` | How JFR samples stacks, and what a hot method really means |
| 7b | `07b-safepoint-bias.md` | 🔴 The core argument for async-profiler; why sampled profilers can lie |
| 8 | `08-jdk-25-jfr.md` | 🔴 JEP 509 CPU-time profiling (**experimental**, Linux), JEP 518 cooperative sampling, JEP 520 `jdk.MethodTiming`/`jdk.MethodTrace` |
| 9 | `09-async-profiler.md` | `perf_events` + `AsyncGetCallTrace`; cpu, alloc, lock, wall modes |
| 9b | `09b-flame-graphs.md` | Reading one honestly: width is time, x-axis is not time |
| 9c | `9c-running-it-in-a-container.md` | `perf_event_paranoid`, capabilities, and debug symbols |
| 10 | `10-choosing-between-them.md` | A decision table: which tool answers which question |
| 11 | `11-the-checklist.md` | "CPU is at 100%" — the ordered plan |

## Verify, do not assume
- ⚠️ 🔴 Confirm **JEP 509 is experimental** in JDK 25 and name the flag that enables it.
- ⚠️ 🔴 Confirm the JEP 520 event names exactly: `jdk.MethodTiming`, `jdk.MethodTrace`.
- ⚠️ The documented JFR overhead figure — quote it; do not repeat "about 1%" from a blog.
- ⚠️ Whether `jfr` ships in the JDK 25 `bin` directory and its exact subcommands.
- ⚠️ **No fabricated flame graphs, event tables or timings.**
