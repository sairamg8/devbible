---
name: progress-java-p11-t09-jacoco
description: Phase 11 topic 09 (Coverage with JaCoCo) — what is written, the chunk map, the source-verified corrections, and the fork split that is closing the rest of phase 11. Open before touching 09-jacoco/.
metadata:
  type: project
---

# Java · Phase 11 · Topic 09 — Coverage with JaCoCo

Session `01cb3b13`, 2026-08-31. ✅ **CLOSED** — 22 chunks + `README.md` index, **5,306 lines,
304 ★**, positions contiguous 0–22, 0 over the cap, 0 dangling links. Claimed on the board before
writing a word; released the same way.
Directory: `docs/java/pages/phase-11-testing/09-jacoco/`.

## 🔴 The phase is being closed by FOUR agents — the user authorised it

> *"You can deploy agents make sure to adhere instructions and especially hard rules and finish
> the current picked phase just split the work"* — 2026-08-31.

**The split is one topic per agent, NOT bands inside one topic** — the four remaining topics are
disjoint directories, so unlike topic 08 there is no renumbering to collapse at close. The one
exception is topic 12, which is Master tier with 13 planned chunks and was split across two forks
on `sidebar_position` bands.

| Agent | Topic | Band |
|---|---|---|
| coordinator `01cb3b13` | **09 · JaCoCo** | whole directory, positions 1..N |
| fork A | 10 · Property-based (jqwik) | whole directory |
| fork B | 11 · Mutation testing (PIT) | whole directory — **closes the phase** |
| fork C | 12 · Real-world scenarios, chunks `01`–`03d` | positions **1–29** |
| fork D | 12 · Real-world scenarios, chunks `04`–`12` | positions **30–59** |

🔴 **The coordinator renumbers topic 12 contiguously at close and writes its `README.md`.**
Forks C and D were told explicitly NOT to write `README.md`.

## Written and committed — all 22, in reading order

`01-what-coverage-measures` 257/14 · `01b-how-jacoco-works` 265/15 ·
`02-wiring-it-up-maven` 269/14 · `02b-the-argline-trap` 243/13 ·
`02c-wiring-it-up-gradle` 293/14 · `02d-integration-tests-and-failsafe` 272/14 ·
`03-the-six-counters` 285/16 · `03b-branch-coverage-is-the-useful-one` 242/14 ·
`03c-line-coverage-needs-debug-info` 235/14 · `04-thresholds` 252/11 ·
`04a-floor-or-target` 155/12 · `04b-the-eighty-percent-ritual` 266/14 ·
`04c-the-ratchet` 229/12 · `05-exclusions` 256/15 ·
`05b-the-generated-annotation-rule` 221/14 · `05c-what-jacoco-filters-for-free` 227/14 ·
`06-what-the-number-cannot-say` 218/14 · `06b-try-catch-is-invisible` 235/14 ·
`06c-the-zero-percent-class` 216/15 · `07-multi-module` 252/14 ·
`07b-coverage-in-ci` 222/15 · `08-the-checklist` 196/12 · `README.md` 102.

## ONE SPLIT, PROVEN

`04-thresholds.md` drafted to exhaustion at **324 lines / 16 ★** — over the cap. Split on the
syntax/policy boundary the page already had:

| | lines | ★ |
|---|---|---|
| before (one file) | 324 | 16 |
| **after (04 + 04a)** | **407** (252 + 155) | **23** (11 + 12) |

Both totals UP. Nothing trimmed. Three gotchas and two interview questions moved **verbatim** to
the half they are about; four gotchas and three interview questions **added** that the new
boundary makes obvious.

⚠️ **The carve introduced two heading defects, both repaired in the same commit** — worth knowing
for the next mechanical split: cutting the *last* gotcha out of a block also swallows the
`## Interview questions` heading that follows it, so it vanishes from the source file and arrives
as a duplicate in the destination. Check `grep -n '^## '` on both halves after any scripted split.

## ⚠️ Two link-name collisions, caught before any target existed

Fixed in `1cecb99c`: `02-wiring-it-up.md` → `02-wiring-it-up-maven.md`, and
`07-coverage-in-ci.md` → `07b-coverage-in-ci.md`. Both were written into earlier chunks as forward
links before the target files were created. **The audit that caught them, worth re-running on any
topic before close:**

```bash
D=docs/java/pages/phase-11-testing/09-jacoco
grep -oh '](0[0-9][a-z0-9]*-[a-z0-9-]*\.md)' $D/*.md | sed 's/.*](//;s/)//' | sort -u \
  | while read t; do [ -f "$D/$t" ] || echo "DANGLING: $t"; done
```

## 🔴 The research is banked and round-2 verified — do NOT re-derive

Everything is in **`research_java_p11_t09_jacoco.md`**, whose "ROUND 2" section corrects the
original. The corrections that matter most:

- 🔴 **0.8.15 (2026/06/04) is the latest RELEASE**; `0.8.16.202608270545` is a **snapshot**. The
  original research quoted the snapshot as if shippable.
- **The `_plan.md`'s JDK-25 worry is resolved:** 0.8.15 officially supports **Java 26** class
  files, experimental 27/28. Say so plainly, do not hedge.
- 🔴 `prepare-agent-integration` sets **`argLine`**, not a `failsafeArgLine` — caught mid-write and
  an interview answer was rewritten. Binds to `pre-integration-test`, writes `jacoco-it.exec`.
- 🔴 **`jakarta.annotation.Generated` is `@Retention(SOURCE)`**, so JaCoCo's `@*Generated` filter
  (which needs RUNTIME or CLASS retention) cannot see it and does **not** filter it.
- 🔴 **Lombok does not add `@lombok.Generated` by default** — opt in with
  `lombok.addLombokGeneratedAnnotation = true`. Every "JaCoCo ignores Lombok" claim is conditional.
- **There is no `doc/filtering.html`** — both hosts 404. The filter list with per-version numbers
  lives in `doc/changes.html`; cite that.

## Uncertainties left flagged in-page — do NOT resolve them from a blog

1. Whether Boot 4.1's BOM or plugins manage a JaCoCo version at all (`02` says so explicitly).
2. What `report` does when no exec file exists — `report-mojo.html` does not say.
3. A documented Gradle report-exclusion API — the manual has none; the `classDirectories`/
   `fileTree` recipe is presented in `02c` as **community practice**, not documented API.

## Environment notes

⚠️ Four sibling agents write `docs/java/pages/phase-11-testing/` in this same checkout.
**Never `git add -A`.** Always commit explicit paths and `git status --porcelain` afterwards.

See [[java-board]] for the claim state, [[cursor-java]] for the standing order,
[[research-java-p11-t09-jacoco]] for the banked sources.
