---
title: "Rootless, and the UID shift"
sidebar_label: "02 · Rootless and the UID shift"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Podman — podman-unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [Podman — troubleshooting](https://github.com/containers/podman/blob/main/troubleshooting.md),
> [Podman — podman-run `--userns`](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/).
> **No sandbox** — no console output on this page.

**Rootless containers get to have a root user because the kernel lets an
unprivileged user own a range of UIDs that are not theirs on the host.** The
container sees 0; the host sees a number from that range. Files written through
a bind mount carry the host-side number, and that number is the one confusing
you.

## What a user namespace does here

`podman unshare` is the same machinery, exposed as a command, and its
documentation states the mapping directly. It *"launches a process (by default,
`$SHELL`) in a new user namespace"* where

> *"the invoking user's UID and primary GID appear to be UID 0 and GID 0,
> respectively"*

and

> *"Any ranges which match that user and group in `/etc/subuid` and
> `/etc/subgid` are also mapped in as themselves with the help of the
> `newuidmap(1)` and `newgidmap(1)` helpers."*

So a rootless container's UID map has two entries:

| Inside the container | On the host |
|---|---|
| UID `0` | **your own UID** |
| UID `1` … `65536` | your subordinate range from `/etc/subuid`, in order |

The manual's own example maps container UIDs 1–65536 onto host UIDs
10000–75535. Your range will be different — `/etc/subuid` allocates a block per
user, and where it starts depends on how many users were created before yours —
but the shape never changes.

## The formula

For any container UID `n`:

```
n == 0   →  your host UID
n >= 1   →  subuid_start + (n - 1)
```

Work an example. Suppose `/etc/subuid` gives you a range starting at `165536`,
and your container runs the official Node image as UID `1000`:

```
165536 + (1000 - 1) = 166535
```

`ls -ln` on the host shows `166535`. `ls -l` shows `166535` as well, because
that number has no name — Podman's troubleshooting guide describes exactly this:

> *"the UID and GID are displayed rather than the corresponding username and
> groupname. The UID and GID numbers displayed are from the user's subordinate
> UID and GID ranges on the host system."*

Two things fall out of the formula that people find surprising:

**A container running as root produces files owned by you.** `n = 0` maps to
your own UID, so `podman run -v "$(pwd)":/data alpine touch /data/x` gives you a
file you own. Rootless containers are *easier* to work with as root than as a
non-root user — the exact opposite of the rootful case, and the reason a working
Docker command can break when you move it to Podman untouched.

**The shift is the same in reverse.** Files on the host owned by your UID appear
inside the container as owned by root. Files owned by anything else appear as
`nobody` (65534), because they are outside the mapped range and have no
representation in the namespace.

## Diagnosing it in three commands

```bash
cat /etc/subuid                        # your allocated range: name:start:count
podman unshare cat /proc/self/uid_map  # the actual mapping, as the kernel sees it
ls -ln                                 # the numeric owner of the files in question
```

`/proc/self/uid_map` prints one line per range — *container id*, *host id*,
*count* — which is the formula above, written by the kernel rather than inferred
by you. If those three outputs are consistent with the file you are staring at,
there is no bug: the mapping is doing precisely what it is for.

To *read* the files as the namespace sees them, enter the namespace:

```bash
podman unshare less dir1/a
podman unshare ls -ln dir1
```

Inside `podman unshare`, your ordinary user is UID 0 and the subordinate range
is mapped in, so ownership prints the way the container sees it, and you can act
on it. That is chunk 03's `podman unshare chown`.

## Rootless volumes are not exempt, they are just quieter

A named volume under rootless Podman lives in
`~/.local/share/containers/storage/volumes/`, and its files carry the same
shifted UIDs. You do not usually notice, for two reasons: the volume was
pre-populated with the image's ownership so the container can write to it, and
you never look at it with `ls` from outside.

The moment you do look — a backup script, a `du`, a "why is my home directory
full" investigation — the shifted numbers are there. Use `podman unshare` for
those tasks too, and Phase 11's Podman depth for the storage layout.

## Docker's rootless mode has the same shape

This is not a Podman-only story. Docker's rootless mode runs the daemon in a
user namespace with subordinate UIDs from the same `/etc/subuid`, so the
arithmetic is identical. What differs is the tooling around it: Podman ships
`podman unshare` as a first-class way in, and Docker does not have a direct
equivalent — you go through a container instead.

