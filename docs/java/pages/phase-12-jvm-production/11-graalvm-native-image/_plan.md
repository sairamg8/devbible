# Topic 11 · GraalVM native image — chunk plan

Tier: **Know**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **ahead-of-time compilation to a native executable** and its closed-world cost.
🔴 **10 owns JVM packaging and the AOT cache** (a different thing with a similar name);
**15 owns CRaC** (the other fast-start answer). This topic must state all three boundaries
explicitly, because they are the most-confused trio in the phase.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-what-problem-it-solves.md` | Startup and footprint, for scale-to-zero and short-lived processes |
| 2 | `02-the-closed-world-assumption.md` | 🔴 The single idea everything else follows from |
| 3 | `03-what-breaks.md` | Reflection, proxies, resources, JNI, serialisation, `Unsafe` |
| 3b | `03b-reachability-metadata.md` | The JSON configs, the shared metadata repository, and who supplies them |
| 3c | `03c-the-tracing-agent.md` | `-agentlib:native-image-agent`, and why its coverage equals your test coverage |
| 4 | `04-build-time-vs-run-time-initialisation.md` | The static initialiser that baked a timestamp into your binary |
| 4b | `04b-the-secret-baked-into-the-image.md` | 🔴 A security failure mode, not just a bug |
| 5 | `05-spring-boot-aot.md` | `spring-boot:process-aot`, generated bean definitions, `native` profile |
| 5b | `05b-what-spring-gives-up.md` | Conditional beans evaluated at build time; no runtime profile switching |
| 6 | `06-building-one.md` | `native-image`, the Maven/Gradle plugins, and the build resources it needs |
| 6b | `06b-the-build-that-takes-ten-minutes.md` | CI cost, memory, and where it lands in the pipeline |
| 7 | `07-runtime-characteristics.md` | Startup, RSS, peak throughput, GC choices in a native image |
| 7b | `07b-no-jit-no-jfr-no-jstack.md` | 🔴 The observability you lose — and what replaces it |
| 8 | `08-testing-a-native-image.md` | Native test execution and why JVM-green does not mean native-green |
| 9 | `09-when-it-pays.md` | An honest decision table: functions and CLIs yes; long-lived high-throughput usually no |
| 10 | `10-the-checklist.md` | Deciding, then doing it without surprises |

## Verify, do not assume
- ⚠️ 🔴 Whether Oracle GraalVM's native-image is the assumed distribution and its JDK 25
  availability; state the licence position accurately.
- ⚠️ 🔴 What **JFR support in native image** actually is on the current release — it is
  partial, and 07b must be precise rather than saying "you lose JFR".
- ⚠️ Which GC is available in native image (Serial by default; G1 in Oracle GraalVM).
- ⚠️ Boot 4.1's native testing support and the plugin goals it documents.
- ⚠️ **No fabricated startup times, binary sizes or RSS figures.**
