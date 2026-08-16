---
title: "podman unshare"
sidebar_label: "06 · podman unshare"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-unshare(1)](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [podman-mount(1)](https://docs.podman.io/en/latest/markdown/podman-mount.1.html),
> [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [chown(2)](https://man7.org/linux/man-pages/man2/chown.2.html) and
> [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/).
> **No sandbox** — no console output on this page.

`podman unshare` is not an exotic debugging tool. It is **a shell inside the same
user namespace your rootless containers already run in** — the one place on the
machine where container UIDs are the real ones, and therefore the only place
where you can fix anything that a container's UIDs created.

The man page is one sentence: it "launches a process (by default, `$SHELL`) in a
new user namespace", where "the invoking user's UID and primary GID appear to be
**UID 0 and GID 0**, respectively. Any ranges which match that user and group in
`/etc/subuid` and `/etc/subgid` are also mapped in as themselves with the help of
the `newuidmap(1)` and `newgidmap(1)` helpers."

That is the identical mapping
[Phase 11 · 02](02-rootless-by-default/README.md) derives for containers. The
command's whole value is that it lets *you* stand in it too.

## The problem it exists to solve

A rootless container running as UID 1000 writes a file. On the host, with a
typical `you:100000:65536` range, that file is owned by **100999** — a UID with
no name, which `ls -l` prints as a bare number. You own the subordinate range on
paper, and you still cannot touch the file:

```bash
chown 1000:1000 ./appdata          # Operation not permitted
```

`chown(2)` is blunt about why: "**Only a privileged process (Linux: one with the
`CAP_CHOWN` capability) may change the owner of a file.**" Outside the namespace
you are an ordinary user with no such capability, and `EPERM` means exactly what
it says — "the calling process did not have the required permissions … to change
owner and/or group".

⚠️ **`sudo chown 1000:1000` "works" and makes it worse.** It succeeds, because
now you really are privileged — but it writes the *host's* UID 1000, which is
outside your subordinate range and therefore maps to nothing inside the
container. The container then sees the file as `nobody`, the overflow ID
[`user_namespaces(7)`](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
documents as **65534**. You have not changed the ownership; you have moved the
problem to the other side of the map.

`podman unshare` fixes the right side:

```bash
# "Owned by UID 1000 AS THE CONTAINER SEES IT" → host 100999
podman unshare chown -R 1000:1000 ./appdata
```

Inside that namespace you are UID 0, and
[`user_namespaces(7)`](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
grants a process "full privileges for operations inside the user namespace, but
… unprivileged for operations outside" it. `CAP_CHOWN` over the mapped range is
one of those inside-privileges. Nothing on the host was escalated.

## Read your own mapping before you guess at it

Run with no command and you get a shell; the two things worth looking at
immediately are your identity and the map itself:

```bash
podman unshare                     # a $SHELL where id says uid=0(root)
podman unshare cat /proc/self/uid_map
```

The map prints as rows of three numbers, which
[`user_namespaces(7)`](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
defines as the start of the range **in** the namespace, the start of the range
**to which** it maps, and the size of the range. Two rows is the normal rootless
shape — one for you as UID 0, one for the whole subordinate block — and reading
them is faster than doing the arithmetic from `/etc/subuid` in your head.

🔴 **Do this before filing a bug about ownership.** Most "Podman broke my
permissions" reports are the map behaving exactly as documented, and the map is
two lines away.

## The four jobs it is actually for

The reference gives two purposes — "troubleshooting unprivileged operations and
manually clearing storage" — and two of the four uses below are consequences of
them.

**1 · Fixing ownership of files a container created.** The case above, and the
one you will hit first. It is one of seven ranked answers in
[Phase 6 · 05 · The fixes](../phase-6-storage/05-uid-mismatch/03-the-fixes.md),
and it is the right one specifically for **files that already exist** — for
files that do not yet exist, changing the mapping (`--userns=keep-id`) or the
container's user is cheaper.

**2 · Deleting a directory you cannot delete.** A tree written by a container's
root, or a half-removed storage directory, is owned by IDs you have no authority
over. `podman unshare rm -rf ./that-directory` removes it from inside the
mapping. This is what "manually clearing storage" means in practice.

**3 · Mounting a container's filesystem.** `podman mount` "mounts the specified
containers' root file system in a location which can be accessed from the host",
and rootless it does not work on its own: the unshare page says plainly that
"`podman mount` fails for unprivileged users unless running inside a `podman
unshare` session", and `podman-mount(1)` adds that "rootless mode only supports
mounting VFS driver, unless Podman is run within the user namespace via the
`podman unshare` command". So the working shape is a session, not a one-liner:

```bash
podman unshare
mnt=$(podman mount my-container)   # only valid inside this namespace
ls "$mnt"/etc
```

⚠️ **The mount path is only meaningful inside the namespace.** Leave the shell
and the path is not something another process can use.

**4 · Joining the rootless network namespace.** `--rootless-netns` "join[s] the
rootless network namespace used for netavark networking" — the reason a rootless
container's IP is unreachable from the host, argued in
[Phase 7 · 11 · Debugging the network](../phase-7-networking/11-debugging-the-network.md).
It is the network sibling of everything above: same command, different namespace,
same reason it is needed.

Inside the session Podman also exports **`CONTAINERS_GRAPHROOT`** and
**`CONTAINERS_RUNROOT`** — the persistent and volatile storage roots — so a
script does not have to reconstruct `~/.local/share/containers/storage` by hand.

## What it is not

**It is not `sudo` and it is not a privilege escalation.** You are UID 0 over
your own files and your own subordinate range, and nothing else. Every
shortcoming in
[Phase 11 · 02](02-rootless-by-default/README.md) still applies inside the
session: you cannot bind port 80, you cannot create device nodes, you cannot
touch another user's files. If a command needs real root, `unshare` will not
give it to you — it will fail in the same way, one namespace further in.

**It is not available everywhere.** The reference states that "this command is
not available with the remote Podman client", which quietly covers macOS and
Windows, where the CLI talks to a VM ([Phase 11 · 15](15-podman-machine.md)) rather than to local storage. The files you want to fix are
inside that VM, so the fix has to run inside it too — `podman machine ssh` first,
then `podman unshare` there.

**Docker has no equivalent command.** Rootless Docker uses the same kernel
feature and the same `newuidmap`/`newgidmap` helpers, and its documentation
requires "at least 65,536 subordinate UIDs/GIDs for the user" in the same files —
but the daemon owns the namespace, and the rootless page documents no
convenience command for entering it. On Docker the practical answers are the
ones that avoid needing to: `--user`, a named volume, or an entrypoint that
`chown`s at startup.

## Gotchas

**Symptom:** `chown` on a bind-mounted directory fails with "Operation not
permitted", even though you own the directory.
**Cause:** Changing a file's *owner* needs `CAP_CHOWN`, which you do not have on
the host. Owning the file is not enough — that only lets you change its group,
and only to a group you belong to.
**Fix:** `podman unshare chown -R <uid>:<gid> <path>`, using the UID **as the
container sees it**.

**Symptom:** `sudo chown -R 1000:1000 ./data` succeeded, and now the container
says every file belongs to `nobody`.
**Cause:** Host UID 1000 is not in your subordinate range, so it maps to nothing
inside the namespace and renders as the overflow ID 65534.
**Fix:** Re-run it through `podman unshare` so the number is interpreted on the
container's side of the map.

**Symptom:** `podman unshare` is not recognised, or fails immediately, on macOS
or Windows.
**Cause:** The command "is not available with the remote Podman client", and on
those platforms the CLI is a remote client to a Linux VM.
**Fix:** `podman machine ssh`, then run `podman unshare` inside the VM — that is
where the storage actually lives.

**Symptom:** `podman mount` returns a path, and the directory looks empty from
another terminal.
**Cause:** The mount exists inside the unshare session's namespace. A second
shell is not in it.
**Fix:** Do the work in the same session — start `podman unshare` first, mount
inside it, and finish before leaving.

## Interview questions

**★ What does `podman unshare` do, and why would you need it?**
It launches a process — your `$SHELL` by default — in a new user namespace where
your UID and primary GID appear as 0 and your `/etc/subuid`/`/etc/subgid` ranges
are mapped in as themselves. You need it because a rootless container's files are
owned by IDs from that subordinate range, and outside the namespace you have no
capability to change their ownership. Inside it, you do.

**★ Why is `sudo chown` the wrong fix for a rootless volume's permissions?**
Because it operates on the wrong side of the mapping. `sudo` gives you real
`CAP_CHOWN`, so the command succeeds, but it writes a host UID that is outside
your subordinate range — so the container sees an unmapped ID rendered as
`nobody` (overflow ID 65534). `podman unshare chown` writes the number the
container will actually resolve.

**★ Is `podman unshare` a privilege escalation?**
No. `user_namespaces(7)` is explicit that a process can have "full privileges for
operations inside the user namespace" while remaining "unprivileged for
operations outside" it. You are root over your own files and your own delegated
ID range and nothing more — the same boundary every rootless container runs
inside.

**When do you reach for `podman unshare` instead of `--userns=keep-id`?**
When the files already exist. `keep-id` changes the mapping for a future
container, which is the cheaper answer going forward; `unshare` repairs
ownership that a previous container already wrote. In a long-lived project you
usually end up doing one of each, once.

**Why does `podman mount` need it?**
Because mounting a container's root filesystem is a privileged operation on the
host. The documentation says `podman mount` "fails for unprivileged users unless
running inside a `podman unshare` session", and that rootless mode otherwise only
supports the VFS driver. Note that the mount is only visible inside that session.

**What is `--rootless-netns` for?**
It joins "the rootless network namespace used for netavark networking" instead of
creating a user namespace for file work. It is how you reach a rootless
container's IP directly from the host, which otherwise does not work because
that address only exists inside the network namespace.

---

← Prev: [Where Podman will bite you](05-where-podman-bites/README.md) · Index: [Phase 11](README.md) · Next → [07 · `--userns`: `keep-id`, `nomap`, `auto`](07-userns-modes.md)
