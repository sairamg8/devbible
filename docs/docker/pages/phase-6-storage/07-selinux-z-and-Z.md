---
title: "SELinux :z and :Z"
sidebar_label: "07 · SELinux :z and :Z"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — bind mounts (SELinux labels)](https://docs.docker.com/engine/storage/bind-mounts/),
> [Podman — troubleshooting](https://github.com/containers/podman/blob/main/troubleshooting.md) and
> [Podman — podman-run `--mount`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**On Fedora, RHEL, CentOS Stream and Rocky, a bind mount that looks perfect
still gets "permission denied" — and two characters fix it.** The cause is not
file modes and not UIDs. It is SELinux, and confusing it with the previous
topic's UID mismatch is the most common way to waste an hour here.

## Why it happens

SELinux labels every file and every process with a *type*. A container process
runs as `container_t` and the policy lets it read and write files labelled
`container_file_t` — and essentially nothing else.

Files in your home directory are labelled `user_home_t`. Files in `/srv` are
`var_t`. Neither is `container_file_t`, so the policy denies the access before
the file's mode is ever consulted. That is why `chmod 777` does nothing here:
you fixed the wrong layer.

**The engine labels its own volumes correctly** — a named volume under
`/var/lib/docker/volumes` or Podman's storage is created with the right type,
which is one more reason bind mounts are where the pain is.

## Recognising it, rather than guessing

| Clue | Points to |
|---|---|
| "Permission denied" while `ls -l` shows a mode that should allow it | **SELinux** |
| The distribution is Fedora, RHEL, CentOS Stream or Rocky | **SELinux** — Ubuntu and Debian use AppArmor and do not do this |
| `ls -Z` shows something other than `container_file_t` on the source | **SELinux** |
| The owner is a five- or six-digit number, or `nobody` | **UID mapping** — topic 05, not this page |
| `setenforce 0` makes it work | **SELinux**, confirmed |

```bash
getenforce                    # Enforcing / Permissive / Disabled
ls -Zd /srv/data              # the label on the source directory
ausearch -m avc -ts recent    # the actual denial, with the source and target types
journalctl -t setroubleshoot  # the human-readable version, if installed
```

⚠️ **`setenforce 0` is a diagnostic, not a fix.** Use it to confirm the
diagnosis in one second, then put it back with `setenforce 1` and fix the label
properly. A machine left permissive is a machine with its SELinux policy turned
off, and nobody remembers to turn it back on.

## `:z` and `:Z`

Append one character to the mount and the engine relabels the source for you.
Docker's documentation defines them precisely:

> The `z` option indicates that *"the bind mount content is shared among
> multiple containers."*

> The `Z` option indicates that *"the bind mount content is private and
> unshared."*

```bash
podman run -v /srv/data:/data:z  myapp      # several containers may use it
podman run -v /srv/data:/data:Z  myapp      # only this container may use it
podman run -v /srv/data:/data:ro,z myapp    # combine with other options
```

Mechanically: **`z` sets the type to `container_file_t` with no MCS category**,
so any container can use it. **`Z` sets the same type *plus* a category unique
to that container**, so only that container can. `Z` is stricter and better —
right up until two services need the same directory, at which point `Z` on one
of them locks the other out with the identical error you started with.

**Rule of thumb: `:Z` for a directory one container owns. `:z` the moment a
second container needs it.**

## The warning that matters most

The relabel is **recursive**, and the engine will do exactly what you asked:

> *"Bind-mounting a system directory such as `/home` or `/usr` with the `Z`
> option renders your host machine inoperable and you may need to relabel the
> host machine files by hand."*

`-v /home:/data:Z` relabels your entire home directory with a category only that
container can use. Your desktop session, your SSH keys and your package manager
then cannot read their own files. Recovery is `restorecon -R /home` and a lot of
regret.

🔴 **Never put `:z` or `:Z` on `/`, `/home`, `/usr`, `/etc`, `/var` or your whole
project root.** Point them at the specific directory the container needs, which
is a good idea for a dozen other reasons anyway.

## The alternatives, and when each is right

**1. `chcon` — relabel by hand, temporarily.**

```bash
sudo chcon -R -t container_file_t /srv/data
sudo chcon -R system_u:object_r:container_file_t:s0 /var/test    # the full context
```

Podman's troubleshooting guide gives the second form directly. The catch is in
the word *temporarily*: `chcon` writes the label but not the policy, so a
filesystem relabel (`restorecon`, a `touch /.autorelabel` reboot, some updates)
reverts it.

**2. `semanage fcontext` + `restorecon` — relabel permanently.**

```bash
sudo semanage fcontext -a -t container_file_t "/srv/data(/.*)?"
sudo restorecon -Rv /srv/data
```

This adds a rule to the policy, so the label survives everything. **For a
server directory that containers will use for years, this is the correct
answer** — not `:Z` on every run command.

**3. `--security-opt label=disable` — opt this container out.**

```bash
podman run --security-opt label=disable -v /srv/data:/data myapp
```

Straight from the troubleshooting guide, and a real option when the source is a
directory you must not relabel — an NFS mount, a shared system path, someone
else's data. Understand what you bought: SELinux confinement is off **for that
container**, so a container escape has one fewer barrier in front of it.

**4. `-v /var/test:/dir:O` — an overlay (Podman).** The container gets an
overlay over the directory: it reads the host's content and its writes go to a
transient upper layer that never touches the host. Also listed in the
troubleshooting guide, and neat when the container only needs to *read*.

**5. Use a named volume.** The engine labels its own volumes correctly, so this
whole page is about bind mounts and not about volumes. Where the container owns
the data, the problem was avoidable.

## Docker and Podman

The suffixes are identical, and both engines apply them only where SELinux is
actually enabled — `:z` on Ubuntu is accepted and does nothing. Three real
differences:

| | Docker | Podman |
|---|---|---|
| `-v …:z` / `:Z` | supported | supported |
| Setting a label with `--mount` | ❌ *"It is not possible to modify the SELinux label using the `--mount` flag"* | ✅ `--mount type=bind,…,relabel=shared` or `relabel=private` |
| Swarm services | ⚠️ *"When using bind mounts with services, SELinux labels (`:Z` and `:z`), as well as `:ro` are ignored"* | n/a |

That first row is a genuine annoyance: page 03 recommends `--mount` for
everything scripted, and on Docker an SELinux relabel is the one thing it cannot
express. On an SELinux host with Docker, either use `-v` for that mount, or —
better — set the label properly with `semanage fcontext` and keep `--mount`.

**Rootless Podman adds one constraint:** you can only relabel files you own. A
rootless container bind-mounting a root-owned directory cannot fix its label,
and the troubleshooting guide's phrasing is that rootless users *"lack privileges
to modify these labels when mounting directories they don't own"* — so the
answer there is `semanage`/`chcon` as root beforehand, `label=disable`, or `:O`.

## Gotchas

**Symptom:** "Permission denied" on a bind mount, and the mode and owner are
both obviously correct.
**Cause:** SELinux — the source is not labelled `container_file_t`.
**Fix:** Confirm with `getenforce` and `ls -Zd`, then add `:z` or `:Z`, or set
the label permanently with `semanage fcontext` + `restorecon`.

**Symptom:** Adding `:Z` fixed one container and broke another that uses the
same directory.
**Cause:** `Z` applies a **private** MCS category, so only the container that
relabelled it has access.
**Fix:** Use `:z` for shared content. Two containers, one directory, means
shared by definition.

**Symptom:** After running a container with `-v /home/me:/data:Z`, the desktop
session and `ssh` broke.
**Cause:** The relabel is recursive, and it retyped the entire home directory
with a private category.
**Fix:** `restorecon -R /home/me`, and never point `:z`/`:Z` at a system or home
directory again.

**Symptom:** The `chcon` fix worked and stopped working weeks later.
**Cause:** `chcon` changes the label, not the policy, so a filesystem relabel
reverted it.
**Fix:** `semanage fcontext -a -t container_file_t "<path>(/.*)?"` followed by
`restorecon -Rv <path>`.

## Interview questions

**★ A bind mount gets "permission denied" on Fedora with correct modes and
matching UIDs. What is happening?**
SELinux. The container process runs as `container_t` and the policy only allows
it at files labelled `container_file_t`; a host directory is labelled
`user_home_t`, `var_t` or similar, so access is denied before the mode is
considered. `getenforce` and `ls -Zd` confirm it in two commands; `:z`, `:Z` or
a `semanage` rule fixes it.

**★ What is the difference between `:z` and `:Z`?**
`z` relabels the content as shared — `container_file_t` with no MCS category, so
any container can use it. `Z` relabels it private and unshared — the same type
plus a category unique to that container, so only that container can. Use `Z`
for a directory one container owns, and `z` as soon as a second container needs
the same path.

**★ Why is `:Z` dangerous on the wrong directory?**
Because the relabel is recursive and the engine does exactly as asked. Docker's
own documentation warns that bind-mounting `/home` or `/usr` with `Z` *"renders
your host machine inoperable"* — the private category locks the host's own
processes out of their files, and recovery means relabelling by hand with
`restorecon`.

**What is the permanent fix, and why prefer it on a server?**
`semanage fcontext -a -t container_file_t "/srv/data(/.*)?"` followed by
`restorecon -Rv /srv/data`. It writes the policy rather than just the current
label, so it survives a filesystem relabel — unlike `chcon`, which silently
reverts. It also means the run commands stop carrying an SELinux flag they
should not need to know about.

**Is `--security-opt label=disable` acceptable?**
Sometimes — for a source you genuinely must not relabel, such as an NFS mount or
a shared system path. But it turns off SELinux confinement for that container,
so it removes a real barrier in front of a container escape. Prefer a correct
label, and treat `label=disable` as a documented exception.

**Does `--mount` support this?**
On Docker, no — *"It is not possible to modify the SELinux label using the
`--mount` flag"*, which is the one place its otherwise-preferable syntax falls
short. Podman's `--mount` does, via `relabel=shared` and `relabel=private`. On
Docker with SELinux, either use `-v` for that mount or set the label out of band
with `semanage`.

---

← Prev: [Volume lifecycle](06-volume-lifecycle.md) · Index: [Phase 6](README.md) · Next → [`--read-only` and `tmpfs`](08-read-only-rootfs.md)
