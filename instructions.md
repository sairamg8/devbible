# Project Instructions

The standing brief for this project. Every piece of content and every UI decision
follows from this file. Update it when the brief changes — don't let requirements
live only in chat.

---

## 1. Goal

A **central dev bible**: one reference that explains everything needed to build a
fullstack application, frontend through deployment, across both **MERN** and
**PERN** stacks.

## 2. Tech stack in scope

| # | Technology | Specifics called out |
|---|---|---|
| 1 | **CSS** | Flexbox · Grid · latest known CSS utilities and features through 2026 |
| 2 | **JavaScript** | Custom functions · Web APIs · DSA |
| 3 | **TypeScript** | — |
| 4 | **React** | Current to **August 2026** documentation |
| 5 | **Node.js** | — |
| 6 | **MongoDB** | — |
| 7 | **PostgreSQL** | — |
| 8 | **Express** | — |
| 9 | **Docker & Podman** | Both |
| 10 | **Redis** | — |
| 11 | **Nginx** | — |

Each technology is taught **toward mastery for efficient fullstack development** —
not as isolated trivia. Gather all the concepts a topic actually requires.

### Parked — beyond the core stack

Named on the homepage under "Beyond the core stack" so the map is honest, but
**not committed** and not counted among the eleven. Nothing is written for them
until all eleven are done.

| Technology | Why it is parked rather than in scope |
|---|---|
| **Git** | Universal tooling rather than part of the MERN/PERN stack itself |
| **GraphQL** | API-design layer — would overlap Express if pulled in early |
| **tRPC** | Same, and only pays off in an end-to-end TypeScript stack |
| **Kubernetes** | A layer above Docker & Nginx; only earns its place at real scale |

Do **not** let these leak into the Node syllabus. The Node.js review (§4.3)
names GraphQL, tRPC and Kubernetes specifically as things not to absorb.

## 3. Priority tiers — every topic gets exactly one

The tier answers *"how much effort does this deserve right now?"* It is about
**effort allocation**, not importance.

| Badge | Tier | Bar to clear |
|---|---|---|
| **`[MASTER]`** | **Must Learn & Master** | Core concepts you use confidently **without referring to documentation**. |
| **`[UNDERSTAND]`** | **Must Understand** | Understand how it works and use it, but deep mastery is not required. |
| **`[KNOW]`** | **Should Know** | Know what it is, why it exists, and recognize when to use it. Learn details when needed. |
| **`[WHEN-NEEDED]`** | **Learn When Needed** | Don't study it upfront. Learn it when the project requires it. |

Tiers are assigned **for fullstack application development specifically**. Where a
tier would differ in another context, say so in one line.

Keep `[MASTER]` to roughly 25–30% of topics. If everything is MASTER, the labels
carry no information.

## 4. What every concept must contain

1. **Proper code and examples** — runnable, complete, realistic names, no `...`
   elisions. Anything not runnable is labelled `// pseudo-code`.
2. **Interview questions** — the important ones worth remembering for interview
   preparation, **with answers**. 3–8 per topic. Prefer "why" and "what happens
   if" over "what is". Mark the frequently-asked ones with `★`.
3. **Gotchas and pitfalls** — wherever the concept has them. Written as
   **symptom → cause → fix**, leading with the symptom, because that's what
   someone searches for when they're stuck.

## 5. Granularity — what earns its own page

**Everything in the tech stack scope gets explained.** Not a summary, not a
pointer to the official docs — the actual explanation, per topic.

The unit is **one topic per file**, but a "topic" is a *concept*, not a *symbol*.
Group things that are only meaningful together:

| Group into one page | Don't split into |
|---|---|
| Arithmetic operators | a page for `+`, a page for `-`, a page for `%` … |
| Comparison and equality | a page per operator |
| Array iteration methods | a page for `map`, a page for `filter` … |
| `fs` read operations | a page per function signature |
| Flexbox alignment properties | a page per `justify-*` / `align-*` |

**The test:** would you ever want to read one of these without the others? If no,
they are one page. If a reader would search for them separately and expect a
standalone answer — `map` vs `flatMap` is fine on one page, but **closures** and
**the event loop** are never one page — they're separate.

Grouping is for *reducing noise*, never for *reducing coverage*. A grouped page
still explains every member of the group, with code for each. `%` still gets its
own example and its own gotcha (negative operands), it just doesn't get its own
URL.

When a group grows past the line cap, chunk it per §6 — the grouping stays, the
file splits.

