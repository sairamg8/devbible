---
name: devbible-postgresql-repo-and-build
description: devbible's repo state (remote, Pages, branches, commit policy, shared checkout) and the build/link-mistake catalogue — split out of the PostgreSQL handoff, open before committing or building
metadata:
  type: progress
---

Child of [[devbible-postgresql-rewrite-handoff]]. **Open this before you commit,
branch, or run a build** — not on every page. The handoff keeps the resume point
and the house style; this file keeps the repo and build machinery.

## Repo state

✅ **There is a remote.** `origin` is `git@github.com:sairamg8/devbible.git`, `main`
tracks `origin/main`, and the site **publishes to GitHub Pages via Actions**
(commits `88f5458` "Publish to GitHub Pages via Actions", `dfa36e8` "Enable
corepack before setup-node"). `baseUrl` is `/devbible/`, so the site serves at
`https://sairamg8.github.io/devbible/`. **Broken links are now publicly visible**,
which raises the cost of the `onBrokenLinks: 'warn'` trap below.

✅ **`pg-phases-9-12` is merged and deleted** (session 11). Everything is on `main`;
phases 9 and 12 are in `77bd9c3` / `60ec1ee`.

✅ **Both worktree branches are merged** (2026-08-13, on the user's instruction to
"merge all branches to main"). `--no-ff`, zero conflicts — both were clean
descendants of `2285dac`, so nothing was rewritten:

| Merge | Branch | Brought in |
|---|---|---|
| `5650954` | `worktree-javascript-phases` | JS phase 3, topics 02–07 |
| `e40c5b3` | `worktree-react-phases` | React phase 1, 15 topics |

**The branches were NOT deleted and the worktrees are still `locked`.** Both
sessions may still be live; whatever they commit next branches from the pre-merge
point, which is harmless — the next merge absorbs it. Do not delete either branch
or unlock a worktree without asking.

**Everything under `docs/` is committed** as of `9faa3e5` (2026-08-13), which also
swept in the previously-untracked `reviews/` and `docs/reviews/unvalidated.md`.
Two paths are deliberately still untracked: **`.claude/worktrees/`** (1.4 GB of
live worktrees, and *not* in `.gitignore`, so it shows in every `git status`) and
`sandbox/pg-api/tmp/sqlite-conc.db` (a run artifact). Adding the worktree path to
`.gitignore` would silence the noise but was never instructed.

`main` is **10 commits ahead of `origin/main` and unpushed** as of this session.

⚠️ **Other sessions share this checkout** — [[devbible-parallel-sessions]]. Commit
`60ec1ee` accidentally contains 12 `sandbox/js-p0/*` files belonging to the
JavaScript session because `git add -A -- sandbox` was used. Nothing was lost; do
not rewrite that history while they are active. **Never `git add -A` here.**

### Committing and branches

**Commit as you go.** The session-10 lesson was not about branching: three
`pg-phase*` branches existed and every one was byte-identical, because the work was
never committed to any of them. A branch with no commits protects nothing. Commit
each phase when it lands; branch only if a diff-based review is actually going to
be run on it.

**`/code-review ultra` takes a PR number or a branch — not a path, and not the
working tree.** If you want it on a phase, that phase needs its own commits on its
own branch *before* it is merged.

**devbible itself needs an explicit instruction to commit** ([[feedback-scope-of-changes]]).
The memory store is the only repo that may be committed freely.

### The sandbox is committed

**`sandbox/` is no longer gitignored** (session 10, on the user's instruction). All
64 `pg-api` scripts plus the Node/Express/JS/TS sandboxes are committed. A reviewer
can now re-run the script a `> Verified:` line names, which closes the corpus's
original failure mode at review time rather than only at writing time.

Still ignored: `sandbox/**/node_modules/`, `sandbox/**/.stryker-tmp/`,
`sandbox/**/*.log`. **Lockfiles are kept deliberately** so a re-run pins the same
versions the numbers were taken against.

## Build

```bash
rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'
# grep exit 1 = clean. A green [SUCCESS] proves NOTHING — onBrokenLinks is not `throw`.
```

**Last clean PostgreSQL build: session 10 — zero `warning|broken`, 660 HTML pages**
(651 → 658 after phase 9's three new chunk dirs, → 660 after phase-12 topic 01
became one).

**2026-08-13 rebuild: 9 warnings / 7 distinct broken targets, none of them
PostgreSQL.** They are the parallel sessions' unwritten pages —
`docs/javascript/pages/phase-3-functions/` (02, 04, 08, README) and
`docs/typescript/pages/phase-2-narrowing/` (08-as-assertions, 12-unknown-in-catch,
README). Not yours to fix; they clear when those pages get written.

**Superseded after the two branch merges (same day): 21 broken link lines across 15
pages, then 15 after fixing the six stragglers.** The count *rose* because merging
brought in the JS and React corpora with their forward references — it was not a
regression. Still **zero PostgreSQL**. Current 15 = **12 JS forward refs** to
unwritten phase-3 topics 08+ (`08-hoisting-and-tdz`, `11-currying`,
`13-memoization`, `17-closure-and-default-gotchas`, `18-iife-and-module-pattern`)
+ **3 pre-existing TypeScript** phase-2 links. Neither merged branch touched
`docs/typescript`, so those three predate all of this.

⚠️ `grep -c 'linking to'` needs the ANSI colour codes stripped first, or an
anchored regex silently returns **0** on a log that is full of them:

```bash
yarn build 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > build.log
grep -c 'linking to' build.log
```

Also noted: `docs/typescript/pages/phase-2-narrowing/` has **no `README.md` at
all**, so that phase has no index page. Separate job, not a link fix.

Verify your own work rather than the whole log:

```bash
yarn build 2>&1 | grep -i postgresql   # empty = your phase is clean
```

The HTML count does **not** grow when a phase lands *in place* — the stamp files
already exist and are rewritten. It **does** grow when a topic is chunked: phase 5
added 6 pages (3 chunk indexes + 6 chunk files − 3 removed flat files), 605 → 611.

## The link rule — and the four sessions that got it wrong

**The current rule is in `~/.claude/CLAUDE.md` and it is short: every link ends in
`.md` and keeps every numeric prefix.** `../01-inner-join/README.md` for a chunk
directory's index, `../01-inner-join/02-fan-out.md` for a file inside it. A `.md`
link resolves *file-relative*, so it is immune to `trailingSlash`, `slug:` and
`baseUrl`, and it fails loudly at build time.

⛔ **Everything below is the superseded rule and the damage it did.** It is kept
because the *mistakes* still recur, not because the forms are correct. The old
"directory links drop the numeric prefix and end in `/`" advice **broke 188 links
across devbible** on 2026-08-13: with `trailingSlash: false` a directory index
serves with no trailing slash, so the slug form resolves one level too high. It
fails in `README.md` index pages only, which is why it survived four sessions.

The recurring mistakes, all of which the `.md` form makes impossible:

| Session | The mistake | Count |
|---|---|---|
| 6 | `../left-join/02-on-vs-where.md` — prefix dropped *and* filename kept, which was neither valid form | 5 |
| 8 | link to `../06-windows-intro.md` after that file became a directory | — |
| 9 | `../subqueries/03-in-exists-and-not-in.md` — same neither-form mistake | 6 |
| 10 | `../01-repository/` — the mirror image: a directory link that kept the prefix | 1 |
| merge session (2026-08-13) | `../05-call-apply-bind.md` and `../07-lexical-scope.md` in JS phase 3, after both became directories — **the session-8 mistake again** | 6 |

Always when a sibling topic had just become a directory and the directory form was
fresh in mind.

🔴 **The file→directory straggler is the single most repeated mistake in this
corpus** — sessions 8 and the merge session, same shape. **When you chunk a topic,
grep for inbound links to the old flat path in the same commit:**

```bash
grep -rn "05-call-apply-bind\.md" docs/   # before: 6 hits, all stale
```

The tell that it is *this* bug and not a forward-reference: the target **exists on
disk as a directory**. A forward reference has nothing on disk at all and is
expected until that topic is written — do not "fix" those by deleting the link.

**Never bulk-`sed` these.** A blanket `sed` stripping the `03-` prefix fixed three
directory links and *broke* a correct file link in `02-where-predicates.md`.
Resolve each target against the filesystem: `shared/scripts/fixlinks.py` (dry-run
by default, `--apply` to write). Note it only rewrites slug-style links inside
`README.md` files — it is a converter, not a link checker. The build grep is the
checker.

⛔ **`fixlinks.py` cannot fix the file→directory straggler above — it will silently
report success having changed nothing.** Confirmed by reading the source
2026-08-13, two independent reasons:

1. It early-returns on any target **already containing `.md`**
   (`if re.match(...) or ".md" in t: return`). Every straggler contains `.md`.
2. It walks **`README.md` files only** (`if "README.md" not in files: continue`).
   Of the six stragglers, **three were leaf pages** it would never open.

It solves the *old* problem (slug → `.md`); the straggler is the inverse. Fix those
by hand, one `Edit` per occurrence, each target checked against disk. Do not read
its `0 unresolved` as an all-clear.

⚠️ **171 slug-form links survive in `docs/nodejs/` and `docs/expressjs/`** (measured
2026-08-13). None are currently breaking — they all sit in leaf pages, where the
form happens to resolve. They are fragile rather than broken, and converting them
is a Node/Express job, not a PostgreSQL one.

### Chunk directories currently on disk

Enumerated off disk 2026-08-13 — **30 chunk directories**:

- **phase 5** (3): `01-inner-join/` `02-left-join/` `03-semi-anti/`
- **phase 6** (16): `01-group-by/` … `16-grouping-sets/` — every topic
- **phase 8** (1): `01-ddl-from-node/`
- **phase 9** (5): `01-repository/` `03-safe-dynamic-where/` `04-allowlists/`
  `05-transactions-request/` `10-keyset/`
- **phase 12** (2): `01-jsonb-operators/` `05-full-text/`
- **phase 13** (3): `01-roles-grant/` `02-secrets/` `04-pg-dump-restore/`

Regenerate with `find docs/postgresql/pages -mindepth 2 -type d | sort`.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-parallel-sessions]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-postgresql-session-log]]
