---
name: progress-java-p12-run-20260905
description: The 2026-09-05 Java run — session 1f23d6f4 claimed p12 topics 11 and 13 plus p13 topic 09 and deployed three devbible-author forks, then stopped on the user's signal before any fork wrote a page. Carries the ONE substantial finding of the run: 311 pages across 12 "closed" phase-12 topics still carry the bare {/* FOOTER */} marker, and the footer-only wirer written to fix them safely.
metadata:
  type: project
---

# ☕ Java · the 2026-09-05 run — three forks deployed, stopped before they wrote

**Coordinator: session `1f23d6f4`.** User order:

> *"Complete pending java please deploy 3 agents and split the work and use devbible skill
> and you monitor them"* → then, mid-run: *"wait enough please save session progress and
> wait for my signal to continue"*

**Stopped cleanly on that second instruction.** All three forks killed. 🔴 **Nothing to
salvage — every fork was still in its reading/research phase and none had written a page.**
Working tree carries no Java work of theirs.

## The split that was dispatched (reuse it verbatim on resume)

| Fork | Directory | Brief |
|---|---|---|
| A | `p12/13-jvm-flags-that-matter/` | `05f` (pos 12) → `06`, `06b`, `07`, `08`, `09`, `README.md` (pos 0) |
| B | `p12/11-graalvm-native-image/` | `08-testing-a-native-image.md` (pos 19) → `09`, `10`, `README.md` (pos 0) |
| C | `p13/09-spring-as-oauth2-client/` | `_plan.md` first, then chunks from 1 — nothing on disk |

The briefs carried: the five live corrections in topic 13, the seven unconfirmable GraalVM
claims, the Boot-vs-GraalVM metadata-file divergence, the no-fabricated-numbers rule, the
banked-research pointers, and the *"run `devbible-linkcheck.py`, not just `mdxcheck`"* rule.
Rebuild them from [[progress-java-p12-run-20260904]] and [[java-board]]; nothing in them was
invented here.

## 🔴 THE FINDING OF THIS RUN — phase 12 is not closed, and the board says it is

Counted off disk, not from memory:

```
for d in */; do echo "$d $(grep -rl '^{/\* FOOTER \*/}$' "$d" | wc -l) / $(ls "$d"*.md | wc -l)"; done
```

**13 of the 15 phase-12 topics still end every page at the bare `{/* FOOTER */}` marker.**
Only topic 09 (distributed tracing) has real navigation. **311 pages** across the twelve
topics the board calls `✅ done` have **no ← Prev · Index · Next → line at all**, plus 11 in
topic 13 and 18 in topic 11 which are legitimately still open.

| Topic | Marker / files | | Topic | Marker / files |
|---|---|---|---|---|
| 01 memory layout | 47 / 48 | | 09 tracing | **0 / 16 ✅** |
| 02 GC in practice | 43 / 44 | | 10 packaging | 30 / 31 |
| 03 heap sizing | 17 / 18 | | 11 GraalVM | 18 / 19 *(open)* |
| 04 `OutOfMemoryError` | 24 / 25 | | 12 graceful shutdown | 17 / 18 |
| 05 thread dumps | 16 / 17 | | 13 JVM flags | 11 / 12 *(open)* |
| 06 JFR | 20 / 21 | | 14 JMH | 20 / 21 |
| 07 logging | 29 / 30 | | 15 CRaC | 14 / 15 |
| 08 Micrometer | 34 / 35 | | | |

This is the exact systemic defect `project_footer_cleanup_scope.md` records (1,241 pages
across 48 topics) and that phase 13 had repaired on 2026-09-04. **Phase 12 was never done.**
By the project's own rule — *a topic is not closed while a `{/* FOOTER */}` remains in it* —
twelve `✅ done` rows on [[java-board]] are wrong.

### 🔴 The tool to fix it: `shared/scripts/wire-footers.py` — and why NOT `wire-topic.py`