Also worth separating clearly, because the terms get mixed up:

| | What it is |
|---|---|
| **Rootless** | the *engine* runs as an unprivileged user; containers are inside a user namespace |
| **Rootful with `--user`** | the engine is root; the *container process* runs as a chosen UID, unshifted |
| **`userns-remap`** (Docker) | a rootful daemon that still puts containers in a user namespace, producing the same shift |

`--user 1000:1000` under a rootless engine does **not** give you host UID 1000 —
it gives you container UID 1000, which maps to `subuid_start + 999`. That is the
single most common wrong turn, and `--userns=keep-id` is the flag that actually
does what people mean by it (chunk 03).

## Gotchas

**Symptom:** Files in your project are owned by `166535`, a UID that does not
exist in `/etc/passwd`.
**Cause:** A rootless container wrote them as a non-root container UID, which
maps into your subordinate range.
**Fix:** Nothing is broken — this is the mapping. Change it with
`--userns=keep-id`, fix the existing files with `podman unshare chown`, or run
the container as root so writes land as you. Chunk 03.

**Symptom:** The container sees a bind-mounted directory as owned by `nobody`
and cannot write to it.
**Cause:** The host owner is outside your mapped range, so it has no
representation inside the namespace and is reported as 65534.
**Fix:** Make the host directory yours, or map the right IDs in with
`--userns=keep-id` or `--uidmap`.

**Symptom:** A `docker run --user 1000:1000 …` command was moved to rootless
Podman and the ownership got *worse*.
**Cause:** Under rootless, container UID 1000 maps to `subuid_start + 999`, not
to host UID 1000.
**Fix:** Drop the `--user` and use `--userns=keep-id`, which is the flag that
means "my host identity, inside".

**Symptom:** A backup script run from the host reports a mountain of unreadable
files under `~/.local/share/containers/storage/volumes/`.
**Cause:** Volume contents carry shifted UIDs too; they are simply not usually
looked at from outside.
**Fix:** Run the backup through `podman unshare`, or — better — through a
container, which is the portable idiom (page 10).

## Interview questions

**★ Why is a file written by a rootless container owned by a five- or six-digit
UID?**
Because rootless containers run inside a user namespace: container UID 0 maps to
your host UID, and container UIDs 1 upwards map onto your subordinate range from
`/etc/subuid`. A container process running as UID 1000 therefore writes
`subuid_start + 999` on the host — a number with no `/etc/passwd` entry, which
is why `ls -l` prints the digits.

**★ Under rootless Podman, does running the container as root make ownership
worse or better?**
Better, which is the counter-intuitive part. Container UID 0 maps to your own
host UID, so a root container writes files you own. It is a non-root container
UID that lands in the subordinate range. This is the reverse of rootful Docker,
where container root *is* host root and produces root-owned files.

**★ Why does `--user 1000:1000` not fix rootless ownership?**
Because it sets the UID *inside* the namespace, and the namespace still maps it.
Container 1000 becomes `subuid_start + 999` on the host, not host UID 1000. The
flag that expresses "keep my host identity" is `--userns=keep-id`, optionally
with `uid=`/`gid=` sub-options.

**How do you inspect the actual mapping rather than guessing it?**
`cat /etc/subuid` for the allocated range, and
`podman unshare cat /proc/self/uid_map` for what the kernel actually applied —
one line per range, giving container id, host id and count. Then `ls -ln` on the
files to compare numbers.

**Why does the container see some host files as owned by `nobody`?**
Because their owner is outside the mapped range and has no representation inside
the namespace, so the kernel reports the overflow UID, 65534. It is the same
mapping seen from the other side.

**Is this Podman-specific?**
No. Docker's rootless mode uses the same `/etc/subuid` machinery and produces
the same arithmetic, as does rootful Docker with `userns-remap`. What Podman
adds is `podman unshare`, a first-class way to step into the namespace and work
with the files directly; on Docker the equivalent is to go through a container.

---

← Prev: [A UID is just a number](01-a-uid-is-just-a-number.md) · Index: [File ownership and UID mismatch](README.md) · Next → [The fixes, and when to use each](03-the-fixes.md)
