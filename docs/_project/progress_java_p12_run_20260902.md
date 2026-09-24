---
name: progress-java-p12-run-20260902
description: The 2026-09-02 Java run — session 67176b1d as coordinator plus 3 devbible-author forks closing phase 12 topics 08–13, under the user's order to finish ALL pending Java and then pick Python. Carries the fork split, the commit gate, the board wiring done on arrival, and (appended per event) what each fork established.
metadata:
  type: project
---

# Java · the 2026-09-02 run — phase 12 to close, then 13 → 16, then Python

**Coordinator: session `67176b1d`.** User orders, in sequence:

> *"Complete java pending tasks and deploy max 3 agents and make sure they follow hard rules"*
> → mid-run: *"If you complete all pending jobs in java then please pick python"*

🔴 **The second sentence supersedes the 2026-09-01 standing order "after completing current phase
do not start new".** The order of work is now: phase 12 (6 open rows) → phase 13 (4 indexes close
three topics; 6 topics open) → phase 14 (3 partial, 9 planned, holder `af46ba56` stale >20 h) →
phase 15 → phase 16 → **Python** at `docs/python/pages/phase-1-language-core/05-truthiness/`.
Phases 15/16 were "deferred, not cancelled" on 2026-09-01; "complete all pending jobs" lifts that.

## Setup (all committed)

| Worker | Directories, in order | Board rows |
|---|---|---|
| fork A | `10-packaging-for-deploy/README.md` → `09-distributed-tracing/` (honour the 9 filenames its earlier author linked: `03b-the-traceparent-header`, `03c-tracestate-and-baggage`, `03d-b3-and-the-other-formats`, `03e-propagation-that-breaks`, `05-wiring-it-in-spring-boot`, `05b-custom-spans-and-annotations`, `06-sampling`, `06b-the-trace-you-needed-was-not-sampled`, `08-cost-and-overhead`) | 10, 09 |
| fork B | `08-metrics-with-micrometer/` (`11-cost-and-overhead` pos 29, `12-the-checklist` pos 30, optional `10b-burn-rate-alerts`, README) → `13-jvm-flags-that-matter/` from `_plan.md` | 08, 13 |
| fork C | `12-graceful-shutdown/` (`06-executors-and-schedulers` pos 9 → `06b`, `07`, `08`, `08b-prestop-and-termination-grace-period`, `09`, `10`, README) → `11-graalvm-native-image/` from `_plan.md` | 12, 11 |

- **Common fork brief** (hard rules, MDX brace rule, QC commands, report shape):
  scratchpad `COMMON-BRIEF.md` — its content is the rules in `CLAUDE-FULL.md` §1–§7 plus the
  2026-09-01 findings (braces in prose kill the build; never link `_plan.md`; footer only when done).
- **Commit gate** `gate.py` (scratchpad) runs every 2 min under a Monitor: commits every file in
  topics 08–13 that is ≤300 lines AND ends `{/* FOOTER */}` (explicit paths, one commit per topic),
  re-stamps the holder cells on [[java-board]], and rewrites the auto-measured LIVE block at the top
  of [[cursor-java]] (chunks · lines · ★ · next position · index? per topic). **So the cursor is
  repointed per committed file without a human in the loop.**
- **Boards wired on arrival** (they were stale at 7 / "Planned"): `progress.js` phase 12 →
  `pages: 9, pagesPlanned: 15`; `docs/java/pages/README.md` row 12 → 9/15; `docs/README.md` claim
  row and Java row appended. Commits `c59eaea0`, `87aa3850` in devbible.
- Build registry: arrival notice only, no build claimed. `yarn build` is owed before the session ends
  (the 2026-09-01 lesson: `mdxcheck.py` cannot see `{`/`}` in prose).

## Per-topic close-out (appended as each closes)

- ✅ **10 · Packaging for deploy — CLOSED 2026-09-02 14:37** by fork A: `README.md` (145 L) over 29 chunks; 7,647 lines total; 0 over cap; 0 MDX hazards; 251 links, 2 forward refs to `../11-…/README.md` and `../12-…/README.md` that fork C resolves. Boards wired (devbible commit after `87aa3850`). `_category_.json` still absent (topic 14 has none either).

## What the forks established — condensed; full quotes are in each fork's final task report

**Fork A (topics 10, 09):** Boot 4.1 tracing page in full (starters, properties, sampler values,
correlation-id format, baggage rules, exemplars, `management.observations.annotations.enabled`
default false + duplicate-observation trap, env-var mapping table); OTel Java agent README confirms
**JDK 25 is in the tested matrix** (Temurin/OpenJ9 8/11/17/21/25/26), agent MDC keys are
`trace_id`/`span_id` (underscore) vs Micrometer's `traceId`/`spanId`; OTel spec sampler names and the
`ParentBased` decision table; W3C `tracestate` (32-member cap, 512-char SHOULD) and Baggage (64
members / 8192 bytes) grammars in full; B3 single/multi header formats; Collector tail-sampling
processor is **beta**. Verified defect: `02b-span-kind-and-the-shape-of-a-trace.md` wrongly says
`@Scheduled`/JMS need explicit registry wiring on Boot 4.1 (source auto-wires both).

**Fork B (topics 08, 13):** Micrometer memory-footprint formulas and the two source pages that
disagree on the default percentile-histogram clamp (66 vs 73 buckets — page must state both).
Full JDK 25 man-page "Removed" inventory by release (9 through 25), the `special_jvm_flags` table
(deprecated/obsolete by JDK version), `JAVA_TOOL_OPTIONS`/`JDK_JAVA_OPTIONS`/`_JAVA_OPTIONS`
precedence order from `arguments.cpp` with the exact quotes, `IgnoreUnrecognizedVMOptions` scope,
locked-flag error text, JEP 519/521/514 quotes. Verified defects: `01-memory-layout/09d-…` teaches
`:=` output that does not exist on JDK 25 (origin-column form instead); `02-gc-in-practice/02c2-…`
wrongly cites `PrintFlagsFinal` as being in the man page; `_PHASE-NOTES.md` item 1 wrongly says
`-ZGenerational` "will not even parse" (it is obsolete, warns).

**Fork C (topics 12, 11):** Spring Kafka/AMQP consumer shutdown timeouts and events; HikariCP
`shutdown()` source walk (10s abort bound); Spring's destroy-method inference and `depends-on`
ordering; Boot 4.1 Kubernetes-probes shutdown-state table verbatim; Kubernetes preStop/grace-period
raw-doc quotes including the 2-second extension and `sleep`-hook syntax. Full GraalVM topic 11
research: licence position (Oracle GFTC vs CE GPLv2+Classpath), GC availability (Serial default,
G1 Oracle-only Linux), closed-world quote, reachability-metadata paths, tracing-agent flags, class-init
rules, JFR/heap-dump/jcmd support in native image, build-resource defaults, full Boot 4.1 native
Maven/Gradle goal list. Verified defect: Framework 7's `DefaultLifecycleProcessor` default timeout
is 10s (Boot overrides to 30s — existing pages correctly attribute 30s to Boot already).

Related: [[java-board]] · [[cursor-java]] · [[progress-java-p12-run-20260901b]] · [[java-playbook]]
