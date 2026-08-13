---
title: "Plumbing versus porcelain"
sidebar_label: "14 · Plumbing vs porcelain"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Scripts:
> `sandbox/git-p0/ex1-version-facts.sh` section 2;
> `sandbox/git-p0/ex2-object-model.sh` section 13.

**Git ships two command layers: porcelain for humans, whose output is allowed to
change between versions, and plumbing for scripts, whose output is a contract.
Scripting against porcelain is the reason automation breaks on upgrade.**

## The surface, counted

```console
main commands (git help -a, first section): 46
total commands on PATH:                    172
```

46 commands in the "Main Porcelain" section; **172** git executables in total.
The remaining ~126 are plumbing, ancillary commands and interactive helpers —
most of which you will never type, and several of which run every time you do
type something.

## Doing `git commit`'s job by hand

Four plumbing commands, no porcelain:

```console
blob   = a4379ca776a504350a29e5cb7b7125156051d466
tree   = e5d1d6a334b32f833bbff720d07b4acac8576908
commit = 45c50f31a190cd2cfa4d8cb3f2610a5b0fa01d75
$ git cat-file -p $commit
tree e5d1d6a334b32f833bbff720d07b4acac8576908
parent 2fa89ac4afc1da87555bc8c1a6275c7815defb4f
author dev <dev@example.com> 1786615200 +0000
committer dev <dev@example.com> 1786615200 +0000

Made with plumbing only
$ git log --oneline -1 $commit   # a real commit, reachable from no branch
45c50f3 Made with plumbing only
```

The commands behind it:

```bash
blob=$(printf 'built by hand\n' | git hash-object -w --stdin)
tree=$(printf '100644 blob %s\thandmade.txt\n' "$blob" | git mktree)
commit=$(git commit-tree "$tree" -p HEAD -m "Made with plumbing only")
# git update-ref refs/heads/main "$commit"   ← the step that would publish it
```

That is a genuine commit, indistinguishable from one `git commit` would make.
It is reachable from no branch because the last step was omitted — which
demonstrates the split precisely: **plumbing does exactly what you asked and
nothing else.** Porcelain's job is to bundle those four steps, plus hooks,
message editing, `status` output and safety checks, into one convenient command.

## Which is which

| Layer | Examples | Output | Use for |
|---|---|---|---|
| **Porcelain** | `status`, `log`, `add`, `commit`, `checkout`, `branch` | Human-readable, may change between versions | Typing |
| **Plumbing** | `rev-parse`, `cat-file`, `hash-object`, `ls-files`, `ls-tree`, `rev-list`, `update-ref`, `for-each-ref`, `mktree`, `commit-tree` | Stable, machine-readable | Scripts, hooks, CI |

`git help -a` groups them, and each command's man page states which it is.

## Scripting rules that follow

**Never parse porcelain output.** `git status` phrasing, `git branch`'s asterisk
and `git log`'s default format are all presentation, not API.

```bash
# Fragile — parses human output
git branch | grep '^\*' | cut -c3-

# Stable — a documented plumbing contract
git rev-parse --abbrev-ref HEAD
```

Some useful equivalents:

| Question | Plumbing answer |
|---|---|
| What branch am I on? | `git rev-parse --abbrev-ref HEAD` |
| What is HEAD's full hash? | `git rev-parse HEAD` |
| Am I inside a repository? | `git rev-parse --is-inside-work-tree` |
| Is the tree clean? | `git status --porcelain` (empty output = clean) |
| Is A an ancestor of B? | `git merge-base --is-ancestor A B` (exit code) |
| List every ref with its target | `git for-each-ref --format='%(refname) %(objectname)'` |
| Which files are staged? | `git diff --cached --name-only` |

**`git status --porcelain` is the exception that proves the rule:** the flag
exists precisely because people were parsing human output, and it provides a
stable format that is explicitly versioned (`--porcelain=v2`). Prefer exit codes
where they exist — `merge-base --is-ancestor` answers with status 0 or 1 and
prints nothing, which is unbreakable.

## Trade-off

**Two layers means Git can improve its human interface without breaking every
script — and it means twice as much surface to learn.**

Porcelain changes freely: `git switch` and `git restore` split `git checkout`
in half precisely because the human interface was confusing. None of that
disturbed automation, because automation was supposed to be on plumbing. The
cost is 172 commands, a manual whose plumbing pages are dense and
example-poor, and a genuine trap for anyone who reasonably assumes that a
command they can type is a command they can script.

## Gotchas

**Symptom:** a shell script or CI job broke after a Git upgrade
**Cause:** it parsed porcelain output, which carries no stability guarantee
**Fix:** move to plumbing — `rev-parse`, `for-each-ref`, `status --porcelain`, or exit codes

**Symptom:** a script misbehaves when the repository is in a detached HEAD
**Cause:** `git rev-parse --abbrev-ref HEAD` returns the literal `HEAD` there, and the script assumed a branch name
**Fix:** handle it explicitly — compare against `HEAD`, or use `git symbolic-ref -q HEAD` which fails cleanly when detached

**Symptom:** a script behaves differently for a colleague
**Cause:** their aliases or config change porcelain output — `log.date`, `status.short`, colour settings, custom formats
**Fix:** plumbing is unaffected by most of these; for extra safety, run with `git -c` overrides or `--no-pager`

**Symptom:** `git commit` inside a hook or automation behaves unexpectedly
**Cause:** porcelain runs hooks, opens editors and applies config; that is its job
**Fix:** use `commit-tree` plus `update-ref` when you want exactly one thing to happen and nothing else

## Interview questions

**★ What is the difference between plumbing and porcelain?**
Porcelain is the human-facing command set whose output may change between
versions; plumbing is the low-level, stable, machine-readable layer. Scripts
should target plumbing. Measured: 46 main porcelain commands out of 172 git
commands on `PATH`.

**★ Why should scripts not parse `git status` or `git branch`?**
Their output is presentation and carries no compatibility guarantee — and it is
affected by the user's config and aliases. Use `git status --porcelain`,
`git rev-parse --abbrev-ref HEAD`, or exit codes such as
`git merge-base --is-ancestor`.

**★ Which plumbing commands would you use to create a commit by hand?**
`hash-object -w` to store content, `mktree` (or `update-index` + `write-tree`)
to build the tree, `commit-tree` to create the commit, and `update-ref` to point
a branch at it. Demonstrated above — omitting the last step leaves a valid
commit reachable from no branch.

**How do you reliably ask "is the working tree clean?" in a script?**
`git status --porcelain` and test for empty output. The `--porcelain` flag
exists specifically to give a stable, parseable format, and it is versioned.

**What does `git commit` do that `commit-tree` does not?**
Runs hooks, opens an editor for the message, applies config such as signing and
identity, uses the index rather than a tree you supply, and moves the current
branch. `commit-tree` creates one object and does nothing else.

---

← Prev: [SHA-1, SHA-256 and object format](13-object-format.md) · [Phase index](README.md) · Next phase → [Phase 1 — The everyday loop](../../syllabus/01-how-git-works.md)
