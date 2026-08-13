---
title: "Config layers and precedence"
sidebar_label: "08 · Config layers"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Scripts:
> `sandbox/git-p0/ex2-object-model.sh` section 12;
> `sandbox/git-p0/ex1-version-facts.sh` section 7.

**Git config is read from several files in a fixed order, and the last one to
set a key wins. When a setting "isn't taking effect", the answer is never a
guess — `git config --show-origin --show-scope` names the exact file that won.**

## The layers, lowest to highest precedence

| Scope | Location | Applies to |
|---|---|---|
| `system` | `/etc/gitconfig` | Every user on the machine |
| `global` | `~/.gitconfig` or `~/.config/git/config` | Your user, all repositories |
| `local` | `.git/config` | This repository |
| `worktree` | `.git/config.worktree` | One linked worktree, if enabled |
| `command` | `git -c key=value …` | A single command |

A later scope overrides an earlier one for the same key. Nothing merges: for a
single-valued key, one file's value wins outright.

## Ask, don't guess

```console
$ git config --list --show-origin --show-scope | grep user.email
local	file:.git/config	user.email=work@example.com
$ git -c user.email=once@example.com config --show-scope user.email
command	once@example.com
```

Two flags worth remembering permanently: `--show-scope` names the layer,
`--show-origin` names the file. Together they turn "why is my commit attributed
to the wrong address?" into a one-line answer.

`--list` shows everything. `git config <key>` shows one key's winning value, and
`git config --get-all <key>` shows every value when a key is multi-valued (as
`remote.origin.fetch` and `include.path` can be).

## Unset does not mean unused

```console
  init.defaultBranch       (unset)
  pull.rebase              (unset)
  push.default             (unset)
  merge.conflictstyle      (unset)
  core.autocrlf            (unset)
  fetch.prune              (unset)
  diff.algorithm           (unset)
```

Every one of those is unset in a fresh repository, and every one still has
behaviour — Git's built-in default. That distinction matters because the
built-in default sometimes differs from what your team assumes:

- **`init.defaultBranch` unset** means `master`, not `main`, on 2.55.0 — with a
  hint saying the default changes in Git 3.0. See
  [what Git is not](12-what-git-is-not.md) and the syllabus version table.
- **`pull.rebase` and `pull.ff` unset** means a divergent `git pull` **fails**
  rather than picking one. That is deliberate: Git refuses to guess which
  history shape you want.

So "we never configured it" is not the same as "it does nothing", and reading a
default off a colleague's machine tells you about their config, not about Git.

## Writing config deliberately

```bash
git config --global user.name "Your Name"        # your user, everywhere
git config --global init.defaultBranch main      # stop the master/main hint
git config --local user.email work@example.com   # this repo only
git config --global --edit                       # open the file itself
```

Two habits worth adopting early:

**Per-repository identity.** If a work and a personal account share one machine,
set `user.email` per repository — or use `includeIf` to switch it by directory:

```ini
# ~/.gitconfig
[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work
```

**Never commit a token into config.** `.git/config` holds remote URLs; a URL
with an embedded token (`https://user:token@host/…`) sits in a plaintext file
and is easy to leak while sharing a repository. Use a credential helper
(Phase 4).

## Trade-off

**Layered config is flexible, and it is why config problems are confusing.**

Any key can come from five places, and per-repository overrides are exactly what
you want for identity and remotes. The cost is that a wrong value can hide in a
file you have never opened — a system config set by your distribution, a
`~/.gitconfig` copied from a colleague years ago, or a `.git/config` written by
a tool. Guessing produces a long afternoon; `--show-origin` produces an answer
in one command.

## Gotchas

**Symptom:** `git config --global` changes have no effect
**Cause:** a local `.git/config` sets the same key and outranks global
**Fix:** `git config --list --show-origin --show-scope | grep <key>` — the last line wins. Set or unset at the layer you actually intend

**Symptom:** commits are attributed to the wrong email
**Cause:** global identity applied where a repository-specific one was intended
**Fix:** `git config --local user.email …`, and `git commit --amend --reset-author` to fix the last commit. Prevention: `includeIf` by directory

**Symptom:** a teammate's Git behaves differently on identical commands
**Cause:** unset keys use built-in defaults; their machine has some of them set
**Fix:** compare with `--show-scope`. Commit a documented recommended config to the repo — it cannot be enforced, but it can be shared

**Symptom:** a token ended up in a public place
**Cause:** the remote URL with an embedded credential lives in plaintext `.git/config`
**Fix:** rotate it, switch the remote to SSH or a credential helper. See the secret-removal procedure in Phase 5

## Interview questions

**★ In what order does Git read configuration?**
system → global → local → worktree → `-c` on the command line, each overriding
the previous for the same key. `--show-scope` prints which one supplied a value.

**★ How do you find out why a setting is not taking effect?**
`git config --list --show-origin --show-scope`, filtered to the key. It names
both the layer and the file, so there is no need to guess which of five files
won.

**★ Does an unset config key mean the behaviour is undefined?**
No — it means Git's built-in default applies. On 2.55.0 an unset
`init.defaultBranch` produces `master`, and an unset `pull.rebase` makes a
divergent pull fail outright rather than choosing for you.

**How would you use different identities for work and personal repositories?**
`includeIf "gitdir:~/work/"` in `~/.gitconfig` pointing at a second file that
sets `user.email`. It applies by directory, so no per-repository setup is
needed and no commit gets the wrong address by accident.

**Why is a remote URL containing a token risky?**
It is stored in plaintext in `.git/config`, which is easy to expose when sharing
a repository or a container image. Credential helpers keep the secret out of the
repository entirely.

---

← Prev: [The commit graph is a DAG](07-commit-graph.md) · Next → [A tour of .git/](09-git-directory-tour.md)
