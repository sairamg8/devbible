---
title: "Phase 4 — Remotes and syncing"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** This phase is **documentation-validated**, not
> sandbox-proven: claims are checked against `git help <cmd>` on 2.55.0, and each
> page names its sources on its `> Verified:` line. The one console block — the
> divergent-branches `fatal:` — is recorded output from
> `sandbox/git-p0/ex1-version-facts.sh`.

What `origin` is, what `pull` really runs, and how to push without destroying a
colleague's work. **Everything in this phase exists because someone else has
commits you do not** — and the recurring theme is that your repository's opinion
about the remote is always a cache, refreshed only by `fetch`.

**8 topics**, after the 2026-08-14 re-scope to daily-driver Git.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[A remote is a named URL](01-a-remote-is-a-url.md)** | <span className="db-tier t-master">Master</span> | Two config lines and a refspec; `origin` is not a keyword |
| 02 | **[`fetch` versus `pull`](02-fetch-vs-pull.md)** | <span className="db-tier t-master">Master</span> | Fetch downloads; pull downloads **and changes your branch** |
| 03 | **[Remote-tracking branches](03-remote-tracking-branches.md)** | <span className="db-tier t-understand">Understand</span> | `origin/main` is a cache; pruning, and the `: gone]` marker |
| 04 | **[Upstream tracking](04-upstream-tracking.md)** | <span className="db-tier t-understand">Understand</span> | Where "ahead 2, behind 3" comes from; `@{u}`, `push.autoSetupRemote` |
| 05 | **[Divergent branches](05-divergent-branches.md)** | <span className="db-tier t-master">Master</span> | Git refuses to guess — and the fake divergence that means someone rewrote |
| 06 | **[Force-pushing safely](06-force-pushing-safely.md)** | <span className="db-tier t-master">Master</span> | `--force-with-lease`, and the background-fetch hole `--force-if-includes` closes |
| 07 | **[`git push` in full](07-git-push.md)** | <span className="db-tier t-understand">Understand</span> | Refspecs, `push.default`, tags not travelling, `--atomic` |
| 08 | **[Transports and credentials](08-transports-and-credentials.md)** | <span className="db-tier t-understand">Understand</span> | SSH vs HTTPS as a credentials decision; helpers, and `insteadOf` |

## Coverage

✅ **PHASE COMPLETE — 8 of 8 topics, 9 files, 1,428 lines.**

## What was cut on 2026-08-14

This phase was 16 topics. Eight are parked as beyond daily use: **refspecs in
full** (the essentials are in topics 01 and 07), **fork-and-upstream flow** (the
two settings that implement it are in topic 04), **shallow clones** and **partial
clone** (both introduced in topic 01), **signing**, **bare and mirror
repositories**, and **`git bundle`**. Pruning is folded into topic 03.

## The settings this phase argues for

| Setting | Why |
|---|---|
| `pull.ff = only` | A pull never invents a merge commit; it fails and you decide |
| `fetch.prune = true` | Deleted remote branches stop accumulating locally |
| `push.autoSetupRemote = true` | No more `git push -u origin <name>` on every new branch |
| `push.default = simple` | Already the default — it refuses when local and upstream names differ |
| `alias.pushf = push --force-with-lease --force-if-includes` | There is no config to make `--force` safe; an alias is the answer |

## Gate — move on when

Your branch and `origin/main` have diverged and you can state, **before typing
anything**, which of merge, rebase or fast-forward-only you want, what the
resulting graph looks like, and whether the push after it needs a lease.

## Where this phase connects

- **Back to [Phase 2](../phase-2-branching-merging/README.md)** — "shared history"
  stops being an abstraction here. The golden rule is what
  [force-pushing](06-force-pushing-safely.md) is constrained by, and divergence is
  merge-versus-rebase with a network attached.
- **Back to [Phase 1](../phase-1-everyday-loop/README.md)** — `git status`'s
  ahead/behind line is the upstream comparison, and it never touches the network.
- **Forward to Phase 5** — `revert` is what you use instead of a force-push on
  anything protected or shared.

---

← [Phase 2 — Branching, merging and rebasing](../phase-2-branching-merging/README.md) ·
Start → [A remote is a named URL](01-a-remote-is-a-url.md)
