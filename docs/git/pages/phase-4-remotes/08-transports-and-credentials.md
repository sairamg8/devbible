---
title: "Transports and credentials"
sidebar_label: "08 · Transports and credentials"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man gitcredentials`,
> `man git-credential`, `man git-config` (`credential.helper`,
> `url.<base>.insteadOf`), `man git-remote` (`set-url`).
> **Documentation-validated, not sandbox-proven.** Host-specific policies (token
> types, key registration) are stated as host behaviour, not Git behaviour.

**SSH and HTTPS both do everything Git can do. The choice is entirely about how
you authenticate and what your network allows. Most "Git won't let me push"
problems are credential problems wearing Git's error message.**

## The two you will use

| | SSH | HTTPS |
|---|---|---|
| URL | `git@github.com:you/project.git` | `https://github.com/you/project.git` |
| Auth | A key pair; the public half registered with the host | A **personal access token**, stored by a credential helper |
| Setup | Generate a key, add it to the host, done | Paste a token once; the helper remembers |
| Through strict proxies | Often blocked (port 22) | Usually fine (port 443) |
| Prompts | None once the agent has the key | None once the helper has the token |

Neither is more capable. Pick SSH if you push often from a machine you control;
HTTPS if the network is restrictive or you are on a shared or temporary machine.

Switching costs nothing — the objects are already local, only the address changes:

```bash
git remote set-url origin git@github.com:you/project.git
git remote -v      # confirm
```

## SSH, in the four commands that matter

```bash
ssh-keygen -t ed25519 -C "you@example.com"    # generate (ed25519, not RSA)
cat ~/.ssh/id_ed25519.pub                     # the PUBLIC half — this is what you paste
ssh-add ~/.ssh/id_ed25519                     # load into the agent
ssh -T git@github.com                         # test; expect a "successfully authenticated" message
```

`ed25519` is the modern default and produces short keys. ⚠️ Only ever paste the
`.pub` file. The file without `.pub` is the private key and never leaves the
machine.

For several accounts on one machine, `~/.ssh/config` gives each an alias:

```text
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
```

then `git@github-work:org/project.git` as the remote URL. This is the clean answer
to work and personal accounts on one laptop — better than juggling agents.

## HTTPS and credential helpers

Git asks a **credential helper** for the username and password, so you type them
once:

```bash
git config --global credential.helper store        # PLAIN TEXT in ~/.git-credentials
git config --global credential.helper cache        # in memory, default 15 minutes
git config --global credential.helper libsecret    # Linux keyring
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper manager      # Windows
```

⚠️ **`store` writes the token in plain text**, unencrypted, in your home
directory. It is documented behaviour, not a bug. It is acceptable on a personal
machine you control and a bad idea anywhere shared.

Prefer the platform helper. On Linux, `libsecret` needs
`git-credential-libsecret` installed and is worth the five minutes.

**Passwords do not work on the major hosts.** When HTTPS prompts for a password,
what goes there is a **personal access token**, generated in the host's settings
with a scope and an expiry. A token that has expired produces an authentication
failure that looks exactly like a wrong password — check the expiry before
anything else.

Clearing a bad stored credential:

```bash
git credential reject <<< $'protocol=https\nhost=github.com\n\n'
```

or delete the entry from the keyring / `~/.git-credentials` directly.

## `insteadOf`: rewrite URLs without touching remotes

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

Every HTTPS GitHub URL is now used over SSH, including ones inside submodules and
scripts you did not write. The reverse is the standard CI trick:

```bash
git config --global url."https://x-access-token:$TOKEN@github.com/".insteadOf "git@github.com:"
```

It is the tidiest way to change transport globally without editing every clone.

## Diagnosing

```bash
GIT_SSH_COMMAND="ssh -v" git fetch     # verbose SSH
GIT_CURL_VERBOSE=1 git fetch           # verbose HTTPS
GIT_TRACE=1 git fetch                  # what Git is doing
ssh -T git@github.com                  # is SSH auth working at all?
```

`ssh -T` is the fastest triage: if it fails, the problem is the key, not Git.

## Trade-off

**Git delegates authentication entirely, which keeps it simple and makes every
auth failure someone else's error message inside Git's output.**

There is no Git account, no Git login, no Git permission model. Git shells out to
`ssh` or `curl` and reports what came back. That is why the same commands work
against GitHub, GitLab, a bare repo on a server and a directory on a USB stick —
and why the protocol has outlived several generations of hosting.

The cost lands on diagnosis. `Permission denied (publickey)` is an SSH message;
`403` is the host's; `could not read Username` is the credential helper's. Git
forwards them without translation, so knowing which layer failed is on you, and
the three verbose flags above are the only real instruments.

The mitigation is knowing the layers exist. **`ssh -T git@<host>` tests
authentication with no Git involved**, and it splits the problem in half in one
command. Most of the time the answer is an expired token or a key that is not
loaded in the agent — neither of which is a Git problem at all.

