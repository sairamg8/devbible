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

### 1 · `inconsistent` — "pages say X" (first, always)

A **bold** version in a `> Verified:` line, inside one of the pin's own `tracks`,
disagreeing with `pins.js` by a **minor or more**. The detector already filters out
cross-track matches, line-level pins and patch differences (see below), so a surviving
flag is worth taking seriously.

🔴 **It is still a claim, not proof. Confirm before touching anything.**

```bash
grep -rn '^> Verified:' docs/<track> --include=*.md | grep -i '<product>' | head -20
```

Read the **whole** matched line. The classic false positive is a **different product
with the same name in it** — `Spring Data MongoDB 5.1` is not MongoDB, and
`Spring Data Redis 4.1` is not Redis.

- **False positive** → fix the *pin*, never a page: narrow `names`, or correct `tracks`
  so the pin stops seeing pages it does not govern.
- **Real** → treat it as drift of that page's class and continue down the ladder.

⚠️ **Widening `tracks` cuts both ways.** It is also how blast radius is lost: a pin that
does not name a track cannot see pages there. When you touch `tracks`, re-run and check
the `Np` page counts moved the way you expected.

**What the detector already handles, so you do not have to** (all three added
2026-09-03 after every one of six reported inconsistencies turned out to be noise):

- **Track scoping** — a pin only sees pages under its declared `tracks`.
- **Prefix-aware, class-based comparison** — a page naming the line (`7.0` against a pin
  of `7.0.9`) is not disagreeing, and a patch difference (`4.1.0` vs `4.1.1`) is
  reported but never flagged. Patch drift is not work, here as everywhere.
- **Bold-only voting** — only a bold version may contradict `pins.js`. A page *about*
  Podman 6 citing the v6.0.0 release notes is a citation, not a pin.

### 1b · `unbolded` — pages name the product, none bolds a version

Reported as `❔ no bolded version on any page`. Not a contradiction — the corpus has no
pin there to check, so the track's provenance is weaker than it looks.

**Do not mass-bold pages to clear it.** Fixing it means the owning session bolding the
version spine as it next touches each page (see `references/house-style.md`). Report the
list; leave the pages alone.

### 2 · `patch` — mechanical, no prose read

Licenses exactly one thing: bump the version string and the date.

```bash
# 1. blast radius
grep -rl '<product> <old>' docs --include=*.md | tee /tmp/bump.txt | wc -l

# 2. scoped to quote lines only — a `> Verified:` block wraps, so match `^> `.
#    Never a bare global sed.
xargs -a /tmp/bump.txt sed -i 's/^\(> .*\)<old>/\1<new>/'

# 3. GATE: every hunk must sit inside a `> ` line. No output = pass.
git diff -U0 -- docs | grep '^[+-]' | grep -v '^[+-][+-]' | grep -v '^[+-]> '
```

If step 3 prints anything, `git checkout -- docs` and redo it per file.

⚠️ **A patch that changes behaviour is not a patch.** Skim the release headline first.
A security fix, a changed default, a deprecation → reclassify to `minor` and go to §3.
Bumping the date is only honest because the patch contract says the surface did not
move; when it did, that reasoning is void.

🔴 **Preserve the bolding.** The scanner reads **bold** in a `> Verified:` line as the
page's own pin and plain text as a historical citation. A sed that strips `**PostgreSQL
18.4**` down to plain text silently changes what the tooling thinks the page claims —
and the page then stops appearing in its own blast radius. See
`references/house-style.md`.

Then in `pins.js`: set `pin` to the new version, `checked` to today. Never back-date
`checked`.

### 3 · `minor` — changelog-driven, surgical

1. Open the changelog for **every version between `pin` and `latest`**, not just the
   newest.
2. Write down the behavioural deltas only — new API, changed default, deprecation.
   Additions no page mentions are not work.
3. Grep for the pages making a claim about each delta. **Only those pages get opened.**
   A minor is not a licence to re-read the track.
4. Edit prose → version → date, in that order, one commit per file.
   🔴 **If the edit would push a file past 300 lines, read
   `references/authoring-contract.md` and chunk it. Never condense to fit.**
5. Bump `pin` and `checked` in `pins.js`.

If a delta introduces material the corpus has no page for, that is a **syllabus
change**, not a currency edit. Stop and report; never smuggle a new topic in under a
version bump.

### 4 · `major` — syllabus diff first, no page edits

🔴 **Do not open a page until the syllabus is repointed.** A major lands new topics,
retires others and re-tiers the rest; editing pages first means editing pages that
should not exist.

1. Diff the upstream migration guide against `docs/<track>/syllabus/`.
2. Report, as a written diff, what is new, what is deprecated, what changes tier.
3. **Stop and get direction.** A major is a campaign scoped by the user, one technology
   at a time — the working agreement is *build only the step that was asked, then stop
   and report*.
4. New pages written during the campaign follow `references/authoring-contract.md` in
   full — tier badge, exhausted gotchas, exhausted interview Q&A, chunked past 300
   lines.
5. `pins.js` is bumped **last**, when the pages actually match the new major. Leaving
   `pin` on the old major during the campaign is correct — that is what `policy` and
   `cycle` are for, and it keeps the checker honest meanwhile.

### 5 · `unanchored` — a track with no version anchor

Nothing is being watched. Add the anchor; **do not touch pages.**

```bash
grep -rh '^> Verified:' docs/<track> --include=*.md \
  | grep -oiE '\*\*[a-z][a-z0-9 .+_-]{1,24}[0-9]+\.[0-9]+(\.[0-9]+)?\*\*' \
  | tr -d '*' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head
```

The modal version is the corpus's de facto pin. Write it into `pins.js` with the right
`policy` and `source`, set `checked` to today, rerun. If the track names no version
anywhere, that is a **content defect** — report it; do not paper over it by pinning
`latest`.

### 6 · `event` — a dated LTS/EOL inside the 60-day horizon

```
📅 Node.js — LTS for cycle 26 on 2026-10-28 (55 days)
```

A claim that goes false on a **known day**. Hundreds of pages pin Node 24 and many call
it *"Active LTS"* — true today, false on that date.

A campaign opened **ahead** of the date, never a same-day scramble:

1. Grep the **phrase** that expires (`Active LTS`, `current LTS`, `the latest major`),
   not the version — the version often stays correct while the label does not.
2. Report the count and propose wording that cannot expire (`Node 24 (LTS)` rather than
   `the current LTS`).
3. Land it before the date. `policy: 'lts'` flips the pin's meaning that day.

### 7 · `unreachable` / `frozen`

- **`unreachable`** — a source 404'd or timed out. Check the slug by hand;
  endoflife.date has **no `java` and no `git` slug** (use `eclipse-temurin` and GitHub
  tags). Fix `source` in `pins.js`; never delete the pin.
- **`frozen`** — deliberately old. Never bump it. If the `reason` no longer holds, say
  so and ask. Changing a frozen pin is a decision, not maintenance.

---

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
  the grep in §2; do not expect a file list in the JSON.
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
early — the dated `event` class in §6.

## Entry points

| Agent | How it loads this |
|---|---|
| **Claude Code** | `.claude/skills/devbible-currency/SKILL.md` → points here |
| **Codex · Amp · Gemini · Cursor · Grok** | `AGENTS.md` § Currency → points here |
| **CI** | `.github/workflows/currency.yml` names this file in the issue it opens |

The body lives **only in this file and its `references/`**. Adapters are pointers and
must stay pointers — a duplicated procedure drifts, and then two agents fix the same
drift two different ways.
