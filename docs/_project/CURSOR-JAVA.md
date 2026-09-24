---
name: cursor-java
description: 🔴 START HERE for any devbible Java session. The single resume cursor — the standing order, the exact next file, what every in-flight topic owes, and the QC commands that are actually correct. Read this before JAVA-BOARD.md. Split from CURSOR-JAVA-HISTORY.md at the 300-line cap on 2026-09-02 — this half is the CURRENT position; the other half is everything superseded.
metadata:
  type: project
---

# ☕ START HERE — devbible Java

> ⏹️ **SUPERSEDED — last repointed 2026-09-05 by session `1f23d6f4`; see the START HERE
> section below, which is authoritative. Phase 12 is 13/15, not the 10/15 this banner states.**
> The banner is kept for the fork-collision lesson in it.
>
> *(historic)* **2026-09-02 14:52** by session `67176b1d` (coordinator + 3 `devbible-author` forks),
> stopped cleanly on *"We are approaching limit wind up please"*. All three forks finished only
> their current file and reported. **Working tree is clean and pushed.**
>
> 🔴 **A coordinator self-inflicted defect was found and fixed this session — read before editing
> a file another agent might still be touching.** The coordinator re-read
> `12-graceful-shutdown/06-executors-and-schedulers.md` on a STALE snapshot (326 lines) while
> fork C had already self-split it down to 232 lines and created `06a-…`. The coordinator's
> "fix" overwrote fork C's correct 232-line file with a 149-line cut that dropped the
> scheduled-executor-policy and daemon-pool sections and invented a nonexistent `06b` target. The
> gate committed that corruption (`00e871d0`). **Fixed in `b2ee3ae3`** by restoring the exact
> content from the pre-corruption commit (`0f8a0e5d`) — no content was lost. 🔴 **Lesson: before
> editing any file mid-run, `git diff`/`git log` it first — a Read from minutes ago can be stale
> if a fork is still live.**
>
> **Closed this session: phase 12 topic 10 (Packaging for deploy).** Phase 12 is **10 / 15**.
> Java is **178 / 233 (76%)**. All four UI boards wired to that. Topics 08, 09, 12 advanced and
> released (not closed) — see the table below, measured off disk at stop.
>
> ⚠️ **`yarn build` did NOT complete** — Node heap OOM after ~448s, having processed most files
> including all of phase 12/14. **No MDX brace-in-prose crash was observed** in anything it did
> process, so the specific 2026-09-01 failure mode did not recur, but this is not a clean pass.
> A successor should retry with `NODE_OPTIONS=--max-old-space-size=8192` before trusting a build.
>
> 🔴 **THE STANDING ORDER CHANGED 2026-09-02.** User: *"Complete java pending tasks"* then
> *"If you complete all pending jobs in java then please pick python"*. That supersedes the
> 2026-09-01 "after completing current phase do not start new". **Order: phase 12 → 13 → 14 →
> 15 → 16 → Python** (`docs/python/pages/phase-1-language-core/05-truthiness/`).
>
> **Full run-by-run history, superseded START HERE banners, the topic-10 banked research and the
> 2026-09-01 "how this run worked" notes are in [[cursor-java-history]]** — split out at the
> 300-line cap; nothing below is duplicated there.

---

## 🔴 START HERE — the exact next file

```
docs/java/pages/phase-12-jvm-production/13-jvm-flags-that-matter/05f-the-live-list-jdk-25.md
```

**Repointed 2026-09-05** by session `1f23d6f4`, stopped on the user's *"wait enough please
save session progress and wait for my signal to continue"*. It had claimed three rows and
deployed three `devbible-author` forks; **all three were killed while still reading, none
wrote a page, and there is nothing to salvage.** The next file is therefore unchanged from
2026-09-04. 🔴 **Working tree carries no uncommitted Java work.** Full record:
[[progress-java-p12-run-20260905]] · previous run: [[progress-java-p12-run-20260904]].

### 🔴🔴 READ THIS BEFORE BELIEVING THE BOARD: phase 12 is NOT closed

**311 pages across the twelve phase-12 topics marked `✅ done` still end at a bare
`{/* FOOTER */}` marker — they have no navigation at all.** Only topic 09 has real footers.
By the project's own rule, twelve `✅ done` rows are wrong. Counted off disk 2026-09-05.