## Gotchas

**Symptom:** `Permission denied (publickey)`
**Cause:** SSH could not authenticate — the key is not loaded, not registered with the host, or the wrong one is being offered
**Fix:** `ssh -T git@github.com` to confirm, `ssh-add -l` to see what the agent holds, `ssh -v` to see which key is offered

**Symptom:** HTTPS keeps prompting for a password and rejecting it
**Cause:** the hosts stopped accepting account passwords; a personal access token goes in that field. Or the stored token expired
**Fix:** generate a token, check its scopes and expiry, and let a credential helper store it

**Symptom:** your token is sitting in plain text in `~/.git-credentials`
**Cause:** `credential.helper store` does exactly that, by design
**Fix:** switch to a keyring helper — `libsecret`, `osxkeychain`, `manager` — and delete the file

**Symptom:** a submodule clones over HTTPS although your remote is SSH
**Cause:** submodule URLs come from `.gitmodules` and are independent of the parent's remote
**Fix:** `url.<base>.insteadOf`, which rewrites URLs globally including submodules

**Symptom:** work and personal accounts collide on one machine
**Cause:** SSH offers the first matching key, and the host maps the key to an account
**Fix:** a `~/.ssh/config` host alias per account, with `IdentityFile`, and remote URLs using the alias

**Symptom:** SSH works from your terminal but not from an editor or cron
**Cause:** no SSH agent in that environment
**Fix:** use HTTPS with a keyring helper there, or configure the agent for that environment. `GIT_SSH_COMMAND="ssh -v"` shows what is being tried

## Interview questions

**★ SSH or HTTPS?**
Neither is more capable — both do everything Git can do, and the choice is about how
you authenticate and what your network permits. SSH uses a key pair whose public half
is registered with the host and is pleasant on a machine you control and push from
often; HTTPS uses a personal access token held by a credential helper and gets
through the strict proxies that block port 22. Switching costs nothing, because the
objects are already local and only the address changes: `git remote set-url origin
…`.

**★ Someone asks you to send them your SSH key. What do you send?**
The `.pub` file — `~/.ssh/id_ed25519.pub` — and nothing else. The file without the
`.pub` suffix is the private key and never leaves the machine. `ed25519` is the
modern default and produces short keys, and the four commands that cover the whole
setup are `ssh-keygen -t ed25519`, `cat` the public half to paste it, `ssh-add` to
load it into the agent, and `ssh -T git@github.com` to confirm the host recognises
you.

**★ HTTPS keeps prompting for a password and rejecting the right one. What is
happening?**
The major hosts no longer accept account passwords over HTTPS: what belongs in that
field is a personal access token, generated in the host's settings with scopes and an
expiry. An **expired** token fails in a way that is indistinguishable from a wrong
password, so the expiry is the first thing to check. Once it works, a credential
helper stores it so you are not asked again.

**★ What is wrong with `credential.helper store`?**
It writes the token in plain text, unencrypted, in `~/.git-credentials` — documented
behaviour rather than a bug. On a personal machine you control that is a defensible
convenience; on a shared or temporary machine it is a credential with write access to
everything you can see, sitting in a readable file. The platform helpers —
`libsecret`, `osxkeychain`, `manager` — are keyring-backed and cost about five minutes
to set up.

**★ How do you keep work and personal Git accounts apart on one laptop?**
With a `~/.ssh/config` host alias per account: a `Host github-work` block naming
`HostName github.com` and its own `IdentityFile`, then remote URLs written as
`git@github-work:org/project.git`. The host maps a key to an account, and SSH
otherwise offers the first matching key, so aliases are what make the choice
explicit. It is cleaner than juggling agents or remembering to swap keys.

**★ What does `url.<base>.insteadOf` solve that `remote set-url` cannot?**
URLs you do not control. `git config --global url."git@github.com:".insteadOf
"https://github.com/"` rewrites every matching URL globally — including ones inside
`.gitmodules` and in scripts written by other people — so a submodule that hard-codes
HTTPS is fetched over SSH anyway. The reverse form is the standard CI trick, mapping
SSH URLs onto an HTTPS URL carrying a token.

**Why do Git's authentication errors feel so unhelpful?**
Because Git delegates authentication entirely and forwards other tools' messages
without translation. There is no Git account, login or permission model — it shells
out to `ssh` or `curl` and reports what came back, which is what lets the same
commands work against GitHub, a bare repo on a server and a directory on a USB stick.
So `Permission denied (publickey)` is SSH's, `403` is the host's, and `could not read
Username` is the credential helper's. `ssh -T git@<host>` tests authentication with no
Git involved and splits the problem in half in one command; most of the time the
answer is an expired token or a key that is not loaded in the agent.

---

← Prev: [`git push` in full](07-git-push.md) · Next → [Phase 4 index](README.md)
