---
title: "The commit graph is a DAG, not a timeline"
sidebar_label: "07 · The commit graph"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, section 9.

**Commits point backwards at their parents, and that pointer — not the
timestamp — defines order. "Before" in Git means *reachable from*, which is why
a commit dated 2030 can sit happily beneath one dated 2026, and why history is a
directed acyclic graph rather than a list.**

## Parents define the shape

```console
$ git log --format="%h %p %ad %s" --date=short
69dccb0 107d816 2026-08-13 Second commit
107d816  2026-08-13 Add greeting and math helper
```

The second column is the parent. `69dccb0`'s parent is `107d816`; `107d816` has
none, so it is a root commit. Nothing points *forward* — Git can walk from a
commit to its ancestors, never to its children, which is why `git log` starts at
HEAD and works backwards, and why finding a commit's children requires scanning
the whole graph.

Parent count classifies every commit:

| Parents | Kind |
|---|---|
| 0 | Root commit (the first, or one created with `--orphan`) |
| 1 | Ordinary commit |
| 2+ | Merge commit — the second parent is the branch that was merged in |

## Dates are metadata, not structure

The proof: commit with an author date in 2030 and it still lands as a child of a
2026 commit.

```console
# a commit with a FUTURE author date is still the child of its parent
87f476c 2030-01-01 Dated 2030, still a child
69dccb0 2026-08-13 Second commit
107d816 2026-08-13 Add greeting and math helper
$ git log --format="%h %s" --reverse   # ancestry order, not date order
107d816 Add greeting and math helper
69dccb0 Second commit
87f476c Dated 2030, still a child
```

`--reverse` walks ancestry from the root forward, and the 2030 commit is last
because it is the newest *descendant* — not because of its date. Timestamps come
from the committer's clock, which can be wrong, skewed by a timezone, or set
deliberately (as here, with `GIT_AUTHOR_DATE`). **Never build logic on commit
dates.** Use ancestry: `git merge-base --is-ancestor A B`.

This is also why `git log` on a merged history can look out of order. It sorts
by date *within* the constraints of the graph, so commits from a long-running
branch appear interleaved by their original dates.

## Counting and reachability

```console
$ git rev-list --count HEAD
2
```

`rev-list` is the reachability engine underneath almost everything: `log`,
`fetch` negotiation, and garbage collection all reduce to "which objects can be
reached from these refs". The commit *count* is not a version number — it
depends entirely on which ref you count from, and rebasing or squashing changes
it.

The everyday consequences:

| Question | Answered by |
|---|---|
| Is this fix in the release? | `git merge-base --is-ancestor <fix> v2.1` |
| What is on my branch but not main? | `git log main..mybranch` |
| Where did these two branches diverge? | `git merge-base main mybranch` |
| Which commits are unreachable? | `git fsck --unreachable` |

`main..mybranch` is a reachability expression, not a date range — it means
"reachable from `mybranch`, not from `main`". Understanding it as graph
arithmetic rather than "commits since" is what makes ranges stop being
confusing.

## Trade-off

**A DAG is honest about parallel work, and it costs you a simple linear
narrative.**

Because merges are first-class, the graph records exactly what happened: two
lines of work existed simultaneously and were joined. Nothing is falsified. The
price is that "what happened in what order" has no single answer — `git log`
must impose an order that does not really exist, `git bisect` has to handle
branching, and a history with many merges genuinely is harder to read.

That tension is the whole rebase-versus-merge argument (Phase 2): rebasing
flattens the graph into a readable line at the cost of rewriting what actually
happened; merging keeps the truth at the cost of readability. Neither is
correct in general — but knowing that the graph is the real data structure is
what makes the choice informed rather than cargo-culted.

## Gotchas

**Symptom:** `git log` shows commits in an order that seems wrong
**Cause:** it sorts by commit date within graph constraints, and merged branches carry their original dates
**Fix:** `--topo-order` for strict ancestry order, `--first-parent` to read the trunk only, `--graph` to see the shape

**Symptom:** a commit appears to be "in the future", or `log` output jumps
**Cause:** author and committer dates come from whatever clock made them — they can be skewed, wrong, or set explicitly
**Fix:** never trust dates for ordering. Use `git merge-base --is-ancestor` for "is this included?"

**Symptom:** you cannot find a commit's children
**Cause:** the graph only stores parent pointers; there is no child link
**Fix:** scan for it — `git rev-list --all --children <sha>` or `git log --all --ancestry-path <sha>..`

**Symptom:** commit counts differ between two clones of the same project
**Cause:** counts depend on the ref you count from, and rebases/squashes change them
**Fix:** never use `rev-list --count` as a version. Use tags plus `git describe`

## Interview questions

**★ What defines the order of commits in Git?**
Parent pointers — reachability, not timestamps. Demonstrated above: a commit
dated 2030-01-01 is still a child of a 2026 commit, and `--reverse` lists it
last because it is the newest descendant.

**★ Why is Git history a DAG rather than a tree or a list?**
Directed because parent pointers go one way, acyclic because a commit's hash
includes its parents (so a cycle is unconstructible), and a graph rather than a
list because merge commits have multiple parents.

**★ What does `git log main..feature` actually mean?**
Commits reachable from `feature` but not from `main`. It is set arithmetic on
reachability, not a date range — which is why it still works correctly after
either branch has moved.

**★ How do you check whether a bugfix is included in a release?**
`git merge-base --is-ancestor <fix> <tag>` — it answers by reachability and
exits 0 if the fix is an ancestor. Searching the log by date or message can miss
cherry-picks and rebases.

**Why can't Git tell you a commit's children directly?**
Only parent pointers are stored, so children can only be found by walking the
graph — `git rev-list --all --children`. Storing child links would break
immutability: a commit's hash would have to change whenever a new child appeared.

**What does the second parent of a merge commit represent?**
The branch that was merged *in*; the first parent is the branch you were on.
That ordering is what `--first-parent` exploits to read a trunk history without
every feature branch's internal commits.

---

← Prev: [Refs and HEAD](06-refs-and-head.md) · Next → [Config layers and precedence](08-config-layers.md)
