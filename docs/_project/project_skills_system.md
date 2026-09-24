---
name: devbible-skills-system
description: The two in-repo, agent-neutral skills — devbible-currency (versions, corpus-wide) and devbible-topic (content, one named topic) — their shared references, and the rules they encode. Open on "the skill", "write a topic", "check for update", "how do we verify without a sandbox".
metadata:
  type: project
---

# The two skills

**Built 2026-09-03** (commits `63fb7b74` → `17ad988c`). Both live **in the repo**, are
**agent-neutral**, and are reached by thin pointers from `.claude/skills/`, `AGENTS.md`,
`CLAUDE.md` and the CI issue body — so Claude, Codex, Grok, Amp and Gemini run the same
file. 🔴 **A duplicated procedure drifts; the adapters must stay pointers.**

```
.agents/
├── references/            ← shared by BOTH skills
│   ├── authoring-contract.md   depth bar · 300-line cap · chunking · split-not-trim proof
│   ├── house-style.md          tier badges · > Verified: · headings · ★ · footers (MEASURED)
│   └── verification.md         how to be accurate WITHOUT a sandbox
└── skills/
    ├── devbible-currency/  SKILL.md + references/triage-ladder.md
    └── devbible-topic/     SKILL.md + references/library-scope.md
```

## 🔴 The split that must not collapse

- **`devbible-currency`** — *"is the version right"*, **corpus-wide, automatic.** Cheap:
  it watches ~40 products, not 6,079 files.
- **`devbible-topic`** — *"is the explanation right, and deep enough"*, **one NAMED
  topic only.**

**A bare "check for update" means the version sweep, never a corpus-wide content
re-read.** (User decision, 2026-09-03.) Wiring content validation into the weekly run
means muting the weekly run, and then the Node 26 LTS date sails past.

## Libraries — the necessity test

User decision 2026-09-03: **necessity test, auto-pin, no round-trip.**

> A library earns a page when **the reference implementation cannot be built without
> it** (jwt, bcrypt, multer). It stays parked when it is an architectural **layer** you
> would choose *instead of* something in scope (GraphQL, tRPC, Kubernetes).

🔴 **It must arrive with a pin in `pins.js` in the same change.** Measured 2026-09-03:
**bcrypt 32 pages · helmet 23 · multer 14 · passport 12 — 81 page-mentions, zero pins.**
Taught and unwatched is worse than untaught.

## Verification without a sandbox — the answer to the real problem

The sandbox was dropped because a page needing a script cost **60–90 min against
20–35** (a script ~triples a page). But that left **636 pages with output blocks and no
provenance**. 🔴 *"Stop measuring" was never "make it up."*

1. 🔴 **Research ONCE per topic, bank it, write every chunk from the bank.** The single
   biggest saving — a 20-chunk topic otherwise pays the research cost 20 times. Already
   proven by [[research-java-p11-t09-jacoco]].
2. **Evidence ladder** — T0 verbatim doc quote · **T1 inline probe of an ALREADY-INSTALLED
   package** (`node -p "Object.keys(require('react'))"`, ~1s, real citable evidence — how
   the React syllabus export lists were built) · T2 one doc fetch · **T3 running code /
   containers / timings = banned**.
3. 🔴 **The installed-version trap, measured in this checkout 2026-09-03:** `react`
   **19.2.8** and `zod` **4.4.3** match their pins and are safe to probe — but **`express`
   is installed at 4.22.2 while the corpus teaches 5.2.1**, and **`typescript` is not
   installed at all**. A probe against the wrong major yields a confident, specific,
   WRONG fact. Print the installed version and compare it to the pin *before* probing.
4. **Nothing settles it?** One fetch, then write it as **explicitly uncertain** or leave
   it out. *"The documentation does not state whether X"* is legitimate. A confident
   invention is the only unacceptable outcome.
5. **Never add a ` ```console ` block** — program output, and nothing here produces it.
6. **User-supplied files** are T0/T2 evidence at zero fetch cost; cite by name, and where
   they contradict the page **the supplied source wins** — say so, never quietly reconcile.

Re-validation reuses the existing S1–S5 ladder and the `> Validated:` stamp from
[[devbible-validation-plan-multisession]] verbatim, so the two cannot disagree.
⚠️ That plan was sized at ~2,700 `.md` files; the corpus is **6,079** now — a full pass
is ~2.2× bigger than planned.

## Both skills also encode

**Lane safety** — open `LOCKS.md` before touching `docs/<track>/`; **a locked lane is
reported, not fixed.** Tooling (`pins.js`, `currency.mjs`, `currency.json`) is not
lane-owned; `progress.js` is. Never `git add -A`. Commit **per file**.

Related: [[devbible-currency-system]] · [[devbible-validation-plan-multisession]] ·
[[devbible-locks]] · [[devbible-author-brief]] · [[feedback-no-new-sandbox-scripts]] ·
[[feedback-never-compress-to-fit-cap]]
