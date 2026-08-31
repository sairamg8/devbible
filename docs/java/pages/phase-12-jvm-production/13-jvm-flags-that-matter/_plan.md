# Topic 13 · JVM flags that matter in 2026 — chunk plan

Tier: **Know**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the flag inventory and the discipline around it**: the short live list, the retired
list, ergonomics, and how to check rather than believe. 🔴 Every other topic in the phase
*uses* flags and links here for the inventory; this topic is where a flag's status is
recorded once.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-flags-you-inherited.md` | A `JAVA_OPTS` nobody can explain, copied across three services |
| 2 | `02-the-three-kinds.md` | Standard `-`, non-standard `-X`, and `-XX` (product/diagnostic/experimental) |
| 2b | `02b-unlocking-diagnostic-and-experimental.md` | `+UnlockDiagnosticVMOptions`, `+UnlockExperimentalVMOptions` |
| 3 | `03-ergonomics.md` | What the JVM decides for itself, and why fewer flags is usually better |
| 4 | `04-printflagsfinal.md` | 🔴 The reader's own verification path; reading `:=` vs `=` |
| 4b | `04b-vm-flags-on-a-running-process.md` | `jcmd VM.flags`, `VM.command_line`, `VM.system_properties` |
| 5 | `05-the-live-list-memory.md` | `-Xmx`/`-Xms`, `MaxRAMPercentage`, `MaxMetaspaceSize`, `MaxDirectMemorySize` |
| 5b | `05b-the-live-list-gc.md` | Collector selection, `MaxGCPauseMillis`, `-Xlog:gc*` |
| 5c | `05c-the-live-list-diagnostics.md` | `HeapDumpOnOutOfMemoryError`, `HeapDumpPath`, `ExitOnOutOfMemoryError`, `NativeMemoryTracking`, `StartFlightRecording` |
| 5d | `05d-the-live-list-jdk-25.md` | 🔴 `UseCompactObjectHeaders` (JEP 519), `AOTMode`/`AOTCache` (JEP 514/515) |
| 6 | `06-the-retired-list.md` | 🔴 CMS, PermGen, `-XX:+ZGenerational`, `PrintGCDetails`, `-Xincgc` — and what replaced each |
| 6b | `06b-the-flag-that-stops-your-jvm-booting.md` | Unrecognised `-XX:` is fatal; `IgnoreUnrecognizedVMOptions` and why it is a trap |
| 7 | `07-where-flags-come-from.md` | `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `_JAVA_OPTIONS`, the command line — and their precedence |
| 8 | `08-the-discipline.md` | One flag, one reason, one measurement, written down |
| 9 | `09-the-checklist.md` | Auditing an inherited `JAVA_OPTS` line by line |

## Verify, do not assume
- ⚠️ 🔴 **Every flag's status on JDK 25** — from the `java` tool reference and the release
  notes. A flag that is merely *deprecated* must not be listed as *removed*.
- ⚠️ The precedence order of the three environment variables — quote the tool reference.
- ⚠️ Whether `-XX:+UseCompactObjectHeaders` still needs an unlock flag on 25 (JEP 519 made it
  product — confirm what that means for the unlock requirement).