Fix it with **`shared/scripts/wire-footers.py`** (written 2026-09-05, footer-only,
idempotent, never touches a README's content):

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/wire-footers.py --check <topic-dir>...
```

🔴 **NEVER point `wire-topic.py` at a closed topic** — it regenerates `README.md` from a
template and every one of these twelve indexes is hand-written. It would destroy all twelve.

⚠️ **Wire topics 10 and 12 LAST**, after 11 and 13 have `README.md` files — their final
chunk's `Next topic →` link currently skips the gap, and a re-run cannot correct it because a
wired page no longer carries the marker the script keys on.

### Three rows are CLAIMED by `1f23d6f4` (2026-09-05) — resume them, do not re-claim

| Row | Next file | Position |
|---|---|---|
| p12 · **13** JVM flags | `05f-the-live-list-jdk-25.md` | 12 |
| p12 · **11** GraalVM | `08-testing-a-native-image.md` | 19 |
| p13 · **09** Spring as OAuth2 *client* | `_plan.md` first — nothing on disk | — |

If that session never resumes, take them after the usual staleness check.

### The two open topics, each with its exact next file

| # | Topic | On disk | Next file | Position |
|---|---|---|---|---|
| **13** | JVM flags | 11 chunks, pos 1–11 | `05f-the-live-list-jdk-25.md` | 12 |
| **11** | GraalVM native image | 18 chunks, pos 1–18 | `08-testing-a-native-image.md` | 19 |

Both: 0 over cap, 0 MDX hazards, 0 duplicate positions, 0 broken links. Neither has a
`README.md` (**pos 0**) — that is still owed. ✅ **Both now have a `_category_.json`**, added
2026-09-05. **All their `{/* FOOTER */}` markers are in place by design** — replacing them is
the close step that gets skipped.
**Research for both is COMPLETE and banked. Do not re-fetch.**

Then 13 → 11 close phase 12 at **15/15**, and the four UI boards move *only then*.

### 🔴 Five corrections live in topic 13's pages — do not revert, do not re-derive

1. `-XX:+PrintFlagsFinal` does **not** print `:=` on JDK 25 — plain `=` plus a separate origin
   column. The old `grep ':='` idiom matches nothing, and empty output reads as *"nothing is
   overridden"*. The topic's own `_plan.md` chunk 4 still teaches the `:=` reading; it is wrong.
2. `-XX:+PrintFlagsFinal` is **not in the JDK 25 `java` man page** at all — only
   `PrintFlagsRanges` is. So its output format is not a committed interface.
3. `_PHASE-NOTES.md` item 1 is wrong: `-XX:-ZGenerational` is **obsolete** (warns, ignored),
   not unparseable. Found, not fixed — phase-wide file.
4. 🔴 **`-XX:+HeapDumpOnOutOfMemoryError` AND `-XX:OnOutOfMemoryError` apply ONLY to Java-heap
   exhaustion** (verbatim, two separate man-page entries). Metaspace, direct-buffer and
   native-thread exhaustion get **no dump and no hook**.
5. `-XX:MaxDirectMemorySize` defaults to the **max heap**, so raising `-Xmx` raises it too.

🔴 **Topic 13's 05x series was renumbered TWICE.** Correct names: `05` heap sizing · `05b`
ceilings-that-are-not-the-heap · `05c` GC · `05d` diagnostics · `05e` armed instrumentation ·
planned `05f` JDK 25. Two proven splits produced it (292→475 / 13→24 ★, and 319→364 / 15→19 ★).

### ⚠️ Traps that cost this session time — read before repeating them

- **The JDK 25 `java` man page cannot be fetched whole.** Broad requests truncate and the
  fetcher then reports `NOT PRESENT` for sections it never reached. Ask for **named sections,
  narrowly**. A broad pass put a wrong claim on a committed page; a narrow pass caught it.
- 🔴 **Run `devbible-linkcheck.py` on every fork salvage.** A fork that finishes *or is killed*
  leaves forward links to chunks it never wrote. `mdxcheck` does not resolve links, so the
  topic passes the check people actually run. This happened **twice today** — 18 links, then 5.
- **Re-link `*(not written yet)*` markers as each chunk lands.** Nothing automated catches a
  marker that now names a file which exists; 8 were found stale in topic 11.

### ✅ Done 2026-09-04, do not redo

- **Patch bump Boot 4.1.0→4.1.1, Framework 7.0.8→7.0.9 across 1,646 files** (`8f0506fc`), by
  the currency skill's class-2 procedure. `pins.js` `checked` = 2026-09-04.
- **JAVA-BOARD repaired: 15 wrong rows** — p12 topics had been pasted into the phase-11, 13,
  14, 15 and 16 tables.
- **Phase 14 topic 02 committed** (61 chunks, 12,509 lines) after fixing **145 numbering
  defects**.
- **Phase 13 topic 07 OIDC §3.1.3.7 table fixed** — it did not match the spec.

## 🔴 Defects a successor should fix (found 2026-09-04, not fixed by the finder)

1. ✅ **FIXED 2026-09-05** (`3f89e101`) — **`01-memory-layout/09d-verifying-what-the-jvm-chose.md`**
   taught `:=` vs `=` for `-XX:+PrintFlagsFinal` in **four** places; that reading does not
   exist on JDK 25, which prints a fixed `" ="` plus a separate origin column (`{default}`,
   `{ergonomic}`, `{command line}` …). All four now teach the origin column. 252 → 300 lines.
2. **`02-gc-in-practice/02c2-flags-that-still-work.md`** cites `-XX:+PrintFlagsFinal` as being in
   the JDK 25 `java` man page — it is not; only `PrintFlagsRanges` is.
3. **`_PHASE-NOTES.md` item 1** says `-XX:-ZGenerational` "will not even parse" on JDK 25 — wrong,
   it is *obsolete* (accepted with a warning), not removed.
4. **`09-distributed-tracing/02b-span-kind-and-the-shape-of-a-trace.md`** (~line 100) says
   `@Scheduled` and JMS "require explicit registry wiring" on Boot 4.1 — Boot 4.1.0 source auto-
   wires the `ObservationRegistry` for both; true only for plain Framework.
5. ✅ **FIXED 2026-09-05** (`3f89e101`) — `_category_.json` was missing from **five** phase-12
   topics, not the two recorded here: **05, 11, 13, 14 and 15**. All five created, labels and
   positions matching the ten already on disk.
6. **Framework 7's `DefaultLifecycleProcessor` default timeout is 10s, not 30s** — Boot overrides
   it to 30s and existing pages correctly say "Boot's default (30s)"; just don't attribute 30s to
   plain Spring if a future page needs the distinction.

## 🔴 Full research banked for topics 11 and 13 — read the fork reports, do NOT re-fetch

Both topics can be written entirely from what forks B and C already verified and quoted — GraalVM
licence/GC/closed-world/metadata/agent/observability/build-resources/Boot-native-profile for 11,
and the man-page removed-option inventory/`special_jvm_flags` table/precedence/JEP 519/521 quotes
for 13. The full verbatim quotes are in this session's task reports; [[progress-java-p12-run-20260902]]
carries the condensed version. Re-verify anything the condensed version does not quote in full
before publishing it.

---

## 🔴 QC — use these exact commands

```bash
# MDX — the script WORKS. An earlier warning that it "scans nothing" was TESTED and RETRACTED.
# "0 MDX hazard(s) in 0 file(s)" means zero hazards across zero files-WITH-HITS: a genuine pass.
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py <dir>

# LINKS — os.path.exists() is NOT sufficient. Docusaurus excludes '**/_*.{md,mdx}' from routing,
# so a link to any _plan.md points at a real file and is STILL broken in the build.
python3 /mnt/Storage/my-learning/claude/shared/scripts/devbible-linkcheck.py <dir>

# CAP + footer, per file, before every commit
wc -l <file>                     # must be <= 300
grep -c '^\*\*★' <file>          # star count, for split proofs
tail -1 <file>                   # must be {/* FOOTER */}
```

🔴 **Never link to a `_plan.md`.** Unwritten chunks are plain bold prose with `*(not written yet)*`.

---

## Everything else

- **[[java-board]]** — per-topic claim board and the claim protocol. Claim a row and commit it
  *before* writing.
- **[[cursor-java-history]]** — every superseded START HERE banner, the 2026-09-01 "how this run
  worked" notes, and the topic-10 packaging research (topic 10 is now closed, so that research is
  reference only).
- **[[progress-java-p12-run-20260902]]** — this session's full record: fork briefs, the commit
  gate, and every verified finding from forks A/B/C, including the full GraalVM and JVM-flags
  research for topics 11 and 13.
- **[[progress-java-p12-run-20260901]]** / **[[progress-java-p12-run-20260901b]]** — the two
  2026-09-01 runs' full records.
- **[[java-playbook]]** — the four-step phase recipe and standing orders.
- Banked research: [[research-java-p12-t01-jvm-memory-internals]] ·
  [[research-java-p12-metaspace-codecache-tlabs]].
