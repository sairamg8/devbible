---
name: devbible-currency-system
description: How devbible stays current — a pin list, a script that checks it against upstream, and a weekly CI run. Open on "currency system", "is X still current", or any version bump.
metadata:
  type: project
---

# Keeping every track current

**Written 2026-08-31, simplified the same day** (the first draft was seven layers; this is
what actually has to exist). All numbers measured on disk and against the live registries.

## The idea

**Watch products, not pages.** A release is the event; `grep` maps it to the pages naming that
version. Cost scales with ~40 releases a year, not 4,422 pages.

The provenance already exists: **4,422 `> Verified:` lines, 4,409 dated, 1,405 naming an
explicit `x.y.z`** — node 24.19.0 in 311 pages, postgresql 18.4 in 291, react 19.2.8 in 260,
git 2.55.0 in 60, typescript 7.0.2 in 43, express 5.2.1 in 40. Nothing declares what those
pins *should* be, and nothing watches upstream. That is the whole gap.

## Where things stand — measured 2026-08-31

✅ **Current:** react 19.2.8 · typescript 7.0.2 · express 5.2.1 · git 2.55.0 ·
spring-boot 4.1.1 · undici 8.10.0 · npm 12.0.2
**Patch behind:** redis 8.10.0→8.10.1 · next 16.3.1→16.3.3 · postgresql 18.4→18.6
**Minor behind:** zod 4.4.3→4.5.4
🔴 **Stale:** mongodb pinned 8.0, latest **8.3.8**

The core corpus is in better shape than expected. The major-version rot is confined to the
imported frontend tracks — a conversion backlog, not a maintenance failure, handled by
`project_frontend_toolchain_currency_plan.md`.

🔴 **One dated event: Node 26 becomes LTS on 2026-10-28.** 311 pages pin Node 24.19.0 and
many call it *"Active LTS"* — a claim that goes false on a known day, eight weeks out.

## Build three things

### 1 · `src/data/pins.js` — the list

Mirror `src/data/progress.js`: hand-maintained ESM, one generated JSON, a `--check` flag.
Don't invent a second convention. Seed it from a grep of the `> Verified:` lines that exist.

```js
export const PINS = {
  node:       {source: 'eol:nodejs',     policy: 'lts',    pin: '24.19.0', tracks: ['nodejs','expressjs','typescript','javascript']},
  postgresql: {source: 'eol:postgresql', policy: 'major',  pin: '18.4',    tracks: ['postgresql']},
  react:      {source: 'npm:react',      policy: 'latest', pin: '19.2.8',  tracks: ['react','jest-rtl','storybook']},
  git:        {source: 'gh:git/git',     policy: 'latest', pin: '2.55.0',  tracks: ['git']},
  // ~35 rows
};
```

🔴 **`policy` is not optional.** `latest` (react, vite, eslint) · `lts` (node) · `major`
(postgres 18.x) · `frozen` (deliberately old, with a reason). Node proves why: 26.8.1 exists,
but 24.x is **correct** until October. Without this field the tool cries wolf on 311 pages
today and stays silent on the day it matters.

### 2 · `scripts/currency.mjs` — the check

A copy of `status.mjs` in shape. Resolves each pin, writes `static/currency.json`, exits 1 on
drift. It also emits the file list per pin, so a bump routes to exact pages. Sources — **all
three verified reachable 2026-08-31**:

| prefix | source | covers |
|---|---|---|
| `npm:` | `registry.npmjs.org/<pkg>/latest` | ~25 pins — react, typescript, express, vite, eslint, jest, playwright, storybook, tanstack, zod… |
| `eol:` | `endoflife.date/api/<product>.json` | node, postgresql, redis, nginx, mongodb, docker-engine, python, spring — **plus EOL and LTS dates**, which npm cannot give |
| `gh:` | `api.github.com/repos/<o>/<r>/tags` | git, jOOQ, Flyway, Testcontainers |

⚠️ endoflife.date has **no `java` and no `git` slug** — use `eclipse-temurin` and GitHub tags.

### 3 · `.github/workflows/currency.yml` — weekly

