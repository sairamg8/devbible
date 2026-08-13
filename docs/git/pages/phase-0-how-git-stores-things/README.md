---
title: "Phase 0 — How Git stores things"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** Every command block in this phase was run by
> `sandbox/git-p0/ex1-version-facts.sh` or `sandbox/git-p0/ex2-object-model.sh`,
> in a throwaway repository under `/tmp` with the machine's global and system
> config neutralised — so a measured default is Git's default, not this
> laptop's.

No workflow yet. What is on disk, what a commit physically is, and why every
later command behaves the way it does. This is the phase that makes the rest of
Git cheap to learn: `reset --soft` versus `--hard`, why rebasing changes hashes,
and why a deleted branch loses nothing are all consequences of the storage model
rather than facts to memorise.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Git actually is](01-what-git-is.md)** | <span className="db-tier t-master">Master</span> | A key-value store keyed by content hash, plus names pointing into it |
| 02 | **[A commit is a snapshot](02-commit-is-a-snapshot.md)** | <span className="db-tier t-master">Master</span> | Snapshots in the model, deltas in the packfile — both true, different layers |
| 03 | **[The four object types](03-object-types.md)** | <span className="db-tier t-master">Master</span> | Blob, tree, commit, annotated tag — and nothing else |
| 04 | **[The three trees](04-three-trees.md)** | <span className="db-tier t-master">Master</span> | HEAD, index, working tree; every command is a move between two |
| 05 | **[The index is a real file](05-the-index.md)** | <span className="db-tier t-master">Master</span> | Staging is a copy into the object store, not a flag |
| 06 | **[Refs and HEAD](06-refs-and-head.md)** | <span className="db-tier t-master">Master</span> | A branch is 41 bytes; HEAD is a pointer to a pointer |
| 07 | **[The commit graph is a DAG](07-commit-graph.md)** | <span className="db-tier t-master">Master</span> | Parents define order, timestamps do not |
| 08 | **[Config layers and precedence](08-config-layers.md)** | <span className="db-tier t-understand">Understand</span> | Five layers, last wins; `--show-origin` ends every argument |
| 09 | **[A tour of `.git/`](09-git-directory-tour.md)** | <span className="db-tier t-understand">Understand</span> | Ten entries, and you have already met most of them |
| 10 | **[Identity and first-run setup](10-identity-setup.md)** | <span className="db-tier t-understand">Understand</span> | Why Git refuses to commit, and a defensible starting config |
| 11 | **[Loose objects and packfiles](11-loose-objects-and-packfiles.md)** | <span className="db-tier t-understand">Understand</span> | 51 objects at 204K packed to 6.03 KiB |
| 12 | **[What Git is not](12-what-git-is-not.md)** | <span className="db-tier t-understand">Understand</span> | Not a backup, deploy tool, secret store or binary store |
| 13 | **[SHA-1, SHA-256 and object format](13-object-format.md)** | <span className="db-tier t-know">Know</span> | SHA-256 works, and cannot talk to SHA-1 |
| 14 | **[Plumbing versus porcelain](14-plumbing-vs-porcelain.md)** | <span className="db-tier t-know">Know</span> | 46 porcelain commands of 172; scripts target the other layer |

## What the measurements changed

Five things on these pages contradict what is commonly said about Git, and each
came from a run rather than from recollection:

1. **`git init` still creates `master` on 2.55.0.** The hint says the default
   changes in Git 3.0. "Git defaults to `main` now" is false.
2. **A branch really is 41 bytes and zero new objects** — measured with `wc -c`
   and an unchanged object count, which is the concrete reason branching is free.
3. **The object name is reproducible without Git**:
   `printf 'blob 6\0hello\n' | sha1sum` gives the same hash `git hash-object`
   does. The filename is not part of it.
4. **A commit dated 2030 sits happily beneath one dated 2026** — ancestry, not
   timestamps, defines order.
5. **`git gc` produced two packfiles, not one.** The second is a cruft pack
   (`.mtimes`), holding unreachable objects for a grace period — which is why a
   rewritten repository does not shrink immediately.

## Phase gate

Move on when you can point at a file and say which object holds its bytes, which
holds its name, and what would change inside `.git/` if you staged it — before
running anything.

## Where this connects

- **→ Phase 1** — the three trees are what `add`, `commit`, `restore` and
  `reset` move between; that phase is this model applied to the daily loop.
- **→ Phase 2** — rebasing produces new hashes because a commit hashes its
  parents. Nothing about rebase is surprising once page 01 is understood.
- **→ Phase 5** — recovery works because objects outlive the refs that named
  them, and because the reflog records every ref movement.
- **→ Phase 7** — "history is permanent and cumulative" is why a committed
  secret or binary is an incident rather than a mistake.
- **→ Phase 10** — that phase re-proves this one with plumbing, and goes into
  packfiles, the index format and reftable properly.

---

← [Syllabus: Part 1](../../syllabus/01-how-git-works.md) · Start → [What Git actually is](01-what-git-is.md)