**`wire-topic.py` regenerates `README.md` from a template.** Every one of these twelve topics
has a **hand-written** index — "Still owed" sections, provenance notes, prose. Running it
would silently destroy all twelve. **Do not point it at a closed topic.**

`wire-footers.py` (written this run, committed to the memory store) only ever rewrites a
page's footer and **never touches README.md content** — it replaces a `{/* FOOTER */}` marker
and leaves a page without one completely alone, so it is idempotent and safe to re-run.

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/wire-footers.py --check <topic-dir>...
```

Dry-run verified across all twelve topics: **0 duplicate positions, 0 gaps, 311 footers
pending.** It reads the link label from `_category_.json` when present (the authoritative
sidebar label), else derives it from the directory slug.

⚠️ **Ordering constraint:** the *last* chunk of topics **10** and **12** gets a
`Next topic →` link, and it currently skips over 11 and 13 because those have no `README.md`
yet. **Wire 10 and 12 LAST, after forks A and B write those two indexes**, or their final
page will point at the wrong topic — the script cannot correct it on a re-run, because a page
that already has a real footer no longer carries the marker it keys on.

## ✅ Done this run (committed, devbible `3f89e101`)

1. **Defect 1 fixed** — `01-memory-layout/09d-verifying-what-the-jvm-chose.md` taught the
   pre-JDK-25 `:=` marker in **four** places (a section, a gotcha and two interview answers).
   All four now teach the origin column, the page carries a dated correction note on its
   `> Verified:` line and points at `13/04-printflagsfinal.md`, which owns the flag.
   **252 → 300 lines.** 0 MDX hazards; 284 links, 0 broken.
2. **Five missing `_category_.json`** created — **05, 11, 13, 14 and 15**, not the two
   (14, 15) the defect list recorded. Labels and positions match the ten already on disk.

## ⬜ Still owed — the defect list, unfinished

3. `02-gc-in-practice/02c2-flags-that-still-work.md` — its `> Verified:` line cites
   `-XX:+PrintFlagsFinal` as being in the JDK 25 `java` tool reference. **It is not there at
   all**; only `PrintFlagsRanges` is. ⚠️ The page's line-186 quote (*"To verify your default
   values…"*) is genuine but comes from the **GC Tuning Guide's Parallel chapter**, not the
   man page — so this is a provenance fix on the `> Verified:` line and line 184, not a
   content deletion.
4. `_PHASE-NOTES.md` item 1 — says `-XX:-ZGenerational` *"will not even parse"* on JDK 25.
   Wrong: it is **obsolete** (accepted, warns, ignored), not removed. Phase-wide file.
5. `09-distributed-tracing/02b-span-kind-and-the-shape-of-a-trace.md` (~line 100) — says
   `@Scheduled` and JMS "require explicit registry wiring" on Boot 4.1. Boot 4.1.0 source
   auto-wires the `ObservationRegistry` for both; true only for plain Framework.
6. Framework 7's `DefaultLifecycleProcessor` default timeout is **10s**, not 30s — Boot
   overrides to 30s and existing pages correctly say "Boot's default (30s)". **No fix
   needed**; do not attribute 30s to plain Spring in any future page.

## Board state at stop

Claimed and **left claimed** (memory-store commit before content, per the protocol), so a
successor resumes rather than re-claims: p12 **11** (fork B) and **13** (fork A), p13 **09**
(fork C), all `🚧 picked 2026-09-05 by 1f23d6f4`. **If this session does not resume, a later
one should treat these as abandoned after the usual staleness check and take them.**

Recount at claim time: **187 / 233 topics done, 46 pending.**

⚠️ Another session is live in the **Next.js** lane — `docs/nextjs/pages/05-caching-…/01b`
and `04` were modified in the shared checkout throughout this run. Untouched here. Never
`git add -A`.

Related: [[cursor-java]] · [[java-board]] · [[progress-java-p12-run-20260904]] ·
[[progress-java-p12-run-20260902]] · [[java-playbook]]
