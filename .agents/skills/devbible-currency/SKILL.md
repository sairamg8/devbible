---
name: devbible-currency
description: Keep devbible current with upstream release cycles. Run when the weekly currency workflow opens an issue, when a product ships a release, or on "is X still current" / "update the bible for <version>". Triages drift by class, bumps only what the class licenses, and never re-reads a page for a patch.
---

# devbible-currency

**Any agent — Claude, Codex, Grok, Amp, Gemini, Cursor — runs this identically.** It
is the only entry point for *"a version moved upstream, what changes here"*.

The **detection** half is already built and needs no help: `src/data/pins.js` declares
what each track targets, `scripts/currency.mjs` resolves those against npm /
endoflife.date / GitHub tags, and `.github/workflows/currency.yml` runs it every
Monday 06:00 UTC and opens one issue. **This skill is the other half — what to do
about what it reports.**

## 🔴 The one rule

**A patch bump never causes a page to be re-read.**

Bump the version string on the affected files and move on. Minor → read the changelog,
touch only the pages it matches. Major → a syllabus diff before any page is edited.

A checker that demands work on every patch is muted within a month, and then the major
that mattered is skimmed past. Every rule below protects that.

## Read before editing

| File | Why |
|---|---|
| `instructions.md` | The standing brief — tiers, granularity, the cap, `> Verified:` format (§4–§6, §9–§10) |
| **`references/authoring-contract.md`** | 🔴 **Required before writing or extending any page.** The 300-line cap, chunking mechanics, depth bar, evidence rule, MDX traps |
| **`references/house-style.md`** | 🔴 **Required before touching any page.** Tier badges and their exact labels, title/`sidebar_label` form, the `> Verified:` line, the canonical section headings, `★` entry markers, how the corpus highlights, footers. Every convention counted off the corpus, not guessed |
| `src/data/pins.js` | Header comment defines `policy`, `pin`, `tracks`, `names`, `patchIndex` |

Never invent version facts. Every number written to a page comes from a command run in
this session or documentation opened in this session. **There is no sandbox** — a new
script roughly triples the cost of a page and is a standing user instruction against.

---

## Step 0 — orient

```bash
node scripts/currency.mjs --check
```

Writes `static/currency.json`, prints one line per unclean pin, exits 1 when something
needs a human. **Exit 1 is the normal healthy outcome** — it means there is something
to report, not that the tool broke.

Read the trailing summary first; it classifies everything:

```
17 current · 6 patch · 5 minor · 1 major · 12 unanchored · 0 inconsistent · 5 unbolded
```

Work the ladder **in order**. Inconsistencies before drift: they are defects that exist
today, they are cheap, and fixing them stops the scanner reporting noise every week.

---

## The triage ladder

🔴 **Read [`references/triage-ladder.md`](references/triage-ladder.md) and work the
classes in order.** It carries all seven, each with the exact commands and the limits of
what that class licenses you to change:

| Class | What it licenses |
|---|---|
| **1 · `inconsistent`** | Fix the *pin*, never a page. Read the whole matched line first — the classic false positive is a different product with the same name in it |
| **1b · `unbolded`** | Report only. Never mass-bold pages to clear it |
| **2 · `patch`** | Mechanical: bump the version string and the date. No prose read |
| **3 · `minor`** | Changelog deltas only; open just the pages making a claim about one |
| **4 · `major`** | Syllabus diff **before** any page edit, then stop for direction |
| **5 · `unanchored`** | Add the anchor to `pins.js`. Touch no pages |
| **6 · `event`** | A dated LTS/EOL. Grep the *phrase* that expires, not the version |
| **7 · `unreachable` / `frozen`** | Fix the `source` slug; never bump a frozen pin |


## The edit contract

Six rules, non-negotiable — they are what separates this from find-and-replace.

1. **Version and date move together.** A bumped version under a stale date reads as
   verified and is not. A stale version under a fresh date is a lie. Both or neither.
2. **300 lines is a file-size cap, never a content budget.** A currency edit must not
   push a file past 300 lines. If a minor genuinely needs more room, **chunk on a
   concept boundary** — never condense, never drop a gotcha or a question to fit.
   Record `wc -l` and `grep -c '^\*\*★'` before; after a split, **both totals must go
   UP**. See `references/authoring-contract.md`.
