---
name: devbible-session-20260815-e75b3868
description: Session record for e75b3868 (2026-08-15) — memory/board audit that found the snapshot badly stale, then Docker chunk A closed at 28/28
metadata:
  type: progress
---

# Session `e75b3868` — 2026-08-15

Two halves: an audit of the memory store against the live repo, then **Docker chunk A
taken over and finished**.

## Part 1 — the audit

**Asked:** *"can you review the memories and check the progress of what was pending tasks?"*

Read `devbible/INDEX.md` and the per-track cursors, then **recomputed the board from
`src/data/progress.js` rather than trusting any memory**. That was the right call:

🔴 **[[devbible-overall-snapshot]] was badly stale** — it read *"JavaScript 57% in two
lanes"*, *"Nginx — not started, no syllabus"*, and gave Docker no numbers, while the
truth was **JavaScript finished, Nginx at 46/210 with a full 210-topic syllabus, Docker
at 125/192 and moving**. Three tracks had moved and one had completed since it was
written that morning. **It has now been refreshed** — and carries an explicit warning
that it is a cache, never a source.

**The lesson worth keeping:** a snapshot file written by one session while a dozen others
are mid-phase is stale within hours. **Recompute before quoting a percentage.** The
one-liner lives at the bottom of the snapshot file.

Also confirmed from the claim table + cursors, and unchanged by this session: **Redis** is
the cleanest cold start (74-topic syllabus, 0 pages), **Nginx** resumes at phase 3,
**MongoDB** at phase 6 with sources already fetched, **TypeScript** at phase 3 topic 12.

## Part 2 — Docker chunk A, closed

**Asked:** *"docker and podman pick a"* → the documented trigger. Took the claim over from
`2e26b051` in both claim rows and started at the cursor without asking.

Phase 5 was at 9/12. Wrote the last three topics; phase 4 was already 16/16, so **chunk A
finished at 28/28**.

| # | Topic | Tier | Lines |
|---|---|---|---|
| 10 | **Static binaries** — ⚠️ chunked directory | Know | **504** (01 linking 261 · 02 runtimes 205 · index 38) |
| 11 | SBOMs and provenance | Know | 290 |
| 12 | Signing and verifying | When Needed | 274 |

**Phase 5 close:** 14 files, 3,100 lines, largest 290, **0 over the 300-line cap, 0 broken
links** across the phase, every page carrying a tier badge and a `> Verified:` line.
Chunk A overall: **32 files, 6,692 lines, 0 over cap.**

⚠️ **Link-checked against the filesystem, NEVER built.** No row was claimed in
[[session-build-devserver-registry]]. Both commits and the memory say so plainly rather
than implying green.

Full per-topic detail, sources and the facts not to re-fetch:
[[devbible-session-20260815-docker-chunk-a]].

### The cap rule applied for real

Topic 10's first draft was **one file at 361 lines**. It was **split on a concept
boundary** — *how you produce a self-sufficient binary* (01) vs *which runtimes can, and
what `scratch` still expects* (02) — **not trimmed**. Part 02 opens by saying it depends
on 01. This is the rule working as intended, and worth pointing at next time someone is
tempted to cut a section to fit.

### Claims deliberately NOT made

Rule 7 in practice, all three recorded because the temptation was real:

- **No size figure for the `node` binary.** A draft said "~100 MB"; nothing measured it
  and no doc states it, so it reads "a large C++ program with V8 inside it".
- **The glibc static-`getaddrinfo` failure is not presented as documented.** The docs
  establish only the mechanism (NSS backends are shared objects). The familiar linker
  warning is a **toolchain message**, cited as `golang/go#21421` inside a `:::note` that
  says exactly that.
- **A source I had not read was removed from a `> Verified:` line.** Chunk 02 cited a
  Docker page this session never fetched; it now attributes those facts to page 06, which
  did.

## 🔴 Traps found this session

1. **Another session commits the shared boards out from under you.** Chunk B's session
   swept `docs/README.md`, `docs/docker/pages/README.md` and `src/data/progress.js` into
   its own commit mid-topic. **Nothing was lost** — every edit of mine went in intact —
   but `git add` then showed only my page files. **Re-check whether a shared board is
   still in your working tree before assuming your commit will carry it**, and verify
   against `git show HEAD:<file>` rather than re-editing.
2. 🔴 **`git commit` fails with "Author identity unknown."** No `user.*` config is
   readable in this session and `~/.gitconfig` is not visible. **Do not set git config**
   — out of scope. Pass the identity per commit instead:
   ```
   GIT_AUTHOR_NAME=sairamgudiputi GIT_AUTHOR_EMAIL=sairamgudiputi8@gmail.com \
   GIT_COMMITTER_NAME=sairamgudiputi GIT_COMMITTER_EMAIL=sairamgudiputi8@gmail.com \
   git commit -F - <<'EOF' ... EOF
   ```
   That is the identity every existing commit in both repos uses.
3. **A directory conversion needs its inbound links checked first.** Topic 10 became
   `10-static-binaries/`. It was clean **only because all four references to it were still
   bold plain text** *(not written yet)* — checked before converting, not after. Had any
   been links, they would have silently pointed one level wrong.
4. **`git status --short` after `git add` is the check that catches trap 1** — files you
   staged that do not appear were committed by someone else.

## Facts worth carrying to other Docker phases

- 🔴 **Docker Content Trust is retiring: the Notary v1 service at `notary.docker.io`
  shuts down 8 December 2026.** Verified 2026-08, so ~4 months out. The docs announce the
  shutdown **without naming a successor**. Re-check this after December 2026.
- **Provenance `mode=min` is attached by default**; SBOM is opt-in. `mode=max` **exposes
  build argument values** (documented).
- **Two Podman divergences, not flag renames:** `--sbom` writes a file or a path *inside
  the image* (content) where BuildKit attaches an in-toto attestation to the **index**, and
  `podman-build(1)` documents **no `--provenance` at all**. Separately Podman is **ahead**
  on enforcement — `policy.json` is checked **at pull time**, default-`reject`, scopes
  most-specific-first; Docker has no equivalent now that DCT is ending.

## State at session end

- **Docker: 140/192, phases 0–6 complete.** Chunk A free; B/C/D held by live sessions
  (each had changed hands during the day — read the cursor table, not any quoted id).
- **The unclaimed levelling option:** the split file names **phase 12 (12 topics)** as the
  clean hand-off to a finished chunk. **Needs the user's word — do not re-cut silently.**
- Both repos clean and committed; the memory store pushed to `sairamg8/claude-context`.

Related: [[devbible-session-20260815-docker-chunk-a]] · [[devbible-docker-split-4way]] ·
[[devbible-overall-snapshot]] · [[devbible-never-compress-to-fit-cap]] ·
[[devbible-no-new-sandbox-scripts]]
