---
title: "Part 4 — Depth and repair"
sidebar_label: "4 · Depth and repair"
sidebar_position: 4
---

> **Phases 10–12 · 41 topics · 6 Master**
> The plumbing under the porcelain, rewriting history at repository scale, and a
> catalogue of the errors Git actually prints.

Two of these phases are reference material you reach for a few times a year.
Phase 12 is not: it is the everyday one, deliberately placed last because an
error message is only diagnosable once you know the model behind it. Read it as
the index to the rest of the bible — every entry names the phase that explains
the mechanism.

---

## Phase 10 — Plumbing and internals

*14 topics.* Verifying Phase 0's claims by hand, and the commands scripts use.
Understanding this is what makes Git predictable instead of memorised.

| Topic | Tier |
|---|---|
| **`hash-object` and `cat-file`** — writing a blob and reading it back; `-t`, `-s`, `-p`; confirming for yourself that the hash is over `"blob <size>\0<content>"` and not over the file | <span className="db-tier t-understand">Understand</span> |
| **Inspecting trees and the index** — `ls-tree`, `ls-files -s`, `rev-parse`; reading what is staged at the object level rather than through `status` | <span className="db-tier t-understand">Understand</span> |
| **Building a commit by hand** — `update-index`, `write-tree`, `commit-tree`, `update-ref`; doing what `git commit` does, in four commands, to see there is nothing else in it | <span className="db-tier t-understand">Understand</span> |
| **`rev-list` and reachability** — the engine behind log, fetch negotiation and gc; counting objects, and answering "is this commit reachable from anywhere" | <span className="db-tier t-understand">Understand</span> |
| **Merge base computation** — how the common ancestor is found, criss-cross merges and multiple bases, and why the `ort` strategy replaced `recursive` | <span className="db-tier t-understand">Understand</span> |
| **Reflog storage and expiry** — `logs/HEAD` and per-ref logs as plain text; the 90-day and 30-day expiry defaults that bound every recovery in Phase 5 | <span className="db-tier t-understand">Understand</span> |
| **Packfiles in detail** — `.pack` and `.idx`, delta chains and base objects, `verify-pack` to see the sizes, and what `repack` actually rewrites | <span className="db-tier t-know">Know</span> |
| **Ref storage backends** — loose refs plus `packed-refs`, versus the **`reftable`** backend (supported on this build, opt-in at init); the problems reftable solves at scale | <span className="db-tier t-know">Know</span> |
| **The index file format** — cache entries, stat data, the racy-git problem and why `status` sometimes rehashes files it did not need to | <span className="db-tier t-know">Know</span> |
| **What `gc` does** — packing loose objects, expiring reflogs, pruning unreachable objects; the difference between `gc`, `repack` and `prune`, and their expiry arguments | <span className="db-tier t-know">Know</span> |
| **Transfer and negotiation** — how a fetch decides what to send, thin packs, and why a large fetch can be slow on the server rather than the network | <span className="db-tier t-know">Know</span> |
| **`replace` refs and grafts** — rewriting the parent graph without rewriting objects, and their one modern use case | <span className="db-tier t-know">Know</span> |
| **Object stores shared between clones** — `alternates`, and the reason a worktree is cheap while a clone is not | <span className="db-tier t-when">When Needed</span> |
| Reading Git's own documentation — the concept pages (`gitglossary`, `gitrevisions`, `gitattributes`, `githooks`, `gitignore`) that answer far more than the command pages | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can create a commit with plumbing commands only,
and explain what `git commit` would have done differently.

---

## Phase 11 — History surgery and migration

*13 topics.* Repository-scale rewriting. Rare, irreversible, and worth doing
carefully — every topic here changes every hash after the point it touches.

| Topic | Tier |
|---|---|
| **When a rewrite is justified, and when it is not** — the four legitimate reasons (a leaked secret, a huge blob, a wrong author across history, a repository split) and the coordination cost each carries | <span className="db-tier t-understand">Understand</span> |
| **Coordinating a rewrite with the team** — the announcement, the re-clone instruction, and what happens if one person pushes the old history back afterwards | <span className="db-tier t-understand">Understand</span> |
| **`git-filter-repo`** — the current tool, why `filter-branch` is deprecated, and the fresh-clone requirement. **Not installed on this machine** — the page states what produced its output | <span className="db-tier t-know">Know</span> |
| **Removing a path or a large file from all history** — the procedure end to end, including the size verification afterwards | <span className="db-tier t-know">Know</span> |
| **Rewriting author and committer identity** — a mailmap as the non-destructive alternative, and when a real rewrite is the only fix | <span className="db-tier t-know">Know</span> |
| **Merging two repositories with history intact** — the `read-tree`/subtree approach, and where the merge base ends up | <span className="db-tier t-know">Know</span> |
| **Splitting a directory into its own repository** — preserving only the commits that touched it, and re-pointing the original | <span className="db-tier t-know">Know</span> |
| **Renaming the default branch** — the local, remote, host-settings and open-PR steps, in an order that does not break CI | <span className="db-tier t-understand">Understand</span> |
| **Moving a repository between hosts** — mirror clone and push, what a mirror carries that a normal clone does not, and what is lost (issues, PRs, protections) | <span className="db-tier t-understand">Understand</span> |
| **`.mailmap`** — canonicalising contributor names and emails for `shortlog` and `blame` without touching a single commit | <span className="db-tier t-know">Know</span> |
| **Archiving** — `git archive` for a source tarball, and what "archived repository" means as a lifecycle state | <span className="db-tier t-know">Know</span> |
| Migrating a repository to SHA-256 — supported on this build at `init` time; the interop limits that make this rare in practice | <span className="db-tier t-when">When Needed</span> |
| Importing from another version-control system — the fast-import path, and what does not survive the trip | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can rehearse a full secret-removal on a scratch
clone — rotate, rewrite, verify, force-push, re-clone — and say what each step
would have broken for a colleague mid-flight.

