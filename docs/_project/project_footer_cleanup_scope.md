---
name: devbible-footer-cleanup-scope
description: The {/* FOOTER */} placeholder backlog — 1,241 pages ship with NO prev/next navigation, scoped per track and per phase so each lane owner closes its own. Open on "footer cleanup", "FOOTER placeholder", or "navigation missing".
metadata:
  type: project
---

# The footer placeholder backlog

**Measured on disk 2026-09-03.** Found by running the `devbible-topic` review checks on
one page picked at random ([[devbible-nodejs-p8-t28-bcrypt]] is the skill; the page was
`java/…/04-sync-vs-async/05-the-five-interaction-styles.md`). One random page surfaced a
corpus-wide defect.

## What the defect is

`AUTHOR-BRIEF.md` rule: a fork ends every page with the literal line `{/* FOOTER */}`,
and **the coordinator replaces it with the real `← Prev · Index · Next →` footer at topic
close.** For 48 topics that close never happened.

🔴 **Every automated check passes on a page with a placeholder footer** — the 300-line
cap, `mdxcheck.py` and the link resolver all see nothing wrong, because `{/* FOOTER */}`
is a valid MDX comment and there is no link to resolve. That is why it survived this
long, and why it will not surface on its own.

**Reader impact:** on 1,241 pages there is no way forward except the sidebar. In a corpus
whose whole shape is "topic → chunk 01 → chunk 02 →", the chain is the navigation.

## Two different defects — do not conflate them

| | Case | Files | Fix |
|---|---|---|---|
| **B** | Placeholder, **no footer at all** — navigation genuinely missing | **1,241** | Write the real footer, then delete the placeholder |
| **A** | Placeholder **left below a real footer** — navigation works | **70** (all `docs/python/`) | Delete the stray line. Cosmetic, 5 minutes |

⚠️ `docs/README.md` matches a naive `grep` but is a **false positive** — it quotes the
placeholder in board prose. Match `^{/\* FOOTER \*/}$` (own line), not the bare string.

## Case B, per track — each lane owner closes its own

🔴 **All three tracks are LOCKED lanes.** This is not one job; it is three, and none of
them is a passing session's to take. See [[devbible-locks]].

### `docs/java/` — 1,202 files, 42 topic dirs

| Phase | Files | Topic dirs |
|---|---:|---:|
| `phase-11-testing` | 482 | 12 |
| `phase-12-jvm-production` | 313 | 13 |
| `phase-10-data-access` | 225 | 6 |
| `phase-14-microservice-architecture` | 106 | 3 |
| `phase-13-oauth2-oidc` | 76 | 8 |

Owner: the Java board (`JAVA-BOARD.md`) — claim a row. **97% of the backlog.** These are
the phases built by multi-fork runs, which is exactly the pattern that produces it: forks
write chunks and leave the marker, the coordinator runs out of session before closing.

### `docs/nextjs/` — 39 files, 5 topic dirs

`02-routing-and-navigation` 11 · `16-deployment-scaling-and-observability` 9 ·
`04-data-fetching-in-the-app-router` 9 · `10-forms-authentication-and-security-hardening`
6 · `13-testing-and-developer-experience` 4.

⚠️ **Moving target — this track was being actively written while the count was taken**
(38 → 39 in four minutes). Re-measure before starting; do not work it while that session
is live.

### `docs/python/` — Case A only, 70 files

All 70 already have a real footer. Delete the stray line, nothing else.

## Is it mechanical?

**Mostly.** Within a topic directory the chain is derivable: order files by
`sidebar_position`, and prev/next are the neighbours. The house form is in
`.agents/references/house-style.md` — the dominant shape (2,692 uses) is:

```markdown
---

← [Topic index](README.md) · Next → [The next chunk](02-next-chunk.md)
```

🔴 **Three things stop it being a pure script:**

1. **15 of the 48 topic dirs have NO `README.md`** — so there is no index to link back
   to. Those need the topic index written first, which is authoring, not wiring. They
   are: 2 in `phase-12`, 6 in `phase-13`, 3 in `phase-14`, and all 5 nextjs dirs.
2. **The first and last chunk link outward** — first to the topic index, last to the
   *next topic*, which requires knowing the phase's topic order.
3. **`sidebar_position` is not always clean.** A sample found duplicates
   (`phase-11-testing/02-assertj` has two files at position 2). A duplicate position is a
   silent reordering that every existing check passes — see the same finding in
   [[devbible-locks]]'s Python row. **Fix the duplicates first, or the derived chain is
   wrong.**

## Order of work, per lane

1. `grep -rln '^{/\* FOOTER \*/}$'` your track → the file list.
2. Per topic dir: check `sidebar_position` is unique and gap-free. **Fix collisions
   first.**
3. Write the missing `README.md` indexes (the 15).
4. Derive and write the footers; delete the placeholders.
5. Verify: `grep -c '^← '` equals the file count, and every link resolves against the
   filesystem — not `fixlinks.py` alone, which has a documented blind spot on
   directory-vs-file paths.

**Cadence stays per file.** 1,241 files is many sessions; commit explicit paths as you
go, never `git add -A`.

## Precedent

This has been done correctly once already: the Real World session
(`docs/README.md`, 2026-09-02) *"wired the 17 `{/* FOOTER */}` placeholders the
2026-09-01 fork left in phase 8 chapters 01–02 into real footers and gave both chapter
indexes their phase/prev/next line."* Same shape, 17 files. This is that, at 73×.

## The prevention, worth more than the cleanup

🔴 **Add `{/* FOOTER */}` to the topic-close checklist and to the QC gate**, beside the
cap and MDX checks:

```bash
grep -rln '^{/\* FOOTER \*/}$' <topic dir>    # must be empty at close
```

A one-line check would have caught this at the first topic instead of the 48th.

Related: [[devbible-skills-system]] · [[devbible-author-brief]] · [[devbible-locks]] ·
[[devbible-validation-plan-multisession]]