`deploy.yml` already proves CI works here. Run the script, commit the JSON if it changed, open
one issue when a pin is **minor or worse** or an LTS/EOL date falls inside 60 days.

🔴 **Not a Claude session and not a cron on this machine** — `$HOME` has been wiped three
times; a workflow in the repo survives.

## The one rule that keeps it usable

🔴 **A patch bump never causes a page to be re-read.** Bump the version string on the indexed
files and move on. Minor → read the changelog, touch only the pages it matches. Major → a
syllabus diff before any page is edited.

A checker that demands work on every patch gets muted within a month, and then the major that
mattered is skimmed past.

## Two traps worth knowing before you start

- 🔴 **The freshness cliff.** **4,416 of the 4,422 `> Verified:` lines say `2026-08`** — the
  corpus was written in one 19-day burst, so it ages out on a single day. Any *"stale after 6
  months"* rule turns the whole site red in February 2027 and gets switched off. Give each
  track a `reviewMonth` instead: 27 tracks over 12 months ≈ 200 pages a month.
- **Pin inconsistencies exist right now** and the index will find them: postgresql is `18.4`
  in 291 pages but `17.10` in 3; typescript `7.0.2` in 43 but `5.9.3` in 2; react `19.2.8` in
  260 but `19.2` in 4.

## ✅ The remediation half — built 2026-09-03, commit `63fb7b74`

Steps 1, 2 and 4 shipped 2026-08-31. **Step 3 had no written procedure**, so the Monday
issue landed with nothing behind it. Now it does:

**`.agents/skills/devbible-currency/SKILL.md`** — agent-neutral, in-repo, the single
body. Thin pointers only from `.claude/skills/devbible-currency/SKILL.md`, `AGENTS.md`,
`CLAUDE.md` and the CI issue body, so Claude, Codex, Grok, Amp and Gemini run the
identical procedure. 🔴 **A duplicated procedure drifts — the adapters must stay
pointers.**

Carries a **triage ladder by drift class**: `inconsistent` first (cheap, and it stops
weekly noise) → `patch` (mechanical sed scoped to `^> ` lines, with a `git diff` gate)
→ `minor` (changelog deltas only; only pages making a claim get opened) → `major`
(syllabus diff **before** any page edit, then stop for direction) → `unanchored` (add
the pin, touch no pages) → dated `event` → `unreachable`/`frozen`.

**`references/authoring-contract.md`** — required before writing any page, because a
major lands new topics: the 300-line cap as a **file-size cap and never a content
budget**, chunking mechanics (`NN-slug.md` → `NN-slug/` keeping the slug; lettered
siblings inside an already-chunked topic), the **before/after `wc -l` + `grep -c
'^\*\*★'` proof that a split is not a trim**, the depth bar, evidence rule, MDX traps.

**`references/house-style.md`** — added 2026-09-03 (`f65b7741`), every convention
**counted off `docs/` across 6,079 files**, with the reproducing command beside each:
tier badge class→label pairs and their real distribution (t-understand 5,343 ·
t-master 4,129 · t-know 1,603 · t-when 390, plus two deviations that are not models) ·
title as the page's argument and `sidebar_label` `"NN · Label"` with a middle dot ·
the `> Verified:` line in its three observed shapes · canonical headings
(`## Gotchas` 4,746 · `## Interview questions` 4,726 · `## Where this connects` ·
`## Trade-off` · `## Phase gate` · `## Chunks`) · **31,620 `**★ ` lead-ins** and the
18,066 Symptom/Cause/Fix form · topic README shape · footers (2,692 `· Next → `).

🔴 **Two findings from that census worth keeping on their own:**
- **Bold in a `> Verified:` line IS the page's pin**; plain text is a historical
  citation. A sed that strips the bold silently changes what the tooling thinks the
  page claims, and the page drops out of its own blast radius.
- **Docusaurus admonitions are NOT house style** — only **110 `:::` blocks exist in the
  entire corpus**. The corpus highlights with bold lead-ins, 🔴/⚠️ and blockquotes.
  Adding `:::note` makes a page look imported rather than authored here.

## ✅ The 924-page scanner gap — FIXED 2026-09-03 (`fadecdb0`)

🔴 **`scanPages()` read only the `> Verified:` LINE, not the blockquote.** A version
spine on a continuation line was invisible:

