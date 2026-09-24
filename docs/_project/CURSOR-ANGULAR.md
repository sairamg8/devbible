---
name: cursor-angular
description: THE Angular devbible cursor. A session told "continue with angular" reads THIS FILE ONLY and starts writing. Phase 0: topics 01-07 CLOSED (387 pages). Topic 08 SCAFFOLDED; chunk 03 (split 03–03e) committed 2026-09-10, 01/02/04 unwritten. Bank still incomplete. Four research banks exist covering every remaining phase-0 topic. Read the top block only.
metadata:
  type: project
---

# 🔴 Angular — START HERE. Read this file and nothing else.

## 🔴 COLD START — 2026-09-09, session `8ea70bfc`. Everything below is TRUE NOW.

**Everything is committed and pushed.** Gates: `yarn linkcheck docs/angular` **355/0**, mdxcheck
clean, nothing over the 300-line cap, `grep -rln '{/\* FOOTER \*/}' docs/angular` returns **0**.

### 🔴 THE ONE NEXT ACTION — read the SALVAGE note first, then bank

**Topics 01-07 are CLOSED and pushed (387 pages). Topic 08 is scaffolded — README and
`_category_.json` are committed at `f55ec22b3` — and NO chunk is committed.**

🔴 **A session rate limit killed all three topic-08 agents at once on 2026-09-09.** Two were writing
pages, one was finishing the bank. What survived:

**SALVAGE — ✅ DONE 2026-09-10 (`f280f4ab4`, pushed).** The orphaned 491-line
`03-the-src-directory.md` was split on the boundaries named here into **`03` `03b` `03c` `03d`
`03e`** (positions 3, 3.1–3.4), gotchas and questions moved to the page they are about. Split proof:
1 file / 491 lines / 9 ★ → 5 / 598 / 9 (★ moved, none cut; every non-blank line survives except the
`{/* FOOTER */}` marker and one link to the unwritten `04`, now de-linked). Topic README rows 03–03e
link them. Chunks `01`, `02`, `04` are still unwritten.

**NOT DONE — the bank was never extended.** `grep -c '^## Chunk 08.05'` on
`research_angular_p0_t07_t08_typescript_and_ng_new.md` returns **0**. Its `## 99 · UNSETTLED` and
`## 100` are still missing, so that bank still has the property that **an absent caveat means
nothing was recorded, not that a claim is settled.**

**Order of work:** ~~salvage-split-commit `03`~~ ✅ `f280f4ab4` →
finish banking topic 08 (chunks past `08.04`, plus `## 99` covering `08.01`-`08.04` retroactively) →
then write chunks `01`, `02`, `04` from the banked half and the rest once banked.

⚠️ The topic README's chunk table deliberately lists only FOUR rows and says why. Extend it when the
bank is extended, not before.

### 🔴 THE PARALLEL-AUTHORING PLAYBOOK — this is what made topics 05 and 06 work

Three `devbible-author` agents at once, one bank range each, is the right shape. Six agents in this
session produced 129 pages. Put ALL of this in every dispatch:

1. The bank path **and exact line ranges**, plus "DO NOT re-research, DO NOT fetch".
2. The `> Verified:` shape and the version spine line, verbatim.
3. `{/* FOOTER */}` as the last line, nothing after it. The coordinator wires footers at close.
4. 🔴 **Links: only files you have `ls`-confirmed.** One dangling link fails `build`, skips `deploy`
   and blocks every other track. Everything else is bold + `*(not written yet)*`.
5. 🔴 **Voice: never "I could not confirm".** The register is impersonal — "the documentation does
   not state", "no source was found". All three authors got this wrong on topic 05 and it had to be
   fixed corpus-wide; putting it in the topic-06 dispatch fixed it outright.
6. "Another agent is writing X right now — touch only your files, never README.md."
7. The cap is a FILE-SIZE rule, never a content budget: write it all, then split, and **report the
   BEFORE and AFTER line and star totals proving both went up**.
8. Their assigned UNSETTLED item, quoted, with the exact sentence to write.

### 🔴 AT EVERY TOPIC CLOSE — three steps, in this order

1. **Re-link forward references.** Parallel authors cannot link each other's work as it lands, so
   every topic accumulates them: **57 on topic 05, 24 on topic 06**. One pass, regex over
   `\*\*(...)\*\* \*\(not written yet\)\*`, mapping label to file.
2. **Wire footers**, then **regenerate the README chunk table from disk** — never maintain it by
   hand against the planned chunk count, which stops describing reality after the first split.
3. **Re-check the cap.** Wiring a footer adds three lines and has twice pushed a 300-line file over.
   Split it; both totals must go up.

### What topics 04-07 shipped this session — 160 pages, ~35,000 lines, all committed