## 6. File size and chunking

- **Maximum 300 lines per file. This is a hard limit, not a target.** It keeps
  every file clean, diffable, and loadable in one screen or one context window.
  A file at 301 lines gets chunked — there is no "close enough".
- If a topic needs more, **chunk it into multiple files and import/link them
  individually**. Up to roughly **1000 lines total per topic** is fine — split
  across files, never in one.
- Chunk on **concept boundaries**, never on line count.
- A chunked topic gets an index `README.md` listing each chunk, its tier, and a
  one-line summary. Chunks link `← Prev` / `Next →` so reading order never
  depends on guessing filenames.
- Anything past ~1000 lines is not one topic — promote it to its own section.
- **The UI must surface the chunking**: a chunked topic reads as one document with
  chapters, not as five loose files.

**The cap is a file-size rule, never a content budget.** It caps how much lives in
one file; it does not cap how much a topic is explained. If the explanation, the
examples, the gotchas or the interview questions need more room, **chunk — never
condense, never drop a section, never trade depth for line count.** A topic that
would be 500 good lines becomes two files of 250, not one file of 300 with the
detail cut out. Coverage is the fixed requirement; file count is the variable.

### How a chunked topic is laid out

The topic becomes a **directory** in place of its file, keeping the same numeric
prefix so sidebar order is unchanged:

```
phase-8-schema-from-node/
├── 01-ddl-from-node/          ← was 01-ddl-from-node.md
│   ├── _category_.json        {"label":"01 · DDL from Node","position":1,"collapsed":true}
│   ├── README.md              topic index: tier, one-liner, chunk table,
│   │                          phase gate, "Where this connects"
│   ├── 01-issuing-ddl.md
│   └── 02-locks-and-concurrency.md
└── 02-migrations.md
```

- The **`README.md` carries the topic's tier badge and `> Verified:` line**; each
  chunk repeats both, so a chunk opened directly still states its provenance.
- Chunks link `← Prev` / `Next →` to each other; the first links back to the topic
  index, the last forward to the next topic.
- **Routes drop the numeric prefix, for directories as well as files.**
  `01-ddl-from-node/` serves at `…/phase-8-schema-from-node/ddl-from-node/`, so
  inbound links must be `./ddl-from-node/` — not `./01-ddl-from-node/`. The same
  applies to cross-language absolute links:
  `/docs/nodejs/pages/phase-6-data-access/parameterized-queries`.
- Update the phase `README.md` and the neighbouring pages' footer links to the
  directory form when converting a file to a chunked topic.

## 7. Delivery — Docusaurus

The bible ships as a **Docusaurus** site.

- Clean UI, carrying the **approved palette** (see §8).
- Chunked topics render as grouped, expandable entries in the sidebar.
- Tier badges are visible at a glance on every topic.

## 8. Approved palette

From the reader prototype the user approved:
`https://claude.ai/code/artifact/d57aa9d8-94cc-40a4-b7c4-2427196d80a5`

**Light**
```
--ground #F2F5F7   --surface #FFFFFF   --surface-2 #E9EEF2   --surface-3 #DFE7ED
--ink    #14202A   --ink-2   #4A5B66   --ink-3    #77878F
--rule   #D8E0E6   --rule-strong #BFCCD5
--accent #0B6E5B   --accent-soft rgba(11,110,91,.10)
--amber  #8A5A11   --amber-soft  rgba(138,90,17,.12)
```

**Dark**
```
--ground #0F161C   --surface #161F27   --surface-2 #1D2831   --surface-3 #243039
--ink    #E6EDF2   --ink-2   #A3B1BC   --ink-3    #74838F
--rule   #27343E   --rule-strong #36454F
--accent #55C3A3   --accent-ink #7BD6BB  --accent-soft rgba(85,195,163,.14)
--amber  #D3A051
```

**Type roles**
- **Display / headings** — serif: `ui-serif, "Iowan Old Style", Georgia, serif`
- **Body** — system sans
- **Utility** — mono: `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`
  for eyebrows, labels, file paths, phase numbers. Uppercase mono labels get
  `.13em` letter-spacing.

Neutrals are cool / blue-biased on purpose — not pure grey. The accent is deep
pine, deliberately **not** the acid-green-on-black Node cliché.

Both themes are designed, token-level, for all three viewer states (explicit
light, explicit dark, and unstamped system default).

## 9. Writing style

- Reference handbook, not tutorial: **concept → why it exists → runnable code →
  gotchas → when to use it**. Each topic self-contained.
