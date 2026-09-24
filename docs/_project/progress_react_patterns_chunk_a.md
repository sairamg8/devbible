---
name: progress-react-patterns-chunk-a
description: React patterns — chunk A · build progress
metadata:
  type: progress
---

# React patterns — chunk A · build progress

**Session `02b2af2d`, started 2026-08-17.** The resume point for *"continue React
patterns"*. Split rules and the chunk B brief:
[project_react_patterns_and_search_split.md](project_react_patterns_and_search_split.md).

## What this chunk is

The user asked for *"react patterns for better development"*. Scoping decision they
made: **consolidate what already exists — not a new phase, not reopening dropped
phases 12/13.** The patterns were already written and scattered; the problem is that
they are filed by *when you learn them*, not by *when you need them*.

**Scope: `docs/react/` only.** Chunk B (local site search) owns
`docusaurus.config.js` + `package.json` + `yarn.lock` and is a different session.

## 🔴 RESTRUCTURED TO THE CANONICAL TEN — 2026-08-17

**The user supplied the list of ten React patterns and asked to consolidate it with mine.**
The section was called "React patterns" and did not contain them: three of my six topics
(polymorphic, prop getters, provider composition) were not on the list, and **compound
components — one of the ten — existed only as a 66-line SECTION inside
`phase-2/08-children-patterns.md`**.

### The consolidated list, and where each lives

| # | Pattern | Home | Lines | State |
|---|---|---|---|---|
| 1 | Composition | `phase-2/03-composition/` | 615 | ✅ already deep |
| 2 | Custom hooks | `phase-7` (whole phase) | 7,094 | ✅ already deep |
| 3 | **Compound components** | **`patterns/03-compound-components/`** | 1,050 | ✅ **NEW, 4 chunks** |
| 4 | Context + Provider | `phase-5/04,05,12` | 1,146 | ✅ already deep |
| 5 | Controlled | `phase-2/04-…/` | 581 | ✅ already deep |
| 6 | **Headless** | **`patterns/06-headless-components/`** | 1,531 | ✅ Master, 6 chunks |
| 7 | **Render props** | `phase-2/12-render-props.md` | 237 | 🔴 **THIN — deepen IN PLACE** |
| 8 | **State reducer** | **`patterns/08-state-reducer/`** | 887 | ✅ Understand, 3 chunks |
| 9 | **Container / presentational** | `patterns/09-container-presentational.md` | 234 | 🔴 **rewrite queued** |
| 10 | **HOC** | `phase-2/13-higher-order-components.md` | 248 | 🔴 **THIN — deepen IN PLACE** |

**Supporting techniques** — `patterns/supporting/` (position 90), demoted from peers to
machinery: `polymorphic-components.md` (271) · `prop-getters.md` (282) ·
`provider-composition.md` (230).

🔴 **Directory numbers now match the list's numbering.** Six of the ten stay in the phase
that introduces them — **deepen those IN PLACE, do not create a competing page in
`patterns/`**. The hub `README.md` (124 lines) is the index of all ten plus the supporting
three.

### ✅ THE TEN ARE DONE — 2026-08-17

| # | Pattern | Home | Files | Lines | Tier |
|---|---|---|---|---|---|
| 1 | Composition | `phase-2/03-composition/` | 3 | 615 | Master (pre-existing) |
| 2 | Custom hooks | `phase-7` | 25 | 7,094 | Master (pre-existing) |
| 3 | **Compound components** | `patterns/03-compound-components/` | 5 | 1,050 | Master — **NEW** |
| 4 | Context + Provider | `phase-5/04,05,12` | — | 1,146 | Master (pre-existing) |
| 5 | Controlled | `phase-2/04-…/` | 3 | 581 | Master (pre-existing) |
| 6 | **Headless** | `patterns/06-headless-components/` | 7 | 1,531 | Master — **NEW** |
| 7 | **Render props** | `phase-2/12-render-props/` | 4 | 732 | Know — **rebuilt in place** |
| 8 | **State reducer** | `patterns/08-state-reducer/` | 4 | 887 | Understand — **NEW** |
| 9 | **Container/presentational** | `patterns/09-container-presentational/` | 3 | 507 | Know — **rebuilt** |
| 10 | **HOCs** | `phase-2/13-higher-order-components/` | 4 | 714 | Know — **rebuilt in place** |

