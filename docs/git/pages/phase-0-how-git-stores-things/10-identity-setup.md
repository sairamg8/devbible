---
title: "Identity and the first-run setup"
sidebar_label: "10 · Identity and setup"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex1-version-facts.sh`, sections 4, 7 and 10.

**Git will not create a commit without knowing who is making it, because author
and committer are part of the commit object and therefore part of its hash. On a
fresh machine this is the first thing that stops you — and the error text tells
you exactly what to run.**

## The failure, in full

```console
Author identity unknown

*** Please tell me who you are.

Run

  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"

to set your account's default identity.
Omit --global to set the identity only in this repository.
```

This is not a warning — the commit does not happen. Identity is not metadata
attached afterwards; it is two of the five fields in the commit object
([page 03](03-object-types.md)), so there is nothing to hash without it.

Git guesses from the username and hostname only when it can, and refuses when
the guess would be meaningless — which is the correct behaviour, because a
commit attributed to `dev@laptop.local` is worse than no commit.

## Setting it

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The email is the identifier that matters: hosting platforms match commits to
accounts by it, and a commit made with an address your account does not own will
not be attributed to you.

### Per-repository identity, when one machine has two lives

```bash
git config --local user.email "work@example.com"    # this repository only
```

Or switch automatically by directory, which is less error-prone than remembering
per repository:

```ini
# ~/.gitconfig
[user]
    name = Your Name
    email = personal@example.com

[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
```

```ini
# ~/.gitconfig-work
[user]
    email = work@example.com
```

Anything cloned under `~/work/` commits with the work address; everything else
uses the personal one. Verify with
`git config --show-scope user.email` ([page 08](08-config-layers.md)).

## The second thing every fresh machine should set

```console
hint: Using 'master' as the name for the initial branch. This default branch name
hint: will change to "main" in Git 3.0. To configure the initial branch name
hint: to use in all of your new repositories, which will suppress this warning,
hint: call:
hint:
hint: 	git config --global init.defaultBranch <name>
```

On **2.55.0 the default is still `master`**, and Git says the change lands in
3.0. Every host now creates `main` by default, so a fresh clone-and-push
mismatch is common. Set it once:

```bash
git config --global init.defaultBranch main
```

## A defensible starting config

Every line here is a decision, not a preference — the reasoning is in the phase
each one points at:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main      # match every host's default
git config --global pull.ff only                 # refuse to guess on divergence (Phase 4)
git config --global push.autoSetupRemote true    # first push needs no -u
git config --global fetch.prune true             # drop refs deleted on the server
git config --global rebase.autostash true        # stash/restore around a rebase
git config --global merge.conflictstyle zdiff3   # show the original in conflicts (Phase 2)
git config --global rerere.enabled true          # remember conflict resolutions
```

`pull.ff only` is the opinionated one. With `pull.rebase` and `pull.ff` unset, a
divergent `git pull` **fails** with `fatal: Need to specify how to reconcile
divergent branches` — measured in Phase 4. Setting `ff only` keeps that refusal
but makes the common case (nothing local to reconcile) silent, so you decide
merge-or-rebase deliberately when it actually happens.

## Trade-off

**Identity in Git is asserted, not authenticated.**

`user.email` is whatever you type. Anyone can commit as anybody — the field is
free text, and Git checks nothing. That is why author and committer are useful
as a record of *intent* and useless as proof: the audit value comes from the
host's push authentication, and cryptographic proof requires signed commits
(Phase 4). Treat the name on a commit as a label, not evidence.

## Gotchas

**Symptom:** `Author identity unknown` on a new machine or in a container
**Cause:** no `user.name` / `user.email` in any config layer
**Fix:** set them globally; in CI, set them per job or per command with `-c user.email=…`

**Symptom:** commits do not link to your profile on the host
**Cause:** the commit email is not one your account owns
**Fix:** add the address to your account, or fix the config and `git commit --amend --reset-author` for the latest commit

**Symptom:** work commits carry your personal address
**Cause:** only the global identity was ever set
**Fix:** `includeIf "gitdir:~/work/"` as above. Check with `git config --show-scope user.email` before the first commit in a new clone

**Symptom:** `git init` makes `master` while the host expects `main`
**Cause:** on 2.55.0 the built-in default is still `master` — the hint says it changes in Git 3.0
**Fix:** `git config --global init.defaultBranch main`; rename an existing one with `git branch -m main`

## Interview questions

**★ Why does Git refuse to commit without an identity?**
Because author and committer are fields inside the commit object, and the object
cannot be hashed without them. It is a hard failure, not a warning — no commit
is created.

**★ Does Git verify who you say you are?**
No. `user.email` is free text and Git checks nothing, so commit authorship is an
assertion. Authentication happens at push time on the host, and cryptographic
proof of authorship needs signed commits.

**★ What is the difference between author and committer?**
Author is who wrote the change; committer is who created this particular commit
object. Rebasing, cherry-picking or applying someone's patch preserves the
author and records you as committer.

**★ Does `git init` create `main` or `master`?**
On 2.55.0, `master` — with a hint that it changes in Git 3.0. Set
`init.defaultBranch main` to match what every host now creates.

**How do you keep work and personal identities separate on one machine?**
`includeIf "gitdir:~/work/"` in the global config, pointing at a file that
overrides `user.email`. It applies by directory, so no per-repository step is
needed and no commit gets the wrong address by accident.

**You committed with the wrong email. What now?**
For the most recent commit, `git commit --amend --reset-author`. For a range,
either a rewrite (Phase 11) or a `.mailmap`, which corrects how names are
displayed without touching a single commit.

---

← Prev: [A tour of .git/](09-git-directory-tour.md) · Next → [Loose objects and packfiles](11-loose-objects-and-packfiles.md)