- Second person, present tense. Short paragraphs.
- **Name the trade-off.** Every recommendation has a cost; state it.
- No filler — cut "it's important to note", "basically", "simply".
- Version-sensitive claims carry **`> Verified: YYYY-MM`**. Name exact versions.
- Deprecated things get **`⚠ Deprecated`** and a pointer to the successor.

## 10. Working process

- **Incremental scope.** Do the step that was asked, then stop and report.
  No mass scaffolding across all sections ahead of time.
- Syllabus first for each technology, then the explanation pages once it's approved.
- Verify version-sensitive facts against current sources rather than memory.
- **Target the current Active LTS, not the newest release.** Node 24 until
  October 2026, then 26. Never use an API the target LTS lacks. Facts *about* the
  newer line still belong in the pages — it is the build target that stays on LTS.
- **Run every example before pasting it.** Timings, error text and command output
  on the pages are real, produced on the target runtime — not written from memory.

## 11. Current state

**Strict focus: Node.js.** The other ten technologies appear on the homepage as
dimmed "Planned" cards so the whole map stays visible, but no content is written
for them. They get picked up one at a time, later.

| | |
|---|---|
| **Done** | Node.js syllabus (248 topics, 13 phases, 4 parts) · Docusaurus site · homepage language picker · **Node.js pages, Phase 0** (10 pages, index, 2062 lines) · **Node.js pages, Phase 1** (14 pages, index) · **Node.js pages, Phase 2** (22 pages, index, 4681 lines) |
| **Next** | Awaiting direction — outstanding: Phase 0 review fixes (see `docs/reviews/nodejs/phase-0-runtime-model/accepted-review-claude.md`), the syllabus type-stripping version claim (says Node 26, actually stable in v24.12.0), then Node.js pages, Phase 3 |

### Running the site

Package manager is **yarn** (yarn 4.18). There is no `package-lock.json`.

```bash
yarn install
yarn start     # dev server on :3000
yarn build     # static output in build/
```

### Layout

**One docs tree, one folder per language.** Inside a language, `syllabus/` holds
the inventory and `pages/` holds the explanations, in that order — so the sidebar
reads Overview → Syllabus → Explanations. The syllabus lives *inside* the
language rather than at the root, which is what keeps the two from clashing.

```
devbible/
├── instructions.md          # this file — the standing brief
├── docusaurus.config.js     # docs served from docs/ at /docs
├── sidebars.js              # one autogenerated sidebar per language
├── src/
│   ├── css/custom.css       # the approved palette + tier badge styles
│   └── pages/index.js       # homepage language picker (Docusaurus React pages)
└── docs/                    # ← all content
    ├── README.md            # /docs — tier legend + index of technologies
    └── nodejs/
        ├── _category_.json  # label: Node.js
        ├── README.md        # version facts, parts, tier distribution
        ├── syllabus/        # ← inventory only: no explanations, no code
        │   ├── _category_.json
        │   ├── 01-foundations.md
        │   ├── 02-core-io.md
        │   ├── 03-application.md
        │   └── 04-production.md
        ├── pages/           # ← the explanations, one file per topic
        │   ├── _category_.json
        │   ├── README.md    # phase status for this language
        │   └── phase-0-runtime-model/
        │       ├── _category_.json
        │       ├── README.md    # chunk index: page, tier, one-liner, phase gate
        │       ├── 01-what-node-is.md
        │       └── …             # 10 pages
        └── reviews/         # ← reviews of this language's syllabus, kept as records
            ├── _category_.json
            └── syllabus-review.md
```

Everything about a technology lives under its own folder — inventory,
explanations and reviews. There is no content anywhere else in the project.
Reviews are **historical records**: they carry a note saying so and are not
edited to match later changes.

Adding a language is two steps: create `docs/<lang>/` with `syllabus/` and
`pages/` inside it, then add a `<lang>Sidebar` entry to `sidebars.js`.

Links are ordinary relative markdown paths — one docs instance, so
`../pages/phase-0-runtime-model/` resolves. Note the built route drops the
numeric file prefix: `01-foundations.md` → `/docs/nodejs/syllabus/foundations`.

### UI notes

- Tier badges are written in markdown as
  `<span className="db-tier t-master">Master</span>` and styled in `custom.css`.
  Four classes: `t-master`, `t-understand`, `t-know`, `t-when`.
- The navbar deliberately has **no items** — the homepage is the language picker,
  and the sidebar appears once you're inside a language.