🔴 **Findings not worth re-deriving:** build cache OFF in CI by default, workers capped at
`min(4, max(cores-1, 1))` · `NG_BUILD_*` takes only `1`/`true`/`0`/`false`, so `=yes` silently does
nothing · **`optimization.scripts` gates four things** — minification, the Rolldown pass, the
CommonJS check and the production/development import conditions · `"sourceMap": {}` turns source maps
ON · `hidden` is not a security control, `sourcesContent: false` is · only `outputPath.browser` is
safe to serve · the `configurations` merge is **shallow** · `defaultProject` is gone · **the TS pin
is enforced twice**, and `--force` silences only the install-time half · **`strict-templates-default`
writes into `tsconfig.app.json`/`tsconfig.spec.json`, NEVER the workspace root**, which it skips by
name.

🔴 **Written as unresolved on purpose — do not fill these in by guessing:** `anyComponentStyle`
defaults · `cnpm` as a `packageManager` value · whether the CLI validates `angular.json` against its
schema on every command · HMR scope · the Rollup fallback's install requirements · `deployUrl` · no
removal version for the webpack builders · what `enableI18nLegacyMessageIdFormat` does.

🔴 **ONE UNRESOLVED CONTRADICTION INSIDE THE CORPUS — someone should settle it.** Topic 01's
`14i-attributes-literals-and-safe-navigation.md` says `strictLiteralTypes: false` has no effect while
`strictTemplates` is on, reading the unconditional `strictLiteralTypes: true` in the strict branch.
Topic 07's `07d` quotes an `if (this.options.strictLiteralTypes !== undefined)` clause in the
override block that runs *after* that branch, which would honour it. **Both cite `compiler.ts` at
`v22.1.5`.** Neither page asserts behaviour. Read that one clause and close it.

### 🔴 FOUR RESEARCH BANKS EXIST — every remaining phase-0 topic is banked. Do not re-research.

| bank | covers | state |
|---|---|---|
| `research_angular_p0_t04_ng_update.md` (5418) | 04 + 09, with thin sections for 05–12 | ✅ complete, 20 UNSETTLED items |
| `research_angular_p0_t05_t06_build_and_angular_json.md` (4482) | 05 the build, 06 `angular.json` | ✅ complete, 27 chunk sections, 14 UNSETTLED |
| `research_angular_p0_t10_t11_t12_linker_jit_devmode.md` (3725) | 10 linker, 11 JIT/AOT, 12 dev-mode | ✅ complete, §99 + §100 + §101 |
| `research_angular_p0_t07_t08_typescript_and_ng_new.md` (3576) | 07 TypeScript setup, 08 `ng new` | ⚠️ **PARTIAL** |

🔴 **The partial one is a trap and its own header now says so.** Topic **07 is complete** and may be
written from. Topic **08 is cut off at chunk `08.04`**, and **`## 99 · UNSETTLED` was never
written** — so in that one bank, an absent caveat means *nothing was recorded*, NOT *settled*.
Finish banking topic 08 before writing its later chunks.

Where a later bank is deeper than bank D's thin section for the same topic, **the dedicated bank
wins** (05/06 → bank E, 10/11/12 → bank G, 07 → bank F).

### Order of work after topic 04 closes

05 and 06 off bank E · 07 off bank F · 10, 11, 12 off bank G · 09 off bank D · **08 needs banking
finished first.** ⚠️ Bank D warns topics 07 and 10 **collide with topic 01**, which already owns
partial compilation and the linker at Master tier (`12f`), version skew (`12g`), the TS pin (`13b`)
and `strictTemplates` (`14f`/`14g`). Bank D suggests deleting syllabus row 10 in favour of `12f` —
**a syllabus owner's decision, deliberately not taken.** Do not re-explain topic 01 in topics 07/10.

### One correction still owed, deliberately not made

The phase-0 README's row **05** says the webpack builders are *"legacy"*. Bank E establishes that
**v22.0.0 formally deprecates them in three packages**. 🔴 Fix that row **when topic 05 lands**, not
before — editing a row for an unwritten topic is how rows drift from pages.

### What this session actually shipped, so the next one does not redo it

Topic 03 closed (17/17 chunks, 90 pages, 6 agents in 2 waves) · topic 01's open catalogue closed
(`10g`/`10h`/`10i`, 17 files, chunk 10 went 6 → 23 pages) · topic 04 opened and taken to 3 of 7 ·
four banks written. 🔴 **And five wrong claims in this corpus were corrected**, all found by agents
reading source rather than by review: the release cadence (wrong in **four files** — it is
**12 months / ~24 months supported** since v22, not six months), the build stack (**Rolldown**
re-bundles between esbuild and Vite since 22.1.0), `platform-browser-dynamic` being npm-deprecated,
`09e`'s `selector: ''` claim (S1 — it silently becomes `ng-component` on a component, no error at
all), and our own coverage note's false assertion about spread at expression position.

---


---

> 🗄️ **346 lines of superseded history moved to [CURSOR-ANGULAR-HISTORY.md](CURSOR-ANGULAR-HISTORY.md) on 2026-09-09**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-ANGULAR-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