**Supporting techniques** — `patterns/supporting/`: polymorphic (271) · prop getters (282) ·
provider composition (230). ⚠️ **These three have NOT had the exhaustive pass** — they are
the only remaining work in this chunk if the user wants it.

🔴 **Deepen IN PLACE, never duplicate.** 07 and 10 stayed in phase 2 because that is where
they already lived; only a link from the patterns hub points at them. One topic, one home.

🔴 **Two chunks is a legitimate answer.** Container/presentational got **2**, not 3 — it is a
historical pattern with a narrow live remainder, and padding it would have broken rule 13 in
the other direction. Chunk counts follow content volume; tier follows what the reader does.

### ✅ UI WIRING — audited and fixed 2026-08-17 (the user asked)

The restructure changed the section's shape and left three things stale. All fixed:

| # | Gap | Fix |
|---|---|---|
| 1 | `src/data/progress.js` patterns row still said **`topics: 6, pages: 6`** from the original six-topic shape | → **`topics: 7, pages: 7`** (4 of the ten live here + 3 supporting). Parse-checked with `node --input-type=module` |
| 2 | `patterns/supporting/` had a `_category_.json` and **no `README.md`**, so the sidebar category had no index page | Added — one-line summary per technique and why they are subordinate to the ten |
| 3 | `docs/react/README.md` had **no Patterns row** in the Parts table, and still said *"**Nothing is written yet**; this syllabus is the proposal"* with **277 pages on disk** | Both corrected; Part 5 added |

✅ **Verified wired:** every new dir has both `_category_.json` **and** `README.md`;
`sidebars.js:22` is `{type:'autogenerated', dirName:'react'}` so **no sidebar edit is ever
needed** — a `_category_.json` plus `sidebar_position` is the whole wiring contract.
`docs/react/pages/README.md`, `docs/README.md` claims row and technology row all current at
**277 leaf pages**.

⚠️ **The lesson worth keeping:** the UI row went stale because the *section changed shape*
after the row was written, not because it was forgotten. **Re-check `progress.js` whenever
topics move between directories**, not only when the count goes up.

### 🔴 VERIFICATION — upgraded, and rule 12 was never the blocker it looked like

🔴 **An MDX compile is PER-FILE, not a bundle.** It holds no large heap and cannot collide
with another session's `yarn build`, so **it needs no build-registry claim** — rule 12 is
about the dev server and `yarn build`, not this. That was missed for most of this session,
during which everything was reported as "link-checked, build NOT run" when a much stronger
check was available the whole time.

✅ **All 338 pages under `docs/react` COMPILE CLEAN** (run here, 2026-08-17). Peer session
also compiled the whole corpus: **2,925 pages, clean.**

**The two things that make a compile sweep trustworthy** — both learned the hard way by the
peer, both cost wrong answers:
1. 🔴 **Strip YAML frontmatter first.** Otherwise `---` parses as a setext heading and any
   JSX-looking tag in a `title:` reads as an unclosed element. Produced 4 false positives,
   all React pages, all fine: `<script>`, `<Suspense>`, `<Activity>`, `<ViewTransition>`.
2. 🔴 **`await compile()`.** Rejections are async and escape a bare `try/catch`, so the sweep
   prints "all clean" and then dies on an unhandled rejection.

⚠️ Sweeping a **shared checkout mid-write** gives transient `ENOENT`/parse errors — re-run
before believing a hit in another session's tree.

⚠️ Run the script **from the project root** — a copy in `/tmp` cannot resolve
`@mdx-js/mdx` from `node_modules`.

### 🔴 THE MDX BUILD-BREAKER — new class of defect, my checks could not see it