3. **Evidence, not memory.** `> Verified:` names what you actually checked and how. No
   fabricated console output, ever. No new sandbox scripts — and 🔴 **a new or edited
   page must not gain a ` ```console ` block**, because that is program output and
   there is no sandbox to produce it.
4. **Match the house style exactly** — tier badge, `sidebar_label` with its `·`
   separator, the canonical `## Gotchas` / `## Interview questions` headings, `**★ `
   entry markers, footer form. `references/house-style.md` carries all of it, measured.
   ⚠️ Do not introduce `:::note` admonitions; 110 exist across 6,079 files and they are
   not house style.
5. **Additive.** Never delete a page, section or review to make a version fit.
   Deprecated material gets `⚠ Deprecated` and a pointer to its successor.
6. **Reviews are historical records.** `docs/*/reviews/` is never updated to match a
   new version.

## Commit cadence

**Per file, not per track.** One file finished → commit it.

```bash
git add docs/<exact>/<paths>.md src/data/pins.js
git commit -m "currency: <product> <old> → <new> (<n> pages)"
```

🔴 **Never `git add -A`.** Several sessions write to this checkout at once; a blanket
add commits another session's half-finished work. Always name paths.

Finish by regenerating and committing the report:

```bash
node scripts/currency.mjs --check
git add static/currency.json src/data/pins.js
git commit -m "currency: refresh after <product> bump"
```

Build **once** at the end of a campaign (`yarn build`) and fix everything in that pass
— never a full build per page.

## 🔴 Check the lanes before editing any page

Drift does not respect lane boundaries, and this checkout is shared. Before touching
`docs/<track>/`, open **`/mnt/Storage/my-learning/claude/devbible/LOCKS.md`** and check
whether another session holds that language.

**A locked lane is reported, not fixed** — the tool reports, the owning session fixes.
Editing another lane's pages mid-write is how two sessions collide in one file.

Tooling is not lane-owned: `src/data/pins.js`, `scripts/currency.mjs` and
`static/currency.json` are safe to fix from a currency session. `src/data/progress.js`
is **not** — several sessions collide there.

## Scope — what this never does

- It answers **"is the version right"**, never *"is the paragraph still true"*.
  Conflating them is how both stop happening; prose validation is a separate pass.
- It never edits `src/data/progress.js` — several sessions collide there.
- It never spawns subagents unless explicitly asked.
- It never touches anything outside the tracks named in the drift report.

## Known gaps in the tooling

- **`currency.mjs` computes the per-pin file list and then drops it** from
  `currency.json` — only the `pages` count survives. Re-derive the blast radius with
  the grep in the `patch` class of `references/triage-ladder.md`; do not expect a
  file list in the JSON.
- **The freshness cliff.** Almost every `> Verified:` line says `2026-08` — the corpus
  was written in one burst, so any *"stale after N months"* rule turns the whole site
  red on a single day and gets switched off. The intended fix is a per-track
  `reviewMonth` spreading ~27 tracks across 12 months. **Not built** — propose it,
  don't improvise a global staleness rule.

## Release cadence

Never assert a release date from memory. `endoflife.date` is the source, and every
`eol:` pin already carries its dates into `currency.json`:

```bash
curl -s https://endoflife.date/api/<product>.json | head -c 400
```

Shape of the year, for planning only: **Node.js** and the **JDK** ship majors twice a
year on a fixed calendar with LTS designations; **PostgreSQL** and **Python** ship one
major a year plus quarterly minors; **Angular** runs a six-month major cadence;
**React**, **TypeScript** and the frontend toolchain ship on no fixed calendar and are
caught by the weekly run rather than anticipated.

The weekly workflow catches all of it. The calendar only says which campaigns to open
early — the dated `event` class in `references/triage-ladder.md`.

## Entry points

| Agent | How it loads this |
|---|---|
| **Claude Code** | `.claude/skills/devbible-currency/SKILL.md` → points here |
| **Codex · Amp · Gemini · Cursor · Grok** | `AGENTS.md` § Currency → points here |
| **CI** | `.github/workflows/currency.yml` names this file in the issue it opens |

Its three references, all required reading at the points named above:
`references/triage-ladder.md` (what each drift class licenses) ·
`references/authoring-contract.md` (the 300-line cap and chunking) ·
`references/house-style.md` (how a page must look).

The body lives **only in this file and its `references/`**. Adapters are pointers and
must stay pointers — a duplicated procedure drifts, and then two agents fix the same
drift two different ways.
