---
name: devbible-nodejs-p8-t28-bcrypt
description: Node.js phase 8 topic 28 (bcrypt) — the first topic written under the devbible-topic skill, and what the run proved about the skill and the tooling. Open on "bcrypt", "phase 8 security", or "did the topic skill work".
metadata:
  type: project
---

# nodejs p8 t28 · bcrypt — CLOSED 2026-09-03 (`f08a412c`)

The first topic written under [[devbible-skills-system]]. Written to prove the skill,
including its library path; it found four real things on the way.

**The topic:** `docs/nodejs/pages/phase-8-security/28-bcrypt/` — 3 files, **563 lines,
21 ★, 16 gotchas**, 0 over cap, 0 MDX hazards, 0 broken links.
Tier **Understand**, reasoned on the page: *you inherit bcrypt, you do not choose it* —
argon2id/scrypt stay the recommendation on topic 01.

## What the run proved

🔴 **The S1 on topic 01 was a CITATION defect, not an invention.**
`01-password-storage.md` carried three console blocks with no provenance — one of the
636. The validation tree says investigate before deleting, and that was right:
`sandbox/p8-security/ex1-crypto.mjs` (hash-rate + scrypt-cost tables) and
`ex4-throughput.mjs` (thread-pool table) produce **those exact format strings**. The
numbers are real; only the citation was missing, which every sibling page has.
**Deleting them would have destroyed measured data.** Fixed by extending the
`> Verified:` line. ⚠️ Some of the 636 are like this — assume citation-missing before
assuming fabrication.

🔴 **The scanner only reads the `> Verified:` line itself, not the blockquote.**
Caught because the new bcrypt pin reported **`pages: 0`** — the version spine was on a
continuation line. Fixed on the three pages by moving `**bcrypt 6.0.0**` onto the first
line. **Measured corpus-wide: 1,520 pages carry a bold version on the `> Verified:`
line, and 924 carry it ONLY on a continuation line — invisible to the scanner.** So
blast radius is under-counted by ~38%. **NOT fixed** (a one-line change in
`scanPages()` to read the contiguous blockquote); reported to the user, decision
pending.

**Express is locked, Node.js is not.** `LOCKS.md` has no Node row, which is why this
went to `docs/nodejs/` — the lane check is real and it bit.

**A 27/27 "complete" phase gained a 28th topic.** bcrypt was already in the syllabus
*inside* the Master "Password storage" row (line 89 of `syllabus/03-application.md`),
so the new topic is a depth expansion of an existing row delivered as its own
directory — position 01 could not absorb it (**10 inbound links**, and 252 + ~150 lines
blows the cap). A syllabus row was added, so phase 8 is now **28 topics**.

## Evidence regime — the point of the exercise

**bcrypt is NOT installed here**, so T1 probing was unavailable and everything is T2
doc-verified against the `node.bcrypt.js` README and npm registry metadata, load-bearing
sentences quoted verbatim. **Zero ` ```console ` blocks and no millisecond figures
anywhere** — the cost-factor section explains the method and states outright why it
gives no numbers. Two things the README does not settle (`$2b$`'s exact defect history;
which prefix this version emits) are **marked unsettled rather than asserted**.

## The pin

`bcrypt 6.0.0` (`npm:bcrypt`, `latest`, tracks `nodejs`/`expressjs`/`real-world`),
added in the same change per the auto-pin rule. Verified wired: **3 pages, claimed
6.0.0, drift none**. ⚠️ `note` records that versions **< 5.0.0** mishandle NUL bytes and
truncate at 255 chars — an upgrade boundary with locked-out users, not a version bump.
**Still unpinned: helmet (23 pages), multer (14), passport (12).**

Related: [[devbible-skills-system]] · [[devbible-currency-system]] ·
[[devbible-validation-plan-multisession]] · [[devbible-locks]]