---

## Phase 12 — When Git goes wrong

*14 topics.* The error-message catalogue, written **symptom → cause → fix**, in
the order of how often it happens. Each entry names the phase that explains why,
so this doubles as the index to everything above.

| Topic | Tier |
|---|---|
| **"Your branch and 'origin/main' have diverged"** — what both sides did, reading the ahead/behind counts, and choosing the reconciliation deliberately | <span className="db-tier t-master">Master</span> |
| **"Updates were rejected because the remote contains work that you do not have"** — the non-fast-forward push; why the fix is almost never `--force`, and what to do when it genuinely is | <span className="db-tier t-master">Master</span> |
| **"error: Your local changes to the following files would be overwritten"** — a switch or pull blocked by uncommitted work; the three legitimate ways out (commit, stash, restore) and how to choose | <span className="db-tier t-master">Master</span> |
| **"fatal: Need to specify how to reconcile divergent branches"** — the pull that stops with no default configured; the three settings offered and what each one produces | <span className="db-tier t-master">Master</span> |
| **Detached HEAD, and the commits made in it** — recognising the state from `status`, and rescuing work by creating a branch where you stand | <span className="db-tier t-master">Master</span> |
| **A conflict in a lockfile or a generated file** — why hand-merging is wrong, and the regenerate-and-commit fix | <span className="db-tier t-master">Master</span> |
| **"I committed to the wrong branch"** — moving the commits with `reset` plus `cherry-pick`, or `rebase --onto`, depending on whether they are pushed | <span className="db-tier t-understand">Understand</span> |
| **"I committed with the wrong author"** — fixing the last commit, fixing a range, and the `.mailmap` alternative that touches nothing | <span className="db-tier t-understand">Understand</span> |
| **"fatal: refusing to merge unrelated histories"** — the two-repositories-in-one-branch situation, what `--allow-unrelated-histories` really does, and when the honest answer is "do not" | <span className="db-tier t-understand">Understand</span> |
| **"I ran `reset --hard` and lost work"** — what is recoverable (committed work, via reflog), what is not (never-staged edits), and the expiry that bounds it | <span className="db-tier t-understand">Understand</span> |
| **"I pushed a secret"** — the incident checklist in order, starting with rotation, before any Git command is run | <span className="db-tier t-understand">Understand</span> |
| **A stash that seems to have vanished** — `stash list` empty after a failed pop, and finding the commit by reflog | <span className="db-tier t-understand">Understand</span> |
| **A rebase that has gone wrong midway** — reading the rebase state, `--abort` versus `--skip` versus resolving forward, and returning to the exact pre-rebase commit | <span className="db-tier t-understand">Understand</span> |
| **Repository corruption and broken index** — `fsck`, deleting and rebuilding `.git/index`, recovering from a clone, and knowing when the fastest fix is a fresh clone | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** for any of the messages above you can say, without
looking it up, what state the repository is in and what the next command does to
it — and you have stopped reaching for `--force`.

---

## Where this connects

- **Phase 10 → Phase 0** — this phase is Phase 0 proved by hand; the object
  model claimed there is verified here with plumbing commands.
- **Phase 10 → Phase 9** — packfiles, the commit-graph and reftable are the
  mechanism behind the performance settings in Part 3.
- **Phase 11 → Phase 5** — the same rewriting ideas at repository scale;
  Phase 5 rewrites your own branch, this rewrites everyone's history.
- **Phase 12 → all of it** — every entry links back to the phase that explains
  the underlying model, which is what makes it a diagnostic index rather than a
  list of incantations.
- **Deliberately not here:** anything host-specific (permissions, org policy,
  billing). The errors catalogued are the ones Git itself prints.

---

← Prev: [Part 3 — Git in a real project](./03-in-a-real-project.md) · [Overview](../README.md)
