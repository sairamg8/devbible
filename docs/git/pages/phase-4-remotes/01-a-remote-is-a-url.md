---
title: "A remote is a named URL, nothing more"
sidebar_label: "01 · A remote is a URL"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-remote`, `man git-config`
> (`remote.<name>.url`, `remote.<name>.fetch`), `man git-clone`.
> **Documentation-validated, not sandbox-proven.**

**`origin` is not a keyword. It is a name in your config pointing at a URL, plus a
refspec saying where fetched branches get filed. Everything about remotes follows
from that: there is no central server in Git's model, only repositories that know
each other's addresses.**

## What a remote is made of

```bash
git remote -v                 # names and URLs
git remote show origin        # what Git knows, including a network round trip
git config --get-regexp '^remote\.'
```

A remote is two or three config entries:

```ini
[remote "origin"]
    url = git@github.com:you/project.git
    fetch = +refs/heads/*:refs/remotes/origin/*
```

The `fetch` line is a **refspec**: "take every branch on the remote and file it
under `refs/remotes/origin/`". The leading `+` means "allow non-fast-forward
updates to these", which is why `origin/main` can move backwards when someone
force-pushes without your fetch failing.

`origin` is the name `git clone` happens to use. Nothing in Git requires it, and
`git remote rename origin upstream` breaks nothing.

## Managing remotes

```bash
git remote add upstream https://github.com/original/project.git
git remote rename origin github
git remote remove old-server
git remote set-url origin git@github.com:you/project.git
git remote get-url origin
```

`set-url` is the command for switching a clone from HTTPS to SSH — no re-clone
needed, since the objects are already local and only the address changes.

Multiple remotes are normal. The fork workflow is `origin` (your fork) plus
`upstream` (the original), and nothing about Git treats one as more real.

## Remote-tracking branches

After a fetch you have `refs/remotes/origin/main` — a local ref recording **where
`origin/main` was when you last fetched**. It is:

- **local** — reading it involves no network;
- **read-only in practice** — you cannot commit onto it, and Git will not let you
  check it out as a branch (you get a detached HEAD, or an automatic local branch
  via `--guess`);
- **as stale as your last fetch**.

That last point is the source of the most common daily confusion. `git status`
saying *"your branch is behind origin/main by 3 commits"* is a statement about
your **last fetch**, not about the remote right now. Nothing in `status`, `log` or
`diff` ever contacts the network.

```bash
git branch -r                 # remote-tracking branches
git branch -a                 # local + remote-tracking
```

## Cloning is just this, set up for you

`git clone <url>` does, in order: create a repository, add a remote called
`origin` with that URL and the standard refspec, fetch everything, create a local
branch matching the remote's HEAD, and set it to track.

Useful flags:

| Flag | Effect |
|---|---|
| `-b <branch>` | Check out that branch instead of the remote's default |
| `-o <name>` | Call the remote something other than `origin` |
| `--depth <n>` | Shallow clone — only the last *n* commits |
| `--filter=blob:none` | Partial clone — commits and trees now, file contents on demand |

`--depth` is worth knowing for CI, where clone time matters and history does not.
Be aware it breaks anything needing history: `git log` past the cutoff, `blame`,
`describe`, and merge-base calculations. `git fetch --unshallow` converts back.

## The transports

| Form | Looks like | Auth |
|---|---|---|
| SSH | `git@github.com:you/project.git` | SSH key |
| HTTPS | `https://github.com/you/project.git` | Token via a credential helper |
| Local | `/srv/git/project.git` or `file:///…` | Filesystem permissions |

**SSH versus HTTPS is a credentials decision, not a capability one.** Both do
everything. SSH needs a key registered with the host and works well when you push
often; HTTPS uses a personal access token stored by a credential helper and gets
through corporate proxies that block port 22.

```bash
git config --global credential.helper store        # plaintext in ~/.git-credentials
git config --global credential.helper libsecret    # a real keyring, on Linux
```

⚠️ `store` writes the token in **plain text**. It is fine on a personal machine you
control and a bad idea on anything shared. Prefer a keyring-backed helper, or the
platform ones (`osxkeychain`, `manager` on Windows).

Note that a **password is never the answer** on the major hosts any more — GitHub
and GitLab require a personal access token or SSH key, and a token is what you
paste when HTTPS prompts for a password.

## What `git remote show` costs

```bash
git remote show origin        # contacts the remote
git remote show -n origin     # does not
```

`git remote show` is one of the few remote commands that makes a network call
without transferring objects. It reports which local branches track which remote
ones, and which remote branches are stale — useful, but not free, and it will hang
on an unreachable host.

## Trade-off

**Git is decentralised in its model and centralised in every workflow anyone
actually uses, and the mismatch shows up as vocabulary.**

Technically there is no server: `origin` is a name, any repository can be a
remote, and you can add three of them and push to whichever you like. That design
is why forks, air-gapped transfers and peer-to-peer flows all work with no special
support.

In practice every team has one repository that is authoritative, called `origin`,
hosted by a company, with permissions and CI attached. Git has no concept of that
authority, so it cannot help with the questions that follow: what is the real
branch, who may push to it, what happens when two people disagree. Those live
entirely in the host's UI, and they are the source of most of the confusion around
`main` versus `origin/main` — the one Git can only tell you about as of your last
fetch.

The practical consequence is worth internalising rather than resolving: **your
repository's opinion about the remote is always a cache.** Fetch before you
conclude anything about what someone else has done.

## Gotchas

**Symptom:** `git status` says you are behind, but a colleague insists they pushed nothing
**Cause:** `status` compares against `origin/main`, which is a local cache from your last fetch
**Fix:** `git fetch` first. Nothing in `status`, `log` or `diff` ever touches the network

**Symptom:** `git push` asks for a password and rejects yours
**Cause:** the major hosts stopped accepting account passwords over HTTPS; a personal access token is what goes in that field
**Fix:** create a token and let a credential helper store it, or switch to SSH with `git remote set-url`

**Symptom:** you cloned with `--depth 1` and `git log`, `blame` or a merge fails
**Cause:** the history is truncated, so ancestry questions cannot be answered
**Fix:** `git fetch --unshallow`. Use `--depth` only where history genuinely is not needed

**Symptom:** you cannot commit on `origin/main`
**Cause:** it is a remote-tracking ref, not a branch. It records where the remote was
**Fix:** `git switch main` (or `git switch -c local-name origin/main`) and commit there

**Symptom:** your token is sitting in plain text in `~/.git-credentials`
**Cause:** `credential.helper store` does exactly that, as documented
**Fix:** switch to a keyring-backed helper — `libsecret`, `osxkeychain`, `manager`

**Symptom:** `origin/main` moved backwards
**Cause:** someone force-pushed, and the standard refspec's leading `+` permits non-fast-forward updates to remote-tracking refs
**Fix:** expected. Whether it was legitimate is [the golden rule](../phase-2-branching-merging/08-the-golden-rule.md)'s question

---

← Prev: [Phase 4 index](README.md) · Next → [`fetch` versus `pull`](02-fetch-vs-pull.md)