```
> Verified: 2026-09-01 against Martin Fowler, *BoundedContext* …
> Version spine: **JDK 25 · Spring Boot 4.1.0 · Framework 7.0.8**
```

**Measured: 1,520 pages bold a version on the first line, 924 ONLY on a continuation
line.** Found because the new bcrypt pin reported `pages: 0` — see
[[devbible-nodejs-p8-t28-bcrypt]].

**The fix, and its one guard.** Collect the contiguous blockquote (`> text` and bare
`>`), stopping at the first line that is neither — so prose and code after the block
stay excluded. 🔴 **The FIRST line outranks the rest**, because widening also pulls in
bolded numbers that are *citations* rather than pins.

**Effect: total page-attributions 1,973 → 5,217 (+3,244).** node 317→610, springBoot
87→1554, springFramework 184→929, mockito 61→151, testcontainers 19→87, flyway 0→50.
🔴 **Claimed versions stayed stable across the change — that stability is the evidence
it recovered signal rather than manufacturing it.** Any report generated before
2026-09-03 has page counts ~60% low.

🔴 **It immediately found a real split: TypeScript, inconsistent 0 → 1.** **135 pages
bold `**TypeScript 5.9.3**` as a verification target while 76 bold `**7.0.2**`** and
pins.js declares 7.0.2 — and several pages legitimately name **both** (5.9.3's compiler
option table, cross-checked against the 7.0.2 native binary). Defect or intended
dual-version provenance is the **TypeScript lane's** call; TS is locked, so it is
REPORTED, not touched.

⚠️ **Two deltas in that run were NOT from the change** — check for these before blaming
a scan edit: four `gh:` pins returned **HTTP 403** (GitHub rate limit from repeated
unauthenticated runs; clears after a pause, and it silently turned the one `major` into
`unknown`), and **angular moved 22.1.4 → 22.1.5** upstream, a genuine patch release.

Two refinements the live run forced, both now in the skill:
- 🔴 **`currency.mjs` computes the per-pin file list and then drops it from
  `currency.json`** — only the `pages` count survives. Blast radius must be re-derived
  by grep. The plan above claims the JSON carries it; it does not.
- 🔴 **A patch that changes behaviour is not a patch.** Skim the release headline
  first; a security fix or changed default reclassifies to `minor`. Bumping the
  `> Verified:` date is only honest because the patch contract says the surface did not
  move — when it did, that reasoning is void.

## Later, if it earns its place

A `pins:` segment on new pages so they can be linted (no retrofit — the grep handles the
existing 4,422), and a currency badge on the dashboard that already fetches `status.json`.

## Scope

This answers *"is the version right"*, not *"is the paragraph still true"* — that is
`project_validation_plan_multisession.md`, and conflating them is how both stop happening.
It never edits prose: automation bumps version strings, everything else goes to a session.
It does not touch `src/data/progress.js` (several sessions already collide there).

## Order

1. `pins.js`, seeded from the grep — half a session.
2. `currency.mjs` — one session.
3. **Run it and fix what it finds** — the pin inconsistencies, MongoDB 8.0→8.3. Proves the
   tool on real defects before automating it.
4. The weekly workflow.

Then the Node 26 LTS campaign (opens now, lands 2026-10-28) and the frontend-toolchain
campaign run *through* this rather than beside it.

## Reproducing the numbers

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
grep -rh '^> Verified:' docs/ | wc -l                                              # 4422
grep -rh '^> Verified:' docs/ | grep -oE '20[0-9]{2}-[0-9]{2}' | sort | uniq -c    # 4416 in 2026-08
grep -rh '^> Verified:' docs/ | grep -oiE '\*\*[A-Za-z][A-Za-z0-9 .+_-]{1,24}[0-9]+\.[0-9]+(\.[0-9]+)?\*\*' \
  | tr -d '*' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head -20              # the pin census
npm view react version
curl -s https://endoflife.date/api/nodejs.json | head -c 200
```

Related: [[devbible-frontend-toolchain-currency-plan]] · [[devbible-validation-plan-multisession]] ·
[[progress-status-config]] · [[devbible-locks]]
