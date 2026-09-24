---
name: devbible-skills-session-20260903
description: START HERE for the skills/tooling lane. What the 2026-09-03 session built (two skills, currency fixes, bcrypt topic, QC gate, hooks), what is verified, and the three named things left open. Open on "skills", "currency", "footer cleanup", or to resume tooling work.
metadata:
  type: project
---

# Session 2026-09-03 — the skills + tooling lane

**Lane: tooling, not a language.** No language lock was taken; `docs/nodejs/` was touched
only because `LOCKS.md` has no Node row and Express *is* locked. Everything is committed
and pushed. Working tree clean of this lane's paths at close.

## ▶️ START HERE — the three open items, in priority order

1. 🔴 **The footer backlog — 1,241 pages with NO navigation.** Fully scoped, not started.
   Read [[devbible-footer-cleanup-scope]]. **Three separate jobs, all locked lanes:**
   java 1,202 (5 phases) · nextjs 39 · python 70 (a different, cosmetic defect).
   🔴 **Fix duplicate `sidebar_position` FIRST or the derived prev/next chain is wrong.**
2. **Still taught and unpinned: helmet (23 pages), multer (14), passport (12).** bcrypt
   closed its share on 2026-09-03; these three are the rest of the same gap. Each needs a
   pin in `pins.js` **in the same change** as any page work.
3. **TypeScript pin/page split — REPORTED, NOT TOUCHED.** 135 pages bold
   `**TypeScript 5.9.3**`, 76 bold `**7.0.2**`, `pins.js` says 7.0.2. Some pages
   legitimately name both. **TS is a locked lane — the owner decides**, not a passer-by.

## What was built

**Two skills, in-repo and agent-neutral** (Claude, Codex, Grok, Amp, Gemini read the same
files; `.claude/skills/` + `AGENTS.md` + `CLAUDE.md` are thin pointers only):

```
.agents/references/     authoring-contract · house-style · verification   ← shared
.agents/skills/devbible-currency/  SKILL.md + references/triage-ladder.md
.agents/skills/devbible-topic/     SKILL.md + references/library-scope.md
```

🔴 **The split must not collapse.** `devbible-currency` = versions, corpus-wide, cheap
(~43 products). `devbible-topic` = content, **one named topic**, expensive. A bare
*"check for update"* means the version sweep, never a corpus-wide content re-read. Full
rationale: [[devbible-skills-system]].

**Currency fixes** — [[devbible-currency-system]]:
- Six reported inconsistencies were **all detector defects**; `inconsistent 6 → 0`.
- 🔴 **The 924-page scanner gap fixed** — it read only the `> Verified:` LINE, not the
  blockquote. **Page-attributions 1,973 → 5,217.** Claimed versions stayed stable, which
  is the evidence it recovered signal rather than manufacturing it.

**First topic under the skill** — `docs/nodejs/pages/phase-8-security/28-bcrypt/`, 3
files, 563 lines, 21 ★, pin wired, syllabus + progress + status updated.
[[devbible-nodejs-p8-t28-bcrypt]].

**QC gate + hooks:**
- `{/* FOOTER */}` and duplicate-`sidebar_position` checks added to all five close gates.
  🔴 **At topic CLOSE, not write time** — the marker is correct while a fork is mid-topic.
- `hook-cadence-guard.sh` — mtime guard, ignores files touched in the last 10 minutes.
- `hook-session-start.sh` — new step 4 names both skills.

## 🔴 Three traps this session hit — do not re-learn them

1. **A quoted phrase inside `hook-session-start.sh` broke the whole hook.** The message is
   one double-quoted bash string; embedded quotes terminated it and bash executed the
   words. `bash -n` passes it happily. **After ANY hook edit run
   `echo '{}' | bash <hook> | jq -e .`** — the trap is now in the script's header.
2. **The cadence hook fired 3× in 4 minutes at a LIVE sibling session**, once while it was
   mid-split. Committing there would have staged a half-moved page, which on disk is
   indistinguishable from a trim. **Check mtimes before believing an "uncommitted work"
   warning.**
3. **`mdxcheck.py` prints `0 hazard(s) in 0 file(s)` on a clean run** — `files` counts
   files *with* hazards, not files scanned. It is a pass, not a silent skip.

## Two things NOT to assume

- **An orphaned console block is not proof of fabrication.** `01-password-storage.md` had
  three with no provenance — one of the 636 — and the scripts that produced them exist in
  `sandbox/p8-security/`. Deleting would have destroyed real measured data. **Investigate
  before deleting.**
- **GitHub `gh:` pins return HTTP 403 under repeated unauthenticated runs**, which
  silently turns a real `major` into `unknown`. Pause and re-run before believing it.

Related: [[devbible-skills-system]] · [[devbible-currency-system]] ·
[[devbible-footer-cleanup-scope]] · [[devbible-nodejs-p8-t28-bcrypt]] · [[devbible-locks]]
