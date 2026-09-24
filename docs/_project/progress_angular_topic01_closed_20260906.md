---
name: devbible-angular-topic01-closed-20260906
description: Angular phase 0 topic 01 (the compiler topic) CLOSED 2026-09-06 at 70 files / 17,807 lines / 421 stars — what chunks 15d-17c cover, the recurring wire-pass defect, the 350→491 split proof, and why the dashboard barely moved.
metadata:
  type: project
---

# Angular topic 01 closed — 2026-09-06

`docs/angular/pages/phase-0-how-angular-runs/01-compiler-with-a-framework-attached/`.
**All 17 numbered chunks written: 70 files (69 pages + README), 17,807 lines, 421 ★.**
Session start was 64 files / 16,369 lines / 372 ★.

## What landed

| chunk | file | owns |
|---|---|---|
| 15d | `15d-configuring-extended-diagnostics.md` (232) | the four-step resolution order; NG4003's asymmetry; NG4004/NG4005 printing their own allowed list |
| 15e | `15e-what-changes-underneath-you.md` (259) | the `ng update` migration's two `suppress` entries; checks retuned in patches in both directions |
| 16 | `16-arriving-from-react-vue-or-svelte.md` (219) | all four frameworks compile something — built on three axes, never a compiles/doesn't binary |
| 17 | `17-the-filename-in-the-error.md` (241) | `makeTemplateDiagnostic`'s three source-mapping cases and the three filenames they produce |
| 17b | `17b-the-resolution-errors.md` (283) | NG8001/8002/8003/8023 and their runtime twins; NG3003; the template-only NG80xx family |
| 17c | `17c-the-v22-upgrade-wall.md` (200) | the seven v22 changes on one build, the order to take them in |

## 🔴 The split proof, recorded because it is the rule that gets broken

15d was drafted whole at **350 lines / 11 ★**, then split on the concept boundary
(config-time failures | what changes underneath you) into **232 + 259 = 491 lines / 8 + 7 = 15 ★**.
Both totals UP. Never size a page to the cap — see [[devbible-feedback-never-compress-to-fit-cap]].

## 🔴 The wire-pass defect RECURRED, silently

**16 files carried de-linked `*(not written yet)*` refs to chunks 06, 07, 08, 09, 10 and 15 —
pages that had been on disk for days.** The previous session recorded this exact defect and it
happened again, because a commit landing a chunk is not the chunk being wired. Every automated
check passes a corpus in this state: the link checker sees bold text, not a link.

**The gate:** `grep -rn 'not written yet' *.md` in the topic directory, and check every hit
against `ls` before believing an earlier session finished.

⚠️ **Do not bulk-promote by promised name.** Inbound refs promised *"17 · Consequences you
actually hit"*; what landed was `17-the-filename-in-the-error.md` plus `17b` and `17c`, and each
inbound ref had to be retargeted to whichever file actually owns its subject — `06c`'s NG3003 ref
now points at **17b**, not 17. Forward refs by title are a promise the writer may not keep.

## The dashboard question, answered

`summarise()` in `src/data/progress.js` credits a `writing` phase `topics * pages / pagesPlanned`.
**The unit is a FINISHED TOPIC.** Topic 01 — 70 files, 17,807 lines — moved Angular from
**1 to 2 of 211 topics**, roughly half a percentage point, and phase 0's card from 1 to **2 of 12**.
Nothing is broken; Angular's syllabus simply has 211 topics and this was one of them.
`src/data/page-counts.json` (regenerated from disk: angular 47 → 125) is the number that reflects
the volume. See [[devbible-dashboard-reconcile-20260906]].

## Next

Topic 03 `the-provider-array`, 25 files, chunks 01–08g written.
**Next file: `05e-provide-check-no-changes-config.md`, `sidebar_position: 5.4`** — its README row
(line 44) is already waiting in bold. Bank `research_angular_p0_t03_providers.md` is complete.
Topic 01's own deliberately-open items are `10g`, `10h` and the `NG2xxx` family, all named in
`10-metadata-errors-one-by-one.md`'s coverage note.

Related: [[cursor-angular]] · [[devbible-locks]] · [[devbible-feedback-verify-in-ci-not-locally]]
