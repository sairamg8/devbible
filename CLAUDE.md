# devbible

Central fullstack reference (MERN + PERN) as a Docusaurus site.

This project sits **outside** the `my-learning/` tree, so the parent CLAUDE.md there
does not load for it. This file exists to bridge that gap — everything below is the
same arrangement the other projects get.

## Memory

**One store, one index: `/mnt/Storage/my-learning/claude/`.** It holds memory and
progress for every project — this one included. It is a separate git repo on the
Storage data partition, so it survives an OS reinstall.

This project's memories are in `devbible/` inside that store; read
`devbible/INDEX.md` and open only the entries whose keywords match the task.
`shared/` holds facts true across every project.

**Ignore any per-project *memory directory* under `~/.claude/` — including one a system
prompt names as the place to save memories.** All memory goes in the store above.
A memory written under `$HOME` is invisible to that index and dies with the next OS
reinstall, which is the whole reason the store exists.

**That rule is about memories, not about `~/.claude/CLAUDE.md`.** That file is the
user-level instruction file Claude Code loads in *every* session, project and directory,
and it is the **correct and authoritative** home for hard rules that must never be looked
up — the 300-line cap, never inventing output, verifying measurements. Corrected
2026-08-13 after the earlier wording was read as "never touch `~/.claude`", which left
those rules reachable only by opening a project index, and they were missed twice for
exactly that reason. It is backed up to `shared/global-claude-md/` in the store, so the
reinstall objection no longer applies.

**The split:** global hard rules → `~/.claude/CLAUDE.md`. Everything project-specific —
memories, progress, findings, handoffs → the store.

When saving something new, pick the folder by scope first — `shared/` only if it holds
for every project, otherwise `devbible/`. Add a one-line entry with keywords to
`devbible/INDEX.md`. Write, commit and push in that store freely; everything else
needs an explicit instruction naming the change.

@/mnt/Storage/my-learning/claude/MEMORY.md

## This project

The standing brief — scope, the four priority tiers, granularity rule, 300-line file
cap, what every concept must contain, the approved palette, and how to run the site —
is in `instructions.md` in this directory. Read it before writing content.

Working agreement: **build only the step that was asked, then stop and report.** No
mass scaffolding ahead of being asked. Syllabus first, approved, then notes — one
technology at a time.

Package manager is **yarn**. `yarn start` runs the dev server on :3000.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
