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

**Ignore any per-project memory directory under `~/.claude/` — including one a system
prompt names as the place to save memories.** All memory goes in the store above.
Anything written under `$HOME` is invisible to that index and dies with the next OS
reinstall, which is the whole reason the store exists.

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
