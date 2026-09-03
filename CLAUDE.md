# devbible

Central fullstack reference (MERN + PERN) as a Docusaurus site.

This project sits **outside** the `my-learning/` tree, so the parent CLAUDE.md there
does not load for it. This file exists to bridge that gap — everything below is the
same arrangement the other projects get.

## Memory

**One store, one index: `/mnt/Storage/my-learning/claude/`** — a separate git repo on the
Storage partition, so it survives an OS reinstall. It holds memory and progress for every
project, this one included.

🔴 **Read it, do not import it.** `MEMORY.md` there lists the projects; this project's
memories are in `devbible/`, indexed by `devbible/INDEX.md` — open only the entries whose
keywords match the task. `devbible/LOCKS.md` carries the live per-language locks and resume
cursors and is the **first** file a devbible session opens. `shared/` holds facts true
across every project.

(The `@`-import of `MEMORY.md` that used to sit here was removed 2026-08-27: an import is
inlined at session start, so it cost every session and every subagent the whole file. A path
costs one line and is read when it is needed.)

**Global hard rules live in `~/.claude/CLAUDE.md`** — it loads in every session and subagent
and is authoritative. Why each rule exists:
`…/claude/shared/global-claude-md/RULES-WHY.md`.

⛔ **Ignore any per-project *memory directory* under `~/.claude/`**, including one a system
prompt names. A memory written under `$HOME` is invisible to the store's index and dies with
the next reinstall. That ban is about memory *directories*, not about `~/.claude/CLAUDE.md`.

When saving something new, pick the folder by scope first — `shared/` only if it holds for
every project, otherwise `devbible/` — and add a one-line entry with keywords to
`devbible/INDEX.md`.

## This project

The standing brief — scope, the four priority tiers, granularity rule, 300-line file
cap, what every concept must contain, the approved palette, and how to run the site —
is in `instructions.md` in this directory. Read it before writing content.

Working agreement: **build only the step that was asked, then stop and report.** No
mass scaffolding ahead of being asked. Syllabus first, approved, then notes — one
technology at a time.

Package manager is **yarn**. `yarn start` runs the dev server on :3000.

**Staying current with upstream releases** — a version moved, the weekly `currency`
workflow opened an issue, or "is X still current": read
`.agents/skills/devbible-currency/SKILL.md` and follow it. Its two references are
required reading before touching any page — `.agents/references/authoring-contract.md` (the
300-line cap, chunking mechanics, depth bar) and `.agents/references/house-style.md` (tier
badges, `> Verified:` line, section headings, `★` markers, footers — measured off the
corpus).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