**The GitHub Pages deploy failed** on 12 MDX errors, 2 of them mine. Cause: **an inline code
span left OPEN at end of line whose continuation line begins with `{`** — MDX reads the brace
as a JSX expression before the span closes. CommonMark allows it; MDX builds the site.

⚠️ **Invisible to a filesystem link check and to `wc -l`**, which is all this session had
(rule 12 — the build registry row was held by chunk B all day, so no build was ever run).
I shipped "0 broken links, build NOT run" repeatedly and that was true and still missed a
deploy-breaker.

**Detector** (~20 lines, in the session scratchpad as `mdxcheck.py`): a line with an **odd
backtick count** outside a ``` fence, whose **next line's first non-space char is `{`**. It
caught one I introduced in the HOC chunk before commit, so it earns its place as a
**pre-commit** check. Run it on every file before staging.

Corrections from the peer session, both of which would have cost me time:
- 🔴 **Strip YAML frontmatter before running a real MDX compile**, or `---` parses as a setext
  heading and any JSX-looking tag in a `title:` becomes an unclosed element. Produced 4 false
  positives, all mine, all fine (`<script>`, `<Suspense>`, `<Activity>`, `<ViewTransition>`).
- 🔴 **`compile()` returns a Promise** — without `await` inside the `try`, rejections escape
  the catch and the sweep reports "all clean" then dies.
- Sweeping a shared checkout mid-write gives transient ENOENT/parse errors. Re-run before
  believing a hit in someone else's tree.

**Full-corpus MDX compile: 2,919 pages, all clean** (run by the peer). My last two topics
landed after that run.

### Compound components — what it settles (do not re-derive)

- **`cloneElement`/`Children.map` only reach DIRECT children and fail SILENTLY** — a wrapper,
  fragment, `.map()` or conditional breaks it with no warning. That is the whole argument
  for context, and react.dev itself calls `cloneElement` fragile.
- **Context defaults to `null` + a guard hook that throws with the part's name.** A
  plausible default object makes a misused part half-work and moves the symptom.
- **`useMemo` on the value fixes identity churn ONLY** — a real change still re-renders every
  consumer, and **`memo` does not help because context is not a prop**.
- 🔴 **Three ways a part learns which one it is**, and registration is the trap: mount order
  ≠ document order, StrictMode double-invokes, every register needs an unregister. Explicit
  identity for natural keys; read the DOM when visual order *is* the identity.
- **Dot notation defeats tree-shaking** (side-effecting assignment on the imported object).
- **Discoverability is a real adoption cost** the props API did not have.

⚠️ Chunk 01 first came in at **325 and was SPLIT at a concept boundary, not trimmed** —
the mechanism / why-context boundary. Rule 13 working as intended.

## The audit — done before writing, and it is the load-bearing part

**21 pattern pages already exist.** Verified by listing directories, not from memory:

| Pattern | Page |
|---|---|
| The four ways to pass content | `phase-1-jsx/09-children.md` |
| Composition over configuration (2 chunks) | `phase-2-components/03-composition/` |
| Controlled vs uncontrolled (2) | `phase-2-components/04-controlled-vs-uncontrolled/` |
| Lifting state up (2) | `phase-2-components/05-lifting-state-up/` |
| Wrapper · layout · **compound components** · children-as-function | `phase-2-components/08-children-patterns.md` |
| Component boundaries | `phase-2-components/10-component-boundaries.md` |
| Render props | `phase-2-components/12-render-props.md` |
| HOCs | `phase-2-components/13-higher-order-components.md` |
| Derived state · reset-with-`key` · structuring state | `phase-3-state/06`, `07`, `10` |
| Context re-render · reducer patterns · context+reducer · external store | `phase-5-refs-context-reducers/05`, `10`, `12`, `15` |
| Share logic not state (4) · designing a hook's API (2) · the standard set (5) · extracting too early | `phase-7-custom-hooks/03`, `06`, `07`, `12` |

🔴 **The six genuine gaps, each verified absent by grep across all of `docs/react/`:**
**state reducer pattern**, **polymorphic / `as` prop**, **prop getters**, **provider
composition**, **container/presentational** — all return **zero hits**. **Headless**
returns one passing mention inside `12-render-props.md` ("headless UI kits") and
nothing that teaches it.

⚠️ **`docs/frontend-architecture/pages/02-component-architecture/01-composition-patterns.md`**
(113 lines) covers compound components, headless UI and composition, and treats
container/presentational as an anti-pattern. **Cross-link only — never edit.** It is
imported corpus: no tier badge, no `> Verified:` line, not validated to this
reference's standard, and the hub says so where it links it.

## The shape that was chosen

`docs/react/pages/patterns/` with `_category_.json`
`{"label":"Patterns · choosing a shape","position":15,"collapsed":true}` — position 15
so it sorts after phase 14. The sidebar is `{type:'autogenerated', dirName:'react'}`
(`sidebars.js:22`), so **no sidebar edit was needed**.

The hub is a **selection layer**: a "problem in your words → pattern → where it is
taught" table, then five families (getting content in · sharing logic · who owns a
value · state many components read · designing a component others use), then the six
new pages, then an anti-pattern shortlist. **No pattern is re-implemented** — the
implementation stays where it was written.

## Traps hit, and how they were handled

🔴 **A `cd` inside a chained Bash command moved the shell cwd** and the next command's
relative paths silently failed with "cannot access" — the exact trap recorded in the
JavaScript chunk-A session notes. **Fixed by using an absolute `R=` prefix var for
every path.** Do not use `cd x && …` in this repo.

🔴 **Cross-file links to pages that do not exist yet break the build.** Applied the
house convention: **bold plain text with *(not written yet)***, flipped to a real link
as each page lands. A regex de-linker did this in one pass — but it produced **nested
bold** (`**…**prop getter** *(not written yet)*…**`) where the link was already inside
a bolded run, which had to be reworded by hand. Check for `\*\*[^*]*\*\*[^*]*\*\*` after
running it.

**Link checker** (filesystem-based, no build needed) is in the session scratchpad; it also
flags any link not ending in `.md`, which is rule 2. Final run: **2,655 links across all of
`docs/react/`, 0 broken** — that covers the pre-existing pages too, so it also proves the new
section broke nothing.

🔴 **Rule 12 bit in the useful direction.** The registry row was held all session by
**chunk B (`f49e21d6`)**, deliberately running two builds to measure the search index size and
build-time delta. So **no build was run for chunk A and none is claimed** — the report says
"link-checked against the filesystem, not built", which is the honest form.

## Boards updated

- `src/data/progress.js` — **added** `{n: 15, slug: 'patterns', name: 'Patterns —
  choosing a shape', part: 'Patterns', topics: 6, pages: 1, pagesPlanned: 6}` to the
  React block. ⚠️ `pagesPlanned` must stay until all six land, or the section reads as
  complete. Parse-checked with `node --input-type=module`.
- `docs/react/pages/README.md` — claim block replaced with the chunk A/B table; phase
  table gained a Patterns row. **Also corrected the dead `/run/media/sairam/Storage`
  path** to `/mnt/Storage` (the mount moved back; that path does not exist).
- `docs/README.md` — React claims row taken over for session `02b2af2d`.

## Commits

| | |
|---|---|
| `bac8ed6e` | claim React patterns chunk A |
| `431af002` | the hub + 01 Headless components |
| `88b881be` | 02 The state reducer pattern |
| `a3e7da5d` | 03 Polymorphic components |
| `b8f40130` | 04 Prop getters |
| `21d81cb3` | 05 Provider composition |
| `711f2230` | 06 Container and presentational — **chunk A complete**, boards closed |

## Rules this chunk runs under

300-line cap is a **file-size** rule (210 · 248 · 229 · 218 · 236 · 230 · 234 — real spread,
none budgeted to land under the cap; no topic needed chunking) · every link ends `.md` with numeric prefixes · **no sandbox, no
console blocks**, react.dev + W3C APG cited in `> Verified:` · **per-file cadence** ·
never `git add -A` · **React only** — do not fix defects in other languages.
